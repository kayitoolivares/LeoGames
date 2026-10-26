// Los hoyos del Minigolf (coordenadas de la pantalla, 1280x720). Cada hoyo:
//   name, par          su nombre y cuántos tiros "deberían" bastar
//   shape              el pasto: uno o más polígonos [[x, y], ...]; sus orillas son barandales donde rebota la pelota
//   tee, cup           de dónde se sale y dónde está el hoyo
//   walls              barandales de adentro [x1, y1, x2, y2]
//   bumpers            hongos que rebotan fuerte { x, y, r }
//   sand, water        rectángulos { x, y, w, h }: la arena frena mucho; si cae al agua, regresa de donde tiró (+1)
//   slopes             rampas { x, y, w, h, fx, fy }: empujan la pelota hacia (fx, fy) (pixeles por segundo²)
//   windmills          molinos { x, y, length, speed }: aspas que dan vueltas (radianes por segundo)
//   movers             paredes que se mueven { x, y, w, h, dx, dy, periodMs }: van y vienen (dx, dy) desde (x, y)
//   portals            { a: [x, y], b: [x, y] }: la pelota que entra en `a` sale por `b` con la misma velocidad
const rect = (x1, y1, x2, y2) => [
  [x1, y1],
  [x2, y1],
  [x2, y2],
  [x1, y2],
];

export const HOLES = [
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

// Los barandales de un hoyo como segmentos [x1, y1, x2, y2]: las orillas de cada polígono más los de adentro.
export function holeWalls(hole) {
  const walls = [];
  for (const polygon of hole.shape) {
    polygon.forEach(([x1, y1], i) => {
      const [x2, y2] = polygon[(i + 1) % polygon.length];
      walls.push([x1, y1, x2, y2]);
    });
  }
  return [...walls, ...(hole.walls ?? [])];
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
