import { controls } from '../../shared/controls.js';
import { players } from '../../shared/players.js';
import { settings } from '../../shared/settings.js';
import { sfx } from '../../shared/sound.js';
import { say } from '../../shared/voice.js';
import { COLORS, TEXT, textStyle } from '../../ui/style.js';
import { artImage } from './art.js';
import { ENEMIES } from './enemies.js';
import { ROWS, T, THEMES, isSolid, themeTextures, tileTexture } from './tiles.js';

// "Arma tu nivel": un editor de niveles de Súper Bolitas para usarse con el control (lo usa el Jugador 1). Hay 3
// ranuras que se guardan solas. El nivel es una cuadrícula con las mismas letras que los niveles de verdad (ver
// level.js y tiles.js), así se juega con todo lo del juego.
//   Stick o cruceta: mover el cuadrito   A: poner la pieza (sostenido y moviendo: pinta)   B: borrar (igual)
//   LB / RB: cambiar de pieza   Y: ¡probar el nivel! (Y otra vez regresa a editar)   X: menú (mundo, borrar todo, salir)
// Para jugarse necesita la salida (▶) y la meta (la bandera); de esas solo hay una (ponerla otra vez la cambia de
// lugar).
const KEY = 'platMisNiveles';
export const SLOT_COUNT = 3;
const COLS = 80;
// En el editor el nivel se ve más chiquito, para que quepa abajo la tira de piezas.
const CELL = 38;
const ZOOM = CELL / T;
const GRID_Y = 52;
const VISIBLE = Math.floor(1280 / CELL);
const MARGIN = 4;
const REPEAT = { firstMs: 280, everyMs: 75 };
const SAVE_EVERY_MS = 1500;
const DEPTH = 10002;
const INK = 0x1b1530;
const OUTLINE = { fontStyle: 'bold', stroke: '#1b1530', strokeThickness: 5 };

// Los mundos que se pueden escoger (su estilo de cuadritos y su fondo). El de nieve resbala y en el espacio se brinca
// más alto.
export const EDITOR_THEMES = [
  { theme: 'pradera', name: 'Pradera', emoji: '🌿' },
  { theme: 'nieve', name: 'Nieve', emoji: '❄️', ice: true },
  { theme: 'dulces', name: 'Dulcelandia', emoji: '🍭' },
  { theme: 'cielo', name: 'Nubes', emoji: '☁️' },
  { theme: 'playa', name: 'Playa', emoji: '🏖️' },
  { theme: 'cueva', name: 'Cueva', emoji: '🦇' },
  { theme: 'castillo', name: 'Castillo', emoji: '🏰' },
  { theme: 'embrujada', name: 'Casa embrujada', emoji: '👻' },
  { theme: 'espacio', name: 'Espacio', emoji: '🚀', gravity: 0.6 },
];

// Las piezas, en el orden de LB / RB. `pipe` = un tubo (de la boca hasta el piso).
export const PIECES = [
  { ch: '#', name: 'Piso' },
  { ch: 'X', name: 'Bloque de piedra' },
  { ch: 'B', name: 'Ladrillo' },
  { ch: '?', name: 'Caja con moneda' },
  { ch: 'M', name: 'Caja con poder' },
  { ch: 'S', name: 'Caja con estrella' },
  { ch: 'o', name: 'Moneda' },
  { ch: '=', name: 'Plataforma' },
  { ch: 'm', name: 'Plataforma que se mueve' },
  { ch: 'R', name: 'Resorte' },
  { ch: 'pipe', name: 'Tubo' },
  { ch: 'g', name: 'Hongo malo' },
  { ch: 't', name: 'Tortuga' },
  { ch: 'q', name: 'Pájaro' },
  { ch: 'e', name: 'Erizo' },
  { ch: '^', name: 'Picos' },
  { ch: 'L', name: 'Lava' },
  { ch: 'D', name: 'Dinosaurio' },
  { ch: 'C', name: 'Banderín' },
  { ch: '@', name: 'Salida' },
  { ch: 'F', name: 'Meta' },
];
const PIPE = new Set('[]()');
// Las letras que son cuadritos (las demás son cosas encima: monedas, enemigos, la salida...).
const TILE_CHARS = new Set('#XB?MS=^L[]()');
// Las cajas se ven todas como regalo; en el editor llevan una marquita de qué traen.
const BOX_MARK = { '?': '🪙', M: '🍄', S: '⭐' };

// Las 3 ranuras guardadas: { theme (índice de EDITOR_THEMES), rows (15 renglones de letras), tested } o null.
export const myLevels = {
  all() {
    const slots = settings.get(KEY, {}).slots ?? [];
    return Array.from({ length: SLOT_COUNT }, (_, i) => (slots[i] ? JSON.parse(JSON.stringify(slots[i])) : null));
  },
  get(slot) {
    return this.all()[slot];
  },
  save(slot, level) {
    const slots = this.all();
    slots[slot] = level;
    settings.set(KEY, { slots });
  },
};

// Un nivel nuevo: piso de lado a lado, la salida y la meta.
export function blankLevel(theme = 0) {
  const rows = Array.from({ length: ROWS }, (_, r) => (r >= ROWS - 2 ? '#' : ' ').repeat(COLS));
  const put = (c, r, ch) => (rows[r] = rows[r].slice(0, c) + ch + rows[r].slice(c + 1));
  put(2, ROWS - 3, '@');
  put(COLS - 5, ROWS - 3, 'F');
  return { theme, rows, tested: false };
}

// El nivel listo para jugarse (como los de levels.js).
export function levelSpec(level, slot) {
  const look = EDITOR_THEMES[level.theme] ?? EDITOR_THEMES[0];
  return { name: `Mi nivel ${slot + 1}`, theme: look.theme, background: look.theme, rows: [...level.rows], ice: look.ice, gravity: look.gravity };
}

// Qué le falta para poder jugarse (null si ya está).
export function levelProblem(level) {
  const text = level.rows.join('');
  if (!text.includes('@')) return '¡Le falta la salida! Ponle la bolita verde';
  if (!text.includes('F')) return '¡Le falta la meta! Ponle la bandera';
  return null;
}

export class Editor {
  // `state`: dónde estaba el cuadrito, la pieza y hasta dónde se veía (para regresar igual después de probar).
  constructor(scene, slot, state = {}) {
    this.scene = scene;
    this.slot = slot;
    this.level = myLevels.get(slot) ?? blankLevel();
    this.grid = this.level.rows.map((row) => row.padEnd(COLS, ' ').slice(0, COLS).split(''));
    this.cursor = { ...(state.cursor ?? { c: 6, r: ROWS - 3 }) };
    this.piece = state.piece ?? 0;
    this.scroll = state.scroll ?? 0;
    this.repeat = { dir: null, ms: 0 };
    this.menu = null;
    this.dirty = false;
    this.saveMs = 0;
    this.cells = new Map();
    this.build();
  }

  get look() {
    return EDITOR_THEMES[this.level.theme] ?? EDITOR_THEMES[0];
  }

  build() {
    const scene = this.scene;
    const { width, height } = scene.scale;
    this.keys = themeTextures(scene, this.look.theme);
    this.root = scene.add.container(0, 0).setDepth(DEPTH).setScrollFactor(0);
    this.sky = scene.add.rectangle(width / 2, height / 2, width, height, THEMES[this.look.theme]?.sky ?? 0x8fd3ff);
    this.root.add(this.sky);
    // El nivel (más chiquito) con su cuadrícula.
    this.layer = scene.add.container(-this.scroll * CELL, GRID_Y).setScale(ZOOM);
    const lines = scene.add.graphics();
    lines.lineStyle(2, 0xffffff, 0.22);
    for (let c = 0; c <= COLS; c += 1) lines.lineBetween(c * T, 0, c * T, ROWS * T);
    for (let r = 0; r <= ROWS; r += 1) lines.lineBetween(0, r * T, COLS * T, r * T);
    this.cellLayer = scene.add.container(0, 0);
    this.ghost = scene.add.container(0, 0).setAlpha(0.55);
    this.cursorBox = scene.add.rectangle(0, 0, T, T).setOrigin(0, 0).setStrokeStyle(7, 0xffd84d);
    scene.tweens.add({ targets: this.cursorBox, alpha: 0.45, duration: 380, yoyo: true, repeat: -1 });
    this.layer.add([lines, this.cellLayer, this.ghost, this.cursorBox]);
    this.root.add(this.layer);
    // Arriba: qué nivel es y los botones.
    this.root.add(scene.add.rectangle(width / 2, GRID_Y / 2, width, GRID_Y, INK, 0.85));
    this.title = scene.add.text(16, GRID_Y / 2, '', textStyle(22, TEXT.accent, OUTLINE)).setOrigin(0, 0.5);
    const hints = 'A poner · B borrar · LB RB pieza · Y ¡probar! · X menú';
    this.root.add([this.title, scene.add.text(width - 16, GRID_Y / 2, hints, textStyle(18, '#ffffff', OUTLINE)).setOrigin(1, 0.5)]);
    // Abajo: la tira de piezas.
    const paletteY = GRID_Y + ROWS * CELL;
    this.root.add(scene.add.rectangle(width / 2, (paletteY + height) / 2, width, height - paletteY, INK, 0.85));
    this.palette = scene.add.container(width / 2, paletteY + 40);
    this.pieceName = scene.add.text(width / 2, height - 14, '', textStyle(20, TEXT.accent, OUTLINE)).setOrigin(0.5, 1);
    this.root.add([this.palette, this.pieceName]);
    this.toast = scene.add
      .text(width / 2, GRID_Y + 40, '', textStyle(28, '#ffffff', { ...OUTLINE, strokeThickness: 7 }))
      .setOrigin(0.5, 0)
      .setAlpha(0);
    this.root.add(this.toast);
    this.refreshTitle();
    this.drawAll();
    this.drawPalette();
    this.moveCursor(0, 0, { paint: false });
  }

  refreshTitle() {
    this.title.setText(`🛠️ Mi nivel ${this.slot + 1}   ·   ${this.look.emoji} ${this.look.name}`);
  }

  // Un mensajito arriba que se desvanece.
  showToast(text) {
    this.scene.tweens.killTweensOf(this.toast);
    this.toast.setText(text).setAlpha(1);
    this.scene.tweens.add({ targets: this.toast, alpha: 0, delay: 1800, duration: 400 });
  }

  // ---------- Dibujar ----------

  at(c, r) {
    if (c < 0 || c >= COLS) return 'X';
    if (r < 0 || r >= ROWS) return ' ';
    return this.grid[r][c];
  }

  drawAll() {
    for (const cell of this.cells.values()) cell.destroy();
    this.cells.clear();
    for (let r = 0; r < ROWS; r += 1) for (let c = 0; c < COLS; c += 1) this.drawCell(c, r);
  }

  drawCell(c, r) {
    if (c < 0 || c >= COLS || r < 0 || r >= ROWS) return;
    const id = `${c},${r}`;
    this.cells.get(id)?.destroy();
    this.cells.delete(id);
    const ch = this.grid[r][c];
    if (ch === ' ') return;
    const cell = TILE_CHARS.has(ch) ? this.tileImage(ch, c, r) : this.entityIcon(ch);
    if (!cell) return;
    if (!TILE_CHARS.has(ch)) cell.setPosition(c * T + T / 2, (r + 1) * T);
    this.cellLayer.add(cell);
    this.cells.set(id, cell);
  }

  tileImage(ch, c, r) {
    // (Las cosas encima no cuentan para el dibujo de los cuadritos: el piso con algo encima sigue siendo pasto.)
    const view = { at: (cc, rr) => (TILE_CHARS.has(this.at(cc, rr)) ? this.at(cc, rr) : ' ') };
    const key = tileTexture(this.keys, view, c, r);
    if (!key) return null;
    const image = this.scene.add.image(c * T, r * T, key).setOrigin(0, 0);
    if (!BOX_MARK[ch]) return image;
    const box = this.scene.add.container(c * T, r * T, [image.setPosition(0, 0)]);
    box.add(this.scene.add.text(T - 2, T - 2, BOX_MARK[ch], textStyle(18)).setOrigin(1, 1));
    return box;
  }

  // Lo que va encima de los cuadritos (parado en (0, 0), los pies abajo).
  entityIcon(ch) {
    const scene = this.scene;
    const box = scene.add.container(0, 0);
    if (ch === 'o') box.add(artImage(scene, 'plat:objeto-moneda', 30, { color: 0xffc93c }).setY(-9));
    else if (ch === 'R') box.add(artImage(scene, 'plat:objeto-resorte', 44, { color: 0xe53935 }));
    else if (ch === 'D') box.add(artImage(scene, 'plat:dinosaurio', 46, { color: 0x4cd97b }));
    else if (ch === 'm') {
      box.add(scene.add.rectangle(0, -T + 14, T * 3 - 8, 22, 0xc98a4a).setStrokeStyle(4, INK));
      box.add(scene.add.text(0, -T + 14, '↔', textStyle(20, '#ffffff', OUTLINE)).setOrigin(0.5));
    } else if (ch === '@') {
      box.add(scene.add.circle(0, -T / 2, 21, 0x4cd97b).setStrokeStyle(4, INK));
      box.add(scene.add.text(2, -T / 2, '▶', textStyle(22, '#ffffff', OUTLINE)).setOrigin(0.5));
    } else if (ch === 'F' || ch === 'C') {
      const goal = ch === 'F';
      const h = goal ? T * 2.6 : T * 1.6;
      box.add(scene.add.rectangle(0, -h / 2, 7, h, 0xe8e8f0).setStrokeStyle(3, INK));
      box.add(
        scene.add
          .triangle(4, -h + 4, 0, 0, goal ? 40 : 28, goal ? 14 : 10, 0, goal ? 28 : 20, goal ? 0x4cd97b : 0x8a86b8)
          .setOrigin(0, 0)
          .setStrokeStyle(3, INK),
      );
    } else if (ENEMIES[ch]) {
      const type = ENEMIES[ch];
      box.add(artImage(scene, type.art, Math.min(44, type.size), { color: type.color }));
    }
    return box;
  }

  // El dibujo de una pieza para la tira de abajo (centrado).
  pieceIcon(piece) {
    const scene = this.scene;
    const box = scene.add.container(0, 0);
    const tile = { '#': 'top', X: 'stone', B: 'brick', '?': 'question', M: 'question', S: 'question', '=': 'semi', '^': 'spikes', L: 'lavaTop' }[piece.ch];
    if (tile) {
      box.add(scene.add.image(0, 0, this.keys[tile]));
      if (BOX_MARK[piece.ch]) box.add(scene.add.text(T / 2 - 2, T / 2 - 2, BOX_MARK[piece.ch], textStyle(18)).setOrigin(1, 1));
    } else if (piece.ch === 'pipe') {
      box.add([scene.add.image(-T / 2, 0, this.keys.pipeTL), scene.add.image(T / 2, 0, this.keys.pipeTR)]);
      box.setScale(0.7);
    } else {
      const icon = this.entityIcon(piece.ch).setY(T / 2);
      if (piece.ch === 'F') icon.setScale(0.7);
      if (piece.ch === 'm') icon.setScale(0.55).setY(T * 0.7);
      box.add(icon);
    }
    return box;
  }

  drawPalette() {
    const scene = this.scene;
    this.palette.removeAll(true);
    const span = 6;
    for (let k = -span; k <= span; k += 1) {
      const i = (this.piece + k + PIECES.length * 4) % PIECES.length;
      const selected = k === 0;
      const x = k * 92;
      const slot = scene.add.container(x, 0);
      slot.add(
        scene.add.rectangle(0, 0, 76, 70, selected ? 0x3a3170 : COLORS.panel).setStrokeStyle(selected ? 6 : 3, selected ? 0xffd84d : COLORS.panelBorder),
      );
      slot.add(this.pieceIcon(PIECES[i]).setScale(selected ? 1 : 0.85));
      slot.setScale(selected ? 1.12 : 0.9).setAlpha(selected ? 1 : Math.max(0.35, 1 - Math.abs(k) * 0.11));
      this.palette.add(slot);
    }
    this.pieceName.setText(`◀ LB   ${PIECES[this.piece].name}   RB ▶`);
    // La pieza fantasma debajo del cuadrito.
    this.ghost.removeAll(true);
    const piece = PIECES[this.piece];
    const preview =
      piece.ch === 'pipe' || TILE_CHARS.has(piece.ch) ? this.pieceIcon(piece).setPosition(T / 2, T / 2) : this.entityIcon(piece.ch).setPosition(T / 2, T);
    this.ghost.add(preview);
  }

  // ---------- Mover y poner ----------

  moveCursor(dc, dr, { paint = true } = {}) {
    const c = Math.max(0, Math.min(COLS - 1, this.cursor.c + dc));
    const r = Math.max(0, Math.min(ROWS - 1, this.cursor.r + dr));
    this.cursor = { c, r };
    if (c < this.scroll + MARGIN) this.scroll = Math.max(0, c - MARGIN);
    if (c > this.scroll + VISIBLE - 1 - MARGIN) this.scroll = Math.min(COLS - VISIBLE, c - VISIBLE + 1 + MARGIN);
    this.layer.x = -this.scroll * CELL;
    this.cursorBox.setPosition(c * T, r * T);
    this.ghost.setPosition(c * T, r * T);
    // Con A (o B) sostenido, mover pinta (o borra).
    if (!paint) return;
    const id = this.deviceId;
    if (controls.isDown(id, 'a')) this.place({ quiet: true });
    else if (controls.isDown(id, 'b')) this.erase({ quiet: true });
  }

  get deviceId() {
    return players.host()?.deviceId ?? null;
  }

  // Cambia una letra (y redibuja: el cuadrito de abajo cambia de dibujo si le pusiste algo encima).
  set(c, r, ch) {
    if (this.grid[r][c] === ch) return false;
    if (PIPE.has(this.grid[r][c]) && !PIPE.has(ch)) this.clearPipe(c, r);
    this.grid[r][c] = ch;
    this.changed(c, r);
    return true;
  }

  changed(c, r) {
    this.drawCell(c, r);
    this.drawCell(c, r + 1);
    this.dirty = true;
    this.level.tested = false;
  }

  place({ quiet = false } = {}) {
    const { c, r } = this.cursor;
    const piece = PIECES[this.piece];
    let done;
    if (piece.ch === 'pipe') done = this.placePipe(c, r);
    else {
      // La salida y la meta: solo una de cada una (la otra se quita).
      if (piece.ch === '@' || piece.ch === 'F') {
        this.grid.forEach((row, rr) => row.forEach((ch, cc) => ch === piece.ch && (cc !== c || rr !== r) && this.set(cc, rr, ' ')));
      }
      done = this.set(c, r, piece.ch);
    }
    if (done && !quiet) sfx.pickup();
  }

  // Un tubo de la boca (donde está el cuadrito) para abajo hasta topar con algo.
  placePipe(c, r) {
    if (c + 1 >= COLS) return false;
    this.set(c, r, '[');
    this.set(c + 1, r, ']');
    for (let rr = r + 1; rr < ROWS; rr += 1) {
      if (isSolid(this.at(c, rr)) || isSolid(this.at(c + 1, rr))) break;
      this.set(c, rr, '(');
      this.set(c + 1, rr, ')');
    }
    return true;
  }

  // Quita un tubo entero (todos sus pedazos pegados).
  clearPipe(c, r) {
    const queue = [[c, r]];
    while (queue.length) {
      const [cc, rr] = queue.pop();
      if (!PIPE.has(this.at(cc, rr))) continue;
      this.grid[rr][cc] = ' ';
      this.changed(cc, rr);
      queue.push([cc - 1, rr], [cc + 1, rr], [cc, rr - 1], [cc, rr + 1]);
    }
  }

  erase({ quiet = false } = {}) {
    const { c, r } = this.cursor;
    const ch = this.grid[r][c];
    if (ch === ' ') return;
    if (PIPE.has(ch)) this.clearPipe(c, r);
    else this.set(c, r, ' ');
    if (!quiet) sfx.poof();
  }

  setTheme(index) {
    this.level.theme = (index + EDITOR_THEMES.length) % EDITOR_THEMES.length;
    this.keys = themeTextures(this.scene, this.look.theme);
    this.sky.setFillStyle(THEMES[this.look.theme]?.sky ?? 0x8fd3ff);
    this.dirty = true;
    this.refreshTitle();
    this.drawAll();
    this.drawPalette();
    say(this.look.name);
  }

  save() {
    this.level.rows = this.grid.map((row) => row.join(''));
    myLevels.save(this.slot, this.level);
    this.dirty = false;
  }

  // Para regresar igual después de probar.
  state() {
    return { cursor: { ...this.cursor }, piece: this.piece, scroll: this.scroll };
  }

  // ---------- Cada cuadro ----------

  // Devuelve 'test' (probar), 'exit' (guardar y salir) o null.
  update(dt) {
    const id = this.deviceId;
    if (!id) return null;
    if (this.dirty) {
      this.saveMs += dt;
      if (this.saveMs > SAVE_EVERY_MS) {
        this.saveMs = 0;
        this.save();
      }
    }
    if (this.menu) return this.updateMenu(id);
    this.updateCursor(dt, id);
    const exiting = controls.isDown(id, 'lb') && controls.isDown(id, 'rb');
    const step = (controls.justPressed(id, 'rb') ? 1 : 0) - (controls.justPressed(id, 'lb') ? 1 : 0);
    if (step && !exiting) {
      this.piece = (this.piece + step + PIECES.length) % PIECES.length;
      this.drawPalette();
      sfx.select();
      say(PIECES[this.piece].name);
    }
    if (controls.justPressed(id, 'a')) this.place();
    if (controls.justPressed(id, 'b')) this.erase();
    if (controls.justPressed(id, 'y') && !exiting) return 'test';
    if (controls.justPressed(id, 'x')) this.openMenu();
    return null;
  }

  updateCursor(dt, id) {
    const dirs = { left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1] };
    for (const [name, [dc, dr]] of Object.entries(dirs)) {
      if (!controls.justPressed(id, name)) continue;
      this.repeat = { dir: name, ms: REPEAT.firstMs };
      this.moveCursor(dc, dr);
      return;
    }
    if (!this.repeat.dir || !controls.isDown(id, this.repeat.dir)) {
      this.repeat.dir = null;
      return;
    }
    this.repeat.ms -= dt;
    if (this.repeat.ms > 0) return;
    this.repeat.ms = REPEAT.everyMs;
    const [dc, dr] = dirs[this.repeat.dir];
    this.moveCursor(dc, dr);
  }

  // ---------- Menú (X) ----------

  openMenu() {
    const scene = this.scene;
    const { width, height } = scene.scale;
    sfx.confirm();
    const items = [
      { id: 'theme', label: () => `🌍 Mundo: ${this.look.emoji} ${this.look.name}   ◀ ▶` },
      { id: 'test', label: () => '▶️ ¡Probar mi nivel!' },
      { id: 'clear', label: () => (this.menu?.confirm ? '🧹 ¿Seguro? Aprieta A otra vez' : '🧹 Borrar todo') },
      { id: 'exit', label: () => '💾 Guardar y salir' },
    ];
    const root = scene.add.container(0, 0);
    root.add(scene.add.rectangle(width / 2, height / 2, width, height, 0x14112b, 0.7));
    root.add(scene.add.rectangle(width / 2, height / 2, 660, 380, COLORS.panel).setStrokeStyle(6, 0xffd84d));
    root.add(scene.add.text(width / 2, height / 2 - 150, 'Menú', textStyle(40, TEXT.accent, OUTLINE)).setOrigin(0.5));
    const rows = items.map((item, i) => {
      const text = scene.add.text(width / 2, height / 2 - 70 + i * 66, '', textStyle(28, '#ffffff', OUTLINE)).setOrigin(0.5);
      root.add(text);
      return text;
    });
    root.add(scene.add.text(width / 2, height / 2 + 168, '▲ ▼ escoger · A = ¡va! · B = regresar', textStyle(18, TEXT.accent, OUTLINE)).setOrigin(0.5));
    this.root.add(root);
    this.menu = { root, items, rows, selected: 0, confirm: false };
    this.refreshMenu();
  }

  refreshMenu() {
    const menu = this.menu;
    menu.rows.forEach((row, i) =>
      row
        .setText(menu.items[i].label())
        .setColor(i === menu.selected ? TEXT.accent : '#ffffff')
        .setScale(i === menu.selected ? 1.08 : 1),
    );
  }

  closeMenu() {
    this.menu.root.destroy();
    this.menu = null;
  }

  updateMenu(id) {
    const menu = this.menu;
    const step = (controls.justPressed(id, 'down') ? 1 : 0) - (controls.justPressed(id, 'up') ? 1 : 0);
    if (step) {
      menu.selected = (menu.selected + step + menu.items.length) % menu.items.length;
      menu.confirm = false;
      sfx.select();
      say(
        menu.items[menu.selected]
          .label()
          .replace(/^\S+\s/, '')
          .replace(/[◀▶]/g, ''),
      );
      this.refreshMenu();
    }
    const item = menu.items[menu.selected].id;
    const side = (controls.justPressed(id, 'right') ? 1 : 0) - (controls.justPressed(id, 'left') ? 1 : 0);
    if (side && item === 'theme') {
      this.setTheme(this.level.theme + side);
      this.refreshMenu();
    }
    if (controls.justPressed(id, 'b') || controls.justPressed(id, 'x')) {
      sfx.back();
      this.closeMenu();
      return null;
    }
    if (!controls.justPressed(id, 'a')) return null;
    if (item === 'theme') {
      this.setTheme(this.level.theme + 1);
      this.refreshMenu();
    } else if (item === 'test') {
      this.closeMenu();
      return 'test';
    } else if (item === 'clear') {
      if (!menu.confirm) {
        menu.confirm = true;
        sfx.select();
        say('¿Seguro? Aprieta A otra vez');
        this.refreshMenu();
        return null;
      }
      const theme = this.level.theme;
      this.level = blankLevel(theme);
      this.grid = this.level.rows.map((row) => row.split(''));
      this.dirty = true;
      this.drawAll();
      sfx.boom();
      this.closeMenu();
      this.showToast('¡Todo limpio!');
    } else if (item === 'exit') {
      this.closeMenu();
      return 'exit';
    }
    return null;
  }

  destroy() {
    this.root.destroy();
  }
}

// ---------- Tus niveles (las 3 ranuras) ----------

// Los colores de la miniatura de cada nivel (un puntito por cuadrito).
const PREVIEW = {
  '#': '#b9773f',
  X: '#9a9aae',
  B: '#c8643a',
  '?': '#9b5de5',
  M: '#9b5de5',
  S: '#9b5de5',
  '=': '#e8c27a',
  '[': '#8a5a33',
  ']': '#8a5a33',
  '(': '#8a5a33',
  ')': '#8a5a33',
  '^': '#ffffff',
  L: '#ff5a1f',
  o: '#ffd84d',
  '@': '#4cd97b',
  F: '#4cd97b',
  C: '#d0d0e0',
  R: '#e53935',
  m: '#c98a4a',
  D: '#4cd97b',
};
const DOT = 3;

function previewTexture(scene, level, slot) {
  const key = `plat:mi-nivel-${slot}`;
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const canvas = document.createElement('canvas');
  canvas.width = COLS * DOT;
  canvas.height = ROWS * DOT;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = `#${(THEMES[EDITOR_THEMES[level.theme]?.theme]?.sky ?? 0x8fd3ff).toString(16).padStart(6, '0')}`;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  level.rows.forEach((row, r) =>
    [...row].forEach((ch, c) => {
      if (ch === ' ') return;
      ctx.fillStyle = PREVIEW[ch] ?? (ENEMIES[ch] ? '#ff5a5f' : '#ffffff');
      ctx.fillRect(c * DOT, r * DOT, DOT, DOT);
    }),
  );
  scene.textures.addCanvas(key, canvas);
  return key;
}

const CARD_X = [250, 640, 1030];

// La pantalla de "Arma tu nivel": las 3 ranuras con su miniatura. ◀ ▶ escoger, A armar, X jugar, B regresar.
export function showMyLevels(scene, selected = 0) {
  const { width, height } = scene.scale;
  const root = scene.add
    .container(0, 0)
    .setDepth(DEPTH + 1)
    .setScrollFactor(0);
  root.add(scene.add.rectangle(width / 2, height / 2, width, height, 0x14112b, 0.94));
  root.add(scene.add.text(width / 2, 80, '🛠️ Arma tu nivel', textStyle(52, TEXT.accent, { ...OUTLINE, strokeThickness: 10 })).setOrigin(0.5));
  root.add(scene.add.text(width / 2, 145, 'Haz tu propio nivel y juégalo con todos', textStyle(24, '#ffffff', OUTLINE)).setOrigin(0.5));
  const levels = myLevels.all();
  const cards = levels.map((level, i) => {
    const card = scene.add.container(CARD_X[i], 360);
    const back = scene.add.rectangle(0, 0, 350, 300, COLORS.panel).setStrokeStyle(5, COLORS.panelBorder);
    card.add(back);
    card.add(scene.add.text(0, -118, `Nivel ${i + 1}`, textStyle(32, '#ffffff', OUTLINE)).setOrigin(0.5));
    if (level) {
      const look = EDITOR_THEMES[level.theme] ?? EDITOR_THEMES[0];
      card.add(
        scene.add
          .image(0, -20, previewTexture(scene, level, i))
          .setScale(1.3)
          .setOrigin(0.5),
      );
      card.add(scene.add.text(0, 60, `${look.emoji} ${look.name}`, textStyle(22, '#ffffff', OUTLINE)).setOrigin(0.5));
      const status = levelProblem(level) ? '⚠️ Le falta algo' : level.tested ? '✓ ¡Ya lo pasaron!' : 'Sin probar';
      card.add(scene.add.text(0, 100, status, textStyle(20, level.tested ? '#7dff7a' : TEXT.muted, OUTLINE)).setOrigin(0.5));
    } else {
      card.add(scene.add.text(0, 0, '＋', textStyle(80, TEXT.muted)).setOrigin(0.5));
      card.add(scene.add.text(0, 90, 'Vacío: A para empezar', textStyle(20, TEXT.muted, OUTLINE)).setOrigin(0.5));
    }
    root.add(card);
    return { card, back };
  });
  root.add(scene.add.text(width / 2, height - 50, '◀ ▶ escoger · A = armar · X = ¡jugar! · B = regresar', textStyle(22, TEXT.accent, OUTLINE)).setOrigin(0.5));
  const menu = {
    root,
    selected,
    levels,
    select(i, { speak = true } = {}) {
      menu.selected = (i + SLOT_COUNT) % SLOT_COUNT;
      cards.forEach(({ card, back }, k) => {
        card.setScale(k === menu.selected ? 1.06 : 1);
        back.setStrokeStyle(k === menu.selected ? 8 : 5, k === menu.selected ? 0xffd84d : COLORS.panelBorder);
      });
      if (speak) say(`Nivel ${menu.selected + 1}${levels[menu.selected] ? '' : '. Vacío'}`);
    },
  };
  menu.select(selected, { speak: false });
  say('Arma tu nivel');
  return menu;
}
