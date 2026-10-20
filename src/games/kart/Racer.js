import * as THREE from 'three';
import { buildKartLabel, buildKartModel } from '../three/kartModel.js';
import { kartStats } from './karts.js';

const BRAKE = 50;
const REVERSE_MAX = 12;
const COAST = 10;
export const NITRO_CHARGES = 3;
const NITRO_FACTOR = 1.45;
const NITRO_MS = 1200;
const NITRO_REFILL_MS = 4000;
const SPIN_MS = 1100;
export const SHIELD_MS = 8000;
export const RACER_RADIUS = 1.7;

const shieldGeometry = new THREE.SphereGeometry(2.7, 16, 12);

// Un kart con manejo "desde atrás": el stick gira a la izquierda o derecha,
// A / RT acelera, B / LT frena (y da reversa), RB usa nitro y X lanza el poder que traiga.
// `setup` es lo que se escogió en el taller ({ character, type, color, wheels, extra }); `drivers`, un DriverArt.
// `color` es el del jugador (su letrero); el kart va pintado del color que escogió.
export class Racer {
  constructor({ color, label, deviceId = null, setup, drivers }) {
    this.color = color;
    this.label = label;
    this.deviceId = deviceId;
    this.isCpu = deviceId === null;
    this.setup = setup;
    this.stats = kartStats(setup.type);
    const { group, flame, seat } = buildKartModel(setup.color, { type: setup.type, wheels: setup.wheels, extra: setup.extra, driver: true });
    this.object = group;
    this.flame = flame;
    this.driver = drivers.createDriver(setup.character, deviceId);
    this.driver.sprite.position.copy(seat).setY(seat.y - this.driver.sink);
    this.object.add(this.driver.sprite);
    this.labelSprite = buildKartLabel(label, color);
    // Con la cámara detrás, el letrero mide lo mismo en pantalla esté cerca o lejos
    // (si no, un carro pegado a la cámara tapa media pantalla con su letrero).
    this.labelSprite.material.sizeAttenuation = false;
    this.object.add(this.labelSprite);
    this.shield = new THREE.Mesh(
      shieldGeometry,
      new THREE.MeshBasicMaterial({ color: 0x7fdcff, transparent: true, opacity: 0.35, depthWrite: false }),
    );
    this.shield.position.y = 1;
    this.object.add(this.shield);
    this.reset(0, 0, 0, 0);
  }

  reset(x, z, heading, index) {
    this.x = x;
    this.z = z;
    this.heading = heading;
    this.speed = 0;
    this.index = index;
    this.lap = -1;
    // Empiezan detrás de la meta: el primer cruce cuenta como el inicio de la vuelta 1.
    this.crossedHalf = true;
    this.progress = -1;
    this.finished = false;
    this.item = null;
    this.pendingItem = null;
    this.rollMs = 0;
    this.nitro = NITRO_CHARGES;
    this.nitroRefillMs = 0;
    this.boostMs = 0;
    this.boostFactor = 1;
    this.spinMs = 0;
    this.shieldMs = 0;
    this.wrongWayMs = 0;
    this.messageMs = 0;
    this.message = '';
  }

  say(text, ms = 1400) {
    this.message = text;
    this.messageMs = ms;
  }

  boost(factor, ms) {
    this.boostFactor = this.boostMs > 0 ? Math.max(this.boostFactor, factor) : factor;
    this.boostMs = Math.max(this.boostMs, ms);
  }

  // Le pega un poder: si trae burbuja se la revienta; si no, da vueltas y se frena.
  hit() {
    if (this.shieldMs > 0) {
      this.shieldMs = 0;
      return false;
    }
    this.spinMs = SPIN_MS;
    this.speed *= 0.3;
    this.boostMs = 0;
    return true;
  }

  // input: { steer: -1..1, gas: 0..1, brake: 0..1, nitro: bool }. `topFactor` ayuda a los que van atrás.
  update(dtMs, input, offroad, topFactor = 1) {
    const dt = dtMs / 1000;
    this.boostMs = Math.max(0, this.boostMs - dtMs);
    this.spinMs = Math.max(0, this.spinMs - dtMs);
    this.shieldMs = Math.max(0, this.shieldMs - dtMs);
    this.messageMs = Math.max(0, this.messageMs - dtMs);
    if (this.rollMs > 0) {
      this.rollMs = Math.max(0, this.rollMs - dtMs);
      if (this.rollMs === 0) this.item = this.pendingItem;
    }
    if (this.nitro < NITRO_CHARGES) {
      this.nitroRefillMs += dtMs;
      if (this.nitroRefillMs >= NITRO_REFILL_MS) {
        this.nitro += 1;
        this.nitroRefillMs = 0;
      }
    }

    const spinning = this.spinMs > 0;
    const gas = spinning ? 0 : input.gas;
    const steer = spinning ? 0 : input.steer;
    if (input.nitro && !spinning && this.nitro >= 1) {
      this.nitro -= 1;
      this.boost(NITRO_FACTOR, NITRO_MS);
    }

    const { maxSpeed, accel, turn } = this.stats;
    const top = maxSpeed * topFactor * (this.boostMs > 0 ? this.boostFactor : 1) * (offroad ? this.stats.offroad : 1);
    if (this.boostMs > 0) {
      this.speed = approach(this.speed, top, accel * 2 * dt);
    } else if (gas > 0.1) {
      const target = top * gas;
      this.speed = approach(this.speed, target, (this.speed < target ? accel : COAST) * dt);
    } else if (input.brake > 0.1 && !spinning) {
      this.speed = this.speed > 0 ? Math.max(0, this.speed - BRAKE * dt) : Math.max(-REVERSE_MAX, this.speed - accel * 0.6 * dt);
    } else {
      this.speed = approach(this.speed, 0, COAST * dt);
    }

    // Parado no gira; en reversa el volante se invierte, como un carro de verdad.
    const grip = Math.min(1, Math.abs(this.speed) / 10) * (this.speed < 0 ? -1 : 1);
    this.heading -= steer * turn * grip * dt;
    this.x += Math.sin(this.heading) * this.speed * dt;
    this.z += Math.cos(this.heading) * this.speed * dt;
  }

  render(timeMs) {
    const spin = this.spinMs > 0 ? (1 - this.spinMs / SPIN_MS) * Math.PI * 4 : 0;
    this.object.position.set(this.x, 0, this.z);
    this.object.rotation.y = this.heading + spin;
    this.flame.visible = this.boostMs > 0;
    if (this.flame.visible) this.flame.scale.setScalar(0.8 + Math.sin(timeMs / 30) * 0.25);
    // La burbuja parpadea cuando está por acabarse.
    this.shield.visible = this.shieldMs > 0 && (this.shieldMs > 1500 || Math.floor(this.shieldMs / 120) % 2 === 0);
  }
}

function approach(value, target, step) {
  return value < target ? Math.min(target, value + step) : Math.max(target, value - step);
}
