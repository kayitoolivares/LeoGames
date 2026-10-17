// Colores y tipografía compartidos por todas las pantallas.
// Se usa la fuente del sistema (Segoe UI existe en Windows y en Xbox), así no hay que descargar nada.

export const FONT = '"Segoe UI", "Trebuchet MS", Arial, sans-serif';

// Colores de figuras (números) y de texto (CSS), porque Phaser pide uno u otro.
export const COLORS = {
  bg: 0x14112b,
  panel: 0x231d45,
  panelBorder: 0x3a3170,
  ink: 0x1b1530,
  accent: 0xffc93c,
  ok: 0x4cd97b,
};

export const TEXT = {
  normal: '#ffffff',
  muted: '#a9a3d6',
  accent: '#ffc93c',
  ink: '#1b1530',
};

export function textStyle(size, color = TEXT.normal, extra = {}) {
  // resolution 2 para que el texto se vea nítido cuando la pantalla escala a 1080p.
  return { fontFamily: FONT, fontSize: `${size}px`, color, resolution: 2, ...extra };
}

export function hexToCss(hex) {
  return `#${hex.toString(16).padStart(6, '0')}`;
}
