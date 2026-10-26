import Phaser from 'phaser';
import { controls } from '../../shared/controls.js';
import { frameDelta } from '../../shared/clock.js';
import { music } from '../../shared/music.js';
import { characterPicks } from '../../shared/picks.js';
import { players } from '../../shared/players.js';
import { rewards } from '../../shared/rewards.js';
import { sfx } from '../../shared/sound.js';
import { say } from '../../shared/voice.js';
import { defaultCharacter } from '../../scenes/CharacterSelectScene.js';
import { TEXT, hexToCss, textStyle } from '../../ui/style.js';
import { COSTUMES } from '../duelo/DueloFighter.js';
import { FightTalk } from '../duelo/talk.js';
import { burst, confetti, fireworks, popText, randomPow, sparkles } from '../brawl/effects.js';
import { comicHit, impact } from '../duelo/fx.js';
import { epicMoment } from '../../ui/epic.js';
import { Ambience } from '../../ui/ambient.js';
import { coinBank } from '../brawl/coins.js';
import { Shop, dressFighter, wardrobe } from '../brawl/shop.js';
import { loadSmashArt } from '../smash/art.js';
import { loadLevelBackground, loadPlatArt, platTexture } from './art.js';
import { Boss, BOSSES } from './boss.js';
import { Dino } from './dino.js';
import { ENEMIES, Enemy } from './enemies.js';
import { GhostRecorder, GhostRunner } from './ghost.js';
import { House } from './house.js';
import { Items, Platforms } from './items.js';
import { LEVELS, Level, WORLDS } from './levels.js';
import { BATTLE1, BATTLE2, MAP_FIGHT } from './levels2.js';
import { MAP_ENEMY, MODES, formatTime, ghosts, nodeOpen, progress, showMap, showModes, worldNodes, worldOpen } from './map.js';
import { overlaps, tileAt } from './physics.js';
import { Player, STAR_MS } from './Player.js';
import { THEMES, T, ROWS, isSolid, switches, themeTextures, tileTexture } from './tiles.js';
import { go } from '../../shared/transition.js';
import { bounceIn, bump } from '../../ui/bounce.js';

const HUD_DEPTH = 10000;
const CHUNK = 16;
const LIVES = { normal: 5, peque: 10 };
const BUBBLE_SPEED = 170;
const RESPAWN_MS = 1100;
const CLEAR_MS = 2600;
const FLAG_EPIC_MS = 900;
const END_SCREEN_DELAY_MS = 900;
const EXIT_HOLD_MS = 1200;
const OUTLINE = { fontStyle: 'bold', stroke: '#1b1530', strokeThickness: 5 };
const MULTI_COINS = 6;
const P_SWITCH_MS = 10000;
const CANNON = { everyMs: 3200, range: 760 };
const CAPE_SPIN = { reach: 84 };
const DINO_QUAKE = 170;
const LIFE_PRICE = 20;
const BATTLE = { ms: 90000, coinEveryMs: 1100, maxCoins: 10, drop: 3 };
const FIGHT_ENEMIES = 4;
const FIGHT_REWARD = 10;

// "Súper Bolitas": plataformas como Mario Bros para toda la familia, todos a la vez en la misma pantalla. Mapa de 7
// mundos (cada uno con su nivel, fuerte con mini jefe, otro nivel, castillo con jefe, casita con regalos y a
// veces un nivel secreto que se abre con la bandera secreta), un enemigo que camina por el mapa y, con X, los modos:
// contrarreloj contra tu fantasma, batalla de monedas, jefes en serie, la tienda y vidas extra.
export class PlatScene extends Phaser.Scene {
  constructor() {
    super('Plat');
  }

  init(data) {
    this.returnData = data ?? {};
  }

  preload() {
    loadPlatArt(this);
    this.picks = players.sorted().map((player) => characterPicks.get(player.deviceId, defaultCharacter(player)));
    loadSmashArt(this, { posesFor: this.picks });
  }

  create() {
    this.cameras.main.setScroll(0, 0);
    this.players = players.sorted().map((player, i) => new Player(this, player, this.picks[i], { peque: progress.peque(player.deviceId) }));
    for (const p of this.players) p.sprite.setVisible(false);
    this.layer = [];
    this.enemies = [];
    this.dinos = [];
    this.cannons = [];
    this.boss = null;
    this.items = null;
    this.platforms = null;
    this.ghost = null;
    this.exitMs = 0;
    this.exiting = false;
    this.coins = 0;
    // Dónde está el equipo en el mapa: en el último nivel abierto.
    const lastWorld = WORLDS.reduce((best, _, i) => (worldOpen(i) ? i : best), 0);
    const lastNode = worldNodes(lastWorld).reduce((best, node, i) => (node.kind === 'level' && nodeOpen(lastWorld, node) ? i : best), 0);
    this.mapState = { world: lastWorld, node: lastNode, enemy: null };
    this.mapEnemies = WORLDS.map(() => 3);
    this.housesUsed = new Set();
    this.modeIndex = 0;
    this.createHud();
    this.talk = new FightTalk(this, this.scale.height - 60, HUD_DEPTH + 2);
    this.talk.caption.setScrollFactor(0);
    this.input.keyboard?.on('keydown-ESC', () => this.exit());
    this.openMap();
  }

  startLives() {
    return this.players.some((p) => p.peque) ? LIVES.peque : LIVES.normal;
  }

  get hostInput() {
    return this.players[0].input;
  }

  // ---------- Mapa ----------

  openMap() {
    const fromRun = Boolean(this.run);
    this.clearLevel();
    this.phase = 'map';
    this.run = null;
    this.hud.setVisible(false);
    this.hideBanner();
    this.talk.hide();
    this.cameras.main.setScroll(0, 0).setBackgroundColor(0x7fd0ff);
    music.play('plat');
    this.screen?.destroy();
    // El enemigo del mapa (cuando ya pasaron el primer nivel del mundo) se mueve un lugar cada vez que regresan de
    // jugar, hasta que le ganen.
    const world = this.mapState.world;
    const nodes = worldNodes(world);
    let enemy = this.mapEnemies[world];
    if (enemy !== null && progress.level(LEVELS[nodes[0].index].id).done) {
      if (fromRun) {
        const choices = [2, 3, 4].filter((n) => n !== this.mapState.node && Math.abs(n - enemy) <= 1);
        enemy = Phaser.Utils.Array.GetRandom(choices.length ? choices : [enemy]);
        this.mapEnemies[world] = enemy;
      }
      if (enemy === this.mapState.node) enemy = null;
    } else enemy = null;
    this.mapState.enemy = enemy;
    this.map = showMap(this, this.mapState, this.picks);
    this.screen = this.map.root;
  }

  updateMap() {
    const host = players.host();
    if (!host) return;
    const id = host.deviceId;
    const step = (controls.justPressed(id, 'right') ? 1 : 0) - (controls.justPressed(id, 'left') ? 1 : 0);
    if (step) {
      const next = this.mapState.node + step;
      const nodes = this.map.nodes;
      if (next >= 0 && next < nodes.length && (nodes[next].open || step < 0)) {
        this.map.select(next, { animate: true });
        sfx.select();
        // ¡Te encontraste al enemigo del mapa!
        if (this.mapState.enemy === next) {
          this.time.delayedCall(400, () => this.phase === 'map' && this.startRun('fight'));
          return;
        }
      } else sfx.back();
    }
    const worldStep = (controls.justPressed(id, 'rb') ? 1 : 0) - (controls.justPressed(id, 'lb') ? 1 : 0);
    if (worldStep) {
      const next = this.mapState.world + worldStep;
      if (next >= 0 && next < WORLDS.length && worldOpen(next)) {
        this.mapState = { world: next, node: 0, enemy: null };
        sfx.confirm();
        this.openMap();
        return;
      }
      sfx.back();
    }
    // Y: cada quien prende o apaga su modo peque.
    for (const p of this.players) {
      if (!controls.justPressed(p.deviceId, 'y')) continue;
      p.peque = progress.togglePeque(p.deviceId);
      this.map.refresh();
      say(p.peque ? `${p.label}: modo peque` : `${p.label}: modo normal`);
      sfx.confirm();
    }
    if (controls.justPressed(id, 'a')) {
      const { node, open } = this.map.nodes[this.mapState.node];
      if (!open) {
        sfx.back();
        return;
      }
      sfx.confirm();
      if (node.kind === 'house') this.openHouse();
      else if (node.kind === 'secret') this.startRun('secret', { info: node.info });
      else this.startRun('level', { index: node.index });
    } else if (controls.justPressed(id, 'x')) {
      sfx.confirm();
      this.openModes();
    } else if (controls.justPressed(id, 'b')) {
      this.exit();
    }
  }

  closeScreen() {
    this.screen?.destroy();
    this.screen = null;
    this.map = null;
  }

  // ---------- Casita de regalos ----------

  openHouse() {
    if (this.housesUsed.has(this.mapState.world)) {
      say('Ya abriste esta casita. Regresa después de jugar otro nivel');
      sfx.back();
      return;
    }
    this.closeScreen();
    this.phase = 'house';
    this.house = new House(this);
  }

  updateHouse(dt) {
    const prize = this.house.update(dt, this.hostInput);
    if (!prize) return;
    this.housesUsed.add(this.mapState.world);
    rewards.earn('plat-casita');
    if (prize.kind === 'power') this.startPower = prize.power;
    else if (prize.kind === 'lives') this.bonusLives = (this.bonusLives ?? 0) + prize.amount;
    else coinBank.add(prize.amount);
    this.house.destroy();
    this.house = null;
    this.openMap();
  }

  // ---------- Modos (X en el mapa) ----------

  openModes() {
    this.closeScreen();
    this.phase = 'modes';
    this.modes = showModes(this, this.modeIndex, coinBank.get());
    this.screen = this.modes.root;
  }

  updateModes() {
    const input = this.hostInput;
    const step = (input.pressed('down') ? 1 : 0) - (input.pressed('up') ? 1 : 0);
    if (step) {
      this.modes.select(this.modes.selected + step);
      sfx.select();
    }
    if (input.pressed('b')) {
      this.modeIndex = this.modes.selected;
      sfx.back();
      this.openMap();
      return;
    }
    if (!input.pressed('a')) return;
    this.modeIndex = this.modes.selected;
    const mode = MODES[this.modes.selected].id;
    if (mode === 'trial') {
      const node = worldNodes(this.mapState.world)[this.mapState.node];
      if (node.kind !== 'level' || !progress.level(LEVELS[node.index].id).done) {
        say('Primero escoge en el mapa un nivel que ya pasaron');
        sfx.back();
        return;
      }
      this.startRun('trial', { index: node.index });
    } else if (mode === 'battle') {
      this.startRun('battle');
    } else if (mode === 'rush') {
      if (!progress.level(LEVELS[3].id).done) {
        say('Primero venzan al primer jefe');
        sfx.back();
        return;
      }
      this.startRun('rush');
    } else if (mode === 'shop') {
      this.closeScreen();
      this.phase = 'shop';
      this.shop = new Shop(this);
    } else if (mode === 'life') {
      if (coinBank.spend(LIFE_PRICE)) {
        progress.addExtraLife();
        sfx.coin();
        say('¡Una vida extra para el siguiente nivel!');
        this.openModes();
      } else {
        sfx.back();
        say('No alcanzan las monedas');
      }
    }
  }

  updateShop() {
    if (!this.shop.update()) return;
    this.shop.destroy();
    this.shop = null;
    sfx.back();
    this.openModes();
  }

  // ---------- Partidas ----------

  // mode: 'level' | 'secret' | 'trial' (contrarreloj) | 'battle' (monedas) | 'rush' (jefes en serie) | 'fight'
  // (contra el enemigo del mapa).
  startRun(mode, { index = null, info = null } = {}) {
    this.closeScreen();
    this.run = { mode, ms: 0 };
    // Las vidas compradas y las de la casita se guardan para una partida con vidas (no contrarreloj ni batalla).
    const withLives = !['trial', 'battle'].includes(mode);
    this.lives = this.startLives() + (withLives ? progress.takeExtraLives() + (this.bonusLives ?? 0) : 0);
    if (withLives) this.bonusLives = 0;
    this.coinsRun = 0;
    for (const p of this.players) {
      p.power = null;
      p.setSize('small');
      p.giantMs = 0;
      p.starMs = 0;
      p.stats = { coins: 0, stomps: 0, bigCoins: 0 };
      p.battleCoins = 0;
      const outfit = wardrobe.outfit(p.deviceId);
      dressFighter(this, p, outfit);
      p.outfitTint = outfit?.costume ? COSTUMES[outfit.costume] : null;
    }
    // El regalo de la casita: todos empiezan con ese poder.
    if (this.startPower) {
      for (const p of this.players) this.givePower(p, this.startPower, { quiet: true });
      this.startPower = null;
    }
    if (mode === 'level' || mode === 'trial') this.loadLevel(LEVELS[index]);
    else if (mode === 'secret') this.loadLevel(info);
    else if (mode === 'battle') {
      const spec = Math.random() < 0.5 ? BATTLE1 : BATTLE2;
      this.run.left = BATTLE.ms;
      this.run.coinMs = 0;
      this.loadLevel({ spec, id: 'batalla', world: this.mapState.world, index: null });
    } else if (mode === 'rush') {
      this.run.list = LEVELS.map((lv, i) => (lv.index === 3 && progress.open(i) ? i : -1)).filter((i) => i >= 0);
      this.run.step = 0;
      this.loadLevel(LEVELS[this.run.list[0]], { arenaStart: true });
    } else if (mode === 'fight') {
      const world = WORLDS[this.mapState.world];
      const theme = world.levels[0].theme;
      const spec = { ...MAP_FIGHT, theme, background: world.levels[0].background };
      this.loadLevel({ spec, id: 'pelea', world: this.mapState.world, index: null });
    }
  }

  // Para las pruebas: jugar directo el nivel `index`.
  startLevel(index) {
    this.startRun('level', { index });
  }

  loadLevel(info, { checkpoint = null, arenaStart = false } = {}) {
    this.clearLevel();
    this.info = info;
    switches.red = true;
    const level = new Level(info.spec);
    this.level = level;
    this.keys = themeTextures(this, level.theme);
    this.drawBackground();
    // Lo que se mueve en el fondo (pájaros, nieve, burbujas...).
    this.ambience = new Ambience(this, level.water ? 'mar' : level.theme, { depth: -90 });
    this.drawTiles();
    this.items = new Items(this);
    this.platforms = new Platforms(this, level.theme);
    const saved = info.id ? progress.level(info.id).big : [false, false, false];
    this.bigTaken = this.bigTaken?.id === info.id ? this.bigTaken : { id: info.id, got: [false, false, false] };
    let bigIndex = 0;
    this.checkpoints = [];
    this.pButtons = [];
    const eggColor = level.dino ?? WORLDS[info.world]?.dino ?? 'verde';
    this.eggColor = eggColor;
    for (const e of level.entities) {
      if (e.ch === 'o') this.items.addCoin(e.x, e.y);
      else if (e.ch === 'O') {
        this.items.addBigCoin(e.x, e.y, bigIndex, saved[bigIndex] || this.bigTaken.got[bigIndex]);
        bigIndex += 1;
      } else if (e.ch === 'R') this.items.addSpring(e.x, e.y);
      else if ('muzy'.includes(e.ch)) this.platforms.add(e.ch, e.col, e.row);
      else if (e.ch === 'D') this.dinos.push(new Dino(this, e.x, e.y, eggColor));
      else if (ENEMIES[e.ch]) this.enemies.push(new Enemy(this, e.ch, e.x, e.y));
      else if (e.ch === 'C') this.checkpoints.push(this.drawCheckpoint(e));
      else if (e.ch === 'F') this.goal = this.drawGoal(e, 0x4cd97b);
      else if (e.ch === 'G') this.secretGoal = this.drawGoal(e, 0x3fa7ff);
      else if (e.ch === 'P') this.pButtons.push(this.drawPButton(e));
      else if (e.ch === 'd') this.drawDoor(e);
    }
    // La batalla del mapa: los enemigos del mundo (más si son más jugadores).
    if (this.run?.mode === 'fight') {
      const key = MAP_ENEMY[info.world];
      for (let i = 0; i < FIGHT_ENEMIES + this.players.length - 1; i += 1) this.enemies.push(new Enemy(this, key, (5 + i * 3) * T, 3 * T));
    }
    // Los cañones.
    this.cannons = [];
    level.grid.forEach((row, r) => row.forEach((ch, c) => ch === 'Z' && this.cannons.push({ col: c, row: r, ms: (c * 97) % CANNON.everyMs })));
    this.checkpoint = checkpoint;
    const solo = this.run?.mode === 'trial';
    const start = checkpoint ?? level.start;
    this.players.forEach((p, i) => {
      if (solo && i > 0) {
        p.state = 'off';
        p.sprite.setVisible(false);
        p.tag.setVisible(false);
        return;
      }
      p.spawn(start.x + i * 30, start.y);
      p.sprite.setVisible(true);
      p.dino = null;
    });
    if (checkpoint) for (const c of this.checkpoints) if (c.x <= checkpoint.x + 1) this.reachCheckpoint(c, { silent: true });
    this.levelMs = 0;
    this.levelCoins = this.levelCoins ?? 0;
    this.bossFight = false;
    this.pSwitchMs = 0;
    this.cameras.main.setScroll(Phaser.Math.Clamp(start.x - 300, 0, Math.max(0, this.areaRight() - this.scale.width)), 0);
    this.cameras.main.setBackgroundColor(THEMES[level.theme]?.sky ?? 0x8fd3ff);
    this.phase = 'play';
    this.hud.setVisible(true);
    music.play(this.run?.mode === 'battle' ? 'brawl' : 'plat');
    // Contrarreloj: graba al jugador y, si hay récord guardado, sale su fantasma.
    if (solo) {
      this.recorder = new GhostRecorder();
      const ghost = ghosts.get(info.id);
      this.ghost = ghost ? new GhostRunner(this, ghost, this.players[0].character) : null;
    }
    const label = info.id === 'batalla' || info.id === 'pelea' ? level.name : `${info.id}  ${level.name}`;
    this.waveText.setText(label);
    if (arenaStart) {
      // Jefes en serie: directo a la arena.
      const a = level.arena;
      for (const p of this.players) if (p.state !== 'off') Object.assign(p, { x: (a.left + 3) * T + Math.random() * 60, y: (a.boss.row + 1) * T });
      this.cameras.main.setScroll(a.left * T, 0);
      this.startBossFight();
    } else if (this.run?.mode === 'battle') {
      this.showBanner('¡Batalla de monedas!', 'El que junte más gana · ¡brínquenle encima a los demás!', 2200);
    } else if (this.run?.mode === 'fight') {
      this.showBanner('¡Batalla!', 'Tumben a todos los enemigos', 1600);
    } else {
      this.showBanner(label.replace('  ', ' '), info.secret ? '¡Nivel secreto!' : WORLDS[info.world].name, 1600);
    }
  }

  clearLevel() {
    for (const chunk of this.layer) chunk.container.destroy();
    this.layer = [];
    this.tileImages = new Map();
    for (const e of this.enemies) e.gone || e.sprite.destroy();
    this.enemies = [];
    for (const d of this.dinos) d.destroy();
    this.dinos = [];
    this.boss?.destroy();
    this.boss = null;
    this.items?.destroy();
    this.items = null;
    this.platforms?.destroy();
    this.platforms = null;
    this.background?.destroy();
    this.background = null;
    this.ambience?.destroy();
    this.ambience = null;
    this.water?.destroy();
    this.water = null;
    this.ghost?.destroy();
    this.ghost = null;
    this.recorder = null;
    for (const c of this.checkpoints ?? []) c.sprite.destroy();
    this.checkpoints = [];
    for (const b of this.pButtons ?? []) b.sprite.destroy();
    this.pButtons = [];
    for (const d of this.doorSprites ?? []) d.destroy();
    this.doorSprites = [];
    this.goal?.sprite.destroy();
    this.goal = null;
    this.secretGoal?.sprite.destroy();
    this.secretGoal = null;
    this.cannons = [];
    for (const p of this.players ?? []) {
      p.sprite.setVisible(false);
      p.tag.setVisible(false);
      p.bubble.setVisible(false);
    }
  }

  // El fondo lejano: la imagen del mundo repetida, que se mueve más despacio que el nivel.
  drawBackground() {
    const level = this.level;
    const key = platTexture(this, `plat:fondo-${level.background}`);
    this.background = this.add.container(0, 0).setDepth(-100).setScrollFactor(0.25, 0);
    if (key) this.tileBackground(key);
    // Si no se ha bajado, se pide y se pone en cuanto llega (mientras, solo el cielo).
    else loadLevelBackground(this, level.background, (loaded) => this.level === level && this.background?.active && this.tileBackground(loaded));
    if (level.water) this.water = this.add.rectangle(0, 0, this.scale.width, this.scale.height, 0x1d6fb0, 0.22).setOrigin(0, 0).setScrollFactor(0).setDepth(70);
  }

  // La imagen del fondo repetida a lo largo del nivel (en espejo, para que no se noten las uniones).
  tileBackground(key) {
    const probe = this.textures.get(key).getSourceImage();
    const scale = this.scale.height / probe.height;
    const w = probe.width * scale;
    const count = Math.ceil((this.level.width * 0.25 + this.scale.width) / w) + 1;
    for (let k = 0; k < count; k += 1) this.background.add(this.add.image(k * w, 0, key).setOrigin(0, 0).setScale(scale).setFlipX(k % 2 === 1));
  }

  // Los cuadritos, en pedazos de 16 columnas (los que no se ven no se dibujan).
  drawTiles() {
    const level = this.level;
    for (let c0 = 0; c0 < level.cols; c0 += CHUNK) {
      const container = this.add.container(0, 0).setDepth(10);
      this.layer.push({ x0: c0 * T, x1: (c0 + CHUNK) * T, container });
      for (let col = c0; col < Math.min(level.cols, c0 + CHUNK); col += 1) {
        for (let row = 0; row < ROWS; row += 1) this.drawTile(col, row, container);
      }
    }
  }

  drawTile(col, row, container = this.layer[Math.floor(col / CHUNK)]?.container) {
    const id = `${col},${row}`;
    this.tileImages.get(id)?.destroy();
    this.tileImages.delete(id);
    if (!container) return;
    const ch = this.level.at(col, row);
    if (ch === 'w') {
      const above = this.level.at(col, row - 1) === 'w';
      const water = this.add.rectangle(col * T, row * T, T, T, 0x3fa7ff, 0.45).setOrigin(0, 0);
      if (!above) water.setStrokeStyle(3, 0xdff4ff, 0.8);
      container.add(water);
      this.tileImages.set(id, water);
      return;
    }
    const key = tileTexture(this.keys, this.level, col, row);
    if (!key) return;
    const image = this.add.image(col * T, row * T, key).setOrigin(0, 0);
    container.add(image);
    this.tileImages.set(id, image);
  }

  drawCheckpoint(e) {
    const g = this.add.container(e.x, e.y).setDepth(9);
    g.add(this.add.rectangle(0, -60, 6, 120, 0xdddddd).setStrokeStyle(2, 0x1b1530));
    const flag = this.add.triangle(3, -116, 0, 0, 40, 12, 0, 24, 0x8a86b8).setOrigin(0, 0).setStrokeStyle(3, 0x1b1530);
    g.add(flag);
    return { x: e.x, y: e.y, sprite: g, flag, reached: false };
  }

  drawGoal(e, color) {
    const g = this.add.container(e.x, e.y).setDepth(9);
    const height = 8 * T;
    g.add(this.add.rectangle(0, -height / 2, 10, height, 0xe8e8f0).setStrokeStyle(3, 0x1b1530));
    g.add(this.add.circle(0, -height - 8, 12, 0xffd84d).setStrokeStyle(3, 0x1b1530));
    const flag = this.add.triangle(5, -height + 6, 0, 0, 64, 22, 0, 44, color).setOrigin(0, 0).setStrokeStyle(4, 0x1b1530);
    g.add(flag);
    g.add(this.add.rectangle(0, -10, 40, 20, 0x8a8a9e).setStrokeStyle(3, 0x1b1530));
    return { x: e.x, y: e.y, height, sprite: g, flag };
  }

  // El botón P: un botón azul en el piso.
  drawPButton(e) {
    const sprite = this.add.container(e.x, e.y, [
      this.add.rectangle(0, -14, 40, 28, 0x3f7fe0).setStrokeStyle(4, 0x1b1530),
      this.add.text(0, -14, 'P', textStyle(22, '#ffffff', { fontStyle: 'bold', stroke: '#1b1530', strokeThickness: 4 })).setOrigin(0.5),
    ]);
    sprite.setDepth(30);
    return { x: e.x, y: e.y, w: 40, h: 28, sprite, pressed: false };
  }

  drawDoor(e) {
    const door = this.add.container(e.x, e.y, [
      this.add.rectangle(0, -40, 44, 80, 0x8a5a2e).setStrokeStyle(4, 0x1b1530),
      this.add.rectangle(0, -40, 32, 66, 0x6e4422),
      this.add.circle(10, -38, 4, 0xffd84d),
    ]);
    door.setDepth(8);
    // Una flechita: arriba en el stick para entrar.
    const arrow = this.add.text(0, -100, '▲', textStyle(26, '#ffd84d', { fontStyle: 'bold', stroke: '#1b1530', strokeThickness: 5 })).setOrigin(0.5);
    door.add(arrow);
    this.tweens.add({ targets: arrow, y: -110, duration: 500, yoyo: true, repeat: -1 });
    this.doorSprites.push(door);
  }

  // Hasta dónde llega la pantalla: el nivel normal, el cuarto secreto o la arena del jefe.
  areaLeft() {
    if (this.bossFight) return this.level.arena.left * T + ((this.level.arena.right - this.level.arena.left + 1) * T) / 2 - this.scale.width / 2;
    if (this.inBonus()) return this.level.bonus * T;
    return 0;
  }

  areaRight() {
    if (this.bossFight) return this.areaLeft() + this.scale.width;
    if (this.level.bonus !== undefined && !this.inBonus()) return this.level.bonus * T;
    return this.level.width;
  }

  // Lo que se puede ver ahorita (para los acercamientos de ui/epic.js).
  viewBounds() {
    const left = this.areaLeft();
    return { x: left, y: 0, width: Math.max(this.scale.width, this.areaRight() - left), height: this.scale.height };
  }

  inBonus() {
    const lead = this.players.find((p) => p.active) ?? this.players[0];
    return this.level.inBonus(lead.x);
  }

  // ---------- Cada cuadro ----------

  update() {
    const dt = Math.min(50, frameDelta());
    this.updateExit(dt);
    this.talk.update(dt);
    if (this.phase === 'map') return this.updateMap();
    if (this.phase === 'modes') return this.updateModes();
    if (this.phase === 'shop') return this.updateShop();
    if (this.phase === 'house') return this.updateHouse(dt);
    if (['results', 'gameover'].includes(this.phase)) return this.updateEndScreen(dt);
    if (this.phase === 'play') {
      this.levelMs += dt;
      this.run.ms += dt;
    }
    if (this.phase === 'clear') {
      this.updateClear(dt);
      this.renderAll();
      return;
    }
    this.platforms.update(dt);
    for (const p of this.players) {
      if (p.state === 'off') continue;
      if (p.state === 'bubble') this.updateBubble(p, dt);
      else p.update(dt, this.level);
    }
    if (this.recorder && this.players[0].active) this.recorder.record(dt, this.players[0]);
    this.ghost?.update(dt);
    for (const d of this.dinos) d.update(dt, this);
    this.dinos = this.dinos.filter((d) => {
      if (!d.gone) return true;
      d.destroy();
      return false;
    });
    for (const e of this.enemies) e.update(dt, this);
    this.enemies = this.enemies.filter((e) => !e.gone);
    this.items.update(dt);
    this.updateHazards();
    this.updatePSwitch(dt);
    this.updateCannons(dt);
    this.playerVsEnemies(dt);
    this.shellsVsEnemies();
    if (this.run.mode === 'battle') this.updateBattle(dt);
    this.updateBoss(dt);
    this.updateCheckpoints();
    this.updateDeaths();
    this.updateCamera(dt);
    this.renderAll();
    this.updateHud();
    if (this.phase === 'play') this.checkGoal();
    // (Los caparazones y los esqueletos desarmados ya cuentan como vencidos.)
    if (this.phase === 'play' && this.run.mode === 'fight' && this.enemies.every((e) => e.dead || e.gone || e.type.kind === 'shell' || e.state === 'pile')) this.levelClear();
  }

  renderAll() {
    for (const p of this.players) if (p.state !== 'off') p.render();
    for (const d of this.dinos) d.render();
    for (const e of this.enemies) e.render();
    this.boss?.render();
    // Solo se dibujan los pedazos del nivel que se ven.
    const cam = this.cameras.main;
    for (const chunk of this.layer) chunk.container.setVisible(chunk.x1 > cam.scrollX - T && chunk.x0 < cam.scrollX + cam.width + T);
  }

  updateCamera(dt) {
    // (En un momento épico la cámara la mueve ui/epic.js.)
    if (this.epicBusy) return;
    const cam = this.cameras.main;
    const W = this.scale.width;
    const active = this.players.filter((p) => p.active);
    if (active.length) {
      const minX = Math.min(...active.map((p) => p.x));
      const maxX = Math.max(...active.map((p) => p.x));
      let target = (minX + maxX) / 2 - W / 2;
      target = Math.max(target, maxX - W + 200);
      target = Math.min(target, minX - 200);
      target = Phaser.Math.Clamp(target, this.areaLeft(), Math.max(this.areaLeft(), this.areaRight() - W));
      cam.scrollX += (target - cam.scrollX) * Math.min(1, dt / 110);
    }
    // Nadie se sale de la pantalla (el de adelante espera a los demás).
    for (const p of active) p.x = Phaser.Math.Clamp(p.x, cam.scrollX + 18, cam.scrollX + W - 18);
  }

  // ---------- Bloques ----------

  bumpBlock(col, row, player) {
    const level = this.level;
    const ch = level.at(col, row);
    if (ch === '!') {
      this.toggleSwitch();
      this.wobbleTile(col, row);
      return;
    }
    if (!'Bb?MSYH$%'.includes(ch)) return;
    // Los enemigos parados encima del bloque salen volando.
    for (const e of this.enemies) {
      if (!e.dead && Math.abs(e.x - (col * T + T / 2)) < T && Math.abs(e.y - row * T) < 8) e.kill('bump', Math.sign(e.x - player.x) || 1);
    }
    const used = () => {
      level.set(col, row, 'U');
      this.drawTile(col, row);
    };
    if (ch === 'B') {
      if (player.big || player.giantMs > 0) {
        this.breakBlock(col, row);
        return;
      }
      this.wobbleTile(col, row);
      return;
    }
    if (ch === '?' || ch === 'b') {
      this.items.popCoin(col, row);
      this.coinTaken(player);
      if (ch === 'b') {
        const key = `${col},${row}`;
        this.multi = this.multi ?? new Map();
        const left = (this.multi.get(key) ?? MULTI_COINS) - 1;
        this.multi.set(key, left);
        if (left > 0) {
          this.wobbleTile(col, row);
          return;
        }
      }
      used();
      this.wobbleTile(col, row);
      return;
    }
    used();
    this.wobbleTile(col, row);
    if (ch === 'M') this.items.spawnPower(player.big || player.size === 'mini' ? this.level.power ?? 'flor' : 'hongo', col, row);
    else if (ch === 'S') this.items.spawnPower('estrella', col, row);
    else if (ch === '$') this.items.spawnPower('hongo-mini', col, row);
    else if (ch === '%') this.items.spawnPower('hongo-gigante', col, row);
    else if (ch === 'H') {
      this.items.spawnPower('vida', col, row);
      this.talk.line('¡Un bloque escondido!', { important: true });
    } else if (ch === 'Y') {
      const dino = new Dino(this, col * T + T / 2, row * T, this.eggColor);
      dino.vy = -500;
      this.dinos.push(dino);
      burst(this, col * T + T / 2, row * T - 20, 0x4cd97b, 12);
      this.talk.line('¡Un dinosaurio! ¡Súbete!', { important: true });
    }
  }

  breakBlock(col, row) {
    this.cameras.main.shake(80, 0.004);
    this.level.set(col, row, ' ');
    this.drawTile(col, row);
    this.drawTile(col, row + 1);
    this.items.breakBits(col, row, this.keys);
    sfx.boom();
  }

  wobbleTile(col, row) {
    const image = this.tileImages.get(`${col},${row}`);
    if (!image) return;
    this.tweens.add({ targets: image, y: row * T - 12, duration: 70, yoyo: true });
  }

  // El bloque de colores: cambia cuáles bloques (rojos o azules) están.
  toggleSwitch() {
    switches.red = !switches.red;
    sfx.special();
    this.level.grid.forEach((row, r) => row.forEach((ch, c) => '!ri'.includes(ch) && this.drawTile(c, r)));
    // Si a alguien le apareció un bloque encima, se sube.
    for (const p of this.players) {
      if (!p.active) continue;
      for (let k = 0; k < 4 && isSolid(tileAt(this.level, p.x, p.y - 4)); k += 1) p.y = Math.floor((p.y - 4) / T) * T;
    }
    this.talk.line(switches.red ? '¡Rojos!' : '¡Azules!');
  }

  // El botón P: las monedas se vuelven ladrillos y los ladrillos monedas un ratito.
  updatePSwitch(dt) {
    for (const b of this.pButtons) {
      if (b.pressed) continue;
      const presser = this.players.find((p) => p.active && p.vy >= 0 && Math.abs(p.x - b.x) < (p.w + b.w) / 2 && Math.abs(p.y - b.y) < 20);
      if (!presser) continue;
      b.pressed = true;
      this.tweens.add({ targets: b.sprite, scaleY: 0.3, duration: 120 });
      presser.bounce();
      this.pSwitch();
    }
    if (this.pSwitchMs > 0) {
      this.pSwitchMs -= dt;
      if (this.pSwitchMs <= 0) this.pSwitchBack();
    }
  }

  pSwitch() {
    sfx.special();
    this.pSwitchMs = P_SWITCH_MS;
    this.swapped = { bricks: [], coins: [] };
    // Ladrillos → monedas.
    this.level.grid.forEach((row, r) =>
      row.forEach((ch, c) => {
        if (ch !== 'B') return;
        this.level.set(c, r, ' ');
        this.drawTile(c, r);
        this.items.addCoin(c * T + T / 2, (r + 1) * T);
        this.swapped.bricks.push([c, r]);
      }),
    );
    // Monedas → ladrillos (las que estaban antes).
    for (const coin of [...this.items.coins]) {
      if (this.swapped.bricks.some(([c, r]) => Math.abs(coin.x - (c * T + T / 2)) < 2 && Math.abs(coin.y - ((r + 1) * T - T / 2 + 15)) < 2)) continue;
      const c = Math.floor(coin.x / T);
      const r = Math.floor(coin.y / T);
      if (this.level.at(c, r) !== ' ') continue;
      coin.sprite.destroy();
      this.items.coins = this.items.coins.filter((k) => k !== coin);
      this.level.set(c, r, 'B');
      this.drawTile(c, r);
      this.swapped.coins.push([c, r]);
    }
    this.talk.line('¡Botón P! Los ladrillos se volvieron monedas', { important: true });
  }

  pSwitchBack() {
    const occupied = (c, r) => this.players.some((p) => p.active && Math.abs(p.x - (c * T + T / 2)) < T && p.y > r * T && p.y - p.h < (r + 1) * T);
    // Las monedas que quedan regresan a ser ladrillos; los ladrillos que eran monedas, a monedas.
    for (const [c, r] of this.swapped.bricks) {
      const coin = this.items.coins.find((k) => Math.floor(k.x / T) === c && Math.floor(k.y / T) === r);
      if (!coin || occupied(c, r)) continue;
      coin.sprite.destroy();
      this.items.coins = this.items.coins.filter((k) => k !== coin);
      this.level.set(c, r, 'B');
      this.drawTile(c, r);
    }
    for (const [c, r] of this.swapped.coins) {
      if (this.level.at(c, r) !== 'B') continue;
      this.level.set(c, r, ' ');
      this.drawTile(c, r);
      this.items.addCoin(c * T + T / 2, (r + 1) * T);
    }
    this.swapped = null;
    sfx.powerDown();
  }

  // Gigante: rompe los bloques que tiene enfrente y arriba.
  giantSmash(player) {
    const x0 = player.x - player.w / 2 - 6;
    const x1 = player.x + player.w / 2 + 6;
    for (let c = Math.floor(x0 / T); c <= Math.floor(x1 / T); c += 1) {
      for (let r = Math.floor((player.y - player.h - 6) / T); r <= Math.floor((player.y - 4) / T); r += 1) {
        const ch = this.level.at(c, r);
        if ('Bb?MSYUH$%'.includes(ch) && ch !== ' ') this.breakBlock(c, r);
      }
    }
  }

  giantEnded(player) {
    popText(this, player.x, player.y - player.h - 20, '¡Se acabó lo gigante!', '#ffffff');
    sfx.powerDown();
  }

  // ---------- Jugadores ----------

  // X: el poder de cada quien (o el dinosaurio).
  action(player) {
    if (player.dino) {
      if (player.dino.color === 'rojo') {
        if (this.items.fireball(player, 'fire')) player.throwMs = 200;
        return;
      }
      const area = player.dino.lick();
      for (const e of this.enemies) {
        if (e.dead || e.type.immune || !overlaps(area, e)) continue;
        e.kill('tongue');
        this.coinTaken(player);
        popText(this, e.x, e.y - 60, '¡Ñam!', '#ffd84d');
      }
      return;
    }
    if (player.power === 'fire' && this.items.fireball(player, 'fire')) player.throwMs = 200;
    else if (player.power === 'ice' && this.items.fireball(player, 'ice')) player.throwMs = 200;
    else if (player.power === 'cape' && player.spinMs === 0) this.capeSpin(player);
  }

  // La capa gira y tumba a los de alrededor.
  capeSpin(player) {
    player.spinMs = 320;
    sfx.throw();
    for (const e of this.enemies) {
      if (e.dead || e.type.immune || Math.hypot(e.x - player.x, e.y - e.h / 2 - (player.y - player.h / 2)) > CAPE_SPIN.reach + e.w / 2) continue;
      e.kill('star', Math.sign(e.x - player.x) || 1);
      sfx.hit(0.5);
    }
    if (this.boss && !this.boss.dead && Math.abs(this.boss.x - player.x) < CAPE_SPIN.reach + this.boss.w / 2 && overlaps(player, this.boss, -30)) {
      if (this.boss.fireHit()) this.bossDefeated();
    }
  }

  coinTaken(player) {
    player.stats.coins += 1;
    if (this.run?.mode === 'battle') player.battleCoins += 1;
    this.levelCoins += 1;
    this.coins += 1;
    coinBank.add(1);
    sfx.coin();
    // Cada 50 monedas, una vida.
    if (this.coins % 50 === 0 && this.run?.mode !== 'battle') this.addLife(player);
  }

  addLife(player) {
    this.lives += 1;
    popText(this, player.x, player.y - player.h - 30, '¡Una vida más!', '#ff5a7a');
    sfx.win();
  }

  bigCoinTaken(player, index) {
    player.stats.bigCoins += 1;
    this.bigTaken.got[index] = true;
    sfx.star();
    burst(this, player.x, player.y - player.h, 0x7fb3ff, 14);
    const total = this.bigTaken.got.filter(Boolean).length;
    this.talk.line(total === 3 ? '¡Las tres monedas grandes!' : '¡Una moneda grande!', { important: true });
  }

  powerTaken(player, kind) {
    sparkles(this, player.x, player.y - player.h / 2, 8, 50);
    player.look.express('feliz', 1000);
    if (kind === 'vida') {
      this.addLife(player);
      return;
    }
    if (kind === 'estrella') {
      player.starMs = STAR_MS;
      sfx.star();
      rewards.earn('plat-estrella');
      this.talk.line('¡Estrella! ¡Nadie te puede pegar!', { important: true });
      return;
    }
    this.givePower(player, kind);
  }

  // Le da un poder (hongo, flor, flor de hielo, pluma, hongo mini o gigante).
  givePower(player, kind, { quiet = false } = {}) {
    const say = (line) => !quiet && this.talk.line(line, { important: true });
    if (kind === 'hongo') {
      player.grow();
      if (!quiet) this.talk.line(['¡Creció!', `¡${player.label} está grandote!`]);
    } else if (kind === 'flor') {
      player.getPower('fire');
      say('¡Fuego! Aprieta X');
    } else if (kind === 'flor-hielo') {
      player.getPower('ice');
      say('¡Hielo! Aprieta X para congelar');
    } else if (kind === 'pluma') {
      player.getPower('cape');
      rewards.earn('plat-capa');
      say('¡Capa! Mantén A en el aire para planear');
    } else if (kind === 'hongo-mini') {
      player.shrinkMini();
      say('¡Chiquitito! Cabes por todos lados');
    } else if (kind === 'hongo-gigante') {
      player.growGiant();
      rewards.earn('plat-gigante');
      say('¡GIGANTE! ¡Rompe todo!');
      this.cameras.main.shake(300, 0.01);
    }
  }

  pequeRescue(player) {
    popText(this, player.x, player.y - player.h - 20, '¡Boing!', '#ffd84d');
    sfx.boing();
  }

  mounted(player) {
    rewards.earn('plat-dino');
    const what = { rojo: '¡Dinosaurio rojo! Con X escupe fuego', azul: '¡Dinosaurio azul! Mantén A para aletear', amarillo: '¡Dinosaurio amarillo! Al caer hace temblar el piso' }[player.dino?.color];
    this.talk.line(what ?? [`¡${player.label} se subió al dinosaurio!`, '¡Arre, dinosaurio!']);
  }

  dinoRunsAway(player, { silent = false } = {}) {
    player.dino?.runAway();
    if (!silent) popText(this, player.x, player.y - player.h - 20, '¡Se asustó!', '#ffffff');
  }

  // Dinosaurio amarillo: al caer tumba a los enemigos del piso cercanos.
  dinoQuake(player) {
    this.cameras.main.shake(200, 0.01);
    sfx.boom();
    burst(this, player.x, player.y, 0xffe14d, 10);
    for (const e of this.enemies) {
      if (e.dead || e.type.immune || Math.abs(e.x - player.x) > DINO_QUAKE || Math.abs(e.y - player.y) > T) continue;
      e.kill('bump', Math.sign(e.x - player.x) || 1);
    }
  }

  // Abajo en la boca de un tubo secreto: todos se van por el tubo.
  tryWarp(player) {
    if (this.warping) return;
    const warp = this.level.warps.find((w) => player.x > w.enter.col * T && player.x < (w.enter.col + 2) * T && Math.abs(player.y - w.enter.row * T) < 4);
    if (!warp) return;
    this.teleportAll(warp.exit, () => {
      if (this.level.inBonus(warp.exit.x)) {
        rewards.earn('plat-secreto');
        this.talk.line('¡Un cuarto secreto!', { important: true });
      }
    });
  }

  // Arriba frente a una puerta: todos pasan a la otra puerta.
  tryDoor(player) {
    if (this.warping) return;
    const door = this.level.doors.find((d) => Math.abs(player.x - d.x) < 26 && Math.abs(player.y - d.y) < 8);
    if (!door) return;
    this.teleportAll(door.to);
  }

  teleportAll(to, then) {
    this.warping = true;
    sfx.powerDown();
    this.cameras.main.fadeOut(220, 0, 0, 0);
    this.time.delayedCall(240, () => {
      this.players.forEach((p, i) => {
        if (p.state === 'dead' || p.state === 'off') return;
        p.x = to.x + i * 26;
        p.y = to.y;
        p.vx = 0;
        p.vy = 0;
        if (p.state === 'bubble') p.popBubble();
      });
      for (const d of this.dinos) if (d.rider) Object.assign(d, { x: d.rider.x, y: d.rider.y });
      this.cameras.main.setScroll(Phaser.Math.Clamp(to.x - this.scale.width / 2, this.areaLeft(), Math.max(this.areaLeft(), this.areaRight() - this.scale.width)), 0);
      this.cameras.main.fadeIn(260, 0, 0, 0);
      this.warping = false;
      then?.();
    });
  }

  // Burbuja: flota hacia el equipo; otro la revienta tocándola.
  updateBubble(p, dt) {
    const active = this.players.filter((o) => o.active);
    if (!active.length) return;
    const tx = active.reduce((s, o) => s + o.x, 0) / active.length;
    const ty = Math.min(...active.map((o) => o.y)) - 140;
    const dx = tx - p.x;
    const dy = ty - p.y;
    const d = Math.hypot(dx, dy) || 1;
    const step = Math.min(d, BUBBLE_SPEED * (dt / 1000));
    p.x += (dx / d) * step;
    p.y += (dy / d) * step + Math.sin(this.time.now / 300) * 0.4;
    const helper = active.find((o) => Math.hypot(o.x - p.x, o.y - o.h / 2 - (p.y - 22)) < 60);
    if (helper) {
      p.popBubble();
      popText(this, p.x, p.y - 80, '¡Pop!', '#bfe9ff');
      burst(this, p.x, p.y - 30, 0xbfe9ff, 10);
    }
  }

  playerDied(player) {
    this.deathAt = this.time.now;
    // El jefe se carcajea un buen rato.
    if (this.boss && !this.boss.dead) this.boss.taunt(2200);
    if (this.run?.mode === 'battle') {
      // En la batalla no hay vidas: pierde unas monedas y regresa.
      player.battleCoins = Math.max(0, player.battleCoins - BATTLE.drop);
      return;
    }
    if (this.players.some((p) => p.active)) this.talk.line([`¡Ayuden a ${player.label}! ¡Toquen su burbuja!`, `¡${player.label} se cayó!`], { important: true });
  }

  // Los que cayeron: si quedan compañeros regresan en burbuja; si no queda nadie, se pierde una vida.
  updateDeaths() {
    if (this.phase !== 'play') return;
    if (this.run.mode === 'battle') {
      for (const p of this.players) {
        if (p.state !== 'dead' || p.deadMs < 800) continue;
        p.spawn((3 + Math.random() * 20) * T, 3 * T);
        p.invulnMs = 1500;
      }
      return;
    }
    const someoneActive = this.players.some((p) => p.active);
    for (const p of this.players) {
      if (p.state !== 'dead' || p.deadMs < RESPAWN_MS) continue;
      if (someoneActive) {
        const cam = this.cameras.main;
        p.toBubble(cam.scrollX + cam.width / 2, 160);
      }
    }
    if (someoneActive) return;
    if (this.players.some((p) => p.state === 'dead' && p.deadMs < RESPAWN_MS)) return;
    this.loseLife();
  }

  loseLife() {
    // En la contrarreloj no hay vidas: se vuelve a empezar.
    if (this.run.mode === 'trial') {
      this.phase = 'retry';
      this.showBanner('¡Otra vez!', '', 900);
      this.time.delayedCall(1000, () => this.phase === 'retry' && this.loadLevel(this.info));
      return;
    }
    this.lives -= 1;
    if (this.lives <= 0) {
      if (this.run.mode === 'rush') {
        this.rushResults(false);
        return;
      }
      this.phase = 'gameover';
      this.endMs = 0;
      music.play(null);
      this.showBanner('¡Se acabaron las vidas!', 'A = intentarlo otra vez   ·   B = mapa', 0);
      return;
    }
    this.phase = 'retry';
    this.showBanner(`¡Uy! Quedan ${this.lives} ${this.lives === 1 ? 'vida' : 'vidas'}`, '', 1100);
    this.time.delayedCall(1300, () => {
      if (this.phase !== 'retry') return;
      this.loadLevel(this.info, { checkpoint: this.checkpoint, arenaStart: this.run.mode === 'rush' });
    });
  }

  // Lava (o chocolate) y picos.
  updateHazards() {
    for (const p of this.players) {
      if (!p.active) continue;
      const feet = tileAt(this.level, p.x, p.y - 6);
      const body = tileAt(this.level, p.x, p.y - p.h / 2);
      if (feet === 'L' || body === 'L') {
        if (p.peque && p.lastSafe) {
          const spot = p.safeSpot(this.level);
          Object.assign(p, { x: spot.x, y: spot.y - 4, vx: 0, vy: -300, invulnMs: 1500 });
          this.pequeRescue(p);
        } else {
          p.die();
        }
      } else if (feet === '^' || tileAt(this.level, p.x, p.y + 2) === '^') {
        if (p.hurt()) p.vy = -500;
      }
    }
  }

  // Los enemigos congelados son bloques de hielo: se pueden pisar.
  iceBlocksCarry(player) {
    player.onIce = false;
    if (player.vy < 0) return;
    for (const e of this.enemies) {
      if (!e.frozen || e.dead) continue;
      const top = e.y - e.h - 5;
      if (Math.abs(player.x - e.x) > (player.w + e.w) / 2 || player.y < top - 2 || player.y > top + Math.max(14, player.vy * 0.055)) continue;
      player.y = top;
      player.vy = 0;
      player.onGround = true;
      player.onIce = true;
      return;
    }
  }

  // ---------- Enemigos ----------

  nearestPlayer(x, y) {
    let best = null;
    let bestD = Infinity;
    for (const p of this.players) {
      if (!p.active) continue;
      const d = Math.hypot(p.x - x, p.y - y);
      if (d < bestD) [best, bestD] = [p, d];
    }
    return best;
  }

  spawnEnemy(key, x, y) {
    const enemy = new Enemy(this, key, x, y);
    enemy.awake = true;
    this.enemies.push(enemy);
    return enemy;
  }

  // Los cañones disparan balas hacia el jugador más cercano (si está en la pantalla).
  updateCannons(dt) {
    const cam = this.cameras.main;
    for (const cannon of this.cannons) {
      const x = cannon.col * T + T / 2;
      const y = (cannon.row + 1) * T;
      if (x < cam.scrollX - T || x > cam.scrollX + cam.width + T) continue;
      cannon.ms += dt;
      if (cannon.ms < CANNON.everyMs) continue;
      cannon.ms = 0;
      const target = this.nearestPlayer(x, y);
      if (!target || Math.abs(target.x - x) > CANNON.range || Math.abs(target.x - x) < T) continue;
      const dir = Math.sign(target.x - x);
      const bullet = this.spawnEnemy('bala', x + dir * T * 0.8, y - 6);
      bullet.launch(dir);
      sfx.boom();
      burst(this, x + dir * 26, y - 24, 0x9a9aae, 6);
    }
  }

  playerVsEnemies(dtMs) {
    const dt = dtMs / 1000;
    for (const p of this.players) {
      if (!p.active) continue;
      for (const e of this.enemies) {
        if (e.dead || e.gone || !e.awake || !overlaps(p, e, 4)) continue;
        const fromAbove = p.vy > 40 && p.y - (e.y - e.h) < Math.max(22, p.vy * dt + 12);
        // Gigante o con estrella: tumba todo lo que toca.
        if ((p.giantMs > 0 || p.starMs > 0) && !e.type.immune) {
          e.kill('star', Math.sign(e.x - p.x) || 1);
          sfx.hit(0.6);
          continue;
        }
        if (e.frozen) {
          // Bloque de hielo: desde arriba es piso (iceBlocksCarry); de lado se patea.
          if (!fromAbove && e.iceState !== 'slide') e.kickIce(Math.sign(e.x - p.x) || p.facing);
          continue;
        }
        if (e.type.safeTop && fromAbove) {
          p.y = e.y - e.h;
          p.bounce();
          continue;
        }
        if (e.type.kind === 'shell' && e.state !== 'slide') {
          e.kick(Math.sign(e.x - p.x) || p.facing, p);
          if (fromAbove) p.bounce();
          continue;
        }
        if (fromAbove && e.stompable) {
          this.stomp(p, e);
          continue;
        }
        if (!e.harmful) continue;
        // El caparazón que acabas de patear no te pega luego luego.
        if (e.type.kind === 'shell' && e.kickedBy === p && this.time.now - e.kickMs < 300) continue;
        if (p.hurt()) e.taunt();
      }
    }
  }

  stomp(player, enemy) {
    player.bounce();
    player.stats.stomps += 1;
    sfx.hit(0.5);
    popText(this, enemy.x, enemy.y - enemy.h - 20, '¡Pum!', '#ffffff');
    impact(this, enemy.x, enemy.y - enemy.h / 2, { power: 0.5, shake: false });
    if (enemy.type.stomp === 'shell') {
      const shell = this.spawnEnemy(enemy.type.shellAs ?? 'shell', enemy.x, enemy.y);
      shell.state = 'idle';
      enemy.remove();
    } else if (enemy.type.stomp === 'kick') {
      enemy.state = 'idle';
      enemy.vx = 0;
    } else if (enemy.type.stomp === 'collapse') {
      enemy.collapse();
    } else {
      enemy.kill('stomp');
    }
  }

  // Los caparazones (y los bloques de hielo) que van patinando tumban a los enemigos que encuentren.
  shellsVsEnemies() {
    for (const shell of this.enemies) {
      const sliding = (shell.type.kind === 'shell' && shell.state === 'slide' && !shell.frozen) || (shell.frozen && shell.iceState === 'slide');
      if (!sliding || shell.dead) continue;
      for (const e of this.enemies) {
        if (e === shell || e.dead || e.type.immune || !overlaps(shell, e)) continue;
        e.kill('shell', Math.sign(shell.vx) || 1);
        sfx.hit(0.6);
      }
    }
  }

  // Una bola de fuego o de hielo le pegó a algo (devuelve true para que desaparezca).
  fireballHits(f) {
    for (const e of this.enemies) {
      if (e.dead || e.gone || !e.awake || !overlaps(f, e)) continue;
      if (f.look === 'ice') {
        if (!e.frozen && e.freeze()) rewards.earn('plat-hielo');
      } else if (!e.type.immune && !e.type.fireproof) {
        e.kill('fire', Math.sign(f.vx) || 1);
        sfx.hit(0.4);
      }
      return true;
    }
    if (this.boss && !this.boss.dead && overlaps(f, this.boss)) {
      if (this.boss.fireHit()) this.bossDefeated();
      return true;
    }
    return false;
  }

  puff(x, y, color) {
    burst(this, x, y, color, 5);
  }

  // ---------- Batalla de monedas ----------

  updateBattle(dt) {
    const run = this.run;
    run.left -= dt;
    // Salen monedas en lugares al azar.
    run.coinMs += dt;
    if (run.coinMs > BATTLE.coinEveryMs && this.items.coins.length < BATTLE.maxCoins) {
      run.coinMs = 0;
      const spot = this.randomSpot();
      if (spot) this.items.addCoin(spot.x, spot.y);
    }
    // Brincarle encima a otro jugador le tumba monedas.
    for (const a of this.players) {
      for (const b of this.players) {
        if (a === b || !a.active || !b.active || b.invulnMs > 0 || a.vy <= 80 || !overlaps(a, b)) continue;
        if (a.y - (b.y - b.h) > 26) continue;
        a.bounce();
        const lost = Math.min(BATTLE.drop, b.battleCoins);
        b.battleCoins -= lost;
        b.invulnMs = 1500;
        b.look.flash();
        sfx.hit(0.7);
        popText(this, b.x, b.y - b.h - 20, lost ? `-${lost} 🪙` : '¡Pum!', '#ffd84d');
        for (let i = 0; i < lost; i += 1) {
          const spot = this.randomSpot();
          if (spot) this.items.addCoin(spot.x, spot.y);
        }
      }
    }
    if (run.left <= 0 && this.phase === 'play') this.battleResults();
  }

  // Un lugar libre arriba de algo pisable (para poner una moneda).
  randomSpot() {
    for (let tries = 0; tries < 30; tries += 1) {
      const col = 1 + Math.floor(Math.random() * (this.level.cols - 2));
      const row = 2 + Math.floor(Math.random() * 10);
      const below = this.level.at(col, row + 1);
      if (this.level.at(col, row) === ' ' && (isSolid(below) || below === '=')) return { x: col * T + T / 2, y: (row + 1) * T };
    }
    return null;
  }

  battleResults() {
    this.phase = 'results';
    this.endMs = 0;
    const ranking = [...this.players].sort((a, b) => b.battleCoins - a.battleCoins);
    const best = ranking[0].battleCoins;
    const winners = ranking.filter((p) => p.battleCoins === best);
    if (best > 0) rewards.earn('plat-batalla');
    confetti(this, winners.map((p) => p.color));
    const title = winners.length > 1 ? '¡Empate!' : `¡Ganó ${winners[0].label}!`;
    const lines = ranking.map((p, i) => `${['🥇', '🥈', '🥉', '4°'][i]}  ${p.label}: ${p.battleCoins} monedas`);
    this.showEndScreen(title, lines, 'A = otra batalla   ·   B = mapa');
    this.nextAction = 'battle';
  }

  // ---------- Jefe ----------

  updateBoss(dt) {
    const arena = this.level.arena;
    if (!arena) return;
    if (!this.bossFight && this.players.some((p) => p.active && p.x > (arena.left + 2) * T)) this.startBossFight();
    const boss = this.boss;
    if (!boss) return;
    boss.update(dt, this);
    if (boss.dead) return;
    for (const p of this.players) {
      if (!p.active || !overlaps(p, boss, 8)) continue;
      const fromAbove = p.vy > 40 && p.y - (boss.y - boss.h) < 40;
      if (fromAbove && boss.stompable) {
        p.vy = -900;
        const done = boss.stomped();
        const count = boss.maxHp - Math.ceil(boss.hp);
        popText(this, boss.x, boss.y - boss.h - 30, done ? '¡Ganaron!' : ['¡Uno!', '¡Dos!', '¡Tres!'][count - 1] ?? '¡Pum!', '#ffd84d');
        impact(this, boss.x, boss.y - boss.h, { power: done ? 2 : 1.3 });
        comicHit(this, boss.x + 50, boss.y - boss.h - 40, done ? '¡KO!' : randomPow(), { big: done });
        if (done) this.bossDefeated();
        else this.talk.line(['¡Bien! ¡Otra vez!', '¡Eso!', `¡Le duele a ${boss.type.name}!`]);
      } else if (fromAbove || boss.stunMs > 0) {
        p.vy = -500;
      } else if (p.starMs > 0 || p.giantMs > 0) {
        if (boss.fireHit()) this.bossDefeated();
        p.vx = Math.sign(p.x - boss.x) * 400;
      } else if (p.hurt()) {
        p.vx = Math.sign(p.x - boss.x) * 380;
        boss.taunt();
      }
    }
  }

  startBossFight() {
    const arena = this.level.arena;
    this.bossFight = true;
    for (const row of arena.door) {
      this.level.set(arena.left, row, 'X');
      this.drawTile(arena.left, row);
    }
    // Los que se quedaron atrás entran también.
    const inside = (arena.left + 2) * T;
    for (const p of this.players) if (p.state !== 'dead' && p.state !== 'off' && p.x < inside) Object.assign(p, { x: inside + 20, y: (arena.boss.row + 1) * T });
    const key = this.level.boss;
    const k = arena.boss;
    this.boss = new Boss(this, key, k.x, k.y, { left: (arena.left + 1) * T, right: arena.right * T });
    music.play('jefe');
    this.cameras.main.shake(300, 0.006);
    const name = BOSSES[key].name.replace(/^(el|la) /, (m) => m[0].toUpperCase() + m.slice(1));
    this.showBanner(`¡${name}!`, `Brínquenle encima ${this.boss.maxHp} veces`, 2000);
  }

  bossDefeated() {
    const boss = this.boss;
    // Cámara lenta y acercamiento al jefe vencido; luego fuegos artificiales y todos festejan.
    epicMoment(this, boss.x, boss.y - boss.h / 2, { zoom: 1.4, ms: 1300, slow: 0.25, hide: [this.hud, this.talk.caption], bounds: this.viewBounds() });
    this.time.delayedCall(1300, () => fireworks(this, this.players.map((p) => p.color), 4));
    for (const p of this.players) {
      p.look.dance(2600);
    }
    confetti(this, this.players.map((p) => p.color));
    this.cameras.main.shake(400, 0.012);
    this.talk.line(`¡Vencieron a ${this.boss.type.name}!`, { important: true });
    if (this.run.mode === 'rush') {
      this.time.delayedCall(1800, () => this.nextRushBoss());
      return;
    }
    this.time.delayedCall(1500, () => this.levelClear());
  }

  nextRushBoss() {
    if (this.phase !== 'play') return;
    this.run.step += 1;
    if (this.run.step >= this.run.list.length) {
      this.rushResults(true);
      return;
    }
    this.loadLevel(LEVELS[this.run.list[this.run.step]], { arenaStart: true });
  }

  rushResults(won) {
    this.phase = 'results';
    this.endMs = 0;
    music.play(null);
    const total = this.run.list.length;
    let title;
    const lines = [];
    if (won) {
      const record = progress.saveRush(this.run.ms);
      rewards.earn('plat-jefes');
      confetti(this, this.players.map((p) => p.color));
      title = '¡Vencieron a todos los jefes!';
      lines.push(`⏱️  Tiempo: ${formatTime(this.run.ms)}${record ? '   🏆 ¡Récord!' : ''}`);
    } else {
      title = `Llegaron al jefe ${this.run.step + 1} de ${total}`;
    }
    const best = progress.get().rushBest;
    if (best) lines.push(`🏆  Récord: ${formatTime(best)}`);
    this.showEndScreen(title, lines, 'A = otra vez   ·   B = mapa');
    this.nextAction = 'rush';
  }

  quake() {
    this.cameras.main.shake(300, 0.012);
    sfx.boom();
    for (const p of this.players) {
      if (!p.active || !p.onGround) continue;
      p.stunMs = 700;
      popText(this, p.x, p.y - p.h - 20, '¡Mareado!', '#ffffff');
    }
  }

  // El piso debajo de (x, fromY): donde empieza algo sólido con aire encima.
  groundY(x, fromY = 0) {
    const col = Math.floor(x / T);
    for (let row = Math.max(1, Math.floor(fromY / T)); row < ROWS; row += 1) if (isSolid(this.level.at(col, row)) && !isSolid(this.level.at(col, row - 1))) return row * T;
    return this.level.height;
  }

  say(text) {
    this.talk.line(text, { important: true });
  }

  // ---------- Banderín y meta ----------

  updateCheckpoints() {
    for (const c of this.checkpoints) {
      if (c.reached) continue;
      if (this.players.some((p) => p.active && p.x >= c.x)) this.reachCheckpoint(c);
    }
  }

  reachCheckpoint(c, { silent = false } = {}) {
    c.reached = true;
    c.flag.setFillStyle(0xffd84d);
    this.checkpoint = { x: c.x, y: c.y };
    if (silent) return;
    sfx.pickup();
    this.talk.line('¡Banderín! Si pierden, empiezan aquí');
  }

  checkGoal() {
    // (El cuarto secreto está pasando la bandera: ahí no cuenta.)
    const at = (goal) => goal && this.players.find((p) => p.active && Math.abs(p.x - goal.x) < 24 + p.w / 2 && p.y > goal.y - goal.height && p.y <= goal.y + 4 && !this.level.inBonus(p.x));
    const goal = this.goal;
    const passed = goal && this.players.find((p) => p.active && p.x >= goal.x - 12 && !this.level.inBonus(p.x));
    if (passed) {
      sfx.win();
      this.tweens.add({ targets: goal.flag, y: -40, duration: 900 });
      this.flagMoment(passed);
      this.levelClear({ delay: FLAG_EPIC_MS });
      return;
    }
    const secretBy = at(this.secretGoal);
    if (secretBy) {
      sfx.win();
      this.tweens.add({ targets: this.secretGoal.flag, y: -40, duration: 900 });
      this.flagMoment(secretBy);
      this.levelClear({ secret: true, delay: FLAG_EPIC_MS });
    }
  }

  // El que llegó a la bandera: cámara lenta con acercamiento y destellitos.
  flagMoment(player) {
    epicMoment(this, player.x, player.y - player.h, { zoom: 1.3, ms: FLAG_EPIC_MS, slow: 0.35, hide: [this.hud, this.talk.caption], bounds: this.viewBounds() });
    sparkles(this, player.x, player.y - player.h, 10, 70);
  }

  levelClear({ secret = false, delay = 0 } = {}) {
    if (this.phase !== 'play') return;
    this.phase = 'clear';
    this.clearMs = 0;
    this.secretExit = secret;
    for (const p of this.players) if (p.state === 'bubble') p.popBubble();
    music.play(null);
    // (Después del acercamiento a la bandera, si hubo.)
    this.time.delayedCall(delay, () => {
      if (this.phase !== 'clear') return;
      this.showBanner(secret ? '¡Bandera secreta!' : '¡Lo lograron!', '', 1800);
      fireworks(this, this.players.map((p) => p.color), 3);
      for (const p of this.players) p.look.dance(CLEAR_MS);
    });
    if (secret) rewards.earn('plat-secreta');
  }

  updateClear(dt) {
    this.clearMs += dt;
    // Todos festejan (los que estaban en burbuja también).
    for (const p of this.players) {
      if (p.state === 'dead' || p.state === 'off') continue;
      p.state = 'play';
      p.vx = 0;
      if (p.onGround && Math.floor(this.clearMs / 500) % 2 === 0) p.vy = -420;
      p.vy = Math.min(900, p.vy + 2200 * (dt / 1000));
      p.y += p.vy * (dt / 1000);
      const ground = this.groundY(p.x, p.y - p.h);
      if (p.y >= ground) {
        p.y = ground;
        p.vy = 0;
        p.onGround = true;
      } else p.onGround = false;
    }
    if (this.clearMs > CLEAR_MS) this.showResults();
  }

  showResults() {
    const mode = this.run.mode;
    if (mode === 'fight') {
      this.mapEnemies[this.mapState.world] = null;
      coinBank.add(FIGHT_REWARD);
      rewards.earn('plat-mapa');
      this.phase = 'results';
      this.endMs = 0;
      this.showEndScreen('¡Ganaron la batalla!', [`🪙  +${FIGHT_REWARD} monedas`], 'A = regresar al mapa');
      this.nextAction = 'map';
      return;
    }
    this.phase = 'results';
    this.endMs = 0;
    const info = this.info;
    const got = this.bigTaken.got.map((g, i) => g || progress.level(info.id).big[i]);
    const index = info.secret ? null : LEVELS.indexOf(info);
    const sourceOfSecret = this.secretExit && WORLDS[info.world].secret ? info.world : null;
    const result = progress.complete(info.id, { big: got, ms: this.levelMs, index, secretWorld: sourceOfSecret });
    rewards.earn('plat-bandera');
    if (result.allBig) rewards.earn('plat-monedas');
    const world = WORLDS[info.world];
    const lastOfWorld = !info.secret && info.index === world.levels.length - 1;
    if (lastOfWorld) rewards.earn(world.sticker);
    const lines = [`⏱️  Tiempo: ${formatTime(this.levelMs)}${result.record ? '   🏆 ¡Récord!' : ''}`];
    // Contrarreloj: ¿le ganaste a tu fantasma?
    if (mode === 'trial') {
      const ghost = ghosts.get(info.id);
      const beat = !ghost || this.levelMs < ghost.ms;
      if (beat) ghosts.save(info.id, { ms: Math.round(this.levelMs), path: this.recorder.samples });
      if (ghost && beat) rewards.earn('plat-fantasma');
      lines.push(ghost ? (beat ? `👻  ¡Le ganaste a tu fantasma! (${formatTime(ghost.ms)})` : `👻  Tu fantasma: ${formatTime(ghost.ms)}`) : '👻  Ahora tu fantasma correrá contigo');
    } else {
      lines.push(`🪙  Monedas: ${this.levelCoins}`, `🔵  Monedas grandes: ${got.map((g) => (g ? '●' : '○')).join(' ')}`);
    }
    if (result.secretOpened) lines.push('★  ¡Se abrió un nivel secreto en el mapa!');
    const title = lastOfWorld ? `¡Ganaron ${world.name}!` : this.secretExit ? '¡Bandera secreta!' : '¡Nivel superado!';
    const next = mode === 'level' && index !== null && index + 1 < LEVELS.length;
    this.nextLevel = next ? index + 1 : null;
    this.nextAction = next ? 'next' : 'map';
    const stats = this.players.filter((p) => p.state !== 'off').map((p) => `${p.label}: 🪙 ${p.stats.coins}  👟 ${p.stats.stomps}`);
    this.showEndScreen(title, [...lines, '', stats.join('      ')], next ? 'A = siguiente nivel   ·   B = mapa' : 'A = mapa', `${info.id}  ${info.spec.name}`);
    if (lastOfWorld) confetti(this, this.players.map((p) => p.color));
  }

  showEndScreen(title, lines, hint, subtitle = '') {
    const { width, height } = this.scale;
    const root = this.add.container(0, 0).setDepth(HUD_DEPTH + 3).setScrollFactor(0);
    root.add(this.add.rectangle(width / 2, height / 2, width, height, 0x14112b, 0.86));
    root.add(this.add.text(width / 2, 90, title, textStyle(52, TEXT.accent, { ...OUTLINE, strokeThickness: 10 })).setOrigin(0.5));
    if (subtitle) root.add(this.add.text(width / 2, 160, subtitle, textStyle(28, '#ffffff', OUTLINE)).setOrigin(0.5));
    root.add(this.add.text(width / 2, 340, lines.join('\n'), textStyle(26, '#ffffff', { ...OUTLINE, align: 'center', lineSpacing: 12 })).setOrigin(0.5));
    root.add(this.add.text(width / 2, height - 60, hint, textStyle(24, TEXT.accent, OUTLINE)).setOrigin(0.5));
    this.screen?.destroy();
    this.screen = root;
    say(title);
  }

  updateEndScreen(dt) {
    this.endMs += dt;
    if (this.endMs < END_SCREEN_DELAY_MS) return;
    const pressed = (button) => this.players.some((p) => controls.justPressed(p.deviceId, button));
    if (this.phase === 'gameover') {
      if (pressed('a')) {
        this.hideBanner();
        this.lives = this.startLives();
        this.loadLevel(this.info);
      } else if (pressed('b')) {
        this.hideBanner();
        this.openMap();
      }
      return;
    }
    if (!pressed('a') && !pressed('b')) return;
    const again = pressed('a');
    this.closeScreen();
    this.levelCoins = 0;
    if (again && this.nextAction === 'next') {
      this.syncMapNode(this.nextLevel);
      this.loadLevel(LEVELS[this.nextLevel]);
      return;
    }
    if (again && (this.nextAction === 'battle' || this.nextAction === 'rush')) {
      this.startRun(this.nextAction);
      return;
    }
    if (this.run.mode === 'level') this.syncMapNode(LEVELS.indexOf(this.info) + (this.nextAction === 'next' ? 1 : 0));
    this.openMap();
  }

  // Pone al equipo del mapa en el lugar del nivel `index`.
  syncMapNode(index) {
    const lv = LEVELS[Math.min(index, LEVELS.length - 1)];
    if (!lv) return;
    if (lv.world !== this.mapState.world) this.mapState = { world: lv.world, node: 0, enemy: null };
    const node = worldNodes(lv.world).findIndex((n) => n.kind === 'level' && n.index === LEVELS.indexOf(lv));
    if (node >= 0 && nodeOpen(lv.world, worldNodes(lv.world)[node])) this.mapState.node = node;
  }

  // ---------- Marcador ----------

  createHud() {
    const { width } = this.scale;
    const fixed = (o) => o.setScrollFactor(0).setDepth(HUD_DEPTH);
    this.hud = this.add.container(0, 0).setScrollFactor(0).setDepth(HUD_DEPTH);
    this.livesText = fixed(this.add.text(20, 14, '', textStyle(26, '#ffffff', OUTLINE)));
    this.waveText = fixed(this.add.text(width / 2, 14, '', textStyle(24, '#ffffff', OUTLINE)).setOrigin(0.5, 0));
    this.bigText = fixed(this.add.text(width - 20, 14, '', textStyle(26, '#ffd84d', OUTLINE)).setOrigin(1, 0));
    this.hud.add([this.livesText, this.waveText, this.bigText]);
    const bannerStyle = { fontStyle: 'bold', stroke: '#1b1530', strokeThickness: 10, align: 'center' };
    this.banner = fixed(this.add.text(width / 2, 250, '', textStyle(64, TEXT.accent, bannerStyle)).setOrigin(0.5).setDepth(HUD_DEPTH + 1).setAlpha(0));
    this.subBanner = fixed(this.add.text(width / 2, 320, '', textStyle(28, TEXT.normal, { ...bannerStyle, strokeThickness: 6 })).setOrigin(0.5).setDepth(HUD_DEPTH + 1).setAlpha(0));
    this.exitBar = fixed(this.add.rectangle(width / 2 - 100, this.scale.height - 8, 200, 6, 0xffffff).setOrigin(0, 0.5).setScale(0, 1));
  }

  updateHud() {
    const mode = this.run.mode;
    let left;
    let right;
    if (mode === 'battle') {
      left = `⏱️ ${Math.ceil(Math.max(0, this.run.left) / 1000)}`;
      right = this.players.map((p) => `${p.label} ${p.battleCoins}`).join('  ');
    } else if (mode === 'trial') {
      const ghost = ghosts.get(this.info.id);
      left = `⏱️ ${formatTime(this.levelMs)}`;
      right = ghost ? `👻 ${formatTime(ghost.ms)}` : '';
    } else if (mode === 'rush') {
      left = `❤️ ${this.lives}    ⏱️ ${formatTime(this.run.ms)}`;
      right = `👑 ${this.run.step + 1} de ${this.run.list.length}`;
    } else {
      const saved = this.info.id ? progress.level(this.info.id).big : [false, false, false];
      left = `❤️ ${this.lives}    🪙 ${this.coins}`;
      right = mode === 'fight' ? '' : this.bigTaken.got.map((g, i) => (g || saved[i] ? '●' : '○')).join(' ');
    }
    if (this.livesText.text !== left) {
      this.livesText.setText(left);
      bump(this, this.livesText, 1.15);
    }
    if (this.bigText.text !== right) this.bigText.setText(right);
    if (mode === 'battle') this.bigText.setColor(hexToCss(0xffd84d));
  }

  showBanner(title, subtitle = '', holdMs = 1300) {
    say(title);
    this.tweens.killTweensOf([this.banner, this.subBanner]);
    this.banner.setText(title).setAlpha(0).setScale(0.6);
    this.subBanner.setText(subtitle).setAlpha(0);
    bounceIn(this, this.banner, this.subBanner);
    this.tweens.add({ targets: this.subBanner, alpha: 1, duration: 250 });
    if (holdMs > 0) this.tweens.add({ targets: [this.banner, this.subBanner], alpha: 0, delay: holdMs, duration: 300 });
  }

  hideBanner() {
    this.tweens.killTweensOf([this.banner, this.subBanner]);
    this.banner.setAlpha(0);
    this.subBanner.setAlpha(0);
  }

  updateExit(dt) {
    const holding = this.players.some((p) => controls.holdingExit(p.deviceId));
    this.exitMs = holding ? this.exitMs + dt : 0;
    this.exitBar.setScale(Math.min(1, this.exitMs / EXIT_HOLD_MS), 1);
    if (this.exitMs >= EXIT_HOLD_MS) this.exit();
  }

  exit() {
    if (this.exiting) return;
    this.exiting = true;
    switches.red = true;
    go(this, 'Menu', { selected: this.returnData.selected });
  }
}

