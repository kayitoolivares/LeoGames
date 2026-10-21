import { sfx } from '../../shared/sound.js';
import { say } from '../../shared/voice.js';
import { paintBlockCharacter } from '../../ui/BlockBody.js';
import { hexToCss, textStyle } from '../../ui/style.js';
import { characterTexture } from '../smash/art.js';

// La presentación del Duelo: la pantalla de "VS" antes de cada pelea (los dos en su pose de entrada) y la de
// victoria (el ganador festejando con su frase).
const DEPTH = 10003;
const VERSUS_MS = 1900;
const PORTRAIT_H = 360;

// Lo que dice cada uno al ganar.
export const QUOTES = {
  tanque: '¡Soy una muralla!',
  rayo: '¡Demasiado rápido para ti!',
  resorte: '¡Boing, boing! ¡Gané!',
  estrella: '¡Brillo más que nadie!',
  ninja: '¡Ni me viste llegar!',
  robot: '¡Victoria calculada!',
  dragon: '¡Grrr! ¡Soy el más fuerte!',
  fantasma: '¡Buuu! ¿Te asusté?',
  dino: '¡Rawr! ¡Gané!',
  gatito: '¡Miau! Ni me despeiné',
  pinguino: '¡Qué fresco!',
  pirata: '¡Arrr! ¡El tesoro es mío!',
  hada: '¡Magia pura!',
  astronauta: '¡Esto estuvo espacial!',
  abeja: '¡Bzzz! ¡Picadito!',
  bombero: '¡Apagué tu fuego!',
  bloquecito: '¡Uno, dos, tres... gané!',
  rey: '¡Jo, jo, jo! ¡Soy el rey!',
};

// La imagen de un peleador en una pose (la primera de `poses` que tenga). Bloquecito se pinta con bloques.
function portrait(scene, fighter, poses, x, y, flip) {
  let key = null;
  if (fighter.blocks) {
    key = `duelo:bloquecito-${fighter.look.form}-${poses[0]}`;
    if (!scene.textures.exists(key)) {
      scene.textures.addCanvas(key, paintBlockCharacter(document.createElement('canvas'), fighter.look.form, { unit: 70, pose: poses[0] === 'entrada' ? 'gana' : poses[0] }));
    }
  } else if (fighter.portraitKey) {
    key = fighter.portraitKey(poses);
  } else if (fighter.look.hasArt) {
    for (const pose of poses) {
      key = characterTexture(scene, fighter.look.character, pose);
      if (key?.endsWith(`-${pose}`)) break;
    }
  }
  if (!key) return scene.add.circle(x, y - PORTRAIT_H / 2, PORTRAIT_H * 0.35, fighter.color).setStrokeStyle(8, 0x1b1530);
  const image = scene.add.image(x, y, key).setOrigin(0.5, 1).setFlipX(flip);
  image.setScale(PORTRAIT_H / image.height);
  return image;
}

// "J1 Tanque  VS  CPU Estrella": cada uno entra por su lado, en su pose de entrada. `onDone` al terminar.
export function showVersus(scene, left, right, onDone) {
  const { width, height } = scene.scale;
  const root = scene.add.container(0, 0).setDepth(DEPTH);
  root.add(scene.add.rectangle(width / 2, height / 2, width, height, 0x14112b, 0.92));
  const sides = [left, right].map((fighter, i) => {
    const dir = i === 0 ? -1 : 1;
    const x = width / 2 + dir * width * 0.25;
    const side = scene.add.container(dir * width * 0.6, 0);
    side.add(scene.add.rectangle(x, height / 2, width / 2 - 20, height - 120, fighter.color, 0.85).setStrokeStyle(8, 0xffffff));
    side.add(portrait(scene, fighter, ['entrada', 'gana', 'normal'], x, height / 2 + 150, i === 1));
    side.add(
      scene.add
        .text(x, height - 105, `${fighter.label} · ${fighter.name}`, textStyle(40, '#ffffff', { fontStyle: 'bold', stroke: '#1b1530', strokeThickness: 8 }))
        .setOrigin(0.5),
    );
    root.add(side);
    scene.tweens.add({ targets: side, x: 0, duration: 380, ease: 'Back.easeOut', delay: i * 120 });
    return side;
  });
  const vs = scene.add.text(width / 2, height / 2 - 20, 'VS', textStyle(130, '#ffd84d', { fontStyle: 'bold', stroke: '#1b1530', strokeThickness: 14 })).setOrigin(0.5).setScale(0);
  root.add(vs);
  scene.tweens.add({ targets: vs, scale: 1, duration: 300, delay: 450, ease: 'Back.easeOut', onStart: () => sfx.confirm() });
  say(`¡${left.name} contra ${right.name}!`);
  scene.time.delayedCall(VERSUS_MS, () => {
    scene.tweens.add({ targets: root, alpha: 0, duration: 250, onComplete: () => root.destroy() });
    onDone?.();
  });
  return { root, sides };
}

// El ganador grandote festejando, con su frase (se queda hasta que se quita con `.destroy()`).
export function showVictory(scene, winner, title, subtitle) {
  const { width, height } = scene.scale;
  const root = scene.add.container(0, 0).setDepth(DEPTH);
  root.add(scene.add.rectangle(width / 2, height / 2, width, height, 0x14112b, 0.55));
  const panel = scene.add.container(-width, 0);
  panel.add(scene.add.rectangle(330, height / 2, 520, height - 140, winner.color, 0.9).setStrokeStyle(8, 0xffffff));
  panel.add(portrait(scene, winner, ['gana', 'salto', 'normal'], 330, height - 110, false));
  root.add(panel);
  scene.tweens.add({ targets: panel, x: 0, duration: 400, ease: 'Back.easeOut' });
  const quote = QUOTES[winner.character] ?? '¡Gané!';
  const style = { fontStyle: 'bold', stroke: '#1b1530', strokeThickness: 10, align: 'center', wordWrap: { width: 640 } };
  root.add(scene.add.text(930, 190, title, textStyle(64, hexToCss(winner.color), style)).setOrigin(0.5));
  root.add(scene.add.text(930, 300, `«${quote}»`, textStyle(38, '#ffffff', { ...style, strokeThickness: 8 })).setOrigin(0.5));
  root.add(scene.add.text(930, 470, subtitle, textStyle(24, '#ffffff', { ...style, strokeThickness: 6 })).setOrigin(0.5));
  scene.time.delayedCall(500, () => say(quote));
  return root;
}
