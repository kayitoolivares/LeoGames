import Phaser from 'phaser';
import { controls } from '../../shared/controls.js';
import { characterPicks } from '../../shared/picks.js';
import { defaultCharacter } from '../../scenes/CharacterSelectScene.js';
import { loadSmashArt } from '../smash/art.js';
import { frameDelta } from '../../shared/clock.js';
import { music } from '../../shared/music.js';
import { players } from '../../shared/players.js';
import { rewards } from '../../shared/rewards.js';
import { sfx } from '../../shared/sound.js';
import { say } from '../../shared/voice.js';
import { TEXT, hexToCss, textStyle } from '../../ui/style.js';
import { comicHit, loadFxArt, shockwave } from '../duelo/fx.js';
import { ARENA, SECTION_W, setSection } from './arena.js';
import { backgroundTexture, loadBrawlArt } from './art.js';
import { Fighter, MAX_HP, METER_MAX, SUPER_MS } from './Fighter.js';
import { MONSTER_TYPES, Monster } from './Monster.js';
import { Props } from './props.js';
import { STAR_TIME_MS, endlessRecord, showBossIntro, showMap, showResults, worldStars } from './screens.js';
import { ENDLESS_BOSS_EVERY, WORLDS, buildSpawnQueue, endlessWave } from './worlds.js';
import { burst, confetti, popText, randomPow } from './effects.js';

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
// La bola de fuego (o tinta, nieve, magia) va por el carril del jugador: se esquiva saltando o cambiándose de carril.
const FIREBALL = { speed: 430, radius: 18, lane: 30 };
const FIREBALL_LOOKS = {
  fire: [0xffd84d, 0xff5a2f, 0xff9a3c],
  ink: [0x3a2a5a, 0x1b1530, 0x8158d8],
  snow: [0xffffff, 0x9fd8ff, 0xdff4ff],
  magic: [0xd36bff, 0x8158d8, 0xffd84d],
};
// Lo que lanzan los especiales (estrella, bala de cañón).
const SHOT = { radius: 22, lane: 40 };
// Golpe en equipo: si dos (o más) se vuelven súper con menos de esto de diferencia.
const TEAM_WINDOW_MS = 4000;
const TEAM_DAMAGE = { normal: 6, boss: 10 };
// Cuántos golpes dejan a un monstruo "tocado" para el remate y cada cuánto lastima la estrella.
const STAR_HIT_MS = 400;
const WALK_LEAD = 220;
const ENDLESS_STICKER_AT = 10;

// "Pelea en equipo": todos los jugadores contra monstruos, estilo arcade. Se escoge mundo en el mapa (6 mundos y el
// modo sin fin); cada mundo son 4 tramos: al limpiar uno se camina a la derecha al siguiente, y en el último llega el
// jefe. Al final, resultados con premios y estrellas.
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
    this.fighters = players
      .sorted()
      .map((player, i) => new Fighter(this, player, 320 + i * 80, 470 + (i % 2) * 80, characterPicks.get(player.deviceId, defaultCharacter(player))));
    this.monsters = [];
    this.hearts = [];
    this.fireballs = [];
    this.shots = [];
    this.props = new Props(this);
    this.boss = null;
    this.bossBar = null;
    this.exitMs = 0;
    this.endMs = 0;
    this.exiting = false;
    this.screen = null;
    this.mapIndex = 0;
    this.createHud();
    this.input.keyboard?.on('keydown-ESC', () => this.exit());
    this.openMap();
  }

  // ---------- El fondo: la imagen del mundo repetida a lo largo del nivel (en espejo, para que no se noten las uniones) ----------

  drawBackground(world, sections) {
    this.backgroundLayer.removeAll(true);
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
    this.hud = this.fighters.map((fighter, i) => {
      const x = 20 + i * 300;
      const color = hexToCss(fighter.color);
      fixed(this.add.text(x, 16, `J${fighter.player.slot + 1}`, textStyle(22, color, { fontStyle: 'bold', ...OUTLINE })));
      const hearts = fixed(this.add.text(x + 46, 12, '', textStyle(26, '#ff5a7a', OUTLINE)));
      // La barra de poder (llena = LB + RB para la súper).
      fixed(this.add.rectangle(x + 46, 58, 180, 10, 0xffffff, 0.2).setOrigin(0, 0.5));
      const meter = fixed(this.add.rectangle(x + 46, 58, 180, 10, 0xffd84d).setOrigin(0, 0.5).setScale(0, 1));
      const meterText = fixed(this.add.text(x + 232, 58, '', textStyle(15, '#ffd84d', { fontStyle: 'bold', ...OUTLINE })).setOrigin(0, 0.5));
      return { fighter, hearts, meter, meterText, shown: null };
    });
    this.waveText = fixed(this.add.text(width - 20, 18, '', textStyle(22, TEXT.normal, { fontStyle: 'bold', ...OUTLINE })).setOrigin(1, 0));

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

  // ---------- Mapa ----------

  openMap() {
    this.clearLevel();
    this.hideBanner();
    this.phase = 'map';
    this.drawBackground(WORLDS[0], 0);
    this.screen?.destroy();
    this.map = showMap(this, this.mapIndex);
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
      else this.startWorld(spot.world);
    } else if (controls.justPressed(id, 'b')) {
      this.exit();
    }
  }

  closeScreen() {
    this.screen?.destroy();
    this.screen = null;
    this.map = null;
  }

  // ---------- Mundos y rondas ----------

  startWorld(index) {
    this.endless = false;
    this.worldIndex = index;
    this.world = WORLDS[index];
    this.worldMs = 0;
    this.anyoneFell = false;
    this.drawBackground(this.world, this.world.waves.length);
    this.clearLevel();
    for (const fighter of this.fighters) {
      fighter.reset();
      fighter.stats = { hits: 0, kills: 0, revives: 0, boss: 0 };
    }
    this.placeFighters(0);
    this.startWave(0);
  }

  // Modo sin fin: siempre en el mismo tramo, una ronda tras otra (con los monstruos de los mundos ya abiertos).
  startEndless() {
    this.endless = true;
    this.endlessNumber = 0;
    const open = WORLDS.filter((world) => rewards.unlocked(world.unlock));
    this.endlessWorlds = open;
    this.world = Phaser.Utils.Array.GetRandom(open);
    this.worldIndex = WORLDS.indexOf(this.world);
    this.drawBackground(this.world, 0);
    this.clearLevel();
    for (const fighter of this.fighters) {
      fighter.reset();
      fighter.stats = { hits: 0, kills: 0, revives: 0, boss: 0 };
    }
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

  startWave(index) {
    this.waveIndex = index;
    const wave = this.world.waves[index];
    this.beginWave(wave, index, `${this.world.name} · Ronda ${index + 1} de ${this.world.waves.length}`);
    this.props.place(ARENA.left + 120, ARENA.right - 120, ARENA.top, ARENA.bottom);
    const firstEver = this.worldIndex === 0 && index === 0;
    if (firstEver) this.showBanner(wave.title, 'X = pegar   ·   B = especial   ·   A = saltar', 2200);
  }

  beginWave(wave, section, label) {
    setSection(section);
    this.cameras.main.setScroll(section * SECTION_W, 0);
    this.spawnQueue = buildSpawnQueue(wave, this.fighters.length, MONSTER_TYPES);
    this.spawnMs = FIRST_SPAWN_MS;
    this.phase = 'fight';
    this.goArrow.setVisible(false);
    // Al empezar cada ronda, los que estaban caídos se levantan, y los que se quedaron en otro tramo llegan a este.
    for (const fighter of this.fighters) if (fighter.down) fighter.reset();
    this.fighters.forEach((fighter, i) => {
      if (fighter.x >= ARENA.left + 20 && fighter.x <= ARENA.right) return;
      fighter.x = ARENA.left + 170 + i * 80;
      fighter.y = 470 + (i % 2) * 80;
    });
    this.waveText.setText(label);
    this.showBanner(wave.title, section === 0 && !this.endless ? this.world.name : '', 1300);
  }

  placeFighters(section) {
    this.fighters.forEach((fighter, i) => {
      fighter.x = section * SECTION_W + 220 + i * 80;
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
  }

  clearLevel() {
    this.clearEnemies();
    this.props.clear();
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
    if (this.phase === 'map') {
      this.updateMap();
      return;
    }
    if (['results', 'lost'].includes(this.phase)) this.updateEndScreen(dt);
    if (this.phase === 'bossIntro') {
      for (const fighter of this.fighters) fighter.render();
      for (const monster of this.monsters) monster.render();
      return;
    }
    if (this.phase === 'fight' || this.phase === 'walk') this.worldMs += dt;

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
    const type = this.spawnQueue[0];
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
    const monster = new Monster(this, type, x, y);
    this.monsters.push(monster);
    if (monster.type.boss) {
      this.bossAnnounced = false;
      // Con más jugadores el jefe aguanta más, para que no se acabe en un suspiro.
      monster.hp = monster.maxHp = Math.round(monster.type.hp * (1 + BOSS_HP_PER_PLAYER * (this.fighters.length - 1)));
      this.showBossBar(monster);
    }
    this.spawnMs = SPAWN_INTERVAL_MS;
  }

  // Lo que pidieron los jefes este cuadro: ayudantes o una bola de fuego (o tinta, nieve, magia).
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
        this.fireballs.push({ x: request.x, y: request.y, dir: request.dir, look: request.look, sprite });
        sfx.special();
      }
    }
  }

  updateFireballs(dt) {
    const words = { fire: '¡Quema!', ink: '¡Tinta!', snow: '¡Brrr!', magic: '¡Zas!' };
    this.fireballs = this.fireballs.filter((ball) => {
      ball.x += ball.dir * FIREBALL.speed * (dt / 1000);
      ball.sprite.setPosition(ball.x, ball.y - 30).setAngle(ball.x);
      const victim = this.fighters.find((f) => !f.down && Math.abs(f.x - ball.x) < f.radius + FIREBALL.radius && Math.abs(f.y - ball.y) < FIREBALL.lane);
      if (victim && victim.hurt(ball.x)) {
        popText(this, victim.x, victim.y - 90, words[ball.look] ?? '¡Auch!', '#ff9a3c');
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

  // Un jugador le pega a un monstruo (con un golpe, su especial, un objeto...). `damage` en golpes normales.
  hitMonster(fighter, monster, damage, { power = 1, word = null, big = false } = {}) {
    if (monster.dead || monster.grabbedBy) return;
    monster.hurt(fighter.x, damage, power);
    monster.lastHitBy = fighter;
    fighter.landedHit();
    comicHit(this, monster.x, monster.y - monster.radius - 40, word ?? randomPow(), { big, red: big });
    if (big) shockwave(this, monster.x, monster.y - monster.radius * 0.6, fighter.color);
    this.cameras.main.shake(big ? 120 : 60, big ? 0.006 : 0.003);
    sfx.hit(big ? 0.8 : 0.4);
  }

  resolveHits() {
    for (const fighter of this.fighters) {
      if (!fighter.isAttacking() || fighter.down) continue;
      this.props.hitAt(fighter.x + fighter.facing * (fighter.radius + 20), fighter.y, fighter.reach + 20, fighter);
      for (const monster of this.monsters) {
        if (monster.dead || monster.grabbedBy || fighter.hitThisAttack.has(monster) || !fighter.canHit(monster, fighter.reach)) continue;
        fighter.hitThisAttack.add(monster);
        if (fighter.finisher) this.hitMonster(fighter, monster, 2 * fighter.power, { power: 2.4, word: '¡Remate!', big: true });
        else this.hitMonster(fighter, monster, fighter.power);
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
      for (const fighter of this.fighters) {
        if (monster.hitDuringLunge.has(fighter) || !monster.touches(fighter)) continue;
        monster.hitDuringLunge.add(fighter);
        if (fighter.hurt(monster.x)) popText(this, fighter.x, fighter.y - 90, '¡Auch!', '#ff5a7a');
      }
    }
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

  // El aplastón del súper salto (lo avisa el jugador al caer al piso).
  landed(fighter) {
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

  // ---------- Súper y golpe en equipo ----------

  meterFull(fighter) {
    popText(this, fighter.x, fighter.y - 120, '¡Barra llena! LB + RB', '#ffd84d');
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
    this.showBanner('¡GOLPE EN EQUIPO!', team.map((f) => `J${f.player.slot + 1}`).join(' + '), 1600);
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

  fell() {
    this.anyoneFell = true;
  }

  revived(fighter, helpers) {
    popText(this, fighter.x, fighter.y - 110, '¡Arriba!', '#4cd97b');
    if (helpers.length) sfx.pickup();
  }

  removeDefeated() {
    this.monsters = this.monsters.filter((monster) => {
      if (!monster.dead) return true;
      burst(this, monster.x, monster.y - monster.radius * 0.5, monster.type.color, monster.type.boss ? 16 : 8);
      if (monster.grabbedBy) monster.grabbedBy.holding = null;
      const by = monster.lastHitBy;
      if (by) {
        by.stats.kills += 1;
        if (monster.type.boss) by.stats.boss += 1;
      }
      if (monster.type.boss) {
        music.play('brawl');
        comicHit(this, monster.x, monster.y - monster.radius, '¡K.O.!', { big: true, red: true });
      }
      if (!monster.type.small || Math.random() < HEART_DROP_CHANCE) this.dropHeart(monster.x, monster.y);
      monster.destroy();
      return false;
    });
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
    const { width } = this.scale;
    this.boss = monster;
    this.bossBar = [
      this.add.text(width / 2, 82, monster.type.name, textStyle(18, TEXT.normal, { fontStyle: 'bold', ...OUTLINE })).setOrigin(0.5),
      this.add.rectangle(width / 2, 108, 420, 18, 0x000000, 0.4),
    ];
    this.bossBarFill = this.add.rectangle(width / 2 - 210, 108, 420, 18, monster.type.color).setOrigin(0, 0.5).setStrokeStyle(2, 0x1b1530);
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
      const label = f.superMs > 0 ? '¡SÚPER!' : full ? 'LB+RB' : '';
      if (slot.meterText.text !== label) slot.meterText.setText(label);
      if (slot.shown === f.hp) continue;
      slot.shown = f.hp;
      slot.hearts.setText('♥'.repeat(f.hp) + '♡'.repeat(MAX_HP - f.hp));
    }
    if (this.boss) {
      this.bossBarFill.setScale(Math.max(0, this.boss.hp / this.boss.maxHp), 1);
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
    if (this.endless) {
      if (this.endlessNumber >= ENDLESS_STICKER_AT) rewards.earn('pelea-sinfin');
      this.phase = 'between';
      this.showBanner('¡Bien hecho!', this.endlessNumber % ENDLESS_BOSS_EVERY === ENDLESS_BOSS_EVERY - 1 ? '¡Sigue un jefe!' : '', 900);
      this.time.delayedCall(1500, () => this.phase === 'between' && this.nextEndlessWave());
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

  winWorld() {
    rewards.earn(this.world.sticker);
    this.phase = 'results';
    this.endMs = 0;
    confetti(this, this.fighters.map((f) => f.color));
    const stars = 1 + (this.anyoneFell ? 0 : 1) + (this.worldMs < STAR_TIME_MS ? 1 : 0);
    worldStars.save(this.worldIndex, stars);
    const next = WORLDS[this.worldIndex + 1];
    this.nextWorld = next && rewards.unlocked(next.unlock) ? this.worldIndex + 1 : null;
    const hint = this.nextWorld !== null ? `A = siguiente mundo: ${next.name}   ·   B = mapa` : 'A = mapa';
    const title = this.nextWorld === null && this.worldIndex === WORLDS.length - 1 ? '¡GANARON TODO!' : '¡Mundo superado!';
    this.screen = showResults(this, this.fighters, { title, stars, hint });
  }

  lose() {
    this.endMs = 0;
    if (this.endless) {
      const waves = this.endlessNumber - 1;
      const record = endlessRecord.save(waves);
      this.phase = 'results';
      this.nextWorld = null;
      this.endlessOver = true;
      this.screen = showResults(this, this.fighters, {
        title: `${record ? '¡Récord! ' : ''}Aguantaron ${waves} ${waves === 1 ? 'ronda' : 'rondas'}`,
        hint: 'A = otra vez   ·   B = mapa',
      });
      return;
    }
    this.phase = 'lost';
    this.showBanner('¡Uy! Todos cayeron', 'A = intentarlo otra vez   ·   B = mapa', 0);
  }

  updateEndScreen(dt) {
    this.endMs += dt;
    if (this.endMs < END_SCREEN_DELAY_MS) return;
    const pressed = (button) => this.fighters.some((f) => controls.justPressed(f.deviceId, button));
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
      if (this.endlessOver) {
        this.endlessOver = false;
        this.closeScreen();
        this.startEndless();
      } else if (this.nextWorld !== null) {
        this.closeScreen();
        this.mapIndex = this.nextWorld;
        this.startWorld(this.nextWorld);
      } else {
        this.endlessOver = false;
        this.openMap();
      }
    } else if (pressed('b')) {
      this.endlessOver = false;
      this.openMap();
    }
  }

  updateExit(dt) {
    const holding = this.fighters.some((f) => controls.holdingExit(f.deviceId));
    this.exitMs = holding ? this.exitMs + dt : 0;
    this.exitBar.setScale(Math.min(1, this.exitMs / EXIT_HOLD_MS), 1);
    if (this.exitMs >= EXIT_HOLD_MS) this.exit();
  }

  exit() {
    if (this.exiting) return;
    this.exiting = true;
    setSection(0);
    this.scene.start('Menu', { selected: this.returnData.selected });
  }
}

