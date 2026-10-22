// La voz que lee instrucciones, resultados y lo que dice el narrador: el niño de 6 años todavía no lee todo lo que
// sale en pantalla. Cada frase está grabada con una voz de locutor (Gemini, ver tools/voz.mjs) en public/voz/; si una
// frase no tiene grabación, la lee la voz del navegador (en español; si no hay voz en español no dice nada).
// Igual que el sonido, el navegador no deja sonar nada hasta un clic o una tecla: mientras, lee el navegador.
import clips from './voz.json';
import { settings } from './settings.js';
import { audioContext } from './sound.js';
import { clipName, spokenText } from './voice-text.js';

const synth = typeof window !== 'undefined' ? window.speechSynthesis : null;
const RECORDED = new Set(clips);
const VOLUME = 0.9;
// Las grabaciones ya descargadas (solo las últimas, para no llenar la memoria del Xbox).
const CACHE_SIZE = 60;
const cache = new Map();
let voice = null;
let output = null;
let playing = null;
let queue = [];
// Cada frase que interrumpe empieza otro "turno": lo que se seguía descargando para el turno anterior ya no suena.
let turn = 0;

// Lo último que se dijo y cómo (con su grabación o con la voz del navegador), para las pruebas.
export const voiceLog = [];
if (import.meta.env.DEV && typeof window !== 'undefined') window.__voiceLog = voiceLog;
function logged(text, how) {
  voiceLog.push({ text, how });
  if (voiceLog.length > 30) voiceLog.shift();
}

// Prefiere español de México, luego cualquier español; entre ellas, las voces "naturales".
function pickVoice() {
  const spanish = (synth?.getVoices() ?? []).filter((v) => v.lang?.toLowerCase().startsWith('es'));
  const score = (v) =>
    (v.lang.toLowerCase() === 'es-mx' ? 4 : v.lang.toLowerCase() === 'es-us' ? 2 : 0) + (/natural|google|online/i.test(v.name) ? 1 : 0);
  voice = spanish.sort((a, b) => score(b) - score(a))[0] ?? null;
}

if (synth) {
  pickVoice();
  synth.addEventListener?.('voiceschanged', pickVoice);
}

export function voiceEnabled() {
  return settings.get('voice', true);
}

export function setVoiceEnabled(enabled) {
  settings.set('voice', enabled);
  if (!enabled) stopAll();
}

// `interrupt`: corta lo que estuviera diciendo (para no amontonar frases); si no, espera su turno.
export function say(text, { interrupt = true } = {}) {
  if (!voiceEnabled() || !text) return;
  const spoken = spokenText(text);
  if (!spoken) return;
  if (import.meta.env.DEV) heard(spoken);
  const name = clipName(spoken);
  const ctx = audioContext();
  if (interrupt) stopAll();
  if (!RECORDED.has(name) || !ctx) {
    speak(spoken);
    return;
  }
  const myTurn = turn;
  load(ctx, name)
    .then((buffer) => {
      if (myTurn !== turn) return;
      if (playing) queue.push({ buffer, spoken });
      else play(ctx, { buffer, spoken });
    })
    .catch(() => myTurn === turn && speak(spoken));
}

function load(ctx, name) {
  if (!cache.has(name)) {
    const promise = fetch(`voz/${name}.mp3`)
      .then((response) => {
        if (!response.ok) throw new Error(`voz ${name}: ${response.status}`);
        return response.arrayBuffer();
      })
      .then((data) => ctx.decodeAudioData(data));
    promise.catch(() => cache.delete(name));
    cache.set(name, promise);
    if (cache.size > CACHE_SIZE) cache.delete(cache.keys().next().value);
  }
  return cache.get(name);
}

function play(ctx, { buffer, spoken }) {
  if (!output) {
    output = ctx.createGain();
    output.gain.value = VOLUME;
    output.connect(ctx.destination);
  }
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.connect(output);
  source.onended = () => {
    if (playing !== source) return;
    playing = null;
    const next = queue.shift();
    if (next) play(ctx, next);
  };
  playing = source;
  source.start();
  logged(spoken, 'grabación');
}

function stopAll() {
  turn += 1;
  queue = [];
  const current = playing;
  playing = null;
  try {
    current?.stop();
  } catch {
    // (ya había terminado)
  }
  synth?.cancel();
}

// La voz del navegador, para las frases sin grabación.
function speak(spoken) {
  if (!synth) return;
  if (!voice) pickVoice();
  // Todavía sin lista de voces (algunos navegadores la cargan tarde): se pide en español y ya.
  if (!voice && synth.getVoices().length > 0) return;
  const utterance = new SpeechSynthesisUtterance(spoken);
  if (voice) utterance.voice = voice;
  utterance.lang = voice?.lang ?? 'es-MX';
  utterance.rate = 1.05;
  utterance.pitch = 1.15;
  synth.speak(utterance);
  logged(spoken, 'navegador');
}

// Jugando en la compu (npm run dev, y en las pruebas), cada frase se anota en tools/voz/oidas.txt para grabarla
// después (ver vite.config.js).
const told = new Set();
function heard(spoken) {
  if (told.has(spoken)) return;
  told.add(spoken);
  fetch('/__voz', { method: 'POST', body: spoken }).catch(() => {});
}
