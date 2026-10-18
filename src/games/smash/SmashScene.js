import Phaser from 'phaser';
import { controls } from '../../shared/controls.js';
import { frameDelta } from '../../shared/clock.js';
import { sfx } from '../../shared/sound.js';
import { say } from '../../shared/voice.js';
import { rewards } from '../../shared/rewards.js';
import { players, PLAYER_COLORS } from '../../shared/players.js';
import { TEXT, hexToCss, textStyle } from '../../ui/style.js';
import { burst, confetti, popText } from '../brawl/effects.js';
import { CHARACTERS, CHARACTER_KEYS } from './characters.js';
import { METER_MAX, SUPER_MS, SmashFighter, STOCKS } from './SmashFighter.js';
import { backgroundTexture, loadSmashArt } from './art.js';
import { SmashItems, drawItem } from './items.js';
import { STAGES, buildPlatforms, movePlatforms } from './stages.js';

const COUNTDOWN_STEP_MS = 800;
const EXIT_HOLD_MS = 1200;
const END_INPUT_DELAY_MS = 1500;
const ZOOM_MIN = 0.55;
const ZOOM_MAX = 1.15;
const CAMERA_MARGIN = 220;
const STRONG_HIT_SPEED = 900;
const HIT_WORDS = ['¡PAM!', '¡ZAS!', '¡POW!', '¡BAM!'];
const IDLE = { x: 0, y: 0, jump: false, attack: false, special: false, shield: false, transform: false };
const OUTLINE = { stroke: '#1b1530', strokeThickness: 5 };
// Disparos en línea recta: la estrella de Estrella (poco daño, pero pega de lejos) y el láser de Robot (rápido).
const SHOTS = {
  star: { speed: 700, lifeMs: 900, radius: 16, color: 0xffc93c, hit: { damage: 5, base: 160, scale: 5, angle: 30 } },
  laser: { speed: 1150, lifeMs: 650, radius: 14, color: 0xff4d6d, hit: { damage: 8, base: 220, scale: 6, angle: 15 } },
};
// Ninja aparece detrás del rival más cercano si está a esta distancia; si no, avanza un poco.
const TELEPORT_RANGE = 700;
const TELEPORT_HOP = 220;
// La bomba explota al tocar a alguien, al caer o a los 1.5 s; quien la lanzó no recibe daño.
const BOMB = { gravity: 1400, fuseMs: 1500, blast: 130, hit: { damage: 15, base: 380, scale: 10, angle: 50 } };
const ITEM_NAMES = { hammer: '¡Martillo!', bomb: '¡Bomba!', heart: '-40%', star: '¡Estrella!' };

// Qué tan bueno es el CPU. attack/shield/special/jump/transform: probabilidad por cuadro de hacerlo cuando conviene.
const CPU_LEVELS = {
  facil: { attack: 0.04, shield: 0.02, special: 0.004, jump: 0.04, transform: 0.003, items: false, smart: false },
  normal: { attack: 0.08, shield: 0.06, special: 0.01, jump: 0.08, transform: 0.01, items: true, smart: true },
  dificil: { attack: 0.16, shield: 0.15, special: 0.02, jump: 0.12, transform: 0.03, items: true, smart: true },
};

const DEFAULT_SETTINGS = { stage: 'castillo', items: true, cpus: 1, level: 'normal' };

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
  }

  preload() {
    loadSmashArt(this);
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
    this.platforms = buildPlatforms(this, this.world, this.stage);
    this.main = this.platforms.find((p) => p.main);
    this.stageMs = 0;
    this.items = new SmashItems(this, this.world, this.platforms, {
      minX: this.main.left + 100,
      maxX: this.main.right - 100,
      spawnY: this.stage.respawn.y - 120,
      bottom: this.stage.blast.bottom,
    });
    this.projectiles = [];
    this.fighters = this.createFighters();
    this.createHud();
    this.phase = 'countdown';
    this.phaseMs = 0;
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
    if (key) {
      const zone = this.stage.blast;
      const image = this.add.image((zone.left + zone.right) / 2, (zone.top + zone.bottom) / 2, key);
      image.setScale(Math.max((zone.right - zone.left) / image.width, (zone.bottom - zone.top) / image.height));
      this.world.add(image);
    } else {
      this.stage.drawBackground(this, this.world);
    }
    this.stage.drawProps?.(this, this.world);
  }

  // Los jugadores con su personaje y, si se pidieron, CPUs con personaje al azar (siempre hay al menos un rival).
  createFighters() {
    const humans = players.sorted();
    const picks = this.returnData.picks ?? {};
    const peque = this.returnData.peque ?? {};
    const arena = { platforms: this.platforms, respawn: this.stage.respawn };
    const list = humans.map(
      (player) =>
        new SmashFighter(this, this.world, {
          color: players.color(player).hex,
          label: `J${player.slot + 1}`,
          deviceId: player.deviceId,
          character: picks[player.deviceId] ?? CHARACTER_KEYS[player.slot % CHARACTER_KEYS.length],
          peque: Boolean(peque[player.deviceId]),
          arena,
        }),
    );
    const cpus = Math.max(humans.length < 2 ? 1 : 0, Math.min(this.settings.cpus, 4 - humans.length));
    const taken = new Set(humans.map((player) => player.colorIndex));
    const colors = PLAYER_COLORS.filter((_, i) => !taken.has(i));
    for (let i = 0; i < cpus; i += 1) {
      list.push(
        new SmashFighter(this, this.world, {
          color: colors[i].hex,
          label: cpus > 1 ? `CPU ${i + 1}` : 'CPU',
          character: CHARACTER_KEYS[Math.floor(Math.random() * CHARACTER_KEYS.length)],
          cpuLevel: this.settings.level,
          arena,
        }),
      );
    }
    list.forEach((fighter, i) => fighter.spawn(this.stage.spawns[i], this.main.top - 100, 0));
    return list;
  }

  createHud() {
    const { width, height } = this.scale;
    const panelW = 220;
    const gap = 20;
    const startX = (width - (this.fighters.length * panelW + (this.fighters.length - 1) * gap)) / 2 + panelW / 2;
    this.hud = this.fighters.map((fighter, i) => {
      const x = startX + i * (panelW + gap);
      const y = height - 70;
      const left = x - panelW / 2;
      const bg = this.add.rectangle(x, y, panelW, 112, 0x1b1530, 0.6).setRounded(18).setStrokeStyle(4, fighter.color);
      const title = `${fighter.label} · ${CHARACTERS[fighter.characterKey].name}${fighter.peque ? ' · peque' : ''}`;
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
      this.ui.add([bg, name, damage, ...stocks, meterBg, meter, meterText]);
      return { fighter, damage, stocks, meter, meterText, shown: null };
    });

    const bannerStyle = { fontStyle: 'bold', stroke: '#1b1530', strokeThickness: 10, align: 'center' };
    this.banner = this.add.text(width / 2, 250, '', textStyle(84, TEXT.accent, bannerStyle)).setOrigin(0.5).setAlpha(0);
    this.subBanner = this.add.text(width / 2, 330, '', textStyle(28, TEXT.normal, { ...bannerStyle, strokeThickness: 6 })).setOrigin(0.5).setAlpha(0);
    const help = this.add
      .text(
        width / 2,
        22,
        'A = saltar  ·  X = golpe (↑ ↓ cambian)  ·  B = especial (B + ↑ = rescate)  ·  RB / LB = escudo  ·  Barra llena: LB + RB = ¡súper!  ·  Mantén Y = salir',
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
    this.tweens.add({ targets: this.banner, scale: 1, duration: 220, ease: 'Back.easeOut' });
    if (holdMs > 0) this.tweens.add({ targets: [this.banner, this.subBanner], alpha: 0, delay: holdMs, duration: 300 });
  }

  update() {
    const dt = frameDelta();
    this.phaseMs += dt;
    this.stageMs += dt;
    this.updateExit(dt);
    movePlatforms(this.platforms, this.stageMs);

    if (this.phase === 'countdown') {
      this.updateCountdown();
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
      this.items.update(dt, this.fighters, this.settings.items && this.phase === 'fight', (fighter, item) => {
        popText(this, item.x, item.y - 40, ITEM_NAMES[item.type], '#ffffff', this.world);
        if (item.type === 'star') sfx.star();
        else sfx.pickup();
      });
      this.resolveHits();
      this.checkBlastZones();
      if (this.phase === 'fight') this.checkWinner();
      else this.updateEnd();
    }

    for (const fighter of this.fighters) fighter.render();
    this.updateCamera(dt / 1000);
    this.updateHud();
  }

  updateCountdown() {
    const step = Math.floor(this.phaseMs / COUNTDOWN_STEP_MS);
    const label = step < 3 ? String(3 - step) : '¡A pelear!';
    if (this.banner.text !== label) {
      this.showBanner(label, '', step < 3 ? 0 : 700);
      sfx.countdown(step >= 3);
    }
    if (step >= 3) {
      this.phase = 'fight';
      this.phaseMs = 0;
    }
  }

  inputFor(fighter) {
    if (fighter.isCpu) return this.cpuInput(fighter);
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
      special: controls.justPressed(id, 'b'),
      // Escudo con cualquier botón de arriba (bumpers o gatillos), para que sea fácil de encontrar.
      shield: !transform && ['rb', 'lb', 'rt', 'lt'].some((button) => controls.isDown(id, button)),
      transform,
    };
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
    this.showBanner(`¡${CHARACTERS[fighter.characterKey].superName}!`, '', 900, hexToCss(fighter.color));
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

  // Rival vivo más cercano a menos de `maxDist` (o null).
  nearestRival(fighter, maxDist = Infinity) {
    let best = null;
    let bestDist = maxDist;
    for (const other of this.fighters) {
      if (other === fighter || !other.isAlive()) continue;
      const dist = Math.hypot(other.x - fighter.x, other.y - fighter.y);
      if (dist < bestDist) [best, bestDist] = [other, dist];
    }
    return best;
  }

  // CPU: persigue al rival más cercano, escoge el golpe según dónde está, se cubre, usa su especial,
  // va por objetos (y lanza bombas), huye del que tiene estrella y regresa al escenario si se cae.
  cpuInput(fighter) {
    if (fighter.hitstunMs > 0 || fighter.stunMs > 0 || this.phase !== 'fight') return IDLE;
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
      if (other === fighter || !other.isAlive()) continue;
      const dist = Math.hypot(other.x - fighter.x, other.y - fighter.y);
      if (dist < best) [target, best] = [other, dist];
    }

    // ¿Hacia dónde ir? Al rival, a un objeto cercano o lejos del que tiene la estrella.
    let goal = target;
    let flee = false;
    if (target?.starPowerMs > 0 && best < 450) flee = true;
    else if (level.items && !fighter.held) {
      const item = this.items.nearest(fighter, 450);
      const wanted = item && (item.type !== 'heart' || fighter.damage > 60);
      if (wanted) goal = item;
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

    // Con la bomba en la mano, la lanza cuando el rival está a buena distancia y a su altura.
    if (fighter.held?.type === 'bomb') {
      const inRange = Math.abs(dx) > 120 && Math.abs(dx) < 520 && Math.abs(tdy) < 120;
      return { ...IDLE, x: inRange ? Math.sign(dx) * 0.3 : x, ...climb, attack: inRange && Math.random() < 0.1 };
    }

    // Golpe según dónde está el rival: arriba → hacia arriba; abajo estando en el aire → pisotón.
    let aim = climb.y;
    if (level.smart && close) aim = tdy < -40 ? -1 : !fighter.grounded && tdy > 30 ? 1 : 0;
    // Estrella y Robot disparan de lejos si el otro está a su altura; Ninja se le aparece por detrás.
    const key = fighter.characterKey;
    const lined = (key === 'estrella' || key === 'robot') && Math.abs(tdy) < 40 && Math.abs(dx) > 150 && Math.abs(dx) < 600;
    const ambush = key === 'ninja' && best > 200 && best < TELEPORT_RANGE;
    return {
      x,
      y: aim,
      jump: climb.jump,
      attack: close && Math.random() < level.attack,
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
      let sprite;
      if (request.kind === 'bomb' && !fighter.isCpu) rewards.earn('smash-bomba');
      if (request.kind === 'bomb') sprite = drawItem(this, 'bomb');
      else if (request.kind === 'laser') sprite = this.add.rectangle(request.x, request.y, 80, 12, SHOTS.laser.color).setStrokeStyle(3, 0xffffff);
      else sprite = this.add.star(request.x, request.y, 5, 9, 20, SHOTS.star.color).setStrokeStyle(3, 0xffffff);
      // En súper modo los disparos salen más grandes.
      sprite.setScale(fighter.radius / fighter.baseRadius);
      this.world.add(sprite);
      this.projectiles.push({ ...request, sprite, owner: fighter, ageMs: 0 });
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
      const shot = SHOTS[p.kind];
      if (shot) {
        p.x += p.dir * shot.speed * dt;
        p.sprite.setPosition(p.x, p.y);
        if (p.kind === 'star') p.sprite.setAngle(p.ageMs * 0.8);
        const victim = this.touching(p, shot.radius);
        if (victim) {
          const result = victim.takeHit({ facing: p.dir, power: p.owner.power }, shot.hit);
          p.owner.dealtDamage(result.dealt);
          burst(this, p.x, p.y, result.blocked ? 0x7fdcff : shot.color, 6, this.world);
          if (!result.blocked) sfx.hit(0.2);
        }
        if (victim || p.ageMs > shot.lifeMs) {
          p.sprite.destroy();
          return false;
        }
        return true;
      }

      // Bomba: vuela en arco y explota al tocar a alguien, al caer en una plataforma o al acabarse la mecha.
      const prevY = p.y;
      p.vy += BOMB.gravity * dt;
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

  // Primer peleador (que no sea el que lo lanzó) que toca el proyectil.
  touching(p, radius) {
    return this.fighters.find(
      (f) => f !== p.owner && f.isAlive() && !f.isInvulnerable() && Math.hypot(f.x - p.x, f.y - p.y) < f.radius + radius,
    );
  }

  explode(bomb) {
    burst(this, bomb.x, bomb.y, 0xff9a3c, 18, this.world);
    burst(this, bomb.x, bomb.y, 0xffffff, 10, this.world);
    popText(this, bomb.x, bomb.y - 30, '¡BUM!', '#ff9a3c', this.world);
    this.cameras.main.shake(180, 0.008);
    sfx.boom();
    for (const f of this.fighters) {
      if (f === bomb.owner || !f.isAlive() || f.isInvulnerable()) continue;
      if (Math.hypot(f.x - bomb.x, f.y - bomb.y) > BOMB.blast + f.radius) continue;
      const { dealt } = f.takeHit({ facing: Math.sign(f.x - bomb.x) || 1, power: 1 }, BOMB.hit);
      bomb.owner.dealtDamage(dealt);
    }
  }

  resolveHits() {
    for (const attacker of this.fighters) {
      const box = attacker.hitbox();
      if (!box) continue;
      for (const victim of this.fighters) {
        if (victim === attacker || !victim.isAlive() || victim.isInvulnerable() || attacker.attack.hit.has(victim)) continue;
        if (Math.hypot(victim.x - box.x, victim.y - box.y) > box.radius + victim.radius) continue;
        attacker.attack.hit.add(victim);
        const { blocked, speed, dealt } = victim.takeHit(attacker, box.data);
        attacker.dealtDamage(dealt);
        if (blocked) {
          burst(this, box.x, box.y, 0x7fdcff, 6, this.world);
          continue;
        }
        burst(this, box.x, box.y, 0xffffff, 6, this.world);
        popText(this, box.x, box.y - 40, HIT_WORDS[Math.floor(Math.random() * HIT_WORDS.length)], '#ffc93c', this.world);
        if (speed > STRONG_HIT_SPEED) this.cameras.main.shake(120, 0.006);
        sfx.hit(Math.min(1, speed / 1500));
      }
    }
  }

  checkBlastZones() {
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
      fighter.knockOut();
    }
  }

  checkWinner() {
    const standing = this.fighters.filter((fighter) => fighter.stocks > 0);
    if (standing.length > 1) return;
    this.phase = 'end';
    this.phaseMs = 0;
    const winner = standing[0];
    this.showBanner(winner ? `¡Ganó ${winner.label}!` : '¡Empate!', 'A = revancha   ·   B = cambiar personaje   ·   Mantén Y = salir');
    if (winner) {
      this.banner.setColor(hexToCss(winner.color));
      confetti(this, [winner.color, 0xffffff, 0xffc93c], 80, this.ui);
      if (!winner.isCpu) rewards.earn('smash-gana');
    }
    sfx.win();
  }

  updateEnd() {
    if (this.phaseMs < END_INPUT_DELAY_MS) return;
    const humans = this.fighters.filter((f) => !f.isCpu);
    if (humans.some((f) => controls.justPressed(f.deviceId, 'a'))) this.scene.restart(this.returnData);
    else if (humans.some((f) => controls.justPressed(f.deviceId, 'b'))) this.scene.start('SmashSelect', { selected: this.returnData.selected });
  }

  // La cámara se aleja o se acerca para que siempre quepan todos (y el escenario principal).
  updateCamera(dt, snap = false) {
    const points = [
      { x: this.main.left + 120, y: this.main.top - 40 },
      { x: this.main.right - 120, y: this.main.top - 40 },
    ];
    for (const fighter of this.fighters) if (fighter.isAlive()) points.push(fighter);
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

      const key = `${Math.round(fighter.damage)}|${fighter.stocks}`;
      if (slot.shown === key) continue;
      slot.shown = key;
      const color = fighter.damage >= 100 ? '#ff5a5f' : fighter.damage >= 50 ? TEXT.accent : TEXT.normal;
      slot.damage.setText(fighter.stocks > 0 ? `${Math.round(fighter.damage)}%` : '—').setColor(color);
      slot.stocks.forEach((dot, k) => dot.setVisible(k < fighter.stocks));
    }
  }

  updateExit(dt) {
    const holding = this.fighters.some((f) => !f.isCpu && controls.isDown(f.deviceId, 'y'));
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
