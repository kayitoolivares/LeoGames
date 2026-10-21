import Phaser from 'phaser';
import { say } from '../../shared/voice.js';
import { textStyle } from '../../ui/style.js';
import dueloArt from '../duelo/art.json';
import { TEAM_COLORS } from './field.js';

// El ambiente del partido: el público de enfrente (los fans del Duelo, con banderitas de cada equipo) que
// hace la ola y brinca con los goles, y el narrador que dice lo que pasa (con letrero, para quien no oye).
const FANS = 16;
const FAN_HEIGHT = 96;
const FAN_DEPTH = 800;
const WAVE_SPEED = 950;
const WAVE_WIDTH = 120;
const WAVE_LIFT = 34;
const CHEER_LIFT = 22;
const NARRATOR_GAP_MS = 2600;
const CAPTION_MS = 2300;

export class Crowd {
  constructor(scene) {
    this.scene = scene;
    const { width, height } = scene.scale;
    const art = (dueloArt.publico ?? []).map((name) => `duelo:${name}`).filter((key) => scene.textures.exists(key));
    this.fans = Array.from({ length: FANS }, (_, i) => {
      const x = ((i + 0.5) / FANS) * width;
      const baseY = height + FAN_HEIGHT * 0.45 + (i % 2) * 8;
      const fan = scene.add.container(x, baseY).setDepth(FAN_DEPTH);
      const team = x < width / 2 ? 0 : 1;
      // Banderita del equipo al que le van (atrás del fan).
      const flag = scene.add.container(i % 2 ? -26 : 26, -FAN_HEIGHT * 0.8);
      flag.add(scene.add.rectangle(0, 18, 4, 46, 0x5a4a3a));
      flag.add(scene.add.rectangle(i % 2 ? -14 : 14, 0, 28, 20, TEAM_COLORS[team]).setStrokeStyle(2, 0x1b1530));
      fan.add(flag);
      if (art.length) {
        const image = scene.add.image(0, 0, art[i % art.length]).setOrigin(0.5, 1).setFlipX(team === 1);
        image.setScale(FAN_HEIGHT / image.height);
        fan.add(image);
      } else {
        const r = FAN_HEIGHT * 0.3;
        fan.add(scene.add.circle(0, -r - 6, r, Phaser.Display.Color.HSVToRGB(i / FANS, 0.6, 0.95).color).setStrokeStyle(4, 0x1b1530));
      }
      return { fan, flag, team, baseY, phase: Math.random() * 6 };
    });
    this.waveX = null;
    this.waveDir = 1;
    this.cheerMs = 0;
    this.time = 0;
    this.nextWaveMs = 12000;
  }

  // Las banderas cambian si cambian los uniformes.
  recolor() {
    for (const f of this.fans) f.flag.list[1].setFillStyle(TEAM_COLORS[f.team]);
  }

  wave(dir = Math.random() < 0.5 ? 1 : -1) {
    const { width } = this.scene.scale;
    this.waveDir = dir;
    this.waveX = dir > 0 ? -WAVE_WIDTH : width + WAVE_WIDTH;
  }

  // Todos brincan (con `team`, solo los de ese equipo).
  cheer(ms = 1600, team = null) {
    this.cheerMs = ms;
    this.cheerTeam = team;
  }

  update(dtMs) {
    const dt = dtMs / 1000;
    const { width } = this.scene.scale;
    this.time += dt;
    this.cheerMs = Math.max(0, this.cheerMs - dtMs);
    this.nextWaveMs -= dtMs;
    if (this.nextWaveMs <= 0) {
      this.nextWaveMs = Phaser.Math.Between(14000, 22000);
      this.wave();
    }
    if (this.waveX !== null) {
      this.waveX += this.waveDir * WAVE_SPEED * dt;
      if (this.waveX < -WAVE_WIDTH * 2 || this.waveX > width + WAVE_WIDTH * 2) this.waveX = null;
    }
    for (const f of this.fans) {
      let lift = Math.abs(Math.sin(this.time * 2.5 + f.phase)) * 4;
      if (this.waveX !== null) lift = Math.max(lift, WAVE_LIFT * Math.max(0, 1 - Math.abs(f.fan.x - this.waveX) / WAVE_WIDTH));
      const cheering = this.cheerMs > 0 && (this.cheerTeam === null || this.cheerTeam === f.team);
      if (cheering) lift = Math.max(lift, Math.abs(Math.sin(this.time * 12 + f.phase)) * CHEER_LIFT + 8);
      f.fan.y = f.baseY - lift;
      f.flag.angle = cheering || lift > 10 ? Math.sin(this.time * 14 + f.phase) * 25 : Math.sin(this.time * 2 + f.phase) * 6;
    }
  }
}

// El narrador: dice frases cortas (con la voz del juego) y las pone en un letrero arriba. Para no
// amontonar, las frases normales esperan un ratito entre una y otra; las importantes (goles) siempre entran.
export class Narrator {
  constructor(scene, y, depth) {
    this.scene = scene;
    this.waitMs = 0;
    this.captionMs = 0;
    this.caption = scene.add
      .text(scene.scale.width / 2, y, '', textStyle(22, '#ffffff', { fontStyle: 'bold', backgroundColor: '#14112bcc', padding: { x: 14, y: 6 } }))
      .setOrigin(0.5)
      .setDepth(depth)
      .setAlpha(0);
  }

  // `lines`: una frase o varias (escoge una al azar).
  line(lines, { important = false } = {}) {
    if (!important && this.waitMs > 0) return;
    const text = Array.isArray(lines) ? Phaser.Utils.Array.GetRandom(lines) : lines;
    this.waitMs = NARRATOR_GAP_MS;
    this.captionMs = CAPTION_MS;
    this.caption.setText(`🎙️ ${text}`).setAlpha(1);
    say(text, { interrupt: important });
  }

  update(dtMs) {
    this.waitMs = Math.max(0, this.waitMs - dtMs);
    if (this.captionMs > 0) {
      this.captionMs -= dtMs;
      if (this.captionMs <= 0) this.caption.setAlpha(0);
    }
  }

  hide() {
    this.captionMs = 0;
    this.caption.setAlpha(0);
  }
}
