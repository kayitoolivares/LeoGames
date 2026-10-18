import Phaser from 'phaser';
import { controls } from '../../shared/controls.js';
import { frameDelta } from '../../shared/clock.js';
import { players } from '../../shared/players.js';
import { UNLOCKS, rewards } from '../../shared/rewards.js';
import { sfx } from '../../shared/sound.js';
import { say } from '../../shared/voice.js';
import { COLORS, TEXT, hexToCss, textStyle } from '../../ui/style.js';
import { ARENA } from './arena.js';
import { backgroundTexture, loadBrawlArt } from './art.js';
import { Fighter, MAX_HP } from './Fighter.js';
import { MONSTER_TYPES, Monster } from './Monster.js';
import { WORLDS, buildSpawnQueue } from './worlds.js';
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
// La bola de fuego del dragón va por el carril del jugador: se esquiva saltando o cambiándose de carril.
const FIREBALL = { speed: 430, radius: 18, lane: 30 };

// "Pelea en equipo": todos los jugadores contra rondas de monstruos en 3 mundos (Pradera, Bosque de hongos
// y Volcán), cada uno con su jefe. Los mundos 2 y 3 se desbloquean ganando el anterior.
export class BrawlScene extends Phaser.Scene {
  constructor() {
    super('Brawl');
  }

  init(data) {
    this.returnData = data ?? {};
  }

  preload() {
    loadBrawlArt(this);
  }

  create() {
    this.backgroundLayer = this.add.container(0, 0).setDepth(-100);
    this.fighters = players.sorted().map((player, i) => new Fighter(this, player, 320 + i * 80, 470 + (i % 2) * 80));
    this.monsters = [];
    this.hearts = [];
    this.fireballs = [];
    this.boss = null;
    this.exitMs = 0;
    this.endMs = 0;
    this.exiting = false;
    this.createHud();
    this.input.keyboard?.on('keydown-ESC', () => this.exit());
    // Si ya hay mundos desbloqueados se escoge; si no, se empieza en la Pradera.
    if (WORLDS.some((world, i) => i > 0 && rewards.unlocked(world.unlock))) this.showWorldChooser();
    else this.startWorld(0);
  }

  drawBackground(world) {
    this.backgroundLayer.removeAll(true);
    const { width, height } = this.scale;
    const key = backgroundTexture(this, world.background);
    if (key) {
      const image = this.add.image(width / 2, height / 2, key);
      image.setScale(Math.max(width / image.width, height / image.height));
      this.backgroundLayer.add(image);
      return;
    }
    const { sky, hill, floor, stripe } = world.colors;
    const floorTop = ARENA.top - 40;
    this.backgroundLayer.add([
      this.add.rectangle(width / 2, floorTop / 2, width, floorTop, sky),
      this.add.circle(1080, 120, 50, 0xfff1b8, 0.9),
      this.add.ellipse(160, floorTop, 520, 260, hill),
      this.add.ellipse(640, floorTop + 10, 640, 300, hill),
      this.add.ellipse(1100, floorTop, 560, 240, hill),
      this.add.rectangle(width / 2, (floorTop + height) / 2, width, height - floorTop, floor),
      ...[0, 1, 2, 3].map((i) => this.add.rectangle(width / 2, floorTop + 30 + i * 90, width, 4, stripe, 0.6)),
    ]);
  }

  createHud() {
    const { width, height } = this.scale;
    this.hud = this.fighters.map((fighter, i) => {
      const x = 20 + i * 300;
      const color = hexToCss(fighter.color);
      this.add.text(x, 16, `J${fighter.player.slot + 1}`, textStyle(22, color, { fontStyle: 'bold', ...OUTLINE })).setDepth(HUD_DEPTH);
      const hearts = this.add.text(x + 46, 12, '', textStyle(26, '#ff5a7a', OUTLINE)).setDepth(HUD_DEPTH);
      return { fighter, hearts, shown: null };
    });
    this.waveText = this.add
      .text(width - 20, 18, '', textStyle(22, TEXT.normal, { fontStyle: 'bold', ...OUTLINE }))
      .setOrigin(1, 0)
      .setDepth(HUD_DEPTH);

    const bannerStyle = { fontStyle: 'bold', stroke: '#1b1530', strokeThickness: 10, align: 'center' };
    this.banner = this.add.text(width / 2, 230, '', textStyle(72, TEXT.accent, bannerStyle)).setOrigin(0.5).setDepth(HUD_DEPTH + 1);
    this.subBanner = this.add
      .text(width / 2, 305, '', textStyle(30, TEXT.normal, { ...bannerStyle, strokeThickness: 6 }))
      .setOrigin(0.5)
      .setDepth(HUD_DEPTH + 1);
    this.banner.setAlpha(0);
    this.subBanner.setAlpha(0);

    this.add
      .text(width / 2, height - 24, 'X o B = pegar   ·   A = saltar   ·   Mantén Y = salir', textStyle(17, TEXT.normal, OUTLINE))
      .setOrigin(0.5)
      .setDepth(HUD_DEPTH);
    this.exitBar = this.add
      .rectangle(width / 2 - 100, height - 8, 200, 6, 0xffffff)
      .setOrigin(0, 0.5)
      .setScale(0, 1)
      .setDepth(HUD_DEPTH);
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

  // Tarjetas para escoger mundo (los bloqueados dicen qué hay que ganar).
  showWorldChooser() {
    this.phase = 'choose';
    this.chosen = 0;
    const { width } = this.scale;
    this.drawBackground(WORLDS[0]);
    this.chooser = this.add.container(0, 0).setDepth(HUD_DEPTH + 2);
    this.chooser.add(this.add.rectangle(width / 2, 360, width, 720, 0x14112b, 0.75));
    this.chooser.add(this.add.text(width / 2, 140, 'Escoge mundo', textStyle(52, TEXT.normal, { fontStyle: 'bold' })).setOrigin(0.5));
    this.worldCards = WORLDS.map((world, i) => {
      const x = width / 2 + (i - 1) * 330;
      const open = rewards.unlocked(world.unlock);
      const bg = this.add.rectangle(x, 360, 300, 260, COLORS.panel).setRounded(24);
      const lock = open ? '' : `🔒 ${UNLOCKS[world.unlock].label}`;
      this.chooser.add([
        bg,
        this.add.text(x, 300, world.emoji, textStyle(72)).setOrigin(0.5),
        this.add.text(x, 380, world.name, textStyle(28, open ? TEXT.normal : TEXT.muted, { fontStyle: 'bold' })).setOrigin(0.5),
        this.add.text(x, 440, lock, textStyle(16, TEXT.muted, { align: 'center', wordWrap: { width: 260 } })).setOrigin(0.5),
      ]);
      return { bg, open };
    });
    this.chooser.add(this.add.text(width / 2, 560, '◀ ▶ escoger   ·   A = ¡a pelear!   ·   B = regresar', textStyle(22, TEXT.accent)).setOrigin(0.5));
    this.highlightWorld();
  }

  highlightWorld() {
    this.worldCards.forEach(({ bg }, i) => bg.setStrokeStyle(i === this.chosen ? 8 : 3, i === this.chosen ? COLORS.accent : COLORS.panelBorder));
    const world = WORLDS[this.chosen];
    say(this.worldCards[this.chosen].open ? world.name : `${world.name}. Todavía no: ${UNLOCKS[world.unlock].label}`);
  }

  updateWorldChooser() {
    const host = players.host();
    if (!host) return;
    const id = host.deviceId;
    const step = (controls.justPressed(id, 'right') ? 1 : 0) - (controls.justPressed(id, 'left') ? 1 : 0);
    if (step !== 0) {
      this.chosen = (this.chosen + step + WORLDS.length) % WORLDS.length;
      sfx.select();
      this.highlightWorld();
    }
    if (controls.justPressed(id, 'a')) {
      if (!this.worldCards[this.chosen].open) {
        sfx.back();
        return;
      }
      sfx.confirm();
      this.chooser.destroy();
      this.startWorld(this.chosen);
    } else if (controls.justPressed(id, 'b')) {
      this.exit();
    }
  }

  startWorld(index) {
    this.worldIndex = index;
    this.world = WORLDS[index];
    this.drawBackground(this.world);
    this.clearEnemies();
    for (const fighter of this.fighters) fighter.reset();
    this.startWave(0);
  }

  startWave(index) {
    this.waveIndex = index;
    const wave = this.world.waves[index];
    this.spawnQueue = buildSpawnQueue(wave, this.fighters.length, MONSTER_TYPES);
    this.spawnMs = FIRST_SPAWN_MS;
    this.phase = 'fight';
    // Al empezar cada ronda, los que estaban caídos se levantan.
    for (const fighter of this.fighters) if (fighter.down) fighter.reset();
    this.waveText.setText(`${this.world.name} · Ronda ${index + 1} de ${this.world.waves.length}`);
    const firstEver = this.worldIndex === 0 && index === 0;
    this.showBanner(wave.title, firstEver ? 'X o B para pegar   ·   A para saltar' : index === 0 ? this.world.name : '', firstEver ? 2200 : 1300);
  }

  clearEnemies() {
    for (const monster of this.monsters) monster.destroy();
    for (const ball of this.fireballs) ball.sprite.destroy();
    this.monsters = [];
    this.fireballs = [];
    this.hideBossBar();
  }

  update() {
    const dt = frameDelta();
    this.updateExit(dt);
    if (this.phase === 'choose') {
      this.updateWorldChooser();
      for (const fighter of this.fighters) fighter.render();
      return;
    }
    if (['won', 'lost', 'worldWon'].includes(this.phase)) this.updateEndScreen(dt);

    for (const fighter of this.fighters) fighter.update(dt, this.fighters);
    if (this.phase === 'fight') this.updateSpawns(dt);
    for (const monster of this.monsters) monster.update(dt, this.fighters);
    this.handleMonsterRequests();
    this.updateFireballs(dt);
    this.separateMonsters();
    this.resolveHits();
    this.updateHearts(dt);
    this.removeDefeated();

    for (const fighter of this.fighters) fighter.render();
    for (const monster of this.monsters) monster.render();
    this.updateHud();
    this.checkWaveState();
  }

  updateSpawns(dt) {
    if (this.spawnQueue.length === 0) return;
    this.spawnMs -= dt;
    if (this.spawnMs > 0 || this.monsters.length >= MAX_ALIVE) return;
    const type = this.spawnQueue.shift();
    const fromLeft = Math.random() < 0.5;
    const x = fromLeft ? ARENA.left - 80 : ARENA.right + 80;
    const y = Phaser.Math.Between(ARENA.top + 20, ARENA.bottom - 20);
    const monster = new Monster(this, type, x, y);
    this.monsters.push(monster);
    if (monster.type.boss) {
      // Con más jugadores el jefe aguanta más, para que no se acabe en un suspiro.
      monster.hp = monster.maxHp = Math.round(monster.type.hp * (1 + BOSS_HP_PER_PLAYER * (this.fighters.length - 1)));
      this.showBossBar(monster);
    }
    this.spawnMs = SPAWN_INTERVAL_MS;
  }

  // Lo que pidieron los jefes este cuadro: ayudantes o una bola de fuego.
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
        popText(this, monster.x, monster.y - monster.radius - 40, '¡A mí, hongos!', '#ffffff');
      } else if (request.kind === 'fireball') {
        const sprite = this.add.container(request.x, request.y - 30, [
          this.add.circle(0, 0, FIREBALL.radius + 8, 0xff9a3c, 0.45),
          this.add.circle(0, 0, FIREBALL.radius, 0xffd84d).setStrokeStyle(4, 0xff5a2f),
        ]);
        sprite.setDepth(request.y + 1);
        this.fireballs.push({ x: request.x, y: request.y, dir: request.dir, sprite });
        sfx.special();
      }
    }
  }

  updateFireballs(dt) {
    this.fireballs = this.fireballs.filter((ball) => {
      ball.x += ball.dir * FIREBALL.speed * (dt / 1000);
      ball.sprite.setPosition(ball.x, ball.y - 30).setAngle(ball.x);
      const victim = this.fighters.find(
        (f) => !f.down && Math.abs(f.x - ball.x) < f.radius + FIREBALL.radius && Math.abs(f.y - ball.y) < FIREBALL.lane,
      );
      if (victim && victim.hurt(ball.x)) {
        popText(this, victim.x, victim.y - 90, '¡Quema!', '#ff9a3c');
        burst(this, ball.x, ball.y - 30, 0xff9a3c, 10);
        ball.sprite.destroy();
        return false;
      }
      if (ball.x < -60 || ball.x > this.scale.width + 60) {
        ball.sprite.destroy();
        return false;
      }
      return true;
    });
  }

  // Empuja a los monstruos que se enciman para que no se vuelvan uno solo.
  separateMonsters() {
    const list = this.monsters;
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

  resolveHits() {
    for (const fighter of this.fighters) {
      if (!fighter.isAttacking()) continue;
      for (const monster of this.monsters) {
        if (monster.dead || fighter.hitThisAttack.has(monster) || !fighter.canHit(monster)) continue;
        fighter.hitThisAttack.add(monster);
        monster.hurt(fighter.x);
        popText(this, monster.x, monster.y - monster.radius - 30, randomPow());
        this.cameras.main.shake(60, 0.003);
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

  removeDefeated() {
    this.monsters = this.monsters.filter((monster) => {
      if (!monster.dead) return true;
      burst(this, monster.x, monster.y - monster.radius * 0.5, monster.type.color, monster.type.boss ? 16 : 8);
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
      const taker = this.fighters.find(
        (f) => !f.down && f.hp < MAX_HP && Math.abs(f.x - heart.x) < 45 && Math.abs(f.y - heart.y) < 35,
      );
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
      this.add.text(width / 2, 52, monster.type.name, textStyle(18, TEXT.normal, { fontStyle: 'bold', ...OUTLINE })).setOrigin(0.5),
      this.add.rectangle(width / 2, 78, 420, 18, 0x000000, 0.4),
    ];
    this.bossBarFill = this.add.rectangle(width / 2 - 210, 78, 420, 18, monster.type.color).setOrigin(0, 0.5);
    this.bossBar.push(this.bossBarFill);
    for (const item of this.bossBar) item.setDepth(HUD_DEPTH);
  }

  hideBossBar() {
    for (const item of this.bossBar ?? []) item.destroy();
    this.bossBar = null;
    this.boss = null;
  }

  updateHud() {
    for (const slot of this.hud) {
      const hp = slot.fighter.hp;
      if (slot.shown === hp) continue;
      slot.shown = hp;
      slot.hearts.setText('♥'.repeat(hp) + '♡'.repeat(MAX_HP - hp));
    }
    if (this.boss) {
      this.bossBarFill.setScale(Math.max(0, this.boss.hp / this.boss.maxHp), 1);
      if (this.boss.dead) this.hideBossBar();
    }
  }

  checkWaveState() {
    if (this.phase !== 'fight') return;
    if (this.fighters.every((f) => f.down)) {
      this.phase = 'lost';
      this.endMs = 0;
      this.showBanner('¡Uy! Todos cayeron', 'Presiona A para intentarlo otra vez', 0);
      return;
    }
    if (this.spawnQueue.length > 0 || this.monsters.length > 0) return;

    rewards.earn('pelea-ronda');
    if (this.waveIndex + 1 < this.world.waves.length) {
      this.phase = 'between';
      this.showBanner('¡Bien hecho!', '', 900);
      this.time.delayedCall(1600, () => this.startWave(this.waveIndex + 1));
      return;
    }
    // Ganaron el mundo: calcomanía (que desbloquea el siguiente) y a seguir, o fin del juego.
    rewards.earn(this.world.sticker);
    this.endMs = 0;
    confetti(this, this.fighters.map((f) => f.color));
    if (this.worldIndex + 1 < WORLDS.length) {
      this.phase = 'worldWon';
      this.showBanner('¡Mundo superado!', `A = seguir al ${WORLDS[this.worldIndex + 1].name}   ·   Mantén Y = salir`, 0);
    } else {
      this.phase = 'won';
      this.showBanner('¡GANARON TODO!', 'Presiona A para volver al menú', 0);
    }
  }

  updateEndScreen(dt) {
    this.endMs += dt;
    if (this.endMs < END_SCREEN_DELAY_MS) return;
    if (!this.fighters.some((f) => controls.justPressed(f.deviceId, 'a'))) return;
    if (this.phase === 'won') {
      this.exit();
      return;
    }
    if (this.phase === 'worldWon') {
      this.startWorld(this.worldIndex + 1);
      return;
    }
    this.clearEnemies();
    for (const fighter of this.fighters) fighter.reset();
    this.startWave(this.waveIndex);
  }

  updateExit(dt) {
    const holding = this.fighters.some((f) => controls.isDown(f.deviceId, 'y'));
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
