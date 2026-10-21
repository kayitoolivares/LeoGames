import { sfx } from '../../shared/sound.js';
import { say } from '../../shared/voice.js';
import { paintBlockCharacter } from '../../ui/BlockBody.js';
import { hexToCss, textStyle } from '../../ui/style.js';
import { characterTexture } from './art.js';
import { characterInfo } from './characters.js';

// Presentación y resultados de Bolitas Bros: antes de pelear, todos en fila en su pose de entrada; al final, un podio
// con el lugar de cada quien y lo que hizo (a cuántos sacó, cuántas veces se cayó, cuánto pegó).
const LINEUP_MS = 1800;
const PORTRAIT_H = 230;

function portrait(scene, fighter, poses, x, y, height = PORTRAIT_H) {
  let key = null;
  if (fighter.blocks) {
    key = `smash:bloquecito-${fighter.look.form}-gana`;
    if (!scene.textures.exists(key)) scene.textures.addCanvas(key, paintBlockCharacter(document.createElement('canvas'), fighter.look.form, { unit: 60, pose: 'gana' }));
  } else if (fighter.image) {
    for (const pose of poses) {
      key = characterTexture(scene, fighter.characterKey, pose);
      if (key?.endsWith(`-${pose}`)) break;
    }
  }
  if (!key) return scene.add.circle(x, y - height / 2, height * 0.32, fighter.color).setStrokeStyle(6, 0x1b1530);
  const image = scene.add.image(x, y, key).setOrigin(0.5, 1);
  image.setScale(height / image.height);
  return image;
}

function nameOf(fighter) {
  return fighter.bossName ?? characterInfo(fighter.characterKey)?.name ?? '';
}

// Todos en fila, cada uno en su color, entrando uno tras otro. `layer`: el contenedor de la pantalla (sin zoom).
export function showLineup(scene, fighters, layer, onDone) {
  const { width, height } = scene.scale;
  const root = scene.add.container(0, 0);
  layer.add(root);
  root.add(scene.add.rectangle(width / 2, height / 2, width, height, 0x14112b, 0.9));
  const slot = Math.min(300, (width - 80) / fighters.length);
  fighters.forEach((fighter, i) => {
    const x = width / 2 + (i - (fighters.length - 1) / 2) * slot;
    const card = scene.add.container(0, height);
    card.add(scene.add.rectangle(x, height / 2, slot - 20, height - 200, fighter.color, 0.85).setStrokeStyle(6, 0xffffff));
    card.add(portrait(scene, fighter, ['entrada', 'gana', 'normal'], x, height / 2 + 140));
    card.add(scene.add.text(x, height / 2 + 175, fighter.label, textStyle(30, '#ffffff', { fontStyle: 'bold', stroke: '#1b1530', strokeThickness: 7 })).setOrigin(0.5));
    card.add(scene.add.text(x, height / 2 + 212, nameOf(fighter), textStyle(24, '#ffffff', { fontStyle: 'bold', stroke: '#1b1530', strokeThickness: 6 })).setOrigin(0.5));
    root.add(card);
    scene.tweens.add({ targets: card, y: 0, duration: 380, delay: i * 140, ease: 'Back.easeOut', onStart: () => sfx.select() });
  });
  say(fighters.map(nameOf).join(', '));
  scene.time.delayedCall(LINEUP_MS, () => {
    scene.tweens.add({ targets: root, alpha: 0, duration: 250, onComplete: () => root.destroy() });
    onDone?.();
  });
}

// Lo que se dice de cada quien en el podio (los modos con puntos o dianas mandan el suyo).
function defaultDescribe(fighter) {
  const r = fighter.record;
  if (fighter.isBoss) return [`💥 sacó a ${r.kos}`];
  return [`💥 sacó a ${r.kos}  ·  😵 se cayó ${r.falls}`, `👊 pegó ${Math.round(r.dealt)}%`];
}

// Los premios del final: quién pegó más veces, el golpe más fuerte (en "km/h" de mentiritas), quién se cayó más,
// quién hizo más paradas perfectas y quién agarró más objetos. Solo los que alguien sí hizo.
export function awards(fighters) {
  const top = (key) => {
    let best = null;
    for (const f of fighters) if ((f.record[key] ?? 0) > 0 && (!best || f.record[key] > best.record[key])) best = f;
    return best;
  };
  const list = [];
  const hits = top('hits');
  if (hits) list.push(`👊 Más golpes: ${hits.label} (${hits.record.hits})`);
  const strong = top('best');
  if (strong) list.push(`💥 Golpe más fuerte: ${strong.label} (${Math.round(strong.record.best / 10)} km/h)`);
  const falls = top('falls');
  if (falls) list.push(`😵 Más caídas: ${falls.label} (${falls.record.falls})`);
  const perfect = top('perfects');
  if (perfect) list.push(`✨ Paradas perfectas: ${perfect.label} (${perfect.record.perfects})`);
  const items = top('items');
  if (items) list.push(`🎁 Más objetos: ${items.label} (${items.record.items})`);
  return list;
}

// El podio: `ranking` en orden (el primero ganó). `title` arriba, `notes` (los premios) abajo del título y `hint`
// hasta abajo. `together`: ganaron todos juntos (todos salen festejando). Devuelve el contenedor.
export function showResults(scene, ranking, layer, title, hint, describe = defaultDescribe, notes = [], together = false) {
  const { width, height } = scene.scale;
  const root = scene.add.container(0, 0);
  layer.add(root);
  root.add(scene.add.rectangle(width / 2, height / 2, width, height, 0x14112b, 0.8));
  root.add(scene.add.text(width / 2, 70, title, textStyle(56, hexToCss(ranking[0]?.color ?? 0xffd84d), { fontStyle: 'bold', stroke: '#1b1530', strokeThickness: 10 })).setOrigin(0.5));
  if (notes.length) {
    const style = textStyle(19, '#ffffff', { fontStyle: 'bold', align: 'center', stroke: '#1b1530', strokeThickness: 5, lineSpacing: 6, wordWrap: { width: width - 100 } });
    root.add(scene.add.text(width / 2, 150, notes.join('     '), style).setOrigin(0.5, 0.5));
  }
  // Escalones: el 1° en medio y más alto, luego 2°, 3° y 4°.
  const order = [1, 0, 2, 3].filter((k) => k < ranking.length);
  const steps = [230, 160, 110, 70];
  const slot = Math.min(300, (width - 80) / ranking.length);
  order.forEach((place, i) => {
    const fighter = ranking[place];
    const x = width / 2 + (i - (order.length - 1) / 2) * slot;
    const floor = height - 130;
    const step = steps[place];
    root.add(scene.add.rectangle(x, floor - step / 2, slot - 24, step, fighter.color).setStrokeStyle(5, 0xffffff));
    root.add(scene.add.text(x, floor - step / 2, `${place + 1}°`, textStyle(44, '#ffffff', { fontStyle: 'bold', stroke: '#1b1530', strokeThickness: 8 })).setOrigin(0.5));
    let pose = place === 0 ? ['gana', 'salto', 'normal'] : place === ranking.length - 1 ? ['dolor', 'normal'] : ['normal'];
    if (together) pose = ['gana', 'salto', 'normal'];
    root.add(portrait(scene, fighter, pose, x, floor - step, place === 0 ? 210 : 170));
    const lines = [`${fighter.label} · ${nameOf(fighter)}`, ...describe(fighter).filter(Boolean)];
    root.add(scene.add.text(x, floor + 50, lines.join('\n'), textStyle(17, '#ffffff', { fontStyle: 'bold', align: 'center', stroke: '#1b1530', strokeThickness: 5, lineSpacing: 2 })).setOrigin(0.5));
  });
  root.add(scene.add.text(width / 2, height - 22, hint, textStyle(20, '#ffd84d', { fontStyle: 'bold', stroke: '#1b1530', strokeThickness: 5 })).setOrigin(0.5));
  return root;
}
