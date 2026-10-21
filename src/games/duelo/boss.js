import manifest from './art.json';

// Los jefes del Duelo: no son de Bolitas Bros, traen sus propios datos. Son más grandes, pegan más fuerte y
// tienen más vida. Sus dibujos son de Gemini (duelo/jefe/<jefe>-<pose>.png); si todavía no están, se ven como
// una bolita de su color (el Rey Bolón, con corona).
//   rey         el Rey Bolón, jefe del Torneo: su especial es un salto que cae aplastando.
//   dragonzote  jefe secreto: echa llamaradas grandes. Pelea en su guarida del volcán.
//   robotote    jefe secreto: lanza su puño cohete. Pelea en su fábrica.
export const BOSSES = {
  rey: {
    name: 'Rey Bolón',
    superName: 'Súper Rey Bolón',
    radius: 58,
    power: 1.3,
    run: 290,
    jump: 700,
    gravity: 1.1,
    health: 160,
    color: 0x8158d8,
    arena: 'trono',
    crown: true,
    special: { kind: 'rise', name: 'Salto aplastante', startup: 220, speed: 240, lift: 950, damage: 13, push: 520, launch: true, stomp: true },
  },
  dragonzote: {
    name: 'Dragonzote',
    superName: 'Dragonzote Furioso',
    radius: 60,
    power: 1.3,
    run: 270,
    jump: 760,
    gravity: 0.95,
    health: 170,
    color: 0xe53935,
    arena: 'guarida',
    special: { kind: 'shot', name: 'Llamarada', shape: 'fire', startup: 220, speed: 430, damage: 13, push: 380, big: 1.6 },
  },
  robotote: {
    name: 'Robotote',
    superName: 'Robotote Turbo',
    radius: 60,
    power: 1.35,
    run: 260,
    jump: 650,
    gravity: 1.15,
    health: 180,
    color: 0x5a7ab0,
    arena: 'fabrica',
    special: { kind: 'shot', name: 'Puño cohete', shape: 'fist', startup: 200, speed: 720, damage: 13, push: 480, big: 1.4 },
  },
};
export const BOSS_KEYS = Object.keys(BOSSES);
// El jefe del torneo.
export const BOSS = 'rey';
export const BOSS_STATS = BOSSES.rey;
const POSES = ['normal', 'golpe', 'salto', 'dolor'];

export function isBoss(character) {
  return Object.hasOwn(BOSSES, character);
}

// Sus imágenes se cargan con los nombres de las de los personajes (smash:<jefe>-<pose>), así se ven igual que ellos.
export function loadBossArt(scene) {
  for (const boss of BOSS_KEYS) {
    for (const pose of POSES) {
      const key = `smash:${boss}-${pose}`;
      if (manifest.jefe?.includes(`${boss}-${pose}`) && !scene.textures.exists(key)) scene.load.image(key, `duelo/jefe/${boss}-${pose}.png`);
    }
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
