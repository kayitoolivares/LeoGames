import { controls } from '../../shared/controls.js';
import { players } from '../../shared/players.js';
import { settings } from '../../shared/settings.js';
import { sfx } from '../../shared/sound.js';
import { say } from '../../shared/voice.js';
import { COLORS, TEXT, textStyle } from '../../ui/style.js';
import { ARENA } from './arena.js';
import { burst, popText } from './effects.js';

// Defiende la base (cooperativo, oleadas sin fin): en medio hay una casita con vida y muchos monstruos van por ella
// desde los dos lados. Entre oleadas las monedas del piso se juntan solas y se compran defensas con un menú sencillo:
// barricadas (detienen a los monstruos hasta que las rompen; los que vuelan pasan por arriba), torrecitas (disparan
// solas), resortes (avientan lejos al que los pisa) o reparar la base. Cada 5 oleadas llega un jefe. Se guarda el
// récord de oleadas. La escena usa `base` como el nido: los monstruos que van por ella le pegan (ver nestHit).
export const BASE_HP = 20;
export const BASE_START_COINS = 6;
export const BASE_WAVE_BONUS = 2;
export const BASE_STICKER_AT = 10;
const RAID_CHANCE = 0.65;
// El menú de defensas: cuánto dura (luego empieza la oleada sola) y cuánto espera antes de aceptar botones (para que
// un salto de la pelea no compre nada).
const BUILD_MS = 25000;
const MENU_DELAY_MS = 600;
const RECORD_KEY = 'brawlBase';
const DEPTH = 10003;
// El centro del menú (arriba, debajo de los corazones).
const MENU_Y = 212;
const BAR = { half: 14, hp: 8, hitMs: 900, bossDamage: 3, posts: 4 };
const TOWER = { everyMs: 1300, range: 480, boltSpeed: 650, firstMs: 600 };
const SPRING = { rx: 44, ry: 24, uses: 10, cooldownMs: 400, damage: 1, power: 2.6 };
const REPAIR_HP = 5;
const WOOD = 0xb07a45;
const WOOD_DARK = 0x8b5a2b;

export const baseRecord = {
  get() {
    return settings.get(RECORD_KEY, 0);
  },
  // Devuelve true si es récord nuevo.
  save(waves) {
    if (waves <= this.get()) return false;
    settings.set(RECORD_KEY, waves);
    return true;
  },
};

// Lo que se puede comprar entre oleadas.
export const BUILD_ITEMS = [
  { key: 'barricada', emoji: '🪵', name: 'Barricada', cost: 4, text: 'Detiene a los monstruos hasta que la rompen (los que vuelan pasan por arriba)' },
  { key: 'torrecita', emoji: '🗼', name: 'Torrecita', cost: 8, text: 'Dispara sola a los monstruos que se acercan' },
  { key: 'resorte', emoji: '🌀', name: 'Resorte', cost: 5, text: 'Avienta lejos al monstruo que lo pisa' },
  { key: 'reparar', emoji: '🔧', name: 'Reparar', cost: 3, text: `La base recupera ${REPAIR_HP} de vida` },
  { key: 'listos', emoji: '▶️', name: '¡Listos!', cost: 0, text: '¡Que venga la siguiente oleada!' },
];

function propTexture(scene, name) {
  const key = `brawl:objeto-${name}`;
  return scene.textures.exists(key) ? key : null;
}

export class BaseDefense {
  constructor(scene) {
    this.scene = scene;
    const x = (ARENA.left + ARENA.right) / 2;
    const y = (ARENA.top + ARENA.bottom) / 2 + 20;
    this.base = { x, y, radius: 70, hp: BASE_HP, maxHp: BASE_HP, down: false, isNest: true, isBase: true, raidChance: RAID_CHANCE };
    this.coins = BASE_START_COINS;
    this.barricades = [];
    this.towers = [];
    this.springs = [];
    this.bolts = [];
    this.menu = null;
    // Dónde va cada defensa (se llenan en orden, un lado y luego el otro).
    this.slots = {
      barricada: [
        { x: x - 380, side: -1 },
        { x: x + 380, side: 1 },
        { x: x - 230, side: -1 },
        { x: x + 230, side: 1 },
      ],
      torrecita: [
        { x: x - 125, y: ARENA.top + 15 },
        { x: x + 125, y: ARENA.bottom - 10 },
        { x: x + 125, y: ARENA.top + 15 },
        { x: x - 125, y: ARENA.bottom - 10 },
      ],
      resorte: [
        { x: x - 305, y: ARENA.top + 80 },
        { x: x + 305, y: ARENA.bottom - 70 },
        { x: x + 305, y: ARENA.top + 80 },
        { x: x - 305, y: ARENA.bottom - 70 },
      ],
    };
    this.drawBase();
  }

  // ---------- La casita ----------

  // Con dibujo (objeto "base"), la imagen; si no, una casita con techo rojo, puerta y bandera. Arriba, su barra de vida.
  drawBase() {
    const scene = this.scene;
    const { x, y } = this.base;
    const parts = [];
    const key = propTexture(scene, 'base');
    if (key) {
      const image = scene.add.image(0, 40, key).setOrigin(0.5, 1);
      image.setScale(170 / Math.max(image.width, image.height));
      parts.push(image);
    } else {
      const roof = scene.add.graphics();
      roof.fillStyle(0xe53935, 1);
      roof.lineStyle(5, COLORS.ink, 1);
      roof.fillTriangle(-82, -52, 82, -52, 0, -122);
      roof.strokeTriangle(-82, -52, 82, -52, 0, -122);
      const flag = scene.add.graphics();
      flag.lineStyle(4, COLORS.ink, 1);
      flag.lineBetween(0, -122, 0, -170);
      flag.fillStyle(0xffd84d, 1);
      flag.fillTriangle(0, -170, 34, -160, 0, -148);
      parts.push(
        scene.add.rectangle(0, -6, 130, 92, 0xf4e3c1).setStrokeStyle(5, COLORS.ink),
        roof,
        flag,
        scene.add.rectangle(0, 16, 34, 48, WOOD_DARK).setStrokeStyle(4, COLORS.ink),
        scene.add.rectangle(-42, -18, 26, 24, 0x7fdcff).setStrokeStyle(4, COLORS.ink),
        scene.add.rectangle(42, -18, 26, 24, 0x7fdcff).setStrokeStyle(4, COLORS.ink),
      );
    }
    this.hpBar = scene.add.rectangle(-58, -190, 116, 12, 0x4cd97b).setOrigin(0, 0.5);
    parts.push(scene.add.rectangle(0, -190, 124, 20, COLORS.ink), this.hpBar);
    this.baseSprite = scene.add.container(x, y, parts).setDepth(y);
  }

  // Le pegan a la base: devuelve true si ya no aguanta.
  hitBase(amount) {
    const base = this.base;
    base.hp = Math.max(0, base.hp - amount);
    this.refreshBase();
    this.scene.tweens.add({
      targets: this.baseSprite,
      angle: { from: -2, to: 2 },
      duration: 60,
      yoyo: true,
      repeat: 1,
      onComplete: () => this.baseSprite.setAngle(0),
    });
    if (base.hp <= 0) base.down = true;
    return base.down;
  }

  refreshBase() {
    const base = this.base;
    this.hpBar.setScale(Math.max(0, base.hp / base.maxHp), 1);
    this.hpBar.setFillStyle(base.hp > base.maxHp / 3 ? 0x4cd97b : 0xff5a5f);
  }

  // ---------- Comprar y poner defensas ----------

  // Compra `item`. Devuelve null si se pudo, o por qué no.
  buy(item) {
    if (item.key === 'reparar' && this.base.hp >= this.base.maxHp) return '¡La base está completita!';
    if (this.coins < item.cost) return '¡Faltan monedas!';
    const slot = item.key === 'reparar' ? null : this.freeSlot(item.key);
    if (item.key !== 'reparar' && !slot) return '¡Ya no caben más!';
    this.coins -= item.cost;
    if (item.key === 'reparar') this.repair();
    else if (item.key === 'barricada') this.addBarricade(slot);
    else if (item.key === 'torrecita') this.addTower(slot);
    else this.addSpring(slot);
    return null;
  }

  listFor(key) {
    return { barricada: this.barricades, torrecita: this.towers, resorte: this.springs }[key];
  }

  freeSlot(key) {
    const used = new Set(this.listFor(key).map((d) => d.slot));
    return this.slots[key].find((s) => !used.has(s)) ?? null;
  }

  repair() {
    this.base.hp = Math.min(this.base.maxHp, this.base.hp + REPAIR_HP);
    this.refreshBase();
    burst(this.scene, this.base.x, this.base.y - 60, 0x4cd97b, 12);
    popText(this.scene, this.base.x, this.base.y - 150, `+${REPAIR_HP} 🔧`, '#4cd97b');
  }

  // La barricada: una fila de postes de madera de arriba a abajo (con dibujo, la imagen "barricada" en cada poste).
  addBarricade(slot) {
    const scene = this.scene;
    const { top, bottom } = ARENA;
    const key = propTexture(scene, 'barricada');
    const rail = scene.add.graphics().setDepth(top - 30);
    rail.lineStyle(12, WOOD_DARK, 1);
    rail.lineBetween(slot.x, top - 50, slot.x, bottom - 30);
    const posts = [];
    for (let k = 0; k < BAR.posts; k += 1) {
      const y = top - 10 + (k * (bottom - top + 20)) / (BAR.posts - 1);
      let post;
      if (key) {
        post = scene.add.image(slot.x, y, key).setOrigin(0.5, 1);
        post.setScale(110 / Math.max(post.width, post.height));
      } else {
        const tip = scene.add.graphics();
        tip.fillStyle(WOOD, 1);
        tip.lineStyle(4, COLORS.ink, 1);
        tip.fillTriangle(-13, -70, 13, -70, 0, -90);
        tip.strokeTriangle(-13, -70, 13, -70, 0, -90);
        post = scene.add.container(slot.x, y, [
          scene.add.rectangle(0, -35, 26, 70, WOOD).setStrokeStyle(4, COLORS.ink),
          tip,
          scene.add.rectangle(0, -48, 44, 10, WOOD_DARK).setStrokeStyle(3, COLORS.ink),
        ]);
      }
      post.setDepth(y);
      posts.push(post);
      scene.tweens.add({ targets: post, scaleY: { from: 0, to: post.scaleY }, duration: 260, delay: k * 60, ease: 'Back.easeOut' });
    }
    this.barricades.push({ slot, x: slot.x, side: slot.side, hp: BAR.hp, maxHp: BAR.hp, posts, parts: [rail, ...posts] });
    popText(scene, slot.x, (top + bottom) / 2, '¡Barricada!', '#ffd84d');
  }

  // La torrecita: de piedra, con almenas y una ventanita (con dibujo, la imagen "torrecita").
  addTower(slot) {
    const scene = this.scene;
    const key = propTexture(scene, 'torrecita');
    let sprite;
    if (key) {
      sprite = scene.add.image(slot.x, slot.y, key).setOrigin(0.5, 1);
      sprite.setScale(120 / Math.max(sprite.width, sprite.height));
    } else {
      sprite = scene.add.container(slot.x, slot.y, [
        scene.add.rectangle(0, -42, 52, 84, 0xa8a8b8).setStrokeStyle(4, COLORS.ink),
        ...[-18, 0, 18].map((dx) => scene.add.rectangle(dx, -90, 13, 14, 0xa8a8b8).setStrokeStyle(3, COLORS.ink)),
        scene.add.circle(0, -52, 10, COLORS.ink),
        scene.add.rectangle(0, -14, 20, 26, WOOD_DARK).setStrokeStyle(3, COLORS.ink),
      ]);
    }
    sprite.setDepth(slot.y);
    scene.tweens.add({ targets: sprite, scaleY: { from: 0, to: sprite.scaleY }, duration: 300, ease: 'Back.easeOut' });
    this.towers.push({ slot, x: slot.x, y: slot.y - 60, cooldownMs: TOWER.firstMs, sprite, parts: [sprite] });
    popText(scene, slot.x, Math.max(ARENA.top + 40, slot.y - 130), '¡Torrecita!', '#ffd84d');
  }

  // El resorte: un cojín rojo con espirales (con dibujo, la imagen "resorte").
  addSpring(slot) {
    const scene = this.scene;
    const key = propTexture(scene, 'resorte');
    let sprite;
    if (key) {
      sprite = scene.add.image(slot.x, slot.y + 10, key).setOrigin(0.5, 1);
      sprite.setScale(80 / Math.max(sprite.width, sprite.height));
    } else {
      sprite = scene.add.container(slot.x, slot.y, [
        scene.add.ellipse(0, 0, SPRING.rx * 2, SPRING.ry * 1.6, 0xe53935).setStrokeStyle(4, COLORS.ink),
        ...[0, 1, 2].map((k) => scene.add.ellipse(0, -10 - k * 9, SPRING.rx * 1.3, 10, 0x000000, 0).setStrokeStyle(4, 0xc0c4d0)),
      ]);
    }
    sprite.setDepth(slot.y - 1);
    this.springs.push({ slot, x: slot.x, y: slot.y, uses: SPRING.uses, cooldownMs: 0, sprite, parts: [sprite] });
    popText(scene, slot.x, slot.y - 80, '¡Resorte!', '#ffd84d');
  }

  // ---------- Cada cuadro (peleando) ----------

  update(dtMs, monsters) {
    this.updateBarricades(dtMs, monsters);
    this.updateSprings(dtMs, monsters);
    this.updateTowers(dtMs, monsters);
    this.updateBolts(dtMs);
  }

  // Los que vienen de afuera se quedan pegados a la barricada y le pegan hasta romperla (los jefes, más fuerte). Los
  // que vuelan, los agarrados y los aventados pasan.
  updateBarricades(dtMs, monsters) {
    for (const m of monsters) {
      const lastX = m.baseLastX ?? m.x;
      const passes = m.dead || m.grabbedBy || m.state === 'thrown' || m.type.fly;
      let blocked = null;
      if (!passes) {
        for (const b of this.barricades) {
          const wasOutside = (lastX - b.x) * b.side > 0;
          const stop = b.x + b.side * (BAR.half + m.radius * 0.6);
          if (!wasOutside || (m.x - stop) * b.side >= 0) continue;
          m.x = stop;
          blocked = b;
          break;
        }
      }
      if (blocked) {
        m.barricadeMs = (m.barricadeMs ?? 0) + dtMs;
        if (m.barricadeMs >= BAR.hitMs) {
          m.barricadeMs = 0;
          this.hitBarricade(blocked, m.type.boss ? BAR.bossDamage : 1, m);
        }
      } else {
        m.barricadeMs = 0;
      }
      m.baseLastX = m.x;
    }
  }

  hitBarricade(b, damage, monster) {
    b.hp -= damage;
    monster.taunt?.(500);
    popText(this.scene, b.x, monster.y - 70, '¡Crac!', '#ffb36b');
    sfx.block();
    for (const post of b.posts) post.setAlpha(0.45 + 0.55 * Math.max(0, b.hp / b.maxHp));
    if (b.hp > 0) return;
    // Se rompe: astillas y se quita (su lugar queda libre para otra).
    for (const post of b.posts) burst(this.scene, post.x, post.y - 40, WOOD, 6);
    for (const part of b.parts) part.destroy();
    this.barricades = this.barricades.filter((other) => other !== b);
    sfx.shieldBreak();
    this.scene.barricadeBroken?.();
  }

  updateSprings(dtMs, monsters) {
    for (const s of this.springs) {
      s.cooldownMs = Math.max(0, s.cooldownMs - dtMs);
      if (s.cooldownMs > 0) continue;
      const m = monsters.find(
        (o) => !o.dead && !o.grabbedBy && o.state !== 'thrown' && !o.type.fly && ((o.x - s.x) / SPRING.rx) ** 2 + ((o.y - s.y) / SPRING.ry) ** 2 < 1,
      );
      if (!m) continue;
      s.cooldownMs = SPRING.cooldownMs;
      s.uses -= 1;
      // Lejos de la base.
      m.hurt(this.base.x, SPRING.damage, SPRING.power);
      this.scene.tweens.add({ targets: s.sprite, scaleY: s.sprite.scaleY * 0.5, duration: 80, yoyo: true });
      popText(this.scene, s.x, s.y - 70, '¡Boing!', '#ffd84d');
      sfx.boing();
      if (s.uses > 0) continue;
      burst(this.scene, s.x, s.y - 10, 0xe53935, 8);
      for (const part of s.parts) part.destroy();
      this.springs = this.springs.filter((other) => other !== s);
    }
  }

  // Cada torrecita le dispara al monstruo más cercano que esté a su alcance (la bolita lo sigue).
  updateTowers(dtMs, monsters) {
    for (const t of this.towers) {
      t.cooldownMs -= dtMs;
      if (t.cooldownMs > 0) continue;
      let target = null;
      let best = TOWER.range;
      for (const m of monsters) {
        const d = Math.hypot(m.x - t.x, m.y - t.y);
        if (!m.dead && m.entered && !m.grabbedBy && d < best) [target, best] = [m, d];
      }
      if (!target) continue;
      t.cooldownMs = TOWER.everyMs;
      const sprite = this.scene.add.container(t.x, t.y, [
        this.scene.add.circle(0, 0, 14, 0xffd84d, 0.4),
        this.scene.add.circle(0, 0, 8, 0xffffff).setStrokeStyle(3, 0xff9a3c),
      ]);
      sprite.setDepth(t.y + 200);
      this.bolts.push({ x: t.x, y: t.y, target, tx: target.x, ty: target.y - target.radius * 0.5, sprite });
      sfx.throw();
    }
  }

  updateBolts(dtMs) {
    const step = TOWER.boltSpeed * (dtMs / 1000);
    this.bolts = this.bolts.filter((bolt) => {
      const target = bolt.target;
      if (target && !target.dead) {
        bolt.tx = target.x;
        bolt.ty = target.y - target.radius * 0.5;
      }
      const dx = bolt.tx - bolt.x;
      const dy = bolt.ty - bolt.y;
      const d = Math.hypot(dx, dy);
      if (d <= Math.max(step, 12)) {
        if (target && !target.dead) this.scene.towerHit?.(target, bolt.tx);
        bolt.sprite.destroy();
        return false;
      }
      bolt.x += (dx / d) * step;
      bolt.y += (dy / d) * step;
      bolt.sprite.setPosition(bolt.x, bolt.y);
      return true;
    });
  }

  // ---------- El menú entre oleadas ----------

  // Las tarjetas de lo que se puede comprar, arriba (sobre el cielo, para que se vea la base), con las monedas y el
  // reloj.
  openMenu(nextWave, first) {
    this.closeMenu();
    const scene = this.scene;
    const { width } = scene.scale;
    const root = scene.add.container(0, 0).setDepth(DEPTH).setScrollFactor(0);
    const outline = { fontStyle: 'bold', stroke: '#1b1530', strokeThickness: 6 };
    root.add(scene.add.rectangle(width / 2, MENU_Y, width, 236, 0x14112b, 0.85));
    const title = first ? '¡Pongan sus defensas!' : `¡Prepárense para la oleada ${nextWave}!`;
    root.add(scene.add.text(width / 2, MENU_Y - 90, title, textStyle(30, TEXT.accent, outline)).setOrigin(0.5));
    this.coinText = scene.add.text(width - 30, MENU_Y - 90, '', textStyle(28, '#ffd84d', outline)).setOrigin(1, 0.5);
    this.timerText = scene.add.text(30, MENU_Y - 90, '', textStyle(24, '#ffffff', outline)).setOrigin(0, 0.5);
    root.add([this.coinText, this.timerText]);
    const cards = BUILD_ITEMS.map((item, i) => {
      const card = scene.add.container(width / 2 + (i - 2) * 192, MENU_Y - 10);
      const bg = scene.add.rectangle(0, 0, 172, 104, COLORS.panel).setRounded(18).setStrokeStyle(4, COLORS.panelBorder);
      card.add([
        bg,
        scene.add.text(0, -24, item.emoji, textStyle(36)).setOrigin(0.5),
        scene.add.text(0, 16, item.name, textStyle(19, '#ffffff', { fontStyle: 'bold' })).setOrigin(0.5),
        scene.add.text(0, 39, item.cost ? `💰 ${item.cost}` : '', textStyle(16, '#ffd84d', { fontStyle: 'bold' })).setOrigin(0.5),
      ]);
      root.add(card);
      return { item, card, bg };
    });
    this.infoText = scene.add.text(width / 2, MENU_Y + 62, '', textStyle(19, '#ffffff', { stroke: '#1b1530', strokeThickness: 4 })).setOrigin(0.5);
    const help = scene.add.text(
      width / 2,
      MENU_Y + 94,
      '◀ ▶ escoger   ·   A = comprar   ·   Y = ¡listos!',
      textStyle(18, TEXT.accent, { stroke: '#1b1530', strokeThickness: 4 }),
    );
    root.add([this.infoText, help.setOrigin(0.5)]);
    this.menu = { root, cards, selected: 0, ms: 0 };
    this.select(0, false);
  }

  select(index, speak = true) {
    const menu = this.menu;
    menu.selected = (index + menu.cards.length) % menu.cards.length;
    this.refreshCards();
    const { item } = menu.cards[menu.selected];
    this.infoText.setText(item.text);
    if (speak) say(item.name);
  }

  // Resalta la escogida y oscurece lo que no alcanza (o ya no cabe).
  refreshCards() {
    const menu = this.menu;
    menu.cards.forEach(({ item, card, bg }, i) => {
      const chosen = i === menu.selected;
      bg.setStrokeStyle(chosen ? 7 : 4, chosen ? 0xffd84d : COLORS.panelBorder);
      card.setScale(chosen ? 1.08 : 1);
      const blocked = item.key === 'reparar' ? this.base.hp >= this.base.maxHp : item.key !== 'listos' && !this.freeSlot(item.key);
      card.setAlpha(this.coins >= item.cost && !blocked ? 1 : 0.5);
    });
    this.coinText.setText(`💰 ${this.coins}`);
  }

  // Devuelve true cuando ya empieza la oleada (¡Listos!, Y, o se acabó el tiempo).
  updateMenu(dtMs) {
    const menu = this.menu;
    menu.ms += dtMs;
    const left = Math.max(0, BUILD_MS - menu.ms);
    const clock = `⏱️ ${Math.ceil(left / 1000)}`;
    if (this.timerText.text !== clock) this.timerText.setText(clock);
    if (left <= 0) return true;
    if (menu.ms < MENU_DELAY_MS) return false;
    for (const player of players.sorted()) {
      const id = player.deviceId;
      const step = (controls.justPressed(id, 'right') ? 1 : 0) - (controls.justPressed(id, 'left') ? 1 : 0);
      if (step !== 0) {
        this.select(menu.selected + step);
        sfx.select();
      }
      // (Y con LB + RB es salir, no "¡listos!".)
      if (controls.justPressed(id, 'y') && !controls.isDown(id, 'lb') && !controls.isDown(id, 'rb')) return true;
      if (controls.justPressed(id, 'a') && this.choose()) return true;
    }
    return false;
  }

  // A sobre una tarjeta: compra (o "¡Listos!"). Devuelve true si ya empieza la oleada.
  choose() {
    const { item, card } = this.menu.cards[this.menu.selected];
    if (item.key === 'listos') return true;
    const why = this.buy(item);
    if (why) {
      sfx.back();
      this.infoText.setText(why);
      say(why);
      this.scene.tweens.add({ targets: card, angle: { from: -4, to: 4 }, duration: 60, yoyo: true, repeat: 2, onComplete: () => card.setAngle(0) });
      return false;
    }
    sfx.coin();
    say(`¡${item.name}!`);
    this.refreshCards();
    return false;
  }

  closeMenu() {
    this.menu?.root.destroy();
    this.menu = null;
  }

  destroy() {
    this.closeMenu();
    this.baseSprite.destroy();
    for (const d of [...this.barricades, ...this.towers, ...this.springs]) d.parts.forEach((part) => part.destroy());
    for (const bolt of this.bolts) bolt.sprite.destroy();
    this.barricades = [];
    this.towers = [];
    this.springs = [];
    this.bolts = [];
  }
}
