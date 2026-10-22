import { settings } from '../../shared/settings.js';

// Récords de Pelea en equipo (se guardan): el combo más largo, más monedas en un mundo, jefes vencidos, amigos
// rescatados, el mejor tiempo de cada mundo y el de los jefes en serie. Y las medallas del final de cada mundo.
const RECORDS_KEY = 'brawlRecords';
const RESCUES_KEY = 'brawlRescues';

export const brawlRecords = {
  get() {
    return { combo: 0, coins: 0, bosses: 0, rescues: 0, times: {}, bossRush: null, ...settings.get(RECORDS_KEY, {}) };
  },
  // Junta lo de un mundo terminado. Devuelve la lista de récords nuevos (para decirlos).
  addWorld({ combo = 0, coins = 0, bosses = 0, worldIndex = null, ms = null }) {
    const r = this.get();
    const news = [];
    if (combo > r.combo) {
      r.combo = combo;
      news.push(`combo de ${combo}`);
    }
    if (coins > r.coins) {
      r.coins = coins;
      news.push(`${coins} monedas`);
    }
    r.bosses += bosses;
    if (worldIndex !== null && ms !== null && (!r.times[worldIndex] || ms < r.times[worldIndex])) {
      r.times[worldIndex] = ms;
      news.push('mejor tiempo');
    }
    settings.set(RECORDS_KEY, r);
    return news;
  },
  // Jefes en serie: devuelve true si fue récord.
  saveBossRush(ms) {
    const r = this.get();
    if (r.bossRush && r.bossRush <= ms) return false;
    settings.set(RECORDS_KEY, { ...r, bossRush: ms });
    return true;
  },
  addRescue() {
    const r = this.get();
    settings.set(RECORDS_KEY, { ...r, rescues: r.rescues + 1 });
  },
};

// En qué mundos ya se rescató al amigo enjaulado (se ve en el mapa).
export const rescues = {
  has(worldIndex) {
    return Boolean(settings.get(RESCUES_KEY, {})[worldIndex]);
  },
  save(worldIndex) {
    settings.set(RESCUES_KEY, { ...settings.get(RESCUES_KEY, {}), [worldIndex]: true });
  },
};

// Las medallas de cada peleador: quién pegó más, sacó más monstruos, levantó a más, tumbó al jefe, juntó más
// monedas, rescató al amigo y montó un animal. Devuelve un Map peleador -> lista de medallas ("👊 Más golpes").
export function medals(fighters) {
  const list = [
    ['👊', 'Más golpes', (f) => f.stats.hits],
    ['💥', 'Más monstruos', (f) => f.stats.kills],
    ['🤝', 'Mejor compañero', (f) => f.stats.revives],
    ['👑', 'Tumbó al jefe', (f) => f.stats.boss],
    ['💰', 'Más monedas', (f) => f.stats.coins ?? 0],
    ['🔓', 'Rescató a un amigo', (f) => f.stats.rescues ?? 0],
    ['🦖', 'Jinete', (f) => f.stats.rides ?? 0],
  ];
  const winners = new Map(fighters.map((f) => [f, []]));
  for (const [emoji, name, value] of list) {
    const best = Math.max(...fighters.map(value));
    if (best <= 0) continue;
    for (const f of fighters) if (value(f) === best) winners.get(f).push(`${emoji} ${name}`);
  }
  return winners;
}

// 83500 ms -> "1:23"
export function formatTime(ms) {
  const seconds = Math.round(ms / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}
