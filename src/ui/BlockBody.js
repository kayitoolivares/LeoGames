import Phaser from 'phaser';
import { frameDelta } from '../shared/clock.js';
import { NUMBERS, OCTO, RAINBOW } from '../games/smash/bloquecito.js';
import { COLORS, textStyle } from './style.js';

// Medidas en bloques (1 = el lado de un bloque, `unit` px).
const LEG = 0.36; // largo de las piernas
const MAX_ROWS = 6; // los números más altos que esto (el 7) usan bloques un poco más chicos, para no ser tan altos
const SLIDE_RATE = 0.018; // qué tan rápido se acomodan los bloques al cambiar de forma (por ms)
const POP_MS = 150; // lo que tarda un bloque en aparecer o irse
const POP_GAP_MS = 45; // entre un bloque y el siguiente
const COLOR_GAP_MS = 25;
const BLINK_EVERY_MS = 3400;
const BLINK_MS = 130;
const ROLL_SPEED = 0.9; // grados por ms al rodar (el dado del 6)
const MOUTH = 0x5a1530;
const TONGUE = 0xff7a9c;
const TEN_RED = 0xe8332a;
const CAPE = 0xe53935;
const MASK = 0x26305e;
// Otra forma para un número: el 4 se vuelve cuadrado en su truco.
const SHAPES = { square: [2, 2] };

// El cuerpo de Bloquecito: bloques de colores con cara, brazos y piernas, dibujados con figuras.
// Al cambiar de número los bloques se acomodan solos: los que faltan aparecen uno por uno y los que
// sobran se van. Los pies quedan en (0, 0) y el cuerpo crece hacia arriba. Hay que llamar render()
// en cada cuadro con la pose (normal | caminar | salto | golpe | patada | cubrirse | especial | dolor | gana).
export class BlockBody extends Phaser.GameObjects.Container {
  constructor(scene, { unit, form = 1 }) {
    super(scene, 0, 0);
    this.unit = unit;
    this.g = scene.add.graphics();
    const discR = Math.max(11, unit * 0.32);
    this.discR = discR;
    this.discText = scene.add
      .text(0, 0, '', textStyle(Math.round(discR * 1.3), '#1b1530', { fontStyle: 'bold' }))
      .setOrigin(0.5, 0.52);
    this.disc = scene.add.container(0, 0, [
      scene.add.circle(0, 0, discR, 0xffffff, 0.9).setStrokeStyle(Math.max(2, unit * 0.07), COLORS.ink),
      this.discText,
    ]);
    this.add([this.g, this.disc]);
    this.blocks = [];
    this.form = null;
    this.shape = null;
    this.pose = 'normal';
    this.action = null;
    this.facing = 1;
    this.walkStep = 0;
    this.clock = Math.random() * 1000;
    this.flashMs = 0;
    this.tint = null;
    this.rollAngle = 0;
    this.setForm(form, { animate: false });
    this.draw();
  }

  // Cambia de número (o a Octobloque). `shape` = otra forma del mismo número ('square').
  setForm(form, { animate = true, shape = null } = {}) {
    if (form === this.form && shape === this.shape) return;
    this.form = form;
    this.shape = shape;
    this.target = layout(form, shape, this.unit);
    const kept = this.blocks.filter((b) => !b.leaving);
    kept.forEach((b, i) => {
      const t = this.target.list[i];
      if (t) {
        Object.assign(b, { tx: t.x, ty: t.y, tsize: t.size, nextColor: t.color, colorMs: animate ? i * COLOR_GAP_MS : 0 });
      } else {
        // Los que sobran se van de arriba hacia abajo.
        b.leaving = true;
        b.delay = animate ? (kept.length - 1 - i) * POP_GAP_MS : 0;
      }
    });
    // Los que faltan aparecen en su lugar, uno tras otro, creciendo desde nada.
    for (let i = kept.length; i < this.target.list.length; i += 1) {
      const t = this.target.list[i];
      this.blocks.push({ x: t.x, y: t.y, size: t.size, tx: t.x, ty: t.y, tsize: t.size, color: t.color, nextColor: t.color, colorMs: 0, scale: 0, delay: animate ? (i - kept.length) * POP_GAP_MS : 0 });
    }
    if (!animate) {
      this.blocks = this.blocks.filter((b) => !b.leaving);
      for (const b of this.blocks) Object.assign(b, { x: b.tx, y: b.ty, size: b.tsize, color: b.nextColor, scale: 1, delay: 0 });
    }
    this.discText.setText(form === OCTO ? '8' : String(form));
  }

  // Alto y ancho de la forma ya acomodada (sin contar el número de arriba), en px.
  get height() {
    return this.target.height;
  }

  get width() {
    return this.target.width;
  }

  // Dónde quedan los hombros, medido desde los pies (negativo = arriba).
  get shoulder() {
    const t = this.target;
    return -t.height + t.size * (t.rows === 1 ? 0.6 : 1.05);
  }

  // Lo más alto del dibujo (con el número de arriba), como va en este momento. Para poner letreros encima.
  get top() {
    return (this.bounds?.top ?? -this.target.height) - this.discR * 2 - this.unit * 0.25;
  }

  flash(ms = 70) {
    this.flashMs = ms;
  }

  // Pinta todos los bloques de un color (la estrella de Bolitas Bros), o null para quitarlo.
  setTint(color) {
    this.tint = color;
  }

  // action: el truco que está haciendo, para dibujarlo (square | roll | octo | rocket | charge).
  render(pose, facing, { action = null, walkStep = 0 } = {}) {
    const dt = frameDelta();
    this.pose = pose;
    this.facing = facing < 0 ? -1 : 1;
    this.action = action;
    this.walkStep = walkStep;
    this.clock += dt;
    this.flashMs = Math.max(0, this.flashMs - dt);
    const shape = action === 'square' && this.form === 4 ? 'square' : null;
    if (shape !== this.shape) this.setForm(this.form, { shape });
    this.rollAngle = action === 'roll' ? this.rollAngle + ROLL_SPEED * dt * this.facing : 0;
    this.animate(dt);
    this.draw();
  }

  animate(dt) {
    const k = 1 - Math.exp(-dt * SLIDE_RATE);
    for (const b of this.blocks) {
      if (b.delay > 0) {
        b.delay -= dt;
        continue;
      }
      b.x += (b.tx - b.x) * k;
      b.y += (b.ty - b.y) * k;
      b.size += (b.tsize - b.size) * k;
      b.scale = b.leaving ? Math.max(0, b.scale - dt / POP_MS) : Math.min(1, b.scale + dt / POP_MS);
      b.colorMs -= dt;
      if (b.colorMs <= 0) b.color = b.nextColor;
    }
    this.blocks = this.blocks.filter((b) => !(b.leaving && b.scale <= 0));
  }

  draw() {
    const g = this.g;
    g.clear();
    const live = this.blocks.filter((b) => b.delay <= 0 && b.scale > 0.01);
    this.disc.setVisible(live.length > 0);
    if (live.length === 0) return;
    const u = this.unit;
    const f = this.facing;
    const look = NUMBERS[this.form].look;
    const size = this.target.size;

    // La caja de los bloques como van ahora (mientras se acomodan se mueve con ellos).
    let left = Infinity;
    let right = -Infinity;
    let top = Infinity;
    for (const b of live) {
      const half = (b.size * pop(b)) / 2;
      left = Math.min(left, b.x - half);
      right = Math.max(right, b.x + half);
      top = Math.min(top, b.y - half);
    }
    const bottom = -LEG * u;
    const cx = (left + right) / 2;
    const width = right - left;
    const rows = Math.max(1, Math.round((bottom - top) / size));
    this.bounds = { left, right, top, bottom };
    this.disc.setPosition(cx, top - this.discR - u * 0.15);

    const ink = Math.max(2, u * 0.08);
    const white = Math.max(2, u * 0.09);
    const flash = this.flashMs > 0;
    const paint = (color) => (flash ? 0xffffff : (this.tint ?? color));
    const topColor = paint(live.reduce((a, b) => (b.y < a.y ? b : a)).color);
    const limbColor = flash ? 0xffffff : look === 'ten' ? TEN_RED : shade(topColor, 0.82);
    const legColor = flash ? 0xffffff : look === 'ten' ? TEN_RED : shade(paint(live[0].color), 0.78);

    // Rodando (el dado del 6), todo gira alrededor del centro del cuerpo.
    const midY = (top + bottom) / 2;
    g.save();
    if (this.rollAngle !== 0) {
      g.translateCanvas(cx, midY);
      g.rotateCanvas(Phaser.Math.DegToRad(this.rollAngle));
      g.translateCanvas(-cx, -midY);
    }

    const limbs = this.limbs({ cx, top, bottom, width, size, rows, look, limbColor, legColor });
    if (look === 'hero') this.drawCape({ cx, top, bottom, width, size, ink, white });
    if (this.action === 'rocket') this.drawFlames(cx, width);

    // Calcomanía: primero todo en blanco (más grueso), luego el contorno negro y luego los colores.
    const behind = limbs.filter((l) => !l.front);
    const front = limbs.filter((l) => l.front);
    for (const limb of behind) drawLimb(g, limb, ink + white, 0xffffff);
    for (const b of live) fillBlock(g, b, ink + white, 0xffffff);
    for (const limb of behind) drawLimb(g, limb, ink, COLORS.ink);
    for (const b of live) fillBlock(g, b, ink, COLORS.ink);
    for (const limb of behind) drawLimb(g, limb, 0, limb.color, true);
    for (const b of live) this.drawBlock(b, look, paint, top, size);

    const face = this.drawFace({ cx, top, width, size, rows, look, ink, live });
    this.drawExtras({ cx, top, width, size, rows, look, ink, live, face, paint });
    for (const limb of front) {
      drawLimb(g, limb, ink, COLORS.ink);
      drawLimb(g, limb, 0, limb.color, true);
    }
    g.restore();
  }

  drawBlock(b, look, paint, top, size) {
    const g = this.g;
    const s = b.size * pop(b);
    const x = b.x - s / 2;
    const y = b.y - s / 2;
    const color = paint(b.color);
    g.fillStyle(color, 1);
    g.fillRect(x, y, s, s);
    // Un brillito arriba y una orilla más oscura: así se ve como un bloque de juguete.
    g.fillStyle(0xffffff, 0.22);
    g.fillRect(x + s * 0.08, y + s * 0.07, s * 0.84, s * 0.12);
    if (look === 'ten' && !this.tint && this.flashMs <= 0) {
      g.lineStyle(Math.max(2, s * 0.09), TEN_RED, 1);
      g.strokeRect(x + s * 0.045, y + s * 0.045, s * 0.91, s * 0.91);
    } else {
      g.lineStyle(Math.max(1, s * 0.035), shade(color, 0.78), 1);
      g.strokeRect(x + s * 0.02, y + s * 0.02, s * 0.96, s * 0.96);
    }
    // El 6 es un dado: un punto en cada bloque de abajo (arriba va la cara).
    if (look === 'dice' && b.y - s / 2 > top + size * 0.5) {
      g.fillStyle(0xffffff, 0.9);
      g.fillCircle(b.x, b.y, s * 0.13);
    }
  }

  // Brazos y piernas: listas de puntos (de donde salen hasta la mano o el pie) con su grosor y color.
  limbs({ cx, top, bottom, width, size, rows, look, limbColor, legColor }) {
    const u = this.unit;
    const f = this.facing;
    const pose = this.pose;
    const t = this.clock;
    const list = [];
    const walk = (this.walkStep / 4) * Math.PI * 2;

    // Piernas.
    const legX = Math.min(width * 0.28, u * 0.27);
    for (const side of [-1, 1]) {
      const isFront = side === f;
      let dx = 0;
      let lift = 0;
      if (pose === 'caminar') {
        const phase = walk + (isFront ? 0 : Math.PI);
        dx = Math.sin(phase) * u * 0.17 * f;
        lift = Math.max(0, Math.cos(phase)) * u * 0.1;
      } else if (pose === 'salto') {
        lift = u * 0.14;
        dx = side * u * 0.04;
      } else if (pose === 'dolor') {
        dx = side * u * 0.1;
      }
      const hip = [cx + side * legX, bottom - u * 0.05];
      let foot = [hip[0] + dx, -lift - u * 0.06];
      if (pose === 'patada' && isFront) foot = [hip[0] + f * u * 0.78, bottom - u * 0.12];
      list.push({ points: [hip, foot], width: Math.max(3, u * 0.17), color: legColor, end: 'shoe', facing: f });
    }

    // Brazos: ángulo en grados desde "hacia abajo" (positivo = hacia afuera, negativo = cruzando por enfrente).
    const many = look === 'octopus' ? 3 : look === 'hero' ? 4 : 1;
    const spacing = many > 1 ? Math.min(size * 0.55, (-top - u * LEG) / (many + 1)) : 0;
    const shoulderY = top + size * (rows === 1 ? 0.6 : many > 1 ? 0.75 : 1.05);
    const len = u * (rows === 1 ? 0.45 : 0.55) * (many > 1 ? 1.15 : 1);
    const sway = Math.sin(t / 420) * 4;
    let front = 28 + sway;
    let back = 28 + sway;
    let reach = 1;
    let inFront = false;
    if (pose === 'caminar') {
      const swing = Math.sin(walk) * 26;
      front = 22 + swing;
      back = 22 - swing;
    } else if (pose === 'salto') {
      front = back = 140;
    } else if (pose === 'golpe') {
      front = 90;
      back = 35;
      reach = this.action === 'charge' ? 2 : 1.6;
    } else if (pose === 'patada') {
      front = back = 55;
    } else if (pose === 'cubrirse') {
      front = back = -80;
      inFront = true;
    } else if (pose === 'especial') {
      front = 115;
      back = 135;
      if (this.action === 'charge') {
        front = 90;
        reach = 2;
      }
    } else if (pose === 'dolor') {
      front = 150 + Math.sin(t / 60) * 15;
      back = 150 - Math.sin(t / 60) * 15;
    } else if (pose === 'gana') {
      front = back = 160 + Math.sin(t / 120) * 12;
    }
    const whirl = this.action === 'octo';
    for (const side of [-1, 1]) {
      const isFront = side === f;
      for (let k = 0; k < many; k += 1) {
        let angle = isFront ? front : back;
        // Los tentáculos se abren en abanico y se mueven solos; con los ocho brazos dan vueltas.
        if (many > 1) angle += (k - (many - 1) / 2) * 22 + Math.sin(t / 200 + k * 1.7 + side) * 10;
        if (whirl) angle = (t * 0.9 + k * (360 / many) + (side > 0 ? 0 : 180)) % 360;
        const armReach = isFront && k === 0 ? reach : 1;
        const sx = cx + side * (width / 2 - u * 0.04);
        const sy = shoulderY + k * spacing;
        const rad = Phaser.Math.DegToRad(angle);
        const end = [sx + side * Math.sin(rad) * len * armReach, sy + Math.cos(rad) * len * armReach];
        // Los tentáculos se doblan a la mitad.
        const points = [[sx, sy]];
        if (many > 1) {
          const bend = Math.sin(t / 160 + k + side) * len * 0.25;
          points.push([(sx + end[0]) / 2 + bend * 0.3, (sy + end[1]) / 2 + bend]);
        }
        points.push(end);
        let hand = 'hand';
        if (look === 'star' && isFront) hand = 'star';
        else if (look === 'ten') hand = 'glove';
        else if (many > 1) hand = 'tip';
        const handScale = isFront && k === 0 && this.action === 'charge' ? 1.6 : 1;
        list.push({ points, width: Math.max(3, u * (many > 1 ? 0.14 : 0.15)), color: limbColor, end: hand, handScale, front: inFront, dots: many > 1 });
      }
    }
    return list;
  }

  // La cara va en los bloques de arriba: ojos, boca y (según el número) cejas o pestañas.
  drawFace({ cx, top, width, size, rows, look, ink, live }) {
    const g = this.g;
    const f = this.facing;
    const cols = Math.max(1, Math.round(width / size));
    const cyclops = look === 'cyclops';
    const eyeR = size * (cyclops ? 0.26 : cols === 1 ? 0.17 : cols === 2 ? 0.2 : 0.23);
    const gap = cyclops ? 0 : size * (cols === 1 ? 0.22 : cols === 2 ? 0.45 : 0.62);
    const faceX = cx + f * size * 0.06;
    const eyeY = top + size * 0.42;
    const eyes = cyclops ? [faceX] : [faceX - gap, faceX + gap];
    const pose = this.pose;
    const hurt = pose === 'dolor';
    const blink = !hurt && this.clock % BLINK_EVERY_MS < BLINK_MS;
    const lookY = pose === 'salto' || pose === 'gana' ? -0.3 : 0;

    // Octobloque trae antifaz: va detrás de los ojos.
    if (look === 'hero') {
      g.fillStyle(MASK, 1);
      g.fillRoundedRect(cx - width / 2 + size * 0.06, eyeY - eyeR * 1.35, width - size * 0.12, eyeR * 2.7, eyeR * 0.8);
      for (const side of [-1, 1]) {
        g.fillTriangle(cx + side * (width / 2 - size * 0.06), eyeY - eyeR * 0.6, cx + side * (width / 2 + size * 0.22), eyeY - eyeR * 1.4, cx + side * (width / 2 - size * 0.06), eyeY + eyeR * 0.4);
      }
    }

    g.lineStyle(Math.max(1.5, ink * 0.8), COLORS.ink, 1);
    for (const x of eyes) {
      if (hurt) {
        // Ojos apretados: > <
        const d = x < faceX || cyclops ? 1 : -1;
        g.lineStyle(Math.max(2, eyeR * 0.35), COLORS.ink, 1);
        g.lineBetween(x - eyeR * 0.6 * d, eyeY - eyeR * 0.6, x + eyeR * 0.5 * d, eyeY);
        g.lineBetween(x + eyeR * 0.5 * d, eyeY, x - eyeR * 0.6 * d, eyeY + eyeR * 0.6);
      } else if (blink) {
        g.lineStyle(Math.max(2, eyeR * 0.3), COLORS.ink, 1);
        g.lineBetween(x - eyeR, eyeY, x + eyeR, eyeY);
      } else {
        g.fillStyle(0xffffff, 1);
        g.fillEllipse(x, eyeY, eyeR * 2, eyeR * 2.3);
        g.strokeEllipse(x, eyeY, eyeR * 2, eyeR * 2.3);
        g.fillStyle(COLORS.ink, 1);
        g.fillCircle(x + f * eyeR * 0.3, eyeY + lookY * eyeR, eyeR * 0.5);
        g.fillStyle(0xffffff, 1);
        g.fillCircle(x + f * eyeR * 0.3 - eyeR * 0.15, eyeY + lookY * eyeR - eyeR * 0.18, eyeR * 0.15);
      }
    }

    // Boca: sonrisa con lengüita; con dolor, una "o"; ganando, más grande.
    const mouthR = size * (cols === 1 ? 0.15 : 0.2) * (pose === 'gana' || look === 'big' ? 1.25 : 1);
    const mouthY = top + size * (rows === 1 ? 0.74 : 0.92);
    g.fillStyle(MOUTH, 1);
    if (hurt) {
      g.fillEllipse(faceX, mouthY + mouthR * 0.3, mouthR * 1.1, mouthR * 1.4);
    } else {
      g.slice(faceX, mouthY - mouthR * 0.2, mouthR, 0, Math.PI, false);
      g.fillPath();
      g.fillStyle(TONGUE, 1);
      g.fillEllipse(faceX, mouthY + mouthR * 0.42, mouthR * 0.8, mouthR * 0.45);
    }
    return { eyes, eyeY, eyeR, faceX };
  }

  // Lo que distingue a cada número: lentes, corona, cejas, pestañas...
  drawExtras({ cx, top, width, size, rows, look, ink, live, face, paint }) {
    const g = this.g;
    const { eyes, eyeY, eyeR } = face;
    const outline = Math.max(1.5, ink * 0.9);
    if (look === 'glasses') {
      g.lineStyle(Math.max(2, eyeR * 0.28), 0x8e44ad, 1);
      for (const x of eyes) g.strokeCircle(x, eyeY, eyeR * 1.3);
      g.lineBetween(eyes[0] + eyeR * 1.3, eyeY, eyes[1] - eyeR * 1.3, eyeY);
    } else if (look === 'crown') {
      // Corona de bufón con bolitas en las puntas, y tres botones rojos en la panza.
      const w = size * 0.48;
      const h = size * 0.55;
      const pts = [
        [-w, 0], [-w * 1.1, -h], [-w * 0.45, -h * 0.45], [0, -h * 1.15], [w * 0.45, -h * 0.45], [w * 1.1, -h], [w, 0],
      ].map(([x, y]) => ({ x: cx + x, y: top + y + size * 0.04 }));
      g.fillStyle(paint(0xe53935), 1);
      g.fillPoints(pts, true);
      g.lineStyle(outline, COLORS.ink, 1);
      g.strokePoints(pts, true);
      for (const p of [pts[1], pts[3], pts[5]]) {
        g.fillStyle(0xffd02a, 1);
        g.fillCircle(p.x, p.y, size * 0.09);
        g.strokeCircle(p.x, p.y, size * 0.09);
      }
      if (rows > 1) {
        g.fillStyle(0xe53935, 1);
        for (let k = 0; k < 3; k += 1) g.fillCircle(cx, top + size * (1.35 + k * 0.5 * Math.min(1, (rows - 1) / 2)), size * 0.07);
      }
    } else if (look === 'brows' || look === 'big' || look === 'star') {
      const thick = look === 'big' ? 0.5 : look === 'brows' ? 0.42 : 0.28;
      const color = look === 'big' ? 0x3a3f4a : shade(paint(NUMBERS[this.form].color), 0.5);
      g.lineStyle(Math.max(2, eyeR * thick), color, 1);
      for (const x of eyes) {
        const side = x < face.faceX ? -1 : 1;
        g.lineBetween(x - eyeR * 0.95, eyeY - eyeR * (1.55 + 0.15 * side), x + eyeR * 0.95, eyeY - eyeR * (1.55 - 0.15 * side));
      }
    } else if (look === 'dice') {
      // Pestañas.
      g.lineStyle(Math.max(1.5, eyeR * 0.2), 0xff4d7a, 1);
      for (const x of eyes) {
        for (const a of [-0.6, 0, 0.6]) g.lineBetween(x + Math.sin(a) * eyeR, eyeY - Math.cos(a) * eyeR * 1.15, x + Math.sin(a) * eyeR * 1.6, eyeY - Math.cos(a) * eyeR * 1.7);
      }
    } else if (look === 'rainbow') {
      // Lentes amarillos y pelo de arcoíris.
      g.lineStyle(Math.max(2, eyeR * 0.28), 0xffd02a, 1);
      for (const x of eyes) g.strokeRoundedRect(x - eyeR * 1.3, eyeY - eyeR * 1.35, eyeR * 2.6, eyeR * 2.7, eyeR * 0.5);
      g.lineBetween(eyes[0] + eyeR * 1.3, eyeY, eyes[1] - eyeR * 1.3, eyeY);
      RAINBOW.slice(1, 6).forEach((color, k) => {
        const x = cx + (k - 2) * size * 0.18;
        g.lineStyle(Math.max(3, size * 0.12), COLORS.ink, 1);
        g.lineBetween(x, top + size * 0.05, x + (k - 2) * size * 0.06, top - size * 0.32);
        g.lineStyle(Math.max(2, size * 0.08), color, 1);
        g.lineBetween(x, top + size * 0.05, x + (k - 2) * size * 0.06, top - size * 0.32);
      });
    } else if (look === 'octopus') {
      // Cejotas cafés y peludas.
      g.lineStyle(Math.max(2, eyeR * 0.35), 0x6b3a1e, 1);
      for (const x of eyes) {
        const pts = [];
        for (let k = 0; k <= 4; k += 1) pts.push({ x: x - eyeR * 1.1 + (k * eyeR * 2.2) / 4, y: eyeY - eyeR * (1.45 + (k % 2) * 0.35) });
        g.strokePoints(pts);
      }
    } else if (look === 'ten') {
      // Lentes de estrella roja.
      g.lineStyle(Math.max(2, eyeR * 0.3), TEN_RED, 1);
      for (const x of eyes) g.strokePoints(starPoints(x, eyeY, eyeR * 1.05, eyeR * 1.85), true);
    } else if (look === 'hero') {
      // Un 8 dorado en el pecho.
      const y = top + size * 1.6;
      g.lineStyle(Math.max(2, size * 0.1), 0xffd84d, 1);
      g.strokeCircle(cx, y - size * 0.16, size * 0.14);
      g.strokeCircle(cx, y + size * 0.16, size * 0.18);
    }
  }

  // La capa de Octobloque: va detrás de todo y se mueve con el viento.
  drawCape({ cx, top, bottom, width, size, ink, white }) {
    const g = this.g;
    const f = this.facing;
    // Cuelga de los hombros y vuela hacia atrás (al lado contrario de donde mira).
    const wave = Math.sin(this.clock / 150) * size * 0.2;
    const pts = [
      { x: cx - width * 0.42, y: top + size * 0.7 },
      { x: cx + width * 0.42, y: top + size * 0.7 },
      { x: cx + f * width * 0.45, y: bottom - size * 0.05 },
      { x: cx - f * (width * 0.5 + size * 1.1) + wave, y: bottom - size * 0.45 + wave },
    ];
    g.lineStyle(ink + white * 2, 0xffffff, 1);
    g.strokePoints(pts, true);
    g.lineStyle(ink * 2, COLORS.ink, 1);
    g.strokePoints(pts, true);
    g.fillStyle(this.flashMs > 0 ? 0xffffff : CAPE, 1);
    g.fillPoints(pts, true);
  }

  // Fuego del cohete del 10 (sale por los pies).
  drawFlames(cx, width) {
    const g = this.g;
    const u = this.unit;
    const flicker = 0.8 + Math.random() * 0.4;
    for (const [color, w, h] of [[0xff9a3c, 0.5, 1.1], [0xffd84d, 0.32, 0.75], [0xffffff, 0.15, 0.4]]) {
      g.fillStyle(color, 0.95);
      g.fillTriangle(cx - width * w, 0, cx + width * w, 0, cx, u * h * flicker);
    }
  }
}

// Dónde va cada bloque (su centro, en px, con los pies en 0, 0), su tamaño y su color.
function layout(form, shape, unit) {
  const info = NUMBERS[form];
  const [cols, rows] = SHAPES[shape] ?? [info.cols, info.rows];
  const size = unit * Math.min(1, MAX_ROWS / rows);
  const count = form === OCTO ? 8 : form;
  const list = [];
  for (let i = 0; i < count; i += 1) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const color = info.look === 'rainbow' ? RAINBOW[Math.min(row, RAINBOW.length - 1)] : info.color;
    list.push({ x: (col - (cols - 1) / 2) * size, y: -(LEG * unit + (row + 0.5) * size), size, color });
  }
  return { cols, rows, size, width: cols * size, height: rows * size + LEG * unit, list };
}

// Al aparecer, el bloque crece un poquito de más y regresa (se ve como un "pop").
function pop(b) {
  if (b.leaving) return b.scale;
  const t = b.scale;
  return t >= 1 ? 1 : 1 + 2.2 * Math.pow(t - 1, 3) + 1.2 * Math.pow(t - 1, 2);
}

// Un bloque crecido `grow` px por lado (para el contorno blanco y el negro).
function fillBlock(g, b, grow, color) {
  const s = b.size * pop(b);
  g.fillStyle(color, 1);
  g.fillRect(b.x - s / 2 - grow, b.y - s / 2 - grow, s + grow * 2, s + grow * 2);
}

// Un brazo o pierna (con su mano o zapato), engordado `grow` px para los contornos.
function drawLimb(g, limb, grow, color, details = false) {
  const w = limb.width + grow * 2;
  g.lineStyle(w, color, 1);
  g.fillStyle(color, 1);
  for (let i = 1; i < limb.points.length; i += 1) {
    const [x1, y1] = limb.points[i - 1];
    const [x2, y2] = limb.points[i];
    g.lineBetween(x1, y1, x2, y2);
    g.fillCircle(x1, y1, w / 2);
  }
  const [ex, ey] = limb.points[limb.points.length - 1];
  const r = limb.width * 0.85 * (limb.handScale ?? 1);
  if (limb.end === 'shoe') {
    if (details) g.fillStyle(shade(color, 0.72), 1);
    g.fillEllipse(ex + limb.facing * limb.width * 0.45, ey, limb.width * 2.2 + grow * 2, limb.width * 1.15 + grow * 2);
  } else if (limb.end === 'star') {
    g.fillStyle(details ? 0x1f6fd1 : color, 1);
    g.fillPoints(starPoints(ex, ey, r * 0.75 + grow, r * 1.7 + grow), true);
  } else if (limb.end === 'glove') {
    g.fillStyle(details ? 0xffffff : color, 1);
    g.fillCircle(ex, ey, r * 1.15 + grow);
    if (details) {
      g.fillStyle(TEN_RED, 1);
      g.fillPoints(starPoints(ex, ey, r * 0.25, r * 0.65), true);
    }
  } else if (limb.end === 'tip') {
    g.fillCircle(ex, ey, w / 2);
  } else {
    g.fillCircle(ex, ey, r + grow);
  }
  // Los tentáculos tienen puntitos.
  if (details && limb.dots) {
    g.fillStyle(shade(color, 0.6), 1);
    const [sx, sy] = limb.points[0];
    for (const k of [0.45, 0.75]) g.fillCircle(sx + (ex - sx) * k, sy + (ey - sy) * k, limb.width * 0.22);
  }
}

function starPoints(x, y, inner, outer, points = 5) {
  const list = [];
  for (let i = 0; i < points * 2; i += 1) {
    const r = i % 2 === 0 ? outer : inner;
    const a = -Math.PI / 2 + (i * Math.PI) / points;
    list.push({ x: x + Math.cos(a) * r, y: y + Math.sin(a) * r });
  }
  return list;
}

// El mismo color, más oscuro (k < 1).
function shade(color, k) {
  const r = Math.round(((color >> 16) & 0xff) * k);
  const g = Math.round(((color >> 8) & 0xff) * k);
  const b = Math.round((color & 0xff) * k);
  return (r << 16) | (g << 8) | b;
}
