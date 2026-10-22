import { TEXT, textStyle } from '../../ui/style.js';

// El combo del equipo: cada golpe de cualquiera suma, y si pasa un ratito sin golpes se acaba. Se ve arriba en medio
// ("¡Combo x12!") y crece con cada golpe. `best` es el más largo del mundo (para las medallas y los récords).
const WINDOW_MS = 1600;
const SHOW_FROM = 3;
export const COMBO_STICKER_AT = 20;

export class TeamCombo {
  constructor(scene, depth) {
    this.scene = scene;
    this.count = 0;
    this.best = 0;
    this.ms = 0;
    const { width } = scene.scale;
    this.text = scene.add
      .text(width / 2, 150, '', textStyle(34, TEXT.accent, { fontStyle: 'bold', stroke: '#1b1530', strokeThickness: 7 }))
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(depth)
      .setAlpha(0);
  }

  // Un golpe más. Devuelve el combo (para que la escena festeje los números redondos).
  hit() {
    this.count += 1;
    this.ms = WINDOW_MS;
    this.best = Math.max(this.best, this.count);
    if (this.count >= SHOW_FROM) {
      this.text.setText(`¡Combo x${this.count}!`).setAlpha(1).setScale(1.25);
      this.scene.tweens.add({ targets: this.text, scale: 1, duration: 140 });
    }
    return this.count;
  }

  update(dtMs) {
    if (this.count === 0) return;
    this.ms -= dtMs;
    if (this.ms > 0) return;
    this.count = 0;
    this.scene.tweens.add({ targets: this.text, alpha: 0, duration: 250 });
  }

  reset() {
    this.count = 0;
    this.best = 0;
    this.ms = 0;
    this.text.setAlpha(0);
  }
}
