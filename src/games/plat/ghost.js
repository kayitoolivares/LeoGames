import { Blob } from '../../ui/Blob.js';
import { CharacterLook } from '../../ui/CharacterLook.js';
import { SIZES } from './Player.js';

// La contrarreloj: se graba por dónde va el jugador (cada STEP_MS) y, si hace récord, esa vuelta se guarda como
// fantasma; la siguiente vez el fantasma corre junto a él (transparente) para ver quién llega primero.
const STEP_MS = 60;
const MAX_SAMPLES = 4000;
const RADIUS = 22;

export class GhostRecorder {
  constructor() {
    this.samples = [];
    this.ms = 0;
  }

  record(dtMs, player) {
    this.ms += dtMs;
    while (this.samples.length * STEP_MS <= this.ms && this.samples.length < MAX_SAMPLES) {
      // [x, y, banderitas]: 1 = en el aire, 2 = mira a la izquierda, 4 = grande.
      const flags = (player.onGround ? 0 : 1) | (player.facing < 0 ? 2 : 0) | (player.size === 'big' ? 4 : 0);
      this.samples.push([Math.round(player.x), Math.round(player.y), flags]);
    }
  }
}

export class GhostRunner {
  constructor(scene, ghost, character) {
    this.scene = scene;
    this.samples = ghost.path;
    this.ms = 0;
    this.sprite = new Blob(scene, 0, 0, 0xffffff, RADIUS).setAlpha(0.45).setDepth(45);
    this.look = new CharacterLook(scene, this.sprite, character, { height: 2.6 });
  }

  update(dtMs) {
    this.ms += dtMs;
    const i = Math.min(this.samples.length - 1, Math.floor(this.ms / STEP_MS));
    const [x, y, flags] = this.samples[i];
    const big = flags & 4;
    const scale = big ? SIZES.big.scale : SIZES.small.scale;
    this.sprite.setPosition(x, y - RADIUS * scale).setScale(scale);
    this.look.show(flags & 1 ? 'salto' : this.look.groundPose(i > 0 && this.samples[i - 1][0] !== x), flags & 2 ? -1 : 1);
    this.sprite.setVisible(i < this.samples.length - 1 || this.ms < this.samples.length * STEP_MS + 1500);
  }

  destroy() {
    this.sprite.destroy();
  }
}
