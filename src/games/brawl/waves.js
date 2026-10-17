// Rondas de la pelea. `count` es para 1 jugador: los monstruos chicos aumentan uno por cada jugador extra.
export const WAVES = [
  { title: 'Ronda 1', spawns: [{ type: 'small', count: 3 }] },
  { title: 'Ronda 2', spawns: [{ type: 'small', count: 5 }] },
  { title: 'Ronda 3', spawns: [{ type: 'small', count: 4 }, { type: 'big', count: 2 }] },
  { title: '¡El Rey Slime!', spawns: [{ type: 'small', count: 3 }, { type: 'boss', count: 1 }] },
];

export function buildSpawnQueue(wave, playerCount) {
  const queue = [];
  for (const { type, count } of wave.spawns) {
    const total = type === 'small' ? count + (playerCount - 1) : count;
    for (let i = 0; i < total; i += 1) queue.push(type);
  }
  return queue;
}
