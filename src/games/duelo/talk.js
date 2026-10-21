import Phaser from 'phaser';
import { say } from '../../shared/voice.js';
import { textStyle } from '../../ui/style.js';

// El narrador del Duelo: comenta lo que pasa (primer golpe, combos, paradas, secretos, ayudantes, objetos, poquita
// vida...) con voz y con un letrero abajo. Para no amontonar, las frases normales esperan un ratito entre una y otra;
// las importantes siempre entran.
const GAP_MS = 2600;
const CAPTION_MS = 2400;

export class FightTalk {
  constructor(scene, y, depth) {
    this.scene = scene;
    this.waitMs = 0;
    this.captionMs = 0;
    this.caption = scene.add
      .text(scene.scale.width / 2, y, '', textStyle(22, '#ffffff', { fontStyle: 'bold', backgroundColor: '#14112bcc', padding: { x: 14, y: 6 } }))
      .setOrigin(0.5)
      .setDepth(depth)
      .setAlpha(0);
  }

  // `lines`: una frase o varias (escoge una).
  line(lines, { important = false } = {}) {
    if (!important && this.waitMs > 0) return false;
    const text = Array.isArray(lines) ? Phaser.Utils.Array.GetRandom(lines) : lines;
    this.waitMs = GAP_MS;
    this.captionMs = CAPTION_MS;
    this.caption.setText(`🎙️ ${text}`).setAlpha(1);
    say(text, { interrupt: important });
    return true;
  }

  update(dtMs) {
    this.waitMs = Math.max(0, this.waitMs - dtMs);
    if (this.captionMs > 0) {
      this.captionMs -= dtMs;
      if (this.captionMs <= 0) this.caption.setAlpha(0);
    }
  }

  hide() {
    this.captionMs = 0;
    this.caption.setAlpha(0);
  }
}
