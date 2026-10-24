import * as THREE from 'three';
import manifest from './art.json';
import { RACER_RADIUS } from './Racer.js';

// `uses`: cuántas veces se usa (el triple plátano suelta uno con cada X).
export const ITEMS = {
  rocket: { emoji: '🚀', name: '¡Cohete!' },
  banana: { emoji: '🍌', name: '¡Plátano!' },
  turbo: { emoji: '⚡', name: '¡Súper turbo!' },
  shield: { emoji: '🛡️', name: '¡Burbuja!' },
  banana3: { emoji: '🍌', name: '¡Tres plátanos!', uses: 3 },
  // Persigue al que va en primer lugar (siguiendo la pista) y explota.
  comet: { emoji: '☄️', name: '¡Cometa!' },
  // Encoge a todos los demás un rato (más lentos, y si los tocas dan vueltas).
  lightning: { emoji: '🌩️', name: '¡Rayo!' },
  // Mancha la pantalla de los que van adelante.
  ink: { emoji: '🦑', name: '¡Tinta!' },
  // Invencible un rato, más rápido, y tumba al que toque.
  star: { emoji: '⭐', name: '¡Estrella!' },
  // Le roba su poder a otro y se vuelve fantasma (nada le pega).
  ghost: { emoji: '👻', name: '¡Fantasma!' },
  // Se vuelve una bala que maneja sola, rapidísimo, y tumba a todos.
  bullet: { emoji: '💣', name: '¡Bala!' },
  // Una abeja que vuela por encima de todo hasta el primero y le pica (y a los que encuentre en el camino).
  bee: { emoji: '🐝', name: '¡Abeja!' },
  // Un rato jala hacia el de adelante (más rápido si lo traes cerca) y atrae las monedas.
  magnet: { emoji: '🧲', name: '¡Imán!' },
  // Un muro de gelatina atrás: el que choca rebota (aguanta 3 golpes).
  jelly: { emoji: '🟩', name: '¡Muro de gelatina!' },
  // Un tornado que avanza por la pista y levanta a los que toca.
  tornado: { emoji: '🌪️', name: '¡Tornado!' },
  // ¡Súper brinco! Por encima de plátanos y peligros.
  spring: { emoji: '🦘', name: '¡Resorte!' },
  // Se le pega al de adelante y a los 3 segundos explota (pasársela chocando con otro).
  sticky: { emoji: '🧨', name: '¡Bomba pegajosa!' },
};

// Como en Mario Kart: el que va adelante recibe cosas para defenderse
// y los de atrás, cosas para alcanzar.
const TABLES = {
  front: { banana: 28, shield: 26, banana3: 18, rocket: 10, turbo: 5, ink: 5, ghost: 8, jelly: 12, spring: 6 },
  middle: { rocket: 22, banana: 12, turbo: 13, ink: 12, banana3: 8, shield: 8, comet: 5, lightning: 4, ghost: 7, star: 5, bee: 4, magnet: 7, tornado: 6, sticky: 7, jelly: 5, spring: 5 },
  back: { turbo: 17, rocket: 18, comet: 12, lightning: 10, ink: 9, shield: 4, star: 12, bullet: 11, bee: 7, magnet: 10, tornado: 8, sticky: 6, spring: 4 },
  // En la batalla no hay pista para la bala ni primer lugar para la abeja (ni a quién jalar con el imán).
  battle: { rocket: 22, banana: 12, turbo: 12, ink: 10, banana3: 10, shield: 10, comet: 6, lightning: 6, ghost: 6, star: 6, jelly: 7, tornado: 5, spring: 5, sticky: 8 },
};

// `place` es 0 para el primer lugar y 1 para el último (`battle`: los poderes de la batalla).
export function rollItem(place, battle = false) {
  const table = battle ? TABLES.battle : place < 0.2 ? TABLES.front : place < 0.7 ? TABLES.middle : TABLES.back;
  const total = Object.values(table).reduce((sum, weight) => sum + weight, 0);
  let pick = Math.random() * total;
  for (const [item, weight] of Object.entries(table)) {
    pick -= weight;
    if (pick < 0) return item;
  }
  return 'turbo';
}

const BOX_RESPAWN_MS = 3000;
const BOX_ROWS = [0.22, 0.47, 0.7, 0.9];
const BOX_LANES = [-6, -2, 2, 6];

// Cajitas "?" en filas a lo largo de la pista (o en `spots`: [{ x, z }], en la arena). Al pasar por una te da un
// poder (si no traes uno).
export class ItemBoxes {
  constructor(scene, track, spots = null) {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffc93c';
    ctx.fillRect(0, 0, 64, 64);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 6;
    ctx.strokeRect(3, 3, 58, 58);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 48px "Segoe UI", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('?', 32, 36);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const geometry = new THREE.BoxGeometry(2, 2, 2);
    const material = new THREE.MeshLambertMaterial({ map: texture, transparent: true, opacity: 0.9 });

    this.boxes = [];
    const places = spots ?? BOX_ROWS.flatMap((row) => BOX_LANES.map((lane) => track.pointAt(Math.round(row * track.count), lane)));
    for (const spot of places) {
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(spot.x, (spot.y ?? 0) + 1.6, spot.z);
      scene.add(mesh);
      this.boxes.push({ x: spot.x, y: spot.y ?? 0, z: spot.z, mesh, respawnMs: 0, phase: Math.random() * 6 });
    }
  }

  update(dtMs, timeMs, racers, onPickup) {
    for (const box of this.boxes) {
      if (box.respawnMs > 0) {
        box.respawnMs = Math.max(0, box.respawnMs - dtMs);
        box.mesh.visible = box.respawnMs === 0;
        continue;
      }
      box.mesh.rotation.y = timeMs / 600 + box.phase;
      box.mesh.rotation.x = 0.4;
      box.mesh.position.y = box.y + 1.6 + Math.sin(timeMs / 300 + box.phase) * 0.3;
      const taker = racers.find((r) => Math.hypot(r.x - box.x, r.z - box.z) < RACER_RADIUS + 1.2);
      if (!taker) continue;
      box.respawnMs = BOX_RESPAWN_MS;
      box.mesh.visible = false;
      onPickup(taker);
    }
  }
}

const ROCKET_SPEED = 62;
const ROCKET_TURN = 3;
const ROCKET_LIFE_MS = 3500;
const BANANA_LIFE_MS = 40000;
const OWNER_GRACE_MS = 800;
// El cometa va más rápido que todos, sobre la pista, y cuando ya está cerca se va directo al primero.
const COMET_SPEED = 78;
const COMET_LOOKAHEAD = 8;
const COMET_HOMING = 22;
const COMET_LIFE_MS = 15000;
const COMET_BLAST = 6;
const COMET_HEIGHT = 1.6;
// La abeja vuela alto, derechito al primero, y le pica también al que se encuentre en el camino.
const BEE_SPEED = 66;
const BEE_HEIGHT = 4.5;
const BEE_STING = 2.8;
const BEE_LIFE_MS = 14000;
const BEE_SIZE = 2.6;
// Muro de gelatina: atravesado en el camino atrás del que lo suelta; el que choca rebota. Aguanta 3 golpes.
const JELLY = { width: 7, height: 2.6, depth: 1.2, behind: 5, lifeMs: 20000, hits: 3, cooldownMs: 800, wobbleMs: 450 };
// Tornado: avanza por la pista zigzagueando y levanta (y hace girar) a los que toca, a varios.
const TORNADO = { speed: 38, lifeMs: 9000, reach: 2.8, lookahead: 7, weave: 6, size: 5 };
// Bomba pegajosa: vuela hacia el de adelante, se le pega y explota a los 3 segundos (a él y a los de junto).
// Chocando con otro kart se la pasas.
const STICKY = { speed: 52, lifeMs: 5000, fuseMs: 3000, blast: 6.5, passMs: 600, size: 1.8 };
// Saltando muy alto (resorte) no te pegan los plátanos ni los cohetes.
const DODGE_HEIGHT = 2.5;

// Cohetes que persiguen al de adelante, plátanos que se quedan en la pista y cometas que van por el primero.
export class Projectiles {
  constructor(scene) {
    this.scene = scene;
    this.list = [];
    this.rocketGeometry = new THREE.ConeGeometry(0.45, 1.8, 8).rotateX(Math.PI / 2);
    this.rocketMaterial = new THREE.MeshLambertMaterial({ color: 0xff5a5f });
    this.bananaGeometry = new THREE.TorusGeometry(0.7, 0.28, 6, 12, Math.PI);
    this.bananaMaterial = new THREE.MeshLambertMaterial({ color: 0xffd93c });
    this.cometGeometry = new THREE.SphereGeometry(1, 14, 10);
    this.cometMaterial = new THREE.MeshBasicMaterial({ color: 0x5ab8ff });
    this.cometGlow = new THREE.MeshBasicMaterial({ color: 0xbfe6ff, transparent: true, opacity: 0.45, depthWrite: false });
    // La abeja es su dibujo de Gemini (o una bolita amarilla) que siempre ve a la cámara.
    this.beeMaterial = new THREE.SpriteMaterial({ color: 0xffffff, depthWrite: false });
    if (manifest.objetos.includes('abeja')) {
      new THREE.TextureLoader().load('kart/objetos/abeja.png', (texture) => {
        texture.colorSpace = THREE.SRGBColorSpace;
        this.beeMaterial.map = texture;
        this.beeMaterial.needsUpdate = true;
      });
    } else {
      this.beeMaterial.color.setHex(0xffd02a);
    }
    this.jellyGeometry = new THREE.BoxGeometry(JELLY.width, JELLY.height, JELLY.depth);
    this.jellyMaterial = new THREE.MeshLambertMaterial({ color: 0x7bea5a, emissive: 0x2a6a1a, transparent: true, opacity: 0.75 });
    this.tornadoMaterial = this.spriteMaterial('tornado', 0xb8c8d8);
    this.stickyMaterial = this.spriteMaterial('bomba', 0x2a2a36);
  }

  // El dibujo de Gemini de un poder (o una bolita de ese color) que siempre ve a la cámara.
  spriteMaterial(name, color) {
    const material = new THREE.SpriteMaterial({ color: 0xffffff, depthWrite: false });
    if (manifest.objetos.includes(name)) {
      new THREE.TextureLoader().load(`kart/objetos/${name}.png`, (texture) => {
        texture.colorSpace = THREE.SRGBColorSpace;
        material.map = texture;
        material.needsUpdate = true;
      });
    } else {
      material.color.setHex(color);
    }
    return material;
  }

  // El muro de gelatina: atrás del que lo suelta, atravesado en el camino.
  addJelly(owner) {
    const mesh = new THREE.Mesh(this.jellyGeometry, this.jellyMaterial);
    this.scene.add(mesh);
    this.list.push({
      kind: 'jelly',
      owner,
      mesh,
      hits: JELLY.hits,
      cooldown: new Map(),
      wobbleMs: 0,
      x: owner.x - Math.sin(owner.heading) * JELLY.behind,
      z: owner.z - Math.cos(owner.heading) * JELLY.behind,
      heading: owner.heading,
      index: owner.index,
      ageMs: 0,
    });
  }

  // El tornado: sale adelante del que lo lanza.
  addTornado(owner) {
    const mesh = new THREE.Sprite(this.tornadoMaterial);
    mesh.center.set(0.5, 0.1);
    mesh.scale.setScalar(TORNADO.size);
    this.scene.add(mesh);
    this.list.push({
      kind: 'tornado',
      owner,
      mesh,
      stung: new Set(),
      x: owner.x + Math.sin(owner.heading) * 4,
      z: owner.z + Math.cos(owner.heading) * 4,
      heading: owner.heading,
      index: owner.index,
      ageMs: 0,
    });
  }

  // La bomba pegajosa: vuela hacia `target` (el de adelante; si no hay, derechito).
  addSticky(owner, target) {
    const mesh = new THREE.Sprite(this.stickyMaterial);
    mesh.scale.setScalar(STICKY.size);
    this.scene.add(mesh);
    this.list.push({
      kind: 'sticky',
      owner,
      target,
      mesh,
      stuck: null,
      fuseMs: STICKY.fuseMs,
      passMs: 0,
      x: owner.x + Math.sin(owner.heading) * 3,
      z: owner.z + Math.cos(owner.heading) * 3,
      y: owner.y + 1.5,
      heading: owner.heading,
      index: owner.index,
      ageMs: 0,
    });
  }

  // La abeja: vuela por encima de todo hacia `target` (el primero).
  addBee(owner, target) {
    const mesh = new THREE.Sprite(this.beeMaterial);
    mesh.scale.setScalar(BEE_SIZE);
    this.scene.add(mesh);
    this.list.push({
      kind: 'bee',
      owner,
      target,
      mesh,
      stung: new Set(),
      x: owner.x + Math.sin(owner.heading) * 3,
      z: owner.z + Math.cos(owner.heading) * 3,
      y: owner.y + BEE_HEIGHT,
      heading: owner.heading,
      index: owner.index,
      ageMs: 0,
    });
  }

  // El cometa: una bola azul brillante con su estela, que va por el primer lugar (`target`).
  addComet(owner, target) {
    const mesh = new THREE.Group();
    const core = new THREE.Mesh(this.cometGeometry, this.cometMaterial);
    core.scale.setScalar(0.8);
    const glow = new THREE.Mesh(this.cometGeometry, this.cometGlow);
    glow.scale.setScalar(1.4);
    mesh.add(core, glow);
    // La estela: bolitas cada vez más chicas atrás.
    for (let k = 1; k <= 3; k += 1) {
      const tail = new THREE.Mesh(this.cometGeometry, this.cometGlow);
      tail.scale.setScalar(0.9 - k * 0.22);
      tail.position.z = -k * 1.1;
      mesh.add(tail);
    }
    this.scene.add(mesh);
    this.list.push({
      kind: 'comet',
      owner,
      target,
      mesh,
      x: owner.x + Math.sin(owner.heading) * 3,
      z: owner.z + Math.cos(owner.heading) * 3,
      heading: owner.heading,
      index: owner.index,
      ageMs: 0,
    });
  }

  addRocket(owner, target) {
    const mesh = new THREE.Mesh(this.rocketGeometry, this.rocketMaterial);
    this.scene.add(mesh);
    this.list.push({
      kind: 'rocket',
      owner,
      target,
      mesh,
      x: owner.x + Math.sin(owner.heading) * 3,
      z: owner.z + Math.cos(owner.heading) * 3,
      heading: owner.heading,
      index: owner.index,
      ageMs: 0,
    });
  }

  addBanana(owner) {
    const mesh = new THREE.Mesh(this.bananaGeometry, this.bananaMaterial);
    this.scene.add(mesh);
    this.list.push({
      kind: 'banana',
      owner,
      mesh,
      x: owner.x - Math.sin(owner.heading) * 3.5,
      z: owner.z - Math.cos(owner.heading) * 3.5,
      heading: owner.heading,
      index: owner.index,
      ageMs: 0,
    });
  }

  // `onHit(racer, projectile)` se llama cuando un cohete, plátano o cometa le pega a alguien.
  update(dtMs, racers, track, onHit) {
    const dt = dtMs / 1000;
    this.list = this.list.filter((p) => {
      p.ageMs += dtMs;
      if (p.kind === 'comet') return this.updateComet(p, dt, racers, track, onHit);
      if (p.kind === 'bee') return this.updateBee(p, dt, racers, track, onHit);
      if (p.kind === 'jelly') return this.updateJelly(p, dtMs, racers, track, onHit);
      if (p.kind === 'tornado') return this.updateTornado(p, dt, racers, track, onHit);
      if (p.kind === 'sticky') return this.updateSticky(p, dtMs, racers, track, onHit);
      if (p.kind === 'rocket') {
        if (p.target && !p.target.finished) {
          const desired = Math.atan2(p.target.x - p.x, p.target.z - p.z);
          const diff = Math.atan2(Math.sin(desired - p.heading), Math.cos(desired - p.heading));
          p.heading += Math.max(-ROCKET_TURN * dt, Math.min(ROCKET_TURN * dt, diff));
        }
        p.x += Math.sin(p.heading) * ROCKET_SPEED * dt;
        p.z += Math.cos(p.heading) * ROCKET_SPEED * dt;
        const near = track.closest(p.x, p.z, p.index);
        p.index = near.index;
        // Se estrella contra las llantas o se le acaba el combustible.
        if (near.distance > track.wallDistance || p.ageMs > ROCKET_LIFE_MS) return this.remove(p);
      } else if (p.ageMs > BANANA_LIFE_MS) {
        return this.remove(p);
      }

      // El cohete nunca le pega a quien lo lanzó; su propio plátano sí, pero no en cuanto lo suelta.
      // (En la carrera por equipos, lo de tu equipo no te hace nada.)
      const teammate = (r) => r !== p.owner && r.team !== undefined && r.team === p.owner.team;
      const canHit = (r) => !teammate(r) && (r !== p.owner || (p.kind === 'banana' && p.ageMs > OWNER_GRACE_MS));
      const victim = racers.find((r) => canHit(r) && r.y - r.floor < DODGE_HEIGHT && Math.hypot(r.x - p.x, r.z - p.z) < RACER_RADIUS + 0.8);
      if (victim) {
        onHit(victim, p);
        return this.remove(p);
      }

      // (Sobre el camino, que puede ir de subida o de bajada.)
      p.mesh.position.set(p.x, track.roadHeight(p.x, p.z, p.index) + (p.kind === 'rocket' ? 1 : 0.35), p.z);
      p.mesh.rotation.y = p.heading;
      return true;
    });
  }

  // Sigue la pista (apuntando un poco más adelante sobre ella) y, ya cerca, se va directo al primero.
  // Al llegar explota: le pega a él y a los que estén junto.
  updateComet(p, dt, racers, track, onHit) {
    if (!p.target || p.target.finished || p.ageMs > COMET_LIFE_MS) return this.remove(p);
    // (En la arena no hay pista que seguir: va directo.)
    const close = track.isArena || Math.hypot(p.target.x - p.x, p.target.z - p.z) < COMET_HOMING;
    const aim = close ? p.target : track.pointAt(p.index + COMET_LOOKAHEAD);
    p.heading = Math.atan2(aim.x - p.x, aim.z - p.z);
    p.x += Math.sin(p.heading) * COMET_SPEED * dt;
    p.z += Math.cos(p.heading) * COMET_SPEED * dt;
    p.index = track.closest(p.x, p.z, p.index).index;
    if (Math.hypot(p.target.x - p.x, p.target.z - p.z) < RACER_RADIUS + 1) {
      const teammate = (r) => r.team !== undefined && r.team === p.owner.team;
      for (const r of racers) if (r !== p.owner && !teammate(r) && Math.hypot(r.x - p.x, r.z - p.z) < COMET_BLAST) onHit(r, p);
      return this.remove(p);
    }
    p.mesh.position.set(p.x, track.roadHeight(p.x, p.z, p.index) + COMET_HEIGHT + Math.sin(p.ageMs / 90) * 0.2, p.z);
    p.mesh.rotation.y = p.heading;
    return true;
  }

  // La abeja va directo al primero (sin seguir la pista, por arriba de todo) y pica al que pase cerca.
  updateBee(p, dt, racers, track, onHit) {
    if (!p.target || p.target.finished || p.ageMs > BEE_LIFE_MS) return this.remove(p);
    p.heading = Math.atan2(p.target.x - p.x, p.target.z - p.z);
    p.x += Math.sin(p.heading) * BEE_SPEED * dt;
    p.z += Math.cos(p.heading) * BEE_SPEED * dt;
    p.index = track.closest(p.x, p.z, p.index).index;
    const teammate = (r) => r.team !== undefined && r.team === p.owner.team;
    for (const r of racers) {
      if (r === p.owner || teammate(r) || p.stung.has(r)) continue;
      if (Math.hypot(r.x - p.x, r.z - p.z) < RACER_RADIUS + BEE_STING) {
        p.stung.add(r);
        onHit(r, p);
        if (r === p.target) return this.remove(p);
      }
    }
    const ground = track.isArena ? 0 : track.roadHeight(p.x, p.z, p.index);
    p.y += (ground + BEE_HEIGHT - p.y) * Math.min(1, dt * 3);
    p.mesh.position.set(p.x, p.y + Math.sin(p.ageMs / 70) * 0.35, p.z);
    return true;
  }

  // El muro: el que lo toca rebota (el juego lo frena con onHit) y el muro tiembla; al tercer golpe se revienta.
  updateJelly(p, dtMs, racers, track, onHit) {
    if (p.ageMs > JELLY.lifeMs) return this.remove(p);
    p.wobbleMs = Math.max(0, p.wobbleMs - dtMs);
    const sin = Math.sin(p.heading);
    const cos = Math.cos(p.heading);
    for (const r of racers) {
      const wait = p.cooldown.get(r) ?? 0;
      if (wait > 0) {
        p.cooldown.set(r, wait - dtMs);
        continue;
      }
      if (r === p.owner && p.ageMs < OWNER_GRACE_MS) continue;
      if (r.y - r.floor > JELLY.height) continue;
      const dx = r.x - p.x;
      const dz = r.z - p.z;
      const along = dx * sin + dz * cos;
      const side = dx * cos - dz * sin;
      if (Math.abs(along) > JELLY.depth / 2 + RACER_RADIUS || Math.abs(side) > JELLY.width / 2 + RACER_RADIUS * 0.4) continue;
      p.cooldown.set(r, JELLY.cooldownMs);
      p.wobbleMs = JELLY.wobbleMs;
      p.hits -= 1;
      onHit(r, p);
      if (p.hits <= 0) return this.remove(p);
    }
    const wobble = p.wobbleMs > 0 ? Math.sin(p.wobbleMs / 30) * 0.18 * (p.wobbleMs / JELLY.wobbleMs) : Math.sin(p.ageMs / 300) * 0.03;
    p.mesh.scale.set(1 + wobble, 1 - wobble, 1 + wobble);
    p.mesh.position.set(p.x, track.roadHeight(p.x, p.z, p.index) + (JELLY.height / 2) * (1 - wobble), p.z);
    p.mesh.rotation.y = p.heading;
    return true;
  }

  // El tornado sigue la pista zigzagueando de un lado al otro (en la arena va derecho).
  updateTornado(p, dt, racers, track, onHit) {
    if (p.ageMs > TORNADO.lifeMs) return this.remove(p);
    if (!track.isArena) {
      const aim = track.pointAt(p.index + TORNADO.lookahead, Math.sin(p.ageMs / 700) * TORNADO.weave);
      p.heading = Math.atan2(aim.x - p.x, aim.z - p.z);
    }
    p.x += Math.sin(p.heading) * TORNADO.speed * dt;
    p.z += Math.cos(p.heading) * TORNADO.speed * dt;
    const near = track.closest(p.x, p.z, p.index);
    p.index = near.index;
    if (track.isArena && near.distance > track.wallDistance) return this.remove(p);
    const teammate = (r) => r.team !== undefined && r.team === p.owner.team;
    for (const r of racers) {
      if (r === p.owner || teammate(r) || p.stung.has(r)) continue;
      if (Math.hypot(r.x - p.x, r.z - p.z) < RACER_RADIUS + TORNADO.reach) {
        p.stung.add(r);
        onHit(r, p);
      }
    }
    // Al salir y al acabarse se hace chiquito.
    const grow = Math.min(1, p.ageMs / 300, (TORNADO.lifeMs - p.ageMs) / 400);
    p.mesh.scale.set(TORNADO.size * grow * (1 + Math.sin(p.ageMs / 60) * 0.06), TORNADO.size * grow, 1);
    p.mesh.material.rotation = Math.sin(p.ageMs / 90) * 0.12;
    p.mesh.position.set(p.x, track.isArena ? 0 : track.roadHeight(p.x, p.z, p.index), p.z);
    return true;
  }

  // La bomba: vuela al de adelante, se le pega encima y explota al acabarse la mecha. Si el que la trae choca con
  // otro kart, se la pasa.
  updateSticky(p, dtMs, racers, track, onHit) {
    const dt = dtMs / 1000;
    if (!p.stuck) {
      if (p.ageMs > STICKY.lifeMs) return this.remove(p);
      if (p.target && !p.target.finished) {
        p.heading = Math.atan2(p.target.x - p.x, p.target.z - p.z);
        p.y += (p.target.y + 1.5 - p.y) * Math.min(1, dt * 4);
      }
      p.x += Math.sin(p.heading) * STICKY.speed * dt;
      p.z += Math.cos(p.heading) * STICKY.speed * dt;
      p.index = track.closest(p.x, p.z, p.index).index;
      const teammate = (r) => r.team !== undefined && r.team === p.owner.team;
      const victim = racers.find((r) => r !== p.owner && !teammate(r) && Math.hypot(r.x - p.x, r.z - p.z) < RACER_RADIUS + 1);
      if (victim) {
        p.stuck = victim;
        if (!victim.isCpu) victim.say('¡Se te pegó una bomba! 💣 ¡Chócala con otro!', 1600);
      }
      p.mesh.position.set(p.x, p.y + Math.abs(Math.sin(p.ageMs / 120)) * 0.6, p.z);
      return true;
    }
    p.fuseMs -= dtMs;
    p.passMs = Math.max(0, p.passMs - dtMs);
    // Chocando con otro, se la pasa.
    if (p.passMs === 0) {
      const other = racers.find((r) => r !== p.stuck && Math.hypot(r.x - p.stuck.x, r.z - p.stuck.z) < RACER_RADIUS * 2.1);
      if (other) {
        if (!p.stuck.isCpu) p.stuck.say('¡Se la pasaste! 😜', 1100);
        if (!other.isCpu) other.say('¡Te pasaron la bomba! 💣', 1300);
        p.stuck = other;
        p.passMs = STICKY.passMs;
      }
    }
    const holder = p.stuck;
    if (p.fuseMs <= 0) {
      for (const r of racers) if (Math.hypot(r.x - holder.x, r.z - holder.z) < STICKY.blast) onHit(r, p);
      return this.remove(p);
    }
    // Encima del kart, latiendo cada vez más rápido.
    const beat = 1 + Math.abs(Math.sin(p.ageMs / (p.fuseMs > 1000 ? 140 : 60))) * 0.35;
    p.mesh.scale.setScalar(STICKY.size * beat);
    p.mesh.position.set(holder.x, holder.y + 3.6, holder.z);
    return true;
  }

  remove(p) {
    this.scene.remove(p.mesh);
    return false;
  }

  clear() {
    for (const p of this.list) this.scene.remove(p.mesh);
    this.list = [];
  }

  // Las piezas compartidas no siempre están en la escena al salir, así que se liberan aparte.
  dispose() {
    this.clear();
    const shared = [
      this.rocketGeometry,
      this.rocketMaterial,
      this.bananaGeometry,
      this.bananaMaterial,
      this.cometGeometry,
      this.cometMaterial,
      this.cometGlow,
      this.beeMaterial,
      this.jellyGeometry,
      this.jellyMaterial,
      this.tornadoMaterial,
      this.stickyMaterial,
    ];
    for (const material of [this.beeMaterial, this.tornadoMaterial, this.stickyMaterial]) material.map?.dispose();
    for (const resource of shared) resource.dispose();
  }
}
