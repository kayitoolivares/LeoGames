import Phaser from 'phaser';
import { controls } from '../../shared/controls.js';
import { frameDelta, setTimeScale } from '../../shared/clock.js';
import { characterPicks } from '../../shared/picks.js';
import { players, PLAYER_COLORS } from '../../shared/players.js';
import { rewards } from '../../shared/rewards.js';
import { sfx } from '../../shared/sound.js';
import { say } from '../../shared/voice.js';
import { defaultCharacter } from '../../scenes/CharacterSelectScene.js';
import { COLORS, TEXT, hexToCss, textStyle } from '../../ui/style.js';
import { burst, confetti, fireworks, popText, randomPow } from '../brawl/effects.js';
import { loadSmashArt } from '../smash/art.js';
import { numberStep } from '../smash/bloquecito.js';
import { CHARACTERS, CHARACTER_KEYS } from '../smash/characters.js';
import { ARENAS, ARENA_KEYS, drawArena, loadArenaArt } from './arenas.js';
import { BOSSES, isBoss, loadBossArt } from './boss.js';
import { CPU_LEVELS, DUMMY, cpuInput } from './cpu.js';
import { COSTUMES, COSTUME_NAMES, DueloFighter, FLOOR, MAX_HEALTH, METER_MAX, SUPER_MS, WALLS } from './DueloFighter.js';
import { FinalMove } from './final.js';
import { Drills, MODES, SURVIVAL_STICKER_AT, Survival, Tournament, bossRush, showLadder, survivalRecord } from './modes.js';
import { DizzyStars, comicHit, dustPuff, loadFxArt, shockwave as shockRing, spark } from './fx.js';
import { loadShowArt, showVersus, showVictory } from './show.js';
import { StageLife, loadStageArt } from './stage.js';
import { Shot } from './shots.js';
import { Assist, pickHelper } from './assist.js';
import { CHALLENGES, completeChallenge, newChallengeStats, showChallenges } from './challenges.js';
import { FamilyCup, showBracket } from './family.js';
import { FIGHT_ITEMS, FightItems } from './items.js';
import { ArenaEvents } from './places.js';
import { DUO_CPU_CHANCE, DuoWatch, duoFor } from '../smash/duos.js';
import { duoEffect } from '../smash/duofx.js';
import { epicMoment } from '../../ui/epic.js';
import { fame, showFame } from './records.js';
import { KoReplay } from './replay.js';
import { SCHOOL_PARRY_MS, School } from './school.js';
import { FightTalk } from './talk.js';
import { go } from '../../shared/transition.js';
import { bounceIn } from '../../ui/bounce.js';

const ROUND_SECONDS = 60;
const ROUND_INTRO_MS = 1100;
const FIGHT_INTRO_MS = 700;
const KO_PAUSE_MS = 2800;
const SLOW_MOTION_MS = 800;
const END_INPUT_DELAY_MS = 1200;
const EXIT_HOLD_MS = 1200;
const START_X = [WALLS.left + 340, WALLS.right - 340];
const HUD_DEPTH = 10000;
const OUTLINE = { stroke: '#1b1530', strokeThickness: 5 };
const BAR = { width: 500, height: 30, y: 52, margin: 40 };
const ROUND_CHOICES = [1, 2, 3];
const RIVALS = { versus: 'Entre nosotros', cpu: 'Contra la compu' };
const SETUP_MODES = ['duelo', 'torneo', 'supervivencia', 'entrenamiento', 'escuela', 'retos', 'familiar', 'jefes', 'fama', 'equipos'];
// Los modos en los que pueden caer objetos (si se escogen) y los que no escogen escenario.
const ITEM_MODES = ['duelo', 'torneo', 'supervivencia', 'familiar', 'jefes', 'equipos'];
const NO_ARENA_MODES = ['torneo', 'jefes', 'escuela', 'retos', 'fama'];
const CUP_SIZES = [4, 8];
const SETUP_ROWS = 7;
// La parada perfecta deja al que pegó mareado este rato.
const PARRY_STUN_MS = 700;
const PARRY_METER = 15;
// 2 contra 2: J1 y J3 son los Rojos (a la izquierda), J2 y J4 los Azules; la compu completa los equipos.
const TEAMS = [
  { name: 'Rojos', color: 0xff5a5f, x: [WALLS.left + 250, WALLS.left + 450] },
  { name: 'Azules', color: 0x3fa7ff, x: [WALLS.right - 250, WALLS.right - 450] },
];
const TEAM_BAR = { width: 420, height: 18, y: 34, gap: 46 };
// Entrenamiento: con menos de esto de vida se rellena sola; la barra de poder se llena sola (por milisegundo).
const TRAINING_REFILL = 0.3;
const TRAINING_METER_PER_MS = 0.03;
const ARENA_CHOICES = ['azar', ...ARENA_KEYS.filter((key) => ARENAS[key].has || !ARENAS[key].needsArt)];
const IDLE = { x: 0, up: false, down: false, dash: 0, punch: false, kick: false, special: false, block: false, transform: false, change: 0, assist: false };
// Doble toque al stick (para el arrancón o la rodada): el segundo toque tiene que llegar antes de esto.
const DOUBLE_TAP_MS = 260;
// Golpes seguidos (sin que el rival se reponga) cuentan como combo.
const COMBO_GAP_MS = 1000;
const LOW_HEALTH = 25;
// Combo de dúo (2 contra 2, ver smash/duos.js): qué tan cerca tienen que estar los compañeros y hasta dónde alcanza.
const DUO_RANGE = 520;
const DUO_REACH = 700;

// Lo último que se escogió, para no escogerlo otra vez.
const lastSetup = { mode: 'duelo', rival: 'versus', rounds: 2, level: 'facil', arena: 'azar', items: true, cupSize: 4, twists: false };
// Locura 🎲 (en el duelo y en 2 contra 2): cada round trae una sorpresa distinta a la anterior.
const TWISTS = [
  { key: 'luna', name: '¡Gravedad de luna!', apply: (f) => (f.gravity *= 0.5) },
  { key: 'pesado', name: '¡Gravedad doble!', apply: (f) => (f.gravity *= 1.6) },
  { key: 'hielo', name: '¡Piso de hielo!', apply: (f) => (f.friction = 0.25) },
  { key: 'poder', name: '¡Barra llena para todos!', apply: (f) => (f.meter = METER_MAX) },
  { key: 'media', name: '¡Todos con media vida!', apply: (f) => (f.health = Math.ceil(MAX_HEALTH / 2)) },
];
// El traje que escogió cada quien (X en la pantalla de antes de pelear), mientras la página esté abierta.
const costumeChoice = new Map();
// Lo que cuenta como golpe con la mano o como especial (para los retos).
const PUNCHES = ['punch', 'finisher', 'uppercut', 'airPunch', 'grab'];
const SPECIAL_MOVES = ['special', 'secretLow', 'secretAir', 'final', 'assist'];

// "Duelo de bolitas": uno contra uno de lado, estilo Street Fighter. Barras de vida, reloj y rounds.
// Si juegan más de dos, se turnan: el que gana se queda y el que pierde se forma al final.
// Con un solo jugador (o si escogen "contra la compu") pelean contra la compu, por turnos.
export class DueloScene extends Phaser.Scene {
  constructor() {
    super('Duelo');
  }

  init(data) {
    this.returnData = data ?? {};
  }

  preload() {
    loadSmashArt(this, { allPoses: true });

    loadFxArt(this);
    loadBossArt(this);
    loadStageArt(this);
    loadShowArt(this);
  }

  create() {
    this.humans = players.sorted();
    this.queue = this.humans.map((player) => ({ player, character: characterPicks.get(player.deviceId, defaultCharacter(player)) }));
    this.fighters = [];
    this.shots = [];
    this.exitMs = 0;
    this.exiting = false;
    this.setup = { ...lastSetup };
    if (this.humans.length < 2) this.setup.rival = 'cpu';
    this.arenaLayer = this.add.container(0, 0).setDepth(-100);
    this.items = null;
    this.school = null;
    this.cup = null;
    this.challenge = null;
    this.menu = null;
    this.createHud();
    this.input.keyboard?.on('keydown-ESC', () => this.exit());
    this.showSetup();
  }

  // ---------- Antes de pelear: el Jugador 1 escoge rival, rounds, nivel de la compu y escenario ----------

  setupKeys() {
    const keys = ['mode'];
    const { mode } = this.setup;
    if (mode === 'duelo') {
      if (this.humans.length > 1) keys.push('rival');
      keys.push('rounds');
      if (this.setup.rival === 'cpu') keys.push('level');
    } else if (mode === 'torneo' || mode === 'jefes') {
      keys.push('rounds');
    } else if (mode === 'equipos') {
      keys.push('rounds', 'level');
    } else if (mode === 'familiar') {
      keys.push('cupSize', 'rounds', 'level');
    }
    if (ITEM_MODES.includes(mode)) keys.push('items');
    if (mode === 'duelo' || mode === 'equipos') keys.push('twists');
    // En el torneo y con los jefes los escenarios van tocando solos (cada jefe pelea en su guarida).
    if (!NO_ARENA_MODES.includes(mode)) keys.push('arena');
    return keys;
  }

  showSetup() {
    this.phase = 'setup';
    this.setupRow = 0;
    this.clearFighters();
    this.hideBanner();
    this.drawArenaFor(this.setup.arena === 'azar' ? 'dojo' : this.setup.arena);
    this.helpText.setVisible(false);
    const { width } = this.scale;
    this.setupLayer = this.add.container(0, 0).setDepth(HUD_DEPTH + 2);
    this.setupLayer.add(this.add.rectangle(width / 2, 360, width, 720, 0x14112b, 0.82));
    this.setupLayer.add(this.add.text(width / 2, 92, 'Duelo de bolitas 🥋', textStyle(48, TEXT.normal, { fontStyle: 'bold' })).setOrigin(0.5));
    this.setupRows = Array.from({ length: SETUP_ROWS }, (_, i) => {
      const bg = this.add.rectangle(width / 2, 158 + i * 52, 620, 46, COLORS.panel).setRounded(16);
      const text = this.add.text(width / 2, 158 + i * 52, '', textStyle(23, TEXT.normal, { fontStyle: 'bold' })).setOrigin(0.5);
      this.setupLayer.add([bg, text]);
      return { bg, text };
    });
    this.matchText = this.add.text(width / 2, 560, '', textStyle(24, TEXT.normal, { align: 'center', fontStyle: 'bold' })).setOrigin(0.5);
    this.setupLayer.add(this.matchText);
    this.costumeText = this.add.text(width / 2, 640, '', textStyle(19, '#d9d4ff', { align: 'center' })).setOrigin(0.5);
    this.setupLayer.add(this.costumeText);
    this.setupLayer.add(
      this.add.text(width / 2, 682, '↑ ↓ elegir  ·  ◀ ▶ cambiar  ·  A = ¡a pelear!  ·  B = regresar', textStyle(22, TEXT.accent)).setOrigin(0.5),
    );
    this.refreshSetup();
  }

  refreshSetup() {
    const labels = {
      mode: `Modo: ${MODES[this.setup.mode].name}`,
      rival: `Rival: ${RIVALS[this.setup.rival]}`,
      rounds: `Rounds para ganar: ${this.setup.rounds}`,
      level: `Nivel de la compu: ${CPU_LEVELS[this.setup.level].name}`,
      arena: `Escenario: ${this.setup.arena === 'azar' ? 'Al azar' : ARENAS[this.setup.arena].name}`,
      items: `Objetos que caen: ${this.setup.items ? 'Sí' : 'No'}`,
      twists: `Locura 🎲 (una sorpresa cada round): ${this.setup.twists ? 'Sí' : 'No'}`,
      cupSize: `Llaves de ${this.setup.cupSize} peleadores`,
    };
    // Los trajes: cada quien cambia el suyo con X en su control.
    this.costumeText.setText(
      `Trajes (X en tu control): ${this.humans.map((player) => `${this.labelOf(player)} ${COSTUME_NAMES[costumeChoice.get(player.deviceId) ?? 0]}`).join('  ·  ')}`,
    );
    const keys = this.setupKeys();
    this.setupRow = Math.min(this.setupRow, keys.length - 1);
    this.setupRows.forEach(({ bg, text }, i) => {
      const key = keys[i];
      bg.setVisible(Boolean(key));
      text.setVisible(Boolean(key));
      if (!key) return;
      text.setText(labels[key]);
      bg.setStrokeStyle(i === this.setupRow ? 4 : 2, i === this.setupRow ? COLORS.accent : COLORS.panelBorder);
    });
    const { mode } = this.setup;
    if (mode === 'equipos') {
      const teams = [0, 1].map((t) => `${TEAMS[t].name}: ${this.buildTeams().filter((e) => e.team === t).map((e) => this.describe(e)).join(' + ')}`);
      this.matchText.setText(`${MODES.equipos.info}\n\n${teams.join('\n')}`);
      return;
    }
    if (mode === 'familiar') {
      const people = this.queue.slice(0, this.setup.cupSize).map((entry) => this.describe(entry)).join(', ');
      this.matchText.setText(`${MODES.familiar.info}\n\n${people}${this.queue.length < this.setup.cupSize ? ' y la compu' : ''}`);
      return;
    }
    if (mode === 'fama' || mode === 'retos') {
      this.matchText.setText(MODES[mode].info);
      return;
    }
    if (mode !== 'duelo') {
      const record = mode === 'supervivencia' ? `\nRécord: ${survivalRecord()} peleas` : '';
      this.matchText.setText(`${MODES[mode].info}\n\n${this.describe(this.queue[0])}${record}`);
      return;
    }
    const [left, right] = this.pairing();
    const turns = this.waiting().map((entry) => this.labelOf(entry.player)).join(', ');
    this.matchText.setText(`${this.describe(left)}   vs   ${this.describe(right)}${turns ? `\n\nDespués: ${turns}` : ''}`);
  }

  updateSetup() {
    const host = players.host();
    if (!host) return;
    const id = host.deviceId;
    const keys = this.setupKeys();
    const move = (controls.justPressed(id, 'down') ? 1 : 0) - (controls.justPressed(id, 'up') ? 1 : 0);
    if (move !== 0) {
      this.setupRow = (this.setupRow + move + keys.length) % keys.length;
      sfx.select();
      this.refreshSetup();
    }
    const step = (controls.justPressed(id, 'right') ? 1 : 0) - (controls.justPressed(id, 'left') ? 1 : 0);
    if (step !== 0) {
      const cycle = (list, value) => list[(list.indexOf(value) + step + list.length) % list.length];
      const key = keys[this.setupRow];
      if (key === 'mode') this.setup.mode = cycle(SETUP_MODES, this.setup.mode);
      else if (key === 'rival') this.setup.rival = cycle(Object.keys(RIVALS), this.setup.rival);
      else if (key === 'rounds') this.setup.rounds = cycle(ROUND_CHOICES, this.setup.rounds);
      else if (key === 'level') this.setup.level = cycle(Object.keys(CPU_LEVELS), this.setup.level);
      else if (key === 'items') this.setup.items = !this.setup.items;
      else if (key === 'twists') this.setup.twists = !this.setup.twists;
      else if (key === 'cupSize') this.setup.cupSize = cycle(CUP_SIZES, this.setup.cupSize);
      else {
        this.setup.arena = cycle(ARENA_CHOICES, this.setup.arena);
        this.drawArenaFor(this.setup.arena === 'azar' ? 'dojo' : this.setup.arena);
      }
      sfx.select();
      this.refreshSetup();
    }
    // X en el control de cada quien: su traje.
    for (const player of this.humans) {
      if (!controls.justPressed(player.deviceId, 'x')) continue;
      const i = ((costumeChoice.get(player.deviceId) ?? 0) + 1) % COSTUMES.length;
      costumeChoice.set(player.deviceId, i);
      sfx.select();
      say(`${this.labelOf(player)}: traje ${COSTUME_NAMES[i]}`);
      this.refreshSetup();
    }
    if (controls.justPressed(id, 'a')) {
      sfx.confirm();
      Object.assign(lastSetup, this.setup);
      this.setupLayer.destroy();
      this.beginMode();
    } else if (controls.justPressed(id, 'b')) {
      this.exit();
    }
  }

  // Empieza el modo escogido (o lo vuelve a empezar desde cero).
  beginMode() {
    const { mode } = this.setup;
    this.cpuCharacter = null;
    this.tour = mode === 'torneo' ? new Tournament(this.queue[0]) : mode === 'jefes' ? bossRush(this.queue[0]) : null;
    this.survival = mode === 'supervivencia' ? new Survival(MAX_HEALTH) : null;
    this.teamEntries = mode === 'equipos' ? this.buildTeams() : null;
    this.cup = mode === 'familiar' ? new FamilyCup(this.queue, this.setup.cupSize) : null;
    this.challenge = null;
    this.school?.destroy();
    this.school = null;
    if (mode === 'fama') this.showFameScreen();
    else if (mode === 'retos') this.showChallengeList();
    else if (mode === 'familiar') this.showCupBracket();
    else if (this.tour) this.showTourLadder();
    else {
      if (mode === 'escuela') this.school = new School(this, HUD_DEPTH);
      this.startMatch();
    }
  }

  backToSetup() {
    this.clearFighters();
    this.hideBanner();
    this.school?.destroy();
    this.school = null;
    this.showSetup();
  }

  // ---------- Pantallas de menú: salón de la fama y lista de retos ----------

  showFameScreen() {
    this.clearFighters();
    this.phase = 'menu';
    this.phaseMs = 0;
    this.menu = { kind: 'fama', root: showFame(this, HUD_DEPTH + 3) };
    say('Salón de la fama');
  }

  showChallengeList() {
    this.clearFighters();
    this.hideBanner();
    this.phase = 'menu';
    this.phaseMs = 0;
    this.challenge = null;
    this.challengeIndex ??= 0;
    this.menu = { kind: 'retos', ...showChallenges(this, this.challengeIndex, HUD_DEPTH + 3) };
    say(`Reto: ${CHALLENGES[this.challengeIndex].name}`);
  }

  closeMenu() {
    this.menu?.root.destroy();
    this.menu = null;
  }

  updateMenu() {
    const host = players.host();
    if (!host || this.phaseMs < 250) return;
    const id = host.deviceId;
    if (this.menu.kind === 'retos') {
      const step = (controls.justPressed(id, 'right') ? 1 : 0) - (controls.justPressed(id, 'left') ? 1 : 0);
      const row = (controls.justPressed(id, 'down') ? 2 : 0) - (controls.justPressed(id, 'up') ? 2 : 0);
      const move = step || row;
      if (move) {
        this.challengeIndex = (this.challengeIndex + move + CHALLENGES.length) % CHALLENGES.length;
        this.menu.select(this.challengeIndex);
        sfx.select();
        const challenge = CHALLENGES[this.challengeIndex];
        say(`${challenge.name}. ${challenge.info}`);
      }
      if (controls.justPressed(id, 'a')) {
        sfx.confirm();
        this.closeMenu();
        this.challenge = CHALLENGES[this.challengeIndex];
        this.cpuCharacter = null;
        this.startMatch();
        return;
      }
    }
    if (controls.justPressed(id, 'b') || (this.menu.kind === 'fama' && controls.justPressed(id, 'a'))) {
      sfx.back();
      this.closeMenu();
      this.backToSetup();
    }
  }

  // ---------- Torneo familiar ----------

  // Las llaves: primero se deciden solas las peleas de compu contra compu; luego, A = la pelea que sigue.
  showCupBracket() {
    this.clearFighters();
    this.hideBanner();
    const skipped = this.cup.skipCpuFights();
    this.phase = 'end';
    this.phaseMs = END_INPUT_DELAY_MS * 0.6;
    const colorOf = (entry) => (entry.player ? hexToCss(players.color(entry.player).hex) : '#c8c4e8');
    const cpuNote = skipped.length ? `La compu ya peleó: ${skipped.map((e) => CHARACTERS[e.character].name).join(', ')} ${skipped.length === 1 ? 'ganó' : 'ganaron'}\n` : '';
    if (this.cup.done) {
      const champion = this.cup.champion;
      const name = this.describe(champion);
      if (champion.player) {
        rewards.earn('duelo-familiar');
        confetti(this, [0xffd84d, 0xffffff, 0x4cd97b], 120);
        sfx.win();
      }
      this.ladder = showBracket(this, this.cup, (p) => this.labelOf(p), colorOf, `🏆 ¡${name} ganó el torneo familiar!\nA = otro torneo  ·  B = cambiar personajes`, HUD_DEPTH + 3);
      say(`¡${name} ganó el torneo familiar!`);
      this.endActions = { a: () => this.beginMode(), b: () => this.toCharacters() };
      return;
    }
    const [a, b] = this.cup.current;
    this.ladder = showBracket(this, this.cup, (p) => this.labelOf(p), colorOf, `${cpuNote}Sigue: ${this.describe(a)} vs ${this.describe(b)}\nA = ¡a pelear!  ·  B = salir del torneo`, HUD_DEPTH + 3);
    say(`${this.cup.roundName}: ${this.describe(a)} contra ${this.describe(b)}`);
    this.endActions = { a: () => this.startMatch(), b: () => this.backToSetup() };
  }

  // Terminó una pelea de las llaves: el ganador avanza.
  endCupMatch(winner) {
    const entry = this.cupPair[this.fighters.indexOf(winner)] ?? this.cupPair[0];
    this.cup.resolve(entry);
    this.hideBanner();
    this.victory = showVictory(this, winner, `¡Ganó ${winner.label}!`, 'A = ver las llaves');
    say(`¡Ganó ${winner.label}!`);
    sfx.win();
    this.endActions = { a: () => this.showCupBracket(), b: () => this.showCupBracket() };
  }

  // ---------- Retos ----------

  // Va revisando el reto (los de "meta" se cumplen en cuanto se logran).
  updateChallenge(dt) {
    const c = this.challenge;
    if (!c || this.challengeResolved) return;
    this.challengeStats.fightMs += dt;
    if (c.goal?.(this.challengeStats)) this.challengeWon();
  }

  challengeWon() {
    if (this.challengeResolved) return;
    this.challengeResolved = true;
    const human = this.fighters[0];
    const count = completeChallenge(this.challenge.key);
    rewards.earn('duelo-reto');
    if (count >= CHALLENGES.length) rewards.earn('duelo-retos');
    this.clearShots();
    this.phase = 'end';
    this.phaseMs = 0;
    for (const fighter of this.fighters) fighter.celebrate(fighter === human);
    this.hideBanner();
    this.victory = showVictory(this, human, '¡Reto cumplido! 🎖️', `${this.challenge.name}  ·  ${count} de ${CHALLENGES.length}\n\nA = otro reto\nB = cambiar personajes`);
    say('¡Reto cumplido!');
    confetti(this, [0xffd84d, 0x4cd97b, 0xffffff], 110);
    sfx.win();
    this.endActions = { a: () => this.showChallengeList(), b: () => this.toCharacters() };
  }

  endChallengeMatch(winner) {
    const won = winner === this.fighters[0];
    if (won && this.challenge.win?.(this.challengeStats)) {
      this.challengeWon();
      return;
    }
    this.showBanner('¡Casi!', `${this.challenge.info}\nA = intentar otra vez  ·  B = otro reto`, 0, TEXT.accent);
    this.endActions = { a: () => (this.hideBanner(), this.startMatch()), b: () => (this.hideBanner(), this.showChallengeList()) };
  }

  // ---------- Escuela ----------

  schoolDone() {
    rewards.earn('duelo-escuela');
    this.phase = 'end';
    this.phaseMs = 0;
    this.showBanner('¡Terminaste la escuela! 🎓', 'Ya sabes todos los golpes\nA = repetir  ·  B = regresar', 0, '#4cd97b');
    confetti(this, [0x4cd97b, 0xffd84d, 0xffffff], 120);
    sfx.win();
    this.endActions = {
      a: () => (this.hideBanner(), this.beginMode()),
      b: () => this.backToSetup(),
    };
  }

  // El muñeco maestro avisa antes de pegar (lección de la parada perfecta).
  warnSwing(dummy) {
    popText(this, dummy.x, dummy.y - dummy.height - 50, '¡Ahí va!', '#ff9a3c');
    say('¡Ahí va!');
  }

  toCharacters() {
    go(this, 'Personajes', { selected: this.returnData.selected, next: 'Duelo', title: 'Duelo de bolitas' });
  }

  // ---------- Torneo y supervivencia ----------

  // La escalera del torneo antes de cada pelea: A = ¡a pelear!, B = salir del torneo.
  showTourLadder() {
    this.clearFighters();
    this.hideBanner();
    this.phase = 'end';
    this.phaseMs = END_INPUT_DELAY_MS * 0.6;
    const fight = this.tour.current;
    const rush = this.setup.mode === 'jefes';
    const title = `${rush ? 'Jefes secretos' : 'Torneo'} · Pelea ${this.tour.index + 1} de ${this.tour.fights.length}`;
    const boss = fight.boss ? `¡Ahora el jefe: ${BOSSES[fight.character].name}!` : '';
    const hint = `${boss ? `${boss} 👑\n` : ''}A = ¡a pelear!  ·  B = salir`;
    this.ladder = showLadder(this, this.tour, title, hint);
    say(boss || title);
    this.endActions = { a: () => this.startMatch(), b: () => this.backToSetup() };
  }

  endTourMatch(winner) {
    const human = this.fighters[0];
    if (winner !== human) {
      this.showBanner('¡Casi!', 'A = intentar otra vez  ·  B = salir del torneo', 0, TEXT.accent);
      this.endActions = { a: () => (this.hideBanner(), this.startMatch()), b: () => this.backToSetup() };
      return;
    }
    this.tour.index += 1;
    if (!this.tour.done) {
      this.victory = showVictory(this, winner, '¡Ganaste!', `Sigue la pelea ${this.tour.index + 1} de ${this.tour.fights.length}\n\nA = seguir\nB = salir del torneo`);
      sfx.win();
      this.endActions = { a: () => this.showTourLadder(), b: () => this.backToSetup() };
      return;
    }
    rewards.earn(this.tour.sticker);
    const rush = this.setup.mode === 'jefes';
    const title = rush ? '¡Venciste a los jefes! 👹' : '¡Campeón del torneo! 🏆';
    this.victory = showVictory(this, winner, title, `A = ${rush ? 'otra vez' : 'otro torneo'}\nB = cambiar personajes\nMantén LB + RB + Y = salir`, {
      trophy: true,
    });
    say(rush ? '¡Venciste a los jefes!' : '¡Campeón del torneo!');
    confetti(this, [winner.color, 0xffd84d, 0xffffff], 140);
    fireworks(this, [winner.color, 0xffd84d, 0xffffff], 5);
    sfx.win();
    this.endActions = { a: () => this.beginMode(), b: () => this.toCharacters() };
  }

  endSurvivalMatch(winner) {
    const human = this.fighters[0];
    const plural = (n) => (n === 1 ? 'pelea' : 'peleas');
    if (winner === human) {
      this.survival.won(human.health);
      const wins = this.survival.wins;
      if (wins >= SURVIVAL_STICKER_AT) rewards.earn('duelo-aguante');
      this.showBanner(`¡${wins} ${wins === 1 ? 'victoria' : 'victorias'}!`, 'Recuperas un poquito de vida\nA = siguiente rival  ·  B = terminar', 0, hexToCss(winner.color));
      sfx.win();
      this.endActions = { a: () => (this.hideBanner(), (this.cpuCharacter = null), this.startMatch()), b: () => this.finishSurvival() };
      return;
    }
    this.finishSurvival();
  }

  finishSurvival() {
    const wins = this.survival.wins;
    const { record, isNew } = this.survival.finish();
    this.phase = 'end';
    this.phaseMs = 0;
    this.showBanner(`Aguantaste ${wins} ${wins === 1 ? 'pelea' : 'peleas'}`, `${isNew ? '¡Nuevo récord!' : `Récord: ${record}`}\nA = otra vez  ·  B = cambiar personajes`, 0, TEXT.accent);
    if (isNew && wins > 0) confetti(this, [0xffd84d, 0xffffff, 0x4cd97b], 90);
    this.endActions = { a: () => (this.hideBanner(), this.beginMode()), b: () => this.toCharacters() };
  }

  // ---------- Entrenamiento ----------

  // Lo llama el peleador al hacer cada movimiento: en Entrenamiento se palomea el reto.
  practiced(fighter, key) {
    if (fighter.isCpu) return;
    this.school?.mark(key);
    const stats = this.challengeStats;
    if (stats && fighter === this.fighters[0]) {
      if (PUNCHES.includes(key)) stats.punches += 1;
      if (SPECIAL_MOVES.includes(key)) stats.specials += 1;
      if (key === 'secretLow') stats.secretLow = true;
      if (key === 'secretAir') stats.secretAir = true;
    }
    if (!this.drills) return;
    const name = this.drills.mark(key);
    if (!name) return;
    popText(this, fighter.x, fighter.y - fighter.height - 60, `✅ ${name}`, '#4cd97b');
    sfx.pickup();
    say(name);
    if (this.drills.complete) {
      this.showBanner('¡Ya sabes todos los golpes!', '', 2500, '#4cd97b');
      confetti(this, [0x4cd97b, 0xffd84d, 0xffffff], 100);
    }
  }

  // Nadie se queda sin vida y la barra de poder se llena sola (para probar la súper y el golpe final).
  updateTraining(dt) {
    for (const fighter of this.fighters) {
      const resting = fighter.hurtMs <= 0 && !fighter.launched && fighter.downMs <= 0;
      if (resting && fighter.health < fighter.maxHealth * TRAINING_REFILL) {
        fighter.health = fighter.maxHealth;
        popText(this, fighter.x, fighter.y - fighter.height - 40, '¡Vida llena!', '#4cd97b');
      }
    }
    const me = this.fighters[0];
    if (me.superMs <= 0) me.meter = Math.min(METER_MAX, me.meter + dt * TRAINING_METER_PER_MS);
  }

  // ---------- Quién pelea ----------

  labelOf(player) {
    return `J${player.slot + 1}`;
  }

  describe(entry) {
    const name = isBoss(entry.character) ? BOSSES[entry.character].name : CHARACTERS[entry.character].name;
    return `${entry.player ? this.labelOf(entry.player) : 'CPU'} · ${name}`;
  }

  // Los dos que pelean ahora: los primeros dos de la fila, o el primero contra la compu. En el torneo, el rival
  // que toca; en supervivencia, uno al azar (más difícil con cada victoria); en entrenamiento, el muñeco.
  pairing() {
    const { mode } = this.setup;
    if ((mode === 'torneo' || mode === 'jefes') && this.tour && !this.tour.done) {
      const fight = this.tour.current;
      return [this.queue[0], { player: null, character: fight.character, level: fight.level }];
    }
    if (mode === 'familiar' && this.cup && !this.cup.done) return this.cup.current;
    if (mode === 'retos' && this.challenge) {
      this.cpuCharacter ??= this.challenge.boss ?? this.randomCpuCharacter();
      return [this.queue[0], { player: null, character: this.cpuCharacter, level: this.challenge.level }];
    }
    if (mode === 'escuela') {
      this.cpuCharacter ??= this.randomCpuCharacter();
      return [this.queue[0], { player: null, character: this.cpuCharacter, dummy: true }];
    }
    if (mode === 'supervivencia' || mode === 'entrenamiento') {
      this.cpuCharacter ??= this.randomCpuCharacter();
      const rival = { player: null, character: this.cpuCharacter };
      if (mode === 'supervivencia') rival.level = this.survival?.level ?? 'facil';
      else rival.dummy = true;
      return [this.queue[0], rival];
    }
    if (this.setup.rival === 'versus' && this.queue.length > 1) return [this.queue[0], this.queue[1]];
    this.cpuCharacter ??= this.randomCpuCharacter();
    return [this.queue[0], { player: null, character: this.cpuCharacter }];
  }

  // Los equipos del 2 contra 2: los jugadores se reparten (J1 y J3 rojos, J2 y J4 azules) y la compu completa.
  buildTeams() {
    const entries = this.queue.slice(0, 4).map((entry, i) => ({ ...entry, team: i % 2 }));
    const taken = new Set(entries.map((entry) => entry.character));
    for (const team of [0, 1]) {
      while (entries.filter((entry) => entry.team === team).length < 2) {
        const free = CHARACTER_KEYS.filter((key) => !taken.has(key));
        const character = Phaser.Utils.Array.GetRandom(free.length ? free : CHARACTER_KEYS);
        taken.add(character);
        entries.push({ player: null, character, team });
      }
    }
    // Primero los Rojos y luego los Azules.
    return [...entries.filter((e) => e.team === 0), ...entries.filter((e) => e.team === 1)];
  }

  get teamsMode() {
    return this.setup.mode === 'equipos';
  }

  // Los del otro equipo.
  enemiesOf(fighter) {
    return this.fighters.filter((f) => f.team !== fighter.team);
  }

  // El rival más cercano que sigue en pie (a ese ve y a ese ataca la compu).
  foeOf(fighter) {
    const enemies = this.enemiesOf(fighter);
    const standing = enemies.filter((f) => !f.koed);
    const list = standing.length ? standing : enemies;
    return list.reduce((best, f) => (!best || Math.abs(f.x - fighter.x) < Math.abs(best.x - fighter.x) ? f : best), null);
  }

  // Dónde empieza cada uno: en el duelo, uno de cada lado; en equipos, dos de cada lado.
  startOf(fighter) {
    if (!this.teamsMode) return { x: START_X[fighter.team], facing: fighter.team === 0 ? 1 : -1 };
    const mates = this.fighters.filter((f) => f.team === fighter.team);
    return { x: TEAMS[fighter.team].x[mates.indexOf(fighter)], facing: fighter.team === 0 ? 1 : -1 };
  }

  // Los que esperan su turno.
  waiting() {
    if (this.setup.mode !== 'duelo') return [];
    return this.queue.slice(this.setup.rival === 'versus' ? 2 : 1);
  }

  randomCpuCharacter() {
    const taken = new Set(this.queue.map((entry) => entry.character));
    const free = CHARACTER_KEYS.filter((key) => !taken.has(key));
    return Phaser.Utils.Array.GetRandom(free.length ? free : CHARACTER_KEYS);
  }

  createFighter(entry, i) {
    const taken = new Set(this.humans.map((player) => player.colorIndex));
    const cpuColor = PLAYER_COLORS.find((_, k) => !taken.has(k)) ?? PLAYER_COLORS[0];
    const fighter = new DueloFighter(this, {
      color: entry.player ? players.color(entry.player).hex : isBoss(entry.character) ? BOSSES[entry.character].color : cpuColor.hex,
      label: entry.player ? this.labelOf(entry.player) : 'CPU',
      character: entry.character,
      deviceId: entry.player?.deviceId ?? null,
    });
    fighter.dizzy = new DizzyStars(this);
    fighter.team = entry.team ?? i;
    if (this.teamsMode) {
      fighter.ring.setStrokeStyle(6, TEAMS[fighter.team].color);
      fighter.tag.setColor(hexToCss(TEAMS[fighter.team].color));
    }
    fighter.dummy = Boolean(entry.dummy);
    fighter.cpuLevel = entry.level ?? null;
    fighter.unbreakable = this.setup.mode === 'entrenamiento' || this.setup.mode === 'escuela';
    // La parada perfecta: a la compu solo le sale a veces; en la escuela es más fácil para los jugadores.
    fighter.parryChance = entry.dummy ? 0 : (CPU_LEVELS[entry.level ?? this.setup.level]?.parry ?? 0);
    if (this.setup.mode === 'escuela' && entry.player) fighter.parryWindow = SCHOOL_PARRY_MS;
    if (entry.player) fighter.setCostume(COSTUMES[costumeChoice.get(entry.player.deviceId) ?? 0]);
    return fighter;
  }

  clearFighters() {
    this.victory?.destroy();
    this.victory = null;
    this.ladder?.destroy();
    this.ladder = null;
    this.drills?.destroy();
    this.drills = null;
    this.stageLife?.destroy();
    this.stageLife = null;
    this.arenaEvents?.destroy(this.fighters);
    this.arenaEvents = null;
    this.items?.clear();
    this.items = null;
    this.closeMenu?.();
    this.talk?.hide();
    for (const fighter of this.fighters) {
      fighter.dizzy?.destroy();
      fighter.destroy();
    }
    this.fighters = [];
    this.clearShots();
    this.hud?.forEach((side) => side.root.setVisible(false));
    this.teamHud?.forEach((bar) => bar.root.setVisible(false));
    this.timerBox?.setVisible(false);
    this.turnsText?.setText('');
    this.helpText?.setVisible(false);
  }

  clearShots() {
    for (const shot of this.shots) shot.destroy();
    this.shots = [];
  }

  drawArenaFor(key) {
    this.arenaShown = key;
    this.arenaLayer.removeAll(true);
    drawArena(this, key, FLOOR, this.arenaLayer);
    // Si su fondo no se ha bajado, se pide y se vuelve a dibujar en cuanto llega (mientras, cielo y piso).
    if (!this.textures.exists(ARENAS[key].texture)) loadArenaArt(this, key, () => this.arenaShown === key && this.drawArenaFor(key));
  }

  // ---------- La pelea ----------

  startMatch() {
    this.clearFighters();
    const entries = this.teamsMode ? this.teamEntries : this.pairing();
    this.cupPair = this.cup ? entries : null;
    this.fighters = entries.map((entry, i) => this.createFighter(entry, i));
    this.fighters.forEach((fighter) => (fighter.roundWins = 0));
    // Si dos traen el mismo personaje con el mismo traje, el segundo se cambia de traje.
    this.fighters.forEach((fighter, i) => {
      const twin = this.fighters.slice(0, i).find((f) => f.character === fighter.character && f.costume === fighter.costume);
      if (twin) fighter.setCostume(COSTUMES[(COSTUMES.indexOf(fighter.costume) + 1) % COSTUMES.length]);
    });
    const { mode } = this.setup;
    this.roundsToWin = ['supervivencia', 'retos', 'escuela'].includes(mode) ? 1 : this.setup.rounds;
    this.training = mode === 'entrenamiento' || mode === 'escuela';
    if (mode === 'entrenamiento') this.drills = new Drills(this);
    // El escenario: el del jefe (en su guarida), el escogido o uno al azar (sin las guaridas).
    const boss = this.tour?.current?.boss ? this.tour.current.character : (this.challenge?.boss ?? null);
    let arena = NO_ARENA_MODES.includes(mode) ? 'azar' : this.setup.arena;
    if (boss && ARENAS[BOSSES[boss].arena]?.has) arena = BOSSES[boss].arena;
    this.arena = arena === 'azar' ? (Phaser.Utils.Array.GetRandom(ARENA_KEYS.filter((k) => ARENAS[k].has && !ARENAS[k].boss)) ?? 'dojo') : arena;
    this.drawArenaFor(this.arena);
    this.stageLife = new StageLife(this, ARENAS[this.arena]);
    // En el espacio se salta más alto; en la nieve los empujones resbalan.
    const look = ARENAS[this.arena];
    for (const fighter of this.fighters) {
      fighter.gravity *= look.gravity ?? 1;
      fighter.friction = look.friction ?? 1;
      // (Lo del escenario, para regresar a eso en cada round de Locura.)
      fighter.baseGravity = fighter.gravity;
      fighter.baseFriction = fighter.friction;
    }
    this.lastTwist = null;
    // Lo que pasa a ratos en las arenas nuevas (arenas movedizas, sin gravedad, corriente); practicando, no.
    this.arenaEvents = look.event && !this.training ? new ArenaEvents(this, look.event) : null;
    this.duos = new DuoWatch();
    this.duoCounts = [0, 0];
    this.items = this.setup.items && ITEM_MODES.includes(mode) ? new FightItems(this) : null;
    this.koReplay = new KoReplay();
    this.challengeStats = this.challenge ? newChallengeStats() : null;
    this.challengeResolved = false;
    this.round = 0;
    if (this.teamsMode) this.fillTeamHud();
    else this.hud.forEach((side, i) => this.fillHud(side, this.fighters[i]));
    this.timerBox.setVisible(true);
    this.helpText.setVisible(true);
    // Primero la pantalla de "VS" (los dos en su pose de entrada) y luego el primer round.
    this.phase = 'versus';
    this.phaseMs = 0;
    this.timeLeftMs = ROUND_SECONDS * 1000;
    this.placeFighters();
    const sides = [0, 1].map((team) => this.fighters.filter((f) => f.team === team));
    showVersus(this, sides[0], sides[1], () => this.startRound(), this.teamsMode ? TEAMS : null);
  }

  // Locura 🎲: la sorpresa de este round (o null si no se escogió Locura).
  applyTwist() {
    const { mode, twists } = this.setup;
    if (!twists || (mode !== 'duelo' && mode !== 'equipos')) return null;
    for (const fighter of this.fighters) {
      fighter.gravity = fighter.baseGravity ?? fighter.gravity;
      fighter.friction = fighter.baseFriction ?? fighter.friction;
    }
    const twist = Phaser.Utils.Array.GetRandom(TWISTS.filter((t) => t.key !== this.lastTwist));
    this.lastTwist = twist.key;
    for (const fighter of this.fighters) twist.apply(fighter);
    return twist;
  }

  startRound() {
    this.round += 1;
    this.clearShots();
    this.placeFighters();
    this.timeLeftMs = ROUND_SECONDS * 1000;
    this.phase = 'intro';
    this.phaseMs = 0;
    this.slowMs = 0;
    this.warnedTime = false;
    this.replayShown = false;
    this.firstHitSaid = false;
    this.items?.clear();
    this.stageLife?.clearHazards();
    this.arenaEvents?.finish(this.fighters);
    this.koReplay = new KoReplay();
    for (const fighter of this.fighters) {
      fighter.posing = true;
      fighter.combo = 0;
      fighter.warnedLow = false;
      fighter.assistUsed = false;
    }
    // Supervivencia: sigue con la vida que le quedó; entrenamiento: con la barra de poder llena.
    if (this.survival) this.fighters[0].health = this.survival.health;
    if (this.training) this.fighters[0].meter = METER_MAX;
    const twist = this.applyTwist();
    const last = this.fighters.every((fighter) => fighter.roundWins === this.roundsToWin - 1) && this.roundsToWin > 1;
    const [a, b] = this.teamsMode ? [] : this.fighters;
    let title = last ? '¡Round final!' : `Round ${this.round}`;
    if (this.training) title = this.school ? '¡A la escuela!' : '¡A practicar!';
    else if (this.challenge) title = this.challenge.name;
    else if (this.survival) title = `Rival ${this.survival.wins + 1}`;
    else if (this.tour) title = this.tour.current.boss ? '¡El jefe!' : `Pelea ${this.tour.index + 1}`;
    const versus = this.teamsMode ? `${TEAMS[0].name}  vs  ${TEAMS[1].name}` : `${a.label} ${a.name}  vs  ${b.label} ${b.name}`;
    this.showBanner(title, twist ? `🎲 ${twist.name}` : versus, ROUND_INTRO_MS);
    if (twist) say(twist.name);
    sfx.countdown();
  }

  placeFighters() {
    for (const fighter of this.fighters) {
      const { x, facing } = this.startOf(fighter);
      fighter.reset(x, facing);
    }
  }

  update() {
    const dt = frameDelta();
    this.updateExit(dt);
    if (this.phase === 'setup') {
      this.updateSetup();
      return;
    }
    this.phaseMs += dt;
    this.talk.update(dt);
    if (this.phase === 'menu') {
      this.updateMenu();
      return;
    }
    this.stageLife?.update(dt);
    if (this.phase === 'final') {
      this.updateFinal(dt);
      return;
    }
    if (this.phase === 'replay') {
      this.updateKoReplay(dt);
      return;
    }
    // Cámara lenta un momento al dar el K.O.
    this.slowMs = Math.max(0, this.slowMs - dt);
    const step = this.slowMs > 0 ? dt * 0.3 : dt;

    if (this.phase === 'intro' && this.phaseMs >= ROUND_INTRO_MS) {
      this.phase = 'go';
      this.phaseMs = 0;
      for (const fighter of this.fighters) {
        fighter.posing = false;
        fighter.look.express('enojado', 1400);
      }
      this.showBanner('¡Peleen!', '', FIGHT_INTRO_MS);
      sfx.countdown(true);
    } else if (this.phase === 'go' && this.phaseMs >= FIGHT_INTRO_MS * 0.5) {
      this.phase = 'fight';
      this.phaseMs = 0;
    }

    const fighting = this.phase === 'fight';
    for (const fighter of this.fighters) {
      const foe = this.foeOf(fighter);
      fighter.update(step, fighting ? this.inputFor(fighter, foe, step) : IDLE, foe);
    }
    this.separate();
    this.updateShots(step);
    this.arenaEvents?.update(step, this.fighters, fighting);
    if (fighting) {
      this.resolveHits();
      this.announceMeters();
      this.items?.update(step, this.fighters, (fighter, kind) => this.onItem(fighter, kind));
      this.stageLife?.updateHazards(step, this.fighters, (fighter, damage, x) => this.onHazard(fighter, damage, x));
      this.school?.update(dt, this.fighters[0]);
      if (this.training) this.updateTraining(dt);
      else this.updateTimer(dt);
      this.updateChallenge(dt);
      this.koReplay?.record(step, this.fighters);
    } else if (this.phase === 'ko') {
      this.updateKo();
    } else if (this.phase === 'end') {
      this.updateEnd();
    }
    for (const fighter of this.fighters) {
      fighter.render(step);
      fighter.dizzy?.update(fighter.downMs > 0 && !fighter.koed, fighter.x, fighter.y - fighter.radius * 1.2, this.time.now);
    }
    this.updateHud();
  }

  inputFor(fighter, foe, dt) {
    if (this.school && fighter.isCpu) return this.school.dummyInput(fighter, foe, dt, IDLE);
    if (fighter.isCpu) {
      // Su compañero usó el especial cerquita: lo acompaña con el suyo (¡combo de dúo!).
      if (fighter.duoCallMs > 0) {
        fighter.duoCallMs -= dt;
        if (fighter.duoCallMs <= 0 && fighter.canAct() && fighter.cooldownMs === 0 && fighter.superMs <= 0) return { ...IDLE, special: true };
      }
      const input = cpuInput(fighter, foe, this.shots, fighter.dummy ? DUMMY : CPU_LEVELS[fighter.cpuLevel ?? this.setup.level], dt, this.items);
      if (input.assist) this.callAssist(fighter);
      return input;
    }
    const id = fighter.deviceId;
    const stick = controls.getStick(id);
    const bumpers = controls.isDown(id, 'lb') && controls.isDown(id, 'rb');
    const transform = bumpers && (controls.justPressed(id, 'lb') || controls.justPressed(id, 'rb'));
    // Y = ayudante. Bloquecito cambia de número con Y, así que su ayudante es ↑ + Y.
    const up = stick.y < -0.5;
    if (controls.justPressed(id, 'y') && !bumpers && (!fighter.blocks || up)) this.callAssist(fighter);
    const block = !transform && ['lb', 'rb', 'lt', 'rt'].some((button) => controls.isDown(id, button));
    if (block && this.challengeStats && fighter === this.fighters[0]) this.challengeStats.blocks += 1;
    return {
      x: stick.x,
      up: controls.justPressed(id, 'up'),
      down: controls.isDown(id, 'down'),
      dash: this.doubleTap(fighter, id),
      punch: controls.justPressed(id, 'a'),
      kick: controls.justPressed(id, 'b'),
      special: controls.justPressed(id, 'x'),
      block,
      transform,
      change: fighter.blocks && !up ? numberStep(id) : 0,
    };
  }

  // Y: un amigo entra corriendo a ayudar (una vez por round).
  callAssist(fighter) {
    if (fighter.assistUsed || this.phase !== 'fight' || fighter.koed || fighter.celebrating || this.training && !this.school && fighter.isCpu) return;
    fighter.assistUsed = true;
    const helper = pickHelper(this.fighters);
    const assist = new Assist(this, fighter, helper);
    this.shots.push(assist);
    popText(this, fighter.x, fighter.y - fighter.height - 50, `¡Ayúdame, ${assist.name}!`, '#ffd84d');
    this.talk.line(`¡${fighter.label} llamó a ${assist.name}!`);
    this.practiced(fighter, 'assist');
    sfx.confirm();
  }

  // Doble toque a un lado: devuelve hacia dónde (-1 o 1) o 0.
  doubleTap(fighter, id) {
    const now = this.time.now;
    for (const [dir, name] of [[1, 'right'], [-1, 'left']]) {
      if (!controls.justPressed(id, name)) continue;
      const last = fighter.lastTap;
      fighter.lastTap = { dir, at: now };
      if (last?.dir === dir && now - last.at < DOUBLE_TAP_MS) {
        fighter.lastTap = null;
        return dir;
      }
    }
    return 0;
  }

  // Polvito en los pies (al arrancar o rodar), hacia `dir`.
  dust(x, y, dir) {
    dustPuff(this, x, y, dir);
  }

  // Lo llama el peleador al caer al piso después de salir volando: polvo y una ondita.
  landed(fighter) {
    dustPuff(this, fighter.x, fighter.y, 0, 7);
    shockRing(this, fighter.x, fighter.y - 10, 0xe8dcc8);
  }

  shockwave(x, y, color) {
    shockRing(this, x, y, color);
  }

  // Pisotón (terremoto): ondas a los dos lados y la pantalla tiembla.
  quake(fighter) {
    for (const dir of [-1, 1]) {
      dustPuff(this, fighter.x + dir * fighter.radius, fighter.y, dir, 6);
      shockRing(this, fighter.x + dir * fighter.radius * 1.6, fighter.y - 10, 0xe8dcc8);
    }
    this.cameras.main.shake(200, 0.008);
    sfx.boom();
  }

  healed(fighter, amount) {
    popText(this, fighter.x, fighter.y - fighter.height - 40, `+${amount} ❤️`, '#4cd97b');
    burst(this, fighter.x, fighter.y - fighter.height / 2, 0x4cd97b, 12);
    sfx.sparkle();
  }

  // Un movimiento secreto: su nombre arriba (y el narrador lo dice).
  secretUsed(fighter, move) {
    popText(this, fighter.x, fighter.y - fighter.height - 40, move.name, '#9fe3ff');
    this.talk.line(`¡${move.name}!`);
  }

  // Agarró un objeto.
  onItem(fighter, kind) {
    if (kind === 'bomb') this.spawnShot(fighter, { shape: 'bomb', speed: 560, damage: 14, push: 540, launch: true });
    // El pastel y la burbuja se avientan de una vez hacia el rival; el imán lo jala.
    else if (kind === 'pie') this.spawnShot(fighter, { shape: 'pie', speed: 640, damage: 4, push: 140, pie: true });
    else if (kind === 'bubble') this.spawnShot(fighter, { shape: 'trap', speed: 430, damage: 3, push: 0, trap: true });
    else if (kind === 'magnet') this.magnetPull(fighter);
    else fighter.takeItem(kind);
    popText(this, fighter.x, fighter.y - fighter.height - 50, FIGHT_ITEMS[kind].name, '#ffd84d');
    burst(this, fighter.x, fighter.y - fighter.height / 2, 0xffd84d, 10);
    sfx.pickup();
    this.talk.line(`¡${fighter.label} agarró ${FIGHT_ITEMS[kind].name.replace(/[¡!]/g, '').toLowerCase()}!`);
  }

  // El imán: el rival más cercano sale jalado hasta quedar pegadito (y un instante no puede hacer nada).
  magnetPull(fighter) {
    const foe = this.foeOf(fighter);
    if (!foe || foe.koed || foe.isInvulnerable() || foe.trapMs > 0) return;
    const gap = (fighter.radius + foe.radius) * 0.75;
    if (!foe.pullToward(fighter.x, gap)) return;
    const y = fighter.y - fighter.height / 2;
    for (let i = 0; i < 3; i += 1) {
      const ring = this.add.circle(fighter.x, y, 60).setStrokeStyle(8, i % 2 ? 0xd8dce8 : 0xe53935).setDepth(160).setScale(4 + i);
      this.tweens.add({ targets: ring, scale: 0.4, alpha: 0.2, delay: i * 90, duration: 380, onComplete: () => ring.destroy() });
    }
    sfx.sparkle();
  }

  // Le pegó un pastel (no puede pegar un ratito) o lo atrapó una burbuja.
  itemHit(victim, data) {
    if (data.pie) {
      popText(this, victim.x, victim.y - victim.height - 60, '¡Pastelazo!', '#fff6e5');
      this.talk.line([`¡Pastelazo a ${victim.name}!`, '¡No ve nada!']);
    } else if (data.trap && victim.trapMs > 0) {
      popText(this, victim.x, victim.y - victim.height - 60, '¡Atrapado!', '#9fd8ff');
      this.talk.line(`¡${victim.name} quedó atrapado en una burbuja!`);
    }
  }

  // Le cayó un coco o un cristal (no se puede cubrir).
  onHazard(fighter, damage, x) {
    // (Al muñeco de práctica no le pasa nada.)
    if (fighter.dummy || this.training) return;
    const result = fighter.takeHit({ damage, push: 300, stunMs: 420, launch: true, power: 1, unblockable: true }, x);
    if (!result) return;
    comicHit(this, fighter.x, fighter.y - fighter.height, '¡TONK!', { red: true });
    sfx.hit(0.6);
    if (this.challengeStats && fighter === this.fighters[0]) this.challengeStats.hurt += 1;
    this.checkKo(this.foeOf(fighter), fighter);
  }

  // Parada perfecta: el golpe rebota y el que pegó se queda mareado (con lo que se lanza, se regresa).
  parried(defender, attacker, x, y, melee) {
    comicHit(this, x, y - 40, '¡PARADA!', { big: true });
    shockRing(this, x, y, 0x7fdcff);
    burst(this, x, y, 0x7fdcff, 12);
    sfx.block();
    sfx.sparkle();
    if (melee && attacker) attacker.stagger(PARRY_STUN_MS);
    defender.meter = Math.min(METER_MAX, defender.meter + PARRY_METER);
    this.practiced(defender, 'parry');
    if (!defender.isCpu) {
      rewards.earn('duelo-parada');
      fame.parry();
      if (this.challengeStats && defender === this.fighters[0]) this.challengeStats.parries += 1;
    }
    this.talk.line(['¡Parada perfecta!', `¡Qué parada de ${defender.label}!`], { important: !defender.isCpu });
  }

  // Cuenta los golpes seguidos (combo) y lo anuncia; avisa cuando a alguien le queda poquita vida.
  countHit(attacker, victim) {
    const now = this.time.now;
    attacker.combo = now - (attacker.lastHitAt ?? -Infinity) < COMBO_GAP_MS ? (attacker.combo ?? 0) + 1 : 1;
    attacker.lastHitAt = now;
    if (attacker.combo >= 2) this.showCombo(attacker);
    if ([3, 5, 8].includes(attacker.combo)) this.talk.line(`¡Combo de ${attacker.combo}!`, { important: attacker.combo >= 5 });
    if (!attacker.isCpu && fame.combo(attacker.combo, attacker.character) && attacker.combo >= 4) popText(this, attacker.x, attacker.y - attacker.height - 90, '¡Récord de combo!', '#ffd84d');
    if (this.challengeStats && attacker === this.fighters[0]) this.challengeStats.bestCombo = Math.max(this.challengeStats.bestCombo, attacker.combo);
    if (!victim.warnedLow && victim.health > 0 && victim.health <= LOW_HEALTH) {
      victim.warnedLow = true;
      popText(this, victim.x, victim.y - victim.height - 60, '¡Poquita vida!', '#ff5a5f');
      this.talk.line(`¡A ${victim.name} le queda poquita vida!`);
    }
  }

  // "3 golpes" grandote abajo de la barra de vida del que pegó.
  showCombo(attacker) {
    // En equipos las barras son chiquitas: el combo sale arriba del que pegó.
    if (this.teamsMode) {
      popText(this, attacker.x, attacker.y - attacker.height - 30, `${attacker.combo} golpes`, '#ffd84d');
      return;
    }
    const side = this.hud[attacker.team];
    if (!side) return;
    side.combo.setText(`${attacker.combo} golpes`).setAlpha(1).setScale(1.4);
    this.tweens.killTweensOf(side.combo);
    this.tweens.add({ targets: side.combo, scale: 1, duration: 160, ease: 'Back.easeOut' });
    this.tweens.add({ targets: side.combo, alpha: 0, delay: COMBO_GAP_MS, duration: 300 });
  }

  // No se enciman: se empujan de lado (saltando sí se pueden pasar por arriba).
  separate() {
    for (let i = 0; i < this.fighters.length; i += 1) {
      for (let j = i + 1; j < this.fighters.length; j += 1) this.separatePair(this.fighters[i], this.fighters[j]);
    }
  }

  separatePair(a, b) {
    if (a.ghosting || b.ghosting || a.koed || b.koed) return;
    if (Math.abs(a.y - b.y) > Math.min(a.height, b.height) * 0.45) return;
    const ha = a.hurtbox;
    const hb = b.hurtbox;
    const overlap = Math.min(ha.right, hb.right) - Math.max(ha.left, hb.left);
    if (overlap <= 0) return;
    const dir = Math.sign(b.x - a.x) || a.facing;
    a.x -= (dir * overlap) / 2;
    b.x += (dir * overlap) / 2;
    // Si uno quedó contra la pared, regresa y el otro se recorre lo mismo.
    for (const f of [a, b]) {
      const margin = f.radius * 0.6;
      const back = Phaser.Math.Clamp(f.x, WALLS.left + margin, WALLS.right - margin) - f.x;
      a.x += back;
      b.x += back;
    }
  }

  // Cada golpe le puede pegar a cada rival una vez (a los de su equipo nunca).
  resolveHits() {
    for (const attacker of this.fighters) {
      const box = attacker.hitbox();
      if (!box) continue;
      for (const victim of this.enemiesOf(attacker)) {
        const key = `${box.key}:${this.fighters.indexOf(victim)}`;
        if (attacker.landed.has(key)) continue;
        const body = victim.hurtbox;
        if (box.right < body.left || box.left > body.right || box.bottom < body.top || box.top > body.bottom) continue;
        const result = victim.takeHit(box.data, attacker.x);
        if (!result) continue;
        attacker.landed.add(key);
        const x = (Math.max(box.left, body.left) + Math.min(box.right, body.right)) / 2;
        const y = (Math.max(box.top, body.top) + Math.min(box.bottom, body.bottom)) / 2;
        this.afterHit(attacker, victim, result, box.data, x, y, attacker.attack?.type === 'finisher');
      }
    }
  }

  // Si ya no queda nadie en pie del equipo de `victim`, se acaba el round.
  checkKo(attacker, victim) {
    if (!victim.koed || this.phase !== 'fight') return;
    if (this.fighters.some((f) => f.team === victim.team && !f.koed)) {
      popText(this, victim.x, victim.y - victim.height - 40, '¡Fuera!', '#ff5a5f');
      return;
    }
    this.endRound(attacker, 'ko');
  }

  afterHit(attacker, victim, { blocked, dealt, parried, absorbed }, data, x, y, finisher = false) {
    if (parried) {
      this.parried(victim, attacker, x, y, true);
      return;
    }
    if (absorbed) {
      burst(this, x, y, 0x9fe3ff, 10);
      popText(this, victim.x, victim.y - victim.height - 40, victim.bubbleHits > 0 ? '¡Escudo!' : '¡Se rompió el escudo!', '#9fe3ff');
      sfx.block();
      return;
    }
    attacker.dealtDamage(dealt);
    if (!blocked && data.hammer) attacker.hammerHits = Math.max(0, attacker.hammerHits - 1);
    if (!blocked && this.challengeStats && victim === this.fighters[0]) this.challengeStats.hurt += 1;
    if (!blocked && !this.firstHitSaid) {
      this.firstHitSaid = true;
      this.talk.line(`¡Primer golpe de ${attacker.label}!`);
    }
    if (blocked) {
      spark(this, x, y, 0x7fdcff);
      burst(this, x, y, 0x7fdcff, 6);
      sfx.block();
      return;
    }
    spark(this, x, y);
    burst(this, x, y, 0xffffff, data.launch ? 10 : 5);
    // El jefe se carcajea cuando te pega.
    if (attacker.boss) attacker.look.express?.('burla', 900);
    const big = data.grab || finisher || dealt >= 10;
    const word = data.grab ? '¡Agarrado!' : finisher ? '¡Remate!' : data.hammer ? '¡Martillazo!' : randomPow();
    comicHit(this, x, y - 50, word, { big, red: big });
    // El golpe "se siente": se congela un instante (más en los fuertes).
    setTimeScale(0, big ? 120 : 40 + Math.min(40, dealt * 4));
    sfx.hit(Math.min(1, dealt / 12));
    this.stageLife?.cheer(Math.min(1, dealt / 12));
    if (data.launch) this.cameras.main.shake(140, 0.007);
    if (big) shockRing(this, x, y, attacker.color);
    this.countHit(attacker, victim);
    this.checkKo(attacker, victim);
  }

  spawnShot(owner, data) {
    // Algunos secretos lanzan varios a la vez, cada uno un poco más arriba o abajo.
    if (data.count) for (const vy of data.spread) this.shots.push(new Shot(this, owner, { ...data, vy }));
    else this.shots.push(new Shot(this, owner, data));
    if (data.shape === 'laser') sfx.laser();
    else if (data.shape === 'fire') sfx.fire();
    else sfx.throw();
  }

  updateShots(dt) {
    for (const shot of this.shots) {
      shot.update(dt);
      if (shot.dead) continue;
      // Dos cosas lanzadas que chocan se deshacen (el ayudante no choca con nada).
      const other = !shot.solid && this.shots.find((s) => s !== shot && !s.dead && !s.solid && s.owner.team !== shot.owner.team && overlaps(s.box, shot.box));
      if (other) {
        burst(this, (shot.x + other.x) / 2, shot.y, 0xffffff, 10);
        sfx.poof();
        shot.destroy();
        other.destroy();
        continue;
      }
      const victim = !shot.spent && this.enemiesOf(shot.owner).find((f) => overlaps(shot.box, f.hurtbox));
      if (this.phase === 'fight' && victim) {
        const result = victim.takeHit(shot.hit, shot.x - shot.dir * 10);
        if (result?.parried) {
          // Parada perfecta: se lo regresa al que lo lanzó.
          const thrower = shot.owner;
          shot.reflect(victim);
          this.parried(victim, thrower, shot.x, shot.y, false);
        } else if (result && shot.solid) {
          // El ayudante pega una vez y sigue corriendo.
          shot.spent = true;
          this.afterHit(shot.owner, victim, result, shot.hit, shot.x, shot.y - 60);
          if (!result.blocked && !shot.owner.isCpu) {
            rewards.earn('duelo-ayudante');
            if (this.challengeStats) this.challengeStats.assistHits += 1;
          }
        } else if (result) {
          shot.destroy();
          if (!result.blocked) this.itemHit(victim, shot.data);
          this.afterHit(shot.owner, victim, result, shot.hit, shot.x, shot.y);
          continue;
        }
      }
      shot.render();
    }
    this.shots = this.shots.filter((shot) => {
      if (shot.dead && shot.sprite.active) shot.destroy();
      return !shot.dead;
    });
  }

  // Al llenarse la barra de poder, avisa que ya se puede transformar.
  announceMeters() {
    for (const fighter of this.fighters) {
      const full = fighter.meter >= METER_MAX;
      if (full && !fighter.meterAnnounced) {
        popText(this, fighter.x, fighter.y - fighter.height - 40, '¡Barra llena! LB + RB', '#ffd84d');
        if (!fighter.isCpu) sfx.meterFull();
      }
      fighter.meterAnnounced = full;
    }
  }

  // Lo llama el peleador al transformarse.
  celebrateSuper(fighter) {
    const y = fighter.y - fighter.height / 2;
    burst(this, fighter.x, y, 0xffd84d, 16);
    burst(this, fighter.x, y, fighter.color, 10);
    popText(this, fighter.x, fighter.y - fighter.height - 50, `¡${fighter.superName}!`, '#ffd84d');
    say(fighter.superName);
    this.cameras.main.flash(200, 255, 230, 120);
    if (!fighter.isCpu) rewards.earn('duelo-super');
  }

  // Alguien usó su especial (lo avisa DueloFighter). En el 2 contra 2: si su compañero hizo el suyo casi al mismo
  // tiempo y cerquita, ¡combo de dúo! Si no, la compu de su equipo que esté cerca a veces lo acompaña.
  specialUsed(fighter) {
    if (!this.teamsMode || this.phase !== 'fight' || fighter.koed) return;
    const now = this.time.now;
    const mates = this.fighters.filter((f) => f !== fighter && f.team === fighter.team && !f.koed);
    const near = (a, b) => Math.abs(a.x - b.x) <= DUO_RANGE;
    const partner = this.duos.special(fighter, fighter.team, now, mates, near);
    if (partner) {
      this.duoCombo(partner, fighter);
      return;
    }
    if (!this.duos.ready(fighter.team, now)) return;
    for (const mate of mates) {
      if (!mate.isCpu || mate.duoCallMs > 0 || !near(fighter, mate)) continue;
      const level = mate.cpuLevel ?? this.setup.level;
      if (Math.random() < (DUO_CPU_CHANCE[level] ?? DUO_CPU_CHANCE.normal)) mate.duoCallMs = 150 + Math.random() * 250;
    }
  }

  // ¡Combo de dúo! Letrero con su nombre, el efecto de su tipo y les pega a los rivales que alcanza (aunque se estén
  // cubriendo); el juego se congela un instante y luego la cámara se acerca en cámara lenta.
  duoCombo(a, b) {
    const duo = duoFor(a.character, b.character);
    const x = (a.x + b.x) / 2;
    const y = (a.y - a.height / 2 + b.y - b.height / 2) / 2;
    this.duoCounts[a.team] += 1;
    if (!a.isCpu || !b.isCpu) rewards.earn('duelo-duo');
    this.showBanner(`¡${duo.name}!`, `🤝 ¡Combo de dúo! ${a.label} ${a.name} + ${b.label} ${b.name}`, 1700, hexToCss(duo.color));
    const victims = this.enemiesOf(a).filter((f) => !f.koed && !f.isInvulnerable() && Math.abs(f.x - x) < DUO_REACH);
    // (El terremoto solo alcanza a los que están parados en el piso.)
    const hit = duo.kind === 'quake' ? victims.filter((f) => f.grounded) : victims;
    duoEffect(this, duo, x, y, hit.map((f) => ({ x: f.x, y: f.y - f.height / 2, top: f.y - f.height })));
    const up = ['quake', 'whirl', 'stars', 'shock'].includes(duo.kind);
    const data = {
      damage: duo.hit.damage,
      push: 200 + 380 * duo.hit.push,
      stunMs: Math.max(380, duo.hit.stunMs),
      launch: up,
      lift: up ? 1.2 : 1,
      freeze: duo.kind === 'freeze',
      special: true,
      unblockable: true,
      power: 1,
    };
    for (const victim of hit) {
      const result = victim.takeHit(data, x);
      if (!result) continue;
      // El vapor marea un buen rato (se queda quieto con estrellitas).
      if (duo.kind === 'dizzy') victim.stagger(duo.hit.stunMs);
      this.afterHit(a, victim, result, data, victim.x, victim.y - victim.height / 2);
    }
    // Se congela tantito y luego, cámara lenta con acercamiento (sin el marcador, que se vería gigante).
    setTimeScale(0, 140);
    this.time.delayedCall(150, () => {
      if (this.phase !== 'fight') return;
      const hide = [...(this.teamHud ?? []).map((bar) => bar.root), this.timerBox, this.helpText, this.talk.caption];
      epicMoment(this, x, y, { zoom: 1.25, ms: 1000, slow: 0.35, hide, bounds: { x: 0, y: 0, width: this.scale.width, height: this.scale.height } });
    });
  }

  // El golpe final (lo pide el peleador en súper forma con X). Devuelve false si ahorita no se puede.
  startFinal(attacker) {
    if (this.phase !== 'fight') return false;
    const victim = this.foeOf(attacker);
    if (!victim || victim.koed || victim.celebrating) return false;
    this.clearShots();
    this.phase = 'final';
    this.final = new FinalMove(this, attacker, victim);
    return true;
  }

  // Mientras pasa el golpe final nadie más se mueve (ni corre el reloj).
  updateFinal(dt) {
    const done = this.final.update(dt);
    for (const fighter of this.fighters) fighter.render(dt);
    this.updateHud();
    if (!done) return;
    const { attacker, victim } = this.final;
    this.final = null;
    this.phase = 'fight';
    this.phaseMs = 0;
    if (!attacker.isCpu) {
      rewards.earn('duelo-final');
      fame.final();
      if (this.challengeStats && victim.koed) this.challengeStats.finalKo = true;
    }
    this.practiced(attacker, 'final');
    this.checkKo(attacker, victim);
  }

  // Lo llama el ninja al desaparecer y aparecer.
  poof(x, y) {
    burst(this, x, y, 0xcfd3e6, 10);
    sfx.poof();
  }

  updateTimer(dt) {
    this.timeLeftMs = Math.max(0, this.timeLeftMs - dt);
    if (!this.warnedTime && this.timeLeftMs <= 10000) {
      this.warnedTime = true;
      say('¡Diez segundos!');
    }
    if (this.timeLeftMs > 0) return;
    // Se acabó el tiempo: gana el que tenga más vida (en equipos, sumando la de los dos).
    const life = [0, 1].map((team) => this.fighters.filter((f) => f.team === team).reduce((sum, f) => sum + f.health / f.maxHealth, 0));
    const team = life[0] === life[1] ? null : life[0] > life[1] ? 0 : 1;
    this.endRound(team === null ? null : this.fighters.find((f) => f.team === team), 'time');
  }

  endRound(winner, reason) {
    if (this.phase !== 'fight') return;
    this.phase = 'ko';
    this.phaseMs = 0;
    this.roundWinner = winner;
    this.roundReason = reason;
    this.celebrated = false;
    if (reason === 'ko') {
      this.stageLife?.cheer(2);
      this.slowMs = SLOW_MOTION_MS;
      this.cameras.main.shake(250, 0.012);
      sfx.ko();
    }
    const title = reason === 'ko' ? '¡K.O.!' : winner ? '¡Tiempo!' : '¡Empate!';
    let subtitle = winner ? `Round para ${this.teamsMode ? `los ${TEAMS[winner.team].name}` : winner.label}` : 'Nadie gana este round';
    if (winner) {
      for (const f of this.fighters) if (f.team === winner.team) f.roundWins += 1;
      if (!this.teamsMode && winner.health === winner.maxHealth) {
        subtitle = `¡Perfecto! Round para ${winner.label}`;
        if (!winner.isCpu) {
          rewards.earn('duelo-perfecto');
          fame.perfect();
        }
      }
    }
    const color = winner ? (this.teamsMode ? TEAMS[winner.team].color : winner.color) : null;
    this.showBanner(title, subtitle, KO_PAUSE_MS - 600, color ? hexToCss(color) : TEXT.accent);
  }

  updateKo() {
    if (!this.celebrated && this.phaseMs > SLOW_MOTION_MS + 300) {
      // Si este K.O. gana la pelea, primero la repetición en cámara lenta.
      const decided = this.fighters.some((f) => f.roundWins >= this.roundsToWin);
      if (decided && this.roundReason === 'ko' && !this.replayShown && this.koReplay?.ready) {
        this.startKoReplay();
        return;
      }
      this.celebrated = true;
      for (const fighter of this.fighters) fighter.celebrate(fighter.team === this.roundWinner?.team);
    }
    if (this.phaseMs < KO_PAUSE_MS) return;
    const champion = this.fighters.find((fighter) => fighter.roundWins >= this.roundsToWin);
    if (champion) this.endMatch(champion);
    else this.startRound();
  }

  // La repetición: se esconde el marcador mientras.
  startKoReplay() {
    this.replayShown = true;
    this.phase = 'replay';
    this.phaseMs = 0;
    this.hideBanner();
    this.talk.hide();
    this.setHudVisible(false);
    const victim = this.fighters.find((f) => f.koed) ?? this.fighters[1];
    const winner = this.roundWinner ?? this.fighters[0];
    this.koReplay.start(this, this.fighters, { x: (winner.x + victim.x) / 2, y: FLOOR - 170 });
    say('¡Repetición!');
  }

  updateKoReplay(dt) {
    const going = this.koReplay.step(dt);
    for (const fighter of this.fighters) fighter.render(dt * 0.4);
    const skip = this.phaseMs > 400 && this.humans.some((player) => controls.justPressed(player.deviceId, 'a'));
    if (going && !skip) return;
    this.koReplay.finish();
    this.setHudVisible(true);
    this.phase = 'ko';
    this.phaseMs = SLOW_MOTION_MS + 300;
  }

  setHudVisible(visible) {
    if (this.teamsMode) this.teamHud?.forEach((bar, i) => bar.root.setVisible(visible && i < this.fighters.length));
    else this.hud.forEach((side) => side.root.setVisible(visible));
    this.timerBox.setVisible(visible);
    this.helpText.setVisible(visible);
    this.turnsText.setVisible(visible);
    this.drills?.text.setVisible(visible);
  }

  endMatch(winner) {
    this.phase = 'end';
    this.phaseMs = 0;
    this.matchWinner = winner;
    if (this.fighters.some((f) => f.team === winner.team && !f.isCpu)) rewards.earn('duelo-gana');
    if (!this.training) fame.win(winner.character);
    if (this.challenge) {
      this.endChallengeMatch(winner);
      return;
    }
    if (this.cup) {
      this.endCupMatch(winner);
      return;
    }
    if (this.teamsMode) {
      this.endTeamsMatch(winner);
      return;
    }
    if (this.tour) {
      this.endTourMatch(winner);
      return;
    }
    if (this.survival) {
      this.endSurvivalMatch(winner);
      return;
    }
    const next = this.nextQueue();
    const [a, b] = this.pairingFor(next);
    const nextText = `Sigue: ${this.describe(a)} vs ${this.describe(b)}`;
    this.hideBanner();
    this.victory = showVictory(this, winner, `¡Ganó ${winner.label}!`, `${nextText}\n\nA = siguiente pelea\nB = cambiar personajes\nMantén LB + RB + Y = salir`);
    say(`¡Ganó ${winner.label}!`);
    confetti(this, [winner.color, 0xffffff, 0xffc93c], 90);
    fireworks(this, [winner.color, 0xffffff, 0xffc93c], 4);
    sfx.win();
    this.endActions = {
      a: () => {
        this.queue = this.nextQueue();
        this.cpuCharacter = null;
        this.hideBanner();
        this.startMatch();
      },
      b: () => this.toCharacters(),
    };
  }

  // Ganó un equipo: sale festejando el primero de ellos (de preferencia un jugador). A = revancha.
  endTeamsMatch(winner) {
    const team = TEAMS[winner.team];
    const star = this.fighters.find((f) => f.team === winner.team && !f.isCpu) ?? winner;
    this.hideBanner();
    // Cuántos combos de dúo hizo cada equipo (si hubo).
    const duos = this.duoCounts.some((n) => n > 0) ? `🤝 Combos de dúo: ${TEAMS.map((t, i) => `${t.name} ${this.duoCounts[i]}`).join('  ·  ')}\n\n` : '';
    this.victory = showVictory(this, star, `¡Ganan los ${team.name}!`, `${duos}A = revancha\nB = cambiar personajes\nMantén LB + RB + Y = salir`);
    say(`¡Ganan los ${team.name}!`);
    confetti(this, [team.color, 0xffffff, 0xffc93c], 110);
    sfx.win();
    this.endActions = { a: () => (this.hideBanner(), this.startMatch()), b: () => this.toCharacters() };
  }

  // Cómo queda la fila para la siguiente pelea: entre nosotros, el que perdió se forma al final
  // (el que ganó se queda); contra la compu, le toca al siguiente.
  nextQueue() {
    const queue = [...this.queue];
    if (this.setup.rival === 'versus' && queue.length > 1) {
      const loserIndex = this.matchWinner === this.fighters[0] ? 1 : 0;
      const [loser] = queue.splice(loserIndex, 1);
      queue.push(loser);
    } else {
      queue.push(queue.shift());
    }
    return queue;
  }

  pairingFor(queue) {
    const saved = this.queue;
    this.queue = queue;
    const pair = this.pairing();
    this.queue = saved;
    return pair;
  }

  updateEnd() {
    if (this.phaseMs < END_INPUT_DELAY_MS) return;
    const ids = this.humans.map((player) => player.deviceId);
    if (ids.some((id) => controls.justPressed(id, 'a'))) this.endActions.a();
    else if (ids.some((id) => controls.justPressed(id, 'b'))) this.endActions.b();
  }

  // ---------- Marcador ----------

  createHud() {
    const { width, height } = this.scale;
    this.hud = [0, 1].map((side) => {
      const anchorX = side === 0 ? BAR.margin : width - BAR.margin;
      const origin = side === 0 ? 0 : 1;
      const root = this.add.container(0, 0).setDepth(HUD_DEPTH).setVisible(false);
      const back = this.add.rectangle(anchorX, BAR.y, BAR.width, BAR.height, 0x1b1530, 0.75).setOrigin(origin, 0.5).setStrokeStyle(4, 0xffffff);
      const trail = this.add.rectangle(anchorX, BAR.y, BAR.width, BAR.height - 8, 0xffffff).setOrigin(origin, 0.5);
      const fill = this.add.rectangle(anchorX, BAR.y, BAR.width, BAR.height - 8, 0xffffff).setOrigin(origin, 0.5);
      const name = this.add.text(anchorX, BAR.y - 32, '', textStyle(22, TEXT.normal, { fontStyle: 'bold', ...OUTLINE })).setOrigin(origin, 0.5);
      const wins = this.add.text(anchorX, BAR.y + 32, '', textStyle(24, TEXT.accent, { fontStyle: 'bold', ...OUTLINE })).setOrigin(origin, 0.5);
      // Barra de poder (llena = LB + RB para transformarse) y si el especial (X) ya está listo.
      const meterX = side === 0 ? anchorX + 110 : anchorX - 110;
      const meterBack = this.add.rectangle(meterX, BAR.y + 32, 260, 10, 0xffffff, 0.2).setOrigin(origin, 0.5);
      const meter = this.add.rectangle(meterX, BAR.y + 32, 260, 10, 0xffd84d).setOrigin(origin, 0.5);
      const special = this.add.text(side === 0 ? meterX + 275 : meterX - 275, BAR.y + 32, 'X', textStyle(20, TEXT.normal, { fontStyle: 'bold', ...OUTLINE })).setOrigin(origin, 0.5);
      // El ayudante (Y): se apaga cuando ya lo usó en este round.
      const assist = this.add.text(side === 0 ? meterX + 300 : meterX - 300, BAR.y + 32, 'Y', textStyle(20, '#ffd84d', { fontStyle: 'bold', ...OUTLINE })).setOrigin(origin, 0.5);
      // El contador de combo ("3 golpes"), abajo de la barra.
      const combo = this.add.text(anchorX, BAR.y + 76, '', textStyle(34, '#ffd84d', { fontStyle: 'bold', ...OUTLINE, strokeThickness: 7 })).setOrigin(origin, 0.5).setAlpha(0);
      root.add([back, trail, fill, name, wins, meterBack, meter, special, assist, combo]);
      return { root, trail, fill, name, wins, meter, special, assist, combo, trailHealth: 1 };
    });
    this.timerBox = this.add.container(width / 2, BAR.y).setDepth(HUD_DEPTH).setVisible(false);
    this.timerText = this.add.text(0, 0, '', textStyle(44, TEXT.normal, { fontStyle: 'bold', ...OUTLINE })).setOrigin(0.5);
    this.timerBox.add([this.add.rectangle(0, 0, 96, 64, 0x1b1530, 0.8).setRounded(14).setStrokeStyle(4, 0xffffff), this.timerText]);
    this.turnsText = this.add.text(width / 2, BAR.y + 50, '', textStyle(17, TEXT.normal, OUTLINE)).setOrigin(0.5, 0).setDepth(HUD_DEPTH);

    const bannerStyle = { fontStyle: 'bold', stroke: '#1b1530', strokeThickness: 10, align: 'center' };
    this.banner = this.add.text(width / 2, 210, '', textStyle(84, TEXT.accent, bannerStyle)).setOrigin(0.5).setDepth(HUD_DEPTH + 1).setAlpha(0);
    this.subBanner = this.add
      .text(width / 2, 285, '', textStyle(28, TEXT.normal, { ...bannerStyle, strokeThickness: 6 }))
      .setOrigin(0.5, 0)
      .setDepth(HUD_DEPTH + 1)
      .setAlpha(0);
    this.helpText = this.add
      .text(
        width / 2,
        height - 38,
        'A = golpe (3 seguidos = remate)  ·  B = patada  ·  ↓ + A = gancho  ·  ↓ + B = barrida  ·  adelante + B pegadito = agarrar  ·  X = especial\n' +
          '↓ + X o X en el aire = secretos  ·  Y = ayudante  ·  LB / RB = cubrirse (justo a tiempo: ¡parada!)  ·  dos toques al stick = arrancón o rodada\n' +
          'Barra llena: LB + RB = ¡súper!  ·  Mantén LB + RB + Y = salir',
        textStyle(14, TEXT.normal, { ...OUTLINE, align: 'center' }),
      )
      .setOrigin(0.5)
      .setDepth(HUD_DEPTH);
    this.talk = new FightTalk(this, 150, HUD_DEPTH);
    this.exitBar = this.add.rectangle(width / 2 - 100, height - 6, 200, 6, 0xffffff).setOrigin(0, 0.5).setScale(0, 1).setDepth(HUD_DEPTH);
  }

  // En equipos: una barra chiquita por peleador, dos de cada lado (con su nombre y su barra de poder).
  fillTeamHud() {
    const { width } = this.scale;
    this.teamHud ??= [0, 1, 2, 3].map(() => {
      const root = this.add.container(0, 0).setDepth(HUD_DEPTH);
      const back = this.add.rectangle(0, 0, TEAM_BAR.width, TEAM_BAR.height, 0x1b1530, 0.75).setStrokeStyle(3, 0xffffff);
      const fill = this.add.rectangle(0, 0, TEAM_BAR.width, TEAM_BAR.height - 6, 0xffffff);
      const meter = this.add.rectangle(0, 0, TEAM_BAR.width * 0.5, 6, 0xffd84d);
      const name = this.add.text(0, 0, '', textStyle(17, TEXT.normal, { fontStyle: 'bold', ...OUTLINE }));
      root.add([back, fill, meter, name]);
      return { root, back, fill, meter, name };
    });
    this.fighters.forEach((fighter, i) => {
      const bar = this.teamHud[i];
      const left = fighter.team === 0;
      const slot = this.fighters.filter((f) => f.team === fighter.team).indexOf(fighter);
      const x = left ? BAR.margin : width - BAR.margin;
      const y = TEAM_BAR.y + slot * TEAM_BAR.gap;
      const origin = left ? 0 : 1;
      bar.back.setPosition(x, y).setOrigin(origin, 0.5);
      bar.fill.setPosition(x, y).setOrigin(origin, 0.5).setFillStyle(TEAMS[fighter.team].color);
      bar.meter.setPosition(x, y + 15).setOrigin(origin, 0.5);
      bar.name.setPosition(left ? x + TEAM_BAR.width + 10 : x - TEAM_BAR.width - 10, y).setOrigin(left ? 0 : 1, 0.5);
      bar.name.setText(`${fighter.label} · ${fighter.name}`).setColor(hexToCss(TEAMS[fighter.team].color));
      bar.root.setVisible(true);
    });
  }

  fillHud(side, fighter) {
    side.root.setVisible(true);
    side.fill.setFillStyle(fighter.color);
    side.name.setText(`${fighter.label} · ${fighter.name}`).setColor(hexToCss(fighter.color));
    side.trailHealth = fighter.maxHealth;
  }

  updateHud() {
    if (!this.fighters.length) return;
    if (this.teamsMode) {
      this.fighters.forEach((fighter, i) => {
        const bar = this.teamHud[i];
        bar.fill.setScale(fighter.health / fighter.maxHealth, 1);
        const meter = fighter.superMs > 0 ? fighter.superMs / SUPER_MS : fighter.meter / METER_MAX;
        bar.meter.setScale(meter, 1).setFillStyle(fighter.superMs > 0 ? 0xff9a3c : 0xffd84d);
        bar.root.setAlpha(fighter.koed ? 0.4 : 1);
      });
    }
    if (!this.teamsMode) this.hud.forEach((side, i) => {
      const fighter = this.fighters[i];
      side.fill.setScale(fighter.health / fighter.maxHealth, 1);
      // La parte blanca se va bajando despacito detrás de la vida: así se ve cuánto le quitaron.
      side.trailHealth = Math.max(fighter.health, side.trailHealth - frameDelta() * 0.03);
      side.trail.setScale(side.trailHealth / fighter.maxHealth, 1);
      side.wins.setText(this.training ? '' : '★'.repeat(fighter.roundWins) + '☆'.repeat(Math.max(0, this.roundsToWin - fighter.roundWins)));
      const meter = fighter.superMs > 0 ? fighter.superMs / SUPER_MS : fighter.meter / METER_MAX;
      side.meter.setScale(meter, 1).setFillStyle(fighter.superMs > 0 ? 0xff9a3c : fighter.meter >= METER_MAX ? 0xfff2a8 : 0xffd84d);
      side.special.setAlpha(fighter.cooldownMs === 0 ? 1 : 0.3);
      side.assist.setAlpha(fighter.assistUsed ? 0.25 : 1);
    });
    this.timerText.setText(this.training ? '∞' : String(Math.ceil(this.timeLeftMs / 1000)));
    this.timerText.setColor(this.timeLeftMs < 10000 ? '#ff5a5f' : TEXT.normal);
    const turns = this.waiting().map((entry) => this.labelOf(entry.player));
    this.turnsText.setText(turns.length ? `Esperan turno: ${turns.join(', ')}` : '');
  }

  showBanner(title, subtitle = '', holdMs = 0, color = TEXT.accent) {
    say(title);
    this.tweens.killTweensOf([this.banner, this.subBanner]);
    this.banner.setText(title).setColor(color).setAlpha(1).setScale(0.6);
    this.subBanner.setText(subtitle).setAlpha(subtitle ? 1 : 0);
    bounceIn(this, this.banner, this.subBanner);
    if (holdMs > 0) this.tweens.add({ targets: [this.banner, this.subBanner], alpha: 0, delay: holdMs, duration: 300 });
  }

  hideBanner() {
    this.tweens.killTweensOf([this.banner, this.subBanner]);
    this.banner.setAlpha(0);
    this.subBanner.setAlpha(0);
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
    go(this, 'Menu', { selected: this.returnData.selected });
  }
}

function overlaps(a, b) {
  return a.right >= b.left && a.left <= b.right && a.bottom >= b.top && a.top <= b.bottom;
}
