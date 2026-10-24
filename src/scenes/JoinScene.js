import Phaser from 'phaser';
import { controls } from '../shared/controls.js';
import { frameDelta } from '../shared/clock.js';
import { audioReady, sfx } from '../shared/sound.js';
import { touchEnabled } from '../shared/touch.js';
import { say } from '../shared/voice.js';
import { rewards } from '../shared/rewards.js';
import { players, MAX_PLAYERS } from '../shared/players.js';
import { Blob } from '../ui/Blob.js';
import { COLORS, TEXT, textStyle } from '../ui/style.js';
import { go } from '../shared/transition.js';
import { Ambience } from '../ui/ambient.js';

const HOLD_TO_START_MS = 900;
const CARD_W = 260;
const CARD_H = 380;
const CARD_GAP = 30;
const BAR_W = CARD_W - 40;

// Pantalla "Presiona A para unirte": cada control que presiona A ocupa un lugar.
// El Jugador 1 mantiene A para pasar al menú (mantener evita que se salte por accidente).
export class JoinScene extends Phaser.Scene {
  constructor() {
    super('Join');
  }

  create() {
    const { width, height } = this.scale;
    this.ambience = new Ambience(this, 'menu', { depth: -10 });
    this.holdMs = 0;
    this.holding = false;
    this.holdDevice = null;

    const title = this.add.text(width / 2, 70, 'LeoGames', textStyle(72, TEXT.normal, { fontStyle: 'bold' })).setOrigin(0.5);
    this.tweens.add({ targets: title, y: 80, duration: 1200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.add.text(width / 2, 145, 'Presiona A para unirte', textStyle(30, TEXT.accent)).setOrigin(0.5);

    const totalW = MAX_PLAYERS * CARD_W + (MAX_PLAYERS - 1) * CARD_GAP;
    const startX = (width - totalW) / 2 + CARD_W / 2;
    this.cards = [];
    for (let slot = 0; slot < MAX_PLAYERS; slot += 1) {
      this.cards.push(this.createCard(startX + slot * (CARD_W + CARD_GAP), 385, slot));
    }

    this.padInfo = this.add.text(width / 2, height - 80, '', textStyle(20, TEXT.muted)).setOrigin(0.5);
    // El navegador no deja sonar nada hasta un clic o una tecla (el control no cuenta).
    this.soundHint = this.add
      .text(width - 16, 14, '🔇 Para el sonido: haz clic en la página (en Xbox: A con el cursor)', textStyle(15, TEXT.muted))
      .setOrigin(1, 0);
    this.add
      .text(
        width / 2,
        height - 46,
        'Sin control:  Teclado 1 = WASD, Espacio (A), Q (B)   ·   Teclado 2 = Flechas, Enter (A), Shift derecho (B)',
        textStyle(17, TEXT.muted),
      )
      .setOrigin(0.5);

    this.refreshCards();
  }

  createCard(x, y, slot) {
    const top = y - CARD_H / 2;
    const bottom = y + CARD_H / 2;
    const bg = this.add.rectangle(x, y, CARD_W, CARD_H, COLORS.panel).setRounded(24);
    const label = this.add.text(x, top + 36, `Jugador ${slot + 1}`, textStyle(28, TEXT.normal, { fontStyle: 'bold' })).setOrigin(0.5);
    const blob = new Blob(this, x, y - 40, 0xffffff, 62);
    const colorText = this.add.text(x, y + 62, '', textStyle(22)).setOrigin(0.5);
    const device = this.add.text(x, y + 94, '', textStyle(18, TEXT.muted)).setOrigin(0.5);
    const hint = this.add.text(x, bottom - 52, '', textStyle(19, TEXT.accent, { align: 'center' })).setOrigin(0.5);
    const holdTrack = this.add.rectangle(x - BAR_W / 2, bottom - 16, BAR_W, 8, 0xffffff, 0.15).setOrigin(0, 0.5);
    const holdBar = this.add.rectangle(x - BAR_W / 2, bottom - 16, BAR_W, 8, 0xffffff).setOrigin(0, 0.5).setScale(0, 1);

    const empty = this.add.text(x, y - 10, 'Presiona\nA', textStyle(34, TEXT.muted, { align: 'center' })).setOrigin(0.5);
    this.tweens.add({ targets: empty, alpha: 0.35, duration: 800, yoyo: true, repeat: -1 });

    return { slot, bg, label, blob, colorText, device, hint, holdTrack, holdBar, empty };
  }

  cardFor(player) {
    return this.cards[player.slot];
  }

  refreshCards() {
    const host = players.host();
    for (const card of this.cards) {
      const player = players.bySlot(card.slot);
      const joined = Boolean(player);
      const isHost = joined && player === host;

      for (const item of [card.blob, card.colorText, card.device, card.hint]) item.setVisible(joined);
      card.holdTrack.setVisible(isHost);
      card.holdBar.setVisible(isHost);
      card.empty.setVisible(!joined);
      card.label.setColor(joined ? TEXT.normal : TEXT.muted);

      if (!joined) {
        card.bg.setStrokeStyle(4, COLORS.panelBorder);
        continue;
      }

      const color = players.color(player);
      card.blob.setColor(color.hex);
      card.bg.setStrokeStyle(6, color.hex);
      card.holdBar.setFillStyle(color.hex);
      card.colorText.setText(`◀   ${color.name}   ▶`);
      card.device.setText(controls.getDevice(player.deviceId)?.label ?? '');
      card.hint.setText(isHost ? 'Mantén A para empezar\nB para salir' : 'B para salir');
    }
  }

  update() {
    let changed = false;
    const justJoined = new Set();

    // Si un control se apaga o se desconecta, su jugador sale.
    for (const player of [...players.list]) {
      if (!controls.getDevice(player.deviceId)?.connected) {
        players.leave(player.deviceId);
        changed = true;
      }
    }

    for (const device of controls.connectedDevices()) {
      const id = device.id;
      const player = players.byDevice(id);

      if (!player) {
        if (controls.justPressed(id, 'a') && players.join(id)) {
          justJoined.add(id);
          changed = true;
          sfx.confirm();
          const joined = players.byDevice(id);
          this.cardFor(joined).blob.hop();
          say(`¡Jugador ${joined.slot + 1}, ${players.color(joined).name}!`);
          rewards.earn('unirse');
          if (players.list.length === MAX_PLAYERS) rewards.earn('todos');
        }
        continue;
      }

      if (controls.justPressed(id, 'b')) {
        players.leave(id);
        changed = true;
        sfx.back();
        continue;
      }
      if (controls.justPressed(id, 'left')) {
        players.changeColor(player, -1);
        changed = true;
        sfx.select();
      }
      if (controls.justPressed(id, 'right')) {
        players.changeColor(player, 1);
        changed = true;
        sfx.select();
      }

      const card = this.cardFor(player);
      const stick = controls.getStick(id);
      card.blob.look(stick.x, stick.y);
      if (controls.justPressed(id, 'a')) card.blob.hop();
      if (controls.justPressed(id, 'x') || controls.justPressed(id, 'y')) card.blob.squish();
    }

    if (changed) this.refreshCards();
    this.updateHoldToStart(frameDelta(), justJoined);
    this.updatePadInfo();
  }

  updateHoldToStart(delta, justJoined) {
    const host = players.host();
    const id = host?.deviceId ?? null;
    if (id !== this.holdDevice) {
      this.holdDevice = id;
      this.holding = false;
      this.holdMs = 0;
    }
    if (!host) return;

    // El A con el que se unió no cuenta: hay que soltarlo y volver a mantenerlo.
    if (controls.justPressed(id, 'a') && !justJoined.has(id)) this.holding = true;
    if (this.holding && controls.isDown(id, 'a')) {
      this.holdMs += delta;
    } else {
      this.holding = false;
      this.holdMs = 0;
    }

    this.cardFor(host).holdBar.setScale(Math.min(1, this.holdMs / HOLD_TO_START_MS), 1);
    if (this.holdMs >= HOLD_TO_START_MS) {
      sfx.confirm();
      go(this, 'Menu');
    }
  }

  updatePadInfo() {
    const count = controls.gamepadCount();
    let text = `El navegador ve ${count} ${count === 1 ? 'control' : 'controles'}`;
    if (count === 0) {
      text = touchEnabled
        ? 'En el cel: toca el botón A de la pantalla para unirte (o conecta un control por Bluetooth)'
        : '¿No aparece tu control? Presiona cualquier botón.  En Xbox: mantén ≡ (Menú) → «Use game controls» → A';
    }
    if (this.padInfo.text !== text) this.padInfo.setText(text);
    this.soundHint.setVisible(!audioReady());
  }
}
