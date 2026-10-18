// Medidas de la cancha (vista de lado, 1280x720). El piso es donde se paran todos; las porterías están
// en las orillas: el balón que pasa completito la línea de la portería (debajo del travesaño) es gol.
export const FIELD = { width: 1280, ground: 650 };
export const GOAL = { depth: 90, height: 210, bar: 7 };
export const BAR_Y = FIELD.ground - GOAL.height;
export const TEAM_COLORS = [0x3fa7ff, 0xff5a5f];
export const TEAM_NAMES = ['Azules', 'Rojos'];

// La portería de cada equipo: 0 = izquierda (la defienden los Azules), 1 = derecha.
export function goalMouthX(team) {
  return team === 0 ? GOAL.depth : FIELD.width - GOAL.depth;
}

// Hacia dónde ataca cada equipo (+1 = a la derecha).
export function attackDir(team) {
  return team === 0 ? 1 : -1;
}

// Dibuja la red (atrás de todos) y los postes con el travesaño (adelante), pintados del color del equipo.
export function drawGoals(scene) {
  for (const team of [0, 1]) {
    const left = team === 0 ? 0 : FIELD.width - GOAL.depth;
    const mouth = goalMouthX(team);
    const net = scene.add.graphics().setDepth(-10);
    net.fillStyle(0xffffff, 0.18);
    net.fillRect(left, BAR_Y, GOAL.depth, GOAL.height);
    net.lineStyle(2, 0xffffff, 0.55);
    for (let x = left; x <= left + GOAL.depth; x += 15) net.lineBetween(x, BAR_Y, x, FIELD.ground);
    for (let y = BAR_Y; y <= FIELD.ground; y += 15) net.lineBetween(left, y, left + GOAL.depth, y);
    const frame = scene.add.graphics().setDepth(500);
    frame.fillStyle(0xffffff, 1);
    frame.fillRect(left, BAR_Y - GOAL.bar, GOAL.depth, GOAL.bar * 2);
    frame.fillRect(mouth - GOAL.bar, BAR_Y - GOAL.bar, GOAL.bar * 2, GOAL.height + GOAL.bar);
    frame.fillStyle(TEAM_COLORS[team], 1);
    for (let y = BAR_Y + 20; y < FIELD.ground; y += 50) frame.fillRect(mouth - GOAL.bar, y, GOAL.bar * 2, 22);
  }
}
