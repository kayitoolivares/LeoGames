import { queueImage } from '../../shared/lazyArt.js';
import manifest from './art.json';

// Arte opcional de Bolitas Bros (imágenes hechas con Gemini), preparado con `npm run arte`.
// art.json dice qué imágenes hay; si falta alguna, el juego la dibuja con figuras como siempre.
const BASE = 'smash/';
export const ITEM_ART = {
  hammer: 'martillo',
  bomb: 'bomba',
  heart: 'corazon',
  star: 'estrella',
  bat: 'bate',
  raygun: 'pistola',
  skate: 'patineta',
  egg: 'huevo',
  superball: 'bola-super',
  target: 'diana',
  boomerang: 'bumeran',
  fireflower: 'flor-fuego',
  spring: 'resorte',
  capsule: 'capsula',
  tornado: 'tornado',
  sandbag: 'saco',
  // Los objetos nuevos (la burbuja es del Duelo).
  waterballoon: 'globo-agua',
  pie: 'pastel',
  magnet: 'iman',
  umbrella: 'paraguas',
  bubble: 'burbuja',
};
// La caminata son 4 cuadros (caminar1 a caminar4) que se repiten mientras el personaje camina.
export const WALK_FRAMES = 4;
const WALK_POSES = Array.from({ length: WALK_FRAMES }, (_, i) => `caminar${i + 1}`);
// Las poses que usan todos los juegos; las de pelea (patada, cubrirse...) solo las que las piden con `allPoses` (el Duelo)
// o, para no llenar la memoria del Xbox, solo para los personajes que van a pelear (`posesFor`, Bolitas Bros).
// (Las de manejar un kart, atras/giro/lado/frente, las carga el juego de karts por su cuenta.)
const BASIC_POSES = ['normal', 'golpe', 'salto', 'dolor', ...WALK_POSES];
const DUEL_POSES = ['patada', 'cubrirse', 'especial', 'gana', 'aire', 'agachado', 'agarre', 'entrada'];
// Las poses de las animaciones (ui/motion.js): se cargan aparte, solo de los personajes que salen (requestPoses).
export const FACE_POSES = ['parpadeo', 'feliz'];
export const EXPRESSION_POSES = [...FACE_POSES, 'enojado', 'asustado', 'caer', 'mareado', 'baile1', 'baile2'];

// Bloquecito tiene un dibujo por número (bloque1 a bloque10) y otro para Octobloque.
const BLOCK_ART = /^(bloque\d+|octobloque)$/;

// Se llama en preload(): pone en la fila de carga lo que todavía no esté cargado.
// De Bloquecito, todas sus poses solo si va a jugar (`posesFor`); si no, solo la normal de cada número (para escogerlo).
export function loadSmashArt(scene, { allPoses = false, posesFor = [] } = {}) {
  const queue = (key, url) => {
    if (!scene.textures.exists(key)) scene.load.image(key, url);
  };
  const blocks = posesFor.includes('bloquecito');
  for (const [character, poses] of Object.entries(manifest.characters)) {
    const block = BLOCK_ART.test(character);
    const extra = allPoses || posesFor.includes(character.replace(/_super$/, ''));
    for (const pose of poses) {
      const wanted = block ? pose === 'normal' || blocks : BASIC_POSES.includes(pose) || (extra && DUEL_POSES.includes(pose));
      if (wanted) queue(`smash:${character}-${pose}`, `${BASE}personajes/${character}-${pose}.png`);
    }
  }
  for (const item of manifest.items) queue(`smash:objeto-${item}`, `${BASE}objetos/${item}.png`);
}

// El fondo del escenario de la pelea, solo ese (ver shared/lazyArt.js).
export function loadStageBackground(scene, stage) {
  if (manifest.backgrounds.includes(stage)) queueImage(scene, `smash:fondo-${stage}`, `${BASE}fondos/${stage}.jpg`);
}

// Bloquecito empezó a jugar sin todos sus dibujos (la compu lo escogió al azar, o en el Duelo): se cargan ahorita y
// BlockBody los usa en cuanto llegan (mientras, se ve con bloques).
export function loadBlockArt(scene) {
  let added = false;
  for (const [character, poses] of Object.entries(manifest.characters)) {
    if (!BLOCK_ART.test(character)) continue;
    for (const pose of poses) {
      const key = `smash:${character}-${pose}`;
      if (scene.textures.exists(key)) continue;
      scene.load.image(key, `${BASE}personajes/${character}-${pose}.png`);
      added = true;
    }
  }
  if (added && !scene.load.isLoading()) scene.load.start();
}

// Carga en segundo plano las `poses` de un personaje (las que tenga y no estén cargadas); mientras llegan, se usa
// la pose parecida.
// (Con `start: false` solo las pone en la fila, para llamarla en preload().)
export function requestPoses(scene, character, poses, { start = true } = {}) {
  const have = manifest.characters[character] ?? [];
  let added = false;
  for (const pose of poses) {
    const key = `smash:${character}-${pose}`;
    if (!have.includes(pose) || scene.textures.exists(key)) continue;
    scene.load.image(key, `${BASE}personajes/${character}-${pose}.png`);
    added = true;
  }
  if (start && added && !scene.load.isLoading()) scene.load.start();
}

// La textura de Bloquecito en un número (u Octobloque, 'octo') y una pose, o null si no hay.
export function blockArtKey(scene, form, pose) {
  const key = `smash:${form === 'octo' ? 'octobloque' : `bloque${form}`}-${pose}`;
  return scene.textures.exists(key) ? key : null;
}

// Textura de un personaje en una pose; si esa pose no existe usa la normal; si no hay ninguna, null.
export function characterTexture(scene, character, pose = 'normal') {
  for (const candidate of [pose, 'normal']) {
    const key = `smash:${character}-${candidate}`;
    if (scene.textures.exists(key)) return key;
  }
  return null;
}

// Pone el tamaño y el punto de apoyo de una imagen de personaje (después de voltearla): que el cuerpo se vea igual de
// grande en todas las poses y parado en el mismo lugar. No se iguala el alto de la imagen (con los brazos arriba es
// más alta y agachado más bajita, y el personaje se veía cambiar de tamaño), sino lo que pinta (el área, que mide
// tools/pose-metrics.mjs) con el de su pose normal, que mide `height` de alto. Y de lado, el centro del cuerpo (no el
// de la imagen, que se mueve con un brazo o una pierna estirada). Sin medidas: el alto × `factor` como antes.
export function fitPose(image, height, factor = 1) {
  const match = /^smash:(.+)-([^-]+)$/.exec(image.texture.key);
  const metrics = manifest.metrics ?? {};
  const pose = match && metrics[`${match[1]}-${match[2]}`];
  const normal = match && metrics[`${match[1]}-normal`];
  if (!pose || !normal) {
    image.setOrigin(0.5, 1).setScale((height * factor) / image.height);
    return;
  }
  const [area, center] = pose;
  image.setOrigin(image.flipX ? 1 - center : center, 1).setScale((height / normal[2]) * Math.sqrt(normal[0] / area));
}

export function hasPose(scene, character, pose) {
  return scene.textures.exists(`smash:${character}-${pose}`);
}

// El cuadro de la caminata que toca según `step` (un número que va subiendo mientras camina),
// o null si el personaje no tiene cuadros de caminar.
export function walkPose(scene, character, step) {
  return hasPose(scene, character, WALK_POSES[0]) ? WALK_POSES[Math.floor(step) % WALK_FRAMES] : null;
}

// La súper forma tiene sus propias imágenes (<personaje>_super-<pose>). Devuelve ese nombre
// para usarlo con characterTexture(), o null si no hay (entonces se usa la normal con brillo dorado).
export function superArtKey(scene, character) {
  const key = `${character}_super`;
  return characterTexture(scene, key) ? key : null;
}

export function itemTexture(scene, type) {
  const key = `smash:objeto-${ITEM_ART[type]}`;
  return scene.textures.exists(key) ? key : null;
}

export function backgroundTexture(scene, stage) {
  const key = `smash:fondo-${stage}`;
  return scene.textures.exists(key) ? key : null;
}
