import { settings } from '../../shared/settings.js';
import { players } from '../../shared/players.js';
import { say } from '../../shared/voice.js';
import { Blob } from '../../ui/Blob.js';
import { CharacterLook } from '../../ui/CharacterLook.js';
import { COLORS, TEXT, textStyle } from '../../ui/style.js';
import { LEVELS, WORLDS } from './levels.js';

// El avance de Súper Bolitas (se guarda): hasta qué nivel está abierto, las monedas grandes de cada nivel, el mejor
// tiempo y quién juega en modo peque.
const KEY = 'platProgress';

export const progress = {
  get() {
    return { unlocked: 0, levels: {}, peque: {}, ...settings.get(KEY, {}) };
  },
  save(data) {
    settings.set(KEY, data);
  },
  open(index) {
    return index <= this.get().unlocked;
  },
  level(id) {
    return { done: false, big: [false, false, false], bestMs: null, ...this.get().levels[id] };
  },
  // Terminaron un nivel: abre el siguiente y guarda monedas grandes y tiempo. Devuelve qué hubo de nuevo.
  complete(index, { big, ms }) {
    const data = this.get();
    const id = LEVELS[index].id;
    const before = this.level(id);
    const merged = before.big.map((had, i) => had || Boolean(big[i]));
    const record = before.bestMs === null || ms < before.bestMs;
    data.levels[id] = { done: true, big: merged, bestMs: record ? ms : before.bestMs };
    data.unlocked = Math.max(data.unlocked, Math.min(LEVELS.length - 1, index + 1));
    this.save(data);
    return { record: record && before.bestMs !== null, allBig: merged.every(Boolean), firstTime: !before.done };
  },
  peque(deviceId) {
    return Boolean(this.get().peque[deviceId]);
  },
  togglePeque(deviceId) {
    const data = this.get();
    data.peque[deviceId] = !data.peque[deviceId];
    this.save(data);
    return data.peque[deviceId];
  },
};

// 83500 ms -> "1:23"
export function formatTime(ms) {
  const seconds = Math.round(ms / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

const DEPTH = 10002;
const POSITIONS = LEVELS.map((lv, i) => [90 + i * 88 + lv.world * 40, i % 2 === 0 ? 400 : 300]);

// El mapa: 4 islas (una por mundo) con un caminito de nivel en nivel. Abajo, quién juega en modo peque.
export function showMap(scene, selected, characters) {
  const { width, height } = scene.scale;
  const root = scene.add.container(0, 0).setDepth(DEPTH).setScrollFactor(0);
  root.add(scene.add.rectangle(width / 2, height / 2, width, height, 0x7fd0ff));
  root.add(scene.add.rectangle(width / 2, height - 90, width, 180, 0x3fa7ff));
  const outline = { fontStyle: 'bold', stroke: '#1b1530', strokeThickness: 5 };
  root.add(scene.add.text(width / 2, 52, 'Súper Bolitas', textStyle(48, TEXT.normal, { fontStyle: 'bold', stroke: '#1b1530', strokeThickness: 8 })).setOrigin(0.5));
  // Las islas de cada mundo.
  WORLDS.forEach((world, w) => {
    const xs = LEVELS.filter((lv) => lv.world === w).map((lv) => POSITIONS[LEVELS.indexOf(lv)][0]);
    const cx = (xs[0] + xs.at(-1)) / 2;
    root.add(scene.add.ellipse(cx, 370, xs.at(-1) - xs[0] + 110, 280, world.color, 0.85).setStrokeStyle(6, 0x1b1530));
    root.add(scene.add.text(cx, 200, `${world.emoji} ${world.name}`, textStyle(19, '#ffffff', outline)).setOrigin(0.5));
  });
  const path = scene.add.graphics();
  path.lineStyle(14, 0xf2d48a, 1);
  path.beginPath();
  POSITIONS.forEach(([x, y], i) => (i === 0 ? path.moveTo(x, y) : path.lineTo(x, y)));
  path.strokePath();
  root.add(path);
  const nodes = LEVELS.map((lv, i) => {
    const [x, y] = POSITIONS[i];
    const open = progress.open(i);
    const info = progress.level(lv.id);
    const boss = Boolean(lv.spec.boss);
    const node = scene.add.container(x, y);
    const ring = scene.add.circle(0, 0, boss ? 34 : 28, open ? (info.done ? 0x4cd97b : 0xffffff) : 0x8a86b8).setStrokeStyle(5, COLORS.ink);
    node.add(ring);
    node.add(scene.add.text(0, 0, boss ? '👑' : lv.id, textStyle(boss ? 30 : 18, '#1b1530', { fontStyle: 'bold' })).setOrigin(0.5));
    if (!open) node.add(scene.add.text(18, 18, '🔒', textStyle(20)).setOrigin(0.5));
    node.add(scene.add.text(0, 46, info.big.map((b) => (b ? '●' : '○')).join(''), textStyle(18, '#ffd84d', { ...outline, strokeThickness: 4 })).setOrigin(0.5));
    root.add(node);
    return { node, ring, open, lv };
  });
  // Los jugadores (su personaje) parados en el nivel escogido.
  const team = players.sorted().map((player, k) => {
    const blob = new Blob(scene, 0, 0, players.color(player).hex, 16);
    new CharacterLook(scene, blob, characters[k], { height: 2.6 });
    root.add(blob);
    return blob;
  });
  const info = scene.add.text(width / 2, height - 150, '', textStyle(22, '#ffffff', { ...outline, align: 'center' })).setOrigin(0.5);
  const status = scene.add.text(width / 2, height - 98, '', textStyle(20, '#ffffff', outline)).setOrigin(0.5);
  root.add([info, status]);
  root.add(scene.add.text(width / 2, height - 40, '◀ ▶ escoger   ·   A = ¡a jugar!   ·   Y = modo peque (cada quien)   ·   B = regresar', textStyle(19, TEXT.accent, { stroke: '#1b1530', strokeThickness: 4 })).setOrigin(0.5));

  const map = {
    root,
    nodes,
    selected,
    select(index, speak = true) {
      map.selected = Math.max(0, Math.min(nodes.length - 1, index));
      nodes.forEach(({ ring, node }, i) => {
        ring.setStrokeStyle(i === map.selected ? 9 : 5, i === map.selected ? 0xffd84d : COLORS.ink);
        node.setScale(i === map.selected ? 1.18 : 1);
      });
      const { lv, open } = nodes[map.selected];
      const [x, y] = POSITIONS[map.selected];
      team.forEach((blob, k) => blob.setPosition(x - (team.length - 1) * 14 + k * 28, y - 62));
      const data = progress.level(lv.id);
      const world = WORLDS[lv.world];
      const got = data.big.filter(Boolean).length;
      let text = `${lv.id}  ${lv.spec.name}   ·   monedas grandes: ${got} de 3`;
      if (data.bestMs !== null) text += `   ·   mejor tiempo: ${formatTime(data.bestMs)}`;
      if (!open) text = `${lv.id}  ${lv.spec.name}   ·   🔒 Pasa el nivel de antes`;
      info.setText(text);
      if (speak) say(open ? `${world.name}. ${lv.spec.name}` : `${lv.spec.name}. Todavía no`);
    },
    refreshPeque() {
      const parts = players.sorted().map((p) => `J${p.slot + 1}: ${progress.peque(p.deviceId) ? '👶 modo peque' : 'normal'}`);
      status.setText(parts.join('      '));
    },
  };
  map.select(selected, true);
  map.refreshPeque();
  return map;
}
