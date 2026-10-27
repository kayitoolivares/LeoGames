// Parte una "hoja" de Gemini con varias poses (en filas, sobre fondo liso verde o magenta) en imágenes
// sueltas que luego procesa `npm run arte`. Pedir una hoja en vez de una imagen por pose gasta mucho
// menos del límite de Gemini y las poses salen más parecidas entre sí.
//
// Uso: node tools/split-sheet.mjs <hoja.jpg> <nombre> [<nombre> ...]
// Los nombres van en orden de lectura (fila por fila, de izquierda a derecha). Un nombre sin guion
// es un personaje y cuenta como sus 4 poses: normal, golpe, salto, dolor. Ejemplos:
//   node tools/split-sheet.mjs hoja.jpg astronauta                  1 fila de 4
//   node tools/split-sheet.mjs hoja.jpg abeja abeja_super           2 filas: normal arriba, súper abajo
//   node tools/split-sheet.mjs hoja.jpg hada-dolor pinguino_super-golpe
//   node tools/split-sheet.mjs hoja.jpg pow zas --to duelo/efectos    en otra carpeta de arte/
//   ... --any-size   si a propósito una pose es mucho más grande (un jefe junto a sus monstruitos)
// Escribe arte/smash/personajes/<nombre>.jpg (o arte/<carpeta>/<nombre>.jpg con --to).
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

const POSES = ['normal', 'golpe', 'salto', 'dolor'];
const ROOT = path.resolve(import.meta.dirname, '..');
const toAt = process.argv.indexOf('--to');
const DEST = path.join(ROOT, 'arte', ...(toAt > 0 ? process.argv[toAt + 1].split('/') : ['smash', 'personajes']));
mkdirSync(DEST, { recursive: true });
// Margen alrededor de cada pose (en pixeles de la hoja) y tamaño mínimo de una pieza suelta.
const MARGIN = 40;
const NOISE = 40;

const anySize = process.argv.includes('--any-size');
const [input, ...args] = process.argv.slice(2, toAt > 0 ? toAt : undefined).filter((a) => a !== '--any-size');
// Con --to son nombres sueltos (no personajes con sus 4 poses).
const names = args.flatMap((name) => (name.includes('-') || toAt > 0 ? [name] : POSES.map((pose) => `${name}-${pose}`)));
if (!input || !names.length) {
  console.log('Uso: node tools/split-sheet.mjs <hoja.jpg> <nombre> [<nombre> ...]');
  process.exit(1);
}

const { data, info } = await sharp(input).removeAlpha().raw().toBuffer({ resolveWithObject: true });
const { width, height } = info;
// El color de fondo se toma de la esquina. Si es verde, además cuenta como fondo cualquier verde chillón
// (la sombrita que a veces pone Gemini bajo la pose de salto es verde más oscuro). Con fondo magenta
// (personajes verdes, como Dino) no, porque se borraría el personaje.
const ref = [data[0], data[1], data[2]];
const greenScreen = ref[1] > ref[0] + 40 && ref[1] > ref[2] + 40;
const isBackground = (p) => {
  const i = p * 3;
  const [r, g, b] = [data[i], data[i + 1], data[i + 2]];
  return Math.hypot(r - ref[0], g - ref[1], b - ref[2]) < 90 || (greenScreen && g > 120 && g - Math.max(r, b) > 60);
};

// Piezas conectadas: el borde blanco de sticker une cada pose en una sola pieza grande.
const label = new Int32Array(width * height).fill(-1);
const pieces = [];
for (let start = 0; start < width * height; start += 1) {
  if (label[start] !== -1 || isBackground(start)) continue;
  const piece = { id: pieces.length, size: 0, left: width, top: height, right: 0, bottom: 0 };
  label[start] = piece.id;
  const stack = [start];
  while (stack.length) {
    const p = stack.pop();
    const x = p % width;
    const y = (p - x) / width;
    piece.size += 1;
    piece.left = Math.min(piece.left, x);
    piece.right = Math.max(piece.right, x);
    piece.top = Math.min(piece.top, y);
    piece.bottom = Math.max(piece.bottom, y);
    for (const q of [x > 0 ? p - 1 : -1, x < width - 1 ? p + 1 : -1, y > 0 ? p - width : -1, y < height - 1 ? p + width : -1]) {
      if (q >= 0 && label[q] === -1 && !isBackground(q)) {
        label[q] = piece.id;
        stack.push(q);
      }
    }
  }
  pieces.push(piece);
}

// Si dos poses quedaron pegadas (los bordes blancos se tocan en un puntito: pasa mucho con los cuadros de
// caminar, o con la cresta de una pose de abajo que llega a los pies de la de arriba), la pieza más grande se
// corta por donde menos se tocan: la columna o la fila de en medio con menos pixeles. Se repite hasta que haya
// tantas piezas grandes como poses.
const bySize = () => [...pieces].sort((a, b) => b.size - a.size);
const enoughPoses = () => {
  const sorted = bySize();
  return sorted.length >= names.length && sorted[names.length - 1].size > sorted[0].size * 0.25;
};
// La mejor línea para cortar la pieza: en x (columna) o en y (fila), entre el 30% y el 70% de su ancho o alto.
const bestCut = (piece, vertical) => {
  const [from, to] = vertical ? [piece.left, piece.right] : [piece.top, piece.bottom];
  const [acrossFrom, acrossTo] = vertical ? [piece.top, piece.bottom] : [piece.left, piece.right];
  let cut = -1;
  let fewest = Infinity;
  for (let t = Math.round(from + (to - from) * 0.3); t <= from + (to - from) * 0.7; t += 1) {
    let count = 0;
    for (let a = acrossFrom; a <= acrossTo; a += 1) if (label[vertical ? a * width + t : t * width + a] === piece.id) count += 1;
    if (count < fewest) [fewest, cut] = [count, t];
  }
  return { cut, fewest };
};
let forced = 0;
for (let tries = 0; tries < names.length && !enoughPoses(); tries += 1) {
  forced += 1;
  const merged = bySize()[0];
  const byColumn = bestCut(merged, true);
  const byRow = bestCut(merged, false);
  const vertical = byColumn.fewest <= byRow.fewest;
  const { cut } = vertical ? byColumn : byRow;
  const other = { id: pieces.length, size: 0, left: width, top: height, right: 0, bottom: 0 };
  Object.assign(merged, { size: 0, left: width, top: height, right: 0, bottom: 0 });
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const p = y * width + x;
      if (label[p] !== merged.id) continue;
      const piece = (vertical ? x : y) > cut ? other : merged;
      label[p] = piece.id;
      piece.size += 1;
      piece.left = Math.min(piece.left, x);
      piece.right = Math.max(piece.right, x);
      piece.top = Math.min(piece.top, y);
      piece.bottom = Math.max(piece.bottom, y);
    }
  }
  pieces.push(other);
}

// Las piezas más grandes son las poses. Se acomodan en filas (las que se enciman en altura son de
// la misma fila) y cada fila de izquierda a derecha.
const poses = bySize().slice(0, names.length);
if (poses.length < names.length) throw new Error(`solo encontré ${poses.length} poses en la hoja y pediste ${names.length}`);
const sizes = poses.map((pose) => pose.size).sort((a, b) => a - b);
if (!anySize && sizes.at(-1) > sizes[Math.floor(sizes.length / 2)] * 2.5) {
  throw new Error('una pose es mucho más grande que las demás: ¿dos poses se tocan en la hoja? Pide más espacio entre ellas');
}
const rows = [];
for (const pose of [...poses].sort((a, b) => a.top - b.top)) {
  const center = (pose.top + pose.bottom) / 2;
  const row = rows.find((r) => center > r.top && center < r.bottom);
  if (row) row.poses.push(pose);
  else rows.push({ top: pose.top, bottom: pose.bottom, poses: [pose] });
}
const ordered = rows.flatMap((row) => row.poses.sort((a, b) => a.left - b.left));
console.log(`  ${rows.length} fila(s): ${rows.map((row) => row.poses.length).join(' + ')} poses`);
// Cortar poses pegadas casi siempre deja algo mocho (un ala, la punta de un sombrero) o un pedazo de la de al lado.
if (forced) console.log(`  ⚠ ${forced} vez/veces hubo que separar poses que se tocaban: revisa con node tools/check-cutouts.mjs (o pide la hoja otra vez en 2 filas de 2)`);

// Las piezas sueltas (estrellitas de mareo, gotas, chispas) se le dan a la pose más cercana; el ruido se ignora,
// y también las piezas sueltas grandes (copias borrosas o estelas que a veces dibuja Gemini).
const owner = new Map(ordered.map((pose, k) => [pose.id, k]));
const boxes = ordered.map((pose) => ({ ...pose }));
const junk = sizes[0] * 0.12;
for (const piece of pieces) {
  if (owner.has(piece.id) || piece.size < NOISE || piece.size > junk) continue;
  const cx = (piece.left + piece.right) / 2;
  const cy = (piece.top + piece.bottom) / 2;
  const distance = (box) => Math.hypot(Math.max(box.left - cx, 0, cx - box.right), Math.max(box.top - cy, 0, cy - box.bottom));
  const k = ordered.reduce((best, pose, i) => (distance(pose) < distance(ordered[best]) ? i : best), 0);
  owner.set(piece.id, k);
  const box = boxes[k];
  box.left = Math.min(box.left, piece.left);
  box.right = Math.max(box.right, piece.right);
  box.top = Math.min(box.top, piece.top);
  box.bottom = Math.max(box.bottom, piece.bottom);
}

// Cada pose se recorta con su margen; lo que sea de otra pose (un puño que se mete) se pinta de fondo.
for (const [k, name] of names.entries()) {
  const box = boxes[k];
  const left = Math.max(0, box.left - MARGIN);
  const top = Math.max(0, box.top - MARGIN);
  const w = Math.min(width - 1, box.right + MARGIN) - left + 1;
  const h = Math.min(height - 1, box.bottom + MARGIN) - top + 1;
  const out = Buffer.alloc(w * h * 3);
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const p = (y + top) * width + (x + left);
      const mine = label[p] === -1 || owner.get(label[p]) === k;
      out.set(mine ? [data[p * 3], data[p * 3 + 1], data[p * 3 + 2]] : ref, (y * w + x) * 3);
    }
  }
  const file = path.join(DEST, `${name}.jpg`);
  await sharp(out, { raw: { width: w, height: h, channels: 3 } }).jpeg({ quality: 95 }).toFile(file);
  console.log(`  ✓ ${path.relative(ROOT, file)} (${w}x${h})`);
}
