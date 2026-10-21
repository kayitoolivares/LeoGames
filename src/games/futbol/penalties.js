import Phaser from 'phaser';
import { controls } from '../../shared/controls.js';
import { rewards } from '../../shared/rewards.js';
import { sfx } from '../../shared/sound.js';
import { comicHit } from '../duelo/fx.js';
import { FIELD, attackDir, barY, goalMouthX } from './field.js';

// Tanda de penales: 5 tiros por equipo (y si empatan, muerte súbita). Tira uno de un equipo contra el portero
// del otro, por turnos. El que tira escoge la altura: ↑ alto, nada = a media altura, ↓ rasante. El portero
// adivina: si se queda parado ataja los rasantes; si brinca a tiempo, los de arriba.
export const PENALTY_ROUNDS = 5;
const SPOT_DISTANCE = 400;
const SHOT_SPEED = 760;
const BALL_GRAVITY = 1100;
const KEEPER_GRAVITY = 1900;
const KEEPER_JUMP = 720;
const KEEPER_GAP = 48;
const KEEPER_RANGE = 110;
const AIM_MS = 7000;
const FLIGHT_MAX_MS = 2200;
const RESULT_MS = 1600;
const START_MS = 900;
// A qué altura llega el balón a la portería según el tiro.
const HEIGHTS = { lob: 470, normal: 540, low: 622, volley: 540 };
// Qué tanto le atina el portero de la compu.
const CPU_GUESS = { facil: 0.3, normal: 0.45, dificil: 0.6 };
const DOT_R = 10;
const DOT_GAP = 26;

export class Shootout {
  // `scene` necesita: team, ball, setup.level, score, updateScore(), showBanner(), narrator, collideBall(),
  // controlsHint, finishMatch(winner).
  constructor(scene, depth) {
    this.scene = scene;
    this.kicks = [[], []];
    this.taken = [0, 0];
    this.kept = [0, 0];
    this.turn = 0;
    this.dots = scene.add.graphics().setDepth(depth);
    this.next();
  }

  roster(team) {
    // Primero los de a de veras, luego la compu.
    const all = this.scene.team.filter((p) => p.team === team);
    return [...all.filter((p) => !p.isCpu), ...all.filter((p) => p.isCpu)];
  }

  next() {
    const { scene } = this;
    const shooters = this.roster(this.turn);
    const keepers = this.roster(1 - this.turn);
    this.shooter = shooters[this.taken[this.turn] % shooters.length];
    this.keeper = keepers[this.kept[1 - this.turn] % keepers.length];
    this.dir = attackDir(this.turn);
    this.mouth = goalMouthX(1 - this.turn);
    const spot = this.mouth - this.dir * SPOT_DISTANCE;
    for (const p of scene.team) {
      p.reset(-500);
      p.meter = 0;
      p.blob.setVisible(p === this.shooter || p === this.keeper);
    }
    this.shooter.reset(spot - this.dir * (this.shooter.radius + scene.ball.radius + 8));
    this.keeper.reset(this.mouth - this.dir * KEEPER_GAP);
    this.keeper.facing = -this.dir;
    scene.ball.reset(spot, FIELD.ground - scene.ball.radius);
    this.state = 'start';
    this.ms = 0;
    this.style = null;
    this.plan = null;
    this.cpuKickMs = Phaser.Math.Between(900, 2200);
    const round = Math.max(this.kicks[0].length, this.kicks[1].length) + (this.turn === 0 ? 1 : 0);
    const title = round > PENALTY_ROUNDS ? '¡Muerte súbita!' : `Penal ${Math.min(round, PENALTY_ROUNDS)} de ${PENALTY_ROUNDS}`;
    scene.showBanner(title, `Tira ${this.shooter.label} · ataja ${this.keeper.label}`, START_MS + 400);
    const hints = [];
    if (!this.shooter.isCpu) hints.push(`${this.shooter.label}: X = tirar (↑ alto · ↓ rasante)`);
    if (!this.keeper.isCpu) hints.push(`${this.keeper.label}: A = saltar para atajar`);
    scene.controlsHint.setText(`${hints.join('   ·   ')}   ·   Mantén LB + RB + Y = salir`);
    this.drawDots();
  }

  // Las bolitas de cada equipo: verde = gol, roja = fallado, vacía = falta tirar.
  drawDots() {
    const { width } = this.scene.scale;
    const g = this.dots.clear();
    const shown = Math.max(PENALTY_ROUNDS, this.kicks[0].length, this.kicks[1].length);
    const first = Math.max(0, shown - 7);
    for (const team of [0, 1]) {
      for (let i = first; i < shown; i += 1) {
        const k = i - first;
        const x = team === 0 ? width / 2 - 95 - k * DOT_GAP : width / 2 + 95 + k * DOT_GAP;
        const result = this.kicks[team][i];
        if (result === undefined) g.lineStyle(3, 0xffffff, 0.8).strokeCircle(x, 96, DOT_R);
        else g.fillStyle(result ? 0x4cd97b : 0xff5a5f, 1).fillCircle(x, 96, DOT_R).lineStyle(3, 0x1b1530, 1).strokeCircle(x, 96, DOT_R);
      }
    }
  }

  shooterInput() {
    const p = this.shooter;
    if (this.state !== 'aim') return IDLE;
    // La compu tira después de pensarle tantito; si uno de a de veras no tira en 7 segundos, tira solo.
    if (p.isCpu || this.ms > AIM_MS) {
      if (p.isCpu && this.ms < this.cpuKickMs) return IDLE;
      const roll = Math.random();
      return { ...IDLE, kick: true, up: roll < 0.35, down: roll > 0.68 };
    }
    const id = p.deviceId;
    const stick = controls.getStick(id);
    return { ...IDLE, kick: controls.justPressed(id, 'x') || controls.justPressed(id, 'b'), up: stick.y < -0.5, down: stick.y > 0.5 };
  }

  keeperInput() {
    const p = this.keeper;
    if (!p.isCpu) {
      const id = p.deviceId;
      const stick = controls.getStick(id);
      return { ...IDLE, x: this.state === 'result' ? 0 : stick.x, jump: controls.justPressed(id, 'a') || (stick.y < -0.6 && p.z === 0 && this.state === 'flight') };
    }
    if (this.state !== 'flight' || !this.plan) return IDLE;
    return { ...IDLE, jump: this.plan.jump && this.ms >= this.plan.atMs };
  }

  update(dtMs) {
    const { scene } = this;
    const { ball } = scene;
    this.ms += dtMs;
    if (this.state === 'start' && this.ms >= START_MS) {
      this.state = 'aim';
      this.ms = 0;
    }
    this.shooter.update(dtMs, this.shooterInput());
    this.keeper.update(dtMs, this.keeperInput());
    // El portero no sale de su área chiquita.
    const near = this.mouth - this.dir * KEEPER_GAP;
    const far = this.mouth - this.dir * (KEEPER_GAP + KEEPER_RANGE);
    this.keeper.x = Phaser.Math.Clamp(this.keeper.x, Math.min(near, far), Math.max(near, far));
    if (this.state === 'aim') {
      const kick = this.shooter.tryKick(ball);
      if (kick) this.shoot(kick);
    } else if (this.state === 'flight') {
      ball.update(dtMs / 1000);
      scene.collideBall(this.keeper);
      this.checkShot();
    } else if (this.state === 'result') {
      ball.update(dtMs / 1000);
      scene.collideBall(this.keeper);
      if (this.ms >= RESULT_MS) this.afterKick();
    }
  }

  // El tiro va a la altura que escogió (la fuerza la calcula el juego para que llegue justo).
  shoot(style) {
    const { ball } = this.scene;
    const target = HEIGHTS[style] ?? HEIGHTS.normal;
    const g = BALL_GRAVITY * ball.gravity;
    const t = Math.abs(this.mouth - ball.x) / SHOT_SPEED;
    ball.vx = this.dir * SHOT_SPEED;
    ball.vy = (target - ball.y - 0.5 * g * t * t) / t;
    ball.lastTouch = this.shooter;
    this.style = style;
    this.state = 'flight';
    this.ms = 0;
    if (this.keeper.isCpu) this.plan = this.keeperPlan(style);
  }

  // El portero de la compu adivina (más seguido en Difícil): si atina, se queda parado con los rasantes
  // o brinca justo a tiempo con los de arriba; si no, hace lo contrario.
  keeperPlan(style) {
    const { ball } = this.scene;
    const keeper = this.keeper;
    const guess = Math.random() < (CPU_GUESS[this.scene.match.level] ?? 0.4);
    const high = style !== 'low';
    if (guess !== high) return { jump: !high, atMs: Phaser.Math.Between(0, 200) };
    if (!high) return { jump: false, atMs: 0 };
    // ¿A qué altura y cuándo llega el balón al portero?
    const arrive = Math.abs(keeper.x - ball.x) / SHOT_SPEED;
    const yAt = ball.y + ball.vy * arrive + 0.5 * BALL_GRAVITY * ball.gravity * arrive * arrive;
    const z = Math.max(0, FIELD.ground - keeper.radius - yAt);
    const g = KEEPER_GRAVITY * keeper.gravity;
    const disc = KEEPER_JUMP * KEEPER_JUMP - 2 * g * z;
    const rise = disc > 0 ? (KEEPER_JUMP - Math.sqrt(disc)) / g : KEEPER_JUMP / g;
    return { jump: true, atMs: Math.max(0, (arrive - rise) * 1000) };
  }

  checkShot() {
    const { ball } = this.scene;
    const crossed = (ball.x - this.mouth) * this.dir > ball.radius * 0.3;
    if (crossed && ball.y > barY(1 - this.turn)) this.result(true);
    else if (ball.vx * this.dir < 0) this.result(false, ball.lastTouch === this.keeper ? 'saved' : 'miss');
    else if (crossed || this.ms > FLIGHT_MAX_MS) this.result(false, 'miss');
  }

  result(goal, why = null) {
    const { scene } = this;
    this.state = 'result';
    this.ms = 0;
    this.kicks[this.turn].push(goal);
    this.taken[this.turn] += 1;
    this.kept[1 - this.turn] += 1;
    if (goal) {
      scene.score[this.turn] += 1;
      scene.updateScore();
      this.shooter.stats.goals += 1;
      this.shooter.celebrate();
      if (!this.shooter.isCpu) rewards.earn('futbol-gol');
      scene.showBanner('¡GOL!', '', RESULT_MS - 300, undefined, false);
      scene.narrator.line([`¡Gol de ${this.shooter.label}!`, '¡Adentro!', '¡No falla!'], { important: true });
      scene.crowd.cheer(1400, this.turn);
      scene.shakeNet(1 - this.turn);
      sfx.star();
    } else if (why === 'saved') {
      this.keeper.stats.saves += 1;
      this.keeper.celebrate();
      comicHit(scene, this.scene.ball.x, this.scene.ball.y - 40, '¡ATAJADA!', { big: true });
      scene.narrator.line([`¡Qué atajada de ${this.keeper.label}!`, '¡La paró!', '¡Atajadón!'], { important: true });
      scene.crowd.cheer(1200, 1 - this.turn);
      sfx.block();
    } else {
      scene.showBanner('¡Fuera!', '', RESULT_MS - 300, '#ff9a9a', false);
      scene.narrator.line(['¡Uy, se fue!', '¡Por poquito!'], { important: true });
      sfx.powerDown();
    }
    this.drawDots();
  }

  // ¿Ya ganó alguien? En los 5 primeros, si ya no lo alcanzan; luego, en cuanto uno falla y el otro no.
  winner() {
    const goals = this.kicks.map((list) => list.filter(Boolean).length);
    const [a, b] = this.kicks.map((list) => list.length);
    if (a <= PENALTY_ROUNDS && b <= PENALTY_ROUNDS) {
      const left = [PENALTY_ROUNDS - a, PENALTY_ROUNDS - b];
      if (goals[0] > goals[1] + left[1]) return 0;
      if (goals[1] > goals[0] + left[0]) return 1;
      if (a < PENALTY_ROUNDS || b < PENALTY_ROUNDS) return -1;
    }
    if (a !== b) return -1;
    return goals[0] === goals[1] ? -1 : goals[0] > goals[1] ? 0 : 1;
  }

  afterKick() {
    const winner = this.winner();
    if (winner >= 0) {
      this.finish(winner);
      return;
    }
    this.turn = 1 - this.turn;
    this.next();
  }

  finish(winner) {
    for (const p of this.scene.team) {
      p.blob.setVisible(true);
      p.reset(FIELD.width / 2 + (p.team === 0 ? -1 : 1) * Phaser.Math.Between(160, 420));
      if (p.team === winner) p.celebrate();
    }
    this.scene.ball.reset(FIELD.width / 2, 300);
    if (this.scene.team.some((p) => !p.isCpu && p.team === winner)) rewards.earn('futbol-penales');
    this.scene.finishMatch(winner);
  }

  destroy() {
    this.dots.destroy();
  }
}

const IDLE = { x: 0, jump: false, kick: false, slide: false, dribble: false, special: false, up: false, down: false };
