// Pruebas de lo nuevo de Karts locos: la Copa Fiesta (granja, feria, jardín gigante y mina de cristales) y las
// batallas en equipos en la arena del fuerte. (Las demás pruebas de Karts locos están en games.test.mjs.)
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

// Del menú al taller de Karts locos; cada jugador da A (piloto y kart de siempre).
async function passGarage(p, count) {
  await p.openGameCard('Karts locos');
  await p.until(() => window.leogames.scene.getScene('Kart').game3d?.phase === 'garage', ms(30000), 'ver el taller');
  for (let i = 0; i < count; i += 1) await p.tap(i, BUTTON.A);
}

// Después del taller: el modo número `index` (0 = Carrera) y se espera la pantalla que abre.
async function chooseKartMode(p, index, title) {
  await p.until(() => window.leogames.scene.getScene('Kart').game3d?.phase === 'choose', ms(30000), 'ver los modos');
  for (let i = 0; i < index; i += 1) await p.tap(0, BUTTON.RIGHT);
  await p.tap(0, BUTTON.A);
  await p.page.waitForFunction((text) => document.querySelector('.kart-choose h1')?.textContent.includes(text), title, { timeout: ms(10000) });
}

// La Copa Fiesta: cada pista carga y se corre, con su peligro y lo que se mueve (tractor, carrusel, aspersor) y,
// en la mina, el puente colgante: el que se sale se cae y la red lo regresa al camino.
test('karts locos: copa fiesta con tractor, carrusel, aspersor y la red del puente colgante', { timeout: ms(240000) }, async () => {
  const p = await openPage(game);
  await p.joinPlayers(1);
  await passGarage(p, 1);
  await chooseKartMode(p, 1, 'Gran Premio');
  // La Copa Fiesta es la sexta.
  for (let i = 0; i < 5; i += 1) await p.tap(0, BUTTON.RIGHT);
  await p.tap(0, BUTTON.A);
  const race = async (n, key) => {
    await p.page.waitForFunction(
      (k) => window.leogames.scene.getScene('Kart').game3d?.gp?.race === k && window.leogames.scene.getScene('Kart').game3d.phase === 'race',
      n,
      { timeout: ms(40000) },
    );
    assert.equal(await p.page.evaluate(() => window.leogames.scene.getScene('Kart').game3d.trackKey), key);
    await p.until(() => window.leogames.scene.getScene('Kart').game3d.raceMs > 1500, ms(15000), `correr en ${key}`);
    assert.ok(await p.page.evaluate(() => Boolean(window.leogames.scene.getScene('Kart').game3d.hazards)), `${key} sin peligro`);
  };
  // Pone al jugador en un lugar de la pista (`at` de 0 a 1, `lateral` de lado) con esa velocidad.
  const place = (at, speed, lateral = 0) =>
    p.page.evaluate(
      ([a, v, side]) => {
        const k = window.leogames.scene.getScene('Kart').game3d;
        const r = k.humans[0];
        const spot = k.track.pointAt(Math.round(a * k.track.count), side);
        Object.assign(r, { x: spot.x, z: spot.z, heading: spot.heading, index: spot.index, speed: v, shieldMs: 0, spinMs: 0, starMs: 0, y: spot.y, vy: 0 });
      },
      [at, speed, lateral],
    );
  const next = async () => {
    await p.page.evaluate(() => window.leogames.scene.getScene('Kart').game3d.showResults());
    await p.until(() => window.leogames.scene.getScene('Kart').game3d.phaseMs > 1300, ms(10000), 'que se pueda seguir');
    await p.tap(0, BUTTON.A);
  };

  // Granja: el tractor pasa justo cuando el jugador está en su camino.
  await race(0, 'granja');
  await p.page.evaluate(() => {
    const living = window.leogames.scene.getScene('Kart').game3d.living;
    const tractor = living.items.find((item) => item.kind === 'tractor');
    const { everyMs, warnMs, speed } = tractor.spec;
    living.timeMs = everyMs - tractor.offset + warnMs + ((tractor.span - 2) / speed) * 1000;
  });
  await place(0.66, 0);
  await p.until(() => window.leogames.scene.getScene('Kart').game3d.humans[0].spinMs > 0, ms(5000), 'que lo alcance el tractor');
  await next();

  // Feria: arriba del carrusel, el kart gira solito.
  await race(1, 'feria');
  await p.page.evaluate(() => {
    const k = window.leogames.scene.getScene('Kart').game3d;
    const carousel = k.living.items.find((item) => item.kind === 'carousel');
    Object.assign(k.humans[0], { x: carousel.f.x + 3, z: carousel.f.z, speed: 0, index: carousel.f.index, y: carousel.f.y, vy: 0 });
    window.__heading = k.humans[0].heading;
  });
  await p.until(
    () => {
      const r = window.leogames.scene.getScene('Kart').game3d.humans[0];
      return Math.abs(r.heading - window.__heading) > 0.2;
    },
    ms(5000),
    'que el carrusel lo gire',
  );
  await next();

  // Jardín: el chorro del aspersor lo empuja de lado.
  await race(2, 'jardin');
  await p.page.evaluate(() => {
    const living = window.leogames.scene.getScene('Kart').game3d.living;
    const sprinkler = living.items.find((item) => item.look === 'sprinkler');
    living.timeMs = 5200 - sprinkler.offset + 800;
  });
  await place(0.7, 0);
  const lateral = () =>
    p.page.evaluate(() => {
      const k = window.leogames.scene.getScene('Kart').game3d;
      const r = k.humans[0];
      return k.track.lateral(r.x, r.z, r.index);
    });
  const start = await lateral();
  await p.wait(500);
  assert.ok(Math.abs((await lateral()) - start) > 1, 'el aspersor lo empuja de lado');
  await next();

  // Mina: se sale del puente colgante (sin llantas), se cae... y la red lo regresa a media pista.
  await race(3, 'mina');
  assert.ok(await p.page.evaluate(() => window.leogames.scene.getScene('Kart').game3d.ledges.open(Math.round(0.15 * 400))), 'hay puente colgante');
  await p.page.evaluate(() => {
    const k = window.leogames.scene.getScene('Kart').game3d;
    k.racers.forEach((r) => r !== k.humans[0] && Object.assign(r, { x: r.x + 400 }));
  });
  await place(0.15, 8, 12.5);
  await p.until(() => window.leogames.scene.getScene('Kart').game3d.humans[0].fallMs > 0, ms(5000), 'caerse del puente');
  await p.until(
    () => {
      const k = window.leogames.scene.getScene('Kart').game3d;
      const r = k.humans[0];
      return r.fallMs === 0 && Math.abs(k.track.lateral(r.x, r.z, r.index)) < 2;
    },
    ms(6000),
    'que la red lo regrese al camino',
  );
  assert.ok((await stickers(p.page)).includes('kart-red'), 'caerse de un puente da su calcomanía');

  // Se acaba la copa con el jugador adelante en puntos: la Copa Fiesta.
  await p.page.evaluate(() => {
    const k = window.leogames.scene.getScene('Kart').game3d;
    k.gp.points = k.racers.map((r) => (r.isCpu ? 0 : 100));
    k.showResults();
  });
  await p.until(() => /Copa Fiesta/.test(document.querySelector('.kart-results h1')?.textContent ?? ''), ms(5000), 'ganar la Copa Fiesta');
  const earned = await stickers(p.page);
  assert.ok(earned.includes('kart-fiesta') && earned.includes('kart-copa'), `calcomanías: ${earned}`);
  await p.holdToMenu(0, EXIT, 'salir de Karts locos');
  assert.deepEqual(p.errors, []);
  await p.context.close();
});

// Batalla de globos en equipos: Rojos contra Azules en el fuerte; lo de tu equipo no te revienta globos; gana el
// equipo que deja sin globos al otro.
test('karts locos: batalla de globos en equipos en la arena del fuerte', { timeout: ms(120000) }, async () => {
  const p = await openPage(game);
  await p.joinPlayers(1);
  await passGarage(p, 1);
  await chooseKartMode(p, 2, 'Escoge batalla');
  // Abajo de las tres de siempre: Globos en equipos.
  await p.tap(0, BUTTON.DOWN);
  await p.tap(0, BUTTON.A);
  await p.until(() => window.leogames.scene.getScene('Kart').game3d?.phase === 'race', ms(30000), 'empezar la batalla en equipos');
  const state = () =>
    p.page.evaluate(() => {
      const k = window.leogames.scene.getScene('Kart').game3d;
      return { arena: k.track.kind, teams: k.racers.map((r) => r.team), balloons: k.racers.map((r) => r.balloons) };
    });
  assert.deepEqual(await state(), { arena: 'fuerte', teams: [0, 1, 0, 1], balloons: [3, 3, 3, 3] });
  // Al compañero no le pasa nada; al rival se le revienta un globo.
  await p.page.evaluate(() => {
    const k = window.leogames.scene.getScene('Kart').game3d;
    k.racers.forEach((r) => Object.assign(r, { shieldMs: 0, safeMs: 0, starMs: 0, ghostMs: 0, bulletMs: 0 }));
    k.battle.hit(k.racers[2], k.humans[0]);
    k.battle.hit(k.racers[1], k.humans[0]);
  });
  assert.deepEqual((await state()).balloons, [3, 2, 3, 3]);
  // El panel dice cómo van los dos equipos.
  await p.until(() => /🔴 6 🔵 5/.test(document.body.textContent), ms(3000), 'ver los globos de cada equipo');
  // Los Azules se quedan sin globos: ganan los Rojos.
  await p.page.evaluate(() => {
    const k = window.leogames.scene.getScene('Kart').game3d;
    for (const r of k.racers.filter((x) => x.team === 1)) {
      Object.assign(r, { balloons: 1, safeMs: 0, shieldMs: 0, starMs: 0, ghostMs: 0, bulletMs: 0 });
      k.battle.hit(r, k.humans[0]);
    }
  });
  await p.until(() => window.leogames.scene.getScene('Kart').game3d.phase === 'results', ms(5000), 'terminar la batalla');
  assert.match(await p.page.evaluate(() => document.querySelector('.kart-results h1')?.textContent ?? ''), /Ganaron los Rojos/);
  const earned = await stickers(p.page);
  assert.ok(earned.includes('kart-equipo') && earned.includes('kart-batalla'), `calcomanías: ${earned}`);
  // Otra: los mismos equipos y otra vez 3 globos.
  await p.until(() => window.leogames.scene.getScene('Kart').game3d.phaseMs > 1300, ms(10000), 'que se pueda pedir otra');
  await p.tap(0, BUTTON.A);
  await p.until(() => window.leogames.scene.getScene('Kart').game3d.phase === 'countdown', ms(5000), 'otra batalla');
  assert.deepEqual(await state(), { arena: 'fuerte', teams: [0, 1, 0, 1], balloons: [3, 3, 3, 3] });
  await p.holdToMenu(0, EXIT, 'salir de Karts locos');
  assert.deepEqual(p.errors, []);
  await p.context.close();
});
