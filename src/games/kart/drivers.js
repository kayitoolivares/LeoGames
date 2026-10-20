import * as THREE from 'three';
import { paintBlockCharacter } from '../../ui/BlockBody.js';
import smashArt from '../smash/art.json';
import { announceNumber, isBlockCharacter, nextNumber } from '../smash/bloquecito.js';
import { CHARACTERS } from '../smash/characters.js';

// Los pilotos de los karts: la imagen del personaje (la de Bolitas Bros) como un "recorte" que siempre mira a la
// cámara, parado en el asiento (la carrocería tapa sus pies). Bloquecito se dibuja con bloques y cambia de número.
const DRIVER_HEIGHT = 2.5;
// Cuánto se hunde el piloto en el asiento (la carrocería le tapa los pies).
const DRIVER_SINK = 0.35;
// Bloquecito: cuánto mide un bloque en el mundo 3D, y lo más chico y lo más alto que puede verse
// (el 1 se perdería dentro del kart y el 7 taparía la pista).
const BLOCK_SIZE = 0.8;
const BLOCK_UNIT_PX = 40;
const BLOCK_HEIGHT = { min: 2.1, max: 3 };

// Dirección de la imagen del personaje (para el 3D y para el podio en HTML). null si no hay.
export function characterImageUrl(character) {
  return smashArt.characters[character]?.includes('normal') ? `smash/personajes/${character}-normal.png` : null;
}

// Un dibujo de Bloquecito en ese número, como imagen (para el podio en HTML).
export function blockImageUrl(number) {
  return paintBlockCharacter(document.createElement('canvas'), number, { unit: BLOCK_UNIT_PX, pose: 'gana' }).toDataURL();
}

// Guarda las imágenes ya cargadas (cada personaje se carga una sola vez). Hay que llamar dispose() al salir.
export class DriverArt {
  constructor() {
    this.textures = new Map();
    this.loader = new THREE.TextureLoader();
  }

  // La textura de un personaje (se va llenando cuando termina de cargar) y su proporción (ancho / alto).
  texture(character) {
    let entry = this.textures.get(character);
    if (entry) return entry;
    const url = characterImageUrl(character);
    entry = { texture: null, aspect: 0.8, listeners: [] };
    this.textures.set(character, entry);
    if (url) {
      entry.texture = this.loader.load(url, (texture) => {
        entry.aspect = texture.image.width / texture.image.height;
        entry.listeners.forEach((listener) => listener());
      });
      entry.texture.colorSpace = THREE.SRGBColorSpace;
    }
    return entry;
  }

  // Un piloto para poner en un kart. `setNumber` solo sirve para Bloquecito.
  createDriver(character, deviceId = null) {
    return isBlockCharacter(character) ? new BlockDriver(deviceId) : new ImageDriver(this, character);
  }

  dispose() {
    for (const entry of this.textures.values()) entry.texture?.dispose();
    this.textures.clear();
  }
}

// Un personaje con imagen de Gemini (o, si no hay, una bolita de su color).
class ImageDriver {
  constructor(art, character) {
    this.character = character;
    this.sink = DRIVER_SINK;
    const entry = art.texture(character);
    const material = entry.texture
      ? new THREE.SpriteMaterial({ map: entry.texture, alphaTest: 0.4 })
      : new THREE.SpriteMaterial({ color: 0xff9ec7 });
    this.sprite = new THREE.Sprite(material);
    this.sprite.center.set(0.5, 0);
    const fit = () => this.sprite.scale.set(DRIVER_HEIGHT * entry.aspect, DRIVER_HEIGHT, 1);
    fit();
    entry.listeners.push(fit);
  }

  get name() {
    return CHARACTERS[this.character].name;
  }

  get imageUrl() {
    return characterImageUrl(this.character);
  }

  changeNumber() {
    return null;
  }

  dispose() {
    this.sprite.material.dispose();
  }
}

// Bloquecito: se dibuja en un canvas con su número; al cambiar de número se vuelve a dibujar.
class BlockDriver {
  constructor(deviceId) {
    this.character = 'bloquecito';
    this.deviceId = deviceId;
    this.sink = 0.05;
    this.number = 1;
    this.canvas = document.createElement('canvas');
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.texture, alphaTest: 0.4 }));
    this.sprite.center.set(0.5, 0);
    this.paint();
  }

  get name() {
    return CHARACTERS.bloquecito.name;
  }

  get imageUrl() {
    return blockImageUrl(this.number);
  }

  paint() {
    paintBlockCharacter(this.canvas, this.number, { unit: BLOCK_UNIT_PX });
    // Un canvas que cambia de tamaño necesita una textura nueva.
    const old = this.texture;
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.sprite.material.map = this.texture;
    this.sprite.material.needsUpdate = true;
    if (old !== this.texture) old.dispose();
    const height = Math.min(BLOCK_HEIGHT.max, Math.max(BLOCK_HEIGHT.min, (this.canvas.height / BLOCK_UNIT_PX) * BLOCK_SIZE));
    this.sprite.scale.set((height * this.canvas.width) / this.canvas.height, height, 1);
  }

  // Y (o ↓ + Y): sube o baja un número. Devuelve el número nuevo.
  changeNumber(step) {
    if (!step) return null;
    this.number = nextNumber(this.number, step);
    this.paint();
    announceNumber(this.number, this.deviceId);
    return this.number;
  }

  dispose() {
    this.texture.dispose();
    this.sprite.material.dispose();
  }
}
