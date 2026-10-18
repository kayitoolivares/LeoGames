import { COLORS } from '../../ui/style.js';

// Los 8 personajes de Bolitas Bros. El color es el de cada jugador; el personaje se reconoce
// por su accesorio y por cómo se mueve.
//   weight: más pesado = sale volando menos.  power: multiplica el daño y el empujón que hace.
//   gravity (opcional): menos de 1 = flota más en el aire.
//   superName: cómo se llama cuando se transforma (barra de poder llena + LB + RB).
//   stats: 1 a 3, solo para mostrarlos en la pantalla de selección.
export const CHARACTERS = {
  tanque: {
    name: 'Tanque',
    superName: 'Súper Tanque',
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
    superName: 'Súper Rayo',
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
    superName: 'Súper Resorte',
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
    superName: 'Súper Estrella',
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
  ninja: {
    name: 'Ninja',
    superName: 'Súper Ninja',
    blurb: 'Rápido y tramposo',
    special: 'Aparece por detrás',
    radius: 31,
    weight: 0.8,
    power: 0.9,
    run: 440,
    air: 380,
    jump: 820,
    airJumps: 1,
    stats: { Fuerza: 1, Velocidad: 3, Salto: 2 },
  },
  robot: {
    name: 'Robot',
    superName: 'Mega Robot',
    blurb: 'Pesado y con láser',
    special: 'Rayo láser',
    radius: 37,
    weight: 1.2,
    power: 1.15,
    run: 290,
    air: 270,
    jump: 720,
    airJumps: 1,
    stats: { Fuerza: 3, Velocidad: 1, Salto: 1 },
  },
  dragon: {
    name: 'Dragoncito',
    superName: 'Gran Dragón',
    blurb: 'Flota en el aire',
    special: 'Echa fuego',
    radius: 35,
    weight: 1.05,
    power: 1.05,
    run: 320,
    air: 320,
    jump: 760,
    airJumps: 2,
    gravity: 0.8,
    stats: { Fuerza: 2, Velocidad: 1, Salto: 3 },
  },
  fantasma: {
    name: 'Fantasma',
    superName: 'Rey Fantasma',
    blurb: 'Ligero y escurridizo',
    special: 'Invisible',
    radius: 33,
    weight: 0.8,
    power: 0.95,
    run: 380,
    air: 370,
    jump: 790,
    airJumps: 2,
    gravity: 0.85,
    stats: { Fuerza: 1, Velocidad: 2, Salto: 3 },
  },
};

export const CHARACTER_KEYS = Object.keys(CHARACTERS);

// Le pone a la bolita el accesorio de su personaje (cuando no hay imagen de Gemini):
// casco, pelos de rayo, orejas, estrella, cinta ninja, antena, cuernitos o colita de fantasma.
export function addAccessory(scene, blob, key) {
  const r = blob.radius;
  const figure = blob.figure;
  if (key === 'tanque') {
    figure.add(scene.add.arc(0, -r * 0.45, r * 0.85, 180, 360, false, 0x5a5a6e));
    figure.add(scene.add.rectangle(0, -r * 0.5, r * 1.75, r * 0.16, 0x3a3a4a));
  } else if (key === 'rayo') {
    figure.addAt(spikes(scene, r, 0xffe14d, [
      [[-0.55, -0.75], [-0.35, -1.45], [-0.1, -0.85]],
      [[-0.15, -0.9], [0.1, -1.6], [0.3, -0.9]],
      [[0.2, -0.85], [0.55, -1.4], [0.6, -0.7]],
    ]), 0);
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
  } else if (key === 'ninja') {
    // Antifaz detrás de los ojos (justo encima de la bolita) y cinta roja con las puntas atrás.
    figure.addAt(scene.add.rectangle(0, -r * 0.12, r * 1.9, r * 0.5, COLORS.ink, 0.85), 1);
    figure.add(scene.add.rectangle(0, -r * 0.62, r * 1.7, r * 0.2, 0xff5a5f).setStrokeStyle(2, COLORS.ink));
    for (const tilt of [0.4, 0.8]) {
      figure.addAt(scene.add.rectangle(-r * 1.05, -r * 0.5, r * 0.55, r * 0.14, 0xff5a5f).setRotation(tilt), 0);
    }
  } else if (key === 'robot') {
    figure.addAt(scene.add.rectangle(0, -r * 1.12, r * 0.1, r * 0.4, 0x9a9aa8), 0);
    figure.add(scene.add.circle(0, -r * 1.35, r * 0.15, 0xff5a5f).setStrokeStyle(3, COLORS.ink));
    for (const side of [-1, 1]) figure.add(scene.add.circle(side * r * 0.98, 0, r * 0.2, 0x9a9aa8).setStrokeStyle(3, COLORS.ink));
  } else if (key === 'dragon') {
    figure.addAt(spikes(scene, r, 0xffc93c, [
      [[-0.55, -0.7], [-0.45, -1.25], [-0.25, -0.85]],
      [[0.25, -0.85], [0.45, -1.25], [0.55, -0.7]],
    ]), 0);
    for (const side of [-1, 1]) {
      figure.addAt(scene.add.ellipse(side * r * 1.05, -r * 0.2, r * 0.6, r * 0.9, 0xff9a3c).setStrokeStyle(3, COLORS.ink).setRotation(side * 0.5), 0);
    }
  } else if (key === 'fantasma') {
    // Colita ondulada de sábana: tres bolitas del mismo color asomando por abajo.
    for (const x of [-0.55, 0, 0.55]) figure.addAt(scene.add.circle(x * r, r * 0.8, r * 0.32, blob.color), 0);
  }
}

// Picos (pelo de Rayo, cuernitos de Dragoncito): triángulos con borde, en coordenadas de radio.
function spikes(scene, r, color, triangles) {
  const g = scene.add.graphics();
  g.fillStyle(color, 1);
  g.lineStyle(3, COLORS.ink, 1);
  for (const [a, b, c] of triangles) {
    g.fillTriangle(a[0] * r, a[1] * r, b[0] * r, b[1] * r, c[0] * r, c[1] * r);
    g.strokeTriangle(a[0] * r, a[1] * r, b[0] * r, b[1] * r, c[0] * r, c[1] * r);
  }
  return g;
}
