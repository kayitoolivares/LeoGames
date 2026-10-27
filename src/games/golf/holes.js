// Los hoyos del Minigolf (coordenadas de la pantalla, 1280x720). Cada hoyo:
//   name, par          su nombre y cuántos tiros "deberían" bastar
//   world              en qué mundo está (WORLDS): cómo se ve el fondo, el pasto y los barandales
//   shape              el pasto: uno o más polígonos [[x, y], ...]; sus orillas son barandales donde rebota la pelota
//   tee, cup           de dónde se sale y dónde está el hoyo
//   walls              barandales de adentro [x1, y1, x2, y2]
//   bumpers            hongos que rebotan fuerte { x, y, r }
//   sand, water        rectángulos { x, y, w, h }: la arena frena mucho; si cae al agua, regresa de donde tiró (+1)
//   slopes             rampas { x, y, w, h, fx, fy }: empujan la pelota hacia (fx, fy) (pixeles por segundo²)
//   windmills          molinos { x, y, length, speed }: aspas que dan vueltas (radianes por segundo)
//   movers             paredes que se mueven { x, y, w, h, dx, dy, periodMs }: van y vienen (dx, dy) desde (x, y)
//   portals            { a: [x, y], b: [x, y] }: la pelota que entra en `a` sale por `b` con la misma velocidad
//   ice                rectángulos de hielo: ahí casi no se frena
//   waves              olas { x, y, w, h, dx, dy, periodMs }: agua que va y viene como las paredes que se mueven
//   critters           animalitos { x, y, r, dx, dy, periodMs, kind }: van y vienen y avientan la pelota (cangrejo,
//                      pingüino, ovni)
//   planets            planetas { x, y, r, reach, pull }: la pelota rebota en ellos y, si pasa cerca rodando, la jalan
//   blackHoles         agujeros negros { x, y, r, reach, pull }: jalan más fuerte y si la pelota cae, regresa (+1)
const rect = (x1, y1, x2, y2) => [
  [x1, y1],
  [x2, y1],
  [x2, y2],
  [x1, y2],
];

const PRADERA = [
  {
    name: '¡A calentar!',
    par: 2,
    shape: [rect(160, 300, 1120, 500)],
    tee: [250, 400],
    cup: [1030, 400],
  },
  {
    name: 'La curva',
    par: 3,
    shape: [
      [
        [140, 520],
        [760, 520],
        [760, 120],
        [900, 120],
        [900, 660],
        [140, 660],
      ],
    ],
    tee: [220, 590],
    cup: [830, 190],
    bumpers: [{ x: 830, y: 600, r: 26 }],
  },
  {
    name: 'El molino',
    par: 3,
    shape: [rect(140, 300, 1140, 500)],
    tee: [220, 400],
    cup: [1060, 400],
    windmills: [{ x: 640, y: 400, length: 92, speed: 1.4 }],
  },
  {
    name: 'Pinball',
    par: 3,
    shape: [rect(200, 120, 1080, 660)],
    tee: [270, 590],
    cup: [990, 200],
    bumpers: [
      { x: 420, y: 300, r: 34 },
      { x: 640, y: 420, r: 38 },
      { x: 860, y: 300, r: 34 },
      { x: 520, y: 560, r: 28 },
      { x: 760, y: 560, r: 28 },
    ],
  },
  {
    name: 'Arena y agua',
    par: 3,
    shape: [rect(140, 200, 1140, 560)],
    tee: [220, 470],
    cup: [1060, 290],
    water: [{ x: 560, y: 200, w: 170, h: 230 }],
    sand: [{ x: 820, y: 390, w: 170, h: 170 }],
  },
  {
    name: 'La rampa',
    par: 3,
    shape: [rect(140, 140, 1140, 620)],
    tee: [220, 230],
    cup: [1050, 230],
    slopes: [{ x: 420, y: 140, w: 440, h: 480, fx: 0, fy: 230 }],
  },
  {
    name: 'La pared que se mueve',
    par: 3,
    shape: [rect(140, 260, 1140, 540)],
    tee: [220, 400],
    cup: [1060, 400],
    walls: [
      [640, 260, 640, 345],
      [640, 455, 640, 540],
    ],
    movers: [{ x: 618, y: 300, w: 44, h: 70, dx: 0, dy: 130, periodMs: 2400 }],
  },
  {
    name: 'Portales',
    par: 2,
    shape: [rect(140, 170, 560, 590), rect(760, 210, 1140, 550)],
    tee: [220, 380],
    cup: [1060, 380],
    portals: [{ a: [480, 380], b: [830, 380] }],
  },
  {
    name: 'La gran final',
    par: 4,
    shape: [rect(140, 120, 1140, 660)],
    tee: [220, 210],
    cup: [1060, 575],
    walls: [
      [140, 300, 980, 300],
      [300, 480, 1140, 480],
    ],
    bumpers: [{ x: 640, y: 210, r: 28 }],
    windmills: [{ x: 640, y: 390, length: 72, speed: -1.6 }],
    water: [{ x: 560, y: 560, w: 150, h: 100 }],
    sand: [{ x: 880, y: 500, w: 110, h: 160 }],
  },
];

// La Vuelta al mundo: 3 hoyos en la playa (olas, cangrejos y un puentecito), 3 en la nieve (hielo y pingüinos) y 3 en
// el espacio (planetas que jalan, ovnis y un agujero negro).
const PLAYA = [
  {
    name: 'Las olas',
    par: 3,
    shape: [rect(140, 220, 1140, 540)],
    tee: [220, 380],
    cup: [1060, 380],
    waves: [{ x: 560, y: 220, w: 160, h: 110, dx: 0, dy: 210, periodMs: 3200 }],
    sand: [
      { x: 860, y: 220, w: 120, h: 105 },
      { x: 860, y: 435, w: 120, h: 105 },
    ],
  },
  {
    name: 'Cangrejos',
    par: 3,
    shape: [rect(140, 150, 1140, 610)],
    tee: [220, 520],
    cup: [1060, 240],
    water: [{ x: 600, y: 330, w: 100, h: 100 }],
    critters: [
      { x: 470, y: 205, r: 30, dx: 0, dy: 350, periodMs: 2600, kind: 'cangrejo' },
      { x: 820, y: 555, r: 30, dx: 0, dy: -350, periodMs: 2200, kind: 'cangrejo' },
    ],
  },
  {
    name: 'El puentecito',
    par: 3,
    shape: [rect(140, 170, 1140, 590)],
    tee: [220, 380],
    cup: [1060, 380],
    water: [
      { x: 470, y: 170, w: 340, h: 175 },
      { x: 470, y: 415, w: 340, h: 175 },
    ],
    bumpers: [
      { x: 960, y: 260, r: 26 },
      { x: 960, y: 500, r: 26 },
    ],
  },
];

const NIEVE = [
  {
    name: 'Pista de hielo',
    par: 2,
    shape: [rect(160, 250, 1120, 470)],
    tee: [240, 360],
    cup: [1000, 360],
    ice: [{ x: 330, y: 250, w: 560, h: 220 }],
    bumpers: [
      { x: 1065, y: 300, r: 22 },
      { x: 1065, y: 420, r: 22 },
    ],
  },
  {
    name: 'Pingüinos',
    par: 3,
    shape: [
      [
        [140, 160],
        [1140, 160],
        [1140, 610],
        [860, 610],
        [860, 330],
        [140, 330],
      ],
    ],
    tee: [220, 245],
    cup: [1000, 540],
    ice: [{ x: 860, y: 330, w: 280, h: 130 }],
    critters: [
      { x: 470, y: 195, r: 26, dx: 0, dy: 100, periodMs: 1600, kind: 'pinguino' },
      { x: 700, y: 295, r: 26, dx: 0, dy: -100, periodMs: 1900, kind: 'pinguino' },
      { x: 905, y: 430, r: 26, dx: 190, dy: 0, periodMs: 2400, kind: 'pinguino' },
    ],
  },
  {
    name: 'El laberinto helado',
    par: 4,
    shape: [rect(140, 130, 1140, 650)],
    tee: [220, 220],
    cup: [1060, 560],
    walls: [
      [380, 130, 380, 470],
      [640, 310, 640, 650],
      [900, 130, 900, 470],
    ],
    ice: [
      { x: 380, y: 470, w: 260, h: 180 },
      { x: 640, y: 130, w: 260, h: 180 },
    ],
    sand: [{ x: 960, y: 300, w: 120, h: 110 }],
    bumpers: [{ x: 510, y: 560, r: 26 }],
  },
];

const ESPACIO = [
  {
    name: 'Planetas',
    par: 3,
    shape: [rect(140, 140, 1140, 620)],
    tee: [220, 380],
    cup: [1060, 380],
    planets: [
      { x: 640, y: 380, r: 60, reach: 230, pull: 700 },
      { x: 900, y: 220, r: 30, reach: 140, pull: 500 },
    ],
  },
  {
    name: 'Ovnis',
    par: 3,
    shape: [rect(140, 170, 560, 590), rect(720, 170, 1140, 590)],
    tee: [220, 380],
    cup: [1060, 300],
    portals: [{ a: [480, 380], b: [800, 380] }],
    critters: [
      { x: 350, y: 225, r: 30, dx: 0, dy: 310, periodMs: 2400, kind: 'ovni' },
      { x: 950, y: 535, r: 30, dx: 0, dy: -310, periodMs: 2000, kind: 'ovni' },
    ],
  },
  {
    name: 'El agujero negro',
    par: 4,
    shape: [rect(140, 130, 1140, 650)],
    tee: [220, 560],
    cup: [1060, 220],
    blackHoles: [{ x: 640, y: 390, r: 34, reach: 200, pull: 900 }],
    planets: [
      { x: 400, y: 260, r: 44, reach: 150, pull: 450 },
      { x: 880, y: 530, r: 44, reach: 150, pull: 450 },
    ],
    critters: [{ x: 900, y: 330, r: 26, dx: 160, dy: 0, periodMs: 2600, kind: 'ovni' }],
  },
];

export const HOLES = [
  ...PRADERA.map((hole) => ({ ...hole, world: 'pradera' })),
  ...PLAYA.map((hole) => ({ ...hole, world: 'playa' })),
  ...NIEVE.map((hole) => ({ ...hole, world: 'nieve' })),
  ...ESPACIO.map((hole) => ({ ...hole, world: 'espacio' })),
];

// Cómo se ve cada mundo: el piso de alrededor (si no ha llegado su dibujo), el pasto de la cancha, los barandales, el
// dibujo de los hongos que rebotan y los adornos de alrededor (dibujos de golf/objetos, ver npm run arte).
export const WORLDS = {
  pradera: { name: 'Pradera', emoji: '🌳', ground: 0x2f7a3f, grass: 0x6cd36c, rail: 0xb5793f, bumper: 'hongo', decor: ['arbusto', 'flores'] },
  playa: {
    name: 'Playa',
    emoji: '🏖️',
    ground: 0xe8c77a,
    grass: 0x5fd18a,
    rail: 0xd9a066,
    bumper: 'estrella-mar',
    decor: ['palmera', 'castillo', 'estrella-mar'],
  },
  nieve: { name: 'Nieve', emoji: '❄️', ground: 0xdcebf7, grass: 0xbfe6ff, rail: 0x6f9fd8, bumper: 'muneco', decor: ['pino', 'muneco', 'iglu'] },
  espacio: { name: 'Espacio', emoji: '🚀', ground: 0x0b1030, grass: 0x5b4aa8, rail: 0xc8d0e0, bumper: 'asteroide', decor: ['asteroide', 'cohete', 'planeta'] },
};

// Los recorridos: qué hoyos (de HOLES) se juegan.
const range = (from, count) => Array.from({ length: count }, (_, i) => from + i);
export const COURSES = {
  corto: { name: 'Corto (3 hoyos)', holes: [0, 2, 7] },
  pradera: { name: 'Pradera (9 hoyos)', holes: range(0, 9) },
  mundo: { name: 'Vuelta al mundo (9 hoyos)', holes: range(9, 9) },
  todo: { name: '¡Todos! (18 hoyos)', holes: range(0, 18) },
};
export const COURSE_KEYS = Object.keys(COURSES);

// Las orillas de cada polígono como segmentos [x1, y1, x2, y2] (los barandales de afuera).
export function holeEdges(hole) {
  const walls = [];
  for (const polygon of hole.shape) {
    polygon.forEach(([x1, y1], i) => {
      const [x2, y2] = polygon[(i + 1) % polygon.length];
      walls.push([x1, y1, x2, y2]);
    });
  }
  return walls;
}

// Los barandales de un hoyo como segmentos [x1, y1, x2, y2]: las orillas de cada polígono más los de adentro.
export function holeWalls(hole) {
  return [...holeEdges(hole), ...(hole.walls ?? [])];
}

// ¿El punto está sobre el pasto (dentro de alguno de los polígonos)?
export function onGrass(hole, x, y) {
  return hole.shape.some((polygon) => {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const [xi, yi] = polygon[i];
      const [xj, yj] = polygon[j];
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  });
}
