import Phaser from 'phaser';
import { textStyle } from '../../ui/style.js';
import manifest from './art.json';

// Efectos de golpe del Duelo, estilo cómic: estallidos con letrero (¡POW!), chispas, ondas de choque, polvo y
// estrellitas de mareo. Si ya están los dibujos de Gemini (duelo/efectos/<nombre>.png) se usan; si no, se dibujan.
const DEPTH = 9400;
const STAR_POINTS = 12;

export function loadFxArt(scene) {
  for (const name of manifest.efectos ?? []) {
    const key = `duelo:fx-${name}`;
    if (!scene.textures.exists(key)) scene.load.image(key, `duelo/efectos/${name}.png`);
  }
}

function art(scene, name) {
  const key = `duelo:fx-${name}`;
  return scene.textures.exists(key) ? key : null;
}

// Un estallido de cómic con su letrero encima. `big` para remates, agarres y golpes finales.
export function comicHit(scene, x, y, word, { big = false, red = false } = {}) {
  const size = big ? 150 : 104;
  const box = scene.add.container(x, y).setDepth(DEPTH).setScale(0.3).setAngle(Phaser.Math.Between(-12, 12));
  const key = art(scene, red ? 'zas' : 'pow');
  if (key) {
    const image = scene.add.image(0, 0, key);
    image.setScale(size / Math.max(image.width, image.height));
    box.add(image);
  } else {
    const g = scene.add.graphics();
    const points = [];
    for (let i = 0; i < STAR_POINTS * 2; i += 1) {
      const radius = (i % 2 ? 0.62 : 1) * (size / 2) * (i % 4 === 0 ? 1.08 : 1);
      const angle = (i / (STAR_POINTS * 2)) * Math.PI * 2;
      points.push(new Phaser.Math.Vector2(Math.cos(angle) * radius, Math.sin(angle) * radius));
    }
    g.fillStyle(red ? 0xff5a3c : 0xffd84d, 1).fillPoints(points, true);
    g.lineStyle(5, 0x1b1530, 1).strokePoints(points, true);
    box.add(g);
  }
  box.add(scene.add.text(0, 0, word, textStyle(big ? 40 : 28, '#ffffff', { fontStyle: 'bold', stroke: '#1b1530', strokeThickness: 7 })).setOrigin(0.5));
  scene.tweens.add({ targets: box, scale: 1, duration: 120, ease: 'Back.easeOut' });
  scene.tweens.add({ targets: box, alpha: 0, y: y - 30, delay: big ? 500 : 300, duration: 250, onComplete: () => box.destroy() });
}

// Chispa blanca donde pega (y cuando se cubre, azul).
export function spark(scene, x, y, tint = 0xffffff) {
  const key = art(scene, 'chispa');
  const flash = key ? scene.add.image(x, y, key).setTint(tint) : scene.add.star(x, y, 4, 10, 46, tint).setStrokeStyle(4, 0x7fdcff);
  if (key) flash.setScale(90 / Math.max(flash.width, flash.height));
  flash.setDepth(DEPTH).setAngle(Phaser.Math.Between(0, 90));
  const scale = flash.scale;
  flash.setScale(scale * 0.4);
  scene.tweens.add({ targets: flash, scale: scale * 1.2, alpha: 0, angle: flash.angle + 40, duration: 260, onComplete: () => flash.destroy() });
}

// Onda de choque: un anillo que crece (golpes fuertes, aterrizajes duros, el golpe final).
export function shockwave(scene, x, y, color = 0x7fdcff) {
  const key = art(scene, 'onda');
  const ring = key ? scene.add.image(x, y, key).setTint(color) : scene.add.circle(x, y, 40).setStrokeStyle(10, color);
  if (key) ring.setScale(80 / ring.width);
  ring.setDepth(DEPTH - 1);
  const start = ring.scale;
  scene.tweens.add({ targets: ring, scale: start * 4, alpha: 0, duration: 420, ease: 'Quad.easeOut', onComplete: () => ring.destroy() });
}

// Nube de polvo en los pies, que se va hacia `dir` (-1, 0 o 1).
export function dustPuff(scene, x, y, dir = 0, count = 5) {
  const key = art(scene, 'polvo');
  for (let i = 0; i < count; i += 1) {
    const size = 18 + Math.random() * 14;
    const puff = key ? scene.add.image(x, y - 8, key) : scene.add.circle(x, y - 6, size / 2, 0xe8dcc8, 0.85);
    if (key) puff.setScale(size / puff.width);
    puff.setDepth(150);
    const spread = dir === 0 ? (i / (count - 1) - 0.5) * 2 : dir;
    scene.tweens.add({
      targets: puff,
      x: x + spread * (30 + Math.random() * 40),
      y: y - 10 - Math.random() * 26,
      alpha: 0,
      scale: puff.scale * 1.7,
      duration: 420,
      onComplete: () => puff.destroy(),
    });
  }
}

// Estrellitas de mareo dando vueltas sobre la cabeza del que quedó tirado (una por peleador, se mueve con él).
export class DizzyStars {
  constructor(scene) {
    this.scene = scene;
    const key = art(scene, 'mareo');
    this.root = scene.add.container(0, 0).setDepth(9000).setVisible(false);
    if (key) {
      const image = scene.add.image(0, 0, key);
      image.setScale(90 / image.width);
      this.root.add(image);
      this.spin = image;
    } else {
      this.stars = [0, 1, 2].map(() => scene.add.text(0, 0, '⭐', textStyle(26, '#ffd84d')).setOrigin(0.5));
      this.root.add(this.stars);
    }
  }

  update(visible, x, y, timeMs) {
    this.root.setVisible(visible);
    if (!visible) return;
    this.root.setPosition(x, y);
    if (this.spin) this.spin.setAngle(timeMs / 6);
    this.stars?.forEach((star, i) => {
      const angle = timeMs / 300 + (i * Math.PI * 2) / 3;
      star.setPosition(Math.cos(angle) * 42, Math.sin(angle) * 12);
      star.setDepth(Math.sin(angle) > 0 ? 1 : 0);
    });
  }

  destroy() {
    this.root.destroy();
  }
}
