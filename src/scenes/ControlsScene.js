import Phaser from 'phaser';
import { controls, keyFor } from '../shared/controls.js';
import { players } from '../shared/players.js';
import { sfx } from '../shared/sound.js';
import { say } from '../shared/voice.js';
import { COLORS, TEXT, textStyle } from '../ui/style.js';
import { go } from '../shared/transition.js';
import { Ambience } from '../ui/ambient.js';

// Cómo se dibuja cada botón del control (los colores de los botones de Xbox).
const BUTTONS = {
  a: { label: 'A', color: 0x4cd97b },
  b: { label: 'B', color: 0xff5a5f },
  x: { label: 'X', color: 0x3fa7ff },
  y: { label: 'Y', color: 0xffc93c },
  lb: { label: 'LB', color: 0x8a84b8, wide: true },
  rb: { label: 'RB', color: 0x8a84b8, wide: true },
  lt: { label: 'LT', color: 0x6f6a9e, wide: true },
  rt: { label: 'RT', color: 0x6f6a9e, wide: true },
};
const KEYBOARDS = ['kb1', 'kb2'];
const STICK_KEYS = { kb1: ['W A S D'], kb2: ['Flechas'] };
// El stick derecho ('look', para mirar en la Guerra de pintura).
const LOOK_KEYS = { kb1: ['I J K L'], kb2: ['Num 8 4 5 6'] };
const COLUMN_X = { buttons: 70, action: 250, kb1: 730, kb2: 985 };
const ROW_Y = 200;
const ROW_H = 50;

// Lo que hace cada botón en cada juego. Cada renglón: [botones, qué hace]. Los botones son una lista de
// opciones (cualquiera sirve) y cada opción puede ser una combinación ('lb+rb' = los dos juntos).
// 'stick' = stick o cruceta (en el teclado, WASD o flechas).
const PAGES = [
  {
    title: 'Teclado',
    emoji: '⌨️',
    intro: 'Sin control también se juega: dos jugadores en el mismo teclado. Cada tecla hace lo mismo que el botón del control.',
    rows: [
      [['stick'], 'Moverse (stick o cruceta)'],
      [['a'], 'A: unirse, aceptar'],
      [['b'], 'B: regresar'],
      [['x'], 'X: pegar, especial o poder (según el juego)'],
      [['y'], 'Y: música en el menú; Bloquecito cambia de número'],
      [['lb'], 'LB: escudo o cubrirse'],
      [['rb'], 'RB: escudo, cubrirse o nitro'],
      [['lb+rb+y'], 'Salir de un juego (mantener). Con teclado también sirve Esc'],
    ],
    note: 'En el menú: A = jugar, B = cambiar jugadores, X = voz, Y = música. El Jugador 1 mantiene A para empezar.',
  },
  {
    title: 'Pelea en equipo',
    emoji: '👊',
    rows: [
      [['stick'], 'Caminar (para todos lados)'],
      [['a'], 'Saltar (esquiva cuando al monstruo le sale "!")'],
      [['x'], 'Pegar (tres seguidos = remate)'],
      [['b'], 'Especial de tu personaje'],
      [['lb', 'rb'], 'Agarrar un monstruo y aventarlo (si un amigo le pega en el aire: ¡combo doble!)'],
      [['lb+rb'], 'Con la barra llena: ¡súper! (dos juntos = golpe en equipo)'],
      [['y'], 'Bloquecito: cambia de número (↓ + Y baja)'],
      [['lb+rb+y'], 'Salir (mantener)'],
    ],
    note: 'En el mapa: X = tienda, Y = amigos de la compu, ▲ ▼ = modos. Si alguien cae, párate junto a él. Tu personaje sube de nivel peleando. En La base: entre oleadas, ◀ ▶ y A compran barricadas, torrecitas y resortes; Y = ¡listos!',
  },
  {
    title: 'Bolitas Bros',
    emoji: '🥊',
    rows: [
      [['stick'], 'Correr (↓ baja de la plataforma)'],
      [['a'], 'Saltar'],
      [['x'], 'Golpe (con ↑ o ↓ cambia; mantén X: ¡golpe cargado!)'],
      [['b'], 'Especial (B + ↑ = salto de rescate; con la bola súper: ¡golpe final!)'],
      [['lb', 'rb'], 'Escudo (justo a tiempo: ¡perfecto!; + X agarrar, + ◀ ▶ rodar)'],
      [['lb+rb'], 'Con la barra llena: ¡súper forma!'],
      [['y'], 'Bloquecito: cambia de número (↓ + Y baja)'],
      [['lb+rb+y'], 'Salir (mantener)'],
    ],
    note: 'Con un objeto en la mano, X lo usa (globo de agua, pastel, imán...). En equipo, B de los dos juntos y cerquita: ¡combo de dúo! Cerca de la orilla te agarras (A o ↑ para subir). En la selección, X cambia tu traje.',
  },
  {
    title: 'Súper Bolitas',
    emoji: '🍄',
    rows: [
      [['stick'], 'Caminar (↓ en un tubo = meterse; ↑ en una puerta = entrar; ↓ + A = bajar de una plataforma)'],
      [['a'], 'Saltar (sostenlo: más alto; con capa: planear; en el agua: nadar)'],
      [['b'], 'Correr más rápido (mantener)'],
      [['x'], 'Poder: bola de fuego o de hielo, giro de capa; en el dinosaurio: lengüetazo. En el mapa: modos (Carreritas, Arma tu nivel...)'],
      [['lb', 'rb'], 'En el mapa: cambiar de mundo. Armando tu nivel: cambiar de pieza'],
      [['y'], 'En el mapa: modo peque (cada quien). Armando tu nivel: ¡probarlo! Bloquecito: cambia de número'],
      [['lb+rb+y'], 'Salir (mantener)'],
    ],
    note: 'Brínquenles encima a los enemigos (¡los que tienen picos no!). Si te caes, regresas en burbuja. Armando tu nivel: A pone la pieza y B la borra.',
  },
  {
    title: 'Duelo de bolitas',
    emoji: '🥋',
    rows: [
      [['stick'], 'Caminar (↑ saltar, ↓ agacharse; dos toques = arrancón o rodada)'],
      [['a'], 'Golpe (tres seguidos = remate; agachado = gancho)'],
      [['b'], 'Patada (agachado = barrida; adelante pegadito = agarrar)'],
      [['x'], 'Especial (↓ + X y X en el aire: secretos; en súper forma: ¡golpe final!)'],
      [['lb', 'rb'], 'Cubrirse (justo a tiempo: ¡parada perfecta!)'],
      [['lb+rb'], 'Con la barra llena: ¡súper forma!'],
      [['y'], 'Ayudante (una vez por round; Bloquecito: ↑ + Y, y Y cambia de número)'],
      [['lb+rb+y'], 'Salir (mantener)'],
    ],
    note: 'Antes de pelear, X en tu control cambia el color de tu traje. En el 2 contra 2, X de los dos juntos y cerquita: ¡combo de dúo!',
  },
  {
    title: 'Fútbol de bolitas',
    emoji: '⚽',
    rows: [
      [['stick'], 'Correr'],
      [['a'], 'Saltar'],
      [['x'], 'Patear (con ↑ globito, con ↓ rasante; en el aire, volea)'],
      [['b'], 'Barrida (tumba al rival; cerquita del balón, patea)'],
      [['lb', 'rb'], 'Regate: arrancón en el que no te pueden barrer'],
      [['lb+rb'], 'Con la barra llena: ¡tiro especial! (cada personaje tiene el suyo)'],
      [['y'], 'Bloquecito: cambia de número (↓ + Y baja)'],
      [['lb+rb+y'], 'Salir (mantener)'],
    ],
    note: 'Siempre pateas hacia la portería contraria. En los penales: X tira (↑ alto, ↓ rasante) y A salta para atajar. En los retos: X patea a las dianas y en las dominadas levanta el balón.',
  },
  {
    title: 'Karts locos',
    emoji: '🏁',
    rows: [
      [['stick'], 'Girar'],
      [['a'], 'Acelerar (en el control también RT)'],
      [['b'], 'Frenar y reversa (en el control también LT)'],
      [['rb'], 'Nitro'],
      [['lb'], 'Derrapar (mantener en la curva) · en el aire: truco'],
      [['x'], 'Lanzar el poder de la cajita "?"'],
      [['y'], 'Bloquecito: cambia de número (↓ + Y baja)'],
      [['lb+rb+y'], 'Salir (mantener)'],
    ],
    note: 'En el taller: ↑ ↓ qué cambiar, ◀ ▶ cambiarlo, Y = modo peque 🐣, X = tienda. Al escoger pista: LB = nivel de la compu, RB = vueltas, X = velocidad (y espejo), Y = clima. Busca el letrero "¡Atajo!". Copa Fiesta: granja, feria, jardín gigante y mina (en sus puentes no hay barandal: si te caes, la red te regresa). En Batallas, abajo están las de equipos: Rojos contra Azules.',
  },
  {
    title: 'Carreras',
    emoji: '🏎️',
    rows: [
      [['stick'], 'Manejar (el carro va hacia donde apuntas)'],
      [['a'], 'Turbo'],
      [['b'], 'Frenar'],
      [['x'], 'Usar el poder de la caja de regalo'],
      [['lb+rb+y'], 'Salir (mantener)'],
    ],
  },
  {
    title: 'Minigolf',
    emoji: '⛳',
    rows: [
      [['stick'], 'Apuntar'],
      [['a'], 'Mantener para la fuerza; soltar para tirar'],
      [['lb', 'rb'], 'Afinar la puntería'],
      [['b'], 'Cancelar el tiro'],
      [['x'], 'Minigolf loco: usar el poder de la caja sorpresa'],
      [['lb+rb+y'], 'Salir (mantener)'],
    ],
    note: 'La línea punteada enseña por dónde va a ir la pelota (se puede quitar antes de jugar).',
  },
  {
    title: 'Laberinto',
    emoji: '🍒',
    rows: [
      [['stick'], 'Caminar por el laberinto (apriétalo antes de la esquina y voltea solito)'],
      [['y'], 'Antes de jugar: modo peque (cada quien el suyo)'],
      [['a'], 'Empezar / jugar otra vez'],
      [['b'], 'Regresar'],
      [['lb+rb+y'], 'Salir (mantener)'],
    ],
    note: 'Con la fruta de poder los fantasmitas se ponen azules: ¡a comérselos! Al que atrapan regresa en una burbuja.',
  },
  {
    title: 'Mundo de bloques',
    emoji: '⛏️',
    rows: [
      [['stick'], 'Caminar y apuntar (↑ ↓ en la escalera)'],
      [['a'], 'Brincar (Creativo: A dos veces = volar)'],
      [['x'], 'Mantener: escarbar el bloque marcado (o saludar a un animalito)'],
      [['b'], 'Poner el bloque que escogiste'],
      [['lb', 'rb'], 'Escoger bloque de tu barrita'],
      [['y'], 'Hacer cosas (de noche, junto a tu cama: dormir)'],
      [['lb+rb+y'], 'Salir (mantener; el mundo se guarda solito)'],
    ],
    note: 'Para hacer una torre: brinca y pon un bloque bajo tus pies (↓ + B). La oveja te da lana para la cama.',
  },
  {
    title: 'Guerra de pintura',
    emoji: '🎨',
    rows: [
      [['stick'], 'Caminar (stick izquierdo)'],
      [['look'], 'Mirar y apuntar (stick derecho)'],
      [['rt'], 'Pintar (mantener)'],
      [['lt'], 'Apuntar de cerquita (mantener)'],
      [['a'], 'Brincar'],
      [['b'], 'Nadar en tu tinta (mantener): rapidísimo y se rellena la tinta'],
      [['x'], 'Aventar un globo de pintura'],
      [['lb', 'rb'], 'Cambiar de lanzador: chorrito, largo o rodillo'],
      [['lb+rb+y'], 'Salir (mantener)'],
    ],
  },
  {
    title: 'Modo Bebé',
    emoji: '👶',
    rows: [
      [['a', 'b', 'x', 'y'], 'Figura con carita y una nota'],
      [['stick'], 'Animalitos y mover a su bolita amiga'],
      [['lb', 'rb'], 'Fuegos artificiales (pintando: borrar)'],
      [['lt+rt'], 'Mantener: otro juego (escondidas, globos, pintar)'],
      [['lb+rb+y'], 'Salir (mantener 3 segundos)'],
    ],
    note: 'En el teclado cualquier otra tecla también hace figuras, y Tab cambia de juego.',
  },
];

// "Cómo jugar": qué tecla es cada botón (para jugar sin control) y qué hace cada botón en cada juego,
// una página por juego. ◀ ▶ cambia de página, Y abre la prueba de controles, B regresa al menú.
export class ControlsScene extends Phaser.Scene {
  constructor() {
    super('Controles');
  }

  init(data) {
    this.returnData = data ?? {};
    this.page = 0;
  }

  create() {
    const { width, height } = this.scale;
    this.ambience = new Ambience(this, 'menu', { depth: -10 });
    this.add.text(width / 2, 44, 'Cómo jugar', textStyle(46, TEXT.normal, { fontStyle: 'bold' })).setOrigin(0.5);
    this.dots = PAGES.map((_, i) => this.add.circle(width / 2 + (i - (PAGES.length - 1) / 2) * 26, height - 62, 7, COLORS.panelBorder));
    this.add
      .text(width / 2, height - 24, '◀ ▶ cambiar de página   ·   Y = prueba de controles   ·   B = regresar', textStyle(20, TEXT.accent))
      .setOrigin(0.5);
    this.showPage(0, false);
  }

  showPage(index, speak = true) {
    this.page = (index + PAGES.length) % PAGES.length;
    this.content?.destroy();
    const page = PAGES[this.page];
    const { width } = this.scale;
    this.content = this.add.container(0, 0);
    this.content.add(this.add.text(width / 2, 100, `${page.emoji}  ${page.title}`, textStyle(32, TEXT.accent, { fontStyle: 'bold' })).setOrigin(0.5));
    const intro = page.intro ?? 'Qué hace cada botón, y su tecla en cada teclado:';
    this.content.add(this.add.text(width / 2, 140, intro, textStyle(19, TEXT.muted, { align: 'center', wordWrap: { width: 1150 } })).setOrigin(0.5));

    const top = ROW_Y;
    this.content.add([
      this.add.text(COLUMN_X.buttons, top - 22, 'Control', textStyle(18, TEXT.muted, { fontStyle: 'bold' })).setOrigin(0, 0.5),
      this.add.text(COLUMN_X.action, top - 22, 'Qué hace', textStyle(18, TEXT.muted, { fontStyle: 'bold' })).setOrigin(0, 0.5),
      this.add.text(COLUMN_X.kb1, top - 22, 'Teclado 1', textStyle(18, TEXT.muted, { fontStyle: 'bold' })).setOrigin(0, 0.5),
      this.add.text(COLUMN_X.kb2, top - 22, 'Teclado 2', textStyle(18, TEXT.muted, { fontStyle: 'bold' })).setOrigin(0, 0.5),
    ]);
    page.rows.forEach(([options, action], i) => {
      const y = top + 18 + i * ROW_H;
      this.content.add(this.add.rectangle(width / 2, y, width - 80, ROW_H - 8, i % 2 ? COLORS.bg : COLORS.panel).setRounded(12));
      this.drawButtons(COLUMN_X.buttons, y, options);
      this.content.add(this.add.text(COLUMN_X.action, y, action, textStyle(20, TEXT.normal, { wordWrap: { width: 460 } })).setOrigin(0, 0.5));
      for (const kb of KEYBOARDS) this.drawKeys(COLUMN_X[kb], y, options, kb);
    });
    if (page.note) {
      const y = top + 18 + page.rows.length * ROW_H + 8;
      this.content.add(this.add.text(width / 2, y, `💡 ${page.note}`, textStyle(19, TEXT.normal, { align: 'center', wordWrap: { width: 1150 } })).setOrigin(0.5, 0));
    }
    this.dots.forEach((dot, i) => dot.setFillStyle(i === this.page ? COLORS.accent : COLORS.panelBorder));
    if (speak) say(page.title);
  }

  // Los botones del control: cada opción separada por "o", y las combinaciones con "+".
  drawButtons(x, y, options) {
    let cursor = x;
    options.forEach((option, i) => {
      if (i > 0) cursor = this.addLabel(cursor + 6, y, options.length > 2 ? '' : 'o', TEXT.muted) + 6;
      option.split('+').forEach((name, k) => {
        if (k > 0) cursor = this.addLabel(cursor + 4, y, '+', TEXT.muted) + 4;
        cursor = this.drawButton(cursor, y, name);
      });
    });
  }

  drawButton(x, y, name) {
    if (name === 'stick' || name === 'look') {
      const base = this.add.circle(x + 18, y, 18, 0x3a3a4a).setStrokeStyle(3, 0x8a84b8);
      // (El derecho, con la bolita amarilla.)
      const knob = this.add.circle(x + 18, y, 9, name === 'look' ? 0xffc93c : 0xb9b4dd);
      this.content.add([base, knob]);
      return x + 36;
    }
    const button = BUTTONS[name];
    const w = button.wide ? 46 : 34;
    const shape = button.wide
      ? this.add.rectangle(x + w / 2, y, w, 28, button.color).setRounded(10)
      : this.add.circle(x + w / 2, y, 17, button.color);
    const label = this.add.text(x + w / 2, y, button.label, textStyle(17, TEXT.ink, { fontStyle: 'bold' })).setOrigin(0.5);
    this.content.add([shape, label]);
    return x + w;
  }

  // Las teclas de un teclado para esos botones, como teclitas dibujadas. Con muchas opciones (A B X Y
  // del Modo Bebé) van juntitas, sin "o", para que quepan.
  drawKeys(x, y, options, kb) {
    let cursor = x;
    const seen = new Set();
    const separator = options.length > 2 ? '' : 'o';
    options.forEach((option) => {
      const keys = option === 'stick' ? STICK_KEYS[kb] : option === 'look' ? LOOK_KEYS[kb] : option.split('+').map((name) => keyFor(kb, name));
      // (Si un botón no tiene tecla, no se pone.)
      if (keys.some((key) => !key)) return;
      const label = keys.join(' + ');
      if (seen.has(label)) return;
      if (seen.size > 0) cursor = this.addLabel(cursor + 6, y, separator, TEXT.muted) + 6;
      seen.add(label);
      keys.forEach((key, k) => {
        if (k > 0) cursor = this.addLabel(cursor + 3, y, '+', TEXT.muted) + 3;
        const text = this.add.text(0, y, key, textStyle(16, TEXT.ink, { fontStyle: 'bold' })).setOrigin(0.5);
        const w = Math.max(30, text.width + 16);
        text.setX(cursor + w / 2);
        const cap = this.add.rectangle(cursor + w / 2, y, w, 30, 0xe8e6f5).setRounded(7).setStrokeStyle(2, 0x8a84b8);
        this.content.add([cap, text]);
        cursor += w;
      });
    });
  }

  addLabel(x, y, text, color) {
    if (!text) return x;
    const label = this.add.text(x, y, text, textStyle(17, color)).setOrigin(0, 0.5);
    this.content.add(label);
    return x + label.width;
  }

  update() {
    const host = players.host();
    if (!host) {
      go(this, 'Join');
      return;
    }
    const id = host.deviceId;
    const step = (controls.justPressed(id, 'right') ? 1 : 0) - (controls.justPressed(id, 'left') ? 1 : 0);
    if (step !== 0) {
      sfx.select();
      this.showPage(this.page + step);
    }
    if (controls.justPressed(id, 'y')) {
      sfx.confirm();
      go(this, 'PadTest', { selected: this.returnData.selected });
    } else if (controls.justPressed(id, 'b')) {
      sfx.back();
      go(this, 'Menu', { selected: this.returnData.selected });
    }
  }
}
