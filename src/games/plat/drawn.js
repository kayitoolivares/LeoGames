// Los jefes de la Isla de los jefes dibujados con canvas, para cuando todavía no está su dibujo de Gemini (ver
// boss.js): la Abeja Reina, el Pez Globo y la Gelatina Gigante. Cada uno con su dibujo normal y unas poses (las que
// cambian mucho: la abeja mareada con el aguijón atorado, el pez inflado con picos) con los mismos nombres que las
// de Gemini, así ui/creature.js las usa igual.
const INK = '#1b1530';

function texture(scene, key, w, h, draw) {
  if (scene.textures.exists(key)) return key;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  draw(ctx);
  scene.textures.addCanvas(key, canvas);
  return key;
}

function ellipse(ctx, x, y, rx, ry, fill, { stroke = INK, width = 6 } = {}) {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = width;
    ctx.stroke();
  }
}

// Ojos grandes y brillosos (o de espiral si está mareado; con cejas si está enojado).
function eyes(ctx, x, y, gap, r, { dizzy = false, angry = false } = {}) {
  for (const side of [-1, 1]) {
    const cx = x + side * gap;
    ellipse(ctx, cx, y, r, r * 1.15, '#ffffff', { width: 4 });
    if (dizzy) {
      ctx.strokeStyle = INK;
      ctx.lineWidth = 3;
      ctx.beginPath();
      for (let a = 0; a < Math.PI * 5; a += 0.3) ctx.lineTo(cx + Math.cos(a) * a * (r / 17), y + Math.sin(a) * a * (r / 17));
      ctx.stroke();
      continue;
    }
    ellipse(ctx, cx + side * 2, y + 3, r * 0.55, r * 0.65, INK, { stroke: null });
    ellipse(ctx, cx + side * 2 - r * 0.2, y - r * 0.15, r * 0.2, r * 0.2, '#ffffff', { stroke: null });
    if (angry) {
      ctx.strokeStyle = INK;
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(cx - side * r * 1.1, y - r * 1.5);
      ctx.lineTo(cx + side * r * 0.9, y - r * 0.9);
      ctx.stroke();
    }
  }
}

function cheeks(ctx, x, y, gap) {
  for (const side of [-1, 1]) ellipse(ctx, x + side * gap, y, 11, 7, 'rgba(255,110,140,0.55)', { stroke: null });
}

function smile(ctx, x, y, w, { open = false } = {}) {
  ctx.strokeStyle = INK;
  ctx.lineWidth = 5;
  ctx.beginPath();
  if (open) {
    ctx.ellipse(x, y + 4, w * 0.5, w * 0.4, 0, 0, Math.PI);
    ctx.fillStyle = '#7a2440';
    ctx.fill();
  } else ctx.arc(x, y - w * 0.4, w * 0.7, Math.PI * 0.2, Math.PI * 0.8);
  ctx.stroke();
}

// La Abeja Reina: bolita amarilla con rayas, alitas, corona y el aguijón abajo (para lanzarse en picada).
function bee(ctx, { dizzy = false, angry = false } = {}) {
  const cx = 120;
  const cy = 112;
  // Alitas.
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.translate(cx + side * 70, cy - 52);
    ctx.rotate(side * 0.5);
    ellipse(ctx, 0, 0, 42, 26, 'rgba(200,236,255,0.9)', { width: 5 });
    ctx.restore();
  }
  // El aguijón.
  ctx.beginPath();
  ctx.moveTo(cx - 16, cy + 62);
  ctx.lineTo(cx + 16, cy + 62);
  ctx.lineTo(cx, cy + 96);
  ctx.closePath();
  ctx.fillStyle = '#3a2a1a';
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 5;
  ctx.stroke();
  // El cuerpo con sus rayas.
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(cx, cy, 82, 70, 0, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = '#ffd23f';
  ctx.fillRect(0, 0, 240, 220);
  ctx.fillStyle = '#2b2118';
  for (const y of [cy + 18, cy + 46]) ctx.fillRect(0, y, 240, 15);
  ctx.restore();
  ellipse(ctx, cx, cy, 82, 70, 'rgba(0,0,0,0)');
  // Las antenitas.
  for (const side of [-1, 1]) {
    ctx.strokeStyle = INK;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(cx + side * 22, cy - 64);
    ctx.quadraticCurveTo(cx + side * 34, cy - 96, cx + side * 50, cy - 98);
    ctx.stroke();
    ellipse(ctx, cx + side * 50, cy - 98, 8, 8, '#2b2118', { width: 3 });
  }
  // La corona.
  ctx.beginPath();
  ctx.moveTo(cx - 34, cy - 60);
  ctx.lineTo(cx - 38, cy - 98);
  ctx.lineTo(cx - 17, cy - 78);
  ctx.lineTo(cx, cy - 108);
  ctx.lineTo(cx + 17, cy - 78);
  ctx.lineTo(cx + 38, cy - 98);
  ctx.lineTo(cx + 34, cy - 60);
  ctx.closePath();
  ctx.fillStyle = '#ffb000';
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 5;
  ctx.stroke();
  ellipse(ctx, cx, cy - 74, 7, 7, '#ff3d7f', { width: 3 });
  eyes(ctx, cx, cy - 18, 30, 17, { dizzy, angry });
  cheeks(ctx, cx, cy + 4, 52);
  smile(ctx, cx, cy + 10, 22, { open: angry || dizzy });
}

// El Pez Globo: bolita naranja con aletas y cola; inflado, más redondo y con picos.
function puffer(ctx, { puffed = false } = {}) {
  const cx = 110;
  const cy = 110;
  const r = puffed ? 86 : 70;
  if (puffed) {
    for (let i = 0; i < 16; i += 1) {
      const a = (i / 16) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a - 0.14) * (r - 4), cy + Math.sin(a - 0.14) * (r - 4));
      ctx.lineTo(cx + Math.cos(a) * (r + 26), cy + Math.sin(a) * (r + 26));
      ctx.lineTo(cx + Math.cos(a + 0.14) * (r - 4), cy + Math.sin(a + 0.14) * (r - 4));
      ctx.closePath();
      ctx.fillStyle = '#fff2c4';
      ctx.fill();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 4;
      ctx.stroke();
    }
  }
  // La cola (a la izquierda: el dibujo mira a la derecha).
  ctx.beginPath();
  ctx.moveTo(cx - r + 8, cy);
  ctx.lineTo(cx - r - 34, cy - 30);
  ctx.lineTo(cx - r - 28, cy);
  ctx.lineTo(cx - r - 34, cy + 30);
  ctx.closePath();
  ctx.fillStyle = '#ff8a3c';
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 5;
  ctx.stroke();
  ellipse(ctx, cx, cy, r, r * 0.92, '#ffb347');
  // La panza clarita.
  ellipse(ctx, cx + 6, cy + r * 0.38, r * 0.62, r * 0.38, '#ffe3b0', { stroke: null });
  // Manchitas.
  for (const [dx, dy, s] of [
    [-30, -40, 9],
    [-48, -8, 7],
    [8, -56, 7],
  ])
    ellipse(ctx, cx + dx * (r / 70), cy + dy * (r / 70), s, s, '#e0702a', { stroke: null });
  // La aleta de lado.
  ctx.save();
  ctx.translate(cx - 6, cy + 14);
  ctx.rotate(0.5);
  ellipse(ctx, 0, 0, 20, 12, '#ff8a3c', { width: 4 });
  ctx.restore();
  eyes(ctx, cx + 30, cy - 18, 22, 15, { angry: puffed });
  if (puffed) {
    ellipse(ctx, cx + 58, cy + 18, 10, 9, '#7a2440', { width: 4 });
  } else {
    ellipse(ctx, cx + 62, cy + 12, 7, 6, '#7a2440', { width: 4 });
    cheeks(ctx, cx + 30, cy + 8, 34);
  }
}

// La Gelatina Gigante: un domo rojo de fresa, brilloso, con crema y una cereza arriba.
function jelly(ctx, { dizzy = false, angry = false } = {}) {
  const cx = 120;
  const base = 172;
  const top = 46;
  const half = 98;
  const dome = () => {
    ctx.beginPath();
    ctx.moveTo(cx - half, base);
    ctx.bezierCurveTo(cx - half - 6, top + 40, cx - half + 30, top, cx, top);
    ctx.bezierCurveTo(cx + half - 30, top, cx + half + 6, top + 40, cx + half, base);
    ctx.closePath();
  };
  dome();
  ctx.fillStyle = '#ff4f6d';
  ctx.fill();
  // Por dentro más oscurito abajo y el brillo arriba.
  ctx.save();
  dome();
  ctx.clip();
  ctx.fillStyle = '#d92f52';
  ctx.fillRect(0, base - 34, 260, 40);
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.beginPath();
  ctx.ellipse(cx - 46, top + 46, 16, 34, -0.35, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  dome();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 6;
  ctx.stroke();
  // La crema y la cereza.
  for (const [dx, r] of [
    [-26, 18],
    [0, 22],
    [26, 18],
  ])
    ellipse(ctx, cx + dx, top + 4, r, r * 0.8, '#fff8f0', { width: 4 });
  ctx.strokeStyle = '#3a7a2a';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(cx + 4, top - 26);
  ctx.quadraticCurveTo(cx + 14, top - 42, cx + 26, top - 44);
  ctx.stroke();
  ellipse(ctx, cx + 2, top - 18, 13, 12, '#e8173c', { width: 4 });
  eyes(ctx, cx, top + 72, 30, 17, { dizzy, angry });
  cheeks(ctx, cx, top + 96, 54);
  smile(ctx, cx, top + 102, 22, { open: angry || dizzy });
}

const DRAWN = {
  abejaReina: {
    key: 'plat:dibujo-abeja-reina',
    w: 240,
    h: 216,
    poses: { normal: (c) => bee(c), ataque: (c) => bee(c, { angry: true }), furioso: (c) => bee(c, { angry: true }), mareado: (c) => bee(c, { dizzy: true }) },
  },
  pezGlobo: {
    key: 'plat:dibujo-pez-globo',
    w: 240,
    h: 220,
    poses: { normal: (c) => puffer(c), ataque: (c) => puffer(c, { puffed: true }), cargando: (c) => puffer(c, { puffed: true }) },
  },
  granGelatina: {
    key: 'plat:dibujo-gelatina',
    w: 240,
    h: 180,
    poses: { normal: (c) => jelly(c), furioso: (c) => jelly(c, { angry: true }), mareado: (c) => jelly(c, { dizzy: true }) },
  },
};

// La textura dibujada del jefe `bossKey` (y sus poses: <clave>-<pose>), o null si ese jefe no tiene dibujo aquí.
export function drawnBoss(scene, bossKey) {
  const spec = DRAWN[bossKey];
  if (!spec) return null;
  for (const [pose, draw] of Object.entries(spec.poses)) texture(scene, pose === 'normal' ? spec.key : `${spec.key}-${pose}`, spec.w, spec.h, draw);
  return spec.key;
}
