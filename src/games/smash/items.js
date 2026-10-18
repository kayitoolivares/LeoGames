import { COLORS } from '../../ui/style.js';
import { itemTexture } from './art.js';

// Objetos que caen del cielo en Bolitas Bros. Se agarran tocándolos:
// martillo y bomba se cargan (X los usa); corazón y estrella hacen efecto al instante.
export const ITEM_TYPES = ['hammer', 'bomb', 'heart', 'star'];
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
    const sprite = drawItem(this.scene, type);
    this.layer.add(sprite);
    const item = { type, sprite, x, y: this.area.spawnY, vy: 0, platform: null, ageMs: 0 };
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
      const taker = fighters.find(
        (f) => f.isAlive() && Math.hypot(f.x - item.x, f.y - item.y) < f.radius + ITEM_RADIUS && f.grab(item.type),
      );
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
