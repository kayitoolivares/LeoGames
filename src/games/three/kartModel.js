import * as THREE from 'three';

// Piezas que comparten todos los carros (solo cambia el color de cada uno).
const shared = {
  wheel: new THREE.CylinderGeometry(0.45, 0.45, 0.4, 12).rotateZ(Math.PI / 2),
  wheelMat: new THREE.MeshLambertMaterial({ color: 0x222222 }),
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

// Un carrito con piloto (una bolita con ojos, como en el menú). Mira hacia +z.
export function buildKartModel(color) {
  const group = new THREE.Group();
  const paint = new THREE.MeshLambertMaterial({ color });
  const add = (geometry, material, x, y, z) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    group.add(mesh);
    return mesh;
  };

  add(shared.shadow, shared.shadowMat, 0, 0.06, 0);
  add(new THREE.BoxGeometry(2.2, 0.6, 3.2), paint, 0, 0.65, 0);
  add(new THREE.BoxGeometry(1.6, 0.4, 0.8), paint, 0, 0.55, 1.9);
  add(new THREE.BoxGeometry(2.4, 0.15, 0.5), paint, 0, 1.25, -1.5);
  for (const [x, z] of [[-1.15, 1.1], [1.15, 1.1], [-1.15, -1.1], [1.15, -1.1]]) add(shared.wheel, shared.wheelMat, x, 0.45, z);

  const head = new THREE.Color(color).lerp(new THREE.Color(0xffffff), 0.25);
  add(new THREE.SphereGeometry(0.75, 16, 12), new THREE.MeshLambertMaterial({ color: head }), 0, 1.55, -0.3);
  for (const side of [-1, 1]) {
    add(shared.eye, shared.eyeMat, side * 0.28, 1.7, 0.33);
    add(shared.pupil, shared.pupilMat, side * 0.28, 1.7, 0.52);
  }

  const flame = add(shared.flame, shared.flameMat, 0, 0.65, -2.3);
  flame.visible = false;
  return { group, flame };
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
