import Phaser from 'phaser';

// Fondos con vida: cosas chiquitas que se mueven encima del dibujo del fondo, según el lugar (pájaros en la pradera,
// nieve en la montaña, burbujas en el mar, chispas en el volcán, murciélagos en la casa embrujada...). Todo va fijo
// a la pantalla (no se mueve con la cámara) y con pocas piezas, para que el Xbox vaya ligero. Cada pieza se anima
// sola con tweens que se repiten; destroy() quita todo.
const KINDS = {
  birds: { count: 3 },
  butterflies: { count: 3 },
  bats: { count: 4 },
  clouds: { count: 3 },
  snow: { count: 34 },
  embers: { count: 18 },
  bubbles: { count: 16 },
  sparkles: { count: 14 },
  dust: { count: 14 },
  leaves: { count: 10 },
  sprinkles: { count: 18 },
  stars: { count: 30 },
  confetti: { count: 14 },
};

// Qué se mueve en cada lugar (temas de Súper Bolitas, mundos de Pelea en equipo, escenarios de Bolitas Bros y del
// Duelo, canchas del fútbol y el menú).
export const AMBIENCE = {
  menu: ['bubbles', 'stars'],
  pradera: ['birds', 'butterflies', 'leaves'],
  bosque: ['birds', 'butterflies', 'leaves'],
  selva: ['birds', 'butterflies', 'leaves'],
  cancha: ['birds', 'confetti'],
  cueva: ['dust'],
  cielo: ['clouds', 'birds'],
  nubes: ['clouds', 'birds'],
  globos: ['clouds', 'birds'],
  playa: ['birds', 'sparkles'],
  barco: ['birds', 'sparkles'],
  mar: ['bubbles'],
  castillo: ['embers'],
  volcan: ['embers'],
  lava: ['embers'],
  nieve: ['snow'],
  dulces: ['sprinkles'],
  pastel: ['sprinkles'],
  embrujada: ['bats', 'dust'],
  espacio: ['stars'],
  luna: ['stars'],
  ciudad: ['stars', 'birds'],
  azotea: ['stars'],
  lucha: ['confetti', 'sparkles'],
  dojo: ['leaves'],
  juguetes: ['confetti'],
};

// Los dibujos de Gemini (los carga scenes/WipeScene.js); si no están, se dibujan con figuras.
const art = (scene, name) => (scene.textures.exists(`amb:${name}`) ? `amb:${name}` : null);

export class Ambience {
  constructor(scene, theme, { depth = -50, kinds = null } = {}) {
    this.scene = scene;
    this.root = scene.add.container(0, 0).setDepth(depth).setScrollFactor(0);
    this.pieces = [];
    this.timers = [];
    for (const kind of kinds ?? AMBIENCE[theme] ?? []) {
      for (let i = 0; i < KINDS[kind].count; i += 1) this[kind]?.(i);
    }
  }

  get width() {
    return this.scene.scale.width;
  }

  get height() {
    return this.scene.scale.height;
  }

  add(piece) {
    this.root.add(piece);
    this.pieces.push(piece);
    return piece;
  }

  // Cae (o sube) de `from` a `to` una y otra vez, meciéndose de lado. Empieza en cualquier punto del camino, para
  // que desde el principio ya haya por todos lados.
  loop(piece, prop, from, to, ms) {
    const start = from + (to - from) * Math.random();
    piece[prop] = start;
    this.scene.tweens.add({
      targets: piece,
      [prop]: to,
      duration: (ms * Math.abs(to - start)) / Math.abs(to - from),
      onComplete: () => {
        piece[prop] = from;
        this.scene.tweens.add({ targets: piece, [prop]: to, duration: ms, repeat: -1 });
      },
    });
  }

  fall(piece, { from, to, ms, sway = 30 }) {
    const x = piece.x;
    this.loop(piece, 'y', from, to, ms);
    if (sway) this.scene.tweens.add({ targets: piece, x: x + sway, duration: 900 + Math.random() * 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }

  // Un dibujo de `size` px (lo más largo).
  image(key, size) {
    const image = this.scene.add.image(0, 0, key);
    return image.setScale(size / Math.max(image.width, image.height));
  }

  snow(i) {
    // Uno de cada seis es un copo dibujado, grandecito y girando.
    const copo = i % 6 === 0 && art(this.scene, 'copo');
    const flake = this.add(copo ? this.image(copo, 18 + Math.random() * 8).setPosition(Math.random() * this.width, 0) : this.scene.add.circle(Math.random() * this.width, 0, 2 + Math.random() * 3, 0xffffff, 0.85));
    if (copo) this.scene.tweens.add({ targets: flake, angle: 360, duration: 5000, repeat: -1 });
    this.fall(flake, { from: -10, to: this.height + 10, ms: 5000 + Math.random() * 4000, sway: 25 });
  }

  embers() {
    const ember = this.add(this.scene.add.circle(Math.random() * this.width, 0, 2 + Math.random() * 2.5, Math.random() < 0.5 ? 0xff9a3c : 0xffd84d, 0.9));
    ember.setBlendMode(Phaser.BlendModes.ADD);
    this.fall(ember, { from: this.height + 10, to: this.height * 0.2, ms: 3500 + Math.random() * 3000, sway: 20 });
    this.scene.tweens.add({ targets: ember, alpha: 0.2, duration: 400 + Math.random() * 400, yoyo: true, repeat: -1 });
  }

  bubbles() {
    const r = 4 + Math.random() * 9;
    const bubble = this.add(this.scene.add.circle(Math.random() * this.width, 0, r, 0xbfe9ff, 0.12).setStrokeStyle(2, 0xffffff, 0.45));
    this.fall(bubble, { from: this.height + r, to: -r, ms: 6000 + Math.random() * 5000, sway: 18 });
  }

  dust() {
    const mote = this.add(this.scene.add.circle(Math.random() * this.width, Math.random() * this.height, 1.5 + Math.random() * 2, 0xfff3d0, 0.5));
    this.scene.tweens.add({
      targets: mote,
      x: mote.x + Phaser.Math.Between(-80, 80),
      y: mote.y + Phaser.Math.Between(-60, 60),
      alpha: 0.1,
      duration: 3000 + Math.random() * 3000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  sparkles() {
    const star = this.add(this.scene.add.star(Math.random() * this.width, this.height * (0.45 + Math.random() * 0.35), 4, 1.5, 7, 0xffffff, 0.9).setScale(0));
    this.scene.tweens.add({ targets: star, scale: 1, angle: 90, duration: 350, yoyo: true, repeat: -1, repeatDelay: 1500 + Math.random() * 3000, delay: Math.random() * 3000 });
  }

  stars() {
    const star = this.add(this.scene.add.circle(Math.random() * this.width, Math.random() * this.height * 0.75, 1 + Math.random() * 1.8, 0xffffff, 0.8));
    this.scene.tweens.add({ targets: star, alpha: 0.15, duration: 600 + Math.random() * 1400, yoyo: true, repeat: -1, delay: Math.random() * 2000 });
  }

  leaves() {
    const colors = [0x8fd16a, 0xf2b84b, 0xe8875a];
    const hoja = art(this.scene, 'hoja');
    const leaf = this.add(hoja ? this.image(hoja, 20).setPosition(Math.random() * this.width, 0) : this.scene.add.ellipse(Math.random() * this.width, 0, 12, 6, colors[Math.floor(Math.random() * colors.length)], 0.9));
    this.fall(leaf, { from: -10, to: this.height + 10, ms: 7000 + Math.random() * 4000, sway: 60 });
    this.scene.tweens.add({ targets: leaf, angle: 360, duration: 2500 + Math.random() * 2000, repeat: -1 });
  }

  sprinkles(i = 0) {
    const colors = [0xff5a7a, 0xffd84d, 0x7fd0ff, 0x9fe07a, 0xffffff, 0xc58cff];
    // Uno de cada cuatro es un caramelo dibujado.
    const dulce = i % 4 === 0 && art(this.scene, 'dulce');
    const bit = this.add(dulce ? this.image(dulce, 24).setPosition(Math.random() * this.width, 0) : this.scene.add.rectangle(Math.random() * this.width, 0, 10, 4, colors[Math.floor(Math.random() * colors.length)]));
    this.fall(bit, { from: -10, to: this.height + 10, ms: 6000 + Math.random() * 4000, sway: 30 });
    this.scene.tweens.add({ targets: bit, angle: 360, duration: 1500 + Math.random() * 1500, repeat: -1 });
  }

  confetti(i) {
    this.sprinkles(i);
  }

  // Nubecitas que pasan despacio por arriba.
  clouds(i) {
    const y = 60 + i * 55 + Math.random() * 30;
    const cloud = this.add(this.scene.add.container(-160, y));
    for (const [dx, dy, r] of [[0, 0, 26], [28, -10, 32], [58, 0, 24], [30, 8, 26]]) cloud.add(this.scene.add.circle(dx, dy, r, 0xffffff, 0.75));
    this.loop(cloud, 'x', -160, this.width + 160, 40000 + Math.random() * 25000);
  }

  // Pájaros que cruzan el cielo de vez en cuando, aleteando (con dibujo: dos cuadros; sin dibujo: una "v").
  birds(i) {
    this.flyer(i, 0x2b2550, 18, 9, ['pajaro1', 'pajaro2'], 34, true);
  }

  bats(i) {
    this.flyer(i, 0x2a1838, 26, 12, ['murcielago1', 'murcielago2'], 40, false);
  }

  // Mariposas que revolotean despacito por abajo.
  butterflies() {
    const key = art(this.scene, 'mariposa');
    if (!key) return;
    const butterfly = this.add(this.image(key, 26).setPosition(Math.random() * this.width, this.height * (0.45 + Math.random() * 0.3)));
    this.scene.tweens.add({ targets: butterfly, scaleX: butterfly.scaleX * 0.25, duration: 120, yoyo: true, repeat: -1 });
    const wander = () => {
      this.scene.tweens.add({
        targets: butterfly,
        x: Phaser.Math.Clamp(butterfly.x + Phaser.Math.Between(-220, 220), 20, this.width - 20),
        y: Phaser.Math.Clamp(butterfly.y + Phaser.Math.Between(-90, 90), this.height * 0.3, this.height * 0.85),
        duration: 2600 + Math.random() * 2000,
        ease: 'Sine.easeInOut',
        onComplete: wander,
      });
    };
    wander();
  }

  flyer(i, color, span, wing, frames, size, sideways) {
    const bird = this.add(this.scene.add.container(0, 0));
    const keys = frames.map((name) => art(this.scene, name));
    let flip = null;
    if (keys.every(Boolean)) {
      const image = this.image(keys[0], size);
      bird.add(image);
      flip = (right) => image.setFlipX(sideways && !right);
      this.timers.push(this.scene.time.addEvent({ delay: 150 + Math.random() * 60, loop: true, callback: () => image.setTexture(image.texture.key === keys[0] ? keys[1] : keys[0]) }));
    } else {
      const g = this.scene.add.graphics();
      g.lineStyle(3, color, 1);
      g.beginPath();
      g.moveTo(-span / 2, -wing / 2);
      g.lineTo(0, wing / 2);
      g.lineTo(span / 2, -wing / 2);
      g.strokePath();
      bird.add(g);
      this.scene.tweens.add({ targets: g, scaleY: -0.6, duration: 140 + Math.random() * 60, yoyo: true, repeat: -1 });
    }
    const fly = () => {
      const right = Math.random() < 0.5;
      flip?.(right);
      const y = 60 + Math.random() * this.height * 0.35;
      bird.setPosition(right ? -40 : this.width + 40, y);
      this.scene.tweens.add({
        targets: bird,
        x: right ? this.width + 40 : -40,
        y: y + Phaser.Math.Between(-60, 60),
        duration: 7000 + Math.random() * 5000,
        delay: 1500 + Math.random() * 6000 + i * 1200,
        ease: 'Sine.easeInOut',
        onComplete: fly,
      });
    };
    fly();
  }

  destroy() {
    // (Si ya se destruyó con la escena, no hay nada que hacer.)
    if (!this.root.scene) return;
    for (const timer of this.timers) timer.remove();
    for (const piece of this.pieces) this.scene.tweens.killTweensOf(piece);
    this.scene.tweens.killTweensOf(this.root.list.flatMap((p) => (p.list ? [p, ...p.list] : [p])));
    this.root.destroy();
    this.pieces = [];
  }
}
