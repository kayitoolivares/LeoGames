import Phaser from 'phaser';
import { controls, readGamepads } from '../../shared/controls.js';
import { frameDelta } from '../../shared/clock.js';
import { players, PLAYER_COLORS } from '../../shared/players.js';
import { audioReady, sfx } from '../../shared/sound.js';
import { touchPad } from '../../shared/touch.js';
import { Blob } from '../../ui/Blob.js';
import { COLORS, TEXT, textStyle } from '../../ui/style.js';
import { burst } from '../brawl/effects.js';

// Botones con los colores del control de Xbox, para ir nombrando los colores con el bebé.
// `note` es el paso de la escala pentatónica (sound.js), así cada botón tiene "su" nota.
const FACE_BUTTONS = {
  a: { color: 0x4cd97b, name: '¡Verde!', note: 0 },
  b: { color: 0xff5a5f, name: '¡Rojo!', note: 2 },
  x: { color: 0x3fa7ff, name: '¡Azul!', note: 3 },
  y: { color: 0xffc93c, name: '¡Amarillo!', note: 4 },
};
const FACE_KEYS = Object.keys(FACE_BUTTONS);
const DIRECTIONS = ['up', 'down', 'left', 'right'];
const FIREWORK_BUTTONS = ['lb', 'rb', 'lt', 'rt'];
// Qué tan grande va la carita en cada figura (en la estrella cabe menos).
const FACE_SIZE = { circle: 1, star: 0.6, square: 0.9, flower: 0.62 };
const SHAPES = Object.keys(FACE_SIZE);
const ANIMALS = ['🐶', '🐱', '🐮', '🐷', '🐸', '🐥', '🐵', '🐰', '🦁', '🐘', '🐻', '🐟'];
const RAINBOW = [0xff5a5f, 0xff9a3c, 0xffc93c, 0x4cd97b, 0x3fa7ff, 0xb07cff, 0xff7ad9];
// Fondos oscuros para que los colores resalten. Cambian despacito (nada de parpadeos).
const BACKGROUNDS = [COLORS.bg, 0x0f2440, 0x2a1240, 0x0d3333, 0x3a1530];
const BACKGROUND_EVERY_MS = 1500;

const MAX_SHAPES = 24;
const SHAPE_LIFE_MS = 2600;
const ANIMAL_COOLDOWN_MS = 350;
const FRIEND_SPEED = 480;
const TRAIL_EVERY_MS = 50;
const IDLE_HINT_MS = 10000;
// En los otros juegos se sale manteniendo Y, pero el bebé lo haría sin querer:
// aquí hay que mantener LB + RB juntos (o Esc) 3 segundos.
const EXIT_HOLD_MS = 3000;
const DEPTH = { trail: 1, shape: 2, animal: 3, friend: 4, firework: 5, ui: 10 };

// Modo Bebé: cualquier botón hace algo bonito. No se gana ni se pierde.
//   A B X Y = figura con carita de ese color + nota   ·   cruceta / stick = se asoma un animalito
//   LB RB LT RT = fuegos artificiales                  ·   stick = mueve a su bolita amiga
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
    this.friends = new Map();
    this.backgroundIndex = 0;
    this.nextBackgroundAt = 0;
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
    this.add.text(width / 2, height - 22, 'Para salir: mantén LB + RB juntos (o Esc)', textStyle(16, TEXT.muted)).setOrigin(0.5).setDepth(DEPTH.ui);
    this.exitBar = this.add.rectangle(width / 2 - 150, height - 46, 300, 8, 0xffffff).setOrigin(0, 0.5).setScale(0, 1).setDepth(DEPTH.ui);
    this.escKey = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);

    // Las teclas que no son de ningún control (a los bebés les encanta machacar el teclado) y el clic
    // también hacen figuras.
    const onKey = (event) => {
      if (event.repeat || event.code === 'Escape' || controls.mappedKeys.has(event.code)) return;
      this.pressFace(Phaser.Utils.Array.GetRandom(FACE_KEYS), this.randomSpot());
    };
    window.addEventListener('keydown', onKey);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => window.removeEventListener('keydown', onKey));
    this.input.on('pointerdown', (pointer) => {
      this.pressFace(Phaser.Utils.Array.GetRandom(FACE_KEYS), { x: pointer.worldX, y: pointer.worldY });
    });
    // En el celular toda la pantalla es para tocar: de los botones táctiles solo quedan LB y RB (para salir).
    touchPad.setMode('bumpers');
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

  update() {
    const dt = frameDelta();
    this.idleMs += dt;
    for (const device of controls.connectedDevices()) this.updateDevice(device.id, dt);

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
    const { color, name, note } = FACE_BUTTONS[key];
    // La misma nota del botón, a veces una octava más arriba.
    sfx.note(note + (Math.random() < 0.5 ? 0 : 5));
    this.spawnShape(x, y, color, name);
    this.idleMs = 0;
  }

  spawnShape(x, y, color, name) {
    const kind = Phaser.Utils.Array.GetRandom(SHAPES);
    const r = Phaser.Math.Between(70, 100);
    const label = this.add
      .text(0, r + 34, name, textStyle(40, TEXT.normal, { fontStyle: 'bold', stroke: '#1b1530', strokeThickness: 8 }))
      .setOrigin(0.5);
    const shape = this.add.container(x, y, [...this.drawShape(kind, r, color), ...this.drawFace(r * FACE_SIZE[kind]), label]);
    shape.setDepth(DEPTH.shape).setScale(0);
    this.tweens.add({ targets: shape, scale: 1, duration: 380, ease: 'Back.easeOut' });
    this.tweens.add({ targets: shape, angle: { from: -8, to: 8 }, duration: 500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    burst(this, x, y, color, 10);
    this.time.delayedCall(SHAPE_LIFE_MS, () => this.fadeShape(shape));

    this.shapes.push(shape);
    // Para no llenar la memoria del Xbox: si hay demasiadas, la más vieja se va rápido.
    if (this.shapes.length > MAX_SHAPES) this.fadeShape(this.shapes[0], 200);
  }

  drawShape(kind, r, color) {
    const ink = COLORS.ink;
    if (kind === 'star') return [this.add.star(0, 0, 5, r * 0.55, r * 1.1, color).setStrokeStyle(6, ink)];
    if (kind === 'square') return [this.add.rectangle(0, 0, r * 1.8, r * 1.8, color).setRounded(r * 0.35).setStrokeStyle(6, ink)];
    if (kind === 'flower') {
      const petals = [];
      for (let i = 0; i < 6; i += 1) {
        const angle = (i / 6) * Math.PI * 2;
        petals.push(this.add.circle(Math.cos(angle) * r * 0.62, Math.sin(angle) * r * 0.62, r * 0.45, color).setStrokeStyle(6, ink));
      }
      return [...petals, this.add.circle(0, 0, r * 0.62, 0xfff4c2).setStrokeStyle(6, ink)];
    }
    return [this.add.circle(0, 0, r, color).setStrokeStyle(6, ink)];
  }

  // Ojitos y sonrisa; `s` es el tamaño de la cara.
  drawFace(s) {
    const eyeX = s * 0.3;
    const eyeY = -s * 0.12;
    const eyeR = s * 0.16;
    const parts = [];
    for (const side of [-1, 1]) {
      parts.push(this.add.circle(side * eyeX, eyeY, eyeR, 0xffffff).setStrokeStyle(3, COLORS.ink));
      parts.push(this.add.circle(side * eyeX, eyeY + eyeR * 0.15, eyeR * 0.55, COLORS.ink));
    }
    const mouth = this.add.graphics();
    mouth.lineStyle(Math.max(4, s * 0.07), COLORS.ink, 1);
    mouth.beginPath();
    mouth.arc(0, s * 0.15, s * 0.28, Phaser.Math.DegToRad(20), Phaser.Math.DegToRad(160), false);
    mouth.strokePath();
    parts.push(mouth);
    return parts;
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

  // Un animalito se asoma por el lado de la flecha y se vuelve a esconder.
  animal(direction) {
    const { width, height } = this.scale;
    const along = Phaser.Math.FloatBetween(0.25, 0.75);
    const path = {
      left: { from: [-90, height * along], to: [170, height * along] },
      right: { from: [width + 90, height * along], to: [width - 170, height * along] },
      up: { from: [width * along, -90], to: [width * along, 160] },
      down: { from: [width * along, height + 90], to: [width * along, height - 190] },
    }[direction];
    const animal = this.add
      .text(path.from[0], path.from[1], Phaser.Utils.Array.GetRandom(ANIMALS), textStyle(120))
      .setOrigin(0.5)
      .setDepth(DEPTH.animal);
    sfx.boing();
    this.tweens.add({
      targets: animal,
      x: path.to[0],
      y: path.to[1],
      duration: 450,
      ease: 'Back.easeOut',
      hold: 900,
      yoyo: true,
      onComplete: () => animal.destroy(),
    });
  }

  firework({ x, y }) {
    sfx.sparkle();
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
    const bothBumpers = controls.connectedDevices().some((device) => controls.isDown(device.id, 'lb') && controls.isDown(device.id, 'rb'));
    this.exitMs = bothBumpers || this.escKey?.isDown ? this.exitMs + dt : 0;
    this.exitBar.setScale(Math.min(1, this.exitMs / EXIT_HOLD_MS), 1);
    if (this.exitMs >= EXIT_HOLD_MS) this.exit();
  }

  exit() {
    if (this.exiting) return;
    this.exiting = true;
    this.scene.start('Menu', { selected: this.returnData.selected });
  }
}
