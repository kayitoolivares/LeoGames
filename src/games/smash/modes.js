import { settings } from '../../shared/settings.js';

// Los modos de Bolitas Bros (el Jugador 1 escoge en la pantalla de selección).
//   vidas:   el de siempre, 3 vidas y gana el último que quede.
//   tiempo:  2 minutos, vidas sin fin; cada vez que sacas a alguien +1 y cada vez que te caes -1.
//   equipos: Rojos (J1 y J3) contra Azules (J2 y J4); la compu completa los equipos y no le pegas a tu compañero.
//   jefe:    todos juntos (la compu de su lado) contra el Rey Bolón gigante, con su barra de vida.
//   blancos: romper las 10 dianas del escenario lo más rápido posible (sin compu), con récord.
//   jonron:  concurso de jonrón: 10 segundos para pegarle al saco y luego un batazo para mandarlo lejísimos (por turnos).
//   monedas: 2 minutos; los golpes sacan monedas y gana el que junte más (si te caes pierdes la mitad).
//   colina:  rey de la colina: quédate solo en la zona de la corona; gana el primero en juntar 30 segundos.
//   aventura: 6 niveles seguidos (ver adventure.js).
//   bomba:   bomba caliente: la bomba con reloj se pasa pegándole a otro; al que le explota sale volando (ver hotbomb.js).
export const MODES = {
  vidas: { name: 'Vidas', info: '3 vidas y gana el último que quede' },
  tiempo: { name: 'Tiempo', info: '2 minutos: +1 por cada rival que saques y -1 si te caes' },
  equipos: { name: 'Equipos', info: 'Rojos (J1 y J3) contra Azules (J2 y J4); la compu completa los equipos' },
  jefe: { name: 'Jefe 👑', info: 'Todos juntos contra el Rey Bolón gigante' },
  blancos: { name: 'Blancos 🎯', info: 'Rompe las 10 dianas lo más rápido que puedas' },
  jonron: { name: 'Jonrón ⚾', info: '10 segundos para pegarle al saco y luego ¡batazo! (por turnos)' },
  monedas: { name: 'Monedas 💰', info: 'Los golpes sacan monedas: gana el que junte más (si te caes pierdes la mitad)' },
  colina: { name: 'Colina ⛰️', info: 'Quédate solo en la zona de la corona: gana el primero en juntar 30 segundos' },
  aventura: { name: 'Aventura 🗺️', info: '6 niveles seguidos: peleas, dianas, una torre y el jefe final' },
  bomba: { name: 'Bomba caliente 💣', info: 'Pégale a otro para pasarle la bomba: ¡al que le explota sale volando!' },
};
export const MODE_KEYS = Object.keys(MODES);

export const TIME_MS = 120000;
export const TEAMS = [
  { name: 'Rojos', color: 0xff5a5f },
  { name: 'Azules', color: 0x3fa7ff },
];

// Los jefes gigantes (los mismos dibujos que en el Duelo), enormes y con barra de vida en vez de %:
// el Rey Bolón del modo Jefe y Dragonzote, el jefe final de la Aventura.
export const GIANTS = {
  rey: {
    character: 'rey',
    stats: {
      name: 'Rey Bolón',
      superName: 'Rey Bolón',
      radius: 78,
      weight: 3,
      power: 1.4,
      run: 250,
      air: 240,
      jump: 760,
      airJumps: 1,
    },
    health: 300,
    color: 0x8158d8,
    // Su especial: salta y cae aplastando (pega a los dos lados). Cada cuánto lo puede hacer.
    slamCooldownMs: 3200,
    // Si lo sacan de la pantalla regresa, pero pierde vida.
    fallDamage: 40,
  },
  dragonzote: {
    character: 'dragonzote',
    stats: {
      name: 'Dragonzote',
      superName: 'Dragonzote',
      radius: 80,
      weight: 3,
      power: 1.35,
      run: 240,
      air: 260,
      jump: 760,
      airJumps: 2,
      gravity: 0.9,
    },
    health: 340,
    color: 0xe53935,
    // Su especial: una llamarada grandota.
    slamCooldownMs: 2600,
    fallDamage: 40,
  },
};
export const BOSS = GIANTS.rey;

// Rompe los blancos: dónde van las dianas (arriba de cada plataforma y en el aire entre ellas) y el récord.
export const TARGETS = 10;
const RECORD_KEY = 'smashTargetsRecord';

export function targetSpots(stage) {
  const spots = [];
  const platforms = [...stage.platforms].sort((a, b) => a.top - b.top);
  for (const p of platforms) {
    const width = p.right - p.left;
    spots.push({ x: p.left + width * 0.2, y: p.top - 70 }, { x: p.right - width * 0.2, y: p.top - 70 });
  }
  const main = stage.platforms.find((p) => p.main);
  // Más en el aire: arriba de todo, a los lados del escenario (afuera de la orilla) y en medio.
  const top = Math.min(...stage.platforms.map((p) => p.top));
  const extra = [
    { x: (main.left + main.right) / 2, y: top - 170 },
    { x: main.left - 90, y: main.top - 160 },
    { x: main.right + 90, y: main.top - 160 },
    { x: main.left + 120, y: top - 60 },
    { x: main.right - 120, y: top - 60 },
    { x: (main.left + main.right) / 2, y: main.top - 260 },
  ];
  for (const spot of extra) if (spots.length < TARGETS) spots.push(spot);
  return spots.slice(0, TARGETS);
}

// Concurso de jonrón: el saco (con su imagen; si no hay, una bolita café), cuánto dura cada parte, cuántos pixeles son
// un metro y los metros para la calcomanía.
export const SANDBAG = { name: 'Saco', superName: 'Saco', radius: 40, weight: 1, power: 0, run: 0, air: 0, jump: 0, airJumps: 0 };
export const JONRON = { hitMs: 10000, swingMs: 6000, pxPerMeter: 6, sticker: 100 };
const JONRON_KEY = 'smashJonron';

// El récord del concurso de jonrón (en metros).
export const jonronRecord = {
  get() {
    return settings.get(JONRON_KEY, 0);
  },
  // Guarda la distancia si es mejor. Devuelve true si fue récord.
  save(meters) {
    if (meters <= this.get()) return false;
    settings.set(JONRON_KEY, meters);
    return true;
  },
};

export const targetRecords = {
  get(stage) {
    return settings.get(RECORD_KEY, {})[stage] ?? null;
  },
  // Guarda el tiempo si es mejor. Devuelve true si fue récord.
  save(stage, ms) {
    const all = settings.get(RECORD_KEY, {});
    if (all[stage] && all[stage] <= ms) return false;
    settings.set(RECORD_KEY, { ...all, [stage]: ms });
    return true;
  },
};
