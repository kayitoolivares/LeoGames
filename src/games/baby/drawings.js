import { COLORS, FONT, hexToCss } from '../../ui/style.js';

// Las figuras con carita (y su letrero) y las burbujas del Modo Bebé se dibujan UNA vez por combinación en un canvas y
// se vuelven imagen: así cada una es una sola imagen y no un montón de círculos y trazos que el Xbox tendría que
// volver a calcular en cada cuadro (cuando el bebé machaca botones hay decenas en pantalla).
export const SHAPE_RADIUS = 100;
const SHAPE_W = 400;
const SHAPE_H = 290;
const CENTER_Y = 118;
const INK = hexToCss(COLORS.ink);
const STROKE = 6;

// Qué tan grande va la carita en cada figura (en la estrella cabe menos) y qué tanto más abajo (en el triángulo).
const FACE = { circle: [1, 0], star: [0.6, 0], square: [0.9, 0], flower: [0.62, 0], heart: [0.62, 0], triangle: [0.55, 0.25] };

function canvas(width, height) {
  const element = document.createElement('canvas');
  element.width = width;
  element.height = height;
  return element;
}

function body(ctx, kind, r, fill) {
  ctx.fillStyle = fill;
  ctx.strokeStyle = INK;
  ctx.lineWidth = STROKE;
  ctx.lineJoin = 'round';
  const shape = (draw) => {
    ctx.beginPath();
    draw();
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  };
  if (kind === 'star') {
    shape(() => {
      for (let i = 0; i < 10; i += 1) {
        const radius = i % 2 ? r * 0.55 : r * 1.1;
        const angle = -Math.PI / 2 + (i * Math.PI) / 5;
        ctx.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
      }
    });
  } else if (kind === 'square') {
    const side = r * 1.8;
    const [x, y, k] = [-side / 2, -side / 2, r * 0.35];
    shape(() => {
      ctx.moveTo(x + k, y);
      ctx.arcTo(x + side, y, x + side, y + side, k);
      ctx.arcTo(x + side, y + side, x, y + side, k);
      ctx.arcTo(x, y + side, x, y, k);
      ctx.arcTo(x, y, x + side, y, k);
    });
  } else if (kind === 'triangle') {
    const h = r * 1.9;
    const w = h * 1.15;
    shape(() => {
      ctx.moveTo(0, -h / 2);
      ctx.lineTo(w / 2, h / 2);
      ctx.lineTo(-w / 2, h / 2);
    });
  } else if (kind === 'heart') {
    shape(() => {
      for (let t = 0; t < Math.PI * 2; t += 0.05) {
        const hx = 16 * Math.sin(t) ** 3;
        const hy = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
        ctx.lineTo((hx / 17) * r * 1.05, (hy / 17) * r * 1.05 + r * 0.1);
      }
    });
  } else if (kind === 'flower') {
    for (let i = 0; i < 6; i += 1) {
      const angle = (i / 6) * Math.PI * 2;
      shape(() => ctx.arc(Math.cos(angle) * r * 0.62, Math.sin(angle) * r * 0.62, r * 0.45, 0, Math.PI * 2));
    }
    ctx.fillStyle = '#fff4c2';
    shape(() => ctx.arc(0, 0, r * 0.62, 0, Math.PI * 2));
  } else {
    shape(() => ctx.arc(0, 0, r, 0, Math.PI * 2));
  }
}

// Ojitos y sonrisa; `s` es el tamaño de la cara.
function face(ctx, s, dy) {
  const eyeX = s * 0.3;
  const eyeY = -s * 0.12 + dy;
  const eyeR = s * 0.16;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(side * eyeX, eyeY, eyeR, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = INK;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(side * eyeX, eyeY + eyeR * 0.15, eyeR * 0.55, 0, Math.PI * 2);
    ctx.fillStyle = INK;
    ctx.fill();
  }
  ctx.beginPath();
  ctx.lineWidth = Math.max(4, s * 0.07);
  ctx.lineCap = 'round';
  ctx.arc(0, s * 0.15 + dy, s * 0.28, (20 * Math.PI) / 180, (160 * Math.PI) / 180, false);
  ctx.stroke();
}

// La figura `kind` del color `color` con su carita y su letrero abajo. Devuelve la clave de la imagen; el centro de la
// figura es su origen (ver shapeOrigin).
export function shapeTexture(scene, kind, color, label) {
  const key = `baby:figura-${kind}-${color.toString(16)}-${label}`;
  if (scene.textures.exists(key)) return key;
  const element = canvas(SHAPE_W, SHAPE_H);
  const ctx = element.getContext('2d');
  ctx.translate(SHAPE_W / 2, CENTER_Y);
  const r = SHAPE_RADIUS;
  body(ctx, kind, r, hexToCss(color));
  const [size, down] = FACE[kind] ?? FACE.circle;
  face(ctx, r * size, r * down);
  ctx.font = `bold 40px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 8;
  ctx.lineJoin = 'round';
  ctx.strokeStyle = INK;
  ctx.strokeText(label, 0, r + 34);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(label, 0, r + 34);
  scene.textures.addCanvas(key, element);
  return key;
}

export const shapeOrigin = { x: 0.5, y: CENTER_Y / SHAPE_H };

// Una burbuja de color pastel (con su brillito), de radio BUBBLE_RADIUS.
export const BUBBLE_RADIUS = 60;
export function bubbleTexture(scene, tint) {
  const key = `baby:burbuja-${tint.toString(16)}`;
  if (scene.textures.exists(key)) return key;
  const size = BUBBLE_RADIUS * 2 + 8;
  const element = canvas(size, size);
  const ctx = element.getContext('2d');
  ctx.translate(size / 2, size / 2);
  ctx.beginPath();
  ctx.arc(0, 0, BUBBLE_RADIUS, 0, Math.PI * 2);
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = hexToCss(tint);
  ctx.fill();
  ctx.globalAlpha = 0.9;
  ctx.lineWidth = 4;
  ctx.strokeStyle = '#ffffff';
  ctx.stroke();
  ctx.globalAlpha = 0.75;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.ellipse(-BUBBLE_RADIUS * 0.38, -BUBBLE_RADIUS * 0.4, BUBBLE_RADIUS * 0.25, BUBBLE_RADIUS * 0.15, -0.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 0.6;
  ctx.beginPath();
  ctx.arc(BUBBLE_RADIUS * 0.35, BUBBLE_RADIUS * 0.4, BUBBLE_RADIUS * 0.08, 0, Math.PI * 2);
  ctx.fill();
  scene.textures.addCanvas(key, element);
  return key;
}
