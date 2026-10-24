// Mide cada pose de los personajes (public/smash/personajes/*.png) para que en el juego se vean del mismo tamaño y
// parados en el mismo lugar al cambiar de pose (ver fitPose en src/games/smash/art.js):
//   área: cuántos pixeles pinta el personaje (el cuerpo "pesa" lo mismo en todas las poses, aunque con los brazos
//         arriba la imagen sea más alta o agachado más bajita);
//   centro: dónde está el cuerpo de lado a lado (la mediana de lo pintado, como fracción del ancho): con un brazo o
//           una pierna estirada la imagen se hace más ancha, pero el cuerpo no se mueve;
//   alto: el alto de la imagen (para la pose normal, que es la que manda el tamaño).
// prepare-art lo corre solo; a mano: node tools/pose-metrics.mjs
import { readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = path.resolve(import.meta.dirname, '..');
const DIR = path.join(ROOT, 'public', 'smash', 'personajes');
const MANIFEST = path.join(ROOT, 'src', 'games', 'smash', 'art.json');
const SOLID = 128;

export async function poseMetrics() {
  const metrics = {};
  for (const file of (await readdir(DIR)).filter((f) => f.endsWith('.png')).sort()) {
    const { data, info } = await sharp(path.join(DIR, file)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const { width, height } = info;
    const columns = new Array(width).fill(0);
    let area = 0;
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        if (data[(y * width + x) * 4 + 3] < SOLID) continue;
        columns[x] += 1;
        area += 1;
      }
    }
    // La mediana de lo pintado, de lado a lado.
    let seen = 0;
    let median = width / 2;
    for (let x = 0; x < width; x += 1) {
      seen += columns[x];
      if (seen >= area / 2) {
        median = x + 0.5;
        break;
      }
    }
    metrics[file.replace(/\.png$/, '')] = [area, Math.round((median / width) * 1000) / 1000, height];
  }
  return metrics;
}

export async function saveMetrics() {
  const manifest = JSON.parse(await readFile(MANIFEST, 'utf8'));
  manifest.metrics = await poseMetrics();
  await writeFile(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);
  return Object.keys(manifest.metrics).length;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) {
  console.log(`Medidas de ${await saveMetrics()} poses guardadas en src/games/smash/art.json`);
}
