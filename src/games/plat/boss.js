import { sfx } from '../../shared/sound.js';
import { artImage } from './art.js';
import { moveBody } from './physics.js';
import { T } from './tiles.js';

// Los jefes de Súper Bolitas: al final de cada mundo, en su arena. Se les brinca encima 3 veces (cada vez se
// enojan y van más rápido); las bolas de fuego también les bajan un poquito. Cada uno tiene su truco:
//   Rey Hongo: salta y al caer hace temblar el piso (si estás en el piso te quedas mareado) y llama hongos malos.
//   Rey Nube: vuela arriba y lanza rayos (avisan antes); luego baja a descansar: ¡ahí se le brinca!
//   Rey Cangrejo: se lanza corriendo de lado a lado; al chocar con la pared queda mareado.
//   Rey Dragón: salta y lanza bolas de fuego (unas arriba y otras abajo).
export const BOSSES = {
  reyHongo: { name: 'el Rey Hongo', art: 'plat:rey-hongo', size: 150, w: 110, h: 130, speed: 90, color: 0x9c6b3c },
  reyNube: { name: 'el Rey Nube', art: 'plat:rey-nube', size: 130, w: 150, h: 100, speed: 140, flying: true, color: 0x9a9aae },
  reyCangrejo: { name: 'el Rey Cangrejo', art: 'plat:rey-cangrejo', size: 120, w: 160, h: 96, speed: 120, color: 0xff5a5f },
  reyDragon: { name: 'el Rey Dragón', art: 'plat:rey-dragon', size: 160, w: 120, h: 140, speed: 100, facesLeft: true, color: 0x4cd97b },
};
export const BOSS_HP = 3;
const STUN_MS = 1300;
const GRAVITY = 2200;
const FIRE_CHIP = 0.25;
// Dónde flota el Rey Nube (sus pies).
const CLOUD_Y = 4.6 * T;

export class Boss {
  constructor(scene, key, x, y, arena) {
    this.scene = scene;
    this.key = key;
    this.type = BOSSES[key];
    this.arena = arena;
    Object.assign(this, { x, y, vx: 0, vy: 0, w: this.type.w, h: this.type.h, hp: BOSS_HP, facing: -1, t: 0 });
    this.state = 'walk';
    this.stateMs = 0;
    this.stunMs = 0;
    this.attacks = 0;
    this.dead = false;
    this.look = artImage(scene, this.type.art, this.type.size, { color: this.type.color });
    this.sprite = scene.add.container(x, y, [this.look]).setDepth(42);
    this.hazards = [];
    if (this.type.flying) {
      this.y = CLOUD_Y;
      this.state = 'float';
    }
  }

  get speed() {
    return this.type.speed * (1 + 0.3 * (BOSS_HP - this.hp));
  }

  // ¿Se le puede brincar encima ahorita? (Al Rey Nube solo cuando baja.)
  get stompable() {
    if (this.dead || this.stunMs > 0) return false;
    return !this.type.flying || this.state === 'rest';
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
    if (this.stunMs > 0) {
      this.vx = 0;
    } else if (this.key === 'reyHongo') {
      this.updateHongo(dt, scene, dir);
    } else if (this.key === 'reyNube') {
      this.updateNube(dt, scene, target);
    } else if (this.key === 'reyCangrejo') {
      this.updateCangrejo(dt, scene, dir);
    } else {
      this.updateDragon(dt, scene, dir);
    }
    if (!this.type.flying) {
      this.vy = Math.min(1000, this.vy + GRAVITY * dt);
      const wasAir = !this.onGround;
      moveBody(scene.level, this, dt);
      if (this.onGround && wasAir && this.landShake) {
        this.landShake = false;
        scene.quake();
      }
    }
    this.x = Math.max(this.arena.left + this.w / 2, Math.min(this.arena.right - this.w / 2, this.x));
    if (Math.abs(this.vx) > 1) this.facing = Math.sign(this.vx);
  }

  updateHongo(dt, scene, dir) {
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
      if (this.attacks % 2 === 0) {
        for (const side of [-1, 1]) scene.spawnEnemy('g', this.x + side * 90, this.y - 10);
        scene.say('¡Vengan, hongos!');
      }
      this.setState('walk');
    }
  }

  updateNube(dt, scene, target) {
    if (this.state === 'float') {
      const goal = target ? target.x : this.x;
      this.vx += Math.sign(goal - this.x) * 600 * dt;
      this.vx = Math.max(-this.speed, Math.min(this.speed, this.vx));
      this.x += this.vx * dt;
      this.y = CLOUD_Y + Math.sin(this.t * 2) * 14;
      if (this.stateMs > 1600) {
        this.attacks += 1;
        // Dos rayos: uno donde está alguien y otro cerquita. Avisan con una línea que parpadea.
        const x1 = target ? target.x : this.x;
        for (const x of [x1, x1 + (Math.random() < 0.5 ? -1 : 1) * T * 3]) this.hazards.push({ kind: 'bolt', x, ms: 0 });
        this.setState(this.attacks % 3 === 0 ? 'down' : 'float');
      }
    } else if (this.state === 'down') {
      this.vx = 0;
      this.y = Math.min(scene.groundY(this.x) - 4, this.y + 360 * dt);
      if (this.y >= scene.groundY(this.x) - 4) this.setState('rest');
    } else if (this.state === 'rest') {
      if (this.stateMs > 2200) this.setState('up');
    } else if (this.state === 'up') {
      this.y = Math.max(CLOUD_Y, this.y - 300 * dt);
      if (this.y <= CLOUD_Y) this.setState('float');
    }
  }

  updateCangrejo(dt, scene, dir) {
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

  updateDragon(dt, scene, dir) {
    if (this.state === 'walk') {
      this.vx = dir * this.speed * 0.6;
      if (this.stateMs > 1800) this.setState('fire');
    } else if (this.state === 'fire') {
      this.vx = 0;
      this.facing = dir;
      const shots = Math.floor(this.stateMs / 450);
      if (shots > (this.shots ?? -1) && shots < 3) {
        this.shots = shots;
        const high = shots % 2 === 1;
        this.hazards.push({ kind: 'fire', x: this.x + dir * this.w * 0.5, y: this.y - (high ? this.h * 0.8 : this.h * 0.35), vx: dir * 380, ms: 0 });
        sfx.fire();
      }
      if (this.stateMs > 1500) {
        this.shots = -1;
        this.setState('jump');
        if (this.onGround) this.vy = -950;
        this.vx = dir * this.speed;
      }
    } else if (this.state === 'jump' && this.onGround && this.stateMs > 300) {
      this.setState('walk');
    }
  }

  // Rayos y bolas de fuego del jefe.
  updateHazards(dtMs, scene) {
    const dt = dtMs / 1000;
    this.hazards = this.hazards.filter((hz) => {
      hz.ms += dtMs;
      if (hz.kind === 'bolt') {
        if (!hz.sprite) hz.sprite = scene.add.rectangle(hz.x, 0, 14, scene.level.height, 0xffe14d, 0.3).setOrigin(0.5, 0).setDepth(44);
        const striking = hz.ms > 1100;
        hz.sprite.setAlpha(striking ? 1 : Math.floor(hz.ms / 120) % 2 ? 0.35 : 0.1).setSize(striking ? 40 : 14, scene.level.height);
        if (striking && !hz.boomed) {
          hz.boomed = true;
          sfx.laser();
          scene.cameras.main.flash(80, 255, 255, 200);
        }
        if (striking) for (const p of scene.players) if (p.active && Math.abs(p.x - hz.x) < 26 + p.w / 2) p.hurt();
        if (hz.ms > 1500) {
          hz.sprite.destroy();
          return false;
        }
        return true;
      }
      if (!hz.sprite) hz.sprite = scene.add.circle(hz.x, hz.y, 18, 0xff7a1f).setStrokeStyle(5, 0xffd84d).setDepth(44);
      hz.x += hz.vx * dt;
      hz.sprite.setPosition(hz.x, hz.y + Math.sin(hz.ms / 60) * 3);
      for (const p of scene.players) if (p.active && Math.abs(p.x - hz.x) < 18 + p.w / 2 && hz.y > p.y - p.h && hz.y < p.y) p.hurt();
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

  fireHit() {
    return this.damage(FIRE_CHIP);
  }

  damage(amount) {
    if (this.dead || this.stunMs > 0) return false;
    this.hp -= amount;
    this.look.setTint?.(0xff8a8a);
    this.scene.time.delayedCall(160, () => this.look.clearTint?.());
    if (amount >= 1) {
      this.stunMs = STUN_MS;
      sfx.hit(1);
      if (this.type.flying) this.setState('up');
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
  }

  destroy() {
    this.sprite.destroy();
    for (const hz of this.hazards) hz.sprite?.destroy();
  }
}
