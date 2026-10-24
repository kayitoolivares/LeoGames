import * as THREE from 'three';
import dueloArt from '../duelo/art.json';
import manifest from './art.json';

// El público y la tele de Karts locos: gradas con aficionados (los del Duelo) junto a la meta que brincan y echan
// porras (más cuando pasa alguien o cruza la meta), el helicóptero de la tele que sigue al que va primero, un
// dirigible que le da vueltas a la pista, globos aerostáticos a lo lejos y un camarógrafo en la meta.
// Todo son dibujos de Gemini que siempre ven a la cámara (si falta alguno, no se pone). Pocas piezas: las gradas son
// un solo InstancedMesh y los aficionados comparten material por dibujo.
const STANDS = { from: 22, to: 4, gap: 6, rows: 3, step: 1.6, depth: 2.2, fanSize: 2.6, fanEvery: 3 };
const HELI = { size: 9, height: 26, orbit: 26, speed: 0.6, follow: 1.6 };
const BLIMP = { size: 26, height: 62, speed: 0.08 };
const BALLOONS = { count: 3, size: 12, height: [34, 48] };
const CHEER = { bounce: 0.35, big: 1.3, near: 30 };

export class Crowd {
  constructor(scene, track) {
    this.scene = scene;
    this.track = track;
    this.owned = [];
    this.materials = new Map();
    this.fans = [];
    this.cheerMs = 0;
    this.time = 0;
    this.loader = new THREE.TextureLoader();
    this.addStands();
    this.heli = this.sprite(`kart/extras/helicoptero.png`, manifest.extras?.includes('helicoptero'), HELI.size);
    this.blimp = this.sprite(`kart/extras/dirigible.png`, manifest.extras?.includes('dirigible'), BLIMP.size);
    const far = Math.max(...track.points.map((p) => Math.hypot(p.x, p.z)));
    this.radius = far;
    this.balloons = [];
    for (let i = 0; i < BALLOONS.count; i += 1) {
      const balloon = this.sprite('kart/extras/globo.png', manifest.extras?.includes('globo'), BALLOONS.size);
      if (!balloon) break;
      const a = (i / BALLOONS.count) * Math.PI * 2 + 0.7;
      const r = far + 60 + i * 25;
      const y = BALLOONS.height[0] + ((BALLOONS.height[1] - BALLOONS.height[0]) * i) / BALLOONS.count;
      balloon.position.set(Math.cos(a) * r, y, Math.sin(a) * r);
      this.balloons.push({ balloon, y, phase: i * 2 });
    }
    // El camarógrafo, a un lado de la meta.
    const cameraman = this.sprite('kart/extras/camarografo.png', manifest.extras?.includes('camarografo'), 3.2, 0);
    if (cameraman) {
      const spot = track.pointAt(4, -(track.wallDistance + 2.5));
      cameraman.position.set(spot.x, track.groundHeight(spot.x, spot.z), spot.z);
    }
  }

  // Un dibujo que ve a la cámara (si `exists`); los que usan la misma imagen comparten material. Su ancho sale de
  // la imagen al llegar.
  sprite(url, exists, size, center = 0.5) {
    if (!exists) return null;
    let entry = this.materials.get(url);
    if (!entry) {
      const material = new THREE.SpriteMaterial({ depthWrite: false, transparent: true });
      entry = { material, sprites: [], aspect: null };
      this.materials.set(url, entry);
      this.owned.push(material);
      this.loader.load(url, (texture) => {
        texture.colorSpace = THREE.SRGBColorSpace;
        material.map = texture;
        material.needsUpdate = true;
        this.owned.push(texture);
        entry.aspect = texture.image.width / texture.image.height;
        for (const [sprite, h] of entry.sprites) sprite.scale.set(h * entry.aspect, h, 1);
      });
    }
    const sprite = new THREE.Sprite(entry.material);
    sprite.center.set(0.5, center);
    sprite.scale.set(size * (entry.aspect ?? 1), size, 1);
    entry.sprites.push([sprite, size]);
    this.scene.add(sprite);
    this.owned.push({ dispose: () => this.scene.remove(sprite) });
    return sprite;
  }

  // Dos gradas (tres escalones) junto a la recta de la meta, con aficionados.
  addStands() {
    const track = this.track;
    const n = track.count;
    const fans = dueloArt.publico ?? [];
    const steps = [];
    for (const side of [-1, 1]) {
      for (let row = 0; row < STANDS.rows; row += 1) {
        const lateral = side * (track.wallDistance + STANDS.gap + row * STANDS.depth);
        for (let i = n - STANDS.from; i < n - STANDS.to; i += 1) {
          const spot = track.pointAt(i, lateral);
          if (track.blocked?.(spot.x, spot.z)) continue;
          const ground = track.groundHeight(spot.x, spot.z);
          steps.push({ ...spot, ground, height: (row + 1) * STANDS.step });
          // Un aficionado cada tantito, parado en su escalón.
          if (!fans.length || (i + row * 2) % STANDS.fanEvery !== 0) continue;
          const name = fans[(i * 7 + row * 3 + (side > 0 ? 1 : 0)) % fans.length];
          const fan = this.sprite(`duelo/publico/${name}.png`, true, STANDS.fanSize, 0);
          const base = ground + (row + 1) * STANDS.step;
          fan.position.set(spot.x, base, spot.z);
          this.fans.push({ fan, base, phase: Math.random() * 6, speed: 5 + Math.random() * 3 });
        }
      }
    }
    if (!steps.length) return;
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const material = new THREE.MeshLambertMaterial({ color: 0x8a86b8 });
    const mesh = new THREE.InstancedMesh(geometry, material, steps.length);
    const dummy = new THREE.Object3D();
    steps.forEach((s, k) => {
      dummy.position.set(s.x, s.ground + s.height / 2, s.z);
      dummy.rotation.set(0, s.heading, 0);
      dummy.scale.set(STANDS.depth, s.height, track.spacing + 0.05);
      dummy.updateMatrix();
      mesh.setMatrixAt(k, dummy.matrix);
    });
    this.scene.add(mesh);
    this.owned.push(geometry, material, { dispose: () => this.scene.remove(mesh) });
  }

  // ¡Porras! (alguien cruzó la meta o rebasó al primero).
  cheer(ms = 2000) {
    this.cheerMs = Math.max(this.cheerMs, ms);
  }

  // `leader`: el que va primero (el helicóptero lo sigue).
  update(dtMs, racers, leader) {
    const dt = dtMs / 1000;
    this.time += dt;
    this.cheerMs = Math.max(0, this.cheerMs - dtMs);
    const start = this.track.points[0];
    const near = racers.some((r) => Math.hypot(r.x - start.x, r.z - start.z) < CHEER.near);
    const jump = this.cheerMs > 0 ? CHEER.big : near ? CHEER.bounce * 2 : CHEER.bounce;
    for (const f of this.fans) f.fan.position.y = f.base + Math.abs(Math.sin(this.time * f.speed + f.phase)) * jump;
    if (this.heli && leader) {
      const a = this.time * HELI.speed;
      const goal = new THREE.Vector3(
        leader.x + Math.cos(a) * HELI.orbit,
        (leader.y ?? 0) + HELI.height + Math.sin(this.time * 2) * 1.2,
        leader.z + Math.sin(a) * HELI.orbit,
      );
      if (this.heli.position.lengthSq() < 1) this.heli.position.copy(goal);
      else this.heli.position.lerp(goal, Math.min(1, dt * HELI.follow));
    }
    if (this.blimp) {
      const a = this.time * BLIMP.speed;
      const r = this.radius * 0.8;
      this.blimp.position.set(Math.cos(a) * r, BLIMP.height + Math.sin(this.time * 0.5) * 2, Math.sin(a) * r);
    }
    for (const b of this.balloons) b.balloon.position.y = b.y + Math.sin(this.time * 0.4 + b.phase) * 3;
  }

  dispose() {
    for (const thing of this.owned) thing.dispose?.();
    this.owned = [];
  }
}
