import * as THREE from 'three';

const CURB_WIDTH = 1.2;
const SAMPLES = 400;
const SEARCH_WINDOW = 25;
const TREE_COUNT = 70;
// Las texturas del piso se repiten cada TILE unidades.
const TILE = 26;
const ROAD_TEXTURE_BOOST = 1.45;

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
// `theme` cambia cómo se ve (todo es opcional):
//   road: color del camino   rainbow: camino de colores (el del espacio)   curbs: [color, color] de las orillas
//   barrierColors: [color, color] de las llantas   glow: llantas que brillan solas (de noche o en el espacio)
//   decor: pine | snowy | palm | candy | none (lo que hay alrededor: pinos, pinos con nieve, palmeras, paletas)
//   treeColors: los colores de las copas de los pinos   avoid: { x, z, radius } donde no poner nada (el castillo)
//   sea: del lado de abajo hay mar (ahí no se ponen árboles)
//   groundMap / groundTint: textura del piso (y de qué color se tiñe) · roadMap: textura del camino (asfalto)
export class Track {
  constructor({ roadWidth = 14, scale = 1, barriers = false, points = CONTROL_POINTS, ground = 0x6abf4b, snowy = false, theme = {} } = {}) {
    this.roadWidth = roadWidth;
    this.scale = scale;
    this.barriers = barriers;
    this.ground = ground;
    this.snowy = snowy;
    this.theme = {
      road: 0x4a4a55,
      rainbow: false,
      curbs: [0xe53935, 0xffffff],
      barrierColors: [0xe53935, snowy ? 0x3fa7ff : 0xffffff],
      glow: false,
      decor: snowy ? 'snowy' : 'pine',
      treeColors: snowy ? [0x1f5a48, 0x26664f, 0x1a4d3e] : [0x2e8b57, 0x3fa34d, 0x267a46],
      ...theme,
    };
    // Con mar, nada de árboles más allá de la orilla.
    if (this.theme.sea) this.theme.maxZ = Math.max(...points.map(([, z]) => z * scale)) + 20;
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
    const { groundMap, groundTint } = this.theme;
    const size = 700 * this.scale;
    // Con textura, se repite en cuadros de TILE de lado (en espejo, para que no se noten las uniones).
    if (groundMap) prepareTile(groundMap, size / TILE);
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(size, size),
      new THREE.MeshLambertMaterial({ color: groundMap ? (groundTint ?? 0xffffff) : this.ground, map: groundMap ?? null }),
    );
    ground.rotation.x = -Math.PI / 2;
    scene.add(ground);
    this.groundMesh = ground;

    const half = this.roadWidth / 2;
    const { road, rainbow, curbs } = this.theme;
    // El camino de arcoíris va de colores (cambia poco a poco) y brilla solo, sin depender de la luz.
    const roadColor = rainbow ? (i) => new THREE.Color().setHSL((i / this.count) * 6 % 1, 0.85, 0.6).getHex() : () => road;
    // El asfalto (si hay textura) es gris claro y se multiplica por el color del camino: se aclara el color para compensar.
    const roadMap = rainbow ? null : this.theme.roadMap;
    const roadTone = roadMap ? (i) => new THREE.Color(roadColor(i)).multiplyScalar(ROAD_TEXTURE_BOOST).getHex() : roadColor;
    if (roadMap) prepareTile(roadMap, 1);
    scene.add(this.ribbon(-half, half, 0.02, roadTone, rainbow, roadMap));
    const curbColor = (i) => curbs[Math.floor(i / 3) % 2];
    scene.add(this.ribbon(half, half + CURB_WIDTH, 0.03, curbColor, rainbow));
    scene.add(this.ribbon(-half - CURB_WIDTH, -half, 0.03, curbColor, rainbow));
    scene.add(this.startLine());
    for (const mesh of this.decorations()) scene.add(mesh);
    if (this.barriers) scene.add(this.barrierWall());
  }

  // Tira de pavimento a lo largo de la pista, entre `inner` y `outer` (distancias laterales).
  // Cada segmento lleva sus propios vértices para que las franjas de color queden nítidas.
  // `unlit`: sin sombras (brilla igual de noche).
  // `map`: textura que se repite a lo largo (una vez de lado a lado, y cada `roadWidth` hacia adelante).
  ribbon(inner, outer, y, colorOf, unlit = false, map = null) {
    const positions = [];
    const colors = [];
    const uvs = [];
    const color = new THREE.Color();
    const spacing = this.points[0].distanceTo(this.points[1]) / this.roadWidth;
    for (let i = 0; i < this.count; i += 1) {
      const j = (i + 1) % this.count;
      const a = this.edge(i, inner, y);
      const b = this.edge(i, outer, y);
      const c = this.edge(j, outer, y);
      const d = this.edge(j, inner, y);
      positions.push(...a, ...b, ...c, ...a, ...c, ...d);
      const [v0, v1] = [i * spacing, (i + 1) * spacing];
      uvs.push(0, v0, 1, v0, 1, v1, 0, v0, 1, v1, 0, v1);
      color.setHex(colorOf(i));
      for (let v = 0; v < 6; v += 1) colors.push(color.r, color.g, color.b);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    // Todo es piso plano: la normal siempre apunta hacia arriba.
    const normals = new Float32Array(positions.length);
    for (let k = 1; k < normals.length; k += 3) normals[k] = 1;
    geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
    const Material = unlit ? THREE.MeshBasicMaterial : THREE.MeshLambertMaterial;
    return new THREE.Mesh(geometry, new Material({ vertexColors: true, side: THREE.DoubleSide, map }));
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

  // Lugares al azar lejos del camino (y lejos de `avoid`, si se da: { x, z, radius }). Con semilla, para que
  // la pista se vea igual cada vez.
  scatter(count, seed = 7, avoid = null) {
    const random = seededRandom(seed);
    const spots = [];
    const clearance = this.wallDistance + 5;
    for (let tries = 0; spots.length < count && tries < count * 50; tries += 1) {
      const x = (random() - 0.5) * 300 * this.scale;
      const z = (random() - 0.5) * 240 * this.scale;
      if (this.closest(x, z).distance < clearance) continue;
      if (avoid && Math.hypot(x - avoid.x, z - avoid.z) < avoid.radius) continue;
      if (this.theme.maxZ !== undefined && z > this.theme.maxZ) continue;
      spots.push({ x, z, scale: 0.8 + random() * 0.6, turn: random() * Math.PI * 2 });
    }
    return spots;
  }

  // Lo que hay alrededor del camino según el tema: pinos, palmeras o paletas gigantes.
  decorations() {
    const { decor } = this.theme;
    if (decor === 'palm') return this.palms();
    if (decor === 'candy') return this.lollipops();
    if (decor === 'none') return [];
    return this.trees();
  }

  // Árboles repartidos lejos del camino. InstancedMesh dibuja todos en una sola pasada (ligero para el Xbox).
  trees() {
    const spots = this.scatter(TREE_COUNT, 7, this.theme.avoid);

    const trunks = new THREE.InstancedMesh(
      new THREE.CylinderGeometry(0.4, 0.5, 2, 6),
      new THREE.MeshLambertMaterial({ color: 0x8b5a2b }),
      spots.length,
    );
    const crowns = new THREE.InstancedMesh(new THREE.ConeGeometry(2.2, 5, 7), new THREE.MeshLambertMaterial(), spots.length);
    const greens = this.theme.treeColors;
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

  // Palmeras: tronco un poco chueco y un penacho de hojas.
  palms() {
    const spots = this.scatter(Math.round(TREE_COUNT * 0.7), 11);
    const trunks = new THREE.InstancedMesh(
      new THREE.CylinderGeometry(0.3, 0.5, 7, 6),
      new THREE.MeshLambertMaterial({ color: 0xa8763e }),
      spots.length,
    );
    const leaves = new THREE.InstancedMesh(new THREE.ConeGeometry(3.6, 1.6, 7), new THREE.MeshLambertMaterial({ color: 0x2fa84f }), spots.length);
    const coconuts = new THREE.InstancedMesh(new THREE.SphereGeometry(0.45, 8, 6), new THREE.MeshLambertMaterial({ color: 0x6b4a2b }), spots.length);
    const dummy = new THREE.Object3D();
    spots.forEach(({ x, z, scale, turn }, i) => {
      const lean = 0.18;
      dummy.position.set(x, 3.5 * scale, z);
      dummy.rotation.set(Math.cos(turn) * lean, 0, Math.sin(turn) * lean);
      dummy.scale.setScalar(scale);
      dummy.updateMatrix();
      trunks.setMatrixAt(i, dummy.matrix);
      // La punta del tronco se corre hacia donde se inclina.
      const tipX = x + Math.sin(turn) * -lean * 3.5 * scale;
      const tipZ = z + Math.cos(turn) * lean * 3.5 * scale;
      dummy.position.set(tipX, 7.2 * scale, tipZ);
      dummy.rotation.set(Math.PI, turn, 0);
      dummy.updateMatrix();
      leaves.setMatrixAt(i, dummy.matrix);
      dummy.position.set(tipX + 0.4 * scale, 6.6 * scale, tipZ);
      dummy.updateMatrix();
      coconuts.setMatrixAt(i, dummy.matrix);
    });
    return [trunks, leaves, coconuts];
  }

  // Paletas gigantes de colores (Dulcelandia).
  lollipops() {
    const spots = this.scatter(TREE_COUNT, 13);
    const sticks = new THREE.InstancedMesh(
      new THREE.CylinderGeometry(0.22, 0.22, 6, 6),
      new THREE.MeshLambertMaterial({ color: 0xfff6ea }),
      spots.length,
    );
    const candies = new THREE.InstancedMesh(new THREE.CylinderGeometry(2.2, 2.2, 0.6, 16).rotateX(Math.PI / 2), new THREE.MeshLambertMaterial(), spots.length);
    const swirls = new THREE.InstancedMesh(new THREE.TorusGeometry(1.2, 0.28, 6, 16), new THREE.MeshLambertMaterial({ color: 0xffffff }), spots.length);
    const colors = [0xff5fa8, 0x7fe0c8, 0xffd02a, 0xb07cff, 0xff8a5c];
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    spots.forEach(({ x, z, scale, turn }, i) => {
      dummy.rotation.set(0, turn, 0);
      dummy.scale.setScalar(scale);
      dummy.position.set(x, 3 * scale, z);
      dummy.updateMatrix();
      sticks.setMatrixAt(i, dummy.matrix);
      dummy.position.set(x, 7.6 * scale, z);
      dummy.updateMatrix();
      candies.setMatrixAt(i, dummy.matrix);
      candies.setColorAt(i, color.setHex(colors[i % colors.length]));
      dummy.position.set(x + Math.sin(turn) * 0.32 * scale, 7.6 * scale, z + Math.cos(turn) * 0.32 * scale);
      dummy.updateMatrix();
      swirls.setMatrixAt(i, dummy.matrix);
    });
    return [sticks, candies, swirls];
  }

  // Llantas de dos colores a ambos lados: no dejan que los karts se salgan.
  barrierWall() {
    const step = 2;
    const perSide = Math.ceil(this.count / step);
    const Material = this.theme.glow ? THREE.MeshBasicMaterial : THREE.MeshLambertMaterial;
    const tires = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.9, 0.9, 1.1, 10), new Material(), perSide * 2);
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    let n = 0;
    for (let i = 0; i < this.count; i += step) {
      for (const side of [-1, 1]) {
        const spot = this.pointAt(i, side * (this.wallDistance + 0.9));
        dummy.position.set(spot.x, 0.55, spot.z);
        dummy.updateMatrix();
        tires.setMatrixAt(n, dummy.matrix);
        tires.setColorAt(n, color.setHex(this.theme.barrierColors[(i / step) % 2]));
        n += 1;
      }
    }
    return tires;
  }
}

// Una textura que se repite `times` veces (en espejo, así no se notan las uniones).
function prepareTile(texture, times) {
  texture.wrapS = THREE.MirroredRepeatWrapping;
  texture.wrapT = THREE.MirroredRepeatWrapping;
  texture.repeat.set(times, times);
  texture.colorSpace = THREE.SRGBColorSpace;
}

function seededRandom(seed) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}
