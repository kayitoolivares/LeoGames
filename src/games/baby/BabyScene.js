import Phaser from 'phaser';
import { controls, readGamepads } from '../../shared/controls.js';
import { frameDelta } from '../../shared/clock.js';
import { players, PLAYER_COLORS } from '../../shared/players.js';
import { audioReady, sfx } from '../../shared/sound.js';
import { touchPad } from '../../shared/touch.js';
import { say } from '../../shared/voice.js';
import { rewards } from '../../shared/rewards.js';
import { Blob } from '../../ui/Blob.js';
import { COLORS, TEXT, textStyle } from '../../ui/style.js';
import { burst } from '../brawl/effects.js';
import { go } from '../../shared/transition.js';
import { ANIMALS, ANIMAL_KEYS, animalTexture, loadAnimalArt } from './animals.js';
import { BUBBLE_RADIUS, SHAPE_RADIUS, bubbleTexture, shapeOrigin, shapeTexture } from './drawings.js';
import { SONGS } from './songs.js';

// Botones con los colores del control de Xbox, para ir nombrando los colores con el bebé (con su forma para las
// figuras que son "la": estrella roja, flor amarilla).
const FACE_BUTTONS = {
  a: { color: 0x4cd97b, name: 'Verde', feminine: 'verde' },
  b: { color: 0xff5a5f, name: 'Rojo', feminine: 'roja' },
  x: { color: 0x3fa7ff, name: 'Azul', feminine: 'azul' },
  y: { color: 0xffc93c, name: 'Amarillo', feminine: 'amarilla' },
};
const FACE_KEYS = Object.keys(FACE_BUTTONS);
const DIRECTIONS = ['up', 'down', 'left', 'right'];
const FIREWORK_BUTTONS = ['lb', 'rb', 'lt', 'rt'];
// Las figuras y su nombre (cómo se dibujan: ver drawings.js).
const SHAPES = {
  circle: { name: 'Círculo' },
  star: { name: 'Estrella', feminine: true },
  square: { name: 'Cuadrado' },
  flower: { name: 'Flor', feminine: true },
  heart: { name: 'Corazón' },
  triangle: { name: 'Triángulo' },
};
const SHAPE_KEYS = Object.keys(SHAPES);
const RAINBOW = [0xff5a5f, 0xff9a3c, 0xffc93c, 0x4cd97b, 0x3fa7ff, 0xb07cff, 0xff7ad9];
// Las burbujas, de colores pastel (sobre el fondo oscuro los colores fuertes se ven cafés).
const PASTEL = [0xffb3c1, 0xffd6a5, 0xfdffb6, 0xcaffbf, 0x9bf6ff, 0xa0c4ff, 0xbdb2ff];
// Fondos oscuros para que los colores resalten. Cambian despacito (nada de parpadeos).
const BACKGROUNDS = [COLORS.bg, 0x0f2440, 0x2a1240, 0x0d3333, 0x3a1530];
const BACKGROUND_EVERY_MS = 1500;

const MAX_SHAPES = 24;
const SHAPE_LIFE_MS = 2600;
const ANIMAL_COOLDOWN_MS = 350;
// El animalito se asoma, hace su sonido un ratito y se vuelve a esconder.
const ANIMAL_SING_MS = 1300;
// Burbujas que suben solas: la bolita amiga las revienta al tocarlas (y también el clic y los fuegos artificiales).
const BUBBLE_EVERY_MS = 650;
const MAX_BUBBLES = 14;
// Al acabar una canción se festeja y, después de este rato, empieza la siguiente.
const SONG_PAUSE_MS = 2200;
const FRIEND_SPEED = 480;
const TRAIL_EVERY_MS = 50;
const IDLE_HINT_MS = 10000;
// Se sale como en los otros juegos (LB + RB + Y juntos, o Esc), pero hay que mantenerlos 3 segundos
// para que el bebé no lo haga sin querer.
const EXIT_HOLD_MS = 3000;
const VOICE_EVERY_MS = 1200;
const DEPTH = { bubble: 0.5, trail: 1, shape: 2, animal: 3, friend: 4, firework: 5, ui: 10 };

// Modo Bebé: cualquier botón hace algo bonito. No se gana ni se pierde.
//   A B X Y = figura con carita de ese color y la nota que sigue de la canción (machacando se toca la canción)
//   cruceta = se asoma un animalito y hace su sonido   ·   LB RB LT RT = fuegos artificiales
//   stick = mueve a su bolita amiga, que revienta las burbujas que suben
// Todos los controles conectados cuentan (aunque no se hayan unido), y también el teclado y el clic.
export class BabyScene extends Phaser.Scene {
  constructor() {
    super('Baby');
  }

  init(data) {
    this.returnData = data ?? {};
    this.exiting = false;
    this.exitMs = 0;
    this.idleMs = IDLE_HINT_MS;
    this.shapes = [];
    this.bubbles = [];
    this.bubbleMs = 0;
    this.friends = new Map();
    this.backgroundIndex = 0;
    this.nextBackgroundAt = 0;
    this.spoken = 0;
    this.songIndex = 0;
    this.songStep = 0;
    this.songPausedUntil = 0;
    this.popped = 0;
  }

  preload() {
    loadAnimalArt(this);
  }

  create() {
    const { width, height } = this.scale;
    this.background = this.add.rectangle(0, 0, width, height, BACKGROUNDS[0]).setOrigin(0);
    this.backgroundFade = this.add.rectangle(0, 0, width, height, BACKGROUNDS[0]).setOrigin(0).setAlpha(0);

    this.hint = this.createHint(width / 2, height / 2 - 20);
    this.soundHint = this.add
      .text(width / 2, 30, '🔇 Para que suene: haz clic o presiona una tecla  (en Xbox: A en modo cursor)', textStyle(20, TEXT.accent))
      .setOrigin(0.5)
      .setDepth(DEPTH.ui);
    this.add.text(width / 2, height - 22, 'Para salir: mantén LB + RB + Y juntos (o Esc)', textStyle(16, TEXT.muted)).setOrigin(0.5).setDepth(DEPTH.ui);
    this.exitBar = this.add.rectangle(width / 2 - 150, height - 46, 300, 8, 0xffffff).setOrigin(0, 0.5).setScale(0, 1).setDepth(DEPTH.ui);
    this.escKey = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
    this.songBar = this.createSongBar(width / 2, 78);

    // Las teclas que no son de ningún control (a los bebés les encanta machacar el teclado) y el clic
    // también hacen figuras.
    const onKey = (event) => {
      if (event.repeat || event.code === 'Escape' || controls.mappedKeys.has(event.code)) return;
      this.pressFace(Phaser.Utils.Array.GetRandom(FACE_KEYS), this.randomSpot());
    };
    window.addEventListener('keydown', onKey);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => window.removeEventListener('keydown', onKey));
    this.input.on('pointerdown', (pointer) => {
      const spot = { x: pointer.worldX, y: pointer.worldY };
      if (!this.popBubblesAt(spot, 0)) this.pressFace(Phaser.Utils.Array.GetRandom(FACE_KEYS), spot);
    });
    // En el celular toda la pantalla es para tocar: de los botones táctiles solo quedan LB y RB (para salir).
    touchPad.setMode('bumpers');
    rewards.earn('bebe');
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => touchPad.setMode('full'));
  }

  createHint(x, y) {
    const hint = this.add.container(x, y).setDepth(DEPTH.ui);
    hint.add(this.add.text(0, -80, '👶 ¡Aprieta los botones!', textStyle(56, TEXT.normal, { fontStyle: 'bold' })).setOrigin(0.5));
    FACE_KEYS.forEach((key, i) => {
      const button = this.add.container((i - 1.5) * 110, 50, [
        this.add.circle(0, 0, 40, FACE_BUTTONS[key].color).setStrokeStyle(5, COLORS.ink),
        this.add.text(0, 0, key.toUpperCase(), textStyle(36, TEXT.ink, { fontStyle: 'bold' })).setOrigin(0.5),
      ]);
      hint.add(button);
      this.tweens.add({ targets: button, y: 30, duration: 420, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: i * 120 });
    });
    return hint;
  }

  // Arriba: qué canción se está tocando y cuánto falta (una barrita que se va llenando con cada nota).
  createSongBar(x, y) {
    const bar = this.add.container(x, y).setDepth(DEPTH.ui);
    this.songTitle = this.add.text(0, -16, '', textStyle(30, TEXT.normal, { fontStyle: 'bold' })).setOrigin(0.5);
    const track = this.add.rectangle(-220, 22, 440, 14, 0xffffff, 0.18).setOrigin(0, 0.5);
    this.songFill = this.add.rectangle(-220, 22, 440, 14, 0xffc93c).setOrigin(0, 0.5).setScale(0, 1);
    bar.add([this.songTitle, track, this.songFill]);
    this.showSong();
    return bar;
  }

  showSong() {
    const song = SONGS[this.songIndex];
    this.songTitle.setText(`🎵 ${song.title}`);
    this.songFill.setScale(this.songStep / song.freqs.length, 1);
  }

  // Cada botón toca la nota que sigue de la canción; al acabarla se festeja y luego empieza otra.
  playSongNote() {
    const song = SONGS[this.songIndex];
    if (this.time.now < this.songPausedUntil) {
      sfx.songNote(song.freqs[song.freqs.length - 1]);
      return;
    }
    sfx.songNote(song.freqs[this.songStep]);
    this.songStep += 1;
    this.showSong();
    this.tweens.add({ targets: this.songTitle, scale: { from: 1.12, to: 1 }, duration: 160 });
    if (this.songStep < song.freqs.length) return;
    this.songPausedUntil = this.time.now + SONG_PAUSE_MS;
    this.time.delayedCall(450, () => {
      sfx.win();
      say(`¡Bravo! ¡Tocaste ${song.title}!`);
      const { width } = this.scale;
      for (let i = 0; i < 3; i += 1) this.time.delayedCall(i * 250, () => this.sparkles({ x: width * (0.3 + 0.2 * i), y: 220 }));
    });
    this.time.delayedCall(SONG_PAUSE_MS, () => {
      this.songIndex = (this.songIndex + 1) % SONGS.length;
      this.songStep = 0;
      this.showSong();
    });
  }

  update() {
    const dt = frameDelta();
    this.idleMs += dt;
    for (const device of controls.connectedDevices()) this.updateDevice(device.id, dt);
    this.updateBubbles(dt);

    // El letrero de "¡Aprieta los botones!" se va al jugar y regresa si nadie hace nada un rato.
    const target = this.idleMs >= IDLE_HINT_MS ? 1 : 0;
    this.hint.setAlpha(this.hint.alpha + (target - this.hint.alpha) * Math.min(1, dt / 150));
    this.soundHint.setVisible(!audioReady());
    this.updateExit(dt);
  }

  updateDevice(id, dt) {
    const faces = FACE_KEYS.filter((key) => controls.justPressed(id, key));
    const fireworks = FIREWORK_BUTTONS.filter((key) => controls.justPressed(id, key));
    const directions = DIRECTIONS.filter((key) => controls.justPressed(id, key));
    const stick = controls.getStick(id);
    const moving = stick.x !== 0 || stick.y !== 0;
    if (!faces.length && !fireworks.length && !directions.length && !moving) return;

    // Cada control tiene su bolita amiga; aparece la primera vez que ese control hace algo.
    const friend = this.friends.get(id) ?? this.addFriend(id);
    for (const key of faces) this.pressFace(key, this.randomSpot());
    for (let i = 0; i < fireworks.length; i += 1) this.firework(this.randomSpot());
    if (directions.length && this.time.now >= friend.nextAnimalAt) {
      friend.nextAnimalAt = this.time.now + ANIMAL_COOLDOWN_MS;
      this.animal(directions[0]);
    }
    if (faces.length) friend.blob.hop();
    if (fireworks.length) friend.blob.squish();
    if (faces.length || fireworks.length) this.rumble(id);
    if (moving) this.moveFriend(friend, stick, dt);
    this.idleMs = 0;
  }

  addFriend(id) {
    const { width, height } = this.scale;
    const player = players.byDevice(id);
    const color = player ? players.color(player).hex : PLAYER_COLORS[this.friends.size % PLAYER_COLORS.length].hex;
    const blob = new Blob(this, width * (0.2 + 0.2 * (this.friends.size % 4)), height * 0.62, color, 55).setDepth(DEPTH.friend).setScale(0);
    this.tweens.add({ targets: blob, scale: 1, duration: 400, ease: 'Back.easeOut' });
    const friend = { blob, trailMs: 0, trailIndex: 0, nextAnimalAt: 0 };
    this.friends.set(id, friend);
    return friend;
  }

  // La bolita sigue al stick y deja un caminito de arcoíris.
  moveFriend(friend, stick, dt) {
    const { width, height } = this.scale;
    const { blob } = friend;
    const step = (FRIEND_SPEED * dt) / 1000;
    blob.x = Phaser.Math.Clamp(blob.x + stick.x * step, 70, width - 70);
    blob.y = Phaser.Math.Clamp(blob.y + stick.y * step, 90, height - 100);
    blob.look(stick.x, stick.y);
    friend.trailMs += dt;
    if (friend.trailMs < TRAIL_EVERY_MS) return;
    friend.trailMs = 0;
    const color = RAINBOW[friend.trailIndex++ % RAINBOW.length];
    const dot = this.add.circle(blob.x, blob.y + blob.radius * 0.6, 12, color, 0.85).setDepth(DEPTH.trail);
    this.tweens.add({ targets: dot, scale: 0, alpha: 0, duration: 900, onComplete: () => dot.destroy() });
  }

  randomSpot() {
    const { width, height } = this.scale;
    return { x: Phaser.Math.Between(150, width - 150), y: Phaser.Math.Between(140, height - 190) };
  }

  pressFace(key, { x, y }) {
    const button = FACE_BUTTONS[key];
    const kind = Phaser.Utils.Array.GetRandom(SHAPE_KEYS);
    const shape = SHAPES[kind];
    const name = `${shape.name} ${shape.feminine ? button.feminine : button.name.toLowerCase()}`;
    this.playSongNote();
    this.spawnShape(x, y, kind, button.color, name);
    this.popBubblesAt({ x, y }, 60);
    this.idleMs = 0;
    // La voz dice el color (y una vez sí y otra no, también la figura), pero sin amontonarse cuando el bebé machaca
    // los botones.
    if (this.time.now - (this.lastSpokenAt ?? -Infinity) > VOICE_EVERY_MS) {
      this.lastSpokenAt = this.time.now;
      this.spoken += 1;
      say(`¡${this.spoken % 2 ? button.name : name}!`);
    }
  }

  spawnShape(x, y, kind, color, name) {
    const size = Phaser.Math.Between(70, 100) / SHAPE_RADIUS;
    const shape = this.add.image(x, y, shapeTexture(this, kind, color, name)).setOrigin(shapeOrigin.x, shapeOrigin.y);
    shape.setDepth(DEPTH.shape).setScale(0);
    this.tweens.add({ targets: shape, scale: size, duration: 380, ease: 'Back.easeOut' });
    this.tweens.add({ targets: shape, angle: { from: -8, to: 8 }, duration: 500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    burst(this, x, y, color, 10);
    this.time.delayedCall(SHAPE_LIFE_MS, () => this.fadeShape(shape));

    this.shapes.push(shape);
    // Para no llenar la memoria del Xbox: si hay demasiadas, la más vieja se va rápido.
    if (this.shapes.length > MAX_SHAPES) this.fadeShape(this.shapes[0], 200);
  }

  fadeShape(shape, duration = 700) {
    if (shape.getData('fading')) return;
    shape.setData('fading', true);
    this.shapes = this.shapes.filter((other) => other !== shape);
    this.tweens.add({
      targets: shape,
      y: shape.y - 120,
      alpha: 0,
      duration,
      ease: 'Quad.easeIn',
      onComplete: () => {
        this.tweens.killTweensOf(shape);
        shape.destroy();
      },
    });
  }

  // Un animalito se asoma por el lado de la flecha, hace su sonido (con su letrero) y se vuelve a esconder.
  animal(direction) {
    const { width, height } = this.scale;
    const along = Phaser.Math.FloatBetween(0.25, 0.75);
    const path = {
      left: { from: [-120, height * along], to: [190, height * along] },
      right: { from: [width + 120, height * along], to: [width - 190, height * along] },
      up: { from: [width * along, -120], to: [width * along, 230] },
      down: { from: [width * along, height + 120], to: [width * along, height - 210] },
    }[direction];
    // Que no salga el mismo dos veces seguidas.
    const key = Phaser.Utils.Array.GetRandom(ANIMAL_KEYS.filter((other) => other !== this.lastAnimal));
    this.lastAnimal = key;
    const info = ANIMALS[key];
    const texture = animalTexture(this, key);
    const SIZE = 210;
    const body = texture
      ? this.add.image(0, 0, texture).setScale(SIZE / Math.max(this.textures.get(texture).getSourceImage().height, 1))
      : this.add.text(0, 0, info.emoji, textStyle(130)).setOrigin(0.5);
    // El letrero va arriba del animalito; si se asoma por arriba, abajo (para no tapar la canción).
    const bubble = this.add
      .text(0, (direction === 'up' ? 1 : -1) * SIZE * 0.62, info.sound, textStyle(38, TEXT.ink, { fontStyle: 'bold', backgroundColor: '#ffffff', padding: { x: 14, y: 8 } }))
      .setOrigin(0.5)
      .setScale(0);
    const animal = this.add.container(path.from[0], path.from[1], [body, bubble]).setDepth(DEPTH.animal);
    animal.setData('animal', key);
    sfx.boing();
    this.tweens.add({
      targets: animal,
      x: path.to[0],
      y: path.to[1],
      duration: 450,
      ease: 'Back.easeOut',
      onComplete: () => {
        // ¡Su sonido! Con la boca abierta, brinquitos y su letrero.
        info.cry();
        const singing = animalTexture(this, key, true);
        if (singing && body.setTexture) body.setTexture(singing);
        this.tweens.add({ targets: bubble, scale: 1, duration: 220, ease: 'Back.easeOut' });
        this.tweens.add({ targets: body, scaleY: body.scaleY * 1.08, scaleX: body.scaleX * 0.95, duration: 150, yoyo: true, repeat: 3 });
        if (this.time.now - (this.lastSpokenAt ?? -Infinity) > VOICE_EVERY_MS) {
          this.lastSpokenAt = this.time.now;
          say(`¡${info.name}!`);
        }
        this.time.delayedCall(ANIMAL_SING_MS, () => {
          if (texture && body.setTexture) body.setTexture(texture);
          this.tweens.add({ targets: animal, x: path.from[0], y: path.from[1], duration: 400, ease: 'Back.easeIn', onComplete: () => animal.destroy() });
        });
      },
    });
  }

  // ---------- Burbujas ----------
  updateBubbles(dt) {
    const { width, height } = this.scale;
    this.bubbleMs += dt;
    if (this.bubbleMs >= BUBBLE_EVERY_MS && this.bubbles.length < MAX_BUBBLES) {
      this.bubbleMs = 0;
      this.addBubble(Phaser.Math.Between(80, width - 80), height + 60);
    }
    for (const bubble of [...this.bubbles]) {
      const { speed, wobble, phase } = bubble.getData('drift');
      bubble.y -= (speed * dt) / 1000;
      bubble.x += Math.sin(this.time.now / 600 + phase) * wobble * (dt / 1000);
      if (bubble.y < -80) this.removeBubble(bubble);
    }
    // La bolita amiga revienta las que toca.
    for (const { blob } of this.friends.values()) {
      for (const bubble of [...this.bubbles]) {
        if (Phaser.Math.Distance.Between(blob.x, blob.y, bubble.x, bubble.y) < blob.radius + bubble.getData('r')) this.popBubble(bubble);
      }
    }
  }

  addBubble(x, y) {
    const r = Phaser.Math.Between(28, 58);
    const tint = Phaser.Utils.Array.GetRandom(PASTEL);
    const bubble = this.add.image(x, y, bubbleTexture(this, tint)).setScale(r / BUBBLE_RADIUS).setDepth(DEPTH.bubble);
    bubble.setData({ r, tint, drift: { speed: Phaser.Math.Between(45, 95), wobble: Phaser.Math.Between(20, 50), phase: Math.random() * 6 } });
    this.bubbles.push(bubble);
    return bubble;
  }

  removeBubble(bubble) {
    this.bubbles = this.bubbles.filter((other) => other !== bubble);
    bubble.destroy();
  }

  popBubble(bubble) {
    const r = bubble.getData('r');
    const tint = bubble.getData('tint');
    sfx.pop();
    for (let i = 0; i < 8; i += 1) {
      const angle = (i / 8) * Math.PI * 2;
      const drop = this.add.circle(bubble.x + Math.cos(angle) * r, bubble.y + Math.sin(angle) * r, 6, i % 2 ? 0xffffff : tint).setDepth(DEPTH.firework);
      this.tweens.add({
        targets: drop,
        x: drop.x + Math.cos(angle) * 40,
        y: drop.y + Math.sin(angle) * 40,
        alpha: 0,
        duration: 380,
        onComplete: () => drop.destroy(),
      });
    }
    this.popped += 1;
    this.removeBubble(bubble);
  }

  // Revienta las burbujas cerca de un punto (`reach` además de su tamaño); dice cuántas reventó.
  popBubblesAt({ x, y }, reach) {
    const hit = this.bubbles.filter((bubble) => Phaser.Math.Distance.Between(x, y, bubble.x, bubble.y) <= bubble.getData('r') + reach);
    for (const bubble of hit) this.popBubble(bubble);
    return hit.length;
  }

  // Chispitas de colores (al acabar una canción).
  sparkles({ x, y }) {
    for (let i = 0; i < 16; i += 1) {
      const angle = (i / 16) * Math.PI * 2;
      const spark = this.add.star(x, y, 5, 6, 13, RAINBOW[i % RAINBOW.length]).setDepth(DEPTH.firework);
      this.tweens.add({
        targets: spark,
        x: x + Math.cos(angle) * 160,
        y: y + Math.sin(angle) * 160,
        angle: 180,
        alpha: 0,
        duration: 900,
        ease: 'Cubic.easeOut',
        onComplete: () => spark.destroy(),
      });
    }
  }

  firework({ x, y }) {
    sfx.sparkle();
    this.popBubblesAt({ x, y }, 160);
    const count = 24;
    for (let i = 0; i < count; i += 1) {
      const angle = (i / count) * Math.PI * 2;
      const distance = Phaser.Math.Between(140, 220);
      const spark = this.add.circle(x, y, 9, RAINBOW[i % RAINBOW.length]).setDepth(DEPTH.firework);
      this.tweens.add({
        targets: spark,
        x: x + Math.cos(angle) * distance,
        y: y + Math.sin(angle) * distance + 40,
        alpha: 0,
        scale: 0.4,
        duration: 900,
        ease: 'Cubic.easeOut',
        onComplete: () => spark.destroy(),
      });
    }
    const ring = this.add.circle(x, y, 30).setStrokeStyle(6, 0xffffff).setDepth(DEPTH.firework);
    this.tweens.add({ targets: ring, scale: 5, alpha: 0, duration: 600, ease: 'Quad.easeOut', onComplete: () => ring.destroy() });
    this.nextBackground();
  }

  nextBackground() {
    if (this.time.now < this.nextBackgroundAt) return;
    this.nextBackgroundAt = this.time.now + BACKGROUND_EVERY_MS;
    this.backgroundIndex = (this.backgroundIndex + 1) % BACKGROUNDS.length;
    const color = BACKGROUNDS[this.backgroundIndex];
    this.backgroundFade.setFillStyle(color).setAlpha(0);
    this.tweens.add({
      targets: this.backgroundFade,
      alpha: 1,
      duration: 600,
      onComplete: () => {
        this.background.setFillStyle(color);
        this.backgroundFade.setAlpha(0);
      },
    });
  }

  // Vibración suavecita en el control, si el navegador la permite.
  rumble(id) {
    if (controls.getDevice(id)?.kind !== 'gamepad') return;
    const pad = readGamepads().find((candidate) => `pad${candidate.index}` === id);
    try {
      pad?.vibrationActuator?.playEffect('dual-rumble', { duration: 120, strongMagnitude: 0.15, weakMagnitude: 0.35 })?.catch(() => {});
    } catch {
      // Sin vibración: no pasa nada.
    }
  }

  updateExit(dt) {
    const exitCombo = controls.connectedDevices().some((device) => controls.holdingExit(device.id));
    this.exitMs = exitCombo || this.escKey?.isDown ? this.exitMs + dt : 0;
    this.exitBar.setScale(Math.min(1, this.exitMs / EXIT_HOLD_MS), 1);
    if (this.exitMs >= EXIT_HOLD_MS) this.exit();
  }

  exit() {
    if (this.exiting) return;
    this.exiting = true;
    go(this, 'Menu', { selected: this.returnData.selected });
  }
}
