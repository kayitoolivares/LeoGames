import { Blob } from '../../ui/Blob.js';
import { COLORS, hexToCss, textStyle } from '../../ui/style.js';
import { CHARACTERS, addAccessory } from './characters.js';
import { PLATFORMS, RESPAWN } from './stage.js';

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
const STAR_COOLDOWN_MS = 700;
export const SHIELD_MAX = 100;
const SHIELD_DRAIN = 22;
const SHIELD_REGEN = 14;
const SHIELD_HIT_FACTOR = 3;
const SHIELD_PUSHBACK = 140;
const SHIELD_BREAK_STUN_MS = 1600;

// Golpes. Tiempos en ms; el empujón crece con el % del que recibe.
// angle: hacia dónde sale volando (grados; 0 = hacia adelante, 90 = arriba, negativo = abajo).
export const ATTACKS = {
  // X, según la dirección del stick.
  jab: { startup: 60, active: 100, recovery: 160, damage: 7, base: 260, scale: 9, angle: 35, hx: 52, hy: 0, radius: 30 },
  up: { startup: 70, active: 110, recovery: 200, damage: 8, base: 300, scale: 9, angle: 85, hx: 14, hy: -50, radius: 32 },
  sweep: { startup: 80, active: 120, recovery: 220, damage: 6, base: 240, scale: 8, angle: 20, hx: 46, hy: 22, radius: 34 },
  stomp: { startup: 90, active: 120, recovery: 220, damage: 9, base: 200, scale: 7, angle: -70, hx: 8, hy: 46, radius: 32 },
  // B: especial de cada personaje.
  charge: { startup: 280, active: 120, recovery: 300, damage: 15, base: 420, scale: 11, angle: 30, hx: 62, hy: 0, radius: 40 },
  dash: { startup: 30, active: 230, recovery: 220, damage: 8, base: 320, scale: 8, angle: 25, hx: 22, hy: 0, radius: 40 },
  spring: { startup: 40, active: 260, recovery: 260, damage: 9, base: 340, scale: 9, angle: 80, hx: 0, hy: -40, radius: 40 },
  // Lanza una estrella (la crea la escena); no golpea con el cuerpo.
  cast: { startup: 90, active: 0, recovery: 200 },
};

// Un peleador estilo Smash: corre, salta, golpea según la dirección, usa su especial con B,
// se cubre con el escudo y sale volando más lejos mientras más % de daño lleva.
export class SmashFighter {
  constructor(scene, layer, { color, label, deviceId = null, character = 'resorte' }) {
    this.scene = scene;
    this.color = color;
    this.label = label;
    this.deviceId = deviceId;
    this.isCpu = deviceId === null;
    this.characterKey = character;
    const stats = CHARACTERS[character];
    this.stats = stats;
    this.radius = stats.radius;
    this.power = stats.power;
    this.weight = stats.weight;
    this.stocks = STOCKS;
    this.damage = 0;

    this.sprite = new Blob(scene, 0, 0, color, this.radius);
    addAccessory(scene, this.sprite, character);
    this.fist = scene.add.circle(0, 0, 12, color).setStrokeStyle(3, COLORS.ink).setVisible(false);
    this.tag = scene.add
      .text(0, -this.radius - 34, label, textStyle(18, hexToCss(color), { fontStyle: 'bold', stroke: '#1b1530', strokeThickness: 4 }))
      .setOrigin(0.5);
    this.sprite.figure.add(this.fist);
    // El escudo y el letrero no giran con el cuerpo cuando sale volando.
    this.shieldBubble = scene.add.circle(0, 0, this.radius * 1.4, color, 0.5).setStrokeStyle(6, 0xffffff, 0.9).setVisible(false);
    this.dizzy = scene.add.text(0, -this.radius - 60, '💫', textStyle(30)).setOrigin(0.5).setVisible(false);
    this.sprite.add([this.shieldBubble, this.tag, this.dizzy]);
    layer.add(this.sprite);
    this.spawn(RESPAWN.x, RESPAWN.y, 0);
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
    this.starCooldownMs = 0;
    this.projectileRequest = null;
    this.shielding = false;
    this.shieldHp = SHIELD_MAX;
    this.invulnerableMs = invulnerableMs;
    this.dropMs = 0;
    this.respawnMs = 0;
    this.out = false;
    this.sprite.setVisible(true);
  }

  isAlive() {
    return this.stocks > 0 && !this.out;
  }

  // Se salió de la pantalla: pierde una vida y, si le quedan, reaparece arriba del escenario.
  knockOut() {
    this.stocks -= 1;
    this.out = true;
    this.respawnMs = RESPAWN_MS;
    this.sprite.setVisible(false);
  }

  // input: { x, y (stick), jump, attack, special (recién apretados), shield (sostenido) }
  update(dtMs, input) {
    const dt = dtMs / 1000;
    if (this.out) {
      if (this.stocks > 0) {
        this.respawnMs -= dtMs;
        if (this.respawnMs <= 0) {
          this.damage = 0;
          this.spawn(RESPAWN.x, RESPAWN.y);
        }
      }
      return;
    }

    this.invulnerableMs = Math.max(0, this.invulnerableMs - dtMs);
    this.dropMs = Math.max(0, this.dropMs - dtMs);
    this.hitstunMs = Math.max(0, this.hitstunMs - dtMs);
    this.stunMs = Math.max(0, this.stunMs - dtMs);
    this.dashMs = Math.max(0, this.dashMs - dtMs);
    this.starCooldownMs = Math.max(0, this.starCooldownMs - dtMs);
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
    if (this.dashMs > 0) this.vy = 0;
    else this.vy = Math.min(MAX_FALL, this.vy + GRAVITY * dt);
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
    if (justActive && attack.type === 'cast') {
      this.projectileRequest = { x: this.x + this.facing * (this.radius + 12), y: this.y - 6, dir: this.facing };
    }
    if (attack.elapsed >= a.startup + a.active + a.recovery) this.attack = null;
  }

  control(dt, input) {
    const stats = this.stats;
    if (!this.attack && Math.abs(input.x) > 0.2) this.facing = Math.sign(input.x);
    if (this.dashMs > 0) {
      this.vx = this.facing * DASH_SPEED;
    } else if (this.grounded) {
      const slow = this.attack ? 0.3 : 1;
      this.vx = approach(this.vx, input.x * stats.run * slow, GROUND_FRICTION * dt);
    } else {
      this.vx = approach(this.vx, input.x * stats.air, AIR_ACCEL * dt);
    }

    if (input.jump && this.dashMs === 0) {
      if (this.grounded) {
        this.vy = -stats.jump;
        this.grounded = false;
      } else if (this.airJumps > 0) {
        this.vy = -stats.jump * 0.92;
        this.airJumps -= 1;
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
    if (input.y < -0.5) type = 'up';
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
    if (key === 'tanque') {
      this.attack = { type: 'charge', elapsed: 0, hit: new Set() };
    } else if (key === 'rayo') {
      this.attack = { type: 'dash', elapsed: 0, hit: new Set() };
      this.dashMs = DASH_MS;
    } else if (key === 'estrella' && this.starCooldownMs === 0) {
      this.attack = { type: 'cast', elapsed: 0, hit: new Set() };
      this.starCooldownMs = STAR_COOLDOWN_MS;
    }
  }

  breakShield() {
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
    for (const p of PLATFORMS) {
      if (p.soft && this.dropMs > 0) continue;
      const withinX = this.x >= p.left - this.radius * 0.5 && this.x <= p.right + this.radius * 0.5;
      if (withinX && prevFeet <= p.top + 1 && feet >= p.top) {
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

  // Zona del golpe mientras está activo (o null).
  hitbox() {
    if (!this.attack || this.out) return null;
    const a = ATTACKS[this.attack.type];
    const t = this.attack.elapsed;
    if (!a.active || t < a.startup || t >= a.startup + a.active) return null;
    return { x: this.x + a.hx * this.facing, y: this.y + a.hy, radius: a.radius, data: a };
  }

  // Recibe un golpe de `source` ({ facing, power }). Con el escudo arriba solo gasta escudo;
  // si no, sube el % y sale volando, más fuerte entre más daño lleve y menos pese.
  takeHit(source, data) {
    if (this.shielding) {
      this.shieldHp -= data.damage * source.power * SHIELD_HIT_FACTOR;
      this.vx = source.facing * SHIELD_PUSHBACK;
      if (this.shieldHp <= 0) this.breakShield();
      return { blocked: true, speed: 0 };
    }
    this.damage += data.damage * source.power;
    const speed = (data.base * source.power + this.damage * data.scale) / this.weight;
    const angle = (data.angle * Math.PI) / 180;
    this.vx = Math.cos(angle) * speed * source.facing;
    this.vy = -Math.sin(angle) * speed;
    this.hitstunMs = speed * HITSTUN_PER_SPEED;
    this.stunMs = 0;
    this.dashMs = 0;
    this.grounded = false;
    this.platform = null;
    this.attack = null;
    this.sprite.flash();
    this.sprite.squish();
    return { blocked: false, speed };
  }

  render() {
    if (this.out) return;
    const s = this.sprite;
    s.setPosition(this.x, this.y);
    s.look(this.facing * 0.9, this.hitstunMs > 0 ? -0.6 : 0);
    // Gira mientras sale volando por un golpe fuerte.
    s.figure.angle = this.hitstunMs > 150 ? s.figure.angle + 25 * this.facing : 0;
    const blinking = this.invulnerableMs > 0 && Math.floor(this.invulnerableMs / 90) % 2 === 1;
    s.setAlpha(blinking ? 0.35 : 1);

    this.shieldBubble.setVisible(this.shielding);
    if (this.shielding) this.shieldBubble.setScale(0.55 + (0.45 * this.shieldHp) / SHIELD_MAX);
    this.dizzy.setVisible(this.stunMs > 0);

    const box = this.hitbox();
    const a = this.attack && ATTACKS[this.attack.type];
    // El puño sale en los golpes normales y en el puñetazo cargado.
    const showFist = Boolean(a) && this.attack.type !== 'dash' && this.attack.type !== 'spring';
    this.fist.setVisible(showFist);
    if (showFist) {
      const reach = box ? 1 : 0.55;
      this.fist.setPosition((a.hx ?? 30) * this.facing * reach, (a.hy ?? 0) * reach);
      this.fist.setScale(this.attack.type === 'charge' ? 1.6 : 1);
    }
  }
}

function approach(value, target, step) {
  return value < target ? Math.min(target, value + step) : Math.max(target, value - step);
}
