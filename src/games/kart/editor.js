import * as THREE from 'three';
import { controls } from '../../shared/controls.js';
import { settings } from '../../shared/settings.js';
import { sfx } from '../../shared/sound.js';
import { say } from '../../shared/voice.js';
import { TRACKS } from './tracks.js';

// Arma tu pista: el Jugador 1 dibuja su propia pista moviendo puntos en un mapa visto desde arriba (HTML encima del
// 3D). La pista pasa por los puntos en orden (curvita suave, como las de siempre) y se guarda sola.
//   stick / cruz: mover la manita · A: agarrar el punto que está debajo (y soltarlo) o, si no hay, poner uno nuevo en
//   el tramo más cercano · X: quitar el punto · LB / RB: bajar / subir el punto (lomas) · Y: cambiar el paisaje ·
//   RT: ¡a correr! · LT: empezar otra vez · B: regresar.
// Si la pista se cruza o dos partes quedan muy pegadas se ve en rojo y no deja correr.
export const CUSTOM_KEY = 'mipista';
const SAVE_KEY = 'kartMiPista';
// Paisajes que se pueden usar (los que no ponen algo enorme en medio del mapa).
export const EDITOR_THEMES = ['pradera', 'playa', 'dulces', 'nieve', 'selva', 'dinos', 'nubes', 'desierto', 'neon'];
const BOUNDS = { x: 118, z: 90 };
const MIN_POINTS = 5;
const MAX_POINTS = 16;
const MAX_HEIGHT = 16;
const HEIGHT_STEP = 2;
const GRAB_REACH = 9;
const CURSOR_SPEED = 95;
// Qué tan pegadas pueden quedar dos partes de la pista (sin contar las vecinas) y cada cuánto se revisa.
const MIN_GAP = 19;
const SAMPLES = 220;
const PX = 2.6;
const W = BOUNDS.x * 2 * PX;
const H = BOUNDS.z * 2 * PX;
const DEFAULT = [
  [-80, -55, 0],
  [0, -70, 0],
  [80, -55, 4],
  [100, 0, 8],
  [75, 55, 4],
  [0, 65, 0],
  [-75, 55, 2],
  [-100, 0, 0],
];
const STYLE_ID = 'kart-editor-style';
const CSS = `
.kart-editor { position: absolute; inset: 0; background: #14112b; color: #fff; display: flex; align-items: center;
  justify-content: center; gap: 30px; font-family: "Segoe UI", "Trebuchet MS", Arial, sans-serif; }
.kart-editor canvas { background: #1f1a3d; border-radius: 22px; border: 4px solid #3a3170; }
.kart-editor .side { width: 500px; display: flex; flex-direction: column; gap: 14px; }
.kart-editor h1 { margin: 0; font-size: 40px; }
.kart-editor .theme { font-size: 24px; background: #231d45; border: 3px solid #3a3170; border-radius: 16px; padding: 10px 18px; }
.kart-editor .state { font-size: 21px; min-height: 52px; }
.kart-editor .state.bad { color: #ff6b6b; }
.kart-editor .state.good { color: #7cff6b; }
.kart-editor ul { margin: 0; padding: 0; list-style: none; font-size: 18px; line-height: 1.55; color: #d9d4ff; }
.kart-editor ul b { color: #ffc93c; }
`;

// La pista guardada (o null si nunca han hecho una).
export function savedTrack() {
  const data = settings.get(SAVE_KEY, null);
  return data?.points?.length >= MIN_POINTS ? data : null;
}

// Cómo se ve (y juega) la pista de la familia: el paisaje que escogieron con su trazo, flechas de turbo y una rampa en
// las rectas más largas. Sin atajo, sin agua y sin cosas vivas.
export function customLook(data = savedTrack()) {
  if (!data) return null;
  const theme = TRACKS[data.theme] ?? TRACKS.pradera;
  const { pads, ramps } = autoFeatures(data.points);
  return {
    ...theme,
    name: 'Mi pista',
    emoji: '🛠️',
    unlock: null,
    points: data.points,
    pads,
    ramps,
    gliders: [],
    shortcut: null,
    water: null,
    living: [],
    weatherShift: null,
    theme: { ...theme.theme, avoid: undefined },
    custom: true,
  };
}

// Las rectas: donde la curva casi no gira. La más larga lleva rampa y las demás flechas de turbo.
function autoFeatures(points) {
  const curve = curveOf(points);
  const samples = curve.getSpacedPoints(SAMPLES).slice(0, SAMPLES);
  const turn = samples.map((p, i) => {
    const a = samples[(i - 4 + SAMPLES) % SAMPLES];
    const b = samples[(i + 4) % SAMPLES];
    const h1 = Math.atan2(p.x - a.x, p.z - a.z);
    const h2 = Math.atan2(b.x - p.x, b.z - p.z);
    return Math.abs(Math.atan2(Math.sin(h2 - h1), Math.cos(h2 - h1)));
  });
  // Tramos seguidos de recta (sin la salida, que ya tiene su flecha).
  const runs = [];
  let start = null;
  for (let i = 0; i <= SAMPLES; i += 1) {
    const straight = i < SAMPLES && turn[i] < 0.08;
    if (straight && start === null) start = i;
    if (!straight && start !== null) {
      runs.push({ start, length: i - start });
      start = null;
    }
  }
  runs.sort((a, b) => b.length - a.length);
  const at = (run, k) => Number(((run.start + run.length * k) / SAMPLES).toFixed(3));
  const ramps = runs[0] && runs[0].length > 18 ? [at(runs[0], 0.6)] : [];
  const pads = [
    [0.03, 0],
    ...runs
      .slice(1, 4)
      .filter((run) => run.length > 8)
      .map((run, k) => [at(run, 0.4), [0, 3, -3][k]]),
  ];
  return { pads, ramps };
}

function curveOf(points) {
  return new THREE.CatmullRomCurve3(
    points.map(([x, z]) => new THREE.Vector3(x, 0, z)),
    true,
    'centripetal',
  );
}

export class TrackEditor {
  constructor(stage) {
    if (!document.getElementById(STYLE_ID)) {
      const style = document.createElement('style');
      style.id = STYLE_ID;
      style.textContent = CSS;
      document.head.append(style);
    }
    const data = savedTrack();
    this.points = (data?.points ?? DEFAULT).map((p) => [...p]);
    this.theme = EDITOR_THEMES.includes(data?.theme) ? data.theme : 'pradera';
    this.cursor = { x: 0, z: 0 };
    this.held = null;
    this.el = document.createElement('div');
    this.el.className = 'kart-editor';
    this.el.innerHTML = `<canvas width="${W}" height="${H}"></canvas><div class="side"><h1>🛠️ Arma tu pista</h1>
      <div class="theme"></div><div class="state"></div><ul>
      <li><b>Stick</b> mover la manita</li><li><b>A</b> agarrar / soltar un punto (o poner uno nuevo)</li>
      <li><b>X</b> quitar el punto</li><li><b>LB / RB</b> bajar / subir (lomas)</li><li><b>Y</b> cambiar el paisaje</li>
      <li><b>RT</b> ¡a correr!</li><li><b>LT</b> empezar otra vez</li><li><b>B</b> regresar (se guarda sola)</li></ul></div>`;
    stage.append(this.el);
    this.canvas = this.el.querySelector('canvas');
    this.ctx = this.canvas.getContext('2d');
    this.themeEl = this.el.querySelector('.theme');
    this.stateEl = this.el.querySelector('.state');
    this.check();
    this.draw();
    say('Arma tu pista. Mueve los puntos con A');
  }

  // Cada cuadro. Devuelve 'race' (¡a correr!), 'back' o null.
  update(dtMs, id) {
    const stick = controls.getStick(id);
    const pad = {
      x: (controls.isDown(id, 'right') ? 1 : 0) - (controls.isDown(id, 'left') ? 1 : 0),
      y: (controls.isDown(id, 'down') ? 1 : 0) - (controls.isDown(id, 'up') ? 1 : 0),
    };
    const dx = Math.abs(stick.x) > 0.2 ? stick.x : pad.x;
    const dz = Math.abs(stick.y) > 0.2 ? stick.y : pad.y;
    const dt = dtMs / 1000;
    this.cursor.x = clamp(this.cursor.x + dx * CURSOR_SPEED * dt, -BOUNDS.x, BOUNDS.x);
    this.cursor.z = clamp(this.cursor.z + dz * CURSOR_SPEED * dt, -BOUNDS.z, BOUNDS.z);
    let changed = false;
    if (this.held !== null) {
      const p = this.points[this.held];
      if (p[0] !== this.cursor.x || p[1] !== this.cursor.z) {
        p[0] = Math.round(this.cursor.x);
        p[1] = Math.round(this.cursor.z);
        changed = true;
      }
    }
    const near = this.nearest();
    if (controls.justPressed(id, 'a')) {
      if (this.held !== null) {
        this.held = null;
        sfx.confirm();
      } else if (near !== null) {
        this.held = near;
        sfx.select();
      } else if (this.points.length < MAX_POINTS) {
        this.held = this.insert();
        changed = true;
        sfx.pickup();
      } else {
        say('Ya no caben más puntos');
      }
    } else if (controls.justPressed(id, 'x')) {
      const target = this.held ?? near;
      if (target !== null && this.points.length > MIN_POINTS) {
        this.points.splice(target, 1);
        this.held = null;
        changed = true;
        sfx.back();
      } else if (target !== null) {
        say(`Necesita por lo menos ${MIN_POINTS} puntos`);
      }
    } else if (controls.justPressed(id, 'lb') || controls.justPressed(id, 'rb')) {
      const target = this.held ?? near;
      if (target !== null) {
        const p = this.points[target];
        p[2] = clamp(p[2] + (controls.justPressed(id, 'rb') ? HEIGHT_STEP : -HEIGHT_STEP), 0, MAX_HEIGHT);
        changed = true;
        sfx.select();
      }
    } else if (controls.justPressed(id, 'y')) {
      this.theme = EDITOR_THEMES[(EDITOR_THEMES.indexOf(this.theme) + 1) % EDITOR_THEMES.length];
      changed = true;
      sfx.select();
      say(TRACKS[this.theme].name);
    } else if (controls.justPressed(id, 'lt')) {
      this.points = DEFAULT.map((p) => [...p]);
      this.held = null;
      changed = true;
      sfx.back();
      say('Pista nueva');
    }
    if (changed) {
      this.check();
      this.save();
    }
    this.draw();
    if (controls.justPressed(id, 'rt')) {
      if (this.problem) {
        sfx.back();
        say(this.problem);
        return null;
      }
      this.save();
      return 'race';
    }
    if (controls.justPressed(id, 'b')) {
      if (this.held !== null) {
        this.held = null;
        return null;
      }
      this.save();
      return 'back';
    }
    return null;
  }

  nearest() {
    let best = null;
    let bestDist = GRAB_REACH;
    this.points.forEach(([x, z], i) => {
      const d = Math.hypot(x - this.cursor.x, z - this.cursor.z);
      if (d < bestDist) {
        best = i;
        bestDist = d;
      }
    });
    return best;
  }

  // Un punto nuevo bajo la manita, metido entre los dos puntos del tramo más cercano. Devuelve su lugar.
  insert() {
    let best = 0;
    let bestDist = Infinity;
    this.points.forEach((a, i) => {
      const b = this.points[(i + 1) % this.points.length];
      const d = distanceToSegment(this.cursor.x, this.cursor.z, a[0], a[1], b[0], b[1]);
      if (d < bestDist) {
        best = i;
        bestDist = d;
      }
    });
    const height = Math.round((this.points[best][2] + this.points[(best + 1) % this.points.length][2]) / 2);
    this.points.splice(best + 1, 0, [Math.round(this.cursor.x), Math.round(this.cursor.z), height]);
    return best + 1;
  }

  // ¿Se puede correr? (que no se cruce ni se encime). Deja `problem` con lo que pasa, o null.
  check() {
    const samples = curveOf(this.points).getSpacedPoints(SAMPLES).slice(0, SAMPLES);
    this.samples = samples;
    this.bad = new Set();
    const length = samples.reduce((sum, p, i) => sum + p.distanceTo(samples[(i + 1) % SAMPLES]), 0);
    const step = length / SAMPLES;
    // Las vecinas (a menos de ~1.5 anchos de camino por la pista) no cuentan.
    const skip = Math.ceil((MIN_GAP * 2.2) / step);
    for (let i = 0; i < SAMPLES; i += 2) {
      for (let j = i + skip; j < SAMPLES; j += 2) {
        if (SAMPLES - (j - i) < skip) continue;
        if (Math.hypot(samples[i].x - samples[j].x, samples[i].z - samples[j].z) < MIN_GAP) {
          this.bad.add(i);
          this.bad.add(j);
        }
      }
    }
    const outside = samples.some((p) => Math.abs(p.x) > BOUNDS.x + 4 || Math.abs(p.z) > BOUNDS.z + 4);
    this.problem = this.bad.size
      ? '¡Ahí se cruza o queda muy pegadito! Aleja esos puntos'
      : outside
        ? 'La pista se sale del mapa'
        : length < 380
          ? 'Muy cortita: ponle más puntos'
          : null;
  }

  save() {
    settings.set(SAVE_KEY, { points: this.points, theme: this.theme });
  }

  draw() {
    const ctx = this.ctx;
    const toPx = (x, z) => [(x + BOUNDS.x) * PX, (z + BOUNDS.z) * PX];
    ctx.clearRect(0, 0, W, H);
    // Cuadritos de fondo.
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.lineWidth = 2;
    for (let x = 0; x <= W; x += 52) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
      ctx.stroke();
    }
    for (let y = 0; y <= H; y += 52) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }
    const look = TRACKS[this.theme];
    const road = `#${(look.theme?.road ?? 0x55515f).toString(16).padStart(6, '0')}`;
    const edge = `#${(look.mapColor ?? look.ground).toString(16).padStart(6, '0')}`;
    const path = () => {
      ctx.beginPath();
      this.samples.forEach((p, i) => (i ? ctx.lineTo(...toPx(p.x, p.z)) : ctx.moveTo(...toPx(p.x, p.z))));
      ctx.closePath();
    };
    ctx.lineJoin = 'round';
    ctx.strokeStyle = edge;
    ctx.lineWidth = 46;
    path();
    ctx.stroke();
    ctx.strokeStyle = road;
    ctx.lineWidth = 34;
    path();
    ctx.stroke();
    // Donde se encima: rojo.
    ctx.fillStyle = 'rgba(255, 70, 70, 0.75)';
    for (const i of this.bad) {
      const [x, y] = toPx(this.samples[i].x, this.samples[i].z);
      ctx.beginPath();
      ctx.arc(x, y, 20, 0, Math.PI * 2);
      ctx.fill();
    }
    // La salida (cuadros) y hacia dónde se corre.
    const [sx, sy] = toPx(this.samples[0].x, this.samples[0].z);
    const [nx, ny] = toPx(this.samples[6].x, this.samples[6].z);
    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(Math.atan2(ny - sy, nx - sx));
    for (let k = -3; k < 3; k += 1) {
      ctx.fillStyle = k % 2 ? '#ffffff' : '#1b1530';
      ctx.fillRect(-4, k * 6, 8, 6);
    }
    ctx.fillStyle = '#ffc93c';
    ctx.beginPath();
    ctx.moveTo(28, 0);
    ctx.lineTo(15, -9);
    ctx.lineTo(15, 9);
    ctx.fill();
    ctx.restore();
    // Los puntos: entre más alto, más grande; el número es su altura.
    const near = this.held ?? this.nearest();
    this.points.forEach(([x, z, h], i) => {
      const [px, py] = toPx(x, z);
      ctx.fillStyle = i === this.held ? '#ffc93c' : i === near ? '#ffe9a0' : '#ffffff';
      ctx.strokeStyle = '#1b1530';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(px, py, 10 + h * 0.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      if (h > 0) {
        ctx.fillStyle = '#1b1530';
        ctx.font = 'bold 13px "Segoe UI", Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`⛰${h}`, px, py);
      }
    });
    // La manita.
    const [cx, cy] = toPx(this.cursor.x, this.cursor.z);
    ctx.font = '32px "Segoe UI Emoji", "Apple Color Emoji", sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(this.held !== null ? '✊' : '👆', cx - 10, cy - 4);
    this.themeEl.textContent = `Paisaje (Y): ${look.emoji} ${look.name}`;
    this.stateEl.textContent = this.problem ?? `¡Lista! ${this.points.length} puntos · RT = ¡a correr!`;
    this.stateEl.className = `state ${this.problem ? 'bad' : 'good'}`;
  }

  destroy() {
    this.el.remove();
  }
}

function distanceToSegment(px, pz, ax, az, bx, bz) {
  const vx = bx - ax;
  const vz = bz - az;
  const t = clamp(((px - ax) * vx + (pz - az) * vz) / (vx * vx + vz * vz || 1), 0, 1);
  return Math.hypot(px - (ax + vx * t), pz - (az + vz * t));
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
