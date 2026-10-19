import Phaser from 'phaser';
import { controls } from '../../shared/controls.js';
import { frameDelta } from '../../shared/clock.js';
import { characterPicks } from '../../shared/picks.js';
import { players, PLAYER_COLORS } from '../../shared/players.js';
import { rewards } from '../../shared/rewards.js';
import { sfx } from '../../shared/sound.js';
import { say } from '../../shared/voice.js';
import { defaultCharacter } from '../../scenes/CharacterSelectScene.js';
import { COLORS, TEXT, hexToCss, textStyle } from '../../ui/style.js';
import { burst, confetti, popText, randomPow } from '../brawl/effects.js';
import { loadSmashArt } from '../smash/art.js';
import { CHARACTERS, CHARACTER_KEYS } from '../smash/characters.js';
import { ARENAS, ARENA_KEYS, drawArena, loadArenaArt } from './arenas.js';
import { CPU_LEVELS, cpuInput } from './cpu.js';
import { DueloFighter, FLOOR, MAX_HEALTH, METER_MAX, SUPER_MS, WALLS } from './DueloFighter.js';
import { Shot } from './shots.js';

const ROUND_SECONDS = 60;
const ROUND_INTRO_MS = 1100;
const FIGHT_INTRO_MS = 700;
const KO_PAUSE_MS = 2800;
const SLOW_MOTION_MS = 800;
const END_INPUT_DELAY_MS = 1200;
const EXIT_HOLD_MS = 1200;
const START_X = [WALLS.left + 340, WALLS.right - 340];
const HUD_DEPTH = 10000;
const OUTLINE = { stroke: '#1b1530', strokeThickness: 5 };
const BAR = { width: 500, height: 30, y: 52, margin: 40 };
const ROUND_CHOICES = [1, 2, 3];
const RIVALS = { versus: 'Entre nosotros', cpu: 'Contra la compu' };
const ARENA_CHOICES = ['azar', ...ARENA_KEYS];
const IDLE = { x: 0, up: false, punch: false, kick: false, special: false, block: false, transform: false };

// Lo último que se escogió, para no escogerlo otra vez.
const lastSetup = { rival: 'versus', rounds: 2, level: 'facil', arena: 'azar' };

// "Duelo de bolitas": uno contra uno de lado, estilo Street Fighter. Barras de vida, reloj y rounds.
// Si juegan más de dos, se turnan: el que gana se queda y el que pierde se forma al final.
// Con un solo jugador (o si escogen "contra la compu") pelean contra la compu, por turnos.
export class DueloScene extends Phaser.Scene {
  constructor() {
    super('Duelo');
  }

  init(data) {
    this.returnData = data ?? {};
  }

  preload() {
    loadSmashArt(this, { allPoses: true });
    loadArenaArt(this);
  }

  create() {
    this.humans = players.sorted();
    this.queue = this.humans.map((player) => ({ player, character: characterPicks.get(player.deviceId, defaultCharacter(player)) }));
    this.fighters = [];
    this.shots = [];
    this.exitMs = 0;
    this.exiting = false;
    this.setup = { ...lastSetup };
    if (this.humans.length < 2) this.setup.rival = 'cpu';
    this.arenaLayer = this.add.container(0, 0).setDepth(-100);
    this.createHud();
    this.input.keyboard?.on('keydown-ESC', () => this.exit());
    this.showSetup();
  }

  // ---------- Antes de pelear: el Jugador 1 escoge rival, rounds, nivel de la compu y escenario ----------

  setupKeys() {
    const keys = [];
    if (this.humans.length > 1) keys.push('rival');
    keys.push('rounds');
    if (this.setup.rival === 'cpu') keys.push('level');
    keys.push('arena');
    return keys;
  }

  showSetup() {
    this.phase = 'setup';
    this.setupRow = 0;
    this.clearFighters();
    this.hideBanner();
    this.drawArenaFor(this.setup.arena === 'azar' ? 'dojo' : this.setup.arena);
    const { width } = this.scale;
    this.setupLayer = this.add.container(0, 0).setDepth(HUD_DEPTH + 2);
    this.setupLayer.add(this.add.rectangle(width / 2, 360, width, 720, 0x14112b, 0.82));
    this.setupLayer.add(this.add.text(width / 2, 120, 'Duelo de bolitas 🥋', textStyle(52, TEXT.normal, { fontStyle: 'bold' })).setOrigin(0.5));
    this.setupRows = Array.from({ length: 4 }, (_, i) => {
      const bg = this.add.rectangle(width / 2, 210 + i * 64, 580, 52, COLORS.panel).setRounded(16);
      const text = this.add.text(width / 2, 210 + i * 64, '', textStyle(24, TEXT.normal, { fontStyle: 'bold' })).setOrigin(0.5);
      this.setupLayer.add([bg, text]);
      return { bg, text };
    });
    this.matchText = this.add.text(width / 2, 500, '', textStyle(28, TEXT.normal, { align: 'center', fontStyle: 'bold' })).setOrigin(0.5);
    this.setupLayer.add(this.matchText);
    this.setupLayer.add(
      this.add.text(width / 2, 640, '↑ ↓ elegir  ·  ◀ ▶ cambiar  ·  A = ¡a pelear!  ·  B = regresar', textStyle(22, TEXT.accent)).setOrigin(0.5),
    );
    this.refreshSetup();
  }

  refreshSetup() {
    const labels = {
      rival: `Rival: ${RIVALS[this.setup.rival]}`,
      rounds: `Rounds para ganar: ${this.setup.rounds}`,
      level: `Nivel de la compu: ${CPU_LEVELS[this.setup.level].name}`,
      arena: `Escenario: ${this.setup.arena === 'azar' ? 'Al azar' : ARENAS[this.setup.arena].name}`,
    };
    const keys = this.setupKeys();
    this.setupRow = Math.min(this.setupRow, keys.length - 1);
    this.setupRows.forEach(({ bg, text }, i) => {
      const key = keys[i];
      bg.setVisible(Boolean(key));
      text.setVisible(Boolean(key));
      if (!key) return;
      text.setText(labels[key]);
      bg.setStrokeStyle(i === this.setupRow ? 4 : 2, i === this.setupRow ? COLORS.accent : COLORS.panelBorder);
    });
    const [left, right] = this.pairing();
    const turns = this.waiting().map((entry) => this.labelOf(entry.player)).join(', ');
    this.matchText.setText(`${this.describe(left)}   vs   ${this.describe(right)}${turns ? `\n\nDespués: ${turns}` : ''}`);
  }

  updateSetup() {
    const host = players.host();
    if (!host) return;
    const id = host.deviceId;
    const keys = this.setupKeys();
    const move = (controls.justPressed(id, 'down') ? 1 : 0) - (controls.justPressed(id, 'up') ? 1 : 0);
    if (move !== 0) {
      this.setupRow = (this.setupRow + move + keys.length) % keys.length;
      sfx.select();
      this.refreshSetup();
    }
    const step = (controls.justPressed(id, 'right') ? 1 : 0) - (controls.justPressed(id, 'left') ? 1 : 0);
    if (step !== 0) {
      const cycle = (list, value) => list[(list.indexOf(value) + step + list.length) % list.length];
      const key = keys[this.setupRow];
      if (key === 'rival') this.setup.rival = cycle(Object.keys(RIVALS), this.setup.rival);
      else if (key === 'rounds') this.setup.rounds = cycle(ROUND_CHOICES, this.setup.rounds);
      else if (key === 'level') this.setup.level = cycle(Object.keys(CPU_LEVELS), this.setup.level);
      else {
        this.setup.arena = cycle(ARENA_CHOICES, this.setup.arena);
        this.drawArenaFor(this.setup.arena === 'azar' ? 'dojo' : this.setup.arena);
      }
      sfx.select();
      this.refreshSetup();
    }
    if (controls.justPressed(id, 'a')) {
      sfx.confirm();
      Object.assign(lastSetup, this.setup);
      this.setupLayer.destroy();
      this.startMatch();
    } else if (controls.justPressed(id, 'b')) {
      this.exit();
    }
  }

  // ---------- Quién pelea ----------

  labelOf(player) {
    return `J${player.slot + 1}`;
  }

  describe(entry) {
    return `${entry.player ? this.labelOf(entry.player) : 'CPU'} · ${CHARACTERS[entry.character].name}`;
  }

  // Los dos que pelean ahora: los primeros dos de la fila, o el primero contra la compu.
  pairing() {
    if (this.setup.rival === 'versus' && this.queue.length > 1) return [this.queue[0], this.queue[1]];
    this.cpuCharacter ??= this.randomCpuCharacter();
    return [this.queue[0], { player: null, character: this.cpuCharacter }];
  }

  // Los que esperan su turno.
  waiting() {
    return this.queue.slice(this.setup.rival === 'versus' ? 2 : 1);
  }

  randomCpuCharacter() {
    const taken = new Set(this.queue.map((entry) => entry.character));
    const free = CHARACTER_KEYS.filter((key) => !taken.has(key));
    return Phaser.Utils.Array.GetRandom(free.length ? free : CHARACTER_KEYS);
  }

  createFighter(entry, i) {
    const taken = new Set(this.humans.map((player) => player.colorIndex));
    const cpuColor = PLAYER_COLORS.find((_, k) => !taken.has(k)) ?? PLAYER_COLORS[0];
    return new DueloFighter(this, {
      color: entry.player ? players.color(entry.player).hex : cpuColor.hex,
      label: entry.player ? this.labelOf(entry.player) : 'CPU',
      character: entry.character,
      deviceId: entry.player?.deviceId ?? null,
    });
  }

  clearFighters() {
    for (const fighter of this.fighters) fighter.destroy();
    this.fighters = [];
    this.clearShots();
    this.hud?.forEach((side) => side.root.setVisible(false));
    this.timerBox?.setVisible(false);
    this.turnsText?.setText('');
  }

  clearShots() {
    for (const shot of this.shots) shot.destroy();
    this.shots = [];
  }

  drawArenaFor(key) {
    this.arenaLayer.removeAll(true);
    drawArena(this, key, FLOOR, this.arenaLayer);
  }

  // ---------- La pelea ----------

  startMatch() {
    this.clearFighters();
    const [left, right] = this.pairing();
    this.fighters = [left, right].map((entry, i) => this.createFighter(entry, i));
    this.fighters.forEach((fighter) => (fighter.roundWins = 0));
    this.arena = this.setup.arena === 'azar' ? Phaser.Utils.Array.GetRandom(ARENA_KEYS.filter((k) => ARENAS[k].has)) ?? 'dojo' : this.setup.arena;
    this.drawArenaFor(this.arena);
    this.round = 0;
    this.hud.forEach((side, i) => this.fillHud(side, this.fighters[i]));
    this.timerBox.setVisible(true);
    this.startRound();
  }

  startRound() {
    this.round += 1;
    this.clearShots();
    this.fighters.forEach((fighter, i) => fighter.reset(START_X[i], i === 0 ? 1 : -1));
    this.timeLeftMs = ROUND_SECONDS * 1000;
    this.phase = 'intro';
    this.phaseMs = 0;
    this.slowMs = 0;
    const last = this.fighters.every((fighter) => fighter.roundWins === this.setup.rounds - 1) && this.setup.rounds > 1;
    const [a, b] = this.fighters;
    this.showBanner(last ? '¡Round final!' : `Round ${this.round}`, `${a.label} ${a.name}  vs  ${b.label} ${b.name}`, ROUND_INTRO_MS);
    sfx.countdown();
  }

  update() {
    const dt = frameDelta();
    this.updateExit(dt);
    if (this.phase === 'setup') {
      this.updateSetup();
      return;
    }
    this.phaseMs += dt;
    // Cámara lenta un momento al dar el K.O.
    this.slowMs = Math.max(0, this.slowMs - dt);
    const step = this.slowMs > 0 ? dt * 0.3 : dt;

    if (this.phase === 'intro' && this.phaseMs >= ROUND_INTRO_MS) {
      this.phase = 'go';
      this.phaseMs = 0;
      this.showBanner('¡Peleen!', '', FIGHT_INTRO_MS);
      sfx.countdown(true);
    } else if (this.phase === 'go' && this.phaseMs >= FIGHT_INTRO_MS * 0.5) {
      this.phase = 'fight';
      this.phaseMs = 0;
    }

    const fighting = this.phase === 'fight';
    this.fighters.forEach((fighter, i) => {
      const foe = this.fighters[1 - i];
      fighter.update(step, fighting ? this.inputFor(fighter, foe, step) : IDLE, foe);
    });
    this.separate();
    this.updateShots(step);
    if (fighting) {
      this.resolveHits();
      this.announceMeters();
      this.updateTimer(dt);
    } else if (this.phase === 'ko') {
      this.updateKo();
    } else if (this.phase === 'end') {
      this.updateEnd();
    }
    for (const fighter of this.fighters) fighter.render(step);
    this.updateHud();
  }

  inputFor(fighter, foe, dt) {
    if (fighter.isCpu) return cpuInput(fighter, foe, this.shots, CPU_LEVELS[this.setup.level], dt);
    const id = fighter.deviceId;
    const stick = controls.getStick(id);
    const transform = controls.isDown(id, 'lb') && controls.isDown(id, 'rb') && (controls.justPressed(id, 'lb') || controls.justPressed(id, 'rb'));
    return {
      x: stick.x,
      up: controls.justPressed(id, 'up'),
      punch: controls.justPressed(id, 'a'),
      kick: controls.justPressed(id, 'b'),
      special: controls.justPressed(id, 'x'),
      block: !transform && ['lb', 'rb', 'lt', 'rt'].some((button) => controls.isDown(id, button)),
      transform,
    };
  }

  // No se enciman: se empujan de lado (saltando sí se pueden pasar por arriba).
  separate() {
    const [a, b] = this.fighters;
    if (!a || a.ghosting || b.ghosting || a.koed || b.koed) return;
    if (Math.abs(a.y - b.y) > Math.min(a.height, b.height) * 0.45) return;
    const ha = a.hurtbox;
    const hb = b.hurtbox;
    const overlap = Math.min(ha.right, hb.right) - Math.max(ha.left, hb.left);
    if (overlap <= 0) return;
    const dir = Math.sign(b.x - a.x) || a.facing;
    a.x -= (dir * overlap) / 2;
    b.x += (dir * overlap) / 2;
    // Si uno quedó contra la pared, regresa y el otro se recorre lo mismo.
    for (const f of [a, b]) {
      const margin = f.radius * 0.6;
      const back = Phaser.Math.Clamp(f.x, WALLS.left + margin, WALLS.right - margin) - f.x;
      a.x += back;
      b.x += back;
    }
  }

  resolveHits() {
    for (const attacker of this.fighters) {
      const box = attacker.hitbox();
      if (!box || attacker.landed.has(box.key)) continue;
      const victim = this.fighters.find((f) => f !== attacker);
      const body = victim.hurtbox;
      if (box.right < body.left || box.left > body.right || box.bottom < body.top || box.top > body.bottom) continue;
      const result = victim.takeHit(box.data, attacker.x);
      if (!result) continue;
      attacker.landed.add(box.key);
      const x = (Math.max(box.left, body.left) + Math.min(box.right, body.right)) / 2;
      const y = (Math.max(box.top, body.top) + Math.min(box.bottom, body.bottom)) / 2;
      this.afterHit(attacker, victim, result, box.data, x, y, attacker.attack?.type === 'finisher');
    }
  }

  afterHit(attacker, victim, { blocked, dealt }, data, x, y, finisher = false) {
    attacker.dealtDamage(dealt);
    if (blocked) {
      burst(this, x, y, 0x7fdcff, 6);
      sfx.block();
      return;
    }
    burst(this, x, y, 0xffffff, data.launch ? 12 : 7);
    popText(this, x, y - 40, finisher ? '¡Remate!' : randomPow(), finisher ? '#ff9a3c' : '#ffc93c');
    sfx.hit(Math.min(1, dealt / 12));
    if (data.launch) this.cameras.main.shake(140, 0.007);
    if (victim.koed) this.endRound(attacker, 'ko');
  }

  spawnShot(owner, data) {
    this.shots.push(new Shot(this, owner, data));
    if (data.shape === 'laser') sfx.laser();
    else if (data.shape === 'fire') sfx.fire();
    else sfx.throw();
  }

  updateShots(dt) {
    for (const shot of this.shots) {
      shot.update(dt);
      if (shot.dead) continue;
      // Dos cosas lanzadas que chocan se deshacen.
      const other = this.shots.find((s) => s !== shot && !s.dead && s.owner !== shot.owner && overlaps(s.box, shot.box));
      if (other) {
        burst(this, (shot.x + other.x) / 2, shot.y, 0xffffff, 10);
        sfx.poof();
        shot.destroy();
        other.destroy();
        continue;
      }
      const victim = this.fighters.find((f) => f !== shot.owner);
      if (this.phase === 'fight' && overlaps(shot.box, victim.hurtbox)) {
        const result = victim.takeHit(shot.hit, shot.x - shot.dir * 10);
        if (result) {
          shot.destroy();
          this.afterHit(shot.owner, victim, result, shot.hit, shot.x, shot.y);
          continue;
        }
      }
      shot.render();
    }
    this.shots = this.shots.filter((shot) => {
      if (shot.dead && shot.sprite.active) shot.destroy();
      return !shot.dead;
    });
  }

  // Al llenarse la barra de poder, avisa que ya se puede transformar.
  announceMeters() {
    for (const fighter of this.fighters) {
      const full = fighter.meter >= METER_MAX;
      if (full && !fighter.meterAnnounced) {
        popText(this, fighter.x, fighter.y - fighter.height - 40, '¡Barra llena! LB + RB', '#ffd84d');
        if (!fighter.isCpu) sfx.meterFull();
      }
      fighter.meterAnnounced = full;
    }
  }

  // Lo llama el peleador al transformarse.
  celebrateSuper(fighter) {
    const y = fighter.y - fighter.height / 2;
    burst(this, fighter.x, y, 0xffd84d, 16);
    burst(this, fighter.x, y, fighter.color, 10);
    popText(this, fighter.x, fighter.y - fighter.height - 50, `¡${fighter.superName}!`, '#ffd84d');
    say(fighter.superName);
    this.cameras.main.flash(200, 255, 230, 120);
    if (!fighter.isCpu) rewards.earn('duelo-super');
  }

  // Lo llama el ninja al desaparecer y aparecer.
  poof(x, y) {
    burst(this, x, y, 0xcfd3e6, 10);
    sfx.poof();
  }

  updateTimer(dt) {
    this.timeLeftMs = Math.max(0, this.timeLeftMs - dt);
    if (this.timeLeftMs > 0) return;
    // Se acabó el tiempo: gana el que tenga más vida.
    const [a, b] = this.fighters;
    const winner = a.health === b.health ? null : a.health > b.health ? a : b;
    this.endRound(winner, 'time');
  }

  endRound(winner, reason) {
    if (this.phase !== 'fight') return;
    this.phase = 'ko';
    this.phaseMs = 0;
    this.roundWinner = winner;
    this.celebrated = false;
    if (reason === 'ko') {
      this.slowMs = SLOW_MOTION_MS;
      this.cameras.main.shake(250, 0.012);
      sfx.ko();
    }
    const title = reason === 'ko' ? '¡K.O.!' : winner ? '¡Tiempo!' : '¡Empate!';
    let subtitle = winner ? `Round para ${winner.label}` : 'Nadie gana este round';
    if (winner) {
      winner.roundWins += 1;
      if (winner.health === MAX_HEALTH) {
        subtitle = `¡Perfecto! Round para ${winner.label}`;
        if (!winner.isCpu) rewards.earn('duelo-perfecto');
      }
    }
    this.showBanner(title, subtitle, KO_PAUSE_MS - 600, winner ? hexToCss(winner.color) : TEXT.accent);
  }

  updateKo() {
    if (!this.celebrated && this.phaseMs > SLOW_MOTION_MS + 300) {
      this.celebrated = true;
      for (const fighter of this.fighters) fighter.celebrate(fighter === this.roundWinner);
    }
    if (this.phaseMs < KO_PAUSE_MS) return;
    const champion = this.fighters.find((fighter) => fighter.roundWins >= this.setup.rounds);
    if (champion) this.endMatch(champion);
    else this.startRound();
  }

  endMatch(winner) {
    this.phase = 'end';
    this.phaseMs = 0;
    this.matchWinner = winner;
    if (!winner.isCpu) rewards.earn('duelo-gana');
    const next = this.nextQueue();
    const [a, b] = this.pairingFor(next);
    const nextText = `Sigue: ${this.describe(a)} vs ${this.describe(b)}`;
    this.showBanner(`¡Ganó ${winner.label}!`, `${nextText}\nA = siguiente pelea  ·  B = cambiar personajes  ·  Mantén Y = salir`, 0, hexToCss(winner.color));
    confetti(this, [winner.color, 0xffffff, 0xffc93c], 90);
    sfx.win();
  }

  // Cómo queda la fila para la siguiente pelea: entre nosotros, el que perdió se forma al final
  // (el que ganó se queda); contra la compu, le toca al siguiente.
  nextQueue() {
    const queue = [...this.queue];
    if (this.setup.rival === 'versus' && queue.length > 1) {
      const loserIndex = this.matchWinner === this.fighters[0] ? 1 : 0;
      const [loser] = queue.splice(loserIndex, 1);
      queue.push(loser);
    } else {
      queue.push(queue.shift());
    }
    return queue;
  }

  pairingFor(queue) {
    const saved = this.queue;
    this.queue = queue;
    const pair = this.pairing();
    this.queue = saved;
    return pair;
  }

  updateEnd() {
    if (this.phaseMs < END_INPUT_DELAY_MS) return;
    const ids = this.humans.map((player) => player.deviceId);
    if (ids.some((id) => controls.justPressed(id, 'a'))) {
      this.queue = this.nextQueue();
      this.cpuCharacter = null;
      this.hideBanner();
      this.startMatch();
    } else if (ids.some((id) => controls.justPressed(id, 'b'))) {
      this.scene.start('Personajes', { selected: this.returnData.selected, next: 'Duelo', title: 'Duelo de bolitas' });
    }
  }

  // ---------- Marcador ----------

  createHud() {
    const { width, height } = this.scale;
    this.hud = [0, 1].map((side) => {
      const anchorX = side === 0 ? BAR.margin : width - BAR.margin;
      const origin = side === 0 ? 0 : 1;
      const root = this.add.container(0, 0).setDepth(HUD_DEPTH).setVisible(false);
      const back = this.add.rectangle(anchorX, BAR.y, BAR.width, BAR.height, 0x1b1530, 0.75).setOrigin(origin, 0.5).setStrokeStyle(4, 0xffffff);
      const trail = this.add.rectangle(anchorX, BAR.y, BAR.width, BAR.height - 8, 0xffffff).setOrigin(origin, 0.5);
      const fill = this.add.rectangle(anchorX, BAR.y, BAR.width, BAR.height - 8, 0xffffff).setOrigin(origin, 0.5);
      const name = this.add.text(anchorX, BAR.y - 32, '', textStyle(22, TEXT.normal, { fontStyle: 'bold', ...OUTLINE })).setOrigin(origin, 0.5);
      const wins = this.add.text(anchorX, BAR.y + 32, '', textStyle(24, TEXT.accent, { fontStyle: 'bold', ...OUTLINE })).setOrigin(origin, 0.5);
      // Barra de poder (llena = LB + RB para transformarse) y si el especial (X) ya está listo.
      const meterX = side === 0 ? anchorX + 110 : anchorX - 110;
      const meterBack = this.add.rectangle(meterX, BAR.y + 32, 260, 10, 0xffffff, 0.2).setOrigin(origin, 0.5);
      const meter = this.add.rectangle(meterX, BAR.y + 32, 260, 10, 0xffd84d).setOrigin(origin, 0.5);
      const special = this.add.text(side === 0 ? meterX + 275 : meterX - 275, BAR.y + 32, 'X', textStyle(20, TEXT.normal, { fontStyle: 'bold', ...OUTLINE })).setOrigin(origin, 0.5);
      root.add([back, trail, fill, name, wins, meterBack, meter, special]);
      return { root, trail, fill, name, wins, meter, special, trailHealth: MAX_HEALTH };
    });
    this.timerBox = this.add.container(width / 2, BAR.y).setDepth(HUD_DEPTH).setVisible(false);
    this.timerText = this.add.text(0, 0, '', textStyle(44, TEXT.normal, { fontStyle: 'bold', ...OUTLINE })).setOrigin(0.5);
    this.timerBox.add([this.add.rectangle(0, 0, 96, 64, 0x1b1530, 0.8).setRounded(14).setStrokeStyle(4, 0xffffff), this.timerText]);
    this.turnsText = this.add.text(width / 2, BAR.y + 50, '', textStyle(17, TEXT.normal, OUTLINE)).setOrigin(0.5, 0).setDepth(HUD_DEPTH);

    const bannerStyle = { fontStyle: 'bold', stroke: '#1b1530', strokeThickness: 10, align: 'center' };
    this.banner = this.add.text(width / 2, 210, '', textStyle(84, TEXT.accent, bannerStyle)).setOrigin(0.5).setDepth(HUD_DEPTH + 1).setAlpha(0);
    this.subBanner = this.add
      .text(width / 2, 285, '', textStyle(28, TEXT.normal, { ...bannerStyle, strokeThickness: 6 }))
      .setOrigin(0.5, 0)
      .setDepth(HUD_DEPTH + 1)
      .setAlpha(0);
    this.add
      .text(
        width / 2,
        height - 22,
        'Stick = moverse (↑ saltar)  ·  A = golpe (3 seguidos = remate)  ·  B = patada  ·  X = especial  ·  LB / RB = cubrirse  ·  Barra llena: LB + RB = ¡súper!  ·  Mantén Y = salir',
        textStyle(15, TEXT.normal, OUTLINE),
      )
      .setOrigin(0.5)
      .setDepth(HUD_DEPTH);
    this.exitBar = this.add.rectangle(width / 2 - 100, height - 6, 200, 6, 0xffffff).setOrigin(0, 0.5).setScale(0, 1).setDepth(HUD_DEPTH);
  }

  fillHud(side, fighter) {
    side.root.setVisible(true);
    side.fill.setFillStyle(fighter.color);
    side.name.setText(`${fighter.label} · ${fighter.name}`).setColor(hexToCss(fighter.color));
    side.trailHealth = MAX_HEALTH;
  }

  updateHud() {
    if (!this.fighters.length) return;
    this.hud.forEach((side, i) => {
      const fighter = this.fighters[i];
      side.fill.setScale(fighter.health / MAX_HEALTH, 1);
      // La parte blanca se va bajando despacito detrás de la vida: así se ve cuánto le quitaron.
      side.trailHealth = Math.max(fighter.health, side.trailHealth - frameDelta() * 0.03);
      side.trail.setScale(side.trailHealth / MAX_HEALTH, 1);
      side.wins.setText('★'.repeat(fighter.roundWins) + '☆'.repeat(Math.max(0, this.setup.rounds - fighter.roundWins)));
      const meter = fighter.superMs > 0 ? fighter.superMs / SUPER_MS : fighter.meter / METER_MAX;
      side.meter.setScale(meter, 1).setFillStyle(fighter.superMs > 0 ? 0xff9a3c : fighter.meter >= METER_MAX ? 0xfff2a8 : 0xffd84d);
      side.special.setAlpha(fighter.cooldownMs === 0 ? 1 : 0.3);
    });
    this.timerText.setText(String(Math.ceil(this.timeLeftMs / 1000)));
    this.timerText.setColor(this.timeLeftMs < 10000 ? '#ff5a5f' : TEXT.normal);
    const turns = this.waiting().map((entry) => this.labelOf(entry.player));
    this.turnsText.setText(turns.length ? `Esperan turno: ${turns.join(', ')}` : '');
  }

  showBanner(title, subtitle = '', holdMs = 0, color = TEXT.accent) {
    say(title);
    this.tweens.killTweensOf([this.banner, this.subBanner]);
    this.banner.setText(title).setColor(color).setAlpha(1).setScale(0.6);
    this.subBanner.setText(subtitle).setAlpha(subtitle ? 1 : 0);
    this.tweens.add({ targets: this.banner, scale: 1, duration: 220, ease: 'Back.easeOut' });
    if (holdMs > 0) this.tweens.add({ targets: [this.banner, this.subBanner], alpha: 0, delay: holdMs, duration: 300 });
  }

  hideBanner() {
    this.tweens.killTweensOf([this.banner, this.subBanner]);
    this.banner.setAlpha(0);
    this.subBanner.setAlpha(0);
  }

  updateExit(dt) {
    const holding = this.humans.some((player) => controls.isDown(player.deviceId, 'y'));
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

function overlaps(a, b) {
  return a.right >= b.left && a.left <= b.right && a.bottom >= b.top && a.top <= b.bottom;
}
