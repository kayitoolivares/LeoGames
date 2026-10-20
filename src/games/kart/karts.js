import { CHARACTER_KEYS } from '../smash/characters.js';

// Lo que se escoge en el taller de Karts locos: el tipo de kart (cada uno maneja distinto), su color,
// las llantas y un adorno. El piloto es uno de los personajes de Bolitas Bros.

// stats: 1 a 3 (para mostrarlas). El juego los convierte en velocidad, arranque, giro y peso (ver kartStats).
// offroad: qué tanto lo frena el pasto (1 = nada).
export const KART_TYPES = {
  clasico: { name: 'Clásico', stats: { Velocidad: 2, Arranque: 2, Giro: 2, Peso: 2 } },
  bolido: { name: 'Bólido', stats: { Velocidad: 3, Arranque: 1, Giro: 2, Peso: 2 } },
  mini: { name: 'Mini', stats: { Velocidad: 1, Arranque: 3, Giro: 3, Peso: 1 } },
  monstruo: { name: 'Monstruo', stats: { Velocidad: 2, Arranque: 1, Giro: 1, Peso: 3 }, offroad: 0.85 },
};
export const KART_TYPE_KEYS = Object.keys(KART_TYPES);

export const PAINTS = [0xe53935, 0xff8a1e, 0xffd02a, 0x3cc44f, 0x3db8f5, 0x3a5bd6, 0x8158d8, 0xff3d9e, 0xf2f2f2, 0x2b2b3a];

export const WHEELS = {
  normales: { name: 'Normales' },
  doradas: { name: 'Doradas' },
  colores: { name: 'De colores' },
  blancas: { name: 'Blancas' },
};
export const WHEEL_KEYS = Object.keys(WHEELS);

export const EXTRAS = {
  aleron: { name: 'Alerón' },
  bandera: { name: 'Bandera' },
  cuernos: { name: 'Cuernos' },
  antena: { name: 'Antena' },
  nada: { name: 'Nada' },
};
export const EXTRA_KEYS = Object.keys(EXTRAS);

// Cómo maneja cada tipo de kart. Las diferencias son chicas a propósito: con cualquiera se puede ganar.
export function kartStats(type) {
  const { stats, offroad = 0.6 } = KART_TYPES[type] ?? KART_TYPES.clasico;
  return {
    maxSpeed: 38.5 + (stats.Velocidad - 1) * 1.5,
    accel: [21, 24, 28][stats.Arranque - 1],
    turn: [2.2, 2.4, 2.65][stats.Giro - 1],
    weight: [0.8, 1, 1.3][stats.Peso - 1],
    offroad,
  };
}

// Lo que escogió cada control en el taller (dura mientras la página esté abierta, como los personajes).
const picks = new Map();

export const kartPicks = {
  get(deviceId) {
    return picks.get(deviceId) ?? null;
  },

  set(deviceId, setup) {
    picks.set(deviceId, { ...setup });
  },
};

// Un kart al azar para la compu, con un personaje que no traiga nadie más (si se puede).
export function randomSetup(taken) {
  const free = CHARACTER_KEYS.filter((key) => !taken.has(key));
  const pick = (list) => list[Math.floor(Math.random() * list.length)];
  return {
    character: pick(free.length ? free : CHARACTER_KEYS),
    type: pick(KART_TYPE_KEYS),
    color: pick(PAINTS),
    wheels: pick(WHEEL_KEYS),
    extra: pick(EXTRA_KEYS),
  };
}
