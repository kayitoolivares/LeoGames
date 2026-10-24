import * as THREE from 'three';
import { controls } from '../../shared/controls.js';
import { setTimeScale } from '../../shared/clock.js';
import { music } from '../../shared/music.js';
import { createEngine, sfx } from '../../shared/sound.js';
import { players, PLAYER_COLORS } from '../../shared/players.js';
import { say } from '../../shared/voice.js';
import { UNLOCKS, rewards } from '../../shared/rewards.js';
import { hexToCss } from '../../ui/style.js';
import { createStage, WIDTH, HEIGHT } from '../three/stage.js';
import { Track } from '../three/track.js';
import { BULLET_MS, GHOST_MS, INK_MS, Racer, RACER_RADIUS, NITRO_CHARGES, SHIELD_MS, SPARK_COLORS as DRIFT_COLORS, STAR_MS, THROW_POSE_MS } from './Racer.js';
import { ItemBoxes, Projectiles, ITEMS, rollItem } from './items.js';
import { KartHud } from './hud.js';
import manifest from './art.json';
import { TrackChooser } from './chooser.js';
import { Arena, Battle, BATTLE_RACERS } from './battle.js';
import { Ceremony } from './ceremony.js';
import { Coins } from './coins.js';
import { Particles } from './particles.js';
import { DriverArt, driverView } from './drivers.js';
import { TrackFeatures } from './features.js';
import { Hazards } from './hazards.js';
import { Garage } from './garage.js';
import { kartPicks, randomSetup, wallet } from './karts.js';
import { Snowfall, addScenery, addSnowmen } from './scenery.js';
import { CUPS, CUP_KEYS, CUP_POINTS, TRACKS, TRACK_KEYS } from './tracks.js';
import { Shortcut } from './shortcut.js';
import { WEATHERS, WEATHER_KEYS, Weather } from './weather.js';
import { GhostKart, GhostRecorder, TIME_TRIAL_LAPS, formatTime, loadRecord, recordKey, saveRecord } from './ghost.js';
import { FinishReplay } from './replay.js';
import { RaceTalk, assignPersonalities, nameOf, personalityOf, rivalPush } from './rivals.js';
import { numberStep } from '../smash/bloquecito.js';
import { CHARACTER_KEYS } from '../smash/characters.js';

const TOTAL_RACERS = 6;
const COUNTDOWN_STEP_MS = 800;
const GO_MS = 700;
const HELP_MS = 6000;
const ROLL_MS = 1000;
const WRONG_WAY_MS = 1200;
const RESULTS_AFTER_FIRST_MS = 12000;
const RESULTS_INPUT_DELAY_MS = 1200;
const EXIT_HOLD_MS = 1200;
const CPU_LOOKAHEAD = 12;
// Nivel de la compu: qué tan fuerte acelera, cuánto se ayuda a los jugadores que van atrás (por cada lugar),
// qué tan seguido sale con arranque turbo y usa el nitro.
const LEVELS = {
  facil: { name: 'Fácil', gas: 0.78, help: 0.05, startBoost: 0.15, nitro: 0.003 },
  normal: { name: 'Normal', gas: 0.86, help: 0.03, startBoost: 0.35, nitro: 0.006 },
  dificil: { name: 'Difícil', gas: 0.95, help: 0.012, startBoost: 0.6, nitro: 0.012 },
};
const LEVEL_KEYS = Object.keys(LEVELS);
// Velocidad de la carrera (X en las pantallas de escoger). Espejo: las pistas al revés, rapidísimo (se abre al ganar
// una copa del Gran Premio).
const SPEEDS = {
  lento: { name: 'Lento 🐢', factor: 0.82 },
  normal: { name: 'Normal', factor: 1 },
  rapido: { name: 'Rapidísimo 🔥', factor: 1.2 },
  espejo: { name: 'Espejo 🪞', factor: 1.2, mirror: true, unlock: 'kart-espejo' },
};
const SPEED_KEYS = Object.keys(SPEEDS);
// Rebufo: pegadito detrás de otro (en línea) un ratito, da un turbito.
const DRAFT = { min: 3.5, max: 15, angle: 0.22, speed: 18, ms: 1100, factor: 1.3, boostMs: 900 };
// Qué tan seguido la compu se mete al atajo (según su nivel; también cuenta su personalidad).
const CPU_SHORTCUT = { facil: 0.1, normal: 0.35, dificil: 0.6 };
const CONFETTI_COLORS = [0xff5a5f, 0xffc93c, 0x4cd97b, 0x3fa7ff, 0xb07cff, 0xffffff];
const SPLASH_COLORS = [0xdff4ff, 0x9fd8ff, 0xffffff];
const LAP_CHOICES = [1, 2, 3];
// Arranque turbo: acelerar cuando sale el "1" de la cuenta regresiva (ni antes ni después).
const START_WINDOW_MS = [COUNTDOWN_STEP_MS * 2.1, COUNTDOWN_STEP_MS * 3];
const START_BOOST = { factor: 1.55, ms: 1200 };
// Efectos: estrellitas al pegarle a alguien, brillitos de colores al agarrar una cajita y dorados con las monedas.
const HIT_COLORS = [0xffd84d, 0xffffff, 0xff9a3c];
const BOX_COLORS = [0xff5a5f, 0xffc93c, 0x4cd97b, 0x3fa7ff, 0xb07cff];
const COIN_COLORS = [0xffd84d, 0xfff3b0];
const SPARK_COLORS = [0xffe14d, 0xffffff];
// Qué tan cerca tiene que estar un jugador para oír cuando cae un bloque o un meteorito.
const HAZARD_SOUND_REACH = 70;
// Monedas extra para la tienda por llegar en 1°, 2° y 3° lugar (además de las que junte en la pista).
const PODIUM_BONUS = [5, 3, 2];
// Modo peque: sin mover el stick el kart sigue solo la pista; moviéndolo, cuánto cuenta lo que pide el niño.
const PEQUE_DEADZONE = 0.15;
const PEQUE_MIX = 0.55;
const PEQUE_TURN_AROUND_MS = 1200;
// Cada cuánto puede volver a decir "¡Vas en primero!".
const FIRST_PLACE_SAY_MS = 6000;
// El paisaje de fondo: un cilindro gigante alrededor de todo con el dibujo repetido (en espejo) varias veces.
// `sink`: qué parte de abajo de la imagen queda bajo el piso (el suelo del dibujo), para que su horizonte quede
// a la altura de los ojos y no se vea como una pared.
const PANORAMA = { radius: 400, repeats: 5, sink: 0.3 };
// La neblina: empieza y se pone completa a estas distancias.
const FOG = [180, 560];
const CPU_LANES = [-5, 5, -2, 2, -7, 7];
const LABEL_PX = 28;
// Íconos de los poderes hechos con Gemini (npm run arte); si falta alguno se usa su emoji.
const ITEM_ART = {
  rocket: 'cohete',
  banana: 'platano',
  turbo: 'turbo',
  shield: 'burbuja',
  banana3: 'platanos3',
  comet: 'cometa',
  lightning: 'rayo',
  ink: 'tinta',
  star: 'estrella',
  ghost: 'fantasma',
  bullet: 'bala',
  bee: 'abeja',
};
const ITEM_ICONS = Object.fromEntries(
  Object.entries(ITEMS).map(([key, item]) => [
    key,
    manifest.objetos.includes(ITEM_ART[key]) ? `<img src="kart/objetos/${ITEM_ART[key]}.png" alt="">` : item.emoji,
  ]),
);
const ROLL_ICONS = Object.values(ITEM_ICONS);
// Letreros de lo que hace cada jugador (ver Racer.events).
const EVENT_MESSAGES = {
  turbo1: '¡Mini turbo!',
  turbo2: '¡Súper turbo!',
  turbo3: '¡Ultra turbo!',
  trick: '¡Truco! 🤸',
  glide: '¡A volar! 🪂',
  draft: '¡Rebufo! 💨',
};
// La compu hace truco en el aire de vez en cuando (probabilidad por cuadro).
const CPU_TRICK = 0.06;
// Con tinta en la cara la compu maneja chueco.
const CPU_INK_WOBBLE = 0.6;
// Encogido por el rayo, si te toca un kart normal te aplasta (si va a esta velocidad o más).
const SQUASH_SPEED = 10;

// La última pista que se escogió, para que salga seleccionada la próxima vez.
let lastTrack = 'pradera';
// Lo que escoge el Jugador 1 con LB / RB en las pantallas de escoger: nivel de la compu y vueltas.
const options = { level: 'normal', laps: 3, speed: 'normal', weather: 'auto' };
// Para cambiar de pista el juego se vuelve a abrir desde cero (así se libera la memoria de la pista anterior,
// que en el Xbox es poca). Esto dice a dónde ir al reabrirlo, sin pasar otra vez por el taller:
//   { to: 'modes' } escoger modo · { to: 'tracks' } escoger pista · { to: 'cups' } escoger copa ·
//   { gp } la siguiente carrera del Gran Premio.
let resume = null;
// Los modos de juego (la primera pantalla después del taller).
const MODES = [
  { key: 'race', emoji: '🏁', name: 'Carrera', info: 'Una carrera en la pista que quieras' },
  { key: 'cup', emoji: '🏆', name: 'Gran Premio', info: '3 pistas seguidas: el que junte más puntos gana la copa' },
  { key: 'battle', emoji: '🎈', image: 'globos', name: 'Batalla de globos', info: 'Revienta los globos de los demás: gana el último con globos' },
  { key: 'teams', emoji: '🤝', name: 'Por equipos', info: 'Rojos contra Azules: se suman los puntos de cada equipo' },
  { key: 'timetrial', emoji: '⏱️', name: 'Contrarreloj', info: 'Tú solo contra el reloj y tu fantasma (el kart de tu récord)' },
];
// Carreras por equipos: los colores y nombres de los dos equipos.
const TEAMS = [
  { name: 'Rojos', color: 0xff5a5f, emoji: '🔴' },
  { name: 'Azules', color: 0x3fa7ff, emoji: '🔵' },
];

// Cómo se reparte la pantalla: 1 jugador = completa, 2 = arriba/abajo,
// 3 o 4 = cuatro cuadros (con 3, el cuarto muestra el mapa).
function layoutViews(humans) {
  if (humans <= 1) return [{ x: 0, y: 0, w: WIDTH, h: HEIGHT, scale: 1, kind: 'player' }];
  const halfW = WIDTH / 2;
  const halfH = HEIGHT / 2;
  if (humans === 2) {
    return [0, 1].map((i) => ({ x: 0, y: i * halfH, w: WIDTH, h: halfH, scale: 0.75, kind: 'player' }));
  }
  return [0, 1, 2, 3].map((i) => ({
    x: (i % 2) * halfW,
    y: Math.floor(i / 2) * halfH,
    w: halfW,
    h: halfH,
    scale: 0.6,
    kind: i < humans ? 'player' : 'map',
  }));
}

// "Karts locos": carreras con cámara detrás del carro (pantalla dividida para cada jugador),
// nitro y cajitas con poderes para lanzar a los demás, al estilo Mario Kart / Crash Team Racing.
export class KartGame {
  constructor(parent, { onExit, onRestart }) {
    this.onExit = onExit;
    this.onRestart = onRestart;
    this.exitMs = 0;
    this.exited = false;
    this.view = createStage(parent);
    this.renderer = this.view.renderer;
    this.scene = new THREE.Scene();
    this.deviceIds = players.sorted().map((player) => player.deviceId);
    for (const name of manifest.objetos) new Image().src = `kart/objetos/${name}.png`;
    this.drivers = new DriverArt();
    this.openTracks = TRACK_KEYS.filter((key) => rewards.unlocked(TRACKS[key].unlock));

    // Primero el taller (cada quien escoge piloto y kart), luego el modo y la pista (o la copa).
    const next = resume;
    resume = null;
    // Carrera por equipos (se recuerda al reabrir para cambiar de pista).
    this.teams = next?.teams ?? false;
    this.timeTrial = next?.timeTrial ?? false;
    if (next?.gp) {
      this.gp = next.gp;
      this.build(CUPS[this.gp.cup].tracks[this.gp.race]);
    } else if (next?.to === 'modes') {
      this.showModes();
    } else if (next?.to === 'tracks') {
      this.showTracks();
    } else if (next?.to === 'cups') {
      this.showCups();
    } else {
      this.phase = 'garage';
      this.garage = new Garage(this.view, this.drivers);
    }
  }

  updateGarage(dtMs) {
    const result = this.garage.update(dtMs);
    if (result === 'exit' && !this.exited) {
      this.exited = true;
      this.onExit();
    } else if (result === 'done') {
      this.garage.destroy();
      this.garage = null;
      this.afterGarage();
    }
  }

  afterGarage() {
    this.showModes();
  }

  // Una pantalla de tarjetas para escoger (modo, pista o copa). `onPick(i)` con la que escogió el Jugador 1
  // (solo si está abierta); `onBack` con B (si no hay, B sale al menú).
  choose(cards, selected, title, onPick, onBack = null) {
    this.phase = 'choose';
    this.chooser?.destroy();
    this.chooser = new TrackChooser(this.view.stage, cards, selected, title);
    this.showOptions();
    this.chooserCards = cards;
    this.onPick = onPick;
    this.onBack = onBack;
  }

  showOptions() {
    this.chooser.setOptions([
      ['LB', 'Compu', LEVELS[options.level].name],
      ['RB', 'Vueltas', String(options.laps)],
      ['X', 'Velocidad', SPEEDS[options.speed].name],
      ['Y', 'Clima', WEATHERS[options.weather].name],
    ]);
  }

  closeChooser() {
    this.chooser.destroy();
    this.chooser = null;
  }

  showModes() {
    const cards = MODES.map((mode) => ({
      ...mode,
      emoji: manifest.objetos.includes(mode.image) ? `<img src="kart/objetos/${mode.image}.png" alt="" style="height:56px">` : mode.emoji,
      open: true,
    }));
    this.choose(cards, 0, '¿Qué jugamos?', (i) => {
      this.closeChooser();
      this.teams = MODES[i].key === 'teams';
      this.timeTrial = MODES[i].key === 'timetrial';
      if (MODES[i].key === 'cup') this.showCups();
      else if (MODES[i].key === 'battle') this.buildBattle();
      else this.showTracks();
    });
  }

  showTracks() {
    const cards = TRACK_KEYS.map((key) => ({
      ...TRACKS[key],
      open: this.openTracks.includes(key),
      lock: TRACKS[key].unlock ? UNLOCKS[TRACKS[key].unlock].label : '',
      outline: trackOutline(TRACKS[key]),
      color: hexToCss(TRACKS[key].mapColor ?? TRACKS[key].ground),
    }));
    this.choose(
      cards,
      Math.max(0, TRACK_KEYS.indexOf(lastTrack)),
      'Escoge pista',
      (i) => {
        this.closeChooser();
        this.build(TRACK_KEYS[i]);
      },
      () => this.showModes(),
    );
  }

  showCups() {
    const cards = CUP_KEYS.map((key) => {
      const cup = CUPS[key];
      return {
        ...cup,
        emoji: manifest.copas?.includes(cup.image) ? `<img src="kart/copas/${cup.image}.png" alt="" style="height:64px">` : cup.emoji,
        open: rewards.unlocked(cup.unlock),
        lock: cup.unlock ? UNLOCKS[cup.unlock].label : '',
        info: cup.tracks.map((track) => `${TRACKS[track].emoji} ${TRACKS[track].name}`).join('<br>'),
      };
    });
    this.choose(
      cards,
      0,
      'Gran Premio: escoge copa',
      (i) => {
        this.closeChooser();
        this.gp = { cup: CUP_KEYS[i], race: 0, points: null, setups: null };
        this.build(CUPS[this.gp.cup].tracks[0]);
      },
      () => this.showModes(),
    );
  }

  updateChooser() {
    const id = players.host()?.deviceId;
    if (!id) return;
    const step = (controls.justPressed(id, 'right') ? 1 : 0) - (controls.justPressed(id, 'left') ? 1 : 0);
    if (step !== 0) this.chooser.move(step);
    const row = (controls.justPressed(id, 'down') ? 1 : 0) - (controls.justPressed(id, 'up') ? 1 : 0);
    if (row !== 0) this.chooser.moveRow(row);
    // LB = nivel de la compu, RB = cuántas vueltas.
    if (controls.justPressed(id, 'lb')) {
      options.level = LEVEL_KEYS[(LEVEL_KEYS.indexOf(options.level) + 1) % LEVEL_KEYS.length];
      sfx.select();
      say(`Compu ${LEVELS[options.level].name}`);
      this.showOptions();
    } else if (controls.justPressed(id, 'rb')) {
      options.laps = LAP_CHOICES[(LAP_CHOICES.indexOf(options.laps) + 1) % LAP_CHOICES.length];
      sfx.select();
      say(options.laps === 1 ? 'Una vuelta' : `${options.laps} vueltas`);
      this.showOptions();
    } else if (controls.justPressed(id, 'x')) {
      // X = velocidad (el espejo solo si ya se abrió).
      const open = SPEED_KEYS.filter((key) => rewards.unlocked(SPEEDS[key].unlock ?? null));
      options.speed = open[(open.indexOf(options.speed) + 1) % open.length];
      sfx.select();
      say(SPEEDS[options.speed].name);
      this.showOptions();
    } else if (controls.justPressed(id, 'y')) {
      // Y = clima.
      options.weather = WEATHER_KEYS[(WEATHER_KEYS.indexOf(options.weather) + 1) % WEATHER_KEYS.length];
      sfx.select();
      say(WEATHERS[options.weather].name);
      this.showOptions();
    }
    if (controls.justPressed(id, 'a')) {
      if (this.chooserCards[this.chooser.selected].open) this.onPick(this.chooser.selected);
    } else if (controls.justPressed(id, 'b')) {
      if (this.onBack) {
        this.closeChooser();
        this.onBack();
      } else if (!this.exited) {
        this.exited = true;
        this.onExit();
      }
    }
  }

  // Arma la pista escogida con su cielo, su piso y sus adornos, y empieza la carrera.
  build(key) {
    lastTrack = key;
    const look = TRACKS[key];
    this.trackKey = key;
    this.trackLook = look;
    // Velocidad (y espejo) y clima que escogió el Jugador 1.
    const speed = SPEEDS[options.speed];
    this.speedFactor = speed.factor;
    this.mirror = Boolean(speed.mirror);
    this.weatherKey = options.weather === 'auto' ? (look.weather ?? 'sol') : options.weather;
    const weather = WEATHERS[this.weatherKey];
    this.skyTint = weather.sky ?? 1;
    this.setSky(dim(look.sky, this.skyTint), look.groundLight, (look.light ?? 1) * (weather.light ?? 1), look.fog);

    // En espejo todo va al revés de izquierda a derecha.
    const points = this.mirror ? look.points.map(([x, z, h]) => [-x, z, h]) : look.points;
    const avoid = look.theme?.avoid && this.mirror ? { ...look.theme.avoid, x: -look.theme.avoid.x } : look.theme?.avoid;
    const theme = {
      ...look.theme,
      avoid,
      // De noche brillan las llantas.
      glow: look.theme?.glow || this.weatherKey === 'noche',
      groundMap: this.artTexture('texturas', look.texture),
      groundTint: look.textureTint,
      roadMap: this.artTexture('texturas', 'asfalto'),
    };
    this.track = new Track({ roadWidth: 18, scale: 1.3, barriers: true, points, ground: look.ground, snowy: look.snowy, theme });
    // El atajo: antes de dibujar la pista, para dejar el hueco en las llantas y no poner árboles en el caminito.
    this.shortcut = look.shortcut ? new Shortcut(this.track, look.shortcut) : null;
    if (this.shortcut) Object.assign(this.track.theme, { gaps: this.shortcut.gaps, clear: this.shortcut.clear });
    this.track.addTo(this.scene);
    this.shortcut?.addTo(this.scene);
    if (!this.addPanorama(key) && look.mountains) this.addMountains(look.mountains);
    if (look.scenery === 'snow') {
      addSnowmen(this.scene, this.track);
      this.snow = new Snowfall(this.scene, this.track);
    } else {
      this.scenery = addScenery(this.scene, this.track, look.scenery);
    }
    const pads = this.mirror ? look.pads.map(([at, lane]) => [at, -lane]) : look.pads;
    this.features = new TrackFeatures(this.scene, this.track, { pads, ramps: look.ramps, gliders: look.gliders, water: look.water });
    this.coins = new Coins(this.scene, this.track);
    this.hazards = look.hazards ? new Hazards(this.scene, this.track, look.hazards) : null;
    // En el contrarreloj no hay cajitas (ni compu).
    this.boxes = new ItemBoxes(this.scene, this.track, this.timeTrial ? [] : null);
    this.particles = new Particles(this.scene);
    this.dustColor = look.dust ?? 0xb59a6a;
    this.projectiles = new Projectiles(this.scene);
    this.createRacers(this.timeTrial ? 0 : TOTAL_RACERS);
    this.weather = new Weather(this.scene, this.track, this.weatherKey, this.racers);
    this.createViews();
    this.hud = new KartHud(this.view.stage, this.views, { rain: this.weatherKey === 'lluvia' });
    this.hud.setMapOutline(this.track.points);
    this.talk = new RaceTalk(this.hud);
    this.startRace();
    if (this.gp) {
      const cup = CUPS[this.gp.cup];
      say(`${cup.name}. Carrera ${this.gp.race + 1} de ${cup.tracks.length}: ${look.name}`);
    }
  }

  // Cielo, neblina a lo lejos (`fog`: [desde, hasta]) y luz (`light` menos de 1 = de noche).
  setSky(sky, groundLight, light, fog = FOG) {
    this.scene.background = new THREE.Color(sky);
    this.fog = new THREE.Fog(sky, ...fog);
    this.scene.fog = this.fog;
    this.scene.add(new THREE.HemisphereLight(0xffffff, groundLight, 1.2 * light));
    const sun = new THREE.DirectionalLight(0xffffff, 1.6 * light);
    sun.position.set(50, 100, 30);
    this.scene.add(sun);
  }

  // Batalla de globos: la arena en vez de pista, con 4 karts.
  buildBattle() {
    this.trackKey = 'arena';
    this.setSky(0x8fd3ff, 0x5a7a3a, 1);
    this.track = new Arena();
    this.track.addTo(this.scene);
    if (!this.addPanorama('arena')) this.addMountains(0x8a86b8);
    this.boxes = new ItemBoxes(this.scene, this.track, this.track.boxSpots);
    this.projectiles = new Projectiles(this.scene);
    this.particles = new Particles(this.scene);
    this.createRacers(BATTLE_RACERS);
    this.createViews();
    this.hud = new KartHud(this.view.stage, this.views);
    this.hud.setMapOutline(this.track.points);
    this.battle = new Battle(this);
    this.startBattle();
    say('¡Batalla de globos! Revienta los globos de los demás');
  }

  startBattle() {
    this.endCeremony();
    this.battle.start();
    this.finishOrder = [];
    this.projectiles.clear();
    this.phase = 'countdown';
    this.phaseMs = 0;
    this.raceMs = 0;
    this.spokenStep = null;
    this.hud.hideResults();
    this.hud.showHelp(true);
    this.updateCameras(0, true);
  }

  updateBattle(dtMs) {
    this.raceMs += dtMs;
    if (this.raceMs > GO_MS) this.hud.setCenter('');
    if (this.raceMs > HELP_MS) this.hud.showHelp(false);
    this.battle.update(dtMs);
  }

  // A = otra batalla, B = cambiar de modo, X = taller.
  updateBattleResults() {
    if (this.phaseMs < RESULTS_INPUT_DELAY_MS) return;
    const pressed = (button) => this.humans.some((racer) => controls.justPressed(racer.deviceId, button));
    if (pressed('a')) {
      this.startBattle();
    } else if (pressed('b')) {
      resume = { to: 'modes' };
      this.onRestart?.();
    } else if (pressed('x')) {
      this.onRestart?.();
    }
  }

  // Una imagen de Gemini de kart/<carpeta>/ como textura (o null si no existe).
  artTexture(folder, name) {
    if (!name || !manifest[folder]?.includes(name)) return null;
    const texture = new THREE.TextureLoader().load(`kart/${folder}/${name}.jpg`);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  // El paisaje de fondo de la pista (de Gemini), alrededor de todo. El cielo y la neblina toman los colores de la
  // imagen (arriba y cerca del horizonte) para que todo se junte bien. Devuelve false si esa pista no tiene paisaje.
  addPanorama(key) {
    if (!manifest.fondos?.includes(key)) return false;
    const { radius, repeats, sink } = PANORAMA;
    const height = ((Math.PI * 2 * radius) / repeats) * (9 / 16);
    // (Con lluvia o de noche, todo más oscuro.)
    const tint = this.skyTint ?? 1;
    const texture = new THREE.TextureLoader().load(`kart/fondos/${key}.jpg`, (loaded) => {
      const [sky, horizon] = sampleColors(loaded.image);
      this.scene.background = sky.multiplyScalar(tint);
      this.fog.color.copy(horizon.multiplyScalar(tint));
    });
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.MirroredRepeatWrapping;
    texture.repeat.set(repeats, 1);
    const wall = new THREE.Mesh(
      new THREE.CylinderGeometry(radius, radius, height, 64, 1, true),
      new THREE.MeshBasicMaterial({ map: texture, side: THREE.BackSide, fog: false, color: new THREE.Color().setScalar(Math.max(0.35, tint)) }),
    );
    wall.position.y = height / 2 - height * sink;
    this.scene.add(wall);
    this.panorama = wall;
    return true;
  }

  // Montañas a lo lejos para que el horizonte no se vea vacío.
  addMountains(color) {
    const geometry = new THREE.ConeGeometry(1, 1, 6);
    const material = new THREE.MeshLambertMaterial({ color });
    const count = 16;
    const mountains = new THREE.InstancedMesh(geometry, material, count);
    const matrix = new THREE.Matrix4();
    for (let i = 0; i < count; i += 1) {
      const angle = (i / count) * Math.PI * 2;
      const radius = 50 + (i % 3) * 12;
      const height = 50 + ((i * 37) % 30);
      matrix.makeScale(radius, height, radius).setPosition(Math.cos(angle) * 340, height / 2, Math.sin(angle) * 340);
      mountains.setMatrixAt(i, matrix);
    }
    this.scene.add(mountains);
  }

  // Los jugadores con lo que escogieron en el taller; la compu, con personajes y karts al azar, hasta ser `total`.
  createRacers(total = TOTAL_RACERS) {
    const humans = players.sorted();
    const taken = new Set(humans.map((player) => player.colorIndex));
    const cpuColors = PLAYER_COLORS.filter((_, i) => !taken.has(i));
    const drivers = this.drivers;
    this.racers = humans.map((player, i) => {
      const color = players.color(player).hex;
      const setup = kartPicks.get(player.deviceId) ?? { character: CHARACTER_KEYS[i], type: 'clasico', color, wheels: 'normales', extra: 'aleron' };
      return new Racer({ color, label: `J${player.slot + 1}`, deviceId: player.deviceId, setup, drivers });
    });
    // En el Gran Premio la compu trae el mismo personaje y kart en todas las carreras de la copa.
    const characters = new Set(this.racers.map((racer) => racer.setup.character));
    const saved = this.gp?.setups;
    for (let i = 0; this.racers.length < total; i += 1) {
      const setup = saved?.[i] ?? randomSetup(characters);
      characters.add(setup.character);
      this.racers.push(new Racer({ color: cpuColors[i % cpuColors.length].hex, label: 'CPU', setup, drivers }));
    }
    if (this.gp && !saved) this.gp.setups = this.racers.filter((racer) => racer.isCpu).map((racer) => racer.setup);
    // Por equipos: los jugadores nones son Rojos y los pares Azules; la compu completa los dos equipos.
    if (this.teams) {
      const count = [0, 0];
      for (const racer of this.racers) {
        const team = racer.isCpu ? (count[0] <= count[1] ? 0 : 1) : Number(racer.label.slice(1) - 1) % 2;
        count[team] += 1;
        racer.setTeam(team, TEAMS[team].color);
      }
    }
    if (this.gp && !this.gp.points) this.gp.points = this.racers.map(() => 0);
    this.racers.forEach((racer, i) => {
      racer.lane = CPU_LANES[i];
      racer.speedClass = this.speedFactor ?? 1;
      this.scene.add(racer.object);
    });
    this.humans = this.racers.filter((racer) => !racer.isCpu);
    assignPersonalities(this.racers);
  }

  createViews() {
    this.views = layoutViews(this.humans.length).map((view, i) => {
      if (view.kind === 'map') return { ...view, camera: this.mapCamera(view) };
      // En la franja ancha de 2 jugadores se abre menos el ángulo para que no se vea estirado.
      const fov = view.w / view.h > 3 ? 42 : 62;
      // (Que alcance a ver el paisaje del otro lado aunque el kart vaya en la orilla de la pista.)
      const camera = new THREE.PerspectiveCamera(fov, view.w / view.h, 0.5, 900);
      return { ...view, camera, baseFov: fov, racer: this.humans[i], pos: new THREE.Vector3(), look: new THREE.Vector3() };
    });
  }

  // Cámara desde arriba que muestra toda la pista (el cuarto cuadro cuando juegan 3).
  mapCamera(view) {
    const xs = this.track.points.map((p) => p.x);
    const zs = this.track.points.map((p) => p.z);
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
    const cz = (Math.min(...zs) + Math.max(...zs)) / 2;
    let w = Math.max(...xs) - Math.min(...xs) + 40;
    let h = Math.max(...zs) - Math.min(...zs) + 40;
    const aspect = view.w / view.h;
    if (w / h < aspect) w = h * aspect;
    else h = w / aspect;
    const camera = new THREE.OrthographicCamera(-w / 2, w / 2, h / 2, -h / 2, 1, 600);
    camera.position.set(cx, 300, cz);
    camera.up.set(0, 0, -1);
    camera.lookAt(cx, 0, cz);
    return camera;
  }

  // Parrilla de salida: filas de 2 detrás de la meta, los jugadores adelante.
  startRace() {
    const n = this.track.count;
    this.racers.forEach((racer, i) => {
      const index = n - 6 - Math.floor(i / 2) * 6;
      const spot = this.track.pointAt(index, i % 2 === 0 ? -3.5 : 3.5);
      racer.reset(spot.x, spot.z, spot.heading, index);
      racer.progress = racer.lap + index / n;
    });
    this.endCeremony();
    this.laps = this.timeTrial ? TIME_TRIAL_LAPS : options.laps;
    this.level = LEVELS[options.level];
    music.setTempo(1);
    this.projectiles.clear();
    this.phase = 'countdown';
    this.phaseMs = 0;
    this.raceMs = 0;
    this.finishOrder = [];
    this.firstHumanFinishMs = null;
    this.spokenStep = null;
    this.lastLapSaid = false;
    this.hud.hideResults();
    this.hud.setReplay(false);
    this.hud.showHelp(true);
    this.talk.clear();
    // La repetición de la llegada (graba todo) y, en el contrarreloj, el fantasma y las vueltas de cada quien.
    this.replay = new FinishReplay();
    this.lapStart = new Map();
    this.lapTimes = new Map(this.racers.map((racer) => [racer, []]));
    for (const racer of this.racers) racer.planShortcut = false;
    if (this.timeTrial) this.startTimeTrial();
    this.updateCameras(0, true);
  }

  // Contrarreloj: se graba la carrera de cada jugador y corre el fantasma del récord (si hay).
  startTimeTrial() {
    this.recordKey = recordKey(this.trackKey, this.mirror);
    this.record = loadRecord(this.recordKey);
    this.ghost?.dispose(this.scene);
    this.ghost = this.record ? new GhostKart(this.scene, this.record) : null;
    this.ghost?.update(0);
    this.ghostRuns = new Map(this.humans.map((racer) => [racer, new GhostRecorder()]));
    if (this.record) this.talk.line(`⏱️ Récord: ${formatTime(this.record.ms)} ¡Gánale a tu fantasma!`, { important: true, voice: '¡Gánale a tu fantasma!' });
    else this.talk.line('⏱️ ¡Haz el primer récord de esta pista!', { important: true });
  }

  update(deltaMs) {
    const dtMs = Math.min(deltaMs, 50);
    const now = performance.now();
    this.phaseMs += dtMs;
    this.updateExit(dtMs);
    if (this.phase === 'garage') {
      this.updateGarage(dtMs);
      return;
    }
    if (this.phase === 'choose') {
      this.updateChooser();
      return;
    }
    this.snow?.update(dtMs / 1000);
    this.scenery?.update(dtMs / 1000);
    if (this.phase === 'replay') {
      this.updateReplay(dtMs);
      this.particles?.update(dtMs);
      this.updateEngines();
      this.render();
      return;
    }

    if (this.phase === 'countdown') this.updateCountdown();
    else if (this.phase === 'race') this.battle ? this.updateBattle(dtMs) : this.updateRace(dtMs, now);
    else if (this.phase === 'results') this.battle ? this.updateBattleResults() : this.updateResults();

    for (const racer of this.racers) racer.render(now);
    this.battle?.render();
    this.particles?.update(dtMs);
    this.ceremony?.update(dtMs);
    this.updateCameras(dtMs / 1000);
    this.updatePanels(now);
    this.render();
  }

  updateCountdown() {
    const step = Math.floor(this.phaseMs / COUNTDOWN_STEP_MS);
    if (step !== this.spokenStep) {
      this.spokenStep = step;
      say(step < 3 ? String(3 - step) : '¡Ya!');
      sfx.countdown(step >= 3);
    }
    // Arranque turbo: se anota cuándo empezó a acelerar cada jugador.
    for (const racer of this.humans) {
      const id = racer.deviceId;
      if (racer.startPress === null && (controls.justPressed(id, 'a') || controls.justPressed(id, 'rt'))) racer.startPress = this.phaseMs;
    }
    if (step < 3) {
      this.hud.setCenter(String(3 - step));
      return;
    }
    this.hud.setCenter('¡YA!');
    this.phase = 'race';
    this.phaseMs = 0;
    for (const racer of this.racers) {
      const good = racer.isCpu
        ? !this.battle && Math.random() < this.level.startBoost
        : racer.startPress !== null && racer.startPress >= START_WINDOW_MS[0] && racer.startPress <= START_WINDOW_MS[1];
      if (!good) continue;
      racer.boost(START_BOOST.factor, START_BOOST.ms);
      if (!racer.isCpu) {
        racer.say('¡Arranque turbo! 🚀', 1200);
        sfx.boost();
      }
    }
  }

  updateRace(dtMs, now) {
    this.raceMs += dtMs;
    if (this.raceMs > GO_MS) this.hud.setCenter('');
    if (this.raceMs > HELP_MS) this.hud.showHelp(false);

    const ranking = this.ranking();
    for (const racer of this.racers) {
      // Al llegar a la meta, la computadora maneja por ellos (y la bala maneja sola).
      const input = racer.bulletMs > 0 ? this.autoPilot(racer) : racer.isCpu || racer.finished ? this.cpuInput(racer, ranking) : this.humanInput(racer);
      const offroad = !racer.shortcut && Math.abs(this.track.lateral(racer.x, racer.z, racer.index)) > this.track.roadWidth / 2 + 0.3;
      // Pequeña ayuda a los jugadores que van atrás, para que la carrera sea pareja.
      const topFactor = racer.isCpu ? 1 : 1 + this.level.help * ranking.indexOf(racer);
      racer.update(dtMs, input, offroad, topFactor);
      if (offroad) this.kickDust(racer);
      if (input.useItem) this.useItem(racer, ranking);
      if (input.change) racer.driver.changeNumber(input.change);
      this.updateShortcut(racer);
      this.keepInside(racer);
      this.updateProgress(racer);
      this.updateWrongWay(racer, dtMs);
      this.updateWater(racer);
    }
    this.features.update(dtMs, this.racers, {
      onBoost: (racer) => this.announce(racer, 'pad'),
    });
    // En el atajo el piso es el del caminito.
    for (const racer of this.racers) {
      if (!racer.shortcut) continue;
      racer.floor = this.shortcut.heightAt(racer.x, racer.z) + 0.12;
      racer.ramp = 0;
    }
    for (const racer of this.racers) this.tilt(racer);
    this.updateDrafting(dtMs);
    this.weather?.update(dtMs / 1000, this.racers, (racer) => this.onSlip(racer));
    this.updateHazards(dtMs, now);
    this.coins.update(dtMs, now, this.racers, (racer) => {
      if (!racer.isCpu) sfx.coin();
      this.particles.burst('spark', racer.x, racer.y + 1.4, racer.z, 6, COIN_COLORS, { speed: 4, up: 5, lifeMs: 450 });
    });
    this.announceFirstPlace(ranking);
    for (const racer of this.racers) {
      for (const event of racer.events) this.announce(racer, event);
      racer.events.length = 0;
    }
    this.separateRacers();
    this.boxes.update(dtMs, now, this.racers, (racer) => this.giveItem(racer));
    this.projectiles.update(dtMs, this.racers, this.track, (victim, projectile) => this.onProjectileHit(victim, projectile));
    this.emitTrails();
    this.ghost?.update(this.raceMs);
    for (const [racer, run] of this.ghostRuns ?? []) if (!racer.finished) run.update(this.raceMs, racer);
    this.replay.record(dtMs, this.racers);
    this.talk.update(dtMs, ranking, this.raceMs);

    const humansDone = this.humans.every((racer) => racer.finished);
    const waitedEnough = this.firstHumanFinishMs !== null && this.raceMs - this.firstHumanFinishMs > RESULTS_AFTER_FIRST_MS;
    if (humansDone || waitedEnough) this.endRace();
  }

  // Se acabó: primero la repetición de la llegada (si se alcanzó a grabar) y luego los resultados.
  endRace() {
    if (!this.replay.ready) {
      this.showResults();
      return;
    }
    this.phase = 'replay';
    this.phaseMs = 0;
    this.talk.clear();
    this.hud.setCenter('');
    this.hud.setReplay(true);
    this.replay.start(this.racers);
    say('¡Repetición!');
  }

  updateReplay(dtMs) {
    const going = this.replay.step(dtMs, this.track);
    const skip = this.phaseMs > 600 && this.humans.some((racer) => controls.justPressed(racer.deviceId, 'a'));
    if (going && !skip) return;
    this.hud.setReplay(false);
    for (const racer of this.racers) racer.object.visible = true;
    this.showResults();
  }

  // La bala maneja sola: por en medio de la pista, a fondo.
  autoPilot(racer) {
    const target = this.track.pointAt(racer.index + 16, 0);
    const diff = angleDiff(Math.atan2(target.x - racer.x, target.z - racer.z), racer.heading);
    return { steer: clamp(-diff * 3, -1, 1), gas: 1, brake: 0 };
  }

  // El atajo: entra pegándose a la orilla junto al letrero; adentro avanza como si fuera por la pista.
  updateShortcut(racer) {
    const sc = this.shortcut;
    if (!sc) return;
    if (!racer.shortcut) {
      if (!racer.airborne && sc.entering(racer)) racer.shortcut = true;
      return;
    }
    const { t } = sc.project(racer.x, racer.z);
    if (t > 0 && t < 1) {
      racer.index = sc.indexAt(t);
      return;
    }
    racer.shortcut = false;
    racer.index = t >= 1 ? sc.j : sc.i;
    if (t < 1 || racer.isCpu) return;
    racer.say('¡Atajo secreto! 🤫', 1500);
    sfx.sparkle();
    rewards.earn('kart-atajo');
    this.talk.line(`¡${nameOf(racer)} encontró el atajo secreto!`);
  }

  // Bajo el agua (el túnel, o toda la pista del mar): hélice, burbujas y salpicada al entrar y salir.
  updateWater(racer) {
    const wet = Boolean(this.trackLook.underwater) || (!racer.shortcut && this.features.inWater(racer.index));
    if (wet === racer.underwater) return;
    racer.underwater = wet;
    if (this.trackLook.underwater) return;
    this.particles.burst('dust', racer.x, racer.y + 0.8, racer.z, 12, SPLASH_COLORS, { speed: 6, up: 7, lifeMs: 700 });
    if (!racer.isCpu) {
      sfx.poof();
      if (wet) racer.say('¡Al agua! 🌊', 900);
    }
  }

  // Un charco (lluvia): se resbala tantito.
  onSlip(racer) {
    this.particles.burst('dust', racer.x, racer.y + 0.4, racer.z, 10, SPLASH_COLORS, { speed: 5, up: 4, lifeMs: 500 });
    if (!racer.isCpu) {
      sfx.poof();
      racer.say('¡Charco! 💦', 800);
    }
  }

  // Rebufo: pegadito atrás de otro y en línea un ratito, turbito.
  updateDrafting(dtMs) {
    for (const racer of this.racers) {
      if (racer.speed < DRAFT.speed || racer.airborne || racer.boostMs > 0 || racer.shortcut) {
        racer.draftMs = Math.max(0, racer.draftMs - dtMs * 2);
        continue;
      }
      const hx = Math.sin(racer.heading);
      const hz = Math.cos(racer.heading);
      const behind = this.racers.some((other) => {
        if (other === racer) return false;
        const dx = other.x - racer.x;
        const dz = other.z - racer.z;
        const d = Math.hypot(dx, dz);
        return d > DRAFT.min && d < DRAFT.max && (dx * hx + dz * hz) / d > Math.cos(DRAFT.angle);
      });
      racer.draftMs = behind ? racer.draftMs + dtMs : Math.max(0, racer.draftMs - dtMs * 2);
      if (racer.draftMs < DRAFT.ms) continue;
      racer.draftMs = 0;
      racer.boost(DRAFT.factor, DRAFT.boostMs);
      racer.events.push('draft');
    }
  }

  // Efectos que deja cada kart: chispas del derrape, burbujas bajo el agua, brillitos de la estrella y viento del rebufo.
  emitTrails() {
    for (const racer of this.racers) {
      const sin = Math.sin(racer.heading);
      const cos = Math.cos(racer.heading);
      const at = (back, side, up) => [racer.x + sin * back + cos * side, racer.y + up, racer.z + cos * back - sin * side];
      const level = racer.drifting ? racer.driftLevel : 0;
      if (level > 0) {
        for (const side of [-1.15, 1.15]) {
          const [x, y, z] = at(-1.4, side, 0.4);
          this.particles.emit('drift', x, y, z, (Math.random() - 0.5) * 3 - sin * 3, 2 + Math.random() * 3, (Math.random() - 0.5) * 3 - cos * 3, DRIFT_COLORS[level], 320);
        }
      }
      if (racer.underwater && Math.random() < 0.25) {
        const [x, y, z] = at(-2, (Math.random() - 0.5) * 2, 1);
        this.particles.emit('dust', x, y, z, 0, 2.5, 0, 0xdff4ff, 900);
      }
      if (racer.starMs > 0 && Math.random() < 0.7) {
        const [x, y, z] = at((Math.random() - 0.5) * 3, (Math.random() - 0.5) * 3, 1 + Math.random() * 2);
        this.particles.emit('spark', x, y, z, 0, 3, 0, BOX_COLORS[Math.floor(Math.random() * BOX_COLORS.length)], 400);
      }
      if (racer.draftMs > 300 && !racer.isCpu) {
        const side = Math.random() < 0.5 ? -1.6 : 1.6;
        const [x, y, z] = at(1.5, side, 0.8 + Math.random());
        this.particles.emit('spark', x, y, z, -sin * 20, 0, -cos * 20, 0xffffff, 250);
      }
    }
  }

  humanInput(racer) {
    const id = racer.deviceId;
    const brake = controls.isDown(id, 'b') || controls.isDown(id, 'lt') ? 1 : 0;
    const peque = racer.setup.peque;
    return {
      steer: peque ? this.helpSteer(racer, controls.getStick(id).x) : controls.getStick(id).x,
      // Modo peque: acelera solo (con B frena).
      gas: (peque && !brake) || controls.isDown(id, 'a') || controls.isDown(id, 'rt') ? 1 : 0,
      brake,
      nitro: controls.justPressed(id, 'rb'),
      useItem: controls.justPressed(id, 'x'),
      // LB: derrapar (mantener en la curva) y truco (apretarlo en el aire).
      drift: controls.isDown(id, 'lb'),
      trick: controls.justPressed(id, 'lb'),
      // Bloquecito cambia de número (Y sube, ↓ + Y baja).
      change: numberStep(id),
    };
  }

  // Modo peque: el volante ayuda. Sin tocar el stick, el kart sigue la pista solo; tocándolo, se mezcla lo que
  // pide el niño con lo que haría falta para no salirse. (En la arena de la batalla no hay pista que seguir.)
  helpSteer(racer, stick) {
    if (this.battle) return stick;
    // (En el atajo, sigue el caminito.)
    const target = racer.shortcut ? this.shortcut.pointAt(Math.min(1.05, this.shortcut.project(racer.x, racer.z).t + 0.12)) : this.track.pointAt(racer.index + CPU_LOOKAHEAD, 0);
    const diff = angleDiff(Math.atan2(target.x - racer.x, target.z - racer.z), racer.heading);
    const auto = clamp(-diff * 2.5, -1, 1);
    if (Math.abs(stick) < PEQUE_DEADZONE) return auto;
    return clamp(stick * PEQUE_MIX + auto * (1 - PEQUE_MIX), -1, 1);
  }

  // La CPU apunta a un punto un poco más adelante sobre su carril y usa sus poderes con sentido.
  // Cada piloto de la compu maneja según su personalidad (ver rivals.js) y le echa más ganas con su rival cerca.
  cpuInput(racer, ranking) {
    const style = personalityOf(racer);
    let target = this.track.pointAt(racer.index + CPU_LOOKAHEAD, racer.lane);
    // El atajo: si decidió tomarlo, se pega a la orilla junto a la entrada y se mete; adentro sigue el caminito.
    const sc = this.shortcut;
    if (sc && !racer.finished) {
      if (racer.shortcut) {
        target = sc.pointAt(Math.min(1.05, sc.project(racer.x, racer.z).t + 0.12));
      } else if (racer.planShortcut) {
        const ahead = (sc.i - racer.index + this.track.count) % this.track.count;
        if (ahead < 30) target = ahead > 4 ? this.track.pointAt(sc.i, sc.side * (this.track.roadWidth / 2 - 1)) : sc.pointAt(0.3);
      }
    }
    const diff = angleDiff(Math.atan2(target.x - racer.x, target.z - racer.z), racer.heading);
    const wobble = racer.inkMs > 0 ? Math.sin(performance.now() / 260) * CPU_INK_WOBBLE : 0;
    return {
      steer: clamp(-diff * 2.5 + wobble, -1, 1),
      gas: Math.min(1, this.level.gas + style.gas + rivalPush(racer)),
      brake: 0,
      nitro: racer.nitro >= 1 && Math.abs(diff) < 0.12 && Math.random() < this.level.nitro * style.nitro,
      useItem: !racer.finished && this.cpuWantsItem(racer, ranking),
      trick: racer.airborne && Math.random() < CPU_TRICK * style.trick,
    };
  }

  // "¡Vas en primero!" cuando un jugador pasa al primer lugar (no muy seguido).
  announceFirstPlace(ranking) {
    const first = ranking[0];
    if (first.isCpu || first === this.lastFirst || this.raceMs < 4000) {
      this.lastFirst = first;
      return;
    }
    this.lastFirst = first;
    const now = performance.now();
    if (now - (first.firstSaidAt ?? -Infinity) < FIRST_PLACE_SAY_MS) return;
    first.firstSaidAt = now;
    first.say('¡Vas en primero! 🥇', 1500);
    if (this.humans.length === 1) say('¡Vas en primer lugar!');
  }

  // Sonido y letrero de lo que le pasó a un jugador (a la compu no, para no llenar todo de ruido).
  announce(racer, event) {
    // Al caer de un salto: polvito en las llantas.
    if (event === 'land') this.particles.burst('dust', racer.x, racer.y + 0.4, racer.z, 10, [this.dustColor, 0xffffff], { speed: 6, up: 3, lifeMs: 500 });
    if (racer.isCpu) return;
    if (event === 'item') sfx.pickup();
    if (event === 'pad' || event === 'draft' || event.startsWith('turbo')) sfx.boost();
    else if (event === 'glide') sfx.boing();
    else if (event === 'jump') sfx.jump();
    else if (event === 'trick') sfx.special();
    else if (event.startsWith('spark')) sfx.count(Number(event.slice(5)) * 3);
    const message = event === 'pad' ? '¡Turbo!' : EVENT_MESSAGES[event];
    if (message) racer.say(message, 800);
  }

  cpuWantsItem(racer, ranking) {
    if (!racer.item || racer.rollMs > 0) return false;
    if (['turbo', 'shield', 'lightning', 'star', 'bullet'].includes(racer.item)) return true;
    // El cometa, la tinta y la abeja solo sirven si alguien va adelante.
    if (['comet', 'ink', 'bee'].includes(racer.item)) return ranking.indexOf(racer) > 0;
    // El fantasma, si alguien trae algo que robar.
    if (racer.item === 'ghost') return this.racers.some((other) => other !== racer && other.item && !this.sameTeam(racer, other));
    if (racer.item === 'rocket') {
      // El tramposo dispara de más lejos; todos prefieren a su rival si va adelante.
      const reach = personalityOf(racer).sneaky ? 90 : 60;
      const ahead = this.rivalAhead(racer, ranking);
      return ahead ? Math.hypot(ahead.x - racer.x, ahead.z - racer.z) < reach : Math.random() < 0.003;
    }
    const chased = this.racers.some(
      (other) => other !== racer && other.progress < racer.progress && Math.hypot(other.x - racer.x, other.z - racer.z) < 18,
    );
    return chased || Math.random() < 0.003;
  }

  // Polvito detrás del kart cuando va por el pasto (la arena, la nieve...).
  kickDust(racer) {
    if (racer.airborne || Math.abs(racer.speed) < 12 || Math.random() > 0.6) return;
    const back = -1.6;
    const side = (Math.random() - 0.5) * 2;
    const x = racer.x + Math.sin(racer.heading) * back + Math.cos(racer.heading) * side;
    const z = racer.z + Math.cos(racer.heading) * back - Math.sin(racer.heading) * side;
    this.particles.emit('dust', x, racer.y + 0.4, z, (Math.random() - 0.5) * 2, 1.5 + Math.random(), (Math.random() - 0.5) * 2, this.dustColor, 700);
  }

  // En las lomas el kart se inclina: con la trompa arriba al subir y abajo al bajar (de lado, casi nada).
  tilt(racer) {
    const t = this.track.tangents[racer.index];
    const along = Math.cos(angleDiff(racer.heading, Math.atan2(t.x, t.z)));
    const target = racer.airborne ? racer.pitch : Math.atan(this.track.slopes[racer.index]) * along;
    racer.pitch += (target - racer.pitch) * 0.25;
  }

  // Chispas donde roza las llantas de la orilla.
  scrape(racer, nx, nz) {
    if (Math.abs(racer.speed) < 8 || Math.random() > 0.5) return;
    this.particles.emit('spark', racer.x + nx * 1.7, racer.y + 0.6, racer.z + nz * 1.7, nx * 3 + (Math.random() - 0.5) * 4, 3 + Math.random() * 3, nz * 3 + (Math.random() - 0.5) * 4, SPARK_COLORS[Math.floor(Math.random() * 2)], 350);
  }

  giveItem(racer) {
    this.particles.burst('spark', racer.x, racer.y + 1.6, racer.z, 8, BOX_COLORS, { speed: 5, up: 5, lifeMs: 500 });
    if (racer.item || racer.rollMs > 0) return;
    const ranking = this.ranking();
    // En la batalla no hay primero ni último: todos reciben poderes de los de en medio.
    racer.pendingItem = rollItem(ranking.indexOf(racer) / Math.max(1, ranking.length - 1), Boolean(this.battle));
    racer.pendingUses = ITEMS[racer.pendingItem].uses ?? 1;
    racer.rollMs = ROLL_MS;
  }

  useItem(racer, ranking) {
    if (this.battle) {
      this.battle.useItem(racer);
      return;
    }
    if (!racer.item || racer.rollMs > 0) return;
    const item = racer.item;
    racer.itemUses -= 1;
    if (racer.itemUses <= 0) racer.item = null;
    racer.throwMs = THROW_POSE_MS;
    if (item === 'rocket') this.projectiles.addRocket(racer, this.rivalAhead(racer, ranking));
    else if (item === 'banana' || item === 'banana3') this.projectiles.addBanana(racer);
    else if (item === 'turbo') racer.boost(1.7, 2000);
    else if (item === 'shield') racer.shieldMs = SHIELD_MS;
    else if (item === 'comet') {
      const leader = ranking.find((other) => other !== racer && !other.finished && !this.sameTeam(racer, other));
      if (leader) this.projectiles.addComet(racer, leader);
    } else if (item === 'lightning') this.strikeLightning(racer);
    else if (item === 'ink') this.splashInk(racer, ranking);
    const message = this.usePower(racer, item, ranking);
    if (!racer.isCpu) racer.say(message ?? ITEMS[item].name, 900);
  }

  // Los poderes nuevos (también en la batalla): estrella, fantasma, bala y abeja. Devuelve un letrero especial o null.
  usePower(racer, item, ranking = null) {
    if (item === 'star') {
      racer.starMs = STAR_MS;
      racer.boost(1.2, 600);
      sfx.sparkle();
      if (!racer.isCpu) this.talk?.line(`¡${nameOf(racer)} trae la estrella!`);
    } else if (item === 'bullet') {
      racer.bulletMs = BULLET_MS;
      if (racer.drifting) racer.endDrift(true);
      sfx.boost();
    } else if (item === 'bee') {
      const leader = (ranking ?? []).find((other) => other !== racer && !other.finished && !this.sameTeam(racer, other));
      if (leader) this.projectiles.addBee(racer, leader);
      sfx.throw();
    } else if (item === 'ghost') {
      // Se vuelve fantasma y le roba su poder al que vaya más adelante (y traiga uno).
      racer.ghostMs = GHOST_MS;
      sfx.ghost();
      const pool = this.battle ? this.battle.alive() : this.racers;
      const victim = pool
        .filter((other) => other !== racer && other.item && other.rollMs === 0 && !this.sameTeam(racer, other))
        .sort((a, b) => (b.progress ?? 0) - (a.progress ?? 0))[0];
      if (!victim) return null;
      racer.item = victim.item;
      racer.itemUses = victim.itemUses;
      victim.item = null;
      victim.itemUses = 0;
      if (!victim.isCpu) victim.say('¡Te robaron el poder! 👻');
      return `¡Le robaste ${ITEMS[racer.item].name.replace(/[¡!]/g, '')}! 👻`;
    }
    return null;
  }

  // El de adelante más cercano que no sea de su equipo (para el cohete), o null.
  rivalAhead(racer, ranking) {
    const place = ranking.indexOf(racer);
    for (let i = place - 1; i >= 0; i -= 1) if (!this.sameTeam(racer, ranking[i])) return ranking[i];
    return null;
  }

  // ¿Van en el mismo equipo? (Fuera de la carrera por equipos, nadie.)
  sameTeam(a, b) {
    return a.team !== undefined && a.team === b.team;
  }

  // Rayo: encoge a todos los demás (a los que traen burbuja solo se las revienta; a los de su equipo, nada).
  strikeLightning(owner) {
    this.hud.flash();
    sfx.boom();
    let hits = 0;
    for (const racer of this.racers) {
      if (racer === owner || racer.finished || racer.out || this.sameTeam(owner, racer)) continue;
      const shrunk = racer.shrink();
      if (shrunk) hits += 1;
      if (!racer.isCpu) racer.say(shrunk ? '¡Te encogieron! 🌩️' : '¡La burbuja te salvó!');
    }
    if (hits > 0 && !owner.isCpu) rewards.earn('kart-poder');
  }

  // Tinta: les mancha la pantalla a todos los que van adelante.
  splashInk(owner, ranking) {
    for (const racer of ranking.slice(0, ranking.indexOf(owner))) {
      if (racer.finished || this.sameTeam(owner, racer)) continue;
      racer.inkMs = INK_MS;
      if (!racer.isCpu) racer.say('¡No veo! 🦑');
    }
    sfx.throw();
  }

  onProjectileHit(victim, projectile) {
    const hurt = victim.hit();
    if (hurt) this.particles.burst('spark', victim.x, victim.y + 1.5, victim.z, 22, HIT_COLORS, { speed: 10, up: 9 });
    // Si le pegan a un jugador (o un jugador le pega a alguien), el golpe se siente: todo se congela un instante.
    if (hurt && (!victim.isCpu || !projectile.owner.isCpu)) setTimeScale(0, 70);
    if (hurt && (!victim.isCpu || !projectile.owner.isCpu)) sfx.hit(projectile.kind === 'comet' ? 1 : 0.7);
    if (!victim.isCpu && (hurt || !victim.invincible)) victim.say(hurt ? '¡Te dieron! 💫' : '¡La burbuja te salvó!');
    if (hurt) this.talk?.hit(projectile.owner, victim, projectile.kind);
    if (hurt && projectile.owner !== victim && !projectile.owner.isCpu) {
      projectile.owner.say('¡Le diste! 🎯');
      rewards.earn('kart-poder');
    }
  }

  // Los peligros de la pista: si le pegan a alguien da vueltas; donde cae un bloque o un meteorito, chispas
  // (y ruido, si hay un jugador cerca).
  updateHazards(dtMs, now) {
    if (!this.hazards) return;
    const events = this.hazards.update(dtMs, now, this.racers, (racer, hazards) => {
      const hurt = racer.hit();
      if (hurt) this.particles.burst('spark', racer.x, racer.y + 1.5, racer.z, 12, HIT_COLORS);
      if (racer.isCpu || (!hurt && racer.invincible)) return;
      if (hurt) sfx.hit(0.7);
      racer.say(hurt ? hazards.ouch : '¡La burbuja te salvó!');
    });
    for (const event of events) {
      this.particles.burst('dust', event.x, event.y + 0.5, event.z, 16, [this.dustColor, 0xffffff], { speed: 9, up: 4, lifeMs: 700 });
      if (event.kind === 'meteorito' || event.kind === 'lava') this.particles.burst('spark', event.x, event.y + 1, event.z, 14, [0xff9a3c, 0xffe066], { speed: 8, up: 7 });
      if (event.kind === 'relampago') this.particles.burst('spark', event.x, event.y + 1, event.z, 16, [0xffe14d, 0xffffff], { speed: 9, up: 8 });
      if (this.humans.some((racer) => Math.hypot(racer.x - event.x, racer.z - event.z) < HAZARD_SOUND_REACH)) sfx.boom();
    }
  }

  // Las llantas de la orilla no dejan salir a nadie: rozarlas frena un poco.
  keepInside(racer) {
    // En el atajo, las piedritas del caminito.
    if (racer.shortcut) {
      if (this.shortcut.keepInside(racer)) racer.speed *= 0.95;
      return;
    }
    const lateral = this.track.lateral(racer.x, racer.z, racer.index);
    const limit = this.track.wallDistance;
    if (Math.abs(lateral) <= limit) return;
    const normal = this.track.normals[racer.index];
    const push = (Math.abs(lateral) - limit) * Math.sign(lateral);
    racer.x -= normal.x * push;
    racer.z -= normal.z * push;
    racer.speed *= 0.94;
    this.scrape(racer, normal.x * Math.sign(lateral), normal.z * Math.sign(lateral));
  }

  // Avance en la pista y conteo de vueltas: una vuelta cuenta al cruzar la meta
  // solo si antes pasó por la mitad de la pista.
  updateProgress(racer) {
    const n = this.track.count;
    // En el atajo el avance ya lo puso el atajo (y nunca cruza la meta).
    if (racer.shortcut) {
      if (racer.index > n * 0.4 && racer.index < n * 0.6) racer.crossedHalf = true;
      racer.progress = racer.lap + racer.index / n;
      return;
    }
    const { index } = this.track.closest(racer.x, racer.z, racer.index);
    const prev = racer.index;
    if (prev > n * 0.85 && index < n * 0.15) {
      if (racer.crossedHalf) {
        racer.lap += 1;
        racer.crossedHalf = false;
        this.onLap(racer);
      }
    } else if (prev < n * 0.15 && index > n * 0.85) {
      // Cruzó la meta en reversa.
      racer.lap -= 1;
      racer.crossedHalf = true;
    }
    if (index > n * 0.4 && index < n * 0.6) racer.crossedHalf = true;
    racer.index = index;
    racer.progress = racer.lap + index / n;
  }

  onLap(racer) {
    const laps = this.laps;
    // La compu decide en cada vuelta si toma el atajo (según su nivel y su personalidad).
    if (racer.isCpu && this.shortcut) racer.planShortcut = Math.random() < (CPU_SHORTCUT[options.level] + personalityOf(racer).shortcut) / 2;
    // Contrarreloj: el tiempo de cada vuelta.
    if (this.timeTrial && racer.lap >= 1) this.lapTimes.get(racer).push(this.raceMs - (this.lapStart.get(racer) ?? 0));
    this.lapStart.set(racer, this.raceMs);
    if (racer.lap >= laps && !racer.finished) {
      racer.finished = true;
      racer.finishMs = this.raceMs;
      this.finishOrder.push(racer);
      this.replay?.markFinish(racer);
      // Confeti en la meta.
      this.particles.burst('confetti', racer.x, racer.y + 2, racer.z, 36, CONFETTI_COLORS, { speed: 7, up: 10, lifeMs: 1700 });
      // El primer jugador que llega: cámara lenta y "fuegos artificiales" de chispas.
      if (!racer.isCpu && this.firstHumanFinishMs === null && !this.timeTrial) {
        setTimeScale(0.35, 1300);
        for (const [up, speed] of [[16, 9], [20, 12], [24, 7]]) this.particles.burst('spark', racer.x, racer.y + 3, racer.z, 30, CONFETTI_COLORS, { speed, up, lifeMs: 1400 });
      }
      if (this.finishOrder.length === 1 && !this.timeTrial) this.talk.line(`¡${nameOf(racer)} cruza la meta en primer lugar!`, { important: true });
      if (!racer.isCpu && this.finishOrder.length === 1 && !this.timeTrial) rewards.earn('kart-gana');
      if (!racer.isCpu) {
        if (this.firstHumanFinishMs === null) this.firstHumanFinishMs = this.raceMs;
        racer.say(`¡Meta! ${this.finishOrder.length}° lugar`, 5000);
        if (this.finishOrder.length === 1) sfx.win();
        else sfx.confirm();
      }
      return;
    }
    if (!racer.isCpu && racer.lap > 0) racer.say(racer.lap === laps - 1 ? '¡Última vuelta!' : `Vuelta ${racer.lap + 1}`);
    if (this.timeTrial && racer.lap > 0) racer.say(`Vuelta ${racer.lap}: ${formatTime(this.lapTimes.get(racer).at(-1))}`, 1800);
    // La última vuelta: aviso, fanfarria y la música más rápida.
    if (!racer.isCpu && racer.lap === laps - 1 && laps > 1 && !this.lastLapSaid) {
      this.lastLapSaid = true;
      say('¡Última vuelta!');
      sfx.meterFull();
      music.setTempo(1.15);
    }
  }

  updateWrongWay(racer, dtMs) {
    const t = this.track.tangents[racer.index];
    const along = Math.atan2(t.x, t.z);
    const wrong = racer.speed > 4 && Math.abs(angleDiff(racer.heading, along)) > 2.1;
    racer.wrongWayMs = wrong ? racer.wrongWayMs + dtMs : 0;
    // Modo peque: si se voltea al revés, se le endereza solo.
    if (racer.setup.peque && racer.wrongWayMs > PEQUE_TURN_AROUND_MS) {
      racer.heading = along;
      racer.wrongWayMs = 0;
      racer.say('¡Por acá! ➡️', 1200);
    }
  }

  separateRacers() {
    const list = this.racers;
    for (let i = 0; i < list.length; i += 1) {
      for (let j = i + 1; j < list.length; j += 1) {
        const a = list[i];
        const b = list[j];
        // El fantasma atraviesa a todos.
        if (a.ghostMs > 0 || b.ghostMs > 0) continue;
        const dx = b.x - a.x;
        const dz = b.z - a.z;
        const dist = Math.hypot(dx, dz) || 0.01;
        const min = RACER_RADIUS * 2;
        if (dist >= min) continue;
        // El más pesado empuja más (un Monstruo casi no se mueve si lo choca un Mini).
        const overlap = min - dist;
        const share = b.stats.weight / (a.stats.weight + b.stats.weight);
        a.x -= (dx / dist) * overlap * share;
        a.z -= (dz / dist) * overlap * share;
        b.x += (dx / dist) * overlap * (1 - share);
        b.z += (dz / dist) * overlap * (1 - share);
        a.speed *= 0.97;
        b.speed *= 0.97;
        // Con estrella o bala, al que toques lo tumbas.
        for (const [hitter, other] of [[a, b], [b, a]]) {
          if ((hitter.starMs === 0 && hitter.bulletMs === 0) || other.invincible || other.spinMs > 0) continue;
          if (this.battle) {
            this.battle.hit(other, hitter);
            continue;
          }
          if (!other.hit()) continue;
          this.particles.burst('spark', other.x, other.y + 1.5, other.z, 14, HIT_COLORS);
          if (!other.isCpu || !hitter.isCpu) sfx.hit(0.8);
          if (!other.isCpu) other.say(hitter.starMs > 0 ? '¡Te tumbó la estrella! ⭐' : '¡Te atropelló la bala! 💣');
          if (!hitter.isCpu && hitter.starMs > 0) rewards.earn('kart-estrella');
          this.talk?.hit(hitter, other, hitter.bulletMs > 0 ? 'bullet' : 'star');
        }
        // Si uno está encogido por el rayo y el otro no, ¡lo aplasta!
        for (const [small, big] of [[a, b], [b, a]]) {
          if (small.shrinkMs > 0 && big.shrinkMs === 0 && big.speed > SQUASH_SPEED && small.spinMs === 0) {
            // En la batalla, aplastar revienta un globo.
            if (this.battle) {
              this.battle.hit(small, big);
              continue;
            }
            small.hit();
            if (!small.isCpu) small.say('¡Te aplastaron! 💫');
            if (!big.isCpu) big.say('¡Aplastado! 👟');
          }
        }
      }
    }
  }

  ranking() {
    const rest = this.racers.filter((racer) => !racer.finished).sort((a, b) => b.progress - a.progress);
    return [...this.finishOrder, ...rest];
  }

  showResults() {
    this.phase = 'results';
    this.phaseMs = 0;
    this.hud.setCenter('');
    this.hud.setReplay(false);
    const ranking = this.ranking();
    if (this.timeTrial) {
      this.showTimeTrial();
      return;
    }
    const note = this.payout(ranking);
    this.talk?.finish(ranking);
    if (this.gp) {
      this.showStandings(ranking, note);
      return;
    }
    const rows = ranking.map((racer) => ({
      label: racer.label,
      color: hexToCss(racer.color),
      name: `${racer.driver.name}${this.teams ? ` ${TEAMS[racer.team].emoji}` : ''}`,
      image: racer.driver.imageUrl,
    }));
    if (this.teams) {
      // Puntos de cada equipo (como en el Gran Premio: 10, 8, 6, 4, 2, 1).
      const points = [0, 0];
      ranking.forEach((racer, place) => (points[racer.team] += CUP_POINTS[place] ?? 0));
      const winner = points[0] === points[1] ? null : TEAMS[points[0] > points[1] ? 0 : 1];
      const score = `${TEAMS[0].emoji} ${points[0]}  a  ${points[1]} ${TEAMS[1].emoji}`;
      this.hud.showResults(rows, { title: winner ? `¡Ganaron los ${winner.name}! ${score}` : `¡Empate! ${score}`, note });
      say(winner ? `¡Ganaron los ${winner.name}!` : '¡Empate!');
    } else {
      this.hud.showResults(rows, { note });
      say(`¡Ganó ${ranking[0].label}, ${ranking[0].driver.name}!`);
    }
    this.startCeremony(ranking);
  }

  // Contrarreloj: el tiempo de cada jugador y su mejor vuelta. Si alguien le ganó al récord, se guarda su carrera
  // (será el fantasma de la próxima vez).
  showTimeTrial() {
    const old = this.record;
    const runs = this.humans
      .map((racer) => ({ racer, ms: racer.finished ? racer.finishMs : null, lap: Math.min(...this.lapTimes.get(racer)) }))
      .sort((a, b) => (a.ms ?? Infinity) - (b.ms ?? Infinity));
    const best = runs[0];
    const beaten = best.ms !== null && (!old || best.ms < old.ms);
    if (beaten) {
      const { type, color, wheels, extra } = best.racer.setup;
      saveRecord(this.recordKey, { ms: best.ms, lap: best.lap, setup: { type, color, wheels, extra }, frames: this.ghostRuns.get(best.racer).frames });
      rewards.earn('kart-record');
    }
    const rows = runs.map(({ racer, ms, lap }) => ({
      label: racer.label,
      color: hexToCss(racer.color),
      name: racer.driver.name,
      image: racer.driver.imageUrl,
      total: ms === null ? '—' : formatTime(ms),
      gainText: Number.isFinite(lap) ? `mejor vuelta ${formatTime(lap)}` : '',
    }));
    const note = old ? `Récord anterior: ${formatTime(old.ms)}` : 'Primer récord de esta pista';
    this.hud.showStandings({
      title: beaten ? '¡Nuevo récord! ⏱️' : 'Contrarreloj ⏱️',
      rows,
      footer: 'A = otra vez  ·  B = cambiar pista  ·  X = taller',
      note,
    });
    say(beaten ? '¡Nuevo récord!' : '¡Llegaste!');
    if (beaten) this.particles.burst('confetti', best.racer.x, best.racer.y + 2, best.racer.z, 60, CONFETTI_COLORS, { speed: 8, up: 10, lifeMs: 1800 });
  }

  // Monedas para la tienda: las que juntó cada jugador más un premio por su lugar. Devuelve el letrero.
  payout(ranking) {
    const parts = this.humans.map((racer) => {
      const earned = (this.battle ? 0 : racer.coins) + (PODIUM_BONUS[ranking.indexOf(racer)] ?? 0);
      wallet.add(earned);
      return `${racer.label} +${earned}`;
    });
    return `🪙 ${parts.join('  ·  ')} para la tienda`;
  }

  // Gran Premio: suma los puntos de esta carrera y muestra la tabla. En la última, la copa para el que juntó más.
  showStandings(ranking, note) {
    const cup = CUPS[this.gp.cup];
    const gained = new Map(ranking.map((racer, place) => [racer, CUP_POINTS[place] ?? 0]));
    this.racers.forEach((racer, i) => (this.gp.points[i] += gained.get(racer)));
    const rows = this.racers
      .map((racer, i) => ({
        label: racer.label,
        color: hexToCss(racer.color),
        name: racer.driver.name,
        image: racer.driver.imageUrl,
        total: this.gp.points[i],
        gained: gained.get(racer),
        human: !racer.isCpu,
      }))
      .sort((a, b) => b.total - a.total);
    this.gp.last = this.gp.race === cup.tracks.length - 1;
    if (!this.gp.last) {
      this.hud.showStandings({ title: `${cup.emoji} ${cup.name} · carrera ${this.gp.race + 1} de ${cup.tracks.length}`, rows, footer: 'A = siguiente carrera', note });
      say(`Va ganando ${rows[0].label}, ${rows[0].name}`);
      return;
    }
    const winner = rows[0];
    if (winner.human) rewards.earn('kart-copa');
    const trophy = manifest.copas?.includes(cup.image) ? `kart/copas/${cup.image}.png` : null;
    const byPoints = this.racers.map((racer, i) => [racer, this.gp.points[i]]).sort((a, b) => b[1] - a[1]).map(([racer]) => racer);
    this.startCeremony(byPoints, trophy);
    this.hud.showStandings({
      title: `¡${winner.label} ganó la ${cup.name}!`,
      rows,
      trophy: { image: trophy, emoji: '🏆', winner },
      footer: 'A = otra copa  ·  X = taller',
      note,
    });
    say(`¡${winner.label}, ${winner.name}, ganó la ${cup.name}!`);
  }

  // A = otra carrera, B = cambiar pista, X = regresar al taller.
  // En el Gran Premio: A = siguiente carrera (y al final, otra copa; X = taller).
  updateResults() {
    if (this.phaseMs < RESULTS_INPUT_DELAY_MS) return;
    const pressed = (button) => this.humans.some((racer) => controls.justPressed(racer.deviceId, button));
    if (this.gp) {
      if (pressed('a')) {
        resume = this.gp.last ? { to: 'cups' } : { gp: { ...this.gp, race: this.gp.race + 1 } };
        this.onRestart?.();
      } else if (this.gp.last && pressed('x')) {
        this.onRestart?.();
      }
      return;
    }
    if (pressed('a')) {
      this.startRace();
    } else if (pressed('b')) {
      resume = { to: 'tracks', teams: this.teams, timeTrial: this.timeTrial };
      this.onRestart?.();
    } else if (pressed('x')) {
      this.onRestart?.();
    }
  }

  updatePanels(now) {
    const ranking = this.ranking();
    this.views.forEach((view, i) => {
      if (view.kind !== 'player') return;
      const racer = view.racer;
      const rolling = racer.rollMs > 0;
      let item = rolling ? ROLL_ICONS[Math.floor(now / 90) % ROLL_ICONS.length] : racer.item ? ITEM_ICONS[racer.item] : '';
      // Los que se usan varias veces (triple plátano) dicen cuántos quedan.
      if (!rolling && racer.itemUses > 1) item += `<b class="count">×${racer.itemUses}</b>`;
      const message = racer.messageMs > 0 ? racer.message : racer.wrongWayMs > WRONG_WAY_MS ? '¡Vas al revés! ↩️' : '';
      // En la batalla: sus globos y el reloj en vez del lugar y la vuelta.
      const battle = this.battle?.panel(racer);
      // En el contrarreloj: el reloj en vez del lugar.
      const clock = this.timeTrial ? formatTime(racer.finished ? racer.finishMs : this.raceMs) : null;
      this.hud.setPanel(i, {
        pos: battle?.pos ?? clock ?? `${ranking.indexOf(racer) + 1}°`,
        who: `<span style="color:${hexToCss(racer.color)}">${racer.label}</span>${this.teams ? ` ${TEAMS[racer.team].emoji}` : ''}${racer.setup.peque ? ' 🐣' : ''}`,
        lap: battle?.lap ?? (racer.finished ? '¡Meta!' : `Vuelta ${clamp(racer.lap + 1, 1, this.laps)}/${this.laps}`),
        coins: this.battle ? '' : `🪙 ${racer.coins}`,
        item,
        rolling,
        nitro: Array.from({ length: NITRO_CHARGES }, (_, k) => `<span class="${k < racer.nitro ? '' : 'off'}">🔥</span>`).join(''),
        msg: message,
        ink: racer.inkMs > 0,
        speed: this.phase === 'race' && (racer.boostMs > 0 || racer.starMs > 0 || racer.bulletMs > 0),
        // Dentro del túnel de agua todo se ve azul.
        water: racer.underwater && !this.trackLook?.underwater,
      });
      // El mini mapa (con 3 jugadores ya hay un cuadro de mapa grande).
      if (this.views.some((other) => other.kind === 'map')) return;
      const dots = this.racers.map((other) => ({ x: other.x, z: other.z, color: hexToCss(other.color), me: other === racer }));
      this.hud.drawMap(i, dots);
    });
    this.updateEngines();
  }

  // El motor de cada jugador suena según su velocidad (se prende cuando el navegador ya deja sonar).
  updateEngines() {
    for (const racer of this.humans) {
      racer.engine ??= createEngine();
      racer.engine?.update(this.phase === 'race' ? racer.speed : 0, racer.boostMs > 0);
    }
  }

  // Cámara detrás de cada jugador, como en GTA: lo sigue con un poco de suavidad
  // y se abre un poco con el nitro para que se sienta la velocidad.
  updateCameras(dt, snap = false) {
    const desiredPos = new THREE.Vector3();
    const desiredLook = new THREE.Vector3();
    const blend = snap ? 1 : 1 - Math.pow(0.001, dt);
    for (const view of this.views) {
      if (view.kind !== 'player') continue;
      const racer = view.racer;
      const fx = Math.sin(racer.heading);
      const fz = Math.cos(racer.heading);
      // La altura del camino bajo el kart (las lomas) se sigue toda; los saltos, solo un poco.
      const road = racer.floor - racer.ramp;
      const up = racer.y - road;
      desiredPos.set(racer.x - fx * 9, road + 4.6 + up * 0.7, racer.z - fz * 9);
      desiredLook.set(racer.x + fx * 7, road + 1.4 + up + Math.tan(racer.pitch) * 7, racer.z + fz * 7);
      view.pos.lerp(desiredPos, blend);
      view.look.lerp(desiredLook, blend);
      view.camera.position.copy(view.pos);
      view.camera.lookAt(view.look);
      const fov = view.baseFov + (racer.boostMs > 0 ? 10 : 0);
      if (Math.abs(view.camera.fov - fov) > 0.1) {
        view.camera.fov += (fov - view.camera.fov) * Math.min(1, dt * 6);
        view.camera.updateProjectionMatrix();
      }
    }
  }

  // La premiación: los 3 primeros al podio (en toda la pantalla). `trophy`: imagen de la copa (Gran Premio).
  startCeremony(podium, trophy = null) {
    this.endCeremony();
    const scenery = [this.panorama, this.track.groundMesh].filter(Boolean);
    this.ceremony = new Ceremony(podium.slice(0, 3), {
      background: this.scene.background,
      scenery,
      trophy,
      floor: this.track.groundHeight(0, 0),
    });
    this.hud.setCeremony(true);
    // ¡Foto del podio!
    this.hud.flash();
    sfx.poof();
    this.talk?.line('📸 ¡Foto del podio!', { important: true, voice: '¡Sonrían!' });
  }

  endCeremony() {
    if (!this.ceremony) return;
    this.ceremony.dispose();
    this.ceremony = null;
    this.hud.setCeremony(false);
  }

  // Una pasada por cada pedazo de pantalla (pantalla dividida); en la premiación, una sola en toda la pantalla.
  render() {
    const renderer = this.renderer;
    if (this.ceremony) {
      this.ceremony.render(renderer);
      return;
    }
    // La repetición: una sola cámara de tele en toda la pantalla.
    if (this.phase === 'replay') {
      const camera = this.replay.camera;
      renderer.setScissorTest(false);
      renderer.setViewport(0, 0, WIDTH, HEIGHT);
      const labelHeight = (LABEL_PX / HEIGHT) * 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
      for (const racer of this.racers) {
        racer.driver.show(driverView(racer, camera));
        racer.labelSprite.visible = true;
        racer.labelSprite.scale.set(labelHeight * 2, labelHeight, 1);
      }
      this.scene.fog = this.fog;
      renderer.render(this.scene, camera);
      return;
    }
    renderer.setScissorTest(true);
    for (const view of this.views) {
      const y = HEIGHT - view.y - view.h;
      renderer.setViewport(view.x, y, view.w, view.h);
      renderer.setScissor(view.x, y, view.w, view.h);
      const isMap = view.kind === 'map';
      // Alto del letrero: en el mapa, en unidades del mundo; en las cámaras de atrás, unos 28 px en pantalla.
      const labelHeight = isMap ? 9 : (LABEL_PX / view.h) * 2 * Math.tan(THREE.MathUtils.degToRad(view.camera.fov / 2));
      for (const racer of this.racers) {
        // El piloto, visto desde esta cámara (de espaldas, de lado, de frente...).
        if (!isMap) racer.driver.show(driverView(racer, view.camera));
        // Nadie ve su propio letrero encima de su carro.
        racer.labelSprite.visible = racer !== view.racer;
        racer.labelSprite.scale.set(labelHeight * 2, labelHeight, 1);
      }
      this.scene.fog = isMap ? null : this.fog;
      renderer.render(this.scene, view.camera);
    }
    renderer.setScissorTest(false);
  }

  updateExit(dtMs) {
    const holding = this.deviceIds.some((id) => controls.holdingExit(id));
    this.exitMs = holding ? this.exitMs + dtMs : 0;
    (this.hud ?? this.chooser ?? this.garage)?.setExitProgress(Math.min(1, this.exitMs / EXIT_HOLD_MS));
    if (this.exitMs >= EXIT_HOLD_MS && !this.exited) {
      this.exited = true;
      this.onExit();
    }
  }

  destroy() {
    this.endCeremony();
    this.ghost?.dispose(this.scene);
    for (const racer of this.humans ?? []) racer.engine?.stop();
    music.setTempo(1);
    this.projectiles?.dispose();
    this.features?.dispose();
    this.hazards?.dispose();
    this.hud?.destroy();
    this.chooser?.destroy();
    this.garage?.destroy();
    for (const racer of this.racers ?? []) racer.driver.dispose();
    this.drivers.dispose();
    this.view.destroy(this.scene);
  }
}

// Los colores promedio del paisaje: arriba (el cielo) y cerca de abajo (el piso lejano, para la neblina).
function sampleColors(image) {
  const canvas = document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 18;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(image, 0, 0, 32, 18);
  const average = (row) => {
    const data = ctx.getImageData(0, row, 32, 1).data;
    let [r, g, b] = [0, 0, 0];
    for (let i = 0; i < data.length; i += 4) [r, g, b] = [r + data[i], g + data[i + 1], b + data[i + 2]];
    const n = data.length / 4;
    return new THREE.Color().setRGB(r / n / 255, g / n / 255, b / n / 255, THREE.SRGBColorSpace);
  };
  return [average(0), average(15)];
}

// El trazo de una pista visto desde arriba (unos 50 puntos), para dibujarlo en la tarjeta.
function trackOutline(look) {
  const track = new Track({ scale: 1.3, points: look.points });
  return track.points.filter((_, i) => i % 8 === 0).map((p) => ({ x: p.x, z: p.z }));
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

// Diferencia entre dos ángulos, siempre por el lado más corto (entre -π y π).
function angleDiff(a, b) {
  return Math.atan2(Math.sin(a - b), Math.cos(a - b));
}

// Un color más oscuro (lluvia, noche): `k` de 0 a 1.
function dim(hex, k) {
  return new THREE.Color(hex).multiplyScalar(k).getHex();
}
