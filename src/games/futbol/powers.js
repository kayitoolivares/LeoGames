import Phaser from 'phaser';
import { sfx } from '../../shared/sound.js';
import { textStyle } from '../../ui/style.js';
import manifest from './art.json';
import { GOAL, GOAL_HEIGHT } from './field.js';

// Poderes en la cancha: de vez en cuando aparece una cajita flotando; el que la toca (o le pega con el balón)
// se lleva el poder para su equipo. Los dibujos son de Gemini (futbol/poderes/<nombre>.png); si no están,
// sale el emoji.
export const POWERS = {
  'balon-gigante': { name: '¡Balón gigante!', emoji: '⚽', ms: 8000 },
  'porteria-chica': { name: '¡Portería chiquita!', emoji: '🥅', ms: 9000 },
  iman: { name: '¡Imán!', emoji: '🧲', ms: 7000 },
  hielo: { name: '¡Congelados!', emoji: '🧊', ms: 2600 },
  tenis: { name: '¡Tenis veloces!', emoji: '👟', ms: 8000 },
};
const KINDS = Object.keys(POWERS);
const SPAWN_MS = [7000, 12000];
const BOX_RADIUS = 34;
const BOX_HEIGHTS = [560, 500, 440];
const GIANT_SCALE = 1.7;
const SMALL_GOAL = 125;
// El imán jala el balón hacia los pies del que lo tiene (si está cerca); al patear lo suelta un ratito.
const MAGNET_RANGE = 320;
const MAGNET_PULL = 7;
const MAGNET_PAUSE_MS = 700;
const DEPTH = 650;

export function loadPowerArt(scene) {
  for (const name of manifest.poderes ?? []) {
    const key = `futbol:poder-${name}`;
    if (!scene.textures.exists(key)) scene.load.image(key, `futbol/poderes/${name}.png`);
  }
}

// El ícono de un poder (dibujo o emoji) de `size` pixeles.
export function powerIcon(scene, kind, x, y, size) {
  const key = `futbol:poder-${kind}`;
  if (scene.textures.exists(key)) {
    const image = scene.add.image(x, y, key);
    return image.setScale(size / Math.max(image.width, image.height));
  }
  return scene.add.text(x, y, POWERS[kind].emoji, textStyle(Math.round(size * 0.8), '#ffffff')).setOrigin(0.5);
}

export class Powers {
  // `scene` necesita: team, ball, redrawGoals(), powerTaken(kind, team, player).
  constructor(scene) {
    this.scene = scene;
    this.box = null;
    this.active = [];
    this.enabled = true;
    this.spawnMs = Phaser.Math.Between(...SPAWN_MS);
  }

  // Quita la cajita y termina todos los poderes (en cada saque).
  clear() {
    this.box?.root.destroy();
    this.box = null;
    for (const effect of this.active) this.finish(effect);
    this.active = [];
    this.spawnMs = Phaser.Math.Between(...SPAWN_MS);
  }

  update(dtMs) {
    if (!this.enabled) return;
    this.active = this.active.filter((effect) => {
      effect.ms -= dtMs;
      if (effect.ms > 0) {
        if (effect.kind === 'iman') this.pull(effect, dtMs);
        return true;
      }
      this.finish(effect);
      return false;
    });
    if (!this.box) {
      this.spawnMs -= dtMs;
      if (this.spawnMs <= 0) this.spawn();
      return;
    }
    const box = this.box;
    box.time += dtMs / 1000;
    box.root.y = box.y + Math.sin(box.time * 3) * 10;
    box.root.angle = Math.sin(box.time * 2) * 8;
    const { ball } = this.scene;
    for (const player of this.scene.team) {
      if (!player.blob.visible) continue;
      if (Math.hypot(player.x - box.x, player.y - box.root.y) < player.radius + BOX_RADIUS) {
        this.take(player.team, player);
        return;
      }
    }
    if (ball.lastTouch && Math.hypot(ball.x - box.x, ball.y - box.root.y) < ball.radius + BOX_RADIUS) this.take(ball.lastTouch.team, ball.lastTouch);
  }

  spawn() {
    const kind = Phaser.Utils.Array.GetRandom(KINDS);
    const x = Phaser.Math.Between(320, 960);
    const y = Phaser.Utils.Array.GetRandom(BOX_HEIGHTS);
    const root = this.scene.add.container(x, y).setDepth(DEPTH).setScale(0);
    root.add(this.scene.add.circle(0, 0, BOX_RADIUS + 6, 0xffffff, 0.35).setStrokeStyle(4, 0xffd84d));
    root.add(this.scene.add.circle(0, 0, BOX_RADIUS, 0x14112b, 0.75));
    root.add(powerIcon(this.scene, kind, 0, 0, BOX_RADIUS * 1.7));
    this.scene.tweens.add({ targets: root, scale: 1, duration: 260, ease: 'Back.easeOut' });
    this.box = { kind, x, y, root, time: 0 };
    sfx.pickup();
  }

  take(team, player) {
    const { kind, root } = this.box;
    this.box = null;
    this.scene.tweens.add({ targets: root, scale: 1.8, alpha: 0, duration: 220, onComplete: () => root.destroy() });
    this.spawnMs = Phaser.Math.Between(...SPAWN_MS);
    // El mismo poder otra vez solo alarga el que ya estaba.
    const same = this.active.find((effect) => effect.kind === kind && effect.team === team);
    if (same) {
      same.ms = POWERS[kind].ms;
      same.player = player;
    } else {
      const effect = { kind, team, player, ms: POWERS[kind].ms, pauseMs: 0 };
      this.active.push(effect);
      this.start(effect);
    }
    sfx.sparkle();
    this.scene.powerTaken?.(kind, team, player);
  }

  start(effect) {
    const { scene } = this;
    const rivals = scene.team.filter((p) => p.team !== effect.team);
    if (effect.kind === 'balon-gigante') scene.ball.setScale(GIANT_SCALE);
    else if (effect.kind === 'porteria-chica') {
      GOAL_HEIGHT[1 - effect.team] = SMALL_GOAL;
      scene.redrawGoals();
    } else if (effect.kind === 'hielo') for (const p of rivals) p.freeze(POWERS.hielo.ms);
    else if (effect.kind === 'tenis') for (const p of scene.team) if (p.team === effect.team) p.shoesMs = POWERS.tenis.ms;
  }

  finish(effect) {
    const { scene } = this;
    if (effect.kind === 'balon-gigante') scene.ball.setScale(1);
    else if (effect.kind === 'porteria-chica') {
      GOAL_HEIGHT[1 - effect.team] = GOAL.height;
      scene.redrawGoals();
    } else if (effect.kind === 'hielo') for (const p of scene.team) if (p.team !== effect.team) p.frozenMs = 0;
    else if (effect.kind === 'tenis') for (const p of scene.team) if (p.team === effect.team) p.shoesMs = 0;
  }

  // Imán: si el balón anda cerca y bajito, se va hacia los pies del que lo agarró.
  pull(effect, dtMs) {
    const { player } = effect;
    const { ball } = this.scene;
    if (player.kickMs > 0) effect.pauseMs = MAGNET_PAUSE_MS;
    effect.pauseMs = Math.max(0, effect.pauseMs - dtMs);
    if (effect.pauseMs > 0 || ball.special || player.busy) return;
    const targetX = player.x + player.facing * (player.radius + ball.radius + 4);
    const dx = targetX - ball.x;
    if (Math.abs(dx) > MAGNET_RANGE || ball.y < player.y - 140) return;
    const dt = dtMs / 1000;
    ball.vx += (dx * MAGNET_PULL - (ball.vx - player.vx)) * dt * 4;
  }

  // Los poderes que trae un equipo ahorita (para el marcador).
  activeFor(team) {
    return this.active.filter((effect) => effect.team === team);
  }
}
