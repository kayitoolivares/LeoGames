import Phaser from 'phaser';
import { rewards } from '../../shared/rewards.js';
import { sfx } from '../../shared/sound.js';
import { say } from '../../shared/voice.js';
import { COLORS, TEXT, hexToCss, textStyle } from '../../ui/style.js';
import { burst } from '../brawl/effects.js';
import { ANIMALS, ANIMAL_KEYS, animalTexture } from './animals.js';
import manifest from './art.json';
import { SHAPE_RADIUS, shapeOrigin, shapeTexture } from './drawings.js';

// Los otros juegos del Modo Bebé (además de "Botones y canciones", que es la escena misma). Cada uno recibe lo que
// aprietan los controles (input), el clic (click) y su cuadro (update), y se limpia con destroy().
//   Escondidas: un animalito se esconde detrás de una de 4 cosas; A B X Y (o las flechas) buscan detrás de la de su
//   color (están acomodadas como los botones del control) y al encontrarlo se asoma: "¡Cucú!".
//   Globos: 10 globos con números; cualquier botón revienta el que sigue y la voz cuenta "¡Uno! ¡Dos! ...".
//   A pintar: el stick mueve el pincel (su bolita amiga) y deja un caminito de colores que se queda; A B X Y ponen un
//   sellito de su color y LB / RB borran todo.
const INK = hexToCss(COLORS.ink);
const DEPTH = { canvas: 1, spot: 3, animal: 2.5, balloon: 3, fx: 5, ui: 10 };
const BUTTON_COLORS = { a: 0x4cd97b, b: 0xff5a5f, x: 0x3fa7ff, y: 0xffc93c };
const RAINBOW = [0xff5a5f, 0xff9a3c, 0xffc93c, 0x4cd97b, 0x3fa7ff, 0xb07cff, 0xff7ad9];

// ---------- Escondidas ----------
// Las 4 cosas, acomodadas como los botones del control (Y arriba, X a la izquierda, B a la derecha, A abajo).
const SPOTS = [
  { button: 'y', direction: 'up', name: 'nube', x: 640, y: 250 },
  { button: 'x', direction: 'left', name: 'arbusto', x: 300, y: 430 },
  { button: 'b', direction: 'right', name: 'casita', x: 980, y: 430 },
  { button: 'a', direction: 'down', name: 'regalo', x: 640, y: 560 },
];
const SPOT_W = 240;
const PEEK_MS = 1800;
const HINT_EVERY_MS = 5000;

export function loadActivityArt(scene) {
  for (const name of manifest.escondites ?? []) {
    if (!scene.textures.exists(`baby:escondite-${name}`)) scene.load.image(`baby:escondite-${name}`, `baby/escondites/${name}.png`);
  }
}

// El dibujo de un escondite: el de Gemini o, si no hay, uno hecho aquí.
function hidingTexture(scene, name) {
  const art = `baby:escondite-${name}`;
  if (scene.textures.exists(art)) return art;
  const key = `baby:escondite-dibujado-${name}`;
  if (scene.textures.exists(key)) return key;
  const element = document.createElement('canvas');
  element.width = 300;
  element.height = 240;
  const ctx = element.getContext('2d');
  ctx.lineWidth = 7;
  ctx.strokeStyle = INK;
  ctx.lineJoin = 'round';
  const blob = (x, y, r, fill) => {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.stroke();
  };
  if (name === 'arbusto' || name === 'nube') {
    const fill = name === 'arbusto' ? '#2e8b57' : '#ffffff';
    const puffs = [
      [80, 150, 62],
      [150, 120, 78],
      [222, 150, 62],
      [115, 175, 55],
      [190, 178, 55],
    ];
    for (const [x, y, r] of puffs) blob(x, y, r, fill);
    // (Se repinta el relleno encima para que no se vean las rayitas de adentro.)
    ctx.fillStyle = fill;
    for (const [x, y, r] of puffs) {
      ctx.beginPath();
      ctx.arc(x, y, r - 4, 0, Math.PI * 2);
      ctx.fill();
    }
    if (name === 'arbusto')
      for (const [x, y] of [
        [110, 120],
        [190, 105],
        [230, 160],
        [140, 180],
        [80, 160],
      ])
        blob(x, y, 10, '#ffc93c');
  } else if (name === 'regalo') {
    ctx.fillStyle = '#ff5a5f';
    ctx.fillRect(50, 90, 200, 140);
    ctx.strokeRect(50, 90, 200, 140);
    ctx.fillStyle = '#ff7a7f';
    ctx.fillRect(40, 70, 220, 40);
    ctx.strokeRect(40, 70, 220, 40);
    ctx.fillStyle = '#ffc93c';
    ctx.fillRect(132, 70, 36, 160);
    ctx.strokeRect(132, 70, 36, 160);
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(150 + side * 40, 50, 42, 24, side * 0.4, 0, Math.PI * 2);
      ctx.fillStyle = '#ffc93c';
      ctx.fill();
      ctx.stroke();
    }
  } else {
    // La casita: paredes, techo y la puerta redonda.
    ctx.fillStyle = '#ff7a59';
    ctx.fillRect(55, 100, 190, 130);
    ctx.strokeRect(55, 100, 190, 130);
    ctx.beginPath();
    ctx.moveTo(30, 108);
    ctx.lineTo(150, 15);
    ctx.lineTo(270, 108);
    ctx.closePath();
    ctx.fillStyle = '#8b5a2b';
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(110, 230);
    ctx.lineTo(110, 175);
    ctx.arc(150, 175, 40, Math.PI, 0);
    ctx.lineTo(190, 230);
    ctx.fillStyle = '#3a2340';
    ctx.fill();
    ctx.stroke();
  }
  scene.textures.addCanvas(key, element);
  return key;
}

export class HideAndSeek {
  constructor(scene) {
    this.scene = scene;
    this.found = 0;
    this.misses = 0;
    this.hintMs = 0;
    this.peeking = false;
    this.spots = SPOTS.map((spot) => {
      const image = scene.add.image(0, 0, hidingTexture(scene, spot.name));
      image.setScale(SPOT_W / image.width);
      const ring = scene.add.circle(0, SPOT_W * 0.42, 26, BUTTON_COLORS[spot.button]).setStrokeStyle(4, COLORS.ink);
      const letter = scene.add.text(0, SPOT_W * 0.42, spot.button.toUpperCase(), textStyle(28, TEXT.ink, { fontStyle: 'bold' })).setOrigin(0.5);
      const container = scene.add.container(spot.x, spot.y, [image, ring, letter]).setDepth(DEPTH.spot).setScale(0);
      scene.tweens.add({ targets: container, scale: 1, duration: 400, ease: 'Back.easeOut', delay: Math.random() * 200 });
      return { ...spot, container };
    });
    this.hide();
    say('¿Dónde está?');
  }

  // Esconde a otro animalito detrás de otra cosa.
  hide() {
    const others = this.spots.filter((spot) => spot !== this.hidingSpot);
    this.hidingSpot = Phaser.Utils.Array.GetRandom(others);
    this.animalKey = Phaser.Utils.Array.GetRandom(ANIMAL_KEYS.filter((key) => key !== this.animalKey));
    this.misses = 0;
    this.hintMs = 0;
  }

  input(id, { faces, directions }) {
    for (const key of faces) this.look(this.spots.find((spot) => spot.button === key));
    for (const direction of directions) this.look(this.spots.find((spot) => spot.direction === direction));
  }

  click({ x, y }) {
    const spot = this.spots.find((s) => Math.abs(s.x - x) < SPOT_W / 2 && Math.abs(s.y - y) < SPOT_W / 2);
    if (spot) this.look(spot);
    return Boolean(spot);
  }

  // Busca detrás de una cosa: si ahí está, se asoma; si no, la cosa se menea (y después de dos, la buena se mueve tantito).
  look(spot) {
    if (!spot || this.peeking) return;
    const { scene } = this;
    scene.tweens.add({
      targets: spot.container,
      angle: { from: -6, to: 6 },
      duration: 90,
      yoyo: true,
      repeat: 2,
      onComplete: () => spot.container.setAngle(0),
    });
    if (spot !== this.hidingSpot) {
      sfx.select();
      this.misses += 1;
      if (this.misses >= 2) this.wiggleHint();
      return;
    }
    this.peek(spot);
  }

  wiggleHint() {
    const { container } = this.hidingSpot;
    this.scene.tweens.add({ targets: container, y: container.y - 14, duration: 140, yoyo: true, repeat: 1 });
  }

  // ¡Cucú! El animalito sale de atrás, hace su sonido y se vuelve a esconder (en otro lado).
  peek(spot) {
    const { scene } = this;
    this.peeking = true;
    this.found += 1;
    const info = ANIMALS[this.animalKey];
    const texture = animalTexture(scene, this.animalKey);
    const body = texture
      ? scene.add.image(0, 0, texture).setScale(190 / Math.max(scene.textures.get(texture).getSourceImage().height, 1))
      : scene.add.text(0, 0, info.emoji, textStyle(120)).setOrigin(0.5);
    const animal = scene.add.container(spot.x, spot.y + 20, [body]).setDepth(DEPTH.animal);
    // Si se esconde arriba, se asoma hacia abajo un poquito de lado; si no, sale por arriba.
    const up = spot.direction === 'up' ? -110 : -150;
    sfx.boing();
    scene.tweens.add({
      targets: animal,
      y: spot.y + up,
      duration: 380,
      ease: 'Back.easeOut',
      onComplete: () => {
        info.cry();
        const singing = animalTexture(scene, this.animalKey, true);
        if (singing && body.setTexture) body.setTexture(singing);
        say(`¡Cucú! ¡${info.name}!`);
        burst(scene, spot.x, spot.y - 60, 0xffc93c, 14);
        scene.tweens.add({ targets: body, scaleY: body.scaleY * 1.08, duration: 160, yoyo: true, repeat: 3 });
      },
    });
    scene.time.delayedCall(PEEK_MS, () => {
      scene.tweens.add({
        targets: animal,
        y: spot.y + 20,
        duration: 320,
        ease: 'Back.easeIn',
        onComplete: () => {
          animal.destroy();
          this.peeking = false;
          this.hide();
        },
      });
    });
  }

  update(dt) {
    // Si nadie lo encuentra un rato, la cosa donde está se mueve tantito.
    this.hintMs += dt;
    if (this.hintMs >= HINT_EVERY_MS && !this.peeking) {
      this.hintMs = 0;
      this.wiggleHint();
    }
  }

  destroy() {
    for (const spot of this.spots) {
      this.scene.tweens.killTweensOf(spot.container);
      spot.container.destroy();
    }
  }
}

// ---------- Globos con números ----------
const BALLOONS = 10;
const NUMBER_WORDS = ['Uno', 'Dos', 'Tres', 'Cuatro', 'Cinco', 'Seis', 'Siete', 'Ocho', 'Nueve', 'Diez'];
const BALLOON_COLORS = [0xff5a5f, 0xff9a3c, 0xffc93c, 0x4cd97b, 0x3fa7ff, 0xb07cff, 0xff7ad9, 0x5fd6c8, 0xff8fa3, 0x9bdc5a];
const NEXT_ROUND_MS = 2600;
const POP_GAP_MS = 250;

export class Balloons {
  constructor(scene) {
    this.scene = scene;
    this.balloons = [];
    this.next = 0;
    this.lastPopAt = -Infinity;
    this.rounds = 0;
    this.create();
    say('¡Vamos a contar!');
  }

  // 10 globos en dos filas de 5, del 1 al 10 (de izquierda a derecha, arriba y luego abajo).
  create() {
    const { scene } = this;
    const colors = Phaser.Utils.Array.Shuffle([...BALLOON_COLORS]);
    this.balloons = Array.from({ length: BALLOONS }, (_, i) => {
      const x = 240 + (i % 5) * 200;
      const y = i < 5 ? 250 : 480;
      const color = colors[i];
      const string = scene.add.line(0, 0, 0, 62, 6, 140, 0xffffff, 0.8).setOrigin(0, 0).setLineWidth(3);
      const knot = scene.add.triangle(0, 64, -10, 10, 10, 10, 0, -4, color).setStrokeStyle(3, COLORS.ink);
      const body = scene.add.ellipse(0, 0, 112, 132, color).setStrokeStyle(5, COLORS.ink);
      const shine = scene.add.ellipse(-24, -30, 26, 40, 0xffffff, 0.55).setAngle(-25);
      const number = scene.add.text(0, 2, String(i + 1), textStyle(56, '#ffffff', { fontStyle: 'bold', stroke: INK, strokeThickness: 8 })).setOrigin(0.5);
      const balloon = scene.add.container(x, y + 400, [string, knot, body, shine, number]).setDepth(DEPTH.balloon);
      scene.tweens.add({ targets: balloon, y, duration: 700, ease: 'Back.easeOut', delay: i * 70 });
      scene.tweens.add({ targets: balloon, angle: { from: -5, to: 5 }, duration: 900 + i * 37, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      return { container: balloon, color, popped: false };
    });
    this.next = 0;
  }

  input(id, { faces, directions, fireworks }) {
    if (faces.length || directions.length || fireworks.length) this.pop();
  }

  click() {
    this.pop();
    return true;
  }

  // Revienta el globo que sigue y la voz dice su número.
  pop() {
    const { scene } = this;
    if (this.next >= BALLOONS || scene.time.now - this.lastPopAt < POP_GAP_MS) return;
    this.lastPopAt = scene.time.now;
    const balloon = this.balloons[this.next];
    this.next += 1;
    balloon.popped = true;
    const { x, y } = balloon.container;
    scene.tweens.killTweensOf(balloon.container);
    balloon.container.destroy();
    sfx.pop();
    burst(scene, x, y, balloon.color, 16);
    const big = scene.add.text(640, 380, String(this.next), textStyle(220, hexToCss(balloon.color), { fontStyle: 'bold', stroke: INK, strokeThickness: 14 }));
    big.setOrigin(0.5).setDepth(DEPTH.fx).setScale(0.3);
    scene.tweens.add({ targets: big, scale: 1, duration: 260, ease: 'Back.easeOut' });
    scene.tweens.add({ targets: big, alpha: 0, y: 300, delay: 500, duration: 400, onComplete: () => big.destroy() });
    say(`¡${NUMBER_WORDS[this.next - 1]}!`);
    if (this.next < BALLOONS) return;
    // ¡Hasta el diez! Fiesta y otra vez.
    this.rounds += 1;
    rewards.earn('bebe-cuenta');
    scene.time.delayedCall(700, () => {
      sfx.win();
      say('¡Contaste hasta el diez!');
      for (let i = 0; i < 4; i += 1) scene.time.delayedCall(i * 220, () => scene.firework({ x: 280 + i * 240, y: 300 }));
    });
    scene.time.delayedCall(NEXT_ROUND_MS, () => {
      if (this.destroyed) return;
      this.create();
    });
  }

  update() {}

  destroy() {
    this.destroyed = true;
    for (const balloon of this.balloons) {
      if (balloon.popped) continue;
      this.scene.tweens.killTweensOf(balloon.container);
      balloon.container.destroy();
    }
  }
}

// ---------- A pintar ----------
const BRUSH_RADIUS = 32;
const BRUSH_SIZE = 26;
const STAMP_SIZE = 150;

// El pincel: un círculo blanco (se pinta del color que toque).
function brushTexture(scene) {
  const key = 'baby:pincel';
  if (scene.textures.exists(key)) return key;
  const element = document.createElement('canvas');
  element.width = BRUSH_RADIUS * 2;
  element.height = BRUSH_RADIUS * 2;
  const ctx = element.getContext('2d');
  ctx.beginPath();
  ctx.arc(BRUSH_RADIUS, BRUSH_RADIUS, BRUSH_RADIUS - 1, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  scene.textures.addCanvas(key, element);
  return key;
}

export class Painting {
  constructor(scene) {
    this.scene = scene;
    const { width, height } = scene.scale;
    this.canvas = scene.add.renderTexture(0, 0, width, height).setOrigin(0).setDepth(DEPTH.canvas);
    this.brush = brushTexture(scene);
    this.dirty = false;
    this.strokes = 0;
    this.last = new Map();
    this.colorIndex = new Map();
    this.title = scene.add
      .text(width / 2, 100, '🖍️ ¡A pintar! Mueve el stick', textStyle(30, TEXT.normal, { fontStyle: 'bold', stroke: INK, strokeThickness: 6 }))
      .setOrigin(0.5)
      .setDepth(DEPTH.ui);
    this.pointerDown = false;
    say('¡A pintar!');
  }

  // Pinta un caminito (sin huecos) del último punto del pincel hasta (x, y).
  paint(owner, x, y) {
    const last = this.last.get(owner);
    const index = (this.colorIndex.get(owner) ?? Math.floor(Math.random() * RAINBOW.length)) + 0.08;
    this.colorIndex.set(owner, index);
    const tint = RAINBOW[Math.floor(index) % RAINBOW.length];
    const scale = BRUSH_SIZE / BRUSH_RADIUS;
    if (last) {
      const steps = Math.max(1, Math.ceil(Math.hypot(x - last.x, y - last.y) / 8));
      for (let k = 1; k <= steps; k += 1)
        this.canvas.stamp(this.brush, null, last.x + ((x - last.x) * k) / steps, last.y + ((y - last.y) * k) / steps, { tint, scale });
    } else {
      this.canvas.stamp(this.brush, null, x, y, { tint, scale });
    }
    this.last.set(owner, { x, y });
    this.dirty = true;
    this.strokes += 1;
  }

  input(id, { faces, fireworks, moving, friend }) {
    if (moving && friend) this.paint(id, friend.blob.x, friend.blob.y + friend.blob.radius * 0.6);
    else this.last.delete(id);
    for (const key of faces) this.stampShape(key, friend?.blob ?? { x: 640, y: 360 });
    if (fireworks.some((key) => key === 'lb' || key === 'rb')) this.clear();
  }

  // Un sellito: la figura con carita del color del botón.
  stampShape(key, { x, y }) {
    const kinds = ['circle', 'star', 'square', 'flower', 'heart', 'triangle'];
    const shape = shapeTexture(this.scene, Phaser.Utils.Array.GetRandom(kinds), BUTTON_COLORS[key], '');
    this.canvas.stamp(shape, null, x, y - 60, { scale: STAMP_SIZE / (SHAPE_RADIUS * 2), originY: shapeOrigin.y });
    this.dirty = true;
    sfx.pop();
    burst(this.scene, x, y - 60, BUTTON_COLORS[key], 8);
  }

  clear() {
    if (!this.strokes) return;
    this.strokes = 0;
    this.canvas.clear();
    this.dirty = true;
    sfx.sparkle();
    say('¡A limpiar!');
  }

  // Con el mouse o el dedo también se pinta (arrastrando).
  click({ x, y }) {
    this.pointerDown = true;
    this.paint('pointer', x, y);
    return true;
  }

  pointerMove({ x, y }, down) {
    if (!down) {
      this.last.delete('pointer');
      return;
    }
    this.paint('pointer', x, y);
  }

  update() {
    if (!this.dirty) return;
    this.dirty = false;
    this.canvas.render();
  }

  destroy() {
    this.canvas.destroy();
    this.title.destroy();
  }
}
