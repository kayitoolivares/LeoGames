import { sfx } from '../../shared/sound.js';
import { say } from '../../shared/voice.js';
import { textStyle } from '../../ui/style.js';
import { METER_MAX } from './DueloFighter.js';

// Escuela de peleas: lecciones una por una contra el muñeco, con letrero grande y voz. Cada una se palomea al
// hacer lo que pide (los golpes avisan con `practiced`; caminar, saltar y cubrirse se revisan aquí). En la de la
// parada perfecta el muñeco sí pega: avisa "¡Ahí va!" antes de cada golpe.
export const LESSONS = [
  { key: 'walk', title: 'Caminar', text: 'Mueve el stick para caminar hacia el muñeco', buttons: 'Stick' },
  { key: 'jump', title: 'Saltar', text: 'Empuja el stick hacia arriba para saltar', buttons: '↑' },
  { key: 'punch', title: 'Golpe', text: 'Aprieta A para dar un golpe', buttons: 'A' },
  { key: 'kick', title: 'Patada', text: 'Aprieta B para dar una patada', buttons: 'B' },
  { key: 'finisher', title: 'Remate', text: 'Aprieta A tres veces seguidas: el tercero es un remate que tumba', buttons: 'A A A' },
  { key: 'block', title: 'Cubrirse', text: 'Mantén apretado LB o RB para cubrirte', buttons: 'LB o RB' },
  { key: 'parry', title: 'Parada perfecta', text: 'Cuando el muñeco diga "¡Ahí va!", cúbrete justo a tiempo', buttons: 'LB o RB' },
  { key: 'uppercut', title: 'Gancho', text: 'Agáchate con el stick hacia abajo y aprieta A', buttons: '↓ + A' },
  { key: 'sweep', title: 'Barrida', text: 'Agáchate con el stick hacia abajo y aprieta B', buttons: '↓ + B' },
  { key: 'special', title: 'Especial', text: 'Aprieta X para tu especial', buttons: 'X' },
  { key: 'secretLow', title: 'Movimiento secreto', text: 'Agáchate y aprieta X', buttons: '↓ + X' },
  { key: 'secretAir', title: 'Secreto en el aire', text: 'Salta y, en el aire, aprieta X', buttons: '↑ y luego X' },
  { key: 'assist', title: 'Ayudante', text: 'Aprieta Y para llamar a un amigo', buttons: 'Y' },
  { key: 'super', title: 'Súper forma', text: 'Tu barra está llena: aprieta LB y RB al mismo tiempo', buttons: 'LB + RB' },
  { key: 'final', title: 'Golpe final', text: 'Ya en súper forma, aprieta X', buttons: 'X' },
];
const DONE_MS = 1400;
const WALK_DISTANCE = 120;
const BLOCK_HOLD_MS = 500;
// El muñeco maestro: cada cuánto pega en la lección de la parada, y cuánto antes avisa.
const SWING_EVERY_MS = 2600;
const WARN_MS = 650;
// En la escuela la parada perfecta es más fácil.
export const SCHOOL_PARRY_MS = 480;

export class School {
  constructor(scene, depth) {
    this.scene = scene;
    this.index = 0;
    this.doneMs = 0;
    this.complete = false;
    this.swingMs = SWING_EVERY_MS;
    this.warned = false;
    const { width } = scene.scale;
    this.root = scene.add.container(0, 0).setDepth(depth);
    this.root.add(scene.add.rectangle(width / 2, 178, 900, 132, 0x14112b, 0.85).setStrokeStyle(4, 0xffd84d));
    this.progress = scene.add.text(width / 2 - 430, 126, '', textStyle(20, '#ffd84d', { fontStyle: 'bold' }));
    this.title = scene.add.text(width / 2, 150, '', textStyle(34, '#ffffff', { fontStyle: 'bold', stroke: '#1b1530', strokeThickness: 6 })).setOrigin(0.5);
    this.text = scene.add.text(width / 2, 198, '', textStyle(24, '#ffffff', { align: 'center', wordWrap: { width: 640 } })).setOrigin(0.5);
    this.chip = scene.add.text(width / 2 + 380, 178, '', textStyle(30, '#1b1530', { fontStyle: 'bold', backgroundColor: '#ffd84d', padding: { x: 14, y: 8 } })).setOrigin(0.5);
    this.root.add([this.progress, this.title, this.text, this.chip]);
    this.show();
  }

  get lesson() {
    return LESSONS[this.index];
  }

  show() {
    const lesson = this.lesson;
    this.progress.setText(`Lección ${this.index + 1} de ${LESSONS.length}`);
    this.title.setText(lesson.title).setColor('#ffffff');
    this.text.setText(lesson.text);
    this.chip.setText(lesson.buttons).setVisible(true);
    this.startX = null;
    say(`${lesson.title}. ${lesson.text}`);
  }

  // Hizo algo (lo avisa la escena): si es lo que pide la lección, ¡muy bien!
  mark(key) {
    if (this.complete || this.doneMs > 0 || key !== this.lesson.key) return;
    this.doneMs = DONE_MS;
    this.title.setText('✅ ¡Muy bien!').setColor('#4cd97b');
    sfx.pickup();
    say('¡Muy bien!');
  }

  update(dtMs, me) {
    if (this.complete) return;
    const key = this.lesson.key;
    this.startX ??= me.x;
    if (key === 'walk' && Math.abs(me.x - this.startX) > WALK_DISTANCE) this.mark('walk');
    if (key === 'jump' && !me.grounded) this.mark('jump');
    if (key === 'block' && me.blocking && me.blockHeldMs > BLOCK_HOLD_MS) this.mark('block');
    // Para la súper y el golpe final la barra se llena sola.
    if ((key === 'super' || key === 'final') && me.superMs <= 0) me.meter = METER_MAX;
    if (this.doneMs <= 0) return;
    this.doneMs -= dtMs;
    if (this.doneMs > 0) return;
    this.index += 1;
    if (this.index < LESSONS.length) {
      this.show();
      return;
    }
    this.complete = true;
    this.root.setVisible(false);
    this.scene.schoolDone?.();
  }

  // El muñeco: quieto, salvo en la lección de la parada, donde se acerca y pega avisando antes.
  dummyInput(dummy, me, dtMs, idle) {
    const input = { ...idle };
    if (this.complete || this.lesson.key !== 'parry' || this.doneMs > 0 || !dummy.canAct()) return input;
    const gap = Math.abs(me.x - dummy.x) - (me.radius + dummy.radius) * 0.7;
    if (gap > dummy.radius * 0.7) {
      input.x = Math.sign(me.x - dummy.x) * 0.6;
      return input;
    }
    this.swingMs -= dtMs;
    if (this.swingMs <= WARN_MS && !this.warned) {
      this.warned = true;
      this.scene.warnSwing?.(dummy);
    }
    if (this.swingMs <= 0) {
      this.swingMs = SWING_EVERY_MS;
      this.warned = false;
      input.punch = true;
    }
    return input;
  }

  destroy() {
    this.root.destroy();
  }
}
