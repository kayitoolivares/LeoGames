import { B, BACK, BLOCKS } from './blocks.js';

// El mundo: una cuadrícula de bloques (columnas × filas; la fila 0 es la de hasta arriba) que sale siempre igual de la
// misma semilla: colinas con pasto, desierto y nieve, lagos, árboles, flores, cuevas y minerales (carbón, hierro, oro y
// hasta abajo diamantes). Para guardarlo solo se apuntan los cuadritos que cambiaron (ver changes()).
export const COLS = 256;
export const ROWS = 64;
// Hasta esta fila llega el agua de los lagos.
const SEA = 31;
const SPAWN_FLAT = 6;
// Qué tan seguido hay árboles, flores y cactus (por columna).
const TREE_ODDS = 0.13;
const FLOWER_ODDS = 0.14;
const CACTUS_ODDS = 0.08;
// Los minerales: desde qué profundidad (bloques bajo el pasto) y qué tan raros (más alto = menos).
const ORES = {
  coal: { depth: 2, over: 0.84 },
  iron: { depth: 7, over: 0.87 },
  gold: { depth: 15, over: 0.9 },
  diamond: { depth: 22, over: 0.92 },
};

// Números "al azar" que siempre dan lo mismo para la misma posición y semilla (0 a 1).
function mixBits(h) {
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d);
  h = Math.imul(h ^ (h >>> 15), 0x846ca68b);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function hash(n, seed) {
  return mixBits(Math.imul(n, 0x27d4eb2d) ^ Math.imul(seed, 0x85ebca6b));
}

function hash2(x, y, seed) {
  return mixBits(Math.imul(x, 0x27d4eb2d) ^ Math.imul(y, 0x165667b1) ^ Math.imul(seed + 1, 0x85ebca6b));
}

const smooth = (t) => t * t * (3 - 2 * t);
const lerp = (a, b, t) => a + (b - a) * t;

// Ruido suave (0 a 1) en una y en dos dimensiones.
function noise1(x, seed) {
  const i = Math.floor(x);
  return lerp(hash(i, seed), hash(i + 1, seed), smooth(x - i));
}

function noise2(x, y, seed) {
  const i = Math.floor(x);
  const j = Math.floor(y);
  const fx = smooth(x - i);
  const fy = smooth(y - j);
  const top = lerp(hash2(i, j, seed), hash2(i + 1, j, seed), fx);
  const bottom = lerp(hash2(i, j + 1, seed), hash2(i + 1, j + 1, seed), fx);
  return lerp(top, bottom, fy);
}

export class World {
  constructor(seed) {
    this.seed = seed;
    this.cols = COLS;
    this.rows = ROWS;
    this.cells = new Uint8Array(COLS * ROWS);
    // Dónde estaba el piso de cada columna al crearse (abajo de eso, al escarbar, se ve la pared oscura de la cueva).
    this.surface = new Int16Array(COLS);
    this.biomes = [];
    // Dónde andan los animalitos al empezar: [{ kind, col }].
    this.animals = [];
    this.generate();
    this.base = this.cells.slice();
  }

  index(col, row) {
    return row * COLS + col;
  }

  inside(col, row) {
    return col >= 0 && col < COLS && row >= 0 && row < ROWS;
  }

  // Afuera por los lados y por abajo hay pared (piedra base); arriba, aire.
  get(col, row) {
    if (col < 0 || col >= COLS || row >= ROWS) return B.BEDROCK;
    if (row < 0) return B.AIR;
    return this.cells[row * COLS + col];
  }

  set(col, row, id) {
    if (!this.inside(col, row)) return;
    this.cells[row * COLS + col] = id;
  }

  // La pared de atrás (oscura) de ese cuadrito, o -1 si atrás está el cielo.
  backAt(col, row) {
    const top = this.surface[col];
    if (row <= top) return -1;
    if (this.biomes[col] === 'desierto' && row < top + 5) return BACK.SAND;
    return row < top + 4 ? BACK.DIRT : BACK.STONE;
  }

  generate() {
    const s = this.seed;
    const mid = Math.floor(COLS / 2);
    for (let c = 0; c < COLS; c += 1) {
      this.surface[c] = Math.round(21 + noise1(c / 28, s + 1) * 9 + noise1(c / 9, s + 2) * 3);
      const b = noise1(c / 60, s + 3);
      this.biomes[c] = Math.abs(c - mid) < 14 ? 'pradera' : b < 0.32 ? 'desierto' : b > 0.7 ? 'nieve' : 'pradera';
    }
    // Donde aparecen todos, plano y sin agua.
    const spawnTop = Math.min(this.surface[mid], SEA - 2);
    for (let c = mid - SPAWN_FLAT; c <= mid + SPAWN_FLAT; c += 1) this.surface[c] = spawnTop;
    // Las orillas del mundo, altas (como montañas que cierran el mundo).
    for (let c = 0; c < 4; c += 1) {
      this.surface[c] = Math.min(this.surface[c], 14 + c);
      this.surface[COLS - 1 - c] = Math.min(this.surface[COLS - 1 - c], 14 + c);
    }
    // Hasta qué fila llega el agua en cada columna: la de los valles hondos (SEA) y la de unos lagos (o un oasis).
    this.waterRow = new Int16Array(COLS).fill(SEA);
    this.lakes(mid);

    for (let c = 0; c < COLS; c += 1) {
      const top = this.surface[c];
      const biome = this.biomes[c];
      const soil = 3 + Math.floor(noise1(c / 5, s + 4) * 3);
      const wet = this.waterRow[c];
      for (let r = 0; r < ROWS; r += 1) {
        let id;
        if (r >= ROWS - 1 || (r === ROWS - 2 && hash2(c, r, s + 5) < 0.5)) id = B.BEDROCK;
        else if (r < top) id = r >= wet ? B.WATER : B.AIR;
        else if (r === top) id = biome === 'desierto' || top >= wet ? B.SAND : biome === 'nieve' ? B.SNOW : B.GRASS;
        else if (r <= top + soil) id = biome === 'desierto' ? B.SAND : B.DIRT;
        else id = this.stone(c, r, r - top);
        this.cells[this.index(c, r)] = id;
      }
    }
    this.plants(mid);
  }

  // Escarba 2 o 3 hoyas redonditas (lejos de donde empiezan) y las llena de agua hasta la orilla más baja.
  lakes(mid) {
    const count = 2 + Math.floor(hash(1, this.seed + 30) * 2);
    for (let k = 0; k < count; k += 1) {
      const width = 8 + Math.floor(hash(k, this.seed + 31) * 7);
      const start = Math.floor(10 + hash(k, this.seed + 32) * (COLS - 20 - width));
      const end = start + width;
      if (Math.abs(start + width / 2 - mid) < 18 + width / 2) continue;
      // El agua llega hasta la orilla más baja (la fila más grande) de las dos.
      const level = Math.max(this.surface[start - 1], this.surface[end + 1]);
      for (let c = start; c <= end; c += 1) {
        const depth = 1 + Math.round(3 * Math.sin((Math.PI * (c - start + 0.5)) / (width + 1)));
        this.surface[c] = Math.max(this.surface[c], level + depth);
        this.waterRow[c] = Math.min(this.waterRow[c], level);
      }
    }
  }

  // Piedra, cueva o mineral (según la profundidad `depth` bajo el pasto).
  stone(c, r, depth) {
    const s = this.seed;
    if (depth > 5 && r < ROWS - 2) {
      const cave = noise2(c / 9, r / 5, s + 6) * 0.65 + noise2(c / 4, r / 3, s + 7) * 0.35;
      if (cave > 0.66) return B.AIR;
    }
    if (depth > ORES.diamond.depth && noise2(c / 2, r / 2, s + 11) > ORES.diamond.over) return B.DIAMOND;
    if (depth > ORES.gold.depth && noise2(c / 2.5, r / 2.5, s + 10) > ORES.gold.over) return B.GOLD;
    if (depth > ORES.iron.depth && noise2(c / 3, r / 3, s + 9) > ORES.iron.over) return B.IRON;
    if (depth > ORES.coal.depth && noise2(c / 3, r / 3, s + 8) > ORES.coal.over) return B.COAL;
    return B.STONE;
  }

  // Árboles, pinos, cactus, flores y animalitos.
  plants(mid) {
    const s = this.seed;
    let lastTree = -10;
    for (let c = 3; c < COLS - 3; c += 1) {
      const top = this.surface[c];
      const biome = this.biomes[c];
      const ground = this.get(c, top);
      if (ground === B.WATER || this.get(c, top - 1) !== B.AIR || top >= this.waterRow[c]) continue;
      const nearSpawn = Math.abs(c - mid) <= SPAWN_FLAT + 1;
      const r = hash(c, s + 20);
      if (!nearSpawn && c - lastTree > 4 && r < (biome === 'desierto' ? CACTUS_ODDS : TREE_ODDS)) {
        if (biome === 'desierto') this.cactus(c, top);
        else if (biome === 'nieve') this.pine(c, top);
        else this.tree(c, top);
        lastTree = c;
        continue;
      }
      if (biome === 'pradera' && ground === B.GRASS && hash(c, s + 21) < FLOWER_ODDS) {
        this.set(c, top - 1, hash(c, s + 22) < 0.5 ? B.FLOWER_RED : B.FLOWER_YELLOW);
      }
      if (biome !== 'desierto' && !nearSpawn && hash(c, s + 23) < 0.035) {
        const kinds = biome === 'nieve' ? ['oveja', 'pollito'] : ['vaca', 'cerdito', 'oveja', 'pollito'];
        this.animals.push({ kind: kinds[Math.floor(hash(c, s + 24) * kinds.length)], col: c });
      }
    }
    // Junto a donde empiezan hay una mesa de trabajo.
    this.set(mid + 3, this.surface[mid] - 1, B.TABLE);
    // Siempre hay unos animalitos cerca de donde empiezan.
    this.animals.push({ kind: 'vaca', col: mid - 9 }, { kind: 'oveja', col: mid + 10 }, { kind: 'pollito', col: mid + 7 });
  }

  tree(c, top) {
    const h = 4 + Math.floor(hash(c, this.seed + 25) * 2);
    for (let i = 1; i <= h; i += 1) this.set(c, top - i, B.LOG);
    const cy = top - h;
    for (let dy = -2; dy <= 1; dy += 1) {
      for (let dx = -2; dx <= 2; dx += 1) {
        if ((dx * dx) / 6.5 + (dy * dy) / 3.2 > 1) continue;
        if (this.get(c + dx, cy + dy) === B.AIR) this.set(c + dx, cy + dy, B.LEAVES);
      }
    }
  }

  pine(c, top) {
    const h = 5;
    for (let i = 1; i <= h; i += 1) this.set(c, top - i, B.LOG);
    const widths = [0, 1, 1, 2, 2];
    widths.forEach((w, i) => {
      const row = top - h - 1 + i;
      for (let dx = -w; dx <= w; dx += 1) if (this.get(c + dx, row) === B.AIR) this.set(c + dx, row, B.LEAVES);
    });
  }

  cactus(c, top) {
    const h = 2 + Math.floor(hash(c, this.seed + 26) * 2);
    for (let i = 1; i <= h; i += 1) this.set(c, top - i, B.CACTUS);
  }

  // La columna del centro y la fila donde se para uno ahí (la de arriba del piso).
  spawn() {
    const col = Math.floor(COLS / 2);
    return { col, row: this.groundRow(col) - 1 };
  }

  // La primera fila (de arriba para abajo) con algo en lo que uno se para (`skipTrees`: sin contar los árboles).
  groundRow(col, skipTrees = false) {
    for (let r = 0; r < ROWS; r += 1) {
      const id = this.get(col, r);
      if (skipTrees && (id === B.LEAVES || id === B.LOG)) continue;
      if (BLOCKS[id]?.solid) return r;
    }
    return ROWS - 1;
  }

  // Los cambios respecto al mundo recién creado, en texto corto: "salto.bloque,salto.bloque..." (en base 36).
  changes() {
    const out = [];
    let last = 0;
    for (let i = 0; i < this.cells.length; i += 1) {
      if (this.cells[i] === this.base[i]) continue;
      out.push(`${(i - last).toString(36)}.${this.cells[i].toString(36)}`);
      last = i;
    }
    return out.join(',');
  }

  applyChanges(text) {
    if (!text) return;
    let i = 0;
    for (const part of text.split(',')) {
      const [step, id] = part.split('.');
      i += parseInt(step, 36);
      const value = parseInt(id, 36);
      if (i >= 0 && i < this.cells.length && Number.isFinite(value)) this.cells[i] = value;
    }
  }
}
