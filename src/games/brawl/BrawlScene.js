import Phaser from 'phaser';
import { controls } from '../../shared/controls.js';
import { characterPicks } from '../../shared/picks.js';
import { defaultCharacter } from '../../scenes/CharacterSelectScene.js';
import { loadSmashArt } from '../smash/art.js';
import { isBlockCharacter } from '../smash/bloquecito.js';
import { CHARACTERS } from '../smash/characters.js';
import { frameDelta, setTimeScale } from '../../shared/clock.js';
import { music } from '../../shared/music.js';
import { PLAYER_COLORS, players } from '../../shared/players.js';
import { rewards } from '../../shared/rewards.js';
import { sfx } from '../../shared/sound.js';
import { say } from '../../shared/voice.js';
import { COLORS, TEXT, hexToCss, textStyle } from '../../ui/style.js';
import { comicHit, loadFxArt, shockwave } from '../duelo/fx.js';
import { ARENA, SECTION_W, setSection } from './arena.js';
import { backgroundTexture, loadBrawlArt, loadWorldBackground } from './art.js';
import { Ambience } from '../../ui/ambient.js';
import { CpuBuddy, buddyCount } from './buddies.js';
import { Coins, coinBank, coinsFor } from './coins.js';
import { COMBO_STICKER_AT, TeamCombo } from './combo.js';
import { Fighter, MAX_HP, METER_MAX, SUPER_MS, newStats } from './Fighter.js';
import { MONSTER_TYPES, Monster } from './Monster.js';
import { Mounts } from './mounts.js';
import { Pets } from './pets.js';
import { Props } from './props.js';
import { brawlRecords, formatTime, rescues } from './records.js';
import { BossReplay } from './replay.js';
import { STAR_TIME_MS, beatenWorlds, endlessRecord, showBossIntro, showMap, showResults, worldStars } from './screens.js';
import { Shop, dressFighter, wardrobe } from './shop.js';
import { BrawlTalk } from './talk.js';
import { Traps } from './traps.js';
import { ENDLESS_BOSS_EVERY, MINI_WAVE, NEST_HP, NEST_ROUNDS, WORLDS, bossRushWaves, buildSpawnQueue, endlessWave, nestWave } from './worlds.js';
import { burst, confetti, fireworks, popText, randomPow } from './effects.js';
import { go } from '../../shared/transition.js';
import { bounceIn } from '../../ui/bounce.js';

const SPAWN_INTERVAL_MS = 1100;
const FIRST_SPAWN_MS = 1500;
const MAX_ALIVE = 6;
const BOSS_HP_PER_PLAYER = 0.35;
const HEART_DROP_CHANCE = 0.25;
const MAX_HEARTS_ON_FLOOR = 4;
const HEART_LIFETIME_MS = 8000;
const EXIT_HOLD_MS = 1200;
// Tiempo antes de aceptar A en las pantallas de ganar/perder, para que no se las salten apretando botones.
const END_SCREEN_DELAY_MS = 1200;
const HUD_DEPTH = 10000;
const OUTLINE = { stroke: '#1b1530', strokeThickness: 4 };
// La bola de fuego (o tinta, nieve, magia, betún, láser) va por el carril del jugador: se esquiva saltando o
// cambiándose de carril.
const FIREBALL = { speed: 430, radius: 18, lane: 30 };
const FIREBALL_LOOKS = {
  fire: [0xffd84d, 0xff5a2f, 0xff9a3c],
  ink: [0x3a2a5a, 0x1b1530, 0x8158d8],
  snow: [0xffffff, 0x9fd8ff, 0xdff4ff],
  magic: [0xd36bff, 0x8158d8, 0xffd84d],
  frosting: [0xffffff, 0xff7ad9, 0xffc4e6],
  laser: [0xffffff, 0xff4d6d, 0xff9aa8],
  rock: [0xc9935a, 0x5c3a1a, 0x8b5a2b],
};
const FIREBALL_WORDS = { fire: '¡Quema!', ink: '¡Tinta!', snow: '¡Brrr!', magic: '¡Zas!', frosting: '¡Betún!', laser: '¡Láser!', rock: '¡Pum!' };
// Lo que lanzan los especiales (estrella, bala de cañón).
const SHOT = { radius: 22, lane: 40 };
// Golpe en equipo: si dos (o más) se vuelven súper con menos de esto de diferencia.
const TEAM_WINDOW_MS = 4000;
const TEAM_DAMAGE = { normal: 6, boss: 10 };
// Cada cuánto lastima la estrella.
const STAR_HIT_MS = 400;
const WALK_LEAD = 220;
const ENDLESS_STICKER_AT = 10;
// Amigos de la compu: hasta 3 (se escogen con Y en el mapa).
const MAX_BUDDIES = 3;
// Los personajes que pueden ser amigos de la compu o estar enjaulados (Bloquecito y los jefes no).
const FRIENDS = Object.keys(CHARACTERS).filter((c) => !isBlockCharacter(c) && !CHARACTERS[c].unlock);
// El aplastón al caer del resorte.
const SPRING_SLAM = { radius: 120, damage: 2 };
// El combo doble: uno avienta un monstruo y otro le pega en el aire.
const AIR_COMBO_DAMAGE = 3;
// Al vencer a un jefe en los jefes en serie, todos recuperan corazones.
const RUSH_HEAL = 2;

// "Pelea en equipo": todos los jugadores (y sus amigos de la compu) contra monstruos, estilo arcade. Se escoge en el
// mapa: 8 mundos, los jefes en serie y el modo sin fin. Cada mundo son 4 tramos: al limpiar uno se camina a la derecha
// al siguiente, y en el último llega el jefe. En el camino: un animal para montar, trampas, un mini jefe y una jaula
// con un amigo para rescatar. Las monedas se gastan en la tienda (sombreros y colores). Al final, resultados con
// medallas, estrellas y récords.
export class BrawlScene extends Phaser.Scene {
  constructor() {
    super('Brawl');
  }

  init(data) {
    this.returnData = data ?? {};
  }

  preload() {
    loadBrawlArt(this);
    const picks = players.sorted().map((player) => characterPicks.get(player.deviceId, defaultCharacter(player)));
    loadSmashArt(this, { posesFor: picks });
    loadFxArt(this);
  }

  create() {
    setSection(0);
    this.cameras.main.setScroll(0, 0);
    this.backgroundLayer = this.add.container(0, 0).setDepth(-100);
    this.humans = players.sorted().map((player, i) => {
      const fighter = new Fighter(this, player, 320 + i * 80, 470 + (i % 2) * 80, characterPicks.get(player.deviceId, defaultCharacter(player)));
      fighter.name = fighter.label;
      return fighter;
    });
    this.fighters = [...this.humans];
    this.monsters = [];
    this.hearts = [];
    this.fireballs = [];
    this.shots = [];
    this.props = new Props(this);
    this.coins = new Coins(this);
    this.mounts = new Mounts(this);
    this.traps = new Traps(this);
    this.pets = new Pets(this);
    this.replay = new BossReplay();
    this.boss = null;
    this.bossBar = null;
    this.exitMs = 0;
    this.endMs = 0;
    this.exiting = false;
    this.screen = null;
    this.mapIndex = 0;
    this.createHud();
    this.combo = new TeamCombo(this, HUD_DEPTH);
    this.talk = new BrawlTalk(this, HUD_DEPTH + 2);
    this.input.keyboard?.on('keydown-ESC', () => this.exit());
    this.openMap();
  }

  // ---------- El fondo: la imagen del mundo repetida a lo largo del nivel (en espejo, para que no se noten las uniones) ----------

  drawBackground(world, sections) {
    this.backgroundWorld = world;
    this.backgroundLayer.removeAll(true);
    // Si el fondo del mundo no se ha bajado, se pide y se vuelve a dibujar en cuanto llega.
    if (!backgroundTexture(this, world.background)) loadWorldBackground(this, world.background, () => this.backgroundWorld === world && this.drawBackground(world, sections));
    // Lo que se mueve en el fondo (pájaros, chispas, nieve...).
    this.ambience?.destroy();
    this.ambience = new Ambience(this, world.background, { depth: -90 });
    const { width, height } = this.scale;
    const key = backgroundTexture(this, world.background);
    for (let k = 0; k <= sections; k += 1) {
      const left = k * SECTION_W;
      if (key) {
        const image = this.add.image(left + width / 2, height / 2, key).setFlipX(k % 2 === 1);
        image.setScale(Math.max(width / image.width, height / image.height));
        this.backgroundLayer.add(image);
        continue;
      }
      const { sky, hill, floor, stripe } = world.colors;
      const floorTop = ARENA.top - 40;
      this.backgroundLayer.add([
        this.add.rectangle(left + width / 2, floorTop / 2, width, floorTop, sky),
        this.add.ellipse(left + 160, floorTop, 520, 260, hill),
        this.add.ellipse(left + 640, floorTop + 10, 640, 300, hill),
        this.add.ellipse(left + 1100, floorTop, 560, 240, hill),
        this.add.rectangle(left + width / 2, (floorTop + height) / 2, width, height - floorTop, floor),
        ...[0, 1, 2, 3].map((i) => this.add.rectangle(left + width / 2, floorTop + 30 + i * 90, width, 4, stripe, 0.6)),
      ]);
    }
  }

  // ---------- Marcador (pegado a la pantalla) ----------

  createHud() {
    const { width, height } = this.scale;
    const fixed = (item) => item.setScrollFactor(0).setDepth(HUD_DEPTH);
    this.hud = [];
    this.buildFighterHud();
    this.waveText = fixed(this.add.text(width - 20, 74, '', textStyle(22, TEXT.normal, { fontStyle: 'bold', ...OUTLINE })).setOrigin(1, 0));

    const bannerStyle = { fontStyle: 'bold', stroke: '#1b1530', strokeThickness: 10, align: 'center' };
    this.banner = fixed(this.add.text(width / 2, 230, '', textStyle(72, TEXT.accent, bannerStyle)).setOrigin(0.5).setDepth(HUD_DEPTH + 1));
    this.subBanner = fixed(this.add.text(width / 2, 305, '', textStyle(30, TEXT.normal, { ...bannerStyle, strokeThickness: 6 })).setOrigin(0.5).setDepth(HUD_DEPTH + 1));
    this.banner.setAlpha(0);
    this.subBanner.setAlpha(0);
    // "¡Adelante!" con flecha, cuando hay que caminar al siguiente tramo.
    this.goArrow = fixed(this.add.text(width - 150, 300, '¡Adelante!\n➡️', textStyle(40, '#ffd84d', { ...bannerStyle, strokeThickness: 8 })).setOrigin(0.5)).setVisible(false);

    this.help = fixed(
      this.add
        .text(
          width / 2,
          height - 24,
          'X = pegar (3 = remate)  ·  B = especial  ·  A = saltar  ·  LB / RB = agarrar y aventar  ·  Barra llena: LB + RB = ¡súper!  ·  LB + RB + Y = salir',
          textStyle(16, TEXT.normal, OUTLINE),
        )
        .setOrigin(0.5),
    );
    this.exitBar = fixed(this.add.rectangle(width / 2 - 100, height - 8, 200, 6, 0xffffff).setOrigin(0, 0.5).setScale(0, 1));
  }

  // Corazones y barra de poder de cada peleador. Con más de 4 (amigos de la compu, rescatados) va más chiquito.
  buildFighterHud() {
    for (const slot of this.hud) slot.parts.forEach((part) => part.destroy());
    const { width } = this.scale;
    const fixed = (item) => item.setScrollFactor(0).setDepth(HUD_DEPTH);
    const many = this.fighters.length > 4;
    const slotW = many ? (width - 40) / this.fighters.length : 300;
    this.hud = this.fighters.map((fighter, i) => {
      const x = 20 + i * slotW;
      const color = hexToCss(fighter.color);
      const label = fixed(this.add.text(x, many ? 10 : 16, fighter.label, textStyle(many ? 16 : 22, color, { fontStyle: 'bold', ...OUTLINE })));
      const hearts = many
        ? fixed(this.add.text(x, 32, '', textStyle(17, '#ff5a7a', OUTLINE)))
        : fixed(this.add.text(x + Math.max(46, label.width + 10), 12, '', textStyle(26, '#ff5a7a', OUTLINE)));
      // La barra de poder (llena = LB + RB para la súper).
      const barX = many ? x : x + 46;
      const barW = many ? slotW - 24 : 180;
      const back = fixed(this.add.rectangle(barX, 62, barW, 10, 0xffffff, 0.2).setOrigin(0, 0.5));
      const meter = fixed(this.add.rectangle(barX, 62, barW, 10, 0xffd84d).setOrigin(0, 0.5).setScale(0, 1));
      const meterText = fixed(this.add.text(many ? x : x + 232, many ? 78 : 62, '', textStyle(many ? 12 : 15, '#ffd84d', { fontStyle: 'bold', ...OUTLINE })).setOrigin(0, 0.5));
      return { fighter, hearts, meter, meterText, shown: null, parts: [label, hearts, back, meter, meterText] };
    });
  }

  showBanner(title, subtitle = '', holdMs = 1300, { speak = true } = {}) {
    if (speak) say(title);
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

  // ---------- Mapa y tienda ----------

  openMap() {
    this.clearLevel();
    this.hideBanner();
    this.talk?.hide();
    this.phase = 'map';
    this.drawBackground(WORLDS[0], 0);
    this.screen?.destroy();
    this.map = showMap(this, this.mapIndex, buddyCount.get());
    this.screen = this.map.root;
  }

  updateMap() {
    const host = players.host();
    if (!host) return;
    const id = host.deviceId;
    const step = (controls.justPressed(id, 'right') ? 1 : 0) - (controls.justPressed(id, 'left') ? 1 : 0);
    if (step !== 0) {
      this.map.select(this.map.selected + step);
      sfx.select();
    }
    if (controls.justPressed(id, 'a')) {
      const { open, spot } = this.map.nodes[this.map.selected];
      if (!open) {
        sfx.back();
        return;
      }
      sfx.confirm();
      this.mapIndex = this.map.selected;
      this.closeScreen();
      if (spot.endless) this.startEndless();
      else if (spot.bossRush) this.startBossRush();
      else if (spot.nest) this.startNest();
      else this.startWorld(spot.world);
    } else if (controls.justPressed(id, 'x')) {
      sfx.confirm();
      this.openShop();
    } else if (controls.justPressed(id, 'y')) {
      // Y = cuántos amigos de la compu (0, 1, 2, 3 y otra vez 0).
      const count = (buddyCount.get() + 1) % (MAX_BUDDIES + 1);
      buddyCount.set(count);
      this.map.setBuddies(count);
      sfx.select();
      say(count === 0 ? 'Sin amigos de la compu' : count === 1 ? 'Un amigo de la compu' : `${count} amigos de la compu`);
    } else if (controls.justPressed(id, 'b')) {
      this.exit();
    }
  }

  closeScreen() {
    this.screen?.destroy();
    this.screen = null;
    this.map = null;
  }

  openShop() {
    this.closeScreen();
    this.phase = 'shop';
    this.shop = new Shop(this);
  }

  updateShop() {
    if (!this.shop.update()) return;
    this.shop.destroy();
    this.shop = null;
    sfx.back();
    this.openMap();
  }

  // ---------- Peleadores: los jugadores, sus amigos de la compu y los rescatados ----------

  // Al empezar: todos completos, con su ropa de la tienda, sus amigos de la compu y los contadores en cero.
  beginRun() {
    this.clearLevel();
    for (const f of this.fighters.filter((g) => g.isCpu)) f.destroy();
    this.fighters = [...this.humans];
    for (let i = 0; i < buddyCount.get(); i += 1) this.addCpu(this.freeCharacter(), `C${i + 1}`, `Compu ${i + 1}`, 0, 0);
    for (const f of this.humans) dressFighter(this, f, wardrobe.outfit(f.deviceId));
    for (const f of this.fighters) {
      f.reset();
      f.stats = newStats();
    }
    this.buildFighterHud();
    this.combo.reset();
    this.worldMs = 0;
    this.worldCoins = 0;
    this.bossesBeaten = 0;
    this.anyoneFell = false;
    this.endlessOver = false;
    this.rushOver = false;
    this.nestOver = false;
  }

  // Un peleador de la compu (amigo o rescatado), con el primer color que no use nadie.
  addCpu(character, label, name, x, y) {
    const used = new Set(this.fighters.map((f) => f.color));
    const color = (PLAYER_COLORS.find((c) => !used.has(c.hex)) ?? PLAYER_COLORS[this.fighters.length % PLAYER_COLORS.length]).hex;
    const brain = new CpuBuddy();
    const fighter = new Fighter(this, { deviceId: null, slot: -1 }, x, y, character, { input: brain.input, label, color });
    fighter.brain = brain;
    fighter.name = name;
    this.fighters.push(fighter);
    return fighter;
  }

  freeCharacter() {
    const used = new Set(this.fighters.map((f) => f.character));
    const free = FRIENDS.filter((c) => !used.has(c));
    return Phaser.Utils.Array.GetRandom(free.length ? free : FRIENDS);
  }

  // ---------- Mundos y rondas ----------

  startWorld(index) {
    this.endless = false;
    this.bossRush = false;
    this.nestMode = false;
    this.worldIndex = index;
    this.world = WORLDS[index];
    this.drawBackground(this.world, this.world.waves.length);
    this.beginRun();
    this.placeFighters(0);
    this.startWave(0);
  }

  // Modo sin fin: siempre en el mismo tramo, una ronda tras otra (con los monstruos de los mundos ya abiertos).
  startEndless() {
    this.endless = true;
    this.bossRush = false;
    this.nestMode = false;
    this.endlessNumber = 0;
    const open = WORLDS.filter((world) => rewards.unlocked(world.unlock));
    this.endlessWorlds = open;
    this.world = Phaser.Utils.Array.GetRandom(open);
    this.worldIndex = WORLDS.indexOf(this.world);
    this.drawBackground(this.world, 0);
    this.beginRun();
    this.placeFighters(0);
    this.nextEndlessWave();
  }

  nextEndlessWave() {
    this.endlessNumber += 1;
    const wave = endlessWave(this.endlessNumber, this.endlessWorlds, MONSTER_TYPES);
    this.beginWave(wave, 0, `Sin fin · Ronda ${this.endlessNumber}`);
    // Cada tanto aparecen cajas nuevas.
    if (this.endlessNumber % 2 === 1) this.props.place(ARENA.left + 100, ARENA.right - 100, ARENA.top, ARENA.bottom);
  }

  // Jefes en serie: los jefes de los mundos ya ganados, uno tras otro, contra el reloj.
  startBossRush() {
    this.endless = false;
    this.bossRush = true;
    this.nestMode = false;
    this.rushWaves = bossRushWaves(beatenWorlds(), MONSTER_TYPES);
    this.rushIndex = 0;
    this.world = this.rushWaves[0].world;
    this.worldIndex = WORLDS.indexOf(this.world);
    this.drawBackground(this.world, 0);
    this.beginRun();
    this.placeFighters(0);
    this.nextRushBoss();
  }

  nextRushBoss() {
    const wave = this.rushWaves[this.rushIndex];
    if (wave.world !== this.world) {
      this.world = wave.world;
      this.worldIndex = WORLDS.indexOf(this.world);
      this.drawBackground(this.world, 0);
    }
    this.beginWave(wave, 0, `Jefes · ${this.rushIndex + 1} de ${this.rushWaves.length}`);
    this.props.place(ARENA.left + 100, ARENA.right - 100, ARENA.top, ARENA.bottom);
  }

  // Defiende el nido: en medio hay un nido con huevos y varios monstruos van por él en vez de por los jugadores.
  // Son NEST_ROUNDS rondas (con los monstruos de los mundos ya abiertos; la última con jefe); si le pegan NEST_HP
  // veces, se llevan los huevos.
  startNest() {
    this.endless = false;
    this.bossRush = false;
    this.nestMode = true;
    this.nestNumber = 0;
    const open = WORLDS.filter((world) => rewards.unlocked(world.unlock));
    this.nestWorlds = open;
    this.world = Phaser.Utils.Array.GetRandom(open);
    this.worldIndex = WORLDS.indexOf(this.world);
    this.drawBackground(this.world, 0);
    this.beginRun();
    this.placeFighters(0);
    this.createNest();
    this.nextNestWave();
  }

  nextNestWave() {
    this.nestNumber += 1;
    const wave = nestWave(this.nestNumber, this.nestWorlds, MONSTER_TYPES);
    this.beginWave(wave, 0, `El nido · ${wave.title}`);
    if (this.nestNumber % 2 === 1) this.props.place(ARENA.left + 100, ARENA.right - 100, ARENA.top, ARENA.bottom);
  }

  // El nido: ramitas, tres huevos (se van quitando conforme le pegan) y su barrita de vida. Los huevos son el dibujo
  // del huevito asomándose si ya llegó; si no, óvalos con manchitas.
  createNest() {
    const x = (ARENA.left + ARENA.right) / 2;
    const y = (ARENA.top + ARENA.bottom) / 2 + 30;
    this.nest = { x, y, radius: 46, hp: NEST_HP, maxHp: NEST_HP, down: false, isNest: true };
    const twigs = this.add.ellipse(0, 0, 130, 46, 0x8b5a2b).setStrokeStyle(5, COLORS.ink);
    const eggArt = this.textures.exists('brawl:objeto-huevo-dino');
    this.nestEggs = [-30, 0, 30].map((dx, i) => {
      const eggY = -18 - (i === 1 ? 8 : 0);
      if (!eggArt) return this.add.ellipse(dx, eggY, 32, 40, 0xfff4e0).setStrokeStyle(4, COLORS.ink);
      const egg = this.add.image(dx, eggY, 'brawl:objeto-huevo-dino');
      return egg.setScale(48 / egg.height);
    });
    const spots = eggArt ? [] : this.nestEggs.map((egg) => this.add.circle(egg.x + 5, egg.y - 4, 5, 0x4cd97b));
    this.nestBar = this.add.rectangle(-50, -66, 100, 10, 0x4cd97b).setOrigin(0, 0.5);
    this.nestSprite = this.add.container(x, y, [twigs, ...this.nestEggs, ...spots, this.add.rectangle(0, -66, 106, 16, COLORS.ink), this.nestBar]);
    this.nestSprite.setDepth(y - 1);
    this.nestSpots = spots;
  }

  clearNest() {
    this.nestSprite?.destroy();
    this.nestSprite = null;
    this.nest = null;
  }

  // Le pegaron al nido: se va un pedacito de su barra (y un huevo cada tercio).
  nestHit(monster) {
    const nest = this.nest;
    nest.hp -= 1;
    this.nestBar.setScale(Math.max(0, nest.hp / nest.maxHp), 1);
    this.nestBar.setFillStyle(nest.hp > nest.maxHp / 3 ? 0x4cd97b : 0xff5a5f);
    const eggs = Math.ceil((nest.hp / nest.maxHp) * 3);
    this.nestEggs.forEach((egg, i) => egg.setVisible(i < eggs));
    this.nestSpots.forEach((spot, i) => spot.setVisible(i < eggs));
    popText(this, nest.x, nest.y - 90, '¡Los huevos!', '#ff5a7a');
    this.cameras.main.shake(120, 0.004);
    sfx.hit(0.5);
    monster.taunt();
    if (nest.hp === Math.floor(nest.maxHp / 3)) say('¡Cuiden el nido!');
    if (nest.hp <= 0) {
      nest.down = true;
      this.lose('¡Se llevaron los huevos!');
    }
  }

  winNest() {
    rewards.earn('pelea-nido');
    this.phase = 'results';
    this.endMs = 0;
    this.nextWorld = null;
    this.nestOver = true;
    confetti(this, this.fighters.map((f) => f.color));
    this.celebrate();
    // ¡Nacen los huevos!
    for (const egg of this.nestEggs) if (egg.visible) burst(this, this.nest.x + egg.x, this.nest.y + egg.y, 0x4cd97b, 10);
    say('¡El nido está a salvo! ¡Nacieron los dinos!');
    const extra = this.saveRecords();
    this.screen = showResults(this, this.fighters, { title: '¡El nido está a salvo! 🐣', hint: 'A = otra vez   ·   B = mapa', extra });
  }

  startWave(index) {
    this.waveIndex = index;
    const wave = this.world.waves[index];
    const mini = index === MINI_WAVE ? this.world.mini : null;
    this.beginWave(wave, index, `${this.world.name} · Ronda ${index + 1} de ${this.world.waves.length}`, mini);
    this.props.place(ARENA.left + 120, ARENA.right - 120, ARENA.top, ARENA.bottom);
    const middle = (ARENA.top + ARENA.bottom) / 2;
    // En el segundo tramo, un animal para montar; desde ahí, las trampas del mundo; y en su tramo, la jaula.
    if (index === 1 && this.world.mount && this.mounts.list.length === 0) this.mounts.place(this.world.mount, ARENA.left + 320, middle + 40);
    if (index >= 1) this.traps.place(this.world.trap, ARENA.left + 120, ARENA.right - 120, ARENA.top, ARENA.bottom);
    if (index === this.world.cage && !this.props.breakables.some((b) => b.cage) && !this.fighters.some((f) => f.rescued)) {
      this.props.placeCage(ARENA.right - 260, middle, this.freeCharacter());
    }
    const firstEver = this.worldIndex === 0 && index === 0;
    if (firstEver) this.showBanner(wave.title, 'X = pegar   ·   B = especial   ·   A = saltar', 2200);
  }

  beginWave(wave, section, label, mini = null) {
    setSection(section);
    this.cameras.main.setScroll(section * SECTION_W, 0);
    this.spawnQueue = buildSpawnQueue(wave, this.fighters.length, MONSTER_TYPES, mini);
    this.spawnMs = FIRST_SPAWN_MS;
    this.phase = 'fight';
    this.goArrow.setVisible(false);
    // Al empezar cada ronda, los que estaban caídos se levantan, y los que se quedaron en otro tramo llegan a este.
    for (const fighter of this.fighters) if (fighter.down) fighter.reset();
    this.fighters.forEach((fighter, i) => {
      if (fighter.x >= ARENA.left + 20 && fighter.x <= ARENA.right) return;
      fighter.x = ARENA.left + 170 + i * 70;
      fighter.y = 470 + (i % 2) * 80;
    });
    this.waveLabel = label;
    this.showBanner(wave.title, section === 0 && !this.endless ? this.world.name : '', 1300);
  }

  placeFighters(section) {
    this.fighters.forEach((fighter, i) => {
      fighter.x = section * SECTION_W + 220 + i * 70;
      fighter.y = 470 + (i % 2) * 80;
      fighter.z = 0;
      fighter.vz = 0;
    });
  }

  clearEnemies() {
    for (const monster of this.monsters) monster.destroy();
    for (const ball of this.fireballs) ball.sprite.destroy();
    for (const shot of this.shots) shot.sprite.destroy();
    this.monsters = [];
    this.fireballs = [];
    this.shots = [];
    this.hideBossBar();
    this.replay.clear();
  }

  clearLevel() {
    this.clearEnemies();
    this.clearNest();
    this.props.clear();
    this.coins.clear();
    this.mounts.clear();
    this.traps.clear();
    this.pets.clear();
    for (const heart of this.hearts) heart.sprite.destroy();
    this.hearts = [];
    setSection(0);
    this.cameras.main.setScroll(0, 0);
    this.goArrow?.setVisible(false);
  }

  // ---------- Cada cuadro ----------

  update() {
    const dt = frameDelta();
    this.updateExit(dt);
    this.talk.update(dt);
    if (this.phase === 'map') {
      this.updateMap();
      return;
    }
    if (this.phase === 'shop') {
      this.updateShop();
      return;
    }
    if (this.phase === 'replay') {
      this.updateReplay(dt);
      return;
    }
    if (['results', 'lost'].includes(this.phase)) this.updateEndScreen(dt);
    if (this.phase === 'bossIntro') {
      for (const fighter of this.fighters) fighter.render();
      for (const monster of this.monsters) monster.render();
      return;
    }
    if (this.phase === 'fight' || this.phase === 'walk') this.worldMs += dt;

    for (const fighter of this.fighters) fighter.brain?.think(dt, this, fighter);
    for (const fighter of this.fighters) fighter.update(dt, this.fighters);
    if (this.phase === 'fight') this.updateSpawns(dt);
    // (Los que están invisibles no cuentan: los monstruos no los ven.)
    const visible = this.fighters.filter((f) => f.ghostMs <= 0);
    for (const monster of this.monsters) {
      monster.update(dt, visible);
      if (monster.grabbedBy) {
        const f = monster.grabbedBy;
        monster.x = f.x + f.facing * (f.radius + monster.radius * 0.6);
        monster.y = f.y + 2;
      }
    }
    this.handleMonsterRequests();
    this.updateFireballs(dt);
    this.updateShots(dt);
    this.separateMonsters();
    this.resolveHits();
    this.updateSpecials();
    this.updateThrown();
    this.updateHearts(dt);
    this.props.update(dt, this.fighters);
    this.coins.update(dt, this.fighters, (f) => this.coinPicked(f));
    this.mounts.update(dt, this.fighters);
    this.traps.update(dt, this.fighters, this.monsters, this.phase === 'fight');
    this.pets.update(dt, this.monsters);
    this.combo.update(dt);
    if (this.boss?.type.boss && !this.boss.dead) this.replay.record(dt, this.fighters, this.boss);
    this.removeDefeated();
    if (this.phase === 'walk') this.updateWalk(dt);

    for (const fighter of this.fighters) fighter.render();
    for (const monster of this.monsters) monster.render();
    this.updateHud();
    this.checkWaveState();
  }

  updateSpawns(dt) {
    if (this.spawnQueue.length === 0) return;
    this.spawnMs -= dt;
    if (this.spawnMs > 0 || this.monsters.length >= MAX_ALIVE) return;
    // "mini:<tipo>" = el mini jefe del mundo.
    const entry = this.spawnQueue[0];
    const mini = entry.startsWith('mini:');
    const type = mini ? entry.slice(5) : entry;
    // Llega el jefe: primero su presentación (todo se detiene) y luego entra.
    if (MONSTER_TYPES[type].boss && !this.bossAnnounced) {
      this.bossAnnounced = true;
      this.phase = 'bossIntro';
      music.play('jefe');
      showBossIntro(this, MONSTER_TYPES[type], () => {
        this.phase = 'fight';
      });
      return;
    }
    this.spawnQueue.shift();
    const fromLeft = Math.random() < 0.5;
    const x = fromLeft ? ARENA.left - 80 : ARENA.right + 80;
    const y = Phaser.Math.Between(ARENA.top + 20, ARENA.bottom - 20);
    const monster = new Monster(this, type, x, y, { mini });
    this.monsters.push(monster);
    // Con más peleadores el jefe (y el mini jefe) aguanta más, para que no se acabe en un suspiro.
    const tougher = 1 + BOSS_HP_PER_PLAYER * (this.fighters.length - 1);
    if (monster.type.boss) {
      this.bossAnnounced = false;
      monster.hp = monster.maxHp = Math.round(monster.type.hp * tougher);
      this.replay.clear();
      this.showBossBar(monster);
    } else if (mini) {
      monster.hp = monster.maxHp = Math.round(monster.maxHp * tougher);
      this.showBossBar(monster);
      this.showBanner('¡Mini jefe!', monster.type.name, 1400, { speak: false });
      this.talk.mini(monster.type.name);
      sfx.boom();
    }
    this.spawnMs = SPAWN_INTERVAL_MS;
  }

  // Lo que pidieron los jefes este cuadro: ayudantes, una bola de fuego (o tinta, nieve, magia...) o que se enojaron.
  handleMonsterRequests() {
    for (const monster of [...this.monsters]) {
      const request = monster.request;
      if (!request) continue;
      monster.request = null;
      if (request.kind === 'summon') {
        const room = MAX_ALIVE + 2 - this.monsters.length;
        for (let i = 0; i < Math.min(request.count, room); i += 1) {
          const helper = new Monster(this, request.type, monster.x + (i === 0 ? -1 : 1) * (monster.radius + 40), monster.y);
          helper.entered = true;
          this.monsters.push(helper);
          burst(this, helper.x, helper.y, helper.type.color, 8);
        }
        popText(this, monster.x, monster.y - monster.radius - 40, '¡Vengan, ayudantes!', '#ffffff');
      } else if (request.kind === 'fireball') {
        const [core, edge, glow] = FIREBALL_LOOKS[request.look] ?? FIREBALL_LOOKS.fire;
        const sprite = this.add.container(request.x, request.y - 30, [
          this.add.circle(0, 0, FIREBALL.radius + 8, glow, 0.45),
          this.add.circle(0, 0, FIREBALL.radius, core).setStrokeStyle(4, edge),
        ]);
        sprite.setDepth(request.y + 1);
        this.fireballs.push({ x: request.x, y: request.y, dir: request.dir, look: request.look, sprite, owner: request.owner });
        sfx.special();
      } else if (request.kind === 'angry') {
        // A la mitad de su vida el jefe se enoja: se pone rojo, va más rápido y usa sus poderes más seguido.
        comicHit(this, monster.x, monster.y - monster.radius - 60, '¡GRRR!', { big: true, red: true });
        shockwave(this, monster.x, monster.y - monster.radius * 0.6, 0xff4d4d);
        this.cameras.main.shake(300, 0.01);
        sfx.boom();
        this.talk.angry(monster.type.name);
      }
    }
  }

  updateFireballs(dt) {
    this.fireballs = this.fireballs.filter((ball) => {
      ball.x += ball.dir * FIREBALL.speed * (dt / 1000);
      ball.sprite.setPosition(ball.x, ball.y - 30).setAngle(ball.x);
      const victim = this.fighters.find((f) => !f.down && Math.abs(f.x - ball.x) < f.radius + FIREBALL.radius && Math.abs(f.y - ball.y) < FIREBALL.lane);
      if (victim && victim.hurt(ball.x)) {
        ball.owner?.taunt();
        popText(this, victim.x, victim.y - 90, FIREBALL_WORDS[ball.look] ?? '¡Auch!', '#ff9a3c');
        burst(this, ball.x, ball.y - 30, FIREBALL_LOOKS[ball.look]?.[0] ?? 0xff9a3c, 10);
        ball.sprite.destroy();
        return false;
      }
      if (ball.x < ARENA.left - 120 || ball.x > ARENA.right + 120) {
        ball.sprite.destroy();
        return false;
      }
      return true;
    });
  }

  // Empuja a los monstruos que se enciman para que no se vuelvan uno solo.
  separateMonsters() {
    const list = this.monsters.filter((m) => !m.grabbedBy && m.state !== 'thrown');
    for (let i = 0; i < list.length; i += 1) {
      for (let j = i + 1; j < list.length; j += 1) {
        const a = list[i];
        const b = list[j];
        const dx = b.x - a.x;
        const dy = (b.y - a.y) * 1.5;
        const dist = Math.hypot(dx, dy) || 1;
        const min = (a.radius + b.radius) * 0.9;
        if (dist >= min) continue;
        const push = (min - dist) / 2;
        a.x -= (dx / dist) * push;
        b.x += (dx / dist) * push;
        a.y -= (dy / dist) * push * 0.5;
        b.y += (dy / dist) * push * 0.5;
      }
    }
  }

  // ---------- Golpes ----------

  // Un peleador le pega a un monstruo (con un golpe, su especial, un objeto, su mascota...). `damage` en golpes
  // normales. Cada golpe suma al combo del equipo.
  hitMonster(fighter, monster, damage, { power = 1, word = null, big = false } = {}) {
    if (monster.dead || monster.grabbedBy) return;
    monster.hurt(fighter.x, damage, power);
    monster.lastHitBy = fighter;
    fighter.landedHit();
    comicHit(this, monster.x, monster.y - monster.radius - 40, word ?? randomPow(), { big, red: big });
    // El golpe "se siente": se congela un instante (más en los fuertes).
    setTimeScale(0, big ? 110 : 45);
    if (big) shockwave(this, monster.x, monster.y - monster.radius * 0.6, fighter.color);
    this.cameras.main.shake(big ? 120 : 60, big ? 0.006 : 0.003);
    sfx.hit(big ? 0.8 : 0.4);
    this.comboHit();
  }

  comboHit() {
    const count = this.combo.hit();
    if (count >= COMBO_STICKER_AT) rewards.earn('pelea-combo');
    if (count % 10 === 0) this.talk.combo(count);
  }

  resolveHits() {
    for (const fighter of this.fighters) {
      if (!fighter.isAttacking() || fighter.down) continue;
      this.props.hitAt(fighter.x + fighter.facing * (fighter.radius + 20), fighter.y, fighter.reach + 20, fighter);
      for (const monster of this.monsters) {
        if (monster.dead || monster.grabbedBy || fighter.hitThisAttack.has(monster) || !fighter.canHit(monster, fighter.reach)) continue;
        fighter.hitThisAttack.add(monster);
        // Un monstruo que aventó un compañero: ¡combo doble en el aire!
        if (monster.state === 'thrown' && monster.thrownBy && monster.thrownBy !== fighter) this.airCombo(fighter, monster);
        else if (fighter.finisher) this.hitMonster(fighter, monster, 2 * fighter.power, { power: 2.4, word: '¡Remate!', big: true });
        else this.hitMonster(fighter, monster, fighter.power, { word: fighter.mount?.data.word });
      }
    }

    // Con la estrella, lo que tocas se lastima.
    const now = this.time.now;
    for (const fighter of this.fighters) {
      if (fighter.starMs <= 0 || fighter.down) continue;
      for (const monster of this.monsters) {
        if (monster.dead || now - (monster.starHitAt ?? 0) < STAR_HIT_MS || !monster.touches(fighter)) continue;
        monster.starHitAt = now;
        this.hitMonster(fighter, monster, 1, { word: '⭐' });
      }
    }

    for (const monster of this.monsters) {
      if (monster.state !== 'lunge' || monster.dead) continue;
      // Defiende el nido: el que se lanza contra el nido le pega (una vez por embestida).
      const nest = this.nest;
      if (nest && !nest.down && monster.target === nest && !monster.hitDuringLunge.has(nest)) {
        if (Math.hypot(monster.x - nest.x, (monster.y - nest.y) * 1.6) < nest.radius + monster.radius) {
          monster.hitDuringLunge.add(nest);
          this.nestHit(monster);
        }
      }
      for (const fighter of this.fighters) {
        if (monster.hitDuringLunge.has(fighter) || !monster.touches(fighter)) continue;
        monster.hitDuringLunge.add(fighter);
        if (fighter.hurt(monster.x)) {
          popText(this, fighter.x, fighter.y - 90, '¡Auch!', '#ff5a7a');
          monster.taunt();
        }
      }
    }
  }

  airCombo(fighter, monster) {
    this.hitMonster(fighter, monster, AIR_COMBO_DAMAGE * fighter.power, { power: 2.6, word: '¡Combo doble!', big: true });
    // Cuenta doble para el combo del equipo.
    this.comboHit();
    burst(this, monster.x, monster.y - monster.radius, 0xffd84d, 12);
    this.talk.airCombo();
  }

  // Los monstruos que avientan tumban como boliche a los que encuentren en su carril.
  updateThrown() {
    for (const thrown of this.monsters) {
      if (thrown.state !== 'thrown') continue;
      for (const other of this.monsters) {
        if (other === thrown || other.dead || other.grabbedBy || thrown.bowled.has(other)) continue;
        if (Math.abs(other.x - thrown.x) > other.radius + thrown.radius || Math.abs(other.y - thrown.y) > 40 + other.radius * 0.3) continue;
        thrown.bowled.add(other);
        const by = thrown.thrownBy;
        if (by) this.hitMonster(by, other, 2, { power: 1.8, word: thrown.bowled.size > 1 ? '¡Chuza!' : '¡Boliche!', big: true });
      }
    }
  }

  thrown(fighter, monster) {
    monster.thrownBy = fighter;
    monster.lastHitBy = fighter;
    popText(this, monster.x, monster.y - monster.radius - 50, '¡Allá va!', '#ffd84d');
  }

  // ---------- Especiales ----------

  specialStarted(fighter, data) {
    popText(this, fighter.x, fighter.y - 120, data.name, hexToCss(fighter.color));
    if (data.kind === 'teleport') this.teleport(fighter);
    else if (data.kind === 'beam') this.fireBeam(fighter, data);
    else if (data.kind === 'shot') this.fireShot(fighter, data);
    else if (data.kind === 'heal') this.healAround(fighter, data);
    else if (data.kind === 'ghost') sfx.ghost();
    else if (data.kind === 'breath') {
      const colors = data.look === 'water' ? [0x3fa7ff, 0x9fd8ff] : [0xff9a3c, 0xffd84d];
      fighter.breath = this.add.container(0, 0, [this.add.ellipse(0, 0, data.reach, 44, colors[0], 0.8), this.add.ellipse(-10, 0, data.reach * 0.6, 24, colors[1], 0.9)]);
      sfx.fire();
    } else sfx.special();
  }

  // Cada cuadro: lo que pega el especial que está haciendo cada quien.
  updateSpecials() {
    for (const fighter of this.fighters) {
      const s = fighter.special;
      // El fuego (o el agua) se apaga cuando se acaba el especial (o si le pegaron a medio soplido).
      if (fighter.breath && s?.data.kind !== 'breath') {
        fighter.breath.destroy();
        fighter.breath = null;
      }
      if (!s && fighter.dashMs <= 0) continue;
      const data = s?.data;
      const kind = data?.kind;
      const inFront = (reach) => this.monsters.filter((m) => !m.dead && !m.grabbedBy && fighter.canHit(m, reach));
      const once = (monster) => {
        if (s.hit.has(monster)) return false;
        s.hit.add(monster);
        return true;
      };
      if (kind === 'punch' && s.t >= 120 && !s.fired) {
        s.fired = true;
        this.props.hitAt(fighter.x + fighter.facing * 60, fighter.y, data.reach, fighter);
        for (const m of inFront(data.reach)) this.hitMonster(fighter, m, data.damage * fighter.power, { power: data.power, word: '¡PUM!', big: true });
        shockwave(this, fighter.x + fighter.facing * 60, fighter.y - 40, fighter.color);
      } else if (kind === 'dash' && fighter.dashMs > 0) {
        this.props.hitAt(fighter.x, fighter.y, fighter.radius, fighter);
        for (const m of this.monsters) {
          if (m.dead || m.grabbedBy || Math.abs(m.x - fighter.x) > m.radius + fighter.radius || Math.abs(m.y - fighter.y) > 40 + m.radius * 0.3) continue;
          if (once(m)) this.hitMonster(fighter, m, data.damage * fighter.power, { power: 1.6 });
        }
      } else if (kind === 'spin' && s.t >= 100 && !s.fired) {
        s.fired = true;
        this.areaHit(fighter, fighter.x, fighter.y, data.radius, data.damage);
      } else if (kind === 'flurry') {
        const k = Math.floor(s.t / data.gapMs);
        if (k !== s.tick && k < data.hits) {
          s.tick = k;
          for (const m of inFront(data.reach)) this.hitMonster(fighter, m, data.damage * fighter.power, { word: '¡Ras!' });
        }
      } else if (kind === 'breath') {
        const k = Math.floor(s.t / data.tickMs);
        fighter.breath?.setPosition(fighter.x + fighter.facing * (fighter.radius + data.reach / 2), fighter.y - 30 - fighter.z).setScale(fighter.facing, 0.9 + Math.random() * 0.2).setDepth(fighter.y + 1);
        if (k !== s.tick) {
          s.tick = k;
          for (const m of inFront(data.reach)) {
            this.hitMonster(fighter, m, data.damage * fighter.power, { power: data.push ? 2.2 : 0.6, word: data.look === 'water' ? '¡Splash!' : '¡Fuego!' });
          }
        }
      } else if (kind === 'teleport' && s.t >= 140 && !s.fired) {
        s.fired = true;
        for (const m of inFront(40)) this.hitMonster(fighter, m, data.damage * fighter.power, { power: 1.8, word: '¡Sorpresa!', big: true });
      }
    }
  }

  // Al caer al piso: el aplastón del resorte (trampa) o el del súper salto.
  landed(fighter) {
    if (fighter.springSlam) {
      fighter.springSlam = false;
      this.areaHit(fighter, fighter.x, fighter.y, SPRING_SLAM.radius, SPRING_SLAM.damage);
      popText(this, fighter.x, fighter.y - 110, '¡Aplastón!', '#ffd84d');
      this.cameras.main.shake(150, 0.008);
    }
    if (fighter.special?.data.kind !== 'slam') return;
    const data = fighter.special.data;
    fighter.special = null;
    this.areaHit(fighter, fighter.x, fighter.y, data.radius, data.damage);
    this.cameras.main.shake(200, 0.01);
  }

  areaHit(fighter, x, y, radius, damage) {
    shockwave(this, x, y - 20, fighter.color);
    this.props.hitAt(x, y, radius, fighter);
    for (const m of this.monsters) {
      if (m.dead || m.grabbedBy || Math.hypot(m.x - x, (m.y - y) * 1.6) > radius + m.radius) continue;
      this.hitMonster(fighter, m, damage * fighter.power, { power: 2, word: '¡BUM!', big: true });
    }
  }

  // Ninja: humo y aparece detrás del monstruo más cercano.
  teleport(fighter) {
    let target = null;
    let best = Infinity;
    for (const m of this.monsters) {
      const d = Math.hypot(m.x - fighter.x, m.y - fighter.y);
      if (!m.dead && m.entered && d < best) [target, best] = [m, d];
    }
    burst(this, fighter.x, fighter.y - 30, 0x8a86b8, 10);
    sfx.poof();
    if (!target) return;
    const side = Math.sign(fighter.x - target.x) || 1;
    fighter.x = Phaser.Math.Clamp(target.x - side * (target.radius + fighter.radius + 6), ARENA.left, ARENA.right);
    fighter.y = target.y;
    fighter.facing = Math.sign(target.x - fighter.x) || fighter.facing;
    burst(this, fighter.x, fighter.y - 30, 0x8a86b8, 10);
  }

  // Robot: un rayo larguísimo por su carril.
  fireBeam(fighter, data) {
    const x = fighter.x + fighter.facing * (fighter.radius + data.length / 2);
    const beam = this.add.rectangle(x, fighter.y - 34 - fighter.z, data.length, 16, 0xff4d6d).setStrokeStyle(4, 0xffffff).setDepth(fighter.y + 1);
    this.tweens.add({ targets: beam, alpha: 0, scaleY: 0.2, duration: 350, onComplete: () => beam.destroy() });
    sfx.laser();
    for (const m of this.monsters) {
      const ahead = (m.x - fighter.x) * fighter.facing;
      if (m.dead || m.grabbedBy || ahead < 0 || ahead > data.length + m.radius || Math.abs(m.y - fighter.y) > 36 + m.radius * 0.3) continue;
      this.hitMonster(fighter, m, data.damage * fighter.power, { word: '¡Zap!' });
    }
  }

  // Estrella y Pirata: lanzan algo por su carril que le pega al primero que encuentre.
  fireShot(fighter, data) {
    const sprite =
      data.look === 'cannon'
        ? this.add.container(0, 0, [this.add.circle(0, 0, SHOT.radius, 0x2a2a36).setStrokeStyle(3, 0xffffff), this.add.circle(-6, -6, 5, 0xffffff, 0.6)])
        : this.add.star(0, 0, 5, 10, 24, 0xffc93c).setStrokeStyle(3, 0xffffff);
    this.shots.push({ x: fighter.x + fighter.facing * 40, y: fighter.y, dir: fighter.facing, speed: data.speed, damage: data.damage * fighter.power, owner: fighter, sprite });
    data.look === 'cannon' ? sfx.boom() : sfx.throw();
  }

  updateShots(dt) {
    this.shots = this.shots.filter((shot) => {
      shot.x += shot.dir * shot.speed * (dt / 1000);
      shot.sprite.setPosition(shot.x, shot.y - 40).setDepth(shot.y + 1).setAngle(shot.x);
      this.props.hitAt(shot.x, shot.y, SHOT.radius, { attackId: `shot-${shot.x | 0}` });
      const victim = this.monsters.find((m) => !m.dead && !m.grabbedBy && Math.abs(m.x - shot.x) < m.radius + SHOT.radius && Math.abs(m.y - shot.y) < SHOT.lane + m.radius * 0.3);
      if (victim) this.hitMonster(shot.owner, victim, shot.damage, { power: 1.5 });
      if (victim || shot.x < ARENA.left - 100 || shot.x > ARENA.right + 100) {
        shot.sprite.destroy();
        return false;
      }
      return true;
    });
  }

  // Hada: cura un corazón a ella y a los compañeros que estén cerca (y levanta a los caídos cercanos un poquito).
  healAround(fighter, data) {
    burst(this, fighter.x, fighter.y - 40, 0xff9ee8, 16);
    sfx.sparkle();
    for (const f of this.fighters) {
      if (Math.hypot(f.x - fighter.x, (f.y - fighter.y) * 1.4) > data.radius) continue;
      if (f.down) f.reviveMs += 600;
      else if (f.heal(data.hearts)) popText(this, f.x, f.y - 100, '+♥', '#ff5a7a');
    }
  }

  // La bomba (objeto): explota y le pega a todo lo de alrededor.
  throwBomb(fighter) {
    this.props.throwBomb(fighter);
    sfx.throw();
  }

  explode(x, y, radius, damage, owner) {
    burst(this, x, y - 20, 0xff9a3c, 18);
    burst(this, x, y - 20, 0xffffff, 10);
    comicHit(this, x, y - 70, '¡BUM!', { big: true, red: true });
    shockwave(this, x, y - 20, 0xff9a3c);
    this.cameras.main.shake(200, 0.01);
    sfx.boom();
    this.props.hitAt(x, y, radius, { attackId: `bomb-${x | 0}` });
    for (const m of this.monsters) {
      if (m.dead || m.grabbedBy || Math.hypot(m.x - x, (m.y - y) * 1.5) > radius + m.radius) continue;
      this.hitMonster(owner, m, damage, { power: 2 });
    }
  }

  // ---------- Objetos, animales y rescates ----------

  itemTaken(fighter, kind, word) {
    this.talk.item(word);
  }

  shieldBlocked(fighter) {
    popText(this, fighter.x, fighter.y - 110, fighter.shieldHits > 0 ? '¡Bloqueado!' : '¡Se rompió el escudo!', '#7fdcff');
    if (fighter.shieldHits > 0) sfx.block();
    else sfx.shieldBreak();
  }

  mounted(fighter, mount) {
    fighter.stats.rides += 1;
    rewards.earn('pelea-montar');
    this.talk.mounted(fighter.name, mount.data.name.toLowerCase());
  }

  // Le pegaron al que va montado: el animal aguanta el golpe (y si ya no aguanta, se va).
  mountHit(fighter) {
    sfx.hit(0.5);
    if (this.mounts.hit(fighter)) popText(this, fighter.x, fighter.y - 120, '¡Te bajaste!', '#ffffff');
  }

  // La comida o el corazón más cercano (para que la compu vaya por él cuando le falta vida).
  nearestSnack(fighter, range) {
    let best = this.props.nearestFood(fighter, range);
    let bestD = best ? Math.hypot(best.x - fighter.x, best.y - fighter.y) : range;
    for (const heart of this.hearts) {
      const d = Math.hypot(heart.x - fighter.x, heart.y - fighter.y);
      if (d < bestD) [best, bestD] = [heart, d];
    }
    return best;
  }

  // Rompieron la jaula: el amigo de adentro pelea con ellos el resto del mundo.
  rescue(character, x, y, by) {
    const name = CHARACTERS[character].name;
    const friend = this.addCpu(character, name, name, x, y);
    friend.rescued = true;
    friend.invulnerableMs = 1500;
    friend.celebrate();
    if (by?.stats) by.stats.rescues += 1;
    brawlRecords.addRescue();
    if (!this.endless && !this.bossRush) rescues.save(this.worldIndex);
    rewards.earn('pelea-rescate');
    this.buildFighterHud();
    burst(this, x, y - 40, 0xffd84d, 18);
    sfx.win();
    this.showBanner('¡Rescatado!', `${name} pelea con ustedes`, 1600, { speak: false });
    this.talk.rescued(name);
  }

  coinPicked(fighter) {
    fighter.stats.coins += 1;
    this.worldCoins += 1;
    coinBank.add(1);
  }

  // ---------- Súper y golpe en equipo ----------

  meterFull(fighter) {
    popText(this, fighter.x, fighter.y - 120, fighter.isCpu ? '¡Barra llena!' : '¡Barra llena! LB + RB', '#ffd84d');
    sfx.meterFull();
  }

  superStarted(fighter) {
    burst(this, fighter.x, fighter.y - 40, 0xffd84d, 16);
    popText(this, fighter.x, fighter.y - 130, '¡Súper!', '#ffd84d');
    this.cameras.main.flash(200, 255, 236, 160);
    // ¿Alguien más se volvió súper hace poquito? ¡Golpe en equipo!
    const partners = this.fighters.filter((f) => f !== fighter && f.superMs > 0 && this.time.now - f.superStartedAt < TEAM_WINDOW_MS);
    if (partners.length > 0) this.teamAttack([fighter, ...partners]);
  }

  teamAttack(team) {
    this.showBanner('¡GOLPE EN EQUIPO!', team.map((f) => f.label).join(' + '), 1600);
    this.cameras.main.flash(400, 255, 255, 255);
    this.cameras.main.shake(500, 0.02);
    sfx.boom();
    rewards.earn('pelea-equipo');
    for (const m of this.monsters) {
      const by = team[Math.floor(Math.random() * team.length)];
      this.hitMonster(by, m, m.type.boss ? TEAM_DAMAGE.boss : TEAM_DAMAGE.normal, { power: 2.5, word: '¡EQUIPO!', big: true });
    }
  }

  // ---------- Premios y vidas ----------

  fell(fighter) {
    this.anyoneFell = true;
    if (this.fighters.some((f) => !f.down)) this.talk.fell(fighter.name);
  }

  revived(fighter, helpers) {
    popText(this, fighter.x, fighter.y - 110, '¡Arriba!', '#4cd97b');
    if (helpers.length) sfx.pickup();
    this.talk.revived(fighter.name);
  }

  removeDefeated() {
    this.monsters = this.monsters.filter((monster) => {
      if (!monster.dead) return true;
      // Al jefe se le ve otra vez el golpe final (en cámara lenta) antes de irse.
      if (monster.type.boss && this.replay.ready && this.phase === 'fight') this.startReplay(monster);
      else this.defeat(monster);
      return false;
    });
  }

  defeat(monster) {
    burst(this, monster.x, monster.y - monster.radius * 0.5, monster.type.color, monster.isBig ? 16 : 8);
    if (monster.grabbedBy) monster.grabbedBy.holding = null;
    const by = monster.lastHitBy;
    if (by) {
      by.stats.kills += 1;
      if (monster.type.boss) by.stats.boss += 1;
    }
    if (monster.type.boss) {
      this.bossesBeaten += 1;
      music.play('brawl');
      comicHit(this, monster.x, monster.y - monster.radius, '¡K.O.!', { big: true, red: true });
    } else if (monster.mini) {
      comicHit(this, monster.x, monster.y - monster.radius, '¡Adiós, mini jefe!', { big: true });
    }
    this.coins.drop(monster.x, monster.y, coinsFor(monster));
    if (!monster.type.small || Math.random() < HEART_DROP_CHANCE) this.dropHeart(monster.x, monster.y);
    monster.leaveBody();
    monster.destroy();
  }

  // La repetición del golpe que tumbó al jefe (A = brincarla).
  startReplay(monster) {
    this.phase = 'replay';
    this.replayBoss = monster;
    this.hideBanner();
    this.talk.hide();
    this.replay.start(this, monster, HUD_DEPTH + 5);
    say('¡Repetición!');
  }

  updateReplay(dt) {
    const skip = players.sorted().some((p) => controls.justPressed(p.deviceId, 'a'));
    const going = !skip && this.replay.step(dt);
    for (const fighter of this.fighters) fighter.render();
    for (const monster of this.monsters) monster.render();
    this.replayBoss.render();
    if (going) return;
    this.replay.finish();
    this.phase = 'fight';
    this.defeat(this.replayBoss);
    this.replayBoss = null;
  }

  dropHeart(x, y) {
    if (this.hearts.length >= MAX_HEARTS_ON_FLOOR) return;
    const sprite = this.add
      .text(x, y - 20, '♥', textStyle(36, '#ff5a7a', { stroke: '#1b1530', strokeThickness: 5 }))
      .setOrigin(0.5)
      .setDepth(y);
    this.tweens.add({ targets: sprite, y: y - 36, duration: 500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.hearts.push({ x, y, sprite, ageMs: 0 });
  }

  // Los corazones se recogen al pasar encima (si te falta vida) y desaparecen solos después de un rato.
  updateHearts(dt) {
    this.hearts = this.hearts.filter((heart) => {
      heart.ageMs += dt;
      const taker = this.fighters.find((f) => !f.down && f.hp < MAX_HP && Math.abs(f.x - heart.x) < 45 && Math.abs(f.y - heart.y) < 35);
      if (taker) {
        taker.heal();
        popText(this, heart.x, heart.y - 60, '+♥', '#ff5a7a');
      } else if (heart.ageMs < HEART_LIFETIME_MS) {
        // Parpadea los últimos 2 segundos para avisar que se va.
        const ending = heart.ageMs > HEART_LIFETIME_MS - 2000;
        heart.sprite.setAlpha(ending && Math.floor(heart.ageMs / 150) % 2 === 0 ? 0.3 : 1);
        return true;
      }
      this.tweens.killTweensOf(heart.sprite);
      heart.sprite.destroy();
      return false;
    });
  }

  showBossBar(monster) {
    this.hideBossBar();
    const { width } = this.scale;
    this.boss = monster;
    this.bossBar = [
      this.add.text(width / 2, 92, monster.name, textStyle(18, TEXT.normal, { fontStyle: 'bold', ...OUTLINE })).setOrigin(0.5),
      this.add.rectangle(width / 2, 118, 420, 18, 0x000000, 0.4),
    ];
    this.bossBarFill = this.add.rectangle(width / 2 - 210, 118, 420, 18, monster.type.color).setOrigin(0, 0.5).setStrokeStyle(2, 0x1b1530);
    this.bossBar.push(this.bossBarFill);
    for (const item of this.bossBar) item.setDepth(HUD_DEPTH).setScrollFactor(0);
  }

  hideBossBar() {
    for (const item of this.bossBar ?? []) item.destroy();
    this.bossBar = null;
    this.boss = null;
  }

  updateHud() {
    const blink = Math.floor(this.time.now / 250) % 2 === 0;
    for (const slot of this.hud) {
      const f = slot.fighter;
      const full = f.meter >= METER_MAX;
      slot.meter.setScale(f.superMs > 0 ? f.superMs / SUPER_MS : f.meter / METER_MAX, 1).setFillStyle(f.superMs > 0 ? f.color : full && blink ? 0xffffff : 0xffd84d);
      const label = f.superMs > 0 ? '¡SÚPER!' : full && !f.isCpu ? 'LB+RB' : '';
      if (slot.meterText.text !== label) slot.meterText.setText(label);
      if (slot.shown === f.hp) continue;
      slot.shown = f.hp;
      slot.hearts.setText('♥'.repeat(f.hp) + '♡'.repeat(MAX_HP - f.hp));
    }
    const wave = `${this.waveLabel ?? ''}   💰 ${coinBank.get()}`;
    if (this.waveText.text !== wave) this.waveText.setText(wave);
    if (this.boss) {
      // El jefe enojado tiene la barra roja que parpadea.
      this.bossBarFill.setScale(Math.max(0, this.boss.hp / this.boss.maxHp), 1);
      if (this.boss.angry) this.bossBarFill.setFillStyle(blink ? 0xff4d4d : this.boss.type.color);
      if (this.boss.dead) this.hideBossBar();
    }
  }

  // ---------- Fin de ronda: caminar al siguiente tramo, resultados o perder ----------

  checkWaveState() {
    if (this.phase !== 'fight') return;
    if (this.fighters.every((f) => f.down)) {
      this.lose();
      return;
    }
    if (this.spawnQueue.length > 0 || this.monsters.length > 0) return;

    rewards.earn('pelea-ronda');
    for (const fighter of this.fighters) if (!fighter.down) fighter.celebrate();
    if (this.nestMode) {
      if (this.nestNumber >= NEST_ROUNDS) {
        this.winNest();
        return;
      }
      this.phase = 'between';
      this.showBanner('¡El nido sigue a salvo!', this.nestNumber === NEST_ROUNDS - 1 ? '¡Viene la última ronda!' : '', 900);
      this.time.delayedCall(1500, () => this.phase === 'between' && this.nextNestWave());
      return;
    }
    if (this.endless) {
      if (this.endlessNumber >= ENDLESS_STICKER_AT) rewards.earn('pelea-sinfin');
      this.phase = 'between';
      this.showBanner('¡Bien hecho!', this.endlessNumber % ENDLESS_BOSS_EVERY === ENDLESS_BOSS_EVERY - 1 ? '¡Sigue un jefe!' : '', 900);
      this.time.delayedCall(1500, () => this.phase === 'between' && this.nextEndlessWave());
      return;
    }
    if (this.bossRush) {
      if (this.rushIndex + 1 >= this.rushWaves.length) {
        this.winBossRush();
        return;
      }
      // Siguiente jefe: los caídos se levantan y todos recuperan un poco.
      this.rushIndex += 1;
      this.phase = 'between';
      for (const fighter of this.fighters) if (!fighter.down) fighter.heal(RUSH_HEAL);
      this.showBanner('¡Bien hecho!', '¡Sigue otro jefe!', 900);
      this.time.delayedCall(1500, () => this.phase === 'between' && this.nextRushBoss());
      return;
    }
    if (this.waveIndex + 1 < this.world.waves.length) {
      // A caminar: se abre el tramo siguiente y la pantalla avanza con los jugadores.
      this.phase = 'walk';
      this.showBanner('¡Bien hecho!', '', 900);
      this.goArrow.setVisible(true);
      say('¡Adelante!');
      return;
    }
    this.winWorld();
  }

  // Caminando: la cámara sigue al de adelante; al llegar al siguiente tramo empieza la ronda.
  updateWalk(dt) {
    const section = this.waveIndex;
    const cam = this.cameras.main;
    const alive = this.fighters.filter((f) => !f.down);
    const lead = Math.max(...alive.map((f) => f.x));
    const target = Phaser.Math.Clamp(lead - SECTION_W / 2 + WALK_LEAD, section * SECTION_W, (section + 1) * SECTION_W);
    cam.scrollX += (Math.max(cam.scrollX, target) - cam.scrollX) * Math.min(1, dt / 200);
    // Nadie se queda atrás (la orilla izquierda avanza con la pantalla) y no se adelantan de más.
    ARENA.left = Math.max(section * SECTION_W + 50, cam.scrollX + 50);
    ARENA.right = cam.scrollX + SECTION_W - 50;
    this.goArrow.setAlpha(Math.floor(this.time.now / 300) % 2 ? 1 : 0.4);
    if (cam.scrollX >= (section + 1) * SECTION_W - 4) {
      cam.scrollX = (section + 1) * SECTION_W;
      this.startWave(section + 1);
    }
  }

  // Los récords del mundo (o del modo) que se acaba de jugar: devuelve el renglón para los resultados.
  saveRecords(worldIndex = null) {
    const news = brawlRecords.addWorld({ combo: this.combo.best, coins: this.worldCoins, bosses: this.bossesBeaten, worldIndex, ms: worldIndex === null ? null : this.worldMs });
    if (news.length) {
      this.time.delayedCall(1800, () => this.talk.record(news[0]));
      return `🏆 ¡Récord! ${news.join('  ·  ')}`;
    }
    return `🔥 Mejor combo: ${this.combo.best}   ·   💰 ${this.worldCoins} monedas   ·   ⏱️ ${formatTime(this.worldMs)}`;
  }

  winWorld() {
    rewards.earn(this.world.sticker);
    this.phase = 'results';
    this.endMs = 0;
    confetti(this, this.fighters.map((f) => f.color));
    const stars = 1 + (this.anyoneFell ? 0 : 1) + (this.worldMs < STAR_TIME_MS ? 1 : 0);
    worldStars.save(this.worldIndex, stars);
    this.celebrate();
    const extra = this.saveRecords(this.worldIndex);
    const next = WORLDS[this.worldIndex + 1];
    this.nextWorld = next && rewards.unlocked(next.unlock) ? this.worldIndex + 1 : null;
    const hint = this.nextWorld !== null ? `A = siguiente mundo: ${next.name}   ·   B = mapa` : 'A = mapa';
    const title = this.nextWorld === null && this.worldIndex === WORLDS.length - 1 ? '¡GANARON TODO!' : '¡Mundo superado!';
    this.screen = showResults(this, this.fighters, { title, stars, hint, extra });
  }

  winBossRush() {
    const ms = this.worldMs;
    const record = brawlRecords.saveBossRush(ms);
    rewards.earn('pelea-jefes');
    this.phase = 'results';
    this.endMs = 0;
    this.nextWorld = null;
    this.rushOver = true;
    confetti(this, this.fighters.map((f) => f.color));
    this.celebrate();
    this.saveRecords();
    const extra = record ? '🏆 ¡Récord nuevo!' : `Récord: ${formatTime(brawlRecords.get().bossRush)}`;
    this.screen = showResults(this, this.fighters, { title: `¡Vencieron a los jefes en ${formatTime(ms)}!`, hint: 'A = otra vez   ·   B = mapa', extra });
  }

  // ¡Ganaron!: fuegos artificiales y todos bailan.
  celebrate() {
    fireworks(this, this.fighters.map((f) => f.color), 5);
    for (const f of this.fighters) f.look.dance(5000);
  }

  // `why`: por qué se perdió (si no, porque todos cayeron).
  lose(why = null) {
    this.endMs = 0;
    // Los monstruos se carcajean.
    for (const monster of this.monsters) monster.taunt(6000);
    if (this.endless || this.bossRush || this.nestMode) {
      const extra = this.saveRecords();
      this.phase = 'results';
      this.nextWorld = null;
      let title;
      if (this.nestMode) {
        this.nestOver = true;
        const rounds = this.nestNumber - 1;
        title = `${why ?? '¡Uy! Todos cayeron'} · Aguantaron ${rounds} de ${NEST_ROUNDS} rondas`;
        say(why ?? '¡Uy! Todos cayeron');
      } else if (this.endless) {
        const waves = this.endlessNumber - 1;
        const record = endlessRecord.save(waves);
        this.endlessOver = true;
        title = `${record ? '¡Récord! ' : ''}Aguantaron ${waves} ${waves === 1 ? 'ronda' : 'rondas'}`;
      } else {
        this.rushOver = true;
        title = `Llegaron al jefe ${this.rushIndex + 1} de ${this.rushWaves.length}`;
      }
      this.screen = showResults(this, this.fighters, { title, hint: 'A = otra vez   ·   B = mapa', extra });
      return;
    }
    this.phase = 'lost';
    this.showBanner('¡Uy! Todos cayeron', 'A = intentarlo otra vez   ·   B = mapa', 0);
  }

  updateEndScreen(dt) {
    this.endMs += dt;
    if (this.endMs < END_SCREEN_DELAY_MS) return;
    // Solo los jugadores de a de veras (la compu no aprieta botones aquí).
    const pressed = (button) => players.sorted().some((p) => controls.justPressed(p.deviceId, button));
    if (this.phase === 'lost') {
      if (pressed('a')) {
        this.hideBanner();
        this.clearEnemies();
        for (const fighter of this.fighters) fighter.reset();
        this.startWave(this.waveIndex);
      } else if (pressed('b')) {
        this.openMap();
      }
      return;
    }
    if (pressed('a')) {
      if (this.nestOver) {
        this.closeScreen();
        this.startNest();
      } else if (this.endlessOver) {
        this.closeScreen();
        this.startEndless();
      } else if (this.rushOver) {
        this.closeScreen();
        this.startBossRush();
      } else if (this.nextWorld !== null) {
        this.closeScreen();
        this.mapIndex = this.nextWorld;
        this.startWorld(this.nextWorld);
      } else {
        this.openMap();
      }
    } else if (pressed('b')) {
      this.openMap();
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
    setSection(0);
    this.cameras.main.setZoom(1);
    go(this, 'Menu', { selected: this.returnData.selected });
  }
}
