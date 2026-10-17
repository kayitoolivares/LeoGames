import Phaser from 'phaser';
import { controls } from '../../shared/controls.js';
import { players } from '../../shared/players.js';
import { Blob } from '../../ui/Blob.js';
import { COLORS, TEXT, hexToCss, textStyle } from '../../ui/style.js';
import { CHARACTERS, CHARACTER_KEYS, addAccessory } from './characters.js';

const CARD_W = 280;
const CARD_H = 470;
const CARD_GAP = 20;
const START_DELAY_MS = 700;

// Lo último que escogió cada control, para no tener que escogerlo otra vez.
const lastPicks = new Map();

// Antes de Bolitas Bros: cada jugador escoge su bolita con ◀ ▶ y aprieta A cuando está listo.
// Cuando todos están listos empieza la pelea. B quita el "listo"; si no estaba listo, el Jugador 1 regresa al menú.
export class SmashSelectScene extends Phaser.Scene {
  constructor() {
    super('SmashSelect');
  }

  init(data) {
    this.returnData = data ?? {};
  }

  create() {
    const { width, height } = this.scale;
    this.add.text(width / 2, 50, 'Escoge tu bolita', textStyle(52, TEXT.normal, { fontStyle: 'bold' })).setOrigin(0.5);
    this.add.text(width / 2, 100, '◀ ▶ cambiar   ·   A = ¡listo!   ·   B = regresar', textStyle(22, TEXT.accent)).setOrigin(0.5);

    const list = players.sorted();
    const total = list.length * CARD_W + (list.length - 1) * CARD_GAP;
    const startX = (width - total) / 2 + CARD_W / 2;
    this.slots = list.map((player, i) => {
      const pick = lastPicks.get(player.deviceId) ?? CHARACTER_KEYS[player.slot % CHARACTER_KEYS.length];
      return this.createCard(startX + i * (CARD_W + CARD_GAP), 395, player, pick);
    });
    if (list.length === 1) {
      this.add.text(width / 2, height - 24, 'Vas a pelear contra un CPU con un personaje al azar', textStyle(18, TEXT.muted)).setOrigin(0.5);
    }
    this.startMs = null;
  }

  createCard(x, y, player, pick) {
    const color = players.color(player).hex;
    const top = y - CARD_H / 2;
    const bg = this.add.rectangle(x, y, CARD_W, CARD_H, COLORS.panel).setRounded(24).setStrokeStyle(5, color);
    this.add.text(x, top + 30, `Jugador ${player.slot + 1}`, textStyle(24, hexToCss(color), { fontStyle: 'bold' })).setOrigin(0.5);
    const name = this.add.text(x, top + 220, '', textStyle(34, TEXT.normal, { fontStyle: 'bold' })).setOrigin(0.5);
    const blurb = this.add.text(x, top + 258, '', textStyle(18, TEXT.muted)).setOrigin(0.5);
    const special = this.add.text(x, top + 288, '', textStyle(18, TEXT.accent)).setOrigin(0.5);
    const statStyle = textStyle(18, TEXT.normal, { lineSpacing: 6 });
    const statLabels = this.add.text(x - CARD_W / 2 + 40, top + 318, '', statStyle);
    const statPips = this.add.text(x + 30, top + 318, '', statStyle);
    const status = this.add.text(x, top + CARD_H - 34, '', textStyle(24, TEXT.normal, { fontStyle: 'bold' })).setOrigin(0.5);
    const slot = { player, color, x, top, bg, name, blurb, special, statLabels, statPips, status, pick, ready: false, blob: null };
    this.showCharacter(slot);
    return slot;
  }

  // Redibuja la bolita de vista previa con el accesorio del personaje escogido.
  showCharacter(slot) {
    const c = CHARACTERS[slot.pick];
    slot.blob?.destroy();
    slot.blob = new Blob(this, slot.x, slot.top + 125, slot.color, c.radius * 1.5);
    addAccessory(this, slot.blob, slot.pick);
    slot.name.setText(c.name);
    slot.blurb.setText(c.blurb);
    slot.special.setText(`B: ${c.special}`);
    slot.statLabels.setText(Object.keys(c.stats).join('\n'));
    slot.statPips.setText(Object.values(c.stats).map((value) => '●'.repeat(value) + '○'.repeat(3 - value)).join('\n'));
    this.showStatus(slot);
  }

  showStatus(slot) {
    slot.status.setText(slot.ready ? '¡Listo!' : 'A = listo').setColor(slot.ready ? '#4cd97b' : TEXT.muted);
    slot.bg.setFillStyle(slot.ready ? 0x2b3d4a : COLORS.panel);
  }

  update() {
    for (const slot of this.slots) {
      const id = slot.player.deviceId;
      if (!controls.getDevice(id)?.connected) continue;
      if (!slot.ready) {
        const step = (controls.justPressed(id, 'right') ? 1 : 0) - (controls.justPressed(id, 'left') ? 1 : 0);
        if (step !== 0) {
          const index = CHARACTER_KEYS.indexOf(slot.pick);
          slot.pick = CHARACTER_KEYS[(index + step + CHARACTER_KEYS.length) % CHARACTER_KEYS.length];
          this.showCharacter(slot);
        }
        if (controls.justPressed(id, 'a')) {
          slot.ready = true;
          slot.blob.hop();
          this.showStatus(slot);
        } else if (controls.justPressed(id, 'b') && slot.player === players.host()) {
          this.scene.start('Menu', { selected: this.returnData.selected });
          return;
        }
      } else if (controls.justPressed(id, 'b')) {
        slot.ready = false;
        this.showStatus(slot);
      } else if (controls.justPressed(id, 'a')) {
        slot.blob.hop();
      }
    }

    // Todos listos: un momento para ver las bolitas brincar y a pelear.
    const allReady = this.slots.length > 0 && this.slots.every((slot) => slot.ready);
    if (!allReady) {
      this.startMs = null;
      return;
    }
    this.startMs ??= this.time.now;
    if (this.time.now - this.startMs < START_DELAY_MS) return;
    const picks = {};
    for (const slot of this.slots) {
      lastPicks.set(slot.player.deviceId, slot.pick);
      picks[slot.player.deviceId] = slot.pick;
    }
    this.scene.start('Smash', { selected: this.returnData.selected, picks });
  }
}
