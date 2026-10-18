// Pruebas de punta a punta: bots que juegan con controles simulados. Corren con `npm test`
// y en GitHub Actions antes de publicar, para que un cambio no rompa otro juego sin darnos cuenta.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { BUTTON, openPage, startGame } from './helpers.mjs';

let game;
before(async () => {
  game = await startGame();
});
after(async () => {
  await game?.stop();
});

const stickers = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('leogames:stickers') ?? '[]'));

test('menú: cada juego abre y se puede salir', { timeout: 180000 }, async () => {
  const p = await openPage(game);
  await p.joinPlayers(1);
  const backToMenu = () => p.until(() => window.leogames.scene.isActive('Menu'), 6000, 'regresar al menú');

  await p.openGameCard('Pelea en equipo');
  await p.until(() => window.leogames.scene.isActive('Brawl'), 5000, 'abrir Pelea en equipo');
  await p.tap(0, BUTTON.Y, 1500);
  await backToMenu();

  await p.openGameCard('Bolitas Bros');
  await p.until(() => window.leogames.scene.isActive('SmashSelect'), 5000, 'abrir Bolitas Bros');
  await p.tap(0, BUTTON.B);
  await backToMenu();

  for (const [title, key] of [['Karts locos', 'Kart'], ['Carreras', 'Race']]) {
    await p.openGameCard(title);
    await p.page.waitForFunction((k) => Boolean(window.leogames.scene.getScene(k)?.game3d), key, { timeout: 30000 });
    await p.tap(0, BUTTON.Y, 1500);
    await backToMenu();
    assert.equal(await p.page.evaluate(() => document.querySelectorAll('body > div[style*="z-index"]').length), 0, `${title} dejó su capa 3D`);
  }

  await p.openGameCard('Modo Bebé');
  await p.until(() => window.leogames.scene.isActive('Baby'), 5000, 'abrir el Modo Bebé');
  await p.page.evaluate(() => {
    window.__button(0, 4, true);
    window.__button(0, 5, true);
  });
  await p.wait(3400);
  await p.page.evaluate(() => window.__release());
  await backToMenu();

  await p.openGameCard('Mis premios');
  await p.until(() => window.leogames.scene.isActive('Premios'), 5000, 'abrir Mis premios');
  await p.tap(0, BUTTON.B);
  await backToMenu();

  await p.openGameCard('Prueba de controles');
  await p.until(() => window.leogames.scene.isActive('PadTest'), 5000, 'abrir la prueba de controles');
  await p.tap(0, BUTTON.B, 1300);
  await backToMenu();

  assert.deepEqual(p.errors, []);
  await p.context.close();
});

test('pelea en equipo: dos bots ganan las 4 rondas', { timeout: 240000 }, async () => {
  const p = await openPage(game);
  await p.joinPlayers(2);
  await p.openGameCard('Pelea en equipo');
  await p.until(() => window.leogames.scene.isActive('Brawl'), 5000, 'abrir Pelea en equipo');
  // Cada bot va hacia el monstruo más cercano, le pega y salta cuando avisa con "!".
  await p.page.evaluate(() => {
    let tick = 0;
    window.__bot = setInterval(() => {
      const s = window.leogames.scene.getScene('Brawl');
      if (!s.sys.isActive() || !s.fighters) return;
      tick += 1;
      for (const f of s.fighters) {
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
  });
  await p.until(() => window.leogames.scene.getScene('Brawl').phase === 'won', 200000, 'ganar las 4 rondas');
  await p.page.evaluate(() => clearInterval(window.__bot));
  assert.ok((await stickers(p.page)).includes('pelea-gana'));
  assert.deepEqual(p.errors, []);
  await p.context.close();
});

test('bolitas bros: pelea contra el CPU, revancha y salir', { timeout: 120000 }, async () => {
  const p = await openPage(game);
  await p.joinPlayers(1);
  await p.openGameCard('Bolitas Bros');
  await p.until(() => window.leogames.scene.isActive('SmashSelect'), 5000, 'abrir Bolitas Bros');
  await p.tap(0, BUTTON.A);
  await p.until(() => window.leogames.scene.getScene('Smash').phase === 'fight', 8000, 'empezar la pelea');
  // Camina hacia el CPU pegando hasta que alguien reciba daño.
  await p.page.evaluate(() => {
    window.__bot = setInterval(() => {
      const s = window.leogames.scene.getScene('Smash');
      const [me, cpu] = s.fighters;
      const pad = window.__pads[0];
      pad.axes = [Math.sign(cpu.x - me.x), 0, 0, 0];
      pad.buttons[2].pressed = !pad.buttons[2].pressed;
    }, 80);
  });
  await p.until(() => window.leogames.scene.getScene('Smash').fighters.some((f) => f.damage > 0), 30000, 'que alguien reciba daño');
  await p.page.evaluate(() => {
    clearInterval(window.__bot);
    window.__release();
    window.__pads[0].axes = [0, 0, 0, 0];
    window.leogames.scene.getScene('Smash').fighters[1].stocks = 0;
  });
  await p.until(() => window.leogames.scene.getScene('Smash').phase === 'end', 5000, 'terminar la pelea');
  assert.ok((await stickers(p.page)).includes('smash-gana'));
  await p.wait(1700);
  await p.tap(0, BUTTON.A);
  await p.until(() => window.leogames.scene.getScene('Smash').phase === 'countdown', 5000, 'revancha');
  await p.tap(0, BUTTON.Y, 1500);
  await p.until(() => window.leogames.scene.isActive('Menu'), 5000, 'salir al menú');
  assert.deepEqual(p.errors, []);
  await p.context.close();
});

test('karts locos: dos bots dan una vuelta con cajitas y ven los resultados', { timeout: 180000 }, async () => {
  const p = await openPage(game);
  await p.joinPlayers(2);
  await p.openGameCard('Karts locos');
  await p.page.waitForFunction(() => Boolean(window.leogames.scene.getScene('Kart')?.game3d), null, { timeout: 30000 });
  await p.page.evaluate(() => {
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
        if (r.rollMs > 900 && !r.__rolled) window.__boxes += 1;
        r.__rolled = r.rollMs > 0;
      }
    }, 50);
  });
  await p.until(() => window.leogames.scene.getScene('Kart').game3d.humans.every((r) => r.lap >= 1), 150000, 'completar una vuelta');
  assert.ok((await p.page.evaluate(() => window.__boxes)) > 0, 'nadie agarró cajitas');
  await p.page.evaluate(() => {
    clearInterval(window.__bot);
    window.__release();
    window.leogames.scene.getScene('Kart').game3d.showResults();
  });
  await p.wait(1500);
  await p.tap(0, BUTTON.A);
  await p.until(() => window.leogames.scene.getScene('Kart').game3d.phase === 'countdown', 5000, 'otra carrera');
  await p.tap(0, BUTTON.Y, 1500);
  await p.until(() => window.leogames.scene.isActive('Menu'), 6000, 'salir al menú');
  assert.deepEqual(p.errors, []);
  await p.context.close();
});

test('carreras desde arriba: el carro avanza por la pista', { timeout: 90000 }, async () => {
  const p = await openPage(game);
  await p.joinPlayers(1);
  await p.openGameCard('Carreras');
  await p.page.waitForFunction(() => Boolean(window.leogames.scene.getScene('Race')?.game3d), null, { timeout: 30000 });
  await p.page.evaluate(() => {
    window.__bot = setInterval(() => {
      const race = window.leogames.scene.getScene('Race').game3d;
      const k = race.humans[0];
      const t = race.track.pointAt(k.index + 12, 0);
      const d = Math.hypot(t.x - k.x, t.z - k.z) || 1;
      window.__pads[0].axes = [(t.x - k.x) / d, (t.z - k.z) / d, 0, 0];
    }, 50);
  });
  await p.until(() => window.leogames.scene.getScene('Race').game3d.humans[0].progress > 0.15, 60000, 'avanzar en la pista');
  await p.page.evaluate(() => clearInterval(window.__bot));
  assert.deepEqual(p.errors, []);
  await p.context.close();
});

test('celular: con la pantalla táctil se une y se mueve por el menú', { timeout: 60000 }, async () => {
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
  await p.wait(100);
  await touch('touchEnd', []);
  await p.wait(200);
  await touch('touchStart', [a]);
  await p.wait(1300);
  await touch('touchEnd', []);
  await p.until(() => window.leogames.scene.isActive('Menu'), 5000, 'llegar al menú tocando A');
  const before = await p.page.evaluate(() => window.leogames.scene.getScene('Menu').selected);
  await touch('touchStart', [[140, 250]]);
  await touch('touchMove', [[210, 250]]);
  await p.wait(250);
  await touch('touchEnd', []);
  await p.wait(200);
  assert.notEqual(await p.page.evaluate(() => window.leogames.scene.getScene('Menu').selected), before, 'el stick no movió el menú');
  assert.deepEqual(p.errors, []);
  await p.context.close();
});

test('música, voz y premios', { timeout: 60000 }, async () => {
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
  await p.until(() => window.leogames.scene.isActive('Brawl'), 5000, 'abrir Pelea en equipo');
  assert.equal(await music(), 'brawl');
  assert.ok((await stickers(p.page)).includes('unirse'));
  // Sin voces instaladas (como en GitHub Actions) la voz no habla; si hay, debió decir el menú.
  const voices = await p.page.evaluate(() => speechSynthesis.getVoices().filter((v) => v.lang.startsWith('es')).length);
  if (voices > 0) assert.ok((await p.page.evaluate(() => window.__spoken)).includes('¿A qué jugamos?'));
  assert.deepEqual(p.errors, []);
  await p.context.close();
});
