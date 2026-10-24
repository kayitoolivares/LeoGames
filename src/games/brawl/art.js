import { Creature, isPoseName, requestCreaturePoses } from '../../ui/creature.js';
import manifest from './art.json';

// Arte opcional de Pelea en equipo (Gemini), preparado con `npm run arte`. Si falta, se dibuja con figuras.
export function loadBrawlArt(scene) {
  // (Las poses de cada monstruo se bajan cuando aparece: ver brawlCreature.)
  for (const name of (manifest.monstruos ?? []).filter((n) => !isPoseName(n))) {
    if (!scene.textures.exists(`brawl:${name}`)) scene.load.image(`brawl:${name}`, `brawl/monstruos/${name}.png`);
  }
  for (const name of manifest.objetos ?? []) {
    if (!scene.textures.exists(`brawl:objeto-${name}`)) scene.load.image(`brawl:objeto-${name}`, `brawl/objetos/${name}.png`);
  }
  for (const name of manifest.fondos ?? []) {
    if (!scene.textures.exists(`brawl:fondo-${name}`)) scene.load.image(`brawl:fondo-${name}`, `brawl/fondos/${name}.jpg`);
  }
}

// Un monstruo con vida (ui/creature.js): su imagen `image` cabe en `size` (lo más largo); sus poses se bajan al aparecer.
export function brawlCreature(scene, image, name, size, gait = null) {
  const key = `brawl:${name}`;
  requestCreaturePoses(scene, key, (pose) => `brawl/monstruos/${name}-${pose}.png`, manifest.monstruos ?? []);
  return new Creature(scene, image, key, { size, fit: 'max', gait, metrics: manifest.metrics ?? {} });
}

export function monsterTexture(scene, name) {
  return scene.textures.exists(`brawl:${name}`) ? `brawl:${name}` : null;
}

export function backgroundTexture(scene, name) {
  return scene.textures.exists(`brawl:fondo-${name}`) ? `brawl:fondo-${name}` : null;
}
