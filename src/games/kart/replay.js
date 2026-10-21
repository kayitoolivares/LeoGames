import * as THREE from 'three';
import { WIDTH, HEIGHT } from '../three/stage.js';

// La repetición de la llegada: se graba todo (los últimos segundos) y, al terminar la carrera, la llegada del
// primer lugar se ve otra vez en cámara lenta con cámaras de tele junto a la meta. A la brinca.
const KEEP_MS = 8000;
const BEFORE_MS = 3200;
const AFTER_MS = 1400;
const SPEED = 0.55;
// La segunda cámara (en la meta) entra este rato antes de que llegue.
const FINISH_SHOT_MS = 1300;

export class FinishReplay {
  constructor() {
    this.frames = [];
    this.t = 0;
    this.finishT = null;
    this.camera = new THREE.PerspectiveCamera(48, WIDTH / HEIGHT, 0.5, 900);
    this.look = new THREE.Vector3();
  }

  record(dtMs, racers) {
    this.t += dtMs;
    this.frames.push({ t: this.t, states: racers.map(snapshot) });
    while (this.frames.length > 2 && this.frames[0].t < this.t - KEEP_MS) this.frames.shift();
  }

  // Cuando llega el primero (se graba un poquito más después).
  markFinish(racer) {
    if (this.finishT !== null) return;
    this.finishT = this.t;
    this.winner = racer;
  }

  // ¿Hay suficiente grabado para verla?
  get ready() {
    return this.finishT !== null && this.frames.length > 30 && this.frames[0].t < this.finishT - 800;
  }

  start(racers) {
    this.racers = racers;
    this.playT = Math.max(this.frames[0].t, this.finishT - BEFORE_MS);
    this.endT = Math.min(this.t, this.finishT + AFTER_MS);
    this.index = 0;
    this.shot = null;
  }

  // Avanza la repetición y pone a todos donde iban. Devuelve false cuando se acabó.
  step(dtMs, track) {
    this.playT += dtMs * SPEED;
    while (this.index < this.frames.length - 1 && this.frames[this.index + 1].t <= this.playT) this.index += 1;
    const frame = this.frames[this.index];
    this.racers.forEach((racer, i) => apply(racer, frame.states[i]));
    this.aim(track);
    return this.playT < this.endT;
  }

  // Cámaras de tele: primero una junto al camino, adelante del que va a ganar; luego otra en la meta.
  aim(track) {
    const winner = this.winner;
    const shot = this.playT < this.finishT - FINISH_SHOT_MS ? 'side' : 'finish';
    if (shot !== this.shot) {
      this.shot = shot;
      const spot = shot === 'side' ? track.pointAt(winner.index + 28, track.wallDistance + 7) : track.pointAt(4, track.wallDistance + 6);
      this.camera.position.set(spot.x, spot.y + (shot === 'side' ? 4.5 : 3), spot.z);
      this.look.set(winner.x, winner.y + 1, winner.z);
    }
    this.look.lerp(new THREE.Vector3(winner.x, winner.y + 1, winner.z), 0.2);
    this.camera.lookAt(this.look);
  }
}

function snapshot(racer) {
  const o = racer.object;
  return {
    x: racer.x,
    y: racer.y,
    z: racer.z,
    heading: racer.heading,
    index: racer.index,
    rx: o.rotation.x,
    ry: o.rotation.y,
    rz: o.rotation.z,
    scale: o.scale.x,
    visible: o.visible,
    flame: racer.flame.visible,
    shield: racer.shield.visible,
    wing: racer.wing.visible,
    star: racer.starGlow.visible,
    bullet: racer.bullet.visible,
  };
}

function apply(racer, s) {
  Object.assign(racer, { x: s.x, y: s.y, z: s.z, heading: s.heading, index: s.index });
  const o = racer.object;
  o.position.set(s.x, s.y, s.z);
  o.rotation.set(s.rx, s.ry, s.rz);
  o.scale.setScalar(s.scale);
  o.visible = s.visible;
  racer.flame.visible = s.flame;
  racer.shield.visible = s.shield;
  racer.wing.visible = s.wing;
  racer.starGlow.visible = s.star;
  racer.bullet.visible = s.bullet;
  for (const spark of racer.sparks) spark.visible = false;
}
