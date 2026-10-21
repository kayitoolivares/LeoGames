import { sfx } from '../../shared/sound.js';
import { say } from '../../shared/voice.js';
import { textStyle } from '../../ui/style.js';

// La Aventura de Bolitas Bros: 6 niveles seguidos (los jugadores juntos, de un mismo equipo). Si pierden un nivel lo
// vuelven a intentar; al terminar el último se gana la calcomanía (y Dragonzote para escoger).
//   mode: cómo se gana el nivel (vidas: sacar a todos los de la compu; blancos; subida: llegar a la bandera; jefe).
//   cpus: los personajes de la compu (rivales); stocks: sus vidas; giant: la compu es gigante; boss: el jefe gigante.
export const ADVENTURE = [
  { title: 'Pelea en el castillo', info: 'Gánale a Ninja', mode: 'vidas', stage: 'castillo', cpus: ['ninja'], level: 'facil', stocks: 2 },
  { title: 'Dianas de la selva', info: 'Rompe las 10 dianas', mode: 'blancos', stage: 'selva' },
  { title: 'La torre de nubes', info: 'Sube hasta la bandera', mode: 'subida', stage: 'torre' },
  { title: 'La pandilla de la ciudad', info: 'Gánales a Pirata y a Robot', mode: 'vidas', stage: 'ciudad', cpus: ['pirata', 'robot'], level: 'normal', stocks: 2 },
  { title: 'Tanque gigante', info: 'Gánale al gigante en el pastel', mode: 'vidas', stage: 'pastel', cpus: ['tanque'], giant: true, level: 'normal', stocks: 2 },
  { title: 'Dragonzote', info: 'El jefe final, en su volcán', mode: 'jefe', stage: 'volcan', boss: 'dragonzote' },
];
const MAP_MS = 2600;
const ICONS = ['🥊', '🎯', '☁️', '🌃', '🎂', '🐉'];

// El mapa antes de cada nivel: los 6 en fila (los pasados con palomita, el de ahorita brillando) y qué hay que hacer.
export function showAdventureMap(scene, layer, index, onDone) {
  const { width, height } = scene.scale;
  const spec = ADVENTURE[index];
  const root = scene.add.container(0, 0);
  layer.add(root);
  const style = { fontStyle: 'bold', stroke: '#1b1530', strokeThickness: 8, align: 'center' };
  root.add(scene.add.rectangle(width / 2, height / 2, width, height, 0x14112b, 0.92));
  root.add(scene.add.text(width / 2, 110, `🗺️ Aventura · Nivel ${index + 1} de ${ADVENTURE.length}`, textStyle(44, '#ffd84d', style)).setOrigin(0.5));
  const gap = 170;
  const y = height / 2 - 20;
  const left = width / 2 - ((ADVENTURE.length - 1) * gap) / 2;
  root.add(scene.add.rectangle(width / 2, y, (ADVENTURE.length - 1) * gap, 10, 0x8a86b8));
  let pulse = null;
  ADVENTURE.forEach((_, i) => {
    const x = left + i * gap;
    const done = i < index;
    const now = i === index;
    const dot = scene.add.circle(x, y, now ? 54 : 44, done ? 0x4cd97b : now ? 0xffd84d : 0x3a355e).setStrokeStyle(6, 0xffffff);
    root.add(dot);
    root.add(scene.add.text(x, y, done ? '✔' : ICONS[i], textStyle(now ? 46 : 36, '#ffffff', { fontStyle: 'bold' })).setOrigin(0.5));
    if (now) pulse = scene.tweens.add({ targets: dot, scale: 1.15, duration: 380, yoyo: true, repeat: -1 });
  });
  root.add(scene.add.text(width / 2, y + 120, spec.title, textStyle(40, '#ffffff', style)).setOrigin(0.5));
  root.add(scene.add.text(width / 2, y + 172, spec.info, textStyle(26, '#ffd84d', { ...style, strokeThickness: 6 })).setOrigin(0.5));
  say(`${spec.title}. ${spec.info}`);
  sfx.confirm();
  scene.time.delayedCall(MAP_MS, () => {
    scene.tweens.add({
      targets: root,
      alpha: 0,
      duration: 250,
      onComplete: () => {
        pulse?.remove();
        root.destroy();
      },
    });
    onDone?.();
  });
}
