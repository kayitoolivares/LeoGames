import Phaser from 'phaser';
import { characterTexture, hasPose } from '../games/smash/art.js';
import { addAccessory } from '../games/smash/characters.js';

// Viste una bolita como un personaje de Bolitas Bros: con su imagen de Gemini (y sus poses) si existe,
// o con su accesorio dibujado si no. Hay que crearlo antes de agregarle otras cosas a `blob.figure`,
// porque con imagen se esconde todo lo que ya tenía (la bolita, los ojos y la boca).
// La imagen mira a la derecha y se apoya en el piso de la bolita; `height` es su alto en radios.
export class CharacterLook {
  constructor(scene, blob, character, { height = 2.8 } = {}) {
    this.scene = scene;
    this.blob = blob;
    this.character = character;
    this.height = height;
    this.image = null;
    const key = characterTexture(scene, character);
    if (!key) {
      addAccessory(scene, blob, character);
      return;
    }
    for (const part of blob.figure.list) part.setVisible(false);
    this.image = scene.add.image(0, blob.radius, key).setOrigin(0.5, 1);
    this.fit();
    blob.figure.addAt(this.image, 0);
    // Si la imagen trae su pose de golpe, no hace falta dibujar el puño.
    this.punchArt = hasPose(scene, character, 'golpe');
  }

  get hasArt() {
    return this.image !== null;
  }

  // Dónde queda la cabeza (para poner letreros encima), medido desde el centro de la bolita.
  get top() {
    return this.image ? this.blob.radius - this.image.displayHeight : -this.blob.radius * 1.4;
  }

  fit() {
    this.image.setScale((this.blob.radius * this.height) / this.image.height);
  }

  // pose: normal | golpe | salto | dolor (si falta, usa la normal). facing: 1 = derecha, -1 = izquierda.
  show(pose, facing) {
    if (!this.image) return;
    const key = characterTexture(this.scene, this.character, pose);
    if (this.image.texture.key !== key) {
      this.image.setTexture(key);
      this.fit();
    }
    this.image.setFlipX(facing < 0);
  }

  // Destello blanco al recibir un golpe.
  flash() {
    if (!this.image) {
      this.blob.flash();
      return;
    }
    this.image.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
    this.scene.time.delayedCall(70, () => {
      if (this.image.active) this.image.setTintMode(Phaser.TintModes.MULTIPLY).clearTint();
    });
  }
}
