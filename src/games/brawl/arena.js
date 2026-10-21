// Zona donde se puede caminar en Pelea en equipo (coordenadas del mundo). El nivel son tramos de SECTION_W de ancho,
// uno por ronda; `setSection` mueve las orillas al tramo que toca (el nivel avanza hacia la derecha).
export const SECTION_W = 1280;
export const ARENA = { left: 50, right: 1230, top: 360, bottom: 690 };

export function setSection(index) {
  ARENA.left = index * SECTION_W + 50;
  ARENA.right = index * SECTION_W + SECTION_W - 50;
}
