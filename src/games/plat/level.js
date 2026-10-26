import { BLOCKS, ROWS, T, isSemi, isSolid } from './tiles.js';

// Cómo se escriben los niveles de Súper Bolitas: por pedazos (seg) de texto, de abajo hacia arriba (lo que falta
// arriba es aire). Las letras de los cuadritos están en tiles.js; estas son las cosas que se ponen encima:
//   @ salida   F bandera (meta)   G bandera secreta (abre un nivel secreto)   C banderín (si pierden, empiezan ahí)
//   o moneda   O moneda grande (3 por nivel)   R resorte   D dinosaurio   P botón P (las monedas se vuelven
//   ladrillos y los ladrillos monedas un ratito)   d puerta (arriba en el stick: te lleva a la siguiente puerta;
//   van por pares de izquierda a derecha)   K el jefe o el mini jefe (en su arena, entre paredes)
//   Enemigos: g hongo malo  t tortuga  v murciélago  q pájaro  n nube mala  f pez  j medusa  e erizo
//             x bola de fuego (sale de la lava)  a aplastador  k planta (arriba de un tubo)  c cangrejo
//             p pingüino  l carámbano  N bola de nieve  J galleta  Q dona  A paleta  W chicle  h fantasma
//             E esqueleto  V vela  w marcianito  T ovni  I robotito
//   Plataformas: m se mueve de lado   u sube y baja   y da vueltas   z se cae cuando la pisas
// Tubos secretos: un 1 justo arriba de la boca de un tubo = entrar ahí (abajo en el stick) te lleva a donde está el
// 2; el 3 te lleva al 4. Lo que está desde la columna `bonus` es un cuarto secreto aparte.
const ENTITIES = new Set('@FGCoORDPdKgtvqnfjexakcpNJQAWhEVlmuyz1234wTI');

export function seg(text) {
  const lines = text.replace(/^\n/, '').split('\n');
  while (lines.length < ROWS) lines.unshift('');
  const width = Math.max(...lines.map((l) => l.length));
  return lines.slice(-ROWS).map((l) => l.padEnd(width, ' '));
}

export function join(...segments) {
  return Array.from({ length: ROWS }, (_, r) => segments.map((s) => s[r]).join(''));
}

// Un nivel ya leído: los cuadritos (grid) y las cosas (entities).
export class Level {
  constructor(spec) {
    Object.assign(this, spec);
    this.spec = spec;
    this.cols = spec.rows[0].length;
    this.grid = spec.rows.map((row) => row.split(''));
    this.entities = [];
    this.grid.forEach((row, r) =>
      row.forEach((ch, c) => {
        if (!ENTITIES.has(ch)) return;
        this.entities.push({ ch, col: c, row: r, x: c * T + T / 2, y: (r + 1) * T });
        row[c] = ' ';
      }),
    );
    this.width = this.cols * T;
    this.height = ROWS * T;
    this.start = this.entities.find((e) => e.ch === '@') ?? { x: 2 * T, y: 12 * T, col: 2, row: 11 };
    // La arena del jefe: entre las paredes a los lados de la K. Su pared izquierda tiene una puerta (3 cuadritos
    // abajo) que se cierra cuando empieza la pelea.
    const k = this.entities.find((e) => e.ch === 'K');
    this.arena = null;
    if (k) {
      let left = k.col;
      while (left > 0 && this.at(left, k.row) !== 'X') left -= 1;
      let right = k.col;
      while (right < this.cols - 1 && this.at(right, k.row) !== 'X') right += 1;
      const door = [k.row - 2, k.row - 1, k.row];
      for (const row of door) this.set(left, row, ' ');
      this.arena = { left, right, door, boss: k };
    }
    const mark = (ch) => this.entities.find((e) => e.ch === ch);
    this.warps = [['1', '2'], ['3', '4']]
      .filter(([a, b]) => mark(a) && mark(b))
      .map(([a, b]) => ({ enter: { col: mark(a).col, row: mark(a).row + 1 }, exit: mark(b) }));
    // Puertas: por pares, de izquierda a derecha.
    const doors = this.entities.filter((e) => e.ch === 'd').sort((a, b) => a.col - b.col);
    this.doors = [];
    for (let i = 0; i + 1 < doors.length; i += 2) {
      doors[i].to = doors[i + 1];
      doors[i + 1].to = doors[i];
      this.doors.push(doors[i], doors[i + 1]);
    }
    if (!this.water) this.moveBlocksOverFloor();
  }

  // Los bloques (sorpresa y ladrillos) que quedaron encima de un hoyo, de lava o de agua se recorren de lado hasta
  // quedar encima de piso: al brincar para pegarles, uno se caería al hoyo.
  moveBlocksOverFloor() {
    const floorBelow = (c, r) => {
      for (let k = r + 1; k <= Math.min(ROWS - 1, r + 6); k += 1) {
        const ch = this.at(c, k);
        if (ch === 'L' || ch === 'w' || BLOCKS.has(ch)) return false;
        if (isSolid(ch) || isSemi(ch)) return true;
      }
      return false;
    };
    // Abajo del bloque tiene que haber aire hasta el piso (para pararse debajo y pegarle).
    const roomBelow = (c, r) => {
      for (let k = r + 1; k < ROWS; k += 1) {
        const ch = this.at(c, k);
        if (isSolid(ch) || isSemi(ch)) return k > r + 2;
        if (ch !== ' ') return false;
      }
      return false;
    };
    // (De abajo hacia arriba: primero se acomodan los de abajo.)
    for (let r = ROWS - 1; r >= 0; r -= 1) {
      for (let a = 0; a < this.cols; a += 1) {
        if (!BLOCKS.has(this.at(a, r))) continue;
        let b = a;
        while (BLOCKS.has(this.at(b + 1, r))) b += 1;
        // Solo los que tienen aire abajo (no las paredes ni las pilas de ladrillos).
        let hanging = true;
        for (let c = a; c <= b; c += 1) if (this.at(c, r + 1) !== ' ') hanging = false;
        if (!hanging) {
          a = b;
          continue;
        }
        const fits = (s) => {
          for (let c = a + s; c <= b + s; c += 1) {
            if ((c < a || c > b) && this.at(c, r) !== ' ') return false;
            if (!roomBelow(c, r)) return false;
          }
          for (let c = a + s - 1; c <= b + s + 1; c += 1) if (!floorBelow(c, r)) return false;
          return true;
        };
        if (!fits(0)) {
          const shift = [1, -1, 2, -2, 3, -3, 4, -4, 5, -5, 6, -6, 7, -7, 8, -8].find(fits);
          if (shift !== undefined) {
            const run = this.grid[r].slice(a, b + 1);
            for (let c = a; c <= b; c += 1) this.grid[r][c] = ' ';
            run.forEach((ch, i) => (this.grid[r][a + shift + i] = ch));
            b += shift;
          }
        }
        a = b;
      }
    }
  }

  at(col, row) {
    if (col < 0 || col >= this.cols) return 'X';
    if (row < 0) return ' ';
    if (row >= ROWS) return ' ';
    return this.grid[row][col];
  }

  set(col, row, ch) {
    if (col < 0 || col >= this.cols || row < 0 || row >= ROWS) return;
    this.grid[row][col] = ch;
  }

  isBlock(col, row) {
    return BLOCKS.has(this.at(col, row));
  }

  // ¿Esa columna es del cuarto secreto?
  inBonus(x) {
    return this.bonus !== undefined && x >= this.bonus * T;
  }
}
