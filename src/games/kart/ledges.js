import * as THREE from 'three';

// Puentes colgantes (`ledges` en tracks.js: [[desde, hasta], ...], de 0 a 1 de la vuelta): ahí no hay llantas a los
// lados y abajo está el abismo. El que se sale del puente se cae... y una red allá abajo lo avienta de regreso al
// camino un ratito después, sin perder su lugar en la vuelta. Unos cristalitos que brillan marcan la orilla.
// `depth`: hasta dónde se cae; `netMs`: cuánto tarda la red en regresarlo; `bounce`: qué tan alto lo avienta;
// `edge`: qué tanto antes de donde estarían las llantas empieza el vacío.
const FALL = { depth: 30, netMs: 1100, bounce: 15, edge: 0.6 };
// El abismo a los lados del puente: qué tan ancho se ve.
const CHASM_WIDTH = 36;
const CHASM_COLOR = 0x07050f;
// Las tablas del puente (cada cuánto) y los cristalitos de la orilla (cada cuántas muestras).
const PLANK_EVERY = 1.7;
const PLANK_COLORS = [0x8a5a3a, 0x7a4a2a, 0x9a6a44];
const MARK_EVERY = 4;
const MARK_COLORS = [0x3fe0ff, 0xb07cff];

export class Ledges {
  constructor(track, ranges) {
    this.track = track;
    this.ranges = ranges.map(([from, to]) => [Math.round(from * track.count), Math.round(to * track.count)]);
  }

  // Huecos en las llantas (de los dos lados del puente), para que la pista no las dibuje.
  get gaps() {
    return this.ranges.flatMap(([from, to]) => [1, -1].map((side) => ({ side, from, to })));
  }

  // ¿La muestra `index` va sobre un puente?
  open(index) {
    return this.ranges.some(([from, to]) => index >= from && index <= to);
  }

  // El abismo negro a los lados, las tablas encima del camino, postes en las puntas y cristalitos en la orilla.
  addTo(scene) {
    const track = this.track;
    const planks = [];
    const marks = [];
    const posts = [];
    for (const [from, to] of this.ranges) {
      // (Un poquito más allá de las puntas, para que no se vea el pasto entre el abismo y las llantas.)
      scene.add(this.chasm(from - 2, to + 2, 1), this.chasm(from - 2, to + 2, -1));
      const length = (to - from) * track.spacing;
      for (let k = 0; k * PLANK_EVERY < length; k += 1) planks.push(track.pointAt(from + Math.round((k * PLANK_EVERY) / track.spacing)));
      for (let i = from; i <= to; i += MARK_EVERY) for (const side of [-1, 1]) marks.push(track.pointAt(i, side * (track.wallDistance - FALL.edge)));
      for (const i of [from, to]) for (const side of [-1, 1]) posts.push(track.pointAt(i, side * (track.roadWidth / 2 + 1.6)));
    }
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    const boards = new THREE.InstancedMesh(new THREE.BoxGeometry(track.roadWidth + 2.4, 0.16, 1.2), new THREE.MeshLambertMaterial(), planks.length);
    planks.forEach((p, i) => {
      dummy.position.set(p.x, p.y + 0.06, p.z);
      dummy.rotation.set(-Math.atan(track.slopes[p.index]), p.heading, 0, 'YXZ');
      dummy.updateMatrix();
      boards.setMatrixAt(i, dummy.matrix);
      boards.setColorAt(i, color.setHex(PLANK_COLORS[i % PLANK_COLORS.length]));
    });
    const lights = new THREE.InstancedMesh(new THREE.OctahedronGeometry(0.45), new THREE.MeshBasicMaterial(), marks.length);
    marks.forEach((p, i) => {
      dummy.position.set(p.x, p.y + 0.5, p.z);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      lights.setMatrixAt(i, dummy.matrix);
      lights.setColorAt(i, color.setHex(MARK_COLORS[i % MARK_COLORS.length]));
    });
    const poles = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.35, 0.45, 5, 8), new THREE.MeshLambertMaterial({ color: 0x6a4a2a }), posts.length);
    posts.forEach((p, i) => {
      dummy.position.set(p.x, p.y + 2.5, p.z);
      dummy.updateMatrix();
      poles.setMatrixAt(i, dummy.matrix);
    });
    scene.add(boards, lights, poles);
  }

  // Qué tan ancho puede ser el abismo en la muestra `i` hacia `side` sin taparle el camino a otra parte de la pista.
  reach(i, side) {
    const track = this.track;
    for (let width = 2; width <= CHASM_WIDTH; width += 2) {
      const p = track.pointAt(i, side * (track.wallDistance + width));
      const near = track.closest(p.x, p.z);
      const apart = Math.min(Math.abs(near.index - i), track.count - Math.abs(near.index - i));
      if (apart > 20 && near.distance < track.wallDistance + 3) return Math.max(2, width - 2);
    }
    return CHASM_WIDTH;
  }

  // Una franja negra a un lado del puente, de la orilla del camino hacia afuera (siguiendo la altura del camino).
  chasm(from, to, side) {
    const track = this.track;
    const positions = [];
    const inner = side * (track.wallDistance - FALL.edge - 0.4);
    const widths = [];
    for (let i = from; i <= to; i += 1) widths.push(this.reach(i, side));
    // (Sin brincos de ancho de una muestra a otra: el más angosto de sus vecinas.)
    const outer = (k) => side * (track.wallDistance + Math.min(...widths.slice(Math.max(0, k - 3), k + 4)));
    for (let i = from; i < to; i += 1) {
      const k = i - from;
      const [a, b, c, d] = [track.pointAt(i, inner), track.pointAt(i, outer(k)), track.pointAt(i + 1, outer(k + 1)), track.pointAt(i + 1, inner)];
      positions.push(a.x, a.y + 0.05, a.z, b.x, b.y + 0.05, b.z, c.x, c.y + 0.05, c.z, a.x, a.y + 0.05, a.z, c.x, c.y + 0.05, c.z, d.x, d.y + 0.05, d.z);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    return new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color: CHASM_COLOR, side: THREE.DoubleSide }));
  }

  // Cada cuadro, después de que las rampas pusieron el piso de cada kart. `onFall(racer)` cuando uno se cae del
  // puente y `onSaved(racer)` cuando la red lo regresa.
  update(dtMs, racers, { onFall, onSaved } = {}) {
    const track = this.track;
    for (const racer of racers) {
      if (racer.fallMs > 0) {
        racer.fallMs += dtMs;
        racer.floor = racer.fallFloor;
        racer.speed *= 0.96;
        if (racer.fallMs < FALL.netMs) continue;
        // ¡La red! Lo regresa a media pista, en el mismo lugar de la vuelta, y lo avienta para arriba.
        const spot = track.pointAt(racer.index, 0);
        racer.fallMs = 0;
        racer.x = spot.x;
        racer.z = spot.z;
        racer.heading = spot.heading;
        racer.speed = 0;
        racer.floor = track.roadHeight(spot.x, spot.z, spot.index);
        racer.y = racer.floor + 1;
        racer.launch(FALL.bounce);
        onSaved?.(racer);
        continue;
      }
      if (racer.shortcut || racer.airborne || !this.open(racer.index)) continue;
      if (Math.abs(track.lateral(racer.x, racer.z, racer.index)) < track.wallDistance - FALL.edge) continue;
      racer.fallMs = 1;
      // (La cámara se queda a la altura del puente viendo cómo se cae: ver KartGame.updateCameras.)
      racer.fallRoad = racer.floor;
      racer.fallFloor = racer.floor - FALL.depth;
      racer.floor = racer.fallFloor;
      racer.vy = 0;
      if (racer.drifting) racer.endDrift(true);
      onFall?.(racer);
    }
  }
}
