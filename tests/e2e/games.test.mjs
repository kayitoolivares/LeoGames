// Pruebas de punta a punta: bots que juegan con controles simulados. Corren con `npm test`
// y en GitHub Actions antes de publicar, para que un cambio no rompa otro juego sin darnos cuenta.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { BUTTON, openPage, startGame } from './helpers.mjs';

// En GitHub no hay tarjeta de video y el juego va más lento: se le da más tiempo a todo.
const SLOW = process.env.CI ? 4 : 1;
const ms = (value) => value * SLOW;
// Para salir de cualquier juego se mantienen LB + RB + Y.
const EXIT = [BUTTON.LB, BUTTON.RB, BUTTON.Y];

let game;
before(async () => {
  game = await startGame();
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
        const pad = window.__pads[Number(f.deviceId.replace('pad', ''))];
        const set = (b, v) => ((pad.buttons[b].pressed = v), (pad.buttons[b].value = v ? 1 : 0));
        set(0, false);
        set(2, false);
        pad.axes = [0, 0, 0, 0];
        if (f.down) continue;
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

test('pelea en equipo: dos bots ganan las rondas', { timeout: ms(240000) }, async () => {
  const p = await openPage(game);
  await p.joinPlayers(2);
  await p.openGameCard('Pelea en equipo');
  await p.pickCharacters(2);
  await p.page.waitForFunction(() => window.leogames.scene.isActive('Brawl'), null, { timeout: ms(8000) });
  // Sin calcomanías no hay nada que escoger: empieza directo en la Pradera.
  assert.equal((await brawl(p.page)).world, 0);
  await startBrawlBot(p.page);
  if (process.env.CI) {
    // En GitHub va lento: basta con que pasen la primera ronda.
    await p.until(() => JSON.parse(localStorage.getItem('leogames:stickers') ?? '[]').includes('pelea-ronda'), ms(60000), 'pasar la primera ronda');
  } else {
    await p.until(() => window.leogames.scene.getScene('Brawl').phase === 'worldWon', 200000, 'ganar las 4 rondas');
    assert.ok((await stickers(p.page)).includes('pelea-gana'));
    // Con A se sigue al Bosque de hongos.
    await stopBot(p.page);
    await p.wait(1300);
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
  await p.until(() => window.leogames.scene.getScene('Brawl')?.phase === 'choose', ms(8000), 'ver los mundos');
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
  await p.until(() => window.leogames.scene.getScene('Brawl').phase === 'worldWon', ms(120000), 'vencer al Gran Hongo');

  // El Volcán ya está desbloqueado: se sigue con A y se vence al dragón.
  await stopBot(p.page);
  await p.wait(1300);
  await p.holdUntil(0, [BUTTON.A], () => window.leogames.scene.getScene('Brawl').worldIndex === 2, 'pasar al volcán');
  await bossWave();
  await p.until(() => window.__powers.has('fuego en pantalla'), ms(90000), 'el dragón lanza fuego');
  if (!process.env.CI) {
    await p.until(() => window.leogames.scene.getScene('Brawl').phase === 'won', 150000, 'vencer al dragón');
    assert.ok((await stickers(p.page)).includes('pelea-volcan'));
  }
  await stopBot(p.page);
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
  const openSelect = async () => {
    await p.openGameCard('Bolitas Bros');
    await p.page.waitForFunction(() => window.leogames.scene.isActive('SmashSelect'), null, { timeout: ms(8000) });
  };
  const stageChoices = async () => {
    const choices = [];
    for (let i = 0; i < 6; i += 1) {
      choices.push(await p.page.evaluate(() => window.leogames.scene.getScene('SmashSelect').settings.stage));
      await p.tap(0, BUTTON.RB);
    }
    return choices;
  };

  // Sin calcomanías solo están los 3 de siempre.
  await openSelect();
  assert.deepEqual(await stageChoices(), ['castillo', 'nubes', 'barco', 'castillo', 'nubes', 'barco']);
  await p.tap(0, BUTTON.B);
  await p.until(() => window.leogames.scene.isActive('Menu'), ms(6000), 'regresar al menú');

  // Con "Campeón" y "¡Súper!" aparecen el Espacio (gravedad baja) y el Volcán.
  await p.page.evaluate(() => import('/src/shared/settings.js').then((m) => m.settings.set('stickers', ['smash-gana', 'smash-super'])));
  await openSelect();
  assert.deepEqual((await stageChoices()).slice(0, 5), ['castillo', 'nubes', 'barco', 'espacio', 'volcan']);
  // Después de 6 toques va en Nubes: 2 más para el Espacio.
  await p.tap(0, BUTTON.RB);
  await p.tap(0, BUTTON.RB);
  await p.tap(0, BUTTON.A);
  await fightOn('espacio');
  assert.equal(await p.page.evaluate(() => window.leogames.scene.getScene('Smash').fighters[0].arena.gravity), 0.55);
  await p.holdToMenu(0, EXIT, 'salir del Espacio');

  // En el Volcán, los géiseres avisan y hacen erupción.
  await openSelect();
  await p.tap(0, BUTTON.RB);
  await p.tap(0, BUTTON.A);
  await fightOn('volcan');
  await p.until(() => window.leogames.scene.getScene('Smash').geysers.eruptions > 0, ms(20000), 'que un géiser haga erupción');
  await p.holdToMenu(0, EXIT, 'salir del Volcán');
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
  await p.until(() => { const r = window.leogames.scene.getScene('Kart').game3d.humans[0]; return r.y === 0 && r.boostMs > 0; }, ms(5000), 'caer con el turbito del truco');

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

// Por equipos: Rojos contra Azules (3 y 3), los poderes no le pegan a tu equipo y al final se suman los puntos.
test('karts locos: carrera por equipos', { timeout: ms(120000) }, async () => {
  const p = await openPage(game);
  await p.joinPlayers(2);
  await p.openGameCard('Karts locos');
  await passGarage(p, 2);
  await p.until(() => window.leogames.scene.getScene('Kart').game3d?.phase === 'choose', ms(30000), 'ver los modos');
  await p.tap(0, BUTTON.DOWN);
  await p.tap(0, BUTTON.A);
  await p.until(() => document.querySelector('.kart-choose h1')?.textContent === 'Escoge pista', ms(10000), 'ver las pistas');
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

// Batalla de globos: un cohete revienta un globo; sin globos quedas fuera; gana el último con globos.
test('karts locos: batalla de globos', { timeout: ms(120000) }, async () => {
  const p = await openPage(game);
  await p.joinPlayers(1);
  await p.openGameCard('Karts locos');
  await passGarage(p, 1);
  await p.until(() => window.leogames.scene.getScene('Kart').game3d?.phase === 'choose', ms(30000), 'ver los modos');
  await p.tap(0, BUTTON.RIGHT);
  await p.tap(0, BUTTON.RIGHT);
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

test('karts locos: escoger la pista de nieve y cambiar de pista', { timeout: ms(180000) }, async () => {
  const p = await openPage(game);
  await p.page.evaluate(() => import('/src/shared/settings.js').then((m) => m.settings.set('stickers', ['kart-gana'])));
  await p.joinPlayers(1);
  await p.openGameCard('Karts locos');
  await passGarage(p, 1);
  await pickRaceMode(p);
  // La nieve está en el segundo renglón, abajo de la Pradera.
  await p.tap(0, BUTTON.DOWN);
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

test('música, voz y premios', { timeout: ms(60000) }, async () => {
  const p = await openPage(game);
  await p.page.evaluate(() => {
    window.__spoken = [];
    window.speechSynthesis.speak = (u) => window.__spoken.push(u.text);
  });
  await p.page.mouse.click(640, 360); // el clic deja sonar al navegador
  await p.joinPlayers(1);
  const music = () => p.page.evaluate(() => import('/src/shared/music.js').then((m) => m.music.name));
  assert.equal(await music(), 'menu');
  await p.openGameCard('Pelea en equipo');
  await p.pickCharacters(1);
  await p.page.waitForFunction(() => window.leogames.scene.isActive('Brawl'), null, { timeout: ms(8000) });
  assert.equal(await music(), 'brawl');
  assert.ok((await stickers(p.page)).includes('unirse'));
  // Sin voces instaladas (como en GitHub Actions) la voz no habla; si hay, debió decir el menú.
  const voices = await p.page.evaluate(() => speechSynthesis.getVoices().filter((v) => v.lang.startsWith('es')).length);
  if (voices > 0) assert.ok((await p.page.evaluate(() => window.__spoken)).includes('¿A qué jugamos?'));
  assert.deepEqual(p.errors, []);
  await p.context.close();
});
