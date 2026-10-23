// Revisa los niveles de Súper Bolitas: (1) que se pueda llegar a la meta saltando (sin contar enemigos; las
// plataformas que se mueven cuentan donde empiezan) y (2) que ningún bloque sorpresa o ladrillo esté encima de un
// hoyo o de lava (al brincar para pegarle, uno se cae).  Uso: node tools/plat-check.mjs
import { LEVELS, Level } from '../src/games/plat/levels.js';
import { BLOCKS, isSolid } from '../src/games/plat/tiles.js';

// El salto: hasta 4 cuadritos para arriba y, a la misma altura, hasta 7 de lado (menos si sube, más si baja).
const MAX_UP = 4;
const MAX_SIDE = 7;
// Debajo de un bloque (y a cada lado) tiene que haber piso a menos de esto.
const BLOCK_FLOOR = 5;

let problems = 0;
for (const info of LEVELS) {
  const level = new Level(info.spec);
  const plat = new Set();
  for (const e of level.entities) {
    if (e.ch === 'm' || e.ch === 'u') for (const dc of [-1, 0, 1]) plat.add(`${e.col + dc},${e.row}`);
    if (e.ch === 'z') plat.add(`${e.col},${e.row}`);
    if (e.ch === 'R') plat.add(`spring:${e.col},${e.row}`);
  }
  const solid = (c, r) => isSolid(level.at(c, r));
  const floor = (c, r) => solid(c, r) || level.at(c, r) === '=' || plat.has(`${c},${r}`);
  const free = (c, r) => !solid(c, r);
  const stand = (c, r) => r >= 1 && r < 14 && free(c, r) && free(c, r - 1) && floor(c, r + 1) && level.at(c, r) !== 'L';
  const notes = [];

  // (1) ¿Se llega a la meta?
  const start = level.start;
  const goal = level.entities.find((e) => e.ch === 'F')?.col ?? (level.arena ? level.arena.left + 2 : level.cols - 2);
  const limit = level.bonus ?? level.cols;
  const seen = new Set();
  const queue = [[start.col, start.row]];
  let best = start.col;
  while (queue.length) {
    const [c, r] = queue.shift();
    const key = `${c},${r}`;
    if (seen.has(key)) continue;
    seen.add(key);
    best = Math.max(best, c);
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
  if (best < goal - 1) notes.push(`no se llega a la meta (llega a la columna ${best} de ${goal})`);

  // (2) Bloques encima de hoyos.
  const hasFloor = (c, r) => {
    for (let k = r + 1; k <= Math.min(14, r + BLOCK_FLOOR); k += 1) if (floor(c, k)) return true;
    return false;
  };
  level.grid.forEach((row, r) =>
    row.forEach((ch, c) => {
      if (!BLOCKS.has(ch) || c >= limit) return;
      if (level.water) return;
      const bad = [c - 1, c, c + 1].filter((cc) => !hasFloor(cc, r));
      if (bad.length) notes.push(`bloque '${ch}' en la columna ${c}, fila ${r} con hoyo abajo (columnas ${bad.join(', ')})`);
    }),
  );

  problems += notes.length;
  console.log(`${info.id} ${notes.length ? '✗' : '✓'} ${level.name}`);
  for (const note of notes) console.log(`    ${note}`);
}
console.log(problems ? `${problems} problemas` : 'Todo bien');
process.exitCode = problems ? 1 : 0;
