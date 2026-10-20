import * as THREE from 'three';

// Polvito, chispas y estrellitas. Todas las partículas de un tipo son puntos de una sola figura (THREE.Points),
// así se dibujan de una pasada aunque haya muchas (ligero para el Xbox). Cada una se va desvaneciendo.
const KINDS = {
  // Polvo al salirse al pasto (o arena, nieve...): grande, suave, sube poquito.
  dust: { max: 160, size: 1.8, additive: false, gravity: -1.5 },
  // Chispas al rozar las llantas, estrellitas al pegarle a alguien, brillitos de las monedas.
  spark: { max: 160, size: 0.7, additive: true, gravity: 14 },
  // Confeti de la premiación: de colores, cae despacito.
  confetti: { max: 260, size: 0.55, additive: false, gravity: 2.2 },
};

export class Particles {
  constructor(scene) {
    this.groups = Object.fromEntries(
      Object.entries(KINDS).map(([kind, spec]) => {
        const positions = new Float32Array(spec.max * 3);
        const colors = new Float32Array(spec.max * 4);
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 4));
        const material = new THREE.PointsMaterial({
          size: spec.size,
          map: softDot(),
          vertexColors: true,
          transparent: true,
          depthWrite: false,
          blending: spec.additive ? THREE.AdditiveBlending : THREE.NormalBlending,
        });
        const points = new THREE.Points(geometry, material);
        points.frustumCulled = false;
        scene.add(points);
        const list = Array.from({ length: spec.max }, () => ({ life: 0, max: 1, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, r: 1, g: 1, b: 1 }));
        return [kind, { spec, geometry, points, positions, colors, list, next: 0 }];
      }),
    );
    this.color = new THREE.Color();
  }

  // Una partícula: de qué tipo, dónde, a qué velocidad, de qué color y cuánto dura (ms).
  emit(kind, x, y, z, vx, vy, vz, color, lifeMs) {
    const group = this.groups[kind];
    const p = group.list[group.next];
    group.next = (group.next + 1) % group.list.length;
    this.color.setHex(color);
    Object.assign(p, { x, y, z, vx, vy, vz, life: lifeMs, max: lifeMs, r: this.color.r, g: this.color.g, b: this.color.b });
  }

  // Varias partículas que salen para todos lados desde un punto (`speed` de rapidez, `up` hacia arriba).
  burst(kind, x, y, z, count, colors, { speed = 8, up = 6, lifeMs = 600 } = {}) {
    for (let i = 0; i < count; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const v = speed * (0.5 + Math.random() * 0.5);
      this.emit(kind, x, y, z, Math.cos(angle) * v, up * (0.5 + Math.random()), Math.sin(angle) * v, colors[i % colors.length], lifeMs * (0.7 + Math.random() * 0.6));
    }
  }

  dispose() {
    for (const group of Object.values(this.groups)) {
      group.geometry.dispose();
      group.points.material.dispose();
    }
  }

  update(dtMs) {
    const dt = dtMs / 1000;
    for (const group of Object.values(this.groups)) {
      const { spec, positions, colors, list, geometry } = group;
      list.forEach((p, i) => {
        if (p.life > 0) {
          p.life -= dtMs;
          p.vy -= spec.gravity * dt;
          p.x += p.vx * dt;
          p.y = Math.max(0.05, p.y + p.vy * dt);
          p.z += p.vz * dt;
        }
        positions[i * 3] = p.x;
        positions[i * 3 + 1] = p.y;
        positions[i * 3 + 2] = p.z;
        colors.set([p.r, p.g, p.b, Math.max(0, p.life / p.max)], i * 4);
      });
      geometry.attributes.position.needsUpdate = true;
      geometry.attributes.color.needsUpdate = true;
    }
  }
}

// Bolita difuminada (sin textura los puntos se ven como cuadros).
let dot = null;
function softDot() {
  if (dot) return dot;
  const canvas = document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 32;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
  gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
  gradient.addColorStop(0.45, 'rgba(255, 255, 255, 0.75)');
  gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 32, 32);
  dot = new THREE.CanvasTexture(canvas);
  return dot;
}
