import * as THREE from 'three';
import { sfx } from '../../shared/sound.js';

// Los objetos de Carreras: cajas de regalo en la pista que dan un poder al pasar por ellas (X = usarlo).
//   turbo: tres turbos extra   aceite: una mancha atrás que hace girar al que la pisa
//   escudo: una burbuja que aguanta un golpe   cohete: va por la pista hasta el carro de adelante y lo hace girar
export const ITEMS = {
  turbo: { emoji: '⚡', name: '¡Triple turbo!', uses: 3 },
  aceite: { emoji: '🛢️', name: '¡Mancha de aceite!', uses: 1 },
  escudo: { emoji: '🛡️', name: '¡Escudo!', uses: 1 },
  cohete: { emoji: '🚀', name: '¡Cohete!', uses: 1 },
};
// Qué tan seguido sale cada uno según el lugar (los de atrás reciben lo mejor para alcanzar).
const ODDS = {
  front: { aceite: 5, escudo: 3, turbo: 2, cohete: 0 },
  middle: { aceite: 3, escudo: 2, turbo: 3, cohete: 2 },
  back: { aceite: 1, escudo: 2, turbo: 4, cohete: 4 },
};
// Filas de cajas: en qué parte de la vuelta (0 a 1) y en qué carriles.
const BOX_ROWS = [0.2, 0.52, 0.8];
const BOX_LANES = [-4.5, -1.5, 1.5, 4.5];
const BOX_RADIUS = 2.4;
const BOX_RESPAWN_MS = 4000;
const SLICK_RADIUS = 2.3;
const SLICK_LIFE_MS = 25000;
const ROCKET_SPEED = 70;
const ROCKET_HIT = 3;
const ROCKET_MAX_MS = 6000;
export const SPIN_MS = 900;
export const SHIELD_MS = 8000;

export class RaceItems {
  constructor(scene, track) {
    this.scene = scene;
    this.track = track;
    this.group = new THREE.Group();
    scene.add(this.group);
    // Qué tanto hay entre una muestra de la pista y la siguiente (para que el cohete avance a su velocidad).
    let length = 0;
    track.points.forEach((p, i) => {
      const next = track.points[(i + 1) % track.count];
      length += Math.hypot(next.x - p.x, next.z - p.z);
    });
    this.spacing = length / track.count;
    this.boxGeometry = new THREE.BoxGeometry(2, 2, 2);
    this.ribbonGeometry = new THREE.BoxGeometry(2.08, 2.08, 0.5);
    this.boxMaterial = new THREE.MeshLambertMaterial({ color: 0x9b5de5 });
    this.ribbonMaterial = new THREE.MeshLambertMaterial({ color: 0xffd84d });
    this.boxes = [];
    for (const at of BOX_ROWS) {
      for (const lane of BOX_LANES) {
        const spot = track.pointAt(Math.round(at * track.count), lane);
        const box = new THREE.Group();
        box.add(new THREE.Mesh(this.boxGeometry, this.boxMaterial));
        box.add(new THREE.Mesh(this.ribbonGeometry, this.ribbonMaterial));
        box.add(new THREE.Mesh(this.ribbonGeometry, this.ribbonMaterial).rotateY(Math.PI / 2));
        box.position.set(spot.x, 1.6, spot.z);
        this.group.add(box);
        this.boxes.push({ mesh: box, x: spot.x, z: spot.z, hiddenMs: 0 });
      }
    }
    this.slicks = [];
    this.rockets = [];
  }

  update(dtMs, karts, ranking, { onPick, onHit }) {
    const t = performance.now() / 1000;
    for (const box of this.boxes) {
      if (box.hiddenMs > 0) {
        box.hiddenMs = Math.max(0, box.hiddenMs - dtMs);
        box.mesh.visible = box.hiddenMs === 0;
        box.mesh.scale.setScalar(1);
        continue;
      }
      box.mesh.rotation.y = t * 1.6;
      box.mesh.position.y = 1.6 + Math.sin(t * 3 + box.x) * 0.3;
      const kart = karts.find((k) => Math.hypot(k.x - box.x, k.z - box.z) < BOX_RADIUS);
      if (!kart) continue;
      box.hiddenMs = BOX_RESPAWN_MS;
      box.mesh.visible = false;
      if (kart.item) continue;
      const place = ranking.indexOf(kart) / Math.max(1, ranking.length - 1);
      kart.item = pick(place < 0.34 ? ODDS.front : place < 0.67 ? ODDS.middle : ODDS.back);
      kart.itemUses = ITEMS[kart.item].uses;
      onPick(kart);
    }

    // Las manchas de aceite: el que pasa encima da una vuelta (menos el que la tiró, un ratito).
    for (const slick of [...this.slicks]) {
      slick.lifeMs -= dtMs;
      const kart = slick.lifeMs > 0 && karts.find((k) => (k !== slick.owner || slick.ageMs > 1500) && Math.hypot(k.x - slick.x, k.z - slick.z) < SLICK_RADIUS);
      slick.ageMs += dtMs;
      if (kart) onHit(kart, 'aceite');
      if (kart || slick.lifeMs <= 0) this.remove(this.slicks, slick);
    }

    // Los cohetes siguen la pista hasta alcanzar a su carro.
    for (const rocket of [...this.rockets]) {
      rocket.lifeMs += dtMs;
      rocket.index += (ROCKET_SPEED * dtMs) / 1000 / this.spacing;
      const target = rocket.target;
      let spot = this.track.pointAt(Math.round(rocket.index), 0);
      if (target) {
        // Ya cerca, se va derecho hacia él.
        const close = Math.hypot(target.x - spot.x, target.z - spot.z) < 14;
        if (close)
          spot = {
            ...spot,
            x: rocket.mesh.position.x + (target.x - rocket.mesh.position.x) * 0.25,
            z: rocket.mesh.position.z + (target.z - rocket.mesh.position.z) * 0.25,
          };
      }
      rocket.mesh.position.set(spot.x, 1.4, spot.z);
      rocket.mesh.rotation.y = spot.heading ?? rocket.mesh.rotation.y;
      if (target && Math.hypot(target.x - spot.x, target.z - spot.z) < ROCKET_HIT) {
        onHit(target, 'cohete');
        this.remove(this.rockets, rocket);
      } else if (rocket.lifeMs > ROCKET_MAX_MS) {
        this.remove(this.rockets, rocket);
      }
    }
  }

  // Usa el poder del carro (una de sus veces). `ahead`: el carro de adelante (para el cohete).
  use(kart, ahead) {
    const item = kart.item;
    if (!item) return false;
    kart.itemUses -= 1;
    if (kart.itemUses <= 0) kart.item = null;
    if (item === 'turbo') {
      kart.boost();
      sfx.boost();
    } else if (item === 'aceite') {
      const spot = this.track.pointAt(kart.index - 3, this.track.lateral(kart.x, kart.z, kart.index));
      this.addSlick(spot.x, spot.z, kart);
      sfx.throw();
    } else if (item === 'escudo') {
      kart.shieldMs = SHIELD_MS;
      sfx.block();
    } else if (item === 'cohete') {
      this.addRocket(kart, ahead);
      sfx.special();
    }
    return true;
  }

  addSlick(x, z, owner) {
    const mesh = new THREE.Mesh(
      new THREE.CircleGeometry(SLICK_RADIUS, 20).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0x1b1530, transparent: true, opacity: 0.85 }),
    );
    mesh.position.set(x, 0.06, z);
    const shine = new THREE.Mesh(new THREE.CircleGeometry(0.7, 12).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x6a5acd }));
    shine.position.set(-0.6, 0.01, -0.5);
    mesh.add(shine);
    this.group.add(mesh);
    this.slicks.push({ mesh, x, z, owner, lifeMs: SLICK_LIFE_MS, ageMs: 0 });
  }

  addRocket(kart, target) {
    const mesh = new THREE.Group();
    mesh.add(new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 2.2, 10).rotateX(Math.PI / 2), new THREE.MeshLambertMaterial({ color: 0xe53935 })));
    mesh.add(
      new THREE.Mesh(new THREE.ConeGeometry(0.45, 0.9, 10).rotateX(Math.PI / 2).translate(0, 0, 1.5), new THREE.MeshLambertMaterial({ color: 0xffffff })),
    );
    mesh.add(new THREE.Mesh(new THREE.ConeGeometry(0.35, 1, 8).rotateX(-Math.PI / 2).translate(0, 0, -1.5), new THREE.MeshBasicMaterial({ color: 0xffb02e })));
    mesh.position.set(kart.x, 1.4, kart.z);
    this.group.add(mesh);
    this.rockets.push({ mesh, index: kart.index + 2, target, lifeMs: 0 });
  }

  remove(list, entry) {
    list.splice(list.indexOf(entry), 1);
    entry.mesh.traverse((object) => {
      object.geometry?.dispose();
      object.material?.dispose();
    });
    this.group.remove(entry.mesh);
  }

  // Al empezar otra carrera: todas las cajas de vuelta y nada en la pista.
  clear() {
    for (const slick of [...this.slicks]) this.remove(this.slicks, slick);
    for (const rocket of [...this.rockets]) this.remove(this.rockets, rocket);
    for (const box of this.boxes) {
      box.hiddenMs = 0;
      box.mesh.visible = true;
    }
  }
}

function pick(odds) {
  const entries = Object.entries(odds).filter(([, weight]) => weight > 0);
  let roll = Math.random() * entries.reduce((sum, [, weight]) => sum + weight, 0);
  for (const [item, weight] of entries) {
    roll -= weight;
    if (roll < 0) return item;
  }
  return entries[0][0];
}
