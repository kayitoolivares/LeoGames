import { sfx } from '../../shared/sound.js';
import { COLORS } from '../../ui/style.js';
import { itemTexture } from './art.js';

// Objetos que caen del cielo en Bolitas Bros. Se agarran tocándolos:
// martillo, bomba, bate, pistola de rayos, bumerán y flor de fuego se cargan (X los usa); corazón, estrella y patineta
// hacen efecto al instante; el huevo sorpresa se abre y sale un ayudante que pelea de tu lado un rato; la cápsula se
// abre y sale otro objeto (o explota); el tornado sale volando hacia donde miras y levanta a los rivales.
// El resorte no se agarra: se queda en el piso y el que lo pisa sale disparado para arriba.
export const ITEM_TYPES = ['hammer', 'bomb', 'heart', 'star', 'bat', 'raygun', 'skate', 'egg', 'boomerang', 'fireflower', 'spring', 'capsule', 'tornado'];
// Lo que puede salir de la cápsula sorpresa.
export const CAPSULE_ITEMS = ITEM_TYPES.filter((type) => type !== 'capsule' && type !== 'spring');
// El resorte: qué tan fuerte avienta para arriba y cada cuánto puede volver a aventar.
const SPRING_JUMP = 1350;
const SPRING_COOLDOWN_MS = 250;
const SPAWN_EVERY_MS = [7000, 11000];
const FIRST_SPAWN_MS = 5000;
const MAX_ITEMS = 2;
const LIFE_MS = 12000;
export const ITEM_RADIUS = 22;
const GRAVITY = 1400;

// Dibujo de cada objeto: la imagen si existe (npm run arte); si no, con figuras (sin emojis,
// para que se vea igual en el Xbox).
export function drawItem(scene, type) {
  const box = scene.add.container(0, 0);
  const art = itemTexture(scene, type);
  if (art) {
    const image = scene.add.image(0, 0, art);
    image.setScale(48 / Math.max(image.width, image.height));
    box.add(image);
    return box;
  }
  if (type === 'hammer') {
    box.add([
      scene.add.rectangle(0, 10, 9, 40, 0x8b5a2b).setStrokeStyle(2, COLORS.ink),
      scene.add.rectangle(0, -14, 40, 22, 0x9a9aa8).setRounded(5).setStrokeStyle(3, COLORS.ink),
    ]);
  } else if (type === 'bomb') {
    box.add([
      scene.add.circle(0, 4, 18, 0x2b2b3a).setStrokeStyle(3, COLORS.ink),
      scene.add.rectangle(8, -16, 6, 12, 0x8b5a2b).setAngle(30),
      scene.add.circle(12, -22, 5, 0xff9a3c),
      scene.add.circle(-6, -2, 5, 0xffffff, 0.4),
    ]);
  } else if (type === 'heart') {
    box.add([
      scene.add.circle(-9, -4, 11, 0xff5a7a),
      scene.add.circle(9, -4, 11, 0xff5a7a),
      scene.add.triangle(0, 4, -19, 0, 19, 0, 0, 22, 0xff5a7a).setOrigin(0.5, 0),
    ]);
  } else if (type === 'star') {
    box.add(scene.add.star(0, 0, 5, 10, 22, COLORS.accent).setStrokeStyle(3, 0xffffff));
  } else if (type === 'bat') {
    box.add(scene.add.rectangle(0, 0, 10, 52, 0x9a6a44).setRounded(4).setStrokeStyle(2, COLORS.ink).setAngle(30));
  } else if (type === 'raygun') {
    box.add([
      scene.add.rectangle(4, -4, 40, 16, 0xff5a5f).setRounded(6).setStrokeStyle(2, COLORS.ink),
      scene.add.rectangle(-8, 10, 10, 18, 0x3fa7ff).setStrokeStyle(2, COLORS.ink),
      scene.add.circle(26, -4, 5, 0xffd02a),
    ]);
  } else if (type === 'skate') {
    box.add([
      scene.add.rectangle(0, 0, 54, 10, 0x8158d8).setRounded(5).setStrokeStyle(2, COLORS.ink),
      scene.add.circle(-16, 9, 5, 0xffd02a).setStrokeStyle(2, COLORS.ink),
      scene.add.circle(16, 9, 5, 0xffd02a).setStrokeStyle(2, COLORS.ink),
    ]);
  } else if (type === 'egg') {
    box.add([
      scene.add.ellipse(0, 0, 34, 44, 0xffffff).setStrokeStyle(3, COLORS.ink),
      scene.add.circle(-6, -8, 4, 0xff5fa8),
      scene.add.circle(7, 4, 5, 0x3fa7ff),
      scene.add.circle(-4, 12, 4, 0xffd02a),
    ]);
  } else if (type === 'superball') {
    box.add([scene.add.circle(0, 0, 22, 0xb07cff).setStrokeStyle(4, 0xffffff), scene.add.star(0, 0, 5, 6, 13, 0xffffff)]);
  } else if (type === 'target') {
    box.add([scene.add.circle(0, 0, 22, 0xe53935).setStrokeStyle(3, COLORS.ink), scene.add.circle(0, 0, 14, 0xffffff), scene.add.circle(0, 0, 7, 0xe53935)]);
  } else if (type === 'boomerang') {
    box.add([
      scene.add.rectangle(-8, -4, 12, 40, 0x9a6a3a).setRounded(5).setStrokeStyle(2, COLORS.ink).setAngle(-35),
      scene.add.rectangle(8, -4, 12, 40, 0x9a6a3a).setRounded(5).setStrokeStyle(2, COLORS.ink).setAngle(35),
    ]);
  } else if (type === 'fireflower') {
    for (let i = 0; i < 5; i += 1) {
      const angle = (i / 5) * Math.PI * 2;
      box.add(scene.add.circle(Math.cos(angle) * 13, Math.sin(angle) * 13, 10, 0xff7a2f).setStrokeStyle(2, COLORS.ink));
    }
    box.add(scene.add.circle(0, 0, 10, 0xffd02a).setStrokeStyle(2, COLORS.ink));
  } else if (type === 'spring') {
    box.add(scene.add.rectangle(0, 16, 40, 10, 0xe53935).setRounded(4).setStrokeStyle(2, COLORS.ink));
    for (let i = 0; i < 4; i += 1) box.add(scene.add.ellipse(0, 6 - i * 9, 32, 10, 0x000000, 0).setStrokeStyle(4, 0x9a9aa8));
  } else if (type === 'capsule') {
    box.add([
      scene.add.circle(0, 0, 21, 0x3fa7ff).setStrokeStyle(3, COLORS.ink),
      scene.add.arc(0, 0, 21, 0, 180, false, 0xffffff),
      scene.add.rectangle(0, 0, 42, 4, COLORS.ink),
      scene.add.circle(0, 0, 7, 0xffd02a).setStrokeStyle(2, COLORS.ink),
    ]);
  } else if (type === 'tornado') {
    for (let i = 0; i < 5; i += 1) box.add(scene.add.ellipse(i * 2 - 4, -18 + i * 9, 44 - i * 7, 10, 0x9aa8b8).setStrokeStyle(2, 0x5a6878));
  } else if (type === 'sandbag') {
    box.add([
      scene.add.rectangle(0, 4, 36, 44, 0xa8743f).setRounded(16).setStrokeStyle(3, COLORS.ink),
      scene.add.circle(-7, 0, 3, COLORS.ink),
      scene.add.circle(7, 0, 3, COLORS.ink),
    ]);
  }
  return box;
}

export class SmashItems {
  // area: { minX, maxX, spawnY, bottom } (dónde aparecen y dónde se pierden).
  constructor(scene, layer, platforms, area) {
    this.scene = scene;
    this.layer = layer;
    this.platforms = platforms;
    this.area = area;
    this.list = [];
    this.spawnMs = FIRST_SPAWN_MS;
  }

  spawn(type = ITEM_TYPES[Math.floor(Math.random() * ITEM_TYPES.length)]) {
    const x = this.area.minX + Math.random() * (this.area.maxX - this.area.minX);
    return this.spawnAt(type, x, this.area.spawnY);
  }

  // Un objeto en un lugar (el que sale de la cápsula brinca un poquito al salir).
  spawnAt(type, x, y, vy = 0) {
    const sprite = drawItem(this.scene, type);
    this.layer.add(sprite);
    const item = { type, sprite, x, y, vy, platform: null, ageMs: 0, cooldownMs: 0 };
    this.list.push(item);
    return item;
  }

  // `onPickup(fighter, item)` avisa cuando alguien agarra algo.
  update(dtMs, fighters, enabled, onPickup) {
    const dt = dtMs / 1000;
    if (enabled) {
      this.spawnMs -= dtMs;
      if (this.spawnMs <= 0) {
        if (this.list.length < MAX_ITEMS) this.spawn();
        this.spawnMs = SPAWN_EVERY_MS[0] + Math.random() * (SPAWN_EVERY_MS[1] - SPAWN_EVERY_MS[0]);
      }
    }

    this.list = this.list.filter((item) => {
      item.ageMs += dtMs;
      this.fall(item, dt);
      if (item.type === 'spring') this.bounce(item, dtMs, fighters);
      // (El que salió de una cápsula espera un instante, para que se vea antes de que alguien lo agarre.)
      const taker =
        item.type !== 'spring' &&
        item.ageMs > (item.waitMs ?? 0) &&
        fighters.find((f) => f.isAlive() && !f.isDummy && f.distanceTo(item.x, item.y) < f.radius + ITEM_RADIUS && f.grab(item.type));
      if (taker) onPickup(taker, item);
      if (taker || item.ageMs > LIFE_MS || item.y > this.area.bottom) {
        item.sprite.destroy();
        return false;
      }
      // Parpadea los últimos 2 segundos para avisar que se va; si está en el piso, flota un poquito.
      const ending = item.ageMs > LIFE_MS - 2000 && Math.floor(item.ageMs / 120) % 2 === 0;
      const bob = item.platform ? Math.sin(item.ageMs / 250) * 4 : 0;
      item.sprite.setPosition(item.x, item.y + bob).setAlpha(ending ? 0.3 : 1);
      return true;
    });
  }

  // El resorte, ya en el piso: al que lo pisa (o se le para encima) lo avienta para arriba y le devuelve sus saltos.
  bounce(item, dtMs, fighters) {
    item.cooldownMs = Math.max(0, item.cooldownMs - dtMs);
    if (!item.platform || item.cooldownMs > 0) return;
    for (const f of fighters) {
      if (!f.isAlive() || f.hanging || f.heldBy || f.vy < 0) continue;
      const feet = f.y + f.radius;
      if (Math.abs(f.x - item.x) > f.radius * 0.8 + 16 || feet < item.y - 26 || feet > item.y + ITEM_RADIUS + 6) continue;
      f.y = item.y - 26 - f.radius;
      f.vy = -SPRING_JUMP * Math.sqrt(this.area.gravity ?? 1);
      f.grounded = false;
      f.platform = null;
      f.airJumps = f.stats.airJumps;
      f.rescueUsed = false;
      item.cooldownMs = SPRING_COOLDOWN_MS;
      item.bounces = (item.bounces ?? 0) + 1;
      this.scene.tweens.add({ targets: item.sprite, scaleY: 0.5, duration: 70, yoyo: true });
      sfx.boing();
    }
  }

  // Caen y se quedan sobre las plataformas (y se mueven con ellas).
  fall(item, dt) {
    if (item.platform) {
      const p = item.platform;
      item.x += p.dx;
      item.y = p.top - ITEM_RADIUS;
      if (item.x < p.left || item.x > p.right) item.platform = null;
      return;
    }
    const prevBottom = item.y + ITEM_RADIUS;
    item.vy = Math.min(900, item.vy + GRAVITY * (this.area.gravity ?? 1) * dt);
    item.y += item.vy * dt;
    const bottom = item.y + ITEM_RADIUS;
    for (const p of this.platforms) {
      if (item.x >= p.left && item.x <= p.right && prevBottom <= p.top + 1 && bottom >= p.top) {
        item.y = p.top - ITEM_RADIUS;
        item.vy = 0;
        item.platform = p;
        return;
      }
    }
  }

  nearest(fighter, maxDistance) {
    let best = null;
    let bestDist = maxDistance;
    for (const item of this.list) {
      const dist = Math.hypot(item.x - fighter.x, item.y - fighter.y);
      if (dist < bestDist) [best, bestDist] = [item, dist];
    }
    return best;
  }
}
