import { setTimeScale } from '../shared/clock.js';

// Un momento épico (el golpe final, el gol, vencer al jefe, llegar a la meta): el juego va en cámara lenta, la
// cámara se acerca a (x, y) y el marcador (`hide`) se esconde un ratito, porque con el acercamiento se vería
// gigante. Luego todo regresa como estaba. Con `pan: false` solo se acerca al centro (para los juegos cuya cámara
// sigue a los jugadores). `bounds` ({ x, y, width, height }): lo que se puede ver (para no enseñar lo que hay
// afuera de la cancha o del nivel).
const IN_MS = 220;
const OUT_MS = 320;

export function epicMoment(scene, x, y, { zoom = 1.35, ms = 1200, slow = 0.3, hide = [], pan = true, bounds = null } = {}) {
  const cam = scene.cameras.main;
  if (scene.epicBusy) return;
  scene.epicBusy = true;
  setTimeScale(slow, ms);
  const hidden = hide.filter(Boolean);
  for (const object of hidden) scene.tweens.add({ targets: object, alpha: 0, duration: 120 });
  const start = { zoom: cam.zoom, x: cam.scrollX, y: cam.scrollY };
  if (bounds) {
    // (Con el acercamiento se ve un pedazo de ancho/zoom: que no se salga.)
    const halfW = cam.width / zoom / 2;
    const halfH = cam.height / zoom / 2;
    x = Math.min(Math.max(x, bounds.x + halfW), bounds.x + bounds.width - halfW);
    y = Math.min(Math.max(y, bounds.y + halfH), bounds.y + bounds.height - halfH);
  }
  const target = { x: x - cam.width / 2, y: y - cam.height / 2 };
  const move = (k, from, to) => {
    cam.setZoom(from.zoom + (to.zoom - from.zoom) * k);
    if (pan) cam.setScroll(from.x + (to.x - from.x) * k, from.y + (to.y - from.y) * k);
  };
  const close = { zoom, ...(pan ? target : start) };
  scene.tweens.addCounter({ from: 0, to: 1, duration: IN_MS, ease: 'Quad.easeOut', onUpdate: (tween) => move(tween.getValue(), start, close) });
  const finish = () => {
    cam.setZoom(start.zoom);
    if (pan) cam.setScroll(start.x, start.y);
    for (const object of hidden) object.setAlpha(1);
    scene.epicBusy = false;
  };
  scene.time.delayedCall(ms, () => {
    scene.tweens.addCounter({
      from: 0,
      to: 1,
      duration: OUT_MS,
      ease: 'Quad.easeInOut',
      onUpdate: (tween) => move(tween.getValue(), close, start),
      onComplete: () => {
        for (const object of hidden) scene.tweens.add({ targets: object, alpha: 1, duration: 150 });
        scene.epicBusy = false;
      },
    });
  });
  // (Si la pantalla se cierra a medio momento, la cámara regresa como estaba.)
  scene.sys.events.once('shutdown', finish);
}
