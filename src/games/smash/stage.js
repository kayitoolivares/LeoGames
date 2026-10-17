// Escenario "Castillo" (coordenadas del mundo, que es más grande que la pantalla).
// `soft`: plataformas que se atraviesan desde abajo y de las que se baja con ↓.
export const PLATFORMS = [
  { left: 380, right: 1620, top: 800, soft: false, main: true },
  { left: 560, right: 860, top: 620, soft: true },
  { left: 1140, right: 1440, top: 620, soft: true },
  { left: 850, right: 1150, top: 450, soft: true },
];

// Salirse de esta zona es perder una vida.
export const BLAST_ZONE = { left: -250, right: 2250, top: -450, bottom: 1400 };

export const RESPAWN = { x: 1000, y: 260 };

// Puntos que la cámara siempre trata de mostrar, para que no se pierda el escenario.
export const STAGE_FOCUS = [
  { x: 500, y: 760 },
  { x: 1500, y: 760 },
];

export function drawStage(scene, layer) {
  const add = (object) => {
    layer.add(object);
    return object;
  };

  // Fondo: sol, nubes y un castillo a lo lejos.
  add(scene.add.circle(1650, 120, 90, 0xfff1b8, 0.9));
  for (const [x, y, s] of [[200, 160, 1], [700, 90, 1.3], [1250, 210, 0.9], [1900, 140, 1.1], [-100, 320, 1]]) {
    for (const [dx, dy, r] of [[0, 0, 50], [55, 10, 40], [-50, 12, 38], [20, -25, 42]]) {
      add(scene.add.circle(x + dx * s, y + dy * s, r * s, 0xffffff, 0.85));
    }
  }
  const castle = 0x9d8fd6;
  add(scene.add.rectangle(1000, 640, 520, 300, castle));
  for (const x of [760, 1240]) {
    add(scene.add.rectangle(x, 560, 110, 460, castle));
    add(scene.add.triangle(x, 330, 0, 60, 60, 0, 120, 60, 0xb07cff).setOrigin(0.5, 1));
  }
  add(scene.add.rectangle(1000, 470, 150, 380, castle));
  add(scene.add.triangle(1000, 280, 0, 80, 80, 0, 160, 80, 0xb07cff).setOrigin(0.5, 1));
  add(scene.add.rectangle(1000, 735, 90, 130, 0x6f62a8).setRounded(40));

  for (const p of PLATFORMS) {
    const width = p.right - p.left;
    const cx = (p.left + p.right) / 2;
    if (p.main) {
      // Isla flotante: tierra con pasto encima y una punta hacia abajo.
      add(scene.add.triangle(cx, p.top + 40, 0, 0, width, 0, width / 2, 260, 0x8b5a2b).setOrigin(0.5, 0));
      add(scene.add.rectangle(cx, p.top + 40, width, 80, 0x9c6b3c).setRounded(20));
      add(scene.add.rectangle(cx, p.top + 10, width + 10, 26, 0x4cd97b).setRounded(13));
    } else {
      add(scene.add.rectangle(cx, p.top + 12, width, 24, 0xc98b4f).setRounded(12).setStrokeStyle(4, 0x8b5a2b));
    }
  }
}
