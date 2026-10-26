import Phaser from 'phaser';
import { sfx } from '../../shared/sound.js';
import { burst, popText } from '../brawl/effects.js';

// Las sorpresas de cada escenario: cada tanto pasa algo, siempre con aviso antes para que dé tiempo de quitarse.
//   lightning (Castillo): una nube negra se para arriba de alguien y cae un rayo que avienta hacia arriba.
//   wind (Nubes):         sopla viento hacia un lado y empuja a todos (con el escudo no).
//   wave (Barco):         ¡ola! el barco se ladea y todos se resbalan hacia un lado.
//   rocket (Espacio):     una flecha avisa y cruza un cohete de lado a lado.
//   coconuts (Selva):     caen cocos de los árboles; su sombra avisa dónde.
//   blocks (Juguetes):    caen bloques de juguete; aplastan al caer y se quedan un rato como plataformas.
//   bubbles (Mar):        de unas bocas del piso salen burbujas que te suben.
//   ghosts (Casa embrujada): un fantasma cruza flotando en ondas y avienta al que toca.
//   cherries (Pastel):    caen cerezas gigantes; su sombra avisa dónde.
//   plane (Ciudad):       una flecha avisa y cruza un avión de papel gigante.
//   ropes (Ring):         las cuerdas del ring rebotan al que llega a la orilla caminando o brincando bajito.
//   soccer (Cancha):      una flecha avisa y cruza rodando un balón de fútbol gigante.
const EVERY_MS = { first: 9000, min: 11000, extra: 7000 };
// Lo que cruza la pantalla: cómo se ve, qué tan rápido va, qué dice el letrero y cómo pega.
const CROSSERS = {
  ball: {
    label: '¡Balonazo! ⚽',
    color: '#ffffff',
    speed: 1000,
    ground: true,
    roll: true,
    hit: { damage: 12, base: 500, scale: 8, angle: 40 },
    draw: (scene) => {
      const g = scene.add.graphics();
      g.fillStyle(0xffffff, 1);
      g.fillCircle(0, 0, 62);
      g.fillStyle(0x1b1530, 1);
      g.fillCircle(0, 0, 20);
      for (let k = 0; k < 5; k += 1) {
        const angle = (k / 5) * Math.PI * 2 - Math.PI / 2;
        g.fillCircle(Math.cos(angle) * 50, Math.sin(angle) * 50, 12);
      }
      g.lineStyle(5, 0x1b1530, 1);
      g.strokeCircle(0, 0, 62);
      return [g];
    },
  },
  rocket: {
    label: '¡Cohete!',
    color: '#ff9a3c',
    speed: 1500,
    hit: { damage: 14, base: 520, scale: 8, angle: 30 },
    draw: (scene) => [
      scene.add.rectangle(0, 0, 140, 46, 0xe8e8f0).setRounded(20).setStrokeStyle(4, 0x1b1530),
      scene.add.triangle(80, 0, 0, -23, 0, 23, 40, 0, 0xff5a5f).setStrokeStyle(4, 0x1b1530),
      scene.add.circle(20, 0, 12, 0x3fa7ff).setStrokeStyle(3, 0x1b1530),
      scene.add.ellipse(-90, 0, 50, 26, 0xff9a3c),
    ],
  },
  ghost: {
    label: '¡Fantasma! 👻',
    color: '#e8e0ff',
    speed: 650,
    wave: 70,
    hit: { damage: 9, base: 400, scale: 6, angle: 60 },
    draw: (scene) => [
      ...[-36, -12, 12, 36].map((x) => scene.add.circle(x, 40, 16, 0xf4f0ff, 0.9)),
      scene.add.ellipse(0, 0, 110, 100, 0xf4f0ff, 0.9),
      scene.add.ellipse(16, -8, 14, 22, 0x1b1530),
      scene.add.ellipse(40, -8, 14, 22, 0x1b1530),
      scene.add.ellipse(28, 18, 20, 12, 0x1b1530),
    ],
  },
  plane: {
    label: '¡Avión! ✈️',
    color: '#9fd8ff',
    speed: 1300,
    hit: { damage: 12, base: 480, scale: 8, angle: 35 },
    draw: (scene) => [
      scene.add.triangle(0, 0, -80, -30, 80, 0, -80, 30, 0xffffff).setStrokeStyle(4, 0x1b1530),
      scene.add.triangle(0, 8, -80, 0, 70, 0, -50, 26, 0xc8dcf0).setStrokeStyle(3, 0x1b1530),
    ],
  },
};

export class StageEvents {
  constructor(scene, layer, stage, main, platforms) {
    this.scene = scene;
    this.layer = layer;
    this.kind = stage.events ?? null;
    this.main = main;
    this.platforms = platforms;
    this.blast = stage.blast;
    this.waitMs = EVERY_MS.first;
    this.active = null;
    this.count = 0;
    if (this.kind === 'bubbles') this.vents = [main.left + 200, (main.left + main.right) / 2, main.right - 200].map((x) => this.vent(x));
    if (this.kind === 'ropes') this.drawRopes();
  }

  // `fighting`: si se está peleando (al terminar, lo que iba termina pero no empieza otra cosa).
  update(dtMs, fighters, fighting) {
    if (!this.kind) return;
    // Las cuerdas no son una sorpresa: siempre están.
    if (this.kind === 'ropes') {
      this.ropes(dtMs, fighters);
      return;
    }
    if (this.active) {
      this.active.t += dtMs;
      if (this[this.kind](this.active, dtMs, fighters) === false) {
        this.active.cleanup?.();
        this.active = null;
      }
      return;
    }
    if (!fighting) return;
    this.waitMs -= dtMs;
    if (this.waitMs > 0) return;
    this.waitMs = EVERY_MS.min + Math.random() * EVERY_MS.extra;
    this.count += 1;
    this.active = { t: 0, hit: new Set(), parts: [] };
    this.active.cleanup = () => this.active.parts.forEach((part) => part.destroy());
  }

  add(part) {
    this.layer.add(part);
    this.active.parts.push(part);
    return part;
  }

  // Le pega a `fighter` (si no lo ha golpeado ya esta sorpresa y no es invencible).
  strike(event, fighter, hit, fromX) {
    if (event.hit.has(fighter) || !fighter.isAlive() || fighter.isInvulnerable()) return;
    event.hit.add(fighter);
    fighter.takeHit({ facing: Math.sign(fighter.x - fromX) || 1, power: 1, x: fromX }, hit);
    burst(this.scene, fighter.x, fighter.y, 0xffffff, 8, this.layer);
    sfx.hit(0.6);
  }

  // --- Castillo: rayo ---
  lightning(event, dtMs, fighters) {
    const WARN = 1500;
    if (!event.x) {
      const alive = fighters.filter((f) => f.isAlive());
      const target = Phaser.Utils.Array.GetRandom(alive);
      event.x = target ? target.x : (this.main.left + this.main.right) / 2;
      event.cloud = this.add(this.scene.add.container(event.x, this.main.top - 520));
      for (const [dx, r] of [[-50, 44], [0, 58], [50, 44], [-20, 40], [30, 42]]) event.cloud.add(this.scene.add.circle(dx, (r % 3) * 6, r, 0x3a3a4a, 0.95));
      event.shadow = this.add(this.scene.add.ellipse(event.x, this.main.top, 150, 24, 0xffd84d, 0.35));
      popText(this.scene, event.x, this.main.top - 600, '¡Rayo!', '#ffd84d', this.layer);
    }
    event.shadow.setAlpha(0.2 + 0.3 * Math.abs(Math.sin(event.t / 90)));
    if (event.t < WARN) return true;
    if (!event.bolt) {
      event.bolt = this.add(this.scene.add.rectangle(event.x, (this.main.top - 480 + this.main.top) / 2, 26, 480, 0xfff6a8).setStrokeStyle(6, 0xffd84d));
      this.scene.cameras.main.flash(120, 255, 250, 200);
      sfx.laser();
      for (const f of fighters) if (Math.abs(f.x - event.x) < 80 && f.y > this.main.top - 520) this.strike(event, f, { damage: 13, base: 520, scale: 7, angle: 85 }, event.x);
    }
    return event.t < WARN + 300;
  }

  // --- Nubes: viento ---
  wind(event, dtMs, fighters) {
    const WARN = 1000;
    const BLOW = 3200;
    if (!event.dir) {
      event.dir = Math.random() < 0.5 ? -1 : 1;
      popText(this.scene, (this.main.left + this.main.right) / 2, this.main.top - 380, event.dir > 0 ? '¡Viento! ➡️' : '⬅️ ¡Viento!', '#ffffff', this.layer);
      event.streaks = Array.from({ length: 14 }, () => this.add(this.scene.add.rectangle(0, 0, 120, 6, 0xffffff, 0)));
    }
    const blowing = event.t > WARN && event.t < WARN + BLOW;
    for (const [i, streak] of event.streaks.entries()) {
      const x = ((event.t * 1.2 + i * 220) % 2400) - 200;
      streak.setPosition(event.dir > 0 ? x : 2000 - x, this.main.top - 520 + (i % 7) * 70).setFillStyle(0xffffff, blowing ? 0.5 : 0.15);
    }
    if (blowing) {
      for (const f of fighters) if (f.isAlive() && !f.shielding && !f.hanging) f.x += event.dir * 230 * (dtMs / 1000);
    }
    return event.t < WARN + BLOW;
  }

  // --- Barco: ola ---
  wave(event, dtMs, fighters) {
    const WARN = 1200;
    const TILT = 3000;
    if (!event.dir) {
      event.dir = Math.random() < 0.5 ? -1 : 1;
      popText(this.scene, (this.main.left + this.main.right) / 2, this.main.top - 350, '¡Ola! 🌊', '#9fd8ff', this.layer);
      sfx.boom();
    }
    const k = Phaser.Math.Clamp((event.t - WARN) / 400, 0, 1) * Phaser.Math.Clamp((WARN + TILT - event.t) / 400, 0, 1);
    this.main.sprite.setAngle(event.dir * 4 * k);
    if (k > 0.5) {
      for (const f of fighters) if (f.isAlive() && f.grounded && f.platform === this.main && !f.shielding) f.x += event.dir * 260 * k * (dtMs / 1000);
    }
    if (event.t >= WARN + TILT) {
      this.main.sprite.setAngle(0);
      return false;
    }
    return true;
  }

  // --- Espacio: cohete, Casa embrujada: fantasma y Ciudad: avión de papel ---
  // Algo cruza la pantalla de lado a lado a cierta altura; una flecha avisa antes por dónde va a salir.
  rocket(event, dtMs, fighters) {
    return this.crosser(event, dtMs, fighters, CROSSERS.rocket);
  }

  ghosts(event, dtMs, fighters) {
    return this.crosser(event, dtMs, fighters, CROSSERS.ghost);
  }

  plane(event, dtMs, fighters) {
    return this.crosser(event, dtMs, fighters, CROSSERS.plane);
  }

  soccer(event, dtMs, fighters) {
    return this.crosser(event, dtMs, fighters, CROSSERS.ball);
  }

  crosser(event, dtMs, fighters, kind) {
    const WARN = 1500;
    if (!event.dir) {
      event.dir = Math.random() < 0.5 ? -1 : 1;
      // (El balón va rodando por el piso; lo demás, a cualquier altura.)
      event.y = kind.ground ? this.main.top - 62 : this.main.top - 60 - Math.random() * 320;
      const edgeX = event.dir > 0 ? this.main.left - 120 : this.main.right + 120;
      event.arrow = this.add(this.scene.add.text(edgeX, event.y, event.dir > 0 ? '➡️' : '⬅️', { fontSize: '64px' }).setOrigin(0.5));
      event.thing = this.add(this.scene.add.container(event.dir > 0 ? this.blast.left : this.blast.right, event.y));
      event.thing.add(kind.draw(this.scene));
      event.thing.setScale(event.dir, 1);
      popText(this.scene, edgeX, event.y - 60, kind.label, kind.color, this.layer);
    }
    event.arrow.setAlpha(Math.floor(event.t / 150) % 2 ? 1 : 0.3);
    if (event.t < WARN) return true;
    event.arrow.setVisible(false);
    event.thing.x += event.dir * kind.speed * (dtMs / 1000);
    if (kind.roll) event.thing.angle += event.dir * kind.speed * (dtMs / 1000) * 0.9;
    // (El fantasma va flotando en ondas.)
    const y = event.y + (kind.wave ? Math.sin(event.t / 260) * kind.wave : 0);
    event.thing.y = y;
    for (const f of fighters) if (Math.abs(f.x - event.thing.x) < 80 && Math.abs(f.y - y) < 60) this.strike(event, f, kind.hit, event.thing.x - event.dir * 100);
    return event.dir > 0 ? event.thing.x < this.blast.right : event.thing.x > this.blast.left;
  }

  // --- Selva: cocos y Juguetes: bloques ---
  // Caen 3 cosas en lugares al azar del escenario; la sombra avisa. Los bloques se quedan un rato como plataformas.
  coconuts(event, dtMs, fighters) {
    return this.drops(event, dtMs, fighters, false);
  }

  // --- Pastel: cerezas (como los cocos) ---
  cherries(event, dtMs, fighters) {
    return this.drops(event, dtMs, fighters, false, true);
  }

  blocks(event, dtMs, fighters) {
    return this.drops(event, dtMs, fighters, true);
  }

  drops(event, dtMs, fighters, blocks, cherries = false) {
    const WARN = 1300;
    const FALL = 450;
    const STAY = 5000;
    if (!event.drops) {
      const width = this.main.right - this.main.left;
      event.drops = [0.2, 0.5, 0.8].map((k, i) => {
        const x = this.main.left + width * (k + (Math.random() - 0.5) * 0.15);
        const size = blocks ? 110 : 54;
        const shadow = this.add(this.scene.add.ellipse(x, this.main.top + 4, size * 1.2, 20, 0x000000, 0.3));
        const colors = [0xe53935, 0xffd02a, 0x3a5bd6];
        let thing;
        if (blocks) thing = this.scene.add.rectangle(x, -400, size, size, colors[i]).setStrokeStyle(5, 0x1b1530);
        else if (cherries) {
          thing = this.scene.add.container(x, -400, [
            this.scene.add.rectangle(4, -size * 0.55, 5, size * 0.6, 0x3f7a2a).setAngle(20),
            this.scene.add.circle(0, 0, size / 2, 0xe0203a).setStrokeStyle(4, 0x7a0a1a),
            this.scene.add.circle(-8, -8, 7, 0xffffff, 0.6),
          ]);
        } else thing = this.scene.add.container(x, -400, [this.scene.add.circle(0, 0, size / 2, 0x7a4a2a).setStrokeStyle(4, 0x3a2414), this.scene.add.circle(-8, -10, 6, 0x3a2414)]);
        this.add(thing);
        return { x, size, shadow, thing, delay: i * 350, landed: false };
      });
      const label = blocks ? '¡Bloques! 🧱' : cherries ? '¡Cerezas! 🍒' : '¡Cocos! 🥥';
      popText(this.scene, (this.main.left + this.main.right) / 2, this.main.top - 380, label, '#ffd84d', this.layer);
    }
    let busy = false;
    for (const d of event.drops) {
      const t = event.t - d.delay;
      const k = Phaser.Math.Clamp((t - WARN) / FALL, 0, 1);
      const bottom = this.main.top - d.size / 2;
      d.shadow.setScale(0.5 + 0.5 * Phaser.Math.Clamp(t / (WARN + FALL), 0, 1));
      d.thing.y = -400 + (bottom + 400) * k * k;
      if (k >= 1 && !d.landed) {
        d.landed = true;
        burst(this.scene, d.x, this.main.top, blocks ? 0xffd02a : cherries ? 0xe0203a : 0x7a4a2a, 10, this.layer);
        sfx.hit(0.7);
        for (const f of fighters) if (Math.abs(f.x - d.x) < d.size / 2 + f.radius && f.y > this.main.top - 200) this.strike(event, f, { damage: 10, base: 360, scale: 6, angle: 60 }, d.x);
        // El bloque se queda como plataforma (se puede subir a él).
        if (blocks) {
          d.platform = { left: d.x - d.size / 2, right: d.x + d.size / 2, top: this.main.top - d.size, soft: true, dx: 0, dy: 0 };
          this.platforms.push(d.platform);
        } else {
          d.thing.setVisible(false);
        }
        d.shadow.setVisible(false);
      }
      if (!blocks && d.landed) continue;
      if (t < WARN + FALL + (blocks ? STAY : 0)) busy = true;
    }
    if (busy) return true;
    // Se acabó: los bloques se van (y con ellos sus plataformas).
    for (const d of event.drops) {
      if (!d.platform) continue;
      this.platforms.splice(this.platforms.indexOf(d.platform), 1);
      for (const f of fighters) {
        if (f.platform !== d.platform) continue;
        f.grounded = false;
        f.platform = null;
      }
    }
    return false;
  }

  // --- Ring: las cuerdas ---
  // Los postes en las esquinas y tres cuerdas (roja, blanca y azul) de poste a poste.
  drawRopes() {
    const { left, right, top } = this.main;
    const RED = 0xe53935;
    for (const x of [left + 8, right - 8]) this.layer.add(this.scene.add.rectangle(x, top - 85, 16, 170, 0xc0c0d0).setStrokeStyle(3, 0x1b1530));
    [[50, RED], [95, 0xffffff], [140, 0x3a5bd6]].forEach(([y, color]) => {
      this.layer.add(this.scene.add.rectangle((left + right) / 2, top - y, right - left - 16, 6, color, 0.9).setStrokeStyle(1, 0x1b1530));
    });
    this.bounced = new Map();
  }

  // El que llega a la orilla del ring hacia afuera (caminando o brincando bajito) rebota hacia adentro.
  ropes(dtMs, fighters) {
    const { left, right, top } = this.main;
    const now = this.scene.time.now;
    for (const f of fighters) {
      if (!f.isAlive() || f.y < top - 170 || f.y > top + 10) continue;
      const out = (f.x < left + 30 && f.vx < -60) || (f.x > right - 30 && f.vx > 60);
      if (!out || now - (this.bounced.get(f) ?? -Infinity) < 400) continue;
      this.bounced.set(f, now);
      f.vx = -Math.sign(f.vx) * Math.max(520, Math.abs(f.vx) * 1.1);
      f.vy = Math.min(f.vy, -380);
      f.grounded = false;
      f.platform = null;
      popText(this.scene, f.x, f.y - 70, '¡Rebote!', '#ffd84d', this.layer);
      sfx.boing();
    }
  }

  // --- Mar: burbujas que suben ---
  vent(x) {
    const mouth = this.scene.add.ellipse(x, this.main.top + 2, 80, 18, 0x1f4a6e).setStrokeStyle(3, 0x9fd8ff);
    this.layer.add(mouth);
    return x;
  }

  bubbles(event, dtMs, fighters) {
    const WARN = 900;
    const RISE = 3500;
    if (!event.x) {
      event.x = Phaser.Utils.Array.GetRandom(this.vents);
      event.dots = Array.from({ length: 16 }, (_, i) => this.add(this.scene.add.circle(event.x, this.main.top, 8 + (i % 4) * 4, 0xdff4ff, 0.75).setStrokeStyle(2, 0xffffff)));
      popText(this.scene, event.x, this.main.top - 120, '¡Burbujas! 🫧', '#dff4ff', this.layer);
    }
    const rising = event.t > WARN;
    for (const [i, dot] of event.dots.entries()) {
      const y = rising ? this.main.top - ((event.t * 0.6 + i * 45) % 700) : this.main.top - (i % 3) * 10;
      dot.setPosition(event.x + Math.sin(event.t / 200 + i) * 20, y);
    }
    if (rising) {
      for (const f of fighters) {
        if (!f.isAlive() || Math.abs(f.x - event.x) > 70 || f.y < this.main.top - 700) continue;
        f.vy = Math.min(f.vy, -520);
        f.grounded = false;
        f.platform = null;
      }
    }
    return event.t < WARN + RISE;
  }
}
