import * as THREE from 'three';
import manifest from './art.json';

// Los dibujos de la Guerra de pintura (de Gemini, ver npm run arte): los lanzadores para la tinta de cada jugador
// (pintura/objetos) y adornos grandes alrededor de cada arena (pintura/adornos). Si falta un dibujo, el juego usa un
// emoji o figuras. Los paisajes de fondo son los de Karts locos.

// El lanzador como imagen para el HTML (o su emoji si no hay dibujo).
export function pinturaIcon(key, emoji) {
  return (manifest.objetos ?? []).includes(key) ? `<img src="pintura/objetos/${key}.png">` : `<span class="emoji">${emoji}</span>`;
}

// Adornos que miran siempre a la cámara, afuera de la barda. Devuelve un grupo (vacío si no hay dibujos).
export function arenaDecor(names, halfW, halfD) {
  const group = new THREE.Group();
  const available = names.filter((name) => (manifest.adornos ?? []).includes(name));
  if (!available.length) return group;
  const loader = new THREE.TextureLoader();
  const spots = [
    [-halfW - 7, -halfD * 0.5],
    [halfW + 7, halfD * 0.5],
    [-halfW - 7, halfD * 0.4],
    [halfW + 7, -halfD * 0.4],
    [-halfW * 0.5, -halfD - 8],
    [halfW * 0.5, halfD + 8],
    [halfW * 0.55, -halfD - 8],
    [-halfW * 0.55, halfD + 8],
  ];
  spots.forEach(([x, z], i) => {
    const name = available[i % available.length];
    const material = new THREE.SpriteMaterial({ alphaTest: 0.4 });
    const sprite = new THREE.Sprite(material);
    sprite.center.set(0.5, 0);
    sprite.position.set(x, 0, z);
    sprite.scale.set(7, 7, 1);
    material.map = loader.load(`pintura/adornos/${name}.png`, (texture) => sprite.scale.set((7 * texture.image.width) / texture.image.height, 7, 1));
    material.map.colorSpace = THREE.SRGBColorSpace;
    group.add(sprite);
  });
  return group;
}
