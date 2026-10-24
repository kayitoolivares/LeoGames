// Tiempo real entre cuadros, para mover los juegos.
// El `delta` de Phaser se suaviza y se limita a 60 fps al arrancar o cuando la página no tiene foco:
// en un equipo que va a 30-45 fps (como puede pasar en el Xbox One S) todo iría en cámara lenta.
// Aquí se usa el tiempo real, con un tope para que un tirón no haga saltar a todos.
const MAX_STEP_MS = 50;
let delta = 1000 / 60;
// Cámara lenta o congelado (el "golpe que se siente"): por un rato el juego avanza a `scale` de su velocidad.
let scale = 1;
let scaleUntil = 0;

export function tickClock(rawDeltaMs) {
  delta = Math.min(Math.max(rawDeltaMs, 0), MAX_STEP_MS);
}

// Lo que avanza el juego en este cuadro (ya con la cámara lenta, si hay).
export function frameDelta() {
  return delta * timeScale();
}

// El tiempo real del cuadro, sin cámara lenta (para lo que no debe frenarse, como salir manteniendo botones).
export function realDelta() {
  return delta;
}

export function timeScale() {
  return performance.now() < scaleUntil ? scale : 1;
}

// Durante `ms` (de tiempo real) el juego va a `k` de su velocidad: 0 = congelado, 0.3 = cámara lenta.
// Si ya había uno más lento que dura más, se queda ése.
export function setTimeScale(k, ms) {
  const until = performance.now() + ms;
  if (timeScale() < k && scaleUntil > until) return;
  scale = k;
  scaleUntil = until;
}
