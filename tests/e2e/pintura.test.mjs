// Pruebas de la Guerra de pintura (primera persona con pistolas de pintura): bots con controles simulados.
import { after, afterEach, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { BUTTON, closeOpenPages, openPage, startGame } from './helpers.mjs';

// En GitHub no hay tarjeta de video y el juego va más lento: se le da más tiempo a todo.
const SLOW = process.env.CI ? 4 : 1;
const ms = (value) => value * SLOW;
// Para salir de cualquier juego se mantienen LB + RB + Y.
const EXIT = [BUTTON.LB, BUTTON.RB, BUTTON.Y];

let game;
before(async () => {
  game = await startGame();
});
// (Si una prueba falla a la mitad, su página se cierra igual.)
afterEach(async () => {
  await closeOpenPages();
});
after(async () => {
  await game?.stop();
});

const stickers = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('leogames:stickers') ?? '[]'));

// Entra a la Guerra de pintura con `count` jugadores y espera las opciones. Devuelve un atajo para leer o cambiar el juego.
async function openPintura(p, count) {
  await p.joinPlayers(count);
  await p.openGameCard('Guerra de pintura');
  await p.pickCharacters(count);
  await p.page.waitForFunction(() => window.leogames.scene.getScene('Pintura')?.game3d?.phase === 'setup', null, { timeout: ms(30000) });
  await p.wait(ms(400));
  return (code) => p.page.evaluate((c) => new Function('g', c)(window.leogames.scene.getScene('Pintura').game3d), code);
}

// Mantiene un botón un rato (RT para pintar).
async function hold(p, pad, button, holdMs) {
  await p.page.evaluate(([i, b]) => window.__button(i, b, true), [pad, button]);
  await p.wait(holdMs);
  await p.frames(2);
  await p.page.evaluate(([i, b]) => window.__button(i, b, false), [pad, button]);
  await p.frames(2);
}

test('guerra de pintura: pantalla dividida, pintar el piso, pintar a un rival, globo y resultados', { timeout: ms(150000) }, async () => {
  const p = await openPage(game);
  const g = await openPintura(p, 2);

  // Opciones: 2 pintores por equipo (5º renglón) y ¡a pintar!
  for (let i = 0; i < 4; i += 1) await p.tap(0, BUTTON.DOWN);
  await p.tap(0, BUTTON.LEFT);
  await p.tap(0, BUTTON.LEFT);
  assert.deepEqual(await g('return [g.settings.mode, g.settings.size]'), ['piso', 2]);
  await p.tap(0, BUTTON.A);
  await p.until(() => window.leogames.scene.getScene('Pintura').game3d.phase === 'play', ms(15000), 'que empiece la partida');
  // Dos jugadores = la pantalla partida en dos; los dos en el mismo equipo y la compu en el otro.
  assert.deepEqual(
    await g('return [g.views.length, g.painters.length, g.humanPainters.map((h) => h.team).join(), g.painters.filter((x) => x.isCpu && x.team === 1).length]'),
    [2, 4, '0,0', 2],
  );

  // J1 apunta al piso y pinta con RT: el piso se va pintando de su color.
  await g('const h = g.humanPainters[0]; h.pitch = -0.6; for (const x of g.painters) if (x.isCpu) x.frozen = true;');
  await hold(p, 0, BUTTON.RT, ms(700));
  await p.until(() => window.leogames.scene.getScene('Pintura').game3d.humanPainters[0].stats.painted > 0, ms(5000), 'que se pinte el piso');
  assert.ok(await g('return g.floor.counts[0] > 0'), 'el piso no quedó pintado');

  // Un rival enfrente: la mira se le pega y con RT queda ¡pintado!
  await g(`const h = g.humanPainters[0]; const r = g.painters.find((x) => x.isCpu && x.team === 1);
    h.pitch = 0; r.x = h.x + Math.sin(h.yaw) * 4; r.z = h.z + Math.cos(h.yaw) * 4; r.y = 0; r.hp = 20; r.invulnMs = 0;`);
  await p.frames(3);
  await hold(p, 0, BUTTON.RT, ms(900));
  await p.until(() => window.leogames.scene.getScene('Pintura').game3d.humanPainters[0].stats.splats >= 1, ms(6000), 'pintar al rival');
  assert.equal(
    await g("return g.painters.find((x) => x.isCpu && x.team === 1).state === 'splatted' || g.painters.find((x) => x.isCpu && x.team === 1).invulnMs > 0"),
    true,
  );

  // X avienta un globo de pintura que explota.
  await g('const h = g.humanPainters[0]; h.ink = 100; h.balloonMs = 0;');
  await p.tap(0, BUTTON.X);
  assert.equal(await g('return g.balloons.length'), 1);
  await p.until(() => window.leogames.scene.getScene('Pintura').game3d.balloons.length === 0, ms(6000), 'que explote el globo');

  // B = nadar en su tinta: se vuelve charquito y se le llena la tinta.
  await g('const h = g.humanPainters[0]; g.floor.splat(h.x, h.z, 3, 0); h.ink = 20;');
  await p.page.evaluate(() => window.__button(0, 1, true));
  await p.until(
    () => {
      const h = window.leogames.scene.getScene('Pintura').game3d.humanPainters[0];
      return h.swimming && h.ink > 40;
    },
    ms(6000),
    'nadar y llenar la tinta',
  );
  await p.page.evaluate(() => window.__button(0, 1, false));
  // RB = el siguiente lanzador (el largo).
  await p.tap(0, BUTTON.RB);
  assert.equal(await g('return g.humanPainters[0].weapon.key'), 'largo');

  // Se acaba el tiempo con el piso casi todo rosa: ganan los Rosas (los jugadores) y sale la calcomanía.
  await g('g.floor.splat(0, 0, 30, 0); g.timeLeftMs = 200;');
  await p.until(() => window.leogames.scene.getScene('Pintura').game3d.phase === 'results', ms(10000), 'los resultados');
  assert.deepEqual(await g('return [g.result.winner, g.hud.resultsEl.hidden, g.hud.resultsEl.textContent.includes("%")]'), [0, false, true]);
  assert.ok((await stickers(p.page)).includes('pintura-piso'), 'no ganó la calcomanía de Pinta el piso');

  // A = otra vez.
  await p.wait(ms(1300));
  await p.tap(0, BUTTON.A);
  await p.until(() => window.leogames.scene.getScene('Pintura').game3d.phase === 'countdown', ms(6000), 'la revancha');
  await p.holdToMenu(0, EXIT, 'salir de la Guerra de pintura');
  assert.deepEqual(p.errors, []);
  await p.context.close();
});

test('guerra de pintura: modo peque y contra robots', { timeout: ms(150000) }, async () => {
  const p = await openPage(game);
  const g = await openPintura(p, 1);

  // Y = modo peque; el tercer modo es Contra robots.
  await p.tap(0, BUTTON.Y);
  await p.tap(0, BUTTON.RIGHT);
  await p.tap(0, BUTTON.RIGHT);
  assert.equal(await g('return g.settings.mode'), 'robots');
  await p.tap(0, BUTTON.A);
  await p.until(() => window.leogames.scene.getScene('Pintura').game3d.phase === 'play', ms(15000), 'que empiece la partida');
  assert.deepEqual(await g('const h = g.humanPainters[0]; return [h.peque, h.maxHp > 100, g.painters.every((x) => x.team === 0)]'), [true, true, true]);
  await p.until(() => window.leogames.scene.getScene('Pintura').game3d.robots?.list.length > 0, ms(8000), 'la primera oleada');

  // Un robot enfrente de J1: lo pinta con RT hasta apagarlo.
  await g(`const h = g.humanPainters[0]; h.pitch = 0; const r = g.robots.list[0]; r.x = h.x + Math.sin(h.yaw) * 4; r.z = h.z + Math.cos(h.yaw) * 4;
    r.spec = { ...r.spec, speed: 0 }; r.hp = 20;`);
  await p.frames(3);
  await hold(p, 0, BUTTON.RT, ms(1200));
  await p.until(() => window.leogames.scene.getScene('Pintura').game3d.humanPainters[0].stats.robots >= 1, ms(6000), 'pintar a un robot');

  // Las 5 oleadas (aquí se apagan solos) y la calcomanía.
  await p.until(
    () => {
      const game3d = window.leogames.scene.getScene('Pintura').game3d;
      for (const robot of game3d.robots?.list ?? []) if (robot.alive) game3d.hitTarget(robot, 99999, game3d.humanPainters[0], 0);
      return game3d.phase === 'results';
    },
    ms(60000),
    'ganarle a los robots',
  );
  assert.deepEqual(await g('return [g.result.outcome, g.wave]'), ['won', 5]);
  assert.ok((await stickers(p.page)).includes('pintura-robots'), 'no ganó la calcomanía de los robots');
  await p.holdToMenu(0, EXIT, 'salir de la Guerra de pintura');
  assert.deepEqual(p.errors, []);
  await p.context.close();
});
