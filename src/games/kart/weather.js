import * as THREE from 'three';
import { Snowfall } from './scenery.js';

// El clima de la carrera (lo escoge el Jugador 1 con Y): soleado, lluvia (gotas y charcos que resbalan), nieve
// (copos) o noche (todo oscuro, faros en los karts y lámparas junto al camino). Todo con pocas piezas para el Xbox.
export const WEATHERS = {
  auto: { name: 'De la pista' },
  sol: { name: 'Soleado ☀️' },
  lluvia: { name: 'Lluvia 🌧️', light: 0.7, sky: 0.55 },
  nieve: { name: 'Nieve ❄️', light: 0.9, sky: 0.85 },
  noche: { name: 'Noche 🌙', light: 0.35, sky: 0.22 },
};
export const WEATHER_KEYS = Object.keys(WEATHERS);
const RAIN_DROPS = 1400;
const PUDDLES = 9;
const PUDDLE_RADIUS = 2.6;
const LAMP_EVERY = 26;

export class Weather {
  // `kind`: sol | lluvia | nieve | noche.
  constructor(scene, track, kind, racers) {
    this.kind = kind;
    this.track = track;
    this.puddles = [];
    this.lamps = [];
    this.lights = [];
    if (kind === 'lluvia') {
      this.fall = new Snowfall(scene, track, { count: RAIN_DROPS, speed: 34, size: 0.9, color: 0xbfd8ff });
      this.fall.points.material.map = dropTexture();
      this.addPuddles(scene);
    } else if (kind === 'nieve') {
      this.fall = new Snowfall(scene, track);
    } else if (kind === 'noche') {
      this.addLamps(scene);
      for (const racer of racers) this.addHeadlights(racer);
    }
  }

  // ¿Qué tan oscuro se pone el cielo y la luz? (1 = igual que siempre.)
  get light() {
    return WEATHERS[this.kind]?.light ?? 1;
  }

  get sky() {
    return WEATHERS[this.kind]?.sky ?? 1;
  }

  // Charcos en el camino: si un kart pasa por uno, se resbala (`onSlip`).
  addPuddles(scene) {
    const material = new THREE.MeshBasicMaterial({ color: 0x6f8fb8, transparent: true, opacity: 0.55, depthWrite: false });
    const geometry = new THREE.CircleGeometry(PUDDLE_RADIUS, 18).rotateX(-Math.PI / 2);
    for (let k = 0; k < PUDDLES; k += 1) {
      const index = Math.round(((k + 0.5) / PUDDLES) * this.track.count + 9) % this.track.count;
      const lateral = [-5, 0, 5][k % 3];
      const spot = this.track.pointAt(index, lateral);
      const mesh = new THREE.Mesh(geometry, material);
      mesh.scale.set(1.4, 1, 0.8);
      mesh.rotation.y = spot.heading;
      mesh.position.set(spot.x, spot.y + 0.05, spot.z);
      scene.add(mesh);
      this.puddles.push({ x: spot.x, z: spot.z });
    }
  }

  // Lámparas junto al camino (de noche): un poste con una luz que brilla.
  addLamps(scene) {
    const glow = glowMap();
    const posts = [];
    for (let i = 5, side = 1; i < this.track.count; i += LAMP_EVERY, side = -side) {
      const spot = this.track.pointAt(i, side * (this.track.wallDistance + 2.5));
      if (this.track.blocked(spot.x, spot.z)) continue;
      posts.push({ ...spot, y: this.track.groundHeight(spot.x, spot.z) });
    }
    const poles = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.15, 0.2, 6, 6), new THREE.MeshLambertMaterial({ color: 0x3a3a48 }), posts.length);
    const matrix = new THREE.Matrix4();
    posts.forEach(({ x, y, z }, i) => {
      poles.setMatrixAt(i, matrix.makeTranslation(x, y + 3, z));
      const light = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: 0xffe9a8, blending: THREE.AdditiveBlending, depthWrite: false }));
      light.position.set(x, y + 6.3, z);
      light.scale.setScalar(4);
      scene.add(light);
      // La luz en el piso, para que se vea el camino.
      const pool = new THREE.Mesh(new THREE.CircleGeometry(6, 16).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.18, depthWrite: false, blending: THREE.AdditiveBlending }));
      pool.position.set(x, y + 0.06, z);
      scene.add(pool);
    });
    scene.add(poles);
  }

  // Faros: dos lucecitas enfrente del kart y un rayo de luz en el piso hacia adelante.
  addHeadlights(racer) {
    const glow = glowMap();
    const group = new THREE.Group();
    for (const x of [-0.7, 0.7]) {
      const lamp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: 0xfff4c8, blending: THREE.AdditiveBlending, depthWrite: false }));
      lamp.position.set(x, 0.8, 1.9);
      lamp.scale.setScalar(1.4);
      group.add(lamp);
    }
    const beam = new THREE.Mesh(
      // (Acostado con la punta angosta junto al kart y lo ancho hacia adelante.)
      new THREE.PlaneGeometry(1, 1).rotateX(Math.PI / 2),
      new THREE.MeshBasicMaterial({ map: beamMap(), color: 0xfff4c8, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }),
    );
    beam.scale.set(7, 1, 14);
    beam.position.set(0, 0.12, 9);
    group.add(beam);
    racer.object.add(group);
  }

  // Lluvia y nieve caen; los charcos hacen resbalar al que los pisa.
  update(dt, racers, onSlip) {
    this.fall?.update(dt);
    for (const racer of racers) {
      if (this.puddles.some((p) => Math.hypot(p.x - racer.x, p.z - racer.z) < PUDDLE_RADIUS + 0.6) && racer.slip()) onSlip?.(racer);
    }
  }
}

// Gota de lluvia: una rayita vertical (los puntos se ven como gotas largas).
function dropTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 16;
  canvas.height = 32;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createLinearGradient(0, 0, 0, 32);
  gradient.addColorStop(0, 'rgba(255, 255, 255, 0)');
  gradient.addColorStop(1, 'rgba(255, 255, 255, 0.9)');
  ctx.fillStyle = gradient;
  ctx.fillRect(6, 0, 4, 32);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

let glowTexture = null;
function glowMap() {
  if (glowTexture) return glowTexture;
  const canvas = document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 32;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
  gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
  gradient.addColorStop(0.4, 'rgba(255, 255, 255, 0.7)');
  gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 32, 32);
  glowTexture = new THREE.CanvasTexture(canvas);
  return glowTexture;
}

// El rayo de los faros: un triángulo de luz que se desvanece a lo lejos.
let beamTexture = null;
function beamMap() {
  if (beamTexture) return beamTexture;
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createLinearGradient(0, 64, 0, 0);
  gradient.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
  gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.moveTo(26, 64);
  ctx.lineTo(38, 64);
  ctx.lineTo(64, 0);
  ctx.lineTo(0, 0);
  ctx.closePath();
  ctx.fill();
  beamTexture = new THREE.CanvasTexture(canvas);
  return beamTexture;
}
