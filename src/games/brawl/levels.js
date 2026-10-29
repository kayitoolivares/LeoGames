import { settings } from '../../shared/settings.js';

// Niveles de los personajes en Pelea en equipo: cada personaje junta experiencia peleando (se guarda por personaje,
// no por jugador) y al subir de nivel gana una mejorita. Son mejoras chiquitas para que el de 6 años no se quede
// atrás aunque los demás tengan personajes de nivel alto. Los amigos de la compu no suben de nivel.
const XP_KEY = 'brawlXp';
export const MAX_LEVEL = 10;

// Cuánta experiencia da cada cosa.
export const XP = { hit: 1, monster: 4, big: 10, boss: 40, bossTeam: 20, wave: 10, world: 50 };

// Lo que cuesta pasar del nivel `level` al siguiente (cada vez un poquito más).
function stepFor(level) {
  return 60 + 40 * (level - 1);
}

// El nivel con esa experiencia: { level, into (lo que lleva del nivel), need (lo que pide el nivel; 0 en el tope) }.
export function levelFor(xp) {
  let level = 1;
  let left = Math.max(0, xp);
  while (level < MAX_LEVEL && left >= stepFor(level)) {
    left -= stepFor(level);
    level += 1;
  }
  return { level, into: level >= MAX_LEVEL ? 0 : left, need: level >= MAX_LEVEL ? 0 : stepFor(level) };
}

// La experiencia total para llegar a `level` (para las pruebas y para los premios).
export function xpForLevel(level) {
  let total = 0;
  for (let l = 1; l < Math.min(level, MAX_LEVEL); l += 1) total += stepFor(l);
  return total;
}

export const brawlLevels = {
  xp(character) {
    return settings.get(XP_KEY, {})[character] ?? 0;
  },
  save(character, xp) {
    const all = settings.get(XP_KEY, {});
    if (all[character] === xp) return;
    settings.set(XP_KEY, { ...all, [character]: xp });
  },
};

// Las mejoras de cada nivel (se van sumando):
//   2: levanta más rápido a los compañeros   3 y 7: un corazón más   4: el especial se recarga más rápido
//   5: golpes más fuertes y estrellita en el nombre   6: la barra se llena más rápido   8: la súper dura más
//   9: golpes todavía más fuertes   10: corona y brillo dorado
export function levelPerks(level) {
  return {
    revive: level >= 2 ? 1.3 : 1,
    hearts: (level >= 3 ? 1 : 0) + (level >= 7 ? 1 : 0),
    special: level >= 4 ? 0.8 : 1,
    power: level >= 9 ? 1.5 : level >= 5 ? 1.25 : 1,
    star: level >= 5,
    meter: level >= 6 ? 1.3 : 1,
    superMs: level >= 8 ? 3000 : 0,
    crown: level >= MAX_LEVEL,
  };
}

// Lo que se dice (y se lee) al subir a cada nivel.
export const LEVEL_PRIZES = {
  2: 'Levantas más rápido a tus amigos',
  3: '¡Un corazón más!',
  4: 'Tu especial se recarga más rápido',
  5: '¡Golpes más fuertes y estrellita!',
  6: 'Tu barra se llena más rápido',
  7: '¡Otro corazón más!',
  8: 'Tu súper dura más',
  9: '¡Golpes todavía más fuertes!',
  10: '¡Corona y brillo dorado!',
};
