import { sfx } from '../../shared/sound.js';
import { Blob } from '../../ui/Blob.js';
import { COLORS, hexToCss, textStyle } from '../../ui/style.js';
import { FIELD, TEAM_COLORS, attackDir } from './field.js';

export const PLAYER_RADIUS = 36;
const SPEED = 340;
const ACCEL = 2600;
const JUMP_SPEED = 720;
const GRAVITY = 1900;
const KICK_MS = 160;
const KICK_COOLDOWN_MS = 320;
const KICK_REACH = 34;
// Patadas: normal, globito (con ↑), rasante (con ↓) y volea (en el aire).
const KICKS = {
  normal: { vx: 720, vy: -340 },
  lob: { vx: 470, vy: -780 },
  low: { vx: 820, vy: -90 },
  volley: { vx: 900, vy: -220 },
};

// Un jugador: una bolita con el anillo del color de su equipo. Corre, salta y patea.
// `input` = { x (-1 a 1), jump, kick, up, down, power? }: de un control o de la compu (cpu.js).
export class FutbolPlayer {
  constructor(scene, { team, color, label, deviceId = null }) {
    this.scene = scene;
    this.team = team;
    this.color = color;
    this.label = label;
    this.deviceId = deviceId;
    this.isCpu = deviceId === null;
    this.radius = PLAYER_RADIUS;
    this.blob = new Blob(scene, 0, FIELD.ground - PLAYER_RADIUS, color, PLAYER_RADIUS);
    this.blob.ball.setStrokeStyle(6, TEAM_COLORS[team]);
    this.blob.setDepth(100);
    this.foot = scene.add.ellipse(0, PLAYER_RADIUS * 0.75, 30, 18, COLORS.ink).setVisible(false);
    const tag = scene.add
      .text(0, -PLAYER_RADIUS - 22, label, textStyle(18, hexToCss(color), { fontStyle: 'bold', stroke: '#1b1530', strokeThickness: 5 }))
      .setOrigin(0.5);
    this.blob.figure.add([this.foot, tag]);
    this.reset(FIELD.width / 2);
  }

  reset(x) {
    this.x = x;
    this.z = 0;
    this.vx = 0;
    this.vz = 0;
    this.facing = attackDir(this.team);
    this.kickMs = 0;
    this.cooldownMs = 0;
    this.kickDir = this.facing;
  }

  // Centro de la bolita en la pantalla (sube cuando salta).
  get y() {
    return FIELD.ground - this.radius - this.z;
  }

  update(dtMs, input) {
    const dt = dtMs / 1000;
    const target = input.x * SPEED;
    const step = ACCEL * dt;
    this.vx = Math.abs(target - this.vx) <= step ? target : this.vx + Math.sign(target - this.vx) * step;
    this.x += this.vx * dt;
    this.x = Math.max(this.radius, Math.min(FIELD.width - this.radius, this.x));
    if (input.x > 0.2) this.facing = 1;
    else if (input.x < -0.2) this.facing = -1;

    if (input.jump && this.z === 0) {
      this.vz = JUMP_SPEED;
      sfx.jump();
    }
    if (this.z > 0 || this.vz > 0) {
      this.vz -= GRAVITY * dt;
      this.z = Math.max(0, this.z + this.vz * dt);
      if (this.z === 0) this.vz = 0;
    }

    this.kickMs = Math.max(0, this.kickMs - dtMs);
    this.cooldownMs = Math.max(0, this.cooldownMs - dtMs);
    if (input.kick && this.cooldownMs === 0) {
      this.kickMs = KICK_MS;
      this.cooldownMs = KICK_COOLDOWN_MS;
      // Siempre patea hacia la portería contraria: así los peques no meten goles en la suya.
      this.kickDir = attackDir(this.team);
      this.kickPower = input.power ?? 1;
      this.facing = this.kickDir;
      this.kickStyle = this.z > 10 ? 'volley' : input.up ? 'lob' : input.down ? 'low' : 'normal';
      this.kickHit = false;
    }
  }

  // Mientras dura la patada, si el balón está a su alcance sale disparado. Devuelve el tipo de patada.
  tryKick(ball) {
    if (this.kickMs === 0 || this.kickHit) return null;
    if (Math.hypot(ball.x - this.x, ball.y - this.y) > this.radius + ball.radius + KICK_REACH) return null;
    // Si el balón quedó atrás (del lado de su portería) no lo alcanza: hay que darle la vuelta.
    if ((ball.x - this.x) * this.kickDir < -this.radius * 0.5) return null;
    this.kickHit = true;
    const kick = KICKS[this.kickStyle];
    ball.vx = this.kickDir * kick.vx * this.kickPower + this.vx * 0.25;
    ball.vy = kick.vy * this.kickPower;
    ball.lastTouch = this;
    sfx.hit(this.kickStyle === 'volley' ? 0.9 : 0.6);
    return this.kickStyle;
  }

  render() {
    this.blob.setPosition(this.x, FIELD.ground - this.radius);
    this.blob.figure.y = -this.z;
    this.blob.look(this.facing * 0.9, 0.1);
    this.foot.setVisible(this.kickMs > 0).setX(this.facing * this.radius * 0.95);
    // La sombra se achica cuando va en el aire.
    const shadow = this.blob.list[0];
    shadow.setScale(Math.max(0.5, 1 - this.z / 300));
  }

  destroy() {
    this.blob.destroy();
  }
}
