import Phaser from 'phaser';
import { sfx } from '../../shared/sound.js';
import { hexToCss } from '../../ui/style.js';
import { burst, popText } from '../brawl/effects.js';
import { comicHit, dustPuff, shockwave, speedLines } from '../duelo/fx.js';

// Cómo se ve un combo de dúo (ver duos.js), igual en Bolitas Bros y en el Duelo: un anillo grande del color del
// combo en medio de los dos compañeros, el letrero de "¡COMBO!" y, encima de cada rival que alcanza (`targets`:
// [{ x, y, top }], con `top` la altura de su cabeza), lo de cada tipo: vapor, rayos, polvo, estrellas que caen, un
// remolino, hielo o rayitas de velocidad. `layer`: el contenedor del mundo (Bolitas Bros) o null (el Duelo).
export function duoEffect(scene, duo, x, y, targets, layer = null) {
  const add = (object) => {
    layer?.add(object);
    return object;
  };
  shockwave(scene, x, y, duo.color, layer);
  burst(scene, x, y, duo.color, 14, layer);
  burst(scene, x, y, 0xffffff, 10, layer);
  comicHit(scene, x, y - 90, '¡COMBO!', { big: true, layer });
  sfx.transform();
  for (const t of targets) {
    if (duo.kind === 'dizzy' || duo.kind === 'freeze') {
      // Vapor (blanco) o hielo (azulito): nubecitas que crecen y se deshacen.
      for (let i = 0; i < 6; i += 1) {
        const puff = add(scene.add.circle(t.x + Phaser.Math.Between(-50, 50), t.y - Phaser.Math.Between(0, 80), 22, duo.color, 0.8).setDepth(9000));
        scene.tweens.add({ targets: puff, scale: 2.4, alpha: 0, y: puff.y - 40, delay: i * 60, duration: 700, onComplete: () => puff.destroy() });
      }
      if (duo.kind === 'freeze') {
        const ice = add(
          scene.add
            .rectangle(t.x, t.y - 10, 110, 130, 0x9fdcff, 0.45)
            .setStrokeStyle(5, 0xffffff)
            .setDepth(9000),
        );
        scene.tweens.add({ targets: ice, alpha: 0, delay: 1300, duration: 400, onComplete: () => ice.destroy() });
      }
      popText(scene, t.x, t.top - 30, duo.kind === 'freeze' ? '¡Congelado!' : '¡Mareado!', hexToCss(duo.color), layer);
    } else if (duo.kind === 'shock') {
      // Un rayo en zigzag que baja del cielo.
      const bolt = add(scene.add.graphics().setDepth(9000));
      bolt.lineStyle(10, 0xfff36a, 1);
      bolt.beginPath();
      bolt.moveTo(t.x, t.top - 420);
      for (let k = 1; k <= 6; k += 1) bolt.lineTo(t.x + (k % 2 ? 28 : -28), t.top - 420 + k * 70);
      bolt.lineTo(t.x, t.y);
      bolt.strokePath();
      scene.tweens.add({ targets: bolt, alpha: 0, delay: 250, duration: 300, onComplete: () => bolt.destroy() });
      sfx.laser();
    } else if (duo.kind === 'quake') {
      dustPuff(scene, t.x, t.y + 30, 0, 7, layer, 9000);
    } else if (duo.kind === 'stars') {
      for (let i = 0; i < 3; i += 1) {
        const star = add(
          scene.add
            .star(t.x + (i - 1) * 40, t.top - 400, 5, 12, 28, 0xffd84d)
            .setStrokeStyle(4, 0x1b1530)
            .setDepth(9000),
        );
        scene.tweens.add({ targets: star, y: t.y - 20, angle: 360, delay: i * 90, duration: 380, ease: 'Quad.easeIn', onComplete: () => star.destroy() });
      }
    } else if (duo.kind === 'whirl') {
      for (let i = 0; i < 5; i += 1) {
        const ring = add(
          scene.add
            .ellipse(t.x, t.y - i * 34, 120 - i * 14, 30, 0xff9a3c, 0.7)
            .setStrokeStyle(4, 0xffd84d)
            .setDepth(9000),
        );
        scene.tweens.add({ targets: ring, scaleX: 0.3, alpha: 0, y: ring.y - 120, duration: 700, delay: i * 40, onComplete: () => ring.destroy() });
      }
    } else if (duo.kind === 'flurry') {
      speedLines(scene, t.x, t.y - 40, 10, 30, 130, layer, duo.color);
    }
  }
  if (duo.kind === 'quake') {
    scene.cameras.main.shake(400, 0.016);
    sfx.boom();
  }
}
