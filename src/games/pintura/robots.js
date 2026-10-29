import * as THREE from 'three';
import brawlArt from '../brawl/art.json';
import { ballisticPitch } from './weapons.js';

// "Contra robots": robotitos de práctica (los de Pelea en equipo) que llegan en oleadas y avientan bolitas de pintura.
// Todos los jugadores juntos los pintan hasta que se apagan. En la última oleada llega el Mega Robot.
export const WAVES = [
  [['robotito', 3]],
  [['robotito', 5]],
  [
    ['robotito', 5],
    ['ovni', 2],
  ],
  [
    ['robotito', 7],
    ['ovni', 3],
  ],
  [
    ['mega-robot', 1],
    ['robotito', 5],
  ],
];
const KINDS = {
  robotito: { hp: 60, speed: 3.2, height: 2.2, radius: 0.75, reach: 11, everyMs: 2300, damage: 20, shots: 1, fly: 0 },
  ovni: { hp: 45, speed: 4.2, height: 1.6, radius: 0.8, reach: 13, everyMs: 2000, damage: 16, shots: 1, fly: 2.4 },
  'mega-robot': { hp: 900, speed: 2, height: 4.6, radius: 1.7, reach: 15, everyMs: 1500, damage: 22, shots: 3, fly: 0, boss: true },
};
// Las bolitas de pintura de los robots (lead: qué tanto le adivinan a dónde vas).
const BLOB = { speed: 16, gravity: 18, splat: 1.2, error: 0.05, lead: 0.7 };
const POSE_MS = { ataque: 350, dolor: 220 };

export class Robots {
  constructor(scene) {
    this.scene = scene;
    this.list = [];
    this.loader = new THREE.TextureLoader();
    this.textures = new Map();
    // Ancho / alto de cada dibujo (para que no se vea estirado).
    this.aspects = new Map();
  }

  // Dibujo del robot en esa pose (de Gemini si hay; si no, uno hecho con figuras). `flip` = mirando a la izquierda.
  texture(kind, pose, flip) {
    const key = `${kind}|${pose}|${flip}`;
    let texture = this.textures.get(key);
    if (texture) return texture;
    if (flip) {
      texture = this.texture(kind, pose, false).clone();
      texture.repeat.x = -1;
      texture.offset.x = 1;
      texture.needsUpdate = true;
    } else {
      const names = brawlArt.monstruos ?? [];
      const name = names.includes(`${kind}-${pose}`) ? `${kind}-${pose}` : names.includes(kind) ? kind : null;
      if (name) {
        texture = this.loader.load(`brawl/monstruos/${name}.png`, (loaded) => {
          this.aspects.set(kind, loaded.image.width / loaded.image.height);
          // (La volteada comparte la imagen: hay que avisarle que ya llegó.)
          const twin = this.textures.get(`${kind}|${pose}|true`);
          if (twin) twin.needsUpdate = true;
        });
      } else {
        texture = new THREE.CanvasTexture(drawRobot(kind));
      }
      texture.colorSpace = THREE.SRGBColorSpace;
    }
    this.textures.set(key, texture);
    return texture;
  }

  spawn(kind, x, z, wave) {
    const stats = KINDS[kind];
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.texture(kind, 'paso', false), alphaTest: 0.4 }));
    sprite.center.set(0.5, 0);
    sprite.scale.set(stats.height, stats.height, 1);
    this.scene.add(sprite);
    const hp = stats.hp * (1 + wave * 0.12);
    const robot = {
      kind,
      spec: stats,
      sprite,
      x,
      z,
      y: stats.fly,
      yaw: 0,
      hp,
      maxHp: hp,
      team: 1,
      radius: stats.radius,
      height: stats.height,
      aimHeight: stats.height * 0.55,
      alive: true,
      attackMs: 800 + Math.random() * stats.everyMs,
      poseMs: 0,
      pose: 'paso',
      bob: Math.random() * 10,
      isRobot: true,
    };
    this.list.push(robot);
    return robot;
  }

  // Caminan hacia el pintor más cercano y, ya cerca, le avientan pintura. `throwBlob(robot, from, velocity)`.
  update(dtMs, painters, world, throwBlob) {
    const dt = dtMs / 1000;
    for (const robot of this.list) {
      if (!robot.alive) continue;
      robot.poseMs = Math.max(0, robot.poseMs - dtMs);
      if (robot.poseMs === 0) robot.pose = 'paso';
      robot.bob += dt;
      let target = null;
      let best = Infinity;
      for (const painter of painters) {
        if (!painter.alive || painter.team === robot.team) continue;
        const dist = Math.hypot(painter.x - robot.x, painter.z - robot.z);
        if (dist < best) {
          best = dist;
          target = painter;
        }
      }
      if (!target) continue;
      const dx = target.x - robot.x;
      const dz = target.z - robot.z;
      robot.yaw = Math.atan2(dx, dz);
      if (best > robot.spec.reach * 0.8) {
        const step = robot.spec.speed * dt;
        const body = { x: robot.x + (dx / best) * step, y: 0, z: robot.z + (dz / best) * step };
        world.pushOut(body, robot.radius);
        robot.x = body.x;
        robot.z = body.z;
      }
      robot.y = robot.spec.fly ? robot.spec.fly + Math.sin(robot.bob * 2.5) * 0.3 : 0;
      robot.attackMs -= dtMs;
      if (robot.attackMs <= 0 && best < robot.spec.reach) {
        robot.attackMs = robot.spec.everyMs * (0.8 + Math.random() * 0.4);
        robot.pose = 'ataque';
        robot.poseMs = POSE_MS.ataque;
        const from = { x: robot.x, y: robot.y + robot.height * 0.6, z: robot.z };
        // Le apunta a donde va a estar (si se queda quieto, le atina; si se mueve, se puede escapar).
        const flight = best / BLOB.speed;
        const aimX = target.x + target.vx * flight * BLOB.lead;
        const aimZ = target.z + target.vz * flight * BLOB.lead;
        const dist = Math.hypot(aimX - robot.x, aimZ - robot.z);
        const rise = target.y + 1 - from.y;
        const pitch = ballisticPitch(dist, rise, BLOB.speed, BLOB.gravity) ?? 0.7;
        const aimYaw = Math.atan2(aimX - robot.x, aimZ - robot.z);
        for (let i = 0; i < robot.spec.shots; i += 1) {
          const yaw = aimYaw + (i - (robot.spec.shots - 1) / 2) * 0.22 + (Math.random() * 2 - 1) * BLOB.error;
          const p = pitch + (Math.random() * 2 - 1) * BLOB.error * 0.5;
          const velocity = { x: Math.sin(yaw) * Math.cos(p) * BLOB.speed, y: Math.sin(p) * BLOB.speed, z: Math.cos(yaw) * Math.cos(p) * BLOB.speed };
          throwBlob(robot, from, velocity, { damage: robot.spec.damage, gravity: BLOB.gravity, splat: BLOB.splat });
        }
      }
    }
  }

  // Le pegaron: se pone en dolor un ratito. Devuelve true si ya se apagó.
  hurt(robot, damage) {
    if (!robot.alive) return false;
    robot.hp -= damage;
    robot.pose = 'dolor';
    robot.poseMs = POSE_MS.dolor;
    if (robot.hp > 0) return false;
    robot.alive = false;
    robot.sprite.visible = false;
    return true;
  }

  // Lo voltea según desde dónde lo ve la cámara y le pone la pose (y un tinte de pintura según el daño).
  show(camera, paintColor) {
    for (const robot of this.list) {
      if (!robot.alive) continue;
      const fx = Math.sin(robot.yaw);
      const fz = Math.cos(robot.yaw);
      const tx = camera.position.x - robot.x;
      const tz = camera.position.z - robot.z;
      const flip = fx * tz - fz * tx < 0;
      const material = robot.sprite.material;
      const map = this.texture(robot.kind, robot.pose, flip);
      if (material.map !== map) {
        material.map = map;
        material.needsUpdate = true;
      }
      robot.sprite.position.set(robot.x, robot.y, robot.z);
      robot.sprite.scale.set(robot.height * (this.aspects.get(robot.kind) ?? 1), robot.height, 1);
      material.color.setRGB(1, 1, 1).lerp(new THREE.Color(paintColor), Math.min(0.7, 1 - robot.hp / robot.maxHp));
    }
  }

  get remaining() {
    return this.list.filter((robot) => robot.alive).length;
  }

  clear() {
    for (const robot of this.list) {
      robot.sprite.removeFromParent();
      robot.sprite.material.dispose();
    }
    this.list = [];
  }

  dispose() {
    this.clear();
    for (const texture of this.textures.values()) texture.dispose();
    this.textures.clear();
  }
}

// Un robot dibujado con figuras (si no hay dibujo de Gemini): cuadrado, con antena y ojitos.
function drawRobot(kind) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.lineWidth = 6;
  ctx.strokeStyle = '#1b1530';
  if (kind === 'ovni') {
    ctx.fillStyle = '#9be7ff';
    ctx.beginPath();
    ctx.arc(64, 60, 26, Math.PI, 0);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#b0b6c8';
    ctx.beginPath();
    ctx.ellipse(64, 70, 58, 18, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    return canvas;
  }
  ctx.fillStyle = kind === 'mega-robot' ? '#8c7bd6' : '#b0b6c8';
  ctx.beginPath();
  ctx.roundRect(24, 30, 80, 70, 14);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(64, 30);
  ctx.lineTo(64, 12);
  ctx.stroke();
  ctx.fillStyle = '#ff5c5c';
  ctx.beginPath();
  ctx.arc(64, 10, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fff';
  for (const x of [48, 80]) {
    ctx.beginPath();
    ctx.arc(x, 58, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  ctx.fillStyle = '#1b1530';
  ctx.fillRect(40, 104, 14, 22);
  ctx.fillRect(74, 104, 14, 22);
  return canvas;
}
