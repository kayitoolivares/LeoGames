import Phaser from 'phaser';
import { sfx } from '../../shared/sound.js';
import { say } from '../../shared/voice.js';
import { textStyle } from '../../ui/style.js';
import { artImage } from './art.js';

// La casita de regalos del mapa: tres regalos; se ven los premios, se tapan, se revuelven y se escoge uno (◀ ▶ y A).
// El premio: un poder para empezar el siguiente nivel (todos), vidas o monedas.
const PRIZES = [
  { kind: 'power', power: 'hongo', label: '¡Un hongo!', art: 'plat:objeto-hongo' },
  { kind: 'power', power: 'flor', label: '¡Una flor de fuego!', art: 'plat:objeto-flor' },
  { kind: 'power', power: 'pluma', label: '¡Una pluma para volar!', art: 'plat:objeto-pluma' },
  { kind: 'power', power: 'flor-hielo', label: '¡Una flor de hielo!', art: 'plat:objeto-flor-hielo' },
  { kind: 'lives', amount: 2, label: '¡Dos vidas!', art: null, emoji: '❤️❤️' },
  { kind: 'coins', amount: 15, label: '¡15 monedas!', art: 'plat:objeto-moneda' },
];
const DEPTH = 10004;
const SPOTS = [340, 640, 940];
const SHUFFLES = 6;

export class House {
  constructor(scene) {
    this.scene = scene;
    const { width, height } = scene.scale;
    this.root = scene.add.container(0, 0).setDepth(DEPTH).setScrollFactor(0);
    this.root.add(scene.add.rectangle(width / 2, height / 2, width, height, 0xffe9c4));
    this.root.add(scene.add.rectangle(width / 2, height - 90, width, 180, 0xc98a4a));
    this.root.add(scene.add.text(width / 2, 70, '🎁 Casita de regalos', textStyle(48, '#e53935', { fontStyle: 'bold', stroke: '#ffffff', strokeThickness: 8 })).setOrigin(0.5));
    this.hint = scene.add.text(width / 2, height - 40, 'Fíjate dónde está cada premio…', textStyle(24, '#1b1530', { fontStyle: 'bold' })).setOrigin(0.5);
    this.root.add(this.hint);
    this.prizes = Phaser.Utils.Array.Shuffle([...PRIZES]).slice(0, 3);
    this.boxes = this.prizes.map((prize, i) => {
      const prizeLook = prize.art ? artImage(scene, prize.art, 90) : scene.add.text(0, -10, prize.emoji, textStyle(52)).setOrigin(0.5, 1);
      prizeLook.setPosition(0, -150);
      const box = artImage(scene, 'plat:objeto-regalo', 150, { color: 0xe53935 });
      const container = scene.add.container(SPOTS[i], 470, [prizeLook, box]);
      this.root.add(container);
      return { container, prizeLook, box, prize, spot: i };
    });
    this.choice = 1;
    this.phase = 'show';
    this.ms = 0;
    this.cursor = scene.add.text(SPOTS[1], 540, '▲', textStyle(48, '#e53935', { fontStyle: 'bold', stroke: '#ffffff', strokeThickness: 6 })).setOrigin(0.5).setVisible(false);
    this.root.add(this.cursor);
    say('Casita de regalos. Fíjate dónde está cada premio');
  }

  // Devuelve el premio cuando ya se escogió y se vio (o null mientras tanto).
  update(dtMs, input) {
    this.ms += dtMs;
    if (this.phase === 'show' && this.ms > 2200) {
      this.phase = 'shuffle';
      for (const b of this.boxes) this.scene.tweens.add({ targets: b.prizeLook, alpha: 0, y: -60, duration: 300 });
      this.shuffle(0);
    } else if (this.phase === 'pick') {
      const step = (input.pressed('right') ? 1 : 0) - (input.pressed('left') ? 1 : 0);
      if (step) {
        this.choice = (this.choice + step + 3) % 3;
        this.cursor.setX(SPOTS[this.choice]);
        sfx.select();
      }
      if (input.pressed('a')) this.open();
    } else if (this.phase === 'done' && this.ms > 1800) {
      return this.won;
    }
    return null;
  }

  // Cambia de lugar dos regalos, varias veces.
  shuffle(n) {
    if (n >= SHUFFLES) {
      this.phase = 'pick';
      this.cursor.setVisible(true);
      this.hint.setText('◀ ▶ escoger · A = ¡ese!');
      say('¿Cuál escoges?');
      return;
    }
    const [a, b] = Phaser.Utils.Array.Shuffle([0, 1, 2]).slice(0, 2);
    const boxA = this.boxes.find((box) => box.spot === a);
    const boxB = this.boxes.find((box) => box.spot === b);
    boxA.spot = b;
    boxB.spot = a;
    sfx.throw();
    this.scene.tweens.add({ targets: boxA.container, x: SPOTS[b], duration: 280, ease: 'Sine.easeInOut' });
    this.scene.tweens.add({ targets: boxB.container, x: SPOTS[a], duration: 280, ease: 'Sine.easeInOut', onComplete: () => this.shuffle(n + 1) });
  }

  open() {
    const box = this.boxes.find((b) => b.spot === this.choice);
    this.won = box.prize;
    this.phase = 'done';
    this.ms = 0;
    this.cursor.setVisible(false);
    this.scene.tweens.add({ targets: box.box, scaleY: 0, duration: 250 });
    this.scene.tweens.add({ targets: box.prizeLook, alpha: 1, y: -60, scale: box.prizeLook.scale * 1.4, duration: 400 });
    this.hint.setText(box.prize.label);
    sfx.win();
    say(box.prize.label);
  }

  destroy() {
    this.root.destroy();
  }
}

