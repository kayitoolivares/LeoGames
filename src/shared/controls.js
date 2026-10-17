// Lectura de controles (gamepads de Xbox + teclado) para todos los juegos de LeoGames.
// No depende de Phaser, así los juegos en Three.js pueden usar exactamente lo mismo.
// Hay que llamar update() una vez por cuadro, antes de leer cualquier control.

// Índices del mapeo "standard" del Gamepad API.
// Vista (8) y Menú (9) no se usan a propósito: en Edge del Xbox no se detectan bien
// o le quitan el foco a la página.
const PAD_BUTTONS = { a: 0, b: 1, x: 2, y: 3, lb: 4, rb: 5, lt: 6, rt: 7 };
const PAD_DPAD = { up: 12, down: 13, left: 14, right: 15 };

// Dos "controles virtuales" en un mismo teclado, para probar sin control.
// Se usa event.code (posición física de la tecla), así no importa si el teclado es latino o inglés.
const KEYBOARDS = {
  kb1: {
    label: 'Teclado 1',
    keys: {
      up: 'KeyW',
      down: 'KeyS',
      left: 'KeyA',
      right: 'KeyD',
      a: 'Space',
      b: 'KeyQ',
      x: 'KeyE',
      y: 'KeyR',
      lb: 'KeyZ',
      rb: 'ShiftLeft',
    },
  },
  kb2: {
    label: 'Teclado 2',
    keys: {
      up: 'ArrowUp',
      down: 'ArrowDown',
      left: 'ArrowLeft',
      right: 'ArrowRight',
      a: 'Enter',
      b: 'ShiftRight',
      x: 'Period',
      y: 'Slash',
      lb: 'Comma',
      rb: 'ControlRight',
    },
  },
};

export const CONTROL_NAMES = ['up', 'down', 'left', 'right', 'a', 'b', 'x', 'y', 'lb', 'rb', 'lt', 'rt'];

// Histéresis del stick: se activa al pasar de 0.5 y se suelta al bajar de 0.3,
// así un solo empujón cuenta como una sola pulsación.
const STICK_ON = 0.5;
const STICK_OFF = 0.3;
const DEADZONE = 0.15;

function emptyState() {
  return Object.fromEntries(CONTROL_NAMES.map((name) => [name, false]));
}

function applyDeadzone(value) {
  return Math.abs(value) < DEADZONE ? 0 : value;
}

export function readGamepads() {
  if (!navigator.getGamepads) return [];
  return [...navigator.getGamepads()].filter((pad) => pad && pad.connected);
}

class Controls {
  constructor() {
    this.keysDown = new Set();
    // Teclas que bajaron desde el último update(): un toque muy rápido puede soltarse antes de leerse.
    this.keysTapped = new Set();
    this.mappedKeys = new Set(Object.values(KEYBOARDS).flatMap((kb) => Object.values(kb.keys)));
    this.devices = new Map();

    for (const [id, kb] of Object.entries(KEYBOARDS)) {
      this.devices.set(id, this.createDevice(id, kb.label, 'keyboard'));
    }

    window.addEventListener('keydown', (event) => {
      if (this.mappedKeys.has(event.code)) event.preventDefault();
      this.keysDown.add(event.code);
      this.keysTapped.add(event.code);
    });
    window.addEventListener('keyup', (event) => this.keysDown.delete(event.code));
    window.addEventListener('blur', () => this.keysDown.clear());
  }

  createDevice(id, label, kind) {
    return {
      id,
      label,
      kind,
      connected: true,
      state: emptyState(),
      prev: emptyState(),
      stick: { x: 0, y: 0 },
      stickDirs: { up: false, down: false, left: false, right: false },
    };
  }

  update() {
    const keyIsDown = (code) => this.keysDown.has(code) || this.keysTapped.has(code);
    for (const [id, kb] of Object.entries(KEYBOARDS)) {
      const device = this.devices.get(id);
      device.prev = device.state;
      device.state = Object.fromEntries(CONTROL_NAMES.map((name) => [name, keyIsDown(kb.keys[name])]));
      device.stick = {
        x: Number(device.state.right) - Number(device.state.left),
        y: Number(device.state.down) - Number(device.state.up),
      };
    }
    this.keysTapped.clear();

    const seen = new Set();
    for (const pad of readGamepads()) {
      const id = `pad${pad.index}`;
      seen.add(id);
      let device = this.devices.get(id);
      if (!device) {
        device = this.createDevice(id, `Control ${pad.index + 1}`, 'gamepad');
        this.devices.set(id, device);
      }
      device.connected = true;
      device.prev = device.state;
      device.state = this.readPad(pad, device);
    }

    for (const device of this.devices.values()) {
      if (device.kind === 'gamepad' && !seen.has(device.id)) {
        device.connected = false;
        device.prev = device.state;
        device.state = emptyState();
        device.stick = { x: 0, y: 0 };
      }
    }
  }

  readPad(pad, device) {
    const pressed = (index) => Boolean(pad.buttons[index]?.pressed);
    const x = applyDeadzone(pad.axes[0] ?? 0);
    const y = applyDeadzone(pad.axes[1] ?? 0);

    const dirs = device.stickDirs;
    dirs.left = dirs.left ? x < -STICK_OFF : x < -STICK_ON;
    dirs.right = dirs.right ? x > STICK_OFF : x > STICK_ON;
    dirs.up = dirs.up ? y < -STICK_OFF : y < -STICK_ON;
    dirs.down = dirs.down ? y > STICK_OFF : y > STICK_ON;

    const state = emptyState();
    for (const [name, index] of Object.entries(PAD_BUTTONS)) state[name] = pressed(index);
    for (const [name, index] of Object.entries(PAD_DPAD)) state[name] = pressed(index) || dirs[name];

    // Si el stick está quieto, la cruceta también cuenta como stick.
    device.stick =
      x === 0 && y === 0
        ? { x: Number(pressed(PAD_DPAD.right)) - Number(pressed(PAD_DPAD.left)), y: Number(pressed(PAD_DPAD.down)) - Number(pressed(PAD_DPAD.up)) }
        : { x, y };

    return state;
  }

  isDown(deviceId, name) {
    return Boolean(this.devices.get(deviceId)?.state[name]);
  }

  justPressed(deviceId, name) {
    const device = this.devices.get(deviceId);
    return Boolean(device && device.state[name] && !device.prev[name]);
  }

  getStick(deviceId) {
    return this.devices.get(deviceId)?.stick ?? { x: 0, y: 0 };
  }

  getDevice(deviceId) {
    return this.devices.get(deviceId);
  }

  connectedDevices() {
    return [...this.devices.values()].filter((device) => device.connected);
  }

  gamepadCount() {
    return readGamepads().length;
  }
}

export const controls = new Controls();
