import * as THREE from 'three';
import { buildKartLabel, buildKartModel, disposeKartModel } from '../three/kartModel.js';
import { CARS } from './cars.js';
import { SPIN_MS } from './items.js';

const MAX_SPEED = 32;
const ACCEL = 22;
const BRAKE = 45;
const COAST = 14;
const TURN_RATE = 3.4;
const OFFROAD_FACTOR = 0.55;
const TURBO_FACTOR = 1.5;
const TURBO_MS = 1200;
const TURBO_COOLDOWN_MS = 3500;
export const KART_RADIUS = 1.7;

// Física de arcade: el carro gira hacia donde apunta el stick (respecto a la pantalla)
// y acelera según qué tanto se empuja. A = turbo, B = freno, X = su poder (ver items.js).
// Cada carro (cars.js) cambia la velocidad, el arranque, qué tan cerrado da vuelta, el pasto y el turbo.
export class Kart {
  constructor({ color, label, deviceId = null, car = CARS[0] }) {
    this.color = color;
    this.label = label;
    this.deviceId = deviceId;
    this.isCpu = deviceId === null;
    this.object = new THREE.Group();
    this.object.add(buildKartLabel(label, color));
    // La burbuja del escudo.
    this.shield = new THREE.Mesh(
      new THREE.SphereGeometry(2.6, 18, 12),
      new THREE.MeshBasicMaterial({ color: 0x9bf6ff, transparent: true, opacity: 0.35, depthWrite: false }),
    );
    this.shield.position.y = 1.2;
    this.shield.visible = false;
    this.object.add(this.shield);
    this.setCar(car);
    this.reset(0, 0, 0, 0);
  }

  // Cambia de carro (al escogerlo): otro modelo y otros números.
  setCar(car) {
    this.car = car;
    if (this.model) {
      this.object.remove(this.model);
      disposeKartModel(this.model);
    }
    const { group, flame } = buildKartModel(this.color, car.model);
    this.model = group;
    this.flame = flame;
    this.object.add(group);
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
    this.turboMs = 0;
    this.turboCooldownMs = 0;
    this.blinkMs = 0;
    this.trackDistance = 0;
    this.spinMs = 0;
    this.shieldMs = 0;
    this.item = null;
    this.itemUses = 0;
  }

  // Lo pone de regreso en la pista (al rescatarlo o acercarlo al grupo).
  teleport(point, index, speed) {
    this.x = point.x;
    this.z = point.z;
    this.heading = point.heading;
    this.index = index;
    this.speed = speed;
    this.blinkMs = 900;
  }

  turboReady() {
    return this.turboCooldownMs === 0;
  }

  // Un turbo de regalo (de las cajas): no gasta el de A.
  boost() {
    this.turboMs = TURBO_MS;
  }

  // Le pegan (aceite o cohete): da una vuelta y casi se para, a menos que traiga escudo (que se rompe).
  hit() {
    if (this.shieldMs > 0) {
      this.shieldMs = 0;
      return false;
    }
    this.spinMs = SPIN_MS;
    this.speed *= 0.35;
    this.turboMs = 0;
    return true;
  }

  update(dtMs, input, offroad, speedBonus) {
    const dt = dtMs / 1000;
    const { car } = this;
    this.turboMs = Math.max(0, this.turboMs - dtMs);
    this.turboCooldownMs = Math.max(0, this.turboCooldownMs - dtMs);
    this.blinkMs = Math.max(0, this.blinkMs - dtMs);
    this.shieldMs = Math.max(0, this.shieldMs - dtMs);
    if (this.spinMs > 0) {
      // Dando vueltas: no se maneja y se va frenando.
      this.spinMs = Math.max(0, this.spinMs - dtMs);
      this.speed = approach(this.speed, 0, BRAKE * 0.5 * dt);
      this.x += Math.sin(this.heading) * this.speed * dt;
      this.z += Math.cos(this.heading) * this.speed * dt;
      return;
    }
    if (input.turbo && this.turboReady()) {
      this.turboMs = TURBO_MS;
      this.turboCooldownMs = TURBO_COOLDOWN_MS;
    }

    let target = 0;
    const push = Math.min(1, Math.hypot(input.x, input.y));
    if (push > 0.3) {
      const diff = angleDiff(Math.atan2(input.x, input.y), this.heading);
      const maxTurn = TURN_RATE * car.turn * dt;
      this.heading += Math.max(-maxTurn, Math.min(maxTurn, diff));
      target = MAX_SPEED * car.speed * push * speedBonus;
      // Dando vuelta en U se frena un poco.
      if (Math.abs(diff) > 1.6) target *= 0.6;
    }
    if (this.turboMs > 0) target = Math.max(target, MAX_SPEED * car.speed * TURBO_FACTOR * car.turbo);
    if (offroad) target *= Math.min(1, OFFROAD_FACTOR * car.offroad);
    if (input.brake) target = 0;

    const rate = input.brake ? BRAKE : target > this.speed ? ACCEL * car.accel : COAST;
    this.speed = approach(this.speed, target, rate * dt);
    this.x += Math.sin(this.heading) * this.speed * dt;
    this.z += Math.cos(this.heading) * this.speed * dt;
  }

  render(timeMs) {
    this.object.position.set(this.x, 0, this.z);
    // Al dar vueltas por el aceite o el cohete, solo gira el dibujo (no hacia dónde va).
    this.object.rotation.y = this.heading + (this.spinMs / SPIN_MS) * Math.PI * 4;
    this.object.visible = this.blinkMs === 0 || Math.floor(this.blinkMs / 100) % 2 === 0;
    this.flame.visible = this.turboMs > 0;
    if (this.flame.visible) this.flame.scale.setScalar(0.8 + Math.sin(timeMs / 30) * 0.25);
    // El escudo parpadea cuando se le está acabando.
    this.shield.visible = this.shieldMs > 0 && (this.shieldMs > 1500 || Math.floor(this.shieldMs / 120) % 2 === 0);
  }

  destroy() {
    disposeKartModel(this.model);
    this.shield.geometry.dispose();
    this.shield.material.dispose();
  }
}

function approach(value, target, step) {
  return value < target ? Math.min(target, value + step) : Math.max(target, value - step);
}

// Diferencia entre dos ángulos, siempre por el lado más corto (entre -π y π).
export function angleDiff(a, b) {
  return Math.atan2(Math.sin(a - b), Math.cos(a - b));
}
