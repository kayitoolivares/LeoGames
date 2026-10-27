import * as THREE from 'three';
import { controls } from '../../shared/controls.js';
import { setTimeScale } from '../../shared/clock.js';
import { players, PLAYER_COLORS } from '../../shared/players.js';
import { sfx } from '../../shared/sound.js';
import { say } from '../../shared/voice.js';
import { rewards } from '../../shared/rewards.js';
import { characterPicks } from '../../shared/picks.js';
import { hexToCss } from '../../ui/style.js';
import { defaultCharacter } from '../../scenes/CharacterSelectScene.js';
import { CHARACTER_KEYS } from '../smash/characters.js';
import { DriverArt, driverView } from '../kart/drivers.js';
import { createStage, WIDTH, HEIGHT } from '../three/stage.js';
import { Track } from '../three/track.js';
import { CARS } from './cars.js';
import { REX_CATCH, REX_START_BEHIND, Rex } from './chase.js';
import { Kart, KART_RADIUS } from './Kart.js';
import { ITEMS, RaceItems } from './items.js';
import { RaceHud } from './hud.js';
import { PAD_LENGTH, buildShortcut, findShortcut, shortcutProgress } from './shortcut.js';
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
  { key: 'persecucion', emoji: '🦖', name: 'Persecución', detail: '¡Que no te alcance el Rey Rex! Gana el último que quede' },
];
// La compu toma el atajo una de cada tantas vueltas.
const CPU_SHORTCUT_ODDS = 0.45;
// En la persecución: cuando el Rey Rex está así de cerca de un jugador, se le avisa (y la cámara lo enseña).
const REX_WARN = 22;
const REX_SHOW = 45;

// "Carreras": 3 vueltas en 3D con una sola cámara que sigue al grupo (sin pantalla dividida, para que el Xbox One S
// dibuje una sola vez por cuadro). Los lugares vacíos los llenan carros CPU.
// Antes de correr: el modo (carrera rápida, campeonato de 4 carreras con puntos o la persecución del Rey Rex), la pista
// o la copa, y cada quien su carro (cars.js), manejado por el personaje que escogió. En la pista hay cajas de regalo
// con poderes (items.js): X = usarlo. Cada pista tiene un atajo de tierra (shortcut.js).
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
    this.chase = false;
    this.drivers = new DriverArt();
    this.createKarts();
    this.loadTrack(RACE_TRACKS[0]);
    this.placeOnGrid();
    this.updateCamera(0, true);
    this.openMenu('mode');
  }

  // Los carros: los jugadores manejados por el personaje que escogieron; la compu, por otros al azar.
  createKarts() {
    const humans = players.sorted();
    const taken = new Set(humans.map((player) => player.colorIndex));
    const cpuColors = PLAYER_COLORS.filter((_, i) => !taken.has(i));
    const drivers = this.drivers;
    this.karts = humans.map((player) => {
      const character = characterPicks.get(player.deviceId, defaultCharacter(player));
      return new Kart({ color: players.color(player).hex, label: `J${player.slot + 1}`, deviceId: player.deviceId, character, drivers });
    });
    const picked = new Set(this.karts.map((kart) => kart.character));
    const free = CHARACTER_KEYS.filter((key) => !picked.has(key)).sort(() => Math.random() - 0.5);
    for (let i = 0; this.karts.length < TOTAL_RACERS; i += 1) {
      this.karts.push(new Kart({ color: cpuColors[i].hex, label: 'CPU', character: free[i % free.length], drivers }));
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
        for (const material of [].concat(object.material ?? [])) {
          material.map?.dispose();
          material.dispose();
        }
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
    // El atajo: sin árboles encima.
    this.shortcut = findShortcut(this.track);
    if (this.shortcut) {
      const { from, to } = this.shortcut;
      this.track.theme.clear = [...(this.track.theme.clear ?? []), { x1: from.x, z1: from.z, x2: to.x, z2: to.z, radius: 7 }];
      this.world.add(buildShortcut(this.shortcut));
    }
    this.track.addTo(this.world);
    this.items = new RaceItems(this.world, this.track);
    this.rex?.dispose();
    this.rex = new Rex(this.world, this.track);
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
      const where = this.cup ? `${RACE_CUPS[this.cup.key].name}: ${this.trackName}` : this.chase ? `🦖 Persecución: ${this.trackName}` : this.trackName;
      this.hud.showCars(
        this.humans.map((kart) => ({ label: kart.label, color: hexToCss(kart.color), car: kart.car, ready: kart.ready, image: kart.driver.imageUrl })),
        where,
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
        this.chase = MODES[this.modeIndex].key === 'persecucion';
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
    for (const kart of this.karts) {
      kart.object.scale.setScalar(1);
      kart.wantsShortcut = Math.random() < CPU_SHORTCUT_ODDS;
      kart.shortcutRun = false;
    }
    this.phase = 'countdown';
    this.phaseMs = 0;
    this.raceMs = 0;
    this.finishOrder = [];
    this.caughtOrder = [];
    this.firstHumanFinishMs = null;
    this.spokenStep = null;
    this.announcedLap = 0;
    this.shortcutSeen = false;
    this.hud.hideResults();
    if (this.cup) this.hud.flash(`${RACE_CUPS[this.cup.key].name}: carrera ${this.cup.race + 1} de 4`, 1500);
    // La persecución: el Rey Rex empieza detrás del último.
    if (this.chase) {
      this.rex.reset(Math.min(...this.karts.map((kart) => kart.progress * this.track.count)) - REX_START_BEHIND / this.track.spacing);
      this.hud.flash('🦖 ¡Que no los alcance el Rey Rex!', 1800);
    } else {
      this.rex.hide();
    }
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
    for (const kart of this.karts) {
      kart.render(now);
      kart.driver.show(driverView(kart, this.camera));
      // Al que atrapa el Rey Rex se va haciendo chiquito hasta desaparecer.
      if (kart.caught) {
        kart.caughtMs += dtMs;
        kart.object.scale.setScalar(Math.max(0.01, 1 - kart.caughtMs / 700));
      }
    }
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
      if (kart.caught) continue;
      const input = kart.isCpu ? this.cpuInput(kart, dtMs) : this.humanInput(kart);
      // En el atajo el pasto no frena (es camino de tierra).
      const along = this.shortcut ? shortcutProgress(this.shortcut, kart.x, kart.z) : null;
      const offroad = along === null && kart.trackDistance > halfRoad + 0.5;
      // Pequeña ayuda a los jugadores que van atrás, para que la carrera sea pareja.
      const bonus = kart.isCpu ? 1 : 1 + 0.04 * ranking.indexOf(kart);
      kart.update(dtMs, input, offroad, bonus);
      if (input.item && kart.item) this.useItem(kart, ranking);
      this.updateProgress(kart, along);
      if (along !== null) this.onShortcut(kart, along);
      if (along === null && kart.trackDistance > halfRoad + RESCUE_MARGIN) {
        kart.teleport(this.track.pointAt(kart.index), kart.index, 0);
        kart.trackDistance = 0;
        kart.shortcutRun = false;
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
    if (this.chase) {
      this.updateChase(dtMs);
      return;
    }
    this.catchUpStragglers();

    const humansDone = this.humans.every((kart) => kart.finished);
    const waitedEnough = this.firstHumanFinishMs !== null && this.raceMs - this.firstHumanFinishMs > RESULTS_AFTER_FIRST_MS;
    if (humansDone || waitedEnough) this.showResults();
  }

  // En el atajo: la flecha de la mitad da un turbo (y la primera vez que un jugador lo toma, se festeja).
  onShortcut(kart, along) {
    const pad = PAD_LENGTH / 2 / this.shortcut.length;
    if (Math.abs(along - 0.5) > pad || kart.turboMs > 0) return;
    kart.boost();
    if (kart.isCpu) return;
    sfx.boost();
    if (!this.shortcutSeen) {
      this.shortcutSeen = true;
      this.hud.flash(`¡${kart.label} encontró el atajo!`, 1300);
      say('¡Atajo!');
    }
  }

  // ---------- La persecución ----------
  updateChase(dtMs) {
    const n = this.track.count;
    const running = this.karts.filter((kart) => !kart.caught);
    const last = Math.min(...running.map((kart) => kart.progress * n));
    this.rex.update(dtMs, last);
    for (const kart of running) {
      const gap = (kart.progress * n - this.rex.at) * this.track.spacing;
      if (gap < REX_CATCH) this.catchKart(kart);
      else if (!kart.isCpu && gap < REX_WARN && !kart.warned) {
        kart.warned = true;
        this.hud.flash(`¡Corre, ${kart.label}! 🦖`, 1000);
      } else if (gap > REX_WARN * 2) {
        kart.warned = false;
      }
    }
    const left = this.karts.filter((kart) => !kart.caught);
    if (left.length <= 1 || !this.humans.some((kart) => !kart.caught)) this.showChaseResults();
  }

  catchKart(kart) {
    kart.caught = true;
    kart.caughtMs = 0;
    kart.speed = 0;
    kart.item = null;
    this.caughtOrder.push(kart);
    sfx.ko();
    const message = `🦖 ¡El Rey Rex atrapó a ${kart.label}!`;
    this.hud.flash(message, 1300);
    if (!kart.isCpu) say(`¡Atrapado ${kart.label}!`);
  }

  showChaseResults() {
    this.phase = 'results';
    this.phaseMs = 0;
    const ranking = this.ranking();
    const winner = ranking[0];
    const rows = ranking.map((kart) => ({ label: kart.label, color: hexToCss(kart.color), car: kart.caught ? '🦖 atrapado' : '¡Se escapó!' }));
    const title = winner.isCpu ? '🦖 ¡Los atrapó a todos!' : `🦖 ¡${winner.label} se escapó!`;
    this.hud.showResults(title, rows, null, 'A = otra persecución  ·  B = escoger otra pista  ·  Mantén LB + RB + Y = salir');
    say(winner.isCpu ? '¡El Rey Rex los atrapó a todos!' : `¡${winner.label} se escapó del Rey Rex!`);
    if (!winner.isCpu) {
      sfx.win();
      rewards.earn('carrera-persecucion');
    }
  }

  useItem(kart, ranking) {
    const place = ranking.indexOf(kart);
    const item = kart.item;
    // El cohete va por el de adelante (si va primero, sale derecho y no le pega a nadie).
    const ahead = place > 0 ? ranking[place - 1] : null;
    this.items.use(kart, ahead && !ahead.finished && !ahead.caught ? ahead : null);
    if (item === 'cohete' && ahead && !kart.isCpu) this.rocketFrom = kart;
    if (item === 'estrella' && !kart.isCpu) say('¡Estrella!');
    // El rayo: a todos los demás (los que siguen corriendo) les cae un rayo.
    if (item === 'rayo') {
      this.hud.lightning();
      sfx.laser();
      for (const other of this.karts) if (other !== kart && !other.finished && !other.caught) this.onItemHit(other, 'rayo');
    }
  }

  onItemHit(kart, by) {
    if (kart.caught) return;
    const spun = kart.hit();
    if (!spun) {
      sfx.block();
      if (!kart.isCpu && kart.starMs === 0) this.hud.flash(`🛡️ ¡El escudo de ${kart.label} aguantó!`, 1000);
      return;
    }
    sfx.hit(0.6);
    const messages = {
      aceite: '¡{} se resbaló!',
      cohete: '¡Cohetazo a {}!',
      bomba: '¡Bombazo a {}!',
      rayo: '¡Le cayó un rayo a {}!',
      estrella: '¡Estrellazo a {}!',
    };
    if (!kart.isCpu) this.hud.flash((messages[by] ?? messages.cohete).replace('{}', kart.label), 1000);
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

  // La CPU apunta a un punto un poco más adelante sobre su carril (o, si le tocó tomar el atajo, a su salida).
  cpuInput(kart, dtMs) {
    let target = this.track.pointAt(kart.index + CPU_LOOKAHEAD, kart.lane);
    const shortcut = this.shortcut;
    if (shortcut && kart.wantsShortcut && !kart.shortcutRun && kart.index >= shortcut.a - 4 && kart.index <= shortcut.a) kart.shortcutRun = true;
    if (kart.shortcutRun) {
      if (kart.index >= shortcut.b - 2 || kart.index < shortcut.a - 6) {
        kart.shortcutRun = false;
        kart.wantsShortcut = Math.random() < CPU_SHORTCUT_ODDS;
      } else {
        target = this.track.pointAt(shortcut.b + 4, 0);
      }
    }
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
  // solo si antes pasó por la mitad de la pista. En el atajo (`along`, de 0 a 1), avanza como si fuera por la pista.
  updateProgress(kart, along = null) {
    const n = this.track.count;
    let { index, distance } = this.track.closest(kart.x, kart.z, kart.index);
    if (along !== null) [index, distance] = [Math.round(this.shortcut.a + (this.shortcut.b - this.shortcut.a) * along), 0];
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
    // (En la persecución no hay meta: se corre hasta que el Rey Rex los alcance.)
    if (this.chase) return;
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

  // Los carros se empujan al chocar: el más pesado (cars.js) mueve más al otro. El que trae estrella hace girar al otro.
  separateKarts() {
    const list = this.karts.filter((kart) => !kart.caught);
    for (let i = 0; i < list.length; i += 1) {
      for (let j = i + 1; j < list.length; j += 1) {
        const a = list[i];
        const b = list[j];
        const dx = b.x - a.x;
        const dz = b.z - a.z;
        const dist = Math.hypot(dx, dz) || 0.01;
        const min = KART_RADIUS * 2;
        if (dist >= min) continue;
        for (const [star, other] of [
          [a, b],
          [b, a],
        ]) {
          if (star.starMs > 0 && other.starMs === 0 && other.spinMs === 0) this.onItemHit(other, 'estrella');
        }
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

  // De primero a último (en la persecución: los que siguen corriendo y luego los atrapados, del último al primero).
  ranking() {
    const rest = this.karts.filter((kart) => !kart.finished && !kart.caught).sort((a, b) => b.progress - a.progress);
    return [...this.finishOrder, ...rest, ...[...(this.caughtOrder ?? [])].reverse()];
  }

  // Qué dice junto a cada quien: su vuelta (en la persecución, qué tan lejos trae al Rey Rex).
  status(kart) {
    if (kart.finished) return '¡Meta!';
    if (!this.chase) return `Vuelta ${Math.min(LAPS, Math.max(1, kart.lap + 1))}/${LAPS}`;
    if (kart.caught) return '🦖 ¡Atrapado!';
    return `🦖 a ${Math.max(0, Math.round((kart.progress * this.track.count - this.rex.at) * this.track.spacing))} m`;
  }

  updateStandings() {
    const rows = this.ranking().map((kart, i) => ({
      position: i + 1,
      label: kart.label,
      color: hexToCss(kart.color),
      status: this.status(kart),
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
  // En la persecución: los que siguen corriendo (y el Rey Rex, cuando ya viene cerca).
  updateCamera(dt, snap = false) {
    let focus = this.humans.length > 0 ? this.humans : this.karts;
    if (this.chase && this.phase !== 'cars') {
      const running = focus.filter((kart) => !kart.caught);
      focus = running.length ? running : this.karts.filter((kart) => !kart.caught);
      if (!focus.length) focus = this.karts;
      const rex = this.rex.group.position;
      if (this.rex.group.visible && focus.some((kart) => Math.hypot(kart.x - rex.x, kart.z - rex.z) < REX_SHOW)) focus = [...focus, rex];
    }
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
    this.drivers.dispose();
    this.rex.dispose();
    this.hud.destroy();
    this.view.destroy(this.scene);
  }
}
