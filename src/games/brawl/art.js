import manifest from './art.json';

// Arte opcional de Pelea en equipo (Gemini), preparado con `npm run arte`. Si falta, se dibuja con figuras.
export function loadBrawlArt(scene) {
  for (const name of manifest.monstruos ?? []) {
    if (!scene.textures.exists(`brawl:${name}`)) scene.load.image(`brawl:${name}`, `brawl/monstruos/${name}.png`);
  }
  for (const name of manifest.fondos ?? []) {
    if (!scene.textures.exists(`brawl:fondo-${name}`)) scene.load.image(`brawl:fondo-${name}`, `brawl/fondos/${name}.jpg`);
  }
}

export function monsterTexture(scene, name) {
  return scene.textures.exists(`brawl:${name}`) ? `brawl:${name}` : null;
}

export function backgroundTexture(scene, name) {
  return scene.textures.exists(`brawl:fondo-${name}`) ? `brawl:fondo-${name}` : null;
}
