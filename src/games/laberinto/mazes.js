// Los laberintos del "Laberinto come-frutas". Cada uno se escribe solo de la mitad izquierda (17 columnas: la última es
// la del centro) y el juego lo refleja para la derecha, así siempre queda parejo. Leyenda:
//   #  pared                      .  bolita (frutita chica)       o  fruta de poder (asusta a los fantasmitas)
//   (espacio)  camino sin bolita (los túneles de los lados: si la orilla está abierta, se sale por el otro lado)
//   G  casita de los fantasmitas  -  puerta de la casita (los jugadores no pasan)
//   P  donde empiezan los jugadores (4)   F  donde sale la fruta bonus
// Reglas (las revisa tests/e2e/laberinto.test.mjs): sin callejones sin salida, sin cuadros abiertos de 2x2, todo
// conectado, 4 frutas de poder, 4 lugares de jugador, una fruta bonus y la casita con su puerta arriba.

// Cada tema: su nombre y cómo se ven el piso y las paredes (orilla, brillo y los adornitos de colores). Las bolitas de
// cada tema las dibuja LaberintoScene (moras, dulces, estrellitas y dulces de maíz).
export const THEMES = {
  jardin: { name: 'Jardín', emoji: '🌻', floor: 0x163b22, wall: 0x46b04f, edge: 0x1d5e28, shine: 0x8fe08a, sprinkles: [0xffffff, 0xff9ad5, 0xffe066] },
  dulces: {
    name: 'Dulcelandia',
    emoji: '🍭',
    floor: 0x3a1838,
    wall: 0xff8fc7,
    edge: 0xb23f78,
    shine: 0xffd1e8,
    sprinkles: [0x5ad1ff, 0xffe066, 0x8ef5a0, 0xffffff],
  },
  espacio: { name: 'Espacio', emoji: '🚀', floor: 0x0a0c26, wall: 0x5b52d6, edge: 0x241d6e, shine: 0x9d97ff, sprinkles: [0xffffff, 0xfff3a0] },
  embrujada: { name: 'Casa embrujada', emoji: '🎃', floor: 0x1a1226, wall: 0x7a55a8, edge: 0x34214d, shine: 0xb69ae0, sprinkles: [0xff9a3c, 0x9fe870] },
};

const HALVES = {
  jardin: [
    '#################',
    '#o...............',
    '#.###.###.######.',
    '#.###.###.######.',
    '#................',
    '#####.###.##.###-',
    '#####.###.##.#GGG',
    '     ........#GGG',
    '#####.###.##.#GGG',
    '#####.###.##.####',
    '#...............F',
    '#.###.#.####.###.',
    '#.###.#.####.###.',
    '#.............PP.',
    '#.#####.###.####.',
    '#o...............',
    '#################',
  ],
  dulces: [
    '#################',
    '#o.....#.........',
    '#.####.#.#.#####.',
    '#.####.#.#.#####.',
    '#................',
    '###.###.####.###-',
    '###.###.####.#GGG',
    '   ..........#GGG',
    '###.###.####.#GGG',
    '###.###.####.####',
    '#...............F',
    '#.##.####.##.##.#',
    '#.##.####.##.##.#',
    '#.............PP.',
    '#.###.#####.###.#',
    '#o...............',
    '#################',
  ],
  espacio: [
    '#################',
    '#o...............',
    '#.##.###.####.###',
    '#.##.###.####.###',
    '#................',
    '#.###.####.#.###-',
    '#.###.####.#.#GGG',
    ' ............#GGG',
    '#.###.####.#.#GGG',
    '#.###.####.#.####',
    '#...............F',
    '#.####.###.###.#.',
    '#.####.###.###.#.',
    ' .............PP.',
    '#.######.####.##.',
    '#o...............',
    '#################',
  ],
  embrujada: [
    '#################',
    '#o...............',
    '#.####.####.####.',
    '#.####.####.####.',
    ' ................',
    '####.###.###.###-',
    '####.###.###.#GGG',
    '    .........#GGG',
    '####.###.###.#GGG',
    '####.###.###.####',
    '#...............F',
    '#.###.###.###.##.',
    '#.###.###.###.##.',
    '#.............PP.',
    '#.##.#####.#####.',
    '#o...............',
    '#################',
  ],
};

// El orden del recorrido.
export const MAZE_KEYS = ['jardin', 'dulces', 'espacio', 'embrujada'];

// Refleja la mitad: la columna del centro va una sola vez.
function mirror(half) {
  return half + [...half.slice(0, -1)].reverse().join('');
}

export const MAZES = Object.fromEntries(MAZE_KEYS.map((key) => [key, HALVES[key].map(mirror)]));

// Lo que se puede pisar (los jugadores no pasan por la puerta ni entran a la casita).
export const isWall = (ch) => ch === '#' || ch === undefined;
export const isHouse = (ch) => ch === 'G' || ch === '-';

// Lee un laberinto: tamaño, paredes, bolitas, frutas de poder, lugares de inicio, fruta bonus, la casita y su salida.
export function parseMaze(rows) {
  const height = rows.length;
  const width = rows[0].length;
  const dots = [];
  const powers = [];
  const starts = [];
  const house = [];
  let door = null;
  let fruit = null;
  rows.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      if (ch === '.') dots.push({ x, y });
      else if (ch === 'o') powers.push({ x, y });
      else if (ch === 'P') starts.push({ x, y });
      else if (ch === 'G') house.push({ x, y });
      else if (ch === '-') door = { x, y };
      else if (ch === 'F') fruit = { x, y };
    });
  });
  // Los jugadores empiezan del centro hacia afuera (J1 y J2 en medio).
  const center = (width - 1) / 2;
  starts.sort((a, b) => Math.abs(a.x - center) - Math.abs(b.x - center) || a.x - b.x);
  const houseRows = house.map((t) => t.y);
  const houseCols = house.map((t) => t.x);
  return {
    rows,
    width,
    height,
    dots,
    powers,
    starts,
    fruit,
    door,
    exit: door && { x: door.x, y: door.y - 1 },
    houseCenter: { x: (Math.min(...houseCols) + Math.max(...houseCols)) / 2, y: (Math.min(...houseRows) + Math.max(...houseRows)) / 2 },
    houseSpots: house.filter((t) => t.y === Math.round((Math.min(...houseRows) + Math.max(...houseRows)) / 2)),
  };
}

// El carácter de una casilla, con los túneles: en un renglón con la orilla abierta, salirse por un lado es entrar por el
// otro.
export function tileAt(maze, x, y) {
  const row = maze.rows[y];
  if (row === undefined) return '#';
  if (x < 0 || x >= maze.width) {
    if (isWall(row[0]) || isWall(row[maze.width - 1])) return '#';
    return row[((x % maze.width) + maze.width) % maze.width];
  }
  return row[x];
}

// Si es parte de un túnel (ahí los fantasmitas van más despacio).
export function inTunnel(maze, x, y) {
  const row = maze.rows[y];
  if (!row || isWall(row[0])) return false;
  return x <= 4 || x >= maze.width - 5;
}
