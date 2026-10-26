import { noise, voice } from '../../shared/sound.js';
import manifest from './art.json';

// Los animalitos del Modo Bebé: se asoman por el lado de la flecha y hacen su sonido. Cada uno tiene su dibujo de
// Gemini (normal y "<animal>-canta", con la boca abierta; ver npm run arte) o, si falta, su emoji.
//   name: lo que dice la voz   sound: el letrero (su onomatopeya)   cry: el sonido, hecho con osciladores
export const ANIMALS = {
  perro: { name: 'Perrito', emoji: '🐶', sound: '¡Guau guau!', cry: () => repeat(2, 260, (delay) => bark(delay)) },
  gato: {
    name: 'Gatito',
    emoji: '🐱',
    sound: '¡Miau!',
    cry: () =>
      voice({
        points: [
          [0, 480],
          [160, 820],
          [450, 720],
          [720, 430],
        ],
        type: 'sawtooth',
        volume: 0.22,
        vibrato: { rate: 6, depth: 14 },
        filter: { type: 'bandpass', freq: 1150, q: 1.6 },
      }),
  },
  vaca: {
    name: 'Vaquita',
    emoji: '🐮',
    sound: '¡Muuu!',
    cry: () =>
      voice({
        points: [
          [0, 115],
          [220, 140],
          [850, 128],
          [1150, 96],
        ],
        type: 'sawtooth',
        volume: 0.32,
        vibrato: { rate: 4, depth: 3 },
        filter: { freq: 520 },
      }),
  },
  cerdito: {
    name: 'Cerdito',
    emoji: '🐷',
    sound: '¡Oink oink!',
    cry: () =>
      repeat(2, 230, (delay) => {
        voice({
          points: [
            [0, 250],
            [60, 330],
            [170, 190],
          ],
          type: 'square',
          volume: 0.16,
          delay,
          filter: { type: 'bandpass', freq: 700, q: 2 },
        });
        noise({ ms: 120, volume: 0.06, filter: 900, delay });
      }),
  },
  pollito: {
    name: 'Pollito',
    emoji: '🐥',
    sound: '¡Pío pío!',
    cry: () =>
      repeat(3, 190, (delay) =>
        voice({
          points: [
            [0, 2200],
            [60, 2900],
            [130, 2000],
          ],
          type: 'sine',
          volume: 0.18,
          delay,
        }),
      ),
  },
  pato: {
    name: 'Patito',
    emoji: '🦆',
    sound: '¡Cuac cuac!',
    cry: () =>
      repeat(2, 260, (delay) =>
        voice({
          points: [
            [0, 580],
            [50, 660],
            [200, 420],
          ],
          type: 'sawtooth',
          volume: 0.22,
          delay,
          tremolo: { rate: 40, depth: 0.6 },
          filter: { type: 'bandpass', freq: 1300, q: 3 },
        }),
      ),
  },
  rana: {
    name: 'Ranita',
    emoji: '🐸',
    sound: '¡Croac croac!',
    cry: () =>
      repeat(2, 380, (delay) =>
        voice({
          points: [
            [0, 170],
            [260, 140],
          ],
          type: 'square',
          volume: 0.16,
          delay,
          tremolo: { rate: 28, depth: 1 },
          filter: { freq: 900 },
        }),
      ),
  },
  oveja: {
    name: 'Ovejita',
    emoji: '🐑',
    sound: '¡Beee!',
    cry: () =>
      voice({
        points: [
          [0, 330],
          [100, 360],
          [750, 320],
        ],
        type: 'sawtooth',
        volume: 0.22,
        vibrato: { rate: 9, depth: 12 },
        tremolo: { rate: 9, depth: 0.8 },
        filter: { type: 'bandpass', freq: 1000, q: 1.5 },
      }),
  },
  caballo: {
    name: 'Caballito',
    emoji: '🐴',
    sound: '¡Iiiii!',
    cry: () =>
      voice({
        points: [
          [0, 700],
          [160, 1300],
          [700, 1100],
          [1000, 600],
        ],
        type: 'sawtooth',
        volume: 0.15,
        vibrato: { rate: 14, depth: 60 },
        tremolo: { rate: 14, depth: 0.5 },
        filter: { type: 'bandpass', freq: 1500, q: 1.2 },
      }),
  },
  leon: {
    name: 'Leoncito',
    emoji: '🦁',
    sound: '¡Grrr!',
    cry: () => {
      noise({ ms: 700, volume: 0.3, filter: 600 });
      voice({
        points: [
          [0, 110],
          [200, 140],
          [700, 70],
        ],
        type: 'sawtooth',
        volume: 0.25,
        tremolo: { rate: 30, depth: 0.7 },
        filter: { freq: 420 },
      });
    },
  },
  elefante: {
    name: 'Elefantito',
    emoji: '🐘',
    sound: '¡Tuuuu!',
    cry: () =>
      voice({
        points: [
          [0, 350],
          [120, 700],
          [600, 650],
          [900, 450],
        ],
        type: 'sawtooth',
        volume: 0.17,
        vibrato: { rate: 7, depth: 20 },
        filter: { type: 'bandpass', freq: 1100 },
      }),
  },
  mono: {
    name: 'Changuito',
    emoji: '🐵',
    sound: '¡Uh uh ah ah!',
    cry: () => {
      repeat(2, 180, (delay) =>
        voice({
          points: [
            [0, 340],
            [120, 430],
          ],
          type: 'sine',
          volume: 0.25,
          delay,
        }),
      );
      repeat(2, 200, (delay) =>
        voice({
          points: [
            [0, 700],
            [80, 1050],
            [170, 800],
          ],
          type: 'triangle',
          volume: 0.22,
          delay: 400 + delay,
        }),
      );
    },
  },
};
export const ANIMAL_KEYS = Object.keys(ANIMALS);

function repeat(times, gap, play) {
  for (let i = 0; i < times; i += 1) play(i * gap);
}

function bark(delay) {
  voice({
    points: [
      [0, 520],
      [40, 620],
      [150, 300],
    ],
    type: 'sawtooth',
    volume: 0.24,
    delay,
    filter: { freq: 1400 },
  });
  noise({ ms: 90, volume: 0.14, filter: 2200, delay });
}

const artKey = (name) => `baby:${name}`;

export function loadAnimalArt(scene) {
  for (const name of manifest.animales ?? []) {
    if (!scene.textures.exists(artKey(name))) scene.load.image(artKey(name), `baby/animales/${name}.png`);
  }
}

// El dibujo del animalito (`singing`: con la boca abierta), o null si no hay (entonces va su emoji).
export function animalTexture(scene, key, singing = false) {
  const name = singing ? `${key}-canta` : key;
  if (scene.textures.exists(artKey(name))) return artKey(name);
  return singing ? animalTexture(scene, key) : null;
}
