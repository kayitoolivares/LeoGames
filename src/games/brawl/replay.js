import { textStyle } from '../../ui/style.js';

// La repetición del golpe que tumba al jefe en Pelea en equipo: se graban los últimos segundos de los peleadores y
// del jefe, y al tumbarlo se ven otra vez en cámara lenta con zoom hacia el jefe, franjas de cine y un "¡K.O.!".
// A la brinca. Lo de pantalla va fijo (contra el zoom).
const KEEP_MS = 2000;
const SPEED = 0.4;
const ZOOM = 1.5;
const HOLD_MS = 900;
const FIGHTER_FIELDS = ['x', 'y', 'z', 'facing', 'attackMs', 'finisher', 'special', 'down', 'invulnerableMs', 'knockback', 'superMs', 'starMs', 'celebrateMs', 'walking', 'dashMs'];
const MONSTER_FIELDS = ['x', 'y', 'facing', 'state', 'stateMs', 'knockback'];

export class BossReplay {
  constructor() {
    this.frames = [];
    this.t = 0;
  }

  record(dtMs, fighters, boss) {
    this.t += dtMs;
    const pick = (o, fields) => Object.fromEntries(fields.map((k) => [k, o[k]]));
    this.frames.push({ t: this.t, fighters: fighters.map((f) => [f, pick(f, FIGHTER_FIELDS)]), boss: boss ? pick(boss, MONSTER_FIELDS) : null });
    while (this.frames.length > 2 && this.frames[0].t < this.t - KEEP_MS) this.frames.shift();
  }

  clear() {
    this.frames = [];
    this.t = 0;
  }

  get ready() {
    return this.frames.length > 2 && this.t - this.frames[0].t > 500;
  }

  start(scene, boss, depth) {
    this.scene = scene;
    this.boss = boss;
    this.index = 0;
    this.playT = this.frames[0].t;
    this.holdMs = 0;
    this.saved = this.frames.at(-1).fighters.map(([f]) => [f, Object.fromEntries(FIGHTER_FIELDS.map((k) => [k, f[k]]))]);
    this.scroll = { x: scene.cameras.main.scrollX, y: scene.cameras.main.scrollY };
    const { width, height } = scene.scale;
    const fixed = (obj, sx, sy) =>
      obj
        .setScrollFactor(0)
        .setPosition(width / 2 + (sx - width / 2) / ZOOM, height / 2 + (sy - height / 2) / ZOOM)
        .setScale(1 / ZOOM)
        .setDepth(depth);
    const style = { fontStyle: 'bold', stroke: '#1b1530', strokeThickness: 6 };
    this.ko = fixed(scene.add.text(0, 0, '¡K.O.!', textStyle(150, '#ffd84d', { ...style, strokeThickness: 16 })).setOrigin(0.5).setAlpha(0), width / 2, height / 2 - 40);
    this.overlay = [
      fixed(scene.add.rectangle(0, 0, width, 70, 0x000000).setOrigin(0.5, 0), width / 2, 0),
      fixed(scene.add.rectangle(0, 0, width, 70, 0x000000).setOrigin(0.5, 1), width / 2, height),
      fixed(scene.add.text(0, 0, '🎥 REPETICIÓN', textStyle(30, '#ffffff', style)).setOrigin(0, 0.5), 30, 100),
      fixed(scene.add.text(0, 0, 'A = brincar', textStyle(20, '#ffffff')).setOrigin(0.5), width / 2, height - 35),
      this.ko,
    ];
    boss.sprite.setVisible(true);
    scene.cameras.main.setZoom(ZOOM);
  }

  // Un cuadro de la repetición. Devuelve false al terminar.
  step(dtMs) {
    const camera = this.scene.cameras.main;
    if (this.index >= this.frames.length - 1) {
      this.holdMs += dtMs;
      this.ko.setAlpha(1).setScale((1 / ZOOM) * (1 + 0.15 * Math.max(0, 1 - this.holdMs / 200)));
      return this.holdMs < HOLD_MS;
    }
    this.playT += dtMs * SPEED;
    while (this.index < this.frames.length - 1 && this.frames[this.index + 1].t <= this.playT) this.index += 1;
    const frame = this.frames[this.index];
    for (const [f, state] of frame.fighters) Object.assign(f, state);
    if (frame.boss) Object.assign(this.boss, frame.boss);
    camera.centerOn(this.boss.x, this.boss.y - this.boss.radius);
    return true;
  }

  finish() {
    for (const [f, state] of this.saved) Object.assign(f, state);
    const camera = this.scene.cameras.main;
    camera.setZoom(1);
    camera.setScroll(this.scroll.x, this.scroll.y);
    for (const obj of this.overlay) obj.destroy();
    this.overlay = [];
    this.clear();
  }
}
