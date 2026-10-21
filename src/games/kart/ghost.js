import * as THREE from 'three';
import { settings } from '../../shared/settings.js';
import { buildKartModel } from '../three/kartModel.js';

// Contrarreloj: los récords de cada pista (tiempo total, la mejor vuelta y la carrera completa del récord) y el
// fantasma: un kart transparente que repite esa carrera para correr contra él.
const KEY = 'kartRecords';
const SAMPLE_MS = 100;
export const TIME_TRIAL_LAPS = 3;

// La llave de una pista (las de espejo llevan su propio récord).
export function recordKey(track, mirror) {
  return mirror ? `${track}-espejo` : track;
}

export function loadRecord(key) {
  return settings.get(KEY, {})[key] ?? null;
}

export function saveRecord(key, record) {
  const all = settings.get(KEY, {});
  all[key] = record;
  settings.set(KEY, all);
}

// "1:23.4"
export function formatTime(ms) {
  const tenths = Math.floor(ms / 100);
  const minutes = Math.floor(tenths / 600);
  const seconds = Math.floor((tenths % 600) / 10);
  return `${minutes}:${String(seconds).padStart(2, '0')}.${tenths % 10}`;
}

// Graba por dónde va un kart cada décima de segundo (redondeado, para que quepa en el almacenamiento).
export class GhostRecorder {
  constructor() {
    this.frames = [];
    this.nextMs = 0;
  }

  update(raceMs, racer) {
    while (raceMs >= this.nextMs) {
      this.frames.push([round(racer.x), round(racer.y), round(racer.z), Math.round(racer.heading * 100) / 100]);
      this.nextMs += SAMPLE_MS;
    }
  }
}

// El fantasma: el kart del récord, transparente, siguiendo lo que grabó.
export class GhostKart {
  constructor(scene, record) {
    this.frames = record.frames;
    const { setup } = record;
    const { group } = buildKartModel(setup.color, { type: setup.type, wheels: setup.wheels, extra: setup.extra });
    const material = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.4, depthWrite: false });
    group.traverse((mesh) => {
      if (!mesh.isMesh) return;
      if (mesh.material.vertexColors) mesh.material = material;
      else mesh.visible = false;
    });
    this.material = material;
    this.object = group;
    scene.add(group);
  }

  update(raceMs) {
    const at = raceMs / SAMPLE_MS;
    const i = Math.floor(at);
    // Ya terminó su carrera: se desvanece.
    if (i >= this.frames.length - 1) {
      this.object.visible = false;
      return;
    }
    const [a, b] = [this.frames[i], this.frames[i + 1]];
    const k = at - i;
    this.object.visible = true;
    this.object.position.set(a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k);
    const turn = Math.atan2(Math.sin(b[3] - a[3]), Math.cos(b[3] - a[3]));
    this.object.rotation.y = a[3] + turn * k;
  }

  dispose(scene) {
    scene.remove(this.object);
    this.material.dispose();
  }
}

function round(value) {
  return Math.round(value * 10) / 10;
}
