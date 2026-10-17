import { COLORS } from '../../ui/style.js';

// Los 4 personajes de Bolitas Bros. El color es el de cada jugador; el personaje se reconoce
// por su accesorio y por cómo se mueve.
//   weight: más pesado = sale volando menos.  power: multiplica el daño y el empujón que hace.
//   stats: 1 a 3, solo para mostrarlos en la pantalla de selección.
export const CHARACTERS = {
  tanque: {
    name: 'Tanque',
    blurb: 'Fuerte y pesado',
    special: 'Puñetazo cargado',
    radius: 38,
    weight: 1.25,
    power: 1.3,
    run: 300,
    air: 280,
    jump: 740,
    airJumps: 1,
    stats: { Fuerza: 3, Velocidad: 1, Salto: 1 },
  },
  rayo: {
    name: 'Rayo',
    blurb: 'El más rápido',
    special: 'Embestida',
    radius: 32,
    weight: 0.85,
    power: 0.85,
    run: 470,
    air: 380,
    jump: 780,
    airJumps: 1,
    stats: { Fuerza: 1, Velocidad: 3, Salto: 2 },
  },
  resorte: {
    name: 'Resorte',
    blurb: 'Salta tres veces',
    special: 'Súper salto',
    radius: 34,
    weight: 1,
    power: 1,
    run: 360,
    air: 330,
    jump: 880,
    airJumps: 2,
    stats: { Fuerza: 2, Velocidad: 2, Salto: 3 },
  },
  estrella: {
    name: 'Estrella',
    blurb: 'Lanza estrellas',
    special: 'Estrella',
    radius: 34,
    weight: 0.95,
    power: 0.95,
    run: 370,
    air: 330,
    jump: 780,
    airJumps: 1,
    stats: { Fuerza: 2, Velocidad: 2, Salto: 2 },
  },
};

export const CHARACTER_KEYS = Object.keys(CHARACTERS);

// Le pone a la bolita el accesorio de su personaje: casco, pelos de rayo, orejas o estrella.
export function addAccessory(scene, blob, key) {
  const r = blob.radius;
  const figure = blob.figure;
  if (key === 'tanque') {
    figure.add(scene.add.arc(0, -r * 0.45, r * 0.85, 180, 360, false, 0x5a5a6e));
    figure.add(scene.add.rectangle(0, -r * 0.5, r * 1.75, r * 0.16, 0x3a3a4a));
  } else if (key === 'rayo') {
    const hair = scene.add.graphics();
    hair.fillStyle(0xffe14d, 1);
    hair.lineStyle(3, COLORS.ink, 1);
    for (const [a, b, c] of [
      [[-0.55, -0.75], [-0.35, -1.45], [-0.1, -0.85]],
      [[-0.15, -0.9], [0.1, -1.6], [0.3, -0.9]],
      [[0.2, -0.85], [0.55, -1.4], [0.6, -0.7]],
    ]) {
      hair.fillTriangle(a[0] * r, a[1] * r, b[0] * r, b[1] * r, c[0] * r, c[1] * r);
      hair.strokeTriangle(a[0] * r, a[1] * r, b[0] * r, b[1] * r, c[0] * r, c[1] * r);
    }
    figure.addAt(hair, 0);
  } else if (key === 'resorte') {
    for (const side of [-1, 1]) {
      const ear = scene.add.ellipse(side * r * 0.42, -r * 1.1, r * 0.4, r * 0.95, 0xffffff).setStrokeStyle(3, COLORS.ink);
      const inner = scene.add.ellipse(side * r * 0.42, -r * 1.08, r * 0.18, r * 0.6, 0xff9ec7);
      ear.setRotation(side * 0.2);
      inner.setRotation(side * 0.2);
      figure.addAt(inner, 0);
      figure.addAt(ear, 0);
    }
  } else if (key === 'estrella') {
    figure.add(scene.add.star(0, -r * 1.15, 5, r * 0.2, r * 0.45, COLORS.accent).setStrokeStyle(3, COLORS.ink));
  }
}
