import Phaser from 'phaser';
import { sfx } from '../../shared/sound.js';
import { textStyle } from '../../ui/style.js';
import { burst, popText } from './effects.js';

// Las trampas de cada mundo (desde el segundo tramo). Siempre avisan antes, y también les pegan a los monstruos:
// ¡se vale llevarlos hacia la trampa!
//   spring:    resortes en el piso; el que se para encima sale volando y al caer aplasta a los de alrededor.
//   boulder / snowball / cannon: algo rueda (o sale disparado) por un carril de lado a lado; una flecha avisa.
//   lava / ghostfire / meteor: un charco brilla en el piso y luego arde (o cae un meteorito) un ratito.
//   gum:       charcos de chicle que hacen ir más lento.
const KINDS = {
  spring: { kind: 'pad' },
  gum: { kind: 'gum' },
  boulder: { kind: 'roller', art: 'roca', color: 0x8a8a96, speed: 520, radius: 46, word: '¡Roca!' },
  snowball: { kind: 'roller', color: 0xffffff, speed: 480, radius: 48, word: '¡Bola de nieve!' },
  cannon: { kind: 'roller', color: 0x2a2a36, speed: 820, radius: 22, word: '¡Cañonazo!', shot: true },
  lava: { kind: 'patch', color: 0xff5a2f, glow: 0xffd84d, word: '¡Lava!' },
  ghostfire: { kind: 'patch', color: 0xb07cff, glow: 0xe8d0ff, word: '¡Fuego fantasma!' },
  meteor: { kind: 'patch', color: 0x8a6a5a, glow: 0xff9a3c, word: '¡Meteorito!', falls: true },
};
const EVERY_MS = { first: 5000, min: 6500, extra: 3500 };
const WARN_MS = 1300;
const BURN_MS = 1100;
const PATCH = { rx: 90, ry: 34 };
const PAD = { radius: 30, launch: 900 };
const GUM = { rx: 110, ry: 40, slow: 0.5 };
const HIT = 2;

function propTexture(scene, name) {
  const key = `brawl:objeto-${name}`;
  return scene.textures.exists(key) ? key : null;
}

export class Traps {
  constructor(scene) {
    this.scene = scene;
    this.items = [];
    this.active = [];
    this.type = null;
  }

  // Pone las trampas del mundo en el tramo [left, right] (las fijas: resortes y chicle; las otras salen solas).
  place(type, left, right, top, bottom) {
    this.clear();
    this.type = KINDS[type] ? type : null;
    this.waitMs = EVERY_MS.first;
    this.bounds = { left, right, top, bottom };
    const data = KINDS[this.type];
    if (!data) return;
    if (data.kind === 'pad' || data.kind === 'gum') {
      for (let i = 0; i < 2; i += 1) {
        const x = left + ((i + 1) / 3) * (right - left) + Phaser.Math.Between(-80, 80);
        const y = Phaser.Math.Between(top + 40, bottom - 40);
        const sprite =
          data.kind === 'pad'
            ? this.scene.add.container(x, y, [
                this.scene.add.ellipse(0, 0, PAD.radius * 2.4, PAD.radius, 0xe53935).setStrokeStyle(4, 0x1b1530),
                ...[0, 1, 2].map((k) => this.scene.add.ellipse(0, -10 - k * 9, PAD.radius * 1.6, 10, 0x000000, 0).setStrokeStyle(4, 0xc0c4d0)),
              ])
            : this.scene.add.ellipse(x, y, GUM.rx * 2, GUM.ry * 2, 0xff7ad9, 0.75).setStrokeStyle(4, 0xd94fa8);
        sprite.setDepth(data.kind === 'pad' ? y - 1 : -10);
        this.items.push({ data, x, y, sprite, cooldownMs: 0 });
      }
    }
  }

  clear() {
    for (const item of this.items) item.sprite.destroy();
    for (const a of this.active) a.parts.forEach((p) => p.destroy());
    this.items = [];
    this.active = [];
    this.type = null;
  }

  // `running`: si se está peleando (al terminar la ronda ya no salen trampas nuevas).
  update(dtMs, fighters, monsters, running) {
    const data = KINDS[this.type];
    if (!data) return;
    this.updateFixed(dtMs, fighters, monsters);
    this.active = this.active.filter((a) => this.updateActive(a, dtMs, fighters, monsters));
    if (!running || data.kind === 'pad' || data.kind === 'gum') return;
    this.waitMs -= dtMs;
    if (this.waitMs > 0) return;
    this.waitMs = EVERY_MS.min + Math.random() * EVERY_MS.extra;
    this.start(data, fighters);
  }

  // Resortes y chicle: siempre ahí.
  updateFixed(dtMs, fighters, monsters) {
    for (const item of this.items) {
      item.cooldownMs = Math.max(0, item.cooldownMs - dtMs);
      if (item.data.kind === 'pad') {
        if (item.cooldownMs > 0) continue;
        const f = fighters.find((g) => !g.down && g.z === 0 && Math.abs(g.x - item.x) < PAD.radius + 10 && Math.abs(g.y - item.y) < 24);
        if (!f) continue;
        item.cooldownMs = 600;
        f.vz = PAD.launch;
        f.springSlam = true;
        this.scene.tweens.add({ targets: item.sprite, scaleY: 0.5, duration: 80, yoyo: true });
        sfx.boing();
        popText(this.scene, item.x, item.y - 80, '¡Boing!', '#ffd84d');
      } else {
        const inGum = (o) => ((o.x - item.x) / GUM.rx) ** 2 + ((o.y - item.y) / GUM.ry) ** 2 < 1;
        for (const f of fighters) if (inGum(f) && f.z === 0) f.slowMs = 120;
        for (const m of monsters) if (inGum(m)) m.slowMs = 120;
      }
    }
  }

  start(data, fighters) {
    const { left, right, top, bottom } = this.bounds;
    const alive = fighters.filter((f) => !f.down);
    const target = Phaser.Utils.Array.GetRandom(alive);
    if (data.kind === 'roller') {
      // Por el carril de alguien, de un lado al otro; la flecha avisa de dónde sale.
      const y = target ? target.y : (top + bottom) / 2;
      const dir = Math.random() < 0.5 ? 1 : -1;
      const startX = dir > 0 ? left - 120 : right + 120;
      const arrow = this.scene.add.text(dir > 0 ? left + 40 : right - 40, y - 60, dir > 0 ? '➡️' : '⬅️', textStyle(56)).setOrigin(0.5).setDepth(y + 1);
      const key = data.art ? propTexture(this.scene, data.art) : null;
      const ball = key ? this.scene.add.image(0, 0, key) : this.scene.add.circle(0, 0, data.radius, data.color).setStrokeStyle(5, 0x1b1530);
      if (key) ball.setScale((data.radius * 2.2) / Math.max(ball.width, ball.height));
      const thing = this.scene.add.container(startX, y - data.radius, [ball]).setDepth(y);
      popText(this.scene, arrow.x, y - 110, data.word, '#ffd84d');
      this.active.push({ data, kind: 'roller', t: 0, y, dir, x: startX, arrow, thing, parts: [arrow, thing], hit: new Set() });
      return;
    }
    // Charco (lava, fuego fantasma) o meteorito: donde está alguien.
    const x = target ? target.x : (left + right) / 2;
    const y = target ? target.y : (top + bottom) / 2;
    const glow = this.scene.add.ellipse(x, y, PATCH.rx * 2, PATCH.ry * 2, data.glow, 0.35).setDepth(-5);
    const parts = [glow];
    let rock = null;
    if (data.falls) {
      rock = this.scene.add.circle(x - 200, y - 600, 40, data.color).setStrokeStyle(5, 0x1b1530).setDepth(y + 1);
      parts.push(rock);
    }
    popText(this.scene, x, y - 90, data.word, '#ffd84d');
    this.active.push({ data, kind: 'patch', t: 0, x, y, glow, rock, parts, hit: new Set() });
  }

  updateActive(a, dtMs, fighters, monsters) {
    a.t += dtMs;
    if (a.kind === 'roller') {
      a.arrow.setAlpha(Math.floor(a.t / 150) % 2 ? 1 : 0.3);
      if (a.t < WARN_MS) return true;
      a.arrow.setVisible(false);
      a.x += a.dir * a.data.speed * (dtMs / 1000);
      a.thing.setPosition(a.x, a.y - a.data.radius).setAngle(a.data.shot ? 0 : a.x);
      this.strike(a, fighters, monsters, (o) => Math.abs(o.x - a.x) < a.data.radius + o.radius * 0.6 && Math.abs(o.y - a.y) < 34);
      const { left, right } = this.bounds;
      const done = a.dir > 0 ? a.x > right + 160 : a.x < left - 160;
      if (done) a.parts.forEach((p) => p.destroy());
      return !done;
    }
    // Charco: brilla y late mientras avisa; luego arde un ratito (o cae el meteorito).
    if (a.t < WARN_MS) {
      a.glow.setAlpha(0.2 + 0.3 * Math.abs(Math.sin(a.t / 120)));
      if (a.rock) a.rock.setPosition(a.x - 200 * (1 - a.t / WARN_MS), a.y - 600 * (1 - a.t / WARN_MS));
      return true;
    }
    if (!a.burning) {
      a.burning = true;
      a.glow.setFillStyle(a.data.color, 0.85).setStrokeStyle(4, a.data.glow);
      if (a.rock) {
        a.rock.destroy();
        a.parts = a.parts.filter((p) => p !== a.rock);
        this.scene.cameras.main.shake(150, 0.006);
        burst(this.scene, a.x, a.y - 20, a.data.glow, 14);
      }
      sfx.fire();
    }
    this.strike(a, fighters, monsters, (o) => ((o.x - a.x) / PATCH.rx) ** 2 + ((o.y - a.y) / PATCH.ry) ** 2 < 1);
    if (a.t < WARN_MS + BURN_MS) return true;
    a.parts.forEach((p) => p.destroy());
    return false;
  }

  // Le pega una vez a cada quien que toque (a los jugadores les quita un corazón; a los monstruos, vida).
  strike(a, fighters, monsters, touching) {
    for (const f of fighters) {
      if (a.hit.has(f) || f.down || !touching(f)) continue;
      a.hit.add(f);
      if (f.hurt(a.x)) popText(this.scene, f.x, f.y - 90, a.data.word, '#ff9a3c');
    }
    for (const m of monsters) {
      if (a.hit.has(m) || m.dead || m.grabbedBy || !touching(m)) continue;
      a.hit.add(m);
      m.hurt(a.x, HIT, 1.5);
      burst(this.scene, m.x, m.y - 30, a.data.glow ?? a.data.color, 8);
      this.scene.trapHit?.(m);
    }
  }
}
