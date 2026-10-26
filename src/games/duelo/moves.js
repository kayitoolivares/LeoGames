// Golpes del Duelo de bolitas. Los tiempos van en milisegundos: `startup` (antes de que pegue),
// `active` (mientras puede pegar) y `recovery` (lo que tarda en poder hacer otra cosa).
// La caja del golpe va enfrente: `reach` es qué tanto sale (en radios del personaje) y `hi`/`lo`
// a qué altura (fracción de su estatura, 0 = pies, 1 = cabeza).
// `launch`: lo avienta hacia arriba y lo tumba (en vez de solo empujarlo); `lift`: qué tan alto (1 = normal).
// `grab`: agarre (no se puede cubrir, pero solo agarra a los que están en el piso).
export const ATTACKS = {
  punch: { startup: 60, active: 100, recovery: 120, damage: 5, reach: 1, hi: 0.85, lo: 0.45, push: 170, stunMs: 280 },
  // El tercer golpe seguido es el "remate": más fuerte y tumba.
  finisher: { startup: 80, active: 120, recovery: 260, damage: 9, reach: 1.15, hi: 0.95, lo: 0.35, push: 420, stunMs: 400, launch: true },
  kick: { startup: 110, active: 120, recovery: 200, damage: 7, reach: 1.35, hi: 0.55, lo: 0.05, push: 260, stunMs: 340 },
  airPunch: { startup: 50, active: 160, recovery: 80, damage: 6, reach: 1, hi: 0.8, lo: 0.3, push: 200, stunMs: 300 },
  airKick: { startup: 70, active: 200, recovery: 100, damage: 8, reach: 1.25, hi: 0.5, lo: -0.1, push: 280, stunMs: 340 },
  // Agachado: ↓ + A gancho hacia arriba (le pega al que viene saltando) y ↓ + B barrida (tumba).
  uppercut: { startup: 90, active: 130, recovery: 280, damage: 9, reach: 0.9, hi: 1.35, lo: 0.4, push: 180, stunMs: 400, launch: true, lift: 1.2 },
  sweep: { startup: 110, active: 150, recovery: 300, damage: 7, reach: 1.6, hi: 0.28, lo: -0.05, push: 240, stunMs: 400, launch: true, lift: 0.55 },
  // Adelante + B pegadito: agarra y avienta lejos.
  grab: { startup: 70, active: 100, recovery: 380, damage: 11, reach: 0.8, hi: 0.9, lo: 0.2, push: 620, stunMs: 0, launch: true, lift: 1.25, grab: true },
};

// Cada cuánto se puede usar el especial (X).
export const SPECIAL_COOLDOWN_MS = 2600;

// El especial de cada personaje (el mismo de Bolitas Bros, hecho para pelear 1 contra 1):
//   shot      lanza algo que vuela derecho (`shape` dice cómo se ve).
//   rush      se lanza hacia adelante pegando (`low`: barrida; `through`: se vuelve invisible y atraviesa).
//   rise      sale volando hacia arriba y adelante pegando (como un gancho).
//   spin      golpe alrededor (pega de los dos lados).
//   flurry    varios golpes rápidos seguidos.
//   teleport  desaparece y aparece detrás del rival, y le pega.
export const SPECIALS = {
  tanque: { kind: 'rush', name: 'Puñetazo cargado', startup: 260, ms: 220, speed: 520, damage: 14, push: 520, launch: true },
  rayo: { kind: 'rush', name: 'Embestida', startup: 80, ms: 300, speed: 900, damage: 10, push: 420, launch: true },
  resorte: { kind: 'rise', name: 'Súper salto', startup: 60, speed: 300, lift: 1050, damage: 11, push: 300, launch: true },
  estrella: { kind: 'shot', name: 'Estrella', shape: 'star', startup: 140, speed: 560, damage: 9, push: 300 },
  ninja: { kind: 'teleport', name: 'Aparece por detrás', startup: 160, damage: 9, push: 380, launch: true },
  robot: { kind: 'shot', name: 'Rayo láser', shape: 'laser', startup: 180, speed: 950, damage: 8, push: 260 },
  dragon: { kind: 'shot', name: 'Echa fuego', shape: 'fire', startup: 160, speed: 400, damage: 11, push: 320 },
  fantasma: { kind: 'rush', name: 'Invisible', startup: 100, ms: 420, speed: 650, damage: 9, push: 360, through: true },
  dino: { kind: 'spin', name: 'Coletazo', startup: 120, ms: 260, damage: 12, push: 460, launch: true },
  gatito: { kind: 'flurry', name: 'Arañazos rápidos', startup: 40, hits: 3, gapMs: 110, damage: 4, push: 140 },
  pinguino: { kind: 'rush', name: 'Deslizón', startup: 90, ms: 480, speed: 620, damage: 9, push: 340, launch: true, low: true },
  pirata: { kind: 'shot', name: 'Bala de cañón', shape: 'ball', startup: 200, speed: 620, damage: 11, push: 380 },
  hada: { kind: 'shot', name: 'Polvo mágico', shape: 'sparkle', startup: 120, speed: 430, damage: 8, push: 240, wave: true },
  astronauta: { kind: 'rise', name: 'Mochila cohete', startup: 100, speed: 620, lift: 760, damage: 10, push: 380, launch: true },
  abeja: { kind: 'rush', name: 'Aguijonazo', startup: 70, ms: 260, speed: 820, damage: 9, push: 360 },
  bombero: { kind: 'shot', name: 'Chorro de agua', shape: 'water', startup: 120, speed: 760, damage: 7, push: 560 },
  luchador: { kind: 'rise', name: 'Plancha', startup: 120, speed: 680, lift: 720, damage: 12, push: 460, launch: true },
  unicornio: { kind: 'shot', name: 'Rayo arcoíris', shape: 'rainbow', startup: 150, speed: 820, damage: 10, push: 300 },
};

// Bloquecito: su especial depende del número que traiga (y Octobloque tiene el suyo).
// `action` es cómo se dibuja (ver BlockBody): se vuelve cuadrado, rueda, mueve los ocho brazos...
export const BLOCK_SPECIALS = {
  1: { kind: 'rush', name: 'Embestida', startup: 70, ms: 260, speed: 950, damage: 8, push: 380, launch: true },
  2: { kind: 'flurry', name: 'Doble golpe', startup: 40, hits: 2, gapMs: 130, damage: 6, push: 180 },
  3: { kind: 'shot', name: 'Malabares', shape: 'juggle', startup: 120, speed: 470, damage: 9, push: 280, wave: true },
  4: { kind: 'spin', name: '¡Cuadrado!', action: 'square', startup: 160, ms: 260, damage: 12, push: 460, launch: true },
  5: { kind: 'shot', name: 'Estrella', shape: 'star', startup: 140, speed: 580, damage: 9, push: 300 },
  6: { kind: 'rush', name: 'Dado rodante', action: 'roll', startup: 80, ms: 460, speed: 640, damage: 9, push: 340, launch: true, low: true },
  7: { kind: 'shot', name: 'Arcoíris', shape: 'rainbow', startup: 150, speed: 820, damage: 10, push: 300 },
  8: { kind: 'flurry', name: 'Ocho brazos', action: 'octo', startup: 40, hits: 4, gapMs: 100, damage: 4, push: 150 },
  9: { kind: 'rush', name: 'Golpazo', action: 'charge', startup: 240, ms: 220, speed: 520, damage: 14, push: 520, launch: true },
  10: { kind: 'rise', name: '¡Despegue!', action: 'rocket', startup: 90, speed: 520, lift: 1000, damage: 11, push: 380, launch: true },
  octo: { kind: 'flurry', name: 'Ocho brazos', action: 'octo', startup: 40, hits: 8, gapMs: 75, damage: 3, push: 140 },
};
SPECIALS.bloquecito = BLOCK_SPECIALS[1];
