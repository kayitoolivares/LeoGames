import { say } from '../../shared/voice.js';

// Los pilotos de la compu con personalidad: cada uno maneja a su manera y tiene un rival favorito (uno de los
// jugadores) contra el que se esfuerza más y al que le dice cosas: cuando lo rebasa, cuando le pega o le pegan y
// al final. Y un narrador que cuenta lo importante de la carrera. Todo con letrero y voz, sin amontonar frases.
export const PERSONALITIES = {
  // Acelera más, usa más nitro y casi siempre se mete al atajo.
  veloz: { gas: 0.04, nitro: 2, shortcut: 0.85, trick: 1 },
  // Usa sus poderes en cuanto puede y suelta plátanos en el camino.
  tramposo: { gas: 0, nitro: 1, shortcut: 0.45, trick: 1, sneaky: true },
  // Hace trucos en cada salto.
  presumido: { gas: 0.015, nitro: 1, shortcut: 0.5, trick: 4 },
  // Maneja con calma.
  tranquilo: { gas: -0.03, nitro: 0.6, shortcut: 0.15, trick: 0.5 },
};
const KINDS = Object.keys(PERSONALITIES);
// Con su rival cerca le echa más ganas.
const RIVAL_NEAR = 40;
const RIVAL_PUSH = 0.05;
const LINES = {
  pass: ['¡Nos vemos, {who}!', '¡Con permiso, {who}!', '¡Bye bye, {who}!', '¡Me voy, {who}!'],
  hit: ['¡Toma eso, {who}!', '¡Jajá, te di, {who}!', '¡Upsi, perdón {who}!'],
  hurt: ['¡Auch! ¡Me las vas a pagar, {who}!', '¡Oye, {who}, no se vale!', '¡Ay, {who}!'],
  win: ['¡Te gané, {who}!', '¡Soy el más rápido!'],
  lose: ['¡La próxima te gano, {who}!', '¡Uy, casi te alcanzo, {who}!'],
};
const LINE_GAP_MS = 4500;
const CAPTION_MS = 2600;
const LEAD_SAY_MS = 7000;

function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

// A cada kart de la compu: una personalidad (que no se repitan si alcanzan) y un rival (uno de los jugadores).
export function assignPersonalities(racers) {
  const humans = racers.filter((racer) => !racer.isCpu);
  const kinds = [...KINDS].sort(() => Math.random() - 0.5);
  racers
    .filter((racer) => racer.isCpu)
    .forEach((racer, i) => {
      racer.personality = kinds[i % kinds.length];
      racer.rival = humans.length ? humans[i % humans.length] : null;
    });
}

// Ayudas para el manejo de la compu según su personalidad.
export function personalityOf(racer) {
  return PERSONALITIES[racer.personality] ?? PERSONALITIES.tranquilo;
}

// Le echa más ganas si su rival va cerca.
export function rivalPush(racer) {
  const rival = racer.rival;
  if (!rival || rival.finished) return 0;
  return Math.hypot(rival.x - racer.x, rival.z - racer.z) < RIVAL_NEAR ? RIVAL_PUSH : 0;
}

// El narrador y las frases de los pilotos: un letrero arriba (en el HUD) y la voz.
export class RaceTalk {
  constructor(hud) {
    this.hud = hud;
    this.waitMs = 0;
    this.captionMs = 0;
    this.lastLeader = null;
    this.leadSaidAt = -Infinity;
    this.order = new Map();
  }

  // `important`: entra aunque se acabe de decir otra cosa.
  line(text, { important = false, voice = text } = {}) {
    if (!important && this.waitMs > 0) return false;
    this.waitMs = LINE_GAP_MS;
    this.captionMs = CAPTION_MS;
    this.hud.setCaption(text);
    say(voice, { interrupt: important });
    return true;
  }

  // Lo que dice un piloto de la compu a su rival.
  quote(cpu, kind, who) {
    const text = pick(LINES[kind]).replace('{who}', who.label);
    return this.line(`${cpu.driver.name}: «${text}»`, { voice: `${cpu.driver.name} dice: ${text}` });
  }

  update(dtMs, ranking, raceMs) {
    this.waitMs = Math.max(0, this.waitMs - dtMs);
    if (this.captionMs > 0) {
      this.captionMs -= dtMs;
      if (this.captionMs <= 0) this.hud.setCaption('');
    }
    if (raceMs < 3000) {
      ranking.forEach((racer, i) => this.order.set(racer, i));
      return;
    }
    // Rebases: un piloto de la compu que acaba de pasar a su rival se lo dice.
    ranking.forEach((racer, place) => {
      const before = this.order.get(racer);
      if (racer.isCpu && racer.rival && before !== undefined && before > place) {
        const rivalPlace = ranking.indexOf(racer.rival);
        if (rivalPlace === place + 1 && this.order.get(racer.rival) < before) this.quote(racer, 'pass', racer.rival);
      }
    });
    ranking.forEach((racer, i) => this.order.set(racer, i));
    // Cambio de primer lugar (solo cuenta si es o era un jugador).
    const leader = ranking[0];
    if (leader !== this.lastLeader) {
      const humanInvolved = !leader.isCpu || (this.lastLeader && !this.lastLeader.isCpu);
      const now = performance.now();
      if (humanInvolved && now - this.leadSaidAt > LEAD_SAY_MS) {
        this.leadSaidAt = now;
        this.line(`¡${nameOf(leader)} va en primer lugar!`);
      }
      this.lastLeader = leader;
    }
  }

  // Un poder le pegó a alguien: la compu presume o se queja con su rival.
  hit(attacker, victim, kind) {
    if (attacker === victim) return;
    if (BIG_HITS[kind]) {
      this.line(BIG_HITS[kind].replace('{who}', nameOf(victim)), { important: !victim.isCpu });
      return;
    }
    if (attacker.isCpu && attacker.rival === victim) this.quote(attacker, 'hit', victim);
    else if (victim.isCpu && victim.rival === attacker) this.quote(victim, 'hurt', attacker);
  }

  // Al final: los de la compu que le ganaron (o no) a su rival.
  finish(ranking) {
    const cpu = ranking.find((racer) => racer.isCpu && racer.rival);
    if (!cpu) return;
    const won = ranking.indexOf(cpu) < ranking.indexOf(cpu.rival);
    this.quote(cpu, won ? 'win' : 'lose', cpu.rival);
  }

  clear() {
    this.captionMs = 0;
    this.hud.setCaption('');
  }
}

// Los golpes grandes que el narrador siempre cuenta.
const BIG_HITS = {
  comet: '¡Cometazo para {who}!',
  bee: '¡Una abeja le picó a {who}!',
  bullet: '¡La bala atropelló a {who}!',
  star: '¡{who} salió volando con la estrella!',
};

// "J1" para los jugadores; el nombre del personaje para la compu.
export function nameOf(racer) {
  return racer.isCpu ? racer.driver.name : racer.label;
}
