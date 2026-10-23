import { sfx } from '../../shared/sound.js';
import { artImage } from './art.js';
import { moveBody } from './physics.js';

// El dinosaurio (como Yoshi): sale de un huevo o está esperando en el nivel. Tócalo para subirte; montado saltas
// más alto y con X le sacas la lengua para comerte al enemigo de enfrente. Si te pegan, se asusta y se va corriendo
// un ratito (luego lo puedes volver a montar).
const SIZE = 74;
const TONGUE = { reach: 120, ms: 220 };
const RUN = { speed: 320, ms: 1400, cooldownMs: 1200 };

export class Dino {
  constructor(scene, x, y) {
    this.scene = scene;
    Object.assign(this, { x, y, vx: 0, vy: 0, w: 50, h: 50, facing: 1, rider: null, runMs: 0, cooldownMs: 0, tongueMs: 0 });
    this.look = artImage(scene, 'plat:dinosaurio', SIZE, { color: 0x4cd97b });
    this.tongue = scene.add.rectangle(0, 0, 10, 10, 0xff5a7a).setOrigin(0, 0.5).setStrokeStyle(2, 0x1b1530).setVisible(false);
    this.sprite = scene.add.container(x, y, [this.tongue, this.look]).setDepth(48);
  }

  update(dtMs, scene) {
    const dt = dtMs / 1000;
    this.cooldownMs = Math.max(0, this.cooldownMs - dtMs);
    this.tongueMs = Math.max(0, this.tongueMs - dtMs);
    if (this.rider) {
      const p = this.rider;
      this.x = p.x;
      this.y = p.y;
      this.facing = p.facing;
      return;
    }
    if (this.runMs > 0) {
      this.runMs -= dtMs;
      this.vx = this.facing * RUN.speed;
    } else {
      this.vx = 0;
    }
    this.vy = Math.min(900, this.vy + 2000 * dt);
    moveBody(scene.level, this, dt);
    if (this.hitWall) this.facing = -this.hitWall;
    if (this.y > scene.level.height + 100) this.gone = true;
    // Esperando: el primero que lo toque se sube.
    if (this.runMs <= 0 && this.cooldownMs <= 0) {
      const rider = scene.players.find((p) => p.active && !p.dino && Math.abs(p.x - this.x) < 44 && Math.abs(p.y - this.y) < 50);
      if (rider) this.mount(rider);
    }
  }

  mount(player) {
    this.rider = player;
    player.dino = this;
    player.y = this.y;
    sfx.pickup();
    this.scene.mounted(player);
  }

  // Se baja el jinete y el dinosaurio corre asustado.
  runAway() {
    const p = this.rider;
    if (p) p.dino = null;
    this.rider = null;
    this.runMs = RUN.ms;
    this.cooldownMs = RUN.ms + RUN.cooldownMs;
    this.facing = -(p?.facing ?? 1);
    this.vy = -400;
  }

  // ¡Lengüetazo! Devuelve el área que alcanza la lengua.
  lick() {
    this.tongueMs = TONGUE.ms;
    sfx.throw();
    const x0 = this.x + this.facing * 20;
    return { x: x0 + (this.facing * TONGUE.reach) / 2, y: this.y - 34, w: TONGUE.reach, h: 40 };
  }

  render() {
    const lift = this.rider ? 0 : 0;
    this.sprite.setPosition(this.x, this.y - lift).setScale(this.facing, 1);
    this.look.setAngle(this.rider?.walking || this.runMs > 0 ? Math.sin(this.scene.time.now / 70) * 4 : 0);
    const out = this.tongueMs > 0 ? Math.sin((1 - this.tongueMs / TONGUE.ms) * Math.PI) * TONGUE.reach : 0;
    this.tongue.setVisible(out > 4).setPosition(26, -46).setSize(out, 10);
  }

  destroy() {
    this.sprite.destroy();
  }
}
