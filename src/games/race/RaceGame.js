import * as THREE from 'three';
import { controls } from '../../shared/controls.js';
import { setTimeScale } from '../../shared/clock.js';
import { players, PLAYER_COLORS } from '../../shared/players.js';
import { say } from '../../shared/voice.js';
import { rewards } from '../../shared/rewards.js';
import { hexToCss } from '../../ui/style.js';
import { createStage, WIDTH, HEIGHT } from '../three/stage.js';
import { Track } from '../three/track.js';
import { Kart, KART_RADIUS } from './Kart.js';
import { RaceHud } from './hud.js';

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

// "Carreras": 3 vueltas en 3D con una sola cámara que sigue al grupo (sin pantalla dividida,
// para que el Xbox One S dibuje una sola vez por cuadro). Los lugares vacíos los llenan carros CPU.
export class RaceGame {
  constructor(parent, { onExit }) {
    this.onExit = onExit;
    this.exitMs = 0;
    this.exited = false;

    this.view = createStage(parent);
    this.renderer = this.view.renderer;
    this.hud = new RaceHud(this.view.stage);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87c8f0);
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x5a7a3a, 1.2));
    const sun = new THREE.DirectionalLight(0xffffff, 1.6);
    sun.position.set(50, 100, 30);
    this.scene.add(sun);
    this.camera = new THREE.PerspectiveCamera(50, WIDTH / HEIGHT, 1, 500);
    this.cameraPos = new THREE.Vector3();
    this.cameraLook = new THREE.Vector3();

    this.track = new Track();
    this.track.addTo(this.scene);
    this.createKarts();
    this.startRace();
  }

  createKarts() {
    const humans = players.sorted();
    const taken = new Set(humans.map((player) => player.colorIndex));
    const cpuColors = PLAYER_COLORS.filter((_, i) => !taken.has(i));
    this.karts = humans.map(
      (player) => new Kart({ color: players.color(player).hex, label: `J${player.slot + 1}`, deviceId: player.deviceId }),
    );
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

  // Parrilla de salida: filas de 2 detrás de la meta, los jugadores adelante.
  startRace() {
    const n = this.track.count;
    this.karts.forEach((kart, i) => {
      const row = Math.floor(i / 2);
      const index = n - 8 - row * 8;
      const spot = this.track.pointAt(index, i % 2 === 0 ? -3.2 : 3.2);
      kart.reset(spot.x, spot.z, spot.heading, index);
      kart.progress = kart.lap + index / n;
    });
    this.phase = 'countdown';
    this.phaseMs = 0;
    this.raceMs = 0;
    this.finishOrder = [];
    this.firstHumanFinishMs = null;
    this.spokenStep = null;
    this.announcedLap = 0;
    this.hud.hideResults();
    this.updateCamera(0, true);
  }

  update(deltaMs) {
    const dtMs = Math.min(deltaMs, 50);
    this.phaseMs += dtMs;
    this.updateExit(dtMs);

    if (this.phase === 'countdown') this.updateCountdown();
    else if (this.phase === 'race') this.updateRace(dtMs);
    else if (this.phase === 'results') this.updateResults();

    const now = performance.now();
    for (const kart of this.karts) kart.render(now);
    this.updateCamera(dtMs / 1000);
    this.updateStandings();
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
      const input = kart.isCpu ? this.cpuInput(kart) : this.humanInput(kart);
      const offroad = kart.trackDistance > halfRoad + 0.5;
      // Pequeña ayuda a los jugadores que van atrás, para que la carrera sea pareja.
      const bonus = kart.isCpu ? 1 : 1 + 0.04 * ranking.indexOf(kart);
      kart.update(dtMs, input, offroad, bonus);
      this.updateProgress(kart);
      if (kart.trackDistance > halfRoad + RESCUE_MARGIN) {
        kart.teleport(this.track.pointAt(kart.index), kart.index, 0);
        kart.trackDistance = 0;
      }
    }
    this.separateKarts();
    this.catchUpStragglers();

    const humansDone = this.humans.every((kart) => kart.finished);
    const waitedEnough = this.firstHumanFinishMs !== null && this.raceMs - this.firstHumanFinishMs > RESULTS_AFTER_FIRST_MS;
    if (humansDone || waitedEnough) this.showResults();
  }

  humanInput(kart) {
    const stick = controls.getStick(kart.deviceId);
    return {
      x: stick.x,
      y: stick.y,
      turbo: controls.justPressed(kart.deviceId, 'a'),
      brake: controls.isDown(kart.deviceId, 'b'),
    };
  }

  // La CPU apunta a un punto un poco más adelante sobre su carril.
  cpuInput(kart) {
    const target = this.track.pointAt(kart.index + CPU_LOOKAHEAD, kart.lane);
    const dx = target.x - kart.x;
    const dz = target.z - kart.z;
    const dist = Math.hypot(dx, dz) || 1;
    return {
      x: (dx / dist) * CPU_PUSH,
      y: (dz / dist) * CPU_PUSH,
      turbo: kart.turboReady() && Math.random() < 0.004,
      brake: false,
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
    }));
    this.hud.setStandings(rows);
  }

  showResults() {
    this.phase = 'results';
    this.phaseMs = 0;
    const ranking = this.ranking();
    this.hud.showResults(ranking.map((kart) => ({ label: kart.label, color: hexToCss(kart.color) })));
    say(`¡Ganó ${ranking[0].label}!`);
  }

  updateResults() {
    // Los carros se detienen solos mientras se ven los resultados.
    for (const kart of this.karts) kart.speed *= 0.9;
    if (this.phaseMs < RESULTS_INPUT_DELAY_MS) return;
    if (this.humans.some((kart) => controls.justPressed(kart.deviceId, 'a'))) this.startRace();
  }

  // Cámara desde arriba que encuadra a todos los jugadores; se aleja cuando están separados.
  updateCamera(dt, snap = false) {
    const focus = this.humans.length > 0 ? this.humans : this.karts;
    const cx = focus.reduce((sum, k) => sum + k.x, 0) / focus.length;
    const cz = focus.reduce((sum, k) => sum + k.z, 0) / focus.length;
    const spread = Math.max(...focus.map((k) => Math.hypot(k.x - cx, k.z - cz)));
    const height = Math.min(70, Math.max(34, 30 + spread * 0.9));
    const desiredPos = new THREE.Vector3(cx, height, cz + height * 0.7);
    const desiredLook = new THREE.Vector3(cx, 0, cz - 4);
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
    if (this.exitMs >= EXIT_HOLD_MS && !this.exited) {
      this.exited = true;
      this.onExit();
    }
  }

  destroy() {
    this.hud.destroy();
    this.view.destroy(this.scene);
  }
}
