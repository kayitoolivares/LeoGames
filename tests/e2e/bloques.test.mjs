// Pruebas del Mundo de bloques: bots que escarban, ponen bloques, hacen cosas y duermen, con controles simulados.
import { after, afterEach, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { BUTTON, closeOpenPages, openPage, startGame } from './helpers.mjs';

// En GitHub no hay tarjeta de video y el juego va más lento: se le da más tiempo a todo.
const SLOW = process.env.CI ? 4 : 1;
const ms = (value) => value * SLOW;
const EXIT = [BUTTON.LB, BUTTON.RB, BUTTON.Y];
const DIRT = 2;
const AIR = 0;

let game;
before(async () => {
  game = await startGame();
});
afterEach(async () => {
  await closeOpenPages();
});
after(async () => {
  await game?.stop();
});

// Entra al Mundo de bloques con `count` jugadores; en las opciones, `aventura` cambia el modo (la 2a fila).
async function enterWorld(p, count, { aventura = false } = {}) {
  await p.openGameCard('Mundo de bloques');
  await p.pickCharacters(count);
  await p.until(() => window.leogames.scene.getScene('Bloques')?.phase === 'setup', ms(20000), 'las opciones del Mundo de bloques');
  if (aventura) {
    await p.tap(0, BUTTON.DOWN);
    await p.tap(0, BUTTON.RIGHT);
    await p.tap(0, BUTTON.UP);
  }
  await p.wait(400);
  await p.tap(0, BUTTON.A);
  await p.until(() => window.leogames.scene.getScene('Bloques')?.phase === 'play', ms(20000), 'empezar a jugar');
  await p.wait(500);
}

const stick = (p, pad, x, y) =>
  p.page.evaluate(
    ([i, sx, sy]) => {
      window.__pads[i].axes[0] = sx;
      window.__pads[i].axes[1] = sy;
    },
    [pad, x, y],
  );
const dirtOf = (p) => p.page.evaluate((id) => window.leogames.scene.getScene('Bloques').blockPlayers[0].count(id), DIRT);

test('mundo de bloques: escarbar, juntar, poner un bloque y que el mundo se guarde', { timeout: ms(150000) }, async () => {
  const p = await openPage(game);
  await p.joinPlayers(2);
  await enterWorld(p, 2, { aventura: true });
  const start = await p.page.evaluate(() => {
    const s = window.leogames.scene.getScene('Bloques');
    const q = s.blockPlayers[0];
    // (J2 se hace a un lado, para que no se caiga al mismo hoyo.)
    s.blockPlayers[1].x += 240;
    return { creative: s.creative, players: s.blockPlayers.length, col: Math.floor(q.x / 48), row: Math.floor(q.y / 48), seed: s.seed };
  });
  assert.equal(start.creative, false, 'escogimos Aventura');
  assert.equal(start.players, 2);

  // J1 escarba para abajo (stick ↓ + X) dos bloques: el pasto (sale tierra) y la tierra de abajo.
  await stick(p, 0, 0, 1);
  await p.page.evaluate(([c, r]) => (window.__goal = [c, r + 1]), [start.col, start.row]);
  await p.holdUntil(0, [BUTTON.X], () => window.leogames.scene.getScene('Bloques').world.get(...window.__goal) === 0, 'escarbar dos bloques', ms(20000));
  await stick(p, 0, 0, 0);
  const dug = await p.page.evaluate(([c, r]) => window.leogames.scene.getScene('Bloques').world.get(c, r), [start.col, start.row]);
  assert.equal(dug, AIR, 'el bloque escarbado desaparece');
  // (Lo último que escarbó tarda un ratito en volar a su barrita.)
  await p.wait(900);
  const before = await dirtOf(p);
  assert.ok(before >= 2, 'la tierra llegó a la barrita');

  // Pone un bloque arriba de su cabeza (stick ↑ + B).
  const target = await p.page.evaluate(() => {
    const s = window.leogames.scene.getScene('Bloques');
    return s.blockPlayers[0].targets(s.world, { x: 0, y: -1 }).place;
  });
  await stick(p, 0, 0, -1);
  await p.tap(0, BUTTON.B);
  await stick(p, 0, 0, 0);
  const placed = await p.page.evaluate(([c, r]) => window.leogames.scene.getScene('Bloques').world.get(c, r), [target.col, target.row]);
  assert.equal(placed, DIRT, 'el bloque quedó puesto');
  assert.equal(await dirtOf(p), before - 1, 'se gastó uno');

  // Sale (se guarda solito) y vuelve a entrar al mismo mundo.
  await p.holdToMenu(0, EXIT, 'salir del Mundo de bloques');
  const saved = await p.page.evaluate(() => JSON.parse(localStorage.getItem('leogames:bloquesMundos'))[0]);
  assert.equal(saved.seed, start.seed);
  assert.ok(saved.changes.length > 0, 'se guardaron los cambios');
  await enterWorld(p, 2);
  const again = await p.page.evaluate(
    ([dc, dr, pc, pr]) => {
      const s = window.leogames.scene.getScene('Bloques');
      return { seed: s.seed, creative: s.creative, dug: s.world.get(dc, dr), placed: s.world.get(pc, pr), dirt: s.blockPlayers[0].count(2) };
    },
    [start.col, start.row, target.col, target.row],
  );
  assert.deepEqual(again, { seed: start.seed, creative: false, dug: AIR, placed: DIRT, dirt: before - 1 });
  assert.deepEqual(p.errors, []);
});

test('mundo de bloques: hacer tablas, slimes de noche, dormir en la cama y volar en Creativo', { timeout: ms(150000) }, async () => {
  const p = await openPage(game);
  await p.joinPlayers(1);
  await enterWorld(p, 1, { aventura: true });
  // Con un tronco, Y abre "Hacer cosas" y A hace 4 tablas.
  await p.page.evaluate(() => window.leogames.scene.getScene('Bloques').blockPlayers[0].give(6, 1));
  await p.tap(0, BUTTON.Y);
  await p.until(() => Boolean(window.leogames.scene.getScene('Bloques').blockPlayers[0].menu), ms(5000), 'abrir el menú de hacer cosas');
  await p.tap(0, BUTTON.A);
  const made = await p.page.evaluate(() => {
    const q = window.leogames.scene.getScene('Bloques').blockPlayers[0];
    return { tablas: q.count(12), troncos: q.count(6) };
  });
  assert.deepEqual(made, { tablas: 4, troncos: 0 });
  await p.tap(0, BUTTON.B);
  await p.until(() => !window.leogames.scene.getScene('Bloques').blockPlayers[0].menu, ms(5000), 'cerrar el menú');

  // De noche sale un slime junto a J1: lo empuja y le quita un corazón.
  await p.page.evaluate(() => {
    const s = window.leogames.scene.getScene('Bloques');
    s.dayMs = 0.7 * 300000;
  });
  await p.until(() => window.leogames.scene.getScene('Bloques').nightness > 0.9, ms(5000), 'que se haga de noche');
  await p.page.evaluate(() => {
    const s = window.leogames.scene.getScene('Bloques');
    s.spawnSlime();
    const slime = s.slimes[s.slimes.length - 1];
    const q = s.blockPlayers[0];
    slime.x = q.x + 20;
    slime.y = q.y;
  });
  await p.until(() => window.leogames.scene.getScene('Bloques').blockPlayers[0].hearts < 5, ms(8000), 'que el slime empuje a J1');

  // Una cama junto a J1: Y = dormir; amanece, se van los slimes y sale la calcomanía.
  await p.wait(1700);
  await p.page.evaluate(() => {
    const s = window.leogames.scene.getScene('Bloques');
    for (const slime of [...s.slimes]) s.removeSlime(slime);
    const q = s.blockPlayers[0];
    q.vx = 0;
    s.setCell(Math.floor(q.x / 48), Math.floor((q.y - 1) / 48), 16);
  });
  await p.tap(0, BUTTON.Y);
  await p.until(
    () => window.leogames.scene.getScene('Bloques').nightness === 0 && window.leogames.scene.getScene('Bloques').phase === 'play',
    ms(10000),
    'dormir hasta la mañana',
  );
  const stickers = await p.page.evaluate(() => JSON.parse(localStorage.getItem('leogames:stickers') ?? '[]'));
  assert.ok(stickers.includes('bloques-noche'), 'calcomanía de dormir');
  await p.holdToMenu(0, EXIT, 'salir del Mundo de bloques');

  // En Creativo (otro mundo): A dos veces en el aire = volar.
  await p.openGameCard('Mundo de bloques');
  await p.pickCharacters(1);
  await p.until(() => window.leogames.scene.getScene('Bloques')?.phase === 'setup', ms(20000), 'opciones');
  await p.tap(0, BUTTON.RIGHT);
  await p.tap(0, BUTTON.DOWN);
  await p.tap(0, BUTTON.RIGHT);
  await p.wait(300);
  await p.tap(0, BUTTON.A);
  await p.until(() => window.leogames.scene.getScene('Bloques')?.phase === 'play', ms(20000), 'jugar en Creativo');
  assert.equal(await p.page.evaluate(() => window.leogames.scene.getScene('Bloques').creative), true);
  await p.tap(0, BUTTON.A, 60);
  await p.tap(0, BUTTON.A, 60);
  await p.until(() => window.leogames.scene.getScene('Bloques').blockPlayers[0].flying, ms(5000), 'volar');
  assert.deepEqual(p.errors, []);
});
