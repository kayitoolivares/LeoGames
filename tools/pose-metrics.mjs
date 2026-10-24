// Mide cada pose de los personajes (public/smash/personajes/*.png), de los jefes y de los monstruos para que en el
// juego se vean del mismo tamaño y parados en el mismo lugar al cambiar de pose (ver fitPose en src/games/smash/art.js
// y Creature en src/ui/creature.js):
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
// Cada carpeta de recortes y en qué art.json van sus medidas (las del jefe del Duelo van con las de los personajes,
// porque se pelea con ellas igual que un personaje).
const SETS = [
  ['public/smash/personajes', 'src/games/smash/art.json'],
  ['public/duelo/jefe', 'src/games/smash/art.json'],
  ['public/plat/enemigos', 'src/games/plat/art.json'],
  ['public/plat/jefes', 'src/games/plat/art.json'],
  ['public/brawl/monstruos', 'src/games/brawl/art.json'],
];
const SOLID = 128;

export async function poseMetrics(dir) {
  const metrics = {};
  const files = await readdir(dir).catch(() => []);
  for (const file of files.filter((f) => f.endsWith('.png')).sort()) {
    const { data, info } = await sharp(path.join(dir, file)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
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
  const byManifest = new Map();
  for (const [dir, manifest] of SETS) byManifest.set(manifest, { ...byManifest.get(manifest), ...(await poseMetrics(path.join(ROOT, dir))) });
  let count = 0;
  for (const [file, metrics] of byManifest) {
    const manifest = JSON.parse(await readFile(path.join(ROOT, file), 'utf8'));
    manifest.metrics = metrics;
    await writeFile(path.join(ROOT, file), `${JSON.stringify(manifest, null, 2)}\n`);
    count += Object.keys(metrics).length;
  }
  return count;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) {
  console.log(`Medidas de ${await saveMetrics()} poses guardadas`);
}
