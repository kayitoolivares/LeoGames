import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { arenaDecor } from './art.js';

// Las arenas de la Guerra de pintura, hechas con figuras sencillas (cajas, rampas, árboles) unidas en pocas mallas
// para que el Xbox One S las dibuje rápido aunque haya pantalla dividida de 4.
// El equipo 0 sale del sur (z positiva) y el 1 del norte (z negativa); la mitad sur se escribe y la norte es su espejo,
// así ninguno tiene ventaja.
//   box:  [x, z, ancho (x), fondo (z), alto, color]          (cobertura: las altas tapan, las bajitas se brincan)
//   ramp: [x, z, ancho, fondo, alto, hacia, color]           (sube hacia 'n' | 's' | 'e' | 'w')
//   trees / palms: decoración con su tronco sólido.  adornos: dibujos de Gemini afuera de la barda (ver art.js).

// Cuánto se puede subir caminando (escalones, bordes del arenero) y la altura de los ojos y del cuerpo.
export const STEP = 0.55;
export const BODY_HEIGHT = 2;
// Hasta dónde llega el piso de afuera y el paisaje.
const OUTSIDE = 260;
const PANORAMA = { radius: 180, repeats: 4, sink: 0.25 };

export const ARENAS = {
  parque: {
    name: 'Parque de juegos',
    emoji: '🛝',
    size: [60, 70],
    panorama: 'pradera',
    adornos: ['columpio', 'resbaladilla'],
    sky: 0x9fd8ff,
    outside: 0x7cc86a,
    floor: { base: '#efe2c4', line: '#e0cfa9', pattern: 'tiles' },
    fence: { height: 2.4, color: 0xff9f43 },
    half: {
      boxes: [
        // Las bardas bajitas frente a cada base.
        [-8, 26, 6, 1, 1.1, 0x4fc3f7],
        [8, 26, 6, 1, 1.1, 0x4fc3f7],
        // Coberturas altas.
        [-16, 19, 2, 6, 2.6, 0xff6b6b],
        [16, 19, 2, 6, 2.6, 0xff6b6b],
        [-6, 13, 5, 1.2, 2.6, 0xffd166],
        [6, 13, 5, 1.2, 2.6, 0xffd166],
        // Bajitas para brincar.
        [0, 20, 6, 1, 1.1, 0x9b8cff],
        [-23, 7, 1, 5, 1.1, 0x9b8cff],
        [23, 7, 1, 5, 1.1, 0x9b8cff],
        // El arenero (orilla de un escalón).
        [-14, 2.5, 8, 0.6, 0.45, 0xc8a26b],
        [-14, 9.5, 8, 0.6, 0.45, 0xc8a26b],
        [-17.7, 6, 0.6, 6.4, 0.45, 0xc8a26b],
        [-10.3, 6, 0.6, 6.4, 0.45, 0xc8a26b],
        // Plataformas de la resbaladilla.
        [-23, 18, 5, 5, 2.4, 0x56c271],
        [23, 18, 5, 5, 2.4, 0x56c271],
      ],
      ramps: [
        [-23, 23.5, 3, 6, 2.4, 'n', 0xff5c8a],
        [23, 23.5, 3, 6, 2.4, 'n', 0xff5c8a],
      ],
      trees: [
        [-26, 30],
        [26, 30],
        [-3, 30.5],
      ],
    },
    center: {
      boxes: [
        [0, 0, 8, 8, 2.4, 0x56c271],
        [-13, 0, 2, 2, 3.4, 0xff9f43],
        [13, 0, 2, 2, 3.4, 0xff9f43],
      ],
      ramps: [
        [7, 0, 6, 3, 2.4, 'w', 0xffd166],
        [-7, 0, 6, 3, 2.4, 'e', 0xffd166],
      ],
      trees: [
        [-25, 0],
        [25, 0],
      ],
    },
  },
  castillo: {
    name: 'Castillo de juguete',
    emoji: '🏰',
    size: [58, 70],
    panorama: 'juguetes',
    adornos: ['oso', 'torre-bloques', 'tren', 'trompo'],
    sky: 0xffd9f2,
    outside: 0xc9a27a,
    floor: { base: '#d9d2f5', line: '#c6bce9', pattern: 'carpet' },
    fence: { height: 2.4, color: 0xa47148 },
    half: {
      boxes: [
        // La muralla de cada castillo, con la puerta en medio, y sus torres.
        [-8, 24, 9, 1.2, 2.6, 0xb8b8d8],
        [8, 24, 9, 1.2, 2.6, 0xb8b8d8],
        [-14, 24, 3, 3, 4, 0x9a9ac4],
        [14, 24, 3, 3, 4, 0x9a9ac4],
        // Bloques de juguete.
        [-8, 15, 2, 2, 2, 0xff5c5c],
        [8, 15, 2, 2, 2, 0x4f9dff],
        [-18, 10, 2.4, 2.4, 2.4, 0xffd23f],
        [18, 10, 2.4, 2.4, 2.4, 0x3fd18a],
        [-3, 9, 2, 2, 1.1, 0xff8c3f],
        [3, 9, 2, 2, 1.1, 0xb36bff],
        [-24, 17, 2, 4, 1.1, 0x4f9dff],
        [24, 17, 2, 4, 1.1, 0xff5c5c],
        // Una pelotota (tapa como pared).
        [-21, 2, 3, 3, 3, 0xff6fae],
        [21, 2, 3, 3, 3, 0x6fd6ff],
      ],
      ramps: [],
      towers: [
        [-14, 24, 3],
        [14, 24, 3],
      ],
    },
    center: {
      boxes: [[0, 0, 10, 4, 2.2, 0xd6a46c]],
      ramps: [
        [8, 0, 6, 4, 2.2, 'w', 0xe8bd85],
        [-8, 0, 6, 4, 2.2, 'e', 0xe8bd85],
      ],
      balls: [
        [-21, 2, 1.6, 0xff6fae],
        [21, 2, 1.6, 0x6fd6ff],
        [-21, -2, 1.6, 0x6fd6ff],
        [21, -2, 1.6, 0xff6fae],
      ],
    },
  },
  playa: {
    name: 'Playa',
    emoji: '🏖️',
    size: [62, 72],
    panorama: 'playa',
    adornos: ['sombrilla', 'castillo-arena'],
    sky: 0x8fdcff,
    outside: 0x3fb6e8,
    floor: { base: '#f6e3b0', line: '#ead39a', pattern: 'sand' },
    fence: { height: 2.4, color: 0xffffff },
    half: {
      boxes: [
        // Castillos de arena.
        [-10, 18, 3, 3, 1.2, 0xe9c77b],
        [10, 18, 3, 3, 1.2, 0xe9c77b],
        [-20, 6, 3, 3, 1.2, 0xe9c77b],
        [20, 6, 3, 3, 1.2, 0xe9c77b],
        // Piedras grandes.
        [-6, 10, 4, 2, 2.6, 0x8d99ae],
        [6, 10, 4, 2, 2.6, 0x8d99ae],
        [0, 22, 3, 2, 2.6, 0x8d99ae],
        // Torres del salvavidas.
        [-25, 15, 4, 4, 2.6, 0xff6b6b],
        [25, 15, 4, 4, 2.6, 0xff6b6b],
        // Hieleras bajitas junto a la base.
        [-6, 27, 3, 1.4, 1.1, 0x4fc3f7],
        [6, 27, 3, 1.4, 1.1, 0x4fc3f7],
      ],
      ramps: [
        [-25, 21, 3, 8, 2.6, 'n', 0xffffff],
        [25, 21, 3, 8, 2.6, 'n', 0xffffff],
      ],
      palms: [
        [-14, 27],
        [14, 27],
        [-28, 2],
        [28, 2],
      ],
      sandcastles: [
        [-10, 18],
        [10, 18],
        [-20, 6],
        [20, 6],
      ],
    },
    center: {
      // El barco varado en medio.
      boxes: [[0, 0, 9, 4, 2.2, 0xb5651d]],
      ramps: [
        [7.5, 0, 6, 3, 2.2, 'w', 0xd9894a],
        [-7.5, 0, 6, 3, 2.2, 'e', 0xd9894a],
      ],
      palms: [
        [-14, 0],
        [14, 0],
      ],
    },
  },
};
export const ARENA_KEYS = Object.keys(ARENAS);

const MIRROR_DIR = { n: 's', s: 'n', e: 'e', w: 'w' };

// Todas las piezas de una arena: la mitad sur, su espejo al norte y las del centro.
function pieces(def, kind) {
  const half = def.half[kind] ?? [];
  const mirrored = half.map((item) => {
    const copy = [...item];
    copy[1] = -copy[1];
    if (kind === 'ramps') copy[5] = MIRROR_DIR[copy[5]];
    return copy;
  });
  return [...half, ...mirrored, ...(def.center?.[kind] ?? [])];
}

// Lo sólido de una arena: con qué chocan los pintores y las gotas, dónde se puede parar uno y qué tapa la vista.
export class ArenaWorld {
  constructor(def) {
    const [w, d] = def.size;
    this.halfW = w / 2;
    this.halfD = d / 2;
    const fence = def.fence.height;
    this.solids = [
      // La barda de alrededor.
      { minX: -this.halfW - 1, maxX: this.halfW + 1, minZ: -this.halfD - 1, maxZ: -this.halfD, bottom: 0, top: fence },
      { minX: -this.halfW - 1, maxX: this.halfW + 1, minZ: this.halfD, maxZ: this.halfD + 1, bottom: 0, top: fence },
      { minX: -this.halfW - 1, maxX: -this.halfW, minZ: -this.halfD, maxZ: this.halfD, bottom: 0, top: fence },
      { minX: this.halfW, maxX: this.halfW + 1, minZ: -this.halfD, maxZ: this.halfD, bottom: 0, top: fence },
    ];
    for (const [x, z, bw, bd, h] of pieces(def, 'boxes')) {
      this.solids.push({ minX: x - bw / 2, maxX: x + bw / 2, minZ: z - bd / 2, maxZ: z + bd / 2, bottom: 0, top: h });
    }
    // Troncos de árboles y palmeras: delgaditos pero sólidos.
    for (const [x, z] of [...pieces(def, 'trees'), ...pieces(def, 'palms')]) {
      this.solids.push({ minX: x - 0.45, maxX: x + 0.45, minZ: z - 0.45, maxZ: z + 0.45, bottom: 0, top: 6, thin: true });
    }
    this.ramps = pieces(def, 'ramps').map(([x, z, rw, rd, h, dir]) => ({
      minX: x - rw / 2,
      maxX: x + rw / 2,
      minZ: z - rd / 2,
      maxZ: z + rd / 2,
      top: h,
      dir,
    }));
  }

  inside(box, x, z, margin = 0) {
    return x > box.minX - margin && x < box.maxX + margin && z > box.minZ - margin && z < box.maxZ + margin;
  }

  // Altura de una rampa en ese punto (de 0 en la orilla baja a `top` en la alta).
  rampHeight(ramp, x, z) {
    const t = {
      s: (z - ramp.minZ) / (ramp.maxZ - ramp.minZ),
      n: (ramp.maxZ - z) / (ramp.maxZ - ramp.minZ),
      e: (x - ramp.minX) / (ramp.maxX - ramp.minX),
      w: (ramp.maxX - x) / (ramp.maxX - ramp.minX),
    }[ramp.dir];
    return Math.min(1, Math.max(0, t)) * ramp.top;
  }

  // El piso más alto en el que puede pararse algo con los pies en `feetY` (sin brincar).
  groundAt(x, z, feetY, radius = 0) {
    let ground = 0;
    for (const box of this.solids) {
      if (box.top <= feetY + STEP && box.top > ground && this.inside(box, x, z, radius * 0.5)) ground = box.top;
    }
    for (const ramp of this.ramps) {
      if (!this.inside(ramp, x, z, radius * 0.3)) continue;
      const h = this.rampHeight(ramp, x, z);
      if (h <= feetY + STEP && h > ground) ground = h;
    }
    return ground;
  }

  // Empuja un círculo (los pies de un pintor) fuera de lo que no puede subir. Cambia `body.x` y `body.z`.
  pushOut(body, radius) {
    const feet = body.y;
    for (const box of this.solids) {
      if (box.top <= feet + STEP || box.bottom >= feet + BODY_HEIGHT) continue;
      this.pushOutOf(body, box, radius);
    }
    for (const ramp of this.ramps) {
      if (!this.inside(ramp, body.x, body.z, radius)) continue;
      // Por los lados (o por la orilla alta) una rampa es una pared; por enfrente, se sube.
      const cx = Math.min(ramp.maxX, Math.max(ramp.minX, body.x));
      const cz = Math.min(ramp.maxZ, Math.max(ramp.minZ, body.z));
      if (this.rampHeight(ramp, cx, cz) > feet + STEP) this.pushOutOf(body, { ...ramp }, radius);
    }
    body.x = Math.min(this.halfW - radius, Math.max(-this.halfW + radius, body.x));
    body.z = Math.min(this.halfD - radius, Math.max(-this.halfD + radius, body.z));
  }

  pushOutOf(body, box, radius) {
    const cx = Math.min(box.maxX, Math.max(box.minX, body.x));
    const cz = Math.min(box.maxZ, Math.max(box.minZ, body.z));
    const dx = body.x - cx;
    const dz = body.z - cz;
    const dist = Math.hypot(dx, dz);
    if (dist >= radius) return false;
    if (dist > 0.0001) {
      body.x = cx + (dx / dist) * radius;
      body.z = cz + (dz / dist) * radius;
      return true;
    }
    // (El centro quedó adentro: sale por el lado más cercano.)
    const exits = [
      [box.minX - radius - body.x, 0],
      [box.maxX + radius - body.x, 0],
      [0, box.minZ - radius - body.z],
      [0, box.maxZ + radius - body.z],
    ];
    const [ex, ez] = exits.reduce((best, e) => (Math.abs(e[0] + e[1]) < Math.abs(best[0] + best[1]) ? e : best));
    body.x += ex;
    body.z += ez;
    return true;
  }

  // Si el punto está dentro de algo sólido: { normal, top } (normal = hacia dónde mira la cara que tocó, viniendo
  // desde `from`). null si está libre. El piso (y = 0) no cuenta aquí.
  hit(x, y, z, from) {
    for (const box of this.solids) {
      if (y >= box.top || y <= box.bottom || !this.inside(box, x, z)) continue;
      if (from.y >= box.top) return { normal: [0, 1, 0], y: box.top, solid: box };
      // La cara por donde entró: la que estaba cruzando desde `from`.
      if (from.x <= box.minX) return { normal: [-1, 0, 0], x: box.minX, solid: box };
      if (from.x >= box.maxX) return { normal: [1, 0, 0], x: box.maxX, solid: box };
      if (from.z <= box.minZ) return { normal: [0, 0, -1], z: box.minZ, solid: box };
      if (from.z >= box.maxZ) return { normal: [0, 0, 1], z: box.maxZ, solid: box };
      return { normal: [0, 1, 0], y: box.top, solid: box };
    }
    for (const ramp of this.ramps) {
      if (!this.inside(ramp, x, z)) continue;
      const h = this.rampHeight(ramp, x, z);
      if (y < h) return { normal: [0, 1, 0], y: h, ramp };
    }
    return null;
  }

  // ¿Se ve de un punto al otro (a la altura de los ojos)? Solo tapan las cosas más altas que `eyeY`.
  lineOfSight(ax, az, bx, bz, eyeY = 1.6) {
    for (const box of this.solids) {
      if (box.top < eyeY || box.thin) continue;
      if (segmentHitsBox(ax, az, bx, bz, box)) return false;
    }
    return true;
  }

  // ¿Hay algo sólido aquí (para no poner a nadie dentro de una caja)?
  blocked(x, z, margin = 0.8) {
    if (Math.abs(x) > this.halfW - margin || Math.abs(z) > this.halfD - margin) return true;
    return this.solids.some((box) => this.inside(box, x, z, margin)) || this.ramps.some((ramp) => this.inside(ramp, x, z, margin));
  }
}

// Segmento contra caja en 2D (método de las placas).
function segmentHitsBox(ax, az, bx, bz, box) {
  let t0 = 0;
  let t1 = 1;
  const dx = bx - ax;
  const dz = bz - az;
  for (const [p, q] of [
    [-dx, ax - box.minX],
    [dx, box.maxX - ax],
    [-dz, az - box.minZ],
    [dz, box.maxZ - az],
  ]) {
    if (p === 0) {
      if (q < 0) return false;
      continue;
    }
    const t = q / p;
    if (p < 0) t0 = Math.max(t0, t);
    else t1 = Math.min(t1, t);
    if (t0 > t1) return false;
  }
  return true;
}

// Una rampa que sube hacia +z: ancho `w` (x), largo `l` (z), alto `h`.
function wedgeGeometry(w, l, h) {
  const [x0, x1, z0, z1] = [-w / 2, w / 2, -l / 2, l / 2];
  const v = (x, y, z) => [x, y, z];
  const quads = [
    // La subida, la parte de atrás (alta), abajo y los dos lados (triángulos).
    [v(x0, 0, z0), v(x1, 0, z0), v(x1, h, z1), v(x0, h, z1)],
    [v(x0, h, z1), v(x1, h, z1), v(x1, 0, z1), v(x0, 0, z1)],
    [v(x0, 0, z1), v(x1, 0, z1), v(x1, 0, z0), v(x0, 0, z0)],
  ];
  const positions = [];
  for (const [a, b, c, d] of quads) positions.push(...a, ...c, ...b, ...a, ...d, ...c);
  positions.push(...v(x0, 0, z0), ...v(x0, h, z1), ...v(x0, 0, z1));
  positions.push(...v(x1, 0, z0), ...v(x1, 0, z1), ...v(x1, h, z1));
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return geometry;
}

const RAMP_TURN = { s: 0, n: Math.PI, e: Math.PI / 2, w: -Math.PI / 2 };

// Arma la arena en 3D: { group, world, spawns, waypoints, dispose() }.
export function buildArena(key, { panoramaUrl = null } = {}) {
  const def = ARENAS[key];
  const world = new ArenaWorld(def);
  const group = new THREE.Group();
  const solidParts = [];
  const decorParts = [];
  const tint = new THREE.Color();
  const add = (list, geometry, hex, x, y, z) => {
    const piece = geometry.index ? geometry.toNonIndexed() : geometry;
    if (piece.attributes.uv) piece.deleteAttribute('uv');
    piece.translate(x, y, z);
    tint.setHex(hex);
    const colors = new Float32Array(piece.attributes.position.count * 3);
    for (let i = 0; i < colors.length; i += 3) colors.set([tint.r, tint.g, tint.b], i);
    piece.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    list.push(piece);
    if (piece !== geometry) geometry.dispose();
  };

  const [w, d] = def.size;
  const fence = def.fence;
  // La barda: tablitas de colores alrededor.
  add(solidParts, new THREE.BoxGeometry(w + 2, fence.height, 1), fence.color, 0, fence.height / 2, -d / 2 - 0.5);
  add(solidParts, new THREE.BoxGeometry(w + 2, fence.height, 1), fence.color, 0, fence.height / 2, d / 2 + 0.5);
  add(solidParts, new THREE.BoxGeometry(1, fence.height, d), fence.color, -w / 2 - 0.5, fence.height / 2, 0);
  add(solidParts, new THREE.BoxGeometry(1, fence.height, d), fence.color, w / 2 + 0.5, fence.height / 2, 0);
  for (const [x, z, bw, bd, h, color] of pieces(def, 'boxes')) add(solidParts, new THREE.BoxGeometry(bw, h, bd), color, x, h / 2, z);
  for (const [x, z, rw, rd, h, dir, color] of pieces(def, 'ramps')) {
    const along = dir === 'n' || dir === 's';
    const geometry = wedgeGeometry(along ? rw : rd, along ? rd : rw, h).rotateY(RAMP_TURN[dir]);
    add(solidParts, geometry, color, x, 0, z);
  }

  // Decoración: árboles, palmeras, torres, pelotas y castillos de arena.
  for (const [x, z] of pieces(def, 'trees')) {
    add(decorParts, new THREE.CylinderGeometry(0.35, 0.5, 3, 6), 0x7a4b2a, x, 1.5, z);
    add(decorParts, new THREE.IcosahedronGeometry(2.2, 0), 0x3fae5a, x, 4.2, z);
    add(decorParts, new THREE.IcosahedronGeometry(1.5, 0), 0x56c271, x + 0.6, 5.6, z - 0.3);
  }
  for (const [x, z] of pieces(def, 'palms')) {
    add(decorParts, new THREE.CylinderGeometry(0.3, 0.45, 6, 6), 0xa0703c, x, 3, z);
    for (let i = 0; i < 5; i += 1) {
      const leaf = new THREE.ConeGeometry(0.7, 3.4, 4).rotateZ(Math.PI / 2.4).rotateY((i / 5) * Math.PI * 2);
      add(decorParts, leaf, 0x3fae5a, x, 6, z);
    }
    add(decorParts, new THREE.SphereGeometry(0.45, 6, 4), 0x6b4423, x + 0.3, 5.7, z);
  }
  for (const [x, z, size] of pieces(def, 'towers')) {
    add(decorParts, new THREE.ConeGeometry(size * 0.75, 2.4, 8), 0xff5c8a, x, 4 + 1.2, z);
  }
  for (const [x, z, radius, color] of def.center?.balls ?? []) add(decorParts, new THREE.SphereGeometry(radius, 12, 8), color, x, 3 + radius * 0.7, z);
  for (const [x, z] of pieces(def, 'sandcastles')) {
    for (const [ox, oz] of [
      [-1, -1],
      [1, -1],
      [-1, 1],
      [1, 1],
    ]) {
      add(decorParts, new THREE.CylinderGeometry(0.45, 0.55, 1, 8), 0xe2bb6a, x + ox, 1.7, z + oz);
      add(decorParts, new THREE.ConeGeometry(0.5, 0.8, 8), 0xd9a948, x + ox, 2.6, z + oz);
    }
  }

  const material = new THREE.MeshLambertMaterial({ vertexColors: true });
  const solidGeometry = mergeGeometries(solidParts);
  solidParts.forEach((part) => part.dispose());
  const solidMesh = new THREE.Mesh(solidGeometry, material);
  group.add(solidMesh);
  // Las orillas en negro, como caricatura.
  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(solidGeometry, 30),
    new THREE.LineBasicMaterial({ color: 0x2a2140, transparent: true, opacity: 0.55 }),
  );
  group.add(edges);
  if (decorParts.length) {
    const decorGeometry = mergeGeometries(decorParts);
    decorParts.forEach((part) => part.dispose());
    group.add(new THREE.Mesh(decorGeometry, material));
  }

  // El piso de afuera y el paisaje (de Karts locos), si hay dibujo.
  const outside = new THREE.Mesh(
    new THREE.PlaneGeometry(OUTSIDE * 2, OUTSIDE * 2).rotateX(-Math.PI / 2),
    new THREE.MeshLambertMaterial({ color: def.outside }),
  );
  outside.position.y = -0.05;
  group.add(outside);
  if (panoramaUrl) group.add(panoramaWall(panoramaUrl));
  group.add(arenaDecor(def.adornos ?? [], w / 2, d / 2));

  return {
    def,
    group,
    world,
    spawns: spawnPoints(def, world),
    waypoints: waypointsFor(world),
    dispose() {
      group.traverse((object) => {
        object.geometry?.dispose();
        for (const mat of [].concat(object.material ?? [])) {
          mat.map?.dispose();
          mat.dispose();
        }
      });
    },
  };
}

function panoramaWall(url) {
  const { radius, repeats, sink } = PANORAMA;
  const height = ((Math.PI * 2 * radius) / repeats) * (9 / 16);
  const texture = new THREE.TextureLoader().load(url);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.MirroredRepeatWrapping;
  texture.repeat.set(repeats, 1);
  const wall = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, height, 48, 1, true),
    new THREE.MeshBasicMaterial({ map: texture, side: THREE.BackSide, fog: false }),
  );
  wall.position.y = height / 2 - height * sink;
  return wall;
}

// Dónde aparece cada equipo: en su base, mirando hacia el otro lado.
function spawnPoints(def, world) {
  const [, d] = def.size;
  const row = d / 2 - 3.5;
  const xs = [-5, 5, -10, 10, -1.5, 1.5, -14, 14];
  const free = (z) => xs.filter((x) => !world.blocked(x, z, 0.9)).map((x) => ({ x, z }));
  return [free(row).map((p) => ({ ...p, yaw: Math.PI })), free(-row).map((p) => ({ ...p, yaw: 0 }))];
}

// Puntos libres en el piso para que la compu camine de uno a otro.
function waypointsFor(world) {
  const points = [];
  for (let x = -world.halfW + 3; x <= world.halfW - 3; x += 4) {
    for (let z = -world.halfD + 3; z <= world.halfD - 3; z += 4) {
      if (!world.blocked(x, z, 1.2)) points.push({ x, z });
    }
  }
  return points;
}
