import * as THREE from 'three';

export const WIDTH = 1280;
export const HEIGHT = 720;

// Lienzo 3D de 1280x720 encima de Phaser, escalado para llenar la pantalla igual que el resto del juego.
// `destroy(scene)` libera todo lo que se subió a la tarjeta de video: en el Xbox la memoria es poca.
export function createStage(parent) {
  const root = document.createElement('div');
  Object.assign(root.style, { position: 'fixed', inset: '0', background: '#14112b', overflow: 'hidden', zIndex: '10' });
  const stage = document.createElement('div');
  Object.assign(stage.style, { position: 'absolute', left: '50%', top: '50%', width: `${WIDTH}px`, height: `${HEIGHT}px` });
  root.append(stage);
  parent.append(root);

  const fit = () => {
    const scale = Math.min(window.innerWidth / WIDTH, window.innerHeight / HEIGHT);
    stage.style.transform = `translate(-50%, -50%) scale(${scale})`;
  };
  window.addEventListener('resize', fit);
  fit();

  const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(1);
  renderer.setSize(WIDTH, HEIGHT);
  stage.append(renderer.domElement);

  return {
    stage,
    renderer,
    destroy(scene) {
      window.removeEventListener('resize', fit);
      const geometries = new Set();
      const materials = new Set();
      scene.traverse((object) => {
        if (object.geometry) geometries.add(object.geometry);
        for (const material of [].concat(object.material ?? [])) materials.add(material);
      });
      geometries.forEach((geometry) => geometry.dispose());
      materials.forEach((material) => {
        material.map?.dispose();
        material.dispose();
      });
      renderer.dispose();
      renderer.forceContextLoss();
      root.remove();
    },
  };
}
