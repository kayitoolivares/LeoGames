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
import { HOLES } from './holes.js';
import { BALL_RADIUS, CUP_RADIUS, Course, HUB_RADIUS, MAX_SHOT, predictPath, stepBall } from './physics.js';

// "Minigolf": por turnos, cada quien con su personaje de pelota. En tu turno: el stick apunta, mantén A para la fuerza
// (sube y baja) y suelta para tirar; LB / RB giran poquito la puntería y B cancela. La línea punteada enseña por dónde
// va a ir (se puede quitar). El recorrido corto son 3 hoyos y el completo 9; gana el que use menos tiros.
const SHORT_COURSE = [0, 2, 7];
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
const lastSetup = { course: 'corto', guide: true };
const RESULT = (strokes, par) => {
  if (strokes === 1) return '¡Hoyo en uno!';
  if (strokes <= par - 2) return '¡Águila!';
  if (strokes === par - 1) return '¡Birdie!';
  if (strokes === par) return '¡Par!';
  return `¡Adentro en ${strokes} tiros!`;
};

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
  }

  create() {
    const { width, height } = this.scale;
    this.add.rectangle(0, 0, width, height, 0x2f7a3f).setOrigin(0).setDepth(-10);
    this.setup = { ...lastSetup };
    this.humans = players.sorted();
    this.balls = this.humans.map((player) => ({
      player,
      deviceId: player.deviceId,
      label: `J${player.slot + 1}`,
      color: players.color(player).hex,
      character: characterPicks.get(player.deviceId, defaultCharacter(player)),
      scores: [],
    }));
    this.courseLayer = null;
    this.screen = null;
    this.aim = this.add.graphics().setDepth(DEPTH.aim);
    this.hudTitle = this.add
      .text(width / 2, 30, '', textStyle(30, TEXT.normal, { fontStyle: 'bold' }))
      .setOrigin(0.5)
      .setDepth(DEPTH.hud);
    this.hudTurn = this.add
      .text(width / 2, 64, '', textStyle(22, TEXT.accent, { fontStyle: 'bold' }))
      .setOrigin(0.5)
      .setDepth(DEPTH.hud);
    this.help = this.add
      .text(
        width / 2,
        height - 16,
        'Stick = apuntar · Mantén A = fuerza (suelta para tirar) · LB / RB = afinar · B = cancelar · Mantén LB + RB + Y = salir',
        textStyle(16, TEXT.muted),
      )
      .setOrigin(0.5)
      .setDepth(DEPTH.hud);
    this.showSetup();
  }

  // ---------- Antes de jugar: recorrido corto o completo, y la línea de ayuda ----------
  showSetup() {
    this.phase = 'setup';
    this.phaseMs = 0;
    this.clearCourse();
    this.screen?.destroy();
    const { width, height } = this.scale;
    this.screen = this.add.container(0, 0).setDepth(DEPTH.screen);
    this.screen.add(this.add.rectangle(width / 2, height / 2, width, height, 0x14112b, 0.85));
    this.screen.add(this.add.text(width / 2, 140, '⛳ Minigolf', textStyle(60, TEXT.normal, { fontStyle: 'bold' })).setOrigin(0.5));
    this.setupRow = 0;
    this.setupTexts = [0, 1].map((i) => {
      const bg = this.add.rectangle(width / 2, 280 + i * 70, 640, 56, COLORS.panel).setRounded(16);
      const text = this.add.text(width / 2, 280 + i * 70, '', textStyle(26, TEXT.normal, { fontStyle: 'bold' })).setOrigin(0.5);
      this.screen.add([bg, text]);
      return { bg, text };
    });
    const people = this.balls.map((b) => b.label).join(', ');
    this.screen.add(this.add.text(width / 2, 460, `Juegan: ${people}`, textStyle(24, TEXT.normal)).setOrigin(0.5));
    this.screen.add(this.add.text(width / 2, 620, '↑ ↓ elegir  ·  ◀ ▶ cambiar  ·  A = ¡a jugar!  ·  B = regresar', textStyle(22, TEXT.accent)).setOrigin(0.5));
    this.refreshSetup();
    say('Minigolf');
  }

  refreshSetup() {
    const labels = [
      `Recorrido: ${this.setup.course === 'corto' ? 'Corto (3 hoyos)' : 'Completo (9 hoyos)'}`,
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
    if (controls.justPressed(id, 'up') || controls.justPressed(id, 'down')) {
      this.setupRow = 1 - this.setupRow;
      sfx.select();
      this.refreshSetup();
    }
    if (controls.justPressed(id, 'left') || controls.justPressed(id, 'right')) {
      if (this.setupRow === 0) this.setup.course = this.setup.course === 'corto' ? 'completo' : 'corto';
      else this.setup.guide = !this.setup.guide;
      sfx.select();
      this.refreshSetup();
    }
    if (this.phaseMs < 300) return;
    if (controls.justPressed(id, 'a')) {
      sfx.confirm();
      Object.assign(lastSetup, this.setup);
      this.screen.destroy();
      this.screen = null;
      this.holes = this.setup.course === 'corto' ? SHORT_COURSE : HOLES.map((_, i) => i);
      for (const ball of this.balls) ball.scores = [];
      this.holeIndex = 0;
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
      ball.lastX = ball.x;
      ball.lastY = ball.y;
      ball.aim = Math.atan2(hole.cup[1] - ty, hole.cup[0] - tx);
      ball.sprite = this.makeBall(ball);
    });
    this.turn = 0;
    this.phase = 'intro';
    this.phaseMs = 0;
    this.hudTitle.setText(`Hoyo ${this.holeIndex + 1} de ${this.holes.length} · ${hole.name} · Par ${hole.par}`);
    this.hudTurn.setText('');
    say(`Hoyo ${this.holeIndex + 1}: ${hole.name}. Par ${hole.par}`);
  }

  clearCourse() {
    // (Primero se paran sus animaciones: la bandera y los portales.)
    this.courseLayer?.each((child) => this.tweens.killTweensOf(child));
    this.courseLayer?.destroy();
    this.courseLayer = null;
    for (const ball of this.balls ?? []) ball.sprite?.destroy();
    this.aim?.clear();
  }

  // La pelota de cada quien: su bolita con su personaje (un poco transparente si no es su turno) y su letrero.
  makeBall(ball) {
    const blob = new Blob(this, ball.x, ball.y, ball.color, BALL_RADIUS).setDepth(DEPTH.ball);
    new CharacterLook(this, blob, ball.character, { height: 2.6 });
    const tag = this.add
      .text(0, -BALL_RADIUS * 3.2, ball.label, textStyle(16, hexToCss(ball.color), { fontStyle: 'bold', stroke: '#1b1530', strokeThickness: 4 }))
      .setOrigin(0.5);
    blob.add(tag);
    return blob;
  }

  // El pasto, los barandales y todo lo del hoyo (lo que se mueve se guarda para moverlo cada cuadro).
  drawCourse(hole) {
    const layer = this.add.container(0, 0).setDepth(DEPTH.course);
    this.courseLayer = layer;
    const g = this.add.graphics();
    layer.add(g);
    // Arbolitos alrededor (siempre en el mismo lugar para cada hoyo).
    const rnd = new Phaser.Math.RandomDataGenerator([hole.name]);
    for (let i = 0; i < 26; i += 1) {
      const x = rnd.between(30, 1250);
      const y = rnd.between(100, 690);
      if (this.course && this.nearGrass(hole, x, y)) continue;
      g.fillStyle(0x245f30, 1);
      g.fillCircle(x, y, rnd.between(16, 28));
      g.fillStyle(0x2e8b3e, 1);
      g.fillCircle(x - 4, y - 5, rnd.between(10, 16));
    }
    for (const polygon of hole.shape) {
      const points = polygon.map(([x, y]) => ({ x, y }));
      g.fillStyle(0x6cd36c, 1);
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
    for (const s of hole.sand ?? []) {
      g.fillStyle(0xf2d27a, 1);
      g.fillRoundedRect(s.x, s.y, s.w, s.h, 26);
      g.fillStyle(0xd9b45a, 1);
      for (let k = 0; k < 18; k += 1) g.fillCircle(s.x + 15 + ((k * 37) % (s.w - 30)), s.y + 15 + ((k * 53) % (s.h - 30)), 2.5);
    }
    for (const w of hole.water ?? []) {
      g.fillStyle(0x3fa7ff, 1);
      g.fillRoundedRect(w.x, w.y, w.w, w.h, 20);
      g.lineStyle(3, 0xffffff, 0.5);
      for (let y = w.y + 22; y < w.y + w.h - 10; y += 30) {
        g.beginPath();
        for (let x = w.x + 14; x <= w.x + w.w - 14; x += 6) g.lineTo(x, y + Math.sin(x / 10) * 3);
        g.strokePath();
      }
    }
    // El tapete de salida y el hoyo con su bandera.
    const [tx, ty] = hole.tee;
    g.fillStyle(0x2e8b57, 1);
    g.fillRoundedRect(tx - 26, ty - 26, 52, 52, 8);
    const [cx, cy] = hole.cup;
    g.fillStyle(COLORS.ink, 1);
    g.fillCircle(cx, cy, CUP_RADIUS);
    g.lineStyle(3, 0xffffff, 0.8);
    g.strokeCircle(cx, cy, CUP_RADIUS);
    g.lineStyle(4, 0xdddddd, 1);
    g.lineBetween(cx, cy, cx, cy - 80);
    this.flag = this.add
      .triangle(cx, cy - 80, 0, 0, 0, 28, 44, 14, 0xff5a5f)
      .setOrigin(0, 0)
      .setStrokeStyle(2, COLORS.ink);
    layer.add(this.flag);
    this.tweens.add({ targets: this.flag, scaleX: 0.8, duration: 500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    // Los barandales (de madera, con su orilla oscura).
    for (const [x1, y1, x2, y2] of this.course.walls) {
      g.lineStyle(16, COLORS.ink, 1);
      g.lineBetween(x1, y1, x2, y2);
    }
    for (const [x1, y1, x2, y2] of this.course.walls) {
      g.lineStyle(10, 0xb5793f, 1);
      g.lineBetween(x1, y1, x2, y2);
    }
    // Hongos que rebotan.
    this.bumperSprites = (hole.bumpers ?? []).map((b) => {
      const bumper = this.add.container(b.x, b.y, [
        this.add.circle(0, 0, b.r, 0xff5a5f).setStrokeStyle(4, COLORS.ink),
        this.add.circle(0, 0, b.r * 0.6, 0xffffff),
        this.add.star(0, 0, 5, b.r * 0.22, b.r * 0.45, 0xffc93c),
      ]);
      layer.add(bumper);
      return bumper;
    });
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
  }

  // (Los arbolitos no van sobre el pasto ni pegados a él.)
  nearGrass(hole, x, y) {
    return hole.shape.some((polygon) => {
      const xs = polygon.map(([px]) => px);
      const ys = polygon.map(([, py]) => py);
      return x > Math.min(...xs) - 40 && x < Math.max(...xs) + 40 && y > Math.min(...ys) - 40 && y < Math.max(...ys) + 40;
    });
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
    this.hudTurn.setText(`Turno de ${ball.label} · Tiro ${ball.strokes + 1}`).setColor(hexToCss(ball.color));
    say(`Turno de ${ball.label}`);
  }

  updateAim(dt) {
    const ball = this.current;
    const id = ball.deviceId;
    const stick = controls.getStick(id);
    if (Math.hypot(stick.x, stick.y) > 0.4) ball.aim = Math.atan2(stick.y, stick.x);
    if (controls.isDown(id, 'lb')) ball.aim -= Phaser.Math.DegToRad(FINE_TURN);
    if (controls.isDown(id, 'rb')) ball.aim += Phaser.Math.DegToRad(FINE_TURN);
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
      const path = predictPath(this.course, ball.x, ball.y, dir.x * speed, dir.y * speed);
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
    ball.strokes += 1;
    this.phase = 'roll';
    this.phaseMs = 0;
    this.aim.clear();
    this.wallSoundMs = 0;
    sfx.hit(0.3 + power * 0.5);
    this.hudTurn.setText(`${ball.label} · Tiro ${ball.strokes}`);
  }

  updateRoll(dt) {
    const ball = this.current;
    if (ball.done) return;
    this.wallSoundMs = Math.max(0, this.wallSoundMs - dt);
    const events = stepBall(ball, this.course, Math.min(dt, 40));
    if (events.wall && this.wallSoundMs === 0) {
      sfx.block();
      this.wallSoundMs = 120;
    }
    if (events.bumper) {
      sfx.boing();
      const sprite = this.bumperSprites[(this.hole.bumpers ?? []).indexOf(events.bumper)];
      if (sprite) this.tweens.add({ targets: sprite, scale: 1.25, duration: 90, yoyo: true });
    }
    if (events.portal) {
      sfx.poof();
      burst(this, ball.x, ball.y, 0xb07cff, 10);
    }
    if (events.water || events.out) {
      // Al agua (o se salió): regresa de donde tiró; el agua cuesta un tiro.
      if (events.water) {
        ball.strokes += 1;
        burst(this, ball.x, ball.y, 0x3fa7ff, 12);
        popText(this, ball.x, ball.y - 30, '¡Splash!', '#9fd8ff');
        say('¡Al agua!');
        sfx.throw();
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
      // Gana la calcomanía el que gana con varios, o el que juega solo y queda en el par o abajo (en el completo).
      if (this.holes.length === HOLES.length && (!solo || best.total <= par)) rewards.earn('golf-gana');
      confetti(this, [best.b.color, 0xffffff, 0xffc93c], 90);
      sfx.win();
    }
    this.screen.add(this.add.text(width / 2, 70, title, textStyle(46, TEXT.normal, { fontStyle: 'bold' })).setOrigin(0.5));
    // La tabla: un renglón por jugador con sus tiros en cada hoyo y el total; abajo el par.
    const cols = this.holes.length;
    const cellW = Math.min(80, 760 / cols);
    const left = width / 2 - (180 + cols * cellW + 110) / 2;
    const header = ['', ...this.holes.map((_, i) => String(i + 1)), 'Total'];
    const rowY = (r) => 170 + r * 62;
    const cellX = (c) => (c === 0 ? left + 90 : c <= cols ? left + 180 + (c - 0.5) * cellW : left + 180 + cols * cellW + 55);
    header.forEach((label, c) => this.screen.add(this.add.text(cellX(c), rowY(0), label, textStyle(24, TEXT.muted, { fontStyle: 'bold' })).setOrigin(0.5)));
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
        this.screen.add(
          this.add.text(cellX(c), y, cell, textStyle(26, color, { fontStyle: 'bold', stroke: '#1b1530', strokeThickness: c === 0 ? 5 : 0 })).setOrigin(0.5),
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
