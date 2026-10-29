// Los bloques del Mundo de bloques: qué son, cuánto tardan en escarbarse y cómo se dibujan (con código, cuadritos de
// 16x16 "pixeles" grandes, como en Minecraft). Todos van en una sola textura (`TILES`) que usa el mapa de cuadritos y
// de la que salen los iconos de la barrita (un cuadro por bloque, con el número del bloque como nombre).
export const T = 48;
const PIXELS = 16;
const PX = T / PIXELS;
// Cada cuadro de la textura lleva 1 pixel de orilla repetida, para que al alejar la cámara no se vean rayitas.
const CELL = T + 2;

export const B = {
  AIR: 0,
  GRASS: 1,
  DIRT: 2,
  STONE: 3,
  SAND: 4,
  WATER: 5,
  LOG: 6,
  LEAVES: 7,
  COAL: 8,
  IRON: 9,
  GOLD: 10,
  DIAMOND: 11,
  PLANKS: 12,
  LADDER: 13,
  DOOR: 14,
  TORCH: 15,
  BED: 16,
  GLASS: 17,
  BRICKS: 18,
  FLOWER_RED: 19,
  FLOWER_YELLOW: 20,
  WOOL: 21,
  TABLE: 22,
  BEDROCK: 23,
  SNOW: 24,
  CACTUS: 25,
};
// Los de atrás (las paredes oscuras de las cuevas): no se escarban ni se ponen.
export const BACK = { DIRT: 26, STONE: 27, SAND: 28 };
// El agua que tiene agua encima (sin la rayita de la ola, que solo va en la de arriba). Es el mismo bloque: solo cambia
// el dibujo.
export const DEEP_WATER = 29;
const TILE_COUNT = 30;

// name: lo que dice la barrita (y la voz)   hard: milisegundos para escarbarlo (null = no se puede)
// solid: se choca con él   drop: lo que sale al escarbarlo   sound: cómo suena   climb: se sube (escalera)
// light: brilla de noche   color: el color de los pedacitos que saltan al romperlo
export const BLOCKS = {
  [B.GRASS]: { name: 'Pasto', hard: 400, solid: true, drop: B.DIRT, sound: 'tierra', color: 0x5cb85c },
  [B.DIRT]: { name: 'Tierra', hard: 400, solid: true, sound: 'tierra', color: 0x8b5a2b },
  [B.STONE]: { name: 'Piedra', hard: 900, solid: true, sound: 'piedra', color: 0x8c8c94 },
  [B.SAND]: { name: 'Arena', hard: 350, solid: true, sound: 'tierra', color: 0xe8d38f },
  [B.WATER]: { name: 'Agua', hard: null, solid: false, sound: 'agua', color: 0x3f8fe0 },
  [B.LOG]: { name: 'Tronco', hard: 650, solid: true, sound: 'madera', color: 0x7a4e26 },
  [B.LEAVES]: { name: 'Hojas', hard: 150, solid: true, sound: 'hojas', color: 0x3fa34d },
  [B.COAL]: { name: 'Carbón', hard: 1000, solid: true, sound: 'piedra', color: 0x2b2b2b },
  [B.IRON]: { name: 'Hierro', hard: 1100, solid: true, sound: 'piedra', color: 0xd8a47a },
  [B.GOLD]: { name: 'Oro', hard: 1200, solid: true, sound: 'piedra', color: 0xffd23f },
  [B.DIAMOND]: { name: 'Diamante', hard: 1400, solid: true, sound: 'piedra', color: 0x4fe3e3 },
  [B.PLANKS]: { name: 'Tablas', hard: 600, solid: true, sound: 'madera', color: 0xc08a4c },
  [B.LADDER]: { name: 'Escalera', hard: 300, solid: false, climb: true, sound: 'madera', color: 0xa86f3a },
  [B.DOOR]: { name: 'Puerta', hard: 500, solid: false, sound: 'madera', color: 0xa86f3a },
  [B.TORCH]: { name: 'Antorcha', hard: 60, solid: false, light: true, sound: 'hojas', color: 0xffd23f },
  [B.BED]: { name: 'Cama', hard: 400, solid: false, sound: 'hojas', color: 0xe53935 },
  [B.GLASS]: { name: 'Vidrio', hard: 300, solid: true, sound: 'vidrio', color: 0xcff4ff },
  [B.BRICKS]: { name: 'Ladrillos', hard: 900, solid: true, sound: 'piedra', color: 0x9a9aa2 },
  [B.FLOWER_RED]: { name: 'Flor roja', hard: 60, solid: false, sound: 'hojas', color: 0xff4d4d },
  [B.FLOWER_YELLOW]: { name: 'Flor amarilla', hard: 60, solid: false, sound: 'hojas', color: 0xffd23f },
  [B.WOOL]: { name: 'Lana', hard: 300, solid: true, sound: 'hojas', color: 0xf4f4f4 },
  [B.TABLE]: { name: 'Mesa de trabajo', hard: 600, solid: true, sound: 'madera', color: 0xa86f3a },
  [B.BEDROCK]: { name: 'Piedra base', hard: null, solid: true, sound: 'piedra', color: 0x3a3a40 },
  [B.SNOW]: { name: 'Nieve', hard: 400, solid: true, drop: B.DIRT, sound: 'tierra', color: 0xffffff },
  [B.CACTUS]: { name: 'Cactus', hard: 400, solid: true, sound: 'hojas', color: 0x3faa4f },
};

// Lo que se puede poner en el modo Creativo, en el orden de la barrita.
export const CREATIVE_ORDER = [
  B.DIRT,
  B.STONE,
  B.PLANKS,
  B.LOG,
  B.BRICKS,
  B.GLASS,
  B.WOOL,
  B.LEAVES,
  B.SAND,
  B.GRASS,
  B.SNOW,
  B.LADDER,
  B.DOOR,
  B.TORCH,
  B.BED,
  B.TABLE,
  B.FLOWER_RED,
  B.FLOWER_YELLOW,
  B.CACTUS,
  B.COAL,
  B.IRON,
  B.GOLD,
  B.DIAMOND,
];

export const TILES = 'bloques:tiles';

export function isSolid(id) {
  return Boolean(BLOCKS[id]?.solid);
}

// Lo que te llevas al escarbarlo (null si no sale nada).
export function dropOf(id) {
  const block = BLOCKS[id];
  if (!block || block.hard === null) return null;
  return block.drop ?? id;
}

// El cuadro de la textura con el dibujo del bloque (para iconos: image(x, y, TILES, frameOf(id))).
export function frameOf(id) {
  return `b${id}`;
}

// Un generador de números al azar que siempre da lo mismo con la misma semilla.
function seeded(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function darken(color, k) {
  const channel = (shift) => Math.min(255, Math.round(((color >> shift) & 0xff) * k));
  return (channel(16) << 16) | (channel(8) << 8) | channel(0);
}

// Escoge un color de la lista según `r` (0 a 1) y los pesos.
function pick(r, colors, weights) {
  let total = 0;
  for (let i = 0; i < colors.length; i += 1) {
    total += weights[i];
    if (r < total) return colors[i];
  }
  return colors[colors.length - 1];
}

// Cada pintor devuelve el color (y la transparencia) del pixel (i, j), o null si va vacío.
const DIRT = [0x8b5a2b, 0x6e4420, 0xa06a3a];
const STONE = [0x8c8c94, 0x74747c, 0xa4a4ac];
const dirtPixel = (rnd) => pick(rnd(), DIRT, [0.6, 0.25, 0.15]);
const stonePixel = (rnd, i, j) => {
  // Manchas grandecitas: un patrón de "piedras" según la posición.
  const patch = Math.sin(i * 1.7 + j * 0.9) + Math.cos(j * 1.3 - i * 0.6) > 1.1;
  return patch ? STONE[1] : pick(rnd(), STONE, [0.8, 0.08, 0.12]);
};
// Mineral: piedra con unas bolitas de color.
const orePainter = (base, light) => {
  const spots = [
    [2, 2],
    [9, 1],
    [5, 7],
    [11, 9],
    [2, 12],
  ];
  const shadow = darken(base, 0.6);
  return (rnd, i, j) => {
    for (const [x, y] of spots) {
      const dx = i - x;
      const dy = j - y;
      if (dx < 0 || dx > 3 || dy < 0 || dy > 3) continue;
      // Una piedrita redonda de 4x4: brillito arriba a la izquierda y sombra abajo a la derecha.
      const corner = (dx === 0 || dx === 3) && (dy === 0 || dy === 3);
      if (corner) continue;
      if (dx + dy <= 2) return light;
      if (dx + dy >= 5) return shadow;
      return base;
    }
    return stonePixel(rnd, i, j);
  };
};
// Flor: tallito verde y pétalos alrededor de un centro.
const flowerPainter = (petal, center) => (rnd, i, j) => {
  const dx = i - 7.5;
  const dy = j - 5;
  if (Math.abs(dx) <= 0.6 && Math.abs(dy) <= 0.6) return center;
  if (dx * dx + dy * dy <= 9) return Math.abs(dx) < 1 || Math.abs(dy) < 1 ? petal : darken(petal, 0.85);
  if ((i === 7 || i === 8) && j >= 8) return 0x3e9b3e;
  if (j === 11 && (i === 5 || i === 6)) return 0x5cb85c;
  if (j === 12 && (i === 9 || i === 10)) return 0x5cb85c;
  return null;
};

const PAINTERS = {
  [B.GRASS]: (rnd, i, j) => {
    const edge = j < 3 || (j === 3 && rnd() < 0.6) || (j === 4 && rnd() < 0.2);
    if (edge) return pick(rnd(), [0x5cb85c, 0x3e9b3e, 0x7ed36f], [0.6, 0.25, 0.15]);
    return dirtPixel(rnd);
  },
  [B.DIRT]: (rnd) => dirtPixel(rnd),
  [B.STONE]: stonePixel,
  [B.SAND]: (rnd) => pick(rnd(), [0xe8d38f, 0xd6bf76, 0xf3e3a8], [0.65, 0.2, 0.15]),
  [B.WATER]: (rnd, i, j) => {
    const wave = j === 2 && i % 8 < 5;
    return [wave ? 0x8cc8f5 : pick(rnd(), [0x3f8fe0, 0x3a84d4], [0.8, 0.2]), wave ? 0.85 : 0.7];
  },
  [DEEP_WATER]: (rnd) => [pick(rnd(), [0x3a84d4, 0x3579c4], [0.8, 0.2]), 0.75],
  [B.LOG]: (rnd, i, j) => {
    if (i === 0 || i === 15) return 0x4e3016;
    if ((i === 6 || i === 7) && (j === 5 || j === 6)) return 0x4e3016;
    return i % 4 === 1 ? 0x5e3a1a : pick(rnd(), [0x7a4e26, 0x86582c], [0.7, 0.3]);
  },
  [B.LEAVES]: (rnd, i, j) => {
    // Con hojitas más oscuras en racimos y unos huequitos por donde se ve el cielo.
    const r = rnd();
    if (r > 0.93 && i > 0 && i < 15 && j > 0 && j < 15) return null;
    return pick(r, [0x3fa34d, 0x2e8b3d, 0x5fc46a], [0.5, 0.33, 0.1]);
  },
  [B.COAL]: orePainter(0x2b2b2b, 0x4a4a4a),
  [B.IRON]: orePainter(0xd8a47a, 0xf0c8a0),
  [B.GOLD]: orePainter(0xffd23f, 0xfff08a),
  [B.DIAMOND]: orePainter(0x2fd0d8, 0xbafcff),
  [B.PLANKS]: (rnd, i, j) => {
    if (j % 4 === 3) return 0x8a5a2c;
    const row = Math.floor(j / 4);
    if (i === (row % 2 ? 4 : 11)) return 0x8a5a2c;
    return pick(rnd(), [0xc08a4c, 0xd49d5c, 0xb07c40], [0.7, 0.15, 0.15]);
  },
  [B.LADDER]: (rnd, i, j) => {
    if (i === 2 || i === 3 || i === 12 || i === 13) return i === 2 || i === 12 ? 0x6e4420 : 0x8a5a2c;
    if (j % 5 === 2 && i > 3 && i < 12) return 0xa86f3a;
    return null;
  },
  [B.DOOR]: (rnd, i, j) => {
    if (i === 0 || i === 15 || j === 0 || j === 15) return 0x6e4420;
    if (i >= 4 && i <= 11 && j >= 2 && j <= 6) return i === 4 || j === 2 ? 0x6fb4f0 : 0x9fd8ff;
    if (i === 11 && j === 9) return 0xffd23f;
    if (j === 10 || i === 8) return 0x8a5a2c;
    return pick(rnd(), [0xa86f3a, 0xb47a44], [0.8, 0.2]);
  },
  [B.TORCH]: (rnd, i, j) => {
    if ((i === 7 || i === 8) && j >= 7) return i === 7 ? 0x8a5a2c : 0x6e4420;
    if (i >= 6 && i <= 9 && j >= 2 && j <= 6) {
      if (j <= 3) return i === 7 || i === 8 ? 0xfff3a0 : null;
      return i === 6 || i === 9 ? 0xff9a3c : 0xffd23f;
    }
    return null;
  },
  [B.BED]: (rnd, i, j) => {
    if (j < 7) return null;
    if (j >= 8 && j <= 10 && i >= 1 && i <= 4) return j === 8 ? 0xe6e6e6 : 0xffffff;
    if (j >= 7 && j <= 11 && i >= 5) return j === 7 ? 0xff7a72 : i % 4 === 0 ? 0xc62828 : 0xe53935;
    if (j >= 12 && j <= 13) return 0x8a5a2c;
    if (j >= 14 && (i <= 1 || i >= 14)) return 0x6e4420;
    return null;
  },
  [B.GLASS]: (rnd, i, j) => {
    if (i === 0 || i === 15 || j === 0 || j === 15) return [0xe8fbff, 0.95];
    if (i + j === 6 || i + j === 7 || i + j === 15) return [0xffffff, 0.75];
    return [0xcff4ff, 0.22];
  },
  [B.BRICKS]: (rnd, i, j) => {
    if (j % 4 === 3) return 0x5f5f66;
    const row = Math.floor(j / 4);
    if (i % 8 === (row % 2 ? 3 : 7)) return 0x5f5f66;
    return pick(rnd(), [0x9a9aa2, 0xb0b0b8, 0x8a8a92], [0.6, 0.25, 0.15]);
  },
  [B.FLOWER_RED]: flowerPainter(0xff4d4d, 0xffd23f),
  [B.FLOWER_YELLOW]: flowerPainter(0xffd23f, 0xff9a3c),
  [B.WOOL]: (rnd, i, j) => ((i * 3 + j * 5) % 7 === 0 ? 0xdcdcdc : pick(rnd(), [0xf6f6f6, 0xe9e9e9], [0.75, 0.25])),
  [B.TABLE]: (rnd, i, j) => {
    if (j <= 3) {
      // Arriba: la tabla con un martillito y un serrucho.
      if (j === 1 && i >= 2 && i <= 6) return 0x5a5a62;
      if (j === 2 && i === 4) return 0x8a5a2c;
      if ((j === 1 || j === 2) && i >= 9 && i <= 13) return j === 1 ? 0xc9c9d0 : 0x9a9aa2;
      return j === 3 ? 0x8a5a2c : pick(rnd(), [0xd49d5c, 0xc08a4c], [0.7, 0.3]);
    }
    if (i <= 1 || i >= 14) return 0x6e4420;
    if (i >= 4 && i <= 11 && j >= 6 && j <= 13 && (i % 3 === 1 || j % 3 === 0)) return 0x6e4420;
    return pick(rnd(), [0xa86f3a, 0xb47a44], [0.75, 0.25]);
  },
  [B.BEDROCK]: (rnd) => pick(rnd(), [0x3a3a40, 0x26262a, 0x55555c], [0.5, 0.3, 0.2]),
  [B.SNOW]: (rnd, i, j) => {
    const edge = j < 3 || (j === 3 && rnd() < 0.6) || (j === 4 && rnd() < 0.25);
    if (edge) return pick(rnd(), [0xffffff, 0xe6f2ff], [0.75, 0.25]);
    return dirtPixel(rnd);
  },
  [B.CACTUS]: (rnd, i, j) => {
    if (i <= 1 || i >= 14) return null;
    if (i === 2 || i === 13) return 0x2a7a36;
    if ((i === 5 || i === 10) && j % 4 === 1) return 0xf4f4f4;
    if (i === 5 || i === 10) return 0x2a7a36;
    return pick(rnd(), [0x3faa4f, 0x4cbb5c], [0.75, 0.25]);
  },
};
const BACK_OF = { [BACK.DIRT]: B.DIRT, [BACK.STONE]: B.STONE, [BACK.SAND]: B.SAND };

// Dibuja todos los bloques en una textura (una vez por partida; si ya existe, la reusa).
export function makeBlockTextures(scene) {
  if (scene.textures.exists(TILES)) return;
  const texture = scene.textures.createCanvas(TILES, CELL * TILE_COUNT, CELL);
  const ctx = texture.context;
  for (let id = 1; id < TILE_COUNT; id += 1) {
    const back = BACK_OF[id];
    const painter = PAINTERS[back ?? id];
    const random = seeded(id * 7919 + 13);
    // Las manchitas van de 2x2 pixeles (y de vez en cuando uno suelto), para que no se vea como "lluvia" de la tele.
    const coarse = Array.from({ length: (PIXELS / 2) ** 2 }, random);
    const ox = id * CELL + 1;
    for (let j = 0; j < PIXELS; j += 1) {
      for (let i = 0; i < PIXELS; i += 1) {
        const loose = random() < 0.18 ? random() : null;
        const rnd = () => loose ?? coarse[(j >> 1) * (PIXELS / 2) + (i >> 1)];
        const out = painter(rnd, i, j);
        if (out === null) continue;
        const [color, alpha] = Array.isArray(out) ? out : [out, 1];
        ctx.fillStyle = css(back ? darken(color, 0.42) : color, alpha);
        // (Las orillas se estiran 1 pixel para tapar la orilla repetida del cuadro.)
        const x = ox + i * PX - (i === 0 ? 1 : 0);
        const y = 1 + j * PX - (j === 0 ? 1 : 0);
        const w = PX + (i === 0 ? 1 : 0) + (i === PIXELS - 1 ? 1 : 0);
        const h = PX + (j === 0 ? 1 : 0) + (j === PIXELS - 1 ? 1 : 0);
        ctx.fillRect(x, y, w, h);
      }
    }
    texture.add(frameOf(id), 0, ox, 1, T, T);
  }
  texture.refresh();
  texture.setFilter(NEAREST);
}

// Phaser.Textures.FilterMode.NEAREST: al acercar o alejar, los pixeles se quedan cuadrados. (Sin importar Phaser, para
// que el mundo se pueda probar con node.)
const NEAREST = 1;

// Para el mapa de cuadritos: la textura con 1 pixel de margen y 2 entre cuadros.
export const TILESET = { margin: 1, spacing: 2 };

function css(color, alpha) {
  return `rgba(${(color >> 16) & 0xff}, ${(color >> 8) & 0xff}, ${color & 0xff}, ${alpha})`;
}
