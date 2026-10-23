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
import { TEXT, textStyle } from '../../ui/style.js';
import { FightTalk } from '../duelo/talk.js';
import { burst, confetti, popText } from '../brawl/effects.js';
import { loadSmashArt } from '../smash/art.js';
import { loadPlatArt, platTexture } from './art.js';
import { Boss, BOSSES } from './boss.js';
import { Dino } from './dino.js';
import { ENEMIES, Enemy } from './enemies.js';
import { Items, Platforms } from './items.js';
import { LEVELS, Level, WORLDS } from './levels.js';
import { formatTime, progress, showMap } from './map.js';
import { overlaps, tileAt } from './physics.js';
import { Player, STAR_MS } from './Player.js';
import { THEMES, T, ROWS, isSolid, themeTextures, tileTexture } from './tiles.js';

const HUD_DEPTH = 10000;
const CHUNK = 16;
const LIVES = { normal: 5, peque: 10 };
const BUBBLE_SPEED = 170;
const RESPAWN_MS = 1100;
const CLEAR_MS = 2600;
const END_SCREEN_DELAY_MS = 900;
const EXIT_HOLD_MS = 1200;
const OUTLINE = { fontStyle: 'bold', stroke: '#1b1530', strokeThickness: 5 };
const MULTI_COINS = 6;

// "Súper Bolitas": plataformas como Mario Bros para toda la familia, todos a la vez en la misma pantalla. Mapa con
// 4 mundos de 3 niveles (el tercero con jefe). Monedas, 3 monedas grandes escondidas por nivel, bloques sorpresa
// con poderes, tubos secretos, dinosaurio, burbujas para los que se caen y vidas para todo el equipo.
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
    this.boss = null;
    this.items = null;
    this.platforms = null;
    this.exitMs = 0;
    this.exiting = false;
    this.lives = this.startLives();
    this.mapIndex = Math.min(progress.get().unlocked, LEVELS.length - 1);
    this.createHud();
    this.talk = new FightTalk(this, this.scale.height - 60, HUD_DEPTH + 2);
    this.talk.caption.setScrollFactor(0);
    this.input.keyboard?.on('keydown-ESC', () => this.exit());
    this.openMap();
  }

  startLives() {
    return this.players.some((p) => p.peque) ? LIVES.peque : LIVES.normal;
  }

  // ---------- Mapa ----------

  openMap() {
    this.clearLevel();
    this.phase = 'map';
    this.hud.setVisible(false);
    this.talk.hide();
    this.cameras.main.setScroll(0, 0);
    music.play('plat');
    this.screen?.destroy();
    this.map = showMap(this, this.mapIndex, this.picks);
    this.screen = this.map.root;
  }

  updateMap() {
    const host = players.host();
    if (!host) return;
    const id = host.deviceId;
    const step = (controls.justPressed(id, 'right') ? 1 : 0) - (controls.justPressed(id, 'left') ? 1 : 0);
    if (step) {
      const next = this.map.selected + step;
      if (next >= 0 && next < LEVELS.length) {
        this.map.select(next);
        sfx.select();
      }
    }
    // Y: cada quien prende o apaga su modo peque.
    for (const p of this.players) {
      if (!controls.justPressed(p.deviceId, 'y')) continue;
      p.peque = progress.togglePeque(p.deviceId);
      this.map.refreshPeque();
      say(p.peque ? `${p.label}: modo peque` : `${p.label}: modo normal`);
      sfx.confirm();
    }
    if (controls.justPressed(id, 'a')) {
      if (!this.map.nodes[this.map.selected].open) {
        sfx.back();
        return;
      }
      sfx.confirm();
      this.mapIndex = this.map.selected;
      this.closeScreen();
      this.lives = this.startLives();
      for (const p of this.players) {
        p.fire = false;
        p.setSize('small');
      }
      this.startLevel(this.mapIndex);
    } else if (controls.justPressed(id, 'b')) {
      this.exit();
    }
  }

  closeScreen() {
    this.screen?.destroy();
    this.screen = null;
    this.map = null;
  }

  // ---------- Nivel ----------

  startLevel(index, { checkpoint = null } = {}) {
    this.clearLevel();
    this.levelIndex = index;
    this.info = LEVELS[index];
    const level = new Level(this.info.spec);
    this.level = level;
    this.keys = themeTextures(this, level.theme);
    this.drawBackground();
    this.drawTiles();
    this.items = new Items(this);
    this.platforms = new Platforms(this, level.theme);
    const saved = progress.level(this.info.id).big;
    this.bigTaken = this.bigTaken?.levelIndex === index ? this.bigTaken : { levelIndex: index, got: [false, false, false] };
    let bigIndex = 0;
    this.checkpoints = [];
    for (const e of level.entities) {
      if (e.ch === 'o') this.items.addCoin(e.x, e.y);
      else if (e.ch === 'O') {
        this.items.addBigCoin(e.x, e.y, bigIndex, saved[bigIndex] || this.bigTaken.got[bigIndex]);
        bigIndex += 1;
      } else if (e.ch === 'R') this.items.addSpring(e.x, e.y);
      else if ('muz'.includes(e.ch)) this.platforms.add(e.ch, e.col, e.row);
      else if (e.ch === 'D') this.dinos.push(new Dino(this, e.x, e.y));
      else if (ENEMIES[e.ch]) this.enemies.push(new Enemy(this, e.ch, e.x, e.y));
      else if (e.ch === 'C') this.checkpoints.push(this.drawCheckpoint(e));
      else if (e.ch === 'F') this.goal = this.drawGoal(e);
    }
    this.checkpoint = checkpoint;
    const start = checkpoint ?? level.start;
    this.players.forEach((p, i) => {
      p.spawn(start.x + i * 30, start.y);
      p.sprite.setVisible(true);
      p.dino = null;
    });
    if (checkpoint) for (const c of this.checkpoints) if (c.x <= checkpoint.x + 1) this.reachCheckpoint(c, { silent: true });
    this.levelMs = 0;
    this.levelCoins = this.levelCoins ?? 0;
    this.bossFight = false;
    this.cameras.main.setScroll(Phaser.Math.Clamp(start.x - 300, 0, this.areaRight() - this.scale.width), 0);
    this.cameras.main.setBackgroundColor(THEMES[level.theme]?.sky ?? 0x8fd3ff);
    this.phase = 'play';
    this.hud.setVisible(true);
    music.play('plat');
    this.waveText.setText(`${this.info.id}  ${level.name}`);
    this.showBanner(`${this.info.id} ${level.name}`, WORLDS[this.info.world].name, 1600);
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
    this.water?.destroy();
    this.water = null;
    for (const c of this.checkpoints ?? []) c.sprite.destroy();
    this.checkpoints = [];
    this.goal?.sprite.destroy();
    this.goal = null;
    for (const p of this.players ?? []) {
      p.sprite.setVisible(false);
      p.tag.setVisible(false);
      p.bubble.setVisible(false);
    }
  }

  // El fondo lejano: la imagen del mundo repetida, que se mueve más despacio que el nivel.
  drawBackground() {
    const level = this.level;
    const name = `plat:fondo-${level.background}`;
    const key = platTexture(this, name);
    this.background = this.add.container(0, 0).setDepth(-100).setScrollFactor(0.25, 0);
    if (!key) return;
    const probe = this.textures.get(key).getSourceImage();
    const scale = this.scale.height / probe.height;
    const w = probe.width * scale;
    const count = Math.ceil((level.width * 0.25 + this.scale.width) / w) + 1;
    for (let k = 0; k < count; k += 1) this.background.add(this.add.image(k * w, 0, key).setOrigin(0, 0).setScale(scale).setFlipX(k % 2 === 1));
    if (level.water) this.water = this.add.rectangle(0, 0, this.scale.width, this.scale.height, 0x1d6fb0, 0.22).setOrigin(0, 0).setScrollFactor(0).setDepth(70);
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
    // El de abajo cambia de "pasto" a "tierra" si se puso o quitó algo encima.
  }

  drawCheckpoint(e) {
    const g = this.add.container(e.x, e.y).setDepth(9);
    g.add(this.add.rectangle(0, -60, 6, 120, 0xdddddd).setStrokeStyle(2, 0x1b1530));
    const flag = this.add.triangle(3, -116, 0, 0, 40, 12, 0, 24, 0x8a86b8).setOrigin(0, 0).setStrokeStyle(3, 0x1b1530);
    g.add(flag);
    return { x: e.x, y: e.y, sprite: g, flag, reached: false };
  }

  drawGoal(e) {
    const g = this.add.container(e.x, e.y).setDepth(9);
    const height = 8 * T;
    g.add(this.add.rectangle(0, -height / 2, 10, height, 0xe8e8f0).setStrokeStyle(3, 0x1b1530));
    g.add(this.add.circle(0, -height - 8, 12, 0xffd84d).setStrokeStyle(3, 0x1b1530));
    const flag = this.add.triangle(5, -height + 6, 0, 0, 64, 22, 0, 44, 0x4cd97b).setOrigin(0, 0).setStrokeStyle(4, 0x1b1530);
    g.add(flag);
    g.add(this.add.rectangle(0, -10, 40, 20, 0x8a8a9e).setStrokeStyle(3, 0x1b1530));
    return { x: e.x, y: e.y, height, sprite: g, flag };
  }

  // Hasta dónde llega la pantalla: el nivel normal, el cuarto secreto o la arena del jefe.
  areaLeft() {
    if (this.bossFight) return this.level.arena.left * T + (this.level.arena.right - this.level.arena.left + 1) * T / 2 - this.scale.width / 2;
    if (this.inBonus()) return this.level.bonus * T;
    return 0;
  }

  areaRight() {
    if (this.bossFight) return this.areaLeft() + this.scale.width;
    if (this.level.bonus !== undefined && !this.inBonus()) return this.level.bonus * T;
    return this.level.width;
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
    if (this.phase === 'map') {
      this.updateMap();
      return;
    }
    if (['results', 'gameover'].includes(this.phase)) {
      this.updateEndScreen(dt);
      return;
    }
    if (this.phase === 'play' || this.phase === 'clear') this.levelMs += this.phase === 'play' ? dt : 0;
    if (this.phase === 'clear') {
      this.updateClear(dt);
      this.renderAll();
      return;
    }
    this.platforms.update(dt);
    for (const p of this.players) {
      if (p.state === 'bubble') this.updateBubble(p, dt);
      else p.update(dt, this.level);
    }
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
    this.playerVsEnemies(dt);
    this.shellsVsEnemies();
    this.updateBoss(dt);
    this.updateCheckpoints();
    this.updateDeaths();
    this.updateCamera(dt);
    this.renderAll();
    this.updateHud();
    if (this.phase === 'play') this.checkGoal();
  }

  renderAll() {
    for (const p of this.players) p.render();
    for (const d of this.dinos) d.render();
    for (const e of this.enemies) e.render();
    this.boss?.render();
    // Solo se dibujan los pedazos del nivel que se ven.
    const cam = this.cameras.main;
    for (const chunk of this.layer) chunk.container.setVisible(chunk.x1 > cam.scrollX - T && chunk.x0 < cam.scrollX + cam.width + T);
  }

  updateCamera(dt) {
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
    if (!'Bb?MSYH'.includes(ch)) return;
    // Los enemigos parados encima del bloque salen volando.
    for (const e of this.enemies) {
      if (!e.dead && Math.abs(e.x - (col * T + T / 2)) < T && Math.abs(e.y - row * T) < 8) e.kill('bump', Math.sign(e.x - player.x) || 1);
    }
    const used = () => {
      level.set(col, row, 'U');
      this.drawTile(col, row);
    };
    if (ch === 'B') {
      if (player.big) {
        level.set(col, row, ' ');
        this.drawTile(col, row);
        this.drawTile(col, row + 1);
        this.items.breakBits(col, row, this.keys);
        sfx.boom();
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
    if (ch === 'M') this.items.spawnPower(player.big ? 'flor' : 'hongo', col, row);
    else if (ch === 'S') this.items.spawnPower('estrella', col, row);
    else if (ch === 'H') {
      this.items.spawnPower('vida', col, row);
      this.talk.line('¡Un bloque escondido!', { important: true });
    } else if (ch === 'Y') {
      const dino = new Dino(this, col * T + T / 2, row * T);
      dino.vy = -500;
      this.dinos.push(dino);
      burst(this, col * T + T / 2, row * T - 20, 0x4cd97b, 12);
      this.talk.line('¡Un dinosaurio! ¡Súbete!', { important: true });
    }
  }

  wobbleTile(col, row) {
    const image = this.tileImages.get(`${col},${row}`);
    if (!image) return;
    this.tweens.add({ targets: image, y: row * T - 12, duration: 70, yoyo: true });
  }

  // ---------- Jugadores ----------

  // X: bola de fuego (con la flor) o lengüetazo (en el dinosaurio).
  action(player) {
    if (player.dino) {
      const area = player.dino.lick();
      for (const e of this.enemies) {
        if (e.dead || e.type.immune || !overlaps(area, e)) continue;
        e.kill('tongue');
        this.coinTaken(player);
        popText(this, e.x, e.y - 60, '¡Ñam!', '#ffd84d');
      }
      return;
    }
    if (player.fire && this.items.fireball(player)) player.throwMs = 200;
  }

  coinTaken(player) {
    player.stats.coins += 1;
    this.levelCoins += 1;
    this.coins = (this.coins ?? 0) + 1;
    sfx.coin();
    // Cada 50 monedas, una vida.
    if (this.coins % 50 === 0) this.addLife(player);
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
    if (kind === 'hongo') {
      player.grow();
      this.talk.line(['¡Creció!', `¡${player.label} está grandote!`]);
    } else if (kind === 'flor') {
      player.getFire();
      this.talk.line('¡Fuego! Aprieta X', { important: true });
    } else if (kind === 'estrella') {
      player.starMs = STAR_MS;
      sfx.star();
      rewards.earn('plat-estrella');
      this.talk.line('¡Estrella! ¡Nadie te puede pegar!', { important: true });
    } else if (kind === 'vida') {
      this.addLife(player);
    }
  }

  pequeRescue(player) {
    popText(this, player.x, player.y - player.h - 20, '¡Boing!', '#ffd84d');
    sfx.boing();
  }

  mounted(player) {
    rewards.earn('plat-dino');
    this.talk.line([`¡${player.label} se subió al dinosaurio!`, '¡Arre, dinosaurio!']);
  }

  dinoRunsAway(player, { silent = false } = {}) {
    player.dino?.runAway();
    if (!silent) popText(this, player.x, player.y - player.h - 20, '¡Se asustó!', '#ffffff');
  }

  // Abajo en la boca de un tubo secreto: todos se van por el tubo.
  tryWarp(player) {
    if (this.warping) return;
    const warp = this.level.warps.find((w) => player.x > w.enter.col * T && player.x < (w.enter.col + 2) * T && Math.abs(player.y - w.enter.row * T) < 4);
    if (!warp) return;
    this.warping = true;
    sfx.powerDown();
    this.cameras.main.fadeOut(220, 0, 0, 0);
    this.time.delayedCall(240, () => {
      this.players.forEach((p, i) => {
        if (p.state === 'dead') return;
        p.x = warp.exit.x + i * 26;
        p.y = warp.exit.y;
        p.vx = 0;
        p.vy = 0;
        if (p.state === 'bubble') p.popBubble();
      });
      for (const d of this.dinos) if (d.rider) Object.assign(d, { x: d.rider.x, y: d.rider.y });
      this.cameras.main.setScroll(Phaser.Math.Clamp(warp.exit.x - this.scale.width / 2, this.areaLeft(), Math.max(this.areaLeft(), this.areaRight() - this.scale.width)), 0);
      this.cameras.main.fadeIn(260, 0, 0, 0);
      this.warping = false;
      if (this.level.inBonus(warp.exit.x)) {
        rewards.earn('plat-secreto');
        this.talk.line('¡Un cuarto secreto!', { important: true });
      }
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
    }
  }

  playerDied(player) {
    this.deathAt = this.time.now;
    if (this.players.some((p) => p.active)) this.talk.line([`¡Ayuden a ${player.label}! ¡Toquen su burbuja!`, `¡${player.label} se cayó!`], { important: true });
  }

  // Los que cayeron: si quedan compañeros regresan en burbuja; si no queda nadie, se pierde una vida.
  updateDeaths() {
    if (this.phase !== 'play') return;
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
    this.lives -= 1;
    if (this.lives <= 0) {
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
      const checkpoint = this.checkpoint;
      this.startLevel(this.levelIndex, { checkpoint });
    });
  }

  // Lava y picos.
  updateHazards() {
    for (const p of this.players) {
      if (!p.active) continue;
      const feet = tileAt(this.level, p.x, p.y - 6);
      const body = tileAt(this.level, p.x, p.y - p.h / 2);
      if (feet === 'L' || body === 'L') {
        if (p.peque && p.lastSafe) {
          Object.assign(p, { x: p.lastSafe.x, y: p.lastSafe.y - 4, vx: 0, vy: -300, invulnMs: 1500 });
          this.pequeRescue(p);
        } else {
          p.die();
        }
      } else if (feet === '^' || tileAt(this.level, p.x, p.y + 2) === '^') {
        if (p.hurt()) p.vy = -500;
      }
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

  playerVsEnemies(dtMs) {
    const dt = dtMs / 1000;
    for (const p of this.players) {
      if (!p.active) continue;
      for (const e of this.enemies) {
        if (e.dead || e.gone || !e.awake || !overlaps(p, e, 4)) continue;
        const fromAbove = p.vy > 40 && p.y - (e.y - e.h) < Math.max(22, p.vy * dt + 12);
        if (e.type.safeTop && fromAbove) {
          p.y = e.y - e.h;
          p.bounce();
          continue;
        }
        if (p.starMs > 0 && !e.type.immune) {
          e.kill('star', Math.sign(e.x - p.x) || 1);
          sfx.hit(0.6);
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
        p.hurt();
      }
    }
  }

  stomp(player, enemy) {
    player.bounce();
    player.stats.stomps += 1;
    sfx.hit(0.5);
    popText(this, enemy.x, enemy.y - enemy.h - 20, '¡Pum!', '#ffffff');
    if (enemy.type.stomp === 'shell') {
      const shell = this.spawnEnemy('shell', enemy.x, enemy.y);
      shell.state = 'idle';
      enemy.remove();
    } else if (enemy.type.stomp === 'kick') {
      enemy.state = 'idle';
      enemy.vx = 0;
    } else {
      enemy.kill('stomp');
    }
  }

  // Los caparazones que van patinando tumban a los enemigos que encuentren.
  shellsVsEnemies() {
    for (const shell of this.enemies) {
      if (shell.type.kind !== 'shell' || shell.state !== 'slide' || shell.dead) continue;
      for (const e of this.enemies) {
        if (e === shell || e.dead || e.type.immune || !overlaps(shell, e)) continue;
        e.kill('shell', Math.sign(shell.vx) || 1);
        sfx.hit(0.6);
      }
    }
  }

  // Una bola de fuego le pegó a algo (devuelve true para que desaparezca).
  fireballHits(f) {
    for (const e of this.enemies) {
      if (e.dead || e.gone || !e.awake || !overlaps(f, e)) continue;
      if (!e.type.immune) {
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
        popText(this, boss.x, boss.y - boss.h - 30, done ? '¡Ganaron!' : ['¡Uno!', '¡Dos!', '¡Tres!'][2 - Math.ceil(boss.hp)] ?? '¡Pum!', '#ffd84d');
        if (done) this.bossDefeated();
        else this.talk.line(['¡Bien! ¡Otra vez!', '¡Eso!', `¡Le duele a ${boss.type.name}!`]);
      } else if (fromAbove || boss.stunMs > 0) {
        p.vy = -500;
      } else if (p.starMs > 0) {
        if (boss.fireHit()) this.bossDefeated();
        p.vx = Math.sign(p.x - boss.x) * 400;
      } else if (p.hurt()) {
        p.vx = Math.sign(p.x - boss.x) * 380;
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
    for (const p of this.players) if (p.state !== 'dead' && p.x < inside) Object.assign(p, { x: inside + 20, y: (arena.boss.row + 1) * T });
    const key = this.level.boss;
    const k = arena.boss;
    this.boss = new Boss(this, key, k.x, k.y, { left: (arena.left + 1) * T, right: arena.right * T });
    music.play('jefe');
    this.cameras.main.shake(300, 0.006);
    this.showBanner(`¡${BOSSES[key].name.replace(/^el /, 'El ')}!`, 'Brínquenle encima 3 veces', 2000);
  }

  bossDefeated() {
    confetti(this, this.players.map((p) => p.color));
    this.cameras.main.shake(400, 0.012);
    this.talk.line(`¡Vencieron a ${this.boss.type.name}!`, { important: true });
    this.time.delayedCall(1500, () => this.levelClear());
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
    const goal = this.goal;
    if (!goal) return;
    // (El cuarto secreto está pasando la bandera: ahí no cuenta.)
    const winner = this.players.find((p) => p.active && p.x >= goal.x - 12 && !this.level.inBonus(p.x));
    if (!winner) return;
    sfx.win();
    this.tweens.add({ targets: goal.flag, y: -40, duration: 900 });
    this.levelClear(winner);
  }

  levelClear() {
    if (this.phase !== 'play') return;
    this.phase = 'clear';
    this.clearMs = 0;
    for (const p of this.players) if (p.state === 'bubble') p.popBubble();
    music.play(null);
    this.showBanner('¡Lo lograron!', '', 1800);
  }

  updateClear(dt) {
    this.clearMs += dt;
    // Todos festejan (los que estaban en burbuja también).
    for (const p of this.players) {
      if (p.state === 'dead') continue;
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
    this.phase = 'results';
    this.endMs = 0;
    const info = this.info;
    const got = this.bigTaken.got.map((g, i) => g || progress.level(info.id).big[i]);
    const result = progress.complete(this.levelIndex, { big: got, ms: this.levelMs });
    rewards.earn('plat-bandera');
    if (result.allBig) rewards.earn('plat-monedas');
    const world = WORLDS[info.world];
    const lastOfWorld = info.index === world.levels.length - 1;
    if (lastOfWorld) rewards.earn(world.sticker);
    const { width, height } = this.scale;
    const root = this.add.container(0, 0).setDepth(HUD_DEPTH + 3).setScrollFactor(0);
    root.add(this.add.rectangle(width / 2, height / 2, width, height, 0x14112b, 0.86));
    const title = lastOfWorld ? `¡Ganaron ${world.name}!` : '¡Nivel superado!';
    root.add(this.add.text(width / 2, 90, title, textStyle(54, TEXT.accent, { ...OUTLINE, strokeThickness: 10 })).setOrigin(0.5));
    root.add(this.add.text(width / 2, 165, `${info.id}  ${info.spec.name}`, textStyle(28, '#ffffff', OUTLINE)).setOrigin(0.5));
    const lines = [
      `⏱️  Tiempo: ${formatTime(this.levelMs)}${result.record ? '   🏆 ¡Récord!' : ''}`,
      `🪙  Monedas: ${this.levelCoins}`,
      `🔵  Monedas grandes: ${got.map((g) => (g ? '●' : '○')).join(' ')}`,
    ];
    root.add(this.add.text(width / 2, 300, lines.join('\n'), textStyle(28, '#ffffff', { ...OUTLINE, align: 'center', lineSpacing: 14 })).setOrigin(0.5));
    const stats = this.players.map((p) => `${p.label}: 🪙 ${p.stats.coins}  👟 ${p.stats.stomps}`).join('      ');
    root.add(this.add.text(width / 2, 450, stats, textStyle(22, '#ffd84d', OUTLINE)).setOrigin(0.5));
    const next = this.levelIndex + 1 < LEVELS.length;
    this.nextLevel = next ? this.levelIndex + 1 : null;
    root.add(this.add.text(width / 2, height - 60, next ? 'A = siguiente nivel   ·   B = mapa' : 'A = mapa', textStyle(24, TEXT.accent, OUTLINE)).setOrigin(0.5));
    this.screen = root;
    say(`${title} ${result.record ? '¡Récord!' : ''}`.trim());
    if (lastOfWorld) confetti(this, this.players.map((p) => p.color));
  }

  updateEndScreen(dt) {
    this.endMs += dt;
    if (this.endMs < END_SCREEN_DELAY_MS) return;
    const pressed = (button) => this.players.some((p) => controls.justPressed(p.deviceId, button));
    if (this.phase === 'gameover') {
      if (pressed('a')) {
        this.hideBanner();
        this.lives = this.startLives();
        this.startLevel(this.levelIndex);
      } else if (pressed('b')) {
        this.hideBanner();
        this.openMap();
      }
      return;
    }
    if (pressed('a') && this.nextLevel !== null) {
      this.closeScreen();
      this.mapIndex = this.nextLevel;
      this.levelCoins = 0;
      this.startLevel(this.nextLevel);
    } else if (pressed('a') || pressed('b')) {
      this.mapIndex = this.nextLevel ?? this.levelIndex;
      this.levelCoins = 0;
      this.openMap();
    }
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
    const text = `❤️ ${this.lives}    🪙 ${this.coins ?? 0}`;
    if (this.livesText.text !== text) this.livesText.setText(text);
    const saved = progress.level(this.info.id).big;
    const big = this.bigTaken.got.map((g, i) => (g || saved[i] ? '●' : '○')).join(' ');
    if (this.bigText.text !== big) this.bigText.setText(big);
  }

  showBanner(title, subtitle = '', holdMs = 1300) {
    say(title);
    this.tweens.killTweensOf([this.banner, this.subBanner]);
    this.banner.setText(title).setAlpha(0).setScale(0.6);
    this.subBanner.setText(subtitle).setAlpha(0);
    this.tweens.add({ targets: this.banner, alpha: 1, scale: 1, duration: 250, ease: 'Back.easeOut' });
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
    this.scene.start('Menu', { selected: this.returnData.selected });
  }
}
