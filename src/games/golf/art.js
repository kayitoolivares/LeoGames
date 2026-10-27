import { lazyImage } from '../../shared/lazyArt.js';
import platManifest from '../plat/art.json';
import manifest from './art.json';

// Los dibujos del Minigolf (de Gemini, ver npm run arte): las cositas de las canchas (golf/objetos) y el fondo de cada
// mundo visto desde arriba (golf/fondos, solo el que se va a ver). Las cajas sorpresa del Minigolf loco son el regalo de
// Súper Bolitas. Si falta un dibujo, el juego lo dibuja con figuras.
export function loadGolfArt(scene) {
  for (const name of manifest.objetos ?? []) {
    if (!scene.textures.exists(`golf:objeto-${name}`)) scene.load.image(`golf:objeto-${name}`, `golf/objetos/${name}.png`);
  }
  const gift = 'plat:objeto-regalo';
  if (platManifest.objetos?.includes('regalo') && !scene.textures.exists(gift)) scene.load.image(gift, 'plat/objetos/regalo.png');
}

// La textura de una cosita (null si no hay dibujo).
export function golfObject(scene, name) {
  const key = name === 'regalo' ? 'plat:objeto-regalo' : `golf:objeto-${name}`;
  return scene.textures.exists(key) ? key : null;
}

// El fondo de un mundo: si ya está, su textura; si no, lo baja y llama `onReady` cuando llega (null si no hay dibujo).
export function golfBackground(scene, world, onReady) {
  if (!(manifest.fondos ?? []).includes(world)) return null;
  const key = `golf:fondo-${world}`;
  return lazyImage(scene, key, `golf/fondos/${world}.jpg`, onReady) ? key : null;
}
