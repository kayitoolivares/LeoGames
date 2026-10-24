import Phaser from 'phaser';
import platArt from '../games/plat/art.json';

// La cortinilla entre pantallas: siempre está encima de todo (es la última escena) y casi siempre vacía. Al cambiar
// de pantalla (shared/transition.js) tapa todo con bolitas, estrellas o un círculo que se cierra, se cambia la
// pantalla por debajo y luego se destapa.
const COLORS = [0xff5a5f, 0xffc93c, 0x4cd97b, 0x3fa7ff, 0xb07cff, 0xff9ee8];
const COVER_MS = 330;
const REVEAL_MS = 380;
// Por si algo falla a medio cambio, que la cortinilla nunca se quede trabada.
const SAFETY_MS = 2500;
const STYLES = ['bolitas', 'estrellas', 'circulo'];

export class WipeScene extends Phaser.Scene {
  constructor() {
    super({ key: 'Wipe', active: true });
  }

  // Como esta escena está desde el principio, aquí se cargan los dibujos de los fondos con vida (ui/ambient.js), que
  // usan todas las pantallas.
  preload() {
    for (const name of platArt.ambiente ?? []) this.load.image(`amb:${name}`, `plat/ambiente/${name}.png`);
  }

  create() {
    this.busy = false;
    this.pieces = [];
    this.iris = this.add.graphics().setVisible(false);
    this.style = 0;
  }

  // Tapa la pantalla y luego llama a `onCovered` (ahí se cambia la escena de abajo); después se destapa sola.
  // `busy` solo mientras tapa: destapándose, la pantalla nueva ya funciona y otro cambio puede empezar.
  cover(onCovered) {
    if (this.busy) return false;
    this.tweens.killAll();
    this.clear();
    this.busy = true;
    this.safety = this.time.delayedCall(SAFETY_MS, () => this.clear());
    this.kind = STYLES[this.style++ % STYLES.length];
    const done = () => {
      this.busy = false;
      this.safety?.remove();
      onCovered();
      // (Un cuadro después, para que la pantalla nueva ya esté dibujada.)
      this.time.delayedCall(60, () => {
        if (!this.busy) this.reveal();
      });
    };
    if (this.kind === 'circulo') this.irisTo(1, 0, COVER_MS, done);
    else this.dots(true, done);
    return true;
  }

  reveal() {
    if (this.kind === 'circulo') this.irisTo(0, 1, REVEAL_MS, () => this.clear());
    else this.dots(false, () => this.clear());
  }

  clear() {
    this.safety?.remove();
    for (const piece of this.pieces) piece.destroy();
    this.pieces = [];
    this.iris.clear().setVisible(false);
    this.busy = false;
  }

  // Bolitas (o estrellas) de colores que crecen como ola desde una orilla hasta tapar todo, y luego se encogen.
  dots(grow, onDone) {
    const { width, height } = this.scale;
    if (grow) {
      const size = 150;
      const cols = Math.ceil(width / size) + 1;
      const rows = Math.ceil(height / size) + 1;
      const from = Phaser.Math.Between(0, 3);
      for (let r = 0; r < rows; r += 1) {
        for (let c = 0; c < cols; c += 1) {
          const x = c * size + (r % 2 ? size / 2 : 0);
          const y = r * size;
          const color = COLORS[(r + c) % COLORS.length];
          const piece =
            this.kind === 'estrellas' ? this.add.star(x, y, 5, size * 0.55, size * 1.25, color) : this.add.circle(x, y, size * 0.78, color);
          piece.setScale(0).setStrokeStyle(6, 0x1b1530);
          // El orden de la ola: desde la izquierda, la derecha, arriba o abajo.
          piece.order = [c / cols, 1 - c / cols, r / rows, 1 - r / rows][from];
          this.pieces.push(piece);
        }
      }
    }
    let left = this.pieces.length;
    for (const piece of this.pieces) {
      const delay = piece.order * (grow ? COVER_MS * 0.55 : REVEAL_MS * 0.5);
      this.tweens.add({
        targets: piece,
        scale: grow ? 1 : 0,
        angle: grow ? 90 : 180,
        delay,
        duration: grow ? COVER_MS * 0.45 : REVEAL_MS * 0.5,
        ease: grow ? 'Back.easeOut' : 'Back.easeIn',
        onComplete: () => {
          left -= 1;
          if (left === 0) onDone();
        },
      });
    }
  }

  // Un círculo que se cierra al centro (o se abre): todo lo de afuera es morado oscuro.
  irisTo(from, to, ms, onDone) {
    const { width, height } = this.scale;
    const max = Math.hypot(width, height) / 2;
    const draw = (k) => {
      const r = max * k;
      // Un aro muy grueso: por dentro mide r y por fuera tapa toda la pantalla.
      const thick = max * 2;
      this.iris.clear().setVisible(true);
      this.iris.lineStyle(thick, 0x1b1530, 1).strokeCircle(width / 2, height / 2, r + thick / 2);
      this.iris.lineStyle(10, 0xffc93c, 1).strokeCircle(width / 2, height / 2, Math.max(1, r));
      if (r < 2) this.iris.fillStyle(0x1b1530, 1).fillRect(0, 0, width, height);
    };
    draw(from);
    this.tweens.addCounter({ from, to, duration: ms, ease: from > to ? 'Quad.easeIn' : 'Quad.easeOut', onUpdate: (t) => draw(t.getValue()), onComplete: onDone });
  }
}
