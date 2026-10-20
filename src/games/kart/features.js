import * as THREE from 'three';

// Cosas de la pista que ayudan a ir más rápido: flechas de turbo en el piso y rampas para saltar.
// Cada pista dice dónde van (en tracks.js): `pads` = [[dónde, carril], ...] y `ramps` = [dónde, ...],
// con "dónde" de 0 a 1 a lo largo de la vuelta y "carril" corrido a un lado del centro.
const PAD_SIZE = 5;
const PAD_REACH = 3;
const PAD_BOOST = { factor: 1.5, ms: 1000 };
const PAD_SCROLL = 1.6;
const RAMP_LENGTH = 7;
const RAMP_HEIGHT = 1.3;
// Al salir de la rampa sube con esta fracción de su velocidad.
const RAMP_LAUNCH = 0.36;
const RAMP_MIN_SPEED = 10;

export class TrackFeatures {
  constructor(scene, track, { pads = [], ramps = [] } = {}) {
    this.track = track;
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
      scene.add(rampMesh(track, start, samples));
      return { start, samples };
    });
  }

  // Cuánto sube la rampa bajo un carro (0 = no está en una rampa).
  rampAt(racer) {
    if (Math.abs(this.track.lateral(racer.x, racer.z, racer.index)) > this.track.roadWidth / 2 + 0.5) return 0;
    for (const ramp of this.ramps) {
      const along = (racer.index - ramp.start + this.track.count) % this.track.count;
      if (along <= ramp.samples) return (RAMP_HEIGHT * along) / ramp.samples;
    }
    return 0;
  }

  // Flechas: dan turbo a quien pasa por encima. Rampas: el piso sube y, al terminarse, sale volando.
  // `onBoost(racer)` y `onJump(racer)` avisan (para sonidos y letreros).
  update(dtMs, racers, { onBoost, onJump }) {
    this.padTexture.offset.y = (this.padTexture.offset.y - (PAD_SCROLL * dtMs) / 1000) % 1;
    for (const racer of racers) {
      // El piso bajo el kart: la altura del camino (lomas) más la rampa, si va en una.
      const ramp = this.rampAt(racer);
      const floor = this.track.roadHeight(racer.x, racer.z, racer.index) + ramp;
      if (racer.ramp > RAMP_HEIGHT * 0.6 && ramp === 0 && racer.y >= racer.floor - 0.05 && racer.speed > RAMP_MIN_SPEED) {
        racer.launch(racer.speed * RAMP_LAUNCH);
        onJump?.(racer);
      }
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

// Rampa de lo ancho del camino: sube desde el piso a lo largo de `samples` muestras y termina en una pared.
// Rayas naranja y amarillo para que se vea desde lejos.
function rampMesh(track, start, samples) {
  const half = track.roadWidth / 2;
  const positions = [];
  const colors = [];
  const color = new THREE.Color();
  const corner = (k, side, high) => {
    const i = (start + k) % track.count;
    const p = track.points[i];
    const n = track.normals[i];
    return [p.x + n.x * side * half, p.y + (high ? (RAMP_HEIGHT * k) / samples + 0.06 : 0.06), p.z + n.z * side * half];
  };
  const quad = (a, b, c, d, hex) => {
    positions.push(...a, ...b, ...c, ...a, ...c, ...d);
    color.setHex(hex);
    for (let v = 0; v < 6; v += 1) colors.push(color.r, color.g, color.b);
  };
  for (let k = 0; k < samples; k += 1) {
    const stripe = k % 2 === 0 ? 0xff9a3c : 0xffd93c;
    quad(corner(k, -1, true), corner(k, 1, true), corner(k + 1, 1, true), corner(k + 1, -1, true), stripe);
    // Los lados.
    for (const side of [-1, 1]) quad(corner(k, side, false), corner(k, side, true), corner(k + 1, side, true), corner(k + 1, side, false), 0xc26a1e);
  }
  // La pared del final.
  quad(corner(samples, -1, false), corner(samples, -1, true), corner(samples, 1, true), corner(samples, 1, false), 0xc26a1e);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  return new THREE.Mesh(geometry, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }));
}
