import Phaser from 'phaser';
import { Blob } from '../../ui/Blob.js';
import { COLORS, textStyle } from '../../ui/style.js';
import { brawlCreature, monsterTexture } from './art.js';
import { ARENA } from './arena.js';

// Los monstruos de los mundos. `art` es su imagen (npm run arte); sin ella se dibuja una bolita enojada.
//   small: los que aumentan con más jugadores.  stagger: los golpes lo aturden (los jefes no).
//   hop: avanza dando saltitos.  summon: llama ayudantes cada tanto.  fireball: lanza bolas de fuego (`look`: cómo se
//   ven: tinta del pulpo, bolas de nieve del yeti, magia del Rey Calabaza, betún del Rey Pastel, láser del Mega
//   Robot).  fly: va volando (sube y baja).  coins: cuántas monedas suelta (si no, 1 los chicos y 2 los demás).
// Los jefes se enojan a la mitad de su vida: van más rápido y usan sus poderes más seguido.
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
  // Dulcelandia.
  gomita: { name: 'Gomita', art: 'gomita', radius: 28, hp: 3, speed: 110, color: 0xe53935, windupMs: 580, stagger: true, small: true, hop: true },
  cupcake: { name: 'Cupcake', art: 'cupcake', radius: 42, hp: 7, speed: 75, color: 0xff9ec7, windupMs: 740, stagger: true },
  caramelo: { name: 'Caramelo', art: 'caramelo', radius: 26, hp: 2, speed: 140, color: 0xb07cff, windupMs: 520, stagger: true, small: true, fly: true },
  reyPastel: {
    name: 'Rey Pastel',
    art: 'rey-pastel',
    radius: 90,
    hp: 36,
    speed: 52,
    color: 0xff7ad9,
    windupMs: 880,
    boss: true,
    crown: true,
    summon: { type: 'gomita', firstMs: 3000, everyMs: 7000, count: 2 },
    fireball: { firstMs: 2000, everyMs: 3800, aimMs: 700, look: 'frosting' },
  },
  // Espacio.
  marcianito: { name: 'Marcianito', art: 'marcianito', radius: 28, hp: 3, speed: 115, color: 0x3fe0d0, windupMs: 560, stagger: true, small: true },
  ovni: { name: 'Ovni', art: 'ovni', radius: 30, hp: 3, speed: 130, color: 0x9aa8b8, windupMs: 540, stagger: true, small: true, fly: true },
  robotito: { name: 'Robotito', art: 'robotito', radius: 42, hp: 8, speed: 70, color: 0xc0c4d0, windupMs: 760, stagger: true },
  megaRobot: {
    name: 'Mega Robot',
    art: 'mega-robot',
    radius: 92,
    hp: 40,
    speed: 50,
    color: 0xe53935,
    windupMs: 880,
    boss: true,
    summon: { type: 'robotito', firstMs: 4000, everyMs: 8000, count: 1 },
    fireball: { firstMs: 1800, everyMs: 3400, aimMs: 650, look: 'laser' },
  },
  // Valle de los dinos.
  raptor: { name: 'Raptorcito', art: 'raptor', radius: 28, hp: 3, speed: 135, color: 0x8be04c, windupMs: 520, stagger: true, small: true },
  ptero: { name: 'Pterodáctilo', art: 'ptero', radius: 28, hp: 2, speed: 145, color: 0xff9a3c, windupMs: 520, stagger: true, small: true, fly: true },
  trici: { name: 'Triceratops', art: 'trici', radius: 44, hp: 8, speed: 78, color: 0x7fb8ff, windupMs: 700, stagger: true },
  reyRex: {
    name: 'Rey Rex',
    art: 'rey-rex',
    radius: 94,
    hp: 40,
    speed: 54,
    color: 0xe53935,
    windupMs: 880,
    boss: true,
    crown: true,
    summon: { type: 'raptor', firstMs: 3000, everyMs: 7000, count: 2 },
    fireball: { firstMs: 2200, everyMs: 3800, aimMs: 700, look: 'rock' },
  },
  // Fondo del mar. (El pez globo se infla cuando le pegan.)
  pececito: { name: 'Pececito', art: 'pececito', radius: 26, hp: 2, speed: 150, color: 0xffa94d, windupMs: 500, stagger: true, small: true, fly: true },
  medusa: { name: 'Medusa', art: 'medusa', radius: 28, hp: 3, speed: 85, color: 0xff9ee8, windupMs: 620, stagger: true, small: true, fly: true },
  pezGlobo: { name: 'Pez globo', art: 'pez-globo', radius: 42, hp: 7, speed: 70, color: 0xffd84d, windupMs: 740, stagger: true, puff: true },
  // El Rey Tiburón embiste: se pone en el carril de alguien, una franja roja avisa y cruza toda la pantalla.
  reyTiburon: {
    name: 'Rey Tiburón',
    art: 'rey-tiburon',
    radius: 92,
    hp: 38,
    speed: 58,
    color: 0x6f8fb8,
    windupMs: 860,
    boss: true,
    crown: true,
    summon: { type: 'pececito', firstMs: 4500, everyMs: 8000, count: 2 },
    charge: { firstMs: 2500, everyMs: 5200, aimMs: 1000, speed: 900 },
  },
  // Selva. (Los monitos avientan plátanos desde lejos.)
  mono: {
    name: 'Monito',
    art: 'mono',
    radius: 28,
    hp: 3,
    speed: 120,
    color: 0xa0673a,
    windupMs: 560,
    stagger: true,
    small: true,
    hop: true,
    fireball: { firstMs: 3000, everyMs: 6500, aimMs: 650, look: 'banana' },
  },
  serpiente: { name: 'Serpiente', art: 'serpiente', radius: 26, hp: 2, speed: 160, color: 0x4cd97b, windupMs: 480, stagger: true, small: true },
  loro: { name: 'Loro', art: 'loro', radius: 26, hp: 2, speed: 145, color: 0xff5a5f, windupMs: 520, stagger: true, small: true, fly: true },
  gorilita: { name: 'Gorilita', art: 'gorilita', radius: 44, hp: 8, speed: 78, color: 0x6a6a7e, windupMs: 720, stagger: true },
  // El Gran Gorila brinca y al caer hace temblar el piso: una onda sale de él y hay que saltarla.
  granGorila: {
    name: 'Gran Gorila',
    art: 'gran-gorila',
    radius: 96,
    hp: 42,
    speed: 54,
    color: 0x4a4a5e,
    windupMs: 880,
    boss: true,
    summon: { type: 'mono', firstMs: 3500, everyMs: 7500, count: 2 },
    quake: { firstMs: 3000, everyMs: 5600, aimMs: 900, radius: 420 },
  },
};
// Mini jefe (a la mitad de cada mundo): un monstruo de ese mundo más grande y con mucha más vida, con su barra.
export const MINI_BOSS = { hp: 3, size: 1.4 };
// Enojado: qué tanto más rápido va y qué tanto más seguido usa sus poderes.
const ANGRY = { speed: 1.3, powers: 0.6 };
// Aventado por un jugador: qué tan rápido sale, cuánto avanza y cuánto daño hace a los que tumba (y a sí mismo).
const THROWN = { speed: 820, ms: 650, damage: 2, height: 40 };

const LUNGE_MS = 220;
const LUNGE_SPEED = 420;
const REST_MS = 700;
const HURT_MS = 320;
const RETARGET_MS = 500;
const HOP_HEIGHT = 18;
// El salto del Gran Gorila (qué tan alto) y cuánto se infla el pez globo.
const QUAKE_JUMP = 150;
const PUFF = { ms: 1000, scale: 1.4 };

// Un monstruo: persigue al jugador más cercano, avisa con "!" y luego se lanza.
// Estados: chase (perseguir) → windup (aviso) → lunge (embestida) → rest (descanso). Un golpe lo manda a hurt.
// Los jefes con fuego tienen además "aim" (apunta con "!" y lanza la bola); el que embiste, "aimCharge" (avisa) y
// "charge" (cruza la pantalla); y el que brinca, "quakeJump" (al caer, la onda). Para llamar ayudantes, lanzar
// fuego, avisar la embestida o hacer temblar el piso deja una petición en `request` que atiende la escena.
export class Monster {
  // `mini`: es el mini jefe del mundo (más grande, con más vida, no se deja agarrar).
  constructor(scene, typeKey, x, y, { mini = false } = {}) {
    this.scene = scene;
    this.typeKey = typeKey;
    this.type = MONSTER_TYPES[typeKey];
    this.mini = mini;
    this.name = mini ? `Mini jefe: ${this.type.name}` : this.type.name;
    this.radius = Math.round(this.type.radius * (mini ? MINI_BOSS.size : 1));
    this.x = x;
    this.y = y;
    this.hp = this.type.hp * (mini ? MINI_BOSS.hp : 1);
    this.maxHp = this.hp;
    this.angry = false;
    this.slowMs = 0;
    this.facing = x < ARENA.left ? 1 : -1;
    this.state = 'chase';
    this.stateMs = 0;
    this.knockback = 0;
    this.target = null;
    this.retargetMs = 0;
    // (En Defiende el nido, más de la mitad de los chicos va por los huevos; en Defiende la base, por la base.)
    this.raidsNest = Boolean(scene.nest) && !this.type.boss && !mini && Math.random() < (scene.nest?.raidChance ?? 0.6);
    this.entered = false;
    this.dead = false;
    this.hitDuringLunge = new Set();
    this.request = null;
    this.summonMs = this.type.summon?.firstMs ?? 0;
    this.fireMs = this.type.fireball?.firstMs ?? 0;
    this.chargeMs = this.type.charge?.firstMs ?? 0;
    this.quakeMs = this.type.quake?.firstMs ?? 0;
    this.puffMs = 0;
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
      // Camina, se agacha antes de lanzarse, ataca, le duele, se burla y (los jefes) se enoja y se marea.
      // (Los que dan saltitos ya rebotan solos; los demás caminan balanceándose y los que vuelan aletean.)
      this.creature = brawlCreature(scene, this.image, this.type.art, this.radius * 2.6, this.type.fly ? 'fly' : this.type.hop ? null : 'walk');
    } else {
      // Sin dibujo: la bolita enojada con lo que distingue a cada monstruo nuevo (aleta, tentáculos, orejas...).
      const extra = drawFeatures(scene, typeKey, this.radius, this.type.color);
      if (extra) this.sprite.figure.addAt(extra.back, 0).add(extra.front);
      this.features = extra;
      if (this.type.crown) this.sprite.figure.add(drawCrown(scene, this.radius));
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
    this.stateTotalMs = ms;
    if (state === 'lunge' || state === 'charge') this.hitDuringLunge.clear();
  }

  // Embistiendo o lanzándose: le pega a quien toque (lo revisa la escena).
  get charging() {
    return this.state === 'lunge' || this.state === 'charge';
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
    this.dizzyMs = Math.max(0, (this.dizzyMs ?? 0) - dtMs);
    this.slowMs = Math.max(0, this.slowMs - dtMs);
    this.puffMs = Math.max(0, this.puffMs - dtMs);
    // El jefe se enoja a la mitad de su vida (la escena pone el letrero).
    if (this.type.boss && !this.angry && this.hp <= this.maxHp / 2 && !this.dead) {
      this.angry = true;
      this.request = { kind: 'angry' };
    }
    this.x += this.knockback * dt;
    const next = this.knockback * Math.pow(0.002, dt);
    this.knockback = Math.abs(next) < 5 ? 0 : next;

    if (this.retargetMs <= 0 || !this.target || this.target.down) {
      // Defiende el nido: los que van por los huevos no les hacen caso a los jugadores.
      const nest = this.scene.nest;
      this.target = nest && !nest.down && this.raidsNest ? nest : nearest(this, fighters.filter((f) => !f.down));
      this.retargetMs = RETARGET_MS;
    }
    this.updatePowers(dtMs);

    if (this.state === 'chase') this.chase(dt);
    else if (this.state === 'windup' && this.stateMs <= 0) this.setState('lunge', LUNGE_MS);
    else if (this.state === 'aim' && this.stateMs <= 0) {
      this.request = { kind: 'fireball', x: this.x + this.facing * this.radius, y: this.y, dir: this.facing, look: this.type.fireball.look ?? 'fire', owner: this };
      this.setState('rest', REST_MS);
    } else if (this.state === 'lunge') {
      this.x += this.facing * LUNGE_SPEED * dt;
      if (this.stateMs <= 0) this.setState('rest', REST_MS);
    } else if (this.state === 'aimCharge' && this.stateMs <= 0) {
      this.setState('charge', Infinity);
    } else if (this.state === 'quakeJump' && this.stateMs <= 0) {
      this.request = { kind: 'quake', x: this.x, y: this.y, radius: this.type.quake.radius, owner: this };
      this.setState('rest', REST_MS * 1.5);
    } else if ((this.state === 'rest' || this.state === 'hurt') && this.stateMs <= 0) this.setState('chase', 0);

    // Entran caminando desde fuera de la pantalla; ya adentro, no se salen.
    const minX = ARENA.left + this.radius * 0.5;
    const maxX = ARENA.right - this.radius * 0.5;
    // La embestida cruza hasta la otra orilla.
    if (this.state === 'charge') {
      this.x += this.facing * this.type.charge.speed * dt;
      if ((this.facing > 0 && this.x >= maxX) || (this.facing < 0 && this.x <= minX)) this.setState('rest', REST_MS * 1.5);
    }
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
        this.summonMs = this.type.summon.everyMs * (this.angry ? ANGRY.powers : 1);
        this.request = { kind: 'summon', type: this.type.summon.type, count: this.type.summon.count };
      }
    }
    if (this.type.fireball && this.target) {
      this.fireMs -= dtMs;
      if (this.fireMs <= 0 && ready) {
        this.fireMs = this.type.fireball.everyMs * (this.angry ? ANGRY.powers : 1);
        this.facing = this.target.x > this.x ? 1 : -1;
        // Se pone a la altura del jugador antes de lanzar, para que la bola vaya por su carril.
        this.y = this.target.y;
        this.setState('aim', this.type.fireball.aimMs);
        return;
      }
    }
    // Embestida: se pone en el carril de alguien y avisa (la escena pinta la franja); luego cruza la pantalla.
    if (this.type.charge && this.target) {
      this.chargeMs -= dtMs;
      if (this.chargeMs <= 0 && this.state === 'chase' && !this.request) {
        this.chargeMs = this.type.charge.everyMs * (this.angry ? ANGRY.powers : 1);
        this.facing = this.target.x > this.x ? 1 : -1;
        this.y = this.target.y;
        this.setState('aimCharge', this.type.charge.aimMs);
        this.request = { kind: 'chargeWarn', y: this.y, dir: this.facing, ms: this.type.charge.aimMs, owner: this };
        return;
      }
    }
    // Brinco con temblor: salta en su lugar y al caer sale la onda.
    if (this.type.quake) {
      this.quakeMs -= dtMs;
      if (this.quakeMs <= 0 && this.state === 'chase' && !this.request) {
        this.quakeMs = this.type.quake.everyMs * (this.angry ? ANGRY.powers : 1);
        this.setState('quakeJump', this.type.quake.aimMs);
        this.request = { kind: 'quakeWarn', x: this.x, y: this.y, owner: this };
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
    // Enojado va más rápido; en el chicle, más lento.
    const speed = this.type.speed * (this.angry ? ANGRY.speed : 1) * (this.slowMs > 0 ? 0.5 : 1);
    const step = Math.min(dist, speed * dt);
    this.x += (dx / dist) * step;
    this.y += (dy / dist) * step * 0.8;
  }

  // Lo agarró un jugador (los jefes no se dejan).
  canBeGrabbed() {
    return !this.type.boss && !this.mini && !this.dead && !this.grabbedBy && this.state !== 'thrown' && this.entered;
  }

  // El jefe o el mini jefe (con su barra de vida, no se deja agarrar).
  get isBig() {
    return Boolean(this.type.boss || this.mini);
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
    this.knockback = dir * (this.type.stagger && !this.mini ? 320 : 120) * power;
    this.sprite.flash();
    if (this.image) {
      this.image.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
      this.scene.time.delayedCall(70, () => {
        if (this.image.active) this.image.setTintMode(Phaser.TintModes.MULTIPLY).clearTint();
      });
    }
    if (this.type.stagger && !this.mini && this.state !== 'thrown') this.setState('hurt', HURT_MS);
    if (this.hp <= 0) this.dead = true;
    if (this.type.puff) this.puffMs = PUFF.ms;
    this.creature?.hurt(350);
    // A los grandes, un remate o un especial los marea un ratito.
    if (this.isBig && power >= 2) this.dizzyMs = 900;
  }

  // Le pegó a un jugador (o ganaron los monstruos): se carcajea.
  taunt(ms) {
    this.creature?.taunt(ms);
  }

  // Qué está haciendo, para su pose (ver ui/creature.js).
  creaturePose() {
    if (this.grabbedBy || this.state === 'thrown' || this.state === 'hurt') return 'dolor';
    if (this.dizzyMs > 0) return 'mareado';
    if (this.state === 'windup' || this.state === 'aim' || this.state === 'aimCharge') return 'cargando';
    if (this.state === 'quakeJump') return this.stateMs > this.stateTotalMs / 2 ? 'cargando' : 'ataque';
    if (this.charging) return 'ataque';
    return this.state === 'chase' ? 'caminar' : 'normal';
  }

  // Al vencerlo queda tirado con su pose de derrotado (o de dolor) y se desvanece.
  leaveBody() {
    const image = this.image;
    if (!this.creature || !image) return;
    this.creature.hurtMs = 0;
    this.creature.set('derrotado');
    this.creature.update(16);
    const body = this.scene.add
      .image(this.x, this.y + this.radius, image.texture.key)
      .setOrigin(image.originX, 1)
      .setScale(image.scaleX, image.scaleY)
      .setFlipX(image.flipX)
      .setDepth(this.y - 1);
    this.scene.tweens.add({ targets: body, scaleY: image.scaleY * 0.55, alpha: 0, delay: 650, duration: 450, onComplete: () => body.destroy() });
  }

  render() {
    const warning = this.state === 'windup' || this.state === 'aim' || this.state === 'aimCharge';
    const shake = warning ? (Math.random() - 0.5) * 6 : 0;
    this.sprite.setPosition(this.x + shake, this.y).setDepth(this.y);
    this.sprite.look(this.facing * 0.9, 0.2);
    this.alert.setVisible(warning);
    this.image?.setFlipX(this.facing < 0);
    // (Las colas y aletas dibujadas van detrás, según hacia dónde mira.)
    if (this.features) for (const g of [this.features.back, this.features.front]) g.scaleX = this.facing < 0 ? -1 : 1;
    // Enojado: parpadea rojo.
    if (this.angry && this.image && Math.floor(this.hopMs / 220) % 2 === 0) this.image.setTint(0xff8a8a);
    else if (this.angry && this.image) this.image.clearTint();
    // Los hongos avanzan dando saltitos; los murciélagos van volando; aventado, gira en el aire.
    let lift = 0;
    if (this.type.hop && this.state === 'chase') lift = Math.abs(Math.sin(this.hopMs / 180)) * HOP_HEIGHT;
    if (this.type.fly) lift = 40 + Math.sin(this.hopMs / 160) * 10;
    // Cada saltito, al caer, se aplasta.
    const hop = Math.floor(this.hopMs / (180 * Math.PI));
    if (this.type.hop && this.state === 'chase' && hop !== this.hopCount) this.creature?.land(0.45);
    this.hopCount = hop;
    if (this.grabbedBy) lift = this.grabbedBy.z + 46;
    if (this.state === 'thrown') lift = THROWN.height;
    // El brinco del Gran Gorila (sube y cae de golpe).
    if (this.state === 'quakeJump') lift = Math.sin((1 - this.stateMs / this.stateTotalMs) * Math.PI) * QUAKE_JUMP;
    this.sprite.figure.y = -lift;
    // El pez globo inflado.
    if (this.type.puff) this.sprite.figure.setScale(this.puffMs > 0 ? PUFF.scale : 1);
    this.sprite.figure.angle = this.state === 'thrown' ? (this.sprite.figure.angle + 25 * this.thrownDir) % 360 : this.grabbedBy ? 180 : 0;
    if (this.creature) {
      this.creature.face(this.facing);
      this.creature.angry = this.angry;
      this.creature.set(this.creaturePose());
      this.creature.update();
    }
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

// Lo que distingue a los monstruos del mar y de la selva cuando todavía no tienen dibujo: `back` va detrás de la
// bolita (aletas, colas, orejas) y `front` encima (dientes, pico, lengua). null para los demás.
function drawFeatures(scene, typeKey, r, color) {
  const back = scene.add.graphics();
  const front = scene.add.graphics();
  const darker = Phaser.Display.Color.IntegerToColor(color).darken(25).color;
  const outline = (g, width = r * 0.08) => g.lineStyle(width, COLORS.ink, 1);
  if (typeKey === 'pececito' || typeKey === 'reyTiburon') {
    // Cola y aleta de arriba.
    back.fillStyle(darker, 1);
    outline(back);
    back.fillTriangle(-r * 0.7, 0, -r * 1.55, -r * 0.65, -r * 1.55, r * 0.65);
    back.strokeTriangle(-r * 0.7, 0, -r * 1.55, -r * 0.65, -r * 1.55, r * 0.65);
    back.fillTriangle(-r * 0.35, -r * 0.8, r * 0.25, -r * 0.85, -r * 0.2, -r * 1.55);
    back.strokeTriangle(-r * 0.35, -r * 0.8, r * 0.25, -r * 0.85, -r * 0.2, -r * 1.55);
    if (typeKey === 'reyTiburon') {
      // Dientes.
      front.fillStyle(0xffffff, 1);
      for (let k = -2; k <= 2; k += 1) front.fillTriangle(k * r * 0.12 - r * 0.06, r * 0.36, k * r * 0.12 + r * 0.06, r * 0.36, k * r * 0.12, r * 0.5);
    }
  } else if (typeKey === 'medusa') {
    // Tentáculos ondulados.
    back.lineStyle(r * 0.14, darker, 1);
    for (let k = -2; k <= 2; k += 1) {
      const x = k * r * 0.32;
      back.beginPath();
      back.moveTo(x, r * 0.6);
      for (let s = 1; s <= 4; s += 1) back.lineTo(x + (s % 2 ? r * 0.16 : -r * 0.16), r * 0.6 + s * r * 0.28);
      back.strokePath();
    }
  } else if (typeKey === 'pezGlobo') {
    // Picos alrededor.
    back.fillStyle(darker, 1);
    outline(back, r * 0.05);
    for (let k = 0; k < 12; k += 1) {
      const a = (k / 12) * Math.PI * 2;
      const side = 0.22;
      const pts = [Math.cos(a - side) * r * 0.9, Math.sin(a - side) * r * 0.9, Math.cos(a) * r * 1.35, Math.sin(a) * r * 1.35, Math.cos(a + side) * r * 0.9, Math.sin(a + side) * r * 0.9];
      back.fillTriangle(...pts);
      back.strokeTriangle(...pts);
    }
  } else if (typeKey === 'mono' || typeKey === 'gorilita' || typeKey === 'granGorila') {
    // Orejas (y la cola del monito).
    for (const side of [-1, 1]) {
      back.fillStyle(darker, 1);
      outline(back);
      back.fillCircle(side * r * 0.95, -r * 0.15, r * 0.32);
      back.strokeCircle(side * r * 0.95, -r * 0.15, r * 0.32);
      back.fillStyle(0xf2c79a, 1);
      back.fillCircle(side * r * 0.98, -r * 0.15, r * 0.16);
    }
    if (typeKey === 'mono') {
      back.lineStyle(r * 0.16, darker, 1);
      back.beginPath();
      back.arc(-r * 1.1, r * 0.2, r * 0.45, -Math.PI * 0.9, Math.PI * 0.5, false);
      back.strokePath();
    }
  } else if (typeKey === 'serpiente') {
    // Colita de bolitas y lengua.
    back.fillStyle(darker, 1);
    for (let k = 1; k <= 4; k += 1) back.fillCircle(-r * (0.6 + k * 0.42), r * 0.55, r * (0.5 - k * 0.08));
    front.lineStyle(r * 0.07, 0xff4d6d, 1);
    front.lineBetween(0, r * 0.55, 0, r * 0.85);
    front.lineBetween(0, r * 0.85, -r * 0.1, r * 1);
    front.lineBetween(0, r * 0.85, r * 0.1, r * 1);
  } else if (typeKey === 'loro') {
    // Cresta, ala y pico.
    back.fillStyle(0x3fa7ff, 1);
    outline(back);
    back.fillEllipse(r * 0.85, r * 0.2, r * 0.7, r * 1.1);
    back.strokeEllipse(r * 0.85, r * 0.2, r * 0.7, r * 1.1);
    back.fillStyle(0xffd84d, 1);
    back.fillTriangle(-r * 0.2, -r * 0.85, r * 0.2, -r * 0.85, 0, -r * 1.45);
    front.fillStyle(0xffc93c, 1);
    outline(front, r * 0.05);
    front.fillTriangle(-r * 0.16, r * 0.3, r * 0.16, r * 0.3, 0, r * 0.62);
    front.strokeTriangle(-r * 0.16, r * 0.3, r * 0.16, r * 0.3, 0, r * 0.62);
  } else {
    back.destroy();
    front.destroy();
    return null;
  }
  return { back, front };
}
