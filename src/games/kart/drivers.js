import * as THREE from 'three';
import { paintBlockCharacter } from '../../ui/BlockBody.js';
import smashArt from '../smash/art.json';
import kartArt from './art.json';
import { announceNumber, isBlockCharacter, nextNumber } from '../smash/bloquecito.js';
import { CHARACTERS } from '../smash/characters.js';

// Los pilotos de los karts: la imagen del personaje como un "recorte" que siempre mira a la cámara, sentado en
// el asiento (la carrocería le tapa las piernas). Según de dónde lo veas se usa otra imagen: de espaldas,
// de espaldas girando (en las curvas), de lado o de frente (dibujos de Gemini: <personaje>-atras|giro|lado|frente).
// Con un golpe, un truco o en la meta, sus poses de Bolitas Bros (dolor, salto, gana). Bloquecito se dibuja con
// bloques y cambia de número.
const HEIGHT = { views: 2.3, poses: 2.5 };
const VIEWS = ['atras', 'giro', 'lado', 'frente'];
// Cuánto se hunde el piloto en el asiento (la carrocería le tapa los pies).
const DRIVER_SINK = 0.35;
// Bloquecito: cuánto mide un bloque en el mundo 3D, y lo más chico y lo más alto que puede verse
// (el 1 se perdería dentro del kart y el 7 taparía la pista).
const BLOCK_SIZE = 0.8;
const BLOCK_UNIT_PX = 40;
const BLOCK_HEIGHT = { min: 2.1, max: 3 };
// De dónde ve la cámara al kart: casi por detrás o casi por delante (si no, de lado).
const BEHIND = -0.65;
const AHEAD = 0.65;
const TURNING = 0.35;

// Los jefes de la Aventura: manejando (kart/jefes) y sus poses del Duelo (duelo/jefe).
export const BOSS_NAMES = { rey: 'Rey Bolón', dragonzote: 'Dragonzote', robotote: 'Robotote' };
const BOSS_POSES = { normal: 'normal', golpe: 'golpe', salto: 'salto', dolor: 'dolor', gana: 'normal' };

// Dirección de la imagen de un personaje en una pose (para el 3D y para el podio en HTML). null si no hay.
export function characterImageUrl(character, pose = 'normal') {
  if (BOSS_NAMES[character]) {
    if (kartArt.jefes?.includes(`${character}-${pose}`)) return `kart/jefes/${character}-${pose}.png`;
    return BOSS_POSES[pose] ? `duelo/jefe/${character}-${BOSS_POSES[pose]}.png` : null;
  }
  return smashArt.characters[character]?.includes(pose) ? `smash/personajes/${character}-${pose}.png` : null;
}

// Un dibujo de Bloquecito en ese número, como imagen (para el podio en HTML).
export function blockImageUrl(number) {
  return paintBlockCharacter(document.createElement('canvas'), number, { unit: BLOCK_UNIT_PX, pose: 'gana' }).toDataURL();
}

// Qué pose mostrar de un piloto visto desde `camera`: { pose, flip } (flip = voltear la imagen de lado a lado).
// `racer` = { x, z, heading, steerInput, spinMs, finished, trick, throwMs }.
export function driverView(racer, camera) {
  const fx = Math.sin(racer.heading);
  const fz = Math.cos(racer.heading);
  let tx = camera.position.x - racer.x;
  let tz = camera.position.z - racer.z;
  const length = Math.hypot(tx, tz) || 1;
  tx /= length;
  tz /= length;
  const facing = fx * tx + fz * tz;
  // Mayor que 0: el kart va hacia la derecha de la pantalla (las imágenes de lado miran a la derecha).
  const flip = fx * tz - fz * tx < 0;
  if (racer.spinMs > 0) return { pose: 'dolor', flip };
  if (racer.finished) return { pose: 'gana', flip: false };
  if (racer.trick) return { pose: 'salto', flip };
  if (racer.throwMs > 0) return { pose: 'golpe', flip };
  if (facing < BEHIND) return Math.abs(racer.steerInput ?? 0) > TURNING ? { pose: 'giro', flip: racer.steerInput < 0 } : { pose: 'atras', flip: false };
  // Viéndole la cara: feliz o enojado un ratito (ver Racer.setMood).
  const mood = racer.moodMs > 0 && racer.mood ? `_${racer.mood}` : '';
  if (facing > AHEAD) return { pose: `frente${mood}`, flip: false };
  return { pose: `lado${mood}`, flip };
}

// Guarda las imágenes ya cargadas (cada una se carga una sola vez; la volteada comparte la misma imagen).
// Hay que llamar dispose() al salir.
export class DriverArt {
  constructor() {
    this.textures = new Map();
    this.loader = new THREE.TextureLoader();
  }

  has(character, pose) {
    return Boolean(characterImageUrl(character, pose));
  }

  // { texture, aspect (ancho / alto), listeners } de un personaje en una pose, derecha o volteada.
  texture(character, pose, flip = false) {
    const key = `${character}-${pose}-${flip ? 'f' : ''}`;
    let entry = this.textures.get(key);
    if (entry) return entry;
    if (flip) {
      const base = this.texture(character, pose);
      const texture = base.texture.clone();
      texture.repeat.x = -1;
      texture.offset.x = 1;
      entry = { texture, get aspect() { return base.aspect; }, get loaded() { return base.loaded; }, listeners: base.listeners };
      base.listeners.push(() => (texture.needsUpdate = true));
    } else {
      entry = { texture: null, aspect: 0.8, loaded: false, listeners: [] };
      entry.texture = this.loader.load(characterImageUrl(character, pose), (loaded) => {
        entry.aspect = loaded.image.width / loaded.image.height;
        entry.loaded = true;
        entry.listeners.forEach((listener) => listener());
      });
      entry.texture.colorSpace = THREE.SRGBColorSpace;
    }
    this.textures.set(key, entry);
    return entry;
  }

  // Un piloto para poner en un kart.
  createDriver(character, deviceId = null) {
    return isBlockCharacter(character) ? new BlockDriver(deviceId) : new ImageDriver(this, character);
  }

  dispose() {
    for (const entry of this.textures.values()) entry.texture?.dispose();
    this.textures.clear();
  }
}

// Un personaje con imágenes de Gemini (si le faltan las de manejar, usa la de siempre, volteada según la dirección).
class ImageDriver {
  constructor(art, character) {
    this.art = art;
    this.character = character;
    this.sink = DRIVER_SINK;
    this.shown = null;
    this.sprite = new THREE.Sprite(new THREE.SpriteMaterial({ alphaTest: 0.4 }));
    this.sprite.center.set(0.5, 0);
    this.show({ pose: 'atras', flip: false });
  }

  get name() {
    return BOSS_NAMES[this.character] ?? CHARACTERS[this.character].name;
  }

  get imageUrl() {
    return characterImageUrl(this.character);
  }

  // Cambia a la imagen de esa pose (o la más parecida que tenga).
  show({ pose, flip }) {
    let use = pose;
    // (Si no tiene la cara feliz o enojada, la de siempre.)
    if (!this.art.has(this.character, use) && use.includes('_')) use = use.split('_')[0];
    if (!this.art.has(this.character, use) && use === 'giro') [use, flip] = ['atras', false];
    if (!this.art.has(this.character, use)) {
      // La de siempre mira a la derecha: sirve de lado (volteada si va a la izquierda); de espaldas y de frente, tal cual.
      flip = use === 'lado' || use === 'golpe' ? flip : false;
      use = 'normal';
    }
    if (!this.art.has(this.character, use)) return;
    const key = `${use}-${flip}`;
    if (key === this.shown) return;
    this.shown = key;
    const entry = this.art.texture(this.character, use, flip);
    this.sprite.material.map = entry.texture;
    this.sprite.material.needsUpdate = true;
    const height = VIEWS.includes(use.split('_')[0]) ? HEIGHT.views : HEIGHT.poses;
    const fit = () => {
      if (this.sprite.material.map === entry.texture) this.sprite.scale.set(height * entry.aspect, height, 1);
    };
    fit();
    if (!entry.loaded) entry.listeners.push(fit);
  }

  changeNumber() {
    return null;
  }

  dispose() {
    this.sprite.material.dispose();
  }
}

// Bloquecito: se dibuja en un canvas con su número; de espaldas, de lado o de frente, y en sus poses.
// Cada dibujo se guarda (hasta que cambia de número).
class BlockDriver {
  constructor(deviceId) {
    this.character = 'bloquecito';
    this.deviceId = deviceId;
    this.sink = 0.05;
    this.number = 1;
    this.cache = new Map();
    this.shown = null;
    this.sprite = new THREE.Sprite(new THREE.SpriteMaterial({ alphaTest: 0.4 }));
    this.sprite.center.set(0.5, 0);
    this.show({ pose: 'atras', flip: false });
  }

  get name() {
    return CHARACTERS.bloquecito.name;
  }

  get imageUrl() {
    return blockImageUrl(this.number);
  }

  show({ pose: shown, flip }) {
    // (Bloquecito no pone caras: frente_feliz = frente.)
    const pose = shown.split('_')[0];
    const view = pose === 'atras' || pose === 'giro' ? 'back' : pose === 'lado' ? 'side' : 'front';
    const bodyPose = ['dolor', 'salto', 'gana', 'golpe'].includes(pose) ? pose : 'normal';
    const facing = flip ? -1 : 1;
    const key = `${view}|${bodyPose}|${facing}`;
    if (key === this.shown) return;
    this.shown = key;
    let entry = this.cache.get(key);
    if (!entry) {
      const canvas = paintBlockCharacter(document.createElement('canvas'), this.number, { unit: BLOCK_UNIT_PX, pose: bodyPose, facing, view });
      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      entry = { texture, aspect: canvas.width / canvas.height, height: Math.min(BLOCK_HEIGHT.max, Math.max(BLOCK_HEIGHT.min, (canvas.height / BLOCK_UNIT_PX) * BLOCK_SIZE)) };
      this.cache.set(key, entry);
    }
    this.sprite.material.map = entry.texture;
    this.sprite.material.needsUpdate = true;
    this.sprite.scale.set(entry.height * entry.aspect, entry.height, 1);
  }

  // Y (o ↓ + Y): sube o baja un número. Devuelve el número nuevo.
  changeNumber(step) {
    if (!step) return null;
    this.number = nextNumber(this.number, step);
    this.clearCache();
    const [view, bodyPose, facing] = (this.shown ?? 'back|normal|1').split('|');
    this.shown = null;
    this.show({ pose: view === 'back' ? 'atras' : view === 'side' ? 'lado' : bodyPose === 'normal' ? 'frente' : bodyPose, flip: facing === '-1' });
    announceNumber(this.number, this.deviceId);
    return this.number;
  }

  clearCache() {
    for (const entry of this.cache.values()) entry.texture.dispose();
    this.cache.clear();
  }

  dispose() {
    this.clearCache();
    this.sprite.material.dispose();
  }
}
