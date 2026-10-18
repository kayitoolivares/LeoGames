import * as THREE from 'three';

const CURB_WIDTH = 1.2;
const SAMPLES = 400;
const SEARCH_WINDOW = 25;
const TREE_COUNT = 70;

// Por dónde pasa la pista (x, z). Se suaviza con una curva cerrada.
const CONTROL_POINTS = [
  [0, -60],
  [50, -70],
  [90, -40],
  [95, 10],
  [60, 40],
  [20, 30],
  [-10, 55],
  [-60, 60],
  [-95, 20],
  [-85, -35],
  [-45, -55],
];

// La pista como una lista de puntos muy juntos (muestras). Con ellos se dibuja el camino
// y se sabe qué tan avanzado va cada carro (el índice de la muestra más cercana).
// `scale` la hace más grande y `barriers` le pone llantas a los lados (para los karts).
// `points` cambia el trazo, `ground` el color del piso y `snowy` les pone nieve a los árboles.
export class Track {
  constructor({ roadWidth = 14, scale = 1, barriers = false, points = CONTROL_POINTS, ground = 0x6abf4b, snowy = false } = {}) {
    this.roadWidth = roadWidth;
    this.scale = scale;
    this.barriers = barriers;
    this.ground = ground;
    this.snowy = snowy;
    // Distancia lateral máxima antes de chocar con las llantas.
    this.wallDistance = roadWidth / 2 + CURB_WIDTH + 1.2;
    const curve = new THREE.CatmullRomCurve3(
      points.map(([x, z]) => new THREE.Vector3(x * scale, 0, z * scale)),
      true,
      'centripetal',
    );
    // getSpacedPoints repite el primer punto al final; se quita para que la vuelta cierre sin duplicados.
    this.points = curve.getSpacedPoints(SAMPLES).slice(0, SAMPLES);
    this.count = this.points.length;
    this.tangents = this.points.map((_, i) => {
      const next = this.points[(i + 1) % this.count];
      const prev = this.points[(i - 1 + this.count) % this.count];
      return new THREE.Vector3().subVectors(next, prev).normalize();
    });
    // Perpendicular a la pista, para moverse hacia los lados (carriles, orillas).
    this.normals = this.tangents.map((t) => new THREE.Vector3(-t.z, 0, t.x));
  }

  // Muestra más cercana a (x, z). Con `hint` solo busca cerca de la anterior: así es rápido
  // y nadie "avanza" por cortar camino a través del pasto.
  closest(x, z, hint = null) {
    let best = 0;
    let bestDistSq = Infinity;
    const scan = (i) => {
      const p = this.points[i];
      const distSq = (p.x - x) ** 2 + (p.z - z) ** 2;
      if (distSq < bestDistSq) {
        bestDistSq = distSq;
        best = i;
      }
    };
    if (hint === null) {
      for (let i = 0; i < this.count; i += 1) scan(i);
    } else {
      for (let k = -SEARCH_WINDOW; k <= SEARCH_WINDOW; k += 1) scan((hint + k + this.count) % this.count);
    }
    return { index: best, distance: Math.sqrt(bestDistSq) };
  }

  // Qué tan corrido a un lado está (x, z) respecto a la muestra `index` (con signo).
  lateral(x, z, index) {
    const p = this.points[index];
    const n = this.normals[index];
    return (x - p.x) * n.x + (z - p.z) * n.z;
  }

  // Posición sobre la pista en la muestra `index`, corrida `lateral` unidades hacia un lado.
  pointAt(index, lateral = 0) {
    const i = ((index % this.count) + this.count) % this.count;
    const p = this.points[i];
    const n = this.normals[i];
    const t = this.tangents[i];
    return { x: p.x + n.x * lateral, z: p.z + n.z * lateral, heading: Math.atan2(t.x, t.z), index: i };
  }

  addTo(scene) {
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(700 * this.scale, 700 * this.scale),
      new THREE.MeshLambertMaterial({ color: this.ground }),
    );
    ground.rotation.x = -Math.PI / 2;
    scene.add(ground);

    const half = this.roadWidth / 2;
    scene.add(this.ribbon(-half, half, 0.02, () => 0x4a4a55));
    scene.add(this.ribbon(half, half + CURB_WIDTH, 0.03, curbColor));
    scene.add(this.ribbon(-half - CURB_WIDTH, -half, 0.03, curbColor));
    scene.add(this.startLine());
    for (const mesh of this.trees()) scene.add(mesh);
    if (this.barriers) scene.add(this.barrierWall());
  }

  // Tira de pavimento a lo largo de la pista, entre `inner` y `outer` (distancias laterales).
  // Cada segmento lleva sus propios vértices para que las franjas de color queden nítidas.
  ribbon(inner, outer, y, colorOf) {
    const positions = [];
    const colors = [];
    const color = new THREE.Color();
    for (let i = 0; i < this.count; i += 1) {
      const j = (i + 1) % this.count;
      const a = this.edge(i, inner, y);
      const b = this.edge(i, outer, y);
      const c = this.edge(j, outer, y);
      const d = this.edge(j, inner, y);
      positions.push(...a, ...b, ...c, ...a, ...c, ...d);
      color.setHex(colorOf(i));
      for (let v = 0; v < 6; v += 1) colors.push(color.r, color.g, color.b);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    // Todo es piso plano: la normal siempre apunta hacia arriba.
    const normals = new Float32Array(positions.length);
    for (let k = 1; k < normals.length; k += 3) normals[k] = 1;
    geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
    return new THREE.Mesh(geometry, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }));
  }

  edge(i, lateral, y) {
    const p = this.points[i];
    const n = this.normals[i];
    return [p.x + n.x * lateral, y, p.z + n.z * lateral];
  }

  startLine() {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 16;
    const ctx = canvas.getContext('2d');
    for (let x = 0; x < 16; x += 1) {
      for (let y = 0; y < 2; y += 1) {
        ctx.fillStyle = (x + y) % 2 === 0 ? '#ffffff' : '#111111';
        ctx.fillRect(x * 8, y * 8, 8, 8);
      }
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.magFilter = THREE.NearestFilter;
    const line = new THREE.Mesh(new THREE.PlaneGeometry(this.roadWidth, 1.75), new THREE.MeshBasicMaterial({ map: texture }));
    const start = this.pointAt(0);
    // Primero se acuesta el plano (x) y luego se gira sobre el eje vertical (y) para cruzar la pista.
    line.rotation.order = 'YXZ';
    line.rotation.set(-Math.PI / 2, start.heading, 0);
    line.position.set(start.x, 0.04, start.z);
    return line;
  }

  // Árboles repartidos lejos del camino. Se usa un generador con semilla para que la pista
  // se vea igual cada vez, y InstancedMesh para dibujar todos en una sola pasada (ligero para el Xbox).
  trees() {
    const random = seededRandom(7);
    const spots = [];
    const clearance = this.wallDistance + 5;
    while (spots.length < TREE_COUNT) {
      const x = (random() - 0.5) * 300 * this.scale;
      const z = (random() - 0.5) * 240 * this.scale;
      if (this.closest(x, z).distance < clearance) continue;
      spots.push({ x, z, scale: 0.8 + random() * 0.6 });
    }

    const trunks = new THREE.InstancedMesh(
      new THREE.CylinderGeometry(0.4, 0.5, 2, 6),
      new THREE.MeshLambertMaterial({ color: 0x8b5a2b }),
      spots.length,
    );
    const crowns = new THREE.InstancedMesh(new THREE.ConeGeometry(2.2, 5, 7), new THREE.MeshLambertMaterial(), spots.length);
    const greens = this.snowy ? [0x1f5a48, 0x26664f, 0x1a4d3e] : [0x2e8b57, 0x3fa34d, 0x267a46];
    const matrix = new THREE.Matrix4();
    const color = new THREE.Color();
    spots.forEach(({ x, z, scale }, i) => {
      matrix.makeScale(scale, scale, scale).setPosition(x, scale, z);
      trunks.setMatrixAt(i, matrix);
      matrix.makeScale(scale, scale, scale).setPosition(x, 2 * scale + 2.5 * scale, z);
      crowns.setMatrixAt(i, matrix);
      crowns.setColorAt(i, color.setHex(greens[i % greens.length]));
    });
    if (!this.snowy) return [trunks, crowns];
    // Gorrito de nieve en la punta de cada árbol.
    const caps = new THREE.InstancedMesh(new THREE.ConeGeometry(1.25, 2.3, 7), new THREE.MeshLambertMaterial({ color: 0xffffff }), spots.length);
    spots.forEach(({ x, z, scale }, i) => {
      matrix.makeScale(scale, scale, scale).setPosition(x, 2 * scale + 4.3 * scale, z);
      caps.setMatrixAt(i, matrix);
    });
    return [trunks, crowns, caps];
  }

  // Llantas rojas y blancas a ambos lados: no dejan que los karts se salgan.
  barrierWall() {
    const step = 2;
    const perSide = Math.ceil(this.count / step);
    const tires = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.9, 0.9, 1.1, 10), new THREE.MeshLambertMaterial(), perSide * 2);
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    let n = 0;
    for (let i = 0; i < this.count; i += step) {
      for (const side of [-1, 1]) {
        const spot = this.pointAt(i, side * (this.wallDistance + 0.9));
        dummy.position.set(spot.x, 0.55, spot.z);
        dummy.updateMatrix();
        tires.setMatrixAt(n, dummy.matrix);
        tires.setColorAt(n, color.setHex((i / step) % 2 === 0 ? 0xe53935 : this.snowy ? 0x3fa7ff : 0xffffff));
        n += 1;
      }
    }
    return tires;
  }
}

function curbColor(i) {
  return Math.floor(i / 3) % 2 === 0 ? 0xe53935 : 0xffffff;
}

function seededRandom(seed) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}
