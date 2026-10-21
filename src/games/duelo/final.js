import Phaser from 'phaser';
import { sfx } from '../../shared/sound.js';
import { say } from '../../shared/voice.js';
import { textStyle } from '../../ui/style.js';
import { burst, popText, randomPow } from '../brawl/effects.js';
import { characterTexture } from '../smash/art.js';
import { FLOOR, WALLS } from './DueloFighter.js';

// El golpe final "de película": en súper forma, el primer X. Se oscurece todo, cruza la pantalla una franja con
// el personaje y el nombre de su golpe, aparece junto al rival, le da una ráfaga de golpes y al final un golpazo.
// No se puede cubrir. Al terminar se acaba la súper forma.
export const FINAL_NAMES = {
  tanque: 'Meteoro de puños',
  rayo: 'Mil relámpagos',
  resorte: 'Súper resortazo',
  estrella: 'Lluvia de estrellas',
  ninja: 'Mil sombras',
  robot: 'Láser gigante',
  dragon: 'Fuego de dragón',
  fantasma: 'Susto final',
  dino: 'Terremoto jurásico',
  gatito: 'Arañazo supremo',
  pinguino: 'Avalancha polar',
  pirata: 'Cañonazo pirata',
  hada: 'Hechizo de estrellas',
  astronauta: 'Cohete galáctico',
  abeja: 'Enjambre furioso',
  bombero: 'Manguerazo máximo',
  bloquecito: 'Torre de bloques',
};
export const FINAL_DAMAGE = 30;

// Cuándo pasa cada cosa (ms desde que empieza).
const CUT_IN_MS = 1150;
const APPEAR_MS = 1250;
const BARRAGE = { from: 1320, gapMs: 100, hits: 6 };
const BIG_HIT_MS = 2000;
const END_MS = 2550;
const DEPTH = 9900;

export class FinalMove {
  constructor(scene, attacker, victim) {
    this.scene = scene;
    this.attacker = attacker;
    this.victim = victim;
    this.t = 0;
    this.hits = 0;
    this.name = FINAL_NAMES[attacker.character] ?? 'Golpe final';
    const { width, height } = scene.scale;
    this.layer = scene.add.container(0, 0).setDepth(DEPTH);
    this.shade = scene.add.rectangle(width / 2, height / 2, width, height, 0x0b0820, 0).setDepth(90);
    scene.tweens.add({ targets: this.shade, fillAlpha: 0.7, duration: 200 });

    // La franja: cruzada, del color del personaje, con su dibujo y el nombre del golpe.
    const band = scene.add.container(-width, height * 0.45).setAngle(-6);
    band.add(scene.add.rectangle(width / 2, 0, width * 1.4, 250, attacker.color).setStrokeStyle(10, 0xffffff));
    band.add(scene.add.rectangle(width / 2, -100, width * 1.4, 14, 0xffffff, 0.6));
    band.add(scene.add.rectangle(width / 2, 100, width * 1.4, 14, 0xffffff, 0.6));
    const art = attacker.look.character;
    const key = attacker.look.hasArt ? characterTexture(scene, art, 'entrada') ?? characterTexture(scene, art, 'especial') : null;
    if (key) {
      const portrait = scene.add.image(260, 10, key);
      portrait.setScale(300 / portrait.height);
      band.add(portrait);
    }
    const style = { fontStyle: 'bold', stroke: '#1b1530', strokeThickness: 10 };
    band.add(scene.add.text(key ? 760 : width / 2, -38, '¡GOLPE FINAL!', textStyle(78, '#ffd84d', style)).setOrigin(0.5));
    band.add(scene.add.text(key ? 760 : width / 2, 46, this.name, textStyle(44, '#ffffff', { ...style, strokeThickness: 8 })).setOrigin(0.5));
    this.layer.add(band);
    this.band = band;
    scene.tweens.add({ targets: band, x: 0, duration: 260, ease: 'Back.easeOut' });
    scene.cameras.main.flash(160, 255, 255, 255);
    sfx.transform();
    say(`¡${this.name}!`);
  }

  // Devuelve true cuando termina.
  update(dtMs) {
    const before = this.t;
    this.t += dtMs;
    const crossed = (ms) => before < ms && this.t >= ms;
    if (crossed(CUT_IN_MS)) this.scene.tweens.add({ targets: this.band, alpha: 0, x: this.scene.scale.width * 0.3, duration: 180 });
    if (crossed(APPEAR_MS)) this.appear();
    while (this.hits < BARRAGE.hits && this.t >= BARRAGE.from + this.hits * BARRAGE.gapMs) this.smallHit();
    if (crossed(BIG_HIT_MS)) this.bigHit();
    if (this.t < END_MS) return false;
    this.finish();
    return true;
  }

  // Aparece pegadito al rival (los dos en el piso, el rival ya sin poder moverse).
  appear() {
    const { attacker: a, victim: v, scene } = this;
    scene.poof?.(a.x, a.y - a.height / 2);
    Object.assign(v, { y: FLOOR, vy: 0, vx: 0, pushVx: 0, launched: false, downMs: 0, attack: null, special: null, dash: null, blocking: false });
    let side = Math.sign(a.x - v.x) || -v.facing;
    let x = v.x + side * (a.radius + v.radius) * 0.75;
    if (x < WALLS.left + a.radius || x > WALLS.right - a.radius) {
      side = -side;
      x = v.x + side * (a.radius + v.radius) * 0.75;
    }
    Object.assign(a, { x, y: FLOOR, vy: 0, vx: 0, pushVx: 0, attack: null, special: null, dash: null, cinematic: 'especial' });
    a.facing = Math.sign(v.x - a.x) || a.facing;
    v.facing = -a.facing;
    scene.poof?.(a.x, a.y - a.height / 2);
  }

  smallHit() {
    const { attacker: a, victim: v, scene } = this;
    this.hits += 1;
    const x = v.x - a.facing * v.radius * 0.3 + Phaser.Math.Between(-20, 20);
    const y = v.y - v.height * Phaser.Math.FloatBetween(0.3, 0.8);
    burst(scene, x, y, this.hits % 2 ? 0xffffff : a.color, 8);
    popText(scene, x, y - 30, randomPow(), '#ffd84d');
    v.hurtMs = 220;
    v.flashMs = 60;
    a.cinematic = this.hits % 2 ? 'golpe' : 'especial';
    scene.cameras.main.shake(80, 0.005);
    sfx.hit(0.5);
  }

  bigHit() {
    const { attacker: a, victim: v, scene } = this;
    a.cinematic = 'golpe';
    v.invulnerableMs = 0;
    const data = { damage: FINAL_DAMAGE, power: 1, push: 760, stunMs: 500, launch: true, lift: 1.5, special: true, unblockable: true };
    const result = v.takeHit(data, a.x);
    const y = v.y - v.height / 2;
    burst(scene, v.x, y, 0xffd84d, 18);
    burst(scene, v.x, y, a.color, 14);
    scene.shockwave?.(v.x, y, a.color);
    popText(scene, v.x, y - 60, '¡GOLPE FINAL!', '#ff9a3c');
    scene.cameras.main.flash(220, 255, 240, 200);
    scene.cameras.main.shake(320, 0.016);
    sfx.boom();
    if (result) scene.countHit?.(a, v, result, data);
  }

  finish() {
    this.attacker.cinematic = null;
    this.attacker.endSuper();
    this.scene.tweens.add({ targets: this.shade, fillAlpha: 0, duration: 250, onComplete: () => this.shade.destroy() });
    this.layer.destroy();
  }
}
