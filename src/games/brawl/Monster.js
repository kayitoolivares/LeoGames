import Phaser from 'phaser';
import { Blob } from '../../ui/Blob.js';
import { COLORS, textStyle } from '../../ui/style.js';
import { monsterTexture } from './art.js';
import { ARENA } from './arena.js';

// Los monstruos de los mundos. `art` es su imagen (npm run arte); sin ella se dibuja una bolita enojada.
//   small: los que aumentan con más jugadores.  stagger: los golpes lo aturden (los jefes no).
//   hop: avanza dando saltitos.  summon: llama ayudantes cada tanto.  fireball: lanza bolas de fuego (`look`: cómo se
//   ven: tinta del pulpo, bolas de nieve del yeti, magia del Rey Calabaza).  fly: va volando (sube y baja).
export const MONSTER_TYPES = {
  slime: { name: 'Slime', art: 'slime', radius: 28, hp: 3, speed: 95, color: 0x7bd96b, windupMs: 650, stagger: true, small: true },
  slimeGrande: { name: 'Slime grande', art: 'slime-grande', radius: 44, hp: 7, speed: 75, color: 0x5fc2b8, windupMs: 750, stagger: true },
  reySlime: { name: 'Rey Slime', art: 'rey-slime', radius: 76, hp: 22, speed: 62, color: 0x9a6bff, windupMs: 850, crown: true, boss: true },
  hongo: { name: 'Hongo', art: 'hongo', radius: 30, hp: 3, speed: 105, color: 0xff5a5f, windupMs: 600, stagger: true, small: true, hop: true },
  granHongo: {
    name: 'Gran Hongo',
    art: 'gran-hongo',
    radius: 80,
    hp: 26,
    speed: 55,
    color: 0xb07cff,
    windupMs: 850,
    boss: true,
    summon: { type: 'hongo', firstMs: 2500, everyMs: 6500, count: 2 },
  },
  slimeLava: { name: 'Slime de lava', art: 'slime-lava', radius: 30, hp: 4, speed: 120, color: 0xff7a2f, windupMs: 520, stagger: true, small: true },
  dragonLava: {
    name: 'Dragón de lava',
    art: 'dragon-lava',
    radius: 84,
    hp: 30,
    speed: 58,
    color: 0xc0392b,
    windupMs: 900,
    boss: true,
    fireball: { firstMs: 2000, everyMs: 3800, aimMs: 700 },
  },
  // Playa.
  cangrejo: { name: 'Cangrejo', art: 'cangrejo', radius: 28, hp: 3, speed: 125, color: 0xe53935, windupMs: 560, stagger: true, small: true },
  almeja: { name: 'Almeja', art: 'almeja', radius: 40, hp: 6, speed: 70, color: 0x8158d8, windupMs: 760, stagger: true },
  capitanPulpo: {
    name: 'Capitán Pulpo',
    art: 'capitan-pulpo',
    radius: 84,
    hp: 30,
    speed: 56,
    color: 0xff8a1e,
    windupMs: 880,
    boss: true,
    fireball: { firstMs: 2200, everyMs: 3600, aimMs: 700, look: 'ink' },
  },
  // Montaña nevada.
  munecoNieve: { name: 'Muñeco de nieve', art: 'muneco-nieve', radius: 30, hp: 3, speed: 100, color: 0xf4f8ff, windupMs: 600, stagger: true, small: true, hop: true },
  yetiBebe: { name: 'Yeti bebé', art: 'yeti-bebe', radius: 44, hp: 7, speed: 80, color: 0x9fd8ff, windupMs: 740, stagger: true },
  granYeti: {
    name: 'Gran Yeti',
    art: 'gran-yeti',
    radius: 90,
    hp: 34,
    speed: 52,
    color: 0x6fb8ff,
    windupMs: 900,
    boss: true,
    fireball: { firstMs: 1800, everyMs: 3400, aimMs: 650, look: 'snow' },
  },
  // Castillo embrujado.
  murcielago: { name: 'Murciélago', art: 'murcielago', radius: 26, hp: 2, speed: 150, color: 0x8158d8, windupMs: 500, stagger: true, small: true, fly: true },
  calabaza: { name: 'Calabaza', art: 'calabaza', radius: 36, hp: 5, speed: 90, color: 0xff8a1e, windupMs: 680, stagger: true, hop: true },
  reyCalabaza: {
    name: 'Rey Calabaza',
    art: 'rey-calabaza',
    radius: 88,
    hp: 34,
    speed: 54,
    color: 0xff8a1e,
    windupMs: 880,
    boss: true,
    crown: true,
    summon: { type: 'murcielago', firstMs: 3000, everyMs: 7000, count: 2 },
    fireball: { firstMs: 4500, everyMs: 5200, aimMs: 700, look: 'magic' },
  },
};
// Aventado por un jugador: qué tan rápido sale, cuánto avanza y cuánto daño hace a los que tumba (y a sí mismo).
const THROWN = { speed: 820, ms: 650, damage: 2, height: 40 };

const LUNGE_MS = 220;
const LUNGE_SPEED = 420;
const REST_MS = 700;
const HURT_MS = 320;
const RETARGET_MS = 500;
const HOP_HEIGHT = 18;

// Un monstruo: persigue al jugador más cercano, avisa con "!" y luego se lanza.
// Estados: chase (perseguir) → windup (aviso) → lunge (embestida) → rest (descanso). Un golpe lo manda a hurt.
// Los jefes con fuego tienen además "aim" (apunta con "!" y lanza la bola). Para llamar ayudantes o lanzar
// fuego deja una petición en `request` que atiende la escena.
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
    this.request = null;
    this.summonMs = this.type.summon?.firstMs ?? 0;
    this.fireMs = this.type.fireball?.firstMs ?? 0;
    this.hopMs = Math.random() * 1000;

    this.sprite = new Blob(scene, x, y, this.type.color, this.radius, { angry: true });
    this.image = null;
    const key = monsterTexture(scene, this.type.art);
    if (key) {
      // Con imagen: se esconde la bolita y la imagen se apoya en el piso (mira a la derecha).
      for (const part of this.sprite.figure.list) part.setVisible(false);
      this.image = scene.add.image(0, this.radius, key).setOrigin(0.5, 1);
      this.image.setScale((this.radius * 2.6) / Math.max(this.image.width, this.image.height));
      this.sprite.figure.addAt(this.image, 0);
    } else if (this.type.crown) {
      this.sprite.figure.add(drawCrown(scene, this.radius));
    }
    const top = this.image ? this.radius - this.image.displayHeight : -this.radius;
    this.alert = scene.add
      .text(0, top - 26, '!', textStyle(40, '#ffc93c', { fontStyle: 'bold', stroke: '#1b1530', strokeThickness: 6 }))
      .setOrigin(0.5)
      .setVisible(false);
    this.sprite.add(this.alert);
  }

  setState(state, ms) {
    this.state = state;
    this.stateMs = ms;
    if (state === 'lunge') this.hitDuringLunge.clear();
  }

  update(dtMs, fighters) {
    const dt = dtMs / 1000;
    // Agarrado: no hace nada (lo lleva el jugador). Aventado: sale volando en línea recta.
    if (this.grabbedBy) return;
    if (this.state === 'thrown') {
      this.stateMs -= dtMs;
      this.x += this.thrownDir * THROWN.speed * dt;
      if (this.stateMs <= 0 || this.x < ARENA.left - 60 || this.x > ARENA.right + 60) this.land();
      return;
    }
    this.stateMs -= dtMs;
    this.retargetMs -= dtMs;
    this.hopMs += dtMs;
    this.x += this.knockback * dt;
    const next = this.knockback * Math.pow(0.002, dt);
    this.knockback = Math.abs(next) < 5 ? 0 : next;

    if (this.retargetMs <= 0 || !this.target || this.target.down) {
      this.target = nearest(this, fighters.filter((f) => !f.down));
      this.retargetMs = RETARGET_MS;
    }
    this.updatePowers(dtMs);

    if (this.state === 'chase') this.chase(dt);
    else if (this.state === 'windup' && this.stateMs <= 0) this.setState('lunge', LUNGE_MS);
    else if (this.state === 'aim' && this.stateMs <= 0) {
      this.request = { kind: 'fireball', x: this.x + this.facing * this.radius, y: this.y, dir: this.facing, look: this.type.fireball.look ?? 'fire' };
      this.setState('rest', REST_MS);
    } else if (this.state === 'lunge') {
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

  // Poderes de los jefes: llamar ayudantes y apuntar una bola de fuego. El reloj corre siempre, pero el
  // poder sale solo cuando no está atacando (si no, con todos pegándole nunca lo usaría).
  updatePowers(dtMs) {
    if (!this.entered) return;
    const ready = this.state === 'chase' || this.state === 'rest';
    if (this.type.summon) {
      this.summonMs -= dtMs;
      if (this.summonMs <= 0 && ready) {
        this.summonMs = this.type.summon.everyMs;
        this.request = { kind: 'summon', type: this.type.summon.type, count: this.type.summon.count };
      }
    }
    if (this.type.fireball && this.target) {
      this.fireMs -= dtMs;
      if (this.fireMs <= 0 && ready) {
        this.fireMs = this.type.fireball.everyMs;
        this.facing = this.target.x > this.x ? 1 : -1;
        // Se pone a la altura del jugador antes de lanzar, para que la bola vaya por su carril.
        this.y = this.target.y;
        this.setState('aim', this.type.fireball.aimMs);
      }
    }
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

  // Lo agarró un jugador (los jefes no se dejan).
  canBeGrabbed() {
    return !this.type.boss && !this.dead && !this.grabbedBy && this.state !== 'thrown' && this.entered;
  }

  grab(fighter) {
    this.grabbedBy = fighter;
    this.setState('hurt', 0);
    this.knockback = 0;
  }

  // Lo avientan hacia `dir`: tumba como boliche a los que encuentre en su carril (lo revisa la escena).
  throwTo(dir) {
    this.grabbedBy = null;
    this.thrownDir = dir;
    this.facing = dir;
    this.setState('thrown', THROWN.ms);
    this.bowled = new Set();
  }

  land() {
    this.setState('hurt', 400);
    this.hurt(this.x - this.thrownDir, THROWN.damage);
  }

  touches(fighter) {
    return Math.abs(fighter.x - this.x) < this.radius + fighter.radius && Math.abs(fighter.y - this.y) < 28 + this.radius * 0.3;
  }

  // `damage`: cuánto le quita; `power`: el empujón (más grande con los remates y los especiales).
  hurt(fromX, damage = 1, power = 1) {
    if (this.dead) return;
    this.hp -= damage;
    const dir = Math.sign(this.x - fromX) || 1;
    this.knockback = dir * (this.type.stagger ? 320 : 120) * power;
    this.sprite.flash();
    if (this.image) {
      this.image.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
      this.scene.time.delayedCall(70, () => {
        if (this.image.active) this.image.setTintMode(Phaser.TintModes.MULTIPLY).clearTint();
      });
    }
    if (this.type.stagger && this.state !== 'thrown') this.setState('hurt', HURT_MS);
    if (this.hp <= 0) this.dead = true;
  }

  render() {
    const warning = this.state === 'windup' || this.state === 'aim';
    const shake = warning ? (Math.random() - 0.5) * 6 : 0;
    this.sprite.setPosition(this.x + shake, this.y).setDepth(this.y);
    this.sprite.look(this.facing * 0.9, 0.2);
    this.alert.setVisible(warning);
    this.image?.setFlipX(this.facing < 0);
    // Los hongos avanzan dando saltitos; los murciélagos van volando; aventado, gira en el aire.
    let lift = 0;
    if (this.type.hop && this.state === 'chase') lift = Math.abs(Math.sin(this.hopMs / 180)) * HOP_HEIGHT;
    if (this.type.fly) lift = 40 + Math.sin(this.hopMs / 160) * 10;
    if (this.grabbedBy) lift = this.grabbedBy.z + 46;
    if (this.state === 'thrown') lift = THROWN.height;
    this.sprite.figure.y = -lift;
    this.sprite.figure.angle = this.state === 'thrown' ? (this.sprite.figure.angle + 25 * this.thrownDir) % 360 : this.grabbedBy ? 180 : 0;
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
