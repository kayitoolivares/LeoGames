import Phaser from 'phaser';
import { players } from '../../shared/players.js';
import { Blob } from '../../ui/Blob.js';
import { CharacterLook } from '../../ui/CharacterLook.js';
import { hexToCss, textStyle } from '../../ui/style.js';
import { B, BLOCKS, CREATIVE_ORDER, T } from './blocks.js';
import { moveBody, solidFor, stuck, touches } from './physics.js';

// Un jugador del Mundo de bloques: su personaje de Bolitas Bros con un aro de su color en los pies, su cuerpo (para
// chocar con los bloques) y lo que lleva (cuántos de cada bloque; en Creativo, de todos sin fin).
// Camina, brinca (sube solito un escalón), nada, sube escaleras y, en Creativo, vuela (A dos veces).
const RADIUS = 24;
export const BODY = { w: 30, h: 76 };
const WALK = 240;
const ACCEL = { ground: 2000, air: 1400 };
const FRICTION = 2600;
const GRAVITY = 2400;
const JUMP = 660;
const STEP_HOP = 540;
const MAX_FALL = 980;
const COYOTE_MS = 110;
const BUFFER_MS = 130;
const SWIM = { gravity: 520, maxFall: 160, up: 300, speed: 160 };
const CLIMB = 210;
const FLY = 330;
const DOUBLE_TAP_MS = 320;
// Caer desde más alto que esto (en Aventura) quita un corazón.
const FALL_HURT = 7 * T;
export const MAX_HEARTS = 5;
export const INVULN_MS = 1500;
const REGEN_MS = 12000;

export class BlockPlayer {
  constructor(scene, player, character, { creative }) {
    this.scene = scene;
    this.player = player;
    this.deviceId = player.deviceId;
    this.slot = player.slot;
    this.label = `J${player.slot + 1}`;
    this.color = players.color(player).hex;
    this.character = character;
    this.creative = creative;
    this.w = BODY.w;
    this.h = BODY.h;
    this.x = 0;
    this.y = 0;
    this.vx = 0;
    this.vy = 0;
    this.facing = 1;
    this.onGround = false;
    this.coyoteMs = 0;
    this.bufferMs = 0;
    this.lastJumpTap = -1e9;
    this.flying = false;
    this.swimming = false;
    this.climbing = false;
    this.peakY = null;
    this.hearts = MAX_HEARTS;
    this.invulnMs = 0;
    this.regenMs = 0;
    this.walking = false;
    // Lo que lleva: cuántos de cada bloque, y en qué orden salen en su barrita.
    this.inv = new Map();
    this.order = creative ? [...CREATIVE_ORDER] : [];
    this.sel = 0;
    this.digMs = 0;
    this.digCell = null;
    this.menu = null;

    this.sprite = new Blob(scene, 0, 0, this.color, RADIUS).setDepth(50);
    // El aro de su color en los pies (va antes del personaje, para que quede detrás).
    this.ring = scene.add
      .ellipse(0, RADIUS * 0.95, RADIUS * 2.2, RADIUS * 0.6)
      .setStrokeStyle(4, this.color)
      .setFillStyle(this.color, 0.25);
    this.sprite.addAt(this.ring, 1);
    this.look = new CharacterLook(scene, this.sprite, character, { height: 2.9, fx: true, poses: 'all' });
    this.tag = scene.add
      .text(0, 0, this.label, textStyle(15, hexToCss(this.color), { fontStyle: 'bold', stroke: '#1b1530', strokeThickness: 4 }))
      .setOrigin(0.5)
      // (Arriba de la oscuridad de la noche, para que siempre se vea quién es quién.)
      .setDepth(80);
  }

  // ---------- Lo que lleva ----------
  count(id) {
    if (this.creative) return BLOCKS[id] ? Infinity : 0;
    return this.inv.get(id) ?? 0;
  }

  give(id, n = 1) {
    if (this.creative) return;
    this.inv.set(id, this.count(id) + n);
    if (!this.order.includes(id)) this.order.push(id);
  }

  take(id, n = 1) {
    if (this.creative) return;
    const left = this.count(id) - n;
    if (left > 0) {
      this.inv.set(id, left);
      return;
    }
    // Ya no tiene: se quita de la barrita (y la selección se queda donde estaba).
    this.inv.delete(id);
    const i = this.order.indexOf(id);
    if (i >= 0) this.order.splice(i, 1);
    if (this.sel >= this.order.length) this.sel = Math.max(0, this.order.length - 1);
  }

  get selected() {
    return this.order[this.sel] ?? null;
  }

  pick(step) {
    if (!this.order.length) return;
    this.sel = (this.sel + step + this.order.length) % this.order.length;
  }

  // Lo que se guarda: { bloque: cuántos } en el orden de la barrita.
  saveInventory() {
    return this.order.map((id) => [id, this.inv.get(id) ?? 0]);
  }

  loadInventory(list) {
    if (this.creative || !Array.isArray(list)) return;
    for (const [id, n] of list) if (BLOCKS[id] && n > 0) this.give(id, n);
  }

  // ---------- Moverse ----------
  // intent: { x, y (stick), jump (recién apretado), jumpHeld }
  update(dt, world, intent, now) {
    const s = dt / 1000;
    this.invulnMs = Math.max(0, this.invulnMs - dt);
    if (!this.creative && this.hearts < MAX_HEARTS) {
      this.regenMs += dt;
      if (this.regenMs >= REGEN_MS) {
        this.regenMs = 0;
        this.hearts += 1;
      }
    }
    if (intent.jump) {
      if (this.creative && now - this.lastJumpTap < DOUBLE_TAP_MS && !this.onGround) {
        this.flying = !this.flying;
        this.vy = 0;
        this.lastJumpTap = -1e9;
        this.scene.onFly?.(this);
      } else {
        this.lastJumpTap = now;
      }
      this.bufferMs = BUFFER_MS;
    } else {
      this.bufferMs = Math.max(0, this.bufferMs - dt);
    }
    if (Math.abs(intent.x) > 0.2) this.facing = Math.sign(intent.x);
    this.swimming = touches(world, { x: this.x, y: this.y - this.h * 0.35, w: this.w, h: this.h * 0.3 }, (id) => id === B.WATER);
    this.climbing = !this.flying && touches(world, this, (id) => BLOCKS[id]?.climb);

    if (this.flying) {
      this.vx = intent.x * FLY;
      this.vy = (intent.jumpHeld ? -1 : 0) * FLY + (intent.y > 0.4 ? FLY : intent.y < -0.4 ? -FLY : 0);
      this.vy = Phaser.Math.Clamp(this.vy, -FLY, FLY);
      this.walking = false;
    } else {
      this.walkPhysics(s, intent);
    }

    // Parado a la orilla de un hoyo de un bloque (al escarbar para abajo): se acomoda encima para caer en él.
    if (this.onGround && !this.flying && Math.abs(intent.x) < 0.2) {
      const col = Math.floor(this.x / T);
      const row = Math.floor(this.y / T);
      const hole = !solidFor(this, world.get(col, row)) && solidFor(this, world.get(col - 1, row)) && solidFor(this, world.get(col + 1, row));
      if (hole) this.x += ((col + 0.5) * T - this.x) * Math.min(1, s * 12);
    }
    // Si quedó adentro de bloques (no debería), sale por arriba en vez de atravesarlos de lado.
    if (stuck(world, this)) this.unstick(world);
    const wasOnGround = this.onGround;
    const pushing = Math.abs(intent.x) > 0.5 ? Math.sign(intent.x) : 0;
    moveBody(world, this, s);
    // Un escalón de un bloque se sube solito (como el brinco automático de Minecraft).
    if (this.onGround && pushing && this.hitWall === pushing && !this.flying) this.autoStep(world, pushing);
    this.coyoteMs = this.onGround ? COYOTE_MS : Math.max(0, this.coyoteMs - dt);
    // La caída: si fue muy alta (y no cayó al agua), duele.
    if (this.onGround || this.swimming || this.climbing || this.flying) {
      const fell = this.peakY !== null && this.onGround && !wasOnGround ? this.y - this.peakY : 0;
      this.peakY = null;
      if (fell > FALL_HURT && !this.swimming) this.scene.onFallHurt?.(this);
    } else {
      this.peakY = this.peakY === null ? this.y : Math.min(this.peakY, this.y);
    }
    if (this.flying && this.onGround && intent.y > 0.4) this.flying = false;
    // Volando no se sale del mundo por arriba.
    if (this.y < this.h + 8) {
      this.y = this.h + 8;
      this.vy = Math.max(0, this.vy);
    }
  }

  // Si quedó adentro de algo (al aparecer o al regresar a casa), sube hasta que quepa.
  unstick(world) {
    while (this.y > this.h + T && stuck(world, this)) this.y -= T;
  }

  walkPhysics(s, intent) {
    const target = intent.x * (this.swimming ? SWIM.speed : WALK);
    const accel = this.onGround ? ACCEL.ground : ACCEL.air;
    if (Math.abs(intent.x) > 0.15) {
      this.vx += Phaser.Math.Clamp(target - this.vx, -accel * s, accel * s);
    } else {
      const slow = (this.onGround ? FRICTION : ACCEL.air * 0.6) * s;
      this.vx = Math.abs(this.vx) <= slow ? 0 : this.vx - Math.sign(this.vx) * slow;
    }
    this.walking = this.onGround && Math.abs(this.vx) > 20;

    if (this.climbing) {
      this.vy = intent.y < -0.4 ? -CLIMB : intent.y > 0.4 ? CLIMB : 0;
      if (this.bufferMs > 0 && intent.y >= -0.4) {
        this.vy = -JUMP * 0.8;
        this.bufferMs = 0;
        this.climbing = false;
      }
      return;
    }
    if (this.swimming) {
      this.vy = Math.min(this.vy + SWIM.gravity * s, SWIM.maxFall);
      if (intent.jumpHeld || intent.y < -0.4) this.vy = -SWIM.up;
      return;
    }
    if (this.bufferMs > 0 && this.coyoteMs > 0) {
      this.vy = -JUMP;
      this.bufferMs = 0;
      this.coyoteMs = 0;
      this.scene.onJump?.(this);
    }
    // Soltar A antes sube menos (menos en el escalón automático, que se sube sin apretar A).
    if (this.vy >= 0) this.autoHop = false;
    const gravity = this.vy < 0 && !intent.jumpHeld && !this.autoHop ? GRAVITY * 1.5 : GRAVITY;
    this.vy = Math.min(this.vy + gravity * s, MAX_FALL);
  }

  autoStep(world, dir) {
    const front = Math.floor((this.x + dir * (this.w / 2 + 2)) / T);
    const feet = Math.floor((this.y - 1) / T);
    if (!solidFor(this, world.get(front, feet))) return;
    for (let r = feet - 1; r >= feet - 2; r -= 1) {
      if (solidFor(this, world.get(front, r))) return;
    }
    // (Y que arriba de su cabeza haya lugar para subir.)
    const head = Math.floor((this.y - this.h - 2) / T);
    if (solidFor(this, world.get(Math.floor(this.x / T), head))) return;
    this.vy = -STEP_HOP;
    this.vx = dir * WALK * 0.5;
    this.autoHop = true;
  }

  // ---------- A dónde apunta ----------
  // La casilla que escarba (la primera con algo en la dirección del stick) y la casilla donde pondría el bloque.
  targets(world, stick) {
    const col = Math.floor(this.x / T);
    const feet = Math.floor((this.y - 1) / T);
    const head = Math.floor((this.y - this.h + 1) / T);
    const has = (c, r) => world.get(c, r) !== B.AIR && world.get(c, r) !== B.WATER;
    const free = (c, r) => !has(c, r);
    if (Math.abs(stick.y) > 0.5 && Math.abs(stick.x) < 0.4) {
      const r = stick.y < 0 ? head - 1 : feet + 1;
      return { dig: { col, row: r }, place: { col, row: r } };
    }
    const dir = Math.abs(stick.x) >= 0.4 ? Math.sign(stick.x) : this.facing;
    const front = col + dir;
    if (stick.y < -0.4) return { dig: { col: front, row: head - 1 }, place: { col: front, row: head - 1 } };
    if (stick.y > 0.4) return { dig: { col: front, row: feet + 1 }, place: { col: front, row: feet + 1 } };
    const digRow = has(front, feet) ? feet : has(front, head) ? head : feet;
    const placeRow = free(front, feet) ? feet : free(front, head) ? head : null;
    return { dig: { col: front, row: digRow }, place: placeRow === null ? null : { col: front, row: placeRow } };
  }

  // ---------- Dibujarlo ----------
  render(digging) {
    this.sprite.setPosition(this.x, this.y - RADIUS);
    let pose;
    if (digging) pose = 'golpe';
    else if (this.flying || this.swimming || this.climbing || !this.onGround) pose = 'salto';
    else pose = this.look.groundPose(this.walking);
    this.look.show(pose, this.facing);
    const blink = this.invulnMs > 0 && Math.floor(this.invulnMs / 90) % 2 === 1;
    this.sprite.setAlpha(blink ? 0.35 : 1);
    // Al escarbar se mece hacia el bloque.
    this.sprite.setAngle(digging ? Math.sin(this.scene.time.now / 60) * 6 * this.facing : 0);
    this.ring.setVisible(!this.flying || Math.floor(this.scene.time.now / 200) % 2 === 0);
    this.tag.setPosition(this.x, this.y - this.h - 16);
  }

  destroy() {
    this.menu?.destroy();
    this.sprite.destroy();
    this.tag.destroy();
  }
}
