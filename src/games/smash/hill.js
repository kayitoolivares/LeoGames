import { textStyle } from '../../ui/style.js';

// Rey de la colina: una zona que brilla sobre una plataforma. El que se queda adentro sin rivales junta un punto por
// segundo (si hay de dos equipos adentro, nadie junta). Cada tanto la zona se cambia de plataforma: parpadea antes.
export const HILL_GOAL = 30;
const MOVE_MS = 15000;
const WARN_MS = 2500;
const WIDTH = 240;
const HEIGHT = 190;
const GOLD = 0xffd84d;
const CONTESTED = 0xff5a5f;

export class Hill {
  constructor(scene, layer, platforms) {
    this.scene = scene;
    this.platforms = platforms;
    this.zone = scene.add.rectangle(0, 0, WIDTH, HEIGHT, GOLD, 0.22).setStrokeStyle(6, GOLD, 0.9);
    this.crown = scene.add.text(0, 0, '👑', textStyle(40)).setOrigin(0.5);
    layer.add([this.zone, this.crown]);
    this.moveMs = MOVE_MS;
    this.moves = 0;
    this.contested = false;
    this.place(platforms.find((p) => p.main) ?? platforms[0]);
  }

  place(platform) {
    this.platform = platform;
    this.width = Math.min(WIDTH, platform.right - platform.left);
    this.zone.setSize(this.width, HEIGHT);
  }

  // Centro de la zona (para que la compu vaya hacia allá).
  get x() {
    return (this.platform.left + this.platform.right) / 2;
  }

  get y() {
    return this.platform.top - HEIGHT / 2;
  }

  contains(f) {
    return f.isAlive() && Math.abs(f.x - this.x) < this.width / 2 && f.y <= this.platform.top + 4 && f.y > this.platform.top - HEIGHT;
  }

  // Suma los segundos del que está solo en la zona. Devuelve true si la zona se acaba de cambiar de lugar.
  update(dtMs, fighters, scoring) {
    let moved = false;
    if (scoring) {
      this.moveMs -= dtMs;
      if (this.moveMs <= 0) {
        // (Las plataformas que se agregan solas un rato, como los bloques de juguete, no cuentan.)
        const others = this.platforms.filter((p) => p !== this.platform && p.sprite);
        this.place(others[Math.floor(Math.random() * others.length)] ?? this.platform);
        this.moveMs = MOVE_MS;
        this.moves += 1;
        moved = true;
      }
    }
    const inside = fighters.filter((f) => this.contains(f));
    const teams = new Set(inside.map((f) => f.team));
    this.contested = teams.size > 1;
    this.owner = teams.size === 1 ? (inside[0].helperOf ?? inside[0]) : null;
    if (scoring && teams.size === 1) {
      for (const f of new Set(inside.map((g) => g.helperOf ?? g))) f.record.hill += dtMs / 1000;
    }
    // Dibujo: dorada vacía, del color del que la tiene, roja si se la pelean; parpadea antes de cambiarse.
    const color = this.contested ? CONTESTED : this.owner ? this.owner.color : GOLD;
    const blink = this.moveMs < WARN_MS && Math.floor(this.moveMs / 160) % 2 === 0;
    const pulse = 0.18 + 0.08 * Math.sin(this.scene.time.now / 200);
    this.zone.setPosition(this.x, this.y).setFillStyle(color, blink ? 0.05 : pulse).setStrokeStyle(6, color, blink ? 0.3 : 0.9);
    this.crown.setPosition(this.x, this.platform.top - HEIGHT - 26 + 6 * Math.sin(this.scene.time.now / 250));
    return moved;
  }
}
