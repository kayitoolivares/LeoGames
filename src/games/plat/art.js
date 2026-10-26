import { lazyImage } from '../../shared/lazyArt.js';
import { Creature, isPoseName, requestCreaturePoses } from '../../ui/creature.js';
import brawlManifest from '../brawl/art.json';
import manifest from './art.json';

// Arte de Súper Bolitas (Gemini), preparado con `npm run arte`. Si falta algo se dibuja con figuras. Del arte de
// Pelea en equipo se usan el dinosaurio, el cangrejo, el pulpo y tres jefes.
export function loadPlatArt(scene) {
  const load = (key, url) => {
    if (!scene.textures.exists(key)) scene.load.image(key, url);
  };
  // (Las poses de cada uno se bajan cuando aparece: ver platCreature.)
  for (const name of (manifest.enemigos ?? []).filter((n) => !isPoseName(n))) load(`plat:${name}`, `plat/enemigos/${name}.png`);
  for (const name of (manifest.jefes ?? []).filter((n) => !isPoseName(n))) load(`plat:${name}`, `plat/jefes/${name}.png`);
  for (const name of manifest.objetos ?? []) load(`plat:objeto-${name}`, `plat/objetos/${name}.png`);
  load('plat:dinosaurio', 'brawl/objetos/dinosaurio.png');
  // Del arte de Pelea en equipo: el cangrejo, el pulpo (mini jefe) y los jefes de nieve, dulces y la casa embrujada.
  for (const name of ['cangrejo', 'capitan-pulpo', 'gran-yeti', 'rey-pastel', 'rey-calabaza']) load(`plat:${name}`, `brawl/monstruos/${name}.png`);
}

// El fondo lejano de un nivel, solo cuando se va a jugar (ver shared/lazyArt.js); `onReady` cuando llega.
export function loadLevelBackground(scene, name, onReady) {
  if (!(manifest.fondos ?? []).includes(name)) return true;
  return lazyImage(scene, `plat:fondo-${name}`, `plat/fondos/${name}.jpg`, onReady);
}

// Un enemigo o jefe con vida (ui/creature.js): sus poses se bajan cuando aparece. null si se dibuja con figuras.
export function platCreature(scene, image, key, size, gait = null) {
  if (!image.setTexture) return null;
  const art = key.slice('plat:'.length);
  const [dir, list] = (manifest.enemigos ?? []).includes(art)
    ? ['plat/enemigos', manifest.enemigos]
    : (manifest.jefes ?? []).includes(art)
      ? ['plat/jefes', manifest.jefes]
      : ['brawl/monstruos', brawlManifest.monstruos ?? []];
  requestCreaturePoses(scene, key, (pose) => `${dir}/${art}-${pose}.png`, list);
  return new Creature(scene, image, key, { size, gait, metrics: { ...brawlManifest.metrics, ...manifest.metrics } });
}

export function platTexture(scene, key) {
  return scene.textures.exists(key) ? key : null;
}

// Una imagen de `key` de `size` px de alto (o de ancho, si es más ancha), parada en (0, 0); o un círculo de color.
export function artImage(scene, key, size, { color = 0xff5a5f, fit = 'height' } = {}) {
  if (scene.textures.exists(key)) {
    const image = scene.add.image(0, 0, key).setOrigin(0.5, 1);
    const s = fit === 'max' ? size / Math.max(image.width, image.height) : size / image.height;
    return image.setScale(s);
  }
  return scene.add.circle(0, -size / 2, size / 2, color).setStrokeStyle(4, 0x1b1530);
}
