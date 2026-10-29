import * as THREE from 'three';
import { glowTexture, roadside } from './scenery.js';

// Paisajes de la Copa Tesoro (ver addScenery en scenery.js). Todo con figuras sencillas y en pocos pedazos
// (InstancedMesh) para que el Xbox no sufra.
export function addTreasureScenery(scene, track, kind) {
  if (kind === 'desert') return addDesert(scene, track);
  if (kind === 'city') return addCity(scene, track);
  if (kind === 'house') return addHouse(scene, track);
  if (kind === 'pirate') return addPirate(scene, track);
  return null;
}

// Pone cada lugar de `spots` en un InstancedMesh (con `place(dummy, spot, i)` para moverlo, girarlo y escalarlo).
export function instances(scene, geometry, material, spots, place, colors = null) {
  const mesh = new THREE.InstancedMesh(geometry, material, spots.length);
  const dummy = new THREE.Object3D();
  const color = new THREE.Color();
  spots.forEach((spot, i) => {
    dummy.position.set(spot.x, spot.y, spot.z);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(1, 1, 1);
    place(dummy, spot, i);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
    if (colors) mesh.setColorAt(i, color.setHex(colors[i % colors.length]));
  });
  scene.add(mesh);
  return mesh;
}

// Lugares lejos del camino (de `far` a `far + spread` afuera de las llantas) para cosas grandes.
export function farSpots(track, every, far, spread) {
  return roadside(track, every, far).map((spot, i) => {
    const out = ((i * 37) % 10) / 10;
    const p = track.pointAt(spot.index, Math.sign(track.lateral(spot.x, spot.z, spot.index) || 1) * (track.wallDistance + far + out * spread));
    return { ...p, y: track.groundHeight(p.x, p.z) };
  });
}

// Desierto: cactus con brazos junto al camino, piedras rojizas, dos pirámides y rodadoras que ruedan con el viento.
function addDesert(scene, track) {
  const green = new THREE.MeshLambertMaterial({ color: 0x3f9a4a });
  const cacti = roadside(track, 16, 4);
  instances(scene, new THREE.CapsuleGeometry(0.9, 6, 4, 10), green, cacti, (d, s, i) => {
    d.position.y += 3.6;
    d.scale.setScalar(0.8 + (i % 3) * 0.2);
  });
  // Los brazos: uno de cada lado, uno más alto que el otro.
  const arms = cacti.flatMap((s, i) => [
    { ...s, side: 1, k: i },
    { ...s, side: -1, k: i },
  ]);
  instances(scene, new THREE.CapsuleGeometry(0.55, 2.4, 4, 8), green, arms, (d, s) => {
    const size = 0.8 + (s.k % 3) * 0.2;
    d.position.set(s.x + s.side * 1.5 * size, s.y + (s.side > 0 ? 4.4 : 3.4) * size, s.z);
    d.scale.setScalar(size);
  });
  const rocks = roadside(track, 23, 12);
  instances(scene, new THREE.DodecahedronGeometry(2.2, 0), new THREE.MeshLambertMaterial({ color: 0xc8703a, flatShading: true }), rocks, (d, s, i) => {
    d.position.y += 0.8;
    d.rotation.set(i, i * 2, 0);
    d.scale.set(1 + (i % 3) * 0.5, 0.7 + (i % 2) * 0.4, 1 + (i % 4) * 0.3);
  });
  // Pirámides allá lejos.
  const sand = new THREE.MeshLambertMaterial({ color: 0xe0b46a, flatShading: true });
  for (const [x, z, size] of [
    [-230, -220, 46],
    [-170, -250, 30],
    [240, 210, 38],
  ]) {
    const pyramid = new THREE.Mesh(new THREE.ConeGeometry(size, size * 0.9, 4), sand);
    pyramid.position.set(x, (size * 0.9) / 2, z);
    pyramid.rotation.y = Math.PI / 4;
    scene.add(pyramid);
  }
  // Rodadoras de adorno que cruzan rodando a lo lejos.
  const weeds = Array.from({ length: 5 }, (_, i) => {
    const weed = new THREE.Mesh(new THREE.IcosahedronGeometry(1.4, 0), new THREE.MeshLambertMaterial({ color: 0xb08850, wireframe: true }));
    scene.add(weed);
    return { weed, z: -180 + i * 90, speed: 6 + i * 1.5, x: -260 + i * 70 };
  });
  return {
    update(dt) {
      for (const w of weeds) {
        w.x += w.speed * dt;
        if (w.x > 260) w.x = -260;
        w.weed.position.set(w.x, 1.4 + Math.abs(Math.sin(w.x * 0.3)) * 1.5, w.z);
        w.weed.rotation.z -= w.speed * dt * 0.7;
      }
    },
  };
}

// Ciudad de noche: edificios con ventanas encendidas, postes de luz y letreros de neón que parpadean.
function addCity(scene, track) {
  const windows = windowTexture();
  const buildings = farSpots(track, 12, 8, 30);
  const heights = buildings.map((_, i) => 14 + ((i * 7) % 5) * 7);
  const material = new THREE.MeshLambertMaterial({ map: windows, emissive: 0xffffff, emissiveMap: windows, emissiveIntensity: 0.8 });
  instances(
    scene,
    new THREE.BoxGeometry(1, 1, 1),
    material,
    buildings,
    (d, s, i) => {
      d.position.y += heights[i] / 2;
      d.rotation.y = s.heading;
      d.scale.set(9 + (i % 3) * 3, heights[i], 9 + ((i + 1) % 3) * 3);
    },
    [0x4a3a7a, 0x2a3a6a, 0x5a2a5a, 0x2a4a5a],
  );
  // Postes de luz junto al camino, con su brillo.
  const lamps = roadside(track, 14, 1.5);
  instances(scene, new THREE.CylinderGeometry(0.15, 0.2, 6, 6), new THREE.MeshLambertMaterial({ color: 0x55516a }), lamps, (d) => {
    d.position.y += 3;
  });
  for (const s of lamps) {
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: 0xfff1b0, blending: THREE.AdditiveBlending, depthWrite: false }));
    glow.position.set(s.x, s.y + 6.2, s.z);
    glow.scale.setScalar(3.4);
    scene.add(glow);
  }
  // Letreros de neón en los edificios: prenden y apagan.
  const neon = [0xff3bd2, 0x3fe0ff, 0xffe14d, 0x7cff6b];
  const signs = buildings
    .filter((_, i) => i % 3 === 0)
    .map((s, k) => {
      const sign = new THREE.Mesh(new THREE.BoxGeometry(6, 1.6, 0.4), new THREE.MeshBasicMaterial({ color: neon[k % neon.length] }));
      const toward = Math.atan2(-s.x, -s.z);
      sign.position.set(s.x + Math.sin(toward) * 7, s.y + 9 + (k % 2) * 4, s.z + Math.cos(toward) * 7);
      sign.rotation.y = toward;
      scene.add(sign);
      return sign;
    });
  let time = 0;
  return {
    update(dt) {
      time += dt;
      signs.forEach((sign, k) => {
        sign.visible = Math.sin(time * (1.5 + k * 0.3) + k) > -0.6;
      });
    },
  };
}

// Casa gigante: el camino va por el piso de una casa; junto al camino, juguetes, libros, crayolas y patas de mesa
// y sillas enormes.
function addHouse(scene, track) {
  const books = roadside(track, 19, 4);
  const bookColors = [0xe53935, 0x3fa7ff, 0x4cd97b, 0xffc93c, 0xb07cff];
  // Pilas de 3 libros.
  const stack = books.flatMap((s, i) => [0, 1, 2].map((k) => ({ ...s, k, i })));
  instances(
    scene,
    new THREE.BoxGeometry(5, 1.2, 3.6),
    new THREE.MeshLambertMaterial(),
    stack,
    (d, s) => {
      d.position.y += 0.6 + s.k * 1.2;
      d.rotation.y = s.heading + (s.k - 1) * 0.25 + s.i;
    },
    bookColors,
  );
  // Crayolas acostadas.
  const crayons = roadside(track, 27, 9);
  instances(
    scene,
    new THREE.CylinderGeometry(0.7, 0.7, 7, 10),
    new THREE.MeshLambertMaterial(),
    crayons,
    (d, s, i) => {
      d.position.y += 0.7;
      d.rotation.set(Math.PI / 2, 0, s.heading + i);
    },
    [0xff5a5f, 0x4cd97b, 0x3fa7ff, 0xffd02a],
  );
  // Patas de mesas y sillas gigantes, lejos del camino.
  const legs = farSpots(track, 30, 10, 20).flatMap((s, i) =>
    [
      [-1, -1],
      [1, -1],
      [-1, 1],
      [1, 1],
    ].map(([a, b]) => ({ ...s, a, b, big: i % 2 === 0 })),
  );
  instances(scene, new THREE.CylinderGeometry(1.2, 1.5, 1, 10), new THREE.MeshLambertMaterial({ color: 0x8a5a3a }), legs, (d, s) => {
    const size = s.big ? 16 : 9;
    const height = s.big ? 34 : 16;
    d.position.set(s.x + s.a * size, s.y + height / 2, s.z + s.b * size);
    d.scale.set(s.big ? 1.6 : 1, height, s.big ? 1.6 : 1);
  });
  const tops = farSpots(track, 30, 10, 20);
  instances(scene, new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial({ color: 0xa8704a }), tops, (d, s, i) => {
    const big = i % 2 === 0;
    d.position.y += big ? 35 : 16.5;
    d.scale.set(big ? 38 : 22, big ? 2 : 1.5, big ? 38 : 22);
  });
  // Bloques de juguete con letras de colores.
  const blocks = roadside(track, 23, 14);
  instances(
    scene,
    new THREE.BoxGeometry(3, 3, 3),
    new THREE.MeshLambertMaterial(),
    blocks,
    (d, s, i) => {
      d.position.y += 1.5;
      d.rotation.y = i * 0.7;
    },
    [0xff8a1e, 0x3fa7ff, 0x4cd97b, 0xe53935],
  );
  return null;
}

// Barco pirata (el piso de la pista es el mar): un barco grande anclado, islitas con palmeras, barriles y un cofre que brilla.
function addPirate(scene, track) {
  // El barco: casco, cubierta, dos mástiles con velas y la bandera.
  const ship = new THREE.Group();
  const wood = new THREE.MeshLambertMaterial({ color: 0x7a4a2a });
  const hull = new THREE.Mesh(new THREE.CylinderGeometry(8, 5, 46, 4, 1), wood);
  hull.rotation.set(Math.PI / 2, 0, Math.PI / 4);
  hull.scale.set(1, 1, 0.75);
  hull.position.y = 4;
  ship.add(hull);
  const sail = new THREE.MeshLambertMaterial({ color: 0xfff6e0, side: THREE.DoubleSide });
  for (const [z, height] of [
    [-9, 30],
    [10, 26],
  ]) {
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.8, height, 8), wood);
    mast.position.set(0, 8 + height / 2, z);
    const cloth = new THREE.Mesh(new THREE.PlaneGeometry(16, height * 0.55), sail);
    cloth.position.set(0, 10 + height * 0.55, z + 0.8);
    ship.add(mast, cloth);
  }
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(6, 4), new THREE.MeshBasicMaterial({ color: 0x1b1530, side: THREE.DoubleSide }));
  flag.position.set(3, 41, -9);
  ship.add(flag);
  const spot = farSpots(track, 1000, 40, 0)[0] ?? { x: 160, y: 0, z: 0 };
  ship.position.set(spot.x * 1.2, 0, spot.z * 1.2);
  ship.rotation.y = Math.atan2(spot.x, spot.z);
  scene.add(ship);
  // Islitas con palmera.
  const islands = farSpots(track, 26, 16, 26);
  instances(scene, new THREE.SphereGeometry(5, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshLambertMaterial({ color: 0xf2d48a }), islands, (d) => {
    d.position.y = -1.2;
    d.scale.set(1, 0.5, 1);
  });
  instances(scene, new THREE.CylinderGeometry(0.35, 0.5, 9, 6), new THREE.MeshLambertMaterial({ color: 0x8a5a3a }), islands, (d) => {
    d.position.y = 3.4;
    d.rotation.z = 0.2;
  });
  instances(scene, new THREE.ConeGeometry(4, 2, 7), new THREE.MeshLambertMaterial({ color: 0x3cc44f }), islands, (d) => {
    d.position.set(d.position.x + 0.9, 8.2, d.position.z);
  });
  // Barriles junto al camino.
  const barrels = roadside(track, 15, 2.5);
  instances(scene, new THREE.CylinderGeometry(1, 1, 2.2, 10), new THREE.MeshLambertMaterial({ color: 0x9a6a3a }), barrels, (d) => {
    d.position.y += 1.1;
  });
  // El cofre del tesoro, con su brillo.
  const chestSpot = roadside(track, 400, 7)[1] ?? roadside(track, 400, 7)[0];
  const glows = [];
  if (chestSpot) {
    const chest = new THREE.Mesh(new THREE.BoxGeometry(3.4, 2.2, 2.2), new THREE.MeshLambertMaterial({ color: 0x8a5a2a }));
    chest.position.set(chestSpot.x, chestSpot.y + 1.1, chestSpot.z);
    const gold = new THREE.Mesh(new THREE.SphereGeometry(1.3, 10, 6), new THREE.MeshLambertMaterial({ color: 0xffd02a, emissive: 0x8a6a00 }));
    gold.position.set(chestSpot.x, chestSpot.y + 2.4, chestSpot.z);
    gold.scale.set(1.2, 0.5, 0.8);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: 0xffe14d, blending: THREE.AdditiveBlending, depthWrite: false }));
    glow.position.set(chestSpot.x, chestSpot.y + 2.8, chestSpot.z);
    scene.add(chest, gold, glow);
    glows.push(glow);
  }
  let time = 0;
  return {
    update(dt) {
      time += dt;
      // El barco se mece y el cofre brilla.
      ship.rotation.z = Math.sin(time * 0.8) * 0.04;
      ship.position.y = Math.sin(time * 1.1) * 0.4;
      flag.rotation.y = Math.sin(time * 3) * 0.3;
      for (const glow of glows) glow.scale.setScalar(5 + Math.sin(time * 4) * 0.8);
    },
  };
}

// Ventanitas encendidas (unas sí y otras no) para los edificios de la ciudad.
let windowsCache = null;
function windowTexture() {
  if (windowsCache) return windowsCache;
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, 64, 128);
  for (let y = 6; y < 124; y += 12) {
    for (let x = 6; x < 60; x += 14) {
      ctx.fillStyle = Math.sin(x * 12.9 + y * 78.2) > 0.1 ? '#ffe9a0' : '#1b1530';
      ctx.fillRect(x, y, 8, 7);
    }
  }
  windowsCache = new THREE.CanvasTexture(canvas);
  windowsCache.colorSpace = THREE.SRGBColorSpace;
  windowsCache.wrapS = THREE.RepeatWrapping;
  windowsCache.wrapT = THREE.RepeatWrapping;
  return windowsCache;
}
