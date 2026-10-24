// Cambiar de pantalla con cortinilla (scenes/WipeScene.js): primero se tapa todo, luego cambia la escena y se
// destapa. Si la cortinilla no está, se cambia de una vez; si ya va a medio cambio, se ignora el segundo.
// Una pantalla que ya pidió irse no puede pedirlo otra vez mientras sigue viva (por ejemplo, la de unirse con A
// apretado: si no, se tapaba y cambiaba otra vez, y el menú se volvía a abrir).
export function go(from, key, data) {
  const wipe = from.scene.get('Wipe');
  if (!wipe?.sys.isActive()) {
    from.scene.start(key, data);
    return;
  }
  if (wipe.busy || wipe.leaving === from) return;
  wipe.leaving = from;
  from.sys.events.once('shutdown', () => {
    if (wipe.leaving === from) wipe.leaving = null;
  });
  wipe.cover(() => {
    if (from.sys.isActive() || from.sys.isPaused()) from.scene.start(key, data);
    else from.game.scene.start(key, data);
  });
}
