import Phaser from 'phaser';

// Escenarios de Bolitas Bros (coordenadas del mundo, que es más grande que la pantalla).
// Plataformas: `soft` se atraviesan desde abajo y se bajan con ↓; `main` es la principal;
// `move` = { x, y (cuánto se mueven), periodMs, phase } para las que van y vienen;
// `look` = cómo se dibujan ('island', 'plank', 'cloud', 'deck', 'barrel').
export const STAGES = {
  castillo: {
    name: 'Castillo',
    sky: 0x7ec8f0,
    platforms: [
      { left: 380, right: 1620, top: 800, main: true, look: 'island' },
      { left: 560, right: 860, top: 620, soft: true, look: 'plank' },
      { left: 1140, right: 1440, top: 620, soft: true, look: 'plank' },
      { left: 850, right: 1150, top: 450, soft: true, look: 'plank' },
    ],
    blast: { left: -250, right: 2250, top: -450, bottom: 1400 },
    respawn: { x: 1000, y: 260 },
    spawns: [600, 1400, 850, 1150],
    drawBackground: drawCastle,
  },
  nubes: {
    name: 'Nubes',
    sky: 0x9fd8ff,
    platforms: [
      { left: 520, right: 1480, top: 820, main: true, look: 'cloud' },
      { left: 230, right: 470, top: 650, soft: true, look: 'cloud', move: { y: 90, periodMs: 4000, phase: 0 } },
      { left: 1530, right: 1770, top: 650, soft: true, look: 'cloud', move: { y: 90, periodMs: 4000, phase: Math.PI } },
      { left: 860, right: 1140, top: 500, soft: true, look: 'cloud', move: { x: 230, periodMs: 6000, phase: 0 } },
    ],
    blast: { left: -350, right: 2350, top: -450, bottom: 1400 },
    respawn: { x: 1000, y: 280 },
    spawns: [650, 1350, 850, 1150],
    drawBackground: drawSky,
  },
  barco: {
    name: 'Barco pirata',
    sky: 0xffc59a,
    platforms: [
      { left: 360, right: 1640, top: 800, main: true, look: 'deck' },
      { left: 1250, right: 1560, top: 630, soft: true, look: 'plank' },
      { left: 870, right: 1070, top: 420, soft: true, look: 'plank' },
      { left: 110, right: 310, top: 860, soft: true, look: 'barrel', move: { y: 25, periodMs: 2500, phase: 0 } },
    ],
    blast: { left: -300, right: 2300, top: -450, bottom: 1250 },
    respawn: { x: 1000, y: 250 },
    spawns: [600, 1400, 850, 1150],
    drawBackground: drawSea,
    // El barco se dibuja aunque haya imagen de fondo: sin él, la cubierta flotaría en el mar.
    drawProps: drawShip,
  },
};

export const STAGE_KEYS = Object.keys(STAGES);

// Copia de las plataformas para una pelea (las que se mueven cambian de lugar), ya dibujadas.
export function buildPlatforms(scene, layer, stage) {
  return stage.platforms.map((p) => {
    const platform = { ...p, baseLeft: p.left, baseRight: p.right, baseTop: p.top, dx: 0, dy: 0 };
    platform.sprite = drawPlatform(scene, platform);
    layer.add(platform.sprite);
    return platform;
  });
}

// Mueve las plataformas que van y vienen. `dx` y `dy` dicen cuánto se movieron este cuadro,
// para llevarse con ellas a quien esté parado encima.
export function movePlatforms(platforms, timeMs) {
  for (const p of platforms) {
    if (!p.move) continue;
    const wave = Math.sin((timeMs / p.move.periodMs) * Math.PI * 2 + p.move.phase);
    const ox = (p.move.x ?? 0) * wave;
    const oy = (p.move.y ?? 0) * wave;
    p.dx = p.baseLeft + ox - p.left;
    p.dy = p.baseTop + oy - p.top;
    p.left = p.baseLeft + ox;
    p.right = p.baseRight + ox;
    p.top = p.baseTop + oy;
    p.sprite.setPosition((p.left + p.right) / 2, p.top);
  }
}

// Cada plataforma es un contenedor con su dibujo; el (0, 0) es el centro de la orilla de arriba.
function drawPlatform(scene, p) {
  const width = p.right - p.left;
  const box = scene.add.container((p.left + p.right) / 2, p.top);
  const parts = [];
  if (p.look === 'island') {
    parts.push(scene.add.triangle(0, 40, 0, 0, width, 0, width / 2, 260, 0x8b5a2b).setOrigin(0.5, 0));
    parts.push(scene.add.rectangle(0, 40, width, 80, 0x9c6b3c).setRounded(20));
    parts.push(scene.add.rectangle(0, 10, width + 10, 26, 0x4cd97b).setRounded(13));
  } else if (p.look === 'plank') {
    parts.push(scene.add.rectangle(0, 12, width, 24, 0xc98b4f).setRounded(12).setStrokeStyle(4, 0x8b5a2b));
  } else if (p.look === 'cloud') {
    const puffs = Math.max(3, Math.round(width / 70));
    for (let i = 0; i < puffs; i += 1) {
      const x = -width / 2 + 35 + (i * (width - 70)) / (puffs - 1);
      parts.push(scene.add.circle(x, 22, 40, 0xffffff));
    }
    parts.push(scene.add.rectangle(0, 30, width, 50, 0xffffff).setRounded(25));
    parts.push(scene.add.rectangle(0, 52, width - 40, 10, 0xd6ecff).setRounded(5));
  } else if (p.look === 'deck') {
    parts.push(scene.add.rectangle(0, 20, width, 40, 0xa86b3c).setStrokeStyle(4, 0x6b4223));
    for (let x = -width / 2 + 80; x < width / 2; x += 80) parts.push(scene.add.rectangle(x, 20, 3, 40, 0x6b4223));
    for (let x = -width / 2 + 20; x <= width / 2 - 20; x += 120) parts.push(scene.add.rectangle(x, -22, 8, 44, 0x6b4223));
    parts.push(scene.add.rectangle(0, -44, width - 30, 8, 0x6b4223));
  } else if (p.look === 'barrel') {
    parts.push(scene.add.rectangle(0, 30, width, 60, 0x9c6b3c).setRounded(24).setStrokeStyle(4, 0x6b4223));
    for (const x of [-width / 4, width / 4]) parts.push(scene.add.rectangle(x, 30, 10, 60, 0x5a5a6e));
  }
  box.add(parts);
  return box;
}

function addAll(layer, objects) {
  layer.add(objects);
}

function clouds(scene, spots, alpha = 0.85) {
  const list = [];
  for (const [x, y, s] of spots) {
    for (const [dx, dy, r] of [[0, 0, 50], [55, 10, 40], [-50, 12, 38], [20, -25, 42]]) {
      list.push(scene.add.circle(x + dx * s, y + dy * s, r * s, 0xffffff, alpha));
    }
  }
  return list;
}

function drawCastle(scene, layer) {
  const castle = 0x9d8fd6;
  const roof = 0xb07cff;
  addAll(layer, [
    scene.add.circle(1650, 120, 90, 0xfff1b8, 0.9),
    ...clouds(scene, [[200, 160, 1], [700, 90, 1.3], [1250, 210, 0.9], [1900, 140, 1.1], [-100, 320, 1]]),
    scene.add.rectangle(1000, 640, 520, 300, castle),
    scene.add.rectangle(760, 560, 110, 460, castle),
    scene.add.rectangle(1240, 560, 110, 460, castle),
    scene.add.triangle(760, 330, 0, 60, 60, 0, 120, 60, roof).setOrigin(0.5, 1),
    scene.add.triangle(1240, 330, 0, 60, 60, 0, 120, 60, roof).setOrigin(0.5, 1),
    scene.add.rectangle(1000, 470, 150, 380, castle),
    scene.add.triangle(1000, 280, 0, 80, 80, 0, 160, 80, roof).setOrigin(0.5, 1),
    scene.add.rectangle(1000, 735, 90, 130, 0x6f62a8).setRounded(40),
  ]);
}

function drawSky(scene, layer) {
  const rainbow = scene.add.graphics();
  [0xff5a5f, 0xff9a3c, 0xffc93c, 0x4cd97b, 0x3fa7ff, 0xb07cff].forEach((color, i) => {
    rainbow.lineStyle(26, color, 0.55);
    rainbow.beginPath();
    rainbow.arc(1000, 1000, 760 - i * 26, Phaser.Math.DegToRad(200), Phaser.Math.DegToRad(340), false);
    rainbow.strokePath();
  });
  addAll(layer, [
    scene.add.circle(300, 150, 80, 0xfff1b8, 0.95),
    rainbow,
    ...clouds(scene, [[150, 420, 0.8], [1850, 360, 0.9], [600, 120, 0.7], [1500, 140, 0.8], [1000, 1080, 1.6]], 0.6),
  ]);
}

function drawSea(scene, layer) {
  const waves = [];
  for (let i = 0; i < 9; i += 1) {
    const wave = scene.add.ellipse(-200 + i * 300, 985, 220, 40, 0xffffff, 0.35);
    scene.tweens.add({ targets: wave, x: wave.x + 60, duration: 1600 + i * 90, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    waves.push(wave);
  }
  addAll(layer, [
    scene.add.circle(1600, 380, 120, 0xffe08a, 0.95),
    ...clouds(scene, [[300, 180, 0.9], [1300, 120, 1.1], [1900, 260, 0.8]], 0.7),
    scene.add.rectangle(1000, 1300, 4000, 700, 0x2f7fc1),
    ...waves,
  ]);
}

function drawShip(scene, layer) {
  const hull = scene.add.graphics();
  hull.fillStyle(0x7a4a24, 1);
  hull.fillPoints([{ x: 330, y: 840 }, { x: 1670, y: 840 }, { x: 1520, y: 1040 }, { x: 480, y: 1040 }], true);
  hull.fillStyle(0x5c361a, 1);
  hull.fillRect(400, 900, 1200, 16);
  const sail = scene.add.graphics();
  sail.fillStyle(0xfff6e5, 1);
  sail.fillTriangle(990, 470, 990, 730, 1200, 730);
  sail.fillTriangle(950, 500, 950, 730, 780, 730);
  addAll(layer, [
    hull,
    scene.add.rectangle(970, 610, 26, 380, 0x6b4223),
    sail,
    scene.add.triangle(985, 395, 0, 0, 60, 18, 0, 36, 0x1b1530).setOrigin(0, 0.5),
  ]);
}
