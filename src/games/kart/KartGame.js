import * as THREE from 'three';
import { controls } from '../../shared/controls.js';
import { players, PLAYER_COLORS } from '../../shared/players.js';
import { say } from '../../shared/voice.js';
import { UNLOCKS, rewards } from '../../shared/rewards.js';
import { hexToCss } from '../../ui/style.js';
import { createStage, WIDTH, HEIGHT } from '../three/stage.js';
import { Track } from '../three/track.js';
import { Racer, RACER_RADIUS, NITRO_CHARGES, SHIELD_MS } from './Racer.js';
import { ItemBoxes, Projectiles, ITEMS, rollItem } from './items.js';
import { KartHud } from './hud.js';
import manifest from './art.json';
import { TrackChooser } from './chooser.js';
import { Snowfall, addSnowmen } from './scenery.js';
import { TRACKS, TRACK_KEYS } from './tracks.js';

const LAPS = 3;
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
const CPU_GAS = 0.86;
const CPU_LANES = [-5, 5, -2, 2, -7, 7];
const LABEL_PX = 28;
// Íconos de los poderes hechos con Gemini (npm run arte); si falta alguno se usa su emoji.
const ITEM_ART = { rocket: 'cohete', banana: 'platano', turbo: 'turbo', shield: 'burbuja' };
const ITEM_ICONS = Object.fromEntries(
  Object.entries(ITEMS).map(([key, item]) => [
    key,
    manifest.objetos.includes(ITEM_ART[key]) ? `<img src="kart/objetos/${ITEM_ART[key]}.png" alt="">` : item.emoji,
  ]),
);
const ROLL_ICONS = Object.values(ITEM_ICONS);

// La última pista que se escogió, para que salga seleccionada la próxima vez.
let lastTrack = 'pradera';

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

    // Si ya se ganó otra pista se escoge; si no, directo a la de siempre.
    this.openTracks = TRACK_KEYS.filter((key) => rewards.unlocked(TRACKS[key].unlock));
    if (this.openTracks.length > 1) this.showChooser();
    else this.build('pradera');
  }

  showChooser() {
    this.phase = 'choose';
    const cards = TRACK_KEYS.map((key) => ({
      ...TRACKS[key],
      open: this.openTracks.includes(key),
      lock: TRACKS[key].unlock ? UNLOCKS[TRACKS[key].unlock].label : '',
    }));
    this.chooser = new TrackChooser(this.view.stage, cards, Math.max(0, TRACK_KEYS.indexOf(lastTrack)));
  }

  updateChooser() {
    const id = players.host()?.deviceId;
    if (!id) return;
    const step = (controls.justPressed(id, 'right') ? 1 : 0) - (controls.justPressed(id, 'left') ? 1 : 0);
    if (step !== 0) this.chooser.move(step);
    if (controls.justPressed(id, 'a')) {
      const key = TRACK_KEYS[this.chooser.selected];
      if (!this.openTracks.includes(key)) return;
      this.chooser.destroy();
      this.chooser = null;
      this.build(key);
    } else if (controls.justPressed(id, 'b') && !this.exited) {
      this.exited = true;
      this.onExit();
    }
  }

  // Arma la pista escogida con su cielo, su piso y sus adornos, y empieza la carrera.
  build(key) {
    lastTrack = key;
    const look = TRACKS[key];
    this.trackKey = key;
    this.scene.background = new THREE.Color(look.sky);
    this.fog = new THREE.Fog(look.sky, 140, 420);
    this.scene.fog = this.fog;
    this.scene.add(new THREE.HemisphereLight(0xffffff, look.groundLight, 1.2));
    const sun = new THREE.DirectionalLight(0xffffff, 1.6);
    sun.position.set(50, 100, 30);
    this.scene.add(sun);

    this.track = new Track({ roadWidth: 18, scale: 1.3, barriers: true, points: look.points, ground: look.ground, snowy: look.snowy });
    this.track.addTo(this.scene);
    this.addMountains(look.mountains);
    if (look.snowy) {
      addSnowmen(this.scene, this.track);
      this.snow = new Snowfall(this.scene, this.track);
    }
    this.boxes = new ItemBoxes(this.scene, this.track);
    this.projectiles = new Projectiles(this.scene);
    this.createRacers();
    this.createViews();
    this.hud = new KartHud(this.view.stage, this.views);
    this.startRace();
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

  createRacers() {
    const humans = players.sorted();
    const taken = new Set(humans.map((player) => player.colorIndex));
    const cpuColors = PLAYER_COLORS.filter((_, i) => !taken.has(i));
    this.racers = humans.map(
      (player) => new Racer({ color: players.color(player).hex, label: `J${player.slot + 1}`, deviceId: player.deviceId }),
    );
    for (let i = 0; this.racers.length < TOTAL_RACERS; i += 1) {
      this.racers.push(new Racer({ color: cpuColors[i % cpuColors.length].hex, label: 'CPU' }));
    }
    this.racers.forEach((racer, i) => {
      racer.lane = CPU_LANES[i];
      this.scene.add(racer.object);
    });
    this.humans = this.racers.filter((racer) => !racer.isCpu);
  }

  createViews() {
    this.views = layoutViews(this.humans.length).map((view, i) => {
      if (view.kind === 'map') return { ...view, camera: this.mapCamera(view) };
      // En la franja ancha de 2 jugadores se abre menos el ángulo para que no se vea estirado.
      const fov = view.w / view.h > 3 ? 42 : 62;
      const camera = new THREE.PerspectiveCamera(fov, view.w / view.h, 0.5, 450);
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
    this.projectiles.clear();
    this.phase = 'countdown';
    this.phaseMs = 0;
    this.raceMs = 0;
    this.finishOrder = [];
    this.firstHumanFinishMs = null;
    this.spokenStep = null;
    this.lastLapSaid = false;
    this.hud.hideResults();
    this.hud.showHelp(true);
    this.updateCameras(0, true);
  }

  update(deltaMs) {
    const dtMs = Math.min(deltaMs, 50);
    const now = performance.now();
    this.phaseMs += dtMs;
    this.updateExit(dtMs);
    if (this.phase === 'choose') {
      this.updateChooser();
      return;
    }
    this.snow?.update(dtMs / 1000);

    if (this.phase === 'countdown') this.updateCountdown();
    else if (this.phase === 'race') this.updateRace(dtMs, now);
    else if (this.phase === 'results') this.updateResults();

    for (const racer of this.racers) racer.render(now);
    this.updateCameras(dtMs / 1000);
    this.updatePanels(now);
    this.render();
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
    this.hud.setCenter('¡YA!');
    this.phase = 'race';
    this.phaseMs = 0;
  }

  updateRace(dtMs, now) {
    this.raceMs += dtMs;
    if (this.raceMs > GO_MS) this.hud.setCenter('');
    if (this.raceMs > HELP_MS) this.hud.showHelp(false);

    const ranking = this.ranking();
    for (const racer of this.racers) {
      // Al llegar a la meta, la computadora maneja por ellos.
      const input = racer.isCpu || racer.finished ? this.cpuInput(racer, ranking) : this.humanInput(racer);
      const offroad = Math.abs(this.track.lateral(racer.x, racer.z, racer.index)) > this.track.roadWidth / 2 + 0.3;
      // Pequeña ayuda a los jugadores que van atrás, para que la carrera sea pareja.
      const topFactor = racer.isCpu ? 1 : 1 + 0.03 * ranking.indexOf(racer);
      racer.update(dtMs, input, offroad, topFactor);
      if (input.useItem) this.useItem(racer, ranking);
      this.keepInside(racer);
      this.updateProgress(racer);
      this.updateWrongWay(racer, dtMs);
    }
    this.separateRacers();
    this.boxes.update(dtMs, now, this.racers, (racer) => this.giveItem(racer));
    this.projectiles.update(dtMs, this.racers, this.track, (victim, projectile) => this.onProjectileHit(victim, projectile));

    const humansDone = this.humans.every((racer) => racer.finished);
    const waitedEnough = this.firstHumanFinishMs !== null && this.raceMs - this.firstHumanFinishMs > RESULTS_AFTER_FIRST_MS;
    if (humansDone || waitedEnough) this.showResults();
  }

  humanInput(racer) {
    const id = racer.deviceId;
    return {
      steer: controls.getStick(id).x,
      gas: controls.isDown(id, 'a') || controls.isDown(id, 'rt') ? 1 : 0,
      brake: controls.isDown(id, 'b') || controls.isDown(id, 'lt') ? 1 : 0,
      nitro: controls.justPressed(id, 'rb'),
      useItem: controls.justPressed(id, 'x'),
    };
  }

  // La CPU apunta a un punto un poco más adelante sobre su carril y usa sus poderes con sentido.
  cpuInput(racer, ranking) {
    const target = this.track.pointAt(racer.index + CPU_LOOKAHEAD, racer.lane);
    const diff = angleDiff(Math.atan2(target.x - racer.x, target.z - racer.z), racer.heading);
    return {
      steer: clamp(-diff * 2.5, -1, 1),
      gas: CPU_GAS,
      brake: 0,
      nitro: racer.nitro >= 1 && Math.abs(diff) < 0.12 && Math.random() < 0.006,
      useItem: !racer.finished && this.cpuWantsItem(racer, ranking),
    };
  }

  cpuWantsItem(racer, ranking) {
    if (!racer.item || racer.rollMs > 0) return false;
    if (racer.item === 'turbo' || racer.item === 'shield') return true;
    if (racer.item === 'rocket') {
      const ahead = ranking[ranking.indexOf(racer) - 1];
      return ahead ? Math.hypot(ahead.x - racer.x, ahead.z - racer.z) < 60 : Math.random() < 0.003;
    }
    const chased = this.racers.some(
      (other) => other !== racer && other.progress < racer.progress && Math.hypot(other.x - racer.x, other.z - racer.z) < 18,
    );
    return chased || Math.random() < 0.003;
  }

  giveItem(racer) {
    if (racer.item || racer.rollMs > 0) return;
    const ranking = this.ranking();
    racer.pendingItem = rollItem(ranking.indexOf(racer) / (ranking.length - 1));
    racer.rollMs = ROLL_MS;
  }

  useItem(racer, ranking) {
    if (!racer.item || racer.rollMs > 0) return;
    const item = racer.item;
    racer.item = null;
    if (item === 'rocket') this.projectiles.addRocket(racer, ranking[ranking.indexOf(racer) - 1] ?? null);
    else if (item === 'banana') this.projectiles.addBanana(racer);
    else if (item === 'turbo') racer.boost(1.7, 2000);
    else if (item === 'shield') racer.shieldMs = SHIELD_MS;
    if (!racer.isCpu) racer.say(ITEMS[item].name, 900);
  }

  onProjectileHit(victim, projectile) {
    const hurt = victim.hit();
    if (!victim.isCpu) victim.say(hurt ? '¡Te dieron! 💫' : '¡La burbuja te salvó!');
    if (hurt && projectile.owner !== victim && !projectile.owner.isCpu) {
      projectile.owner.say('¡Le diste! 🎯');
      rewards.earn('kart-poder');
    }
  }

  // Las llantas de la orilla no dejan salir a nadie: rozarlas frena un poco.
  keepInside(racer) {
    const lateral = this.track.lateral(racer.x, racer.z, racer.index);
    const limit = this.track.wallDistance;
    if (Math.abs(lateral) <= limit) return;
    const normal = this.track.normals[racer.index];
    const push = (Math.abs(lateral) - limit) * Math.sign(lateral);
    racer.x -= normal.x * push;
    racer.z -= normal.z * push;
    racer.speed *= 0.94;
  }

  // Avance en la pista y conteo de vueltas: una vuelta cuenta al cruzar la meta
  // solo si antes pasó por la mitad de la pista.
  updateProgress(racer) {
    const n = this.track.count;
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
    if (racer.lap >= LAPS && !racer.finished) {
      racer.finished = true;
      this.finishOrder.push(racer);
      if (!racer.isCpu && this.finishOrder.length === 1) rewards.earn('kart-gana');
      if (!racer.isCpu) {
        if (this.firstHumanFinishMs === null) this.firstHumanFinishMs = this.raceMs;
        racer.say(`¡Meta! ${this.finishOrder.length}° lugar`, 5000);
      }
      return;
    }
    if (!racer.isCpu && racer.lap > 0) racer.say(racer.lap === LAPS - 1 ? '¡Última vuelta!' : `Vuelta ${racer.lap + 1}`);
    if (!racer.isCpu && racer.lap === LAPS - 1 && !this.lastLapSaid) {
      this.lastLapSaid = true;
      say('¡Última vuelta!');
    }
  }

  updateWrongWay(racer, dtMs) {
    const t = this.track.tangents[racer.index];
    const wrong = racer.speed > 4 && Math.abs(angleDiff(racer.heading, Math.atan2(t.x, t.z))) > 2.1;
    racer.wrongWayMs = wrong ? racer.wrongWayMs + dtMs : 0;
  }

  separateRacers() {
    const list = this.racers;
    for (let i = 0; i < list.length; i += 1) {
      for (let j = i + 1; j < list.length; j += 1) {
        const a = list[i];
        const b = list[j];
        const dx = b.x - a.x;
        const dz = b.z - a.z;
        const dist = Math.hypot(dx, dz) || 0.01;
        const min = RACER_RADIUS * 2;
        if (dist >= min) continue;
        const push = (min - dist) / 2;
        a.x -= (dx / dist) * push;
        a.z -= (dz / dist) * push;
        b.x += (dx / dist) * push;
        b.z += (dz / dist) * push;
        a.speed *= 0.97;
        b.speed *= 0.97;
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
    const ranking = this.ranking();
    this.hud.showResults(
      ranking.map((racer) => ({ label: racer.label, color: hexToCss(racer.color) })),
      this.openTracks.length > 1,
    );
    say(`¡Ganó ${ranking[0].label}!`);
  }

  updateResults() {
    if (this.phaseMs < RESULTS_INPUT_DELAY_MS) return;
    if (this.humans.some((racer) => controls.justPressed(racer.deviceId, 'a'))) this.startRace();
    else if (this.openTracks.length > 1 && this.humans.some((racer) => controls.justPressed(racer.deviceId, 'b'))) this.onRestart?.();
  }

  updatePanels(now) {
    const ranking = this.ranking();
    this.views.forEach((view, i) => {
      if (view.kind !== 'player') return;
      const racer = view.racer;
      const rolling = racer.rollMs > 0;
      const item = rolling ? ROLL_ICONS[Math.floor(now / 90) % ROLL_ICONS.length] : racer.item ? ITEM_ICONS[racer.item] : '';
      const message = racer.messageMs > 0 ? racer.message : racer.wrongWayMs > WRONG_WAY_MS ? '¡Vas al revés! ↩️' : '';
      this.hud.setPanel(i, {
        pos: `${ranking.indexOf(racer) + 1}°`,
        who: `<span style="color:${hexToCss(racer.color)}">${racer.label}</span>`,
        lap: racer.finished ? '¡Meta!' : `Vuelta ${clamp(racer.lap + 1, 1, LAPS)}/${LAPS}`,
        item,
        rolling,
        nitro: Array.from({ length: NITRO_CHARGES }, (_, k) => `<span class="${k < racer.nitro ? '' : 'off'}">🔥</span>`).join(''),
        msg: message,
      });
    });
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
      desiredPos.set(racer.x - fx * 9, 4.6, racer.z - fz * 9);
      desiredLook.set(racer.x + fx * 7, 1.4, racer.z + fz * 7);
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

  // Una pasada por cada pedazo de pantalla (pantalla dividida).
  render() {
    const renderer = this.renderer;
    renderer.setScissorTest(true);
    for (const view of this.views) {
      const y = HEIGHT - view.y - view.h;
      renderer.setViewport(view.x, y, view.w, view.h);
      renderer.setScissor(view.x, y, view.w, view.h);
      const isMap = view.kind === 'map';
      // Alto del letrero: en el mapa, en unidades del mundo; en las cámaras de atrás, unos 28 px en pantalla.
      const labelHeight = isMap ? 9 : (LABEL_PX / view.h) * 2 * Math.tan(THREE.MathUtils.degToRad(view.camera.fov / 2));
      for (const racer of this.racers) {
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
    const holding = this.deviceIds.some((id) => controls.isDown(id, 'y'));
    this.exitMs = holding ? this.exitMs + dtMs : 0;
    (this.hud ?? this.chooser)?.setExitProgress(Math.min(1, this.exitMs / EXIT_HOLD_MS));
    if (this.exitMs >= EXIT_HOLD_MS && !this.exited) {
      this.exited = true;
      this.onExit();
    }
  }

  destroy() {
    this.projectiles?.dispose();
    this.hud?.destroy();
    this.chooser?.destroy();
    this.view.destroy(this.scene);
  }
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

// Diferencia entre dos ángulos, siempre por el lado más corto (entre -π y π).
function angleDiff(a, b) {
  return Math.atan2(Math.sin(a - b), Math.cos(a - b));
}
