// Mundos de Pelea en equipo: 4 rondas cada uno, la última con su jefe.
// `count` es para 1 jugador: los monstruos chicos aumentan uno por cada jugador extra.
// `unlock`: qué hay que ganar antes (ver UNLOCKS en rewards.js). `sticker`: la calcomanía al ganarlo.
// `colors`: el fondo dibujado cuando no hay imagen.
export const WORLDS = [
  {
    name: 'Pradera',
    emoji: '🌿',
    background: 'pradera',
    unlock: null,
    sticker: 'pelea-gana',
    colors: { sky: 0x2a2357, hill: 0x3a2f6e, floor: 0x4b3d86, stripe: 0x5a4b9a },
    waves: [
      { title: 'Ronda 1', spawns: [{ type: 'slime', count: 3 }] },
      { title: 'Ronda 2', spawns: [{ type: 'slime', count: 5 }] },
      { title: 'Ronda 3', spawns: [{ type: 'slime', count: 4 }, { type: 'slimeGrande', count: 2 }] },
      { title: '¡El Rey Slime!', spawns: [{ type: 'slime', count: 3 }, { type: 'reySlime', count: 1 }] },
    ],
  },
  {
    name: 'Bosque de hongos',
    emoji: '🍄',
    background: 'bosque',
    unlock: 'pelea-mundo-2',
    sticker: 'pelea-hongos',
    colors: { sky: 0x123a2e, hill: 0x1f5a40, floor: 0x2f6e44, stripe: 0x3d8352 },
    waves: [
      { title: 'Ronda 1', spawns: [{ type: 'hongo', count: 4 }] },
      { title: 'Ronda 2', spawns: [{ type: 'hongo', count: 4 }, { type: 'slimeGrande', count: 1 }] },
      { title: 'Ronda 3', spawns: [{ type: 'hongo', count: 6 }, { type: 'slimeGrande', count: 2 }] },
      { title: '¡El Gran Hongo!', spawns: [{ type: 'hongo', count: 2 }, { type: 'granHongo', count: 1 }] },
    ],
  },
  {
    name: 'Volcán',
    emoji: '🌋',
    background: 'volcan',
    unlock: 'pelea-mundo-3',
    sticker: 'pelea-volcan',
    colors: { sky: 0x3a1420, hill: 0x5a1f22, floor: 0x6e3326, stripe: 0x8a4430 },
    waves: [
      { title: 'Ronda 1', spawns: [{ type: 'slimeLava', count: 4 }] },
      { title: 'Ronda 2', spawns: [{ type: 'slimeLava', count: 5 }, { type: 'hongo', count: 2 }] },
      { title: 'Ronda 3', spawns: [{ type: 'slimeLava', count: 6 }, { type: 'slimeGrande', count: 2 }] },
      { title: '¡El Dragón de lava!', spawns: [{ type: 'slimeLava', count: 3 }, { type: 'dragonLava', count: 1 }] },
    ],
  },
];

export function buildSpawnQueue(wave, playerCount, types) {
  const queue = [];
  for (const { type, count } of wave.spawns) {
    const total = types[type].small ? count + (playerCount - 1) : count;
    for (let i = 0; i < total; i += 1) queue.push(type);
  }
  return queue;
}
