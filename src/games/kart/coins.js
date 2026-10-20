import * as THREE from 'three';
import { RACER_RADIUS } from './Racer.js';

// Monedas en la pista: filas de 5 en varios lugares de la vuelta. Cada una te hace un poquito más rápido
// (hasta 10); si te pega un poder se te caen 3. Las que se agarran vuelven a salir al rato.
export const MAX_COINS = 10;
const ROWS = [0.1, 0.32, 0.58, 0.8];
const LANES = [-4, 0, 4, -4];
const PER_ROW = 5;
const GAP = 3;
const RESPAWN_MS = 8000;
const HEIGHT = 1.2;
const REACH = RACER_RADIUS + 0.9;

export class Coins {
  constructor(scene, track) {
    this.coins = [];
    ROWS.forEach((row, k) => {
      const start = Math.round(row * track.count);
      for (let i = 0; i < PER_ROW; i += 1) {
        const spot = track.pointAt(start + i * GAP, LANES[k]);
        this.coins.push({ x: spot.x, y: spot.y, z: spot.z, respawnMs: 0 });
      }
    });
    // Todas en una sola pasada (InstancedMesh): ligero para el Xbox.
    this.mesh = new THREE.InstancedMesh(
      new THREE.CylinderGeometry(0.75, 0.75, 0.18, 16).rotateX(Math.PI / 2),
      new THREE.MeshLambertMaterial({ color: 0xffc93c, emissive: 0x6b4a00 }),
      this.coins.length,
    );
    this.dummy = new THREE.Object3D();
    scene.add(this.mesh);
  }

  // `onCollect(racer)` cuando alguien agarra una (y no trae ya 10).
  update(dtMs, timeMs, racers, onCollect) {
    this.coins.forEach((coin, i) => {
      if (coin.respawnMs > 0) coin.respawnMs = Math.max(0, coin.respawnMs - dtMs);
      const visible = coin.respawnMs === 0;
      if (visible) {
        const taker = racers.find((r) => r.coins < MAX_COINS && Math.hypot(r.x - coin.x, r.z - coin.z) < REACH);
        if (taker) {
          taker.coins += 1;
          coin.respawnMs = RESPAWN_MS;
          onCollect(taker);
        }
      }
      this.dummy.position.set(coin.x, coin.y + HEIGHT + Math.sin(timeMs / 250 + i) * 0.15, coin.z);
      this.dummy.rotation.set(0, timeMs / 300 + i, 0);
      this.dummy.scale.setScalar(coin.respawnMs === 0 ? 1 : 0.001);
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(i, this.dummy.matrix);
    });
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
