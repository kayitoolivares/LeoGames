import * as THREE from 'three';
import { sfx } from '../../shared/sound.js';
import { HEIGHT, WIDTH } from '../three/stage.js';
import { Particles } from './particles.js';

// La premiación: los 3 primeros suben con su kart al podio (oro, plata y bronce), con confeti y fuegos
// artificiales, el paisaje de la pista atrás y la cámara dando vueltas despacio. El ganador brinca festejando
// y, en el Gran Premio, arriba de él flota la copa. Se ve en toda la pantalla (aunque jueguen varios).
const STEPS = [
  { place: 1, x: 0, height: 3.2, color: 0xffc93c },
  { place: 2, x: -6, height: 2.3, color: 0xd6dcea },
  { place: 3, x: 6, height: 1.6, color: 0xe0975a },
];
const STEP_SIZE = 5.4;
const CONFETTI = [0xff5a5f, 0xffc93c, 0x4cd97b, 0x3fa7ff, 0xb07cff, 0xffffff];
const FIREWORK_MS = 700;
const ORBIT = { radius: 21, height: 7.5, speed: 0.00018, swing: 0.5 };

export class Ceremony {
  // `podium`: los karts del 1° al 3° (Racer). `trophy`: imagen de la copa (o null). `scenery`: cosas de la pista
  // que también se ven atrás (el paisaje y el piso), se comparten sin copiarlas. `floor`: qué tan alto está el piso
  // donde va el podio (si la pista tiene lomas ahí, el paisaje se baja para que el podio no quede enterrado).
  constructor(podium, { background, scenery = [], trophy = null, floor = 0 }) {
    this.scene = new THREE.Scene();
    this.scene.background = background;
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x6a6a7a, 1.3));
    const sun = new THREE.DirectionalLight(0xffffff, 1.5);
    sun.position.set(10, 30, 20);
    this.scene.add(sun);
    // Copias que comparten figura y material (no gastan memoria): el paisaje y el piso de la pista.
    for (const mesh of scenery) {
      const copy = mesh.clone();
      copy.position.y -= floor;
      this.scene.add(copy);
    }
    this.owned = [];
    this.podium = podium;
    this.homes = podium.map((racer) => racer.object.parent);
    STEPS.forEach((step, i) => {
      const block = this.own(new THREE.Mesh(new THREE.BoxGeometry(STEP_SIZE, step.height, STEP_SIZE), new THREE.MeshLambertMaterial({ color: step.color })));
      block.position.set(step.x, step.height / 2, 0);
      this.scene.add(block);
      const number = this.own(new THREE.Mesh(new THREE.PlaneGeometry(1.8, 1.8), new THREE.MeshBasicMaterial({ map: numberTexture(step.place), transparent: true })));
      number.position.set(step.x, step.height / 2, STEP_SIZE / 2 + 0.02);
      this.scene.add(number);
      const racer = podium[i];
      if (!racer) return;
      this.scene.add(racer.object);
      racer.object.position.set(step.x, step.height, 0);
      racer.object.rotation.set(0, 0, 0);
      racer.object.scale.setScalar(1);
    });
    if (trophy) {
      const map = new THREE.TextureLoader().load(trophy);
      map.colorSpace = THREE.SRGBColorSpace;
      this.cup = this.own(new THREE.Sprite(new THREE.SpriteMaterial({ map, alphaTest: 0.3 })));
      this.cup.scale.set(3.2, 3.2, 1);
      this.scene.add(this.cup);
    }
    this.particles = new Particles(this.scene);
    this.camera = new THREE.PerspectiveCamera(45, WIDTH / HEIGHT, 0.5, 900);
    this.time = 0;
    this.fireworkMs = 0;
    sfx.win();
  }

  own(object) {
    this.owned.push(object);
    return object;
  }

  update(dtMs) {
    this.time += dtMs;
    // Los karts en su lugar viendo a la cámara; el primero brinca.
    this.podium.forEach((racer, i) => {
      const step = STEPS[i];
      const hop = i === 0 ? Math.abs(Math.sin(this.time / 220)) * 0.9 : 0;
      racer.object.position.set(step.x, step.height + hop, 0);
      racer.object.rotation.set(0, 0, 0);
      racer.object.scale.setScalar(1);
      racer.driver.show({ pose: 'gana', flip: false });
    });
    if (this.cup) this.cup.position.set(STEPS[0].x, STEPS[0].height + 6 + Math.sin(this.time / 300) * 0.3, 0);
    // Confeti cayendo todo el tiempo y fuegos artificiales de vez en cuando.
    for (let k = 0; k < 3; k += 1) {
      this.particles.emit('confetti', (Math.random() - 0.5) * 30, 16 + Math.random() * 4, (Math.random() - 0.5) * 14, (Math.random() - 0.5) * 2, -1, (Math.random() - 0.5) * 2, CONFETTI[Math.floor(Math.random() * CONFETTI.length)], 4000);
    }
    this.fireworkMs -= dtMs;
    if (this.fireworkMs <= 0) {
      this.fireworkMs = FIREWORK_MS;
      const color = CONFETTI[Math.floor(Math.random() * CONFETTI.length)];
      this.particles.burst('spark', (Math.random() - 0.5) * 34, 14 + Math.random() * 6, -8 - Math.random() * 6, 22, [color, 0xffffff], { speed: 9, up: 3, lifeMs: 900 });
      sfx.poof();
    }
    this.particles.update(dtMs);
    // La cámara da vueltas despacito frente al podio.
    const angle = Math.sin(this.time * ORBIT.speed * Math.PI * 2) * ORBIT.swing;
    this.camera.position.set(Math.sin(angle) * ORBIT.radius, ORBIT.height, Math.cos(angle) * ORBIT.radius);
    this.camera.lookAt(0, 3.5, 0);
  }

  render(renderer) {
    renderer.setScissorTest(false);
    renderer.setViewport(0, 0, WIDTH, HEIGHT);
    renderer.render(this.scene, this.camera);
  }

  // Los karts regresan a la pista; lo que era solo de la premiación se libera.
  dispose() {
    this.podium.forEach((racer, i) => this.homes[i]?.add(racer.object));
    for (const object of this.owned) {
      object.geometry?.dispose();
      object.material.map?.dispose();
      object.material.dispose();
    }
    this.particles.dispose();
  }
}

function numberTexture(place) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#1b1530';
  ctx.font = 'bold 110px "Segoe UI", Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(place), 64, 70);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
