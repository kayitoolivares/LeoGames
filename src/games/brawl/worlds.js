// Mundos de Pelea en equipo: 4 rondas cada uno, la última con su jefe. Cada ronda es un tramo del nivel: al
// terminarla se camina hacia la derecha al siguiente (la pantalla avanza).
// `count` es para 1 jugador: los monstruos chicos aumentan uno por cada jugador extra.
// `unlock`: qué hay que ganar antes (ver UNLOCKS en rewards.js). `sticker`: la calcomanía al ganarlo.
// `colors`: el fondo dibujado cuando no hay imagen.
// `trap`: las trampas del mundo (ver traps.js), `mount`: el animal que se puede montar en el segundo tramo, `mini`: el
// monstruo que sale de mini jefe en el segundo tramo y `cage`: en qué tramo hay un amigo enjaulado para rescatar.
export const WORLDS = [
  {
    name: 'Pradera',
    emoji: '🌿',
    background: 'pradera',
    unlock: null,
    sticker: 'pelea-gana',
    colors: { sky: 0x2a2357, hill: 0x3a2f6e, floor: 0x4b3d86, stripe: 0x5a4b9a },
    trap: 'spring',
    mount: 'dinosaurio',
    mini: 'slimeGrande',
    cage: 2,
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
    trap: 'boulder',
    mount: 'pollo-gigante',
    mini: 'slimeGrande',
    cage: 2,
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
    trap: 'lava',
    mount: 'dinosaurio',
    mini: 'slimeGrande',
    cage: 2,
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
    trap: 'cannon',
    mount: 'pollo-gigante',
    mini: 'almeja',
    cage: 2,
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
    trap: 'snowball',
    mount: 'dinosaurio',
    mini: 'yetiBebe',
    cage: 2,
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
    trap: 'ghostfire',
    mount: 'pollo-gigante',
    mini: 'calabaza',
    cage: 2,
    waves: [
      { title: 'Ronda 1', spawns: [{ type: 'murcielago', count: 4 }] },
      { title: 'Ronda 2', spawns: [{ type: 'murcielago', count: 3 }, { type: 'calabaza', count: 2 }] },
      { title: 'Ronda 3', spawns: [{ type: 'murcielago', count: 4 }, { type: 'calabaza', count: 3 }] },
      { title: '¡El Rey Calabaza!', spawns: [{ type: 'murcielago', count: 2 }, { type: 'reyCalabaza', count: 1 }] },
    ],
  },
  {
    name: 'Dulcelandia',
    emoji: '🍭',
    background: 'dulces',
    unlock: 'pelea-mundo-7',
    sticker: 'pelea-dulces',
    colors: { sky: 0xffc4e6, hill: 0xff9ec7, floor: 0xf2c79a, stripe: 0xe8a878 },
    trap: 'gum',
    mount: 'pollo-gigante',
    mini: 'cupcake',
    cage: 2,
    waves: [
      { title: 'Ronda 1', spawns: [{ type: 'gomita', count: 4 }] },
      { title: 'Ronda 2', spawns: [{ type: 'gomita', count: 3 }, { type: 'caramelo', count: 2 }] },
      { title: 'Ronda 3', spawns: [{ type: 'gomita', count: 4 }, { type: 'cupcake', count: 2 }] },
      { title: '¡El Rey Pastel!', spawns: [{ type: 'gomita', count: 2 }, { type: 'reyPastel', count: 1 }] },
    ],
  },
  {
    name: 'Espacio',
    emoji: '🚀',
    background: 'espacio',
    unlock: 'pelea-mundo-8',
    sticker: 'pelea-espacio',
    colors: { sky: 0x14112b, hill: 0x2a2450, floor: 0x5a3f7a, stripe: 0x6e5090 },
    trap: 'meteor',
    mount: 'dinosaurio',
    mini: 'robotito',
    cage: 2,
    waves: [
      { title: 'Ronda 1', spawns: [{ type: 'marcianito', count: 4 }] },
      { title: 'Ronda 2', spawns: [{ type: 'marcianito', count: 3 }, { type: 'ovni', count: 2 }] },
      { title: 'Ronda 3', spawns: [{ type: 'marcianito', count: 4 }, { type: 'robotito', count: 2 }] },
      { title: '¡El Mega Robot!', spawns: [{ type: 'marcianito', count: 2 }, { type: 'megaRobot', count: 1 }] },
    ],
  },
  {
    name: 'Valle de los dinos',
    emoji: '🦖',
    background: 'dinos',
    unlock: 'pelea-mundo-9',
    sticker: 'pelea-dinos',
    colors: { sky: 0x5a2a1a, hill: 0x7a3f22, floor: 0x6b5a2a, stripe: 0x8a7434 },
    trap: 'boulder',
    mount: 'dinosaurio',
    mini: 'trici',
    cage: 2,
    waves: [
      { title: 'Ronda 1', spawns: [{ type: 'raptor', count: 4 }] },
      { title: 'Ronda 2', spawns: [{ type: 'raptor', count: 3 }, { type: 'ptero', count: 2 }] },
      { title: 'Ronda 3', spawns: [{ type: 'raptor', count: 3 }, { type: 'trici', count: 2 }] },
      { title: '¡El Rey Rex!', spawns: [{ type: 'raptor', count: 2 }, { type: 'reyRex', count: 1 }] },
    ],
  },
];
// En el segundo tramo de cada mundo sale el mini jefe (al final de la ronda).
export const MINI_WAVE = 1;

// Jefes en serie: todos los jefes de los mundos ya abiertos, uno tras otro (cada uno con un par de ayudantes).
export function bossRushWaves(worlds, types) {
  return worlds.map((world, i) => {
    const boss = world.waves.at(-1).spawns.find((s) => types[s.type].boss);
    return { title: `Jefe ${i + 1} de ${worlds.length}: ${types[boss.type].name}`, world, spawns: [{ type: boss.type, count: 1 }] };
  });
}

// La fila de monstruos de una ronda (`mini`: el que sale al final de mini jefe, se marca "mini:<tipo>").
export function buildSpawnQueue(wave, playerCount, types, mini = null) {
  const queue = [];
  for (const { type, count } of wave.spawns) {
    const total = types[type].small ? count + (playerCount - 1) : count;
    for (let i = 0; i < total; i += 1) queue.push(type);
  }
  if (mini) queue.push(`mini:${mini}`);
  return queue;
}

// Modo sin fin: rondas que no se acaban, con los monstruos de los mundos que ya se abrieron; cada vez más y más
// grandes, y cada 5 rondas un jefe.
export const ENDLESS_BOSS_EVERY = 5;

// Defiende el nido: NEST_ROUNDS rondas como las del modo sin fin (la última, con jefe). El nido aguanta NEST_HP golpes.
export const NEST_ROUNDS = 5;
export const NEST_HP = 9;
export function nestWave(number, worlds, types) {
  const wave = endlessWave(number, worlds, types);
  const hasBoss = wave.spawns.some((s) => types[s.type].boss);
  if (number === NEST_ROUNDS && !hasBoss) {
    const bosses = [...new Set(worlds.flatMap((world) => world.waves.flatMap((w) => w.spawns.map((s) => s.type))))].filter((type) => types[type].boss);
    if (bosses.length) wave.spawns.push({ type: bosses[Math.floor(Math.random() * bosses.length)], count: 1 });
  }
  return { ...wave, title: number === NEST_ROUNDS ? `Ronda ${number}: ¡la última!` : `Ronda ${number} de ${NEST_ROUNDS}` };
}

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
