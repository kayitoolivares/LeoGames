import * as THREE from 'three';
import { glowTexture, roadside } from './scenery.js';
import { farSpots, instances } from './scenery2.js';

// Paisajes de la Copa Fiesta (ver addScenery en scenery.js): granja, feria, jardín gigante y mina de cristales.
// Figuras sencillas y en pocos pedazos (InstancedMesh) para que el Xbox no sufra; lo que se mueve, en `update(dt)`.
export function addFiestaScenery(scene, track, kind) {
  if (kind === 'farm') return addFarm(scene, track);
  if (kind === 'fair') return addFair(scene, track);
  if (kind === 'garden') return addGarden(scene, track);
  if (kind === 'mine') return addMine(scene, track);
  return null;
}

// Lugares libres a más de `clearance` del camino (sin tapar el atajo), para cosas grandes. Con semilla: siempre igual.
function openSpots(track, count, clearance, seed) {
  return track
    .scatter(count * 8, seed, track.theme.avoid)
    .filter((spot) => track.closest(spot.x, spot.z).distance > clearance)
    .slice(0, count);
}

// Hacia dónde ver desde (x, z) para quedar de frente al camino más cercano.
function faceRoad(track, x, z) {
  const p = track.points[track.closest(x, z).index];
  return Math.atan2(p.x - x, p.z - z);
}

// Junto al camino de los dos lados, cada `every` muestras y a `gap` de las llantas (sin los huecos del atajo ni
// de los puentes).
function bothSides(track, every, gap) {
  const spots = [];
  for (let i = 0; i < track.count; i += every) {
    for (const side of [-1, 1]) {
      if (track.inGap(i, side)) continue;
      const spot = track.pointAt(i, side * (track.wallDistance + gap));
      if (track.blocked(spot.x, spot.z)) continue;
      spots.push({ ...spot, side, y: track.groundHeight(spot.x, spot.z) });
    }
  }
  return spots;
}

// Granja: graneros rojos, un silo, un molino de viento que gira, cercas de madera, pacas de paja, manzanos y un
// maizal a los dos lados del atajo.
function addFarm(scene, track) {
  const red = new THREE.MeshLambertMaterial({ color: 0xc8402a });
  const white = new THREE.MeshLambertMaterial({ color: 0xfff6ea });
  const roofMaterial = new THREE.MeshLambertMaterial({ color: 0x5a3a2a });
  const roofShape = new THREE.Shape([new THREE.Vector2(-9.4, 0), new THREE.Vector2(9.4, 0), new THREE.Vector2(0, 6.5)]);
  const roofGeometry = new THREE.ExtrudeGeometry(roofShape, { depth: 12.8, bevelEnabled: false }).translate(0, 0, -6.4);
  const big = openSpots(track, 4, 34, 21);
  big.slice(0, 2).forEach((spot, k) => {
    const barn = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(16, 10, 12), red);
    body.position.y = 5;
    const roof = new THREE.Mesh(roofGeometry, roofMaterial);
    roof.position.y = 10;
    const door = new THREE.Mesh(new THREE.BoxGeometry(6, 7, 0.3), white);
    door.position.set(0, 3.5, 6.05);
    barn.add(body, roof, door);
    // La cruz blanca de la puerta.
    for (const tilt of [0.86, -0.86]) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(8.4, 0.6, 0.2), red);
      bar.position.set(0, 3.5, 6.25);
      bar.rotation.z = tilt;
      barn.add(bar);
    }
    // Junto al primer granero, el silo.
    if (k === 0) {
      const silo = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.2, 17, 14), new THREE.MeshLambertMaterial({ color: 0xd8dde6 }));
      silo.position.set(12, 8.5, -2);
      const dome = new THREE.Mesh(new THREE.SphereGeometry(3.2, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshLambertMaterial({ color: 0x9aa4b8 }));
      dome.position.set(12, 17, -2);
      barn.add(silo, dome);
    }
    barn.position.set(spot.x, spot.y, spot.z);
    barn.rotation.y = faceRoad(track, spot.x, spot.z);
    scene.add(barn);
  });
  // El molino de viento: torre blanca y aspas rojas y blancas que giran.
  const millSpot = big[2] ?? big[0] ?? { x: 160, y: 0, z: 0 };
  const mill = new THREE.Group();
  const tower = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 2.8, 22, 8), white);
  tower.position.y = 11;
  const head = new THREE.Mesh(new THREE.BoxGeometry(3, 3, 4), red);
  head.position.set(0, 22.5, 0.6);
  mill.add(tower, head);
  const blades = new THREE.Group();
  for (let k = 0; k < 4; k += 1) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(1.6, 10, 0.3), k % 2 ? red : white);
    blade.position.y = 5.4;
    const arm = new THREE.Group();
    arm.rotation.z = (k * Math.PI) / 2;
    arm.add(blade);
    blades.add(arm);
  }
  blades.position.set(0, 22.5, 2.9);
  mill.add(blades);
  mill.position.set(millSpot.x, millSpot.y, millSpot.z);
  mill.rotation.y = faceRoad(track, millSpot.x, millSpot.z);
  scene.add(mill);
  // Cercas de madera a los dos lados del camino (postes y dos travesaños), detrás de las pacas.
  const wood = new THREE.MeshLambertMaterial({ color: 0x9a6a44 });
  const fence = bothSides(track, 4, 2.6);
  instances(scene, new THREE.BoxGeometry(0.45, 2.6, 0.45), wood, fence, (d) => {
    d.position.y += 1.3;
  });
  const rails = fence.flatMap((s) => [
    { ...s, h: 1 },
    { ...s, h: 2 },
  ]);
  instances(scene, new THREE.BoxGeometry(0.2, 0.32, track.spacing * 4 + 0.4), wood, rails, (d, s) => {
    d.position.y += s.h;
    d.rotation.y = s.heading;
  });
  // Pacas de paja (acostadas) y unas encimadas.
  const bales = roadside(track, 22, 7);
  const stacked = bales.flatMap((s, i) =>
    i % 3 === 0
      ? [
          { ...s, up: 0 },
          { ...s, up: 1 },
        ]
      : [{ ...s, up: 0 }],
  );
  instances(scene, new THREE.CylinderGeometry(1.5, 1.5, 2.6, 12), new THREE.MeshLambertMaterial({ color: 0xf2c45a }), stacked, (d, s, i) => {
    d.position.y += 1.5 + s.up * 2.8;
    d.rotation.set(0, s.heading + i, Math.PI / 2);
  });
  // Manzanos: tronco y copa redonda (con manzanitas rojas).
  const trees = openSpots(track, 30, 16, 5);
  instances(scene, new THREE.CylinderGeometry(0.5, 0.7, 4, 6), new THREE.MeshLambertMaterial({ color: 0x8b5a2b }), trees, (d, s) => {
    d.position.y += 2 * s.scale;
    d.scale.setScalar(s.scale);
  });
  instances(
    scene,
    new THREE.SphereGeometry(3.2, 10, 8),
    new THREE.MeshLambertMaterial(),
    trees,
    (d, s) => {
      d.position.y += 6 * s.scale;
      d.scale.setScalar(s.scale);
    },
    [0x3fa34d, 0x2e8b57, 0x4cb35a],
  );
  const apples = trees.flatMap((s) => [0, 1, 2].map((k) => ({ ...s, k })));
  instances(scene, new THREE.SphereGeometry(0.45, 6, 5), new THREE.MeshLambertMaterial({ color: 0xe53935 }), apples, (d, s) => {
    const a = s.k * 2.1 + s.turn;
    d.position.set(s.x + Math.cos(a) * 2.9 * s.scale, s.y + (5.4 + s.k * 0.7) * s.scale, s.z + Math.sin(a) * 2.9 * s.scale);
  });
  // El maizal: hileras de matas a los dos lados del atajo (o junto al camino si la pista no tiene atajo).
  const corn = [];
  for (const { x1, z1, x2, z2, radius } of track.theme.clear ?? []) {
    const length = Math.hypot(x2 - x1, z2 - z1);
    const nx = -(z2 - z1) / length;
    const nz = (x2 - x1) / length;
    for (let t = 0; t <= length; t += 2.6) {
      for (let row = 0; row < 4; row += 1) {
        for (const side of [-1, 1]) {
          const out = radius - 3 + row * 2.6;
          const x = x1 + ((x2 - x1) * t) / length + nx * side * out;
          const z = z1 + ((z2 - z1) * t) / length + nz * side * out;
          if (track.closest(x, z).distance < track.wallDistance + 3) continue;
          corn.push({ x, z, y: track.groundHeight(x, z), k: corn.length });
        }
      }
    }
  }
  if (corn.length) {
    instances(
      scene,
      new THREE.ConeGeometry(0.6, 6.5, 5),
      new THREE.MeshLambertMaterial(),
      corn,
      (d, s) => {
        d.position.y += 3.2;
        d.scale.set(1, 0.85 + (s.k % 4) * 0.08, 1);
      },
      [0x5cae3a, 0x6abf4b, 0x4f9a33],
    );
    const cobs = corn.filter((s) => s.k % 2 === 0);
    instances(scene, new THREE.CapsuleGeometry(0.28, 0.9, 3, 6), new THREE.MeshLambertMaterial({ color: 0xffd02a }), cobs, (d) => {
      d.position.y += 3.6;
      d.position.x += 0.4;
      d.rotation.z = 0.4;
    });
  }
  return {
    update(dt) {
      blades.rotation.z -= dt * 1.2;
    },
  };
}

// Feria: la rueda de la fortuna con sus canastillas (que siempre quedan derechas), la carpa de circo de rayas,
// puestos con toldo, globos y foquitos de colores junto al camino que se prenden y apagan.
function addFair(scene, track) {
  const center = track.theme.avoid ?? { x: 0, z: 0 };
  const wheel = new THREE.Group();
  const radius = 20;
  const hub = 26;
  const steel = new THREE.MeshLambertMaterial({ color: 0xffffff });
  for (const z of [-1.6, 1.6]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.5, 6, 48), steel);
    ring.position.z = z;
    wheel.add(ring);
  }
  const cabins = [];
  const cabinColors = [0xff5a5f, 0xffd02a, 0x4cd97b, 0x3fa7ff, 0xb07cff, 0xff8a1e, 0xff5fa8, 0x3fe0ff];
  cabinColors.forEach((color, k) => {
    const a = (k / cabinColors.length) * Math.PI * 2;
    const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.4, radius, 0.4), steel);
    spoke.position.set((Math.cos(a) * radius) / 2, (Math.sin(a) * radius) / 2, 0);
    spoke.rotation.z = a - Math.PI / 2;
    wheel.add(spoke);
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(3, 2.6, 3), new THREE.MeshLambertMaterial({ color }));
    cabin.position.set(Math.cos(a) * radius, Math.sin(a) * radius - 1.8, 0);
    wheel.add(cabin);
    cabins.push({ cabin, a });
  });
  // Foquitos en la rueda.
  const bulbs = [];
  for (let k = 0; k < 16; k += 1) {
    const a = (k / 16) * Math.PI * 2;
    const bulb = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: glowTexture(), color: cabinColors[k % cabinColors.length], blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    bulb.position.set(Math.cos(a) * radius, Math.sin(a) * radius, 2.2);
    bulb.scale.setScalar(2.4);
    wheel.add(bulb);
    bulbs.push(bulb);
  }
  wheel.position.set(0, hub, 0);
  const ride = new THREE.Group();
  ride.add(wheel);
  // Las patas: dos "A" que sostienen el eje.
  for (const z of [-3, 3]) {
    for (const side of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(1, hub + 2, 1), new THREE.MeshLambertMaterial({ color: 0x8158d8 }));
      leg.position.set(side * 6, hub / 2, z);
      leg.rotation.z = side * 0.24;
      ride.add(leg);
    }
  }
  ride.position.set(center.x - 10, track.groundHeight(center.x - 10, center.z), center.z);
  ride.rotation.y = faceRoad(track, center.x - 10, center.z);
  scene.add(ride);
  // La carpa de circo: rayas rojas y blancas, con su banderita.
  const stripes = stripeTexture('#e53935', '#ffffff', 12);
  const tentAt = { x: center.x + 22, z: center.z + 12 };
  const tent = new THREE.Group();
  const wall = new THREE.Mesh(new THREE.CylinderGeometry(11, 11, 7, 24, 1, true), new THREE.MeshLambertMaterial({ map: stripes, side: THREE.DoubleSide }));
  wall.position.y = 3.5;
  const top = new THREE.Mesh(new THREE.ConeGeometry(12.5, 10, 24, 1, true), new THREE.MeshLambertMaterial({ map: stripes, side: THREE.DoubleSide }));
  top.position.y = 12;
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 5, 6), steel);
  pole.position.y = 19;
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(3, 1.8), new THREE.MeshBasicMaterial({ color: 0xffd02a, side: THREE.DoubleSide }));
  flag.position.set(1.5, 20.6, 0);
  tent.add(wall, top, pole, flag);
  tent.position.set(tentAt.x, track.groundHeight(tentAt.x, tentAt.z), tentAt.z);
  scene.add(tent);
  // Puestos con toldo de rayas y globos amarrados.
  const stands = roadside(track, 36, 8);
  instances(
    scene,
    new THREE.BoxGeometry(5, 3, 3.4),
    new THREE.MeshLambertMaterial(),
    stands,
    (d, s) => {
      d.position.y += 1.5;
      d.rotation.y = s.heading;
    },
    [0xfff1d6, 0xffe2b8],
  );
  instances(
    scene,
    new THREE.BoxGeometry(5.8, 0.4, 4.2),
    new THREE.MeshLambertMaterial(),
    stands,
    (d, s) => {
      d.position.y += 4.6;
      d.rotation.set(0.25, s.heading, 0, 'YXZ');
    },
    [0xff3b6b, 0x3fa7ff, 0x4cd97b, 0xffd02a],
  );
  const balloons = stands.flatMap((s, i) => [0, 1, 2].map((k) => ({ ...s, k, i })));
  instances(
    scene,
    new THREE.SphereGeometry(0.9, 10, 8),
    new THREE.MeshLambertMaterial(),
    balloons,
    (d, s) => {
      d.position.set(s.x + (s.k - 1) * 1.1, s.y + 7.2 + (s.k === 1 ? 0.8 : 0), s.z);
      d.scale.set(1, 1.2, 1);
    },
    cabinColors,
  );
  // Arcos de globos de colores por encima del camino.
  const archBalloons = [];
  for (const at of [0.12, 0.45, 0.93]) {
    const spot = track.pointAt(Math.round(at * track.count));
    const span = track.wallDistance + 2;
    for (let k = 0; k <= 16; k += 1) {
      const a = (k / 16) * Math.PI;
      archBalloons.push({
        x: spot.x + Math.cos(spot.heading) * Math.cos(a) * span,
        y: spot.y + 1 + Math.sin(a) * span * 0.8,
        z: spot.z - Math.sin(spot.heading) * Math.cos(a) * span,
        k,
      });
    }
  }
  instances(scene, new THREE.SphereGeometry(1.15, 10, 8), new THREE.MeshLambertMaterial(), archBalloons, (d) => d.scale.set(1, 1.15, 1), cabinColors);
  // Un carrusel de adorno (con techo de rayas) que da vueltas junto a la rueda.
  const carousel = new THREE.Group();
  const deck = new THREE.Mesh(new THREE.CylinderGeometry(8, 8, 1, 24), new THREE.MeshLambertMaterial({ color: 0xffd02a }));
  deck.position.y = 0.5;
  const roof = new THREE.Mesh(
    new THREE.ConeGeometry(9, 4, 24, 1, true),
    new THREE.MeshLambertMaterial({ map: stripeTexture('#3fa7ff', '#ffffff', 16), side: THREE.DoubleSide }),
  );
  roof.position.y = 9;
  const axle = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 8, 10), steel);
  axle.position.y = 5;
  carousel.add(deck, roof, axle);
  for (let k = 0; k < 6; k += 1) {
    const a = (k / 6) * Math.PI * 2;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 7, 6), new THREE.MeshLambertMaterial({ color: 0xffd02a }));
    pole.position.set(Math.cos(a) * 6, 4.5, Math.sin(a) * 6);
    const horse = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.6, 3), new THREE.MeshLambertMaterial({ color: cabinColors[k] }));
    horse.position.set(Math.cos(a) * 6, 3.4, Math.sin(a) * 6);
    horse.rotation.y = -a;
    carousel.add(pole, horse);
  }
  const carouselAt = { x: center.x + 18, z: center.z - 22 };
  carousel.position.set(carouselAt.x, track.groundHeight(carouselAt.x, carouselAt.z), carouselAt.z);
  scene.add(carousel);
  // Foquitos de colores en postes a los dos lados del camino.
  const lamps = bothSides(track, 16, 1.6);
  instances(scene, new THREE.CylinderGeometry(0.15, 0.2, 5, 6), new THREE.MeshLambertMaterial({ color: 0x55516a }), lamps, (d) => {
    d.position.y += 2.5;
  });
  const lights = lamps.map((s, i) => {
    const glow = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: glowTexture(), color: cabinColors[i % cabinColors.length], blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    glow.position.set(s.x, s.y + 5.3, s.z);
    glow.scale.setScalar(2.6);
    scene.add(glow);
    return glow;
  });
  let time = 0;
  return {
    update(dt) {
      time += dt;
      wheel.rotation.z += dt * 0.25;
      carousel.rotation.y += dt * 0.6;
      // Las canastillas cuelgan derechitas aunque la rueda gire.
      for (const { cabin } of cabins) cabin.rotation.z = -wheel.rotation.z;
      const step = Math.floor(time * 3);
      bulbs.forEach((bulb, k) => (bulb.visible = (k + step) % 3 !== 0));
      lights.forEach((light, k) => light.scale.setScalar((k + step) % 2 ? 2.6 : 1.6));
    },
  };
}

// Jardín gigante (los karts son chiquititos): flores enormes que se asoman al camino, hongos de puntitos, matas de
// pasto altísimas, una regadera gigante, piedritas y mariposas que vuelan.
function addGarden(scene, track) {
  // Flores: tallo y cabeza (centro y 6 pétalos) inclinada hacia el camino.
  const flowers = roadside(track, 13, 6).map((s, i) => {
    const height = 11 + (i % 4) * 2.5;
    const toward = faceRoad(track, s.x, s.z);
    return { ...s, height, toward, i };
  });
  instances(scene, new THREE.CylinderGeometry(0.45, 0.6, 1, 6), new THREE.MeshLambertMaterial({ color: 0x3cae3f }), flowers, (d, s) => {
    d.position.y += s.height / 2;
    d.scale.set(1, s.height, 1);
  });
  const head = new THREE.Object3D();
  const petal = new THREE.Object3D();
  const matrix = new THREE.Matrix4();
  const petalColors = [0xff5fa8, 0xffd02a, 0xb07cff, 0xff8a5c, 0xffffff, 0x3fa7ff];
  const petals = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 10, 6), new THREE.MeshLambertMaterial(), flowers.length * 6);
  const centers = new THREE.InstancedMesh(new THREE.SphereGeometry(1.5, 12, 8), new THREE.MeshLambertMaterial({ color: 0xffb81c }), flowers.length);
  const color = new THREE.Color();
  flowers.forEach((s, i) => {
    head.position.set(s.x, s.y + s.height + 0.8, s.z);
    // Viendo hacia el camino, inclinada para que los karts la vean de frente.
    head.rotation.set(1.0, s.toward, 0, 'YXZ');
    head.scale.setScalar(1);
    head.updateMatrix();
    matrix.copy(head.matrix).multiply(new THREE.Matrix4().makeScale(1, 0.5, 1));
    centers.setMatrixAt(i, matrix);
    for (let k = 0; k < 6; k += 1) {
      const a = (k / 6) * Math.PI * 2;
      petal.position.set(Math.cos(a) * 2.6, 0, Math.sin(a) * 2.6);
      petal.rotation.set(0, -a, 0);
      petal.scale.set(2, 0.35, 1.2);
      petal.updateMatrix();
      matrix.multiplyMatrices(head.matrix, petal.matrix);
      petals.setMatrixAt(i * 6 + k, matrix);
      petals.setColorAt(i * 6 + k, color.setHex(petalColors[i % petalColors.length]));
    }
  });
  scene.add(petals, centers);
  // Hongos gigantes con sombrero rojo de puntitos blancos.
  const mushrooms = openSpots(track, 14, 14, 9);
  instances(scene, new THREE.CylinderGeometry(1.4, 1.9, 6, 10), new THREE.MeshLambertMaterial({ color: 0xfff1d6 }), mushrooms, (d, s) => {
    d.position.y += 3 * s.scale;
    d.scale.setScalar(s.scale);
  });
  instances(
    scene,
    new THREE.SphereGeometry(5, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshLambertMaterial(),
    mushrooms,
    (d, s) => {
      d.position.y += 5.6 * s.scale;
      d.scale.set(s.scale, s.scale * 0.8, s.scale);
    },
    [0xe53935, 0xff8a1e, 0xb07cff],
  );
  const dots = mushrooms.flatMap((s) => [0, 1, 2, 3, 4].map((k) => ({ ...s, k })));
  instances(scene, new THREE.SphereGeometry(0.8, 8, 6), new THREE.MeshLambertMaterial({ color: 0xffffff }), dots, (d, s) => {
    const a = s.k * 1.26 + s.turn;
    const up = s.k === 4 ? 0 : 0.62;
    d.position.set(s.x + Math.cos(a) * 5 * up * s.scale, s.y + (5.6 + 4 * (s.k === 4 ? 1 : 0.62)) * s.scale, s.z + Math.sin(a) * 5 * up * s.scale);
    d.scale.set(s.scale, s.scale * 0.5, s.scale);
  });
  // Matas de pasto altísimas (tres hojas cada una).
  const grass = bothSides(track, 9, 2.4).flatMap((s, i) => [-1, 0, 1].map((k) => ({ ...s, k, i })));
  instances(
    scene,
    new THREE.ConeGeometry(0.5, 1, 4),
    new THREE.MeshLambertMaterial(),
    grass,
    (d, s) => {
      const tall = 5 + ((s.i * 3 + s.k) % 4) * 1.4;
      d.position.set(s.x + Math.cos(s.heading) * s.k * 0.9, s.y + tall / 2, s.z - Math.sin(s.heading) * s.k * 0.9);
      d.rotation.set(0, s.heading, s.k * 0.18);
      d.scale.set(1, tall, 1);
    },
    [0x4cb35a, 0x3fa34d, 0x5cbf3a],
  );
  // Piedritas junto al camino.
  instances(
    scene,
    new THREE.DodecahedronGeometry(1.1, 0),
    new THREE.MeshLambertMaterial({ color: 0xb8b0a8, flatShading: true }),
    roadside(track, 7, 0.8),
    (d, s, i) => {
      d.position.y += 0.4;
      d.rotation.set(i, i * 2, 0);
      d.scale.set(1 + (i % 3) * 0.3, 0.6, 1);
    },
  );
  // La regadera gigante (verde, con su asa y su pico).
  const canSpot = openSpots(track, 1, 30, 31)[0];
  if (canSpot) {
    const can = new THREE.Group();
    const green = new THREE.MeshLambertMaterial({ color: 0x2fb8a0 });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(7, 8, 12, 20), green);
    body.position.y = 6;
    const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.6, 14, 10), green);
    spout.position.set(10, 9, 0);
    spout.rotation.z = -0.9;
    const rose = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 1, 1.2, 12), green);
    rose.position.set(15.4, 13.2, 0);
    rose.rotation.z = -0.9;
    const handle = new THREE.Mesh(new THREE.TorusGeometry(5, 0.8, 8, 20, Math.PI), green);
    handle.position.set(-1, 12, 0);
    can.add(body, spout, rose, handle);
    can.position.set(canSpot.x, canSpot.y, canSpot.z);
    can.rotation.y = faceRoad(track, canSpot.x, canSpot.z) - Math.PI / 2;
    scene.add(can);
  }
  // Mariposas: dos alas que aletean, volando en círculos sobre el pasto.
  const wingGeometry = new THREE.CircleGeometry(1.2, 12);
  const butterflies = farSpots(track, 45, 4, 14).map((s, i) => {
    const material = new THREE.MeshBasicMaterial({ color: petalColors[(i + 2) % petalColors.length], side: THREE.DoubleSide });
    const fly = new THREE.Group();
    const wings = [-1, 1].map((side) => {
      const pivot = new THREE.Group();
      const wing = new THREE.Mesh(wingGeometry, material);
      wing.position.x = side * 1.1;
      wing.scale.set(1, 0.8, 1);
      pivot.add(wing);
      pivot.rotation.x = -Math.PI / 2;
      fly.add(pivot);
      return { pivot, side };
    });
    scene.add(fly);
    return { fly, wings, x: s.x, z: s.z, y: s.y + 5 + (i % 3) * 2, r: 5 + (i % 4) * 2, phase: i * 1.7 };
  });
  let time = 0;
  return {
    update(dt) {
      time += dt;
      for (const b of butterflies) {
        const a = time * 0.6 + b.phase;
        b.fly.position.set(b.x + Math.cos(a) * b.r, b.y + Math.sin(time * 2 + b.phase) * 0.8, b.z + Math.sin(a) * b.r);
        b.fly.rotation.y = -a;
        const flap = Math.sin(time * 14 + b.phase) * 0.9;
        for (const { pivot, side } of b.wings) pivot.rotation.z = side * flap;
      }
    },
  };
}

// Mina de cristales: arcos de madera sobre el camino con faroles, racimos de cristales que brillan (y laten),
// estalagmitas en el piso, estalactitas en el "techo" de la cueva y un carrito con su montón de piedras preciosas.
function addMine(scene, track) {
  // Los arcos de madera (dos postes y una viga encima del camino), menos en los puentes y la entrada del atajo.
  const arches = [];
  for (let i = 12; i < track.count; i += 26) {
    if (track.inGap(i, 1) || track.inGap(i, -1)) continue;
    arches.push(track.pointAt(i));
  }
  const wood = new THREE.MeshLambertMaterial({ color: 0x7a4a2a });
  const posts = arches.flatMap((s) => [-1, 1].map((side) => ({ ...track.pointAt(s.index, side * (track.wallDistance + 1.2)), y: s.y })));
  instances(scene, new THREE.BoxGeometry(1.2, 10, 1.2), wood, posts, (d) => {
    d.position.y += 5;
  });
  instances(scene, new THREE.BoxGeometry(track.wallDistance * 2 + 4, 1.2, 1.4), wood, arches, (d, s) => {
    d.position.y += 10.4;
    d.rotation.y = s.heading;
  });
  const lanterns = arches.map((s) => {
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: 0xffc46a, blending: THREE.AdditiveBlending, depthWrite: false }));
    glow.position.set(s.x, s.y + 9, s.z);
    glow.scale.setScalar(3.2);
    scene.add(glow);
    return glow;
  });
  // Racimos de cristales de colores junto al camino, con su brillo.
  const gemColors = [0x3fe0ff, 0xff4dd2, 0xb07cff, 0x7cff6b];
  const clusters = roadside(track, 11, 3.5).filter((s) => !track.inGap(s.index, 1) && !track.inGap(s.index, -1));
  const crystals = clusters.flatMap((s, i) => [0, 1, 2].map((k) => ({ ...s, k, i })));
  const gemMaterial = new THREE.MeshLambertMaterial({ emissive: 0x3a3a3a });
  instances(
    scene,
    new THREE.OctahedronGeometry(1, 0),
    gemMaterial,
    crystals,
    (d, s) => {
      const size = [2.6, 1.8, 1.4][s.k];
      d.position.set(s.x + (s.k - 1) * 1.4, s.y + size * 1.2, s.z + (s.k === 1 ? 0.8 : 0));
      d.rotation.set(0, s.i, (s.k - 1) * 0.4);
      d.scale.set(size * 0.7, size * 1.6, size * 0.7);
    },
    clusters.flatMap((_, i) => [0, 1, 2].map(() => gemColors[i % gemColors.length])),
  );
  const shines = clusters.map((s, i) => {
    const glow = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: glowTexture(), color: gemColors[i % gemColors.length], blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    glow.position.set(s.x, s.y + 3, s.z);
    glow.scale.setScalar(5);
    scene.add(glow);
    return glow;
  });
  // Estalagmitas en el piso y estalactitas colgando del techo de la cueva.
  const rock = new THREE.MeshLambertMaterial({ color: 0x6a5a6e, flatShading: true });
  const stalagmites = openSpots(track, 40, 12, 17);
  instances(scene, new THREE.ConeGeometry(2.4, 9, 6), rock, stalagmites, (d, s) => {
    d.position.y += 4.5 * s.scale;
    d.scale.setScalar(s.scale);
  });
  const ceiling = track.scatter(60, 23).map((s) => ({ ...s, y: 46 + s.scale * 10 }));
  instances(scene, new THREE.ConeGeometry(3.4, 16, 6), rock, ceiling, (d, s) => {
    d.rotation.x = Math.PI;
    d.scale.setScalar(s.scale);
  });
  // Un carrito de la mina con piedras preciosas, junto al camino.
  const cartSpot = roadside(track, 400, 9)[1];
  if (cartSpot) {
    const cart = new THREE.Mesh(new THREE.BoxGeometry(5, 3, 3.6), new THREE.MeshLambertMaterial({ color: 0x6a6a76 }));
    cart.position.set(cartSpot.x, cartSpot.y + 2.2, cartSpot.z);
    cart.rotation.y = cartSpot.heading;
    scene.add(cart);
    const pile = [0, 1, 2, 3, 4].map((k) => ({ x: cartSpot.x + Math.cos(k * 1.3) * 1.2, y: cartSpot.y + 4, z: cartSpot.z + Math.sin(k * 1.3) * 1.2, k }));
    instances(
      scene,
      new THREE.OctahedronGeometry(0.9, 0),
      gemMaterial,
      pile,
      (d, s) => {
        d.rotation.set(s.k, s.k * 2, 0);
      },
      gemColors,
    );
  }
  let time = 0;
  return {
    update(dt) {
      time += dt;
      shines.forEach((glow, i) => glow.scale.setScalar(4.4 + Math.sin(time * 2.4 + i) * 1.2));
      lanterns.forEach((glow, i) => glow.scale.setScalar(3 + Math.sin(time * 11 + i * 2.3) * 0.25));
    },
  };
}

// Rayas verticales de dos colores (la carpa del circo).
function stripeTexture(a, b, count) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 16;
  const ctx = canvas.getContext('2d');
  for (let k = 0; k < count; k += 1) {
    ctx.fillStyle = k % 2 ? b : a;
    ctx.fillRect((k * 256) / count, 0, 256 / count + 1, 16);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
