// Modo Monedas de Bolitas Bros: cada golpe hace saltar monedas del que lo recibe y las agarra quien las toque.
// Si te caes pierdes la mitad de las tuyas (salen volando desde arriba del escenario). Gana el que tenga más.
const GRAVITY = 1500;
const RADIUS = 14;
const LIFE_MS = 9000;
// Recién salidas no se agarran (si no, el que pegó se las llevaría todas sin que se vean).
const PICKUP_DELAY_MS = 350;
const MAX_ON_SCREEN = 60;
// Cuántas monedas salen por cada % de daño (y cuántas como mucho en un golpe).
const PER_DAMAGE = 1 / 5;
const MAX_PER_HIT = 6;

export class Coins {
  // `bottom`: más abajo de esto se pierden.
  constructor(scene, layer, platforms, bottom) {
    this.scene = scene;
    this.layer = layer;
    this.platforms = platforms;
    this.bottom = bottom;
    this.list = [];
  }

  // Monedas que salen de un golpe de `dealt` % de daño.
  fromHit(x, y, dealt) {
    this.burst(x, y, Math.min(MAX_PER_HIT, Math.max(1, Math.round(dealt * PER_DAMAGE))));
  }

  burst(x, y, count) {
    for (let i = 0; i < count && this.list.length < MAX_ON_SCREEN; i += 1) {
      const sprite = this.scene.add.container(x, y, [
        this.scene.add.circle(0, 0, RADIUS, 0xffc93c).setStrokeStyle(3, 0x8a5a00),
        this.scene.add.circle(0, 0, RADIUS * 0.5, 0xffe28a),
      ]);
      this.layer.add(sprite);
      this.list.push({ x, y, vx: (Math.random() - 0.5) * 560, vy: -380 - Math.random() * 380, sprite, ageMs: 0, platform: null });
    }
  }

  // `onPick(fighter)`: alguien agarró una.
  update(dtMs, fighters, onPick) {
    const dt = dtMs / 1000;
    this.list = this.list.filter((coin) => {
      coin.ageMs += dtMs;
      this.move(coin, dt);
      const taker =
        coin.ageMs > PICKUP_DELAY_MS && fighters.find((f) => f.isAlive() && !f.isBoss && !f.isDummy && f.distanceTo(coin.x, coin.y) < f.radius + RADIUS);
      if (taker) onPick(taker);
      if (taker || coin.ageMs > LIFE_MS || coin.y > this.bottom) {
        coin.sprite.destroy();
        return false;
      }
      // Gira (se hace angosta y ancha) y parpadea antes de irse.
      const ending = coin.ageMs > LIFE_MS - 1500 && Math.floor(coin.ageMs / 120) % 2 === 0;
      coin.sprite.setPosition(coin.x, coin.y).setScale(0.25 + 0.75 * Math.abs(Math.cos(coin.ageMs / 160)), 1).setAlpha(ending ? 0.3 : 1);
      return true;
    });
  }

  // Caen, botan un poquito y se quedan en las plataformas (moviéndose con ellas).
  move(coin, dt) {
    if (coin.platform) {
      const p = coin.platform;
      coin.x += p.dx;
      coin.y = p.top - RADIUS;
      if (coin.x < p.left || coin.x > p.right) coin.platform = null;
      return;
    }
    const prevBottom = coin.y + RADIUS;
    coin.vy = Math.min(900, coin.vy + GRAVITY * dt);
    coin.vx *= Math.exp(-1.2 * dt);
    coin.x += coin.vx * dt;
    coin.y += coin.vy * dt;
    const bottom = coin.y + RADIUS;
    for (const p of this.platforms) {
      if (coin.x < p.left || coin.x > p.right || prevBottom > p.top + 1 || bottom < p.top) continue;
      coin.y = p.top - RADIUS;
      if (coin.vy > 320) {
        coin.vy = -coin.vy * 0.35;
      } else {
        coin.vy = 0;
        coin.vx = 0;
        coin.platform = p;
      }
      return;
    }
  }

  nearest(fighter, maxDistance) {
    let best = null;
    let bestDist = maxDistance;
    for (const coin of this.list) {
      const dist = Math.hypot(coin.x - fighter.x, coin.y - fighter.y);
      if (dist < bestDist) [best, bestDist] = [coin, dist];
    }
    return best;
  }
}
