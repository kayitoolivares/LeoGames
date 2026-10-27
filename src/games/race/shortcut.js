import * as THREE from 'three';

// El atajo de cada pista de Carreras: un camino de tierra derecho que corta una curva grande, con una flecha de turbo a
// la mitad y su letrero a la entrada. Se busca solo (findShortcut): el par de puntos de la pista que más camino ahorra
// (sin pasarse) cruzando nada más pasto. Nunca cruza la meta (si no, la vuelta no contaría bien).
export const SHORTCUT_WIDTH = 7;
// Entre qué partes de la vuelta (0 a 1) puede ir, qué tanto de la vuelta puede saltarse y cuánto camino ahorra.
const WINDOWS = [[0.04, 0.96]];
const SKIP = [0.05, 0.3];
const SAVE = [18, 80];
const MAX_LENGTH = 90;
// La flecha de turbo mide esto de largo.
export const PAD_LENGTH = 6;

// { a, b, from, to, length } (a y b: las muestras de la pista donde empieza y acaba), o null si no hay buen atajo.
export function findShortcut(track) {
  const n = track.count;
  const points = track.points;
  const clearance = track.roadWidth / 2 + 4;
  const avoid = track.theme.avoid;
  let best = null;
  for (const [low, high] of WINDOWS) {
    for (let a = Math.ceil(low * n); a < high * n; a += 3) {
      for (let b = a + Math.round(SKIP[0] * n); b <= Math.min(high * n, a + SKIP[1] * n); b += 3) {
        const p = points[a];
        const q = points[b];
        const length = Math.hypot(q.x - p.x, q.z - p.z);
        const save = (b - a) * track.spacing - length;
        if (length > MAX_LENGTH || save < SAVE[0] || save > SAVE[1] || (best && save <= best.save)) continue;
        if (crossesRoad(points, a, b, clearance) || (avoid && segmentDistance(avoid.x, avoid.z, p, q) < avoid.radius + SHORTCUT_WIDTH)) continue;
        best = { a, b, save, length, from: { x: p.x, z: p.z }, to: { x: q.x, z: q.z } };
      }
    }
  }
  return best;
}

// ¿El camino de la muestra `a` a la `b` pasa cerca de alguna parte de la pista? (Cerca de sus puntas, sin contar los
// pedazos de pista de donde sale y a donde llega.)
const NEIGHBORS = 14;
function crossesRoad(points, a, b, clearance) {
  const n = points.length;
  const [p, q] = [points[a], points[b]];
  const near = (i, j) => Math.min(Math.abs(i - j), n - Math.abs(i - j)) < NEIGHBORS;
  for (let k = 0.1; k <= 0.91; k += 0.05) {
    const x = p.x + (q.x - p.x) * k;
    const z = p.z + (q.z - p.z) * k;
    const middle = k > 0.3 && k < 0.7;
    for (let i = 0; i < n; i += 2) {
      if (!middle && (near(i, a) || near(i, b))) continue;
      if ((points[i].x - x) ** 2 + (points[i].z - z) ** 2 < clearance ** 2) return true;
    }
  }
  return false;
}

function segmentDistance(x, z, p, q) {
  const dx = q.x - p.x;
  const dz = q.z - p.z;
  const t = Math.max(0, Math.min(1, ((x - p.x) * dx + (z - p.z) * dz) / (dx * dx + dz * dz || 1)));
  return Math.hypot(x - (p.x + dx * t), z - (p.z + dz * t));
}

// Qué tanto del atajo lleva un carro en (x, z): de 0 (entrada) a 1 (salida), o null si no va sobre él.
export function shortcutProgress(shortcut, x, z) {
  const { from, to, length } = shortcut;
  const dx = (to.x - from.x) / length;
  const dz = (to.z - from.z) / length;
  const along = (x - from.x) * dx + (z - from.z) * dz;
  const side = Math.abs(-(x - from.x) * dz + (z - from.z) * dx);
  if (along < 0 || along > length || side > SHORTCUT_WIDTH / 2 + 0.6) return null;
  return along / length;
}

// El camino de tierra, la flecha de turbo y el letrero de "¡Atajo!".
export function buildShortcut(shortcut) {
  const { from, to, length } = shortcut;
  const group = new THREE.Group();
  const angle = Math.atan2(to.x - from.x, to.z - from.z);
  const mid = { x: (from.x + to.x) / 2, z: (from.z + to.z) / 2 };
  const road = new THREE.Mesh(new THREE.PlaneGeometry(SHORTCUT_WIDTH, length + 6).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: 0xc8a165 }));
  road.position.set(mid.x, 0.03, mid.z);
  road.rotation.y = angle;
  const pad = new THREE.Mesh(
    new THREE.PlaneGeometry(SHORTCUT_WIDTH - 1.4, PAD_LENGTH).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ map: arrowTexture(), transparent: true }),
  );
  pad.position.set(mid.x, 0.06, mid.z);
  pad.rotation.y = angle;
  // El letrero, a un ladito de la entrada.
  const side = { x: Math.cos(angle) * (SHORTCUT_WIDTH / 2 + 2), z: -Math.sin(angle) * (SHORTCUT_WIDTH / 2 + 2) };
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 3.2, 6), new THREE.MeshLambertMaterial({ color: 0x8b5a2b }));
  post.position.set(from.x + side.x, 1.6, from.z + side.z);
  const sign = new THREE.Sprite(new THREE.SpriteMaterial({ map: signTexture() }));
  sign.scale.set(6, 2.4, 1);
  sign.position.set(from.x + side.x, 4, from.z + side.z);
  group.add(road, pad, post, sign);
  return group;
}

// Flechas amarillas (en el dibujo apuntan hacia abajo: así, ya acostadas en la pista, apuntan hacia la salida).
function arrowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = 'rgba(255, 140, 40, 0.9)';
  ctx.fillRect(0, 0, 64, 64);
  ctx.fillStyle = '#ffe14d';
  for (const y of [8, 34]) {
    ctx.beginPath();
    ctx.moveTo(8, y);
    ctx.lineTo(32, y + 20);
    ctx.lineTo(56, y);
    ctx.lineTo(56, y + 8);
    ctx.lineTo(32, y + 28);
    ctx.lineTo(8, y + 8);
    ctx.fill();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function signTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 160;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffc93c';
  ctx.strokeStyle = '#1b1530';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.roundRect(4, 4, 152, 56, 12);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#1b1530';
  ctx.font = 'bold 34px "Segoe UI", Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('¡Atajo!', 80, 34);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
