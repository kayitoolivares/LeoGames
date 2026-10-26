import Phaser from 'phaser';
import { lazyImage } from '../../shared/lazyArt.js';
import { FIELD } from './field.js';
import manifest from './art.json';

// Las canchas: el fondo (de Gemini) y cómo se juega en cada una. `gravity` = qué tanto jala hacia abajo
// (en la luna, poquito: todo flota), `friction` = qué tanto frena el piso al balón (la arena, mucho),
// `grip` = qué tan rápido arrancan y frenan los jugadores (en la nieve se resbalan), `bounce` = qué tanto rebota el
// balón en el piso (en la gelatina, muchísimo) y `rain` = llueve (gotas que caen).
export const PITCHES = {
  estadio: { name: 'Estadio', sky: 0x8fd3ff, grass: 0x5cb85c, gravity: 1, friction: 1, grip: 1 },
  playa: { name: 'Playa', sky: 0x8fe0ff, grass: 0xf2d27a, gravity: 1, friction: 2.6, grip: 0.85, note: 'La arena frena el balón' },
  nieve: { name: 'Nieve', sky: 0xcfe8ff, grass: 0xeaf6ff, gravity: 1, friction: 0.3, grip: 0.28, snow: true, note: '¡Se resbalan!' },
  luna: { name: 'Luna', sky: 0x101830, grass: 0x9a9aa8, gravity: 0.45, friction: 1, grip: 1, note: 'Poca gravedad: ¡todo flota!' },
  azotea: { name: 'Azotea', sky: 0xffb38a, grass: 0x4caf50, gravity: 1, friction: 1, grip: 1 },
  selva: { name: 'Selva', sky: 0x9be3c4, grass: 0x3f8a3a, gravity: 1, friction: 0.55, grip: 0.8, rain: true, note: 'Llueve: el balón se resbala' },
  dulces: { name: 'Dulcelandia', sky: 0xffd6f5, grass: 0x9be36a, gravity: 0.9, friction: 1, grip: 1, bounce: 1.25, note: 'Piso de gelatina: ¡todo rebota!' },
  noche: { name: 'Estadio de noche', sky: 0x14183a, grass: 0x2f6b3a, gravity: 1, friction: 1, grip: 1 },
};
export const PITCH_KEYS = Object.keys(PITCHES);
const SNOWFLAKES = 36;
const RAINDROPS = 40;

// El fondo de una cancha, solo cuando se va a ver (ver shared/lazyArt.js); `onReady` cuando llega.
export function loadPitchArt(scene, name, onReady) {
  if (!manifest.fondos.includes(name)) return true;
  return lazyImage(scene, `futbol:fondo-${name}`, `futbol/fondos/${name}.jpg`, onReady);
}

// Dibuja el fondo de la cancha (y, en la nieve, copos que caen). Devuelve lo dibujado y una función para
// moverlo cada cuadro.
export function drawPitch(scene, key) {
  const { width, height } = scene.scale;
  const pitch = PITCHES[key];
  const parts = [];
  const texture = `futbol:fondo-${key}`;
  if (scene.textures.exists(texture)) {
    const image = scene.add.image(width / 2, height / 2, texture).setDepth(-100);
    image.setScale(Math.max(width / image.width, height / image.height));
    parts.push(image);
  } else {
    parts.push(scene.add.rectangle(width / 2, height / 2, width, height, pitch.sky).setDepth(-100));
    parts.push(scene.add.rectangle(width / 2, (FIELD.ground + height) / 2 - 140, width, height - FIELD.ground + 280, pitch.grass).setDepth(-99));
  }
  const flakes = [];
  if (pitch.snow) {
    for (let i = 0; i < SNOWFLAKES; i += 1) {
      const flake = scene.add.circle(Math.random() * width, Math.random() * FIELD.ground, Phaser.Math.Between(2, 5), 0xffffff, 0.85).setDepth(-40);
      flakes.push({ flake, vy: Phaser.Math.Between(40, 90), phase: Math.random() * 6 });
      parts.push(flake);
    }
  }
  // La lluvia: rayitas que caen rápido (sin columpiarse).
  if (pitch.rain) {
    for (let i = 0; i < RAINDROPS; i += 1) {
      const drop = scene.add
        .rectangle(Math.random() * width, Math.random() * FIELD.ground, 2, 16, 0xcfe8ff, 0.55)
        .setDepth(-40)
        .setAngle(12);
      flakes.push({ flake: drop, vy: Phaser.Math.Between(520, 700), phase: 0, rain: true });
      parts.push(drop);
    }
  }
  let time = 0;
  const update = (dtMs) => {
    time += dtMs / 1000;
    for (const f of flakes) {
      f.flake.y += f.vy * (dtMs / 1000);
      f.flake.x += f.rain ? -f.vy * 0.2 * (dtMs / 1000) : Math.sin(time * 1.4 + f.phase) * 0.6;
      if (f.flake.y > FIELD.ground) f.flake.setPosition(Math.random() * width, -10);
    }
  };
  return { parts, update };
}
