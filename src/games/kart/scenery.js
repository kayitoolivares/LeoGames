import * as THREE from 'three';

const FLAKES = 900;
const SNOW_TOP = 45;
const SNOW_SPEED = 7;
const SNOWMEN_EVERY = 70;

// Monos de nieve a los lados de la pista (afuera de las llantas), alternando de lado.
export function addSnowmen(scene, track) {
  const white = new THREE.MeshLambertMaterial({ color: 0xffffff });
  const coal = new THREE.MeshLambertMaterial({ color: 0x1b1530 });
  const carrot = new THREE.MeshLambertMaterial({ color: 0xff8a2f });
  const body = new THREE.SphereGeometry(1, 10, 8);
  const nose = new THREE.ConeGeometry(0.18, 0.8, 6);
  for (let i = 30, side = 1; i < track.count; i += SNOWMEN_EVERY, side = -side) {
    const spot = track.pointAt(i, side * (track.wallDistance + 5));
    const snowman = new THREE.Group();
    for (const [y, r] of [[1.3, 1.4], [3.2, 1.05], [4.7, 0.75]]) {
      const ball = new THREE.Mesh(body, white);
      ball.scale.setScalar(r);
      ball.position.y = y;
      snowman.add(ball);
    }
    for (const x of [-0.28, 0.28]) {
      const eye = new THREE.Mesh(body, coal);
      eye.scale.setScalar(0.11);
      eye.position.set(x, 4.9, 0.68);
      snowman.add(eye);
    }
    const tip = new THREE.Mesh(nose, carrot);
    tip.rotation.x = Math.PI / 2;
    tip.position.set(0, 4.7, 1.1);
    snowman.add(tip);
    snowman.position.set(spot.x, 0, spot.z);
    // Viendo hacia la pista.
    snowman.rotation.y = spot.heading + (side > 0 ? -Math.PI / 2 : Math.PI / 2);
    scene.add(snowman);
  }
}

// Copos que caen sobre toda la pista. Son puntos de una sola geometría (ligero para el Xbox).
export class Snowfall {
  constructor(scene, track) {
    const xs = track.points.map((p) => p.x);
    const zs = track.points.map((p) => p.z);
    this.box = {
      minX: Math.min(...xs) - 40,
      maxX: Math.max(...xs) + 40,
      minZ: Math.min(...zs) - 40,
      maxZ: Math.max(...zs) + 40,
    };
    const positions = new Float32Array(FLAKES * 3);
    for (let i = 0; i < FLAKES; i += 1) {
      positions[i * 3] = this.box.minX + Math.random() * (this.box.maxX - this.box.minX);
      positions[i * 3 + 1] = Math.random() * SNOW_TOP;
      positions[i * 3 + 2] = this.box.minZ + Math.random() * (this.box.maxZ - this.box.minZ);
    }
    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.points = new THREE.Points(
      this.geometry,
      new THREE.PointsMaterial({ map: flakeTexture(), size: 1.3, transparent: true, depthWrite: false }),
    );
    this.time = 0;
    scene.add(this.points);
  }

  update(dt) {
    this.time += dt;
    const positions = this.geometry.attributes.position.array;
    for (let i = 0; i < FLAKES; i += 1) {
      const y = i * 3 + 1;
      positions[y] -= SNOW_SPEED * dt;
      positions[i * 3] += Math.sin(this.time + i) * 1.5 * dt;
      if (positions[y] < 0) positions[y] += SNOW_TOP;
    }
    this.geometry.attributes.position.needsUpdate = true;
  }
}

// Copo redondo y borroso (sin textura los puntos se ven como cuadros).
function flakeTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 32;
  const ctx = canvas.getContext('2d');
  const glow = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
  glow.addColorStop(0, 'rgba(255, 255, 255, 1)');
  glow.addColorStop(0.5, 'rgba(255, 255, 255, 0.8)');
  glow.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, 32, 32);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
