import { noise, voice } from '../../shared/sound.js';

// Los sonidos del Mundo de bloques, según de qué es el bloque (ver `sound` en blocks.js).
const MATERIAL = {
  tierra: { filter: 900, volume: 0.22, ms: 90 },
  piedra: { filter: 2600, volume: 0.2, ms: 70 },
  madera: { filter: 1500, volume: 0.22, ms: 80 },
  hojas: { filter: 4200, volume: 0.12, ms: 70 },
  vidrio: { filter: 6000, volume: 0.14, ms: 60 },
  agua: { filter: 800, volume: 0.15, ms: 140 },
};

// Un golpecito mientras se escarba.
export function digTick(material) {
  const m = MATERIAL[material] ?? MATERIAL.tierra;
  noise({ ms: m.ms, volume: m.volume, filter: m.filter });
}

// El bloque se rompe.
export function breakSound(material) {
  const m = MATERIAL[material] ?? MATERIAL.tierra;
  noise({ ms: m.ms * 2.2, volume: m.volume * 1.4, filter: m.filter });
  if (material !== 'vidrio') return;
  // El vidrio además tintinea.
  voice({
    points: [
      [0, 2400],
      [120, 3200],
      [200, 1800],
    ],
    type: 'triangle',
    volume: 0.08,
  });
}

// Se pone un bloque: un "toc" grave.
export function placeSound(material) {
  const m = MATERIAL[material] ?? MATERIAL.tierra;
  noise({ ms: 60, volume: m.volume, filter: m.filter * 0.6 });
  voice({
    points: [
      [0, 220],
      [70, 140],
    ],
    type: 'triangle',
    volume: 0.12,
  });
}

// Se recoge un bloque (un "pop" chiquito que sube).
export function pickupSound() {
  voice({
    points: [
      [0, 700],
      [80, 1200],
    ],
    type: 'sine',
    volume: 0.08,
  });
}

// Un slime brinca (boing gelatinoso).
export function slimeSound() {
  voice({
    points: [
      [0, 180],
      [90, 420],
      [200, 260],
    ],
    type: 'sine',
    volume: 0.12,
    vibrato: { rate: 18, depth: 30 },
  });
}
