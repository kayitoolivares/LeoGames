// Las grabaciones de la voz del juego (el locutor). Cada frase que dice el juego se graba aparte (con Gemini) y se
// guarda en public/voz/<nombre>.mp3; src/shared/voz.json es la lista de las que ya hay (ver src/shared/voice.js).
//
//   node tools/voz.mjs lista
//       Junta todas las frases que dice el juego en tools/voz/frases.json y cuenta cuántas faltan por grabar:
//       las que se oyeron jugando en la compu (tools/voz/oidas.txt, se anotan solas con npm run dev y npm test),
//       las que están escritas tal cual en el código (say('...'), las del narrador, los letreros) y las que salen de
//       listas (personajes, calcomanías, jugadores, juegos, mundos).
//   node tools/voz.mjs importar <carpeta>
//       Toma las grabaciones <nombre>.wav de esa carpeta (de una frase cada una), les quita el silencio de las
//       orillas, las empareja de volumen, las pasa a MP3 en public/voz/ y las agrega a src/shared/voz.json.
import { Mp3Encoder } from '@breezystack/lamejs';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { clipName, spokenText } from '../src/shared/voice-text.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'src');
const HEARD = path.join(ROOT, 'tools/voz/oidas.txt');
const PHRASES = path.join(ROOT, 'tools/voz/frases.json');
const LIST = path.join(SRC, 'shared/voz.json');
const OUT = path.join(ROOT, 'public/voz');
const KBPS = 48;
const PEAK = 0.89;

const read = (file) => readFileSync(file, 'utf8');
const recorded = () => new Set(existsSync(LIST) ? JSON.parse(read(LIST)) : []);

function jsFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return jsFiles(full);
    return entry.name.endsWith('.js') ? [full] : [];
  });
}

// Los textos fijos dentro de una llamada: 'hola', "hola" y `hola` (los que llevan ${...} cambian: no cuentan).
function literals(code) {
  const found = [];
  let i = 0;
  while (i < code.length) {
    const quote = code[i];
    if (quote !== "'" && quote !== '"' && quote !== '`') {
      i += 1;
      continue;
    }
    let j = i + 1;
    let text = '';
    let dynamic = false;
    while (j < code.length && code[j] !== quote) {
      if (code[j] === '\\') {
        text += code[j + 1];
        j += 2;
      } else if (quote === '`' && code[j] === '$' && code[j + 1] === '{') {
        dynamic = true;
        let depth = 1;
        j += 2;
        while (j < code.length && depth > 0) {
          if (code[j] === '{') depth += 1;
          else if (code[j] === '}') depth -= 1;
          j += 1;
        }
      } else {
        text += code[j];
        j += 1;
      }
    }
    if (!dynamic) found.push(text);
    i = j + 1;
  }
  return found;
}

// El texto de los argumentos de cada say(...), line(...) y showBanner(...) (contando paréntesis).
function spokenCalls(code) {
  const out = [];
  for (const m of code.matchAll(/\b(?:say|line|showBanner)\(/g)) {
    let depth = 1;
    let i = m.index + m[0].length;
    let quote = null;
    for (; i < code.length && depth > 0; i += 1) {
      const c = code[i];
      if (quote) {
        if (c === '\\') i += 1;
        else if (c === quote) quote = null;
      } else if (c === "'" || c === '"' || c === '`') quote = c;
      else if (c === '(') depth += 1;
      else if (c === ')') depth -= 1;
    }
    out.push(code.slice(m.index + m[0].length, i - 1));
  }
  return out;
}

// Frases que salen de listas del juego (las que se dicen con el nombre de algo).
function census() {
  const phrases = [];
  const field = (file, key) => [...read(path.join(SRC, file)).matchAll(new RegExp(`\\b${key}: '((?:[^'\\\\]|\\\\.)*)'`, 'g'))].map((m) => m[1]);
  const characters = field('games/smash/characters.js', 'name');
  phrases.push(...characters, ...field('games/smash/characters.js', 'superName'));
  for (const m of read(path.join(SRC, 'shared/rewards.js')).matchAll(/\{ id: '[^']+', emoji: '[^']+', name: '((?:[^'\\]|\\.)*)', hint: '((?:[^'\\]|\\.)*)' \}/g)) {
    phrases.push(`¡Nueva calcomanía! ${m[1]}`, `${m[1]}. ${m[2]}`, `Para ganarla: ${m[2]}`);
  }
  const colors = field('shared/players.js', 'name');
  for (let n = 1; n <= 4; n += 1) for (const color of colors) phrases.push(`¡Jugador ${n}, ${color}!`);
  phrases.push(...field('games.js', 'title'));
  const worlds = field('games/brawl/worlds.js', 'name');
  phrases.push(...worlds, ...field('games/brawl/worlds.js', 'title'));
  for (const m of read(path.join(SRC, 'games/brawl/Monster.js')).matchAll(/name: '([^']+)'[^\n]*boss: true/g)) phrases.push(`¡Llegó el jefe! ¡${m[1]}!`);
  // Lo que más repite el narrador, con cada personaje (Bolitas Bros) y con cada jugador (Pelea en equipo, Duelo).
  for (const c of characters) {
    phrases.push(`¡Primer golpe de ${c}!`, `¡${c} pega primero!`, `¡${c} sale disparado!`, `¡A ${c} le queda una vida!`, `¡${c} salió volando!`);
    phrases.push(`¡Adiós, ${c}!`, `¡Hasta la vista, ${c}!`, `¡Parada perfecta de ${c}!`, `¡Rescataron a ${c}! Ahora pelea con ustedes`);
  }
  const humans = ['J1', 'J2', 'J3', 'J4'];
  for (const p of [...humans, 'Compu 1', 'Compu 2', 'Compu 3']) {
    phrases.push(`¡${p} cayó! ¡Ayúdenlo!`, `¡Levanten a ${p}!`, `¡${p} está de vuelta!`, `¡${p} va montado en el dinosaurio!`, `¡${p} va montado en el pollo gigante!`);
  }
  for (const p of [...humans, 'CPU']) phrases.push(`¡Ganó ${p}!`, `¡Primer golpe de ${p}!`, `¡Qué parada de ${p}!`);
  return phrases;
}

function list() {
  const all = new Map();
  const add = (text, from) => {
    const spoken = spokenText(text);
    // Sin letras no es frase (p. ej. '' o '+♥'); con "=" es un letrero de botones y con "#" o "{" es un color o un
    // pedazo de código: no se dicen.
    if (!/\p{L}{2}/u.test(spoken) || / = |[#{}]/.test(spoken)) return;
    if (!all.has(spoken)) all.set(spoken, from);
  };
  if (existsSync(HEARD)) for (const line of read(HEARD).split(/\r?\n/)) add(line, 'oida');
  for (const file of jsFiles(SRC)) for (const call of spokenCalls(read(file))) for (const text of literals(call)) add(text, 'código');
  for (const text of census()) add(text, 'lista');
  const have = recorded();
  const phrases = [...all].map(([text, from]) => ({ text, name: clipName(text), from, recorded: have.has(clipName(text)) }));
  phrases.sort((a, b) => a.text.localeCompare(b.text, 'es'));
  mkdirSync(path.dirname(PHRASES), { recursive: true });
  writeFileSync(PHRASES, `${JSON.stringify(phrases, null, 1)}\n`);
  const pending = phrases.filter((p) => !p.recorded).length;
  const by = (from) => phrases.filter((p) => p.from === from).length;
  console.log(`${phrases.length} frases (${by('oida')} oídas, ${by('código')} del código, ${by('lista')} de listas): ${phrases.length - pending} grabadas, ${pending} por grabar.`);
}

function readWav(file) {
  const buf = readFileSync(file);
  let pos = 12;
  let rate = 24000;
  let data = null;
  while (pos < buf.length) {
    const id = buf.toString('ascii', pos, pos + 4);
    const size = buf.readUInt32LE(pos + 4);
    if (id === 'fmt ') rate = buf.readUInt32LE(pos + 12);
    if (id === 'data') data = buf.subarray(pos + 8, pos + 8 + size);
    pos += 8 + size + (size % 2);
  }
  return { rate, samples: new Int16Array(data.buffer.slice(data.byteOffset, data.byteOffset + data.length)) };
}

// Quita el silencio de las orillas (dejando un poquito) y sube o baja el volumen para que todas suenen parejo.
function tidy({ rate, samples }) {
  const loud = (s) => Math.abs(s) > 600;
  let start = samples.findIndex(loud);
  let end = samples.length - 1;
  while (end > 0 && !loud(samples[end])) end -= 1;
  if (start < 0) return null;
  const pad = Math.round(rate * 0.05);
  start = Math.max(0, start - pad);
  end = Math.min(samples.length, end + pad);
  const clip = samples.slice(start, end);
  let peak = 1;
  for (const s of clip) peak = Math.max(peak, Math.abs(s));
  const gain = (PEAK * 32767) / peak;
  for (let i = 0; i < clip.length; i += 1) clip[i] = Math.max(-32768, Math.min(32767, Math.round(clip[i] * gain)));
  return clip;
}

function mp3(clip, rate) {
  const encoder = new Mp3Encoder(1, rate, KBPS);
  const chunks = [];
  for (let i = 0; i < clip.length; i += 1152) chunks.push(encoder.encodeBuffer(clip.subarray(i, i + 1152)));
  chunks.push(encoder.flush());
  return Buffer.concat(chunks.map((c) => Buffer.from(c.buffer, c.byteOffset, c.length)));
}

function importWavs(dir) {
  const have = recorded();
  mkdirSync(OUT, { recursive: true });
  let count = 0;
  for (const file of readdirSync(dir).filter((f) => /^[0-9a-f]{8}\.wav$/.test(f))) {
    const name = file.slice(0, 8);
    if (have.has(name) && existsSync(path.join(OUT, `${name}.mp3`))) continue;
    const wav = readWav(path.join(dir, file));
    const clip = tidy(wav);
    if (!clip) {
      console.log(`  ✗ ${file}: está en silencio`);
      continue;
    }
    writeFileSync(path.join(OUT, `${name}.mp3`), mp3(clip, wav.rate));
    have.add(name);
    count += 1;
  }
  writeFileSync(LIST, `${JSON.stringify([...have].sort())}\n`);
  console.log(`${count} grabaciones nuevas; ${have.size} en total.`);
}

const [command, arg] = process.argv.slice(2);
if (command === 'lista') list();
else if (command === 'importar' && arg) importWavs(arg);
else console.log('Uso: node tools/voz.mjs lista   |   node tools/voz.mjs importar <carpeta con <nombre>.wav>');
