import Phaser from 'phaser';
import { settings } from '../../shared/settings.js';
import { textStyle } from '../../ui/style.js';
import { characterTexture } from '../smash/art.js';
import { CHARACTERS, CHARACTER_KEYS } from '../smash/characters.js';
import { BOSS, BOSS_STATS } from './boss.js';

// Los modos del Duelo de bolitas (el Jugador 1 escoge en la pantalla de antes de pelear).
export const MODES = {
  duelo: { name: 'Duelo', info: 'Uno contra uno; si son más, se turnan' },
  torneo: { name: 'Torneo 🏆', info: '4 rivales seguidos y al final el jefe: ¡el Rey Bolón!' },
  supervivencia: { name: 'Supervivencia 🛡️', info: 'Un rival tras otro con la misma vida. ¿Cuántos aguantas?' },
  entrenamiento: { name: 'Entrenamiento 🎯', info: 'Contra un muñeco que no pega: prueba todos los golpes' },
  equipos: { name: '2 contra 2 👥', info: 'Los cuatro al mismo tiempo, por equipos' },
};
export const MODE_KEYS = Object.keys(MODES);

// ---------- Torneo ----------
// 4 rivales al azar (cada vez un poco más difíciles) y el jefe.
const TOUR_LEVELS = ['facil', 'facil', 'normal', 'normal'];
const BOSS_LEVEL = 'normal';
export const BOSS_ARENA = 'trono';

export class Tournament {
  constructor(player) {
    const free = Phaser.Utils.Array.Shuffle(CHARACTER_KEYS.filter((key) => key !== player.character));
    this.fights = TOUR_LEVELS.map((level, i) => ({ character: free[i], level }));
    this.fights.push({ character: BOSS, level: BOSS_LEVEL, boss: true });
    this.index = 0;
  }

  get current() {
    return this.fights[this.index];
  }

  get done() {
    return this.index >= this.fights.length;
  }
}

// La escalera del torneo: los 5 rivales en fila, los que ya ganaste con palomita y el que sigue resaltado.
export function showLadder(scene, tournament, title, hint) {
  const { width, height } = scene.scale;
  const root = scene.add.container(0, 0).setDepth(10003);
  root.add(scene.add.rectangle(width / 2, height / 2, width, height, 0x14112b, 0.9));
  root.add(scene.add.text(width / 2, 110, title, textStyle(52, '#ffd84d', { fontStyle: 'bold', stroke: '#1b1530', strokeThickness: 10 })).setOrigin(0.5));
  const gap = 230;
  tournament.fights.forEach((fight, i) => {
    const x = width / 2 + (i - (tournament.fights.length - 1) / 2) * gap;
    const y = 360;
    const beaten = i < tournament.index;
    const next = i === tournament.index;
    const size = fight.boss ? 190 : 160;
    root.add(scene.add.rectangle(x, y, 200, 240, next ? 0x3a3170 : 0x231d45).setStrokeStyle(next ? 8 : 3, next ? 0xffd84d : 0x3a3170));
    const key = characterTexture(scene, fight.character, 'normal');
    if (key) {
      const image = scene.add.image(x, y + 90, key).setOrigin(0.5, 1).setFlipX(true);
      image.setScale(size / image.height);
      if (beaten) image.setTint(0x777777);
      root.add(image);
    } else {
      root.add(scene.add.circle(x, y, size * 0.3, fight.boss ? BOSS_STATS.color : 0x8a86b8).setStrokeStyle(6, 0x1b1530));
      if (fight.boss) root.add(scene.add.text(x, y - size * 0.35, '👑', textStyle(48, '#ffffff')).setOrigin(0.5));
    }
    const name = fight.boss ? BOSS_STATS.name : CHARACTERS[fight.character].name;
    root.add(scene.add.text(x, y + 140, name, textStyle(24, '#ffffff', { fontStyle: 'bold', stroke: '#1b1530', strokeThickness: 5 })).setOrigin(0.5));
    if (beaten) root.add(scene.add.text(x, y - 20, '✅', textStyle(70, '#ffffff')).setOrigin(0.5));
  });
  root.add(scene.add.text(width / 2, height - 90, hint, textStyle(28, '#ffffff', { fontStyle: 'bold', align: 'center', stroke: '#1b1530', strokeThickness: 6 })).setOrigin(0.5));
  return root;
}

// ---------- Supervivencia ----------
// Al ganar cada pelea recupera un poco de vida; la compu se pone más difícil cada 3 victorias.
const SURVIVAL_HEAL = 30;
const RECORD_KEY = 'dueloRecord';
export const SURVIVAL_STICKER_AT = 5;

export function survivalRecord() {
  return settings.get(RECORD_KEY, 0);
}

export class Survival {
  constructor(maxHealth) {
    this.wins = 0;
    this.health = maxHealth;
    this.maxHealth = maxHealth;
  }

  get level() {
    return this.wins < 3 ? 'facil' : this.wins < 6 ? 'normal' : 'dificil';
  }

  won(health) {
    this.wins += 1;
    this.health = Math.min(this.maxHealth, health + SURVIVAL_HEAL);
  }

  // Guarda el récord (en este aparato). Devuelve { record, isNew }.
  finish() {
    const record = settings.get(RECORD_KEY, 0);
    if (this.wins > record) settings.set(RECORD_KEY, this.wins);
    return { record: Math.max(record, this.wins), isNew: this.wins > record };
  }
}

// ---------- Entrenamiento ----------
// Los retos: cada movimiento se palomea la primera vez que lo haces.
export const DRILLS = [
  ['punch', 'Golpe (A)'],
  ['kick', 'Patada (B)'],
  ['finisher', 'Remate (A A A)'],
  ['uppercut', 'Gancho (↓ + A)'],
  ['sweep', 'Barrida (↓ + B)'],
  ['airKick', 'Patada voladora'],
  ['grab', 'Agarre'],
  ['dash', 'Arrancón'],
  ['roll', 'Rodada'],
  ['special', 'Especial (X)'],
  ['super', 'Súper (LB + RB)'],
  ['final', 'Golpe final'],
];

export class Drills {
  constructor(scene) {
    this.done = new Set();
    const { width } = scene.scale;
    this.text = scene.add
      .text(width / 2, 118, '', textStyle(19, '#ffffff', { fontStyle: 'bold', align: 'center', stroke: '#1b1530', strokeThickness: 5, lineSpacing: 6 }))
      .setOrigin(0.5, 0)
      .setDepth(10000);
    this.refresh();
  }

  // Devuelve el nombre del reto si es nuevo (para decirlo), o null.
  mark(key) {
    const drill = DRILLS.find(([k]) => k === key);
    if (!drill || this.done.has(key)) return null;
    this.done.add(key);
    this.refresh();
    return drill[1].replace(/ \(.*\)$/, '');
  }

  get complete() {
    return this.done.size === DRILLS.length;
  }

  refresh() {
    const items = DRILLS.map(([key, name]) => `${this.done.has(key) ? '✅' : '⬜'} ${name}`);
    const rows = [items.slice(0, 4), items.slice(4, 8), items.slice(8)].map((row) => row.join('    '));
    this.text.setText(`Retos: ${this.done.size} de ${DRILLS.length}\n${rows.join('\n')}`);
  }

  destroy() {
    this.text.destroy();
  }
}
