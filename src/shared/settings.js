// Preferencias que se guardan en cada dispositivo (música, voz, premios...).
// Si el navegador no deja guardar (modo privado, Xbox sin almacenamiento), se recuerdan solo mientras
// la página esté abierta.
const PREFIX = 'leogames:';
const memory = new Map();

export const settings = {
  get(key, fallback) {
    if (memory.has(key)) return memory.get(key);
    try {
      const raw = window.localStorage.getItem(PREFIX + key);
      if (raw !== null) {
        const value = JSON.parse(raw);
        memory.set(key, value);
        return value;
      }
    } catch {
      // Sin almacenamiento: se queda el valor por defecto.
    }
    return fallback;
  },

  set(key, value) {
    memory.set(key, value);
    try {
      window.localStorage.setItem(PREFIX + key, JSON.stringify(value));
    } catch {
      // Sin almacenamiento: solo vive en memoria.
    }
  },
};
