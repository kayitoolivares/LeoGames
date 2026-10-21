// Mundos de Pelea en equipo: 4 rondas cada uno, la última con su jefe. Cada ronda es un tramo del nivel: al
// terminarla se camina hacia la derecha al siguiente (la pantalla avanza).
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
  {
    name: 'Playa',
    emoji: '🏖️',
    background: 'playa',
    unlock: 'pelea-mundo-4',
    sticker: 'pelea-playa',
    colors: { sky: 0x7fd6ff, hill: 0x2fa8e0, floor: 0xf2d48a, stripe: 0xe0bd6a },
    waves: [
      { title: 'Ronda 1', spawns: [{ type: 'cangrejo', count: 4 }] },
      { title: 'Ronda 2', spawns: [{ type: 'cangrejo', count: 4 }, { type: 'almeja', count: 1 }] },
      { title: 'Ronda 3', spawns: [{ type: 'cangrejo', count: 5 }, { type: 'almeja', count: 2 }] },
      { title: '¡El Capitán Pulpo!', spawns: [{ type: 'cangrejo', count: 3 }, { type: 'capitanPulpo', count: 1 }] },
    ],
  },
  {
    name: 'Montaña nevada',
    emoji: '❄️',
    background: 'nieve',
    unlock: 'pelea-mundo-5',
    sticker: 'pelea-nieve',
    colors: { sky: 0x9fd8ff, hill: 0xe6ecf8, floor: 0xf4f8ff, stripe: 0xd6e2f2 },
    waves: [
      { title: 'Ronda 1', spawns: [{ type: 'munecoNieve', count: 4 }] },
      { title: 'Ronda 2', spawns: [{ type: 'munecoNieve', count: 4 }, { type: 'yetiBebe', count: 1 }] },
      { title: 'Ronda 3', spawns: [{ type: 'munecoNieve', count: 5 }, { type: 'yetiBebe', count: 2 }] },
      { title: '¡El Gran Yeti!', spawns: [{ type: 'munecoNieve', count: 3 }, { type: 'granYeti', count: 1 }] },
    ],
  },
  {
    name: 'Castillo embrujado',
    emoji: '🎃',
    background: 'castillo',
    unlock: 'pelea-mundo-6',
    sticker: 'pelea-castillo',
    colors: { sky: 0x1b1840, hill: 0x2a2450, floor: 0x5e5a6e, stripe: 0x6e6a80 },
    waves: [
      { title: 'Ronda 1', spawns: [{ type: 'murcielago', count: 4 }] },
      { title: 'Ronda 2', spawns: [{ type: 'murcielago', count: 3 }, { type: 'calabaza', count: 2 }] },
      { title: 'Ronda 3', spawns: [{ type: 'murcielago', count: 4 }, { type: 'calabaza', count: 3 }] },
      { title: '¡El Rey Calabaza!', spawns: [{ type: 'murcielago', count: 2 }, { type: 'reyCalabaza', count: 1 }] },
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

// Modo sin fin: rondas que no se acaban, con los monstruos de los mundos que ya se abrieron; cada vez más y más
// grandes, y cada 5 rondas un jefe.
export const ENDLESS_BOSS_EVERY = 5;

export function endlessWave(number, worlds, types) {
  const pool = worlds.flatMap((world) => world.waves.flatMap((wave) => wave.spawns.map((s) => s.type)));
  const minions = [...new Set(pool)].filter((type) => !types[type].boss);
  const bosses = [...new Set(pool)].filter((type) => types[type].boss);
  const pick = (list) => list[Math.floor(Math.random() * list.length)];
  const spawns = [];
  const small = minions.filter((type) => types[type].small);
  const big = minions.filter((type) => !types[type].small);
  spawns.push({ type: pick(small.length ? small : minions), count: 2 + Math.min(6, Math.floor(number / 2)) });
  if (number >= 3 && big.length) spawns.push({ type: pick(big), count: Math.min(3, Math.floor(number / 3)) });
  const boss = number % ENDLESS_BOSS_EVERY === 0 && bosses.length;
  if (boss) spawns.push({ type: pick(bosses), count: 1 });
  return { title: boss ? `Ronda ${number}: ¡jefe!` : `Ronda ${number}`, spawns };
}
