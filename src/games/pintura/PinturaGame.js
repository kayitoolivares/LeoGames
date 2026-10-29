import * as THREE from 'three';
import { controls } from '../../shared/controls.js';
import { setTimeScale } from '../../shared/clock.js';
import { players } from '../../shared/players.js';
import { noise, sfx } from '../../shared/sound.js';
import { say } from '../../shared/voice.js';
import { rewards } from '../../shared/rewards.js';
import { characterPicks } from '../../shared/picks.js';
import { hexToCss } from '../../ui/style.js';
import { defaultCharacter } from '../../scenes/CharacterSelectScene.js';
import { CHARACTER_KEYS } from '../smash/characters.js';
import { blockImageUrl, characterImageUrl, DriverArt, driverView } from '../kart/drivers.js';
import kartArt from '../kart/art.json';
import { createStage, WIDTH, HEIGHT } from '../three/stage.js';
import { ARENAS, ARENA_KEYS, buildArena } from './arenas.js';
import { DropMeshes, FloorPaint, Splats, cssColor } from './paint.js';
import { blasterModel, Painter } from './Painter.js';
import { BALLOON, ballisticPitch, ROLLER, WEAPONS } from './weapons.js';
import { angleDiff, botInput, LEVELS } from './bots.js';
import { Robots, WAVES } from './robots.js';
import { PaintHud } from './hud.js';
import { pinturaIcon } from './art.js';

const TEAMS = [
  { name: 'Rosas', color: 0xff4fa3 },
  { name: 'Turquesas', color: 0x1fd1c1 },
];
const ROBOT_TEAM = { name: 'Robots', color: 0x9b6bff };
const MODES = [
  { key: 'piso', emoji: '🎨', name: 'Pinta el piso', detail: 'Gana el equipo que pinte más piso' },
  { key: 'equipos', emoji: '💦', name: 'Equipos', detail: 'Gana el equipo que pinte más veces a los rivales' },
  { key: 'robots', emoji: '🤖', name: 'Contra robots', detail: 'Todos juntos contra 5 oleadas de robotitos' },
];
const MINUTES = [2, 3, 4];
const SIDES = [
  { key: 'juntos', name: 'Todos contra la compu' },
  { key: 'contra', name: 'Unos contra otros' },
];
const SIZES = [2, 3, 4];
const LEVEL_KEYS = Object.keys(LEVELS);
// Lo último que se escogió (para la revancha y la próxima vez que entren en esta sesión) y quién juega en modo peque.
let lastSetup = { mode: 'piso', arena: 'parque', minutes: 3, sides: 'juntos', size: 4, level: 'facil' };
const pequeByDevice = new Map();

const COUNTDOWN_STEP_MS = 800;
const RESPAWN_MS = { normal: 3000, peque: 2200 };
const ENDING_MS = 1700;
const RESULTS_INPUT_DELAY_MS = 1200;
const EXIT_HOLD_MS = 1200;
// La compu pinta un poquito menos fuerte en fácil.
const BOT_DAMAGE = { facil: 0.7, normal: 1 };
// Contra los robots, los amigos de la compu ayudan pero no hacen todo el trabajo.
const BOT_VS_ROBOTS = 0.6;
// El modo peque aguanta más (ver Painter) y recibe menos pintura de cada gota.
const PEQUE_DAMAGE = 0.65;
// Mirar con el stick derecho (radianes por segundo) y apuntando con LT.
const LOOK = { yaw: 2.9, pitch: 1.9, aimSlow: 0.5, minPitch: -1.05, maxPitch: 0.9 };
const ZOOM = 0.72;
// La ayuda para apuntar: qué tan abierto es el cono donde la mira "se pega" al rival y qué tan rápido lo sigue.
const ASSIST = { normal: { cone: 0.16, pull: 1.1 }, peque: { cone: 0.32, pull: 2.4 } };
// En "Contra robots": corazones del equipo (cada vez que pintan a alguien se pierde uno).
const HEARTS = 8;
const WAVE_PAUSE_MS = 2600;
// Las gotas solo de adorno (la explosión de color cuando pintan a alguien).
const BURST_DROPS = 10;

// "Guerra de pintura": en primera persona, al estilo Splatoon, con pistolas de pintura (nada de armas de verdad).
// Pantalla dividida para 1 a 4 jugadores; la compu llena los equipos. Modos: Pinta el piso, Equipos y Contra robots.
export class PinturaGame {
  constructor(parent, { onExit }) {
    this.onExit = onExit;
    this.exitMs = 0;
    this.exited = false;
    this.view = createStage(parent);
    this.renderer = this.view.renderer;
    this.hud = new PaintHud(this.view.stage);
    this.scene = new THREE.Scene();
    this.hemi = new THREE.HemisphereLight(0xffffff, 0xb8a890, 1.9);
    this.scene.add(this.hemi);
    const sun = new THREE.DirectionalLight(0xffffff, 1.5);
    sun.position.set(30, 80, 20);
    this.scene.add(sun);
    this.drivers = new DriverArt();
    this.settings = { ...lastSetup };
    this.row = 0;
    this.humans = players.sorted().map((player) => ({
      deviceId: player.deviceId,
      label: `J${player.slot + 1}`,
      color: players.color(player).hex,
      character: characterPicks.get(player.deviceId, defaultCharacter(player)),
    }));
    this.painters = [];
    this.drops = [];
    this.balloons = [];
    this.robots = null;
    this.previewCamera = new THREE.PerspectiveCamera(55, WIDTH / HEIGHT, 0.5, 500);
    this.previewAngle = 0;
    this.loadArena(this.settings.arena);
    this.openSetup();
  }

  // ---------- La arena ----------
  // Arma la arena (y la pintura limpia). La anterior se suelta: en el Xbox la memoria es poca.
  loadArena(key) {
    this.clearArena();
    const def = ARENAS[key];
    this.arenaKey = key;
    const panoramaUrl = kartArt.fondos?.includes(def.panorama) ? `kart/fondos/${def.panorama}.jpg` : null;
    this.arena = buildArena(key, { panoramaUrl });
    this.world = this.arena.world;
    this.scene.add(this.arena.group);
    this.scene.background = new THREE.Color(def.sky);
    this.fog = new THREE.Fog(def.sky, 60, 170);
    this.scene.fog = this.fog;
    this.teamLooks = this.settings.mode === 'robots' ? [TEAMS[0], ROBOT_TEAM] : TEAMS;
    this.floor = new FloorPaint(def, this.world, this.teamLooks);
    this.scene.add(this.floor.mesh);
    this.splats = new Splats(this.scene, this.teamLooks);
    this.dropMeshes = new DropMeshes(this.scene, this.teamLooks);
  }

  clearArena() {
    if (!this.arena) return;
    this.scene.remove(this.arena.group);
    this.arena.dispose();
    this.scene.remove(this.floor.mesh);
    this.floor.dispose();
    this.splats.dispose();
    this.dropMeshes.dispose();
    this.arena = null;
  }

  // ---------- Las opciones ----------
  openSetup() {
    this.phase = 'setup';
    this.phaseMs = 0;
    this.hud.hideResults();
    this.hud.setTop('');
    this.hud.setCenter('');
    this.hud.panelsEl.style.display = 'none';
    this.hud.showHelp(true);
    this.showSetup();
    say('Guerra de pintura');
  }

  // Los renglones de opciones: { key, label, value, detail, dim, options }.
  setupRows() {
    const s = this.settings;
    const robots = s.mode === 'robots';
    const mode = MODES.find((m) => m.key === s.mode);
    const arena = ARENAS[s.arena];
    return [
      { key: 'mode', label: 'Modo', options: MODES.map((m) => m.key), value: `${mode.emoji} ${mode.name}`, detail: mode.detail },
      { key: 'arena', label: 'Arena', options: ARENA_KEYS, value: `${arena.emoji} ${arena.name}` },
      { key: 'minutes', label: 'Tiempo', options: MINUTES, value: `⏱️ ${s.minutes} minutos`, dim: robots },
      {
        key: 'sides',
        label: 'Equipos',
        options: SIDES.map((side) => side.key),
        value: SIDES.find((side) => side.key === s.sides).name,
        dim: robots || this.humans.length < 2,
      },
      { key: 'size', label: robots ? 'Tu equipo' : 'Por equipo', options: SIZES, value: `${s.size} pintores` },
      { key: 'level', label: 'Compu', options: LEVEL_KEYS, value: LEVELS[s.level].name },
    ];
  }

  showSetup() {
    const rows = this.setupRows().map((row, i) => ({ ...row, on: i === this.row }));
    const teams = this.teamsFor(this.humans.length);
    this.hud.showSetup({
      title: '🎨 Guerra de pintura',
      rows,
      players: this.humans.map((human, i) => ({
        label: human.label,
        color: hexToCss(human.color),
        teamColor: cssColor(TEAMS[teams[i]].color),
        image: this.faceOf(human.character),
        peque: pequeByDevice.get(human.deviceId) ?? false,
      })),
      help: '↑ ↓ escoger  ·  ◀ ▶ cambiar  ·  Y = modo peque 🐣 (cada quien)  ·  A = ¡a pintar!  ·  B = salir',
    });
  }

  // A qué equipo va cada jugador (0 o 1).
  teamsFor(count) {
    const apart = this.settings.mode !== 'robots' && this.settings.sides === 'contra';
    return Array.from({ length: count }, (_, i) => (apart ? i % 2 : 0));
  }

  updateSetup() {
    const host = this.humans[0];
    if (!host) return;
    const id = host.deviceId;
    const rows = this.setupRows();
    let changed = false;
    const enabled = (i) => !rows[i].dim;
    const moveRow = (step) => {
      let next = this.row;
      for (let k = 0; k < rows.length; k += 1) {
        next = (next + step + rows.length) % rows.length;
        if (enabled(next)) break;
      }
      this.row = next;
    };
    if (controls.justPressed(id, 'down')) {
      moveRow(1);
      changed = true;
      sfx.select();
    } else if (controls.justPressed(id, 'up')) {
      moveRow(-1);
      changed = true;
      sfx.select();
    }
    const step = controls.justPressed(id, 'right') ? 1 : controls.justPressed(id, 'left') ? -1 : 0;
    const row = rows[this.row];
    if (step && !row.dim) {
      const index = row.options.indexOf(this.settings[row.key]);
      this.settings[row.key] = row.options[(index + step + row.options.length) % row.options.length];
      if (row.key === 'arena') this.loadArena(this.settings.arena);
      if (row.key === 'mode' && !enabled(this.row)) moveRow(1);
      changed = true;
      sfx.select();
      say(this.setupRows()[this.row].value.replace(/^\S+\s/, ''));
    }
    // Cada quien prende o apaga su modo peque con Y.
    for (const human of this.humans) {
      if (!controls.justPressed(human.deviceId, 'y') || controls.isDown(human.deviceId, 'lb')) continue;
      const peque = !(pequeByDevice.get(human.deviceId) ?? false);
      pequeByDevice.set(human.deviceId, peque);
      sfx.confirm();
      say(peque ? `${human.label} en modo peque` : `${human.label} en modo normal`);
      changed = true;
    }
    if (changed) this.showSetup();
    if (this.phaseMs < 300) return;
    if (controls.justPressed(id, 'a')) {
      sfx.confirm();
      this.startMatch();
    } else if (controls.justPressed(id, 'b')) {
      sfx.back();
      this.exit();
    }
  }

  // ---------- La partida ----------
  startMatch() {
    lastSetup = { ...this.settings };
    const robots = this.settings.mode === 'robots';
    // Pintura limpia (y los colores del modo).
    this.loadArena(this.settings.arena);
    this.hud.hideSetup();
    this.hud.hideResults();
    this.clearPainters();
    this.drops = [];
    this.clearBalloons();

    // Los equipos: los jugadores según la opción y la compu llena los lugares que faltan.
    const teams = this.teamsFor(this.humans.length);
    const size = Math.max(this.settings.size, ...[0, 1].map((team) => teams.filter((t) => t === team).length));
    const taken = new Set(this.humans.map((human) => human.character));
    const free = CHARACTER_KEYS.filter((key) => !taken.has(key)).sort(() => Math.random() - 0.5);
    const make = (options) => {
      const painter = new Painter({ ...options, teamColor: this.teamLooks[options.team].color, drivers: this.drivers });
      this.scene.add(painter.object);
      this.painters.push(painter);
      return painter;
    };
    this.humans.forEach((human, i) =>
      make({ team: teams[i], character: human.character, deviceId: human.deviceId, label: human.label, peque: pequeByDevice.get(human.deviceId) ?? false }),
    );
    let cpu = 0;
    for (const team of robots ? [0] : [0, 1]) {
      while (this.painters.filter((p) => p.team === team).length < size) {
        const bot = make({ team, character: free[cpu % free.length], label: 'CPU', cpu: true });
        // La compu trae lanzadores distintos (casi siempre el chorrito).
        bot.weaponIndex = [0, 0, 0, 1, 2][Math.floor(Math.random() * 5)];
        cpu += 1;
      }
    }
    this.humanPainters = this.painters.filter((painter) => !painter.isCpu);
    for (const painter of this.humanPainters) {
      painter.gun = blasterModel(painter.weapon.key, painter.teamColor);
      painter.gun.visible = false;
      this.scene.add(painter.gun);
    }
    this.placeAtBases();
    this.createViews();

    this.score = [0, 0];
    this.timeLeftMs = this.settings.minutes * 60000;
    this.announced = new Set();
    this.result = null;
    this.lastTalkMs = 0;
    if (robots) {
      this.robots = new Robots(this.scene);
      this.wave = 0;
      this.hearts = HEARTS;
      this.waveMs = WAVE_PAUSE_MS;
      this.waveActive = false;
    }
    this.phase = 'countdown';
    this.phaseMs = 0;
    this.spokenStep = null;
  }

  placeAtBases() {
    const used = [0, 0];
    for (const painter of this.painters) {
      const spots = this.arena.spawns[painter.team];
      painter.reset(spots[used[painter.team] % spots.length]);
      used[painter.team] += 1;
      painter.ai = null;
    }
  }

  // Cómo se reparte la pantalla: 1 jugador = completa, 2 = arriba y abajo, 3 o 4 = cuatro cuadros (con 3, el cuarto
  // enseña el piso visto desde arriba).
  createViews() {
    const count = this.humanPainters.length;
    let layout;
    if (count <= 1) layout = [{ x: 0, y: 0, w: WIDTH, h: HEIGHT, scale: 1, kind: 'player' }];
    else if (count === 2) layout = [0, 1].map((i) => ({ x: 0, y: (i * HEIGHT) / 2, w: WIDTH, h: HEIGHT / 2, scale: 0.72, kind: 'player' }));
    else {
      layout = [0, 1, 2, 3].map((i) => ({
        x: (i % 2) * (WIDTH / 2),
        y: Math.floor(i / 2) * (HEIGHT / 2),
        w: WIDTH / 2,
        h: HEIGHT / 2,
        scale: 0.6,
        kind: i < count ? 'player' : 'map',
      }));
    }
    this.views = layout.map((view, i) => {
      if (view.kind === 'map') return { ...view, camera: this.mapCamera(view) };
      // (En la franja ancha de 2 jugadores se abre menos el ángulo para que no se vea estirado.)
      const fov = view.w / view.h > 3 ? 42 : 64;
      const camera = new THREE.PerspectiveCamera(fov, view.w / view.h, 0.1, 400);
      return { ...view, camera, fov, painter: this.humanPainters[i] };
    });
    this.hud.setViews(this.views);
    this.hud.panelsEl.style.display = '';
  }

  // Cámara desde arriba que enseña toda la arena (el norte arriba).
  mapCamera(view) {
    const { halfW, halfD } = this.world;
    let w = halfW * 2 + 6;
    let h = halfD * 2 + 6;
    const aspect = view.w / view.h;
    if (w / h < aspect) w = h * aspect;
    else h = w / aspect;
    const camera = new THREE.OrthographicCamera(-w / 2, w / 2, h / 2, -h / 2, 1, 300);
    camera.position.set(0, 120, 0);
    camera.up.set(0, 0, -1);
    camera.lookAt(0, 0, 0);
    return camera;
  }

  update(deltaMs) {
    const dtMs = Math.min(deltaMs, 50);
    this.phaseMs += dtMs;
    this.updateExit(dtMs);
    if (this.phase === 'setup') this.updateSetup();
    else if (this.phase === 'countdown') this.updateCountdown(dtMs);
    else if (this.phase === 'play') this.updatePlay(dtMs);
    else if (this.phase === 'ending') this.updateEnding(dtMs);
    else if (this.phase === 'results') this.updateResults();
    this.render(dtMs);
  }

  updateCountdown(dtMs) {
    const step = Math.floor(this.phaseMs / COUNTDOWN_STEP_MS);
    if (step !== this.spokenStep) {
      this.spokenStep = step;
      if (step < 3) sfx.countdown();
      say(step < 3 ? String(3 - step) : '¡A pintar!');
    }
    // Mientras cuentan, ya se puede mirar alrededor.
    for (const painter of this.humanPainters) this.look(painter, dtMs);
    this.updateHudTop();
    if (step < 3) {
      this.hud.setCenter(String(3 - step));
      return;
    }
    this.hud.setCenter('');
    sfx.countdown(true);
    this.hud.flash(this.settings.mode === 'robots' ? '🤖 ¡Ahí vienen los robots!' : '🎨 ¡A pintar!', 1100);
    this.hud.showHelp(false);
    this.phase = 'play';
    this.phaseMs = 0;
  }

  updatePlay(dtMs) {
    if (this.settings.mode !== 'robots') {
      this.timeLeftMs -= dtMs;
      this.announceTime();
      if (this.timeLeftMs <= 0) {
        this.timeLeftMs = 0;
        this.finish();
        return;
      }
    }
    for (const painter of this.painters) this.updatePainter(painter, dtMs);
    if (this.robots) this.updateRobots(dtMs);
    this.updateDrops(dtMs);
    this.updateBalloons(dtMs);
    this.floor.update(dtMs);
    this.updateHudTop();
  }

  announceTime() {
    for (const [ms, text] of [
      [60000, '¡Último minuto!'],
      [10000, '¡Diez segundos!'],
    ]) {
      if (this.timeLeftMs <= ms && !this.announced.has(ms) && this.settings.minutes * 60000 > ms) {
        this.announced.add(ms);
        this.hud.flash(text, 1300);
        say(text);
      }
    }
  }

  updatePainter(painter, dtMs) {
    if (!painter.alive) {
      painter.respawnMs -= dtMs;
      if (painter.respawnMs <= 0) this.respawn(painter);
      return;
    }
    const input = painter.isCpu ? botInput(this, painter, dtMs) : this.humanInput(painter, dtMs);
    const weapon = painter.weapon;
    const speed = Math.hypot(painter.vx, painter.vz);
    const rolling = Boolean(weapon.roller && input.fire && painter.onGround && speed > 1.5 && !input.swim);
    painter.move(dtMs, { ...input, rolling }, this.world, this.floor);
    painter.tick(dtMs);
    if (painter.swimming) return;
    if (rolling) this.roll(painter, dtMs);
    else if (input.fire) this.fire(painter);
    if (input.balloon) this.throwBalloon(painter);
  }

  // ---------- Los controles ----------
  humanInput(painter, dtMs) {
    const id = painter.deviceId;
    const kind = controls.getDevice(id)?.kind;
    const stick = controls.getStick(id);
    // En la pantalla táctil no hay stick derecho: el stick gira y avanza (como tanque) y A pinta.
    if (kind === 'touch') {
      painter.yaw -= stick.x * LOOK.yaw * 0.7 * (dtMs / 1000);
      this.assist(painter, dtMs, true);
      return {
        moveX: 0,
        moveY: stick.y,
        fire: controls.isDown(id, 'a'),
        jump: controls.justPressed(id, 'b'),
        swim: false,
        balloon: controls.justPressed(id, 'x'),
        aim: false,
      };
    }
    if (controls.justPressed(id, 'rb') && !controls.isDown(id, 'lb')) this.switchWeapon(painter, 1);
    else if (controls.justPressed(id, 'lb') && !controls.isDown(id, 'rb')) this.switchWeapon(painter, -1);
    const aim = controls.isDown(id, 'lt');
    const lookStick = this.look(painter, dtMs, aim);
    this.assist(painter, dtMs, Math.abs(lookStick.y) < 0.25);
    return {
      moveX: stick.x,
      moveY: stick.y,
      fire: controls.isDown(id, 'rt'),
      jump: controls.justPressed(id, 'a'),
      swim: controls.isDown(id, 'b'),
      balloon: controls.justPressed(id, 'x'),
      aim,
    };
  }

  // El stick derecho gira la vista (más fino cerca del centro, más lento apuntando con LT).
  look(painter, dtMs, aim = false) {
    const stick = controls.getLook(painter.deviceId);
    const slow = aim ? LOOK.aimSlow : 1;
    const curve = (v) => Math.sign(v) * v * v;
    painter.yaw -= curve(stick.x) * LOOK.yaw * slow * (dtMs / 1000);
    painter.pitch = Math.min(LOOK.maxPitch, Math.max(LOOK.minPitch, painter.pitch - curve(stick.y) * LOOK.pitch * slow * (dtMs / 1000)));
    painter.aiming = aim;
    return stick;
  }

  // La ayuda para apuntar: si un rival queda cerquita de la mira, la mira lo va siguiendo solita y se acomoda a su
  // altura (con la caída de la pintura). Más fuerte en modo peque.
  assist(painter, dtMs, adjustPitch) {
    const help = painter.peque ? ASSIST.peque : ASSIST.normal;
    const weapon = painter.weapon;
    let best = null;
    let bestAngle = help.cone;
    for (const target of this.targetsFor(painter.team)) {
      const dx = target.x - painter.x;
      const dz = target.z - painter.z;
      const dist = Math.hypot(dx, dz);
      if (dist > weapon.range * 1.15 || dist < 0.5) continue;
      if (target.swimming && dist > 5) continue;
      const angle = Math.abs(angleDiff(Math.atan2(dx, dz), painter.yaw));
      if (angle >= bestAngle) continue;
      if (!this.world.lineOfSight(painter.x, painter.z, target.x, target.z, Math.max(painter.y, target.y) + 1.4)) continue;
      best = target;
      bestAngle = angle;
    }
    painter.assistTarget = best;
    if (!best) return;
    const desired = Math.atan2(best.x - painter.x, best.z - painter.z);
    const step = (help.pull * dtMs) / 1000;
    painter.yaw += Math.max(-step, Math.min(step, angleDiff(desired, painter.yaw)));
    if (adjustPitch) {
      const pitch = this.pitchTo(painter, best, weapon.speed, weapon.gravity);
      if (pitch !== null) painter.pitch += (pitch - painter.pitch) * Math.min(1, (dtMs / 1000) * 6);
    }
  }

  // El ángulo para que la pintura le caiga a `target` (desde los ojos de `painter`).
  pitchTo(painter, target, speed, gravity) {
    const dist = Math.hypot(target.x - painter.x, target.z - painter.z);
    const rise = target.y + target.aimHeight - (painter.y + painter.eye);
    return ballisticPitch(dist, rise, speed, gravity);
  }

  switchWeapon(painter, step) {
    painter.weaponIndex = (painter.weaponIndex + step + WEAPONS.length) % WEAPONS.length;
    painter.fireMs = 200;
    if (painter.gun) {
      this.scene.remove(painter.gun);
      painter.gun.userData.dispose();
      painter.gun = blasterModel(painter.weapon.key, painter.teamColor);
      painter.gun.visible = false;
      this.scene.add(painter.gun);
    }
    sfx.select();
    const index = this.viewIndexOf(painter);
    if (index >= 0) this.hud.panelMessage(index, `${painter.weapon.emoji} ${painter.weapon.name}`, 900);
  }

  viewIndexOf(painter) {
    return this.views?.findIndex((view) => view.painter === painter) ?? -1;
  }

  // ---------- Pintar ----------
  // Un disparo del lanzador (manteniendo RT sale uno cada `weapon.every`).
  fire(painter) {
    const weapon = painter.weapon;
    if (painter.fireMs > 0) return;
    if (painter.ink < weapon.ink) {
      if (!painter.isCpu && !painter.inkWarned) {
        painter.inkWarned = true;
        const index = this.viewIndexOf(painter);
        if (index >= 0) this.hud.panelMessage(index, '¡Sin tinta! Nada en tu tinta con B', 1500);
        sfx.back();
      }
      return;
    }
    painter.inkWarned = false;
    painter.fireMs = weapon.every;
    painter.ink -= weapon.ink;
    painter.lastShotMs = 0;
    painter.shootPoseMs = 220;
    const aim = this.aimFor(painter, weapon.speed, weapon.gravity);
    const eye = { x: painter.x, y: painter.y + painter.eye - 0.15, z: painter.z };
    for (let i = 0; i < weapon.drops; i += 1) {
      const spreadYaw = weapon.drops > 1 ? (i - (weapon.drops - 1) / 2) * weapon.spread : (Math.random() * 2 - 1) * weapon.spread;
      const spreadPitch = (Math.random() * 2 - 1) * weapon.spread * 0.5;
      const yaw = aim.yaw + spreadYaw;
      const pitch = aim.pitch + spreadPitch;
      const dir = { x: Math.sin(yaw) * Math.cos(pitch), y: Math.sin(pitch), z: Math.cos(yaw) * Math.cos(pitch) };
      this.drops.push({
        x: eye.x + dir.x * 0.7,
        y: eye.y + dir.y * 0.7,
        z: eye.z + dir.z * 0.7,
        vx: dir.x * weapon.speed + painter.vx * 0.3,
        vy: dir.y * weapon.speed,
        vz: dir.z * weapon.speed + painter.vz * 0.3,
        gravity: weapon.gravity,
        team: painter.team,
        owner: painter,
        damage: weapon.damage * (painter.isCpu ? BOT_DAMAGE[this.settings.level] * (this.robots ? BOT_VS_ROBOTS : 1) : 1),
        splat: weapon.splat,
        size: weapon.size ?? 1,
        lifeMs: 3000,
      });
    }
    if (!painter.isCpu) squirt(weapon.key === 'largo');
  }

  // Hacia dónde sale la pintura: a donde ve; con la ayuda para apuntar, justo al rival que tiene en la mira.
  aimFor(painter, speed, gravity) {
    const target = !painter.isCpu ? painter.assistTarget : null;
    if (target?.alive) {
      const pitch = this.pitchTo(painter, target, speed, gravity);
      if (pitch !== null) return { yaw: Math.atan2(target.x - painter.x, target.z - painter.z), pitch };
    }
    return { yaw: painter.yaw, pitch: painter.pitch };
  }

  // El rodillo caminando: deja una franja de pintura y atropella a los rivales que tiene enfrente.
  roll(painter, dtMs) {
    painter.rollMs -= dtMs;
    painter.shootPoseMs = 150;
    if (painter.rollMs > 0) return;
    painter.rollMs = ROLLER.everyMs;
    if (painter.ink < ROLLER.ink) return;
    painter.ink -= ROLLER.ink;
    painter.lastShotMs = 0;
    const fx = Math.sin(painter.yaw);
    const fz = Math.cos(painter.yaw);
    this.paintAt(painter.x + fx * 1.1, painter.y, painter.z + fz * 1.1, ROLLER.radius, painter.team, painter);
    const now = performance.now();
    for (const target of this.targetsFor(painter.team)) {
      const dx = target.x - painter.x;
      const dz = target.z - painter.z;
      const dist = Math.hypot(dx, dz);
      if (dist > ROLLER.reach + target.radius || (dx * fx + dz * fz) / (dist || 1) < 0.2 || Math.abs(target.y - painter.y) > 1.5) continue;
      if (now - (painter.rollHits.get(target) ?? -1e9) < ROLLER.hitEveryMs) continue;
      painter.rollHits.set(target, now);
      this.hitTarget(target, ROLLER.damage, painter, painter.team);
    }
  }

  // Pintura en un punto: en el piso cuenta para el marcador; en una caja o rampa es una calcomanía.
  paintAt(x, y, z, radius, team, owner = null) {
    if (y < 0.05) {
      const gained = this.floor.splat(x, z, radius, team);
      if (owner?.stats) owner.stats.painted += gained;
    } else {
      this.splats.add(team, x, y, z, [0, 1, 0], radius);
    }
  }

  throwBalloon(painter) {
    if (painter.balloonMs > 0 || painter.ink < BALLOON.ink) return;
    painter.ink -= BALLOON.ink;
    painter.balloonMs = BALLOON.every;
    painter.lastShotMs = 0;
    painter.shootPoseMs = 300;
    let { yaw, pitch } = this.aimFor(painter, BALLOON.speed, BALLOON.gravity);
    // (Sin a quién apuntarle, sale un poquito hacia arriba para que llegue lejos.)
    if (!painter.assistTarget || painter.isCpu) pitch = Math.max(pitch + 0.25, 0.15);
    const dir = { x: Math.sin(yaw) * Math.cos(pitch), y: Math.sin(pitch), z: Math.cos(yaw) * Math.cos(pitch) };
    const mesh = new THREE.Mesh(this.balloonGeometry(), new THREE.MeshLambertMaterial({ color: this.teamLooks[painter.team].color }));
    const from = { x: painter.x + dir.x * 0.8, y: painter.y + painter.eye, z: painter.z + dir.z * 0.8 };
    mesh.position.set(from.x, from.y, from.z);
    this.scene.add(mesh);
    this.balloons.push({
      ...from,
      vx: dir.x * BALLOON.speed,
      vy: dir.y * BALLOON.speed,
      vz: dir.z * BALLOON.speed,
      team: painter.team,
      owner: painter,
      mesh,
      lifeMs: 4000,
    });
    sfx.throw();
  }

  balloonGeometry() {
    this.sharedBalloon ??= new THREE.SphereGeometry(0.38, 10, 8);
    return this.sharedBalloon;
  }

  // ---------- Las gotas en el aire ----------
  updateDrops(dtMs) {
    const dt = dtMs / 1000;
    const keep = [];
    for (const drop of this.drops) {
      drop.lifeMs -= dtMs;
      const speed = Math.hypot(drop.vx, drop.vy, drop.vz);
      const steps = Math.max(1, Math.ceil((speed * dt) / 0.45));
      const h = dt / steps;
      let alive = drop.lifeMs > 0;
      for (let s = 0; s < steps && alive; s += 1) {
        const from = { x: drop.x, y: drop.y, z: drop.z };
        drop.vy -= drop.gravity * h;
        drop.x += drop.vx * h;
        drop.y += drop.vy * h;
        drop.z += drop.vz * h;
        alive = this.stepDrop(drop, from);
      }
      if (alive) keep.push(drop);
    }
    this.drops = keep;
    this.dropMeshes.sync(this.drops);
  }

  // Un pasito de una gota. Devuelve false si ya chocó (contra alguien, una pared, una caja o el piso).
  stepDrop(drop, from) {
    if (!drop.visual) {
      for (const target of this.targetsFor(drop.team)) {
        if (!touches(target, drop)) continue;
        this.hitTarget(target, drop.damage, drop.owner, drop.team);
        if (target.y < 0.05) this.paintAt(target.x, 0, target.z, 0.8, drop.team, drop.owner);
        return false;
      }
    }
    const hit = this.world.hit(drop.x, drop.y, drop.z, from);
    if (hit) {
      const ny = hit.normal[1];
      const x = hit.x ?? drop.x;
      const y = hit.y ?? drop.y;
      const z = hit.z ?? drop.z;
      this.splats.add(drop.team, x, y, z, hit.normal, drop.splat * (ny > 0 ? 0.9 : 0.75));
      return false;
    }
    if (drop.y <= 0) {
      this.paintAt(drop.x, 0, drop.z, drop.splat, drop.team, drop.visual ? null : drop.owner);
      return false;
    }
    return Math.abs(drop.x) < this.world.halfW + 3 && Math.abs(drop.z) < this.world.halfD + 3;
  }

  updateBalloons(dtMs) {
    const dt = dtMs / 1000;
    const keep = [];
    for (const balloon of this.balloons) {
      balloon.lifeMs -= dtMs;
      const steps = 3;
      const h = dt / steps;
      let boom = balloon.lifeMs <= 0;
      for (let s = 0; s < steps && !boom; s += 1) {
        const from = { x: balloon.x, y: balloon.y, z: balloon.z };
        balloon.vy -= BALLOON.gravity * h;
        balloon.x += balloon.vx * h;
        balloon.y += balloon.vy * h;
        balloon.z += balloon.vz * h;
        boom =
          balloon.y <= 0.2 ||
          Boolean(this.world.hit(balloon.x, balloon.y, balloon.z, from)) ||
          this.targetsFor(balloon.team).some((target) => touches(target, balloon, 0.3));
      }
      balloon.mesh.position.set(balloon.x, balloon.y, balloon.z);
      balloon.mesh.rotation.x += dt * 6;
      if (boom) this.explode(balloon);
      else keep.push(balloon);
    }
    this.balloons = keep;
  }

  // ¡Splash! El globo pinta todo alrededor y a quien esté cerca.
  explode(balloon) {
    this.scene.remove(balloon.mesh);
    balloon.mesh.material.dispose();
    const y = Math.max(0, balloon.y);
    const ground = this.world.groundAt(balloon.x, balloon.z, y + 0.3);
    this.paintAt(balloon.x, ground, balloon.z, BALLOON.radius, balloon.team, balloon.owner);
    for (const target of this.targetsFor(balloon.team)) {
      const dist = Math.hypot(target.x - balloon.x, target.y + 1 - y, target.z - balloon.z);
      if (dist < BALLOON.radius + target.radius)
        this.hitTarget(target, BALLOON.damage * (1 - (dist / (BALLOON.radius + target.radius)) * 0.6), balloon.owner, balloon.team);
    }
    this.burst(balloon.x, y + 0.3, balloon.z, balloon.team, 14);
    sfx.pop();
    noise({ ms: 260, volume: 0.25, filter: 900 });
  }

  // Gotitas de adorno que salen volando (pintan el piso donde caen, pero no le pegan a nadie).
  burst(x, y, z, team, count = BURST_DROPS) {
    for (let i = 0; i < count; i += 1) {
      const angle = (i / count) * Math.PI * 2 + Math.random() * 0.5;
      const speed = 4 + Math.random() * 4;
      this.drops.push({
        x,
        y,
        z,
        vx: Math.cos(angle) * speed,
        vy: 4 + Math.random() * 4,
        vz: Math.sin(angle) * speed,
        gravity: 20,
        team,
        owner: null,
        damage: 0,
        splat: 0.8,
        size: 1.3,
        lifeMs: 2000,
        visual: true,
      });
    }
  }

  // ---------- Pintar a alguien ----------
  // Los que le pueden pegar al equipo `team`: los pintores del otro equipo y los robots.
  targetsFor(team) {
    const list = this.painters.filter((painter) => painter.team !== team && painter.alive);
    if (this.robots) for (const robot of this.robots.list) if (robot.alive && robot.team !== team) list.push(robot);
    return list;
  }

  hitTarget(target, damage, attacker, team) {
    if (target.isRobot) {
      if (this.robots.hurt(target, damage)) this.robotDown(target, attacker);
      return;
    }
    if (target.invulnMs > 0 || !target.alive) return;
    const amount = damage * (target.peque ? PEQUE_DAMAGE : 1);
    target.hp -= amount;
    target.lastHitMs = 0;
    target.hitMs = 260;
    target.hitColor = this.teamLooks[team].color;
    if (!target.isCpu || (attacker && !attacker.isCpu)) sfx.hit(0.25);
    if (target.hp <= 0) this.splatPainter(target, attacker, team);
  }

  // ¡Pintado! Sale la explosión de color y vuelve a su base en unos segundos.
  splatPainter(victim, attacker, team) {
    victim.state = 'splatted';
    victim.respawnMs = victim.peque ? RESPAWN_MS.peque : RESPAWN_MS.normal;
    victim.deathAt = { x: victim.x, y: victim.y, z: victim.z, yaw: victim.yaw };
    victim.stats.deaths += 1;
    victim.swimming = false;
    this.paintAt(victim.x, victim.y, victim.z, 2.6, team, attacker?.stats ? attacker : null);
    this.burst(victim.x, victim.y + 1, victim.z, team);
    sfx.poof();
    if (attacker?.stats) {
      attacker.stats.splats += 1;
      this.score[attacker.team] += 1;
      if (!attacker.isCpu) {
        const index = this.viewIndexOf(attacker);
        if (index >= 0) this.hud.panelMessage(index, `💦 ¡Pintaste a ${victim.isCpu ? 'la compu' : victim.label}!`);
        if (attacker.stats.splats >= 10) rewards.earn('pintura-10');
      }
    }
    const humanInvolved = !victim.isCpu || (attacker?.stats && !attacker.isCpu);
    if (humanInvolved && performance.now() - this.lastTalkMs > 1500) {
      this.lastTalkMs = performance.now();
      if (attacker?.stats && !attacker.isCpu && !victim.isCpu) say(`¡${attacker.label} pintó a ${victim.label}!`);
      else if (!victim.isCpu) say(`¡Pintaron a ${victim.label}!`);
      else say('¡Pintado!');
    }
    // En "Contra robots" cada pintado le quita un corazón al equipo.
    if (this.robots && victim.team === 0) {
      this.hearts -= 1;
      if (this.hearts <= 0) this.finish('lost');
    }
  }

  respawn(painter) {
    const spots = this.arena.spawns[painter.team];
    painter.reset(spots[Math.floor(Math.random() * spots.length)], { invulnerable: true });
    painter.ai = null;
  }

  // ---------- Contra robots ----------
  updateRobots(dtMs) {
    if (!this.waveActive) {
      this.waveMs -= dtMs;
      if (this.waveMs <= 0) this.startWave();
    }
    this.robots.update(dtMs, this.painters, this.world, (robot, from, velocity, blob) => {
      this.drops.push({
        ...from,
        vx: velocity.x,
        vy: velocity.y,
        vz: velocity.z,
        gravity: blob.gravity,
        team: robot.team,
        owner: robot,
        damage: blob.damage,
        splat: blob.splat,
        size: 1.8,
        lifeMs: 4000,
      });
    });
    if (this.waveActive && this.robots.remaining === 0) {
      this.waveActive = false;
      if (this.wave >= WAVES.length) {
        this.finish('won');
        return;
      }
      this.waveMs = WAVE_PAUSE_MS;
      this.hud.flash(`✨ ¡Oleada ${this.wave} lista!`, 1400);
      say(`¡Oleada ${this.wave} lista!`);
      sfx.star();
    }
  }

  startWave() {
    this.robots.clear();
    const plan = WAVES[this.wave];
    this.wave += 1;
    this.waveActive = true;
    const last = this.wave === WAVES.length;
    this.hud.flash(last ? '🤖 ¡Llegó el Mega Robot!' : `🤖 Oleada ${this.wave}`, 1500);
    say(last ? '¡Cuidado! ¡Llegó el Mega Robot!' : `¡Oleada ${this.wave}!`);
    const { halfW, halfD } = this.world;
    for (const [kind, count] of plan) {
      for (let i = 0; i < count; i += 1) {
        let x = 0;
        let z = -halfD + 4;
        for (let tries = 0; tries < 20; tries += 1) {
          x = (Math.random() * 2 - 1) * (halfW - 4);
          z = -halfD + 3 + Math.random() * 10;
          if (!this.world.blocked(x, z, 1.8)) break;
        }
        this.robots.spawn(kind, x, z, this.wave - 1);
      }
    }
  }

  robotDown(robot, attacker) {
    this.paintAt(robot.x, 0, robot.z, robot.spec.boss ? 4.5 : 2.2, 0, attacker?.stats ? attacker : null);
    this.burst(robot.x, robot.y + 1, robot.z, 0, robot.spec.boss ? 24 : BURST_DROPS);
    sfx.poof();
    if (attacker?.stats) attacker.stats.robots += 1;
    if (robot.spec.boss) {
      setTimeScale(0.35, 900);
      say('¡Adiós, Mega Robot!');
    }
  }

  // ---------- El final ----------
  finish(outcome = null) {
    if (this.phase !== 'play') return;
    this.phase = 'ending';
    this.phaseMs = 0;
    this.result = this.computeResult(outcome);
    const text = this.settings.mode === 'robots' ? (outcome === 'won' ? '🎉 ¡Ganaron!' : '🤖 ¡Se acabaron los corazones!') : '⏱️ ¡Tiempo!';
    this.hud.flash(text, ENDING_MS);
    say(text.replace(/^\S+\s/, ''));
    sfx.win();
  }

  updateEnding() {
    if (this.phaseMs >= ENDING_MS) this.showResults();
  }

  // Quién ganó y los puntos de cada quien (para el podio).
  computeResult(outcome) {
    const mode = this.settings.mode;
    let winner = null;
    let parts = null;
    if (mode === 'piso') {
      const coverage = this.floor.coverage();
      winner = coverage[0] === coverage[1] ? null : coverage[0] > coverage[1] ? 0 : 1;
      parts = coverage.map((pct, team) => ({ pct: Math.round(pct * 100), color: cssColor(TEAMS[team].color), text: `${Math.round(pct * 100)}%` }));
    } else if (mode === 'equipos') {
      winner = this.score[0] === this.score[1] ? null : this.score[0] > this.score[1] ? 0 : 1;
      const total = Math.max(1, this.score[0] + this.score[1]);
      parts = this.score.map((score, team) => ({ pct: Math.round((score / total) * 100), color: cssColor(TEAMS[team].color), text: String(score) }));
    } else {
      winner = outcome === 'won' ? 0 : 1;
    }
    const points = (p) => {
      if (mode === 'piso') return p.stats.painted + p.stats.splats * 15;
      if (mode === 'equipos') return p.stats.splats * 100 + p.stats.painted * 0.2 - p.stats.deaths * 10;
      return p.stats.robots * 100 + p.stats.painted * 0.2;
    };
    const ranking = [...this.painters].sort((a, b) => points(b) - points(a));
    return { mode, outcome, winner, parts, ranking };
  }

  showResults() {
    this.phase = 'results';
    this.phaseMs = 0;
    this.hud.showHelp(true);
    const { mode, winner, parts, ranking, outcome } = this.result;
    for (const painter of this.painters) painter.celebrating = winner !== null && painter.team === winner && painter.alive;
    let title;
    if (mode === 'robots') title = outcome === 'won' ? '🎉 ¡Le ganaron a los robots!' : `🤖 Llegaron hasta la oleada ${this.wave}`;
    else if (winner === null) title = '🤝 ¡Empate!';
    else title = `🎨 ¡Ganan los ${TEAMS[winner].name}!`;
    const statLine = (p) => {
      const bits = [];
      if (p.stats.splats) bits.push(`💦 ${p.stats.splats} pintados`);
      bits.push(`🎨 ${p.stats.painted} m²`);
      if (mode === 'robots') bits.push(`🤖 ${p.stats.robots}`);
      return bits.join('  ·  ');
    };
    const name = (p) => (p.isCpu ? `CPU (${this.characterName(p)})` : p.label);
    this.hud.showResults({
      title,
      bar: parts ? { parts } : null,
      podium: ranking.slice(0, 3).map((p) => ({
        label: name(p),
        image: this.faceOf(p.character, 'gana'),
        color: p.isCpu ? '#fff' : hexToCss(this.humans.find((h) => h.deviceId === p.deviceId)?.color ?? 0xffffff),
        teamColor: cssColor(this.teamLooks[p.team].color),
        line: statLine(p),
      })),
      rows: this.humanPainters.map((p) => ({ label: p.label, teamColor: cssColor(this.teamLooks[p.team].color), text: statLine(p) })),
      help: 'A = otra vez  ·  B = cambiar opciones  ·  Mantén LB + RB + Y = salir',
    });
    say(title.replace(/^\S+\s/, ''));
    const mvp = ranking[0];
    if (mvp && !mvp.isCpu) setTimeout(() => say(`¡${mvp.label} fue el mejor pintor!`, { interrupt: false }), 300);
    // Calcomanías.
    const humanWon = this.humanPainters.some((p) => p.team === winner);
    if (mode === 'piso' && humanWon) rewards.earn('pintura-piso');
    if (mode === 'robots' && outcome === 'won') rewards.earn('pintura-robots');
  }

  updateResults() {
    if (this.phaseMs < RESULTS_INPUT_DELAY_MS) return;
    const pressed = (button) => this.humans.some((human) => controls.justPressed(human.deviceId, button) && !controls.isDown(human.deviceId, 'lb'));
    if (pressed('a')) {
      sfx.confirm();
      this.startMatch();
    } else if (pressed('b')) {
      sfx.back();
      this.clearPainters();
      this.openSetup();
    }
  }

  // ---------- Dibujar ----------
  updateHudTop() {
    const mode = this.settings.mode;
    if (mode === 'robots') {
      const left = this.waveActive ? `  ·  quedan ${this.robots.remaining}` : '';
      this.hud.setTop(`🤖 Oleada ${Math.max(1, this.wave)}/${WAVES.length}  ·  ${'❤️'.repeat(Math.max(0, this.hearts))}${left}`);
      return;
    }
    const seconds = Math.ceil(this.timeLeftMs / 1000);
    const clock = `⏱️ ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
    if (mode === 'piso') {
      const [a, b] = this.floor.coverage().map((pct) => Math.round(pct * 100));
      this.hud.setTop(
        `${clock}<span>${a}%</span><div class="pt-bar"><div style="left:0;width:${a}%;background:${cssColor(TEAMS[0].color)}"></div><div style="right:0;width:${b}%;background:${cssColor(TEAMS[1].color)}"></div></div><span>${b}%</span>`,
      );
    } else {
      this.hud.setTop(
        `${clock}  <span style="color:${cssColor(TEAMS[0].color)}">${TEAMS[0].name} ${this.score[0]}</span> – <span style="color:${cssColor(TEAMS[1].color)}">${this.score[1]} ${TEAMS[1].name}</span>`,
      );
    }
  }

  render(dtMs) {
    const renderer = this.renderer;
    const now = performance.now();
    for (const painter of this.painters) painter.render(now, painter.hitColor ?? null);
    // Las opciones: la arena dando vueltas en toda la pantalla.
    if (this.phase === 'setup' || !this.views) {
      this.previewAngle += dtMs / 9000;
      const { halfW, halfD } = this.world;
      const radius = Math.max(halfW, halfD) * 1.35;
      this.previewCamera.position.set(Math.sin(this.previewAngle) * radius, radius * 0.55, Math.cos(this.previewAngle) * radius);
      this.previewCamera.lookAt(0, 0, 0);
      renderer.setScissorTest(false);
      renderer.setViewport(0, 0, WIDTH, HEIGHT);
      this.scene.fog = this.fog;
      for (const painter of this.painters) painter.driver.show(driverView(painter, this.previewCamera));
      renderer.render(this.scene, this.previewCamera);
      return;
    }
    renderer.setScissorTest(true);
    this.views.forEach((view, i) => {
      const y = HEIGHT - view.y - view.h;
      renderer.setViewport(view.x, y, view.w, view.h);
      renderer.setScissor(view.x, y, view.w, view.h);
      const own = view.painter ?? null;
      // (El mapa, sin neblina: se ve desde muy arriba.)
      this.scene.fog = view.kind === 'map' ? null : this.fog;
      if (own) this.placeCamera(view, own, dtMs);
      for (const painter of this.painters) {
        painter.driver.show(driverView(painter, view.camera));
        if (painter === own) {
          painter.driver.sprite.visible = false;
          painter.puddle.visible = false;
          painter.marker.visible = false;
        }
        if (painter.gun) painter.gun.visible = painter === own && painter.alive && !painter.swimming && this.phase !== 'results';
      }
      this.robots?.show(view.camera, this.teamLooks[0].color);
      if (own) this.hud.updatePanel(i, this.panelData(own));
      renderer.render(this.scene, view.camera);
      // (Lo que se escondió solo para su propia pantalla vuelve para las demás.)
      if (own) own.render(now, own.hitColor ?? null);
    });
    renderer.setScissorTest(false);
  }

  // La cámara de un jugador: en sus ojos; si lo pintaron, desde arriba viendo dónde quedó.
  placeCamera(view, painter, dtMs) {
    const camera = view.camera;
    const zoom = painter.aiming && painter.alive ? ZOOM : 1;
    const fov = view.fov * zoom;
    if (Math.abs(camera.fov - fov) > 0.1) {
      camera.fov += (fov - camera.fov) * Math.min(1, dtMs / 80);
      camera.updateProjectionMatrix();
    }
    if (!painter.alive && painter.deathAt) {
      const { x, y, z, yaw } = painter.deathAt;
      camera.position.set(x - Math.sin(yaw) * 4, y + 5, z - Math.cos(yaw) * 4);
      camera.lookAt(x, y, z);
      return;
    }
    camera.position.set(painter.x, painter.y + painter.eye, painter.z);
    const cp = Math.cos(painter.pitch);
    camera.lookAt(painter.x + Math.sin(painter.yaw) * cp, painter.y + painter.eye + Math.sin(painter.pitch), painter.z + Math.cos(painter.yaw) * cp);
    if (painter.gun) {
      painter.gun.position.copy(camera.position);
      painter.gun.quaternion.copy(camera.quaternion);
      // (Retrocede un poquito con cada disparo y se mece al caminar.)
      const kick = painter.shootPoseMs > 0 ? 0.06 : 0;
      const sway = Math.sin(performance.now() / 160) * Math.min(1, Math.hypot(painter.vx, painter.vz) / 7) * 0.03;
      painter.gun.translateZ(kick);
      painter.gun.translateY(sway);
    }
  }

  panelData(painter) {
    const human = this.humans.find((h) => h.deviceId === painter.deviceId);
    return {
      label: painter.label,
      color: hexToCss(human?.color ?? 0xffffff),
      image: this.faceOf(painter.character),
      peque: painter.peque,
      ink: painter.ink,
      inkColor: cssColor(painter.teamColor),
      weapon: pinturaIcon(painter.weapon.key, painter.weapon.emoji),
      weaponName: painter.weapon.name,
      balloon: painter.ink >= BALLOON.ink && painter.balloonMs === 0,
      paint: painter.alive ? 1 - painter.hp / painter.maxHp : 0,
      paintColor: cssColor(painter.hitColor ?? 0xffffff),
      lock: Boolean(painter.assistTarget),
      deadSeconds: painter.alive ? null : Math.max(1, Math.ceil(painter.respawnMs / 1000)),
    };
  }

  // La carita de un personaje (para las etiquetas y el podio).
  faceOf(character, pose = 'normal') {
    if (character === 'bloquecito') {
      this.blockFace ??= blockImageUrl(1);
      return this.blockFace;
    }
    return characterImageUrl(character, pose) ?? characterImageUrl(character);
  }

  characterName(painter) {
    return painter.driver.name;
  }

  updateExit(dtMs) {
    const holding = this.humans.some((human) => controls.holdingExit(human.deviceId));
    this.exitMs = holding ? this.exitMs + dtMs : 0;
    this.hud.setExitProgress(Math.min(1, this.exitMs / EXIT_HOLD_MS));
    if (this.exitMs >= EXIT_HOLD_MS) this.exit();
  }

  exit() {
    if (this.exited) return;
    this.exited = true;
    this.onExit();
  }

  clearPainters() {
    for (const painter of this.painters) {
      if (painter.gun) {
        this.scene.remove(painter.gun);
        painter.gun.userData.dispose();
      }
      painter.dispose();
    }
    this.painters = [];
    this.humanPainters = [];
    this.robots?.dispose();
    this.robots = null;
  }

  clearBalloons() {
    for (const balloon of this.balloons) {
      this.scene.remove(balloon.mesh);
      balloon.mesh.material.dispose();
    }
    this.balloons = [];
  }

  destroy() {
    this.clearPainters();
    this.clearBalloons();
    this.clearArena();
    this.sharedBalloon?.dispose();
    this.drivers.dispose();
    this.hud.destroy();
    this.view.destroy(this.scene);
  }
}

// ¿La gota toca a ese pintor o robot? (Su cuerpo es un palito de su altura con su grosor.)
function touches(target, drop, extra = 0.2) {
  const top = target.y + target.height;
  const cy = Math.min(top, Math.max(target.y, drop.y));
  const dx = target.x - drop.x;
  const dy = cy - drop.y;
  const dz = target.z - drop.z;
  const reach = target.radius + extra;
  return dx * dx + dy * dy + dz * dz < reach * reach;
}

// El chorrito al disparar (cortito para que no aturda con tantos disparos).
function squirt(big) {
  noise({ ms: big ? 140 : 45, volume: big ? 0.16 : 0.06, filter: big ? 1400 : 3200 });
}
