import * as THREE from 'three';

// El atajo secreto de una pista: un caminito de tierra en línea recta que corta una curva, de la muestra `from` a
// la `to` (de 0 a 1 en la vuelta, ver `shortcut` en tracks.js). En la orilla hay un hueco en las llantas y un
// letrero. Adentro, unas piedritas a los lados no dejan salirse del caminito, y el avance en la vuelta cuenta como si
// fuera por la pista (así nadie pierde su lugar).
export const SHORTCUT_HALF = 3.6;
// Qué tanto se puede salir del caminito antes de que lo regresen.
const EDGE = 1.4;
const GAP_BEFORE = 4;
const GAP_AFTER = 9;
const STONE_EVERY = 3.2;
const PATH_COLOR = 0x9a6a44;
const STONE_COLOR = 0x8a8698;

export class Shortcut {
  constructor(track, [from, to], { color = PATH_COLOR } = {}) {
    this.track = track;
    this.color = color;
    this.i = Math.round(from * track.count);
    this.j = Math.round(to * track.count);
    const a = track.points[this.i];
    const b = track.points[this.j];
    this.a = new THREE.Vector2(a.x, a.z);
    this.b = new THREE.Vector2(b.x, b.z);
    this.length = this.a.distanceTo(this.b);
    this.dir = this.b.clone().sub(this.a).normalize();
    // Para qué lado de la pista sale (y por qué lado regresa): +1 = a la derecha del que maneja.
    const nI = track.normals[this.i];
    const nJ = track.normals[this.j];
    this.side = Math.sign(this.dir.x * nI.x + this.dir.y * nI.z) || 1;
    this.exitSide = Math.sign(-this.dir.x * nJ.x - this.dir.y * nJ.z) || 1;
  }

  // Lo que la pista necesita saber antes de dibujarse: dónde no poner llantas ni árboles.
  get gaps() {
    return [
      { side: this.side, from: this.i - GAP_BEFORE, to: this.i + GAP_AFTER },
      { side: this.exitSide, from: this.j - GAP_AFTER, to: this.j + GAP_BEFORE },
    ];
  }

  get clear() {
    return [{ x1: this.a.x, z1: this.a.y, x2: this.b.x, z2: this.b.y, radius: SHORTCUT_HALF + 6 }];
  }

  // Qué tan avanzado va sobre el atajo (t de 0 a 1) y qué tan lejos está de su línea (con signo).
  project(x, z) {
    const px = x - this.a.x;
    const pz = z - this.a.y;
    const t = (px * this.dir.x + pz * this.dir.y) / this.length;
    const d = px * -this.dir.y + pz * this.dir.x;
    return { t, d };
  }

  pointAt(t) {
    return { x: this.a.x + (this.b.x - this.a.x) * t, z: this.a.y + (this.b.y - this.a.y) * t };
  }

  // A qué muestra de la pista equivale ir en `t` del atajo.
  indexAt(t) {
    const span = (this.j - this.i + this.track.count) % this.track.count;
    return (this.i + Math.round(span * Math.max(0, Math.min(1, t)))) % this.track.count;
  }

  heightAt(x, z) {
    return this.track.groundHeight(x, z);
  }

  // ¿Va entrando? Pegado a la orilla del lado del atajo, junto a la entrada y sobre la línea del caminito.
  entering(racer) {
    const offset = (racer.index - this.i + this.track.count) % this.track.count;
    if (offset > GAP_AFTER && offset < this.track.count - GAP_BEFORE - 2) return false;
    const lateral = this.track.lateral(racer.x, racer.z, racer.index);
    if (lateral * this.side < this.track.roadWidth / 2 - 2) return false;
    const { t, d } = this.project(racer.x, racer.z);
    return t > 0 && t < 0.35 && Math.abs(d) < SHORTCUT_HALF + 1;
  }

  // Si se sale del caminito lo regresa (como las llantas de la pista). Devuelve true si lo tuvo que empujar.
  keepInside(racer) {
    const { d } = this.project(racer.x, racer.z);
    const limit = SHORTCUT_HALF + EDGE;
    if (Math.abs(d) <= limit) return false;
    const push = (Math.abs(d) - limit) * Math.sign(d);
    racer.x -= -this.dir.y * push;
    racer.z -= this.dir.x * push;
    return true;
  }

  // El caminito (sobre el pasto, siguiendo las lomas), piedritas a los lados y un letrero junto a la entrada.
  addTo(scene) {
    const track = this.track;
    const steps = Math.ceil(this.length / 2);
    const positions = [];
    const normal = { x: -this.dir.y, z: this.dir.x };
    // Empieza y termina en la orilla del camino (encima del camino ya no se dibuja).
    const start = (track.roadWidth / 2) / this.length;
    const edge = (t, side) => {
      const p = this.pointAt(t);
      const x = p.x + normal.x * side * SHORTCUT_HALF;
      const z = p.z + normal.z * side * SHORTCUT_HALF;
      return [x, this.heightAt(p.x, p.z) + 0.12, z];
    };
    for (let k = 0; k < steps; k += 1) {
      const t0 = start + ((1 - 2 * start) * k) / steps;
      const t1 = start + ((1 - 2 * start) * (k + 1)) / steps;
      const [a, b, c, d] = [edge(t0, -1), edge(t0, 1), edge(t1, 1), edge(t1, -1)];
      positions.push(...a, ...b, ...c, ...a, ...c, ...d);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.computeVertexNormals();
    this.path = new THREE.Mesh(geometry, new THREE.MeshLambertMaterial({ color: this.color, side: THREE.DoubleSide }));
    scene.add(this.path);

    const stones = Math.floor((this.length * (1 - 2 * start)) / STONE_EVERY);
    const rocks = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(0.7), new THREE.MeshLambertMaterial({ color: STONE_COLOR }), stones * 2);
    const matrix = new THREE.Matrix4();
    let n = 0;
    for (let k = 0; k < stones; k += 1) {
      const t = start + ((1 - 2 * start) * (k + 0.5)) / stones;
      for (const side of [-1, 1]) {
        const [x, y, z] = edge(t, side * 1.3);
        rocks.setMatrixAt(n, matrix.makeTranslation(x, y + 0.2, z));
        n += 1;
      }
    }
    scene.add(rocks);

    // El letrero: "¡Atajo!" con una flecha hacia donde se entra.
    const sign = new THREE.Sprite(new THREE.SpriteMaterial({ map: signTexture(this.side), depthWrite: false }));
    const spot = track.pointAt(this.i - 14, this.side * (track.wallDistance + 3));
    sign.position.set(spot.x, spot.y + 4.5, spot.z);
    sign.scale.set(7, 3.5, 1);
    scene.add(sign);
  }
}

function signTexture(side) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffd02a';
  ctx.strokeStyle = '#1b1530';
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.roundRect(8, 8, 240, 112, 24);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#1b1530';
  ctx.font = 'bold 50px "Segoe UI", Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(side > 0 ? '¡Atajo! ➜' : '⬅ ¡Atajo!', 128, 66);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
