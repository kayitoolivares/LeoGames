import { textStyle } from '../../ui/style.js';
import { ANIMALS, animalTexture } from '../baby/animals.js';
import { B, T } from './blocks.js';
import { moveBody, touches } from './physics.js';

// Los animalitos (de día pasean; con X hacen su sonido, y la oveja te da lana) y los slimes de la noche (brincan hacia
// el jugador más cercano y solo lo empujan; en Aventura además le quitan un corazón). Los dibujos son los del Modo Bebé
// y el slime de Pelea en equipo; si faltan, un emoji o una bolita verde.
const GRAVITY = 2200;
const MAX_FALL = 900;
const ANIMAL = { w: 44, h: 40, speed: 70, hop: 520, height: 54 };
const SLIME = { w: 40, h: 34, speed: 210, hop: 600, height: 46, hp: 2, everyMin: 900, everyMax: 1500 };
// La oveja vuelve a tener lana después de este rato.
const WOOL_REGROW_MS = 20000;

class Body {
  constructor(scene, x, y, size) {
    this.scene = scene;
    this.x = x;
    this.y = y;
    this.w = size.w;
    this.h = size.h;
    this.vx = 0;
    this.vy = 0;
    this.dir = Math.random() < 0.5 ? -1 : 1;
    this.onGround = false;
    this.hitWall = 0;
  }

  fall(world, s) {
    const wet = touches(world, { x: this.x, y: this.y - this.h * 0.4, w: this.w, h: this.h * 0.3 }, (id) => id === B.WATER);
    this.vy = wet ? Math.max(this.vy - 900 * s, -140) : Math.min(this.vy + GRAVITY * s, MAX_FALL);
    moveBody(world, this, s);
  }
}

export class Animal extends Body {
  constructor(scene, kind, x, y) {
    super(scene, x, y, ANIMAL);
    this.kind = kind;
    this.info = ANIMALS[kind];
    this.walkMs = 0;
    this.sheared = false;
    this.shearMs = 0;
    this.pokeMs = 0;
    const texture = animalTexture(scene, kind);
    if (texture) {
      this.sprite = scene.add.image(x, y, texture).setOrigin(0.5, 1);
      this.sprite.setScale(ANIMAL.height / this.sprite.height);
    } else {
      this.sprite = scene.add.text(x, y, this.info.emoji, textStyle(40)).setOrigin(0.5, 1);
    }
    this.sprite.setDepth(40);
    this.baseScale = this.sprite.scale;
  }

  update(dt, world) {
    const s = dt / 1000;
    this.walkMs -= dt;
    this.pokeMs = Math.max(0, this.pokeMs - dt);
    if (this.sheared) {
      this.shearMs -= dt;
      if (this.shearMs <= 0) this.sheared = false;
    }
    if (this.walkMs <= 0) {
      // Camina un ratito o se queda quieto.
      this.walking = Math.random() < 0.55;
      if (this.walking) this.dir = Math.random() < 0.5 ? -1 : 1;
      this.walkMs = 1200 + Math.random() * 2400;
    }
    this.vx = this.walking ? this.dir * ANIMAL.speed : 0;
    // Si se topa con un bloque, brinca; si es muy alto, se da la vuelta.
    if (this.onGround && this.hitWall) {
      if (this.bumped) this.dir = -this.dir;
      else this.vy = -ANIMAL.hop;
      this.bumped = !this.bumped;
    } else if (this.onGround) {
      this.bumped = false;
    }
    this.fall(world, s);
  }

  // Con X: hace su sonido y brinca; la oveja (si tiene lana) te da una.
  poke() {
    if (this.pokeMs > 0) return false;
    this.pokeMs = 700;
    this.info.cry();
    if (this.onGround) this.vy = -ANIMAL.hop * 0.7;
    if (this.kind === 'oveja' && !this.sheared) {
      this.sheared = true;
      this.shearMs = WOOL_REGROW_MS;
      return true;
    }
    return false;
  }

  render(now) {
    const bob = this.walking && this.onGround ? Math.abs(Math.sin(now / 110)) * 4 : 0;
    this.sprite.setPosition(this.x, this.y - bob);
    // (Los dibujos miran a la derecha; el emoji se queda como está.)
    if (this.sprite.setFlipX && this.sprite.type === 'Image') this.sprite.setFlipX(this.dir < 0);
    // La oveja sin lana se ve más rosita y flaquita.
    if (this.sprite.setTint && this.kind === 'oveja') {
      if (this.sheared) this.sprite.setTint(0xffc8d8);
      else this.sprite.clearTint();
    }
  }

  destroy() {
    this.sprite.destroy();
  }
}

export class Slime extends Body {
  constructor(scene, x, y) {
    super(scene, x, y, SLIME);
    this.doorsSolid = true;
    this.hp = SLIME.hp;
    this.hopMs = 600 + Math.random() * 600;
    this.flashMs = 0;
    this.squash = 1;
    const key = ['bloques:objeto-slime', 'brawl:slime'].find((k) => scene.textures.exists(k)) ?? null;
    if (key) {
      this.sprite = scene.add.image(x, y, key).setOrigin(0.5, 1);
      this.sprite.setScale(SLIME.height / this.sprite.height);
    } else {
      // Bolita verde con ojitos (dibujada).
      const g = scene.add.graphics();
      g.fillStyle(0x6fe07a, 0.9).fillEllipse(0, -18, 46, 36);
      g.fillStyle(0xffffff, 0.5).fillEllipse(-10, -26, 10, 7);
      g.fillStyle(0x1b1530).fillCircle(-8, -18, 4).fillCircle(8, -18, 4);
      this.sprite = scene.add.container(x, y, [g]);
    }
    this.sprite.setDepth(41);
    this.baseScale = this.sprite.scaleX;
  }

  update(dt, world, target) {
    const s = dt / 1000;
    this.flashMs = Math.max(0, this.flashMs - dt);
    if (this.onGround) {
      this.vx *= Math.max(0, 1 - 8 * s);
      this.hopMs -= dt;
      if (this.hopMs <= 0 && target) {
        this.dir = Math.sign(target.x - this.x) || this.dir;
        this.vx = this.dir * SLIME.speed;
        this.vy = -SLIME.hop;
        this.hopMs = SLIME.everyMin + Math.random() * (SLIME.everyMax - SLIME.everyMin);
        this.squash = 0.7;
        this.jumped = true;
      }
    }
    const wasInAir = !this.onGround;
    this.fall(world, s);
    if (wasInAir && this.onGround) this.squash = 1.35;
    this.squash += (1 - this.squash) * Math.min(1, s * 10);
  }

  // Le pegan: sale volando hacia atrás. Devuelve true si se acabó.
  hit(dir) {
    this.hp -= 1;
    this.vx = dir * 380;
    this.vy = -380;
    this.flashMs = 160;
    return this.hp <= 0;
  }

  render() {
    this.sprite.setPosition(this.x, this.y);
    this.sprite.setScale(this.baseScale * (2 - this.squash) * (this.dir < 0 ? -1 : 1), this.baseScale * this.squash);
    this.sprite.setAlpha(this.flashMs > 0 ? 0.5 : 1);
  }

  destroy() {
    this.sprite.destroy();
  }
}

// ¿Están tocándose dos cuerpos? (x al centro, y en los pies)
export function bodiesTouch(a, b, pad = 0) {
  return Math.abs(a.x - b.x) < (a.w + b.w) / 2 - pad && a.y - a.h + pad < b.y && b.y - b.h + pad < a.y;
}

// Para poner un animalito o un slime: los pies en el piso de esa columna.
export function groundY(world, col) {
  return world.groundRow(col) * T;
}
