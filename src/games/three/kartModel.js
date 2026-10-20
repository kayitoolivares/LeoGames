import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Los karts se ven como caricatura: sombreado "toon" (2-3 tonos en vez de degradado) y un contorno negro.
// Todas las piezas de un kart se juntan en una sola figura con sus colores pintados en los vértices: así cada kart
// se dibuja de una sola pasada (más el contorno), que es mucho más ligero para el Xbox. Los materiales son los
// mismos para todos los karts.
const OUTLINE = 0.075;
const toonRamp = new THREE.DataTexture(new Uint8Array([90, 90, 90, 255, 175, 175, 175, 255, 255, 255, 255, 255]), 3, 1);
toonRamp.minFilter = THREE.NearestFilter;
toonRamp.magFilter = THREE.NearestFilter;
toonRamp.needsUpdate = true;
const shared = {
  bodyMat: new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: toonRamp }),
  // El contorno: la misma figura un poquito inflada, pintada de negro y vista por dentro.
  outlineMat: new THREE.MeshBasicMaterial({ color: 0x1b1530, side: THREE.BackSide }),
  eye: new THREE.SphereGeometry(0.22, 10, 8),
  eyeMat: new THREE.MeshBasicMaterial({ color: 0xffffff }),
  pupil: new THREE.SphereGeometry(0.11, 8, 6),
  pupilMat: new THREE.MeshBasicMaterial({ color: 0x1b1530 }),
  shadow: new THREE.CircleGeometry(2, 16).rotateX(-Math.PI / 2),
  shadowMat: new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.25, depthWrite: false }),
  // El cono apunta hacia atrás del carro (-z): es la flama del turbo.
  flame: new THREE.ConeGeometry(0.4, 1.4, 8).rotateX(-Math.PI / 2),
  flameMat: new THREE.MeshBasicMaterial({ color: 0xff9a3c }),
  decal: new THREE.PlaneGeometry(1, 1),
};
shared.outlineMat.onBeforeCompile = (shader) => {
  shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `vec3 transformed = position + normal * ${OUTLINE};`);
};

const DARK = 0x2b2b3a;
const METAL = 0xb8bcc8;
const LIGHT = 0xfff3b0;
// Llantas: color de la llanta y del rin. 'colores' = cada llanta de un color.
const WHEEL_LOOKS = {
  normales: { tire: 0x222222, hub: 0x9a9aa8 },
  doradas: { tire: 0x222222, hub: 0xffc93c },
  colores: { tire: null, hub: 0xffffff },
  blancas: { tire: 0xf2f2f2, hub: 0xe53935 },
  fuego: { tire: 0x2b1b1b, hub: 0xff5a1e },
  neon: { tire: 0x1b1530, hub: 0x3fe0ff },
};
const RAINBOW_TIRES = [0xff5a5f, 0x3fa7ff, 0x4cd97b, 0xffc93c];

// Las formas de cada tipo de kart (con `add(geometría, color, x, y, z)`; color 'paint' = el del kart).
// Cada una dice dónde quedan sus llantas (x, z, radio), lo alto de la carrocería (`top`), la parte de atrás
// (`back`) y de adelante (`front`), el asiento del piloto (`seat`) y dónde van las calcomanías de los lados
// (`side`: x del costado, alto, centro y largo).
const BODIES = {
  clasico(add) {
    add(new RoundedBoxGeometry(2.3, 0.55, 3.3, 3, 0.2), 'paint', 0, 0.65, 0);
    add(new RoundedBoxGeometry(1.7, 0.4, 0.9, 3, 0.15), 'paint', 0, 0.55, 1.95);
    add(new RoundedBoxGeometry(2.0, 0.25, 0.3, 2, 0.1), DARK, 0, 0.42, 2.45);
    cockpit(add, 0.95, -0.4);
    for (const side of [-1, 1]) {
      add(new THREE.CylinderGeometry(0.13, 0.16, 0.6, 8).rotateX(Math.PI / 2), METAL, side * 0.55, 0.7, -1.85);
      add(new THREE.SphereGeometry(0.16, 8, 6), LIGHT, side * 0.55, 0.65, 2.42);
    }
    return { wheels: corners(1.18, 1.1, 0.45), top: 0.95, back: -1.65, front: 2.6, seat: [0, 0.9, -0.4], side: [1.16, 0.65, 0.1, 2.4, 0.5] };
  },
  // Largo y bajito, con la nariz en punta y pontones a los lados.
  bolido(add) {
    add(new RoundedBoxGeometry(1.9, 0.45, 3.6, 3, 0.18), 'paint', 0, 0.55, 0);
    add(new THREE.ConeGeometry(0.8, 1.7, 4).rotateY(Math.PI / 4).rotateX(Math.PI / 2).scale(1.15, 0.45, 1), 'paint', 0, 0.5, 2.6);
    for (const side of [-1, 1]) add(new RoundedBoxGeometry(0.5, 0.38, 1.9, 2, 0.14), 'paint', side * 1.15, 0.47, -0.3);
    add(new RoundedBoxGeometry(2.3, 0.12, 0.32, 2, 0.05), DARK, 0, 0.36, 3.35);
    cockpit(add, 0.78, -0.45);
    for (const side of [-1, 1]) add(new THREE.CylinderGeometry(0.12, 0.15, 0.5, 8).rotateX(Math.PI / 2), METAL, side * 0.4, 0.6, -2.0);
    return { wheels: corners(1.3, 1.35, 0.42), top: 0.78, back: -1.8, front: 3.45, seat: [0, 0.75, -0.45], side: [1.41, 0.48, -0.3, 1.7, 0.32] };
  },
  // Chiquito y alto, como cochecito de juguete, con defensas adelante y atrás.
  mini(add) {
    add(new RoundedBoxGeometry(1.95, 0.8, 2.4, 4, 0.32), 'paint', 0, 0.72, 0);
    for (const z of [1.28, -1.28]) add(new RoundedBoxGeometry(2.05, 0.28, 0.3, 2, 0.12), DARK, 0, 0.45, z);
    cockpit(add, 1.12, -0.3);
    for (const side of [-1, 1]) add(new THREE.SphereGeometry(0.18, 8, 6), LIGHT, side * 0.6, 0.85, 1.22);
    return { wheels: corners(1.02, 0.8, 0.38), top: 1.12, back: -1.3, front: 1.45, seat: [0, 1.05, -0.25], side: [0.99, 0.75, 0, 1.6, 0.55] };
  },
  // Llantotas, la carrocería hasta arriba y un tubo de seguridad.
  monstruo(add) {
    add(new RoundedBoxGeometry(2.3, 0.6, 3.0, 3, 0.2), 'paint', 0, 1.4, 0);
    add(new RoundedBoxGeometry(1.4, 0.3, 2.7, 2, 0.1), DARK, 0, 0.98, 0);
    cockpit(add, 1.7, -0.3);
    for (const side of [-1, 1]) {
      add(new THREE.CylinderGeometry(0.08, 0.08, 1.3, 6), METAL, side * 0.75, 2.3, -0.9);
      add(new THREE.SphereGeometry(0.17, 8, 6), LIGHT, side * 0.6, 1.45, 1.52);
    }
    add(new THREE.CylinderGeometry(0.08, 0.08, 1.6, 6).rotateZ(Math.PI / 2), METAL, 0, 2.95, -0.9);
    return { wheels: corners(1.45, 1.1, 0.8), top: 1.7, back: -1.5, front: 1.6, seat: [0, 1.6, -0.3], side: [1.16, 1.4, 0, 2.4, 0.5] };
  },
  // De la tienda. Un cohete con ruedas: cuerpo largo y redondo, nariz blanca y aletas rojas; el piloto va encima.
  cohete(add) {
    add(new THREE.CylinderGeometry(0.85, 0.85, 3.4, 16).rotateX(Math.PI / 2), 'paint', 0, 0.95, -0.1);
    add(new THREE.ConeGeometry(0.85, 1.4, 16).rotateX(Math.PI / 2), 0xf2f2f2, 0, 0.95, 2.3);
    for (const side of [-1, 1]) add(new THREE.BoxGeometry(0.9, 0.12, 0.9), 0xe53935, side * 1.15, 0.95, -1.4);
    add(new THREE.BoxGeometry(0.12, 0.9, 0.9), 0xe53935, 0, 1.95, -1.4);
    add(new THREE.CylinderGeometry(0.55, 0.7, 0.4, 12).rotateX(Math.PI / 2), METAL, 0, 0.95, -1.95);
    cockpit(add, 1.75, -0.2);
    return { wheels: corners(1.0, 1.2, 0.4), top: 1.8, back: -2.0, front: 3.0, seat: [0, 1.7, -0.3], side: [0.87, 0.95, -0.1, 2.4, 0.55] };
  },
  // Una tina de baño con espuma: el piloto va adentro, bañándose.
  tina(add) {
    add(new RoundedBoxGeometry(2.2, 0.9, 3.2, 3, 0.4), 'paint', 0, 0.95, 0);
    add(new RoundedBoxGeometry(1.75, 0.2, 2.7, 2, 0.1), 0x9fd8ff, 0, 1.33, 0);
    for (const [x, z, r] of [[-0.55, 0.85, 0.3], [0.4, 1.05, 0.24], [0.6, -0.9, 0.32], [-0.6, -0.75, 0.22], [0.05, 1.2, 0.2]]) {
      add(new THREE.SphereGeometry(r, 8, 6), 0xffffff, x, 1.45, z);
    }
    add(new THREE.CylinderGeometry(0.07, 0.07, 0.6, 6), METAL, 0, 1.65, -1.45);
    add(new THREE.CylinderGeometry(0.07, 0.07, 0.5, 6).rotateX(Math.PI / 2), METAL, 0, 1.92, -1.25);
    return { wheels: corners(1.1, 1.1, 0.38), top: 1.4, back: -1.6, front: 1.6, seat: [0, 1.15, -0.3], side: [1.11, 0.95, 0, 2.4, 0.6] };
  },
  // Un pato de hule gigante: el piloto va sentado en su espalda.
  pato(add) {
    add(new THREE.SphereGeometry(1.25, 18, 14).scale(1, 0.75, 1.4), 'paint', 0, 1.0, -0.1);
    add(new THREE.SphereGeometry(0.75, 16, 12), 'paint', 0, 1.95, 1.0);
    add(new THREE.ConeGeometry(0.3, 0.7, 10).rotateX(Math.PI / 2).scale(1.4, 0.6, 1), 0xff8a1e, 0, 1.85, 1.85);
    for (const side of [-1, 1]) {
      add(new THREE.SphereGeometry(0.17, 8, 6), 0xffffff, side * 0.33, 2.13, 1.58);
      add(new THREE.SphereGeometry(0.09, 6, 4), DARK, side * 0.35, 2.15, 1.72);
    }
    add(new THREE.ConeGeometry(0.4, 0.8, 10).rotateX(-1.0), 'paint', 0, 1.45, -1.75);
    return { wheels: corners(1.05, 0.95, 0.36), top: 1.55, back: -1.8, front: 1.9, seat: [0, 1.55, -0.55], side: [1.25, 1.0, -0.1, 2.2, 0.55] };
  },
};

// Asiento bajito (atrás del piloto, para no taparlo desde atrás) y volante (adelante).
function cockpit(add, top, z) {
  add(new RoundedBoxGeometry(1.1, 0.45, 0.28, 2, 0.1), DARK, 0, top + 0.12, z - 0.5);
  add(new THREE.TorusGeometry(0.3, 0.07, 6, 14).rotateX(-0.9), DARK, 0, top + 0.35, z + 0.75);
}

function corners(x, z, radius) {
  return [[-x, z], [x, z], [-x, -z], [x, -z]].map(([wx, wz]) => ({ x: wx, z: wz, radius }));
}

// Un carrito que mira hacia +z. Opciones (todas tienen valor de siempre):
//   type: clasico | bolido | mini | monstruo | cohete | tina | pato
//   wheels: normales | doradas | colores | blancas | fuego | neon
//   extra: aleron | bandera | cuernos | antena | corona | cohetes | globo | nada
//   decal: textura de la calcomanía de los lados (o null)
//   driver: true = el piloto lo pone quien lo usa (en `seat`); si no, lleva una bolita con ojos.
// Devuelve { group, flame, seat } (seat = dónde van los pies del piloto).
export function buildKartModel(color, { type = 'clasico', wheels = 'normales', extra = 'aleron', decal = null, driver = false } = {}) {
  const group = new THREE.Group();
  const parts = [];
  const tint = new THREE.Color();
  const add = (geometry, hex, x, y, z) => {
    const piece = geometry.index ? geometry.toNonIndexed() : geometry;
    piece.deleteAttribute('uv');
    piece.translate(x, y, z);
    tint.setHex(hex === 'paint' ? color : hex);
    const colors = new Float32Array(piece.attributes.position.count * 3);
    for (let i = 0; i < colors.length; i += 3) colors.set([tint.r, tint.g, tint.b], i);
    piece.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    parts.push(piece);
    if (piece !== geometry) geometry.dispose();
    return piece;
  };

  const body = (BODIES[type] ?? BODIES.clasico)(add);
  const look = WHEEL_LOOKS[wheels] ?? WHEEL_LOOKS.normales;
  body.wheels.forEach(({ x, z, radius }, i) => {
    add(new THREE.CylinderGeometry(radius, radius, 0.42, 16).rotateZ(Math.PI / 2), look.tire ?? RAINBOW_TIRES[i], x, radius, z);
    add(new THREE.CylinderGeometry(radius * 0.55, radius * 0.55, 0.46, 10).rotateZ(Math.PI / 2), look.hub, x, radius, z);
  });
  addExtra(extra, add, color, body);
  if (!driver) {
    const head = new THREE.Color(color).lerp(new THREE.Color(0xffffff), 0.25).getHex();
    const [sx, sy, sz] = body.seat;
    add(new THREE.SphereGeometry(0.75, 16, 12), head, sx, sy + 0.65, sz);
  }

  const geometry = mergeGeometries(parts);
  parts.forEach((piece) => piece.dispose());
  group.add(new THREE.Mesh(geometry, shared.bodyMat), new THREE.Mesh(geometry, shared.outlineMat));
  const shadow = new THREE.Mesh(shared.shadow, shared.shadowMat);
  shadow.position.y = 0.06;
  group.add(shadow);
  if (!driver) {
    const [sx, sy, sz] = body.seat;
    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(shared.eye, shared.eyeMat);
      eye.position.set(sx + side * 0.28, sy + 0.8, sz + 0.63);
      const pupil = new THREE.Mesh(shared.pupil, shared.pupilMat);
      pupil.position.set(sx + side * 0.28, sy + 0.8, sz + 0.82);
      group.add(eye, pupil);
    }
  }
  if (decal) addDecals(group, decal, body.side);

  const flame = new THREE.Mesh(shared.flame, shared.flameMat);
  flame.position.set(0, body.top - 0.3, body.back - 0.8);
  flame.visible = false;
  group.add(flame);
  return { group, flame, seat: new THREE.Vector3(...body.seat) };
}

// Calcomanía a los dos lados del kart. La imagen apunta hacia la izquierda (como las llamas que van hacia atrás):
// del lado derecho se voltea para que también apunte hacia atrás.
function addDecals(group, texture, [x, y, z, length, height]) {
  const aspect = texture.image ? texture.image.width / texture.image.height : 3;
  // Un poco más grande que el costado: la imagen trae su borde blanco.
  const w = Math.min(length * 1.1, height * 1.4 * aspect);
  const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true, alphaTest: 0.3, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
  for (const side of [-1, 1]) {
    const plane = new THREE.Mesh(shared.decal, material);
    plane.scale.set(w * -side, w / aspect, 1);
    plane.position.set(side * (x + 0.02), y, z);
    plane.rotation.y = (side * Math.PI) / 2;
    group.add(plane);
  }
}

// El adorno: alerón atrás, bandera, cuernos adelante o antena con bolita.
function addExtra(extra, add, color, body) {
  const { top, back, front } = body;
  if (extra === 'aleron') {
    add(new RoundedBoxGeometry(2.5, 0.14, 0.6, 2, 0.06), 'paint', 0, top + 0.42, back + 0.15);
    for (const side of [-1, 1]) add(new THREE.BoxGeometry(0.12, 0.42, 0.22), DARK, side * 0.7, top + 0.2, back + 0.15);
  } else if (extra === 'bandera') {
    add(new THREE.CylinderGeometry(0.05, 0.05, 2.2, 6), DARK, 0.75, top + 1.1, back + 0.2);
    const cloth = new THREE.Color(color).lerp(new THREE.Color(0xffffff), 0.45).getHex();
    add(new THREE.BoxGeometry(0.05, 0.65, 0.95), cloth, 0.75, top + 1.85, back - 0.3);
  } else if (extra === 'cuernos') {
    for (const side of [-1, 1]) {
      const horn = new THREE.ConeGeometry(0.22, 1, 8);
      horn.rotateZ(-side * 0.35).rotateX(0.6);
      add(horn, 0xfff3d6, side * 0.75, top + 0.35, front - 0.6);
    }
  } else if (extra === 'antena') {
    add(new THREE.CylinderGeometry(0.04, 0.04, 2.4, 6), DARK, -0.75, top + 1.2, back + 0.2);
    add(new THREE.SphereGeometry(0.3, 10, 8), 0xffc93c, -0.75, top + 2.45, back + 0.2);
  } else if (extra === 'corona') {
    // Corona dorada en la trompa.
    const z = front - 0.8;
    add(new THREE.CylinderGeometry(0.45, 0.45, 0.25, 12), 0xffc93c, 0, top + 0.2, z);
    for (let k = 0; k < 5; k += 1) {
      const a = (k / 5) * Math.PI * 2;
      add(new THREE.ConeGeometry(0.12, 0.35, 6), 0xffc93c, Math.cos(a) * 0.4, top + 0.48, z + Math.sin(a) * 0.4);
    }
    add(new THREE.SphereGeometry(0.1, 6, 4), 0xe53935, 0, top + 0.25, z + 0.46);
  } else if (extra === 'cohetes') {
    // Dos cohetes a los lados, atrás.
    for (const side of [-1, 1]) {
      add(new THREE.CylinderGeometry(0.22, 0.22, 1.4, 10).rotateX(Math.PI / 2), 0xf2f2f2, side * 1.35, top - 0.05, back + 0.7);
      add(new THREE.ConeGeometry(0.22, 0.45, 10).rotateX(Math.PI / 2), 0xe53935, side * 1.35, top - 0.05, back + 1.6);
    }
  } else if (extra === 'globo') {
    add(new THREE.CylinderGeometry(0.02, 0.02, 2.4, 4), 0xffffff, 0.8, top + 1.2, back + 0.3);
    add(new THREE.SphereGeometry(0.55, 12, 10).scale(1, 1.2, 1), 0xff5a5f, 0.8, top + 2.8, back + 0.3);
  }
}

// Libera lo que es solo de este carro (las piezas compartidas se quedan): para el taller, que los rehace seguido.
const sharedResources = new Set(Object.values(shared));
export function disposeKartModel(group) {
  group.traverse((object) => {
    if (object.geometry && !sharedResources.has(object.geometry)) object.geometry.dispose();
    for (const material of [].concat(object.material ?? [])) {
      if (sharedResources.has(material)) continue;
      if (material.map?.userData.disposable) material.map.dispose();
      material.dispose();
    }
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
