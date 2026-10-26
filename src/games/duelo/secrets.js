// Movimientos secretos del Duelo: cada personaje tiene dos más, además de su especial (X):
//   low  agachado (↓ + X)
//   air  en el aire (X saltando)
// Usan las mismas clases de especial que moves.js y estas nuevas:
//   quake  pisotón que hace temblar el piso: pega a los dos lados, bajito (saltando se esquiva).
//   dive   en el aire, se lanza en picada hacia adelante y abajo; termina al caer.
//   heal   se cura un poquito (la curita del hada).
// Y para lo que se lanza (`shot`): `count` + `spread` (varios a la vez, cada uno con su velocidad hacia arriba o
// abajo), `vy` (cae en diagonal), `bounce` (va botando por el piso), `big` (más grande), `float` (levanta al que
// le pega), `freeze` (lo deja congelado un ratito) y `scare` (asusta: se queda paralizado).
export const SECRETS = {
  tanque: {
    low: { kind: 'quake', name: 'Terremoto', startup: 220, ms: 220, reach: 2.6, damage: 12, push: 420, launch: true },
    air: { kind: 'dive', name: 'Bala de cañón', startup: 80, speed: 380, fall: 1300, damage: 13, push: 420, launch: true },
  },
  rayo: {
    low: { kind: 'rush', name: 'Rayo rasante', startup: 60, ms: 340, speed: 1000, damage: 9, push: 380, launch: true, low: true },
    air: { kind: 'dive', name: 'Relámpago', startup: 40, speed: 760, fall: 1500, damage: 10, push: 360, launch: true },
  },
  resorte: {
    low: { kind: 'spin', name: 'Remolino', startup: 90, ms: 380, damage: 10, push: 420, launch: true },
    air: { kind: 'dive', name: 'Pisotón de resorte', startup: 60, speed: 120, fall: 1700, damage: 12, push: 460, launch: true },
  },
  estrella: {
    low: { kind: 'shot', name: 'Lluvia de estrellas', shape: 'star', startup: 140, speed: 520, damage: 6, push: 220, count: 3, spread: [-220, 0, 220] },
    air: { kind: 'shot', name: 'Estrella fugaz', shape: 'star', startup: 80, speed: 620, vy: 520, damage: 9, push: 300 },
  },
  ninja: {
    low: { kind: 'shot', name: 'Shurikens', shape: 'shuriken', startup: 90, speed: 820, damage: 5, push: 160, count: 2, spread: [-70, 70] },
    air: { kind: 'dive', name: 'Patada ninja', startup: 50, speed: 820, fall: 1100, damage: 10, push: 380, launch: true },
  },
  robot: {
    low: { kind: 'shot', name: 'Puño cohete', shape: 'fist', startup: 160, speed: 760, damage: 11, push: 460 },
    air: { kind: 'shot', name: 'Láser hacia abajo', shape: 'laser', startup: 100, speed: 800, vy: 600, damage: 8, push: 260 },
  },
  dragon: {
    low: { kind: 'shot', name: 'Bola de fuego gigante', shape: 'fire', startup: 260, speed: 300, damage: 14, push: 420, big: 1.7 },
    air: { kind: 'shot', name: 'Fuego desde el cielo', shape: 'fire', startup: 100, speed: 420, vy: 520, damage: 10, push: 320 },
  },
  fantasma: {
    low: { kind: 'spin', name: '¡Buuu!', startup: 120, ms: 300, damage: 7, push: 300, scare: true },
    air: { kind: 'dive', name: 'Caída fantasma', startup: 60, ms: 600, speed: 600, fall: 1200, damage: 10, push: 360, launch: true, through: true },
  },
  dino: {
    low: { kind: 'quake', name: 'Pisotón jurásico', startup: 200, ms: 220, reach: 2.4, damage: 12, push: 420, launch: true },
    air: { kind: 'dive', name: 'Cabezazo', startup: 60, speed: 640, fall: 1300, damage: 12, push: 420, launch: true },
  },
  gatito: {
    low: { kind: 'shot', name: 'Bola de estambre', shape: 'yarn', startup: 110, speed: 520, damage: 8, push: 280, bounce: true },
    air: { kind: 'flurry', name: 'Zarpazos voladores', startup: 30, hits: 4, gapMs: 90, damage: 3, push: 120 },
  },
  pinguino: {
    low: { kind: 'shot', name: 'Bola de nieve', shape: 'snowball', startup: 120, speed: 560, damage: 7, push: 220, freeze: true },
    air: { kind: 'dive', name: 'Panzazo', startup: 60, speed: 520, fall: 1300, damage: 11, push: 400, launch: true },
  },
  pirata: {
    low: { kind: 'rush', name: 'Ancla', startup: 240, ms: 260, speed: 480, damage: 14, push: 540, launch: true },
    air: { kind: 'shot', name: 'Cañonazo de arriba', shape: 'ball', startup: 120, speed: 520, vy: 560, damage: 11, push: 380 },
  },
  hada: {
    low: { kind: 'heal', name: 'Curita mágica', startup: 200, amount: 12 },
    air: { kind: 'shot', name: 'Polvo de estrellas', shape: 'sparkle', startup: 80, speed: 480, vy: 360, damage: 7, push: 240, count: 2, spread: [-120, 120] },
  },
  astronauta: {
    low: { kind: 'shot', name: 'Burbuja sin gravedad', shape: 'bubble', startup: 140, speed: 380, damage: 7, push: 120, float: true },
    air: { kind: 'dive', name: 'Meteorito', startup: 80, speed: 600, fall: 1500, damage: 13, push: 420, launch: true },
  },
  abeja: {
    low: { kind: 'flurry', name: 'Enjambre', startup: 40, hits: 5, gapMs: 80, damage: 3, push: 120 },
    air: { kind: 'dive', name: 'Picada', startup: 40, speed: 900, fall: 1300, damage: 10, push: 360 },
  },
  bombero: {
    low: { kind: 'shot', name: 'Manguerazo', shape: 'water', startup: 160, speed: 820, damage: 9, push: 760, big: 1.5 },
    air: { kind: 'shot', name: 'Regadera', shape: 'water', startup: 80, speed: 640, vy: 520, damage: 7, push: 400 },
  },
  luchador: {
    low: { kind: 'quake', name: 'Azotón', startup: 180, ms: 220, reach: 2.1, damage: 10, push: 400, launch: true },
    air: { kind: 'dive', name: 'Plancha voladora', startup: 60, speed: 700, fall: 1500, damage: 13, push: 440, launch: true },
  },
  unicornio: {
    low: { kind: 'shot', name: 'Lluvia de estrellitas', shape: 'star', startup: 120, speed: 460, damage: 6, push: 200, count: 3, spread: [-260, 0, 260] },
    air: { kind: 'dive', name: 'Cuernazo', startup: 50, speed: 850, fall: 1200, damage: 10, push: 380 },
  },
  bloquecito: {
    low: { kind: 'quake', name: '¡Bloque gigante!', startup: 200, ms: 220, reach: 2.3, damage: 11, push: 420, launch: true },
    air: { kind: 'dive', name: 'Bloque que cae', startup: 60, speed: 300, fall: 1600, damage: 12, push: 420, launch: true },
  },
  // Los jefes también.
  rey: {
    low: { kind: 'quake', name: 'Pisotón real', startup: 260, ms: 240, reach: 2.8, damage: 13, push: 460, launch: true },
    air: { kind: 'dive', name: 'Caída real', startup: 100, speed: 300, fall: 1500, damage: 14, push: 480, launch: true },
  },
  dragonzote: {
    low: { kind: 'shot', name: 'Tres bolas de fuego', shape: 'fire', startup: 220, speed: 420, damage: 8, push: 300, count: 3, spread: [-200, 0, 200] },
    air: { kind: 'shot', name: 'Lluvia de fuego', shape: 'fire', startup: 100, speed: 380, vy: 520, damage: 11, push: 340, big: 1.3 },
  },
  robotote: {
    low: { kind: 'rush', name: 'Embestida de acero', startup: 200, ms: 360, speed: 760, damage: 13, push: 520, launch: true },
    air: { kind: 'dive', name: 'Aterrizaje cohete', startup: 80, speed: 420, fall: 1500, damage: 14, push: 480, launch: true },
  },
};
