// El especial (B) de cada personaje en Pelea en equipo: el mismo de Bolitas Bros, hecho para pelear contra monstruos.
//   punch     un puñetazo enorme enfrente.
//   dash      se lanza hacia adelante pegándole a todos los que encuentre.
//   slam      salta y cae aplastando alrededor.
//   shot      lanza algo por su carril (`look`: cómo se ve).
//   beam      un rayo larguísimo por su carril (pega al instante).
//   breath    sopla enfrente un ratito (fuego o agua); `push` empuja lejos.
//   spin      pega alrededor (a los dos lados).
//   flurry    varios golpes rápidos.
//   teleport  aparece detrás del monstruo más cercano y le pega.
//   ghost     se vuelve invisible: no le pegan y los monstruos lo pierden.
//   heal      cura un corazón a él y a los compañeros que estén cerca.
// `damage`: cuántos golpes normales vale cada vez que pega. `cooldownMs`: cada cuánto se puede usar.
export const SPECIALS = {
  tanque: { kind: 'punch', name: 'Puñetazo cargado', damage: 4, reach: 90, power: 2.2 },
  rayo: { kind: 'dash', name: 'Embestida', damage: 2, speed: 950, ms: 300 },
  resorte: { kind: 'slam', name: 'Súper salto', damage: 3, radius: 140 },
  estrella: { kind: 'shot', name: 'Estrella', damage: 2, speed: 760, look: 'star' },
  ninja: { kind: 'teleport', name: 'Aparece por detrás', damage: 3 },
  robot: { kind: 'beam', name: 'Rayo láser', damage: 2, length: 560 },
  dragon: { kind: 'breath', name: 'Echa fuego', damage: 1, ms: 700, reach: 150, tickMs: 140, look: 'fire' },
  fantasma: { kind: 'ghost', name: 'Invisible', ms: 2200, cooldownMs: 5000 },
  dino: { kind: 'spin', name: 'Coletazo', damage: 3, radius: 125 },
  gatito: { kind: 'flurry', name: 'Arañazos', damage: 1, hits: 4, gapMs: 90, reach: 70 },
  pinguino: { kind: 'dash', name: 'Deslizón', damage: 2, speed: 780, ms: 450 },
  pirata: { kind: 'shot', name: 'Bala de cañón', damage: 3, speed: 620, look: 'cannon' },
  hada: { kind: 'heal', name: 'Polvo mágico: cura', radius: 220, hearts: 1, cooldownMs: 7000 },
  astronauta: { kind: 'slam', name: 'Mochila cohete', damage: 3, radius: 150 },
  abeja: { kind: 'dash', name: 'Aguijonazo', damage: 2, speed: 880, ms: 260 },
  bombero: { kind: 'breath', name: 'Chorro de agua', damage: 1, ms: 700, reach: 170, tickMs: 140, look: 'water', push: true },
};
export const SPECIAL_COOLDOWN_MS = 2600;

// Bloquecito: su especial cambia con el número (chiquito = embestida, mediano = coletazo, grandote = aplastón).
export function blockSpecial(form) {
  if (form === 'octo') return { kind: 'flurry', name: 'Ocho brazos', damage: 1, hits: 8, gapMs: 70, reach: 90 };
  if (form <= 3) return { kind: 'dash', name: 'Embestida', damage: 2, speed: 900, ms: 280 };
  if (form <= 7) return { kind: 'spin', name: '¡Cuadrado!', damage: 3, radius: 120 };
  return { kind: 'slam', name: '¡Despegue!', damage: 4, radius: 160 };
}
