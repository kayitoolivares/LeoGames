import { settings } from '../../shared/settings.js';
import { textStyle } from '../../ui/style.js';
import { characterTexture } from '../smash/art.js';
import { CHARACTERS } from '../smash/characters.js';
import { BOSSES, isBoss } from './boss.js';
import { survivalRecord } from './modes.js';

// Salón de la fama del Duelo: lo que se guarda de todas las peleas (en este aparato): victorias de cada personaje,
// el combo más largo, rounds perfectos, paradas perfectas y golpes finales.
const KEY = 'dueloFama';
const TOP = 6;

function empty() {
  return { fights: 0, wins: {}, bestCombo: 0, bestComboBy: null, perfects: 0, parries: 0, finals: 0 };
}

export function loadFame() {
  return { ...empty(), ...settings.get(KEY, {}) };
}

function save(change) {
  const fame = loadFame();
  change(fame);
  settings.set(KEY, fame);
  return fame;
}

const nameOf = (character) => (isBoss(character) ? BOSSES[character].name : (CHARACTERS[character]?.name ?? character));

export const fame = {
  // Terminó una pelea: suma la victoria al personaje que ganó.
  win(character) {
    save((f) => {
      f.fights += 1;
      f.wins[character] = (f.wins[character] ?? 0) + 1;
    });
  },
  // Un combo: si es el más largo, se guarda con quién lo hizo. Devuelve true si es récord nuevo.
  combo(count, character) {
    if (count <= loadFame().bestCombo) return false;
    save((f) => {
      f.bestCombo = count;
      f.bestComboBy = character;
    });
    return true;
  },
  perfect() {
    save((f) => (f.perfects += 1));
  },
  parry() {
    save((f) => (f.parries += 1));
  },
  final() {
    save((f) => (f.finals += 1));
  },
};

// La pantalla del salón de la fama: los personajes con más victorias (con su dibujo) y los récords.
export function showFame(scene, depth) {
  const { width, height } = scene.scale;
  const f = loadFame();
  const root = scene.add.container(0, 0).setDepth(depth);
  root.add(scene.add.rectangle(width / 2, height / 2, width, height, 0x14112b, 0.94));
  root.add(scene.add.text(width / 2, 70, 'Salón de la fama 🏅', textStyle(54, '#ffd84d', { fontStyle: 'bold', stroke: '#1b1530', strokeThickness: 10 })).setOrigin(0.5));
  const best = Object.entries(f.wins)
    .sort((a, b) => b[1] - a[1])
    .slice(0, TOP);
  root.add(scene.add.text(330, 140, 'Los que más han ganado', textStyle(28, '#ffffff', { fontStyle: 'bold' })).setOrigin(0.5));
  if (!best.length) root.add(scene.add.text(330, 300, 'Todavía nadie…\n¡a pelear!', textStyle(30, '#a9a3d6', { align: 'center' })).setOrigin(0.5));
  best.forEach(([character, wins], i) => {
    const x = 120 + (i % 3) * 210;
    const y = 330 + Math.floor(i / 3) * 230;
    root.add(scene.add.rectangle(x, y - 60, 190, 210, i === 0 ? 0x3a3170 : 0x231d45).setStrokeStyle(i === 0 ? 6 : 3, i === 0 ? 0xffd84d : 0x3a3170));
    const key = characterTexture(scene, character, i === 0 ? 'gana' : 'normal');
    if (key) {
      const image = scene.add.image(x, y + 10, key).setOrigin(0.5, 1);
      image.setScale(150 / image.height);
      root.add(image);
    }
    root.add(scene.add.text(x, y + 30, `${i === 0 ? '👑 ' : ''}${nameOf(character)}`, textStyle(21, '#ffffff', { fontStyle: 'bold', stroke: '#1b1530', strokeThickness: 5 })).setOrigin(0.5));
    root.add(scene.add.text(x, y - 150, `${wins} ${wins === 1 ? 'victoria' : 'victorias'}`, textStyle(20, '#ffd84d', { fontStyle: 'bold', stroke: '#1b1530', strokeThickness: 5 })).setOrigin(0.5));
  });
  const lines = [
    `🥊 Peleas: ${f.fights}`,
    `🔥 Combo más largo: ${f.bestCombo ? `${f.bestCombo} golpes (${nameOf(f.bestComboBy)})` : '—'}`,
    `💯 Rounds perfectos: ${f.perfects}`,
    `🛡️ Paradas perfectas: ${f.parries}`,
    `💥 Golpes finales: ${f.finals}`,
    `🏃 Supervivencia: ${survivalRecord()} peleas seguidas`,
  ];
  root.add(scene.add.text(930, 140, 'Récords', textStyle(28, '#ffffff', { fontStyle: 'bold' })).setOrigin(0.5));
  root.add(scene.add.text(720, 190, lines.join('\n\n'), textStyle(26, '#ffffff', { fontStyle: 'bold', stroke: '#1b1530', strokeThickness: 5, lineSpacing: 4 })));
  root.add(scene.add.text(width / 2, height - 50, 'B = regresar', textStyle(26, '#ffd84d', { fontStyle: 'bold' })).setOrigin(0.5));
  return root;
}
