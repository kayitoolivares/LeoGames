import Phaser from 'phaser';
import { frameDelta } from '../shared/clock.js';
import { characterTexture, hasPose, walkPose } from '../games/smash/art.js';
import { OCTO, announceNumber, isBlockCharacter, nextNumber } from '../games/smash/bloquecito.js';
import { addAccessory } from '../games/smash/characters.js';
import { BlockBody } from './BlockBody.js';

// Cuadros de caminata por segundo.
export const WALK_FPS = 9;
// Lado de un bloque de Bloquecito: esta fracción del alto que tendría una imagen (`height` radios).
const BLOCK_UNIT = 0.28;
// En las pantallas de escoger, cada cuánto Bloquecito cambia de número solito.
const SHOWCASE_MS = 900;

// Viste una bolita como un personaje de Bolitas Bros: con su imagen de Gemini (y sus poses) si existe,
// o con su accesorio dibujado si no. Hay que crearlo antes de agregarle otras cosas a `blob.figure`,
// porque con imagen se esconde todo lo que ya tenía (la bolita, los ojos y la boca).
// La imagen mira a la derecha y se apoya en el piso de la bolita; `height` es su alto en radios.
// Bloquecito no tiene imagen: se arma con bloques (ui/BlockBody.js) y cambia de número con changeNumber().
export class CharacterLook {
  constructor(scene, blob, character, { height = 2.8 } = {}) {
    this.scene = scene;
    this.blob = blob;
    this.character = character;
    this.height = height;
    this.image = null;
    this.body = null;
    this.walkStep = 0;
    if (isBlockCharacter(character)) {
      for (const part of blob.figure.list) part.setVisible(false);
      this.number = 1;
      this.isSuper = false;
      this.body = new BlockBody(scene, { unit: blob.radius * height * BLOCK_UNIT });
      this.body.setY(blob.radius);
      blob.figure.addAt(this.body, 0);
      this.punchArt = true;
      return;
    }
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
    return this.image !== null || this.body !== null;
  }

  // Dónde queda la cabeza (para poner letreros encima), medido desde el centro de la bolita.
  get top() {
    if (this.body) return this.blob.radius + this.body.top * this.body.scaleY;
    return this.image ? this.blob.radius - this.image.displayHeight : -this.blob.radius * 1.4;
  }

  // Bloquecito: el número que trae, u OCTO si está transformado en Octobloque.
  get form() {
    return this.isSuper ? OCTO : this.number;
  }

  fit() {
    this.image.setScale((this.blob.radius * this.height) / this.image.height);
  }

  // La pose cuando está en el piso: si va caminando, el cuadro de caminata que toca (si tiene); si no, la normal.
  // Hay que llamarla en cada cuadro, para que la caminata avance.
  groundPose(walking) {
    this.walkStep = walking ? this.walkStep + (frameDelta() * WALK_FPS) / 1000 : 0;
    if (this.body) return walking ? 'caminar' : 'normal';
    return (walking && walkPose(this.scene, this.character, this.walkStep)) || 'normal';
  }

  // pose: normal | golpe | salto | dolor | caminar1... (si falta, usa la normal). facing: 1 = derecha, -1 = izquierda.
  // `action` es el truco que está haciendo Bloquecito (ver BlockBody.render).
  show(pose, facing, action = null) {
    if (this.body) {
      this.body.render(pose.startsWith('caminar') ? 'caminar' : pose, facing, { action, walkStep: this.walkStep });
      return;
    }
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
    if (this.body) {
      this.body.flash();
      return;
    }
    if (!this.image) {
      this.blob.flash();
      return;
    }
    this.image.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
    this.scene.time.delayedCall(70, () => {
      if (this.image.active) this.image.setTintMode(Phaser.TintModes.MULTIPLY).clearTint();
    });
  }

  // Bloquecito sube (step = 1) o baja (step = -1) de número, con sonido; si `deviceId` es de un jugador,
  // además dice el número en voz alta. Transformado en Octobloque no cambia. Devuelve el número nuevo (o null).
  changeNumber(step, deviceId = null) {
    if (!this.body || this.isSuper || step === 0) return null;
    this.setNumber(nextNumber(this.number, step));
    announceNumber(this.number, deviceId);
    return this.number;
  }

  // Pone un número de una vez (sin sonido), por ejemplo el de la compu al empezar.
  setNumber(n) {
    if (!this.body) return;
    this.number = n;
    if (!this.isSuper) this.body.setForm(n);
  }

  // Súper forma de Bloquecito: Octobloque. Al terminar regresa al número que traía.
  setSuper(on) {
    if (!this.body) return;
    this.isSuper = on;
    this.body.setForm(on ? OCTO : this.number);
  }

  // En las pantallas de escoger: Bloquecito va contando del 1 al 10 solito, sin pasar de `maxHeight` px de alto.
  // Hay que llamarla en cada cuadro.
  showcase(maxHeight) {
    if (!this.body) return;
    this.showcaseMs = (this.showcaseMs ?? 0) + frameDelta();
    if (this.showcaseMs >= SHOWCASE_MS) {
      this.showcaseMs = 0;
      this.setNumber(nextNumber(this.number, 1));
    }
    const tall = this.body.height + this.body.discR * 2 + this.body.unit * 0.25;
    this.body.setScale(Math.min(1, maxHeight / tall));
    this.body.render('normal', 1);
  }
}
