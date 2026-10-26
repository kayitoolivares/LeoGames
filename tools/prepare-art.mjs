// Prepara el arte (hecho con Gemini u otra herramienta) de los juegos.
//
// Bolitas Bros:
//   arte/smash/personajes/<personaje>-<pose>.png   personaje: tanque | rayo | resorte | estrella | ninja | robot | dragon | fantasma |
//                                                  dino | gatito | pinguino | pirata | hada | astronauta | abeja | bombero |
//                                                  luchador | unicornio |
//                                                  bloque1 a bloque10 | octobloque (Bloquecito, un dibujo por número)
//                                                  (con _super, p. ej. tanque_super, es su súper forma)
//                                                  pose: normal | golpe | salto | dolor  (sin pose = normal)
//                                                  caminar1 a caminar4 (los cuadros de la caminata, en todos los juegos)
//                                                  y para el Duelo: patada | cubrirse | especial | gana
//                                                  y manejando un kart: atras | giro | lado | frente
//                                                  y las animaciones (ui/motion.js): parpadeo | feliz | enojado |
//                                                  asustado | caer | mareado | baile1 | baile2
//   arte/smash/objetos/<objeto>.png                martillo | bomba | corazon | estrella
//   arte/smash/fondos/<escenario>.png              castillo | nubes | barco | espacio | volcan
// Los demás juegos (ver GAMES): arte/<juego>/<carpeta>/<nombre>.png
//
// A personajes, monstruos y objetos les quita el fondo liso (o de cuadritos, como sale a veces de Gemini),
// los recorta y los achica; a los fondos solo los achica. Todo queda en public/<juego>/ y la lista
// de lo que hay en src/games/<juego>/art.json, para que el juego sepa qué cargar.
// Se aceptan .png, .jpg y .webp.  Uso: npm run arte   (o: node tools/prepare-art.mjs <otra carpeta arte>)
import sharp from 'sharp';
import { mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { saveMetrics } from './pose-metrics.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const ART = process.argv[2] ? path.resolve(process.argv[2]) : path.join(ROOT, 'arte');
const SOURCE = path.join(ART, 'smash');
const OUTPUT = path.join(ROOT, 'public', 'smash');
const MANIFEST = path.join(ROOT, 'src', 'games', 'smash', 'art.json');

const CHARACTERS = [
  'tanque', 'rayo', 'resorte', 'estrella', 'ninja', 'robot', 'dragon', 'fantasma',
  'dino', 'gatito', 'pinguino', 'pirata', 'hada', 'astronauta', 'abeja', 'bombero', 'luchador', 'unicornio',
  // Bloquecito: un dibujo por número (bloque1 a bloque10) y su súper forma, Octobloque.
  ...Array.from({ length: 10 }, (_, i) => `bloque${i + 1}`), 'octobloque',
];
const POSES = ['normal', 'golpe', 'salto', 'dolor', 'caminar1', 'caminar2', 'caminar3', 'caminar4', 'patada', 'cubrirse', 'especial', 'gana', 'aire', 'agachado', 'agarre', 'entrada', 'atras', 'giro', 'lado', 'frente', 'parpadeo', 'feliz', 'enojado', 'asustado', 'caer', 'mareado', 'baile1', 'baile2', 'frente_feliz', 'frente_enojado', 'lado_feliz', 'lado_enojado'];
const ITEMS = ['martillo', 'bomba', 'corazon', 'estrella', 'bate', 'pistola', 'patineta', 'huevo', 'bola-super', 'diana', 'bumeran', 'flor-fuego', 'resorte', 'capsula', 'tornado', 'saco'];
const STAGES = ['castillo', 'nubes', 'barco', 'espacio', 'volcan', 'selva', 'juguetes', 'mar', 'embrujada', 'pastel', 'ciudad', 'globos', 'ring', 'cancha'];

// Poses de los monstruos y los jefes (ver src/ui/creature.js): <monstruo>-<pose>.
const MONSTER_POSES = ['paso', 'ataque', 'dolor', 'burla'];
const BOSS_POSES = [...MONSTER_POSES, 'furioso', 'cargando', 'mareado', 'derrotado'];
const BRAWL_BOSSES = ['rey-slime', 'gran-hongo', 'dragon-lava', 'capitan-pulpo', 'gran-yeti', 'rey-calabaza', 'rey-pastel', 'mega-robot'];
const withPoses = (names, bosses = []) => names.flatMap((name) => [name, ...(bosses.includes(name) ? BOSS_POSES : MONSTER_POSES).map((pose) => `${name}-${pose}`)]);

// Arte de los otros juegos: por carpeta, qué nombres valen y si es recorte (cutout) o fondo.
const GAMES = {
  brawl: {
    monstruos: {
      kind: 'cutout',
      max: 256,
      names: withPoses(
        [
          'slime', 'slime-grande', 'rey-slime', 'hongo', 'gran-hongo', 'slime-lava', 'dragon-lava',
          'cangrejo', 'almeja', 'capitan-pulpo', 'muneco-nieve', 'yeti-bebe', 'gran-yeti', 'murcielago', 'calabaza', 'rey-calabaza',
          'gomita', 'cupcake', 'caramelo', 'rey-pastel', 'marcianito', 'ovni', 'robotito', 'mega-robot',
        ],
        BRAWL_BOSSES,
      ),
    },
    fondos: { kind: 'background', names: ['pradera', 'bosque', 'volcan', 'playa', 'nieve', 'castillo', 'dulces', 'espacio'] },
    objetos: {
      kind: 'cutout',
      max: 192,
      names: [
        'caja', 'barril', 'jarron', 'pizza', 'helado', 'pollo',
        'espada', 'escudo', 'iman', 'mascota', 'moneda', 'jaula',
        'sombrero-vaquero', 'gorra', 'sombrero-pirata', 'gorro-chef', 'casco-vikingo', 'sombrero-mago',
        'dinosaurio', 'pollo-gigante', 'canon', 'roca',
      ],
    },
  },
  plat: {
    enemigos: {
      kind: 'cutout',
      max: 160,
      names: withPoses([
        'hongo-malo', 'tortuga', 'caparazon', 'murcielago', 'pajaro', 'nube-mala', 'pez', 'medusa', 'bola-fuego', 'aplastador', 'erizo', 'planta',
        'pinguino', 'pinguino-panza', 'carambano', 'bola-nieve', 'galleta', 'dona', 'paleta', 'chicle', 'fantasma', 'fantasma-boca', 'esqueleto', 'vela',
      ]),
    },
    jefes: { kind: 'cutout', max: 320, names: withPoses(['rey-hongo', 'rey-nube', 'rey-cangrejo', 'rey-dragon'], ['rey-hongo', 'rey-nube', 'rey-cangrejo', 'rey-dragon']) },
    objetos: {
      kind: 'cutout',
      max: 128,
      names: ['hongo', 'flor', 'estrella', 'huevo', 'moneda', 'moneda-grande', 'bandera', 'resorte', 'pluma', 'flor-hielo', 'hongo-mini', 'hongo-gigante', 'bala', 'casita', 'regalo', 'canon'],
    },
    fondos: { kind: 'background', names: ['pradera', 'cueva', 'cielo', 'playa', 'mar', 'castillo', 'nieve', 'dulces', 'embrujada'] },
    // Las cositas de los fondos con vida (ui/ambient.js), en todos los juegos.
    ambiente: { kind: 'cutout', max: 96, names: ['pajaro1', 'pajaro2', 'murcielago1', 'murcielago2', 'mariposa', 'hoja', 'copo', 'dulce'] },
  },
  kart: {
    objetos: {
      kind: 'cutout',
      max: 128,
      names: ['cohete', 'platano', 'turbo', 'burbuja', 'cometa', 'rayo', 'tinta', 'platanos3', 'globos', 'estrella', 'fantasma', 'bala', 'abeja', 'iman', 'gelatina', 'tornado', 'resorte', 'bomba', 'cronometro'],
    },
    copas: { kind: 'cutout', max: 256, names: ['copa-hoja', 'copa-estrella', 'copa-aventura', 'copa-sorpresa', 'copa-tesoro'] },
    fondos: {
      kind: 'background',
      names: ['pradera', 'playa', 'dulces', 'nieve', 'castillo', 'espacio', 'arena', 'volcan', 'selva', 'mar', 'juguetes', 'embrujada', 'pastel', 'dinos', 'nubes', 'desierto', 'neon', 'casa', 'pirata'],
    },
    texturas: { kind: 'background', max: 512, names: ['pasto', 'arena', 'nieve', 'dulce', 'asfalto', 'roca', 'selva', 'alfombra', 'betun', 'nube', 'madera', 'azulejo', 'neon'] },
    // Medallas (escuela y récords) y lo de la tele (helicóptero, dirigible, globo, camarógrafo).
    extras: { kind: 'cutout', max: 192, names: ['medalla-oro', 'medalla-plata', 'medalla-bronce', 'bandera', 'helicoptero', 'dirigible', 'globo', 'camarografo'] },
    // Los jefes de la Aventura manejando (de espaldas, girando, de lado y de frente).
    jefes: {
      kind: 'cutout',
      max: 256,
      names: ['atras', 'giro', 'lado', 'frente'].flatMap((view) => ['rey', 'dragonzote', 'robotote'].map((boss) => `${boss}-${view}`)),
    },
    calcomanias: {
      kind: 'cutout',
      max: 256,
      names: ['llamas', 'estrellas', 'rayos', 'corazones', 'flores', 'calavera', 'dinos', 'unicornio', 'balones', 'notas'],
    },
    peligros: {
      kind: 'cutout',
      max: 256,
      names: ['oveja', 'cangrejo', 'dona', 'bola-nieve', 'meteorito', 'lava', 'tronco', 'pez-globo', 'pelota', 'espectro', 'fresa', 'dino', 'relampago', 'rodadora', 'taxi', 'pantufla', 'bala-canon'],
    },
  },
  futbol: {
    fondos: { kind: 'background', names: ['estadio', 'playa', 'nieve', 'luna', 'azotea', 'selva', 'dulces', 'noche'] },
    poderes: { kind: 'cutout', max: 128, names: ['balon-gigante', 'porteria-chica', 'iman', 'hielo', 'tenis'] },
    copas: { kind: 'cutout', max: 256, names: ['copa-futbol'] },
  },
  // Modo Bebé: los animalitos que se asoman (normal y haciendo su sonido).
  baby: {
    animales: {
      kind: 'cutout',
      max: 256,
      names: ['perro', 'gato', 'vaca', 'cerdito', 'pollito', 'pato', 'rana', 'oveja', 'caballo', 'leon', 'elefante', 'mono'].flatMap((animal) => [animal, `${animal}-canta`]),
    },
  },
  duelo: {
    fondos: { kind: 'background', names: ['dojo', 'lucha', 'azotea', 'trono', 'playa', 'nieve', 'espacio', 'cueva', 'guarida', 'fabrica'] },
    efectos: { kind: 'cutout', max: 256, names: ['pow', 'zas', 'chispa', 'polvo', 'onda', 'mareo'] },
    jefe: {
      kind: 'cutout',
      max: 384,
      names: ['normal', 'golpe', 'salto', 'dolor', 'paso', 'burla', 'gana', 'bloqueo', 'furioso', 'cargando', 'mareado', 'derrotado'].flatMap((pose) =>
        ['rey', 'dragonzote', 'robotote'].map((boss) => `${boss}-${pose}`),
      ),
    },
    publico: { kind: 'cutout', max: 192, names: ['fan1', 'fan2', 'fan3', 'fan4', 'fan5', 'fan6'] },
    copas: { kind: 'cutout', max: 256, names: ['copa-torneo'] },
  },
};
const IMAGE = /\.(png|jpe?g|webp)$/i;
// Tamaños pensados para la memoria del Xbox One S.
const CHARACTER_MAX = 256;
const ITEM_MAX = 128;
const BACKGROUND_MAX = 1600;
// Qué tan parecido al fondo tiene que ser un pixel para borrarlo (distancia de color, 0-441).
const TOLERANCE = 48;

async function files(folder, root = SOURCE) {
  try {
    return (await readdir(path.join(root, folder))).filter((name) => IMAGE.test(name));
  } catch {
    return [];
  }
}

async function background(input, output, max = BACKGROUND_MAX) {
  await sharp(input).resize({ width: max, withoutEnlargement: true }).jpeg({ quality: 82 }).toFile(output);
}

// Un juego "sencillo": cada carpeta es una lista de nombres permitidos (ver GAMES).
async function prepareGame(game, folders, report) {
  const source = path.join(ART, game);
  const output = path.join(ROOT, 'public', game);
  await rm(output, { recursive: true, force: true });
  const manifest = {};
  for (const [folder, spec] of Object.entries(folders)) {
    await mkdir(path.join(output, folder), { recursive: true });
    manifest[folder] = [];
    for (const file of await files(folder, source)) {
      const name = baseName(file);
      if (!spec.names.includes(name)) {
        report.push(`  ? ${game}/${folder}/${file}: el nombre debe ser ${spec.names.join(', ')}`);
        continue;
      }
      if (spec.kind === 'cutout') await cutOut(path.join(source, folder, file), path.join(output, folder, `${name}.png`), spec.max);
      else await background(path.join(source, folder, file), path.join(output, folder, `${name}.jpg`), spec.max);
      manifest[folder].push(name);
      report.push(`  ✓ ${game}: ${folder}/${name}`);
    }
  }
  await writeFile(path.join(ROOT, 'src', 'games', game, 'art.json'), `${JSON.stringify(manifest, null, 2)}\n`);
}

function baseName(file) {
  return file.replace(IMAGE, '').toLowerCase();
}

// Borra el fondo: toma los colores más comunes de la orilla y "rellena" desde la orilla hacia adentro
// todo lo que se parezca a ellos. Luego recorta lo que quedó vacío.
async function cutOut(input, output, maxSize) {
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  const at = (x, y) => (y * width + x) * 4;

  const border = [];
  for (let x = 0; x < width; x += 1) border.push(at(x, 0), at(x, height - 1));
  for (let y = 0; y < height; y += 1) border.push(at(0, y), at(width - 1, y));
  const groups = new Map();
  for (const i of border) {
    const key = `${data[i] >> 4},${data[i + 1] >> 4},${data[i + 2] >> 4}`;
    const group = groups.get(key) ?? { count: 0, r: 0, g: 0, b: 0 };
    group.count += 1;
    group.r += data[i];
    group.g += data[i + 1];
    group.b += data[i + 2];
    groups.set(key, group);
  }
  // Uno o dos colores de fondo (dos si es de cuadritos).
  const backgrounds = [...groups.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, 2)
    .filter((group) => group.count > border.length * 0.1)
    .map((group) => [group.r / group.count, group.g / group.count, group.b / group.count]);
  const isBackground = (i) =>
    data[i + 3] === 0 ||
    backgrounds.some(([r, g, b]) => Math.hypot(data[i] - r, data[i + 1] - g, data[i + 2] - b) < TOLERANCE);
  const greenScreen = backgrounds.some(([r, g, b]) => g > r + 40 && g > b + 40);

  const seen = new Uint8Array(width * height);
  const stack = border.map((i) => i / 4);
  while (stack.length) {
    const p = stack.pop();
    if (seen[p]) continue;
    seen[p] = 1;
    if (!isBackground(p * 4)) continue;
    data[p * 4 + 3] = 0;
    const x = p % width;
    const y = (p - x) / width;
    if (x > 0) stack.push(p - 1);
    if (x < width - 1) stack.push(p + 1);
    if (y > 0) stack.push(p - width);
    if (y < height - 1) stack.push(p + width);
  }
  // Con fondo verde también se borran las "bolsitas" de verde encerradas por el dibujo (entre un brazo
  // y el cuerpo, entre las orejas) que el relleno desde la orilla no alcanza. Ningún personaje ni objeto
  // lleva verde, así que no se borra nada del dibujo.
  if (greenScreen) {
    for (let i = 0; i < data.length; i += 4) {
      const g = data[i + 1];
      if (g > 140 && g - Math.max(data[i], data[i + 2]) > 70) data[i + 3] = 0;
    }
  }
  // Igual con fondo magenta (las asas de una copa): solo el magenta fuerte, no el rosa de unos cachetes.
  const magentaScreen = backgrounds.some(([r, g, b]) => r > 200 && b > 200 && g < 80);
  if (magentaScreen) {
    for (let i = 0; i < data.length; i += 4) {
      const [r, g, b] = [data[i], data[i + 1], data[i + 2]];
      if (r > 180 && b > 180 && g < 90 && Math.abs(r - b) < 60) data[i + 3] = 0;
    }
  }
  softenEdges(data, width, height, backgrounds, greenScreen);
  for (let i = 0; i < data.length; i += 4) {
    // Los pixeles transparentes se vacían para que al achicar no "sangre" su color en las orillas.
    if (data[i + 3] === 0) data[i] = data[i + 1] = data[i + 2] = 0;
    // Sin verde en el dibujo: se le quita a todo el tinte verde que deja el fondo (el JPEG lo esparce).
    else if (greenScreen) data[i + 1] = Math.min(data[i + 1], Math.max(data[i], data[i + 2]));
  }

  let [left, top, right, bottom] = [width, height, -1, -1];
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (data[at(x, y) + 3] === 0) continue;
      left = Math.min(left, x);
      right = Math.max(right, x);
      top = Math.min(top, y);
      bottom = Math.max(bottom, y);
    }
  }
  if (right < 0) throw new Error('la imagen quedó vacía (¿el personaje es del mismo color que el fondo?)');
  await sharp(data, { raw: { width, height, channels: 4 } })
    .extract({ left, top, width: right - left + 1, height: bottom - top + 1 })
    .resize({ width: maxSize, height: maxSize, fit: 'inside', withoutEnlargement: true })
    // Con paleta (256 colores) pesa ~3 veces menos y en dibujos de caricatura no se nota.
    .png({ palette: true, quality: 90, effort: 10 })
    .toFile(output);
}

// Orillas: los pixeles que tocan el fondo borrado y todavía se le parecen quedan semitransparentes,
// y si el fondo era verde se les quita ese tinte (para que no quede un borde verdoso).
function softenEdges(data, width, height, backgrounds, greenScreen) {
  const clear = (i) => data[i + 3] === 0;
  for (let p = 0; p < width * height; p += 1) {
    const i = p * 4;
    if (clear(i)) continue;
    const x = p % width;
    const y = (p - x) / width;
    const touches =
      (x > 0 && clear(i - 4)) ||
      (x < width - 1 && clear(i + 4)) ||
      (y > 0 && clear(i - width * 4)) ||
      (y < height - 1 && clear(i + width * 4));
    if (!touches) continue;
    const dist = Math.min(...backgrounds.map(([r, g, b]) => Math.hypot(data[i] - r, data[i + 1] - g, data[i + 2] - b)));
    if (dist < TOLERANCE * 2) data[i + 3] = Math.max(1, Math.round(255 * Math.min(1, (dist - TOLERANCE) / TOLERANCE)));
    if (greenScreen) data[i + 1] = Math.min(data[i + 1], Math.max(data[i], data[i + 2]));
  }
}

async function main() {
  await rm(OUTPUT, { recursive: true, force: true });
  for (const folder of ['personajes', 'objetos', 'fondos']) await mkdir(path.join(OUTPUT, folder), { recursive: true });
  const manifest = { characters: {}, items: [], backgrounds: [] };
  const report = [];

  for (const file of await files('personajes')) {
    const [character, pose = 'normal'] = baseName(file).split('-');
    if (!CHARACTERS.includes(character.replace(/_super$/, '')) || !POSES.includes(pose)) {
      report.push(`  ? personajes/${file}: el nombre debe ser <${CHARACTERS.join('|')}>[_super]-<${POSES.join('|')}>`);
      continue;
    }
    await cutOut(path.join(SOURCE, 'personajes', file), path.join(OUTPUT, 'personajes', `${character}-${pose}.png`), CHARACTER_MAX);
    (manifest.characters[character] ??= []).push(pose);
    report.push(`  ✓ ${character} (${pose})`);
  }

  for (const file of await files('objetos')) {
    const item = baseName(file);
    if (!ITEMS.includes(item)) {
      report.push(`  ? objetos/${file}: el nombre debe ser ${ITEMS.join(', ')}`);
      continue;
    }
    await cutOut(path.join(SOURCE, 'objetos', file), path.join(OUTPUT, 'objetos', `${item}.png`), ITEM_MAX);
    manifest.items.push(item);
    report.push(`  ✓ objeto: ${item}`);
  }

  for (const file of await files('fondos')) {
    const stage = baseName(file);
    if (!STAGES.includes(stage)) {
      report.push(`  ? fondos/${file}: el nombre debe ser ${STAGES.join(', ')}`);
      continue;
    }
    await background(path.join(SOURCE, 'fondos', file), path.join(OUTPUT, 'fondos', `${stage}.jpg`));
    manifest.backgrounds.push(stage);
    report.push(`  ✓ fondo: ${stage}`);
  }

  await writeFile(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);
  for (const [game, folders] of Object.entries(GAMES)) await prepareGame(game, folders, report);
  // Las medidas de cada pose (para que el personaje, el jefe o el monstruo se vea igual de grande en todas).
  report.push(`  ✓ medidas de ${await saveMetrics()} poses`);
  console.log(report.length ? report.join('\n') : `No hay imágenes en ${path.relative(ROOT, ART)}/`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
