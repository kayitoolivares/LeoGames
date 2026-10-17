import { Blob } from '../../ui/Blob.js';
import { COLORS, textStyle } from '../../ui/style.js';
import { ARENA } from './arena.js';

export const MONSTER_TYPES = {
  small: { radius: 28, hp: 3, speed: 95, color: 0x7bd96b, windupMs: 650, stagger: true },
  big: { radius: 44, hp: 7, speed: 75, color: 0x5fc2b8, windupMs: 750, stagger: true },
  // El jefe no se aturde con los golpes: hay que esquivarlo.
  boss: { radius: 76, hp: 22, speed: 62, color: 0x9a6bff, windupMs: 850, stagger: false, crown: true },
};

const LUNGE_MS = 220;
const LUNGE_SPEED = 420;
const REST_MS = 700;
const HURT_MS = 320;
const RETARGET_MS = 500;

// Un monstruo: persigue al jugador más cercano, avisa con "!" y luego se lanza.
// Estados: chase (perseguir) → windup (aviso) → lunge (embestida) → rest (descanso). Un golpe lo manda a hurt.
export class Monster {
  constructor(scene, typeKey, x, y) {
    this.scene = scene;
    this.typeKey = typeKey;
    this.type = MONSTER_TYPES[typeKey];
    this.radius = this.type.radius;
    this.x = x;
    this.y = y;
    this.hp = this.type.hp;
    this.maxHp = this.type.hp;
    this.facing = x < ARENA.left ? 1 : -1;
    this.state = 'chase';
    this.stateMs = 0;
    this.knockback = 0;
    this.target = null;
    this.retargetMs = 0;
    this.entered = false;
    this.dead = false;
    this.hitDuringLunge = new Set();

    this.sprite = new Blob(scene, x, y, this.type.color, this.radius, { angry: true });
    this.alert = scene.add
      .text(0, -this.radius - 30, '!', textStyle(40, '#ffc93c', { fontStyle: 'bold', stroke: '#1b1530', strokeThickness: 6 }))
      .setOrigin(0.5)
      .setVisible(false);
    this.sprite.figure.add(this.alert);
    if (this.type.crown) this.sprite.figure.add(drawCrown(scene, this.radius));
  }

  setState(state, ms) {
    this.state = state;
    this.stateMs = ms;
    if (state === 'lunge') this.hitDuringLunge.clear();
  }

  update(dtMs, fighters) {
    const dt = dtMs / 1000;
    this.stateMs -= dtMs;
    this.retargetMs -= dtMs;
    this.x += this.knockback * dt;
    const next = this.knockback * Math.pow(0.002, dt);
    this.knockback = Math.abs(next) < 5 ? 0 : next;

    if (this.retargetMs <= 0 || !this.target || this.target.down) {
      this.target = nearest(this, fighters.filter((f) => !f.down));
      this.retargetMs = RETARGET_MS;
    }

    if (this.state === 'chase') this.chase(dt);
    else if (this.state === 'windup' && this.stateMs <= 0) this.setState('lunge', LUNGE_MS);
    else if (this.state === 'lunge') {
      this.x += this.facing * LUNGE_SPEED * dt;
      if (this.stateMs <= 0) this.setState('rest', REST_MS);
    } else if ((this.state === 'rest' || this.state === 'hurt') && this.stateMs <= 0) this.setState('chase', 0);

    // Entran caminando desde fuera de la pantalla; ya adentro, no se salen.
    const minX = ARENA.left + this.radius * 0.5;
    const maxX = ARENA.right - this.radius * 0.5;
    if (!this.entered && this.x > minX && this.x < maxX) this.entered = true;
    if (this.entered) this.x = Math.min(maxX, Math.max(minX, this.x));
    this.y = Math.min(ARENA.bottom, Math.max(ARENA.top, this.y));
  }

  chase(dt) {
    const t = this.target;
    if (!t) return;
    // Se acomoda a un lado del jugador, a la misma altura, como en los juegos de pelea clásicos.
    const side = this.x < t.x ? -1 : 1;
    const dx = t.x + side * (t.radius + this.radius + 6) - this.x;
    const dy = t.y - this.y;
    const dist = Math.hypot(dx, dy);
    this.facing = t.x > this.x ? 1 : -1;
    if (dist < 12) {
      this.setState('windup', this.type.windupMs);
      return;
    }
    const step = Math.min(dist, this.type.speed * dt);
    this.x += (dx / dist) * step;
    this.y += (dy / dist) * step * 0.8;
  }

  touches(fighter) {
    return Math.abs(fighter.x - this.x) < this.radius + fighter.radius && Math.abs(fighter.y - this.y) < 28 + this.radius * 0.3;
  }

  hurt(fromX) {
    if (this.dead) return;
    this.hp -= 1;
    const dir = Math.sign(this.x - fromX) || 1;
    this.knockback = dir * (this.type.stagger ? 320 : 120);
    this.sprite.flash();
    if (this.type.stagger) this.setState('hurt', HURT_MS);
    if (this.hp <= 0) this.dead = true;
  }

  render() {
    const shake = this.state === 'windup' ? (Math.random() - 0.5) * 6 : 0;
    this.sprite.setPosition(this.x + shake, this.y).setDepth(this.y);
    this.sprite.look(this.facing * 0.9, 0.2);
    this.alert.setVisible(this.state === 'windup');
  }

  destroy() {
    this.sprite.destroy();
  }
}

function nearest(from, list) {
  let best = null;
  let bestDist = Infinity;
  for (const item of list) {
    const dist = Math.hypot(item.x - from.x, item.y - from.y);
    if (dist < bestDist) {
      best = item;
      bestDist = dist;
    }
  }
  return best;
}

function drawCrown(scene, radius) {
  const crown = scene.add.graphics();
  const width = radius * 0.9;
  const base = -radius * 0.82;
  const height = radius * 0.4;
  crown.fillStyle(COLORS.accent, 1);
  crown.fillRect(-width / 2, base - radius * 0.06, width, radius * 0.16);
  for (let k = 0; k < 3; k += 1) {
    const x0 = -width / 2 + (k * width) / 3;
    crown.fillTriangle(x0, base, x0 + width / 6, base - height, x0 + width / 3, base);
  }
  return crown;
}
