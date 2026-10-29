// Pruebas de lo nuevo de Bolitas Bros y del Duelo: los escenarios nuevos con su sorpresa (Granja, Tren y Feria; Pirámide,
// Nave espacial y Arrecife), los objetos nuevos y el combo de dúo (dos compañeros con su especial juntos).
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

// Bolitas Bros en equipos (el Jugador 1 con una compu de su lado contra las otras) en un escenario.
async function startSmashTeams(p, stage) {
  await p.openGameCard('Bolitas Bros');
  await p.page.waitForFunction(() => window.leogames.scene.isActive('SmashSelect'), null, { timeout: ms(8000) });
  await p.page.evaluate((st) => {
    const s = window.leogames.scene.getScene('SmashSelect');
    Object.assign(s.settings, { mode: 'equipos', stage: st, cpus: 3, items: true });
    s.fixCpus();
    s.refreshOptions();
    s.layoutCards();
  }, stage);
  await p.tap(0, BUTTON.A);
  await fightOn(p, stage);
}

const fightOn = (p, stage) =>
  p.until(
    new Function(`const s = window.leogames.scene.getScene('Smash'); return s.sys.isActive() && s.phase === 'fight' && s.settings.stage === '${stage}';`),
    ms(20000),
    `pelear en ${stage}`,
  );

// Otra pelea en otro escenario (como la revancha, sin salir).
async function switchStage(p, stage) {
  await p.page.evaluate((st) => {
    const s = window.leogames.scene.getScene('Smash');
    s.scene.restart({ ...s.returnData, rematch: true, settings: { ...s.settings, stage: st } });
  }, stage);
  await fightOn(p, stage);
  await quiet(p);
}

// La compu se queda quieta (para acomodar a los peleadores).
const quiet = (p) =>
  p.page.evaluate(() => {
    window.leogames.scene.getScene('Smash').cpuInput = () => ({
      x: 0,
      y: 0,
      jump: false,
      attack: false,
      attackHeld: false,
      special: false,
      shield: false,
      transform: false,
    });
  });

// Pone al Jugador 1 en el piso mirando a la derecha y a un rival enfrente (a `gap` entre orillas), sin daño.
const faceOff = (p, gap = 10) =>
  p.page.evaluate((g) => {
    const s = window.leogames.scene.getScene('Smash');
    const me = s.fighters[0];
    const rival = s.fighters.find((f) => f.team !== me.team);
    const place = (f, x, facing) =>
      Object.assign(f, {
        x,
        y: s.main.top - f.radius,
        vx: 0,
        vy: 0,
        facing,
        grounded: true,
        platform: s.main,
        attack: null,
        hitstunMs: 0,
        stunMs: 0,
        invulnerableMs: 0,
        held: null,
        shielding: false,
        damage: 0,
        cooldownMs: 0,
        wetMs: 0,
        pieMs: 0,
      });
    for (const f of s.fighters) if (f !== me && f !== rival) place(f, 500, 1);
    place(me, 900, 1);
    place(rival, 900 + me.radius + rival.radius + g, -1);
    s.items.list.forEach((item) => item.sprite.destroy());
    s.items.list = [];
    s.projectiles.forEach((shot) => shot.sprite.destroy());
    s.projectiles = [];
  }, gap);

test('bolitas bros: granja, tren y feria con su sorpresa, objetos nuevos y combo de dúo', { timeout: ms(240000) }, async () => {
  const p = await openPage(game);
  await p.joinPlayers(1);
  await startSmashTeams(p, 'granja');
  await quiet(p);
  const teams = await p.page.evaluate(() => window.leogames.scene.getScene('Smash').fighters.map((f) => f.team));
  assert.ok(teams.filter((t) => t === teams[0]).length >= 2, `el Jugador 1 no tiene compañero (${teams})`);

  // La Granja: pasa el tractor por el piso y se va.
  await p.page.evaluate(() => (window.leogames.scene.getScene('Smash').events.waitMs = 0));
  await p.until(() => window.leogames.scene.getScene('Smash').events.active?.thing, ms(4000), 'que salga el tractor');
  await p.until(
    () => {
      const e = window.leogames.scene.getScene('Smash').events;
      return e.count >= 1 && !e.active;
    },
    ms(15000),
    'que pase el tractor',
  );

  // Combo de dúo: Dragoncito (fuego) y Pingüino (hielo) usan su especial juntos = vapor que marea al rival.
  await faceOff(p, 60);
  const duo = await p.page.evaluate(() => {
    const s = window.leogames.scene.getScene('Smash');
    const me = s.fighters[0];
    const mate = s.fighters.find((f) => f !== me && f.team === me.team);
    me.characterKey = 'dragon';
    mate.characterKey = 'pinguino';
    Object.assign(mate, {
      x: 760,
      y: s.main.top - mate.radius,
      vx: 0,
      vy: 0,
      facing: 1,
      grounded: true,
      platform: s.main,
      attack: null,
      cooldownMs: 0,
      hitstunMs: 0,
      stunMs: 0,
    });
    mate.startSpecial({ x: 0, y: 0 });
    me.startSpecial({ x: 0, y: 0 });
    return { count: s.duoCount, banner: s.banner.text };
  });
  assert.equal(duo.count, 1, 'no salió el combo de dúo');
  assert.ok(duo.banner.includes('Vapor'), `el combo no es el vapor (${duo.banner})`);
  await p.until(
    () => {
      const s = window.leogames.scene.getScene('Smash');
      const r = s.fighters.find((f) => f.team !== s.fighters[0].team);
      return r.damage > 0;
    },
    ms(3000),
    'que el combo le pegue al rival',
  );
  assert.ok((await stickers(p.page)).includes('smash-duo'), 'falta la calcomanía del combo de dúo');

  // Objetos nuevos. El pastel: al rival le tapa la cara (no puede pegar).
  await p.wait(ms(1500));
  await faceOff(p, 120);
  await p.page.evaluate(() => window.leogames.scene.getScene('Smash').fighters[0].grab('pie'));
  await p.tap(0, BUTTON.X);
  await p.until(
    () => {
      const s = window.leogames.scene.getScene('Smash');
      return s.fighters.some((f) => f.team !== s.fighters[0].team && f.pieMs > 0);
    },
    ms(3000),
    'darle un pastelazo',
  );

  // El globo de agua: cae junto al rival y lo moja (se resbala).
  await faceOff(p, 290);
  await p.page.evaluate(() => window.leogames.scene.getScene('Smash').fighters[0].grab('waterballoon'));
  await p.tap(0, BUTTON.X);
  await p.until(
    () => {
      const s = window.leogames.scene.getScene('Smash');
      return s.fighters.some((f) => f.team !== s.fighters[0].team && f.wetMs > 0);
    },
    ms(3000),
    'mojar al rival',
  );

  // El imán: jala al rival hacia ti.
  await faceOff(p, 330);
  const before = await p.page.evaluate(() => {
    const s = window.leogames.scene.getScene('Smash');
    return s.fighters.find((f) => f.team !== s.fighters[0].team).x;
  });
  await p.page.evaluate(() => window.leogames.scene.getScene('Smash').fighters[0].grab('magnet'));
  await p.tap(0, BUTTON.X);
  await p.until(
    new Function(`const s = window.leogames.scene.getScene('Smash'); return s.fighters.find((f) => f.team !== s.fighters[0].team).x < ${before} - 100;`),
    ms(3000),
    'jalar al rival con el imán',
  );

  // El paraguas: en el aire cae despacito.
  const fall = await p.page.evaluate(async () => {
    const s = window.leogames.scene.getScene('Smash');
    const me = s.fighters[0];
    me.grab('umbrella');
    Object.assign(me, { x: 1000, y: s.main.top - 500, vx: 0, vy: 0, grounded: false, platform: null, hitstunMs: 0 });
    await new Promise((resolve) => setTimeout(resolve, 500));
    return { vy: me.vy, open: me.umbrellaMs > 0 };
  });
  assert.ok(fall.open && fall.vy <= 171, `el paraguas no frena la caída (vy ${fall.vy})`);

  // El Tren: el túnel se lleva al que está en las cajas, y al que está en el techo del vagón no le pasa nada.
  await switchStage(p, 'tren');
  await p.page.evaluate(() => {
    const s = window.leogames.scene.getScene('Smash');
    const me = s.fighters[0];
    const crate = s.platforms.find((pl) => pl.look === 'crate');
    for (const f of s.fighters) {
      const onCrate = f.team !== me.team;
      const x = onCrate ? (crate.left + crate.right) / 2 : 1300;
      const platform = onCrate ? crate : s.main;
      Object.assign(f, { x, y: platform.top - f.radius, vx: 0, vy: 0, grounded: true, platform, damage: 0, invulnerableMs: 0, hitstunMs: 0 });
    }
    s.events.waitMs = 0;
  });
  await p.until(
    () => {
      const s = window.leogames.scene.getScene('Smash');
      return s.fighters.some((f) => f.team !== s.fighters[0].team && f.damage > 0);
    },
    ms(8000),
    'que el túnel se lleve al de las cajas',
  );
  assert.equal(await p.page.evaluate(() => window.leogames.scene.getScene('Smash').fighters[0].damage), 0, 'el túnel le pegó al que estaba en el techo');

  // La Feria: las canastillas de la rueda dan vueltas y cruza la montaña rusa.
  await switchStage(p, 'feria');
  const cabin = () =>
    p.page.evaluate(() => {
      const c = window.leogames.scene.getScene('Smash').platforms.find((pl) => pl.look === 'cabin');
      return [c.left, c.top];
    });
  const start = await cabin();
  await p.wait(ms(800));
  assert.notDeepEqual(await cabin(), start, 'la rueda de la fortuna no se mueve');
  await p.page.evaluate(() => (window.leogames.scene.getScene('Smash').events.waitMs = 0));
  await p.until(
    () => {
      const e = window.leogames.scene.getScene('Smash').events;
      return e.count >= 1 && !e.active;
    },
    ms(15000),
    'que pase la montaña rusa',
  );
  assert.ok((await stickers(p.page)).includes('smash-paseo'), 'falta la calcomanía de los escenarios nuevos');

  // Al final, en los premios sale quién hizo combos de dúo (se hace uno más aquí).
  await p.page.evaluate(() => {
    const s = window.leogames.scene.getScene('Smash');
    const me = s.fighters[0];
    const mate = s.fighters.find((f) => f !== me && f.team === me.team);
    for (const f of [me, mate])
      Object.assign(f, {
        x: f === me ? 900 : 800,
        y: s.main.top - f.radius,
        grounded: true,
        platform: s.main,
        attack: null,
        cooldownMs: 0,
        hitstunMs: 0,
        stunMs: 0,
      });
    mate.startSpecial({ x: 0, y: 0 });
    me.startSpecial({ x: 0, y: 0 });
  });
  await p.wait(ms(1500));
  await p.page.evaluate(() => {
    const s = window.leogames.scene.getScene('Smash');
    for (const f of s.players) if (f.team !== s.fighters[0].team) f.stocks = 0;
  });
  await p.until(() => window.leogames.scene.getScene('Smash').phase === 'end', ms(8000), 'terminar la pelea');
  assert.ok(
    await p.page.evaluate(() => window.leogames.scene.getScene('Smash').results.list.some((o) => o.text?.includes('Combos de dúo'))),
    'sin el premio de combos de dúo',
  );
  await p.holdToMenu(0, EXIT, 'salir de Bolitas Bros');
  assert.deepEqual(p.errors, []);
  await p.context.close();
});

test('duelo de bolitas: pirámide, nave y arrecife, objetos nuevos y combo de dúo en el 2 contra 2', { timeout: ms(240000) }, async () => {
  const p = await openPage(game);
  await p.joinPlayers(1);
  await p.openGameCard('Duelo de bolitas');
  await p.pickCharacters(1);
  await p.until(() => window.leogames.scene.getScene('Duelo')?.phase === 'setup', ms(8000), 'ver la pantalla del duelo');
  await p.page.evaluate(() => {
    const s = window.leogames.scene.getScene('Duelo');
    Object.assign(s.setup, { mode: 'equipos', arena: 'piramide', items: false, twists: false });
    s.refreshSetup();
  });
  await p.tap(0, BUTTON.A);
  const fighting = () => p.until(() => window.leogames.scene.getScene('Duelo').phase === 'fight', ms(15000), 'empezar a pelear');
  // La compu se queda quieta (muñecos) para acomodar a todos.
  const still = () => p.page.evaluate(() => window.leogames.scene.getScene('Duelo').fighters.forEach((f) => f.isCpu && (f.dummy = true)));
  await fighting();
  await still();
  assert.deepEqual(await p.page.evaluate(() => window.leogames.scene.getScene('Duelo').fighters.map((f) => f.team)), [0, 0, 1, 1]);

  // La Pirámide: salen arenas movedizas y el que se para encima se hunde.
  await p.page.evaluate(() => window.leogames.scene.getScene('Duelo').arenaEvents.trigger());
  await p.until(() => window.leogames.scene.getScene('Duelo').arenaEvents.active?.t > 1300, ms(5000), 'que salgan las arenas movedizas');
  await p.page.evaluate(() => {
    const s = window.leogames.scene.getScene('Duelo');
    s.fighters[0].x = s.arenaEvents.active.x;
  });
  await p.until(() => window.leogames.scene.getScene('Duelo').fighters[0].sandMs > 0, ms(3000), 'hundirse en la arena');

  // Combo de dúo: Robot (rayo) y Bombero (agua) usan su especial juntos = descarga eléctrica a los rivales.
  const duo = await p.page.evaluate(() => {
    const s = window.leogames.scene.getScene('Duelo');
    const [me, mate, a, b] = s.fighters;
    me.character = 'robot';
    mate.character = 'bombero';
    me.reset(300, 1);
    mate.reset(480, 1);
    a.reset(760, -1);
    b.reset(900, -1);
    mate.startSpecial();
    me.startSpecial();
    return { count: s.duoCounts[0], banner: s.banner.text };
  });
  assert.equal(duo.count, 1, 'no salió el combo de dúo');
  assert.ok(duo.banner.includes('Descarga'), `el combo no es la descarga (${duo.banner})`);
  await p.until(
    () =>
      window.leogames.scene
        .getScene('Duelo')
        .fighters.slice(2)
        .every((f) => f.health < f.maxHealth),
    ms(3000),
    'que la descarga les pegue a los dos rivales',
  );
  assert.ok((await stickers(p.page)).includes('duelo-duo'), 'falta la calcomanía del combo de dúo');

  // La Nave espacial: se abre la compuerta y casi no hay gravedad un rato (luego regresa).
  await p.page.evaluate(() => {
    const s = window.leogames.scene.getScene('Duelo');
    s.setup.arena = 'nave';
    s.startMatch();
  });
  await fighting();
  await still();
  const gravity = await p.page.evaluate(() => window.leogames.scene.getScene('Duelo').fighters[0].gravity);
  await p.page.evaluate(() => window.leogames.scene.getScene('Duelo').arenaEvents.trigger());
  await p.until(new Function(`return window.leogames.scene.getScene('Duelo').fighters[0].gravity < ${gravity} * 0.5;`), ms(5000), 'quedarse sin gravedad');
  await p.until(
    new Function(`const s = window.leogames.scene.getScene('Duelo'); return !s.arenaEvents.active && s.fighters[0].gravity === ${gravity};`),
    ms(8000),
    'que regrese la gravedad',
  );

  // Objetos nuevos (sin esperar a que caigan): el pastel, la burbuja y el imán.
  const place = () =>
    p.page.evaluate(() => {
      const s = window.leogames.scene.getScene('Duelo');
      const [me, mate, a, b] = s.fighters;
      me.reset(300, 1);
      mate.reset(120, 1);
      a.reset(600, -1);
      b.reset(1100, -1);
      s.clearShots();
    });
  await place();
  await p.page.evaluate(() => {
    const s = window.leogames.scene.getScene('Duelo');
    s.onItem(s.fighters[0], 'pie');
  });
  await p.until(() => window.leogames.scene.getScene('Duelo').fighters[2].pieMs > 0, ms(3000), 'darle un pastelazo');
  await place();
  await p.page.evaluate(() => {
    const s = window.leogames.scene.getScene('Duelo');
    s.onItem(s.fighters[0], 'bubble');
  });
  await p.until(() => window.leogames.scene.getScene('Duelo').fighters[2].trapMs > 0, ms(3000), 'atraparlo en la burbuja');
  await p.until(
    () => {
      const f = window.leogames.scene.getScene('Duelo').fighters[2];
      return f.trapMs === 0 && f.y >= 650;
    },
    ms(5000),
    'que se reviente la burbuja y caiga',
  );
  await place();
  await p.page.evaluate(() => {
    const s = window.leogames.scene.getScene('Duelo');
    s.onItem(s.fighters[0], 'magnet');
  });
  await p.until(() => window.leogames.scene.getScene('Duelo').fighters[2].x < 500, ms(3000), 'jalar al rival con el imán');

  // El Arrecife: la corriente empuja a todos hacia un lado.
  await p.page.evaluate(() => {
    const s = window.leogames.scene.getScene('Duelo');
    s.setup.arena = 'arrecife';
    s.startMatch();
  });
  await fighting();
  await still();
  const x0 = await p.page.evaluate(() => window.leogames.scene.getScene('Duelo').fighters[0].x);
  await p.page.evaluate(() => window.leogames.scene.getScene('Duelo').arenaEvents.trigger());
  await p.until(new Function(`return Math.abs(window.leogames.scene.getScene('Duelo').fighters[0].x - ${x0}) > 40;`), ms(6000), 'que la corriente lo empuje');

  // La compu de tu equipo te acompaña: usas tu especial cerquita de ella y ella usa el suyo (con suerte: aquí siempre;
  // la suerte se arregla solo mientras decide, porque con Math.random fijo todo lo demás se rompe).
  await p.page.evaluate(() => {
    const s = window.leogames.scene.getScene('Duelo');
    const [me, mate] = s.fighters;
    me.reset(300, 1);
    mate.reset(460, 1);
    const random = Math.random;
    Math.random = () => 0;
    try {
      me.startSpecial();
    } finally {
      Math.random = random;
    }
  });
  await p.until(() => window.leogames.scene.getScene('Duelo').duoCounts[0] === 1, ms(4000), 'que la compu haga el combo de dúo contigo');
  await p.holdToMenu(0, EXIT, 'salir del duelo');
  assert.deepEqual(p.errors, []);
  await p.context.close();
});
