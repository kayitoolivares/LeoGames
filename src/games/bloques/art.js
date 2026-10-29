import { lazyImage } from '../../shared/lazyArt.js';
import babyManifest from '../baby/art.json';
import brawlManifest from '../brawl/art.json';
import manifest from './art.json';

// Los dibujos del Mundo de bloques (de Gemini, ver npm run arte): el sol, la luna, el pico y el slime (bloques/objetos)
// y las colinas lejanas, recortadas para que atrás se vea el cielo de día o de noche (bloques/paisaje, solo cuando se
// juega). Los animalitos son los del Modo Bebé. Los bloques siempre se dibujan con código (blocks.js). Si falta un
// dibujo, va con figuras (y el slime, si no hay el suyo, es el de Pelea en equipo).
const ANIMALS = ['vaca', 'cerdito', 'oveja', 'pollito'];

export function loadBloquesArt(scene) {
  const queue = (key, url) => {
    if (!scene.textures.exists(key)) scene.load.image(key, url);
  };
  for (const name of manifest.objetos ?? []) queue(`bloques:objeto-${name}`, `bloques/objetos/${name}.png`);
  for (const name of babyManifest.animales ?? []) {
    if (ANIMALS.includes(name.replace(/-canta$/, ''))) queue(`baby:${name}`, `baby/animales/${name}.png`);
  }
  if ((brawlManifest.monstruos ?? []).includes('slime')) queue('brawl:slime', 'brawl/monstruos/slime.png');
}

// La textura de un objeto (null si no hay dibujo).
export function bloquesObject(scene, name) {
  const key = `bloques:objeto-${name}`;
  return scene.textures.exists(key) ? key : null;
}

// Las colinas lejanas: si ya están, su textura; si no, las baja y llama `onReady` cuando llegan (null si no hay
// dibujo). (Se llama "fondo" para que se suelten al volver al menú, como los demás fondos.)
export function bloquesLandscape(scene, name, onReady) {
  if (!(manifest.paisaje ?? []).includes(name)) return null;
  const key = `bloques:fondo-${name}`;
  return lazyImage(scene, key, `bloques/paisaje/${name}.png`, onReady) ? key : null;
}
