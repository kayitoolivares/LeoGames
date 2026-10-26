import * as THREE from 'three';
import { controls } from '../../shared/controls.js';
import { setTimeScale } from '../../shared/clock.js';
import { players, PLAYER_COLORS } from '../../shared/players.js';
import { sfx } from '../../shared/sound.js';
import { say } from '../../shared/voice.js';
import { rewards } from '../../shared/rewards.js';
import { hexToCss } from '../../ui/style.js';
import { createStage, WIDTH, HEIGHT } from '../three/stage.js';
import { Track } from '../three/track.js';
import { CARS } from './cars.js';
import { Kart, KART_RADIUS } from './Kart.js';
import { ITEMS, RaceItems } from './items.js';
import { RaceHud } from './hud.js';
import { RACE_CUPS, RACE_CUP_KEYS, RACE_POINTS, RACE_TRACKS, raceTrack, trackMapSvg } from './tracks.js';

const LAPS = 3;
const TOTAL_RACERS = 4;
const COUNTDOWN_STEP_MS = 800;
// Si un jugador se queda más lejos que esto del que va adelante, aparece junto al grupo.
const CATCH_UP_DISTANCE = 42;
// Tan lejos del camino (además de la mitad de la pista), se le regresa a la pista.
const RESCUE_MARGIN = 30;
const RESULTS_AFTER_FIRST_MS = 10000;
const RESULTS_INPUT_DELAY_MS = 1200;
const EXIT_HOLD_MS = 1200;
const CPU_LOOKAHEAD = 10;
const CPU_PUSH = 0.8;
// La compu usa su poder un ratito después de agarrarlo.
const CPU_ITEM_DELAY_MS = [1200, 4000];
// Los menús: tarjetas en filas de 4 (◀ ▶ de una en una, ▲ ▼ de fila en fila).
const MENU_COLUMNS = 4;
const MODES = [
  { key: 'rapida', emoji: '🏁', name: 'Carrera rápida', detail: 'Una carrera en la pista que escojas' },
  { key: 'campeonato', emoji: '🏆', name: 'Campeonato', detail: '4 carreras seguidas: gana quien junte más puntos' },
];

// "Carreras": 3 vueltas en 3D con una sola cámara que sigue al grupo (sin pantalla dividida, para que el Xbox One S
// dibuje una sola vez por cuadro). Los lugares vacíos los llenan carros CPU.
// Antes de correr: el modo (carrera rápida o campeonato de 4 carreras con puntos), la pista o la copa, y cada quien su
// carro (cars.js). En la pista hay cajas de regalo con poderes (items.js): X = usarlo.
export class RaceGame {
  constructor(parent, { onExit }) {
    this.onExit = onExit;
    this.exitMs = 0;
    this.exited = false;

    this.view = createStage(parent);
    this.renderer = this.view.renderer;
    this.hud = new RaceHud(this.view.stage);

    this.scene = new THREE.Scene();
    this.hemi = new THREE.HemisphereLight(0xffffff, 0x5a7a3a, 1.2);
    this.scene.add(this.hemi);
    const sun = new THREE.DirectionalLight(0xffffff, 1.6);
    sun.position.set(50, 100, 30);
    this.scene.add(sun);
    this.camera = new THREE.PerspectiveCamera(50, WIDTH / HEIGHT, 1, 500);
    this.cameraPos = new THREE.Vector3();
    this.cameraLook = new THREE.Vector3();

    this.modeIndex = 0;
    this.trackIndex = 0;
    this.cupIndex = 0;
    this.cup = null;
    this.createKarts();
    this.loadTrack(RACE_TRACKS[0]);
    this.placeOnGrid();
    this.updateCamera(0, true);
    this.openMenu('mode');
  }

  createKarts() {
    const humans = players.sorted();
    const taken = new Set(humans.map((player) => player.colorIndex));
    const cpuColors = PLAYER_COLORS.filter((_, i) => !taken.has(i));
    this.karts = humans.map((player) => new Kart({ color: players.color(player).hex, label: `J${player.slot + 1}`, deviceId: player.deviceId }));
    for (let i = 0; this.karts.length < TOTAL_RACERS; i += 1) {
      this.karts.push(new Kart({ color: cpuColors[i].hex, label: 'CPU' }));
    }
    this.karts.forEach((kart, i) => {
      // Cada CPU va por su propio carril para que no se amontonen.
      kart.lane = [-3.5, 3.5, -1, 1][i];
      this.scene.add(kart.object);
    });
    this.humans = this.karts.filter((kart) => !kart.isCpu);
  }

  // Arma la pista (y sus cajas). La anterior se quita y se libera (en el Xbox la memoria es poca).
  loadTrack(key) {
    if (this.world) {
      this.scene.remove(this.world);
      this.world.traverse((object) => {
        object.geometry?.dispose();
        for (const material of [].concat(object.material ?? [])) material.dispose();
      });
    }
    const look = raceTrack(key);
    this.trackKey = key;
    this.trackName = look.name;
    this.scene.background = new THREE.Color(look.sky);
    this.hemi.groundColor.setHex(look.groundLight);
    this.world = new THREE.Group();
    this.scene.add(this.world);
    this.track = new Track({ points: look.points, ground: look.ground, snowy: look.snowy, theme: look.theme });
    this.track.addTo(this.world);
    this.items = new RaceItems(this.world, this.track);
  }

  // Parrilla de salida: filas de 2 detrás de la meta, los jugadores adelante.
  placeOnGrid() {
    const n = this.track.count;
    this.karts.forEach((kart, i) => {
      const row = Math.floor(i / 2);
      const index = n - 8 - row * 8;
      const spot = this.track.pointAt(index, i % 2 === 0 ? -3.2 : 3.2);
      kart.reset(spot.x, spot.z, spot.heading, index);
      kart.progress = kart.lap + index / n;
    });
  }

  // ---------- Menús ----------
  openMenu(phase) {
    this.phase = phase;
    this.phaseMs = 0;
    if (phase === 'cars') {
      for (const kart of this.humans) kart.ready = false;
      this.placeOnGrid();
      say('¡Escojan su carro!');
    } else if (phase === 'mode') {
      say('Carreras');
    }
    this.showMenu();
  }

  menuCards() {
    if (this.phase === 'mode') return { title: '🏎️ Carreras', cards: MODES, index: this.modeIndex };
    if (this.cup) {
      const cards = RACE_CUP_KEYS.map((key) => {
        const cup = RACE_CUPS[key];
        return { emoji: cup.emoji, name: cup.name, detail: cup.tracks.map((track) => raceTrack(track).name).join(' · ') };
      });
      return { title: '🏆 Escoge la copa', cards, index: this.cupIndex };
    }
    const cards = RACE_TRACKS.map((key) => ({ emoji: raceTrack(key).emoji, name: raceTrack(key).name, art: trackMapSvg(key) }));
    return { title: '🗺️ Escoge la pista', cards, index: this.trackIndex };
  }

  showMenu() {
    if (this.phase === 'cars') {
      this.hud.showCars(
        this.humans.map((kart) => ({ label: kart.label, color: hexToCss(kart.color), car: kart.car, ready: kart.ready })),
        this.cup ? `${RACE_CUPS[this.cup.key].name}: ${this.trackName}` : this.trackName,
      );
      return;
    }
    const { title, cards, index } = this.menuCards();
    this.hud.showMenu(title, cards, index);
  }

  updateMenu() {
    const leader = this.humans[0];
    if (!leader) return;
    const id = leader.deviceId;
    const { cards, index } = this.menuCards();
    let step = 0;
    if (controls.justPressed(id, 'right')) step = 1;
    else if (controls.justPressed(id, 'left')) step = -1;
    else if (controls.justPressed(id, 'down') && cards.length > MENU_COLUMNS) step = MENU_COLUMNS;
    else if (controls.justPressed(id, 'up') && cards.length > MENU_COLUMNS) step = -MENU_COLUMNS;
    if (step) {
      const next = (index + step + cards.length) % cards.length;
      if (this.phase === 'mode') this.modeIndex = next;
      else if (this.cup) this.cupIndex = next;
      else this.trackIndex = next;
      sfx.select();
      say(cards[next].name);
      this.showMenu();
    }
    if (this.phaseMs < 250) return;
    if (controls.justPressed(id, 'a')) {
      sfx.confirm();
      if (this.phase === 'mode') {
        this.cup = MODES[this.modeIndex].key === 'campeonato' ? { key: null, race: 0, points: new Map() } : null;
        this.openMenu('pick');
      } else {
        if (this.cup) {
          this.cup.key = RACE_CUP_KEYS[this.cupIndex];
          this.loadTrack(RACE_CUPS[this.cup.key].tracks[0]);
        } else {
          this.loadTrack(RACE_TRACKS[this.trackIndex]);
        }
        this.openMenu('cars');
      }
    } else if (controls.justPressed(id, 'b')) {
      sfx.back();
      if (this.phase === 'mode') this.exit();
      else this.openMenu('mode');
    }
  }

  // Cada quien escoge su carro con ◀ ▶ y aprieta A cuando está listo; cuando todos están listos, ¡a correr!
  updateCars() {
    let changed = false;
    for (const kart of this.humans) {
      const id = kart.deviceId;
      if (!kart.ready) {
        const step = controls.justPressed(id, 'right') ? 1 : controls.justPressed(id, 'left') ? -1 : 0;
        if (step) {
          const index = (CARS.indexOf(kart.car) + step + CARS.length) % CARS.length;
          kart.setCar(CARS[index]);
          sfx.select();
          changed = true;
        }
      }
      if (this.phaseMs < 250) continue;
      if (controls.justPressed(id, 'a') && !kart.ready) {
        kart.ready = true;
        sfx.confirm();
        say(`¡${kart.label} listo con ${kart.car.name}!`);
        changed = true;
      } else if (controls.justPressed(id, 'b')) {
        if (kart.ready) {
          kart.ready = false;
          changed = true;
        } else if (kart === this.humans[0]) {
          sfx.back();
          this.openMenu('pick');
          return;
        }
      }
    }
    if (changed) this.showMenu();
    if (this.humans.every((kart) => kart.ready)) this.startRace();
  }

  // ---------- La carrera ----------
  startRace() {
    this.hud.hideMenu();
    // La compu escoge carro al azar en cada carrera.
    for (const kart of this.karts) if (kart.isCpu) kart.setCar(CARS[Math.floor(Math.random() * CARS.length)]);
    this.items.clear();
    this.placeOnGrid();
    this.phase = 'countdown';
    this.phaseMs = 0;
    this.raceMs = 0;
    this.finishOrder = [];
    this.firstHumanFinishMs = null;
    this.spokenStep = null;
    this.announcedLap = 0;
    this.hud.hideResults();
    if (this.cup) this.hud.flash(`${RACE_CUPS[this.cup.key].name}: carrera ${this.cup.race + 1} de 4`, 1500);
    this.updateCamera(0, true);
  }

  update(deltaMs) {
    const dtMs = Math.min(deltaMs, 50);
    this.phaseMs += dtMs;
    this.updateExit(dtMs);

    if (this.phase === 'mode' || this.phase === 'pick') this.updateMenu();
    else if (this.phase === 'cars') this.updateCars();
    else if (this.phase === 'countdown') this.updateCountdown();
    else if (this.phase === 'race') this.updateRace(dtMs);
    else if (this.phase === 'results') this.updateResults();

    const now = performance.now();
    for (const kart of this.karts) kart.render(now);
    this.updateCamera(dtMs / 1000);
    if (this.phase === 'countdown' || this.phase === 'race' || this.phase === 'results') this.updateStandings();
    this.renderer.render(this.scene, this.camera);
  }

  updateCountdown() {
    const step = Math.floor(this.phaseMs / COUNTDOWN_STEP_MS);
    if (step !== this.spokenStep) {
      this.spokenStep = step;
      say(step < 3 ? String(3 - step) : '¡Ya!');
    }
    if (step < 3) {
      this.hud.setCenter(String(3 - step));
      return;
    }
    this.hud.setCenter('');
    this.hud.flash('¡YA!', 900);
    this.phase = 'race';
    this.phaseMs = 0;
  }

  updateRace(dtMs) {
    this.raceMs += dtMs;
    const ranking = this.ranking();
    const halfRoad = this.track.roadWidth / 2;
    for (const kart of this.karts) {
      const input = kart.isCpu ? this.cpuInput(kart, dtMs) : this.humanInput(kart);
      const offroad = kart.trackDistance > halfRoad + 0.5;
      // Pequeña ayuda a los jugadores que van atrás, para que la carrera sea pareja.
      const bonus = kart.isCpu ? 1 : 1 + 0.04 * ranking.indexOf(kart);
      kart.update(dtMs, input, offroad, bonus);
      if (input.item && kart.item) this.useItem(kart, ranking);
      this.updateProgress(kart);
      if (kart.trackDistance > halfRoad + RESCUE_MARGIN) {
        kart.teleport(this.track.pointAt(kart.index), kart.index, 0);
        kart.trackDistance = 0;
      }
    }
    this.items.update(dtMs, this.karts, ranking, {
      onPick: (kart) => {
        sfx.pickup();
        if (!kart.isCpu) this.hud.flash(`${kart.label}: ${ITEMS[kart.item].emoji} ${ITEMS[kart.item].name}`, 1100);
        else kart.itemMs = CPU_ITEM_DELAY_MS[0] + Math.random() * (CPU_ITEM_DELAY_MS[1] - CPU_ITEM_DELAY_MS[0]);
      },
      onHit: (kart, by) => this.onItemHit(kart, by),
    });
    this.separateKarts();
    this.catchUpStragglers();

    const humansDone = this.humans.every((kart) => kart.finished);
    const waitedEnough = this.firstHumanFinishMs !== null && this.raceMs - this.firstHumanFinishMs > RESULTS_AFTER_FIRST_MS;
    if (humansDone || waitedEnough) this.showResults();
  }

  useItem(kart, ranking) {
    const place = ranking.indexOf(kart);
    const item = kart.item;
    // El cohete va por el de adelante (si va primero, sale derecho y no le pega a nadie).
    const ahead = place > 0 ? ranking[place - 1] : null;
    this.items.use(kart, ahead && !ahead.finished ? ahead : null);
    if (item === 'cohete' && ahead && !kart.isCpu) this.rocketFrom = kart;
  }

  onItemHit(kart, by) {
    const spun = kart.hit();
    if (!spun) {
      sfx.block();
      if (!kart.isCpu) this.hud.flash(`🛡️ ¡El escudo de ${kart.label} aguantó!`, 1000);
      return;
    }
    sfx.hit(0.6);
    if (!kart.isCpu) this.hud.flash(by === 'aceite' ? `¡${kart.label} se resbaló!` : `¡Cohetazo a ${kart.label}!`, 1000);
    if (by === 'cohete' && this.rocketFrom && !this.rocketFrom.isCpu) {
      rewards.earn('carrera-cohete');
      this.rocketFrom = null;
    }
  }

  humanInput(kart) {
    const stick = controls.getStick(kart.deviceId);
    return {
      x: stick.x,
      y: stick.y,
      turbo: controls.justPressed(kart.deviceId, 'a'),
      brake: controls.isDown(kart.deviceId, 'b'),
      item: controls.justPressed(kart.deviceId, 'x'),
    };
  }

  // La CPU apunta a un punto un poco más adelante sobre su carril.
  cpuInput(kart, dtMs) {
    const target = this.track.pointAt(kart.index + CPU_LOOKAHEAD, kart.lane);
    const dx = target.x - kart.x;
    const dz = target.z - kart.z;
    const dist = Math.hypot(dx, dz) || 1;
    let item = false;
    if (kart.item) {
      kart.itemMs = (kart.itemMs ?? 0) - dtMs;
      item = kart.itemMs <= 0;
      if (item) kart.itemMs = CPU_ITEM_DELAY_MS[0];
    }
    return {
      x: (dx / dist) * CPU_PUSH,
      y: (dz / dist) * CPU_PUSH,
      turbo: kart.turboReady() && Math.random() < 0.004,
      brake: false,
      item,
    };
  }

  // Avance en la pista y conteo de vueltas: una vuelta cuenta al cruzar la meta
  // solo si antes pasó por la mitad de la pista.
  updateProgress(kart) {
    const n = this.track.count;
    const { index, distance } = this.track.closest(kart.x, kart.z, kart.index);
    const prev = kart.index;
    if (prev > n * 0.85 && index < n * 0.15) {
      if (kart.crossedHalf) {
        kart.lap += 1;
        kart.crossedHalf = false;
        this.onLap(kart);
      }
    } else if (prev < n * 0.15 && index > n * 0.85) {
      // Cruzó la meta en reversa.
      kart.lap -= 1;
      kart.crossedHalf = true;
    }
    if (index > n * 0.4 && index < n * 0.6) kart.crossedHalf = true;
    kart.index = index;
    kart.trackDistance = distance;
    kart.progress = kart.lap + index / n;
  }

  onLap(kart) {
    if (kart.lap >= LAPS && !kart.finished) {
      kart.finished = true;
      this.finishOrder.push(kart);
      if (!kart.isCpu && this.finishOrder.length === 1) rewards.earn('carrera-gana');
      if (!kart.isCpu) {
        // El primer jugador que llega: un ratito en cámara lenta.
        if (this.firstHumanFinishMs === null) setTimeScale(0.35, 1200);
        if (this.firstHumanFinishMs === null) this.firstHumanFinishMs = this.raceMs;
        const message = `¡${kart.label} llegó en ${this.finishOrder.length}° lugar!`;
        this.hud.flash(message);
        say(message);
      }
      return;
    }
    // Anuncia la vuelta cuando el primer jugador la empieza.
    if (!kart.isCpu && kart.lap > this.announcedLap && kart.lap < LAPS) {
      this.announcedLap = kart.lap;
      const message = kart.lap === LAPS - 1 ? '¡Última vuelta!' : `Vuelta ${kart.lap + 1} de ${LAPS}`;
      this.hud.flash(message);
      say(message);
    }
  }

  // Los carros se empujan al chocar: el más pesado (cars.js) mueve más al otro.
  separateKarts() {
    const list = this.karts;
    for (let i = 0; i < list.length; i += 1) {
      for (let j = i + 1; j < list.length; j += 1) {
        const a = list[i];
        const b = list[j];
        const dx = b.x - a.x;
        const dz = b.z - a.z;
        const dist = Math.hypot(dx, dz) || 0.01;
        const min = KART_RADIUS * 2;
        if (dist >= min) continue;
        const overlap = min - dist;
        const share = b.car.weight / (a.car.weight + b.car.weight);
        a.x -= (dx / dist) * overlap * share;
        a.z -= (dz / dist) * overlap * share;
        b.x += (dx / dist) * overlap * (1 - share);
        b.z += (dz / dist) * overlap * (1 - share);
        a.speed *= 0.97;
        b.speed *= 0.97;
      }
    }
  }

  // Los jugadores que se quedan muy atrás aparecen detrás del que va adelante,
  // así la cámara siempre los muestra a todos y nadie se queda solo.
  catchUpStragglers() {
    const racing = this.humans.filter((kart) => !kart.finished);
    if (racing.length < 2) return;
    const leader = racing.reduce((best, kart) => (kart.progress > best.progress ? kart : best));
    const n = this.track.count;
    racing.forEach((kart, i) => {
      if (kart === leader || Math.hypot(kart.x - leader.x, kart.z - leader.z) < CATCH_UP_DISTANCE) return;
      const raw = leader.index - 6 - 4 * i;
      const index = (raw + n) % n;
      kart.teleport(this.track.pointAt(index, kart.lane), index, leader.speed * 0.7);
      // Si quedó detrás de la meta, todavía le falta cruzarla.
      const wrapped = raw < 0;
      kart.lap = wrapped ? leader.lap - 1 : leader.lap;
      kart.crossedHalf = wrapped ? true : leader.crossedHalf;
      kart.progress = kart.lap + index / n;
      kart.trackDistance = 0;
    });
  }

  ranking() {
    const rest = this.karts.filter((kart) => !kart.finished).sort((a, b) => b.progress - a.progress);
    return [...this.finishOrder, ...rest];
  }

  updateStandings() {
    const rows = this.ranking().map((kart, i) => ({
      position: i + 1,
      label: kart.label,
      color: hexToCss(kart.color),
      status: kart.finished ? '¡Meta!' : `Vuelta ${Math.min(LAPS, Math.max(1, kart.lap + 1))}/${LAPS}`,
      turbo: !kart.isCpu && kart.turboReady(),
      item: !kart.isCpu && kart.item ? `${ITEMS[kart.item].emoji}${kart.itemUses > 1 ? `×${kart.itemUses}` : ''}` : '',
    }));
    this.hud.setStandings(rows);
  }

  showResults() {
    this.phase = 'results';
    this.phaseMs = 0;
    const ranking = this.ranking();
    const rows = ranking.map((kart) => ({ label: kart.label, color: hexToCss(kart.color), car: kart.car.name }));
    if (!this.cup) {
      this.hud.showResults('¡Llegaron!', rows, null, 'A = otra carrera  ·  B = escoger otra pista  ·  Mantén LB + RB + Y = salir');
      say(`¡Ganó ${ranking[0].label}!`);
      return;
    }
    // Campeonato: puntos según el lugar y la tabla de cómo van.
    ranking.forEach((kart, i) => this.cup.points.set(kart, (this.cup.points.get(kart) ?? 0) + RACE_POINTS[i]));
    this.cup.race += 1;
    const table = this.cupTable();
    const done = this.cup.race >= RACE_CUPS[this.cup.key].tracks.length;
    if (done) {
      const champion = table[0];
      this.hud.showResults(`🏆 ¡${champion.label} es campeón!`, rows, table, 'A = otro campeonato  ·  Mantén LB + RB + Y = salir');
      say(`¡${champion.label} ganó la ${RACE_CUPS[this.cup.key].name}!`);
      sfx.win();
      if (!champion.kart.isCpu) rewards.earn('carrera-copa');
    } else {
      this.hud.showResults(`Carrera ${this.cup.race} de 4`, rows, table, 'A = siguiente carrera  ·  Mantén LB + RB + Y = salir');
      say(`¡Ganó ${ranking[0].label}! Va ganando ${table[0].label}`);
    }
  }

  // La tabla del campeonato: de más a menos puntos.
  cupTable() {
    return [...this.cup.points.entries()]
      .sort(([, a], [, b]) => b - a)
      .map(([kart, points]) => ({ kart, label: kart.label, color: hexToCss(kart.color), points }));
  }

  updateResults() {
    // Los carros se detienen solos mientras se ven los resultados.
    for (const kart of this.karts) kart.speed *= 0.9;
    if (this.phaseMs < RESULTS_INPUT_DELAY_MS) return;
    const pressed = (button) => this.humans.some((kart) => controls.justPressed(kart.deviceId, button));
    if (pressed('a')) {
      if (this.cup && this.cup.race >= RACE_CUPS[this.cup.key].tracks.length) {
        // Otro campeonato: de regreso a escoger la copa.
        this.hud.hideResults();
        this.cup = { key: null, race: 0, points: new Map() };
        this.openMenu('pick');
      } else if (this.cup) {
        this.hud.hideResults();
        this.loadTrack(RACE_CUPS[this.cup.key].tracks[this.cup.race]);
        this.startRace();
      } else {
        this.startRace();
      }
    } else if (pressed('b') && !this.cup) {
      this.hud.hideResults();
      this.openMenu('pick');
    }
  }

  // Cámara desde arriba que encuadra a todos los jugadores; se aleja cuando están separados. Al escoger carro, de cerca.
  updateCamera(dt, snap = false) {
    const focus = this.humans.length > 0 ? this.humans : this.karts;
    const cx = focus.reduce((sum, k) => sum + k.x, 0) / focus.length;
    const cz = focus.reduce((sum, k) => sum + k.z, 0) / focus.length;
    const spread = Math.max(...focus.map((k) => Math.hypot(k.x - cx, k.z - cz)));
    const picking = this.phase === 'cars';
    const close = picking ? 14 : 30;
    const height = Math.min(70, Math.max(close + 4, close + spread * 0.9));
    const desiredPos = new THREE.Vector3(cx, height, cz + height * 0.7);
    // (Al escoger, los carros van más abajo en la pantalla para que no los tape el menú.)
    const desiredLook = new THREE.Vector3(cx, 0, cz - (picking ? 9 : 4));
    const blend = snap ? 1 : 1 - Math.pow(0.03, dt);
    this.cameraPos.lerp(desiredPos, blend);
    this.cameraLook.lerp(desiredLook, blend);
    this.camera.position.copy(this.cameraPos);
    this.camera.lookAt(this.cameraLook);
  }

  updateExit(dtMs) {
    const holding = this.humans.some((kart) => controls.holdingExit(kart.deviceId));
    this.exitMs = holding ? this.exitMs + dtMs : 0;
    this.hud.setExitProgress(Math.min(1, this.exitMs / EXIT_HOLD_MS));
    if (this.exitMs >= EXIT_HOLD_MS) this.exit();
  }

  exit() {
    if (this.exited) return;
    this.exited = true;
    this.onExit();
  }

  destroy() {
    for (const kart of this.karts) kart.destroy();
    this.hud.destroy();
    this.view.destroy(this.scene);
  }
}
