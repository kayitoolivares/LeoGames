// Letreros que entran rebotando: el grande crece de chiquito, se pasa tantito de tamaño (chueco) y regresa; el de
// abajo sube un poquito. (Las escenas ya mataron los tweens viejos del letrero antes de llamarla.)
export function bounceIn(scene, banner, subBanner = null) {
  banner.setScale(0.15).setAngle(-9);
  scene.tweens.add({ targets: banner, alpha: 1, scale: 1.2, angle: 4, duration: 230, ease: 'Back.easeOut' });
  scene.tweens.add({ targets: banner, scale: 1, angle: 0, delay: 230, duration: 220, ease: 'Bounce.easeOut' });
  if (!subBanner) return;
  subBanner.baseY ??= subBanner.y;
  subBanner.y = subBanner.baseY + 26;
  scene.tweens.add({ targets: subBanner, y: subBanner.baseY, delay: 120, duration: 260, ease: 'Back.easeOut' });
}

// Un número o letrero que cambió (vidas, monedas, goles): crece y regresa.
export function bump(scene, target, scale = 1.3) {
  scene.tweens.killTweensOf(target);
  target.setScale(1);
  scene.tweens.add({ targets: target, scale, duration: 110, yoyo: true, ease: 'Quad.easeOut' });
}
