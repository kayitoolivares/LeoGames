import * as THREE from 'three';
import { settings } from '../../shared/settings.js';
import { CHARACTER_KEYS } from '../smash/characters.js';
import manifest from './art.json';

// Lo que se escoge en el taller de Karts locos: el tipo de kart (cada uno maneja distinto), su color,
// las llantas, un adorno y una calcomanía. El piloto es uno de los personajes de Bolitas Bros.
// Lo que tiene `price` hay que comprarlo primero en la tienda del taller, con las monedas de las carreras.

// stats: 1 a 3 (para mostrarlas). El juego los convierte en velocidad, arranque, giro y peso (ver kartStats).
// offroad: qué tanto lo frena el pasto (1 = nada).
export const KART_TYPES = {
  clasico: { name: 'Clásico', stats: { Velocidad: 2, Arranque: 2, Giro: 2, Peso: 2 } },
  bolido: { name: 'Bólido', stats: { Velocidad: 3, Arranque: 1, Giro: 2, Peso: 2 } },
  mini: { name: 'Mini', stats: { Velocidad: 1, Arranque: 3, Giro: 3, Peso: 1 } },
  monstruo: { name: 'Monstruo', stats: { Velocidad: 2, Arranque: 1, Giro: 1, Peso: 3 }, offroad: 0.85 },
  // De la tienda.
  cohete: { name: 'Cohete', emoji: '🚀', stats: { Velocidad: 3, Arranque: 2, Giro: 1, Peso: 2 }, price: 60 },
  tina: { name: 'Tina de baño', emoji: '🛁', stats: { Velocidad: 1, Arranque: 2, Giro: 3, Peso: 2 }, price: 40 },
  pato: { name: 'Pato de hule', emoji: '🦆', stats: { Velocidad: 2, Arranque: 3, Giro: 2, Peso: 1 }, price: 50 },
};
export const KART_TYPE_KEYS = Object.keys(KART_TYPES);

export const PAINTS = [0xe53935, 0xff8a1e, 0xffd02a, 0x3cc44f, 0x3db8f5, 0x3a5bd6, 0x8158d8, 0xff3d9e, 0xf2f2f2, 0x2b2b3a];
// Colores de la tienda.
export const SHOP_PAINTS = [
  { hex: 0xd4a017, name: 'Dorado', price: 20 },
  { hex: 0xc8ccd8, name: 'Plateado', price: 15 },
  { hex: 0x7fe0c8, name: 'Menta', price: 10 },
  { hex: 0x7a4a32, name: 'Chocolate', price: 10 },
];

export const WHEELS = {
  normales: { name: 'Normales' },
  doradas: { name: 'Doradas' },
  colores: { name: 'De colores' },
  blancas: { name: 'Blancas' },
  fuego: { name: 'De fuego', emoji: '🔥', price: 20 },
  neon: { name: 'Neón', emoji: '💡', price: 20 },
};
export const WHEEL_KEYS = Object.keys(WHEELS);

export const EXTRAS = {
  aleron: { name: 'Alerón' },
  bandera: { name: 'Bandera' },
  cuernos: { name: 'Cuernos' },
  antena: { name: 'Antena' },
  corona: { name: 'Corona', emoji: '👑', price: 30 },
  cohetes: { name: 'Cohetes', emoji: '🚀', price: 30 },
  globo: { name: 'Globo', emoji: '🎈', price: 15 },
  nada: { name: 'Nada' },
};
export const EXTRA_KEYS = Object.keys(EXTRAS);

// Calcomanías de los lados (dibujadas por Gemini, en kart/calcomanias) o el número del piloto.
export const DECALS = {
  llamas: { name: 'Llamas' },
  estrellas: { name: 'Estrellas' },
  rayos: { name: 'Rayos' },
  corazones: { name: 'Corazones' },
  flores: { name: 'Flores' },
  numero: { name: 'Número' },
  nada: { name: 'Nada' },
  // De la tienda.
  calavera: { name: 'Calavera', price: 15 },
  dinos: { name: 'Dinosaurios', price: 15 },
  unicornio: { name: 'Unicornio', price: 15 },
  balones: { name: 'Balones', price: 15 },
  notas: { name: 'Notas', price: 15 },
};
export const DECAL_KEYS = Object.keys(DECALS).filter((key) => key === 'numero' || key === 'nada' || manifest.calcomanias?.includes(key));

// La textura de una calcomanía (las de imagen se cargan una sola vez). 'numero' pinta el número en un círculo.
const decalCache = new Map();
export function decalTexture(key, number = 1) {
  if (!key || key === 'nada' || !DECAL_KEYS.includes(key)) return null;
  if (key === 'numero') return numberTexture(number);
  if (!decalCache.has(key)) {
    const texture = new THREE.TextureLoader().load(`kart/calcomanias/${key}.png`);
    texture.colorSpace = THREE.SRGBColorSpace;
    decalCache.set(key, texture);
  }
  return decalCache.get(key);
}

function numberTexture(number) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.beginPath();
  ctx.arc(64, 64, 56, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.lineWidth = 10;
  ctx.strokeStyle = '#1b1530';
  ctx.stroke();
  ctx.fillStyle = '#1b1530';
  ctx.font = 'bold 72px "Segoe UI", Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(number), 64, 70);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  // Es de un solo kart: se libera con él (ver disposeKartModel).
  texture.userData.disposable = true;
  return texture;
}

// Cómo maneja cada tipo de kart. Las diferencias son chicas a propósito: con cualquiera se puede ganar.
export function kartStats(type) {
  const { stats, offroad = 0.6 } = KART_TYPES[type] ?? KART_TYPES.clasico;
  return {
    maxSpeed: 38.5 + (stats.Velocidad - 1) * 1.5,
    accel: [21, 24, 28][stats.Arranque - 1],
    turn: [2.2, 2.4, 2.65][stats.Giro - 1],
    weight: [0.8, 1, 1.3][stats.Peso - 1],
    offroad,
  };
}

// Lo que escogió cada control en el taller (dura mientras la página esté abierta, como los personajes).
const picks = new Map();

export const kartPicks = {
  get(deviceId) {
    return picks.get(deviceId) ?? null;
  },

  set(deviceId, setup) {
    picks.set(deviceId, { ...setup });
  },
};

// Un kart al azar para la compu, con un personaje que no traiga nadie más (si se puede).
export function randomSetup(taken) {
  const free = CHARACTER_KEYS.filter((key) => !taken.has(key));
  const pick = (list) => list[Math.floor(Math.random() * list.length)];
  return {
    character: pick(free.length ? free : CHARACTER_KEYS),
    type: pick(KART_TYPE_KEYS.filter((key) => !KART_TYPES[key].price)),
    color: pick(PAINTS),
    wheels: pick(WHEEL_KEYS.filter((key) => !WHEELS[key].price)),
    extra: pick(EXTRA_KEYS.filter((key) => !EXTRAS[key].price)),
    decal: pick(DECAL_KEYS.filter((key) => !DECALS[key].price)),
    number: 10 + Math.floor(Math.random() * 90),
  };
}

// --- La tienda ---
// Las monedas de toda la familia (se guardan en el aparato) y lo que ya se compró.
const WALLET = 'kartWallet';
const OWNED = 'kartOwned';
const CATALOGS = { type: KART_TYPES, wheels: WHEELS, extra: EXTRAS, decal: DECALS };

export const wallet = {
  get() {
    return settings.get(WALLET, 0);
  },
  add(coins) {
    settings.set(WALLET, this.get() + coins);
  },
};

// ¿Ya se tiene? (lo que no tiene precio siempre se tiene). `kind`: type | wheels | extra | decal | color.
export function owns(kind, key) {
  const price = kind === 'color' ? SHOP_PAINTS.find((paint) => paint.hex === key)?.price : CATALOGS[kind][key]?.price;
  return !price || settings.get(OWNED, []).includes(`${kind}:${key}`);
}

// Lo que se vende (las calcomanías nuevas solo si ya llegó su dibujo de Gemini).
export function shopItems() {
  const items = [];
  for (const [kind, catalog] of Object.entries(CATALOGS)) {
    for (const [key, item] of Object.entries(catalog)) {
      if (!item.price || (kind === 'decal' && !DECAL_KEYS.includes(key))) continue;
      items.push({ kind, key, name: item.name, price: item.price, emoji: item.emoji });
    }
  }
  for (const paint of SHOP_PAINTS) items.push({ kind: 'color', key: paint.hex, name: paint.name, price: paint.price });
  return items;
}

// Compra algo si alcanzan las monedas. Devuelve true si se compró.
export function buy(item) {
  if (owns(item.kind, item.key) || wallet.get() < item.price) return false;
  settings.set(WALLET, wallet.get() - item.price);
  settings.set(OWNED, [...settings.get(OWNED, []), `${item.kind}:${item.key}`]);
  return true;
}
