import { sfx } from '../../shared/sound.js';
import { artImage } from './art.js';
import { moveBody } from './physics.js';
import { T } from './tiles.js';

// Los enemigos de Súper Bolitas (la letra es la de levels.js). `size`: alto del dibujo; `w`, `h`: su caja.
//   stomp: qué pasa si le brincas encima ('squash' se aplasta, 'fall' se cae, 'shell' se vuelve caparazón,
//          'kick' (caparazón) lo pateas; null = no se puede: ¡pica!).  immune: ni el fuego le hace nada.
export const ENEMIES = {
  g: { art: 'plat:hongo-malo', size: 46, w: 38, h: 40, kind: 'walker', speed: 70, stomp: 'squash', color: 0x9c6b3c },
  t: { art: 'plat:tortuga', size: 58, w: 36, h: 50, kind: 'walker', speed: 55, stomp: 'shell', color: 0x4cd97b },
  c: { art: 'plat:cangrejo', size: 46, w: 50, h: 40, kind: 'walker', speed: 85, stomp: 'squash', color: 0xff5a5f },
  e: { art: 'plat:erizo', size: 44, w: 40, h: 36, kind: 'walker', speed: 55, stomp: null, color: 0xe53935 },
  v: { art: 'plat:murcielago', size: 40, w: 50, h: 30, kind: 'bat', stomp: 'fall', color: 0x8158d8 },
  q: { art: 'plat:pajaro', size: 46, w: 46, h: 34, kind: 'flyer', stomp: 'fall', color: 0x3fa7ff },
  n: { art: 'plat:nube-mala', size: 64, w: 64, h: 44, kind: 'cloud', stomp: 'fall', color: 0x9a9aae },
  f: { art: 'plat:pez', size: 42, w: 44, h: 32, kind: 'fish', stomp: null, color: 0xff9a3c },
  j: { art: 'plat:medusa', size: 56, w: 36, h: 44, kind: 'jelly', stomp: null, color: 0xff9ee8 },
  x: { art: 'plat:bola-fuego', size: 40, w: 30, h: 30, kind: 'podoboo', stomp: null, immune: true, color: 0xff9a3c },
  a: { art: 'plat:aplastador', size: 86, w: 74, h: 80, kind: 'thwomp', stomp: null, immune: true, safeTop: true, color: 0x9a9aae },
  k: { art: 'plat:planta', size: 72, w: 34, h: 62, kind: 'plant', stomp: null, color: 0x4cd97b },
  shell: { art: 'plat:caparazon', size: 34, w: 38, h: 30, kind: 'shell', stomp: 'kick', color: 0x4cd97b },
};
const GRAVITY = 2200;
const MAX_FALL = 900;
const SHELL_SPEED = 560;
const ACTIVATE_MARGIN = 220;

export class Enemy {
  constructor(scene, key, x, y) {
    this.scene = scene;
    this.key = key;
    this.type = ENEMIES[key];
    Object.assign(this, { x, y, x0: x, y0: y, vx: 0, vy: 0, w: this.type.w, h: this.type.h, t: Math.random() * 6, facing: -1 });
    this.state = 'start';
    this.stateMs = 0;
    this.dead = false;
    this.gone = false;
    this.awake = false;
    this.look = artImage(scene, this.type.art, this.type.size, { color: this.type.color });
    this.sprite = scene.add.container(x, y, [this.look]).setDepth(this.type.kind === 'plant' ? 5 : 40);
    if (this.type.kind === 'podoboo') this.base = lavaBelow(scene.level, x, y);
    if (this.type.kind === 'plant') {
      // Sale del tubo que tiene abajo: escondida, la boca del tubo la tapa.
      this.top = y;
      this.y = this.top + this.h + 6;
      this.state = 'hidden';
    }
  }

  get stompable() {
    return Boolean(this.type.stomp) && !this.dead;
  }

  get harmful() {
    if (this.dead) return false;
    if (this.type.kind === 'shell') return this.state === 'slide';
    if (this.type.kind === 'podoboo') return this.state === 'jump';
    if (this.type.kind === 'plant') return this.state !== 'hidden';
    return true;
  }

  update(dtMs, scene) {
    if (this.gone) return;
    const dt = dtMs / 1000;
    this.t += dt;
    this.stateMs += dtMs;
    if (this.dead) {
      if (this.deathKind === 'fall') {
        this.vy = Math.min(MAX_FALL, this.vy + GRAVITY * dt);
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        if (this.y > scene.level.height + 200) this.remove();
      } else if (this.stateMs > 450) this.remove();
      return;
    }
    // Se despiertan cuando están por entrar a la pantalla.
    if (!this.awake) {
      const cam = scene.cameras.main;
      if (this.x > cam.scrollX + cam.width + ACTIVATE_MARGIN || this.x < cam.scrollX - ACTIVATE_MARGIN * 3) return;
      this.awake = true;
    }
    const level = scene.level;
    const kind = this.type.kind;
    if (kind === 'walker' || kind === 'shell') {
      if (kind === 'walker' && this.vx === 0) this.vx = -this.type.speed * (this.slow ? 0.5 : 1);
      if (kind === 'shell' && this.state !== 'slide') this.vx = 0;
      this.vy = Math.min(MAX_FALL, this.vy + GRAVITY * dt);
      moveBody(level, this, dt);
      if (this.hitWall) {
        this.vx = -this.hitWall * Math.abs(this.vx || this.type.speed || SHELL_SPEED);
        if (kind === 'shell') sfx.block();
      }
      if (this.vx) this.facing = Math.sign(this.vx);
      if (this.y > level.height + 100) this.remove();
    } else if (kind === 'bat') {
      this.updateBat(dt, scene);
    } else if (kind === 'flyer') {
      const prevX = this.x;
      this.x = this.x0 + Math.sin(this.t * 1.1) * 150;
      this.y = this.y0 + Math.sin(this.t * 2.2) * 30;
      this.facing = Math.sign(this.x - prevX) || this.facing;
    } else if (kind === 'cloud') {
      this.updateCloud(dt, scene);
    } else if (kind === 'fish') {
      const prevX = this.x;
      this.x = this.x0 + Math.sin(this.t * 0.7) * 170;
      this.y = this.y0 + Math.sin(this.t * 2) * 14;
      this.facing = Math.sign(this.x - prevX) || this.facing;
    } else if (kind === 'jelly') {
      this.y = this.y0 + Math.sin(this.t * 1.2) * 80;
      const target = scene.nearestPlayer(this.x, this.y);
      if (target) this.x += Math.sign(target.x - this.x) * Math.min(25 * dt, Math.abs(target.x - this.x));
      this.x = Math.max(this.x0 - 160, Math.min(this.x0 + 160, this.x));
    } else if (kind === 'podoboo') {
      this.updatePodoboo(dt);
    } else if (kind === 'thwomp') {
      this.updateThwomp(dt, scene);
    } else if (kind === 'plant') {
      this.updatePlant(dt, scene);
    }
  }

  updateBat(dt, scene) {
    if (this.state === 'start') {
      const target = scene.nearestPlayer(this.x, this.y);
      if (target && Math.abs(target.x - this.x) < 230 && target.y > this.y) {
        this.state = 'swoop';
        this.targetY = target.y - 24;
        this.vx = Math.sign(target.x - this.x) * 190;
        this.vy = 280;
        sfx.ghost();
      }
      return;
    }
    if (this.state === 'swoop' && this.y >= this.targetY) {
      this.state = 'fly';
      this.vy = 0;
    }
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.facing = Math.sign(this.vx) || this.facing;
  }

  updateCloud(dt, scene) {
    const target = scene.nearestPlayer(this.x, this.y);
    const goal = (target ? target.x : this.x) + Math.sin(this.t * 0.9) * 110;
    this.vx += Math.sign(goal - this.x) * 260 * dt;
    this.vx = Math.max(-200, Math.min(200, this.vx)) * 0.99;
    this.x += this.vx * dt;
    this.y = 2.4 * T + Math.sin(this.t * 2) * 10;
    this.facing = Math.sign(this.vx) || this.facing;
    // Cada rato suelta un erizo (máximo 3 a la vez).
    this.dropMs = (this.dropMs ?? 2500) - dt * 1000;
    if (this.dropMs <= 0) {
      this.dropMs = 3400;
      const mine = scene.enemies.filter((e) => e.from === this && !e.dead && !e.gone).length;
      if (mine < 3 && target) {
        const spiny = scene.spawnEnemy('e', this.x, this.y + 30);
        spiny.from = this;
        spiny.vy = -250;
        spiny.vx = Math.sign(target.x - this.x) * 60 || -60;
      }
    }
  }

  updatePodoboo(dt) {
    if (this.state === 'start' || this.state === 'wait') {
      this.state = 'wait';
      this.sprite.setVisible(false);
      if (this.stateMs > 1600 + (this.x % 700)) {
        this.state = 'jump';
        this.stateMs = 0;
        this.y = this.base;
        this.vy = -980;
        this.sprite.setVisible(true);
      }
      return;
    }
    this.vy += 1700 * dt;
    this.y += this.vy * dt;
    if (this.vy > 0 && this.y >= this.base) {
      this.state = 'wait';
      this.stateMs = 0;
    }
  }

  updateThwomp(dt, scene) {
    if (this.state === 'start') this.state = 'wait';
    if (this.state === 'wait') {
      const below = scene.players.some((p) => p.active && Math.abs(p.x - this.x) < T * 1.4 && p.y > this.y);
      if (below) {
        this.state = 'fall';
        this.stateMs = 0;
      }
    } else if (this.state === 'fall') {
      this.vy = Math.min(1200, this.vy + 3200 * dt);
      this.vx = 0;
      moveBody(scene.level, this, dt);
      if (this.onGround || this.y > scene.level.height) {
        this.state = 'land';
        this.stateMs = 0;
        this.vy = 0;
        scene.cameras.main.shake(160, 0.008);
        sfx.boom();
      }
    } else if (this.state === 'land') {
      if (this.stateMs > 900) this.state = 'rise';
    } else if (this.state === 'rise') {
      this.y -= 150 * dt;
      if (this.y <= this.y0) {
        this.y = this.y0;
        this.state = 'wait';
      }
    }
  }

  updatePlant(dt, scene) {
    const up = this.top;
    const down = this.top + this.h + 6;
    if (this.state === 'hidden') {
      const near = scene.players.some((p) => p.active && Math.abs(p.x - this.x) < T * 1.3);
      if (this.stateMs > 1800 && !near) this.setState('rise');
    } else if (this.state === 'rise') {
      this.y = Math.max(up, this.y - 150 * dt);
      if (this.y === up) this.setState('up');
    } else if (this.state === 'up') {
      if (this.stateMs > 1600) this.setState('lower');
    } else if (this.state === 'lower') {
      this.y = Math.min(down, this.y + 150 * dt);
      if (this.y === down) this.setState('hidden');
    }
  }

  setState(state) {
    this.state = state;
    this.stateMs = 0;
  }

  // Un caparazón quieto: lo patean hacia `dir`.
  kick(dir, by) {
    this.state = 'slide';
    this.vx = dir * SHELL_SPEED;
    this.kickedBy = by;
    this.kickMs = this.scene.time.now;
    sfx.throw();
  }

  // how: 'stomp' | 'fire' | 'shell' | 'star' | 'tongue' | 'bump'
  kill(how, dir = 1) {
    if (this.dead) return;
    this.dead = true;
    this.stateMs = 0;
    if (how === 'stomp' && this.type.stomp === 'squash') {
      this.deathKind = 'squash';
      this.scene.tweens.add({ targets: this.sprite, scaleY: 0.3, alpha: 0.4, duration: 300 });
    } else if (how === 'tongue') {
      this.deathKind = 'eaten';
      this.scene.tweens.add({ targets: this.sprite, scale: 0, duration: 200 });
    } else {
      this.deathKind = 'fall';
      this.vy = -420;
      this.vx = dir * 120;
      this.sprite.setVisible(true);
    }
  }

  remove() {
    this.gone = true;
    this.sprite.destroy();
  }

  render() {
    if (this.gone) return;
    const flip = this.facing > 0 ? 1 : -1;
    this.sprite.setPosition(this.x, this.y);
    if (this.deathKind === 'fall') this.sprite.setScale(1, -1);
    else if (!this.dead) this.sprite.setScale(flip * Math.abs(this.sprite.scaleX || 1), this.sprite.scaleY);
    if (this.type.kind === 'shell' && this.state === 'slide') this.look.setAngle?.(this.look.angle + this.vx * 0.05);
    if (this.type.kind === 'walker' && !this.dead) this.look.setAngle?.(Math.sin(this.t * 12) * 5);
    if (this.type.kind === 'thwomp' && this.state === 'land') this.look.setAngle?.(Math.sin(this.stateMs / 30) * 2);
  }
}

// Dónde está la lava abajo de (x, y): de ahí salta la bola de fuego.
function lavaBelow(level, x, y) {
  const col = Math.floor(x / T);
  for (let row = Math.floor(y / T); row < level.grid.length; row += 1) {
    if (level.at(col, row) === 'L') return row * T + T * 0.6;
  }
  return y + T;
}
