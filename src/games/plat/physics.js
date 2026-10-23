import { T, isSemi, isSolid } from './tiles.js';

// Cómo se mueven las cosas contra los cuadritos del nivel. Un "cuerpo" es { x, y, w, h, vx, vy }: x es el centro,
// y son los pies. Se mueve primero de lado y luego de arriba a abajo, en pasitos chicos para que nada atraviese un
// cuadrito aunque vaya muy rápido.
const STEP = T / 3;
const INSET = 3;

function solidAt(level, col, row) {
  return isSolid(level.at(col, row));
}

// Mueve el cuerpo `dt` segundos. Al pegarle a algo de abajo con la cabeza, llama hooks.bump(col, row).
// Deja b.onGround, b.hitWall (-1 izquierda, 1 derecha, 0) y b.hitCeiling.
export function moveBody(level, b, dt, hooks = {}) {
  const dist = Math.max(Math.abs(b.vx * dt), Math.abs(b.vy * dt));
  const steps = Math.max(1, Math.ceil(dist / STEP));
  const h = dt / steps;
  b.onGround = false;
  b.hitWall = 0;
  b.hitCeiling = false;
  for (let i = 0; i < steps; i += 1) {
    b.x += b.vx * h;
    resolveX(level, b);
    const prevBottom = b.y;
    b.y += b.vy * h;
    resolveY(level, b, prevBottom, hooks);
  }
}

function resolveX(level, b) {
  const r0 = Math.floor((b.y - b.h + INSET) / T);
  const r1 = Math.floor((b.y - INSET) / T);
  const right = Math.floor((b.x + b.w / 2) / T);
  const left = Math.floor((b.x - b.w / 2) / T);
  for (let r = r0; r <= r1; r += 1) {
    if (b.vx >= 0 && solidAt(level, right, r)) {
      b.x = right * T - b.w / 2 - 0.01;
      b.hitWall = 1;
      return;
    }
    if (b.vx <= 0 && solidAt(level, left, r)) {
      b.x = (left + 1) * T + b.w / 2 + 0.01;
      b.hitWall = -1;
      return;
    }
  }
}

function resolveY(level, b, prevBottom, hooks) {
  const c0 = Math.floor((b.x - b.w / 2 + INSET) / T);
  const c1 = Math.floor((b.x + b.w / 2 - INSET) / T);
  if (b.vy >= 0) {
    const row = Math.floor(b.y / T);
    const top = row * T;
    for (let c = c0; c <= c1; c += 1) {
      const ch = level.at(c, row);
      // Lo que se atraviesa desde abajo solo detiene si venías de arriba.
      if (isSolid(ch) || (isSemi(ch) && prevBottom <= top + 1 && !b.dropping)) {
        b.y = top;
        b.vy = 0;
        b.onGround = true;
        return;
      }
    }
    return;
  }
  const row = Math.floor((b.y - b.h) / T);
  // El bloque más cercano al centro es el que se golpea (como en Mario).
  let hit = null;
  for (let c = c0; c <= c1; c += 1) {
    const ch = level.at(c, row);
    const hidden = ch === 'H' && b.canFindHidden;
    if (!isSolid(ch) && !hidden) continue;
    const center = c * T + T / 2;
    if (!hit || Math.abs(center - b.x) < Math.abs(hit * T + T / 2 - b.x)) hit = c;
  }
  if (hit === null) return;
  b.y = (row + 1) * T + b.h;
  b.vy = 0;
  b.hitCeiling = true;
  hooks.bump?.(hit, row);
}

// ¿Hay piso (algo sólido o que se pisa) justo debajo de este punto?
export function groundBelow(level, x, y) {
  const ch = level.at(Math.floor(x / T), Math.floor((y + 2) / T));
  return isSolid(ch) || isSemi(ch);
}

// ¿Tocan dos cajas? (a y b con x al centro y y en los pies)
export function overlaps(a, b, pad = 0) {
  return Math.abs(a.x - b.x) < (a.w + b.w) / 2 - pad && a.y - a.h + pad < b.y && b.y - b.h + pad < a.y;
}

// ¿Qué letra hay en el punto (x, y)?
export function tileAt(level, x, y) {
  return level.at(Math.floor(x / T), Math.floor(y / T));
}
