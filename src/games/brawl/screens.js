import { settings } from '../../shared/settings.js';
import { UNLOCKS, rewards } from '../../shared/rewards.js';
import { say } from '../../shared/voice.js';
import { COLORS, TEXT, hexToCss, textStyle } from '../../ui/style.js';
import { monsterTexture } from './art.js';
import { WORLDS } from './worlds.js';

// Las pantallas de Pelea en equipo: el mapa de mundos, la presentación de cada jefe y los resultados con premios.
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

// Los lugares del mapa: los 6 mundos en un caminito de zigzag y, al final, el modo sin fin.
export const MAP_SPOTS = [...WORLDS.map((world, i) => ({ world: i })), { endless: true }];
const POSITIONS = [
  [130, 470],
  [300, 320],
  [470, 470],
  [640, 320],
  [810, 470],
  [980, 320],
  [1150, 470],
];

function spotOpen(spot) {
  return spot.endless || rewards.unlocked(WORLDS[spot.world].unlock);
}

// El mapa: un camino con un lugar por mundo (con sus estrellas o su candado) y el modo sin fin.
export function showMap(scene, selected) {
  const { width, height } = scene.scale;
  const root = scene.add.container(0, 0).setDepth(DEPTH).setScrollFactor(0);
  root.add(scene.add.rectangle(width / 2, height / 2, width, height, 0x2a7a4a));
  root.add(scene.add.ellipse(width / 2, height + 120, width * 1.6, 520, 0x3fa34d));
  // El camino de tierra que une los lugares.
  const path = scene.add.graphics();
  path.lineStyle(26, 0xd9b26a, 1);
  path.beginPath();
  POSITIONS.forEach(([x, y], i) => (i === 0 ? path.moveTo(x, y) : path.lineTo(x, y)));
  path.strokePath();
  root.add(path);
  root.add(scene.add.text(width / 2, 70, 'Mapa de mundos', textStyle(48, TEXT.normal, { fontStyle: 'bold', stroke: '#1b1530', strokeThickness: 8 })).setOrigin(0.5));
  const nodes = MAP_SPOTS.map((spot, i) => {
    const [x, y] = POSITIONS[i];
    const open = spotOpen(spot);
    const world = spot.endless ? null : WORLDS[spot.world];
    const node = scene.add.container(x, y);
    const ring = scene.add.circle(0, 0, 58, open ? 0xffffff : 0x8a86b8).setStrokeStyle(6, COLORS.ink);
    node.add(ring);
    node.add(scene.add.text(0, -4, spot.endless ? '♾️' : world.emoji, textStyle(54)).setOrigin(0.5).setAlpha(open ? 1 : 0.5));
    if (!open) node.add(scene.add.text(26, 24, '🔒', textStyle(30)).setOrigin(0.5));
    const name = spot.endless ? 'Sin fin' : world.name;
    node.add(scene.add.text(0, 84, name, textStyle(19, '#ffffff', { fontStyle: 'bold', align: 'center', stroke: '#1b1530', strokeThickness: 5, wordWrap: { width: 160 } })).setOrigin(0.5));
    const stars = spot.endless ? `Récord: ${endlessRecord.get()}` : '★'.repeat(worldStars.get(spot.world)) + '☆'.repeat(3 - worldStars.get(spot.world));
    node.add(scene.add.text(0, 124, stars, textStyle(spot.endless ? 17 : 22, '#ffd84d', { fontStyle: 'bold', stroke: '#1b1530', strokeThickness: 4 })).setOrigin(0.5));
    root.add(node);
    return { node, ring, open, spot };
  });
  const info = scene.add.text(width / 2, height - 70, '', textStyle(20, '#ffffff', { fontStyle: 'bold', align: 'center', stroke: '#1b1530', strokeThickness: 5 })).setOrigin(0.5);
  root.add(info);
  root.add(scene.add.text(width / 2, height - 28, '◀ ▶ escoger   ·   A = ¡a pelear!   ·   B = regresar', textStyle(20, TEXT.accent, { stroke: '#1b1530', strokeThickness: 4 })).setOrigin(0.5));
  const map = {
    root,
    nodes,
    selected,
    select(index) {
      map.selected = (index + nodes.length) % nodes.length;
      nodes.forEach(({ ring, node }, i) => {
        ring.setStrokeStyle(i === map.selected ? 10 : 6, i === map.selected ? 0xffd84d : COLORS.ink);
        node.setScale(i === map.selected ? 1.12 : 1);
      });
      const { open, spot } = nodes[map.selected];
      const world = spot.endless ? null : WORLDS[spot.world];
      let text = spot.endless ? 'Rondas sin fin, cada vez más difíciles. ¿Cuántas aguantan?' : `${world.name}: 4 rondas y el jefe`;
      if (!open) text = `Todavía no: ${UNLOCKS[world.unlock].label}`;
      info.setText(text);
      say(spot.endless ? 'Sin fin' : open ? world.name : `${world.name}. ${text}`);
    },
  };
  map.select(selected);
  return map;
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

// Resultados del mundo: cada jugador con lo que hizo y los premios (más golpes, más monstruos, mejor compañero y
// el que tumbó al jefe), y las estrellas que ganaron.
export function showResults(scene, fighters, { title, stars = null, hint }) {
  const { width, height } = scene.scale;
  const root = scene.add.container(0, 0).setDepth(DEPTH).setScrollFactor(0);
  root.add(scene.add.rectangle(width / 2, height / 2, width, height, 0x14112b, 0.88));
  root.add(scene.add.text(width / 2, 70, title, textStyle(52, TEXT.accent, { fontStyle: 'bold', stroke: '#1b1530', strokeThickness: 10 })).setOrigin(0.5));
  if (stars !== null) root.add(scene.add.text(width / 2, 140, '★'.repeat(stars) + '☆'.repeat(3 - stars), textStyle(56, '#ffd84d', { stroke: '#1b1530', strokeThickness: 8 })).setOrigin(0.5));
  const awards = [
    ['👊', 'Más golpes', (f) => f.stats.hits],
    ['💥', 'Más monstruos', (f) => f.stats.kills],
    ['🤝', 'Mejor compañero', (f) => f.stats.revives],
    ['👑', 'Tumbó al jefe', (f) => f.stats.boss],
  ];
  const winners = new Map(fighters.map((f) => [f, []]));
  for (const [emoji, name, value] of awards) {
    const best = Math.max(...fighters.map(value));
    if (best <= 0) continue;
    for (const f of fighters) if (value(f) === best) winners.get(f).push(`${emoji} ${name}`);
  }
  const slot = Math.min(300, (width - 80) / fighters.length);
  fighters.forEach((f, i) => {
    const x = width / 2 + (i - (fighters.length - 1) / 2) * slot;
    const card = scene.add.container(x, 400);
    card.add(scene.add.rectangle(0, 0, slot - 24, 330, COLORS.panel).setRounded(22).setStrokeStyle(5, f.color));
    card.add(scene.add.text(0, -140, `J${f.player.slot + 1}`, textStyle(30, hexToCss(f.color), { fontStyle: 'bold' })).setOrigin(0.5));
    const lines = [`👊 ${f.stats.hits} golpes`, `💥 ${f.stats.kills} monstruos`, `🤝 levantó a ${f.stats.revives}`];
    card.add(scene.add.text(0, -60, lines.join('\n'), textStyle(20, '#ffffff', { align: 'center', lineSpacing: 6 })).setOrigin(0.5));
    card.add(scene.add.text(0, 70, winners.get(f).join('\n') || ' ', textStyle(20, '#ffd84d', { fontStyle: 'bold', align: 'center', lineSpacing: 6 })).setOrigin(0.5));
    root.add(card);
    scene.tweens.add({ targets: card, y: { from: 760, to: 400 }, duration: 420, delay: i * 120, ease: 'Back.easeOut' });
  });
  root.add(scene.add.text(width / 2, height - 40, hint, textStyle(22, TEXT.accent, { fontStyle: 'bold', stroke: '#1b1530', strokeThickness: 5 })).setOrigin(0.5));
  say(title);
  return root;
}
