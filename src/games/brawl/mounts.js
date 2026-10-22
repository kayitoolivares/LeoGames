import { sfx } from '../../shared/sound.js';
import { textStyle } from '../../ui/style.js';
import { burst, popText } from './effects.js';

// Animales para montar: en el segundo tramo de cada mundo hay uno esperando; el primero que lo toca se sube.
// Montado corres más rápido, tu golpe es una mordida (o un picotazo) que pega doble y llega más lejos, y el animal
// aguanta los golpes por ti: cuando ya no aguanta más, se va corriendo.
//   speed: qué tan rápido corre;  hits: cuántos golpes aguanta;  seat: qué tan arriba va el jinete;  size: su alto.
export const MOUNTS = {
  dinosaurio: { name: 'Dinosaurio', art: 'dinosaurio', speed: 1.35, hits: 3, word: '¡Ñam!', color: 0x4cd97b, seat: 62, size: 150 },
  'pollo-gigante': { name: 'Pollo gigante', art: 'pollo-gigante', speed: 1.55, hits: 2, word: '¡Picotazo!', color: 0xffd02a, seat: 66, size: 140 },
};
export const MOUNT_REACH = 45;
const TOUCH = { x: 60, y: 32 };
const LIFE_MS = 25000;

function mountTexture(scene, art) {
  const key = `brawl:objeto-${art}`;
  return scene.textures.exists(key) ? key : null;
}

// Un animal dibujado (la imagen de Gemini, o una bolita con patas si no hay), con las patas en (0, 0).
function drawMount(scene, data) {
  const key = mountTexture(scene, data.art);
  if (key) {
    const image = scene.add.image(0, 8, key).setOrigin(0.5, 1);
    image.setScale(data.size / image.height);
    return image;
  }
  return scene.add.container(0, 0, [
    scene.add.ellipse(0, -50, 130, 80, data.color).setStrokeStyle(4, 0x1b1530),
    scene.add.circle(62, -80, 26, data.color).setStrokeStyle(4, 0x1b1530),
    scene.add.rectangle(-30, -8, 14, 30, data.color).setStrokeStyle(3, 0x1b1530),
    scene.add.rectangle(30, -8, 14, 30, data.color).setStrokeStyle(3, 0x1b1530),
  ]);
}

export class Mounts {
  constructor(scene) {
    this.scene = scene;
    this.list = [];
  }

  // Un animal esperando en (x, y).
  place(kind, x, y) {
    const data = MOUNTS[kind];
    const look = drawMount(this.scene, data);
    const sign = this.scene.add.text(0, -data.size - 20, '¡Súbete!', textStyle(20, '#ffd84d', { fontStyle: 'bold', stroke: '#1b1530', strokeThickness: 5 })).setOrigin(0.5);
    const sprite = this.scene.add.container(x, y, [look, sign]).setDepth(y);
    this.list.push({ kind, data, x, y, rider: null, hits: data.hits, sprite, look, sign, facing: 1, ms: 0 });
  }

  clear() {
    for (const m of this.list) m.sprite.destroy();
    for (const f of this.scene.fighters ?? []) f.mount = null;
    this.list = [];
  }

  update(dtMs, fighters) {
    for (const m of this.list) {
      m.ms += dtMs;
      if (!m.rider) {
        // Esperando: se mece un poquito; el primero que lo toca se sube.
        m.look.setAngle(Math.sin(m.ms / 300) * 3);
        m.sign.setY(-m.data.size - 20 + Math.sin(m.ms / 200) * 5);
        const rider = fighters.find((f) => !f.down && !f.mount && !f.holding && f.z === 0 && Math.abs(f.x - m.x) < TOUCH.x && Math.abs(f.y - m.y) < TOUCH.y);
        if (rider) this.ride(m, rider);
        continue;
      }
      const f = m.rider;
      // (Si el jinete se bajó por otra cosa, por ejemplo al reintentar la ronda, el animal se va.)
      if (f.down || f.mount !== m || m.ms > LIFE_MS) {
        this.runAway(m);
        continue;
      }
      m.x = f.x;
      m.y = f.y;
      m.facing = f.facing;
      // Corriendo, el animal brinca un poquito.
      m.look.setAngle(f.walking ? Math.sin(m.ms / 90) * 4 : 0);
      m.sprite.setPosition(m.x, m.y - (f.z > 0 ? f.z * 0.9 : 0)).setScale(m.facing, 1).setDepth(f.y - 0.5);
    }
    this.list = this.list.filter((m) => !m.gone);
  }

  ride(m, fighter) {
    m.rider = fighter;
    m.ms = 0;
    m.sign.setVisible(false);
    fighter.mount = m;
    burst(this.scene, m.x, m.y - 60, m.data.color, 10);
    popText(this.scene, m.x, m.y - m.data.size - 30, `¡Arriba del ${m.data.name.toLowerCase()}!`, '#ffd84d');
    sfx.pickup();
    this.scene.mounted?.(fighter, m);
  }

  // Le pegaron al jinete: el animal aguanta el golpe. Devuelve true si se fue.
  hit(fighter) {
    const m = fighter.mount;
    if (!m) return false;
    m.hits -= 1;
    this.scene.tweens.add({ targets: m.look, alpha: 0.4, duration: 80, yoyo: true, repeat: 1 });
    if (m.hits > 0) return false;
    this.runAway(m);
    return true;
  }

  // Se baja el jinete y el animal se va corriendo de la pantalla.
  runAway(m) {
    if (m.rider?.mount === m) m.rider.mount = null;
    m.rider = null;
    m.gone = true;
    popText(this.scene, m.x, m.y - m.data.size, '¡Adiós!', '#ffffff');
    const dir = m.facing || 1;
    this.scene.tweens.add({ targets: m.sprite, x: m.x + dir * 900, duration: 1200, onComplete: () => m.sprite.destroy() });
  }
}
