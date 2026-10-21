import { textStyle } from '../../ui/style.js';

// La repetición del golpe que gana la pelea en Bolitas Bros: se graba lo que pasa (los últimos segundos) y, al final,
// se ve otra vez en cámara lenta con zoom siguiendo al que salió volando, con franjas de cine y un "¡K.O.!" gigante.
// A la brinca. (Solo se repiten los peleadores; lo demás se queda como está.)
const KEEP_MS = 2000;
const SPEED = 0.4;
const ZOOM = 1.3;
const HOLD_MS = 900;
// Lo que se guarda de cada peleador en cada cuadro (lo que usa para dibujarse).
const FIELDS = [
  'x', 'y', 'vx', 'vy', 'facing', 'hitstunMs', 'stunMs', 'shielding', 'shieldHp', 'superMs', 'starPowerMs', 'ghostMs',
  'rollMs', 'rollDir', 'airDodgeMs', 'invulnerableMs', 'grounded', 'out', 'hanging', 'transformMs', 'finalReady',
  'skateMs', 'dashMs', 'slideMs', 'rocketMs', 'damage', 'held',
];

export class SmashReplay {
  constructor() {
    this.frames = [];
    this.t = 0;
  }

  record(dtMs, fighters) {
    this.t += dtMs;
    this.frames.push({ t: this.t, states: fighters.map((f) => [f, this.state(f, true)]) });
    while (this.frames.length > 2 && this.frames[0].t < this.t - KEEP_MS) this.frames.shift();
  }

  state(f, copy) {
    const state = {};
    for (const key of FIELDS) state[key] = f[key];
    state.attack = f.attack && copy ? { ...f.attack } : f.attack;
    if (copy && f.held) state.held = { ...f.held };
    return state;
  }

  // Lista si ya hay al menos medio segundo grabado (se mide en tiempo: en una compu lenta hay menos cuadros).
  get ready() {
    return this.frames.length > 2 && this.t - this.frames[0].t > 500;
  }

  // Empieza: guarda cómo están ahorita (para dejarlos igual al terminar) y pone las franjas en `ui` (sin zoom).
  // `focus`: el peleador al que sigue la cámara.
  start(scene, ui, focus) {
    this.scene = scene;
    this.focus = focus;
    this.saved = this.frames.at(-1).states.map(([f]) => [f, this.state(f, false)]);
    this.index = 0;
    this.playT = this.frames[0].t;
    this.holdMs = 0;
    const { width, height } = scene.scale;
    const style = { fontStyle: 'bold', stroke: '#1b1530', strokeThickness: 6 };
    this.ko = scene.add.text(width / 2, height / 2 - 40, '¡K.O.!', textStyle(150, '#ffd84d', { ...style, strokeThickness: 16 })).setOrigin(0.5).setAlpha(0);
    this.overlay = scene.add.container(0, 0, [
      scene.add.rectangle(width / 2, 0, width, 70, 0x000000).setOrigin(0.5, 0),
      scene.add.rectangle(width / 2, height, width, 70, 0x000000).setOrigin(0.5, 1),
      scene.add.text(30, 100, '🎥 REPETICIÓN', textStyle(30, '#ffffff', style)).setOrigin(0, 0.5),
      scene.add.text(width / 2, height - 35, 'A = brincar', textStyle(20, '#ffffff')).setOrigin(0.5),
      this.ko,
    ]);
    ui.add(this.overlay);
    scene.cameras.main.setZoom(ZOOM);
  }

  // Un cuadro de la repetición. Devuelve false al terminar.
  step(dtMs) {
    if (this.index >= this.frames.length - 1) {
      // Al final: "¡K.O.!" grandote un momento.
      this.holdMs += dtMs;
      this.ko.setAlpha(1).setScale(1 + 0.15 * Math.max(0, 1 - this.holdMs / 200));
      return this.holdMs < HOLD_MS;
    }
    this.playT += dtMs * SPEED;
    while (this.index < this.frames.length - 1 && this.frames[this.index + 1].t <= this.playT) this.index += 1;
    this.apply(this.frames[this.index].states);
    // La cámara sigue al que sale volando (mientras se vea).
    const camera = this.scene.cameras.main;
    if (!this.focus.out) camera.centerOn(this.focus.x, this.focus.y);
    return true;
  }

  apply(states) {
    for (const [f, state] of states) {
      if (!f.sprite.active) continue;
      Object.assign(f, state);
      f.sprite.setVisible(!f.out);
    }
  }

  // Deja todo como estaba antes de la repetición.
  finish() {
    this.apply(this.saved);
    this.overlay.destroy();
  }
}
