import { sfx } from '../../shared/sound.js';
import { artImage, platCreature } from './art.js';
import { moveBody, tileAt } from './physics.js';
import { T, isSolid } from './tiles.js';

// Los enemigos de Súper Bolitas (la letra es la de levels.js). `size`: alto del dibujo; `w`, `h`: su caja.
//   stomp: qué pasa si le brincas encima ('squash' se aplasta, 'fall' se cae, 'shell' se vuelve caparazón,
//          'kick' (caparazón) lo pateas, 'collapse' se desarma un rato; null = no se puede: ¡pica!).
//   immune: ni el fuego ni el hielo le hacen nada.  fireproof: el fuego no (el hielo sí).
//   shellAs: en qué se convierte al pisarlo (si stomp es 'shell').  facesLeft: el dibujo mira a la izquierda.
export const ENEMIES = {
  g: { art: 'plat:hongo-malo', size: 46, w: 38, h: 40, kind: 'walker', speed: 70, stomp: 'squash', color: 0x2ab7b0 },
  t: { art: 'plat:tortuga', size: 58, w: 36, h: 50, kind: 'walker', speed: 55, stomp: 'shell', color: 0x4cd97b },
  c: { art: 'plat:cangrejo', size: 46, w: 50, h: 40, kind: 'walker', speed: 85, stomp: 'squash', color: 0xff5a5f },
  e: { art: 'plat:erizo', size: 44, w: 40, h: 36, kind: 'walker', speed: 55, stomp: null, color: 0xe53935 },
  v: { art: 'plat:murcielago', size: 40, w: 50, h: 30, kind: 'bat', stomp: 'fall', color: 0x8158d8 },
  q: { art: 'plat:pajaro', size: 46, w: 46, h: 34, kind: 'flyer', stomp: 'fall', color: 0x3fa7ff },
  n: { art: 'plat:nube-mala', size: 64, w: 64, h: 44, kind: 'cloud', stomp: 'fall', color: 0x9a9aae },
  f: { art: 'plat:pez', size: 42, w: 44, h: 32, kind: 'fish', stomp: null, color: 0xff9a3c },
  j: { art: 'plat:medusa', size: 56, w: 36, h: 44, kind: 'jelly', stomp: null, color: 0xff9ee8 },
  x: { art: 'plat:bola-fuego', size: 40, w: 30, h: 30, kind: 'podoboo', stomp: null, immune: true, color: 0xff9a3c },
  a: { art: 'plat:aplastador', size: 86, w: 74, h: 80, kind: 'thwomp', stomp: null, immune: true, safeTop: true, color: 0x4a4a55 },
  k: { art: 'plat:planta', size: 72, w: 34, h: 62, kind: 'plant', stomp: null, color: 0x4cd97b },
  shell: { art: 'plat:caparazon', size: 34, w: 38, h: 30, kind: 'shell', stomp: 'kick', color: 0x4cd97b },
  // Nieve
  p: { art: 'plat:pinguino', size: 52, w: 36, h: 46, kind: 'walker', speed: 85, stomp: 'shell', shellAs: 'panza', color: 0x2a3a7a },
  panza: { art: 'plat:pinguino-panza', size: 38, w: 46, h: 30, kind: 'shell', stomp: 'kick', color: 0x2a3a7a },
  l: { art: 'plat:carambano', size: 62, w: 24, h: 56, kind: 'icicle', stomp: null, color: 0x9fdcff },
  N: { art: 'plat:bola-nieve', size: 44, w: 40, h: 40, kind: 'walker', speed: 150, stomp: 'squash', color: 0xffffff },
  // Dulces
  J: { art: 'plat:galleta', size: 52, w: 36, h: 48, kind: 'walker', speed: 75, stomp: 'squash', color: 0xc98a5a },
  Q: { art: 'plat:dona', size: 44, w: 46, h: 34, kind: 'flyer', stomp: 'fall', color: 0xff9ec7 },
  A: { art: 'plat:paleta', size: 60, w: 32, h: 54, kind: 'hopper', stomp: 'squash', color: 0xffd84d },
  W: { art: 'plat:chicle', size: 44, w: 40, h: 38, kind: 'hopper', chase: true, stomp: 'squash', color: 0xff8fc8 },
  // Casa embrujada
  h: { art: 'plat:fantasma', chaseArt: 'plat:fantasma-boca', size: 54, w: 44, h: 46, kind: 'boo', stomp: null, immune: true, color: 0xffffff },
  E: { art: 'plat:esqueleto', size: 60, w: 34, h: 56, kind: 'walker', speed: 55, stomp: 'collapse', color: 0xffffff },
  V: { art: 'plat:vela', size: 48, w: 26, h: 44, kind: 'floater', stomp: null, fireproof: true, color: 0xffb02e },
  // El espacio (los de Pelea en equipo).
  w: { art: 'plat:marcianito', size: 50, w: 36, h: 46, kind: 'walker', speed: 90, stomp: 'squash', color: 0x3fe0d0 },
  T: { art: 'plat:ovni', size: 54, w: 52, h: 34, kind: 'flyer', stomp: 'fall', color: 0x9aa8b8 },
  I: { art: 'plat:robotito', size: 62, w: 42, h: 56, kind: 'walker', speed: 60, stomp: 'collapse', color: 0xc0c4d0 },
  // La bala de los cañones.
  bala: { art: 'plat:objeto-bala', size: 34, w: 52, h: 30, kind: 'bullet', stomp: 'fall', color: 0xb8bcc8 },
};
const BULLET_SPEED = 260;
const PILE_MS = 2600;
export const FREEZE_MS = 7000;
const ICE_SLIDE = 500;
const GRAVITY = 2200;
const MAX_FALL = 900;
const SHELL_SPEED = 560;
const ACTIVATE_MARGIN = 220;
// Los que vuelan: el pájaro y la dona van y vienen de lado (y dan la vuelta en las paredes); la medusa y la vela
// suben y bajan. Ninguno se mete en el piso ni en el techo: su vuelo se acomoda al espacio que tienen.
const FLYER = { speed: 120, range: 150, bob: 30 };
// El pez nada igual que el pájaro vuela (más lejos y subiendo y bajando menos).
const FISH = { speed: 100, range: 170, bob: 14 };
const BOB = { jelly: 80, floater: 60, fish: FISH.bob };
// Cómo se mueve cada clase de enemigo (ver ui/creature.js) y de qué tan cerca te ve el que camina (brinquito).
const GAIT = { walker: 'walk', flyer: 'fly', bat: 'fly', cloud: 'fly', fish: 'swim', jelly: 'float', floater: 'float' };
const SPOT = { reach: 260, everyMs: 4000 };

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
    // Camina, ataca, le duele y se burla con sus poses (el fantasma ya cambia de cara solo; caparazones y balas no).
    this.creature = ['boo', 'shell', 'bullet'].includes(this.type.kind)
      ? null
      : platCreature(scene, this.look, this.type.art, this.type.size, GAIT[this.type.kind]);
    if (this.type.kind === 'podoboo') this.base = lavaBelow(scene.level, x, y);
    if (['flyer', 'jelly', 'floater', 'fish'].includes(this.type.kind)) this.fitFlight(scene.level);
    if (this.type.kind === 'plant') {
      // Sale del tubo que tiene abajo: escondida, la boca del tubo la tapa.
      this.top = y;
      this.y = this.top + this.h + 6;
      this.state = 'hidden';
    }
  }

  get stompable() {
    return Boolean(this.type.stomp) && !this.dead && !this.frozen && this.state !== 'pile';
  }

  get frozen() {
    return (this.frozenMs ?? 0) > 0;
  }

  get harmful() {
    if (this.dead || this.frozen || this.state === 'pile') return false;
    if (this.type.kind === 'icicle') return this.state === 'fall';
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
    if (this.frozen) {
      this.updateFrozen(dtMs, scene);
      return;
    }
    if (this.state === 'pile') {
      // El esqueleto desarmado se vuelve a armar.
      if (this.stateMs > PILE_MS) {
        this.setState('start');
        this.vx = 0;
        this.scene.tweens.add({ targets: this.sprite, scaleY: 1, duration: 200 });
      }
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
      if (kind === 'walker') this.spotPlayer(dtMs, scene);
    } else if (kind === 'bat') {
      this.updateBat(dt, scene);
    } else if (kind === 'flyer') {
      this.updateFlyer(dt, level);
    } else if (kind === 'cloud') {
      this.updateCloud(dt, scene);
    } else if (kind === 'fish') {
      this.updateFlyer(dt, level, FISH);
    } else if (kind === 'jelly') {
      this.y = this.y0 + Math.sin(this.t * 1.2) * this.bob;
      // Se acerca despacito al jugador (sin meterse en las paredes ni el coral).
      const target = scene.nearestPlayer(this.x, this.y);
      if (target) {
        const step = Math.sign(target.x - this.x) * Math.min(25 * dt, Math.abs(target.x - this.x));
        const front = this.x + step + Math.sign(step) * (this.w / 2);
        // (Revisa todo lo alto de su subir y bajar, no solo donde va ahorita.)
        const heights = [this.y0 - this.bob - this.h + 2, this.y0 - this.h / 2, this.y0 + this.bob - 2];
        if (heights.every((y) => !isSolid(tileAt(level, front, y)))) this.x += step;
      }
      this.x = Math.max(this.x0 - 160, Math.min(this.x0 + 160, this.x));
    } else if (kind === 'podoboo') {
      this.updatePodoboo(dt);
    } else if (kind === 'thwomp') {
      this.updateThwomp(dt, scene);
    } else if (kind === 'plant') {
      this.updatePlant(dt, scene);
    } else if (kind === 'icicle') {
      this.updateIcicle(dt, scene);
    } else if (kind === 'hopper') {
      this.updateHopper(dt, scene);
    } else if (kind === 'boo') {
      this.updateBoo(dt, scene);
    } else if (kind === 'floater') {
      this.y = this.y0 + Math.sin(this.t * 1.5) * this.bob;
    } else if (kind === 'bullet') {
      this.x += this.vx * dt;
      if (this.x < scene.cameras.main.scrollX - 300 || this.x > scene.cameras.main.scrollX + scene.cameras.main.width + 300) this.remove();
    }
  }

  // El que camina, si ve a un jugador cerca enfrente de él, da un brinquito (cada tanto).
  spotPlayer(dtMs, scene) {
    this.spotMs = Math.max(0, (this.spotMs ?? Math.random() * SPOT.everyMs) - dtMs);
    if (this.spotMs > 0 || !this.creature || !this.onGround) return;
    const target = scene.nearestPlayer(this.x, this.y);
    if (!target || Math.abs(target.x - this.x) > SPOT.reach || Math.abs(target.y - this.y) > 2 * T) return;
    if (Math.sign(target.x - this.x) !== this.facing) return;
    this.spotMs = SPOT.everyMs;
    this.creature.hop();
  }

  // Acomoda el vuelo al espacio entre el piso y el techo de donde sale: que al subir y bajar no se meta en ninguno
  // (antes los pájaros a ras de piso se hundían medio cuerpo y las medusas y velas se metían en el piso).
  // Se mide en todo lo que recorre de lado (no solo donde sale): un pájaro que sale arriba de un hoyo se hundía en el
  // piso de junto.
  fitFlight(level) {
    const row = Math.max(0, Math.floor((this.y - this.h / 2) / T));
    const reach = { flyer: FLYER.range, fish: FISH.range }[this.type.kind] ?? 0;
    let bottom = level.grid.length * T - 2;
    let top = 2;
    for (let col = Math.floor((this.x - reach - this.w / 2) / T); col <= Math.floor((this.x + reach + this.w / 2) / T); col += 1) {
      // (Una pared a su altura no cuenta: ahí da la vuelta.)
      if (isSolid(level.at(col, row))) continue;
      let floor = row;
      while (floor < level.grid.length && !isSolid(level.at(col, floor))) floor += 1;
      let ceiling = row;
      while (ceiling >= 0 && !isSolid(level.at(col, ceiling))) ceiling -= 1;
      bottom = Math.min(bottom, floor * T - 2);
      top = Math.max(top, (ceiling + 1) * T + 2);
    }
    const want = this.type.kind === 'flyer' ? FLYER.bob : BOB[this.type.kind];
    // Lo que cabe: la mitad del espacio libre menos el cuerpo.
    this.bob = Math.max(0, Math.min(want, (bottom - top - this.h) / 2));
    // Sus pies (y) van de y0 - bob a y0 + bob.
    this.y0 = Math.min(Math.max(this.y0, top + this.h + this.bob), bottom - this.bob);
    this.y = this.y0;
  }

  // Pájaro, dona y pez: van y vienen de lado (hasta `range` de donde salieron, o hasta una pared) subiendo y bajando.
  updateFlyer(dt, level, move = FLYER) {
    if (!this.vx) this.vx = -move.speed;
    const next = this.x + this.vx * dt;
    const front = next + Math.sign(this.vx) * (this.w / 2);
    const wall = isSolid(tileAt(level, front, this.y - this.h / 2)) || isSolid(tileAt(level, front, this.y - 4));
    if (wall || Math.abs(next - this.x0) > move.range) this.vx = -this.vx;
    else this.x = next;
    this.y = this.y0 + Math.sin(this.t * (move === FISH ? 2 : 2.2)) * this.bob;
    this.facing = Math.sign(this.vx) || this.facing;
  }

  // Carámbano: colgado; si alguien pasa abajo, tiembla y se cae (y se rompe en el piso).
  updateIcicle(dt, scene) {
    if (this.state === 'start') {
      const below = scene.players.some((p) => p.active && Math.abs(p.x - this.x) < T * 1.3 && p.y > this.y);
      if (below) this.setState('shake');
    } else if (this.state === 'shake') {
      this.look.setAngle?.(Math.sin(this.stateMs / 30) * 6);
      if (this.stateMs > 450) this.setState('fall');
    } else if (this.state === 'fall') {
      this.look.setAngle?.(0);
      this.vy = Math.min(1100, this.vy + 2600 * dt);
      this.vx = 0;
      moveBody(scene.level, this, dt);
      if (this.onGround || this.y > scene.level.height) {
        scene.puff?.(this.x, this.y - 20, 0x9fdcff);
        sfx.block();
        this.remove();
      }
    }
  }

  // Paleta: brinca en su lugar. Chicle: brinca hacia el jugador más cercano.
  updateHopper(dt, scene) {
    this.vy = Math.min(MAX_FALL, this.vy + GRAVITY * dt);
    const wasAir = !this.onGround;
    moveBody(scene.level, this, dt);
    if (this.onGround) {
      if (wasAir) {
        this.vx = 0;
        this.creature?.land(0.7);
      }
      if (this.stateMs > 1500) {
        this.stateMs = 0;
        this.vy = this.type.chase ? -560 : -760;
        const target = scene.nearestPlayer(this.x, this.y);
        if (this.type.chase && target) this.vx = Math.sign(target.x - this.x) * 140;
      }
    }
    if (this.vx) this.facing = Math.sign(this.vx);
    if (this.y > scene.level.height + 100) this.remove();
  }

  // Fantasma: si lo estás viendo se tapa la cara y no se mueve; si le das la espalda, se acerca (atraviesa paredes).
  updateBoo(dt, scene) {
    const target = scene.nearestPlayer(this.x, this.y);
    if (!target) return;
    const watched = Math.sign(this.x - target.x) === target.facing;
    const key = watched ? this.type.art : this.type.chaseArt;
    if (this.look.texture?.key !== key && scene.textures.exists(key)) {
      const h = this.type.size;
      this.look.setTexture(key);
      this.look.setScale(h / this.look.height);
    }
    if (watched) return;
    const dx = target.x - this.x;
    const dy = target.y - target.h / 2 - (this.y - this.h / 2);
    const d = Math.hypot(dx, dy) || 1;
    const speed = 75;
    this.x += (dx / d) * speed * dt;
    this.y += (dy / d) * speed * dt;
    this.facing = Math.sign(dx) || this.facing;
  }

  // Congelado (flor de hielo): es un bloque de hielo; se puede pisar o patear. Al rato se descongela.
  freeze(ms = FREEZE_MS) {
    if (this.type.immune || this.dead || this.type.kind === 'bullet') return false;
    this.frozenMs = ms;
    this.iceState = 'still';
    this.vx = 0;
    this.awake = true;
    if (!this.ice) {
      this.ice = this.scene.add.rectangle(0, -this.h / 2, this.w + 14, this.h + 10, 0x9fdcff, 0.45).setStrokeStyle(4, 0xffffff, 0.9);
      this.sprite.add(this.ice);
    }
    this.ice.setVisible(true);
    this.look.setTint?.(0x9fdcff);
    sfx.block();
    return true;
  }

  // Lo patearon congelado: se va patinando y tumba a los que encuentre; al chocar con una pared se rompe.
  kickIce(dir) {
    this.iceState = 'slide';
    this.vx = dir * ICE_SLIDE;
    sfx.throw();
  }

  updateFrozen(dtMs, scene) {
    const dt = dtMs / 1000;
    this.vy = Math.min(MAX_FALL, this.vy + GRAVITY * dt);
    moveBody(scene.level, this, dt);
    if (this.iceState === 'slide' && this.hitWall) {
      scene.puff?.(this.x, this.y - this.h / 2, 0x9fdcff);
      this.kill('fire', -this.hitWall);
      return;
    }
    if (this.y > scene.level.height + 100) {
      this.remove();
      return;
    }
    if (this.iceState === 'slide') return;
    this.frozenMs -= dtMs;
    if (this.frozenMs <= 0) {
      this.ice?.setVisible(false);
      this.look.clearTint?.();
    }
  }

  // El esqueleto: al pisarlo se desarma un rato.
  collapse() {
    this.setState('pile');
    this.vx = 0;
    this.scene.tweens.add({ targets: this.sprite, scaleY: 0.35, duration: 120 });
    sfx.block();
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
        this.creature?.land(1);
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

  // Le pegó a un jugador: se carcajea.
  taunt() {
    this.creature?.taunt();
  }

  // Qué está haciendo, para su pose (ver ui/creature.js).
  creaturePose() {
    if (this.dead || this.state === 'pile') return 'dolor';
    const kind = this.type.kind;
    if (kind === 'walker' || kind === 'flyer' || kind === 'fish' || kind === 'cloud' || kind === 'jelly' || kind === 'floater') return 'caminar';
    if (kind === 'bat') return this.state === 'swoop' ? 'ataque' : this.state === 'start' ? 'normal' : 'caminar';
    if (kind === 'hopper') return this.onGround ? 'normal' : this.type.chase ? 'ataque' : 'paso';
    if (kind === 'podoboo') return this.vy < 0 ? 'ataque' : 'paso';
    if (kind === 'thwomp') return this.state === 'fall' ? 'ataque' : this.state === 'land' ? 'burla' : 'normal';
    if (kind === 'plant') return this.state === 'up' ? 'ataque' : 'normal';
    if (kind === 'icicle') return this.state === 'shake' || this.state === 'fall' ? 'ataque' : 'normal';
    return 'normal';
  }

  // how: 'stomp' | 'fire' | 'shell' | 'star' | 'tongue' | 'bump'
  kill(how, dir = 1) {
    if (this.dead) return;
    this.dead = true;
    this.stateMs = 0;
    this.creature?.hurt(2000);
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

  // Una bala de cañón hacia `dir`.
  launch(dir) {
    this.vx = dir * BULLET_SPEED;
    this.facing = dir;
    this.awake = true;
  }

  render() {
    if (this.gone) return;
    const flip = (this.facing > 0 ? 1 : -1) * (this.type.facesLeft ? -1 : 1);
    this.sprite.setPosition(this.x, this.y);
    if (this.deathKind === 'fall') this.sprite.setScale(1, -1);
    else if (!this.dead && this.state !== 'pile') this.sprite.setScale(flip * Math.abs(this.sprite.scaleX || 1), this.sprite.scaleY);
    if (this.type.kind === 'shell' && this.state === 'slide') this.look.setAngle?.(this.look.angle + this.vx * 0.05);
    // (Con dibujo, el balanceo al caminar lo hace ui/creature.js; si no, se tambalea.)
    if (this.type.kind === 'walker' && !this.dead && !this.frozen && !this.creature) this.look.setAngle?.(Math.sin(this.t * 12) * 5);
    if (this.type.kind === 'thwomp' && this.state === 'land') this.look.setAngle?.(Math.sin(this.stateMs / 30) * 2);
    // Congelado se queda tieso en su pose.
    if (this.creature && !this.frozen) {
      this.creature.face(this.facing);
      this.creature.set(this.creaturePose());
      this.creature.update();
    }
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
