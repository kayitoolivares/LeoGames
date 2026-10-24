import Phaser from 'phaser';
import { sfx } from '../../shared/sound.js';
import { Blob } from '../../ui/Blob.js';
import { CharacterLook } from '../../ui/CharacterLook.js';
import { COLORS, hexToCss, textStyle } from '../../ui/style.js';
import { fitPose, hasPose, superArtKey } from '../smash/art.js';
import { FIELD, TEAM_COLORS, attackDir } from './field.js';

export const PLAYER_RADIUS = 36;
const SPEED = 340;
const ACCEL = 2600;
const JUMP_SPEED = 720;
const GRAVITY = 1900;
const KICK_MS = 160;
const KICK_COOLDOWN_MS = 320;
const KICK_REACH = 34;
// Patadas: normal, globito (con ↑), rasante (con ↓) y volea (en el aire).
const KICKS = {
  normal: { vx: 720, vy: -340 },
  lob: { vx: 470, vy: -780 },
  low: { vx: 820, vy: -90 },
  volley: { vx: 900, vy: -220 },
};
// Barrida (B lejos del balón): se lanza al piso hacia adelante; el que se barre le quita el balón al de enfrente
// y al rival que toque lo tumba un ratito.
const SLIDE = { ms: 380, speed: 620, cooldownMs: 900, tumbleMs: 700 };
// Regate (LB o RB): un arrancón cortito en el que no te pueden barrer.
const DRIBBLE = { ms: 320, speed: 1.9, cooldownMs: 1200 };
// La barra del tiro especial se llena tocando y pateando el balón.
export const METER_MAX = 100;
const METER_PER_KICK = 14;
const METER_PER_TOUCH_MS = 0.02;
// Poderes: tenis (corres más) y congelado (no te mueves).
const SHOES_SPEED = 1.45;
const CELEBRATE_MS = 2200;
const CELEBRATE_HOP = 480;
const METER_W = 58;

// El tiro especial de cada personaje: derecho y de fuego, en zigzag o como cohete (sube y cae en picada).
const SPECIAL_SHOTS = {
  tanque: ['fire', 0xff9a3c],
  rayo: ['zigzag', 0xffe14d],
  resorte: ['rocket', 0xff6fb5],
  estrella: ['rocket', 0xffd84d],
  ninja: ['zigzag', 0x8a86b8],
  robot: ['fire', 0xff4d6d],
  dragon: ['fire', 0xff5a2f],
  fantasma: ['zigzag', 0xdfe6ff],
  dino: ['fire', 0x4cd97b],
  gatito: ['zigzag', 0xff9a3c],
  pinguino: ['fire', 0x9fd8ff],
  pirata: ['rocket', 0x7a4a32],
  hada: ['zigzag', 0xff9ee8],
  astronauta: ['rocket', 0xffffff],
  abeja: ['zigzag', 0xffc93c],
  bombero: ['fire', 0x3fa7ff],
  bloquecito: ['rocket', 0xb07cff],
};
export const SHOT_NAMES = { fire: '¡Tiro de fuego!', zigzag: '¡Tiro relámpago!', rocket: '¡Tiro cohete!' };
const SHOT_WORDS = { fire: '¡FUEGO!', zigzag: '¡ZIGZAG!', rocket: '¡COHETE!' };

// Un jugador: el personaje que escogió (de Bolitas Bros) con un aro del color de su equipo. Corre, salta, patea,
// se barre, regatea y, con la barra llena, hace su tiro especial.
// `input` = { x (-1 a 1), jump, kick, slide, dribble, special, up, down, power?, change? }: de un control o de la compu.
export class FutbolPlayer {
  constructor(scene, { team, color, label, character, deviceId = null }) {
    this.scene = scene;
    this.team = team;
    this.color = color;
    this.label = label;
    this.deviceId = deviceId;
    this.character = character;
    this.isCpu = deviceId === null;
    this.radius = PLAYER_RADIUS;
    this.blob = new Blob(scene, 0, FIELD.ground - PLAYER_RADIUS, color, PLAYER_RADIUS);
    this.blob.ball.setStrokeStyle(6, TEAM_COLORS[team]);
    this.blob.setDepth(100);
    this.shadow = this.blob.list[0];
    this.look = new CharacterLook(scene, this.blob, character, { fx: true, poses: 'all' });
    this.superArt = this.look.body ? null : superArtKey(scene, character);
    if (this.look.hasArt) {
      this.blob.addAt(scene.add.ellipse(0, PLAYER_RADIUS - 2, PLAYER_RADIUS * 2.4, PLAYER_RADIUS * 0.6).setStrokeStyle(6, TEAM_COLORS[team]), 1);
    }
    // Brillo de "tiro especial listo", hielo de congelado.
    this.aura = scene.add.circle(0, -PLAYER_RADIUS * 0.4, PLAYER_RADIUS * 1.7, 0xffd84d, 0.4).setBlendMode(Phaser.BlendModes.ADD).setVisible(false);
    this.blob.figure.addAt(this.aura, 0);
    this.ice = scene.add.rectangle(0, -PLAYER_RADIUS * 0.6, PLAYER_RADIUS * 2.6, PLAYER_RADIUS * 3.4, 0x9fe3ff, 0.45).setStrokeStyle(4, 0xffffff).setVisible(false);
    this.foot = scene.add.ellipse(0, PLAYER_RADIUS * 0.75, 30, 18, COLORS.ink).setVisible(false);
    this.tag = scene.add
      .text(0, this.look.top - 24, label, textStyle(18, hexToCss(color), { fontStyle: 'bold', stroke: '#1b1530', strokeThickness: 5 }))
      .setOrigin(0.5);
    // La barrita del tiro especial (debajo del nombre).
    this.meterBg = scene.add.rectangle(0, this.look.top - 6, METER_W + 4, 9, 0x1b1530);
    this.meterFill = scene.add.rectangle(-METER_W / 2, this.look.top - 6, METER_W, 5, 0xffd84d).setOrigin(0, 0.5);
    this.blob.figure.add([this.foot, this.tag, this.meterBg, this.meterFill]);
    this.blob.add(this.ice);
    this.meter = 0;
    this.stats = { goals: 0, shots: 0, steals: 0, saves: 0 };
    // La cancha: en la nieve se resbalan (`grip` bajo) y en la luna brincan alto (`gravity` bajo).
    this.grip = 1;
    this.gravity = 1;
    this.reset(FIELD.width / 2);
  }

  reset(x) {
    this.x = x;
    this.z = 0;
    this.vx = 0;
    this.vz = 0;
    this.facing = attackDir(this.team);
    this.kickMs = 0;
    this.cooldownMs = 0;
    this.kickDir = this.facing;
    this.slideMs = 0;
    this.slideCooldownMs = 0;
    this.dribbleMs = 0;
    this.dribbleCooldownMs = 0;
    this.tumbleMs = 0;
    this.frozenMs = 0;
    this.shoesMs = 0;
    this.celebrateMs = 0;
    this.specialReady = false;
  }

  // Centro de la bolita en la pantalla (sube cuando salta).
  get y() {
    return FIELD.ground - this.radius - this.z;
  }

  get busy() {
    return this.slideMs > 0 || this.tumbleMs > 0 || this.frozenMs > 0;
  }

  // Hacia dónde patea: siempre a la portería contraria (en los penales, a la que toque).
  get attack() {
    return this.attackOverride ?? attackDir(this.team);
  }

  update(dtMs, input) {
    const dt = dtMs / 1000;
    this.kickMs = Math.max(0, this.kickMs - dtMs);
    this.cooldownMs = Math.max(0, this.cooldownMs - dtMs);
    this.slideMs = Math.max(0, this.slideMs - dtMs);
    this.slideCooldownMs = Math.max(0, this.slideCooldownMs - dtMs);
    this.dribbleMs = Math.max(0, this.dribbleMs - dtMs);
    this.dribbleCooldownMs = Math.max(0, this.dribbleCooldownMs - dtMs);
    this.tumbleMs = Math.max(0, this.tumbleMs - dtMs);
    this.frozenMs = Math.max(0, this.frozenMs - dtMs);
    this.shoesMs = Math.max(0, this.shoesMs - dtMs);
    this.celebrateMs = Math.max(0, this.celebrateMs - dtMs);

    const speed = SPEED * (this.shoesMs > 0 ? SHOES_SPEED : 1) * (this.dribbleMs > 0 ? DRIBBLE.speed : 1);
    if (this.frozenMs > 0 || this.tumbleMs > 0) {
      this.vx *= Math.exp(-6 * dt);
    } else if (this.slideMs > 0) {
      this.vx = this.facing * SLIDE.speed;
    } else {
      const target = input.x * speed;
      const step = ACCEL * this.grip * dt * (this.dribbleMs > 0 ? 2 : 1);
      this.vx = Math.abs(target - this.vx) <= step ? target : this.vx + Math.sign(target - this.vx) * step;
      if (input.x > 0.2) this.facing = 1;
      else if (input.x < -0.2) this.facing = -1;
    }
    this.x += this.vx * dt;
    this.x = Math.max(this.radius, Math.min(FIELD.width - this.radius, this.x));

    // Festejando el gol: brinquitos.
    if (this.celebrateMs > 0 && this.z === 0 && !this.busy) this.vz = CELEBRATE_HOP;
    if (input.jump && this.z === 0 && !this.busy) {
      this.vz = JUMP_SPEED;
      sfx.jump();
    }
    if (input.change) this.look.changeNumber(input.change, this.deviceId);
    if (this.z > 0 || this.vz > 0) {
      this.vz -= GRAVITY * this.gravity * dt;
      this.z = Math.max(0, this.z + this.vz * dt);
      if (this.z === 0) this.vz = 0;
    }

    if (this.busy) return;
    if (input.special && this.meter >= METER_MAX) {
      this.meter = 0;
      this.specialReady = true;
      this.scene.specialReady?.(this);
    }
    if (input.dribble && this.dribbleCooldownMs === 0 && this.z === 0) {
      this.dribbleMs = DRIBBLE.ms;
      this.dribbleCooldownMs = DRIBBLE.cooldownMs;
      this.scene.dust?.(this);
      sfx.jump();
    }
    if (input.slide && this.slideCooldownMs === 0 && this.z === 0) {
      this.slideMs = SLIDE.ms;
      this.slideCooldownMs = SLIDE.cooldownMs;
      this.slideHit = new Set();
      this.scene.dust?.(this);
      sfx.throw();
      return;
    }
    if ((input.kick || (this.specialReady && input.special)) && this.cooldownMs === 0) {
      this.kickMs = KICK_MS;
      this.cooldownMs = KICK_COOLDOWN_MS;
      // Siempre patea hacia la portería contraria: así los peques no meten goles en la suya.
      this.kickDir = this.attack;
      this.kickPower = input.power ?? 1;
      this.facing = this.kickDir;
      this.kickStyle = this.z > 10 ? 'volley' : input.up ? 'lob' : input.down ? 'low' : 'normal';
      this.kickHit = false;
    }
  }

  // Tocar el balón (sin patearlo) también llena un poquito la barra.
  touchedBall(dtMs) {
    this.addMeter(dtMs * METER_PER_TOUCH_MS);
  }

  addMeter(amount) {
    if (this.specialReady) return;
    const before = this.meter;
    this.meter = Math.min(METER_MAX, this.meter + amount);
    if (before < METER_MAX && this.meter >= METER_MAX) this.scene.meterFull?.(this);
  }

  // Mientras dura la patada, si el balón está a su alcance sale disparado. Devuelve el tipo de patada
  // ('special' si era su tiro especial).
  tryKick(ball) {
    if (this.kickMs === 0 || this.kickHit) return null;
    if (Math.hypot(ball.x - this.x, ball.y - this.y) > this.radius + ball.radius + KICK_REACH) return null;
    // Si el balón quedó atrás (del lado de su portería) no lo alcanza: hay que darle la vuelta.
    if ((ball.x - this.x) * this.kickDir < -this.radius * 0.5) return null;
    this.kickHit = true;
    this.stats.shots += 1;
    if (this.specialReady) {
      this.specialReady = false;
      const [kind, color] = SPECIAL_SHOTS[this.character] ?? SPECIAL_SHOTS.tanque;
      ball.shootSpecial(this, this.kickDir, kind, color);
      sfx.boom();
      return 'special';
    }
    const kick = KICKS[this.kickStyle];
    ball.vx = this.kickDir * kick.vx * this.kickPower + this.vx * 0.25;
    ball.vy = kick.vy * this.kickPower;
    ball.lastTouch = this;
    this.addMeter(METER_PER_KICK);
    sfx.hit(this.kickStyle === 'volley' ? 0.9 : 0.6);
    return this.kickStyle;
  }

  specialName() {
    return SHOT_NAMES[(SPECIAL_SHOTS[this.character] ?? SPECIAL_SHOTS.tanque)[0]];
  }

  // La palabra del estallido de cómic del tiro especial.
  specialWord() {
    return SHOT_WORDS[(SPECIAL_SHOTS[this.character] ?? SPECIAL_SHOTS.tanque)[0]];
  }

  // Lo tumbó una barrida (si no va regateando ni saltando).
  tumble() {
    if (this.dribbleMs > 0 || this.z > 20 || this.tumbleMs > 0) return false;
    this.tumbleMs = SLIDE.tumbleMs;
    this.kickMs = 0;
    this.blob.squish();
    return true;
  }

  freeze(ms) {
    this.frozenMs = ms;
    this.kickMs = 0;
    this.slideMs = 0;
  }

  celebrate() {
    this.celebrateMs = CELEBRATE_MS;
    this.look.dance(CELEBRATE_MS);
  }

  // Qué pose mostrar (null = parado o caminando).
  pose() {
    if (this.tumbleMs > 0) return 'dolor';
    if (this.slideMs > 0) return 'agachado';
    if (this.kickMs > 0) return this.z > 10 ? 'aire' : 'patada';
    if (this.z > 0) return this.celebrateMs > 0 ? 'gana' : 'salto';
    if (this.celebrateMs > 0) return 'gana';
    return null;
  }

  // Cómo se ve en este cuadro: lo guarda la repetición del gol para volver a dibujarlo igualito.
  snapshot() {
    return {
      x: this.x,
      z: this.z,
      facing: this.facing,
      pose: this.pose(),
      walking: this.z === 0 && Math.abs(this.vx) > 40 && !this.busy,
      tumble: this.tumbleMs > 0,
      kick: this.kickMs > 0,
      aura: this.specialReady,
      frozen: this.frozenMs > 0,
      dribble: this.dribbleMs > 0,
    };
  }

  render(snap = this.snapshot()) {
    this.blob.setPosition(snap.x, FIELD.ground - this.radius);
    this.blob.figure.y = -snap.z;
    this.blob.figure.angle = snap.tumble ? -snap.facing * 70 : 0;
    this.blob.look(snap.facing * 0.9, 0.1);
    const ground = this.look.groundPose(snap.walking);
    const wanted = snap.pose;
    let pose = wanted ?? ground;
    if (wanted && !this.look.body) pose = (POSE_CHAIN[wanted] ?? [wanted]).find((p) => hasPose(this.scene, this.look.character, p)) ?? 'normal';
    else if (wanted && this.look.body) pose = BLOCK_POSES[wanted] ?? wanted;
    this.look.show(pose, snap.facing);
    if (this.look.image) fitPose(this.look.image, this.radius * 2.8, POSE_HEIGHT[pose] ?? 1);
    // Bloquecito sube y baja de tamaño con su número: el letrero va arriba de su cabeza.
    if (this.look.body) {
      this.tag.setY(this.look.top - 24);
      this.meterBg.setY(this.look.top - 6);
      this.meterFill.setY(this.look.top - 6);
    }
    this.meterFill.scaleX = this.specialReady ? 1 : this.meter / METER_MAX;
    this.meterFill.setFillStyle(this.meter >= METER_MAX || this.specialReady ? 0xff5a5f : 0xffd84d);
    this.foot.setVisible(snap.kick && !this.look.punchArt).setX(snap.facing * this.radius * 0.95);
    // Tiro especial listo: brillo que late. Congelado: un bloque de hielo encima.
    const now = this.scene.time.now;
    this.aura.setVisible(snap.aura).setScale(1 + 0.1 * Math.sin(now / 80));
    this.ice.setVisible(snap.frozen);
    this.blob.setAlpha(snap.dribble ? 0.7 : 1);
    // La sombra se achica cuando va en el aire.
    this.shadow.setScale(Math.max(0.5, 1 - snap.z / 300));
  }

  destroy() {
    this.blob.destroy();
  }
}

const POSE_CHAIN = {
  patada: ['patada', 'golpe'],
  aire: ['aire', 'patada', 'golpe'],
  agachado: ['agachado', 'patada', 'golpe'],
  gana: ['gana', 'salto'],
  salto: ['salto'],
  dolor: ['dolor'],
};
const BLOCK_POSES = { aire: 'patada', agachado: 'patada' };
const POSE_HEIGHT = { gana: 1.08, patada: 0.95, aire: 0.95, agachado: 0.75 };
