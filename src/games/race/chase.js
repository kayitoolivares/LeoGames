import * as THREE from 'three';
import brawlArt from '../brawl/art.json';

// La persecución de Carreras: el Rey Rex (el jefe de los dinos de Pelea en equipo) corre por la pista detrás de todos,
// cada vez más rápido; al carro que alcanza, lo atrapa y queda fuera. Gana el último que quede.
// Su avance se cuenta en muestras de la pista desde la salida (como el de los carros: vuelta × muestras + muestra).
const HEIGHT = 9;
// Empieza esto detrás del último carro y espera un ratito antes de arrancar.
export const REX_START_BEHIND = 45;
const WAIT_MS = 2500;
// Su velocidad: arranca así, sube tanto por segundo hasta el tope; si se queda muy lejos del último, se apura.
const SPEED = { start: 22, grow: 0.6, max: 42 };
const FAR = 60;
const FAR_FACTOR = 1.35;
// Tan cerca alcanza a un carro; tan cerca abre la boca.
export const REX_CATCH = 2.5;
const BITE = 14;
const STEP_MS = 220;

export class Rex {
  constructor(parent, track) {
    this.track = track;
    this.loader = new THREE.TextureLoader();
    this.textures = new Map();
    this.sprite = new THREE.Sprite(new THREE.SpriteMaterial({ alphaTest: 0.4, color: brawlArt.monstruos?.includes('rey-rex') ? 0xffffff : 0xe53935 }));
    this.sprite.center.set(0.5, 0);
    this.sprite.scale.set(HEIGHT, HEIGHT, 1);
    this.shadow = new THREE.Mesh(
      new THREE.CircleGeometry(3, 20).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.25, depthWrite: false }),
    );
    this.group = new THREE.Group();
    this.group.add(this.sprite, this.shadow);
    this.group.visible = false;
    parent.add(this.group);
    this.shown = null;
  }

  // Empieza en `at` (muestras desde la salida).
  reset(at) {
    this.at = at;
    this.ms = 0;
    this.speed = SPEED.start;
    this.group.visible = true;
    this.place(false);
  }

  hide() {
    this.group.visible = false;
  }

  // Avanza (`lastAt`: dónde va el último carro que queda, para apurarse si se quedó lejos).
  update(dtMs, lastAt) {
    this.ms += dtMs;
    if (this.ms < WAIT_MS) return;
    const seconds = (this.ms - WAIT_MS) / 1000;
    this.speed = Math.min(SPEED.max, SPEED.start + SPEED.grow * seconds);
    const far = (lastAt - this.at) * this.track.spacing > FAR;
    this.at += (this.speed * (far ? FAR_FACTOR : 1) * dtMs) / 1000 / this.track.spacing;
    this.place((lastAt - this.at) * this.track.spacing < BITE);
  }

  get waiting() {
    return this.ms < WAIT_MS;
  }

  // Lo pone en la pista: caminando (dos cuadros) o con la boca abierta, volteado hacia donde va en la pantalla.
  place(biting) {
    const spot = this.track.pointAt(Math.round(this.at), 0);
    this.group.position.set(spot.x, 0, spot.z);
    const step = Math.floor(this.ms / STEP_MS) % 2 === 0;
    const pose = this.waiting ? 'rey-rex-burla' : biting ? 'rey-rex-ataque' : step ? 'rey-rex-paso' : 'rey-rex';
    // (Los dibujos miran a la derecha; si va hacia la izquierda de la pantalla, se voltea.)
    this.show(pose, Math.sin(spot.heading) < 0);
  }

  show(pose, flip) {
    const use = brawlArt.monstruos?.includes(pose) ? pose : 'rey-rex';
    if (!brawlArt.monstruos?.includes(use)) return;
    const key = `${use}${flip ? '-f' : ''}`;
    if (key === this.shown) return;
    this.shown = key;
    let entry = this.textures.get(key);
    if (!entry) {
      if (flip) {
        const base = this.texture(use);
        const texture = base.texture.clone();
        texture.repeat.x = -1;
        texture.offset.x = 1;
        entry = { texture, base };
        base.clones.push(texture);
      } else {
        entry = this.texture(use);
      }
      this.textures.set(key, entry);
    }
    this.sprite.material.map = entry.texture;
    this.sprite.material.needsUpdate = true;
    const aspect = (entry.base ?? entry).aspect;
    this.sprite.scale.set(HEIGHT * aspect, HEIGHT, 1);
  }

  texture(pose) {
    let entry = this.textures.get(pose);
    if (entry) return entry;
    entry = { aspect: 1, clones: [] };
    entry.texture = this.loader.load(`brawl/monstruos/${pose}.png`, (loaded) => {
      entry.aspect = loaded.image.width / loaded.image.height;
      for (const clone of entry.clones) clone.needsUpdate = true;
      if (this.shown?.startsWith(pose)) this.sprite.scale.set(HEIGHT * entry.aspect, HEIGHT, 1);
    });
    entry.texture.colorSpace = THREE.SRGBColorSpace;
    this.textures.set(pose, entry);
    return entry;
  }

  dispose() {
    for (const entry of this.textures.values()) entry.texture.dispose();
    this.textures.clear();
    this.sprite.material.dispose();
    this.shadow.geometry.dispose();
    this.shadow.material.dispose();
  }
}
