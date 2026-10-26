// Lo que de veras dice la voz y cómo se llama su grabación. Lo usan el juego (voice.js) y la herramienta que hace
// las grabaciones (tools/voz.mjs), así los dos calculan el mismo nombre para la misma frase.
const ORDINALS = { 1: 'primer', 2: 'segundo', 3: 'tercer', 4: 'cuarto', 5: 'quinto', 6: 'sexto' };

// "J1" → "el jugador 1", "CPU 2" → "la compu 2", "1°" → "primer" (así suena natural) y sin emojis.
// "a el" y "de el" se juntan: "¡Gol del jugador 1!", "Ayuden al jugador 2".
export function spokenText(text) {
  return String(text ?? '')
    .replace(/\bJ(\d)\b/g, 'el jugador $1')
    .replace(/\b([Aa]) el\b/g, '$1l')
    .replace(/\b([Dd]e) el\b/g, '$1l')
    .replace(/\bCPU\b/g, 'la compu')
    .replace(/(\d)°/g, (_, n) => ORDINALS[n] ?? `${n}`)
    .replace(/[\p{Extended_Pictographic}\u{FE0F}\u{200D}\u{20E3}]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// El nombre del archivo de una frase: 8 letras y números que salen de la frase (FNV-1a).
export function clipName(spoken) {
  let hash = 0x811c9dc5;
  for (const char of spoken) {
    hash ^= char.codePointAt(0);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}
