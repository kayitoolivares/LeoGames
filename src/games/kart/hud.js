// Textos de los karts hechos con HTML encima del 3D: un panel por jugador (su pedazo de pantalla)
// con lugar, vuelta, poder y nitro, más la cuenta regresiva y los resultados.
const STYLE_ID = 'kart-hud-style';
const CSS = `
.kart-hud { position: absolute; inset: 0; pointer-events: none; color: #fff;
  font-family: "Segoe UI", "Trebuchet MS", Arial, sans-serif; text-shadow: 0 3px 0 #1b1530, 0 0 6px #1b1530; }
.kart-panel { position: absolute; box-sizing: border-box; outline: 3px solid #1b1530; }
.kart-panel .pos { position: absolute; top: calc(6px * var(--s)); left: calc(16px * var(--s));
  font-size: calc(64px * var(--s)); font-weight: 800; color: #ffc93c; }
.kart-panel .who { position: absolute; top: calc(82px * var(--s)); left: calc(20px * var(--s));
  font-size: calc(22px * var(--s)); font-weight: 700; }
.kart-panel .lap { position: absolute; top: calc(16px * var(--s)); right: calc(18px * var(--s));
  font-size: calc(28px * var(--s)); font-weight: 700; }
.kart-panel .item { position: absolute; bottom: calc(16px * var(--s)); left: calc(16px * var(--s));
  width: calc(86px * var(--s)); height: calc(86px * var(--s)); border-radius: calc(18px * var(--s));
  background: rgba(27, 21, 48, 0.6); border: calc(4px * var(--s)) solid #fff;
  display: flex; align-items: center; justify-content: center; font-size: calc(54px * var(--s)); }
.kart-panel .item img { width: 82%; height: 82%; object-fit: contain; }
.kart-panel .item.rolling { border-color: #ffc93c; }
.kart-panel .nitro { position: absolute; bottom: calc(20px * var(--s)); right: calc(20px * var(--s));
  font-size: calc(36px * var(--s)); }
.kart-panel .nitro .off { opacity: 0.25; }
.kart-panel .msg { position: absolute; top: 36%; left: 0; right: 0; text-align: center;
  font-size: calc(48px * var(--s)); font-weight: 800; }
.kart-panel .map-title { position: absolute; top: 10px; left: 0; right: 0; text-align: center; font-size: 22px; font-weight: 700; }
.kart-center { position: absolute; top: 40%; left: 0; right: 0; text-align: center; font-size: 150px; font-weight: 800;
  color: #ffc93c; transform: translateY(-50%); }
.kart-results { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center;
  justify-content: center; gap: 10px; background: rgba(20, 17, 43, 0.75); }
.kart-results[hidden] { display: none; }
.kart-results h1 { margin: 0 0 10px; font-size: 64px; color: #ffc93c; }
.kart-results .row { display: flex; align-items: center; gap: 14px; font-size: 30px; font-weight: 700;
  background: rgba(27, 21, 48, 0.6); padding: 6px 28px; border-radius: 14px; min-width: 340px; }
.kart-results .dot { width: 22px; height: 22px; border-radius: 50%; box-shadow: 0 0 0 3px #1b1530; }
.kart-results p { margin-top: 16px; font-size: 22px; }
.kart-help { position: absolute; bottom: 8px; left: 0; right: 0; text-align: center; font-size: 17px;
  transition: opacity 0.6s; }
.kart-help.hidden { opacity: 0; }
.kart-exit { position: absolute; bottom: 0; left: 50%; width: 200px; height: 6px; margin-left: -100px; }
.kart-exit > div { height: 100%; width: 0; background: #fff; border-radius: 3px; }
`;

const MEDALS = ['🥇', '🥈', '🥉'];

export class KartHud {
  // `views`: [{ x, y, w, h, scale, kind: 'player' | 'map' }] en pixeles del escenario de 1280x720.
  constructor(stage, views) {
    if (!document.getElementById(STYLE_ID)) {
      const style = document.createElement('style');
      style.id = STYLE_ID;
      style.textContent = CSS;
      document.head.append(style);
    }
    this.el = document.createElement('div');
    this.el.className = 'kart-hud';
    stage.append(this.el);

    this.panels = views.map((view) => {
      const panel = document.createElement('div');
      panel.className = 'kart-panel';
      Object.assign(panel.style, { left: `${view.x}px`, top: `${view.y}px`, width: `${view.w}px`, height: `${view.h}px` });
      panel.style.setProperty('--s', view.scale);
      panel.innerHTML =
        view.kind === 'map'
          ? '<div class="map-title">Mapa</div>'
          : '<div class="pos"></div><div class="who"></div><div class="lap"></div><div class="item"></div><div class="nitro"></div><div class="msg"></div>';
      this.el.append(panel);
      const part = (name) => panel.querySelector(`.${name}`);
      return { pos: part('pos'), who: part('who'), lap: part('lap'), item: part('item'), nitro: part('nitro'), msg: part('msg'), last: {} };
    });

    this.el.insertAdjacentHTML(
      'beforeend',
      `<div class="kart-center"></div><div class="kart-results" hidden></div>
       <div class="kart-help">A = acelerar  ·  B = frenar  ·  X = lanzar poder  ·  RB = nitro  ·  Mantén LB + RB + Y = salir</div>
       <div class="kart-exit"><div></div></div>`,
    );
    this.center = this.el.querySelector('.kart-center');
    this.results = this.el.querySelector('.kart-results');
    this.help = this.el.querySelector('.kart-help');
    this.exitBar = this.el.querySelector('.kart-exit > div');
    this.lastCenter = null;
  }

  // Solo toca el HTML cuando algo cambió: reescribirlo cada cuadro es caro para el Xbox.
  setPanel(i, data) {
    const panel = this.panels[i];
    for (const [key, value] of Object.entries(data)) {
      if (key === 'rolling' || panel.last[key] === value || !panel[key]) continue;
      panel.last[key] = value;
      panel[key].innerHTML = value;
    }
    panel.item?.classList.toggle('rolling', Boolean(data.rolling));
  }

  setCenter(text) {
    if (this.lastCenter === text) return;
    this.lastCenter = text;
    this.center.textContent = text;
  }

  showHelp(visible) {
    this.help.classList.toggle('hidden', !visible);
  }

  setExitProgress(fraction) {
    const width = `${Math.round(fraction * 100)}%`;
    if (this.exitBar.style.width !== width) this.exitBar.style.width = width;
  }

  // `canChoose`: hay más de una pista abierta, así que B regresa a escogerla.
  showResults(rows, canChoose = false) {
    const list = rows
      .map(
        (row, i) => `<div class="row"><span>${MEDALS[i] ?? `${i + 1}°`}</span>
          <span class="dot" style="background:${row.color}"></span><span>${row.label}</span></div>`,
      )
      .join('');
    const choose = canChoose ? '  ·  B = cambiar pista' : '';
    this.results.innerHTML = `<h1>¡Llegaron!</h1>${list}<p>A = otra carrera${choose}  ·  Mantén LB + RB + Y = salir</p>`;
    this.results.hidden = false;
  }

  hideResults() {
    this.results.hidden = true;
  }

  destroy() {
    this.el.remove();
  }
}
