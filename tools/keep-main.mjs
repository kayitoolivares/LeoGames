// Deja solo al personaje en una pose recortada de una hoja de Gemini: borra (pinta del color del fondo) lo que esté
// suelto y sea chiquito comparado con el personaje: letreros con el nombre de la pose, rayitas de movimiento,
// sombras en forma de aro... Los personajes son stickers con borde blanco, así que todo el personaje es una sola
// pieza. Las piezas sueltas de más del 12 % del personaje se dejan (por si algo sí va separado).
//
// Uso: node tools/keep-main.mjs <imagen.jpg> [<imagen.jpg> ...]   (las sobrescribe si quitó algo)
import { writeFileSync } from 'node:fs';
import sharp from 'sharp';

sharp.cache(false);

// (Bajito, como prepare-art: así la orilla suave de las letras también cuenta como parte de ellas.)
const TOLERANCE = 40;
const HALO = 2;
const KEEP = 0.12;

for (const file of process.argv.slice(2)) {
  const { data, info } = await sharp(file).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  const ref = [data[0], data[1], data[2]];
  const solid = new Uint8Array(width * height);
  for (let i = 0; i < width * height; i += 1) {
    const d = Math.hypot(data[i * 3] - ref[0], data[i * 3 + 1] - ref[1], data[i * 3 + 2] - ref[2]);
    if (d > TOLERANCE) solid[i] = 1;
  }
  // Las piezas: grupos de pixeles pegados.
  const label = new Int32Array(width * height).fill(-1);
  const sizes = [];
  const stack = [];
  for (let start = 0; start < width * height; start += 1) {
    if (!solid[start] || label[start] !== -1) continue;
    const id = sizes.length;
    let size = 0;
    stack.push(start);
    label[start] = id;
    while (stack.length) {
      const p = stack.pop();
      size += 1;
      const x = p % width;
      const y = (p - x) / width;
      for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const q = ny * width + nx;
        if (solid[q] && label[q] === -1) {
          label[q] = id;
          stack.push(q);
        }
      }
    }
    sizes.push(size);
  }
  if (!sizes.length) continue;
  const biggest = Math.max(...sizes);
  const drop = new Set(sizes.flatMap((s, id) => (s < biggest * KEEP ? [id] : [])));
  if (!drop.size) {
    console.log(`  = ${file}: nada suelto`);
    continue;
  }
  let cleared = 0;
  const paint = (i) => {
    data[i * 3] = ref[0];
    data[i * 3 + 1] = ref[1];
    data[i * 3 + 2] = ref[2];
  };
  for (let i = 0; i < width * height; i += 1) {
    if (label[i] === -1 || !drop.has(label[i])) continue;
    cleared += 1;
    // Y un poquito alrededor (lo que no es del personaje), por el borde suave del JPG.
    const x = i % width;
    const y = (i - x) / width;
    for (let dy = -HALO; dy <= HALO; dy += 1) {
      for (let dx = -HALO; dx <= HALO; dx += 1) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const q = ny * width + nx;
        if (label[q] === -1 || drop.has(label[q])) paint(q);
      }
    }
  }
  const buffer = await sharp(data, { raw: { width, height, channels: 3 } }).jpeg({ quality: 95 }).toBuffer();
  writeFileSync(file, buffer);
  console.log(`  ✓ ${file}: quité ${drop.size} piezas sueltas (${cleared} pixeles)`);
}
