// Moverse por casillas (jugadores y fantasmitas). La posición va en casillas (x, y; el centro de cada casilla es un
// número entero) y solo se puede dar vuelta en el centro de una casilla. Darse la vuelta (ir para atrás) se puede siempre.
// Por los túneles de las orillas se sale por el otro lado.
export const STOP = { x: 0, y: 0 };
const EPS = 1e-6;

export const sameDir = (a, b) => Boolean(a && b) && a.x === b.x && a.y === b.y;
export const isStopped = (d) => !d.x && !d.y;

// Avanza `dist` casillas. `canEnter(x, y)`: si se puede pisar esa casilla. `onCenter(actor, cx, cy)`: en cada centro
// de casilla, para cambiar de dirección (la del jugador guardada, la que escoge el fantasmita). `width`: para los túneles.
export function step(actor, dist, { canEnter, onCenter, width }) {
  for (let guard = 0; dist > EPS && guard < 12; guard += 1) {
    const cx = Math.round(actor.x);
    const cy = Math.round(actor.y);
    if (Math.abs(actor.x - cx) < EPS && Math.abs(actor.y - cy) < EPS) {
      actor.x = cx;
      actor.y = cy;
      onCenter?.(actor, cx, cy);
      if (!isStopped(actor.dir) && !canEnter(cx + actor.dir.x, cy + actor.dir.y)) actor.dir = STOP;
    }
    if (isStopped(actor.dir)) return;
    // Lo que falta para el centro de la casilla que sigue.
    const { x: dx, y: dy } = actor.dir;
    const from = dx ? actor.x : actor.y;
    const dir = dx || dy;
    const next = dir > 0 ? Math.floor(from + EPS) + 1 : Math.ceil(from - EPS) - 1;
    const gap = Math.abs(next - from);
    const move = Math.min(gap, dist);
    if (move >= gap - EPS) {
      if (dx) actor.x = next;
      else actor.y = next;
    } else if (dx) {
      actor.x += dx * move;
    } else {
      actor.y += dy * move;
    }
    dist -= move;
    // El túnel: del otro lado.
    if (actor.x < -0.5) actor.x += width;
    else if (actor.x > width - 0.5) actor.x -= width;
  }
}

// La casilla que acaba de dejar atrás (si va caminando), para dejar dar vuelta aunque se haya pasado tantito.
export function centerBehind(actor) {
  const { x: dx, y: dy } = actor.dir;
  if (dx) return { x: dx > 0 ? Math.floor(actor.x + EPS) : Math.ceil(actor.x - EPS), y: Math.round(actor.y) };
  if (dy) return { x: Math.round(actor.x), y: dy > 0 ? Math.floor(actor.y + EPS) : Math.ceil(actor.y - EPS) };
  return { x: Math.round(actor.x), y: Math.round(actor.y) };
}
