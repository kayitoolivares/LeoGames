import { attackDir, goalMouthX } from './field.js';

// Qué tan bien juega la compu en cada nivel: velocidad (1 = como un jugador), qué tanto tarda en patear
// (probabilidad por cuadro) y la fuerza de sus patadas. En Fácil los peques le pueden ganar.
export const CPU_LEVELS = {
  facil: { name: 'Fácil', speed: 0.6, kickChance: 0.03, power: 0.75 },
  normal: { name: 'Normal', speed: 0.75, kickChance: 0.06, power: 0.9 },
  dificil: { name: 'Difícil', speed: 0.92, kickChance: 0.15, power: 1 },
};
const GOALIE_ZONE = 420;

// Decide qué "aprieta" un jugador de la compu este cuadro (mismo formato que un control).
// Se pone detrás del balón viendo hacia la portería contraria y lo empuja o lo patea; si el balón
// quedó atrás de él, salta para pasarse al otro lado. Con `goalie` se queda cuidando su portería
// hasta que el balón se acerca.
export function cpuInput(player, ball, goalie = false, level = CPU_LEVELS.facil) {
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
  return {
    x,
    jump: highBall || hopOver,
    kick: near && !wrongSide && Math.random() < level.kickChance,
    up: false,
    down: false,
    power: level.power,
  };
}
