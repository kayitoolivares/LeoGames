import manifest from './art.json';

// El jefe del Torneo: el Rey Bolón, una bolita gigante morada con corona y capa. Es más grande, pega más
// fuerte y tiene más vida; su especial es un salto que cae aplastando. Su dibujo es de Gemini
// (duelo/jefe/rey-<pose>.png); si todavía no está, se ve como una bolita morada con corona.
export const BOSS = 'rey';
export const BOSS_STATS = {
  name: 'Rey Bolón',
  superName: 'Súper Rey Bolón',
  radius: 58,
  power: 1.3,
  run: 290,
  jump: 700,
  gravity: 1.1,
  health: 160,
  color: 0x8158d8,
  special: { kind: 'rise', name: 'Salto aplastante', startup: 220, speed: 240, lift: 950, damage: 13, push: 520, launch: true, stomp: true },
};
const POSES = ['normal', 'golpe', 'salto', 'dolor'];

// Sus imágenes se cargan con los nombres de las de los personajes (smash:rey-<pose>), así se ve igual que ellos.
export function loadBossArt(scene) {
  for (const pose of POSES) {
    const key = `smash:${BOSS}-${pose}`;
    if (manifest.jefe?.includes(`${BOSS}-${pose}`) && !scene.textures.exists(key)) scene.load.image(key, `duelo/jefe/${BOSS}-${pose}.png`);
  }
}

// Sin dibujo: corona dorada encima de la bolita.
export function addCrown(scene, blob) {
  const r = blob.radius;
  const crown = scene.add.container(0, -r * 0.95);
  crown.add(scene.add.rectangle(0, 0, r * 1.1, r * 0.3, 0xffc93c).setStrokeStyle(4, 0x1b1530));
  for (const x of [-0.45, 0, 0.45]) {
    crown.add(scene.add.triangle(x * r, -r * 0.25, -r * 0.14, r * 0.1, r * 0.14, r * 0.1, 0, -r * 0.22, 0xffc93c).setStrokeStyle(4, 0x1b1530));
    crown.add(scene.add.circle(x * r, -r * 0.42, r * 0.07, 0xff5a5f));
  }
  blob.figure.add(crown);
}
