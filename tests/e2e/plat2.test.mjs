// Súper Bolitas (ronda 3): las Carreritas, la Isla de los jefes y Arma tu nivel. Bots con controles simulados, como
// en games.test.mjs.
import { after, afterEach, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { BUTTON, closeOpenPages, openPage, startGame } from './helpers.mjs';

// En GitHub no hay tarjeta de video y el juego va más lento: se le da más tiempo a todo.
const SLOW = process.env.CI ? 4 : 1;
const ms = (value) => value * SLOW;
const EXIT = [BUTTON.LB, BUTTON.RB, BUTTON.Y];

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

const stickers = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('leogames:stickers') ?? '[]'));
const plat = (page, fn, arg) => page.evaluate(fn, arg);

async function openPlat(p, count, progress) {
  await p.page.evaluate((data) => import('/src/shared/settings.js').then((m) => m.settings.set('platProgress2', data)), progress);
  await p.joinPlayers(count);
  await p.openGameCard('Súper Bolitas');
  await p.pickCharacters(count);
  await p.until(() => window.leogames.scene.getScene('Plat')?.phase === 'map', ms(10000), 'ver el mapa de Súper Bolitas');
}

// X en el mapa y bajar hasta el modo número `index` (empieza en el primero).
async function openMode(p, index) {
  await p.tap(0, BUTTON.X);
  await p.until(() => window.leogames.scene.getScene('Plat').phase === 'modes', ms(3000), 'abrir los modos');
  for (let i = 0; i < index; i += 1) await p.tap(0, BUTTON.DOWN);
  await p.tap(0, BUTTON.A);
}

// Termina la carrera de ahorita: el Jugador 1 cruza la bandera (y espera la tabla).
async function finishRace(p) {
  await p.until(() => window.leogames.scene.getScene('Plat').race?.countdownMs <= 0, ms(8000), 'que acabe la cuenta regresiva');
  await plat(p.page, () => {
    const s = window.leogames.scene.getScene('Plat');
    s.cameras.main.setScroll(s.goal.x - 900, 0);
    Object.assign(s.players[0], { x: s.goal.x + 2, invulnMs: 1e9 });
  });
  await p.until(() => window.leogames.scene.getScene('Plat').phase === 'results', ms(8000), 'que se acabe la carrera');
  await p.until(() => window.leogames.scene.getScene('Plat').endMs > 1000, ms(5000), 'que la tabla acepte botones');
}

test('súper bolitas: carreritas contra la compu, turbo para el último y la copa', { timeout: ms(150000) }, async () => {
  const p = await openPage(game);
  await openPlat(p, 1, { unlocked: 0, levels: {}, peque: {} });
  await openMode(p, 5);
  await p.until(
    () => window.leogames.scene.getScene('Plat').run?.mode === 'race' && window.leogames.scene.getScene('Plat').phase === 'play',
    ms(5000),
    'empezar las carreritas',
  );
  // Con un solo jugador corren 2 de la compu; durante la cuenta regresiva nadie se mueve.
  assert.equal(await plat(p.page, () => window.leogames.scene.getScene('Plat').players.filter((pl) => pl.cpu).length), 2);
  const startX = await plat(p.page, () => window.leogames.scene.getScene('Plat').players[1].x);
  await p.wait(1000);
  assert.equal(await plat(p.page, () => window.leogames.scene.getScene('Plat').players[1].x), startX, 'se movió antes del ¡fuera!');
  await p.until(() => window.leogames.scene.getScene('Plat').race.countdownMs <= 0, ms(8000), 'que acabe la cuenta regresiva');
  // Los de la compu corren solos.
  await p.until(() => window.leogames.scene.getScene('Plat').players.some((pl) => pl.cpu && pl.x > 6 * 48), ms(8000), 'que corran los de la compu');
  // El que va hasta atrás (lejos del primero) recibe turbo.
  await plat(p.page, () => {
    const s = window.leogames.scene.getScene('Plat');
    s.players[0].invulnMs = 1e9;
    s.players[1].x = s.players[0].x + 600;
    s.race.helpMs = 1e6;
  });
  await p.until(() => window.leogames.scene.getScene('Plat').players[0].boostMs > 0, ms(3000), 'que el último reciba turbo');

  // Gana la primera carrera: 4 puntos y la calcomanía.
  await finishRace(p);
  assert.ok((await stickers(p.page)).includes('plat-carrera'));
  assert.equal(await plat(p.page, () => window.leogames.scene.getScene('Plat').race.points.get(window.leogames.scene.getScene('Plat').players[0])), 4);
  // Las otras dos carreras y el campeón de la copa.
  for (let race = 2; race <= 3; race += 1) {
    await p.tap(0, BUTTON.A);
    await p.until(
      () => window.leogames.scene.getScene('Plat').phase === 'play' && window.leogames.scene.getScene('Plat').race.countdownMs > 0,
      ms(5000),
      `empezar la carrera ${race}`,
    );
    await finishRace(p);
  }
  assert.match(await plat(p.page, () => window.leogames.scene.getScene('Plat').screen.list[1].text), /ganó la copa/);
  // B = al mapa: se van los de la compu.
  await p.tap(0, BUTTON.B);
  await p.until(() => window.leogames.scene.getScene('Plat').phase === 'map', ms(5000), 'regresar al mapa');
  assert.equal(await plat(p.page, () => window.leogames.scene.getScene('Plat').players.length), 1);
  await p.holdToMenu(0, EXIT, 'salir de Súper Bolitas');
  assert.deepEqual(p.errors, []);
  await p.context.close();
});

// Entra a la arena del jefe del nivel de ahorita (con el Jugador 1 a salvo).
async function enterArena(p) {
  await p.until(() => window.leogames.scene.getScene('Plat').phase === 'play', ms(5000), 'empezar el nivel');
  await plat(p.page, () => {
    const s = window.leogames.scene.getScene('Plat');
    const a = s.level.arena;
    s.cameras.main.setScroll(a.left * 48, 0);
    Object.assign(s.players[0], { x: (a.left + 4) * 48, y: (a.boss.row + 1) * 48, vy: 0, invulnMs: 1e9 });
  });
  await p.until(() => Boolean(window.leogames.scene.getScene('Plat').boss), ms(4000), 'que llegue el jefe');
}

// Gana la pelea a la fuerza (cada golpe como si le brincaran encima) y espera la tabla.
async function beatBoss(p) {
  await plat(p.page, () => {
    const s = window.leogames.scene.getScene('Plat');
    for (let i = 0; i < 20 && !s.boss.dead; i += 1) {
      const body = s.boss.bodies()[0];
      s.boss.stunMs = 0;
      if (body !== s.boss) body.invulnMs = 0;
      if (s.boss.stomped(body)) s.bossDefeated();
    }
  });
  await p.until(() => window.leogames.scene.getScene('Plat').phase === 'results', ms(10000), 'ganarle al jefe');
  await p.until(() => window.leogames.scene.getScene('Plat').endMs > 1000, ms(5000), 'que la tabla acepte botones');
}

test('súper bolitas: la isla de los jefes (abeja reina, pez globo y gelatina gigante)', { timeout: ms(150000) }, async () => {
  const p = await openPage(game);
  const done = { done: true, big: [false, false, false], bestMs: 90000 };
  await openPlat(p, 1, { unlocked: 4, levels: { '1-1': done, '1-4': done }, peque: {} });
  // Empieza en el mundo 2; RB se brinca los cerrados y llega a la isla.
  assert.equal(await plat(p.page, () => window.leogames.scene.getScene('Plat').mapState.world), 1);
  await p.tap(0, BUTTON.RB);
  await p.until(() => window.leogames.scene.getScene('Plat').mapState.world === 8, ms(3000), 'llegar a la Isla de los jefes');
  await p.tap(0, BUTTON.A);
  await enterArena(p);

  // La Abeja Reina se lanza en picada y se le atora el aguijón: ahí se le brinca encima.
  assert.equal(await plat(p.page, () => window.leogames.scene.getScene('Plat').boss.type.behavior), 'diver');
  assert.ok(await plat(p.page, () => window.leogames.scene.getScene('Plat').bossName.visible), 'no se ve la vida del jefe');
  await p.until(() => window.leogames.scene.getScene('Plat').boss.state === 'stuck', ms(8000), 'que la abeja se atore');
  await plat(p.page, () => {
    const s = window.leogames.scene.getScene('Plat');
    Object.assign(s.players[0], { x: s.boss.x, y: s.boss.y - s.boss.h - 20, vy: 300 });
  });
  await p.until(() => window.leogames.scene.getScene('Plat').boss.hp === 2, ms(3000), 'brincarle encima a la abeja');
  await beatBoss(p);
  assert.equal(await plat(p.page, () => JSON.parse(localStorage.getItem('leogames:platProgress2')).levels['9-1']?.done), true);

  // El Pez Globo: se infla con picos (no se le puede brincar) y avienta espinas.
  await p.tap(0, BUTTON.A);
  await p.until(() => window.leogames.scene.getScene('Plat').info?.id === '9-2', ms(5000), 'pasar al 9-2');
  await enterArena(p);
  assert.equal(await plat(p.page, () => window.leogames.scene.getScene('Plat').boss.type.behavior), 'puffer');
  await p.until(() => window.leogames.scene.getScene('Plat').boss.state === 'puffed', ms(8000), 'que el pez se infle');
  assert.equal(await plat(p.page, () => window.leogames.scene.getScene('Plat').boss.stompable), false);
  assert.ok(await plat(p.page, () => window.leogames.scene.getScene('Plat').boss.hazards.length > 0), 'no aventó espinas');
  await beatBoss(p);

  // La Gelatina Gigante se parte en dos cada vez que la pisan (1 + 2 + 4 = 7).
  await p.tap(0, BUTTON.A);
  await p.until(() => window.leogames.scene.getScene('Plat').info?.id === '9-3', ms(5000), 'pasar al 9-3');
  await enterArena(p);
  const pieces = await plat(p.page, () => {
    const s = window.leogames.scene.getScene('Plat');
    const counts = [s.boss.bodies().length];
    s.boss.stomped(s.boss.bodies()[0]);
    counts.push(s.boss.bodies().length);
    return counts;
  });
  assert.deepEqual(pieces, [1, 2]);
  assert.equal(await plat(p.page, () => window.leogames.scene.getScene('Plat').boss.maxHp), 7);
  await beatBoss(p);
  assert.ok((await stickers(p.page)).includes('plat-isla'));
  await p.holdToMenu(0, EXIT, 'salir de Súper Bolitas');
  assert.deepEqual(p.errors, []);
  await p.context.close();
});

test('súper bolitas: arma tu nivel, pruébalo, guárdalo y juégalo', { timeout: ms(150000) }, async () => {
  const p = await openPage(game);
  await openPlat(p, 1, { unlocked: 0, levels: {}, peque: {} });
  await openMode(p, 6);
  await p.until(() => window.leogames.scene.getScene('Plat').phase === 'myLevels', ms(3000), 'ver tus niveles');
  await p.tap(0, BUTTON.A);
  await p.until(() => window.leogames.scene.getScene('Plat').phase === 'editor', ms(3000), 'abrir el editor');
  const editor = (fn, arg) => plat(p.page, fn, arg);
  // Un bloque de piedra (RB = siguiente pieza) a la derecha del cuadrito.
  await p.tap(0, BUTTON.RIGHT);
  await p.tap(0, BUTTON.RB);
  await p.tap(0, BUTTON.A);
  const cell = await editor(() => {
    const e = window.leogames.scene.getScene('Plat').editor;
    return { ch: e.grid[e.cursor.r][e.cursor.c], c: e.cursor.c, r: e.cursor.r };
  });
  assert.equal(cell.ch, 'X');
  await p.page.evaluate((c) => (window.__cell = c), cell);
  // Un tubo (la pieza 10) más adelante: de la boca hasta el piso. B lo quita entero.
  for (let i = 0; i < 9; i += 1) await p.tap(0, BUTTON.RB);
  for (let i = 0; i < 4; i += 1) await p.tap(0, BUTTON.RIGHT);
  await p.tap(0, BUTTON.UP);
  await p.tap(0, BUTTON.A);
  const pipe = await editor(() => {
    const e = window.leogames.scene.getScene('Plat').editor;
    const { c, r } = e.cursor;
    return [e.grid[r][c], e.grid[r][c + 1], e.grid[r + 1][c], e.grid[r + 1][c + 1]].join('');
  });
  assert.equal(pipe, '[]()');
  await p.tap(0, BUTTON.B);
  assert.equal(
    await editor(
      () =>
        window.leogames.scene
          .getScene('Plat')
          .editor.grid.flat()
          .filter((ch) => '[]()'.includes(ch)).length,
    ),
    0,
  );

  // Y = probarlo; Y otra vez regresa a editar.
  await p.tap(0, BUTTON.Y);
  await p.until(
    () => window.leogames.scene.getScene('Plat').run?.mode === 'custom' && window.leogames.scene.getScene('Plat').phase === 'play',
    ms(5000),
    'probar el nivel',
  );
  assert.equal(await plat(p.page, () => window.leogames.scene.getScene('Plat').run.test), true);
  await p.wait(500);
  await p.tap(0, BUTTON.Y);
  await p.until(() => window.leogames.scene.getScene('Plat').phase === 'editor', ms(5000), 'regresar a editar');
  assert.equal(await editor(() => window.leogames.scene.getScene('Plat').editor.grid[window.__cell.r][window.__cell.c]), 'X', 'no se quedó el bloque');
  // Probarlo y llegar a la meta: regresa al editor y queda como "ya lo pasaron".
  await p.tap(0, BUTTON.Y);
  await p.until(() => window.leogames.scene.getScene('Plat').phase === 'play', ms(5000), 'probar otra vez');
  await plat(p.page, () => {
    const s = window.leogames.scene.getScene('Plat');
    s.cameras.main.setScroll(s.goal.x - 900, 0);
    Object.assign(s.players[0], { x: s.goal.x + 2, invulnMs: 1e9 });
  });
  await p.until(() => window.leogames.scene.getScene('Plat').phase === 'editor', ms(10000), 'pasar el nivel y regresar a editar');
  assert.ok((await stickers(p.page)).includes('plat-mi-nivel'));
  const saved = await plat(p.page, () => JSON.parse(localStorage.getItem('leogames:platMisNiveles')).slots[0]);
  assert.equal(saved.tested, true);
  assert.equal(saved.rows[cell.r][cell.c], 'X');

  // X = menú → Guardar y salir; en tus niveles, X = jugarlo.
  await p.tap(0, BUTTON.X);
  for (let i = 0; i < 3; i += 1) await p.tap(0, BUTTON.DOWN);
  await p.tap(0, BUTTON.A);
  await p.until(() => window.leogames.scene.getScene('Plat').phase === 'myLevels', ms(3000), 'guardar y salir');
  await p.tap(0, BUTTON.X);
  await p.until(
    () => window.leogames.scene.getScene('Plat').run?.mode === 'custom' && window.leogames.scene.getScene('Plat').phase === 'play',
    ms(5000),
    'jugar tu nivel',
  );
  assert.equal(await plat(p.page, () => window.leogames.scene.getScene('Plat').run.test), false);
  await p.holdToMenu(0, EXIT, 'salir de Súper Bolitas');
  assert.deepEqual(p.errors, []);
  await p.context.close();
});
