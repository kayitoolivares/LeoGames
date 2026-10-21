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
};

// Como en Mario Kart: el que va adelante recibe cosas para defenderse
// y los de atrás, cosas para alcanzar.
const TABLES = {
  front: { banana: 28, shield: 26, banana3: 18, rocket: 10, turbo: 5, ink: 5, ghost: 8 },
  middle: { rocket: 22, banana: 12, turbo: 13, ink: 12, banana3: 8, shield: 8, comet: 5, lightning: 4, ghost: 7, star: 5, bee: 4 },
  back: { turbo: 17, rocket: 18, comet: 12, lightning: 10, ink: 9, shield: 4, star: 12, bullet: 11, bee: 7 },
  // En la batalla no hay pista para la bala ni primer lugar para la abeja.
  battle: { rocket: 22, banana: 12, turbo: 12, ink: 10, banana3: 10, shield: 10, comet: 6, lightning: 6, ghost: 6, star: 6 },
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
      const victim = racers.find((r) => canHit(r) && Math.hypot(r.x - p.x, r.z - p.z) < RACER_RADIUS + 0.8);
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
    const shared = [this.rocketGeometry, this.rocketMaterial, this.bananaGeometry, this.bananaMaterial, this.cometGeometry, this.cometMaterial, this.cometGlow, this.beeMaterial];
    this.beeMaterial.map?.dispose();
    for (const resource of shared) resource.dispose();
  }
}
