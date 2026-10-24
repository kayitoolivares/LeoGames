import Phaser from 'phaser';
import { sfx } from '../../shared/sound.js';
import { textStyle } from '../../ui/style.js';

const POWS = ['¡POW!', '¡PAF!', '¡BAM!', '¡ZAS!'];
const SPARKLE_COLORS = [0xffffff, 0xffd84d, 0xfff3b0];

export function randomPow() {
  return POWS[Math.floor(Math.random() * POWS.length)];
}

// `layer` (opcional) es el contenedor donde se agrega el efecto, para juegos que separan
// el mundo (con zoom) de los textos de pantalla.

// Bolitas y estrellitas que salen disparadas (cuando un monstruo hace "puf", al agarrar algo...), con un destello
// en medio. Caen tantito, como si pesaran.
export function burst(scene, x, y, color, count = 8, layer = null) {
  const flash = scene.add.circle(x, y, 18, 0xffffff, 0.9).setDepth(9001);
  layer?.add(flash);
  scene.tweens.add({ targets: flash, scale: 2.4, alpha: 0, duration: 220, ease: 'Quad.easeOut', onComplete: () => flash.destroy() });
  for (let i = 0; i < count; i += 1) {
    const angle = (i / count) * Math.PI * 2 + Math.random() * 0.4;
    const reach = 60 + Math.random() * 40;
    const size = 5 + Math.random() * 5;
    const dot = i % 3 === 0 ? scene.add.star(x, y, 5, size * 0.5, size * 1.3, i % 2 ? 0xffffff : color) : scene.add.circle(x, y, size, color);
    dot.setDepth(9000);
    layer?.add(dot);
    scene.tweens.add({
      targets: dot,
      x: x + Math.cos(angle) * reach,
      y: y + Math.sin(angle) * reach * 0.75,
      angle: Phaser.Math.Between(-180, 180),
      duration: 300,
      ease: 'Quad.easeOut',
    });
    // Luego cae y se apaga.
    scene.tweens.add({
      targets: dot,
      y: `+=${30 + Math.random() * 30}`,
      alpha: 0,
      scale: 0.3,
      delay: 260,
      duration: 260,
      ease: 'Quad.easeIn',
      onComplete: () => dot.destroy(),
    });
  }
}

// Texto que entra rebotando y luego sube y se desvanece ("¡POW!", "¡Auch!", "+♥").
export function popText(scene, x, y, text, color = '#ffc93c', layer = null) {
  const label = scene.add
    .text(x, y, text, textStyle(30, color, { fontStyle: 'bold', stroke: '#1b1530', strokeThickness: 6 }))
    .setOrigin(0.5)
    .setDepth(9500)
    .setScale(0.2)
    .setAngle(Phaser.Math.Between(-10, 10));
  layer?.add(label);
  scene.tweens.add({ targets: label, scale: 1, angle: 0, duration: 260, ease: 'Back.easeOut' });
  scene.tweens.add({
    targets: label,
    y: y - 56,
    alpha: 0,
    delay: 300,
    duration: 520,
    ease: 'Quad.easeIn',
    onComplete: () => label.destroy(),
  });
}

// Destellitos que brillan y se apagan alrededor de (x, y): al agarrar algo bueno.
export function sparkles(scene, x, y, count = 6, radius = 40, layer = null) {
  for (let i = 0; i < count; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const r = radius * (0.4 + Math.random() * 0.8);
    const star = scene.add.star(x + Math.cos(angle) * r, y + Math.sin(angle) * r, 4, 2, 10, SPARKLE_COLORS[i % SPARKLE_COLORS.length]).setDepth(9600).setScale(0);
    layer?.add(star);
    scene.tweens.add({ targets: star, scale: 1.2, angle: 90, duration: 180, delay: i * 50, yoyo: true, hold: 80, ease: 'Sine.easeOut', onComplete: () => star.destroy() });
  }
}

// Lluvia de papelitos de colores al ganar: rectángulos, bolitas, estrellas y listones que dan vueltas y se mecen.
export function confetti(scene, colors, pieces = 80, layer = null) {
  const { width, height } = scene.scale;
  for (let i = 0; i < pieces; i += 1) {
    const color = colors[i % colors.length];
    const x = Math.random() * width;
    const kind = i % 4;
    let piece;
    if (kind === 0) piece = scene.add.rectangle(x, -20, 12, 18, color);
    else if (kind === 1) piece = scene.add.circle(x, -20, 6, color);
    else if (kind === 2) piece = scene.add.star(x, -20, 5, 4, 10, i % 8 === 2 ? 0xffd84d : color);
    else piece = scene.add.rectangle(x, -20, 6, 26, color);
    piece.setDepth(9800).setScrollFactor(0);
    layer?.add(piece);
    const delay = Math.random() * 1500;
    const duration = 2000 + Math.random() * 1400;
    const done = () => {
      scene.tweens.killTweensOf(piece);
      piece.destroy();
    };
    scene.tweens.add({ targets: piece, y: height + 30, angle: (Math.random() - 0.5) * 900, delay, duration, ease: 'Sine.easeIn', onComplete: done });
    // Se mece de lado a lado y "aletea" (se voltea) mientras cae.
    scene.tweens.add({ targets: piece, x: x + (Math.random() < 0.5 ? -1 : 1) * (30 + Math.random() * 50), delay, duration: 500 + Math.random() * 400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    scene.tweens.add({ targets: piece, scaleX: 0.15, delay, duration: 160 + Math.random() * 200, yoyo: true, repeat: -1 });
  }
}

// Fuegos artificiales: cohetitos que suben desde abajo y explotan en estrellitas de colores (festejos grandes).
export function fireworks(scene, colors, rockets = 5, layer = null) {
  const { width, height } = scene.scale;
  for (let i = 0; i < rockets; i += 1) {
    const color = colors[i % colors.length] ?? 0xffd84d;
    const x = width * (0.15 + 0.7 * (rockets === 1 ? 0.5 : i / (rockets - 1))) + Phaser.Math.Between(-40, 40);
    const top = height * (0.18 + Math.random() * 0.22);
    const rocket = scene.add.circle(x, height + 10, 5, 0xffffff).setDepth(9700).setScrollFactor(0);
    layer?.add(rocket);
    scene.tweens.add({
      targets: rocket,
      y: top,
      delay: i * 260,
      duration: 650,
      ease: 'Quad.easeOut',
      onUpdate: () => {
        // Rastro de chispitas.
        if (Math.random() < 0.5) return;
        const spark = scene.add.circle(rocket.x + Phaser.Math.Between(-3, 3), rocket.y + 8, 3, 0xffd84d).setDepth(9690).setScrollFactor(0);
        layer?.add(spark);
        scene.tweens.add({ targets: spark, alpha: 0, y: spark.y + 20, duration: 300, onComplete: () => spark.destroy() });
      },
      onComplete: () => {
        rocket.destroy();
        explode(scene, x, top, color, layer);
      },
    });
  }
}

function explode(scene, x, y, color, layer) {
  sfx.boom?.();
  const ring = scene.add.circle(x, y, 10, 0xffffff, 0.8).setDepth(9700).setScrollFactor(0);
  layer?.add(ring);
  scene.tweens.add({ targets: ring, scale: 6, alpha: 0, duration: 300, onComplete: () => ring.destroy() });
  const count = 22;
  for (let i = 0; i < count; i += 1) {
    const angle = (i / count) * Math.PI * 2;
    const speed = 110 + Math.random() * 50;
    const star = (i % 2 ? scene.add.star(x, y, 5, 3, 8, color) : scene.add.circle(x, y, 5, i % 4 === 0 ? 0xffffff : color)).setDepth(9700).setScrollFactor(0);
    layer?.add(star);
    scene.tweens.add({ targets: star, x: x + Math.cos(angle) * speed, y: y + Math.sin(angle) * speed, duration: 600, ease: 'Quad.easeOut' });
    scene.tweens.add({ targets: star, y: `+=${60}`, alpha: 0, scale: 0.4, delay: 450, duration: 650, ease: 'Quad.easeIn', onComplete: () => star.destroy() });
  }
}
