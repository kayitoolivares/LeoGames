import { settings } from '../../shared/settings.js';
import { players } from '../../shared/players.js';
import { say } from '../../shared/voice.js';
import { Blob } from '../../ui/Blob.js';
import { CharacterLook } from '../../ui/CharacterLook.js';
import { COLORS, TEXT, textStyle } from '../../ui/style.js';
import { artImage } from './art.js';
import { ENEMIES } from './enemies.js';
import { LEVELS, SECRETS, WORLDS } from './levels.js';

// El avance de Súper Bolitas (se guarda): hasta qué nivel del camino está abierto, las monedas grandes y el mejor
// tiempo de cada nivel, los niveles secretos abiertos, quién juega en modo peque, las vidas extra compradas y el
// récord de los jefes en serie.
const KEY = 'platProgress2';
const OLD_KEY = 'platProgress';

// (La primera versión tenía 3 niveles por mundo; ahora son 4 con el fuerte en el segundo lugar.)
function migrate(old) {
  const map = (i) => Math.floor(i / 3) * 4 + [0, 2, 3][i % 3];
  const mapId = (id) => {
    const [w, n] = id.split('-').map(Number);
    return `${w}-${[0, 1, 3, 4][n]}`;
  };
  const levels = {};
  for (const [id, data] of Object.entries(old.levels ?? {})) levels[mapId(id)] = data;
  return { unlocked: map(old.unlocked ?? 0), levels, peque: old.peque ?? {} };
}

export const progress = {
  get() {
    let data = settings.get(KEY, null);
    if (!data) {
      const old = settings.get(OLD_KEY, null);
      data = old ? migrate(old) : {};
      settings.set(KEY, data);
    }
    return { unlocked: 0, levels: {}, peque: {}, secrets: {}, extraLives: 0, rushBest: null, ...data };
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
  // Terminaron un nivel: abre el siguiente (y el secreto, si fue por la bandera secreta) y guarda monedas grandes y
  // tiempo. Devuelve qué hubo de nuevo.
  complete(id, { big, ms, index = null, secretWorld = null }) {
    const data = this.get();
    const before = this.level(id);
    const merged = before.big.map((had, i) => had || Boolean(big[i]));
    const record = before.bestMs === null || ms < before.bestMs;
    data.levels[id] = { done: true, big: merged, bestMs: record ? ms : before.bestMs };
    if (index !== null) data.unlocked = Math.max(data.unlocked, Math.min(LEVELS.length - 1, index + 1));
    let secretOpened = false;
    if (secretWorld !== null && !data.secrets[secretWorld]) {
      data.secrets[secretWorld] = true;
      secretOpened = true;
    }
    this.save(data);
    return { record: record && before.bestMs !== null, allBig: merged.every(Boolean), firstTime: !before.done, secretOpened };
  },
  secretOpen(world) {
    return Boolean(this.get().secrets[world]);
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
  addExtraLife() {
    const data = this.get();
    data.extraLives += 1;
    this.save(data);
  },
  // Las vidas extra compradas se usan al empezar el siguiente nivel.
  takeExtraLives() {
    const data = this.get();
    const n = data.extraLives;
    data.extraLives = 0;
    this.save(data);
    return n;
  },
  saveRush(ms) {
    const data = this.get();
    const record = data.rushBest === null || ms < data.rushBest;
    if (record) data.rushBest = ms;
    this.save(data);
    return record;
  },
};

// 83500 ms -> "1:23"
export function formatTime(ms) {
  const seconds = Math.round(ms / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

// El fantasma de la contrarreloj de cada nivel (por separado: pesa más).
const GHOST_KEY = 'platGhosts';
export const ghosts = {
  get(id) {
    return settings.get(GHOST_KEY, {})[id] ?? null;
  },
  save(id, ghost) {
    settings.set(GHOST_KEY, { ...settings.get(GHOST_KEY, {}), [id]: ghost });
  },
};

// El enemigo que camina por el mapa de cada mundo (si lo alcanzas, ¡batalla!).
export const MAP_ENEMY = ['g', 'q', 'c', 't', 'p', 'J', 'E'];

// Los lugares del mapa de un mundo, en el orden del caminito: nivel 1, casita de regalos, fuerte, nivel 3, castillo
// del jefe y (si ya se abrió) el nivel secreto.
export function worldNodes(world) {
  const levelIndex = (i) => LEVELS.findIndex((lv) => lv.world === world && lv.index === i);
  const nodes = [
    { kind: 'level', index: levelIndex(0) },
    { kind: 'house' },
    { kind: 'level', index: levelIndex(1) },
    { kind: 'level', index: levelIndex(2) },
    { kind: 'level', index: levelIndex(3) },
  ];
  const secret = SECRETS.find((s) => s.world === world);
  if (secret && progress.secretOpen(world)) nodes.push({ kind: 'secret', info: secret });
  return nodes;
}

export function nodeOpen(world, node) {
  if (node.kind === 'level') return progress.open(node.index);
  if (node.kind === 'house') return progress.level(LEVELS[worldNodes(world)[0].index].id).done;
  return true;
}

export function worldOpen(world) {
  return progress.open(LEVELS.findIndex((lv) => lv.world === world));
}

const DEPTH = 10002;
const SLOTS = [150, 330, 510, 690, 870, 1050];
const SLOT_Y = [430, 330, 430, 330, 430, 300];

// El mapa de un mundo: su isla con el caminito, los lugares, los jugadores (caminan de lugar en lugar), el enemigo
// del mapa y abajo la información. `state` = { world, node, enemy } (dónde están; el enemigo puede ser null).
export function showMap(scene, state, characters) {
  const { width, height } = scene.scale;
  const world = WORLDS[state.world];
  const root = scene.add.container(0, 0).setDepth(DEPTH).setScrollFactor(0);
  root.add(scene.add.rectangle(width / 2, height / 2, width, height, 0x7fd0ff));
  root.add(scene.add.rectangle(width / 2, height - 90, width, 180, 0x3fa7ff));
  root.add(scene.add.ellipse(width / 2, 390, 1180, 380, world.color, 0.9).setStrokeStyle(8, 0x1b1530));
  const outline = { fontStyle: 'bold', stroke: '#1b1530', strokeThickness: 5 };
  root.add(scene.add.text(width / 2, 46, `${world.emoji} Mundo ${state.world + 1}: ${world.name}`, textStyle(40, TEXT.normal, { fontStyle: 'bold', stroke: '#1b1530', strokeThickness: 8 })).setOrigin(0.5));
  // Los mundos de arriba (con candado los que faltan).
  root.add(
    scene.add
      .text(width / 2, 100, WORLDS.map((w, i) => (i === state.world ? `[${w.emoji}]` : worldOpen(i) ? w.emoji : '🔒')).join('   '), textStyle(24, '#ffffff', outline))
      .setOrigin(0.5),
  );
  const nodes = worldNodes(state.world);
  const pos = (i) => [SLOTS[i], SLOT_Y[i]];
  const path = scene.add.graphics();
  path.lineStyle(16, 0xf2d48a, 1);
  path.beginPath();
  nodes.forEach((_, i) => (i === 0 ? path.moveTo(...pos(i)) : path.lineTo(...pos(i))));
  path.strokePath();
  root.add(path);
  const icons = nodes.map((node, i) => {
    const [x, y] = pos(i);
    const open = nodeOpen(state.world, node);
    const icon = scene.add.container(x, y);
    if (node.kind === 'house') {
      icon.add(artImage(scene, 'plat:objeto-casita', 80, { color: 0xe53935 }).setY(36));
    } else {
      const info = node.kind === 'secret' ? node.info : LEVELS[node.index];
      const data = progress.level(info.id);
      const boss = Boolean(info.spec.boss);
      const label = node.kind === 'secret' ? '★' : boss ? (info.spec.boss.startsWith('rey') ? '👑' : '🏰') : info.id;
      icon.add(scene.add.circle(0, 0, 34, open ? (data.done ? 0x4cd97b : 0xffffff) : 0x8a86b8).setStrokeStyle(5, COLORS.ink));
      icon.add(scene.add.text(0, 0, label, textStyle(label.length > 2 ? 18 : 28, '#1b1530', { fontStyle: 'bold' })).setOrigin(0.5));
      icon.add(scene.add.text(0, 52, data.big.map((b) => (b ? '●' : '○')).join(''), textStyle(18, '#ffd84d', { ...outline, strokeThickness: 4 })).setOrigin(0.5));
    }
    if (!open) icon.add(scene.add.text(22, 22, '🔒', textStyle(22)).setOrigin(0.5));
    root.add(icon);
    return { icon, node, open };
  });
  // El enemigo del mapa.
  let enemyIcon = null;
  if (state.enemy !== null && state.enemy !== undefined) {
    const type = ENEMIES[MAP_ENEMY[state.world]];
    enemyIcon = artImage(scene, type.art, 52, { color: type.color });
    const [x, y] = pos(state.enemy);
    enemyIcon.setPosition(x + 40, y + 10);
    root.add(enemyIcon);
    scene.tweens.add({ targets: enemyIcon, y: y + 2, duration: 400, yoyo: true, repeat: -1 });
  }
  // Los jugadores (su personaje).
  const team = players.sorted().map((player, k) => {
    const blob = new Blob(scene, 0, 0, players.color(player).hex, 16);
    new CharacterLook(scene, blob, characters[k], { height: 2.6 });
    root.add(blob);
    return blob;
  });
  const placeTeam = (i, animate) => {
    const [x, y] = pos(i);
    team.forEach((blob, k) => {
      const tx = x - (team.length - 1) * 14 + k * 28;
      const ty = y - 66;
      if (animate) scene.tweens.add({ targets: blob, x: tx, y: ty, duration: 320, ease: 'Sine.easeInOut' });
      else blob.setPosition(tx, ty);
    });
  };
  const info = scene.add.text(width / 2, height - 150, '', textStyle(22, '#ffffff', { ...outline, align: 'center' })).setOrigin(0.5);
  const status = scene.add.text(width / 2, height - 100, '', textStyle(19, '#ffffff', outline)).setOrigin(0.5);
  root.add([info, status]);
  root.add(
    scene.add
      .text(width / 2, height - 40, '◀ ▶ caminar · LB RB mundo · A entrar · X modos y tienda · Y modo peque · B salir', textStyle(18, TEXT.accent, { stroke: '#1b1530', strokeThickness: 4 }))
      .setOrigin(0.5),
  );

  const map = {
    root,
    nodes: icons,
    state,
    // Pone al equipo en el lugar `i` (caminando, si `animate`) y dice qué es.
    select(i, { animate = false, speak = true } = {}) {
      state.node = Math.max(0, Math.min(icons.length - 1, i));
      icons.forEach(({ icon }, k) => icon.setScale(k === state.node ? 1.15 : 1));
      placeTeam(state.node, animate);
      const { node, open } = icons[state.node];
      let text;
      let spoken;
      if (node.kind === 'house') {
        text = open ? '🎁 Casita de regalos: escoge un regalo' : '🎁 Casita de regalos   ·   🔒 Pasa el primer nivel';
        spoken = 'Casita de regalos';
      } else {
        const lv = node.kind === 'secret' ? node.info : LEVELS[node.index];
        const data = progress.level(lv.id);
        const got = data.big.filter(Boolean).length;
        text = `${lv.id}  ${lv.spec.name}   ·   monedas grandes: ${got} de 3`;
        if (data.bestMs !== null) text += `   ·   mejor tiempo: ${formatTime(data.bestMs)}`;
        if (!open) text = `${lv.id}  ${lv.spec.name}   ·   🔒 Pasa el nivel de antes`;
        spoken = open ? lv.spec.name : `${lv.spec.name}. Todavía no`;
      }
      if (state.enemy === state.node) text += '   ·   ⚔️ ¡Un enemigo!';
      info.setText(text);
      if (speak) say(spoken);
    },
    refresh() {
      const data = progress.get();
      const parts = players.sorted().map((p) => `J${p.slot + 1}: ${data.peque[p.deviceId] ? '👶 peque' : 'normal'}`);
      if (data.extraLives) parts.push(`❤️ +${data.extraLives} vidas compradas`);
      status.setText(parts.join('      '));
    },
    moveEnemy(node) {
      state.enemy = node;
      if (!enemyIcon) return;
      if (node === null) {
        enemyIcon.destroy();
        enemyIcon = null;
        return;
      }
      const [x, y] = pos(node);
      scene.tweens.killTweensOf(enemyIcon);
      scene.tweens.add({ targets: enemyIcon, x: x + 40, y: y + 10, duration: 400 });
    },
  };
  map.select(state.node, { speak: false });
  map.refresh();
  say(`Mundo ${state.world + 1}. ${world.name}`);
  return map;
}

// El menú de modos (X en el mapa): una lista que se mueve con ▲ ▼ y A escoge.
export const MODES = [
  { id: 'trial', label: '⏱️ Contrarreloj con fantasma (el nivel escogido)' },
  { id: 'battle', label: '🪙 Batalla de monedas' },
  { id: 'rush', label: '👑 Jefes en serie' },
  { id: 'shop', label: '🛍️ Tienda de sombreros y trajes' },
  { id: 'life', label: '❤️ Comprar una vida extra (20 monedas)' },
];

export function showModes(scene, selected, coins) {
  const { width, height } = scene.scale;
  const root = scene.add.container(0, 0).setDepth(DEPTH + 1).setScrollFactor(0);
  root.add(scene.add.rectangle(width / 2, height / 2, width, height, 0x14112b, 0.9));
  root.add(scene.add.text(width / 2, 90, 'Modos', textStyle(52, TEXT.accent, { fontStyle: 'bold', stroke: '#1b1530', strokeThickness: 10 })).setOrigin(0.5));
  root.add(scene.add.text(width / 2, 150, `💰 ${coins} monedas de la familia`, textStyle(24, '#ffd84d', { fontStyle: 'bold', stroke: '#1b1530', strokeThickness: 5 })).setOrigin(0.5));
  const rows = MODES.map((mode, i) => {
    const text = scene.add.text(width / 2, 240 + i * 70, mode.label, textStyle(28, '#ffffff', { fontStyle: 'bold', stroke: '#1b1530', strokeThickness: 5 })).setOrigin(0.5);
    root.add(text);
    return text;
  });
  root.add(scene.add.text(width / 2, height - 40, '▲ ▼ escoger · A = ¡va! · B = regresar al mapa', textStyle(20, TEXT.accent, { stroke: '#1b1530', strokeThickness: 4 })).setOrigin(0.5));
  const menu = {
    root,
    selected,
    select(i) {
      menu.selected = (i + MODES.length) % MODES.length;
      rows.forEach((row, k) => row.setColor(k === menu.selected ? TEXT.accent : '#ffffff').setScale(k === menu.selected ? 1.08 : 1));
      say(MODES[menu.selected].label.replace(/^\S+\s/, ''));
    },
  };
  menu.select(selected);
  return menu;
}
