// Voz en español (la del navegador) que lee instrucciones y resultados en voz alta:
// el niño de 6 años todavía no lee todo lo que sale en pantalla.
// Igual que el sonido, el navegador no deja hablar hasta un clic o una tecla.
// Si no hay voz en español no dice nada (para no leer el español con voz en inglés).
import { settings } from './settings.js';

const synth = typeof window !== 'undefined' ? window.speechSynthesis : null;
const ORDINALS = { 1: 'primer', 2: 'segundo', 3: 'tercer', 4: 'cuarto', 5: 'quinto', 6: 'sexto' };
let voice = null;

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
  if (!enabled) synth?.cancel();
}

// `interrupt`: corta lo que estuviera diciendo (para no amontonar frases).
export function say(text, { interrupt = true } = {}) {
  if (!synth || !voiceEnabled() || !text) return;
  if (!voice) pickVoice();
  // Todavía sin lista de voces (algunos navegadores la cargan tarde): se pide en español y ya.
  if (!voice && synth.getVoices().length > 0) return;
  if (interrupt) synth.cancel();
  // "J1" → "el jugador 1", "CPU 2" → "la compu 2" y "1°" → "primer": así suena natural.
  const spoken = text
    .replace(/\bJ(\d)\b/g, 'el jugador $1')
    .replace(/\bCPU\b/g, 'la compu')
    .replace(/(\d)°/g, (_, n) => ORDINALS[n] ?? `${n}`);
  const utterance = new SpeechSynthesisUtterance(spoken);
  if (voice) utterance.voice = voice;
  utterance.lang = voice?.lang ?? 'es-MX';
  utterance.rate = 1.05;
  utterance.pitch = 1.15;
  synth.speak(utterance);
}
