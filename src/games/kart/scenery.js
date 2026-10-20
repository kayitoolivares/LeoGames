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

// Los adornos de cada pista con tema (los pinos, palmeras y paletas los pone la pista misma).
// Devuelve algo con update(dt) si hay que mover algo (antorchas), o null.
export function addScenery(scene, track, kind) {
  if (kind === 'beach') addBeach(scene, track);
  else if (kind === 'candy') addGumdrops(scene, track);
  else if (kind === 'castle') return addCastle(scene, track);
  else if (kind === 'space') addSpace(scene);
  return null;
}

// Playa: el mar más allá de la pista (del lado de abajo), con su espuma, y sombrillas de colores junto al camino.
export const SEA_GAP = 30;
function addBeach(scene, track) {
  const maxZ = Math.max(...track.points.map((p) => p.z));
  const size = 700 * track.scale;
  const shore = maxZ + SEA_GAP;
  const depth = size / 2 - shore;
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(size, depth), new THREE.MeshLambertMaterial({ color: 0x2fa8e0 }));
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(0, 0.03, shore + depth / 2);
  const foam = new THREE.Mesh(new THREE.PlaneGeometry(size, 3), new THREE.MeshLambertMaterial({ color: 0xe8f8ff }));
  foam.rotation.x = -Math.PI / 2;
  foam.position.set(0, 0.04, shore);
  scene.add(sea, foam);

  const spots = roadside(track, 45, 6);
  const tops = new THREE.InstancedMesh(new THREE.ConeGeometry(2.6, 1.2, 10), new THREE.MeshLambertMaterial(), spots.length);
  const poles = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.1, 0.1, 3.4, 5), new THREE.MeshLambertMaterial({ color: 0xffffff }), spots.length);
  const colors = [0xff5a5f, 0xffd02a, 0x3fa7ff, 0x4cd97b];
  const matrix = new THREE.Matrix4();
  const color = new THREE.Color();
  spots.forEach(({ x, z }, i) => {
    poles.setMatrixAt(i, matrix.makeTranslation(x, 1.7, z));
    tops.setMatrixAt(i, matrix.makeTranslation(x, 3.6, z));
    tops.setColorAt(i, color.setHex(colors[i % colors.length]));
  });
  scene.add(tops, poles);
}

// Dulcelandia: gomitas de colores a los lados del camino.
function addGumdrops(scene, track) {
  const spots = roadside(track, 18, 3.5);
  const drops = new THREE.InstancedMesh(
    new THREE.SphereGeometry(1.5, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshLambertMaterial(),
    spots.length,
  );
  const colors = [0xff5fa8, 0x7fe0c8, 0xffd02a, 0xb07cff, 0xff8a5c, 0x6fd3ff];
  const matrix = new THREE.Matrix4();
  const color = new THREE.Color();
  spots.forEach(({ x, z }, i) => {
    drops.setMatrixAt(i, matrix.makeTranslation(x, 0, z));
    drops.setColorAt(i, color.setHex(colors[i % colors.length]));
  });
  scene.add(drops);
}

// Castillo: un castillo de piedra en medio de la pista (torres con techos de colores y banderas)
// y antorchas a los lados del camino, con fuego que se mueve.
function addCastle(scene, track) {
  const stone = new THREE.MeshLambertMaterial({ color: 0x8a8698 });
  const dark = new THREE.MeshLambertMaterial({ color: 0x5e5a6e });
  const castle = new THREE.Group();
  const add = (geometry, material, x, y, z) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    castle.add(mesh);
    return mesh;
  };
  add(new THREE.BoxGeometry(30, 16, 20), stone, 0, 8, 0);
  add(new THREE.BoxGeometry(6, 9, 1), dark, 0, 4.5, 10.1);
  for (let k = -3; k <= 3; k += 1) {
    add(new THREE.BoxGeometry(2.4, 2.4, 2.4), stone, k * 4.2, 17.2, 9);
    add(new THREE.BoxGeometry(2.4, 2.4, 2.4), stone, k * 4.2, 17.2, -9);
  }
  const roofs = [0xc0392b, 0x3a5bd6];
  [[-17, -12], [17, -12], [-17, 12], [17, 12]].forEach(([x, z], i) => {
    add(new THREE.CylinderGeometry(4, 4.4, 26, 10), stone, x, 13, z);
    add(new THREE.ConeGeometry(5.4, 9, 10), new THREE.MeshLambertMaterial({ color: roofs[i % 2] }), x, 30.5, z);
    add(new THREE.CylinderGeometry(0.15, 0.15, 5, 5), dark, x, 37, z);
    add(new THREE.BoxGeometry(0.2, 2, 3.2), new THREE.MeshLambertMaterial({ color: 0xffd02a }), x, 38.4, z + 1.6);
  });
  scene.add(castle);

  const spots = roadside(track, 30, 2.5);
  const posts = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.2, 0.25, 3.4, 6), dark, spots.length);
  const matrix = new THREE.Matrix4();
  const flames = spots.map(({ x, z }, i) => {
    posts.setMatrixAt(i, matrix.makeTranslation(x, 1.7, z));
    const flame = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: 0xff9a3c, blending: THREE.AdditiveBlending, depthWrite: false }));
    flame.position.set(x, 3.8, z);
    flame.scale.setScalar(2.2);
    scene.add(flame);
    return flame;
  });
  scene.add(posts);
  let time = 0;
  return {
    update(dt) {
      time += dt;
      flames.forEach((flame, i) => flame.scale.setScalar(2 + Math.sin(time * 9 + i * 1.7) * 0.35));
    },
  };
}

// Espacio: estrellas por todo el cielo y planetas a lo lejos.
function addSpace(scene) {
  const STARS = 700;
  const positions = new Float32Array(STARS * 3);
  for (let i = 0; i < STARS; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const up = 0.08 + Math.random() * 0.9;
    const r = 400;
    positions[i * 3] = Math.cos(angle) * Math.cos(up) * r;
    positions[i * 3 + 1] = Math.sin(up) * r;
    positions[i * 3 + 2] = Math.sin(angle) * Math.cos(up) * r;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  scene.add(new THREE.Points(geometry, new THREE.PointsMaterial({ color: 0xffffff, size: 2.5, sizeAttenuation: false })));
  const planets = [
    { r: 40, color: 0xff9a3c, at: [260, 110, -240] },
    { r: 26, color: 0x5ab8ff, at: [-280, 80, 140], ring: true },
    { r: 16, color: 0xd36bff, at: [80, 150, 320] },
  ];
  for (const { r, color, at } of planets) {
    const planet = new THREE.Mesh(new THREE.SphereGeometry(r, 24, 16), new THREE.MeshBasicMaterial({ color }));
    planet.position.set(...at);
    scene.add(planet);
  }
  const ring = new THREE.Mesh(new THREE.TorusGeometry(42, 3, 6, 40), new THREE.MeshBasicMaterial({ color: 0xbfe6ff }));
  ring.position.set(...planets[1].at);
  ring.rotation.set(1.2, 0.3, 0);
  scene.add(ring);
}

// Lugares a los lados del camino (afuera de las llantas), cada `every` muestras y alternando de lado.
function roadside(track, every, gap) {
  const spots = [];
  for (let i = 10, side = 1; i < track.count; i += every, side = -side) spots.push(track.pointAt(i, side * (track.wallDistance + gap)));
  return spots;
}

// Bolita de luz difuminada (fuego de las antorchas).
let glow = null;
function glowTexture() {
  if (glow) return glow;
  const canvas = document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 32;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
  gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
  gradient.addColorStop(0.35, 'rgba(255, 230, 160, 0.9)');
  gradient.addColorStop(1, 'rgba(255, 140, 40, 0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 32, 32);
  glow = new THREE.CanvasTexture(canvas);
  return glow;
}
