import { defineConfig } from 'vite';

export default defineConfig({
  // Rutas relativas para que funcione igual en localhost y en GitHub Pages (/LeoGames/).
  base: './',
  build: {
    // Phaser pesa ~1.5 MB; no es un problema para este proyecto.
    chunkSizeWarningLimit: 2000,
  },
});
