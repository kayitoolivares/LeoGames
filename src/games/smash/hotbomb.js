import Phaser from 'phaser';
import { sfx } from '../../shared/sound.js';
import { textStyle } from '../../ui/style.js';
import { burst, popText } from '../brawl/effects.js';

// Modo Bomba caliente: una bomba con su reloj anda arriba de la cabeza de alguien; si ese le pega a otro, se la pasa
// (y no se la pueden regresar luego luego). Al que le explota sale volando lejísimos. Después de un ratito aparece
// otra arriba de alguien al azar. Fuera de eso es como el modo Vidas (gana el último que quede).
const FUSE_MS = [9000, 14000];
const NEXT_MS = 1800;
const NO_RETURN_MS = 700;
const BEEP_FROM_MS = 3000;
export const HOT_HIT = { damage: 25, base: 1050, scale: 12, angle: 65 };

export class HotBomb {
  constructor(scene, world) {
    this.scene = scene;
    this.holder = null;
    this.passer = null;
    this.fuseMs = 0;
    this.waitMs = NEXT_MS;
    this.noReturnMs = 0;
    this.lastBeep = null;
    this.exploded = 0;
    const g = scene.add.graphics();
    g.fillStyle(0x2a2a36, 1);
    g.fillCircle(0, 0, 22);
    g.lineStyle(4, 0x1b1530, 1);
    g.strokeCircle(0, 0, 22);
    g.fillStyle(0xffffff, 0.45);
    g.fillCircle(-8, -8, 6);
    g.lineStyle(4, 0x8a6a3a, 1);
    g.beginPath();
    g.moveTo(8, -18);
    g.lineTo(16, -30);
    g.strokePath();
    this.spark = scene.add.star(17, -33, 6, 4, 9, 0xffc93c);
    this.count = scene.add.text(0, 2, '', textStyle(22, '#ffffff', { fontStyle: 'bold' })).setOrigin(0.5);
    this.sprite = scene.add.container(0, 0, [g, this.spark, this.count]).setDepth(900).setVisible(false);
    world.add(this.sprite);
  }

  // Los que pueden traer la bomba: los peleadores vivos (no los ayudantes del huevo).
  candidates(fighters) {
    return fighters.filter((f) => f.isAlive() && !f.helperOf);
  }

  give(fighter) {
    this.holder = fighter;
    this.fuseMs = Phaser.Math.Between(FUSE_MS[0], FUSE_MS[1]);
    this.lastBeep = null;
    this.sprite.setVisible(true);
    popText(this.scene, fighter.x, fighter.y - 120, '💣 ¡Bomba!', '#ff9a3c', this.scene.world);
    sfx.pickup();
  }

  update(dtMs, fighters) {
    if (!this.holder) {
      this.sprite.setVisible(false);
      this.waitMs -= dtMs;
      const alive = this.candidates(fighters);
      if (this.waitMs <= 0 && alive.length >= 2) this.give(Phaser.Utils.Array.GetRandom(alive));
      return;
    }
    // Si el que la traía se cayó, la bomba se va con él y luego sale otra.
    if (!this.holder.isAlive()) {
      this.holder = null;
      this.passer = null;
      this.waitMs = NEXT_MS;
      return;
    }
    this.fuseMs -= dtMs;
    this.noReturnMs = Math.max(0, this.noReturnMs - dtMs);
    const f = this.holder;
    this.sprite.setPosition(f.x, f.y - f.radius - 52);
    // Entre menos falta, más rápido late y suena.
    const seconds = Math.ceil(this.fuseMs / 1000);
    this.count.setText(String(Math.max(0, seconds)));
    const urgent = this.fuseMs < BEEP_FROM_MS;
    this.sprite.setScale(1 + (urgent ? 0.18 : 0.06) * Math.sin(this.scene.time.now / (urgent ? 50 : 140)));
    this.spark.setAngle(this.scene.time.now / 3);
    if (urgent && seconds !== this.lastBeep) {
      this.lastBeep = seconds;
      sfx.countdown();
    }
    if (this.fuseMs <= 0) this.explode();
  }

  // Un golpe que sí pegó: si el que pegó trae la bomba, ahora la trae el otro.
  onHit(attacker, victim) {
    if (!this.holder || attacker !== this.holder || victim === attacker || victim.helperOf || !victim.isAlive()) return;
    if (victim === this.passer && this.noReturnMs > 0) return;
    this.passer = attacker;
    this.holder = victim;
    this.noReturnMs = NO_RETURN_MS;
    popText(this.scene, victim.x, victim.y - 110, '¡Te toca! 💣', '#ff9a3c', this.scene.world);
    sfx.throw();
  }

  explode() {
    const f = this.holder;
    const { scene } = this;
    this.holder = null;
    this.waitMs = NEXT_MS;
    this.exploded += 1;
    this.sprite.setVisible(false);
    burst(scene, f.x, f.y, 0xff9a3c, 20, scene.world);
    burst(scene, f.x, f.y, 0xffffff, 12, scene.world);
    popText(scene, f.x, f.y - 40, '¡BUM!', '#ff9a3c', scene.world);
    scene.cameras.main.shake(220, 0.01);
    sfx.boom();
    // Sale volando hacia el lado más cercano de la orilla (hacia afuera), aunque se esté cubriendo.
    f.shielding = false;
    const facing = f.x < (scene.stage.blast.left + scene.stage.blast.right) / 2 ? -1 : 1;
    const { dealt, speed } = f.takeHit({ facing, power: 1, x: f.x - facing * 10 }, HOT_HIT);
    if (this.passer && this.passer !== f) scene.noteHit(this.passer, f, dealt, speed);
    this.passer = null;
  }

  destroy() {
    this.sprite.destroy();
  }
}
