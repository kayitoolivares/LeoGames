import { sfx } from '../../shared/sound.js';
import { burst } from '../brawl/effects.js';
import { artImage, platCreature } from './art.js';
import { drawnBoss } from './drawn.js';
import { moveBody } from './physics.js';
import { T } from './tiles.js';

// Los jefes de Súper Bolitas: al final de cada mundo (y los mini jefes, a la mitad, en su fuerte), en su arena. Se
// les brinca encima (3 veces a los jefes, 2 a los mini jefes; cada vez se enojan y van más rápido); las bolas de fuego
// y de hielo también les bajan un poquito. Cada uno pelea a su manera (`behavior`):
//   jumper:  camina y salta; al caer puede hacer temblar el piso (quake: si estás en el piso te mareas) y llamar
//            ayudantes (minion).
//   flyer:   vuela arriba y lanza rayos que avisan antes (bolts); luego baja a descansar: ¡ahí se le brinca!
//   charger: se lanza corriendo de lado a lado; al chocar con la pared queda mareado.
//   shooter: camina, salta y escupe bolas (de fuego, nieve o tinta), unas arriba y otras abajo.
// Los de la Isla de los jefes (mundo 9; si no tienen dibujo de Gemini se dibujan con canvas, ver drawn.js):
//   diver:    vuela arriba, apunta (sale una sombra donde va a caer) y se lanza en picada; se le atora el aguijón en
//             el piso y ahí se le brinca encima.
//   puffer:   nada (en el agua) y de repente se infla con picos y avienta espinas: inflado rebotas (y de lado pica);
//             desinflado se le brinca encima.
//   splitter: rebota hacia los jugadores y cada vez que la pisan se parte en dos más chiquitas (grande, 2 medianas y
//             4 chiquitas que ya no pican); se gana cuando no queda ni una.
// `hint`: lo que dice el letrero al empezar la pelea (si no, cuántas veces brincarle encima).
export const BOSSES = {
  reyHongo: { name: 'el Rey Hongo', art: 'plat:rey-hongo', size: 150, w: 110, h: 130, speed: 90, behavior: 'jumper', quake: true, minion: 'g', color: 0x2ab7b0 },
  reyNube: { name: 'el Rey Nube', art: 'plat:rey-nube', size: 130, w: 150, h: 100, speed: 140, behavior: 'flyer', bolts: 0xffe14d, color: 0x9a9aae },
  reyCangrejo: { name: 'el Rey Cangrejo', art: 'plat:rey-cangrejo', size: 120, w: 160, h: 96, speed: 120, behavior: 'charger', color: 0xff5a5f },
  reyDragon: { name: 'el Rey Dragón', art: 'plat:rey-dragon', size: 160, w: 120, h: 140, speed: 100, behavior: 'shooter', shot: 'fire', facesLeft: true, color: 0x8e5cf0 },
  reyYeti: { name: 'el Rey Yeti', art: 'plat:gran-yeti', size: 170, w: 120, h: 150, speed: 95, behavior: 'shooter', shot: 'snow', quake: true, color: 0xffffff },
  reyPastel: { name: 'el Rey Pastel', art: 'plat:rey-pastel', size: 170, w: 130, h: 150, speed: 85, behavior: 'jumper', minion: 'W', color: 0xff9ec7 },
  megaRobot: { name: 'el Mega Robot', art: 'plat:mega-robot', size: 170, w: 130, h: 150, speed: 90, behavior: 'shooter', shot: 'laser', quake: true, color: 0xe53935 },
  reyCalabaza: { name: 'el Rey Calabaza', art: 'plat:rey-calabaza', size: 150, w: 140, h: 120, speed: 130, behavior: 'flyer', bolts: 0xb07cff, color: 0xff9a3c },
  // Mini jefes (en el fuerte de cada mundo).
  granTortuga: { name: 'la Gran Tortuga', art: 'plat:tortuga', size: 116, w: 80, h: 100, speed: 100, behavior: 'charger', hp: 2, mini: true, color: 0x4cd97b },
  granPajaro: { name: 'el Gran Pájaro', art: 'plat:pajaro', size: 100, w: 110, h: 76, speed: 170, behavior: 'flyer', hp: 2, mini: true, color: 0x3fa7ff },
  pulpo: { name: 'el Capitán Pulpo', art: 'plat:capitan-pulpo', size: 130, w: 100, h: 116, speed: 80, behavior: 'shooter', shot: 'ink', hp: 2, mini: true, color: 0xb07cff },
  granBola: { name: 'la Gran Bola de Fuego', art: 'plat:bola-fuego', size: 100, w: 84, h: 84, speed: 120, behavior: 'jumper', hp: 2, mini: true, color: 0xff9a3c },
  granPinguino: { name: 'el Gran Pingüino', art: 'plat:pinguino', size: 116, w: 84, h: 104, speed: 110, behavior: 'charger', hp: 2, mini: true, color: 0x2a3a7a },
  granGalleta: { name: 'la Gran Galleta', art: 'plat:galleta', size: 124, w: 86, h: 114, speed: 90, behavior: 'jumper', minion: 'J', hp: 2, mini: true, color: 0xc98a5a },
  granRobotito: { name: 'el Gran Robotito', art: 'plat:robotito', size: 120, w: 90, h: 106, speed: 110, behavior: 'charger', hp: 2, mini: true, color: 0xc0c4d0 },
  granFantasma: { name: 'el Gran Fantasma', art: 'plat:fantasma', size: 120, w: 110, h: 100, speed: 120, behavior: 'flyer', hp: 2, mini: true, color: 0xffffff },
  // La Isla de los jefes.
  abejaReina: { name: 'la Abeja Reina', art: 'plat:abeja-reina', size: 130, w: 116, h: 104, speed: 170, behavior: 'diver', color: 0xffc93c, hint: 'Cuando se le atore el aguijón, ¡brínquenle encima!' },
  pezGlobo: { name: 'el Pez Globo', art: 'plat:pez-globo', size: 104, w: 96, h: 88, speed: 80, behavior: 'puffer', shot: 'spike', color: 0xffb347, hint: 'Desinflado se le brinca encima; inflado, ¡cuidado con los picos!' },
  granGelatina: { name: 'la Gelatina Gigante', art: 'plat:gelatina', size: 140, w: 150, h: 104, speed: 150, behavior: 'splitter', hp: 7, color: 0xff4f6d, hint: 'Cada vez que la pisan se parte en dos: ¡que no quede ni una!' },
};
export const BOSS_HP = 3;
const STUN_MS = 1300;
const GRAVITY = 2200;
const CHIP = 0.25;
// Dónde flotan los que vuelan (sus pies).
const FLY_Y = 4.6 * T;
const SHOTS = { fire: [0xff7a1f, 0xffd84d], snow: [0xffffff, 0x9fd8ff], ink: [0x3a2a5a, 0x8158d8], laser: [0xff4d6d, 0xffffff], spike: [0xfff2c4, 0xff8a3c] };
// Los que no caen: vuelan o nadan (y cómo se mueven sus poses, ver ui/creature.js).
const FLOATERS = new Set(['flyer', 'diver', 'puffer']);
const GAIT = { diver: 'fly', puffer: 'swim', splitter: 'float' };
// La Abeja Reina: cuánto espera arriba (menos si está enojada), cuánto apunta, qué tan rápido baja y cuánto se le
// queda atorado el aguijón. (Vuela más bajito que los demás: arriba no cabe con todo y corona.)
const DIVE = { y: 6.5 * T, waitMs: 1900, angryWaitMs: 1300, aimMs: 750, speed: 950, stuckMs: 2600, angryStuckMs: 1900 };
// El Pez Globo: nada, se infla (avisa), inflado avienta espinas, se desinfla.
const PUFF = { swimMs: 2800, inflateMs: 650, puffedMs: 2400, deflateMs: 500, big: 1.65, spikes: 8, spikeSpeed: 230 };
// La Gelatina: tamaño de cada pedazo (grande, mediana, chiquita), qué tan alto y cada cuánto brinca.
const JELLY = { scale: [1, 0.64, 0.42], hop: [880, 820, 760], waitMs: [1500, 1050, 800], push: 300, splitMs: 700 };

export class Boss {
  constructor(scene, key, x, y, arena) {
    this.scene = scene;
    this.key = key;
    this.type = BOSSES[key];
    this.arena = arena;
    this.maxHp = this.type.hp ?? BOSS_HP;
    Object.assign(this, { x, y, vx: 0, vy: 0, w: this.type.w, h: this.type.h, hp: this.maxHp, facing: -1, t: 0 });
    this.state = 'walk';
    this.stateMs = 0;
    this.stunMs = 0;
    this.attacks = 0;
    this.dead = false;
    // Su dibujo de Gemini o, si todavía no hay, el dibujado con canvas (los de la Isla de los jefes).
    this.art = scene.textures.exists(this.type.art) ? this.type.art : (drawnBoss(scene, key) ?? this.type.art);
    this.look = artImage(scene, this.art, this.type.size, { color: this.type.color });
    this.sprite = scene.add.container(x, y, [this.look]).setDepth(42);
    // Sus poses: camina, se agacha a cargar su ataque, se enoja con poca vida, se marea y queda aplastado.
    this.creature = platCreature(scene, this.look, this.art, this.type.size, GAIT[this.type.behavior]);
    this.hazards = [];
    const behavior = this.type.behavior;
    if (this.flying || behavior === 'diver') {
      this.y = behavior === 'diver' ? DIVE.y : FLY_Y;
      this.state = 'float';
    } else if (behavior === 'puffer') {
      // El pez nada a media arena (su centro).
      this.state = 'swim';
      this.puff = 1;
      this.cy = y - 3 * T;
      this.y = this.cy + this.h / 2;
    } else if (behavior === 'splitter') {
      this.state = 'hop';
      this.pieces = [this.makePiece(0, x, y, { main: true })];
    }
  }

  get flying() {
    return this.type.behavior === 'flyer';
  }

  get speed() {
    return this.type.speed * (1 + 0.3 * (this.maxHp - this.hp));
  }

  get angry() {
    return this.hp <= this.maxHp / 2;
  }

  // ¿Se le puede brincar encima ahorita? (A los que vuelan, solo cuando bajan a descansar; a la abeja, con el aguijón
  // atorado; al pez, desinflado.)
  get stompable() {
    if (this.dead || this.stunMs > 0) return false;
    const behavior = this.type.behavior;
    if (behavior === 'diver') return this.state === 'stuck';
    if (behavior === 'puffer') return this.state === 'swim';
    return !this.flying || this.state === 'rest';
  }

  // A qué se le puede brincar o pegar: a él mismo o (la gelatina) a cada uno de sus pedazos. Cada uno tiene x, y, w,
  // h; `harmless` = solo empuja (las gelatinas chiquitas).
  bodies() {
    return this.pieces ?? [this];
  }

  canStomp(body = this) {
    if (!this.pieces) return this.stompable;
    return !this.dead && body.invulnMs <= 0;
  }

  setState(state) {
    this.state = state;
    this.stateMs = 0;
  }

  update(dtMs, scene) {
    const dt = dtMs / 1000;
    this.t += dt;
    this.stateMs += dtMs;
    this.stunMs = Math.max(0, this.stunMs - dtMs);
    this.updateHazards(dtMs, scene);
    if (this.dead) {
      this.vy = Math.min(900, this.vy + GRAVITY * dt);
      this.y += this.vy * dt;
      this.sprite.setAngle(this.sprite.angle + 4);
      return;
    }
    const target = scene.nearestPlayer(this.x, this.y);
    const dir = target ? Math.sign(target.x - this.x) || this.facing : this.facing;
    const behavior = this.type.behavior;
    if (this.stunMs > 0) this.vx = 0;
    else if (behavior === 'jumper') this.updateJumper(scene, dir);
    else if (behavior === 'flyer') this.updateFlyer(dt, scene, target);
    else if (behavior === 'charger') this.updateCharger(scene, dir);
    else if (behavior === 'diver') this.updateDiver(dt, scene, target);
    else if (behavior === 'puffer') this.updatePuffer(dt, scene, target);
    else if (behavior === 'splitter') this.updateSplitter(dtMs, scene);
    else this.updateShooter(scene, dir);
    if (!FLOATERS.has(behavior) && !this.pieces) {
      this.vy = Math.min(1000, this.vy + GRAVITY * dt);
      const wasAir = !this.onGround;
      moveBody(scene.level, this, dt);
      if (this.onGround && wasAir) this.creature?.land(this.landShake ? 1.2 : 0.6);
      if (this.onGround && wasAir && this.landShake) {
        this.landShake = false;
        if (this.type.quake) scene.quake();
        else scene.cameras.main.shake(150, 0.006);
      }
    }
    this.x = Math.max(this.arena.left + this.w / 2, Math.min(this.arena.right - this.w / 2, this.x));
    if (Math.abs(this.vx) > 1) this.facing = Math.sign(this.vx);
  }

  updateJumper(scene, dir) {
    if (this.state === 'walk') {
      this.vx = dir * this.speed;
      if (this.stateMs > 2200 && this.onGround) {
        this.setState('jump');
        this.vy = -1100;
        this.vx = dir * this.speed * 1.6;
        this.landShake = true;
        sfx.jump();
      }
    } else if (this.state === 'jump' && this.onGround && this.stateMs > 200) {
      this.attacks += 1;
      if (this.type.minion && this.attacks % 2 === 0) {
        for (const side of [-1, 1]) scene.spawnEnemy(this.type.minion, this.x + side * 90, this.y - 10);
        scene.say(`¡Vengan, ayudantes!`);
      }
      this.setState('walk');
    }
  }

  updateFlyer(dt, scene, target) {
    if (this.state === 'float') {
      const goal = target ? target.x : this.x;
      this.vx += Math.sign(goal - this.x) * 600 * dt;
      this.vx = Math.max(-this.speed, Math.min(this.speed, this.vx));
      this.x += this.vx * dt;
      this.y = FLY_Y + Math.sin(this.t * 2) * 14;
      if (this.stateMs > 1600) {
        this.attacks += 1;
        // Rayos: uno donde está alguien y otro cerquita. Avisan con una línea que parpadea.
        if (this.type.bolts) {
          const x1 = target ? target.x : this.x;
          for (const x of [x1, x1 + (Math.random() < 0.5 ? -1 : 1) * T * 3]) this.hazards.push({ kind: 'bolt', x, ms: 0 });
        }
        this.setState(this.attacks % (this.type.bolts ? 3 : 2) === 0 ? 'down' : 'float');
      }
    } else if (this.state === 'down') {
      this.vx = 0;
      // (El piso de abajo de él: buscando desde arriba se encontraba el techo del castillo y nunca bajaba.)
      const ground = scene.groundY(this.x, this.y);
      this.y = Math.min(ground - 4, this.y + 360 * dt);
      if (this.y >= ground - 4) this.setState('rest');
    } else if (this.state === 'rest') {
      if (this.stateMs > 2200) this.setState('up');
    } else if (this.state === 'up') {
      this.y = Math.max(FLY_Y, this.y - 300 * dt);
      if (this.y <= FLY_Y) this.setState('float');
    }
  }

  updateCharger(scene, dir) {
    if (this.state === 'walk') {
      this.vx = Math.sin(this.t * 2) * this.speed * 0.6;
      if (this.stateMs > 2000) {
        this.setState('charge');
        this.chargeDir = dir;
        sfx.special();
      }
    } else if (this.state === 'charge') {
      this.vx = this.chargeDir * this.speed * 3.2;
      const atWall = this.chargeDir > 0 ? this.x >= this.arena.right - this.w / 2 - 2 : this.x <= this.arena.left + this.w / 2 + 2;
      if (atWall || this.hitWall) {
        scene.cameras.main.shake(200, 0.01);
        sfx.boom();
        this.stunMs = STUN_MS;
        this.setState('walk');
        if (this.onGround) this.vy = -500;
      }
    }
  }

  updateShooter(scene, dir) {
    if (this.state === 'walk') {
      this.vx = dir * this.speed * 0.6;
      if (this.stateMs > 1800) this.setState('shoot');
    } else if (this.state === 'shoot') {
      this.vx = 0;
      this.facing = dir;
      const shots = Math.floor(this.stateMs / 450);
      if (shots > (this.shots ?? -1) && shots < 3) {
        this.shots = shots;
        const high = shots % 2 === 1;
        this.hazards.push({ kind: 'ball', look: this.type.shot ?? 'fire', x: this.x + dir * this.w * 0.5, y: this.y - (high ? this.h * 0.8 : this.h * 0.35), vx: dir * 380, ms: 0 });
        sfx.fire();
      }
      if (this.stateMs > 1500) {
        this.shots = -1;
        this.setState('jump');
        if (this.onGround) this.vy = -950;
        this.landShake = true;
        this.vx = dir * this.speed;
      }
    } else if (this.state === 'jump' && this.onGround && this.stateMs > 300) {
      this.setState('walk');
    }
  }

  // La Abeja Reina: arriba sigue de lejos a alguien; apunta (una sombra en el piso avisa dónde va a caer), se lanza en
  // picada y se le atora el aguijón un ratito.
  updateDiver(dt, scene, target) {
    const state = this.state;
    if (state === 'float') {
      const goal = target ? target.x : this.x;
      this.vx += Math.sign(goal - this.x) * 500 * dt;
      this.vx = Math.max(-this.speed * 0.6, Math.min(this.speed * 0.6, this.vx));
      this.x += this.vx * dt;
      this.y = DIVE.y + Math.sin(this.t * 3) * 12;
      if (target && this.stateMs > (this.angry ? DIVE.angryWaitMs : DIVE.waitMs)) {
        const x = Math.max(this.arena.left + this.w / 2, Math.min(this.arena.right - this.w / 2, target.x));
        this.diveTo = { x, y: scene.groundY(x, DIVE.y + T) };
        this.marker?.destroy();
        this.marker = scene.add.ellipse(x, this.diveTo.y - 4, this.w * 0.9, 22, 0x1b1530, 0.35).setDepth(41);
        this.setState('aim');
        sfx.special();
      }
    } else if (state === 'aim') {
      this.vx = 0;
      this.marker?.setAlpha(Math.floor(this.stateMs / 110) % 2 ? 0.55 : 0.2);
      if (this.stateMs > DIVE.aimMs) {
        this.setState('dive');
        sfx.throw();
      }
    } else if (state === 'dive') {
      const dx = this.diveTo.x - this.x;
      const dy = this.diveTo.y - this.y;
      const d = Math.hypot(dx, dy);
      const step = DIVE.speed * dt;
      if (Math.abs(dx) > 2) this.facing = Math.sign(dx);
      if (d <= step) {
        Object.assign(this, { x: this.diveTo.x, y: this.diveTo.y, vx: 0 });
        this.marker?.destroy();
        this.marker = null;
        this.setState('stuck');
        scene.cameras.main.shake(180, 0.008);
        sfx.boom();
        burst(scene, this.x, this.y - 6, 0xc9a26b, 10);
        this.creature?.land(1.2);
      } else {
        this.x += (dx / d) * step;
        this.y += (dy / d) * step;
      }
    } else if (state === 'stuck') {
      if (this.stateMs > (this.angry ? DIVE.angryStuckMs : DIVE.stuckMs)) this.setState('up');
    } else if (state === 'up') {
      this.y = Math.max(DIVE.y, this.y - 320 * dt);
      if (this.y <= DIVE.y) this.setState('float');
    }
  }

  // El Pez Globo: nada hacia alguien; se infla (avisa temblando), inflado avienta espinas para todos lados y luego se
  // desinfla. Su caja crece y se encoge con él (cy = su centro).
  updatePuffer(dt, scene, target) {
    const state = this.state;
    const ms = this.stateMs;
    if (state === 'swim') {
      this.puff = 1;
      const tx = target ? target.x : this.x;
      const ty = target ? target.y - target.h / 2 : this.cy;
      const speed = this.speed * (this.angry ? 1.4 : 1);
      this.vx = approach(this.vx, Math.sign(tx - this.x) * speed, 300 * dt);
      this.vy = approach(this.vy, Math.abs(ty - this.cy) > 20 ? Math.sign(ty - this.cy) * speed * 0.7 : 0, 300 * dt);
      if (ms > PUFF.swimMs * (this.angry ? 0.7 : 1)) {
        this.setState('inflate');
        sfx.special();
      }
    } else if (state === 'inflate') {
      this.puff = 1 + (PUFF.big - 1) * Math.min(1, ms / PUFF.inflateMs);
      this.vx *= 0.9;
      this.vy *= 0.9;
      if (ms > PUFF.inflateMs) {
        this.setState('puffed');
        this.shootSpikes(scene);
      }
    } else if (state === 'puffed') {
      this.puff = PUFF.big;
      this.vx *= 0.97;
      this.vy *= 0.97;
      if (this.angry && ms > PUFF.puffedMs / 2 && !this.shotTwice) {
        this.shotTwice = true;
        this.shootSpikes(scene, Math.PI / PUFF.spikes);
      }
      if (ms > PUFF.puffedMs) {
        this.shotTwice = false;
        this.setState('deflate');
      }
    } else if (state === 'deflate') {
      this.puff = PUFF.big - (PUFF.big - 1) * Math.min(1, ms / PUFF.deflateMs);
      if (ms > PUFF.deflateMs) this.setState('swim');
    }
    this.w = this.type.w * this.puff;
    this.h = this.type.h * this.puff;
    this.x += this.vx * dt;
    this.cy += this.vy * dt;
    // Ni en el techo ni en el piso de la arena.
    const top = 4 * T + this.h / 2 + 8;
    const floor = scene.groundY(this.x, this.cy) - this.h / 2 - 4;
    this.cy = Math.max(top, Math.min(floor, this.cy));
    this.y = this.cy + this.h / 2;
  }

  shootSpikes(scene, offset = 0) {
    for (let i = 0; i < PUFF.spikes; i += 1) {
      const a = offset + (i / PUFF.spikes) * Math.PI * 2;
      const r = this.w / 2;
      this.hazards.push({ kind: 'ball', look: 'spike', r: 12, x: this.x + Math.cos(a) * r, y: this.cy + Math.sin(a) * r, vx: Math.cos(a) * PUFF.spikeSpeed, vy: Math.sin(a) * PUFF.spikeSpeed, ms: 0 });
    }
    sfx.fire();
    scene.cameras.main.shake(120, 0.005);
  }

  // La Gelatina: cada pedazo brinca hacia el jugador más cercano (los chiquitos más seguido y más rápido) y rebota en
  // las paredes de la arena.
  updateSplitter(dtMs, scene) {
    const dt = dtMs / 1000;
    for (const piece of this.pieces) {
      piece.invulnMs = Math.max(0, piece.invulnMs - dtMs);
      piece.squash = Math.max(0, piece.squash - dt * 5);
      piece.waitMs -= dtMs;
      if (piece.onGround) {
        piece.vx *= Math.max(0, 1 - 10 * dt);
        if (piece.waitMs <= 0) {
          const target = scene.nearestPlayer(piece.x, piece.y);
          const dir = target ? Math.sign(target.x - piece.x) || 1 : Math.random() < 0.5 ? -1 : 1;
          piece.vy = -JELLY.hop[piece.tier];
          piece.vx = dir * this.type.speed * (1 + piece.tier * 0.45) * (this.angry ? 1.25 : 1);
          piece.waitMs = JELLY.waitMs[piece.tier] * (0.8 + Math.random() * 0.4);
          piece.facing = dir;
          if (piece.tier === 0) sfx.jump();
        }
      }
      piece.vy = Math.min(1000, piece.vy + GRAVITY * dt);
      const wasAir = !piece.onGround;
      moveBody(scene.level, piece, dt);
      if (piece.hitWall) piece.vx = -piece.vx * 0.6;
      piece.x = Math.max(this.arena.left + piece.w / 2, Math.min(this.arena.right - piece.w / 2, piece.x));
      if (piece.onGround && wasAir) {
        piece.squash = 1;
        if (piece.main) this.creature?.land(1);
        if (piece.tier === 0) scene.cameras.main.shake(120, 0.005);
      }
    }
    const lead = this.pieces[0];
    if (lead) Object.assign(this, { x: lead.x, y: lead.y, w: lead.w, h: lead.h, vx: lead.vx });
  }

  // Un pedazo de gelatina (tier 0 = la grande, que es el dibujo principal con sus poses).
  makePiece(tier, x, y, { vx = 0, vy = 0, main = false } = {}) {
    const k = JELLY.scale[tier];
    const piece = { tier, x, y, vx, vy, w: this.type.w * k, h: this.type.h * k, onGround: false, waitMs: JELLY.waitMs[tier], invulnMs: main ? 0 : JELLY.splitMs };
    Object.assign(piece, { chip: 0, facing: vx < 0 ? -1 : 1, main, harmless: tier === JELLY.scale.length - 1, squash: 0, t: Math.random() * 6 });
    if (main) {
      piece.sprite = this.sprite;
      piece.look = this.look;
    } else {
      piece.look = artImage(this.scene, this.art, this.type.size * k, { color: this.type.color });
      piece.sprite = this.scene.add.container(x, y, [piece.look]).setDepth(42);
    }
    return piece;
  }

  // Pisaron (o le pegaron bastante a) un pedazo: se parte en dos más chiquitos (o el chiquito se revienta). Devuelve
  // true si ya no queda ninguno.
  splitPiece(piece) {
    this.hp = Math.max(0, this.hp - 1);
    this.pieces = this.pieces.filter((p) => p !== piece);
    if (piece.main) this.sprite.setVisible(false);
    else piece.sprite.destroy();
    burst(this.scene, piece.x, piece.y - piece.h / 2, this.type.color, piece.tier === 2 ? 10 : 16);
    sfx.hit(1);
    if (piece.tier < JELLY.scale.length - 1) {
      for (const side of [-1, 1]) this.pieces.push(this.makePiece(piece.tier + 1, piece.x + side * piece.w * 0.25, piece.y - 4, { vx: side * 280, vy: -640 }));
    }
    if (this.pieces.length) return false;
    Object.assign(this, { x: piece.x, y: piece.y, dead: true, vy: -600 });
    sfx.ko();
    return true;
  }

  // Rayos y bolas del jefe.
  updateHazards(dtMs, scene) {
    const dt = dtMs / 1000;
    this.hazards = this.hazards.filter((hz) => {
      hz.ms += dtMs;
      if (hz.kind === 'bolt') {
        if (!hz.sprite) hz.sprite = scene.add.rectangle(hz.x, 0, 14, scene.level.height, this.type.bolts, 0.3).setOrigin(0.5, 0).setDepth(44);
        const striking = hz.ms > 1100;
        hz.sprite.setAlpha(striking ? 1 : Math.floor(hz.ms / 120) % 2 ? 0.35 : 0.1).setSize(striking ? 40 : 14, scene.level.height);
        if (striking && !hz.boomed) {
          hz.boomed = true;
          sfx.laser();
          scene.cameras.main.flash(80, 255, 255, 200);
        }
        if (striking) for (const p of scene.players) if (p.active && Math.abs(p.x - hz.x) < 26 + p.w / 2 && p.hurt()) this.taunt();
        if (hz.ms > 1500) {
          hz.sprite.destroy();
          return false;
        }
        return true;
      }
      const [core, edge] = SHOTS[hz.look] ?? SHOTS.fire;
      const r = hz.r ?? 18;
      if (!hz.sprite) hz.sprite = scene.add.circle(hz.x, hz.y, r, core).setStrokeStyle(5, edge).setDepth(44);
      hz.x += hz.vx * dt;
      hz.y += (hz.vy ?? 0) * dt;
      hz.sprite.setPosition(hz.x, hz.y + Math.sin(hz.ms / 60) * 3);
      for (const p of scene.players) if (p.active && Math.abs(p.x - hz.x) < r + p.w / 2 && hz.y > p.y - p.h && hz.y < p.y && p.hurt()) this.taunt();
      if (hz.x < this.arena.left - 40 || hz.x > this.arena.right + 40 || hz.y < -40 || hz.y > scene.level.height + 40) {
        hz.sprite.destroy();
        return false;
      }
      return true;
    });
  }

  // Le brincaron encima (a él o, a la gelatina, a uno de sus pedazos). Devuelve true si se acabó.
  stomped(body = this) {
    if (this.pieces) return this.splitPiece(body === this ? this.pieces[0] : body);
    return this.damage(1);
  }

  // Bola de fuego o de hielo: le baja un poquito (a un pedazo de gelatina, con 3 se parte).
  fireHit(body = this) {
    if (this.pieces) {
      const piece = body === this ? this.pieces[0] : body;
      if (this.dead || !piece || piece.invulnMs > 0) return false;
      piece.chip += 0.34;
      piece.look.setTint?.(0xff8a8a);
      this.scene.time.delayedCall(160, () => piece.look.clearTint?.());
      return piece.chip >= 1 ? this.splitPiece(piece) : false;
    }
    return this.damage(CHIP);
  }

  // Le pegó a un jugador: se carcajea.
  taunt(ms = 1100) {
    this.creature?.taunt(ms);
  }

  // Qué está haciendo, para su pose (ver ui/creature.js): antes de cada ataque se agacha a cargarlo.
  creaturePose() {
    if (this.dead) return 'derrotado';
    if (this.stunMs > 0) return 'mareado';
    const { behavior } = this.type;
    const state = this.state;
    if (behavior === 'jumper') return state === 'jump' ? 'ataque' : this.stateMs > 1800 ? 'cargando' : 'caminar';
    if (behavior === 'charger') return state === 'charge' ? 'ataque' : this.stateMs > 1500 ? 'cargando' : 'caminar';
    if (behavior === 'flyer') {
      if (state === 'rest') return 'mareado';
      if (this.hazards.some((hz) => hz.kind === 'bolt' && hz.ms < 1100)) return 'cargando';
      return state === 'float' ? 'caminar' : 'normal';
    }
    if (behavior === 'diver') return { aim: 'cargando', dive: 'ataque', stuck: 'mareado', float: 'caminar' }[state] ?? 'normal';
    if (behavior === 'puffer') return { inflate: 'cargando', puffed: 'ataque', swim: 'caminar' }[state] ?? 'normal';
    if (behavior === 'splitter') {
      const lead = this.pieces?.[0];
      return lead?.main && lead.onGround && lead.waitMs < 350 ? 'cargando' : 'normal';
    }
    if (state === 'shoot') return this.stateMs < 350 ? 'cargando' : 'ataque';
    return state === 'jump' ? 'ataque' : 'caminar';
  }

  damage(amount) {
    if (this.dead || this.stunMs > 0) return false;
    this.hp -= amount;
    this.creature?.hurt(amount >= 1 ? 450 : 250);
    this.look.setTint?.(0xff8a8a);
    this.scene.time.delayedCall(160, () => this.look.clearTint?.());
    if (amount >= 1) {
      this.stunMs = STUN_MS;
      sfx.hit(1);
      if (this.flying || this.type.behavior === 'diver') this.setState('up');
      // El pez se enoja y se infla.
      else if (this.type.behavior === 'puffer') this.setState('inflate');
    }
    if (this.hp > 0.001) return false;
    this.dead = true;
    this.vy = -600;
    for (const hz of this.hazards) hz.sprite?.destroy();
    this.hazards = [];
    this.marker?.destroy();
    this.marker = null;
    sfx.ko();
    return true;
  }

  render() {
    if (this.pieces) {
      this.renderPieces();
      return;
    }
    const flip = (this.type.facesLeft ? -1 : 1) * this.facing;
    // (El pez inflado se ve más grande.)
    const k = this.puff ?? 1;
    this.sprite.setPosition(this.x, this.y).setScale(flip * k, k);
    const stunned = this.stunMs > 0 && Math.floor(this.stunMs / 100) % 2 === 0;
    this.sprite.setAlpha(stunned ? 0.5 : 1);
    if (!this.dead) this.look.setAngle(this.state === 'charge' || this.state === 'aim' ? Math.sin(this.t * 30) * 4 : Math.sin(this.t * 6) * 2);
    this.updateCreature();
  }

  updateCreature() {
    if (!this.creature) return;
    // Con poca vida, enojado.
    this.creature.angry = this.angry;
    this.creature.set(this.creaturePose());
    this.creature.update();
  }

  // Los pedazos de gelatina: tiemblan, se aplastan al caer y parpadean un ratito al partirse.
  renderPieces() {
    for (const piece of this.pieces) {
      const wobble = Math.sin(this.t * 3 + piece.t) * 0.04;
      const squash = piece.squash * 0.28;
      piece.sprite.setPosition(piece.x, piece.y).setScale(piece.facing * (1 + squash - wobble), 1 - squash + wobble);
      piece.sprite.setAlpha(piece.invulnMs > 0 && Math.floor(piece.invulnMs / 90) % 2 ? 0.5 : 1);
    }
    if (this.pieces[0]?.main) this.updateCreature();
  }

  destroy() {
    this.sprite.destroy();
    for (const piece of this.pieces ?? []) if (!piece.main) piece.sprite.destroy();
    for (const hz of this.hazards) hz.sprite?.destroy();
    this.marker?.destroy();
  }
}

function approach(value, target, step) {
  if (value < target) return Math.min(target, value + step);
  return Math.max(target, value - step);
}
