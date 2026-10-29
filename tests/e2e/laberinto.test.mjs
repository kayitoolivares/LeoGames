// Pruebas del Laberinto come-frutas: que los laberintos estén bien hechos (sin callejones, todo conectado) y un bot con
// dos jugadores que come bolitas, la fruta de poder, un fantasmita, rebota uno en modo peque, lo atrapan y pasa de nivel.
import { after, afterEach, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { BUTTON, closeOpenPages, openPage, startGame } from './helpers.mjs';
import { MAZES, MAZE_KEYS, isHouse, isWall, parseMaze, tileAt } from '../../src/games/laberinto/mazes.js';

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

test('laberinto: los 4 laberintos sin callejones, sin cuadros de 2x2 y todo conectado', () => {
  const DIRS = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];
  for (const key of MAZE_KEYS) {
    const maze = parseMaze(MAZES[key]);
    assert.ok(
      MAZES[key].every((row) => row.length === maze.width),
      `${key}: renglones de distinto largo`,
    );
    const walkable = (x, y) => {
      const ch = tileAt(maze, x, y);
      return !isWall(ch) && !isHouse(ch);
    };
    let open = 0;
    for (let y = 0; y < maze.height; y += 1) {
      for (let x = 0; x < maze.width; x += 1) {
        if (!walkable(x, y)) continue;
        open += 1;
        // (La salida de la casita cuenta la puerta como camino: por ahí salen los fantasmitas.)
        const exits = DIRS.filter(([dx, dy]) => walkable(x + dx, y + dy) || tileAt(maze, x + dx, y + dy) === '-').length;
        assert.ok(exits >= 2, `${key}: callejón sin salida en ${x},${y}`);
        const square = x + 1 < maze.width && walkable(x + 1, y) && walkable(x, y + 1) && walkable(x + 1, y + 1);
        assert.ok(!square, `${key}: cuadro abierto de 2x2 en ${x},${y}`);
      }
    }
    const start = maze.starts[0];
    const seen = new Set([`${start.x},${start.y}`]);
    const queue = [start];
    while (queue.length) {
      const { x, y } = queue.shift();
      for (const [dx, dy] of DIRS) {
        if (!walkable(x + dx, y + dy)) continue;
        const nx = (x + dx + maze.width) % maze.width;
        const k = `${nx},${y + dy}`;
        if (seen.has(k)) continue;
        seen.add(k);
        queue.push({ x: nx, y: y + dy });
      }
    }
    assert.equal(seen.size, open, `${key}: hay caminos que no se conectan`);
    assert.equal(maze.powers.length, 4, `${key}: deben ser 4 frutas de poder`);
    assert.equal(maze.starts.length, 4, `${key}: deben ser 4 lugares de jugador`);
    assert.ok(maze.fruit, `${key}: falta el lugar de la fruta bonus`);
    assert.ok(maze.door && walkable(maze.exit.x, maze.exit.y), `${key}: la puerta de la casita debe dar a un camino`);
    assert.ok(maze.houseSpots.length >= 3, `${key}: la casita es muy chica`);
  }
});

test('laberinto: dos jugadores comen bolitas, fruta de poder, fantasmitas, modo peque y pasan de nivel', { timeout: ms(150000) }, async () => {
  const p = await openPage(game);
  await p.page.evaluate(() => localStorage.removeItem('leogames:stickers'));
  await p.joinPlayers(2);
  await p.openGameCard('Laberinto');
  await p.pickCharacters(2);
  await p.until(() => window.leogames.scene.getScene('Laberinto')?.phase === 'setup', ms(10000), 'ver las opciones del laberinto');
  const scene = 'window.leogames.scene.getScene("Laberinto")';
  const read = (expr) => p.page.evaluate(`(() => { const s = ${scene}; return ${expr}; })()`);
  const run = (code) => p.page.evaluate(`(() => { const s = ${scene}; ${code} })()`);

  // El Jugador 2 se pone modo peque con Y.
  await p.tap(1, BUTTON.Y);
  assert.ok((await read('s.setupPlayers[1].text')).includes('peque'), 'el modo peque del Jugador 2 no se prendió');
  await p.tap(0, BUTTON.A);
  await p.until(() => window.leogames.scene.getScene('Laberinto').phase === 'play', ms(12000), 'empezar a jugar');
  assert.equal(await read('s.mazeKey'), 'jardin');
  // Los fantasmitas se quedan en su casita (la prueba los saca cuando los necesita).
  const parkGhosts = `for (const g of s.ghosts) { g.state = 'house'; g.releaseMs = 1e9; g.x = g.start.x === s.maze.exit.x && g.start.y === s.maze.exit.y ? s.maze.exit.x : g.start.x; g.y = s.maze.houseCenter.y; g.home = { x: g.x, y: g.y }; }`;
  await run(parkGhosts);

  // Caminar a la izquierda come bolitas.
  const dotsBefore = await read('s.dots.size');
  await p.holdUntil(0, [BUTTON.LEFT], () => window.leogames.scene.getScene('Laberinto').eaters[0].points >= 30, 'comer bolitas caminando', ms(8000));
  assert.ok((await read('s.dots.size')) < dotsBefore, 'no se comió ninguna bolita');
  assert.ok((await read('s.eaters[0].x')) < 15, 'el Jugador 1 no caminó');

  // La fruta de poder (arriba a la izquierda): asusta a los fantasmitas.
  await run('const e = s.eaters[0]; e.x = 4; e.y = 1; e.dir = { x: 0, y: 0 }; e.want = null;');
  await p.holdUntil(0, [BUTTON.LEFT], () => window.leogames.scene.getScene('Laberinto').scaredMs > 0, 'comerse la fruta de poder', ms(8000));
  assert.ok(await read('s.ghosts.every((g) => g.scared)'), 'los fantasmitas no se asustaron');

  // Un fantasmita asustado que se topa con el Jugador 1: ¡se lo come! y regresa como ojitos a su casita.
  await run(`const e = s.eaters[0]; const g = s.ghosts[0]; g.state = 'active'; g.x = e.x; g.y = e.y; g.dir = { x: 1, y: 0 };`);
  await p.until(() => window.leogames.scene.getScene('Laberinto').ghosts[0].state === 'eyes', ms(5000), 'comerse al fantasmita');
  assert.equal(await read('s.eaters[0].ghosts'), 1);
  await p.until(
    () => ['house', 'leaving', 'active'].includes(window.leogames.scene.getScene('Laberinto').ghosts[0].state),
    ms(15000),
    'que los ojitos regresen a la casita',
  );
  await run(`${parkGhosts} s.endScared();`);

  // Modo peque: el fantasmita rebota en vez de atrapar al Jugador 2.
  await run(
    `const e = s.eaters[1]; const g = s.ghosts[2]; g.state = 'active'; g.scared = false; g.x = Math.round(e.x); g.y = Math.round(e.y); g.dir = { x: 1, y: 0 };`,
  );
  await p.until(() => window.leogames.scene.getScene('Laberinto').ghosts[2].stunnedMs > 0, ms(5000), 'que el fantasmita rebote con el modo peque');
  assert.equal(await read('s.eaters[1].state'), 'play', 'al del modo peque lo atraparon');
  await run(parkGhosts);

  // Al Jugador 1 lo atrapan: se va en su burbuja (cuesta una vida) y regresa a su lugar.
  const lives = await read('s.lives');
  await run(`const e = s.eaters[0]; const g = s.ghosts[1]; g.state = 'active'; g.scared = false; g.x = e.x; g.y = e.y; g.dir = { x: 1, y: 0 };`);
  await p.until(() => window.leogames.scene.getScene('Laberinto').eaters[0].state === 'bubble', ms(5000), 'que atrapen al Jugador 1');
  await run(parkGhosts);
  assert.equal(await read('s.lives'), lives - 1, 'no se gastó una vida');
  await p.until(() => window.leogames.scene.getScene('Laberinto').eaters[0].state === 'play', ms(8000), 'que el Jugador 1 regrese de su burbuja');
  assert.deepEqual(await read('[s.eaters[0].x, s.eaters[0].y]'), await read('[s.eaters[0].home.x, s.eaters[0].home.y]'));

  // Sin bolitas se pasa de nivel: sigue Dulcelandia.
  await run('for (const dot of [...s.dots.values()]) if (s.phase === "play") s.eatDot(dot, s.eaters[1]);');
  assert.equal(await read('s.phase'), 'clear');
  await p.until(() => window.leogames.scene.getScene('Laberinto').level === 2, ms(10000), 'pasar al nivel 2');
  assert.equal(await read('s.mazeKey'), 'dulces');
  assert.ok((await stickers(p.page)).includes('laberinto-nivel'), 'no ganó la calcomanía de pasar un nivel');
  assert.deepEqual(p.errors, []);
  await p.holdToMenu(0, EXIT, 'salir del laberinto');
});
