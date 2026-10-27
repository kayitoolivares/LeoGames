import Phaser from 'phaser';
import { controls } from '../../shared/controls.js';
import { frameDelta } from '../../shared/clock.js';
import { characterPicks } from '../../shared/picks.js';
import { players } from '../../shared/players.js';
import { rewards } from '../../shared/rewards.js';
import { sfx } from '../../shared/sound.js';
import { go } from '../../shared/transition.js';
import { say } from '../../shared/voice.js';
import { defaultCharacter } from '../../scenes/CharacterSelectScene.js';
import { Blob } from '../../ui/Blob.js';
import { CharacterLook } from '../../ui/CharacterLook.js';
import { COLORS, TEXT, hexToCss, textStyle } from '../../ui/style.js';
import { burst, confetti, fireworks, popText } from '../brawl/effects.js';
import { loadSmashArt } from '../smash/art.js';
import { golfBackground, golfObject, loadGolfArt } from './art.js';
import { COURSES, COURSE_KEYS, HOLES, WORLDS, onGrass } from './holes.js';
import { BALL_RADIUS, CUP_RADIUS, Course, GIANT_CUP, HUB_RADIUS, MAX_SHOT, predictPath, stepBall } from './physics.js';

// "Minigolf": por turnos, cada quien con su personaje de pelota. En tu turno: el stick apunta, mantén A para la fuerza
// (sube y baja) y suelta para tirar; LB / RB giran poquito la puntería y B cancela. La línea punteada enseña por dónde
// va a ir (se puede quitar). Recorridos: corto (3 hoyos), la Pradera (9), la Vuelta al mundo (playa, nieve y espacio,
// 9) o todos (18); gana el que use menos tiros.
// Minigolf loco: en cada hoyo hay cajas sorpresa; la pelota que pasa por una se lleva un poder y con X lo usa en su
// siguiente tiro (ver POWERS).
const MIN_SHOT = 90;
const POWER_PERIOD_MS = 1700;
const FINE_TURN = 1.6;
// Si no la mete en estos tiros de más del par, se acaba su hoyo.
const EXTRA_STROKES = 4;
const INTRO_MS = 1600;
const NEXT_TURN_MS = 700;
const INPUT_DELAY_MS = 900;
const EXIT_HOLD_MS = 1200;
const DEPTH = { course: 0, things: 5, ball: 20, aim: 30, hud: 100, screen: 200 };
const lastSetup = { course: 'corto', mode: 'normal', guide: true };
const SETUP_ROWS = 3;
// Los poderes del Minigolf loco (los de la pelota y el hoyo los hace physics.js).
const POWERS = {
  iman: { emoji: '🧲', name: '¡Hoyo imán!' },
  fantasma: { emoji: '👻', name: '¡Pelota fantasma!' },
  gigante: { emoji: '🕳️', name: '¡Hoyo gigante!' },
  hielo: { emoji: '❄️', name: '¡Todo congelado!' },
  regalo: { emoji: '🎁', name: '¡Tiro gratis!' },
};
const POWER_KEYS = Object.keys(POWERS);
const BALL_POWERS = ['iman', 'fantasma', 'gigante'];
const BOXES_PER_HOLE = 3;
const BOX_REACH = 30;
const BOX_SIZE = 46;
const FLAG_HEIGHT = 96;
const FLAG_POLE = 0.3;
// Lo que se ve de los animalitos si todavía no hay dibujo.
const CRITTER_EMOJI = { cangrejo: '🦀', pinguino: '🐧', ovni: '🛸' };
const RESULT = (strokes, par) => {
  if (strokes === 1) return '¡Hoyo en uno!';
  if (strokes <= par - 2) return '¡Águila!';
  if (strokes === par - 1) return '¡Birdie!';
  if (strokes === par) return '¡Par!';
  return `¡Adentro en ${strokes} tiros!`;
};

// Un color más oscuro (k < 1) o más claro (k > 1).
function shade(color, k) {
  const channel = (shift) => Math.min(255, Math.round(((color >> shift) & 0xff) * k));
  return (channel(16) << 16) | (channel(8) << 8) | channel(0);
}

// Distancia del punto (px, py) al segmento (x1, y1)-(x2, y2).
function segmentDistance(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(px - (x1 + dx * t), py - (y1 + dy * t));
}

export class GolfScene extends Phaser.Scene {
  constructor() {
    super('Golf');
  }

  init(data) {
    this.returnData = data ?? {};
    this.exitMs = 0;
    this.exiting = false;
  }

  preload() {
    loadSmashArt(this);
    loadGolfArt(this);
  }

  create() {
    const { width, height } = this.scale;
    this.ground = this.add.rectangle(0, 0, width, height, WORLDS.pradera.ground).setOrigin(0).setDepth(-10);
    this.setup = { ...lastSetup };
    this.humans = players.sorted();
    this.balls = this.humans.map((player) => ({
      player,
      deviceId: player.deviceId,
      label: `J${player.slot + 1}`,
      color: players.color(player).hex,
      character: characterPicks.get(player.deviceId, defaultCharacter(player)),
      scores: [],
      item: null,
    }));
    this.courseLayer = null;
    this.screen = null;
    this.boxes = [];
    this.aim = this.add.graphics().setDepth(DEPTH.aim);
    this.hudTitle = this.add
      .text(width / 2, 30, '', textStyle(30, TEXT.normal, { fontStyle: 'bold', stroke: '#1b1530', strokeThickness: 5 }))
      .setOrigin(0.5)
      .setDepth(DEPTH.hud);
    this.hudTurn = this.add
      .text(width / 2, 64, '', textStyle(22, TEXT.accent, { fontStyle: 'bold', stroke: '#1b1530', strokeThickness: 4 }))
      .setOrigin(0.5)
      .setDepth(DEPTH.hud);
    this.help = this.add
      .text(width / 2, height - 16, '', textStyle(16, TEXT.muted, { stroke: '#1b1530', strokeThickness: 3 }))
      .setOrigin(0.5)
      .setDepth(DEPTH.hud);
    this.showSetup();
  }

  // ---------- Antes de jugar: el recorrido, normal o loco, y la línea de ayuda ----------
  showSetup() {
    this.phase = 'setup';
    this.phaseMs = 0;
    this.clearCourse();
    this.screen?.destroy();
    const { width, height } = this.scale;
    this.screen = this.add.container(0, 0).setDepth(DEPTH.screen);
    this.screen.add(this.add.rectangle(width / 2, height / 2, width, height, 0x14112b, 0.85));
    this.screen.add(this.add.text(width / 2, 130, '⛳ Minigolf', textStyle(60, TEXT.normal, { fontStyle: 'bold' })).setOrigin(0.5));
    this.setupRow = 0;
    this.setupTexts = Array.from({ length: SETUP_ROWS }, (_, i) => {
      const bg = this.add.rectangle(width / 2, 250 + i * 70, 700, 56, COLORS.panel).setRounded(16);
      const text = this.add.text(width / 2, 250 + i * 70, '', textStyle(26, TEXT.normal, { fontStyle: 'bold' })).setOrigin(0.5);
      this.screen.add([bg, text]);
      return { bg, text };
    });
    const people = this.balls.map((b) => b.label).join(', ');
    this.screen.add(this.add.text(width / 2, 500, `Juegan: ${people}`, textStyle(24, TEXT.normal)).setOrigin(0.5));
    this.screen.add(this.add.text(width / 2, 620, '↑ ↓ elegir  ·  ◀ ▶ cambiar  ·  A = ¡a jugar!  ·  B = regresar', textStyle(22, TEXT.accent)).setOrigin(0.5));
    this.refreshSetup();
    say('Minigolf');
  }

  refreshSetup() {
    const labels = [
      `Recorrido: ${COURSES[this.setup.course].name}`,
      `Modo: ${this.setup.mode === 'loco' ? 'Loco (cajas con poderes)' : 'Normal'}`,
      `Línea de ayuda: ${this.setup.guide ? 'Sí' : 'No'}`,
    ];
    this.setupTexts.forEach(({ bg, text }, i) => {
      text.setText(labels[i]);
      bg.setStrokeStyle(i === this.setupRow ? 4 : 2, i === this.setupRow ? COLORS.accent : COLORS.panelBorder);
    });
  }

  updateSetup() {
    const host = players.host();
    if (!host) return;
    const id = host.deviceId;
    const rowStep = controls.justPressed(id, 'down') ? 1 : controls.justPressed(id, 'up') ? -1 : 0;
    if (rowStep) {
      this.setupRow = (this.setupRow + rowStep + SETUP_ROWS) % SETUP_ROWS;
      sfx.select();
      this.refreshSetup();
    }
    const step = controls.justPressed(id, 'right') ? 1 : controls.justPressed(id, 'left') ? -1 : 0;
    if (step) {
      if (this.setupRow === 0) {
        const index = COURSE_KEYS.indexOf(this.setup.course);
        this.setup.course = COURSE_KEYS[(index + step + COURSE_KEYS.length) % COURSE_KEYS.length];
      } else if (this.setupRow === 1) {
        this.setup.mode = this.setup.mode === 'loco' ? 'normal' : 'loco';
      } else {
        this.setup.guide = !this.setup.guide;
      }
      sfx.select();
      this.refreshSetup();
    }
    if (this.phaseMs < 300) return;
    if (controls.justPressed(id, 'a')) {
      sfx.confirm();
      Object.assign(lastSetup, this.setup);
      this.screen.destroy();
      this.screen = null;
      this.holes = COURSES[this.setup.course].holes;
      this.loco = this.setup.mode === 'loco';
      for (const ball of this.balls) Object.assign(ball, { scores: [], item: null });
      this.help.setText(
        `Stick = apuntar · Mantén A = fuerza (suelta para tirar) · LB / RB = afinar · B = cancelar${this.loco ? ' · X = usar poder' : ''} · Mantén LB + RB + Y = salir`,
      );
      this.holeIndex = 0;
      if (this.loco) say('¡Minigolf loco!');
      this.startHole();
    } else if (controls.justPressed(id, 'b')) {
      this.exit();
    }
  }

  // ---------- Cada hoyo ----------
  get hole() {
    return HOLES[this.holes[this.holeIndex]];
  }

  startHole() {
    const hole = this.hole;
    this.clearCourse();
    this.course = new Course(hole);
    this.drawCourse(hole);
    const [tx, ty] = hole.tee;
    this.balls.forEach((ball, i) => {
      Object.assign(ball, { x: tx, y: ty + (i - (this.balls.length - 1) / 2) * 6, vx: 0, vy: 0, strokes: 0, done: false, slowMs: 0, portalMs: 0 });
      Object.assign(ball, { power: null, armed: false });
      ball.lastX = ball.x;
      ball.lastY = ball.y;
      ball.aim = Math.atan2(hole.cup[1] - ty, hole.cup[0] - tx);
      ball.sprite = this.makeBall(ball);
    });
    this.boxes = this.loco ? this.placeBoxes(hole) : [];
    this.turn = 0;
    this.phase = 'intro';
    this.phaseMs = 0;
    const world = WORLDS[hole.world];
    this.hudTitle.setText(`${world.emoji} Hoyo ${this.holeIndex + 1} de ${this.holes.length} · ${hole.name} · Par ${hole.par}`);
    this.hudTurn.setText('');
    say(`Hoyo ${this.holeIndex + 1}: ${hole.name}. Par ${hole.par}`);
  }

  clearCourse() {
    // (Primero se paran sus animaciones: la bandera, los portales y las cajas.)
    this.courseLayer?.each((child) => this.tweens.killTweensOf(child));
    this.courseLayer?.destroy();
    this.courseLayer = null;
    for (const ball of this.balls ?? []) ball.sprite?.destroy();
    this.aim?.clear();
    this.boxes = [];
  }

  // La pelota de cada quien: su bolita con su personaje (un poco transparente si no es su turno), su letrero y el
  // poder que trae (en el Minigolf loco).
  makeBall(ball) {
    const blob = new Blob(this, ball.x, ball.y, ball.color, BALL_RADIUS).setDepth(DEPTH.ball);
    new CharacterLook(this, blob, ball.character, { height: 2.6 });
    const tag = this.add
      .text(0, -BALL_RADIUS * 3.2, ball.label, textStyle(16, hexToCss(ball.color), { fontStyle: 'bold', stroke: '#1b1530', strokeThickness: 4 }))
      .setOrigin(0.5);
    ball.itemTag = this.add.text(BALL_RADIUS * 2.2, -BALL_RADIUS * 2.4, '', textStyle(24, TEXT.normal)).setOrigin(0.5);
    blob.add([tag, ball.itemTag]);
    this.refreshItem(ball);
    return blob;
  }

  refreshItem(ball) {
    ball.itemTag?.setText(ball.item ? POWERS[ball.item].emoji : '');
  }

  // El fondo del mundo (cuando llega su dibujo, quita los adornos de figuras).
  addBackground(hole, key) {
    if (this.hole !== hole || !this.courseLayer) return;
    for (const piece of this.decor) piece.destroy();
    this.decor = [];
    const { width, height } = this.scale;
    const image = this.add.image(width / 2, height / 2, key);
    image.setScale(Math.max(width / image.width, height / image.height));
    this.courseLayer.addAt(image, 0);
  }

  // Adornos alrededor de la cancha mientras no hay fondo (siempre en el mismo lugar para cada hoyo): los dibujos del
  // mundo o, si no hay, arbolitos de figuras.
  drawDecor(hole, world) {
    const rnd = new Phaser.Math.RandomDataGenerator([hole.name]);
    const g = this.add.graphics();
    this.courseLayer.add(g);
    this.decor.push(g);
    const art = world.decor.map((name) => golfObject(this, name)).filter(Boolean);
    for (let i = 0; i < 26; i += 1) {
      const x = rnd.between(30, 1250);
      const y = rnd.between(100, 690);
      if (this.nearGrass(hole, x, y)) continue;
      if (art.length) {
        const image = this.add.image(x, y, rnd.pick(art));
        image.setScale(rnd.between(46, 70) / Math.max(image.width, image.height)).setAngle(rnd.between(-15, 15));
        this.courseLayer.add(image);
        this.decor.push(image);
        continue;
      }
      g.fillStyle(shade(world.ground, 0.75), 1);
      g.fillCircle(x, y, rnd.between(16, 28));
      g.fillStyle(shade(world.ground, 1.15), 1);
      g.fillCircle(x - 4, y - 5, rnd.between(10, 16));
    }
  }

  // El pasto, los barandales y todo lo del hoyo (lo que se mueve se guarda para moverlo cada cuadro).
  drawCourse(hole) {
    const world = WORLDS[hole.world];
    this.ground.setFillStyle(world.ground);
    const layer = this.add.container(0, 0).setDepth(DEPTH.course);
    this.courseLayer = layer;
    this.decor = [];
    const background = golfBackground(this, hole.world, (key) => this.addBackground(hole, key));
    if (background) this.addBackground(hole, background);
    else this.drawDecor(hole, world);
    const g = this.add.graphics();
    layer.add(g);
    for (const polygon of hole.shape) {
      const points = polygon.map(([x, y]) => ({ x, y }));
      g.fillStyle(world.grass, 1);
      g.fillPoints(points, true);
    }
    for (const s of hole.slopes ?? []) {
      g.fillStyle(0x000000, 0.08);
      g.fillRect(s.x, s.y, s.w, s.h);
      const angle = Math.atan2(s.fy, s.fx);
      for (let x = s.x + 40; x < s.x + s.w; x += 90) {
        for (let y = s.y + 40; y < s.y + s.h; y += 90) {
          const tip = { x: x + Math.cos(angle) * 18, y: y + Math.sin(angle) * 18 };
          const left = { x: x + Math.cos(angle + 2.5) * 14, y: y + Math.sin(angle + 2.5) * 14 };
          const right = { x: x + Math.cos(angle - 2.5) * 14, y: y + Math.sin(angle - 2.5) * 14 };
          g.fillStyle(0xffffff, 0.35);
          g.fillTriangle(tip.x, tip.y, left.x, left.y, right.x, right.y);
        }
      }
    }
    // Arena (en la nieve, nieve honda: igual frena mucho).
    const snowy = hole.world === 'nieve';
    for (const s of hole.sand ?? []) {
      g.fillStyle(snowy ? 0xffffff : 0xf2d27a, 1);
      g.fillRoundedRect(s.x, s.y, s.w, s.h, 26);
      g.fillStyle(snowy ? 0xbcd7f0 : 0xd9b45a, 1);
      for (let k = 0; k < 18; k += 1) g.fillCircle(s.x + 15 + ((k * 37) % (s.w - 30)), s.y + 15 + ((k * 53) % (s.h - 30)), 2.5);
    }
    // Hielo: azulito con rayitas de brillo.
    for (const s of hole.ice ?? []) {
      g.fillStyle(0x9fe0ff, 1);
      g.fillRect(s.x, s.y, s.w, s.h);
      g.lineStyle(4, 0xffffff, 0.6);
      for (let x = s.x + 20; x < s.x + s.w - 30; x += 70) {
        for (let y = s.y + 20; y < s.y + s.h - 30; y += 60) g.lineBetween(x, y + 24, x + 24, y);
      }
    }
    for (const w of hole.water ?? []) this.drawWater(g, w.x, w.y, w.w, w.h);
    // El tapete de salida y el hoyo (con el poder del hoyo gigante, crece).
    const [tx, ty] = hole.tee;
    g.fillStyle(0x2e8b57, 1);
    g.fillRoundedRect(tx - 26, ty - 26, 52, 52, 8);
    const [cx, cy] = hole.cup;
    this.cupHole = this.add.circle(cx, cy, CUP_RADIUS, COLORS.ink).setStrokeStyle(3, 0xffffff, 0.8);
    layer.add(this.cupHole);
    // Los barandales (de madera, de hielo o de metal según el mundo, con su orilla oscura).
    for (const [x1, y1, x2, y2] of this.course.walls) {
      g.lineStyle(16, COLORS.ink, 1);
      g.lineBetween(x1, y1, x2, y2);
    }
    for (const [x1, y1, x2, y2] of this.course.walls) {
      g.lineStyle(10, world.rail, 1);
      g.lineBetween(x1, y1, x2, y2);
    }
    // Hongos que rebotan (o lo que rebota en ese mundo: estrella de mar, muñeco de nieve, asteroide).
    const bumperArt = golfObject(this, world.bumper);
    this.bumperSprites = (hole.bumpers ?? []).map((b) => {
      let bumper;
      if (bumperArt) {
        bumper = this.add.image(b.x, b.y, bumperArt);
        bumper.setScale((b.r * 2.3) / Math.max(bumper.width, bumper.height));
      } else {
        bumper = this.add.container(b.x, b.y, [
          this.add.circle(0, 0, b.r, 0xff5a5f).setStrokeStyle(4, COLORS.ink),
          this.add.circle(0, 0, b.r * 0.6, 0xffffff),
          this.add.star(0, 0, 5, b.r * 0.22, b.r * 0.45, 0xffc93c),
        ]);
      }
      layer.add(bumper);
      return bumper;
    });
    // Planetas: con su aro de hasta dónde jalan.
    const planetArt = golfObject(this, 'planeta');
    for (const p of hole.planets ?? []) {
      g.lineStyle(3, 0xffffff, 0.16);
      g.strokeCircle(p.x, p.y, p.reach);
      if (planetArt) {
        const planet = this.add.image(p.x, p.y, planetArt);
        planet.setScale((p.r * 3.3) / Math.max(planet.width, planet.height));
        layer.add(planet);
      } else {
        layer.add(this.add.circle(p.x, p.y, p.r, 0x9b5de5).setStrokeStyle(4, COLORS.ink));
        layer.add(this.add.ellipse(p.x, p.y, p.r * 2.8, p.r * 0.7).setStrokeStyle(5, 0xff9a3c));
      }
    }
    // Agujeros negros: remolino morado que da vueltas.
    for (const b of hole.blackHoles ?? []) {
      g.lineStyle(3, 0xb07cff, 0.25);
      g.strokeCircle(b.x, b.y, b.reach);
      const swirl = this.add.container(b.x, b.y, [
        this.add.circle(0, 0, b.r * 1.7, 0x6a3cff, 0.35),
        this.add.star(0, 0, 7, b.r * 0.5, b.r * 1.5, 0xb07cff, 0.6),
        this.add.circle(0, 0, b.r, 0x05030f).setStrokeStyle(4, 0xb07cff),
      ]);
      layer.add(swirl);
      this.tweens.add({ targets: swirl, angle: -360, duration: 2200, repeat: -1 });
    }
    // Molinos: el centro y sus 4 aspas, que dan vueltas.
    this.millSprites = (hole.windmills ?? []).map((mill) => {
      const blades = [0, 1, 2, 3].map((k) =>
        this.add
          .rectangle(0, 0, mill.length, 14, k % 2 ? 0xffffff : 0xff5a5f)
          .setOrigin(0, 0.5)
          .setStrokeStyle(3, COLORS.ink)
          .setRotation((k * Math.PI) / 2),
      );
      const sprite = this.add.container(mill.x, mill.y, [...blades, this.add.circle(0, 0, HUB_RADIUS, 0x8b5a2b).setStrokeStyle(4, COLORS.ink)]);
      layer.add(sprite);
      return { mill, sprite };
    });
    // Paredes que se mueven.
    this.moverSprites = (hole.movers ?? []).map((m) => {
      const sprite = this.add.rectangle(m.x, m.y, m.w, m.h, 0x9b5de5).setOrigin(0).setStrokeStyle(4, COLORS.ink);
      layer.add(sprite);
      return { m, sprite };
    });
    // Olas: agua que va y viene.
    this.waveSprites = (hole.waves ?? []).map((wave) => {
      const wg = this.add.graphics();
      this.drawWater(wg, 0, 0, wave.w, wave.h);
      const sprite = this.add.container(wave.x, wave.y, [wg]);
      layer.add(sprite);
      return { wave, sprite };
    });
    // Portales: remolinos de colores.
    for (const portal of hole.portals ?? []) {
      for (const [[x, y], color] of [
        [portal.a, 0xb07cff],
        [portal.b, 0xff9a3c],
      ]) {
        const swirl = this.add.container(x, y, [
          this.add.circle(0, 0, 26, color, 0.9).setStrokeStyle(4, COLORS.ink),
          this.add.star(0, 0, 6, 6, 16, 0xffffff, 0.9),
        ]);
        layer.add(swirl);
        this.tweens.add({ targets: swirl, angle: 360, duration: 1600, repeat: -1 });
      }
    }
    // Los animalitos que van y vienen (cangrejos, pingüinos, ovnis).
    this.critterSprites = (hole.critters ?? []).map((c) => {
      const art = golfObject(this, c.kind);
      let sprite;
      if (art) {
        sprite = this.add.image(c.x, c.y, art);
        sprite.setScale((c.r * 2.5) / Math.max(sprite.width, sprite.height));
      } else {
        sprite = this.add.container(c.x, c.y, [
          this.add.circle(0, 0, c.r, 0xffffff, 0.85).setStrokeStyle(4, COLORS.ink),
          this.add.text(0, 0, CRITTER_EMOJI[c.kind] ?? '⭐', textStyle(c.r * 1.2, TEXT.normal)).setOrigin(0.5),
        ]);
      }
      layer.add(sprite);
      return { c, sprite };
    });
    // La bandera del hoyo, encima de todo lo de la cancha (en el dibujo, el palito está a FLAG_POLE de su ancho).
    const flagArt = golfObject(this, 'bandera');
    if (flagArt) {
      this.flag = this.add.image(cx, cy + 4, flagArt).setOrigin(FLAG_POLE, 0.95);
      this.flag.setScale(FLAG_HEIGHT / this.flag.height);
      layer.add(this.flag);
      this.tweens.add({ targets: this.flag, angle: 4, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      return;
    }
    g.lineStyle(4, 0xdddddd, 1);
    g.lineBetween(cx, cy, cx, cy - 80);
    this.flag = this.add
      .triangle(cx, cy - 80, 0, 0, 0, 28, 44, 14, 0xff5a5f)
      .setOrigin(0, 0)
      .setStrokeStyle(2, COLORS.ink);
    layer.add(this.flag);
    this.tweens.add({ targets: this.flag, scaleX: 0.8, duration: 500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }

  drawWater(g, x, y, w, h) {
    g.fillStyle(0x3fa7ff, 1);
    g.fillRoundedRect(x, y, w, h, 20);
    g.lineStyle(3, 0xffffff, 0.5);
    for (let wy = y + 22; wy < y + h - 10; wy += 30) {
      g.beginPath();
      for (let wx = x + 14; wx <= x + w - 14; wx += 6) g.lineTo(wx, wy + Math.sin(wx / 10) * 3);
      g.strokePath();
    }
  }

  // (Los arbolitos no van sobre el pasto ni pegados a él.)
  nearGrass(hole, x, y) {
    return hole.shape.some((polygon) => {
      const xs = polygon.map(([px]) => px);
      const ys = polygon.map(([, py]) => py);
      return x > Math.min(...xs) - 40 && x < Math.max(...xs) + 40 && y > Math.min(...ys) - 40 && y < Math.max(...ys) + 40;
    });
  }

  // ---------- Minigolf loco: las cajas sorpresa ----------
  // Lugares libres en el pasto: lejos de la salida, del hoyo, de los barandales y de todo lo que estorba.
  freeSpot(hole, x, y) {
    if (!onGrass(hole, x, y)) return false;
    if (Math.hypot(x - hole.tee[0], y - hole.tee[1]) < 120 || Math.hypot(x - hole.cup[0], y - hole.cup[1]) < 90) return false;
    if (this.course.walls.some(([x1, y1, x2, y2]) => segmentDistance(x, y, x1, y1, x2, y2) < 36)) return false;
    const inside = (r, margin) => x > r.x - margin && x < r.x + r.w + margin && y > r.y - margin && y < r.y + r.h + margin;
    if ([...(hole.water ?? []), ...(hole.sand ?? [])].some((r) => inside(r, 24))) return false;
    if ((hole.waves ?? []).some((w) => inside({ x: w.x, y: w.y, w: w.w + w.dx, h: w.h + w.dy }, 24))) return false;
    if ((hole.critters ?? []).some((c) => inside({ x: c.x + Math.min(0, c.dx), y: c.y + Math.min(0, c.dy), w: Math.abs(c.dx), h: Math.abs(c.dy) }, c.r + 24))) {
      return false;
    }
    const round = [...(hole.bumpers ?? []), ...(hole.planets ?? []), ...(hole.blackHoles ?? [])];
    if (round.some((b) => Math.hypot(x - b.x, y - b.y) < b.r * (b.reach ? 1.8 : 1) + 34)) return false;
    if ((hole.windmills ?? []).some((m) => Math.hypot(x - m.x, y - m.y) < m.length + 30)) return false;
    if ((hole.movers ?? []).some((m) => inside({ x: m.x, y: m.y, w: m.w + m.dx, h: m.h + m.dy }, 30))) return false;
    if ((hole.portals ?? []).some((p) => [p.a, p.b].some(([px, py]) => Math.hypot(x - px, y - py) < 60))) return false;
    return true;
  }

  placeBoxes(hole) {
    const art = golfObject(this, 'regalo');
    const boxes = [];
    for (let tries = 0; tries < 600 && boxes.length < BOXES_PER_HOLE; tries += 1) {
      const x = Phaser.Math.Between(150, 1130);
      const y = Phaser.Math.Between(130, 650);
      if (!this.freeSpot(hole, x, y) || boxes.some((b) => Math.hypot(b.x - x, b.y - y) < 170)) continue;
      let sprite;
      if (art) {
        sprite = this.add.image(x, y, art);
        sprite.setScale(BOX_SIZE / Math.max(sprite.width, sprite.height));
      } else {
        sprite = this.add.container(x, y, [
          this.add.rectangle(0, 0, BOX_SIZE * 0.8, BOX_SIZE * 0.8, 0x9b5de5).setStrokeStyle(4, COLORS.ink),
          this.add.text(0, 0, '?', textStyle(28, TEXT.normal, { fontStyle: 'bold' })).setOrigin(0.5),
        ]);
      }
      this.courseLayer.add(sprite);
      this.tweens.add({ targets: sprite, y: y - 6, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      boxes.push({ x, y, sprite, taken: false });
    }
    return boxes;
  }

  // La pelota que rueda por una caja se lleva un poder (si no trae uno ya).
  checkBoxes(ball, fromX, fromY) {
    if (ball.item) return;
    for (const box of this.boxes) {
      if (box.taken || segmentDistance(box.x, box.y, fromX, fromY, ball.x, ball.y) > BOX_REACH) continue;
      box.taken = true;
      this.tweens.killTweensOf(box.sprite);
      this.tweens.add({ targets: box.sprite, scale: box.sprite.scale * 1.6, alpha: 0, duration: 300, onComplete: () => box.sprite.setVisible(false) });
      ball.item = Phaser.Utils.Array.GetRandom(POWER_KEYS);
      const power = POWERS[ball.item];
      burst(this, box.x, box.y, 0xffc93c, 12);
      popText(this, box.x, box.y - 40, `${power.emoji} ${power.name}`, '#ffc93c');
      say(power.name);
      sfx.pickup();
      this.refreshItem(ball);
      return;
    }
  }

  get current() {
    return this.balls[this.turn];
  }

  update() {
    const dt = frameDelta();
    this.phaseMs += dt;
    this.updateExit(dt);
    if (this.phase === 'setup') {
      this.updateSetup();
      return;
    }
    if (this.course) {
      this.course.update(dt);
      for (const { mill, sprite } of this.millSprites ?? []) sprite.setRotation(mill.speed * (this.course.t / 1000));
      for (const { m, sprite } of this.moverSprites ?? []) {
        const r = this.course.mover(m);
        sprite.setPosition(r.x, r.y);
      }
      for (const { wave, sprite } of this.waveSprites ?? []) {
        const r = this.course.mover(wave);
        sprite.setPosition(r.x, r.y);
      }
      for (const { c, sprite } of this.critterSprites ?? []) {
        const at = this.course.critter(c);
        sprite.setPosition(at.x, at.y);
        // (Van meneándose al caminar; congelados, quietos.)
        if (!this.course.frozen) sprite.setAngle(Math.sin(this.course.t / 110) * 8);
      }
    }
    if (this.phase === 'intro' && this.phaseMs >= INTRO_MS) this.startTurn();
    else if (this.phase === 'aim') this.updateAim(dt);
    else if (this.phase === 'roll') this.updateRoll(dt);
    else if (this.phase === 'score' || this.phase === 'final') this.updateScreen();
    for (const ball of this.balls) ball.sprite?.setPosition(ball.x, ball.y);
  }

  // ---------- Los turnos ----------
  startTurn() {
    const ball = this.current;
    this.phase = 'aim';
    this.phaseMs = 0;
    this.power = 0;
    this.charging = false;
    for (const other of this.balls) other.sprite?.setAlpha(other === ball || other.done ? 1 : 0.55);
    ball.sprite.hop?.();
    this.refreshTurnText(ball);
    say(`Turno de ${ball.label}`);
  }

  refreshTurnText(ball) {
    let text = `Turno de ${ball.label} · Tiro ${ball.strokes + 1}`;
    if (ball.item) text += ball.armed ? ` · ${POWERS[ball.item].emoji} ¡listo!` : ` · ${POWERS[ball.item].emoji} X = usar`;
    this.hudTurn.setText(text).setColor(hexToCss(ball.color));
  }

  updateAim(dt) {
    const ball = this.current;
    const id = ball.deviceId;
    const stick = controls.getStick(id);
    if (Math.hypot(stick.x, stick.y) > 0.4) ball.aim = Math.atan2(stick.y, stick.x);
    if (controls.isDown(id, 'lb')) ball.aim -= Phaser.Math.DegToRad(FINE_TURN);
    if (controls.isDown(id, 'rb')) ball.aim += Phaser.Math.DegToRad(FINE_TURN);
    // X: preparar (o guardar otra vez) el poder para este tiro.
    if (ball.item && controls.justPressed(id, 'x')) {
      ball.armed = !ball.armed;
      sfx.select();
      if (ball.armed) say(POWERS[ball.item].name);
      this.refreshTurnText(ball);
    }
    const holding = controls.isDown(id, 'a') && this.phaseMs > 250;
    if (holding) {
      if (!this.charging) {
        this.charging = true;
        this.chargeMs = 0;
      }
      this.chargeMs += dt;
      // La fuerza sube y baja sola mientras se mantiene A.
      this.power = (1 - Math.cos((this.chargeMs / POWER_PERIOD_MS) * Math.PI * 2)) / 2;
    } else if (this.charging) {
      this.charging = false;
      if (this.power > 0.04) this.shoot(ball, this.power);
      this.power = 0;
    }
    if (controls.justPressed(id, 'b')) {
      this.charging = false;
      this.power = 0;
    }
    this.drawAim(ball);
  }

  // La flecha de puntería, la barrita de fuerza y (si se escogió) la línea de por dónde va a ir.
  drawAim(ball) {
    const g = this.aim;
    g.clear();
    if (this.phase !== 'aim') return;
    const dir = { x: Math.cos(ball.aim), y: Math.sin(ball.aim) };
    const speed = MIN_SHOT + Math.max(this.power, this.charging ? this.power : 0.45) * (MAX_SHOT - MIN_SHOT);
    if (this.setup.guide) {
      const power = ball.armed && BALL_POWERS.includes(ball.item) ? ball.item : null;
      const path = predictPath(this.course, ball.x, ball.y, dir.x * speed, dir.y * speed, { power });
      g.fillStyle(0xffffff, 0.75);
      path.forEach(([x, y], i) => g.fillCircle(x, y, i % 2 ? 3 : 4));
    }
    const tip = { x: ball.x + dir.x * 54, y: ball.y + dir.y * 54 };
    g.lineStyle(6, COLORS.ink, 1);
    g.lineBetween(ball.x + dir.x * 18, ball.y + dir.y * 18, tip.x, tip.y);
    g.lineStyle(3, ball.color, 1);
    g.lineBetween(ball.x + dir.x * 18, ball.y + dir.y * 18, tip.x, tip.y);
    g.fillStyle(ball.color, 1);
    g.fillTriangle(tip.x + dir.x * 12, tip.y + dir.y * 12, tip.x - dir.y * 9, tip.y + dir.x * 9, tip.x + dir.y * 9, tip.y - dir.x * 9);
    // La barrita de fuerza (mientras se mantiene A): verde, amarilla, roja.
    if (!this.charging) return;
    const bx = ball.x + 34;
    const by = ball.y - 50;
    g.fillStyle(COLORS.ink, 0.85);
    g.fillRoundedRect(bx - 3, by - 3, 16, 86, 5);
    g.fillStyle(this.power > 0.75 ? 0xff5a5f : this.power > 0.4 ? 0xffc93c : 0x4cd97b, 1);
    const h = 80 * this.power;
    g.fillRect(bx, by + 80 - h, 10, h);
  }

  shoot(ball, power) {
    const speed = MIN_SHOT + power * (MAX_SHOT - MIN_SHOT);
    ball.lastX = ball.x;
    ball.lastY = ball.y;
    ball.vx = Math.cos(ball.aim) * speed;
    ball.vy = Math.sin(ball.aim) * speed;
    ball.slowMs = 0;
    // El poder preparado se usa en este tiro (el tiro gratis no cuenta).
    const item = ball.armed ? ball.item : null;
    ball.power = BALL_POWERS.includes(item) ? item : null;
    ball.usedPower = item;
    if (item) this.usePower(ball, item);
    if (item !== 'regalo') ball.strokes += 1;
    this.phase = 'roll';
    this.phaseMs = 0;
    this.aim.clear();
    this.wallSoundMs = 0;
    sfx.hit(0.3 + power * 0.5);
    this.hudTurn.setText(`${ball.label} · Tiro ${ball.strokes}${item ? ` · ${POWERS[item].emoji}` : ''}`);
  }

  usePower(ball, item) {
    ball.item = null;
    ball.armed = false;
    this.refreshItem(ball);
    sfx.special();
    if (item === 'gigante') this.tweens.add({ targets: this.cupHole, scale: GIANT_CUP, duration: 300, ease: 'Back.easeOut' });
    if (item === 'fantasma') ball.sprite.setAlpha(0.45);
    if (item === 'hielo') {
      this.course.frozen = true;
      for (const { sprite } of [...(this.critterSprites ?? []), ...(this.millSprites ?? []), ...(this.moverSprites ?? []), ...(this.waveSprites ?? [])]) {
        burst(this, sprite.x, sprite.y, 0x9fd8ff, 8);
      }
    }
    popText(this, ball.x, ball.y - 50, `${POWERS[item].emoji} ${POWERS[item].name}`, '#ffc93c');
  }

  // Al acabar el tiro, el poder se acaba (la cancha se descongela y el hoyo vuelve a su tamaño).
  endPower(ball) {
    if (!ball.usedPower) return;
    ball.power = null;
    ball.usedPower = null;
    if (this.course) this.course.frozen = false;
    if (this.cupHole?.scale !== 1) this.tweens.add({ targets: this.cupHole, scale: 1, duration: 300 });
    ball.sprite?.setAlpha(1);
  }

  updateRoll(dt) {
    const ball = this.current;
    if (ball.done) return;
    this.wallSoundMs = Math.max(0, this.wallSoundMs - dt);
    const [fromX, fromY] = [ball.x, ball.y];
    const events = stepBall(ball, this.course, Math.min(dt, 40));
    if (this.loco) this.checkBoxes(ball, fromX, fromY);
    if (events.wall && this.wallSoundMs === 0) {
      sfx.block();
      this.wallSoundMs = 120;
    }
    if (events.bumper) {
      sfx.boing();
      const sprite = this.bumperSprites[(this.hole.bumpers ?? []).indexOf(events.bumper)];
      if (sprite) this.tweens.add({ targets: sprite, scale: sprite.scale * 1.25, duration: 90, yoyo: true });
    }
    if (events.critter && this.wallSoundMs === 0) {
      sfx.boing();
      this.wallSoundMs = 200;
    }
    if (events.portal) {
      sfx.poof();
      burst(this, ball.x, ball.y, 0xb07cff, 10);
    }
    if (events.water || events.out) {
      // Al agua (o al agujero negro, o se salió): regresa de donde tiró; el agua cuesta un tiro.
      if (events.water) {
        ball.strokes += 1;
        if (events.blackHole) {
          burst(this, ball.x, ball.y, 0xb07cff, 14);
          popText(this, ball.x, ball.y - 30, '¡Se la tragó!', '#d6b8ff');
          say('¡Se la tragó el agujero negro!');
          sfx.ghost();
        } else {
          burst(this, ball.x, ball.y, 0x3fa7ff, 12);
          popText(this, ball.x, ball.y - 30, '¡Splash!', '#9fd8ff');
          say('¡Al agua!');
          sfx.throw();
        }
      }
      Object.assign(ball, { x: ball.lastX, y: ball.lastY, vx: 0, vy: 0, slowMs: 0 });
      this.endTurn(ball);
      return;
    }
    if (events.sank) {
      this.sink(ball);
      return;
    }
    if (events.rest) this.endTurn(ball);
  }

  sink(ball) {
    ball.done = true;
    const hole = this.hole;
    const text = RESULT(ball.strokes, hole.par);
    ball.scores.push(ball.strokes);
    if (ball.usedPower) rewards.earn('golf-loco');
    this.endPower(ball);
    this.tweens.add({ targets: ball.sprite, scale: 0.2, alpha: 0, duration: 400, ease: 'Back.easeIn' });
    burst(this, hole.cup[0], hole.cup[1], ball.color, 16);
    popText(this, hole.cup[0], hole.cup[1] - 60, text, hexToCss(ball.color));
    say(text);
    if (ball.strokes === 1) {
      sfx.win();
      fireworks(this, [ball.color, 0xffffff, 0xffc93c], 3);
      rewards.earn('golf-hoyo-en-uno');
    } else {
      sfx.star();
    }
    this.time.delayedCall(NEXT_TURN_MS + 300, () => this.nextTurn());
  }

  endTurn(ball) {
    this.phase = 'wait';
    this.endPower(ball);
    // Ya no le quedan tiros: se acaba su hoyo.
    if (!ball.done && ball.strokes >= this.hole.par + EXTRA_STROKES) {
      ball.done = true;
      ball.scores.push(ball.strokes);
      popText(this, ball.x, ball.y - 40, '¡Se acabaron los tiros!', '#ffc93c');
      ball.sprite.setAlpha(0.3);
    }
    this.time.delayedCall(NEXT_TURN_MS, () => this.nextTurn());
  }

  // Le toca al siguiente que todavía no la mete; si ya todos, se ve la tabla.
  nextTurn() {
    if (this.phase === 'score' || this.phase === 'final' || this.phase === 'setup') return;
    const n = this.balls.length;
    for (let k = 1; k <= n; k += 1) {
      const i = (this.turn + k) % n;
      if (!this.balls[i].done) {
        this.turn = i;
        this.startTurn();
        return;
      }
    }
    this.showScores();
  }

  // ---------- La tabla ----------
  showScores() {
    const last = this.holeIndex === this.holes.length - 1;
    this.phase = last ? 'final' : 'score';
    this.phaseMs = 0;
    this.hudTurn.setText('');
    const { width, height } = this.scale;
    this.screen = this.add.container(0, 0).setDepth(DEPTH.screen);
    this.screen.add(this.add.rectangle(width / 2, height / 2, width, height, 0x14112b, 0.88));
    const totals = this.balls.map((b) => b.scores.reduce((sum, s) => sum + s, 0));
    const par = this.holes.slice(0, this.holeIndex + 1).reduce((sum, i) => sum + HOLES[i].par, 0);
    const ranking = this.balls.map((b, i) => ({ b, total: totals[i] })).sort((a, b) => a.total - b.total);
    let title = `Después del hoyo ${this.holeIndex + 1}`;
    if (last) {
      const best = ranking[0];
      const solo = this.balls.length === 1;
      title = solo ? `¡Terminaste con ${best.total} tiros!` : `🏆 ¡Ganó ${best.b.label}!`;
      say(solo ? `¡Terminaste con ${best.total} tiros! El par era ${par}` : `¡Ganó ${best.b.label} con ${best.total} tiros!`);
      // Gana la calcomanía el que gana con varios, o el que juega solo y queda en el par o abajo (en 9 hoyos o más).
      if (this.holes.length >= 9 && (!solo || best.total <= par)) rewards.earn('golf-gana');
      // La Vuelta al mundo: terminar sus 9 hoyos (en ese recorrido o en el de todos).
      if (this.setup.course === 'mundo' || this.setup.course === 'todo') rewards.earn('golf-mundo');
      confetti(this, [best.b.color, 0xffffff, 0xffc93c], 90);
      sfx.win();
    }
    this.screen.add(this.add.text(width / 2, 70, title, textStyle(46, TEXT.normal, { fontStyle: 'bold' })).setOrigin(0.5));
    // La tabla: un renglón por jugador con sus tiros en cada hoyo y el total; abajo el par.
    const cols = this.holes.length;
    const cellW = Math.min(80, 820 / cols);
    const font = cols > 9 ? 20 : 26;
    const left = width / 2 - (180 + cols * cellW + 110) / 2;
    const header = ['', ...this.holes.map((_, i) => String(i + 1)), 'Total'];
    const rowY = (r) => 170 + r * 62;
    const cellX = (c) => (c === 0 ? left + 90 : c <= cols ? left + 180 + (c - 0.5) * cellW : left + 180 + cols * cellW + 55);
    header.forEach((label, c) =>
      this.screen.add(this.add.text(cellX(c), rowY(0), label, textStyle(font - 2, TEXT.muted, { fontStyle: 'bold' })).setOrigin(0.5)),
    );
    const parRow = ['Par', ...this.holes.map((i) => String(HOLES[i].par)), String(this.holes.reduce((sum, i) => sum + HOLES[i].par, 0))];
    const rows = [
      ...ranking.map(({ b }) => [
        b,
        [b.label, ...this.holes.map((_, i) => (b.scores[i] === undefined ? '·' : String(b.scores[i]))), String(b.scores.reduce((s, x) => s + x, 0))],
      ]),
      [null, parRow],
    ];
    rows.forEach(([b, cells], r) => {
      const y = rowY(r + 1);
      this.screen.add(this.add.rectangle(width / 2, y, cellX(cols + 1) - left + 70, 52, b ? COLORS.panel : 0x1b1730).setRounded(14));
      cells.forEach((cell, c) => {
        const color = c === 0 && b ? hexToCss(b.color) : c > 0 && c <= cols && b && Number(cell) < HOLES[this.holes[c - 1]].par ? TEXT.accent : TEXT.normal;
        const size = c === 0 || c > cols ? 26 : font;
        this.screen.add(
          this.add.text(cellX(c), y, cell, textStyle(size, color, { fontStyle: 'bold', stroke: '#1b1530', strokeThickness: c === 0 ? 5 : 0 })).setOrigin(0.5),
        );
      });
    });
    const hint = last ? 'A = jugar otra vez  ·  B = regresar al menú' : 'A = siguiente hoyo';
    this.screen.add(this.add.text(width / 2, height - 60, hint, textStyle(24, TEXT.accent)).setOrigin(0.5));
  }

  updateScreen() {
    if (this.phaseMs < INPUT_DELAY_MS) return;
    const ids = this.balls.map((b) => b.deviceId);
    const a = ids.some((id) => controls.justPressed(id, 'a'));
    const b = ids.some((id) => controls.justPressed(id, 'b'));
    if (!a && !b) return;
    sfx.confirm();
    if (this.phase === 'final') {
      if (b) {
        this.exit();
        return;
      }
      this.screen.destroy();
      this.screen = null;
      this.showSetup();
      return;
    }
    if (!a) return;
    this.screen.destroy();
    this.screen = null;
    this.holeIndex += 1;
    this.startHole();
  }

  updateExit(dt) {
    const holding = this.humans.some((player) => controls.holdingExit(player.deviceId));
    this.exitMs = holding ? this.exitMs + dt : 0;
    if (this.exitMs >= EXIT_HOLD_MS) this.exit();
  }

  exit() {
    if (this.exiting) return;
    this.exiting = true;
    go(this, 'Menu', { selected: this.returnData.selected });
  }
}
