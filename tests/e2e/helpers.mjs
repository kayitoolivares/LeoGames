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
  // En GitHub no hay tarjeta de video: el 3D se dibuja por software (SwiftShader). En la compu, Edge sin ventana y
  // sin sonido (si no, el narrador se oye por las bocinas mientras corren las pruebas).
  const browser = await chromium.launch(
    process.env.CI
      ? { headless: true, args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--mute-audio'] }
      : { channel: 'msedge', headless: true, args: ['--mute-audio'] },
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

// Las páginas abiertas: si una prueba falla antes de cerrar la suya, se cierra al terminar la prueba (si no, el juego
// se queda corriendo en el fondo y hace lentísimas todas las pruebas que siguen).
const openContexts = new Set();

export async function closeOpenPages() {
  for (const context of openContexts) await context.close().catch(() => {});
  openContexts.clear();
}

// Una página con controles falsos. Devuelve atajos para apretar botones y leer el estado del juego.
export async function openPage(game, { touch = false } = {}) {
  const context = await game.browser.newContext(
    touch ? { viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true } : { viewport: { width: 1280, height: 720 } },
  );
  openContexts.add(context);
  context.on('close', () => openContexts.delete(context));
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await page.addInitScript(() => {
    // La voz del navegador habla por las bocinas de Windows aunque la página no tenga sonido: en las pruebas, calladita
    // (la frase igual se anota en el registro de la voz).
    if (window.speechSynthesis) window.speechSynthesis.speak = () => {};
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
  // Espera a que el juego dibuje `count` cuadros más: en GitHub (sin tarjeta de video) puede ir a pocos
  // cuadros por segundo, y un botón que se suelta antes de que el juego lo lea es como no apretarlo.
  const frames = async (count = 2) => {
    const start = await page.evaluate(() => window.leogames.loop.frame);
    await page.waitForFunction(([s, n]) => window.leogames.loop.frame >= s + n, [start, count], { timeout: 30000 });
  };
  const tap = async (pad, button, holdMs = 100) => {
    await page.evaluate(([p, b]) => window.__button(p, b, true), [pad, button]);
    await wait(holdMs);
    await frames();
    await page.evaluate(([p, b]) => window.__button(p, b, false), [pad, button]);
    await frames();
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
  // Mantiene apretados unos botones hasta que pase algo (salir con Y, empezar con A...).
  const holdUntil = async (pad, buttons, fn, label, timeoutMs = 30000) => {
    for (const b of buttons) await page.evaluate(([p, x]) => window.__button(p, x, true), [pad, b]);
    try {
      await until(fn, timeoutMs, label);
    } finally {
      for (const b of buttons) await page.evaluate(([p, x]) => window.__button(p, x, false), [pad, b]);
      await frames();
    }
  };
  const holdToMenu = (pad, buttons, label) => holdUntil(pad, buttons, () => window.leogames.scene.isActive('Menu'), label);
  // Une a N jugadores y pasa al menú (el Jugador 1 mantiene A).
  const joinPlayers = async (count) => {
    for (let i = 0; i < count; i += 1) {
      await page.evaluate((p) => window.__connect(p), i);
      await tap(i, BUTTON.A);
    }
    await holdToMenu(0, [BUTTON.A], 'llegar al menú');
  };
  // Mueve la selección del menú hasta la tarjeta con ese título y entra.
  const openGameCard = async (title) => {
    const titles = await page.evaluate(() => import('/src/games.js').then((m) => m.GAMES.map((g) => g.title)));
    for (let i = 0; i < titles.length; i += 1) {
      const selected = await page.evaluate(() => window.leogames.scene.getScene('Menu').selected);
      if (titles[selected] === title) break;
      await tap(0, BUTTON.RIGHT);
    }
    await tap(0, BUTTON.A);
  };
  // En la pantalla "Personajes" (antes de Pelea en equipo y Fútbol) los primeros `count` controles dan A.
  const pickCharacters = async (count) => {
    await page.waitForFunction(() => window.leogames.scene.isActive('Personajes'), null, { timeout: 30000 });
    for (let i = 0; i < count; i += 1) await tap(i, BUTTON.A);
  };
  return { page, context, errors, wait, frames, tap, scenes, until, holdUntil, holdToMenu, joinPlayers, openGameCard, pickCharacters };
}
