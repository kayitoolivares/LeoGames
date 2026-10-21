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
    snowman.position.set(spot.x, track.groundHeight(spot.x, spot.z), spot.z);
    // Viendo hacia la pista.
    snowman.rotation.y = spot.heading + (side > 0 ? -Math.PI / 2 : Math.PI / 2);
    scene.add(snowman);
  }
}

// Copos que caen sobre toda la pista (o, con `rise`, burbujas o chispitas de lava que suben). Son puntos de una sola
// geometría (ligero para el Xbox). `bubble`: dibujo de burbuja en vez de copo; `glow`: brillan (se suman a la luz).
export class Snowfall {
  constructor(scene, track, { count = FLAKES, speed = SNOW_SPEED, size = 1.3, color = 0xffffff, rise = false, bubble = false, glow = false } = {}) {
    this.count = count;
    this.speed = speed;
    this.rise = rise;
    const xs = track.points.map((p) => p.x);
    const zs = track.points.map((p) => p.z);
    this.box = {
      minX: Math.min(...xs) - 40,
      maxX: Math.max(...xs) + 40,
      minZ: Math.min(...zs) - 40,
      maxZ: Math.max(...zs) + 40,
    };
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i += 1) {
      positions[i * 3] = this.box.minX + Math.random() * (this.box.maxX - this.box.minX);
      positions[i * 3 + 1] = Math.random() * SNOW_TOP;
      positions[i * 3 + 2] = this.box.minZ + Math.random() * (this.box.maxZ - this.box.minZ);
    }
    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.points = new THREE.Points(
      this.geometry,
      new THREE.PointsMaterial({
        map: bubble ? bubbleTexture() : flakeTexture(),
        color,
        size,
        transparent: true,
        depthWrite: false,
        blending: glow ? THREE.AdditiveBlending : THREE.NormalBlending,
      }),
    );
    this.time = 0;
    scene.add(this.points);
  }

  update(dt) {
    this.time += dt;
    const positions = this.geometry.attributes.position.array;
    for (let i = 0; i < this.count; i += 1) {
      const y = i * 3 + 1;
      positions[y] += (this.rise ? 1 : -1) * this.speed * dt;
      positions[i * 3] += Math.sin(this.time + i) * 1.5 * dt;
      if (positions[y] < 0) positions[y] += SNOW_TOP;
      else if (positions[y] > SNOW_TOP) positions[y] -= SNOW_TOP;
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
  else if (kind === 'jungle') addJungle(scene, track);
  else if (kind === 'sea') return addSea(scene, track);
  else if (kind === 'toys') addToys(scene, track);
  else if (kind === 'volcano') return addVolcano(scene, track);
  else if (kind === 'haunted') return addHaunted(scene, track);
  else if (kind === 'party') return addParty(scene, track);
  else if (kind === 'dinos') addDinos(scene, track);
  else if (kind === 'clouds') addClouds(scene, track);
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
  spots.forEach(({ x, y, z }, i) => {
    poles.setMatrixAt(i, matrix.makeTranslation(x, y + 1.7, z));
    tops.setMatrixAt(i, matrix.makeTranslation(x, y + 3.6, z));
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
  spots.forEach(({ x, y, z }, i) => {
    drops.setMatrixAt(i, matrix.makeTranslation(x, y, z));
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
  const flames = spots.map(({ x, y, z }, i) => {
    posts.setMatrixAt(i, matrix.makeTranslation(x, y + 1.7, z));
    const flame = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: 0xff9a3c, blending: THREE.AdditiveBlending, depthWrite: false }));
    flame.position.set(x, y + 3.8, z);
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

// Selva: matorrales de distintos verdes con flores de colores, a los dos lados del camino.
function addJungle(scene, track) {
  const spots = roadside(track, 12, 4);
  const bushes = new THREE.InstancedMesh(new THREE.SphereGeometry(2.4, 10, 7), new THREE.MeshLambertMaterial(), spots.length);
  const flowers = new THREE.InstancedMesh(new THREE.SphereGeometry(0.7, 8, 6), new THREE.MeshLambertMaterial(), spots.length);
  const greens = [0x2e8b3a, 0x3fa34d, 0x267a36, 0x4cb050];
  const petals = [0xff4d6d, 0xffd02a, 0xff8a1e, 0xd36bff];
  const matrix = new THREE.Matrix4();
  const color = new THREE.Color();
  const size = new THREE.Vector3();
  const place = new THREE.Vector3();
  const still = new THREE.Quaternion();
  spots.forEach(({ x, y, z }, i) => {
    const grow = 0.8 + (i % 3) * 0.25;
    bushes.setMatrixAt(i, matrix.compose(place.set(x, y + 0.8 * grow, z), still, size.set(1.3 * grow, 0.8 * grow, 1.3 * grow)));
    bushes.setColorAt(i, color.setHex(greens[i % greens.length]));
    flowers.setMatrixAt(i, matrix.makeTranslation(x + 1.1, y + 2.3 * grow, z + 0.6));
    flowers.setColorAt(i, color.setHex(petals[i % petals.length]));
  });
  scene.add(bushes, flowers);
}

// Fondo del mar: corales de colores y algas que se mecen junto al camino, y burbujas que suben.
function addSea(scene, track) {
  const spots = roadside(track, 10, 4);
  const corals = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1.6), new THREE.MeshLambertMaterial(), spots.length);
  const colors = [0xff6f91, 0xff9a3c, 0xb07cff, 0xffd02a, 0x4dd9c8];
  const matrix = new THREE.Matrix4();
  const color = new THREE.Color();
  spots.forEach(({ x, y, z }, i) => {
    corals.setMatrixAt(i, matrix.makeTranslation(x, y + 0.8, z));
    corals.setColorAt(i, color.setHex(colors[i % colors.length]));
  });
  // Las algas: tiras verdes paradas (se mecen desde abajo), un poco más afuera.
  const weeds = roadside(track, 7, 7);
  const weedGeometry = new THREE.BoxGeometry(0.6, 7, 0.25).translate(0, 3.5, 0);
  const algae = new THREE.InstancedMesh(weedGeometry, new THREE.MeshLambertMaterial({ color: 0x2fa84f }), weeds.length);
  const bubbles = new Snowfall(scene, track, { count: 450, speed: 4, size: 1.1, color: 0xdff4ff, rise: true, bubble: true });
  scene.add(corals, algae);
  const dummy = new THREE.Object3D();
  let time = 0;
  const sway = () => {
    weeds.forEach(({ x, y, z }, i) => {
      dummy.position.set(x, y, z);
      dummy.rotation.set(Math.sin(time * 1.3 + i) * 0.25, i, Math.cos(time + i * 0.7) * 0.2);
      dummy.scale.setScalar(0.8 + (i % 4) * 0.15);
      dummy.updateMatrix();
      algae.setMatrixAt(i, dummy.matrix);
    });
    algae.instanceMatrix.needsUpdate = true;
  };
  sway();
  return {
    update(dt) {
      time += dt;
      bubbles.update(dt);
      sway();
    },
  };
}

// Ciudad de juguete: bloques gigantes de colores (algunos uno encima de otro) y crayolas paradas.
function addToys(scene, track) {
  const spots = roadside(track, 16, 7);
  const blocks = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial(), spots.length * 2);
  const colors = [0xe53935, 0xffd02a, 0x3a5bd6, 0x3cc44f, 0xff8a1e, 0x8158d8];
  const dummy = new THREE.Object3D();
  const color = new THREE.Color();
  let count = 0;
  const block = (x, y, z, size, turn, i) => {
    dummy.position.set(x, y + size / 2, z);
    dummy.rotation.set(0, turn, 0);
    dummy.scale.setScalar(size);
    dummy.updateMatrix();
    blocks.setMatrixAt(count, dummy.matrix);
    blocks.setColorAt(count, color.setHex(colors[i % colors.length]));
    count += 1;
  };
  spots.forEach(({ x, y, z }, i) => {
    const size = 5 + (i % 3) * 1.5;
    block(x, y, z, size, i * 0.7, i);
    if (i % 2 === 0) block(x, y + size, z, size * 0.7, i * 1.3, i + 2);
  });
  blocks.count = count;
  // Las crayolas: un palo de color con su punta.
  const tall = roadside(track, 48, 13);
  const sticks = new THREE.InstancedMesh(new THREE.CylinderGeometry(1, 1, 10, 8), new THREE.MeshLambertMaterial(), tall.length);
  const tips = new THREE.InstancedMesh(new THREE.ConeGeometry(1, 2.4, 8), new THREE.MeshLambertMaterial(), tall.length);
  tall.forEach(({ x, y, z }, i) => {
    const hex = colors[(i + 3) % colors.length];
    dummy.rotation.set(0, 0, 0);
    dummy.scale.setScalar(1);
    dummy.position.set(x, y + 5, z);
    dummy.updateMatrix();
    sticks.setMatrixAt(i, dummy.matrix);
    sticks.setColorAt(i, color.setHex(hex));
    dummy.position.set(x, y + 11.2, z);
    dummy.updateMatrix();
    tips.setMatrixAt(i, dummy.matrix);
    tips.setColorAt(i, color.setHex(hex));
  });
  scene.add(blocks, sticks, tips);
}

// Volcán: uno enorme en medio de la pista con lava arriba y escurriendo, charcos de lava junto al camino
// y chispitas que suben.
function addVolcano(scene, track) {
  // Lo más grande que cabe sin tocar el camino.
  const room = Math.min(...track.points.map((p) => Math.hypot(p.x, p.z))) - track.wallDistance - 6;
  const base = Math.min(60, room);
  const height = base * 0.95;
  const top = base * 0.22;
  const rock = new THREE.MeshLambertMaterial({ color: 0x3a2f2f });
  const lava = new THREE.MeshBasicMaterial({ color: 0xff6a00 });
  const mountain = new THREE.Mesh(new THREE.CylinderGeometry(top, base, height, 24), rock);
  mountain.position.y = height / 2;
  const crater = new THREE.Mesh(new THREE.CircleGeometry(top * 0.85, 20).rotateX(-Math.PI / 2), lava);
  crater.position.y = height + 0.05;
  scene.add(mountain, crater);
  // Ríos de lava por los lados, desde la orilla de arriba hacia abajo.
  const slant = Math.hypot(base - top, height);
  const tilt = Math.atan2(base - top, height);
  const streak = new THREE.BoxGeometry(2.6, slant * 0.8, 0.6);
  for (let k = 0; k < 6; k += 1) {
    const arm = new THREE.Group();
    arm.rotation.y = (k / 6) * Math.PI * 2 + 0.4;
    const flow = new THREE.Mesh(streak, lava);
    const mid = 0.55;
    flow.position.set(0, height * mid + Math.sin(tilt) * 0.4, top + (base - top) * (1 - mid) + Math.cos(tilt) * 0.4);
    flow.rotation.x = -tilt;
    arm.add(flow);
    scene.add(arm);
  }
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: 0xff7a2a, blending: THREE.AdditiveBlending, depthWrite: false }));
  glow.position.y = height + 4;
  glow.scale.setScalar(top * 4);
  scene.add(glow);
  // Charcos de lava afuera de las llantas.
  const pools = roadside(track, 36, 10);
  const pool = new THREE.CircleGeometry(4, 18).rotateX(-Math.PI / 2);
  for (const { x, y, z } of pools) {
    const mesh = new THREE.Mesh(pool, lava);
    mesh.position.set(x, y + 0.08, z);
    scene.add(mesh);
  }
  const embers = new Snowfall(scene, track, { count: 300, speed: 6, size: 0.9, color: 0xff8a3c, rise: true, glow: true });
  let time = 0;
  return {
    update(dt) {
      time += dt;
      embers.update(dt);
      glow.scale.setScalar(top * (4 + Math.sin(time * 3) * 0.3));
    },
  };
}

// Casa embrujada: la casa en medio (con ventanas que brillan), calabazas con su lucecita, árboles secos y
// lucecitas que flotan.
function addHaunted(scene, track) {
  const wall = new THREE.MeshLambertMaterial({ color: 0x4a3a6a });
  const roof = new THREE.MeshLambertMaterial({ color: 0x2a1f3f });
  const light = new THREE.MeshBasicMaterial({ color: 0xffd84d });
  const house = new THREE.Group();
  const add = (geometry, material, x, y, z, turn = 0) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    mesh.rotation.y = turn;
    house.add(mesh);
    return mesh;
  };
  add(new THREE.BoxGeometry(26, 14, 18), wall, 0, 7, 0);
  add(new THREE.ConeGeometry(18, 10, 4), roof, 0, 19, 0, Math.PI / 4);
  add(new THREE.CylinderGeometry(4, 4, 26, 8), wall, 11, 13, 7);
  add(new THREE.ConeGeometry(5.5, 9, 8), roof, 11, 30.5, 7);
  for (const [x, y] of [[-7, 9], [0, 9], [7, 9], [-7, 4], [7, 4]]) {
    add(new THREE.PlaneGeometry(3, 3.4), light, x, y, 9.05);
    add(new THREE.PlaneGeometry(3, 3.4), light, x, y, -9.05, Math.PI);
  }
  add(new THREE.PlaneGeometry(2.4, 2.8), light, 11, 20, 11.05);
  scene.add(house);

  const spots = roadside(track, 14, 3);
  const pumpkins = new THREE.InstancedMesh(new THREE.SphereGeometry(1.2, 12, 8), new THREE.MeshLambertMaterial({ color: 0xff8a1e }), spots.length);
  const matrix = new THREE.Matrix4();
  const place = new THREE.Vector3();
  const size = new THREE.Vector3(1.3, 0.85, 1.3);
  const still = new THREE.Quaternion();
  const glows = [];
  spots.forEach(({ x, y, z }, i) => {
    pumpkins.setMatrixAt(i, matrix.compose(place.set(x, y + 0.9, z), still, size));
    if (i % 2 === 0) {
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: 0xffb347, blending: THREE.AdditiveBlending, depthWrite: false }));
      glow.position.set(x, y + 1.2, z);
      glow.scale.setScalar(3);
      scene.add(glow);
      glows.push(glow);
    }
  });
  // Árboles secos: tronco y dos ramas chuecas.
  const trees = roadside(track, 34, 10);
  const trunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.35, 0.6, 8, 6), new THREE.MeshLambertMaterial({ color: 0x3a2a2a }), trees.length * 3);
  const dummy = new THREE.Object3D();
  trees.forEach(({ x, y, z }, i) => {
    dummy.position.set(x, y + 4, z);
    dummy.rotation.set(0, i, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    trunk.setMatrixAt(i * 3, dummy.matrix);
    for (const [k, side] of [[1, 1], [2, -1]]) {
      dummy.position.set(x + side * 1.4, y + 5 + k, z);
      dummy.rotation.set(0, i, side * 0.9);
      dummy.scale.set(0.6, 0.45, 0.6);
      dummy.updateMatrix();
      trunk.setMatrixAt(i * 3 + k, dummy.matrix);
    }
  });
  scene.add(pumpkins, trunk);
  const wisps = new Snowfall(scene, track, { count: 120, speed: 1.2, size: 1.4, color: 0xc8f0ff, rise: true, glow: true });
  let time = 0;
  return {
    update(dt) {
      time += dt;
      wisps.update(dt);
      glows.forEach((glow, i) => glow.scale.setScalar(2.8 + Math.sin(time * 6 + i) * 0.4));
    },
  };
}

// Pastel de cumpleaños: un pastel gigante en medio con velitas, regalos junto al camino y globos que flotan.
function addParty(scene, track) {
  const cake = new THREE.Group();
  const tiers = [[24, 8, 0xff9ec8], [17, 7, 0xfff0d6], [10, 6, 0xff7fb0]];
  let y = 0;
  for (const [radius, height, color] of tiers) {
    const tier = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, 28), new THREE.MeshLambertMaterial({ color }));
    tier.position.y = y + height / 2;
    const frosting = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.9, 6, 28), new THREE.MeshLambertMaterial({ color: 0xffffff }));
    frosting.rotation.x = Math.PI / 2;
    frosting.position.y = y + height;
    cake.add(tier, frosting);
    y += height;
  }
  const flames = [];
  const candleColors = [0x3fa7ff, 0xffd02a, 0x4cd97b, 0xb07cff, 0xff5a5f];
  for (let k = 0; k < 5; k += 1) {
    const angle = (k / 5) * Math.PI * 2;
    const candle = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 6, 8), new THREE.MeshLambertMaterial({ color: candleColors[k] }));
    candle.position.set(Math.cos(angle) * 6, y + 3, Math.sin(angle) * 6);
    const flame = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: 0xffb347, blending: THREE.AdditiveBlending, depthWrite: false }));
    flame.position.set(candle.position.x, y + 7, candle.position.z);
    flame.scale.setScalar(3);
    cake.add(candle, flame);
    flames.push(flame);
  }
  cake.position.set(0, 0, -10);
  scene.add(cake);

  const spots = roadside(track, 16, 4);
  const boxes = new THREE.InstancedMesh(new THREE.BoxGeometry(2.6, 2.6, 2.6), new THREE.MeshLambertMaterial(), spots.length);
  const ribbons = new THREE.InstancedMesh(new THREE.BoxGeometry(2.7, 2.7, 0.5), new THREE.MeshLambertMaterial({ color: 0xffd02a }), spots.length);
  const colors = [0x3fa7ff, 0xff5a5f, 0x4cd97b, 0xb07cff];
  const matrix = new THREE.Matrix4();
  const color = new THREE.Color();
  spots.forEach(({ x, y: ground, z }, i) => {
    boxes.setMatrixAt(i, matrix.makeTranslation(x, ground + 1.3, z));
    boxes.setColorAt(i, color.setHex(colors[i % colors.length]));
    ribbons.setMatrixAt(i, matrix.makeTranslation(x, ground + 1.3, z));
  });
  scene.add(boxes, ribbons);
  // Globos: bolitas de colores que suben y bajan despacito.
  const air = roadside(track, 22, 8);
  const balloons = new THREE.InstancedMesh(new THREE.SphereGeometry(1.3, 10, 8), new THREE.MeshLambertMaterial(), air.length);
  air.forEach((_, i) => balloons.setColorAt(i, color.setHex([0xff5a5f, 0xffd02a, 0x3fa7ff, 0xff9ec8, 0x4cd97b][i % 5])));
  scene.add(balloons);
  const dummy = new THREE.Object3D();
  let time = 0;
  const bob = () => {
    air.forEach(({ x, y: ground, z }, i) => {
      dummy.position.set(x, ground + 7 + Math.sin(time * 1.2 + i) * 0.8, z);
      dummy.scale.set(1, 1.2, 1);
      dummy.updateMatrix();
      balloons.setMatrixAt(i, dummy.matrix);
    });
    balloons.instanceMatrix.needsUpdate = true;
  };
  bob();
  return {
    update(dt) {
      time += dt;
      bob();
      flames.forEach((flame, i) => flame.scale.setScalar(2.8 + Math.sin(time * 9 + i * 1.3) * 0.4));
    },
  };
}

// Valle de los dinos: helechos y huevos gigantes junto al camino, y unos dinosaurios de cuello largo a lo lejos.
function addDinos(scene, track) {
  const spots = roadside(track, 10, 4);
  const ferns = new THREE.InstancedMesh(new THREE.ConeGeometry(1.8, 3.6, 7), new THREE.MeshLambertMaterial(), spots.length);
  const greens = [0x2e8b3a, 0x4cb050, 0x6abf4b];
  const matrix = new THREE.Matrix4();
  const color = new THREE.Color();
  spots.forEach(({ x, y, z }, i) => {
    ferns.setMatrixAt(i, matrix.makeTranslation(x, y + 1.8, z));
    ferns.setColorAt(i, color.setHex(greens[i % greens.length]));
  });
  const nests = roadside(track, 40, 7);
  const eggs = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 12, 10), new THREE.MeshLambertMaterial({ color: 0xfff6e0 }), nests.length);
  const place = new THREE.Vector3();
  const still = new THREE.Quaternion();
  const size = new THREE.Vector3(1.3, 1.8, 1.3);
  nests.forEach(({ x, y, z }, i) => eggs.setMatrixAt(i, matrix.compose(place.set(x, y + 1.6, z), still, size)));
  scene.add(ferns, eggs);
  // Dinosaurios de cuello largo, hechos de figuras, lejos de la pista.
  const skin = new THREE.MeshLambertMaterial({ color: 0x5aa86a });
  const belly = new THREE.MeshLambertMaterial({ color: 0x8ad08a });
  for (const { x, y, z, turn } of track.scatter(3, 21)) {
    const dino = new THREE.Group();
    const body = new THREE.Mesh(new THREE.SphereGeometry(5, 14, 10), skin);
    body.scale.set(1.5, 1, 1);
    body.position.y = 9;
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.8, 14, 8), skin);
    neck.position.set(8, 16, 0);
    neck.rotation.z = -0.5;
    const head = new THREE.Mesh(new THREE.SphereGeometry(2, 10, 8), belly);
    head.position.set(11.5, 22.5, 0);
    const tail = new THREE.Mesh(new THREE.ConeGeometry(1.8, 11, 8), skin);
    tail.position.set(-10, 8, 0);
    tail.rotation.z = Math.PI / 2 + 0.3;
    dino.add(body, neck, head, tail);
    for (const [lx, lz] of [[-3.5, -2.5], [-3.5, 2.5], [3.5, -2.5], [3.5, 2.5]]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 6, 8), skin);
      leg.position.set(lx, 3, lz);
      dino.add(leg);
    }
    dino.position.set(x, y, z);
    dino.rotation.y = turn;
    scene.add(dino);
  }
}

// Circuito de las nubes: nubes esponjosas junto al camino y arcoíris que pasan por encima de la pista.
function addClouds(scene, track) {
  const spots = roadside(track, 9, 6);
  const puffs = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 10, 8), new THREE.MeshLambertMaterial({ color: 0xffffff }), spots.length * 3);
  const dummy = new THREE.Object3D();
  spots.forEach(({ x, y, z }, i) => {
    for (let k = 0; k < 3; k += 1) {
      dummy.position.set(x + (k - 1) * 2.2, y + 1 + (k === 1 ? 1 : 0), z + (k % 2) * 1.2);
      dummy.scale.setScalar(2 + (k === 1 ? 1 : 0) + (i % 3) * 0.4);
      dummy.updateMatrix();
      puffs.setMatrixAt(i * 3 + k, dummy.matrix);
    }
  });
  scene.add(puffs);
  // Arcoíris: medios aros de colores que cruzan el camino.
  const bands = [0xff5a5f, 0xff9a3c, 0xffd02a, 0x4cd97b, 0x3fa7ff, 0xb07cff];
  for (const at of [0.08, 0.42, 0.68]) {
    const spot = track.pointAt(Math.round(at * track.count));
    const arch = new THREE.Group();
    bands.forEach((band, k) => {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(track.wallDistance + 4 - k * 0.7, 0.36, 6, 28, Math.PI), new THREE.MeshBasicMaterial({ color: band }));
      arch.add(ring);
    });
    arch.position.set(spot.x, spot.y, spot.z);
    arch.rotation.y = spot.heading;
    scene.add(arch);
  }
}

// Lugares a los lados del camino (afuera de las llantas), cada `every` muestras y alternando de lado (con la altura
// del piso ahí, por las lomas).
function roadside(track, every, gap) {
  const spots = [];
  for (let i = 10, side = 1; i < track.count; i += every, side = -side) {
    const spot = track.pointAt(i, side * (track.wallDistance + gap));
    // (Sin tapar el atajo.)
    if (track.blocked(spot.x, spot.z)) continue;
    spots.push({ ...spot, y: track.groundHeight(spot.x, spot.z) });
  }
  return spots;
}

// Burbuja: un círculo con orilla clara y un brillito.
function bubbleTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 32;
  const ctx = canvas.getContext('2d');
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(16, 16, 12, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
  ctx.fill();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
  ctx.beginPath();
  ctx.arc(11, 11, 3, 0, Math.PI * 2);
  ctx.fill();
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
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
