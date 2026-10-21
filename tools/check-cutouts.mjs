// Revisa los recortes de los personajes (public/smash/personajes/*.png) buscando dos problemas que salen al partir
// hojas de Gemini donde las poses se tocaban:
//   corte:   el dibujo quedó cortado en línea recta en una orilla (alas o sombreros "mochos"). Los recortes van pegados
//            al dibujo, pero un dibujo completo solo toca la orilla con su borde blanco; si en la orilla hay colores
//            del personaje, es que lo cortaron.
//   pedazos: piezas sueltas pegadas a la orilla (un pedazo de la pose de al lado). Las que flotan en medio, como las
//            estrellitas de mareo o los brillitos, no cuentan.
// Uso: node tools/check-cutouts.mjs [filtro]      (filtro: parte del nombre, p. ej. "caminar")
import { readdirSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const DIR = path.resolve(import.meta.dirname, '..', 'public', 'smash', 'personajes');
// Una orilla cuenta como cortada si tiene al menos estos pixeles de color (no blancos) seguidos.
const CUT_RUN = 6;
// Una pieza suelta cuenta si mide al menos esta fracción del personaje.
const PIECE = 0.002;
const filter = process.argv[2] ?? '';

const files = readdirSync(DIR).filter((f) => f.endsWith('.png') && f.includes(filter));
const bad = [];
for (const file of files) {
  const { data, info } = await sharp(path.join(DIR, file)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  const solid = (x, y) => data[(y * width + x) * 4 + 3] > 128;
  // De color: dibujo que no es el borde blanco del sticker (ni la orillita verde o magenta que deja el fondo).
  const colored = (x, y) => {
    const i = (y * width + x) * 4;
    const [r, g, b, a] = [data[i], data[i + 1], data[i + 2], data[i + 3]];
    const fringe = (g > r + 40 && g > b + 40) || (r > g + 60 && b > g + 60);
    return a === 255 && Math.min(r, g, b) < 200 && !fringe;
  };
  const longestRun = (points) => {
    let best = 0;
    let run = 0;
    for (const [x, y] of points) {
      run = colored(x, y) ? run + 1 : 0;
      best = Math.max(best, run);
    }
    return best;
  };
  const column = (x) => Array.from({ length: height }, (_, y) => [x, y]);
  const row = (y) => Array.from({ length: width }, (_, x) => [x, y]);
  const edges = { izquierda: column(0), derecha: column(width - 1), arriba: row(0), abajo: row(height - 1) };
  const cuts = Object.entries(edges)
    .filter(([, points]) => longestRun(points) >= CUT_RUN)
    .map(([side]) => side);
  // Piezas: componentes conectados de dibujo.
  const label = new Int32Array(width * height).fill(-1);
  const sizes = [];
  for (let start = 0; start < width * height; start += 1) {
    if (label[start] !== -1 || data[start * 4 + 3] <= 128) continue;
    const id = sizes.length;
    let size = 0;
    let edge = false;
    const stack = [start];
    label[start] = id;
    while (stack.length) {
      const p = stack.pop();
      size += 1;
      const x = p % width;
      const y = (p - x) / width;
      if (x === 0 || x === width - 1) edge = true;
      for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const q = ny * width + nx;
        if (label[q] === -1 && data[q * 4 + 3] > 128) {
          label[q] = id;
          stack.push(q);
        }
      }
    }
    sizes.push({ size, edge });
  }
  const main = Math.max(...sizes.map((c) => c.size));
  const pieces = sizes.filter((c) => c.size !== main && c.size >= main * PIECE && c.edge).length;
  if (cuts.length || pieces) bad.push(`${file.replace('.png', '')}: ${[cuts.length ? `cortado (${cuts.join(', ')})` : '', pieces ? `${pieces} pedazo(s) suelto(s)` : ''].filter(Boolean).join(' · ')}`);
}
console.log(bad.length ? bad.join('\n') : 'Todo bien');
console.log(`(${files.length} revisadas, ${bad.length} con problemas)`);
