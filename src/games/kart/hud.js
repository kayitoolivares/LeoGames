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
.kart-panel .item .count { position: absolute; bottom: 0; right: calc(6px * var(--s)); font-size: calc(24px * var(--s)); }
.kart-panel .ink { position: absolute; inset: 0; opacity: 0; transition: opacity 0.5s; pointer-events: none;
  background: radial-gradient(circle at 30% 40%, #1b1530 0 14%, transparent 15%),
    radial-gradient(circle at 62% 55%, #2a1f4a 0 19%, transparent 20%),
    radial-gradient(circle at 45% 74%, #1b1530 0 11%, transparent 12%),
    radial-gradient(circle at 76% 28%, #1b1530 0 10%, transparent 11%),
    radial-gradient(circle at 18% 72%, #2a1f4a 0 9%, transparent 10%),
    radial-gradient(circle at 52% 30%, #2a1f4a 0 8%, transparent 9%); }
.kart-panel .ink.on { opacity: 0.88; transition: opacity 0.15s; }
.kart-flash { position: absolute; inset: 0; background: #fff; opacity: 0; pointer-events: none; }
.kart-panel .item.rolling { border-color: #ffc93c; }
.kart-panel .nitro { position: absolute; bottom: calc(20px * var(--s)); right: calc(20px * var(--s));
  font-size: calc(36px * var(--s)); }
.kart-panel .nitro .off { opacity: 0.25; }
.kart-panel .coins { position: absolute; bottom: calc(66px * var(--s)); right: calc(22px * var(--s)); font-size: calc(30px * var(--s)); font-weight: 800; }
.kart-panel .minimap { position: absolute; top: calc(58px * var(--s)); right: calc(14px * var(--s)); width: calc(190px * var(--s)); height: calc(130px * var(--s)); }
.kart-panel .msg { position: absolute; top: 36%; left: 0; right: 0; text-align: center;
  font-size: calc(48px * var(--s)); font-weight: 800; }
.kart-panel .map-title { position: absolute; top: 10px; left: 0; right: 0; text-align: center; font-size: 22px; font-weight: 700; }
.kart-center { position: absolute; top: 40%; left: 0; right: 0; text-align: center; font-size: 150px; font-weight: 800;
  color: #ffc93c; transform: translateY(-50%); }
.kart-results { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center;
  justify-content: center; gap: 10px; background: rgba(20, 17, 43, 0.75); }
.kart-results[hidden] { display: none; }
.kart-results h1 { margin: 0 0 10px; font-size: 64px; color: #ffc93c; }
.kart-results .podium { display: flex; align-items: flex-end; gap: 16px; }
.kart-results .place { display: flex; flex-direction: column; align-items: center; width: 220px; }
.kart-results .place img { height: 150px; max-width: 200px; object-fit: contain; filter: drop-shadow(0 4px 0 #1b1530); }
.kart-results .place.p1 img { height: 180px; animation: kart-hop 0.6s ease-in-out infinite alternate; }
@keyframes kart-hop { from { transform: translateY(0); } to { transform: translateY(-16px); } }
.kart-results .place .who { margin: 6px 0; font-size: 22px; font-weight: 700; text-align: center; }
.kart-results .step { width: 100%; display: flex; align-items: flex-start; justify-content: center; padding-top: 6px;
  font-size: 54px; font-weight: 800; color: #1b1530; text-shadow: none; border-radius: 14px 14px 0 0; box-sizing: border-box; }
.kart-results .p1 .step { height: 150px; background: #ffc93c; }
.kart-results .p2 .step { height: 110px; background: #d6dcea; }
.kart-results .p3 .step { height: 80px; background: #e0975a; }
.kart-results .rest { display: flex; gap: 12px; margin-top: 4px; }
.kart-results .row { display: flex; align-items: center; gap: 10px; font-size: 20px; font-weight: 700;
  background: rgba(27, 21, 48, 0.7); padding: 6px 16px; border-radius: 12px; }
.kart-results .dot { width: 18px; height: 18px; border-radius: 50%; box-shadow: 0 0 0 3px #1b1530; }
.kart-results p { margin-top: 12px; font-size: 22px; }
.kart-results .standings { display: flex; flex-direction: column; gap: 6px; min-width: 560px; }
.kart-results .standing { display: flex; align-items: center; gap: 14px; font-size: 22px; font-weight: 700;
  background: rgba(27, 21, 48, 0.75); padding: 2px 18px; border-radius: 12px; }
.kart-results .standing.first { box-shadow: 0 0 0 3px #ffc93c; }
.kart-results .standing img { height: 40px; width: 40px; object-fit: contain; }
.kart-results .standing .who { flex: 1; }
.kart-results .standing .gain { color: #4cd97b; font-size: 20px; }
.kart-results .standing b { min-width: 52px; text-align: right; color: #ffc93c; font-size: 30px; }
.kart-results .trophy { display: flex; align-items: flex-end; gap: 20px; margin-bottom: 6px; }
.kart-results .trophy .cup { height: 130px; filter: drop-shadow(0 4px 0 #1b1530); animation: kart-hop 0.6s ease-in-out infinite alternate; }
.kart-results .trophy .emoji { font-size: 130px; line-height: 1; }
.kart-results .trophy .winner { height: 115px; filter: drop-shadow(0 4px 0 #1b1530); }
.kart-help { position: absolute; bottom: 8px; left: 0; right: 0; text-align: center; font-size: 17px;
  transition: opacity 0.6s; }
.kart-help.hidden { opacity: 0; }
.kart-exit { position: absolute; bottom: 0; left: 50%; width: 200px; height: 6px; margin-left: -100px; }
.kart-exit > div { height: 100%; width: 0; background: #fff; border-radius: 3px; }
`;


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
          : '<div class="ink"></div><canvas class="minimap" width="190" height="130"></canvas><div class="pos"></div><div class="who"></div><div class="lap"></div><div class="item"></div><div class="coins"></div><div class="nitro"></div><div class="msg"></div>';
      this.el.append(panel);
      const part = (name) => panel.querySelector(`.${name}`);
      return {
        pos: part('pos'),
        who: part('who'),
        lap: part('lap'),
        item: part('item'),
        nitro: part('nitro'),
        msg: part('msg'),
        coins: part('coins'),
        inkEl: part('ink'),
        map: part('minimap')?.getContext('2d'),
        last: {},
      };
    });

    this.el.insertAdjacentHTML(
      'beforeend',
      `<div class="kart-flash"></div><div class="kart-center"></div><div class="kart-results" hidden></div>
       <div class="kart-help">A = acelerar  ·  B = frenar  ·  LB = derrapar  ·  X = lanzar poder  ·  RB = nitro  ·  Bloquecito: Y = número  ·  Mantén LB + RB + Y = salir</div>
       <div class="kart-exit"><div></div></div>`,
    );
    this.center = this.el.querySelector('.kart-center');
    this.flashEl = this.el.querySelector('.kart-flash');
    this.results = this.el.querySelector('.kart-results');
    this.help = this.el.querySelector('.kart-help');
    this.exitBar = this.el.querySelector('.kart-exit > div');
    this.lastCenter = null;
  }

  // Solo toca el HTML cuando algo cambió: reescribirlo cada cuadro es caro para el Xbox.
  setPanel(i, data) {
    const panel = this.panels[i];
    for (const [key, value] of Object.entries(data)) {
      if (key === 'rolling' || key === 'ink' || panel.last[key] === value || !panel[key]) continue;
      panel.last[key] = value;
      panel[key].innerHTML = value;
    }
    panel.item?.classList.toggle('rolling', Boolean(data.rolling));
    if (panel.inkEl && panel.last.ink !== data.ink) {
      panel.last.ink = data.ink;
      panel.inkEl.classList.toggle('on', Boolean(data.ink));
    }
  }

  // El mini mapa de la esquina: el trazo de la pista (se le da una vez con setMapOutline) y un punto por kart.
  // `dots`: [{ x, z, color, me }] (el del jugador de ese panel va más grande y con borde).
  setMapOutline(points) {
    const xs = points.map((p) => p.x);
    const zs = points.map((p) => p.z);
    const [minX, maxX, minZ, maxZ] = [Math.min(...xs), Math.max(...xs), Math.min(...zs), Math.max(...zs)];
    const pad = 10;
    const k = Math.min((190 - pad * 2) / (maxX - minX), (130 - pad * 2) / (maxZ - minZ));
    const offX = (190 - (maxX - minX) * k) / 2;
    const offY = (130 - (maxZ - minZ) * k) / 2;
    this.toMap = (x, z) => [(x - minX) * k + offX, (z - minZ) * k + offY];
    this.mapPath = new Path2D();
    points.forEach((p, i) => (i === 0 ? this.mapPath.moveTo(...this.toMap(p.x, p.z)) : this.mapPath.lineTo(...this.toMap(p.x, p.z))));
    this.mapPath.closePath();
  }

  drawMap(i, dots) {
    const ctx = this.panels[i].map;
    if (!ctx || !this.mapPath) return;
    ctx.clearRect(0, 0, 190, 130);
    ctx.lineJoin = 'round';
    ctx.lineWidth = 9;
    ctx.strokeStyle = 'rgba(27, 21, 48, 0.75)';
    ctx.stroke(this.mapPath);
    ctx.lineWidth = 5;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.stroke(this.mapPath);
    for (const dot of [...dots].sort((a, b) => a.me - b.me)) {
      const [x, y] = this.toMap(dot.x, dot.z);
      ctx.beginPath();
      ctx.arc(x, y, dot.me ? 7 : 5, 0, Math.PI * 2);
      ctx.fillStyle = dot.color;
      ctx.fill();
      ctx.lineWidth = dot.me ? 3 : 2;
      ctx.strokeStyle = dot.me ? '#ffffff' : '#1b1530';
      ctx.stroke();
    }
  }

  // Destello blanco en toda la pantalla (el rayo).
  flash() {
    const el = this.flashEl;
    el.style.transition = 'none';
    el.style.opacity = '0.85';
    void el.offsetWidth;
    el.style.transition = 'opacity 0.7s';
    el.style.opacity = '0';
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

  // Podio con los 3 primeros (su personaje arriba de su escalón) y los demás abajo.
  // `rows`: [{ label, color, name, image }] en orden de llegada. `title` y `footer`: lo de arriba y lo de abajo.
  showResults(rows, { title = '¡Llegaron!', footer = 'A = otra carrera  ·  B = cambiar pista  ·  X = taller' } = {}) {
    const who = (row) => `<span style="color:${row.color}">${row.label}</span> · ${row.name}`;
    const place = (row, n) =>
      row
        ? `<div class="place p${n}">${row.image ? `<img src="${row.image}" alt="">` : ''}<div class="who">${who(row)}</div>
            <div class="step">${n}</div></div>`
        : '';
    const podium = [place(rows[1], 2), place(rows[0], 1), place(rows[2], 3)].join('');
    const rest = rows
      .slice(3)
      .map((row, i) => `<div class="row"><span>${i + 4}°</span><span class="dot" style="background:${row.color}"></span>${who(row)}</div>`)
      .join('');
    this.results.innerHTML = `<h1>${title}</h1><div class="podium">${podium}</div><div class="rest">${rest}</div>
      <p>${footer}  ·  Mantén LB + RB + Y = salir</p>`;
    this.results.hidden = false;
  }

  // Gran Premio: la tabla de puntos (`rows` ya ordenados, con total y lo que ganó en esta carrera).
  // `trophy` = { image, emoji, winner } al terminar la copa: el trofeo junto al ganador.
  showStandings({ title, rows, footer, trophy = null }) {
    const list = rows
      .map(
        (row, i) => `<div class="standing${i === 0 ? ' first' : ''}"><span>${i + 1}°</span>
          ${row.image ? `<img src="${row.image}" alt="">` : ''}
          <span class="who"><span style="color:${row.color}">${row.label}</span> · ${row.name}</span>
          <span class="gain">+${row.gained}</span><b>${row.total}</b></div>`,
      )
      .join('');
    const cup = trophy ? (trophy.image ? `<img class="cup" src="${trophy.image}" alt="">` : `<span class="emoji">${trophy.emoji}</span>`) : '';
    const winner = trophy?.winner.image ? `<img class="winner" src="${trophy.winner.image}" alt="">` : '';
    this.results.innerHTML = `${trophy ? `<div class="trophy">${winner}${cup}</div>` : ''}<h1>${title}</h1>
      <div class="standings">${list}</div><p>${footer}  ·  Mantén LB + RB + Y = salir</p>`;
    this.results.hidden = false;
  }

  hideResults() {
    this.results.hidden = true;
  }

  destroy() {
    this.el.remove();
  }
}
