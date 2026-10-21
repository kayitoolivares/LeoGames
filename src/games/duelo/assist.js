import Phaser from 'phaser';
import { characterTexture } from '../smash/art.js';
import { CHARACTERS, CHARACTER_KEYS } from '../smash/characters.js';
import { FLOOR, WALLS } from './DueloFighter.js';

// El ayudante (Y, una vez por round): un amigo, otro personaje, entra corriendo por detrás del que lo llamó, cruza
// la pantalla dando un golpazo al primer rival que encuentre y se va por el otro lado. Va con las cosas que se
// lanzan (shots), pero no choca con ellas (`solid`) y después de pegar sigue corriendo (`spent`).
const SPEED = 860;
const HEIGHT = 200;
const HALF_WIDTH = 46;
export const ASSIST_HIT = { damage: 10, push: 480, stunMs: 420, special: true, power: 1, launch: true };

// A quién llama: alguien que no esté peleando (ni Bloquecito, que se dibuja de otra forma).
export function pickHelper(fighters) {
  const busy = new Set(fighters.map((f) => f.character));
  const free = CHARACTER_KEYS.filter((key) => !busy.has(key) && key !== 'bloquecito');
  return Phaser.Utils.Array.GetRandom(free.length ? free : ['tanque']);
}

export class Assist {
  constructor(scene, owner, character) {
    this.scene = scene;
    this.owner = owner;
    this.character = character;
    this.name = CHARACTERS[character]?.name ?? character;
    this.solid = true;
    this.spent = false;
    this.dead = false;
    this.dir = owner.facing;
    // Sale de la orilla que tiene a la espalda el que lo llamó.
    this.x = this.dir > 0 ? WALLS.left - 80 : WALLS.right + 80;
    this.y = FLOOR;
    this.vx = this.dir * SPEED;
    this.ms = 0;
    this.sprite = scene.add.container(this.x, this.y).setDepth(190);
    const key = characterTexture(scene, character, 'golpe');
    if (key) {
      const image = scene.add.image(0, 0, key).setOrigin(0.5, 1).setFlipX(this.dir < 0);
      image.setScale(HEIGHT / image.height);
      this.sprite.add(image);
    } else {
      this.sprite.add(scene.add.circle(0, -HEIGHT / 2, HEIGHT * 0.3, CHARACTERS[character]?.color ?? 0xffffff).setStrokeStyle(6, 0x1b1530));
    }
  }

  update(dtMs) {
    this.ms += dtMs;
    this.x += (this.vx * dtMs) / 1000;
    if (this.x < WALLS.left - 160 || this.x > WALLS.right + 160) this.dead = true;
  }

  get box() {
    return { left: this.x - HALF_WIDTH, right: this.x + HALF_WIDTH, top: this.y - HEIGHT * 0.8, bottom: this.y };
  }

  get hit() {
    return ASSIST_HIT;
  }

  // Si se lo regresan con una parada perfecta, se va de un brinco.
  reflect() {
    this.spent = true;
    this.vx = -this.vx;
    this.dir = -this.dir;
  }

  render() {
    this.sprite.setPosition(this.x, this.y - Math.abs(Math.sin(this.ms / 70)) * 12);
    this.scene.dust?.(this.x - this.dir * 30, this.y, -this.dir, 1);
  }

  destroy() {
    this.dead = true;
    this.sprite.destroy();
  }
}
