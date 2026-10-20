import * as THREE from 'three';
import manifest from './art.json';

// Los peligros de cada pista (ver `hazards` en tracks.js). Cada uno se mueve a su manera:
//   cross: un animalito cruza el camino de lado a lado, se espera tantito y regresa (ovejas, cangrejos).
//   roll:  una bola rueda por la pista en sentido contrario, de bajada (donas, bolas de nieve que van creciendo).
//   slam:  bloques de piedra flotan arriba del camino y caen de golpe; su sombra avisa antes (de dos en dos:
//          siempre queda un lado libre).
//   fall:  meteoritos que caen adelante de los karts; un círculo rojo avisa dónde van a caer.
// Si al kart le pega uno, da vueltas como con un plátano (la burbuja lo protege). Saltando se esquivan.
// Se dibujan con su imagen de Gemini (kart/peligros/<nombre>.png) o, mientras no haya, con un emoji.

const EMOJI = { oveja: '🐑', cangrejo: '🦀', dona: '🍩', 'bola-nieve': '⛄', meteorito: '☄️', bloque: '😠' };
// Tamaño de cada uno (alto, en unidades del mundo) y qué tan cerca hay que pasar para que pegue.
const SIZES = { oveja: 3.2, cangrejo: 2.6, dona: 3.6, 'bola-nieve': 2.4, meteorito: 3.4 };
const REACH = 1.8;
// Después de que le pega a alguien, no le vuelve a pegar a ese mismo en un rato.
const COOLDOWN_MS = 1800;

const CROSS = { speed: 3.6, pauseMs: 1400, hop: 0.35 };
const ROLL = { speed: 15, samples: 70, restMs: 2200, growTo: 1.9 };
const SLAM = { width: 7.5, height: 4.5, lift: 9, upMs: 2200, shakeMs: 750, dropMs: 220, downMs: 1000, riseMs: 1300 };
const FALL = { everyMs: 2600, warnMs: 1700, dropMs: 550, ahead: [16, 30], radius: 4, top: 45, max: 3 };

export class Hazards {
  // `config`: { kind, pattern, spots } (spots: en qué parte de la pista, de 0 a 1).
  constructor(scene, track, config) {
    this.scene = scene;
    this.track = track;
    this.kind = config.kind;
    this.pattern = config.pattern;
    this.owned = [];
    this.list = [];
    this.shadowMaterial = this.own(new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3, depthWrite: false }));
    this.shadowGeometry = this.own(new THREE.CircleGeometry(1, 20).rotateX(-Math.PI / 2));
    this.texture = this.own(hazardTexture(this.kind, () => {
      if (this.flipped) this.flipped.needsUpdate = true;
    }));
    // La misma imagen al revés (para los que caminan hacia el otro lado).
    this.flipped = this.own(this.texture.clone());
    this.flipped.repeat.x = -1;
    this.flipped.offset.x = 1;
    const spots = config.spots ?? [];
    if (this.pattern === 'cross') spots.forEach((at, i) => this.list.push(this.critter(at, i)));
    else if (this.pattern === 'roll') spots.forEach((at, i) => this.list.push(this.ball(at, i)));
    else if (this.pattern === 'slam') spots.forEach((at, i) => [-1, 1].forEach((side) => this.list.push(this.block(at, side, i))));
    else if (this.pattern === 'fall') {
      this.ringMaterial = this.own(new THREE.MeshBasicMaterial({ color: 0xff3b3b, transparent: true, opacity: 0.8, depthWrite: false }));
      this.ringGeometry = this.own(new THREE.RingGeometry(0.8, 1, 28).rotateX(-Math.PI / 2));
      this.nextMs = FALL.everyMs;
    }
  }

  own(thing) {
    this.owned.push(thing);
    return thing;
  }

  sprite(size, center = 0) {
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.texture }));
    sprite.center.set(0.5, center);
    sprite.scale.set(size, size, 1);
    this.scene.add(sprite);
    return sprite;
  }

  shadow(size) {
    const mesh = new THREE.Mesh(this.shadowGeometry, this.shadowMaterial);
    mesh.scale.setScalar(size);
    mesh.rotation.order = 'YXZ';
    this.scene.add(mesh);
    return mesh;
  }

  // Pone algo plano (sombra, aviso) en el camino en la muestra `index`, inclinado como la loma.
  lay(mesh, spot, lift) {
    mesh.position.set(spot.x, spot.y + lift, spot.z);
    mesh.rotation.y = spot.heading;
    mesh.rotation.x = -Math.atan(this.track.slopes[spot.index]);
  }

  // Un animalito que cruza el camino en la muestra `at` (los de en medio empiezan del otro lado).
  critter(at, i) {
    const index = Math.round(at * this.track.count);
    const edge = this.track.wallDistance - 1;
    return { index, edge, side: i % 2 ? 1 : -1, lateral: (i % 2 ? 1 : -1) * edge, waitMs: i * 900, walked: 0, sprite: this.sprite(SIZES[this.kind]), shadow: this.shadow(1.4), hits: new Map() };
  }

  // Una bola que sale de la muestra `at` y rueda hacia atrás (contra los karts) `ROLL.samples` muestras.
  ball(at, i) {
    const start = Math.round(at * this.track.count);
    return { start, travelled: 0, restMs: i * 1500, lateral: 0, phase: Math.random() * 6, spin: 0, sprite: this.sprite(SIZES[this.kind], 0.5), shadow: this.shadow(1.5), hits: new Map() };
  }

  // Un bloque de piedra con cara de enojado, de un lado del camino (`side`). Los dos de un mismo lugar
  // caen por turnos, así que siempre hay por dónde pasar.
  block(at, side, i) {
    const spot = this.track.pointAt(Math.round(at * this.track.count), side * (this.track.roadWidth / 4));
    if (!this.blockGeometry) {
      this.blockGeometry = this.own(new THREE.BoxGeometry(SLAM.width, SLAM.height, SLAM.width));
      const stone = this.own(new THREE.MeshLambertMaterial({ color: 0x8a8698 }));
      const face = this.own(new THREE.MeshLambertMaterial({ map: this.texture }));
      // Caras de la caja: derecha, izquierda, arriba, abajo, frente, atrás.
      this.blockMaterials = [face, face, stone, stone, face, face];
    }
    const mesh = new THREE.Mesh(this.blockGeometry, this.blockMaterials);
    mesh.rotation.y = spot.heading;
    this.scene.add(mesh);
    const cycle = SLAM.upMs + SLAM.shakeMs + SLAM.dropMs + SLAM.downMs + SLAM.riseMs;
    // Los dos de un lugar, a media vuelta uno del otro; cada lugar empieza en otro momento.
    const clock = (side > 0 ? cycle / 2 : 0) + i * 700;
    const shadow = this.shadow(SLAM.width * 0.6);
    this.lay(shadow, spot, 0.06);
    return { x: spot.x, z: spot.z, ground: spot.y, clock, cycle, height: SLAM.lift, mesh, shadow, hits: new Map() };
  }

  // Devuelve una lista de cosas que pasaron este cuadro: { type: 'impact', x, y, z } (para el ruido y las chispas).
  // `onHit(racer, hazard)` cuando uno le pega a un kart.
  update(dtMs, timeMs, racers, onHit) {
    this.events = [];
    for (const hazard of this.list) for (const [racer, ms] of hazard.hits) hazard.hits.set(racer, ms - dtMs);
    if (this.pattern === 'cross') for (const c of this.list) this.updateCritter(c, dtMs, timeMs, racers, onHit);
    else if (this.pattern === 'roll') for (const b of this.list) this.updateBall(b, dtMs, racers, onHit);
    else if (this.pattern === 'slam') for (const b of this.list) this.updateBlock(b, dtMs, timeMs, racers, onHit);
    else if (this.pattern === 'fall') this.updateMeteors(dtMs, timeMs, racers, onHit);
    return this.events;
  }

  // ¿Le pega a algún kart? (los que van saltando por arriba se salvan).
  touch(hazard, x, z, reach, top, racers, onHit) {
    for (const racer of racers) {
      if ((hazard.hits.get(racer) ?? 0) > 0) continue;
      if (Math.hypot(racer.x - x, racer.z - z) > reach) continue;
      if (racer.y - racer.floor + racer.ramp > top) continue;
      hazard.hits.set(racer, COOLDOWN_MS);
      onHit(racer, this);
    }
  }

  updateCritter(c, dtMs, timeMs, racers, onHit) {
    const dt = dtMs / 1000;
    if (c.waitMs > 0) {
      c.waitMs -= dtMs;
    } else {
      c.lateral -= c.side * CROSS.speed * dt;
      c.walked += CROSS.speed * dt;
      // Llegó al otro lado: se voltea y se espera.
      if (Math.abs(c.lateral) >= c.edge && Math.sign(c.lateral) === -c.side) {
        c.lateral = -c.side * c.edge;
        c.side = -c.side;
        c.waitMs = CROSS.pauseMs;
      }
    }
    const spot = this.track.pointAt(c.index, c.lateral);
    const walking = c.waitMs <= 0;
    const hop = walking ? Math.abs(Math.sin(c.walked * 2.2)) * CROSS.hop : 0;
    c.sprite.position.set(spot.x, spot.y + hop, spot.z);
    // Viendo hacia donde camina, como lo ven los karts (la imagen ve a la izquierda; a la derecha del camino es
    // a la derecha de la pantalla).
    c.sprite.material.map = c.side < 0 ? this.flipped : this.texture;
    const size = SIZES[this.kind];
    this.lay(c.shadow, spot, 0.06);
    this.touch(c, spot.x, spot.z, REACH + 0.6, size * 0.6, racers, onHit);
  }

  updateBall(b, dtMs, racers, onHit) {
    const dt = dtMs / 1000;
    const size = SIZES[this.kind];
    if (b.restMs > 0) {
      b.restMs -= dtMs;
      b.sprite.visible = false;
      b.shadow.visible = false;
      if (b.restMs <= 0) b.travelled = 0;
      return;
    }
    b.travelled += (ROLL.speed * dt) / this.track.spacing;
    if (b.travelled >= ROLL.samples) {
      b.restMs = ROLL.restMs;
      return;
    }
    b.phase += dt;
    // Va de un lado a otro del camino mientras rueda.
    b.lateral = Math.sin(b.phase * 0.9) * this.track.roadWidth * 0.3;
    const grow = this.kind === 'bola-nieve' ? 1 + (ROLL.growTo - 1) * (b.travelled / ROLL.samples) : 1;
    // Al salir y al llegar se hace chiquita (no aparece de golpe).
    const fade = Math.min(1, b.travelled / 4, (ROLL.samples - b.travelled) / 4);
    const scale = size * grow * fade;
    const index = Math.round(b.start - b.travelled);
    const spot = this.track.pointAt(index, b.lateral);
    b.spin += ((ROLL.speed * dt) / (scale / 2 || 1)) * 0.6;
    b.sprite.visible = true;
    b.shadow.visible = true;
    b.sprite.material.rotation = b.spin;
    b.sprite.scale.set(scale, scale, 1);
    b.sprite.position.set(spot.x, spot.y + scale / 2, spot.z);
    this.lay(b.shadow, spot, 0.06);
    b.shadow.scale.setScalar(scale * 0.45);
    this.touch(b, spot.x, spot.z, REACH + scale * 0.4, scale * 0.8, racers, onHit);
  }

  updateBlock(b, dtMs, timeMs, racers, onHit) {
    b.clock = (b.clock + dtMs) % b.cycle;
    let t = b.clock;
    let shake = 0;
    let deadly = false;
    if (t < SLAM.upMs) {
      b.height = SLAM.lift;
    } else if ((t -= SLAM.upMs) < SLAM.shakeMs) {
      b.height = SLAM.lift;
      shake = 0.18;
    } else if ((t -= SLAM.shakeMs) < SLAM.dropMs) {
      b.height = SLAM.lift * (1 - (t / SLAM.dropMs) ** 2);
      deadly = true;
    } else if ((t -= SLAM.dropMs) < SLAM.downMs) {
      if (b.height > 0) this.events.push({ type: 'impact', x: b.x, y: b.ground, z: b.z, kind: this.kind });
      b.height = 0;
      deadly = t < 120;
    } else {
      t -= SLAM.downMs;
      b.height = SLAM.lift * (t / SLAM.riseMs);
    }
    const jitter = shake ? Math.sin(timeMs / 18) * shake : 0;
    b.mesh.position.set(b.x + jitter, b.ground + b.height + SLAM.height / 2, b.z);
    // La sombra se hace más grande y oscura mientras más abajo está (así avisa).
    const near = 1 - b.height / SLAM.lift;
    b.shadow.scale.setScalar(SLAM.width * (0.45 + near * 0.25));
    // Cuando ya está abajo también estorba: el que se le meta, choca.
    if (deadly || b.height < 0.5) this.touch(b, b.x, b.z, SLAM.width * 0.62, SLAM.height + 2, racers, onHit);
  }

  updateMeteors(dtMs, timeMs, racers, onHit) {
    this.nextMs -= dtMs;
    const racing = racers.filter((r) => !r.finished);
    if (this.nextMs <= 0 && racing.length && this.list.length < FALL.max) {
      this.nextMs = FALL.everyMs * (0.7 + Math.random() * 0.6);
      const target = racing[Math.floor(Math.random() * racing.length)];
      const ahead = FALL.ahead[0] + Math.random() * (FALL.ahead[1] - FALL.ahead[0]);
      const half = this.track.roadWidth / 2 - 1;
      const spot = this.track.pointAt(target.index + Math.round(ahead), (Math.random() * 2 - 1) * half);
      const ring = new THREE.Mesh(this.ringGeometry, this.ringMaterial);
      ring.rotation.order = 'YXZ';
      this.lay(ring, spot, 0.1);
      this.scene.add(ring);
      const shadow = this.shadow(0.1);
      this.lay(shadow, spot, 0.08);
      const rock = this.sprite(SIZES.meteorito, 0.5);
      rock.visible = false;
      this.list.push({ x: spot.x, z: spot.z, ground: spot.y, ageMs: 0, ring, rock, shadow, hits: new Map() });
    }
    this.list = this.list.filter((m) => {
      m.ageMs += dtMs;
      const left = FALL.warnMs - m.ageMs;
      // El círculo rojo late, cada vez más rápido.
      m.ring.scale.setScalar(FALL.radius * (1 + Math.sin(timeMs / (left > 600 ? 120 : 60)) * 0.08));
      m.shadow.scale.setScalar(FALL.radius * 0.8 * Math.min(1, m.ageMs / FALL.warnMs));
      if (left <= FALL.dropMs && left > 0) {
        const k = 1 - left / FALL.dropMs;
        m.rock.visible = true;
        m.rock.position.set(m.x, m.ground + FALL.top * (1 - k) + SIZES.meteorito / 2, m.z);
        m.rock.material.rotation = timeMs / 120;
      }
      if (left > 0) return true;
      this.events.push({ type: 'impact', x: m.x, y: m.ground, z: m.z, kind: this.kind });
      this.touch(m, m.x, m.z, FALL.radius + 0.8, 3, racers, onHit);
      this.scene.remove(m.ring, m.rock, m.shadow);
      m.rock.material.dispose();
      return false;
    });
  }

  // Para el letrero: qué dice cuando te pega.
  get ouch() {
    return OUCH[this.kind] ?? '¡Cuidado! 💥';
  }

  dispose() {
    for (const hazard of this.list) {
      this.scene.remove(hazard.sprite, hazard.shadow, hazard.mesh, hazard.ring, hazard.rock);
      (hazard.sprite ?? hazard.rock)?.material.dispose();
    }
    for (const thing of this.owned) thing.dispose();
    this.list = [];
  }
}

const OUCH = {
  oveja: '¡Beeee! Una oveja 🐑',
  cangrejo: '¡Te pellizcó un cangrejo! 🦀',
  dona: '¡Te atropelló una dona! 🍩',
  'bola-nieve': '¡Bola de nieve! ❄️',
  bloque: '¡Pum! El bloque 💥',
  meteorito: '¡Meteorito! ☄️',
};

// La imagen de Gemini si ya está; si no, el emoji en un cuadrito transparente. El bloque es la cara de una
// piedra: la imagen (o el emoji) va encima de un cuadro gris. `onLoad` cuando llega la imagen.
function hazardTexture(kind, onLoad) {
  const art = manifest.peligros?.includes(kind) ? `kart/peligros/${kind}.png` : null;
  if (art && kind !== 'bloque') {
    const texture = new THREE.TextureLoader().load(art, onLoad);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (kind === 'bloque') {
    ctx.fillStyle = '#8a8698';
    ctx.fillRect(0, 0, 128, 128);
    ctx.strokeStyle = '#5e5a6e';
    ctx.lineWidth = 6;
    ctx.strokeRect(3, 3, 122, 122);
  }
  if (kind === 'bloque' && !art) {
    drawAngryFace(ctx);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  if (art) {
    const image = new Image();
    image.onload = () => {
      ctx.drawImage(image, 8, 8, 112, 112);
      texture.needsUpdate = true;
      onLoad?.();
    };
    image.src = art;
  } else {
    ctx.font = `${kind === 'bloque' ? 92 : 108}px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(EMOJI[kind] ?? '❗', 64, 70);
  }
  return texture;
}

// Ojos de enojado (con cejas chuecas) y boca de dientes apretados, para el bloque que aplasta.
function drawAngryFace(ctx) {
  for (const side of [-1, 1]) {
    const x = 64 + side * 26;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(x, 56, 15, 18, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1b1530';
    ctx.beginPath();
    ctx.arc(x - side * 4, 60, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 9;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#3a3646';
    ctx.beginPath();
    ctx.moveTo(x - side * 18, 30);
    ctx.lineTo(x + side * 14, 42);
    ctx.stroke();
  }
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(36, 88, 56, 18);
  ctx.strokeStyle = '#1b1530';
  ctx.lineWidth = 4;
  ctx.strokeRect(36, 88, 56, 18);
  for (let x = 50; x < 92; x += 14) {
    ctx.beginPath();
    ctx.moveTo(x, 88);
    ctx.lineTo(x, 106);
    ctx.stroke();
  }
}
