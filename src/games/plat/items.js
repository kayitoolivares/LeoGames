import { sfx } from '../../shared/sound.js';
import { textStyle } from '../../ui/style.js';
import { artImage } from './art.js';
import { moveBody, overlaps } from './physics.js';
import { T, themeTextures } from './tiles.js';

// Las cosas del nivel que no son enemigos: monedas, monedas grandes, poderes que salen de los bloques (hongo,
// flor, estrella, corazón = vida), bolas de fuego, pedacitos de ladrillo, resortes y plataformas que se mueven.
const GRAVITY = 2000;
const POWER_SPEED = { hongo: 130, vida: 130, estrella: 180, flor: 0 };
const FIREBALL = { speed: 560, bounce: 400, lifeMs: 2600, max: 2 };
const SPRING = { launch: 1350, held: 1600 };

export class Items {
  constructor(scene) {
    this.scene = scene;
    this.coins = [];
    this.bigCoins = [];
    this.powers = [];
    this.fireballs = [];
    this.springs = [];
    this.bits = [];
  }

  addCoin(x, y) {
    const look = artImage(this.scene, 'plat:objeto-moneda', 30, { color: 0xffc93c });
    const sprite = this.scene.add.container(x, y - T / 2 + 15, [look]).setDepth(30);
    this.coins.push({ x, y: y - T / 2 + 15, sprite, look });
  }

  addBigCoin(x, y, index, taken) {
    const look = artImage(this.scene, 'plat:objeto-moneda-grande', 58, { color: 0x7fb3ff });
    const sprite = this.scene.add.container(x, y - 6, [look]).setDepth(30).setAlpha(taken ? 0.35 : 1);
    this.bigCoins.push({ x, y: y - 6, index, sprite, look, taken });
  }

  addSpring(x, y) {
    const look = artImage(this.scene, 'plat:objeto-resorte', 44, { color: 0xe53935 });
    const sprite = this.scene.add.container(x, y, [look]).setDepth(35);
    this.springs.push({ x, y, w: T * 0.9, h: 40, sprite, look });
  }

  // Un poder sale de un bloque (sube despacito y luego se mueve).
  spawnPower(kind, col, row) {
    const x = col * T + T / 2;
    const y = (row + 1) * T;
    const key = kind === 'vida' ? null : `plat:objeto-${kind}`;
    const look = key ? artImage(this.scene, key, 40, { color: 0xff5a5f }) : this.scene.add.text(0, 0, '❤️', textStyle(34)).setOrigin(0.5, 1);
    const sprite = this.scene.add.container(x, y, [look]).setDepth(8);
    this.powers.push({ kind, x, y, w: 34, h: 36, vx: 0, vy: 0, sprite, emerge: 0, startY: y });
    sfx.special();
  }

  // Una moneda que salta de un bloque y se cuenta sola.
  popCoin(col, row) {
    const x = col * T + T / 2;
    const look = artImage(this.scene, 'plat:objeto-moneda', 30, { color: 0xffc93c });
    const sprite = this.scene.add.container(x, row * T, [look]).setDepth(30);
    this.scene.tweens.add({ targets: sprite, y: row * T - 90, duration: 280, yoyo: true, onComplete: () => sprite.destroy() });
  }

  fireball(player) {
    if (this.fireballs.filter((f) => f.owner === player).length >= FIREBALL.max) return false;
    const sprite = this.scene.add.circle(0, 0, 11, 0xff7a1f).setStrokeStyle(4, 0xffd84d).setDepth(45);
    this.fireballs.push({ owner: player, x: player.x + player.facing * 20, y: player.y - player.h * 0.55, vx: player.facing * FIREBALL.speed, vy: 160, w: 18, h: 18, ms: 0, sprite });
    sfx.fire();
    return true;
  }

  // Pedacitos de ladrillo al romperlo.
  breakBits(col, row, keys) {
    for (const [dx, dy, vx, vy] of [[-10, -10, -160, -620], [10, -10, 160, -620], [-10, 10, -120, -380], [10, 10, 120, -380]]) {
      const bit = this.scene.add.image(col * T + T / 2 + dx, row * T + T / 2 + dy, keys.brick).setScale(0.4).setDepth(45);
      this.bits.push({ sprite: bit, vx, vy });
    }
  }

  update(dtMs) {
    const dt = dtMs / 1000;
    const scene = this.scene;
    const level = scene.level;
    const players = scene.players.filter((p) => p.active);
    // Monedas: giran; se agarran tocándolas (o solas con el dinosaurio cerca, no).
    this.coins = this.coins.filter((coin) => {
      coin.look.setScale?.(Math.abs(Math.cos(scene.time.now / 260 + coin.x)) * (coin.look.baseScale ?? (coin.look.baseScale = coin.look.scaleY)), coin.look.baseScale);
      const taker = players.find((p) => Math.abs(p.x - coin.x) < p.w / 2 + 14 && coin.y > p.y - p.h - 14 && coin.y < p.y + 6);
      if (!taker) return true;
      coin.sprite.destroy();
      scene.coinTaken(taker);
      return false;
    });
    for (const big of this.bigCoins) {
      if (big.got) continue;
      big.sprite.y = big.y + Math.sin(scene.time.now / 300 + big.index) * 5;
      const taker = players.find((p) => Math.abs(p.x - big.x) < p.w / 2 + 24 && big.y > p.y - p.h - 26 && big.y - 50 < p.y);
      if (!taker) continue;
      big.got = true;
      scene.tweens.add({ targets: big.sprite, y: big.y - 80, alpha: 0, scale: 1.6, duration: 500, onComplete: () => big.sprite.destroy() });
      scene.bigCoinTaken(taker, big.index);
    }
    // Poderes.
    this.powers = this.powers.filter((pw) => {
      if (pw.emerge < 1) {
        pw.emerge = Math.min(1, pw.emerge + dt * 2.2);
        pw.y = pw.startY - pw.emerge * T;
        if (pw.emerge >= 1) {
          pw.vx = POWER_SPEED[pw.kind] ?? 0;
          pw.sprite.setDepth(30);
        }
      } else if (pw.kind !== 'flor') {
        pw.vy = Math.min(900, pw.vy + GRAVITY * dt);
        moveBody(level, pw, dt);
        if (pw.hitWall) pw.vx = -pw.hitWall * Math.abs(pw.vx);
        if (pw.onGround && pw.kind === 'estrella') pw.vy = -620;
      }
      pw.sprite.setPosition(pw.x, pw.y);
      if (pw.y > level.height + 100) {
        pw.sprite.destroy();
        return false;
      }
      const taker = pw.emerge >= 1 && players.find((p) => overlaps(p, pw, 4));
      if (!taker) return true;
      pw.sprite.destroy();
      scene.powerTaken(taker, pw.kind);
      return false;
    });
    // Bolas de fuego: rebotan en el piso y se acaban al chocar con una pared.
    this.fireballs = this.fireballs.filter((f) => {
      f.ms += dtMs;
      f.vy = Math.min(800, f.vy + GRAVITY * dt);
      moveBody(level, f, dt);
      if (f.onGround) f.vy = -FIREBALL.bounce;
      f.sprite.setPosition(f.x, f.y - 9).setAngle(f.ms);
      const hit = f.hitWall || f.ms > FIREBALL.lifeMs || f.y > level.height + 40 || scene.fireballHits(f);
      if (hit) {
        scene.puff(f.x, f.y - 9, 0xff9a3c);
        f.sprite.destroy();
      }
      return !hit;
    });
    // Resortes: el que cae encima sale volando.
    for (const s of this.springs) {
      for (const p of players) {
        if (p.vy <= 0 || Math.abs(p.x - s.x) > s.w / 2 + p.w / 2 - 6 || p.y < s.y - s.h - 4 || p.y > s.y - s.h + 26) continue;
        p.y = s.y - s.h;
        p.vy = -(p.input.held('a') ? SPRING.held : SPRING.launch);
        p.holdingJump = false;
        scene.tweens.add({ targets: s.look, scaleY: s.look.scaleY * 0.5, duration: 80, yoyo: true });
        sfx.boing();
      }
    }
    this.bits = this.bits.filter((bit) => {
      bit.vy += GRAVITY * dt;
      bit.sprite.x += bit.vx * dt;
      bit.sprite.y += bit.vy * dt;
      bit.sprite.angle += bit.vx * dt;
      if (bit.sprite.y < level.height + 60) return true;
      bit.sprite.destroy();
      return false;
    });
  }

  destroy() {
    for (const list of [this.coins, this.bigCoins, this.powers, this.fireballs, this.springs]) for (const item of list) item.sprite.destroy();
    for (const bit of this.bits) bit.sprite.destroy();
  }
}

// Plataformas que se mueven ('m' de lado, 'u' arriba y abajo) y las que se caen al pisarlas ('z').
export class Platforms {
  constructor(scene, theme) {
    this.scene = scene;
    this.list = [];
    this.keys = themeTextures(scene, theme);
  }

  add(kind, col, row) {
    const tiles = kind === 'z' ? 1 : 3;
    const x = kind === 'z' ? col * T : col * T - T;
    const y = row * T + T - 22;
    const sprite = this.scene.add.container(x, y).setDepth(20);
    for (let i = 0; i < tiles; i += 1) sprite.add(this.scene.add.image(i * T, 0, this.keys.semi).setOrigin(0, 0));
    if (kind === 'z') sprite.list[0].setTint(0xffc0a0);
    this.list.push({ kind, x, y, x0: x, y0: y, w: tiles * T, t: 0, dx: 0, dy: 0, vy: 0, sprite, touchedMs: -1 });
  }

  update(dtMs) {
    const dt = dtMs / 1000;
    for (const p of this.list) {
      const prevX = p.x;
      const prevY = p.y;
      p.t += dt;
      if (p.kind === 'm') p.x = p.x0 + Math.sin(p.t * 0.9) * T * 3;
      else if (p.kind === 'u') p.y = p.y0 + Math.sin(p.t * 0.9) * T * 2.5;
      else if (p.touchedMs >= 0) {
        p.touchedMs += dtMs;
        if (p.touchedMs > 450) {
          p.vy = Math.min(900, p.vy + 1800 * dt);
          p.y += p.vy * dt;
        }
        // Se cayó: al ratito regresa.
        if (p.y > this.scene.level.height + 300 && p.touchedMs > 3500) Object.assign(p, { y: p.y0, vy: 0, touchedMs: -1 });
      }
      p.dx = p.x - prevX;
      p.dy = p.y - prevY;
      p.sprite.setPosition(p.x, p.y).setAlpha(p.kind === 'z' && p.touchedMs > 0 && p.vy === 0 ? 0.6 + 0.4 * Math.sin(p.touchedMs / 40) : 1);
    }
  }

  // Si `body` cae encima de una plataforma, se queda parado en ella y se mueve con ella.
  carry(body, dt) {
    body.platform = null;
    if (body.vy < 0) return;
    for (const p of this.list) {
      if (body.x + body.w / 2 < p.x + 4 || body.x - body.w / 2 > p.x + p.w - 4) continue;
      const reach = Math.max(14, body.vy * dt + Math.abs(p.dy) + 6);
      if (body.y < p.y - 2 || body.y > p.y + reach) continue;
      body.y = p.y;
      body.vy = 0;
      body.onGround = true;
      body.platform = p;
      body.x += p.dx;
      if (p.kind === 'z' && p.touchedMs < 0) p.touchedMs = 0;
      return;
    }
  }

  destroy() {
    for (const p of this.list) p.sprite.destroy();
  }
}
