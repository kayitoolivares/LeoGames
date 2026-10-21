import * as THREE from 'three';

// Cosas de la pista: flechas de turbo en el piso, rampas para saltar, rampas grandes azules que abren el planeador
// y partes bajo el agua (un túnel de agua: adentro el kart saca su hélice y flota más al saltar).
// Cada pista dice dónde van (en tracks.js): `pads` = [[dónde, carril], ...], `ramps` y `gliders` = [dónde, ...]
// y `water` = [desde, hasta], con "dónde" de 0 a 1 a lo largo de la vuelta y "carril" corrido a un lado del centro.
const PAD_SIZE = 5;
const PAD_REACH = 3;
const PAD_BOOST = { factor: 1.5, ms: 1000 };
const PAD_SCROLL = 1.6;
const RAMP_LENGTH = 7;
const RAMP_HEIGHT = 1.3;
// Al salir de la rampa sube con esta fracción de su velocidad.
const RAMP_LAUNCH = 0.36;
const RAMP_MIN_SPEED = 10;
// La rampa del planeador: más larga y alta, y avienta más alto (luego planea despacito).
const GLIDER_RAMP = { length: 9, height: 2.2, launch: 0.5 };
const GLIDER_COLORS = [0x3fa7ff, 0x9fe3ff, 0x2a6fc0];
const RAMP_COLORS = [0xff9a3c, 0xffd93c, 0xc26a1e];
// El túnel de agua: medio tubo transparente encima del camino.
const TUNNEL_SIDES = 12;
const TUNNEL_EXTRA = 2.5;

export class TrackFeatures {
  constructor(scene, track, { pads = [], ramps = [], gliders = [], water = null } = {}) {
    this.track = track;
    this.meshes = [];
    this.padTexture = chevronTexture();
    this.padMaterial = new THREE.MeshBasicMaterial({ map: this.padTexture, transparent: true });
    this.padGeometry = new THREE.PlaneGeometry(PAD_SIZE, PAD_SIZE);
    this.pads = pads.map(([at, lane]) => {
      const spot = track.pointAt(Math.round(at * track.count), lane);
      const mesh = new THREE.Mesh(this.padGeometry, this.padMaterial);
      // Acostada sobre el piso (inclinada como la loma) y apuntando hacia adelante.
      mesh.rotation.order = 'YXZ';
      mesh.rotation.set(-Math.PI / 2 - Math.atan(track.slopes[spot.index]), spot.heading, 0);
      mesh.position.set(spot.x, spot.y + 0.06, spot.z);
      scene.add(mesh);
      return { x: spot.x, z: spot.z };
    });

    // Cuántas muestras de la pista ocupa una rampa.
    const spacing = track.points[0].distanceTo(track.points[1]);
    const samples = Math.max(3, Math.round(RAMP_LENGTH / spacing));
    this.ramps = ramps.map((at) => {
      const start = Math.round(at * track.count);
      this.add(scene, rampMesh(track, start, samples, RAMP_HEIGHT, RAMP_COLORS));
      return { start, samples, height: RAMP_HEIGHT };
    });
    const gliderSamples = Math.max(3, Math.round(GLIDER_RAMP.length / spacing));
    this.gliders = gliders.map((at) => {
      const start = Math.round(at * track.count);
      this.add(scene, rampMesh(track, start, gliderSamples, GLIDER_RAMP.height, GLIDER_COLORS));
      return { start, samples: gliderSamples, height: GLIDER_RAMP.height, glider: true };
    });
    this.water = water ? { from: Math.round(water[0] * track.count), to: Math.round(water[1] * track.count) } : null;
    if (this.water) this.add(scene, tunnelMesh(track, this.water.from, this.water.to));
  }

  add(scene, mesh) {
    scene.add(mesh);
    this.meshes.push(mesh);
  }

  // La rampa bajo un carro: { height, glider } (height 0 = no está en una rampa).
  rampUnder(racer) {
    if (Math.abs(this.track.lateral(racer.x, racer.z, racer.index)) > this.track.roadWidth / 2 + 0.5) return NO_RAMP;
    for (const ramp of this.ramps.concat(this.gliders)) {
      const along = (racer.index - ramp.start + this.track.count) % this.track.count;
      if (along <= ramp.samples) return { height: (ramp.height * along) / ramp.samples, glider: Boolean(ramp.glider) };
    }
    return NO_RAMP;
  }

  // Cuánto sube la rampa bajo un carro (0 = no está en una rampa).
  rampAt(racer) {
    return this.rampUnder(racer).height;
  }

  // ¿Esta muestra de la pista va bajo el agua?
  inWater(index) {
    if (!this.water) return false;
    const { from, to } = this.water;
    return (index - from + this.track.count) % this.track.count <= (to - from + this.track.count) % this.track.count;
  }

  // Flechas: dan turbo a quien pasa por encima. Rampas: el piso sube y, al terminarse, sale volando.
  // `onBoost(racer)` y `onJump(racer)` avisan (para sonidos y letreros).
  update(dtMs, racers, { onBoost, onJump }) {
    this.padTexture.offset.y = (this.padTexture.offset.y - (PAD_SCROLL * dtMs) / 1000) % 1;
    for (const racer of racers) {
      // El piso bajo el kart: la altura del camino (lomas) más la rampa, si va en una.
      // (En el atajo el piso es el del caminito: eso lo pone el juego.)
      if (racer.shortcut) continue;
      const under = this.rampUnder(racer);
      const ramp = under.height;
      const floor = this.track.roadHeight(racer.x, racer.z, racer.index) + ramp;
      if (racer.ramp > RAMP_HEIGHT * 0.6 && ramp === 0 && racer.y >= racer.floor - 0.05 && racer.speed > RAMP_MIN_SPEED) {
        racer.launch(racer.speed * (racer.rampGlider ? GLIDER_RAMP.launch : RAMP_LAUNCH), racer.rampGlider);
        onJump?.(racer);
      }
      if (ramp > 0) racer.rampGlider = under.glider;
      racer.floor = floor;
      racer.ramp = ramp;
      if (racer.y > floor + 0.5) continue;
      const onPad = this.pads.some((pad) => Math.hypot(pad.x - racer.x, pad.z - racer.z) < PAD_REACH);
      if (onPad && !racer.onPad) {
        racer.boost(PAD_BOOST.factor, PAD_BOOST.ms);
        onBoost?.(racer);
      }
      racer.onPad = onPad;
    }
  }

  dispose() {
    for (const mesh of this.meshes) {
      mesh.geometry.dispose();
      mesh.material.dispose();
    }
    this.padTexture.dispose();
    this.padMaterial.dispose();
    this.padGeometry.dispose();
  }
}

// Flechas amarillas sobre naranja; la textura se recorre para que parezca que avanzan.
function chevronTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ff7a1a';
  ctx.fillRect(0, 0, 64, 64);
  ctx.fillStyle = '#ffe14d';
  ctx.beginPath();
  ctx.moveTo(8, 50);
  ctx.lineTo(32, 18);
  ctx.lineTo(56, 50);
  ctx.lineTo(44, 50);
  ctx.lineTo(32, 34);
  ctx.lineTo(20, 50);
  ctx.closePath();
  ctx.fill();
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1, 2);
  return texture;
}

const NO_RAMP = { height: 0, glider: false };

// Rampa de lo ancho del camino: sube desde el piso a lo largo de `samples` muestras hasta `height` y termina en una
// pared. Rayas de dos colores (`colors`: [raya, raya, lados]) para que se vea desde lejos: naranja y amarillo las
// normales, azules las del planeador.
function rampMesh(track, start, samples, height, palette) {
  const half = track.roadWidth / 2;
  const positions = [];
  const colors = [];
  const color = new THREE.Color();
  const corner = (k, side, high) => {
    const i = (start + k) % track.count;
    const p = track.points[i];
    const n = track.normals[i];
    return [p.x + n.x * side * half, p.y + (high ? (height * k) / samples + 0.06 : 0.06), p.z + n.z * side * half];
  };
  const quad = (a, b, c, d, hex) => {
    positions.push(...a, ...b, ...c, ...a, ...c, ...d);
    color.setHex(hex);
    for (let v = 0; v < 6; v += 1) colors.push(color.r, color.g, color.b);
  };
  for (let k = 0; k < samples; k += 1) {
    const stripe = palette[k % 2];
    quad(corner(k, -1, true), corner(k, 1, true), corner(k + 1, 1, true), corner(k + 1, -1, true), stripe);
    // Los lados.
    for (const side of [-1, 1]) quad(corner(k, side, false), corner(k, side, true), corner(k + 1, side, true), corner(k + 1, side, false), palette[2]);
  }
  // La pared del final.
  quad(corner(samples, -1, false), corner(samples, -1, true), corner(samples, 1, true), corner(samples, 1, false), palette[2]);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  return new THREE.Mesh(geometry, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }));
}

// El túnel de agua: medio tubo azul transparente que cubre el camino de la muestra `from` a la `to`.
function tunnelMesh(track, from, to) {
  const radius = track.wallDistance + TUNNEL_EXTRA;
  const span = (to - from + track.count) % track.count;
  const positions = [];
  const ring = (k) => {
    const i = (from + k) % track.count;
    const p = track.points[i];
    const n = track.normals[i];
    return Array.from({ length: TUNNEL_SIDES + 1 }, (_, side) => {
      const angle = (side / TUNNEL_SIDES) * Math.PI;
      return [p.x + n.x * Math.cos(angle) * radius, p.y + Math.sin(angle) * radius * 0.6 - 0.3, p.z + n.z * Math.cos(angle) * radius];
    });
  };
  let prev = ring(0);
  for (let k = 1; k <= span; k += 1) {
    const next = ring(k);
    for (let side = 0; side < TUNNEL_SIDES; side += 1) {
      positions.push(...prev[side], ...prev[side + 1], ...next[side + 1], ...prev[side], ...next[side + 1], ...next[side]);
    }
    prev = next;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(
    geometry,
    new THREE.MeshBasicMaterial({ color: 0x46b4ff, transparent: true, opacity: 0.45, side: THREE.DoubleSide, depthWrite: false }),
  );
  mesh.renderOrder = 2;
  // Aros blancos en la entrada y la salida, para que se vea desde lejos.
  for (const k of [0, span]) {
    const i = (from + k) % track.count;
    const p = track.points[i];
    const t = track.tangents[i];
    const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.5, 6, 24, Math.PI), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    ring.scale.set(1, 0.6, 1);
    ring.position.set(p.x, p.y - 0.3, p.z);
    ring.rotation.y = Math.atan2(t.x, t.z);
    mesh.add(ring);
  }
  return mesh;
}
