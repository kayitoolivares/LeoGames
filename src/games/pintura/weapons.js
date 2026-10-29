// Los lanzadores de pintura (LB / RB cambian de uno a otro) y el globo de pintura (X).
//   every: cada cuántos ms sale un disparo (manteniendo RT).  speed / gravity: cómo vuela la gota.
//   damage: cuánto pinta a quien le pega.  splat: tamaño de la mancha.  ink: cuánta tinta gasta cada disparo.
//   spread: qué tanto se abren las gotas.  range: hasta dónde llega más o menos (la compu y la ayuda para apuntar).
export const WEAPONS = [
  { key: 'chorrito', name: 'Chorrito', emoji: '💦', every: 110, speed: 30, gravity: 16, damage: 14, splat: 1.1, ink: 1.3, spread: 0.045, range: 17, drops: 1 },
  {
    key: 'largo',
    name: 'Lanzador largo',
    emoji: '🎯',
    every: 620,
    speed: 62,
    gravity: 5,
    damage: 55,
    splat: 1.6,
    ink: 9,
    spread: 0.004,
    range: 36,
    drops: 1,
    size: 1.6,
  },
  // El rodillo: con RT apretado y caminando pinta el piso y a quien atropella; quieto, avienta pintura cerquita.
  {
    key: 'rodillo',
    name: 'Rodillo',
    emoji: '🖌️',
    every: 450,
    speed: 19,
    gravity: 22,
    damage: 28,
    splat: 1.3,
    ink: 7,
    spread: 0.32,
    range: 9,
    drops: 3,
    roller: true,
  },
];

export const BALLOON = { speed: 17, gravity: 22, radius: 3.4, damage: 75, ink: 40, every: 900 };

// El rodillo rodando: cada cuánto deja pintura, qué tan ancha, cuánta tinta gasta y cuánto pinta a quien atropella.
export const ROLLER = { everyMs: 90, radius: 1.5, ink: 0.7, damage: 45, hitEveryMs: 300, reach: 1.7 };

// Velocidad y ángulo para que una gota que sale con `speed` caiga en un punto a `distance` de distancia y `rise`
// más arriba (tiro bajito). null si no alcanza.
export function ballisticPitch(distance, rise, speed, gravity) {
  if (gravity <= 0.01) return Math.atan2(rise, distance);
  const s2 = speed * speed;
  const root = s2 * s2 - gravity * (gravity * distance * distance + 2 * rise * s2);
  if (root < 0) return null;
  return Math.atan2(s2 - Math.sqrt(root), gravity * distance);
}
