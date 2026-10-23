import Phaser from 'phaser';
import { controls } from '../shared/controls.js';
import { music } from '../shared/music.js';
import { sfx } from '../shared/sound.js';
import { say, setVoiceEnabled, voiceEnabled } from '../shared/voice.js';
import { players } from '../shared/players.js';
import { GAMES } from '../games.js';
import { Blob } from '../ui/Blob.js';
import { COLORS, TEXT, hexToCss, textStyle } from '../ui/style.js';

const COLUMNS = 6;
const CARD_W = 198;
const CARD_H = 190;
const CARD_GAP_X = 10;
const ROW_Y = [235, 440];

// Menú de juegos en cuadrícula. Solo el Jugador 1 mueve la selección, para que nadie (¡el bebé!)
// la cambie por accidente; los demás pueden hacer saltar a su bolita mientras esperan.
export class MenuScene extends Phaser.Scene {
  constructor() {
    super('Menu');
  }

  init(data) {
    this.selected = data?.selected ?? 0;
  }

  create() {
    const { width, height } = this.scale;
    this.add.text(width / 2, 50, '¿A qué jugamos?', textStyle(52, TEXT.normal, { fontStyle: 'bold' })).setOrigin(0.5);
    this.hostText = this.add.text(width / 2, 104, '', textStyle(24)).setOrigin(0.5);

    // Cada fila se centra aunque tenga menos tarjetas.
    this.cards = GAMES.map((game, i) => {
      const row = Math.floor(i / COLUMNS);
      const inRow = Math.min(COLUMNS, GAMES.length - row * COLUMNS);
      const startX = (width - (inRow * CARD_W + (inRow - 1) * CARD_GAP_X)) / 2 + CARD_W / 2;
      return this.createCard(startX + (i % COLUMNS) * (CARD_W + CARD_GAP_X), ROW_Y[row], game);
    });

    this.toast = this.add.text(width / 2, 572, '', textStyle(26, TEXT.accent, { fontStyle: 'bold' })).setOrigin(0.5).setAlpha(0);
    this.footer = this.add.text(width / 2, height - 20, '', textStyle(20, TEXT.muted)).setOrigin(0.5);
    this.refreshFooter();

    this.drawPlayers();
    this.select(this.selected, false);
    say('¿A qué jugamos?');
  }

  refreshFooter() {
    const onOff = (value) => (value ? 'Sí' : 'No');
    this.footer.setText(
      `A = jugar   ·   B = cambiar jugadores   ·   X = voz: ${onOff(voiceEnabled())}   ·   Y = música: ${onOff(music.enabled())}`,
    );
  }

  createCard(x, y, game) {
    const kind = game.scene ? 'play' : game.url ? 'link' : 'soon';
    const card = this.add.container(x, y);
    // `inner` es lo que se sacude con "¡muy pronto!", sin pelear con el zoom de la selección.
    const inner = this.add.container(0, 0);
    const bg = this.add.rectangle(0, 0, CARD_W, CARD_H, COLORS.panel).setRounded(22);
    const emoji = this.add.text(0, -54, game.emoji, textStyle(52)).setOrigin(0.5);
    const title = this.add.text(0, -2, game.title, textStyle(20, TEXT.normal, { fontStyle: 'bold' })).setOrigin(0.5);
    const description = this.add.text(0, 34, game.description, textStyle(16, TEXT.muted, { align: 'center' })).setOrigin(0.5);
    const badgeColor = { play: COLORS.ok, link: COLORS.accent, soon: COLORS.panelBorder }[kind];
    const badgeLabel = game.badge ?? { play: 'Jugar', link: 'Abrir', soon: 'Próximamente' }[kind];
    const badge = this.add.rectangle(0, 74, 160, 28, badgeColor).setRounded(14);
    const badgeText = this.add
      .text(0, 74, badgeLabel, textStyle(16, kind === 'soon' ? TEXT.muted : TEXT.ink, { fontStyle: 'bold' }))
      .setOrigin(0.5);

    inner.add([bg, emoji, title, description, badge, badgeText]);
    card.add(inner);
    return { card, inner, bg };
  }

  drawPlayers() {
    this.playersRow?.destroy();
    const list = players.sorted();
    this.playersRow = this.add.container(this.scale.width / 2, 625);
    this.playerBlobs = new Map();
    list.forEach((player, i) => {
      const x = (i - (list.length - 1) / 2) * 110;
      const blob = new Blob(this, x, 0, players.color(player).hex, 22);
      const label = this.add.text(x, 38, `J${player.slot + 1}`, textStyle(16, TEXT.muted)).setOrigin(0.5);
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
      const scale = isSelected ? 1.06 : 1;
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
    const before = this.selected;
    if (controls.justPressed(id, 'left')) this.select(this.selected - 1);
    if (controls.justPressed(id, 'right')) this.select(this.selected + 1);
    if (controls.justPressed(id, 'up') || controls.justPressed(id, 'down')) this.selectOtherRow();
    if (this.selected !== before) {
      sfx.select();
      say(GAMES[this.selected].title);
    }
    if (controls.justPressed(id, 'x')) {
      setVoiceEnabled(!voiceEnabled());
      sfx.select();
      say('Voz encendida');
      this.refreshFooter();
    }
    if (controls.justPressed(id, 'y')) {
      music.setEnabled(!music.enabled());
      sfx.select();
      say(music.enabled() ? 'Música encendida' : 'Música apagada');
      this.refreshFooter();
    }
    if (controls.justPressed(id, 'b')) {
      sfx.back();
      this.scene.start('Join');
      return;
    }
    if (controls.justPressed(id, 'a')) this.launch();
  }

  // Con dos filas, arriba y abajo hacen lo mismo: brincar a la otra fila, a la tarjeta más cercana.
  selectOtherRow() {
    const other = this.selected < COLUMNS ? this.selected + COLUMNS : this.selected - COLUMNS;
    this.select(Math.min(other, GAMES.length - 1));
  }

  showToast(text) {
    this.tweens.killTweensOf(this.toast);
    this.toast.setText(text).setAlpha(1);
    this.tweens.add({ targets: this.toast, alpha: 0, delay: 1400, duration: 400 });
  }

  launch() {
    const game = GAMES[this.selected];
    if (game.scene || game.url) sfx.confirm();
    else sfx.back();
    if (game.scene && game.pick) {
      this.scene.start('Personajes', { selected: this.selected, next: game.scene, title: game.title });
      return;
    }
    if (game.scene) {
      this.scene.start(game.scene, { selected: this.selected });
      return;
    }
    if (game.url) {
      // Sale de LeoGames: para volver en el Xbox, B en modo navegador regresa a esta página.
      this.showToast(`Abriendo ${game.title}…`);
      this.time.delayedCall(400, () => window.location.assign(game.url));
      return;
    }

    const { inner } = this.cards[this.selected];
    this.tweens.killTweensOf(inner);
    inner.setAngle(0);
    this.tweens.add({ targets: inner, angle: 3, duration: 60, yoyo: true, repeat: 3 });
    this.showToast(`${game.title}: ¡muy pronto!`);
    say('¡Muy pronto!');
  }
}
