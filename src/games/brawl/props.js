import Phaser from 'phaser';
import { sfx } from '../../shared/sound.js';
import { Blob } from '../../ui/Blob.js';
import { CharacterLook } from '../../ui/CharacterLook.js';
import { textStyle } from '../../ui/style.js';
import { drawItem } from '../smash/items.js';
import { burst, popText } from './effects.js';
import { HAMMER_MS, MAGNET_MS, SHIELD_HITS, STAR_MS, SWORD_MS } from './Fighter.js';

// Cajas, barriles y jarrones en cada tramo del nivel: se rompen a golpes y sueltan algo. Lo que sueltan se agarra
// pasando encima: comida (cura), martillo (pega doble), bomba (X la lanza), estrella (invencible un rato), espada
// (pega doble y llega más lejos), escudo (aguanta 3 golpes), imán (jala monedas y comida) o mascota (un perrito
// que muerde monstruos). Y en un tramo de cada mundo, una jaula con un amigo adentro: rómpela y pelea con ustedes.
const BREAKABLES = ['caja', 'barril', 'jarron'];
const HITS_TO_BREAK = 2;
const CAGE_HITS = 3;
const FOODS = ['pizza', 'helado', 'pollo'];
// De cada 100 cosas que salen.
const DROPS = [
  ['food', 34],
  ['hammer', 13],
  ['bomb', 12],
  ['star', 10],
  ['sword', 10],
  ['shield', 9],
  ['magnet', 6],
  ['pet', 6],
];
// Los objetos nuevos se ven con su dibujo (o un emoji si no hay).
const ITEM_ART = { sword: 'espada', shield: 'escudo', magnet: 'iman', pet: 'mascota' };
const EMOJI = { pizza: '🍕', helado: '🍦', pollo: '🍗', espada: '🗡️', escudo: '🛡️', iman: '🧲', mascota: '🐶' };
const ITEM_WORDS = { sword: '¡Espada!', shield: '¡Escudo!', magnet: '¡Imán!', pet: '¡Una mascota!' };
const MAGNET = { range: 320, speed: 420 };
const PRISONER_RADIUS = 30;
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
  // Sin dibujo: la comida y los objetos como emoji; lo demás, una caja café.
  if (EMOJI[name]) return scene.add.text(0, 0, EMOJI[name], textStyle(36)).setOrigin(0.5, 1);
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

  // La jaula con un amigo (`character`) adentro, en (x, y).
  placeCage(x, y, character) {
    const scene = this.scene;
    // El dibujo de la jaula es blanco por dentro: el amigo va enfrente y unos barrotes encima de él.
    const cage = drawProp(scene, 'jaula', 150);
    const prisoner = new Blob(scene, 0, -PRISONER_RADIUS - 22, 0xd9d4ff, PRISONER_RADIUS);
    const look = new CharacterLook(scene, prisoner, character);
    look.show('dolor', -1);
    if (look.image) look.image.setScale((PRISONER_RADIUS * 2.8) / look.image.height);
    const bars = scene.add.graphics();
    for (const bx of [-36, -12, 12, 36]) {
      bars.lineStyle(9, 0x1b1530, 1).lineBetween(bx, -112, bx, -18);
      bars.lineStyle(5, 0xf2b53a, 1).lineBetween(bx, -112, bx, -18);
    }
    const help = scene.add.text(0, -170, '¡Sáquenme!', textStyle(20, '#ffd84d', { fontStyle: 'bold', stroke: '#1b1530', strokeThickness: 5 })).setOrigin(0.5);
    scene.tweens.add({ targets: help, y: -180, duration: 400, yoyo: true, repeat: -1 });
    const sprite = scene.add.container(x, y + 12, [cage, prisoner, bars, help]).setDepth(y + 1);
    this.breakables.push({ name: 'jaula', cage: true, character, x, y, radius: 60, hp: CAGE_HITS, sprite });
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
      if (b.hp <= 0) this.breakOpen(b, by);
    }
    this.breakables = this.breakables.filter((b) => b.hp > 0);
  }

  breakOpen(b, by) {
    burst(this.scene, b.x, b.y - 40, b.cage ? 0xc0c4d0 : 0x9c6b3c, b.cage ? 16 : 10);
    popText(this.scene, b.x, b.y - 90, '¡Crac!', '#ffd84d');
    b.sprite.destroy();
    if (b.cage) {
      this.scene.rescue?.(b.character, b.x, b.y, by);
      return;
    }
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
    const art = food ?? ITEM_ART[kind];
    const look = art ? drawProp(this.scene, art, 58) : drawItem(this.scene, kind).setY(-24);
    const sprite = this.scene.add.container(x, y, [look]).setDepth(y);
    this.scene.tweens.add({ targets: look, y: look.y - 14, duration: 500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.items.push({ kind, food, x, y, sprite, ageMs: 0 });
  }

  update(dtMs, fighters) {
    const dt = dtMs / 1000;
    this.items = this.items.filter((item) => {
      item.ageMs += dtMs;
      // Con el imán, la comida llega sola.
      const magnet = item.kind === 'food' && fighters.find((f) => !f.down && f.magnetMs > 0 && Math.hypot(f.x - item.x, f.y - item.y) < MAGNET.range);
      if (magnet) {
        const d = Math.hypot(magnet.x - item.x, magnet.y - item.y) || 1;
        item.x += ((magnet.x - item.x) / d) * MAGNET.speed * dt;
        item.y += ((magnet.y - item.y) / d) * MAGNET.speed * dt;
        item.sprite.setPosition(item.x, item.y).setDepth(item.y);
      }
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

  // La comida o el corazón más cercano a `fighter` (a menos de `range`), para que la compu vaya por él.
  nearestFood(fighter, range) {
    let best = null;
    let bestD = range;
    for (const item of this.items) {
      const d = Math.hypot(item.x - fighter.x, item.y - fighter.y);
      if (item.kind === 'food' && d < bestD) [best, bestD] = [item, d];
    }
    return best;
  }

  // Lo agarra si le sirve (la comida solo si le falta vida; martillo, bomba y espada si no trae nada en la mano).
  take(fighter, item) {
    const word = ITEM_WORDS[item.kind];
    if (item.kind === 'shield' || item.kind === 'magnet' || item.kind === 'pet') {
      if (item.kind === 'shield') {
        if (fighter.shieldHits >= SHIELD_HITS) return false;
        fighter.shieldHits = SHIELD_HITS;
      } else if (item.kind === 'magnet') {
        fighter.magnetMs = MAGNET_MS;
      } else if (!this.scene.pets?.add(fighter)) {
        return false;
      }
      popText(this.scene, item.x, item.y - 70, word, '#ffffff');
      sfx.pickup();
      this.scene.itemTaken?.(fighter, item.kind, word);
      return true;
    }
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
    fighter.item = { type: item.kind, ms: item.kind === 'hammer' ? HAMMER_MS : item.kind === 'sword' ? SWORD_MS : Infinity };
    popText(this.scene, item.x, item.y - 70, word ?? (item.kind === 'hammer' ? '¡Martillo!' : '¡Bomba! (X)'), '#ffffff');
    sfx.pickup();
    if (word) this.scene.itemTaken?.(fighter, item.kind, word);
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
