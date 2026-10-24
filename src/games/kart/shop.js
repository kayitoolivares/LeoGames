import { controls } from '../../shared/controls.js';
import { sfx } from '../../shared/sound.js';
import { say } from '../../shared/voice.js';
import { hexToCss } from '../../ui/style.js';
import { buy, owns, shopItems, wallet } from './karts.js';

// La tienda del taller: se abre con X y la maneja el jugador que la abrió. Las monedas son de toda la familia.
// ◀ ▶ ↑ ↓ escoger, A = comprar, B = cerrar. Lo que se compra aparece luego en el taller para todos.
const STYLE_ID = 'kart-shop-style';
const COLUMNS = 6;
const KIND_NAMES = { type: 'Kart', color: 'Color', wheels: 'Llantas', extra: 'Adorno', decal: 'Calcomanía', upgrade: 'Mejora' };
const CSS = `
.kart-shop { position: absolute; inset: 0; background: rgba(20, 17, 43, 0.92); display: flex; flex-direction: column;
  align-items: center; justify-content: center; gap: 18px; z-index: 5; }
.kart-shop h2 { margin: 0; font-size: 44px; }
.kart-shop h2 span { color: #ffc93c; }
.kart-shop .grid { display: grid; grid-template-columns: repeat(${COLUMNS}, 194px); gap: 12px; }
.kart-shop .item { height: 128px; border-radius: 18px; background: #231d45; border: 4px solid #3a3170; display: flex;
  flex-direction: column; align-items: center; justify-content: center; gap: 4px; box-sizing: border-box; }
.kart-shop .item.on { border-color: #ffc93c; box-shadow: 0 0 0 5px #ffc93c; }
.kart-shop .item.mine { background: #2b3d4a; }
.kart-shop .item .look { font-size: 44px; height: 50px; display: flex; align-items: center; }
.kart-shop .item .look img { height: 46px; max-width: 170px; object-fit: contain; }
.kart-shop .item .dot { width: 40px; height: 40px; border-radius: 50%; box-shadow: 0 0 0 3px #1b1530, 0 0 0 5px #fff; }
.kart-shop .item b { font-size: 18px; }
.kart-shop .item small { font-size: 16px; color: #a9a3d6; }
.kart-shop .item .price { color: #ffc93c; font-weight: 700; font-size: 18px; }
.kart-shop .item.mine .price { color: #4cd97b; }
.kart-shop p { margin: 0; font-size: 21px; color: #ffc93c; }
`;

export class ShopPanel {
  constructor(parent, deviceId) {
    if (!document.getElementById(STYLE_ID)) {
      const style = document.createElement('style');
      style.id = STYLE_ID;
      style.textContent = CSS;
      document.head.append(style);
    }
    this.deviceId = deviceId;
    this.items = shopItems();
    this.selected = 0;
    this.el = document.createElement('div');
    this.el.className = 'kart-shop';
    parent.append(this.el);
    this.draw();
    say(`Tienda. Tienes ${wallet.get()} monedas`);
  }

  draw() {
    const tiles = this.items
      .map((item, i) => {
        const mine = owns(item.kind, item.key);
        let look = `<span>${item.emoji ?? '⭐'}</span>`;
        if (item.kind === 'color') look = `<span class="dot" style="background:${hexToCss(item.key)}"></span>`;
        else if (item.kind === 'decal') look = `<img src="kart/calcomanias/${item.key}.png" alt="">`;
        return `<div class="item${i === this.selected ? ' on' : ''}${mine ? ' mine' : ''}"><div class="look">${look}</div>
          <b>${item.name}</b><small>${item.info ?? KIND_NAMES[item.kind]}</small>
          <span class="price">${mine ? (item.kind === 'upgrade' ? '✓ Al máximo' : '✓ Ya es tuyo') : `🪙 ${item.price}`}</span></div>`;
      })
      .join('');
    this.el.innerHTML = `<h2>🛒 Tienda · <span>🪙 ${wallet.get()}</span></h2><div class="grid">${tiles}</div>
      <p>◀ ▶ ↑ ↓ escoger  ·  A = comprar  ·  B = cerrar  ·  Las monedas se ganan en las carreras</p>`;
  }

  // Devuelve true cuando se cierra.
  update() {
    const id = this.deviceId;
    const step = (controls.justPressed(id, 'right') ? 1 : 0) - (controls.justPressed(id, 'left') ? 1 : 0);
    const row = (controls.justPressed(id, 'down') ? COLUMNS : 0) - (controls.justPressed(id, 'up') ? COLUMNS : 0);
    if (step || row) {
      const next = this.selected + step + row;
      if (next >= 0 && next < this.items.length) {
        this.selected = next;
        sfx.select();
        const item = this.items[next];
        say(owns(item.kind, item.key) ? `${item.name}, ya es tuyo` : `${item.name}, ${item.price} monedas`);
        this.draw();
      }
    }
    if (controls.justPressed(id, 'a')) {
      const item = this.items[this.selected];
      if (owns(item.kind, item.key)) {
        sfx.select();
      } else if (buy(item)) {
        sfx.coin();
        sfx.confirm();
        say(`¡Compraste ${item.kind === 'upgrade' ? `${item.name.replace(/[●○ ]+$/, '')} nivel ${item.name.split('●').length}` : item.name}!`);
        // (Las mejoras suben de nivel: su precio cambia.)
        this.items = shopItems();
        this.draw();
      } else {
        sfx.back();
        say(`Te faltan ${item.price - wallet.get()} monedas`);
      }
    }
    if (controls.justPressed(id, 'b')) {
      sfx.back();
      return true;
    }
    return false;
  }

  destroy() {
    this.el.remove();
  }
}
