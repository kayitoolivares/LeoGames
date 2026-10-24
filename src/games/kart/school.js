import * as THREE from 'three';
import { rewards } from '../../shared/rewards.js';
import { settings } from '../../shared/settings.js';
import { sfx } from '../../shared/sound.js';
import { RACER_RADIUS } from './Racer.js';

// La Escuela de manejo de Karts locos: retos cortitos, cada uno en su pista, para los jugadores (sin compu ni
// cajitas). Cada quien se gana su medalla según cómo le fue y se guarda la mejor de la familia.
//   aros:    pasar por los aros en orden, lo más rápido posible.
//   derrape: hacer 3 turbos de derrape (de cualquier color), lo más rápido posible.
//   salto:   agarrar vuelo, saltar en la rampa y llegar lo más lejos.
//   conos:   pasar por las puertas de conos (cada cono tirado o puerta saltada, +2 segundos).
//   monedas: juntar todas las monedas que se pueda en 40 segundos.
// `medals`: lo que hay que hacer para oro, plata y bronce (`lower`: entre menos, mejor; si no, entre más). Calibradas
// con un bot que maneja perfecto: el oro pide casi lo que hace el bot.
export const LESSONS = {
  aros: {
    emoji: '⭕',
    name: 'Aros',
    info: 'Pasa por los 8 aros lo más rápido que puedas',
    track: 'pradera',
    medals: [20000, 27000, 38000],
    lower: true,
    limitMs: 100000,
  },
  derrape: {
    emoji: '💨',
    name: 'Derrapes',
    info: 'Haz 3 turbos de derrape: mantén LB en las curvas y suéltalo cuando salgan chispas',
    track: 'dulces',
    medals: [18000, 28000, 42000],
    lower: true,
    limitMs: 80000,
  },
  salto: {
    emoji: '🦘',
    name: 'Salto largo',
    info: 'Agarra vuelo, salta en la rampa y llega lo más lejos que puedas',
    track: 'pradera',
    medals: [38, 30, 20],
    lower: false,
    limitMs: 20000,
  },
  conos: {
    emoji: '🔶',
    name: 'Conos',
    info: 'Pasa por en medio de cada puerta de conos sin tirarlos',
    track: 'juguetes',
    medals: [16000, 22000, 32000],
    lower: true,
    limitMs: 90000,
  },
  monedas: {
    emoji: '🪙',
    name: 'Monedas',
    info: 'Junta todas las monedas que puedas en 40 segundos',
    track: 'playa',
    medals: [32, 22, 12],
    lower: false,
    limitMs: 40000,
  },
};
export const LESSON_KEYS = Object.keys(LESSONS);
export const MEDALS = [
  { key: 'oro', emoji: '🥇', name: 'oro' },
  { key: 'plata', emoji: '🥈', name: 'plata' },
  { key: 'bronce', emoji: '🥉', name: 'bronce' },
];
const SAVE_KEY = 'kartEscuela';
const RINGS = { count: 8, radius: 4.2, height: 3.2, reach: 4.6, colors: [0xff5a5f, 0xffc93c, 0x4cd97b, 0x3fa7ff] };
const GATES = { count: 8, first: 30, every: 26, half: 5, swing: 3.5 };
const CONE_PENALTY_MS = 2000;
const JUMP_RUNUP = 55;

// La mejor medalla de la familia en cada reto: { aros: 0 (oro) | 1 (plata) | 2 (bronce) }.
export const schoolMedals = {
  get() {
    return settings.get(SAVE_KEY, {});
  },
  save(key, medal) {
    const data = this.get();
    if (data[key] !== undefined && data[key] <= medal) return false;
    settings.set(SAVE_KEY, { ...data, [key]: medal });
    return true;
  },
};

// Qué medalla (0, 1, 2) es `score` en el reto, o null si no alcanzó ni bronce.
export function medalFor(lesson, score) {
  if (score === null || score === undefined) return null;
  const index = lesson.medals.findIndex((goal) => (lesson.lower ? score <= goal : score >= goal));
  return index === -1 ? null : index;
}

export class Lesson {
  constructor(game, key) {
    this.game = game;
    this.key = key;
    this.data = LESSONS[key];
    this.objects = [];
    this.state = new Map(game.humans.map((racer) => [racer, { done: false, score: null, ring: 0, turbos: 0, penalty: 0, gate: 0, coins: 0, jumpFrom: null }]));
  }

  get track() {
    return this.game.track;
  }

  add(object) {
    this.game.scene.add(object);
    this.objects.push(object);
    return object;
  }

  // Pone los aros o los conos, y a los karts donde empieza el reto.
  setup() {
    const track = this.track;
    if (this.key === 'aros') {
      this.rings = Array.from({ length: RINGS.count }, (_, i) => {
        const at = track.pointAt(Math.round(((i + 0.6) / (RINGS.count + 0.4)) * track.count), [0, -4, 4, 0][i % 4]);
        const ring = this.add(
          new THREE.Mesh(
            new THREE.TorusGeometry(RINGS.radius, 0.45, 10, 32),
            new THREE.MeshLambertMaterial({ color: RINGS.colors[i % RINGS.colors.length], emissive: 0x222222 }),
          ),
        );
        ring.position.set(at.x, track.roadHeight(at.x, at.z, at.index) + RINGS.height, at.z);
        ring.rotation.y = at.heading;
        return { ring, x: at.x, z: at.z, index: at.index };
      });
    }
    if (this.key === 'conos') {
      const coneGeometry = new THREE.ConeGeometry(0.7, 1.8, 12);
      const coneMaterial = new THREE.MeshLambertMaterial({ color: 0xff8a1e });
      this.gates = Array.from({ length: GATES.count }, (_, i) => {
        const index = GATES.first + i * GATES.every;
        const center = i % 2 ? GATES.swing : -GATES.swing;
        const cones = [center - GATES.half, center + GATES.half].map((lane) => {
          const at = track.pointAt(index, lane);
          const cone = this.add(new THREE.Mesh(coneGeometry, coneMaterial));
          cone.position.set(at.x, track.roadHeight(at.x, at.z, at.index) + 0.9, at.z);
          return { cone, x: at.x, z: at.z, down: false, vy: 0 };
        });
        return { index, center, cones };
      });
      this.finishIndex = GATES.first + GATES.count * GATES.every;
      this.placeStart(GATES.first - 18);
    }
    if (this.key === 'salto') {
      this.rampIndex = Math.round(this.game.trackLook.ramps[0] * track.count);
      this.placeStart(this.rampIndex - JUMP_RUNUP);
    }
  }

  // Todos en fila (de 2 en 2) unos metros antes de `index`.
  placeStart(index) {
    this.game.humans.forEach((racer, i) => {
      const spot = this.track.pointAt(index - Math.floor(i / 2) * 6, i % 2 === 0 ? -3.5 : 3.5);
      racer.reset(spot.x, spot.z, spot.heading, spot.index);
      racer.lap = 0;
      racer.crossedHalf = false;
    });
  }

  // Cada cuadro. Devuelve true cuando ya terminaron todos (o se acabó el tiempo).
  update(dtMs) {
    const ms = this.game.raceMs;
    for (const [racer, s] of this.state) {
      if (s.done) continue;
      if (this.key === 'aros') this.updateRings(racer, s, ms);
      if (this.key === 'conos') this.updateCones(racer, s, ms);
      if (this.key === 'salto' && s.jumpFrom === null && racer.index > this.rampIndex + 6 && !racer.airborne) this.finish(racer, s, 0, '¡No saltaste!');
    }
    for (const gate of this.gates ?? []) {
      for (const c of gate.cones) {
        if (!c.down) continue;
        // Los conos tirados salen volando y se caen.
        c.vy -= 30 * (dtMs / 1000);
        c.cone.position.y = Math.max(-2, c.cone.position.y + c.vy * (dtMs / 1000));
        c.cone.rotation.z += 0.2;
      }
    }
    const nextRing = (s) => this.rings?.[s.ring];
    // El aro que sigue brilla (para el primer jugador que no ha terminado).
    const lead = [...this.state.values()].find((s) => !s.done);
    this.rings?.forEach((r, i) => {
      r.ring.material.emissive?.setHex(lead && nextRing(lead) === r ? 0x666666 : i < (lead?.ring ?? RINGS.count) ? 0x000000 : 0x222222);
      r.ring.rotation.z += dtMs / 1500;
    });
    // Monedas: se acaba el tiempo y cuenta lo que juntó cada quien.
    if (this.key === 'monedas' && ms >= this.data.limitMs) {
      for (const [racer, s] of this.state) if (!s.done) this.finish(racer, s, s.coins);
    }
    if (ms >= this.data.limitMs) for (const [racer, s] of this.state) if (!s.done) this.finish(racer, s, null, '¡Se acabó el tiempo!');
    return [...this.state.values()].every((s) => s.done);
  }

  updateRings(racer, s, ms) {
    const r = this.rings[s.ring];
    if (Math.hypot(racer.x - r.x, racer.z - r.z) > RINGS.reach) return;
    s.ring += 1;
    if (!racer.isCpu) sfx.coin();
    this.game.particles.burst('spark', r.x, r.ring.position.y, r.z, 14, RINGS.colors, { speed: 6, up: 4, lifeMs: 500 });
    if (s.ring < this.rings.length) {
      racer.say(`⭕ ${s.ring} de ${this.rings.length}`, 900);
      return;
    }
    this.finish(racer, s, ms);
  }

  updateCones(racer, s, ms) {
    // Tirar un cono: sale volando y +2 segundos.
    for (const gate of this.gates) {
      for (const c of gate.cones) {
        if (c.down || Math.hypot(racer.x - c.x, racer.z - c.z) > RACER_RADIUS + 0.7) continue;
        c.down = true;
        c.vy = 9;
        s.penalty += CONE_PENALTY_MS;
        sfx.hit(0.4);
        racer.say('¡Tiraste un cono! +2 s 🔶', 1000);
      }
    }
    // Pasar por una puerta: si fue por en medio, bien; si no, +2 segundos.
    const gate = this.gates[s.gate];
    if (gate && racer.index >= gate.index && racer.index < gate.index + 20) {
      const lateral = this.track.lateral(racer.x, racer.z, racer.index);
      if (Math.abs(lateral - gate.center) > GATES.half + 0.5) {
        s.penalty += CONE_PENALTY_MS;
        racer.say('¡Te saltaste una puerta! +2 s', 1000);
      } else if (!racer.isCpu) sfx.select();
      s.gate += 1;
    }
    if (racer.index >= this.finishIndex && racer.index < this.finishIndex + 20) this.finish(racer, s, ms + s.penalty);
  }

  // Lo que pasa con el kart (los turbos del derrape, el salto).
  event(racer, event) {
    const s = this.state.get(racer);
    if (!s || s.done) return;
    if (this.key === 'derrape' && event.startsWith('turbo')) {
      s.turbos += 1;
      racer.say(`💨 ${s.turbos} de 3`, 900);
      if (s.turbos >= 3) this.finish(racer, s, this.game.raceMs);
    }
    if (this.key === 'salto' && event === 'jump') s.jumpFrom = { x: racer.x, z: racer.z };
    if (this.key === 'salto' && event === 'land' && s.jumpFrom) {
      const meters = Math.round(Math.hypot(racer.x - s.jumpFrom.x, racer.z - s.jumpFrom.z));
      this.finish(racer, s, meters);
    }
  }

  // Monedas: se cuentan todas (sin el tope de 10 de las carreras).
  onCoin(racer) {
    const s = this.state.get(racer);
    if (!s || s.done) return;
    s.coins += 1;
    racer.coins = 0;
    racer.say(`🪙 ${s.coins}`, 600);
  }

  finish(racer, s, score, message = null) {
    s.done = true;
    s.score = score;
    s.medal = medalFor(this.data, score);
    if (s.medal !== null) sfx.win();
    racer.say(message ?? (s.medal !== null ? `¡Medalla de ${MEDALS[s.medal].name}! ${MEDALS[s.medal].emoji}` : '¡Casi! Inténtalo otra vez'), 3000);
  }

  // Lo que dice el panel de cada jugador.
  panel(racer) {
    const s = this.state.get(racer);
    if (!s) return '';
    if (s.done) return s.medal !== null ? MEDALS[s.medal].emoji : '😅';
    if (this.key === 'aros') return `⭕ ${s.ring}/${RINGS.count}`;
    if (this.key === 'derrape') return `💨 ${s.turbos}/3`;
    if (this.key === 'conos') return `🔶 ${s.gate}/${GATES.count}`;
    if (this.key === 'monedas') return `🪙 ${s.coins}`;
    return '🦘';
  }

  // Cómo le fue a cada quien (y se guarda la mejor medalla). Devuelve las filas para la tabla.
  results() {
    let gold = false;
    const rows = [...this.state].map(([racer, s]) => {
      if (s.medal !== null) schoolMedals.save(this.key, s.medal);
      if (s.medal === 0) gold = true;
      return { racer, medal: s.medal, text: scoreText(this.data, this.key, s.score) };
    });
    if (gold) rewards.earn('kart-escuela');
    const best = schoolMedals.get();
    if (LESSON_KEYS.every((key) => best[key] === 0)) rewards.earn('kart-maestro');
    return rows;
  }

  dispose() {
    for (const object of this.objects) this.game.scene.remove(object);
    this.objects = [];
  }
}

// Cómo se dice lo que hizo: un tiempo, metros o monedas.
export function scoreText(data, key, score) {
  if (score === null || score === undefined) return '—';
  if (key === 'salto') return `${score} m`;
  if (key === 'monedas') return `${score} 🪙`;
  const seconds = score / 1000;
  return `${Math.floor(seconds / 60)}:${(seconds % 60).toFixed(1).padStart(4, '0')}`;
}

// Lo que hay que hacer para cada medalla, para mostrarlo.
export function goalsText(key) {
  const data = LESSONS[key];
  return MEDALS.map((m, i) => `${m.emoji} ${scoreText(data, key, data.medals[i])}`).join('  ');
}
