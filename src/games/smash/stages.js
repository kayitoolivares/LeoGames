import Phaser from 'phaser';

// Escenarios de Bolitas Bros (coordenadas del mundo, que es más grande que la pantalla).
// Plataformas: `soft` se atraviesan desde abajo y se bajan con ↓; `main` es la principal;
// `move` = { x, y (cuánto se mueven), periodMs, phase } para las que van y vienen;
// `look` = cómo se dibujan ('island', 'plank', 'cloud', 'deck', 'barrel', 'moon', 'asteroid', 'rock', 'stone').
// `unlock`: qué hay que ganar para que aparezca (ver UNLOCKS en rewards.js). `gravity`: multiplica la gravedad.
// `geysers`: géiseres de lava en la plataforma principal (ver geysers.js).
// `move.swing` = { length, angle (radianes), periodMs }: se columpia colgada de una liana (la Selva).
// `move.orbit` = { rx, ry }: da vueltas (los globos).
// `events`: la sorpresa del escenario (ver events.js): rayo, ola, viento, cohete, cocos, bloques, burbujas, fantasma,
// cerezas, avión, tractor, túnel o montaña rusa.
// `hidden`: no se escoge (la torre es solo de la Aventura); `goal`: dónde está la bandera de la meta.
// La rueda de la fortuna de la Feria da una vuelta en este tiempo (las canastillas y los rayos de la rueda juntos).
const WHEEL_PERIOD_MS = 16000;
// Qué tan arriba de la canastilla está su gancho (de ahí sale su rayo hacia el centro de la rueda).
const CABIN_HOOK = 46;
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
    events: 'lightning',
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
    events: 'wind',
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
    events: 'wave',
  },
  selva: {
    name: 'Selva',
    sky: 0x9be3c4,
    platforms: [
      { left: 380, right: 1620, top: 800, main: true, look: 'log' },
      { left: 520, right: 780, top: 620, soft: true, look: 'leaf' },
      { left: 1220, right: 1480, top: 620, soft: true, look: 'leaf' },
      // Columpio colgado de una liana: va y viene en arco.
      { left: 880, right: 1120, top: 470, soft: true, look: 'swing', move: { swing: { length: 230, angle: 0.55 }, periodMs: 4200, phase: 0 } },
    ],
    blast: { left: -250, right: 2250, top: -450, bottom: 1400 },
    respawn: { x: 1000, y: 230 },
    spawns: [600, 1400, 850, 1150],
    drawBackground: drawSky,
    events: 'coconuts',
  },
  juguetes: {
    name: 'Ciudad de juguete',
    sky: 0xbfe3ff,
    platforms: [
      { left: 360, right: 1640, top: 800, main: true, look: 'toys' },
      { left: 560, right: 800, top: 620, soft: true, look: 'block' },
      { left: 1200, right: 1440, top: 620, soft: true, look: 'block' },
      { left: 880, right: 1120, top: 440, soft: true, look: 'block', move: { x: 200, periodMs: 6500, phase: 0 } },
    ],
    blast: { left: -250, right: 2250, top: -450, bottom: 1400 },
    respawn: { x: 1000, y: 250 },
    spawns: [600, 1400, 850, 1150],
    drawBackground: drawSky,
    events: 'blocks',
  },
  mar: {
    name: 'Fondo del mar',
    sky: 0x1f6fb5,
    // Bajo el agua todo flota un poquito.
    gravity: 0.8,
    platforms: [
      { left: 420, right: 1580, top: 800, main: true, look: 'sand' },
      { left: 540, right: 780, top: 610, soft: true, look: 'shell', move: { y: 60, periodMs: 5000, phase: 0 } },
      { left: 1220, right: 1460, top: 610, soft: true, look: 'shell', move: { y: 60, periodMs: 5000, phase: Math.PI } },
      { left: 880, right: 1120, top: 430, soft: true, look: 'shell' },
    ],
    blast: { left: -300, right: 2300, top: -500, bottom: 1400 },
    respawn: { x: 1000, y: 240 },
    spawns: [620, 1380, 850, 1150],
    drawBackground: drawSea,
    events: 'bubbles',
  },
  embrujada: {
    name: 'Casa embrujada',
    sky: 0x2a1f4a,
    platforms: [
      { left: 380, right: 1620, top: 800, main: true, look: 'haunted' },
      { left: 520, right: 780, top: 620, soft: true, look: 'shelf' },
      { left: 1220, right: 1480, top: 620, soft: true, look: 'shelf' },
      // Una escoba mágica que va y viene flotando.
      { left: 890, right: 1110, top: 450, soft: true, look: 'broom', move: { x: 260, y: 30, periodMs: 5000, phase: 0 } },
    ],
    blast: { left: -250, right: 2250, top: -450, bottom: 1400 },
    respawn: { x: 1000, y: 250 },
    spawns: [600, 1400, 850, 1150],
    drawBackground: drawNight,
    events: 'ghosts',
  },
  pastel: {
    name: 'Pastel gigante',
    sky: 0xffd6e8,
    platforms: [
      { left: 400, right: 1600, top: 800, main: true, look: 'cake' },
      // Galletas que suben y bajan, y un dulce arriba.
      { left: 520, right: 760, top: 610, soft: true, look: 'cookie', move: { y: 70, periodMs: 3600, phase: 0 } },
      { left: 1240, right: 1480, top: 610, soft: true, look: 'cookie', move: { y: 70, periodMs: 3600, phase: Math.PI } },
      { left: 870, right: 1130, top: 430, soft: true, look: 'candy' },
    ],
    blast: { left: -250, right: 2250, top: -450, bottom: 1400 },
    respawn: { x: 1000, y: 230 },
    spawns: [620, 1380, 850, 1150],
    drawBackground: drawSky,
    events: 'cherries',
  },
  ciudad: {
    name: 'Ciudad de noche',
    sky: 0x1b1f4a,
    platforms: [
      { left: 380, right: 1620, top: 800, main: true, look: 'roof' },
      { left: 480, right: 740, top: 610, soft: true, look: 'sign' },
      { left: 1260, right: 1520, top: 610, soft: true, look: 'sign' },
      // La canastilla de los limpiaventanas: sube y baja.
      { left: 880, right: 1120, top: 470, soft: true, look: 'gondola', move: { y: 120, periodMs: 5200, phase: 0 } },
    ],
    blast: { left: -250, right: 2250, top: -450, bottom: 1400 },
    respawn: { x: 1000, y: 230 },
    spawns: [600, 1400, 850, 1150],
    drawBackground: drawNight,
    events: 'plane',
  },
  globos: {
    name: 'Globos',
    sky: 0xffc58a,
    platforms: [
      { left: 460, right: 1540, top: 800, main: true, look: 'airship' },
      // Canastas de globos: dos dan vueltas y la de arriba va y viene.
      { left: 250, right: 450, top: 610, soft: true, look: 'basket', move: { orbit: { rx: 70, ry: 55 }, periodMs: 6000, phase: 0 } },
      { left: 1550, right: 1750, top: 610, soft: true, look: 'basket', move: { orbit: { rx: 70, ry: 55 }, periodMs: 6000, phase: Math.PI } },
      { left: 900, right: 1100, top: 440, soft: true, look: 'basket', move: { x: 240, periodMs: 7000, phase: 0 } },
    ],
    blast: { left: -350, right: 2350, top: -450, bottom: 1400 },
    respawn: { x: 1000, y: 240 },
    spawns: [650, 1350, 850, 1150],
    drawBackground: drawSky,
    events: 'wind',
  },
  // El ring: las cuerdas rebotan al que llega a la orilla caminando o brincando bajito (ver events.js).
  ring: {
    name: 'Ring de lucha libre',
    sky: 0x2a1e4a,
    platforms: [
      { left: 500, right: 1500, top: 800, main: true, look: 'ring' },
      { left: 560, right: 820, top: 610, soft: true, look: 'plank' },
      { left: 1180, right: 1440, top: 610, soft: true, look: 'plank' },
      { left: 860, right: 1140, top: 430, soft: true, look: 'plank', move: { y: 40, periodMs: 3000, phase: 0 } },
    ],
    blast: { left: -300, right: 2300, top: -450, bottom: 1300 },
    respawn: { x: 1000, y: 260 },
    spawns: [650, 1350, 850, 1150],
    drawBackground: drawNight,
    events: 'ropes',
  },
  // La cancha de fútbol: los travesaños de las porterías son plataformas y de vez en cuando cruza un balón gigante.
  cancha: {
    name: 'Cancha de fútbol',
    sky: 0x8fd3ff,
    platforms: [
      { left: 330, right: 1670, top: 820, main: true, look: 'grass' },
      { left: 330, right: 520, top: 610, soft: true, look: 'goal' },
      { left: 1480, right: 1670, top: 610, soft: true, look: 'goal' },
      { left: 860, right: 1140, top: 470, soft: true, look: 'plank' },
    ],
    blast: { left: -300, right: 2300, top: -450, bottom: 1300 },
    respawn: { x: 1000, y: 260 },
    spawns: [650, 1350, 850, 1150],
    drawBackground: drawSky,
    events: 'soccer',
  },
  // La granja: pacas de paja (la de en medio es el elevador de paja, que sube y baja) y de vez en cuando pasa el
  // tractor por el piso (hay que brincarlo).
  granja: {
    name: 'Granja',
    sky: 0x9fd8ff,
    platforms: [
      { left: 380, right: 1620, top: 800, main: true, look: 'farm' },
      { left: 540, right: 780, top: 620, soft: true, look: 'hay' },
      { left: 1220, right: 1460, top: 620, soft: true, look: 'hay' },
      { left: 880, right: 1120, top: 450, soft: true, look: 'hay', move: { y: 90, periodMs: 4600, phase: 0 } },
    ],
    blast: { left: -250, right: 2250, top: -450, bottom: 1400 },
    respawn: { x: 1000, y: 240 },
    spawns: [600, 1400, 850, 1150],
    drawBackground: drawFarm,
    events: 'tractor',
  },
  // El tren en marcha: se pelea en el techo de un vagón mientras el paisaje pasa (los postes y los árboles, ver
  // drawTrainRide); a veces viene un túnel y al que esté arriba (en las cajas o saltando) se lo lleva.
  tren: {
    name: 'Tren en marcha',
    sky: 0xffd9a8,
    platforms: [
      { left: 360, right: 1640, top: 800, main: true, look: 'train' },
      { left: 520, right: 760, top: 630, soft: true, look: 'crate' },
      { left: 1240, right: 1480, top: 630, soft: true, look: 'crate' },
      // El humo de la locomotora: una nube que va y viene.
      { left: 880, right: 1120, top: 460, soft: true, look: 'cloud', move: { x: 220, periodMs: 5200, phase: 0 } },
    ],
    blast: { left: -250, right: 2250, top: -450, bottom: 1300 },
    respawn: { x: 1000, y: 250 },
    spawns: [600, 1400, 850, 1150],
    drawBackground: drawCountry,
    // Los postes y los árboles que pasan van encima del fondo aunque haya imagen (si no, no se ve que el tren avanza).
    drawProps: drawTrainRide,
    events: 'tunnel',
  },
  // La feria: las canastillas de la rueda de la fortuna dan vueltas (súbete a una) y de vez en cuando cruza el
  // carrito de la montaña rusa, subiendo y bajando.
  feria: {
    name: 'Feria',
    sky: 0x8fc8ff,
    platforms: [
      { left: 380, right: 1620, top: 800, main: true, look: 'fair' },
      ...[0, 1, 2].map((i) => ({
        left: 910,
        right: 1090,
        top: 470,
        soft: true,
        look: 'cabin',
        move: { orbit: { rx: 255, ry: 255 }, periodMs: WHEEL_PERIOD_MS, phase: (i * Math.PI * 2) / 3 },
      })),
    ],
    blast: { left: -250, right: 2250, top: -450, bottom: 1400 },
    respawn: { x: 1000, y: 160 },
    spawns: [600, 1400, 850, 1150],
    drawBackground: drawFair,
    // La rueda se dibuja aunque haya imagen de fondo (las canastillas cuelgan de ella).
    drawProps: drawWheel,
    events: 'coaster',
  },
  espacio: {
    name: 'Espacio',
    sky: 0x14112b,
    unlock: 'smash-espacio',
    // Gravedad baja: se salta altísimo y se cae despacito.
    gravity: 0.55,
    platforms: [
      { left: 480, right: 1520, top: 800, main: true, look: 'moon' },
      { left: 280, right: 500, top: 580, soft: true, look: 'asteroid', move: { x: 50, y: 40, periodMs: 7000, phase: 0 } },
      { left: 1500, right: 1720, top: 580, soft: true, look: 'asteroid', move: { x: 50, y: 40, periodMs: 7000, phase: Math.PI } },
      { left: 870, right: 1130, top: 400, soft: true, look: 'asteroid', move: { y: 70, periodMs: 5000, phase: 0 } },
    ],
    blast: { left: -350, right: 2350, top: -700, bottom: 1400 },
    respawn: { x: 1000, y: 260 },
    spawns: [650, 1350, 850, 1150],
    drawBackground: drawSpace,
    events: 'rocket',
  },
  volcan: {
    name: 'Volcán',
    sky: 0x3a1420,
    unlock: 'smash-volcan',
    platforms: [
      { left: 400, right: 1600, top: 800, main: true, look: 'rock' },
      { left: 540, right: 820, top: 620, soft: true, look: 'stone' },
      { left: 1180, right: 1460, top: 620, soft: true, look: 'stone' },
      { left: 860, right: 1140, top: 440, soft: true, look: 'stone', move: { x: 170, periodMs: 6000, phase: 0 } },
    ],
    geysers: { xs: [620, 1000, 1380], everyMs: 5200, warnMs: 1400, eruptMs: 900 },
    blast: { left: -300, right: 2300, top: -450, bottom: 1300 },
    respawn: { x: 1000, y: 250 },
    spawns: [600, 1400, 850, 1150],
    drawBackground: drawVolcano,
    // La lava de abajo se ve aunque haya imagen de fondo.
    drawProps: drawLava,
  },
  // Solo para la Aventura: subir por las nubes hasta la bandera.
  torre: {
    name: 'Torre de nubes',
    hidden: true,
    sky: 0x9fd8ff,
    platforms: [
      { left: 600, right: 1400, top: 800, main: true, look: 'cloud' },
      { left: 640, right: 880, top: 660, soft: true, look: 'cloud' },
      { left: 880, right: 1120, top: 520, soft: true, look: 'cloud' },
      { left: 1120, right: 1360, top: 380, soft: true, look: 'cloud', move: { x: 110, periodMs: 4500, phase: 0 } },
      { left: 880, right: 1120, top: 240, soft: true, look: 'cloud' },
      { left: 640, right: 880, top: 100, soft: true, look: 'cloud' },
      { left: 880, right: 1120, top: -40, soft: true, look: 'cloud', move: { x: 110, periodMs: 4950, phase: Math.PI } },
      { left: 1120, right: 1360, top: -180, soft: true, look: 'cloud' },
      { left: 880, right: 1120, top: -320, soft: true, look: 'cloud' },
      { left: 640, right: 880, top: -460, soft: true, look: 'cloud', move: { x: 110, periodMs: 5400, phase: 0 } },
      { left: 880, right: 1120, top: -600, soft: true, look: 'cloud' },
      { left: 1120, right: 1360, top: -740, soft: true, look: 'cloud' },
      { left: 880, right: 1120, top: -880, soft: true, look: 'cloud', move: { x: 110, periodMs: 5850, phase: Math.PI } },
      { left: 820, right: 1180, top: -1020, soft: true, look: 'cloud' },
    ],
    goal: { x: 1000, y: -1020 },
    blast: { left: -300, right: 2300, top: -1920, bottom: 1400 },
    respawn: { x: 1000, y: 620 },
    spawns: [850, 1150, 700, 1300],
    drawBackground: drawTower,
  },
};

// Los que se escogen en la pantalla de selección (la torre no).
export const STAGE_KEYS = Object.keys(STAGES).filter((key) => !STAGES[key].hidden);

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
    let ox = (p.move.x ?? 0) * wave;
    let oy = (p.move.y ?? 0) * wave;
    // Da vueltas en un círculo (aplastado).
    const orbit = p.move.orbit;
    if (orbit) {
      const angle = (timeMs / p.move.periodMs) * Math.PI * 2 + p.move.phase;
      ox = orbit.rx * Math.cos(angle);
      oy = orbit.ry * Math.sin(angle);
      // (La canastilla de la rueda de la fortuna: su rayo va de su gancho al centro de la rueda.)
      if (p.spoke) p.spoke.setScale(Math.hypot(ox, oy), 1).setRotation(Math.atan2(-oy, -ox));
    }
    // Columpio: cuelga de un punto arriba y va de lado a lado en arco (más alto en las puntas).
    const swing = p.move.swing;
    if (swing) {
      const angle = swing.angle * wave;
      ox = swing.length * Math.sin(angle);
      oy = -swing.length * (1 - Math.cos(angle));
      p.vine?.setAngle(-Phaser.Math.RadToDeg(angle));
    }
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
  } else if (p.look === 'ring') {
    // La lona azul del ring, con su faldón blanco y rojo.
    parts.push(scene.add.rectangle(0, 70, width, 100, 0xe53935).setStrokeStyle(4, 0x1b1530));
    parts.push(scene.add.rectangle(0, 26, width, 20, 0xffffff).setStrokeStyle(3, 0x1b1530));
    parts.push(scene.add.rectangle(0, 8, width + 16, 20, 0x3a5bd6).setRounded(6).setStrokeStyle(4, 0x1b1530));
  } else if (p.look === 'grass') {
    // El pasto de la cancha con su línea blanca y el círculo de en medio.
    parts.push(scene.add.rectangle(0, 60, width, 120, 0x3f8f3a).setStrokeStyle(4, 0x1b1530));
    parts.push(scene.add.rectangle(0, 12, width, 24, 0x5cb85c).setStrokeStyle(4, 0x1b1530));
    parts.push(scene.add.rectangle(0, 2, width - 40, 4, 0xffffff));
    parts.push(scene.add.rectangle(0, 12, 6, 24, 0xffffff));
  } else if (p.look === 'goal') {
    // El travesaño de una portería con su red colgando.
    const net = scene.add.graphics();
    net.lineStyle(2, 0xffffff, 0.6);
    for (let x = -width / 2; x <= width / 2; x += 18) net.lineBetween(x, 10, x, 210);
    for (let y = 10; y <= 210; y += 18) net.lineBetween(-width / 2, y, width / 2, y);
    parts.push(net);
    parts.push(scene.add.rectangle(0, 6, width, 14, 0xffffff).setStrokeStyle(3, 0x1b1530));
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
  } else if (p.look === 'moon') {
    parts.push(scene.add.ellipse(0, 70, width, 180, 0x8f8aa8).setStrokeStyle(5, 0x5d5878));
    parts.push(scene.add.rectangle(0, 12, width - 10, 28, 0xc9c5dd).setRounded(14));
    for (const [cx, cy, r] of [[-0.3, 70, 26], [0.05, 100, 18], [0.32, 64, 30], [-0.1, 130, 14]]) {
      parts.push(scene.add.circle(cx * width, cy, r, 0x6f6a8c));
    }
  } else if (p.look === 'asteroid') {
    parts.push(scene.add.ellipse(0, 34, width, 76, 0x8a7a6e).setStrokeStyle(4, 0x5c4f46));
    parts.push(scene.add.circle(-width * 0.22, 36, 11, 0x6e6058));
    parts.push(scene.add.circle(width * 0.2, 46, 8, 0x6e6058));
  } else if (p.look === 'rock') {
    parts.push(scene.add.triangle(0, 40, 0, 0, width, 0, width / 2, 240, 0x3a2a2e).setOrigin(0.5, 0));
    parts.push(scene.add.rectangle(0, 40, width, 80, 0x4a3438).setRounded(18));
    parts.push(scene.add.rectangle(0, 10, width + 10, 24, 0x6e4a44).setRounded(12));
    for (const x of [-0.35, -0.05, 0.28]) parts.push(scene.add.rectangle(x * width, 52, 90, 6, 0xff7a2f).setAngle(12));
  } else if (p.look === 'stone') {
    parts.push(scene.add.rectangle(0, 14, width, 28, 0x5a4448).setRounded(12).setStrokeStyle(4, 0x2e2024));
    parts.push(scene.add.rectangle(width * 0.15, 16, 50, 4, 0xff7a2f));
  } else if (p.look === 'barrel') {
    parts.push(scene.add.rectangle(0, 30, width, 60, 0x9c6b3c).setRounded(24).setStrokeStyle(4, 0x6b4223));
    for (const x of [-width / 4, width / 4]) parts.push(scene.add.rectangle(x, 30, 10, 60, 0x5a5a6e));
  } else if (p.look === 'log') {
    // Un tronco gigante acostado, con sus anillos en las puntas y musgo encima.
    parts.push(scene.add.rectangle(0, 50, width, 100, 0x8b5a2b).setRounded(50).setStrokeStyle(5, 0x5c3a1a));
    for (const side of [-1, 1]) {
      parts.push(scene.add.ellipse(side * (width / 2 - 30), 50, 60, 100, 0xc9935a).setStrokeStyle(4, 0x5c3a1a));
      parts.push(scene.add.ellipse(side * (width / 2 - 30), 50, 30, 54, 0xa8743f));
    }
    parts.push(scene.add.rectangle(0, 6, width - 40, 16, 0x4cb050).setRounded(8));
  } else if (p.look === 'leaf') {
    parts.push(scene.add.ellipse(0, 14, width + 20, 40, 0x3fa34d).setStrokeStyle(4, 0x267a36));
    parts.push(scene.add.rectangle(0, 14, width - 30, 4, 0x267a36));
  } else if (p.look === 'swing') {
    // La liana sube hasta donde cuelga (gira con el columpio, ver movePlatforms).
    const length = p.move.swing.length;
    p.vine = scene.add.container(0, 0, [
      scene.add.rectangle(-width / 2 + 20, -length / 2, 8, length, 0x3f7a2a).setOrigin(0.5),
      scene.add.rectangle(width / 2 - 20, -length / 2, 8, length, 0x3f7a2a).setOrigin(0.5),
    ]);
    parts.push(p.vine);
    parts.push(scene.add.rectangle(0, 12, width, 24, 0xa8743f).setRounded(10).setStrokeStyle(4, 0x5c3a1a));
  } else if (p.look === 'toys') {
    // Bloques de juguete de colores, uno junto al otro.
    const colors = [0xe53935, 0xffd02a, 0x3a5bd6, 0x3cc44f, 0xff8a1e, 0x8158d8];
    const count = Math.round(width / 120);
    const size = width / count;
    for (let i = 0; i < count; i += 1) {
      const x = -width / 2 + size * (i + 0.5);
      parts.push(scene.add.rectangle(x, 60, size - 4, 120, colors[i % colors.length]).setStrokeStyle(4, 0x1b1530));
      parts.push(scene.add.circle(x, 60, size * 0.18, 0xffffff, 0.35));
    }
  } else if (p.look === 'block') {
    parts.push(scene.add.rectangle(0, 20, width, 40, 0xff8a1e).setStrokeStyle(4, 0x1b1530));
    for (const x of [-width / 3, 0, width / 3]) parts.push(scene.add.circle(x, -2, 12, 0xffb35c).setStrokeStyle(3, 0x1b1530));
  } else if (p.look === 'sand') {
    parts.push(scene.add.ellipse(0, 90, width, 220, 0xe8d29a).setStrokeStyle(5, 0xc9a85a));
    parts.push(scene.add.rectangle(0, 14, width - 10, 30, 0xf2e2b2).setRounded(15));
    for (const [x, color] of [[-0.35, 0xff6f91], [0.3, 0xff9a3c], [0.05, 0xb07cff]]) {
      parts.push(scene.add.ellipse(x * width, 60, 70, 40, color).setStrokeStyle(3, 0x1b1530));
    }
  } else if (p.look === 'shell') {
    parts.push(scene.add.ellipse(0, 18, width, 46, 0xffc4d6).setStrokeStyle(4, 0xd9668a));
    for (const x of [-0.25, 0, 0.25]) parts.push(scene.add.rectangle(x * width, 18, 4, 36, 0xd9668a));
  } else if (p.look === 'haunted') {
    // El piso de la casa embrujada: roca morada, tablas de madera y calabazas colgando de las orillas.
    parts.push(scene.add.triangle(0, 40, 0, 0, width, 0, width / 2, 240, 0x3a2f4a).setOrigin(0.5, 0));
    parts.push(scene.add.rectangle(0, 40, width, 80, 0x5a4a6e).setRounded(16));
    parts.push(scene.add.rectangle(0, 12, width + 10, 26, 0x8a6a4a).setRounded(8).setStrokeStyle(4, 0x4a3426));
    for (let x = -width / 2 + 90; x < width / 2; x += 90) parts.push(scene.add.rectangle(x, 12, 3, 22, 0x4a3426));
    for (const side of [-1, 1]) {
      const x = side * (width / 2 - 40);
      parts.push(scene.add.circle(x, 62, 22, 0xff8a1e).setStrokeStyle(3, 0x1b1530));
      parts.push(scene.add.rectangle(x, 38, 6, 10, 0x3f7a2a));
      parts.push(scene.add.triangle(x - 8, 58, 0, 6, 6, 0, 12, 6, 0x1b1530));
      parts.push(scene.add.triangle(x + 8, 58, 0, 6, 6, 0, 12, 6, 0x1b1530));
    }
  } else if (p.look === 'shelf') {
    parts.push(scene.add.rectangle(0, 12, width, 24, 0x6b4a3a).setRounded(6).setStrokeStyle(4, 0x3a2420));
    parts.push(scene.add.rectangle(-width / 2 + 30, 34, 10, 22, 0xfff6e5));
    parts.push(scene.add.circle(-width / 2 + 30, 20, 5, 0xffc93c));
  } else if (p.look === 'broom') {
    parts.push(scene.add.rectangle(-20, 10, width, 12, 0x9c6b3c).setRounded(6).setStrokeStyle(3, 0x5c3a1a));
    parts.push(scene.add.triangle(width / 2 - 10, 10, 0, -14, 70, -24, 70, 24, 0xe8c25a).setOrigin(0, 0.5).setStrokeStyle(3, 0x8b6a2b));
  } else if (p.look === 'cake') {
    // Un pastel de tres pisos: chocolate abajo, fresa en medio y betún blanco con escurridos arriba.
    parts.push(scene.add.rectangle(0, 210, width + 60, 30, 0xe8e8f0).setRounded(14).setStrokeStyle(4, 0xb0b0c8));
    parts.push(scene.add.rectangle(0, 140, width, 120, 0x8b5a3c).setStrokeStyle(4, 0x5c3a1a));
    parts.push(scene.add.rectangle(0, 50, width, 70, 0xff9ec7).setStrokeStyle(4, 0xd9668a));
    parts.push(scene.add.rectangle(0, 12, width + 10, 28, 0xffffff).setRounded(14).setStrokeStyle(3, 0xf0d0e0));
    for (let x = -width / 2 + 40; x < width / 2; x += 80) parts.push(scene.add.ellipse(x, 30, 26, 34, 0xffffff));
    for (let x = -width / 2 + 60; x < width / 2; x += 110) parts.push(scene.add.rectangle(x, 140, 22, 8, [0xffd02a, 0x4cd97b, 0x3fa7ff][Math.abs(Math.round(x)) % 3]).setAngle(30));
  } else if (p.look === 'cookie') {
    parts.push(scene.add.ellipse(0, 16, width, 44, 0xd99a5a).setStrokeStyle(4, 0x8b5a2b));
    for (const [x, y] of [[-0.3, 10], [0, 22], [0.28, 12], [-0.1, 6]]) parts.push(scene.add.circle(x * width, y, 6, 0x4a2a14));
  } else if (p.look === 'candy') {
    parts.push(scene.add.rectangle(0, 14, width, 28, 0xffffff).setRounded(14).setStrokeStyle(4, 0xc0304a));
    for (let x = -width / 2 + 20; x < width / 2 - 10; x += 36) parts.push(scene.add.rectangle(x, 14, 14, 26, 0xe53950).setAngle(25));
  } else if (p.look === 'roof') {
    // La azotea de un edificio: ventanas prendidas abajo y unos aparatos de aire en el techo... de adorno.
    parts.push(scene.add.rectangle(0, 300, width - 40, 560, 0x3a3f5a).setStrokeStyle(4, 0x1b1f3a));
    for (let y = 70; y < 560; y += 70) {
      for (let x = -width / 2 + 70; x < width / 2 - 40; x += 90) {
        const lit = (Math.abs(Math.round(x)) + y) % 3 !== 0;
        parts.push(scene.add.rectangle(x, y, 40, 34, lit ? 0xffe08a : 0x262a40));
      }
    }
    parts.push(scene.add.rectangle(0, 12, width + 10, 26, 0x5a607a).setStrokeStyle(4, 0x1b1f3a));
  } else if (p.look === 'sign') {
    // Un anuncio de neón: el borde de arriba es donde se para.
    parts.push(scene.add.rectangle(0, 50, width - 20, 70, 0x1b1530).setStrokeStyle(5, 0xff5fd2));
    parts.push(scene.add.rectangle(0, 50, width - 60, 18, 0x3ff0ff, 0.9).setRounded(9));
    parts.push(scene.add.rectangle(0, 8, width, 16, 0x8a90a8).setStrokeStyle(3, 0x1b1f3a));
  } else if (p.look === 'gondola') {
    parts.push(scene.add.rectangle(-width / 2 + 12, -200, 4, 400, 0xc0c4d0));
    parts.push(scene.add.rectangle(width / 2 - 12, -200, 4, 400, 0xc0c4d0));
    parts.push(scene.add.rectangle(0, 16, width, 32, 0x8a90a8).setStrokeStyle(4, 0x1b1f3a));
    parts.push(scene.add.rectangle(0, -16, width, 6, 0xffd02a));
  } else if (p.look === 'airship') {
    // Un dirigible: la cubierta de madera arriba y el globo rojo con rayas abajo.
    const rx = (width + 140) / 2;
    parts.push(scene.add.ellipse(0, 130, rx * 2, 230, 0xe85a5a).setStrokeStyle(6, 0x8a2a2a));
    // Las rayas, del alto del globo donde van (para que no se salgan).
    for (const x of [-0.25, 0, 0.25]) {
      const tall = 220 * Math.sqrt(1 - ((x * width) / rx) ** 2);
      parts.push(scene.add.rectangle(x * width, 130, 18, tall, 0xffd02a, 0.8));
    }
    parts.push(scene.add.triangle(width / 2 + 60, 130, 0, -50, 60, -90, 60, 90, 0xe85a5a).setOrigin(0, 0.5).setStrokeStyle(5, 0x8a2a2a));
    parts.push(scene.add.rectangle(0, 14, width, 28, 0xb08a5a).setStrokeStyle(4, 0x6b4223));
  } else if (p.look === 'basket') {
    // Canasta con su globo arriba (el globo es de adorno).
    const balloon = [0xff5a5f, 0x3fa7ff, 0xffd02a, 0x4cd97b][Math.abs(Math.round(p.left)) % 4];
    parts.push(scene.add.rectangle(-width / 2 + 16, -70, 3, 120, 0x6b4223));
    parts.push(scene.add.rectangle(width / 2 - 16, -70, 3, 120, 0x6b4223));
    parts.push(scene.add.circle(0, -190, 80, balloon).setStrokeStyle(5, 0x1b1530));
    parts.push(scene.add.ellipse(0, -190, 50, 160, 0xffffff, 0.25));
    parts.push(scene.add.rectangle(0, 24, width, 48, 0xc98b4f).setRounded(8).setStrokeStyle(4, 0x6b4223));
    for (let x = -width / 2 + 24; x < width / 2; x += 30) parts.push(scene.add.rectangle(x, 24, 3, 44, 0x8b5a2b));
  } else if (p.look === 'farm') {
    // La tierra de la granja con pasto encima y una cerca blanca en las orillas.
    parts.push(scene.add.triangle(0, 40, 0, 0, width, 0, width / 2, 240, 0x8b5a2b).setOrigin(0.5, 0));
    parts.push(scene.add.rectangle(0, 40, width, 80, 0xa8743f).setRounded(18));
    parts.push(scene.add.rectangle(0, 10, width + 10, 26, 0x6cc24a).setRounded(13).setStrokeStyle(3, 0x3f8a3a));
    for (const side of [-1, 1]) {
      const x0 = side * (width / 2 - 70);
      for (let k = 0; k < 3; k += 1) parts.push(scene.add.rectangle(x0 + side * k * 26, -24, 8, 46, 0xffffff).setStrokeStyle(2, 0x1b1530));
      parts.push(scene.add.rectangle(x0 + side * 26, -34, 70, 7, 0xffffff).setStrokeStyle(2, 0x1b1530));
      parts.push(scene.add.rectangle(x0 + side * 26, -16, 70, 7, 0xffffff).setStrokeStyle(2, 0x1b1530));
    }
  } else if (p.look === 'hay') {
    // Una paca de paja con sus cuerdas.
    parts.push(scene.add.rectangle(0, 26, width, 52, 0xf2c94c).setRounded(10).setStrokeStyle(4, 0xb08a2a));
    for (let x = -width / 2 + 16; x < width / 2 - 8; x += 22) parts.push(scene.add.rectangle(x, 26, 3, 40, 0xd9a93a).setAngle(8));
    for (const x of [-width / 4, width / 4]) parts.push(scene.add.rectangle(x, 26, 8, 52, 0xc0392b));
  } else if (p.look === 'train') {
    // El techo del vagón (donde se pelea) con sus ventanas y las ruedas abajo.
    parts.push(scene.add.rectangle(0, 120, width - 60, 200, 0xd64541).setStrokeStyle(5, 0x1b1530));
    for (let x = -width / 2 + 110; x < width / 2 - 80; x += 150) parts.push(scene.add.rectangle(x, 100, 90, 70, 0xbfe6ff).setStrokeStyle(4, 0x1b1530));
    parts.push(scene.add.rectangle(0, 200, width - 60, 16, 0xffd02a));
    for (const x of [-0.38, -0.25, 0.25, 0.38]) parts.push(scene.add.circle(x * width, 236, 30, 0x3a3a4a).setStrokeStyle(5, 0x1b1530));
    parts.push(scene.add.rectangle(0, 14, width, 28, 0x8a3030).setRounded(10).setStrokeStyle(4, 0x1b1530));
  } else if (p.look === 'crate') {
    parts.push(scene.add.rectangle(0, 40, width, 80, 0xc98b4f).setStrokeStyle(5, 0x6b4223));
    parts.push(scene.add.rectangle(0, 40, width - 20, 8, 0x8b5a2b).setAngle(16));
    parts.push(scene.add.rectangle(0, 4, width, 10, 0x8b5a2b));
  } else if (p.look === 'fair') {
    // El piso de la feria: tablas de madera con un toldo de rayas rojas y blancas y foquitos de colores.
    parts.push(scene.add.rectangle(0, 120, width, 220, 0x8b5a3c).setStrokeStyle(5, 0x5c3a1a));
    const stripes = Math.round(width / 80);
    for (let i = 0; i < stripes; i += 1) {
      const x = -width / 2 + (i + 0.5) * (width / stripes);
      parts.push(scene.add.rectangle(x, 60, width / stripes, 60, i % 2 ? 0xffffff : 0xe53935));
      parts.push(scene.add.circle(x, 98, 9, [0xffd02a, 0x3fa7ff, 0x4cd97b, 0xff5fd2][i % 4]).setStrokeStyle(2, 0x1b1530));
    }
    parts.push(scene.add.rectangle(0, 14, width + 10, 28, 0xc98b4f).setRounded(8).setStrokeStyle(4, 0x5c3a1a));
  } else if (p.look === 'cabin') {
    // Una canastilla de la rueda de la fortuna, colgando de su gancho.
    const color = [0xff5a5f, 0x3fa7ff, 0xffd02a][Math.round((p.move.phase * 3) / (Math.PI * 2)) % 3];
    p.spoke = scene.add.rectangle(0, -CABIN_HOOK, 1, 8, 0xd8dce8).setOrigin(0, 0.5).setStrokeStyle(2, 0x6a6a7a);
    parts.push(p.spoke);
    parts.push(scene.add.rectangle(0, -CABIN_HOOK / 2, 6, CABIN_HOOK, 0x6a6a7a));
    parts.push(scene.add.rectangle(0, 30, width, 56, color).setRounded(14).setStrokeStyle(4, 0x1b1530));
    parts.push(scene.add.rectangle(0, 30, width - 40, 22, 0xffffff, 0.5).setRounded(8));
    parts.push(scene.add.rectangle(0, 6, width + 8, 12, 0xffffff).setRounded(6).setStrokeStyle(3, 0x1b1530));
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

function drawSpace(scene, layer) {
  const stars = [];
  for (let i = 0; i < 120; i += 1) {
    stars.push(scene.add.circle(-300 + Math.random() * 2600, -650 + Math.random() * 2000, 1 + Math.random() * 3, 0xffffff, 0.4 + Math.random() * 0.6));
  }
  addAll(layer, [
    ...stars,
    scene.add.circle(1650, 200, 160, 0xff9a3c),
    scene.add.ellipse(1650, 200, 460, 70, 0xffc93c, 0).setStrokeStyle(10, 0xffc93c, 0.8),
    scene.add.circle(320, 300, 70, 0x3fa7ff),
  ]);
}

// De noche (Casa embrujada y Ciudad, si no hay imagen): luna, estrellas y edificios a lo lejos.
function drawNight(scene, layer) {
  const stars = [];
  for (let i = 0; i < 60; i += 1) stars.push(scene.add.circle(-200 + Math.random() * 2400, -400 + Math.random() * 900, 1 + Math.random() * 2, 0xffffff, 0.8));
  const buildings = [];
  for (let x = -200; x < 2300; x += 160) {
    const h = 300 + ((x * 37) % 260);
    buildings.push(scene.add.rectangle(x, 1100 - h / 2, 140, h, 0x14183a));
  }
  addAll(layer, [...stars, scene.add.circle(1650, 120, 90, 0xfff6c8), ...buildings]);
}

// La torre de nubes: el cielo de un azul más oscuro mientras más arriba, con nubes por todos lados.
function drawTower(scene, layer) {
  const sky = scene.add.graphics();
  sky.fillGradientStyle(0x5a8ad8, 0x5a8ad8, 0xc8e8ff, 0xc8e8ff, 1, 1, 1, 1);
  sky.fillRect(-1000, -2600, 4000, 4200);
  const spots = [];
  for (let i = 0; i < 14; i += 1) spots.push([-100 + ((i * 433) % 2200), -1500 + i * 190, 0.6 + (i % 3) * 0.3]);
  addAll(layer, [sky, ...clouds(scene, spots, 0.55)]);
}

function drawVolcano(scene, layer) {
  addAll(layer, [
    scene.add.triangle(1000, 900, 0, 600, 500, 0, 1000, 600, 0x5a1f22).setOrigin(0.5, 1),
    scene.add.triangle(1000, 330, 0, 60, 40, 0, 80, 60, 0xff7a2f).setOrigin(0.5, 1),
    ...clouds(scene, [[600, 150, 1], [1400, 220, 0.9]], 0.25),
  ]);
}

function drawLava(scene, layer) {
  const bubbles = [];
  for (let i = 0; i < 8; i += 1) {
    const bubble = scene.add.circle(-100 + i * 300, 1160, 26, 0xffb13c, 0.8);
    scene.tweens.add({ targets: bubble, y: 1135, alpha: 0.2, duration: 900 + i * 130, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    bubbles.push(bubble);
  }
  addAll(layer, [
    scene.add.rectangle(1000, 1420, 4000, 560, 0xe8501f),
    scene.add.rectangle(1000, 1150, 4000, 24, 0xffb13c),
    ...bubbles,
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

// Lomitas verdes a lo lejos (la Granja y el paisaje del tren).
function hills(scene, y, colors) {
  return [-200, 350, 900, 1450, 2000].map((x, i) => scene.add.ellipse(x, y, 900, 420, colors[i % colors.length]));
}

// La granja: el sol, lomas, el granero rojo, el silo y un molino que da vueltas.
function drawFarm(scene, layer) {
  const blades = scene.add.container(1640, 360);
  for (let k = 0; k < 4; k += 1) blades.add(scene.add.rectangle(0, 0, 230, 34, 0xfff6e5).setOrigin(0, 0.5).setStrokeStyle(4, 0x8b5a2b).setAngle(k * 90));
  blades.add(scene.add.circle(0, 0, 18, 0x8b5a2b));
  scene.tweens.add({ targets: blades, angle: 360, duration: 9000, repeat: -1 });
  addAll(layer, [
    scene.add.circle(300, 150, 80, 0xfff1b8, 0.95),
    ...clouds(scene, [[700, 120, 1], [1500, 180, 0.9], [-100, 260, 0.8]], 0.8),
    ...hills(scene, 900, [0x7fd06a, 0x6cc24a]),
    // El granero, con su techo y su puerta en X.
    scene.add.rectangle(560, 640, 360, 330, 0xd64541).setStrokeStyle(6, 0x1b1530),
    scene.add.triangle(560, 475, 0, 120, 200, 0, 400, 120, 0x8a3030).setOrigin(0.5, 1).setStrokeStyle(6, 0x1b1530),
    scene.add.rectangle(560, 720, 150, 170, 0xffffff).setStrokeStyle(6, 0x1b1530),
    scene.add.rectangle(560, 720, 200, 10, 0xd64541).setAngle(48),
    scene.add.rectangle(560, 720, 200, 10, 0xd64541).setAngle(-48),
    // El silo.
    scene.add.rectangle(820, 600, 130, 420, 0xb8c4d0).setStrokeStyle(6, 0x1b1530),
    scene.add.ellipse(820, 390, 130, 90, 0x8a96a8).setStrokeStyle(6, 0x1b1530),
    // El molino.
    scene.add.triangle(1640, 820, 0, 460, 60, 0, 120, 460, 0xc98b4f).setOrigin(0.5, 1).setStrokeStyle(5, 0x5c3a1a),
    blades,
  ]);
}

// El paisaje que ve el tren: cielo de tarde, montañas y el pasto de abajo con las vías.
function drawCountry(scene, layer) {
  const sky = scene.add.graphics();
  sky.fillGradientStyle(0xffb36b, 0xffb36b, 0xffe6b8, 0xffe6b8, 1, 1, 1, 1);
  sky.fillRect(-600, -700, 3200, 1800);
  addAll(layer, [
    sky,
    scene.add.circle(1500, 330, 120, 0xfff1b8, 0.95),
    scene.add.triangle(200, 900, 0, 520, 420, 0, 840, 520, 0x8a7ab0).setOrigin(0.5, 1),
    scene.add.triangle(900, 900, 0, 420, 360, 0, 720, 420, 0x9d8fc6).setOrigin(0.5, 1),
    scene.add.triangle(1700, 900, 0, 560, 460, 0, 920, 560, 0x8a7ab0).setOrigin(0.5, 1),
    ...hills(scene, 1050, [0x8fd06a, 0x7fc25a]),
    scene.add.rectangle(1000, 1300, 4000, 500, 0x6cb04a),
  ]);
}

// Lo que pasa junto al tren (siempre, aunque haya imagen de fondo): las vías, los durmientes, postes y arbustos.
// Cada fila es un contenedor que se recorre hacia la izquierda lo de un hueco y vuelve a empezar (parece que no acaba).
function drawTrainRide(scene, layer) {
  const row = (gap, speed, make) => {
    const strip = scene.add.container(0, 0);
    for (let x = -800; x < 3000; x += gap) strip.add(make(x));
    scene.tweens.add({ targets: strip, x: -gap, duration: (gap / speed) * 1000, repeat: -1 });
    return strip;
  };
  const posts = row(560, 520, (x) =>
    scene.add.container(x, 0, [
      scene.add.rectangle(0, 830, 16, 470, 0x6b4223).setStrokeStyle(3, 0x3a2414),
      scene.add.rectangle(0, 620, 90, 12, 0x6b4223).setStrokeStyle(3, 0x3a2414),
    ]),
  );
  const bushes = row(380, 760, (x) => scene.add.ellipse(x, 1062, 150, 70, 0x4f9a3a).setStrokeStyle(4, 0x2f6a2a));
  const ties = row(70, 1100, (x) => scene.add.rectangle(x, 1088, 18, 22, 0x6b4223));
  addAll(layer, [posts, bushes, ties, scene.add.rectangle(1000, 1080, 4000, 8, 0x5a5a6a), scene.add.rectangle(1000, 1094, 4000, 8, 0x5a5a6a)]);
}

// La feria: banderitas, carpas de rayas y globos que suben.
function drawFair(scene, layer) {
  const flags = [];
  const colors = [0xff5a5f, 0xffd02a, 0x3fa7ff, 0x4cd97b];
  for (const [y, from, to] of [[180, -100, 900], [220, 1100, 2100]]) {
    for (let x = from, k = 0; x < to; x += 60, k += 1) {
      flags.push(scene.add.triangle(x, y + Math.sin(x / 200) * 20, 0, 0, 40, 0, 20, 36, colors[k % colors.length]).setOrigin(0.5, 0));
    }
  }
  const tents = [];
  for (const [x, color] of [[160, 0x3fa7ff], [1840, 0xb07cff]]) {
    tents.push(scene.add.rectangle(x, 700, 300, 200, 0xffffff).setStrokeStyle(5, 0x1b1530));
    for (let k = -1; k <= 1; k += 1) tents.push(scene.add.rectangle(x + k * 100, 700, 50, 200, color));
    tents.push(scene.add.triangle(x, 600, 0, 140, 170, 0, 340, 140, color).setOrigin(0.5, 1).setStrokeStyle(5, 0x1b1530));
  }
  const balloons = [0xff5a5f, 0xffd02a, 0x4cd97b, 0xff5fd2].map((color, i) => {
    const balloon = scene.add.container(300 + i * 450, 1100, [scene.add.rectangle(0, 50, 2, 70, 0x1b1530), scene.add.ellipse(0, 0, 50, 62, color).setStrokeStyle(3, 0x1b1530)]);
    scene.tweens.add({ targets: balloon, y: -500, duration: 14000 + i * 1500, delay: i * 2600, repeat: -1 });
    return balloon;
  });
  addAll(layer, [scene.add.circle(1700, 120, 80, 0xfff1b8, 0.95), ...clouds(scene, [[500, 300, 0.8], [1450, 380, 0.7]], 0.7), ...flags, ...tents, ...balloons]);
}

// La rueda de la fortuna (siempre, aunque haya imagen de fondo): las patas, el aro y el centro. Los rayos que van a
// cada canastilla los dibuja la canastilla misma (ver 'cabin' y movePlatforms), así giran exacto con ella. Las
// canastillas cuelgan de su gancho, así que el centro de la rueda está a esa altura arriba de donde dan vueltas.
function drawWheel(scene, layer) {
  const cx = 1000;
  const cy = 470 - CABIN_HOOK;
  const radius = 255;
  const legs = scene.add.graphics();
  legs.lineStyle(18, 0x8a90a8, 1);
  legs.lineBetween(cx, cy, cx - 190, 800);
  legs.lineBetween(cx, cy, cx + 190, 800);
  addAll(layer, [
    legs,
    scene.add.circle(cx, cy, radius).setStrokeStyle(10, 0xd8dce8),
    scene.add.circle(cx, cy, radius - 50).setStrokeStyle(5, 0xffffff, 0.8),
    scene.add.circle(cx, cy, 30, 0xffd02a).setStrokeStyle(5, 0x1b1530),
  ]);
}
