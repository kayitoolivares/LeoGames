import Phaser from 'phaser';
import { say } from '../../shared/voice.js';
import { sfx } from '../../shared/sound.js';
import { popText } from '../brawl/effects.js';
import { FLOOR, WALLS } from './DueloFighter.js';

// Las arenas nuevas del Duelo: su dibujo (mientras llega el de Gemini, o si no hay) y lo que pasa en cada una.
//   quicksand (Pirámide): aparecen arenas movedizas en el piso; el que se para encima se hunde: camina y salta poquito.
//   zerog (Nave espacial): se abre la compuerta y por un rato casi no hay gravedad (todos flotan).
//   current (Arrecife):    una corriente de agua empuja a todos hacia un lado (cubriéndote te empuja menos).
// Siempre hay aviso antes, para que dé tiempo de moverse.
const EVENTS = {
  quicksand: { everyMs: [6000, 9000], warnMs: 1100, ms: 5200, width: 230 },
  zerog: { everyMs: [10000, 14000], warnMs: 1300, ms: 3600, gravity: 0.2, lift: 280 },
  current: { everyMs: [8000, 12000], warnMs: 1000, ms: 3200, push: 190 },
};
const DEPTH = -40;

export class ArenaEvents {
  constructor(scene, kind) {
    this.scene = scene;
    this.kind = kind;
    this.spec = EVENTS[kind];
    this.root = scene.add.container(0, 0).setDepth(DEPTH);
    this.active = null;
    this.waitMs = Phaser.Math.Between(...this.spec.everyMs);
    this.count = 0;
  }

  // Solo mientras pelean (`fighting`); si no, lo que iba termina.
  update(dtMs, fighters, fighting) {
    if (this.active) {
      this.active.t += dtMs;
      if (this[this.kind](this.active, dtMs, fighters) === false) this.finish(fighters);
      return;
    }
    if (!fighting) return;
    this.waitMs -= dtMs;
    if (this.waitMs > 0) return;
    this.waitMs = Phaser.Math.Between(...this.spec.everyMs);
    this.count += 1;
    this.active = { t: 0, parts: [] };
  }

  add(part) {
    this.root.add(part);
    this.active.parts.push(part);
    return part;
  }

  finish(fighters) {
    if (!this.active) return;
    this.active.undo?.(fighters);
    for (const part of this.active.parts) part.destroy();
    this.active = null;
  }

  // Empieza ya (para las pruebas).
  trigger() {
    this.waitMs = 0;
  }

  // --- Pirámide: arenas movedizas ---
  quicksand(event, dtMs, fighters) {
    const { warnMs, ms, width } = this.spec;
    if (!event.x) {
      // Casi siempre cerca de alguien.
      const near = Phaser.Utils.Array.GetRandom(fighters);
      event.x = Phaser.Math.Clamp((near?.x ?? 640) + Phaser.Math.Between(-120, 120), WALLS.left + width / 2, WALLS.right - width / 2);
      event.pit = this.add(this.scene.add.ellipse(event.x, FLOOR + 4, width, 44, 0xb07a2a).setStrokeStyle(6, 0x5c3a10));
      event.swirl = this.add(this.scene.add.ellipse(event.x, FLOOR + 4, width * 0.55, 20, 0x7a5218).setStrokeStyle(3, 0xe8c27a));
      popText(this.scene, event.x, FLOOR - 140, '¡Arenas movedizas!', '#ffd08a');
      say('¡Arenas movedizas!');
    }
    const ready = event.t > warnMs;
    // Primero tiembla chiquita (el aviso) y luego se abre.
    const k = ready ? 1 : 0.35 + 0.15 * Math.sin(event.t / 60);
    event.pit.setScale(k, 1);
    event.swirl.setScale(k, 1).setAngle(event.t / 8);
    if (ready) {
      for (const f of fighters) {
        if (f.koed || !f.grounded || Math.abs(f.x - event.x) > width / 2) continue;
        // Se hunde mientras esté encima (y un poquito después de salirse).
        f.sandMs = 200;
      }
    }
    if (event.t > warnMs + ms - 500) event.pit.setAlpha((warnMs + ms - event.t) / 500);
    return event.t < warnMs + ms;
  }

  // --- Nave espacial: la compuerta se abre y casi no hay gravedad ---
  zerog(event, dtMs, fighters) {
    const { warnMs, ms, gravity, lift } = this.spec;
    const { width, height } = this.scene.scale;
    if (!event.light) {
      event.light = this.add(this.scene.add.rectangle(width / 2, height / 2, width, height, 0xff3040, 0));
      popText(this.scene, width / 2, 200, '¡Compuerta abierta! ¡Sin gravedad!', '#ff9aa8');
      say('¡Compuerta abierta! ¡Sin gravedad!');
      sfx.laser();
    }
    // La luz roja de alarma parpadea mientras avisa.
    event.light.setFillStyle(0xff3040, event.t < warnMs ? 0.18 * Math.abs(Math.sin(event.t / 120)) : 0.06);
    if (event.t >= warnMs && !event.floating) {
      event.floating = new Map();
      for (const f of fighters) {
        event.floating.set(f, f.gravity);
        f.gravity *= gravity;
        // Los que están parados se despegan del piso.
        if (f.grounded && !f.koed) f.vy = -lift;
      }
      event.undo = (list) => {
        for (const f of list) if (event.floating.has(f)) f.gravity = event.floating.get(f);
      };
      sfx.transform();
    }
    return event.t < warnMs + ms;
  }

  // --- Arrecife: corriente ---
  current(event, dtMs, fighters) {
    const { warnMs, ms, push } = this.spec;
    const { width } = this.scene.scale;
    if (!event.dir) {
      event.dir = Math.random() < 0.5 ? -1 : 1;
      popText(this.scene, width / 2, 220, event.dir > 0 ? '¡Corriente! ➡️' : '⬅️ ¡Corriente!', '#9fe3ff');
      say('¡Corriente!');
      event.streaks = Array.from({ length: 14 }, () => this.add(this.scene.add.ellipse(0, 0, 90, 10, 0xdff4ff, 0)));
    }
    const pushing = event.t > warnMs;
    for (const [i, streak] of event.streaks.entries()) {
      const x = ((event.t * 0.9 + i * 170) % (width + 200)) - 100;
      streak.setPosition(event.dir > 0 ? x : width - x, FLOOR - 40 - (i % 7) * 70).setFillStyle(0xdff4ff, pushing ? 0.5 : 0.15);
    }
    if (pushing) {
      for (const f of fighters) {
        if (f.koed || f.celebrating) continue;
        f.x += event.dir * push * (f.blocking ? 0.35 : 1) * (dtMs / 1000);
      }
    }
    return event.t < warnMs + ms;
  }

  destroy(fighters = []) {
    this.finish(fighters);
    this.root.destroy();
  }
}

// --- Los dibujos (si no hay imagen de Gemini): encima del cielo y el piso que pinta arenas.js ---

// Pirámide del desierto: el sol, dunas, tres pirámides y palmeras.
export function drawDesert(scene, layer, floorY) {
  const parts = [scene.add.circle(1080, 140, 80, 0xfff1b8, 0.95)];
  for (const [x, size, color] of [
    [260, 300, 0xd9a85a],
    [620, 420, 0xe8b868],
    [980, 260, 0xd9a85a],
  ]) {
    parts.push(
      scene.add
        .triangle(x, floorY - 40, 0, size * 0.8, size / 2, 0, size, size * 0.8, color)
        .setOrigin(0.5, 1)
        .setStrokeStyle(4, 0x8b6a2b),
    );
    parts.push(scene.add.triangle(x + size * 0.12, floorY - 40, 0, size * 0.8, size * 0.38, 0, size * 0.38, size * 0.8, 0x000000, 0.12).setOrigin(0.5, 1));
  }
  for (const x of [120, 1160]) {
    parts.push(scene.add.rectangle(x, floorY - 120, 18, 170, 0x8b5a2b).setAngle(x < 640 ? 6 : -6));
    for (let k = 0; k < 5; k += 1)
      parts.push(scene.add.ellipse(x + (k - 2) * 26, floorY - 210 + Math.abs(k - 2) * 10, 90, 26, 0x3f9a3a).setAngle((k - 2) * 25));
  }
  parts.push(scene.add.ellipse(400, floorY - 30, 700, 80, 0xf2d27a), scene.add.ellipse(1000, floorY - 26, 600, 70, 0xf2d27a));
  layer.add(parts);
}

// Nave espacial: paredes de metal, ventanas redondas con estrellas y la compuerta (con rayas de aviso) a un lado.
export function drawSpaceship(scene, layer, floorY) {
  const parts = [scene.add.rectangle(640, floorY / 2, 1280, floorY, 0x2a3450)];
  for (let x = 0; x <= 1280; x += 160) parts.push(scene.add.rectangle(x, floorY / 2, 8, floorY, 0x3a4668));
  for (const x of [320, 640, 960]) {
    parts.push(scene.add.circle(x, 230, 78, 0x0b0b24).setStrokeStyle(12, 0x8a96b0));
    for (let k = 0; k < 6; k += 1) parts.push(scene.add.circle(x - 50 + ((k * 37) % 100), 190 + ((k * 53) % 90), 2 + (k % 2), 0xffffff));
  }
  parts.push(scene.add.rectangle(1190, floorY - 170, 150, 300, 0x5a6478).setStrokeStyle(6, 0x1b1530));
  for (let y = floorY - 300; y < floorY - 30; y += 44) parts.push(scene.add.rectangle(1190, y, 150, 18, 0xffd02a).setAngle(-12));
  parts.push(scene.add.rectangle(1190, floorY - 340, 40, 16, 0xff3040).setStrokeStyle(3, 0x1b1530));
  layer.add(parts);
}

// Arrecife: rayos de luz desde arriba, corales de colores y algas.
export function drawReef(scene, layer, floorY) {
  const parts = [];
  for (const x of [200, 520, 860, 1140]) parts.push(scene.add.triangle(x, 0, -60, 0, 60, 0, 140, floorY, 0xffffff, 0.08).setOrigin(0.5, 0));
  for (const [x, color] of [
    [150, 0xff7a8a],
    [420, 0xffb04a],
    [760, 0xb07cff],
    [1100, 0xff7a8a],
  ]) {
    for (let k = -1; k <= 1; k += 1)
      parts.push(
        scene.add
          .rectangle(x + k * 26, floorY - 70 - Math.abs(k) * -20, 20, 120 - Math.abs(k) * 30, color)
          .setRounded(10)
          .setAngle(k * 18),
      );
  }
  for (const x of [300, 640, 980]) {
    for (let k = 0; k < 3; k += 1) parts.push(scene.add.ellipse(x + k * 14, floorY - 60 - k * 50, 22, 70, 0x3f9a5a).setAngle(k % 2 ? 12 : -12));
  }
  layer.add(parts);
}
