import manifest from './art.json';

// Arte de Súper Bolitas (Gemini), preparado con `npm run arte`. Si falta algo se dibuja con figuras. Del arte de
// Pelea en equipo se usan el dinosaurio y el cangrejo.
export function loadPlatArt(scene) {
  const load = (key, url) => {
    if (!scene.textures.exists(key)) scene.load.image(key, url);
  };
  for (const name of manifest.enemigos ?? []) load(`plat:${name}`, `plat/enemigos/${name}.png`);
  for (const name of manifest.jefes ?? []) load(`plat:${name}`, `plat/jefes/${name}.png`);
  for (const name of manifest.objetos ?? []) load(`plat:objeto-${name}`, `plat/objetos/${name}.png`);
  for (const name of manifest.fondos ?? []) load(`plat:fondo-${name}`, `plat/fondos/${name}.jpg`);
  load('plat:dinosaurio', 'brawl/objetos/dinosaurio.png');
  load('plat:cangrejo', 'brawl/monstruos/cangrejo.png');
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
