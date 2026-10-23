import Phaser from 'phaser';
import { players } from '../../shared/players.js';
import { sfx } from '../../shared/sound.js';
import { Blob } from '../../ui/Blob.js';
import { CharacterLook } from '../../ui/CharacterLook.js';
import { hexToCss, textStyle } from '../../ui/style.js';
import { humanInput } from '../brawl/buddies.js';
import { groundBelow, moveBody, tileAt } from './physics.js';
import { T, isSemi } from './tiles.js';

// Un jugador de Súper Bolitas: corre con el stick (B = más rápido), A = saltar (entre más lo sostienes, más alto),
// X = su poder (bola de fuego, bola de hielo, giro de capa) o la lengua del dinosaurio, abajo = meterse a un tubo y
// arriba = entrar por una puerta. Tamaños: chiquito, grande (hongo), mini (hongo mini: cabe por huecos y corre sobre
// el agua) y gigante un ratito (hongo gigante: rompe bloques y aplasta todo). Poderes (estando grande): fuego (flor),
// hielo (flor de hielo: congela enemigos) y capa (pluma: con A sostenido planea). Si le pegan estando chiquito cae, y
// si hay compañeros regresa en una burbuja que se revienta tocándola. Con "modo peque", si se cae a un hoyo regresa
// rebotando a donde estaba.
const RADIUS = 22;
export const SIZES = {
  small: { w: 30, h: 56, scale: 1 },
  big: { w: 38, h: 80, scale: 1.42 },
  mini: { w: 18, h: 30, scale: 0.55 },
  giant: { w: 86, h: 184, scale: 3.3 },
};
const WALK = 260;
const RUN = 380;
const ACCEL = { ground: 1800, air: 1100 };
const FRICTION = 2200;
// En el hielo casi no frena; en el chicle va despacito y salta poquito.
const ICE = { accel: 0.25, friction: 0.12 };
const STICKY = { speed: 0.45, jump: 0.7 };
const JUMP = 880;
const JUMP_RUN_BONUS = 0.12;
const GRAVITY = { held: 1500, normal: 2800 };
const MAX_FALL = 950;
const COYOTE_MS = 110;
const BUFFER_MS = 130;
const SWIM = { gravity: 520, maxFall: 170, stroke: 360, speed: 220 };
const WATER_EXIT = 720;
// El mini flota más (y como pesa poquito, sobre el agua corre si va rápido).
const MINI = { gravity: 0.6, waterRun: 240 };
// La capa: con A sostenido cae despacito; X = giro que tumba a los de alrededor.
const CAPE = { fall: 110, spinMs: 320 };
export const GIANT_MS = 10000;
export const STOMP_BOUNCE = { normal: 540, held: 860 };
const INVULN_MS = 1800;
export const STAR_MS = 9000;
const DINO = { jump: 1.15, rise: 34, flutterMs: 900, flutterLift: 3500 };
const RAINBOW = [0xff5a5f, 0xff9a3c, 0xffc93c, 0x4cd97b, 0x3fa7ff, 0xb07cff];
// Color del traje con cada poder.
const POWER_TINT = { fire: 0xffd0a0, ice: 0xbfe6ff, cape: null };

export class Player {
  constructor(scene, player, character, { peque = false } = {}) {
    this.scene = scene;
    this.player = player;
    this.deviceId = player.deviceId;
    this.input = humanInput(player.deviceId);
    this.label = `J${player.slot + 1}`;
    this.color = players.color(player).hex;
    this.character = character;
    this.peque = peque;
    this.radius = RADIUS;
    this.size = 'small';
    this.power = null;
    this.giantMs = 0;
    this.starMs = 0;
    this.invulnMs = 0;
    this.spinMs = 0;
    this.flutterMs = 0;
    this.dino = null;
    this.state = 'play';
    this.facing = 1;
    this.x = 0;
    this.y = 0;
    this.vx = 0;
    this.vy = 0;
    this.onGround = false;
    this.coyoteMs = 0;
    this.bufferMs = 0;
    this.holdingJump = false;
    this.throwMs = 0;
    this.lastSafe = null;
    this.hat = null;
    this.stats = { coins: 0, stomps: 0, bigCoins: 0 };

    this.sprite = new Blob(scene, 0, 0, this.color, RADIUS);
    this.look = new CharacterLook(scene, this.sprite, character, { height: 2.6 });
    this.aura = scene.add.circle(0, 0, RADIUS * 1.7, 0xffd84d, 0.4).setBlendMode(Phaser.BlendModes.ADD).setVisible(false);
    this.sprite.addAt(this.aura, 0);
    // La capa: un triángulo rojo detrás del personaje.
    this.cape = scene.add.triangle(0, 0, 0, 0, 30, 0, 22, 46, 0xe53935).setStrokeStyle(3, 0x1b1530).setVisible(false);
    this.sprite.addAt(this.cape, 1);
    this.tag = scene.add.text(0, 0, this.label, textStyle(15, hexToCss(this.color), { fontStyle: 'bold', stroke: '#1b1530', strokeThickness: 4 })).setOrigin(0.5);
    this.bubble = scene.add.circle(0, 0, 46, 0xbfe9ff, 0.35).setStrokeStyle(4, 0xffffff, 0.9).setVisible(false);
    this.sprite.setDepth(50);
    this.tag.setDepth(51);
    this.bubble.setDepth(52);
  }

  // Las medidas de ahorita (el gigante manda sobre el tamaño).
  get dims() {
    return SIZES[this.giantMs > 0 ? 'giant' : this.size];
  }

  get w() {
    return this.dino ? 46 : this.dims.w;
  }

  get h() {
    return this.dims.h + (this.dino ? DINO.rise : 0);
  }

  get active() {
    return this.state === 'play';
  }

  get big() {
    return this.size === 'big';
  }

  get fire() {
    return this.power === 'fire';
  }

  spawn(x, y) {
    Object.assign(this, { x, y, vx: 0, vy: 0, state: 'play', onGround: false, deadMs: 0, giantMs: 0, invulnMs: 0 });
    this.lastSafe = { x, y };
    this.sprite.setVisible(true).setAngle(0);
    this.bubble.setVisible(false);
  }

  update(dtMs, level) {
    this.invulnMs = Math.max(0, this.invulnMs - dtMs);
    this.starMs = Math.max(0, this.starMs - dtMs);
    this.throwMs = Math.max(0, this.throwMs - dtMs);
    this.spinMs = Math.max(0, this.spinMs - dtMs);
    this.stunMs = Math.max(0, (this.stunMs ?? 0) - dtMs);
    if (this.giantMs > 0) {
      this.giantMs = Math.max(0, this.giantMs - dtMs);
      if (this.giantMs === 0) this.scene.giantEnded?.(this);
    }
    const dt = dtMs / 1000;
    if (this.state === 'dead') {
      this.deadMs += dtMs;
      this.vy = Math.min(MAX_FALL, this.vy + GRAVITY.normal * 0.6 * dt);
      this.y += this.vy * dt;
      return;
    }
    if (this.state !== 'play') return;
    const input = this.input;
    // Mareado (el piso tembló): no se puede mover un ratito.
    const stick = this.stunMs > 0 ? { x: 0, y: 0 } : input.stick();
    const water = level.water || tileAt(level, this.x, this.y - this.h / 2) === 'w';
    if (this.swimming && !water && this.vy < 0) this.vy = Math.min(this.vy, -WATER_EXIT);
    this.swimming = water;
    const under = tileAt(level, this.x, this.y + 2);
    const icy = this.onGround && level.ice && !this.platform;
    const sticky = this.onGround && under === 's';

    // De lado: acelera hacia donde apunta el stick; sin stick se frena (en el hielo, resbala).
    const top = water ? SWIM.speed : input.held('b') ? RUN : WALK;
    const want = Math.abs(stick.x) > 0.2 ? Math.sign(stick.x) * top * (sticky ? STICKY.speed : 1) * Math.min(1, Math.abs(stick.x) * 1.3) : 0;
    let accel = want === 0 ? (this.onGround ? FRICTION : ACCEL.air * 0.5) : this.onGround ? ACCEL.ground : ACCEL.air;
    if (icy) accel *= want === 0 ? ICE.friction : ICE.accel;
    this.vx = approach(this.vx, want, accel * dt);
    if (Math.abs(stick.x) > 0.2) this.facing = Math.sign(stick.x);
    if (level.wind && !this.onGround) this.vx -= level.wind * (0.6 + 0.4 * Math.sin(this.scene.time.now / 900)) * dt * 3;

    // Abajo + A en una plataforma que se atraviesa: se baja de ella (en vez de saltar).
    this.dropMs = Math.max(0, (this.dropMs ?? 0) - dtMs);
    const drop = stick.y > 0.7 && input.pressed('a') && this.onGround && isSemi(under);
    if (drop) {
      this.dropMs = 250;
      this.vy = 150;
    }
    this.dropping = this.dropMs > 0;
    // Saltar: con un poquito de margen al salir de una orilla y si lo aprietas justo antes de caer.
    this.coyoteMs = this.onGround && !drop ? COYOTE_MS : Math.max(0, this.coyoteMs - dtMs);
    this.bufferMs = input.pressed('a') && !drop && this.stunMs <= 0 ? BUFFER_MS : Math.max(0, this.bufferMs - dtMs);
    if (drop) this.coyoteMs = 0;
    const wasAir = !this.onGround;
    const fallSpeed = this.vy;
    if (water) {
      if (input.pressed('a')) {
        this.vy = -SWIM.stroke;
        sfx.jump();
      }
      this.vy = Math.min(SWIM.maxFall, this.vy + SWIM.gravity * dt);
    } else {
      if (this.bufferMs > 0 && this.coyoteMs > 0) {
        this.vy = -JUMP * (1 + JUMP_RUN_BONUS * (Math.abs(this.vx) / RUN)) * (this.dino ? DINO.jump : 1) * (sticky ? STICKY.jump : 1);
        this.bufferMs = 0;
        this.coyoteMs = 0;
        this.holdingJump = true;
        this.flutterMs = 0;
        sfx.jump();
      }
      if (!input.held('a') || this.vy > 0) this.holdingJump = false;
      const gravity = (this.holdingJump ? GRAVITY.held : GRAVITY.normal) * (this.size === 'mini' ? MINI.gravity : 1);
      this.vy = Math.min(MAX_FALL, this.vy + gravity * dt);
      // Capa: con A sostenido, planea.
      if (this.power === 'cape' && !this.dino && input.held('a') && this.vy > CAPE.fall) this.vy = CAPE.fall;
      // Dinosaurio azul: con A sostenido aletea un ratito (sube un poquito).
      if (this.dino?.color === 'azul' && !this.onGround && input.held('a') && this.vy > -150 && this.flutterMs < DINO.flutterMs) {
        this.flutterMs += dtMs;
        this.vy -= DINO.flutterLift * dt;
      }
    }
    // Gigante: rompe los bloques que tiene enfrente (y arriba) antes de chocar con ellos.
    if (this.giantMs > 0) this.scene.giantSmash?.(this);
    this.canFindHidden = true;
    moveBody(level, this, dt, { bump: (col, row) => this.scene.bumpBlock(col, row, this) });
    if (this.hitCeiling) sfx.block();
    // Mini corriendo rápido: el agua lo detiene como si fuera piso.
    if (this.size === 'mini' && !this.onGround && this.vy >= 0 && Math.abs(this.vx) > MINI.waterRun) {
      const row = Math.floor(this.y / T);
      const col = Math.floor(this.x / T);
      if (level.at(col, row) === 'w' && level.at(col, row - 1) !== 'w' && this.y - row * T < 16) {
        this.y = row * T;
        this.vy = 0;
        this.onGround = true;
      }
    }
    this.scene.platforms?.carry(this, dt);
    this.scene.iceBlocksCarry?.(this);
    if (this.onGround && !this.platform && !this.onIce) this.lastSafe = { x: this.x, y: this.y };
    this.walking = this.onGround && Math.abs(this.vx) > 30;
    // Dinosaurio amarillo: al caer de un salto hace temblar el piso.
    if (this.dino?.color === 'amarillo' && wasAir && this.onGround && fallSpeed > 500) this.scene.dinoQuake?.(this);

    if (input.pressed('x')) this.scene.action(this);
    this.look.changeNumber(input.numberStep(), this.deviceId);
    if (stick.y > 0.6 && this.onGround) this.scene.tryWarp(this);
    // ↑ en una puerta (hay que soltarlo para volver a entrar: si no, regresaría luego luego).
    const up = stick.y < -0.6;
    if (up && !this.upHeld && this.onGround) this.scene.tryDoor?.(this);
    this.upHeld = up;

    // ¿Se cayó a un hoyo?
    if (this.y > level.height + 80) {
      if (this.peque && this.lastSafe) {
        const spot = this.safeSpot(level);
        Object.assign(this, { x: spot.x, y: spot.y - 4, vx: 0, vy: -300, invulnMs: 1500 });
        this.scene.pequeRescue(this);
      } else {
        this.die();
      }
    }
  }

  // A dónde lo regresa el modo peque: donde estaba parado, si ahí sigue habiendo piso (los bloques de colores o los
  // ladrillos del botón P pueden desaparecer); si no, al banderín o al principio.
  safeSpot(level) {
    const spot = this.lastSafe;
    if (spot && groundBelow(level, spot.x, spot.y)) return spot;
    return this.scene.checkpoint ?? level.start;
  }

  // Le pegó un enemigo. Devuelve true si sí le hizo algo.
  hurt() {
    if (this.state !== 'play' || this.invulnMs > 0 || this.starMs > 0 || this.giantMs > 0) return false;
    if (this.dino) {
      this.scene.dinoRunsAway(this);
      this.invulnMs = INVULN_MS;
      return true;
    }
    // Con poder se queda grande sin poder; grande se hace chiquito; chiquito (o mini) cae.
    if (this.power || this.big) {
      if (this.power) this.power = null;
      else this.size = 'small';
      this.setSize(this.size);
      this.invulnMs = INVULN_MS;
      sfx.powerDown();
      this.look.flash();
      return true;
    }
    this.die();
    return true;
  }

  die() {
    if (this.state !== 'play') return;
    this.state = 'dead';
    this.deadMs = 0;
    this.vy = -720;
    this.vx = 0;
    this.power = null;
    this.starMs = 0;
    this.giantMs = 0;
    if (this.dino) this.scene.dinoRunsAway(this, { silent: true });
    this.setSize('small');
    sfx.ko();
    this.scene.playerDied(this);
  }

  toBubble(x, y) {
    this.state = 'bubble';
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.sprite.setAngle(0);
    this.bubble.setVisible(true);
  }

  popBubble() {
    this.state = 'play';
    this.vy = -320;
    this.invulnMs = 2000;
    this.bubble.setVisible(false);
    sfx.pickup();
  }

  setSize(size) {
    this.size = size;
    // El color del poder; si no hay, el del traje de la tienda.
    this.look.setCostume((this.power && POWER_TINT[this.power]) || this.outfitTint || null);
  }

  // Hongo: chiquito o mini → grande.
  grow() {
    if (this.big) return false;
    this.y -= 2;
    this.setSize('big');
    sfx.transform();
    return true;
  }

  // Flor de fuego, flor de hielo o pluma (capa).
  getPower(power) {
    this.power = power;
    this.setSize('big');
    sfx.transform();
  }

  getFire() {
    this.getPower('fire');
  }

  shrinkMini() {
    this.power = null;
    this.setSize('mini');
    sfx.powerDown();
  }

  growGiant() {
    this.giantMs = GIANT_MS;
    if (this.size !== 'big') this.setSize('big');
    sfx.transform();
  }

  // Le brincó encima a un enemigo: rebota (más alto si sigue apretando A).
  bounce() {
    this.vy = -(this.input.held('a') ? STOMP_BOUNCE.held : STOMP_BOUNCE.normal);
    this.holdingJump = this.input.held('a');
  }

  render() {
    const s = this.dims;
    // Al crecer a gigante (y al regresar) cambia de tamaño poco a poco.
    const target = s.scale;
    this.shownScale = this.shownScale ? this.shownScale + (target - this.shownScale) * 0.2 : target;
    const scale = this.shownScale;
    const rise = this.dino ? DINO.rise : 0;
    this.sprite.setPosition(this.x, this.y - RADIUS * scale - rise).setScale(scale);
    this.sprite.setDepth(this.state === 'bubble' ? 60 : this.giantMs > 0 ? 49 : 50);
    let pose;
    if (this.state === 'dead') pose = 'dolor';
    else if (this.state === 'bubble') pose = 'normal';
    else if (this.throwMs > 0 || this.spinMs > 0) pose = 'golpe';
    else if (!this.onGround || this.swimming) pose = 'salto';
    else pose = this.look.groundPose(this.walking && !this.dino);
    this.look.show(pose, this.facing);
    if (this.state === 'dead') this.sprite.setAngle(this.sprite.angle + 6);
    else this.sprite.setAngle(this.spinMs > 0 ? (1 - this.spinMs / CAPE.spinMs) * 360 : 0);
    const blink = this.invulnMs > 0 && Math.floor(this.invulnMs / 90) % 2 === 1;
    this.sprite.setAlpha(blink ? 0.35 : 1);
    const now = this.scene.time.now;
    this.aura.setVisible(this.starMs > 0);
    if (this.starMs > 0) this.aura.setFillStyle(RAINBOW[Math.floor(now / 90) % RAINBOW.length], this.starMs < 2000 && Math.floor(now / 150) % 2 ? 0.15 : 0.45);
    // La capa ondea (más si va planeando).
    const caped = this.power === 'cape' && this.state === 'play';
    this.cape.setVisible(caped);
    if (caped) {
      const gliding = !this.onGround && this.vy > 0;
      this.cape.setPosition(-this.facing * RADIUS * 0.6, -RADIUS * 0.9).setScale(-this.facing, 1).setAngle(this.facing * (gliding ? -55 : 10 + Math.sin(now / 120) * 8));
    }
    this.hat?.setPosition(this.facing * 2, this.look.top + 12).setFlipX(this.facing < 0);
    const top = this.y - s.h - rise - 14;
    this.tag.setPosition(this.x, top).setVisible(this.state === 'play');
    this.bubble.setPosition(this.x, this.y - RADIUS * scale).setScale(0.9 + 0.06 * Math.sin(now / 200));
  }

  destroy() {
    this.sprite.destroy();
    this.tag.destroy();
    this.bubble.destroy();
  }
}

function approach(value, target, step) {
  if (value < target) return Math.min(target, value + step);
  return Math.max(target, value - step);
}
