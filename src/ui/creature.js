import { frameDelta } from '../shared/clock.js';

// Monstruos y jefes con vida (como los personajes con motion.js): cambian de dibujo según lo que hacen —poses de
// Gemini <arte>-<pose>— y se estiran y aplastan como gelatina. Solo se toca la imagen (su textura, su escala y un
// temblorcito de lado); voltearla, girarla o moverla le toca a cada juego.
//   todos:  paso (caminando alterna con la normal y rebota en cada paso), ataque, dolor y burla (se carcajea cuando
//           le pega a un jugador);
//   jefes:  furioso (con poca vida camina y respira enojado y tiembla), cargando (se agacha temblando antes de su
//           ataque), mareado (se tambalea) y derrotado (aplastado).
// Si le falta una pose se usa la que se parece y al final la normal (sin las poses nuevas solo se estira y aplasta).
// Su manera de moverse (`gait`), aunque no tenga dibujos de paso:
//   walk:  caminando rebota en cada paso y se balancea de un lado al otro (tortugas, hongos...);
//   fly:   aletea (se estira y aplasta rapidito) y se inclina hacia donde va (pájaros, murciélagos...);
//   swim:  coletea (se mece) (peces);   float: late como medusa (se contrae y se estira despacito).
// Al darse la vuelta se aplasta de lado (face) y puede dar un brinquito de "¡te vi!" (hop).
// El tamaño: con las medidas de art.json (tools/pose-metrics.mjs) todas las poses "pesan" lo mismo y se paran en el
// mismo lugar aunque la imagen sea más ancha o más bajita; sin medidas, todas del mismo alto.
export const MONSTER_POSES = ['paso', 'ataque', 'dolor', 'burla'];
export const BOSS_POSES = [...MONSTER_POSES, 'furioso', 'cargando', 'mareado', 'derrotado'];
const POSE_NAME = new RegExp(`-(${BOSS_POSES.join('|')})$`);

// ¿Es una pose (<monstruo>-<pose>) y no un monstruo? (Para cargar al principio solo los dibujos normales.)
export function isPoseName(name) {
  return POSE_NAME.test(name);
}
const CHAIN = {
  furioso: ['furioso', 'ataque'],
  cargando: ['cargando', 'ataque'],
  mareado: ['mareado', 'dolor'],
  derrotado: ['derrotado', 'dolor'],
};
// El resorte (como el de motion.js) y los empujones de cada pose: estirón (+ arriba, − aplastado) y de lado.
const SPRING = { k: 380, damp: 11 };
const KICK = {
  ataque: { side: 0.2 },
  dolor: { stretch: -0.24, side: 0.12 },
  burla: { stretch: 0.12 },
  furioso: { stretch: 0.1, side: 0.08 },
  cargando: { stretch: -0.2, side: 0.1 },
  mareado: { side: -0.1 },
  derrotado: { stretch: -0.32, side: 0.2 },
};
const STEP_MS = 200;
const STEP_BOUNCE = 0.07;
const BREATHE = { amount: 0.03, angry: 0.06 };
const LAUGH = { amount: 0.05, speed: 26 };
const TREMBLE = { furioso: 1.6, cargando: 2.6 };
const SWAY = { amount: 0.08, speed: 5 };
// Las maneras de moverse: qué tanto rebota (fracción de su tamaño) y se balancea al caminar, el aleteo, el coleteo y
// el latido; y el brinquito.
const GAITS = {
  walk: { bounce: 0.09, waddle: 8 },
  fly: { flap: 0.14, flapSpeed: 17, tilt: 9 },
  swim: { tilt: 11, speed: 4.5 },
  float: { pulse: 0.13, speed: 3.5 },
};
const HOP = { ms: 380, height: 0.28 };
const TURN_SQUASH = 0.3;

// Pide las poses de un monstruo que estén en `available` (la lista de art.json): `key` = su textura normal
// ('plat:hongo-malo') y `url(pose)` = de dónde se baja cada una. Se cargan mientras se juega y aparecen al llegar.
export function requestCreaturePoses(scene, key, url, available, poses = BOSS_POSES) {
  const art = key.slice(key.indexOf(':') + 1);
  let added = false;
  for (const pose of poses) {
    const poseKey = `${key}-${pose}`;
    if (!available.includes(`${art}-${pose}`) || scene.textures.exists(poseKey)) continue;
    scene.load.image(poseKey, url(pose));
    added = true;
  }
  if (added && !scene.load.isLoading()) scene.load.start();
}

export class Creature {
  // `image`: la imagen (origen abajo, en los pies). `key`: su textura normal. `size`: qué tan alta se ve la normal (con
  // fit 'max', lo más largo). `metrics`: las medidas de art.json ({ <arte>-<pose>: [área, centro, alto] }).
  // `gait`: cómo se mueve (walk | fly | swim | float, o null).
  constructor(scene, image, key, { size, fit = 'height', metrics = {}, gait = null }) {
    this.scene = scene;
    this.image = image;
    this.key = key;
    this.art = key.slice(key.indexOf(':') + 1);
    this.size = size;
    this.fit = fit;
    this.metrics = metrics;
    this.baseX = image.x;
    this.baseY = image.y;
    this.gait = gait;
    this.facing = null;
    this.hopMs = 0;
    this.shown = null;
    this.request = 'normal';
    this.stretch = 0;
    this.speed = 0;
    this.side = 0;
    this.sideSpeed = 0;
    this.time = Math.random() * 10;
    this.stepMs = 0;
    this.step = 0;
    this.hurtMs = 0;
    this.tauntMs = 0;
    this.angry = false;
    this.scale = 1;
    this.center = 0.5;
    this.setTexture(key);
  }

  // Qué está haciendo (cada cuadro): 'normal', 'caminar', 'ataque', 'cargando', 'mareado', 'derrotado'...
  set(pose) {
    this.request = pose;
  }

  // Un ratito con cara de dolor (le pegaron) o carcajeándose (le pegó a alguien).
  hurt(ms = 420) {
    this.hurtMs = ms;
  }

  taunt(ms = 900) {
    if (this.hurtMs === 0) this.tauntMs = ms;
  }

  // Hacia dónde ve (1 o -1): si se da la vuelta, se aplasta de lado.
  face(dir) {
    if (this.facing !== null && dir !== this.facing) {
      this.side = -TURN_SQUASH;
      this.sideSpeed = 0;
    }
    this.facing = dir;
  }

  // Un brinquito (como diciendo "¡te vi!").
  hop() {
    if (this.hopMs > 0) return;
    this.hopMs = HOP.ms;
    this.stretch = 0.18;
    this.speed = 0;
  }

  // Cayó al piso: se aplasta (`k` = qué tan fuerte, 0 a 1).
  land(k = 1) {
    this.stretch = -0.26 * Math.min(1.3, k);
    this.speed = 0;
  }

  has(pose) {
    return pose === 'normal' || this.scene.textures.exists(`${this.key}-${pose}`);
  }

  // La pose que se ve: el dolor y la burla ganan (la burla solo si está parado o caminando).
  resolve(dtMs) {
    this.hurtMs = Math.max(0, this.hurtMs - dtMs);
    this.tauntMs = Math.max(0, this.tauntMs - dtMs);
    let pose = this.request;
    const calm = pose === 'normal' || pose === 'caminar';
    if (this.hurtMs > 0 && pose !== 'derrotado') pose = 'dolor';
    else if (this.tauntMs > 0 && calm) pose = 'burla';
    if (pose === 'caminar') {
      this.stepMs += dtMs;
      if (this.stepMs >= STEP_MS) {
        this.stepMs -= STEP_MS;
        this.step += 1;
        // Cada paso rebota un poquito.
        this.speed += STEP_BOUNCE * 9;
      }
      pose = this.step % 2 ? 'paso' : this.angry ? 'furioso' : 'normal';
    } else if (pose === 'normal' && this.angry) {
      pose = 'furioso';
    }
    for (const candidate of CHAIN[pose] ?? [pose]) if (this.has(candidate)) return candidate;
    return 'normal';
  }

  update(dtMs = frameDelta()) {
    const pose = this.resolve(dtMs);
    if (pose !== this.shown) {
      const before = this.shown;
      this.shown = pose;
      this.setTexture(pose === 'normal' ? this.key : `${this.key}-${pose}`);
      const kick = KICK[pose];
      if (kick && before !== null) {
        if (kick.stretch !== undefined) {
          this.stretch = kick.stretch;
          this.speed = 0;
        }
        if (kick.side !== undefined) {
          this.side = kick.side;
          this.sideSpeed = 0;
        }
      }
    }
    const dt = Math.min(dtMs, 50) / 1000;
    this.time += dt;
    // A dónde quiere regresar el resorte: respirando parado, carcajeándose o aplastado de derrotado.
    let target = 0;
    const request = this.request;
    const gait = GAITS[this.gait];
    if (pose === 'burla') target = LAUGH.amount * Math.sin(this.time * LAUGH.speed);
    else if (this.gait === 'fly' && pose !== 'dolor') target = gait.flap * Math.sin(this.time * gait.flapSpeed);
    else if (this.gait === 'float' && pose !== 'dolor') target = gait.pulse * Math.sin(this.time * gait.speed);
    else if (request === 'normal') target = (this.angry ? BREATHE.angry : BREATHE.amount) * Math.sin(this.time * Math.PI * (this.angry ? 1.8 : 0.9));
    else if (pose === 'derrotado') target = -0.08;
    const sideTarget = pose === 'mareado' ? SWAY.amount * Math.sin(this.time * SWAY.speed) : 0;
    this.speed += (-SPRING.k * (this.stretch - target) - SPRING.damp * this.speed) * dt;
    this.stretch += this.speed * dt;
    this.sideSpeed += (-SPRING.k * (this.side - sideTarget) - SPRING.damp * this.sideSpeed) * dt;
    this.side += this.sideSpeed * dt;
    const sy = clamp(1 + this.stretch - this.side * 0.5, 0.55, 1.45);
    const sx = clamp(1 - this.stretch * 0.6 + this.side, 0.7, 1.45);
    this.image.setScale(this.scale * sx, this.scale * sy);
    // Con coraje o cargando su ataque, tiembla.
    const tremble = TREMBLE[pose] ?? (this.angry && request === 'normal' ? TREMBLE.furioso * 0.5 : 0);
    this.image.x = this.baseX + (tremble ? Math.sin(this.time * 60) * tremble : 0);
    this.image.setOrigin(this.image.flipX ? 1 - this.center : this.center, 1);
    this.move(dtMs, request);
  }

  // Lo que hace su manera de moverse: el rebote y el balanceo de cada paso, la inclinación al volar o nadar y el
  // brinquito. (Mueve la imagen hacia arriba y la gira; el juego mueve y voltea lo de afuera.)
  move(dtMs, request) {
    this.hopMs = Math.max(0, this.hopMs - dtMs);
    const hop = this.hopMs > 0 ? Math.sin((1 - this.hopMs / HOP.ms) * Math.PI) * HOP.height * this.size : 0;
    let lift = hop;
    let angle = null;
    const gait = GAITS[this.gait];
    const walking = request === 'caminar';
    if (this.gait === 'walk') {
      // Media vuelta de seno por paso: sube y baja en cada uno y se ladea a un lado y luego al otro.
      const phase = ((this.step + this.stepMs / STEP_MS) * Math.PI) % (Math.PI * 2);
      lift += walking ? Math.abs(Math.sin(phase)) * gait.bounce * this.size : 0;
      angle = walking ? Math.sin(phase) * gait.waddle : 0;
    } else if (this.gait === 'fly') {
      angle = gait.tilt * (this.image.flipX ? -1 : 1) + Math.sin(this.time * 3) * 3;
    } else if (this.gait === 'swim') {
      angle = Math.sin(this.time * gait.speed) * gait.tilt;
    }
    this.image.y = this.baseY - lift;
    if (angle !== null) this.image.setAngle(angle);
  }

  // Cambia a esa textura y calcula su escala (para que todas las poses se vean del mismo tamaño).
  setTexture(key) {
    const image = this.image;
    if (!image.setTexture || !this.scene.textures.exists(key)) return;
    image.setTexture(key);
    const name = key.slice(key.indexOf(':') + 1);
    const normal = this.metrics[this.art];
    const pose = this.metrics[name];
    const source = this.scene.textures.get(this.key).getSourceImage();
    const base = this.size / (this.fit === 'max' ? Math.max(source.width, source.height) : source.height);
    if (normal && pose) {
      this.scale = base * Math.sqrt(normal[0] / pose[0]);
      this.center = pose[1];
    } else {
      // Sin medidas: del mismo alto que la normal.
      this.scale = (base * source.height) / image.height;
      this.center = 0.5;
    }
  }
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
