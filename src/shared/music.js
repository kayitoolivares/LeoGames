// Música de fondo hecha con Web Audio: canciones cortas que se repiten (melodía, bajo y batería),
// sin archivos que descargar. main.js pone la canción de cada escena; si ya está sonando la misma
// (por ejemplo al pedir revancha), sigue sin cortarse.
import { audioContext } from './sound.js';
import { settings } from './settings.js';

const VOLUME = 0.5;
const LOOKAHEAD_MS = 30;
const SCHEDULE_AHEAD_S = 0.15;

// Cada pista es una lista de pasos (corcheas) separados por espacios: una nota ("E5", "F#3", "Bb4"),
// "-" para alargar la anterior o "." para silencio. Los "|" solo separan compases para leerlo mejor.
// En la batería: k = bombo, s = tarola, h = platillo.
const SONGS = {
  menu: {
    bpm: 112,
    lead: { wave: 'square', volume: 0.045, notes: 'E5 G5 C6 G5 E5 G5 C6 - | A5 C6 E6 C6 A5 C6 E6 - | F5 A5 C6 A5 F5 A5 C6 - | G5 B5 D6 B5 G5 B5 D6 -' },
    bass: { wave: 'triangle', volume: 0.12, notes: 'C3 - C3 - G2 - C3 - | A2 - A2 - E2 - A2 - | F2 - F2 - C3 - F2 - | G2 - G2 - D3 - G2 -' },
    drums: 'k . h . s . h . | k . h . s . h . | k . h . s . h . | k . h . s h s h',
  },
  brawl: {
    bpm: 132,
    lead: { wave: 'square', volume: 0.045, notes: 'A4 . C5 E5 A5 . G5 E5 | F4 . A4 C5 F5 . E5 C5 | G4 . B4 D5 G5 . F5 D5 | E5 . G#4 B4 E5 - - .' },
    bass: { wave: 'triangle', volume: 0.13, notes: 'A2 A2 . A2 A2 . A2 . | F2 F2 . F2 F2 . F2 . | G2 G2 . G2 G2 . G2 . | E2 E2 . E2 E2 . E2 .' },
    drums: 'k . s . k k s . | k . s . k k s . | k . s . k k s . | k . s . k s s s',
  },
  // Cuando llega un jefe (Pelea en equipo): más rápida y en menor.
  jefe: {
    bpm: 150,
    lead: { wave: 'sawtooth', volume: 0.035, notes: 'E5 . E5 G5 . E5 D5 . | C5 . C5 E5 . C5 B4 . | A4 . A4 C5 . A4 B4 . | E5 . D#5 E5 F#5 G5 B5 .' },
    bass: { wave: 'triangle', volume: 0.14, notes: 'E2 E2 E3 E2 E2 E3 E2 E3 | C2 C2 C3 C2 C2 C3 C2 C3 | A1 A1 A2 A1 A1 A2 A1 A2 | B1 B1 B2 B1 B1 B2 B1 B2' },
    drums: 'k h s h k k s h | k h s h k k s h | k h s h k k s h | k s k s s s s s',
  },
  smash: {
    bpm: 140,
    lead: { wave: 'square', volume: 0.04, notes: 'D5 F5 A5 D6 C6 A5 F5 A5 | Bb4 D5 F5 Bb5 A5 F5 D5 F5 | C5 E5 G5 C6 Bb5 G5 E5 G5 | A4 C#5 E5 A5 - E5 C#5 E5' },
    bass: { wave: 'triangle', volume: 0.13, notes: 'D3 . D3 D3 . D3 D3 . | Bb2 . Bb2 Bb2 . Bb2 Bb2 . | C3 . C3 C3 . C3 C3 . | A2 . A2 A2 . A2 A2 .' },
    drums: 'k h s h k k s h | k h s h k k s h | k h s h k k s h | k h s h k s s s',
  },
  race: {
    bpm: 150,
    lead: { wave: 'square', volume: 0.04, notes: 'E5 . E5 G5 . E5 B4 . | C5 . C5 E5 . C5 G4 . | D5 . D5 F#5 . D5 A4 . | B4 . B4 D#5 . F#5 B5 .' },
    bass: { wave: 'triangle', volume: 0.12, notes: 'E2 E3 E2 E3 E2 E3 E2 E3 | C2 C3 C2 C3 C2 C3 C2 C3 | D2 D3 D2 D3 D2 D3 D2 D3 | B1 B2 B1 B2 B1 B2 B1 B2' },
    drums: 'k h k h s h k h | k h k h s h k h | k h k h s h k h | k h k h s s s s',
  },
  futbol: {
    bpm: 124,
    lead: { wave: 'square', volume: 0.045, notes: 'G5 . G5 E5 C5 . E5 G5 | A5 . A5 F5 C5 . F5 A5 | G5 . G5 E5 C5 . E5 G5 | D5 E5 F5 G5 A5 B5 C6 .' },
    bass: { wave: 'triangle', volume: 0.12, notes: 'C3 . G2 . C3 . G2 . | F2 . C3 . F2 . C3 . | C3 . G2 . C3 . G2 . | G2 . G2 . G2 . G2 .' },
    drums: 'k . s k k . s . | k . s k k . s . | k . s k k . s . | k s k s k s s s',
  },
  duelo: {
    bpm: 152,
    lead: { wave: 'square', volume: 0.04, notes: 'E5 . B4 E5 G5 . F#5 E5 | D5 . A4 D5 F#5 . E5 D5 | C5 . G4 C5 E5 . D5 C5 | B4 . D#5 F#5 B5 - - .' },
    bass: { wave: 'triangle', volume: 0.13, notes: 'E2 E2 . E2 E3 . E2 . | D2 D2 . D2 D3 . D2 . | C2 C2 . C2 C3 . C2 . | B1 B1 . B1 B2 . B1 .' },
    drums: 'k . s k k . s . | k . s k k . s . | k . s k k . s . | k s k s s s s s',
  },
  // Súper Bolitas: brincadora y alegre (en el castillo suena 'jefe' con el jefe).
  plat: {
    bpm: 138,
    lead: { wave: 'square', volume: 0.045, notes: 'C5 . E5 G5 . E5 C5 . | D5 . F5 A5 . G5 F5 . | E5 . G5 C6 . B5 A5 . | G5 . E5 F5 D5 - . . | C5 . E5 G5 . A5 G5 . | F5 . A5 C6 . A5 F5 . | E5 G5 E5 D5 C5 . D5 . | C5 - . . G4 . . .' },
    bass: { wave: 'triangle', volume: 0.12, notes: 'C3 . G2 . C3 . G2 . | D3 . A2 . D3 . A2 . | E3 . B2 . A2 . E2 . | G2 . D3 . G2 . B2 . | C3 . G2 . C3 . G2 . | F2 . C3 . F2 . C3 . | G2 . D3 . G2 . B2 . | C3 . G2 . C3 . . .' },
    drums: 'k . h k s . h . | k . h k s . h . | k . h k s . h . | k . h k s . s s | k . h k s . h . | k . h k s . h . | k . h k s . h . | k . s k s s s s',
  },
  // Minigolf: tranquila y saltarina (para pensar el tiro).
  golf: {
    bpm: 100,
    lead: { wave: 'triangle', volume: 0.06, notes: 'G5 . E5 G5 A5 . G5 E5 | F5 . D5 F5 G5 . F5 D5 | E5 . C5 E5 G5 . E5 C5 | D5 E5 F5 D5 G5 - . . | G5 . E5 G5 A5 . G5 E5 | F5 . D5 F5 G5 . F5 D5 | E5 G5 C6 B5 A5 G5 F5 D5 | C5 - . . . . . .' },
    bass: { wave: 'triangle', volume: 0.1, notes: 'C3 . G2 . C3 . G2 . | D3 . A2 . D3 . A2 . | C3 . G2 . C3 . G2 . | G2 . D3 . G2 . B2 . | C3 . G2 . C3 . G2 . | D3 . A2 . D3 . A2 . | F2 . C3 . G2 . D3 . | C3 . G2 . C3 . . .' },
    drums: 'k . h . s . h . | k . h . s . h . | k . h . s . h . | k . h . s . h h | k . h . s . h . | k . h . s . h . | k . h . s . h . | k . . . s . . .',
  },
  // Laberinto come-frutas: saltarina y traviesa (con la fruta de poder se acelera).
  laberinto: {
    bpm: 128,
    lead: { wave: 'square', volume: 0.04, notes: 'C5 . G5 . E5 . C6 . | B4 . G5 . D5 . B5 . | A4 . E5 . C5 . A5 . | G4 A4 B4 C5 D5 E5 F5 G5 | C5 . G5 . E5 . C6 . | B4 . G5 . D5 . B5 . | A4 C5 F5 A5 G5 E5 D5 B4 | C5 - . . G4 - . .' },
    bass: { wave: 'triangle', volume: 0.12, notes: 'C3 . C3 G2 C3 . C3 G2 | G2 . G2 D3 G2 . G2 D3 | A2 . A2 E3 A2 . A2 E3 | G2 . G2 . G2 A2 B2 . | C3 . C3 G2 C3 . C3 G2 | G2 . G2 D3 G2 . G2 D3 | F2 . F2 C3 G2 . G2 D3 | C3 . G2 . C3 . . .' },
    drums: 'k . h s k . h s | k . h s k . h s | k . h s k . h s | k . h s k s s s | k . h s k . h s | k . h s k . h s | k . h s k . h s | k . s . k . . .',
  },
  // Mundo de bloques: tranquila, para escarbar y construir con calma.
  bloques: {
    bpm: 92,
    lead: { wave: 'triangle', volume: 0.06, notes: 'E5 - G5 - D5 - . . | C5 - E5 - G4 - . . | A4 - C5 - E5 - D5 - | G5 - - - . . . . | E5 - G5 - A5 - G5 - | F5 - E5 - D5 - . . | C5 - D5 - E5 - G5 - | C5 - - - . . . .' },
    bass: { wave: 'triangle', volume: 0.09, notes: 'C3 - - - G2 - - - | A2 - - - E2 - - - | F2 - - - C3 - - - | G2 - - - D3 - - - | C3 - - - G2 - - - | F2 - - - G2 - - - | A2 - - - F2 - - - | C3 - - - - - - -' },
    drums: 'k . . . h . . . | k . . . h . . . | k . . . h . . . | k . . . h . h . | k . . . h . . . | k . . . h . . . | k . . . h . . . | k . . . . . . .',
  },
  // Guerra de pintura: brincadora y con ritmo, para correr pintando.
  pintura: {
    bpm: 144,
    lead: { wave: 'square', volume: 0.04, notes: 'G5 . B5 D6 . B5 G5 . | A5 . C6 E6 . C6 A5 . | B5 . D6 G6 . D6 B5 . | A5 G5 F#5 G5 A5 - . .' },
    bass: { wave: 'triangle', volume: 0.12, notes: 'G2 . G3 G2 . G3 G2 . | A2 . A3 A2 . A3 A2 . | E2 . E3 E2 . E3 E2 . | D2 . D3 D2 D3 D2 D3 .' },
    drums: 'k . s k . k s . | k . s k . k s . | k . s k . k s . | k s k s s s s s',
  },
  // Canción de cuna para el Modo Bebé: lenta, suave y sin batería.
  baby: {
    bpm: 84,
    lead: { wave: 'sine', volume: 0.07, notes: 'E5 - G5 - C6 - G5 - | F5 - A5 - C6 - A5 - | D5 - G5 - B5 - G5 - | E5 - G5 - C6 - - -' },
    bass: { wave: 'triangle', volume: 0.08, notes: 'C3 - - - G3 - - - | F3 - - - C4 - - - | G3 - - - D4 - - - | C3 - - - - - - -' },
    drums: '',
  },
};

const NOTE_INDEX = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

// La frecuencia de una nota ("E5", "F#3", "Bb4"). También la usan las canciones del Modo Bebé.
export function noteFrequency(note) {
  const [, letter, accidental, octave] = /^([A-G])([#b]?)(\d)$/.exec(note);
  const semitone = NOTE_INDEX[letter] + (accidental === '#' ? 1 : accidental === 'b' ? -1 : 0);
  const midi = (Number(octave) + 1) * 12 + semitone;
  return 440 * 2 ** ((midi - 69) / 12);
}

function steps(text) {
  return text.split(/\s+/).filter((token) => token && token !== '|');
}

// Pasa el texto de cada pista a notas con su duración en pasos (contando los "-").
function parseTrack(text) {
  const tokens = steps(text);
  return tokens.map((token, i) => {
    if (token === '.' || token === '-') return null;
    let length = 1;
    while (tokens[i + length] === '-') length += 1;
    return { freq: noteFrequency(token), length };
  });
}

function compile(song) {
  return {
    stepSeconds: 60 / song.bpm / 2,
    tracks: [song.lead, song.bass].map((track) => ({ ...track, steps: parseTrack(track.notes) })),
    drums: steps(song.drums),
  };
}

class MusicPlayer {
  constructor() {
    this.name = null;
    this.song = null;
    this.timer = null;
    this.output = null;
    this.tempo = 1;
  }

  enabled() {
    return settings.get('music', true);
  }

  setEnabled(enabled) {
    settings.set('music', enabled);
    const name = this.name;
    this.stop();
    this.name = name;
    if (enabled && name) this.start();
  }

  // Más rápida (factor > 1) o normal (1): la última vuelta de los karts.
  setTempo(factor) {
    this.tempo = factor;
  }

  play(name) {
    this.tempo = 1;
    if (this.name === name) return;
    this.stop();
    this.name = name;
    if (name && SONGS[name] && this.enabled()) this.start();
  }

  start() {
    this.song = compile(SONGS[this.name]);
    this.step = 0;
    this.nextTime = null;
    this.timer = setInterval(() => this.schedule(), LOOKAHEAD_MS);
  }

  stop() {
    clearInterval(this.timer);
    this.timer = null;
    this.song = null;
    this.name = null;
    // Se apaga rápido lo que ya estaba programado, sin cortarlo de golpe.
    if (this.output) {
      const ctx = this.output.context;
      this.output.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
      const old = this.output;
      setTimeout(() => old.disconnect(), 400);
      this.output = null;
    }
  }

  // Programa las notas que caen en los próximos milisegundos (así el ritmo no depende de los cuadros).
  schedule() {
    const ctx = audioContext();
    if (!ctx || !this.song) return;
    if (!this.output) {
      this.output = ctx.createGain();
      this.output.gain.value = VOLUME;
      this.output.connect(ctx.destination);
    }
    if (this.nextTime === null || this.nextTime < ctx.currentTime) this.nextTime = ctx.currentTime + 0.05;
    while (this.nextTime < ctx.currentTime + SCHEDULE_AHEAD_S) {
      this.playStep(ctx, this.step, this.nextTime);
      this.step += 1;
      this.nextTime += this.song.stepSeconds / this.tempo;
    }
  }

  playStep(ctx, step, time) {
    const { tracks, drums, stepSeconds } = this.song;
    for (const track of tracks) {
      const note = track.steps[step % track.steps.length];
      if (note) this.tone(ctx, time, note.freq, note.length * stepSeconds * 0.92, track.wave, track.volume);
    }
    if (drums.length) {
      const hit = drums[step % drums.length];
      if (hit === 'k') this.kick(ctx, time);
      else if (hit === 's') this.noise(ctx, time, 0.12, 0.09, 1800);
      else if (hit === 'h') this.noise(ctx, time, 0.04, 0.035, 8000);
    }
  }

  tone(ctx, time, freq, seconds, wave, volume) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = wave;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(volume, time + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0005, time + seconds);
    osc.connect(gain).connect(this.output);
    osc.start(time);
    osc.stop(time + seconds + 0.02);
  }

  kick(ctx, time) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.setValueAtTime(130, time);
    osc.frequency.exponentialRampToValueAtTime(45, time + 0.14);
    gain.gain.setValueAtTime(0.22, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.16);
    osc.connect(gain).connect(this.output);
    osc.start(time);
    osc.stop(time + 0.18);
  }

  noise(ctx, time, seconds, volume, filterFreq) {
    if (!this.noiseBuffer) {
      this.noiseBuffer = ctx.createBuffer(1, ctx.sampleRate / 4, ctx.sampleRate);
      const data = this.noiseBuffer.getChannelData(0);
      for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
    }
    const source = ctx.createBufferSource();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    source.buffer = this.noiseBuffer;
    filter.type = filterFreq > 4000 ? 'highpass' : 'bandpass';
    filter.frequency.value = filterFreq;
    gain.gain.setValueAtTime(volume, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + seconds);
    source.connect(filter).connect(gain).connect(this.output);
    source.start(time);
    source.stop(time + seconds + 0.02);
  }
}

export const music = new MusicPlayer();
