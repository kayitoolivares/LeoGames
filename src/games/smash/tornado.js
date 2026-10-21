import { sfx } from '../../shared/sound.js';
import { burst } from '../brawl/effects.js';
import { drawItem } from './items.js';

// El tornado (objeto): al agarrarlo sale un tornado que avanza hacia donde miras. A los rivales que toca los levanta
// dando vueltas un rato (con poquito daño) y luego los avienta para arriba. Se acaba solo o al salirse del escenario.
const SPEED = 230;
const LIFE_MS = 4500;
const CATCH_MS = 1300;
const REACH = 64;
const TICK_MS = 260;
const SPIN_HIT = { damage: 2, base: 0, scale: 0, angle: 90 };
const LAUNCH_HIT = { damage: 8, base: 460, scale: 8, angle: 82 };

export class Tornadoes {
  // `onHit(owner, victim, result)`: para la cuenta de golpes y de quién es el KO.
  constructor(scene, layer, main, onHit) {
    this.scene = scene;
    this.layer = layer;
    this.main = main;
    this.onHit = onHit;
    this.list = [];
  }

  spawn(owner) {
    const sprite = drawItem(this.scene, 'tornado').setScale(3);
    this.layer.add(sprite);
    this.list.push({ owner, sprite, x: owner.x + owner.facing * 70, feet: owner.y + owner.radius, dir: owner.facing, ageMs: 0, caught: new Map(), done: new Set() });
    sfx.fire();
  }

  update(dtMs, fighters) {
    this.list = this.list.filter((t) => {
      t.ageMs += dtMs;
      t.x += t.dir * SPEED * (dtMs / 1000);
      const ending = t.ageMs > LIFE_MS || t.x < this.main.left - 150 || t.x > this.main.right + 150;
      t.sprite.setPosition(t.x + Math.sin(t.ageMs / 70) * 6, t.feet - 72).setAngle(Math.sin(t.ageMs / 90) * 8);
      for (const f of fighters) {
        if (f.team === t.owner.team || !f.isAlive() || f.isInvulnerable() || t.done.has(f) || t.caught.has(f) || f.heldBy) continue;
        if (Math.abs(f.x - t.x) < REACH && f.y > t.feet - 220 && f.y < t.feet + 10) t.caught.set(f, { ms: 0, ticks: 0 });
      }
      for (const [f, c] of t.caught) {
        c.ms += dtMs;
        if (!f.isAlive()) {
          t.caught.delete(f);
          continue;
        }
        // Dando vueltas dentro del tornado, cada vez un poquito más arriba.
        f.releaseHold();
        f.shielding = false;
        f.attack = null;
        f.hanging = null;
        f.grounded = false;
        f.platform = null;
        const tick = Math.floor(c.ms / TICK_MS);
        if (tick > c.ticks) {
          c.ticks = tick;
          this.onHit(t.owner, f, f.takeHit({ facing: t.dir, power: 1, x: t.x }, SPIN_HIT));
        }
        f.x = t.x + Math.sin(c.ms / 90) * 30;
        f.y = t.feet - 90 - Math.min(90, c.ms * 0.08);
        f.vx = 0;
        f.vy = 0;
        f.hitstunMs = Math.max(f.hitstunMs, 150);
        if (c.ms >= CATCH_MS || ending) this.launch(t, f);
      }
      if (!ending) return true;
      burst(this.scene, t.x, t.feet - 60, 0xc8d4e0, 12, this.layer);
      t.sprite.destroy();
      return false;
    });
  }

  launch(t, f) {
    t.caught.delete(f);
    t.done.add(f);
    this.onHit(t.owner, f, f.takeHit({ facing: t.dir, power: 1, x: t.x }, LAUNCH_HIT));
    sfx.hit(0.8);
  }
}
