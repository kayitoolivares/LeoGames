// Pruebas de punta a punta: bots que juegan con controles simulados. Corren con `npm test`
// y en GitHub Actions antes de publicar, para que un cambio no rompa otro juego sin darnos cuenta.
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

test('menú: cada juego abre y se puede salir', { timeout: ms(180000) }, async () => {
  const p = await openPage(game);
  await p.joinPlayers(1);
  console.log(`  (el juego va a ${Math.round(await p.page.evaluate(() => window.leogames.loop.actualFps))} cuadros por segundo)`);

  await p.openGameCard('Pelea en equipo');
  await p.pickCharacters(1);
  await p.page.waitForFunction(() => window.leogames.scene.isActive('Brawl'), null, { timeout: ms(8000) });
  await p.holdToMenu(0, EXIT, 'salir de Pelea en equipo');

  await p.openGameCard('Bolitas Bros');
  await p.page.waitForFunction(() => window.leogames.scene.isActive('SmashSelect'), null, { timeout: ms(8000) });
  await p.tap(0, BUTTON.B);
  await p.until(() => window.leogames.scene.isActive('Menu'), ms(6000), 'salir de la selección de Bolitas Bros');

  for (const [title, key] of [['Karts locos', 'Kart'], ['Carreras', 'Race']]) {
    await p.openGameCard(title);
    await p.page.waitForFunction((k) => Boolean(window.leogames.scene.getScene(k)?.game3d), key, { timeout: ms(30000) });
    await p.holdToMenu(0, EXIT, `salir de ${title}`);
    assert.equal(await p.page.evaluate(() => document.querySelectorAll('body > div[style*="z-index"]').length), 0, `${title} dejó su capa 3D`);
  }

  await p.openGameCard('Fútbol de bolitas');
  await p.pickCharacters(1);
  await p.until(() => window.leogames.scene.getScene('Futbol')?.phase === 'setup', ms(8000), 'ver la pantalla de equipos');
  await p.tap(0, BUTTON.B);
  await p.until(() => window.leogames.scene.isActive('Menu'), ms(6000), 'salir del fútbol');

  await p.openGameCard('Duelo de bolitas');
  await p.pickCharacters(1);
  await p.until(() => window.leogames.scene.getScene('Duelo')?.phase === 'setup', ms(8000), 'ver la pantalla del duelo');
  await p.tap(0, BUTTON.B);
  await p.until(() => window.leogames.scene.isActive('Menu'), ms(6000), 'salir del duelo');

  await p.openGameCard('Modo Bebé');
  await p.page.waitForFunction(() => window.leogames.scene.isActive('Baby'), null, { timeout: ms(8000) });
  await p.holdToMenu(0, EXIT, 'salir del Modo Bebé');

  await p.openGameCard('Mis premios');
  await p.page.waitForFunction(() => window.leogames.scene.isActive('Premios'), null, { timeout: ms(8000) });
  await p.tap(0, BUTTON.B);
  await p.until(() => window.leogames.scene.isActive('Menu'), ms(6000), 'salir de Mis premios');

  // "Cómo jugar": se pasan todas las páginas (las teclas salen de controls.js), Y abre la prueba de controles.
  await p.openGameCard('Cómo jugar');
  await p.page.waitForFunction(() => window.leogames.scene.isActive('Controles'), null, { timeout: ms(8000) });
  const pages = await p.page.evaluate(() => window.leogames.scene.getScene('Controles').dots.length);
  for (let i = 1; i < pages; i += 1) await p.tap(0, BUTTON.RIGHT);
  assert.equal(await p.page.evaluate(() => window.leogames.scene.getScene('Controles').page), pages - 1);
  await p.tap(0, BUTTON.B);
  await p.until(() => window.leogames.scene.isActive('Menu'), ms(6000), 'salir de Cómo jugar');
  await p.openGameCard('Cómo jugar');
  await p.page.waitForFunction(() => window.leogames.scene.isActive('Controles'), null, { timeout: ms(8000) });
  await p.tap(0, BUTTON.Y);
  await p.page.waitForFunction(() => window.leogames.scene.isActive('PadTest'), null, { timeout: ms(8000) });
  await p.holdToMenu(0, [BUTTON.B], 'salir de la prueba de controles');

  assert.deepEqual(p.errors, []);
  await p.context.close();
});

// Bot de Pelea en equipo: cada luchador va hacia el monstruo más cercano, le pega y salta cuando avisa con "!".
// Con `invincible`, nadie cae (para probar a los jefes sin depender de la suerte).
function startBrawlBot(page, { invincible = false } = {}) {
  return page.evaluate((invincibleBots) => {
    let tick = 0;
    window.__bot = setInterval(() => {
      const s = window.leogames.scene.getScene('Brawl');
      if (!s.sys.isActive() || !s.fighters) return;
      tick += 1;
      for (const f of s.fighters) {
        if (invincibleBots) f.invulnerableMs = 1000;
        // (Los amigos de la compu juegan solos.)
        if (!f.deviceId) continue;
        const pad = window.__pads[Number(f.deviceId.replace('pad', ''))];
        const set = (b, v) => ((pad.buttons[b].pressed = v), (pad.buttons[b].value = v ? 1 : 0));
        set(0, false);
        set(2, false);
        pad.axes = [0, 0, 0, 0];
        if (f.down) continue;
        // Ronda limpia: a caminar al siguiente tramo.
        if (s.phase === 'walk') {
          pad.axes = [1, 0, 0, 0];
          continue;
        }
        const downed = s.fighters.find((o) => o.down);
        if (downed && s.fighters.filter((o) => !o.down)[0] === f) {
          pad.axes = [Math.sign(downed.x - f.x), Math.sign(downed.y - f.y), 0, 0];
          continue;
        }
        let t = null;
        let best = Infinity;
        for (const m of s.monsters) {
          const d = Math.hypot(m.x - f.x, m.y - f.y);
          if (!m.dead && m.entered && d < best) [t, best] = [m, d];
        }
        if (!t) continue;
        const dir = Math.sign(t.x - f.x) || 1;
        const goalX = t.x - dir * (f.radius + t.radius + 12);
        pad.axes = [Math.abs(goalX - f.x) < 8 ? dir * 0.3 : Math.max(-1, Math.min(1, (goalX - f.x) / 30)), Math.max(-1, Math.min(1, (t.y - f.y) / 20)), 0, 0];
        set(2, Math.abs(t.y - f.y) < 25 && Math.abs(t.x - f.x) < f.radius + t.radius + 30 && tick % 2 === 0);
        set(0, s.monsters.some((m) => m.state === 'windup' && Math.hypot(m.x - f.x, m.y - f.y) < 120) && tick % 6 === 0);
      }
    }, 50);
  }, invincible);
}

const stopBot = (page) => page.evaluate(() => clearInterval(window.__bot));
const brawl = (page) => page.evaluate(() => {
  const s = window.leogames.scene.getScene('Brawl');
  return { phase: s.phase, world: s.worldIndex, wave: s.waveIndex };
});

test('pelea en equipo: dos bots ganan las rondas', { timeout: ms(420000) }, async () => {
  const p = await openPage(game);
  await p.joinPlayers(2);
  await p.openGameCard('Pelea en equipo');
  await p.pickCharacters(2);
  await p.until(() => window.leogames.scene.getScene('Brawl')?.phase === 'map', ms(8000), 'ver el mapa');
  // En el mapa ya está escogida la Pradera: A = ¡a pelear!
  await p.tap(0, BUTTON.A);
  await p.until(() => window.leogames.scene.getScene('Brawl').phase === 'fight', ms(8000), 'empezar en la Pradera');
  assert.equal((await brawl(p.page)).world, 0);
  await startBrawlBot(p.page);
  if (process.env.CI) {
    // En GitHub va lento: basta con que pasen la primera ronda.
    await p.until(() => JSON.parse(localStorage.getItem('leogames:stickers') ?? '[]').includes('pelea-ronda'), ms(60000), 'pasar la primera ronda');
  } else {
    // (Corriendo todas las pruebas juntas la compu va más lenta: se le da tiempo de sobra.)
    await p.until(() => window.leogames.scene.getScene('Brawl').phase === 'results', 380000, 'ganar las 4 rondas (caminando de tramo en tramo)');
    assert.ok((await stickers(p.page)).includes('pelea-gana'));
    // Con A se sigue al Bosque de hongos.
    await stopBot(p.page);
    await p.until(() => window.leogames.scene.getScene('Brawl').endMs > 1300, ms(10000), 'que los resultados acepten botones');
    await p.holdUntil(0, [BUTTON.A], () => window.leogames.scene.getScene('Brawl').worldIndex === 1, 'pasar al segundo mundo');
    assert.deepEqual(await brawl(p.page), { phase: 'fight', world: 1, wave: 0 });
  }
  await stopBot(p.page);
  assert.deepEqual(p.errors, []);
  await p.context.close();
});

test('pelea en equipo: escoger mundo y los jefes del bosque y del volcán', { timeout: ms(240000) }, async () => {
  const p = await openPage(game);
  await p.page.evaluate(() => import('/src/shared/settings.js').then((m) => m.settings.set('stickers', ['pelea-gana', 'pelea-hongos'])));
  await p.joinPlayers(2);
  await p.openGameCard('Pelea en equipo');
  await p.pickCharacters(2);
  await p.until(() => window.leogames.scene.getScene('Brawl')?.phase === 'map', ms(8000), 'ver el mapa');
  // Se anotan los poderes que usan los jefes.
  await p.page.evaluate(() => {
    const s = window.leogames.scene.getScene('Brawl');
    window.__powers = new Set();
    const original = s.handleMonsterRequests.bind(s);
    s.handleMonsterRequests = () => {
      for (const m of s.monsters) if (m.request) window.__powers.add(m.request.kind);
      if (s.fireballs.length > 0) window.__powers.add('fuego en pantalla');
      original();
    };
  });
  // Directo a la ronda del jefe, con los bots jugando.
  const bossWave = async () => {
    await p.page.evaluate(() => {
      const s = window.leogames.scene.getScene('Brawl');
      s.clearEnemies();
      s.startWave(3);
    });
    await startBrawlBot(p.page, { invincible: true });
  };

  await p.tap(0, BUTTON.RIGHT);
  await p.tap(0, BUTTON.A);
  await p.until(() => window.leogames.scene.getScene('Brawl').worldIndex === 1, ms(6000), 'entrar al bosque');
  await bossWave();
  await p.until(() => window.__powers.has('summon'), ms(90000), 'el Gran Hongo llama ayudantes');
  await p.until(() => window.leogames.scene.getScene('Brawl').phase === 'results', ms(120000), 'vencer al Gran Hongo');

  // El Volcán ya está desbloqueado: se sigue con A y se vence al dragón.
  await stopBot(p.page);
  await p.until(() => window.leogames.scene.getScene('Brawl').endMs > 1300, ms(10000), 'que los resultados acepten botones');
  await p.holdUntil(0, [BUTTON.A], () => window.leogames.scene.getScene('Brawl').worldIndex === 2, 'pasar al volcán');
  await bossWave();
  await p.until(() => window.__powers.has('fuego en pantalla'), ms(90000), 'el dragón lanza fuego');
  if (!process.env.CI) {
    await p.until(() => window.leogames.scene.getScene('Brawl').phase === 'results', 150000, 'vencer al dragón');
    assert.ok((await stickers(p.page)).includes('pelea-volcan'));
  }
  await stopBot(p.page);
  assert.deepEqual(p.errors, []);
  await p.context.close();
});

// Lo nuevo de la pelea: agarrar y aventar, especial, súper, cajas con objetos y el modo sin fin.
test('pelea en equipo: agarre, especial, súper, cajas y modo sin fin', { timeout: ms(120000) }, async () => {
  const p = await openPage(game);
  await p.joinPlayers(1);
  await p.openGameCard('Pelea en equipo');
  await p.pickCharacters(1);
  await p.until(() => window.leogames.scene.getScene('Brawl')?.phase === 'map', ms(8000), 'ver el mapa');
  // ◀ desde la Pradera da la vuelta al último lugar: el modo sin fin.
  await p.tap(0, BUTTON.LEFT);
  await p.tap(0, BUTTON.A);
  await p.until(() => window.leogames.scene.getScene('Brawl').phase === 'fight' && window.leogames.scene.getScene('Brawl').endless, ms(8000), 'empezar el modo sin fin');
  await p.until(() => window.leogames.scene.getScene('Brawl').monsters.some((m) => m.entered), ms(15000), 'que llegue un monstruo');
  // Un monstruo enfrente: RB lo agarra y X lo avienta.
  await p.page.evaluate(() => {
    const s = window.leogames.scene.getScene('Brawl');
    const f = s.fighters[0];
    f.invulnerableMs = 1e9;
    const m = s.monsters.find((mm) => mm.entered);
    Object.assign(m, { x: f.x + 70, y: f.y, state: 'rest', stateMs: 2000 });
    f.facing = 1;
  });
  await p.tap(0, BUTTON.RB);
  await p.until(() => Boolean(window.leogames.scene.getScene('Brawl').fighters[0].holding), ms(3000), 'agarrar al monstruo');
  await p.tap(0, BUTTON.X);
  await p.until(() => window.leogames.scene.getScene('Brawl').monsters.some((m) => m.state === 'thrown') || !window.leogames.scene.getScene('Brawl').fighters[0].holding, ms(3000), 'aventarlo');
  // B = especial (se recarga).
  await p.wait(400);
  await p.tap(0, BUTTON.B);
  await p.until(() => window.leogames.scene.getScene('Brawl').fighters[0].specialCooldownMs > 0, ms(3000), 'usar el especial');
  // Barra llena + LB + RB = súper.
  await p.page.evaluate(() => (window.leogames.scene.getScene('Brawl').fighters[0].meter = 100));
  await p.page.evaluate(() => (window.__button(0, 4, true), window.__button(0, 5, true)));
  await p.until(() => window.leogames.scene.getScene('Brawl').fighters[0].superMs > 0, ms(3000), 'volverse súper');
  await p.page.evaluate(() => (window.__button(0, 4, false), window.__button(0, 5, false)));
  // Una caja rota suelta algo.
  await p.page.evaluate(() => {
    const s = window.leogames.scene.getScene('Brawl');
    const box = s.props.breakables[0];
    s.props.hitAt(box.x, box.y, 10, { attackId: 1 });
    s.props.hitAt(box.x, box.y, 10, { attackId: 2 });
  });
  assert.ok(await p.page.evaluate(() => window.leogames.scene.getScene('Brawl').props.items.length > 0), 'la caja no soltó nada');
  // Si todos caen, se acaba: cuántas rondas aguantaron.
  await p.page.evaluate(() => {
    const f = window.leogames.scene.getScene('Brawl').fighters[0];
    f.invulnerableMs = 0;
    f.starMs = 0;
    f.hp = 1;
    f.hurt(f.x + 10);
  });
  await p.until(() => window.leogames.scene.getScene('Brawl').phase === 'results', ms(5000), 'ver cuántas rondas aguantaron');
  await p.holdToMenu(0, EXIT, 'salir de la pelea');
  assert.deepEqual(p.errors, []);
  await p.context.close();
});

// Pelea en equipo, ronda 3: amigos de la compu, tienda, montar, mini jefe, monedas con imán, objetos nuevos, jaula,
// combo doble y los jefes en serie (el jefe se enoja y se ve la repetición del K.O.).
test('pelea en equipo: amigos de la compu, tienda, montar, objetos, jaula y jefes en serie', { timeout: ms(150000) }, async () => {
  const p = await openPage(game);
  await p.page.evaluate(() =>
    import('/src/shared/settings.js').then((m) => {
      m.settings.set('brawlCoins', 50);
      m.settings.set('brawlStars', { 0: 1 });
    }),
  );
  await p.joinPlayers(1);
  await p.openGameCard('Pelea en equipo');
  await p.pickCharacters(1);
  await p.until(() => window.leogames.scene.getScene('Brawl')?.phase === 'map', ms(8000), 'ver el mapa');
  const scene = (fn, arg) => p.page.evaluate(fn, arg);

  // Y dos veces = 2 amigos de la compu.
  await p.tap(0, BUTTON.Y);
  await p.tap(0, BUTTON.Y);
  assert.equal(await scene(() => JSON.parse(localStorage.getItem('leogames:brawlBuddies'))), 2);
  // X = tienda: A compra el sombrero vaquero (20 monedas) y se lo pone; B regresa al mapa.
  await p.tap(0, BUTTON.X);
  await p.until(() => window.leogames.scene.getScene('Brawl').phase === 'shop', ms(3000), 'abrir la tienda');
  await p.tap(0, BUTTON.A);
  const wardrobe = await scene(() => JSON.parse(localStorage.getItem('leogames:brawlWardrobe')));
  assert.deepEqual(wardrobe.owned, ['sombrero-vaquero']);
  assert.equal(Object.values(wardrobe.worn)[0].hat, 'sombrero-vaquero');
  assert.equal(await scene(() => JSON.parse(localStorage.getItem('leogames:brawlCoins'))), 30);
  await p.tap(0, BUTTON.B);
  await p.until(() => window.leogames.scene.getScene('Brawl').phase === 'map', ms(3000), 'regresar al mapa');

  // A la Pradera: pelean el jugador y sus 2 amigos de la compu (que pegan solos).
  await p.tap(0, BUTTON.A);
  await p.until(() => window.leogames.scene.getScene('Brawl').phase === 'fight', ms(8000), 'empezar en la Pradera');
  assert.deepEqual(await scene(() => window.leogames.scene.getScene('Brawl').fighters.map((f) => [f.isCpu, f.label])), [[false, 'J1'], [true, 'C1'], [true, 'C2']]);
  assert.ok(await scene(() => Boolean(window.leogames.scene.getScene('Brawl').fighters[0].hat)), 'no trae el sombrero');
  await scene(() => (window.leogames.scene.getScene('Brawl').fighters[0].invulnerableMs = 1e9));
  await p.until(() => window.leogames.scene.getScene('Brawl').fighters.some((f) => f.isCpu && f.stats.hits > 0), ms(30000), 'que la compu pegue');

  // Segundo tramo: el dinosaurio para montar, las trampas y el mini jefe al final.
  await scene(() => {
    const s = window.leogames.scene.getScene('Brawl');
    s.clearEnemies();
    s.startWave(1);
  });
  assert.ok(await scene(() => window.leogames.scene.getScene('Brawl').spawnQueue.at(-1) === 'mini:slimeGrande'), 'no viene el mini jefe');
  await scene(() => {
    const s = window.leogames.scene.getScene('Brawl');
    const m = s.mounts.list[0];
    Object.assign(s.fighters[0], { x: m.x, y: m.y, z: 0 });
  });
  await p.until(() => Boolean(window.leogames.scene.getScene('Brawl').fighters[0].mount), ms(3000), 'subirse al dinosaurio');
  assert.ok((await stickers(p.page)).includes('pelea-montar'));
  // El mini jefe sale, tiene su barra, y al caer suelta monedas que el imán jala.
  await scene(() => {
    const s = window.leogames.scene.getScene('Brawl');
    for (const m of s.monsters) m.destroy();
    s.monsters = [];
    s.spawnQueue = ['mini:slimeGrande'];
    s.spawnMs = 0;
  });
  await p.until(() => window.leogames.scene.getScene('Brawl').monsters.some((m) => m.mini), ms(3000), 'que salga el mini jefe');
  assert.ok(await scene(() => window.leogames.scene.getScene('Brawl').boss?.mini), 'el mini jefe no tiene barra');
  await scene(() => {
    const s = window.leogames.scene.getScene('Brawl');
    const f = s.fighters[0];
    const m = s.monsters.find((mm) => mm.mini);
    Object.assign(m, { x: f.x + 150, y: f.y });
    f.magnetMs = 15000;
    s.hitMonster(f, m, 999);
  });
  await p.until(() => window.leogames.scene.getScene('Brawl').fighters[0].stats.coins >= 5, ms(8000), 'juntar las monedas del mini jefe con el imán');

  // Objetos nuevos: espada (pega doble y más lejos), escudo (aguanta golpes) y mascota.
  const items = await scene(() => {
    const s = window.leogames.scene.getScene('Brawl');
    const f = s.fighters[0];
    s.mounts.runAway(f.mount);
    f.item = null;
    const reach = f.reach;
    s.props.take(f, { kind: 'sword', x: f.x, y: f.y });
    s.props.take(f, { kind: 'shield', x: f.x, y: f.y });
    s.props.take(f, { kind: 'pet', x: f.x, y: f.y });
    // (En el piso y sin nada que lo proteja: brincando, un golpe no le pega.)
    Object.assign(f, { invulnerableMs: 0, z: 0, down: false, starMs: 0, ghostMs: 0 });
    const hp = f.hp;
    f.hurt(f.x + 10);
    return { sword: f.item?.type, longer: f.reach > reach, power: f.power, shield: f.shieldHits, hp: f.hp === hp, pets: s.pets.list.length };
  });
  assert.deepEqual(items, { sword: 'sword', longer: true, power: 2, shield: 2, hp: true, pets: 1 });

  // La jaula: tres golpes y el amigo de adentro se une al equipo.
  await scene(() => {
    const s = window.leogames.scene.getScene('Brawl');
    const f = s.fighters[0];
    s.props.placeCage(f.x + 100, f.y, 'ninja');
    const cage = s.props.breakables.find((b) => b.cage);
    for (let i = 0; i < 3; i += 1) s.props.hitAt(cage.x, cage.y, 10, { attackId: `t${i}`, stats: f.stats });
  });
  assert.deepEqual(await scene(() => window.leogames.scene.getScene('Brawl').fighters.filter((f) => f.rescued).map((f) => f.label)), ['Ninja']);
  assert.ok((await stickers(p.page)).includes('pelea-rescate'));

  // Combo doble: un amigo avienta un monstruo y el jugador le pega en el aire (cuenta doble en el combo).
  const combo = await scene(async () => {
    const { Monster } = await import('/src/games/brawl/Monster.js');
    const s = window.leogames.scene.getScene('Brawl');
    for (const m of s.monsters) m.destroy();
    s.monsters = [];
    s.spawnQueue = [];
    const f = s.fighters[0];
    for (const other of s.fighters) other.attackMs = 0;
    const m = new Monster(s, 'slime', f.x + 60, f.y);
    m.entered = true;
    m.throwTo(-1);
    m.thrownBy = s.fighters[1];
    s.monsters.push(m);
    f.facing = 1;
    f.attackMs = 160;
    f.hitThisAttack.clear();
    const before = s.combo.count;
    s.resolveHits();
    return s.combo.count - before;
  });
  assert.equal(combo, 2);

  // Jefes en serie (ya se ganó la Pradera): el Rey Slime se enoja a la mitad y su K.O. se repite en cámara lenta.
  await p.holdToMenu(0, EXIT, 'salir de la pelea');
  await p.openGameCard('Pelea en equipo');
  await p.pickCharacters(1);
  await p.until(() => window.leogames.scene.getScene('Brawl')?.phase === 'map', ms(8000), 'ver el mapa otra vez');
  await p.tap(0, BUTTON.LEFT);
  await p.tap(0, BUTTON.LEFT);
  await p.tap(0, BUTTON.A);
  await p.until(() => window.leogames.scene.getScene('Brawl').bossRush && window.leogames.scene.getScene('Brawl').boss?.type.boss, ms(15000), 'que llegue el primer jefe');
  await scene(() => {
    const s = window.leogames.scene.getScene('Brawl');
    for (const f of s.fighters) f.invulnerableMs = 1e9;
    s.boss.hp = Math.floor(s.boss.maxHp * 0.4);
  });
  await p.until(() => window.leogames.scene.getScene('Brawl').boss?.angry, ms(3000), 'que el jefe se enoje');
  await p.wait(900);
  await scene(() => {
    const s = window.leogames.scene.getScene('Brawl');
    s.hitMonster(s.fighters[0], s.boss, 999);
  });
  await p.until(() => window.leogames.scene.getScene('Brawl').phase === 'replay', ms(3000), 'ver la repetición');
  await p.until(() => window.leogames.scene.getScene('Brawl').phase === 'results', ms(15000), 'terminar los jefes en serie');
  assert.ok((await stickers(p.page)).includes('pelea-jefes'));
  assert.ok(await scene(() => JSON.parse(localStorage.getItem('leogames:brawlRecords')).bossRush > 0), 'no se guardó el tiempo');
  assert.equal(await scene(() => window.leogames.scene.getScene('Brawl').cameras.main.zoom), 1);
  await p.holdToMenu(0, EXIT, 'salir de la pelea');
  assert.deepEqual(p.errors, []);
  await p.context.close();
});

test('personajes: lo que escoges se usa en la pelea, el fútbol y Bolitas Bros', { timeout: ms(90000) }, async () => {
  const p = await openPage(game);
  await p.joinPlayers(2);
  await p.openGameCard('Pelea en equipo');
  await p.page.waitForFunction(() => window.leogames.scene.isActive('Personajes'), null, { timeout: ms(8000) });
  // El Jugador 1 empieza en Tanque: dos a la derecha es Resorte. El Jugador 2 se queda con Rayo.
  await p.tap(0, BUTTON.RIGHT);
  await p.tap(0, BUTTON.RIGHT);
  await p.tap(0, BUTTON.A);
  await p.tap(1, BUTTON.A);
  await p.page.waitForFunction(() => window.leogames.scene.isActive('Brawl'), null, { timeout: ms(8000) });
  const looks = await p.page.evaluate(() =>
    window.leogames.scene.getScene('Brawl').fighters.map((f) => [f.look.character, f.look.image?.texture.key ?? null]),
  );
  assert.deepEqual(looks, [['resorte', 'smash:resorte-normal'], ['rayo', 'smash:rayo-normal']]);
  await p.holdToMenu(0, EXIT, 'salir de Pelea en equipo');

  // En el fútbol ya salen escogidos.
  await p.openGameCard('Fútbol de bolitas');
  await p.page.waitForFunction(() => window.leogames.scene.isActive('Personajes'), null, { timeout: ms(8000) });
  assert.deepEqual(await p.page.evaluate(() => window.leogames.scene.getScene('Personajes').cards.map((c) => c.pick)), ['resorte', 'rayo']);
  await p.pickCharacters(2);
  await p.until(() => window.leogames.scene.getScene('Futbol')?.phase === 'setup', ms(8000), 'ver la pantalla de equipos');
  assert.match(await p.page.evaluate(() => window.leogames.scene.getScene('Futbol').rosterText[0].text), /J1 · Resorte/);
  await p.tap(0, BUTTON.B);
  await p.until(() => window.leogames.scene.isActive('Menu'), ms(6000), 'salir del fútbol');

  // Y en Bolitas Bros también.
  await p.openGameCard('Bolitas Bros');
  await p.page.waitForFunction(() => window.leogames.scene.isActive('SmashSelect'), null, { timeout: ms(8000) });
  assert.equal(await p.page.evaluate(() => window.leogames.scene.getScene('SmashSelect').humanSlots[0].pick), 'resorte');
  await p.tap(0, BUTTON.B);
  await p.until(() => window.leogames.scene.isActive('Menu'), ms(6000), 'salir de la selección');
  assert.deepEqual(p.errors, []);
  await p.context.close();
});

test('bolitas bros: pelea contra el CPU, revancha y salir', { timeout: ms(120000) }, async () => {
  const p = await openPage(game);
  await p.joinPlayers(1);
  await p.openGameCard('Bolitas Bros');
  await p.page.waitForFunction(() => window.leogames.scene.isActive('SmashSelect'), null, { timeout: ms(8000) });
  await p.tap(0, BUTTON.A);
  await p.until(() => window.leogames.scene.getScene('Smash').phase === 'fight', ms(10000), 'empezar la pelea');
  // Camina hacia el CPU pegando hasta que alguien reciba daño.
  await p.page.evaluate(() => {
    window.__bot = setInterval(() => {
      const s = window.leogames.scene.getScene('Smash');
      const [me, cpu] = s.fighters;
      const pad = window.__pads[0];
      pad.axes = [Math.sign(cpu.x - me.x), 0, 0, 0];
      pad.buttons[2].pressed = !pad.buttons[2].pressed;
    }, 120);
  });
  await p.until(() => window.leogames.scene.getScene('Smash').fighters.some((f) => f.damage > 0), ms(30000), 'que alguien reciba daño');
  await p.page.evaluate(() => {
    clearInterval(window.__bot);
    window.__release();
    window.__pads[0].axes = [0, 0, 0, 0];
    window.leogames.scene.getScene('Smash').fighters[1].stocks = 0;
  });
  await p.until(() => window.leogames.scene.getScene('Smash').phase === 'end', ms(5000), 'terminar la pelea');
  assert.ok((await stickers(p.page)).includes('smash-gana'));
  await p.until(() => window.leogames.scene.getScene('Smash').phaseMs > 1600, ms(10000), 'que se pueda pedir revancha');
  await p.tap(0, BUTTON.A);
  await p.until(() => window.leogames.scene.getScene('Smash').phase === 'countdown', ms(5000), 'revancha');
  await p.holdToMenu(0, EXIT, 'salir de Bolitas Bros');
  assert.deepEqual(p.errors, []);
  await p.context.close();
});

// Agarrar y aventar, agarrarse de la orilla, la bola súper con su golpe final y los resultados con el podio.
test('bolitas bros: agarre, orilla, bola súper y resultados', { timeout: ms(120000) }, async () => {
  const p = await openPage(game);
  await p.joinPlayers(1);
  await p.openGameCard('Bolitas Bros');
  await p.page.waitForFunction(() => window.leogames.scene.isActive('SmashSelect'), null, { timeout: ms(8000) });
  await p.tap(0, BUTTON.A);
  await p.until(() => window.leogames.scene.getScene('Smash').phase === 'fight', ms(15000), 'empezar la pelea');
  // La compu se queda quieta.
  await p.page.evaluate(() => {
    const s = window.leogames.scene.getScene('Smash');
    s.cpuInput = () => ({ x: 0, y: 0, jump: false, attack: false, special: false, shield: false, transform: false });
  });
  // Escudo + X pegadito: agarra (aunque el otro se cubra) y luego lo avienta.
  await p.page.evaluate(() => {
    const [me, cpu] = window.leogames.scene.getScene('Smash').fighters;
    Object.assign(me, { x: cpu.x - (me.radius + cpu.radius) - 4, y: cpu.y, facing: 1, vx: 0 });
  });
  await p.page.evaluate(() => window.__button(0, 5, true));
  await p.tap(0, BUTTON.X);
  await p.until(() => window.leogames.scene.getScene('Smash').fighters[1].heldBy, ms(3000), 'agarrar a la compu');
  await p.page.evaluate(() => window.__button(0, 5, false));
  await p.until(() => window.leogames.scene.getScene('Smash').fighters[1].damage > 0, ms(3000), 'aventarla');

  // Cayendo junto a la orilla: se agarra; con A se sube.
  await p.until(() => window.leogames.scene.getScene('Smash').fighters[0].hitstunMs === 0, ms(3000), 'reponerse');
  await p.page.evaluate(() => {
    const s = window.leogames.scene.getScene('Smash');
    const me = s.fighters[0];
    Object.assign(me, { x: s.main.left - me.radius * 1.1, y: s.main.top - me.radius * 0.5, vx: 0, vy: 200, grounded: false, platform: null, attack: null });
  });
  await p.until(() => window.leogames.scene.getScene('Smash').fighters[0].hanging, ms(3000), 'agarrarse de la orilla');
  await p.tap(0, BUTTON.A);
  await p.until(() => window.leogames.scene.getScene('Smash').fighters[0].grounded, ms(3000), 'subirse al escenario');

  // La bola súper: tres golpes la rompen y con B sale el golpe final.
  await p.page.evaluate(() => {
    const s = window.leogames.scene.getScene('Smash');
    s.superBall.spawn();
    const me = s.fighters[0];
    for (let i = 0; i < 3; i += 1) if (s.superBall.hit(me)) me.finalReady = true;
  });
  assert.ok(await p.page.evaluate(() => window.leogames.scene.getScene('Smash').fighters[0].finalReady), 'la bola súper se rompió');
  await p.tap(0, BUTTON.B);
  await p.until(() => window.leogames.scene.getScene('Smash').phase === 'final', ms(3000), 'golpe final');
  await p.until(() => window.leogames.scene.getScene('Smash').phase === 'fight', ms(6000), 'terminar el golpe final');
  assert.ok((await stickers(p.page)).includes('smash-final'));

  // Al terminar, el podio.
  await p.page.evaluate(() => (window.leogames.scene.getScene('Smash').players[1].stocks = 0));
  await p.until(() => window.leogames.scene.getScene('Smash').phase === 'end', ms(5000), 'terminar la pelea');
  assert.ok(await p.page.evaluate(() => Boolean(window.leogames.scene.getScene('Smash').results)), 'sin podio');
  await p.holdToMenu(0, EXIT, 'salir de Bolitas Bros');
  assert.deepEqual(p.errors, []);
  await p.context.close();
});

// Modos: por equipos (no le pegas a tu compañero), jefe gigante, por tiempo y rompe los blancos.
test('bolitas bros: equipos, jefe, tiempo y blancos', { timeout: ms(240000) }, async () => {
  const p = await openPage(game);
  await p.joinPlayers(2);
  const play = async (mode, check, finish) => {
    await p.openGameCard('Bolitas Bros');
    await p.page.waitForFunction(() => window.leogames.scene.isActive('SmashSelect'), null, { timeout: ms(8000) });
    await p.page.evaluate((m) => {
      const s = window.leogames.scene.getScene('SmashSelect');
      s.settings.mode = m;
      s.fixCpus();
      s.refreshOptions();
      s.layoutCards();
    }, mode);
    await p.tap(0, BUTTON.A);
    await p.tap(1, BUTTON.A);
    await p.until(() => window.leogames.scene.getScene('Smash')?.sys.isActive() && window.leogames.scene.getScene('Smash').phase === 'fight', ms(15000), `pelear: ${mode}`);
    assert.ok(await p.page.evaluate(check), `revisar ${mode}`);
    await p.page.evaluate(finish);
    await p.until(() => window.leogames.scene.getScene('Smash').phase === 'end', ms(8000), `terminar: ${mode}`);
    await p.holdToMenu(0, EXIT, 'salir de Bolitas Bros');
  };
  await play(
    'equipos',
    () => {
      const [j1, j2] = window.leogames.scene.getScene('Smash').fighters;
      return j1.team === 0 && j2.team === 1;
    },
    () => {
      const s = window.leogames.scene.getScene('Smash');
      for (const f of s.players) if (f.team === 1) f.stocks = 0;
    },
  );
  await play(
    'jefe',
    () => {
      const s = window.leogames.scene.getScene('Smash');
      return s.boss?.isBoss && s.boss.team === 1 && s.fighters.filter((f) => !f.isBoss).every((f) => f.team === 0);
    },
    () => (window.leogames.scene.getScene('Smash').boss.bossHp = 0),
  );
  assert.ok((await stickers(p.page)).includes('smash-jefe'));
  await play(
    'tiempo',
    () => window.leogames.scene.getScene('Smash').timeMs > 100000,
    () => (window.leogames.scene.getScene('Smash').timeMs = 1),
  );
  await play(
    'blancos',
    () => window.leogames.scene.getScene('Smash').targets.length === 10,
    () => {
      const s = window.leogames.scene.getScene('Smash');
      for (const t of s.targets) s.breakTarget(t, s.players[0]);
    },
  );
  assert.ok((await stickers(p.page)).includes('smash-blancos'));
  assert.deepEqual(p.errors, []);
  await p.context.close();
});

// Personajes nuevos: su especial le tiene que pegar a un rival que está enfrente.
const NEW_CHARACTERS = ['dino', 'gatito', 'pinguino', 'pirata', 'hada', 'astronauta', 'abeja', 'bombero'];

test('bolitas bros: el especial de cada personaje nuevo pega', { timeout: ms(240000) }, async () => {
  const p = await openPage(game);
  await p.joinPlayers(2);
  for (const character of NEW_CHARACTERS) {
    await p.page.evaluate((c) => import('/src/shared/picks.js').then((m) => (m.characterPicks.set('pad0', c), m.characterPicks.set('pad1', 'tanque'))), character);
    await p.openGameCard('Bolitas Bros');
    await p.page.waitForFunction(() => window.leogames.scene.isActive('SmashSelect'), null, { timeout: ms(8000) });
    await p.tap(0, BUTTON.A);
    await p.tap(1, BUTTON.A);
    await p.until(() => { const s = window.leogames.scene.getScene('Smash'); return s.sys.isActive() && s.phase === 'fight'; }, ms(10000), `pelear con ${character}`);
    await p.page.evaluate(() => {
      const [me, rival] = window.leogames.scene.getScene('Smash').fighters;
      Object.assign(me, { x: 900, vx: 0, facing: 1 });
      Object.assign(rival, { x: 1000, vx: 0, facing: -1 });
      me.startSpecial({ x: 0, y: 0 });
    });
    await p.until(() => window.leogames.scene.getScene('Smash').fighters[1].damage > 0, ms(4000), `que el especial de ${character} pegue`);
    assert.equal(await p.page.evaluate(() => window.leogames.scene.getScene('Smash').fighters[0].characterKey), character);
    await p.holdToMenu(0, EXIT, 'salir de Bolitas Bros');
  }
  assert.deepEqual(p.errors, []);
  await p.context.close();
});

// Bloquecito: Y sube de número, ↓ + Y baja (del 1 da la vuelta al 10), cada número tiene su tamaño y su truco,
// y con la barra llena se vuelve Octobloque.
test('bloquecito: cambia de número con Y y el truco de cada número pega', { timeout: ms(240000) }, async () => {
  const p = await openPage(game);
  await p.joinPlayers(2);
  await p.page.evaluate(() => import('/src/shared/picks.js').then((m) => (m.characterPicks.set('pad0', 'bloquecito'), m.characterPicks.set('pad1', 'tanque'))));
  await p.openGameCard('Bolitas Bros');
  await p.page.waitForFunction(() => window.leogames.scene.isActive('SmashSelect'), null, { timeout: ms(8000) });
  await p.tap(0, BUTTON.A);
  await p.tap(1, BUTTON.A);
  await p.until(() => { const s = window.leogames.scene.getScene('Smash'); return s.sys.isActive() && s.phase === 'fight'; }, ms(10000), 'pelear con Bloquecito');
  const me = () => p.page.evaluate(() => { const f = window.leogames.scene.getScene('Smash').fighters[0]; return { n: f.look.form, weight: f.weight }; });

  assert.equal((await me()).n, 1);
  const light = (await me()).weight;
  await p.tap(0, BUTTON.Y);
  await p.until(() => window.leogames.scene.getScene('Smash').fighters[0].look.form === 2, ms(3000), 'subir al 2 con Y');
  await p.page.evaluate(() => window.__button(0, 13, true));
  await p.tap(0, BUTTON.Y);
  await p.tap(0, BUTTON.Y);
  await p.page.evaluate(() => window.__button(0, 13, false));
  await p.until(() => window.leogames.scene.getScene('Smash').fighters[0].look.form === 10, ms(3000), 'bajar del 2 al 10 con ↓ + Y');
  assert.ok((await me()).weight > light, 'el 10 pesa más que el 1');

  // Cada número: su truco le pega al rival (los malabares del 3 caen lejos).
  for (const n of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 'octo']) {
    await p.page.evaluate((form) => {
      const s = window.leogames.scene.getScene('Smash');
      const [bloque, rival] = s.fighters;
      if (form === 'octo') {
        bloque.meter = 100;
        bloque.transform();
        bloque.transformMs = 0;
      } else {
        bloque.look.setNumber(form);
        bloque.applyForm();
      }
      const place = (f, x, facing) =>
        Object.assign(f, { x, y: s.main.top - f.radius, vx: 0, vy: 0, facing, grounded: true, platform: s.main, attack: null, hitstunMs: 0, stunMs: 0, dashMs: 0, slideMs: 0, rocketMs: 0, cooldownMs: 0, invulnerableMs: 0, damage: 0 });
      place(bloque, 800, 1);
      place(rival, form === 3 ? 1280 : 880, -1);
      s.projectiles.forEach((shot) => shot.sprite.destroy());
      s.projectiles = [];
      bloque.startSpecial({ x: 0, y: 0 });
    }, n);
    await p.until(() => window.leogames.scene.getScene('Smash').fighters[1].damage > 0, ms(4000), `que el truco del ${n} pegue`);
  }
  assert.equal((await me()).n, 'octo');
  // Siendo Octobloque, Y no le cambia el número.
  await p.tap(0, BUTTON.Y);
  assert.equal((await me()).n, 'octo');
  await p.holdToMenu(0, EXIT, 'salir de Bolitas Bros');

  // En el Duelo, Y también le cambia el número (y su especial).
  await p.openGameCard('Duelo de bolitas');
  await p.pickCharacters(2);
  await p.until(() => window.leogames.scene.getScene('Duelo')?.phase === 'setup', ms(8000), 'ver la pantalla del duelo');
  await p.tap(0, BUTTON.A);
  await p.until(() => window.leogames.scene.getScene('Duelo').phase === 'fight', ms(10000), 'empezar el duelo');
  const before = await p.page.evaluate(() => window.leogames.scene.getScene('Duelo').fighters[0].look.form);
  await p.tap(0, BUTTON.Y);
  await p.until(() => window.leogames.scene.getScene('Duelo').fighters[0].look.form === 2, ms(3000), 'subir al 2 en el duelo');
  await p.page.evaluate(() => {
    const [bloque, rival] = window.leogames.scene.getScene('Duelo').fighters;
    bloque.look.setNumber(4);
    bloque.applyForm();
    Object.assign(bloque, { x: 500, facing: 1, cooldownMs: 0 });
    Object.assign(rival, { x: 500 + bloque.radius + rival.radius * 0.5, blocking: false });
    bloque.startSpecial();
  });
  await p.until(() => window.leogames.scene.getScene('Duelo').fighters[1].health < 100, ms(4000), 'que el cuadrado del 4 pegue en el duelo');
  assert.equal(before, 1);
  await p.holdToMenu(0, EXIT, 'salir del duelo');
  assert.deepEqual(p.errors, []);
  await p.context.close();
});

test('bolitas bros: escenarios desbloqueables Espacio y Volcán', { timeout: ms(120000) }, async () => {
  const p = await openPage(game);
  await p.joinPlayers(1);
  const fightOn = (stage) =>
    p.until(
      new Function(`const s = window.leogames.scene.getScene('Smash'); return s.sys.isActive() && s.phase === 'fight' && s.settings.stage === '${stage}';`),
      ms(15000),
      `pelear en ${stage}`,
    );
  // (La primera opción es el modo: ↓ pasa a la del escenario.)
  const openSelect = async () => {
    await p.openGameCard('Bolitas Bros');
    await p.page.waitForFunction(() => window.leogames.scene.isActive('SmashSelect'), null, { timeout: ms(8000) });
    await p.tap(0, BUTTON.DOWN);
  };
  const stageChoices = async (count) => {
    const choices = [];
    for (let i = 0; i < count; i += 1) {
      choices.push(await p.page.evaluate(() => window.leogames.scene.getScene('SmashSelect').settings.stage));
      await p.tap(0, BUTTON.RB);
    }
    return choices;
  };

  // Sin calcomanías solo están los 10 que no hay que ganar (y luego da la vuelta).
  const open = ['castillo', 'nubes', 'barco', 'selva', 'juguetes', 'mar', 'embrujada', 'pastel', 'ciudad', 'globos'];
  await openSelect();
  assert.deepEqual(await stageChoices(11), [...open, 'castillo']);
  await p.tap(0, BUTTON.B);
  await p.until(() => window.leogames.scene.isActive('Menu'), ms(6000), 'regresar al menú');

  // Con "Campeón" y "¡Súper!" aparecen el Espacio (gravedad baja) y el Volcán.
  await p.page.evaluate(() => import('/src/shared/settings.js').then((m) => m.settings.set('stickers', ['smash-gana', 'smash-super'])));
  await openSelect();
  assert.deepEqual(await stageChoices(12), [...open, 'espacio', 'volcan']);
  // Después de 12 toques regresa al Castillo: LB una vez es el Volcán y otra el Espacio.
  await p.tap(0, BUTTON.LB);
  await p.tap(0, BUTTON.LB);
  await p.tap(0, BUTTON.A);
  await fightOn('espacio');
  assert.equal(await p.page.evaluate(() => window.leogames.scene.getScene('Smash').fighters[0].arena.gravity), 0.55);
  await p.holdToMenu(0, EXIT, 'salir del Espacio');

  // En el Volcán, los géiseres avisan y hacen erupción (se acuerda del Espacio: RB = Volcán).
  await openSelect();
  await p.tap(0, BUTTON.RB);
  await p.tap(0, BUTTON.A);
  await fightOn('volcan');
  await p.until(() => window.leogames.scene.getScene('Smash').geysers.eruptions > 0, ms(20000), 'que un géiser haga erupción');
  await p.holdToMenu(0, EXIT, 'salir del Volcán');
  assert.deepEqual(p.errors, []);
  await p.context.close();
});

// Abre Bolitas Bros con un modo y un escenario y espera a que empiece la pelea.
async function startSmash(p, { mode = 'vidas', stage = 'castillo' } = {}) {
  await p.openGameCard('Bolitas Bros');
  await p.page.waitForFunction(() => window.leogames.scene.isActive('SmashSelect'), null, { timeout: ms(8000) });
  await p.page.evaluate(
    ([m, st]) => {
      const s = window.leogames.scene.getScene('SmashSelect');
      Object.assign(s.settings, { mode: m, stage: st });
      s.fixCpus();
      s.refreshOptions();
      s.layoutCards();
    },
    [mode, stage],
  );
  await p.tap(0, BUTTON.A);
  await p.until(() => { const s = window.leogames.scene.getScene('Smash'); return s.sys.isActive() && s.phase === 'fight'; }, ms(20000), `pelear: ${mode} en ${stage}`);
}

// La compu se queda quieta (para las pruebas que acomodan a los peleadores).
const quietSmashCpu = (p) =>
  p.page.evaluate(() => {
    window.leogames.scene.getScene('Smash').cpuInput = () => ({ x: 0, y: 0, jump: false, attack: false, attackHeld: false, special: false, shield: false, transform: false });
  });

// Pone al Jugador 1 en el piso del escenario y a la compu pegadita enfrente (o a `gap` de distancia), sin daño.
const faceOff = (p, gap = 10) =>
  p.page.evaluate((g) => {
    const s = window.leogames.scene.getScene('Smash');
    const [me, cpu] = s.fighters;
    const place = (f, x, facing) =>
      Object.assign(f, { x, y: s.main.top - f.radius, vx: 0, vy: 0, facing, grounded: true, platform: s.main, attack: null, hitstunMs: 0, stunMs: 0, invulnerableMs: 0, held: null, shielding: false, damage: 0 });
    place(me, 900, 1);
    place(cpu, 900 + me.radius + cpu.radius + g, -1);
    s.items.list.forEach((item) => item.sprite.destroy());
    s.items.list = [];
  }, gap);

test('bolitas bros: golpe cargado, escudo perfecto y objetos nuevos', { timeout: ms(180000) }, async () => {
  const p = await openPage(game);
  await p.joinPlayers(1);
  await startSmash(p);
  await quietSmashCpu(p);
  const cpuDamage = () => p.page.evaluate(() => window.leogames.scene.getScene('Smash').fighters[1].damage);

  // Golpe cargado: mantener X junta fuerza hasta el máximo y pega más fuerte.
  await faceOff(p);
  await p.page.evaluate(() => window.__button(0, 2, true));
  await p.wait(ms(1500));
  await p.page.evaluate(() => window.__button(0, 2, false));
  await p.until(() => window.leogames.scene.getScene('Smash').fighters[1].damage > 0, ms(3000), 'pegar con el golpe cargado');
  assert.ok((await cpuDamage()) > 10, 'el golpe cargado pega más que uno normal');
  assert.ok((await stickers(p.page)).includes('smash-cargado'));

  // Escudo perfecto: subir el escudo justo antes del golpe marea al que pegó.
  await faceOff(p);
  await p.page.evaluate(() => {
    window.__button(0, 5, true);
    window.leogames.scene.getScene('Smash').fighters[1].startAttack({ x: 0, y: 0 });
  });
  await p.until(() => window.leogames.scene.getScene('Smash').fighters[1].stunMs > 0, ms(3000), 'marear con el escudo perfecto');
  await p.page.evaluate(() => window.__button(0, 5, false));
  assert.equal(await p.page.evaluate(() => window.leogames.scene.getScene('Smash').fighters[0].record.perfects), 1);
  assert.equal(await p.page.evaluate(() => window.leogames.scene.getScene('Smash').fighters[0].damage), 0);
  assert.ok((await stickers(p.page)).includes('smash-parada'));

  // El bumerán: pega de ida y regresa a la mano.
  await faceOff(p, 200);
  await p.page.evaluate(() => window.leogames.scene.getScene('Smash').fighters[0].grab('boomerang'));
  await p.tap(0, BUTTON.X);
  await p.until(() => window.leogames.scene.getScene('Smash').fighters[1].damage > 0, ms(3000), 'pegar con el bumerán');
  await p.until(() => { const me = window.leogames.scene.getScene('Smash').fighters[0]; return me.held?.type === 'boomerang' && !me.held.out; }, ms(4000), 'que el bumerán regrese');

  // La flor de fuego echa bolas de fuego.
  await faceOff(p, 300);
  await p.page.evaluate(() => window.leogames.scene.getScene('Smash').fighters[0].grab('fireflower'));
  await p.tap(0, BUTTON.X);
  await p.until(() => window.leogames.scene.getScene('Smash').projectiles.some((shot) => shot.kind === 'fireball'), ms(3000), 'echar una bola de fuego');

  // El resorte avienta para arriba al que se le para encima.
  await faceOff(p, 300);
  await p.page.evaluate(() => {
    const s = window.leogames.scene.getScene('Smash');
    s.items.spawnAt('spring', s.fighters[0].x, s.main.top - 60);
  });
  await p.until(() => window.leogames.scene.getScene('Smash').items.list.some((item) => item.type === 'spring' && item.bounces > 0), ms(3000), 'brincar en el resorte');

  // La cápsula sorpresa se abre al tocarla.
  await faceOff(p, 300);
  await p.page.evaluate(() => {
    const s = window.leogames.scene.getScene('Smash');
    s.items.spawnAt('capsule', s.fighters[0].x, s.fighters[0].y);
  });
  await p.until(() => window.leogames.scene.getScene('Smash').fighters[0].record.items >= 1, ms(3000), 'abrir la cápsula');

  // El tornado levanta a la compu.
  await faceOff(p, 120);
  await p.page.evaluate(() => {
    const s = window.leogames.scene.getScene('Smash');
    s.items.spawnAt('tornado', s.fighters[0].x, s.fighters[0].y);
  });
  await p.until(() => window.leogames.scene.getScene('Smash').fighters[1].damage > 0, ms(5000), 'que el tornado levante a la compu');

  // El narrador habló y, al final, salen los premios (quién pegó más...).
  assert.ok(await p.page.evaluate(() => window.leogames.scene.getScene('Smash').talk.caption.text.startsWith('🎙️')), 'el narrador no habló');
  await p.page.evaluate(() => (window.leogames.scene.getScene('Smash').fighters[1].stocks = 0));
  await p.until(() => window.leogames.scene.getScene('Smash').phase === 'end', ms(5000), 'terminar la pelea');
  assert.ok(await p.page.evaluate(() => window.leogames.scene.getScene('Smash').results.list.some((o) => o.text?.includes('Más golpes'))), 'sin premios');
  await p.holdToMenu(0, EXIT, 'salir de Bolitas Bros');
  assert.deepEqual(p.errors, []);
  await p.context.close();
});

test('bolitas bros: jonrón, monedas, rey de la colina y jefes para escoger', { timeout: ms(240000) }, async () => {
  const p = await openPage(game);
  await p.joinPlayers(1);

  // Concurso de jonrón: sin compu, con el saco. Se salta los 10 segundos y se le da el batazo.
  await startSmash(p, { mode: 'jonron' });
  assert.ok(await p.page.evaluate(() => { const s = window.leogames.scene.getScene('Smash'); return s.bag?.isDummy && s.fighters.length === 2; }), 'el saco');
  await p.page.evaluate(() => {
    const s = window.leogames.scene.getScene('Smash');
    s.bag.damage = 150;
    s.jonron.ms = 1;
  });
  await p.until(() => window.leogames.scene.getScene('Smash').jonron.step === 'swing', ms(3000), 'pasar al batazo');
  assert.equal(await p.page.evaluate(() => window.leogames.scene.getScene('Smash').fighters[0].held?.type), 'bat');
  await p.page.evaluate(() => {
    const s = window.leogames.scene.getScene('Smash');
    const result = s.bag.takeHit({ facing: 1, power: 1, x: s.bag.x - 50 }, { damage: 15, base: 540, scale: 14, angle: 38 });
    s.noteHit(s.fighters[0], s.bag, result.dealt, result.speed);
  });
  await p.until(() => window.leogames.scene.getScene('Smash').phase === 'end', ms(25000), 'ver hasta dónde llegó el saco');
  assert.ok(await p.page.evaluate(() => window.leogames.scene.getScene('Smash').jonron.meters > 100), 'más de 100 m');
  assert.ok((await stickers(p.page)).includes('smash-jonron'));
  await p.holdToMenu(0, EXIT, 'salir del jonrón');

  // Monedas: los golpes sacan monedas y gana el que junte más.
  await startSmash(p, { mode: 'monedas' });
  await quietSmashCpu(p);
  await p.page.evaluate(() => {
    const s = window.leogames.scene.getScene('Smash');
    const [me, cpu] = s.fighters;
    const result = cpu.takeHit({ facing: 1, power: 1, x: cpu.x - 10 }, { damage: 20, base: 100, scale: 1, angle: 45 });
    s.noteHit(me, cpu, result.dealt, result.speed);
    // (La compu se va lejos para no agarrar sus propias monedas.)
    Object.assign(cpu, { x: s.main.left + 60, y: s.main.top - cpu.radius, vx: 0, vy: 0, hitstunMs: 0 });
  });
  assert.ok(await p.page.evaluate(() => window.leogames.scene.getScene('Smash').coins.list.length > 0), 'salieron monedas');
  await p.until(
    () => {
      const s = window.leogames.scene.getScene('Smash');
      const [me, cpu] = s.fighters;
      const coin = s.coins.list[0];
      if (coin) Object.assign(me, { x: coin.x, y: coin.y, vx: 0, vy: 0 });
      else if (me.record.coins === 0) {
        // (Si se cayeron o se acabaron antes de agarrarlas, otro golpe saca más.)
        const result = cpu.takeHit({ facing: 1, power: 1, x: cpu.x - 10 }, { damage: 20, base: 100, scale: 1, angle: 45 });
        s.noteHit(me, cpu, result.dealt, result.speed);
        Object.assign(cpu, { x: s.main.left + 60, y: s.main.top - cpu.radius, vx: 0, vy: 0, hitstunMs: 0 });
      }
      return me.record.coins > 0;
    },
    ms(10000),
    'agarrar monedas',
  );
  await p.page.evaluate(() => (window.leogames.scene.getScene('Smash').timeMs = 1));
  await p.until(() => window.leogames.scene.getScene('Smash').phase === 'end', ms(5000), 'terminar Monedas');
  assert.ok((await stickers(p.page)).includes('smash-monedas'));
  await p.holdToMenu(0, EXIT, 'salir de Monedas');

  // Rey de la colina: quedarse en la zona junta segundos.
  await startSmash(p, { mode: 'colina' });
  await quietSmashCpu(p);
  await p.page.evaluate(() => {
    const s = window.leogames.scene.getScene('Smash');
    const [me, cpu] = s.fighters;
    Object.assign(me, { x: s.hill.x, y: s.hill.platform.top - me.radius, vx: 0, vy: 0, grounded: true, platform: s.hill.platform });
    Object.assign(cpu, { x: s.main.left + 60, y: s.main.top - cpu.radius, vx: 0, vy: 0, grounded: true, platform: s.main });
  });
  await p.until(() => window.leogames.scene.getScene('Smash').fighters[0].record.hill > 1, ms(6000), 'juntar segundos en la colina');
  await p.page.evaluate(() => (window.leogames.scene.getScene('Smash').fighters[0].record.hill = 30));
  await p.until(() => window.leogames.scene.getScene('Smash').phase === 'end', ms(5000), 'ganar la colina');
  assert.ok((await stickers(p.page)).includes('smash-colina'));
  await p.holdToMenu(0, EXIT, 'salir de la colina');

  // Jefes para escoger: con sus calcomanías salen al final de la lista (◀ desde Tanque: Robotote, Dragonzote, Rey Bolón).
  await p.page.evaluate(() =>
    Promise.all([import('/src/shared/settings.js'), import('/src/shared/picks.js')]).then(([m, picks]) => {
      m.settings.set('stickers', [...new Set([...m.settings.get('stickers', []), 'smash-jefe', 'smash-aventura'])]);
      picks.characterPicks.set('pad0', 'tanque');
    }),
  );
  await p.openGameCard('Bolitas Bros');
  await p.page.waitForFunction(() => window.leogames.scene.isActive('SmashSelect'), null, { timeout: ms(8000) });
  await p.page.evaluate(() => {
    const s = window.leogames.scene.getScene('SmashSelect');
    Object.assign(s.settings, { mode: 'vidas', stage: 'castillo' });
    s.fixCpus();
    s.refreshOptions();
    s.layoutCards();
  });
  const pick = () => p.page.evaluate(() => window.leogames.scene.getScene('SmashSelect').humanSlots[0].pick);
  const seen = [];
  for (let i = 0; i < 3; i += 1) {
    await p.tap(0, BUTTON.LEFT);
    seen.push(await pick());
  }
  assert.deepEqual(seen, ['robotote', 'dragonzote', 'rey']);
  await p.tap(0, BUTTON.RIGHT);
  await p.tap(0, BUTTON.RIGHT);
  // X cambia el traje (dos veces: azul).
  await p.tap(0, BUTTON.X);
  await p.tap(0, BUTTON.X);
  await p.tap(0, BUTTON.A);
  await p.until(() => { const s = window.leogames.scene.getScene('Smash'); return s.sys.isActive() && s.phase === 'fight'; }, ms(20000), 'pelear con Robotote');
  const me = await p.page.evaluate(() => {
    const f = window.leogames.scene.getScene('Smash').fighters[0];
    return { key: f.characterKey, art: f.image?.texture.key ?? '', costume: f.costumeIndex };
  });
  assert.equal(me.key, 'robotote');
  assert.ok(me.art.startsWith('smash:robotote-'), `sin dibujo de Robotote: ${me.art}`);
  assert.equal(me.costume, 2);
  // Su especial: el puño cohete.
  await quietSmashCpu(p);
  await faceOff(p, 150);
  await p.page.evaluate(() => window.leogames.scene.getScene('Smash').fighters[0].startSpecial({ x: 0, y: 0 }));
  await p.until(() => window.leogames.scene.getScene('Smash').fighters[1].damage > 0, ms(4000), 'pegar con el puño cohete');
  await p.holdToMenu(0, EXIT, 'salir de Bolitas Bros');
  // (Los jefes no se guardan como personaje de los otros juegos.)
  assert.equal(await p.page.evaluate(() => import('/src/shared/picks.js').then((m) => m.characterPicks.get('pad0', 'x'))), 'tanque');
  assert.deepEqual(p.errors, []);
  await p.context.close();
});

test('bolitas bros: aventura, escenarios nuevos y repetición del K.O.', { timeout: ms(300000) }, async () => {
  const p = await openPage(game);
  await p.joinPlayers(1);
  const level = () => p.page.evaluate(() => window.leogames.scene.getScene('Smash').adventure?.index);
  const waitEnd = (label) => p.until(() => { const s = window.leogames.scene.getScene('Smash'); return s.phase === 'end' && s.phaseMs > 1600; }, ms(10000), label);
  const nextLevel = async (index) => {
    await p.tap(0, BUTTON.A);
    await p.until(new Function(`const s = window.leogames.scene.getScene('Smash'); return s.sys.isActive() && s.phase === 'fight' && s.adventure?.index === ${index};`), ms(20000), `nivel ${index + 1}`);
  };

  // Nivel 1: contra Ninja (2 vidas) en el castillo.
  await startSmash(p, { mode: 'aventura' });
  assert.equal(await level(), 0);
  assert.deepEqual(
    await p.page.evaluate(() => { const s = window.leogames.scene.getScene('Smash'); return [s.settings.stage, s.fighters[1].characterKey, s.fighters[1].stocks]; }),
    ['castillo', 'ninja', 2],
  );
  await p.page.evaluate(() => (window.leogames.scene.getScene('Smash').fighters[1].stocks = 0));
  await waitEnd('ganar el nivel 1');
  assert.ok(await p.page.evaluate(() => window.leogames.scene.getScene('Smash').adventureWon));
  // Nivel 2: las dianas de la selva.
  await nextLevel(1);
  await p.page.evaluate(() => {
    const s = window.leogames.scene.getScene('Smash');
    for (const t of s.targets) s.breakTarget(t, s.players[0]);
  });
  await waitEnd('ganar el nivel 2');
  // Nivel 3: la torre: llegar a la plataforma de la bandera.
  await nextLevel(2);
  await p.page.evaluate(() => {
    const s = window.leogames.scene.getScene('Smash');
    const me = s.fighters[0];
    Object.assign(me, { x: s.stage.goal.x, y: s.stage.goal.y - me.radius - 6, vx: 0, vy: 0, grounded: false, platform: null });
  });
  await waitEnd('llegar a la bandera');
  assert.ok(await p.page.evaluate(() => window.leogames.scene.getScene('Smash').adventureWon));
  // Hasta el último: Dragonzote gigante.
  await p.page.evaluate(() => {
    const s = window.leogames.scene.getScene('Smash');
    s.scene.restart({ ...s.returnData, rematch: false, adventure: { index: 5 } });
  });
  await p.until(() => { const s = window.leogames.scene.getScene('Smash'); return s.sys.isActive() && s.phase === 'fight' && s.adventure?.index === 5; }, ms(20000), 'pelear contra Dragonzote');
  assert.equal(await p.page.evaluate(() => window.leogames.scene.getScene('Smash').boss?.characterKey), 'dragonzote');
  await p.page.evaluate(() => (window.leogames.scene.getScene('Smash').boss.bossHp = 0));
  await waitEnd('ganarle a Dragonzote');
  assert.ok((await stickers(p.page)).includes('smash-aventura'));
  await p.holdToMenu(0, EXIT, 'salir de la Aventura');

  // Escenarios nuevos: cada uno con su sorpresa.
  for (const stage of ['embrujada', 'pastel', 'ciudad', 'globos']) {
    await startSmash(p, { mode: 'vidas', stage });
    await quietSmashCpu(p);
    await p.page.evaluate(() => (window.leogames.scene.getScene('Smash').events.waitMs = 0));
    await p.until(() => Boolean(window.leogames.scene.getScene('Smash').events.active), ms(3000), `sorpresa en ${stage}`);
    await p.until(() => !window.leogames.scene.getScene('Smash').events.active, ms(12000), `terminar la sorpresa en ${stage}`);
    await p.holdToMenu(0, EXIT, `salir de ${stage}`);
  }

  // Repetición del K.O.: el golpe que gana la pelea se ve otra vez en cámara lenta.
  await startSmash(p, { mode: 'vidas', stage: 'castillo' });
  await quietSmashCpu(p);
  await p.wait(ms(1200));
  await p.page.evaluate(() => {
    const s = window.leogames.scene.getScene('Smash');
    const cpu = s.fighters[1];
    cpu.stocks = 1;
    cpu.x = s.stage.blast.right + 50;
  });
  await p.until(() => window.leogames.scene.getScene('Smash').phase === 'replay', ms(3000), 'ver la repetición');
  await p.until(() => window.leogames.scene.getScene('Smash').phase === 'end', ms(15000), 'terminar la repetición');
  await p.holdToMenu(0, EXIT, 'salir de Bolitas Bros');
  assert.deepEqual(p.errors, []);
  await p.context.close();
});

// En el taller de Karts locos los primeros `count` controles dan A (con lo que ya traían escogido).
async function passGarage(p, count) {
  await p.until(() => window.leogames.scene.getScene('Kart').game3d?.phase === 'garage', ms(30000), 'ver el taller');
  for (let i = 0; i < count; i += 1) await p.tap(i, BUTTON.A);
}

// Después del taller: A = el modo "Carrera" y se espera la pantalla de pistas.
async function pickRaceMode(p) {
  await p.until(() => window.leogames.scene.getScene('Kart').game3d?.phase === 'choose', ms(30000), 'ver los modos');
  await p.tap(0, BUTTON.A);
  await p.until(() => document.querySelector('.kart-choose h1')?.textContent === 'Escoge pista', ms(10000), 'ver las pistas');
}

// Modo carrera y, en las pistas, A = la que ya está escogida (la Pradera, la primera vez).
async function pickTrack(p) {
  await pickRaceMode(p);
  await p.tap(0, BUTTON.A);
}

// Bot de karts: cada jugador apunta a un punto de la pista más adelante, acelera y lanza lo que agarre.
function startKartBot(page) {
  return page.evaluate(() => {
    window.__boxes = 0;
    window.__bot = setInterval(() => {
      const kart = window.leogames.scene.getScene('Kart').game3d;
      if (!kart) return;
      for (const r of kart.humans) {
        const pad = window.__pads[Number(r.deviceId.replace('pad', ''))];
        const target = kart.track.pointAt(r.index + 12, r.lane);
        const desired = Math.atan2(target.x - r.x, target.z - r.z);
        const diff = Math.atan2(Math.sin(desired - r.heading), Math.cos(desired - r.heading));
        pad.axes = [Math.max(-1, Math.min(1, -diff * 2.5)), 0, 0, 0];
        pad.buttons[0].pressed = true;
        pad.buttons[2].pressed = Boolean(r.item) && !pad.buttons[2].pressed;
        if (r.rollMs > 0 && !r.__rolled) window.__boxes += 1;
        r.__rolled = r.rollMs > 0;
      }
    }, 50);
  });
}

test('karts locos: dos bots dan una vuelta con cajitas y ven los resultados', { timeout: ms(180000) }, async () => {
  const p = await openPage(game);
  await p.joinPlayers(2);
  await p.openGameCard('Karts locos');
  // En el taller el Jugador 1 escoge el kart Mini (↓ y dos veces ▶).
  await p.until(() => window.leogames.scene.getScene('Kart').game3d?.phase === 'garage', ms(30000), 'ver el taller');
  await p.tap(0, BUTTON.DOWN);
  await p.tap(0, BUTTON.RIGHT);
  await p.tap(0, BUTTON.RIGHT);
  await passGarage(p, 2);
  await pickTrack(p);
  await p.until(() => window.leogames.scene.getScene('Kart').game3d.phase === 'countdown', ms(10000), 'empezar en la Pradera');
  assert.equal(await p.page.evaluate(() => window.leogames.scene.getScene('Kart').game3d.trackKey), 'pradera');
  const racers = await p.page.evaluate(() => window.leogames.scene.getScene('Kart').game3d.racers.map((r) => [r.setup.type, r.setup.character]));
  assert.equal(racers.length, 6);
  assert.equal(racers[0][0], 'mini');
  assert.ok(racers.every(([type, character]) => type && character), 'todos traen kart y piloto');
  await startKartBot(p.page);
  await p.until(() => window.leogames.scene.getScene('Kart').game3d.humans.every((r) => r.lap >= 1), ms(150000), 'completar una vuelta');
  assert.ok((await p.page.evaluate(() => window.__boxes)) > 0, 'nadie agarró cajitas');
  await p.page.evaluate(() => {
    clearInterval(window.__bot);
    window.__release();
    window.leogames.scene.getScene('Kart').game3d.showResults();
  });
  await p.until(() => window.leogames.scene.getScene('Kart').game3d.phaseMs > 1300, ms(10000), 'que se pueda pedir otra carrera');
  await p.tap(0, BUTTON.A);
  await p.until(() => window.leogames.scene.getScene('Kart').game3d.phase === 'countdown', ms(5000), 'otra carrera');
  await p.holdToMenu(0, EXIT, 'salir de Karts locos');
  assert.deepEqual(p.errors, []);
  await p.context.close();
});

// Derrape con LB (al soltarlo, turbito), salto en la rampa con truco (turbito al caer) y flechas de turbo.
test('karts locos: derrape, rampa con truco y flecha de turbo', { timeout: ms(120000) }, async () => {
  const p = await openPage(game);
  await p.joinPlayers(1);
  await p.openGameCard('Karts locos');
  await passGarage(p, 1);
  await pickTrack(p);
  await p.until(() => window.leogames.scene.getScene('Kart').game3d.phase === 'race', ms(15000), 'empezar la carrera');
  // Un kart solo en una recta, sin nadie que estorbe.
  const place = (at, lane, speed) =>
    p.page.evaluate(([where, side, v]) => {
      const k = window.leogames.scene.getScene('Kart').game3d;
      for (const cpu of k.racers.filter((r) => r.isCpu)) Object.assign(cpu, { x: 9999, z: 9999 });
      const r = k.humans[0];
      const spot = k.track.pointAt(where, side);
      Object.assign(r, { x: spot.x, z: spot.z, heading: spot.heading, index: spot.index, speed: v, boostMs: 0, y: 0, vy: 0 });
    }, [at, lane, speed]);
  const me = () => p.page.evaluate(() => {
    const r = window.leogames.scene.getScene('Kart').game3d.humans[0];
    return { drifting: r.drifting, level: r.driftLevel, boost: r.boostMs, y: r.y };
  });

  await p.page.evaluate(() => window.__button(0, 0, true));
  await place(20, 0, 30);
  await p.page.evaluate(() => ((window.__pads[0].axes = [0.9, 0, 0, 0]), window.__button(0, 4, true)));
  await p.until(() => window.leogames.scene.getScene('Kart').game3d.humans[0].driftLevel >= 1, ms(6000), 'juntar chispas derrapando');
  assert.ok((await me()).drifting);
  await p.page.evaluate(() => ((window.__pads[0].axes = [0, 0, 0, 0]), window.__button(0, 4, false)));
  await p.until(() => window.leogames.scene.getScene('Kart').game3d.humans[0].boostMs > 0, ms(3000), 'turbito al soltar el derrape');

  // La rampa: sale volando, hace truco con LB y al caer le da turbito.
  const ramp = await p.page.evaluate(() => window.leogames.scene.getScene('Kart').game3d.features.ramps[0].start);
  await place(ramp - 8, 0, 40);
  await p.until(() => window.leogames.scene.getScene('Kart').game3d.humans[0].vy > 0, ms(5000), 'saltar en la rampa');
  await p.tap(0, BUTTON.LB);
  await p.until(() => { const r = window.leogames.scene.getScene('Kart').game3d.humans[0]; return !r.flying && r.boostMs > 0; }, ms(5000), 'caer con el turbito del truco');

  // La flecha: justo antes de ella, con el carril de la flecha.
  const pad = await p.page.evaluate(() => {
    const k = window.leogames.scene.getScene('Kart').game3d;
    const [at, lane] = k.trackLook.pads[0];
    return [Math.round(at * k.track.count) - 3, lane];
  });
  await place(pad[0], pad[1], 20);
  await p.until(() => window.leogames.scene.getScene('Kart').game3d.humans[0].boostFactor === 1.5, ms(3000), 'turbo de la flecha');
  await p.page.evaluate(() => window.__release());
  await p.holdToMenu(0, EXIT, 'salir de Karts locos');
  assert.deepEqual(p.errors, []);
  await p.context.close();
});

// Poderes nuevos: triple plátano (uno con cada X), rayo (encoge a los demás), tinta (a los de adelante) y cometa (al primero).
test('karts locos: triple plátano, rayo, tinta y cometa', { timeout: ms(120000) }, async () => {
  const p = await openPage(game);
  await p.joinPlayers(1);
  await p.openGameCard('Karts locos');
  await passGarage(p, 1);
  await pickTrack(p);
  await p.until(() => window.leogames.scene.getScene('Kart').game3d.phase === 'race', ms(15000), 'empezar la carrera');
  await p.page.evaluate(() => window.__button(0, 0, true));
  const kart = (fn) => p.page.evaluate(fn);
  const give = (item, uses = 1) =>
    p.page.evaluate(([it, u]) => Object.assign(window.leogames.scene.getScene('Kart').game3d.humans[0], { item: it, itemUses: u, rollMs: 0 }), [item, uses]);

  // Se cuentan los plátanos que suelta (la compu de atrás puede atropellar alguno).
  await kart(() => {
    const k = window.leogames.scene.getScene('Kart').game3d;
    const drop = k.projectiles.addBanana.bind(k.projectiles);
    k.bananas = 0;
    k.projectiles.addBanana = (owner) => ((k.bananas += 1), drop(owner));
  });
  await give('banana3', 3);
  for (let i = 0; i < 3; i += 1) await p.tap(0, BUTTON.X);
  assert.equal(await kart(() => window.leogames.scene.getScene('Kart').game3d.bananas), 3);
  assert.equal(await kart(() => window.leogames.scene.getScene('Kart').game3d.humans[0].item), null);

  // Sin burbujas (la burbuja protege del rayo y del cometa).
  const noShields = () => kart(() => window.leogames.scene.getScene('Kart').game3d.racers.forEach((r) => (r.shieldMs = 0)));
  await noShields();
  await give('lightning');
  await p.tap(0, BUTTON.X);
  const shrunk = await kart(() => window.leogames.scene.getScene('Kart').game3d.racers.map((r) => r.shrinkMs > 0));
  assert.deepEqual(shrunk, [false, true, true, true, true, true]);

  // Para la tinta y el cometa el jugador va hasta atrás.
  await kart(() => {
    const k = window.leogames.scene.getScene('Kart').game3d;
    for (const r of k.racers) r.shrinkMs = 0;
    k.humans[0].lap = -3;
  });
  await p.frames(2);
  await give('ink');
  await p.tap(0, BUTTON.X);
  assert.equal(await kart(() => window.leogames.scene.getScene('Kart').game3d.racers.filter((r) => r.inkMs > 0).length), 5);

  const leader = await kart(() => {
    const k = window.leogames.scene.getScene('Kart').game3d;
    return k.racers.indexOf(k.ranking().find((r) => r !== k.humans[0]));
  });
  await noShields();
  await give('comet');
  await p.tap(0, BUTTON.X);
  // (que el cometa le pegue al primero)
  await p.page.waitForFunction((i) => window.leogames.scene.getScene('Kart').game3d.racers[i].spinMs > 0, leader, { timeout: ms(15000) });
  await p.page.evaluate(() => window.__release());
  await p.holdToMenu(0, EXIT, 'salir de Karts locos');
  assert.deepEqual(p.errors, []);
  await p.context.close();
});

// Gran Premio: 3 carreras de la Copa Hoja con puntos; la compu trae el mismo kart en todas; al final, la copa.
test('karts locos: gran premio de tres carreras con puntos y copa', { timeout: ms(180000) }, async () => {
  const p = await openPage(game);
  await p.joinPlayers(1);
  await p.openGameCard('Karts locos');
  await passGarage(p, 1);
  await p.until(() => window.leogames.scene.getScene('Kart').game3d?.phase === 'choose', ms(30000), 'ver los modos');
  await p.tap(0, BUTTON.RIGHT);
  await p.tap(0, BUTTON.A);
  await p.until(() => document.querySelector('.kart-choose h1')?.textContent.includes('Gran Premio'), ms(10000), 'ver las copas');
  await p.tap(0, BUTTON.A);
  const state = () =>
    p.page.evaluate(() => {
      const k = window.leogames.scene.getScene('Kart').game3d;
      return { track: k.trackKey, race: k.gp?.race, points: k.gp?.points, cpus: k.racers?.filter((r) => r.isCpu).map((r) => r.setup.character) };
    });
  const expected = ['pradera', 'playa', 'dulces'];
  let cpus = null;
  for (let race = 0; race < 3; race += 1) {
    await p.page.waitForFunction((n) => {
      const k = window.leogames.scene.getScene('Kart').game3d;
      return k?.gp?.race === n && k.phase === 'countdown';
    }, race, { timeout: ms(30000) });
    const now = await state();
    assert.equal(now.track, expected[race]);
    cpus ??= now.cpus;
    assert.deepEqual(now.cpus, cpus, 'la compu trae el mismo personaje en toda la copa');
    // Al final el jugador junta más puntos que nadie.
    await p.page.evaluate((last) => {
      const k = window.leogames.scene.getScene('Kart').game3d;
      if (last) k.gp.points[0] = 100;
      k.showResults();
    }, race === 2);
    const total = (await state()).points.reduce((sum, value) => sum + value, 0);
    assert.ok(total >= 31 * (race + 1), 'se suman los puntos de cada carrera');
    await p.until(() => window.leogames.scene.getScene('Kart').game3d.phaseMs > 1300, ms(10000), 'que se pueda seguir');
    await p.tap(0, BUTTON.A);
  }
  assert.ok((await stickers(p.page)).includes('kart-copa'), 'ganar la copa da su calcomanía');
  assert.equal(await p.page.evaluate(() => JSON.parse(localStorage.getItem('leogames:kartMedallasCopa')).hoja), 0, 'medalla de oro en la copa');
  await p.until(() => document.querySelector('.kart-choose h1')?.textContent.includes('Gran Premio'), ms(30000), 'regresar a las copas');
  await p.holdToMenu(0, EXIT, 'salir de Karts locos');
  assert.deepEqual(p.errors, []);
  await p.context.close();
});

// Opciones (RB = vueltas), arranque turbo (acelerar cuando sale el 1) y monedas (más rápido; un golpe tira 3).
test('karts locos: vueltas, arranque turbo y monedas', { timeout: ms(120000) }, async () => {
  const p = await openPage(game);
  await p.joinPlayers(1);
  await p.openGameCard('Karts locos');
  await passGarage(p, 1);
  await p.until(() => window.leogames.scene.getScene('Kart').game3d?.phase === 'choose', ms(30000), 'ver los modos');
  await p.tap(0, BUTTON.RB);
  await pickTrack(p);
  await p.until(() => window.leogames.scene.getScene('Kart').game3d.phase === 'countdown', ms(15000), 'cuenta regresiva');
  assert.equal(await p.page.evaluate(() => window.leogames.scene.getScene('Kart').game3d.laps), 1);
  await p.until(() => window.leogames.scene.getScene('Kart').game3d.phaseMs > 1750, ms(10000), 'que salga el 1');
  await p.page.evaluate(() => window.__button(0, 0, true));
  await p.until(() => window.leogames.scene.getScene('Kart').game3d.phase === 'race', ms(10000), 'arrancar');
  assert.ok(await p.page.evaluate(() => window.leogames.scene.getScene('Kart').game3d.humans[0].boostMs > 0), 'arranque turbo');
  await p.page.evaluate(() => {
    const k = window.leogames.scene.getScene('Kart').game3d;
    Object.assign(k.humans[0], { x: k.coins.coins[0].x, z: k.coins.coins[0].z });
  });
  await p.until(() => window.leogames.scene.getScene('Kart').game3d.humans[0].coins > 0, ms(5000), 'agarrar una moneda');
  await p.page.evaluate(() => {
    const r = window.leogames.scene.getScene('Kart').game3d.humans[0];
    Object.assign(r, { coins: 5, shieldMs: 0 });
    r.hit();
  });
  assert.equal(await p.page.evaluate(() => window.leogames.scene.getScene('Kart').game3d.humans[0].coins), 2);
  await p.page.evaluate(() => window.__release());
  await p.holdToMenu(0, EXIT, 'salir de Karts locos');
  assert.deepEqual(p.errors, []);
  await p.context.close();
});

// Modo peque (Y en el taller): sin tocar nada, el kart acelera solo y sigue la pista.
test('karts locos: modo peque acelera solo y sigue la pista', { timeout: ms(120000) }, async () => {
  const p = await openPage(game);
  await p.joinPlayers(1);
  await p.openGameCard('Karts locos');
  await p.until(() => window.leogames.scene.getScene('Kart').game3d?.phase === 'garage', ms(30000), 'ver el taller');
  await p.tap(0, BUTTON.Y);
  await passGarage(p, 1);
  await pickTrack(p);
  await p.until(() => window.leogames.scene.getScene('Kart').game3d.phase === 'race', ms(15000), 'empezar la carrera');
  assert.ok(await p.page.evaluate(() => window.leogames.scene.getScene('Kart').game3d.humans[0].setup.peque), 'modo peque prendido');
  const start = await p.page.evaluate(() => window.leogames.scene.getScene('Kart').game3d.humans[0].progress);
  await p.page.waitForFunction((s0) => window.leogames.scene.getScene('Kart').game3d.humans[0].progress > s0 + 0.15, start, { timeout: ms(30000) });
  const kart = await p.page.evaluate(() => {
    const k = window.leogames.scene.getScene('Kart').game3d;
    const r = k.humans[0];
    return { lateral: Math.abs(k.track.lateral(r.x, r.z, r.index)), half: k.track.roadWidth / 2 };
  });
  assert.ok(kart.lateral < kart.half + 2, 'sigue en el camino');
  await p.holdToMenu(0, EXIT, 'salir de Karts locos');
  assert.deepEqual(p.errors, []);
  await p.context.close();
});

// Lomas: el kart sube y se inclina con el camino. Peligros: la oveja de la Pradera lo hace dar vueltas.
test('karts locos: lomas y peligros', { timeout: ms(120000) }, async () => {
  const p = await openPage(game);
  await p.joinPlayers(1);
  await p.openGameCard('Karts locos');
  await passGarage(p, 1);
  await pickTrack(p);
  await p.until(() => window.leogames.scene.getScene('Kart').game3d.phase === 'race', ms(15000), 'empezar la carrera');
  await p.page.evaluate(() => window.__button(0, 0, true));
  // Lo más empinado de subida: ahí el kart va más alto y con la trompa arriba.
  await p.page.evaluate(() => {
    const k = window.leogames.scene.getScene('Kart').game3d;
    for (const cpu of k.racers.filter((r) => r.isCpu)) Object.assign(cpu, { x: 9999, z: 9999 });
    const steepest = k.track.slopes.indexOf(Math.max(...k.track.slopes));
    const spot = k.track.pointAt(steepest - 3, 0);
    Object.assign(k.humans[0], { x: spot.x, z: spot.z, heading: spot.heading, index: spot.index, speed: 20 });
  });
  await p.until(() => { const r = window.leogames.scene.getScene('Kart').game3d.humans[0]; return r.y > 1 && r.pitch > 0.05; }, ms(5000), 'subir la loma inclinado');

  // La oveja: el kart se queda parado justo donde va a pasar.
  await p.page.evaluate(() => {
    window.__button(0, 0, false);
    const k = window.leogames.scene.getScene('Kart').game3d;
    const sheep = k.hazards.list[0];
    const spot = k.track.pointAt(sheep.index, 0);
    Object.assign(k.humans[0], { x: spot.x, z: spot.z, heading: spot.heading, index: spot.index, speed: 0, shieldMs: 0, spinMs: 0 });
  });
  await p.until(() => window.leogames.scene.getScene('Kart').game3d.humans[0].spinMs > 0, ms(15000), 'la oveja lo hace dar vueltas');
  await p.holdToMenu(0, EXIT, 'salir de Karts locos');
  assert.deepEqual(p.errors, []);
  await p.context.close();
});

// Las pistas nuevas (selva, mar, juguetes, volcán): cada una arranca, sus adornos y su peligro se mueven sin errores.
test('karts locos: las pistas de la Copa Aventura', { timeout: ms(180000) }, async () => {
  const p = await openPage(game);
  await p.joinPlayers(1);
  await p.openGameCard('Karts locos');
  await passGarage(p, 1);
  await pickRaceMode(p);
  for (const key of ['selva', 'mar', 'juguetes', 'volcan']) {
    await p.page.evaluate((k) => import('/src/games/kart/tracks.js').then((m) => {
      window.leogames.scene.getScene('Kart').game3d.chooser.select(m.TRACK_KEYS.indexOf(k));
    }), key);
    await p.tap(0, BUTTON.A);
    await p.page.waitForFunction((k) => window.leogames.scene.getScene('Kart').game3d?.trackKey === k, key, { timeout: ms(15000) });
    await p.until(() => window.leogames.scene.getScene('Kart').game3d.raceMs > 1500, ms(15000), `correr en ${key}`);
    assert.ok(await p.page.evaluate(() => Boolean(window.leogames.scene.getScene('Kart').game3d.hazards)), `${key} sin peligro`);
    await p.page.evaluate(() => window.leogames.scene.getScene('Kart').game3d.showResults());
    await p.until(() => window.leogames.scene.getScene('Kart').game3d.phaseMs > 1300, ms(10000), 'que se pueda cambiar de pista');
    await p.tap(0, BUTTON.B);
    await p.until(() => document.querySelector('.kart-choose h1')?.textContent === 'Escoge pista', ms(30000), 'regresar a escoger pista');
  }
  assert.deepEqual(p.errors, []);
  await p.context.close();
});

// Por equipos: Rojos contra Azules (3 y 3), los poderes no le pegan a tu equipo y al final se suman los puntos.
test('karts locos: carrera por equipos', { timeout: ms(120000) }, async () => {
  const p = await openPage(game);
  await p.joinPlayers(2);
  await p.openGameCard('Karts locos');
  await passGarage(p, 2);
  await chooseKartMode(p, 3, 'Escoge pista');
  await p.tap(0, BUTTON.A);
  await p.until(() => window.leogames.scene.getScene('Kart').game3d?.phase === 'countdown', ms(15000), 'empezar');
  const teams = await p.page.evaluate(() => window.leogames.scene.getScene('Kart').game3d.racers.map((r) => r.team));
  assert.deepEqual([teams[0], teams[1]], [0, 1], 'J1 rojo y J2 azul');
  assert.equal(teams.filter((t) => t === 0).length, 3);
  // Un cohete de J1 no persigue a nadie de su equipo.
  const target = await p.page.evaluate(() => {
    const k = window.leogames.scene.getScene('Kart').game3d;
    const ranking = [...k.racers];
    const me = ranking[ranking.length - 1];
    const rival = k.rivalAhead(me, ranking);
    return rival ? rival.team !== me.team : true;
  });
  assert.ok(target, 'el cohete va contra el otro equipo');
  await p.page.evaluate(() => window.leogames.scene.getScene('Kart').game3d.showResults());
  await p.until(() => /Ganaron|Empate/.test(document.querySelector('.kart-results h1')?.textContent ?? ''), ms(5000), 'ver qué equipo ganó');
  await p.holdToMenu(0, EXIT, 'salir de Karts locos');
  assert.deepEqual(p.errors, []);
  await p.context.close();
});

// Tienda del taller (X): con monedas se compra el kart Cohete y luego se puede escoger; B cierra la tienda sin salir.
test('karts locos: tienda del taller', { timeout: ms(120000) }, async () => {
  const p = await openPage(game);
  await p.page.evaluate(() => import('/src/shared/settings.js').then((m) => m.settings.set('kartWallet', 70)));
  await p.joinPlayers(1);
  await p.openGameCard('Karts locos');
  await p.until(() => window.leogames.scene.getScene('Kart').game3d?.phase === 'garage', ms(30000), 'ver el taller');
  await p.tap(0, BUTTON.X);
  await p.until(() => Boolean(document.querySelector('.kart-shop')), ms(5000), 'abrir la tienda');
  // (Primero vienen las 3 mejoras; luego el Cohete.)
  for (let i = 0; i < 3; i += 1) await p.tap(0, BUTTON.RIGHT);
  await p.tap(0, BUTTON.A);
  const state = () => p.page.evaluate(() => import('/src/games/kart/karts.js').then((m) => ({ coins: m.wallet.get(), cohete: m.owns('type', 'cohete') })));
  assert.deepEqual(await state(), { coins: 10, cohete: true });
  await p.tap(0, BUTTON.B);
  await p.until(() => !document.querySelector('.kart-shop'), ms(5000), 'cerrar la tienda');
  assert.equal(await p.page.evaluate(() => window.leogames.scene.getScene('Kart').game3d?.phase), 'garage', 'sigue en el taller');
  await p.tap(0, BUTTON.DOWN);
  await p.tap(0, BUTTON.LEFT);
  assert.equal(await p.page.evaluate(() => window.leogames.scene.getScene('Kart').game3d.garage.cards[0].setup.type), 'cohete');
  await p.holdToMenu(0, EXIT, 'salir de Karts locos');
  assert.deepEqual(p.errors, []);
  await p.context.close();
});

// Batalla de globos: un cohete revienta un globo; sin globos quedas fuera; gana el último con globos.
test('karts locos: batalla de globos', { timeout: ms(120000) }, async () => {
  const p = await openPage(game);
  await p.joinPlayers(1);
  await p.openGameCard('Karts locos');
  await passGarage(p, 1);
  await chooseKartMode(p, 2, 'Escoge batalla');
  // La primera: Globos.
  await p.tap(0, BUTTON.A);
  await p.until(() => window.leogames.scene.getScene('Kart').game3d?.phase === 'race', ms(30000), 'empezar la batalla');
  assert.deepEqual(await p.page.evaluate(() => window.leogames.scene.getScene('Kart').game3d.racers.map((r) => r.balloons)), [3, 3, 3, 3]);
  // Un cohete al más cercano (sin burbujas que lo protejan).
  await p.page.evaluate(() => {
    const k = window.leogames.scene.getScene('Kart').game3d;
    k.racers.forEach((r) => (r.shieldMs = 0));
    Object.assign(k.humans[0], { item: 'rocket', itemUses: 1, rollMs: 0 });
  });
  await p.tap(0, BUTTON.X);
  await p.until(() => window.leogames.scene.getScene('Kart').game3d.racers.some((r) => r.balloons === 2), ms(10000), 'reventar un globo con el cohete');
  // A la compu se le acaban los globos: gana el jugador.
  await p.page.evaluate(() => {
    const k = window.leogames.scene.getScene('Kart').game3d;
    for (const r of k.racers.filter((x) => x.isCpu)) {
      Object.assign(r, { balloons: 1, safeMs: 0, shieldMs: 0 });
      k.battle.hit(r, k.humans[0]);
    }
  });
  await p.until(() => window.leogames.scene.getScene('Kart').game3d.phase === 'results', ms(5000), 'terminar la batalla');
  assert.ok((await stickers(p.page)).includes('kart-batalla'), 'ganar la batalla da su calcomanía');
  await p.until(() => window.leogames.scene.getScene('Kart').game3d.phaseMs > 1300, ms(10000), 'que se pueda pedir otra');
  await p.tap(0, BUTTON.A);
  await p.until(() => window.leogames.scene.getScene('Kart').game3d.phase === 'countdown', ms(5000), 'otra batalla');
  assert.deepEqual(await p.page.evaluate(() => window.leogames.scene.getScene('Kart').game3d.racers.map((r) => r.balloons)), [3, 3, 3, 3]);
  await p.holdToMenu(0, EXIT, 'salir de Karts locos');
  assert.deepEqual(p.errors, []);
  await p.context.close();
});

// Después del taller: el modo número `index` (0 = Carrera) y se espera la pantalla que abre.
async function chooseKartMode(p, index, title) {
  await p.until(() => window.leogames.scene.getScene('Kart').game3d?.phase === 'choose', ms(30000), 'ver los modos');
  for (let i = 0; i < index; i += 1) await p.tap(0, BUTTON.RIGHT);
  await p.tap(0, BUTTON.A);
  await p.page.waitForFunction((text) => document.querySelector('.kart-choose h1')?.textContent.includes(text), title, { timeout: ms(10000) });
}

// Atrapa la estrella (se la lleva el que la toca y la suelta si le pegan) y Monedas (si te pegan se te caen).
test('karts locos: batallas de estrella y de monedas', { timeout: ms(120000) }, async () => {
  const p = await openPage(game);
  await p.joinPlayers(1);
  await p.openGameCard('Karts locos');
  await passGarage(p, 1);
  await chooseKartMode(p, 2, 'Escoge batalla');
  await p.tap(0, BUTTON.RIGHT);
  await p.tap(0, BUTTON.A);
  await p.until(() => window.leogames.scene.getScene('Kart').game3d?.phase === 'race', ms(30000), 'empezar la batalla de la estrella');
  // El jugador llega a la estrella: se la lleva y le cuenta el tiempo.
  await p.page.evaluate(() => {
    const k = window.leogames.scene.getScene('Kart').game3d;
    Object.assign(k.humans[0], { x: k.battle.star.x + 1, z: k.battle.star.z });
  });
  await p.until(() => window.leogames.scene.getScene('Kart').game3d.battle.star.holder?.isCpu === false, ms(5000), 'agarrar la estrella');
  await p.until(() => window.leogames.scene.getScene('Kart').game3d.humans[0].holdMs > 500, ms(5000), 'sumar tiempo con la estrella');
  // Le pegan: la suelta.
  await p.page.evaluate(() => {
    const k = window.leogames.scene.getScene('Kart').game3d;
    Object.assign(k.humans[0], { shieldMs: 0, safeMs: 0 });
    k.battle.hit(k.humans[0], k.racers[1]);
  });
  assert.equal(await p.page.evaluate(() => window.leogames.scene.getScene('Kart').game3d.battle.star.holder), null, 'si te pegan sueltas la estrella');
  // Se acaba el tiempo: gana el que la tuvo más.
  await p.page.evaluate(() => {
    const k = window.leogames.scene.getScene('Kart').game3d;
    k.humans[0].holdMs = 60000;
    k.battle.timeMs = 10;
  });
  await p.until(() => window.leogames.scene.getScene('Kart').game3d.phase === 'results', ms(5000), 'terminar la batalla de la estrella');
  assert.ok((await stickers(p.page)).includes('kart-batalla'), 'ganar la batalla da su calcomanía');
  // B = otra clase de batalla: Monedas.
  await p.until(() => window.leogames.scene.getScene('Kart').game3d.phaseMs > 1300, ms(10000), 'que se pueda cambiar');
  await p.tap(0, BUTTON.B);
  await p.until(() => document.querySelector('.kart-choose h1')?.textContent === 'Escoge batalla', ms(30000), 'regresar a las batallas');
  await p.tap(0, BUTTON.RIGHT);
  await p.tap(0, BUTTON.RIGHT);
  await p.tap(0, BUTTON.A);
  await p.until(() => window.leogames.scene.getScene('Kart').game3d?.phase === 'race', ms(30000), 'empezar la batalla de monedas');
  await p.page.evaluate(() => {
    const k = window.leogames.scene.getScene('Kart').game3d;
    k.battle.addCoin(k.humans[0].x, k.humans[0].z);
  });
  await p.until(() => window.leogames.scene.getScene('Kart').game3d.humans[0].battleCoins === 1, ms(5000), 'agarrar una moneda');
  await p.holdToMenu(0, EXIT, 'salir de Karts locos');
  assert.deepEqual(p.errors, []);
  await p.context.close();
});

// Eliminación: cada ratito sale el último; el que queda gana.
test('karts locos: carrera de eliminación', { timeout: ms(120000) }, async () => {
  const p = await openPage(game);
  await p.joinPlayers(1);
  await p.openGameCard('Karts locos');
  await passGarage(p, 1);
  await chooseKartMode(p, 5, 'Escoge pista');
  await p.tap(0, BUTTON.A);
  await p.until(() => window.leogames.scene.getScene('Kart').game3d?.phase === 'race', ms(30000), 'empezar la eliminación');
  // El jugador va hasta adelante y el reloj de la eliminación casi en cero, una y otra vez: van saliendo los demás.
  await p.page.evaluate(() => {
    window.__elim = setInterval(() => {
      const k = window.leogames.scene.getScene('Kart').game3d;
      if (k?.phase !== 'race') return;
      k.humans[0].lap = 1;
      k.elimLeft = Math.min(k.elimLeft, 200);
    }, 100);
  });
  await p.until(() => window.leogames.scene.getScene('Kart').game3d.phase === 'results', ms(30000), 'que se queden fuera todos los demás');
  await p.page.evaluate(() => clearInterval(window.__elim));
  const state = await p.page.evaluate(() => {
    const k = window.leogames.scene.getScene('Kart').game3d;
    return { out: k.racers.filter((r) => r.out).length, total: k.racers.length, first: k.ranking()[0].isCpu };
  });
  assert.equal(state.out, state.total - 1, 'salen todos menos uno');
  assert.equal(state.first, false, 'gana el jugador');
  assert.ok((await stickers(p.page)).includes('kart-eliminacion'), 'ganar la eliminación da su calcomanía');
  await p.holdToMenu(0, EXIT, 'salir de Karts locos');
  assert.deepEqual(p.errors, []);
  await p.context.close();
});

// Escuela de manejo: el reto de los aros (sin compu ni cajitas); al pasar los 8 aros, la medalla.
test('karts locos: escuela de manejo con medalla', { timeout: ms(120000) }, async () => {
  const p = await openPage(game);
  await p.joinPlayers(1);
  await p.openGameCard('Karts locos');
  await passGarage(p, 1);
  await chooseKartMode(p, 6, 'Escuela de manejo');
  await p.tap(0, BUTTON.A);
  await p.until(() => window.leogames.scene.getScene('Kart').game3d?.phase === 'race', ms(30000), 'empezar el reto de los aros');
  const setup = await p.page.evaluate(() => {
    const k = window.leogames.scene.getScene('Kart').game3d;
    return { racers: k.racers.length, boxes: k.boxes.boxes.length, rings: k.lesson.rings.length };
  });
  assert.deepEqual(setup, { racers: 1, boxes: 0, rings: 8 });
  // Pasa por cada aro (se le pone encima, uno por uno).
  for (let i = 0; i < 8; i += 1) {
    await p.page.evaluate(() => {
      const k = window.leogames.scene.getScene('Kart').game3d;
      const s = k.lesson.state.get(k.humans[0]);
      const ring = k.lesson.rings[s.ring];
      Object.assign(k.humans[0], { x: ring.x, z: ring.z, index: ring.index });
    });
    await p.page.waitForFunction((n) => window.leogames.scene.getScene('Kart').game3d.lesson.state.values().next().value.ring > n, i, { timeout: ms(5000) });
  }
  await p.until(() => window.leogames.scene.getScene('Kart').game3d.phase === 'results', ms(5000), 'ver la medalla');
  assert.ok((await stickers(p.page)).includes('kart-escuela'), 'el oro da su calcomanía');
  // B = otro reto.
  await p.until(() => window.leogames.scene.getScene('Kart').game3d.phaseMs > 1300, ms(10000), 'que se pueda cambiar');
  await p.tap(0, BUTTON.B);
  await p.until(() => document.querySelector('.kart-choose h1')?.textContent.includes('Escuela'), ms(30000), 'regresar a la escuela');
  assert.ok(await p.page.evaluate(() => document.querySelector('.kart-choose').textContent.includes('🥇')), 'la medalla se ve en el reto');
  await p.holdToMenu(0, EXIT, 'salir de Karts locos');
  assert.deepEqual(p.errors, []);
  await p.context.close();
});

// Aventura: el primer reto (llegar entre los 3 primeros) abre el que sigue; el jefe es más grande y avienta cosas.
test('karts locos: aventura con retos y jefe', { timeout: ms(150000) }, async () => {
  const p = await openPage(game);
  await p.joinPlayers(1);
  await p.openGameCard('Karts locos');
  await passGarage(p, 1);
  await chooseKartMode(p, 7, 'Aventura');
  await p.tap(0, BUTTON.A);
  await p.until(() => document.querySelector('.kart-choose h1')?.textContent.includes('Pradera'), ms(10000), 'ver los retos del mundo');
  await p.tap(0, BUTTON.A);
  await p.until(() => window.leogames.scene.getScene('Kart').game3d?.phase === 'race', ms(30000), 'empezar el primer reto');
  // Llega primero.
  await p.page.evaluate(() => {
    const k = window.leogames.scene.getScene('Kart').game3d;
    const h = k.humans[0];
    h.lap = k.laps;
    k.onLap(h);
    k.showResults();
  });
  await p.until(() => window.leogames.scene.getScene('Kart').game3d.phase === 'results', ms(5000), 'ver si pasó el reto');
  assert.ok(await p.page.evaluate(() => window.leogames.scene.getScene('Kart').game3d.stageWon), 'pasó el reto');
  // A = el siguiente reto: las monedas en la playa (llega con 10) y luego Rayo uno contra uno (le gana).
  for (const [stage, track, racers] of [
    [1, 'playa', 6],
    [2, 'dulces', 2],
  ]) {
    await p.until(() => window.leogames.scene.getScene('Kart').game3d.phaseMs > 1300, ms(10000), 'que se pueda seguir');
    await p.tap(0, BUTTON.A);
    await p.page.waitForFunction((n) => window.leogames.scene.getScene('Kart').game3d?.stage?.stage === n && window.leogames.scene.getScene('Kart').game3d.phase === 'race', stage, {
      timeout: ms(30000),
    });
    const now = await p.page.evaluate(() => {
      const k = window.leogames.scene.getScene('Kart').game3d;
      return [k.trackKey, k.racers.length];
    });
    assert.deepEqual(now, [track, racers]);
    await p.page.evaluate(() => {
      const k = window.leogames.scene.getScene('Kart').game3d;
      const h = k.humans[0];
      h.coins = 10;
      h.lap = k.laps;
      k.onLap(h);
      k.showResults();
    });
    await p.until(() => window.leogames.scene.getScene('Kart').game3d.phase === 'results', ms(5000), 'ver si pasó el reto');
    assert.ok(await p.page.evaluate(() => window.leogames.scene.getScene('Kart').game3d.stageWon), `pasó el reto ${stage + 1}`);
  }
  // El jefe del primer mundo: el Rey Bolón en su kart (más grande) con dos de la compu.
  await p.until(() => window.leogames.scene.getScene('Kart').game3d.phaseMs > 1300, ms(10000), 'que se pueda seguir');
  await p.tap(0, BUTTON.A);
  await p.until(() => window.leogames.scene.getScene('Kart').game3d?.stage?.stage === 3 && window.leogames.scene.getScene('Kart').game3d.phase === 'race', ms(30000), 'empezar la carrera contra el jefe');
  const boss = await p.page.evaluate(() => {
    const k = window.leogames.scene.getScene('Kart').game3d;
    k.bossAttackMs = 0;
    return { name: k.rivalRacer.driver.name, big: k.rivalRacer.bigness, racers: k.racers.length };
  });
  assert.deepEqual(boss, { name: 'Rey Bolón', big: 1.35, racers: 4 });
  await p.until(() => window.leogames.scene.getScene('Kart').game3d.bossAttackMs > 1000, ms(5000), 'que el jefe aviente algo');
  // Le gana al jefe.
  await p.page.evaluate(() => {
    const k = window.leogames.scene.getScene('Kart').game3d;
    const h = k.humans[0];
    h.lap = k.laps;
    k.onLap(h);
    k.showResults();
  });
  await p.until(() => window.leogames.scene.getScene('Kart').game3d.phase === 'results', ms(5000), 'ganarle al jefe');
  assert.ok((await stickers(p.page)).includes('kart-jefe'), 'ganarle al jefe da su calcomanía');
  await p.holdToMenu(0, EXIT, 'salir de Karts locos');
  assert.deepEqual(p.errors, []);
  await p.context.close();
});

// Poderes nuevos: el resorte te avienta muy alto, el muro de gelatina rebota, el tornado levanta, la bomba pegajosa
// se le pega al de adelante y explota, y el imán jala.
test('karts locos: poderes nuevos (resorte, gelatina, tornado, bomba pegajosa e imán)', { timeout: ms(120000) }, async () => {
  const p = await openPage(game);
  await p.joinPlayers(1);
  await p.openGameCard('Karts locos');
  await passGarage(p, 1);
  await pickTrack(p);
  await p.until(() => window.leogames.scene.getScene('Kart').game3d.phase === 'race', ms(30000), 'empezar');
  const kart = (fn, arg) => p.page.evaluate(fn, arg);
  // Le da un poder al jugador y lo usa con X.
  const use = async (item) => {
    await kart((it) => {
      const k = window.leogames.scene.getScene('Kart').game3d;
      k.racers.forEach((r) => (r.shieldMs = 0));
      Object.assign(k.humans[0], { item: it, itemUses: 1, rollMs: 0, spinMs: 0 });
    }, item);
    await p.tap(0, BUTTON.X);
  };
  // Pone a un kart de la compu `ahead` unidades adelante del jugador, quieto.
  const cpuAhead = (ahead) =>
    kart((a) => {
      const k = window.leogames.scene.getScene('Kart').game3d;
      const h = k.humans[0];
      const cpu = k.racers[1];
      Object.assign(cpu, { x: h.x + Math.sin(h.heading) * a, z: h.z + Math.cos(h.heading) * a, speed: 0, spinMs: 0, shieldMs: 0, starMs: 0, ghostMs: 0, bulletMs: 0 });
      cpu.update = () => {};
      window.__cpu = cpu;
    }, ahead);

  await use('spring');
  await p.until(() => {
    const h = window.leogames.scene.getScene('Kart').game3d.humans[0];
    return h.y - h.floor > 2.5;
  }, ms(3000), 'brincar muy alto con el resorte');

  await use('jelly');
  await p.until(() => window.leogames.scene.getScene('Kart').game3d.projectiles.list.some((pr) => pr.kind === 'jelly'), ms(3000), 'soltar la gelatina');
  await kart(() => {
    const k = window.leogames.scene.getScene('Kart').game3d;
    const wall = k.projectiles.list.find((pr) => pr.kind === 'jelly');
    const cpu = k.racers[2];
    Object.assign(cpu, { x: wall.x - Math.sin(wall.heading) * 3, z: wall.z - Math.cos(wall.heading) * 3, heading: wall.heading, speed: 25, spinMs: 0 });
    window.__wall = wall;
  });
  // (El rebote dura un instante: se ve en que al muro le queda un golpe menos.)
  await p.until(() => window.__wall.hits < 3, ms(3000), 'rebotar en la gelatina');

  await cpuAhead(14);
  await use('tornado');
  await p.until(() => window.__cpu.spinMs > 0, ms(5000), 'que el tornado tumbe al de adelante');

  await kart(() => (window.__cpu.spinMs = 0));
  await cpuAhead(16);
  await use('sticky');
  await p.until(() => window.leogames.scene.getScene('Kart').game3d.projectiles.list.some((pr) => pr.kind === 'sticky' && pr.stuck === window.__cpu), ms(5000), 'que se le pegue la bomba');
  await kart(() => {
    const bomb = window.leogames.scene.getScene('Kart').game3d.projectiles.list.find((pr) => pr.kind === 'sticky');
    bomb.fuseMs = 50;
  });
  await p.until(() => window.__cpu.spinMs > 0, ms(3000), 'que explote la bomba');

  await use('magnet');
  await p.until(() => window.leogames.scene.getScene('Kart').game3d.humans[0].magnetMs > 0, ms(3000), 'prender el imán');
  await p.holdToMenu(0, EXIT, 'salir de Karts locos');
  assert.deepEqual(p.errors, []);
  await p.context.close();
});

// Karts especiales, mejoras y kart para dos: en la tienda se compra el motor y la moto; el Jugador 2 se sube de
// copiloto (LB) y avienta los poderes; con Y la moto hace caballito.
test('karts locos: tienda con mejoras, moto con caballito y kart para dos', { timeout: ms(120000) }, async () => {
  const p = await openPage(game);
  await p.page.evaluate(() => import('/src/shared/settings.js').then((m) => m.settings.set('kartWallet', 1000)));
  await p.joinPlayers(2);
  await p.openGameCard('Karts locos');
  await p.until(() => window.leogames.scene.getScene('Kart').game3d?.phase === 'garage', ms(30000), 'ver el taller');
  // La tienda: lo primero es el motor; la moto es la séptima (3 mejoras, luego cohete, tina, pato y moto).
  await p.tap(0, BUTTON.X);
  await p.tap(0, BUTTON.A);
  for (let i = 0; i < 6; i += 1) await p.tap(0, BUTTON.RIGHT);
  await p.tap(0, BUTTON.A);
  await p.tap(0, BUTTON.B);
  const saved = await p.page.evaluate(() => ({
    upgrades: JSON.parse(localStorage.getItem('leogames:kartMejoras')),
    owned: JSON.parse(localStorage.getItem('leogames:kartOwned')),
  }));
  assert.equal(saved.upgrades.motor, 1, 'motor nivel 1');
  assert.ok(saved.owned.includes('type:moto'), 'se compró la moto');
  // El Jugador 1 escoge la moto (↓ al renglón del kart y ▶ hasta la moto); el Jugador 2 se sube de copiloto.
  await p.tap(0, BUTTON.DOWN);
  for (let i = 0; i < 4; i += 1) await p.tap(0, BUTTON.RIGHT);
  await p.tap(1, BUTTON.LB);
  await passGarage(p, 2);
  await pickTrack(p);
  await p.until(() => window.leogames.scene.getScene('Kart').game3d.phase === 'race', ms(30000), 'empezar');
  const state = await p.page.evaluate(() => {
    const k = window.leogames.scene.getScene('Kart').game3d;
    const h = k.humans[0];
    return { humans: k.humans.length, type: h.setup.type, gunner: h.gunner?.label, passenger: Boolean(h.passenger), maxSpeed: h.stats.maxSpeed, cpu: k.racers[1].stats.maxSpeed };
  });
  assert.equal(state.humans, 1, 'los dos van en un kart');
  assert.equal(state.type, 'moto');
  assert.equal(state.gunner, 'J2');
  assert.ok(state.passenger, 'el copiloto se ve en el kart');
  // El motor: la moto (velocidad 3) con motor nivel 1 va más rápido que cualquier kart normal.
  assert.ok(state.maxSpeed > 41.5, `con el motor va más rápido (${state.maxSpeed})`);
  // El copiloto (control 2) avienta el plátano con X.
  await p.page.evaluate(() => Object.assign(window.leogames.scene.getScene('Kart').game3d.humans[0], { item: 'banana', itemUses: 1, rollMs: 0 }));
  await p.tap(1, BUTTON.X);
  // (El de atrás lo puede pisar luego luego: se ve en que ya no trae el plátano.)
  await p.until(() => window.leogames.scene.getScene('Kart').game3d.humans[0].item === null, ms(3000), 'que el copiloto avienta el plátano');
  // Y = caballito de la moto.
  await p.tap(0, BUTTON.Y);
  await p.until(() => window.leogames.scene.getScene('Kart').game3d.humans[0].wheelieMs > 0, ms(3000), 'hacer caballito');
  // Los dos echan nitro al mismo tiempo: ¡turbo de equipo!
  await p.page.evaluate(() => {
    window.__button(0, 5, true);
    window.__button(1, 5, true);
  });
  await p.until(() => window.leogames.scene.getScene('Kart').game3d.humans[0].boostFactor >= 1.75, ms(3000), 'turbo de equipo');
  await p.page.evaluate(() => {
    window.__button(0, 5, false);
    window.__button(1, 5, false);
  });
  await p.holdToMenu(0, EXIT, 'salir de Karts locos');
  assert.deepEqual(p.errors, []);
  await p.context.close();
});

// Extras: mortal con ↑ + LB en el aire, derrape de arcoíris, la carita del piloto en su panel, el público en las
// gradas con la tele y el récord de la pista al llegar.
test('karts locos: trucos, derrape arcoíris, caras, público y récord de la pista', { timeout: ms(120000) }, async () => {
  const p = await openPage(game);
  await p.joinPlayers(1);
  await p.openGameCard('Karts locos');
  await passGarage(p, 1);
  await pickTrack(p);
  await p.until(() => window.leogames.scene.getScene('Kart').game3d.phase === 'race', ms(30000), 'empezar');
  const kart = (fn) => p.page.evaluate(fn);
  // En el aire, ↑ + LB: mortal.
  await kart(() => {
    const h = window.leogames.scene.getScene('Kart').game3d.humans[0];
    h.launch(16);
    window.__pads[0].axes = [0, -1, 0, 0];
  });
  await p.tap(0, BUTTON.LB);
  assert.equal(await kart(() => window.leogames.scene.getScene('Kart').game3d.humans[0].trickKind), 'flip');
  await kart(() => (window.__pads[0].axes = [0, 0, 0, 0]));
  // Derrape de arcoíris: el turbo más grande.
  const rainbow = await kart(() => {
    const h = window.leogames.scene.getScene('Kart').game3d.humans[0];
    Object.assign(h, { drifting: true, driftDir: 1, driftMs: 3500, boostMs: 0 });
    const level = h.driftLevel;
    h.endDrift(false);
    return { level, factor: h.boostFactor };
  });
  assert.deepEqual(rainbow, { level: 4, factor: 1.55 });
  // La carita del piloto: feliz.
  await kart(() => window.leogames.scene.getScene('Kart').game3d.humans[0].setMood('feliz', 5000));
  await p.until(() => document.querySelector('.kart-panel .face img')?.src.includes('frente_feliz'), ms(3000), 'la carita feliz');
  // El público y la tele.
  const crowd = await kart(() => {
    const c = window.leogames.scene.getScene('Kart').game3d.crowd;
    return { fans: c.fans.length > 10, heli: Boolean(c.heli), blimp: Boolean(c.blimp) };
  });
  assert.deepEqual(crowd, { fans: true, heli: true, blimp: true });
  // Llega: récord de la pista, y se ve en su tarjeta.
  await kart(() => {
    const k = window.leogames.scene.getScene('Kart').game3d;
    const h = k.humans[0];
    h.lap = k.laps;
    k.onLap(h);
    k.showResults();
  });
  assert.ok(await kart(() => Boolean(JSON.parse(localStorage.getItem('leogames:kartRecordsPista'))['pradera:3'])), 'se guardó el récord');
  await p.until(() => window.leogames.scene.getScene('Kart').game3d.phaseMs > 1300, ms(10000), 'que se pueda cambiar');
  await p.tap(0, BUTTON.B);
  await p.until(() => document.querySelector('.kart-choose h1')?.textContent === 'Escoge pista', ms(30000), 'ver las pistas');
  assert.match(await kart(() => document.querySelector('.kart-choose .card .info')?.textContent ?? ''), /⏱️/, 'el récord en la tarjeta');
  await p.holdToMenu(0, EXIT, 'salir de Karts locos');
  assert.deepEqual(p.errors, []);
  await p.context.close();
});

// Copa Tesoro: en el Desierto el tren te tumba, en la Ciudad de noche las plumas te rebotan, en la Casa gigante el
// puente levadizo te avienta y en el Barco pirata los cañones de agua te empujan.
test('karts locos: copa tesoro con tren, plumas, puente y cañones de agua', { timeout: ms(180000) }, async () => {
  const p = await openPage(game);
  await p.joinPlayers(1);
  await p.openGameCard('Karts locos');
  await passGarage(p, 1);
  await chooseKartMode(p, 1, 'Gran Premio');
  for (let i = 0; i < 4; i += 1) await p.tap(0, BUTTON.RIGHT);
  await p.tap(0, BUTTON.A);
  const race = (n) =>
    p.page.waitForFunction((k) => window.leogames.scene.getScene('Kart').game3d?.gp?.race === k && window.leogames.scene.getScene('Kart').game3d.phase === 'race', n, {
      timeout: ms(30000),
    });
  // Pone al jugador en un lugar de la pista (`at` de 0 a 1, `ahead` muestras antes, `lateral` de lado) con esa velocidad.
  const place = (at, ahead, speed, lateral = 0) =>
    p.page.evaluate(
      ([a, back, v, side]) => {
        const k = window.leogames.scene.getScene('Kart').game3d;
        const r = k.humans[0];
        const spot = k.track.pointAt(Math.round(a * k.track.count) - back, side);
        Object.assign(r, { x: spot.x, z: spot.z, heading: spot.heading, index: spot.index, speed: v, shieldMs: 0, spinMs: 0, y: spot.y, vy: 0 });
      },
      [at, ahead, speed, lateral],
    );
  const next = async () => {
    await p.page.evaluate(() => window.leogames.scene.getScene('Kart').game3d.showResults());
    await p.until(() => window.leogames.scene.getScene('Kart').game3d.phaseMs > 1300, ms(10000), 'que se pueda seguir');
    await p.tap(0, BUTTON.A);
  };

  await race(0);
  assert.equal(await p.page.evaluate(() => window.leogames.scene.getScene('Kart').game3d.trackKey), 'desierto');
  // El tren pasa justo cuando el jugador está en las vías.
  await p.page.evaluate(() => {
    const living = window.leogames.scene.getScene('Kart').game3d.living;
    const train = living.items[0];
    living.timeMs = 15000 - train.offset + 2600 + ((train.span - 2) / 34) * 1000;
  });
  await place(0.91, 0, 0);
  await p.until(() => window.leogames.scene.getScene('Kart').game3d.humans[0].spinMs > 0, ms(5000), 'que lo alcance el tren');
  await next();

  await race(1);
  assert.equal(await p.page.evaluate(() => window.leogames.scene.getScene('Kart').game3d.trackKey), 'neon');
  // La pluma de ese lado está abajo: al llegar rebota para atrás.
  await p.page.evaluate(() => {
    const living = window.leogames.scene.getScene('Kart').game3d.living;
    living.timeMs = 6400 * 10 + 900 - living.items[0].offset;
  });
  await place(0.22, 1, 20, 4);
  await p.until(() => window.leogames.scene.getScene('Kart').game3d.humans[0].speed < 0, ms(3000), 'rebotar en la pluma');
  await next();

  await race(2);
  assert.equal(await p.page.evaluate(() => window.leogames.scene.getScene('Kart').game3d.trackKey), 'casa');
  // El puente subido: al pasar por él sale volando.
  await p.page.evaluate(() => {
    const living = window.leogames.scene.getScene('Kart').game3d.living;
    living.timeMs = 3600 + 900 + 400 - living.items[0].offset;
    window.__flew = false;
    window.__fly = setInterval(() => {
      const r = window.leogames.scene.getScene('Kart').game3d.humans[0];
      if (r.airborne) window.__flew = true;
    }, 20);
  });
  await place(0.15, 8, 26);
  await p.page.evaluate(() => window.__button(0, 0, true));
  await p.until(() => window.__flew, ms(4000), 'salir volando del puente');
  await p.page.evaluate(() => {
    window.__button(0, 0, false);
    clearInterval(window.__fly);
  });
  await next();

  await race(3);
  assert.equal(await p.page.evaluate(() => window.leogames.scene.getScene('Kart').game3d.trackKey), 'pirata');
  // El chorro del cañón lo empuja de lado.
  const before = await p.page.evaluate(() => {
    const living = window.leogames.scene.getScene('Kart').game3d.living;
    living.timeMs = 5200 - living.items[0].offset + 800;
    return true;
  });
  assert.ok(before);
  await place(0.1, 0, 0);
  const lateral = () =>
    p.page.evaluate(() => {
      const k = window.leogames.scene.getScene('Kart').game3d;
      const r = k.humans[0];
      return k.track.lateral(r.x, r.z, r.index);
    });
  const start = await lateral();
  await p.wait(500);
  assert.ok(Math.abs((await lateral()) - start) > 1, 'el chorro lo empuja de lado');
  await p.holdToMenu(0, EXIT, 'salir de Karts locos');
  assert.deepEqual(p.errors, []);
  await p.context.close();
});

// Clima que cambia (Y en las pantallas de escoger): en cada vuelta otro clima; otra carrera empieza como al principio.
test('karts locos: clima que cambia', { timeout: ms(120000) }, async () => {
  const p = await openPage(game);
  await p.joinPlayers(1);
  await p.openGameCard('Karts locos');
  await passGarage(p, 1);
  await chooseKartMode(p, 0, 'Escoge pista');
  // Y: de "De la pista" a "Cambia".
  await p.tap(0, BUTTON.Y);
  await p.tap(0, BUTTON.A);
  await p.until(() => window.leogames.scene.getScene('Kart').game3d?.phase === 'race', ms(30000), 'empezar');
  const weather = () => p.page.evaluate(() => window.leogames.scene.getScene('Kart').game3d.weatherKey);
  assert.equal(await weather(), 'sol');
  // El primero empieza la vuelta 2: llueve (y se ve la lluvia en la pantalla).
  await p.page.evaluate(() => {
    const k = window.leogames.scene.getScene('Kart').game3d;
    const r = k.racers[1];
    r.lap = 1;
    k.onLap(r);
  });
  assert.equal(await weather(), 'lluvia');
  assert.ok(await p.page.evaluate(() => Boolean(document.querySelector('.kart-panel .rain'))), 'se ve la lluvia');
  await p.page.evaluate(() => {
    const k = window.leogames.scene.getScene('Kart').game3d;
    const r = k.racers[1];
    r.lap = 2;
    k.onLap(r);
  });
  assert.equal(await weather(), 'noche');
  assert.equal(await p.page.evaluate(() => document.querySelector('.kart-panel .rain')), null, 'ya no llueve');
  // Otra carrera: otra vez soleado.
  await p.page.evaluate(() => window.leogames.scene.getScene('Kart').game3d.showResults());
  await p.until(() => window.leogames.scene.getScene('Kart').game3d.phaseMs > 1300, ms(10000), 'que se pueda pedir otra');
  await p.tap(0, BUTTON.A);
  await p.until(() => window.leogames.scene.getScene('Kart').game3d.phase === 'countdown', ms(5000), 'otra carrera');
  assert.equal(await weather(), 'sol');
  await p.holdToMenu(0, EXIT, 'salir de Karts locos');
  assert.deepEqual(p.errors, []);
  await p.context.close();
});

// Arma tu pista: mover un punto hasta que se encime no deja correr; acomodado, RT corre en "Mi pista", que luego
// aparece al final de las pistas.
test('karts locos: arma tu pista', { timeout: ms(120000) }, async () => {
  const p = await openPage(game);
  await p.joinPlayers(1);
  await p.openGameCard('Karts locos');
  await passGarage(p, 1);
  await p.until(() => window.leogames.scene.getScene('Kart').game3d?.phase === 'choose', ms(30000), 'ver los modos');
  for (let i = 0; i < 8; i += 1) await p.tap(0, BUTTON.RIGHT);
  await p.tap(0, BUTTON.A);
  await p.until(() => window.leogames.scene.getScene('Kart').game3d?.phase === 'editor', ms(5000), 'abrir el editor');
  const editor = (fn) => p.page.evaluate(fn);
  // Agarra el punto de la derecha y lo jala hasta el otro lado: se encima.
  await editor(() => (window.leogames.scene.getScene('Kart').game3d.editor.cursor = { x: 100, z: 0 }));
  await p.tap(0, BUTTON.A);
  await editor(() => (window.leogames.scene.getScene('Kart').game3d.editor.cursor = { x: -60, z: 10 }));
  await p.wait(200);
  assert.ok(await editor(() => Boolean(window.leogames.scene.getScene('Kart').game3d.editor.problem)), 'se encima');
  await p.tap(0, BUTTON.RT);
  assert.equal(await editor(() => window.leogames.scene.getScene('Kart').game3d.phase), 'editor', 'encimada no se puede correr');
  // Lo deja en un buen lugar, le sube una loma y cambia el paisaje.
  await editor(() => (window.leogames.scene.getScene('Kart').game3d.editor.cursor = { x: 60, z: 10 }));
  await p.wait(200);
  await p.tap(0, BUTTON.A);
  await p.tap(0, BUTTON.RB);
  await p.tap(0, BUTTON.Y);
  const saved = await editor(() => JSON.parse(localStorage.getItem('leogames:kartMiPista')));
  assert.equal(saved.theme, 'playa');
  assert.deepEqual(saved.points[3], [60, 10, 10]);
  await p.tap(0, BUTTON.RT);
  await p.until(() => window.leogames.scene.getScene('Kart').game3d.phase === 'countdown' || window.leogames.scene.getScene('Kart').game3d.phase === 'race', ms(15000), 'correr en mi pista');
  assert.equal(await editor(() => window.leogames.scene.getScene('Kart').game3d.trackKey), 'mipista');
  // B en los resultados: "Mi pista" está al final de las pistas.
  await editor(() => window.leogames.scene.getScene('Kart').game3d.showResults());
  await p.until(() => window.leogames.scene.getScene('Kart').game3d.phaseMs > 1300, ms(10000), 'que se pueda cambiar');
  await p.tap(0, BUTTON.B);
  await p.until(() => document.querySelector('.kart-choose h1')?.textContent === 'Escoge pista', ms(30000), 'ver las pistas');
  assert.ok(await editor(() => [...document.querySelectorAll('.kart-choose .card b')].at(-1).textContent === 'Mi pista'), 'Mi pista al final');
  await p.holdToMenu(0, EXIT, 'salir de Karts locos');
  assert.deepEqual(p.errors, []);
  await p.context.close();
});

test('karts locos: escoger la pista de nieve y cambiar de pista', { timeout: ms(180000) }, async () => {
  const p = await openPage(game);
  await p.page.evaluate(() => import('/src/shared/settings.js').then((m) => m.settings.set('stickers', ['kart-gana'])));
  await p.joinPlayers(1);
  await p.openGameCard('Karts locos');
  await passGarage(p, 1);
  await pickRaceMode(p);
  // La nieve es la cuarta del primer renglón.
  for (let i = 0; i < 3; i += 1) await p.tap(0, BUTTON.RIGHT);
  await p.tap(0, BUTTON.A);
  await p.until(() => window.leogames.scene.getScene('Kart').game3d.trackKey === 'nieve', ms(10000), 'entrar a la nieve');
  assert.ok(await p.page.evaluate(() => Boolean(window.leogames.scene.getScene('Kart').game3d.snow)), 'no está nevando');
  await startKartBot(p.page);
  await p.until(() => window.leogames.scene.getScene('Kart').game3d.humans[0].progress > 0.3, ms(120000), 'avanzar en la nieve');
  // Al terminar, B regresa a escoger pista (el juego se abre otra vez desde cero).
  await p.page.evaluate(() => {
    clearInterval(window.__bot);
    window.__release();
    window.leogames.scene.getScene('Kart').game3d.showResults();
  });
  await p.until(() => window.leogames.scene.getScene('Kart').game3d.phaseMs > 1300, ms(10000), 'que se pueda cambiar de pista');
  await p.tap(0, BUTTON.B);
  await p.until(() => window.leogames.scene.getScene('Kart').game3d?.phase === 'choose', ms(30000), 'regresar a escoger pista');
  assert.equal(await p.page.evaluate(() => document.querySelectorAll('.kart-choose').length), 1);
  await p.holdToMenu(0, EXIT, 'salir de Karts locos');
  assert.equal(await p.page.evaluate(() => document.querySelectorAll('body > div[style*="z-index"]').length), 0, 'quedó la capa 3D');
  assert.deepEqual(p.errors, []);
  await p.context.close();
});

// Valle de los dinos con lluvia: el atajo secreto, el planeador, el túnel de agua y los poderes nuevos.
test('karts locos: atajo, planeador, agua, lluvia y poderes nuevos', { timeout: ms(150000) }, async () => {
  const p = await openPage(game);
  await p.joinPlayers(1);
  await p.openGameCard('Karts locos');
  await passGarage(p, 1);
  await pickRaceMode(p);
  // Y = clima: "De la pista" → "Cambia" → "Soleado" → "Lluvia".
  await p.tap(0, BUTTON.Y);
  await p.tap(0, BUTTON.Y);
  await p.tap(0, BUTTON.Y);
  assert.match(await p.page.evaluate(() => document.querySelector('.kart-choose .options').textContent), /Lluvia/);
  await p.page.evaluate(() => import('/src/games/kart/tracks.js').then((m) => window.leogames.scene.getScene('Kart').game3d.chooser.select(m.TRACK_KEYS.indexOf('dinos'))));
  await p.tap(0, BUTTON.A);
  await p.until(() => window.leogames.scene.getScene('Kart').game3d.phase === 'race', ms(20000), 'empezar en el valle de los dinos');
  assert.equal(await p.page.evaluate(() => window.leogames.scene.getScene('Kart').game3d.weather.kind), 'lluvia');
  await p.page.evaluate(() => window.__button(0, 0, true));
  // Lejos de la compu, para que nadie estorbe.
  const place = (fn) =>
    p.page.evaluate((code) => {
      const k = window.leogames.scene.getScene('Kart').game3d;
      for (const cpu of k.racers.filter((r) => r.isCpu)) Object.assign(cpu, { speed: 0, x: 9999, z: 9999, index: (k.humans[0].index + 200) % k.track.count });
      const r = k.humans[0];
      const spot = new Function('k', code)(k);
      Object.assign(r, { x: spot.x, z: spot.z, index: spot.index, heading: spot.heading, speed: spot.speed, boostMs: 0, shortcut: false, y: spot.y, floor: spot.y, vy: 0, flying: false, gliding: false, inkMs: 0 });
    }, fn);

  // El atajo: pegado a la orilla junto a la entrada, apuntando al caminito; el bot lo sigue hasta salir.
  await place(`const sc = k.shortcut; const at = k.track.pointAt(sc.i - 2, sc.side * 7.5); const aim = sc.pointAt(0.35);
    return { ...at, heading: Math.atan2(aim.x - at.x, aim.z - at.z), speed: 25 };`);
  await p.page.evaluate(() => {
    window.__bot = setInterval(() => {
      const k = window.leogames.scene.getScene('Kart').game3d;
      const r = k.humans[0];
      const target = r.shortcut ? k.shortcut.pointAt(Math.min(1.05, k.shortcut.project(r.x, r.z).t + 0.12)) : k.shortcut.pointAt(0.35);
      const diff = Math.atan2(Math.sin(Math.atan2(target.x - r.x, target.z - r.z) - r.heading), Math.cos(Math.atan2(target.x - r.x, target.z - r.z) - r.heading));
      window.__pads[0].axes = [Math.max(-1, Math.min(1, -diff * 2.5)), 0, 0, 0];
    }, 50);
  });
  await p.until(() => window.leogames.scene.getScene('Kart').game3d.humans[0].shortcut, ms(5000), 'entrar al atajo');
  await p.until(() => !window.leogames.scene.getScene('Kart').game3d.humans[0].shortcut, ms(15000), 'salir del atajo');
  await p.page.evaluate(() => {
    clearInterval(window.__bot);
    window.__pads[0].axes = [0, 0, 0, 0];
  });
  assert.ok((await stickers(p.page)).includes('kart-atajo'), 'falta la calcomanía del atajo');

  // El planeador: la rampa azul.
  await place('const g = k.features.gliders[0]; return { ...k.track.pointAt(g.start - 10, 0), speed: 32 };');
  await p.until(() => window.leogames.scene.getScene('Kart').game3d.humans[0].gliding, ms(6000), 'abrir el planeador');

  // El túnel de agua: la hélice.
  await place('const w = k.features.water; return { ...k.track.pointAt(w.from + 5, 0), speed: 20 };');
  await p.until(() => window.leogames.scene.getScene('Kart').game3d.humans[0].underwater, ms(3000), 'meterse al agua');

  // Poderes nuevos: estrella, bala y fantasma (le roba su poder a la compu).
  const give = (item) => p.page.evaluate((it) => Object.assign(window.leogames.scene.getScene('Kart').game3d.humans[0], { item: it, itemUses: 1, rollMs: 0 }), item);
  await give('star');
  await p.tap(0, BUTTON.X);
  assert.ok(await p.page.evaluate(() => window.leogames.scene.getScene('Kart').game3d.humans[0].starMs > 0), 'sin estrella');
  await give('bullet');
  await p.tap(0, BUTTON.X);
  assert.ok(await p.page.evaluate(() => window.leogames.scene.getScene('Kart').game3d.humans[0].bulletMs > 0), 'sin bala');
  // (En el mismo cuadro: si no, la compu dispara su cohete antes.)
  const ghost = await p.page.evaluate(() => {
    const k = window.leogames.scene.getScene('Kart').game3d;
    for (const r of k.racers) Object.assign(r, { starMs: 0, bulletMs: 0, item: null });
    Object.assign(k.racers.find((r) => r.isCpu), { item: 'rocket', itemUses: 1, rollMs: 0 });
    const me = Object.assign(k.humans[0], { item: 'ghost', itemUses: 1, rollMs: 0 });
    k.useItem(me, k.ranking());
    return { ghostMs: me.ghostMs, item: me.item };
  });
  assert.ok(ghost.ghostMs > 0 && ghost.item === 'rocket', JSON.stringify(ghost));
  await p.page.evaluate(() => window.__release());
  await p.holdToMenu(0, EXIT, 'salir de Karts locos');
  assert.deepEqual(p.errors, []);
  await p.context.close();
});

// Contrarreloj: sin compu ni cajitas; al llegar se guarda el récord y la siguiente vez sale el fantasma.
test('karts locos: contrarreloj con récord y fantasma', { timeout: ms(150000) }, async () => {
  const p = await openPage(game);
  await p.joinPlayers(1);
  await p.openGameCard('Karts locos');
  await passGarage(p, 1);
  await p.until(() => window.leogames.scene.getScene('Kart').game3d?.phase === 'choose', ms(30000), 'ver los modos');
  // Es el quinto modo.
  for (let i = 0; i < 4; i += 1) await p.tap(0, BUTTON.RIGHT);
  await p.tap(0, BUTTON.A);
  await p.until(() => document.querySelector('.kart-choose h1')?.textContent === 'Escoge pista', ms(10000), 'ver las pistas');
  await p.tap(0, BUTTON.A);
  await p.until(() => window.leogames.scene.getScene('Kart').game3d.phase === 'race', ms(20000), 'empezar el contrarreloj');
  const setup = await p.page.evaluate(() => {
    const k = window.leogames.scene.getScene('Kart').game3d;
    return { racers: k.racers.length, boxes: k.boxes.boxes.length, laps: k.laps };
  });
  assert.deepEqual(setup, { racers: 1, boxes: 0, laps: 3 });
  await p.page.evaluate(() => window.__button(0, 0, true));
  await p.wait(2000);
  // Ya en la última vuelta, antes de la meta.
  await p.page.evaluate(() => {
    const k = window.leogames.scene.getScene('Kart').game3d;
    const r = k.humans[0];
    const spot = k.track.pointAt(k.track.count - 30, 0);
    Object.assign(r, { lap: k.laps - 1, crossedHalf: true, x: spot.x, z: spot.z, index: spot.index, heading: spot.heading, speed: 30 });
  });
  await p.until(() => window.leogames.scene.getScene('Kart').game3d.phase === 'results', ms(30000), 'llegar (con la repetición)');
  assert.ok((await stickers(p.page)).includes('kart-record'), 'falta la calcomanía del récord');
  await p.page.evaluate(() => window.__release());
  await p.until(() => window.leogames.scene.getScene('Kart').game3d.phaseMs > 1300, ms(10000), 'poder correr otra vez');
  await p.tap(0, BUTTON.A);
  await p.until(() => window.leogames.scene.getScene('Kart').game3d.phase === 'countdown', ms(10000), 'otra vez');
  assert.ok(await p.page.evaluate(() => Boolean(window.leogames.scene.getScene('Kart').game3d.ghost)), 'no salió el fantasma');
  await p.holdToMenu(0, EXIT, 'salir de Karts locos');
  assert.deepEqual(p.errors, []);
  await p.context.close();
});

test('fútbol de bolitas: poderes, tiro especial, gol de oro, penales y copa', { timeout: ms(150000) }, async () => {
  const p = await openPage(game);
  await p.joinPlayers(1);
  await p.openGameCard('Fútbol de bolitas');
  await p.pickCharacters(1);
  await p.until(() => window.leogames.scene.getScene('Futbol')?.phase === 'setup', ms(8000), 'ver la pantalla de equipos');
  await p.tap(0, BUTTON.A);
  await p.until(() => window.leogames.scene.getScene('Futbol').phase === 'play', ms(8000), 'empezar el partido');
  // Los poderes: balón gigante, portería chiquita del rival y rivales congelados.
  const powers = await p.page.evaluate(async () => {
    const { GOAL_HEIGHT } = await import('/src/games/futbol/field.js');
    const s = window.leogames.scene.getScene('Futbol');
    const me = s.team.find((t) => !t.isCpu);
    for (const kind of ['balon-gigante', 'porteria-chica', 'hielo']) {
      s.powers.spawn();
      s.powers.box.kind = kind;
      s.powers.take(0, me);
    }
    return { scale: s.ball.scale, goal: GOAL_HEIGHT[1], frozen: s.team.filter((t) => t.team === 1).every((t) => t.frozenMs > 0) };
  });
  assert.ok(powers.scale > 1 && powers.goal < 200 && powers.frozen, JSON.stringify(powers));
  // Tiro especial: con la barra llena y LB + RB, el balón sale brillando.
  await p.page.evaluate(() => {
    const s = window.leogames.scene.getScene('Futbol');
    const me = s.team.find((t) => !t.isCpu);
    me.addMeter(100);
    s.ball.reset(me.x + 70, 620);
  });
  await p.page.evaluate(() => { window.__button(0, 4, true); window.__button(0, 5, true); });
  await p.until(() => window.leogames.scene.getScene('Futbol').ball.special || window.leogames.scene.getScene('Futbol').phase !== 'play', ms(5000), 'el tiro especial');
  await p.page.evaluate(() => window.__release());
  // Casi siempre entra solito; si pega en el travesaño (o va lento en GitHub), se empuja a la portería.
  try {
    await p.until(() => window.leogames.scene.getScene('Futbol').phase !== 'play', ms(4000), 'gol con el tiro especial');
  } catch {
    await p.page.evaluate(() => {
      const s = window.leogames.scene.getScene('Futbol');
      const me = s.team.find((t) => !t.isCpu);
      Object.assign(s.ball, { x: 1230, y: 600, vx: 900, vy: 0, lastTouch: me, specialBy: me });
    });
    await p.until(() => window.leogames.scene.getScene('Futbol').phase !== 'play', ms(5000), 'que entre el tiro especial');
  }
  // Por tiempo: si se acaba empatado, gol de oro.
  await p.until(() => window.leogames.scene.getScene('Futbol').phase === 'play', ms(15000), 'seguir jugando');
  await p.page.evaluate(() => {
    const s = window.leogames.scene.getScene('Futbol');
    s.match.minutes = 2;
    s.score = [1, 1];
    s.clockMs = 200;
  });
  await p.until(() => window.leogames.scene.getScene('Futbol').goldenGoal, ms(5000), 'gol de oro');
  await p.page.evaluate(() => window.leogames.scene.getScene('Futbol').scoreGoal(0));
  await p.until(() => window.leogames.scene.getScene('Futbol').phase === 'end', ms(15000), 'ganar con gol de oro');
  // Penales: tira el jugador y luego se acaba la tanda.
  await p.until(() => window.leogames.scene.getScene('Futbol').phaseMs > 1300, ms(10000), 'poder escoger');
  await p.tap(0, BUTTON.B);
  await p.until(() => window.leogames.scene.getScene('Futbol').phase === 'setup', ms(8000), 'regresar a escoger');
  await p.tap(0, BUTTON.LEFT);
  await p.tap(0, BUTTON.A);
  await p.until(() => window.leogames.scene.getScene('Futbol').shootout?.state === 'aim', ms(10000), 'el primer penal');
  await p.tap(0, BUTTON.X);
  await p.until(() => window.leogames.scene.getScene('Futbol').shootout.kicks[0].length === 1, ms(10000), 'que cuente el penal');
  await p.page.evaluate(() => window.leogames.scene.getScene('Futbol').shootout.finish(0));
  await p.until(() => window.leogames.scene.getScene('Futbol').phase === 'end', ms(5000), 'ganar los penales');
  // Copa: el camino de 3 partidos; al ganar la final sale la copa.
  await p.until(() => window.leogames.scene.getScene('Futbol').phaseMs > 1300, ms(10000), 'poder escoger');
  await p.tap(0, BUTTON.B);
  await p.until(() => window.leogames.scene.getScene('Futbol').phase === 'setup', ms(8000), 'regresar a escoger');
  await p.tap(0, BUTTON.LEFT);
  await p.tap(0, BUTTON.A);
  await p.until(() => window.leogames.scene.getScene('Futbol').phase === 'copa', ms(8000), 'ver el camino de la Copa');
  await p.tap(0, BUTTON.A);
  await p.until(() => window.leogames.scene.getScene('Futbol').phase === 'kickoff', ms(8000), 'empezar el partido de la Copa');
  await p.page.evaluate(() => {
    const s = window.leogames.scene.getScene('Futbol');
    s.copa.round = 2;
    s.finishMatch(0);
  });
  const earned = await stickers(p.page);
  for (const id of ['futbol-especial', 'futbol-penales', 'futbol-copa']) assert.ok(earned.includes(id), `falta ${id}: ${earned}`);
  await p.holdToMenu(0, EXIT, 'salir del fútbol');
  assert.deepEqual(p.errors, []);
  await p.context.close();
});

test('fútbol de bolitas: meter gol, ganar el partido y revancha', { timeout: ms(150000) }, async () => {
  const p = await openPage(game);
  await p.joinPlayers(1);
  await p.openGameCard('Fútbol de bolitas');
  await p.pickCharacters(1);
  await p.until(() => window.leogames.scene.getScene('Futbol')?.phase === 'setup', ms(8000), 'ver la pantalla de equipos');
  await p.tap(0, BUTTON.A);
  await p.until(() => window.leogames.scene.getScene('Futbol').phase === 'play', ms(8000), 'empezar el partido');
  // El bot juega con la misma lógica de la compu, pero a velocidad de jugador.
  await p.page.evaluate(async () => {
    const { cpuInput } = await import('/src/games/futbol/cpu.js');
    window.__bot = setInterval(() => {
      const s = window.leogames.scene.getScene('Futbol');
      if (!s.sys.isActive()) return;
      for (const f of s.team.filter((t) => !t.isCpu)) {
        const pad = window.__pads[Number(f.deviceId.replace('pad', ''))];
        const input = cpuInput(f, s.ball, false, { speed: 1, kickChance: 0.6, power: 1 });
        pad.axes = [input.x, 0, 0, 0];
        pad.buttons[2].pressed = input.kick && !pad.buttons[2].pressed;
        pad.buttons[0].pressed = input.jump && !pad.buttons[0].pressed;
      }
    }, 50);
  });
  // Casi siempre alguien anota jugando; si los bots se atoran con el balón (pasa a veces en GitHub, que va
  // lento), el balón rueda solito a la portería de los Rojos para seguir probando que el gol cuenta.
  const scored = () => window.leogames.scene.getScene('Futbol').score.some((goals) => goals > 0);
  try {
    await p.until(scored, ms(60000), 'que alguien meta gol');
  } catch {
    await p.page.evaluate(() => Object.assign(window.leogames.scene.getScene('Futbol').ball, { x: 1170, y: 600, vx: 900, vy: 0 }));
    await p.until(scored, ms(10000), 'que el balón entre a la portería');
  }
  await stopBot(p.page);
  await p.page.evaluate(() => window.__release());
  // Al último gol le pega el jugador: gana el partido.
  await p.until(() => window.leogames.scene.getScene('Futbol').phase === 'play', ms(10000), 'el saque');
  await p.page.evaluate(() => {
    const s = window.leogames.scene.getScene('Futbol');
    s.score = [s.setup.goals - 1, 0];
    s.ball.lastTouch = s.team.find((t) => !t.isCpu);
    s.scoreGoal(0);
  });
  await p.until(() => window.leogames.scene.getScene('Futbol').phase === 'end', ms(10000), 'terminar el partido');
  const earned = await stickers(p.page);
  assert.ok(earned.includes('futbol-gol') && earned.includes('futbol-gana'), `calcomanías: ${earned}`);
  await p.until(() => window.leogames.scene.getScene('Futbol').phaseMs > 1300, ms(10000), 'que se pueda pedir revancha');
  await p.tap(0, BUTTON.A);
  await p.until(() => window.leogames.scene.getScene('Futbol').score.join('-') === '0-0', ms(5000), 'revancha');
  await p.holdToMenu(0, EXIT, 'salir del fútbol');
  assert.deepEqual(p.errors, []);
  await p.context.close();
});

test('duelo de bolitas: pelear contra la compu, ganar y siguiente pelea', { timeout: ms(150000) }, async () => {
  const p = await openPage(game);
  await p.joinPlayers(1);
  await p.openGameCard('Duelo de bolitas');
  await p.pickCharacters(1);
  await p.until(() => window.leogames.scene.getScene('Duelo')?.phase === 'setup', ms(8000), 'ver la pantalla del duelo');
  await p.tap(0, BUTTON.A);
  await p.until(() => window.leogames.scene.getScene('Duelo').phase === 'fight', ms(10000), 'empezar a pelear');
  // El bot camina hacia la compu y le pega con A (y a él no le pasa nada, para no depender de la suerte).
  await p.page.evaluate(() => {
    window.__bot = setInterval(() => {
      const s = window.leogames.scene.getScene('Duelo');
      if (!s.sys.isActive() || s.fighters.length < 2) return;
      const [me, cpu] = s.fighters;
      me.invulnerableMs = 1000;
      const pad = window.__pads[0];
      const close = Math.abs(cpu.x - me.x) < me.radius * 2.2;
      pad.axes = [close ? 0 : Math.sign(cpu.x - me.x), 0, 0, 0];
      pad.buttons[0].pressed = close && !pad.buttons[0].pressed;
      pad.buttons[0].value = pad.buttons[0].pressed ? 1 : 0;
    }, 90);
  });
  await p.until(() => window.leogames.scene.getScene('Duelo').fighters[1].health < 100, ms(30000), 'pegarle a la compu');
  // Para ganar dos rounds rápido, a la compu le queda poquita vida y el bot le da el último golpe.
  for (const round of [1, 2]) {
    await p.until(() => window.leogames.scene.getScene('Duelo').phase === 'fight', ms(15000), `empezar el round ${round}`);
    await p.page.evaluate(() => (window.leogames.scene.getScene('Duelo').fighters[1].health = 1));
    await p.until(() => window.leogames.scene.getScene('Duelo').phase !== 'fight', ms(40000), `K.O. en el round ${round}`);
  }
  await p.until(() => window.leogames.scene.getScene('Duelo').phase === 'end', ms(15000), 'ganar el duelo');
  assert.equal(await p.page.evaluate(() => window.leogames.scene.getScene('Duelo').matchWinner.label), 'J1');
  assert.ok((await stickers(p.page)).includes('duelo-gana'));
  await stopBot(p.page);
  await p.page.evaluate(() => {
    window.__release();
    window.__pads[0].axes = [0, 0, 0, 0];
  });
  await p.until(() => window.leogames.scene.getScene('Duelo').phaseMs > 1300, ms(10000), 'que se pueda seguir');
  await p.tap(0, BUTTON.A);
  await p.until(() => window.leogames.scene.getScene('Duelo').phase === 'intro', ms(5000), 'siguiente pelea');
  // Mantener solo Y ya no saca del juego (antes sí): hacen falta LB + RB + Y.
  await p.tap(0, BUTTON.Y, 1800);
  assert.ok(await p.page.evaluate(() => window.leogames.scene.isActive('Duelo')), 'con Y sola no debe salir');
  await p.holdToMenu(0, EXIT, 'salir del duelo');
  assert.deepEqual(p.errors, []);
  await p.context.close();
});

// Movimientos nuevos: barrida agachado, arrancón con doble toque, agarre pegadito y el golpe final en súper forma.
test('duelo de bolitas: barrida, arrancón, agarre y golpe final', { timeout: ms(120000) }, async () => {
  const p = await openPage(game);
  await p.joinPlayers(1);
  await p.openGameCard('Duelo de bolitas');
  await p.pickCharacters(1);
  await p.until(() => window.leogames.scene.getScene('Duelo')?.phase === 'setup', ms(8000), 'ver la pantalla del duelo');
  await p.tap(0, BUTTON.A);
  await p.until(() => window.leogames.scene.getScene('Duelo').phase === 'fight', ms(10000), 'empezar a pelear');
  // La compu es el muñeco de práctica: no se mueve, no pega y no se cubre.
  const place = (gap) => p.page.evaluate((g) => {
    const s = window.leogames.scene.getScene('Duelo');
    const [me, cpu] = s.fighters;
    cpu.dummy = true;
    // Los dos desde cero (que la compu no venga a medio salto o rodando).
    cpu.reset(800, -1);
    me.reset(800 - (me.radius + cpu.radius) * 0.7 - g, 1);
  }, gap);
  const cpuHealth = () => p.page.evaluate(() => window.leogames.scene.getScene('Duelo').fighters[1].health);

  // ↓ + B: barrida que tumba.
  await place(10);
  await p.page.evaluate(() => (window.__pads[0].axes = [0, 1, 0, 0]));
  await p.tap(0, BUTTON.B);
  await p.until(() => window.leogames.scene.getScene('Duelo').fighters[1].launched || window.leogames.scene.getScene('Duelo').fighters[1].downMs > 0, ms(3000), 'la barrida tumba');
  await p.page.evaluate(() => (window.__pads[0].axes = [0, 0, 0, 0]));

  // Dos toques a la derecha: arrancón.
  await p.until(() => window.leogames.scene.getScene('Duelo').fighters[0].canAct(), ms(3000), 'poder moverse otra vez');
  await place(300);
  // Cada toque dura un cuadro del juego (en GitHub va lento: con tiempos fijos un toque se podía perder). Si los dos
  // no cayeron a tiempo, se intenta otra vez.
  for (let attempt = 0; attempt < 5; attempt += 1) {
    for (let i = 0; i < 2; i += 1) {
      await p.page.evaluate(() => (window.__pads[0].axes = [1, 0, 0, 0]));
      await p.frames(1);
      await p.page.evaluate(() => (window.__pads[0].axes = [0, 0, 0, 0]));
      await p.frames(1);
    }
    const dashed = await p.page.evaluate(() => {
      const me = window.leogames.scene.getScene('Duelo').fighters[0];
      return Boolean(me.dash) || me.x > 560;
    });
    if (dashed) break;
  }
  await p.until(() => window.leogames.scene.getScene('Duelo').fighters[0].dash || window.leogames.scene.getScene('Duelo').fighters[0].x > 560, ms(2000), 'hacer el arrancón');

  // Adelante + B pegadito: agarre (aunque la compu se esté cubriendo).
  await p.until(() => window.leogames.scene.getScene('Duelo').fighters[0].canAct(), ms(3000), 'terminar el arrancón');
  await place(0);
  await p.page.evaluate(() => (window.leogames.scene.getScene('Duelo').fighters[1].blocking = true));
  await p.page.evaluate(() => (window.__pads[0].axes = [1, 0, 0, 0]));
  await p.tap(0, BUTTON.B);
  await p.page.evaluate(() => (window.__pads[0].axes = [0, 0, 0, 0]));
  await p.until(() => window.leogames.scene.getScene('Duelo').fighters[1].health < 100, ms(3000), 'el agarre pega');

  // Barra llena, LB + RB (súper) y X: el golpe final.
  await p.until(() => window.leogames.scene.getScene('Duelo').fighters[0].canAct(), ms(3000), 'terminar el agarre');
  await place(200);
  await p.page.evaluate(() => (window.leogames.scene.getScene('Duelo').fighters[0].meter = 100));
  await p.page.evaluate(() => (window.__button(0, 4, true), window.__button(0, 5, true)));
  await p.until(() => window.leogames.scene.getScene('Duelo').fighters[0].superMs > 0, ms(3000), 'transformarse');
  await p.page.evaluate(() => (window.__button(0, 4, false), window.__button(0, 5, false)));
  await p.tap(0, BUTTON.X);
  await p.until(() => window.leogames.scene.getScene('Duelo').phase === 'final', ms(3000), 'empezar el golpe final');
  await p.until(() => window.leogames.scene.getScene('Duelo').phase !== 'final', ms(8000), 'terminar el golpe final');
  assert.ok((await cpuHealth()) <= 70, 'el golpe final quita mucha vida');
  assert.ok((await stickers(p.page)).includes('duelo-final'));
  await p.holdToMenu(0, EXIT, 'salir del duelo');
  assert.deepEqual(p.errors, []);
  await p.context.close();
});

// Modos: torneo (4 rivales y el jefe), supervivencia (sigue con su vida) y entrenamiento (retos palomeados).
test('duelo de bolitas: torneo con jefe, supervivencia y entrenamiento', { timeout: ms(180000) }, async () => {
  const p = await openPage(game);
  await p.joinPlayers(1);
  await p.openGameCard('Duelo de bolitas');
  await p.pickCharacters(1);
  await p.until(() => window.leogames.scene.getScene('Duelo')?.phase === 'setup', ms(8000), 'ver la pantalla del duelo');
  // El primer renglón es el modo: ▶ = Torneo.
  await p.tap(0, BUTTON.RIGHT);
  assert.equal(await p.page.evaluate(() => window.leogames.scene.getScene('Duelo').setup.mode), 'torneo');
  await p.tap(0, BUTTON.A);
  const win = () =>
    p.page.evaluate(() => {
      const s = window.leogames.scene.getScene('Duelo');
      s.fighters[0].roundWins = s.roundsToWin - 1;
      s.fighters[1].health = 0;
      s.endRound(s.fighters[0], 'ko');
    });
  for (let fight = 1; fight <= 5; fight += 1) {
    await p.until(() => window.leogames.scene.getScene('Duelo').phase === 'end' && window.leogames.scene.getScene('Duelo').phaseMs > 1300, ms(15000), `ver la escalera (pelea ${fight})`);
    await p.tap(0, BUTTON.A);
    await p.until(() => window.leogames.scene.getScene('Duelo').phase === 'fight', ms(15000), `empezar la pelea ${fight}`);
    if (fight === 5) assert.equal(await p.page.evaluate(() => window.leogames.scene.getScene('Duelo').fighters[1].name), 'Rey Bolón');
    await win();
    await p.until(() => window.leogames.scene.getScene('Duelo').phase === 'end', ms(15000), `ganar la pelea ${fight}`);
    if (fight < 5) {
      await p.until(() => window.leogames.scene.getScene('Duelo').phaseMs > 1300, ms(10000), 'poder seguir');
      await p.tap(0, BUTTON.A);
    }
  }
  assert.ok((await stickers(p.page)).includes('duelo-torneo'));

  // Supervivencia: después de ganar sigue con la vida que le quedó (más un poquito).
  await p.page.evaluate(() => {
    const s = window.leogames.scene.getScene('Duelo');
    s.backToSetup();
    s.setup.mode = 'supervivencia';
  });
  await p.tap(0, BUTTON.A);
  await p.until(() => window.leogames.scene.getScene('Duelo').phase === 'fight', ms(15000), 'empezar supervivencia');
  await p.page.evaluate(() => (window.leogames.scene.getScene('Duelo').fighters[0].health = 40));
  await win();
  await p.until(() => window.leogames.scene.getScene('Duelo').phase === 'end' && window.leogames.scene.getScene('Duelo').phaseMs > 1300, ms(15000), 'ganar en supervivencia');
  await p.tap(0, BUTTON.A);
  await p.until(() => window.leogames.scene.getScene('Duelo').phase === 'fight', ms(15000), 'siguiente rival');
  assert.equal(await p.page.evaluate(() => window.leogames.scene.getScene('Duelo').fighters[0].health), 70);

  // Entrenamiento: el muñeco no pega, no hay reloj y cada golpe nuevo se palomea.
  await p.page.evaluate(() => {
    const s = window.leogames.scene.getScene('Duelo');
    s.backToSetup();
    s.setup.mode = 'entrenamiento';
  });
  await p.tap(0, BUTTON.A);
  await p.until(() => window.leogames.scene.getScene('Duelo').phase === 'fight', ms(15000), 'empezar entrenamiento');
  await p.tap(0, BUTTON.B);
  await p.until(() => window.leogames.scene.getScene('Duelo').drills.done.has('kick'), ms(3000), 'palomear la patada');
  assert.equal(await p.page.evaluate(() => window.leogames.scene.getScene('Duelo').timerText.text), '∞');
  await p.holdToMenu(0, EXIT, 'salir del duelo');
  assert.deepEqual(p.errors, []);
  await p.context.close();
});

// 2 contra 2: con 2 jugadores, cada uno con la compu de compañero; el round se acaba hasta que cae todo un equipo.
test('duelo de bolitas: 2 contra 2 a la vez', { timeout: ms(120000) }, async () => {
  const p = await openPage(game);
  await p.joinPlayers(2);
  await p.openGameCard('Duelo de bolitas');
  await p.pickCharacters(2);
  await p.until(() => window.leogames.scene.getScene('Duelo')?.phase === 'setup', ms(8000), 'ver la pantalla del duelo');
  // ◀ en el modo: 2 contra 2 (es el último).
  await p.tap(0, BUTTON.LEFT);
  assert.equal(await p.page.evaluate(() => window.leogames.scene.getScene('Duelo').setup.mode), 'equipos');
  await p.tap(0, BUTTON.A);
  await p.until(() => window.leogames.scene.getScene('Duelo').phase === 'fight', ms(15000), 'empezar a pelear');
  const teams = await p.page.evaluate(() => window.leogames.scene.getScene('Duelo').fighters.map((f) => `${f.label}:${f.team}`));
  assert.deepEqual(teams, ['J1:0', 'CPU:0', 'J2:1', 'CPU:1']);
  const knockOut = (i) =>
    p.page.evaluate((k) => {
      const s = window.leogames.scene.getScene('Duelo');
      const victim = s.fighters[k];
      Object.assign(victim, { health: 1, invulnerableMs: 0, downMs: 0, launched: false, blocking: false });
      victim.takeHit({ damage: 50, power: 1, push: 300, launch: true }, victim.x - 10);
      s.checkKo(s.fighters[0], victim);
    }, i);
  // Con uno de los azules fuera, la pelea sigue.
  await knockOut(2);
  assert.equal(await p.page.evaluate(() => window.leogames.scene.getScene('Duelo').phase), 'fight');
  await p.page.evaluate(() => window.leogames.scene.getScene('Duelo').fighters.forEach((f) => (f.roundWins = f.team === 0 ? 1 : 0)));
  await p.page.evaluate(() => (window.leogames.scene.getScene('Duelo').roundsToWin = 2));
  await knockOut(3);
  await p.until(() => window.leogames.scene.getScene('Duelo').phase === 'end', ms(15000), 'ganan los rojos');
  assert.equal(await p.page.evaluate(() => window.leogames.scene.getScene('Duelo').matchWinner.team), 0);
  await p.holdToMenu(0, EXIT, 'salir del duelo');
  assert.deepEqual(p.errors, []);
  await p.context.close();
});

// Parada perfecta (cubrirse justo a tiempo), movimiento secreto (↓ + X), ayudante (Y) y un objeto (corazón).
test('duelo de bolitas: parada perfecta, secretos, ayudante y objetos', { timeout: ms(120000) }, async () => {
  const p = await openPage(game);
  await p.joinPlayers(1);
  await p.openGameCard('Duelo de bolitas');
  await p.pickCharacters(1);
  await p.until(() => window.leogames.scene.getScene('Duelo')?.phase === 'setup', ms(8000), 'ver la pantalla del duelo');
  await p.tap(0, BUTTON.A);
  await p.until(() => window.leogames.scene.getScene('Duelo').phase === 'fight', ms(10000), 'empezar a pelear');
  // La compu es el muñeco; el jugador se cubre y en ese momento el muñeco le pega.
  await p.page.evaluate(() => {
    const s = window.leogames.scene.getScene('Duelo');
    const [me, cpu] = s.fighters;
    cpu.dummy = true;
    cpu.reset(800, -1);
    me.reset(800 - (me.radius + cpu.radius) * 0.7 - 10, 1);
    // (En GitHub los cuadros van lentos: se da más tiempo para la parada.)
    me.parryWindow = 3000;
  });
  await p.page.evaluate(() => window.__button(0, 4, true));
  await p.until(() => window.leogames.scene.getScene('Duelo').fighters[0].blocking, ms(3000), 'cubrirse');
  await p.page.evaluate(() => window.leogames.scene.getScene('Duelo').fighters[1].startAttack('punch'));
  await p.until(() => window.leogames.scene.getScene('Duelo').fighters[1].hurtMs > 0, ms(3000), 'que la parada marée al muñeco');
  await p.page.evaluate(() => window.__button(0, 4, false));
  assert.ok((await stickers(p.page)).includes('duelo-parada'), 'falta la calcomanía de la parada');

  // ↓ + X: el secreto de agachado.
  await p.until(() => window.leogames.scene.getScene('Duelo').fighters[0].canAct(), ms(3000), 'poder moverse');
  await p.page.evaluate(() => {
    window.leogames.scene.getScene('Duelo').fighters[0].cooldownMs = 0;
    window.__pads[0].axes = [0, 1, 0, 0];
  });
  await p.tap(0, BUTTON.X);
  await p.until(() => {
    const me = window.leogames.scene.getScene('Duelo').fighters[0];
    return me.special?.name === me.secrets.low.name || me.cooldownMs > 0;
  }, ms(3000), 'hacer el movimiento secreto');
  await p.page.evaluate(() => (window.__pads[0].axes = [0, 0, 0, 0]));

  // Y: el ayudante entra corriendo.
  await p.tap(0, BUTTON.Y);
  await p.until(() => window.leogames.scene.getScene('Duelo').shots.some((shot) => shot.solid), ms(3000), 'llamar al ayudante');
  assert.ok(await p.page.evaluate(() => window.leogames.scene.getScene('Duelo').fighters[0].assistUsed));

  // Un corazón que cae junto al jugador lo cura.
  await p.page.evaluate(() => {
    const s = window.leogames.scene.getScene('Duelo');
    const me = s.fighters[0];
    me.health = 50;
    s.items.spawn('heart');
    s.items.list.at(-1).x = me.x;
  });
  await p.until(() => window.leogames.scene.getScene('Duelo').fighters[0].health > 50, ms(5000), 'agarrar el corazón');
  await p.holdToMenu(0, EXIT, 'salir del duelo');
  assert.deepEqual(p.errors, []);
  await p.context.close();
});

// Los modos nuevos: escuela, retos, torneo familiar, jefes secretos y el salón de la fama.
test('duelo de bolitas: escuela, retos, torneo familiar, jefes y salón de la fama', { timeout: ms(240000) }, async () => {
  const p = await openPage(game);
  await p.joinPlayers(1);
  await p.openGameCard('Duelo de bolitas');
  await p.pickCharacters(1);
  await p.until(() => window.leogames.scene.getScene('Duelo')?.phase === 'setup', ms(8000), 'ver la pantalla del duelo');
  const pickMode = async (mode) => {
    await p.until(() => window.leogames.scene.getScene('Duelo').phase === 'setup', ms(10000), 'regresar a escoger');
    await p.page.evaluate((m) => {
      const s = window.leogames.scene.getScene('Duelo');
      s.setup.mode = m;
      s.setup.cupSize = 4;
      s.refreshSetup();
    }, mode);
    await p.tap(0, BUTTON.A);
  };
  const win = () =>
    p.page.evaluate(() => {
      const s = window.leogames.scene.getScene('Duelo');
      const me = s.fighters.find((f) => !f.isCpu);
      const rival = s.fighters.find((f) => f !== me);
      me.roundWins = s.roundsToWin - 1;
      rival.health = 0;
      s.endRound(me, 'ko');
    });
  const toSetup = () => p.page.evaluate(() => window.leogames.scene.getScene('Duelo').backToSetup());

  // Escuela: la primera lección se cumple caminando; luego se brinca hasta la última.
  await pickMode('escuela');
  await p.until(() => window.leogames.scene.getScene('Duelo').phase === 'fight', ms(15000), 'empezar la escuela');
  await p.page.evaluate(() => (window.__pads[0].axes = [1, 0, 0, 0]));
  await p.until(() => window.leogames.scene.getScene('Duelo').school.index >= 1, ms(8000), 'cumplir la lección de caminar');
  await p.page.evaluate(() => (window.__pads[0].axes = [0, 0, 0, 0]));
  await p.page.evaluate(async () => {
    const { LESSONS } = await import('/src/games/duelo/school.js');
    const school = window.leogames.scene.getScene('Duelo').school;
    school.index = LESSONS.length - 1;
    school.doneMs = 0;
    school.show();
    school.mark('final');
  });
  await p.until(() => window.leogames.scene.getScene('Duelo').phase === 'end', ms(8000), 'terminar la escuela');
  assert.ok((await stickers(p.page)).includes('duelo-escuela'));
  await toSetup();

  // Retos: el primero (ganar sin cubrirse).
  await pickMode('retos');
  await p.until(() => window.leogames.scene.getScene('Duelo').phase === 'menu', ms(5000), 'ver los retos');
  await p.wait(400);
  await p.tap(0, BUTTON.A);
  await p.until(() => window.leogames.scene.getScene('Duelo').phase === 'fight', ms(15000), 'empezar el reto');
  await win();
  await p.until(() => window.leogames.scene.getScene('Duelo').challengeResolved, ms(15000), 'cumplir el reto');
  assert.ok((await stickers(p.page)).includes('duelo-reto'));
  await toSetup();

  // Torneo familiar de 4: semifinal y final.
  await pickMode('familiar');
  for (let fight = 1; fight <= 2; fight += 1) {
    await p.until(() => window.leogames.scene.getScene('Duelo').phase === 'end' && window.leogames.scene.getScene('Duelo').phaseMs > 1300, ms(15000), `ver las llaves (${fight})`);
    await p.tap(0, BUTTON.A);
    await p.until(() => window.leogames.scene.getScene('Duelo').phase === 'fight', ms(15000), `empezar la pelea ${fight} de las llaves`);
    await win();
    await p.until(() => window.leogames.scene.getScene('Duelo').phase === 'end', ms(15000), `ganar la pelea ${fight}`);
    await p.until(() => window.leogames.scene.getScene('Duelo').phaseMs > 1300, ms(10000), 'poder seguir');
    await p.tap(0, BUTTON.A);
  }
  await p.until(() => window.leogames.scene.getScene('Duelo').cup.done, ms(10000), 'terminar el torneo familiar');
  assert.ok((await stickers(p.page)).includes('duelo-familiar'));
  await toSetup();

  // Jefes secretos: Dragonzote, Robotote y el Rey Bolón.
  await pickMode('jefes');
  for (const [fight, name] of [[1, 'Dragonzote'], [2, 'Robotote'], [3, 'Rey Bolón']]) {
    await p.until(() => window.leogames.scene.getScene('Duelo').phase === 'end' && window.leogames.scene.getScene('Duelo').phaseMs > 1300, ms(15000), `ver la escalera de jefes (${fight})`);
    await p.tap(0, BUTTON.A);
    await p.until(() => window.leogames.scene.getScene('Duelo').phase === 'fight', ms(15000), `pelear con ${name}`);
    assert.equal(await p.page.evaluate(() => window.leogames.scene.getScene('Duelo').fighters[1].name), name);
    await win();
    await p.until(() => window.leogames.scene.getScene('Duelo').phase === 'end', ms(15000), `vencer a ${name}`);
    if (fight < 3) {
      await p.until(() => window.leogames.scene.getScene('Duelo').phaseMs > 1300, ms(10000), 'poder seguir');
      await p.tap(0, BUTTON.A);
    }
  }
  assert.ok((await stickers(p.page)).includes('duelo-jefes'));
  await toSetup();

  // Salón de la fama: ya trae victorias.
  await pickMode('fama');
  await p.until(() => window.leogames.scene.getScene('Duelo').phase === 'menu', ms(5000), 'ver el salón de la fama');
  const fights = await p.page.evaluate(() => import('/src/games/duelo/records.js').then((m) => m.loadFame().fights));
  assert.ok(fights > 0, 'el salón de la fama no contó las peleas');
  await p.wait(400);
  await p.tap(0, BUTTON.B);
  await p.until(() => window.leogames.scene.getScene('Duelo').phase === 'setup', ms(5000), 'regresar del salón de la fama');
  await p.holdToMenu(0, EXIT, 'salir del duelo');
  assert.deepEqual(p.errors, []);
  await p.context.close();
});

test('duelo de bolitas: con 3 jugadores se turnan y el que gana se queda', { timeout: ms(90000) }, async () => {
  const p = await openPage(game);
  await p.joinPlayers(3);
  await p.openGameCard('Duelo de bolitas');
  await p.pickCharacters(3);
  await p.until(() => window.leogames.scene.getScene('Duelo')?.phase === 'setup', ms(8000), 'ver la pantalla del duelo');
  assert.match(await p.page.evaluate(() => window.leogames.scene.getScene('Duelo').matchText.text), /J1 · .* vs {3}J2 · .*\n\nDespués: J3/);
  await p.tap(0, BUTTON.A);
  await p.until(() => window.leogames.scene.getScene('Duelo').phase === 'fight', ms(10000), 'empezar a pelear');
  // J1 gana el último round que le falta.
  await p.page.evaluate(() => {
    const s = window.leogames.scene.getScene('Duelo');
    s.fighters[0].roundWins = s.setup.rounds - 1;
    s.fighters[1].health = 0;
    s.endRound(s.fighters[0], 'ko');
  });
  await p.until(() => window.leogames.scene.getScene('Duelo').phase === 'end', ms(10000), 'terminar el duelo');
  await p.until(() => window.leogames.scene.getScene('Duelo').phaseMs > 1300, ms(10000), 'que se pueda seguir');
  await p.tap(0, BUTTON.A);
  await p.until(() => window.leogames.scene.getScene('Duelo').phase === 'intro', ms(5000), 'siguiente pelea');
  const next = await p.page.evaluate(() => {
    const s = window.leogames.scene.getScene('Duelo');
    return { fighters: s.fighters.map((f) => f.label), waiting: s.waiting().map((e) => s.labelOf(e.player)) };
  });
  assert.deepEqual(next, { fighters: ['J1', 'J3'], waiting: ['J2'] });
  await p.holdToMenu(0, EXIT, 'salir del duelo');
  assert.deepEqual(p.errors, []);
  await p.context.close();
});

test('carreras desde arriba: el carro avanza por la pista', { timeout: ms(90000) }, async () => {
  const p = await openPage(game);
  await p.joinPlayers(1);
  await p.openGameCard('Carreras');
  await p.page.waitForFunction(() => Boolean(window.leogames.scene.getScene('Race')?.game3d), null, { timeout: ms(30000) });
  await p.page.evaluate(() => {
    window.__bot = setInterval(() => {
      const race = window.leogames.scene.getScene('Race').game3d;
      const k = race.humans[0];
      const t = race.track.pointAt(k.index + 12, 0);
      const d = Math.hypot(t.x - k.x, t.z - k.z) || 1;
      window.__pads[0].axes = [(t.x - k.x) / d, (t.z - k.z) / d, 0, 0];
    }, 50);
  });
  await p.until(() => window.leogames.scene.getScene('Race').game3d.humans[0].progress > 0.15, ms(60000), 'avanzar en la pista');
  await stopBot(p.page);
  assert.deepEqual(p.errors, []);
  await p.context.close();
});

test('celular: con la pantalla táctil se une y se mueve por el menú', { timeout: ms(60000) }, async () => {
  const p = await openPage(game, { touch: true });
  const cdp = await p.context.newCDPSession(p.page);
  const touch = (type, points) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points.map(([x, y], id) => ({ x, y, id })) });
  const center = (label) =>
    p.page.evaluate((text) => {
      const box = [...document.querySelectorAll('.touch-button')].find((n) => n.textContent === text).getBoundingClientRect();
      return [box.left + box.width / 2, box.top + box.height / 2];
    }, label);
  const a = await center('A');
  await touch('touchStart', [a]);
  await p.frames();
  await touch('touchEnd', []);
  await p.frames();
  await touch('touchStart', [a]);
  await p.until(() => window.leogames.scene.isActive('Menu'), ms(8000), 'llegar al menú tocando A');
  await touch('touchEnd', []);
  await p.frames();
  const before = await p.page.evaluate(() => window.leogames.scene.getScene('Menu').selected);
  await touch('touchStart', [[140, 250]]);
  await touch('touchMove', [[210, 250]]);
  await p.frames(3);
  await touch('touchEnd', []);
  await p.frames();
  assert.notEqual(await p.page.evaluate(() => window.leogames.scene.getScene('Menu').selected), before, 'el stick no movió el menú');
  assert.deepEqual(p.errors, []);
  await p.context.close();
});

// Súper Bolitas: un nivel jugado "a mano" (con la escena) para revisar cada cosa.
const plat = (page, fn, arg) => page.evaluate(fn, arg);
async function openPlat(p, count, progress) {
  await p.page.evaluate((data) => import('/src/shared/settings.js').then((m) => m.settings.set('platProgress2', data)), progress);
  await p.joinPlayers(count);
  await p.openGameCard('Súper Bolitas');
  await p.pickCharacters(count);
  await p.until(() => window.leogames.scene.getScene('Plat')?.phase === 'map', ms(10000), 'ver el mapa de Súper Bolitas');
}

test('súper bolitas: correr, saltar, bloques, hongo, pisar enemigos, burbuja, modo peque y bandera', { timeout: ms(120000) }, async () => {
  const p = await openPage(game);
  await openPlat(p, 2, { unlocked: 0, levels: {}, peque: {} });
  // Y del Jugador 2: él juega en modo peque.
  await p.tap(1, BUTTON.Y);
  assert.equal(await plat(p.page, () => window.leogames.scene.getScene('Plat').players[1].peque), true);
  await p.tap(0, BUTTON.A);
  await p.until(() => window.leogames.scene.getScene('Plat').phase === 'play', ms(5000), 'empezar el 1-1');
  await p.wait(400);

  // Correr a la derecha y saltar.
  const x0 = await plat(p.page, () => window.leogames.scene.getScene('Plat').players[0].x);
  await p.page.evaluate(() => (window.__pads[0].axes = [1, 0, 0, 0]));
  await p.wait(500);
  await p.page.evaluate(() => (window.__pads[0].axes = [0, 0, 0, 0]));
  assert.ok((await plat(p.page, () => window.leogames.scene.getScene('Plat').players[0].x)) > x0 + 60, 'no corrió');
  await p.tap(0, BUTTON.A);
  await p.until(() => window.leogames.scene.getScene('Plat').players[0].vy < 0 || !window.leogames.scene.getScene('Plat').players[0].onGround, ms(2000), 'saltar');

  // Le pega desde abajo al bloque del hongo: sale el hongo y al agarrarlo crece.
  await plat(p.page, () => {
    const s = window.leogames.scene.getScene('Plat');
    for (const e of s.enemies) e.remove();
    const level = s.level;
    let at = null;
    level.grid.forEach((row, r) => row.forEach((ch, c) => (ch === 'M' && !at ? (at = { c, r }) : null)));
    window.__block = at;
    const pl = s.players[0];
    Object.assign(pl, { x: at.c * 48 + 24, y: (at.r + 1) * 48 + 60, vx: 0, vy: -700, onGround: false, invulnMs: 1e9 });
  });
  await p.until(() => window.leogames.scene.getScene('Plat').items.powers.length > 0, ms(3000), 'que salga el hongo');
  assert.equal(await plat(p.page, () => window.leogames.scene.getScene('Plat').level.at(window.__block.c, window.__block.r)), 'U');
  await p.until(() => window.leogames.scene.getScene('Plat').items.powers[0]?.emerge >= 1, ms(3000), 'que el hongo termine de salir');
  await plat(p.page, () => {
    const s = window.leogames.scene.getScene('Plat');
    const pw = s.items.powers[0];
    Object.assign(s.players[0], { x: pw.x, y: pw.y, vy: 0 });
  });
  await p.until(() => window.leogames.scene.getScene('Plat').players[0].size === 'big', ms(3000), 'crecer con el hongo');

  // Brincarle encima a un hongo malo (en el piso) lo aplasta. (Si en un cuadro lento no le atina, vuelve a caerle.)
  await plat(p.page, () => {
    const s = window.leogames.scene.getScene('Plat');
    const x = s.level.start.x + 300;
    window.__goomba = s.spawnEnemy('g', x, s.groundY(x));
    window.__dropper = setInterval(() => {
      const e = window.__goomba;
      const pl = s.players[0];
      if (e.dead || pl.stats.stomps > 0) return clearInterval(window.__dropper);
      if (pl.onGround) Object.assign(pl, { x: e.x, y: e.y - e.h - 30, vx: 0, vy: 500, onGround: false });
    }, 120);
  });
  await p.until(() => window.leogames.scene.getScene('Plat').players[0].stats.stomps === 1, ms(5000), 'aplastar al hongo malo');
  await plat(p.page, () => clearInterval(window.__dropper));

  // Si el Jugador 1 cae (y el 2 sigue), regresa en burbuja; el 2 la revienta tocándola.
  await plat(p.page, () => {
    const s = window.leogames.scene.getScene('Plat');
    s.players[0].invulnMs = 0;
    s.players[0].die();
  });
  await p.until(() => window.leogames.scene.getScene('Plat').players[0].state === 'bubble', ms(4000), 'regresar en burbuja');
  await plat(p.page, () => {
    const s = window.leogames.scene.getScene('Plat');
    const [a, b] = s.players;
    Object.assign(b, { x: a.x, y: a.y + 30, vy: 0 });
  });
  await p.until(() => window.leogames.scene.getScene('Plat').players[0].state === 'play', ms(3000), 'reventar la burbuja');
  assert.equal(await plat(p.page, () => window.leogames.scene.getScene('Plat').lives), 10, 'no debió perder vida (con modo peque son 10)');

  // El 2 (modo peque) se cae a un hoyo: regresa rebotando a donde estaba.
  await plat(p.page, () => {
    const s = window.leogames.scene.getScene('Plat');
    Object.assign(s.players[1], { y: s.level.height + 120, vy: 0 });
  });
  await p.until(() => {
    const s = window.leogames.scene.getScene('Plat');
    return s.players[1].state === 'play' && s.players[1].y < s.level.height;
  }, ms(3000), 'que el modo peque lo regrese del hoyo');

  // A la bandera: nivel superado, se abre el 1-2 y la calcomanía.
  await plat(p.page, () => {
    const s = window.leogames.scene.getScene('Plat');
    for (const pl of s.players) Object.assign(pl, { x: s.goal.x - 60, y: s.goal.y - 4, vy: 0 });
    s.cameras.main.setScroll(s.goal.x - 900, 0);
    s.players[0].x = s.goal.x + 2;
  });
  await p.until(() => window.leogames.scene.getScene('Plat').phase === 'results', ms(8000), 'pasar el nivel');
  assert.equal(await plat(p.page, () => JSON.parse(localStorage.getItem('leogames:platProgress2')).unlocked), 1);
  assert.ok((await stickers(p.page)).includes('plat-bandera'));
  await p.until(() => window.leogames.scene.getScene('Plat').endMs > 1000, ms(5000), 'que los resultados acepten botones');
  await p.tap(0, BUTTON.A);
  await p.until(() => window.leogames.scene.getScene('Plat').info.id === '1-2' && window.leogames.scene.getScene('Plat').phase === 'play', ms(5000), 'pasar al fuerte');
  await p.holdToMenu(0, EXIT, 'salir de Súper Bolitas');
  assert.deepEqual(p.errors, []);
  await p.context.close();
});

test('súper bolitas: tubo secreto, dinosaurio, fuego, estrella y el Rey Hongo', { timeout: ms(120000) }, async () => {
  const p = await openPage(game);
  await openPlat(p, 1, { unlocked: 2, levels: {}, peque: {} });
  // El mapa empieza en el último abierto (el 1-3): tres a la izquierda (fuerte y casita) es el 1-1.
  assert.equal(await plat(p.page, () => window.leogames.scene.getScene('Plat').mapState.node), 3);
  await p.tap(0, BUTTON.LEFT);
  await p.tap(0, BUTTON.LEFT);
  await p.tap(0, BUTTON.LEFT);
  await p.tap(0, BUTTON.A);
  await p.until(() => window.leogames.scene.getScene('Plat').phase === 'play' && window.leogames.scene.getScene('Plat').info.id === '1-1', ms(5000), 'empezar el 1-1');

  // Parado en el tubo secreto, abajo: al cuarto secreto.
  await plat(p.page, () => {
    const s = window.leogames.scene.getScene('Plat');
    for (const e of s.enemies) e.remove();
    const w = s.level.warps[0];
    const pl = s.players[0];
    Object.assign(pl, { x: w.enter.col * 48 + 48, y: w.enter.row * 48 - 2, vy: 0, invulnMs: 1e9 });
    s.cameras.main.setScroll(pl.x - 600, 0);
    window.__pads[0].axes = [0, 1, 0, 0];
  });
  await p.until(() => {
    const s = window.leogames.scene.getScene('Plat');
    return s.level.inBonus(s.players[0].x);
  }, ms(4000), 'entrar al cuarto secreto');
  await p.page.evaluate(() => (window.__pads[0].axes = [0, 0, 0, 0]));
  assert.ok((await stickers(p.page)).includes('plat-secreto'));

  // El dinosaurio: tocarlo para subirse; X = lengüetazo que se come al enemigo de enfrente.
  await p.until(() => window.leogames.scene.getScene('Plat').players[0].onGround, ms(3000), 'caer al piso del cuarto secreto');
  await plat(p.page, async () => {
    const { Dino } = await import('/src/games/plat/dino.js');
    const s = window.leogames.scene.getScene('Plat');
    const pl = s.players[0];
    s.dinos.push(new Dino(s, pl.x, pl.y));
  });
  await p.until(() => Boolean(window.leogames.scene.getScene('Plat').players[0].dino), ms(3000), 'subirse al dinosaurio');
  assert.ok((await stickers(p.page)).includes('plat-dino'));
  await plat(p.page, () => {
    const s = window.leogames.scene.getScene('Plat');
    const pl = s.players[0];
    pl.facing = 1;
    window.__lunch = s.spawnEnemy('g', pl.x + 90, pl.y);
    window.__lunch.vx = 0;
  });
  await p.tap(0, BUTTON.X);
  await p.until(() => window.__lunch.dead, ms(2000), 'comerse al hongo malo');

  // Flor: X lanza bolas de fuego que tumban enemigos. Estrella: invencible.
  await plat(p.page, () => {
    const s = window.leogames.scene.getScene('Plat');
    const pl = s.players[0];
    s.dinoRunsAway(pl, { silent: true });
    s.powerTaken(pl, 'flor');
    pl.facing = 1;
    window.__target = s.spawnEnemy('g', pl.x + 220, pl.y);
    window.__target.vx = 0;
  });
  await p.wait(300);
  await p.tap(0, BUTTON.X);
  await p.until(() => window.__target.dead, ms(3000), 'tumbar al hongo malo con fuego');
  await plat(p.page, () => window.leogames.scene.getScene('Plat').powerTaken(window.leogames.scene.getScene('Plat').players[0], 'estrella'));
  assert.ok((await stickers(p.page)).includes('plat-estrella'));

  // El 1-4: al entrar a la arena se cierra la puerta y sale el Rey Hongo; tres brincos encima y ganan el mundo.
  await plat(p.page, () => {
    const s = window.leogames.scene.getScene('Plat');
    s.startLevel(3);
    const a = s.level.arena;
    const pl = s.players[0];
    Object.assign(pl, { x: (a.left + 4) * 48, y: (a.boss.row + 1) * 48, vy: 0, invulnMs: 1e9 });
    s.cameras.main.setScroll(a.left * 48, 0);
  });
  await p.until(() => Boolean(window.leogames.scene.getScene('Plat').boss), ms(4000), 'que llegue el Rey Hongo');
  assert.equal(await plat(p.page, () => {
    const s = window.leogames.scene.getScene('Plat');
    return s.level.at(s.level.arena.left, s.level.arena.door[0]);
  }), 'X', 'la puerta no se cerró');
  // Cada que se puede pisar, el jugador le cae encima (como si brincara).
  await plat(p.page, () => {
    window.__stomper = setInterval(() => {
      const s = window.leogames.scene.getScene('Plat');
      const b = s.boss;
      if (!b || b.dead || !b.stompable) return;
      Object.assign(s.players[0], { x: b.x, y: b.y - b.h - 10, vy: 600, onGround: false, invulnMs: 1e9 });
    }, 150);
  });
  await p.until(() => window.leogames.scene.getScene('Plat').boss?.dead, ms(20000), 'brincarle encima 3 veces al Rey Hongo');
  await plat(p.page, () => clearInterval(window.__stomper));
  await p.until(() => window.leogames.scene.getScene('Plat').phase === 'results', ms(10000), 'ganar el mundo');
  assert.ok((await stickers(p.page)).includes('plat-mundo-1'));
  await p.holdToMenu(0, EXIT, 'salir de Súper Bolitas');
  assert.deepEqual(p.errors, []);
  await p.context.close();
});

const platLevel = (page, id) => page.evaluate((x) => import('/src/games/plat/levels.js').then((m) => m.LEVELS.findIndex((l) => l.id === x)), id);
async function startPlatLevel(p, id) {
  const index = await platLevel(p.page, id);
  await plat(p.page, (i) => window.leogames.scene.getScene('Plat').startLevel(i), index);
  await p.until(() => window.leogames.scene.getScene('Plat').phase === 'play', ms(5000), `empezar el ${id}`);
  await plat(p.page, () => {
    const s = window.leogames.scene.getScene('Plat');
    for (const e of s.enemies) e.remove();
    for (const pl of s.players) pl.invulnMs = 1e9;
  });
}

test('súper bolitas: capa, hielo, gigante, mini, dinosaurios de colores, botón P, bloques de colores, cañón, puertas y bandera secreta', { timeout: ms(150000) }, async () => {
  const p = await openPage(game);
  await openPlat(p, 1, { unlocked: 27, levels: {}, peque: {} });
  await startPlatLevel(p, '1-1');

  // Pluma: capa. X = giro que tumba al de junto; con A sostenido, cae despacito (planea).
  await plat(p.page, () => {
    const s = window.leogames.scene.getScene('Plat');
    const pl = s.players[0];
    s.powerTaken(pl, 'pluma');
    pl.facing = 1;
    window.__e = s.spawnEnemy('g', pl.x + 60, pl.y);
  });
  assert.equal(await plat(p.page, () => window.leogames.scene.getScene('Plat').players[0].power), 'cape');
  await p.tap(0, BUTTON.X);
  await p.until(() => window.__e.dead, ms(3000), 'tumbar con el giro de la capa');
  assert.ok((await stickers(p.page)).includes('plat-capa'));
  await plat(p.page, () => Object.assign(window.leogames.scene.getScene('Plat').players[0], { y: 120, vy: 400, onGround: false, coyoteMs: 0 }));
  await p.holdUntil(0, [BUTTON.A], () => {
    const pl = window.leogames.scene.getScene('Plat').players[0];
    return !pl.onGround && pl.vy > 0 && pl.vy <= 110;
  }, 'planear con la capa', ms(3000));

  // Flor de hielo: X congela; el bloque de hielo se pisa y de lado se patea.
  await p.until(() => window.leogames.scene.getScene('Plat').players[0].onGround, ms(8000), 'bajar al piso');
  await plat(p.page, () => {
    const s = window.leogames.scene.getScene('Plat');
    const pl = s.players[0];
    s.powerTaken(pl, 'flor-hielo');
    pl.facing = 1;
    window.__e = s.spawnEnemy('g', pl.x + 220, pl.y);
  });
  await p.tap(0, BUTTON.X);
  await p.until(() => window.__e.frozen, ms(3000), 'congelar al hongo malo');
  assert.ok((await stickers(p.page)).includes('plat-hielo'));
  await plat(p.page, () => Object.assign(window.leogames.scene.getScene('Plat').players[0], { x: window.__e.x, y: window.__e.y - window.__e.h - 40, vy: 0 }));
  await p.until(() => window.leogames.scene.getScene('Plat').players[0].onIce, ms(3000), 'pararse en el bloque de hielo');
  await plat(p.page, () => Object.assign(window.leogames.scene.getScene('Plat').players[0], { x: window.__e.x - 24, y: window.__e.y, vy: 0 }));
  await p.until(() => window.__e.iceState === 'slide' || window.__e.dead, ms(3000), 'patear el bloque de hielo');

  // Hongo gigante: enorme un rato y rompe los bloques que toca. Hongo mini: chiquito.
  await plat(p.page, () => {
    const s = window.leogames.scene.getScene('Plat');
    const pl = s.players[0];
    s.powerTaken(pl, 'hongo-gigante');
    let at = null;
    s.level.grid.forEach((row, r) => row.forEach((ch, c) => (ch === 'B' && !at ? (at = { c, r }) : null)));
    window.__brick = at;
    Object.assign(pl, { x: at.c * 48 + 24, y: (at.r + 2) * 48, vy: 0 });
    s.cameras.main.setScroll(at.c * 48 - 600, 0);
  });
  await p.until(() => window.leogames.scene.getScene('Plat').level.at(window.__brick.c, window.__brick.r) === ' ', ms(3000), 'romper un ladrillo de gigante');
  assert.ok((await stickers(p.page)).includes('plat-gigante'));
  await plat(p.page, () => {
    const s = window.leogames.scene.getScene('Plat');
    s.players[0].giantMs = 1;
    s.powerTaken(s.players[0], 'hongo-mini');
  });
  await p.until(() => window.leogames.scene.getScene('Plat').players[0].size === 'mini', ms(2000), 'hacerse mini');

  // Dinosaurio rojo: X escupe fuego. Amarillo: al caer de un salto tumba a los de junto. (Al principio del nivel,
  // donde no hay nada arriba.)
  await plat(p.page, async () => {
    const { Dino } = await import('/src/games/plat/dino.js');
    const s = window.leogames.scene.getScene('Plat');
    const pl = s.players[0];
    Object.assign(pl, { x: s.level.start.x, y: s.level.start.y, vy: 0 });
    s.cameras.main.setScroll(0, 0);
    s.dinos.push(new Dino(s, pl.x, pl.y, 'rojo'));
  });
  await p.until(() => window.leogames.scene.getScene('Plat').players[0].dino?.color === 'rojo', ms(3000), 'subirse al dinosaurio rojo');
  await p.until(() => window.leogames.scene.getScene('Plat').players[0].onGround, ms(3000), 'pararse con el dinosaurio');
  await plat(p.page, () => {
    const s = window.leogames.scene.getScene('Plat');
    const pl = s.players[0];
    pl.facing = 1;
    window.__e = s.spawnEnemy('g', pl.x + 200, pl.y);
  });
  await p.tap(0, BUTTON.X);
  await p.until(() => window.__e.dead, ms(3000), 'tumbar al hongo malo con el fuego del dinosaurio');
  await plat(p.page, async () => {
    const { Dino } = await import('/src/games/plat/dino.js');
    const s = window.leogames.scene.getScene('Plat');
    const pl = s.players[0];
    s.dinoRunsAway(pl, { silent: true });
    for (const d of s.dinos) d.destroy();
    s.dinos = [new Dino(s, pl.x, pl.y, 'amarillo')];
  });
  await p.until(() => window.leogames.scene.getScene('Plat').players[0].dino?.color === 'amarillo', ms(3000), 'subirse al dinosaurio amarillo');
  await plat(p.page, () => {
    const s = window.leogames.scene.getScene('Plat');
    const pl = s.players[0];
    window.__e = s.spawnEnemy('g', pl.x + 100, pl.y);
    window.__e.vx = 0;
    Object.assign(pl, { y: pl.y - 200, vy: 700, onGround: false });
  });
  await p.until(() => window.__e.dead, ms(3000), 'tumbar con el temblor del dinosaurio amarillo');

  // El fuerte 1-2: botón P (los ladrillos se vuelven monedas) y cañón.
  await startPlatLevel(p, '1-2');
  await plat(p.page, () => {
    const s = window.leogames.scene.getScene('Plat');
    let at = null;
    s.level.grid.forEach((row, r) => row.forEach((ch, c) => (ch === 'B' && !at ? (at = { c, r }) : null)));
    window.__brick = at;
    const b = s.pButtons[0];
    Object.assign(s.players[0], { x: b.x, y: b.y - 30, vy: 300, onGround: false });
    s.cameras.main.setScroll(b.x - 600, 0);
  });
  await p.until(() => window.leogames.scene.getScene('Plat').pSwitchMs > 0, ms(3000), 'apretar el botón P');
  assert.equal(await plat(p.page, () => window.leogames.scene.getScene('Plat').level.at(window.__brick.c, window.__brick.r)), ' ');
  await plat(p.page, () => {
    const s = window.leogames.scene.getScene('Plat');
    const c = s.cannons[0];
    const x = (c.col - 5) * 48;
    Object.assign(s.players[0], { x, y: (c.row + 1) * 48, vy: 0 });
    s.cameras.main.setScroll(Math.max(0, c.col * 48 - 900), 0);
    c.ms = 3000;
  });
  await p.until(() => window.leogames.scene.getScene('Plat').enemies.some((e) => e.type.kind === 'bullet'), ms(4000), 'que el cañón dispare');
  await plat(p.page, () => (window.leogames.scene.getScene('Plat').pSwitchMs = 1));
  await p.until(() => window.leogames.scene.getScene('Plat').pSwitchMs <= 0, ms(3000), 'que se acabe el botón P');
  assert.equal(await plat(p.page, () => window.leogames.scene.getScene('Plat').level.at(window.__brick.c, window.__brick.r)), 'B');

  // El fuerte 2-2: el bloque ON/OFF cambia los bloques de colores.
  await startPlatLevel(p, '2-2');
  await plat(p.page, () => {
    const s = window.leogames.scene.getScene('Plat');
    let at = null;
    s.level.grid.forEach((row, r) => row.forEach((ch, c) => (ch === '!' && !at ? (at = { c, r }) : null)));
    // Parado en lo primero que hay abajo del bloque, y saltando.
    let floor = at.r + 1;
    while (floor < 15 && s.level.at(at.c, floor) === ' ') floor += 1;
    Object.assign(s.players[0], { x: at.c * 48 + 24, y: floor * 48, vx: 0, vy: -900, onGround: false });
    s.cameras.main.setScroll(Math.max(0, at.c * 48 - 600), 0);
  });
  await p.until(() => window.leogames.scene.getScene('Plat').level && import('/src/games/plat/tiles.js').then((m) => !m.switches.red), ms(3000), 'pegarle al bloque ON/OFF');
  assert.equal(await plat(p.page, () => import('/src/games/plat/tiles.js').then((m) => [m.isSolid('r'), m.isSolid('i')].join())), 'false,true');

  // La casa embrujada 7-1: ↑ en una puerta = pasar a la otra.
  await startPlatLevel(p, '7-1');
  const door = await plat(p.page, () => {
    const s = window.leogames.scene.getScene('Plat');
    const d = s.level.doors[0];
    Object.assign(s.players[0], { x: d.x, y: d.y, vy: 0 });
    s.cameras.main.setScroll(Math.max(0, d.x - 600), 0);
    return d.to.x;
  });
  await p.until(() => window.leogames.scene.getScene('Plat').players[0].onGround, ms(3000), 'pararse frente a la puerta');
  await plat(p.page, () => (window.__pads[0].axes = [0, -1, 0, 0]));
  await p.until(`Math.abs(window.leogames.scene.getScene('Plat').players[0].x - ${door}) < 40`, ms(3000), 'pasar por la puerta');
  await plat(p.page, () => (window.__pads[0].axes = [0, 0, 0, 0]));

  // 6-3: la bandera secreta (azul) abre el nivel secreto de Dulcelandia en el mapa.
  await startPlatLevel(p, '6-3');
  await plat(p.page, () => {
    const s = window.leogames.scene.getScene('Plat');
    const g = s.secretGoal;
    Object.assign(s.players[0], { x: g.x, y: g.y - 4, vy: 0 });
    s.cameras.main.setScroll(Math.max(0, g.x - 600), 0);
  });
  await p.until(() => window.leogames.scene.getScene('Plat').phase === 'results', ms(10000), 'llegar a la bandera secreta');
  assert.equal(await plat(p.page, () => JSON.parse(localStorage.getItem('leogames:platProgress2')).secrets[5]), true);
  assert.ok((await stickers(p.page)).includes('plat-secreta'));
  await p.holdToMenu(0, EXIT, 'salir de Súper Bolitas');
  assert.deepEqual(p.errors, []);
  await p.context.close();
});

test('súper bolitas: mapa por mundos, casita de hongo, enemigo del mapa, batalla de monedas, jefes en serie, vida extra y contrarreloj', { timeout: ms(150000) }, async () => {
  const p = await openPage(game);
  const done = { done: true, big: [false, false, false], bestMs: 90000 };
  await p.page.evaluate(() => import('/src/shared/settings.js').then((m) => m.settings.set('brawlCoins', 25)));
  await openPlat(p, 1, { unlocked: 4, levels: { '1-1': done, '1-4': done }, peque: {} });
  // Empieza en el mundo 2 (el último abierto); LB = mundo 1, con el enemigo del mapa en el 1-3.
  assert.equal(await plat(p.page, () => window.leogames.scene.getScene('Plat').mapState.world), 1);
  await p.tap(0, BUTTON.LB);
  await p.until(() => window.leogames.scene.getScene('Plat').mapState.world === 0, ms(3000), 'cambiar al mundo 1');
  assert.equal(await plat(p.page, () => window.leogames.scene.getScene('Plat').mapState.enemy), 3);

  // La casita de hongo: se revuelven los regalos y se escoge uno.
  await p.tap(0, BUTTON.RIGHT);
  await p.tap(0, BUTTON.A);
  await p.until(() => window.leogames.scene.getScene('Plat').house?.phase === 'pick', ms(12000), 'que se revuelvan los regalos');
  await p.tap(0, BUTTON.A);
  await p.until(() => window.leogames.scene.getScene('Plat').phase === 'map', ms(6000), 'regresar al mapa con el regalo');
  assert.ok((await stickers(p.page)).includes('plat-casita'));

  // Caminar hasta el enemigo del mapa: ¡batalla! Al ganarla se va del mapa.
  await p.tap(0, BUTTON.RIGHT);
  await p.tap(0, BUTTON.RIGHT);
  await p.until(() => window.leogames.scene.getScene('Plat').run?.mode === 'fight' && window.leogames.scene.getScene('Plat').phase === 'play', ms(5000), 'empezar la batalla del mapa');
  await plat(p.page, () => {
    for (const e of window.leogames.scene.getScene('Plat').enemies) e.kill('star');
  });
  await p.until(() => window.leogames.scene.getScene('Plat').phase === 'results', ms(10000), 'ganar la batalla del mapa');
  assert.ok((await stickers(p.page)).includes('plat-mapa'));
  await p.until(() => window.leogames.scene.getScene('Plat').endMs > 1000, ms(5000), 'que los resultados acepten botones');
  await p.tap(0, BUTTON.A);
  await p.until(() => window.leogames.scene.getScene('Plat').phase === 'map', ms(5000), 'regresar al mapa');
  assert.equal(await plat(p.page, () => window.leogames.scene.getScene('Plat').mapState.enemy), null);

  // X = modos. Batalla de monedas (se acaba el tiempo).
  await p.tap(0, BUTTON.X);
  await p.until(() => window.leogames.scene.getScene('Plat').phase === 'modes', ms(3000), 'abrir los modos');
  await p.tap(0, BUTTON.DOWN);
  await p.tap(0, BUTTON.A);
  await p.until(() => window.leogames.scene.getScene('Plat').run?.mode === 'battle' && window.leogames.scene.getScene('Plat').phase === 'play', ms(5000), 'empezar la batalla de monedas');
  await plat(p.page, () => {
    const s = window.leogames.scene.getScene('Plat');
    s.players[0].battleCoins = 3;
    s.run.left = 50;
  });
  await p.until(() => window.leogames.scene.getScene('Plat').phase === 'results', ms(5000), 'terminar la batalla');
  assert.ok((await stickers(p.page)).includes('plat-batalla'));
  await p.until(() => window.leogames.scene.getScene('Plat').endMs > 1000, ms(5000), 'que los resultados acepten botones');
  await p.tap(0, BUTTON.B);
  await p.until(() => window.leogames.scene.getScene('Plat').phase === 'map', ms(5000), 'regresar al mapa');

  // Jefes en serie (solo el Rey Hongo está abierto): directo a la arena.
  await p.tap(0, BUTTON.X);
  await p.tap(0, BUTTON.DOWN);
  await p.tap(0, BUTTON.A);
  await p.until(() => Boolean(window.leogames.scene.getScene('Plat').boss) && window.leogames.scene.getScene('Plat').run?.mode === 'rush', ms(5000), 'empezar los jefes en serie');
  await plat(p.page, () => {
    const s = window.leogames.scene.getScene('Plat');
    s.boss.hp = 0.1;
    if (s.boss.fireHit()) s.bossDefeated();
  });
  await p.until(() => window.leogames.scene.getScene('Plat').phase === 'results', ms(8000), 'ganarle a todos los jefes');
  assert.ok((await stickers(p.page)).includes('plat-jefes'));
  assert.ok(await plat(p.page, () => JSON.parse(localStorage.getItem('leogames:platProgress2')).rushBest > 0));
  await p.until(() => window.leogames.scene.getScene('Plat').endMs > 1000, ms(5000), 'que los resultados acepten botones');
  await p.tap(0, BUTTON.B);
  await p.until(() => window.leogames.scene.getScene('Plat').phase === 'map', ms(5000), 'regresar al mapa');

  // Comprar una vida extra (20 monedas): sale en el siguiente nivel.
  await p.tap(0, BUTTON.X);
  await p.tap(0, BUTTON.DOWN);
  await p.tap(0, BUTTON.DOWN);
  await p.tap(0, BUTTON.A);
  await p.until(() => JSON.parse(localStorage.getItem('leogames:platProgress2')).extraLives === 1, ms(3000), 'comprar una vida');
  await p.tap(0, BUTTON.B);

  // Contrarreloj del 1-1: la primera vuelta se guarda como fantasma y la siguiente vez corre junto a ti.
  for (let i = 0; i < 3; i += 1) await p.tap(0, BUTTON.LEFT);
  await p.until(() => window.leogames.scene.getScene('Plat').mapState.node === 0, ms(3000), 'caminar al 1-1');
  await p.tap(0, BUTTON.X);
  await p.tap(0, BUTTON.DOWN);
  await p.tap(0, BUTTON.A);
  await p.until(() => window.leogames.scene.getScene('Plat').run?.mode === 'trial' && window.leogames.scene.getScene('Plat').phase === 'play', ms(5000), 'empezar la contrarreloj');
  await plat(p.page, () => {
    const s = window.leogames.scene.getScene('Plat');
    for (const e of s.enemies) e.remove();
    s.players[0].invulnMs = 1e9;
  });
  await p.page.evaluate(() => (window.__pads[0].axes = [1, 0, 0, 0]));
  await p.until(() => window.leogames.scene.getScene('Plat').levelMs > 1000, ms(5000), 'correr un poquito');
  await p.page.evaluate(() => (window.__pads[0].axes = [0, 0, 0, 0]));
  await plat(p.page, () => {
    const s = window.leogames.scene.getScene('Plat');
    s.cameras.main.setScroll(s.goal.x - 900, 0);
    s.players[0].x = s.goal.x + 2;
  });
  await p.until(() => window.leogames.scene.getScene('Plat').phase === 'results', ms(8000), 'llegar a la meta');
  assert.ok(await plat(p.page, () => Boolean(JSON.parse(localStorage.getItem('leogames:platGhosts'))['1-1'])), 'no se guardó el fantasma');
  await plat(p.page, () => window.leogames.scene.getScene('Plat').startRun('trial', { index: 0 }));
  await p.until(() => Boolean(window.leogames.scene.getScene('Plat').ghost), ms(3000), 'que salga el fantasma');
  await p.holdToMenu(0, EXIT, 'salir de Súper Bolitas');
  assert.deepEqual(p.errors, []);
  await p.context.close();
});

// Los jefes que vuelan (Rey Nube, Gran Pájaro...) bajan al piso a descansar: ahí se les puede brincar encima. (Antes
// buscaban el piso desde arriba, encontraban el techo del castillo y nunca bajaban.)
test('súper bolitas: el Rey Nube baja al piso a descansar', { timeout: ms(90000) }, async () => {
  const p = await openPage(game);
  await openPlat(p, 1, null);
  await plat(p.page, () =>
    import('/src/games/plat/levels.js').then(({ LEVELS }) => window.leogames.scene.getScene('Plat').startLevel(LEVELS.findIndex((l) => l.spec.boss === 'reyNube'))),
  );
  await p.wait(1000);
  await plat(p.page, () => {
    const s = window.leogames.scene.getScene('Plat');
    const a = s.level.arena;
    Object.assign(s.players[0], { x: (a.boss.col - 6) * 48, y: (a.boss.row + 1) * 48 - 2, vy: 0, invulnMs: 1e9 });
    s.cameras.main.setScroll(a.left * 48, 0);
  });
  await p.until(() => Boolean(window.leogames.scene.getScene('Plat').boss), ms(5000), 'que llegue el Rey Nube');
  await p.until(
    () => {
      const s = window.leogames.scene.getScene('Plat');
      const b = s.boss;
      return b.state === 'rest' && b.stompable && Math.abs(b.y - s.groundY(b.x, b.y)) < 10;
    },
    ms(20000),
    'que baje al piso a descansar',
  );
  await p.holdToMenu(0, EXIT, 'salir de Súper Bolitas');
  assert.deepEqual(p.errors, []);
  await p.context.close();
});

// Monstruos y jefes con poses (ui/creature.js): el Rey Cangrejo camina, carga su ataque, se marea, se enoja y se
// burla; los monstruos de Pelea en equipo se agachan antes de lanzarse y quedan tirados al vencerlos.
test('monstruos y jefes con poses en Súper Bolitas y Pelea en equipo', { timeout: ms(120000) }, async () => {
  const p = await openPage(game);
  await openPlat(p, 1, null);
  await plat(p.page, () =>
    import('/src/games/plat/levels.js').then(({ LEVELS }) => window.leogames.scene.getScene('Plat').startLevel(LEVELS.findIndex((l) => l.spec.boss === 'reyCangrejo'))),
  );
  await p.wait(1000);
  await plat(p.page, () => {
    const s = window.leogames.scene.getScene('Plat');
    const a = s.level.arena;
    Object.assign(s.players[0], { x: (a.left + 3) * 48, y: (a.boss.row + 1) * 48, vy: 0, invulnMs: 1e9 });
  });
  await p.until(() => Boolean(window.leogames.scene.getScene('Plat').boss?.creature), ms(5000), 'que llegue el Rey Cangrejo con sus poses');
  // Las poses se bajan cuando aparece.
  await p.until(() => window.leogames.scene.getScene('Plat').textures.exists('plat:rey-cangrejo-mareado'), ms(10000), 'que se bajen sus poses');
  const shown = (fn) =>
    p.page.evaluate(async (code) => {
      const b = window.leogames.scene.getScene('Plat').boss;
      new Function('b', code)(b);
      await new Promise((resolve) => setTimeout(resolve, 300));
      return b.creature.shown;
    }, fn);
  assert.ok(['normal', 'paso'].includes(await shown('b.setState("walk"); b.stateMs = 0;')), 'caminando');
  assert.equal(await shown('b.stateMs = 1550;'), 'cargando');
  assert.equal(await shown('b.stunMs = 1300; b.creature.hurtMs = 0;'), 'mareado');
  assert.equal(await shown('b.stunMs = 0; b.hp = 1; b.update = () => {}; b.creaturePose = () => "normal";'), 'furioso');
  assert.equal(await shown('b.taunt(3000);'), 'burla');
  await p.holdToMenu(0, EXIT, 'salir de Súper Bolitas');

  await p.openGameCard('Pelea en equipo');
  await p.pickCharacters(1);
  await p.until(() => window.leogames.scene.getScene('Brawl')?.phase === 'map', ms(8000), 'ver el mapa');
  await p.tap(0, BUTTON.A);
  await p.until(() => window.leogames.scene.getScene('Brawl').phase === 'fight', ms(8000), 'empezar en la Pradera');
  await p.page.evaluate(() =>
    import('/src/games/brawl/Monster.js').then(({ Monster }) => {
      const s = window.leogames.scene.getScene('Brawl');
      const m = new Monster(s, 'reySlime', 640, 470);
      m.entered = true;
      m.update = () => {};
      s.monsters.push(m);
      window.__slime = m;
    }),
  );
  await p.until(() => window.leogames.scene.getScene('Brawl').textures.exists('brawl:rey-slime-cargando'), ms(10000), 'que se bajen las poses del Rey Slime');
  const slime = (code) =>
    p.page.evaluate(async (c) => {
      new Function('m', c)(window.__slime);
      await new Promise((resolve) => setTimeout(resolve, 300));
      return window.__slime.creature.shown;
    }, code);
  assert.equal(await slime('m.setState("windup", 9999);'), 'cargando');
  assert.equal(await slime('m.setState("lunge", 9999);'), 'ataque');
  assert.equal(await slime('m.setState("rest", 9999); m.creature.hurt(2000);'), 'dolor');
  // Al vencerlo queda tirado un ratito.
  const bodies = await p.page.evaluate(async () => {
    const s = window.leogames.scene.getScene('Brawl');
    const before = s.children.list.length;
    window.__slime.leaveBody();
    return s.children.list.length - before;
  });
  assert.equal(bodies, 1, 'queda tirado al vencerlo');
  await p.holdToMenu(0, EXIT, 'salir de Pelea en equipo');
  assert.deepEqual(p.errors, []);
  await p.context.close();
});

test('música, voz y premios', { timeout: ms(60000) }, async () => {
  const p = await openPage(game);
  await p.page.evaluate(() => {
    window.__spoken = [];
    window.speechSynthesis.speak = (u) => window.__spoken.push(u.text);
  });
  await p.page.mouse.click(640, 360); // el clic deja sonar al navegador
  await p.joinPlayers(1);
  // La voz dice el menú: con su grabación (si ya la hay) o con la voz del navegador (si hay voz en español; en
  // GitHub Actions no hay).
  const voice = await p.page.evaluate(async () => {
    const { clipName } = await import('/src/shared/voice-text.js');
    const list = (await import('/src/shared/voz.json')).default;
    const spanish = speechSynthesis.getVoices().some((v) => v.lang.startsWith('es'));
    return { recorded: list.includes(clipName('¿A qué jugamos?')), spanish };
  });
  if (voice.recorded) await p.until(() => window.__voiceLog.some((e) => e.text === '¿A qué jugamos?' && e.how === 'grabación'), ms(5000), 'decir el menú con su grabación');
  else if (voice.spanish) await p.until(() => window.__voiceLog.some((e) => e.text === '¿A qué jugamos?' && e.how === 'navegador'), ms(5000), 'decir el menú');
  const music = () => p.page.evaluate(() => import('/src/shared/music.js').then((m) => m.music.name));
  assert.equal(await music(), 'menu');
  await p.openGameCard('Pelea en equipo');
  await p.pickCharacters(1);
  await p.page.waitForFunction(() => window.leogames.scene.isActive('Brawl'), null, { timeout: ms(8000) });
  assert.equal(await music(), 'brawl');
  assert.ok((await stickers(p.page)).includes('unirse'));
  assert.deepEqual(p.errors, []);
  await p.context.close();
});
