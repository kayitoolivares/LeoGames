import { sfx } from '../../shared/sound.js';
import { burst, popText } from '../brawl/effects.js';

const HIT = { damage: 12, base: 560, scale: 6, angle: 88 };
const WIDTH = 90;
const HEIGHT = 420;

// Géiseres de lava del Volcán: cada tanto una de las bocas del piso burbujea (aviso) y luego hace
// erupción; a quien esté encima lo avienta hacia arriba. Con el escudo arriba no pasa nada.
export class Geysers {
  constructor(scene, layer, platform, { xs, everyMs, warnMs, eruptMs }) {
    this.scene = scene;
    this.layer = layer;
    this.top = platform.top;
    this.xs = xs;
    this.timing = { everyMs, warnMs, eruptMs };
    this.state = 'idle';
    this.stateMs = everyMs;
    this.x = xs[0];
    this.hit = new Set();
    this.eruptions = 0;

    for (const x of xs) layer.add(scene.add.ellipse(x, this.top + 4, 74, 16, 0x1b0d0d).setStrokeStyle(3, 0xff7a2f));
    // Aviso: la boca brilla y le salen burbujas.
    this.dots = Array.from({ length: 5 }, (_, i) => scene.add.circle((i - 2) * 16, 0, 10, 0xffb13c));
    this.bubbles = scene.add.container(0, this.top, [scene.add.ellipse(0, 4, 100, 28, 0xff7a2f, 0.6), ...this.dots]).setVisible(false);
    this.column = scene.add.container(0, this.top).setVisible(false);
    this.column.add([
      scene.add.rectangle(0, -HEIGHT / 2, WIDTH + 30, HEIGHT, 0xff7a2f, 0.45).setRounded(30),
      scene.add.rectangle(0, -HEIGHT / 2, WIDTH, HEIGHT, 0xffb13c).setRounded(24),
      scene.add.rectangle(0, -HEIGHT / 2, WIDTH * 0.4, HEIGHT, 0xfff1b8, 0.8).setRounded(12),
    ]);
    layer.add([this.bubbles, this.column]);
  }

  // `active` en falso (pelea terminada): termina la erupción que iba, pero no empieza otra.
  update(dtMs, fighters, active) {
    this.stateMs -= dtMs;
    if (this.state === 'idle') {
      if (active && this.stateMs <= 0) this.warn();
    } else if (this.state === 'warn') {
      this.dots.forEach((dot, i) => dot.setY(-Math.abs(Math.sin(this.stateMs / 120 + i)) * 30));
      if (this.stateMs <= 0) this.erupt();
    } else if (this.state === 'erupt') {
      this.burn(fighters);
      if (this.stateMs <= 0) {
        this.column.setVisible(false);
        this.state = 'idle';
        this.stateMs = this.timing.everyMs;
      }
    }
  }

  warn() {
    this.state = 'warn';
    this.stateMs = this.timing.warnMs;
    this.x = this.xs[Math.floor(Math.random() * this.xs.length)];
    this.bubbles.setPosition(this.x, this.top).setVisible(true);
  }

  erupt() {
    this.state = 'erupt';
    this.stateMs = this.timing.eruptMs;
    this.eruptions += 1;
    this.hit.clear();
    this.bubbles.setVisible(false);
    this.column.setPosition(this.x, this.top).setVisible(true).setScale(1, 0.2);
    this.scene.tweens.add({ targets: this.column, scaleY: 1, duration: 160, ease: 'Back.easeOut' });
    burst(this.scene, this.x, this.top - 20, 0xff7a2f, 12, this.layer);
    this.scene.cameras.main.shake(150, 0.005);
    sfx.boom();
  }

  burn(fighters) {
    for (const f of fighters) {
      if (this.hit.has(f) || !f.isAlive() || f.isInvulnerable()) continue;
      if (Math.abs(f.x - this.x) > WIDTH / 2 + f.radius * 0.6 || f.y < this.top - HEIGHT || f.y > this.top + 10) continue;
      this.hit.add(f);
      const { blocked } = f.takeHit({ facing: Math.sign(f.x - this.x) || 1, power: 1 }, HIT);
      if (!blocked) popText(this.scene, f.x, f.y - 60, '¡Quema!', '#ff9a3c', this.layer);
    }
  }
}
