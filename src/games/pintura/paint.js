import * as THREE from 'three';

// La pintura: el piso es un dibujo (canvas) donde caen las manchas de cada equipo, y se lleva la cuenta de qué
// cuadrito (de 1 x 1) es de quién para saber quién pintó más. Las manchas en paredes, cajas y rampas son
// calcomanías (todas las de un equipo en una sola malla, para que el Xbox las dibuje de un jalón).

// Pixeles del dibujo del piso (el lado más largo) y cada cuánto se sube a la tarjeta de video (subirlo en cada
// cuadro es caro en el Xbox).
const CANVAS_SIZE = 512;
const UPLOAD_EVERY_MS = 140;
const MAX_DECALS = 160;
const MAX_DROPS = 220;

export class FloorPaint {
  // `teams`: [{ color }] (el índice es el equipo).
  constructor(def, world, teams) {
    const [w, d] = def.size;
    this.w = w;
    this.d = d;
    this.teams = teams;
    this.canvas = document.createElement('canvas');
    this.canvas.width = w >= d ? CANVAS_SIZE : Math.round((CANVAS_SIZE * w) / d);
    this.canvas.height = d >= w ? CANVAS_SIZE : Math.round((CANVAS_SIZE * d) / w);
    this.ctx = this.canvas.getContext('2d');
    this.px = this.canvas.width / w;
    this.pz = this.canvas.height / d;
    paintFloorBase(this.ctx, this.canvas.width, this.canvas.height, def.floor, this.px);
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ map: this.texture }));

    // Los cuadritos: de quién es cada uno (0 = de nadie, 1 = equipo 0, 2 = equipo 1). Los que quedan debajo de una
    // caja o una rampa no cuentan.
    this.gw = Math.ceil(w);
    this.gd = Math.ceil(d);
    this.owner = new Uint8Array(this.gw * this.gd);
    this.counts = [0, 0];
    this.countable = new Uint8Array(this.gw * this.gd);
    this.total = 0;
    for (let i = 0; i < this.gw; i += 1) {
      for (let k = 0; k < this.gd; k += 1) {
        const x = i + 0.5 - w / 2;
        const z = k + 0.5 - d / 2;
        if (!world.blocked(x, z, 0)) {
          this.countable[k * this.gw + i] = 1;
          this.total += 1;
        }
      }
    }
    this.dirty = false;
    this.sinceUpload = 0;
  }

  cellIndex(x, z) {
    const i = Math.floor(x + this.w / 2);
    const k = Math.floor(z + this.d / 2);
    if (i < 0 || k < 0 || i >= this.gw || k >= this.gd) return -1;
    return k * this.gw + i;
  }

  // De qué equipo es el piso aquí (-1 = de nadie).
  ownerAt(x, z) {
    const index = this.cellIndex(x, z);
    return index < 0 ? -1 : this.owner[index] - 1;
  }

  // Una mancha en el piso. Devuelve cuántos cuadritos nuevos ganó ese equipo.
  splat(x, z, radius, team) {
    const color = cssColor(this.teams[team].color);
    const ctx = this.ctx;
    const cx = (x + this.w / 2) * this.px;
    const cz = (z + this.d / 2) * this.pz;
    ctx.fillStyle = color;
    blob(ctx, cx, cz, radius * this.px, radius * this.pz);

    let gained = 0;
    const r2 = radius * radius;
    for (let i = Math.floor(x - radius); i <= Math.ceil(x + radius); i += 1) {
      for (let k = Math.floor(z - radius); k <= Math.ceil(z + radius); k += 1) {
        const dx = i + 0.5 - x;
        const dz = k + 0.5 - z;
        if (dx * dx + dz * dz > r2) continue;
        const index = this.cellIndex(i + 0.5, k + 0.5);
        if (index < 0 || !this.countable[index]) continue;
        const before = this.owner[index];
        if (before === team + 1) continue;
        if (before) this.counts[before - 1] -= 1;
        this.owner[index] = team + 1;
        this.counts[team] += 1;
        gained += 1;
      }
    }
    this.dirty = true;
    return gained;
  }

  // Qué parte del piso (0 a 1) tiene cada equipo.
  coverage() {
    return this.counts.map((count) => count / Math.max(1, this.total));
  }

  update(dtMs) {
    this.sinceUpload += dtMs;
    if (!this.dirty || this.sinceUpload < UPLOAD_EVERY_MS) return;
    this.dirty = false;
    this.sinceUpload = 0;
    this.texture.needsUpdate = true;
  }

  dispose() {
    this.texture.dispose();
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
  }
}

// El dibujo del piso antes de pintar: losetas de hule (parque), alfombra con figuras (castillo) o arena (playa).
function paintFloorBase(ctx, width, height, floor, unit) {
  ctx.fillStyle = floor.base;
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = floor.line;
  ctx.fillStyle = floor.line;
  if (floor.pattern === 'tiles') {
    ctx.lineWidth = 2;
    const step = unit * 4;
    for (let x = 0; x <= width; x += step) ctx.strokeRect(x, 0, 0, height);
    for (let y = 0; y <= height; y += step) ctx.strokeRect(0, y, width, 0);
  } else if (floor.pattern === 'carpet') {
    const step = unit * 6;
    for (let x = step / 2; x < width; x += step) {
      for (let y = step / 2; y < height; y += step) {
        ctx.beginPath();
        ctx.arc(x, y, unit * 1.1, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  } else {
    for (let i = 0; i < 900; i += 1) {
      ctx.globalAlpha = 0.5;
      ctx.fillRect(Math.random() * width, Math.random() * height, 2, 2);
    }
    ctx.globalAlpha = 1;
  }
}

// Una mancha de pintura: un círculo grande con gotitas alrededor.
function blob(ctx, cx, cz, rx, rz) {
  ctx.beginPath();
  ctx.ellipse(cx, cz, rx * 0.78, rz * 0.78, 0, 0, Math.PI * 2);
  ctx.fill();
  const drops = 5;
  for (let i = 0; i < drops; i += 1) {
    const angle = (i / drops) * Math.PI * 2 + Math.random();
    const dist = 0.55 + Math.random() * 0.35;
    const size = 0.22 + Math.random() * 0.2;
    ctx.beginPath();
    ctx.ellipse(cx + Math.cos(angle) * rx * dist, cz + Math.sin(angle) * rz * dist, rx * size, rz * size, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function cssColor(hex) {
  return `#${hex.toString(16).padStart(6, '0')}`;
}

// La forma de una mancha (blanca, se pinta del color de cada equipo).
function splatTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff';
  blob(ctx, 32, 32, 28, 28);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// Las manchas en paredes, cajas, rampas y personas: calcomanías (las más viejas se reciclan).
export class Splats {
  constructor(scene, teams) {
    this.texture = splatTexture();
    this.geometry = new THREE.PlaneGeometry(1, 1);
    this.meshes = teams.map((team) => {
      const material = new THREE.MeshBasicMaterial({
        map: this.texture,
        color: team.color,
        transparent: true,
        alphaTest: 0.3,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -2,
      });
      const mesh = new THREE.InstancedMesh(this.geometry, material, MAX_DECALS);
      mesh.count = 0;
      mesh.frustumCulled = false;
      scene.add(mesh);
      return { mesh, next: 0 };
    });
    this.matrix = new THREE.Matrix4();
    this.quaternion = new THREE.Quaternion();
    this.position = new THREE.Vector3();
    this.scale = new THREE.Vector3();
    this.normal = new THREE.Vector3();
    this.forward = new THREE.Vector3(0, 0, 1);
    this.roll = new THREE.Quaternion();
  }

  add(team, x, y, z, normal, radius) {
    const entry = this.meshes[team];
    if (!entry) return;
    this.normal.set(normal[0], normal[1], normal[2]);
    this.quaternion.setFromUnitVectors(this.forward, this.normal);
    this.roll.setFromAxisAngle(this.forward, Math.random() * Math.PI * 2);
    this.quaternion.multiply(this.roll);
    this.position.set(x + normal[0] * 0.03, y + normal[1] * 0.03, z + normal[2] * 0.03);
    this.scale.set(radius * 2, radius * 2, 1);
    this.matrix.compose(this.position, this.quaternion, this.scale);
    entry.mesh.setMatrixAt(entry.next, this.matrix);
    entry.next = (entry.next + 1) % MAX_DECALS;
    entry.mesh.count = Math.max(entry.mesh.count, entry.next === 0 ? MAX_DECALS : entry.next);
    entry.mesh.instanceMatrix.needsUpdate = true;
  }

  dispose() {
    for (const { mesh } of this.meshes) {
      mesh.removeFromParent();
      mesh.material.dispose();
      mesh.dispose();
    }
    this.geometry.dispose();
    this.texture.dispose();
  }
}

// Las gotas en el aire: una malla por equipo con todas sus gotas.
export class DropMeshes {
  constructor(scene, teams) {
    this.geometry = new THREE.IcosahedronGeometry(0.22, 0);
    this.meshes = teams.map((team) => {
      const mesh = new THREE.InstancedMesh(this.geometry, new THREE.MeshBasicMaterial({ color: team.color }), MAX_DROPS);
      mesh.count = 0;
      mesh.frustumCulled = false;
      scene.add(mesh);
      return mesh;
    });
    this.matrix = new THREE.Matrix4();
    this.position = new THREE.Vector3();
    this.scale = new THREE.Vector3();
    this.quaternion = new THREE.Quaternion();
  }

  // `drops`: [{ x, y, z, team, size }]
  sync(drops) {
    const counts = this.meshes.map(() => 0);
    for (const drop of drops) {
      const mesh = this.meshes[drop.team];
      const i = counts[drop.team];
      if (!mesh || i >= MAX_DROPS) continue;
      this.position.set(drop.x, drop.y, drop.z);
      this.scale.setScalar(drop.size ?? 1);
      this.matrix.compose(this.position, this.quaternion, this.scale);
      mesh.setMatrixAt(i, this.matrix);
      counts[drop.team] = i + 1;
    }
    this.meshes.forEach((mesh, team) => {
      mesh.count = counts[team];
      mesh.instanceMatrix.needsUpdate = true;
    });
  }

  dispose() {
    for (const mesh of this.meshes) {
      mesh.removeFromParent();
      mesh.material.dispose();
      mesh.dispose();
    }
    this.geometry.dispose();
  }
}
