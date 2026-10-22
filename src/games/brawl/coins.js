import Phaser from 'phaser';
import { settings } from '../../shared/settings.js';
import { sfx } from '../../shared/sound.js';
import { ARENA } from './arena.js';

// Monedas de Pelea en equipo: los monstruos las sueltan al caer (los jefes, muchas) y se agarran pasando encima (con
// el imán llegan solas). Todas van a la alcancía de la familia, que se gasta en sombreros y colores en la tienda.
const BANK_KEY = 'brawlCoins';
const RADIUS = 14;
const LIFE_MS = 15000;
const PICK = { x: 42, y: 32 };
const MAGNET = { range: 320, speed: 520 };
const MAX_ON_FLOOR = 40;

export const coinBank = {
  get() {
    return settings.get(BANK_KEY, 0);
  },
  add(amount) {
    settings.set(BANK_KEY, this.get() + amount);
  },
  // Devuelve true si alcanzó.
  spend(amount) {
    if (this.get() < amount) return false;
    settings.set(BANK_KEY, this.get() - amount);
    return true;
  },
};

// Cuántas suelta cada monstruo.
export function coinsFor(monster) {
  if (monster.type.boss) return 10;
  if (monster.mini) return 5;
  return monster.type.coins ?? (monster.type.small ? 1 : 2);
}

function drawCoin(scene) {
  const key = 'brawl:objeto-moneda';
  if (scene.textures.exists(key)) {
    const image = scene.add.image(0, 0, key);
    return image.setScale((RADIUS * 2.4) / Math.max(image.width, image.height));
  }
  return scene.add.container(0, 0, [scene.add.circle(0, 0, RADIUS, 0xffc93c).setStrokeStyle(3, 0x8a5a00), scene.add.circle(0, 0, RADIUS * 0.5, 0xffe28a)]);
}

export class Coins {
  constructor(scene) {
    this.scene = scene;
    this.list = [];
  }

  // Saltan `count` monedas desde (x, y) y caen alrededor, en el piso.
  drop(x, y, count) {
    for (let i = 0; i < count && this.list.length < MAX_ON_FLOOR; i += 1) {
      const tx = x + Phaser.Math.Between(-70, 70);
      const ty = Phaser.Math.Clamp(y + Phaser.Math.Between(-30, 30), ARENA.top, ARENA.bottom);
      const sprite = this.scene.add.container(x, y - 40, [drawCoin(this.scene)]).setDepth(ty);
      const coin = { x: tx, y: ty, sprite, ageMs: 0 };
      this.scene.tweens.add({ targets: sprite, x: tx, y: ty - 16, duration: 420, ease: 'Quad.easeOut' });
      this.list.push(coin);
    }
  }

  clear() {
    for (const coin of this.list) coin.sprite.destroy();
    this.list = [];
  }

  // `onPick(fighter)`: alguien agarró una.
  update(dtMs, fighters, onPick) {
    const dt = dtMs / 1000;
    this.list = this.list.filter((coin) => {
      coin.ageMs += dtMs;
      if (coin.ageMs < 450) return true;
      // Con el imán vienen solas.
      const magnet = fighters.find((f) => !f.down && f.magnetMs > 0 && Math.hypot(f.x - coin.x, f.y - coin.y) < MAGNET.range);
      if (magnet) {
        const d = Math.hypot(magnet.x - coin.x, magnet.y - coin.y) || 1;
        coin.x += ((magnet.x - coin.x) / d) * MAGNET.speed * dt;
        coin.y += ((magnet.y - coin.y) / d) * MAGNET.speed * dt;
      }
      const taker = fighters.find((f) => !f.down && Math.abs(f.x - coin.x) < PICK.x && Math.abs(f.y - coin.y) < PICK.y);
      if (taker) {
        onPick(taker);
        sfx.coin();
        coin.sprite.destroy();
        return false;
      }
      if (coin.ageMs > LIFE_MS) {
        coin.sprite.destroy();
        return false;
      }
      const ending = coin.ageMs > LIFE_MS - 2000 && Math.floor(coin.ageMs / 150) % 2 === 0;
      coin.sprite.setPosition(coin.x, coin.y - 16 - Math.abs(Math.sin(coin.ageMs / 260)) * 6).setDepth(coin.y).setAlpha(ending ? 0.3 : 1);
      coin.sprite.list[0].setScale?.(coin.sprite.list[0].scaleY * (0.4 + 0.6 * Math.abs(Math.cos(coin.ageMs / 200))), coin.sprite.list[0].scaleY);
      return true;
    });
  }
}
