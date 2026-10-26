import * as THREE from 'three';
import { TRACKS } from '../kart/tracks.js';

// Las pistas de Carreras: el mismo trazo y los mismos colores que las de Karts locos, pero planas (sin lomas) y sin
// texturas ni adornos de más, para que el Xbox dibuje rápido con la cámara de arriba.
export const RACE_TRACKS = ['pradera', 'playa', 'dulces', 'nieve', 'selva', 'desierto', 'castillo', 'espacio'];

// El campeonato: cuatro carreras seguidas, con puntos por lugar.
export const RACE_CUPS = {
  sol: { name: 'Copa Sol', emoji: '☀️', tracks: ['pradera', 'playa', 'selva', 'desierto'] },
  luna: { name: 'Copa Luna', emoji: '🌙', tracks: ['dulces', 'nieve', 'castillo', 'espacio'] },
};
export const RACE_CUP_KEYS = Object.keys(RACE_CUPS);
export const RACE_POINTS = [10, 8, 6, 4];

export function raceTrack(key) {
  const look = TRACKS[key] ?? TRACKS.pradera;
  return {
    key,
    name: look.name,
    emoji: look.emoji,
    points: look.points.map(([x, z]) => [x, z]),
    sky: look.sky,
    ground: look.ground,
    groundLight: look.groundLight ?? 0x5a7a3a,
    snowy: Boolean(look.snowy),
    theme: look.theme ?? {},
  };
}

// El dibujo de la pista para escogerla (SVG): el trazo visto desde arriba.
export function trackMapSvg(key, color = '#ffffff') {
  // La misma curva suave que la pista de verdad (ver Track).
  const curve = new THREE.CatmullRomCurve3(
    raceTrack(key).points.map(([x, z]) => new THREE.Vector3(x, 0, z)),
    true,
    'centripetal',
  );
  const points = curve.getSpacedPoints(80).map((p) => [p.x, p.z]);
  const xs = points.map(([x]) => x);
  const zs = points.map(([, z]) => z);
  const [minX, maxX, minZ, maxZ] = [Math.min(...xs), Math.max(...xs), Math.min(...zs), Math.max(...zs)];
  const scale = 100 / Math.max(maxX - minX, maxZ - minZ);
  const path = points.map(([x, z]) => `${((x - minX) * scale + 10).toFixed(1)},${((z - minZ) * scale + 10).toFixed(1)}`).join(' ');
  return `<svg viewBox="0 0 120 120" width="118" height="118"><polygon points="${path}" fill="none" stroke="#1b1530" stroke-width="13" stroke-linejoin="round"/>
    <polygon points="${path}" fill="none" stroke="${color}" stroke-width="7" stroke-linejoin="round"/></svg>`;
}
