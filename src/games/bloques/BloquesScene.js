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
import { COLORS, TEXT, hexToCss, textStyle } from '../../ui/style.js';
import { burst, popText, sparkles } from '../brawl/effects.js';
import { loadSmashArt } from '../smash/art.js';
import { bloquesLandscape, bloquesObject, loadBloquesArt } from './art.js';
import { B, BLOCKS, DEEP_WATER, T, TILES, TILESET, dropOf, frameOf, makeBlockTextures } from './blocks.js';
import { BlockPlayer, INVULN_MS, MAX_HEARTS } from './BlockPlayer.js';
import { CraftMenu, craft, missing } from './crafting.js';
import { Animal, Slime, bodiesTouch } from './critters.js';
import { cellOverlaps, touches } from './physics.js';
import { SLOTS, clearSlot, lastOptions, loadSlots, newSeed, rememberOptions, saveSlot } from './save.js';
import { breakSound, digTick, placeSound, pickupSound, slimeSound } from './sounds.js';
import { COLS, ROWS, World } from './world.js';

// "Mundo de bloques": un mundo de cuadritos estilo Minecraft visto de lado, para todos juntos en la misma pantalla.
// Stick = caminar (y apuntar), A = brincar, mantener X = escarbar el bloque marcado (lo que sale se recoge solito),
// B = poner el bloque escogido, LB / RB = escoger bloque de la barrita, Y = hacer cosas (tablas, mesa, antorchas,
// escalera, puerta, cama, vidrio, ladrillos; de noche, junto a una cama, Y = dormir).
// Creativo: todos los bloques sin fin y A dos veces = volar. Aventura: hay que juntar los bloques y cuidar los
// corazones (las caídas muy altas y los slimes de la noche quitan uno). El mundo (3 ranuras) se guarda solo.
// (Los animalitos van en 40-41, los jugadores en 50 y sus letreros J1... en 80: ver critters.js y BlockPlayer.js.)
const DEPTH = { back: 0, front: 10, drop: 45, player: 50, aim: 55, night: 60, glow: 65 };
const EXIT_HOLD_MS = 1200;
const SETUP_ROWS = ['slot', 'mode', 'monsters', 'restart'];
// La cámara: qué tanto se aleja como máximo para que quepan todos, y el margen alrededor del grupo.
const MIN_ZOOM = 0.62;
const VIEW_MARGIN = { x: 360, y: 300 };
// Si alguien se queda fuera de la pantalla: primero se le jala, y si sigue lejos aparece junto a los demás.
const PULL = 0.8;
const TELEPORT_MS = 1600;
// El día dura 5 minutos: de día, atardecer, noche y amanecer (fracciones del día).
const DAY_MS = 300000;
const DUSK = [0.56, 0.63];
const DAWN = [0.93, 1];
const MORNING = 0.03;
const SKY = { day: 0x8fd3ff, dusk: 0xff9f6b, night: 0x1b2550 };
const NIGHT_SHADE = 0.42;
// Los slimes de la noche: cuántos a la vez (más uno por jugador) y cada cuánto sale uno.
const SLIME_MAX = 3;
const SLIME_EVERY_MS = 5000;
const SLIME_PUSH = { x: 420, y: 330 };
const REACH = 76;
const SAVE_EVERY_MS = 20000;
const DIG_TICK_MS = 220;
const DROP_FLY_MS = 260;
const HELP_MS = 12000;
// Lo que cuenta como "casita": una cama con techo (algo sólido arriba) y una puerta cerca.
const HOUSE = { roof: 6, doorCols: 8, doorRows: 3 };
// El agua que corre al abrirle un hueco: cada cuánto avanza un cuadrito y hasta cuántos.
const FLOW = { stepMs: 110, budget: 30 };

function mix(a, b, t) {
  const channel = (shift) => Math.round(((a >> shift) & 0xff) + (((b >> shift) & 0xff) - ((a >> shift) & 0xff)) * t);
  return (channel(16) << 16) | (channel(8) << 8) | channel(0);
}

// Qué tan de noche es (0 = día, 1 = noche) a esta hora (0 a 1 del día).
export function nightFactor(phase) {
  if (phase < DUSK[0]) return 0;
  if (phase < DUSK[1]) return (phase - DUSK[0]) / (DUSK[1] - DUSK[0]);
  if (phase < DAWN[0]) return 1;
  return 1 - (phase - DAWN[0]) / (DAWN[1] - DAWN[0]);
}

export class BloquesScene extends Phaser.Scene {
  constructor() {
    super('Bloques');
  }

  init(data) {
    this.returnData = data ?? {};
    this.exitMs = 0;
    this.exiting = false;
  }

  preload() {
    loadSmashArt(this);
    loadBloquesArt(this);
  }

  create() {
    makeBlockTextures(this);
    this.makeExtraTextures();
    this.humans = players.sorted();
    this.options = lastOptions();
    this.slots = loadSlots();
    this.phase = 'setup';
    this.blockPlayers = [];
    this.animals = [];
    this.slimes = [];
    this.drops = [];
    this.flow = [];
    this.glows = new Map();
    this.said = new Set();
    this.setupCameras();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.cleanUp());
    this.showSetup();
  }

  // Tres cámaras: el cielo (atrás, sin acercar), el mundo (sigue al grupo y se aleja si hace falta) y los letreros
  // (adelante, sin acercar). Todo lo que no es cielo ni letrero va en la del mundo (ver sortCameras).
  setupCameras() {
    const { width, height } = this.scale;
    this.cam = this.cameras.main;
    this.skyCam = this.cameras.add(0, 0, width, height);
    const list = this.cameras.cameras;
    list.splice(list.indexOf(this.skyCam), 1);
    list.unshift(this.skyCam);
    this.uiCam = this.cameras.add(0, 0, width, height);
    this.sky = this.add.container(0, 0);
    this.ui = this.add.container(0, 0);
    this.cam.ignore([this.sky, this.ui]);
    this.skyCam.ignore(this.ui);
    this.uiCam.ignore(this.sky);
    this.skyCam.setBackgroundColor(SKY.day);
    this.sortCameras();
  }

  sortCameras() {
    const skyId = this.skyCam.id;
    const uiId = this.uiCam.id;
    for (const obj of this.children.list) {
      if (obj === this.sky || obj === this.ui) continue;
      if (!(obj.cameraFilter & skyId)) obj.cameraFilter |= skyId;
      if (!(obj.cameraFilter & uiId)) obj.cameraFilter |= uiId;
    }
  }

  // El brillo de las antorchas y el pico (si no hay dibujo de Gemini).
  makeExtraTextures() {
    if (!this.textures.exists('bloques:glow')) {
      const size = 256;
      const texture = this.textures.createCanvas('bloques:glow', size, size);
      const ctx = texture.context;
      const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
      gradient.addColorStop(0, 'rgba(255, 220, 140, 0.9)');
      gradient.addColorStop(0.4, 'rgba(255, 180, 90, 0.35)');
      gradient.addColorStop(1, 'rgba(255, 160, 60, 0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, size, size);
      texture.refresh();
    }
    if (!this.textures.exists('bloques:pico-dibujo')) {
      const g = this.make.graphics({ x: 0, y: 0 }, false);
      g.fillStyle(0x8a5a2c).fillRect(19, 10, 6, 34);
      g.lineStyle(3, 0x1b1530).strokeRect(19, 10, 6, 34);
      g.fillStyle(0x9fe8ef).beginPath();
      g.moveTo(2, 14).lineTo(22, 4).lineTo(42, 14).lineTo(36, 16).lineTo(22, 10).lineTo(8, 16).closePath().fillPath();
      g.lineStyle(3, 0x1b1530).strokePath();
      g.generateTexture('bloques:pico-dibujo', 44, 46);
      g.destroy();
    }
  }

  // ---------- Antes de jugar: qué mundo, qué modo y si salen monstruitos ----------
  showSetup() {
    this.phase = 'setup';
    this.phaseMs = 0;
    const { width, height } = this.scale;
    this.screen?.destroy();
    this.screen = this.add.container(0, 0);
    this.ui.add(this.screen);
    this.screen.add(this.add.rectangle(width / 2, height / 2, width, height, 0x14112b, 0.92));
    this.screen.add(this.add.text(width / 2, 110, '⛏️ Mundo de bloques', textStyle(58, TEXT.normal, { fontStyle: 'bold' })).setOrigin(0.5));
    this.setupRow = 0;
    this.setupTexts = SETUP_ROWS.map((_, i) => {
      const bg = this.add.rectangle(width / 2, 230 + i * 72, 760, 58, COLORS.panel).setRounded(16);
      const text = this.add.text(width / 2, 230 + i * 72, '', textStyle(26, TEXT.normal, { fontStyle: 'bold' })).setOrigin(0.5);
      this.screen.add([bg, text]);
      return { bg, text };
    });
    const people = this.humans.map((p) => `J${p.slot + 1}`).join(', ');
    this.screen.add(this.add.text(width / 2, 540, `Juegan: ${people}`, textStyle(24)).setOrigin(0.5));
    this.screen.add(this.add.text(width / 2, 630, '↑ ↓ elegir  ·  ◀ ▶ cambiar  ·  A = ¡a jugar!  ·  B = regresar', textStyle(22, TEXT.accent)).setOrigin(0.5));
    this.restart = false;
    this.syncSlotOptions();
    this.refreshSetup();
    say('Mundo de bloques');
  }

  get savedSlot() {
    return this.slots[this.options.slot];
  }

  // Un mundo guardado trae su modo y sus monstruitos.
  syncSlotOptions() {
    const saved = this.savedSlot;
    if (saved && !this.restart) Object.assign(this.options, { mode: saved.mode, monsters: saved.monsters });
  }

  get visibleRows() {
    return this.savedSlot ? SETUP_ROWS : SETUP_ROWS.filter((row) => row !== 'restart');
  }

  refreshSetup() {
    const saved = this.savedSlot;
    const slotLabel = saved && !this.restart ? `guardado, ${saved.mode === 'aventura' ? 'Aventura' : 'Creativo'}` : 'nuevo';
    const labels = {
      slot: `Mundo ${this.options.slot + 1} (${slotLabel})`,
      mode: `Modo: ${this.options.mode === 'aventura' ? 'Aventura (junta bloques)' : 'Creativo (todos los bloques)'}`,
      monsters: `Slimes de noche: ${this.options.monsters ? 'Sí' : 'No'}`,
      restart: `Hacer este mundo de nuevo: ${this.restart ? 'Sí (se borra el guardado)' : 'No'}`,
    };
    const rows = this.visibleRows;
    this.setupTexts.forEach(({ bg, text }, i) => {
      const row = rows[i];
      bg.setVisible(Boolean(row));
      text.setVisible(Boolean(row));
      if (!row) return;
      text.setText(labels[row]);
      bg.setStrokeStyle(i === this.setupRow ? 4 : 2, i === this.setupRow ? COLORS.accent : COLORS.panelBorder);
    });
  }

  updateSetup() {
    const host = players.host();
    if (!host) return;
    const id = host.deviceId;
    const rows = this.visibleRows;
    const rowStep = controls.justPressed(id, 'down') ? 1 : controls.justPressed(id, 'up') ? -1 : 0;
    if (rowStep) {
      this.setupRow = (this.setupRow + rowStep + rows.length) % rows.length;
      sfx.select();
      this.refreshSetup();
    }
    const step = controls.justPressed(id, 'right') ? 1 : controls.justPressed(id, 'left') ? -1 : 0;
    if (step) {
      const row = rows[this.setupRow];
      if (row === 'slot') {
        this.options.slot = (this.options.slot + step + SLOTS) % SLOTS;
        this.restart = false;
        this.syncSlotOptions();
        this.setupRow = Math.min(this.setupRow, this.visibleRows.length - 1);
      } else if (row === 'mode') {
        this.options.mode = this.options.mode === 'aventura' ? 'creativo' : 'aventura';
      } else if (row === 'monsters') {
        this.options.monsters = !this.options.monsters;
      } else {
        this.restart = !this.restart;
      }
      sfx.select();
      this.refreshSetup();
    }
    if (this.phaseMs < 300) return;
    if (controls.justPressed(id, 'a')) {
      sfx.confirm();
      rememberOptions(this.options);
      this.screen.destroy();
      this.screen = null;
      this.startWorld();
    } else if (controls.justPressed(id, 'b')) {
      this.exit();
    }
  }

  // ---------- El mundo ----------
  startWorld() {
    const saved = this.restart ? null : this.savedSlot;
    if (this.restart) clearSlot(this.options.slot);
    this.creative = this.options.mode !== 'aventura';
    this.monsters = this.options.monsters;
    this.seed = saved?.seed ?? newSeed();
    this.world = new World(this.seed);
    if (saved) this.world.applyChanges(saved.changes);
    this.dayMs = (saved?.time ?? MORNING) * DAY_MS;
    this.buildMap();
    this.buildSky();
    const spawn = this.world.spawn();
    this.spawnPoint = { x: spawn.col * T + T / 2, y: (spawn.row + 1) * T };
    this.blockPlayers = this.humans.map((player, i) => {
      const character = characterPicks.get(player.deviceId, defaultCharacter(player));
      const p = new BlockPlayer(this, player, character, { creative: this.creative });
      p.x = this.spawnPoint.x + (i - (this.humans.length - 1) / 2) * 40;
      p.y = this.spawnPoint.y;
      p.unstick(this.world);
      p.loadInventory(saved?.inventories?.[`J${player.slot + 1}`]);
      p.awayMs = 0;
      return p;
    });
    for (const { kind, col } of this.world.animals) {
      this.animals.push(new Animal(this, kind, col * T + T / 2, this.world.groundRow(col, true) * T));
    }
    this.aim = this.add.graphics().setDepth(DEPTH.aim);
    this.picks = this.blockPlayers.map(() => {
      const key = bloquesObject(this, 'pico') ?? 'bloques:pico-dibujo';
      const image = this.add
        .image(0, 0, key)
        .setDepth(DEPTH.player + 1)
        .setVisible(false);
      image.setScale(40 / Math.max(image.width, image.height));
      return image;
    });
    this.night = this.add.rectangle(0, 0, 10, 10, 0x0b1030, 0).setOrigin(0).setDepth(DEPTH.night);
    this.cam.setBounds(0, 0, COLS * T, ROWS * T);
    this.cam.setZoom(1);
    this.cam.centerOn(this.spawnPoint.x, this.spawnPoint.y - 120);
    this.buildHud();
    this.phase = 'play';
    this.phaseMs = 0;
    this.dirty = false;
    this.saveMs = 0;
    this.slimeMs = 0;
    this.wasNight = nightFactor(this.dayMs / DAY_MS) > 0.5;
    say(this.creative ? '¡A construir!' : '¡A la aventura!');
  }

  buildMap() {
    const world = this.world;
    this.map = this.make.tilemap({ tileWidth: T, tileHeight: T, width: COLS, height: ROWS });
    const tiles = this.map.addTilesetImage('bloques', TILES, T, T, TILESET.margin, TILESET.spacing);
    this.backLayer = this.map.createBlankLayer('atras', tiles).setDepth(DEPTH.back);
    this.frontLayer = this.map.createBlankLayer('bloques', tiles).setDepth(DEPTH.front);
    for (let r = 0; r < ROWS; r += 1) {
      for (let c = 0; c < COLS; c += 1) {
        const back = world.backAt(c, r);
        if (back >= 0) this.backLayer.putTileAt(back, c, r);
        const id = world.get(c, r);
        if (id !== B.AIR) this.frontLayer.putTileAt(this.tileOf(c, r, id), c, r);
        if (id === B.TORCH) this.addGlow(c, r);
      }
    }
  }

  // El dibujo de un cuadrito: el agua con agua encima va sin la rayita de la ola.
  tileOf(col, row, id) {
    return id === B.WATER && this.world.get(col, row - 1) === B.WATER ? DEEP_WATER : id;
  }

  // El cielo: colinas lejanas, nubes, el sol, la luna y las estrellas (se mueven poquito con la cámara).
  buildSky() {
    const { width, height } = this.scale;
    this.stars = this.add.graphics();
    for (let i = 0; i < 70; i += 1) {
      this.stars
        .fillStyle(0xffffff, 0.5 + Math.random() * 0.5)
        .fillCircle(Math.random() * width, Math.random() * height * 0.6, Math.random() < 0.15 ? 2.2 : 1.3);
    }
    const sunKey = bloquesObject(this, 'sol');
    const moonKey = bloquesObject(this, 'luna');
    this.sun = sunKey ? this.add.image(0, 0, sunKey).setDisplaySize(110, 110) : this.add.circle(0, 0, 44, 0xffe066).setStrokeStyle(8, 0xfff3a0, 0.6);
    this.moon = moonKey ? this.add.image(0, 0, moonKey).setDisplaySize(90, 90) : this.add.circle(0, 0, 36, 0xf4f1de).setStrokeStyle(6, 0xffffff, 0.4);
    // Colinas lejanas: dibujadas dos veces de ancho, para que al moverse no se acaben.
    this.hills = this.add.graphics();
    const hill = (color, base, amp, freq, phase) => {
      this.hills.fillStyle(color);
      this.hills.beginPath();
      this.hills.moveTo(0, height * 2);
      for (let x = 0; x <= width * 2; x += 20) this.hills.lineTo(x, base - amp * (0.5 + 0.5 * Math.sin((x / width) * Math.PI * 2 * freq + phase)));
      this.hills.lineTo(width * 2, height * 2);
      this.hills.closePath();
      this.hills.fillPath();
    };
    hill(0x9ad4a5, 470, 120, 2, 0.6);
    hill(0x6fbf7c, 540, 90, 3, 2.1);
    this.hillsImage = null;
    this.clouds = Array.from({ length: 6 }, (_, i) => {
      const x = (i / 6) * width * 1.4;
      const y = 60 + Math.random() * 160;
      const cloud = this.add.container(x, y, [
        this.add.ellipse(0, 0, 150, 46, 0xffffff, 0.9),
        this.add.ellipse(-36, -16, 70, 50, 0xffffff, 0.9),
        this.add.ellipse(30, -20, 80, 56, 0xffffff, 0.9),
      ]);
      cloud.speed = 6 + Math.random() * 8;
      return cloud;
    });
    this.sky.add([this.stars, this.sun, this.moon, this.hills, ...this.clouds]);
    // Si hay dibujo de Gemini de las colinas, va en lugar de las de figuras (abajo, con el cielo atrás).
    const useHills = (key) => {
      if (!this.sky?.active) return;
      this.hillsImage = this.add.image(0, height, key).setOrigin(0, 1);
      this.hillsImage.setScale((height * 0.62) / this.hillsImage.height);
      this.sky.addAt(this.hillsImage, this.sky.getIndex(this.hills));
      this.hills.setVisible(false);
    };
    const ready = bloquesLandscape(this, 'colinas', useHills);
    if (ready) useHills(ready);
  }

  updateSky(dt) {
    const { width, height } = this.scale;
    const phase = (this.dayMs % DAY_MS) / DAY_MS;
    const nf = nightFactor(phase);
    this.nightness = nf;
    const dusk = nf > 0 && nf < 1 ? Math.sin(nf * Math.PI) : 0;
    this.skyCam.setBackgroundColor(mix(mix(SKY.day, SKY.night, nf), SKY.dusk, dusk * 0.6));
    this.stars.setAlpha(nf);
    // El sol cruza de día y la luna de noche, en arco.
    const arc = (t) => ({ x: width * (0.08 + 0.84 * t), y: 260 - Math.sin(t * Math.PI) * 200 });
    const sunT = phase / DUSK[1];
    const moonT = phase >= DUSK[0] ? (phase - DUSK[0]) / (1 - DUSK[0]) : 1;
    const sun = arc(Math.min(1, sunT));
    const moon = arc(moonT);
    this.sun.setPosition(sun.x, sun.y).setAlpha(1 - nf);
    this.moon.setPosition(moon.x, moon.y).setAlpha(nf);
    // Las colinas y las nubes se mueven poquito con la cámara (de lejos).
    const view = this.cam.worldView;
    const surfaceY = this.spawnPoint.y;
    const dy = Phaser.Math.Clamp((surfaceY - view.centerY) * 0.12, -120, 200);
    const shift = -((view.centerX * 0.08) % width);
    this.hills.setPosition(shift, dy);
    if (this.hillsImage) {
      // (El dibujo no se repite: se recorre de una orilla a la otra según dónde andan en el mundo.)
      const along = Phaser.Math.Clamp(view.centerX / (COLS * T), 0, 1);
      this.hillsImage.setPosition(-Math.max(0, this.hillsImage.displayWidth - width) * along, height + dy);
      this.hillsImage.setTint(mix(0xffffff, 0x4a5078, nf));
    }
    this.hills.setAlpha(1 - nf * 0.55);
    for (const cloud of this.clouds) {
      cloud.x -= (cloud.speed * dt) / 1000;
      if (cloud.x < -120) cloud.x += width * 1.4;
      cloud.setAlpha(1 - nf * 0.7);
    }
    // La noche oscurece el mundo (los letreros no).
    this.night.setPosition(view.x - 4, view.y - 4).setSize(view.width + 8, view.height + 8);
    this.night.setFillStyle(0x0b1030, NIGHT_SHADE * nf);
    for (const glow of this.glows.values()) glow.setAlpha(0.25 + 0.6 * nf).setScale(glow.baseScale * (1 + Math.sin(this.time.now / 130 + glow.x) * 0.04));
  }

  addGlow(col, row) {
    const key = row * COLS + col;
    if (this.glows.has(key)) return;
    const glow = this.add
      .image(col * T + T / 2, row * T + T / 3, 'bloques:glow')
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(DEPTH.glow);
    glow.baseScale = (T * 5) / 256;
    glow.setScale(glow.baseScale);
    this.glows.set(key, glow);
  }

  removeGlow(col, row) {
    const key = row * COLS + col;
    this.glows.get(key)?.destroy();
    this.glows.delete(key);
  }

  // ---------- Los letreros: la barrita de cada jugador, sus corazones y avisos ----------
  buildHud() {
    const { width, height } = this.scale;
    this.hud = this.add.container(0, 0);
    this.ui.add(this.hud);
    const n = this.blockPlayers.length;
    // Que quepan todas las barritas a lo ancho (9 casillas cada una).
    this.slotSize = Math.min(52, Math.floor((width / n - 40 - 8 * 3) / 9));
    this.bars = this.blockPlayers.map((p, i) => {
      const x = (width * (i + 0.5)) / n;
      const container = this.add.container(x, height - this.slotSize / 2 - 14);
      this.hud.add(container);
      return { container, x, signature: '' };
    });
    this.banner = this.add
      .text(width / 2, 64, '', textStyle(34, TEXT.accent, { fontStyle: 'bold', stroke: '#1b1530', strokeThickness: 7 }))
      .setOrigin(0.5)
      .setAlpha(0);
    this.clock = this.add.text(width - 18, 16, '', textStyle(30)).setOrigin(1, 0);
    this.help = this.add
      .text(
        width / 2,
        18,
        'Stick = caminar · A = brincar · Mantén X = escarbar · B = poner · LB / RB = escoger · Y = hacer cosas',
        textStyle(17, TEXT.normal, { stroke: '#1b1530', strokeThickness: 4 }),
      )
      .setOrigin(0.5, 0);
    this.hud.add([this.banner, this.clock, this.help]);
    this.tweens.add({ targets: this.help, alpha: 0, delay: HELP_MS, duration: 800 });
  }

  // Redibuja la barrita de un jugador solo si cambió algo.
  refreshBar(p, i) {
    const bar = this.bars[i];
    const s = this.slotSize;
    const windowStart = Phaser.Math.Clamp(p.sel - 4, 0, Math.max(0, p.order.length - 9));
    const shown = p.order.slice(windowStart, windowStart + 9);
    const signature = [p.sel, windowStart, p.hearts, ...shown.map((id) => `${id}:${p.count(id)}`)].join('|');
    if (signature === bar.signature) return;
    bar.signature = signature;
    const c = bar.container;
    c.removeAll(true);
    const total = 9 * s + 8 * 3;
    const bg = this.add
      .rectangle(0, 0, total + 16, s + 14, COLORS.panel, 0.85)
      .setRounded(12)
      .setStrokeStyle(3, p.color);
    c.add(bg);
    // Arriba de la barrita: su número y sus corazones (en Aventura) a la izquierda; lo que tiene escogido, a la derecha.
    const hearts = this.creative ? '' : ` ${Array.from({ length: MAX_HEARTS }, (_, k) => (k < p.hearts ? '♥' : '♡')).join('')}`;
    const label = this.add
      .text(-total / 2 - 8, -s / 2 - 10, p.label, textStyle(16, hexToCss(p.color), { fontStyle: 'bold', stroke: '#1b1530', strokeThickness: 4 }))
      .setOrigin(0, 1);
    const heartText = this.add
      .text(label.x + label.width + 2, -s / 2 - 9, hearts, textStyle(18, '#ff5a6e', { fontStyle: 'bold', stroke: '#1b1530', strokeThickness: 4 }))
      .setOrigin(0, 1);
    c.add([label, heartText]);
    for (let k = 0; k < 9; k += 1) {
      const x = -total / 2 + s / 2 + k * (s + 3);
      const id = shown[k];
      const selected = id !== undefined && windowStart + k === p.sel;
      c.add(
        this.add
          .rectangle(x, 0, s, s, 0x14112b, 0.9)
          .setRounded(6)
          .setStrokeStyle(selected ? 4 : 1, selected ? p.color : COLORS.panelBorder),
      );
      if (id === undefined) continue;
      c.add(this.add.image(x, 0, TILES, frameOf(id)).setDisplaySize(s - 10, s - 10));
      if (!this.creative) {
        c.add(
          this.add
            .text(
              x + s / 2 - 2,
              s / 2 - 1,
              `${p.count(id)}`,
              textStyle(s > 40 ? 15 : 12, TEXT.normal, { fontStyle: 'bold', stroke: '#1b1530', strokeThickness: 3 }),
            )
            .setOrigin(1),
        );
      }
    }
    const selected = p.selected;
    const name = selected ? BLOCKS[selected].name : this.creative ? '' : 'Escarba (X)';
    c.add(
      this.add
        .text(total / 2 + 8, -s / 2 - 10, name, textStyle(s < 40 ? 14 : 16, TEXT.normal, { fontStyle: 'bold', stroke: '#1b1530', strokeThickness: 4 }))
        .setOrigin(1, 1),
    );
  }

  showBanner(text) {
    this.tweens.killTweensOf(this.banner);
    this.banner.setText(text).setAlpha(1).setScale(0.6);
    this.tweens.add({ targets: this.banner, scale: 1, duration: 260, ease: 'Back.easeOut' });
    this.tweens.add({ targets: this.banner, alpha: 0, delay: 2200, duration: 500 });
  }

  // ---------- Cada cuadro ----------
  update() {
    const dt = frameDelta();
    this.phaseMs = (this.phaseMs ?? 0) + dt;
    this.updateExit(dt);
    if (this.phase === 'setup') this.updateSetup();
    else if (this.phase === 'play' || this.phase === 'sleep') this.updatePlay(dt);
    this.sortCameras();
  }

  updatePlay(dt) {
    const now = this.time.now;
    if (this.phase === 'play') this.dayMs += dt;
    const world = this.world;
    this.aim.clear();
    this.blockPlayers.forEach((p, i) => {
      const intent = this.phase === 'play' ? this.playerInput(p, i, dt) : { x: 0, y: 0, jump: false, jumpHeld: false };
      p.update(dt, world, intent, now);
    });
    for (const animal of this.animals) animal.update(dt, world);
    this.updateSlimes(dt);
    this.updateDrops(dt);
    this.updateFlow(dt);
    this.updateCamera(dt);
    this.updateSky(dt);
    this.updateDayEvents();
    this.blockPlayers.forEach((p, i) => {
      p.render(p.digging);
      this.renderPick(p, i);
      this.refreshBar(p, i);
      if (p.menu) p.menu.refresh(p, this.nearTable(p));
    });
    for (const animal of this.animals) animal.render(now);
    for (const slime of this.slimes) slime.render();
    this.clock.setText(this.nightness > 0.5 ? '🌙' : '☀️');
    this.saveMs += dt;
    if (this.dirty && this.saveMs >= SAVE_EVERY_MS) this.saveWorld();
  }

  // Lee el control de un jugador: escoger bloque, el menú de hacer cosas, escarbar y poner. Devuelve cómo se mueve.
  playerInput(p, i, dt) {
    const id = p.deviceId;
    const stick = controls.getStick(id);
    const bumpers = controls.isDown(id, 'lb') && controls.isDown(id, 'rb');
    p.digging = false;
    if (p.menu) {
      this.updateMenu(p, i);
      return { x: 0, y: 0, jump: false, jumpHeld: false };
    }
    if (!bumpers) {
      if (controls.justPressed(id, 'lb')) {
        p.pick(-1);
        sfx.select();
      }
      if (controls.justPressed(id, 'rb')) {
        p.pick(1);
        sfx.select();
      }
      if (controls.justPressed(id, 'y')) this.pressY(p, i);
    }
    const targets = p.targets(this.world, stick);
    // X: si hay un animalito o un slime enfrente, se le "pica"; si no, se escarba (manteniendo).
    if (controls.justPressed(id, 'x')) p.xUsed = this.pokeCritter(p);
    if (!controls.isDown(id, 'x')) p.xUsed = false;
    if (controls.isDown(id, 'x') && !p.xUsed) this.dig(p, targets.dig, dt);
    else p.digCell = null;
    if (controls.justPressed(id, 'b')) this.place(p, targets.place);
    this.drawAim(p, targets);
    const x = Phaser.Math.Clamp(stick.x + (p.pull ?? 0), -1, 1);
    return { x, y: stick.y, jump: controls.justPressed(id, 'a'), jumpHeld: controls.isDown(id, 'a') };
  }

  // La mira: un cuadro de su color en el bloque que escarba, y el bloque que pondría, clarito.
  drawAim(p, targets) {
    const g = this.aim;
    const { dig, place } = targets;
    const digId = this.world.get(dig.col, dig.row);
    if (digId !== B.AIR && BLOCKS[digId]?.hard !== null && BLOCKS[digId]) {
      g.lineStyle(4, p.color, 0.95).strokeRect(dig.col * T + 2, dig.row * T + 2, T - 4, T - 4);
      // Las grietas avanzan mientras se escarba.
      if (p.digCell && p.digCell.col === dig.col && p.digCell.row === dig.row) {
        const k = Math.min(1, p.digMs / this.hardness(digId));
        this.drawCracks(g, dig.col * T, dig.row * T, k);
      }
    }
    if (place && p.selected && this.canPlaceAt(place.col, place.row)) {
      g.fillStyle(p.color, 0.18).fillRect(place.col * T + 4, place.row * T + 4, T - 8, T - 8);
      g.lineStyle(2, 0xffffff, 0.5).strokeRect(place.col * T + 4, place.row * T + 4, T - 8, T - 8);
    }
  }

  drawCracks(g, x, y, k) {
    g.lineStyle(3, 0x1b1530, 0.85);
    const lines = [
      [0.5, 0.5, 0.15, 0.2],
      [0.5, 0.5, 0.85, 0.3],
      [0.5, 0.5, 0.3, 0.85],
      [0.5, 0.5, 0.8, 0.8],
      [0.15, 0.2, 0.05, 0.5],
      [0.85, 0.3, 0.95, 0.6],
    ];
    const count = Math.ceil(k * lines.length);
    for (let i = 0; i < count; i += 1) {
      const [x1, y1, x2, y2] = lines[i];
      g.lineBetween(x + x1 * T, y + y1 * T, x + x2 * T, y + y2 * T);
    }
  }

  hardness(id) {
    const hard = BLOCKS[id]?.hard ?? 0;
    return this.creative ? Math.max(60, hard * 0.3) : hard;
  }

  dig(p, cell, dt) {
    const id = this.world.get(cell.col, cell.row);
    const block = BLOCKS[id];
    if (!block || block.hard === null || !this.world.inside(cell.col, cell.row)) {
      p.digCell = null;
      return;
    }
    if (!p.digCell || p.digCell.col !== cell.col || p.digCell.row !== cell.row) {
      p.digCell = { ...cell };
      p.digMs = 0;
      p.tickMs = 0;
    }
    p.digging = true;
    p.digMs += dt;
    p.tickMs += dt;
    if (p.tickMs >= DIG_TICK_MS) {
      p.tickMs = 0;
      digTick(block.sound);
    }
    if (p.digMs >= this.hardness(id)) {
      this.breakBlock(p, cell.col, cell.row);
      p.digCell = null;
    }
  }

  breakBlock(p, col, row) {
    const id = this.world.get(col, row);
    const block = BLOCKS[id];
    this.setCell(col, row, B.AIR);
    this.queueFlow(col, row, FLOW.budget);
    breakSound(block.sound);
    this.crumbs(col, row, block.color);
    if (!this.creative) {
      const drop = dropOf(id);
      if (drop) this.spawnDrop(drop, col * T + T / 2, row * T + T / 2, p);
    }
    // Las flores de arriba se caen con el bloque.
    const above = this.world.get(col, row - 1);
    if (above === B.FLOWER_RED || above === B.FLOWER_YELLOW) {
      this.setCell(col, row - 1, B.AIR);
      if (!this.creative) this.spawnDrop(above, col * T + T / 2, row * T - T / 2, p);
    }
    if (id === B.DIAMOND) {
      rewards.earn('bloques-diamante');
      say('¡Encontraste un diamante!');
      sparkles(this, col * T + T / 2, row * T + T / 2, 10, 50);
    } else if (id === B.GOLD && !this.said.has('oro')) {
      this.said.add('oro');
      say('¡Encontraste oro!');
    }
  }

  // Cambia un cuadrito del mundo y su dibujo.
  setCell(col, row, id) {
    const before = this.world.get(col, row);
    this.world.set(col, row, id);
    if (id === B.AIR) this.frontLayer.removeTileAt(col, row);
    else this.frontLayer.putTileAt(this.tileOf(col, row, id), col, row);
    // (El agua de abajo ahora es la de arriba, o al revés.)
    if (this.world.get(col, row + 1) === B.WATER) this.frontLayer.putTileAt(this.tileOf(col, row + 1, B.WATER), col, row + 1);
    if (before === B.TORCH) this.removeGlow(col, row);
    if (id === B.TORCH) this.addGlow(col, row);
    this.dirty = true;
  }

  // ---------- El agua corre ----------
  // Si junto a un hueco hay agua, el agua se mete (cae o se extiende sobre algo), poquito a poquito y hasta
  // `budget` cuadritos, para que un lago no inunde todas las cuevas.
  queueFlow(col, row, budget) {
    if (budget > 0) this.flow.push({ col, row, budget, ms: FLOW.stepMs });
  }

  updateFlow(dt) {
    if (!this.flow.length) return;
    const due = [];
    for (const item of this.flow) {
      item.ms -= dt;
      if (item.ms <= 0) due.push(item);
    }
    this.flow = this.flow.filter((item) => item.ms > 0);
    const w = this.world;
    for (const { col, row, budget } of due) {
      if (w.get(col, row) !== B.AIR || !w.inside(col, row)) continue;
      const below = w.get(col, row + 1);
      const held = BLOCKS[below]?.solid || below === B.WATER;
      const fromAbove = w.get(col, row - 1) === B.WATER;
      const fromSide = held && (w.get(col - 1, row) === B.WATER || w.get(col + 1, row) === B.WATER);
      if (!fromAbove && !fromSide) continue;
      this.setCell(col, row, B.WATER);
      this.queueFlow(col, row + 1, budget - 1);
      this.queueFlow(col - 1, row, budget - 1);
      this.queueFlow(col + 1, row, budget - 1);
    }
  }

  // Pedacitos del bloque que saltan al romperse.
  crumbs(col, row, color) {
    const x = col * T + T / 2;
    const y = row * T + T / 2;
    for (let i = 0; i < 7; i += 1) {
      const bit = this.add.rectangle(x, y, 9, 9, color).setStrokeStyle(2, 0x1b1530, 0.6).setDepth(DEPTH.drop);
      const angle = Math.random() * Math.PI * 2;
      this.tweens.add({ targets: bit, x: x + Math.cos(angle) * 40, y: y + Math.sin(angle) * 30 - 10, angle: 180, duration: 220, ease: 'Quad.easeOut' });
      this.tweens.add({
        targets: bit,
        y: `+=${30 + Math.random() * 20}`,
        alpha: 0,
        delay: 200,
        duration: 240,
        ease: 'Quad.easeIn',
        onComplete: () => bit.destroy(),
      });
    }
  }

  canPlaceAt(col, row) {
    if (!this.world.inside(col, row)) return false;
    const here = this.world.get(col, row);
    if (here !== B.AIR && here !== B.WATER) return false;
    const bodies = [...this.blockPlayers, ...this.animals, ...this.slimes];
    return !bodies.some((b) => cellOverlaps(b, col, row));
  }

  place(p, cell) {
    const id = p.selected;
    if (!id) {
      sfx.back();
      return;
    }
    if (!cell || !this.canPlaceAt(cell.col, cell.row)) {
      sfx.back();
      return;
    }
    this.setCell(cell.col, cell.row, id);
    p.take(id, 1);
    placeSound(BLOCKS[id].sound);
    if (id === B.BED || id === B.DOOR) this.checkHouse(cell.col, cell.row);
  }

  // ¿Ya hay una casita cerca? Una cama con techo arriba y una puerta cerquita.
  checkHouse(col, row) {
    const w = this.world;
    for (let r = row - 6; r <= row + 6; r += 1) {
      for (let c = col - 10; c <= col + 10; c += 1) {
        if (w.get(c, r) !== B.BED) continue;
        let roof = false;
        for (let k = 1; k <= HOUSE.roof; k += 1) if (BLOCKS[w.get(c, r - k)]?.solid) roof = true;
        if (!roof) continue;
        for (let dr = -HOUSE.doorRows; dr <= HOUSE.doorRows; dr += 1) {
          for (let dc = -HOUSE.doorCols; dc <= HOUSE.doorCols; dc += 1) {
            if (w.get(c + dc, r + dr) !== B.DOOR) continue;
            if (rewards.earn('bloques-casa') || !this.said.has('casa')) say('¡Qué bonita casita!');
            this.said.add('casa');
            sparkles(this, c * T + T / 2, r * T, 10, 60);
            return;
          }
        }
      }
    }
  }

  // ---------- Lo que se recoge ----------
  spawnDrop(id, x, y, owner) {
    const image = this.add.image(x, y, TILES, frameOf(id)).setDisplaySize(24, 24).setDepth(DEPTH.drop);
    this.drops.push({ id, x, y, vx: Phaser.Math.Between(-90, 90), vy: -280, age: 0, owner, image });
  }

  updateDrops(dt) {
    const s = dt / 1000;
    for (const drop of this.drops) {
      drop.age += dt;
      if (drop.age < DROP_FLY_MS) {
        drop.vy += 1400 * s;
      } else {
        // Vuela solito hacia quien lo escarbó.
        const owner = this.blockPlayers.includes(drop.owner) ? drop.owner : this.blockPlayers[0];
        const tx = owner.x;
        const ty = owner.y - owner.h / 2;
        const dist = Math.hypot(tx - drop.x, ty - drop.y);
        const speed = 500 + drop.age * 0.8;
        drop.vx = ((tx - drop.x) / (dist || 1)) * speed;
        drop.vy = ((ty - drop.y) / (dist || 1)) * speed;
        if (dist < 26) {
          owner.give(drop.id, 1);
          pickupSound();
          drop.done = true;
        }
      }
      drop.x += drop.vx * s;
      drop.y += drop.vy * s;
      drop.image.setPosition(drop.x, drop.y).setAngle(drop.age * 0.3);
      if (drop.done) drop.image.destroy();
    }
    this.drops = this.drops.filter((d) => !d.done);
  }

  // ---------- Animalitos y slimes ----------
  // El animalito o slime que está enfrente de un jugador (a su alcance).
  critterInFront(p, list) {
    return list.find((b) => {
      const dx = (b.x - p.x) * p.facing;
      return dx > -10 && dx < REACH + b.w / 2 && Math.abs(b.y - p.y) < T * 1.2;
    });
  }

  pokeCritter(p) {
    const slime = this.critterInFront(p, this.slimes);
    if (slime) {
      sfx.hit(0.4);
      if (slime.hit(p.facing)) this.removeSlime(slime);
      return true;
    }
    const animal = this.critterInFront(p, this.animals);
    if (!animal) return false;
    const wool = animal.poke();
    popText(this, animal.x, animal.y - 60, animal.info.sound, '#ffffff');
    if (wool) {
      if (!this.creative) this.spawnDrop(B.WOOL, animal.x, animal.y - 30, p);
      say('¡Lana!');
    }
    return true;
  }

  removeSlime(slime) {
    burst(this, slime.x, slime.y - 20, 0x6fe07a, 8);
    sfx.poof();
    slime.destroy();
    this.slimes = this.slimes.filter((s) => s !== slime);
  }

  updateSlimes(dt) {
    const night = this.nightness > 0.5;
    if (night && this.monsters && this.phase === 'play') {
      this.slimeMs += dt;
      if (this.slimeMs >= SLIME_EVERY_MS && this.slimes.length < SLIME_MAX + this.blockPlayers.length) {
        this.slimeMs = 0;
        this.spawnSlime();
      }
    }
    for (const slime of this.slimes) {
      const target = this.nearestPlayer(slime.x, slime.y);
      const wasInAir = !slime.onGround;
      slime.update(dt, this.world, target);
      if (wasInAir && slime.onGround && this.onScreen(slime.x, slime.y)) slimeSound();
      for (const p of this.blockPlayers) {
        if (p.invulnMs > 0 || !bodiesTouch(slime, p, 4)) continue;
        const dir = Math.sign(p.x - slime.x) || 1;
        p.vx = dir * SLIME_PUSH.x;
        p.vy = -SLIME_PUSH.y;
        p.flying = false;
        slime.vx = -dir * 200;
        this.hurt(p);
      }
    }
  }

  spawnSlime() {
    const group = this.groupCenter();
    for (let tries = 0; tries < 6; tries += 1) {
      const side = Math.random() < 0.5 ? -1 : 1;
      const col = Math.floor((group.x + side * Phaser.Math.Between(600, 900)) / T);
      if (col < 2 || col >= COLS - 2) continue;
      const row = this.world.groundRow(col, true);
      if (this.world.get(col, row - 1) !== B.AIR) continue;
      this.slimes.push(new Slime(this, col * T + T / 2, row * T));
      return;
    }
  }

  nearestPlayer(x, y) {
    let best = null;
    let bestDist = Infinity;
    for (const p of this.blockPlayers) {
      const d = Math.hypot(p.x - x, p.y - y);
      if (d < bestDist) {
        best = p;
        bestDist = d;
      }
    }
    return best;
  }

  onScreen(x, y) {
    return this.cam.worldView.contains(x, y);
  }

  // Le pegan o se cae de muy alto: en Aventura pierde un corazón (sin corazones, regresa a casa).
  hurt(p) {
    if (p.invulnMs > 0) return;
    p.invulnMs = INVULN_MS;
    p.look.flash();
    p.look.express('asustado', 600);
    sfx.hit(0.3);
    if (this.creative) return;
    p.hearts -= 1;
    p.regenMs = 0;
    if (p.hearts <= 0) this.respawn(p);
  }

  onFallHurt(p) {
    popText(this, p.x, p.y - p.h - 20, '¡Auch!', '#ff8a8a');
    this.hurt(p);
  }

  onJump() {
    sfx.jump();
  }

  onFly(p) {
    popText(this, p.x, p.y - p.h - 20, p.flying ? '¡A volar!' : '¡Al piso!', '#ffffff');
  }

  respawn(p) {
    burst(this, p.x, p.y - p.h / 2, p.color, 10);
    p.x = this.spawnPoint.x;
    p.y = this.spawnPoint.y;
    p.unstick(this.world);
    p.vx = 0;
    p.vy = 0;
    p.hearts = MAX_HEARTS;
    p.invulnMs = 2000;
    say('¡De vuelta a casa!');
  }

  // ---------- Y: hacer cosas o dormir ----------
  pressY(p, i) {
    if (touches(this.world, p, (id) => id === B.BED)) {
      if (this.nightness > 0.3) {
        this.sleep();
        return;
      }
      popText(this, p.x, p.y - p.h - 20, 'Solo se duerme de noche', '#ffffff');
    }
    if (this.creative) {
      popText(this, p.x, p.y - p.h - 20, '¡En Creativo ya tienes todo!', '#ffffff');
      return;
    }
    const n = this.blockPlayers.length;
    const bar = this.bars[i];
    p.menu = new CraftMenu(this, this.hud, bar.x, bar.container.y - this.slotSize / 2 - 34, p.color);
    p.menu.container.setScale(Math.min(1, (this.scale.width / n - 10) / 500));
    p.menu.refresh(p, this.nearTable(p));
    sfx.confirm();
    say('Hacer cosas', { interrupt: false });
  }

  updateMenu(p) {
    const id = p.deviceId;
    const step =
      controls.justPressed(id, 'right') || controls.justPressed(id, 'rb') ? 1 : controls.justPressed(id, 'left') || controls.justPressed(id, 'lb') ? -1 : 0;
    if (step) {
      p.menu.move(step);
      sfx.select();
    }
    if (controls.justPressed(id, 'a')) {
      const recipe = p.menu.recipe;
      if (missing(recipe, p, this.nearTable(p))) {
        sfx.back();
      } else {
        craft(recipe, p);
        sfx.star();
        say(`¡${BLOCKS[recipe.out].name}!`, { interrupt: false });
        sparkles(this, p.x, p.y - p.h, 6, 40);
        // Lo que acabas de hacer queda escogido en tu barrita.
        p.sel = Math.max(0, p.order.indexOf(recipe.out));
      }
    }
    if (controls.justPressed(id, 'b') || controls.justPressed(id, 'y')) {
      p.menu.destroy();
      p.menu = null;
      sfx.back();
    }
  }

  // ¿Hay una mesa de trabajo a 3 bloques o menos?
  nearTable(p) {
    const col = Math.floor(p.x / T);
    const row = Math.floor((p.y - 1) / T);
    for (let r = row - 3; r <= row + 3; r += 1) {
      for (let c = col - 3; c <= col + 3; c += 1) if (this.world.get(c, r) === B.TABLE) return true;
    }
    return false;
  }

  sleep() {
    if (this.phase === 'sleep') return;
    this.phase = 'sleep';
    const { width, height } = this.scale;
    const curtain = this.add.rectangle(0, 0, width, height, 0x05040f, 0).setOrigin(0);
    const zzz = this.add
      .text(width / 2, height / 2, '💤 Buenas noches…', textStyle(48, TEXT.normal, { fontStyle: 'bold' }))
      .setOrigin(0.5)
      .setAlpha(0);
    this.ui.add([curtain, zzz]);
    say('Buenas noches');
    this.tweens.add({
      targets: [curtain, zzz],
      fillAlpha: 1,
      alpha: 1,
      duration: 900,
      onComplete: () => {
        this.dayMs = Math.ceil(this.dayMs / DAY_MS) * DAY_MS + MORNING * DAY_MS;
        for (const slime of [...this.slimes]) this.removeSlime(slime);
        rewards.earn('bloques-noche');
        this.saveWorld();
        this.time.delayedCall(700, () => {
          zzz.setText('☀️ ¡Buenos días!');
          say('¡Buenos días!');
          this.tweens.add({
            targets: [curtain, zzz],
            alpha: 0,
            delay: 600,
            duration: 700,
            onComplete: () => {
              curtain.destroy();
              zzz.destroy();
              if (this.phase === 'sleep') this.phase = 'play';
            },
          });
        });
      },
    });
  }

  // Al hacerse de noche (y de día) se avisa; al amanecer los slimes se derriten.
  updateDayEvents() {
    const night = this.nightness > 0.5;
    if (night === this.wasNight) return;
    this.wasNight = night;
    if (night) {
      this.showBanner('🌙 ¡Ya es de noche!');
      say(this.monsters ? '¡Ya es de noche! Cuidado con los slimes' : '¡Ya es de noche!');
    } else {
      this.showBanner('☀️ ¡Buenos días!');
      say('¡Buenos días!');
      for (const slime of [...this.slimes]) this.removeSlime(slime);
    }
  }

  // ---------- La cámara ----------
  groupCenter() {
    const list = this.blockPlayers;
    const x = list.reduce((sum, p) => sum + p.x, 0) / list.length;
    const y = list.reduce((sum, p) => sum + p.y - p.h / 2, 0) / list.length;
    return { x, y };
  }

  // El que está más en medio de todos (si empatan, el de número más bajo): la cámara nunca lo deja atrás.
  anchorPlayer() {
    const list = this.blockPlayers;
    const score = (p) => list.reduce((sum, q) => sum + Math.abs(q.x - p.x) + Math.abs(q.y - p.y), 0);
    return list.reduce((best, p) => (score(p) < score(best) - 1 ? p : best), list[0]);
  }

  updateCamera(dt) {
    const { width, height } = this.scale;
    const list = this.blockPlayers;
    // Los que se quedaron lejos del grupo (no caben en la pantalla ni alejándola): se les jala hacia el grupo y, si
    // siguen lejos, aparecen junto al de en medio. Mientras, la cámara sigue al grupo sin ellos.
    const anchor = this.anchorPlayer();
    const fit = { x: width / MIN_ZOOM - VIEW_MARGIN.x / 2, y: height / MIN_ZOOM - VIEW_MARGIN.y / 2 };
    const spread = (g, key) => Math.max(...g.map(key)) - Math.min(...g.map(key));
    let inView = [...list];
    while (inView.length > 1 && (spread(inView, (p) => p.x) > fit.x || spread(inView, (p) => p.y) > fit.y)) {
      // Se queda fuera el más lejano al de en medio (hasta que todos los demás quepan).
      const far = inView.reduce((best, p) => (Math.hypot(p.x - anchor.x, p.y - anchor.y) > Math.hypot(best.x - anchor.x, best.y - anchor.y) ? p : best));
      inView = inView.filter((p) => p !== far);
    }
    for (const p of list) {
      const out = !inView.includes(p);
      p.awayMs = out ? p.awayMs + dt : 0;
      // (El jalón es como si empujara el stick hacia los demás: así no atraviesa paredes.)
      p.pull = out ? Math.sign(anchor.x - p.x) * PULL : 0;
      if (p.awayMs >= TELEPORT_MS) this.bringBack(p, anchor);
    }
    const group = list.filter((p) => !p.awayMs);
    const xs = group.map((p) => p.x);
    const ys = group.map((p) => p.y - p.h / 2);
    const spreadX = Math.max(...xs) - Math.min(...xs);
    const spreadY = Math.max(...ys) - Math.min(...ys);
    const want = Phaser.Math.Clamp(Math.min(1, (width - VIEW_MARGIN.x) / Math.max(1, spreadX), (height - VIEW_MARGIN.y) / Math.max(1, spreadY)), MIN_ZOOM, 1);
    const cam = this.cam;
    cam.setZoom(cam.zoom + (want - cam.zoom) * Math.min(1, dt / 350));
    const center = { x: (Math.max(...xs) + Math.min(...xs)) / 2, y: (Math.max(...ys) + Math.min(...ys)) / 2 - 40 };
    const view = cam.worldView;
    const cx = view.width ? view.centerX : center.x;
    const cy = view.height ? view.centerY : center.y;
    const k = Math.min(1, dt / 140);
    cam.centerOn(cx + (center.x - cx) * k, cy + (center.y - cy) * k);
  }

  bringBack(p, friend) {
    burst(this, p.x, p.y - p.h / 2, p.color, 6);
    // (Justo donde está su amigo: ahí seguro cabe.)
    p.x = friend.x;
    p.y = friend.y;
    p.flying = friend.flying;
    p.vx = 0;
    p.vy = 0;
    p.awayMs = 0;
    burst(this, p.x, p.y - p.h / 2, p.color, 6);
    popText(this, p.x, p.y - p.h - 20, '¡Ven acá!', hexToCss(p.color));
  }

  // ---------- El pico (al escarbar) ----------
  renderPick(p, i) {
    const image = this.picks[i];
    image.setVisible(Boolean(p.digging));
    if (!p.digging) return;
    const swing = Math.sin(this.time.now / 70);
    image.setPosition(p.x + p.facing * 22, p.y - p.h * 0.55).setFlipX(p.facing < 0);
    image.setAngle(p.facing * (20 + swing * 35));
  }

  // ---------- Guardar y salir ----------
  saveWorld() {
    if (!this.world) return;
    const inventories = {};
    for (const p of this.blockPlayers) inventories[p.label] = p.saveInventory();
    // (Lo que lleva alguien que no jugó esta vez se queda guardado.)
    const before = this.restart ? null : this.slots[this.options.slot];
    const data = {
      seed: this.seed,
      mode: this.creative ? 'creativo' : 'aventura',
      monsters: this.monsters,
      changes: this.world.changes(),
      time: (this.dayMs % DAY_MS) / DAY_MS,
      inventories: { ...(before?.inventories ?? {}), ...inventories },
      savedAt: Date.now(),
    };
    saveSlot(this.options.slot, data);
    this.slots[this.options.slot] = data;
    this.restart = false;
    this.dirty = false;
    this.saveMs = 0;
  }

  updateExit(dt) {
    const holding = this.humans.some((player) => controls.holdingExit(player.deviceId));
    this.exitMs = holding ? this.exitMs + dt : 0;
    if (this.exitMs >= EXIT_HOLD_MS) this.exit();
  }

  exit() {
    if (this.exiting) return;
    this.exiting = true;
    if (this.phase !== 'setup') this.saveWorld();
    go(this, 'Menu', { selected: this.returnData.selected });
  }

  cleanUp() {
    for (const p of this.blockPlayers) p.menu?.destroy();
    for (const p of this.blockPlayers) p.menu = null;
    this.map?.destroy();
    this.map = null;
    this.world = null;
    this.blockPlayers = [];
    this.animals = [];
    this.slimes = [];
    this.drops = [];
    this.flow = [];
    this.glows = new Map();
    // (Phaser quita todas las cámaras al cerrar la escena; al volver a entrar se crean otra vez.)
    this.skyCam = null;
    this.uiCam = null;
  }
}
