import Phaser from 'phaser';
import { COLORS } from './style.js';

// Personaje sencillo (una bolita con ojos) hecho solo con figuras: no necesita imágenes.
// Sirve también para ver que el control responde: mira hacia el stick, salta con A.
// Con `angry: true` sale con cejas y boca de enojado (los monstruos).
export class Blob extends Phaser.GameObjects.Container {
  constructor(scene, x, y, color, radius = 60, { angry = false } = {}) {
    super(scene, x, y);
    this.radius = radius;
    this.color = color;
    this.hopping = false;

    const shadow = scene.add.ellipse(0, radius * 0.95, radius * 1.6, radius * 0.35, 0x000000, 0.25);

    // La figura va en su propio contenedor para poder saltar sin mover la sombra.
    this.figure = scene.add.container(0, 0);
    this.ball = scene.add.circle(0, 0, radius, color);
    const shine = scene.add.circle(-radius * 0.4, -radius * 0.45, radius * 0.18, 0xffffff, 0.35);

    const eyeX = radius * 0.32;
    const eyeY = -radius * 0.12;
    this.eyeRadius = radius * 0.22;
    this.eyeOrigins = [-eyeX, eyeX].map((x) => ({ x, y: eyeY }));
    const eyes = this.eyeOrigins.map((o) => scene.add.circle(o.x, o.y, this.eyeRadius, 0xffffff));
    this.pupils = this.eyeOrigins.map((o) => scene.add.circle(o.x, o.y, this.eyeRadius * 0.5, COLORS.ink));

    const mouth = scene.add.graphics();
    mouth.lineStyle(radius * 0.08, COLORS.ink, 1);
    mouth.beginPath();
    if (angry) {
      mouth.arc(0, radius * 0.5, radius * 0.25, Phaser.Math.DegToRad(205), Phaser.Math.DegToRad(335), false);
    } else {
      mouth.arc(0, radius * 0.22, radius * 0.28, Phaser.Math.DegToRad(25), Phaser.Math.DegToRad(155), false);
    }
    mouth.strokePath();

    const parts = [this.ball, shine, ...eyes, ...this.pupils, mouth];
    if (angry) {
      const brows = scene.add.graphics();
      const r = this.eyeRadius;
      brows.lineStyle(radius * 0.1, COLORS.ink, 1);
      brows.lineBetween(-eyeX - r, eyeY - r * 1.5, -eyeX + r * 0.8, eyeY - r * 0.9);
      brows.lineBetween(eyeX + r, eyeY - r * 1.5, eyeX - r * 0.8, eyeY - r * 0.9);
      parts.push(brows);
    }

    this.figure.add(parts);
    this.add([shadow, this.figure]);
    scene.add.existing(this);
  }

  setColor(color) {
    this.color = color;
    this.ball.setFillStyle(color);
    return this;
  }

  // Destello blanco al recibir un golpe. Si le pegan muy seguido no vuelve a destellar,
  // para que no se quede blanco todo el tiempo.
  flash(ms = 70) {
    const now = this.scene.time.now;
    if (now - (this.lastFlashAt ?? -Infinity) < 200) return;
    this.lastFlashAt = now;
    this.ball.setFillStyle(0xffffff);
    this.scene.time.delayedCall(ms, () => {
      if (this.active) this.ball.setFillStyle(this.color);
    });
  }

  // Mueve las pupilas hacia donde apunta el stick (x, y entre -1 y 1).
  look(x, y) {
    const reach = this.eyeRadius * 0.45;
    this.pupils.forEach((pupil, i) => {
      pupil.setPosition(this.eyeOrigins[i].x + x * reach, this.eyeOrigins[i].y + y * reach);
    });
  }

  hop() {
    if (this.hopping) return;
    this.hopping = true;
    this.scene.tweens.add({
      targets: this.figure,
      y: -this.radius * 0.6,
      duration: 160,
      yoyo: true,
      ease: 'Quad.easeOut',
      onComplete: () => {
        this.hopping = false;
      },
    });
  }

  // Como hop(): si ya se está aplastando no empieza otro, porque uno encima del otro
  // la dejaba aplastada para siempre.
  squish() {
    if (this.squishing) return;
    this.squishing = true;
    this.scene.tweens.add({
      targets: this.figure,
      scaleX: 1.2,
      scaleY: 0.8,
      duration: 90,
      yoyo: true,
      ease: 'Quad.easeOut',
      onComplete: () => {
        this.squishing = false;
      },
    });
  }
}
