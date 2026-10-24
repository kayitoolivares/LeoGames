import { rewards } from '../../shared/rewards.js';
import { settings } from '../../shared/settings.js';

// La Aventura de Karts locos: 3 mundos de 4 retos cada uno; el último de cada mundo es una carrera contra un jefe
// (en su kart). Cada reto se abre al pasar el anterior. Qué hay que hacer (`kind`):
//   race:        llegar entre los primeros `place`.
//   coins:       terminar la carrera con `coins` monedas (10 = las máximas).
//   nohit:       llegar entre los primeros `place` sin que te peguen ni una vez.
//   rival:       ganarle a `rival` uno contra uno.
//   elimination: llegar a los últimos `survive` de una eliminación.
//   boss:        ganarle al jefe.
// `weather`: el clima del reto (si no, el de la pista).
export const WORLDS = [
  {
    key: 'pradera',
    name: 'Mundo Pradera',
    emoji: '🌳',
    stages: [
      { kind: 'race', track: 'pradera', place: 3, emoji: '🏁', name: 'Primera carrera', info: 'Llega entre los 3 primeros' },
      { kind: 'coins', track: 'playa', coins: 10, emoji: '🪙', name: 'Caza monedas', info: 'Llega a la meta con 10 monedas' },
      { kind: 'rival', track: 'dulces', rival: 'rayo', emoji: '⚡', name: 'El reto de Rayo', info: 'Gánale a Rayo, uno contra uno' },
      { kind: 'boss', track: 'pradera', boss: 'rey', emoji: '👑', name: 'El Rey Bolón', info: '¡Gánale al Rey Bolón en su kart!' },
    ],
  },
  {
    key: 'aventura',
    name: 'Mundo Aventura',
    emoji: '🧭',
    stages: [
      { kind: 'race', track: 'selva', place: 2, emoji: '🌴', name: 'Carrera en la selva', info: 'Llega entre los 2 primeros' },
      { kind: 'nohit', track: 'mar', place: 3, emoji: '🛡️', name: 'Sin un rasguño', info: 'Llega entre los 3 primeros sin que te peguen' },
      { kind: 'elimination', track: 'juguetes', survive: 3, emoji: '💥', name: 'Eliminación', info: 'Aguanta hasta que solo queden 3' },
      { kind: 'boss', track: 'volcan', boss: 'dragonzote', emoji: '🐲', name: 'Dragonzote', info: '¡Gánale a Dragonzote en el volcán!' },
    ],
  },
  {
    key: 'estrella',
    name: 'Mundo Estrella',
    emoji: '⭐',
    stages: [
      { kind: 'race', track: 'nieve', place: 1, weather: 'nieve', emoji: '❄️', name: 'Tormenta de nieve', info: 'Gana la carrera en la tormenta' },
      { kind: 'rival', track: 'castillo', rival: 'ninja', emoji: '🥷', name: 'El reto de Ninja', info: 'Gánale a Ninja, uno contra uno' },
      { kind: 'coins', track: 'nubes', coins: 10, emoji: '☁️', name: 'Monedas en las nubes', info: 'Llega a la meta con 10 monedas' },
      { kind: 'boss', track: 'espacio', boss: 'robotote', emoji: '🤖', name: 'Robotote', info: '¡Gánale a Robotote en el espacio!' },
    ],
  },
];

// Los jefes en su kart: nombre, kart y lo que avientan.
export const BOSSES = {
  rey: {
    name: 'Rey Bolón',
    setup: { character: 'rey', type: 'monstruo', color: 0x8158d8, wheels: 'doradas', extra: 'corona', decal: 'estrellas' },
    throws: ['banana', 'rocket'],
  },
  dragonzote: {
    name: 'Dragonzote',
    setup: { character: 'dragonzote', type: 'bolido', color: 0xe53935, wheels: 'fuego', extra: 'cuernos', decal: 'llamas' },
    throws: ['rocket', 'banana', 'rocket'],
  },
  robotote: {
    name: 'Robotote',
    setup: { character: 'robotote', type: 'cohete', color: 0x8a8aa0, wheels: 'neon', extra: 'antena', decal: 'rayos' },
    throws: ['rocket', 'lightning', 'banana'],
  },
};

const SAVE_KEY = 'kartAventura';

export const adventure = {
  // { done: ['pradera-0', ...] }
  get() {
    return { done: [], ...settings.get(SAVE_KEY, {}) };
  },
  done(world, stage) {
    return this.get().done.includes(`${WORLDS[world].key}-${stage}`);
  },
  // Abierto: el primero de todo, o si ya pasaste el anterior (el anterior de un mundo es el jefe del mundo de antes).
  open(world, stage) {
    if (world === 0 && stage === 0) return true;
    if (stage > 0) return this.done(world, stage - 1);
    return this.done(world - 1, WORLDS[world - 1].stages.length - 1);
  },
  // Lo pasó. Devuelve true si es la primera vez.
  complete(world, stage) {
    const data = this.get();
    const id = `${WORLDS[world].key}-${stage}`;
    if (data.done.includes(id)) return false;
    data.done.push(id);
    settings.set(SAVE_KEY, data);
    if (WORLDS[world].stages[stage].kind === 'boss') rewards.earn('kart-jefe');
    if (WORLDS.every((w, i) => w.stages.every((_, j) => data.done.includes(`${WORLDS[i].key}-${j}`)))) rewards.earn('kart-aventura');
    return true;
  },
  count(world) {
    return WORLDS[world].stages.filter((_, j) => this.done(world, j)).length;
  },
};

// El reto que sigue (o null si era el último).
export function nextStage({ world, stage }) {
  if (stage + 1 < WORLDS[world].stages.length) return { world, stage: stage + 1 };
  if (world + 1 < WORLDS.length) return { world: world + 1, stage: 0 };
  return null;
}

// ¿Lo pasó algún jugador? `ranking`: el orden de llegada; `humans`: los jugadores.
export function stagePassed(stage, ranking, humans, rival = null) {
  const place = (racer) => ranking.indexOf(racer);
  return humans.some((racer) => {
    if (!racer.finished && stage.kind !== 'elimination') return false;
    if (stage.kind === 'race') return place(racer) < stage.place;
    if (stage.kind === 'coins') return racer.coins >= stage.coins;
    if (stage.kind === 'nohit') return place(racer) < stage.place && racer.hitsTaken === 0;
    if (stage.kind === 'rival' || stage.kind === 'boss') return rival !== null && place(racer) < place(rival);
    if (stage.kind === 'elimination') return !racer.out;
    return false;
  });
}
