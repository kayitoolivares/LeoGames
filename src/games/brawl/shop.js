import { controls } from '../../shared/controls.js';
import { players } from '../../shared/players.js';
import { settings } from '../../shared/settings.js';
import { sfx } from '../../shared/sound.js';
import { say } from '../../shared/voice.js';
import { COLORS, TEXT, textStyle } from '../../ui/style.js';
import { COSTUMES, COSTUME_NAMES } from '../duelo/DueloFighter.js';
import { coinBank } from './coins.js';

// La tienda de Pelea en equipo (X en el mapa): sombreros y colores de traje que se compran con las monedas de la
// familia. Son solo de adorno. Cada jugador mueve su propio cuadrito con su control; A compra (si no es suyo
// todavía) o se lo pone y se lo quita; B regresa al mapa.
const WARDROBE_KEY = 'brawlWardrobe';
const HATS = [
  ['sombrero-vaquero', 'Vaquero', 20],
  ['gorra', 'Gorra', 15],
  ['sombrero-pirata', 'Pirata', 30],
  ['gorro-chef', 'Chef', 25],
  ['casco-vikingo', 'Vikingo', 40],
  ['sombrero-mago', 'Mago', 50],
];
export const WARDROBE = [
  ...HATS.map(([id, name, price]) => ({ id, kind: 'hat', name, price })),
  ...[1, 2, 3, 4, 5, 6].map((costume) => ({ id: `color-${costume}`, kind: 'color', costume, name: `Traje ${COSTUME_NAMES[costume]}`, price: 10 })),
];
const COLS = 6;
const DEPTH = 10003;

export const wardrobe = {
  load() {
    return { owned: [], worn: {}, ...settings.get(WARDROBE_KEY, {}) };
  },
  save(data) {
    settings.set(WARDROBE_KEY, data);
  },
  // Lo que trae puesto un jugador: { hat, costume } (hat = id del sombrero o null; costume = índice de COSTUMES).
  outfit(deviceId) {
    const worn = this.load().worn[deviceId] ?? {};
    return { hat: worn.hat ?? null, costume: worn.costume ?? 0 };
  },
};

export function hatTexture(scene, id) {
  const key = `brawl:objeto-${id}`;
  return scene.textures.exists(key) ? key : null;
}

export class Shop {
  constructor(scene) {
    this.scene = scene;
    this.humans = players.sorted();
    this.cursors = new Map(this.humans.map((p) => [p.deviceId, 0]));
    const { width, height } = scene.scale;
    this.root = scene.add.container(0, 0).setDepth(DEPTH).setScrollFactor(0);
    this.root.add(scene.add.rectangle(width / 2, height / 2, width, height, 0x2a2357));
    this.title = scene.add.text(width / 2, 52, '', textStyle(40, TEXT.normal, { fontStyle: 'bold', stroke: '#1b1530', strokeThickness: 8 })).setOrigin(0.5);
    this.root.add(this.title);
    const cellW = 190;
    const cellH = 190;
    const left = width / 2 - ((COLS - 1) * cellW) / 2;
    this.cells = WARDROBE.map((item, i) => {
      const x = left + (i % COLS) * cellW;
      const y = 210 + Math.floor(i / COLS) * cellH;
      const bg = scene.add.rectangle(x, y, cellW - 16, cellH - 16, COLORS.panel).setRounded(18).setStrokeStyle(3, COLORS.panelBorder);
      const parts = [bg];
      const key = item.kind === 'hat' ? hatTexture(scene, item.id) : null;
      if (key) {
        const image = scene.add.image(x, y - 22, key);
        image.setScale(110 / Math.max(image.width, image.height));
        parts.push(image);
      } else if (item.kind === 'color') {
        parts.push(scene.add.circle(x, y - 22, 46, COSTUMES[item.costume]).setStrokeStyle(5, 0x1b1530));
      } else {
        parts.push(scene.add.text(x, y - 22, '🎩', textStyle(64)).setOrigin(0.5));
      }
      parts.push(scene.add.text(x, y + 44, item.name, textStyle(19, '#ffffff', { fontStyle: 'bold' })).setOrigin(0.5));
      const price = scene.add.text(x, y + 70, '', textStyle(17, '#ffd84d', { fontStyle: 'bold' })).setOrigin(0.5);
      parts.push(price);
      this.root.add(parts);
      return { item, x, y, price, bg };
    });
    // Un cuadrito por jugador (de su color), un poquito corrido para que se vean todos.
    this.marks = this.humans.map((p, k) => {
      const mark = scene.add.rectangle(0, 0, cellW - 6 - k * 8, cellH - 6 - k * 8).setStrokeStyle(5, players.color(p).hex).setFillStyle(0, 0);
      this.root.add(mark);
      return mark;
    });
    this.status = scene.add.text(width / 2, height - 110, '', textStyle(20, '#ffffff', { fontStyle: 'bold', align: 'center', lineSpacing: 6 })).setOrigin(0.5);
    this.root.add(this.status);
    this.root.add(scene.add.text(width / 2, height - 30, '◀ ▶ ▲ ▼ escoger   ·   A = comprar / ponérselo / quitárselo   ·   B = regresar al mapa', textStyle(19, TEXT.accent, { stroke: '#1b1530', strokeThickness: 4 })).setOrigin(0.5));
    this.refresh();
    say('Tienda. Compra sombreros y trajes con tus monedas');
  }

  refresh() {
    const data = wardrobe.load();
    this.title.setText(`🛍️ Tienda   ·   💰 ${coinBank.get()} monedas`);
    for (const cell of this.cells) {
      const owned = data.owned.includes(cell.item.id);
      cell.price.setText(owned ? '✓ Ya es tuyo' : `💰 ${cell.item.price}`).setColor(owned ? '#4cd97b' : '#ffd84d');
    }
    this.humans.forEach((p, k) => {
      const cell = this.cells[this.cursors.get(p.deviceId)];
      this.marks[k].setPosition(cell.x, cell.y);
    });
    const lines = this.humans.map((p) => {
      const outfit = wardrobe.outfit(p.deviceId);
      const hat = WARDROBE.find((item) => item.id === outfit.hat)?.name ?? 'sin sombrero';
      const color = outfit.costume ? `traje ${COSTUME_NAMES[outfit.costume]}` : 'su color de siempre';
      return `J${p.slot + 1}: ${hat} · ${color}`;
    });
    this.status.setText(lines.join('      ')).setColor(TEXT.normal);
  }

  // Devuelve true cuando hay que cerrar la tienda (B).
  update() {
    let changed = false;
    for (const p of this.humans) {
      const id = p.deviceId;
      if (controls.justPressed(id, 'b')) return true;
      const dx = (controls.justPressed(id, 'right') ? 1 : 0) - (controls.justPressed(id, 'left') ? 1 : 0);
      const dy = (controls.justPressed(id, 'down') ? 1 : 0) - (controls.justPressed(id, 'up') ? 1 : 0);
      if (dx || dy) {
        const index = this.cursors.get(id);
        const col = (index % COLS) + dx;
        const row = Math.floor(index / COLS) + dy;
        const rows = Math.ceil(WARDROBE.length / COLS);
        this.cursors.set(id, ((row + rows) % rows) * COLS + ((col + COLS) % COLS));
        sfx.select();
        changed = true;
      }
      if (controls.justPressed(id, 'a')) {
        this.choose(p, WARDROBE[this.cursors.get(id)]);
        changed = true;
      }
    }
    if (changed) this.refresh();
    return false;
  }

  // A sobre una cosa: si no es de la familia todavía, se compra (si alcanzan las monedas); si ya es, se la pone o se la
  // quita el que apretó.
  choose(player, item) {
    const data = wardrobe.load();
    if (!data.owned.includes(item.id)) {
      if (!coinBank.spend(item.price)) {
        sfx.back();
        say('No alcanzan las monedas');
        return;
      }
      data.owned.push(item.id);
      sfx.coin();
      say(`¡Compraste ${item.name}!`);
    }
    const worn = { ...(data.worn[player.deviceId] ?? {}) };
    if (item.kind === 'hat') worn.hat = worn.hat === item.id ? null : item.id;
    else worn.costume = worn.costume === item.costume ? 0 : item.costume;
    data.worn[player.deviceId] = worn;
    wardrobe.save(data);
    sfx.confirm();
  }

  destroy() {
    this.root.destroy();
  }
}

// Le pone a un peleador lo que trae puesto: el sombrero arriba de la cabeza y el color del traje (y le quita lo que
// traía antes).
export function dressFighter(scene, fighter, outfit) {
  fighter.hat?.destroy();
  fighter.hat = null;
  fighter.look.setCostume?.(outfit?.costume ? COSTUMES[outfit.costume] : null);
  const key = outfit?.hat ? hatTexture(scene, outfit.hat) : null;
  if (!key) return;
  const hat = scene.add.image(0, 0, key).setOrigin(0.5, 0.75);
  hat.setScale((fighter.radius * 1.9) / Math.max(hat.width, hat.height));
  fighter.hat = hat;
  fighter.sprite.figure.add(hat);
}
