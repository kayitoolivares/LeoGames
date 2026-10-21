import { sfx } from '../../shared/sound.js';
import { burst, popText } from '../brawl/effects.js';
import { drawItem } from './items.js';

// La bola súper: de vez en cuando aparece flotando por el escenario. Hay que pegarle varias veces para romperla;
// el que la rompe brilla de colores y con B hace su golpe final.
const FIRST_MS = 20000;
const EVERY_MS = [25000, 35000];
const HITS = 3;
const RADIUS = 30;
// Se va moviendo despacito en ochos por arriba del escenario, y si nadie la rompe se va.
const LIFE_MS = 16000;

export class SuperBall {
  // area: { minX, maxX, topY, bottomY } (por dónde flota).
  constructor(scene, layer, area) {
    this.scene = scene;
    this.layer = layer;
    this.area = area;
    this.waitMs = FIRST_MS;
    this.ball = null;
  }

  get active() {
    return Boolean(this.ball);
  }

  get radius() {
    return RADIUS;
  }

  get x() {
    return this.ball?.x ?? 0;
  }

  get y() {
    return this.ball?.y ?? 0;
  }

  // `enabled`: si hay objetos y se está peleando; `blocked`: alguien ya tiene su golpe final listo.
  update(dtMs, enabled, blocked) {
    if (!this.ball) {
      if (!enabled || blocked) return;
      this.waitMs -= dtMs;
      if (this.waitMs <= 0) this.spawn();
      return;
    }
    const b = this.ball;
    b.ageMs += dtMs;
    const t = b.ageMs / 1000;
    const { minX, maxX, topY, bottomY } = this.area;
    b.x = (minX + maxX) / 2 + Math.sin(t * 0.6) * (maxX - minX) * 0.4;
    b.y = (topY + bottomY) / 2 + Math.sin(t * 1.2) * (bottomY - topY) * 0.35;
    b.sprite.setPosition(b.x, b.y).setAngle(t * 40).setScale(1.25 + 0.08 * Math.sin(t * 8));
    const ending = b.ageMs > LIFE_MS - 2000 && Math.floor(b.ageMs / 120) % 2 === 0;
    b.sprite.setAlpha(ending ? 0.3 : 1);
    if (b.ageMs > LIFE_MS) this.remove();
  }

  spawn() {
    const sprite = drawItem(this.scene, 'superball');
    this.layer.add(sprite);
    this.ball = { sprite, x: 0, y: 0, hp: HITS, ageMs: 0 };
    this.update(0, true, false);
    popText(this.scene, this.ball.x, this.ball.y - 50, '¡Bola súper!', '#ffd84d', this.layer);
    sfx.sparkle();
  }

  // Le pegaron. Devuelve true si se rompió (el que le pegó gana el golpe final).
  hit(by) {
    const b = this.ball;
    if (!b) return false;
    b.hp -= 1;
    burst(this.scene, b.x, b.y, 0xffffff, 8, this.layer);
    sfx.hit(0.4);
    if (b.hp > 0) return false;
    burst(this.scene, b.x, b.y, 0xffd84d, 18, this.layer);
    burst(this.scene, b.x, b.y, by.color, 12, this.layer);
    popText(this.scene, b.x, b.y - 50, '¡B = golpe final!', '#ffd84d', this.layer);
    sfx.star();
    this.remove();
    return true;
  }

  remove() {
    this.ball?.sprite.destroy();
    this.ball = null;
    this.waitMs = EVERY_MS[0] + Math.random() * (EVERY_MS[1] - EVERY_MS[0]);
  }
}
