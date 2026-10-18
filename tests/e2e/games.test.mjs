// Pruebas de punta a punta: bots que juegan con controles simulados. Corren con `npm test`
// y en GitHub Actions antes de publicar, para que un cambio no rompa otro juego sin darnos cuenta.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { BUTTON, openPage, startGame } from './helpers.mjs';

// En GitHub no hay tarjeta de video y el juego va más lento: se le da más tiempo a todo.
const SLOW = process.env.CI ? 4 : 1;
const ms = (value) => value * SLOW;

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
  await p.page.waitForFunction(() => window.leogames.scene.isActive('Brawl'), null, { timeout: ms(8000) });
  await p.holdToMenu(0, [BUTTON.Y], 'salir de Pelea en equipo');

  await p.openGameCard('Bolitas Bros');
  await p.page.waitForFunction(() => window.leogames.scene.isActive('SmashSelect'), null, { timeout: ms(8000) });
  await p.tap(0, BUTTON.B);
  await p.until(() => window.leogames.scene.isActive('Menu'), ms(6000), 'salir de la selección de Bolitas Bros');

  for (const [title, key] of [['Karts locos', 'Kart'], ['Carreras', 'Race']]) {
    await p.openGameCard(title);
    await p.page.waitForFunction((k) => Boolean(window.leogames.scene.getScene(k)?.game3d), key, { timeout: ms(30000) });
    await p.holdToMenu(0, [BUTTON.Y], `salir de ${title}`);
    assert.equal(await p.page.evaluate(() => document.querySelectorAll('body > div[style*="z-index"]').length), 0, `${title} dejó su capa 3D`);
  }

  await p.openGameCard('Fútbol de bolitas');
  await p.until(() => window.leogames.scene.getScene('Futbol')?.phase === 'setup', ms(8000), 'ver la pantalla de equipos');
  await p.tap(0, BUTTON.B);
  await p.until(() => window.leogames.scene.isActive('Menu'), ms(6000), 'salir del fútbol');

  await p.openGameCard('Modo Bebé');
  await p.page.waitForFunction(() => window.leogames.scene.isActive('Baby'), null, { timeout: ms(8000) });
  await p.holdToMenu(0, [BUTTON.LB, BUTTON.RB], 'salir del Modo Bebé');

  await p.openGameCard('Mis premios');
  await p.page.waitForFunction(() => window.leogames.scene.isActive('Premios'), null, { timeout: ms(8000) });
  await p.tap(0, BUTTON.B);
  await p.until(() => window.leogames.scene.isActive('Menu'), ms(6000), 'salir de Mis premios');

  await p.openGameCard('Prueba de controles');
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
  await p.holdToMenu(0, [BUTTON.Y], 'salir de Bolitas Bros');
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
  await p.holdToMenu(0, [BUTTON.Y], 'salir del Espacio');

  // En el Volcán, los géiseres avisan y hacen erupción.
  await openSelect();
  await p.tap(0, BUTTON.RB);
  await p.tap(0, BUTTON.A);
  await fightOn('volcan');
  await p.until(() => window.leogames.scene.getScene('Smash').geysers.eruptions > 0, ms(20000), 'que un géiser haga erupción');
  await p.holdToMenu(0, [BUTTON.Y], 'salir del Volcán');
  assert.deepEqual(p.errors, []);
  await p.context.close();
});

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
  await p.page.waitForFunction(() => Boolean(window.leogames.scene.getScene('Kart')?.game3d), null, { timeout: ms(30000) });
  // Sin calcomanías no hay pista que escoger: arranca en la Pradera.
  assert.equal(await p.page.evaluate(() => window.leogames.scene.getScene('Kart').game3d.trackKey), 'pradera');
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
  await p.holdToMenu(0, [BUTTON.Y], 'salir de Karts locos');
  assert.deepEqual(p.errors, []);
  await p.context.close();
});

test('karts locos: escoger la pista de nieve y cambiar de pista', { timeout: ms(180000) }, async () => {
  const p = await openPage(game);
  await p.page.evaluate(() => import('/src/shared/settings.js').then((m) => m.settings.set('stickers', ['kart-gana'])));
  await p.joinPlayers(1);
  await p.openGameCard('Karts locos');
  await p.until(() => window.leogames.scene.getScene('Kart').game3d?.phase === 'choose', ms(30000), 'ver las pistas');
  await p.tap(0, BUTTON.RIGHT);
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
  await p.holdToMenu(0, [BUTTON.Y], 'salir de Karts locos');
  assert.equal(await p.page.evaluate(() => document.querySelectorAll('body > div[style*="z-index"]').length), 0, 'quedó la capa 3D');
  assert.deepEqual(p.errors, []);
  await p.context.close();
});

test('fútbol de bolitas: meter gol, ganar el partido y revancha', { timeout: ms(150000) }, async () => {
  const p = await openPage(game);
  await p.joinPlayers(1);
  await p.openGameCard('Fútbol de bolitas');
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
  await p.until(() => window.leogames.scene.getScene('Futbol').score.some((goals) => goals > 0), ms(90000), 'que alguien meta gol');
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
  await p.holdToMenu(0, [BUTTON.Y], 'salir del fútbol');
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
  await p.page.waitForFunction(() => window.leogames.scene.isActive('Brawl'), null, { timeout: ms(8000) });
  assert.equal(await music(), 'brawl');
  assert.ok((await stickers(p.page)).includes('unirse'));
  // Sin voces instaladas (como en GitHub Actions) la voz no habla; si hay, debió decir el menú.
  const voices = await p.page.evaluate(() => speechSynthesis.getVoices().filter((v) => v.lang.startsWith('es')).length);
  if (voices > 0) assert.ok((await p.page.evaluate(() => window.__spoken)).includes('¿A qué jugamos?'));
  assert.deepEqual(p.errors, []);
  await p.context.close();
});
