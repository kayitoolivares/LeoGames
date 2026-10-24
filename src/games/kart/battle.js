import * as THREE from 'three';
import { rewards } from '../../shared/rewards.js';
import { sfx } from '../../shared/sound.js';
import { say } from '../../shared/voice.js';
import { hexToCss } from '../../ui/style.js';
import { ITEMS } from './items.js';
import { INK_MS, RACER_RADIUS, SHIELD_MS, THROW_POSE_MS } from './Racer.js';

// Batallas en una arena redonda (con 4 karts):
//   globos:   cada kart trae 3 globos. Los poderes (y aplastar a uno encogido) revientan un globo; sin globos quedas
//             fuera. Gana el último con globos, o el que tenga más al acabarse el tiempo.
//   estrella: hay una estrella en la arena: el que la toca se la lleva (arriba de su kart) y va sumando tiempo; si
//             le pegan, la suelta. Gana el que la tuvo más tiempo.
//   monedas:  van saliendo monedas por la arena; si te pegan se te caen 3. Gana el que junte más.
export const BATTLE_RACERS = 4;
export const BATTLE_KINDS = {
  globos: { emoji: '🎈', image: 'globos', name: 'Globos', info: 'Revienta los globos de los demás: gana el último con globos', ms: 150000 },
  estrella: { emoji: '⭐', image: 'estrella', name: 'Atrapa la estrella', info: 'Llévate la estrella y no la sueltes: gana el que la tenga más tiempo', ms: 120000 },
  monedas: { emoji: '🪙', name: 'Monedas', info: 'Junta las monedas de la arena: si te pegan se te caen', ms: 120000 },
};
export const BATTLE_KIND_KEYS = Object.keys(BATTLE_KINDS);
const BALLOONS = 3;
const STAR = { reach: 3.4, height: 4.6, dropDistance: 9, bannedMs: 1500, hopMs: 450 };
const COINS = { max: 14, everyMs: 1100, reach: 2.6, dropped: 3, spread: 6 };
// Después de perder un globo, un ratito en que no te pueden pegar (parpadea).
const SAFE_MS = 1800;
const ARENA_RADIUS = 72;
const WALL_GAP = 2;
// Bloques de juguete para esconderse: { x, z, r (radio para chocar), h (alto), color }.
const OBSTACLES = [
  { x: 0, z: 0, r: 7, h: 6, color: 0xff5a5f },
  { x: 34, z: 24, r: 4.5, h: 4, color: 0x3fa7ff },
  { x: -34, z: 24, r: 4.5, h: 4, color: 0xffc93c },
  { x: 34, z: -24, r: 4.5, h: 4, color: 0x4cd97b },
  { x: -34, z: -24, r: 4.5, h: 4, color: 0xb07cff },
];
// La compu: qué tan cerca usa sus poderes y cuándo regresa al centro.
const CPU_SHOOT_RANGE = 40;
const CPU_AIM = 0.35;
const CPU_WALL_MARGIN = 14;
const CPU_GAS = 0.85;
// La tinta la guarda un rato (si la usara al instante, al empezar nadie vería nada).
const CPU_INK_CHANCE = 0.004;

// La arena: piso redondo de colores, llantas alrededor y bloques. Tiene las mismas cosas que una pista que
// usan los cohetes y el mapa (closest, points), para poder reutilizarlos.
export class Arena {
  constructor() {
    this.isArena = true;
    this.radius = ARENA_RADIUS;
    this.wallDistance = ARENA_RADIUS;
    this.roadWidth = ARENA_RADIUS * 2;
    this.obstacles = OBSTACLES;
    this.points = Array.from({ length: 64 }, (_, i) => {
      const a = (i / 64) * Math.PI * 2;
      return new THREE.Vector3(Math.cos(a) * ARENA_RADIUS, 0, Math.sin(a) * ARENA_RADIUS);
    });
    this.count = this.points.length;
    // Cajitas: un anillo afuera y unas entre los bloques.
    this.boxSpots = [
      ...Array.from({ length: 8 }, (_, i) => {
        const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
        return { x: Math.cos(a) * 52, z: Math.sin(a) * 52 };
      }),
      { x: 0, z: 24 },
      { x: 0, z: -24 },
      { x: 24, z: 0 },
      { x: -24, z: 0 },
    ];
  }

  // Para los cohetes: chocan contra la pared de llantas.
  closest(x, z) {
    return { index: 0, distance: Math.hypot(x, z) > ARENA_RADIUS - WALL_GAP ? Infinity : 0 };
  }

  lateral() {
    return 0;
  }

  // La arena es plana.
  heightAt() {
    return 0;
  }

  roadHeight() {
    return 0;
  }

  groundHeight() {
    return 0;
  }

  addTo(scene) {
    const outside = new THREE.Mesh(new THREE.PlaneGeometry(700, 700), new THREE.MeshLambertMaterial({ color: 0x6abf4b }));
    outside.rotation.x = -Math.PI / 2;
    scene.add(outside);
    // Piso de juguete: anillos de colores.
    const colors = [0xffe9a8, 0xbfe6ff, 0xffc8e2, 0xc8f0c0];
    for (let k = 0; k < 6; k += 1) {
      const outer = ARENA_RADIUS * (1 - k / 6);
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(Math.max(0.01, outer - ARENA_RADIUS / 6), outer, 48),
        new THREE.MeshLambertMaterial({ color: colors[k % colors.length] }),
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.02;
      scene.add(ring);
    }
    // Llantas alrededor.
    const count = 90;
    const tires = new THREE.InstancedMesh(new THREE.CylinderGeometry(1.1, 1.1, 1.3, 10), new THREE.MeshLambertMaterial(), count);
    const matrix = new THREE.Matrix4();
    const color = new THREE.Color();
    for (let i = 0; i < count; i += 1) {
      const a = (i / count) * Math.PI * 2;
      tires.setMatrixAt(i, matrix.makeTranslation(Math.cos(a) * (ARENA_RADIUS + 1.2), 0.65, Math.sin(a) * (ARENA_RADIUS + 1.2)));
      tires.setColorAt(i, color.setHex(i % 2 ? 0xffffff : 0xe53935));
    }
    scene.add(tires);
    // Bloques de juguete (con una letra pintada, como los cubos de los bebés).
    for (const o of OBSTACLES) {
      const block = new THREE.Mesh(new THREE.BoxGeometry(o.r * 1.5, o.h, o.r * 1.5), new THREE.MeshLambertMaterial({ color: o.color }));
      block.position.set(o.x, o.h / 2, o.z);
      block.rotation.y = Math.PI / 4;
      scene.add(block);
    }
  }

  // No deja salir a nadie de la arena ni atravesar los bloques.
  keepInside(racer) {
    const dist = Math.hypot(racer.x, racer.z);
    const limit = ARENA_RADIUS - WALL_GAP;
    if (dist > limit) {
      racer.x *= limit / dist;
      racer.z *= limit / dist;
      racer.speed *= 0.9;
    }
    for (const o of OBSTACLES) {
      const dx = racer.x - o.x;
      const dz = racer.z - o.z;
      const d = Math.hypot(dx, dz) || 0.01;
      const min = o.r + RACER_RADIUS;
      if (d >= min) continue;
      racer.x = o.x + (dx / d) * min;
      racer.z = o.z + (dz / d) * min;
      racer.speed *= 0.9;
    }
  }
}

// Las reglas de la batalla. `game` es el KartGame (con sus karts, su escena y su HUD); `kind`, cuál batalla.
export class Battle {
  constructor(game, kind = 'globos') {
    this.game = game;
    this.kind = kind;
    this.arena = game.track;
    this.balloonGeometry = new THREE.SphereGeometry(0.6, 12, 10);
    this.stringMaterial = new THREE.LineBasicMaterial({ color: 0xffffff });
    if (kind === 'globos') for (const racer of game.racers) this.addBalloons(racer);
    if (kind === 'estrella') this.star = this.buildStar();
    if (kind === 'monedas') {
      this.coinGeometry = new THREE.CylinderGeometry(1, 1, 0.25, 18).rotateX(Math.PI / 2);
      this.coinMaterial = new THREE.MeshLambertMaterial({ color: 0xffd84d, emissive: 0x7a5a00 });
      this.coins = [];
    }
  }

  // La estrella: una estrella dorada que flota y gira.
  buildStar() {
    const shape = new THREE.Shape();
    for (let i = 0; i < 10; i += 1) {
      const r = i % 2 ? 0.8 : 2;
      const a = (i / 10) * Math.PI * 2 + Math.PI / 2;
      if (i === 0) shape.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      else shape.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    shape.closePath();
    const geometry = new THREE.ExtrudeGeometry(shape, { depth: 0.6, bevelEnabled: false }).center();
    const mesh = new THREE.Mesh(geometry, new THREE.MeshLambertMaterial({ color: 0xffd02a, emissive: 0x8a6a00 }));
    const group = new THREE.Group();
    group.add(mesh);
    this.game.scene.add(group);
    return { group, mesh, holder: null, x: 0, z: 0, banned: null, bannedMs: 0, hopMs: 0 };
  }

  // Tres globos del color del jugador amarrados atrás del kart.
  addBalloons(racer) {
    const material = new THREE.MeshLambertMaterial({ color: racer.color });
    racer.balloonGroup = new THREE.Group();
    racer.balloonMeshes = [-0.8, 0, 0.8].map((x, i) => {
      const balloon = new THREE.Mesh(this.balloonGeometry, material);
      balloon.position.set(x, 4.3 + (i === 1 ? 0.5 : 0), -1.4);
      balloon.scale.set(1, 1.2, 1);
      const string = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(x, 3.6 + (i === 1 ? 0.5 : 0), -1.4), new THREE.Vector3(0, 1.2, -1.3)]),
        this.stringMaterial,
      );
      racer.balloonGroup.add(balloon, string);
      return [balloon, string];
    });
    racer.object.add(racer.balloonGroup);
  }

  // Todos en un círculo viendo al centro, con sus 3 globos (o por la estrella o las monedas).
  start() {
    this.timeMs = BATTLE_KINDS[this.kind].ms;
    this.outOrder = [];
    // La estrella empieza en un lugar libre al azar (en medio está el bloque grande).
    if (this.star) Object.assign(this.star, { holder: null, ...(this.freeSpot() ?? { x: 0, z: 24 }), banned: null, bannedMs: 0, hopMs: 0 });
    for (const coin of this.coins ?? []) this.game.scene.remove(coin.mesh);
    if (this.coins) this.coins = [];
    this.coinMs = 0;
    this.game.racers.forEach((racer, i, list) => {
      const a = (i / list.length) * Math.PI * 2;
      const x = Math.cos(a) * 50;
      const z = Math.sin(a) * 50;
      racer.reset(x, z, Math.atan2(-x, -z), 0);
      racer.balloons = BALLOONS;
      racer.safeMs = 0;
      racer.out = false;
      racer.hits = 0;
      racer.holdMs = 0;
      racer.battleCoins = 0;
      racer.object.visible = true;
    });
  }

  alive() {
    return this.game.racers.filter((racer) => !racer.out);
  }

  update(dtMs) {
    const game = this.game;
    this.timeMs = Math.max(0, this.timeMs - dtMs);
    for (const racer of game.racers) {
      racer.safeMs = Math.max(0, racer.safeMs - dtMs);
      if (racer.out) {
        racer.speed *= 0.95;
        continue;
      }
      const input = racer.isCpu ? this.cpuInput(racer) : game.humanInput(racer);
      racer.update(dtMs, input, false);
      if (input.useItem) game.useItem(racer, null);
      if (input.special) game.useSpecial(racer, null);
      if (input.change) racer.driver.changeNumber(input.change);
      this.arena.keepInside(racer);
    }
    for (const racer of game.racers) {
      for (const event of racer.events) game.announce(racer, event);
      racer.events.length = 0;
    }
    game.separateRacers();
    const players = this.alive();
    game.boxes.update(dtMs, performance.now(), players, (racer) => game.giveItem(racer));
    // (La gelatina no revienta globos: rebota.)
    game.projectiles.update(dtMs, players, this.arena, (victim, projectile) => (projectile.kind === 'jelly' ? game.bounceOff(victim) : this.hit(victim, projectile.owner)));
    if (this.star) this.updateStar(dtMs);
    if (this.coins) this.updateCoins(dtMs);
    // Se acaba si se acabó el tiempo; en la de globos, también si queda uno o si ya no queda ningún jugador (para no
    // esperar a la compu).
    const lastOne = this.kind === 'globos' && (players.length <= 1 || players.every((racer) => racer.isCpu));
    if (lastOne || this.timeMs === 0) this.finish();
  }

  // La estrella: suelta, el que la toque se la lleva; llevada, flota arriba de su kart y le cuenta el tiempo.
  updateStar(dtMs) {
    const star = this.star;
    star.bannedMs = Math.max(0, star.bannedMs - dtMs);
    star.hopMs = Math.max(0, star.hopMs - dtMs);
    if (star.holder) {
      star.holder.holdMs += dtMs;
      star.x = star.holder.x;
      star.z = star.holder.z;
      return;
    }
    if (star.hopMs > 0) return;
    const taker = this.game.racers.find((r) => !(r === star.banned && star.bannedMs > 0) && r.spinMs === 0 && Math.hypot(r.x - star.x, r.z - star.z) < STAR.reach);
    if (taker) this.takeStar(taker);
  }

  takeStar(racer) {
    this.star.holder = racer;
    sfx.sparkle();
    if (!racer.isCpu) racer.say('¡Tienes la estrella! ⭐ ¡Que no te peguen!', 1800);
    say(`¡${racer.label} tiene la estrella!`);
  }

  // La estrella se cae (le pegaron al que la traía): brinca a un lado, y él no la puede agarrar luego luego.
  dropStar(victim) {
    const star = this.star;
    star.holder = null;
    star.banned = victim;
    star.bannedMs = STAR.bannedMs;
    star.hopMs = STAR.hopMs;
    const a = Math.random() * Math.PI * 2;
    const limit = this.arena.radius - 8;
    const x = victim.x + Math.cos(a) * STAR.dropDistance;
    const z = victim.z + Math.sin(a) * STAR.dropDistance;
    const d = Math.hypot(x, z);
    Object.assign(star, this.outsideBlocks(d > limit ? (x / d) * limit : x, d > limit ? (z / d) * limit : z));
    if (!victim.isCpu) victim.say('¡Se te cayó la estrella! ⭐', 1500);
  }

  // Las monedas: salen solas en lugares libres; el que pasa encima se la lleva.
  updateCoins(dtMs) {
    this.coinMs += dtMs;
    if (this.coinMs > COINS.everyMs && this.coins.length < COINS.max) {
      this.coinMs = 0;
      const spot = this.freeSpot();
      if (spot) this.addCoin(spot.x, spot.z);
    }
    this.coins = this.coins.filter((coin) => {
      coin.ageMs += dtMs;
      if (coin.ageMs < 400) return true;
      const taker = this.game.racers.find((r) => r.spinMs === 0 && Math.hypot(r.x - coin.x, r.z - coin.z) < COINS.reach);
      if (!taker) return true;
      taker.battleCoins += 1;
      if (!taker.isCpu) sfx.coin();
      this.game.particles.burst('spark', coin.x, 1.5, coin.z, 6, [0xffd84d, 0xfff3b0], { speed: 4, up: 5, lifeMs: 450 });
      this.game.scene.remove(coin.mesh);
      return false;
    });
  }

  addCoin(x, z) {
    const mesh = new THREE.Mesh(this.coinGeometry, this.coinMaterial);
    mesh.position.set(x, 1.4, z);
    this.game.scene.add(mesh);
    this.coins.push({ x, z, mesh, ageMs: 0 });
  }

  // Si (x, z) quedó dentro de un bloque, lo saca a la orilla (para que se pueda agarrar).
  outsideBlocks(x, z) {
    for (const o of this.arena.obstacles) {
      const d = Math.hypot(x - o.x, z - o.z);
      if (d > o.r + 3) continue;
      const a = d > 0.01 ? Math.atan2(z - o.z, x - o.x) : Math.random() * Math.PI * 2;
      return { x: o.x + Math.cos(a) * (o.r + 3), z: o.z + Math.sin(a) * (o.r + 3) };
    }
    return { x, z };
  }

  // Un lugar al azar dentro de la arena, lejos de los bloques.
  freeSpot() {
    for (let tries = 0; tries < 20; tries += 1) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random()) * (this.arena.radius - 8);
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      if (this.arena.obstacles.every((o) => Math.hypot(x - o.x, z - o.z) > o.r + 3)) return { x, z };
    }
    return null;
  }

  // Le pegaron a `victim` (un poder de `attacker`, o lo aplastaron): pierde un globo, salvo que traiga burbuja
  // o lo acaben de reventar. Sin globos queda fuera.
  hit(victim, attacker) {
    if (victim.out || victim.safeMs > 0) return;
    const hurt = victim.hit();
    if (!hurt) {
      if (!victim.isCpu) victim.say('¡La burbuja te salvó!');
      return;
    }
    if (this.kind !== 'globos') {
      this.hitOther(victim, attacker);
      return;
    }
    victim.balloons -= 1;
    victim.safeMs = SAFE_MS;
    sfx.poof();
    // El globo revienta: pedacitos de su color.
    this.game.particles.burst('spark', victim.x, 4.5, victim.z, 12, [victim.color, 0xffffff], { speed: 6, up: 4, lifeMs: 600 });
    if (attacker && attacker !== victim) {
      attacker.hits += 1;
      if (!attacker.isCpu) {
        attacker.say('¡Le reventaste un globo! 🎈');
        rewards.earn('kart-poder');
      }
    }
    if (victim.balloons > 0) {
      if (!victim.isCpu) victim.say(`¡Te reventaron un globo! Te quedan ${victim.balloons}`);
      return;
    }
    victim.out = true;
    this.outOrder.push(victim);
    if (!victim.isCpu) victim.say('¡Sin globos! Ya no juegas 💥', 4000);
    say(`¡${victim.label} se quedó sin globos!`);
  }

  // Atrapa la estrella y Monedas: el golpeado suelta la estrella o se le caen unas monedas.
  hitOther(victim, attacker) {
    victim.safeMs = SAFE_MS;
    sfx.poof();
    if (attacker && attacker !== victim) {
      attacker.hits += 1;
      if (!attacker.isCpu) rewards.earn('kart-poder');
    }
    if (this.star?.holder === victim) this.dropStar(victim);
    if (!this.coins) return;
    const lost = Math.min(COINS.dropped, victim.battleCoins);
    victim.battleCoins -= lost;
    const limit = this.arena.radius - 6;
    for (let i = 0; i < lost; i += 1) {
      const a = (i / lost) * Math.PI * 2 + Math.random();
      this.addCoin(clamp(victim.x + Math.cos(a) * COINS.spread, -limit, limit), clamp(victim.z + Math.sin(a) * COINS.spread, -limit, limit));
    }
    if (lost && !victim.isCpu) victim.say(`¡Se te cayeron ${lost} monedas! 🪙`);
  }

  // Poderes en la batalla: el cohete y la tinta van contra los demás, el cometa contra el que trae más globos.
  useItem(racer) {
    const game = this.game;
    if (!racer.item || racer.rollMs > 0) return;
    const item = racer.item;
    racer.itemUses -= 1;
    if (racer.itemUses <= 0) racer.item = null;
    racer.throwMs = THROW_POSE_MS;
    const rivals = this.alive().filter((other) => other !== racer);
    if (item === 'rocket') game.projectiles.addRocket(racer, nearest(racer, rivals));
    else if (item === 'banana' || item === 'banana3') game.projectiles.addBanana(racer);
    else if (item === 'turbo') racer.boost(1.7, 2000);
    else if (item === 'shield') racer.shieldMs = SHIELD_MS;
    else if (item === 'comet') {
      const leader = rivals.sort((a, b) => b.balloons - a.balloons)[0];
      if (leader) game.projectiles.addComet(racer, leader);
    } else if (item === 'lightning') {
      game.strikeLightning(racer);
      // (En Atrapa la estrella, al que la trae se le cae.)
      const holder = this.star?.holder;
      if (holder && holder !== racer && holder.shrinkMs > 0) this.dropStar(holder);
    }
    else if (['star', 'ghost', 'jelly', 'tornado', 'spring', 'sticky'].includes(item)) game.usePower(racer, item, null, nearest(racer, rivals));
    else if (item === 'ink') {
      for (const other of rivals) {
        other.inkMs = INK_MS;
        if (!other.isCpu) other.say('¡No veo! 🦑');
      }
      sfx.throw();
    }
    if (!racer.isCpu) racer.say(ITEMS[item].name, 900);
  }

  // La compu: si no trae poder va por una cajita; si trae, va por el rival más cercano y se lo lanza.
  // Cerca de la pared se regresa al centro y le saca la vuelta a los bloques.
  cpuInput(racer) {
    const game = this.game;
    const rivals = this.alive().filter((other) => other !== racer);
    let target = null;
    // Atrapa la estrella: va por ella (o por el que la trae); si la trae él, se aleja del más cercano.
    if (this.star) {
      const star = this.star;
      if (star.holder === racer) {
        const foe = nearest(racer, rivals);
        if (foe) target = { x: racer.x * 2 - foe.x, z: racer.z * 2 - foe.z };
      } else {
        target = star.holder ?? { x: star.x, z: star.z };
      }
    }
    // Monedas: va por la más cercana.
    if (this.coins?.length) target = nearest(racer, this.coins);
    if (!target && !racer.item && racer.rollMs === 0) target = nearest(racer, game.boxes.boxes.filter((box) => box.respawnMs === 0));
    target ??= nearest(racer, rivals) ?? { x: 0, z: 0 };
    const fromCenter = Math.hypot(racer.x, racer.z);
    if (fromCenter > ARENA_RADIUS - CPU_WALL_MARGIN && Math.hypot(target.x, target.z) > fromCenter - 4) target = { x: 0, z: 0 };
    let diff = angleDiff(Math.atan2(target.x - racer.x, target.z - racer.z), racer.heading);
    // Un bloque enfrente: lo rodea.
    for (const o of this.arena.obstacles) {
      const ahead = angleDiff(Math.atan2(o.x - racer.x, o.z - racer.z), racer.heading);
      if (Math.abs(ahead) < 0.5 && Math.hypot(o.x - racer.x, o.z - racer.z) < o.r + 9) diff += ahead > 0 ? -0.8 : 0.8;
    }
    const foe = nearest(racer, rivals);
    const foeDist = foe ? Math.hypot(foe.x - racer.x, foe.z - racer.z) : Infinity;
    const aimed = foe && Math.abs(angleDiff(Math.atan2(foe.x - racer.x, foe.z - racer.z), racer.heading)) < CPU_AIM;
    let useItem = false;
    if (racer.item && racer.rollMs === 0) {
      if (['turbo', 'shield', 'lightning', 'comet'].includes(racer.item)) useItem = true;
      else if (racer.item === 'ink') useItem = Math.random() < CPU_INK_CHANCE;
      else if (racer.item === 'rocket') useItem = aimed && foeDist < CPU_SHOOT_RANGE;
      else useItem = foeDist < 18;
    }
    const wobble = racer.inkMs > 0 ? Math.sin(performance.now() / 260) * 0.6 : 0;
    return { steer: Math.max(-1, Math.min(1, -diff * 2.5 + wobble)), gas: CPU_GAS, brake: 0, nitro: false, useItem, trick: false };
  }

  // Lo que dice el panel de cada jugador: sus globos y el reloj.
  panel(racer) {
    const pos = { globos: racer.out ? '💥' : '🎈'.repeat(racer.balloons), estrella: `⭐ ${clock(racer.holdMs)}`, monedas: `🪙 ${racer.battleCoins}` }[this.kind];
    return { pos, lap: `⏱️ ${clock(this.timeMs)}` };
  }

  // Los globos que le quedan se ven; al que le acaban de reventar uno parpadea un rato (no le pueden pegar).
  render() {
    const now = performance.now();
    const blink = Math.floor(now / 100) % 2 === 0;
    for (const racer of this.game.racers) {
      racer.balloonMeshes?.forEach(([balloon, string], i) => {
        balloon.visible = i < racer.balloons;
        string.visible = i < racer.balloons;
      });
      racer.object.visible = racer.out || racer.safeMs === 0 || blink;
    }
    if (this.star) {
      const star = this.star;
      const held = Boolean(star.holder);
      // Cayéndose: un brinquito.
      const hop = star.hopMs > 0 ? Math.sin((star.hopMs / STAR.hopMs) * Math.PI) * 3 : 0;
      star.group.position.set(star.x, (held ? STAR.height + 1 : 2.2) + hop + Math.sin(now / 300) * 0.3, star.z);
      star.mesh.rotation.y = now / 400;
      star.group.scale.setScalar(held ? 0.75 : 1);
    }
    for (const coin of this.coins ?? []) coin.mesh.rotation.y = now / 300 + coin.x;
  }

  // Se acabó: gana el último con globos (o, con el tiempo, el que tenga más; empatados, el que reventó más).
  finish() {
    const game = this.game;
    game.phase = 'results';
    game.phaseMs = 0;
    game.hud.setCenter('');
    let ranking;
    if (this.kind === 'estrella') ranking = [...game.racers].sort((a, b) => b.holdMs - a.holdMs || b.hits - a.hits);
    else if (this.kind === 'monedas') ranking = [...game.racers].sort((a, b) => b.battleCoins - a.battleCoins || b.hits - a.hits);
    else ranking = [...this.alive().sort((a, b) => b.balloons - a.balloons || b.hits - a.hits), ...[...this.outOrder].reverse()];
    const winner = ranking[0];
    if (!winner.isCpu) rewards.earn('kart-batalla');
    game.hud.showResults(
      ranking.map((racer) => ({ label: racer.label, color: hexToCss(racer.color), name: racer.driver.name, image: racer.driver.imageUrl })),
      { title: `¡Ganó ${winner.label}!`, footer: 'A = otra vez  ·  B = otra batalla  ·  X = taller', note: game.payout(ranking) },
    );
    say(`¡Ganó la batalla ${winner.label}, ${winner.driver.name}!`);
    game.startCeremony(ranking);
  }
}

// 83500 ms -> "1:24"
function clock(ms) {
  const seconds = Math.ceil(ms / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function nearest(from, list) {
  let best = null;
  let bestDist = Infinity;
  for (const other of list) {
    const d = Math.hypot(other.x - from.x, other.z - from.z);
    if (d < bestDist) [best, bestDist] = [other, d];
  }
  return best;
}

function angleDiff(a, b) {
  return Math.atan2(Math.sin(a - b), Math.cos(a - b));
}
