import * as THREE from 'three';
import { buildKartLabel, buildKartModel } from '../three/kartModel.js';
import { decalTexture, kartStats } from './karts.js';

const BRAKE = 50;
const REVERSE_MAX = 12;
const COAST = 10;
export const NITRO_CHARGES = 3;
const NITRO_FACTOR = 1.45;
const NITRO_MS = 1200;
// Dónde va el copiloto del kart para dos (respecto al asiento).
const PASSENGER = { x: 0.85, y: 0.25, z: -0.6 };
// La nave flota (y sube y baja tantito); la moto levanta la trompa en el caballito.
const HOVER = { height: 0.45, bob: 0.12 };
const WHEELIE_TILT = 0.38;
const NITRO_REFILL_MS = 4000;
const SPIN_MS = 1100;
export const SHIELD_MS = 8000;
export const RACER_RADIUS = 1.7;
// Derrape: con LB apretado en una curva se desliza de lado y junta chispas (azules, naranjas, moradas y, si
// aguantas mucho, de arcoíris); al soltarlo da un turbito más largo entre más chispas juntó.
const DRIFT_MIN_SPEED = 16;
const DRIFT_TURN = { min: 0.55, max: 1.25 };
const DRIFT_YAW = 0.38;
const DRIFT_LEVEL_MS = [700, 1500, 2400, 3400];
const MINI_TURBOS = [null, { factor: 1.2, ms: 600 }, { factor: 1.3, ms: 900 }, { factor: 1.4, ms: 1300 }, { factor: 1.55, ms: 1900 }];
// (El arcoíris va cambiando de color: ver rainbow().)
export const SPARK_COLORS = [null, 0x5ab8ff, 0xff9a3c, 0xd36bff, 0xff5af0];
// En el aire (al saltar una rampa): gravedad y qué tanto se puede girar. Con LB en el aire hace un truco según
// hacia dónde apunte el stick: ↑ mortal, ↓ mortal para atrás, ◀ ▶ vuelta de lado y nada, un giro. Si alcanza,
// otro truco más (combo). Al caer le da un turbito, más grande con cada truco.
const GRAVITY = 28;
const AIR_STEER = 0.4;
const TRICK_BOOST = { factor: 1.3, ms: 800, perTrick: { factor: 0.08, ms: 350 } };
const TRICK_SPIN_MS = 420;
// En las bajadas el kart se queda pegado al camino si la diferencia es poca (si no, iría "volando" todo el tiempo).
const STICK = 0.6;
// El rayo encoge: más chiquito y más lento un rato. La tinta mancha la pantalla.
export const SHRINK_MS = 6000;
const SHRINK_SCALE = 0.55;
// Al caer de un salto el kart se aplasta tantito y rebota (como resorte).
const LAND_MS = 280;
const SHRINK_SPEED = 0.72;
export const INK_MS = 4500;
// Cuánto se ve al piloto lanzando el poder.
export const THROW_POSE_MS = 400;
// Cada moneda da un poquito más de velocidad; un golpe tira 3.
const COIN_BOOST = 0.01;
const COINS_LOST = 3;
// Planeador (rampas azules): cae despacito y se puede girar como en el piso.
const GLIDE_GRAVITY = 0.32;
const GLIDE_MAX_FALL = 5;
// Bajo el agua: un poco más lento y los saltos flotan.
const WATER_SPEED = 0.94;
const WATER_GRAVITY = 0.45;
// Estrella: invencible, más rápido y tumba al que toca. Bala: maneja sola, rapidísimo. Fantasma: nadie le pega.
export const STAR_MS = 7000;
const STAR_SPEED = 1.3;
export const BULLET_MS = 4000;
const BULLET_SPEED = 1.75;
export const GHOST_MS = 4500;
// Un charco (con lluvia): se resbala tantito de lado.
const SLIP_MS = 650;
const SLIP_TURN = 2.4;

const shieldGeometry = new THREE.SphereGeometry(2.7, 16, 12);
let sparkTexture = null;

// Bolita de luz difuminada para las chispas del derrape.
function sparkMap() {
  if (sparkTexture) return sparkTexture;
  const canvas = document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 32;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.4, 'rgba(255,255,255,0.8)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 32, 32);
  sparkTexture = new THREE.CanvasTexture(canvas);
  return sparkTexture;
}

// Un kart con manejo "desde atrás": el stick gira a la izquierda o derecha,
// A / RT acelera, B / LT frena (y da reversa), RB usa nitro y X lanza el poder que traiga.
// `setup` es lo que se escogió en el taller ({ character, type, color, wheels, extra }); `drivers`, un DriverArt.
// `color` es el del jugador (su letrero); el kart va pintado del color que escogió.
export class Racer {
  // `gunner`: el copiloto del kart para dos ({ deviceId, character, label }): avienta los poderes.
  constructor({ color, label, deviceId = null, setup, drivers, gunner = null }) {
    this.color = color;
    this.label = label;
    this.deviceId = deviceId;
    this.isCpu = deviceId === null;
    this.setup = setup;
    this.stats = kartStats(setup.type);
    const decal = decalTexture(setup.decal, setup.number ?? (Number(label.slice(1)) || 1));
    const { group, flame, seat } = buildKartModel(setup.color, { type: setup.type, wheels: setup.wheels, extra: setup.extra, decal, driver: true });
    this.object = group;
    this.flame = flame;
    this.driver = drivers.createDriver(setup.character, deviceId);
    this.driver.sprite.position.copy(seat).setY(seat.y - this.driver.sink);
    this.object.add(this.driver.sprite);
    // El copiloto va a un lado, un poquito atrás y más arriba (se ve junto al piloto desde la cámara).
    this.gunner = gunner;
    if (gunner) {
      this.passenger = drivers.createDriver(gunner.character, gunner.deviceId);
      this.passenger.sprite.position.set(seat.x + PASSENGER.x, seat.y - this.passenger.sink + PASSENGER.y, seat.z + PASSENGER.z);
      this.object.add(this.passenger.sprite);
    }
    this.labelSprite = buildKartLabel(label, color);
    // Con la cámara detrás, el letrero mide lo mismo en pantalla esté cerca o lejos
    // (si no, un carro pegado a la cámara tapa media pantalla con su letrero).
    this.labelSprite.material.sizeAttenuation = false;
    this.object.add(this.labelSprite);
    this.shield = new THREE.Mesh(
      shieldGeometry,
      new THREE.MeshBasicMaterial({ color: 0x7fdcff, transparent: true, opacity: 0.35, depthWrite: false }),
    );
    this.shield.position.y = 1;
    this.object.add(this.shield);
    // Chispas del derrape, en las llantas de atrás.
    this.sparks = [-1, 1].map((side) => {
      const sprite = new THREE.Sprite(
        new THREE.SpriteMaterial({ map: sparkMap(), color: 0xffffff, blending: THREE.AdditiveBlending, depthWrite: false }),
      );
      sprite.position.set(side * 1.15, 0.45, -1.4);
      this.object.add(sprite);
      return sprite;
    });
    // El planeador (arriba del kart), la hélice (atrás, bajo el agua), el brillo de la estrella y la bala.
    this.wing = buildWing(setup.color);
    this.object.add(this.wing);
    this.propeller = buildPropeller();
    this.object.add(this.propeller);
    this.starGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: sparkMap(), color: 0xffe14d, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.starGlow.scale.setScalar(7);
    this.starGlow.position.y = 1.2;
    this.object.add(this.starGlow);
    this.bullet = buildBullet();
    this.object.add(this.bullet);
    // Qué tan rápido es la carrera (lento, normal o rapidísimo): lo pone el juego.
    this.speedClass = 1;
    this.reset(0, 0, 0, 0);
  }

  reset(x, z, heading, index) {
    this.x = x;
    this.z = z;
    this.heading = heading;
    this.speed = 0;
    this.index = index;
    this.lap = -1;
    // Empiezan detrás de la meta: el primer cruce cuenta como el inicio de la vuelta 1.
    this.crossedHalf = true;
    this.progress = -1;
    this.finished = false;
    this.item = null;
    this.itemUses = 0;
    this.pendingItem = null;
    this.rollMs = 0;
    this.shrinkMs = 0;
    this.inkMs = 0;
    this.size = 1;
    this.coins = 0;
    // Para el dibujo del piloto: hacia dónde gira y si acaba de lanzar un poder.
    this.steerInput = 0;
    this.throwMs = 0;
    // Cuándo apretó acelerar durante la cuenta regresiva (para el arranque turbo).
    this.startPress = null;
    this.nitro = NITRO_CHARGES;
    this.nitroRefillMs = 0;
    this.boostMs = 0;
    this.boostFactor = 1;
    this.spinMs = 0;
    this.shieldMs = 0;
    this.wrongWayMs = 0;
    this.messageMs = 0;
    this.message = '';
    this.y = 0;
    this.vy = 0;
    this.floor = 0;
    this.flying = false;
    this.ramp = 0;
    // Qué tan inclinado va (subiendo o bajando una loma).
    this.pitch = 0;
    this.onPad = false;
    this.drifting = false;
    this.driftDir = 0;
    this.driftMs = 0;
    this.visualYaw = 0;
    this.trick = false;
    this.trickAt = 0;
    this.gliding = false;
    this.rampGlider = false;
    this.underwater = false;
    this.shortcut = false;
    // Cayéndose de un puente colgante (ver ledges.js): cuánto lleva cayendo.
    this.fallMs = 0;
    this.starMs = 0;
    this.bulletMs = 0;
    this.ghostMs = 0;
    this.slipMs = 0;
    this.slipDir = 0;
    this.draftMs = 0;
    // Cuántas veces le pegaron (para el reto "sin un rasguño" de la Aventura).
    this.hitsTaken = 0;
    // El imán (ver KartGame.updateMagnets).
    this.magnetMs = 0;
    // Los karts especiales: cuándo se puede volver a usar el truco y el caballito de la moto.
    this.specialMs = 0;
    this.wheelieMs = 0;
    // Lo que pasó este cuadro (mini turbo, truco...), para que el juego ponga sonidos y letreros.
    this.events = [];
  }

  // Carrera (o batalla) por equipos: un aro del color del equipo en el piso, debajo del kart.
  setTeam(team, color) {
    this.team = team;
    this.teamColor = color;
    const ring = new THREE.Mesh(new THREE.RingGeometry(2, 2.45, 28).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color }));
    ring.position.y = 0.08;
    this.object.add(ring);
  }

  get airborne() {
    return this.flying || this.y > this.floor + STICK;
  }

  // Nivel de las chispas del derrape: 0 (todavía nada) a 3 (moradas).
  get driftLevel() {
    return DRIFT_LEVEL_MS.filter((ms) => this.driftMs >= ms).length;
  }

  // Sale volando de una rampa con esa velocidad hacia arriba (con `glide`, abre el planeador).
  launch(vy, glide = false) {
    if (this.drifting) this.endDrift(false);
    this.vy = vy;
    this.flying = true;
    this.trick = false;
    this.gliding = glide;
    this.events.push(glide ? 'glide' : 'jump');
  }

  // Con estrella, bala o fantasma no le pasa nada.
  get invincible() {
    return this.starMs > 0 || this.bulletMs > 0 || this.ghostMs > 0;
  }

  // Pisó un charco: se resbala un poquito hacia un lado.
  slip() {
    if (this.slipMs > 0 || this.invincible || this.airborne) return false;
    this.slipMs = SLIP_MS;
    this.slipDir = Math.random() < 0.5 ? -1 : 1;
    if (this.drifting) this.endDrift(true);
    return true;
  }

  // Termina el derrape: si juntó chispas (y no fue por un golpe), turbito.
  endDrift(cancelled) {
    const level = this.driftLevel;
    this.drifting = false;
    this.driftMs = 0;
    if (cancelled || level === 0) return;
    this.boost(MINI_TURBOS[level].factor, MINI_TURBOS[level].ms);
    this.events.push(`turbo${level}`);
  }

  say(text, ms = 1400) {
    this.message = text;
    this.messageMs = ms;
  }

  boost(factor, ms) {
    this.boostFactor = this.boostMs > 0 ? Math.max(this.boostFactor, factor) : factor;
    this.boostMs = Math.max(this.boostMs, ms);
  }

  // Le pega un poder: si trae burbuja se la revienta; si no, da vueltas y se frena.
  hit() {
    if (this.invincible) return false;
    if (this.shieldMs > 0) {
      this.shieldMs = 0;
      return false;
    }
    // En modo peque el golpe dura menos y tira menos monedas.
    const peque = this.setup.peque;
    this.spinMs = SPIN_MS * (peque ? 0.6 : 1);
    this.spinTotal = this.spinMs;
    this.hitsTaken += 1;
    this.speed *= 0.3;
    this.boostMs = 0;
    this.coins = Math.max(0, this.coins - (peque ? 1 : COINS_LOST));
    if (this.drifting) this.endDrift(true);
    return true;
  }

  // input: { steer: -1..1, gas: 0..1, brake: 0..1, nitro: bool, drift: LB apretado, trick: LB recién apretado }.
  // `topFactor` ayuda a los que van atrás.
  // Cara del piloto un ratito: 'feliz' (le pegó a alguien, rebasó, hizo truco) o 'enojado' (le pegaron).
  setMood(mood, ms) {
    this.mood = mood;
    this.moodMs = ms;
  }

  // El nombre para los resultados (con el copiloto, si es kart para dos).
  get displayName() {
    return this.passenger ? `${this.driver.name} y ${this.passenger.name}` : this.driver.name;
  }

  update(dtMs, input, offroad, topFactor = 1) {
    this.specialMs = Math.max(0, this.specialMs - dtMs);
    this.wheelieMs = Math.max(0, this.wheelieMs - dtMs);
    this.moodMs = Math.max(0, (this.moodMs ?? 0) - dtMs);
    const dt = dtMs / 1000;
    this.boostMs = Math.max(0, this.boostMs - dtMs);
    this.landMs = Math.max(0, (this.landMs ?? 0) - dtMs);
    this.spinMs = Math.max(0, this.spinMs - dtMs);
    this.shieldMs = Math.max(0, this.shieldMs - dtMs);
    this.messageMs = Math.max(0, this.messageMs - dtMs);
    this.shrinkMs = Math.max(0, this.shrinkMs - dtMs);
    this.inkMs = Math.max(0, this.inkMs - dtMs);
    this.throwMs = Math.max(0, this.throwMs - dtMs);
    this.starMs = Math.max(0, this.starMs - dtMs);
    this.bulletMs = Math.max(0, this.bulletMs - dtMs);
    this.ghostMs = Math.max(0, this.ghostMs - dtMs);
    this.slipMs = Math.max(0, this.slipMs - dtMs);
    if (this.rollMs > 0) {
      this.rollMs = Math.max(0, this.rollMs - dtMs);
      if (this.rollMs === 0) {
        this.item = this.pendingItem;
        this.itemUses = this.pendingUses;
        this.events.push('item');
      }
    }
    if (this.nitro < NITRO_CHARGES) {
      this.nitroRefillMs += dtMs;
      if (this.nitroRefillMs >= NITRO_REFILL_MS) {
        this.nitro += 1;
        this.nitroRefillMs = 0;
      }
    }

    const spinning = this.spinMs > 0;
    const gas = spinning ? 0 : input.gas;
    const steer = spinning ? 0 : input.steer;
    this.steerInput = steer;
    if (input.nitro && !spinning && this.nitro >= 1) {
      this.nitro -= 1;
      this.boost(this.stats.nitroFactor ?? NITRO_FACTOR, this.stats.nitroMs ?? NITRO_MS);
    }

    const { turn } = this.stats;
    const maxSpeed = this.stats.maxSpeed * this.speedClass;
    const accel = this.stats.accel * this.speedClass;
    const coins = 1 + COIN_BOOST * this.coins;
    const power = this.bulletMs > 0 ? BULLET_SPEED : this.starMs > 0 ? STAR_SPEED : 1;
    const top =
      maxSpeed * topFactor * coins * power * (this.boostMs > 0 ? this.boostFactor : 1) * (offroad && this.starMs === 0 ? this.stats.offroad : 1) *
      (this.shrinkMs > 0 ? SHRINK_SPEED : 1) * (this.underwater ? WATER_SPEED : 1);
    if (this.bulletMs > 0 || this.starMs > 0) {
      this.speed = approach(this.speed, top, accel * 3 * dt);
    } else if (this.boostMs > 0) {
      this.speed = approach(this.speed, top, accel * 2 * dt);
    } else if (gas > 0.1) {
      const target = top * gas;
      this.speed = approach(this.speed, target, (this.speed < target ? accel : COAST) * dt);
    } else if (input.brake > 0.1 && !spinning) {
      this.speed = this.speed > 0 ? Math.max(0, this.speed - BRAKE * dt) : Math.max(-REVERSE_MAX, this.speed - accel * 0.6 * dt);
    } else {
      this.speed = approach(this.speed, 0, COAST * dt);
    }

    const air = this.airborne;
    if (!this.drifting && input.drift && !air && !spinning && Math.abs(steer) > 0.3 && this.speed > DRIFT_MIN_SPEED) {
      this.drifting = true;
      this.driftDir = Math.sign(steer);
      this.driftMs = 0;
    }
    if (this.drifting && (!input.drift || spinning || this.speed < DRIFT_MIN_SPEED * 0.6)) this.endDrift(spinning);
    // Derrapando siempre gira hacia el lado del derrape: con el stick hacia ese lado, más cerrado; hacia el otro, más abierto.
    let turning = steer;
    if (this.drifting) {
      const before = this.driftLevel;
      this.driftMs += dtMs;
      if (this.driftLevel > before) this.events.push(`spark${this.driftLevel}`);
      const lean = (steer * this.driftDir + 1) / 2;
      turning = this.driftDir * (DRIFT_TURN.min + (DRIFT_TURN.max - DRIFT_TURN.min) * lean);
    }

    // Parado no gira; en reversa el volante se invierte, como un carro de verdad. En el aire casi no gira.
    const grip = Math.min(1, Math.abs(this.speed) / 10) * (this.speed < 0 ? -1 : 1) * (air && !this.gliding ? AIR_STEER : 1);
    this.heading -= turning * turn * grip * dt * (this.slipMs > 0 ? 0.4 : 1);
    // En un charco se va de lado solito.
    if (this.slipMs > 0) this.heading += this.slipDir * SLIP_TURN * (this.slipMs / SLIP_MS) * dt;
    this.x += Math.sin(this.heading) * this.speed * dt;
    this.z += Math.cos(this.heading) * this.speed * dt;

    // Altura: arriba de una rampa sigue el piso; en el aire cae. Un truco en el aire da turbito al caer.
    if (air) {
      // Un truco (y otro, si ya acabó el anterior): hacia dónde apunta el stick dice cuál.
      const now = performance.now();
      if (input.trick && (!this.trick || now - this.trickAt > TRICK_SPIN_MS)) {
        const up = input.trickY ?? 0;
        this.trickKind = up < -0.5 ? 'flip' : up > 0.5 ? 'back' : Math.abs(steer) > 0.5 ? (steer > 0 ? 'roll' : 'rollLeft') : 'spin';
        this.tricks = this.trick ? this.tricks + 1 : 1;
        this.trick = true;
        this.trickAt = now;
        this.events.push(this.tricks > 1 ? 'combo' : `trick-${this.trickKind}`);
      }
      this.vy -= GRAVITY * (this.gliding ? GLIDE_GRAVITY : 1) * (this.underwater ? WATER_GRAVITY : 1) * dt;
      if (this.gliding) this.vy = Math.max(this.vy, -GLIDE_MAX_FALL);
      this.y += this.vy * dt;
      if (this.y <= this.floor) {
        this.y = this.floor;
        this.vy = 0;
        this.flying = false;
        this.gliding = false;
        if (this.trick) {
          const extra = this.tricks - 1;
          this.boost(TRICK_BOOST.factor + extra * TRICK_BOOST.perTrick.factor, TRICK_BOOST.ms + extra * TRICK_BOOST.perTrick.ms);
        }
        this.trick = false;
        this.tricks = 0;
        this.landMs = LAND_MS;
        this.events.push('land');
      }
    } else {
      this.y = this.floor;
    }
  }

  // Lo encogió un rayo (la burbuja lo protege). Devuelve true si sí lo encogió.
  shrink() {
    if (this.invincible) return false;
    if (this.shieldMs > 0) {
      this.shieldMs = 0;
      return false;
    }
    this.shrinkMs = SHRINK_MS;
    this.speed *= 0.6;
    if (this.drifting) this.endDrift(true);
    return true;
  }

  render(timeMs) {
    const spin = this.spinMs > 0 ? (1 - this.spinMs / (this.spinTotal ?? SPIN_MS)) * Math.PI * 4 : 0;
    const hover = this.setup.type === 'nave' ? HOVER.height + Math.sin(timeMs / 280) * HOVER.bob : 0;
    this.object.position.set(this.x, this.y + hover, this.z);
    // Subiendo, la trompa va hacia arriba; bajando, hacia abajo.
    this.object.rotation.order = 'YXZ';
    this.object.rotation.x = -this.pitch - (this.wheelieMs > 0 ? WHEELIE_TILT * Math.min(1, this.wheelieMs / 250) : 0);
    // Encogido por el rayo: se hace chiquito poco a poco (y vuelve a crecer igual).
    this.size += ((this.shrinkMs > 0 ? SHRINK_SCALE : 1) - this.size) * 0.15;
    // Recién caído: se aplasta y rebota. (Los jefes son más grandes: `bigness`.)
    const land = this.landMs > 0 ? Math.sin((this.landMs / LAND_MS) * Math.PI) * (this.landMs / LAND_MS) : 0;
    const size = this.size * (this.bigness ?? 1);
    this.object.scale.set(size * (1 + 0.16 * land), size * (1 - 0.24 * land), size * (1 + 0.16 * land));
    // Derrapando, la trompa apunta más hacia adentro de la curva (se ve de lado).
    this.visualYaw += ((this.drifting ? -this.driftDir * DRIFT_YAW : 0) - this.visualYaw) * 0.2;
    this.object.rotation.y = this.heading + spin + this.visualYaw;
    // El truco: una vuelta de lado, un mortal (para adelante o para atrás) o un giro.
    const turn = this.trick ? Math.min(1, (timeMs - this.trickAt) / TRICK_SPIN_MS) * Math.PI * 2 : 0;
    const kind = this.trick ? this.trickKind : null;
    this.object.rotation.z = kind === 'roll' ? -turn : kind === 'rollLeft' ? turn : 0;
    if (kind === 'flip') this.object.rotation.x -= turn;
    else if (kind === 'back') this.object.rotation.x += turn;
    else if (kind === 'spin') this.object.rotation.y += turn;
    const level = this.drifting ? this.driftLevel : 0;
    for (const spark of this.sparks) {
      spark.visible = level > 0;
      if (!spark.visible) continue;
      if (level === 4) spark.material.color.setHSL((timeMs / 300) % 1, 1, 0.6);
      else spark.material.color.setHex(SPARK_COLORS[level]);
      spark.scale.setScalar((0.7 + level * 0.25) * (0.75 + Math.random() * 0.5));
    }
    this.flame.visible = this.boostMs > 0;
    if (this.flame.visible) this.flame.scale.setScalar(0.8 + Math.sin(timeMs / 30) * 0.25);
    // La burbuja parpadea cuando está por acabarse.
    this.shield.visible = this.shieldMs > 0 && (this.shieldMs > 1500 || Math.floor(this.shieldMs / 120) % 2 === 0);
    // El planeador se inclina con el volante; la hélice da vueltas bajo el agua.
    this.wing.visible = this.gliding;
    this.wing.rotation.z = this.steerInput * 0.35;
    this.propeller.visible = this.underwater;
    if (this.propeller.visible) this.propeller.rotation.z = timeMs / 40;
    // Estrella: brillo de colores que cambia. Fantasma: se ve y no se ve.
    this.starGlow.visible = this.starMs > 0;
    if (this.starGlow.visible) this.starGlow.material.color.setHSL((timeMs / 400) % 1, 1, 0.6);
    this.bullet.visible = this.bulletMs > 0;
    this.object.visible = this.ghostMs === 0 || Math.floor(timeMs / 90) % 3 !== 0;
  }
}

// Planeador: un ala delta del color del kart con dos palitos.
function buildWing(color) {
  const wing = new THREE.Group();
  const shape = new THREE.Shape();
  shape.moveTo(0, 1.6);
  shape.lineTo(3.4, -1.2);
  shape.lineTo(0, -0.5);
  shape.lineTo(-3.4, -1.2);
  shape.closePath();
  const sail = new THREE.Mesh(new THREE.ShapeGeometry(shape), new THREE.MeshLambertMaterial({ color, side: THREE.DoubleSide }));
  sail.rotation.x = -Math.PI / 2;
  sail.position.y = 3.2;
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.08, 2.6), new THREE.MeshLambertMaterial({ color: 0xffffff }));
  stripe.position.set(0, 3.25, 0.2);
  const poleMaterial = new THREE.MeshLambertMaterial({ color: 0x5a4a3a });
  for (const x of [-0.8, 0.8]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.2, 5), poleMaterial);
    pole.position.set(x, 2.1, -0.2);
    wing.add(pole);
  }
  wing.add(sail, stripe);
  wing.visible = false;
  return wing;
}

// Hélice: tres aspas atrás del kart.
function buildPropeller() {
  const propeller = new THREE.Group();
  const blade = new THREE.BoxGeometry(0.2, 1.1, 0.08).translate(0, 0.55, 0);
  const material = new THREE.MeshLambertMaterial({ color: 0xffd02a });
  for (let k = 0; k < 3; k += 1) {
    const mesh = new THREE.Mesh(blade, material);
    mesh.rotation.z = (k / 3) * Math.PI * 2;
    propeller.add(mesh);
  }
  propeller.position.set(0, 0.8, -1.9);
  propeller.visible = false;
  return propeller;
}

// Bala: un proyectil negro gigante con ojos enojados que tapa al kart.
function buildBullet() {
  const bullet = new THREE.Group();
  const black = new THREE.MeshLambertMaterial({ color: 0x24202e });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 3.6, 16).rotateX(Math.PI / 2), black);
  const nose = new THREE.Mesh(new THREE.SphereGeometry(1.6, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2).rotateX(Math.PI / 2), black);
  nose.position.z = 1.8;
  const white = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const pupil = new THREE.MeshBasicMaterial({ color: 0x1b1530 });
  for (const x of [-0.6, 0.6]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.42, 10, 8), white);
    eye.position.set(x, 0.55, 2.35);
    const dot = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), pupil);
    dot.position.set(x, 0.55, 2.7);
    bullet.add(eye, dot);
  }
  const fin = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.15, 0.9), new THREE.MeshLambertMaterial({ color: 0xe53935 }));
  fin.position.z = -1.6;
  bullet.add(body, nose, fin);
  bullet.position.y = 1.5;
  bullet.visible = false;
  return bullet;
}

function approach(value, target, step) {
  return value < target ? Math.min(target, value + step) : Math.max(target, value - step);
}
