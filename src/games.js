// Catálogo del menú. `scene` es la escena de Phaser que se abre;
// los juegos que todavía no existen quedan como "Próximamente" (scene: null).
export const GAMES = [
  { title: 'Modo Bebé', emoji: '👶', description: 'Aprieta botones:\ncolores y sonidos', scene: null },
  { title: 'Pelea en equipo', emoji: '👊', description: 'Todos juntos contra\nlos monstruos', scene: null },
  { title: 'Carreras', emoji: '🏎️', description: '¡A toda\nvelocidad!', scene: null },
  { title: 'Prueba de controles', emoji: '🔧', description: 'Revisa que se vean\ntodos los controles', scene: 'PadTest' },
];
