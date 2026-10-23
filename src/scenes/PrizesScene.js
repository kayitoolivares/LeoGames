import Phaser from 'phaser';
import { controls } from '../shared/controls.js';
import { players } from '../shared/players.js';
import { STICKERS, UNLOCKS, rewards } from '../shared/rewards.js';
import { sfx } from '../shared/sound.js';
import { say } from '../shared/voice.js';
import { COLORS, TEXT, textStyle } from '../ui/style.js';

const COLUMNS = 10;
const CELL_W = 118;
const CELL_H = 150;
const GAP = 10;
// Dónde va el álbum (de arriba hacia abajo). Son muchas calcomanías: van en páginas de 4 filas (al pasar de la
// última fila a la siguiente se cambia de página).
const AREA = { top: 135, bottom: 612 };
const ROWS_PER_PAGE = 4;
const PER_PAGE = COLUMNS * ROWS_PER_PAGE;

// "Mis premios": el álbum de calcomanías. Las que faltan salen con "?" y la pista de cómo ganarlas;
// al moverse por el álbum la voz lee la calcomanía (para quien todavía no lee). B = regresar.
export class PrizesScene extends Phaser.Scene {
  constructor() {
    super('Premios');
  }

  init(data) {
    this.returnData = data ?? {};
    this.selected = 0;
  }

  create() {
    const { width, height } = this.scale;
    this.add.text(width / 2, 46, 'Mis premios', textStyle(48, TEXT.normal, { fontStyle: 'bold' })).setOrigin(0.5);
    this.countText = this.add.text(width / 2, 96, '', textStyle(24, TEXT.accent)).setOrigin(0.5);
    this.album = this.add.container(0, 0);
    this.page = -1;

    this.detail = this.add.text(width / 2, 642, '', textStyle(24, TEXT.normal, { align: 'center', wordWrap: { width: 1100 } })).setOrigin(0.5);
    this.add.text(width / 2, height - 22, 'Stick = ver cada calcomanía   ·   B = regresar', textStyle(18, TEXT.muted)).setOrigin(0.5);
    this.select(0, false);
  }

  // Dibuja la página `page` del álbum.
  drawPage(page) {
    this.page = page;
    this.album.removeAll(true);
    const { width } = this.scale;
    const pages = Math.ceil(STICKERS.length / PER_PAGE);
    this.countText.setText(`${rewards.count()} de ${STICKERS.length} calcomanías${pages > 1 ? `   ·   página ${page + 1} de ${pages}` : ''}`);
    const startX = (width - (COLUMNS * CELL_W + (COLUMNS - 1) * GAP)) / 2 + CELL_W / 2;
    const rows = Math.min(ROWS_PER_PAGE, Math.ceil(STICKERS.length / COLUMNS));
    const cellH = Math.min(CELL_H, (AREA.bottom - AREA.top - (rows - 1) * GAP) / rows);
    const k = cellH / CELL_H;
    this.cells = STICKERS.slice(page * PER_PAGE, (page + 1) * PER_PAGE).map((sticker, i) => {
      const x = startX + (i % COLUMNS) * (CELL_W + GAP);
      const y = AREA.top + cellH / 2 + Math.floor(i / COLUMNS) * (cellH + GAP);
      const has = rewards.has(sticker.id);
      const bg = this.add.rectangle(x, y, CELL_W, cellH, has ? COLORS.panel : 0x1b1730).setRounded(18);
      const emoji = this.add.text(x, y - 26 * k, has ? sticker.emoji : '?', textStyle(Math.round((has ? 58 : 50) * k), has ? TEXT.normal : TEXT.muted, { fontStyle: 'bold' })).setOrigin(0.5);
      const name = this.add.text(x, y + 40 * k, has ? sticker.name : '???', textStyle(16, has ? TEXT.normal : TEXT.muted, { fontStyle: 'bold', align: 'center', wordWrap: { width: CELL_W - 14 } })).setOrigin(0.5);
      this.album.add([bg, emoji, name]);
      return { sticker, has, bg };
    });
  }

  select(index, speak = true) {
    this.selected = (index + STICKERS.length) % STICKERS.length;
    const page = Math.floor(this.selected / PER_PAGE);
    if (page !== this.page) this.drawPage(page);
    const local = this.selected - page * PER_PAGE;
    this.cells.forEach(({ bg }, i) => bg.setStrokeStyle(i === local ? 6 : 2, i === local ? COLORS.accent : COLORS.panelBorder));
    const { sticker, has } = this.cells[local];
    const unlock = Object.values(UNLOCKS).find((u) => u.sticker === sticker.id);
    const extra = unlock ? '  ·  🔓 desbloquea algo nuevo' : '';
    const text = has ? `${sticker.emoji}  ${sticker.name}: ${sticker.hint}${extra}` : `Para ganarla: ${sticker.hint}${extra}`;
    this.detail.setText(text);
    if (speak) say(has ? `${sticker.name}. ${sticker.hint}` : `Para ganarla: ${sticker.hint}`);
  }

  update() {
    const host = players.host();
    if (!host) {
      this.scene.start('Join');
      return;
    }
    const id = host.deviceId;
    const move =
      (controls.justPressed(id, 'right') ? 1 : 0) -
      (controls.justPressed(id, 'left') ? 1 : 0) +
      (controls.justPressed(id, 'down') ? COLUMNS : 0) -
      (controls.justPressed(id, 'up') ? COLUMNS : 0);
    if (move !== 0) {
      sfx.select();
      this.select(Math.min(STICKERS.length - 1, Math.max(0, this.selected + move)));
    }
    if (controls.justPressed(id, 'b')) {
      sfx.back();
      this.scene.start('Menu', { selected: this.returnData.selected });
    }
  }
}
