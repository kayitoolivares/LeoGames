// Lo que se ve encima del 3D en la Guerra de pintura (HTML, nítido y fácil de acomodar): la mira, la tinta y el
// lanzador de cada jugador en su pedazo de pantalla, el reloj y el marcador arriba, las opciones antes de jugar y los
// resultados al final.
const STYLE_ID = 'pintura-hud-style';
const CSS = `
.pt-hud { position: absolute; inset: 0; pointer-events: none; color: #fff;
  font-family: "Segoe UI", "Trebuchet MS", Arial, sans-serif; text-shadow: 0 3px 0 #1b1530, 0 0 6px #1b1530; }
.pt-panel { position: absolute; overflow: hidden; box-shadow: inset 0 0 0 2px #1b1530; }
.pt-vignette { position: absolute; inset: 0; opacity: 0; transition: opacity 0.15s; }
.pt-cross { position: absolute; left: 50%; top: 50%; width: calc(34px * var(--s)); height: calc(34px * var(--s));
  transform: translate(-50%, -50%); border-radius: 50%; border: calc(4px * var(--s)) solid #fff;
  box-shadow: 0 0 0 2px #1b1530, inset 0 0 0 2px #1b1530; }
.pt-cross.lock { border-color: #ffc93c; transform: translate(-50%, -50%) scale(0.8); }
.pt-cross::after { content: ''; position: absolute; left: 50%; top: 50%; width: calc(6px * var(--s)); height: calc(6px * var(--s));
  transform: translate(-50%, -50%); border-radius: 50%; background: #fff; }
.pt-who { position: absolute; left: calc(12px * var(--s)); top: calc(10px * var(--s)); display: flex; align-items: center;
  gap: calc(8px * var(--s)); font-size: calc(26px * var(--s)); font-weight: 800; }
.pt-who img { height: calc(48px * var(--s)); filter: drop-shadow(0 3px 0 #1b1530); }
.pt-who .chip { padding: 0 calc(10px * var(--s)); border-radius: calc(12px * var(--s)); box-shadow: 0 0 0 3px #1b1530; }
.pt-ink { position: absolute; left: calc(16px * var(--s)); bottom: calc(16px * var(--s)); width: calc(34px * var(--s));
  height: calc(150px * var(--s)); border-radius: calc(14px * var(--s)); background: rgba(27, 21, 48, 0.6);
  box-shadow: 0 0 0 3px #1b1530; overflow: hidden; }
.pt-ink > div { position: absolute; left: 0; right: 0; bottom: 0; }
.pt-ink.low { animation: pt-blink 0.4s infinite alternate; }
@keyframes pt-blink { to { box-shadow: 0 0 0 5px #ff5a5f; } }
.pt-gear { position: absolute; left: calc(60px * var(--s)); bottom: calc(14px * var(--s)); font-size: calc(22px * var(--s));
  font-weight: 700; line-height: 1.3; }
.pt-gear .emoji, .pt-gear img { font-size: calc(36px * var(--s)); height: calc(42px * var(--s)); vertical-align: middle; }
.pt-gear .balloon { opacity: 0.35; }
.pt-gear .balloon.on { opacity: 1; }
.pt-msg { position: absolute; left: 0; right: 0; top: 28%; text-align: center; font-size: calc(34px * var(--s)); font-weight: 800;
  opacity: 0; transition: opacity 0.2s; }
.pt-msg.on { opacity: 1; }
.pt-dead { position: absolute; inset: 0; display: none; flex-direction: column; align-items: center; justify-content: center;
  background: rgba(27, 21, 48, 0.35); font-size: calc(46px * var(--s)); font-weight: 800; }
.pt-dead.on { display: flex; }
.pt-dead span { font-size: calc(70px * var(--s)); color: #ffc93c; }
.pt-map-title { position: absolute; top: 8px; left: 0; right: 0; text-align: center; font-size: 22px; font-weight: 700; }
.pt-top { position: absolute; top: 8px; left: 50%; transform: translateX(-50%); display: flex; align-items: center; gap: 12px;
  padding: 4px 16px; border-radius: 16px; background: rgba(27, 21, 48, 0.7); font-size: 24px; font-weight: 800; white-space: nowrap; }
.pt-top[hidden] { display: none; }
.pt-top.mid { top: 50%; transform: translate(-50%, -50%); }
.pt-bar { position: relative; width: 220px; height: 18px; border-radius: 9px; background: rgba(255, 255, 255, 0.2); overflow: hidden;
  box-shadow: 0 0 0 3px #1b1530; }
.pt-bar > div { position: absolute; top: 0; bottom: 0; }
.pt-center { position: absolute; top: 40%; left: 0; right: 0; text-align: center; font-size: 130px; font-weight: 800; color: #ffc93c;
  transform: translateY(-50%); }
.pt-flash { position: absolute; top: 16%; left: 0; right: 0; text-align: center; font-size: 46px; font-weight: 800; opacity: 0;
  transition: opacity 0.25s; }
.pt-flash.on { opacity: 1; }
.pt-setup, .pt-results { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 10px; background: rgba(20, 17, 43, 0.72); }
.pt-setup[hidden], .pt-results[hidden] { display: none; }
.pt-setup h1, .pt-results h1 { margin: 0 0 6px; font-size: 50px; color: #ffc93c; }
.pt-opt { display: grid; grid-template-columns: 210px 420px; align-items: center; gap: 6px 16px; padding: 6px 18px; border-radius: 16px;
  background: rgba(27, 21, 48, 0.75); box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.12); font-size: 25px; }
.pt-opt.on { box-shadow: 0 0 0 5px #ffc93c; background: rgba(60, 40, 110, 0.92); }
.pt-opt.dim { opacity: 0.35; }
.pt-opt .label { font-weight: 700; color: #cfc8ff; }
.pt-opt .value { font-weight: 800; }
.pt-opt small { grid-column: 2; font-size: 17px; opacity: 0.85; margin-top: -4px; }
.pt-players { display: flex; gap: 16px; margin-top: 8px; }
.pt-player { display: flex; align-items: center; gap: 8px; padding: 6px 14px; border-radius: 16px; background: rgba(27, 21, 48, 0.8);
  font-size: 24px; font-weight: 800; }
.pt-player img { height: 52px; filter: drop-shadow(0 3px 0 #1b1530); }
.pt-player .team { width: 18px; height: 18px; border-radius: 50%; box-shadow: 0 0 0 3px #1b1530; }
.pt-setup p, .pt-results p { margin: 10px 0 0; font-size: 21px; opacity: 0.9; }
.pt-big { width: 760px; height: 46px; border-radius: 23px; font-size: 26px; }
.pt-big > div { display: flex; align-items: center; justify-content: center; font-weight: 800; transition: width 1.2s ease-out; }
.pt-podium { display: flex; align-items: flex-end; gap: 22px; margin: 6px 0; }
.pt-step { display: flex; flex-direction: column; align-items: center; gap: 2px; font-size: 22px; font-weight: 800; }
.pt-step img { height: 96px; filter: drop-shadow(0 4px 0 #1b1530); }
.pt-step .block { width: 150px; border-radius: 12px 12px 0 0; display: flex; align-items: center; justify-content: center;
  font-size: 34px; box-shadow: 0 0 0 3px #1b1530; }
.pt-step small { font-size: 17px; font-weight: 600; opacity: 0.9; }
.pt-table { display: flex; flex-direction: column; gap: 4px; }
.pt-row { display: flex; gap: 14px; align-items: center; font-size: 21px; padding: 2px 14px; border-radius: 10px;
  background: rgba(27, 21, 48, 0.6); }
.pt-row .team { width: 14px; height: 14px; border-radius: 50%; box-shadow: 0 0 0 2px #1b1530; }
.pt-row b { min-width: 120px; }
.pt-help { position: absolute; bottom: 6px; left: 0; right: 0; text-align: center; font-size: 15px; opacity: 0.85; }
.pt-exit { width: 200px; height: 6px; margin: 3px auto 0; background: rgba(255, 255, 255, 0.15); border-radius: 3px; }
.pt-exit > div { height: 100%; width: 0; background: #fff; border-radius: 3px; }
`;

export class PaintHud {
  constructor(stage) {
    if (!document.getElementById(STYLE_ID)) {
      const style = document.createElement('style');
      style.id = STYLE_ID;
      style.textContent = CSS;
      document.head.append(style);
    }
    this.el = document.createElement('div');
    this.el.className = 'pt-hud';
    this.el.innerHTML = `
      <div class="pt-panels"></div>
      <div class="pt-top" hidden></div>
      <div class="pt-center"></div>
      <div class="pt-flash"></div>
      <div class="pt-setup" hidden></div>
      <div class="pt-results" hidden></div>
      <div class="pt-help">Stick izq. = caminar  ·  Stick der. = mirar  ·  RT = pintar  ·  LT = apuntar  ·  A = brincar  ·  B = nadar en tu tinta  ·  X = globo  ·  LB / RB = lanzador  ·  Mantén LB + RB + Y = salir
        <div class="pt-exit"><div></div></div></div>`;
    stage.append(this.el);
    this.panelsEl = this.el.querySelector('.pt-panels');
    this.top = this.el.querySelector('.pt-top');
    this.center = this.el.querySelector('.pt-center');
    this.flashEl = this.el.querySelector('.pt-flash');
    this.setupEl = this.el.querySelector('.pt-setup');
    this.resultsEl = this.el.querySelector('.pt-results');
    this.exitBar = this.el.querySelector('.pt-exit > div');
    this.help = this.el.querySelector('.pt-help');
    this.helpWanted = true;
    this.panels = [];
    this.last = {};
  }

  // La ayuda de abajo: jugando se esconde (tapa la pantalla de abajo) y solo sale al mantener para salir.
  showHelp(on) {
    this.helpWanted = on;
    this.help.style.visibility = on ? '' : 'hidden';
  }

  // Solo toca el HTML cuando algo cambió: reescribirlo cada cuadro es caro para el Xbox.
  set(key, element, html) {
    if (this.last[key] === html) return;
    this.last[key] = html;
    element.innerHTML = html;
  }

  // Un pedazo de pantalla por jugador (o el mapa). `views`: [{ x, y, w, h, scale, kind }].
  setViews(views) {
    this.panelsEl.innerHTML = '';
    // Con la pantalla partida, el marcador va en medio (donde se juntan los pedazos) para no tapar a nadie.
    this.top.classList.toggle('mid', views.length > 1);
    this.panels = views.map((view) => {
      const panel = document.createElement('div');
      panel.className = 'pt-panel';
      Object.assign(panel.style, { left: `${view.x}px`, top: `${view.y}px`, width: `${view.w}px`, height: `${view.h}px` });
      panel.style.setProperty('--s', view.scale);
      panel.innerHTML =
        view.kind === 'map'
          ? '<div class="pt-map-title">🗺️ El piso</div>'
          : `<div class="pt-vignette"></div><div class="pt-cross"></div><div class="pt-who"></div><div class="pt-ink"><div></div></div>
             <div class="pt-gear"></div><div class="pt-msg"></div><div class="pt-dead"><b>¡Te pintaron!</b><span></span></div>`;
      this.panelsEl.append(panel);
      const part = (name) => panel.querySelector(`.${name}`);
      return {
        kind: view.kind,
        vignette: part('pt-vignette'),
        cross: part('pt-cross'),
        who: part('pt-who'),
        ink: part('pt-ink'),
        inkFill: panel.querySelector('.pt-ink > div'),
        gear: part('pt-gear'),
        msg: part('pt-msg'),
        dead: part('pt-dead'),
        deadCount: panel.querySelector('.pt-dead span'),
        last: {},
      };
    });
  }

  // Lo de un jugador: { label, color, image, peque, ink, inkColor, weapon (emoji o img), weaponName, balloon,
  // paint (0 a 1), paintColor, lock, deadSeconds (null si está vivo) }.
  updatePanel(index, data) {
    const panel = this.panels[index];
    if (!panel || panel.kind !== 'player') return;
    const put = (key, element, html) => {
      if (panel.last[key] === html) return;
      panel.last[key] = html;
      element.innerHTML = html;
    };
    put(
      'who',
      panel.who,
      `${data.image ? `<img src="${data.image}">` : ''}<span class="chip" style="background:${data.color}">${data.label}</span>${data.peque ? '🐣' : ''}`,
    );
    put('gear', panel.gear, `${data.weapon} ${data.weaponName}<br><span class="balloon${data.balloon ? ' on' : ''}">🎈 X</span>`);
    const ink = Math.round(data.ink);
    if (panel.last.ink !== ink) {
      panel.last.ink = ink;
      panel.inkFill.style.height = `${ink}%`;
      panel.ink.classList.toggle('low', ink < 15);
    }
    if (panel.last.inkColor !== data.inkColor) {
      panel.last.inkColor = data.inkColor;
      panel.inkFill.style.background = data.inkColor;
    }
    const paint = Math.round(data.paint * 20) / 20;
    if (panel.last.paint !== paint || panel.last.paintColor !== data.paintColor) {
      panel.last.paint = paint;
      panel.last.paintColor = data.paintColor;
      panel.vignette.style.opacity = String(Math.min(0.9, paint * 1.2));
      panel.vignette.style.boxShadow = `inset 0 0 ${Math.round(140 * paint + 30)}px ${Math.round(40 * paint)}px ${data.paintColor}`;
    }
    if (panel.last.lock !== data.lock) {
      panel.last.lock = data.lock;
      panel.cross.classList.toggle('lock', Boolean(data.lock));
    }
    const dead = data.deadSeconds !== null;
    if (panel.last.dead !== dead) {
      panel.last.dead = dead;
      panel.dead.classList.toggle('on', dead);
      panel.cross.style.display = dead ? 'none' : '';
    }
    if (dead) put('count', panel.deadCount, String(data.deadSeconds));
  }

  // Un aviso solo en la pantalla de un jugador ("¡Pintaste a J2!").
  panelMessage(index, text, ms = 1300) {
    const panel = this.panels[index];
    if (!panel?.msg) return;
    panel.msg.textContent = text;
    panel.msg.classList.add('on');
    clearTimeout(panel.msgTimer);
    panel.msgTimer = setTimeout(() => panel.msg.classList.remove('on'), ms);
  }

  setTop(html) {
    this.top.hidden = !html;
    if (html) this.set('top', this.top, html);
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

  // Las opciones antes de jugar: { title, rows: [{ label, value, detail, on, dim }], players: [{ label, color,
  // teamColor, image, peque }], help }.
  showSetup(model) {
    this.setupEl.hidden = false;
    const rows = model.rows
      .map(
        (row) => `<div class="pt-opt${row.on ? ' on' : ''}${row.dim ? ' dim' : ''}"><span class="label">${row.label}</span>
          <span class="value">${row.on && !row.dim ? '◀ ' : ''}${row.value}${row.on && !row.dim ? ' ▶' : ''}</span>${row.detail ? `<small>${row.detail}</small>` : ''}</div>`,
      )
      .join('');
    const players = model.players
      .map(
        (p) => `<div class="pt-player">${p.image ? `<img src="${p.image}">` : ''}<span style="color:${p.color}">${p.label}</span>
          <span class="team" style="background:${p.teamColor}"></span>${p.peque ? '🐣 Peque' : ''}</div>`,
      )
      .join('');
    this.set('setup', this.setupEl, `<h1>${model.title}</h1>${rows}<div class="pt-players">${players}</div><p>${model.help}</p>`);
  }

  hideSetup() {
    this.setupEl.hidden = true;
    this.last.setup = null;
  }

  // Los resultados: { title, bar: { parts: [{ pct, color, text }] } | null, podium: [{ label, image, color, line }],
  // rows: [{ label, teamColor, text }], help }.
  showResults(model) {
    this.resultsEl.hidden = false;
    const bar = model.bar
      ? `<div class="pt-bar pt-big">${model.bar.parts
          .map((part, i) => `<div style="background:${part.color};${i === 0 ? 'left:0' : 'right:0'};width:0" data-w="${part.pct}">${part.text}</div>`)
          .join('')}</div>`
      : '';
    const heights = [130, 95, 70];
    const order = [1, 0, 2].filter((i) => model.podium[i]);
    const podium = order
      .map((i) => {
        const p = model.podium[i];
        return `<div class="pt-step">${p.image ? `<img src="${p.image}">` : ''}<span style="color:${p.color}">${p.label}</span>
          <small>${p.line}</small><div class="block" style="height:${heights[i]}px;background:${p.teamColor}">${['🥇', '🥈', '🥉'][i]}</div></div>`;
      })
      .join('');
    const rows = model.rows
      .map((row) => `<div class="pt-row"><span class="team" style="background:${row.teamColor}"></span><b>${row.label}</b><span>${row.text}</span></div>`)
      .join('');
    this.resultsEl.innerHTML = `<h1>${model.title}</h1>${bar}<div class="pt-podium">${podium}</div><div class="pt-table">${rows}</div><p>${model.help}</p>`;
    // La barra crece poquito a poquito (como cuando cuentan el piso en Splatoon).
    requestAnimationFrame(() => {
      for (const part of this.resultsEl.querySelectorAll('[data-w]')) part.style.width = `${part.dataset.w}%`;
    });
  }

  hideResults() {
    this.resultsEl.hidden = true;
  }

  setExitProgress(progress) {
    this.exitBar.style.width = `${Math.round(progress * 100)}%`;
    this.help.style.visibility = progress > 0 || this.helpWanted ? '' : 'hidden';
  }

  destroy() {
    clearTimeout(this.flashTimer);
    for (const panel of this.panels) clearTimeout(panel.msgTimer);
    this.el.remove();
  }
}
