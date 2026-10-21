import { rewards } from '../../shared/rewards.js';
import { sfx } from '../../shared/sound.js';
import { textStyle } from '../../ui/style.js';
import { JONRON, jonronRecord } from './modes.js';

// El concurso de jonrón de Bolitas Bros, para el que tiene el turno:
//   hit:   10 segundos para pegarle al saco y subirle el % (unas paredes de cristal no lo dejan salirse).
//   swing: se quitan las paredes y te dan un bate: ¡un batazo para mandarlo lejos!
//   fly:   la cámara sigue al saco hasta que se para en el pasto; se mide desde la orilla del escenario.
//   done:  los metros (y si fue récord) un momento.
const FIELD_DROP = 300;
const MARK_EVERY_M = 25;
const MARKS = 20;
const DONE_MS = 2600;
const MAX_FLY_MS = 9000;

export class JonronContest {
  // `sky` y `backdrop` (hasta dónde llega el dibujo del fondo): para que la orilla del fondo se pierda poco a poco
  // en el cielo (el saco vuela lejísimos).
  constructor(scene, world, main, sky, backdrop) {
    this.scene = scene;
    this.main = main;
    this.step = 'hit';
    this.ms = JONRON.hitMs;
    this.meters = 0;
    this.record = false;
    // El pasto de abajo, larguísimo, para que el saco tenga dónde caer (una plataforma más).
    this.field = { left: -60000, right: 62000, top: main.top + FIELD_DROP, dx: 0, dy: 0, field: true };
    const fade = scene.add.graphics();
    const { left, right, top } = backdrop;
    const edge = 500;
    fade.fillGradientStyle(sky, sky, sky, sky, 0, 1, 0, 1);
    fade.fillRect(right - edge, top - 3000, edge, this.field.top - top + 3000);
    fade.fillGradientStyle(sky, sky, sky, sky, 1, 0, 1, 0);
    fade.fillRect(left, top - 3000, edge, this.field.top - top + 3000);
    fade.fillGradientStyle(sky, sky, sky, sky, 1, 1, 0, 0);
    fade.fillRect(left, top, right - left, 300);
    const grass = [
      scene.add.rectangle(1000, this.field.top + 400, 130000, 800, 0x58b84a),
      scene.add.rectangle(1000, this.field.top + 6, 130000, 12, 0x7ad46a),
    ];
    // Letreros de los metros, desde cada orilla del escenario.
    const marks = [];
    for (let i = 1; i <= MARKS; i += 1) {
      const meters = i * MARK_EVERY_M;
      for (const side of [-1, 1]) {
        const x = (side > 0 ? main.right : main.left) + side * meters * JONRON.pxPerMeter;
        marks.push(scene.add.rectangle(x, this.field.top - 30, 6, 60, 0xffffff));
        marks.push(scene.add.text(x, this.field.top - 80, `${meters} m`, textStyle(26, '#ffffff', { fontStyle: 'bold', stroke: '#1b1530', strokeThickness: 6 })).setOrigin(0.5));
      }
    }
    // Las paredes de cristal (solo mientras le pegas).
    this.walls = [main.left, main.right].map((x) => scene.add.rectangle(x, main.top - 350, 14, 700, 0x9fd8ff, 0.35).setStrokeStyle(3, 0xffffff, 0.6));
    // (El desvanecido va justo encima del fondo, debajo de las plataformas.)
    world.addAt(fade, 1);
    world.add([...grass, ...marks, ...this.walls]);
  }

  // Cuántos metros lleva el saco (desde la orilla del escenario hacia donde se fue).
  distance(bag) {
    const side = bag.x >= (this.main.left + this.main.right) / 2 ? 1 : -1;
    const edge = side > 0 ? this.main.right : this.main.left;
    return Math.max(0, ((bag.x - edge) * side) / JONRON.pxPerMeter);
  }

  // Devuelve el letrero del reloj. `player` es el que tiene el turno.
  update(dtMs, bag, player) {
    // Si el que pega se cae al pasto, regresa arriba.
    if (player.platform === this.field) player.spawn(this.main.left + 200, this.main.top - 200, 0);
    if (this.step === 'hit') {
      this.ms -= dtMs;
      this.keepInside(bag);
      if (this.ms <= 0) {
        this.step = 'swing';
        this.ms = JONRON.swingMs;
        this.swingAt = this.scene.time.now;
        // Un bate nuevo para el batazo final.
        player.held = null;
        player.grab('bat');
        this.scene.tweens.add({ targets: this.walls, alpha: 0, duration: 300 });
        this.scene.showBanner('¡Batazo!', '¡Mándalo lejos con el bate (X)!', 1400, '#ffd84d');
        sfx.meterFull();
      }
      return `⏱ ${Math.ceil(this.ms / 1000)}   ·   Saco: ${Math.round(bag.damage)}%`;
    }
    if (this.step === 'swing') {
      this.ms -= dtMs;
      const hit = bag.lastHitAt > this.swingAt;
      if (hit || this.ms <= 0) {
        this.step = 'fly';
        this.ms = 0;
      }
      return `⚾ ¡Batazo! ${Math.max(0, Math.ceil(this.ms / 1000))}   ·   Saco: ${Math.round(bag.damage)}%`;
    }
    if (this.step === 'fly') {
      this.ms += dtMs;
      // Mientras vuela no "se frena" solo como un peleador: sigue aventado hasta caer.
      if (!bag.grounded) bag.hitstunMs = Math.max(bag.hitstunMs, 60);
      const stopped = bag.grounded && Math.abs(bag.vx) < 15 && this.ms > 500;
      if (stopped || this.ms > MAX_FLY_MS) this.land(bag, player);
      return `📏 ${this.distance(bag).toFixed(1)} m`;
    }
    this.ms += dtMs;
    return `📏 ${this.meters.toFixed(1)} m${this.record ? '  ¡Récord!' : ''}`;
  }

  keepInside(bag) {
    const r = bag.radius;
    if (bag.x < this.main.left + r) {
      bag.x = this.main.left + r;
      bag.vx = Math.abs(bag.vx) * 0.5;
    }
    if (bag.x > this.main.right - r) {
      bag.x = this.main.right - r;
      bag.vx = -Math.abs(bag.vx) * 0.5;
    }
    const ceiling = this.main.top - 700;
    if (bag.y < ceiling) {
      bag.y = ceiling;
      bag.vy = Math.abs(bag.vy) * 0.5;
    }
  }

  land(bag, player) {
    this.step = 'done';
    this.ms = 0;
    this.meters = Math.round(this.distance(bag) * 10) / 10;
    player.record.meters = this.meters;
    this.record = this.meters > 0 && jonronRecord.save(this.meters);
    if (this.meters >= JONRON.sticker) rewards.earn('smash-jonron');
    const title = this.meters > 0 ? `¡${this.meters.toFixed(1)} metros!` : '¡Ups! No salió';
    this.scene.showBanner(title, this.record ? '¡Nuevo récord!' : `Récord: ${jonronRecord.get().toFixed(1)} m`, 0, '#ffd84d');
    if (this.meters > 0) sfx.win();
  }

  get finished() {
    return this.step === 'done' && this.ms > DONE_MS;
  }

  // La cámara sigue al saco mientras vuela y cuando cae.
  get following() {
    return this.step === 'fly' || this.step === 'done';
  }
}
