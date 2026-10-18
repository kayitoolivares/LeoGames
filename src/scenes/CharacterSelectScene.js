import Phaser from 'phaser';
import { controls } from '../shared/controls.js';
import { characterPicks } from '../shared/picks.js';
import { players } from '../shared/players.js';
import { sfx } from '../shared/sound.js';
import { say } from '../shared/voice.js';
import { Blob } from '../ui/Blob.js';
import { CharacterLook } from '../ui/CharacterLook.js';
import { COLORS, TEXT, hexToCss, textStyle } from '../ui/style.js';
import { loadSmashArt } from '../games/smash/art.js';
import { CHARACTERS, CHARACTER_KEYS } from '../games/smash/characters.js';

const CARD_W = 270;
const CARD_H = 380;
const CARD_GAP = 18;
const CARD_Y = 400;
const START_DELAY_MS = 700;

// El personaje que le toca a cada quien si nunca ha escogido.
export function defaultCharacter(player) {
  return CHARACTER_KEYS[player.slot % CHARACTER_KEYS.length];
}

// "Escoge tu personaje" antes de Pelea en equipo y Fútbol: cada jugador escoge con ◀ ▶ y A = listo.
// Cuando todos están listos abre el juego (`next`). B quita el "listo"; si no estaba listo,
// el Jugador 1 regresa al menú. Lo escogido se recuerda para los demás juegos (shared/picks.js).
export class CharacterSelectScene extends Phaser.Scene {
  constructor() {
    super('Personajes');
  }

  init(data) {
    this.returnData = data ?? {};
  }

  preload() {
    loadSmashArt(this);
  }

  create() {
    const { width, height } = this.scale;
    this.add.text(width / 2, 70, 'Escoge tu personaje', textStyle(48, TEXT.normal, { fontStyle: 'bold' })).setOrigin(0.5);
    if (this.returnData.title) {
      this.add.text(width / 2, 124, `para ${this.returnData.title}`, textStyle(24, TEXT.muted)).setOrigin(0.5);
    }
    this.add
      .text(width / 2, height - 30, '◀ ▶ personaje   ·   A = ¡listo!   ·   B = regresar', textStyle(22, TEXT.accent))
      .setOrigin(0.5);
    const humans = players.sorted();
    const startX = (width - (humans.length * CARD_W + (humans.length - 1) * CARD_GAP)) / 2 + CARD_W / 2;
    this.cards = humans.map((player, i) => this.createCard(startX + i * (CARD_W + CARD_GAP), player));
    this.startMs = null;
    this.leaving = false;
    say('Escoge tu personaje');
  }

  createCard(x, player) {
    const color = players.color(player).hex;
    const container = this.add.container(x, CARD_Y);
    const top = -CARD_H / 2;
    const bg = this.add.rectangle(0, 0, CARD_W, CARD_H, COLORS.panel).setRounded(24).setStrokeStyle(5, color);
    const title = this.add.text(0, top + 28, `Jugador ${player.slot + 1}`, textStyle(22, hexToCss(color), { fontStyle: 'bold' })).setOrigin(0.5);
    const name = this.add.text(0, top + 236, '', textStyle(30, TEXT.normal, { fontStyle: 'bold' })).setOrigin(0.5);
    const arrows = this.add.text(0, top + 276, '◀           ▶', textStyle(26, TEXT.muted)).setOrigin(0.5);
    const status = this.add.text(0, top + CARD_H - 30, '', textStyle(22, TEXT.normal, { fontStyle: 'bold' })).setOrigin(0.5);
    container.add([bg, title, name, arrows, status]);
    const card = { player, color, container, bg, name, arrows, status, pick: characterPicks.get(player.deviceId, defaultCharacter(player)), ready: false };
    this.showCharacter(card);
    return card;
  }

  // La vista previa: el personaje parado (con su imagen o como bolita con su accesorio).
  showCharacter(card) {
    card.preview?.destroy();
    const blob = new Blob(this, 0, -CARD_H / 2 + 150, card.color, 46);
    blob.list[0].setVisible(false);
    new CharacterLook(this, blob, card.pick, { height: 3.2 });
    card.preview = blob;
    card.container.add(blob);
    card.name.setText(CHARACTERS[card.pick].name);
    this.showStatus(card);
  }

  showStatus(card) {
    card.status.setText(card.ready ? '¡Listo!' : 'A = listo').setColor(card.ready ? '#4cd97b' : TEXT.muted);
    card.bg.setFillStyle(card.ready ? 0x2b3d4a : COLORS.panel);
    card.arrows.setVisible(!card.ready);
  }

  hop(card) {
    this.tweens.add({ targets: card.preview.figure, y: -24, duration: 140, yoyo: true, ease: 'Quad.easeOut' });
  }

  update() {
    if (this.leaving) return;
    for (const card of this.cards) {
      const id = card.player.deviceId;
      if (!card.ready) {
        const step = (controls.justPressed(id, 'right') ? 1 : 0) - (controls.justPressed(id, 'left') ? 1 : 0);
        if (step !== 0) {
          const index = CHARACTER_KEYS.indexOf(card.pick);
          card.pick = CHARACTER_KEYS[(index + step + CHARACTER_KEYS.length) % CHARACTER_KEYS.length];
          sfx.select();
          say(CHARACTERS[card.pick].name);
          this.showCharacter(card);
        }
        if (controls.justPressed(id, 'a')) {
          card.ready = true;
          sfx.confirm();
          this.hop(card);
          this.showStatus(card);
        } else if (controls.justPressed(id, 'b') && card.player === players.host()) {
          sfx.back();
          this.leaving = true;
          this.scene.start('Menu', { selected: this.returnData.selected });
          return;
        }
      } else if (controls.justPressed(id, 'b')) {
        card.ready = false;
        sfx.back();
        this.showStatus(card);
      } else if (controls.justPressed(id, 'a')) {
        this.hop(card);
      }
    }

    // Todos listos: un momento para verlos brincar y a jugar.
    if (!this.cards.every((card) => card.ready)) {
      this.startMs = null;
      return;
    }
    this.startMs ??= this.time.now;
    if (this.time.now - this.startMs < START_DELAY_MS) return;
    this.leaving = true;
    for (const card of this.cards) characterPicks.set(card.player.deviceId, card.pick);
    this.scene.start(this.returnData.next, { selected: this.returnData.selected });
  }
}
