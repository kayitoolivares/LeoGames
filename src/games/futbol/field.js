// Medidas de la cancha (vista de lado, 1280x720). El piso es donde se paran todos; las porterías están
// en las orillas: el balón que pasa completito la línea de la portería (debajo del travesaño) es gol.
export const FIELD = { width: 1280, ground: 650 };
export const GOAL = { depth: 90, height: 210, bar: 7 };

// Los uniformes que se pueden escoger (color y nombre; `article`: "las Ranas", si no "los"). Cada equipo trae uno distinto.
export const UNIFORMS = [
  { name: 'Tiburones', color: 0x3fa7ff },
  { name: 'Dragones', color: 0xff5a5f },
  { name: 'Ranas', color: 0x4cd97b, article: 'las' },
  { name: 'Abejas', color: 0xffc93c, article: 'las' },
  { name: 'Pulpos', color: 0xb07cff },
  { name: 'Tigres', color: 0xff8a1e },
];
// Lo que trae cada equipo en este partido (se cambia antes de empezar; los demás archivos leen de aquí).
export const TEAM_COLORS = [UNIFORMS[0].color, UNIFORMS[1].color];
export const TEAM_NAMES = [UNIFORMS[0].name, UNIFORMS[1].name];
// "los Tiburones", "las Ranas": el nombre con su artículo.
export const TEAM_LABELS = [teamLabel(0), teamLabel(1)];

export function teamLabel(index) {
  return `${UNIFORMS[index].article ?? 'los'} ${UNIFORMS[index].name}`;
}

export function setUniforms(left, right) {
  TEAM_COLORS[0] = UNIFORMS[left].color;
  TEAM_NAMES[0] = UNIFORMS[left].name;
  TEAM_LABELS[0] = teamLabel(left);
  TEAM_COLORS[1] = UNIFORMS[right].color;
  TEAM_NAMES[1] = UNIFORMS[right].name;
  TEAM_LABELS[1] = teamLabel(right);
}

// El alto de cada portería: el poder "portería chiquita" encoge la del rival un rato.
export const GOAL_HEIGHT = [GOAL.height, GOAL.height];

// Dónde está el travesaño de la portería de cada equipo.
export function barY(team) {
  return FIELD.ground - GOAL_HEIGHT[team];
}
// (El de siempre, para lo que no cambia.)
export const BAR_Y = FIELD.ground - GOAL.height;

// La portería de cada equipo: 0 = izquierda (la defiende el equipo 0), 1 = derecha.
export function goalMouthX(team) {
  return team === 0 ? GOAL.depth : FIELD.width - GOAL.depth;
}

// Hacia dónde ataca cada equipo (+1 = a la derecha).
export function attackDir(team) {
  return team === 0 ? 1 : -1;
}

// Dibuja la red (atrás de todos) y los postes con el travesaño (adelante), pintados del color del equipo.
// Devuelve las redes (para moverlas con el gol) y todo lo dibujado (para rehacerlas si cambia el tamaño).
export function drawGoals(scene) {
  const nets = [];
  const parts = [];
  for (const team of [0, 1]) {
    const left = team === 0 ? 0 : FIELD.width - GOAL.depth;
    const mouth = goalMouthX(team);
    const top = barY(team);
    const height = GOAL_HEIGHT[team];
    const net = scene.add.graphics().setDepth(-10);
    net.fillStyle(0xffffff, 0.18);
    net.fillRect(left, top, GOAL.depth, height);
    net.lineStyle(2, 0xffffff, 0.55);
    for (let x = left; x <= left + GOAL.depth; x += 15) net.lineBetween(x, top, x, FIELD.ground);
    for (let y = top; y <= FIELD.ground; y += 15) net.lineBetween(left, y, left + GOAL.depth, y);
    const frame = scene.add.graphics().setDepth(500);
    frame.fillStyle(0xffffff, 1);
    frame.fillRect(left, top - GOAL.bar, GOAL.depth, GOAL.bar * 2);
    frame.fillRect(mouth - GOAL.bar, top - GOAL.bar, GOAL.bar * 2, height + GOAL.bar);
    frame.fillStyle(TEAM_COLORS[team], 1);
    for (let y = top + 20; y < FIELD.ground; y += 50) frame.fillRect(mouth - GOAL.bar, y, GOAL.bar * 2, 22);
    nets.push(net);
    parts.push(net, frame);
  }
  return { nets, parts };
}
