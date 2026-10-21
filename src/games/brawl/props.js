import Phaser from 'phaser';
import { sfx } from '../../shared/sound.js';
import { textStyle } from '../../ui/style.js';
import { drawItem } from '../smash/items.js';
import { burst, popText } from './effects.js';
import { HAMMER_MS, STAR_MS } from './Fighter.js';

// Cajas, barriles y jarrones en cada tramo del nivel: se rompen a golpes y sueltan algo. Lo que sueltan se agarra
// pasando encima: comida (cura), martillo (pega doble), bomba (X la lanza) o estrella (invencible un rato).
const BREAKABLES = ['caja', 'barril', 'jarron'];
const HITS_TO_BREAK = 2;
const FOODS = ['pizza', 'helado', 'pollo'];
// De cada 100 cosas que salen: comida, martillo, bomba y estrella.
const DROPS = [
  ['food', 45],
  ['hammer', 22],
  ['bomb', 18],
  ['star', 15],
];
const PICK_RANGE = { x: 45, y: 35 };
const ITEM_LIFE_MS = 12000;
const FOOD_HEARTS = 2;
const BOMB = { speed: 520, rise: 520, gravity: 1500, radius: 110, damage: 3 };

function propTexture(scene, name) {
  const key = `brawl:objeto-${name}`;
  return scene.textures.exists(key) ? key : null;
}

function drawProp(scene, name, size) {
  const key = propTexture(scene, name);
  if (key) {
    const image = scene.add.image(0, 0, key).setOrigin(0.5, 1);
    image.setScale(size / Math.max(image.width, image.height));
    return image;
  }
  // Sin dibujo: una caja café (o comida como emoji).
  if (FOODS.includes(name)) return scene.add.text(0, 0, { pizza: '🍕', helado: '🍦', pollo: '🍗' }[name], textStyle(36)).setOrigin(0.5, 1);
  return scene.add.rectangle(0, -size / 2, size, size, 0x9c6b3c).setStrokeStyle(4, 0x5c3a1a);
}

export class Props {
  constructor(scene) {
    this.scene = scene;
    this.breakables = [];
    this.items = [];
    this.bombs = [];
  }

  // Pone 2 o 3 cosas rompibles en el tramo [left, right] del nivel.
  place(left, right, top, bottom) {
    const count = Phaser.Math.Between(2, 3);
    for (let i = 0; i < count; i += 1) {
      const name = Phaser.Utils.Array.GetRandom(BREAKABLES);
      const x = left + ((i + 0.5) / count) * (right - left) + Phaser.Math.Between(-60, 60);
      const y = Phaser.Math.Between(top + 30, bottom - 30);
      const sprite = this.scene.add.container(x, y, [drawProp(this.scene, name, 78)]).setDepth(y);
      this.breakables.push({ name, x, y, radius: 34, hp: HITS_TO_BREAK, sprite });
    }
  }

  clear() {
    for (const b of this.breakables) b.sprite.destroy();
    for (const item of this.items) item.sprite.destroy();
    for (const bomb of this.bombs) bomb.sprite.destroy();
    this.breakables = [];
    this.items = [];
    this.bombs = [];
  }

  // Un golpe (del jugador `by`) en (x, y) con alcance `reach`: le pega a las cajas cercanas.
  hitAt(x, y, reach, by) {
    for (const b of this.breakables) {
      if (Math.abs(b.x - x) > reach + b.radius || Math.abs(b.y - y) > 40) continue;
      if (b.hitBy?.has(by.attackId)) continue;
      b.hitBy = new Set([by.attackId]);
      b.hp -= 1;
      this.scene.tweens.add({ targets: b.sprite, angle: { from: -8, to: 8 }, duration: 60, yoyo: true });
      sfx.hit(0.3);
      if (b.hp <= 0) this.breakOpen(b);
    }
    this.breakables = this.breakables.filter((b) => b.hp > 0);
  }

  breakOpen(b) {
    burst(this.scene, b.x, b.y - 40, 0x9c6b3c, 10);
    popText(this.scene, b.x, b.y - 90, '¡Crac!', '#ffd84d');
    b.sprite.destroy();
    this.drop(b.x, b.y);
  }

  drop(x, y) {
    let roll = Math.random() * 100;
    let kind = 'food';
    for (const [type, chance] of DROPS) {
      if (roll < chance) {
        kind = type;
        break;
      }
      roll -= chance;
    }
    const food = kind === 'food' ? Phaser.Utils.Array.GetRandom(FOODS) : null;
    const look = food ? drawProp(this.scene, food, 54) : drawItem(this.scene, kind).setY(-24);
    const sprite = this.scene.add.container(x, y, [look]).setDepth(y);
    this.scene.tweens.add({ targets: look, y: look.y - 14, duration: 500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.items.push({ kind, food, x, y, sprite, ageMs: 0 });
  }

  update(dtMs, fighters) {
    this.items = this.items.filter((item) => {
      item.ageMs += dtMs;
      const taker = fighters.find((f) => !f.down && Math.abs(f.x - item.x) < PICK_RANGE.x && Math.abs(f.y - item.y) < PICK_RANGE.y && this.take(f, item));
      if (taker || item.ageMs > ITEM_LIFE_MS) {
        item.sprite.destroy();
        return false;
      }
      item.sprite.setAlpha(item.ageMs > ITEM_LIFE_MS - 2000 && Math.floor(item.ageMs / 150) % 2 === 0 ? 0.3 : 1);
      return true;
    });
    this.updateBombs(dtMs);
  }

  // Lo agarra si le sirve (la comida solo si le falta vida; martillo y bomba si no trae nada en la mano).
  take(fighter, item) {
    if (item.kind === 'food') {
      if (!fighter.heal(FOOD_HEARTS)) return false;
      popText(this.scene, item.x, item.y - 70, '+♥♥', '#ff5a7a');
      sfx.pickup();
      return true;
    }
    if (item.kind === 'star') {
      fighter.starMs = STAR_MS;
      popText(this.scene, item.x, item.y - 70, '¡Estrella!', '#ffd84d');
      sfx.star();
      return true;
    }
    if (fighter.item) return false;
    fighter.item = { type: item.kind, ms: item.kind === 'hammer' ? HAMMER_MS : Infinity };
    popText(this.scene, item.x, item.y - 70, item.kind === 'hammer' ? '¡Martillo!' : '¡Bomba! (X)', '#ffffff');
    sfx.pickup();
    return true;
  }

  // La bomba: sale en arco por el carril del que la lanzó y explota al caer.
  throwBomb(fighter) {
    const sprite = drawItem(this.scene, 'bomb');
    this.bombs.push({ x: fighter.x + fighter.facing * 40, y: fighter.y, z: 40, vx: fighter.facing * BOMB.speed, vz: BOMB.rise, owner: fighter, sprite });
  }

  updateBombs(dtMs) {
    const dt = dtMs / 1000;
    this.bombs = this.bombs.filter((bomb) => {
      bomb.x += bomb.vx * dt;
      bomb.vz -= BOMB.gravity * dt;
      bomb.z += bomb.vz * dt;
      bomb.sprite.setPosition(bomb.x, bomb.y - bomb.z).setDepth(bomb.y).setAngle(bomb.x);
      if (bomb.z > 0) return true;
      bomb.sprite.destroy();
      this.scene.explode?.(bomb.x, bomb.y, BOMB.radius, BOMB.damage, bomb.owner);
      return false;
    });
  }
}
