// Combos de dúo (Bolitas Bros en equipos y el 2 contra 2 del Duelo): si dos compañeros del mismo equipo usan su
// especial casi al mismo tiempo y estando cerquita, sale un "¡Combo de dúo!" que les pega a los rivales de alrededor.
// Cuál sale depende de qué tipo es cada uno (fuego + hielo = vapor que marea, rayo + agua = descarga, dos pesados =
// terremoto...); cualquier otra pareja hace el Choque de amigos. Cada juego pone el efecto a su manera (ver
// SmashScene.duoCombo y DueloScene.duoCombo); aquí solo está la tabla y quién hace combo con quién.
export const DUO_WINDOW_MS = 1000;
export const DUO_COOLDOWN_MS = 6000;
// La compu, cuando su compañero usa el especial cerquita, a veces lo acompaña con el suyo (según su nivel).
export const DUO_CPU_CHANCE = { facil: 0.35, normal: 0.6, dificil: 0.85 };

// De qué tipo es cada personaje (los que no están aquí no tienen tipo y siempre hacen el Choque de amigos).
const ELEMENTS = {
  dragon: 'fuego',
  dragonzote: 'fuego',
  pinguino: 'hielo',
  bombero: 'agua',
  pirata: 'agua',
  robot: 'rayo',
  robotote: 'rayo',
  rayo: 'rayo',
  tanque: 'pesado',
  luchador: 'pesado',
  dino: 'pesado',
  rey: 'pesado',
  hada: 'magia',
  unicornio: 'magia',
  estrella: 'magia',
  fantasma: 'magia',
  bloquecito: 'magia',
  abeja: 'aire',
  astronauta: 'aire',
  resorte: 'aire',
  ninja: 'rapido',
  gatito: 'rapido',
};

// Los combos: `pair` son los dos tipos (en cualquier orden); `kind` es el efecto (cada juego lo dibuja):
//   dizzy   los marea un buen rato          shock   descarga eléctrica que avienta
//   quake   el piso brinca y los avienta     stars   les caen estrellas encima
//   whirl   remolino que los sube            freeze  los deja congelados
//   flurry  torbellino que los avienta       wave    onda de choque (el de cualquier pareja)
// `hit`: el daño (damage), qué tan fuerte avienta (push, de 0 a 1) y cuánto los deja quietos (stunMs).
export const DUOS = [
  { key: 'vapor', name: 'Vapor mareador', pair: ['fuego', 'hielo'], kind: 'dizzy', color: 0xdff4ff, hit: { damage: 6, push: 0.3, stunMs: 1500 } },
  { key: 'vapor', name: 'Vapor mareador', pair: ['fuego', 'agua'], kind: 'dizzy', color: 0xdff4ff, hit: { damage: 6, push: 0.3, stunMs: 1500 } },
  { key: 'descarga', name: 'Descarga eléctrica', pair: ['rayo', 'agua'], kind: 'shock', color: 0xfff36a, hit: { damage: 12, push: 0.8, stunMs: 500 } },
  { key: 'terremoto', name: 'Terremoto', pair: ['pesado', 'pesado'], kind: 'quake', color: 0xc9935a, hit: { damage: 14, push: 1, stunMs: 0 } },
  { key: 'estrellas', name: 'Lluvia de estrellas', pair: ['magia', 'magia'], kind: 'stars', color: 0xffd84d, hit: { damage: 10, push: 0.8, stunMs: 0 } },
  { key: 'remolino', name: 'Remolino de fuego', pair: ['fuego', 'aire'], kind: 'whirl', color: 0xff9a3c, hit: { damage: 12, push: 0.9, stunMs: 0 } },
  { key: 'congelados', name: '¡Congelados!', pair: ['hielo', 'agua'], kind: 'freeze', color: 0x9fdcff, hit: { damage: 5, push: 0.15, stunMs: 1900 } },
  { key: 'torbellino', name: 'Torbellino veloz', pair: ['rapido', 'rapido'], kind: 'flurry', color: 0xb0b8d8, hit: { damage: 12, push: 0.85, stunMs: 0 } },
  { key: 'tormenta', name: 'Tormenta', pair: ['rayo', 'aire'], kind: 'shock', color: 0xfff36a, hit: { damage: 11, push: 0.8, stunMs: 400 } },
];
export const FRIENDS_DUO = { key: 'amigos', name: 'Choque de amigos', kind: 'wave', color: 0xffffff, hit: { damage: 10, push: 0.75, stunMs: 0 } };

export function elementOf(character) {
  return ELEMENTS[character] ?? null;
}

// El combo que hacen dos personajes juntos.
export function duoFor(a, b) {
  const pair = [elementOf(a), elementOf(b)];
  const found = DUOS.find((duo) => (duo.pair[0] === pair[0] && duo.pair[1] === pair[1]) || (duo.pair[0] === pair[1] && duo.pair[1] === pair[0]));
  return found ?? FRIENDS_DUO;
}

// Quién usó su especial y cuándo, para ver si un compañero lo acompañó a tiempo. Un combo por equipo a la vez (luego
// tienen que esperar DUO_COOLDOWN_MS).
export class DuoWatch {
  constructor() {
    this.last = new Map();
    this.teamReady = new Map();
  }

  // `fighter` acaba de usar su especial en `now` (ms). `mates`: sus compañeros que pueden hacer combo y
  // `near(a, b)`: si dos están lo bastante cerca. Devuelve el compañero con el que hizo combo (o null).
  special(fighter, team, now, mates, near) {
    this.last.set(fighter, now);
    if (now < (this.teamReady.get(team) ?? 0)) return null;
    const partner = mates.find((mate) => mate !== fighter && now - (this.last.get(mate) ?? -Infinity) <= DUO_WINDOW_MS && near(fighter, mate));
    if (!partner) return null;
    this.teamReady.set(team, now + DUO_COOLDOWN_MS);
    this.last.delete(fighter);
    this.last.delete(partner);
    return partner;
  }

  // Si el equipo ya puede hacer otro combo (para que la compu no gaste su especial de balde).
  ready(team, now) {
    return now >= (this.teamReady.get(team) ?? 0);
  }
}
