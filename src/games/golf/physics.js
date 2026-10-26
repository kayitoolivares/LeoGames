import { holeWalls, onGrass } from './holes.js';

// La física del Minigolf: la pelota rueda y se va frenando, rebota en los barandales, los hongos, las aspas del molino y
// las paredes que se mueven, la arena la frena mucho, las rampas la empujan, los portales la pasan al otro lado y cerca
// del hoyo se jala tantito hacia adentro (para que los peques sí la metan).
export const BALL_RADIUS = 13;
export const CUP_RADIUS = 16;
const ROLL = 0.85;
const SAND = 4;
const DRAG = 25;
const WALL_BOUNCE = 0.75;
const BUMPER_BOUNCE = 1.25;
const MAX_STEP = 5;
export const HUB_RADIUS = 20;
// Más lenta que esto, la pelota que pasa por el hoyo se cae; cerca del hoyo y despacito, se jala hacia él.
const CUP_SPEED = 520;
const CUP_PULL = { reach: 34, speed: 240, force: 900 };
// Se considera quieta cuando va así de lento un ratito (también en las rampas, para que el turno sí se acabe).
const REST_SPEED = 9;
const REST_MS = 350;
export const MAX_SHOT = 900;

// Un hoyo listo para jugar: sus barandales y las cosas que se mueven.
export class Course {
  constructor(hole) {
    this.hole = hole;
    this.walls = holeWalls(hole);
    this.t = 0;
  }

  update(dtMs) {
    this.t += dtMs;
  }

  // Las aspas de un molino ahorita: 4 segmentos desde el centro (y la velocidad de la punta, para el empujón).
  blades(mill) {
    const angle = mill.speed * (this.t / 1000);
    return [0, 1, 2, 3].map((k) => {
      const a = angle + (k * Math.PI) / 2;
      return { x1: mill.x, y1: mill.y, x2: mill.x + Math.cos(a) * mill.length, y2: mill.y + Math.sin(a) * mill.length, a };
    });
  }

  // Dónde va una pared que se mueve ahorita (y a qué velocidad).
  mover(m) {
    const phase = Math.sin((this.t / m.periodMs) * Math.PI * 2);
    const speed = Math.cos((this.t / m.periodMs) * Math.PI * 2) * ((Math.PI * 2) / (m.periodMs / 1000)) * 0.5;
    const k = (phase + 1) / 2;
    return { x: m.x + m.dx * k, y: m.y + m.dy * k, w: m.w, h: m.h, vx: m.dx * speed, vy: m.dy * speed };
  }
}

const inRect = (r, x, y) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

// Rebota la pelota contra el segmento si lo toca (`vx`, `vy`: cómo se mueve el segmento).
function bounceSegment(ball, x1, y1, x2, y2, vx = 0, vy = 0, bounce = WALL_BOUNCE) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len2 = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((ball.x - x1) * dx + (ball.y - y1) * dy) / len2));
  const qx = x1 + dx * t;
  const qy = y1 + dy * t;
  const ox = ball.x - qx;
  const oy = ball.y - qy;
  const d = Math.hypot(ox, oy);
  if (d >= BALL_RADIUS || d === 0) return false;
  const nx = ox / d;
  const ny = oy / d;
  ball.x = qx + nx * BALL_RADIUS;
  ball.y = qy + ny * BALL_RADIUS;
  const rvx = ball.vx - vx;
  const rvy = ball.vy - vy;
  const vn = rvx * nx + rvy * ny;
  if (vn < 0) {
    ball.vx = rvx - (1 + bounce) * vn * nx + vx;
    ball.vy = rvy - (1 + bounce) * vn * ny + vy;
  }
  return true;
}

// Rebota la pelota contra un círculo (un hongo o el centro del molino); `minOut`: con qué velocidad sale por lo menos.
function bounceCircle(ball, x, y, r, bounce, minOut) {
  const d = Math.hypot(ball.x - x, ball.y - y);
  const min = r + BALL_RADIUS;
  if (d >= min || d === 0) return false;
  const nx = (ball.x - x) / d;
  const ny = (ball.y - y) / d;
  ball.x = x + nx * min;
  ball.y = y + ny * min;
  const vn = ball.vx * nx + ball.vy * ny;
  // (Si ya iba saliendo, nomás se asegura de que salga con la velocidad mínima.)
  const out = vn < 0 ? Math.max(-vn * bounce, minOut) : Math.max(vn, minOut);
  ball.vx += (out - vn) * nx;
  ball.vy += (out - vn) * ny;
  return true;
}

// Mueve la pelota `dtMs` y avisa lo que le pasó: { wall, bumper, water, portal, sank }.
export function stepBall(ball, course, dtMs) {
  const hole = course.hole;
  const events = {};
  const dt = dtMs / 1000;
  const speed = Math.hypot(ball.vx, ball.vy);
  const steps = Math.max(1, Math.ceil((speed * dt) / MAX_STEP));
  const h = dt / steps;
  for (let s = 0; s < steps; s += 1) {
    // Rampas: empujan; arena: frena muchísimo; el pasto, poquito.
    let friction = ROLL;
    for (const slope of hole.slopes ?? []) {
      if (!inRect(slope, ball.x, ball.y)) continue;
      ball.vx += slope.fx * h;
      ball.vy += slope.fy * h;
    }
    for (const sand of hole.sand ?? []) if (inRect(sand, ball.x, ball.y)) friction = SAND;
    const v = Math.hypot(ball.vx, ball.vy);
    if (v > 0) {
      const slower = Math.max(0, v * Math.exp(-friction * h) - DRAG * h);
      ball.vx *= slower / v;
      ball.vy *= slower / v;
    }
    // Cerca del hoyo y despacito: se jala hacia él.
    const [cx, cy] = hole.cup;
    const toCup = Math.hypot(cx - ball.x, cy - ball.y);
    if (toCup < CUP_PULL.reach && Math.hypot(ball.vx, ball.vy) < CUP_PULL.speed) {
      ball.vx += ((cx - ball.x) / (toCup || 1)) * CUP_PULL.force * h;
      ball.vy += ((cy - ball.y) / (toCup || 1)) * CUP_PULL.force * h;
    }
    ball.x += ball.vx * h;
    ball.y += ball.vy * h;
    for (const [x1, y1, x2, y2] of course.walls) if (bounceSegment(ball, x1, y1, x2, y2)) events.wall = true;
    // Los hongos avientan: la pelota siempre sale por lo menos a esta velocidad.
    for (const b of hole.bumpers ?? []) if (bounceCircle(ball, b.x, b.y, b.r, BUMPER_BOUNCE, 320)) events.bumper = b;
    for (const mill of hole.windmills ?? []) {
      for (const blade of course.blades(mill)) {
        // La punta del aspa va más rápido que el centro: se usa la velocidad de donde pega (aproximada a la mitad).
        const tip = (mill.speed * mill.length) / 2;
        if (bounceSegment(ball, blade.x1, blade.y1, blade.x2, blade.y2, -Math.sin(blade.a) * tip, Math.cos(blade.a) * tip)) events.wall = true;
      }
      // El centro del molino.
      if (bounceCircle(ball, mill.x, mill.y, HUB_RADIUS, WALL_BOUNCE, 0)) events.wall = true;
    }
    for (const m of hole.movers ?? []) {
      const r = course.mover(m);
      const edges = [
        [r.x, r.y, r.x + r.w, r.y],
        [r.x + r.w, r.y, r.x + r.w, r.y + r.h],
        [r.x + r.w, r.y + r.h, r.x, r.y + r.h],
        [r.x, r.y + r.h, r.x, r.y],
      ];
      for (const [x1, y1, x2, y2] of edges) if (bounceSegment(ball, x1, y1, x2, y2, r.vx, r.vy)) events.wall = true;
    }
    // Portales: entra por uno y sale por el otro (un ratito no vuelve a entrar).
    if (!ball.portalMs) {
      for (const portal of hole.portals ?? []) {
        if (Math.hypot(ball.x - portal.a[0], ball.y - portal.a[1]) < 24) {
          ball.x = portal.b[0] + Math.sign(ball.vx || 1) * 30;
          ball.y = portal.b[1];
          ball.portalMs = 600;
          events.portal = portal;
        }
      }
    }
    // El hoyo: si pasa despacito por encima, se cae.
    if (Math.hypot(cx - ball.x, cy - ball.y) < CUP_RADIUS - 3 && Math.hypot(ball.vx, ball.vy) < CUP_SPEED) {
      events.sank = true;
      ball.vx = 0;
      ball.vy = 0;
      ball.x = cx;
      ball.y = cy;
      return events;
    }
    for (const water of hole.water ?? []) {
      if (!inRect(water, ball.x, ball.y)) continue;
      events.water = true;
      return events;
    }
  }
  ball.portalMs = Math.max(0, (ball.portalMs ?? 0) - dtMs);
  // Si por algo se salió del pasto, cuenta como si se hubiera ido al agua (regresa de donde tiró).
  if (!onGrass(hole, ball.x, ball.y)) events.out = true;
  // ¿Ya se quedó quieta?
  const now = Math.hypot(ball.vx, ball.vy);
  ball.slowMs = now < REST_SPEED ? (ball.slowMs ?? 0) + dtMs : 0;
  if (ball.slowMs >= REST_MS) {
    ball.vx = 0;
    ball.vy = 0;
    events.rest = true;
  }
  return events;
}

// Para la línea de ayuda: por dónde iría la pelota tirada así (puntitos cada tanto, sin contar lo que se mueve).
export function predictPath(course, x, y, vx, vy, { ms = 900, every = 45 } = {}) {
  const ghost = { x, y, vx, vy };
  const hole = { ...course.hole, windmills: [], movers: [], portals: [], water: [] };
  const fake = { hole, walls: course.walls, blades: () => [], mover: () => null };
  const points = [];
  for (let t = 0; t < ms; t += 15) {
    const events = stepBall(ghost, fake, 15);
    if (t % every < 15) points.push([ghost.x, ghost.y]);
    if (events.sank || events.rest || events.out) break;
  }
  return points;
}
