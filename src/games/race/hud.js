// Textos de la carrera (posiciones, cuenta regresiva, menús, resultados) hechos con HTML encima del 3D:
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
.race-item { font-size: 24px; }
.race-center { position: absolute; top: 40%; left: 0; right: 0; text-align: center; font-size: 140px; font-weight: 800;
  color: #ffc93c; transform: translateY(-50%); }
.race-flash { position: absolute; top: 22%; left: 0; right: 0; text-align: center; font-size: 46px; font-weight: 800;
  opacity: 0; transition: opacity 0.25s; }
.race-flash.on { opacity: 1; }
.race-results, .race-menu { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center;
  justify-content: center; gap: 12px; background: rgba(20, 17, 43, 0.7); }
.race-results[hidden], .race-menu[hidden] { display: none; }
.race-results h1, .race-menu h1 { margin: 0 0 8px; font-size: 52px; color: #ffc93c; }
.race-results .race-row { font-size: 30px; padding: 6px 28px; min-width: 380px; }
.race-results p, .race-menu p { margin-top: 14px; font-size: 22px; opacity: 0.9; }
.race-columns { display: flex; gap: 40px; align-items: flex-start; }
.race-columns h2 { margin: 0 0 8px; font-size: 26px; text-align: center; }
.race-columns > div { display: flex; flex-direction: column; gap: 8px; }
.race-points { margin-left: auto; color: #ffc93c; }
.race-cards { display: flex; flex-wrap: wrap; justify-content: center; gap: 16px; max-width: 1180px; }
.race-card { width: 240px; min-height: 110px; padding: 10px; border-radius: 18px; background: rgba(27, 21, 48, 0.75);
  box-shadow: 0 0 0 4px rgba(255, 255, 255, 0.15); display: flex; flex-direction: column; align-items: center; gap: 4px;
  text-align: center; transition: transform 0.12s; }
.race-card.on { box-shadow: 0 0 0 6px #ffc93c; transform: scale(1.06); background: rgba(60, 40, 110, 0.9); }
.race-card .race-emoji { font-size: 44px; line-height: 1.1; }
.race-card b { font-size: 26px; }
.race-card small { font-size: 17px; opacity: 0.9; }
.race-card svg { margin: -6px 0; }
.race-cars { display: flex; gap: 18px; }
.race-car { width: 270px; padding: 14px; border-radius: 18px; background: rgba(27, 21, 48, 0.8); text-align: center; }
.race-car.ready { box-shadow: 0 0 0 6px #4cd97b; }
.race-car b { display: block; font-size: 30px; margin: 4px 0; }
.race-car .race-arrows { font-size: 26px; }
.race-stat { display: flex; align-items: center; justify-content: space-between; gap: 8px; font-size: 17px; margin: 3px 0; }
.race-stat i { display: inline-block; width: 18px; height: 12px; margin-left: 3px; border-radius: 3px;
  background: rgba(255, 255, 255, 0.2); }
.race-stat i.on { background: #ffc93c; }
.race-help { position: absolute; bottom: 10px; left: 0; right: 0; text-align: center; font-size: 16px; opacity: 0.85; }
.race-exit { width: 200px; height: 6px; margin: 4px auto 0; background: rgba(255, 255, 255, 0.15); border-radius: 3px; }
.race-exit > div { height: 100%; width: 0; background: #fff; border-radius: 3px; }
`;

const MEDALS = ['🥇', '🥈', '🥉'];
const STATS = ['Velocidad', 'Arranque', 'Manejo'];

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
      <div class="race-menu" hidden></div>
      <div class="race-results" hidden></div>
      <div class="race-help">Stick = manejar  ·  A = turbo  ·  B = frenar  ·  X = usar el poder  ·  Mantén LB + RB + Y = salir
        <div class="race-exit"><div></div></div></div>`;
    stage.append(this.el);
    this.standings = this.el.querySelector('.race-standings');
    this.center = this.el.querySelector('.race-center');
    this.flashEl = this.el.querySelector('.race-flash');
    this.menu = this.el.querySelector('.race-menu');
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
          <span class="race-lap">${row.status}</span>${row.turbo ? '<span>⚡</span>' : ''}${row.item ? `<span class="race-item">${row.item}</span>` : ''}</div>`,
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

  // Un menú de tarjetas (modo, pista o copa); `index` es la escogida.
  showMenu(title, cards, index) {
    const list = cards
      .map(
        (card, i) => `<div class="race-card${i === index ? ' on' : ''}">${card.art ?? `<span class="race-emoji">${card.emoji}</span>`}
          <b>${card.art ? `${card.emoji} ` : ''}${card.name}</b>${card.detail ? `<small>${card.detail}</small>` : ''}</div>`,
      )
      .join('');
    this.set('menu', this.menu, `<h1>${title}</h1><div class="race-cards">${list}</div><p>◀ ▶ escoger  ·  A = ¡sí!  ·  B = atrás</p>`);
    this.menu.hidden = false;
    Object.assign(this.menu.style, { justifyContent: '', paddingTop: '', background: '' });
    this.setStandings([]);
  }

  // Cada jugador con su carro: nombre, qué tan rápido, arranque y manejo, y si ya está listo.
  showCars(rows, subtitle) {
    const cards = rows
      .map(({ label, color, car, ready }) => {
        const stats = STATS.map(
          (name, i) =>
            `<div class="race-stat">${name}<span>${[1, 2, 3, 4, 5].map((n) => `<i class="${n <= car.bars[i] ? 'on' : ''}"></i>`).join('')}</span></div>`,
        ).join('');
        return `<div class="race-car${ready ? ' ready' : ''}"><span class="race-dot" style="background:${color};display:inline-block"></span> ${label}
          <b><span class="race-arrows">◀</span> ${car.name} <span class="race-arrows">▶</span></b><small>${car.note}</small>${stats}
          <div>${ready ? '✅ ¡Listo!' : 'A = listo'}</div></div>`;
      })
      .join('');
    this.set(
      'menu',
      this.menu,
      `<h1>🚗 Escojan su carro</h1><p style="margin:-8px 0 8px">${subtitle}</p><div class="race-cars">${cards}</div><p>◀ ▶ otro carro  ·  A = listo  ·  B = atrás</p>`,
    );
    this.menu.hidden = false;
    // Los carros se ven abajo, en la pista: el menú se va hacia arriba.
    this.menu.style.justifyContent = 'flex-start';
    this.menu.style.paddingTop = '30px';
    this.menu.style.background = 'rgba(20, 17, 43, 0.35)';
  }

  hideMenu() {
    this.menu.hidden = true;
    this.last.menu = null;
    Object.assign(this.menu.style, { justifyContent: '', paddingTop: '', background: '' });
  }

  // Resultados de la carrera; en el campeonato, también la tabla de puntos.
  showResults(title, rows, table, hint) {
    const list = rows
      .map(
        (row, i) => `<div class="race-row"><span>${MEDALS[i] ?? `${i + 1}°`}</span>
          <span class="race-dot" style="background:${row.color}"></span><span>${row.label}</span><span class="race-lap">${row.car}</span></div>`,
      )
      .join('');
    const points = table
      ? `<div><h2>Puntos</h2>${table
          .map(
            (row, i) => `<div class="race-row"><span class="race-pos">${i + 1}°</span><span class="race-dot" style="background:${row.color}"></span>
              <span>${row.label}</span><span class="race-points">${row.points}</span></div>`,
          )
          .join('')}</div>`
      : '';
    this.results.innerHTML = `<h1>${title}</h1><div class="race-columns"><div>${table ? '<h2>Esta carrera</h2>' : ''}${list}</div>${points}</div><p>${hint}</p>`;
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
