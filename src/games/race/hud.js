// Textos de la carrera (posiciones, cuenta regresiva, resultados) hechos con HTML encima del 3D:
// es más fácil de acomodar que texto en 3D y el navegador lo dibuja nítido.
const STYLE_ID = 'race-hud-style';
const CSS = `
.race-hud { position: absolute; inset: 0; pointer-events: none; color: #fff;
  font-family: "Segoe UI", "Trebuchet MS", Arial, sans-serif; text-shadow: 0 3px 0 #1b1530, 0 0 6px #1b1530; }
.race-standings { position: absolute; top: 16px; left: 16px; display: flex; flex-direction: column; gap: 6px; }
.race-row { display: flex; align-items: center; gap: 10px; font-size: 22px; font-weight: 700;
  background: rgba(27, 21, 48, 0.55); padding: 4px 14px 4px 8px; border-radius: 12px; }
.race-pos { width: 34px; text-align: right; }
.race-dot { width: 18px; height: 18px; border-radius: 50%; box-shadow: 0 0 0 3px #1b1530; }
.race-lap { font-weight: 400; font-size: 18px; opacity: 0.9; }
.race-center { position: absolute; top: 40%; left: 0; right: 0; text-align: center; font-size: 140px; font-weight: 800;
  color: #ffc93c; transform: translateY(-50%); }
.race-flash { position: absolute; top: 22%; left: 0; right: 0; text-align: center; font-size: 46px; font-weight: 800;
  opacity: 0; transition: opacity 0.25s; }
.race-flash.on { opacity: 1; }
.race-results { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center;
  justify-content: center; gap: 12px; background: rgba(20, 17, 43, 0.7); }
.race-results[hidden] { display: none; }
.race-results h1 { margin: 0 0 12px; font-size: 64px; color: #ffc93c; }
.race-results .race-row { font-size: 32px; padding: 8px 28px; min-width: 360px; }
.race-results p { margin-top: 18px; font-size: 22px; opacity: 0.9; }
.race-help { position: absolute; bottom: 10px; left: 0; right: 0; text-align: center; font-size: 16px; opacity: 0.85; }
.race-exit { width: 200px; height: 6px; margin: 4px auto 0; background: rgba(255, 255, 255, 0.15); border-radius: 3px; }
.race-exit > div { height: 100%; width: 0; background: #fff; border-radius: 3px; }
`;

const MEDALS = ['🥇', '🥈', '🥉'];

export class RaceHud {
  constructor(stage) {
    if (!document.getElementById(STYLE_ID)) {
      const style = document.createElement('style');
      style.id = STYLE_ID;
      style.textContent = CSS;
      document.head.append(style);
    }
    this.el = document.createElement('div');
    this.el.className = 'race-hud';
    this.el.innerHTML = `
      <div class="race-standings"></div>
      <div class="race-center"></div>
      <div class="race-flash"></div>
      <div class="race-results" hidden></div>
      <div class="race-help">Stick = manejar  ·  A = turbo  ·  B = frenar  ·  Mantén LB + RB + Y = salir
        <div class="race-exit"><div></div></div></div>`;
    stage.append(this.el);
    this.standings = this.el.querySelector('.race-standings');
    this.center = this.el.querySelector('.race-center');
    this.flashEl = this.el.querySelector('.race-flash');
    this.results = this.el.querySelector('.race-results');
    this.exitBar = this.el.querySelector('.race-exit > div');
    this.last = {};
  }

  // Solo toca el HTML cuando algo cambió: reescribirlo cada cuadro es caro para el Xbox.
  set(key, element, html) {
    if (this.last[key] === html) return;
    this.last[key] = html;
    element.innerHTML = html;
  }

  setStandings(rows) {
    const html = rows
      .map(
        (row) => `<div class="race-row"><span class="race-pos">${row.position}°</span>
          <span class="race-dot" style="background:${row.color}"></span><span>${row.label}</span>
          <span class="race-lap">${row.status}</span>${row.turbo ? '<span>⚡</span>' : ''}</div>`,
      )
      .join('');
    this.set('standings', this.standings, html);
  }

  setCenter(text) {
    this.set('center', this.center, text);
  }

  flash(text, ms = 1600) {
    this.flashEl.textContent = text;
    this.flashEl.classList.add('on');
    clearTimeout(this.flashTimer);
    this.flashTimer = setTimeout(() => this.flashEl.classList.remove('on'), ms);
  }

  setExitProgress(fraction) {
    const width = `${Math.round(fraction * 100)}%`;
    if (this.exitBar.style.width !== width) this.exitBar.style.width = width;
  }

  showResults(rows) {
    const list = rows
      .map(
        (row, i) => `<div class="race-row"><span>${MEDALS[i] ?? `${i + 1}°`}</span>
          <span class="race-dot" style="background:${row.color}"></span><span>${row.label}</span></div>`,
      )
      .join('');
    this.results.innerHTML = `<h1>¡Llegaron!</h1>${list}<p>A = otra carrera  ·  Mantén LB + RB + Y = salir</p>`;
    this.results.hidden = false;
  }

  hideResults() {
    this.results.hidden = true;
  }

  destroy() {
    clearTimeout(this.flashTimer);
    this.el.remove();
  }
}
