import * as THREE from 'three';

// Piezas que comparten todos los carros (solo cambia el color de cada uno).
const shared = {
  wheel: new THREE.CylinderGeometry(1, 1, 0.4, 14).rotateZ(Math.PI / 2),
  hub: new THREE.CylinderGeometry(0.55, 0.55, 0.44, 10).rotateZ(Math.PI / 2),
  tireMat: new THREE.MeshLambertMaterial({ color: 0x222222 }),
  eye: new THREE.SphereGeometry(0.22, 10, 8),
  eyeMat: new THREE.MeshBasicMaterial({ color: 0xffffff }),
  pupil: new THREE.SphereGeometry(0.11, 8, 6),
  pupilMat: new THREE.MeshBasicMaterial({ color: 0x1b1530 }),
  shadow: new THREE.CircleGeometry(2, 16).rotateX(-Math.PI / 2),
  shadowMat: new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.25, depthWrite: false }),
  // El cono apunta hacia atrás del carro (-z): es la flama del turbo.
  flame: new THREE.ConeGeometry(0.4, 1.4, 8).rotateX(-Math.PI / 2),
  flameMat: new THREE.MeshBasicMaterial({ color: 0xff9a3c }),
};
// Llantas: color de la llanta y del rin. 'colores' = cada llanta de un color.
const WHEEL_LOOKS = {
  normales: { tire: 0x222222, hub: 0x9a9aa8 },
  doradas: { tire: 0x222222, hub: 0xffc93c },
  colores: { tire: null, hub: 0xffffff },
  blancas: { tire: 0xf2f2f2, hub: 0xe53935 },
};
const RAINBOW_TIRES = [0xff5a5f, 0x3fa7ff, 0x4cd97b, 0xffc93c];

// Las formas de cada tipo de kart. Cada una dice dónde quedan sus llantas (x, z, radio), lo alto de la carrocería
// (`top`), la parte de atrás (`back`) y de adelante (`front`), y el asiento del piloto (`seat`).
const BODIES = {
  clasico(add, paint) {
    add(new THREE.BoxGeometry(2.2, 0.6, 3.2), paint, 0, 0.65, 0);
    add(new THREE.BoxGeometry(1.6, 0.4, 0.8), paint, 0, 0.55, 1.9);
    return { wheels: corners(1.15, 1.1, 0.45), top: 0.95, back: -1.5, front: 2.2, seat: [0, 0.9, -0.35] };
  },
  // Largo y bajito, con la nariz en punta.
  bolido(add, paint) {
    add(new THREE.BoxGeometry(1.9, 0.45, 3.6), paint, 0, 0.55, 0);
    const nose = add(new THREE.ConeGeometry(0.75, 1.6, 4).rotateX(Math.PI / 2).rotateZ(Math.PI / 4), paint, 0, 0.5, 2.55);
    nose.scale.set(1.2, 0.5, 1);
    for (const side of [-1, 1]) add(new THREE.BoxGeometry(0.45, 0.35, 1.7), paint, side * 1.1, 0.45, -0.3);
    return { wheels: corners(1.25, 1.35, 0.42), top: 0.78, back: -1.75, front: 3.3, seat: [0, 0.75, -0.45] };
  },
  // Chiquito y alto, como cochecito de juguete.
  mini(add, paint) {
    add(new THREE.BoxGeometry(1.9, 0.75, 2.4), paint, 0, 0.72, 0);
    add(new THREE.BoxGeometry(2.05, 0.28, 0.3), shared.tireMat, 0, 0.45, 1.25);
    return { wheels: corners(1.0, 0.8, 0.38), top: 1.1, back: -1.15, front: 1.4, seat: [0, 1.05, -0.25] };
  },
  // Llantotas y la carrocería hasta arriba.
  monstruo(add, paint) {
    add(new THREE.BoxGeometry(2.3, 0.6, 3.0), paint, 0, 1.35, 0);
    add(new THREE.BoxGeometry(1.4, 0.25, 2.6), shared.tireMat, 0, 0.95, 0);
    return { wheels: corners(1.4, 1.1, 0.8), top: 1.65, back: -1.45, front: 1.6, seat: [0, 1.6, -0.3] };
  },
};

function corners(x, z, radius) {
  return [[-x, z], [x, z], [-x, -z], [x, -z]].map(([wx, wz]) => ({ x: wx, z: wz, radius }));
}

// Un carrito que mira hacia +z. Opciones (todas tienen valor de siempre):
//   type: clasico | bolido | mini | monstruo     wheels: normales | doradas | colores | blancas
//   extra: aleron | bandera | cuernos | antena | nada
//   driver: true = el piloto lo pone quien lo usa (en `seat`); si no, lleva una bolita con ojos.
// Devuelve { group, flame, seat } (seat = dónde van los pies del piloto).
export function buildKartModel(color, { type = 'clasico', wheels = 'normales', extra = 'aleron', driver = false } = {}) {
  const group = new THREE.Group();
  const paint = new THREE.MeshLambertMaterial({ color });
  const add = (geometry, material, x, y, z) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    group.add(mesh);
    return mesh;
  };

  add(shared.shadow, shared.shadowMat, 0, 0.06, 0);
  const body = (BODIES[type] ?? BODIES.clasico)(add, paint);
  const look = WHEEL_LOOKS[wheels] ?? WHEEL_LOOKS.normales;
  const hubMat = new THREE.MeshLambertMaterial({ color: look.hub });
  const tireMat = look.tire === 0x222222 ? shared.tireMat : look.tire === null ? null : new THREE.MeshLambertMaterial({ color: look.tire });
  body.wheels.forEach(({ x, z, radius }, i) => {
    const tire = add(shared.wheel, tireMat ?? new THREE.MeshLambertMaterial({ color: RAINBOW_TIRES[i] }), x, radius, z);
    tire.scale.set(1, radius, radius);
    const hub = add(shared.hub, hubMat, x, radius, z);
    hub.scale.set(1, radius, radius);
  });
  addExtra(extra, add, paint, color, body);

  if (!driver) {
    const head = new THREE.Color(color).lerp(new THREE.Color(0xffffff), 0.25);
    const [sx, sy, sz] = body.seat;
    add(new THREE.SphereGeometry(0.75, 16, 12), new THREE.MeshLambertMaterial({ color: head }), sx, sy + 0.65, sz);
    for (const side of [-1, 1]) {
      add(shared.eye, shared.eyeMat, side * 0.28, sy + 0.8, sz + 0.63);
      add(shared.pupil, shared.pupilMat, side * 0.28, sy + 0.8, sz + 0.82);
    }
  }

  const flame = add(shared.flame, shared.flameMat, 0, body.top - 0.3, body.back - 0.8);
  flame.visible = false;
  return { group, flame, seat: new THREE.Vector3(...body.seat) };
}

// El adorno: alerón atrás, bandera, cuernos adelante o antena con bolita.
function addExtra(extra, add, paint, color, body) {
  const { top, back, front } = body;
  if (extra === 'aleron') {
    add(new THREE.BoxGeometry(2.4, 0.15, 0.55), paint, 0, top + 0.35, back + 0.1);
    for (const side of [-1, 1]) add(new THREE.BoxGeometry(0.12, 0.35, 0.2), shared.tireMat, side * 0.7, top + 0.15, back + 0.1);
  } else if (extra === 'bandera') {
    add(new THREE.CylinderGeometry(0.05, 0.05, 2.2, 6), shared.tireMat, 0.75, top + 1.1, back + 0.2);
    const cloth = new THREE.Color(color).lerp(new THREE.Color(0xffffff), 0.45);
    add(new THREE.BoxGeometry(0.05, 0.65, 0.95), new THREE.MeshLambertMaterial({ color: cloth }), 0.75, top + 1.85, back - 0.3);
  } else if (extra === 'cuernos') {
    const horn = new THREE.MeshLambertMaterial({ color: 0xfff3d6 });
    for (const side of [-1, 1]) {
      const cone = add(new THREE.ConeGeometry(0.22, 1, 8), horn, side * 0.75, top + 0.35, front - 0.6);
      cone.rotation.set(0.6, 0, -side * 0.35);
    }
  } else if (extra === 'antena') {
    add(new THREE.CylinderGeometry(0.04, 0.04, 2.4, 6), shared.tireMat, -0.75, top + 1.2, back + 0.2);
    add(new THREE.SphereGeometry(0.3, 10, 8), new THREE.MeshLambertMaterial({ color: 0xffc93c }), -0.75, top + 2.45, back + 0.2);
  }
}

// Libera lo que es solo de este carro (las piezas compartidas se quedan): para el taller, que los rehace seguido.
const sharedResources = new Set(Object.values(shared));
export function disposeKartModel(group) {
  group.traverse((object) => {
    if (object.geometry && !sharedResources.has(object.geometry)) object.geometry.dispose();
    for (const material of [].concat(object.material ?? [])) if (!sharedResources.has(material)) material.dispose();
  });
}

// Letrero "J1" / "CPU" que flota arriba del carro, siempre de frente a la cámara.
export function buildKartLabel(text, color) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.font = 'bold 44px "Segoe UI", Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 10;
  ctx.strokeStyle = '#1b1530';
  ctx.strokeText(text, 64, 34);
  ctx.fillStyle = `#${color.toString(16).padStart(6, '0')}`;
  ctx.fillText(text, 64, 34);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, depthTest: false }));
  sprite.scale.set(4, 2, 1);
  sprite.position.y = 3.8;
  sprite.renderOrder = 10;
  return sprite;
}
