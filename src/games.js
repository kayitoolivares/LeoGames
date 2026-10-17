// Catálogo del menú. `scene` es la escena que se abre; `url` abre otro juego en el navegador
// (sale de LeoGames); los que todavía no existen quedan como "Próximamente" (scene: null).
export const GAMES = [
  { title: 'Pelea en equipo', emoji: '👊', description: 'Todos juntos contra\nlos monstruos', scene: 'Brawl' },
  { title: 'Bolitas Bros', emoji: '🥊', description: 'Sácalos de la pantalla\n¡estilo Smash!', scene: 'SmashSelect' },
  { title: 'Karts locos', emoji: '🏁', description: 'Nitro, cajitas\ny poderes', scene: 'Kart' },
  { title: 'Carreras', emoji: '🏎️', description: 'Vista desde arriba,\n¡a toda velocidad!', scene: 'Race' },
  { title: 'Halcón de Acero', emoji: '✈️', description: 'Combate aéreo 3D\n(se abre aparte)', url: 'https://hda.grupomegarey.mx/' },
  { title: 'Modo Bebé', emoji: '👶', description: 'Aprieta botones:\ncolores y sonidos', scene: null },
  { title: 'Prueba de controles', emoji: '🔧', description: 'Revisa que se vean\ntodos los controles', scene: 'PadTest' },
];
