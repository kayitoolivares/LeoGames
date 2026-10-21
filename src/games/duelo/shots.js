import { RAINBOW } from '../smash/bloquecito.js';
import { COLORS } from '../../ui/style.js';
import { FLOOR, WALLS } from './DueloFighter.js';

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
  // Movimientos secretos: shurikens, puño cohete, bola de estambre, bola de nieve, burbuja y la bomba de los objetos.
  shuriken: {
    w: 18,
    h: 18,
    draw: (scene) => [scene.add.star(0, 0, 4, 7, 22, 0xa8b0c8).setStrokeStyle(3, COLORS.ink), scene.add.circle(0, 0, 5, 0x1b1530)],
    spin: 18,
  },
  fist: {
    w: 30,
    h: 20,
    draw: (scene) => [
      scene.add.ellipse(-30, 0, 34, 18, 0xff9a3c, 0.9),
      scene.add.rectangle(-6, 0, 30, 22, 0x8a96b0).setStrokeStyle(3, COLORS.ink),
      scene.add.rectangle(18, 0, 30, 34, 0xa8b4cc).setRounded(10).setStrokeStyle(4, COLORS.ink),
    ],
    flicker: true,
  },
  yarn: {
    w: 20,
    h: 20,
    draw: (scene) => [scene.add.circle(0, 0, 20, 0xff7fb0).setStrokeStyle(4, COLORS.ink), scene.add.arc(0, 0, 12, 200, 340, false).setStrokeStyle(3, 0xffffff), scene.add.arc(0, 0, 6, 20, 160, false).setStrokeStyle(3, 0xffffff)],
    spin: 12,
  },
  snowball: {
    w: 20,
    h: 20,
    draw: (scene) => [scene.add.circle(0, 0, 21, 0xffffff).setStrokeStyle(4, 0x9fd8ff), scene.add.circle(-6, -6, 6, 0xdff4ff)],
    spin: 6,
  },
  bubble: {
    w: 30,
    h: 30,
    draw: (scene) => [scene.add.circle(0, 0, 32, 0x9fd8ff, 0.35).setStrokeStyle(4, 0xffffff, 0.9), scene.add.circle(-10, -10, 7, 0xffffff, 0.8)],
  },
  bomb: {
    w: 22,
    h: 22,
    draw: (scene) => [scene.add.circle(0, 0, 22, 0x2b2b3a).setStrokeStyle(4, COLORS.ink), scene.add.rectangle(0, -24, 8, 10, 0x8a6a4a), scene.add.circle(0, -32, 6, 0xffd84d)],
    spin: 8,
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
    // Hacia abajo (los que se lanzan en el aire) o un poco hacia arriba o abajo (los que salen varios a la vez).
    this.vy = data.vy ?? 0;
    this.x = owner.x + this.dir * owner.radius * 1.2;
    this.baseY = owner.y - owner.reachHeight * owner.scale * 0.55;
    this.y = this.baseY;
    this.ms = 0;
    this.dead = false;
    const parts = [].concat(this.shape.draw(scene));
    this.sprite = scene.add.container(this.x, this.y, parts).setDepth(200).setScale((owner.superMs > 0 ? 1.3 : 1) * (data.big ?? 1));
    this.sprite.scaleX *= this.dir;
  }

  update(dtMs) {
    this.ms += dtMs;
    this.x += (this.vx * dtMs) / 1000;
    this.y += (this.vy * dtMs) / 1000;
    if (this.data.wave) this.y = this.baseY + Math.sin(this.ms / 110) * 22;
    // La bola de estambre va botando por el piso.
    if (this.data.bounce) this.y = FLOOR - 22 - Math.abs(Math.sin(this.ms / 150)) * 80;
    if (this.x < WALLS.left - 80 || this.x > WALLS.right + 80 || this.y < -80) this.dead = true;
    // Lo que va cayendo se deshace al llegar al piso.
    if (this.y > FLOOR - 8 && !this.data.bounce) {
      this.dead = true;
      this.scene.poof?.(this.x, FLOOR - 16);
    }
  }

  // Una parada perfecta lo regresa: ahora es del que se cubrió y va hacia el otro lado.
  reflect(by) {
    this.owner = by;
    this.dir = -this.dir;
    this.vx = -this.vx * 1.15;
    this.vy = -Math.abs(this.vy) * 0.3;
    this.sprite.scaleX *= -1;
  }

  get box() {
    const k = this.sprite.scaleY;
    return { left: this.x - this.shape.w * k, right: this.x + this.shape.w * k, top: this.y - this.shape.h * k, bottom: this.y + this.shape.h * k };
  }

  // Lo que hace al pegar (igual que un golpe especial).
  get hit() {
    const d = this.data;
    const hit = { damage: d.damage, push: d.push, stunMs: d.freeze || d.scare ? 900 : 360, special: true, power: this.owner.power, freeze: d.freeze };
    // La burbuja levanta al que le pega; la bomba explota y avienta.
    if (d.float) Object.assign(hit, { launch: true, lift: 1.4 });
    if (d.launch) hit.launch = true;
    return hit;
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
