// Catálogo del menú. `scene` es la escena que se abre; `url` abre otro juego en el navegador
// (sale de LeoGames); los que todavía no existen quedan como "Próximamente" (scene: null).
// `pick`: antes de jugar cada quien escoge personaje (pantalla "Personajes").
export const GAMES = [
  { title: 'Pelea en equipo', emoji: '👊', description: 'Todos juntos contra\nlos monstruos', scene: 'Brawl', pick: true },
  { title: 'Bolitas Bros', emoji: '🥊', description: 'Sácalos de la pantalla\n¡estilo Smash!', scene: 'SmashSelect' },
  { title: 'Súper Bolitas', emoji: '🍄', description: 'Saltos, monedas y jefes\n¡todos juntos!', scene: 'Plat', pick: true },
  { title: 'Karts locos', emoji: '🏁', description: 'Nitro, cajitas\ny poderes', scene: 'Kart' },
  { title: 'Carreras', emoji: '🏎️', description: 'Vista desde arriba,\n¡a toda velocidad!', scene: 'Race', pick: true },
  { title: 'Fútbol de bolitas', emoji: '⚽', description: 'Azules contra Rojos\n¡a meter goles!', scene: 'Futbol', pick: true },
  { title: 'Duelo de bolitas', emoji: '🥋', description: 'Uno contra uno\n¡estilo Street Fighter!', scene: 'Duelo', pick: true },
  { title: 'Minigolf', emoji: '⛳', description: 'Molinos, rampas\ny portales', scene: 'Golf', pick: true },
  { title: 'Halcón de Acero', emoji: '✈️', description: 'Combate aéreo 3D\n(se abre aparte)', url: 'https://hda.grupomegarey.mx/' },
  { title: 'Modo Bebé', emoji: '👶', description: 'Aprieta botones:\ncolores y sonidos', scene: 'Baby' },
  { title: 'Mis premios', emoji: '🏆', description: 'Tus calcomanías\ny lo que desbloqueas', scene: 'Premios', badge: 'Ver' },
  { title: 'Cómo jugar', emoji: '⌨️', description: 'Teclas del teclado\ny botones de cada juego', scene: 'Controles', badge: 'Ver' },
];
