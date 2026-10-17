import * as THREE from 'three';
import { RACER_RADIUS } from './Racer.js';

export const ITEMS = {
  rocket: { emoji: '🚀', name: '¡Cohete!' },
  banana: { emoji: '🍌', name: '¡Plátano!' },
  turbo: { emoji: '⚡', name: '¡Súper turbo!' },
  shield: { emoji: '🛡️', name: '¡Burbuja!' },
};

// Como en Mario Kart: el que va adelante recibe cosas para defenderse
// y los de atrás, cosas para alcanzar.
const TABLES = {
  front: { banana: 45, shield: 35, rocket: 15, turbo: 5 },
  middle: { rocket: 35, banana: 30, turbo: 20, shield: 15 },
  back: { turbo: 40, rocket: 40, shield: 10, banana: 10 },
};

// `place` es 0 para el primer lugar y 1 para el último.
export function rollItem(place) {
  const table = place < 0.2 ? TABLES.front : place < 0.7 ? TABLES.middle : TABLES.back;
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

// Cajitas "?" en filas a lo largo de la pista. Al pasar por una te da un poder (si no traes uno).
export class ItemBoxes {
  constructor(scene, track) {
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
    for (const row of BOX_ROWS) {
      for (const lane of BOX_LANES) {
        const spot = track.pointAt(Math.round(row * track.count), lane);
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(spot.x, 1.6, spot.z);
        scene.add(mesh);
        this.boxes.push({ x: spot.x, z: spot.z, mesh, respawnMs: 0, phase: Math.random() * 6 });
      }
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
      box.mesh.position.y = 1.6 + Math.sin(timeMs / 300 + box.phase) * 0.3;
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

// Cohetes que persiguen al de adelante y plátanos que se quedan en la pista.
export class Projectiles {
  constructor(scene) {
    this.scene = scene;
    this.list = [];
    this.rocketGeometry = new THREE.ConeGeometry(0.45, 1.8, 8).rotateX(Math.PI / 2);
    this.rocketMaterial = new THREE.MeshLambertMaterial({ color: 0xff5a5f });
    this.bananaGeometry = new THREE.TorusGeometry(0.7, 0.28, 6, 12, Math.PI);
    this.bananaMaterial = new THREE.MeshLambertMaterial({ color: 0xffd93c });
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
      ageMs: 0,
    });
  }

  // `onHit(racer, projectile)` se llama cuando un cohete o plátano le pega a alguien.
  update(dtMs, racers, track, onHit) {
    const dt = dtMs / 1000;
    this.list = this.list.filter((p) => {
      p.ageMs += dtMs;
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
      const canHit = (r) => r !== p.owner || (p.kind === 'banana' && p.ageMs > OWNER_GRACE_MS);
      const victim = racers.find((r) => canHit(r) && Math.hypot(r.x - p.x, r.z - p.z) < RACER_RADIUS + 0.8);
      if (victim) {
        onHit(victim, p);
        return this.remove(p);
      }

      p.mesh.position.set(p.x, p.kind === 'rocket' ? 1 : 0.35, p.z);
      p.mesh.rotation.y = p.heading;
      return true;
    });
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
    for (const resource of [this.rocketGeometry, this.rocketMaterial, this.bananaGeometry, this.bananaMaterial]) resource.dispose();
  }
}
