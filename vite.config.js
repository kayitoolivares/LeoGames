import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { defineConfig } from 'vite';

// Jugando en la compu (npm run dev, y en las pruebas), cada frase que dice la voz llega aquí y se anota en
// tools/voz/oidas.txt, para grabarla después con la voz del locutor (ver tools/voz.mjs).
function voiceLog() {
  return {
    name: 'voz-oidas',
    apply: 'serve',
    configureServer(server) {
      const file = path.join(server.config.root, 'tools/voz/oidas.txt');
      const heard = new Set(existsSync(file) ? readFileSync(file, 'utf8').split('\n') : []);
      server.middlewares.use('/__voz', (req, res) => {
        let body = '';
        req.on('data', (chunk) => (body += chunk));
        req.on('end', () => {
          const line = body.replace(/\s+/g, ' ').trim();
          if (line && !heard.has(line)) {
            heard.add(line);
            mkdirSync(path.dirname(file), { recursive: true });
            appendFileSync(file, `${line}\n`);
          }
          res.statusCode = 204;
          res.end();
        });
      });
    },
  };
}

export default defineConfig({
  // Rutas relativas para que funcione igual en localhost y en GitHub Pages (/LeoGames/).
  base: './',
  build: {
    // Phaser pesa ~1.5 MB; no es un problema para este proyecto.
    chunkSizeWarningLimit: 2000,
  },
  plugins: [voiceLog()],
});
