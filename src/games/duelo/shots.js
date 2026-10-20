import { RAINBOW } from '../smash/bloquecito.js';
import { COLORS } from '../../ui/style.js';
import { WALLS } from './DueloFighter.js';

// Cómo se ve cada cosa que se lanza y el tamaño de su caja (mitad de ancho y de alto).
const SHAPES = {
  star: { w: 24, h: 24, draw: (scene) => scene.add.star(0, 0, 5, 11, 26, COLORS.accent).setStrokeStyle(4, COLORS.ink), spin: 9 },
  laser: {
    w: 46,
    h: 9,
    draw: (scene) => [scene.add.rectangle(0, 0, 96, 20, 0xff5a5f), scene.add.rectangle(0, 0, 80, 7, 0xffffff)],
  },
  fire: {
    w: 28,
    h: 24,
    draw: (scene) => [scene.add.circle(0, 0, 30, 0xff9a3c, 0.9), scene.add.circle(6, 0, 17, 0xffd84d), scene.add.circle(10, 0, 8, 0xffffff)],
    flicker: true,
  },
  ball: {
    w: 20,
    h: 20,
    draw: (scene) => [scene.add.circle(0, 0, 21, 0x2b2b3a).setStrokeStyle(4, COLORS.ink), scene.add.circle(-7, -7, 6, 0xffffff, 0.5)],
  },
  sparkle: {
    w: 22,
    h: 22,
    draw: (scene) => [scene.add.star(0, 0, 4, 8, 26, 0xff9ee0).setStrokeStyle(3, COLORS.ink), scene.add.circle(0, 0, 6, 0xffffff)],
    spin: 6,
  },
  water: {
    w: 34,
    h: 16,
    draw: (scene) => [scene.add.ellipse(0, 0, 76, 36, 0x3fa7ff, 0.9).setStrokeStyle(3, 0xffffff, 0.8), scene.add.ellipse(8, -5, 30, 9, 0xffffff, 0.7)],
  },
  // Bloquecito: las tres pelotas de malabares del 3 y el arcoíris del 7.
  juggle: {
    w: 26,
    h: 26,
    draw: (scene) => [
      scene.add.circle(0, -14, 12, 0xff5a5f).setStrokeStyle(3, COLORS.ink),
      scene.add.circle(-13, 9, 12, 0xffd02a).setStrokeStyle(3, COLORS.ink),
      scene.add.circle(13, 9, 12, 0x3fa7ff).setStrokeStyle(3, COLORS.ink),
    ],
    spin: 8,
  },
  rainbow: {
    w: 56,
    h: 20,
    draw: (scene) => [
      scene.add.rectangle(0, 0, 124, RAINBOW.length * 6 + 8, 0xffffff),
      ...RAINBOW.map((color, i) => scene.add.rectangle(0, (i - (RAINBOW.length - 1) / 2) * 6, 116, 6, color)),
    ],
  },
};

// Lo que lanza el especial de algunos personajes: vuela derecho (el polvo mágico, en ondas) hasta que pega,
// choca con otro o sale de la pantalla.
export class Shot {
  constructor(scene, owner, data) {
    this.scene = scene;
    this.owner = owner;
    this.data = data;
    this.shape = SHAPES[data.shape];
    this.dir = owner.facing;
    this.vx = this.dir * data.speed * owner.speed;
    this.x = owner.x + this.dir * owner.radius * 1.2;
    this.baseY = owner.y - owner.reachHeight * owner.scale * 0.55;
    this.y = this.baseY;
    this.ms = 0;
    this.dead = false;
    const parts = [].concat(this.shape.draw(scene));
    this.sprite = scene.add.container(this.x, this.y, parts).setDepth(200).setScale(owner.superMs > 0 ? 1.3 : 1);
    this.sprite.scaleX *= this.dir;
  }

  update(dtMs) {
    this.ms += dtMs;
    this.x += (this.vx * dtMs) / 1000;
    if (this.data.wave) this.y = this.baseY + Math.sin(this.ms / 110) * 22;
    if (this.x < WALLS.left - 80 || this.x > WALLS.right + 80) this.dead = true;
  }

  get box() {
    const k = this.sprite.scaleY;
    return { left: this.x - this.shape.w * k, right: this.x + this.shape.w * k, top: this.y - this.shape.h * k, bottom: this.y + this.shape.h * k };
  }

  // Lo que hace al pegar (igual que un golpe especial).
  get hit() {
    return { damage: this.data.damage, push: this.data.push, stunMs: 360, special: true, power: this.owner.power };
  }

  render() {
    this.sprite.setPosition(this.x, this.y);
    if (this.shape.spin) this.sprite.angle += this.shape.spin * this.dir;
    if (this.shape.flicker) this.sprite.list[0].setScale(0.85 + Math.random() * 0.3);
  }

  destroy() {
    this.dead = true;
    this.sprite.destroy();
  }
}
