import { lazyImage } from '../../shared/lazyArt.js';
import manifest from './art.json';

// Los dibujos del Laberinto come-frutas (de Gemini, ver npm run arte): las frutas (laberinto/objetos), los fantasmitas
// (laberinto/fantasmas: cada uno con su nombre, más "asustado") y el fondo de cada tema (laberinto/fondos, solo el que se
// va a ver). Si falta un dibujo, el juego lo dibuja con figuras.
export function loadLaberintoArt(scene) {
  for (const [folder, prefix] of [
    ['objetos', 'objeto'],
    ['fantasmas', 'fantasma'],
  ]) {
    for (const name of manifest[folder] ?? []) {
      const key = `laberinto:${prefix}-${name}`;
      if (!scene.textures.exists(key)) scene.load.image(key, `laberinto/${folder}/${name}.png`);
    }
  }
}

// La textura de una fruta (null si no hay dibujo).
export function labObject(scene, name) {
  const key = `laberinto:objeto-${name}`;
  return scene.textures.exists(key) ? key : null;
}

// La textura de un fantasmita (null si no hay dibujo).
export function labGhost(scene, name) {
  const key = `laberinto:fantasma-${name}`;
  return scene.textures.exists(key) ? key : null;
}

// El fondo de un tema: si ya está, su textura; si no, lo baja y llama `onReady` cuando llega (null si no hay dibujo).
export function labBackground(scene, theme, onReady) {
  if (!(manifest.fondos ?? []).includes(theme)) return null;
  const key = `laberinto:fondo-${theme}`;
  return lazyImage(scene, key, `laberinto/fondos/${theme}.jpg`, onReady) ? key : null;
}
