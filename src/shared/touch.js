// Controles táctiles para jugar en el celular sin control: un stick que aparece donde pones el dedo
// (lado izquierdo) y los botones A B X Y con LB y RB a la derecha, como en un control de Xbox.
// Cuenta como un control más (ver controls.js), así que funciona en todos los juegos.
// Solo aparece en pantallas táctiles, o con ?tactil en la dirección para probarlo en la compu.
const STICK_RADIUS = 60;
const BUTTON_SIZE = 58;
const BUTTON_GAP = 62;
const FACE_BUTTONS = [
  { id: 'y', label: 'Y', color: '#ffc93c', dx: 0, dy: -1 },
  { id: 'x', label: 'X', color: '#3fa7ff', dx: -1, dy: 0 },
  { id: 'b', label: 'B', color: '#ff5a5f', dx: 1, dy: 0 },
  { id: 'a', label: 'A', color: '#4cd97b', dx: 0, dy: 1 },
];
const BUMPERS = ['lb', 'rb'];

const CSS = `
.touch-pad { position: fixed; inset: 0; z-index: 50; pointer-events: none; transition: opacity 0.3s;
  font-family: "Segoe UI", Arial, sans-serif; -webkit-user-select: none; user-select: none; }
.touch-pad.hidden { opacity: 0; }
.touch-pad.hidden * { pointer-events: none !important; }
.touch-pad.only-bumpers .touch-stick-zone, .touch-pad.only-bumpers .touch-button { display: none; }
.touch-stick-zone { position: absolute; left: 0; top: 0; bottom: 0; width: 45%; pointer-events: auto; touch-action: none; }
.touch-stick-base, .touch-stick-knob { position: absolute; border-radius: 50%; transform: translate(-50%, -50%); display: none; }
.touch-stick-base { width: ${STICK_RADIUS * 2}px; height: ${STICK_RADIUS * 2}px; border: 3px solid rgba(255,255,255,0.5);
  background: rgba(27,21,48,0.25); }
.touch-stick-knob { width: 56px; height: 56px; background: rgba(255,255,255,0.55); }
.touch-stick-hint { position: absolute; left: calc(40px + env(safe-area-inset-left)); bottom: calc(40px + env(safe-area-inset-bottom));
  width: 100px; height: 100px; border-radius: 50%; border: 3px dashed rgba(255,255,255,0.35); }
.touch-button { position: absolute; width: ${BUTTON_SIZE}px; height: ${BUTTON_SIZE}px; margin: -${BUTTON_SIZE / 2}px 0 0 -${BUTTON_SIZE / 2}px;
  border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 28px; font-weight: 800;
  color: #1b1530; opacity: 0.6; pointer-events: auto; touch-action: none; box-shadow: 0 3px 0 rgba(0,0,0,0.35); }
.touch-button.on { opacity: 0.95; transform: scale(0.9); }
.touch-bumper { position: absolute; width: 78px; height: 40px; margin: -20px 0 0 -39px; border-radius: 20px; background: #c9c3ee;
  display: flex; align-items: center; justify-content: center; font-size: 18px; font-weight: 800; color: #1b1530;
  opacity: 0.55; pointer-events: auto; touch-action: none; }
.touch-bumper.on { opacity: 0.95; transform: scale(0.92); }
.touch-rotate { position: fixed; inset: 0; z-index: 60; display: none; flex-direction: column; align-items: center;
  justify-content: center; gap: 16px; background: #14112b; color: #fff; font-size: 26px; text-align: center; pointer-events: auto;
  font-family: "Segoe UI", Arial, sans-serif; font-weight: 700; }
.touch-rotate b { font-size: 64px; }
@media (orientation: portrait) { .touch-rotate { display: flex; } }
`;

export const touchEnabled =
  typeof window !== 'undefined' &&
  (window.matchMedia?.('(pointer: coarse)').matches || new URLSearchParams(window.location.search).has('tactil'));

const state = { x: 0, y: 0, down: new Set(), tapped: new Set(), lastTouchMs: -Infinity };
let root = null;

function el(className, parent, html = '') {
  const node = document.createElement('div');
  node.className = className;
  node.innerHTML = html;
  parent.append(node);
  return node;
}

// El stick aparece donde pones el dedo y se mueve hasta STICK_RADIUS pixeles.
function buildStick() {
  const zone = el('touch-stick-zone', root);
  el('touch-stick-hint', zone);
  const base = el('touch-stick-base', zone);
  const knob = el('touch-stick-knob', zone);
  let active = null;
  const place = (node, x, y) => {
    node.style.left = `${x}px`;
    node.style.top = `${y}px`;
    node.style.display = 'block';
  };
  const release = () => {
    active = null;
    state.x = 0;
    state.y = 0;
    base.style.display = 'none';
    knob.style.display = 'none';
  };
  zone.addEventListener('pointerdown', (event) => {
    if (active) return;
    const box = zone.getBoundingClientRect();
    active = { id: event.pointerId, x: event.clientX - box.left, y: event.clientY - box.top };
    zone.setPointerCapture(event.pointerId);
    place(base, active.x, active.y);
    place(knob, active.x, active.y);
  });
  zone.addEventListener('pointermove', (event) => {
    if (!active || event.pointerId !== active.id) return;
    const box = zone.getBoundingClientRect();
    let dx = event.clientX - box.left - active.x;
    let dy = event.clientY - box.top - active.y;
    const length = Math.hypot(dx, dy);
    if (length > STICK_RADIUS) {
      dx = (dx / length) * STICK_RADIUS;
      dy = (dy / length) * STICK_RADIUS;
    }
    state.x = dx / STICK_RADIUS;
    state.y = dy / STICK_RADIUS;
    place(knob, active.x + dx, active.y + dy);
  });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    zone.addEventListener(type, (event) => {
      if (active && event.pointerId === active.id) release();
    });
  }
}

// Un botón: se considera apretado mientras el dedo esté encima (varios dedos a la vez está bien).
function buildButton(className, id, label, style) {
  const node = el(className, root, label);
  Object.assign(node.style, style);
  const press = (event) => {
    node.setPointerCapture(event.pointerId);
    state.down.add(id);
    state.tapped.add(id);
    node.classList.add('on');
  };
  const release = () => {
    state.down.delete(id);
    node.classList.remove('on');
  };
  node.addEventListener('pointerdown', press);
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) node.addEventListener(type, release);
}

// Al primer toque se pide pantalla completa y horizontal (en Android; el iPhone no lo permite
// en el navegador, ahí sirve "Agregar a pantalla de inicio").
function goFullscreen() {
  const page = document.documentElement;
  if (!document.fullscreenEnabled || document.fullscreenElement || !page.requestFullscreen) return;
  page
    .requestFullscreen({ navigationUI: 'hide' })
    .then(() => window.screen.orientation?.lock?.('landscape'))
    .catch(() => {});
}

function build() {
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.append(style);
  root = el('touch-pad', document.body);
  buildStick();

  // Botones A B X Y en rombo, abajo a la derecha (respetando la muesca del teléfono).
  const right = 'calc(%dpx + env(safe-area-inset-right))';
  const bottom = 'calc(%dpx + env(safe-area-inset-bottom))';
  const centerRight = 30 + BUTTON_GAP;
  const centerBottom = 24 + BUTTON_GAP;
  for (const button of FACE_BUTTONS) {
    buildButton('touch-button', button.id, button.label, {
      right: right.replace('%d', centerRight - button.dx * BUTTON_GAP),
      bottom: bottom.replace('%d', centerBottom - button.dy * BUTTON_GAP),
      background: button.color,
    });
  }
  BUMPERS.forEach((id, i) => {
    buildButton('touch-bumper', id, id.toUpperCase(), {
      right: right.replace('%d', centerRight + (i === 0 ? 1 : -1) * 50),
      bottom: bottom.replace('%d', centerBottom + BUTTON_GAP * 2 + 10),
    });
  });
  el('touch-rotate', document.body, '<b>📱↻</b>Gira tu teléfono para jugar');

  window.addEventListener(
    'pointerdown',
    () => {
      state.lastTouchMs = performance.now();
      goFullscreen();
    },
    { capture: true },
  );
  // Sin menús de "copiar / guardar imagen" al dejar el dedo apretado.
  window.addEventListener('contextmenu', (event) => event.preventDefault());
}

if (touchEnabled) build();

export const touchPad = {
  // Estado del cuadro: stick (-1 a 1) y botones apretados. Un toque muy rápido que ya se soltó
  // también cuenta una vez, igual que con el teclado.
  read() {
    const buttons = {};
    for (const id of ['a', 'b', 'x', 'y', ...BUMPERS]) buttons[id] = state.down.has(id) || state.tapped.has(id);
    state.tapped.clear();
    return { x: state.x, y: state.y, buttons };
  },
  msSinceTouch() {
    return performance.now() - state.lastTouchMs;
  },
  // Con un control conectado (y sin tocar la pantalla un rato) los botones se esconden para no estorbar.
  setHidden(hidden) {
    root?.classList.toggle('hidden', hidden);
  },
  // 'bumpers' deja solo LB y RB (el Modo Bebé usa los toques en toda la pantalla y se sale con LB + RB);
  // 'full' es lo normal.
  setMode(mode) {
    root?.classList.toggle('only-bumpers', mode === 'bumpers');
    if (mode === 'bumpers') {
      state.x = 0;
      state.y = 0;
    }
  },
};
