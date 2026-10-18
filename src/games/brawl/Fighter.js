import { controls } from '../../shared/controls.js';
import { players } from '../../shared/players.js';
import { Blob } from '../../ui/Blob.js';
import { CharacterLook } from '../../ui/CharacterLook.js';
import { COLORS, hexToCss, textStyle } from '../../ui/style.js';
import { ARENA } from './arena.js';

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

// Un jugador en la pelea: se mueve con el stick, salta con A y pega con X o B.
// Si se queda sin corazones cae, y otro jugador lo levanta parándose junto a él.
// Se ve como el personaje que escogió (`character`, de Bolitas Bros).
export class Fighter {
  constructor(scene, player, x, y, character) {
    this.scene = scene;
    this.player = player;
    this.deviceId = player.deviceId;
    this.color = players.color(player).hex;
    this.radius = RADIUS;
    this.x = x;
    this.y = y;
    this.z = 0;
    this.vz = 0;
    this.knockback = 0;
    this.facing = 1;
    this.hp = MAX_HP;
    this.down = false;
    this.reviveMs = 0;
    this.attackMs = 0;
    this.cooldownMs = 0;
    this.invulnerableMs = 0;
    this.hitThisAttack = new Set();

    this.sprite = new Blob(scene, x, y, this.color, RADIUS);
    this.look = new CharacterLook(scene, this.sprite, character);
    // Con imagen, un aro del color del jugador en el piso dice quién es quién.
    if (this.look.hasArt) this.sprite.addAt(scene.add.ellipse(0, RADIUS - 2, RADIUS * 2.4, RADIUS * 0.6).setStrokeStyle(5, this.color), 1);
    this.fist = scene.add.circle(0, 6, 11, this.color).setStrokeStyle(3, COLORS.ink).setVisible(false);
    this.tag = scene.add
      .text(0, this.look.top - 14, `J${player.slot + 1}`, textStyle(16, hexToCss(this.color), { fontStyle: 'bold', stroke: '#1b1530', strokeThickness: 4 }))
      .setOrigin(0.5);
    this.sprite.figure.add([this.fist, this.tag]);
    this.stars = scene.add.text(0, this.look.top - 6, '✦ ¡Ayuda! ✦', textStyle(18, '#ffc93c', { fontStyle: 'bold', stroke: '#1b1530', strokeThickness: 4 }));
    this.stars.setOrigin(0.5).setVisible(false);
    this.sprite.add(this.stars);
    this.reviveRing = scene.add.graphics();
  }

  isAttacking() {
    return this.attackMs > 0;
  }

  update(dtMs, fighters) {
    this.cooldownMs = Math.max(0, this.cooldownMs - dtMs);
    this.invulnerableMs = Math.max(0, this.invulnerableMs - dtMs);
    if (this.down) {
      this.updateDown(dtMs, fighters);
      return;
    }

    const dt = dtMs / 1000;
    const id = this.deviceId;
    const stick = controls.getStick(id);
    this.x += stick.x * SPEED_X * dt + this.knockback * dt;
    this.y += stick.y * SPEED_Y * dt;
    this.knockback = decay(this.knockback, dt);
    if (stick.x > 0.2) this.facing = 1;
    else if (stick.x < -0.2) this.facing = -1;

    if (controls.justPressed(id, 'a') && this.z === 0) this.vz = JUMP_SPEED;
    if (this.z > 0 || this.vz > 0) {
      this.vz -= GRAVITY * dt;
      this.z = Math.max(0, this.z + this.vz * dt);
      if (this.z === 0) this.vz = 0;
    }

    if ((controls.justPressed(id, 'x') || controls.justPressed(id, 'b')) && this.cooldownMs === 0) {
      this.attackMs = ATTACK_MS;
      this.cooldownMs = ATTACK_COOLDOWN_MS;
      this.hitThisAttack.clear();
    }
    this.attackMs = Math.max(0, this.attackMs - dtMs);

    this.x = clamp(this.x, ARENA.left, ARENA.right);
    this.y = clamp(this.y, ARENA.top, ARENA.bottom);
  }

  updateDown(dtMs, fighters) {
    // Cada compañero cerca ayuda: entre más, más rápido se levanta.
    const helpers = fighters.filter(
      (f) => f !== this && !f.down && Math.hypot(f.x - this.x, (f.y - this.y) * 1.4) < REVIVE_RADIUS + f.radius,
    ).length;
    this.reviveMs = helpers > 0 ? this.reviveMs + dtMs * helpers : Math.max(0, this.reviveMs - dtMs * 0.5);
    if (this.reviveMs >= REVIVE_MS) {
      this.down = false;
      this.hp = REVIVE_HP;
      this.invulnerableMs = INVULNERABLE_MS;
      this.reviveMs = 0;
    }
  }

  canHit(target) {
    const ahead = (target.x - this.x) * this.facing;
    return ahead > -10 && ahead < this.radius + target.radius + ATTACK_REACH && Math.abs(target.y - this.y) < DEPTH_TOLERANCE + target.radius * 0.3;
  }

  // Devuelve true si el golpe sí le quitó un corazón.
  hurt(fromX) {
    if (this.down || this.invulnerableMs > 0 || this.z > DODGE_HEIGHT) return false;
    this.hp -= 1;
    this.invulnerableMs = INVULNERABLE_MS;
    this.knockback = (Math.sign(this.x - fromX) || 1) * 420;
    this.look.flash();
    this.sprite.squish();
    if (this.hp <= 0) {
      this.down = true;
      this.hp = 0;
      this.reviveMs = 0;
      this.attackMs = 0;
      this.z = 0;
      this.vz = 0;
      this.knockback = 0;
    }
    return true;
  }

  heal() {
    if (this.down || this.hp >= MAX_HP) return false;
    this.hp += 1;
    return true;
  }

  // Al reintentar una ronda todos regresan completos.
  reset() {
    this.down = false;
    this.hp = MAX_HP;
    this.reviveMs = 0;
    this.invulnerableMs = INVULNERABLE_MS;
  }

  render() {
    const s = this.sprite;
    s.setPosition(this.x, this.y).setDepth(this.y);
    s.figure.y = -this.z;
    s.figure.angle = this.down ? 90 : 0;
    const blinking = this.invulnerableMs > 0 && !this.down && Math.floor(this.invulnerableMs / 90) % 2 === 1;
    s.setAlpha(this.down ? 0.75 : blinking ? 0.35 : 1);
    s.look(this.facing * 0.9, 0);
    const hurting = this.down || (this.invulnerableMs > INVULNERABLE_MS - 350 && this.knockback !== 0);
    const pose = hurting ? 'dolor' : this.attackMs > 0 ? 'golpe' : this.z > 0 ? 'salto' : 'normal';
    this.look.show(pose, this.facing);
    this.tag.setVisible(!this.down);
    this.stars.setVisible(this.down);

    // El puño sale y regresa durante el golpe.
    const progress = this.attackMs > 0 ? 1 - this.attackMs / ATTACK_MS : 0;
    this.fist.setVisible(this.attackMs > 0 && !this.look.punchArt);
    this.fist.setPosition(this.facing * (this.radius * 0.6 + Math.sin(progress * Math.PI) * 34), 6);

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
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

// El empujón de un golpe se frena rápido.
function decay(velocity, dt) {
  const next = velocity * Math.pow(0.001, dt);
  return Math.abs(next) < 5 ? 0 : next;
}
