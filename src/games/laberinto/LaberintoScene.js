import Phaser from 'phaser';
import { controls } from '../../shared/controls.js';
import { frameDelta, realDelta, setTimeScale } from '../../shared/clock.js';
import { music } from '../../shared/music.js';
import { characterPicks } from '../../shared/picks.js';
import { players } from '../../shared/players.js';
import { rewards } from '../../shared/rewards.js';
import { settings } from '../../shared/settings.js';
import { sfx } from '../../shared/sound.js';
import { go } from '../../shared/transition.js';
import { say } from '../../shared/voice.js';
import { defaultCharacter } from '../../scenes/CharacterSelectScene.js';
import { Blob } from '../../ui/Blob.js';
import { CharacterLook } from '../../ui/CharacterLook.js';
import { bounceIn, bump } from '../../ui/bounce.js';
import { COLORS, TEXT, hexToCss, textStyle } from '../../ui/style.js';
import { burst, confetti, fireworks, popText, sparkles } from '../brawl/effects.js';
import { loadSmashArt } from '../smash/art.js';
import { labBackground, labGhost, labObject, loadLaberintoArt } from './art.js';
import { GHOSTS, GHOST_TEXTURE, chooseDir, ghostTarget, ghostTextures } from './ghosts.js';
import { MAZES, MAZE_KEYS, THEMES, inTunnel, isHouse, isWall, parseMaze, tileAt } from './mazes.js';
import { STOP, centerBehind, isStopped, sameDir, step } from './movement.js';
import { labSfx } from './sounds.js';

// "Laberinto come-frutas": como el clásico de los fantasmitas, pero en equipo (1 a 4 a la vez, cada quien con su
// personaje y un aro de su color). Entre todos se comen todas las bolitas del laberinto para pasar de nivel; con una
// fruta de poder los fantasmitas se asustan (azules) y se los pueden comer: regresan a su casita como ojitos.
// Vidas compartidas: al que atrapan regresa en una burbuja a su lugar; si ya no hay vidas, se queda fuera hasta el
// siguiente nivel (si quedan todos fuera, se acaba). Modo peque (cada quien el suyo, con Y antes de jugar): con él los
// fantasmitas van más despacio y rebotan en vez de atraparlo.
// Recorrido: los 4 laberintos (Jardín, Dulcelandia, Espacio y Casa embrujada); o uno solo, cada vez más rápido.
// Competencia: lo mismo, pero gana el que coma más.
const DEPTH = { background: -20, floor: -10, walls: 0, dots: 2, fruit: 4, ghosts: 10, players: 12, bubbles: 14, hud: 100, banner: 150, screen: 200 };
const AREA = { x: 10, y: 66, w: 1260, h: 616 };
const DIFFICULTY = {
  facil: { name: 'Fácil', ghost: 3.6, scaredMs: 9000, release: [0, 2500, 7000, 12000], scatterMs: 9000, chaseMs: 16000 },
  normal: { name: 'Normal', ghost: 4.3, scaredMs: 7000, release: [0, 1500, 5000, 9000], scatterMs: 7000, chaseMs: 20000 },
  dificil: { name: 'Difícil', ghost: 4.9, scaredMs: 5000, release: [0, 800, 3000, 6000], scatterMs: 5000, chaseMs: 24000 },
};
const DIFFICULTY_KEYS = Object.keys(DIFFICULTY);
const MODES = { equipo: 'En equipo', competencia: 'Competencia (quién come más)' };
const MAZE_CHOICES = ['recorrido', ...MAZE_KEYS];
// Velocidades en casillas por segundo.
const PLAYER_SPEED = 5;
const PLAYER_SPEED_MAX = 5.8;
const SCARED_SPEED = 2.6;
const TUNNEL_SPEED = 2.4;
const EYES_SPEED = 10;
const HOUSE_SPEED = 2.4;
// Cada nivel los fantasmitas van más rápido (hasta este tanto más).
const LEVEL_GHOST_STEP = 0.18;
const LEVEL_GHOST_MAX = 1.2;
const PEQUE_SLOW = 0.75;
// Qué tan cerca (en casillas) un fantasmita alcanza a alguien.
const CATCH_DIST = 0.6;
// Dar vuelta aunque ya se haya pasado tantito de la esquina.
const TURN_GRACE = 0.3;
const BUBBLE_MS = 2200;
const SAFE_MS = 2000;
const BOUNCE_MS = 1200;
const FLASH_MS = 2000;
const MIN_SCARED_MS = 2500;
const FRUIT_MS = 10000;
// La fruta bonus sale al comerse este tanto de las bolitas.
const FRUIT_AT = [0.3, 0.7];
const FRUITS = [
  { key: 'cereza', emoji: '🍒', points: 100 },
  { key: 'fresa', emoji: '🍓', points: 300 },
  { key: 'naranja', emoji: '🍊', points: 500 },
  { key: 'manzana', emoji: '🍎', points: 700 },
  { key: 'sandia', emoji: '🍉', points: 1000 },
  { key: 'uvas', emoji: '🍇', points: 2000 },
  { key: 'platano', emoji: '🍌', points: 3000 },
  { key: 'pina', emoji: '🍍', points: 5000 },
];
const DOT_POINTS = 10;
const POWER_POINTS = 50;
const GHOST_POINTS = [200, 400, 800, 1600];
const EXTRA_LIFE_AT = 10000;
const INTRO_MS = 2600;
const CLEAR_MS = 2400;
const GAME_OVER_MS = 1400;
const INPUT_DELAY_MS = 900;
const EXIT_HOLD_MS = 1200;
const WAKA_GAP_MS = 80;
// En competencia con un solo laberinto, cuántos niveles se juegan.
const CONTEST_LEVELS = 3;
const RECORD_KEY = 'laberintoRecord';
const SETUP_ROWS = 3;
const lastSetup = { mode: 'equipo', maze: 'recorrido', difficulty: 'facil' };
// El modo peque de cada quien (por control), mientras la página esté abierta.
const pequeByDevice = new Map();

const wrapDistance = (a, b, width) => {
  const dx = Math.abs(a.x - b.x);
  return Math.hypot(Math.min(dx, width - dx), a.y - b.y);
};

export class LaberintoScene extends Phaser.Scene {
  constructor() {
    super('Laberinto');
  }

  init(data) {
    this.returnData = data ?? {};
    this.exitMs = 0;
    this.exiting = false;
  }

  preload() {
    loadSmashArt(this);
    loadLaberintoArt(this);
  }

  create() {
    const { width, height } = this.scale;
    this.backdrop = this.add
      .rectangle(0, 0, width, height, 0x14112b)
      .setOrigin(0)
      .setDepth(DEPTH.background - 1);
    this.setup = { ...lastSetup };
    this.humans = players.sorted();
    this.eaters = this.humans.map((player) => ({
      player,
      deviceId: player.deviceId,
      label: `J${player.slot + 1}`,
      color: players.color(player).hex,
      character: characterPicks.get(player.deviceId, defaultCharacter(player)),
      points: 0,
      ghosts: 0,
      fruits: 0,
    }));
    this.level = 0;
    this.layer = null;
    this.screen = null;
    this.banner = null;
    this.dots = new Map();
    this.ghosts = [];
    this.makeTextures();
    this.makeHud();
    this.events.once('shutdown', () => {
      music.setTempo(1);
      if (this.mazeTexture && this.textures.exists(this.mazeTexture)) this.textures.remove(this.mazeTexture);
      this.mazeTexture = null;
    });
    this.showSetup();
  }

  // ---------- Dibujos hechos con código (si no hay de Gemini) ----------
  makeTextures() {
    ghostTextures(this);
    const g = this.make.graphics({ x: 0, y: 0 }, false);
    const make = (key, size, draw) => {
      if (this.textures.exists(key)) return;
      g.clear();
      draw();
      g.generateTexture(key, size, size);
    };
    // Las bolitas de cada tema: moras, dulces, estrellitas y dulces de maíz.
    make('lab:dot-jardin', 16, () => {
      g.fillStyle(0xffe066, 1);
      g.fillCircle(8, 8, 5);
      g.fillStyle(0xffffff, 0.8);
      g.fillCircle(6, 6, 1.6);
    });
    make('lab:dot-dulces', 16, () => {
      g.fillStyle(0xff4fa3, 1);
      g.fillCircle(8, 8, 5.5);
      g.lineStyle(2, 0xffffff, 1);
      g.beginPath();
      g.arc(8, 8, 3, 0, Math.PI * 1.4, false);
      g.strokePath();
    });
    make('lab:dot-espacio', 16, () => {
      g.fillStyle(0xfff3a0, 1);
      const points = [];
      for (let i = 0; i < 10; i += 1) {
        const r = i % 2 ? 2.6 : 6.5;
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        points.push({ x: 8 + Math.cos(a) * r, y: 8 + Math.sin(a) * r });
      }
      g.fillPoints(points, true);
    });
    make('lab:dot-embrujada', 16, () => {
      g.fillStyle(0xffffff, 1);
      g.fillTriangle(3, 4, 13, 4, 8, 14);
      g.fillStyle(0xff9a3c, 1);
      g.fillTriangle(4.4, 6, 11.6, 6, 8, 12.2);
      g.fillStyle(0xffe066, 1);
      g.fillTriangle(6.2, 9.4, 9.8, 9.4, 8, 13);
    });
    // La fruta de poder: una fresa dorada con hojitas.
    make('lab:power', 48, () => {
      const berry = (inflate, color) => {
        g.fillStyle(color, 1);
        g.fillCircle(17, 21, 9 + inflate);
        g.fillCircle(31, 21, 9 + inflate);
        g.fillTriangle(8 - inflate, 22, 40 + inflate, 22, 24, 44 + inflate);
      };
      berry(2.5, COLORS.ink);
      berry(0, 0xffd23c);
      g.fillStyle(0xfff3b0, 0.9);
      g.fillCircle(15, 18, 3);
      g.fillStyle(0xc98a00, 1);
      for (const [x, y] of [
        [20, 26],
        [28, 26],
        [24, 32],
        [16, 22],
        [32, 22],
        [24, 38],
        [24, 20],
      ])
        g.fillCircle(x, y, 1.4);
      g.fillStyle(0x3fbf5a, 1);
      g.fillTriangle(24, 14, 14, 9, 20, 16);
      g.fillTriangle(24, 14, 34, 9, 28, 16);
      g.fillTriangle(24, 14, 21, 5, 27, 5);
    });
    g.destroy();
  }

  // ---------- Lo de arriba: el laberinto y el nivel, las vidas, el récord y los puntos de cada quien ----------
  makeHud() {
    const { width, height } = this.scale;
    const style = (size, color) => textStyle(size, color, { fontStyle: 'bold', stroke: '#1b1530', strokeThickness: 5 });
    this.hudTitle = this.add
      .text(width / 2, 20, '', style(26, TEXT.normal))
      .setOrigin(0.5)
      .setDepth(DEPTH.hud);
    this.hudLives = this.add.text(24, 20, '', style(24, TEXT.normal)).setOrigin(0, 0.5).setDepth(DEPTH.hud);
    this.hudRecord = this.add
      .text(width - 24, 20, '', style(22, TEXT.accent))
      .setOrigin(1, 0.5)
      .setDepth(DEPTH.hud);
    this.hudPlayers = this.eaters.map((eater) =>
      this.add
        .text(0, 50, '', style(22, hexToCss(eater.color)))
        .setOrigin(0.5)
        .setDepth(DEPTH.hud),
    );
    this.help = this.add
      .text(width / 2, height - 18, '', textStyle(16, TEXT.muted, { stroke: '#1b1530', strokeThickness: 3 }))
      .setOrigin(0.5)
      .setDepth(DEPTH.hud);
    this.hudItems = [this.hudTitle, this.hudLives, this.hudRecord, ...this.hudPlayers];
    this.setHudVisible(false);
  }

  setHudVisible(visible) {
    for (const item of this.hudItems) item.setVisible(visible);
  }

  refreshHud() {
    const theme = THEMES[this.mazeKey];
    this.hudTitle.setText(`${theme.emoji} ${theme.name} · Nivel ${this.level}`);
    this.hudLives.setText(`❤️ ${this.lives}`);
    this.hudRecord.setText(`🏆 Récord ${this.record}`);
    const gap = 170;
    this.hudPlayers.forEach((text, i) => {
      const eater = this.eaters[i];
      const extra = eater.state === 'out' ? ' 💤' : eater.peque ? ' 👶' : '';
      text.setText(`${eater.label} ${eater.points}${extra}`);
      text.setX(this.scale.width / 2 + (i - (this.eaters.length - 1) / 2) * gap);
    });
  }

  // ---------- Antes de jugar: modo, laberinto, dificultad y el modo peque de cada quien ----------
  showSetup() {
    this.phase = 'setup';
    this.phaseMs = 0;
    this.clearLevel();
    this.setHudVisible(false);
    this.screen?.destroy();
    const { width, height } = this.scale;
    this.screen = this.add.container(0, 0).setDepth(DEPTH.screen);
    this.screen.add(this.add.rectangle(width / 2, height / 2, width, height, 0x14112b, 0.92));
    this.screen.add(this.add.text(width / 2, 110, '🍒 Laberinto come-frutas', textStyle(54, TEXT.normal, { fontStyle: 'bold' })).setOrigin(0.5));
    this.setupRow = this.eaters.length > 1 ? 0 : 1;
    this.setupTexts = Array.from({ length: SETUP_ROWS }, (_, i) => {
      const bg = this.add.rectangle(width / 2, 230 + i * 70, 760, 56, COLORS.panel).setRounded(16);
      const text = this.add.text(width / 2, 230 + i * 70, '', textStyle(26, TEXT.normal, { fontStyle: 'bold' })).setOrigin(0.5);
      this.screen.add([bg, text]);
      return { bg, text };
    });
    this.screen.add(this.add.text(width / 2, 455, 'Juegan:', textStyle(24, TEXT.normal)).setOrigin(0.5));
    this.setupPlayers = this.eaters.map((eater, i) => {
      const text = this.add
        .text(
          width / 2 + (i - (this.eaters.length - 1) / 2) * 190,
          500,
          '',
          textStyle(28, hexToCss(eater.color), { fontStyle: 'bold', stroke: '#1b1530', strokeThickness: 5 }),
        )
        .setOrigin(0.5);
      this.screen.add(text);
      return text;
    });
    this.screen.add(
      this.add.text(width / 2, 548, 'Y = modo peque (cada quien el suyo: los fantasmitas no lo atrapan)', textStyle(20, TEXT.muted)).setOrigin(0.5),
    );
    this.screen.add(this.add.text(width / 2, 630, '↑ ↓ elegir  ·  ◀ ▶ cambiar  ·  A = ¡a jugar!  ·  B = regresar', textStyle(22, TEXT.accent)).setOrigin(0.5));
    this.refreshSetup();
    say('Laberinto come-frutas');
  }

  refreshSetup() {
    const solo = this.eaters.length < 2;
    const mazeName = this.setup.maze === 'recorrido' ? 'Recorrido (los 4)' : `${THEMES[this.setup.maze].emoji} ${THEMES[this.setup.maze].name}`;
    const labels = [`Modo: ${solo ? 'Solo' : MODES[this.setup.mode]}`, `Laberinto: ${mazeName}`, `Dificultad: ${DIFFICULTY[this.setup.difficulty].name}`];
    this.setupTexts.forEach(({ bg, text }, i) => {
      const enabled = i > 0 || !solo;
      text.setText(labels[i]).setAlpha(enabled ? 1 : 0.45);
      bg.setStrokeStyle(i === this.setupRow ? 4 : 2, i === this.setupRow ? COLORS.accent : COLORS.panelBorder);
    });
    this.setupPlayers.forEach((text, i) => {
      const eater = this.eaters[i];
      text.setText(`${eater.label}${pequeByDevice.get(eater.deviceId) ? ' 👶 peque' : ''}`);
    });
  }

  updateSetup() {
    for (const eater of this.eaters) {
      if (!controls.justPressed(eater.deviceId, 'y')) continue;
      const peque = !pequeByDevice.get(eater.deviceId);
      pequeByDevice.set(eater.deviceId, peque);
      sfx.select();
      say(peque ? `${eater.label}: modo peque` : `${eater.label}: modo normal`);
      this.refreshSetup();
    }
    const host = players.host();
    if (!host) return;
    const id = host.deviceId;
    const firstRow = this.eaters.length > 1 ? 0 : 1;
    const rowStep = controls.justPressed(id, 'down') ? 1 : controls.justPressed(id, 'up') ? -1 : 0;
    if (rowStep) {
      this.setupRow += rowStep;
      if (this.setupRow < firstRow) this.setupRow = SETUP_ROWS - 1;
      if (this.setupRow >= SETUP_ROWS) this.setupRow = firstRow;
      sfx.select();
      this.refreshSetup();
    }
    const change = controls.justPressed(id, 'right') ? 1 : controls.justPressed(id, 'left') ? -1 : 0;
    if (change) {
      const cycle = (list, value) => list[(list.indexOf(value) + change + list.length) % list.length];
      if (this.setupRow === 0) this.setup.mode = cycle(Object.keys(MODES), this.setup.mode);
      else if (this.setupRow === 1) this.setup.maze = cycle(MAZE_CHOICES, this.setup.maze);
      else this.setup.difficulty = cycle(DIFFICULTY_KEYS, this.setup.difficulty);
      sfx.select();
      this.refreshSetup();
    }
    if (this.phaseMs < 300) return;
    if (controls.justPressed(id, 'a')) {
      sfx.confirm();
      Object.assign(lastSetup, this.setup);
      this.screen.destroy();
      this.screen = null;
      this.startGame();
    } else if (controls.justPressed(id, 'b')) {
      this.exit();
    }
  }

  // ---------- La partida ----------
  get contest() {
    return this.setup.mode === 'competencia' && this.eaters.length > 1;
  }

  // Cuántos niveles tiene la partida (Infinity: hasta que se acaben las vidas).
  get levelCount() {
    if (this.setup.maze === 'recorrido') return MAZE_KEYS.length;
    return this.contest ? CONTEST_LEVELS : Infinity;
  }

  get teamPoints() {
    return this.eaters.reduce((sum, eater) => sum + eater.points, 0);
  }

  startGame() {
    this.difficulty = DIFFICULTY[this.setup.difficulty];
    this.level = 1;
    this.lives = 2 + this.eaters.length;
    this.extraLife = false;
    this.record = settings.get(RECORD_KEY, 0);
    for (const eater of this.eaters) {
      Object.assign(eater, { points: 0, ghosts: 0, fruits: 0, peque: Boolean(pequeByDevice.get(eater.deviceId)) });
    }
    this.help.setText('Stick o cruceta = caminar  ·  Cómanse todas las bolitas  ·  Mantén LB + RB + Y = salir');
    this.startLevel();
  }

  startLevel() {
    this.clearLevel();
    this.mazeKey = this.setup.maze === 'recorrido' ? MAZE_KEYS[(this.level - 1) % MAZE_KEYS.length] : this.setup.maze;
    this.maze = parseMaze(MAZES[this.mazeKey]);
    const maze = this.maze;
    this.tile = Math.floor(Math.min(AREA.w / maze.width, AREA.h / maze.height));
    this.origin = { x: Math.round((this.scale.width - maze.width * this.tile) / 2), y: Math.round(AREA.y + (AREA.h - maze.height * this.tile) / 2) };
    this.layer = this.add.container(0, 0);
    this.drawMaze();
    this.placeDots();
    this.dotsTotal = this.dots.size;
    this.dotsEaten = 0;
    this.fruit = null;
    this.fruitsShown = 0;
    this.scaredMs = 0;
    this.combo = 0;
    this.modeIndex = 0;
    this.modeMs = 0;
    this.resetGhostsOnReturn = false;
    this.wakaMs = 0;
    this.wakaHigh = false;
    this.eaters.forEach((eater, i) => {
      const start = maze.starts[i % maze.starts.length];
      Object.assign(eater, { home: start, x: start.x, y: start.y, dir: STOP, want: null, facing: start.x < maze.width / 2 ? 1 : -1, state: 'play', safeMs: 0 });
      this.makeEater(eater);
    });
    this.makeGhosts();
    this.setHudVisible(true);
    this.refreshHud();
    this.phase = 'intro';
    this.phaseMs = 0;
    this.introStep = 0;
    music.setTempo(1);
    this.syncSprites();
  }

  // Borra todo lo del nivel (el laberinto, las bolitas, los jugadores y los fantasmitas).
  clearLevel() {
    this.layer?.each((child) => this.tweens.killTweensOf(child));
    this.layer?.destroy();
    this.layer = null;
    this.walls = null;
    // (La textura del laberinto se suelta: en el Xbox la memoria es poca.)
    if (this.mazeTexture && this.textures.exists(this.mazeTexture)) this.textures.remove(this.mazeTexture);
    this.mazeTexture = null;
    this.background?.destroy();
    this.background = null;
    for (const dot of this.dots.values()) this.tweens.killTweensOf(dot.power ? dot.sprite.list : dot.sprite);
    this.dots.clear();
    if (this.fruit) this.tweens.killTweensOf(this.fruit.sprite);
    this.fruit?.sprite.destroy();
    this.fruit = null;
    for (const eater of this.eaters ?? []) {
      eater.blob?.destroy();
      eater.blob = null;
      eater.bubble?.destroy();
      eater.bubble = null;
    }
    for (const ghost of this.ghosts) ghost.sprite.destroy();
    this.ghosts = [];
    this.banner?.destroy();
    this.banner = null;
  }

  // El centro de una casilla en la pantalla.
  toScreen(x, y) {
    return { x: this.origin.x + (x + 0.5) * this.tile, y: this.origin.y + (y + 0.5) * this.tile };
  }

  // ---------- El laberinto: piso, paredes de "plastilina" (se juntan entre ellas) con adornos, y la casita ----------
  // Se pinta una sola vez en una textura (redibujar miles de figuras en cada cuadro es mucho para el Xbox).
  drawMaze() {
    const maze = this.maze;
    const theme = THEMES[this.mazeKey];
    const T = this.tile;
    const { x: ox, y: oy } = this.origin;
    this.backdrop.setFillStyle(theme.edge);
    const art = labBackground(this, this.mazeKey, (key) => this.addBackground(this.mazeKey, key));
    if (art) this.addBackground(this.mazeKey, art);
    this.layer.add(this.add.rectangle(ox, oy, maze.width * T, maze.height * T, theme.floor, art ? 0.82 : 1).setOrigin(0));
    this.mazeTexture = `lab:maze-${this.mazeKey}`;
    if (!this.textures.exists(this.mazeTexture)) this.paintMaze(this.mazeTexture);
    this.walls = this.add.image(ox, oy, this.mazeTexture).setOrigin(0);
    this.layer.add(this.walls);
  }

  paintMaze(key) {
    const maze = this.maze;
    const theme = THEMES[this.mazeKey];
    const T = this.tile;
    const g = this.make.graphics({ x: 0, y: 0 }, false);
    // Puntitos en el piso (estrellas en el espacio), siempre en el mismo lugar.
    const rnd = new Phaser.Math.RandomDataGenerator([this.mazeKey]);
    for (let i = 0; i < 90; i += 1) {
      g.fillStyle(0xffffff, rnd.realInRange(0.04, this.mazeKey === 'espacio' ? 0.35 : 0.08));
      g.fillCircle(rnd.between(0, maze.width * T), rnd.between(0, maze.height * T), rnd.realInRange(1, 2.4));
    }
    // La casita de los fantasmitas, un poco más clara.
    g.fillStyle(0xffffff, 0.06);
    maze.rows.forEach((row, y) => [...row].forEach((ch, x) => ch === 'G' && g.fillRect(x * T, y * T, T, T)));
    const wall = (x, y) => x >= 0 && x < maze.width && y >= 0 && y < maze.height && isWall(maze.rows[y][x]);
    const pass = (color, inset, radius) => {
      g.fillStyle(color, 1);
      for (let y = 0; y < maze.height; y += 1) {
        for (let x = 0; x < maze.width; x += 1) {
          if (!wall(x, y)) continue;
          const sx = x * T;
          const sy = y * T;
          g.fillRoundedRect(sx + inset, sy + inset, T - inset * 2, T - inset * 2, radius);
          if (wall(x + 1, y)) g.fillRect(sx + T / 2, sy + inset, T, T - inset * 2);
          if (wall(x, y + 1)) g.fillRect(sx + inset, sy + T / 2, T - inset * 2, T);
          if (wall(x + 1, y) && wall(x, y + 1) && wall(x + 1, y + 1)) g.fillRect(sx + T / 2, sy + T / 2, T, T);
        }
      }
    };
    pass(theme.edge, 3, 12);
    pass(theme.shine, 6, 9);
    pass(theme.wall, 8, 8);
    // Adornos en las paredes: florecitas, chispitas de dulce, estrellitas o calabacitas.
    for (let y = 0; y < maze.height; y += 1) {
      for (let x = 0; x < maze.width; x += 1) {
        if (!wall(x, y) || rnd.frac() > 0.45) continue;
        g.fillStyle(rnd.pick(theme.sprinkles), 0.85);
        g.fillCircle(x * T + rnd.between(11, T - 11), y * T + rnd.between(11, T - 11), rnd.realInRange(1.6, 2.8));
      }
    }
    // La puerta de la casita: una barrita rosa.
    if (maze.door) {
      g.fillStyle(0xffb3e6, 1);
      g.fillRoundedRect(maze.door.x * T - T * 0.1, maze.door.y * T + T / 2 - 4, T * 1.2, 8, 4);
    }
    g.generateTexture(key, maze.width * T, maze.height * T);
    g.destroy();
  }

  // Nivel completo: las paredes prenden y apagan en blanco.
  flashWalls(on) {
    if (!this.walls) return;
    if (on) this.walls.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
    else this.walls.clearTint().setTintMode(Phaser.TintModes.MULTIPLY);
  }

  // El fondo del tema (de Gemini), detrás del laberinto: se asoma por las orillas y tantito por el piso.
  addBackground(mazeKey, key) {
    if (mazeKey !== this.mazeKey || !this.layer || this.background) return;
    const { width, height } = this.scale;
    this.background = this.add.image(width / 2, height / 2, key).setDepth(DEPTH.background);
    this.background.setScale(Math.max(width / this.background.width, height / this.background.height));
  }

  // Las bolitas y las frutas de poder (que brincan y brillan).
  placeDots() {
    const maze = this.maze;
    const T = this.tile;
    const texture = `lab:dot-${this.mazeKey}`;
    for (const { x, y } of maze.dots) {
      const at = this.toScreen(x, y);
      const sprite = this.add
        .image(at.x, at.y, texture)
        .setDepth(DEPTH.dots)
        .setScale(T / 40);
      this.layer.add(sprite);
      this.dots.set(`${x},${y}`, { x, y, power: false, sprite });
    }
    const art = labObject(this, 'fresa-dorada') ?? 'lab:power';
    for (const { x, y } of maze.powers) {
      const at = this.toScreen(x, y);
      const glow = this.add.circle(0, 0, T * 0.5, 0xfff3a0, 0.25);
      const fruit = this.add.image(0, 0, art);
      fruit.setScale((T * 0.9) / Math.max(fruit.width, fruit.height));
      const sprite = this.add.container(at.x, at.y, [glow, fruit]).setDepth(DEPTH.dots);
      this.layer.add(sprite);
      this.tweens.add({ targets: fruit, scale: fruit.scale * 1.18, duration: 420, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      this.tweens.add({ targets: glow, alpha: 0.6, scale: 1.25, duration: 420, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      this.dots.set(`${x},${y}`, { x, y, power: true, sprite });
    }
  }

  // Cada jugador: su bolita con su personaje, un aro de su color en los pies y su burbuja (escondida).
  makeEater(eater) {
    const T = this.tile;
    const blob = new Blob(this, 0, 0, eater.color, T * 0.34).setDepth(DEPTH.players);
    const ring = this.add.ellipse(0, blob.radius * 0.95, blob.radius * 2.9, blob.radius * 1.1).setStrokeStyle(4, eater.color, 1);
    blob.addAt(ring, 1);
    eater.look = new CharacterLook(this, blob, eater.character, { height: 3.1, poses: 'all' });
    eater.blob = blob;
    eater.bubble = this.add
      .circle(0, 0, T * 0.62, 0xbfe9ff, 0.3)
      .setStrokeStyle(4, 0xffffff, 0.9)
      .setDepth(DEPTH.bubbles)
      .setVisible(false);
  }

  // ---------- Los fantasmitas ----------
  makeGhosts() {
    const maze = this.maze;
    const T = this.tile;
    const spots = [...maze.houseSpots].sort((a, b) => a.x - b.x);
    const middle = spots[Math.floor(spots.length / 2)] ?? maze.houseCenter;
    const homes = [
      maze.exit,
      { x: middle.x, y: middle.y },
      { x: spots[0]?.x ?? middle.x, y: middle.y },
      { x: spots[spots.length - 1]?.x ?? middle.x, y: middle.y },
    ];
    this.ghosts = GHOSTS.map((info, index) => {
      const art = labGhost(this, info.key);
      const body = this.add.image(0, 0, art ?? `lab:ghost-${info.key}-0`);
      if (art) body.setScale(GHOST_TEXTURE / Math.max(body.width, body.height));
      const eyes = [-10, 10].map((x) => ({ white: this.add.ellipse(x, -6, 15, 19, 0xffffff), pupil: this.add.circle(x, -5, 5, COLORS.ink), x }));
      const sprite = this.add.container(0, 0, [body, ...eyes.flatMap((e) => [e.white, e.pupil])]).setDepth(DEPTH.ghosts);
      sprite.setScale((T * 0.95) / GHOST_TEXTURE);
      const ghost = { index, info, art, body, eyes, sprite, start: homes[index], dir: { x: -1, y: 0 } };
      this.resetGhost(ghost);
      return ghost;
    });
  }

  // Un fantasmita a su lugar de salida (Chispa afuera de la casita; los demás adentro, esperando su turno). `home`: donde
  // se mece dentro de la casita (al regresar como ojitos, en medio).
  resetGhost(ghost) {
    const home = ghost.start;
    Object.assign(ghost, {
      home,
      x: home.x,
      y: home.y,
      dir: { x: ghost.index % 2 ? 1 : -1, y: 0 },
      scared: false,
      stunnedMs: 0,
      reverse: false,
      bobMs: ghost.index * 300,
    });
    const outside = ghost.index === 0;
    ghost.state = outside ? 'active' : 'house';
    ghost.releaseMs = this.difficulty.release[ghost.index];
    ghost.sprite.setAlpha(1);
  }

  get ghostSpeed() {
    return this.difficulty.ghost + Math.min(LEVEL_GHOST_MAX, (this.level - 1) * LEVEL_GHOST_STEP);
  }

  get playerSpeed() {
    return Math.min(PLAYER_SPEED_MAX, PLAYER_SPEED + (this.level - 1) * 0.1);
  }

  get scatter() {
    return this.modeIndex < 5 && this.modeIndex % 2 === 0;
  }

  // Las casillas que se pueden pisar (nadie entra a la casita por fuera; los fantasmitas salen y entran solos).
  canWalk = (x, y) => {
    const ch = tileAt(this.maze, x, y);
    return !isWall(ch) && !isHouse(ch);
  };

  updateGhosts(dt) {
    const maze = this.maze;
    // Cada rato cambian: se van a su esquina o te buscan (y al cambiar se dan la vuelta).
    if (this.scaredMs <= 0) {
      this.modeMs += dt;
      const limit = this.scatter ? this.difficulty.scatterMs : this.difficulty.chaseMs;
      if (this.modeIndex < 5 && this.modeMs >= limit) {
        this.modeIndex += 1;
        this.modeMs = 0;
        for (const ghost of this.ghosts) if (ghost.state === 'active') ghost.reverse = true;
      }
    }
    const targets = this.eaters.filter((e) => e.state === 'play');
    const chaser = this.ghosts[0];
    for (const ghost of this.ghosts) {
      ghost.bobMs += dt;
      if (ghost.state === 'house') {
        ghost.y = ghost.home.y + Math.sin(ghost.bobMs / 180) * 0.22;
        ghost.releaseMs -= dt;
        if (ghost.releaseMs <= 0) ghost.state = 'leaving';
        continue;
      }
      if (ghost.state === 'leaving') {
        this.moveInHouse(ghost, maze.exit.x, maze.exit.y, HOUSE_SPEED * dt, () => {
          ghost.state = 'active';
          ghost.dir = { x: ghost.index % 2 ? 1 : -1, y: 0 };
        });
        continue;
      }
      if (ghost.state === 'entering') {
        this.moveInHouse(ghost, maze.exit.x, maze.houseCenter.y, (EYES_SPEED / 2) * dt, () => {
          ghost.state = 'house';
          ghost.releaseMs = 500;
          ghost.home = { x: maze.exit.x, y: maze.houseCenter.y };
          labSfx.pop();
        });
        continue;
      }
      if (ghost.stunnedMs > 0) {
        ghost.stunnedMs -= dt;
        continue;
      }
      if (ghost.reverse) {
        ghost.reverse = false;
        ghost.dir = { x: -ghost.dir.x, y: -ghost.dir.y };
      }
      const eyes = ghost.state === 'eyes';
      let speed = eyes ? EYES_SPEED : ghost.scared ? SCARED_SPEED : this.ghostSpeed;
      if (!eyes && inTunnel(maze, Math.round(ghost.x), Math.round(ghost.y))) speed = Math.min(speed, TUNNEL_SPEED);
      const target = eyes ? maze.exit : ghostTarget(ghost, { maze, targets, chaser, scatter: this.scatter });
      // Con los del modo peque, más despacito.
      if (!eyes && targets.length) {
        const nearest = targets.reduce((best, p) => (wrapDistance(p, ghost, maze.width) < wrapDistance(best, ghost, maze.width) ? p : best));
        if (nearest.peque) speed *= PEQUE_SLOW;
      }
      step(ghost, (speed * dt) / 1000, {
        width: maze.width,
        canEnter: this.canWalk,
        onCenter: (g, cx, cy) => {
          // Los ojitos se paran justo afuera de la puerta (y luego entran).
          if (eyes && cx === maze.exit.x && cy === maze.exit.y) g.dir = STOP;
          else g.dir = chooseDir(g, target, this.canWalk, g.scared && !eyes);
        },
      });
      if (eyes && Math.abs(ghost.x - maze.exit.x) < 0.05 && Math.abs(ghost.y - maze.exit.y) < 0.05) {
        ghost.x = maze.exit.x;
        ghost.y = maze.exit.y;
        ghost.state = 'entering';
      }
    }
  }

  // Dentro de la casita: primero de lado hasta la puerta, luego derechito (para salir o para entrar).
  moveInHouse(ghost, doorX, toY, dist, onArrive) {
    const d = dist / 1000;
    if (Math.abs(ghost.x - doorX) > 0.01 && Math.abs(ghost.y - ghost.home.y) < 0.3) {
      ghost.x += Math.sign(doorX - ghost.x) * Math.min(d, Math.abs(doorX - ghost.x));
      ghost.dir = { x: Math.sign(doorX - ghost.x) || ghost.dir.x, y: 0 };
      return;
    }
    ghost.x = doorX;
    const left = toY - ghost.y;
    ghost.dir = { x: 0, y: Math.sign(left) || -1 };
    if (Math.abs(left) <= d) {
      ghost.y = toY;
      onArrive();
      return;
    }
    ghost.y += Math.sign(left) * d;
  }

  // La fruta de poder: todos los fantasmitas (menos los ojitos) se asustan y se dan la vuelta.
  startScared() {
    const duration = Math.max(MIN_SCARED_MS, this.difficulty.scaredMs - (this.level - 1) * 600);
    this.scaredMs = duration;
    this.combo = 0;
    for (const ghost of this.ghosts) {
      if (ghost.state === 'eyes' || ghost.state === 'entering') continue;
      ghost.scared = true;
      if (ghost.state === 'active') ghost.reverse = true;
    }
    music.setTempo(1.2);
  }

  endScared() {
    this.scaredMs = 0;
    for (const ghost of this.ghosts) ghost.scared = false;
    music.setTempo(1);
  }

  // ---------- Los jugadores ----------
  updateEaters(dt) {
    const maze = this.maze;
    for (const eater of this.eaters) {
      if (eater.state === 'bubble') {
        this.updateBubble(eater, dt);
        continue;
      }
      if (eater.state !== 'play') continue;
      eater.safeMs = Math.max(0, eater.safeMs - dt);
      // El stick (o la cruceta): la dirección que quiere se guarda hasta que se pueda dar la vuelta.
      const stick = controls.getStick(eater.deviceId);
      if (Math.max(Math.abs(stick.x), Math.abs(stick.y)) > 0.5) {
        eater.want = Math.abs(stick.x) >= Math.abs(stick.y) ? { x: Math.sign(stick.x), y: 0 } : { x: 0, y: Math.sign(stick.y) };
      }
      const want = eater.want;
      if (want && !isStopped(eater.dir) && want.x === -eater.dir.x && want.y === -eater.dir.y) eater.dir = want;
      // Si se pasó tantito de la esquina, igual da la vuelta.
      if (want && !isStopped(eater.dir) && !sameDir(want, eater.dir) && (want.x === 0) !== (eater.dir.x === 0)) {
        const back = centerBehind(eater);
        if (Math.hypot(eater.x - back.x, eater.y - back.y) < TURN_GRACE && this.canWalk(back.x + want.x, back.y + want.y)) {
          eater.x = back.x;
          eater.y = back.y;
          eater.dir = want;
        }
      }
      step(eater, (this.playerSpeed * dt) / 1000, {
        width: maze.width,
        canEnter: this.canWalk,
        onCenter: (e, cx, cy) => {
          if (e.want && this.canWalk(cx + e.want.x, cy + e.want.y)) e.dir = e.want;
        },
      });
      if (eater.dir.x) eater.facing = eater.dir.x;
      const tx = ((Math.round(eater.x) % maze.width) + maze.width) % maze.width;
      const ty = Math.round(eater.y);
      const dot = this.dots.get(`${tx},${ty}`);
      if (dot) this.eatDot(dot, eater);
      if (this.fruit && tx === maze.fruit.x && ty === maze.fruit.y) this.eatFruit(eater);
    }
  }

  // El que atraparon regresa flotando en su burbuja a su lugar.
  updateBubble(eater, dt) {
    eater.bubbleMs += dt;
    const t = Math.min(1, eater.bubbleMs / BUBBLE_MS);
    const ease = Phaser.Math.Easing.Sine.InOut(t);
    eater.x = eater.from.x + (eater.home.x - eater.from.x) * ease;
    eater.y = eater.from.y + (eater.home.y - eater.from.y) * ease - Math.sin(t * Math.PI) * 1.2;
    if (t < 1) return;
    Object.assign(eater, { x: eater.home.x, y: eater.home.y, dir: STOP, want: null, state: 'play', safeMs: SAFE_MS });
    labSfx.pop();
    burst(this, eater.blob.x, eater.blob.y, 0xbfe9ff, 8);
    // Si ya no quedaba nadie jugando, los fantasmitas regresan a su casita (como en el clásico).
    if (this.resetGhostsOnReturn) {
      this.resetGhostsOnReturn = false;
      this.endScared();
      for (const ghost of this.ghosts) this.resetGhost(ghost);
    }
    this.refreshHud();
  }

  eatDot(dot, eater) {
    this.dots.delete(`${dot.x},${dot.y}`);
    this.tweens.killTweensOf(dot.power ? dot.sprite.list : dot.sprite);
    dot.sprite.destroy();
    this.dotsEaten += 1;
    this.addPoints(eater, dot.power ? POWER_POINTS : DOT_POINTS);
    if (dot.power) {
      this.startScared();
      labSfx.power();
      sparkles(this, eater.blob.x, eater.blob.y, 8, 40);
      popText(this, eater.blob.x, eater.blob.y - 40, '¡Fruta de poder!', '#ffd23c');
      say('¡Fruta de poder! ¡Cómanse a los fantasmitas!');
      eater.look.express('feliz', 900);
    } else if (this.wakaMs <= 0) {
      this.wakaHigh = !this.wakaHigh;
      labSfx.waka(this.wakaHigh);
      this.wakaMs = WAKA_GAP_MS;
    }
    if (this.fruitsShown < FRUIT_AT.length && this.dotsEaten >= this.dotsTotal * FRUIT_AT[this.fruitsShown]) this.showFruit();
    if (!this.dots.size) this.levelClear();
  }

  addPoints(eater, points) {
    eater.points += points;
    if (!this.extraLife && this.teamPoints >= EXTRA_LIFE_AT) {
      this.extraLife = true;
      this.lives += 1;
      bump(this, this.hudLives);
      sfx.meterFull();
      say('¡Vida extra!');
    }
    this.refreshHud();
  }

  // ---------- La fruta bonus (sale en medio a ratos) ----------
  showFruit() {
    this.fruitsShown += 1;
    if (!this.maze.fruit) return;
    const def = FRUITS[(this.level - 1) % FRUITS.length];
    const at = this.toScreen(this.maze.fruit.x, this.maze.fruit.y);
    const art = labObject(this, def.key);
    let sprite;
    if (art) {
      sprite = this.add.image(at.x, at.y, art);
      sprite.setScale((this.tile * 0.95) / Math.max(sprite.width, sprite.height));
    } else {
      sprite = this.add.text(at.x, at.y, def.emoji, textStyle(this.tile * 0.8, TEXT.normal)).setOrigin(0.5);
    }
    sprite.setDepth(DEPTH.fruit);
    this.tweens.add({ targets: sprite, y: at.y - 4, duration: 400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.fruit = { def, sprite, ms: FRUIT_MS };
    sparkles(this, at.x, at.y, 6, 30);
    sfx.sparkle();
    say('¡Fruta bonus!');
  }

  updateFruit(dt) {
    if (!this.fruit) return;
    this.fruit.ms -= dt;
    this.fruit.sprite.setVisible(this.fruit.ms > 2000 || Math.floor(this.fruit.ms / 150) % 2 === 0);
    if (this.fruit.ms > 0) return;
    this.tweens.killTweensOf(this.fruit.sprite);
    this.fruit.sprite.destroy();
    this.fruit = null;
  }

  eatFruit(eater) {
    const { def, sprite } = this.fruit;
    this.fruit = null;
    this.tweens.killTweensOf(sprite);
    burst(this, sprite.x, sprite.y, 0xffc93c, 10);
    popText(this, sprite.x, sprite.y - 30, `+${def.points}`, '#ffc93c');
    sprite.destroy();
    eater.fruits += 1;
    this.addPoints(eater, def.points);
    labSfx.fruit();
    eater.look.express('feliz', 900);
  }

  // ---------- Cuando se juntan un jugador y un fantasmita ----------
  checkTouches() {
    const width = this.maze.width;
    for (const eater of this.eaters) {
      if (eater.state !== 'play') continue;
      for (const ghost of this.ghosts) {
        if (ghost.state !== 'active' || wrapDistance(eater, ghost, width) >= CATCH_DIST) continue;
        if (ghost.scared) this.eatGhost(ghost, eater);
        else if (eater.safeMs > 0) continue;
        else if (eater.peque) this.bounceGhost(ghost, eater);
        else this.catchEater(eater, ghost);
        if (eater.state !== 'play') break;
      }
    }
  }

  eatGhost(ghost, eater) {
    const points = GHOST_POINTS[Math.min(this.combo, GHOST_POINTS.length - 1)];
    labSfx.eatGhost(Math.min(this.combo, 3));
    this.combo += 1;
    ghost.state = 'eyes';
    ghost.scared = false;
    eater.ghosts += 1;
    this.addPoints(eater, points);
    popText(this, ghost.sprite.x, ghost.sprite.y - 24, `+${points}`, '#9fd8ff');
    burst(this, ghost.sprite.x, ghost.sprite.y, ghost.info.color, 10);
    eater.look.express('feliz', 900);
    // Un instante congelado: ¡ñam!
    setTimeScale(0, 220);
    if (this.combo === 1) say('¡Ñam! ¡A su casita, fantasmita!');
    if (this.combo === GHOSTS.length) {
      rewards.earn('laberinto-fantasmas');
      say('¡Los cuatro fantasmitas!');
    }
    this.time.delayedCall(260, () => labSfx.eyes());
  }

  // Modo peque: el fantasmita rebota (se da la vuelta y se marea tantito).
  bounceGhost(ghost, eater) {
    ghost.dir = { x: -ghost.dir.x, y: -ghost.dir.y };
    ghost.stunnedMs = BOUNCE_MS;
    eater.safeMs = 900;
    labSfx.boing();
    popText(this, ghost.sprite.x, ghost.sprite.y - 24, '¡Boing!', '#ffd84d');
  }

  catchEater(eater, ghost) {
    labSfx.caught();
    burst(this, eater.blob.x, eater.blob.y, eater.color, 10);
    eater.look.express('asustado', 1200);
    if (this.lives > 0) {
      this.lives -= 1;
      bump(this, this.hudLives);
      Object.assign(eater, { state: 'bubble', bubbleMs: 0, from: { x: eater.x, y: eater.y } });
      // (Si cruza el túnel, que no flote por toda la pantalla.)
      if (Math.abs(eater.from.x - eater.home.x) > this.maze.width / 2) eater.from.x = eater.home.x;
      say(`¡Te atrapó ${ghost.info.name}!`);
    } else {
      eater.state = 'out';
      eater.blob.setVisible(false);
      eater.bubble.setVisible(false);
      popText(this, eater.blob.x, eater.blob.y - 30, '💤', '#ffffff');
      say(`¡${eater.label} se queda fuera!`);
    }
    if (!this.eaters.some((e) => e.state === 'play')) this.resetGhostsOnReturn = true;
    this.refreshHud();
    if (this.eaters.every((e) => e.state === 'out')) {
      this.phase = 'over';
      this.phaseMs = 0;
      this.endScared();
      sfx.powerDown();
      this.showBanner('¡Fin del juego!', '');
      say('¡Fin del juego!');
    }
  }

  // ---------- Nivel completo ----------
  levelClear() {
    this.phase = 'clear';
    this.phaseMs = 0;
    this.endScared();
    rewards.earn('laberinto-nivel');
    sfx.win();
    fireworks(this, [0xffffff, 0xffc93c, ...this.eaters.map((e) => e.color)], 3);
    this.showBanner('¡Nivel completo!', `${THEMES[this.mazeKey].emoji} ${THEMES[this.mazeKey].name}`);
    say('¡Nivel completo!');
    for (const ghost of this.ghosts) this.tweens.add({ targets: ghost.sprite, alpha: 0, duration: 400 });
    for (const eater of this.eaters) {
      // Los que estaban fuera regresan para el siguiente nivel.
      if (eater.state === 'play') eater.look.dance(CLEAR_MS);
    }
  }

  nextLevel() {
    if (this.level >= this.levelCount) {
      this.finish(true);
      return;
    }
    this.level += 1;
    this.startLevel();
  }

  // ---------- Los letreros grandes ----------
  showBanner(text, sub) {
    this.banner?.destroy();
    const { width, height } = this.scale;
    const big = this.add.text(0, 0, text, textStyle(68, TEXT.normal, { fontStyle: 'bold', stroke: '#1b1530', strokeThickness: 10 })).setOrigin(0.5);
    const small = this.add.text(0, 62, sub, textStyle(32, TEXT.accent, { fontStyle: 'bold', stroke: '#1b1530', strokeThickness: 6 })).setOrigin(0.5);
    this.banner = this.add.container(width / 2, height / 2 - 20, [big, small]).setDepth(DEPTH.banner);
    bounceIn(this, big, small);
  }

  updateIntro() {
    const theme = THEMES[this.mazeKey];
    if (this.introStep === 0) {
      this.introStep = 1;
      this.showBanner(`Nivel ${this.level}`, `${theme.emoji} ${theme.name}`);
      say(`Nivel ${this.level}: ${theme.name}`);
    } else if (this.introStep === 1 && this.phaseMs >= 1300) {
      this.introStep = 2;
      this.showBanner('¡Listos!', '');
      sfx.countdown();
    } else if (this.introStep === 2 && this.phaseMs >= 2000) {
      this.introStep = 3;
      this.showBanner('¡Ya!', '');
      sfx.countdown(true);
      say('¡A comer!');
    } else if (this.introStep === 3 && this.phaseMs >= INTRO_MS) {
      this.banner?.destroy();
      this.banner = null;
      this.phase = 'play';
      this.phaseMs = 0;
    }
  }

  // ---------- Cada cuadro ----------
  update() {
    const dt = frameDelta();
    this.phaseMs += dt;
    this.updateExit();
    if (this.phase === 'setup') {
      this.updateSetup();
      return;
    }
    if (this.phase === 'results') {
      this.updateResults();
      return;
    }
    if (this.phase === 'intro') this.updateIntro();
    else if (this.phase === 'play') {
      this.wakaMs -= dt;
      this.updateEaters(dt);
      if (this.phase === 'play') {
        if (this.scaredMs > 0) {
          this.scaredMs -= dt;
          if (this.scaredMs <= 0) this.endScared();
        }
        this.updateGhosts(dt);
        this.checkTouches();
        this.updateFruit(dt);
      }
    } else if (this.phase === 'clear') {
      this.flashWalls(Math.floor(this.phaseMs / 220) % 2 === 1);
      if (this.phaseMs >= CLEAR_MS) this.nextLevel();
    } else if (this.phase === 'over') {
      for (const eater of this.eaters) if (eater.state === 'bubble') this.updateBubble(eater, dt);
      if (this.phaseMs >= GAME_OVER_MS) this.finish(false);
    }
    if (this.phase !== 'results' && this.layer) this.syncSprites();
  }

  // Pone a todos donde van en la pantalla, con su pose.
  syncSprites() {
    const T = this.tile;
    const now = this.time.now;
    for (const eater of this.eaters) {
      if (!eater.blob || eater.state === 'out') continue;
      const at = this.toScreen(eater.x, eater.y);
      eater.blob.setPosition(at.x, at.y + T * 0.1);
      const moving = eater.state === 'play' && !isStopped(eater.dir) && this.phase === 'play';
      const pose = eater.state === 'bubble' ? 'normal' : eater.look.groundPose(moving);
      eater.look.show(pose, eater.facing);
      // Recién salido de su burbuja: parpadea (no lo pueden atrapar).
      eater.blob.setAlpha(eater.safeMs > 0 && Math.floor(now / 110) % 2 === 0 ? 0.35 : 1);
      eater.bubble.setVisible(eater.state === 'bubble');
      if (eater.state === 'bubble') eater.bubble.setPosition(at.x, at.y - T * 0.15).setScale(0.92 + 0.08 * Math.sin(now / 160));
    }
    for (const ghost of this.ghosts) {
      const at = this.toScreen(ghost.x, ghost.y);
      // Asustados tiemblan; mareados (modo peque) se mecen.
      const shake = ghost.scared && ghost.state !== 'house' ? Math.sin(now / 30) * 1.5 : 0;
      ghost.sprite.setPosition(at.x + shake, at.y);
      ghost.sprite.setAngle(ghost.stunnedMs > 0 ? Math.sin(now / 70) * 14 : 0);
      const eyesOnly = ghost.state === 'eyes' || ghost.state === 'entering';
      const flashing = ghost.scared && this.scaredMs < FLASH_MS && Math.floor(now / 200) % 2 === 0;
      const frame = Math.floor(now / 160) % 2;
      ghost.body.setVisible(!eyesOnly);
      // (Los dibujos de Gemini miran a la derecha: se voltean cuando va a la izquierda.)
      ghost.body.setFlipX(ghost.dir.x < 0 && ghost.body.texture.key.startsWith('laberinto:'));
      if (ghost.scared) {
        const art = labGhost(this, 'asustado');
        if (art && !flashing) ghost.body.setTexture(art).setScale(GHOST_TEXTURE / Math.max(ghost.body.width, ghost.body.height));
        else ghost.body.setTexture(`lab:ghost-${flashing ? 'flash' : 'scared'}-${frame}`).setScale(1);
      } else if (ghost.art) {
        ghost.body.setTexture(ghost.art).setScale(GHOST_TEXTURE / Math.max(ghost.body.width, ghost.body.height));
      } else {
        ghost.body.setTexture(`lab:ghost-${ghost.info.key}-${frame}`).setScale(1);
      }
      // Los ojos (miran hacia donde camina): sin dibujo de Gemini, o cuando solo quedan los ojitos.
      const showEyes = eyesOnly || (!ghost.scared && !ghost.art);
      for (const eye of ghost.eyes) {
        eye.white.setVisible(showEyes);
        eye.pupil.setVisible(showEyes).setPosition(eye.x + ghost.dir.x * 4, -5 + ghost.dir.y * 5);
      }
    }
  }

  // ---------- Al final: la tabla ----------
  finish(won) {
    this.phase = 'results';
    this.phaseMs = 0;
    this.endScared();
    this.banner?.destroy();
    this.banner = null;
    const team = this.teamPoints;
    const newRecord = !this.contest && team > this.record;
    if (newRecord) {
      this.record = team;
      settings.set(RECORD_KEY, team);
    }
    const recorrido = this.setup.maze === 'recorrido';
    if (won && recorrido) rewards.earn('laberinto-recorrido');
    const ranking = [...this.eaters].sort((a, b) => b.points - a.points);
    let title;
    if (this.contest) {
      title = `🏆 ¡Ganó ${ranking[0].label}!`;
      say(`¡Ganó ${ranking[0].label}!`);
    } else if (won) {
      title = recorrido ? '🏆 ¡Ganaron el recorrido!' : '🏆 ¡Lo lograron!';
      say(recorrido ? '¡Ganaron el recorrido!' : '¡Lo lograron!');
    } else {
      title = `¡${this.eaters.length > 1 ? 'Llegaron' : 'Llegaste'} al nivel ${this.level}!`;
      say(title);
    }
    if (won || this.contest) {
      sfx.win();
      confetti(this, [0xffffff, 0xffc93c, ...this.eaters.map((e) => e.color)], 90);
    }
    const { width, height } = this.scale;
    this.screen = this.add.container(0, 0).setDepth(DEPTH.screen);
    this.screen.add(this.add.rectangle(width / 2, height / 2, width, height, 0x14112b, 0.9));
    this.screen.add(this.add.text(width / 2, 90, title, textStyle(52, TEXT.normal, { fontStyle: 'bold' })).setOrigin(0.5));
    const teamLine = this.contest
      ? `Entre todos: ${team} puntos`
      : `Puntos del equipo: ${team}  ·  Récord: ${this.record}${newRecord ? '  ·  ¡Récord nuevo!' : ''}`;
    this.screen.add(this.add.text(width / 2, 160, teamLine, textStyle(26, newRecord ? TEXT.accent : TEXT.normal, { fontStyle: 'bold' })).setOrigin(0.5));
    ranking.forEach((eater, i) => {
      const y = 250 + i * 80;
      this.screen.add(this.add.rectangle(width / 2, y, 760, 64, COLORS.panel).setRounded(16));
      const medal = this.contest ? ['🥇', '🥈', '🥉', '🏅'][i] : '⭐';
      this.screen.add(
        this.add
          .text(
            width / 2 - 340,
            y,
            `${medal} ${eater.label}`,
            textStyle(30, hexToCss(eater.color), { fontStyle: 'bold', stroke: '#1b1530', strokeThickness: 5 }),
          )
          .setOrigin(0, 0.5),
      );
      this.screen.add(this.add.text(width / 2 - 120, y, `${eater.points} puntos`, textStyle(28, TEXT.normal, { fontStyle: 'bold' })).setOrigin(0, 0.5));
      this.screen.add(this.add.text(width / 2 + 170, y, `👻 ${eater.ghosts}   🍒 ${eater.fruits}`, textStyle(26, TEXT.normal)).setOrigin(0, 0.5));
    });
    this.screen.add(this.add.text(width / 2, height - 60, 'A = jugar otra vez  ·  B = regresar al menú', textStyle(24, TEXT.accent)).setOrigin(0.5));
    this.refreshHud();
  }

  updateResults() {
    if (this.phaseMs < INPUT_DELAY_MS) return;
    const ids = this.eaters.map((e) => e.deviceId);
    if (ids.some((id) => controls.justPressed(id, 'b'))) {
      sfx.back();
      this.exit();
    } else if (ids.some((id) => controls.justPressed(id, 'a'))) {
      sfx.confirm();
      this.screen.destroy();
      this.screen = null;
      this.showSetup();
    }
  }

  updateExit() {
    const holding = this.humans.some((player) => controls.holdingExit(player.deviceId));
    this.exitMs = holding ? this.exitMs + realDelta() : 0;
    if (this.exitMs >= EXIT_HOLD_MS) this.exit();
  }

  exit() {
    if (this.exiting) return;
    this.exiting = true;
    music.setTempo(1);
    go(this, 'Menu', { selected: this.returnData.selected });
  }
}
