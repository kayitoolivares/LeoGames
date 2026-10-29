import Phaser from 'phaser';
import manifest from './art.json';
import { FLOOR, WALLS } from './DueloFighter.js';

// Escenarios vivos: lo que se mueve encima del fondo. Público a los lados (brinca cuando hay golpes y festeja
// el K.O.), cosas que caen o flotan (pétalos, hojas, chispas de lava, confeti, brillitos) y, en la lucha libre,
// reflectores de colores. Todo detrás de los peleadores y con pocas piezas, para que el Xbox no se trabe.
const DEPTH = -50;
const FANS_PER_SIDE = 3;
const FAN_HEIGHT = 92;
const AMBIENT_COUNT = 26;
// Cómo es cada cosa que flota: colores, tamaño, hacia dónde va (vy < 0 = sube) y si brilla.
const AMBIENTS = {
  petals: { colors: [0xffb7d5, 0xff8fbf, 0xffd6e8], size: [7, 12], vy: [40, 80], sway: 60, shape: 'petal' },
  leaves: { colors: [0x6cc24a, 0xa3d65c, 0xe0a23a], size: [8, 13], vy: [50, 90], sway: 70, shape: 'petal' },
  pollen: { colors: [0xfff3a8, 0xffffff], size: [3, 6], vy: [-15, 15], sway: 40, shape: 'dot' },
  embers: { colors: [0xff9a3c, 0xffd84d, 0xff5a3c], size: [3, 6], vy: [-90, -40], sway: 30, shape: 'dot', glow: true },
  confetti: { colors: [0xff5a5f, 0xffd84d, 0x3fa7ff, 0x4cd97b, 0xb07cff], size: [6, 10], vy: [60, 110], sway: 50, shape: 'square' },
  sparkles: { colors: [0xffffff, 0xfff3a8, 0x9fe3ff], size: [3, 5], vy: [-5, 5], sway: 0, shape: 'dot', glow: true, twinkle: true },
  snow: { colors: [0xffffff, 0xe8f4ff], size: [4, 8], vy: [40, 80], sway: 40, shape: 'dot' },
  crystals: { colors: [0xd36bff, 0x6fd8ff, 0xff8fe0], size: [3, 6], vy: [-30, -10], sway: 20, shape: 'dot', glow: true, twinkle: true },
  // Los de las arenas nuevas: arenita que vuela (Pirámide) y burbujas que suben (Arrecife).
  sand: { colors: [0xf2d27a, 0xe8c27a, 0xfff0c0], size: [3, 5], vy: [-8, 8], sway: 90, shape: 'dot' },
  bubbles: { colors: [0xdff4ff, 0xffffff], size: [5, 11], vy: [-70, -35], sway: 25, shape: 'dot' },
};
// Lo que cae en algunos escenarios: primero una sombra avisa dónde, luego cae y al que le pegue lo tumba.
const HAZARDS = {
  coconut: { everyMs: [5000, 9000], warnMs: 1100, fallMs: 380, damage: 7, size: 26 },
  crystal: { everyMs: [4500, 8000], warnMs: 1000, fallMs: 340, damage: 8, size: 30 },
};
const LIGHT_COLORS = [0xff5a5f, 0x3fa7ff, 0xffd84d, 0x4cd97b];
const FAN_COLORS = [0xe53935, 0x3a5bd6, 0xffd02a, 0xff8a1e, 0x8158d8, 0x8b5a3c];

export function loadStageArt(scene) {
  for (const name of manifest.publico ?? []) {
    const key = `duelo:${name}`;
    if (!scene.textures.exists(key)) scene.load.image(key, `duelo/publico/${name}.png`);
  }
}

export class StageLife {
  // `arena`: los datos del escenario (arenas.js): { ambient, crowd, lights }.
  constructor(scene, arena) {
    this.scene = scene;
    this.root = scene.add.container(0, 0).setDepth(DEPTH);
    this.fans = arena.crowd ? this.makeCrowd() : [];
    this.lights = arena.lights ? this.makeLights() : [];
    this.style = AMBIENTS[arena.ambient] ?? null;
    this.bits = this.style ? Array.from({ length: AMBIENT_COUNT }, () => this.makeBit(true)) : [];
    this.cheerMs = 0;
    this.time = 0;
    this.hazard = HAZARDS[arena.hazard] ? { kind: arena.hazard, ...HAZARDS[arena.hazard] } : null;
    this.falling = [];
    this.nextFallMs = this.hazard ? Phaser.Math.Between(...this.hazard.everyMs) : Infinity;
  }

  // Cocos o cristales que caen (solo mientras pelean). `onHit(fighter, damage)` cuando le pegan a alguien.
  updateHazards(dtMs, fighters, onHit) {
    if (!this.hazard) return;
    const h = this.hazard;
    this.nextFallMs -= dtMs;
    if (this.nextFallMs <= 0) {
      this.nextFallMs = Phaser.Math.Between(...h.everyMs);
      // Casi siempre cerca de alguien, para que haya que moverse.
      const near = Phaser.Utils.Array.GetRandom(fighters);
      const x = Phaser.Math.Clamp((near?.x ?? 640) + Phaser.Math.Between(-140, 140), WALLS.left + 60, WALLS.right - 60);
      const shadow = this.scene.add.ellipse(x, FLOOR - 4, 20, 8, 0x000000, 0.35).setDepth(90);
      const rock = this.drawFalling(h.kind, h.size).setPosition(x, -60).setDepth(160).setVisible(false);
      this.falling.push({ x, ms: 0, shadow, rock });
    }
    this.falling = this.falling.filter((f) => {
      f.ms += dtMs;
      const k = Math.min(1, f.ms / h.warnMs);
      f.shadow.setSize(20 + k * h.size * 2.2, 8 + k * 10);
      if (f.ms < h.warnMs) return true;
      const t = Math.min(1, (f.ms - h.warnMs) / h.fallMs);
      f.rock.setVisible(true).setY(-60 + (FLOOR - h.size + 60) * t).setAngle(f.ms * 0.4);
      if (t < 1) return true;
      for (const fighter of fighters) {
        const box = fighter.hurtbox;
        if (f.x > box.left - h.size && f.x < box.right + h.size && box.bottom > FLOOR - 10) onHit(fighter, h.damage, f.x);
      }
      this.scene.poof?.(f.x, FLOOR - h.size);
      f.shadow.destroy();
      f.rock.destroy();
      return false;
    });
  }

  drawFalling(kind, size) {
    const c = this.scene.add.container(0, 0);
    if (kind === 'coconut') {
      c.add(this.scene.add.circle(0, 0, size, 0x7a4a2a).setStrokeStyle(4, 0x1b1530));
      for (const [x, y] of [[-6, -8], [6, -8], [0, 2]]) c.add(this.scene.add.circle(x, y, 4, 0x3a2414));
    } else {
      c.add(this.scene.add.triangle(0, 0, -size * 0.6, -size, size * 0.6, -size, 0, size * 1.2, 0xb07cff).setStrokeStyle(4, 0x1b1530));
      c.add(this.scene.add.triangle(-4, -6, -size * 0.2, -size * 0.8, size * 0.1, -size * 0.8, -4, size * 0.4, 0xffffff, 0.6));
    }
    return c;
  }

  clearHazards() {
    for (const f of this.falling) {
      f.shadow.destroy();
      f.rock.destroy();
    }
    this.falling = [];
  }

  // Tres de cada lado, en el piso, junto a las orillas (los peleadores pasan por enfrente).
  makeCrowd() {
    const fans = [];
    const art = (manifest.publico ?? []).map((name) => `duelo:${name}`).filter((key) => this.scene.textures.exists(key));
    for (let i = 0; i < FANS_PER_SIDE * 2; i += 1) {
      const left = i < FANS_PER_SIDE;
      const k = i % FANS_PER_SIDE;
      const x = left ? WALLS.left + 10 + k * 62 : WALLS.right - 10 - k * 62;
      const y = FLOOR - 8 - (k % 2) * 26;
      const fan = this.scene.add.container(x, y);
      if (art.length) {
        const image = this.scene.add.image(0, 0, art[i % art.length]).setOrigin(0.5, 1).setFlipX(!left);
        image.setScale(FAN_HEIGHT / image.height);
        fan.add(image);
      } else {
        fan.add(drawFan(this.scene, FAN_COLORS[i % FAN_COLORS.length], left ? 1 : -1));
      }
      fan.setScale(1 - k * 0.12);
      this.root.add(fan);
      fans.push({ fan, baseY: y, phase: Math.random() * 6 });
    }
    return fans;
  }

  // Reflectores: rayos de luz de colores que bajan del techo y se mueven de lado a lado.
  makeLights() {
    const { width } = this.scene.scale;
    return LIGHT_COLORS.map((color, i) => {
      const beam = this.scene.add.triangle(0, 0, 0, 0, -130, 620, 130, 620, color, 0.16).setBlendMode(Phaser.BlendModes.ADD);
      beam.setPosition(((i + 0.5) / LIGHT_COLORS.length) * width, -10);
      beam.setOrigin(0.5, 0);
      this.root.add(beam);
      return { beam, phase: i * 1.7 };
    });
  }

  makeBit(anywhere) {
    const s = this.style;
    const { width, height } = this.scene.scale;
    const size = Phaser.Math.FloatBetween(...s.size);
    const color = Phaser.Utils.Array.GetRandom(s.colors);
    let bit;
    if (s.shape === 'petal') bit = this.scene.add.ellipse(0, 0, size * 1.6, size, color, 0.9);
    else if (s.shape === 'square') bit = this.scene.add.rectangle(0, 0, size, size * 1.4, color);
    else bit = this.scene.add.circle(0, 0, size / 2, color, 0.9);
    if (s.glow) bit.setBlendMode(Phaser.BlendModes.ADD);
    const vy = Phaser.Math.FloatBetween(...s.vy);
    const x = Math.random() * width;
    // Los que caen salen de arriba; los que suben, de abajo; los que flotan, de cualquier lado.
    const y = anywhere ? Math.random() * FLOOR : vy > 0 ? -20 : vy < 0 ? FLOOR + 10 : Math.random() * FLOOR;
    bit.setPosition(x, y);
    this.root.add(bit);
    return { bit, vy, phase: Math.random() * 6, spin: Phaser.Math.FloatBetween(-3, 3), height };
  }

  // Brinquitos del público (más fuertes con `strength` alto).
  cheer(strength = 0.5) {
    this.cheerMs = Math.max(this.cheerMs, 300 + strength * 900);
  }

  update(dtMs) {
    const dt = dtMs / 1000;
    this.time += dt;
    this.cheerMs = Math.max(0, this.cheerMs - dtMs);
    const jump = this.cheerMs > 0 ? 26 : 5;
    const speed = this.cheerMs > 0 ? 12 : 3;
    for (const f of this.fans) f.fan.y = f.baseY - Math.abs(Math.sin(this.time * speed + f.phase)) * jump;
    for (const l of this.lights) l.beam.setAngle(Math.sin(this.time * 0.8 + l.phase) * 25);
    const s = this.style;
    this.bits = this.bits.map((b) => {
      b.bit.y += b.vy * dt;
      b.bit.x += Math.sin(this.time * 1.5 + b.phase) * (s.sway ?? 0) * dt;
      b.bit.rotation += b.spin * dt;
      if (s.twinkle) b.bit.setAlpha(0.3 + 0.7 * Math.abs(Math.sin(this.time * 2 + b.phase)));
      const gone = b.vy > 0 ? b.bit.y > FLOOR + 20 : b.vy < 0 ? b.bit.y < -20 : false;
      if (!gone) return b;
      b.bit.destroy();
      return this.makeBit(false);
    });
  }

  destroy() {
    this.clearHazards();
    this.root.destroy();
  }
}

// Un fan dibujado (mientras no haya dibujo de Gemini): bolita de color con ojos, boca abierta y brazos arriba.
function drawFan(scene, color, facing) {
  const g = scene.add.graphics();
  const r = FAN_HEIGHT * 0.32;
  const cy = -r - 4;
  g.lineStyle(6, 0x1b1530, 1);
  g.lineBetween(-r * 0.8, cy - r * 0.2, -r * 1.25, cy - r * 1.2);
  g.lineBetween(r * 0.8, cy - r * 0.2, r * 1.25, cy - r * 1.2);
  g.fillStyle(color, 1).fillCircle(0, cy, r);
  g.lineStyle(4, 0x1b1530, 1).strokeCircle(0, cy, r);
  g.fillStyle(0xffffff, 1).fillCircle(facing * r * 0.25 - r * 0.25, cy - r * 0.2, r * 0.22).fillCircle(facing * r * 0.25 + r * 0.25, cy - r * 0.2, r * 0.22);
  g.fillStyle(0x1b1530, 1).fillCircle(facing * r * 0.32 - r * 0.25, cy - r * 0.2, r * 0.1).fillCircle(facing * r * 0.32 + r * 0.25, cy - r * 0.2, r * 0.1);
  g.fillStyle(0x1b1530, 1).fillEllipse(facing * r * 0.25, cy + r * 0.35, r * 0.4, r * 0.28);
  return g;
}
