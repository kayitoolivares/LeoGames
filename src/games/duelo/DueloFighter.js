import Phaser from 'phaser';
import { sfx } from '../../shared/sound.js';
import { Blob } from '../../ui/Blob.js';
import { CharacterLook } from '../../ui/CharacterLook.js';
import { COLORS, hexToCss, textStyle } from '../../ui/style.js';
import { hasPose, superArtKey } from '../smash/art.js';
import { isBlockCharacter, lerp, numberSize } from '../smash/bloquecito.js';
import { CHARACTERS } from '../smash/characters.js';
import { BOSS, BOSS_STATS, addCrown } from './boss.js';
import { ATTACKS, BLOCK_SPECIALS, SPECIALS, SPECIAL_COOLDOWN_MS } from './moves.js';

// El piso y las paredes del escenario (la pantalla completa, sin cámara).
export const FLOOR = 650;
export const WALLS = { left: 40, right: 1240 };
export const MAX_HEALTH = 100;
export const METER_MAX = 100;
export const SUPER_MS = 9000;

const SIZE = 2.15; // radio en el duelo = radio del personaje en Bolitas Bros × SIZE
const LOOK_HEIGHT = 2.9; // alto de la imagen, en radios
// Cada imagen se ajusta a la misma altura; las que en el dibujo son más bajitas (agachado cubriéndose)
// o más altas (celebrando con el brazo arriba) se corrigen aquí.
const POSE_HEIGHT = { cubrirse: 0.85, gana: 1.08, patada: 0.95, agachado: 0.72, aire: 0.95 };
const GRAVITY = 2300;
const FRICTION = 2400; // cómo se frenan los empujones en el piso
const WALK = 0.55; // velocidad al caminar = `run` del personaje × WALK
const BACK = 0.75; // hacia atrás camina más lento
const AIR_CONTROL = 900;
const JUMP = 1.08;
const COMBO_WINDOW_MS = 650;
const DOWN_MS = 650;
const GETUP_INVULNERABLE_MS = 600;
const LAUNCH_SPEED = 640;
const BLOCK_STUN_MS = 160;
const SPECIAL_RECOVERY_MS = 160;
const SUPER = { power: 1.35, speed: 1.15, scale: 1.15 };
const SUPER_TINT = 0x806000;
// Bloquecito: aunque el 1 sea chiquito, su cuerpo cuenta al menos este alto (en radios) para que le lleguen
// los golpes; y si es muy alto, sus golpes y disparos bajan hasta esta altura (px) para pegarle a los bajitos.
const BLOCK_MIN_HEIGHT = 1.6;
const BLOCK_LOW_REACH = 180;
// Agachado ocupa menos de alto (los golpes altos le pasan por arriba).
const CROUCH_HEIGHT = 0.62;
// Doble toque al stick: hacia adelante un arrancón; hacia atrás una rodada en la que no le pegan.
const DASH = { forward: { ms: 220, speed: 2.8 }, back: { ms: 300, speed: 2.2, invulnerableMs: 260 } };
// Qué tan cerca (en radios, entre las orillas) tiene que estar el rival para agarrarlo.
const GRAB_GAP = 0.7;

// Qué imagen usa cada cosa, en orden de preferencia: las poses de pelea son opcionales
// (si no hay, usa la más parecida de las 4 de siempre).
const POSE_CHAIN = {
  normal: ['normal'],
  golpe: ['golpe'],
  patada: ['patada', 'golpe'],
  especial: ['especial', 'golpe'],
  cubrirse: ['cubrirse', 'normal'],
  salto: ['salto'],
  dolor: ['dolor'],
  gana: ['gana', 'salto'],
  aire: ['aire', 'patada', 'golpe'],
  agachado: ['agachado', 'cubrirse', 'normal'],
  agarre: ['agarre', 'golpe'],
  entrada: ['entrada', 'gana', 'normal'],
};
// Bloquecito se dibuja con bloques: las poses nuevas usan las suyas más parecidas.
const BLOCK_POSES = { aire: 'patada', agachado: 'patada', agarre: 'golpe', entrada: 'gana' };

// Qué pose usa cada golpe (las que no están aquí usan 'golpe').
const ATTACK_POSES = { kick: 'patada', airKick: 'aire', sweep: 'agachado', grab: 'agarre' };

// Un peleador del duelo: el personaje que escogió, de lado, con barra de vida y de poder.
// `input` = { x (-1 a 1), up, down, dash (-1, 0, 1), punch, kick, special, block, transform }: de un control o de la
// compu (cpu.js).
// La posición (x, y) es la de sus pies.
export class DueloFighter {
  constructor(scene, { color, label, character, deviceId = null }) {
    this.scene = scene;
    this.color = color;
    this.label = label;
    this.deviceId = deviceId;
    this.isCpu = deviceId === null;
    this.character = character;
    // El jefe del torneo no es de Bolitas Bros: trae sus propios datos (ver boss.js).
    this.boss = character === BOSS;
    const stats = this.boss ? BOSS_STATS : CHARACTERS[character];
    this.name = stats.name;
    this.superName = stats.superName;
    this.specialData = this.boss ? stats.special : SPECIALS[character];
    this.maxHealth = stats.health ?? MAX_HEALTH;
    // Bloquecito cambia de tamaño, fuerza y especial según su número (ver applyForm).
    this.blocks = isBlockCharacter(character);
    this.radius = Math.round(stats.radius * SIZE);
    // El radio con el que se acomoda el dibujo (fijo); el de Bloquecito para pelear (`radius`) cambia con su número.
    this.drawRadius = this.radius;
    this.basePower = stats.power;
    this.walkSpeed = stats.run * WALK;
    this.jumpSpeed = stats.jump * JUMP;
    this.gravity = GRAVITY * (stats.gravity ?? 1);

    const r = this.radius;
    this.blob = new Blob(scene, 0, FLOOR - r, color, r).setDepth(100);
    this.look = new CharacterLook(scene, this.blob, character, { height: LOOK_HEIGHT });
    if (this.boss && !this.look.hasArt) addCrown(scene, this.blob);
    this.superArt = superArtKey(scene, character);
    // Estatura (para las cajas de golpe): la imagen trae un borde blanco alrededor.
    this.height = this.look.hasArt ? r * LOOK_HEIGHT * 0.9 : r * 2.2;
    const figure = this.blob.figure;
    this.aura = scene.add.ellipse(0, r - this.height / 2, r * 2.6, this.height * 1.15, 0xffd84d, 0.5).setBlendMode(Phaser.BlendModes.ADD).setVisible(false);
    figure.addAt(this.aura, 0);
    this.ring = scene.add.ellipse(0, r - 2, r * 2.2, r * 0.55).setStrokeStyle(6, color);
    this.blob.addAt(this.ring, 1);
    this.shield = scene.add.ellipse(0, r - this.height / 2, r * 2.4, this.height * 1.1, 0x7fdcff, 0.25).setStrokeStyle(5, 0x7fdcff).setVisible(false);
    // Puño dibujado, para los que no tienen imagen de golpe.
    this.fist = scene.add.circle(0, 0, r * 0.32, color).setStrokeStyle(4, COLORS.ink).setVisible(false);
    this.tag = scene.add
      .text(0, this.look.top - 16, label, textStyle(20, hexToCss(color), { fontStyle: 'bold', stroke: '#1b1530', strokeThickness: 5 }))
      .setOrigin(0.5);
    figure.add([this.shield, this.fist, this.tag]);

    this.meter = 0;
    this.superMs = 0;
    this.reset(WALLS.left + 300, 1);
    if (this.blocks) this.applyForm();
  }

  // Bloquecito cambió de número (o se volvió Octobloque): su tamaño, fuerza, velocidad y especial son los de
  // ese número. El 1 es chiquito y rápido; el 10, grandote y fuerte.
  applyForm() {
    const body = this.look.body;
    const k = numberSize(this.look.form);
    const r = this.drawRadius;
    // La caja de su cuerpo (hurtbox) mide de ancho lo que sus bloques.
    this.radius = Math.max(30, body.width / 2 / 0.7);
    this.height = Math.max(body.height, r * BLOCK_MIN_HEIGHT);
    this.basePower = lerp(0.75, 1.35, k);
    this.walkSpeed = lerp(480, 290, k) * WALK;
    this.jumpSpeed = lerp(870, 720, k) * JUMP;
    this.specialData = BLOCK_SPECIALS[this.look.form];
    const middle = r - this.height / 2;
    this.aura.setPosition(0, middle).setSize(body.width * 1.6 + 40, this.height * 1.15);
    this.shield.setPosition(0, middle).setSize(body.width * 1.5 + 40, this.height * 1.1);
    this.ring.setSize(Math.max(r * 1.2, body.width * 1.5), Math.max(r * 0.35, body.width * 0.4));
  }

  // Y (o ↓ + Y): Bloquecito sube o baja un número. Los jugadores además lo oyen en voz alta.
  changeNumber(step) {
    if (this.look.changeNumber(step, this.isCpu ? null : this.deviceId) !== null) this.applyForm();
  }

  reset(x, facing) {
    this.x = x;
    this.y = FLOOR;
    this.vx = 0;
    this.vy = 0;
    this.pushVx = 0;
    this.facing = facing;
    this.health = this.maxHealth;
    this.attack = null;
    this.special = null;
    this.buffered = null;
    this.landed = new Set();
    this.punchChain = 0;
    this.sinceAttackMs = Infinity;
    this.hurtMs = 0;
    this.blockStunMs = 0;
    this.downMs = 0;
    this.invulnerableMs = 0;
    this.cooldownMs = 0;
    this.launched = false;
    this.koed = false;
    this.blocking = false;
    this.airAttackUsed = false;
    this.crouching = false;
    this.dash = null;
    this.posing = false;
    this.cinematic = null;
    this.celebrating = false;
    this.defeated = false;
    this.flashMs = 0;
    this.walkPhase = 0;
    this.blob.figure.setAngle(0).setAlpha(1);
  }

  get grounded() {
    return this.y >= FLOOR && this.vy >= 0;
  }

  get power() {
    return this.basePower * (this.superMs > 0 ? SUPER.power : 1);
  }

  get speed() {
    return this.superMs > 0 ? SUPER.speed : 1;
  }

  get scale() {
    return this.superMs > 0 ? SUPER.scale : 1;
  }

  // Hasta qué altura bajan sus golpes y salen sus disparos: su estatura, menos la de Bloquecito muy alto.
  get reachHeight() {
    return this.blocks ? Math.min(this.height, BLOCK_LOW_REACH) : this.height;
  }

  // Lo que ocupa su cuerpo (donde le pueden pegar).
  get hurtbox() {
    const half = this.radius * 0.7 * this.scale;
    const low = this.crouching || this.attack?.type === 'sweep' || this.dash?.back;
    return { left: this.x - half, right: this.x + half, top: this.y - this.height * this.scale * (low ? CROUCH_HEIGHT : 1), bottom: this.y };
  }

  // Si puede hacer algo nuevo (no está pegando, ni lastimado, ni en el piso).
  canAct() {
    return !this.attack && !this.special && !this.dash && this.hurtMs <= 0 && !this.launched && this.downMs <= 0 && !this.koed && !this.celebrating;
  }

  isInvulnerable() {
    return this.invulnerableMs > 0 || this.downMs > 0 || this.launched || this.koed || this.ghosting;
  }

  // El fantasma se vuelve invisible y atraviesa al rival mientras se lanza.
  get ghosting() {
    const s = this.special;
    return Boolean(s?.through && s.t >= s.startup && s.t < s.startup + s.ms);
  }

  // Al terminar el round: el que ganó celebra y el que perdió se queda triste (no se mueven más).
  celebrate(won = true) {
    this.celebrating = true;
    this.defeated = !won;
    this.attack = null;
    this.special = null;
    this.blocking = false;
    this.vx = 0;
  }

  // Se acaba la súper forma (al terminarse el tiempo o al usar el golpe final).
  endSuper() {
    this.superMs = 0;
    if (this.blocks) {
      this.look.setSuper(false);
      this.applyForm();
    } else {
      this.look.character = this.character;
    }
    sfx.powerDown();
  }

  // Barra de poder llena: se transforma un rato (más fuerte, rápido y grande; con su arte de súper si lo hay).
  transform() {
    if (this.meter < METER_MAX || this.superMs > 0 || this.koed) return false;
    this.meter = 0;
    this.superMs = SUPER_MS;
    this.finalUsed = false;
    this.scene.practiced?.(this, 'super');
    if (this.blocks) {
      this.look.setSuper(true);
      this.applyForm();
    } else if (this.superArt) {
      this.look.character = this.superArt;
    }
    sfx.transform();
    return true;
  }

  // Lo llama la escena cuando le pega a alguien: la barra se llena pegando (y recibiendo).
  dealtDamage(amount) {
    if (this.superMs <= 0) this.meter = Math.min(METER_MAX, this.meter + amount * 1.5);
  }

  update(dtMs, input, opponent) {
    const dt = dtMs / 1000;
    this.tick(dtMs);
    if (input.change && this.blocks && !this.koed && !this.celebrating) this.changeNumber(input.change);
    if (this.koed || this.celebrating) {
      this.move(dt);
      return;
    }
    if (this.downMs > 0) {
      this.downMs -= dtMs;
      if (this.downMs <= 0) this.invulnerableMs = GETUP_INVULNERABLE_MS;
      this.move(dt);
      return;
    }
    // Siempre ve hacia el rival mientras está libre en el piso (como en Street Fighter).
    if (this.grounded && this.canAct()) this.facing = Math.sign(opponent.x - this.x) || this.facing;
    if (this.canAct()) this.act(input, dt, opponent);
    else if (this.attack && (input.punch || input.kick)) this.buffered = input.punch ? 'punch' : 'kick';
    this.updateDash(dtMs);
    this.updateAttack(dtMs);
    this.updateSpecial(dtMs, opponent);
    this.move(dt);
  }

  tick(dtMs) {
    this.hurtMs = Math.max(0, this.hurtMs - dtMs);
    this.blockStunMs = Math.max(0, this.blockStunMs - dtMs);
    this.invulnerableMs = Math.max(0, this.invulnerableMs - dtMs);
    this.flashMs = Math.max(0, this.flashMs - dtMs);
    this.cooldownMs = Math.max(0, this.cooldownMs - dtMs * (this.superMs > 0 ? 2 : 1));
    this.sinceAttackMs += dtMs;
    if (this.superMs > 0) {
      this.superMs = Math.max(0, this.superMs - dtMs);
      if (this.superMs === 0) this.endSuper();
    }
  }

  act(input, dt, opponent) {
    this.blocking = false;
    this.crouching = false;
    if (input.transform && this.transform()) {
      this.scene.celebrateSuper?.(this);
      return;
    }
    // En súper forma, el primer X es el golpe final (una vez por transformación).
    if (input.special && this.superMs > 0 && !this.finalUsed && this.scene.startFinal?.(this)) {
      this.finalUsed = true;
      return;
    }
    if (!this.grounded) {
      if (input.punch && !this.airAttackUsed) this.startAttack('airPunch');
      else if (input.kick && !this.airAttackUsed) this.startAttack('airKick');
      else if (input.special && this.cooldownMs === 0) this.startSpecial();
      const max = this.walkSpeed * 1.2 * this.speed;
      this.vx = Phaser.Math.Clamp(this.vx + input.x * AIR_CONTROL * dt, -max, max);
      return;
    }
    if (input.block || this.blockStunMs > 0) {
      this.blocking = true;
      this.crouching = Boolean(input.down);
      this.vx = 0;
      return;
    }
    if (input.dash) {
      this.startDash(input.dash);
      return;
    }
    if (input.up) {
      this.vy = -this.jumpSpeed;
      this.vx = Math.abs(input.x) > 0.3 ? Math.sign(input.x) * this.walkSpeed * 1.1 * this.speed : 0;
      sfx.jump();
    } else if (input.down) {
      // Agachado: ↓ + A = gancho hacia arriba, ↓ + B = barrida.
      this.crouching = true;
      this.vx = 0;
      if (input.punch) this.startAttack('uppercut');
      else if (input.kick) this.startAttack('sweep');
      else if (input.special && this.cooldownMs === 0) this.startSpecial();
    } else if (input.kick && Math.sign(input.x) === this.facing && Math.abs(input.x) > 0.4 && this.canGrab(opponent)) {
      // Adelante + B pegadito al rival: lo agarra y lo avienta (aunque se esté cubriendo).
      this.startAttack('grab');
    } else if (input.punch) {
      this.startAttack('punch');
    } else if (input.kick) {
      this.startAttack('kick');
    } else if (input.special && this.cooldownMs === 0) {
      this.startSpecial();
    } else {
      const backwards = Math.sign(input.x) === -this.facing;
      this.vx = Math.abs(input.x) > 0.25 ? input.x * this.walkSpeed * (backwards ? BACK : 1) * this.speed : 0;
    }
  }

  canGrab(opponent) {
    if (!opponent.grounded || opponent.isInvulnerable()) return false;
    return Math.abs(opponent.x - this.x) - (this.radius + opponent.radius) * 0.7 < this.radius * GRAB_GAP;
  }

  // Doble toque: `dir` es hacia dónde (en la pantalla). Adelante = arrancón; atrás = rodada sin que le peguen.
  startDash(dir) {
    const back = dir !== this.facing;
    const { ms, speed, invulnerableMs = 0 } = back ? DASH.back : DASH.forward;
    this.dash = { ms, total: ms, back, vx: dir * this.walkSpeed * speed * this.speed };
    this.invulnerableMs = Math.max(this.invulnerableMs, invulnerableMs);
    this.scene.dust?.(this.x, this.y, -dir);
    this.scene.practiced?.(this, back ? 'roll' : 'dash');
    sfx.throw();
  }

  updateDash(dtMs) {
    if (!this.dash) return;
    this.dash.ms -= dtMs;
    this.vx = this.dash.vx;
    if (this.dash.ms <= 0) {
      this.dash = null;
      this.vx = 0;
    }
  }

  // Golpe (A) o patada (B). Tres golpes seguidos = remate.
  startAttack(type) {
    if (type === 'punch') {
      this.punchChain = this.sinceAttackMs < COMBO_WINDOW_MS ? this.punchChain + 1 : 1;
      if (this.punchChain >= 3) {
        type = 'finisher';
        this.punchChain = 0;
      }
    } else {
      this.punchChain = 0;
    }
    if (type.startsWith('air')) this.airAttackUsed = true;
    else this.vx = 0;
    this.attack = { type, data: ATTACKS[type], ms: 0 };
    this.landed = new Set();
    this.buffered = null;
    this.scene.practiced?.(this, type);
    sfx.throw();
  }

  updateAttack(dtMs) {
    if (!this.attack) return;
    this.attack.ms += dtMs;
    const a = this.attack.data;
    if (this.attack.ms < a.startup + a.active + a.recovery) return;
    this.attack = null;
    this.sinceAttackMs = 0;
    // Si apretó durante el golpe, el siguiente sale de una vez (así los combos son fáciles).
    const next = this.buffered;
    this.buffered = null;
    if (next && this.grounded && this.hurtMs <= 0) this.startAttack(next);
  }

  // El especial (X). En `special`, `t` es cuánto lleva y `ms` lo que dura la parte que pega.
  startSpecial() {
    this.special = { ...this.specialData, t: 0, fired: false };
    this.landed = new Set();
    this.cooldownMs = SPECIAL_COOLDOWN_MS;
    this.scene.practiced?.(this, 'special');
    this.punchChain = 0;
    if (this.grounded) this.vx = 0;
    sfx.special();
  }

  updateSpecial(dtMs, opponent) {
    const s = this.special;
    if (!s) return;
    s.t += dtMs;
    const since = s.t - s.startup;
    if (since < 0) return;
    let done = false;
    if (s.kind === 'shot') {
      if (!s.fired) {
        s.fired = true;
        this.scene.spawnShot(this, s);
      }
      done = since > SPECIAL_RECOVERY_MS + 100;
    } else if (s.kind === 'rush') {
      this.vx = since < s.ms ? this.facing * s.speed * this.speed : 0;
      done = since > s.ms + SPECIAL_RECOVERY_MS;
    } else if (s.kind === 'rise') {
      if (!s.fired) {
        s.fired = true;
        this.vy = -s.lift;
        this.y -= 1;
        this.vx = this.facing * s.speed * this.speed;
      }
      // Termina al caer al piso (ver land()).
    } else if (s.kind === 'spin') {
      done = since > s.ms + SPECIAL_RECOVERY_MS;
    } else if (s.kind === 'flurry') {
      done = since > s.hits * s.gapMs + SPECIAL_RECOVERY_MS;
    } else if (s.kind === 'teleport') {
      if (!s.fired) {
        s.fired = true;
        this.scene.poof?.(this.x, this.y - this.height / 2);
        const side = Math.sign(this.x - opponent.x) || 1;
        // Aparece del otro lado del rival (si no hay espacio contra la pared, del mismo lado pero pegadito).
        let x = opponent.x - side * (opponent.radius + this.radius) * 1.05;
        if (x < WALLS.left + this.radius || x > WALLS.right - this.radius) x = opponent.x + side * (opponent.radius + this.radius) * 1.05;
        this.x = x;
        this.y = FLOOR;
        this.vy = 0;
        this.facing = Math.sign(opponent.x - this.x) || this.facing;
        this.scene.poof?.(this.x, this.y - this.height / 2);
      }
      done = since > 340;
    }
    if (done) this.special = null;
  }

  // La caja del golpe que está haciendo ahora (o null). `key` distingue cada golpe para no contarlo dos veces.
  hitbox() {
    const r = this.radius * this.scale;
    const h = this.height * this.scale;
    const low = this.reachHeight * this.scale;
    const front = (reach, hi, lo) => {
      const near = this.x + this.facing * r * 0.4;
      const far = this.x + this.facing * (r * 0.7 + reach * r);
      return { left: Math.min(near, far), right: Math.max(near, far), top: this.y - h * hi, bottom: this.y - low * lo };
    };
    if (this.attack) {
      const a = this.attack.data;
      const t = this.attack.ms;
      if (t < a.startup || t >= a.startup + a.active) return null;
      return { ...front(a.reach, a.hi, a.lo), data: { ...a, power: this.power }, key: 'attack' };
    }
    const s = this.special;
    if (!s) return null;
    const since = s.t - s.startup;
    if (since < 0) return null;
    const data = { damage: s.damage, push: s.push, stunMs: 380, launch: s.launch, special: true, power: this.power };
    if (s.kind === 'rush' && since < s.ms) return { ...front(0.6, s.low ? 0.4 : 0.85, 0), data, key: 'rush' };
    if (s.kind === 'rise' && this.vy < 300) return { ...front(0.5, 1.05, 0.2), data, key: 'rise' };
    // El salto aplastante del jefe: al caer pega a los dos lados.
    if (s.kind === 'rise' && s.stomp) return { left: this.x - r * 1.3, right: this.x + r * 1.3, top: this.y - h * 0.5, bottom: this.y + 20, data, key: 'stomp' };
    if (s.kind === 'spin' && since < s.ms) {
      return { left: this.x - r * 1.9, right: this.x + r * 1.9, top: this.y - h * 0.65, bottom: this.y, data, key: 'spin' };
    }
    if (s.kind === 'flurry') {
      const k = Math.floor(since / s.gapMs);
      if (k < s.hits && since - k * s.gapMs < 80) return { ...front(0.9, 0.85, 0.3), data: { ...data, stunMs: 220 }, key: `flurry-${k}` };
    }
    if (s.kind === 'teleport' && since > 60 && since < 220) return { ...front(1, 0.9, 0.2), data, key: 'teleport' };
    return null;
  }

  // Recibe un golpe desde `fromX`. Devuelve { blocked, dealt } o null si no le hizo nada.
  takeHit(data, fromX) {
    if (this.isInvulnerable() || this.celebrating) return null;
    const fromFront = Math.sign(fromX - this.x) === this.facing || fromX === this.x;
    const dir = Math.sign(this.x - fromX) || -this.facing;
    // Un agarre solo funciona en el piso, pero ni cubriéndose se salva.
    if (data.grab && !this.grounded) return null;
    if (this.blocking && this.grounded && fromFront && !data.grab && !data.unblockable) {
      const chip = data.special ? Math.ceil(data.damage * data.power * 0.25) : 0;
      this.health = Math.max(1, this.health - chip);
      this.pushVx = dir * data.push * 0.6;
      this.blockStunMs = BLOCK_STUN_MS;
      return { blocked: true, dealt: chip };
    }
    const dealt = Math.max(1, Math.round(data.damage * data.power));
    // En Entrenamiento nadie queda K.O. (`unbreakable`).
    this.health = Math.max(this.unbreakable ? 1 : 0, this.health - dealt);
    if (this.superMs <= 0) this.meter = Math.min(METER_MAX, this.meter + dealt);
    this.attack = null;
    this.special = null;
    this.buffered = null;
    this.blocking = false;
    this.crouching = false;
    this.dash = null;
    this.punchChain = 0;
    this.vx = 0;
    if (this.health === 0) {
      this.koed = true;
      this.launched = true;
      this.vy = -LAUNCH_SPEED * 1.1;
      this.pushVx = dir * 520;
    } else if (data.launch || !this.grounded) {
      this.launched = true;
      this.vy = -LAUNCH_SPEED * (this.grounded ? 1 : 0.6) * (data.lift ?? 1);
      this.pushVx = dir * data.push * 0.9;
    } else {
      this.hurtMs = data.stunMs;
      this.pushVx = dir * data.push;
    }
    if (this.launched) this.y = Math.min(this.y, FLOOR - 1);
    if (this.look.hasArt) this.flashMs = 70;
    else this.blob.flash();
    this.blob.squish();
    return { blocked: false, dealt };
  }

  move(dt) {
    if (!this.grounded || this.vy < 0) {
      this.vy += this.gravity * dt;
      this.y += this.vy * dt;
      if (this.y >= FLOOR) this.land();
    }
    this.x += (this.vx + this.pushVx) * dt;
    if (this.grounded) {
      const step = FRICTION * dt;
      this.pushVx = Math.abs(this.pushVx) <= step ? 0 : this.pushVx - Math.sign(this.pushVx) * step;
    }
    // Acostado ocupa más de lado: se queda más lejos de la pared para que no se salga de la pantalla.
    const lying = this.koed || this.launched || this.downMs > 0;
    const margin = this.radius * (lying ? 1.5 : 0.6);
    this.x = Phaser.Math.Clamp(this.x, WALLS.left + margin, WALLS.right - margin);
  }

  land() {
    this.y = FLOOR;
    this.vy = 0;
    this.airAttackUsed = false;
    if (this.attack?.type.startsWith('air')) this.attack = null;
    if (this.special?.stomp) this.scene.landed?.(this, true);
    if (this.special?.kind === 'rise') this.special = null;
    if (!this.attack && !this.special) this.vx = 0;
    if (this.launched) {
      this.launched = false;
      this.pushVx *= 0.4;
      if (!this.koed) this.downMs = DOWN_MS;
      this.blob.squish();
      sfx.hit(0.3);
      this.scene.landed?.(this);
    }
  }

  // Qué pose mostrar según lo que está haciendo.
  pose() {
    if (this.celebrating && !this.defeated && !this.koed) return 'gana';
    if (this.defeated || this.koed || this.launched || this.downMs > 0 || this.hurtMs > 0) return 'dolor';
    if (this.cinematic) return this.cinematic;
    if (this.posing) return 'entrada';
    if (this.blocking) return this.crouching ? 'agachado' : 'cubrirse';
    if (this.attack) return ATTACK_POSES[this.attack.type] ?? 'golpe';
    if (this.special) return this.special.kind === 'teleport' && !this.special.fired ? 'normal' : 'especial';
    if (this.dash) return this.dash.back ? 'salto' : 'caminar';
    if (!this.grounded) return 'salto';
    if (this.crouching) return 'agachado';
    return Math.abs(this.vx) > 20 ? 'caminar' : 'normal';
  }

  render(dtMs) {
    const r = this.drawRadius;
    const s = this.scale;
    const figure = this.blob.figure;
    const pose = this.pose();
    const art = this.look.character;
    const ground = this.look.groundPose(pose === 'caminar');
    let shown = pose === 'caminar' ? ground : (POSE_CHAIN[pose].find((p) => hasPose(this.scene, art, p)) ?? 'normal');
    // Bloquecito tiene todas las poses (se dibuja con bloques), y su especial se ve distinto en cada número.
    if (this.blocks && pose !== 'caminar') shown = BLOCK_POSES[pose] ?? pose;
    const walkFrames = shown.startsWith('caminar');
    this.look.show(shown, this.facing, this.special?.action ?? null);
    if (this.blocks) this.tag.setY(this.look.top - 16);
    const image = this.look.image;
    if (image) image.setScale((r * LOOK_HEIGHT * (POSE_HEIGHT[shown] ?? 1)) / image.height);
    this.blob.setPosition(this.x, FLOOR - r);
    this.blob.look(this.facing * 0.9, pose === 'dolor' ? -0.6 : 0);

    // Caminando se bambolea (si no tiene cuadros de caminata); parado "respira". Así se ve vivo.
    let bob = 0;
    let angle = 0;
    let sx = 1;
    let sy = 1;
    const now = this.scene.time.now;
    if (pose === 'caminar' && !walkFrames) {
      this.walkPhase += (dtMs / 1000) * 13;
      bob = -Math.abs(Math.sin(this.walkPhase)) * r * 0.14;
      angle = Math.sin(this.walkPhase) * 4;
    } else if (pose === 'normal' || pose === 'cubrirse') {
      sy = 1 + 0.025 * Math.sin(now / 260);
      sx = 1 - 0.015 * Math.sin(now / 260);
    } else if (pose === 'gana') {
      bob = -Math.abs(Math.sin(now / 160)) * r * 0.5;
    }
    // El gancho se echa para atrás, el arrancón se inclina hacia adelante y la rodada da la vuelta completa.
    if (this.attack?.type === 'uppercut') angle = -this.facing * 12;
    else if (this.dash && !this.dash.back) angle = this.facing * 12;
    else if (this.dash?.back) angle = -this.facing * 360 * (1 - this.dash.ms / this.dash.total);
    // Bloquecito agachado (no tiene esa pose): se aplasta.
    if (this.blocks && (this.crouching || this.attack?.type === 'sweep')) sy *= 0.72;
    // Volando por un golpe se inclina; tirado en el piso, acostado.
    else if (this.downMs > 0 || (this.koed && this.grounded)) angle = -this.facing * 80;
    const lying = this.downMs > 0 || (this.koed && this.grounded);
    if (!figure.scene.tweens.isTweening(figure)) figure.setScale(s * sx, s * sy);
    figure.setAngle(angle);
    figure.y = this.y - FLOOR - r * (s - 1) + bob + (lying ? r * 0.55 : 0);
    const blink = this.invulnerableMs > 0 && Math.floor(now / 90) % 2 === 0;
    figure.setAlpha(this.ghosting ? 0.25 : blink ? 0.45 : 1);
    this.blob.list[0].setScale(Math.max(0.4, 1 - (FLOOR - this.y) / 400));

    this.shield.setVisible(this.blocking);
    const box = this.attack || (this.special && this.special.kind !== 'shot') ? this.hitbox() : null;
    const showFist = Boolean(box) && shown !== 'golpe' && shown !== 'patada' && shown !== 'especial';
    this.fist.setVisible(showFist);
    if (showFist) this.fist.setPosition(this.facing * r * 1.35, (box.top + box.bottom) / 2 - this.y + r);

    this.aura.setVisible(this.superMs > 0);
    if (this.superMs > 0) {
      const ending = this.superMs < 2000 && Math.floor(now / 120) % 2 === 0;
      this.aura.setScale(1 + 0.08 * Math.sin(now / 90)).setAlpha(ending ? 0.15 : 0.6);
    }
    // Destello blanco al recibir un golpe; dorado en súper modo si no tiene arte de súper.
    if (image) {
      if (this.flashMs > 0) image.setTintMode(Phaser.TintModes.FILL).setTint(0xffffff);
      else if (this.superMs > 0 && !this.superArt) image.setTintMode(Phaser.TintModes.SCREEN).setTint(SUPER_TINT);
      else image.setTintMode(Phaser.TintModes.MULTIPLY).clearTint();
    }
  }

  destroy() {
    this.blob.destroy();
  }
}
