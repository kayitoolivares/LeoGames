// Revisa los niveles de Súper Bolitas:
//   1. Que se pueda llegar a la meta (y a la bandera secreta, si hay) saltando. Sin contar enemigos; las plataformas
//      que se mueven cuentan donde empiezan y las puertas te llevan a su pareja. Con bloques de colores (r, i) se
//      revisa con los rojos (como empieza el nivel) y, si hay bloque ! para cambiarlos, también con los azules: con
//      cualquiera de los dos se tiene que poder pasar.
//   2. Que ningún bloque sorpresa o ladrillo (de los que tienen aire abajo) esté encima de un hoyo, lava o agua: al
//      brincar para pegarle, uno se caería.
//   3. Que a cada bloque sorpresa o ladrillo se le pueda pegar por abajo (que quepa uno abajo y que no esté muy alto).
//   4. Que cada nivel tenga sus 3 monedas grandes.
// (Si el nivel tiene botón P, los ladrillos cuentan como que se pueden atravesar: el botón los vuelve monedas.)
// Uso: node tools/plat-check.mjs
import { LEVELS, Level, SECRETS } from '../src/games/plat/levels.js';
import { BLOCKS, isSolid } from '../src/games/plat/tiles.js';

// El salto: hasta 4 cuadritos para arriba y, a la misma altura, hasta 7 de lado (menos si sube, más si baja).
const MAX_UP = 4;
const MAX_SIDE = 7;
// Debajo de un bloque (y a cada lado) tiene que haber piso a menos de esto.
const BLOCK_FLOOR = 6;

let problems = 0;
for (const info of [...LEVELS, ...SECRETS]) {
  const level = new Level(info.spec);
  const plat = new Set();
  for (const e of level.entities) {
    if (e.ch === 'm' || e.ch === 'u' || e.ch === 'y') for (const dc of [-1, 0, 1]) plat.add(`${e.col + dc},${e.row}`);
    if (e.ch === 'z') plat.add(`${e.col},${e.row}`);
    if (e.ch === 'R') plat.add(`spring:${e.col},${e.row}`);
  }
  const colored = (c, r) => 'ri'.includes(level.at(c, r));
  // Con botón P, los ladrillos se pueden volver monedas (se atraviesan).
  const switchable = level.entities.some((e) => e.ch === 'P');
  let red = true;
  const solid = (c, r) => (colored(c, r) ? (level.at(c, r) === 'r') === red : isSolid(level.at(c, r)) && !(switchable && 'Bb'.includes(level.at(c, r))));
  const floor = (c, r) => solid(c, r) || level.at(c, r) === '=' || plat.has(`${c},${r}`);
  const free = (c, r) => !solid(c, r);
  const stand = (c, r) => r >= 1 && r < 14 && free(c, r) && free(c, r - 1) && floor(c, r + 1) && level.at(c, r) !== 'L';
  const notes = [];

  // 1. ¿Se llega a la meta? (Con los rojos y, si se pueden cambiar, con los azules.)
  const start = level.start;
  const limit = level.bonus ?? level.cols;
  const doorAt = new Map(level.doors.map((d) => [`${d.col},${d.row}`, d.to]));
  const states = level.grid.some((row) => row.includes('!')) ? [true, false] : [true];
  for (const state of states) {
    red = state;
    const which = states.length > 1 ? (red ? ' (con los rojos)' : ' (con los azules)') : '';
    const seen = new Set();
    const queue = [[start.col, start.row]];
    while (queue.length) {
      const [c, r] = queue.shift();
      const key = `${c},${r}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const door = doorAt.get(key);
      if (door) queue.push([door.col, door.row]);
      const up = plat.has(`spring:${c},${r}`) ? 9 : level.water || level.at(c, r) === 'w' ? 6 : MAX_UP;
      let head = 0;
      while (head < up + 1 && r - 2 - head >= 0 && free(c, r - 2 - head)) head += 1;
      for (let dc = -(MAX_SIDE + 3); dc <= MAX_SIDE + 3; dc += 1) {
        const nc = c + dc;
        if (nc < 0 || nc >= limit) continue;
        for (let nr = r - up; nr <= 14; nr += 1) {
          if (!stand(nc, nr)) continue;
          const rise = r - nr;
          if (rise > Math.min(up, head)) continue;
          const reach = MAX_SIDE - Math.max(0, rise) + Math.min(3, Math.max(0, -rise) / 2) - (head < 3 ? 3 - head : 0);
          if (Math.abs(dc) > reach) continue;
          const top = Math.min(r, nr) - 1 - Math.min(head, 1);
          let blocked = false;
          for (let k = 1; k < Math.abs(dc) && !blocked; k += 1) {
            const cc = c + Math.sign(dc) * k;
            if (solid(cc, top) && solid(cc, top + 1)) blocked = true;
          }
          if (!blocked) queue.push([nc, nr]);
        }
      }
    }
    const reached = (e) =>
      [...seen].some((key) => {
        const [c, r] = key.split(',').map(Number);
        return Math.abs(c - e.col) <= 1 && Math.abs(r - e.row) <= 1;
      });
    const goal = level.entities.find((e) => e.ch === 'F');
    if (goal && !reached(goal)) notes.push(`no se llega a la bandera${which}`);
    if (level.arena && !reached({ col: level.arena.left + 2, row: level.arena.boss.row })) notes.push(`no se llega a la arena del jefe${which}`);
    const secret = level.entities.find((e) => e.ch === 'G');
    if (secret && !reached(secret)) notes.push(`no se llega a la bandera secreta${which}`);
  }

  // 2. Bloques encima de hoyos.
  const hasFloor = (c, r) => {
    for (let k = r + 1; k <= Math.min(14, r + BLOCK_FLOOR); k += 1) {
      const ch = level.at(c, k);
      if (ch === 'L' || ch === 'w') return false;
      if (floor(c, k) || colored(c, k)) return true;
    }
    return false;
  };
  if (!level.water) {
    level.grid.forEach((row, r) =>
      row.forEach((ch, c) => {
        if (!BLOCKS.has(ch) || c >= limit || level.at(c, r + 1) !== ' ') return;
        const bad = [c - 1, c, c + 1].filter((cc) => !hasFloor(cc, r));
        if (bad.length) notes.push(`bloque '${ch}' en la columna ${c}, fila ${r} con hoyo abajo (columnas ${bad.join(', ')})`);
      }),
    );
  }

  // 3. Bloques que no se pueden pegar por abajo: con un solo cuadrito de aire abajo nadie cabe (el jugador chiquito
  //    mide más que un cuadrito) y con más de 5 no se alcanzan brincando.
  level.grid.forEach((row, r) =>
    row.forEach((ch, c) => {
      // (Aquí los ladrillos cuentan como pared aunque haya botón P: las paredes de ladrillos no son para pegarles.)
      const wall = (cc, rr) => isSolid(level.at(cc, rr)) || level.at(cc, rr) === '=';
      if (!BLOCKS.has(ch) || c >= limit || wall(c, r + 1)) return;
      let gap = 0;
      while (r + 1 + gap < 15 && !wall(c, r + 1 + gap)) gap += 1;
      if (r + 1 + gap >= 15) return;
      if (gap === 1) notes.push(`bloque '${ch}' en la columna ${c}, fila ${r}: un solo cuadrito abajo (nadie cabe para pegarle)`);
      if (gap > 5 && !level.water) notes.push(`bloque '${ch}' en la columna ${c}, fila ${r}: muy alto (${gap} cuadritos de aire abajo)`);
    }),
  );

  // 4. Las 3 monedas grandes.
  const big = level.entities.filter((e) => e.ch === 'O').length;
  if (big !== 3) notes.push(`tiene ${big} monedas grandes (deben ser 3)`);

  problems += notes.length;
  console.log(`${info.id} ${notes.length ? '✗' : '✓'} ${level.name}`);
  for (const note of notes) console.log(`    ${note}`);
}
console.log(problems ? `${problems} problemas` : 'Todo bien');
process.exitCode = problems ? 1 : 0;
