import { METER_MAX } from './FutbolPlayer.js';
import { FIELD, attackDir, goalMouthX } from './field.js';

// Qué tan bien juega la compu en cada nivel: velocidad (1 = como un jugador), qué tanto tarda en patear
// (probabilidad por cuadro), la fuerza de sus patadas, qué tan seguido se barre, regatea o pasa el balón y qué tanto
// atrapa el balón su portero. En Fácil los peques le pueden ganar.
export const CPU_LEVELS = {
  facil: { name: 'Fácil', speed: 0.6, kickChance: 0.03, power: 0.75, slideChance: 0.004, dribbleChance: 0.002, passChance: 0.003, catchChance: 0.25 },
  normal: { name: 'Normal', speed: 0.75, kickChance: 0.06, power: 0.9, slideChance: 0.01, dribbleChance: 0.005, passChance: 0.006, catchChance: 0.45 },
  dificil: { name: 'Difícil', speed: 0.92, kickChance: 0.15, power: 1, slideChance: 0.02, dribbleChance: 0.01, passChance: 0.012, catchChance: 0.65 },
};
const GOALIE_ZONE = 420;
const SLIDE_RANGE = 150;
const SPECIAL_RANGE = 760;

// Decide qué "aprieta" un jugador de la compu este cuadro (mismo formato que un control).
// Se pone detrás del balón viendo hacia la portería contraria y lo empuja o lo patea; si el balón
// quedó atrás de él, salta para pasarse al otro lado. Con `goalie` se queda cuidando su portería
// hasta que el balón se acerca. Con `others` (los demás jugadores) también se barre contra el rival
// que trae el balón, regatea o se la pasa a un compañero que va más adelante cuando lo vienen a quitar; con la
// barra llena, hace su tiro especial.
export function cpuInput(player, ball, goalie = false, level = CPU_LEVELS.facil, others = []) {
  const dir = attackDir(player.team);
  const ownGoal = goalMouthX(player.team);
  const wrongSide = (ball.x - player.x) * dir < 0;
  let targetX;
  if (goalie && Math.abs(ball.x - ownGoal) > GOALIE_ZONE) {
    targetX = ownGoal + dir * 110;
  } else {
    const behind = ball.x - dir * (player.radius + ball.radius + 6);
    targetX = wrongSide ? behind - dir * 40 : behind + dir * 30;
  }
  const dx = targetX - player.x;
  const x = Math.abs(dx) < 8 ? 0 : Math.max(-1, Math.min(1, dx / 60)) * level.speed;
  const closeX = Math.abs(ball.x - player.x);
  const near = Math.hypot(ball.x - player.x, ball.y - player.y) < player.radius + ball.radius + 30;
  const highBall = closeX < 90 && ball.y < player.y - 70 && ball.vy > -150;
  const hopOver = wrongSide && closeX < 75 && ball.y > player.y - 40;
  // Un rival con el balón enfrente, viniendo hacia acá: ¡barrida!
  const rivals = others.filter((p) => p.team !== player.team && !p.busy);
  const carrier = rivals.find((p) => Math.abs(p.x - ball.x) < p.radius + ball.radius + 20 && ball.y > p.y - 30);
  const slide =
    Boolean(carrier) &&
    (carrier.x - player.x) * player.facing > 0 &&
    Math.abs(carrier.x - player.x) < SLIDE_RANGE &&
    Math.random() < level.slideChance * 6;
  // Con el balón y un rival muy cerca enfrente: regate.
  const blocker = rivals.some((p) => (p.x - player.x) * dir > 0 && Math.abs(p.x - player.x) < 130);
  const dribble = near && !wrongSide && blocker && Math.random() < level.dribbleChance * 6;
  const mateAhead = others.some((p) => p !== player && p.team === player.team && !p.goalie && (p.x - player.x) * dir > 120);
  const pass = near && !wrongSide && blocker && mateAhead && !dribble && Math.random() < level.passChance * 6;
  const shotRange = Math.abs(goalMouthX(1 - player.team) - player.x) < SPECIAL_RANGE;
  const special = near && !wrongSide && shotRange && ball.y > FIELD.ground - 200 && (player.specialReady || player.meter >= METER_MAX);
  return {
    x,
    jump: highBall || hopOver,
    kick: near && !wrongSide && Math.random() < level.kickChance,
    slide: slide && !near,
    dribble,
    pass,
    special,
    up: false,
    down: false,
    power: level.power,
  };
}
