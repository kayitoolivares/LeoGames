import { settings } from '../../shared/settings.js';

// Los mundos guardados (3 ranuras) en este aparato: la semilla, el modo, si salen monstruitos, la hora del día, lo que
// lleva cada jugador (por su número, J1 a J4) y los cambios al mundo (ver World.changes()).
const KEY = 'bloquesMundos';
const OPTIONS_KEY = 'bloquesOpciones';
export const SLOTS = 3;

export function loadSlots() {
  const list = settings.get(KEY, []);
  return Array.from({ length: SLOTS }, (_, i) => list[i] ?? null);
}

export function saveSlot(index, data) {
  const list = loadSlots();
  list[index] = data;
  settings.set(KEY, list);
}

export function clearSlot(index) {
  saveSlot(index, null);
}

// Lo último que se escogió (ranura, modo y monstruitos).
export function lastOptions() {
  return { slot: 0, mode: 'creativo', monsters: true, ...settings.get(OPTIONS_KEY, {}) };
}

export function rememberOptions(options) {
  settings.set(OPTIONS_KEY, options);
}

export function newSeed() {
  return Math.floor(Math.random() * 1e9);
}
