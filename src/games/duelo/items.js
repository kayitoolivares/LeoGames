import Phaser from 'phaser';
import { itemTexture } from '../smash/art.js';
import { drawItem } from '../smash/items.js';
import { textStyle } from '../../ui/style.js';
import { FLOOR, WALLS } from './DueloFighter.js';

// Objetos en la pelea: de vez en cuando cae uno del cielo y el primero que lo toca se lo queda.
//   heart   corazón: cura un poco de vida
//   hammer  martillo: los siguientes 3 golpes pegan más fuerte y tumban
//   bomb    bomba: la avienta de una vez hacia el rival
//   shield  escudo: una burbuja que aguanta los siguientes 2 golpes
//   pie     pastel: lo avienta de una vez; al que le cae en la cara no puede pegar un ratito
//   bubble  burbuja: la avienta de una vez; al que atrapa se lo lleva flotando y luego lo deja caer
//   magnet  imán: jala al rival hasta tenerlo pegadito (y un instante no puede hacer nada)
// Los dibujos son los de Bolitas Bros (el escudo se dibuja aquí; los nuevos, si no hay dibujo, con figuras).
export const FIGHT_ITEMS = {
  heart: { name: '¡Corazón!', emoji: '❤️' },
  hammer: { name: '¡Martillo!', emoji: '🔨' },
  bomb: { name: '¡Bomba!', emoji: '💣' },
  shield: { name: '¡Escudo!', emoji: '🛡️' },
  pie: { name: '¡Pastel!', emoji: '🥧', drawn: true },
  bubble: { name: '¡Burbuja!', emoji: '🫧', drawn: true },
  magnet: { name: '¡Imán!', emoji: '🧲', drawn: true },
};
const KINDS = Object.keys(FIGHT_ITEMS);
const SPAWN_MS = [8000, 14000];
// El primero tarda más (para que la pelea empiece tranquila).
const FIRST_MS = [14000, 20000];
const SIZE = 64;
const GRAVITY = 1400;
const LIFE_MS = 9000;
const BLINK_MS = 2000;
const MAX_ITEMS = 2;

export class FightItems {
  constructor(scene) {
    this.scene = scene;
    this.list = [];
    this.nextMs = Phaser.Math.Between(...FIRST_MS);
  }

  spawn(kind = Phaser.Utils.Array.GetRandom(KINDS)) {
    const scene = this.scene;
    const x = Phaser.Math.Between(WALLS.left + 160, WALLS.right - 160);
    const sprite = scene.add.container(x, -SIZE).setDepth(150);
    const key = kind === 'shield' ? null : itemTexture(scene, kind);
    if (key) {
      const image = scene.add.image(0, 0, key);
      image.setScale(SIZE / Math.max(image.width, image.height));
      sprite.add(image);
    } else if (kind === 'shield') {
      sprite.add(scene.add.circle(0, 0, SIZE * 0.45, 0x9fe3ff, 0.45).setStrokeStyle(5, 0xffffff));
      sprite.add(scene.add.star(0, 0, 5, 8, 18, 0xffffff));
    } else if (FIGHT_ITEMS[kind].drawn) {
      sprite.add(drawItem(scene, kind).setScale(SIZE / 48));
    } else {
      sprite.add(scene.add.text(0, 0, FIGHT_ITEMS[kind].emoji, textStyle(SIZE * 0.8, '#ffffff')).setOrigin(0.5));
    }
    this.list.push({ kind, x, y: -SIZE, vy: 0, ageMs: 0, sprite });
  }

  // Cae, se queda en el piso un rato (parpadea antes de irse) y se lo lleva el que lo toque.
  update(dtMs, fighters, onTake) {
    this.nextMs -= dtMs;
    if (this.nextMs <= 0) {
      this.nextMs = Phaser.Math.Between(...SPAWN_MS);
      if (this.list.length < MAX_ITEMS) this.spawn();
    }
    const dt = dtMs / 1000;
    this.list = this.list.filter((item) => {
      item.ageMs += dtMs;
      if (item.y < FLOOR - SIZE / 2) {
        item.vy += GRAVITY * dt;
        item.y = Math.min(FLOOR - SIZE / 2, item.y + item.vy * dt);
      }
      item.sprite.setPosition(item.x, item.y + Math.sin(item.ageMs / 200) * 4);
      const left = LIFE_MS - item.ageMs;
      item.sprite.setAlpha(left < BLINK_MS && Math.floor(item.ageMs / 120) % 2 ? 0.3 : 1);
      if (left <= 0) {
        item.sprite.destroy();
        return false;
      }
      const taker = fighters.find((f) => {
        if (f.koed || f.celebrating) return false;
        const box = f.hurtbox;
        return item.x > box.left - SIZE / 2 && item.x < box.right + SIZE / 2 && item.y > box.top && item.y - SIZE / 2 < box.bottom;
      });
      if (!taker) return true;
      item.sprite.destroy();
      onTake(taker, item.kind, item);
      return false;
    });
  }

  // El objeto más cercano (para que la compu vaya por él).
  nearest(x) {
    return this.list.reduce((best, item) => (!best || Math.abs(item.x - x) < Math.abs(best.x - x) ? item : best), null);
  }

  clear() {
    for (const item of this.list) item.sprite.destroy();
    this.list = [];
  }
}
