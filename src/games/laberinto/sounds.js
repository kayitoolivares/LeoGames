import { noise, voice } from '../../shared/sound.js';

// Los sonidos del Laberinto come-frutas (hechos con Web Audio, como los demás): el "ñam" de las bolitas (sube y baja, uno
// y uno), la fruta de poder, comerse un fantasmita, que te atrapen y el rebote del modo peque.
export const labSfx = {
  // Comer una bolita: dos "ñam" que se turnan (alto, bajo), suavecitos.
  waka(high) {
    const [a, b] = high ? [520, 760] : [440, 300];
    voice({
      points: [
        [0, a],
        [55, b],
        [110, a],
      ],
      type: 'triangle',
      volume: 0.07,
    });
  },
  // Fruta de poder: una sirena que sube.
  power() {
    voice({
      points: [
        [0, 300],
        [180, 900],
        [360, 500],
        [540, 1100],
      ],
      type: 'square',
      volume: 0.06,
    });
  },
  // Comerse un fantasmita: un "gulp" que sube más con cada uno de la misma fruta (combo 0 a 3).
  eatGhost(combo) {
    const top = 700 + combo * 220;
    voice({
      points: [
        [0, 200],
        [140, top],
        [220, top * 1.4],
      ],
      type: 'square',
      volume: 0.08,
    });
  },
  // El fantasmita regresa a su casita: ojitos que corren.
  eyes() {
    voice({
      points: [
        [0, 900],
        [80, 1300],
        [160, 900],
        [240, 1300],
      ],
      type: 'sine',
      volume: 0.05,
    });
  },
  // Te atraparon: un "uuuh" que baja (nada feo).
  caught() {
    voice({
      points: [
        [0, 700],
        [500, 180],
      ],
      type: 'triangle',
      volume: 0.16,
      vibrato: { rate: 8, depth: 20 },
    });
  },
  // Fruta bonus.
  fruit() {
    voice({
      points: [
        [0, 660],
        [90, 990],
        [180, 1320],
      ],
      type: 'square',
      volume: 0.06,
    });
  },
  // Modo peque: el fantasmita rebota.
  boing() {
    voice({
      points: [
        [0, 180],
        [120, 620],
        [240, 400],
      ],
      type: 'sine',
      volume: 0.18,
    });
  },
  // La burbuja del que atraparon se revienta al llegar a su casita.
  pop() {
    voice({
      points: [
        [0, 500],
        [70, 1300],
      ],
      type: 'sine',
      volume: 0.15,
    });
    noise({ ms: 50, volume: 0.07, filter: 5000 });
  },
};
