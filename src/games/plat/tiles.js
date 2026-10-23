// Los cuadritos de los niveles de Súper Bolitas (cada uno de T x T pixeles). Los niveles se escriben con letras (ver
// levels.js) y aquí está qué es cada letra y cómo se dibuja (con canvas, en el estilo de cada mundo).
//   #  piso (con pasto/arena/nube arriba si no hay nada encima)    X  bloque de piedra (escaleras, paredes)
//   B  ladrillo (grande lo rompe)   b  ladrillo con monedas   ?  bloque sorpresa con moneda
//   M  bloque sorpresa con poder (hongo o flor)   S  ...con estrella   Y  ...con huevo de dinosaurio
//   H  bloque escondido (no se ve hasta que le pegas desde abajo: trae una vida)   U  bloque ya usado
//   =  plataforma que se atraviesa desde abajo   [ ]  boca de tubo   ( )  tubo   ^  picos   L  lava
export const T = 48;
export const ROWS = 15;

const SOLID = new Set('#XBb?MSYU[]()');
export const BLOCKS = new Set('Bb?MSYH');

export function isSolid(ch) {
  return SOLID.has(ch);
}

export function isSemi(ch) {
  return ch === '=';
}

// Los colores de cada estilo de mundo.
export const THEMES = {
  pradera: { top: '#5ccf4a', topDark: '#3a9a32', fill: '#b9773f', fillDark: '#8f5528', stone: '#b8a48c', semi: 'wood', sky: 0x8fd3ff },
  cueva: { top: '#6f7fae', topDark: '#4a5584', fill: '#4b4f78', fillDark: '#33365a', stone: '#7c7fa6', semi: 'rock', sky: 0x1b1d3a },
  cielo: { top: '#ffffff', topDark: '#cfe6ff', fill: '#f2f7ff', fillDark: '#c9dcf5', stone: '#ffd98a', semi: 'cloud', sky: 0xbfe6ff },
  playa: { top: '#ffe08a', topDark: '#e8b85a', fill: '#f2c46d', fillDark: '#d39d45', stone: '#d9b48a', semi: 'wood', sky: 0x7fd8ff },
  mar: { top: '#ffb38a', topDark: '#e07f5a', fill: '#d9a06a', fillDark: '#b07a48', stone: '#8ad0c8', semi: 'coral', sky: 0x1d6fb0 },
  castillo: { top: '#8c8ca0', topDark: '#5c5c70', fill: '#55556a', fillDark: '#3a3a4c', stone: '#9a9aae', semi: 'stone', sky: 0x2a1418 },
};
const INK = '#1b1530';

function canvasTile(scene, key, draw) {
  if (scene.textures.exists(key)) return key;
  const canvas = document.createElement('canvas');
  canvas.width = T;
  canvas.height = T;
  draw(canvas.getContext('2d'));
  scene.textures.addCanvas(key, canvas);
  return key;
}

function rounded(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function bevel(ctx, fill, dark, light = 'rgba(255,255,255,0.35)') {
  ctx.fillStyle = fill;
  ctx.fillRect(0, 0, T, T);
  ctx.fillStyle = light;
  ctx.fillRect(0, 0, T, 5);
  ctx.fillRect(0, 0, 5, T);
  ctx.fillStyle = dark;
  ctx.fillRect(0, T - 5, T, 5);
  ctx.fillRect(T - 5, 0, 5, T);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.strokeRect(1.5, 1.5, T - 3, T - 3);
}

// Las texturas de un estilo; devuelve un mapa nombre -> clave de textura.
export function themeTextures(scene, theme) {
  const c = THEMES[theme] ?? THEMES.pradera;
  const k = (name) => `plat:tile-${theme}-${name}`;
  const keys = {};
  keys.top = canvasTile(scene, k('top'), (ctx) => {
    ctx.fillStyle = c.fill;
    ctx.fillRect(0, 0, T, T);
    dirt(ctx, c);
    ctx.fillStyle = c.top;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(T, 0);
    ctx.lineTo(T, 14);
    for (let x = T; x >= 0; x -= 8) ctx.quadraticCurveTo(x - 4, 22, x - 8, 14);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = c.topDark;
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillRect(0, 2, T, 4);
  });
  keys.fill = canvasTile(scene, k('fill'), (ctx) => {
    ctx.fillStyle = c.fill;
    ctx.fillRect(0, 0, T, T);
    dirt(ctx, c);
  });
  keys.stone = canvasTile(scene, k('stone'), (ctx) => {
    bevel(ctx, c.stone, 'rgba(0,0,0,0.25)');
  });
  keys.brick = canvasTile(scene, k('brick'), (ctx) => {
    ctx.fillStyle = theme === 'castillo' ? '#7a6a8a' : '#c8643a';
    ctx.fillRect(0, 0, T, T);
    ctx.strokeStyle = theme === 'castillo' ? '#3a2f4a' : '#6e2c16';
    ctx.lineWidth = 3;
    for (const y of [T / 3, (2 * T) / 3]) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(T, y);
      ctx.stroke();
    }
    for (const [x, y0, y1] of [[T / 2, 0, T / 3], [T / 4, T / 3, (2 * T) / 3], [(3 * T) / 4, T / 3, (2 * T) / 3], [T / 2, (2 * T) / 3, T]]) {
      ctx.beginPath();
      ctx.moveTo(x, y0);
      ctx.lineTo(x, y1);
      ctx.stroke();
    }
    ctx.strokeStyle = INK;
    ctx.strokeRect(1.5, 1.5, T - 3, T - 3);
  });
  keys.question = canvasTile(scene, k('question'), (ctx) => questionBlock(ctx, '#ffc93c', '#c98a12'));
  keys.used = canvasTile(scene, k('used'), (ctx) => {
    bevel(ctx, '#a07850', '#6e4f30');
    ctx.fillStyle = '#6e4f30';
    for (const [x, y] of [[8, 8], [T - 8, 8], [8, T - 8], [T - 8, T - 8]]) {
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  });
  for (const [name, left, top] of [['pipeTL', true, true], ['pipeTR', false, true], ['pipeL', true, false], ['pipeR', false, false]]) {
    keys[name] = canvasTile(scene, k(name), (ctx) => pipe(ctx, left, top));
  }
  keys.semi = canvasTile(scene, k('semi'), (ctx) => semi(ctx, c.semi));
  keys.spikes = canvasTile(scene, k('spikes'), (ctx) => {
    ctx.fillStyle = '#d9dce8';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3;
    for (let i = 0; i < 3; i += 1) {
      ctx.beginPath();
      ctx.moveTo(i * 16 + 1, T);
      ctx.lineTo(i * 16 + 8, 14);
      ctx.lineTo(i * 16 + 15, T);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
  });
  keys.lava = canvasTile(scene, k('lava'), (ctx) => {
    ctx.fillStyle = '#ff5a1f';
    ctx.fillRect(0, 0, T, T);
    ctx.fillStyle = '#ffb02e';
    for (const [x, y, r] of [[10, 18, 5], [30, 32, 7], [40, 12, 4]]) {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  });
  keys.lavaTop = canvasTile(scene, k('lavaTop'), (ctx) => {
    ctx.fillStyle = '#ff5a1f';
    ctx.beginPath();
    ctx.moveTo(0, 12);
    for (let x = 0; x <= T; x += 12) ctx.quadraticCurveTo(x + 6, 4, x + 12, 12);
    ctx.lineTo(T, T);
    ctx.lineTo(0, T);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ffd84d';
    ctx.fillRect(0, 12, T, 4);
  });
  return keys;
}

function dirt(ctx, c) {
  ctx.fillStyle = c.fillDark;
  for (const [x, y, r] of [[9, 30, 3], [30, 38, 4], [38, 20, 2.5], [18, 42, 2]]) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

function questionBlock(ctx, fill, dark) {
  bevel(ctx, fill, dark, 'rgba(255,255,255,0.5)');
  ctx.fillStyle = dark;
  for (const [x, y] of [[7, 7], [T - 7, 7], [7, T - 7], [T - 7, T - 7]]) {
    ctx.beginPath();
    ctx.arc(x, y, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.font = 'bold 34px "Segoe UI", Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 5;
  ctx.strokeStyle = INK;
  ctx.strokeText('?', T / 2, T / 2 + 2);
  ctx.fillStyle = '#ffffff';
  ctx.fillText('?', T / 2, T / 2 + 2);
}

function pipe(ctx, left, top) {
  const x0 = left ? (top ? 0 : 5) : 0;
  const x1 = left ? T : top ? T : T - 5;
  ctx.fillStyle = '#3fbf4a';
  ctx.fillRect(x0, 0, x1 - x0, T);
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  if (left) ctx.fillRect(x0 + 8, 0, 8, T);
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  if (!left) ctx.fillRect(x1 - 14, 0, 10, T);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.beginPath();
  if (left) {
    ctx.moveTo(x0 + 1.5, 0);
    ctx.lineTo(x0 + 1.5, T);
  } else {
    ctx.moveTo(x1 - 1.5, 0);
    ctx.lineTo(x1 - 1.5, T);
  }
  ctx.stroke();
  if (top) {
    ctx.beginPath();
    ctx.moveTo(0, 1.5);
    ctx.lineTo(T, 1.5);
    ctx.moveTo(0, T - 6);
    ctx.lineTo(T, T - 6);
    ctx.stroke();
  }
}

function semi(ctx, look) {
  if (look === 'cloud') {
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#9fc6ee';
    ctx.lineWidth = 3;
    for (const [x, r] of [[10, 13], [24, 16], [38, 13]]) {
      ctx.beginPath();
      ctx.arc(x, 16, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    ctx.fillRect(4, 12, T - 8, 14);
    return;
  }
  const colors = { wood: ['#c98a4a', '#7a4a1e'], rock: ['#7c7fa6', '#3d3f66'], coral: ['#ff8fb0', '#c24f78'], stone: ['#9a9aae', '#4a4a5e'] }[look];
  rounded(ctx, 1.5, 1.5, T - 3, 18, 6);
  ctx.fillStyle = colors[0];
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.strokeStyle = colors[1];
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(T / 2, 4);
  ctx.lineTo(T / 2, 18);
  ctx.stroke();
}

// Qué textura le toca a la letra `ch` en la columna `col`, fila `row` del nivel (o null si no se dibuja).
export function tileTexture(keys, level, col, row) {
  const ch = level.at(col, row);
  switch (ch) {
    case '#':
      return level.at(col, row - 1) === '#' || level.at(col, row - 1) === 'X' ? keys.fill : keys.top;
    case 'X':
      return keys.stone;
    case 'B':
    case 'b':
      return keys.brick;
    case '?':
    case 'M':
    case 'S':
    case 'Y':
      return keys.question;
    case 'U':
      return keys.used;
    case '[':
      return keys.pipeTL;
    case ']':
      return keys.pipeTR;
    case '(':
      return keys.pipeL;
    case ')':
      return keys.pipeR;
    case '=':
      return keys.semi;
    case '^':
      return keys.spikes;
    case 'L':
      return level.at(col, row - 1) === 'L' ? keys.lava : keys.lavaTop;
    default:
      return null;
  }
}
