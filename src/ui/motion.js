import { frameDelta } from '../shared/clock.js';

// Animación "de caricatura" de los personajes, igual en todos los juegos. Se mueve un contenedor (`rig`) que tiene
// la imagen adentro y está parado en los pies, así que no pelea con la escala que cada juego le pone a la imagen:
// - se estiran al saltar, se aplastan al caer (más entre más fuerte cayeron) y se estiran de lado al pegar;
// - parados "respiran", parpadean y, si nadie los mueve un rato, hacen gestos (festejan o bailan);
// - cayendo usan su pose de caída, y los juegos les pueden poner una cara un ratito (express) o hacerlos bailar
//   (dance; en los pasos de baile se voltean de un lado al otro: `flipped`);
// - corriendo rápido se inclinan, y con `onDust` echan polvito al correr, saltar y caer.
// Las poses nuevas (parpadeo, caras, caída, baile) son opcionales: si el personaje no las tiene, se usa la que se
// parece.

const AIR = new Set(['salto', 'aire', 'caer']);
const HIT = new Set(['golpe', 'patada', 'especial', 'agarre']);
// Si falta la pose, la que más se parece (al final, la que se pidió).
const CHAIN = {
  parpadeo: ['parpadeo'],
  feliz: ['feliz', 'gana'],
  enojado: ['enojado'],
  asustado: ['asustado'],
  caer: ['caer'],
  mareado: ['mareado', 'dolor'],
  baile1: ['baile1', 'feliz', 'gana', 'salto'],
  baile2: ['baile2', 'normal'],
};
// Bloquecito (sin poses nuevas): la suya que se parece.
const BLOCK_POSE = { parpadeo: 'normal', feliz: 'normal', enojado: 'normal', asustado: 'dolor', caer: 'salto', mareado: 'dolor', baile1: 'salto', baile2: 'normal' };
// El resorte del estirón: qué tan duro regresa y qué tanto se frena (poquito: rebota como gelatina).
const SPRING = { k: 420, damp: 13 };
const LAND = { squash: 0.26, fullSpeed: 900 };
const JUMP_STRETCH = 0.2;
const HIT_STRETCH = 0.17;
const HURT_SQUASH = 0.2;
const FALL_POSE_SPEED = 80;
const RUN = { lean: 7, speed: 230, dustMs: 150 };
const BLINK = { ms: 120, min: 1800, max: 4800 };
const IDLE = { breathe: 0.022, gestureAfter: 7000, every: [5000, 9000] };
const DANCE_STEP_MS = 280;

export class Motion {
  // has(pose): si el personaje tiene el dibujo de esa pose. expressive = false (Bloquecito): solo se estira, sin
  // poses nuevas. onDust(x, y, dir, count): echar polvito en los pies (null = sin polvo).
  constructor(rig, { has = () => false, expressive = true, onDust = null } = {}) {
    this.rig = rig;
    this.has = has;
    this.expressive = expressive;
    this.onDust = onDust;
    this.stretch = 0;
    this.speed = 0;
    this.side = 0;
    this.sideSpeed = 0;
    this.prev = null;
    this.last = null;
    this.vx = 0;
    this.vy = 0;
    this.idleMs = 0;
    this.time = Math.random() * 10;
    this.blinkIn = rand(BLINK.min, BLINK.max);
    this.blinkMs = 0;
    this.gestureIn = rand(...IDLE.every);
    this.hopMs = 0;
    this.hopTotal = 1;
    this.expression = null;
    this.expressionMs = 0;
    this.danceMs = 0;
    this.dustMs = 0;
  }

  // Una cara un ratito (feliz, enojado, asustado, mareado...), mientras esté parado.
  express(pose, ms = 900) {
    if (!this.expressive) return;
    this.expression = pose;
    this.expressionMs = ms;
  }

  // ¡A bailar! (festejos): pasos de baile con brinquito, aunque se esté moviendo.
  dance(ms = 2000) {
    this.danceMs = ms;
  }

  hop(ms = 320) {
    this.hopMs = ms;
    this.hopTotal = ms;
  }

  // Cada cuadro: `requested` es la pose que pidió el juego y (x, y) dónde quedan los pies en el mundo.
  // Devuelve la pose que de veras se dibuja y acomoda el rig.
  frame(requested, x, y) {
    const dtMs = frameDelta();
    const dt = dtMs / 1000;
    this.time += dt;
    if (this.last && dt > 0) {
      // (La velocidad se suaviza: un cuadro suelto no cuenta.)
      this.vx += ((x - this.last.x) / dt - this.vx) * 0.5;
      this.vy += ((y - this.last.y) / dt - this.vy) * 0.5;
    }
    this.last = { x, y };
    const air = AIR.has(requested);
    const wasAir = this.prev !== null && AIR.has(this.prev);
    const changed = this.prev !== null && requested !== this.prev;
    if (changed) this.onPoseChange(requested, air, wasAir, x, y);
    this.prev = requested;

    // Qué se dibuja.
    let shown = requested;
    this.flipped = false;
    this.expressionMs = Math.max(0, this.expressionMs - dtMs);
    this.danceMs = Math.max(0, this.danceMs - dtMs);
    const standing = requested === 'normal';
    this.idleMs = standing && Math.abs(this.vx) < 30 ? this.idleMs + dtMs : 0;
    if (this.expressive) {
      if (this.danceMs > 0 && requested !== 'dolor') {
        // Un paso para cada lado (volteándose), con brinquito.
        const step = Math.floor(this.danceMs / DANCE_STEP_MS);
        shown = step % 2 ? 'baile1' : 'baile2';
        this.flipped = step % 2 === 0;
        if (this.hopMs <= 0) this.hop(DANCE_STEP_MS);
      } else if (this.expressionMs > 0 && standing) {
        shown = this.expression;
      } else if (requested === 'salto' && this.vy > FALL_POSE_SPEED) {
        shown = 'caer';
      } else if (standing) {
        shown = this.idle(dtMs);
      }
      shown = this.resolve(shown, requested);
    } else {
      shown = BLOCK_POSE[requested] ?? requested;
    }

    // El resorte: estirado (+) o aplastado (−), y el estirón de lado de los golpes.
    let target = 0;
    if (air) target = Math.min(0.14, Math.abs(this.vy) / 3200);
    else if (standing) target = IDLE.breathe * Math.sin(this.time * Math.PI * 0.9);
    this.speed += (-SPRING.k * (this.stretch - target) - SPRING.damp * this.speed) * dt;
    this.stretch += this.speed * dt;
    this.sideSpeed += (-SPRING.k * this.side - SPRING.damp * this.sideSpeed) * dt;
    this.side += this.sideSpeed * dt;
    // (El tamaño de cada pose lo iguala fitPose en smash/art.js.)
    const sy = clamp(1 + this.stretch - this.side * 0.5, 0.62, 1.45);
    const sx = clamp(1 - this.stretch * 0.6 + this.side, 0.7, 1.4);
    this.rig.setScale(sx, sy);

    // Corriendo rápido se inclina hacia adelante (y echa polvito).
    const running = !air && Math.abs(this.vx) > RUN.speed && requested.startsWith('caminar');
    this.rig.setAngle(running ? Math.sign(this.vx) * RUN.lean : 0);
    this.dustMs = Math.max(0, this.dustMs - dtMs);
    if (running && this.dustMs === 0 && this.onDust) {
      this.dustMs = RUN.dustMs;
      this.onDust(x - Math.sign(this.vx) * 10, y, -Math.sign(this.vx), 1);
    }

    // Brinquito (gestos y baile).
    this.hopMs = Math.max(0, this.hopMs - dtMs);
    this.rig.y = this.baseY - (this.hopMs > 0 ? Math.sin((1 - this.hopMs / this.hopTotal) * Math.PI) * 16 : 0);
    return shown;
  }

  get baseY() {
    return this.rig.baseY ?? 0;
  }

  onPoseChange(pose, air, wasAir, x, y) {
    if (air && !wasAir) {
      // Despega: se estira.
      this.stretch = JUMP_STRETCH;
      this.speed = 0;
      this.onDust?.(x, y, 0, 3);
    } else if (!air && wasAir) {
      // Cae: se aplasta (más entre más rápido venía).
      const k = clamp(Math.max(this.vy, 300) / LAND.fullSpeed, 0.45, 1.25);
      this.stretch = -LAND.squash * k;
      this.speed = 0;
      this.onDust?.(x, y, 0, k > 0.8 ? 6 : 4);
    } else if (HIT.has(pose)) {
      this.side = HIT_STRETCH;
      this.sideSpeed = 0;
    } else if (pose === 'dolor') {
      this.stretch = -HURT_SQUASH;
      this.side = 0.12;
      this.speed = 0;
    }
  }

  // Parado: parpadea de vez en cuando y, si lleva rato sin moverse, hace gestos.
  idle(dtMs) {
    this.blinkIn -= dtMs;
    if (this.blinkIn <= 0) {
      this.blinkIn = rand(BLINK.min, BLINK.max);
      this.blinkMs = BLINK.ms;
    }
    if (this.blinkMs > 0) {
      this.blinkMs -= dtMs;
      return 'parpadeo';
    }
    if (this.idleMs > IDLE.gestureAfter) {
      this.gestureIn -= dtMs;
      if (this.gestureIn <= 0) {
        this.gestureIn = rand(...IDLE.every);
        if (Math.random() < 0.5) {
          this.express('feliz', 900);
          this.hop(380);
        } else {
          this.dance(DANCE_STEP_MS * 5);
        }
      }
    }
    return 'normal';
  }

  // La primera pose de la cadena que sí tenga dibujo; si ninguna, la que pidió el juego.
  resolve(pose, requested) {
    const chain = CHAIN[pose];
    if (!chain) return pose;
    return chain.find((p) => this.has(p)) ?? (pose === requested ? requested : CHAIN[requested] ? 'normal' : requested);
  }
}

function rand(min, max) {
  return min + Math.random() * (max - min);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
