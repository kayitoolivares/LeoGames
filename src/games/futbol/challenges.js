import Phaser from 'phaser';
import { controls } from '../../shared/controls.js';
import { rewards } from '../../shared/rewards.js';
import { sfx } from '../../shared/sound.js';
import { COLORS, TEXT, hexToCss, textStyle } from '../../ui/style.js';
import { burst, confetti } from '../brawl/effects.js';
import { comicHit } from '../duelo/fx.js';
import { FIELD, GOAL } from './field.js';

// Retos de habilidad: cada jugador, por turnos, hace los dos retos y gana medallas (bronce, plata u oro):
//   Tiro al blanco: 30 segundos para pegarle a las dianas que salen en la portería (unas suben y bajan).
//   Dominadas: que no se caiga el balón: cada toque cuenta (X lo levanta, también de cabeza); se acaba si toca el piso.
// Usa el balón y los jugadores del partido; no hay compu ni goles.
export const CHALLENGES = [
  { key: 'diana', name: 'Tiro al blanco', emoji: '🎯', medals: [3, 6, 10], hint: 'X = patear (↑ globito · ↓ rasante) · ¡pégale a las dianas!' },
  {
    key: 'dominadas',
    name: 'Dominadas',
    emoji: '⚽',
    medals: [5, 10, 20],
    hint: 'X = levantar el balón (también rebota en la cabeza) · ¡que no toque el piso!',
  },
];
const MEDALS = ['🥉', '🥈', '🥇'];
const INTRO_MS = 1600;
const RESULT_MS = 2000;
const TARGET_MS = 30000;
const JUGGLE_MAX_MS = 60000;
const END_INPUT_DELAY_MS = 1000;
// Las dianas: cuántas a la vez, qué tan grandes, dónde salen y cuánto tardan en salir otra.
const TARGETS = 3;
const TARGET_R = 34;
const TARGET_AREA = { x: [FIELD.width - GOAL.depth - 260, FIELD.width - GOAL.depth - 50], y: [300, FIELD.ground - 60] };
const TARGET_RESPAWN_MS = 450;
// Después de patear, el balón regresa a sus pies cuando se para, se sale o pasa este rato.
const SHOT_MAX_MS = 2600;
// Dominadas: X levanta el balón (si está cerquita); cuentan esas patadas y los cabezazos brincando. Si el balón se
// queda quieto en su cabeza, al ratito se resbala.
const JUGGLE_UP = { vy: -720, maxVx: 140 };
const TOUCH_GAP_MS = 220;
const JUGGLE_REACH = 50;
const HEAD_REST_MS = 2000;
const IDLE = { x: 0, jump: false, kick: false, slide: false, dribble: false, special: false, up: false, down: false };

// Medalla para una puntuación en un reto (0 bronce, 1 plata, 2 oro), o -1 si no alcanzó.
export function medalFor(challenge, score) {
  let medal = -1;
  challenge.medals.forEach((needed, i) => {
    if (score >= needed) medal = i;
  });
  return medal;
}

export class Challenges {
  // `scene` necesita: team (solo jugadores de a de veras), ball, inputFor(), collideBall(), kicked(), showBanner(),
  // clockText, controlsHint, narrator, startMatch() y showSetup().
  constructor(scene, depth) {
    this.scene = scene;
    this.depth = depth;
    this.players = scene.team;
    this.scores = this.players.map(() => CHALLENGES.map(() => null));
    this.challengeIndex = 0;
    this.playerIndex = 0;
    this.targets = [];
    this.layer = scene.add.container(0, 0).setDepth(depth);
    this.screen = null;
    this.start();
  }

  get challenge() {
    return CHALLENGES[this.challengeIndex];
  }

  get player() {
    return this.players[this.playerIndex];
  }

  // Le toca a un jugador: los demás se van de la cancha.
  start() {
    const { scene } = this;
    const p = this.player;
    for (const other of this.players) {
      other.reset(-500);
      other.blob.setVisible(other === p);
    }
    p.reset(this.challenge.key === 'diana' ? 520 : FIELD.width / 2);
    p.meter = 0;
    this.state = 'intro';
    this.ms = 0;
    this.score = 0;
    this.clearTargets();
    this.placeBall();
    scene.showBanner(`${this.challenge.emoji} ${this.challenge.name}`, `Le toca a ${p.label}`, INTRO_MS - 200);
    scene.controlsHint.setText(`${p.label}: ${this.challenge.hint}   ·   Mantén LB + RB + Y = salir`);
    this.refreshClock();
  }

  // El balón: en el tiro al blanco, frente a sus pies; en las dominadas, cae desde arriba sobre su cabeza.
  placeBall() {
    const { ball } = this.scene;
    const p = this.player;
    if (this.challenge.key === 'diana') ball.reset(p.x + p.facing * (p.radius + ball.radius + 10), FIELD.ground - ball.radius);
    else ball.reset(p.x, 220);
    this.shotMs = 0;
    this.kicked = false;
    this.lastTouchMs = TOUCH_GAP_MS;
    this.restMs = 0;
  }

  update(dtMs) {
    const { scene } = this;
    const { ball } = scene;
    if (this.state === 'done') {
      this.updateScreen(dtMs);
      return;
    }
    this.ms += dtMs;
    const p = this.player;
    const playing = this.state === 'play';
    if (this.state === 'intro' && this.ms >= INTRO_MS) {
      this.state = 'play';
      this.ms = 0;
      if (this.challenge.key === 'diana') for (let i = 0; i < TARGETS; i += 1) this.addTarget(i * 120);
    }
    p.update(dtMs, playing ? scene.inputFor(p) : IDLE);
    if (this.state === 'intro') return;
    if (this.state === 'result') {
      ball.update(dtMs / 1000);
      if (this.ms >= RESULT_MS) this.next();
      return;
    }
    const vyBefore = ball.vy;
    ball.update(dtMs / 1000);
    scene.collideBall(p, dtMs);
    // (En las dominadas, X no patea: levanta el balón; ver updateJuggle.)
    const juggling = this.challenge.key === 'dominadas';
    const kick = juggling ? null : p.tryKick(ball);
    if (kick) {
      if (kick === 'special') scene.kicked(p, kick);
      this.kicked = true;
    }
    if (this.challenge.key === 'diana') this.updateTargets(dtMs, kick);
    else this.updateJuggle(dtMs, vyBefore);
    this.refreshClock();
  }

  // ---------- Tiro al blanco ----------
  updateTargets(dtMs, kick) {
    const { ball } = this.scene;
    const p = this.player;
    for (const target of this.targets) {
      target.t += dtMs;
      if (target.respawnMs > 0) {
        target.respawnMs -= dtMs;
        if (target.respawnMs <= 0) this.moveTarget(target);
        continue;
      }
      if (target.moving) target.sprite.y = target.baseY + Math.sin(target.t / 500) * 60;
      if (Math.hypot(ball.x - target.sprite.x, ball.y - target.sprite.y) < TARGET_R + ball.radius) this.hitTarget(target);
    }
    // El balón regresa a sus pies cuando se para, se va lejos o pasa un rato desde que pateó.
    if (this.kicked) {
      this.shotMs += dtMs;
      const stopped = Math.abs(ball.vx) < 25 && Math.abs(ball.vy) < 25 && this.shotMs > 500;
      const gone = ball.x > FIELD.width - GOAL.depth || ball.x < GOAL.depth;
      if (stopped || gone || this.shotMs > SHOT_MAX_MS) this.placeBall();
    } else if (!kick && Math.hypot(ball.x - p.x, ball.y - p.y) > 400) {
      this.placeBall();
    }
    if (this.ms >= TARGET_MS) this.finishTurn();
  }

  addTarget(delayMs = 0) {
    const art = this.scene.textures.exists('smash:objeto-diana') ? 'smash:objeto-diana' : null;
    let sprite;
    if (art) {
      sprite = this.scene.add.image(0, 0, art);
      sprite.setScale((TARGET_R * 2.2) / Math.max(sprite.width, sprite.height));
    } else {
      sprite = this.scene.add.container(0, 0, [
        this.scene.add.circle(0, 0, TARGET_R, 0xff5a5f).setStrokeStyle(4, COLORS.ink),
        this.scene.add.circle(0, 0, TARGET_R * 0.66, 0xffffff),
        this.scene.add.circle(0, 0, TARGET_R * 0.33, 0xff5a5f),
      ]);
    }
    this.layer.add(sprite);
    const target = { sprite, t: Math.random() * 3000, respawnMs: delayMs };
    sprite.setVisible(false);
    if (delayMs <= 0) this.moveTarget(target);
    this.targets.push(target);
  }

  // Pone la diana en otro lugar (lejos de las demás); una de cada tres sube y baja.
  moveTarget(target) {
    let x = 0;
    let y = 0;
    for (let tries = 0; tries < 20; tries += 1) {
      x = Phaser.Math.Between(...TARGET_AREA.x);
      y = Phaser.Math.Between(...TARGET_AREA.y);
      if (this.targets.every((t) => t === target || !t.sprite.visible || Math.hypot(t.sprite.x - x, t.sprite.y - y) > TARGET_R * 3)) break;
    }
    target.baseY = Math.min(y, FIELD.ground - 60 - 60);
    target.moving = Math.random() < 0.34;
    target.respawnMs = 0;
    target.sprite
      .setPosition(x, target.moving ? target.baseY : y)
      .setVisible(true)
      .setAlpha(0);
    this.scene.tweens.add({ targets: target.sprite, alpha: 1, duration: 200 });
  }

  hitTarget(target) {
    const { scene } = this;
    this.score += 1;
    target.sprite.setVisible(false);
    target.respawnMs = TARGET_RESPAWN_MS;
    burst(scene, target.sprite.x, target.sprite.y, 0xffc93c, 14);
    comicHit(scene, target.sprite.x, target.sprite.y - 40, '¡TOC!');
    sfx.coin();
    if (this.score % 5 === 0) scene.narrator.line([`¡Ya van ${this.score}!`, '¡Qué puntería!']);
    // El balón regresa a sus pies para el siguiente tiro.
    this.placeBall();
  }

  clearTargets() {
    for (const target of this.targets) {
      this.scene.tweens.killTweensOf(target.sprite);
      target.sprite.destroy();
    }
    this.targets = [];
  }

  // ---------- Dominadas ----------
  updateJuggle(dtMs, vyBefore) {
    const { ball } = this.scene;
    const p = this.player;
    this.lastTouchMs += dtMs;
    // X (o B) cerca del balón, de cualquier lado: lo levanta derechito (para que los peques sí puedan).
    const near = Math.hypot(ball.x - p.x, ball.y - p.y) < p.radius + ball.radius + JUGGLE_REACH && ball.y < p.y + p.radius;
    const tap = controls.justPressed(p.deviceId, 'x') || controls.justPressed(p.deviceId, 'b');
    const lift = tap && near;
    if (lift) {
      ball.vx = Phaser.Math.Clamp(ball.vx * 0.15 + (FIELD.width / 2 - ball.x) * 0.2, -JUGGLE_UP.maxVx, JUGGLE_UP.maxVx);
      ball.vy = JUGGLE_UP.vy;
      ball.lastTouch = p;
    }
    // Un toque: lo levantó con X o le dio un cabezazo brincando (el balón venía bajando y ahora sube).
    const touching = Math.hypot(ball.x - p.x, ball.y - p.y) < p.radius + ball.radius + 30;
    const header = touching && p.z > 5 && vyBefore > 0 && ball.vy < -150;
    if ((lift || header) && this.lastTouchMs >= TOUCH_GAP_MS) {
      this.score += 1;
      this.lastTouchMs = 0;
      sfx.hit(0.35);
      if (this.score % 5 === 0) {
        comicHit(this.scene, ball.x, ball.y - 50, `¡${this.score}!`);
        this.scene.narrator.line([`¡${this.score} toques!`, '¡No se le cae!']);
      }
    }
    // Quieto en la cabeza: al ratito se resbala hacia un lado.
    this.restMs = touching && Math.abs(ball.vy) < 80 && Math.abs(ball.vx) < 80 ? this.restMs + dtMs : 0;
    if (this.restMs > HEAD_REST_MS) {
      ball.vx = Phaser.Math.RND.sign() * 240;
      this.restMs = 0;
    }
    // Se cayó al piso: se acaba su turno.
    const onFloor = ball.y >= FIELD.ground - ball.radius - 1;
    if (onFloor || this.ms >= JUGGLE_MAX_MS) this.finishTurn();
  }

  // ---------- Resultados ----------
  refreshClock() {
    const { clockText } = this.scene;
    let text = `${this.challenge.emoji} ${this.player.label}: ${this.score}`;
    if (this.challenge.key === 'diana' && this.state === 'play') text += `  ·  ⏱ ${Math.ceil(Math.max(0, TARGET_MS - this.ms) / 1000)}`;
    clockText.setText(text).setVisible(true);
  }

  finishTurn() {
    const { scene } = this;
    const p = this.player;
    this.scores[this.playerIndex][this.challengeIndex] = this.score;
    this.clearTargets();
    this.state = 'result';
    this.ms = 0;
    const medal = medalFor(this.challenge, this.score);
    const what = this.challenge.key === 'diana' ? `${this.score} dianas` : `${this.score} toques`;
    scene.showBanner(medal >= 0 ? `${MEDALS[medal]} ¡${what}!` : `¡${what}!`, medal >= 0 ? `${p.label} ganó medalla` : '¡Otra vez será!', RESULT_MS - 300);
    if (medal >= 0) {
      p.celebrate();
      sfx.star();
    } else {
      sfx.powerDown();
    }
    if (medal === 2 && !p.isCpu) rewards.earn('futbol-retos');
  }

  // El siguiente jugador; si ya todos, el siguiente reto; si ya no hay, la tabla.
  next() {
    this.playerIndex += 1;
    if (this.playerIndex >= this.players.length) {
      this.playerIndex = 0;
      this.challengeIndex += 1;
    }
    if (this.challengeIndex >= CHALLENGES.length) {
      this.showTable();
      return;
    }
    this.start();
  }

  // La tabla de medallas: cada jugador con lo que hizo en cada reto.
  showTable() {
    const { scene } = this;
    this.state = 'done';
    this.ms = 0;
    this.scene.ball.reset(FIELD.width / 2, 300);
    for (const p of this.players) {
      p.blob.setVisible(true);
      p.reset(FIELD.width / 2 + Phaser.Math.Between(-300, 300));
      p.celebrate();
    }
    const { width } = scene.scale;
    this.screen = scene.add.container(0, 0).setDepth(this.depth + 2);
    this.screen.add(scene.add.rectangle(width / 2, 360, width, 720, 0x14112b, 0.82));
    this.screen.add(scene.add.text(width / 2, 90, '🏅 Medallas de los retos', textStyle(48, TEXT.normal, { fontStyle: 'bold' })).setOrigin(0.5));
    CHALLENGES.forEach((challenge, c) => {
      this.screen.add(
        scene.add.text(width / 2 - 60 + c * 260, 180, `${challenge.emoji} ${challenge.name}`, textStyle(24, TEXT.muted, { fontStyle: 'bold' })).setOrigin(0.5),
      );
    });
    this.players.forEach((p, r) => {
      const y = 250 + r * 70;
      this.screen.add(scene.add.rectangle(width / 2 + 40, y, 760, 58, COLORS.panel).setRounded(16));
      this.screen.add(
        scene.add
          .text(width / 2 - 270, y, p.label, textStyle(28, hexToCss(p.color), { fontStyle: 'bold', stroke: '#1b1530', strokeThickness: 5 }))
          .setOrigin(0.5),
      );
      CHALLENGES.forEach((challenge, c) => {
        const score = this.scores[r][c] ?? 0;
        const medal = medalFor(challenge, score);
        this.screen.add(
          scene.add
            .text(width / 2 - 60 + c * 260, y, `${score}  ${medal >= 0 ? MEDALS[medal] : '·'}`, textStyle(30, TEXT.normal, { fontStyle: 'bold' }))
            .setOrigin(0.5),
        );
      });
    });
    this.screen.add(scene.add.text(width / 2, 650, 'A = otra vez  ·  B = cambiar de modo', textStyle(24, TEXT.accent)).setOrigin(0.5));
    const golds = this.scores.flat().filter((score, i) => medalFor(CHALLENGES[i % CHALLENGES.length], score ?? 0) === 2).length;
    scene.narrator.line(golds ? `¡${golds === 1 ? 'Una medalla' : `${golds} medallas`} de oro!` : '¡Buenos retos!', { important: true });
    confetti(scene, [0xffc93c, 0xffffff, 0x4cd97b], 70);
    sfx.win();
    scene.controlsHint.setText('');
  }

  updateScreen(dtMs) {
    this.ms += dtMs;
    for (const p of this.players) p.update(dtMs, IDLE);
    if (this.ms < END_INPUT_DELAY_MS) return;
    const pressed = (button) => this.players.some((p) => controls.justPressed(p.deviceId, button));
    if (pressed('a')) this.scene.startMatch();
    else if (pressed('b')) this.scene.showSetup();
  }

  destroy() {
    this.clearTargets();
    this.layer.destroy();
    this.screen?.destroy();
  }
}
