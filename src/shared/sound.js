// Sonidos hechos con Web Audio (osciladores y ruido), sin archivos que descargar.
// El navegador no deja sonar nada hasta que alguien hace clic o aprieta una tecla en la página
// (los botones del control NO cuentan). En el Xbox: presionar A en modo cursor antes de pasar a
// "controles de juego" activa el sonido.
const VOLUME = 0.35;
let ctx = null;
let master = null;
let noiseBuffer = null;

function context() {
  if (ctx) return ctx;
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return null;
  ctx = new AudioCtx();
  master = ctx.createGain();
  master.gain.value = VOLUME;
  master.connect(ctx.destination);
  return ctx;
}

export function unlockAudio() {
  const c = context();
  if (c && c.state === 'suspended') c.resume();
}

export function audioReady() {
  return ctx?.state === 'running';
}

// Para la música (music.js), que usa el mismo contexto de audio pero su propio volumen.
export function audioContext() {
  return audioReady() ? ctx : null;
}

for (const type of ['pointerdown', 'keydown', 'touchend']) window.addEventListener(type, unlockAudio, { capture: true });

// Un tono que puede deslizarse de `freq` a `to` y se apaga solo.
function tone({ freq, to = freq, ms = 120, type = 'square', volume = 0.3, delay = 0 }) {
  if (!audioReady()) return;
  const start = ctx.currentTime + delay / 1000;
  const end = start + ms / 1000;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), end);
  gain.gain.setValueAtTime(volume, start);
  gain.gain.exponentialRampToValueAtTime(0.001, end);
  osc.connect(gain).connect(master);
  osc.start(start);
  osc.stop(end + 0.02);
}

// Ruido filtrado: golpes, explosiones, escudo que se rompe.
function noise({ ms = 200, volume = 0.4, filter = 1200, delay = 0 }) {
  if (!audioReady()) return;
  if (!noiseBuffer) {
    noiseBuffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
  }
  const start = ctx.currentTime + delay / 1000;
  const end = start + ms / 1000;
  const source = ctx.createBufferSource();
  const lowpass = ctx.createBiquadFilter();
  const gain = ctx.createGain();
  source.buffer = noiseBuffer;
  lowpass.type = 'lowpass';
  lowpass.frequency.setValueAtTime(filter, start);
  lowpass.frequency.exponentialRampToValueAtTime(Math.max(60, filter / 6), end);
  gain.gain.setValueAtTime(volume, start);
  gain.gain.exponentialRampToValueAtTime(0.001, end);
  source.connect(lowpass).connect(gain).connect(master);
  source.start(start);
  source.stop(end + 0.02);
}

function melody(notes, { ms = 120, gap = 80, type = 'square', volume = 0.12 } = {}) {
  notes.forEach((freq, i) => tone({ freq, ms, type, volume, delay: i * gap }));
}

// Escala pentatónica de Do: cualquier combinación de estas notas suena bonito (Modo Bebé).
const PENTATONIC = [262, 294, 330, 392, 440, 523, 587, 659, 784, 880, 1047];

export const sfx = {
  select: () => tone({ freq: 700, ms: 50, volume: 0.08 }),
  confirm: () => melody([600, 900], { ms: 90, gap: 70, volume: 0.1 }),
  back: () => melody([600, 400], { ms: 80, gap: 60, volume: 0.08 }),
  countdown: (go = false) => tone({ freq: go ? 880 : 440, ms: go ? 380 : 160, volume: 0.15 }),
  jump: () => tone({ freq: 380, to: 760, ms: 120, volume: 0.1 }),
  // `strength` de 0 a 1: los golpes fuertes suenan más graves y largos.
  hit: (strength = 0.5) => {
    noise({ ms: 90 + 140 * strength, volume: 0.25 + 0.3 * strength, filter: 2600 - 1400 * strength });
    tone({ freq: 220 - 90 * strength, to: 80, ms: 140, type: 'triangle', volume: 0.25 });
  },
  block: () => tone({ freq: 900, to: 1400, ms: 90, type: 'sine', volume: 0.2 }),
  shieldBreak: () => {
    noise({ ms: 300, volume: 0.3, filter: 3200 });
    tone({ freq: 1200, to: 250, ms: 450, type: 'sine', volume: 0.2 });
  },
  special: () => tone({ freq: 300, to: 900, ms: 220, type: 'sawtooth', volume: 0.1 }),
  throw: () => tone({ freq: 500, to: 250, ms: 150, type: 'triangle', volume: 0.15 }),
  pickup: () => melody([660, 990], { ms: 110, gap: 80, volume: 0.13 }),
  star: () => melody([523, 659, 784, 1047, 1319], { ms: 110, gap: 65, volume: 0.11 }),
  boom: () => {
    noise({ ms: 750, volume: 0.6, filter: 700 });
    tone({ freq: 130, to: 40, ms: 550, type: 'sine', volume: 0.4 });
  },
  ko: () => {
    noise({ ms: 600, volume: 0.45, filter: 900 });
    tone({ freq: 620, to: 90, ms: 650, type: 'sawtooth', volume: 0.18 });
  },
  win: () => melody([523, 659, 784, 659, 784, 1047], { ms: 170, gap: 150, volume: 0.13 }),
  // Bolitas Bros: especiales de los personajes nuevos y la transformación.
  laser: () => tone({ freq: 1600, to: 300, ms: 200, type: 'sawtooth', volume: 0.08 }),
  fire: () => noise({ ms: 480, volume: 0.22, filter: 1800 }),
  poof: () => {
    noise({ ms: 160, volume: 0.25, filter: 3000 });
    tone({ freq: 500, to: 1200, ms: 120, type: 'sine', volume: 0.1 });
  },
  ghost: () => tone({ freq: 520, to: 240, ms: 500, type: 'sine', volume: 0.15 }),
  meterFull: () => melody([880, 1175, 1760], { ms: 110, gap: 70, type: 'sine', volume: 0.12 }),
  transform: () => {
    noise({ ms: 600, volume: 0.25, filter: 5000 });
    melody([392, 523, 659, 784, 1047, 1319], { ms: 150, gap: 70, type: 'sawtooth', volume: 0.08 });
  },
  powerDown: () => tone({ freq: 700, to: 180, ms: 450, type: 'triangle', volume: 0.15 }),
  // Modo Bebé: sonidos suaves (triángulo y seno, nada chillón).
  note: (step) => {
    const freq = PENTATONIC[Math.min(Math.max(step, 0), PENTATONIC.length - 1)];
    tone({ freq, ms: 500, type: 'triangle', volume: 0.25 });
    tone({ freq: freq * 2, ms: 260, type: 'sine', volume: 0.06 });
  },
  boing: () => tone({ freq: 200, to: 620, ms: 240, type: 'sine', volume: 0.22 }),
  // Karts locos: moneda (dos notitas agudas), turbo (flechas del piso, mini turbo del derrape).
  coin: () => melody([988, 1319], { ms: 90, gap: 60, type: 'square', volume: 0.06 }),
  boost: () => {
    tone({ freq: 220, to: 900, ms: 320, type: 'sawtooth', volume: 0.07 });
    noise({ ms: 260, volume: 0.12, filter: 2400 });
  },
  // Bloquecito cambia de número: una nota que sube con el número (del 1 al 10).
  count: (n) => {
    const freq = PENTATONIC[Math.min(Math.max(n, 0), PENTATONIC.length - 1)];
    tone({ freq, ms: 140, type: 'square', volume: 0.07 });
    tone({ freq: freq * 2, ms: 100, type: 'sine', volume: 0.06, delay: 60 });
  },
  sparkle: () => melody([1047, 1319, 1568, 2093], { ms: 160, gap: 60, type: 'sine', volume: 0.09 }),
};

// Karts locos: el motor de un kart, un zumbido grave que sube con la velocidad (y más con turbo).
// Devuelve { update(speed, boosting), stop() }, o null si el sonido todavía no está activado.
export function createEngine() {
  if (!audioReady()) return null;
  const osc = ctx.createOscillator();
  osc.type = 'sawtooth';
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 520;
  const gain = ctx.createGain();
  gain.gain.value = 0;
  osc.connect(filter).connect(gain).connect(master);
  osc.start();
  return {
    update(speed, boosting = false) {
      const now = ctx.currentTime;
      osc.frequency.setTargetAtTime(50 + Math.abs(speed) * 3 * (boosting ? 1.25 : 1), now, 0.08);
      gain.gain.setTargetAtTime(Math.abs(speed) > 1 ? 0.03 : 0.012, now, 0.12);
    },
    stop() {
      gain.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
      setTimeout(() => {
        osc.stop();
        osc.disconnect();
      }, 300);
    },
  };
}
