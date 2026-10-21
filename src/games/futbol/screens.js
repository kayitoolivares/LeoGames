import { say } from '../../shared/voice.js';
import { paintBlockCharacter } from '../../ui/BlockBody.js';
import { COLORS, TEXT, hexToCss, textStyle } from '../../ui/style.js';
import { characterTexture } from '../smash/art.js';
import { CHARACTERS } from '../smash/characters.js';
import manifest from './art.json';
import { UNIFORMS } from './field.js';

// Las pantallas del fútbol: el camino de la Copa (3 partidos, cada uno más difícil) y el final del partido
// (quién ganó, el mejor jugador y lo que hizo cada quien).
const TROPHY = 'futbol:copa-futbol';
const PORTRAIT_H = 300;

export const COPA_ROUNDS = [
  { name: 'Cuartos de final', level: 'facil' },
  { name: 'Semifinal', level: 'normal' },
  { name: 'La gran final', level: 'dificil' },
];

export function loadScreenArt(scene) {
  if (manifest.copas?.includes('copa-futbol') && !scene.textures.exists(TROPHY)) scene.load.image(TROPHY, 'futbol/copas/copa-futbol.png');
}

// Los 3 rivales de la Copa: equipos con otro uniforme que el tuyo.
export function copaRivals(ours) {
  return UNIFORMS.map((_, i) => i).filter((i) => i !== ours).slice(0, COPA_ROUNDS.length);
}

function trophy(scene, x, y, height) {
  if (!scene.textures.exists(TROPHY)) return scene.add.text(x, y, '🏆', textStyle(Math.round(height * 0.8), '#ffffff')).setOrigin(0.5);
  const cup = scene.add.image(x, y, TROPHY);
  return cup.setScale(height / cup.height);
}

// El camino de la Copa: los 3 partidos, palomita en los que ya ganaste y el que sigue resaltado.
export function showCopaRoad(scene, round, rivals, ours, depth) {
  const { width, height } = scene.scale;
  const root = scene.add.container(0, 0).setDepth(depth);
  root.add(scene.add.rectangle(width / 2, height / 2, width, height, 0x14112b, 0.88));
  root.add(scene.add.text(width / 2, 70, 'Copa de fútbol', textStyle(54, TEXT.normal, { fontStyle: 'bold' })).setOrigin(0.5));
  const cup = trophy(scene, width / 2, 190, 150);
  root.add(cup);
  scene.tweens.add({ targets: cup, angle: { from: -5, to: 5 }, duration: 800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  COPA_ROUNDS.forEach((stage, i) => {
    const y = 330 + i * 84;
    const rival = UNIFORMS[rivals[i]];
    const current = i === round;
    const bg = scene.add.rectangle(width / 2, y, 720, 70, current ? COLORS.panel : 0x1b1730).setRounded(18);
    bg.setStrokeStyle(current ? 5 : 2, current ? COLORS.accent : COLORS.panelBorder);
    const mark = i < round ? '✅' : current ? '⚽' : '🔒';
    const level = { facil: 'Fácil', normal: 'Normal', dificil: 'Difícil' }[stage.level];
    root.add([
      bg,
      scene.add.text(width / 2 - 330, y, `${mark}  ${stage.name}`, textStyle(28, current ? TEXT.normal : TEXT.muted, { fontStyle: 'bold' })).setOrigin(0, 0.5),
      scene.add.circle(width / 2 + 120, y, 18, rival.color).setStrokeStyle(3, 0x1b1530),
      scene.add.text(width / 2 + 150, y, `${rival.name} · ${level}`, textStyle(26, hexToCss(rival.color), { fontStyle: 'bold', stroke: '#1b1530', strokeThickness: 5 })).setOrigin(0, 0.5),
    ]);
  });
  const us = UNIFORMS[ours];
  root.add(scene.add.text(width / 2, 590, `Tu equipo: ${us.name}`, textStyle(28, hexToCss(us.color), { fontStyle: 'bold', stroke: '#1b1530', strokeThickness: 6 })).setOrigin(0.5));
  root.add(scene.add.text(width / 2, 660, 'A = ¡a jugar!   ·   B = salir de la Copa', textStyle(24, TEXT.accent)).setOrigin(0.5));
  say(`${COPA_ROUNDS[round].name}: contra los ${UNIFORMS[rivals[round]].name}`);
  return root;
}

const nameOf = (player) => `${player.label} · ${CHARACTERS[player.character]?.name ?? ''}`;

// La foto del jugador festejando (Bloquecito se pinta con bloques).
function portrait(scene, player, x, y) {
  let key = null;
  if (player.look.body) {
    key = `futbol:bloquecito-${player.look.form}-gana`;
    if (!scene.textures.exists(key)) scene.textures.addCanvas(key, paintBlockCharacter(document.createElement('canvas'), player.look.form, { unit: 70, pose: 'gana' }));
  } else if (player.look.hasArt) {
    key = characterTexture(scene, player.character, 'gana');
  }
  if (!key) return scene.add.circle(x, y - PORTRAIT_H / 2, PORTRAIT_H * 0.35, player.color).setStrokeStyle(8, 0x1b1530);
  const image = scene.add.image(x, y, key).setOrigin(0.5, 1);
  return image.setScale(PORTRAIT_H / image.height);
}

// Qué tanto ayudó cada quien: los goles valen más, luego las atajadas, los robos y los tiros.
function mvpScore(player) {
  const { goals, saves, steals, shots } = player.stats;
  return goals * 5 + saves * 3 + steals * 2 + shots;
}

// Final del partido: el mejor jugador en grande, quién ganó y la tabla de cada quien.
// `trophy`: ganaron la Copa (sale la copa brillando). `hint`: qué botones usar.
export function showMatchEnd(scene, { title, color, score, players, cup = false, hint, depth }) {
  const { width, height } = scene.scale;
  const root = scene.add.container(0, 0).setDepth(depth);
  root.add(scene.add.rectangle(width / 2, height / 2, width, height, 0x14112b, 0.7));
  const mvp = [...players].sort((a, b) => mvpScore(b) - mvpScore(a))[0];
  const panel = scene.add.container(-width, 0);
  panel.add(scene.add.rectangle(250, height / 2 + 10, 400, height - 120, mvp.color, 0.9).setStrokeStyle(8, 0xffffff));
  panel.add(portrait(scene, mvp, 250, height - 130));
  panel.add(scene.add.text(250, 110, '⭐ Mejor jugador', textStyle(30, '#ffffff', { fontStyle: 'bold', stroke: '#1b1530', strokeThickness: 7 })).setOrigin(0.5));
  panel.add(scene.add.text(250, height - 100, nameOf(mvp), textStyle(36, '#ffffff', { fontStyle: 'bold', stroke: '#1b1530', strokeThickness: 8 })).setOrigin(0.5));
  root.add(panel);
  scene.tweens.add({ targets: panel, x: 0, duration: 400, ease: 'Back.easeOut' });
  if (cup) {
    const image = trophy(scene, 250, 205, 130);
    panel.add(image);
    scene.tweens.add({ targets: image, y: 195, angle: { from: -6, to: 6 }, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }
  const style = { fontStyle: 'bold', stroke: '#1b1530', strokeThickness: 9, align: 'center', wordWrap: { width: 760 } };
  root.add(scene.add.text(860, 110, title, textStyle(52, hexToCss(color), style)).setOrigin(0.5));
  root.add(scene.add.text(860, 185, score, textStyle(56, '#ffffff', style)).setOrigin(0.5));
  // La tabla: ⚽ goles · 🦶 tiros · 🛡️ robos · 🧤 atajadas.
  root.add(scene.add.text(860, 250, '⚽ goles   🦶 tiros   🛡️ robos   🧤 atajadas', textStyle(20, TEXT.muted)).setOrigin(0.5));
  players.forEach((p, i) => {
    const y = 296 + i * 46;
    const { goals, shots, steals, saves } = p.stats;
    const name = `${p === mvp ? '⭐ ' : ''}${nameOf(p)}`;
    root.add(scene.add.text(590, y, name, textStyle(26, hexToCss(p.color), { fontStyle: 'bold', stroke: '#1b1530', strokeThickness: 5 })).setOrigin(0, 0.5));
    root.add(scene.add.text(1150, y, `⚽ ${goals}   🦶 ${shots}   🛡️ ${steals}   🧤 ${saves}`, textStyle(24, '#ffffff', { stroke: '#1b1530', strokeThickness: 4 })).setOrigin(1, 0.5));
  });
  root.add(scene.add.text(860, height - 50, hint, textStyle(22, TEXT.accent, { align: 'center', wordWrap: { width: 760 } })).setOrigin(0.5));
  scene.time.delayedCall(1600, () => say(`Mejor jugador: ${nameOf(mvp)}`, { interrupt: false }));
  return root;
}
