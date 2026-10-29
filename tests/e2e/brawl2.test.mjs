// Pelea en equipo, ronda 4: el Fondo del mar y la Selva con sus jefes nuevos, los niveles de los personajes y
// Defiende la base. Corren con `npm test` (como las demás pruebas de punta a punta).
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

// Entra a Pelea en equipo con un jugador y espera el mapa. Devuelve un atajo para correr código con la escena (`s`).
async function openBrawl(p) {
  await p.joinPlayers(1);
  await p.openGameCard('Pelea en equipo');
  await p.pickCharacters(1);
  await p.until(() => window.leogames.scene.getScene('Brawl')?.phase === 'map', ms(8000), 'ver el mapa');
  return (code) => p.page.evaluate((c) => new Function('s', c)(window.leogames.scene.getScene('Brawl')), code);
}

// Vence a todos (el jefe con su repetición) hasta ver los resultados.
async function beatEveryone(p, label) {
  await p.until(
    () => {
      const s = window.leogames.scene.getScene('Brawl');
      s.spawnQueue = [];
      if (s.phase === 'fight') for (const m of s.monsters) if (!m.dead) s.hitMonster(s.fighters[0], m, 999);
      return s.phase === 'results';
    },
    ms(25000),
    label,
  );
}

test('pelea en equipo: el Fondo del mar y la Selva con el Rey Tiburón y el Gran Gorila', { timeout: ms(180000) }, async () => {
  const p = await openPage(game);
  // Ya ganaron el Valle de los dinos: se abre el Fondo del mar.
  await p.page.evaluate(() => import('/src/shared/settings.js').then((m) => m.settings.set('stickers', ['pelea-dinos'])));
  const brawl = await openBrawl(p);
  // ▶ nueve veces desde la Pradera: el Fondo del mar.
  for (let i = 0; i < 9; i += 1) await p.tap(0, BUTTON.RIGHT);
  await p.tap(0, BUTTON.A);
  await p.until(
    () => window.leogames.scene.getScene('Brawl').world?.name === 'Fondo del mar' && window.leogames.scene.getScene('Brawl').phase === 'fight',
    ms(8000),
    'entrar al Fondo del mar',
  );
  await p.until(() => window.leogames.scene.getScene('Brawl').monsters.some((m) => m.typeKey === 'pececito'), ms(15000), 'que lleguen los pececitos');
  // La ronda del Rey Tiburón: una franja roja avisa y embiste por ese carril.
  await brawl('for (const f of s.fighters) f.invulnerableMs = 1e9; s.clearEnemies(); s.startWave(3);');
  await p.until(() => window.leogames.scene.getScene('Brawl').boss?.typeKey === 'reyTiburon', ms(15000), 'que llegue el Rey Tiburón');
  await p.until(() => window.leogames.scene.getScene('Brawl').laneWarnings.length > 0, ms(20000), 'que avise la embestida');
  await p.until(() => window.leogames.scene.getScene('Brawl').boss?.state === 'charge', ms(5000), 'que embista');
  await beatEveryone(p, 'ganar el Fondo del mar');
  assert.ok((await stickers(p.page)).includes('pelea-mar'));

  // A = la Selva (ya se abrió). El Gran Gorila brinca y al caer sale la onda.
  await p.until(() => window.leogames.scene.getScene('Brawl').endMs > 1300, ms(10000), 'que los resultados acepten botones');
  await p.holdUntil(0, [BUTTON.A], () => window.leogames.scene.getScene('Brawl').world?.name === 'Selva', 'pasar a la Selva');
  await brawl('for (const f of s.fighters) f.invulnerableMs = 1e9; s.clearEnemies(); s.startWave(3);');
  await p.until(() => window.leogames.scene.getScene('Brawl').boss?.typeKey === 'granGorila', ms(15000), 'que llegue el Gran Gorila');
  await p.until(() => window.leogames.scene.getScene('Brawl').quakes.length > 0, ms(20000), 'que haga temblar el piso');
  await beatEveryone(p, 'ganar la Selva');
  assert.ok((await stickers(p.page)).includes('pelea-selva'));
  await p.holdToMenu(0, EXIT, 'salir de la pelea');
  assert.deepEqual(p.errors, []);
  await p.context.close();
});

test('pelea en equipo: los personajes suben de nivel y se guarda', { timeout: ms(120000) }, async () => {
  const p = await openPage(game);
  const brawl = await openBrawl(p);
  await p.tap(0, BUTTON.A);
  await p.until(() => window.leogames.scene.getScene('Brawl').phase === 'fight', ms(8000), 'empezar en la Pradera');
  // 60 de experiencia = nivel 2; 100 más = nivel 3 (un corazón más, y se llena).
  const levels = await brawl(`
    const f = s.fighters[0];
    const start = [f.level, f.maxHp];
    s.gainXp(f, 60);
    const two = f.level;
    s.gainXp(f, 100);
    const saved = JSON.parse(localStorage.getItem('leogames:brawlXp'))[f.character];
    return { start, two, three: f.level, maxHp: f.maxHp, hp: f.hp, saved };
  `);
  assert.deepEqual(levels, { start: [1, 5], two: 2, three: 3, maxHp: 6, hp: 6, saved: 160 });
  // Pegarle a un monstruo también da experiencia.
  await p.until(() => window.leogames.scene.getScene('Brawl').monsters.some((m) => m.entered), ms(15000), 'que llegue un monstruo');
  const xp = await brawl(`
    const f = s.fighters[0];
    const before = s.levelPool.get(f.character);
    s.hitMonster(f, s.monsters.find((m) => m.entered), 1);
    return s.levelPool.get(f.character) - before;
  `);
  assert.equal(xp, 1);
  // Sale y vuelve a entrar: sigue en nivel 3.
  await p.holdToMenu(0, EXIT, 'salir de la pelea');
  await p.openGameCard('Pelea en equipo');
  await p.pickCharacters(1);
  await p.until(() => window.leogames.scene.getScene('Brawl')?.phase === 'map', ms(8000), 'ver el mapa otra vez');
  assert.deepEqual(await brawl('return [s.fighters[0].level, s.fighters[0].maxHp]'), [3, 6]);
  // Hasta el nivel 10: corona y calcomanía.
  assert.deepEqual(await brawl('const f = s.fighters[0]; s.gainXp(f, 5000); return [f.level, f.perks.crown, f.maxHp];'), [10, true, 7]);
  await p.until(() => JSON.parse(localStorage.getItem('leogames:stickers') ?? '[]').includes('pelea-nivel10'), ms(3000), 'la calcomanía del nivel 10');
  await p.holdToMenu(0, EXIT, 'salir de la pelea');
  assert.deepEqual(p.errors, []);
  await p.context.close();
});

test('pelea en equipo: defiende la base con barricadas, oleadas y récord', { timeout: ms(120000) }, async () => {
  const p = await openPage(game);
  const brawl = await openBrawl(p);
  // ◀ tres veces desde la Pradera: sin fin, jefes en serie y la base.
  for (let i = 0; i < 3; i += 1) await p.tap(0, BUTTON.LEFT);
  await p.tap(0, BUTTON.A);
  await p.until(
    () => window.leogames.scene.getScene('Brawl').baseMode && window.leogames.scene.getScene('Brawl').phase === 'build',
    ms(8000),
    'el menú de defensas',
  );
  assert.equal(await brawl('return s.baseDefense.coins'), 6);
  // A = barricada (4 monedas). ▶ A = torrecita (8): ya no alcanza.
  await p.wait(800);
  await p.tap(0, BUTTON.A);
  await p.tap(0, BUTTON.RIGHT);
  await p.tap(0, BUTTON.A);
  assert.deepEqual(await brawl('const d = s.baseDefense; return [d.barricades.length, d.towers.length, d.coins];'), [1, 0, 2]);
  // Y = ¡listos!: la primera oleada.
  await p.tap(0, BUTTON.Y);
  await p.until(
    () => window.leogames.scene.getScene('Brawl').phase === 'fight' && window.leogames.scene.getScene('Brawl').baseNumber === 1,
    ms(5000),
    'la primera oleada',
  );
  // Un monstruo que viene de afuera se queda en la barricada y le pega.
  await p.page.evaluate(async () => {
    const { Monster } = await import('/src/games/brawl/Monster.js');
    const s = window.leogames.scene.getScene('Brawl');
    for (const f of s.fighters) Object.assign(f, { invulnerableMs: 1e9, x: s.nest.x + 60 });
    s.spawnQueue = [];
    s.clearEnemies();
    const bar = s.baseDefense.barricades[0];
    const m = new Monster(s, 'slimeGrande', bar.x + bar.side * 140, s.nest.y);
    Object.assign(m, { entered: true, raidsNest: true, target: s.nest });
    s.monsters.push(m);
  });
  await p.until(() => window.leogames.scene.getScene('Brawl').baseDefense.barricades[0].hp < 8, ms(15000), 'que le pegue a la barricada');
  assert.ok(await brawl('const bar = s.baseDefense.barricades[0]; return (s.monsters[0].x - bar.x) * bar.side > 0;'), 'el monstruo cruzó la barricada');
  // Si le pegan a la base, le baja la vida.
  assert.equal(await brawl('s.baseHit(s.monsters[0]); return s.nest.hp;'), 19);
  // Al limpiar la oleada: el menú otra vez, con monedas de premio.
  await brawl('s.spawnQueue = []; s.clearEnemies();');
  await p.until(() => window.leogames.scene.getScene('Brawl').phase === 'build', ms(8000), 'el menú entre oleadas');
  assert.equal(await brawl('return s.baseDefense.coins'), 4);
  // Siguiente oleada; si tumban la base se acaba (y queda el récord: 1 oleada).
  await p.wait(800);
  await p.tap(0, BUTTON.Y);
  await p.until(
    () => window.leogames.scene.getScene('Brawl').baseNumber === 2 && window.leogames.scene.getScene('Brawl').phase === 'fight',
    ms(5000),
    'la segunda oleada',
  );
  await brawl('s.nest.hp = 1; s.baseDefense.refreshBase(); s.baseHit({ type: {}, taunt() {} });');
  await p.until(
    () => window.leogames.scene.getScene('Brawl').phase === 'results' && window.leogames.scene.getScene('Brawl').baseOver,
    ms(5000),
    'perder la base',
  );
  assert.equal(await p.page.evaluate(() => JSON.parse(localStorage.getItem('leogames:brawlBase'))), 1);
  // A = otra vez desde el menú de defensas.
  await p.until(() => window.leogames.scene.getScene('Brawl').endMs > 1300, ms(10000), 'que los resultados acepten botones');
  await p.tap(0, BUTTON.A);
  await p.until(
    () => window.leogames.scene.getScene('Brawl').phase === 'build' && window.leogames.scene.getScene('Brawl').baseDefense.barricades.length === 0,
    ms(5000),
    'la base otra vez',
  );
  await p.holdToMenu(0, EXIT, 'salir de la pelea');
  assert.deepEqual(p.errors, []);
  await p.context.close();
});
