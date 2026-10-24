import * as THREE from 'three';
import { sfx } from '../../shared/sound.js';

// Pistas vivas: cosas de la pista que se mueven solas (`living` en tracks.js: [{ kind, at }], at = de 0 a 1 de la vuelta).
//   train:   un tren cruza el camino cada rato. Antes bajan las plumas y parpadean los focos rojos; si te alcanza das
//            vueltas.
//   gates:   dos plumas (como de estacionamiento), una de cada lado del camino, que se turnan para bajar: la que está
//            abajo te frena en seco y te rebota; siempre queda un lado libre.
//   cannons: un cañón de agua a un lado del camino echa un chorro cada rato que empuja de lado a los karts.
//   bridge:  un puente levadizo: se levanta un rato y subido es una rampa que te avienta por el aire.
// Todo avisa antes (focos, temblorcito o el puente subiendo) para que dé tiempo de esquivarlo.
const TRAIN = { everyMs: 15000, warnMs: 2600, speed: 34, cars: 3, carLength: 11, width: 5, height: 5.5, reach: 2.6, colors: [0xe53935, 0x3fa7ff, 0xffc93c] };
const GATES = { swapMs: 3200, moveMs: 500, thickness: 1.2, bounce: 7 };
const CANNON = { everyMs: 5200, warnMs: 700, sprayMs: 1900, push: 14, reach: 3.2, slow: 0.985 };
const BRIDGE = { flatMs: 3600, moveMs: 900, upMs: 2600, length: 12, angle: 0.36, launch: 0.42, minSpeed: 10 };
const BLINK_MS = 260;

export class LivingTrack {
  // `onHit(racer, text)`: le pegó algo (el juego hace que dé vueltas y avisa).
  constructor(scene, track, list, { onHit }) {
    this.scene = scene;
    this.track = track;
    this.onHit = onHit;
    this.owned = [];
    this.timeMs = 0;
    this.items = list.map((item, i) => this.build(item, i));
  }

  own(thing) {
    this.owned.push(thing);
    return thing;
  }

  // Dónde está algo en la pista: su centro, hacia dónde va el camino (t) y hacia la derecha del grupo (side, su x local).
  frame(at) {
    const track = this.track;
    const index = Math.round(at * track.count) % track.count;
    const p = track.points[index];
    const t = track.tangents[index];
    const n = track.normals[index];
    return { index, x: p.x, z: p.z, y: track.roadHeight(p.x, p.z, index), t: { x: t.x, z: t.z }, side: { x: -n.x, z: -n.z }, heading: Math.atan2(t.x, t.z) };
  }

  // Un grupo puesto en ese lugar de la pista: su x local va hacia un lado del camino y su z hacia adelante.
  group(f) {
    const group = new THREE.Group();
    group.position.set(f.x, f.y, f.z);
    group.rotation.y = f.heading;
    this.scene.add(group);
    this.owned.push({ dispose: () => this.scene.remove(group) });
    return group;
  }

  mesh(geometry, color, options = {}) {
    const material = this.own(new THREE.MeshLambertMaterial({ color, ...options }));
    return new THREE.Mesh(this.own(geometry), material);
  }

  build(item, i) {
    const f = this.frame(item.at);
    const offset = (i * 2300) % 9000;
    if (item.kind === 'train') return this.buildTrain(f, offset);
    if (item.kind === 'gates') return this.buildGates(f, offset);
    if (item.kind === 'cannons') return this.buildCannon(f, offset, item.side ?? (i % 2 ? -1 : 1));
    return this.buildBridge(f, offset);
  }

  // Las vías (de lado a lado), los postes con focos y plumas a cada lado y el tren de colores.
  buildTrain(f, offset) {
    const g = this.group(f);
    const span = this.track.wallDistance + 40;
    for (const z of [-1.2, 1.2]) {
      const rail = this.mesh(new THREE.BoxGeometry(span * 2, 0.25, 0.3), 0x8a8a96);
      rail.position.set(0, 0.15, z);
      g.add(rail);
    }
    const sleepers = new THREE.InstancedMesh(
      this.own(new THREE.BoxGeometry(1, 0.15, 3.6)),
      this.own(new THREE.MeshLambertMaterial({ color: 0x6a4a2a })),
      Math.floor(span),
    );
    const dummy = new THREE.Object3D();
    for (let k = 0; k < sleepers.count; k += 1) {
      dummy.position.set(-span + k * 2, 0.06, 0);
      dummy.updateMatrix();
      sleepers.setMatrixAt(k, dummy.matrix);
    }
    g.add(sleepers);
    const lights = [];
    const booms = [];
    for (const side of [-1, 1]) {
      const post = this.mesh(new THREE.CylinderGeometry(0.25, 0.25, 5, 8), 0xffffff);
      post.position.set(side * (this.track.wallDistance + 1.5), 2.5, side * -4);
      g.add(post);
      const light = this.mesh(new THREE.SphereGeometry(0.6, 10, 8), 0x551111, { emissive: 0x000000 });
      light.position.set(side * (this.track.wallDistance + 1.5), 5.2, side * -4);
      g.add(light);
      lights.push(light);
      // La pluma: gira desde el poste; abajo tapa la mitad del camino.
      const pivot = new THREE.Group();
      pivot.position.set(side * (this.track.wallDistance + 1.5), 3, side * -4);
      const boom = this.mesh(new THREE.BoxGeometry(this.track.wallDistance + 1, 0.35, 0.35), 0xffffff);
      boom.position.x = (-side * (this.track.wallDistance + 1)) / 2;
      pivot.add(boom);
      g.add(pivot);
      booms.push({ pivot, side });
    }
    const train = new THREE.Group();
    for (let k = 0; k < TRAIN.cars; k += 1) {
      const car = this.mesh(
        new THREE.BoxGeometry(TRAIN.carLength - 0.6, TRAIN.height, TRAIN.width),
        k === 0 ? 0x2a2a36 : TRAIN.colors[k % TRAIN.colors.length],
      );
      car.position.set(-k * TRAIN.carLength, TRAIN.height / 2 + 0.8, 0);
      train.add(car);
      for (const wx of [-3, 3]) {
        for (const wz of [-2.4, 2.4]) {
          const wheel = this.mesh(new THREE.CylinderGeometry(0.8, 0.8, 0.4, 12), 0x1b1530);
          wheel.rotation.x = Math.PI / 2;
          wheel.position.set(-k * TRAIN.carLength + wx, 0.8, wz);
          train.add(wheel);
        }
      }
    }
    // La locomotora: chimenea y ojos.
    const chimney = this.mesh(new THREE.CylinderGeometry(0.9, 0.7, 2.4, 10), 0x2a2a36);
    chimney.position.set(2.5, TRAIN.height + 1.8, 0);
    const front = this.mesh(new THREE.CircleGeometry(1.6, 16), 0xffe066, { emissive: 0x8a7a00 });
    front.position.set(TRAIN.carLength / 2 - 0.25, TRAIN.height / 2 + 1.4, 0);
    front.rotation.y = Math.PI / 2;
    train.add(chimney, front);
    train.visible = false;
    g.add(train);
    return { kind: 'train', f, g, lights, booms, train, span, offset, length: TRAIN.cars * TRAIN.carLength, warned: false };
  }

  updateTrain(item, dtMs, racers) {
    const cycle = (this.timeMs + item.offset) % TRAIN.everyMs;
    const travelMs = ((item.span * 2 + item.length) / TRAIN.speed) * 1000;
    const warning = cycle < TRAIN.warnMs + travelMs;
    const passing = cycle >= TRAIN.warnMs && cycle < TRAIN.warnMs + travelMs;
    const blink = warning && Math.floor(cycle / BLINK_MS) % 2 === 0;
    item.lights.forEach((light, k) => {
      const on = blink === (k === 0);
      light.material.color.setHex(warning && on ? 0xff2a2a : 0x551111);
      light.material.emissive.setHex(warning && on ? 0xaa0000 : 0x000000);
    });
    // Las plumas bajan con el aviso y suben cuando ya pasó.
    const down = warning ? Math.min(1, cycle / 600) : 0;
    for (const { pivot, side } of item.booms) pivot.rotation.z = -side * (1 - down) * 1.35;
    if (warning && !item.warned) {
      item.warned = true;
      if (this.near(item.f, racers, 70)) sfx.laser();
    }
    if (!warning) item.warned = false;
    item.train.visible = passing;
    if (!passing) return;
    // El tren va de un lado al otro (x local); pega si alguien está en las vías a su paso.
    const head = -item.span + ((cycle - TRAIN.warnMs) / 1000) * TRAIN.speed;
    item.train.position.x = head;
    for (const racer of racers) {
      const { along, side } = this.local(item.f, racer);
      if (Math.abs(along) > TRAIN.width / 2 + TRAIN.reach * 0.6) continue;
      if (side > head + TRAIN.carLength / 2 + TRAIN.reach || side < head - item.length + TRAIN.carLength / 2 - TRAIN.reach) continue;
      if (racer.livingHitMs > 0) continue;
      racer.livingHitMs = 1500;
      racer.speed *= 0.3;
      this.onHit(racer, '¡Te alcanzó el tren! 🚂');
    }
  }

  // Dos plumas, una de cada lado; se turnan para bajar.
  buildGates(f, offset) {
    const g = this.group(f);
    const half = this.track.wallDistance;
    const booms = [-1, 1].map((side) => {
      const post = this.mesh(new THREE.BoxGeometry(1.2, 3.4, 1.2), 0xffd02a);
      post.position.set(side * (half + 0.8), 1.7, 0);
      g.add(post);
      const pivot = new THREE.Group();
      pivot.position.set(side * (half + 0.8), 2.4, 0);
      // Rayas rojas y blancas.
      for (let k = 0; k < 6; k += 1) {
        const stripe = this.mesh(new THREE.BoxGeometry(half / 6, 0.6, 0.5), k % 2 ? 0xffffff : 0xe53935);
        stripe.position.x = -side * (half / 12 + (k * half) / 6);
        pivot.add(stripe);
      }
      g.add(pivot);
      return { pivot, side, down: 0 };
    });
    return { kind: 'gates', f, g, booms, offset };
  }

  updateGates(item, dtMs, racers) {
    const t = (this.timeMs + item.offset) % (GATES.swapMs * 2);
    // Primero baja la de la izquierda, luego la de la derecha (con su ratito de movimiento).
    const leftDown = t < GATES.swapMs;
    const sinceSwap = t % GATES.swapMs;
    const move = Math.min(1, sinceSwap / GATES.moveMs);
    for (const boom of item.booms) {
      const wantsDown = boom.side < 0 === leftDown;
      boom.down = wantsDown ? move : 1 - move;
      boom.pivot.rotation.z = -boom.side * (1 - boom.down) * 1.4;
    }
    for (const racer of racers) {
      if (racer.y > racer.floor + 1.5) continue;
      const { along, side } = this.local(item.f, racer);
      if (Math.abs(along) > GATES.thickness + 0.8) continue;
      const boom = item.booms.find((b) => Math.sign(side || 1) === b.side);
      if (!boom || boom.down < 0.7) continue;
      // Rebota para atrás (según de qué lado venía).
      const dir = Math.sign(along) || -1;
      racer.x += item.f.t.x * dir * 1.5;
      racer.z += item.f.t.z * dir * 1.5;
      if (Math.abs(racer.speed) > 4) {
        racer.speed = -Math.sign(racer.speed) * GATES.bounce;
        if (!racer.isCpu) {
          sfx.block();
          racer.say('¡Pum! Pasa por el otro lado 🚧', 1200);
        }
      }
    }
  }

  // Un cañón de agua a un lado (`side`), apuntando al otro lado del camino, y su chorro.
  buildCannon(f, offset, side) {
    const g = this.group(f);
    const x = side * (this.track.wallDistance + 3);
    const base = this.mesh(new THREE.CylinderGeometry(1.6, 2, 1.6, 12), 0x6a4a2a);
    base.position.set(x, 0.8, 0);
    const barrel = this.mesh(new THREE.CylinderGeometry(0.8, 1.1, 4, 12), 0x3a3a44);
    barrel.rotation.z = (side * Math.PI) / 2;
    barrel.position.set(x - side * 1.2, 2.2, 0);
    const jetMaterial = this.own(new THREE.MeshLambertMaterial({ color: 0x7fd4ff, transparent: true, opacity: 0.7, emissive: 0x1f5a8a }));
    const jet = new THREE.Mesh(this.own(new THREE.CylinderGeometry(1.4, 0.9, this.track.wallDistance * 2, 12, 1, true)), jetMaterial);
    jet.rotation.z = Math.PI / 2;
    jet.position.set(0, 2, 0);
    jet.visible = false;
    g.add(base, barrel, jet);
    return { kind: 'cannons', f, g, side, barrel, jet, offset };
  }

  updateCannon(item, dtMs, racers) {
    const cycle = (this.timeMs + item.offset) % CANNON.everyMs;
    const warn = cycle < CANNON.warnMs;
    const spraying = cycle >= CANNON.warnMs && cycle < CANNON.warnMs + CANNON.sprayMs;
    // Antes de echar agua tiembla.
    item.barrel.position.y = 2.2 + (warn ? Math.sin(cycle / 25) * 0.2 : 0);
    item.jet.visible = spraying;
    if (spraying) {
      item.jet.scale.set(1 + Math.sin(cycle / 40) * 0.12, 1, 1 + Math.sin(cycle / 40) * 0.12);
      if (!item.splashed) {
        item.splashed = true;
        if (this.near(item.f, racers, 60)) sfx.boing();
      }
    } else {
      item.splashed = false;
    }
    if (!spraying) return;
    const dt = dtMs / 1000;
    for (const racer of racers) {
      if (racer.y > racer.floor + 3) continue;
      const { along } = this.local(item.f, racer);
      if (Math.abs(along) > CANNON.reach) continue;
      // Lo empuja hacia el lado contrario del cañón.
      racer.x -= item.f.side.x * item.side * CANNON.push * dt;
      racer.z -= item.f.side.z * item.side * CANNON.push * dt;
      racer.speed *= CANNON.slow;
      if (!racer.isCpu && !racer.splashedAt) {
        racer.splashedAt = true;
        racer.say('¡Splash! 💦', 900);
      }
      racer.wetMs = 400;
    }
    for (const racer of racers) if ((racer.wetMs = Math.max(0, (racer.wetMs ?? 0) - dtMs)) === 0) racer.splashedAt = false;
  }

  // El puente levadizo: una tabla que gira desde su orilla de atrás.
  buildBridge(f, offset) {
    const g = this.group(f);
    const width = this.track.roadWidth * 1.3;
    const pivot = new THREE.Group();
    pivot.position.set(0, 0.05, -BRIDGE.length / 2);
    const deck = this.mesh(new THREE.BoxGeometry(width, 0.5, BRIDGE.length), 0x9a6a44);
    deck.position.set(0, 0, BRIDGE.length / 2);
    pivot.add(deck);
    for (let k = 1; k < 6; k += 1) {
      const plank = this.mesh(new THREE.BoxGeometry(width + 0.2, 0.55, 0.25), 0x6a4a2a);
      plank.position.set(0, 0, (k * BRIDGE.length) / 6);
      pivot.add(plank);
    }
    // Las cadenas: de los postes a la punta del puente.
    const posts = [-1, 1].map((side) => {
      const post = this.mesh(new THREE.BoxGeometry(1.4, 9, 1.4), 0x8a8a96);
      post.position.set(side * (width / 2 + 1), 4.5, -BRIDGE.length / 2);
      g.add(post);
      const chain = this.mesh(new THREE.CylinderGeometry(0.15, 0.15, 1, 6), 0x2a2a36);
      g.add(chain);
      return { side, chain };
    });
    g.add(pivot);
    return { kind: 'bridge', f, g, pivot, posts, width, offset, angle: 0 };
  }

  updateBridge(item, dtMs, racers) {
    const total = BRIDGE.flatMs + BRIDGE.moveMs * 2 + BRIDGE.upMs;
    const t = (this.timeMs + item.offset) % total;
    let lift = 0;
    if (t >= BRIDGE.flatMs && t < BRIDGE.flatMs + BRIDGE.moveMs) lift = (t - BRIDGE.flatMs) / BRIDGE.moveMs;
    else if (t >= BRIDGE.flatMs + BRIDGE.moveMs && t < BRIDGE.flatMs + BRIDGE.moveMs + BRIDGE.upMs) lift = 1;
    else if (t >= BRIDGE.flatMs + BRIDGE.moveMs + BRIDGE.upMs) lift = 1 - (t - BRIDGE.flatMs - BRIDGE.moveMs - BRIDGE.upMs) / BRIDGE.moveMs;
    item.angle = lift * BRIDGE.angle;
    item.pivot.rotation.x = -item.angle;
    // Las cadenas, de lo alto de los postes a la punta.
    const tipY = Math.sin(item.angle) * BRIDGE.length;
    const tipZ = -BRIDGE.length / 2 + Math.cos(item.angle) * BRIDGE.length;
    for (const { side, chain } of item.posts) {
      const from = new THREE.Vector3(side * (item.width / 2 + 1), 8.5, -BRIDGE.length / 2);
      const to = new THREE.Vector3(side * (item.width / 2), tipY + 0.3, tipZ);
      chain.position.copy(from).add(to).multiplyScalar(0.5);
      chain.scale.y = from.distanceTo(to);
      chain.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), to.clone().sub(from).normalize());
    }
    // Subido es rampa: el piso sube por la tabla y al terminarse sale volando.
    const slope = Math.tan(item.angle);
    for (const racer of racers) {
      if (racer.shortcut) continue;
      const { along, side } = this.local(item.f, racer);
      const on = Math.abs(side) < item.width / 2 && along > -BRIDGE.length / 2 && along < BRIDGE.length / 2;
      const was = racer.bridge === item;
      if (on) {
        const height = (along + BRIDGE.length / 2) * slope;
        racer.floor += height;
        racer.bridge = item;
        racer.bridgeHeight = height;
      } else if (was) {
        racer.bridge = null;
        if (
          racer.bridgeHeight > 1.2 &&
          racer.speed > BRIDGE.minSpeed &&
          along >= BRIDGE.length / 2 &&
          racer.y >= racer.floor - 0.05 + racer.bridgeHeight * 0.5
        ) {
          racer.y = racer.floor + racer.bridgeHeight;
          racer.launch(racer.speed * BRIDGE.launch);
          if (!racer.isCpu) racer.say('¡Puente levadizo! 🌉', 1100);
        }
        racer.bridgeHeight = 0;
      }
    }
  }

  // Dónde está un kart respecto a algo: adelante/atrás (along) y de lado (side).
  local(f, racer) {
    const dx = racer.x - f.x;
    const dz = racer.z - f.z;
    return { along: dx * f.t.x + dz * f.t.z, side: dx * f.side.x + dz * f.side.z };
  }

  // Para la compu: el carril (lateral de la pista) por donde pasar las plumas que tiene adelante, o null.
  cpuLane(racer) {
    for (const item of this.items) {
      if (item.kind !== 'gates') continue;
      const { along } = this.local(item.f, racer);
      if (along > 0 || along < -45) continue;
      const open = item.booms.reduce((a, b) => (a.down <= b.down ? a : b));
      // (El lado del grupo es al revés del lateral de la pista.)
      return -open.side * (this.track.roadWidth / 4);
    }
    return null;
  }

  near(f, racers, distance) {
    return racers.some((racer) => !racer.isCpu && Math.hypot(racer.x - f.x, racer.z - f.z) < distance);
  }

  // Cada cuadro, después de que las rampas pusieron el piso de cada kart.
  update(dtMs, racers) {
    this.timeMs += dtMs;
    for (const racer of racers) racer.livingHitMs = Math.max(0, (racer.livingHitMs ?? 0) - dtMs);
    for (const item of this.items) {
      if (item.kind === 'train') this.updateTrain(item, dtMs, racers);
      else if (item.kind === 'gates') this.updateGates(item, dtMs, racers);
      else if (item.kind === 'cannons') this.updateCannon(item, dtMs, racers);
      else this.updateBridge(item, dtMs, racers);
    }
  }

  dispose() {
    for (const thing of this.owned) thing.dispose?.();
    this.owned = [];
  }
}
