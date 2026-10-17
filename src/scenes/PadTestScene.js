import Phaser from 'phaser';
import { controls, readGamepads } from '../shared/controls.js';
import { frameDelta } from '../shared/clock.js';
import { COLORS, TEXT, textStyle } from '../ui/style.js';

// Nombres de los botones en el mapeo "standard" (el que usan los controles de Xbox).
const BUTTON_LABELS = ['A', 'B', 'X', 'Y', 'LB', 'RB', 'LT', 'RT', 'Vista', 'Menú', 'LS', 'RS', '↑', '↓', '←', '→', 'Xbox'];
const SLOTS = 4;
const PANEL_W = 600;
const PANEL_H = 250;
const CHIP_W = 58;
const CHIP_H = 34;
const CHIP_GAP = 4;
const CHIPS_PER_ROW = 9;
const EXIT_HOLD_MS = 1000;

// Diagnóstico: muestra lo que el navegador ve de cada control, tal cual, sin interpretar.
// Sirve para comprobar en el Xbox que se detectan los 4 controles y todos sus botones.
export class PadTestScene extends Phaser.Scene {
  constructor() {
    super('PadTest');
  }

  init(data) {
    this.returnData = data ?? {};
    this.exitMs = 0;
    this.exiting = false;
  }

  create() {
    const { width, height } = this.scale;
    this.add.text(width / 2, 44, 'Prueba de controles', textStyle(42, TEXT.normal, { fontStyle: 'bold' })).setOrigin(0.5);
    this.summary = this.add.text(width / 2, 92, '', textStyle(22, TEXT.accent)).setOrigin(0.5);

    this.panels = [];
    for (let i = 0; i < SLOTS; i += 1) {
      const side = i % 2 === 0 ? -1 : 1;
      const x = width / 2 + side * (PANEL_W / 2 + 12);
      const y = 250 + Math.floor(i / 2) * (PANEL_H + 20);
      this.panels.push(this.createPanel(x, y, i));
    }

    this.add
      .text(
        width / 2,
        height - 22,
        'Para salir: mantén B (o presiona Esc)   ·   Si en Xbox el control deja de responder: abre y cierra la guía (botón Xbox)',
        textStyle(16, TEXT.muted),
      )
      .setOrigin(0.5);
    this.input.keyboard?.on('keydown-ESC', () => this.exit());
  }

  createPanel(x, y, index) {
    const left = x - PANEL_W / 2 + 20;
    const top = y - PANEL_H / 2 + 14;
    const bg = this.add.rectangle(x, y, PANEL_W, PANEL_H, COLORS.panel).setRounded(20).setStrokeStyle(3, COLORS.panelBorder);
    this.add.text(left, top, `Control ${index + 1}`, textStyle(24, TEXT.normal, { fontStyle: 'bold' }));
    const status = this.add.text(x + PANEL_W / 2 - 20, top + 4, '', textStyle(20, TEXT.muted)).setOrigin(1, 0);
    const info = this.add.text(left, top + 36, '', textStyle(14, TEXT.muted, { wordWrap: { width: PANEL_W - 40 } }));

    const chips = BUTTON_LABELS.map((label, b) => {
      const cx = left + CHIP_W / 2 + (b % CHIPS_PER_ROW) * (CHIP_W + CHIP_GAP);
      const cy = top + 92 + Math.floor(b / CHIPS_PER_ROW) * (CHIP_H + 6);
      const rect = this.add.rectangle(cx, cy, CHIP_W, CHIP_H, COLORS.panelBorder).setRounded(8);
      const text = this.add.text(cx, cy, label, textStyle(15, TEXT.normal, { fontStyle: 'bold' })).setOrigin(0.5);
      return { rect, text, state: null };
    });

    const axes = this.add.text(left, top + 170, '', textStyle(17));
    const raw = this.add.text(left, top + 198, '', textStyle(15, TEXT.muted));
    return { bg, status, info, chips, axes, raw, connected: null };
  }

  update() {
    const pads = readGamepads();
    const byIndex = new Map(pads.map((pad) => [pad.index, pad]));
    const beyondSlots = pads.filter((pad) => pad.index >= SLOTS).length;

    let summary =
      pads.length === 0
        ? 'No se ve ningún control: presiona un botón.  En Xbox: mantén ≡ (Menú) → «Use game controls» → A'
        : `El navegador ve ${pads.length} ${pads.length === 1 ? 'control' : 'controles'}`;
    if (beyondSlots > 0) summary += ` (${beyondSlots} con número mayor a ${SLOTS}, no se muestran)`;
    setTextIfChanged(this.summary, summary);

    this.panels.forEach((panel, i) => this.updatePanel(panel, byIndex.get(i)));

    // B también se está probando, por eso para salir hay que mantenerlo.
    const holdingB = controls.connectedDevices().some((device) => controls.isDown(device.id, 'b'));
    this.exitMs = holdingB ? this.exitMs + frameDelta() : 0;
    if (this.exitMs >= EXIT_HOLD_MS) this.exit();
  }

  updatePanel(panel, pad) {
    const connected = Boolean(pad);
    if (panel.connected !== connected) {
      panel.connected = connected;
      panel.status.setText(connected ? 'Conectado' : 'Sin conectar').setColor(connected ? '#4cd97b' : TEXT.muted);
      panel.bg.setStrokeStyle(3, connected ? COLORS.ok : COLORS.panelBorder);
    }

    if (!connected) {
      setTextIfChanged(panel.info, '');
      setTextIfChanged(panel.axes, '');
      setTextIfChanged(panel.raw, '');
      panel.chips.forEach((chip) => setChip(chip, 'missing'));
      return;
    }

    setTextIfChanged(
      panel.info,
      `${pad.id.slice(0, 90)}\nmapeo: ${pad.mapping || '(ninguno)'}  ·  ${pad.buttons.length} botones  ·  ${pad.axes.length} ejes`,
    );

    const pressedIndexes = [];
    pad.buttons.forEach((button, b) => {
      if (button.pressed || button.value > 0.1) pressedIndexes.push(b);
    });
    panel.chips.forEach((chip, b) => {
      if (b >= pad.buttons.length) setChip(chip, 'missing');
      else setChip(chip, pressedIndexes.includes(b) ? 'on' : 'off');
    });

    const axis = (i) => (pad.axes[i] ?? 0).toFixed(2).padStart(5, ' ');
    setTextIfChanged(panel.axes, `Stick izq   x ${axis(0)}   y ${axis(1)}        Stick der   x ${axis(2)}   y ${axis(3)}`);
    setTextIfChanged(panel.raw, `Botones presionados (número): ${pressedIndexes.join(', ') || '—'}`);
  }

  exit() {
    if (this.exiting) return;
    this.exiting = true;
    this.scene.start('Menu', { selected: this.returnData.selected });
  }
}

function setTextIfChanged(textObject, value) {
  if (textObject.text !== value) textObject.setText(value);
}

function setChip(chip, state) {
  if (chip.state === state) return;
  chip.state = state;
  chip.rect.setFillStyle(state === 'on' ? COLORS.accent : COLORS.panelBorder, state === 'missing' ? 0.3 : 1);
  chip.text.setColor(state === 'on' ? TEXT.ink : TEXT.normal).setAlpha(state === 'missing' ? 0.3 : 1);
}
