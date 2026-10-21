import { FIELD, GOAL, barY } from './field.js';

export const BALL_RADIUS = 24;
const GRAVITY = 1100;
const BOUNCE = 0.72;
const WALL_BOUNCE = 0.8;
const ROLL_FRICTION = 0.9;
const MAX_SPEED = 1400;
const STUCK_MS = 900;
// Tiros fuertes: dejan una estela de bolitas que se desvanecen.
const TRAIL_SPEED = 850;
const TRAIL_EVERY_MS = 30;
// El tiro especial vuela sin gravedad un rato (y como cada personaje: derecho, en zigzag o como cohete).
export const SPECIAL_SHOT_MS = 1300;
const SPECIAL_SPEED = 1250;

// El balón: rebota en el piso, en las paredes, en el techo y en los travesaños.
// `lastTouch` es el último jugador que lo tocó (para saber de quién fue el gol). `scale` lo hace gigante (poder).
// `gravity` y `friction` cambian con la cancha (en la luna flota, en la arena se frena).
export class Ball {
  constructor(scene) {
    this.scene = scene;
    this.scale = 1;
    this.gravity = 1;
    this.friction = 1;
    this.sprite = scene.add.container(0, 0).setDepth(600);
    this.shadow = scene.add.ellipse(0, 0, BALL_RADIUS * 1.8, BALL_RADIUS * 0.45, 0x000000, 0.25).setDepth(5);
    // El brillo de colores mientras va un tiro especial.
    this.glow = scene.add.circle(0, 0, BALL_RADIUS * 1.8, 0xffd84d, 0.5).setVisible(false);
    this.sprite.add(this.glow);
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
    this.trailMs = 0;
    this.reset(FIELD.width / 2, 260);
  }

  get radius() {
    return BALL_RADIUS * this.scale;
  }

  reset(x, y) {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.spin = 0;
    this.lastTouch = null;
    this.stuckMs = 0;
    this.special = null;
    this.specialBy = null;
    this.glow?.setVisible(false);
  }

  setScale(scale) {
    this.scale = scale;
    this.sprite.setScale(scale);
  }

  // Tiro especial de `by` hacia `dir`: `kind` = 'fire' (derecho y rapidísimo), 'zigzag' (sube y baja) o
  // 'rocket' (sube y cae en picada a la portería). `color` es el de su brillo.
  shootSpecial(by, dir, kind, color) {
    this.special = { by, dir, kind, color, ms: SPECIAL_SHOT_MS, t: 0, baseY: Math.min(this.y, FIELD.ground - BALL_RADIUS * 3) };
    this.vx = dir * SPECIAL_SPEED;
    this.vy = kind === 'rocket' ? -900 : 0;
    this.lastTouch = by;
    this.specialBy = by;
    this.glow.setFillStyle(color, 0.55).setVisible(true);
  }

  endSpecial() {
    this.special = null;
    this.glow.setVisible(false);
  }

  update(dt) {
    if (this.special) {
      this.updateSpecial(dt);
    } else {
      this.vy += GRAVITY * this.gravity * dt;
      const speed = Math.hypot(this.vx, this.vy);
      if (speed > MAX_SPEED) {
        this.vx *= MAX_SPEED / speed;
        this.vy *= MAX_SPEED / speed;
      }
    }
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    const r = this.radius;

    const floor = FIELD.ground - r;
    if (this.y > floor) {
      this.y = floor;
      this.vy = Math.abs(this.vy) < 120 ? 0 : -this.vy * BOUNCE;
      this.vx *= Math.exp(-ROLL_FRICTION * this.friction * dt);
    }
    if (this.y < r) {
      this.y = r;
      this.vy = Math.abs(this.vy) * WALL_BOUNCE;
    }
    if (this.x < r) {
      this.x = r;
      this.vx = Math.abs(this.vx) * WALL_BOUNCE;
      this.endSpecial();
    } else if (this.x > FIELD.width - r) {
      this.x = FIELD.width - r;
      this.vx = -Math.abs(this.vx) * WALL_BOUNCE;
      this.endSpecial();
    }
    this.bounceOffBar(0, GOAL.depth, 0);
    this.bounceOffBar(FIELD.width - GOAL.depth, FIELD.width, 1);
    this.unstickFromBars(dt);
    this.spin += this.vx * dt * 0.05;
    this.updateTrail(dt * 1000);
  }

  updateSpecial(dt) {
    const s = this.special;
    s.t += dt * 1000;
    if (s.kind === 'zigzag') {
      this.vy = Math.cos(s.t / 90) * 700;
    } else if (s.kind === 'rocket') {
      // Sube y luego se va en picada hacia la portería.
      this.vy = s.t < 350 ? -900 : 650;
    } else {
      this.vy = (s.baseY - this.y) * 4;
    }
    this.vx = s.dir * SPECIAL_SPEED;
    if (s.t >= s.ms) this.endSpecial();
  }

  // Estela: bolitas del color del tiro (o blancas) que se quedan atrás y se desvanecen.
  updateTrail(dtMs) {
    const fast = Math.hypot(this.vx, this.vy) > TRAIL_SPEED || this.special;
    this.trailMs -= dtMs;
    if (!fast || this.trailMs > 0) return;
    this.trailMs = TRAIL_EVERY_MS;
    const color = this.special?.color ?? 0xffffff;
    const dot = this.scene.add.circle(this.x, this.y, this.radius * 0.8, color, this.special ? 0.7 : 0.35).setDepth(590);
    this.scene.tweens.add({ targets: dot, scale: 0.2, alpha: 0, duration: 320, onComplete: () => dot.destroy() });
  }

  // El travesaño es un rectángulo delgado: se empuja el balón hacia afuera y rebota.
  bounceOffBar(left, right, team) {
    const top = barY(team) - GOAL.bar;
    const bottom = barY(team) + GOAL.bar;
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
    this.endSpecial();
    this.scene.hitBar?.(this.x, this.y);
  }

  // Si se queda quieto encima de una portería, se empuja de regreso a la cancha.
  unstickFromBars(dt) {
    const onTop = (this.x < GOAL.depth + this.radius && this.y < barY(0)) || (this.x > FIELD.width - GOAL.depth - this.radius && this.y < barY(1));
    this.stuckMs = onTop && Math.abs(this.vx) < 40 && Math.abs(this.vy) < 60 ? this.stuckMs + dt * 1000 : 0;
    if (this.stuckMs > STUCK_MS) {
      this.vx = this.x < FIELD.width / 2 ? 260 : -260;
      this.vy = -200;
      this.stuckMs = 0;
    }
  }

  // Lo que se guarda para la repetición del gol.
  snapshot() {
    return { x: this.x, y: this.y, vx: this.vx, vy: this.vy, spin: this.spin, special: this.special ? { color: this.special.color, t: this.special.t } : null };
  }

  // Pone el balón como estaba en `snap` (en la repetición) y deja su estela.
  replay(snap, dtMs) {
    Object.assign(this, { x: snap.x, y: snap.y, vx: snap.vx, vy: snap.vy, spin: snap.spin, special: snap.special });
    this.glow.setVisible(Boolean(snap.special));
    if (snap.special) this.glow.setFillStyle(snap.special.color, 0.55);
    this.updateTrail(dtMs);
    this.render();
  }

  render() {
    this.sprite.setPosition(this.x, this.y).setRotation(this.spin);
    if (this.special) this.glow.setScale(1 + 0.15 * Math.sin(this.special.t / 40));
    const height = FIELD.ground - this.radius - this.y;
    const scale = Math.max(0.4, 1 - height / 500) * this.scale;
    this.shadow.setPosition(this.x, FIELD.ground - 2).setScale(scale).setAlpha((0.25 * scale) / this.scale);
  }

  destroy() {
    this.sprite.destroy();
    this.shadow.destroy();
  }
}
