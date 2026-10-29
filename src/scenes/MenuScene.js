import Phaser from 'phaser';
import { controls } from '../shared/controls.js';
import { music } from '../shared/music.js';
import { sfx } from '../shared/sound.js';
import { say, setVoiceEnabled, voiceEnabled } from '../shared/voice.js';
import { players } from '../shared/players.js';
import { GAMES } from '../games.js';
import { Ambience } from '../ui/ambient.js';
import { Blob } from '../ui/Blob.js';
import { CharacterLook } from '../ui/CharacterLook.js';
import { characterPicks } from '../shared/picks.js';
import { defaultCharacter } from './CharacterSelectScene.js';
import { requestPoses } from '../games/smash/art.js';
import { COLORS, TEXT, hexToCss, textStyle } from '../ui/style.js';
import { go } from '../shared/transition.js';
import { releaseBackgrounds } from '../shared/lazyArt.js';

// 15 tarjetas: 3 filas de 5, más bajitas que antes para que quepan.
const COLUMNS = 5;
const CARD_W = 234;
const CARD_H = 126;
const CARD_GAP_X = 10;
const ROW_Y = [204, 342, 480];
// Los personajes de los jugadores pasean abajo: qué tan rápido y qué tan lejos de su lugar.
const STROLL = { speed: 75, reach: 170, waitMin: 900, waitMax: 3200 };
const WALKER_POSES = ['normal', 'caminar1', 'caminar2', 'caminar3', 'caminar4', 'parpadeo', 'feliz'];

// Menú de juegos en cuadrícula. Solo el Jugador 1 mueve la selección, para que nadie (¡el bebé!)
// la cambie por accidente; los demás pueden hacer saltar a su bolita mientras esperan.
export class MenuScene extends Phaser.Scene {
  constructor() {
    super('Menu');
  }

  init(data) {
    this.selected = data?.selected ?? 0;
  }

  // Los dibujos de los personajes de los jugadores (para que paseen abajo).
  preload() {
    for (const player of players.sorted()) requestPoses(this, this.pickOf(player), WALKER_POSES, { start: false });
  }

  pickOf(player) {
    return characterPicks.get(player.deviceId, defaultCharacter(player));
  }

  create() {
    // Al regresar de un juego se sueltan sus fondos (cada uno pesa más de 5 MB en la memoria del Xbox).
    releaseBackgrounds(this.game);
    const { width, height } = this.scale;
    this.ambience = new Ambience(this, 'menu', { depth: -10 });
    const title = this.add.text(width / 2, 50, '¿A qué jugamos?', textStyle(52, TEXT.normal, { fontStyle: 'bold' })).setOrigin(0.5);
    this.tweens.add({ targets: title, scale: 1.05, duration: 1100, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
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
    // Las tarjetas entran rebotando, una tras otra.
    this.cards.forEach(({ card }, i) => {
      const scale = card.scale;
      card.setScale(0);
      this.tweens.add({ targets: card, scale, delay: 60 + i * 35, duration: 320, ease: 'Back.easeOut' });
    });
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
    // El dibujo a la izquierda y el nombre con su descripción a la derecha; la etiqueta (Jugar, Abrir...) en la esquina.
    const bg = this.add.rectangle(0, 0, CARD_W, CARD_H, COLORS.panel).setRounded(20);
    const emoji = this.add.text(-80, 4, game.emoji, textStyle(50)).setOrigin(0.5);
    const title = this.add.text(30, -22, game.title, textStyle(19, TEXT.normal, { fontStyle: 'bold', align: 'center', wordWrap: { width: 156 } })).setOrigin(0.5);
    const description = this.add.text(30, 22, game.description, textStyle(14, TEXT.muted, { align: 'center' })).setOrigin(0.5);
    const badgeColor = { play: COLORS.ok, link: COLORS.accent, soon: COLORS.panelBorder }[kind];
    const badgeLabel = game.badge ?? { play: 'Jugar', link: 'Abrir', soon: 'Próximamente' }[kind];
    const badge = this.add.rectangle(-80, -46, 64, 20, badgeColor).setRounded(10);
    const badgeText = this.add
      .text(-80, -46, badgeLabel, textStyle(13, kind === 'soon' ? TEXT.muted : TEXT.ink, { fontStyle: 'bold' }))
      .setOrigin(0.5);

    inner.add([bg, emoji, title, description, badge, badgeText]);
    card.add(inner);
    return { card, inner, bg, emoji, baseY: y };
  }

  drawPlayers() {
    this.playersRow?.destroy();
    const list = players.sorted();
    this.playersRow = this.add.container(this.scale.width / 2, 625);
    this.playerBlobs = new Map();
    this.walkers = [];
    list.forEach((player, i) => {
      const x = (i - (list.length - 1) / 2) * 110;
      const blob = new Blob(this, x, 0, players.color(player).hex, 22);
      const label = this.add.text(x, 38, `J${player.slot + 1}`, textStyle(16, TEXT.muted)).setOrigin(0.5);
      this.playersRow.add([blob, label]);
      this.playerBlobs.set(player.deviceId, blob);
      // Su personaje, que pasea por abajo (y brinca con A).
      const look = new CharacterLook(this, blob, this.pickOf(player), { height: 2.8 });
      this.walkers.push({ blob, label, look, home: x, target: x, waitMs: Math.random() * 1500, facing: 1 });
    });
  }

  select(index, animate = true) {
    this.selected = (index + GAMES.length) % GAMES.length;
    const host = players.host();
    const highlight = host ? players.color(host).hex : COLORS.accent;
    this.cards.forEach(({ card, bg, emoji, baseY }, i) => {
      const isSelected = i === this.selected;
      bg.setStrokeStyle(isSelected ? 8 : 4, isSelected ? highlight : COLORS.panelBorder);
      const scale = isSelected ? 1.06 : 1;
      this.tweens.killTweensOf([card, emoji]);
      card.y = baseY;
      emoji.setAngle(0).setScale(1);
      if (animate) this.tweens.add({ targets: card, scale: isSelected ? 1.12 : 1, duration: 110, ease: 'Quad.easeOut', yoyo: isSelected, onComplete: () => card.setScale(scale) });
      else card.setScale(scale);
      // La escogida brinca despacito y su dibujo se mece.
      if (isSelected) {
        this.tweens.add({ targets: card, y: baseY - 6, duration: 520, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: 120 });
        this.tweens.add({ targets: emoji, angle: { from: -8, to: 8 }, scale: 1.12, duration: 420, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      }
    });
  }

  // Los personajes de abajo caminan un rato, se paran, y vuelven a caminar (cerca de su lugar).
  stroll() {
    const dt = this.game.loop.delta / 1000;
    for (const w of this.walkers ?? []) {
      let walking = false;
      if (w.waitMs > 0) w.waitMs -= dt * 1000;
      else if (Math.abs(w.target - w.blob.x) < 3) {
        w.waitMs = Phaser.Math.Between(STROLL.waitMin, STROLL.waitMax);
        w.target = w.home + Phaser.Math.Between(-STROLL.reach, STROLL.reach);
      } else {
        w.facing = Math.sign(w.target - w.blob.x);
        w.blob.x += w.facing * Math.min(Math.abs(w.target - w.blob.x), STROLL.speed * dt);
        walking = true;
      }
      w.label.x = w.blob.x;
      w.look.show(w.look.groundPose(walking), w.facing);
    }
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
      go(this, 'Join');
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
    this.stroll();

    const id = host.deviceId;
    const before = this.selected;
    if (controls.justPressed(id, 'left')) this.select(this.selected - 1);
    if (controls.justPressed(id, 'right')) this.select(this.selected + 1);
    if (controls.justPressed(id, 'up')) this.selectRow(-1);
    if (controls.justPressed(id, 'down')) this.selectRow(1);
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
      go(this, 'Join');
      return;
    }
    if (controls.justPressed(id, 'a')) this.launch();
  }

  // Arriba y abajo brincan a la fila de al lado (de la última se pasa a la primera), a la tarjeta más cercana.
  selectRow(step) {
    const rows = Math.ceil(GAMES.length / COLUMNS);
    const row = (Math.floor(this.selected / COLUMNS) + step + rows) % rows;
    this.select(Math.min(row * COLUMNS + (this.selected % COLUMNS), GAMES.length - 1));
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
      go(this, 'Personajes', { selected: this.selected, next: game.scene, title: game.title });
      return;
    }
    if (game.scene) {
      go(this, game.scene, { selected: this.selected });
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
