import Phaser from 'phaser';
import { controls } from '../shared/controls.js';
import { players } from '../shared/players.js';
import { GAMES } from '../games.js';
import { Blob } from '../ui/Blob.js';
import { COLORS, TEXT, hexToCss, textStyle } from '../ui/style.js';

const CARD_W = 270;
const CARD_H = 330;
const CARD_GAP = 26;

// Menú de juegos. Solo el Jugador 1 mueve la selección, para que nadie (¡el bebé!) la cambie por accidente;
// los demás pueden hacer saltar a su bolita mientras esperan.
export class MenuScene extends Phaser.Scene {
  constructor() {
    super('Menu');
  }

  init(data) {
    this.selected = data?.selected ?? 0;
  }

  create() {
    const { width, height } = this.scale;
    this.add.text(width / 2, 64, '¿A qué jugamos?', textStyle(56, TEXT.normal, { fontStyle: 'bold' })).setOrigin(0.5);
    this.hostText = this.add.text(width / 2, 124, '', textStyle(24)).setOrigin(0.5);

    const totalW = GAMES.length * CARD_W + (GAMES.length - 1) * CARD_GAP;
    const startX = (width - totalW) / 2 + CARD_W / 2;
    this.cards = GAMES.map((game, i) => this.createCard(startX + i * (CARD_W + CARD_GAP), 340, game));

    this.toast = this.add.text(width / 2, 545, '', textStyle(28, TEXT.accent, { fontStyle: 'bold' })).setOrigin(0.5).setAlpha(0);
    this.add.text(width / 2, height - 28, 'A = jugar   ·   B = cambiar jugadores', textStyle(20, TEXT.muted)).setOrigin(0.5);

    this.drawPlayers();
    this.select(this.selected, false);
  }

  createCard(x, y, game) {
    const available = Boolean(game.scene);
    const card = this.add.container(x, y);
    // `inner` es lo que se sacude con "¡muy pronto!", sin pelear con el zoom de la selección.
    const inner = this.add.container(0, 0);
    const bg = this.add.rectangle(0, 0, CARD_W, CARD_H, COLORS.panel).setRounded(24);
    const emoji = this.add.text(0, -88, game.emoji, textStyle(78)).setOrigin(0.5);
    const title = this.add
      .text(0, 8, game.title, textStyle(25, TEXT.normal, { fontStyle: 'bold', align: 'center', wordWrap: { width: CARD_W - 40 } }))
      .setOrigin(0.5);
    const description = this.add.text(0, 76, game.description, textStyle(19, TEXT.muted, { align: 'center' })).setOrigin(0.5);
    const badge = this.add.rectangle(0, CARD_H / 2 - 32, 170, 36, available ? COLORS.ok : COLORS.panelBorder).setRounded(18);
    const badgeText = this.add
      .text(0, CARD_H / 2 - 32, available ? 'Jugar' : 'Próximamente', textStyle(18, available ? TEXT.ink : TEXT.muted, { fontStyle: 'bold' }))
      .setOrigin(0.5);

    inner.add([bg, emoji, title, description, badge, badgeText]);
    card.add(inner);
    return { card, inner, bg };
  }

  drawPlayers() {
    this.playersRow?.destroy();
    const list = players.sorted();
    this.playersRow = this.add.container(this.scale.width / 2, 600);
    this.playerBlobs = new Map();
    list.forEach((player, i) => {
      const x = (i - (list.length - 1) / 2) * 110;
      const blob = new Blob(this, x, 0, players.color(player).hex, 26);
      const label = this.add.text(x, 46, `J${player.slot + 1}`, textStyle(18, TEXT.muted)).setOrigin(0.5);
      this.playersRow.add([blob, label]);
      this.playerBlobs.set(player.deviceId, blob);
    });
  }

  select(index, animate = true) {
    this.selected = (index + GAMES.length) % GAMES.length;
    const host = players.host();
    const highlight = host ? players.color(host).hex : COLORS.accent;
    this.cards.forEach(({ card, bg }, i) => {
      const isSelected = i === this.selected;
      bg.setStrokeStyle(isSelected ? 8 : 4, isSelected ? highlight : COLORS.panelBorder);
      const scale = isSelected ? 1.08 : 1;
      this.tweens.killTweensOf(card);
      if (animate) this.tweens.add({ targets: card, scale, duration: 120, ease: 'Quad.easeOut' });
      else card.setScale(scale);
    });
  }

  update() {
    let changed = false;
    for (const player of [...players.list]) {
      if (!controls.getDevice(player.deviceId)?.connected) {
        players.leave(player.deviceId);
        changed = true;
      }
    }

    const host = players.host();
    if (!host) {
      this.scene.start('Join');
      return;
    }
    if (changed) {
      this.drawPlayers();
      this.select(this.selected, false);
    }

    const hostLabel = `Escoge: Jugador ${host.slot + 1}`;
    if (this.hostText.text !== hostLabel) this.hostText.setText(hostLabel).setColor(hexToCss(players.color(host).hex));

    for (const player of players.list) {
      const blob = this.playerBlobs.get(player.deviceId);
      const stick = controls.getStick(player.deviceId);
      blob.look(stick.x, stick.y);
      if (controls.justPressed(player.deviceId, 'a')) blob.hop();
    }

    const id = host.deviceId;
    if (controls.justPressed(id, 'left')) this.select(this.selected - 1);
    if (controls.justPressed(id, 'right')) this.select(this.selected + 1);
    if (controls.justPressed(id, 'b')) {
      this.scene.start('Join');
      return;
    }
    if (controls.justPressed(id, 'a')) this.launch();
  }

  launch() {
    const game = GAMES[this.selected];
    if (game.scene) {
      this.scene.start(game.scene, { selected: this.selected });
      return;
    }

    const { inner } = this.cards[this.selected];
    this.tweens.killTweensOf(inner);
    inner.setAngle(0);
    this.tweens.add({ targets: inner, angle: 3, duration: 60, yoyo: true, repeat: 3 });

    this.tweens.killTweensOf(this.toast);
    this.toast.setText(`${game.title}: ¡muy pronto!`).setAlpha(1);
    this.tweens.add({ targets: this.toast, alpha: 0, delay: 1200, duration: 400 });
  }
}
