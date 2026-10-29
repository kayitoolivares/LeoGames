import * as THREE from 'three';
import { BODY_HEIGHT } from './arenas.js';
import { WEAPONS } from './weapons.js';
import { cssColor } from './paint.js';

// Un pintor (jugador o compu): dónde está, hacia dónde mira, su tinta y cuánta pintura aguanta. Se ve como su
// personaje de Bolitas Bros (el mismo recorte de Karts locos, que cambia según desde dónde lo veas) con una marquita
// de su equipo arriba. En su propia pantalla no se ve él: se ve su lanzador.
export const RADIUS = 0.6;
export const EYE = { stand: 1.7, swim: 0.65 };
const WALK = 7;
const SWIM = { own: 12.5, other: 4.5 };
const ENEMY_INK = 0.6;
const AIMING = 0.7;
const GRAVITY = 24;
const JUMP = 8.5;
const ACCEL = { ground: 12, air: 3.5 };
// Aguante: normal y en modo peque.
const HP = { normal: 100, peque: 170 };
// Tinta: cuánto se rellena por segundo (sin disparar, nadando en tu tinta) y después de cuánto sin disparar.
const INK_REFILL = { idle: 14, swim: 48, delayMs: 450 };
// La pintura que traes encima se quita sola si nadie te pega un ratito.
const HEAL = { delayMs: 2200, perSecond: 45 };
const BLINK_MS = 110;

export class Painter {
  constructor({ team, teamColor, character, deviceId = null, label, cpu = false, peque = false, drivers }) {
    this.team = team;
    this.teamColor = teamColor;
    this.character = character;
    this.deviceId = deviceId;
    this.label = label;
    this.isCpu = cpu;
    this.peque = peque;
    this.maxHp = peque ? HP.peque : HP.normal;
    this.weaponIndex = 0;
    this.stats = { splats: 0, painted: 0, deaths: 0, robots: 0 };
    this.x = 0;
    this.y = 0;
    this.z = 0;
    this.vx = 0;
    this.vy = 0;
    this.vz = 0;
    this.yaw = 0;
    this.pitch = 0;
    this.eye = EYE.stand;
    this.state = 'alive';
    this.celebrating = false;

    this.object = new THREE.Group();
    this.driver = drivers.createDriver(character, deviceId);
    this.object.add(this.driver.sprite);
    // El charquito cuando va nadando en la tinta.
    this.puddle = new THREE.Mesh(new THREE.CircleGeometry(0.75, 14).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: teamColor }));
    this.puddle.position.y = 0.05;
    this.puddle.visible = false;
    this.object.add(this.puddle);
    this.marker = markerSprite(cpu ? null : label, teamColor);
    this.object.add(this.marker);
    this.reset({ x: 0, z: 0, yaw: 0 });
  }

  get weapon() {
    return WEAPONS[this.weaponIndex];
  }

  // Para driverView (kart/drivers.js): de qué lado se le ve y en qué pose.
  get heading() {
    return this.yaw;
  }

  get spinMs() {
    return this.hitMs;
  }

  get finished() {
    return this.celebrating;
  }

  get trick() {
    return !this.onGround && this.state === 'alive';
  }

  get throwMs() {
    return this.shootPoseMs;
  }

  get alive() {
    return this.state === 'alive';
  }

  // De vuelta en su base, limpiecito y con la tinta llena.
  reset({ x, z, yaw }, { invulnerable = false } = {}) {
    this.x = x;
    this.z = z;
    this.y = 0;
    this.vx = 0;
    this.vy = 0;
    this.vz = 0;
    this.yaw = yaw;
    this.pitch = 0;
    this.onGround = true;
    this.hp = this.maxHp;
    this.ink = 100;
    this.state = 'alive';
    this.respawnMs = 0;
    this.invulnMs = invulnerable ? 2000 : 0;
    this.hitMs = 0;
    this.shootPoseMs = 0;
    this.lastHitMs = 1e9;
    this.lastShotMs = 1e9;
    this.fireMs = 0;
    this.balloonMs = 0;
    this.rollMs = 0;
    this.rollHits = new Map();
    this.swimming = false;
    this.hitBy = null;
    this.celebrating = false;
  }

  // Camina, brinca y nada según `input` = { moveX, moveY, jump, swim, aim, rolling } (el stick: y hacia abajo es +).
  // `floor` dice de quién es la tinta del piso (nadar en la tuya es rapidísimo; en la del otro equipo, lento).
  move(dtMs, input, world, floor) {
    const dt = dtMs / 1000;
    const onFloor = this.onGround && this.y < 0.05;
    const owner = onFloor ? floor.ownerAt(this.x, this.z) : -1;
    this.swimming = Boolean(input.swim) && this.onGround;
    this.swimOwn = owner === this.team;
    let speed = WALK;
    if (this.swimming) speed = owner === this.team ? SWIM.own : SWIM.other;
    else if (owner >= 0 && owner !== this.team) speed *= ENEMY_INK;
    if (input.aim) speed *= AIMING;
    if (input.rolling) speed *= 0.9;

    const fx = Math.sin(this.yaw);
    const fz = Math.cos(this.yaw);
    let mx = fx * -input.moveY - fz * input.moveX;
    let mz = fz * -input.moveY + fx * input.moveX;
    const length = Math.hypot(mx, mz);
    if (length > 1) {
      mx /= length;
      mz /= length;
    }
    const blend = 1 - Math.exp(-(this.onGround ? ACCEL.ground : ACCEL.air) * dt);
    this.vx += (mx * speed - this.vx) * blend;
    this.vz += (mz * speed - this.vz) * blend;

    if (input.jump && this.onGround) {
      this.vy = JUMP;
      this.onGround = false;
    }
    this.vy -= GRAVITY * dt;
    this.x += this.vx * dt;
    this.z += this.vz * dt;
    this.y += this.vy * dt;
    world.pushOut(this, RADIUS);
    const ground = world.groundAt(this.x, this.z, this.y, RADIUS);
    // Pegado al piso al bajar rampas (si iba caminando y el piso está a un escaloncito).
    if (this.y <= ground || (this.onGround && this.vy <= 0 && this.y - ground < 0.6)) {
      this.y = ground;
      this.vy = 0;
      this.onGround = true;
    } else {
      this.onGround = false;
    }
    this.eye += ((this.swimming ? EYE.swim : EYE.stand) - this.eye) * Math.min(1, dt * 12);
  }

  // Tinta, aguante y tiempos de las poses.
  tick(dtMs) {
    this.hitMs = Math.max(0, this.hitMs - dtMs);
    this.shootPoseMs = Math.max(0, this.shootPoseMs - dtMs);
    this.invulnMs = Math.max(0, this.invulnMs - dtMs);
    this.fireMs = Math.max(0, this.fireMs - dtMs);
    this.balloonMs = Math.max(0, this.balloonMs - dtMs);
    this.lastHitMs += dtMs;
    this.lastShotMs += dtMs;
    if (this.lastShotMs > INK_REFILL.delayMs) {
      const rate = this.swimming && this.swimOwn ? INK_REFILL.swim : INK_REFILL.idle;
      this.ink = Math.min(100, this.ink + (rate * dtMs) / 1000);
    }
    if (this.lastHitMs > HEAL.delayMs) this.hp = Math.min(this.maxHp, this.hp + (HEAL.perSecond * dtMs) / 1000);
  }

  // La posición de los ojos (la cámara de este jugador).
  eyePosition(target) {
    return target.set(this.x, this.y + this.eye, this.z);
  }

  // Hacia dónde apunta: vector unitario.
  aimDirection(target) {
    const cp = Math.cos(this.pitch);
    return target.set(Math.sin(this.yaw) * cp, Math.sin(this.pitch), Math.cos(this.yaw) * cp);
  }

  // Acomoda su recorte, su charquito y su marca. `hitColor`: el color de quien lo está pintando.
  render(now, hitColor) {
    const visible = this.state === 'alive';
    const blink = this.invulnMs > 0 && Math.floor(now / BLINK_MS) % 2 === 0;
    this.object.position.set(this.x, this.y, this.z);
    this.driver.sprite.visible = visible && !this.swimming && !blink;
    this.puddle.visible = visible && this.swimming;
    if (this.puddle.visible) this.puddle.scale.setScalar(1 + Math.sin(now / 120) * 0.08);
    this.marker.visible = visible;
    this.marker.position.y = this.swimming ? 1.1 : 2.75;
    // Entre más pintura trae encima, más se pinta su dibujo del color del otro equipo.
    const paint = 1 - this.hp / this.maxHp;
    const color = this.driver.sprite.material.color;
    color.setRGB(1, 1, 1);
    if (paint > 0.02 && hitColor !== null) color.lerp(new THREE.Color(hitColor), Math.min(0.75, paint));
  }

  // El cuerpo (para que le peguen las gotas) y a qué altura se le apunta.
  get height() {
    return this.swimming ? 0.6 : BODY_HEIGHT;
  }

  get radius() {
    return RADIUS;
  }

  get aimHeight() {
    return this.swimming ? 0.3 : 1.1;
  }

  dispose() {
    this.driver.dispose();
    this.puddle.geometry.dispose();
    this.puddle.material.dispose();
    this.marker.material.map?.dispose();
    this.marker.material.dispose();
    this.object.removeFromParent();
  }
}

// La marca de arriba de la cabeza: "J1" en una etiqueta del color del equipo, o un triangulito para la compu.
function markerSprite(label, color) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = cssColor(color);
  ctx.strokeStyle = '#1b1530';
  ctx.lineWidth = 6;
  if (label) {
    ctx.beginPath();
    ctx.roundRect(8, 6, 112, 44, 16);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(52, 50);
    ctx.lineTo(64, 62);
    ctx.lineTo(76, 50);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 34px "Segoe UI", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.strokeText(label, 64, 29);
    ctx.fillText(label, 64, 29);
  } else {
    ctx.beginPath();
    ctx.moveTo(44, 10);
    ctx.lineTo(84, 10);
    ctx.lineTo(64, 46);
    ctx.closePath();
    ctx.stroke();
    ctx.fill();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, depthTest: true, fog: false }));
  sprite.scale.set(1.2, 0.6, 1);
  return sprite;
}

// El lanzador que se ve en tu propia pantalla, abajo a la derecha. Cambia según el que traigas.
// (Se dibuja al último y encima de todo, para que no se meta en las paredes.)
export function blasterModel(weaponKey, teamColor) {
  const group = new THREE.Group();
  const look = { depthTest: false, depthWrite: false, transparent: true };
  const paint = new THREE.MeshLambertMaterial({ color: teamColor, ...look });
  const gray = new THREE.MeshLambertMaterial({ color: 0x5b5875, ...look });
  const white = new THREE.MeshLambertMaterial({ color: 0xf2f0ff, ...look });
  // Abajo a la derecha de la vista, apuntando hacia adelante.
  const held = new THREE.Group();
  held.position.set(0.3, -0.27, -0.75);
  held.scale.setScalar(0.6);
  group.add(held);
  const add = (geometry, material, x, y, z) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    mesh.renderOrder = 999;
    held.add(mesh);
    return mesh;
  };
  if (weaponKey === 'rodillo') {
    add(new THREE.CylinderGeometry(0.025, 0.025, 0.7, 6).rotateX(Math.PI / 2.8), gray, 0, -0.05, -0.15);
    add(new THREE.CylinderGeometry(0.12, 0.12, 0.6, 12).rotateZ(Math.PI / 2), paint, -0.12, -0.24, -0.5);
  } else {
    const long = weaponKey === 'largo';
    add(new THREE.BoxGeometry(0.14, 0.16, long ? 0.7 : 0.45), white, 0, 0, 0);
    add(new THREE.CylinderGeometry(0.03, 0.04, long ? 0.4 : 0.22, 8).rotateX(Math.PI / 2), gray, 0, 0.02, long ? -0.52 : -0.32);
    add(new THREE.SphereGeometry(0.1, 10, 8), paint, 0, 0.13, 0.06);
    add(new THREE.BoxGeometry(0.06, 0.16, 0.08), gray, 0, -0.14, 0.12);
  }
  group.userData.dispose = () => {
    group.traverse((object) => object.geometry?.dispose());
    [paint, gray, white].forEach((material) => material.dispose());
  };
  return group;
}
