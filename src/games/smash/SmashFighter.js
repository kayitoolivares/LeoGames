import Phaser from 'phaser';
import { sfx } from '../../shared/sound.js';
import { Blob } from '../../ui/Blob.js';
import { COLORS, hexToCss, textStyle } from '../../ui/style.js';
import { characterTexture, hasPose, superArtKey } from './art.js';
import { CHARACTERS, addAccessory } from './characters.js';
import { drawItem } from './items.js';

export const STOCKS = 3;
const GRAVITY = 1800;
const MAX_FALL = 950;
const AIR_ACCEL = 1500;
const GROUND_FRICTION = 2600;
const DROP_MS = 250;
// Al salir volando, el empujón se frena poco a poco (más grande = vuela menos lejos).
const LAUNCH_DRAG = 1.5;
const HITSTUN_PER_SPEED = 0.4;
const RESPAWN_MS = 1500;
const RESPAWN_INVULNERABLE_MS = 2000;
const RESCUE_SPEED = 880;
const SPRING_SPEED = 1050;
const DASH_SPEED = 900;
const DASH_MS = 260;
const CHARGE_LUNGE = 320;
const SCRATCH_LUNGE = 260;
const SLIDE_SPEED = 720;
const SLIDE_MS = 420;
const CANNON_THROW = { vx: 640, vy: -260 };
// Cada cuánto se puede repetir el especial (los que no están aquí no esperan).
const SPECIAL_COOLDOWN_MS = {
  estrella: 700,
  robot: 900,
  ninja: 1400,
  dragon: 600,
  fantasma: 4000,
  dino: 700,
  gatito: 500,
  pinguino: 900,
  pirata: 1100,
};
const GHOST_MS = 1500;
export const SHIELD_MAX = 100;
const SHIELD_DRAIN = 22;
const SHIELD_REGEN = 14;
const SHIELD_HIT_FACTOR = 3;
const SHIELD_PUSHBACK = 140;
const SHIELD_BREAK_STUN_MS = 1600;
const HAMMER_MS = 8000;
const STAR_POWER_MS = 6000;
const STAR_SPEED_BONUS = 1.2;
const HEART_HEAL = 40;
const BOMB_THROW = { vx: 650, vy: -380 };
// Modo peque: recibe menos daño, sale volando menos y llena su barra más rápido.
const PEQUE_DAMAGE = 0.7;
const PEQUE_KNOCKBACK = 0.6;
const PEQUE_METER_BONUS = 1.5;
const RAINBOW = [0xff5a5f, 0xff9a3c, 0xffc93c, 0x4cd97b, 0x3fa7ff, 0xb07cff];

// Barra de poder: se llena pegando y recibiendo golpes (por cada % de daño). Llena + LB + RB = súper modo:
// crece, pega más fuerte, corre más, casi no sale volando y su especial se recarga más rápido.
export const METER_MAX = 100;
const METER_PER_DAMAGE_DEALT = 1.4;
const METER_PER_DAMAGE_TAKEN = 1;
export const SUPER_MS = 10000;
const TRANSFORM_MS = 700;
const SUPER = { size: 1.25, power: 1.4, weight: 1.6, speed: 1.25, jump: 1.08, cooldown: 0.5 };
const SUPER_TINT = 0x806000;

// Golpes. Tiempos en ms; el empujón crece con el % del que recibe.
// angle: hacia dónde sale volando (grados; 0 = hacia adelante, 90 = arriba, negativo = abajo).
// multi: vuelve a pegar cada tantos ms mientras está activo (el fuego de Dragoncito).
// around: pega alrededor y avienta hacia afuera, para los dos lados (el coletazo de Dino).
export const ATTACKS = {
  // X, según la dirección del stick.
  jab: { startup: 60, active: 100, recovery: 160, damage: 7, base: 260, scale: 9, angle: 35, hx: 52, hy: 0, radius: 30 },
  up: { startup: 70, active: 110, recovery: 200, damage: 8, base: 300, scale: 9, angle: 85, hx: 14, hy: -50, radius: 32 },
  sweep: { startup: 80, active: 120, recovery: 220, damage: 6, base: 240, scale: 8, angle: 20, hx: 46, hy: 22, radius: 34 },
  stomp: { startup: 90, active: 120, recovery: 220, damage: 9, base: 200, scale: 7, angle: -70, hx: 8, hy: 46, radius: 32 },
  // X con el martillo en la mano.
  hammer: { startup: 120, active: 140, recovery: 260, damage: 14, base: 400, scale: 11, angle: 40, hx: 58, hy: -6, radius: 48 },
  // X con la bomba en la mano: la lanza (la crea la escena).
  throw: { startup: 70, active: 0, recovery: 160 },
  // B: especial de cada personaje.
  charge: { startup: 280, active: 120, recovery: 300, damage: 15, base: 420, scale: 11, angle: 30, hx: 62, hy: 0, radius: 40 },
  dash: { startup: 30, active: 230, recovery: 220, damage: 8, base: 320, scale: 8, angle: 25, hx: 22, hy: 0, radius: 40 },
  spring: { startup: 40, active: 260, recovery: 260, damage: 9, base: 340, scale: 9, angle: 80, hx: 0, hy: -40, radius: 40 },
  // Lanza una estrella (la crea la escena); no golpea con el cuerpo.
  cast: { startup: 90, active: 0, recovery: 200 },
  // Ninja: la escena lo pasa detrás del rival más cercano y luego pega.
  ambush: { startup: 170, active: 110, recovery: 220, damage: 9, base: 330, scale: 9, angle: 40, hx: 48, hy: 0, radius: 34 },
  // Robot: dispara un láser (lo crea la escena).
  laser: { startup: 160, active: 0, recovery: 240 },
  // Dragoncito: fuego enfrente que pega varias veces.
  fire: { startup: 120, active: 480, recovery: 240, damage: 3, base: 140, scale: 3, angle: 25, hx: 72, hy: 0, radius: 44, multi: 160 },
  // Dino: coletazo que da la vuelta y pega a los dos lados.
  tail: { startup: 150, active: 160, recovery: 260, damage: 12, base: 380, scale: 10, angle: 35, hx: 0, hy: 6, radius: 84, around: true },
  // Gatito: arañazos rápidos enfrente, un pasito hacia adelante.
  scratch: { startup: 40, active: 300, recovery: 160, damage: 3, base: 120, scale: 3, angle: 30, hx: 46, hy: -4, radius: 34, multi: 100 },
  // Pingüino: se desliza de panza y tumba a quien encuentre.
  slide: { startup: 40, active: 420, recovery: 200, damage: 9, base: 300, scale: 8, angle: 30, hx: 30, hy: 16, radius: 38 },
  // Pirata: dispara una bala de cañón que cae en arco (la crea la escena).
  cannon: { startup: 140, active: 0, recovery: 260 },
};

// Un peleador estilo Smash: corre, salta, golpea según la dirección, usa su especial con B,
// se cubre con el escudo, agarra objetos y sale volando más lejos mientras más % de daño lleva.
// `arena` = { platforms, respawn, gravity } del escenario de la pelea.
export class SmashFighter {
  constructor(scene, layer, { color, label, deviceId = null, character = 'resorte', arena, peque = false, cpuLevel = 'normal' }) {
    this.scene = scene;
    this.color = color;
    this.label = label;
    this.deviceId = deviceId;
    this.isCpu = deviceId === null;
    this.cpuLevel = cpuLevel;
    this.peque = peque;
    this.arena = arena;
    this.characterKey = character;
    const stats = CHARACTERS[character];
    this.stats = stats;
    // `radius` crece en súper modo; `baseRadius` es el tamaño normal (con el que se dibuja).
    this.baseRadius = stats.radius;
    this.radius = stats.radius;
    this.power = stats.power;
    this.weight = stats.weight;
    this.stocks = STOCKS;
    this.damage = 0;
    this.meter = 0;
    this.superMs = 0;

    this.sprite = new Blob(scene, 0, 0, color, this.radius);
    addAccessory(scene, this.sprite, character);
    this.setupArt(scene);
    this.fist = scene.add.circle(0, 0, 12, color).setStrokeStyle(3, COLORS.ink).setVisible(false);
    this.hammerSprite = drawItem(scene, 'hammer').setVisible(false);
    this.bombSprite = drawItem(scene, 'bomb').setScale(0.8).setVisible(false);
    this.flames = scene.add
      .container(0, 0, [
        scene.add.ellipse(0, 0, 92, 46, 0xff9a3c, 0.85),
        scene.add.ellipse(-10, 0, 60, 30, 0xffc93c, 0.9),
        scene.add.ellipse(-18, 0, 28, 14, 0xffffff, 0.9),
      ])
      .setVisible(false);
    this.sprite.figure.add([this.fist, this.hammerSprite, this.bombSprite, this.flames]);
    // Brillo detrás del personaje en súper modo.
    this.aura = scene.add.circle(0, 0, this.radius * 1.5, 0xffd84d, 0.5).setBlendMode(Phaser.BlendModes.ADD).setVisible(false);
    this.sprite.addAt(this.aura, 0);
    // El escudo, el letrero y el mareo no giran con el cuerpo cuando sale volando.
    this.shieldBubble = scene.add.circle(0, 0, this.radius * 1.4, color, 0.5).setStrokeStyle(6, 0xffffff, 0.9).setVisible(false);
    this.tag = scene.add
      .text(0, -this.radius - 34, label, textStyle(18, hexToCss(color), { fontStyle: 'bold', stroke: '#1b1530', strokeThickness: 4 }))
      .setOrigin(0.5);
    this.dizzy = scene.add.text(0, -this.radius - 60, '💫', textStyle(30)).setOrigin(0.5).setVisible(false);
    // La imagen es más alta que la bolita: el letrero y el mareo van arriba de ella.
    if (this.image) {
      const top = this.radius - this.image.displayHeight;
      this.tag.setY(top - 14);
      this.dizzy.setY(top - 40);
    }
    this.sprite.add([this.shieldBubble, this.tag, this.dizzy]);
    layer.add(this.sprite);
    this.spawn(arena.respawn.x, arena.respawn.y, 0);
  }

  // Si hay imagen del personaje (npm run arte), se esconde la bolita dibujada y se usa la imagen,
  // con los pies en el piso y un aro del color del jugador para saber quién es quién.
  setupArt(scene) {
    const key = characterTexture(scene, this.characterKey);
    this.image = null;
    this.superArt = superArtKey(scene, this.characterKey);
    if (!key) return;
    for (const part of this.sprite.figure.list) part.setVisible(false);
    this.image = scene.add.image(0, this.baseRadius, key).setOrigin(0.5, 1);
    this.image.setScale((this.baseRadius * 2.8) / this.image.height);
    this.sprite.figure.addAt(this.image, 0);
    this.ring = scene.add.ellipse(0, this.baseRadius - 2, this.baseRadius * 2.4, this.baseRadius * 0.6).setStrokeStyle(5, this.color);
    this.sprite.addAt(this.ring, 1);
  }

  spawn(x, y, invulnerableMs = RESPAWN_INVULNERABLE_MS) {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.facing = x < 1000 ? 1 : -1;
    this.grounded = false;
    this.platform = null;
    this.airJumps = this.stats.airJumps;
    this.rescueUsed = false;
    this.attack = null;
    this.hitstunMs = 0;
    this.stunMs = 0;
    this.dashMs = 0;
    this.slideMs = 0;
    this.cooldownMs = 0;
    this.ghostMs = 0;
    this.transformMs = 0;
    this.projectileRequest = null;
    this.shielding = false;
    this.shieldHp = SHIELD_MAX;
    this.held = null;
    this.starPowerMs = 0;
    this.invulnerableMs = invulnerableMs;
    this.dropMs = 0;
    this.respawnMs = 0;
    this.out = false;
    this.sprite.setVisible(true);
    this.sprite.ball.setFillStyle(this.color);
    this.image?.setTintMode(Phaser.TintModes.MULTIPLY).clearTint();
    this.tinted = false;
  }

  isAlive() {
    return this.stocks > 0 && !this.out;
  }

  // Recién reaparecido, con la estrella, transformándose o invisible (Fantasma): no le pasa nada.
  isInvulnerable() {
    return this.invulnerableMs > 0 || this.starPowerMs > 0 || this.transformMs > 0 || this.ghostMs > 0;
  }

  // Se salió de la pantalla: pierde una vida y, si le quedan, reaparece arriba del escenario.
  // Si estaba transformado, se le acaba el súper modo (la barra que llevaba no se pierde).
  knockOut() {
    this.stocks -= 1;
    this.out = true;
    this.respawnMs = RESPAWN_MS;
    this.held = null;
    this.starPowerMs = 0;
    if (this.superMs > 0) this.setSuper(false);
    this.sprite.setVisible(false);
  }

  // Agarra un objeto que tocó. Devuelve false si no lo puede agarrar (ya trae algo en la mano).
  grab(type) {
    if (type === 'heart') {
      this.damage = Math.max(0, this.damage - HEART_HEAL);
      return true;
    }
    if (type === 'star') {
      this.starPowerMs = STAR_POWER_MS;
      return true;
    }
    if (this.held) return false;
    this.held = { type, ms: type === 'hammer' ? HAMMER_MS : Infinity };
    return true;
  }

  // --- Barra de poder y súper modo ---

  addMeter(amount) {
    if (this.superMs > 0 || this.out) return;
    this.meter = Math.min(METER_MAX, this.meter + amount * (this.peque ? PEQUE_METER_BONUS : 1));
  }

  // Le pegó a alguien (con el cuerpo, un proyectil o una bomba): llena su barra.
  dealtDamage(amount) {
    this.addMeter(amount * METER_PER_DAMAGE_DEALT);
  }

  canTransform() {
    return this.meter >= METER_MAX && this.superMs === 0 && this.isAlive();
  }

  // Barra llena + LB + RB. Devuelve true si se transformó (la escena pone los efectos).
  transform() {
    if (!this.canTransform()) return false;
    this.meter = 0;
    this.superMs = SUPER_MS;
    this.transformMs = TRANSFORM_MS;
    this.attack = null;
    this.dashMs = 0;
    this.slideMs = 0;
    this.shielding = false;
    this.setSuper(true);
    sfx.transform();
    return true;
  }

  setSuper(on) {
    const stats = this.stats;
    if (!on) this.superMs = 0;
    this.radius = on ? Math.round(stats.radius * SUPER.size) : stats.radius;
    this.power = stats.power * (on ? SUPER.power : 1);
    this.weight = stats.weight * (on ? SUPER.weight : 1);
    // Todo el dibujo crece igual; con los pies en el mismo piso.
    this.sprite.setScale(this.radius / this.baseRadius);
    if (this.grounded && this.platform) this.y = this.platform.top - this.radius;
  }

  // input: { x, y (stick), jump, attack, special (recién apretados), shield (sostenido) }
  update(dtMs, input) {
    const dt = dtMs / 1000;
    if (this.out) {
      if (this.stocks > 0) {
        this.respawnMs -= dtMs;
        if (this.respawnMs <= 0) {
          this.damage = 0;
          this.spawn(this.arena.respawn.x, this.arena.respawn.y);
        }
      }
      return;
    }

    this.invulnerableMs = Math.max(0, this.invulnerableMs - dtMs);
    this.starPowerMs = Math.max(0, this.starPowerMs - dtMs);
    this.dropMs = Math.max(0, this.dropMs - dtMs);
    this.hitstunMs = Math.max(0, this.hitstunMs - dtMs);
    this.stunMs = Math.max(0, this.stunMs - dtMs);
    this.dashMs = Math.max(0, this.dashMs - dtMs);
    this.slideMs = Math.max(0, this.slideMs - dtMs);
    this.cooldownMs = Math.max(0, this.cooldownMs - dtMs);
    this.ghostMs = Math.max(0, this.ghostMs - dtMs);
    this.transformMs = Math.max(0, this.transformMs - dtMs);
    if (this.superMs > 0) {
      this.superMs -= dtMs;
      if (this.superMs <= 0) {
        this.setSuper(false);
        sfx.powerDown();
      }
    }
    if (this.held) {
      this.held.ms -= dtMs;
      if (this.held.ms <= 0) this.held = null;
    }
    // Transformándose: se queda quieto en el aire un momento, como en las caricaturas.
    if (this.transformMs > 0) {
      this.vx = 0;
      this.vy = 0;
      return;
    }
    // Parado en una plataforma que se mueve: se va con ella.
    if (this.grounded && this.platform) this.x += this.platform.dx;
    this.advanceAttack(dtMs);

    const canAct = this.hitstunMs === 0 && this.stunMs === 0;
    if (canAct) {
      // El escudo solo se usa en el piso; saltar lo cancela.
      this.shielding = this.grounded && input.shield && !this.attack && !input.jump;
      if (this.shielding) {
        this.vx = approach(this.vx, 0, GROUND_FRICTION * dt);
        this.shieldHp -= SHIELD_DRAIN * dt;
        if (this.shieldHp <= 0) this.breakShield();
      } else {
        this.control(dt, input);
      }
    } else {
      this.shielding = false;
      this.vx *= Math.exp(-LAUNCH_DRAG * dt);
      if (this.grounded) this.vx = approach(this.vx, 0, GROUND_FRICTION * dt);
    }
    if (!this.shielding) this.shieldHp = Math.min(SHIELD_MAX, this.shieldHp + SHIELD_REGEN * dt);

    // Durante la embestida de Rayo no hay gravedad: va en línea recta.
    // Dragoncito y Fantasma caen más despacio (gravity < 1), y en el Espacio todos.
    const gravity = (this.stats.gravity ?? 1) * (this.arena.gravity ?? 1);
    if (this.dashMs > 0) this.vy = 0;
    else this.vy = Math.min(MAX_FALL * gravity, this.vy + GRAVITY * gravity * dt);
    const prevFeet = this.y + this.radius;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.collide(prevFeet);
  }

  advanceAttack(dtMs) {
    if (!this.attack) return;
    const attack = this.attack;
    const a = ATTACKS[attack.type];
    const wasStarting = attack.elapsed < a.startup;
    attack.elapsed += dtMs;
    const justActive = wasStarting && attack.elapsed >= a.startup;
    if (justActive && attack.type === 'charge') this.vx = this.facing * CHARGE_LUNGE;
    if (justActive && attack.type === 'scratch') this.vx = this.facing * SCRATCH_LUNGE;
    if (justActive && attack.type === 'slide') this.slideMs = SLIDE_MS;
    if (justActive && attack.type === 'cannon') {
      this.projectileRequest = {
        kind: 'cannon',
        x: this.x + this.facing * (this.radius + 16),
        y: this.y - 10,
        vx: this.facing * CANNON_THROW.vx,
        vy: CANNON_THROW.vy,
        dir: this.facing,
      };
      sfx.boom();
    }
    if (justActive && attack.type === 'cast') {
      this.projectileRequest = { kind: 'star', x: this.x + this.facing * (this.radius + 12), y: this.y - 6, dir: this.facing };
    }
    if (justActive && attack.type === 'laser') {
      this.projectileRequest = { kind: 'laser', x: this.x + this.facing * (this.radius + 30), y: this.y - 4, dir: this.facing };
      sfx.laser();
    }
    if (justActive && attack.type === 'throw') {
      this.projectileRequest = {
        kind: 'bomb',
        x: this.x + this.facing * (this.radius + 10),
        y: this.y - 20,
        vx: this.facing * BOMB_THROW.vx,
        vy: BOMB_THROW.vy,
        dir: this.facing,
      };
      this.held = null;
      sfx.throw();
    }
    // Golpes de varios toques: cada `multi` ms puede volver a pegarle a los mismos.
    if (a.multi && attack.elapsed >= a.startup) {
      const tick = Math.floor((attack.elapsed - a.startup) / a.multi);
      if (tick !== attack.tick) {
        attack.tick = tick;
        attack.hit.clear();
      }
    }
    if (attack.elapsed >= a.startup + a.active + a.recovery) this.attack = null;
  }

  control(dt, input) {
    const stats = this.stats;
    const isSuper = this.superMs > 0;
    const speedBonus = (this.starPowerMs > 0 ? STAR_SPEED_BONUS : 1) * (isSuper ? SUPER.speed : 1);
    const jump = stats.jump * (isSuper ? SUPER.jump : 1);
    if (!this.attack && Math.abs(input.x) > 0.2) this.facing = Math.sign(input.x);
    if (this.dashMs > 0) {
      this.vx = this.facing * DASH_SPEED;
    } else if (this.slideMs > 0) {
      this.vx = this.facing * SLIDE_SPEED;
    } else if (this.grounded) {
      const slow = this.attack ? 0.3 : 1;
      this.vx = approach(this.vx, input.x * stats.run * slow * speedBonus, GROUND_FRICTION * dt);
    } else {
      this.vx = approach(this.vx, input.x * stats.air * speedBonus, AIR_ACCEL * dt);
    }

    if (input.jump && this.dashMs === 0) {
      if (this.grounded) {
        this.vy = -jump;
        this.grounded = false;
        sfx.jump();
      } else if (this.airJumps > 0) {
        this.vy = -jump * 0.92;
        this.airJumps -= 1;
        sfx.jump();
      }
    }
    // Bajar de una plataforma delgada: ↓ estando parado en ella.
    if (this.grounded && this.platform?.soft && input.y > 0.6) {
      this.dropMs = DROP_MS;
      this.grounded = false;
      this.y += 4;
    }
    if (input.special) this.startSpecial(input);
    else if (input.attack && !this.attack) this.startAttack(input);
  }

  startAttack(input) {
    let type = 'jab';
    if (this.held?.type === 'hammer') type = 'hammer';
    else if (this.held?.type === 'bomb') type = 'throw';
    else if (input.y < -0.5) type = 'up';
    else if (input.y > 0.5) type = this.grounded ? 'sweep' : 'stomp';
    this.attack = { type, elapsed: 0, hit: new Set() };
  }

  // B: el especial del personaje. B + ↑ es el salto de rescate (una vez antes de tocar piso);
  // el de Resorte es su súper salto, que además golpea.
  startSpecial(input) {
    if (this.attack) return;
    const key = this.characterKey;
    if (input.y < -0.5 || key === 'resorte') {
      if (this.rescueUsed) return;
      this.rescueUsed = true;
      sfx.special();
      this.grounded = false;
      this.platform = null;
      if (key === 'resorte') {
        this.vy = -SPRING_SPEED;
        this.attack = { type: 'spring', elapsed: 0, hit: new Set() };
      } else {
        this.vy = -RESCUE_SPEED;
      }
      return;
    }
    if (this.cooldownMs > 0) return;
    const attack = (type) => {
      this.attack = { type, elapsed: 0, hit: new Set() };
    };
    let sound = sfx.special;
    if (key === 'tanque') {
      attack('charge');
    } else if (key === 'rayo') {
      attack('dash');
      this.dashMs = DASH_MS;
    } else if (key === 'estrella') {
      attack('cast');
    } else if (key === 'robot') {
      attack('laser');
      sound = null;
    } else if (key === 'ninja') {
      attack('ambush');
      this.projectileRequest = { kind: 'teleport' };
      sound = sfx.poof;
    } else if (key === 'dragon') {
      attack('fire');
      sound = sfx.fire;
    } else if (key === 'fantasma') {
      this.ghostMs = GHOST_MS * (this.superMs > 0 ? 1.5 : 1);
      sound = sfx.ghost;
    } else if (key === 'dino') {
      attack('tail');
    } else if (key === 'gatito') {
      attack('scratch');
    } else if (key === 'pinguino') {
      attack('slide');
      sound = sfx.jump;
    } else if (key === 'pirata') {
      attack('cannon');
      sound = null;
    } else {
      return;
    }
    this.cooldownMs = (SPECIAL_COOLDOWN_MS[key] ?? 0) * (this.superMs > 0 ? SUPER.cooldown : 1);
    sound?.();
  }

  breakShield() {
    sfx.shieldBreak();
    this.shielding = false;
    this.shieldHp = SHIELD_MAX * 0.4;
    this.stunMs = SHIELD_BREAK_STUN_MS;
    this.vy = -400;
    this.grounded = false;
    this.platform = null;
  }

  // Las plataformas solo detienen al caer sobre ellas (se atraviesan desde abajo).
  collide(prevFeet) {
    const feet = this.y + this.radius;
    if (this.grounded) {
      const p = this.platform;
      if (this.x < p.left - this.radius * 0.5 || this.x > p.right + this.radius * 0.5) {
        this.grounded = false;
        this.platform = null;
      } else {
        this.y = p.top - this.radius;
        this.vy = 0;
        return;
      }
    }
    if (this.vy < 0) return;
    for (const p of this.arena.platforms) {
      if (p.soft && this.dropMs > 0) continue;
      const withinX = this.x >= p.left - this.radius * 0.5 && this.x <= p.right + this.radius * 0.5;
      // `p.dy` cuenta si la plataforma subió este cuadro (si no, una nube que sube "atravesaría" los pies).
      if (withinX && prevFeet <= p.top - p.dy + 1 && feet >= p.top) {
        this.y = p.top - this.radius;
        this.vy = 0;
        this.grounded = true;
        this.platform = p;
        this.airJumps = this.stats.airJumps;
        this.rescueUsed = false;
        return;
      }
    }
  }

  // Zona del golpe mientras está activo (o null). En súper modo crece con el personaje.
  hitbox() {
    if (!this.attack || this.out) return null;
    const a = ATTACKS[this.attack.type];
    const t = this.attack.elapsed;
    if (!a.active || t < a.startup || t >= a.startup + a.active) return null;
    const size = this.radius / this.baseRadius;
    return { x: this.x + a.hx * size * this.facing, y: this.y + a.hy * size, radius: a.radius * size, data: a };
  }

  // Recibe un golpe de `source` ({ facing, power }). Con el escudo arriba solo gasta escudo;
  // si no, sube el % y sale volando, más fuerte entre más daño lleve y menos pese.
  // Devuelve cuánto daño le hicieron (`dealt`) para llenar la barra del que pegó.
  takeHit(source, data) {
    if (this.shielding) {
      this.shieldHp -= data.damage * source.power * SHIELD_HIT_FACTOR;
      this.vx = source.facing * SHIELD_PUSHBACK;
      if (this.shieldHp <= 0) this.breakShield();
      else sfx.block();
      return { blocked: true, speed: 0, dealt: 0 };
    }
    const peque = this.peque ? PEQUE_DAMAGE : 1;
    const dealt = data.damage * source.power * peque;
    this.damage += dealt;
    this.addMeter(dealt * METER_PER_DAMAGE_TAKEN);
    const speed = ((data.base * source.power + this.damage * data.scale) / this.weight) * (this.peque ? PEQUE_KNOCKBACK : 1);
    const angle = (data.angle * Math.PI) / 180;
    // Los golpes "alrededor" avientan hacia afuera del que pegó, no hacia donde mira.
    const dir = data.around ? Math.sign(this.x - source.x) || source.facing : source.facing;
    this.vx = Math.cos(angle) * speed * dir;
    this.vy = -Math.sin(angle) * speed;
    this.hitstunMs = speed * HITSTUN_PER_SPEED;
    this.stunMs = 0;
    this.dashMs = 0;
    this.slideMs = 0;
    this.grounded = false;
    this.platform = null;
    this.attack = null;
    this.sprite.flash();
    this.sprite.squish();
    this.flashImage();
    return { blocked: false, speed, dealt };
  }

  // Con imagen, el destello del golpe es pintarla de blanco un instante.
  flashImage() {
    if (!this.image) return;
    this.image.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
    this.scene.time.delayedCall(70, () => {
      if (this.image.active) this.image.setTintMode(Phaser.TintModes.MULTIPLY).clearTint();
      this.tinted = false;
    });
  }

  // Pose de la imagen según lo que esté haciendo. La imagen mira a la derecha: se voltea si va a la izquierda.
  // En súper modo usa las imágenes de su súper forma, si las hay.
  renderArt() {
    this.punchArt = false;
    if (!this.image) return;
    let pose = 'normal';
    if (this.hitstunMs > 0 || this.stunMs > 0) pose = 'dolor';
    else if (this.attack) pose = 'golpe';
    else if (!this.grounded) pose = 'salto';
    const art = this.superMs > 0 && this.superArt ? this.superArt : this.characterKey;
    const key = characterTexture(this.scene, art, pose);
    if (this.image.texture.key !== key) {
      this.image.setTexture(key);
      this.image.setScale((this.baseRadius * 2.8) / this.image.height);
    }
    this.image.setFlipX(this.facing < 0);
    this.punchArt = hasPose(this.scene, art, 'golpe');
  }

  render() {
    if (this.out) return;
    const s = this.sprite;
    s.setPosition(this.x, this.y);
    s.look(this.facing * 0.9, this.hitstunMs > 0 ? -0.6 : 0);
    // Gira mientras sale volando por un golpe fuerte.
    s.figure.angle = this.hitstunMs > 150 ? s.figure.angle + 25 * this.facing : 0;
    const blinking = this.invulnerableMs > 0 && Math.floor(this.invulnerableMs / 90) % 2 === 1;
    s.setAlpha(this.ghostMs > 0 ? 0.25 : blinking ? 0.35 : 1);
    // Con la estrella cambia de colores como arcoíris; en súper modo sin imagen propia, se pone dorado.
    // En "pantalla" la imagen se aclara con el color (multiplicar la oscurecería casi a negro).
    const rainbow = RAINBOW[Math.floor(this.starPowerMs / 80) % RAINBOW.length];
    let tint = null;
    if (this.starPowerMs > 0) tint = rainbow;
    else if (this.superMs > 0 && !this.superArt) tint = SUPER_TINT;
    if (tint !== null) {
      s.ball.setFillStyle(this.starPowerMs > 0 ? rainbow : this.color);
      this.image?.setTintMode(Phaser.TintModes.SCREEN).setTint(tint);
    } else if (this.tinted) {
      s.ball.setFillStyle(this.color);
      this.image?.setTintMode(Phaser.TintModes.MULTIPLY).clearTint();
    }
    this.tinted = tint !== null;
    this.renderArt();
    this.renderAura();

    this.shieldBubble.setVisible(this.shielding);
    if (this.shielding) this.shieldBubble.setScale(0.55 + (0.45 * this.shieldHp) / SHIELD_MAX);
    this.dizzy.setVisible(this.stunMs > 0);

    const box = this.hitbox();
    const a = this.attack && ATTACKS[this.attack.type];
    const type = this.attack?.type;
    // El puño sale en los golpes normales y en el puñetazo cargado (si la imagen no trae su pose de golpe).
    const showFist = Boolean(a) && !['dash', 'spring', 'hammer', 'throw', 'fire', 'laser'].includes(type) && !this.punchArt;
    this.fist.setVisible(showFist);
    if (showFist) {
      const reach = box ? 1 : 0.55;
      this.fist.setPosition((a.hx ?? 30) * this.facing * reach, (a.hy ?? 0) * reach);
      this.fist.setScale(type === 'charge' ? 1.6 : 1);
    }

    // El fuego de Dragoncito tiembla mientras está activo.
    const fire = type === 'fire' && Boolean(box);
    this.flames.setVisible(fire);
    if (fire) {
      const flicker = 0.85 + Math.random() * 0.3;
      this.flames.setPosition(a.hx * this.facing, -4).setScale(this.facing * flicker, flicker);
    }

    // El martillo se mueve de atrás hacia adelante al pegar.
    const hasHammer = this.held?.type === 'hammer';
    this.hammerSprite.setVisible(hasHammer);
    if (hasHammer) {
      let angle = -25;
      if (type === 'hammer') angle = -80 + 170 * Math.min(1, this.attack.elapsed / (a.startup + a.active));
      this.hammerSprite.setPosition(this.facing * this.baseRadius * 0.85, -6).setScale(this.facing, 1).setAngle(angle * this.facing);
    }
    this.bombSprite.setVisible(this.held?.type === 'bomb');
    if (this.held?.type === 'bomb') this.bombSprite.setPosition(this.facing * this.baseRadius * 0.9, -4);
  }

  // Brillo que late detrás del personaje en súper modo. Al transformarse sale grande y se encoge;
  // en los últimos 2 segundos parpadea para avisar que ya se acaba.
  renderAura() {
    const on = this.superMs > 0;
    this.aura.setVisible(on);
    if (!on) return;
    const now = this.scene.time.now;
    if (this.transformMs > 0) {
      this.aura.setScale(1 + (2.5 * this.transformMs) / TRANSFORM_MS).setAlpha(0.9);
      return;
    }
    const ending = this.superMs < 2000 && Math.floor(now / 120) % 2 === 0;
    this.aura.setScale(1 + 0.1 * Math.sin(now / 90)).setAlpha(ending ? 0.15 : 0.7);
    this.aura.setFillStyle(Math.floor(now / 200) % 2 === 0 ? 0xffd84d : this.color, 0.5);
  }
}

function approach(value, target, step) {
  return value < target ? Math.min(target, value + step) : Math.max(target, value - step);
}
