import { sfx } from '../../shared/sound.js';
import { artImage, platCreature } from './art.js';
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
export const BOSSES = {
  reyHongo: { name: 'el Rey Hongo', art: 'plat:rey-hongo', size: 150, w: 110, h: 130, speed: 90, behavior: 'jumper', quake: true, minion: 'g', color: 0x9c6b3c },
  reyNube: { name: 'el Rey Nube', art: 'plat:rey-nube', size: 130, w: 150, h: 100, speed: 140, behavior: 'flyer', bolts: 0xffe14d, color: 0x9a9aae },
  reyCangrejo: { name: 'el Rey Cangrejo', art: 'plat:rey-cangrejo', size: 120, w: 160, h: 96, speed: 120, behavior: 'charger', color: 0xff5a5f },
  reyDragon: { name: 'el Rey Dragón', art: 'plat:rey-dragon', size: 160, w: 120, h: 140, speed: 100, behavior: 'shooter', shot: 'fire', facesLeft: true, color: 0x4cd97b },
  reyYeti: { name: 'el Rey Yeti', art: 'plat:gran-yeti', size: 170, w: 120, h: 150, speed: 95, behavior: 'shooter', shot: 'snow', quake: true, color: 0xffffff },
  reyPastel: { name: 'el Rey Pastel', art: 'plat:rey-pastel', size: 170, w: 130, h: 150, speed: 85, behavior: 'jumper', minion: 'W', color: 0xff9ec7 },
  reyCalabaza: { name: 'el Rey Calabaza', art: 'plat:rey-calabaza', size: 150, w: 140, h: 120, speed: 130, behavior: 'flyer', bolts: 0xb07cff, color: 0xff9a3c },
  // Mini jefes (en el fuerte de cada mundo).
  granTortuga: { name: 'la Gran Tortuga', art: 'plat:tortuga', size: 116, w: 80, h: 100, speed: 100, behavior: 'charger', hp: 2, mini: true, color: 0x4cd97b },
  granPajaro: { name: 'el Gran Pájaro', art: 'plat:pajaro', size: 100, w: 110, h: 76, speed: 170, behavior: 'flyer', hp: 2, mini: true, color: 0x3fa7ff },
  pulpo: { name: 'el Capitán Pulpo', art: 'plat:capitan-pulpo', size: 130, w: 100, h: 116, speed: 80, behavior: 'shooter', shot: 'ink', hp: 2, mini: true, color: 0xb07cff },
  granBola: { name: 'la Gran Bola de Fuego', art: 'plat:bola-fuego', size: 100, w: 84, h: 84, speed: 120, behavior: 'jumper', hp: 2, mini: true, color: 0xff9a3c },
  granPinguino: { name: 'el Gran Pingüino', art: 'plat:pinguino', size: 116, w: 84, h: 104, speed: 110, behavior: 'charger', hp: 2, mini: true, color: 0x2a3a7a },
  granGalleta: { name: 'la Gran Galleta', art: 'plat:galleta', size: 124, w: 86, h: 114, speed: 90, behavior: 'jumper', minion: 'J', hp: 2, mini: true, color: 0xc98a5a },
  granFantasma: { name: 'el Gran Fantasma', art: 'plat:fantasma', size: 120, w: 110, h: 100, speed: 120, behavior: 'flyer', hp: 2, mini: true, color: 0xffffff },
};
export const BOSS_HP = 3;
const STUN_MS = 1300;
const GRAVITY = 2200;
const CHIP = 0.25;
// Dónde flotan los que vuelan (sus pies).
const FLY_Y = 4.6 * T;
const SHOTS = { fire: [0xff7a1f, 0xffd84d], snow: [0xffffff, 0x9fd8ff], ink: [0x3a2a5a, 0x8158d8] };

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
    this.look = artImage(scene, this.type.art, this.type.size, { color: this.type.color });
    this.sprite = scene.add.container(x, y, [this.look]).setDepth(42);
    // Sus poses: camina, se agacha a cargar su ataque, se enoja con poca vida, se marea y queda aplastado.
    this.creature = platCreature(scene, this.look, this.type.art, this.type.size);
    this.hazards = [];
    if (this.flying) {
      this.y = FLY_Y;
      this.state = 'float';
    }
  }

  get flying() {
    return this.type.behavior === 'flyer';
  }

  get speed() {
    return this.type.speed * (1 + 0.3 * (this.maxHp - this.hp));
  }

  // ¿Se le puede brincar encima ahorita? (A los que vuelan, solo cuando bajan a descansar.)
  get stompable() {
    if (this.dead || this.stunMs > 0) return false;
    return !this.flying || this.state === 'rest';
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
    else this.updateShooter(scene, dir);
    if (!this.flying) {
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
      if (!hz.sprite) hz.sprite = scene.add.circle(hz.x, hz.y, 18, core).setStrokeStyle(5, edge).setDepth(44);
      hz.x += hz.vx * dt;
      hz.sprite.setPosition(hz.x, hz.y + Math.sin(hz.ms / 60) * 3);
      for (const p of scene.players) if (p.active && Math.abs(p.x - hz.x) < 18 + p.w / 2 && hz.y > p.y - p.h && hz.y < p.y && p.hurt()) this.taunt();
      if (hz.x < this.arena.left - 40 || hz.x > this.arena.right + 40) {
        hz.sprite.destroy();
        return false;
      }
      return true;
    });
  }

  // Le brincaron encima. Devuelve true si se acabó.
  stomped() {
    return this.damage(1);
  }

  // Bola de fuego o de hielo: le baja un poquito.
  fireHit() {
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
      if (this.flying) this.setState('up');
    }
    if (this.hp > 0.001) return false;
    this.dead = true;
    this.vy = -600;
    for (const hz of this.hazards) hz.sprite?.destroy();
    this.hazards = [];
    sfx.ko();
    return true;
  }

  render() {
    const flip = (this.type.facesLeft ? -1 : 1) * this.facing;
    this.sprite.setPosition(this.x, this.y).setScale(flip, 1);
    const stunned = this.stunMs > 0 && Math.floor(this.stunMs / 100) % 2 === 0;
    this.sprite.setAlpha(stunned ? 0.5 : 1);
    if (!this.dead) this.look.setAngle(this.state === 'charge' ? Math.sin(this.t * 30) * 4 : Math.sin(this.t * 6) * 2);
    if (this.creature) {
      // Con poca vida, enojado.
      this.creature.angry = this.hp <= this.maxHp / 2;
      this.creature.set(this.creaturePose());
      this.creature.update();
    }
  }

  destroy() {
    this.sprite.destroy();
    for (const hz of this.hazards) hz.sprite?.destroy();
  }
}
