import Phaser from 'phaser';
import { PLAYER_COLORS, players } from '../../shared/players.js';
import { rewards } from '../../shared/rewards.js';
import { sfx } from '../../shared/sound.js';
import { burst, confetti, popText, sparkles } from '../brawl/effects.js';
import { CHARACTER_KEYS, characterInfo } from '../smash/characters.js';
import { RACE_TRACKS } from './levels3.js';
import { groundBelow, tileAt } from './physics.js';
import { Player } from './Player.js';
import { T, isSolid } from './tiles.js';

// Las Carreritas de Súper Bolitas: una copa de 3 carreras en pistas cortas (levels3.js). Todos corren a la vez hacia
// la bandera; la cámara sigue al de adelante y al que se queda atrás de la pantalla la cámara lo trae (aparece en la
// orilla). No hay vidas: el que se cae reaparece donde iba con un empujoncito. Cada ratito el que va hasta atrás
// recibe un turbo (¡así el más chiquito también puede ganar!). Con 1 jugador corren con él 2 de la compu; con 2, uno.
//   countdownMs: el letrero de la pista y luego 3, 2, 1.   lateMs: cuánto se espera a los demás después del primero.
//   helpEveryMs / helpGap: cada cuánto y desde qué tan atrás le toca turbo al último.   catchUpMs: cuánto puede estar
//   alguien atrás de la pantalla antes de que la cámara lo traiga.
export const RACE = {
  races: 3,
  countdownMs: 4000,
  respawnMs: 800,
  points: [4, 3, 2, 1],
  lateMs: 9000,
  humansDoneMs: 1500,
  helpEveryMs: 5000,
  helpGap: 7 * T,
  boostMs: 3000,
  pushMs: 1500,
  catchUpMs: 400,
};
const MEDALS = ['🥇', '🥈', '🥉', '4°', '5°', '6°'];
const CAMERA_LEAD = 0.62;

export class Race {
  constructor(scene) {
    this.scene = scene;
    // Las pistas de esta copa (3 de las 4, revueltas).
    this.order = Phaser.Utils.Array.Shuffle([...RACE_TRACKS.keys()]).slice(0, RACE.races);
    this.round = 0;
    this.points = new Map();
    this.cpus = [];
    const humans = scene.players.length;
    this.addCpus(Math.max(0, 3 - humans));
    for (const p of scene.players) this.points.set(p, 0);
  }

  // Los corredores de la compu: personajes que nadie escogió, con un color libre.
  addCpus(count) {
    const scene = this.scene;
    const taken = new Set(scene.players.map((p) => p.character));
    const free = Phaser.Utils.Array.Shuffle(CHARACTER_KEYS.filter((key) => !taken.has(key) && key !== 'bloquecito'));
    const colors = new Set(players.sorted().map((p) => p.colorIndex));
    for (let i = 0; i < count; i += 1) {
      const colorIndex = PLAYER_COLORS.findIndex((_, k) => !colors.has(k));
      colors.add(colorIndex);
      const character = free[i % free.length];
      const p = new Player(scene, { slot: 4 + i, deviceId: `cpu-carrera-${i}`, colorIndex }, character);
      p.cpu = true;
      p.bot = new RaceBot();
      p.input = p.bot.input;
      p.label = 'CPU';
      p.name = characterInfo(character)?.name ?? 'CPU';
      p.tag.setText('CPU');
      p.stats = { coins: 0, stomps: 0, bigCoins: 0 };
      p.sprite.setVisible(false);
      scene.players.push(p);
      this.cpus.push(p);
    }
  }

  get racers() {
    return this.scene.players;
  }

  // Empieza la carrera que sigue (todos chiquitos, sin poderes, en la salida).
  start() {
    const scene = this.scene;
    const index = this.order[this.round];
    this.track = RACE_TRACKS[index];
    this.finished = [];
    this.ms = 0;
    this.helpMs = 0;
    this.countdownMs = RACE.countdownMs;
    this.endMs = null;
    for (const p of this.racers) {
      Object.assign(p, { finished: false, finishMs: null, boostMs: 0, behindMs: 0, power: null, giantMs: 0, starMs: 0 });
      p.setSize('small');
      p.stats = { coins: 0, stomps: 0, bigCoins: 0 };
      p.bot?.reset();
    }
    scene.loadLevel({ spec: this.track, id: `carrera-${index + 1}`, world: null, index: null, race: true });
  }

  // La cuenta regresiva (nadie se mueve). Devuelve true mientras dure.
  countdown(dt) {
    if (this.countdownMs <= 0) return false;
    const before = Math.ceil(this.countdownMs / 1000);
    this.countdownMs -= dt;
    const now = Math.ceil(this.countdownMs / 1000);
    if (now !== before && now >= 1 && now <= 3) {
      this.scene.showBanner(String(now), '', 650);
      sfx.countdown();
    }
    if (this.countdownMs <= 0) {
      this.scene.showBanner('¡Fuera!', '', 700);
      sfx.confirm();
    }
    return true;
  }

  // Cada cuadro, después de mover a todos: el tiempo, el turbo del último, los que se quedaron atrás y quién llegó.
  update(dt) {
    this.ms += dt;
    this.updateHelp(dt);
    this.updatePlaces();
  }

  // El que va hasta atrás (y lejos del primero) recibe un turbo un ratito.
  updateHelp(dt) {
    this.helpMs += dt;
    if (this.helpMs < RACE.helpEveryMs) return;
    this.helpMs = 0;
    const racing = this.racers.filter((p) => p.state === 'play' && !p.finished);
    if (racing.length < 2) return;
    const leadX = Math.max(...this.racers.filter((p) => p.state !== 'off').map((p) => p.x));
    const last = racing.reduce((a, b) => (b.x < a.x ? b : a));
    if (leadX - last.x < RACE.helpGap) return;
    this.boost(last, RACE.boostMs);
    this.scene.talk.line(`¡Turbo para ${last.label}!`, { important: !last.cpu });
  }

  boost(p, ms) {
    p.boostMs = Math.max(p.boostMs ?? 0, ms);
    popText(this.scene, p.x, p.y - p.h - 30, '¡Turbo!', '#7dff7a');
    sparkles(this.scene, p.x, p.y - p.h / 2, 8, 50);
    sfx.boost();
  }

  // Las posiciones: primero los que ya llegaron (en orden), luego los que van más adelante.
  standings() {
    const rest = this.racers.filter((p) => !p.finished && p.state !== 'off').sort((a, b) => b.x - a.x);
    return [...this.finished, ...rest];
  }

  updatePlaces() {
    this.standings().forEach((p, i) => {
      const text = p.finished ? `${MEDALS[i]} ${p.label}` : `${i + 1}° ${p.label}`;
      if (p.tag.text !== text) p.tag.setText(text);
    });
  }

  // La cámara sigue al de adelante; al que se queda atrás de la pantalla la cámara lo trae.
  camera(dt) {
    const scene = this.scene;
    const cam = scene.cameras.main;
    const W = scene.scale.width;
    const live = this.racers.filter((p) => p.state !== 'off');
    if (!live.length) return;
    const leadX = Math.max(...live.map((p) => p.x));
    const target = Phaser.Math.Clamp(leadX - W * CAMERA_LEAD, 0, Math.max(0, scene.level.width - W));
    cam.scrollX += (target - cam.scrollX) * Math.min(1, dt / 120);
    for (const p of this.racers) {
      if (p.state !== 'play') continue;
      p.x = Math.min(p.x, cam.scrollX + W - 18);
      if (p.x > cam.scrollX + 10) {
        p.behindMs = 0;
        continue;
      }
      p.behindMs = (p.behindMs ?? 0) + dt;
      if (p.behindMs > RACE.catchUpMs) this.bringBack(p);
    }
  }

  // Un lugar seguro (piso sin lava ni picos) cerca de la orilla izquierda de la pantalla.
  safeSpotNearCamera() {
    const scene = this.scene;
    const level = scene.level;
    const cam = scene.cameras.main;
    for (let x = cam.scrollX + 2.5 * T; x < cam.scrollX + scene.scale.width / 2; x += T / 2) {
      const y = scene.groundY(x, 0);
      if (y >= level.height) continue;
      const ground = tileAt(level, x, y + 2);
      if (ground === 'L' || ground === '^' || isSolid(tileAt(level, x, y - T - 4))) continue;
      return { x, y };
    }
    return null;
  }

  bringBack(p) {
    const spot = this.safeSpotNearCamera();
    if (!spot) return;
    Object.assign(p, { x: spot.x, y: spot.y, vx: 0, vy: 0, behindMs: 0, invulnMs: 1200 });
    burst(this.scene, p.x, p.y - p.h / 2, 0xbfe9ff, 8);
    popText(this.scene, p.x, p.y - p.h - 20, '¡Apúrate!', '#ffffff');
  }

  // El que se cayó (o le pegaron) reaparece donde iba, con un empujoncito.
  updateDeaths() {
    const level = this.scene.level;
    for (const p of this.racers) {
      if (p.state !== 'dead' || p.deadMs < RACE.respawnMs) continue;
      const cam = this.scene.cameras.main;
      let spot = p.safeSpot(level);
      if (spot.x < cam.scrollX + T) spot = this.safeSpotNearCamera() ?? spot;
      p.spawn(spot.x, spot.y - 2);
      p.invulnMs = 1500;
      p.boostMs = RACE.pushMs;
    }
  }

  // ¿Alguien cruzó la bandera?
  checkFinish() {
    const scene = this.scene;
    const goal = scene.goal;
    if (!goal || this.endMs !== null) return;
    for (const p of this.racers) {
      if (p.state !== 'play' || p.finished || p.x < goal.x - 12) continue;
      p.finished = true;
      p.state = 'finished';
      p.finishMs = this.ms;
      p.vx = 0;
      this.finished.push(p);
      const place = this.finished.length;
      sparkles(scene, p.x, p.y - p.h, 10, 70);
      p.look.dance(6000);
      popText(scene, p.x, p.y - p.h - 40, `${MEDALS[place - 1]}`, '#ffd84d');
      if (place === 1) {
        sfx.win();
        scene.tweens.add({ targets: goal.flag, y: -40, duration: 900 });
        scene.talk.line(`¡${p.label} llegó primero!`, { important: true });
        if (!p.cpu) rewards.earn('plat-carrera');
      } else sfx.pickup();
    }
    // Se acaba cuando llegan todos, cuando ya llegaron todos los jugadores (un ratito después) o un rato después del
    // primero.
    if (!this.finished.length) return;
    const humansDone = this.racers.filter((p) => !p.cpu).every((p) => p.finished);
    const lastHuman = Math.max(...this.finished.filter((p) => !p.cpu).map((p) => p.finishMs), 0);
    const allDone = this.finished.length === this.racers.length;
    if (allDone || (humansDone && this.ms - lastHuman > RACE.humansDoneMs) || this.ms - this.finished[0].finishMs > RACE.lateMs) this.end();
  }

  // Los que ya llegaron festejan brincando en su lugar.
  celebrate(p, dt) {
    const scene = this.scene;
    p.boostMs = 0;
    if (p.onGround && Math.floor((this.ms - p.finishMs) / 600) % 2 === 0) p.vy = -380;
    p.vy = Math.min(900, p.vy + 2200 * (dt / 1000));
    p.y += p.vy * (dt / 1000);
    const ground = scene.groundY(p.x, p.y - p.h);
    if (p.y >= ground) {
      p.y = ground;
      p.vy = 0;
      p.onGround = true;
    } else p.onGround = false;
  }

  // Se acabó la carrera: puntos y la tabla (o, después de la última, el campeón de la copa).
  end() {
    const scene = this.scene;
    this.endMs = this.ms;
    const ranking = this.standings();
    ranking.forEach((p, i) => this.points.set(p, (this.points.get(p) ?? 0) + (RACE.points[i] ?? 0)));
    this.round += 1;
    const last = this.round >= RACE.races;
    const name = (p) => (p.cpu ? `${p.label} (${p.name})` : p.label);
    let title;
    let lines;
    if (!last) {
      title = `¡Ganó ${ranking[0].label}!`;
      lines = ranking.map((p, i) => `${MEDALS[i]}  ${name(p)}   +${RACE.points[i] ?? 0}   = ${this.points.get(p)} puntos`);
      lines.unshift(`Carrera ${this.round} de ${RACE.races}: ${this.track.name}`, '');
    } else {
      const table = [...this.points.entries()].sort((a, b) => b[1] - a[1]);
      const best = table[0][1];
      const champs = table.filter(([, pts]) => pts === best).map(([p]) => p);
      title = champs.length > 1 ? '¡Empate en la copa!' : `¡${champs[0].label} ganó la copa!`;
      lines = table.map(([p, pts], i) => `${MEDALS[i]}  ${name(p)}: ${pts} puntos`);
      confetti(
        scene,
        champs.map((p) => p.color),
      );
    }
    scene.phase = 'results';
    scene.endMs = 0;
    scene.nextAction = 'race';
    scene.showEndScreen(title, lines, last ? 'A = otra copa   ·   B = mapa' : 'A = siguiente carrera   ·   B = mapa', '🏁 Carreritas');
  }

  // A en la tabla: la siguiente carrera o, si ya fue la última, otra copa.
  next() {
    if (this.round >= RACE.races) {
      this.order = Phaser.Utils.Array.Shuffle([...RACE_TRACKS.keys()]).slice(0, RACE.races);
      this.round = 0;
      for (const p of this.racers) this.points.set(p, 0);
    }
    this.start();
  }

  hud() {
    const left = `🏁 Carrera ${Math.min(this.round + 1, RACE.races)} de ${RACE.races}`;
    const right = this.standings()
      .slice(0, 4)
      .map((p, i) => `${i + 1}° ${p.label}`)
      .join('  ');
    return { left, right };
  }

  // Se salen de las Carreritas: se van los de la compu y todos regresan a la normalidad.
  destroy() {
    const scene = this.scene;
    for (const p of this.cpus) p.destroy();
    scene.players = scene.players.filter((p) => !p.cpu);
    for (const p of scene.players) {
      Object.assign(p, { finished: false, boostMs: 0 });
      if (p.state === 'finished') p.state = 'play';
      p.tag.setText(p.label);
    }
  }
}

// Un corredor de la compu: corre a la derecha y brinca cuando hay pared, hoyo o enemigo enfrente (o si se atora). A
// ratos camina y a ratos corre (así alguien que corre todo el tiempo le gana).
export class RaceBot {
  constructor() {
    this.stickValue = { x: 1, y: 0 };
    this.presses = new Set();
    this.holds = new Set();
    this.reset();
    this.input = {
      stick: () => this.stickValue,
      pressed: (button) => this.presses.has(button),
      held: (button) => this.holds.has(button) || this.presses.has(button),
      numberStep: () => 0,
    };
  }

  reset() {
    this.jumpMs = 0;
    this.stuckMs = 0;
    this.running = false;
    this.runMs = 500 + Math.random() * 1000;
  }

  think(dtMs, scene, p) {
    this.presses.clear();
    this.holds.clear();
    this.stickValue = { x: 1, y: 0 };
    if (p.state !== 'play') return;
    this.runMs -= dtMs;
    if (this.runMs <= 0) {
      this.running = !this.running;
      this.runMs = this.running ? 1200 + Math.random() * 1500 : 900 + Math.random() * 1200;
    }
    if (this.running) this.holds.add('b');
    // Mientras va subiendo sostiene A (brinco alto).
    if (this.jumpMs > 0) {
      this.jumpMs -= dtMs;
      if (p.vy < 0) this.holds.add('a');
    }
    this.stuckMs = p.onGround && Math.abs(p.vx) < 30 ? this.stuckMs + dtMs : 0;
    if (!p.onGround) return;
    const level = scene.level;
    const ahead = p.x + p.w / 2 + 14;
    const wall = isSolid(tileAt(level, ahead, p.y - 10)) || isSolid(tileAt(level, ahead, p.y - T - 10));
    const hole = !groundBelow(level, p.x + T * 0.9, p.y) || ['L', '^'].includes(tileAt(level, p.x + T * 0.9, p.y + 2));
    const enemy = scene.enemies.some((e) => !e.dead && !e.gone && e.awake && e.x > p.x && e.x - p.x < 130 && Math.abs(e.y - p.y) < T * 1.6);
    if (wall || hole || enemy || this.stuckMs > 250) {
      this.presses.add('a');
      this.jumpMs = 420;
      this.stuckMs = 0;
    }
  }
}
