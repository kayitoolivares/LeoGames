// Pistas de Karts locos. `points`: el trazo [x, z, alto] antes de escalar (el alto hace lomas y bajadas).
// `pads`: flechas de turbo [dónde (0 a 1 de la vuelta), carril]; `ramps`: rampas [dónde] (en rectas).
// `unlock`: qué hay que ganar antes (ver UNLOCKS en rewards.js). `theme`: cómo se ve el camino (ver Track).
// `scenery`: adornos de la pista (snow = nieve y monos de nieve; beach, candy, castle, space: ver scenery.js).
// `mapColor`: color del dibujo de la pista al escogerla (si no, el del piso).
// `texture`: textura del piso (kart/texturas, de Gemini) y `textureTint` de qué color se tiñe. El paisaje de fondo
// es kart/fondos/<pista>.jpg (si existe; si no, montañas de colores).
// `dust`: color del polvito al salirse del camino.
// `light`: qué tanta luz hay (menos de 1 = de noche). `mountains`: color de las montañas de lejos (null = sin montañas).
export const TRACKS = {
  pradera: {
    name: 'Pradera',
    emoji: '🌳',
    unlock: null,
    points: [[0, -60, 0], [50, -70, 2], [90, -40, 8], [95, 10, 12], [60, 40, 8], [20, 30, 2], [-10, 55, 0], [-60, 60, 4], [-95, 20, 10], [-85, -35, 4], [-45, -55, 0]],
    pads: [[0.03, 0], [0.4, 3], [0.56, -4], [0.76, 4]],
    ramps: [0.935],
    hazards: { kind: 'oveja', pattern: 'cross', spots: [0.25, 0.48, 0.67] },
    sky: 0x8fd3ff,
    ground: 0x6abf4b,
    groundLight: 0x5a7a3a,
    mountains: 0x8a86b8,
    texture: 'pasto',
    dust: 0xb59a6a,
  },
  playa: {
    name: 'Playa',
    emoji: '🏖️',
    unlock: null,
    points: [[-90, -40, 0], [-40, -62, 0], [20, -55, 4], [70, -66, 8], [102, -30, 6], [95, 15, 2], [62, 35, 0], [30, 22, 4], [0, 42, 0], [-30, 68, 0], [-75, 60, 0], [-102, 20, 0]],
    pads: [[0.04, 0], [0.32, -3], [0.56, 0], [0.8, 3]],
    ramps: [0.13],
    hazards: { kind: 'cangrejo', pattern: 'cross', spots: [0.22, 0.45, 0.7] },
    sky: 0x7fd6ff,
    ground: 0xf2d48a,
    groundLight: 0xc9a85a,
    mountains: 0x7fae8a,
    texture: 'arena',
    dust: 0xf0dcae,
    theme: { decor: 'palm', sea: true, curbs: [0xffd02a, 0x3fa7ff], barrierColors: [0x3fa7ff, 0xffffff] },
    scenery: 'beach',
  },
  dulces: {
    name: 'Dulcelandia',
    emoji: '🍭',
    unlock: null,
    points: [[-80, -62, 0], [0, -72, 0], [70, -62, 6], [98, -22, 12], [72, 8, 10], [24, -2, 4], [-6, 22, 8], [22, 46, 4], [70, 50, 0], [66, 82, 4], [0, 84, 10], [-62, 72, 8], [-98, 30, 2], [-102, -22, 0]],
    pads: [[0.02, 0], [0.35, 0], [0.52, 3], [0.86, -3]],
    ramps: [0.09, 0.68],
    hazards: { kind: 'dona', pattern: 'roll', spots: [0.33, 0.62] },
    sky: 0xffd6f5,
    ground: 0xffb3dc,
    groundLight: 0xd98cb8,
    mountains: 0xfff1f8,
    texture: 'dulce',
    dust: 0xffc8e6,
    // Camino de chocolate con orillas de bastón de caramelo.
    theme: { decor: 'candy', road: 0x7a4a32, curbs: [0xff5fa8, 0xffffff], barrierColors: [0xff5fa8, 0x7fe0c8] },
    scenery: 'candy',
  },
  nieve: {
    name: 'Montaña nevada',
    emoji: '⛄',
    unlock: 'kart-nieve',
    // Una recta larga, una curva cerrada y una "S" del otro lado.
    points: [
      [-80, -50, 0],
      [-20, -62, 2],
      [40, -60, 6],
      [85, -45, 12],
      [100, -10, 16],
      [80, 20, 12],
      [40, 15, 6],
      [15, 35, 2],
      [30, 60, 4],
      [0, 78, 8],
      [-45, 68, 6],
      [-72, 40, 2],
      [-58, 10, 0],
      [-92, -12, 0],
    ],
    pads: [[0.06, 0], [0.45, 3], [0.68, -3], [0.88, 0]],
    ramps: [0.12],
    hazards: { kind: 'bola-nieve', pattern: 'roll', spots: [0.32, 0.64] },
    sky: 0xcfe3f5,
    ground: 0xf2f6fc,
    groundLight: 0x9aa8c0,
    mountains: 0xe6ecf8,
    texture: 'nieve',
    dust: 0xffffff,
    snowy: true,
    scenery: 'snow',
  },
  castillo: {
    name: 'Castillo',
    emoji: '🏰',
    unlock: 'kart-castillo',
    mapColor: 0xb8b4c8,
    // Alrededor del castillo, con curvitas en las cuatro esquinas.
    points: [[-90, -52, 0], [-34, -52, 0], [-22, -72, 4], [22, -72, 4], [34, -52, 0], [90, -52, 0], [104, 0, 1], [90, 52, 0], [34, 52, 0], [22, 72, 4], [-22, 72, 4], [-34, 52, 0], [-90, 52, 0], [-104, 0, 1]],
    pads: [[0.03, 0], [0.27, 0], [0.53, 0], [0.77, 0]],
    ramps: [0.39, 0.89],
    hazards: { kind: 'bloque', pattern: 'slam', spots: [0.15, 0.64] },
    sky: 0x3b2f6b,
    ground: 0x3f5a3a,
    groundLight: 0x2a2440,
    mountains: 0x2a2450,
    texture: 'pasto',
    textureTint: 0x5f7a66,
    dust: 0x8a8a7a,
    light: 0.65,
    theme: {
      road: 0x6e6a78,
      curbs: [0x9a96a8, 0x55516a],
      barrierColors: [0xffc93c, 0x55516a],
      treeColors: [0x1f4a3a, 0x24553f, 0x1a3f33],
      avoid: { x: 0, z: 0, radius: 45 },
    },
    scenery: 'castle',
  },
  espacio: {
    name: 'Arcoíris espacial',
    emoji: '🌈',
    unlock: 'kart-espacio',
    mapColor: 0xd36bff,
    points: [[-100, -10, 0], [-72, -62, 4], [0, -78, 12], [72, -62, 16], [102, -10, 10], [86, 42, 4], [46, 58, 8], [14, 34, 14], [-16, 56, 8], [-52, 72, 4], [-92, 42, 0]],
    pads: [[0.05, 0], [0.4, 3], [0.55, -3], [0.88, 0]],
    ramps: [0.2, 0.74],
    hazards: { kind: 'meteorito', pattern: 'fall' },
    sky: 0x0b0820,
    ground: 0x140d33,
    groundLight: 0x0b0820,
    mountains: null,
    dust: 0xd36bff,
    light: 0.75,
    // Camino de arcoíris y llantas de neón que brillan.
    theme: { decor: 'none', rainbow: true, curbs: [0xffffff, 0xbfe6ff], barrierColors: [0x3fe0ff, 0xff4dd2], glow: true },
    scenery: 'space',
  },
};

export const TRACK_KEYS = Object.keys(TRACKS);

// Copas del Gran Premio: 3 pistas seguidas y el que junte más puntos gana la copa. `image`: su trofeo (Gemini).
export const CUPS = {
  hoja: { name: 'Copa Hoja', emoji: '🍃', image: 'copa-hoja', tracks: ['pradera', 'playa', 'dulces'], unlock: null },
  estrella: { name: 'Copa Estrella', emoji: '⭐', image: 'copa-estrella', tracks: ['nieve', 'castillo', 'espacio'], unlock: 'kart-espacio' },
};
export const CUP_KEYS = Object.keys(CUPS);

// Puntos por lugar en cada carrera del Gran Premio (1° a 6°).
export const CUP_POINTS = [10, 8, 6, 4, 2, 1];
