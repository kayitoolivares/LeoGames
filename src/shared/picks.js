// El personaje que escogió cada control, para que no tenga que escogerlo otra vez al cambiar de juego.
// Solo dura mientras la página esté abierta (de un día a otro los controles pueden cambiar de número).
const picks = new Map();

export const characterPicks = {
  get(deviceId, fallback) {
    return picks.get(deviceId) ?? fallback;
  },

  set(deviceId, character) {
    picks.set(deviceId, character);
  },
};
