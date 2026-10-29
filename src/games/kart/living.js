import * as THREE from 'three';
import { sfx } from '../../shared/sound.js';

// Pistas vivas: cosas de la pista que se mueven solas (`living` en tracks.js: [{ kind, at }], at = de 0 a 1 de la vuelta).
//   train:   un tren cruza el camino cada rato. Antes bajan las plumas y parpadean los focos rojos; si te alcanza das
//            vueltas.
//   gates:   dos plumas (como de estacionamiento), una de cada lado del camino, que se turnan para bajar: la que está
//            abajo te frena en seco y te rebota; siempre queda un lado libre.
//   cannons: un cañón de agua a un lado del camino echa un chorro cada rato que empuja de lado a los karts.
//   bridge:  un puente levadizo: se levanta un rato y subido es una rampa que te avienta por el aire.
//   tractor: (Granja) un tractor con su remolque de paja cruza el camino despacito, como el tren pero sin vías.
//   minecart: (Mina) carritos de la mina con cristales cruzan por sus vías.
//   carousel: (Feria) un carrusel de colores en el camino que da vueltas y gira a los karts que pasan encima.
//   sprinkler: (Jardín) un aspersor a un lado del camino: como el cañón de agua, el chorro te empuja de lado.
// Todo avisa antes (focos, temblorcito o el puente subiendo) para que dé tiempo de esquivarlo.
const TRAIN = { everyMs: 15000, warnMs: 2600, speed: 34, cars: 3, carLength: 11, width: 5, height: 5.5, reach: 2.6, colors: [0xe53935, 0x3fa7ff, 0xffc93c] };
const TRACTOR = { everyMs: 14000, warnMs: 2200, speed: 15, cars: 2, carLength: 9, width: 4.6, height: 4.5, reach: 2.4 };
const MINECART = { everyMs: 12000, warnMs: 2000, speed: 24, cars: 4, carLength: 6.5, width: 4, height: 3, reach: 2.2 };
// El carrusel: qué tan rápido gira (radianes por segundo) y cada cuánto cambia de sentido.
const CAROUSEL = { speed: 0.7, flipMs: 7000, colors: ['#ff5a5f', '#ffd02a', '#4cd97b', '#3fa7ff', '#b07cff', '#ff8a1e'] };
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
    if (item.kind === 'tractor') return this.buildTractor(f, offset);
    if (item.kind === 'minecart') return this.buildMinecart(f, offset);
    if (item.kind === 'carousel') return this.buildCarousel(f, offset);
    if (item.kind === 'gates') return this.buildGates(f, offset);
    if (item.kind === 'cannons' || item.kind === 'sprinkler') return this.buildCannon(f, offset, item.side ?? (i % 2 ? -1 : 1), item.kind);
    return this.buildBridge(f, offset);
  }

  // Vías de lado a lado (rieles y durmientes), `span` para cada lado.
  addRails(g, span, color = 0x8a8a96) {
    for (const z of [-1.2, 1.2]) {
      const rail = this.mesh(new THREE.BoxGeometry(span * 2, 0.25, 0.3), color);
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
  }

  // Ruedas (de lado) para algo que va hacia x: `spots` [[x, z, radio], ...].
  addWheels(group, spots, color = 0x1b1530) {
    for (const [x, z, r] of spots) {
      const wheel = this.mesh(new THREE.CylinderGeometry(r, r, 0.5, 14), color);
      wheel.rotation.x = Math.PI / 2;
      wheel.position.set(x, r, z);
      group.add(wheel);
    }
  }

  // Las vías (de lado a lado), los postes con focos y plumas a cada lado y el tren de colores.
  buildTrain(f, offset) {
    const g = this.group(f);
    const span = this.track.wallDistance + 40;
    this.addRails(g, span);
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
    return {
      kind: 'train',
      spec: TRAIN,
      ouch: '¡Te alcanzó el tren! 🚂',
      f,
      g,
      lights,
      booms,
      train,
      span,
      offset,
      length: TRAIN.cars * TRAIN.carLength,
      warned: false,
    };
  }

  // Dos postes con foco amarillo (sin plumas) a cada lado, para avisar que algo va a cruzar.
  addWarningLights(g, color = 0xffffff) {
    return [-1, 1].map((side) => {
      const x = side * (this.track.wallDistance + 1.5);
      const post = this.mesh(new THREE.CylinderGeometry(0.25, 0.25, 4.4, 8), color);
      post.position.set(x, 2.2, side * -4);
      const light = this.mesh(new THREE.SphereGeometry(0.6, 10, 8), 0x551111, { emissive: 0x000000 });
      light.position.set(x, 4.6, side * -4);
      g.add(post, light);
      return light;
    });
  }

  // El tractor (rojo, con llantotas atrás) jalando un remolque con pacas de paja, por un caminito de tierra.
  buildTractor(f, offset) {
    const g = this.group(f);
    const span = this.track.wallDistance + 30;
    const dirt = this.mesh(new THREE.BoxGeometry(span * 2, 0.08, 6), 0x8a5a3a);
    dirt.position.y = 0.04;
    g.add(dirt);
    const lights = this.addWarningLights(g, 0xffd02a);
    const tractor = new THREE.Group();
    const body = this.mesh(new THREE.BoxGeometry(5, 2.4, 3), 0xd9342a);
    body.position.set(1, 2.2, 0);
    const cab = this.mesh(new THREE.BoxGeometry(2.6, 2.6, 2.8), 0xd9342a);
    cab.position.set(-0.6, 4.4, 0);
    const roof = this.mesh(new THREE.BoxGeometry(3.2, 0.3, 3.4), 0xffffff);
    roof.position.set(-0.6, 5.85, 0);
    const pipe = this.mesh(new THREE.CylinderGeometry(0.22, 0.22, 2.2, 8), 0x3a3a44);
    pipe.position.set(2.6, 4.2, 0.8);
    tractor.add(body, cab, roof, pipe);
    this.addWheels(tractor, [
      [-1, -1.9, 1.9],
      [-1, 1.9, 1.9],
      [2.6, -1.7, 1],
      [2.6, 1.7, 1],
    ]);
    // El remolque con sus pacas.
    const wagon = this.mesh(new THREE.BoxGeometry(7.5, 0.8, 4), 0x9a6a44);
    wagon.position.set(-TRACTOR.carLength, 1.6, 0);
    tractor.add(wagon);
    for (const [x, y, z] of [
      [-1.8, 0, -1],
      [-1.8, 0, 1],
      [1.8, 0, -1],
      [1.8, 0, 1],
      [0, 1.4, 0],
    ]) {
      const hay = this.mesh(new THREE.BoxGeometry(3.2, 1.4, 1.9), 0xf2c45a);
      hay.position.set(-TRACTOR.carLength + x, 2.7 + y, z);
      tractor.add(hay);
    }
    this.addWheels(tractor, [
      [-TRACTOR.carLength - 2.4, -2.1, 0.9],
      [-TRACTOR.carLength - 2.4, 2.1, 0.9],
      [-TRACTOR.carLength + 2.4, -2.1, 0.9],
      [-TRACTOR.carLength + 2.4, 2.1, 0.9],
    ]);
    tractor.visible = false;
    g.add(tractor);
    return {
      kind: 'tractor',
      spec: TRACTOR,
      ouch: '¡Te alcanzó el tractor! 🚜',
      f,
      g,
      lights,
      booms: [],
      train: tractor,
      span,
      offset,
      length: TRACTOR.cars * TRACTOR.carLength,
      warned: false,
    };
  }

  // Los carritos de la mina, cargados de cristales de colores, sobre sus vías (con faroles que avisan).
  buildMinecart(f, offset) {
    const g = this.group(f);
    const span = this.track.wallDistance + 30;
    this.addRails(g, span, 0x5a5a66);
    const lights = this.addWarningLights(g, 0x6a4a2a);
    const carts = new THREE.Group();
    const gems = [0x3fe0ff, 0xff4dd2, 0x7cff6b, 0xffd02a];
    for (let k = 0; k < MINECART.cars; k += 1) {
      const x = -k * MINECART.carLength;
      const cart = this.mesh(new THREE.BoxGeometry(MINECART.carLength - 1.2, MINECART.height, MINECART.width), 0x6a6a76);
      cart.position.set(x, MINECART.height / 2 + 0.9, 0);
      const gem = this.mesh(new THREE.OctahedronGeometry(1.3), gems[k % gems.length], { emissive: gems[k % gems.length], emissiveIntensity: 0.6 });
      gem.position.set(x, MINECART.height + 1.5, 0);
      carts.add(cart, gem);
      this.addWheels(carts, [
        [x - 1.6, -1.6, 0.7],
        [x - 1.6, 1.6, 0.7],
        [x + 1.6, -1.6, 0.7],
        [x + 1.6, 1.6, 0.7],
      ]);
    }
    carts.visible = false;
    g.add(carts);
    return {
      kind: 'minecart',
      spec: MINECART,
      ouch: '¡Te alcanzó el carrito de la mina! ⛏️',
      f,
      g,
      lights,
      booms: [],
      train: carts,
      span,
      offset,
      length: MINECART.cars * MINECART.carLength,
      warned: false,
    };
  }

  updateTrain(item, dtMs, racers) {
    const spec = item.spec;
    const cycle = (this.timeMs + item.offset) % spec.everyMs;
    const travelMs = ((item.span * 2 + item.length) / spec.speed) * 1000;
    const warning = cycle < spec.warnMs + travelMs;
    const passing = cycle >= spec.warnMs && cycle < spec.warnMs + travelMs;
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
    const head = -item.span + ((cycle - spec.warnMs) / 1000) * spec.speed;
    item.train.position.x = head;
    for (const racer of racers) {
      const { along, side } = this.local(item.f, racer);
      if (Math.abs(along) > spec.width / 2 + spec.reach * 0.6) continue;
      if (side > head + spec.carLength / 2 + spec.reach || side < head - item.length + spec.carLength / 2 - spec.reach) continue;
      if (racer.livingHitMs > 0) continue;
      racer.livingHitMs = 1500;
      racer.speed *= 0.3;
      this.onHit(racer, item.ouch);
    }
  }

  // El carrusel: un disco de gajos de colores con orilla dorada, casi a ras del camino.
  buildCarousel(f, offset) {
    const g = this.group(f);
    const radius = this.track.roadWidth / 2 + 1.4;
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    const slices = CAROUSEL.colors.length * 2;
    for (let k = 0; k < slices; k += 1) {
      ctx.fillStyle = CAROUSEL.colors[k % CAROUSEL.colors.length];
      ctx.beginPath();
      ctx.moveTo(128, 128);
      ctx.arc(128, 128, 128, (k / slices) * Math.PI * 2, ((k + 1) / slices) * Math.PI * 2);
      ctx.fill();
    }
    // Una estrella en medio.
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    for (let k = 0; k < 10; k += 1) {
      const r = k % 2 ? 14 : 34;
      const a = (k / 10) * Math.PI * 2 - Math.PI / 2;
      ctx.lineTo(128 + Math.cos(a) * r, 128 + Math.sin(a) * r);
    }
    ctx.fill();
    const texture = this.own(new THREE.CanvasTexture(canvas));
    texture.colorSpace = THREE.SRGBColorSpace;
    const top = this.own(new THREE.MeshBasicMaterial({ map: texture }));
    const side = this.own(new THREE.MeshLambertMaterial({ color: 0xffd02a }));
    // (Las caras del cilindro: el lado, la tapa de arriba y la de abajo.)
    const disk = new THREE.Mesh(this.own(new THREE.CylinderGeometry(radius, radius, 0.3, 40)), [side, top, side]);
    disk.position.y = 0.12;
    const rim = this.mesh(new THREE.TorusGeometry(radius, 0.3, 6, 40), 0xffd02a, { emissive: 0x6a5a00 });
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 0.3;
    g.add(disk, rim);
    return { kind: 'carousel', f, g, disk, radius, offset, angle: 0, on: new Set() };
  }

  updateCarousel(item, dtMs, racers) {
    const dt = dtMs / 1000;
    // Cambia de sentido cada rato.
    const dir = Math.floor((this.timeMs + item.offset) / CAROUSEL.flipMs) % 2 ? -1 : 1;
    const turn = dir * CAROUSEL.speed * dt;
    item.angle += turn;
    item.disk.rotation.y = item.angle;
    for (const racer of racers) {
      const dx = racer.x - item.f.x;
      const dz = racer.z - item.f.z;
      const on = !racer.airborne && Math.hypot(dx, dz) < item.radius;
      if (!on) {
        item.on.delete(racer);
        continue;
      }
      // Lo gira alrededor del centro (y hacia dónde ve, igual).
      const cos = Math.cos(turn);
      const sin = Math.sin(turn);
      racer.x = item.f.x + dx * cos + dz * sin;
      racer.z = item.f.z - dx * sin + dz * cos;
      racer.heading += turn;
      if (item.on.has(racer)) continue;
      item.on.add(racer);
      if (!racer.isCpu) {
        sfx.boing();
        racer.say('¡Carrusel! 🎠', 900);
      }
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

  // Un cañón de agua a un lado (`side`), apuntando al otro lado del camino, y su chorro. El aspersor del jardín
  // (`look` = 'sprinkler') es igual pero verde, con su cabecita amarilla.
  buildCannon(f, offset, side, look = 'cannons') {
    const g = this.group(f);
    const garden = look === 'sprinkler';
    const x = side * (this.track.wallDistance + 3);
    const base = this.mesh(new THREE.CylinderGeometry(garden ? 0.9 : 1.6, garden ? 1.4 : 2, garden ? 2.6 : 1.6, 12), garden ? 0x3cc44f : 0x6a4a2a);
    base.position.set(x, garden ? 1.3 : 0.8, 0);
    const barrel = this.mesh(new THREE.CylinderGeometry(garden ? 0.5 : 0.8, garden ? 0.9 : 1.1, garden ? 2.6 : 4, 12), garden ? 0xffd02a : 0x3a3a44);
    barrel.rotation.z = (side * Math.PI) / 2;
    barrel.position.set(x - side * 1.2, garden ? 2.8 : 2.2, 0);
    const jetMaterial = this.own(
      new THREE.MeshLambertMaterial({
        color: garden ? 0xbff0ff : 0x7fd4ff,
        transparent: true,
        opacity: garden ? 0.6 : 0.7,
        emissive: garden ? 0x2f7aaa : 0x1f5a8a,
      }),
    );
    const jet = new THREE.Mesh(this.own(new THREE.CylinderGeometry(1.4, 0.9, this.track.wallDistance * 2, 12, 1, true)), jetMaterial);
    jet.rotation.z = Math.PI / 2;
    jet.position.set(0, 2, 0);
    jet.visible = false;
    g.add(base, barrel, jet);
    return { kind: 'cannons', look, f, g, side, barrel, barrelY: barrel.position.y, jet, offset };
  }

  updateCannon(item, dtMs, racers) {
    const cycle = (this.timeMs + item.offset) % CANNON.everyMs;
    const warn = cycle < CANNON.warnMs;
    const spraying = cycle >= CANNON.warnMs && cycle < CANNON.warnMs + CANNON.sprayMs;
    // Antes de echar agua tiembla.
    item.barrel.position.y = item.barrelY + (warn ? Math.sin(cycle / 25) * 0.2 : 0);
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
      if (item.kind === 'train' || item.kind === 'tractor' || item.kind === 'minecart') this.updateTrain(item, dtMs, racers);
      else if (item.kind === 'carousel') this.updateCarousel(item, dtMs, racers);
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
