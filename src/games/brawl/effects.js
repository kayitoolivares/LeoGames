import { textStyle } from '../../ui/style.js';

const POWS = ['¡POW!', '¡PAF!', '¡BAM!', '¡ZAS!'];

export function randomPow() {
  return POWS[Math.floor(Math.random() * POWS.length)];
}

// `layer` (opcional) es el contenedor donde se agrega el efecto, para juegos que separan
// el mundo (con zoom) de los textos de pantalla.

// Bolitas que salen disparadas cuando un monstruo hace "puf".
export function burst(scene, x, y, color, count = 8, layer = null) {
  for (let i = 0; i < count; i += 1) {
    const angle = (i / count) * Math.PI * 2;
    const dot = scene.add.circle(x, y, 7, color).setDepth(9000);
    layer?.add(dot);
    scene.tweens.add({
      targets: dot,
      x: x + Math.cos(angle) * 70,
      y: y + Math.sin(angle) * 50,
      alpha: 0,
      scale: 0.3,
      duration: 450,
      ease: 'Quad.easeOut',
      onComplete: () => dot.destroy(),
    });
  }
}

// Texto que sube y se desvanece ("¡POW!", "¡Auch!", "+♥").
export function popText(scene, x, y, text, color = '#ffc93c', layer = null) {
  const label = scene.add
    .text(x, y, text, textStyle(30, color, { fontStyle: 'bold', stroke: '#1b1530', strokeThickness: 6 }))
    .setOrigin(0.5)
    .setDepth(9500);
  layer?.add(label);
  scene.tweens.add({
    targets: label,
    y: y - 50,
    alpha: 0,
    duration: 650,
    ease: 'Quad.easeOut',
    onComplete: () => label.destroy(),
  });
}

// Lluvia de papelitos de colores al ganar.
export function confetti(scene, colors, pieces = 80, layer = null) {
  const { width, height } = scene.scale;
  for (let i = 0; i < pieces; i += 1) {
    const color = colors[i % colors.length];
    const piece = scene.add.rectangle(Math.random() * width, -20, 12, 18, color).setDepth(9800);
    layer?.add(piece);
    scene.tweens.add({
      targets: piece,
      y: height + 20,
      x: piece.x + (Math.random() - 0.5) * 200,
      angle: (Math.random() - 0.5) * 720,
      delay: Math.random() * 1500,
      duration: 1800 + Math.random() * 1200,
      onComplete: () => piece.destroy(),
    });
  }
}
