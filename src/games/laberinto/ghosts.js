import Phaser from 'phaser';
import { COLORS } from '../../ui/style.js';

// Los fantasmitas del Laberinto: tiernos (cachetes y sonrisa), cada uno con su manera de buscarte, como en el clásico:
//   Chispa (rojo) te persigue derechito; Rosita (rosa) se te adelanta; Nube (celeste) te rodea usando a Chispa;
//   Mandarina (naranja) es despistada: de lejos te sigue, de cerca se va a su esquina.
// Con varios jugadores, cada uno busca al jugador más cercano que esté jugando.
export const GHOSTS = [
  { key: 'chispa', name: 'Chispa', color: 0xff5a5f, kind: 'persigue' },
  { key: 'rosita', name: 'Rosita', color: 0xff8fd8, kind: 'adelanta' },
  { key: 'nube', name: 'Nube', color: 0x5ad1ff, kind: 'flanquea' },
  { key: 'mandarina', name: 'Mandarina', color: 0xffa94d, kind: 'despistado' },
];

// Asustados (con la fruta de poder): azules; al acabarse el susto parpadean en blanco.
export const SCARED_COLOR = 0x4a5cff;
const FLASH_COLOR = 0xf4f4ff;
// El dibujo se hace de este tamaño y luego se escala a la casilla.
export const GHOST_TEXTURE = 64;
const CHEEKS = 0xff7ab8;

// Direcciones, en el orden en que los fantasmitas las prefieren cuando empatan (como el clásico).
export const DIRS = [
  { x: 0, y: -1 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 1, y: 0 },
];

// El cuerpo: cabeza redonda y faldita de olas (dos cuadros: las olas se mueven al caminar).
function bodyPoints(frame) {
  const points = [];
  for (let a = 180; a <= 360; a += 12) {
    const t = Phaser.Math.DegToRad(a);
    points.push({ x: 32 + 24 * Math.cos(t), y: 28 + 24 * Math.sin(t) });
  }
  points.push({ x: 56, y: 50 });
  for (let x = 56; x >= 8; x -= 3) {
    const wave = Math.cos(((x - 8) / 48) * Math.PI * 6 + (frame ? Math.PI : 0));
    points.push({ x, y: 51 + 5 * wave });
  }
  points.push({ x: 8, y: 50 });
  return points;
}

function drawBody(g, color, frame) {
  g.fillStyle(COLORS.ink, 1);
  g.fillPoints(
    bodyPoints(frame).map((p) => ({ x: 32 + (p.x - 32) * 1.1, y: 30 + (p.y - 30) * 1.1 })),
    true,
  );
  g.fillStyle(color, 1);
  g.fillPoints(bodyPoints(frame), true);
  // Brillito.
  g.fillStyle(0xffffff, 0.35);
  g.fillEllipse(22, 16, 10, 7);
}

// Las texturas de un color (normales: solo cuerpo, cachetes y sonrisa; los ojos van aparte para que miren hacia donde
// caminan) y las de asustado (ojitos chiquitos y boquita temblorosa, ya dibujados).
export function ghostTextures(scene) {
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  const make = (key, draw) => {
    if (scene.textures.exists(key)) return;
    g.clear();
    draw();
    g.generateTexture(key, GHOST_TEXTURE, GHOST_TEXTURE);
  };
  for (const ghost of GHOSTS) {
    for (const frame of [0, 1]) {
      make(`lab:ghost-${ghost.key}-${frame}`, () => {
        drawBody(g, ghost.color, frame);
        g.fillStyle(CHEEKS, 0.55);
        g.fillEllipse(17, 36, 9, 5);
        g.fillEllipse(47, 36, 9, 5);
        g.lineStyle(3, COLORS.ink, 1);
        g.beginPath();
        g.arc(32, 36, 6, Phaser.Math.DegToRad(20), Phaser.Math.DegToRad(160), false);
        g.strokePath();
      });
    }
  }
  for (const [name, color, mouth] of [
    ['scared', SCARED_COLOR, 0xffe0f0],
    ['flash', FLASH_COLOR, 0xff5a5f],
  ]) {
    for (const frame of [0, 1]) {
      make(`lab:ghost-${name}-${frame}`, () => {
        drawBody(g, color, frame);
        g.fillStyle(mouth, 1);
        g.fillCircle(24, 26, 4);
        g.fillCircle(40, 26, 4);
        // Boquita en zigzag (le tiembla).
        g.lineStyle(3, mouth, 1);
        g.beginPath();
        g.moveTo(16, 40);
        for (let i = 1; i <= 8; i += 1) g.lineTo(16 + i * 4, i % 2 ? 36 : 40);
        g.strokePath();
      });
    }
  }
  g.destroy();
}

// Hacia dónde camina un fantasmita (sus casillas de objetivo). `ctx`: { maze, targets: jugadores jugando ({ x, y, dir }),
// chaser: Chispa, scatter: si es hora de irse a su esquina }.
export function ghostTarget(ghost, ctx) {
  const { maze } = ctx;
  const corners = [
    { x: maze.width - 3, y: -3 },
    { x: 2, y: -3 },
    { x: maze.width, y: maze.height + 1 },
    { x: -1, y: maze.height + 1 },
  ];
  const corner = corners[ghost.index];
  if (ctx.scatter || !ctx.targets.length) return corner;
  // El jugador más cercano.
  const prey = ctx.targets.reduce((best, p) => (dist2(p, ghost) < dist2(best, ghost) ? p : best));
  const px = Math.round(prey.x);
  const py = Math.round(prey.y);
  switch (GHOSTS[ghost.index].kind) {
    case 'adelanta':
      return { x: px + prey.dir.x * 4, y: py + prey.dir.y * 4 };
    case 'flanquea': {
      const ax = px + prey.dir.x * 2;
      const ay = py + prey.dir.y * 2;
      const from = ctx.chaser ?? ghost;
      return { x: ax + (ax - Math.round(from.x)), y: ay + (ay - Math.round(from.y)) };
    }
    case 'despistado':
      return dist2(prey, ghost) > 64 ? { x: px, y: py } : corner;
    default:
      return { x: px, y: py };
  }
}

export function dist2(a, b) {
  return (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
}

// En una esquina: escoge el camino que más lo acerque al objetivo, sin darse la vuelta (asustado: uno al azar).
export function chooseDir(ghost, target, canEnter, random = false) {
  const cx = Math.round(ghost.x);
  const cy = Math.round(ghost.y);
  const back = { x: -ghost.dir.x, y: -ghost.dir.y };
  let options = DIRS.filter((d) => !(d.x === back.x && d.y === back.y) && canEnter(cx + d.x, cy + d.y));
  if (!options.length) options = DIRS.filter((d) => canEnter(cx + d.x, cy + d.y));
  if (!options.length) return { x: 0, y: 0 };
  if (random) return Phaser.Utils.Array.GetRandom(options);
  let best = options[0];
  let bestDist = Infinity;
  for (const d of options) {
    const distance = dist2({ x: cx + d.x, y: cy + d.y }, target);
    if (distance < bestDist) {
      best = d;
      bestDist = distance;
    }
  }
  return best;
}
