import Phaser from 'phaser';
import { textStyle } from '../../ui/style.js';
import { CHARACTERS, CHARACTER_KEYS } from '../smash/characters.js';

// Torneo familiar: llaves de 4 u 8 peleadores (los jugadores y la compu completa), como un torneo de verdad: el que
// gana avanza. Las peleas de compu contra compu se deciden solas (no hay que verlas).
const ROUND_NAMES = { 4: ['Semifinal', 'Final'], 8: ['Cuartos de final', 'Semifinal', 'Final'] };

export class FamilyCup {
  // `entries`: los jugadores ({ player, character }). `size`: 4 u 8.
  constructor(entries, size) {
    this.size = size;
    const taken = new Set(entries.map((e) => e.character));
    const people = entries.slice(0, size).map((e) => ({ ...e }));
    const cpus = [];
    while (people.length + cpus.length < size) {
      const free = CHARACTER_KEYS.filter((key) => !taken.has(key));
      const character = Phaser.Utils.Array.GetRandom(free.length ? free : CHARACTER_KEYS);
      taken.add(character);
      cpus.push({ player: null, character });
    }
    // Los jugadores quedan en llaves distintas (así no se enfrentan luego luego, si se puede).
    const slots = Array(size).fill(null);
    const order = size === 8 ? [0, 4, 2, 6, 1, 5, 3, 7] : [0, 2, 1, 3];
    people.forEach((entry, i) => (slots[order[i]] = entry));
    for (let i = 0; i < size; i += 1) slots[i] ??= cpus.shift();
    this.rounds = [slots];
    for (let n = size / 2; n >= 1; n /= 2) this.rounds.push(Array(n).fill(null));
    this.round = 0;
    this.match = 0;
  }

  get names() {
    return ROUND_NAMES[this.size];
  }

  get roundName() {
    return this.names[this.round] ?? '';
  }

  // La pelea que sigue: [a, b].
  get current() {
    const list = this.rounds[this.round];
    return [list[this.match * 2], list[this.match * 2 + 1]];
  }

  get done() {
    return this.round >= this.names.length;
  }

  get champion() {
    return this.rounds[this.names.length][0];
  }

  // Ganó `winner` la pelea actual: avanza a la siguiente ronda.
  resolve(winner) {
    this.rounds[this.round + 1][this.match] = winner;
    this.match += 1;
    if (this.match * 2 >= this.rounds[this.round].length) {
      this.round += 1;
      this.match = 0;
    }
  }

  // Las peleas de compu contra compu se deciden solas, hasta que toque una con algún jugador (o se acabe).
  skipCpuFights() {
    const skipped = [];
    while (!this.done) {
      const [a, b] = this.current;
      if (a.player || b.player) break;
      const winner = Math.random() < 0.5 ? a : b;
      skipped.push(winner);
      this.resolve(winner);
    }
    return skipped;
  }
}

const label = (entry, labelOf) => `${entry.player ? labelOf(entry.player) : 'CPU'} · ${CHARACTERS[entry.character]?.name ?? entry.character}`;

// Las llaves: una columna por ronda, el campeón al final. La pelea que sigue va resaltada.
export function showBracket(scene, cup, labelOf, colorOf, hint, depth) {
  const { width, height } = scene.scale;
  const root = scene.add.container(0, 0).setDepth(depth);
  root.add(scene.add.rectangle(width / 2, height / 2, width, height, 0x14112b, 0.94));
  const title = cup.done ? '¡Tenemos campeón!' : `Torneo familiar · ${cup.roundName}`;
  root.add(scene.add.text(width / 2, 52, title, textStyle(44, '#ffd84d', { fontStyle: 'bold', stroke: '#1b1530', strokeThickness: 9 })).setOrigin(0.5));
  const columns = cup.rounds.length;
  const colW = Math.min(300, (width - 120) / columns);
  const top = 110;
  const span = height - 230;
  const lines = scene.add.graphics().lineStyle(4, 0x3a3170, 1);
  root.add(lines);
  const [curA, curB] = cup.done ? [] : cup.current;
  cup.rounds.forEach((list, r) => {
    const x = 60 + colW * (r + 0.5);
    list.forEach((entry, i) => {
      const y = top + ((i + 0.5) * span) / list.length;
      if (r < columns - 1) {
        const nextY = top + ((Math.floor(i / 2) + 0.5) * span) / (list.length / 2);
        lines.lineBetween(x + colW * 0.42, y, x + colW * 0.5, y).lineBetween(x + colW * 0.5, y, x + colW * 0.5, nextY).lineBetween(x + colW * 0.5, nextY, x + colW * 0.58, nextY);
      }
      const now = entry && (entry === curA || entry === curB) && r === cup.round;
      const lost = entry && r < cup.round && !cup.rounds[r + 1].includes(entry);
      const champion = r === columns - 1 && entry;
      root.add(scene.add.rectangle(x, y, colW * 0.84, 42, champion ? 0x3a3170 : 0x231d45).setStrokeStyle(now || champion ? 5 : 2, now || champion ? 0xffd84d : 0x3a3170));
      const text = entry ? `${champion ? '🏆 ' : ''}${label(entry, labelOf)}` : '…';
      root.add(scene.add.text(x, y, text, textStyle(17, entry ? colorOf(entry) : '#6a6490', { fontStyle: 'bold', stroke: '#1b1530', strokeThickness: 4 })).setOrigin(0.5).setAlpha(lost ? 0.4 : 1));
    });
  });
  root.add(scene.add.text(width / 2, height - 60, hint, textStyle(26, '#ffffff', { fontStyle: 'bold', align: 'center', stroke: '#1b1530', strokeThickness: 6 })).setOrigin(0.5));
  return root;
}
