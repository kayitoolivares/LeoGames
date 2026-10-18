// Ayudantes para las pruebas: levantan el juego con Vite, abren un navegador sin ventana y simulan
// controles de Xbox (reemplazando navigator.getGamepads) o una pantalla táctil.
// En la compu se usa el Edge instalado; en GitHub Actions, el Chromium de Playwright.
import { chromium } from 'playwright-core';
import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const BUTTON = { A: 0, B: 1, X: 2, Y: 3, LB: 4, RB: 5, LT: 6, RT: 7, UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15 };

export async function startGame() {
  const server = await createServer({ root: ROOT, logLevel: 'error', server: { port: 5199, strictPort: false } });
  await server.listen();
  const url = server.resolvedUrls.local[0];
  // En GitHub no hay tarjeta de video: el 3D se dibuja por software (SwiftShader).
  const browser = await chromium.launch(
    process.env.CI
      ? { headless: true, args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] }
      : { channel: 'msedge', headless: true },
  );
  return {
    url,
    browser,
    async stop() {
      await browser.close();
      await server.close();
    },
  };
}

// Una página con controles falsos. Devuelve atajos para apretar botones y leer el estado del juego.
export async function openPage(game, { touch = false } = {}) {
  const context = await game.browser.newContext(
    touch ? { viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true } : { viewport: { width: 1280, height: 720 } },
  );
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await page.addInitScript(() => {
    const makePad = (index) => ({
      index, id: `prueba ${index + 1}`, connected: true, mapping: 'standard', timestamp: 0,
      buttons: Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 })),
      axes: [0, 0, 0, 0],
    });
    window.__pads = [null, null, null, null];
    navigator.getGamepads = () => window.__pads;
    window.__connect = (i) => (window.__pads[i] = makePad(i));
    window.__button = (i, b, down) => {
      window.__pads[i].buttons[b].pressed = down;
      window.__pads[i].buttons[b].value = down ? 1 : 0;
    };
    window.__release = () => {
      for (const pad of window.__pads) if (pad) pad.buttons.forEach((b) => ((b.pressed = false), (b.value = 0)));
    };
  });
  // Recargas de Vite al optimizar dependencias la primera vez: se espera a que el juego quede estable.
  await page.goto(game.url);
  await page.waitForFunction(() => window.leogames?.scene?.isActive('Join'), null, { timeout: 30000 });
  await page.waitForTimeout(800);

  const wait = (ms) => page.waitForTimeout(ms);
  const tap = async (pad, button, holdMs = 100) => {
    await page.evaluate(([p, b]) => window.__button(p, b, true), [pad, button]);
    await wait(holdMs);
    await page.evaluate(([p, b]) => window.__button(p, b, false), [pad, button]);
    await wait(160);
  };
  const scenes = () => page.evaluate(() => window.leogames.scene.getScenes(true).map((s) => s.sys.settings.key).join(','));
  const until = async (fn, timeoutMs, label) => {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      if (await page.evaluate(fn)) return;
      await wait(250);
    }
    throw new Error(`No pasó a tiempo: ${label}`);
  };
  // Une a N jugadores y pasa al menú (el Jugador 1 mantiene A).
  const joinPlayers = async (count) => {
    for (let i = 0; i < count; i += 1) {
      await page.evaluate((p) => window.__connect(p), i);
      await tap(i, BUTTON.A);
    }
    await tap(0, BUTTON.A, 1300);
    await until(() => window.leogames.scene.isActive('Menu'), 5000, 'llegar al menú');
  };
  // Mueve la selección del menú hasta la tarjeta con ese título y entra.
  const openGameCard = async (title) => {
    for (let i = 0; i < 12; i += 1) {
      const selected = await page.evaluate(() => window.leogames.scene.getScene('Menu').selected);
      const titles = await page.evaluate(() => import('/src/games.js').then((m) => m.GAMES.map((g) => g.title)));
      if (titles[selected] === title) break;
      await tap(0, BUTTON.RIGHT);
    }
    await tap(0, BUTTON.A);
  };
  return { page, context, errors, wait, tap, scenes, until, joinPlayers, openGameCard };
}
