// Calcomanías (premios) que se ganan jugando, guardadas en cada dispositivo (settings.js).
// Al ganar una sale un aviso arriba de la pantalla (HTML, así se ve igual sobre Phaser y sobre el 3D),
// con sonido y voz. Algunas desbloquean cosas (ver `unlocks`).
import { settings } from './settings.js';
import { sfx } from './sound.js';
import { say } from './voice.js';

export const STICKERS = [
  { id: 'unirse', emoji: '👋', name: '¡Hola!', hint: 'Únete con tu control' },
  { id: 'todos', emoji: '🌈', name: 'Juegan todos', hint: 'Jueguen 4 al mismo tiempo' },
  { id: 'pelea-ronda', emoji: '👊', name: 'Primer golpe', hint: 'Pasa la primera ronda de Pelea en equipo' },
  { id: 'pelea-gana', emoji: '👑', name: 'Adiós Rey Slime', hint: 'Gana el primer mundo de Pelea en equipo' },
  { id: 'pelea-hongos', emoji: '🍄', name: 'Bosque limpio', hint: 'Gana el mundo del bosque en Pelea en equipo' },
  { id: 'pelea-volcan', emoji: '🌋', name: 'Héroes del volcán', hint: 'Gana el mundo del volcán en Pelea en equipo' },
  { id: 'smash-gana', emoji: '🥊', name: 'Campeón Bolitas', hint: 'Gana una pelea en Bolitas Bros' },
  { id: 'smash-super', emoji: '⚡', name: '¡Súper!', hint: 'Transfórmate en Bolitas Bros' },
  { id: 'smash-bomba', emoji: '💣', name: 'Bombazo', hint: 'Lanza una bomba en Bolitas Bros' },
  { id: 'kart-gana', emoji: '🏁', name: 'Primer lugar', hint: 'Gana una carrera de Karts locos' },
  { id: 'kart-poder', emoji: '🚀', name: '¡Le diste!', hint: 'Pégale a alguien con un poder en Karts locos' },
  { id: 'kart-copa', emoji: '🏅', name: 'Copa de karts', hint: 'Gana una copa del Gran Premio en Karts locos' },
  { id: 'kart-batalla', emoji: '🎈', name: 'Campeón de globos', hint: 'Gana una batalla de globos en Karts locos' },
  { id: 'carrera-gana', emoji: '🏎️', name: 'Piloto veloz', hint: 'Gana una carrera vista desde arriba' },
  { id: 'futbol-gol', emoji: '⚽', name: '¡Gol!', hint: 'Mete un gol en Fútbol de bolitas' },
  { id: 'futbol-gana', emoji: '🏆', name: 'Campeones', hint: 'Gana un partido de Fútbol de bolitas' },
  { id: 'duelo-gana', emoji: '🥋', name: 'Campeón del duelo', hint: 'Gana un Duelo de bolitas' },
  { id: 'duelo-perfecto', emoji: '💯', name: '¡Perfecto!', hint: 'Gana un round del duelo sin que te peguen' },
  { id: 'duelo-super', emoji: '🔥', name: 'Súper peleador', hint: 'Transfórmate en el Duelo de bolitas' },
  { id: 'bebe', emoji: '👶', name: 'Hora del bebé', hint: 'Jueguen el Modo Bebé' },
  { id: 'bloquecito-10', emoji: '🔟', name: 'Hasta el 10', hint: 'Cuenta del 1 al 10 con Bloquecito (Y sube de número)' },
  { id: 'coleccion', emoji: '⭐', name: 'Coleccionista', hint: 'Consigue 10 calcomanías' },
];

// Lo que se desbloquea con cada calcomanía (los juegos preguntan con `rewards.unlocked()`).
export const UNLOCKS = {
  'smash-espacio': { sticker: 'smash-gana', label: 'Gana una pelea en Bolitas Bros' },
  'smash-volcan': { sticker: 'smash-super', label: 'Transfórmate en súper en Bolitas Bros' },
  'kart-nieve': { sticker: 'kart-gana', label: 'Gana una carrera de Karts locos' },
  'kart-castillo': { sticker: 'kart-poder', label: 'Pégale a alguien con un poder' },
  'kart-espacio': { sticker: 'kart-copa', label: 'Gana una copa del Gran Premio' },
  'pelea-mundo-2': { sticker: 'pelea-gana', label: 'Gana el primer mundo' },
  'pelea-mundo-3': { sticker: 'pelea-hongos', label: 'Gana el mundo del bosque' },
};

const COLLECTOR_AT = 10;
const TOAST_MS = 3200;

const STYLE = `
.reward-toast { position: fixed; top: 16px; left: 50%; z-index: 70; transform: translate(-50%, -140%);
  transition: transform 0.35s ease-out; display: flex; align-items: center; gap: 14px; padding: 10px 22px 10px 14px;
  border-radius: 18px; background: #231d45; border: 4px solid #ffc93c; color: #fff; box-shadow: 0 6px 0 rgba(0,0,0,0.35);
  font-family: "Segoe UI", Arial, sans-serif; pointer-events: none; }
.reward-toast.on { transform: translate(-50%, 0); }
.reward-toast .emoji { font-size: 44px; }
.reward-toast small { display: block; color: #ffc93c; font-size: 15px; font-weight: 700; }
.reward-toast b { font-size: 24px; }
`;

let toast = null;
const queue = [];

function showNext() {
  if (!toast) {
    const style = document.createElement('style');
    style.textContent = STYLE;
    document.head.append(style);
    toast = document.createElement('div');
    toast.className = 'reward-toast';
    document.body.append(toast);
  }
  if (toast.classList.contains('on') || queue.length === 0) return;
  const sticker = queue.shift();
  toast.innerHTML = `<span class="emoji">${sticker.emoji}</span><div><small>¡Nueva calcomanía!</small><b>${sticker.name}</b></div>`;
  toast.classList.add('on');
  sfx.star();
  say(`¡Nueva calcomanía! ${sticker.name}`, { interrupt: false });
  setTimeout(() => {
    toast.classList.remove('on');
    setTimeout(showNext, 450);
  }, TOAST_MS);
}

function earned() {
  return new Set(settings.get('stickers', []));
}

export const rewards = {
  has(id) {
    return earned().has(id);
  },

  count() {
    return earned().size;
  },

  // Da la calcomanía si no la tenía (y avisa). Devuelve true si es nueva.
  earn(id) {
    const have = earned();
    const sticker = STICKERS.find((s) => s.id === id);
    if (!sticker || have.has(id)) return false;
    have.add(id);
    settings.set('stickers', [...have]);
    queue.push(sticker);
    showNext();
    if (have.size >= COLLECTOR_AT) this.earn('coleccion');
    return true;
  },

  unlocked(key) {
    const unlock = UNLOCKS[key];
    return !unlock || this.has(unlock.sticker);
  },
};
