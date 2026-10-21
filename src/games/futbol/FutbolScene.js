import Phaser from 'phaser';
import { controls } from '../../shared/controls.js';
import { characterPicks } from '../../shared/picks.js';
import { defaultCharacter } from '../../scenes/CharacterSelectScene.js';
import { loadSmashArt } from '../smash/art.js';
import { MAX_NUMBER, numberStep } from '../smash/bloquecito.js';
import { CHARACTERS, CHARACTER_KEYS } from '../smash/characters.js';
import { frameDelta } from '../../shared/clock.js';
import { players, PLAYER_COLORS } from '../../shared/players.js';
import { rewards } from '../../shared/rewards.js';
import { sfx } from '../../shared/sound.js';
import { say } from '../../shared/voice.js';
import { COLORS, TEXT, hexToCss, textStyle } from '../../ui/style.js';
import { burst, confetti, popText } from '../brawl/effects.js';
import { comicHit, dustPuff, loadFxArt, shockwave, spark } from '../duelo/fx.js';
import { loadStageArt } from '../duelo/stage.js';
import { Ball } from './Ball.js';
import { CPU_LEVELS, cpuInput } from './cpu.js';
import { Crowd, Narrator } from './crowd.js';
import { FIELD, GOAL, GOAL_HEIGHT, TEAM_COLORS, TEAM_NAMES, UNIFORMS, attackDir, barY, drawGoals, goalMouthX, setUniforms } from './field.js';
import { FutbolPlayer } from './FutbolPlayer.js';
import { PENALTY_ROUNDS, Shootout } from './penalties.js';
import { PITCHES, PITCH_KEYS, drawPitch, loadPitchArt } from './pitches.js';
import { POWERS, Powers, loadPowerArt, powerIcon } from './powers.js';
import { COPA_ROUNDS, copaRivals, loadScreenArt, showCopaRoad, showMatchEnd } from './screens.js';

const KICKOFF_MS = 1100;
const GOAL_PAUSE_MS = 1700;
// La repetición del gol: lo último que pasó antes del gol, en cámara lenta.
const REPLAY_RECORD_MS = 1800;
const REPLAY_SPEED = 0.5;
const REPLAY_HOLD_MS = 400;
const END_INPUT_DELAY_MS = 1200;
const EXIT_HOLD_MS = 1200;
const BALL_RESTITUTION = 0.55;
const HUD_DEPTH = 10000;
const OUTLINE = { stroke: '#1b1530', strokeThickness: 5 };
const KICK_WORDS = { normal: null, lob: '¡Globito!', low: '¡Rasante!', volley: '¡Volea!' };
const MODES = { partido: 'Partido', copa: 'Copa de fútbol', penales: 'Penales' };
const TEAMS = { juntos: 'Todos contra la compu', versus: 'Unos contra otros' };
// Cómo se acaba el partido: a tantos goles o por tiempo (si empatan: gol de oro).
const END_CHOICES = [
  { goals: 3, minutes: 0 },
  { goals: 5, minutes: 0 },
  { goals: 7, minutes: 0 },
  { goals: 0, minutes: 2 },
  { goals: 0, minutes: 3 },
];
// Dónde se para cada quien en el saque (distancia desde el centro).
const KICKOFF_SPOTS = [180, 380, 280, 470];
// Atajada: un tiro fuerte hacia su portería que alguien para cerca de ella.
const SAVE_ZONE = 260;
const SAVE_SPEED = 550;
const TACKLE_REACH = 14;
const LAST_MINUTE_MS = 60000;
const BAR_SOUND_MS = 500;
const PLAY_HINT = 'A saltar · X patear (↑ globito, ↓ rasante) · B barrida · LB o RB regate · LB + RB tiro especial · Mantén LB + RB + Y salir';

// Lo último que se escogió, para no escogerlo otra vez.
const lastSetup = { mode: 'partido', teams: 'juntos', end: 1, level: 'facil', pitch: 'estadio', uniform: 0, powers: true };
const ROWS = ['mode', 'teams', 'end', 'level', 'pitch', 'uniform', 'powers'];

// El equipo de la derecha trae el uniforme que sigue.
function rivalUniform(left) {
  return (left + 1) % UNIFORMS.length;
}

// "Fútbol de bolitas": vista de lado, dos porterías y un balón que rebota. Partido (a goles o por tiempo),
// Copa (3 partidos contra la compu, cada vez más difícil) o Penales. Con tiro especial, barridas, regates,
// poderes en la cancha, repetición del gol, narrador y público que hace la ola.
export class FutbolScene extends Phaser.Scene {
  constructor() {
    super('Futbol');
  }

  init(data) {
    this.returnData = data ?? {};
  }

  preload() {
    loadSmashArt(this);
    loadPitchArt(this);
    loadPowerArt(this);
    loadScreenArt(this);
    loadFxArt(this);
    loadStageArt(this);
  }

  create() {
    // Lo de cada partido se reinicia aquí (Phaser reusa la escena).
    GOAL_HEIGHT[0] = GOAL.height;
    GOAL_HEIGHT[1] = GOAL.height;
    this.pitchParts = [];
    this.goalParts = [];
    this.nets = [];
    this.team = [];
    this.score = [0, 0];
    this.exitMs = 0;
    this.exiting = false;
    this.match = null;
    this.copa = null;
    this.copaRoad = null;
    this.shootout = null;
    this.endScreen = null;
    this.replayLayer = null;
    this.frames = [];
    this.recordT = 0;
    this.barMs = 0;
    this.saveMs = 0;
    this.powerKey = '';
    this.powerIcons = [];
    this.ball = new Ball(this);
    this.powers = new Powers(this);
    this.humans = players.sorted();
    this.picks = this.humans.map((player) => characterPicks.get(player.deviceId, defaultCharacter(player)));
    // La compu juega con personajes al azar que no escogió nadie (si alcanzan).
    const free = CHARACTER_KEYS.filter((key) => !this.picks.includes(key));
    this.cpuCharacters = Phaser.Utils.Array.Shuffle(free.length >= 2 ? free : [...CHARACTER_KEYS]);
    this.setup = { ...lastSetup };
    this.applyEnd();
    if (this.humans.length < 2) this.setup.teams = 'juntos';
    setUniforms(this.setup.uniform, rivalUniform(this.setup.uniform));
    this.usePitch(this.setup.pitch);
    this.redrawGoals();
    this.crowd = new Crowd(this);
    this.createHud();
    this.narrator = new Narrator(this, 138, HUD_DEPTH);
    this.input.keyboard?.on('keydown-ESC', () => this.exit());
    if (this.returnData.rematch) this.startMatch();
    else this.showSetup();
  }

  applyEnd() {
    Object.assign(this.setup, END_CHOICES[this.setup.end]);
  }

  // El fondo y la física de la cancha.
  usePitch(key) {
    for (const part of this.pitchParts) part.destroy();
    const { parts, update } = drawPitch(this, key);
    this.pitchParts = parts;
    this.pitchUpdate = update;
    this.pitch = PITCHES[key];
    this.ball.gravity = this.pitch.gravity;
    this.ball.friction = this.pitch.friction;
    for (const p of this.team) {
      p.grip = this.pitch.grip;
      p.gravity = this.pitch.gravity;
    }
  }

  // Las porterías se vuelven a dibujar si cambia su tamaño (poder) o el color de los equipos.
  redrawGoals() {
    for (const part of this.goalParts) part.destroy();
    const { nets, parts } = drawGoals(this);
    this.nets = nets;
    this.goalParts = parts;
  }

  createHud() {
    const { width, height } = this.scale;
    // El marcador: nombre y color de cada equipo, los goles y abajo el reloj (o a cuántos goles).
    this.board = this.add.container(0, 0).setDepth(HUD_DEPTH);
    this.board.add(this.add.rectangle(width / 2, 44, 620, 66, 0x14112b, 0.85).setRounded(20).setStrokeStyle(3, 0xffffff));
    this.teamTabs = [0, 1].map((team) =>
      this.add.rectangle(width / 2 + (team === 0 ? -195 : 195), 44, 200, 50, TEAM_COLORS[team]).setRounded(14),
    );
    this.teamLabels = [0, 1].map((team) =>
      this.add
        .text(width / 2 + (team === 0 ? -195 : 195), 44, TEAM_NAMES[team], textStyle(26, '#ffffff', { fontStyle: 'bold', ...OUTLINE }))
        .setOrigin(0.5),
    );
    this.scoreText = this.add
      .text(width / 2, 44, '0 - 0', textStyle(48, TEXT.normal, { fontStyle: 'bold', stroke: '#1b1530', strokeThickness: 8 }))
      .setOrigin(0.5);
    this.clockText = this.add
      .text(width / 2, 96, '', textStyle(20, '#ffffff', { fontStyle: 'bold', backgroundColor: '#14112bcc', padding: { x: 12, y: 4 } }))
      .setOrigin(0.5);
    this.board.add([...this.teamTabs, ...this.teamLabels, this.scoreText, this.clockText]);

    const bannerStyle = { fontStyle: 'bold', stroke: '#1b1530', strokeThickness: 10, align: 'center' };
    this.banner = this.add.text(width / 2, 250, '', textStyle(84, TEXT.accent, bannerStyle)).setOrigin(0.5).setDepth(HUD_DEPTH + 1).setAlpha(0);
    this.subBanner = this.add
      .text(width / 2, 330, '', textStyle(28, TEXT.normal, { ...bannerStyle, strokeThickness: 6 }))
      .setOrigin(0.5)
      .setDepth(HUD_DEPTH + 1)
      .setAlpha(0);
    this.controlsHint = this.add
      .text(width / 2, height - 20, '', textStyle(15, TEXT.normal, { backgroundColor: '#14112bcc', padding: { x: 10, y: 3 } }))
      .setOrigin(0.5)
      .setDepth(HUD_DEPTH);
    this.exitBar = this.add.rectangle(width / 2 - 100, height - 4, 200, 6, 0xffffff).setOrigin(0, 0.5).setScale(0, 1).setDepth(HUD_DEPTH);
    this.refreshHud();
  }

  refreshHud() {
    [0, 1].forEach((team) => {
      this.teamTabs[team].setFillStyle(TEAM_COLORS[team]);
      this.teamLabels[team].setText(TEAM_NAMES[team]);
    });
  }

  // `speak`: que la voz lo lea (si no, lo dice el narrador).
  showBanner(title, subtitle = '', holdMs = 0, color = TEXT.accent, speak = true) {
    if (speak) say(title);
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

  // Quién va en cada equipo. La compu completa: nadie juega solo contra nadie.
  buildRoster(teams) {
    const humans = this.humans.map((player) => ({ player, team: 0 }));
    if (teams === 'versus') humans.forEach((entry, i) => (entry.team = i % 2));
    const counts = [0, 1].map((team) => humans.filter((entry) => entry.team === team).length);
    const cpus = [0, 0];
    if (teams === 'juntos') cpus[1] = Math.min(2, Math.max(1, counts[0]));
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

  // ---------- Antes del partido ----------

  // El Jugador 1 escoge: modo, equipos, cómo se acaba, nivel de la compu, cancha, uniformes y poderes.
  showSetup() {
    this.phase = 'setup';
    this.copa = null;
    this.clearMatchStuff();
    this.clearTeam();
    this.hideBanner();
    this.narrator.hide();
    this.controlsHint.setText('');
    this.board.setVisible(false);
    this.score = [0, 0];
    this.updateScore();
    GOAL_HEIGHT[0] = GOAL.height;
    GOAL_HEIGHT[1] = GOAL.height;
    this.usePitch(this.setup.pitch);
    const { width } = this.scale;
    this.setupLayer = this.add.container(0, 0).setDepth(HUD_DEPTH + 2);
    this.setupLayer.add(this.add.rectangle(width / 2, 360, width, 720, 0x14112b, 0.8));
    this.setupLayer.add(this.add.text(width / 2, 62, 'Fútbol de bolitas ⚽', textStyle(48, TEXT.normal, { fontStyle: 'bold' })).setOrigin(0.5));
    this.setupRows = ROWS.map((_, i) => {
      const bg = this.add.rectangle(width / 2, 132 + i * 54, 660, 46, COLORS.panel).setRounded(16);
      const text = this.add.text(width / 2, 132 + i * 54, '', textStyle(22, TEXT.normal, { fontStyle: 'bold' })).setOrigin(0.5);
      this.setupLayer.add([bg, text]);
      return { bg, text };
    });
    this.setupRow = 0;
    this.rosterHeaders = [0, 1].map((team) => {
      const header = this.add.text(width / 2 + (team === 0 ? -200 : 200), 526, '', textStyle(28, '#ffffff', { fontStyle: 'bold', ...OUTLINE })).setOrigin(0.5);
      this.setupLayer.add(header);
      return header;
    });
    this.rosterText = [0, 1].map((team) => {
      const list = this.add.text(width / 2 + (team === 0 ? -200 : 200), 552, '', textStyle(22, TEXT.normal, { align: 'center' })).setOrigin(0.5, 0);
      this.setupLayer.add(list);
      return list;
    });
    this.setupLayer.add(this.add.text(width / 2, 526, 'vs', textStyle(28, TEXT.muted, { fontStyle: 'bold' })).setOrigin(0.5));
    this.setupLayer.add(
      this.add.text(width / 2, 694, '↑ ↓ elegir  ·  ◀ ▶ cambiar  ·  A = ¡a jugar!  ·  B = regresar', textStyle(22, TEXT.accent)).setOrigin(0.5),
    );
    this.refreshSetup();
  }

  rowEnabled(row) {
    const { mode } = this.setup;
    if (row === 'teams') return mode !== 'copa' && this.humans.length >= 2;
    if (row === 'end') return mode !== 'penales';
    if (row === 'level') return mode !== 'copa';
    if (row === 'powers') return mode !== 'penales';
    return true;
  }

  rowLabel(row) {
    const s = this.setup;
    const pitch = PITCHES[s.pitch];
    switch (row) {
      case 'mode':
        return `Modo: ${MODES[s.mode]}`;
      case 'teams':
        return `Equipos: ${TEAMS[s.mode === 'copa' ? 'juntos' : s.teams]}`;
      case 'end':
        if (s.mode === 'penales') return `${PENALTY_ROUNDS} penales para cada equipo`;
        return s.minutes ? `Por tiempo: ${s.minutes} minutos (si empatan, gol de oro)` : `Gana el que meta ${s.goals} goles`;
      case 'level':
        return s.mode === 'copa' ? 'Compu: cada partido más difícil' : `Nivel de la compu: ${CPU_LEVELS[s.level].name}`;
      case 'pitch':
        return `Cancha: ${pitch.name}${pitch.note ? ` (${pitch.note})` : ''}`;
      case 'uniform':
        return s.mode === 'copa'
          ? `Tu equipo: ${UNIFORMS[s.uniform].name}`
          : `Uniformes: ${UNIFORMS[s.uniform].name} vs ${UNIFORMS[rivalUniform(s.uniform)].name}`;
      default:
        return s.mode === 'penales' ? 'Poderes: no hay en los penales' : `Poderes en la cancha: ${s.powers ? 'Sí' : 'No'}`;
    }
  }

  refreshSetup() {
    const s = this.setup;
    setUniforms(s.uniform, s.mode === 'copa' ? copaRivals(s.uniform)[0] : rivalUniform(s.uniform));
    this.redrawGoals();
    this.refreshHud();
    this.crowd.recolor();
    this.setupRows.forEach(({ bg, text }, i) => {
      const enabled = this.rowEnabled(ROWS[i]);
      text.setText(this.rowLabel(ROWS[i])).setColor(enabled ? TEXT.normal : TEXT.muted);
      bg.setStrokeStyle(i === this.setupRow ? 4 : 2, i === this.setupRow ? COLORS.accent : COLORS.panelBorder);
    });
    const roster = this.buildRoster(s.mode === 'copa' ? 'juntos' : s.teams);
    this.rosterHeaders.forEach((header, team) => header.setText(TEAM_NAMES[team]).setColor(hexToCss(TEAM_COLORS[team])));
    this.rosterText.forEach((list, team) => {
      list.setText(
        roster
          .filter((entry) => entry.team === team)
          .map((entry) => `${entry.label} · ${CHARACTERS[entry.character].name}`)
          .join('\n'),
      );
    });
  }

  cycle(list, value, step) {
    return list[(list.indexOf(value) + step + list.length) % list.length];
  }

  updateSetup() {
    const host = players.host();
    if (!host) return;
    const id = host.deviceId;
    const move = (controls.justPressed(id, 'down') ? 1 : 0) - (controls.justPressed(id, 'up') ? 1 : 0);
    if (move !== 0) {
      // Se brinca los renglones que no aplican en este modo.
      do {
        this.setupRow = (this.setupRow + move + ROWS.length) % ROWS.length;
      } while (!this.rowEnabled(ROWS[this.setupRow]));
      sfx.select();
      this.refreshSetup();
    }
    const step = (controls.justPressed(id, 'right') ? 1 : 0) - (controls.justPressed(id, 'left') ? 1 : 0);
    if (step !== 0) {
      const s = this.setup;
      const row = ROWS[this.setupRow];
      if (row === 'mode') s.mode = this.cycle(Object.keys(MODES), s.mode, step);
      else if (row === 'teams') s.teams = this.cycle(Object.keys(TEAMS), s.teams, step);
      else if (row === 'end') {
        s.end = (s.end + step + END_CHOICES.length) % END_CHOICES.length;
        this.applyEnd();
      } else if (row === 'level') s.level = this.cycle(Object.keys(CPU_LEVELS), s.level, step);
      else if (row === 'pitch') {
        s.pitch = this.cycle(PITCH_KEYS, s.pitch, step);
        this.usePitch(s.pitch);
      } else if (row === 'uniform') s.uniform = (s.uniform + step + UNIFORMS.length) % UNIFORMS.length;
      else s.powers = !s.powers;
      sfx.select();
      this.refreshSetup();
    }
    if (controls.justPressed(id, 'a')) {
      sfx.confirm();
      Object.assign(lastSetup, this.setup);
      this.setupLayer.destroy();
      if (this.setup.mode === 'copa') {
        this.copa = { round: 0, rivals: copaRivals(this.setup.uniform) };
        this.showCopa();
      } else this.startMatch();
    } else if (controls.justPressed(id, 'b')) {
      this.exit();
    }
  }

  // ---------- La Copa ----------

  showCopa() {
    this.phase = 'copa';
    this.clearMatchStuff();
    this.hideBanner();
    this.narrator.hide();
    this.controlsHint.setText('');
    this.board.setVisible(false);
    this.copaRoad = showCopaRoad(this, this.copa.round, this.copa.rivals, this.setup.uniform, HUD_DEPTH + 2);
  }

  updateCopaRoad() {
    const ids = this.humans.map((player) => player.deviceId);
    if (ids.some((id) => controls.justPressed(id, 'a'))) {
      sfx.confirm();
      this.copaRoad.destroy();
      this.copaRoad = null;
      this.startMatch();
    } else if (ids.some((id) => controls.justPressed(id, 'b'))) {
      sfx.back();
      this.copaRoad.destroy();
      this.copaRoad = null;
      this.showSetup();
    }
  }

  // ---------- El partido ----------

  // Cómo es este partido (en la Copa cambian el rival, el nivel y la cancha en cada ronda).
  matchConfig() {
    const s = this.setup;
    const base = { goals: s.goals, minutes: s.minutes, powers: s.powers };
    if (this.copa) {
      const { round, rivals } = this.copa;
      const pitch = PITCH_KEYS[(PITCH_KEYS.indexOf(s.pitch) + round) % PITCH_KEYS.length];
      return { ...base, kind: 'copa', teams: 'juntos', level: COPA_ROUNDS[round].level, pitch, uniforms: [s.uniform, rivals[round]] };
    }
    return {
      ...base,
      kind: s.mode,
      teams: s.teams,
      level: s.level,
      pitch: s.pitch,
      uniforms: [s.uniform, rivalUniform(s.uniform)],
      powers: s.powers && s.mode !== 'penales',
    };
  }

  clearTeam() {
    for (const player of this.team) player.destroy();
    this.team = [];
  }

  // Quita lo que queda del partido anterior (penales, pantalla final, poderes, repetición).
  clearMatchStuff() {
    this.shootout?.destroy();
    this.shootout = null;
    this.endScreen?.destroy();
    this.endScreen = null;
    this.replayLayer?.destroy();
    this.replayLayer = null;
    this.powers.clear();
    this.ball.setScale(1);
  }

  startMatch() {
    this.clearMatchStuff();
    this.hideBanner();
    this.match = this.matchConfig();
    const m = this.match;
    setUniforms(...m.uniforms);
    GOAL_HEIGHT[0] = GOAL.height;
    GOAL_HEIGHT[1] = GOAL.height;
    this.redrawGoals();
    this.refreshHud();
    this.crowd.recolor();
    this.clearTeam();
    this.team = this.buildRoster(m.teams).map((entry) => new FutbolPlayer(this, entry));
    this.usePitch(m.pitch);
    // Un Bloquecito de la compu sale con un número al azar.
    for (const p of this.team) if (p.isCpu) p.look.setNumber(1 + Math.floor(Math.random() * MAX_NUMBER));
    // Si un equipo tiene 2 de la compu, uno se queda de portero.
    for (const team of [0, 1]) {
      const cpus = this.team.filter((p) => p.isCpu && p.team === team);
      if (cpus.length > 1) cpus[cpus.length - 1].goalie = true;
    }
    this.score = [0, 0];
    this.clockMs = m.minutes * 60000;
    this.goldenGoal = false;
    this.lastMinuteSaid = false;
    this.countdownBeep = 11;
    this.powers.enabled = m.powers;
    this.board.setVisible(true);
    this.updateScore();
    this.updateClockText();
    this.narrator.hide();
    if (m.kind === 'penales') {
      this.phase = 'penalties';
      this.phaseMs = 0;
      this.shootout = new Shootout(this, HUD_DEPTH);
      this.updateClockText();
      return;
    }
    this.controlsHint.setText(PLAY_HINT);
    this.firstKickoff = true;
    this.kickoff();
  }

  kickoff() {
    this.phase = 'kickoff';
    this.phaseMs = 0;
    this.powers.clear();
    this.frames = [];
    this.recordT = 0;
    for (const team of [0, 1]) {
      this.team
        .filter((p) => p.team === team)
        .forEach((p, i) => p.reset(FIELD.width / 2 + (team === 0 ? -1 : 1) * KICKOFF_SPOTS[i]));
    }
    this.ball.reset(FIELD.width / 2, 250);
    this.showBanner(this.goldenGoal ? '¡Gol de oro!' : '¡A jugar!', '', KICKOFF_MS - 200, undefined, false);
    if (this.firstKickoff) {
      const copa = this.copa ? `${COPA_ROUNDS[this.copa.round].name}. ` : '';
      this.narrator.line(`${copa}¡${TEAM_NAMES[0]} contra ${TEAM_NAMES[1]}! ¡Empieza el partido!`, { important: true });
      this.firstKickoff = false;
    }
    sfx.countdown(true);
  }

  update() {
    const dt = frameDelta();
    this.updateExit(dt);
    this.crowd.update(dt);
    this.narrator.update(dt);
    this.pitchUpdate?.(dt);
    if (this.phase === 'setup') {
      this.updateSetup();
      return;
    }
    if (this.phase === 'copa') {
      this.updateCopaRoad();
      return;
    }
    this.phaseMs += dt;
    if (this.phase === 'penalties') {
      this.shootout.update(dt);
      this.renderAll();
      return;
    }
    if (this.phase === 'replay') {
      this.updateReplay(dt);
      return;
    }
    if (this.phase === 'kickoff' && this.phaseMs >= KICKOFF_MS) this.phase = 'play';
    const playing = this.phase === 'play';
    this.barMs = Math.max(0, this.barMs - dt);
    this.saveMs = Math.max(0, this.saveMs - dt);

    for (const player of this.team) {
      const still = this.phase === 'kickoff' || (player.isCpu && !playing);
      player.update(dt, still ? IDLE : this.inputFor(player));
    }
    this.separatePlayers();
    if (this.phase !== 'kickoff') this.ball.update(dt / 1000);
    for (const player of this.team) {
      this.collideBall(player, dt);
      const kick = player.tryKick(this.ball);
      if (kick) this.kicked(player, kick);
    }

    if (playing) {
      this.updateTackles();
      this.powers.update(dt);
      this.record(dt);
      this.checkGoal();
      if (this.phase === 'play') this.updateClock(dt);
    } else if (this.phase === 'goal' && this.phaseMs >= GOAL_PAUSE_MS) this.startReplay();
    else if (this.phase === 'end') this.updateEnd();
    this.renderAll();
  }

  renderAll() {
    for (const player of this.team) player.render();
    this.ball.render();
    this.updatePowerHud();
  }

  inputFor(player) {
    if (player.isCpu) return cpuInput(player, this.ball, player.goalie, CPU_LEVELS[this.match.level], this.team);
    const id = player.deviceId;
    const stick = controls.getStick(id);
    const lb = controls.isDown(id, 'lb');
    const rb = controls.isDown(id, 'rb');
    const lbTap = controls.justPressed(id, 'lb');
    const rbTap = controls.justPressed(id, 'rb');
    const both = lb && rb && (lbTap || rbTap);
    // B patea si el balón está cerquita; si no, es barrida.
    const { ball } = this;
    const nearBall = Math.hypot(ball.x - player.x, ball.y - player.y) < player.radius + ball.radius + 40;
    const b = controls.justPressed(id, 'b');
    return {
      x: stick.x,
      jump: controls.justPressed(id, 'a'),
      kick: controls.justPressed(id, 'x') || (b && nearBall),
      slide: b && !nearBall,
      dribble: !both && ((lbTap && !rb) || (rbTap && !lb)),
      special: both && !controls.isDown(id, 'y'),
      up: stick.y < -0.5,
      down: stick.y > 0.5,
      change: numberStep(id),
    };
  }

  kicked(player, kick) {
    const { ball } = this;
    if (kick === 'special') {
      comicHit(this, ball.x, ball.y - 50, player.specialWord(), { big: true });
      shockwave(this, ball.x, ball.y, ball.special?.color ?? 0xffd84d);
      this.cameras.main.shake(220, 0.007);
      this.narrator.line(player.specialName(), { important: true });
      this.crowd.cheer(900);
      return;
    }
    ball.specialBy = null;
    if (KICK_WORDS[kick]) popText(this, ball.x, ball.y - 50, KICK_WORDS[kick], '#ffffff');
    if (kick === 'volley') {
      comicHit(this, ball.x, ball.y - 40, '¡PUM!');
      this.narrator.line(['¡Qué volea!', '¡De volea!']);
    }
  }

  // El balón choca con la bolita: se empuja hacia afuera y rebota (la bolita no se mueve).
  collideBall(player, dt = 16) {
    const ball = this.ball;
    if (!player.blob.visible) return;
    const dx = ball.x - player.x;
    const dy = ball.y - player.y;
    const min = player.radius + ball.radius;
    const dist = Math.hypot(dx, dy);
    if (dist >= min || dist === 0) return;
    // El tiro especial atraviesa a todos (y a los rivales los tumba).
    if (ball.special) {
      if (ball.special.by && player.team !== ball.special.by.team && player.tumble()) {
        comicHit(this, player.x, player.y - 40, '¡PAF!', { red: true });
        sfx.hit(0.8);
      }
      return;
    }
    const incoming = ball.vx * -attackDir(player.team);
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
    // ¿Atajada? Un tiro fuerte del rival hacia su portería, parado cerquita de ella.
    const nearOwnGoal = Math.abs(player.x - goalMouthX(player.team)) < SAVE_ZONE;
    if (this.phase === 'play' && incoming > SAVE_SPEED && nearOwnGoal && ball.lastTouch && ball.lastTouch.team !== player.team && this.saveMs === 0) {
      this.saveMs = 800;
      player.stats.saves += 1;
      comicHit(this, ball.x, ball.y - 40, '¡ATAJADA!');
      this.narrator.line([`¡Qué atajada de ${player.label}!`, '¡La sacó!', '¡Atajadón!']);
      this.crowd.cheer(900, player.team);
      sfx.block();
    }
    if (ball.specialBy !== player) ball.specialBy = null;
    ball.lastTouch = player;
    player.touchedBall(dt);
  }

  // Las barridas tumban a los rivales que tocan (si no van regateando o saltando) y le pegan al balón.
  updateTackles() {
    const { ball } = this;
    for (const p of this.team) {
      if (p.slideMs <= 0) continue;
      for (const q of this.team) {
        if (q.team === p.team || p.slideHit.has(q)) continue;
        if (Math.abs(q.x - p.x) > p.radius + q.radius + TACKLE_REACH || q.z > 30) continue;
        p.slideHit.add(q);
        if (q.tumble()) {
          p.stats.steals += 1;
          comicHit(this, q.x, q.y - 50, '¡ZAS!', { red: true });
          dustPuff(this, q.x, FIELD.ground, p.facing);
          sfx.hit(0.7);
          this.narrator.line(['¡Barrida!', `¡Qué barrida de ${p.label}!`, '¡Le quitó el balón!']);
        } else if (q.dribbleMs > 0) {
          popText(this, q.x, q.y - 70, '¡Lo esquivó!', '#9fe3ff');
        }
      }
      if (!ball.special && Math.abs(ball.x - (p.x + p.facing * p.radius)) < ball.radius + 20 && ball.y > p.y - 10) {
        ball.vx = p.facing * 420;
        ball.vy = -180;
        ball.lastTouch = p;
      }
    }
  }

  // Las bolitas no se enciman (solo de lado; brincando sí se pueden pasar por arriba).
  separatePlayers() {
    for (let i = 0; i < this.team.length; i += 1) {
      for (let j = i + 1; j < this.team.length; j += 1) {
        const a = this.team[i];
        const b = this.team[j];
        if (Math.abs(a.z - b.z) > a.radius || a.slideMs > 0 || b.slideMs > 0) continue;
        const dx = b.x - a.x;
        const overlap = a.radius + b.radius - Math.abs(dx);
        if (overlap <= 0) continue;
        const push = (overlap / 2) * (Math.sign(dx) || 1);
        a.x -= push;
        b.x += push;
      }
    }
  }

  // ---------- Avisos que mandan el balón, los jugadores y los poderes ----------

  hitBar(x, y) {
    if (this.barMs > 0 || Math.hypot(this.ball.vx, this.ball.vy) < 300) return;
    this.barMs = BAR_SOUND_MS;
    spark(this, x, y);
    sfx.block();
    if (this.phase === 'play') {
      this.narrator.line(['¡Uy, al travesaño!', '¡Pegó en el palo!', '¡Uuuy, casi!']);
      this.crowd.cheer(600);
    }
  }

  meterFull(player) {
    sfx.meterFull();
    if (!player.isCpu) popText(this, player.x, player.y - 100, '¡Tiro especial listo! LB + RB', '#ffd84d');
  }

  specialReady(player) {
    sfx.special();
    popText(this, player.x, player.y - 100, player.specialName(), '#ffd84d');
  }

  dust(player) {
    dustPuff(this, player.x, FIELD.ground, -player.facing);
  }

  powerTaken(kind, team, player) {
    popText(this, player.x, player.y - 90, POWERS[kind].name, hexToCss(TEAM_COLORS[team]));
    this.narrator.line(`${POWERS[kind].name} para los ${TEAM_NAMES[team]}`);
    this.crowd.cheer(600, team);
  }

  shakeNet(goal) {
    const net = this.nets[goal];
    if (!net) return;
    this.tweens.killTweensOf(net);
    net.x = 0;
    this.tweens.add({ targets: net, x: { from: -7, to: 7 }, duration: 55, yoyo: true, repeat: 4, onComplete: () => (net.x = 0) });
  }

  // Los íconos de los poderes que trae cada equipo, junto a su nombre en el marcador (parpadean al acabarse).
  updatePowerHud() {
    const active = this.powers.active;
    const key = active.map((effect) => `${effect.kind}${effect.team}`).join();
    if (key !== this.powerKey) {
      this.powerKey = key;
      for (const icon of this.powerIcons) icon.destroy();
      const { width } = this.scale;
      const count = [0, 0];
      this.powerIcons = active.map((effect) => {
        const i = count[effect.team]++;
        const x = effect.team === 0 ? width / 2 - 340 - i * 48 : width / 2 + 340 + i * 48;
        return powerIcon(this, effect.kind, x, 44, 42).setDepth(HUD_DEPTH);
      });
    }
    active.forEach((effect, i) => this.powerIcons[i]?.setAlpha(effect.ms < 1500 && Math.floor(effect.ms / 150) % 2 ? 0.3 : 1));
  }

  // ---------- Goles, repetición y final ----------

  // Lo que pasó en los últimos segundos, para la repetición.
  record(dt) {
    this.recordT += dt;
    this.frames.push({ t: this.recordT, ball: this.ball.snapshot(), players: this.team.map((p) => p.snapshot()) });
    while (this.frames.length > 1 && this.frames[0].t < this.recordT - REPLAY_RECORD_MS) this.frames.shift();
  }

  checkGoal() {
    const ball = this.ball;
    if (ball.x < GOAL.depth - ball.radius * 0.3 && ball.y > barY(0)) this.scoreGoal(1);
    else if (ball.x > FIELD.width - GOAL.depth + ball.radius * 0.3 && ball.y > barY(1)) this.scoreGoal(0);
  }

  scoreGoal(team) {
    this.phase = 'goal';
    this.phaseMs = 0;
    this.score[team] += 1;
    this.lastGoalTeam = team;
    this.updateScore();
    const scorer = this.ball.lastTouch;
    const ours = scorer && scorer.team === team;
    if (ours) {
      scorer.stats.goals += 1;
      if (!scorer.isCpu) {
        rewards.earn('futbol-gol');
        if (this.ball.specialBy === scorer) rewards.earn('futbol-especial');
      }
    }
    for (const p of this.team) if (p.team === team) p.celebrate();
    const color = TEAM_COLORS[team];
    this.showBanner('¡GOOOL!', ours ? `de ${scorer.label} · ${TEAM_NAMES[team]}` : `de los ${TEAM_NAMES[team]}`, GOAL_PAUSE_MS - 300, hexToCss(color), false);
    const lines = ours ? [`¡Gooool de ${scorer.label}!`, `¡Golazo de los ${TEAM_NAMES[team]}!`, `¡Gol, gol, gol de ${scorer.label}!`] : ['¡Uy, autogol!', `¡Gol para los ${TEAM_NAMES[team]}!`];
    this.narrator.line(lines, { important: true });
    confetti(this, [color, 0xffffff, 0xffc93c], 60);
    burst(this, this.ball.x, this.ball.y, color, 14);
    this.shakeNet(1 - team);
    this.cameras.main.shake(250, 0.008);
    this.tweens.add({ targets: this.scoreText, scale: 1.35, duration: 160, yoyo: true });
    this.crowd.cheer(2600, team);
    this.crowd.wave(team === 0 ? 1 : -1);
    sfx.star();
  }

  // La repetición: el gol otra vez, en cámara lenta, con franjas de cine. A la brinca.
  startReplay() {
    if (this.frames.length < 10) {
      this.afterGoal();
      return;
    }
    this.phase = 'replay';
    this.phaseMs = 0;
    this.replayT = this.frames[0].t;
    this.replayIndex = 0;
    this.replayDoneMs = 0;
    this.hideBanner();
    const { width, height } = this.scale;
    this.replayLayer = this.add.container(0, 0).setDepth(HUD_DEPTH - 1);
    this.replayLayer.add(this.add.rectangle(width / 2, 0, width, 120, 0x000000, 0.75).setOrigin(0.5, 0));
    this.replayLayer.add(this.add.rectangle(width / 2, height, width, 60, 0x000000, 0.75).setOrigin(0.5, 1));
    const dot = this.add.circle(46, 150, 10, 0xff3b3b);
    this.replayLayer.add(dot);
    this.replayLayer.add(this.add.text(66, 150, 'REPETICIÓN', textStyle(26, '#ffffff', { fontStyle: 'bold', ...OUTLINE })).setOrigin(0, 0.5));
    this.tweens.add({ targets: dot, alpha: 0.2, duration: 400, yoyo: true, repeat: -1 });
  }

  updateReplay(dt) {
    const step = dt * REPLAY_SPEED;
    this.replayT += step;
    const frames = this.frames;
    while (this.replayIndex < frames.length - 1 && frames[this.replayIndex + 1].t <= this.replayT) this.replayIndex += 1;
    const frame = frames[this.replayIndex];
    this.team.forEach((p, i) => p.render(frame.players[i]));
    this.ball.replay(frame.ball, step);
    const skip = this.phaseMs > 1000 && this.humans.some((h) => controls.justPressed(h.deviceId, 'a'));
    if (this.replayIndex >= frames.length - 1) this.replayDoneMs += dt;
    if (skip || this.replayDoneMs >= REPLAY_HOLD_MS) {
      this.replayLayer.destroy();
      this.replayLayer = null;
      this.ball.endSpecial();
      this.afterGoal();
    }
  }

  afterGoal() {
    const m = this.match;
    let winner = -1;
    if (this.goldenGoal) winner = this.lastGoalTeam;
    else if (m.goals > 0) winner = this.score.findIndex((goals) => goals >= m.goals);
    if (winner < 0) this.kickoff();
    else this.finishMatch(winner);
  }

  // El reloj (solo en los partidos por tiempo): último minuto, cuenta de los 10 segundos y, si empatan, gol de oro.
  updateClock(dt) {
    const m = this.match;
    if (!m.minutes || this.goldenGoal) return;
    this.clockMs = Math.max(0, this.clockMs - dt);
    if (!this.lastMinuteSaid && this.clockMs <= LAST_MINUTE_MS && m.minutes * 60000 > LAST_MINUTE_MS) {
      this.lastMinuteSaid = true;
      this.narrator.line('¡Último minuto!', { important: true });
    }
    const seconds = Math.ceil(this.clockMs / 1000);
    if (seconds <= 10 && seconds < this.countdownBeep) {
      this.countdownBeep = seconds;
      if (seconds > 0) sfx.countdown();
    }
    this.updateClockText();
    if (this.clockMs > 0) return;
    sfx.countdown(true);
    if (this.score[0] === this.score[1]) {
      this.goldenGoal = true;
      this.updateClockText();
      this.showBanner('¡Gol de oro!', 'El que meta el siguiente gol gana', 2200, undefined, false);
      this.narrator.line('¡Se acabó el tiempo y van empatados! ¡Gol de oro: el que anote gana!', { important: true });
    } else {
      this.finishMatch(this.score[0] > this.score[1] ? 0 : 1);
    }
  }

  updateClockText() {
    const m = this.match;
    let text = '';
    if (!m) text = '';
    else if (m.kind === 'penales') text = 'Penales';
    else if (this.goldenGoal) text = '⭐ GOL DE ORO ⭐';
    else if (m.minutes) {
      const seconds = Math.ceil(this.clockMs / 1000);
      text = `⏱ ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
    } else text = `A ${m.goals} goles`;
    if (m && this.copa && text) text = `${COPA_ROUNDS[this.copa.round].name} · ${text}`;
    this.clockText.setText(text).setVisible(Boolean(text));
  }

  finishMatch(winner) {
    this.phase = 'end';
    this.phaseMs = 0;
    this.powers.clear();
    const m = this.match;
    const humansWon = this.team.some((p) => !p.isCpu && p.team === winner);
    if (humansWon) rewards.earn('futbol-gana');
    for (const p of this.team) if (p.team === winner) p.celebrate();
    let title = `¡Ganaron los ${TEAM_NAMES[winner]}!`;
    let cup = false;
    let hint = `A = revancha  ·  B = ${this.humans.length > 1 ? 'cambiar equipos' : 'cambiar el partido'}`;
    if (m.kind === 'copa') {
      const last = this.copa.round === COPA_ROUNDS.length - 1;
      if (humansWon && last) {
        title = '¡Campeones de la Copa!';
        cup = true;
        rewards.earn('futbol-copa');
        this.copaResult = 'won';
        hint = 'A = jugar otra Copa  ·  B = cambiar el partido';
      } else if (humansWon) {
        title = `¡Ganaron la ${COPA_ROUNDS[this.copa.round].name}!`;
        this.copaResult = 'next';
        hint = 'A = siguiente partido  ·  B = salir de la Copa';
      } else {
        title = `¡Uy! Ganaron los ${TEAM_NAMES[winner]}`;
        this.copaResult = 'retry';
        hint = 'A = intentar otra vez  ·  B = salir de la Copa';
      }
    }
    hint += '  ·  Mantén LB + RB + Y = salir';
    const score = `${this.score[0]} - ${this.score[1]}${m.kind === 'penales' ? ' en penales' : ''}`;
    this.hideBanner();
    this.narrator.hide();
    say(title);
    this.crowd.cheer(3000, winner);
    confetti(this, [TEAM_COLORS[winner], 0xffffff, 0xffd84d], cup ? 140 : 90);
    sfx.win();
    this.endScreen = showMatchEnd(this, { title, color: TEAM_COLORS[winner], score, players: this.team, cup, hint, depth: HUD_DEPTH + 3 });
  }

  updateEnd() {
    if (this.phaseMs < END_INPUT_DELAY_MS) return;
    const ids = this.humans.map((player) => player.deviceId);
    const a = ids.some((id) => controls.justPressed(id, 'a'));
    const b = ids.some((id) => controls.justPressed(id, 'b'));
    if (!a && !b) return;
    sfx.confirm();
    if (this.match.kind === 'copa') {
      if (b) {
        this.showSetup();
        return;
      }
      if (this.copaResult === 'won') this.copa = { round: 0, rivals: copaRivals(this.setup.uniform) };
      else if (this.copaResult === 'next') this.copa.round += 1;
      this.showCopa();
    } else if (a) this.startMatch();
    else this.showSetup();
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

const IDLE = { x: 0, jump: false, kick: false, slide: false, dribble: false, special: false, up: false, down: false };
