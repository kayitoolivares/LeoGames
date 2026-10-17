// Tiempo real entre cuadros, para mover los juegos.
// El `delta` de Phaser se suaviza y se limita a 60 fps al arrancar o cuando la página no tiene foco:
// en un equipo que va a 30-45 fps (como puede pasar en el Xbox One S) todo iría en cámara lenta.
// Aquí se usa el tiempo real, con un tope para que un tirón no haga saltar a todos.
const MAX_STEP_MS = 50;
let delta = 1000 / 60;

export function tickClock(rawDeltaMs) {
  delta = Math.min(Math.max(rawDeltaMs, 0), MAX_STEP_MS);
}

export function frameDelta() {
  return delta;
}
