import { lazyImage } from '../../shared/lazyArt.js';
import brawlArt from '../brawl/art.json';
import futbolArt from '../futbol/art.json';
import smashArt from '../smash/art.json';
import dueloArt from './art.json';

// Escenarios del duelo: los propios (dojo, lucha libre, azotea y el castillo del Rey Bolón, que es donde se pelea con
// el jefe del torneo) y los fondos de los otros juegos que tienen piso.
// `texture`/`url` es la imagen (la misma clave que usa el otro juego, así no se carga dos veces);
// si no hay imagen se pinta un cielo y un piso con `sky` y `ground`.
// Lo que se mueve encima (ver stage.js): `ambient` (petals, leaves, pollen, embers, confetti, sparkles),
// `crowd` (público a los lados) y `lights` (reflectores).
// Lo que cambia la pelea: `gravity` (en el espacio se salta más alto), `friction` (en la nieve los empujones
// resbalan más lejos) y `hazard` (cosas que caen: cocos en la playa, cristales en la cueva; ver stage.js).
// `boss`: la guarida de un jefe (no sale al azar).
export const ARENAS = {
  dojo: { name: 'Dojo', texture: 'duelo:fondo-dojo', url: 'duelo/fondos/dojo.jpg', has: dueloArt.fondos.includes('dojo'), sky: 0xf2c48d, ground: 0xb5793f, ambient: 'petals' },
  lucha: {
    name: 'Lucha libre',
    texture: 'duelo:fondo-lucha',
    url: 'duelo/fondos/lucha.jpg',
    has: dueloArt.fondos.includes('lucha'),
    sky: 0x2a1e4a,
    ground: 0x3a5bd6,
    ambient: 'confetti',
    crowd: true,
    lights: true,
  },
  azotea: { name: 'Azotea', texture: 'duelo:fondo-azotea', url: 'duelo/fondos/azotea.jpg', has: dueloArt.fondos.includes('azotea'), sky: 0x1b1840, ground: 0x4a4a5a, ambient: 'sparkles' },
  castillo: { name: 'Castillo', texture: 'smash:fondo-castillo', url: 'smash/fondos/castillo.jpg', has: smashArt.backgrounds.includes('castillo'), sky: 0x7ec8f0, ground: 0x6cc24a, ambient: 'pollen', crowd: true },
  bosque: { name: 'Bosque', texture: 'brawl:fondo-bosque', url: 'brawl/fondos/bosque.jpg', has: brawlArt.fondos.includes('bosque'), sky: 0xb7a6ff, ground: 0x9b7646, ambient: 'leaves' },
  volcan: { name: 'Volcán', texture: 'smash:fondo-volcan', url: 'smash/fondos/volcan.jpg', has: smashArt.backgrounds.includes('volcan'), sky: 0x3a1420, ground: 0x6b3a2a, ambient: 'embers' },
  pradera: { name: 'Pradera', texture: 'brawl:fondo-pradera', url: 'brawl/fondos/pradera.jpg', has: brawlArt.fondos.includes('pradera'), sky: 0x9fd8ff, ground: 0x6cc24a, ambient: 'leaves' },
  estadio: { name: 'Estadio', texture: 'futbol:fondo-estadio', url: 'futbol/fondos/estadio.jpg', has: futbolArt.fondos.includes('estadio'), sky: 0x8fd3ff, ground: 0x5cb85c, ambient: 'confetti', crowd: true },
  trono: { name: 'Castillo del Rey', texture: 'duelo:fondo-trono', url: 'duelo/fondos/trono.jpg', has: dueloArt.fondos.includes('trono'), sky: 0x3a1f4a, ground: 0x6e6a78, ambient: 'embers', boss: true },
  playa: { name: 'Playa', texture: 'duelo:fondo-playa', url: 'duelo/fondos/playa.jpg', has: dueloArt.fondos.includes('playa'), sky: 0x8fe0ff, ground: 0xf2d27a, ambient: 'pollen', hazard: 'coconut' },
  nieve: { name: 'Pueblito nevado', texture: 'duelo:fondo-nieve', url: 'duelo/fondos/nieve.jpg', has: dueloArt.fondos.includes('nieve'), sky: 0xcfe8ff, ground: 0xf4f8ff, ambient: 'snow', friction: 0.35 },
  espacio: { name: 'Estación espacial', texture: 'duelo:fondo-espacio', url: 'duelo/fondos/espacio.jpg', has: dueloArt.fondos.includes('espacio'), sky: 0x14112b, ground: 0x7a8aa0, ambient: 'sparkles', gravity: 0.6 },
  cueva: { name: 'Cueva de cristales', texture: 'duelo:fondo-cueva', url: 'duelo/fondos/cueva.jpg', has: dueloArt.fondos.includes('cueva'), sky: 0x2a1d4a, ground: 0x4a4060, ambient: 'crystals', hazard: 'crystal' },
  guarida: { name: 'Guarida del dragón', texture: 'duelo:fondo-guarida', url: 'duelo/fondos/guarida.jpg', has: dueloArt.fondos.includes('guarida'), sky: 0x4a1a14, ground: 0x4a3030, ambient: 'embers', boss: true },
  fabrica: { name: 'Fábrica del robot', texture: 'duelo:fondo-fabrica', url: 'duelo/fondos/fabrica.jpg', has: dueloArt.fondos.includes('fabrica'), sky: 0x2a3a4a, ground: 0x6a7080, ambient: 'sparkles', lights: true, boss: true },
};
// Los de las canchas nuevas del fútbol: de noche con luces, Dulcelandia (piso de gelatina: se salta más alto) y la
// selva con lluvia (el piso mojado resbala). `needsArt`: no se escogen hasta que esté su dibujo.
Object.assign(ARENAS, {
  noche: { name: 'Estadio de noche', texture: 'futbol:fondo-noche', url: 'futbol/fondos/noche.jpg', has: futbolArt.fondos.includes('noche'), needsArt: true, sky: 0x14183a, ground: 0x2f6b3a, ambient: 'sparkles', crowd: true, lights: true },
  dulces: { name: 'Dulcelandia', texture: 'futbol:fondo-dulces', url: 'futbol/fondos/dulces.jpg', has: futbolArt.fondos.includes('dulces'), needsArt: true, sky: 0xffd6f5, ground: 0x9be36a, ambient: 'confetti', gravity: 0.8 },
  selva: { name: 'Selva con lluvia', texture: 'futbol:fondo-selva', url: 'futbol/fondos/selva.jpg', has: futbolArt.fondos.includes('selva'), needsArt: true, sky: 0x9be3c4, ground: 0x3f8a3a, ambient: 'leaves', friction: 0.5 },
});
export const ARENA_KEYS = Object.keys(ARENAS);

// El fondo de un escenario, solo cuando se va a ver (ver shared/lazyArt.js); `onReady` cuando llega. Devuelve si ya
// estaba (o si ese escenario no tiene imagen).
export function loadArenaArt(scene, key, onReady) {
  const arena = ARENAS[key];
  if (!arena?.has) return true;
  return lazyImage(scene, arena.texture, arena.url, onReady);
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
