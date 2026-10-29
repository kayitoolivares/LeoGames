import { B, BLOCKS, T } from './blocks.js';

// Cómo se mueven los cuerpos contra los bloques. Un cuerpo es { x, y, w, h, vx, vy }: x es el centro y y los pies.
// Se mueve primero de lado y luego de arriba a abajo, en pasitos chicos para que nada atraviese un bloque.
// Con `b.doorsSolid` las puertas también lo detienen (los slimes no saben abrir puertas).
const STEP = T / 4;
const INSET = 2;

export function solidFor(b, id) {
  return BLOCKS[id]?.solid || (b.doorsSolid && id === B.DOOR);
}

// Mueve el cuerpo `dt` segundos. Deja b.onGround, b.hitWall (-1 izquierda, 1 derecha, 0) y b.hitCeiling.
export function moveBody(world, b, dt) {
  const dist = Math.max(Math.abs(b.vx * dt), Math.abs(b.vy * dt));
  const steps = Math.max(1, Math.ceil(dist / STEP));
  const h = dt / steps;
  b.onGround = false;
  b.hitWall = 0;
  b.hitCeiling = false;
  for (let i = 0; i < steps; i += 1) {
    b.x += b.vx * h;
    resolveX(world, b);
    b.y += b.vy * h;
    resolveY(world, b);
  }
}

function resolveX(world, b) {
  const r0 = Math.floor((b.y - b.h + INSET) / T);
  const r1 = Math.floor((b.y - INSET) / T);
  const right = Math.floor((b.x + b.w / 2) / T);
  const left = Math.floor((b.x - b.w / 2) / T);
  for (let r = r0; r <= r1; r += 1) {
    if (b.vx >= 0 && solidFor(b, world.get(right, r))) {
      b.x = right * T - b.w / 2 - 0.01;
      b.hitWall = 1;
      b.vx = 0;
      return;
    }
    if (b.vx <= 0 && solidFor(b, world.get(left, r))) {
      b.x = (left + 1) * T + b.w / 2 + 0.01;
      b.hitWall = -1;
      b.vx = 0;
      return;
    }
  }
}

function resolveY(world, b) {
  const c0 = Math.floor((b.x - b.w / 2 + INSET) / T);
  const c1 = Math.floor((b.x + b.w / 2 - INSET) / T);
  if (b.vy >= 0) {
    const row = Math.floor(b.y / T);
    for (let c = c0; c <= c1; c += 1) {
      if (solidFor(b, world.get(c, row))) {
        b.y = row * T;
        b.vy = 0;
        b.onGround = true;
        return;
      }
    }
    return;
  }
  const row = Math.floor((b.y - b.h) / T);
  for (let c = c0; c <= c1; c += 1) {
    if (solidFor(b, world.get(c, row))) {
      b.y = (row + 1) * T + b.h + 0.01;
      b.vy = 0;
      b.hitCeiling = true;
      return;
    }
  }
}

// ¿El cuerpo toca algún cuadrito de este tipo? (agua, escalera...)
export function touches(world, b, test) {
  const c0 = Math.floor((b.x - b.w / 2 + INSET) / T);
  const c1 = Math.floor((b.x + b.w / 2 - INSET) / T);
  const r0 = Math.floor((b.y - b.h + INSET) / T);
  const r1 = Math.floor((b.y - INSET) / T);
  for (let r = r0; r <= r1; r += 1) {
    for (let c = c0; c <= c1; c += 1) if (test(world.get(c, r))) return true;
  }
  return false;
}

// ¿El cuadrito (col, row) se encima con el cuerpo?
export function cellOverlaps(b, col, row, pad = 2) {
  const x0 = col * T;
  const y0 = row * T;
  return b.x + b.w / 2 - pad > x0 && b.x - b.w / 2 + pad < x0 + T && b.y - pad > y0 && b.y - b.h + pad < y0 + T;
}

// ¿Está atorado dentro de algo sólido?
export function stuck(world, b) {
  return touches(world, b, (id) => solidFor(b, id));
}
