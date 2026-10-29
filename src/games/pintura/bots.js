import { ballisticPitch, BALLOON } from './weapons.js';
import { STEP } from './arenas.js';

// La compu: camina de un punto a otro de la arena, persigue al rival que ve y le dispara (con poca puntería en fácil).
// En "Pinta el piso" busca lo que no está pintado de su color y va pintando el piso por donde pasa.
export const LEVELS = {
  facil: { name: 'Fácil', sight: 18, turn: 2.4, reactMs: 850, error: 0.16, balloonPerSecond: 0.03 },
  normal: { name: 'Normal', sight: 26, turn: 4.4, reactMs: 380, error: 0.06, balloonPerSecond: 0.07 },
};
const THINK_MS = 260;
const STUCK_MS = 1100;
const FLOOR_PITCH = -0.5;

// Decide qué hace este pintor de la compu en este cuadro: mueve su `yaw`/`pitch` y devuelve
// { moveX, moveY, fire, jump, swim, balloon }.
export function botInput(game, bot, dtMs) {
  const level = LEVELS[game.settings.level];
  const ai = (bot.ai ??= {
    thinkMs: 0,
    target: null,
    seenMs: 0,
    waypoint: null,
    stuckMs: 0,
    from: { x: bot.x, z: bot.z },
    strafe: 1,
    strafeMs: 0,
    errMs: 0,
    err: [0, 0],
    refill: false,
  });
  const input = { moveX: 0, moveY: 0, fire: false, jump: false, swim: false, balloon: false };
  if (bot.frozen) return input;
  const weapon = bot.weapon;

  ai.thinkMs -= dtMs;
  if (ai.thinkMs <= 0) {
    ai.thinkMs = THINK_MS;
    const before = ai.target;
    ai.target = pickTarget(game, bot, level);
    if (ai.target !== before) ai.seenMs = 0;
  }
  ai.seenMs += dtMs;
  ai.errMs -= dtMs;
  if (ai.errMs <= 0) {
    ai.errMs = 500 + Math.random() * 500;
    ai.err = [(Math.random() * 2 - 1) * level.error, (Math.random() * 2 - 1) * level.error * 0.6];
  }
  // Sin tinta: deja de disparar hasta llenarse (nadando si está en su tinta).
  if (bot.ink < 12) ai.refill = true;
  if (ai.refill && bot.ink > 70) ai.refill = false;

  const target = ai.target && (ai.target.alive ?? true) ? ai.target : null;
  if (target) {
    const dx = target.x - bot.x;
    const dz = target.z - bot.z;
    const dist = Math.hypot(dx, dz);
    turnToward(bot, Math.atan2(dx, dz) + ai.err[0], level.turn, dtMs);
    const rise = target.y + (target.aimHeight ?? 1) - (bot.y + bot.eye);
    const pitch = ballisticPitch(dist, rise, weapon.speed, weapon.gravity) ?? 0.6;
    bot.pitch += (pitch + ai.err[1] - bot.pitch) * Math.min(1, dtMs / 120);
    // Se acerca hasta tenerlo a tiro y se mueve de lado para que no le atinen tan fácil.
    if (dist > weapon.range * 0.8) input.moveY = -1;
    else if (dist < weapon.range * 0.35) input.moveY = 0.6;
    ai.strafeMs -= dtMs;
    if (ai.strafeMs <= 0) {
      ai.strafeMs = 900 + Math.random() * 1300;
      ai.strafe = Math.random() < 0.5 ? -1 : 1;
    }
    input.moveX = ai.strafe * 0.6;
    const facing = Math.abs(angleDiff(Math.atan2(dx, dz), bot.yaw)) < 0.35;
    input.fire = facing && ai.seenMs > level.reactMs && dist < weapon.range * 1.1 && !ai.refill;
    if (bot.ink >= BALLOON.ink && dist > 7 && dist < 16 && Math.random() < (level.balloonPerSecond * dtMs) / 1000) input.balloon = true;
    if (weapon.roller && dist < 6) input.moveY = -1;
  } else {
    walkWaypoints(game, bot, ai, dtMs, input, level);
  }

  if (ai.refill) {
    input.fire = false;
    input.swim = game.floor.ownerAt(bot.x, bot.z) === bot.team;
  }
  // ¿Atorado? Otro punto y un brinquito.
  const moved = Math.hypot(bot.x - ai.from.x, bot.z - ai.from.z);
  if (input.moveY !== 0 || input.moveX !== 0) ai.stuckMs += dtMs;
  if (moved > 0.6) {
    ai.stuckMs = 0;
    ai.from = { x: bot.x, z: bot.z };
  } else if (ai.stuckMs > STUCK_MS) {
    ai.stuckMs = 0;
    ai.waypoint = null;
    ai.strafe = -ai.strafe;
    input.jump = true;
  }
  return input;
}

// El rival más cercano que se vea (los que van nadando en su tinta solo se ven de cerquita).
function pickTarget(game, bot, level) {
  let best = null;
  let bestDist = level.sight;
  for (const other of game.targetsFor(bot.team)) {
    const dist = Math.hypot(other.x - bot.x, other.z - bot.z);
    if (dist >= bestDist) continue;
    if (other.swimming && dist > 6) continue;
    if (!game.world.lineOfSight(bot.x, bot.z, other.x, other.z, Math.max(bot.y, other.y) + 1.5)) continue;
    best = other;
    bestDist = dist;
  }
  return best;
}

// Sin nadie a la vista: camina de un punto a otro (en "Pinta el piso", hacia lo que no es de su color, pintando).
function walkWaypoints(game, bot, ai, dtMs, input, level) {
  if (!ai.waypoint || Math.hypot(ai.waypoint.x - bot.x, ai.waypoint.z - bot.z) < 1.6) ai.waypoint = chooseWaypoint(game, bot);
  const wp = ai.waypoint;
  if (!wp) return;
  const desired = Math.atan2(wp.x - bot.x, wp.z - bot.z);
  turnToward(bot, desired, level.turn, dtMs);
  input.moveY = Math.abs(angleDiff(desired, bot.yaw)) < 0.9 ? -1 : -0.2;
  const paintFloor = game.settings.mode === 'piso' || game.settings.mode === 'robots';
  bot.pitch += ((paintFloor ? FLOOR_PITCH : 0) - bot.pitch) * Math.min(1, dtMs / 200);
  if (paintFloor && !ai.refill && game.floor.ownerAt(bot.x + Math.sin(bot.yaw) * 3, bot.z + Math.cos(bot.yaw) * 3) !== bot.team) input.fire = true;
  if (bot.weapon.roller && paintFloor && !ai.refill) input.fire = true;
}

function chooseWaypoint(game, bot) {
  const enemySide = bot.team === 0 ? -1 : 1;
  const mode = game.settings.mode;
  let best = null;
  let bestScore = -Infinity;
  for (let i = 0; i < 14; i += 1) {
    const wp = game.arena.waypoints[Math.floor(Math.random() * game.arena.waypoints.length)];
    const dist = Math.hypot(wp.x - bot.x, wp.z - bot.z);
    if (dist < 5 || dist > 26) continue;
    if (!game.world.lineOfSight(bot.x, bot.z, wp.x, wp.z, STEP + 0.05)) continue;
    let score = Math.random();
    if (mode === 'piso') score += game.floor.ownerAt(wp.x, wp.z) === bot.team ? 0 : 2;
    // Hacia el lado del otro equipo (o hacia en medio, donde salen los robots).
    else score += (wp.z * enemySide) / game.world.halfD;
    if (score > bestScore) {
      bestScore = score;
      best = wp;
    }
  }
  return best;
}

function turnToward(bot, desired, rate, dtMs) {
  const diff = angleDiff(desired, bot.yaw);
  const step = (rate * dtMs) / 1000;
  bot.yaw += Math.max(-step, Math.min(step, diff));
}

export function angleDiff(a, b) {
  return Math.atan2(Math.sin(a - b), Math.cos(a - b));
}
