import { settings } from '../../shared/settings.js';
import { textStyle } from '../../ui/style.js';

// Retos del Duelo: misiones contra la compu (una pelea de un round). Las de `goal` se cumplen en cuanto se hace
// (aunque la pelea siga); las de `win`, al ganar con esa condición. Se guarda cuáles ya se cumplieron.
export const CHALLENGES = [
  { key: 'sin-cubrirse', name: 'Sin cubrirse', info: 'Gánale a la compu sin usar LB ni RB', level: 'normal', win: (s) => s.blocks === 0 },
  { key: 'combo', name: 'Combo de 6', info: 'Haz un combo de 6 golpes seguidos', level: 'facil', goal: (s) => s.bestCombo >= 6 },
  { key: 'final', name: 'Golpe final', info: 'Gana dando el golpe final (súper + X)', level: 'facil', win: (s) => s.finalKo },
  { key: 'perfecto', name: 'Perfecto', info: 'Gana sin que te peguen ni una vez', level: 'facil', win: (s) => s.hurt === 0 },
  { key: 'patadas', name: 'Solo patadas', info: 'Gana usando solo patadas (B)', level: 'facil', win: (s) => s.punches === 0 && s.specials === 0 },
  { key: 'paradas', name: '3 paradas', info: 'Haz 3 paradas perfectas', level: 'normal', goal: (s) => s.parries >= 3 },
  { key: 'rapido', name: 'Rapidísimo', info: 'Gana en menos de 30 segundos', level: 'facil', win: (s) => s.fightMs < 30000 },
  { key: 'secretos', name: 'Secretos', info: 'Usa tus dos movimientos secretos', level: 'facil', goal: (s) => s.secretLow && s.secretAir },
  { key: 'ayudante', name: 'Ayudante', info: 'Pégale al rival con tu ayudante (Y)', level: 'facil', goal: (s) => s.assistHits > 0 },
  { key: 'dragon', name: 'Contra Dragonzote', info: 'Gánale al jefe Dragonzote', level: 'normal', boss: 'dragonzote', win: () => true },
];
const KEY = 'dueloRetos';

export function doneChallenges() {
  return settings.get(KEY, []);
}

// Lo marca como cumplido. Devuelve cuántos van.
export function completeChallenge(key) {
  const done = doneChallenges();
  if (!done.includes(key)) settings.set(KEY, [...done, key]);
  return doneChallenges().length;
}

// Lo que pasa en la pelea de un reto (lo va llenando la escena).
export function newChallengeStats() {
  return { blocks: 0, bestCombo: 0, finalKo: false, hurt: 0, punches: 0, specials: 0, parries: 0, fightMs: 0, secretLow: false, secretAir: false, assistHits: 0 };
}

// La lista de retos para escoger (dos columnas), con palomita en los cumplidos. Devuelve { root, select(i) }.
export function showChallenges(scene, selected, depth) {
  const { width, height } = scene.scale;
  const done = doneChallenges();
  const root = scene.add.container(0, 0).setDepth(depth);
  root.add(scene.add.rectangle(width / 2, height / 2, width, height, 0x14112b, 0.94));
  root.add(scene.add.text(width / 2, 60, `Retos 🎖️  ${done.length} de ${CHALLENGES.length}`, textStyle(48, '#ffd84d', { fontStyle: 'bold', stroke: '#1b1530', strokeThickness: 9 })).setOrigin(0.5));
  const cards = CHALLENGES.map((challenge, i) => {
    const x = width / 2 + (i % 2 === 0 ? -310 : 310);
    const y = 150 + Math.floor(i / 2) * 104;
    const bg = scene.add.rectangle(x, y, 590, 90, 0x231d45).setStrokeStyle(3, 0x3a3170);
    const mark = done.includes(challenge.key) ? '✅' : '⬜';
    root.add([
      bg,
      scene.add.text(x - 275, y - 18, `${mark} ${challenge.name}`, textStyle(26, '#ffffff', { fontStyle: 'bold' })).setOrigin(0, 0.5),
      scene.add.text(x - 275, y + 20, challenge.info, textStyle(19, '#d9d4ff')).setOrigin(0, 0.5),
    ]);
    return bg;
  });
  root.add(scene.add.text(width / 2, height - 40, '↑ ↓ ◀ ▶ escoger  ·  A = ¡a pelear!  ·  B = regresar', textStyle(24, '#ffd84d')).setOrigin(0.5));
  const select = (index) => {
    cards.forEach((bg, i) => bg.setStrokeStyle(i === index ? 6 : 3, i === index ? 0xffd84d : 0x3a3170));
  };
  select(selected);
  return { root, select };
}
