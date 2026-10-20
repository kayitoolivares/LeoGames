import * as THREE from 'three';
import { buildKartLabel, buildKartModel } from '../three/kartModel.js';
import { decalTexture, kartStats } from './karts.js';

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
// Derrape: con LB apretado en una curva se desliza de lado y junta chispas (azules, naranjas y moradas);
// al soltarlo da un turbito más largo entre más chispas juntó.
const DRIFT_MIN_SPEED = 16;
const DRIFT_TURN = { min: 0.55, max: 1.25 };
const DRIFT_YAW = 0.38;
const DRIFT_LEVEL_MS = [700, 1500, 2400];
const MINI_TURBOS = [null, { factor: 1.2, ms: 600 }, { factor: 1.3, ms: 900 }, { factor: 1.4, ms: 1300 }];
export const SPARK_COLORS = [null, 0x5ab8ff, 0xff9a3c, 0xd36bff];
// En el aire (al saltar una rampa): gravedad y qué tanto se puede girar. Con LB en el aire hace un truco
// (una vuelta de lado) y al caer le da un turbito.
const GRAVITY = 28;
const AIR_STEER = 0.4;
const TRICK_BOOST = { factor: 1.3, ms: 800 };
const TRICK_SPIN_MS = 420;
// El rayo encoge: más chiquito y más lento un rato. La tinta mancha la pantalla.
export const SHRINK_MS = 6000;
const SHRINK_SCALE = 0.55;
const SHRINK_SPEED = 0.72;
export const INK_MS = 4500;
// Cada moneda da un poquito más de velocidad; un golpe tira 3.
const COIN_BOOST = 0.01;
const COINS_LOST = 3;

const shieldGeometry = new THREE.SphereGeometry(2.7, 16, 12);
let sparkTexture = null;

// Bolita de luz difuminada para las chispas del derrape.
function sparkMap() {
  if (sparkTexture) return sparkTexture;
  const canvas = document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 32;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.4, 'rgba(255,255,255,0.8)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 32, 32);
  sparkTexture = new THREE.CanvasTexture(canvas);
  return sparkTexture;
}

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
    const decal = decalTexture(setup.decal, setup.number ?? (Number(label.slice(1)) || 1));
    const { group, flame, seat } = buildKartModel(setup.color, { type: setup.type, wheels: setup.wheels, extra: setup.extra, decal, driver: true });
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
    // Chispas del derrape, en las llantas de atrás.
    this.sparks = [-1, 1].map((side) => {
      const sprite = new THREE.Sprite(
        new THREE.SpriteMaterial({ map: sparkMap(), color: 0xffffff, blending: THREE.AdditiveBlending, depthWrite: false }),
      );
      sprite.position.set(side * 1.15, 0.45, -1.4);
      this.object.add(sprite);
      return sprite;
    });
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
    this.itemUses = 0;
    this.pendingItem = null;
    this.rollMs = 0;
    this.shrinkMs = 0;
    this.inkMs = 0;
    this.size = 1;
    this.coins = 0;
    // Cuándo apretó acelerar durante la cuenta regresiva (para el arranque turbo).
    this.startPress = null;
    this.nitro = NITRO_CHARGES;
    this.nitroRefillMs = 0;
    this.boostMs = 0;
    this.boostFactor = 1;
    this.spinMs = 0;
    this.shieldMs = 0;
    this.wrongWayMs = 0;
    this.messageMs = 0;
    this.message = '';
    this.y = 0;
    this.vy = 0;
    this.floor = 0;
    this.onPad = false;
    this.drifting = false;
    this.driftDir = 0;
    this.driftMs = 0;
    this.visualYaw = 0;
    this.trick = false;
    this.trickAt = 0;
    // Lo que pasó este cuadro (mini turbo, truco...), para que el juego ponga sonidos y letreros.
    this.events = [];
  }

  get airborne() {
    return this.y > this.floor + 0.05 || this.vy > 0;
  }

  // Nivel de las chispas del derrape: 0 (todavía nada) a 3 (moradas).
  get driftLevel() {
    return DRIFT_LEVEL_MS.filter((ms) => this.driftMs >= ms).length;
  }

  // Sale volando de una rampa con esa velocidad hacia arriba.
  launch(vy) {
    if (this.drifting) this.endDrift(false);
    this.vy = vy;
    this.trick = false;
    this.events.push('jump');
  }

  // Termina el derrape: si juntó chispas (y no fue por un golpe), turbito.
  endDrift(cancelled) {
    const level = this.driftLevel;
    this.drifting = false;
    this.driftMs = 0;
    if (cancelled || level === 0) return;
    this.boost(MINI_TURBOS[level].factor, MINI_TURBOS[level].ms);
    this.events.push(`turbo${level}`);
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
    this.coins = Math.max(0, this.coins - COINS_LOST);
    if (this.drifting) this.endDrift(true);
    return true;
  }

  // input: { steer: -1..1, gas: 0..1, brake: 0..1, nitro: bool, drift: LB apretado, trick: LB recién apretado }.
  // `topFactor` ayuda a los que van atrás.
  update(dtMs, input, offroad, topFactor = 1) {
    const dt = dtMs / 1000;
    this.boostMs = Math.max(0, this.boostMs - dtMs);
    this.spinMs = Math.max(0, this.spinMs - dtMs);
    this.shieldMs = Math.max(0, this.shieldMs - dtMs);
    this.messageMs = Math.max(0, this.messageMs - dtMs);
    this.shrinkMs = Math.max(0, this.shrinkMs - dtMs);
    this.inkMs = Math.max(0, this.inkMs - dtMs);
    if (this.rollMs > 0) {
      this.rollMs = Math.max(0, this.rollMs - dtMs);
      if (this.rollMs === 0) {
        this.item = this.pendingItem;
        this.itemUses = this.pendingUses;
        this.events.push('item');
      }
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
    const coins = 1 + COIN_BOOST * this.coins;
    const top = maxSpeed * topFactor * coins * (this.boostMs > 0 ? this.boostFactor : 1) * (offroad ? this.stats.offroad : 1) * (this.shrinkMs > 0 ? SHRINK_SPEED : 1);
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

    const air = this.airborne;
    if (!this.drifting && input.drift && !air && !spinning && Math.abs(steer) > 0.3 && this.speed > DRIFT_MIN_SPEED) {
      this.drifting = true;
      this.driftDir = Math.sign(steer);
      this.driftMs = 0;
    }
    if (this.drifting && (!input.drift || spinning || this.speed < DRIFT_MIN_SPEED * 0.6)) this.endDrift(spinning);
    // Derrapando siempre gira hacia el lado del derrape: con el stick hacia ese lado, más cerrado; hacia el otro, más abierto.
    let turning = steer;
    if (this.drifting) {
      const before = this.driftLevel;
      this.driftMs += dtMs;
      if (this.driftLevel > before) this.events.push(`spark${this.driftLevel}`);
      const lean = (steer * this.driftDir + 1) / 2;
      turning = this.driftDir * (DRIFT_TURN.min + (DRIFT_TURN.max - DRIFT_TURN.min) * lean);
    }

    // Parado no gira; en reversa el volante se invierte, como un carro de verdad. En el aire casi no gira.
    const grip = Math.min(1, Math.abs(this.speed) / 10) * (this.speed < 0 ? -1 : 1) * (air ? AIR_STEER : 1);
    this.heading -= turning * turn * grip * dt;
    this.x += Math.sin(this.heading) * this.speed * dt;
    this.z += Math.cos(this.heading) * this.speed * dt;

    // Altura: arriba de una rampa sigue el piso; en el aire cae. Un truco en el aire da turbito al caer.
    if (air) {
      if (input.trick && !this.trick) {
        this.trick = true;
        this.trickAt = performance.now();
        this.events.push('trick');
      }
      this.vy -= GRAVITY * dt;
      this.y += this.vy * dt;
      if (this.y <= this.floor) {
        this.y = this.floor;
        this.vy = 0;
        if (this.trick) this.boost(TRICK_BOOST.factor, TRICK_BOOST.ms);
        this.trick = false;
        this.events.push('land');
      }
    } else {
      this.y = this.floor;
    }
  }

  // Lo encogió un rayo (la burbuja lo protege). Devuelve true si sí lo encogió.
  shrink() {
    if (this.shieldMs > 0) {
      this.shieldMs = 0;
      return false;
    }
    this.shrinkMs = SHRINK_MS;
    this.speed *= 0.6;
    if (this.drifting) this.endDrift(true);
    return true;
  }

  render(timeMs) {
    const spin = this.spinMs > 0 ? (1 - this.spinMs / SPIN_MS) * Math.PI * 4 : 0;
    this.object.position.set(this.x, this.y, this.z);
    // Encogido por el rayo: se hace chiquito poco a poco (y vuelve a crecer igual).
    this.size += ((this.shrinkMs > 0 ? SHRINK_SCALE : 1) - this.size) * 0.15;
    this.object.scale.setScalar(this.size);
    // Derrapando, la trompa apunta más hacia adentro de la curva (se ve de lado).
    this.visualYaw += ((this.drifting ? -this.driftDir * DRIFT_YAW : 0) - this.visualYaw) * 0.2;
    this.object.rotation.y = this.heading + spin + this.visualYaw;
    // El truco: una vuelta de lado.
    this.object.rotation.z = this.trick ? Math.min(1, (timeMs - this.trickAt) / TRICK_SPIN_MS) * Math.PI * 2 : 0;
    const level = this.drifting ? this.driftLevel : 0;
    for (const spark of this.sparks) {
      spark.visible = level > 0;
      if (!spark.visible) continue;
      spark.material.color.setHex(SPARK_COLORS[level]);
      spark.scale.setScalar((0.7 + level * 0.25) * (0.75 + Math.random() * 0.5));
    }
    this.flame.visible = this.boostMs > 0;
    if (this.flame.visible) this.flame.scale.setScalar(0.8 + Math.sin(timeMs / 30) * 0.25);
    // La burbuja parpadea cuando está por acabarse.
    this.shield.visible = this.shieldMs > 0 && (this.shieldMs > 1500 || Math.floor(this.shieldMs / 120) % 2 === 0);
  }
}

function approach(value, target, step) {
  return value < target ? Math.min(target, value + step) : Math.max(target, value - step);
}
