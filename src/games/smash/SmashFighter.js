import { Blob } from '../../ui/Blob.js';
import { COLORS, hexToCss, textStyle } from '../../ui/style.js';
import { PLATFORMS, RESPAWN } from './stage.js';

export const STOCKS = 3;
const RADIUS = 34;
const GRAVITY = 1800;
const MAX_FALL = 950;
const RUN_SPEED = 360;
const AIR_SPEED = 320;
const AIR_ACCEL = 1500;
const GROUND_FRICTION = 2600;
const JUMP_SPEED = 780;
const AIR_JUMP_SPEED = 720;
const DROP_MS = 250;
// Al salir volando, el empujón se frena poco a poco (más grande = vuela menos lejos).
const LAUNCH_DRAG = 1.5;
const HITSTUN_PER_SPEED = 0.4;
const RESPAWN_MS = 1500;
const RESPAWN_INVULNERABLE_MS = 2000;

// Golpes según la dirección del stick al apretar X. Tiempos en ms; el empujón crece con el % del que recibe.
// angle: hacia dónde sale volando (grados; 0 = hacia adelante, 90 = arriba, negativo = abajo).
export const ATTACKS = {
  jab: { startup: 60, active: 100, recovery: 160, damage: 7, base: 260, scale: 9, angle: 35, hx: 52, hy: 0, radius: 30 },
  up: { startup: 70, active: 110, recovery: 200, damage: 8, base: 300, scale: 9, angle: 85, hx: 14, hy: -50, radius: 32 },
  sweep: { startup: 80, active: 120, recovery: 220, damage: 6, base: 240, scale: 8, angle: 20, hx: 46, hy: 22, radius: 34 },
  stomp: { startup: 90, active: 120, recovery: 220, damage: 9, base: 200, scale: 7, angle: -70, hx: 8, hy: 46, radius: 32 },
};

// Un peleador estilo Smash: corre, salta dos veces, golpea según la dirección
// y sale volando más lejos mientras más % de daño lleva.
export class SmashFighter {
  constructor(scene, layer, { color, label, deviceId = null }) {
    this.scene = scene;
    this.color = color;
    this.label = label;
    this.deviceId = deviceId;
    this.isCpu = deviceId === null;
    this.radius = RADIUS;
    this.stocks = STOCKS;
    this.damage = 0;

    this.sprite = new Blob(scene, 0, 0, color, RADIUS);
    this.fist = scene.add.circle(0, 0, 12, color).setStrokeStyle(3, COLORS.ink).setVisible(false);
    this.tag = scene.add
      .text(0, -RADIUS - 24, label, textStyle(18, hexToCss(color), { fontStyle: 'bold', stroke: '#1b1530', strokeThickness: 4 }))
      .setOrigin(0.5);
    this.sprite.figure.add([this.fist, this.tag]);
    layer.add(this.sprite);
    this.spawn(RESPAWN.x, RESPAWN.y, 0);
  }

  spawn(x, y, invulnerableMs = RESPAWN_INVULNERABLE_MS) {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.facing = x < 1000 ? 1 : -1;
    this.grounded = false;
    this.platform = null;
    this.airJumps = 1;
    this.attack = null;
    this.hitstunMs = 0;
    this.invulnerableMs = invulnerableMs;
    this.dropMs = 0;
    this.respawnMs = 0;
    this.out = false;
    this.sprite.setVisible(true);
  }

  isAlive() {
    return this.stocks > 0 && !this.out;
  }

  // Se salió de la pantalla: pierde una vida y, si le quedan, reaparece arriba del escenario.
  knockOut() {
    this.stocks -= 1;
    this.out = true;
    this.respawnMs = RESPAWN_MS;
    this.sprite.setVisible(false);
  }

  // input: { x, y (stick), jump (justPressed A), attack (justPressed X) }
  update(dtMs, input) {
    const dt = dtMs / 1000;
    if (this.out) {
      if (this.stocks > 0) {
        this.respawnMs -= dtMs;
        if (this.respawnMs <= 0) {
          this.damage = 0;
          this.spawn(RESPAWN.x, RESPAWN.y);
        }
      }
      return;
    }

    this.invulnerableMs = Math.max(0, this.invulnerableMs - dtMs);
    this.dropMs = Math.max(0, this.dropMs - dtMs);
    this.hitstunMs = Math.max(0, this.hitstunMs - dtMs);
    const canAct = this.hitstunMs === 0;

    if (this.attack) {
      this.attack.elapsed += dtMs;
      const a = ATTACKS[this.attack.type];
      if (this.attack.elapsed >= a.startup + a.active + a.recovery) this.attack = null;
    }

    if (canAct) {
      if (!this.attack && Math.abs(input.x) > 0.2) this.facing = Math.sign(input.x);
      if (this.grounded) {
        this.vx = approach(this.vx, input.x * RUN_SPEED * (this.attack ? 0.3 : 1), GROUND_FRICTION * dt);
      } else {
        this.vx = approach(this.vx, input.x * AIR_SPEED, AIR_ACCEL * dt);
      }

      if (input.jump) {
        if (this.grounded) {
          this.vy = -JUMP_SPEED;
          this.grounded = false;
        } else if (this.airJumps > 0) {
          this.vy = -AIR_JUMP_SPEED;
          this.airJumps -= 1;
        }
      }
      // Bajar de una plataforma delgada: ↓ estando parado en ella.
      if (this.grounded && this.platform?.soft && input.y > 0.6) {
        this.dropMs = DROP_MS;
        this.grounded = false;
        this.y += 4;
      }
      if (input.attack && !this.attack) this.startAttack(input);
    } else {
      // Saliendo volando: el empujón se va frenando.
      this.vx *= Math.exp(-LAUNCH_DRAG * dt);
      if (this.grounded) this.vx = approach(this.vx, 0, GROUND_FRICTION * dt);
    }

    this.vy = Math.min(MAX_FALL, this.vy + GRAVITY * dt);
    const prevFeet = this.y + this.radius;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.collide(prevFeet);
  }

  startAttack(input) {
    let type = 'jab';
    if (input.y < -0.5) type = 'up';
    else if (input.y > 0.5) type = this.grounded ? 'sweep' : 'stomp';
    this.attack = { type, elapsed: 0, hit: new Set() };
  }

  // Las plataformas solo detienen al caer sobre ellas (se atraviesan desde abajo).
  collide(prevFeet) {
    const feet = this.y + this.radius;
    if (this.grounded) {
      const p = this.platform;
      if (this.x < p.left - this.radius * 0.5 || this.x > p.right + this.radius * 0.5) {
        this.grounded = false;
        this.platform = null;
      } else {
        this.y = p.top - this.radius;
        this.vy = 0;
        return;
      }
    }
    if (this.vy < 0) return;
    for (const p of PLATFORMS) {
      if (p.soft && this.dropMs > 0) continue;
      const withinX = this.x >= p.left - this.radius * 0.5 && this.x <= p.right + this.radius * 0.5;
      if (withinX && prevFeet <= p.top + 1 && feet >= p.top) {
        this.y = p.top - this.radius;
        this.vy = 0;
        this.grounded = true;
        this.platform = p;
        this.airJumps = 1;
        return;
      }
    }
  }

  // Zona del golpe mientras está activo (o null).
  hitbox() {
    if (!this.attack || this.out) return null;
    const a = ATTACKS[this.attack.type];
    const t = this.attack.elapsed;
    if (t < a.startup || t >= a.startup + a.active) return null;
    return { x: this.x + a.hx * this.facing, y: this.y + a.hy, radius: a.radius, data: a };
  }

  // Recibe un golpe: sube el % y sale volando, más fuerte entre más daño lleve.
  takeHit(attacker, data) {
    this.damage += data.damage;
    const speed = data.base + this.damage * data.scale;
    const angle = (data.angle * Math.PI) / 180;
    this.vx = Math.cos(angle) * speed * attacker.facing;
    this.vy = -Math.sin(angle) * speed;
    this.hitstunMs = speed * HITSTUN_PER_SPEED;
    this.grounded = false;
    this.platform = null;
    this.attack = null;
    this.sprite.flash();
    this.sprite.squish();
    return speed;
  }

  render() {
    if (this.out) return;
    const s = this.sprite;
    s.setPosition(this.x, this.y);
    s.look(this.facing * 0.9, this.hitstunMs > 0 ? -0.6 : 0);
    // Gira mientras sale volando por un golpe fuerte.
    s.figure.angle = this.hitstunMs > 150 ? s.figure.angle + 25 * this.facing : 0;
    const blinking = this.invulnerableMs > 0 && Math.floor(this.invulnerableMs / 90) % 2 === 1;
    s.setAlpha(blinking ? 0.35 : 1);

    const box = this.hitbox();
    this.fist.setVisible(Boolean(this.attack));
    if (this.attack) {
      const a = ATTACKS[this.attack.type];
      const reach = box ? 1 : 0.55;
      this.fist.setPosition(a.hx * this.facing * reach, a.hy * reach);
    }
  }
}

function approach(value, target, step) {
  return value < target ? Math.min(target, value + step) : Math.max(target, value - step);
}
