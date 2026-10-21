import { sfx } from '../../shared/sound.js';
import { say } from '../../shared/voice.js';
import { textStyle } from '../../ui/style.js';
import { burst } from '../brawl/effects.js';
import { FINAL_NAMES } from '../duelo/final.js';
import { comicHit, shockwave } from '../duelo/fx.js';
import { characterTexture } from './art.js';

// El golpe final de Bolitas Bros (el que rompió la bola súper, con B): todo se detiene, cruza la pantalla una franja
// con el personaje y el nombre de su golpe, y luego un golpazo a todos los rivales que estén en el escenario.
const CUT_IN_MS = 1200;
const END_MS = 1700;
export const FINAL_HIT = { damage: 28, base: 700, scale: 12, angle: 55 };

export class SmashFinal {
  // `ui`: el contenedor de la pantalla (sin zoom); `world`: el del escenario; `victims`: los rivales a los que les pega.
  constructor(scene, attacker, victims, { ui, world }) {
    this.scene = scene;
    this.attacker = attacker;
    this.victims = victims;
    this.world = world;
    this.t = 0;
    this.done = false;
    this.name = FINAL_NAMES[attacker.characterKey] ?? 'Golpe final';
    const { width, height } = scene.scale;
    this.layer = scene.add.container(0, 0);
    ui.add(this.layer);
    const shade = scene.add.rectangle(width / 2, height / 2, width, height, 0x0b0820, 0.65);
    const band = scene.add.container(-width, height * 0.45).setAngle(-6);
    band.add(scene.add.rectangle(width / 2, 0, width * 1.4, 250, attacker.color).setStrokeStyle(10, 0xffffff));
    const key = attacker.image ? characterTexture(scene, attacker.characterKey, 'entrada') : null;
    if (key) {
      const portrait = scene.add.image(260, 10, key);
      portrait.setScale(300 / portrait.height);
      band.add(portrait);
    }
    const style = { fontStyle: 'bold', stroke: '#1b1530', strokeThickness: 10 };
    band.add(scene.add.text(key ? 760 : width / 2, -38, '¡GOLPE FINAL!', textStyle(78, '#ffd84d', style)).setOrigin(0.5));
    band.add(scene.add.text(key ? 760 : width / 2, 46, this.name, textStyle(44, '#ffffff', { ...style, strokeThickness: 8 })).setOrigin(0.5));
    this.layer.add([shade, band]);
    scene.tweens.add({ targets: band, x: 0, duration: 260, ease: 'Back.easeOut' });
    scene.cameras.main.flash(160, 255, 255, 255);
    sfx.transform();
    say(`¡${this.name}!`);
  }

  // Devuelve true cuando termina (la escena sigue con la pelea).
  update(dtMs) {
    const before = this.t;
    this.t += dtMs;
    if (before < CUT_IN_MS && this.t >= CUT_IN_MS) this.strike();
    if (this.t < END_MS) return false;
    this.layer.destroy();
    return true;
  }

  strike() {
    const { scene, attacker, world } = this;
    this.layer.setAlpha(0);
    scene.cameras.main.flash(250, 255, 240, 200);
    scene.cameras.main.shake(350, 0.018);
    sfx.boom();
    shockwave(scene, attacker.x, attacker.y, attacker.color, world);
    for (const victim of this.victims) {
      // No se puede cubrir.
      victim.shielding = false;
      const away = Math.sign(victim.x - attacker.x) || attacker.facing;
      const { dealt } = victim.takeHit({ facing: away, power: 1, x: attacker.x }, FINAL_HIT);
      scene.noteHit?.(attacker, victim, dealt, 9999);
      burst(scene, victim.x, victim.y, 0xffd84d, 16, world);
      comicHit(scene, victim.x, victim.y - 60, '¡GOLPE FINAL!', { big: true, red: true, layer: world });
    }
  }
}
