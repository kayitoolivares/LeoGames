import Phaser from 'phaser';
import { controls } from '../../shared/controls.js';
import { frameDelta, setTimeScale } from '../../shared/clock.js';
import { sfx } from '../../shared/sound.js';
import { say } from '../../shared/voice.js';
import { rewards } from '../../shared/rewards.js';
import { players, PLAYER_COLORS } from '../../shared/players.js';
import { TEXT, hexToCss, textStyle } from '../../ui/style.js';
import { burst, confetti, fireworks, popText } from '../brawl/effects.js';
import { comicHit, dustPuff, loadFxArt, shockwave, spark } from '../duelo/fx.js';
import { SmashFinal } from './final.js';
import { awards, showLineup, showResults } from './show.js';
import { SuperBall } from './superball.js';
import { loadBossArt } from '../duelo/boss.js';
import { COSTUMES } from '../duelo/DueloFighter.js';
import { GIANTS, SANDBAG, TARGETS, TEAMS, TIME_MS, jonronRecord, targetRecords, targetSpots } from './modes.js';
import { BOSS_CHARACTERS, CHARACTERS, CHARACTER_KEYS, characterInfo } from './characters.js';
import { METER_MAX, SUPER_MS, SmashFighter, STOCKS, THROW_HIT } from './SmashFighter.js';
import { backgroundTexture, characterTexture, loadSmashArt, loadStageBackground } from './art.js';
import { Ambience } from '../../ui/ambient.js';
import { MAX_NUMBER, RAINBOW, numberStep } from './bloquecito.js';
import { CAPSULE_ITEMS, SmashItems, drawItem } from './items.js';
import { ADVENTURE, showAdventureMap } from './adventure.js';
import { Coins } from './coins.js';
import { HILL_GOAL, Hill } from './hill.js';
import { HotBomb } from './hotbomb.js';
import { JonronContest } from './jonron.js';
import { SmashReplay } from './replay.js';
import { SmashTalk } from './talk.js';
import { Tornadoes } from './tornado.js';
import { Geysers } from './geysers.js';
import { StageEvents } from './events.js';
import { STAGES, buildPlatforms, movePlatforms } from './stages.js';
import { go } from '../../shared/transition.js';
import { bounceIn } from '../../ui/bounce.js';

const COUNTDOWN_STEP_MS = 800;
const EXIT_HOLD_MS = 1200;
const END_INPUT_DELAY_MS = 1500;
const ZOOM_MIN = 0.55;
const ZOOM_MAX = 1.15;
const CAMERA_MARGIN = 220;
const STRONG_HIT_SPEED = 900;
const HIT_WORDS = ['¡PAM!', '¡ZAS!', '¡POW!', '¡BAM!'];
const IDLE = { x: 0, y: 0, jump: false, attack: false, attackHeld: false, special: false, shield: false, transform: false, change: 0 };
const OUTLINE = { stroke: '#1b1530', strokeThickness: 5 };
// Disparos: la estrella de Estrella (poco daño, pero pega de lejos), el láser de Robot (rápido) y la bala
// de cañón de Pirata (lenta, cae en arco por la gravedad y avienta fuerte).
const SHOTS = {
  star: { speed: 700, lifeMs: 900, radius: 16, color: 0xffc93c, hit: { damage: 5, base: 160, scale: 5, angle: 30 } },
  laser: { speed: 1150, lifeMs: 650, radius: 14, color: 0xff4d6d, hit: { damage: 8, base: 220, scale: 6, angle: 15 } },
  cannon: { lifeMs: 1400, radius: 18, gravity: 900, color: 0x3a3a4a, hit: { damage: 12, base: 360, scale: 9, angle: 35 } },
  // Polvo mágico de Hada: lento, va flotando en ondas y avienta hacia arriba.
  dust: { speed: 430, lifeMs: 1100, radius: 24, wave: 18, color: 0xff9ee8, hit: { damage: 6, base: 260, scale: 6, angle: 75 } },
  // Bloquecito: las pelotas de malabares del 3 (salen tres, en arco) y el arcoíris del 7.
  juggle: { lifeMs: 1300, radius: 13, gravity: 1100, color: 0xffd02a, hit: { damage: 5, base: 200, scale: 5, angle: 45 } },
  rainbow: { speed: 900, lifeMs: 700, radius: 22, color: 0xffffff, hit: { damage: 9, base: 260, scale: 7, angle: 25 } },
  // La pistola de rayos (objeto): rayitos azules rápidos.
  zap: { speed: 1300, lifeMs: 600, radius: 14, color: 0x3fe0ff, hit: { damage: 7, base: 210, scale: 6, angle: 20 } },
  // La flor de fuego (objeto): bolas de fuego que botan por el piso.
  fireball: { lifeMs: 1700, radius: 15, gravity: 1300, bounce: 520, color: 0xff7a2f, hit: { damage: 6, base: 230, scale: 6, angle: 40 } },
  // El puño cohete de Robotote.
  fist: { speed: 950, lifeMs: 900, radius: 26, color: 0x5a7ab0, hit: { damage: 12, base: 400, scale: 9, angle: 28 } },
};
// El bumerán: sale rápido, se va frenando y regresa a la mano del que lo aventó (pega de ida y de vuelta).
const BOOMERANG = { pull: 2100, lifeMs: 2200, radius: 24, hit: { damage: 8, base: 280, scale: 7, angle: 35 } };
// Escudo perfecto: el que pegó se queda mareado este rato.
const PERFECT_STUN_MS = 700;
// La cápsula sorpresa: a veces explota (poquito) en vez de sacar otro objeto.
const CAPSULE_BOOM = 0.2;
const CAPSULE_HIT = { damage: 8, base: 300, scale: 6, angle: 70 };
// Modos con vidas sin fin, y con reloj hacia atrás.
const ENDLESS_MODES = ['tiempo', 'blancos', 'monedas', 'colina', 'subida', 'jonron'];
const TIMED_MODES = ['tiempo', 'monedas', 'colina'];
// Lo que dice el letrero al empezar, en los modos que no son de pelea normal.
const MODE_INTROS = {
  bomba: '¡Pégale a otro para pasarle la bomba!',
  jonron: '¡Pégale al saco 10 segundos!',
  monedas: 'Pega para sacar monedas y agárralas',
  colina: 'Quédate solo en la zona de la corona',
  subida: '¡Sube hasta la bandera!',
  blancos: '¡Rompe todas las dianas!',
};
// La repetición sale solo si la pelea se acabó por un KO (o un golpe al jefe) de hace un instante.
const REPLAY_RECENT_MS = 400;
// Un KO cuenta para el último que le pegó, si fue hace poco.
const KO_CREDIT_MS = 8000;
// El ayudante del huevo sorpresa pelea de tu lado un rato.
const HELPER_MS = 12000;
// La compu con Bloquecito: cada cuánto escoge otro número (y lo va contando, un número cada tanto).
const CPU_NUMBER_MS = { min: 3000, extra: 4000, step: 260 };
// Ninja aparece detrás del rival más cercano si está a esta distancia; si no, avanza un poco.
const TELEPORT_RANGE = 700;
const TELEPORT_HOP = 220;
// La bomba explota al tocar a alguien, al caer o a los 1.5 s; quien la lanzó no recibe daño.
const BOMB = { gravity: 1400, fuseMs: 1500, blast: 130, hit: { damage: 15, base: 380, scale: 10, angle: 50 } };
const ITEM_NAMES = {
  hammer: '¡Martillo!',
  bomb: '¡Bomba!',
  heart: '-40%',
  star: '¡Estrella!',
  bat: '¡Bate!',
  raygun: '¡Pistola de rayos!',
  skate: '¡Patineta!',
  egg: '¡Huevo sorpresa!',
  boomerang: '¡Bumerán!',
  fireflower: '¡Flor de fuego!',
  capsule: '¡Caja sorpresa!',
  tornado: '¡Tornado!',
};

// Qué tan bueno es el CPU. attack/shield/special/jump/transform: probabilidad por cuadro de hacerlo cuando conviene.
const CPU_LEVELS = {
  facil: { attack: 0.04, shield: 0.02, special: 0.004, jump: 0.04, transform: 0.003, items: false, smart: false },
  normal: { attack: 0.08, shield: 0.06, special: 0.01, jump: 0.08, transform: 0.01, items: true, smart: true },
  dificil: { attack: 0.16, shield: 0.15, special: 0.02, jump: 0.12, transform: 0.03, items: true, smart: true },
};

const DEFAULT_SETTINGS = { mode: 'vidas', stage: 'castillo', items: true, cpus: 1, level: 'normal' };
const TARGET_RADIUS = 26;

// "Bolitas Bros": pelea estilo Smash. Cada golpe sube tu %, y entre más % llevas,
// más lejos sales volando; si te sacan de la pantalla pierdes una vida. Gana el último con vidas.
// El mundo (con zoom) y los textos de pantalla usan cámaras separadas para que el zoom no mueva el marcador.
// Recibe de la pantalla de selección: picks (personaje por control), peque (modo peque por control) y settings.
export class SmashScene extends Phaser.Scene {
  constructor() {
    super('Smash');
  }

  init(data) {
    this.returnData = data ?? {};
    this.settings = { ...DEFAULT_SETTINGS, ...(this.returnData.settings ?? {}) };
    // La Aventura: el nivel que toca decide el modo, el escenario y la compu.
    this.adventure = null;
    if (this.settings.mode === 'aventura') {
      const index = this.returnData.adventure?.index ?? 0;
      const spec = ADVENTURE[index];
      this.adventure = { index, spec };
      this.settings = { ...this.settings, mode: spec.mode, stage: spec.stage, level: spec.level ?? this.settings.level };
    }
    // El concurso de jonrón va por turnos (uno por jugador): en qué turno va y los metros de los que ya pegaron.
    this.jonronTurn = this.returnData.jonron ?? { turn: 0, results: [] };
    // Los personajes de la compu se escogen antes de cargar, para cargar solo las poses de los que van a pelear.
    const humans = players.sorted().length;
    const mode = this.settings.mode;
    // Contra el jefe la compu ayuda (puede no haber); en Rompe los blancos, el jonrón y la torre no hay compu.
    let cpus = Math.max(humans < 2 ? 1 : 0, Math.min(this.settings.cpus, 4 - humans));
    if (mode === 'jefe') cpus = Math.max(0, Math.min(this.settings.cpus, 4 - humans));
    if (mode === 'blancos' || mode === 'jonron' || mode === 'subida') cpus = 0;
    // En equipos tiene que haber al menos uno de cada lado.
    if (mode === 'equipos' && humans + cpus < 2) cpus = 1;
    this.cpuPicks = this.adventure
      ? [...(this.adventure.spec.cpus ?? [])]
      : Array.from({ length: cpus }, () => CHARACTER_KEYS[Math.floor(Math.random() * CHARACTER_KEYS.length)]);
  }

  preload() {
    const picks = [...Object.values(this.returnData.picks ?? {}), ...this.cpuPicks];
    loadSmashArt(this, { posesFor: picks });
    loadStageBackground(this, this.settings.stage);
    loadFxArt(this);
    if (this.settings.mode === 'jefe' || picks.some((key) => BOSS_CHARACTERS[key])) loadBossArt(this);
  }

  create() {
    const { width, height } = this.scale;
    this.stage = STAGES[this.settings.stage] ?? STAGES.castillo;
    this.cameras.main.setBackgroundColor(this.stage.sky);
    this.world = this.add.container(0, 0);
    this.ui = this.add.container(0, 0);
    this.uiCam = this.cameras.add(0, 0, width, height);
    this.cameras.main.ignore(this.ui);
    this.uiCam.ignore(this.world);

    this.drawBackground();
    // Lo que se mueve en el escenario (pájaros, nubes, chispas...): en la cámara de la pantalla, debajo del marcador.
    this.ambience = new Ambience(this, this.settings.stage, { depth: -1 });
    this.cameras.main.ignore(this.ambience.root);
    this.platforms = buildPlatforms(this, this.world, this.stage);
    this.main = this.platforms.find((p) => p.main);
    this.mode = this.settings.mode;
    // Jonrón: el concurso (con el pasto larguísimo de abajo, que es una plataforma más).
    this.jonron = this.mode === 'jonron' ? new JonronContest(this, this.world, this.main, this.stage.sky, this.backdrop) : null;
    if (this.jonron) this.platforms.push(this.jonron.field);
    this.hill = this.mode === 'colina' ? new Hill(this, this.world, this.platforms) : null;
    this.goal = this.mode === 'subida' ? this.drawGoal() : null;
    this.geysers = this.stage.geysers && this.mode !== 'jonron' ? new Geysers(this, this.world, this.main, this.stage.geysers) : null;
    // (En Rompe los blancos, el jonrón y la torre no hay sorpresas.)
    const quiet = ['blancos', 'jonron', 'subida'].includes(this.mode);
    this.events = quiet ? null : new StageEvents(this, this.world, this.stage, this.main, this.platforms);
    this.itemsOn = this.settings.items && this.mode !== 'jonron';
    this.stageMs = 0;
    this.items = new SmashItems(this, this.world, this.platforms, {
      minX: this.main.left + 100,
      maxX: this.main.right - 100,
      spawnY: this.stage.respawn.y - 120,
      bottom: this.stage.blast.bottom,
      gravity: this.stage.gravity,
    });
    this.projectiles = [];
    // (La escena se reusa en cada pelea: lo de la pelea anterior se borra.)
    this.bossBar = null;
    this.results = null;
    this.final = null;
    this.giant = null;
    this.bag = null;
    this.climber = null;
    this.adventureWon = false;
    this.pending = null;
    this.lastKo = null;
    this.lastBossHitAt = 0;
    this.replay = new SmashReplay();
    this.fighters = this.createFighters();
    this.players = [...this.fighters];
    this.boss = this.fighters.find((f) => f.isBoss) ?? null;
    this.coins = this.mode === 'monedas' ? new Coins(this, this.world, this.platforms, this.stage.blast.bottom) : null;
    this.hotBomb = this.mode === 'bomba' ? new HotBomb(this, this.world) : null;
    this.tornadoes = new Tornadoes(this, this.world, this.main, (owner, victim, result) => this.noteHit(owner, victim, result.dealt, result.speed));
    this.timeMs = TIMED_MODES.includes(this.mode) ? TIME_MS : 0;
    this.targets = this.mode === 'blancos' ? this.createTargets() : [];
    this.superBall = new SuperBall(this, this.world, {
      minX: this.main.left + 120,
      maxX: this.main.right - 120,
      topY: this.stage.respawn.y - 40,
      bottomY: this.main.top - 180,
    });
    this.createHud();
    this.talk = new SmashTalk(this, this.ui);
    // En el jonrón con varios, de quién es el turno.
    this.countdownNote = this.jonron && players.sorted().length > 1 ? `Turno de ${this.fighters[0].label}` : '';
    // La primera vez, todos en fila en su pose de entrada (en la Aventura, el mapa); en la revancha, directo a la cuenta.
    this.phase = this.returnData.rematch ? 'countdown' : 'lineup';
    this.phaseMs = 0;
    for (const fighter of this.fighters) fighter.posing = true;
    if (this.phase === 'lineup' && this.adventure) showAdventureMap(this, this.ui, this.adventure.index, () => this.setPhase('countdown'));
    else if (this.phase === 'lineup') showLineup(this, this.fighters, this.ui, () => this.setPhase('countdown'));
    this.exitMs = 0;
    this.exiting = false;
    this.cam = { x: 1000, y: 600, zoom: 0.8 };
    this.updateCamera(0, true);
    this.input.keyboard?.on('keydown-ESC', () => this.exit());
  }

  // Fondo: la imagen del escenario si existe (npm run arte), estirada para cubrir toda la zona de juego;
  // si no, el fondo dibujado con figuras.
  drawBackground() {
    const key = backgroundTexture(this, this.settings.stage);
    const zone = this.stage.blast;
    // Hasta dónde llega el dibujo del fondo (la imagen cubre toda la zona y se sale un poco por los lados).
    this.backdrop = { left: zone.left, right: zone.right, top: zone.top };
    if (key) {
      const image = this.add.image((zone.left + zone.right) / 2, (zone.top + zone.bottom) / 2, key);
      image.setScale(Math.max((zone.right - zone.left) / image.width, (zone.bottom - zone.top) / image.height));
      this.world.add(image);
      this.backdrop = { left: image.x - image.displayWidth / 2, right: image.x + image.displayWidth / 2, top: image.y - image.displayHeight / 2 };
    } else {
      this.stage.drawBackground(this, this.world);
    }
    this.stage.drawProps?.(this, this.world);
  }

  // Los jugadores con su personaje y, si se pidieron, CPUs con personaje al azar (siempre hay al menos un rival).
  createFighters() {
    let humans = players.sorted();
    // En el jonrón, solo el que tiene el turno.
    if (this.jonron) humans = [humans[this.jonronTurn.turn] ?? humans[0]];
    const picks = this.returnData.picks ?? {};
    const peque = this.returnData.peque ?? {};
    const costumes = this.returnData.costumes ?? {};
    const arena = { platforms: this.platforms, respawn: this.stage.respawn, gravity: this.stage.gravity };
    const list = humans.map(
      (player) =>
        new SmashFighter(this, this.world, {
          color: players.color(player).hex,
          label: `J${player.slot + 1}`,
          deviceId: player.deviceId,
          character: picks[player.deviceId] ?? CHARACTER_KEYS[player.slot % CHARACTER_KEYS.length],
          peque: Boolean(peque[player.deviceId]),
          costume: costumes[player.deviceId] ?? 0,
          arena,
        }),
    );
    const cpus = this.cpuPicks.length;
    const taken = new Set(humans.map((player) => player.colorIndex));
    const colors = PLAYER_COLORS.filter((_, i) => !taken.has(i));
    const spec = this.adventure?.spec;
    for (let i = 0; i < cpus; i += 1) {
      const character = this.cpuPicks[i];
      // El gigante de la Aventura: el mismo personaje, pero enorme y pesado.
      const giant = spec?.giant ? { ...CHARACTERS[character], radius: 64, weight: 2.2, power: 1.35, run: 260, air: 260 } : null;
      const cpu = new SmashFighter(this, this.world, {
        color: colors[i].hex,
        label: giant ? 'Gigante' : cpus > 1 ? `CPU ${i + 1}` : 'CPU',
        character,
        cpuLevel: this.settings.level,
        stats: giant,
        arena,
      });
      if (giant) cpu.bossName = `${CHARACTERS[character].name} gigante`;
      if (spec?.stocks) cpu.stocks = spec.stocks;
      list.push(cpu);
    }
    // Cada quien en su equipo (sin equipos, cada uno solo; contra el jefe y en los blancos, todos juntos; en la
    // Aventura, los jugadores contra la compu). Los ayudantes del huevo son del equipo de quien lo abrió.
    const mode = this.mode;
    list.forEach((fighter, i) => {
      if (this.adventure) fighter.team = fighter.isCpu ? 1 : 0;
      else if (mode === 'jefe' || mode === 'blancos') fighter.team = 0;
      else if (mode !== 'equipos') fighter.team = i;
      else if (!fighter.isCpu) fighter.team = humans.indexOf(humans.find((p) => p.deviceId === fighter.deviceId)) % 2;
    });
    if (mode === 'equipos') {
      for (const cpu of list.filter((f) => f.isCpu)) {
        const reds = list.filter((f) => f.team === 0).length;
        const blues = list.filter((f) => f.team === 1).length;
        cpu.team = reds <= blues ? 0 : 1;
      }
      for (const fighter of list) {
        const color = TEAMS[fighter.team].color;
        fighter.ring?.setStrokeStyle(5, color);
        fighter.tag.setColor(hexToCss(color));
      }
    }
    // Si dos traen el mismo personaje con el mismo traje, el segundo sale de otro color.
    list.forEach((fighter, i) => {
      while (list.slice(0, i).some((o) => o.characterKey === fighter.characterKey && o.costumeIndex === fighter.costumeIndex)) {
        fighter.setCostume((fighter.costumeIndex + 1) % COSTUMES.length);
      }
    });
    // Vidas sin fin en los modos de puntos, de reloj, de dianas y en la torre.
    if (ENDLESS_MODES.includes(mode)) for (const fighter of list) fighter.infinite = true;
    if (mode === 'jefe') list.push(this.createBoss(arena, GIANTS[spec?.boss ?? 'rey']));
    if (this.jonron) list.push(this.createSandbag(arena));
    list.forEach((fighter, i) => fighter.spawn(fighter.isBoss || fighter.isDummy ? 1000 : this.stage.spawns[i], this.main.top - 100, 0));
    return list;
  }

  // El jefe gigante (el Rey Bolón o Dragonzote), con su barra de vida.
  createBoss(arena, giant) {
    this.giant = giant;
    const boss = new SmashFighter(this, this.world, {
      color: giant.color,
      label: '👑',
      character: giant.character,
      cpuLevel: 'dificil',
      stats: giant.stats,
      arena,
    });
    boss.isBoss = true;
    boss.bossName = giant.stats.name;
    boss.team = 1;
    boss.bossHp = giant.health;
    boss.slamCooldownMs = giant.slamCooldownMs;
    boss.stocks = 1;
    boss.infinite = true;
    return boss;
  }

  // El saco del concurso de jonrón: no se mueve solo, no se agarra de la orilla y no llena barra.
  createSandbag(arena) {
    const bag = new SmashFighter(this, this.world, { color: 0xa8743f, label: 'Saco', character: 'saco', stats: SANDBAG, arena, art: 'smash:objeto-saco' });
    bag.isDummy = true;
    bag.noLedge = true;
    bag.bossName = 'Saco';
    bag.team = 1;
    bag.infinite = true;
    this.bag = bag;
    return bag;
  }

  // La bandera de la meta (la torre de la Aventura).
  drawGoal() {
    const { x, y } = this.stage.goal;
    const cloth = this.add.triangle(4, -134, 0, 0, 70, 20, 0, 40, 0xff5a5f).setOrigin(0, 0).setStrokeStyle(3, 0x1b1530);
    const flag = this.add.container(x, y, [this.add.rectangle(0, -70, 8, 140, 0xffffff).setStrokeStyle(2, 0x1b1530), cloth, this.add.circle(0, -144, 8, 0xffd84d)]);
    this.world.add(flag);
    this.tweens.add({ targets: cloth, scaleX: 0.8, duration: 300, yoyo: true, repeat: -1 });
    return flag;
  }

  // Rompe los blancos: las dianas en su lugar.
  createTargets() {
    return targetSpots(this.stage).map(({ x, y }) => {
      const sprite = drawItem(this, 'target').setPosition(x, y).setScale(1.3);
      this.world.add(sprite);
      return { x, y, sprite, broken: false };
    });
  }

  // Le pegaron a una diana (con un golpe o un disparo): se rompe y cuenta para quien la rompió.
  breakTarget(target, by) {
    target.broken = true;
    target.sprite.destroy();
    const credit = by.helperOf ?? by;
    credit.record.targets = (credit.record.targets ?? 0) + 1;
    burst(this, target.x, target.y, 0xff5a5f, 12, this.world);
    burst(this, target.x, target.y, 0xffffff, 8, this.world);
    const left = this.targets.filter((t) => !t.broken).length;
    popText(this, target.x, target.y - 40, left ? `¡Faltan ${left}!` : '¡Todas!', '#ffd84d', this.world);
    sfx.coin();
    sfx.hit(0.3);
  }

  hitTargets(x, y, radius, by) {
    for (const target of this.targets) {
      if (!target.broken && Math.hypot(target.x - x, target.y - y) < radius + TARGET_RADIUS) this.breakTarget(target, by);
    }
  }

  createHud() {
    const { width, height } = this.scale;
    const panelW = 220;
    const gap = 20;
    const shown = this.fighters.filter((f) => !f.helperOf && !f.isBoss && !f.isDummy);
    const startX = (width - (shown.length * panelW + (shown.length - 1) * gap)) / 2 + panelW / 2;
    this.hud = shown.map((fighter, i) => {
      const x = startX + i * (panelW + gap);
      const y = height - 70;
      const left = x - panelW / 2;
      const border = this.settings.mode === 'equipos' ? TEAMS[fighter.team].color : fighter.color;
      const bg = this.add.rectangle(x, y, panelW, 112, 0x1b1530, 0.6).setRounded(18).setStrokeStyle(4, border);
      const title = `${fighter.label} · ${fighter.bossName ?? characterInfo(fighter.characterKey).name}${fighter.peque ? ' · peque' : ''}`;
      const name = this.add.text(left + 16, y - 48, title, textStyle(17, hexToCss(fighter.color), { fontStyle: 'bold', ...OUTLINE }));
      const damage = this.add.text(x + 30, y - 6, '0%', textStyle(46, TEXT.normal, { fontStyle: 'bold', ...OUTLINE })).setOrigin(0.5);
      const stocks = Array.from({ length: STOCKS }, (_, k) =>
        this.add.circle(left + 24 + k * 22, y + 28, 8, fighter.color).setStrokeStyle(2, 0xffffff),
      );
      // Barra de poder: se llena con los golpes; llena = LB + RB para transformarse.
      // En súper modo muestra cuánto le queda.
      const meterW = panelW - 32;
      const meterBg = this.add.rectangle(left + 16, y + 44, meterW, 8, 0xffffff, 0.15).setOrigin(0, 0.5);
      const meter = this.add.rectangle(left + 16, y + 44, meterW, 8, 0xffd84d).setOrigin(0, 0.5).setScale(0, 1);
      const meterText = this.add.text(left + panelW - 14, y + 28, '', textStyle(15, '#ffd84d', { fontStyle: 'bold', ...OUTLINE })).setOrigin(1, 0.5);
      // En Tiempo, en vez de vidas, los puntos; en los blancos, cuántas dianas lleva.
      const score = this.add.text(left + 16, y + 28, '', textStyle(19, '#ffd84d', { fontStyle: 'bold', ...OUTLINE })).setOrigin(0, 0.5);
      if (fighter.infinite) stocks.forEach((dot) => dot.setVisible(false));
      this.ui.add([bg, name, damage, ...stocks, score, meterBg, meter, meterText]);
      return { fighter, damage, stocks, score, meter, meterText, shown: null };
    });
    // El reloj (Tiempo: cuenta hacia atrás; Blancos: cuánto llevas) y la barra de vida del jefe.
    this.timerText = this.add.text(width / 2, 84, '', textStyle(40, TEXT.normal, { fontStyle: 'bold', ...OUTLINE })).setOrigin(0.5);
    this.ui.add(this.timerText);
    if (this.boss) {
      const barW = 640;
      this.bossBar = {
        back: this.add.rectangle(width / 2, 84, barW, 26, 0x1b1530, 0.8).setStrokeStyle(4, 0xffffff),
        fill: this.add.rectangle(width / 2 - barW / 2 + 4, 84, barW - 8, 18, this.giant.color).setOrigin(0, 0.5),
        name: this.add.text(width / 2, 62, `👑 ${this.giant.stats.name}`, textStyle(22, '#ffd84d', { fontStyle: 'bold', ...OUTLINE })).setOrigin(0.5),
      };
      this.ui.add([this.bossBar.back, this.bossBar.fill, this.bossBar.name]);
    }
    // Si alguien escogió a Bloquecito, cómo cambia de número.
    if (this.fighters.some((f) => f.blocks && !f.isCpu)) {
      const hint = this.add.text(width / 2, 62, 'Bloquecito: Y = sube de número  ·  ↓ + Y = baja', textStyle(16, TEXT.accent, OUTLINE)).setOrigin(0.5);
      this.ui.add(hint);
    }

    const bannerStyle = { fontStyle: 'bold', stroke: '#1b1530', strokeThickness: 10, align: 'center' };
    this.banner = this.add.text(width / 2, 250, '', textStyle(84, TEXT.accent, bannerStyle)).setOrigin(0.5).setAlpha(0);
    this.subBanner = this.add.text(width / 2, 330, '', textStyle(28, TEXT.normal, { ...bannerStyle, strokeThickness: 6 })).setOrigin(0.5).setAlpha(0);
    const help = this.add
      .text(
        width / 2,
        22,
        'A = saltar  ·  X = golpe (mantén = cargado)  ·  B = especial (+ ↑ rescate)  ·  RB / LB = escudo (justo a tiempo = ¡perfecto!)  ·  LB + RB = ¡súper!',
        textStyle(16, TEXT.normal, OUTLINE),
      )
      .setOrigin(0.5);
    this.exitBar = this.add.rectangle(width / 2 - 100, 42, 200, 6, 0xffffff).setOrigin(0, 0.5).setScale(0, 1);
    this.ui.add([this.banner, this.subBanner, help, this.exitBar]);
  }

  showBanner(title, subtitle = '', holdMs = 0, color = TEXT.accent) {
    say(title);
    this.tweens.killTweensOf([this.banner, this.subBanner]);
    this.banner.setText(title).setColor(color).setAlpha(1).setScale(0.6);
    this.subBanner.setText(subtitle).setAlpha(subtitle ? 1 : 0);
    bounceIn(this, this.banner, this.subBanner);
    if (holdMs > 0) this.tweens.add({ targets: [this.banner, this.subBanner], alpha: 0, delay: holdMs, duration: 300 });
  }

  setPhase(phase) {
    this.phase = phase;
    this.phaseMs = 0;
  }

  update() {
    const dt = frameDelta();
    this.phaseMs += dt;
    this.updateExit(dt);
    // Durante el golpe final todo se queda quieto.
    if (this.phase === 'final') {
      if (this.final.update(dt)) {
        this.final = null;
        this.setPhase('fight');
      }
      for (const fighter of this.fighters) fighter.render();
      this.updateHud();
      return;
    }
    // La repetición del K.O. (A la brinca).
    if (this.phase === 'replay') {
      const skip = players.sorted().some((p) => controls.justPressed(p.deviceId, 'a'));
      if (!this.replay.step(dt) || skip) {
        this.replay.finish();
        this.closeFight();
      }
      for (const fighter of this.fighters) fighter.render();
      this.updateHud();
      return;
    }
    this.stageMs += dt;
    movePlatforms(this.platforms, this.stageMs);

    if (this.phase === 'lineup' || this.phase === 'countdown') {
      if (this.phase === 'countdown') this.updateCountdown();
      for (const fighter of this.fighters) fighter.update(dt, IDLE);
    } else {
      for (const fighter of this.fighters) {
        const input = this.inputFor(fighter);
        const wantsSuper = fighter.isCpu ? this.cpuWantsSuper(fighter) : input.transform;
        if (wantsSuper && fighter.transform()) this.celebrateSuper(fighter);
        fighter.update(dt, input);
      }
      this.announceFullMeters();
      this.spawnProjectiles();
      this.updateProjectiles(dt);
      this.items.update(dt, this.fighters, this.itemsOn && this.phase === 'fight', (fighter, item) => this.pickedUp(fighter, item));
      this.superBall.update(dt, this.itemsOn && this.mode !== 'subida' && this.phase === 'fight', this.fighters.some((f) => f.finalReady));
      this.updateHelpers(dt);
      this.tornadoes.update(dt, this.fighters);
      this.coins?.update(dt, this.fighters, (fighter) => this.pickCoin(fighter));
      if (this.phase === 'fight') this.hotBomb?.update(dt, this.fighters);
      if (this.hill?.update(dt, this.fighters, this.phase === 'fight')) this.talk.line('¡La corona se cambió de lugar!');
      if (this.jonron && this.phase === 'fight') this.timerText.setText(this.jonron.update(dt, this.bag, this.players.find((f) => !f.isDummy)));
      this.resolveHits();
      this.geysers?.update(dt, this.fighters, this.phase === 'fight');
      this.events?.update(dt, this.fighters, this.phase === 'fight');
      this.checkBlastZones();
      if (this.phase === 'fight') {
        this.replay.record(dt, this.fighters);
        this.updateClock(dt);
        this.checkWinner();
      } else if (this.phase === 'end') {
        this.updateEnd();
      }
    }

    for (const fighter of this.fighters) fighter.render();
    this.talk.update(dt);
    this.updateCamera(dt / 1000);
    this.updateHud();
  }

  updateCountdown() {
    const step = Math.floor(this.phaseMs / COUNTDOWN_STEP_MS);
    const label = step < 3 ? String(3 - step) : '¡A pelear!';
    if (this.banner.text !== label) {
      const note = step < 3 ? this.countdownNote : (MODE_INTROS[this.mode] ?? '');
      this.showBanner(label, note, step < 3 ? 0 : note ? 1400 : 700);
      sfx.countdown(step >= 3);
    }
    if (step >= 3) {
      this.setPhase('fight');
      for (const fighter of this.fighters) fighter.posing = false;
    }
  }

  inputFor(fighter) {
    if (fighter.isDummy) return IDLE;
    if (fighter.isCpu) return { ...this.cpuInput(fighter), change: this.cpuNumber(fighter) };
    const id = fighter.deviceId;
    const stick = controls.getStick(id);
    // Con la barra llena, LB + RB juntos transforman (en vez de subir el escudo ese cuadro).
    const transform =
      fighter.canTransform() &&
      controls.isDown(id, 'lb') &&
      controls.isDown(id, 'rb') &&
      (controls.justPressed(id, 'lb') || controls.justPressed(id, 'rb'));
    return {
      x: stick.x,
      y: stick.y,
      jump: controls.justPressed(id, 'a'),
      attack: controls.justPressed(id, 'x'),
      // Mantener X carga el golpe.
      attackHeld: controls.isDown(id, 'x'),
      special: controls.justPressed(id, 'b'),
      // Escudo con cualquier botón de arriba (bumpers o gatillos), para que sea fácil de encontrar.
      shield: !transform && ['rb', 'lb', 'rt', 'lt'].some((button) => controls.isDown(id, button)),
      transform,
      change: numberStep(id),
    };
  }

  // Bloquecito de la compu: de vez en cuando escoge un número y va contando hacia él, uno por uno.
  cpuNumber(fighter) {
    if (!fighter.blocks || this.phase !== 'fight' || fighter.superMs > 0 || !fighter.isAlive()) return 0;
    fighter.cpuNumberMs = (fighter.cpuNumberMs ?? CPU_NUMBER_MS.min) - frameDelta();
    if (fighter.cpuNumberMs > 0) return 0;
    const current = fighter.look.number;
    if (!fighter.cpuGoal || fighter.cpuGoal === current) {
      fighter.cpuGoal = 1 + Math.floor(Math.random() * MAX_NUMBER);
      fighter.cpuNumberMs = CPU_NUMBER_MS.min + Math.random() * CPU_NUMBER_MS.extra;
      return 0;
    }
    fighter.cpuNumberMs = CPU_NUMBER_MS.step;
    return fighter.cpuGoal > current ? 1 : -1;
  }

  // El CPU se transforma un ratito después de llenar su barra, si tiene a alguien cerca.
  cpuWantsSuper(fighter) {
    if (!fighter.canTransform() || this.phase !== 'fight' || fighter.hitstunMs > 0) return false;
    const level = CPU_LEVELS[fighter.cpuLevel] ?? CPU_LEVELS.normal;
    const rival = this.nearestRival(fighter, 500);
    return Boolean(rival) && Math.random() < level.transform;
  }

  // ¡Se transformó! Letrero con su súper nombre, destello y un aro que crece.
  celebrateSuper(fighter) {
    if (!fighter.isCpu) rewards.earn('smash-super');
    this.showBanner(`¡${fighter.stats.superName ?? fighter.baseStats.superName}!`, '', 900, hexToCss(fighter.color));
    burst(this, fighter.x, fighter.y, 0xffd84d, 16, this.world);
    burst(this, fighter.x, fighter.y, fighter.color, 12, this.world);
    const ring = this.add.circle(fighter.x, fighter.y, 40).setStrokeStyle(8, 0xffd84d);
    this.world.add(ring);
    this.tweens.add({ targets: ring, scale: 5, alpha: 0, duration: 600, ease: 'Quad.easeOut', onComplete: () => ring.destroy() });
    this.cameras.main.flash(200, 255, 236, 160);
    this.cameras.main.shake(200, 0.006);
  }

  // Avisa una vez cuando a alguien se le llena la barra.
  announceFullMeters() {
    for (const fighter of this.fighters) {
      const full = fighter.canTransform();
      if (full && !fighter.fullAnnounced) {
        popText(this, fighter.x, fighter.y - 90, fighter.isCpu ? '¡Barra llena!' : '¡LB + RB!', '#ffd84d', this.world);
        sfx.meterFull();
      }
      fighter.fullAnnounced = full;
    }
  }

  // Rival vivo más cercano a menos de `maxDist` (o null). Los de su equipo no cuentan.
  nearestRival(fighter, maxDist = Infinity) {
    let best = null;
    let bestDist = maxDist;
    for (const other of this.fighters) {
      if (other.team === fighter.team || !other.isAlive()) continue;
      const dist = Math.hypot(other.x - fighter.x, other.y - fighter.y);
      if (dist < bestDist) [best, bestDist] = [other, dist];
    }
    return best;
  }

  // CPU: persigue al rival más cercano, escoge el golpe según dónde está, se cubre, usa su especial,
  // va por objetos (y lanza bombas), huye del que tiene estrella y regresa al escenario si se cae.
  cpuInput(fighter) {
    if (fighter.hitstunMs > 0 || fighter.stunMs > 0 || this.phase !== 'fight') return IDLE;
    // Cargando un golpe: lo suelta cuando se le acaba la paciencia.
    if (fighter.attack?.chargeable && !fighter.attack.released) {
      fighter.cpuChargeMs = (fighter.cpuChargeMs ?? 0) - frameDelta();
      return { ...IDLE, attackHeld: fighter.cpuChargeMs > 0 };
    }
    const level = CPU_LEVELS[fighter.cpuLevel] ?? CPU_LEVELS.normal;
    const main = this.main;
    const center = (main.left + main.right) / 2;
    if (fighter.x < main.left - 10 || fighter.x > main.right + 10) {
      const falling = fighter.vy > 0 && fighter.y > main.top - 150;
      return {
        ...IDLE,
        x: Math.sign(center - fighter.x),
        y: falling && fighter.airJumps === 0 ? -1 : 0,
        jump: falling && fighter.airJumps > 0,
        special: falling && fighter.airJumps === 0 && !fighter.rescueUsed,
      };
    }

    let target = null;
    let best = Infinity;
    for (const other of this.fighters) {
      if (other.team === fighter.team || !other.isAlive()) continue;
      const dist = Math.hypot(other.x - fighter.x, other.y - fighter.y);
      if (dist < best) [target, best] = [other, dist];
    }

    // ¿Hacia dónde ir? Al rival, a un objeto cercano o lejos del que tiene la estrella.
    let goal = target;
    let flee = false;
    if (target?.starPowerMs > 0 && best < 450) flee = true;
    else if (level.items && !fighter.held) {
      const item = this.items.nearest(fighter, 450);
      const wanted = item && (item.type !== 'heart' || fighter.damage > 60) && item.type !== 'spring';
      if (wanted) goal = item;
    }
    // Monedas: va por las que estén cerca. Colina: se va a la zona (y ahí se queda si no hay nadie pegadito).
    if (!flee && goal === target) {
      const coin = this.coins?.nearest(fighter, 380);
      if (coin && (!target || best > 140)) goal = coin;
      if (this.hill?.contains(fighter) && (!target || best > 220)) return IDLE;
      if (this.hill && !this.hill.contains(fighter) && (!target || best > 160)) goal = { x: this.hill.x, y: this.hill.platform.top - fighter.radius };
    }
    if (!goal) return IDLE;

    const dx = goal.x - fighter.x;
    const dy = goal.y - fighter.y;
    let x;
    if (flee) x = -Math.sign(dx);
    else x = goal === target && Math.abs(dx) < 85 ? Math.sign(dx) * 0.3 : Math.sign(dx);
    // No se avienta del escenario persiguiendo a alguien (ni huyendo).
    if ((fighter.x < main.left + 40 && x < 0) || (fighter.x > main.right - 40 && x > 0)) x = 0;

    const above = dy < -90;
    const below = dy > 90;
    const needsRescue = above && !fighter.grounded && fighter.vy > 0 && fighter.airJumps === 0 && !fighter.rescueUsed;
    const climb = {
      y: below && fighter.platform?.soft ? 1 : dy < -60 ? -1 : 0,
      jump: (above || (flee && Math.random() < 0.02)) && (fighter.grounded ? Math.random() < level.jump : fighter.vy > 0 && fighter.airJumps > 0),
    };
    if (goal !== target || flee) return { ...IDLE, x, ...climb, special: needsRescue && Math.random() < 0.1 };

    const tdy = target.y - fighter.y;
    const close = Math.abs(dx) < 85 && Math.abs(tdy) < 80;
    // Se cubre a veces cuando el otro está por pegarle.
    const threatened = close && target.attack && fighter.grounded && fighter.shieldHp > 40;
    // Fantasma en vez de cubrirse se vuelve invisible (si ya puede).
    if (threatened && fighter.characterKey === 'fantasma' && fighter.cooldownMs === 0 && Math.random() < level.shield) {
      return { ...IDLE, special: true };
    }
    if (threatened && (fighter.shielding || Math.random() < level.shield)) return { ...IDLE, shield: true };

    // Con la bola súper rota, el golpe final en cuanto tiene a alguien cerquita.
    if (fighter.finalReady && best < 600) return { ...IDLE, special: true };
    // Con la pistola de rayos, la flor de fuego o el bumerán, dispara cuando el rival está a su altura.
    const shooting = ['raygun', 'fireflower'].includes(fighter.held?.type) || (fighter.held?.type === 'boomerang' && !fighter.held.out);
    if (shooting) {
      const lined = Math.abs(tdy) < 50 && Math.abs(dx) < 700;
      return { ...IDLE, x: lined ? Math.sign(dx) * 0.2 : x, ...climb, attack: lined && Math.random() < 0.08 };
    }
    // Con la bomba en la mano, la lanza cuando el rival está a buena distancia y a su altura.
    if (fighter.held?.type === 'bomb') {
      const inRange = Math.abs(dx) > 120 && Math.abs(dx) < 520 && Math.abs(tdy) < 120;
      return { ...IDLE, x: inRange ? Math.sign(dx) * 0.3 : x, ...climb, attack: inRange && Math.random() < 0.1 };
    }

    // Golpe según dónde está el rival: arriba → hacia arriba; abajo estando en el aire → pisotón.
    let aim = climb.y;
    if (level.smart && close) aim = tdy < -40 ? -1 : !fighter.grounded && tdy > 30 ? 1 : 0;
    // Estrella, Robot (y Bloquecito en 3, 5 o 7) disparan de lejos si el otro está a su altura; Ninja se le aparece por detrás.
    const key = fighter.characterKey;
    const shooter = key === 'estrella' || key === 'robot' || (fighter.blocks && [3, 5, 7].includes(fighter.look.form));
    const lined = shooter && Math.abs(tdy) < 40 && Math.abs(dx) > 150 && Math.abs(dx) < 600;
    const ambush = key === 'ninja' && best > 200 && best < TELEPORT_RANGE;
    const attack = close && Math.random() < level.attack;
    // A veces carga el golpe (si el rival ya trae mucho %).
    const charge = attack && level.smart && fighter.grounded && target.damage > 70 && Math.random() < 0.35;
    if (charge) fighter.cpuChargeMs = 250 + Math.random() * 650;
    return {
      x,
      y: aim,
      jump: climb.jump,
      attack,
      attackHeld: charge,
      special:
        ((lined || ambush) && Math.random() < level.special * 3) ||
        (close && key !== 'resorte' && key !== 'fantasma' && Math.random() < level.special) ||
        (needsRescue && Math.random() < 0.1),
      shield: false,
      transform: false,
    };
  }

  // Estrellas, láseres y bombas que pidió lanzar algún peleador este cuadro (y el teletransporte de Ninja).
  spawnProjectiles() {
    for (const fighter of this.fighters) {
      const request = fighter.projectileRequest;
      if (!request) continue;
      fighter.projectileRequest = null;
      if (request.kind === 'teleport') {
        this.teleport(fighter);
        continue;
      }
      if (request.kind === 'juggle') {
        this.throwJuggle(fighter, request);
        continue;
      }
      let sprite;
      if (request.kind === 'bomb' && !fighter.isCpu) rewards.earn('smash-bomba');
      if (request.kind === 'bomb') sprite = drawItem(this, 'bomb');
      else if (request.kind === 'laser') sprite = this.add.rectangle(request.x, request.y, 80, 12, SHOTS.laser.color).setStrokeStyle(3, 0xffffff);
      else if (request.kind === 'zap') sprite = this.add.ellipse(request.x, request.y, 54, 14, SHOTS.zap.color).setStrokeStyle(3, 0xffffff);
      else if (request.kind === 'boomerang') sprite = drawItem(this, 'boomerang').setPosition(request.x, request.y);
      else if (request.kind === 'fireball') {
        sprite = this.add.container(request.x, request.y, [
          this.add.circle(0, 0, SHOTS.fireball.radius, SHOTS.fireball.color).setStrokeStyle(3, 0xffd02a),
          this.add.circle(-3, -3, 7, 0xffe08a),
        ]);
      } else if (request.kind === 'fist') {
        sprite = this.add.container(request.x, request.y, [
          this.add.ellipse(-36 * request.dir, 0, 44, 18, 0xff9a3c),
          this.add.circle(0, 0, 24, SHOTS.fist.color).setStrokeStyle(4, 0x1b1530),
          this.add.rectangle(8 * request.dir, -8, 16, 8, 0xc8d4e8).setRounded(3),
        ]);
      }
      else if (request.kind === 'dust') {
        sprite = this.add.container(request.x, request.y, [
          this.add.circle(0, 0, 20, SHOTS.dust.color, 0.45),
          this.add.star(0, 0, 4, 5, 14, 0xffffff),
          this.add.circle(-12, 8, 4, 0xffffff),
          this.add.circle(10, -10, 3, 0xffffff),
        ]);
      } else if (request.kind === 'cannon') {
        sprite = this.add.container(request.x, request.y, [
          this.add.circle(0, 0, 18, 0x2a2a36).setStrokeStyle(3, 0xffffff),
          this.add.circle(-6, -6, 5, 0xffffff, 0.6),
        ]);
      }
      else if (request.kind === 'rainbow') {
        sprite = this.add.container(request.x, request.y, [
          this.add.rectangle(0, 0, 118, RAINBOW.length * 5 + 6, 0xffffff),
          ...RAINBOW.map((color, i) => this.add.rectangle(0, (i - (RAINBOW.length - 1) / 2) * 5, 110, 5, color)),
        ]);
      }
      else sprite = this.add.star(request.x, request.y, 5, 9, 20, SHOTS.star.color).setStrokeStyle(3, 0xffffff);
      // En súper modo los disparos salen más grandes (los de Bloquecito, según su número).
      sprite.setScale(fighter.sizeScale);
      this.world.add(sprite);
      this.projectiles.push({ ...request, sprite, owner: fighter, ageMs: 0, hits: new Set() });
    }
  }

  // Los malabares del 3 de Bloquecito: tres pelotas de colores que salen en arco, cada una con su fuerza.
  throwJuggle(fighter, request) {
    for (const t of request.throws) {
      const sprite = this.add.circle(request.x, request.y, SHOTS.juggle.radius, t.color).setStrokeStyle(3, 0xffffff);
      sprite.setScale(fighter.sizeScale);
      this.world.add(sprite);
      this.projectiles.push({ kind: 'juggle', x: request.x, y: request.y, vx: request.dir * t.vx, vy: t.vy, dir: request.dir, sprite, owner: fighter, ageMs: 0 });
    }
  }

  // Ninja: humo, y aparece detrás del rival más cercano (al lado contrario de donde mira) o un poco más adelante.
  teleport(fighter) {
    burst(this, fighter.x, fighter.y, 0x8a86b8, 10, this.world);
    const target = this.nearestRival(fighter, TELEPORT_RANGE);
    if (target) {
      const behind = -target.facing;
      fighter.x = target.x + behind * (target.radius + fighter.radius + 12);
      // Con los pies un poquito arriba de los del rival, para caer en su misma plataforma.
      fighter.y = target.y + target.radius - fighter.radius - 2;
      fighter.facing = -behind;
    } else {
      fighter.x += fighter.facing * TELEPORT_HOP;
    }
    fighter.vx = 0;
    fighter.vy = 0;
    fighter.grounded = false;
    fighter.platform = null;
    burst(this, fighter.x, fighter.y, 0x8a86b8, 10, this.world);
  }

  updateProjectiles(dtMs) {
    const dt = dtMs / 1000;
    this.projectiles = this.projectiles.filter((p) => {
      p.ageMs += dtMs;
      if (p.kind === 'boomerang') return this.updateBoomerang(p, dtMs);
      const shot = SHOTS[p.kind];
      if (shot) {
        if (shot.gravity) {
          const prevY = p.y;
          p.vy += shot.gravity * (this.stage.gravity ?? 1) * dt;
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          // Las bolas de fuego botan en las plataformas.
          const floor = shot.bounce && p.vy > 0 && this.platforms.find((pl) => p.x >= pl.left && p.x <= pl.right && prevY + shot.radius <= pl.top + 1 && p.y + shot.radius >= pl.top);
          if (floor) {
            p.y = floor.top - shot.radius;
            p.vy = -shot.bounce;
          }
        } else {
          p.x += p.dir * shot.speed * dt;
        }
        // Los que van en ondas (el polvo mágico) suben y bajan sin cambiar su altura de salida.
        const wave = shot.wave ? Math.sin(p.ageMs / 120) * shot.wave : 0;
        p.sprite.setPosition(p.x, p.y + wave);
        if (p.kind === 'star') p.sprite.setAngle(p.ageMs * 0.8);
        const victim = this.touching(p, shot.radius);
        if (victim) {
          const result = victim.takeHit({ facing: p.dir, power: p.owner.power }, shot.hit);
          // Escudo perfecto: el disparo se regresa y ahora es del que se cubrió.
          if (result.perfect) {
            this.perfectShield(victim, null, p.x, p.y);
            p.dir = -p.dir;
            if (typeof p.vx === 'number') p.vx = -p.vx;
            p.owner = victim;
            p.ageMs = 0;
            return true;
          }
          p.owner.dealtDamage(result.dealt);
          this.noteHit(p.owner, victim, result.dealt, result.speed);
          burst(this, p.x, p.y, result.blocked ? 0x7fdcff : shot.color, 6, this.world);
          if (!result.blocked) sfx.hit(0.2);
        }
        if (this.targets.length) this.hitTargets(p.x, p.y, shot.radius, p.owner);
        // Los disparos también le pegan a la bola súper.
        const ball = this.superBall.active && Math.hypot(this.superBall.x - p.x, this.superBall.y - p.y) < this.superBall.radius + shot.radius;
        if (ball && this.superBall.hit(p.owner)) p.owner.finalReady = true;
        if (victim || ball || p.ageMs > shot.lifeMs) {
          p.sprite.destroy();
          return false;
        }
        return true;
      }

      // Bomba: vuela en arco y explota al tocar a alguien, al caer en una plataforma o al acabarse la mecha.
      const prevY = p.y;
      p.vy += BOMB.gravity * (this.stage.gravity ?? 1) * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.sprite.setPosition(p.x, p.y).setAngle(p.ageMs * 0.5);
      const landed = p.vy > 0 && this.platforms.some((pl) => p.x >= pl.left && p.x <= pl.right && prevY + 18 <= pl.top && p.y + 18 >= pl.top);
      if (this.touching(p, 18) || landed || p.ageMs > BOMB.fuseMs) {
        this.explode(p);
        p.sprite.destroy();
        return false;
      }
      if (p.y > this.stage.blast.bottom) {
        p.sprite.destroy();
        return false;
      }
      return true;
    });
  }

  // El bumerán: sale, se va frenando y regresa a la mano del que lo aventó (siguiéndolo); pega de ida y de vuelta.
  updateBoomerang(p, dtMs) {
    const dt = dtMs / 1000;
    const owner = p.owner;
    p.vx -= p.dir * BOOMERANG.pull * dt;
    p.x += p.vx * dt;
    const back = Math.sign(p.vx) === -p.dir;
    if (back && !p.turned) {
      p.turned = true;
      p.hits.clear();
    }
    if (back && owner.isAlive()) p.y += (owner.y - p.y) * Math.min(1, 5 * dt);
    p.sprite.setPosition(p.x, p.y).setAngle(p.ageMs * 1.4);
    for (const f of this.fighters) {
      if (f.team === owner.team || p.hits.has(f) || !f.isAlive() || f.isInvulnerable() || f.distanceTo(p.x, p.y) > f.radius + BOOMERANG.radius) continue;
      p.hits.add(f);
      const result = f.takeHit({ facing: Math.sign(p.vx) || p.dir, power: owner.power }, BOOMERANG.hit);
      owner.dealtDamage(result.dealt);
      this.noteHit(owner, f, result.dealt, result.speed);
      burst(this, p.x, p.y, result.blocked ? 0x7fdcff : 0xc98b4f, 6, this.world);
      if (!result.blocked) sfx.hit(0.3);
    }
    if (this.targets.length) this.hitTargets(p.x, p.y, BOOMERANG.radius, owner);
    const caught = back && owner.isAlive() && owner.distanceTo(p.x, p.y) < owner.radius + 26;
    if (!caught && p.ageMs < BOOMERANG.lifeMs) return true;
    // Lo atrapó: lo puede volver a aventar (si le quedan); si no regresó, se perdió.
    const held = owner.held?.type === 'boomerang' ? owner.held : null;
    if (held) {
      held.out = false;
      if (!caught || held.uses <= 0) owner.held = null;
    }
    if (caught) sfx.select();
    p.sprite.destroy();
    return false;
  }

  // Primer peleador (que no sea del equipo del que lo lanzó) que toca el proyectil.
  touching(p, radius) {
    return this.fighters.find(
      (f) => f.team !== p.owner.team && f.isAlive() && !f.isInvulnerable() && f.distanceTo(p.x, p.y) < f.radius + radius,
    );
  }

  explode(bomb) {
    burst(this, bomb.x, bomb.y, 0xff9a3c, 18, this.world);
    burst(this, bomb.x, bomb.y, 0xffffff, 10, this.world);
    popText(this, bomb.x, bomb.y - 30, '¡BUM!', '#ff9a3c', this.world);
    this.cameras.main.shake(180, 0.008);
    sfx.boom();
    for (const f of this.fighters) {
      if (f.team === bomb.owner.team || !f.isAlive() || f.isInvulnerable()) continue;
      if (f.distanceTo(bomb.x, bomb.y) > BOMB.blast + f.radius) continue;
      const { dealt, speed } = f.takeHit({ facing: Math.sign(f.x - bomb.x) || 1, power: 1 }, BOMB.hit);
      bomb.owner.dealtDamage(dealt);
      this.noteHit(bomb.owner, f, dealt, speed);
    }
  }

  resolveHits() {
    for (const attacker of this.fighters) {
      const box = attacker.hitbox();
      if (!box) continue;
      // La bola súper: varios golpes la rompen.
      if (this.targets.length) this.hitTargets(box.x, box.y, box.radius, attacker);
      const ball = this.superBall;
      if (ball.active && !attacker.attack.hit.has(ball) && Math.hypot(ball.x - box.x, ball.y - box.y) < box.radius + ball.radius) {
        attacker.attack.hit.add(ball);
        if (ball.hit(attacker)) attacker.finalReady = true;
      }
      for (const victim of this.fighters) {
        if (victim.team === attacker.team || !victim.isAlive() || victim.isInvulnerable() || attacker.attack.hit.has(victim)) continue;
        if (victim.distanceTo(box.x, box.y, box.tall) > box.radius + victim.radius) continue;
        attacker.attack.hit.add(victim);
        // El agarre no pega: lo detiene (aunque se esté cubriendo) y después lo avienta.
        if (box.data.grab) {
          if (!victim.grounded || victim.heldBy || victim.hanging) continue;
          attacker.startHold(victim);
          popText(this, victim.x, victim.y - 60, '¡Agarrado!', '#ff9a3c', this.world);
          sfx.block();
          break;
        }
        const { blocked, perfect, speed, dealt } = victim.takeHit(attacker, box.data);
        attacker.dealtDamage(dealt);
        // Escudo perfecto: el que pegó se queda mareado (y ya no sigue pegando).
        if (perfect) {
          this.perfectShield(victim, attacker, box.x, box.y);
          break;
        }
        if (blocked) {
          spark(this, box.x, box.y, 0x7fdcff, this.world);
          continue;
        }
        this.noteHit(attacker, victim, dealt, speed);
        spark(this, box.x, box.y, 0xffffff, this.world);
        burst(this, box.x, box.y, 0xffffff, 6, this.world);
        const strong = speed > STRONG_HIT_SPEED;
        // Golpe cargado al máximo: letrero especial, calcomanía y el narrador.
        const charged = (box.data.charged ?? 0) >= 0.95;
        if (charged) {
          if (!attacker.isCpu) rewards.earn('smash-cargado');
          this.talk.charged(attacker);
        }
        const word = attacker.attack?.type === 'bat' ? '¡JONRÓN!' : charged ? '¡SÚPER GOLPE!' : HIT_WORDS[Math.floor(Math.random() * HIT_WORDS.length)];
        comicHit(this, box.x, box.y - 50, word, { big: strong || charged, red: strong, layer: this.world });
        // El golpe "se siente": se congela un instante (más en los fuertes).
        setTimeScale(0, strong || charged ? 120 : 45);
        if (strong) {
          this.cameras.main.shake(120, 0.006);
          shockwave(this, box.x, box.y, attacker.color, this.world);
        }
        sfx.hit(Math.min(1, speed / 1500));
      }
    }
  }

  // Lleva la cuenta para los resultados y para saber de quién es el KO.
  noteHit(attacker, victim, dealt, speed = 0) {
    if (!dealt) return;
    const credit = attacker.helperOf ?? attacker;
    credit.record.dealt += dealt;
    credit.record.hits += 1;
    credit.record.best = Math.max(credit.record.best, speed);
    victim.lastHitBy = credit;
    victim.lastHitAt = this.time.now;
    if (victim.isBoss) this.lastBossHitAt = this.time.now;
    // Monedas: cada golpe saca monedas del que lo recibió. Bomba caliente: el que la trae se la pasa al que le pegó.
    this.coins?.fromHit(victim.x, victim.y - victim.radius, dealt);
    this.hotBomb?.onHit(credit, victim);
    this.talk?.hit(credit, victim, speed);
  }

  // Escudo perfecto: destello, letrero y el que pegó (si fue con el cuerpo) se queda mareado.
  perfectShield(victim, attacker, x, y) {
    if (attacker) {
      attacker.attack = null;
      attacker.dashMs = 0;
      attacker.slideMs = 0;
      attacker.rocketMs = 0;
      attacker.stunMs = PERFECT_STUN_MS;
      attacker.vx = -attacker.facing * 220;
    }
    spark(this, x, y, 0x7fdcff, this.world);
    burst(this, victim.x, victim.y, 0xffffff, 12, this.world);
    popText(this, victim.x, victim.y - 90, '¡Perfecto!', '#7fdcff', this.world);
    sfx.sparkle();
    this.talk.perfect(victim);
    if (!victim.isCpu) rewards.earn('smash-parada');
  }

  // Alguien agarró un objeto.
  pickedUp(fighter, item) {
    (fighter.helperOf ?? fighter).record.items += 1;
    popText(this, item.x, item.y - 40, ITEM_NAMES[item.type] ?? '', '#ffffff', this.world);
    if (item.type === 'star') sfx.star();
    else sfx.pickup();
    this.talk.item(fighter, item.type);
    if (item.type === 'egg') this.spawnHelper(fighter);
    else if (item.type === 'tornado') this.tornadoes.spawn(fighter);
    else if (item.type === 'capsule') this.openCapsule(item);
  }

  // La cápsula sorpresa: casi siempre sale otro objeto (de un brinco); a veces, ¡explota!
  openCapsule(item) {
    burst(this, item.x, item.y, 0xffffff, 10, this.world);
    if (Math.random() < CAPSULE_BOOM) {
      popText(this, item.x, item.y - 80, '¡Sorpresa! 💥', '#ff9a3c', this.world);
      sfx.boom();
      this.cameras.main.shake(160, 0.007);
      for (const f of this.fighters) {
        if (!f.isAlive() || f.isInvulnerable() || f.distanceTo(item.x, item.y) > 110 + f.radius) continue;
        f.takeHit({ facing: Math.sign(f.x - item.x) || 1, power: 1, x: item.x }, CAPSULE_HIT);
      }
      return;
    }
    const type = CAPSULE_ITEMS[Math.floor(Math.random() * CAPSULE_ITEMS.length)];
    const prize = this.items.spawnAt(type, item.x, item.y - 30, -420);
    prize.waitMs = 300;
    sfx.poof();
  }

  pickCoin(fighter) {
    (fighter.helperOf ?? fighter).record.coins += 1;
    sfx.coin();
  }

  // El que tenía agarrado a alguien lo avienta (escudo + X, y luego hacia donde apunte el stick).
  throwFighter(holder, victim, hit = THROW_HIT) {
    if (!victim.isAlive()) return;
    const { dealt, speed } = victim.takeHit({ facing: holder.facing, power: holder.power, x: holder.x }, hit);
    holder.dealtDamage(dealt);
    this.noteHit(holder, victim, dealt, speed);
    comicHit(this, victim.x, victim.y - 50, '¡Lanzado!', { big: true, layer: this.world });
    this.cameras.main.shake(140, 0.007);
    sfx.throw();
    sfx.hit(0.8);
  }

  // B con la bola súper rota: el golpe final. Devuelve false si ahorita no se puede.
  startFinal(fighter) {
    if (this.phase !== 'fight') return false;
    const victims = this.fighters.filter((f) => f.team !== fighter.team && f.isAlive() && !f.isInvulnerable());
    this.final = new SmashFinal(this, fighter, victims, { ui: this.ui, world: this.world });
    this.setPhase('final');
    if (!fighter.isCpu) rewards.earn('smash-final');
    return true;
  }

  // Polvito al rodar.
  dust(x, y, dir) {
    dustPuff(this, x, y, dir, 5, this.world);
  }

  // El huevo sorpresa: sale un ayudante (un personaje al azar, controlado por la compu) que pelea de tu lado un rato.
  spawnHelper(owner) {
    const others = CHARACTER_KEYS.filter((key) => key !== owner.characterKey);
    const helper = new SmashFighter(this, this.world, {
      color: owner.color,
      label: `★ ${owner.label}`,
      character: others[Math.floor(Math.random() * others.length)],
      cpuLevel: 'normal',
      arena: { platforms: this.platforms, respawn: this.stage.respawn, gravity: this.stage.gravity },
    });
    helper.helperOf = owner;
    helper.team = owner.team;
    helper.stocks = 1;
    helper.helperMs = HELPER_MS;
    helper.spawn(owner.x - owner.facing * (owner.radius * 2 + 20), owner.y - 40, 600);
    this.fighters.push(helper);
    burst(this, owner.x, owner.y - 40, 0xffffff, 14, this.world);
    popText(this, owner.x, owner.y - 110, `¡${CHARACTERS[helper.characterKey].name} te ayuda!`, '#ffd84d', this.world);
    sfx.poof();
  }

  updateHelpers(dt) {
    for (const helper of this.fighters.filter((f) => f.helperOf)) {
      helper.helperMs -= dt;
      if (helper.helperMs > 0 && helper.isAlive() && helper.helperOf.isAlive()) continue;
      if (helper.isAlive()) burst(this, helper.x, helper.y, 0xffffff, 12, this.world);
      this.removeFighter(helper);
    }
  }

  removeFighter(fighter) {
    fighter.releaseHold();
    fighter.sprite.destroy();
    this.fighters = this.fighters.filter((f) => f !== fighter);
  }

  checkBlastZones() {
    // (En el jonrón nadie sale volando de la pantalla: abajo está el pasto.)
    if (this.jonron) return;
    const zone = this.stage.blast;
    for (const fighter of this.fighters) {
      if (!fighter.isAlive()) continue;
      const { x, y } = fighter;
      if (x > zone.left && x < zone.right && y > zone.top && y < zone.bottom) continue;
      const ex = Phaser.Math.Clamp(x, zone.left + 150, zone.right - 150);
      const ey = Phaser.Math.Clamp(y, zone.top + 150, zone.bottom - 150);
      burst(this, ex, ey, fighter.color, 16, this.world);
      popText(this, ex, ey, '¡KO!', '#ff5a5f', this.world);
      this.cameras.main.shake(200, 0.01);
      sfx.ko();
      // Al jefe no se le acaban las vidas: regresa, pero pierde vida.
      if (fighter.isBoss) {
        fighter.bossHp = Math.max(0, fighter.bossHp - this.giant.fallDamage);
        popText(this, ex, ey - 50, `-${this.giant.fallDamage}`, '#ffd84d', this.world);
        this.lastBossHitAt = this.time.now;
        fighter.spawn(this.stage.respawn.x, this.stage.respawn.y, 1200);
        continue;
      }
      // El KO es del último que le pegó (si fue hace poco).
      const by = fighter.lastHitBy;
      if (by && by !== fighter && this.time.now - fighter.lastHitAt < KO_CREDIT_MS) by.record.kos += 1;
      fighter.lastHitBy = null;
      if (fighter.helperOf) {
        this.removeFighter(fighter);
        continue;
      }
      fighter.knockOut();
      this.lastKo = { fighter, at: this.time.now };
      this.talk.ko(fighter);
      // Monedas: al caerte pierdes la mitad (salen volando desde arriba del escenario).
      if (this.coins && fighter.record.coins > 0) {
        const lost = Math.ceil(fighter.record.coins / 2);
        fighter.record.coins -= lost;
        this.coins.burst((this.main.left + this.main.right) / 2, this.main.top - 320, Math.min(lost, 20));
        popText(this, ex, ey - 50, `-${lost} 💰`, '#ffd84d', this.world);
      }
      if (fighter.stocks === 0) fighter.outAt = this.time.now;
    }
  }

  // El reloj del modo Tiempo (hacia atrás) y de Rompe los blancos (hacia adelante).
  updateClock(dt) {
    if (TIMED_MODES.includes(this.mode)) {
      const before = this.timeMs;
      this.timeMs = Math.max(0, this.timeMs - dt);
      if (before > 10000 && this.timeMs <= 10000) this.talk.line('¡Quedan 10 segundos!', { important: true });
    } else if (this.mode === 'blancos' || this.mode === 'subida') {
      this.timeMs += dt;
    }
  }

  checkWinner() {
    if (this.adventure) {
      this.checkAdventure();
      return;
    }
    if (this.jonron) {
      if (this.jonron.finished) this.nextJonronTurn();
      return;
    }
    if (TIMED_MODES.includes(this.mode)) {
      this.checkTimed();
      return;
    }
    if (this.mode === 'blancos') {
      if (this.targets.some((t) => !t.broken)) return;
      const record = targetRecords.save(this.settings.stage, this.timeMs);
      const best = targetRecords.get(this.settings.stage);
      const ranking = [...this.players].sort((a, b) => (b.record.targets ?? 0) - (a.record.targets ?? 0));
      const time = formatTime(this.timeMs);
      this.endFight(ranking, record ? `¡Récord! ${time}` : `¡Las ${TARGETS} en ${time}!`, (f) => [`🎯 rompió ${f.record.targets ?? 0}`, record ? '' : `Récord: ${formatTime(best)}`]);
      rewards.earn('smash-blancos');
      return;
    }
    if (this.boss) {
      const heroes = this.players.filter((f) => !f.isBoss);
      const won = this.boss.bossHp <= 0;
      if (!won && heroes.some((f) => f.stocks > 0)) return;
      if (won && heroes.some((f) => !f.isCpu)) rewards.earn('smash-jefe');
      const ranking = won ? [...heroes].sort((a, b) => b.record.dealt - a.record.dealt) : [this.boss, ...heroes];
      const name = this.boss.bossName;
      this.endFight(ranking, won ? `¡Le ganaron a ${name}!` : `¡Ganó ${name}!`, undefined, won ? () => this.defeatBoss() : null);
      return;
    }
    if (this.mode === 'equipos') {
      const alive = [0, 1].map((team) => this.players.some((f) => f.team === team && f.stocks > 0));
      if (alive[0] && alive[1]) return;
      const team = alive[0] ? 0 : alive[1] ? 1 : null;
      const ranking = [...this.players].sort((a, b) => (b.team === team) - (a.team === team) || b.record.kos - a.record.kos);
      this.endFight(ranking, team === null ? '¡Empate!' : `¡Ganan los ${TEAMS[team].name}!`);
      if (this.players.some((f) => f.team === team && !f.isCpu)) rewards.earn('smash-gana');
      return;
    }
    const standing = this.players.filter((fighter) => fighter.stocks > 0);
    if (standing.length > 1) return;
    const winner = standing[0];
    // Los demás, del último que quedó fuera al primero.
    const rest = this.players.filter((f) => f !== winner).sort((a, b) => (b.outAt ?? 0) - (a.outAt ?? 0));
    this.endFight(winner ? [winner, ...rest] : rest, winner ? `¡Ganó ${winner.label}!` : '¡Empate!');
    if (winner && !winner.isCpu) rewards.earn('smash-gana');
  }

  // Tiempo, Monedas y Colina: al acabarse el reloj (o al juntar 30 segundos en la colina) gana el de más puntos.
  checkTimed() {
    const score = {
      tiempo: (f) => f.record.kos - f.record.falls,
      monedas: (f) => f.record.coins,
      colina: (f) => f.record.hill,
    }[this.mode];
    const crowned = this.mode === 'colina' && this.players.some((f) => f.record.hill >= HILL_GOAL);
    if (this.timeMs > 0 && !crowned) return;
    const ranking = [...this.players].sort((a, b) => score(b) - score(a) || a.damage - b.damage);
    const tie = ranking.length > 1 && score(ranking[0]) === score(ranking[1]);
    const falls = (f) => `💥 sacó a ${f.record.kos}  ·  😵 se cayó ${f.record.falls}`;
    const describe = {
      tiempo: (f) => [`⭐ ${score(f) > 0 ? '+' : ''}${score(f)} puntos`, falls(f)],
      monedas: (f) => [`💰 ${f.record.coins} monedas`, falls(f)],
      colina: (f) => [`👑 ${Math.floor(f.record.hill)} segundos en la zona`],
    }[this.mode];
    this.endFight(ranking, tie ? '¡Empate!' : `¡Ganó ${ranking[0].label}!`, describe);
    if (!tie && !ranking[0].isCpu) rewards.earn({ tiempo: 'smash-gana', monedas: 'smash-monedas', colina: 'smash-colina' }[this.mode]);
  }

  // Aventura: ¿ya se ganó (o se perdió) el nivel?
  checkAdventure() {
    const heroes = this.players.filter((f) => !f.isCpu);
    let won = null;
    if (this.mode === 'blancos') won = this.targets.every((t) => t.broken) ? true : null;
    else if (this.mode === 'subida') won = heroes.some((f) => this.reachedGoal(f)) ? true : null;
    else if (this.boss) won = this.boss.bossHp <= 0 ? true : heroes.every((f) => f.stocks === 0) ? false : null;
    else if (this.players.filter((f) => f.isCpu).every((f) => f.stocks === 0)) won = true;
    else if (heroes.every((f) => f.stocks === 0)) won = false;
    if (won === null) return;
    const last = this.adventure.index === ADVENTURE.length - 1;
    this.adventureWon = won;
    if (won && last) rewards.earn('smash-aventura');
    const title = !won ? '¡Uy! Otra vez' : last ? '¡Terminaste la Aventura!' : '¡Nivel superado!';
    const ranking = [...heroes].sort((a, b) => b.record.dealt - a.record.dealt);
    let describe;
    if (this.mode === 'blancos') describe = (f) => [`🎯 rompió ${f.record.targets ?? 0}`, `⏱ ${formatTime(this.timeMs)}`];
    else if (this.mode === 'subida') describe = (f) => [f === this.climber ? '🚩 ¡Llegó a la bandera!' : '', `⏱ ${formatTime(this.timeMs)}`];
    this.endFight(ranking, title, describe, won && this.boss ? () => this.defeatBoss() : null);
  }

  // La torre: llegó a la plataforma de la bandera (el primero que llega es el que "subió").
  reachedGoal(fighter) {
    const reached = fighter.isAlive() && fighter.grounded && Math.abs(fighter.platform.top - this.stage.goal.y) < 1;
    if (reached) this.climber ??= fighter;
    return reached;
  }

  // Jonrón: guarda los metros del que tenía el turno y pasa al siguiente (o, si ya pegaron todos, el podio).
  nextJonronTurn() {
    const player = this.players.find((f) => !f.isDummy);
    const results = [
      ...this.jonronTurn.results,
      { label: player.label, color: player.color, characterKey: player.characterKey, deviceId: player.deviceId, meters: this.jonron.meters },
    ];
    const turn = this.jonronTurn.turn + 1;
    if (turn < players.sorted().length) {
      this.setPhase('end');
      this.scene.restart({ ...this.returnData, rematch: true, jonron: { turn, results } });
      return;
    }
    const ranking = results.map((r) => this.pastFighter(r)).sort((a, b) => b.record.meters - a.record.meters);
    const best = jonronRecord.get();
    const title = ranking.length > 1 ? `¡Ganó ${ranking[0].label}!` : `¡${ranking[0].record.meters.toFixed(1)} metros!`;
    this.endFight(ranking, title, (f) => [`📏 ${f.record.meters.toFixed(1)} m`, `Récord: ${best.toFixed(1)} m`]);
  }

  // Un peleador "de mentiritas" para el podio del jonrón (los de los turnos pasados ya no están en la escena).
  pastFighter(r) {
    return { ...r, record: { meters: r.meters }, image: Boolean(characterTexture(this, r.characterKey)), blocks: false, isCpu: false };
  }

  defeatBoss() {
    this.boss.sprite.setVisible(false);
    burst(this, this.boss.x, this.boss.y, 0xffd84d, 24, this.world);
    this.cameras.main.shake(400, 0.015);
  }

  // Se acabó la pelea. Si fue por un KO (o un golpe al jefe) de hace un instante, primero la repetición.
  // `before`: lo que pasa justo antes del podio (que el jefe desaparezca).
  endFight(ranking, title, describe = undefined, before = null) {
    const now = this.time.now;
    const ko = this.lastKo && now - this.lastKo.at < REPLAY_RECENT_MS ? this.lastKo.fighter : null;
    const bossHit = this.boss && this.boss.bossHp <= 0 && now - this.lastBossHitAt < REPLAY_RECENT_MS ? this.boss : null;
    const focus = ko ?? bossHit;
    this.pending = { ranking, title, describe, before };
    if (focus && this.replay.ready) {
      this.setPhase('replay');
      this.replay.start(this, this.ui, focus);
      this.timerText.setText('');
      this.talk.hide();
      return;
    }
    this.closeFight();
  }

  closeFight() {
    const { ranking, title, describe, before } = this.pending;
    this.pending = null;
    this.setPhase('end');
    before?.();
    this.finish(ranking, title, describe);
  }

  // Fin de la pelea: el podio con lo que hizo cada quien, los premios, confeti y el ganador festejando.
  finish(ranking, title, describe = undefined) {
    const winner = ranking[0];
    for (const fighter of this.fighters) {
      fighter.celebrating =
        fighter === winner ||
        Boolean(winner?.deviceId && fighter.deviceId === winner.deviceId) ||
        (this.mode === 'equipos' && fighter.team === winner?.team) ||
        (this.adventureWon && !fighter.isCpu);
    }
    say(title);
    this.timerText.setText('');
    this.talk.hide();
    const notes = this.jonron ? [] : awards(this.players.filter((f) => !f.isBoss && !f.isDummy));
    // (Si ganaron la Aventura, todos los del podio salen contentos.)
    this.results = showResults(this, ranking, this.ui, title, this.endHint(), describe, notes, this.adventureWon);
    if (winner) {
      confetti(this, [winner.color, 0xffffff, 0xffc93c], 80, this.ui);
      fireworks(this, [winner.color, 0xffffff, 0xffc93c], 4, this.ui);
    }
    for (const fighter of this.fighters) if (fighter.celebrating) (fighter.motion ?? fighter.look?.motion)?.dance(5000);
    sfx.win();
  }

  endHint() {
    if (this.adventure) {
      const last = this.adventure.index === ADVENTURE.length - 1;
      if (!this.adventureWon) return 'A = intentar otra vez   ·   B = salir de la Aventura';
      return last ? 'A = jugar la Aventura otra vez   ·   B = cambiar personaje' : 'A = ¡siguiente nivel!   ·   B = salir de la Aventura';
    }
    if (this.jonron) return 'A = otra ronda   ·   B = cambiar personaje   ·   Mantén LB + RB + Y = salir';
    return 'A = revancha   ·   B = cambiar personaje   ·   Mantén LB + RB + Y = salir';
  }

  updateEnd() {
    if (this.phaseMs < END_INPUT_DELAY_MS) return;
    const ids = players.sorted().map((p) => p.deviceId);
    if (ids.some((id) => controls.justPressed(id, 'a'))) this.scene.restart(this.nextRound());
    else if (ids.some((id) => controls.justPressed(id, 'b'))) go(this, 'SmashSelect', { selected: this.returnData.selected });
  }

  // Lo que sigue al apretar A en el podio: la revancha, otra ronda del jonrón (desde el primero) o, en la Aventura,
  // el siguiente nivel (o el mismo otra vez si se perdió; después del último, desde el principio).
  nextRound() {
    const data = { ...this.returnData, rematch: true, jonron: null };
    if (!this.adventure) return data;
    const { index } = this.adventure;
    const next = !this.adventureWon ? index : index === ADVENTURE.length - 1 ? 0 : index + 1;
    return { ...data, rematch: false, adventure: { index: next } };
  }

  // La cámara se aleja o se acerca para que siempre quepan todos (y el escenario principal).
  // En el jonrón sigue al saco mientras vuela; en la torre sigue a los que suben (con espacio para ver hacia arriba).
  updateCamera(dt, snap = false) {
    if (this.jonron?.following) {
      const blend = Math.min(1, 3 * (1 - Math.pow(0.02, dt)));
      this.cam.zoom += (0.7 - this.cam.zoom) * blend;
      this.cam.x += (this.bag.x - this.cam.x) * blend;
      this.cam.y += (this.bag.y - 120 - this.cam.y) * blend;
      this.cameras.main.setZoom(this.cam.zoom);
      this.cameras.main.centerOn(this.cam.x, this.cam.y);
      return;
    }
    const climbing = this.mode === 'subida';
    const points = climbing
      ? []
      : [
          { x: this.main.left + 120, y: this.main.top - 40 },
          { x: this.main.right - 120, y: this.main.top - 40 },
        ];
    for (const fighter of this.fighters) {
      if (!fighter.isAlive()) continue;
      points.push(fighter);
      if (climbing) points.push({ x: fighter.x, y: fighter.y - 260 });
    }
    if (points.length === 0) points.push(this.stage.respawn);
    // En Rompe los blancos, que se vean todas las dianas que faltan.
    for (const target of this.targets ?? []) if (!target.broken) points.push(target);
    const xs = points.map((p) => p.x);
    const ys = points.map((p) => p.y);
    const minX = Math.min(...xs) - CAMERA_MARGIN;
    const maxX = Math.max(...xs) + CAMERA_MARGIN;
    const minY = Math.min(...ys) - CAMERA_MARGIN;
    const maxY = Math.max(...ys) + CAMERA_MARGIN;
    const { width, height } = this.scale;
    const zoom = Phaser.Math.Clamp(Math.min(width / (maxX - minX), height / (maxY - minY)), ZOOM_MIN, ZOOM_MAX);
    const blend = snap ? 1 : 1 - Math.pow(0.02, dt);
    this.cam.zoom += (zoom - this.cam.zoom) * blend;
    this.cam.x += ((minX + maxX) / 2 - this.cam.x) * blend;
    this.cam.y += ((minY + maxY) / 2 - this.cam.y) * blend;
    this.cameras.main.setZoom(this.cam.zoom);
    this.cameras.main.centerOn(this.cam.x, this.cam.y);
  }

  updateHud() {
    const blink = Math.floor(this.time.now / 250) % 2 === 0;
    // El reloj (el jonrón pone el suyo).
    if (this.phase === 'fight' && !this.jonron) {
      const left = this.targets.filter((t) => !t.broken).length;
      if (TIMED_MODES.includes(this.mode)) this.timerText.setText(formatTime(this.timeMs));
      else if (this.mode === 'blancos') this.timerText.setText(`🎯 ${left}   ${formatTime(this.timeMs)}`);
      else if (this.mode === 'subida') this.timerText.setText(`🚩 ${formatTime(this.timeMs)}`);
      this.timerText.setColor(TIMED_MODES.includes(this.mode) && this.timeMs < 10000 ? '#ff5a5f' : TEXT.normal);
    }
    if (this.bossBar) this.bossBar.fill.setScale(Math.max(0, this.boss.bossHp) / this.giant.health, 1);
    for (const slot of this.hud) {
      const { fighter } = slot;
      // Barra: se llena dorada; llena, parpadea; en súper modo se va vaciando (lo que le queda).
      const full = fighter.canTransform();
      const isSuper = fighter.superMs > 0;
      slot.meter.setScale(isSuper ? fighter.superMs / SUPER_MS : fighter.meter / METER_MAX, 1);
      slot.meter.setFillStyle(isSuper ? fighter.color : full && blink ? 0xffffff : 0xffd84d);
      let meterLabel = '';
      if (isSuper) meterLabel = '¡SÚPER!';
      else if (full) meterLabel = fighter.isCpu ? '¡Llena!' : '¡LB + RB!';
      if (slot.meterText.text !== meterLabel) slot.meterText.setText(meterLabel);

      const points = fighter.record.kos - fighter.record.falls;
      const hill = Math.floor(fighter.record.hill);
      const key = `${Math.round(fighter.damage)}|${fighter.stocks}|${points}|${fighter.record.targets ?? 0}|${fighter.record.coins}|${hill}`;
      if (slot.shown === key) continue;
      slot.shown = key;
      if (this.mode === 'tiempo') slot.score.setText(`⭐ ${points > 0 ? '+' : ''}${points}`);
      else if (this.mode === 'blancos') slot.score.setText(`🎯 ${fighter.record.targets ?? 0}`);
      else if (this.mode === 'monedas') slot.score.setText(`💰 ${fighter.record.coins}`);
      else if (this.mode === 'colina') slot.score.setText(`👑 ${hill} / ${HILL_GOAL}`);
      const color = fighter.damage >= 100 ? '#ff5a5f' : fighter.damage >= 50 ? TEXT.accent : TEXT.normal;
      slot.damage.setText(fighter.stocks > 0 ? `${Math.round(fighter.damage)}%` : '—').setColor(color);
      slot.stocks.forEach((dot, k) => dot.setVisible(!fighter.infinite && k < fighter.stocks));
    }
  }

  updateExit(dt) {
    const holding = players.sorted().some((p) => controls.holdingExit(p.deviceId));
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

// 83500 ms -> "1:23"
function formatTime(ms) {
  const seconds = Math.ceil(ms / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}
