// A veces Gemini escribe un letrero abajo de un dibujo ("Nube de polvo"). Esto lo quita: busca, de abajo hacia
// arriba, el último bloque de renglones con algo dibujado que esté separado del resto por una franja de puro fondo,
// y recorta la imagen justo antes de él. El fondo es el color de la esquina de arriba a la izquierda.
//
// Uso: node tools/trim-label.mjs <imagen.jpg> [<imagen.jpg> ...]   (las sobrescribe)
import { writeFileSync } from 'node:fs';
import sharp from 'sharp';

// (En Windows, sharp deja abierto el archivo que leyó si guarda caché: así no se puede sobrescribir.)
sharp.cache(false);

const GAP = 12; // renglones de puro fondo que separan el letrero del dibujo
const TOLERANCE = 90;

for (const file of process.argv.slice(2)) {
  const { data, info } = await sharp(file).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  const ref = [data[0], data[1], data[2]];
  const busy = (y) => {
    for (let x = 0; x < width; x += 2) {
      const i = (y * width + x) * 3;
      if (Math.hypot(data[i] - ref[0], data[i + 1] - ref[1], data[i + 2] - ref[2]) > TOLERANCE) return true;
    }
    return false;
  };
  // De abajo hacia arriba: primero el letrero, luego la franja vacía, luego el dibujo.
  let y = height - 1;
  while (y > 0 && !busy(y)) y -= 1;
  const labelBottom = y;
  while (y > 0 && busy(y)) y -= 1;
  let empty = 0;
  while (y > 0 && !busy(y)) {
    empty += 1;
    y -= 1;
  }
  if (empty < GAP || y <= 0 || labelBottom - y > height * 0.4) {
    console.log(`  = ${file}: sin letrero`);
    continue;
  }
  const cut = Math.min(height, y + Math.ceil(empty / 2));
  const buffer = await sharp(file).extract({ left: 0, top: 0, width, height: cut }).jpeg({ quality: 95 }).toBuffer();
  writeFileSync(file, buffer);
  console.log(`  ✓ ${file}: recortado a ${width}x${cut}`);
}
