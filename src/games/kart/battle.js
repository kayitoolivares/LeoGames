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
// En equipos (Rojos contra Azules, 2 y 2, en la arena del fuerte): lo de tu equipo no te hace nada, los globos son del
// color del equipo y se suman los globos, el tiempo con la estrella o las monedas de los dos.
export const BATTLE_RACERS = 4;
// Los dos equipos (también los de la carrera por equipos).
export const TEAMS = [
  { name: 'Rojos', color: 0xff5a5f, emoji: '🔴' },
  { name: 'Azules', color: 0x3fa7ff, emoji: '🔵' },
];
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
// La arena del fuerte (batallas en equipos): un fuerte de cada equipo (`team`), una torre en medio y dos muros.
const FORT_OBSTACLES = [
  { x: -44, z: 0, r: 7, h: 7, color: TEAMS[0].color, team: 0 },
  { x: 44, z: 0, r: 7, h: 7, color: TEAMS[1].color, team: 1 },
  { x: 0, z: 0, r: 5, h: 9, color: 0xffd02a },
  { x: 0, z: 40, r: 4.5, h: 4, color: 0x4cd97b },
  { x: 0, z: -40, r: 4.5, h: 4, color: 0xb07cff },
];
// Cómo se ve cada arena: sus bloques, el piso (anillos de colores o mitad roja y mitad azul) y las llantas.
const ARENAS = {
  juguetes: { obstacles: OBSTACLES, floor: 'rings', tires: [0xe53935, 0xffffff], panorama: 'arena' },
  fuerte: { obstacles: FORT_OBSTACLES, floor: 'halves', tires: [TEAMS[0].color, TEAMS[1].color], panorama: 'fuerte' },
};
// La compu: qué tan cerca usa sus poderes y cuándo regresa al centro.
const CPU_SHOOT_RANGE = 40;
const CPU_AIM = 0.35;
const CPU_WALL_MARGIN = 14;
const CPU_GAS = 0.85;
// La tinta la guarda un rato (si la usara al instante, al empezar nadie vería nada).
const CPU_INK_CHANCE = 0.004;

// La arena: piso redondo de colores, llantas alrededor y bloques. Tiene las mismas cosas que una pista que
// usan los cohetes y el mapa (closest, points), para poder reutilizarlos. `kind`: juguetes o fuerte (ver ARENAS).
export class Arena {
  constructor(kind = 'juguetes') {
    this.isArena = true;
    this.kind = kind;
    this.layout = ARENAS[kind] ?? ARENAS.juguetes;
    // El paisaje de fondo (kart/fondos), si hay.
    this.panorama = this.layout.panorama;
    this.radius = ARENA_RADIUS;
    this.wallDistance = ARENA_RADIUS;
    this.roadWidth = ARENA_RADIUS * 2;
    this.obstacles = this.layout.obstacles;
    this.points = Array.from({ length: 64 }, (_, i) => {
      const a = (i / 64) * Math.PI * 2;
      return new THREE.Vector3(Math.cos(a) * ARENA_RADIUS, 0, Math.sin(a) * ARENA_RADIUS);
    });
    this.count = this.points.length;
    // Cajitas: un anillo afuera y unas entre los bloques.
    const inner = kind === 'fuerte' ? [[-20, 18], [20, 18], [-20, -18], [20, -18]] : [[0, 24], [0, -24], [24, 0], [-24, 0]];
    this.boxSpots = [
      ...Array.from({ length: 8 }, (_, i) => {
        const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
        return { x: Math.cos(a) * 52, z: Math.sin(a) * 52 };
      }),
      ...inner.map(([x, z]) => ({ x, z })),
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
    if (this.layout.floor === 'halves') this.addHalves(scene);
    else this.addRings(scene);
    // Llantas alrededor.
    const count = 90;
    const tires = new THREE.InstancedMesh(new THREE.CylinderGeometry(1.1, 1.1, 1.3, 10), new THREE.MeshLambertMaterial(), count);
    const matrix = new THREE.Matrix4();
    const color = new THREE.Color();
    // (En el fuerte, del lado de cada equipo, de su color y blancas.)
    const halves = this.layout.floor === 'halves';
    for (let i = 0; i < count; i += 1) {
      const a = (i / count) * Math.PI * 2;
      tires.setMatrixAt(i, matrix.makeTranslation(Math.cos(a) * (ARENA_RADIUS + 1.2), 0.65, Math.sin(a) * (ARENA_RADIUS + 1.2)));
      const hex = halves ? (i % 2 ? 0xffffff : this.layout.tires[Math.cos(a) < 0 ? 0 : 1]) : this.layout.tires[i % 2];
      tires.setColorAt(i, color.setHex(hex));
    }
    scene.add(tires);
    // Bloques de juguete (con una letra pintada, como los cubos de los bebés); en el fuerte, los fuertes de cada equipo.
    for (const o of this.obstacles) {
      if (o.team !== undefined) {
        this.addFort(scene, o);
        continue;
      }
      const block = new THREE.Mesh(new THREE.BoxGeometry(o.r * 1.5, o.h, o.r * 1.5), new THREE.MeshLambertMaterial({ color: o.color }));
      block.position.set(o.x, o.h / 2, o.z);
      block.rotation.y = Math.PI / 4;
      scene.add(block);
    }
  }

  // Piso de juguete: anillos de colores.
  addRings(scene) {
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
  }

  // El fuerte: la mitad de cada equipo pintada de su color (clarito), una raya blanca en medio y un círculo al centro.
  addHalves(scene) {
    [0xffd2d2, 0xd2e6ff].forEach((hex, team) => {
      // (Acostado, el ángulo del círculo va de x hacia -z: la mitad roja es la de x negativas.)
      const half = new THREE.Mesh(new THREE.CircleGeometry(ARENA_RADIUS, 48, Math.PI / 2 + team * Math.PI, Math.PI), new THREE.MeshLambertMaterial({ color: hex }));
      half.rotation.x = -Math.PI / 2;
      half.position.y = 0.02;
      scene.add(half);
    });
    const line = new THREE.Mesh(new THREE.PlaneGeometry(1.4, ARENA_RADIUS * 2), new THREE.MeshLambertMaterial({ color: 0xffffff }));
    line.rotation.x = -Math.PI / 2;
    line.position.y = 0.03;
    const circle = new THREE.Mesh(new THREE.RingGeometry(12, 13.4, 40), new THREE.MeshLambertMaterial({ color: 0xffffff }));
    circle.rotation.x = -Math.PI / 2;
    circle.position.y = 0.03;
    scene.add(line, circle);
  }

  // Un fuerte del color de su equipo: torre cuadrada con almenas y su bandera arriba.
  addFort(scene, o) {
    const fort = new THREE.Group();
    const size = o.r * 1.5;
    const material = new THREE.MeshLambertMaterial({ color: o.color });
    const body = new THREE.Mesh(new THREE.BoxGeometry(size, o.h, size), material);
    body.position.y = o.h / 2;
    fort.add(body);
    for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, -1], [0, 1], [-1, 0], [1, 0]]) {
      const merlon = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.8, 1.8), material);
      merlon.position.set((x * (size - 1.8)) / 2, o.h + 0.9, (z * (size - 1.8)) / 2);
      fort.add(merlon);
    }
    const door = new THREE.Mesh(new THREE.BoxGeometry(3, 4, 0.3), new THREE.MeshLambertMaterial({ color: 0x5a3a2a }));
    door.position.set(o.x < 0 ? size / 2 + 0.1 : -size / 2 - 0.1, 2, 0);
    door.rotation.y = Math.PI / 2;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 7, 6), new THREE.MeshLambertMaterial({ color: 0xffffff }));
    pole.position.y = o.h + 3.5;
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(4, 2.4), new THREE.MeshBasicMaterial({ color: o.color, side: THREE.DoubleSide }));
    flag.position.set(2, o.h + 5.6, 0);
    fort.add(door, pole, flag);
    fort.position.set(o.x, 0, o.z);
    scene.add(fort);
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
    for (const o of this.obstacles) {
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

// Las reglas de la batalla. `game` es el KartGame (con sus karts, su escena y su HUD); `kind`, cuál batalla;
// `teams`: Rojos contra Azules (cada kart ya trae su `team`).
export class Battle {
  constructor(game, kind = 'globos', { teams = false } = {}) {
    this.game = game;
    this.kind = kind;
    this.teams = teams;
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

  // Tres globos del color del jugador (o de su equipo) amarrados atrás del kart.
  addBalloons(racer) {
    const material = new THREE.MeshLambertMaterial({ color: this.teams ? racer.teamColor : racer.color });
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
    const mates = [0, 0];
    this.game.racers.forEach((racer, i, list) => {
      const a = (i / list.length) * Math.PI * 2;
      let x = Math.cos(a) * 50;
      let z = Math.sin(a) * 50;
      // En equipos, cada equipo junto a su fuerte (los Rojos a la izquierda y los Azules a la derecha).
      if (this.teams) {
        const k = mates[racer.team]++;
        x = (racer.team === 0 ? -1 : 1) * 56;
        z = k % 2 ? -18 - Math.floor(k / 2) * 8 : 18 + Math.floor(k / 2) * 8;
      }
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

  // ¿Van en el mismo equipo? (Sin equipos, nadie.)
  mates(a, b) {
    return this.teams && a !== b && a.team === b.team;
  }

  // Los que siguen jugando y no son de su equipo.
  foesOf(racer) {
    return this.alive().filter((other) => other !== racer && !this.mates(racer, other));
  }

  // Lo que lleva cada equipo: globos (de los que siguen), segundos con la estrella o monedas.
  teamScores() {
    const scores = [0, 0];
    for (const racer of this.game.racers) {
      if (racer.team === undefined) continue;
      if (this.kind === 'globos') scores[racer.team] += racer.out ? 0 : racer.balloons;
      else if (this.kind === 'estrella') scores[racer.team] += racer.holdMs / 1000;
      else scores[racer.team] += racer.battleCoins;
    }
    return scores.map((score) => Math.floor(score));
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
    // Se acaba si se acabó el tiempo; en la de globos, también si queda uno (o un solo equipo) o si ya no queda ningún
    // jugador (para no esperar a la compu).
    const standing = this.teams ? new Set(players.map((racer) => racer.team)).size : players.length;
    const lastOne = this.kind === 'globos' && (standing <= 1 || players.every((racer) => racer.isCpu));
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
    // (Lo de tu equipo no te hace nada.)
    if (attacker && this.mates(victim, attacker)) return;
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
    const rivals = this.foesOf(racer);
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
      if (holder && holder !== racer && !this.mates(racer, holder) && holder.shrinkMs > 0) this.dropStar(holder);
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
    const rivals = this.foesOf(racer);
    let target = null;
    // Atrapa la estrella: va por ella (o por el que la trae); si la trae él, se aleja del más cercano. Si la trae
    // alguien de su equipo, lo cuida: va contra el rival que esté más cerca de él.
    if (this.star) {
      const star = this.star;
      if (star.holder === racer) {
        const foe = nearest(racer, rivals);
        if (foe) target = { x: racer.x * 2 - foe.x, z: racer.z * 2 - foe.z };
      } else if (star.holder && this.mates(racer, star.holder)) {
        target = nearest(star.holder, rivals);
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
  // (En equipos, también cómo van los dos equipos.)
  panel(racer) {
    const pos = { globos: racer.out ? '💥' : '🎈'.repeat(racer.balloons), estrella: `⭐ ${clock(racer.holdMs)}`, monedas: `🪙 ${racer.battleCoins}` }[this.kind];
    const [red, blue] = this.teams ? this.teamScores() : [];
    return { pos, lap: `⏱️ ${clock(this.timeMs)}${this.teams ? ` · ${TEAMS[0].emoji} ${red} ${TEAMS[1].emoji} ${blue}` : ''}` };
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
    if (this.teams) {
      this.finishTeams(ranking);
      return;
    }
    const winner = ranking[0];
    if (!winner.isCpu) rewards.earn('kart-batalla');
    game.hud.showResults(
      ranking.map((racer) => ({ label: racer.label, color: hexToCss(racer.color), name: racer.displayName, image: racer.driver.imageUrl })),
      { title: `¡Ganó ${winner.label}!`, footer: 'A = otra vez  ·  B = otra batalla  ·  X = taller', note: game.payout(ranking) },
    );
    say(`¡Ganó la batalla ${winner.label}, ${winner.driver.name}!`);
    game.startCeremony(ranking);
  }

  // En equipos: gana el equipo que sumó más (en globos, el que todavía tenga a alguien jugando); empatados, el que
  // pegó más. Al podio va primero el equipo ganador.
  finishTeams(ranking) {
    const game = this.game;
    const scores = this.teamScores();
    const hits = [0, 0];
    for (const racer of game.racers) hits[racer.team] += racer.hits;
    const standing = [0, 1].map((team) => this.alive().some((racer) => racer.team === team));
    let winner = null;
    if (this.kind === 'globos' && standing[0] !== standing[1]) winner = standing[0] ? 0 : 1;
    else if (scores[0] !== scores[1]) winner = scores[0] > scores[1] ? 0 : 1;
    else if (hits[0] !== hits[1]) winner = hits[0] > hits[1] ? 0 : 1;
    if (winner !== null) ranking = [...ranking.filter((racer) => racer.team === winner), ...ranking.filter((racer) => racer.team !== winner)];
    if (winner !== null && game.racers.some((racer) => racer.team === winner && !racer.isCpu)) {
      rewards.earn('kart-batalla');
      rewards.earn('kart-equipo');
    }
    const score = `${TEAMS[0].emoji} ${scores[0]}  a  ${scores[1]} ${TEAMS[1].emoji}`;
    game.hud.showResults(
      ranking.map((racer) => ({ label: racer.label, color: hexToCss(racer.color), name: `${racer.displayName} ${TEAMS[racer.team].emoji}`, image: racer.driver.imageUrl })),
      { title: winner === null ? `¡Empate! ${score}` : `¡Ganaron los ${TEAMS[winner].name}! ${score}`, footer: 'A = otra vez  ·  B = otra batalla  ·  X = taller', note: game.payout(ranking) },
    );
    say(winner === null ? '¡Empate entre los dos equipos!' : `¡Ganaron la batalla los ${TEAMS[winner].name}!`);
    this.winnerTeam = winner;
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
