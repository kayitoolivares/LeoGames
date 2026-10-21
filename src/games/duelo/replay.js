import { textStyle } from '../../ui/style.js';

// La repetición del golpe que gana la pelea: se graba lo que pasa (los últimos segundos) y, al final, se ve otra vez
// en cámara lenta con zoom hacia los dos, con franjas de cine y un "¡K.O.!" gigante. A la brinca.
const KEEP_MS = 1600;
const SPEED = 0.4;
const ZOOM = 1.55;
const HOLD_MS = 700;
// Lo que se guarda de cada peleador en cada cuadro (lo que usa para dibujarse).
const FIELDS = [
  'x', 'y', 'vx', 'vy', 'facing', 'hurtMs', 'launched', 'downMs', 'koed', 'blocking', 'crouching', 'superMs', 'flashMs',
  'celebrating', 'defeated', 'posing', 'cinematic', 'invulnerableMs', 'chillMs', 'bubbleHits', 'hammerHits', 'walkPhase',
];

export class KoReplay {
  constructor() {
    this.frames = [];
    this.t = 0;
  }

  record(dtMs, fighters) {
    this.t += dtMs;
    this.frames.push({
      t: this.t,
      states: fighters.map((f) => {
        const state = {};
        for (const key of FIELDS) state[key] = f[key];
        state.attack = f.attack ? { ...f.attack } : null;
        state.special = f.special ? { ...f.special } : null;
        state.dash = f.dash ? { ...f.dash } : null;
        return state;
      }),
    });
    while (this.frames.length > 2 && this.frames[0].t < this.t - KEEP_MS) this.frames.shift();
  }

  get ready() {
    return this.frames.length > 20;
  }

  // Empieza: guarda cómo están ahorita (para dejarlos igual al terminar), pone el zoom y las franjas.
  start(scene, fighters, focus) {
    this.scene = scene;
    this.fighters = fighters;
    this.saved = this.frames.length ? this.snapshot(fighters) : null;
    this.index = 0;
    this.playT = this.frames[0].t;
    this.holdMs = 0;
    const camera = scene.cameras.main;
    camera.setZoom(ZOOM);
    camera.centerOn(focus.x, focus.y);
    // Lo de pantalla (franjas y letrero) va fijo: se acomoda contra el zoom.
    const { width, height } = scene.scale;
    const fixed = (obj, sx, sy) => obj.setScrollFactor(0).setPosition(width / 2 + (sx - width / 2) / ZOOM, height / 2 + (sy - height / 2) / ZOOM).setScale(1 / ZOOM);
    this.overlay = [
      fixed(scene.add.rectangle(0, 0, width, 70, 0x000000).setOrigin(0.5, 0), width / 2, 0),
      fixed(scene.add.rectangle(0, 0, width, 70, 0x000000).setOrigin(0.5, 1), width / 2, height),
      fixed(scene.add.text(0, 0, '🎥 REPETICIÓN', textStyle(30, '#ffffff', { fontStyle: 'bold', stroke: '#1b1530', strokeThickness: 6 })).setOrigin(0, 0.5), 30, 100),
      fixed(scene.add.text(0, 0, 'A = brincar', textStyle(20, '#ffffff')).setOrigin(0.5), width / 2, height - 35),
    ];
    this.ko = fixed(scene.add.text(0, 0, '¡K.O.!', textStyle(160, '#ffd84d', { fontStyle: 'bold', stroke: '#1b1530', strokeThickness: 16 })).setOrigin(0.5).setAlpha(0), width / 2, height / 2 - 40);
    this.overlay.push(this.ko);
    for (const obj of this.overlay) obj.setDepth(20000);
  }

  snapshot(fighters) {
    return fighters.map((f) => {
      const state = {};
      for (const key of FIELDS) state[key] = f[key];
      state.attack = f.attack;
      state.special = f.special;
      state.dash = f.dash;
      return state;
    });
  }

  // Un cuadro de la repetición. Devuelve false al terminar.
  step(dtMs) {
    if (this.index >= this.frames.length - 1) {
      // Al final: "¡K.O.!" grandote un momento.
      this.holdMs += dtMs;
      this.ko.setAlpha(1).setScale((1 / ZOOM) * (1 + 0.15 * Math.max(0, 1 - this.holdMs / 200)));
      return this.holdMs < HOLD_MS;
    }
    this.playT += dtMs * SPEED;
    while (this.index < this.frames.length - 1 && this.frames[this.index + 1].t <= this.playT) this.index += 1;
    const frame = this.frames[this.index];
    this.fighters.forEach((f, i) => Object.assign(f, frame.states[i]));
    return true;
  }

  // Deja todo como estaba antes de la repetición.
  finish() {
    if (this.saved) this.fighters.forEach((f, i) => Object.assign(f, this.saved[i]));
    const camera = this.scene.cameras.main;
    camera.setZoom(1);
    camera.centerOn(this.scene.scale.width / 2, this.scene.scale.height / 2);
    for (const obj of this.overlay) obj.destroy();
    this.overlay = [];
  }
}
