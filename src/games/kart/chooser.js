import { sfx } from '../../shared/sound.js';
import { say } from '../../shared/voice.js';

// Pantalla para escoger (HTML encima del 3D): pista, modo de juego o copa. Cuadrícula de 3 por renglón (5 y más
// chiquitas si son muchas, para que quepan en dos renglones); cada
// tarjeta con su emoji, su nombre y, si es pista, el dibujo de su trazo. ◀ ▶ ↑ ↓ escoger, A = ¡a jugar!, B = regresar.
// Las cerradas dicen qué hay que ganar para abrirlas.
const STYLE_ID = 'kart-choose-style';
const COLUMNS = 3;
const MANY = { after: 6, columns: 5 };
// Más de 10 (todas las pistas): 7 por renglón, más chiquitas.
const LOTS = { after: 10, columns: 7 };
const MAP_W = 200;
const MAP_H = 80;
const CSS = `
.kart-choose { position: absolute; inset: 0; background: #14112b; display: flex; flex-direction: column;
  align-items: center; justify-content: center; gap: 26px; color: #fff;
  font-family: "Segoe UI", "Trebuchet MS", Arial, sans-serif; }
.kart-choose h1 { margin: 0; font-size: 52px; }
.kart-choose .cards { display: grid; grid-template-columns: repeat(${COLUMNS}, 340px); gap: 22px; }
.kart-choose .card { height: 212px; border-radius: 22px; background: #231d45; border: 4px solid #3a3170;
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; box-sizing: border-box; }
.kart-choose .card.on { border-color: #ffc93c; box-shadow: 0 0 0 6px #ffc93c; }
.kart-choose .cards.many { grid-template-columns: repeat(${MANY.columns}, 230px); gap: 18px; }
.kart-choose .cards.many .card { height: 196px; padding: 0 8px; }
.kart-choose .cards.many .card .title { flex-direction: column; gap: 2px; }
.kart-choose .cards.many .card .emoji { font-size: 38px; }
.kart-choose .cards.many .card b { font-size: 22px; text-align: center; }
.kart-choose .cards.many .card svg { width: ${MAP_W * 0.9}px; height: ${MAP_H * 0.9}px; }
.kart-choose .cards.many .card small { font-size: 14px; }
.kart-choose .cards.lots { grid-template-columns: repeat(${LOTS.columns}, 166px); gap: 12px; }
.kart-choose .cards.lots .card { height: 178px; padding: 0 6px; }
.kart-choose .cards.lots .card .title { flex-direction: column; gap: 2px; }
.kart-choose .cards.lots .card .emoji { font-size: 32px; }
.kart-choose .cards.lots .card b { font-size: 18px; text-align: center; }
.kart-choose .cards.lots .card svg { width: ${MAP_W * 0.72}px; height: ${MAP_H * 0.72}px; }
.kart-choose .cards.lots .card small { font-size: 12px; }
.kart-choose .cards.lots .card .info { font-size: 14px; }
.kart-choose .card .title { display: flex; align-items: center; gap: 10px; }
.kart-choose .card .emoji { font-size: 46px; line-height: 1; }
.kart-choose .card b { font-size: 27px; }
.kart-choose .card svg { width: ${MAP_W}px; height: ${MAP_H}px; }
.kart-choose .card.locked { opacity: 0.6; }
.kart-choose .card.locked b, .kart-choose .card small { color: #a9a3d6; }
.kart-choose .card small { font-size: 16px; text-align: center; max-width: 300px; min-height: 20px; }
.kart-choose .card .info { font-size: 18px; color: #d9d4ff; text-align: center; max-width: 290px; line-height: 1.3; }
.kart-choose p { margin: 0; font-size: 24px; color: #ffc93c; }
.kart-choose .options { display: flex; gap: 18px; font-size: 21px; }
.kart-choose .options span { background: #231d45; border: 3px solid #3a3170; border-radius: 14px; padding: 6px 18px; }
.kart-choose .options b { color: #ffc93c; }
.kart-choose .exit { position: absolute; bottom: 0; left: 50%; width: 200px; height: 6px; margin-left: -100px; }
.kart-choose .exit > div { height: 100%; width: 0; background: #fff; border-radius: 3px; }
`;

export class TrackChooser {
  // `tracks`: [{ name, emoji, open, lock, outline?: [{ x, z }...] (el trazo), color? (para dibujarlo), info? (texto) }].
  constructor(stage, tracks, selected = 0, title = 'Escoge pista') {
    if (!document.getElementById(STYLE_ID)) {
      const style = document.createElement('style');
      style.id = STYLE_ID;
      style.textContent = CSS;
      document.head.append(style);
    }
    this.tracks = tracks;
    this.el = document.createElement('div');
    this.el.className = 'kart-choose';
    const cards = tracks
      .map(
        (track) => `<div class="card${track.open ? '' : ' locked'}"><div class="title"><span class="emoji">${track.emoji}</span>
          <b>${track.name}</b></div>${outlineSvg(track.outline, track.color)}${track.info ? `<div class="info">${track.info}</div>` : ''}<small>${track.open ? '' : `🔒 ${track.lock}`}</small></div>`,
      )
      .join('');
    this.columns = tracks.length > LOTS.after ? LOTS.columns : tracks.length > MANY.after ? MANY.columns : COLUMNS;
    const size = { [COLUMNS]: '', [MANY.columns]: ' many', [LOTS.columns]: ' lots' }[this.columns];
    this.el.innerHTML = `<h1>${title}</h1><div class="cards${size}">${cards}</div><div class="options"></div>
      <p>◀ ▶ ↑ ↓ escoger  ·  A = ¡a jugar!  ·  B = regresar</p><div class="exit"><div></div></div>`;
    stage.append(this.el);
    this.cards = [...this.el.querySelectorAll('.card')];
    this.exitBar = this.el.querySelector('.exit > div');
    this.optionsEl = this.el.querySelector('.options');
    this.select(selected);
  }

  // Las opciones que se cambian con LB / RB (nivel de la compu, vueltas): [[botón, nombre, valor], ...].
  setOptions(options) {
    this.optionsEl.innerHTML = options.map(([button, name, value]) => `<span>${button}: ${name} <b>${value}</b></span>`).join('');
  }

  select(index) {
    this.selected = index;
    this.cards.forEach((card, i) => card.classList.toggle('on', i === index));
    const track = this.tracks[index];
    say(track.open ? track.name : `${track.name}. Todavía no: ${track.lock}`);
  }

  // ◀ ▶ = de uno en uno; ↑ ↓ = un renglón.
  move(step) {
    sfx.select();
    this.select((this.selected + step + this.tracks.length) % this.tracks.length);
  }

  moveRow(step) {
    const next = this.selected + step * this.columns;
    if (next < 0 || next >= this.tracks.length) return;
    sfx.select();
    this.select(next);
  }

  setExitProgress(fraction) {
    this.exitBar.style.width = `${Math.round(fraction * 100)}%`;
  }

  destroy() {
    this.el.remove();
  }
}

// El trazo de la pista visto desde arriba, como una línea gruesa.
function outlineSvg(points = [], color = '#ffffff') {
  if (points.length === 0) return '';
  const xs = points.map((p) => p.x);
  const zs = points.map((p) => p.z);
  const [minX, maxX, minZ, maxZ] = [Math.min(...xs), Math.max(...xs), Math.min(...zs), Math.max(...zs)];
  const pad = 8;
  const k = Math.min((MAP_W - pad * 2) / (maxX - minX), (MAP_H - pad * 2) / (maxZ - minZ));
  const offX = (MAP_W - (maxX - minX) * k) / 2;
  const offY = (MAP_H - (maxZ - minZ) * k) / 2;
  const path = points.map((p) => `${((p.x - minX) * k + offX).toFixed(1)},${((p.z - minZ) * k + offY).toFixed(1)}`).join(' ');
  return `<svg viewBox="0 0 ${MAP_W} ${MAP_H}"><polygon points="${path}" fill="none" stroke="#1b1530" stroke-width="9" stroke-linejoin="round"/>
    <polygon points="${path}" fill="none" stroke="${color}" stroke-width="5" stroke-linejoin="round"/></svg>`;
}
