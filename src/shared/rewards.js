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
  { id: 'pelea-playa', emoji: '🐙', name: 'Adiós Capitán Pulpo', hint: 'Gana el mundo de la playa en Pelea en equipo' },
  { id: 'pelea-nieve', emoji: '❄️', name: 'Adiós Gran Yeti', hint: 'Gana el mundo de la nieve en Pelea en equipo' },
  { id: 'pelea-castillo', emoji: '🎃', name: 'Adiós Rey Calabaza', hint: 'Gana el castillo embrujado en Pelea en equipo' },
  { id: 'pelea-equipo', emoji: '🤜', name: 'Golpe en equipo', hint: 'Usen la súper de dos o más al mismo tiempo en Pelea en equipo' },
  { id: 'pelea-sinfin', emoji: '♾️', name: 'Aguantadores', hint: 'Pasen 10 rondas en el modo sin fin de Pelea en equipo' },
  { id: 'pelea-dulces', emoji: '🍭', name: 'Adiós Rey Pastel', hint: 'Gana Dulcelandia en Pelea en equipo' },
  { id: 'pelea-espacio', emoji: '🚀', name: 'Adiós Mega Robot', hint: 'Gana el mundo del espacio en Pelea en equipo' },
  { id: 'pelea-jefes', emoji: '🏆', name: 'Jefes en serie', hint: 'Venzan a todos los jefes seguidos en Pelea en equipo' },
  { id: 'pelea-rescate', emoji: '🔓', name: 'Al rescate', hint: 'Rompe una jaula y rescata a un amigo en Pelea en equipo' },
  { id: 'pelea-combo', emoji: '🔥', name: 'Combo de 20', hint: 'Hagan un combo de 20 golpes en equipo en Pelea en equipo' },
  { id: 'pelea-montar', emoji: '🦖', name: 'Jinete', hint: 'Súbete a un dinosaurio o a un pollo gigante en Pelea en equipo' },
  { id: 'plat-bandera', emoji: '🚩', name: 'Primera bandera', hint: 'Pasa un nivel de Súper Bolitas' },
  { id: 'plat-mundo-1', emoji: '🍄', name: 'Adiós Rey Hongo', hint: 'Gana el mundo de la pradera en Súper Bolitas' },
  { id: 'plat-mundo-2', emoji: '☁️', name: 'Adiós Rey Nube', hint: 'Gana el mundo de las nubes en Súper Bolitas' },
  { id: 'plat-mundo-3', emoji: '🦀', name: 'Adiós Rey Cangrejo', hint: 'Gana el mundo del agua en Súper Bolitas' },
  { id: 'plat-mundo-4', emoji: '🐉', name: 'Adiós Rey Dragón', hint: 'Gana el castillo de lava en Súper Bolitas' },
  { id: 'plat-secreto', emoji: '🔑', name: 'Tubo secreto', hint: 'Encuentra un cuarto secreto en Súper Bolitas' },
  { id: 'plat-monedas', emoji: '🔵', name: 'Las tres grandes', hint: 'Junta las 3 monedas grandes de un nivel de Súper Bolitas' },
  { id: 'plat-dino', emoji: '🥚', name: 'Arre, dinosaurio', hint: 'Súbete al dinosaurio en Súper Bolitas' },
  { id: 'plat-estrella', emoji: '🌟', name: 'Invencible', hint: 'Agarra la estrella en Súper Bolitas' },
  { id: 'plat-mundo-5', emoji: '❄️', name: 'Adiós Rey Yeti', hint: 'Gana las montañas de nieve en Súper Bolitas' },
  { id: 'plat-mundo-6', emoji: '🍰', name: 'Adiós Rey Pastel', hint: 'Gana Dulcelandia en Súper Bolitas' },
  { id: 'plat-mundo-7', emoji: '🎃', name: 'Adiós Rey Calabaza', hint: 'Gana la casa embrujada en Súper Bolitas' },
  { id: 'plat-secreta', emoji: '🏁', name: 'Bandera secreta', hint: 'Encuentra una bandera azul escondida en Súper Bolitas' },
  { id: 'plat-capa', emoji: '🪶', name: 'A volar', hint: 'Agarra la pluma y planea con la capa en Súper Bolitas' },
  { id: 'plat-hielo', emoji: '🧊', name: 'Congelado', hint: 'Congela a un enemigo con la flor de hielo en Súper Bolitas' },
  { id: 'plat-gigante', emoji: '🍄', name: 'Gigantote', hint: 'Hazte gigante con el hongo gigante en Súper Bolitas' },
  { id: 'plat-casita', emoji: '🎁', name: 'Regalo sorpresa', hint: 'Abre un regalo en una casita de hongo de Súper Bolitas' },
  { id: 'plat-mapa', emoji: '⚔️', name: 'Camino libre', hint: 'Gana una batalla contra un enemigo del mapa en Súper Bolitas' },
  { id: 'plat-batalla', emoji: '🪙', name: 'Rey de las monedas', hint: 'Juega una batalla de monedas en Súper Bolitas' },
  { id: 'plat-jefes', emoji: '👑', name: 'Todos los jefes', hint: 'Gana los jefes en serie en Súper Bolitas' },
  { id: 'plat-fantasma', emoji: '👻', name: 'Más rápido que tu fantasma', hint: 'Gánale a tu fantasma en la contrarreloj de Súper Bolitas' },
  { id: 'smash-gana', emoji: '🥊', name: 'Campeón Bolitas', hint: 'Gana una pelea en Bolitas Bros' },
  { id: 'smash-super', emoji: '⚡', name: '¡Súper!', hint: 'Transfórmate en Bolitas Bros' },
  { id: 'smash-bomba', emoji: '💣', name: 'Bombazo', hint: 'Lanza una bomba en Bolitas Bros' },
  { id: 'smash-final', emoji: '🌈', name: 'Bola súper', hint: 'Rompe la bola súper y usa el golpe final en Bolitas Bros' },
  { id: 'smash-jefe', emoji: '👑', name: 'Adiós Rey Bolón', hint: 'Gánale al jefe gigante en Bolitas Bros' },
  { id: 'smash-blancos', emoji: '🎯', name: 'Puntería', hint: 'Rompe las 10 dianas en Bolitas Bros' },
  { id: 'smash-cargado', emoji: '💪', name: 'Golpe cargado', hint: 'Pega con un golpe cargado al máximo en Bolitas Bros (mantén X)' },
  { id: 'smash-parada', emoji: '✨', name: 'Escudo perfecto', hint: 'En Bolitas Bros, cúbrete justo cuando te van a pegar' },
  { id: 'smash-jonron', emoji: '⚾', name: '¡Jonrón!', hint: 'Manda el saco a más de 100 m en el Concurso de jonrón de Bolitas Bros' },
  { id: 'smash-monedas', emoji: '💰', name: 'Monedero lleno', hint: 'Gana el modo Monedas de Bolitas Bros' },
  { id: 'smash-colina', emoji: '⛰️', name: 'Rey de la colina', hint: 'Gana el modo Rey de la colina de Bolitas Bros' },
  { id: 'smash-aventura', emoji: '🗺️', name: 'Aventurero', hint: 'Termina la Aventura de Bolitas Bros' },
  { id: 'kart-gana', emoji: '🏁', name: 'Primer lugar', hint: 'Gana una carrera de Karts locos' },
  { id: 'kart-poder', emoji: '🚀', name: '¡Le diste!', hint: 'Pégale a alguien con un poder en Karts locos' },
  { id: 'kart-copa', emoji: '🏅', name: 'Copa de karts', hint: 'Gana una copa del Gran Premio en Karts locos' },
  { id: 'kart-batalla', emoji: '🎈', name: 'Campeón de globos', hint: 'Gana una batalla de globos en Karts locos' },
  { id: 'kart-atajo', emoji: '🤫', name: 'Atajo secreto', hint: 'Encuentra un atajo secreto en Karts locos (busca el letrero)' },
  { id: 'kart-record', emoji: '⏱️', name: 'Récord', hint: 'Haz un récord en el Contrarreloj de Karts locos' },
  { id: 'kart-estrella', emoji: '🌟', name: 'Estrella', hint: 'Tumba a alguien con la estrella en Karts locos' },
  { id: 'carrera-gana', emoji: '🏎️', name: 'Piloto veloz', hint: 'Gana una carrera vista desde arriba' },
  { id: 'futbol-gol', emoji: '⚽', name: '¡Gol!', hint: 'Mete un gol en Fútbol de bolitas' },
  { id: 'futbol-gana', emoji: '🏆', name: 'Campeones', hint: 'Gana un partido de Fútbol de bolitas' },
  { id: 'futbol-copa', emoji: '🥇', name: 'Copa de fútbol', hint: 'Gana los 3 partidos de la Copa en Fútbol de bolitas' },
  { id: 'futbol-penales', emoji: '🧤', name: 'Rey de los penales', hint: 'Gana una tanda de penales en Fútbol de bolitas' },
  { id: 'futbol-especial', emoji: '☄️', name: 'Tiro especial', hint: 'Mete gol con tu tiro especial en Fútbol (barra llena + LB + RB)' },
  { id: 'duelo-gana', emoji: '🥋', name: 'Campeón del duelo', hint: 'Gana un Duelo de bolitas' },
  { id: 'duelo-perfecto', emoji: '💯', name: '¡Perfecto!', hint: 'Gana un round del duelo sin que te peguen' },
  { id: 'duelo-super', emoji: '🔥', name: 'Súper peleador', hint: 'Transfórmate en el Duelo de bolitas' },
  { id: 'duelo-final', emoji: '💥', name: 'Golpe final', hint: 'Usa el golpe final en el Duelo (súper forma + X)' },
  { id: 'duelo-torneo', emoji: '🏆', name: 'Campeón del torneo', hint: 'Gánale al Rey Bolón en el Torneo del Duelo' },
  { id: 'duelo-aguante', emoji: '🛡️', name: 'Aguante', hint: 'Gana 5 peleas seguidas en Supervivencia del Duelo' },
  { id: 'duelo-parada', emoji: '✋', name: 'Parada perfecta', hint: 'En el Duelo, cúbrete justo cuando te van a pegar' },
  { id: 'duelo-ayudante', emoji: '🤝', name: 'Ayudante', hint: 'Pégale al rival con tu ayudante (Y) en el Duelo' },
  { id: 'duelo-escuela', emoji: '🎓', name: 'Graduado', hint: 'Termina la Escuela de peleas del Duelo' },
  { id: 'duelo-reto', emoji: '🎖️', name: 'Primer reto', hint: 'Cumple un reto del Duelo' },
  { id: 'duelo-retos', emoji: '🏅', name: 'Todos los retos', hint: 'Cumple los 10 retos del Duelo' },
  { id: 'duelo-familiar', emoji: '👨‍👩‍👧', name: 'Campeón de la familia', hint: 'Gana el Torneo familiar del Duelo' },
  { id: 'duelo-jefes', emoji: '👹', name: 'Cazajefes', hint: 'Vence a Dragonzote, Robotote y el Rey Bolón seguidos' },
  { id: 'bebe', emoji: '👶', name: 'Hora del bebé', hint: 'Jueguen el Modo Bebé' },
  { id: 'bloquecito-10', emoji: '🔟', name: 'Hasta el 10', hint: 'Cuenta del 1 al 10 con Bloquecito (Y sube de número)' },
  { id: 'coleccion', emoji: '⭐', name: 'Coleccionista', hint: 'Consigue 10 calcomanías' },
];

// Lo que se desbloquea con cada calcomanía (los juegos preguntan con `rewards.unlocked()`).
export const UNLOCKS = {
  'smash-espacio': { sticker: 'smash-gana', label: 'Gana una pelea en Bolitas Bros' },
  'smash-volcan': { sticker: 'smash-super', label: 'Transfórmate en súper en Bolitas Bros' },
  'smash-rey': { sticker: 'smash-jefe', label: 'Gana el modo Jefe' },
  'smash-dragonzote': { sticker: 'smash-aventura', label: 'Termina la Aventura' },
  'smash-robotote': { sticker: 'smash-jonron', label: 'Jonrón de más de 100 m' },
  'kart-nieve': { sticker: 'kart-gana', label: 'Gana una carrera de Karts locos' },
  'kart-castillo': { sticker: 'kart-poder', label: 'Pégale a alguien con un poder' },
  'kart-espacio': { sticker: 'kart-copa', label: 'Gana una copa del Gran Premio' },
  'kart-espejo': { sticker: 'kart-copa', label: 'Gana una copa del Gran Premio' },
  'pelea-mundo-2': { sticker: 'pelea-gana', label: 'Gana el primer mundo' },
  'pelea-mundo-3': { sticker: 'pelea-hongos', label: 'Gana el mundo del bosque' },
  'pelea-mundo-4': { sticker: 'pelea-volcan', label: 'Gana el mundo del volcán' },
  'pelea-mundo-5': { sticker: 'pelea-playa', label: 'Gana el mundo de la playa' },
  'pelea-mundo-6': { sticker: 'pelea-nieve', label: 'Gana el mundo de la nieve' },
  'pelea-mundo-7': { sticker: 'pelea-castillo', label: 'Gana el castillo embrujado' },
  'pelea-mundo-8': { sticker: 'pelea-dulces', label: 'Gana Dulcelandia' },
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
