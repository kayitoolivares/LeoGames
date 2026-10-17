import { buildKartLabel, buildKartModel } from '../three/kartModel.js';

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
// y acelera según qué tanto se empuja. A = turbo, B = freno.
export class Kart {
  constructor({ color, label, deviceId = null }) {
    this.color = color;
    this.label = label;
    this.deviceId = deviceId;
    this.isCpu = deviceId === null;
    const { group, flame } = buildKartModel(color);
    this.object = group;
    this.flame = flame;
    this.object.add(buildKartLabel(label, color));
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
    this.turboMs = 0;
    this.turboCooldownMs = 0;
    this.blinkMs = 0;
    this.trackDistance = 0;
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

  update(dtMs, input, offroad, speedBonus) {
    const dt = dtMs / 1000;
    this.turboMs = Math.max(0, this.turboMs - dtMs);
    this.turboCooldownMs = Math.max(0, this.turboCooldownMs - dtMs);
    this.blinkMs = Math.max(0, this.blinkMs - dtMs);
    if (input.turbo && this.turboReady()) {
      this.turboMs = TURBO_MS;
      this.turboCooldownMs = TURBO_COOLDOWN_MS;
    }

    let target = 0;
    const push = Math.min(1, Math.hypot(input.x, input.y));
    if (push > 0.3) {
      const diff = angleDiff(Math.atan2(input.x, input.y), this.heading);
      const maxTurn = TURN_RATE * dt;
      this.heading += Math.max(-maxTurn, Math.min(maxTurn, diff));
      target = MAX_SPEED * push * speedBonus;
      // Dando vuelta en U se frena un poco.
      if (Math.abs(diff) > 1.6) target *= 0.6;
    }
    if (this.turboMs > 0) target = Math.max(target, MAX_SPEED * TURBO_FACTOR);
    if (offroad) target *= OFFROAD_FACTOR;
    if (input.brake) target = 0;

    const rate = input.brake ? BRAKE : target > this.speed ? ACCEL : COAST;
    this.speed = approach(this.speed, target, rate * dt);
    this.x += Math.sin(this.heading) * this.speed * dt;
    this.z += Math.cos(this.heading) * this.speed * dt;
  }

  render(timeMs) {
    this.object.position.set(this.x, 0, this.z);
    this.object.rotation.y = this.heading;
    this.object.visible = this.blinkMs === 0 || Math.floor(this.blinkMs / 100) % 2 === 0;
    this.flame.visible = this.turboMs > 0;
    if (this.flame.visible) this.flame.scale.setScalar(0.8 + Math.sin(timeMs / 30) * 0.25);
  }
}

function approach(value, target, step) {
  return value < target ? Math.min(target, value + step) : Math.max(target, value - step);
}

// Diferencia entre dos ángulos, siempre por el lado más corto (entre -π y π).
export function angleDiff(a, b) {
  return Math.atan2(Math.sin(a - b), Math.cos(a - b));
}
