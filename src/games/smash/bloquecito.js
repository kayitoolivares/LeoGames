import { controls } from '../../shared/controls.js';
import { rewards } from '../../shared/rewards.js';
import { sfx } from '../../shared/sound.js';
import { say } from '../../shared/voice.js';

// Bloquecito: un personaje hecho de bloques que cambia de número del 1 al 10 cuando quiera
// (Y sube uno, ↓ + Y baja uno; del 10 regresa al 1). Cada número tiene su color, su forma y su truco
// (el especial). Entre más grande, más fuerte y pesado, pero más lento.
// Su súper forma es Octobloque: el 8 superhéroe, con antifaz, capa y ocho brazos.
// No usa imágenes: lo dibuja ui/BlockBody.js con figuras.
export const BLOCK_CHARACTER = 'bloquecito';
export const OCTO = 'octo';
export const MAX_NUMBER = 10;

// Cómo es cada número: nombre, color, forma (columnas × filas), detalles de la cara y su truco.
//   look: cyclops (un ojo) | glasses (lentes) | crown (corona y botones) | brows (cejas) | star (mano de estrella) |
//         dice (puntos de dado) | rainbow (arcoíris y lentes) | octopus (tentáculos) | big (cejotas) | ten (lentes de estrella) |
//         hero (Octobloque: antifaz, capa y ocho brazos)
export const NUMBERS = {
  1: { name: 'Uno', color: 0xf0362b, cols: 1, rows: 1, look: 'cyclops', special: 'Embestida' },
  2: { name: 'Dos', color: 0xff8a1e, cols: 1, rows: 2, look: 'glasses', special: 'Doble golpe' },
  3: { name: 'Tres', color: 0xffd02a, cols: 1, rows: 3, look: 'crown', special: 'Malabares' },
  4: { name: 'Cuatro', color: 0x3cc44f, cols: 1, rows: 4, look: 'brows', special: '¡Cuadrado!' },
  5: { name: 'Cinco', color: 0x3db8f5, cols: 1, rows: 5, look: 'star', special: 'Estrella' },
  6: { name: 'Seis', color: 0x8158d8, cols: 2, rows: 3, look: 'dice', special: 'Dado rodante' },
  7: { name: 'Siete', color: 0xa35be0, cols: 1, rows: 7, look: 'rainbow', special: 'Arcoíris' },
  8: { name: 'Ocho', color: 0xff3d9e, cols: 2, rows: 4, look: 'octopus', special: 'Ocho brazos' },
  9: { name: 'Nueve', color: 0x9da3ad, cols: 3, rows: 3, look: 'big', special: 'Golpazo' },
  10: { name: 'Diez', color: 0xffffff, cols: 2, rows: 5, look: 'ten', special: '¡Despegue!' },
  [OCTO]: { name: 'Octobloque', color: 0xff3d9e, cols: 2, rows: 4, look: 'hero', special: 'Ocho brazos' },
};

// El 7 es de colores: un bloque de cada color del arcoíris, de abajo hacia arriba.
export const RAINBOW = [0xf0362b, 0xff8a1e, 0xffd02a, 0x3cc44f, 0x3db8f5, 0x4a5bd6, 0xa35be0];

export function isBlockCharacter(character) {
  return character === BLOCK_CHARACTER;
}

// El número que sigue (step = 1) o el anterior (step = -1), dando la vuelta: después del 10 viene el 1.
export function nextNumber(n, step) {
  return ((n - 1 + step + MAX_NUMBER) % MAX_NUMBER) + 1;
}

// Lo que apretó un jugador para cambiar de número: Y = 1 (sube), ↓ + Y = -1 (baja), nada = 0.
// Con LB + RB apretados no cuenta, porque LB + RB + Y es para salir del juego.
export function numberStep(deviceId) {
  if (!controls.justPressed(deviceId, 'y')) return 0;
  if (controls.isDown(deviceId, 'lb') && controls.isDown(deviceId, 'rb')) return 0;
  return controls.getStick(deviceId).y > 0.5 ? -1 : 1;
}

// Qué tan grande es, de 0 (el 1) a 1 (el 10); Octobloque cuenta como el 8. Los juegos sacan de aquí
// su fuerza, peso y velocidad.
export function numberSize(form) {
  return ((form === OCTO ? 8 : form) - 1) / (MAX_NUMBER - 1);
}

export function lerp(a, b, k) {
  return a + (b - a) * k;
}

// Los números por los que ya pasó cada jugador (para la calcomanía de contar del 1 al 10).
const counted = new Map();

// Suena (y, si es un jugador, dice el número en voz alta) al cambiar de número.
// Si un jugador ya pasó por los 10 números, gana la calcomanía.
export function announceNumber(n, deviceId = null) {
  sfx.count(n);
  if (deviceId === null) return;
  say(NUMBERS[n].name);
  const seen = counted.get(deviceId) ?? new Set([1]);
  seen.add(n);
  counted.set(deviceId, seen);
  if (seen.size === MAX_NUMBER) rewards.earn('bloquecito-10');
}
