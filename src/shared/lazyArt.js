// Los fondos (dibujos de hasta 1600 px que, ya abiertos, ocupan más de 5 MB cada uno) se bajan solo cuando hacen
// falta y se sueltan al regresar al menú: en el Xbox One S la memoria es poca y antes cada juego cargaba todos los
// fondos de todos los juegos aunque usara uno.
//   queueImage(scene, key, url)            en preload(): que se cargue con lo demás.
//   lazyImage(scene, key, url, onReady)    ya jugando: si no está, lo baja y llama `onReady` cuando llega (mientras,
//                                          el juego dibuja el fondo de figuras). Devuelve si ya estaba.
//   releaseBackgrounds(game)               al volver al menú: suelta todos los fondos.
export function queueImage(scene, key, url) {
  if (!scene.textures.exists(key)) scene.load.image(key, url);
}

export function lazyImage(scene, key, url, onReady = null) {
  if (scene.textures.exists(key)) return true;
  if (onReady) {
    scene.load.once(`filecomplete-image-${key}`, () => {
      // (Si el juego ya se cerró, no hay nada que redibujar.)
      if (scene.sys.isActive()) onReady(key);
    });
  }
  scene.load.image(key, url);
  if (!scene.load.isLoading()) scene.load.start();
  return false;
}

export function releaseBackgrounds(game) {
  for (const key of game.textures.getTextureKeys()) {
    if (key.includes(':fondo-')) game.textures.remove(key);
  }
}
