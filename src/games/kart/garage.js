import * as THREE from 'three';
import { controls } from '../../shared/controls.js';
import { characterPicks } from '../../shared/picks.js';
import { players } from '../../shared/players.js';
import { sfx } from '../../shared/sound.js';
import { say } from '../../shared/voice.js';
import { hexToCss } from '../../ui/style.js';
import { CHARACTERS, CHARACTER_KEYS } from '../smash/characters.js';
import { HEIGHT, WIDTH } from '../three/stage.js';
import { buildKartModel, disposeKartModel } from '../three/kartModel.js';
import { driverView } from './drivers.js';
import { DECALS, DECAL_KEYS, EXTRAS, EXTRA_KEYS, KART_TYPES, KART_TYPE_KEYS, PAINTS, WHEELS, WHEEL_KEYS, decalTexture, kartPicks } from './karts.js';

// El taller de Karts locos: cada jugador escoge su piloto, su kart, el color, las llantas, un adorno y una calcomanía,
// y lo ve en 3D dando vueltas. ↑ ↓ = qué cambiar, ◀ ▶ = cambiarlo, Y = modo peque, A = ¡listo!, B = ya no estoy listo
// (si no estaba listo, el Jugador 1 regresa al menú). Cuando todos están listos, update() devuelve 'done'.
const STYLE_ID = 'kart-garage-style';
const CARD_W = 290;
const CARD_GAP = 16;
const CARD_TOP = 88;
const CARD_H = 590;
const BORDER = 4;
const TITLE_H = 40;
const PREVIEW_H = 172;
const START_DELAY_MS = 600;
const SPIN_SPEED = 0.9;
const BACKGROUND = 0x14112b;
const PANEL = 0x231d45;
const ROWS = ['character', 'type', 'color', 'wheels', 'extra', 'decal'];
const ROW_LABELS = { character: 'Piloto', type: 'Kart', color: 'Color', wheels: 'Llantas', extra: 'Adorno', decal: 'Calcomanía' };
const CSS = `
.kart-garage { position: absolute; inset: 0; color: #fff; font-family: "Segoe UI", "Trebuchet MS", Arial, sans-serif; }
.kart-garage h1 { position: absolute; top: 14px; left: 0; right: 0; margin: 0; text-align: center; font-size: 48px; }
.kart-garage .card { position: absolute; top: ${CARD_TOP}px; width: ${CARD_W}px; height: ${CARD_H}px; box-sizing: border-box;
  border: ${BORDER}px solid; border-radius: 22px; }
.kart-garage .card.ready { border-color: #4cd97b !important; }
.kart-garage .head { height: ${TITLE_H}px; background: #231d45; border-radius: 18px 18px 0 0; text-align: center;
  font-size: 22px; font-weight: 700; line-height: ${TITLE_H}px; }
.kart-garage .body { position: absolute; left: 0; right: 0; top: ${TITLE_H + PREVIEW_H}px; bottom: 0; background: #231d45;
  border-radius: 0 0 18px 18px; padding-top: 6px; }
.kart-garage .card.ready .head, .kart-garage .card.ready .body { background: #2b3d4a; }
.kart-garage .row { display: flex; justify-content: space-between; align-items: center; height: 36px; margin: 2px 8px;
  padding: 0 12px; border-radius: 10px; font-size: 19px; }
.kart-garage .row .label { color: #a9a3d6; }
.kart-garage .row b { font-size: 20px; }
.kart-garage .row.on { background: #3a3170; box-shadow: 0 0 0 3px #ffc93c; }
.kart-garage .row.on .label { color: #ffc93c; }
.kart-garage .dot { display: inline-block; width: 22px; height: 22px; border-radius: 50%; vertical-align: middle;
  box-shadow: 0 0 0 3px #1b1530, 0 0 0 5px #fff; }
.kart-garage .stats { margin: 8px 22px 0; font-size: 15px; line-height: 20px; display: grid; grid-template-columns: 1fr auto; }
.kart-garage .status { position: absolute; bottom: 10px; left: 0; right: 0; text-align: center; font-size: 22px; font-weight: 700;
  color: #a9a3d6; }
.kart-garage .card.ready .status { color: #4cd97b; }
.kart-garage p { position: absolute; bottom: 4px; left: 0; right: 0; margin: 0; text-align: center; font-size: 20px; color: #ffc93c; }
.kart-garage .exit { position: absolute; bottom: 0; left: 50%; width: 200px; height: 6px; margin-left: -100px; }
.kart-garage .exit > div { height: 100%; width: 0; background: #fff; border-radius: 3px; }
`;

export class Garage {
  // `view`: el lienzo 3D (createStage). `drivers`: DriverArt, para los pilotos.
  constructor(view, drivers) {
    if (!document.getElementById(STYLE_ID)) {
      const style = document.createElement('style');
      style.id = STYLE_ID;
      style.textContent = CSS;
      document.head.append(style);
    }
    this.renderer = view.renderer;
    this.drivers = drivers;
    this.el = document.createElement('div');
    this.el.className = 'kart-garage';
    this.el.innerHTML = `<h1>🔧 Taller</h1>
      <p>↑ ↓ qué cambiar  ·  ◀ ▶ cambiarlo  ·  Y = modo peque 🐣  ·  A = ¡listo!  ·  B = regresar</p><div class="exit"><div></div></div>`;
    view.stage.append(this.el);
    this.exitBar = this.el.querySelector('.exit > div');

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(PANEL);
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x5a5a7a, 1.3));
    const sun = new THREE.DirectionalLight(0xffffff, 1.5);
    sun.position.set(4, 10, 6);
    this.scene.add(sun);
    this.floorGeometry = new THREE.CylinderGeometry(3.4, 3.4, 0.2, 32);
    this.floorMaterial = new THREE.MeshLambertMaterial({ color: 0x3a3170 });

    const humans = players.sorted();
    const startX = (WIDTH - (humans.length * CARD_W + (humans.length - 1) * CARD_GAP)) / 2;
    this.cards = humans.map((player, i) => this.createCard(player, i, startX + i * (CARD_W + CARD_GAP)));
    this.startMs = null;
    say('Escoge tu kart');
  }

  createCard(player, i, left) {
    const playerColor = players.color(player).hex;
    const id = player.deviceId;
    const setup = kartPicks.get(id) ?? {
      character: characterPicks.get(id, CHARACTER_KEYS[player.slot % CHARACTER_KEYS.length]),
      type: 'clasico',
      color: playerColor,
      wheels: 'normales',
      extra: 'aleron',
      decal: 'llamas',
    };
    const el = document.createElement('div');
    el.className = 'card';
    Object.assign(el.style, { left: `${left}px`, borderColor: hexToCss(playerColor) });
    el.innerHTML = `<div class="head" style="color:${hexToCss(playerColor)}">Jugador ${player.slot + 1}</div>
      <div class="body"><div class="rows"></div><div class="stats"></div><div class="status"></div></div>`;
    this.el.append(el);

    // Su pedazo de mundo 3D: lejos de los demás para que cada cámara solo vea su kart.
    const spot = new THREE.Group();
    spot.position.x = i * 40;
    const floor = new THREE.Mesh(this.floorGeometry, this.floorMaterial);
    floor.position.y = -0.1;
    spot.add(floor);
    const turntable = new THREE.Group();
    spot.add(turntable);
    this.scene.add(spot);
    const camera = new THREE.PerspectiveCamera(34, (CARD_W - BORDER * 2) / PREVIEW_H, 0.5, 60);
    camera.position.set(spot.position.x + 6, 3.8, 7.2);
    camera.lookAt(spot.position.x, 1.2, 0);

    const card = {
      player,
      id,
      el,
      rows: el.querySelector('.rows'),
      stats: el.querySelector('.stats'),
      status: el.querySelector('.status'),
      // Colores: primero el del jugador, luego los demás.
      paints: [playerColor, ...PAINTS.filter((color) => color !== playerColor)],
      setup,
      row: 0,
      ready: false,
      turntable,
      camera,
      spotX: spot.position.x,
      rect: { x: left + BORDER, y: CARD_TOP + BORDER + TITLE_H, w: CARD_W - BORDER * 2, h: PREVIEW_H },
      model: null,
      driver: null,
    };
    if (!card.paints.includes(setup.color)) card.paints.push(setup.color);
    this.rebuild(card, true);
    this.refresh(card);
    return card;
  }

  // Las opciones de cada renglón.
  options(card, row) {
    if (row === 'character') return CHARACTER_KEYS;
    if (row === 'type') return KART_TYPE_KEYS;
    if (row === 'color') return card.paints;
    if (row === 'wheels') return WHEEL_KEYS;
    if (row === 'decal') return DECAL_KEYS;
    return EXTRA_KEYS;
  }

  // Vuelve a armar el kart en 3D (y el piloto, si cambió).
  rebuild(card, driverToo = false) {
    const { setup } = card;
    if (card.model) {
      card.turntable.remove(card.model);
      disposeKartModel(card.model);
    }
    const decal = decalTexture(setup.decal, card.player.slot + 1);
    const { group, seat } = buildKartModel(setup.color, { type: setup.type, wheels: setup.wheels, extra: setup.extra, decal, driver: true });
    card.model = group;
    card.turntable.add(group);
    if (driverToo || !card.driver) {
      if (card.driver) {
        card.turntable.remove(card.driver.sprite);
        card.driver.dispose();
      }
      card.driver = this.drivers.createDriver(setup.character);
      card.turntable.add(card.driver.sprite);
    }
    card.driver.sprite.position.copy(seat).setY(seat.y - card.driver.sink);
  }

  // Redibuja los textos de la tarjeta.
  refresh(card) {
    const { setup } = card;
    const values = {
      character: CHARACTERS[setup.character].name,
      type: KART_TYPES[setup.type].name,
      color: `<span class="dot" style="background:${hexToCss(setup.color)}"></span>`,
      wheels: WHEELS[setup.wheels].name,
      extra: EXTRAS[setup.extra].name,
      decal: (DECALS[setup.decal] ?? DECALS.nada).name,
    };
    card.rows.innerHTML = ROWS.map((row, i) => {
      const on = i === card.row && !card.ready;
      const value = on ? `◀ <b>${values[row]}</b> ▶` : `<b>${values[row]}</b>`;
      return `<div class="row${on ? ' on' : ''}"><span class="label">${ROW_LABELS[row]}</span><span>${value}</span></div>`;
    }).join('');
    card.stats.innerHTML = Object.entries(KART_TYPES[setup.type].stats)
      .map(([name, value]) => `<span>${name}</span><span>${'●'.repeat(value)}${'○'.repeat(3 - value)}</span>`)
      .join('');
    // Modo peque: el kart acelera solo y el volante le ayuda (para los más chiquitos).
    card.status.textContent = `${card.setup.peque ? '🐣 Peque · ' : ''}${card.ready ? '¡Listo!' : 'A = listo'}`;
    card.el.classList.toggle('ready', card.ready);
  }

  // Devuelve 'done' cuando todos están listos, 'exit' si el Jugador 1 se regresa al menú, o null.
  update(dtMs) {
    for (const card of this.cards) {
      card.turntable.rotation.y += (SPIN_SPEED * dtMs) / 1000;
      if (this.handle(card) === 'exit') return 'exit';
    }
    this.render();
    if (!this.cards.every((card) => card.ready)) {
      this.startMs = null;
      return null;
    }
    this.startMs ??= performance.now();
    if (performance.now() - this.startMs < START_DELAY_MS) return null;
    for (const card of this.cards) {
      kartPicks.set(card.id, card.setup);
      characterPicks.set(card.id, card.setup.character);
    }
    return 'done';
  }

  handle(card) {
    const id = card.id;
    if (card.ready) {
      if (controls.justPressed(id, 'b')) {
        card.ready = false;
        sfx.back();
        this.refresh(card);
      }
      return null;
    }
    const move = (controls.justPressed(id, 'down') ? 1 : 0) - (controls.justPressed(id, 'up') ? 1 : 0);
    if (move !== 0) {
      card.row = (card.row + move + ROWS.length) % ROWS.length;
      sfx.select();
      this.refresh(card);
    }
    const step = (controls.justPressed(id, 'right') ? 1 : 0) - (controls.justPressed(id, 'left') ? 1 : 0);
    if (step !== 0) {
      const row = ROWS[card.row];
      const list = this.options(card, row);
      const next = list[(list.indexOf(card.setup[row]) + step + list.length) % list.length];
      card.setup = { ...card.setup, [row]: next };
      sfx.select();
      if (row === 'character') say(CHARACTERS[next].name);
      else if (row === 'type') say(KART_TYPES[next].name);
      this.rebuild(card, row === 'character');
      this.refresh(card);
    }
    if (controls.justPressed(id, 'y')) {
      card.setup = { ...card.setup, peque: !card.setup.peque };
      sfx.select();
      say(card.setup.peque ? 'Modo peque: el kart acelera solo' : 'Sin modo peque');
      this.refresh(card);
    }
    if (controls.justPressed(id, 'a')) {
      card.ready = true;
      sfx.confirm();
      this.refresh(card);
    } else if (controls.justPressed(id, 'b') && card.player === players.host()) {
      sfx.back();
      return 'exit';
    }
    return null;
  }

  // Fondo oscuro y, en la ventanita de cada tarjeta, su kart dando vueltas.
  render() {
    const renderer = this.renderer;
    renderer.setScissorTest(false);
    renderer.setViewport(0, 0, WIDTH, HEIGHT);
    renderer.setClearColor(BACKGROUND);
    renderer.clear();
    renderer.setScissorTest(true);
    for (const { rect, camera, turntable, driver, spotX } of this.cards) {
      // El piloto se ve de espaldas, de lado o de frente según cómo va girando el kart.
      driver.show(driverView({ x: spotX, z: 0, heading: turntable.rotation.y }, camera));
      const y = HEIGHT - rect.y - rect.h;
      renderer.setViewport(rect.x, y, rect.w, rect.h);
      renderer.setScissor(rect.x, y, rect.w, rect.h);
      renderer.render(this.scene, camera);
    }
    renderer.setScissorTest(false);
  }

  setExitProgress(fraction) {
    const width = `${Math.round(fraction * 100)}%`;
    if (this.exitBar.style.width !== width) this.exitBar.style.width = width;
  }

  destroy() {
    for (const card of this.cards) {
      disposeKartModel(card.model);
      card.driver.dispose();
    }
    this.floorGeometry.dispose();
    this.floorMaterial.dispose();
    this.el.remove();
  }
}
