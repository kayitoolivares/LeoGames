import Phaser from 'phaser';
import { controls } from '../../shared/controls.js';
import { characterPicks } from '../../shared/picks.js';
import { players } from '../../shared/players.js';
import { UNLOCKS, rewards } from '../../shared/rewards.js';
import { sfx } from '../../shared/sound.js';
import { defaultCharacter } from '../../scenes/CharacterSelectScene.js';
import { Blob } from '../../ui/Blob.js';
import { CharacterLook } from '../../ui/CharacterLook.js';
import { COLORS, TEXT, hexToCss, textStyle } from '../../ui/style.js';
import { characterTexture, loadSmashArt } from './art.js';
import { isBlockCharacter } from './bloquecito.js';
import { CHARACTERS, CHARACTER_KEYS, addAccessory } from './characters.js';
import { MODES, MODE_KEYS } from './modes.js';
import { STAGES, STAGE_KEYS } from './stages.js';

const CARD_W = 270;
const CARD_H = 420;
const CARD_GAP = 18;
const CARD_Y = 420;
const START_DELAY_MS = 700;
// Lo más alto que puede verse Bloquecito en la tarjeta (va contando del 1 al 10).
const PREVIEW_MAX_HEIGHT = 110;
const LEVEL_NAMES = { facil: 'Fácil', normal: 'Normal', dificil: 'Difícil' };

// Opciones de la pelea que escoge el Jugador 1 (↑ ↓ para elegir cuál, LB / RB para cambiarla).
const OPTIONS = [
  { key: 'mode', label: 'Modo', values: () => MODE_KEYS, show: (v) => MODES[v].name },
  { key: 'stage', label: 'Escenario', values: () => openStages(), show: (v) => STAGES[v].name },
  { key: 'items', label: 'Objetos', values: () => [true, false], show: (v) => (v ? 'Sí' : 'No') },
  { key: 'cpus', label: 'CPUs', values: (humans, settings) => cpuChoices(humans, settings.mode), show: String },
  { key: 'level', label: 'Nivel CPU', values: () => Object.keys(LEVEL_NAMES), show: (v) => LEVEL_NAMES[v] },
];

// Los escenarios que ya se ganaron (los demás salen abajo con su candado).
function openStages() {
  return STAGE_KEYS.filter((key) => rewards.unlocked(STAGES[key].unlock));
}

// Siempre hay al menos un rival, y entre todos no pasan de 4. Contra el jefe la compu es de tu equipo (puede no haber),
// y en Rompe los blancos no hay compu.
function cpuChoices(humans, mode = 'vidas') {
  if (mode === 'blancos') return [0];
  const list = [];
  for (let n = humans < 2 && mode !== 'jefe' ? 1 : 0; n <= 4 - humans; n += 1) list.push(n);
  return list;
}

// Lo último que se escogió, para no tener que escogerlo otra vez (el personaje se comparte con los demás juegos).
const lastPeque = new Map();
const lastSettings = { mode: 'vidas', stage: 'castillo', items: true, cpus: null, level: 'normal' };

// Antes de Bolitas Bros: cada jugador escoge su bolita con ◀ ▶, Y activa su modo peque y A = listo.
// El Jugador 1 además escoge escenario, objetos y CPUs. B quita el "listo"; si no estaba listo,
// el Jugador 1 regresa al menú.
export class SmashSelectScene extends Phaser.Scene {
  constructor() {
    super('SmashSelect');
  }

  init(data) {
    this.returnData = data ?? {};
  }

  preload() {
    loadSmashArt(this);
  }

  create() {
    const { width, height } = this.scale;
    this.humans = players.sorted();
    this.settings = { ...lastSettings };
    this.fixCpus();
    if (!openStages().includes(this.settings.stage)) this.settings.stage = 'castillo';
    this.optionIndex = 0;

    this.add.text(width / 2, 36, 'Escoge tu bolita', textStyle(44, TEXT.normal, { fontStyle: 'bold' })).setOrigin(0.5);
    this.optionChips = OPTIONS.map((option, i) => {
      const x = width / 2 + (i - (OPTIONS.length - 1) / 2) * 245;
      const bg = this.add.rectangle(x, 96, 232, 46, COLORS.panel).setRounded(14);
      const text = this.add.text(x, 96, '', textStyle(17, TEXT.normal, { fontStyle: 'bold' })).setOrigin(0.5);
      return { option, bg, text };
    });
    this.add
      .text(width / 2, 140, 'Jugador 1:  ↑ ↓ elegir opción  ·  LB / RB cambiarla', textStyle(17, TEXT.muted))
      .setOrigin(0.5);
    this.modeInfo = this.add.text(width / 2, 192, '', textStyle(17, TEXT.accent, { fontStyle: 'bold' })).setOrigin(0.5);
    const locked = STAGE_KEYS.filter((key) => !rewards.unlocked(STAGES[key].unlock));
    const lockText = locked.map((key) => `🔒 ${STAGES[key].name}: ${UNLOCKS[STAGES[key].unlock].label}`).join('   ·   ');
    this.add.text(width / 2, 166, lockText, textStyle(15, TEXT.muted)).setOrigin(0.5);
    this.add
      .text(width / 2, height - 22, '◀ ▶ personaje   ·   Y = modo peque 🐣   ·   A = ¡listo!   ·   B = regresar', textStyle(19, TEXT.accent))
      .setOrigin(0.5);

    this.humanSlots = this.humans.map((player) => ({
      player,
      color: players.color(player).hex,
      pick: characterPicks.get(player.deviceId, defaultCharacter(player)),
      peque: lastPeque.get(player.deviceId) ?? false,
      ready: false,
    }));
    this.cards = [];
    this.refreshOptions();
    this.layoutCards();
    this.startMs = null;
  }

  // Que el número de CPUs sea uno que ese modo permite.
  fixCpus() {
    const choices = cpuChoices(this.humans.length, this.settings.mode);
    if (!choices.includes(this.settings.cpus)) this.settings.cpus = choices[0];
  }

  refreshOptions() {
    this.modeInfo?.setText(MODES[this.settings.mode].info);
    this.optionChips.forEach(({ option, bg, text }, i) => {
      const selected = i === this.optionIndex;
      text.setText(`${option.label}: ${option.show(this.settings[option.key])}`);
      bg.setStrokeStyle(selected ? 4 : 2, selected ? COLORS.accent : COLORS.panelBorder);
    });
  }

  // Una tarjeta por jugador y una por cada CPU (se rehacen cuando cambia el número de CPUs).
  layoutCards() {
    for (const card of this.cards) card.container.destroy();
    const { width } = this.scale;
    const total = this.humanSlots.length + this.settings.cpus;
    const startX = (width - (total * CARD_W + (total - 1) * CARD_GAP)) / 2 + CARD_W / 2;
    this.cards = [];
    this.humanSlots.forEach((slot, i) => this.cards.push(this.humanCard(startX + i * (CARD_W + CARD_GAP), slot)));
    for (let i = 0; i < this.settings.cpus; i += 1) {
      this.cards.push(this.cpuCard(startX + (this.humanSlots.length + i) * (CARD_W + CARD_GAP), i));
    }
  }

  humanCard(x, slot) {
    const container = this.add.container(x, CARD_Y);
    const top = -CARD_H / 2;
    const bg = this.add.rectangle(0, 0, CARD_W, CARD_H, COLORS.panel).setRounded(24).setStrokeStyle(5, slot.color);
    const title = this.add.text(0, top + 28, `Jugador ${slot.player.slot + 1}`, textStyle(22, hexToCss(slot.color), { fontStyle: 'bold' })).setOrigin(0.5);
    const name = this.add.text(0, top + 196, '', textStyle(30, TEXT.normal, { fontStyle: 'bold' })).setOrigin(0.5);
    const blurb = this.add.text(0, top + 230, '', textStyle(17, TEXT.muted)).setOrigin(0.5);
    const special = this.add.text(0, top + 256, '', textStyle(17, TEXT.accent)).setOrigin(0.5);
    const statStyle = textStyle(16, TEXT.normal, { lineSpacing: 4 });
    const statLabels = this.add.text(-CARD_W / 2 + 40, top + 280, '', statStyle);
    const statPips = this.add.text(30, top + 280, '', statStyle);
    const peque = this.add.text(0, top + 362, '', textStyle(17, '#4cd97b', { fontStyle: 'bold' })).setOrigin(0.5);
    const status = this.add.text(0, top + CARD_H - 26, '', textStyle(22, TEXT.normal, { fontStyle: 'bold' })).setOrigin(0.5);
    container.add([bg, title, name, blurb, special, statLabels, statPips, peque, status]);
    const card = { container, slot, bg, name, blurb, special, statLabels, statPips, peque, status, blob: null };
    this.showCharacter(card);
    return card;
  }

  cpuCard(x, i) {
    const container = this.add.container(x, CARD_Y);
    const top = -CARD_H / 2;
    container.add([
      this.add.rectangle(0, 0, CARD_W, CARD_H, COLORS.panel).setRounded(24).setStrokeStyle(3, COLORS.panelBorder),
      this.add.text(0, top + 28, `${this.settings.cpus > 1 ? `CPU ${i + 1}` : 'CPU'}${this.settings.mode === 'jefe' ? ' (de tu equipo)' : ''}`, textStyle(20, TEXT.muted, { fontStyle: 'bold' })).setOrigin(0.5),
      // Bolita sin cara con un "?": el personaje del CPU se escoge al azar al empezar.
      this.add.circle(0, top + 112, 50, 0x8a86b8),
      this.add.text(0, top + 112, '?', textStyle(56, TEXT.normal, { fontStyle: 'bold' })).setOrigin(0.5),
      this.add.text(0, top + 196, 'Al azar', textStyle(30, TEXT.normal, { fontStyle: 'bold' })).setOrigin(0.5),
      this.add.text(0, top + 232, `Nivel: ${LEVEL_NAMES[this.settings.level]}`, textStyle(17, TEXT.muted)).setOrigin(0.5),
      this.add.text(0, top + CARD_H - 26, '¡Listo!', textStyle(22, '#4cd97b', { fontStyle: 'bold' })).setOrigin(0.5),
    ]);
    return { container, cpu: true };
  }

  // Redibuja la vista previa del personaje escogido: su imagen si existe, o la bolita con su accesorio.
  showCharacter(card) {
    const { slot } = card;
    const c = CHARACTERS[slot.pick];
    card.blob?.destroy();
    card.look = null;
    const key = characterTexture(this, slot.pick);
    if (isBlockCharacter(slot.pick)) {
      // Bloquecito no tiene imagen: se arma con bloques.
      const blob = new Blob(this, 0, -CARD_H / 2 + 112, slot.color, c.radius * 1.4);
      blob.list[0].setVisible(false);
      card.look = new CharacterLook(this, blob, slot.pick);
      card.blob = blob;
      card.hop = () => blob.hop();
    } else if (key) {
      const image = this.add.image(0, -CARD_H / 2 + 180, key).setOrigin(0.5, 1);
      image.setScale(140 / image.height);
      card.blob = image;
      card.hop = () => this.tweens.add({ targets: image, y: image.y - 20, duration: 140, yoyo: true, ease: 'Quad.easeOut' });
    } else {
      const blob = new Blob(this, 0, -CARD_H / 2 + 112, slot.color, c.radius * 1.4);
      addAccessory(this, blob, slot.pick);
      card.blob = blob;
      card.hop = () => blob.hop();
    }
    card.container.add(card.blob);
    card.name.setText(c.name);
    card.blurb.setText(c.blurb);
    card.special.setText(`B: ${c.special}`);
    card.statLabels.setText(Object.keys(c.stats).join('\n'));
    card.statPips.setText(Object.values(c.stats).map((value) => '●'.repeat(value) + '○'.repeat(3 - value)).join('\n'));
    this.showStatus(card);
  }

  showStatus(card) {
    const { slot } = card;
    card.status.setText(slot.ready ? '¡Listo!' : 'A = listo').setColor(slot.ready ? '#4cd97b' : TEXT.muted);
    card.peque.setText(slot.peque ? 'Modo peque 🐣' : '');
    card.bg.setFillStyle(slot.ready ? 0x2b3d4a : COLORS.panel);
  }

  update() {
    for (const card of this.cards) card.look?.showcase(PREVIEW_MAX_HEIGHT);
    if (this.updateOptions()) return;

    for (const card of this.cards) {
      if (card.cpu) continue;
      const { slot } = card;
      const id = slot.player.deviceId;
      if (!controls.getDevice(id)?.connected) continue;
      if (controls.justPressed(id, 'y')) {
        slot.peque = !slot.peque;
        sfx.select();
        this.showStatus(card);
      }
      if (!slot.ready) {
        const step = (controls.justPressed(id, 'right') ? 1 : 0) - (controls.justPressed(id, 'left') ? 1 : 0);
        if (step !== 0) {
          const index = CHARACTER_KEYS.indexOf(slot.pick);
          slot.pick = CHARACTER_KEYS[(index + step + CHARACTER_KEYS.length) % CHARACTER_KEYS.length];
          sfx.select();
          this.showCharacter(card);
        }
        if (controls.justPressed(id, 'a')) {
          slot.ready = true;
          sfx.confirm();
          card.hop();
          this.showStatus(card);
        } else if (controls.justPressed(id, 'b') && slot.player === players.host()) {
          sfx.back();
          this.scene.start('Menu', { selected: this.returnData.selected });
          return;
        }
      } else if (controls.justPressed(id, 'b')) {
        slot.ready = false;
        sfx.back();
        this.showStatus(card);
      } else if (controls.justPressed(id, 'a')) {
        card.hop();
      }
    }

    // Todos listos: un momento para ver las bolitas brincar y a pelear.
    const allReady = this.humanSlots.length > 0 && this.humanSlots.every((slot) => slot.ready);
    if (!allReady) {
      this.startMs = null;
      return;
    }
    this.startMs ??= this.time.now;
    if (this.time.now - this.startMs < START_DELAY_MS) return;
    this.start();
  }

  // ↑ ↓ y LB / RB del Jugador 1 cambian las opciones. Devuelve true si se rehicieron las tarjetas.
  updateOptions() {
    const host = players.host();
    if (!host) return false;
    const id = host.deviceId;
    const move = (controls.justPressed(id, 'down') ? 1 : 0) - (controls.justPressed(id, 'up') ? 1 : 0);
    if (move !== 0) {
      this.optionIndex = (this.optionIndex + move + OPTIONS.length) % OPTIONS.length;
      sfx.select();
      this.refreshOptions();
    }
    const step = (controls.justPressed(id, 'rb') ? 1 : 0) - (controls.justPressed(id, 'lb') ? 1 : 0);
    if (step === 0) return false;
    sfx.select();
    const option = OPTIONS[this.optionIndex];
    const values = option.values(this.humans.length, this.settings);
    const index = values.indexOf(this.settings[option.key]);
    this.settings[option.key] = values[(index + step + values.length) % values.length];
    if (option.key === 'mode') this.fixCpus();
    this.refreshOptions();
    if (option.key === 'cpus' || option.key === 'level' || option.key === 'mode') {
      this.layoutCards();
      return true;
    }
    return false;
  }

  start() {
    const picks = {};
    const peque = {};
    for (const slot of this.humanSlots) {
      characterPicks.set(slot.player.deviceId, slot.pick);
      lastPeque.set(slot.player.deviceId, slot.peque);
      picks[slot.player.deviceId] = slot.pick;
      peque[slot.player.deviceId] = slot.peque;
    }
    Object.assign(lastSettings, this.settings);
    this.scene.start('Smash', { selected: this.returnData.selected, picks, peque, settings: { ...this.settings } });
  }
}
