// Pistas de Karts locos. `points`: el trazo (x, z) antes de escalar; null = el de siempre (track.js).
// `unlock`: qué hay que ganar antes (ver UNLOCKS en rewards.js). `snowy`: árboles con nieve, monos de nieve
// y copos cayendo.
export const TRACKS = {
  pradera: {
    name: 'Pradera',
    emoji: '🌳',
    unlock: null,
    points: undefined,
    sky: 0x8fd3ff,
    ground: 0x6abf4b,
    groundLight: 0x5a7a3a,
    mountains: 0x8a86b8,
  },
  nieve: {
    name: 'Montaña nevada',
    emoji: '⛄',
    unlock: 'kart-nieve',
    // Una recta larga, una curva cerrada y una "S" del otro lado.
    points: [
      [-80, -50],
      [-20, -62],
      [40, -60],
      [85, -45],
      [100, -10],
      [80, 20],
      [40, 15],
      [15, 35],
      [30, 60],
      [0, 78],
      [-45, 68],
      [-72, 40],
      [-58, 10],
      [-92, -12],
    ],
    sky: 0xcfe3f5,
    ground: 0xf2f6fc,
    groundLight: 0x9aa8c0,
    mountains: 0xe6ecf8,
    snowy: true,
  },
};

export const TRACK_KEYS = Object.keys(TRACKS);
