import { BAR_Y, FIELD, GOAL } from './field.js';

export const BALL_RADIUS = 24;
const GRAVITY = 1100;
const BOUNCE = 0.72;
const WALL_BOUNCE = 0.8;
const ROLL_FRICTION = 0.9;
const MAX_SPEED = 1400;
const STUCK_MS = 900;

// El balón: rebota en el piso, en las paredes, en el techo y en los travesaños.
// `lastTouch` es el último jugador que lo tocó (para saber de quién fue el gol).
export class Ball {
  constructor(scene) {
    this.scene = scene;
    this.radius = BALL_RADIUS;
    this.sprite = scene.add.container(0, 0).setDepth(600);
    this.shadow = scene.add.ellipse(0, 0, BALL_RADIUS * 1.8, BALL_RADIUS * 0.45, 0x000000, 0.25).setDepth(5);
    const g = scene.add.graphics();
    g.fillStyle(0xffffff, 1);
    g.fillCircle(0, 0, BALL_RADIUS);
    g.fillStyle(0x1b1530, 1);
    g.fillCircle(0, 0, BALL_RADIUS * 0.34);
    for (let k = 0; k < 5; k += 1) {
      const angle = (k / 5) * Math.PI * 2 - Math.PI / 2;
      g.fillCircle(Math.cos(angle) * BALL_RADIUS * 0.82, Math.sin(angle) * BALL_RADIUS * 0.82, BALL_RADIUS * 0.2);
    }
    g.lineStyle(3, 0x1b1530, 1);
    g.strokeCircle(0, 0, BALL_RADIUS);
    this.sprite.add(g);
    this.reset(FIELD.width / 2, 260);
  }

  reset(x, y) {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.spin = 0;
    this.lastTouch = null;
    this.stuckMs = 0;
  }

  update(dt) {
    this.vy += GRAVITY * dt;
    const speed = Math.hypot(this.vx, this.vy);
    if (speed > MAX_SPEED) {
      this.vx *= MAX_SPEED / speed;
      this.vy *= MAX_SPEED / speed;
    }
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    const r = this.radius;

    const floor = FIELD.ground - r;
    if (this.y > floor) {
      this.y = floor;
      this.vy = Math.abs(this.vy) < 120 ? 0 : -this.vy * BOUNCE;
      this.vx *= Math.exp(-ROLL_FRICTION * dt);
    }
    if (this.y < r) {
      this.y = r;
      this.vy = Math.abs(this.vy) * WALL_BOUNCE;
    }
    if (this.x < r) {
      this.x = r;
      this.vx = Math.abs(this.vx) * WALL_BOUNCE;
    } else if (this.x > FIELD.width - r) {
      this.x = FIELD.width - r;
      this.vx = -Math.abs(this.vx) * WALL_BOUNCE;
    }
    this.bounceOffBar(0, GOAL.depth);
    this.bounceOffBar(FIELD.width - GOAL.depth, FIELD.width);
    this.unstickFromBars(dt);
    this.spin += this.vx * dt * 0.05;
  }

  // El travesaño es un rectángulo delgado: se empuja el balón hacia afuera y rebota.
  bounceOffBar(left, right) {
    const top = BAR_Y - GOAL.bar;
    const bottom = BAR_Y + GOAL.bar;
    const cx = Math.max(left, Math.min(right, this.x));
    const cy = Math.max(top, Math.min(bottom, this.y));
    const dx = this.x - cx;
    const dy = this.y - cy;
    const dist = Math.hypot(dx, dy);
    if (dist >= this.radius || dist === 0) return;
    const nx = dx / dist;
    const ny = dy / dist;
    this.x = cx + nx * this.radius;
    this.y = cy + ny * this.radius;
    const along = this.vx * nx + this.vy * ny;
    if (along < 0) {
      this.vx -= (1 + WALL_BOUNCE) * along * nx;
      this.vy -= (1 + WALL_BOUNCE) * along * ny;
    }
  }

  // Si se queda quieto encima de una portería, se empuja de regreso a la cancha.
  unstickFromBars(dt) {
    const onTop = this.y < BAR_Y && (this.x < GOAL.depth + this.radius || this.x > FIELD.width - GOAL.depth - this.radius);
    this.stuckMs = onTop && Math.abs(this.vx) < 40 && Math.abs(this.vy) < 60 ? this.stuckMs + dt * 1000 : 0;
    if (this.stuckMs > STUCK_MS) {
      this.vx = this.x < FIELD.width / 2 ? 260 : -260;
      this.vy = -200;
      this.stuckMs = 0;
    }
  }

  render() {
    this.sprite.setPosition(this.x, this.y).setRotation(this.spin);
    const height = FIELD.ground - this.radius - this.y;
    const scale = Math.max(0.4, 1 - height / 500);
    this.shadow.setPosition(this.x, FIELD.ground - 2).setScale(scale).setAlpha(0.25 * scale);
  }

  destroy() {
    this.sprite.destroy();
    this.shadow.destroy();
  }
}
