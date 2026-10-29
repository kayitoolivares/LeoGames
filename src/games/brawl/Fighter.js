import Phaser from 'phaser';
import { players } from '../../shared/players.js';
import { sfx } from '../../shared/sound.js';
import { Blob } from '../../ui/Blob.js';
import { CharacterLook } from '../../ui/CharacterLook.js';
import { COLORS, hexToCss, textStyle } from '../../ui/style.js';
import { fitPose, hasPose, superArtKey } from '../smash/art.js';
import { isBlockCharacter } from '../smash/bloquecito.js';
import { drawItem } from '../smash/items.js';
import { ARENA } from './arena.js';
import { humanInput } from './buddies.js';
import { levelPerks } from './levels.js';
import { MOUNTS, MOUNT_REACH } from './mounts.js';
import { SPECIALS, SPECIAL_COOLDOWN_MS, blockSpecial } from './specials.js';

export const MAX_HP = 5;
const RADIUS = 34;
const SPEED_X = 270;
const SPEED_Y = 190;
const JUMP_SPEED = 640;
const GRAVITY = 1900;
const ATTACK_MS = 160;
const ATTACK_COOLDOWN_MS = 260;
const ATTACK_REACH = 30;
const DEPTH_TOLERANCE = 34;
const INVULNERABLE_MS = 1100;
// Saltando por arriba de esta altura, los monstruos no te alcanzan.
const DODGE_HEIGHT = 30;
const REVIVE_RADIUS = 70;
const REVIVE_MS = 1200;
const REVIVE_HP = 3;
// Tres golpes seguidos (sin esperar mucho entre uno y otro) = remate, que avienta lejos.
const COMBO_WINDOW_MS = 700;
const FINISHER_MS = 220;
// La barra de poder: se llena pegando (y un poquito cuando te pegan). Llena + LB + RB = súper un rato.
export const METER_MAX = 100;
const METER_PER_HIT = 9;
const METER_PER_HURT = 5;
export const SUPER_MS = 9000;
const SUPER_SPEED = 1.25;
// Agarrar (LB o RB solo): al monstruo de enfrente; si no lo avientas, lo avientas solo a este tiempo.
const GRAB_REACH = 46;
const HOLD_MS = 2500;
// Objetos: el martillo dura un rato; la estrella te hace invencible y lastima a los que toques.
export const HAMMER_MS = 10000;
export const STAR_MS = 6000;
// Objetos nuevos: la espada pega doble y llega más lejos; el escudo aguanta unos golpes; el imán jala las monedas y
// la comida.
export const SWORD_MS = 12000;
const SWORD_REACH = 55;
export const SHIELD_HITS = 3;
export const MAGNET_MS = 15000;
const SLOW = 0.5;
const CELEBRATE_MS = 1500;

// Un jugador en la pelea: se mueve con el stick, salta con A, pega con X (tres seguidos = remate), B = su especial,
// LB o RB = agarrar y aventar, barra llena + LB + RB = súper (Bloquecito cambia de número con Y).
// Si se queda sin corazones cae, y otro jugador lo levanta parándose junto a él.
// Se ve como el personaje que escogió (`character`, de Bolitas Bros). Lo que pega y a quién lo resuelve la escena.
// Los amigos de la compu traen `input` (ver buddies.js), su `label` y su `color`; los jugadores usan su control.
export class Fighter {
  constructor(scene, player, x, y, character, { input = null, label = null, color = null } = {}) {
    this.scene = scene;
    this.player = player;
    this.deviceId = player.deviceId ?? null;
    this.isCpu = Boolean(input);
    this.input = input ?? humanInput(player.deviceId);
    this.label = label ?? `J${player.slot + 1}`;
    this.character = character;
    this.color = color ?? players.color(player).hex;
    this.radius = RADIUS;
    this.x = x;
    this.y = y;
    this.z = 0;
    this.vz = 0;
    this.knockback = 0;
    this.facing = 1;
    // El nivel del personaje (ver levels.js; la escena lo pone con setLevel): más corazones y otras mejoritas.
    this.level = 1;
    this.perks = levelPerks(1);
    this.maxHp = MAX_HP;
    this.hp = MAX_HP;
    this.superTotalMs = SUPER_MS;
    this.down = false;
    this.reviveMs = 0;
    this.attackMs = 0;
    this.finisher = false;
    this.chain = 0;
    this.sincePunchMs = Infinity;
    this.cooldownMs = 0;
    this.specialCooldownMs = 0;
    this.special = null;
    this.invulnerableMs = 0;
    this.meter = 0;
    this.superMs = 0;
    this.superStartedAt = -Infinity;
    this.holding = null;
    this.item = null;
    this.starMs = 0;
    this.ghostMs = 0;
    this.celebrateMs = 0;
    this.dashMs = 0;
    this.dashSpeed = 0;
    this.mount = null;
    this.shieldHits = 0;
    this.magnetMs = 0;
    this.slowMs = 0;
    this.hat = null;
    this.hitThisAttack = new Set();
    // Para los premios del final del mundo.
    this.stats = newStats();

    this.sprite = new Blob(scene, x, y, this.color, RADIUS);
    this.look = new CharacterLook(scene, this.sprite, character, { fx: true, poses: 'all' });
    this.blocks = isBlockCharacter(character);
    this.superArt = this.blocks ? null : superArtKey(scene, character);
    // Con imagen, un aro del color del jugador en el piso dice quién es quién.
    if (this.look.hasArt) this.sprite.addAt(scene.add.ellipse(0, RADIUS - 2, RADIUS * 2.4, RADIUS * 0.6).setStrokeStyle(5, this.color), 1);
    // Brillo en súper y destellos de colores con la estrella.
    this.aura = scene.add.circle(0, -RADIUS * 0.6, RADIUS * 1.9, 0xffd84d, 0.45).setBlendMode(Phaser.BlendModes.ADD).setVisible(false);
    this.sprite.addAt(this.aura, 0);
    // Nivel 10: un brillo dorado en los pies que siempre late.
    this.levelGlow = scene.add.ellipse(0, RADIUS - 2, RADIUS * 3.2, RADIUS * 0.9, 0xffd84d, 0.4).setBlendMode(Phaser.BlendModes.ADD).setVisible(false);
    this.sprite.addAt(this.levelGlow, 0);
    this.fist = scene.add.circle(0, 6, 11, this.color).setStrokeStyle(3, COLORS.ink).setVisible(false);
    this.hammer = drawItem(scene, 'hammer').setVisible(false);
    this.bomb = drawItem(scene, 'bomb').setScale(0.8).setVisible(false);
    this.tag = scene.add
      .text(0, this.look.top - 14, this.label, textStyle(16, hexToCss(this.color), { fontStyle: 'bold', stroke: '#1b1530', strokeThickness: 4 }))
      .setOrigin(0.5);
    this.sword = propImage(scene, 'espada', 70) ?? scene.add.rectangle(0, 0, 10, 60, 0x9a6a3a).setStrokeStyle(2, COLORS.ink);
    this.sword.setVisible(false);
    // El escudo: una burbuja azul que aguanta golpes.
    this.shieldBubble = scene.add.circle(0, -RADIUS * 0.4, RADIUS * 1.7, 0x7fdcff, 0.25).setStrokeStyle(4, 0xffffff, 0.8).setVisible(false);
    this.sprite.figure.add([this.fist, this.hammer, this.bomb, this.sword, this.tag]);
    this.sprite.add(this.shieldBubble);
    this.stars = scene.add.text(0, this.look.top - 6, '✦ ¡Ayuda! ✦', textStyle(18, '#ffc93c', { fontStyle: 'bold', stroke: '#1b1530', strokeThickness: 4 }));
    this.stars.setOrigin(0.5).setVisible(false);
    this.sprite.add(this.stars);
    this.reviveRing = scene.add.graphics();
  }

  // Pone el nivel del personaje y sus mejoras. Si gana un corazón a media pelea, se lo llena.
  setLevel(level) {
    const before = this.maxHp;
    this.level = level;
    this.perks = levelPerks(level);
    this.maxHp = MAX_HP + this.perks.hearts;
    if (this.maxHp > before && !this.down) this.hp = Math.min(this.maxHp, this.hp + this.maxHp - before);
    // La estrellita (nivel 5) y la corona (nivel 10) van junto al nombre.
    this.tag.setText(`${this.label}${this.perks.crown ? ' 👑' : this.perks.star ? ' ⭐' : ''}`);
    this.levelGlow.setVisible(this.perks.crown);
  }

  isAttacking() {
    return this.attackMs > 0;
  }

  get busy() {
    return Boolean(this.special) || this.dashMs > 0;
  }

  // Cuánto vale cada golpe: más con el martillo (o la espada), montado y en súper.
  get power() {
    const weapon = this.item?.type === 'hammer' || this.item?.type === 'sword' ? 2 : 1;
    return weapon * (this.mount ? 2 : 1) * (this.superMs > 0 ? 2 : 1) * this.perks.power;
  }

  specialData() {
    return this.blocks ? blockSpecial(this.look.form) : SPECIALS[this.character] ?? SPECIALS.tanque;
  }

  update(dtMs, fighters) {
    this.cooldownMs = Math.max(0, this.cooldownMs - dtMs);
    this.specialCooldownMs = Math.max(0, this.specialCooldownMs - dtMs * (this.superMs > 0 ? 2 : 1));
    this.invulnerableMs = Math.max(0, this.invulnerableMs - dtMs);
    this.starMs = Math.max(0, this.starMs - dtMs);
    this.ghostMs = Math.max(0, this.ghostMs - dtMs);
    this.celebrateMs = Math.max(0, this.celebrateMs - dtMs);
    this.magnetMs = Math.max(0, this.magnetMs - dtMs);
    this.slowMs = Math.max(0, this.slowMs - dtMs);
    this.sincePunchMs += dtMs;
    this.updateSuper(dtMs);
    if (this.item) {
      this.item.ms -= dtMs;
      if (this.item.ms <= 0) this.item = null;
    }
    if (this.down) {
      this.updateDown(dtMs, fighters);
      return;
    }

    const dt = dtMs / 1000;
    const id = this.deviceId;
    const stick = this.input.stick();
    // Más rápido en súper, con la estrella o montado; más lento en el chicle.
    const speed = (this.superMs > 0 || this.starMs > 0 ? SUPER_SPEED : 1) * (this.mount ? MOUNTS[this.mount.kind].speed : 1) * (this.slowMs > 0 ? SLOW : 1);
    this.walking = Math.hypot(stick.x, stick.y) > 0.2 && !this.busy;
    if (this.dashMs > 0) {
      this.dashMs = Math.max(0, this.dashMs - dtMs);
      this.x += this.facing * this.dashSpeed * dt;
    } else if (!this.special) {
      this.x += stick.x * SPEED_X * speed * dt;
      this.y += stick.y * SPEED_Y * speed * dt;
      if (stick.x > 0.2) this.facing = 1;
      else if (stick.x < -0.2) this.facing = -1;
    }
    this.x += this.knockback * dt;
    this.knockback = decay(this.knockback, dt);

    if (this.input.pressed('a') && this.z === 0 && !this.busy) this.vz = JUMP_SPEED;
    this.look.changeNumber(this.input.numberStep(), this.isCpu ? null : id);
    if (this.z > 0 || this.vz > 0) {
      this.vz -= GRAVITY * dt;
      this.z = Math.max(0, this.z + this.vz * dt);
      if (this.z === 0) {
        this.vz = 0;
        this.scene.landed?.(this);
      }
    }

    this.handleButtons(dtMs);
    this.attackMs = Math.max(0, this.attackMs - dtMs);
    if (this.special) {
      this.special.t += dtMs;
      if (this.special.t >= this.special.ms) this.special = null;
    }

    this.x = clamp(this.x, ARENA.left, ARENA.right);
    this.y = clamp(this.y, ARENA.top, ARENA.bottom);
  }

  handleButtons(dtMs) {
    const input = this.input;
    const lb = input.pressed('lb');
    const rb = input.pressed('rb');
    const both = input.held('lb') && input.held('rb') && (lb || rb);
    if (both) {
      if (this.meter >= METER_MAX && this.superMs === 0) this.startSuper();
      return;
    }
    // Con un monstruo agarrado: X, LB o RB lo avientan.
    if (this.holding) {
      this.holdMs -= dtMs;
      if (lb || rb || input.pressed('x') || input.pressed('b') || this.holdMs <= 0) this.throwHeld();
      return;
    }
    if ((lb || rb) && !this.busy) {
      this.tryGrab();
      return;
    }
    if (input.pressed('b') && this.specialCooldownMs === 0 && !this.busy && this.attackMs === 0) {
      this.startSpecial();
      return;
    }
    if (input.pressed('x') && this.cooldownMs === 0 && !this.busy) {
      // Con la bomba en la mano, X la lanza.
      if (this.item?.type === 'bomb') {
        this.item = null;
        this.scene.throwBomb?.(this);
        this.attackMs = ATTACK_MS;
        this.cooldownMs = ATTACK_COOLDOWN_MS;
        return;
      }
      this.chain = this.sincePunchMs < COMBO_WINDOW_MS ? this.chain + 1 : 1;
      this.sincePunchMs = 0;
      this.finisher = this.chain >= 3;
      if (this.finisher) this.chain = 0;
      this.attackMs = this.finisher ? FINISHER_MS : ATTACK_MS;
      this.attackId = (this.attackId ?? 0) + 1;
      this.cooldownMs = this.finisher ? ATTACK_COOLDOWN_MS * 1.6 : ATTACK_COOLDOWN_MS;
      this.hitThisAttack.clear();
      sfx.throw();
    }
  }

  startSpecial() {
    const data = this.specialData();
    this.special = { data, t: 0, ms: data.ms ?? 380, hit: new Set(), fired: false };
    this.attackId = (this.attackId ?? 0) + 1;
    this.specialCooldownMs = (data.cooldownMs ?? SPECIAL_COOLDOWN_MS) * this.perks.special;
    if (data.kind === 'dash') {
      this.dashMs = data.ms;
      this.dashSpeed = data.speed;
    } else if (data.kind === 'slam') {
      this.vz = JUMP_SPEED * 1.15;
      this.special.ms = 1200;
    } else if (data.kind === 'ghost') {
      this.ghostMs = data.ms;
      this.special.ms = 300;
    } else if (data.kind === 'flurry') {
      this.special.ms = data.hits * data.gapMs + 100;
    }
    this.scene.specialStarted?.(this, data);
  }

  // Un monstruo chiquito enfrente: lo agarra (los jefes no se dejan).
  tryGrab() {
    const target = this.scene.monsters?.find((m) => m.canBeGrabbed() && this.canHit(m, GRAB_REACH));
    if (!target) return;
    this.holding = target;
    this.holdMs = HOLD_MS;
    target.grab(this);
    this.scene.practiced?.(this, 'grab');
    sfx.block();
  }

  throwHeld() {
    const monster = this.holding;
    this.holding = null;
    if (!monster || monster.dead) return;
    monster.x = this.x + this.facing * (this.radius + monster.radius);
    monster.y = this.y;
    monster.throwTo(this.facing);
    this.attackMs = ATTACK_MS;
    this.scene.thrown?.(this, monster);
    sfx.throw();
  }

  // Barra llena + LB + RB: súper un rato (más fuerte y rápido, con su dibujo de súper si lo tiene).
  startSuper() {
    this.meter = 0;
    this.superTotalMs = SUPER_MS + this.perks.superMs;
    this.superMs = this.superTotalMs;
    this.superStartedAt = this.scene.time.now;
    if (this.blocks) this.look.setSuper(true);
    else if (this.superArt) this.look.character = this.superArt;
    sfx.transform();
    this.scene.superStarted?.(this);
  }

  updateSuper(dtMs) {
    if (this.superMs <= 0) return;
    this.superMs = Math.max(0, this.superMs - dtMs);
    if (this.superMs > 0) return;
    if (this.blocks) this.look.setSuper(false);
    else this.look.character = this.character;
    sfx.powerDown();
  }

  addMeter(amount) {
    if (this.superMs > 0) return;
    const before = this.meter;
    this.meter = Math.min(METER_MAX, this.meter + amount * this.perks.meter);
    if (before < METER_MAX && this.meter >= METER_MAX) this.scene.meterFull?.(this);
  }

  // Le pegó a un monstruo: cuenta para los premios y llena la barra.
  landedHit() {
    this.stats.hits += 1;
    this.addMeter(METER_PER_HIT);
    this.scene.landedHitXp?.(this);
  }

  updateDown(dtMs, fighters) {
    // Cada compañero cerca ayuda: entre más, más rápido se levanta.
    const helpers = fighters.filter((f) => f !== this && !f.down && Math.hypot(f.x - this.x, (f.y - this.y) * 1.4) < REVIVE_RADIUS + f.radius);
    // (Desde el nivel 2, cada quien levanta más rápido.)
    const help = helpers.reduce((sum, f) => sum + f.perks.revive, 0);
    this.reviveMs = helpers.length > 0 ? this.reviveMs + dtMs * help : Math.max(0, this.reviveMs - dtMs * 0.5);
    if (this.reviveMs >= REVIVE_MS) {
      this.down = false;
      this.hp = REVIVE_HP;
      this.invulnerableMs = INVULNERABLE_MS;
      this.reviveMs = 0;
      for (const helper of helpers) helper.stats.revives += 1;
      this.scene.revived?.(this, helpers);
    }
  }

  canHit(target, reach = ATTACK_REACH) {
    const ahead = (target.x - this.x) * this.facing;
    return ahead > -10 && ahead < this.radius + target.radius + reach && Math.abs(target.y - this.y) < DEPTH_TOLERANCE + target.radius * 0.3;
  }

  // Alcance del golpe normal (con martillo o espada, o montado, llega más lejos).
  get reach() {
    const weapon = this.item?.type === 'hammer' ? 40 : this.item?.type === 'sword' ? SWORD_REACH : 0;
    return ATTACK_REACH + weapon + (this.mount ? MOUNT_REACH : 0) + (this.finisher ? 20 : 0);
  }

  // Devuelve true si el golpe sí le quitó un corazón. El escudo y el animal que montas aguantan el golpe por ti.
  hurt(fromX) {
    if (this.down || this.invulnerableMs > 0 || this.z > DODGE_HEIGHT || this.starMs > 0 || this.ghostMs > 0) return false;
    if (this.shieldHits > 0 || this.mount) {
      this.invulnerableMs = INVULNERABLE_MS;
      this.knockback = (Math.sign(this.x - fromX) || 1) * 260;
      if (this.shieldHits > 0) {
        this.shieldHits -= 1;
        this.scene.shieldBlocked?.(this);
      } else {
        this.scene.mountHit?.(this);
      }
      return false;
    }
    this.hp -= 1;
    this.invulnerableMs = INVULNERABLE_MS;
    this.knockback = (Math.sign(this.x - fromX) || 1) * 420;
    this.addMeter(METER_PER_HURT);
    this.look.flash();
    this.look.express('asustado', 800);
    if (this.holding) this.throwHeld();
    this.special = null;
    this.dashMs = 0;
    if (this.hp <= 0) {
      this.down = true;
      this.hp = 0;
      this.reviveMs = 0;
      this.attackMs = 0;
      this.z = 0;
      this.vz = 0;
      this.knockback = 0;
      this.scene.fell?.(this);
    }
    return true;
  }

  heal(amount = 1) {
    if (this.down || this.hp >= this.maxHp) return false;
    this.hp = Math.min(this.maxHp, this.hp + amount);
    return true;
  }

  // Al reintentar una ronda (o empezar otro mundo) todos regresan completos.
  reset() {
    this.down = false;
    this.hp = this.maxHp;
    this.reviveMs = 0;
    this.invulnerableMs = INVULNERABLE_MS;
    this.special = null;
    this.dashMs = 0;
    this.holding = null;
    this.mount = null;
    this.shieldHits = 0;
    this.magnetMs = 0;
  }

  celebrate() {
    this.celebrateMs = CELEBRATE_MS;
  }

  // Qué pose mostrar (si su dibujo no la trae, la más parecida).
  pose() {
    const hurting = this.down || (this.invulnerableMs > INVULNERABLE_MS - 350 && this.knockback !== 0);
    if (hurting) return 'dolor';
    if (this.holding) return 'agarre';
    if (this.special) return this.special.data.kind === 'slam' && this.z > 0 ? 'aire' : 'especial';
    if (this.dashMs > 0) return 'especial';
    if (this.attackMs > 0) return this.z > 0 ? 'aire' : this.finisher ? 'patada' : 'golpe';
    if (this.z > 0) return 'salto';
    if (this.celebrateMs > 0) return 'gana';
    return null;
  }

  render() {
    const s = this.sprite;
    s.setPosition(this.x, this.y).setDepth(this.y);
    // Montado va sentado arriba del animal.
    s.figure.y = -this.z - (this.mount ? this.mount.data.seat : 0);
    s.figure.angle = this.down ? 90 : 0;
    const blinking = this.invulnerableMs > 0 && !this.down && Math.floor(this.invulnerableMs / 90) % 2 === 1;
    s.setAlpha(this.down ? 0.75 : this.ghostMs > 0 ? 0.3 : blinking ? 0.35 : 1);
    s.look(this.facing * 0.9, 0);
    const ground = this.look.groundPose(Boolean(this.walking) && !this.down && !this.mount);
    const wanted = this.pose();
    let pose = wanted ?? ground;
    // Las poses de pelea son opcionales (y las súper formas solo traen las básicas).
    if (wanted && !this.look.body) pose = (POSE_CHAIN[wanted] ?? [wanted]).find((p) => hasPose(this.scene, this.look.character, p)) ?? 'normal';
    this.look.show(pose, this.facing);
    if (this.look.image) fitPose(this.look.image, this.radius * 2.8, POSE_HEIGHT[pose] ?? 1);
    // Bloquecito sube y baja de tamaño con su número: los letreros van arriba de su cabeza.
    if (this.look.body) {
      this.tag.setY(this.look.top - 14);
      this.stars.setY(this.look.top - 6);
    }
    this.tag.setVisible(!this.down);
    this.stars.setVisible(this.down);
    // El sombrero de la tienda va arriba de la cabeza (que sube y baja con la pose).
    this.hat?.setPosition(this.facing * 2, this.look.top + 12).setFlipX(this.facing < 0);
    if (this.hat) this.tag.setY(this.look.top - 50);
    this.shieldBubble.setVisible(this.shieldHits > 0 && !this.down).setAlpha(0.6 + 0.3 * Math.sin(this.scene.time.now / 150));

    // Súper: brillo dorado que late; estrella: brillo de colores.
    const now = this.scene.time.now;
    this.aura.setVisible(this.superMs > 0 || this.starMs > 0);
    if (this.starMs > 0) this.aura.setFillStyle(RAINBOW[Math.floor(now / 90) % RAINBOW.length], 0.45);
    else if (this.superMs > 0) this.aura.setFillStyle(0xffd84d, this.superMs < 2000 && Math.floor(now / 120) % 2 === 0 ? 0.15 : 0.45);
    this.aura.setScale(1 + 0.08 * Math.sin(now / 90));
    if (this.levelGlow.visible) this.levelGlow.setAlpha(0.3 + 0.2 * Math.sin(now / 220));

    // El puño sale y regresa durante el golpe (si su dibujo no trae la pose de golpe).
    const progress = this.attackMs > 0 ? 1 - this.attackMs / ATTACK_MS : 0;
    this.fist.setVisible(this.attackMs > 0 && !this.look.punchArt && !this.item);
    this.fist.setPosition(this.facing * (this.radius * 0.6 + Math.sin(progress * Math.PI) * 34), 6);
    // El martillo (o la bomba) en la mano.
    const hammer = this.item?.type === 'hammer';
    this.hammer.setVisible(hammer && !this.down);
    if (hammer) this.hammer.setPosition(this.facing * this.radius * 0.9, -10).setScale(this.facing, 1).setAngle(this.facing * (this.attackMs > 0 ? 60 : -25));
    const sword = this.item?.type === 'sword';
    this.sword.setVisible(sword && !this.down);
    if (sword) this.sword.setPosition(this.facing * this.radius * 0.9, -12).setScale(this.facing * Math.abs(this.sword.scaleY), this.sword.scaleY).setAngle(this.facing * (this.attackMs > 0 ? 70 : -30));
    this.bomb.setVisible(this.item?.type === 'bomb' && !this.down);
    if (this.item?.type === 'bomb') this.bomb.setPosition(this.facing * this.radius * 0.9, -6);

    const ring = this.reviveRing;
    ring.clear();
    if (!this.down) return;
    ring.setDepth(this.y - 1);
    ring.lineStyle(4, this.color, 0.5);
    ring.strokeEllipse(this.x, this.y, REVIVE_RADIUS * 2, (REVIVE_RADIUS * 2) / 1.4);
    if (this.reviveMs > 0) {
      const end = -Math.PI / 2 + (this.reviveMs / REVIVE_MS) * Math.PI * 2;
      ring.lineStyle(8, 0xffffff, 1);
      ring.beginPath();
      ring.arc(this.x, this.y - this.radius - 50, 16, -Math.PI / 2, end, false);
      ring.strokePath();
    }
  }

  destroy() {
    this.sprite.destroy();
    this.reviveRing.destroy();
  }
}

const RAINBOW = [0xff5a5f, 0xff9a3c, 0xffc93c, 0x4cd97b, 0x3fa7ff, 0xb07cff];

// Lo que se cuenta de cada quien para las medallas del final del mundo.
export function newStats() {
  return { hits: 0, kills: 0, revives: 0, boss: 0, coins: 0, rescues: 0, rides: 0 };
}

// La imagen de un objeto de Pelea en equipo (npm run arte), de `size` px; o null si no hay.
function propImage(scene, name, size) {
  const key = `brawl:objeto-${name}`;
  if (!scene.textures.exists(key)) return null;
  const image = scene.add.image(0, 0, key);
  return image.setScale(size / Math.max(image.width, image.height));
}
const POSE_CHAIN = {
  patada: ['patada', 'golpe'],
  aire: ['aire', 'patada', 'salto'],
  especial: ['especial', 'golpe'],
  agarre: ['agarre', 'golpe'],
  gana: ['gana', 'salto'],
  golpe: ['golpe'],
  salto: ['salto'],
  dolor: ['dolor'],
};
// Las imágenes se ajustan a la misma altura; las más bajitas o altas en el dibujo se corrigen aquí.
const POSE_HEIGHT = { gana: 1.08, patada: 0.95, aire: 0.95 };

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

// El empujón de un golpe se frena rápido.
function decay(velocity, dt) {
  const next = velocity * Math.pow(0.001, dt);
  return Math.abs(next) < 5 ? 0 : next;
}
