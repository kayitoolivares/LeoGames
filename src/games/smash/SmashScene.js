import Phaser from 'phaser';
import { controls } from '../../shared/controls.js';
import { frameDelta } from '../../shared/clock.js';
import { players, PLAYER_COLORS } from '../../shared/players.js';
import { TEXT, hexToCss, textStyle } from '../../ui/style.js';
import { burst, confetti, popText } from '../brawl/effects.js';
import { CHARACTERS, CHARACTER_KEYS } from './characters.js';
import { SmashFighter, STOCKS } from './SmashFighter.js';
import { BLAST_ZONE, PLATFORMS, STAGE_FOCUS, drawStage } from './stage.js';

const SPAWN_X = [600, 1400, 850, 1150];
const COUNTDOWN_STEP_MS = 800;
const EXIT_HOLD_MS = 1200;
const END_INPUT_DELAY_MS = 1500;
const ZOOM_MIN = 0.55;
const ZOOM_MAX = 1.15;
const CAMERA_MARGIN = 220;
const STRONG_HIT_SPEED = 900;
const HIT_WORDS = ['¡PAM!', '¡ZAS!', '¡POW!', '¡BAM!'];
const IDLE = { x: 0, y: 0, jump: false, attack: false, special: false, shield: false };
// La estrella de Estrella: poco daño, pero pega de lejos.
const STAR = { speed: 700, lifeMs: 900, radius: 16, hit: { damage: 5, base: 160, scale: 5, angle: 30 } };
const OUTLINE = { stroke: '#1b1530', strokeThickness: 5 };

// "Bolitas Bros" (fase 1): pelea estilo Smash. Cada golpe sube tu %, y entre más % llevas,
// más lejos sales volando; si te sacan de la pantalla pierdes una vida. Gana el último con vidas.
// El mundo (con zoom) y los textos de pantalla usan cámaras separadas para que el zoom no mueva el marcador.
export class SmashScene extends Phaser.Scene {
  constructor() {
    super('Smash');
  }

  init(data) {
    this.returnData = data ?? {};
  }

  create() {
    const { width, height } = this.scale;
    this.cameras.main.setBackgroundColor(0x7ec8f0);
    this.world = this.add.container(0, 0);
    this.ui = this.add.container(0, 0);
    this.uiCam = this.cameras.add(0, 0, width, height);
    this.cameras.main.ignore(this.ui);
    this.uiCam.ignore(this.world);

    drawStage(this, this.world);
    this.stars = [];
    this.fighters = this.createFighters();
    this.createHud();
    this.phase = 'countdown';
    this.phaseMs = 0;
    this.exitMs = 0;
    this.exiting = false;
    this.cam = { x: 1000, y: 600, zoom: 0.8 };
    this.updateCamera(0, true);
    this.input.keyboard?.on('keydown-ESC', () => this.exit());
  }

  // Los jugadores con el personaje que escogieron; si solo hay uno, se agrega un CPU al azar.
  createFighters() {
    const humans = players.sorted();
    const picks = this.returnData.picks ?? {};
    const list = humans.map(
      (player) =>
        new SmashFighter(this, this.world, {
          color: players.color(player).hex,
          label: `J${player.slot + 1}`,
          deviceId: player.deviceId,
          character: picks[player.deviceId] ?? CHARACTER_KEYS[player.slot % CHARACTER_KEYS.length],
        }),
    );
    if (list.length < 2) {
      const taken = new Set(humans.map((player) => player.colorIndex));
      const color = PLAYER_COLORS.find((_, i) => !taken.has(i)).hex;
      const character = CHARACTER_KEYS[Math.floor(Math.random() * CHARACTER_KEYS.length)];
      list.push(new SmashFighter(this, this.world, { color, label: 'CPU', character }));
    }
    list.forEach((fighter, i) => fighter.spawn(SPAWN_X[i], 700, 0));
    return list;
  }

  createHud() {
    const { width, height } = this.scale;
    const panelW = 220;
    const gap = 20;
    const startX = (width - (this.fighters.length * panelW + (this.fighters.length - 1) * gap)) / 2 + panelW / 2;
    this.hud = this.fighters.map((fighter, i) => {
      const x = startX + i * (panelW + gap);
      const y = height - 62;
      const bg = this.add.rectangle(x, y, panelW, 96, 0x1b1530, 0.6).setRounded(18).setStrokeStyle(4, fighter.color);
      const name = this.add.text(
        x - panelW / 2 + 16,
        y - 40,
        `${fighter.label} · ${CHARACTERS[fighter.characterKey].name}`,
        textStyle(18, hexToCss(fighter.color), { fontStyle: 'bold', ...OUTLINE }),
      );
      const damage = this.add.text(x + 30, y + 2, '0%', textStyle(46, TEXT.normal, { fontStyle: 'bold', ...OUTLINE })).setOrigin(0.5);
      const stocks = Array.from({ length: STOCKS }, (_, k) =>
        this.add.circle(x - panelW / 2 + 24 + k * 22, y + 30, 8, fighter.color).setStrokeStyle(2, 0xffffff),
      );
      this.ui.add([bg, name, damage, ...stocks]);
      return { fighter, damage, stocks, shown: null };
    });

    const bannerStyle = { fontStyle: 'bold', stroke: '#1b1530', strokeThickness: 10, align: 'center' };
    this.banner = this.add.text(width / 2, 250, '', textStyle(84, TEXT.accent, bannerStyle)).setOrigin(0.5).setAlpha(0);
    this.subBanner = this.add.text(width / 2, 330, '', textStyle(28, TEXT.normal, { ...bannerStyle, strokeThickness: 6 })).setOrigin(0.5).setAlpha(0);
    const help = this.add
      .text(
        width / 2,
        22,
        'A = saltar  ·  X = golpe (↑ ↓ cambian)  ·  B = especial (B + ↑ = rescate)  ·  RB / LB = escudo  ·  ↓ = bajar  ·  Mantén Y = salir',
        textStyle(16, TEXT.normal, OUTLINE),
      )
      .setOrigin(0.5);
    this.exitBar = this.add.rectangle(width / 2 - 100, 42, 200, 6, 0xffffff).setOrigin(0, 0.5).setScale(0, 1);
    this.ui.add([this.banner, this.subBanner, help, this.exitBar]);
  }

  showBanner(title, subtitle = '', holdMs = 0) {
    this.tweens.killTweensOf([this.banner, this.subBanner]);
    this.banner.setText(title).setAlpha(1).setScale(0.6);
    this.subBanner.setText(subtitle).setAlpha(subtitle ? 1 : 0);
    this.tweens.add({ targets: this.banner, scale: 1, duration: 220, ease: 'Back.easeOut' });
    if (holdMs > 0) this.tweens.add({ targets: [this.banner, this.subBanner], alpha: 0, delay: holdMs, duration: 300 });
  }

  update() {
    const dt = frameDelta();
    this.phaseMs += dt;
    this.updateExit(dt);

    if (this.phase === 'countdown') {
      this.updateCountdown();
      for (const fighter of this.fighters) fighter.update(dt, IDLE);
    } else {
      for (const fighter of this.fighters) fighter.update(dt, this.inputFor(fighter));
      this.spawnStars();
      this.updateStars(dt);
      this.resolveHits();
      this.checkBlastZones();
      if (this.phase === 'fight') this.checkWinner();
      else this.updateEnd();
    }

    for (const fighter of this.fighters) fighter.render();
    this.updateCamera(dt / 1000);
    this.updateHud();
  }

  updateCountdown() {
    const step = Math.floor(this.phaseMs / COUNTDOWN_STEP_MS);
    const label = step < 3 ? String(3 - step) : '¡A pelear!';
    if (this.banner.text !== label) this.showBanner(label, '', step < 3 ? 0 : 700);
    if (step >= 3) {
      this.phase = 'fight';
      this.phaseMs = 0;
    }
  }

  inputFor(fighter) {
    if (fighter.isCpu) return this.cpuInput(fighter);
    const id = fighter.deviceId;
    const stick = controls.getStick(id);
    return {
      x: stick.x,
      y: stick.y,
      jump: controls.justPressed(id, 'a'),
      attack: controls.justPressed(id, 'x'),
      special: controls.justPressed(id, 'b'),
      // Escudo con cualquier botón de arriba (bumpers o gatillos), para que sea fácil de encontrar.
      shield: ['rb', 'lb', 'rt', 'lt'].some((button) => controls.isDown(id, button)),
    };
  }

  // CPU sencillo: persigue al más cercano, le pega cuando está cerca, a veces se cubre o usa su especial,
  // y regresa al escenario si se cae (con el doble salto y luego el salto de rescate).
  cpuInput(fighter) {
    if (fighter.hitstunMs > 0 || fighter.stunMs > 0 || this.phase !== 'fight') return IDLE;
    const main = PLATFORMS[0];
    if (fighter.x < main.left - 10 || fighter.x > main.right + 10) {
      const falling = fighter.vy > 0 && fighter.y > main.top - 150;
      return {
        ...IDLE,
        x: Math.sign(1000 - fighter.x),
        y: falling && fighter.airJumps === 0 ? -1 : 0,
        jump: falling && fighter.airJumps > 0,
        special: falling && fighter.airJumps === 0 && !fighter.rescueUsed,
      };
    }
    let target = null;
    let best = Infinity;
    for (const other of this.fighters) {
      if (other === fighter || !other.isAlive()) continue;
      const dist = Math.hypot(other.x - fighter.x, other.y - fighter.y);
      if (dist < best) [target, best] = [other, dist];
    }
    if (!target) return IDLE;
    const dx = target.x - fighter.x;
    const dy = target.y - fighter.y;
    const close = Math.abs(dx) < 85 && Math.abs(dy) < 80;
    let x = close ? Math.sign(dx) * 0.3 : Math.sign(dx);
    // No se avienta del escenario persiguiendo a alguien que va cayendo.
    if ((fighter.x < main.left + 40 && dx < 0) || (fighter.x > main.right - 40 && dx > 0)) x = 0;
    // Se cubre a veces cuando el otro está por pegarle.
    const threatened = close && target.attack && fighter.grounded && fighter.shieldHp > 40;
    if (threatened && (fighter.shielding || Math.random() < 0.06)) return { ...IDLE, shield: true };
    // Estrella dispara de lejos si el otro está a su altura.
    const lined = fighter.characterKey === 'estrella' && Math.abs(dy) < 40 && Math.abs(dx) > 150 && Math.abs(dx) < 600;
    // Para subir: salta, usa el doble salto al ir cayendo y, si no alcanza, el salto de rescate (B + ↑).
    // Para bajar: ↓ en una plataforma delgada.
    const above = dy < -90;
    const below = dy > 90;
    const needsRescue = above && !fighter.grounded && fighter.vy > 0 && fighter.airJumps === 0 && !fighter.rescueUsed;
    return {
      x,
      y: below && fighter.platform?.soft ? 1 : dy < -60 ? -1 : 0,
      jump: above && (fighter.grounded ? Math.random() < 0.08 : fighter.vy > 0 && fighter.airJumps > 0),
      attack: close && Math.random() < 0.08,
      special:
        (lined && Math.random() < 0.03) ||
        (close && fighter.characterKey !== 'resorte' && Math.random() < 0.01) ||
        (needsRescue && Math.random() < 0.1),
      shield: false,
    };
  }

  // Estrellas que pidió lanzar algún peleador este cuadro.
  spawnStars() {
    for (const fighter of this.fighters) {
      const request = fighter.projectileRequest;
      if (!request) continue;
      fighter.projectileRequest = null;
      const sprite = this.add.star(request.x, request.y, 5, 9, 20, 0xffc93c).setStrokeStyle(3, 0xffffff);
      this.world.add(sprite);
      this.stars.push({ sprite, x: request.x, y: request.y, dir: request.dir, owner: fighter, ageMs: 0 });
    }
  }

  updateStars(dt) {
    this.stars = this.stars.filter((star) => {
      star.ageMs += dt;
      star.x += star.dir * STAR.speed * (dt / 1000);
      star.sprite.setPosition(star.x, star.y).setAngle(star.ageMs * 0.8);
      const victim = this.fighters.find(
        (f) => f !== star.owner && f.isAlive() && f.invulnerableMs === 0 && Math.hypot(f.x - star.x, f.y - star.y) < f.radius + STAR.radius,
      );
      if (victim) {
        const result = victim.takeHit({ facing: star.dir, power: star.owner.power }, STAR.hit);
        burst(this, star.x, star.y, result.blocked ? 0x7fdcff : 0xffc93c, 6, this.world);
      }
      if (victim || star.ageMs > STAR.lifeMs) {
        star.sprite.destroy();
        return false;
      }
      return true;
    });
  }

  resolveHits() {
    for (const attacker of this.fighters) {
      const box = attacker.hitbox();
      if (!box) continue;
      for (const victim of this.fighters) {
        if (victim === attacker || !victim.isAlive() || victim.invulnerableMs > 0 || attacker.attack.hit.has(victim)) continue;
        if (Math.hypot(victim.x - box.x, victim.y - box.y) > box.radius + victim.radius) continue;
        attacker.attack.hit.add(victim);
        const { blocked, speed } = victim.takeHit(attacker, box.data);
        if (blocked) {
          burst(this, box.x, box.y, 0x7fdcff, 6, this.world);
          continue;
        }
        burst(this, box.x, box.y, 0xffffff, 6, this.world);
        popText(this, box.x, box.y - 40, HIT_WORDS[Math.floor(Math.random() * HIT_WORDS.length)], '#ffc93c', this.world);
        if (speed > STRONG_HIT_SPEED) this.cameras.main.shake(120, 0.006);
      }
    }
  }

  checkBlastZones() {
    for (const fighter of this.fighters) {
      if (!fighter.isAlive()) continue;
      const { x, y } = fighter;
      if (x > BLAST_ZONE.left && x < BLAST_ZONE.right && y > BLAST_ZONE.top && y < BLAST_ZONE.bottom) continue;
      const ex = Phaser.Math.Clamp(x, BLAST_ZONE.left + 150, BLAST_ZONE.right - 150);
      const ey = Phaser.Math.Clamp(y, BLAST_ZONE.top + 150, BLAST_ZONE.bottom - 150);
      burst(this, ex, ey, fighter.color, 16, this.world);
      popText(this, ex, ey, '¡KO!', '#ff5a5f', this.world);
      this.cameras.main.shake(200, 0.01);
      fighter.knockOut();
    }
  }

  checkWinner() {
    const standing = this.fighters.filter((fighter) => fighter.stocks > 0);
    if (standing.length > 1) return;
    this.phase = 'end';
    this.phaseMs = 0;
    const winner = standing[0];
    this.showBanner(winner ? `¡Ganó ${winner.label}!` : '¡Empate!', 'A = revancha   ·   B = cambiar personaje   ·   Mantén Y = salir');
    if (winner) {
      this.banner.setColor(hexToCss(winner.color));
      confetti(this, [winner.color, 0xffffff, 0xffc93c], 80, this.ui);
    }
  }

  updateEnd() {
    if (this.phaseMs < END_INPUT_DELAY_MS) return;
    const humans = this.fighters.filter((f) => !f.isCpu);
    if (humans.some((f) => controls.justPressed(f.deviceId, 'a'))) this.scene.restart(this.returnData);
    else if (humans.some((f) => controls.justPressed(f.deviceId, 'b'))) this.scene.start('SmashSelect', { selected: this.returnData.selected });
  }

  // La cámara se aleja o se acerca para que siempre quepan todos (y el escenario).
  updateCamera(dt, snap = false) {
    const points = [...STAGE_FOCUS];
    for (const fighter of this.fighters) if (fighter.isAlive()) points.push(fighter);
    const xs = points.map((p) => p.x);
    const ys = points.map((p) => p.y);
    const minX = Math.min(...xs) - CAMERA_MARGIN;
    const maxX = Math.max(...xs) + CAMERA_MARGIN;
    const minY = Math.min(...ys) - CAMERA_MARGIN;
    const maxY = Math.max(...ys) + CAMERA_MARGIN;
    const { width, height } = this.scale;
    const zoom = Phaser.Math.Clamp(Math.min(width / (maxX - minX), height / (maxY - minY)), ZOOM_MIN, ZOOM_MAX);
    const blend = snap ? 1 : 1 - Math.pow(0.02, dt);
    this.cam.zoom += (zoom - this.cam.zoom) * blend;
    this.cam.x += ((minX + maxX) / 2 - this.cam.x) * blend;
    this.cam.y += ((minY + maxY) / 2 - this.cam.y) * blend;
    this.cameras.main.setZoom(this.cam.zoom);
    this.cameras.main.centerOn(this.cam.x, this.cam.y);
  }

  updateHud() {
    for (const slot of this.hud) {
      const { fighter } = slot;
      const key = `${Math.round(fighter.damage)}|${fighter.stocks}`;
      if (slot.shown === key) continue;
      slot.shown = key;
      const color = fighter.damage >= 100 ? '#ff5a5f' : fighter.damage >= 50 ? TEXT.accent : TEXT.normal;
      slot.damage.setText(fighter.stocks > 0 ? `${Math.round(fighter.damage)}%` : '—').setColor(color);
      slot.stocks.forEach((dot, k) => dot.setVisible(k < fighter.stocks));
    }
  }

  updateExit(dt) {
    const holding = this.fighters.some((f) => !f.isCpu && controls.isDown(f.deviceId, 'y'));
    this.exitMs = holding ? this.exitMs + dt : 0;
    this.exitBar.setScale(Math.min(1, this.exitMs / EXIT_HOLD_MS), 1);
    if (this.exitMs >= EXIT_HOLD_MS) this.exit();
  }

  exit() {
    if (this.exiting) return;
    this.exiting = true;
    this.scene.start('Menu', { selected: this.returnData.selected });
  }
}
