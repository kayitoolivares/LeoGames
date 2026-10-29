import { settings } from '../../shared/settings.js';
import { UNLOCKS, rewards } from '../../shared/rewards.js';
import { say } from '../../shared/voice.js';
import { COLORS, TEXT, hexToCss, textStyle } from '../../ui/style.js';
import { monsterTexture } from './art.js';
import { baseRecord } from './base.js';
import { coinBank } from './coins.js';
import { MAX_LEVEL } from './levels.js';
import { brawlRecords, formatTime, medals, rescues } from './records.js';
import { NEST_ROUNDS, WORLDS } from './worlds.js';

// Las pantallas de Pelea en equipo: el mapa de mundos, la presentación de cada jefe y los resultados con medallas.
// Todo va pegado a la pantalla (no se mueve con el nivel).
const DEPTH = 10002;
const STARS_KEY = 'brawlStars';
const RECORD_KEY = 'brawlEndless';

// Estrellas de cada mundo (0 a 3): ganarlo, que nadie se cayera y hacerlo en menos de 4 minutos.
export const worldStars = {
  get(index) {
    return settings.get(STARS_KEY, {})[index] ?? 0;
  },
  save(index, stars) {
    const all = settings.get(STARS_KEY, {});
    if ((all[index] ?? 0) >= stars) return;
    settings.set(STARS_KEY, { ...all, [index]: stars });
  },
};
export const STAR_TIME_MS = 240000;

export const endlessRecord = {
  get() {
    return settings.get(RECORD_KEY, 0);
  },
  // Devuelve true si es récord nuevo.
  save(waves) {
    if (waves <= this.get()) return false;
    settings.set(RECORD_KEY, waves);
    return true;
  },
};

// Los lugares del mapa: los mundos en un caminito de zigzag y, abajo, los modos: Defiende el nido, Defiende la base,
// los jefes en serie y el sin fin. ◀ ▶ van en ese orden (de la Pradera, ◀ da la vuelta al sin fin) y ▲ ▼ brincan
// entre el camino y los modos.
export const MAP_SPOTS = [...WORLDS.map((world, i) => ({ world: i })), { nest: true }, { base: true }, { bossRush: true }, { endless: true }];
const MODE_COUNT = MAP_SPOTS.length - WORLDS.length;
const WORLD_Y = [245, 345];
const MODE_Y = 515;
const MODE_GAP = 200;
const POSITIONS = MAP_SPOTS.map((spot, i) => {
  if (i < WORLDS.length) return [80 + i * ((1280 - 160) / (WORLDS.length - 1)), WORLD_Y[i % 2]];
  const k = i - WORLDS.length;
  return [640 + (k - (MODE_COUNT - 1) / 2) * MODE_GAP, MODE_Y];
});
const NODE_R = 44;
const MODE_R = 40;

// Los mundos ya ganados: sus jefes son los de los jefes en serie (que se abren al ganar el primero).
export function beatenWorlds() {
  return WORLDS.filter((world, i) => worldStars.get(i) > 0);
}

function spotOpen(spot) {
  if (spot.endless || spot.nest || spot.base) return true;
  if (spot.bossRush) return beatenWorlds().length > 0;
  return rewards.unlocked(WORLDS[spot.world].unlock);
}

// Cómo se ve y qué se dice de cada lugar del mapa.
function spotInfo(spot, open) {
  if (spot.endless) return { emoji: '♾️', name: 'Sin fin', text: 'Rondas sin fin, cada vez más difíciles. ¿Cuántas aguantan?' };
  if (spot.nest) return { emoji: '🥚', name: 'El nido', text: `Defiendan el nido: ${NEST_ROUNDS} rondas sin que los monstruos se lleven los huevos` };
  if (spot.base) return { emoji: '🏰', name: 'La base', text: 'Defiendan la base: oleadas sin fin. Entre oleadas pongan barricadas, torrecitas y resortes' };
  if (spot.bossRush) {
    const best = brawlRecords.get().bossRush;
    const record = best ? `. Récord: ${formatTime(best)}` : '';
    return { emoji: '👑', name: 'Jefes', text: open ? `Todos los jefes que ya vencieron, uno tras otro${record}` : 'Todavía no: gana el primer mundo' };
  }
  const world = WORLDS[spot.world];
  if (!open) return { emoji: world.emoji, name: world.name, text: `Todavía no: ${UNLOCKS[world.unlock].label}` };
  const friend = rescues.has(spot.world) ? '🔓 ya rescataron a su amigo' : 'hay un amigo enjaulado';
  return { emoji: world.emoji, name: world.name, text: `${world.name}: 4 rondas y el jefe  ·  ${friend}` };
}

// El mapa: un camino con un lugar por mundo (con sus estrellas o su candado) y, abajo, los modos (el nido, la base,
// los jefes en serie y el sin fin). Arriba, los récords y el nivel del personaje de cada jugador (`levels`, ver
// levelChips); abajo, los amigos de la compu (Y), las monedas y la tienda (X).
export function showMap(scene, selected, buddies = 0, levels = []) {
  const { width, height } = scene.scale;
  const root = scene.add.container(0, 0).setDepth(DEPTH).setScrollFactor(0);
  root.add(scene.add.rectangle(width / 2, height / 2, width, height, 0x2a7a4a));
  root.add(scene.add.ellipse(width / 2, height + 120, width * 1.6, 520, 0x3fa34d));
  // El camino de tierra que une los mundos.
  const path = scene.add.graphics();
  path.lineStyle(22, 0xd9b26a, 1);
  path.beginPath();
  POSITIONS.slice(0, WORLDS.length).forEach(([x, y], i) => (i === 0 ? path.moveTo(x, y) : path.lineTo(x, y)));
  path.strokePath();
  root.add(path);
  // La plaza de los modos.
  const plazaW = MODE_COUNT * MODE_GAP + 20;
  root.add(scene.add.rectangle(width / 2, MODE_Y + 8, plazaW, 140, 0xd9b26a, 0.85).setRounded(40).setStrokeStyle(5, 0xb08a4a));
  const outline = { fontStyle: 'bold', stroke: '#1b1530', strokeThickness: 5 };
  root.add(scene.add.text(width / 2, 56, 'Mapa de mundos', textStyle(44, TEXT.normal, { fontStyle: 'bold', stroke: '#1b1530', strokeThickness: 8 })).setOrigin(0.5));
  const r = brawlRecords.get();
  const records = [`🔥 Mejor combo: ${r.combo}`, `👑 Jefes vencidos: ${r.bosses}`, `🔓 Rescatados: ${r.rescues}`];
  if (r.bossRush) records.push(`🏆 Jefes en serie: ${formatTime(r.bossRush)}`);
  root.add(scene.add.text(width / 2, 104, records.join('     '), textStyle(18, '#ffd84d', outline)).setOrigin(0.5));
  levelChips(scene, root, levels, 146);
  const nodes = MAP_SPOTS.map((spot, i) => {
    const [x, y] = POSITIONS[i];
    const isWorld = spot.world !== undefined;
    const radius = isWorld ? NODE_R : MODE_R;
    const open = spotOpen(spot);
    const { emoji, name } = spotInfo(spot, open);
    const node = scene.add.container(x, y);
    const ring = scene.add.circle(0, 0, radius, open ? 0xffffff : 0x8a86b8).setStrokeStyle(6, COLORS.ink);
    node.add(ring);
    node.add(scene.add.text(0, -3, emoji, textStyle(isWorld ? 40 : 36)).setOrigin(0.5).setAlpha(open ? 1 : 0.5));
    if (!open) node.add(scene.add.text(22, 20, '🔒', textStyle(24)).setOrigin(0.5));
    else if (isWorld && rescues.has(spot.world)) node.add(scene.add.text(-30, -30, '🔓', textStyle(22)).setOrigin(0.5));
    node.add(scene.add.text(0, radius + 10, name, textStyle(16, '#ffffff', { ...outline, align: 'center', wordWrap: { width: 110 } })).setOrigin(0.5, 0));
    let stars = '';
    if (spot.endless) stars = `Récord: ${endlessRecord.get()}`;
    else if (spot.base) stars = `Récord: ${baseRecord.get()}`;
    else if (spot.nest) stars = '';
    else if (spot.bossRush) stars = r.bossRush ? formatTime(r.bossRush) : '';
    else stars = '★'.repeat(worldStars.get(spot.world)) + '☆'.repeat(3 - worldStars.get(spot.world));
    node.add(scene.add.text(0, -radius - 18, stars, textStyle(isWorld ? 19 : 15, '#ffd84d', { ...outline, strokeThickness: 4 })).setOrigin(0.5));
    root.add(node);
    return { node, ring, open, spot };
  });
  const info = scene.add.text(width / 2, height - 112, '', textStyle(20, '#ffffff', { ...outline, align: 'center' })).setOrigin(0.5);
  const status = scene.add.text(width / 2, height - 72, '', textStyle(20, '#ffffff', outline)).setOrigin(0.5);
  root.add([info, status]);
  const help = '◀ ▶ ▲ ▼ escoger   ·   A = ¡a pelear!   ·   X = tienda   ·   Y = amigos de la compu   ·   B = regresar';
  root.add(scene.add.text(width / 2, height - 30, help, textStyle(19, TEXT.accent, { stroke: '#1b1530', strokeThickness: 4 })).setOrigin(0.5));
  const map = {
    root,
    nodes,
    selected,
    select(index) {
      map.selected = (index + nodes.length) % nodes.length;
      nodes.forEach(({ ring, node }, i) => {
        ring.setStrokeStyle(i === map.selected ? 10 : 6, i === map.selected ? 0xffd84d : COLORS.ink);
        node.setScale(i === map.selected ? 1.15 : 1);
      });
      const { open, spot } = nodes[map.selected];
      const { name, text } = spotInfo(spot, open);
      info.setText(text);
      say(open ? name : `${name}. ${text}`);
    },
    // ▲ ▼: del camino a los modos (o al revés), al más cercano.
    selectOtherRow() {
      const inWorlds = map.selected < WORLDS.length;
      const x = POSITIONS[map.selected][0];
      let best = null;
      MAP_SPOTS.forEach((spot, i) => {
        if (i < WORLDS.length === inWorlds) return;
        if (best === null || Math.abs(POSITIONS[i][0] - x) < Math.abs(POSITIONS[best][0] - x)) best = i;
      });
      map.select(best);
    },
    // Cuántos amigos de la compu van a pelear (y las monedas de la familia).
    setBuddies(count) {
      const who = count === 0 ? 'ninguno' : count === 1 ? '1 amigo' : `${count} amigos`;
      status.setText(`🤖 Amigos de la compu: ${who}   ·   💰 ${coinBank.get()} monedas`);
    },
  };
  map.select(selected);
  map.setBuddies(buddies);
  return map;
}

// El nivel del personaje de cada jugador, en fila: "J1 Tanque · Nivel 3" y su barrita de experiencia. Cada uno de
// `levels`: { label, color, name, level, into, need } (ver levels.js levelFor).
export function levelChips(scene, root, levels, y) {
  const { width } = scene.scale;
  const slot = Math.min(300, width / Math.max(1, levels.length));
  levels.forEach((info, i) => {
    const x = width / 2 + (i - (levels.length - 1) / 2) * slot;
    const top = info.level >= MAX_LEVEL ? ' 👑' : info.level >= 5 ? ' ⭐' : '';
    const text = `${info.label} ${info.name} · Nivel ${info.level}${top}`;
    root.add(scene.add.text(x, y, text, textStyle(17, hexToCss(info.color), { fontStyle: 'bold', stroke: '#1b1530', strokeThickness: 5 })).setOrigin(0.5));
    root.add(scene.add.rectangle(x, y + 17, 150, 8, 0x000000, 0.45).setStrokeStyle(2, 0x1b1530));
    const fill = info.need ? info.into / info.need : 1;
    root.add(scene.add.rectangle(x - 75, y + 17, 150 * fill, 8, info.need ? 0x7fdcff : 0xffd84d).setOrigin(0, 0.5));
  });
}

// Llega el jefe: se oscurece todo, entra su dibujo grandote con su nombre. `onDone` al terminar.
export function showBossIntro(scene, type, onDone) {
  const { width, height } = scene.scale;
  const root = scene.add.container(0, 0).setDepth(DEPTH).setScrollFactor(0);
  root.add(scene.add.rectangle(width / 2, height / 2, width, height, 0x0b0820, 0.82));
  const band = scene.add.container(width, 0);
  band.add(scene.add.rectangle(width / 2, height / 2, width * 1.2, 330, type.color, 0.9).setStrokeStyle(10, 0xffffff).setAngle(-4));
  const key = monsterTexture(scene, type.art);
  if (key) {
    const image = scene.add.image(330, height / 2 + 150, key).setOrigin(0.5, 1).setFlipX(true);
    image.setScale(380 / Math.max(image.width, image.height));
    band.add(image);
  } else {
    band.add(scene.add.circle(330, height / 2, 130, type.color).setStrokeStyle(8, COLORS.ink));
  }
  const style = { fontStyle: 'bold', stroke: '#1b1530', strokeThickness: 10 };
  band.add(scene.add.text(820, height / 2 - 50, '¡Llegó el jefe!', textStyle(44, '#ffd84d', style)).setOrigin(0.5));
  band.add(scene.add.text(820, height / 2 + 30, type.name, textStyle(76, '#ffffff', style)).setOrigin(0.5));
  root.add(band);
  scene.tweens.add({ targets: band, x: 0, duration: 380, ease: 'Back.easeOut' });
  scene.cameras.main.shake(300, 0.006);
  say(`¡Llegó el jefe! ¡${type.name}!`);
  scene.time.delayedCall(2300, () => {
    scene.tweens.add({ targets: root, alpha: 0, duration: 300, onComplete: () => root.destroy() });
    onDone?.();
  });
}

// Resultados del mundo: cada peleador con lo que hizo y sus medallas (ver records.js), las estrellas que ganaron y
// los récords nuevos (`extra`).
export function showResults(scene, fighters, { title, stars = null, hint, extra = '' }) {
  const { width, height } = scene.scale;
  const root = scene.add.container(0, 0).setDepth(DEPTH).setScrollFactor(0);
  root.add(scene.add.rectangle(width / 2, height / 2, width, height, 0x14112b, 0.88));
  root.add(scene.add.text(width / 2, 70, title, textStyle(52, TEXT.accent, { fontStyle: 'bold', stroke: '#1b1530', strokeThickness: 10 })).setOrigin(0.5));
  if (stars !== null) root.add(scene.add.text(width / 2, 140, '★'.repeat(stars) + '☆'.repeat(3 - stars), textStyle(56, '#ffd84d', { stroke: '#1b1530', strokeThickness: 8 })).setOrigin(0.5));
  const winners = medals(fighters);
  const slot = Math.min(300, (width - 40) / fighters.length);
  // Con muchos (amigos de la compu y rescatados) las tarjetas son más angostas y la letra más chica.
  const many = fighters.length > 4;
  const font = many ? 15 : 19;
  fighters.forEach((f, i) => {
    const x = width / 2 + (i - (fighters.length - 1) / 2) * slot;
    const card = scene.add.container(x, 410);
    card.add(scene.add.rectangle(0, 0, slot - 14, 340, COLORS.panel).setRounded(22).setStrokeStyle(5, f.color));
    card.add(scene.add.text(0, -146, f.label, textStyle(many ? 22 : 30, hexToCss(f.color), { fontStyle: 'bold' })).setOrigin(0.5));
    const lines = [`👊 ${f.stats.hits} golpes`, `💥 ${f.stats.kills} monstruos`, `🤝 levantó a ${f.stats.revives}`, `💰 ${f.stats.coins} monedas`];
    card.add(scene.add.text(0, -66, lines.join('\n'), textStyle(font, '#ffffff', { align: 'center', lineSpacing: 5 })).setOrigin(0.5));
    const won = winners.get(f).join('\n') || ' ';
    card.add(scene.add.text(0, 76, won, textStyle(font, '#ffd84d', { fontStyle: 'bold', align: 'center', lineSpacing: 5, wordWrap: { width: slot - 30 } })).setOrigin(0.5));
    // El nivel de su personaje (los amigos de la compu no suben) y la experiencia que ganó.
    if (!f.isCpu && f.levelInfo) {
      const info = f.levelInfo;
      const up = f.levelsGained > 0 ? ' ⬆️' : '';
      card.add(scene.add.text(0, 136, `Nivel ${info.level}${up}   +${f.runXp ?? 0} XP`, textStyle(font, '#7fdcff', { fontStyle: 'bold' })).setOrigin(0.5));
      const barW = Math.min(200, slot - 50);
      card.add(scene.add.rectangle(0, 156, barW, 8, 0x000000, 0.45));
      card.add(scene.add.rectangle(-barW / 2, 156, barW * (info.need ? info.into / info.need : 1), 8, info.need ? 0x7fdcff : 0xffd84d).setOrigin(0, 0.5));
    }
    root.add(card);
    scene.tweens.add({ targets: card, y: { from: 760, to: 410 }, duration: 420, delay: i * 100, ease: 'Back.easeOut' });
  });
  if (extra) root.add(scene.add.text(width / 2, height - 84, extra, textStyle(22, '#4cd97b', { fontStyle: 'bold', stroke: '#1b1530', strokeThickness: 5 })).setOrigin(0.5));
  root.add(scene.add.text(width / 2, height - 40, hint, textStyle(22, TEXT.accent, { fontStyle: 'bold', stroke: '#1b1530', strokeThickness: 5 })).setOrigin(0.5));
  say(title);
  return root;
}
