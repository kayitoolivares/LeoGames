import Phaser from 'phaser';
import { controls } from '../../shared/controls.js';
import { characterPicks } from '../../shared/picks.js';
import { defaultCharacter } from '../../scenes/CharacterSelectScene.js';
import { loadSmashArt } from '../smash/art.js';
import { CHARACTERS, CHARACTER_KEYS } from '../smash/characters.js';
import { frameDelta } from '../../shared/clock.js';
import { players, PLAYER_COLORS } from '../../shared/players.js';
import { rewards } from '../../shared/rewards.js';
import { sfx } from '../../shared/sound.js';
import { say } from '../../shared/voice.js';
import { COLORS, TEXT, hexToCss, textStyle } from '../../ui/style.js';
import { burst, confetti, popText } from '../brawl/effects.js';
import manifest from './art.json';
import { Ball } from './Ball.js';
import { CPU_LEVELS, cpuInput } from './cpu.js';
import { FIELD, GOAL, BAR_Y, TEAM_COLORS, TEAM_NAMES, drawGoals } from './field.js';
import { FutbolPlayer } from './FutbolPlayer.js';

const KICKOFF_MS = 1100;
const GOAL_PAUSE_MS = 2400;
const END_INPUT_DELAY_MS = 1200;
const EXIT_HOLD_MS = 1200;
const BALL_RESTITUTION = 0.55;
const HUD_DEPTH = 10000;
const OUTLINE = { stroke: '#1b1530', strokeThickness: 5 };
const KICK_WORDS = { normal: null, lob: '¡Globito!', low: '¡Rasante!', volley: '¡Volea!' };
const MODES = { juntos: 'Todos contra la compu', versus: 'Unos contra otros' };
const GOAL_CHOICES = [3, 5, 7];
// Dónde se para cada quien en el saque (distancia desde el centro).
const KICKOFF_SPOTS = [180, 380, 280, 470];

// Lo último que se escogió, para no escogerlo otra vez.
const lastSetup = { mode: 'juntos', goals: 5, level: 'facil' };
const SETUP_ROWS = 3;

// "Fútbol de bolitas": vista de lado, dos porterías y un balón que rebota. Azules contra Rojos:
// todos juntos contra la compu o unos contra otros (la compu completa los equipos).
export class FutbolScene extends Phaser.Scene {
  constructor() {
    super('Futbol');
  }

  init(data) {
    this.returnData = data ?? {};
  }

  preload() {
    loadSmashArt(this);
    for (const name of manifest.fondos) {
      if (!this.textures.exists(`futbol:fondo-${name}`)) this.load.image(`futbol:fondo-${name}`, `futbol/fondos/${name}.jpg`);
    }
  }

  create() {
    this.drawField();
    this.ball = new Ball(this);
    this.team = [];
    this.score = [0, 0];
    this.exitMs = 0;
    this.exiting = false;
    this.createHud();
    this.input.keyboard?.on('keydown-ESC', () => this.exit());
    this.humans = players.sorted();
    this.picks = this.humans.map((player) => characterPicks.get(player.deviceId, defaultCharacter(player)));
    // La compu juega con personajes al azar que no escogió nadie (si alcanzan).
    const free = CHARACTER_KEYS.filter((key) => !this.picks.includes(key));
    this.cpuCharacters = Phaser.Utils.Array.Shuffle(free.length >= 2 ? free : [...CHARACTER_KEYS]);
    this.setup = { ...lastSetup };
    if (this.humans.length < 2) this.setup.mode = 'juntos';
    if (this.returnData.rematch) this.startMatch();
    else this.showSetup();
  }

  drawField() {
    const { width, height } = this.scale;
    if (this.textures.exists('futbol:fondo-estadio')) {
      const image = this.add.image(width / 2, height / 2, 'futbol:fondo-estadio').setDepth(-100);
      image.setScale(Math.max(width / image.width, height / image.height));
    } else {
      this.add.rectangle(width / 2, height / 2, width, height, 0x8fd3ff).setDepth(-100);
      this.add.rectangle(width / 2, (FIELD.ground + height) / 2 - 140, width, height - FIELD.ground + 280, 0x5cb85c).setDepth(-99);
    }
    drawGoals(this);
  }

  createHud() {
    const { width, height } = this.scale;
    this.scoreText = this.add
      .text(width / 2, 44, '0 - 0', textStyle(56, TEXT.normal, { fontStyle: 'bold', stroke: '#1b1530', strokeThickness: 8 }))
      .setOrigin(0.5)
      .setDepth(HUD_DEPTH);
    [0, 1].forEach((team) => {
      this.add
        .text(width / 2 + (team === 0 ? -110 : 110), 44, TEAM_NAMES[team], textStyle(28, hexToCss(TEAM_COLORS[team]), { fontStyle: 'bold', ...OUTLINE }))
        .setOrigin(team === 0 ? 1 : 0, 0.5)
        .setDepth(HUD_DEPTH);
    });
    this.goalsText = this.add.text(width / 2, 86, '', textStyle(17, TEXT.normal, OUTLINE)).setOrigin(0.5).setDepth(HUD_DEPTH);

    const bannerStyle = { fontStyle: 'bold', stroke: '#1b1530', strokeThickness: 10, align: 'center' };
    this.banner = this.add.text(width / 2, 250, '', textStyle(84, TEXT.accent, bannerStyle)).setOrigin(0.5).setDepth(HUD_DEPTH + 1).setAlpha(0);
    this.subBanner = this.add
      .text(width / 2, 330, '', textStyle(28, TEXT.normal, { ...bannerStyle, strokeThickness: 6 }))
      .setOrigin(0.5)
      .setDepth(HUD_DEPTH + 1)
      .setAlpha(0);
    this.add
      .text(width / 2, height - 22, 'Stick = correr  ·  A = saltar  ·  X o B = patear (con ↑ globito, con ↓ rasante)  ·  Mantén LB + RB + Y = salir', textStyle(16, TEXT.normal, OUTLINE))
      .setOrigin(0.5)
      .setDepth(HUD_DEPTH);
    this.exitBar = this.add.rectangle(width / 2 - 100, height - 6, 200, 6, 0xffffff).setOrigin(0, 0.5).setScale(0, 1).setDepth(HUD_DEPTH);
  }

  showBanner(title, subtitle = '', holdMs = 0, color = TEXT.accent) {
    say(title);
    this.tweens.killTweensOf([this.banner, this.subBanner]);
    this.banner.setText(title).setColor(color).setAlpha(1).setScale(0.6);
    this.subBanner.setText(subtitle).setAlpha(subtitle ? 1 : 0);
    this.tweens.add({ targets: this.banner, scale: 1, duration: 220, ease: 'Back.easeOut' });
    if (holdMs > 0) this.tweens.add({ targets: [this.banner, this.subBanner], alpha: 0, delay: holdMs, duration: 300 });
  }

  hideBanner() {
    this.tweens.killTweensOf([this.banner, this.subBanner]);
    this.banner.setAlpha(0);
    this.subBanner.setAlpha(0);
  }

  // Quién va en cada equipo según el modo. La compu completa: nadie juega solo contra nadie.
  buildRoster() {
    const humans = this.humans.map((player) => ({ player, team: 0 }));
    if (this.setup.mode === 'versus') humans.forEach((entry, i) => (entry.team = i % 2));
    const counts = [0, 1].map((team) => humans.filter((entry) => entry.team === team).length);
    const cpus = [0, 0];
    if (this.setup.mode === 'juntos') cpus[1] = Math.min(2, Math.max(1, counts[0]));
    else cpus[counts[0] > counts[1] ? 1 : 0] = Math.abs(counts[0] - counts[1]);
    if (counts[1] + cpus[1] === 0) cpus[1] = 1;
    const taken = new Set(this.humans.map((player) => player.colorIndex));
    const cpuColors = PLAYER_COLORS.filter((_, i) => !taken.has(i));
    const roster = humans.map(({ player, team }, i) => ({
      team,
      color: players.color(player).hex,
      label: `J${player.slot + 1}`,
      character: this.picks[i],
      deviceId: player.deviceId,
    }));
    let k = 0;
    for (const team of [0, 1]) {
      for (let i = 0; i < cpus[team]; i += 1) {
        const character = this.cpuCharacters[k % this.cpuCharacters.length];
        roster.push({ team, color: cpuColors[k % cpuColors.length].hex, label: 'CPU', character, deviceId: null });
        k += 1;
      }
    }
    return roster;
  }

  // Pantalla de antes del partido: el Jugador 1 escoge modo, a cuántos goles y el nivel de la compu.
  showSetup() {
    this.phase = 'setup';
    this.setupRow = 0;
    this.clearTeam();
    this.hideBanner();
    const { width } = this.scale;
    this.setupLayer = this.add.container(0, 0).setDepth(HUD_DEPTH + 2);
    this.setupLayer.add(this.add.rectangle(width / 2, 360, width, 720, 0x14112b, 0.82));
    this.setupLayer.add(this.add.text(width / 2, 120, 'Fútbol de bolitas ⚽', textStyle(52, TEXT.normal, { fontStyle: 'bold' })).setOrigin(0.5));
    this.setupRows = Array.from({ length: SETUP_ROWS }, (_, i) => {
      const bg = this.add.rectangle(width / 2, 205 + i * 64, 560, 52, COLORS.panel).setRounded(16);
      const text = this.add.text(width / 2, 205 + i * 64, '', textStyle(24, TEXT.normal, { fontStyle: 'bold' })).setOrigin(0.5);
      this.setupLayer.add([bg, text]);
      return { bg, text };
    });
    this.rosterText = [0, 1].map((team) => {
      const x = width / 2 + (team === 0 ? -170 : 170);
      this.setupLayer.add(this.add.text(x, 420, TEAM_NAMES[team], textStyle(30, hexToCss(TEAM_COLORS[team]), { fontStyle: 'bold' })).setOrigin(0.5));
      const list = this.add.text(x, 456, '', textStyle(24, TEXT.normal, { align: 'center' })).setOrigin(0.5, 0);
      this.setupLayer.add(list);
      return list;
    });
    this.setupLayer.add(this.add.text(width / 2, 420, 'vs', textStyle(30, TEXT.muted, { fontStyle: 'bold' })).setOrigin(0.5));
    this.setupLayer.add(
      this.add.text(width / 2, 620, '↑ ↓ elegir  ·  ◀ ▶ cambiar  ·  A = ¡a jugar!  ·  B = regresar', textStyle(22, TEXT.accent)).setOrigin(0.5),
    );
    this.refreshSetup();
  }

  refreshSetup() {
    const labels = [
      `Equipos: ${MODES[this.setup.mode]}`,
      `Goles para ganar: ${this.setup.goals}`,
      `Nivel de la compu: ${CPU_LEVELS[this.setup.level].name}`,
    ];
    this.setupRows.forEach(({ bg, text }, i) => {
      text.setText(labels[i]);
      bg.setStrokeStyle(i === this.setupRow ? 4 : 2, i === this.setupRow ? COLORS.accent : COLORS.panelBorder);
    });
    const roster = this.buildRoster();
    this.rosterText.forEach((list, team) => {
      list.setText(
        roster
          .filter((entry) => entry.team === team)
          .map((entry) => `${entry.label} · ${CHARACTERS[entry.character].name}`)
          .join('\n'),
      );
    });
  }

  updateSetup() {
    const host = players.host();
    if (!host) return;
    const id = host.deviceId;
    const move = (controls.justPressed(id, 'down') ? 1 : 0) - (controls.justPressed(id, 'up') ? 1 : 0);
    if (move !== 0) {
      this.setupRow = (this.setupRow + move + SETUP_ROWS) % SETUP_ROWS;
      sfx.select();
      this.refreshSetup();
    }
    const step = (controls.justPressed(id, 'right') ? 1 : 0) - (controls.justPressed(id, 'left') ? 1 : 0);
    if (step !== 0) {
      if (this.setupRow === 0) {
        const modes = this.humans.length < 2 ? ['juntos'] : Object.keys(MODES);
        this.setup.mode = modes[(modes.indexOf(this.setup.mode) + step + modes.length) % modes.length];
      } else if (this.setupRow === 1) {
        const i = GOAL_CHOICES.indexOf(this.setup.goals);
        this.setup.goals = GOAL_CHOICES[(i + step + GOAL_CHOICES.length) % GOAL_CHOICES.length];
      } else {
        const levels = Object.keys(CPU_LEVELS);
        this.setup.level = levels[(levels.indexOf(this.setup.level) + step + levels.length) % levels.length];
      }
      sfx.select();
      this.refreshSetup();
    }
    if (controls.justPressed(id, 'a')) {
      sfx.confirm();
      Object.assign(lastSetup, this.setup);
      this.setupLayer.destroy();
      this.startMatch();
    } else if (controls.justPressed(id, 'b')) {
      this.exit();
    }
  }

  clearTeam() {
    for (const player of this.team) player.destroy();
    this.team = [];
  }

  startMatch() {
    this.clearTeam();
    this.team = this.buildRoster().map((entry) => new FutbolPlayer(this, entry));
    // Si un equipo tiene 2 de la compu, uno se queda de portero.
    for (const team of [0, 1]) {
      const cpus = this.team.filter((p) => p.isCpu && p.team === team);
      if (cpus.length > 1) cpus[cpus.length - 1].goalie = true;
    }
    this.score = [0, 0];
    this.goalsText.setText(`Gana el primero en meter ${this.setup.goals}`);
    this.updateScore();
    this.kickoff();
  }

  kickoff() {
    this.phase = 'kickoff';
    this.phaseMs = 0;
    for (const team of [0, 1]) {
      this.team
        .filter((p) => p.team === team)
        .forEach((p, i) => p.reset(FIELD.width / 2 + (team === 0 ? -1 : 1) * KICKOFF_SPOTS[i]));
    }
    this.ball.reset(FIELD.width / 2, 250);
    this.showBanner('¡A jugar!', '', KICKOFF_MS - 200);
    sfx.countdown(true);
  }

  update() {
    const dt = frameDelta();
    this.updateExit(dt);
    if (this.phase === 'setup') {
      this.updateSetup();
      return;
    }
    this.phaseMs += dt;
    if (this.phase === 'kickoff' && this.phaseMs >= KICKOFF_MS) this.phase = 'play';
    const moving = this.phase !== 'kickoff';

    for (const player of this.team) player.update(dt, moving ? this.inputFor(player) : IDLE);
    this.separatePlayers();
    if (moving) this.ball.update(dt / 1000);
    for (const player of this.team) {
      this.collideBall(player);
      const kick = player.tryKick(this.ball);
      if (kick && KICK_WORDS[kick]) popText(this, this.ball.x, this.ball.y - 50, KICK_WORDS[kick], '#ffffff');
    }

    if (this.phase === 'play') this.checkGoal();
    else if (this.phase === 'goal' && this.phaseMs >= GOAL_PAUSE_MS) this.afterGoal();
    else if (this.phase === 'end') this.updateEnd();

    for (const player of this.team) player.render();
    this.ball.render();
  }

  inputFor(player) {
    if (player.isCpu) return this.phase === 'end' ? IDLE : cpuInput(player, this.ball, player.goalie, CPU_LEVELS[this.setup.level]);
    const id = player.deviceId;
    const stick = controls.getStick(id);
    return {
      x: stick.x,
      jump: controls.justPressed(id, 'a'),
      kick: controls.justPressed(id, 'x') || controls.justPressed(id, 'b'),
      up: stick.y < -0.5,
      down: stick.y > 0.5,
    };
  }

  // El balón choca con la bolita: se empuja hacia afuera y rebota (la bolita no se mueve).
  collideBall(player) {
    const ball = this.ball;
    const dx = ball.x - player.x;
    const dy = ball.y - player.y;
    const min = player.radius + ball.radius;
    const dist = Math.hypot(dx, dy);
    if (dist >= min || dist === 0) return;
    const nx = dx / dist;
    const ny = dy / dist;
    ball.x = player.x + nx * min;
    ball.y = player.y + ny * min;
    const relative = (ball.vx - player.vx) * nx + (ball.vy + player.vz) * ny;
    if (relative < 0) {
      ball.vx -= (1 + BALL_RESTITUTION) * relative * nx;
      ball.vy -= (1 + BALL_RESTITUTION) * relative * ny;
    }
    ball.vx += player.vx * 0.15;
    ball.lastTouch = player;
  }

  // Las bolitas no se enciman (solo de lado; brincando sí se pueden pasar por arriba).
  separatePlayers() {
    for (let i = 0; i < this.team.length; i += 1) {
      for (let j = i + 1; j < this.team.length; j += 1) {
        const a = this.team[i];
        const b = this.team[j];
        if (Math.abs(a.z - b.z) > a.radius) continue;
        const dx = b.x - a.x;
        const overlap = a.radius + b.radius - Math.abs(dx);
        if (overlap <= 0) continue;
        const push = (overlap / 2) * (Math.sign(dx) || 1);
        a.x -= push;
        b.x += push;
      }
    }
  }

  checkGoal() {
    const ball = this.ball;
    if (ball.y <= BAR_Y) return;
    if (ball.x < GOAL.depth - ball.radius * 0.3) this.scoreGoal(1);
    else if (ball.x > FIELD.width - GOAL.depth + ball.radius * 0.3) this.scoreGoal(0);
  }

  scoreGoal(team) {
    this.phase = 'goal';
    this.phaseMs = 0;
    this.score[team] += 1;
    this.updateScore();
    const scorer = this.ball.lastTouch;
    const own = scorer && scorer.team === team;
    if (own && !scorer.isCpu) rewards.earn('futbol-gol');
    const color = TEAM_COLORS[team];
    this.showBanner('¡GOOOL!', own ? `de ${scorer.label} · ${TEAM_NAMES[team]}` : `de los ${TEAM_NAMES[team]}`, GOAL_PAUSE_MS - 400, hexToCss(color));
    confetti(this, [color, 0xffffff, 0xffc93c], 60);
    burst(this, this.ball.x, this.ball.y, color, 14);
    this.cameras.main.shake(250, 0.008);
    this.tweens.add({ targets: this.scoreText, scale: 1.35, duration: 160, yoyo: true });
    sfx.star();
  }

  afterGoal() {
    const winner = this.score.findIndex((goals) => goals >= this.setup.goals);
    if (winner < 0) {
      this.kickoff();
      return;
    }
    this.phase = 'end';
    this.phaseMs = 0;
    const humansWon = this.team.some((p) => !p.isCpu && p.team === winner);
    if (humansWon) rewards.earn('futbol-gana');
    const choose = this.humans.length > 1 ? '  ·  B = cambiar equipos' : '';
    this.showBanner(`¡Ganaron los ${TEAM_NAMES[winner]}!`, `A = revancha${choose}  ·  Mantén LB + RB + Y = salir`, 0, hexToCss(TEAM_COLORS[winner]));
    confetti(this, [TEAM_COLORS[winner], 0xffffff], 90);
    sfx.win();
  }

  updateEnd() {
    if (this.phaseMs < END_INPUT_DELAY_MS) return;
    const ids = this.humans.map((player) => player.deviceId);
    if (ids.some((id) => controls.justPressed(id, 'a'))) {
      this.hideBanner();
      this.startMatch();
    } else if (this.humans.length > 1 && ids.some((id) => controls.justPressed(id, 'b'))) {
      this.showSetup();
    }
  }

  updateScore() {
    this.scoreText.setText(`${this.score[0]} - ${this.score[1]}`);
  }

  updateExit(dt) {
    const holding = this.humans.some((player) => controls.holdingExit(player.deviceId));
    this.exitMs = holding ? this.exitMs + dt : 0;
    this.exitBar.setScale(Math.min(1, this.exitMs / EXIT_HOLD_MS), 1);
    if (this.exitMs >= EXIT_HOLD_MS) this.exit();
  }

  exit() {
    if (this.exiting) return;
    this.exiting = true;
    this.scene.start('Menu', { selected: this.returnData.selected });
  }
}

const IDLE = { x: 0, jump: false, kick: false, up: false, down: false };
