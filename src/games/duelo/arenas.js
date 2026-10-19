import brawlArt from '../brawl/art.json';
import futbolArt from '../futbol/art.json';
import smashArt from '../smash/art.json';
import dueloArt from './art.json';

// Escenarios del duelo: el dojo propio y los fondos de los otros juegos que tienen piso.
// `texture`/`url` es la imagen (la misma clave que usa el otro juego, así no se carga dos veces);
// si no hay imagen se pinta un cielo y un piso con `sky` y `ground`.
export const ARENAS = {
  dojo: { name: 'Dojo', texture: 'duelo:fondo-dojo', url: 'duelo/fondos/dojo.jpg', has: dueloArt.fondos.includes('dojo'), sky: 0xf2c48d, ground: 0xb5793f },
  castillo: { name: 'Castillo', texture: 'smash:fondo-castillo', url: 'smash/fondos/castillo.jpg', has: smashArt.backgrounds.includes('castillo'), sky: 0x7ec8f0, ground: 0x6cc24a },
  bosque: { name: 'Bosque', texture: 'brawl:fondo-bosque', url: 'brawl/fondos/bosque.jpg', has: brawlArt.fondos.includes('bosque'), sky: 0xb7a6ff, ground: 0x9b7646 },
  volcan: { name: 'Volcán', texture: 'smash:fondo-volcan', url: 'smash/fondos/volcan.jpg', has: smashArt.backgrounds.includes('volcan'), sky: 0x3a1420, ground: 0x6b3a2a },
  pradera: { name: 'Pradera', texture: 'brawl:fondo-pradera', url: 'brawl/fondos/pradera.jpg', has: brawlArt.fondos.includes('pradera'), sky: 0x9fd8ff, ground: 0x6cc24a },
  estadio: { name: 'Estadio', texture: 'futbol:fondo-estadio', url: 'futbol/fondos/estadio.jpg', has: futbolArt.fondos.includes('estadio'), sky: 0x8fd3ff, ground: 0x5cb85c },
};
export const ARENA_KEYS = Object.keys(ARENAS);

// Se llama en preload(): carga las imágenes de los escenarios que todavía no estén cargadas.
export function loadArenaArt(scene) {
  for (const arena of Object.values(ARENAS)) {
    if (arena.has && !scene.textures.exists(arena.texture)) scene.load.image(arena.texture, arena.url);
  }
}

// Pinta el escenario en `layer`: la imagen cubriendo toda la pantalla, o cielo y piso si no hay.
export function drawArena(scene, key, floorY, layer) {
  const arena = ARENAS[key];
  const { width, height } = scene.scale;
  if (scene.textures.exists(arena.texture)) {
    const image = scene.add.image(width / 2, height / 2, arena.texture);
    image.setScale(Math.max(width / image.width, height / image.height));
    layer.add(image);
  } else {
    layer.add(scene.add.rectangle(width / 2, height / 2, width, height, arena.sky));
    layer.add(scene.add.rectangle(width / 2, (floorY - 40 + height) / 2, width, height - floorY + 40, arena.ground));
  }
}
