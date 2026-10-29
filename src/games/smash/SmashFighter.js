import Phaser from 'phaser';
import { frameDelta } from '../../shared/clock.js';
import { sfx } from '../../shared/sound.js';
import { Blob } from '../../ui/Blob.js';
import { CharacterLook, WALK_FPS } from '../../ui/CharacterLook.js';
import { Motion } from '../../ui/motion.js';
import { COLORS, hexToCss, textStyle } from '../../ui/style.js';
import { EXPRESSION_POSES, characterTexture, fitPose, hasPose, requestPoses, superArtKey, walkPose } from './art.js';
import { OCTO, isBlockCharacter, lerp, numberSize } from './bloquecito.js';
import { addCrown } from '../duelo/boss.js';
import { dustPuff } from '../duelo/fx.js';
import { COSTUMES } from '../duelo/DueloFighter.js';
import { CHARACTERS, addAccessory, characterInfo } from './characters.js';
import { drawItem } from './items.js';

export const STOCKS = 3;
const GRAVITY = 1800;
const MAX_FALL = 950;
const AIR_ACCEL = 1500;
const GROUND_FRICTION = 2600;
const DROP_MS = 250;
// Al salir volando, el empujón se frena poco a poco (más grande = vuela menos lejos).
const LAUNCH_DRAG = 1.5;
const HITSTUN_PER_SPEED = 0.4;
const RESPAWN_MS = 1500;
const RESPAWN_INVULNERABLE_MS = 2000;
const RESCUE_SPEED = 880;
const SPRING_SPEED = 1050;
const DASH_SPEED = 900;
const DASH_MS = 260;
const CHARGE_LUNGE = 320;
const SCRATCH_LUNGE = 260;
const SLIDE_SPEED = 720;
const SLIDE_MS = 420;
const CANNON_THROW = { vx: 640, vy: -260 };
const ROCKET = { vx: 420, rise: 380, ms: 520 };
const STING_MS = 200;
// Cada cuánto se puede repetir el especial (los que no están aquí no esperan).
const SPECIAL_COOLDOWN_MS = {
  estrella: 700,
  robot: 900,
  ninja: 1400,
  dragon: 600,
  fantasma: 4000,
  dino: 700,
  gatito: 500,
  pinguino: 900,
  pirata: 1100,
  hada: 700,
  astronauta: 1500,
  abeja: 700,
  bombero: 900,
  luchador: 1100,
  unicornio: 900,
  rey: 1300,
  dragonzote: 900,
  robotote: 1100,
};
const GHOST_MS = 1500;
export const SHIELD_MAX = 100;
const SHIELD_DRAIN = 22;
const SHIELD_REGEN = 14;
const SHIELD_HIT_FACTOR = 3;
const SHIELD_PUSHBACK = 140;
const SHIELD_BREAK_STUN_MS = 1600;
const HAMMER_MS = 8000;
const STAR_POWER_MS = 6000;
const STAR_SPEED_BONUS = 1.2;
const HEART_HEAL = 40;
const BOMB_THROW = { vx: 650, vy: -380 };
// Objetos nuevos: el bate da pocos batazos (pero avienta lejísimos), la pistola trae sus rayos contados y la patineta
// hace correr más un rato.
const BAT_SWINGS = 4;
const RAYGUN_SHOTS = 8;
const SKATE_MS = 9000;
const SKATE_SPEED = 1.5;
// El bumerán: lo avientas, regresa a tu mano y lo puedes volver a aventar (3 veces). La flor de fuego echa bolas de
// fuego que botan por el piso.
const BOOMERANG_THROWS = 3;
const BOOMERANG_SPEED = 1150;
const FLOWER_SHOTS = 6;
const FIREBALL_THROW = { vx: 620, vy: -160 };
// El globo de agua y el pastel se avientan (el globo en arco, el pastel derecho); el imán jala a los rivales (3 veces);
// el paraguas te deja caer despacito un rato. Mojado te resbalas (casi no frenas) y con pastel en la cara no puedes pegar.
const MAGNET_PULLS = 3;
const BALLOON_THROW = { vx: 560, vy: -430 };
const UMBRELLA_MS = 12000;
const UMBRELLA_FALL = 170;
export const WET_MS = 3500;
const WET_GRIP = 0.15;
export const PIE_MS = 2600;
// Cuántas veces se puede usar lo que traes en la mano (lo que no está aquí, sin límite).
const HELD_USES = { bat: BAT_SWINGS, raygun: RAYGUN_SHOTS, boomerang: BOOMERANG_THROWS, fireflower: FLOWER_SHOTS, magnet: MAGNET_PULLS };
// Agarrar (escudo + X pegadito): lo detiene un momento y lo avienta hacia donde apunte el stick (o hacia adelante).
const HOLD_MS = 380;
export const THROW_HIT = { damage: 9, base: 430, scale: 10, angle: 40 };
// Esquivar: escudo + ◀ ▶ = rodada (no le pegan); escudo en el aire = esquiva en el aire (una vez por salto).
const ROLL = { ms: 360, speed: 760, invulnerableMs: 320 };
const AIR_DODGE_MS = 320;
// Agarrarse de la orilla: qué tan cerca de la esquina tiene que pasar, cuánto aguanta colgado y cuánto dura sin que le
// peguen al agarrarse.
const LEDGE = { reach: 1.7, below: 1.6, hangMs: 2600, invulnerableMs: 900, dropMs: 450 };
// Modo peque: recibe menos daño, sale volando menos y llena su barra más rápido.
const PEQUE_DAMAGE = 0.7;
const PEQUE_KNOCKBACK = 0.6;
const PEQUE_METER_BONUS = 1.5;
// Golpe cargado: X sostenido en el piso (golpe normal, hacia arriba o barrida) se queda justo antes de pegar,
// juntando fuerza; al soltar (o al llegar al máximo) pega más fuerte, más grande y avienta más lejos.
export const CHARGE_MAX_MS = 1100;
const CHARGE_SHOW_MS = 120;
const CHARGE_BOOST = { damage: 0.7, base: 0.9, radius: 0.3 };
const CHARGEABLE = ['jab', 'up', 'sweep'];
// Escudo perfecto: si el escudo se levantó hace menos de esto cuando llega el golpe, no gasta escudo y el que pegó se
// queda mareado (eso, y regresar los disparos, lo hace la escena). La compu lo logra a veces, según su nivel.
export const PERFECT_SHIELD_MS = 220;
const PERFECT_METER = 8;
const CPU_PERFECT = { facil: 0, normal: 0.3, dificil: 0.6 };
const RAINBOW = [0xff5a5f, 0xff9a3c, 0xffc93c, 0x4cd97b, 0x3fa7ff, 0xb07cff];

// Barra de poder: se llena pegando y recibiendo golpes (por cada % de daño). Llena + LB + RB = súper modo:
// crece, pega más fuerte, corre más, casi no sale volando y su especial se recarga más rápido.
export const METER_MAX = 100;
const METER_PER_DAMAGE_DEALT = 1.4;
const METER_PER_DAMAGE_TAKEN = 1;
export const SUPER_MS = 10000;
const TRANSFORM_MS = 700;
const SUPER = { size: 1.25, power: 1.4, weight: 1.6, speed: 1.25, jump: 1.08, cooldown: 0.5 };
const SUPER_TINT = 0x806000;

// Golpes. Tiempos en ms; el empujón crece con el % del que recibe.
// angle: hacia dónde sale volando (grados; 0 = hacia adelante, 90 = arriba, negativo = abajo).
// multi: vuelve a pegar cada tantos ms mientras está activo (el fuego de Dragoncito).
// around: pega alrededor y avienta hacia afuera, para los dos lados (el coletazo de Dino).
export const ATTACKS = {
  // X, según la dirección del stick.
  jab: { startup: 60, active: 100, recovery: 160, damage: 7, base: 260, scale: 9, angle: 35, hx: 52, hy: 0, radius: 30 },
  up: { startup: 70, active: 110, recovery: 200, damage: 8, base: 300, scale: 9, angle: 85, hx: 14, hy: -50, radius: 32 },
  sweep: { startup: 80, active: 120, recovery: 220, damage: 6, base: 240, scale: 8, angle: 20, hx: 46, hy: 22, radius: 34 },
  stomp: { startup: 90, active: 120, recovery: 220, damage: 9, base: 200, scale: 7, angle: -70, hx: 8, hy: 46, radius: 32 },
  // X con el martillo en la mano.
  hammer: { startup: 120, active: 140, recovery: 260, damage: 14, base: 400, scale: 11, angle: 40, hx: 58, hy: -6, radius: 48 },
  // X con la bomba en la mano: la lanza (la crea la escena).
  throw: { startup: 70, active: 0, recovery: 160 },
  // B: especial de cada personaje.
  charge: { startup: 280, active: 120, recovery: 300, damage: 15, base: 420, scale: 11, angle: 30, hx: 62, hy: 0, radius: 40 },
  dash: { startup: 30, active: 230, recovery: 220, damage: 8, base: 320, scale: 8, angle: 25, hx: 22, hy: 0, radius: 40 },
  spring: { startup: 40, active: 260, recovery: 260, damage: 9, base: 340, scale: 9, angle: 80, hx: 0, hy: -40, radius: 40 },
  // Lanza una estrella (la crea la escena); no golpea con el cuerpo.
  cast: { startup: 90, active: 0, recovery: 200 },
  // X con el bate: batazo lento que manda lejísimos.
  bat: { startup: 160, active: 130, recovery: 320, damage: 15, base: 540, scale: 14, angle: 38, hx: 66, hy: -6, radius: 54 },
  // X con la pistola de rayos: dispara (lo crea la escena).
  zap: { startup: 60, active: 0, recovery: 170 },
  // Escudo + X: agarra al que tenga pegadito (la escena se encarga de detenerlo y aventarlo).
  grabbing: { startup: 50, active: 100, recovery: 260, damage: 0, base: 0, scale: 0, angle: 0, hx: 40, hy: 0, radius: 34, grab: true },
  // Ninja: la escena lo pasa detrás del rival más cercano y luego pega.
  ambush: { startup: 170, active: 110, recovery: 220, damage: 9, base: 330, scale: 9, angle: 40, hx: 48, hy: 0, radius: 34 },
  // Robot: dispara un láser (lo crea la escena).
  laser: { startup: 160, active: 0, recovery: 240 },
  // Dragoncito: fuego enfrente que pega varias veces.
  fire: { startup: 120, active: 480, recovery: 240, damage: 3, base: 140, scale: 3, angle: 25, hx: 72, hy: 0, radius: 44, multi: 160 },
  // Dino: coletazo que da la vuelta y pega a los dos lados.
  tail: { startup: 150, active: 160, recovery: 260, damage: 12, base: 380, scale: 10, angle: 35, hx: 0, hy: 6, radius: 84, around: true },
  // Gatito: arañazos rápidos enfrente, un pasito hacia adelante.
  scratch: { startup: 40, active: 300, recovery: 160, damage: 3, base: 120, scale: 3, angle: 30, hx: 46, hy: -4, radius: 34, multi: 100 },
  // Pingüino: se desliza de panza y tumba a quien encuentre.
  slide: { startup: 40, active: 420, recovery: 200, damage: 9, base: 300, scale: 8, angle: 30, hx: 30, hy: 16, radius: 38 },
  // Pirata: dispara una bala de cañón que cae en arco (la crea la escena).
  cannon: { startup: 140, active: 0, recovery: 260 },
  // Hada: lanza polvo mágico que flota hacia adelante (lo crea la escena).
  wand: { startup: 90, active: 0, recovery: 200 },
  // Astronauta: la mochila cohete lo sube y lo lleva hacia adelante, y pega con el cuerpo.
  rocket: { startup: 60, active: 460, recovery: 200, damage: 8, base: 320, scale: 8, angle: 55, hx: 12, hy: 0, radius: 46 },
  // Abeja: aguijonazo en línea recta.
  sting: { startup: 60, active: 200, recovery: 220, damage: 10, base: 340, scale: 9, angle: 40, hx: 40, hy: 6, radius: 30 },
  // Bombero: chorro de agua que casi no hace daño pero empuja mucho.
  water: { startup: 100, active: 600, recovery: 240, damage: 1, base: 270, scale: 2, angle: 12, hx: 90, hy: -4, radius: 46, multi: 120 },
  // X con la flor de fuego: echa una bola de fuego que bota (la crea la escena).
  flame: { startup: 60, active: 0, recovery: 170 },
  // X con el bumerán: lo avienta y regresa (lo crea la escena).
  boomerang: { startup: 90, active: 0, recovery: 200 },
  // Dragonzote: una llamarada grandota enfrente que pega varias veces.
  blaze: { startup: 140, active: 560, recovery: 260, damage: 4, base: 170, scale: 4, angle: 25, hx: 104, hy: 0, radius: 58, multi: 150 },
  // Robotote: puño cohete (lo crea la escena).
  rocketfist: { startup: 160, active: 0, recovery: 260 },
  // X con el globo de agua, con el pastel y con el imán (los crea la escena).
  lob: { startup: 70, active: 0, recovery: 160 },
  toss: { startup: 60, active: 0, recovery: 150 },
  pull: { startup: 90, active: 0, recovery: 240 },
  // Bloquecito (los trucos que no comparte con otros personajes, ver BLOCK_TRICKS).
  // El 2: dos golpes rápidos.
  pair: { startup: 40, active: 200, recovery: 160, damage: 5, base: 220, scale: 6, angle: 35, hx: 46, hy: 0, radius: 32, multi: 100 },
  // El 3: lanza tres pelotas de malabares en arco (las crea la escena).
  juggle: { startup: 100, active: 0, recovery: 220 },
  // El 4: se vuelve cuadrado y aplasta alrededor (en el aire, cae de golpe).
  square: { startup: 160, active: 160, recovery: 240, damage: 11, base: 360, scale: 9, angle: 60, hx: 0, hy: 0, radius: 78, around: true },
  // El 6: rueda como dado hacia adelante.
  roll: { startup: 60, active: 420, recovery: 200, damage: 9, base: 320, scale: 8, angle: 35, hx: 24, hy: 0, radius: 40 },
  // El 7: echa un arcoíris (lo crea la escena).
  rainbow: { startup: 120, active: 0, recovery: 240 },
  // El 8 y Octobloque: ocho brazos que dan vueltas y pegan a los dos lados.
  octo: { startup: 60, active: 480, recovery: 200, damage: 3, base: 150, scale: 3, angle: 40, hx: 0, hy: 0, radius: 72, multi: 120, around: true },
};

// Bloquecito: el truco (B) de cada número, cada cuánto se puede repetir y cómo se dibuja (`action`, ver BlockBody).
const BLOCK_TRICKS = {
  1: { attack: 'dash', cooldown: 600 },
  2: { attack: 'pair', cooldown: 450 },
  3: { attack: 'juggle', cooldown: 900 },
  4: { attack: 'square', cooldown: 800, action: 'square' },
  5: { attack: 'cast', cooldown: 700 },
  6: { attack: 'roll', cooldown: 900, action: 'roll' },
  7: { attack: 'rainbow', cooldown: 900 },
  8: { attack: 'octo', cooldown: 800, action: 'octo' },
  9: { attack: 'charge', cooldown: 700, action: 'charge' },
  10: { attack: 'rocket', cooldown: 1500, action: 'rocket' },
  [OCTO]: { attack: 'octo', cooldown: 600, action: 'octo' },
};
// Bloquecito: con qué pose se dibuja cada golpe (los que no están aquí, 'golpe').
const BLOCK_POSES = {
  sweep: 'patada',
  stomp: 'patada',
  juggle: 'especial',
  cast: 'especial',
  rainbow: 'especial',
  square: 'especial',
  roll: 'especial',
  octo: 'especial',
  rocket: 'especial',
};
// Las tres pelotas de los malabares del 3: cada una sale con distinta fuerza.
const JUGGLE_THROWS = [
  { vx: 380, vy: -640, color: 0xff5a5f },
  { vx: 560, vy: -500, color: 0xffd02a },
  { vx: 740, vy: -360, color: 0x3fa7ff },
];
const SQUARE_SLAM_SPEED = 900;
// Lo más arriba del centro que salen los disparos de Bloquecito.
const SHOT_LIFT_MAX = 24;

// Un peleador estilo Smash: corre, salta, golpea según la dirección, usa su especial con B,
// se cubre con el escudo, agarra objetos y sale volando más lejos mientras más % de daño lleva.
// `arena` = { platforms, respawn, gravity } del escenario de la pelea.
export class SmashFighter {
  // `stats`: para el jefe gigante, el gigante de la Aventura o el saco (si no, los de su personaje).
  // `costume`: el traje (ver COSTUMES); `art`: una imagen fija sin poses (el saco del concurso de jonrón).
  constructor(scene, layer, { color, label, deviceId = null, character = 'resorte', arena, peque = false, cpuLevel = 'normal', stats: custom = null, costume = 0, art = null }) {
    this.scene = scene;
    this.color = color;
    this.label = label;
    this.deviceId = deviceId;
    this.isCpu = deviceId === null;
    this.cpuLevel = cpuLevel;
    this.perfectChance = CPU_PERFECT[cpuLevel] ?? CPU_PERFECT.normal;
    this.peque = peque;
    this.arena = arena;
    this.characterKey = character;
    // Bloquecito cambia de tamaño, peso y velocidad según su número (ver applyForm).
    this.blocks = isBlockCharacter(character);
    // Para los golpes: cuánto sube el cuerpo arriba del círculo (Bloquecito es más alto que ancho)
    // y hasta qué altura arriba del centro llegan sus golpes (sus hombros).
    this.tall = 0;
    this.attackLift = 0;
    const stats = custom ?? characterInfo(character);
    this.stats = stats;
    this.baseStats = stats;
    // `radius` crece en súper modo; `baseRadius` es el tamaño normal (con el que se dibuja).
    this.baseRadius = stats.radius;
    this.radius = stats.radius;
    this.power = stats.power;
    this.weight = stats.weight;
    this.stocks = STOCKS;
    this.damage = 0;
    this.meter = 0;
    this.superMs = 0;
    // Para los resultados: a cuántos sacó, cuántas veces se cayó, cuánto pegó, su golpe más fuerte, cuántos golpes
    // dio, sus paradas perfectas, cuántos objetos agarró, sus combos de dúo y, en sus modos, sus monedas y sus segundos en
    // la colina.
    this.record = { kos: 0, falls: 0, dealt: 0, best: 0, hits: 0, perfects: 0, items: 0, coins: 0, hill: 0, duos: 0 };

    this.sprite = new Blob(scene, 0, 0, color, this.radius);
    addAccessory(scene, this.sprite, character);
    this.fixedArt = art;
    this.costumeIndex = costume;
    this.costume = COSTUMES[costume] ?? null;
    this.setupArt(scene);
    if (character === 'rey' && !this.image) addCrown(scene, this.sprite);
    this.fist = scene.add.circle(0, 0, 12, color).setStrokeStyle(3, COLORS.ink).setVisible(false);
    this.hammerSprite = drawItem(scene, 'hammer').setVisible(false);
    this.bombSprite = drawItem(scene, 'bomb').setScale(0.8).setVisible(false);
    this.batSprite = drawItem(scene, 'bat').setVisible(false);
    this.gunSprite = drawItem(scene, 'raygun').setScale(0.8).setVisible(false);
    this.skateSprite = drawItem(scene, 'skate').setScale(1.3).setVisible(false);
    this.boomerangSprite = drawItem(scene, 'boomerang').setScale(0.8).setVisible(false);
    this.flowerSprite = drawItem(scene, 'fireflower').setScale(0.7).setVisible(false);
    // Lo nuevo en la mano: el globo de agua, el pastel y el imán; el paraguas arriba de la cabeza.
    this.balloonSprite = drawItem(scene, 'waterballoon').setScale(0.75).setVisible(false);
    this.pieSprite = drawItem(scene, 'pie').setScale(0.75).setVisible(false);
    this.magnetSprite = drawItem(scene, 'magnet').setScale(0.75).setVisible(false);
    this.umbrellaSprite = drawItem(scene, 'umbrella').setScale(1.7).setVisible(false);
    // Mojado (gotitas que escurren) y con pastel en la cara (betún con su cereza).
    this.drops = scene.add.container(0, 0, [0, 1, 2].map((i) => scene.add.ellipse((i - 1) * 16, 0, 9, 13, 0x3fa7ff).setStrokeStyle(2, 0xffffff))).setVisible(false);
    this.cream = scene.add
      .container(0, 0, [
        scene.add.ellipse(0, 0, 58, 42, 0xfff6e5).setStrokeStyle(3, 0xe8d8c8),
        ...[-20, 2, 20].map((x, i) => scene.add.ellipse(x, 18 + (i % 2) * 8, 12, 20, 0xfff6e5)),
        scene.add.circle(6, -16, 8, 0xe0203a).setStrokeStyle(2, COLORS.ink),
      ])
      .setVisible(false);
    // La bola súper: brilla de colores alrededor mientras tiene listo su golpe final.
    this.finalGlow = scene.add.circle(0, 0, this.radius * 1.7, 0xffffff, 0.35).setBlendMode(Phaser.BlendModes.ADD).setVisible(false);
    this.flames = scene.add
      .container(0, 0, [
        scene.add.ellipse(0, 0, 92, 46, 0xff9a3c, 0.85),
        scene.add.ellipse(-10, 0, 60, 30, 0xffc93c, 0.9),
        scene.add.ellipse(-18, 0, 28, 14, 0xffffff, 0.9),
      ])
      .setVisible(false);
    this.water = scene.add
      .container(0, 0, [
        scene.add.ellipse(0, 0, 110, 40, 0x3fa7ff, 0.8),
        scene.add.ellipse(-8, 0, 76, 24, 0x9fd8ff, 0.9),
        scene.add.ellipse(-16, 0, 36, 10, 0xffffff, 0.9),
      ])
      .setVisible(false);
    this.sprite.figure.add([this.fist, this.hammerSprite, this.bombSprite, this.batSprite, this.gunSprite, this.boomerangSprite, this.flowerSprite, this.flames, this.water]);
    this.sprite.figure.add([this.balloonSprite, this.pieSprite, this.magnetSprite]);
    this.sprite.add([this.skateSprite, this.umbrellaSprite, this.drops, this.cream]);
    this.sprite.addAt(this.finalGlow, 0);
    // Brillo detrás del personaje en súper modo.
    this.aura = scene.add.circle(0, 0, this.radius * 1.5, 0xffd84d, 0.5).setBlendMode(Phaser.BlendModes.ADD).setVisible(false);
    this.sprite.addAt(this.aura, 0);
    // Brillo del golpe cargado: crece mientras se carga.
    this.chargeGlow = scene.add.circle(0, 0, this.radius * 1.2, 0xffffff, 0.4).setBlendMode(Phaser.BlendModes.ADD).setVisible(false);
    this.sprite.addAt(this.chargeGlow, 0);
    // El escudo, el letrero y el mareo no giran con el cuerpo cuando sale volando.
    this.shieldBubble = scene.add.circle(0, 0, this.radius * 1.4, color, 0.5).setStrokeStyle(6, 0xffffff, 0.9).setVisible(false);
    this.tag = scene.add
      .text(0, -this.radius - 34, label, textStyle(18, hexToCss(color), { fontStyle: 'bold', stroke: '#1b1530', strokeThickness: 4 }))
      .setOrigin(0.5);
    this.dizzy = scene.add.text(0, -this.radius - 60, '💫', textStyle(30)).setOrigin(0.5).setVisible(false);
    // La imagen es más alta que la bolita: el letrero y el mareo van arriba de ella.
    if (this.image) {
      const top = this.radius - this.image.displayHeight;
      this.tag.setY(top - 14);
      this.dizzy.setY(top - 40);
    }
    this.sprite.add([this.shieldBubble, this.tag, this.dizzy]);
    layer.add(this.sprite);
    this.spawn(arena.respawn.x, arena.respawn.y, 0);
    if (this.blocks) this.applyForm();
  }

  // Si hay imagen del personaje (npm run arte), se esconde la bolita dibujada y se usa la imagen,
  // con los pies en el piso y un aro del color del jugador para saber quién es quién.
  setupArt(scene) {
    this.image = null;
    if (this.blocks) {
      // Bloquecito se dibuja con bloques; su súper forma (Octobloque) también, así que no se pinta dorado.
      this.look = new CharacterLook(scene, this.sprite, this.characterKey, { fx: true });
      this.superArt = OCTO;
      this.ring = scene.add.ellipse(0, this.baseRadius - 2, this.baseRadius * 2.4, this.baseRadius * 0.6).setStrokeStyle(5, this.color);
      this.sprite.addAt(this.ring, 1);
      return;
    }
    const fixed = this.fixedArt && scene.textures.exists(this.fixedArt) ? this.fixedArt : null;
    const key = fixed ?? characterTexture(scene, this.characterKey);
    this.superArt = superArtKey(scene, this.characterKey);
    if (!key) return;
    for (const part of this.sprite.figure.list) part.setVisible(false);
    // La imagen va en un contenedor parado en los pies que se estira y se aplasta (ui/motion.js).
    this.rig = scene.add.container(0, this.baseRadius);
    this.rig.baseY = this.baseRadius;
    this.image = scene.add.image(0, 0, key).setOrigin(0.5, 1);
    this.image.setScale((this.baseRadius * 2.8) / this.image.height);
    this.rig.add(this.image);
    this.sprite.figure.addAt(this.rig, 0);
    if (!fixed) {
      const art = () => (this.superMs > 0 && this.superArt ? this.superArt : this.characterKey);
      const onDust = (x, y, dir, count) => dustPuff(scene, x, y, dir, count, this.sprite.parentContainer ?? null, this.sprite.depth + 1);
      this.motion = new Motion(this.rig, { has: (pose) => hasPose(scene, art(), pose), onDust });
      requestPoses(scene, this.characterKey, EXPRESSION_POSES);
    }
    this.ring = scene.add.ellipse(0, this.baseRadius - 2, this.baseRadius * 2.4, this.baseRadius * 0.6).setStrokeStyle(5, this.color);
    this.sprite.addAt(this.ring, 1);
  }

  spawn(x, y, invulnerableMs = RESPAWN_INVULNERABLE_MS) {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.facing = x < 1000 ? 1 : -1;
    this.grounded = false;
    this.platform = null;
    this.airJumps = this.stats.airJumps;
    this.rescueUsed = false;
    this.attack = null;
    this.hitstunMs = 0;
    this.stunMs = 0;
    this.dashMs = 0;
    this.slideMs = 0;
    this.rocketMs = 0;
    this.cooldownMs = 0;
    this.ghostMs = 0;
    this.transformMs = 0;
    this.projectileRequest = null;
    this.shielding = false;
    this.shieldHp = SHIELD_MAX;
    this.shieldHeldMs = 0;
    this.held = null;
    this.starPowerMs = 0;
    this.skateMs = 0;
    this.umbrellaMs = 0;
    this.wetMs = 0;
    this.pieMs = 0;
    this.holding = null;
    this.heldBy = null;
    this.rollMs = 0;
    this.rollDir = 0;
    this.airDodgeMs = 0;
    this.airDodgeUsed = false;
    this.hanging = null;
    this.ledgeCooldownMs = 0;
    this.prevShield = false;
    this.prevX = 0;
    this.invulnerableMs = invulnerableMs;
    this.dropMs = 0;
    this.respawnMs = 0;
    this.out = false;
    this.sprite.setVisible(true);
    this.sprite.ball.setFillStyle(this.color);
    this.baseTint();
    this.tinted = false;
  }

  isAlive() {
    return this.stocks > 0 && !this.out;
  }

  // Qué tanto se agarra del piso (mojado por un globo de agua casi no frena: se resbala).
  get grip() {
    return this.wetMs > 0 ? WET_GRIP : 1;
  }

  // Recién reaparecido, con la estrella, transformándose o invisible (Fantasma): no le pasa nada.
  isInvulnerable() {
    return this.invulnerableMs > 0 || this.starPowerMs > 0 || this.transformMs > 0 || this.ghostMs > 0 || this.rollMs > 0 || this.airDodgeMs > 0;
  }

  // Se salió de la pantalla: pierde una vida y, si le quedan, reaparece arriba del escenario.
  // Si estaba transformado, se le acaba el súper modo (la barra que llevaba no se pierde).
  knockOut() {
    // (En el modo Tiempo y en Rompe los blancos las vidas no se acaban.)
    if (!this.infinite) this.stocks -= 1;
    this.record.falls += 1;
    this.out = true;
    this.respawnMs = RESPAWN_MS;
    this.held = null;
    this.starPowerMs = 0;
    this.skateMs = 0;
    this.umbrellaMs = 0;
    this.wetMs = 0;
    this.pieMs = 0;
    this.finalReady = false;
    this.releaseHold();
    if (this.superMs > 0) this.setSuper(false);
    this.sprite.setVisible(false);
  }

  // Agarra un objeto que tocó. Devuelve false si no lo puede agarrar (ya trae algo en la mano).
  grab(type) {
    if (type === 'heart') {
      this.damage = Math.max(0, this.damage - HEART_HEAL);
      return true;
    }
    if (type === 'star') {
      this.starPowerMs = STAR_POWER_MS;
      return true;
    }
    if (type === 'skate') {
      this.skateMs = SKATE_MS;
      return true;
    }
    if (type === 'umbrella') {
      this.umbrellaMs = UMBRELLA_MS;
      return true;
    }
    // El huevo, la cápsula y el tornado los pone la escena (el ayudante, lo que sale de la cápsula y el tornado).
    if (type === 'egg' || type === 'capsule' || type === 'tornado') return true;
    if (this.held) return false;
    this.held = { type, ms: type === 'hammer' ? HAMMER_MS : Infinity, uses: HELD_USES[type] ?? Infinity };
    return true;
  }

  // Suelta al que tenía agarrado (o se suelta del que lo tenía).
  releaseHold() {
    if (this.holding) this.holding.heldBy = null;
    if (this.heldBy) this.heldBy.holding = null;
    this.holding = null;
    this.heldBy = null;
  }

  // --- Barra de poder y súper modo ---

  addMeter(amount) {
    if (this.superMs > 0 || this.out || this.isDummy) return;
    this.meter = Math.min(METER_MAX, this.meter + amount * (this.peque ? PEQUE_METER_BONUS : 1));
  }

  // Le pegó a alguien (con el cuerpo, un proyectil o una bomba): llena su barra.
  dealtDamage(amount) {
    this.addMeter(amount * METER_PER_DAMAGE_DEALT);
  }

  canTransform() {
    return this.meter >= METER_MAX && this.superMs === 0 && this.isAlive();
  }

  // Barra llena + LB + RB. Devuelve true si se transformó (la escena pone los efectos).
  transform() {
    if (!this.canTransform()) return false;
    this.meter = 0;
    this.superMs = SUPER_MS;
    this.transformMs = TRANSFORM_MS;
    this.attack = null;
    this.dashMs = 0;
    this.slideMs = 0;
    this.rocketMs = 0;
    this.shielding = false;
    this.setSuper(true);
    sfx.transform();
    return true;
  }

  setSuper(on) {
    if (!on) this.superMs = 0;
    if (this.blocks) {
      this.look.setSuper(on);
      this.applyForm();
      return;
    }
    const stats = this.baseStats;
    this.radius = on ? Math.round(stats.radius * SUPER.size) : stats.radius;
    this.power = stats.power * (on ? SUPER.power : 1);
    this.weight = stats.weight * (on ? SUPER.weight : 1);
    // Todo el dibujo crece igual; con los pies en el mismo piso.
    this.sprite.setScale(this.radius / this.baseRadius);
    if (this.grounded && this.platform) this.y = this.platform.top - this.radius;
  }

  // Bloquecito cambió de número (o se volvió Octobloque): su fuerza, peso, velocidad y tamaño son los de ese número.
  // El 1 es chiquito, ligero y rápido; el 10, grandote, pesado y fuerte. Los pies se quedan donde estaban.
  applyForm() {
    const body = this.look.body;
    const form = this.look.form;
    const k = numberSize(form);
    const isSuper = this.superMs > 0;
    const feet = this.y + this.radius;
    this.stats = {
      ...CHARACTERS[this.characterKey],
      weight: lerp(0.7, 1.4, k),
      power: lerp(0.75, 1.35, k),
      run: lerp(480, 290, k),
      air: lerp(390, 270, k),
      jump: lerp(870, 720, k),
      airJumps: form !== OCTO && form <= 3 ? 2 : 1,
    };
    this.power = this.stats.power * (isSuper ? SUPER.power : 1);
    this.weight = this.stats.weight * (isSuper ? SUPER.weight : 1);
    this.hitScale = lerp(0.8, 1.3, k) * (isSuper ? SUPER.size : 1);
    this.airJumps = Math.min(this.airJumps, this.stats.airJumps);
    // Para la física es un círculo del ancho del cuerpo; lo que sobra para arriba cuenta para los golpes (distanceTo).
    this.radius = Math.max(14, body.width * 0.55);
    this.tall = Math.max(0, body.height - this.radius * 2);
    this.attackLift = Math.max(0, -body.shoulder - this.radius);
    this.y = feet - this.radius;
    body.setY(this.radius);
    const middle = this.radius - body.height / 2;
    const around = Math.max(body.width, body.height) / 2;
    this.ring.setPosition(0, this.radius - 2).setSize(Math.max(40, body.width * 1.6), Math.max(14, body.width * 0.4));
    this.shieldBubble.setPosition(0, middle).setRadius(around * 1.15);
    this.aura.setPosition(0, middle).setRadius(around * 1.25);
  }

  // Y (o ↓ + Y): Bloquecito sube o baja un número. Los jugadores además lo oyen en voz alta.
  changeNumber(step) {
    if (!this.blocks || !this.isAlive() || this.transformMs > 0) return;
    if (this.look.changeNumber(step, this.isCpu ? null : this.deviceId) === null) return;
    this.applyForm();
  }

  // Tamaño de sus golpes y disparos: crece en súper modo; el de Bloquecito, con su número.
  get sizeScale() {
    return this.blocks ? this.hitScale : this.radius / this.baseRadius;
  }

  // Distancia de un golpe al cuerpo, para ver si le llega. Las bolitas son un círculo alrededor de (x, y);
  // Bloquecito, si es alto, es una "cápsula" que sube `this.tall` px desde ahí. El golpe también puede
  // subir `tall` px desde (px, py) (los de Bloquecito alto van de la cintura a los hombros).
  distanceTo(px, py, tall = 0) {
    const gap = Math.max(0, py - tall - this.y, this.y - this.tall - py);
    return Math.hypot(px - this.x, gap);
  }

  // A qué altura salen sus disparos: los de Bloquecito alto, de la panza (si no, les pasarían por arriba a los bajitos).
  shotY() {
    return this.y - Math.min(this.attackLift, SHOT_LIFT_MAX);
  }

  // input: { x, y (stick), jump, attack, special (recién apretados), shield (sostenido), change (Bloquecito: 1, -1 o 0) }
  update(dtMs, input) {
    const dt = dtMs / 1000;
    if (this.out) {
      if (this.stocks > 0) {
        this.respawnMs -= dtMs;
        if (this.respawnMs <= 0) {
          this.damage = 0;
          this.spawn(this.arena.respawn.x, this.arena.respawn.y);
        }
      }
      return;
    }

    this.invulnerableMs = Math.max(0, this.invulnerableMs - dtMs);
    this.starPowerMs = Math.max(0, this.starPowerMs - dtMs);
    this.dropMs = Math.max(0, this.dropMs - dtMs);
    this.skateMs = Math.max(0, this.skateMs - dtMs);
    this.umbrellaMs = Math.max(0, this.umbrellaMs - dtMs);
    this.wetMs = Math.max(0, this.wetMs - dtMs);
    this.pieMs = Math.max(0, this.pieMs - dtMs);
    // Con pastel en la cara no ve: no puede pegar ni usar su especial (sí correr, saltar y cubrirse).
    if (this.pieMs > 0) input = { ...input, attack: false, attackHeld: false, special: false };
    this.rollMs = Math.max(0, this.rollMs - dtMs);
    this.airDodgeMs = Math.max(0, this.airDodgeMs - dtMs);
    this.ledgeCooldownMs = Math.max(0, this.ledgeCooldownMs - dtMs);
    this.hitstunMs = Math.max(0, this.hitstunMs - dtMs);
    this.stunMs = Math.max(0, this.stunMs - dtMs);
    this.dashMs = Math.max(0, this.dashMs - dtMs);
    this.slideMs = Math.max(0, this.slideMs - dtMs);
    this.rocketMs = Math.max(0, this.rocketMs - dtMs);
    this.cooldownMs = Math.max(0, this.cooldownMs - dtMs);
    this.ghostMs = Math.max(0, this.ghostMs - dtMs);
    this.transformMs = Math.max(0, this.transformMs - dtMs);
    if (input.change) this.changeNumber(input.change);
    if (this.superMs > 0) {
      this.superMs -= dtMs;
      if (this.superMs <= 0) {
        this.setSuper(false);
        sfx.powerDown();
      }
    }
    if (this.held) {
      this.held.ms -= dtMs;
      if (this.held.ms <= 0) this.held = null;
    }
    // Transformándose: se queda quieto en el aire un momento, como en las caricaturas.
    if (this.transformMs > 0) {
      this.vx = 0;
      this.vy = 0;
      return;
    }
    // Lo tienen agarrado: no hace nada (el que lo agarró lo pone enfrente y lo avienta).
    if (this.heldBy) {
      this.prevShield = input.shield;
      return;
    }
    // Colgado de la orilla: ↑, A o hacia el escenario = subirse; ↓ o hacia afuera = soltarse.
    if (this.hanging) {
      this.updateHanging(dtMs, input);
      this.prevShield = input.shield;
      return;
    }
    // Parado en una plataforma que se mueve: se va con ella.
    if (this.grounded && this.platform) this.x += this.platform.dx;
    this.advanceAttack(dtMs, input);
    this.advanceHold(dtMs, input);

    const canAct = this.hitstunMs === 0 && this.stunMs === 0 && !this.holding;
    // Esquivas: escudo + ◀ ▶ en el piso = rodada; escudo recién apretado en el aire = esquiva en el aire.
    const tilt = Math.abs(input.x) > 0.7 && Math.abs(this.prevX) <= 0.7;
    if (canAct && this.rollMs === 0 && this.grounded && input.shield && tilt && !this.attack) {
      this.rollMs = ROLL.ms;
      this.rollDir = Math.sign(input.x);
      this.shielding = false;
      this.scene.dust?.(this.x, this.y + this.radius, -this.rollDir);
      sfx.jump();
    }
    if (canAct && !this.grounded && input.shield && !this.prevShield && !this.airDodgeUsed && !this.attack) {
      this.airDodgeMs = AIR_DODGE_MS;
      this.airDodgeUsed = true;
      this.vx *= 0.3;
      this.vy = Math.min(this.vy, 0) * 0.3;
    }
    this.prevShield = input.shield;
    this.prevX = input.x;
    if (canAct && this.rollMs > 0) {
      this.vx = this.rollDir * ROLL.speed;
    } else if (canAct) {
      // Escudo + X: agarrar al de enfrente.
      if (this.grounded && input.shield && input.attack && !this.attack && !this.held) {
        this.shielding = false;
        this.attack = { type: 'grabbing', elapsed: 0, hit: new Set() };
        this.scene.practiced?.(this, 'grab');
      }
      // El escudo solo se usa en el piso; saltar lo cancela.
      this.shielding = this.grounded && input.shield && !this.attack && !input.jump;
      if (this.shielding) {
        this.vx = approach(this.vx, 0, GROUND_FRICTION * this.grip * dt);
        this.shieldHp -= SHIELD_DRAIN * dt;
        if (this.shieldHp <= 0) this.breakShield();
      } else {
        this.control(dt, input);
      }
    } else {
      this.shielding = false;
      this.vx *= Math.exp(-LAUNCH_DRAG * dt);
      if (this.grounded) this.vx = approach(this.vx, 0, GROUND_FRICTION * this.grip * dt);
    }
    if (!this.shielding) this.shieldHp = Math.min(SHIELD_MAX, this.shieldHp + SHIELD_REGEN * dt);
    // Cuánto lleva con el escudo arriba (recién levantado = escudo perfecto).
    this.shieldHeldMs = this.shielding ? this.shieldHeldMs + dtMs : 0;

    // Durante la embestida de Rayo no hay gravedad: va en línea recta.
    // Dragoncito y Fantasma caen más despacio (gravity < 1), y en el Espacio todos.
    const gravity = (this.stats.gravity ?? 1) * (this.arena.gravity ?? 1);
    if (this.dashMs > 0) this.vy = 0;
    else if (this.rocketMs > 0) this.vy = -ROCKET.rise;
    else this.vy = Math.min(MAX_FALL * gravity, this.vy + GRAVITY * gravity * dt);
    // Con el paraguas abierto cae despacito (si no va saliendo volando por un golpe).
    if (this.umbrellaMs > 0 && this.hitstunMs === 0 && this.vy > UMBRELLA_FALL) this.vy = UMBRELLA_FALL;
    const prevFeet = this.y + this.radius;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.collide(prevFeet);
    if (!this.grounded) this.tryLedge();
    else this.airDodgeUsed = false;
  }

  // Si va cayendo junto a una esquina del escenario principal, se agarra de la orilla.
  tryLedge() {
    if (this.noLedge || this.vy <= 0 || this.hitstunMs > 0 || this.ledgeCooldownMs > 0 || this.held?.type === 'bomb') return;
    const main = this.arena.platforms.find((p) => p.main);
    if (!main) return;
    for (const side of [-1, 1]) {
      const edgeX = side < 0 ? main.left : main.right;
      const outside = (this.x - edgeX) * side;
      if (outside < this.radius * 0.2 || outside > this.radius * LEDGE.reach) continue;
      if (this.y < main.top - this.radius || this.y > main.top + this.radius * LEDGE.below) continue;
      this.hanging = { platform: main, side, ms: LEDGE.hangMs };
      this.x = edgeX + side * this.radius * 0.8;
      this.y = main.top + this.radius * 1.15;
      this.vx = 0;
      this.vy = 0;
      this.facing = -side;
      this.airJumps = this.stats.airJumps;
      this.rescueUsed = false;
      this.attack = null;
      this.invulnerableMs = Math.max(this.invulnerableMs, LEDGE.invulnerableMs);
      this.scene.practiced?.(this, 'ledge');
      sfx.select();
      return;
    }
  }

  updateHanging(dtMs, input) {
    const h = this.hanging;
    h.ms -= dtMs;
    const toward = Math.sign(input.x) === -h.side && Math.abs(input.x) > 0.5;
    const away = Math.sign(input.x) === h.side && Math.abs(input.x) > 0.5;
    if (input.jump || input.y < -0.5 || toward || h.ms <= 0) {
      // Se sube de un brinquito al escenario.
      const p = h.platform;
      this.hanging = null;
      this.x = (h.side < 0 ? p.left : p.right) - h.side * this.radius * 1.2;
      this.y = p.top - this.radius;
      this.vx = 0;
      this.vy = 0;
      this.grounded = true;
      this.platform = p;
      sfx.jump();
    } else if (input.y > 0.5 || away) {
      this.hanging = null;
      this.ledgeCooldownMs = LEDGE.dropMs;
      this.vy = 100;
    }
  }

  // Tiene a alguien agarrado: lo pone enfrente y, al rato, lo avienta (hacia donde apunte el stick).
  advanceHold(dtMs, input) {
    const victim = this.holding;
    if (!victim) return;
    if (!victim.isAlive() || this.hitstunMs > 0) {
      this.releaseHold();
      return;
    }
    this.holdMs -= dtMs;
    victim.x = this.x + this.facing * (this.radius + victim.radius) * 0.85;
    victim.y = this.y + this.radius - victim.radius;
    victim.vx = 0;
    victim.vy = 0;
    if (Math.abs(input.x) > 0.5) this.throwDir = Math.sign(input.x);
    if (input.y < -0.5) this.throwUp = true;
    if (this.holdMs > 0) return;
    const dir = this.throwDir ?? this.facing;
    this.facing = dir;
    const hit = { ...THROW_HIT, angle: this.throwUp ? 82 : THROW_HIT.angle };
    this.releaseHold();
    this.throwDir = null;
    this.throwUp = false;
    this.scene.throwFighter?.(this, victim, hit);
  }

  // La escena avisa que el agarre le llegó a alguien.
  startHold(victim) {
    this.releaseHold();
    victim.releaseHold();
    this.holding = victim;
    victim.heldBy = this;
    victim.attack = null;
    victim.shielding = false;
    victim.hanging = null;
    this.holdMs = HOLD_MS;
    this.attack = null;
  }

  advanceAttack(dtMs, input = {}) {
    if (!this.attack) return;
    const attack = this.attack;
    const a = ATTACKS[attack.type];
    // Golpe cargado: con X sostenido se queda justo antes de pegar, juntando fuerza (hasta el máximo).
    if (attack.chargeable && !attack.released) {
      if (!input.attackHeld || !this.grounded) attack.released = true;
      else if (attack.elapsed + dtMs >= a.startup) {
        const before = attack.charge;
        attack.elapsed = a.startup - 1;
        attack.charge = Math.min(CHARGE_MAX_MS, attack.charge + dtMs);
        if (before < CHARGE_SHOW_MS && attack.charge >= CHARGE_SHOW_MS) sfx.special();
        if (attack.charge >= CHARGE_MAX_MS) {
          attack.released = true;
          sfx.meterFull();
        }
        return;
      }
    }
    const wasStarting = attack.elapsed < a.startup;
    attack.elapsed += dtMs;
    const justActive = wasStarting && attack.elapsed >= a.startup;
    if (justActive && attack.type === 'charge') this.vx = this.facing * CHARGE_LUNGE;
    if (justActive && attack.type === 'scratch') this.vx = this.facing * SCRATCH_LUNGE;
    if (justActive && (attack.type === 'slide' || attack.type === 'roll')) this.slideMs = SLIDE_MS;
    if (justActive && attack.type === 'square') {
      if (!this.grounded) this.vy = SQUARE_SLAM_SPEED;
      sfx.hit(0.7);
    }
    if (justActive && attack.type === 'juggle') {
      this.projectileRequest = { kind: 'juggle', x: this.x + this.facing * (this.radius + 10), y: this.shotY() - 10, dir: this.facing, throws: JUGGLE_THROWS };
      sfx.throw();
    }
    if (justActive && attack.type === 'rainbow') {
      this.projectileRequest = { kind: 'rainbow', x: this.x + this.facing * (this.radius + 40), y: this.shotY(), dir: this.facing };
      sfx.laser();
    }
    if (justActive && attack.type === 'rocket') {
      this.rocketMs = ROCKET.ms;
      this.grounded = false;
      this.platform = null;
    }
    if (justActive && attack.type === 'wand') {
      this.projectileRequest = { kind: 'dust', x: this.x + this.facing * (this.radius + 14), y: this.y - 8, dir: this.facing };
      sfx.star();
    }
    if (justActive && attack.type === 'cannon') {
      this.projectileRequest = {
        kind: 'cannon',
        x: this.x + this.facing * (this.radius + 16),
        y: this.y - 10,
        vx: this.facing * CANNON_THROW.vx,
        vy: CANNON_THROW.vy,
        dir: this.facing,
      };
      sfx.boom();
    }
    if (justActive && attack.type === 'cast') {
      this.projectileRequest = { kind: 'star', x: this.x + this.facing * (this.radius + 12), y: this.shotY() - 6, dir: this.facing };
    }
    if (justActive && attack.type === 'laser') {
      this.projectileRequest = { kind: 'laser', x: this.x + this.facing * (this.radius + 30), y: this.y - 4, dir: this.facing };
      sfx.laser();
    }
    if (justActive && attack.type === 'zap') {
      this.projectileRequest = { kind: 'zap', x: this.x + this.facing * (this.radius + 30), y: this.y - 6, dir: this.facing };
      if (--this.held.uses <= 0) this.held = null;
      sfx.laser();
    }
    if (justActive && attack.type === 'flame' && this.held) {
      this.projectileRequest = {
        kind: 'fireball',
        x: this.x + this.facing * (this.radius + 14),
        y: this.y - 6,
        vx: this.facing * FIREBALL_THROW.vx,
        vy: FIREBALL_THROW.vy,
        dir: this.facing,
      };
      if (--this.held.uses <= 0) this.held = null;
      sfx.fire();
    }
    if (justActive && attack.type === 'boomerang' && this.held) {
      this.projectileRequest = { kind: 'boomerang', x: this.x + this.facing * (this.radius + 18), y: this.y - 8, vx: this.facing * BOOMERANG_SPEED, dir: this.facing };
      this.held.out = true;
      this.held.uses -= 1;
      sfx.throw();
    }
    if (justActive && attack.type === 'rocketfist') {
      this.projectileRequest = { kind: 'fist', x: this.x + this.facing * (this.radius + 30), y: this.y - 6, dir: this.facing };
      sfx.laser();
    }
    if (justActive && attack.type === 'bat' && this.held && --this.held.uses <= 0) {
      // El último batazo: el bate se rompe después de pegar.
      this.held.ms = a.active + a.recovery;
    }
    // El globo de agua sale en arco y el pastel derecho; los dos se acaban al aventarlos.
    if (justActive && attack.type === 'lob') {
      this.projectileRequest = { kind: 'balloon', x: this.x + this.facing * (this.radius + 10), y: this.y - 20, vx: this.facing * BALLOON_THROW.vx, vy: BALLOON_THROW.vy, dir: this.facing };
      this.held = null;
      sfx.throw();
    }
    if (justActive && attack.type === 'toss') {
      this.projectileRequest = { kind: 'pie', x: this.x + this.facing * (this.radius + 14), y: this.shotY() - 6, dir: this.facing };
      this.held = null;
      sfx.throw();
    }
    // El imán jala a los rivales de alrededor (lo hace la escena).
    if (justActive && attack.type === 'pull' && this.held) {
      this.projectileRequest = { kind: 'magnet' };
      if (--this.held.uses <= 0) this.held = null;
    }
    if (justActive && attack.type === 'throw') {
      this.projectileRequest = {
        kind: 'bomb',
        x: this.x + this.facing * (this.radius + 10),
        y: this.y - 20,
        vx: this.facing * BOMB_THROW.vx,
        vy: BOMB_THROW.vy,
        dir: this.facing,
      };
      this.held = null;
      sfx.throw();
    }
    // Golpes de varios toques: cada `multi` ms puede volver a pegarle a los mismos.
    if (a.multi && attack.elapsed >= a.startup) {
      const tick = Math.floor((attack.elapsed - a.startup) / a.multi);
      if (tick !== attack.tick) {
        attack.tick = tick;
        attack.hit.clear();
      }
    }
    if (attack.elapsed >= a.startup + a.active + a.recovery) this.attack = null;
  }

  control(dt, input) {
    const stats = this.stats;
    const isSuper = this.superMs > 0;
    const speedBonus = (this.starPowerMs > 0 ? STAR_SPEED_BONUS : 1) * (isSuper ? SUPER.speed : 1) * (this.skateMs > 0 ? SKATE_SPEED : 1);
    const jump = stats.jump * (isSuper ? SUPER.jump : 1);
    if (!this.attack && Math.abs(input.x) > 0.2) this.facing = Math.sign(input.x);
    if (this.dashMs > 0) {
      this.vx = this.facing * DASH_SPEED;
    } else if (this.slideMs > 0) {
      this.vx = this.facing * SLIDE_SPEED;
    } else if (this.rocketMs > 0) {
      this.vx = this.facing * ROCKET.vx;
    } else if (this.grounded) {
      // Atacando sigue caminando, un poco más despacio (no se queda frenado); cargando un golpe, nada.
      const slow = this.attack?.charge > 0 ? 0 : this.attack ? 0.65 : 1;
      this.vx = approach(this.vx, input.x * stats.run * slow * speedBonus, GROUND_FRICTION * this.grip * dt);
    } else {
      this.vx = approach(this.vx, input.x * stats.air * speedBonus, AIR_ACCEL * dt);
    }

    if (input.jump && this.dashMs === 0) {
      if (this.grounded) {
        this.vy = -jump;
        this.grounded = false;
        sfx.jump();
      } else if (this.airJumps > 0) {
        this.vy = -jump * 0.92;
        this.airJumps -= 1;
        sfx.jump();
      }
    }
    // Bajar de una plataforma delgada: ↓ estando parado en ella.
    if (this.grounded && this.platform?.soft && input.y > 0.6) {
      this.dropMs = DROP_MS;
      this.grounded = false;
      this.y += 4;
    }
    if (input.special) this.startSpecial(input);
    else if (input.attack && !this.attack) this.startAttack(input);
  }

  startAttack(input) {
    let type = 'jab';
    if (this.held?.type === 'hammer') type = 'hammer';
    else if (this.held?.type === 'bomb') type = 'throw';
    else if (this.held?.type === 'bat') type = 'bat';
    else if (this.held?.type === 'raygun') type = 'zap';
    else if (this.held?.type === 'fireflower') type = 'flame';
    else if (this.held?.type === 'boomerang' && !this.held.out) type = 'boomerang';
    else if (this.held?.type === 'waterballoon') type = 'lob';
    else if (this.held?.type === 'pie') type = 'toss';
    else if (this.held?.type === 'magnet') type = 'pull';
    else if (input.y < -0.5) type = 'up';
    else if (input.y > 0.5) type = this.grounded ? 'sweep' : 'stomp';
    // Los golpes normales en el piso se pueden cargar (manteniendo X).
    this.attack = { type, elapsed: 0, hit: new Set(), chargeable: this.grounded && CHARGEABLE.includes(type), charge: 0, released: false };
  }

  // B: el especial del personaje. B + ↑ es el salto de rescate (una vez antes de tocar piso);
  // el de Resorte es su súper salto, que además golpea.
  startSpecial(input) {
    if (this.attack) return;
    // Con la bola súper rota: B = ¡golpe final!
    if (this.finalReady && this.scene.startFinal?.(this)) {
      this.finalReady = false;
      return;
    }
    const key = this.characterKey;
    if (input.y < -0.5 || key === 'resorte') {
      if (this.rescueUsed) return;
      this.rescueUsed = true;
      sfx.special();
      this.grounded = false;
      this.platform = null;
      if (key === 'resorte') {
        this.vy = -SPRING_SPEED;
        this.attack = { type: 'spring', elapsed: 0, hit: new Set() };
        // (El súper salto es el especial de Resorte: cuenta para el combo de dúo.)
        this.scene.specialUsed?.(this);
      } else {
        this.vy = -RESCUE_SPEED;
      }
      return;
    }
    if (this.cooldownMs > 0) return;
    const attack = (type) => {
      this.attack = { type, elapsed: 0, hit: new Set() };
    };
    let sound = sfx.special;
    let cooldown = SPECIAL_COOLDOWN_MS[key] ?? 0;
    if (this.blocks) {
      // Bloquecito: el truco de su número (los que lanzan algo suenan al lanzarlo).
      const trick = BLOCK_TRICKS[this.look.form];
      attack(trick.attack);
      if (trick.attack === 'dash') this.dashMs = DASH_MS;
      cooldown = trick.cooldown;
      if (['juggle', 'rainbow', 'square'].includes(trick.attack)) sound = null;
      else if (trick.attack === 'rocket') sound = sfx.fire;
    } else if (key === 'tanque') {
      attack('charge');
    } else if (key === 'rayo') {
      attack('dash');
      this.dashMs = DASH_MS;
    } else if (key === 'estrella') {
      attack('cast');
    } else if (key === 'robot') {
      attack('laser');
      sound = null;
    } else if (key === 'ninja') {
      attack('ambush');
      this.projectileRequest = { kind: 'teleport' };
      sound = sfx.poof;
    } else if (key === 'dragon') {
      attack('fire');
      sound = sfx.fire;
    } else if (key === 'fantasma') {
      this.ghostMs = GHOST_MS * (this.superMs > 0 ? 1.5 : 1);
      sound = sfx.ghost;
    } else if (key === 'dino') {
      attack('tail');
    } else if (key === 'gatito') {
      attack('scratch');
    } else if (key === 'pinguino') {
      attack('slide');
      sound = sfx.jump;
    } else if (key === 'pirata') {
      attack('cannon');
      sound = null;
    } else if (key === 'hada') {
      attack('wand');
      sound = null;
    } else if (key === 'astronauta') {
      attack('rocket');
      sound = sfx.fire;
    } else if (key === 'abeja') {
      attack('sting');
      this.dashMs = STING_MS;
    } else if (key === 'bombero') {
      attack('water');
      sound = sfx.fire;
    } else if (key === 'luchador') {
      // La plancha: brinca y cae aplastando (como el Rey Bolón, pero de su tamaño).
      if (this.grounded) {
        this.vy = -this.stats.jump * 0.8;
        this.grounded = false;
        this.platform = null;
      }
      attack('square');
      sound = sfx.jump;
    } else if (key === 'unicornio') {
      // Un rayo de arcoíris que sale de su cuerno.
      attack('rainbow');
      sound = null;
    } else if (key === 'dragonzote') {
      attack('blaze');
      sound = sfx.fire;
    } else if (key === 'robotote') {
      attack('rocketfist');
      sound = null;
    } else if (key === 'rey' || this.isBoss) {
      // El Rey Bolón: cae aplastando (en el piso, primero da un brinco).
      if (this.grounded) {
        this.vy = -this.stats.jump * 0.8;
        this.grounded = false;
        this.platform = null;
      }
      attack('square');
      sound = sfx.jump;
    } else {
      return;
    }
    // Los jefes gigantes esperan más entre especial y especial.
    if (this.isBoss && this.slamCooldownMs) cooldown = this.slamCooldownMs;
    this.cooldownMs = cooldown * (this.superMs > 0 ? SUPER.cooldown : 1);
    sound?.();
    // Si un compañero hizo su especial casi al mismo tiempo y cerquita: ¡combo de dúo! (lo revisa la escena).
    this.scene.specialUsed?.(this);
  }

  breakShield() {
    sfx.shieldBreak();
    this.shielding = false;
    this.shieldHp = SHIELD_MAX * 0.4;
    this.stunMs = SHIELD_BREAK_STUN_MS;
    this.vy = -400;
    this.grounded = false;
    this.platform = null;
  }

  // Las plataformas solo detienen al caer sobre ellas (se atraviesan desde abajo).
  collide(prevFeet) {
    const feet = this.y + this.radius;
    if (this.grounded) {
      const p = this.platform;
      if (this.x < p.left - this.radius * 0.5 || this.x > p.right + this.radius * 0.5) {
        this.grounded = false;
        this.platform = null;
      } else {
        this.y = p.top - this.radius;
        this.vy = 0;
        return;
      }
    }
    if (this.vy < 0) return;
    for (const p of this.arena.platforms) {
      if (p.soft && this.dropMs > 0) continue;
      const withinX = this.x >= p.left - this.radius * 0.5 && this.x <= p.right + this.radius * 0.5;
      // `p.dy` cuenta si la plataforma subió este cuadro (si no, una nube que sube "atravesaría" los pies).
      if (withinX && prevFeet <= p.top - p.dy + 1 && feet >= p.top) {
        this.y = p.top - this.radius;
        this.vy = 0;
        this.grounded = true;
        this.platform = p;
        this.airJumps = this.stats.airJumps;
        this.rescueUsed = false;
        return;
      }
    }
  }

  // Zona del golpe mientras está activo (o null). En súper modo crece con el personaje.
  hitbox() {
    if (!this.attack || this.out) return null;
    const a = ATTACKS[this.attack.type];
    const t = this.attack.elapsed;
    if (!a.active || t < a.startup || t >= a.startup + a.active) return null;
    const size = this.sizeScale;
    // Cargado: pega más fuerte, más lejos y con un golpe más grande.
    const boost = this.chargeBoost();
    const data = boost ? { ...a, damage: a.damage * (1 + CHARGE_BOOST.damage * boost), base: a.base * (1 + CHARGE_BOOST.base * boost), charged: boost } : a;
    const radius = a.radius * size * (1 + CHARGE_BOOST.radius * boost);
    return { x: this.x + a.hx * size * this.facing, y: this.y + a.hy * size, tall: this.attackLift, radius, data };
  }

  // Qué tanto se cargó el golpe que trae (0 a 1; 0 si no se cargó).
  chargeBoost() {
    const charge = this.attack?.charge ?? 0;
    return charge > CHARGE_SHOW_MS ? Math.min(1, charge / CHARGE_MAX_MS) : 0;
  }

  // Recibe un golpe de `source` ({ facing, power }). Con el escudo arriba solo gasta escudo;
  // si no, sube el % y sale volando, más fuerte entre más daño lleve y menos pese.
  // Devuelve cuánto daño le hicieron (`dealt`) para llenar la barra del que pegó.
  takeHit(source, data) {
    if (this.shielding) {
      // Escudo perfecto: recién levantado no gasta nada (la escena marea al que pegó o le regresa el disparo).
      if (this.shieldHeldMs < PERFECT_SHIELD_MS && (!this.isCpu || Math.random() < this.perfectChance)) {
        this.record.perfects += 1;
        this.addMeter(PERFECT_METER);
        sfx.block();
        return { blocked: true, perfect: true, speed: 0, dealt: 0 };
      }
      this.shieldHp -= data.damage * source.power * SHIELD_HIT_FACTOR;
      this.vx = source.facing * SHIELD_PUSHBACK;
      if (this.shieldHp <= 0) this.breakShield();
      else sfx.block();
      return { blocked: true, speed: 0, dealt: 0 };
    }
    const peque = this.peque ? PEQUE_DAMAGE : 1;
    const dealt = data.damage * source.power * peque;
    // El jefe no junta %: se le baja su barra de vida (y casi no se mueve con los golpes).
    if (this.isBoss) this.bossHp = Math.max(0, this.bossHp - dealt);
    else this.damage += dealt;
    this.addMeter(dealt * METER_PER_DAMAGE_TAKEN);
    const speed = ((data.base * source.power + this.damage * data.scale) / this.weight) * (this.peque ? PEQUE_KNOCKBACK : 1);
    const angle = (data.angle * Math.PI) / 180;
    // Los golpes "alrededor" avientan hacia afuera del que pegó, no hacia donde mira.
    const dir = data.around ? Math.sign(this.x - source.x) || source.facing : source.facing;
    this.vx = Math.cos(angle) * speed * dir;
    this.vy = -Math.sin(angle) * speed;
    this.hitstunMs = speed * HITSTUN_PER_SPEED;
    this.stunMs = 0;
    this.hanging = null;
    this.releaseHold();
    this.dashMs = 0;
    this.slideMs = 0;
    this.rocketMs = 0;
    this.grounded = false;
    this.platform = null;
    this.attack = null;
    this.sprite.flash();
    if (!this.image) this.sprite.squish();
    this.flashImage();
    return { blocked: false, speed, dealt };
  }

  // Con imagen, el destello del golpe es pintarla de blanco un instante.
  flashImage() {
    if (this.blocks) this.look.flash();
    if (!this.image) return;
    this.image.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
    this.scene.time.delayedCall(70, () => {
      if (this.image.active) this.baseTint();
      this.tinted = false;
    });
  }

  // El color de su traje (o ninguno): la imagen se pinta con ese color encima.
  baseTint() {
    if (!this.image) return;
    this.image.setTintMode(Phaser.TintModes.MULTIPLY);
    if (this.costume) this.image.setTint(this.costume);
    else this.image.clearTint();
  }

  setCostume(index) {
    this.costumeIndex = index;
    this.costume = COSTUMES[index] ?? null;
    this.baseTint();
  }

  // Pose de la imagen según lo que esté haciendo. La imagen mira a la derecha: se voltea si va a la izquierda.
  // En súper modo usa las imágenes de su súper forma, si las hay.
  renderArt() {
    this.punchArt = false;
    if (this.blocks) {
      this.renderBlocks();
      return;
    }
    if (!this.image) return;
    // Una imagen fija (el saco): solo se voltea.
    if (this.fixedArt) {
      this.image.setFlipX(this.facing < 0);
      return;
    }
    const art = this.superMs > 0 && this.superArt ? this.superArt : this.characterKey;
    // Corriendo por el piso: los cuadros de caminata (si los tiene).
    const walking = this.grounded && Math.abs(this.vx) > 40;
    this.walkStep = walking ? (this.walkStep ?? 0) + (frameDelta() * WALK_FPS) / 1000 : 0;
    let pose = (walking && walkPose(this.scene, art, this.walkStep)) || 'normal';
    const type = this.attack?.type;
    if (this.hitstunMs > 0 || this.stunMs > 0 || this.heldBy) pose = 'dolor';
    else if (this.holding || type === 'grabbing') pose = 'agarre';
    else if (this.hanging) pose = 'salto';
    else if (this.chargeBoost() > 0 && !this.attack.released) pose = 'carga';
    else if (type) pose = !this.grounded && AIR_POSE_ATTACKS.includes(type) ? 'aire' : (ATTACK_POSES[type] ?? 'golpe');
    else if (this.shielding) pose = 'cubrirse';
    else if (this.celebrating) pose = 'gana';
    else if (this.posing) pose = 'entrada';
    else if (!this.grounded) pose = 'salto';
    // (Las poses de pelea son opcionales: si el personaje no la tiene, usa la más parecida.)
    const shown = (POSE_CHAIN[pose] ?? [pose]).find((p) => hasPose(this.scene, art, p)) ?? 'normal';
    // (Se estira, se aplasta, parpadea, pone caras y baila.)
    const drawn = this.motion ? this.motion.frame(shown, this.x, this.y + this.radius) : shown;
    const key = characterTexture(this.scene, art, drawn);
    if (this.image.texture.key !== key) this.image.setTexture(key);
    this.image.setFlipX((this.motion?.flipped ? -this.facing : this.facing) < 0);
    // Igual de grande y parado en el mismo lugar en todas las poses.
    fitPose(this.image, this.baseRadius * 2.8, POSE_HEIGHT[shown] ?? 1);
    this.punchArt = hasPose(this.scene, art, 'golpe');
  }

  // Bloquecito: su pose (y el truco que está haciendo) para que BlockBody lo dibuje.
  renderBlocks() {
    this.punchArt = true;
    let pose = this.look.groundPose(this.grounded && Math.abs(this.vx) > 40);
    const type = this.attack?.type;
    if (this.hitstunMs > 0 || this.stunMs > 0) pose = 'dolor';
    else if (type) pose = BLOCK_POSES[type] ?? 'golpe';
    else if (!this.grounded) pose = 'salto';
    else if (this.shielding) pose = 'cubrirse';
    const trick = BLOCK_TRICKS[this.look.form];
    this.look.show(pose, this.facing, type === trick.attack ? trick.action : null);
    // El letrero y el mareo van arriba de la cabeza, que sube y baja con el número.
    const top = this.radius + this.look.body.top;
    this.tag.setY(top - 14);
    this.dizzy.setY(top - 40);
  }

  render() {
    if (this.out) return;
    const s = this.sprite;
    s.setPosition(this.x, this.y);
    s.look(this.facing * 0.9, this.hitstunMs > 0 ? -0.6 : 0);
    // Gira mientras sale volando por un golpe fuerte.
    s.figure.angle = this.hitstunMs > 150 ? s.figure.angle + 25 * this.facing : 0;
    const blinking = this.invulnerableMs > 0 && Math.floor(this.invulnerableMs / 90) % 2 === 1;
    s.setAlpha(this.ghostMs > 0 ? 0.25 : blinking ? 0.35 : this.rollMs > 0 || this.airDodgeMs > 0 ? 0.55 : 1);
    // Rodando, la bolita da la vuelta.
    if (this.rollMs > 0) s.figure.angle = this.rollDir * 360 * (1 - this.rollMs / ROLL.ms);
    // La bola súper: un brillo de colores que cambia.
    this.finalGlow.setVisible(Boolean(this.finalReady));
    if (this.finalReady) this.finalGlow.setFillStyle(RAINBOW[Math.floor(this.scene.time.now / 100) % RAINBOW.length], 0.4).setScale(1 + 0.12 * Math.sin(this.scene.time.now / 80));
    // La patineta va debajo de los pies.
    this.skateSprite.setVisible(this.skateMs > 0 && this.grounded);
    if (this.skateMs > 0) this.skateSprite.setPosition(0, this.radius + 6).setScale(1.3 * this.facing, 1.3);
    // Con la estrella cambia de colores como arcoíris; en súper modo sin imagen propia, se pone dorado.
    // En "pantalla" la imagen se aclara con el color (multiplicar la oscurecería casi a negro).
    const rainbow = RAINBOW[Math.floor(this.starPowerMs / 80) % RAINBOW.length];
    let tint = null;
    if (this.starPowerMs > 0) tint = rainbow;
    else if (this.superMs > 0 && !this.superArt) tint = SUPER_TINT;
    if (tint !== null) {
      s.ball.setFillStyle(this.starPowerMs > 0 ? rainbow : this.color);
      this.image?.setTintMode(Phaser.TintModes.SCREEN).setTint(tint);
    } else if (this.tinted) {
      s.ball.setFillStyle(this.color);
      this.baseTint();
    }
    this.look?.body?.setTint(this.starPowerMs > 0 ? rainbow : null);
    this.tinted = tint !== null;
    this.renderArt();
    this.renderAura();
    // Cargando el golpe: brilla cada vez más y tiembla (ya lleno, parpadea rápido).
    const charging = this.chargeBoost() > 0 && !this.attack.released;
    this.chargeGlow.setVisible(charging);
    s.figure.x = 0;
    if (charging) {
      const k = this.chargeBoost();
      const blink = Math.floor(this.scene.time.now / (k >= 1 ? 50 : 110)) % 2 === 0;
      this.chargeGlow.setScale(0.8 + 0.8 * k).setFillStyle(blink ? 0xffffff : 0xffd84d, 0.25 + 0.35 * k);
      s.figure.x = Math.sin(this.scene.time.now / 18) * 3 * k;
    }

    this.shieldBubble.setVisible(this.shielding);
    if (this.shielding) this.shieldBubble.setScale(0.55 + (0.45 * this.shieldHp) / SHIELD_MAX);
    this.dizzy.setVisible(this.stunMs > 0);

    const box = this.hitbox();
    const a = this.attack && ATTACKS[this.attack.type];
    const type = this.attack?.type;
    // El puño sale en los golpes normales y en el puñetazo cargado (si la imagen no trae su pose de golpe).
    const noFist = ['dash', 'spring', 'hammer', 'throw', 'fire', 'laser', 'tail', 'slide', 'cannon', 'wand', 'rocket', 'water', 'bat', 'zap', 'grabbing', 'flame', 'boomerang', 'blaze', 'rocketfist', 'lob', 'toss', 'pull'];
    const showFist = Boolean(a) && !noFist.includes(type) && !this.punchArt;
    this.fist.setVisible(showFist);
    if (showFist) {
      const reach = box ? 1 : 0.55;
      this.fist.setPosition((a.hx ?? 30) * this.facing * reach, (a.hy ?? 0) * reach);
      this.fist.setScale(type === 'charge' ? 1.6 : 1);
    }

    // El fuego de Dragoncito tiembla mientras está activo; con la mochila cohete sale chiquito por abajo.
    const fire = (type === 'fire' || type === 'blaze') && Boolean(box);
    // (Bloquecito dibuja su propio fuego de cohete.)
    const rocket = this.rocketMs > 0 && !this.blocks;
    this.flames.setVisible(fire || rocket);
    const flicker = 0.85 + Math.random() * 0.3;
    // (La llamarada de Dragonzote es mucho más grande.)
    const big = type === 'blaze' ? 1.8 : 1;
    if (fire) this.flames.setPosition(a.hx * this.facing, -4).setScale(this.facing * flicker * big, flicker * big).setAngle(0);
    else if (rocket) this.flames.setPosition(-this.facing * this.baseRadius * 0.5, this.baseRadius * 0.9).setScale(0.45 * flicker).setAngle(90);
    // El chorro de agua de Bombero.
    const water = type === 'water' && Boolean(box);
    this.water.setVisible(water);
    if (water) this.water.setPosition(a.hx * this.facing, -4).setScale(this.facing * flicker, 1);

    // El martillo se mueve de atrás hacia adelante al pegar.
    const hasHammer = this.held?.type === 'hammer';
    this.hammerSprite.setVisible(hasHammer);
    if (hasHammer) {
      let angle = -25;
      if (type === 'hammer') angle = -80 + 170 * Math.min(1, this.attack.elapsed / (a.startup + a.active));
      this.hammerSprite.setPosition(this.facing * this.handReach(0.85), -6 - this.attackLift).setScale(this.facing, 1).setAngle(angle * this.facing);
    }
    this.bombSprite.setVisible(this.held?.type === 'bomb');
    if (this.held?.type === 'bomb') this.bombSprite.setPosition(this.facing * this.handReach(0.9), -4 - this.attackLift);
    // El bate se echa para atrás y da el batazo; la pistola apunta hacia adelante.
    const hasBat = this.held?.type === 'bat';
    this.batSprite.setVisible(hasBat);
    if (hasBat) {
      let angle = -60;
      if (type === 'bat') angle = -120 + 200 * Math.min(1, this.attack.elapsed / (a.startup + a.active));
      this.batSprite.setPosition(this.facing * this.handReach(0.8), -8 - this.attackLift).setScale(this.facing, 1).setAngle(angle * this.facing);
    }
    this.gunSprite.setVisible(this.held?.type === 'raygun');
    if (this.held?.type === 'raygun') this.gunSprite.setPosition(this.facing * this.handReach(0.95), -2 - this.attackLift).setScale(0.8 * this.facing, 0.8);
    // El bumerán (si no anda volando) y la flor de fuego, en la mano.
    const hasBoomerang = this.held?.type === 'boomerang' && !this.held.out;
    this.boomerangSprite.setVisible(hasBoomerang);
    if (hasBoomerang) this.boomerangSprite.setPosition(this.facing * this.handReach(0.9), -8 - this.attackLift).setScale(0.8 * this.facing, 0.8);
    const hasFlower = this.held?.type === 'fireflower';
    this.flowerSprite.setVisible(hasFlower);
    if (hasFlower) this.flowerSprite.setPosition(this.facing * this.handReach(0.95), -10 - this.attackLift).setScale(0.7 * this.facing, 0.7);
    // El globo de agua, el pastel y el imán, en la mano.
    for (const [sprite, kind] of [[this.balloonSprite, 'waterballoon'], [this.pieSprite, 'pie'], [this.magnetSprite, 'magnet']]) {
      const has = this.held?.type === kind;
      sprite.setVisible(has);
      if (has) sprite.setPosition(this.facing * this.handReach(0.95), -8 - this.attackLift).setScale(0.75 * this.facing, 0.75);
    }
    // El paraguas va arriba de la cabeza (se mece un poquito); las gotas escurren; el pastel tapa la cara.
    const top = this.image ? this.baseRadius - this.image.displayHeight : -this.radius;
    this.umbrellaSprite.setVisible(this.umbrellaMs > 0);
    if (this.umbrellaMs > 0) this.umbrellaSprite.setPosition(this.facing * 8, top - 18).setAngle(Math.sin(this.scene.time.now / 200) * 8 - (this.grounded ? 0 : this.facing * 6));
    this.drops.setVisible(this.wetMs > 0);
    if (this.wetMs > 0) this.drops.list.forEach((drop, i) => drop.setY(top * 0.4 + ((this.scene.time.now / 6 + i * 30) % 70)));
    this.cream.setVisible(this.pieMs > 0);
    if (this.pieMs > 0) this.cream.setPosition(this.facing * this.baseRadius * 0.15, this.image ? top * 0.55 + this.baseRadius * 0.3 : -this.baseRadius * 0.1);
  }

  // Qué tan adelante lleva lo que trae en la mano (Bloquecito, según su ancho).
  handReach(k) {
    return this.blocks ? this.radius + 8 : this.baseRadius * k;
  }

  // Brillo que late detrás del personaje en súper modo. Al transformarse sale grande y se encoge;
  // en los últimos 2 segundos parpadea para avisar que ya se acaba.
  renderAura() {
    const on = this.superMs > 0;
    this.aura.setVisible(on);
    if (!on) return;
    const now = this.scene.time.now;
    if (this.transformMs > 0) {
      this.aura.setScale(1 + (2.5 * this.transformMs) / TRANSFORM_MS).setAlpha(0.9);
      return;
    }
    const ending = this.superMs < 2000 && Math.floor(now / 120) % 2 === 0;
    this.aura.setScale(1 + 0.1 * Math.sin(now / 90)).setAlpha(ending ? 0.15 : 0.7);
    this.aura.setFillStyle(Math.floor(now / 200) % 2 === 0 ? 0xffd84d : this.color, 0.5);
  }
}

// Qué pose usa cada golpe (las que no están aquí, 'golpe'); en el aire, los normales se ven como patada voladora.
const ATTACK_POSES = {
  sweep: 'patada',
  stomp: 'aire',
  charge: 'especial',
  cast: 'especial',
  laser: 'especial',
  fire: 'especial',
  tail: 'especial',
  scratch: 'especial',
  slide: 'agachado',
  cannon: 'especial',
  wand: 'especial',
  water: 'especial',
  sting: 'especial',
  zap: 'especial',
  flame: 'especial',
  blaze: 'especial',
  rocketfist: 'especial',
};
const AIR_POSE_ATTACKS = ['jab', 'up', 'stomp', 'sweep'];
// Si no tiene esa pose, la más parecida (las súper formas solo traen las básicas).
const POSE_CHAIN = {
  patada: ['patada', 'golpe'],
  aire: ['aire', 'patada', 'golpe'],
  especial: ['especial', 'golpe'],
  agarre: ['agarre', 'golpe'],
  agachado: ['agachado', 'golpe'],
  cubrirse: ['cubrirse', 'normal'],
  gana: ['gana', 'salto'],
  entrada: ['entrada', 'gana', 'normal'],
  // Juntando fuerza para el golpe cargado.
  carga: ['agachado', 'especial', 'normal'],
};
// Las imágenes se ajustan a la misma altura; las más bajitas o más altas en el dibujo se corrigen aquí.
const POSE_HEIGHT = { cubrirse: 0.85, gana: 1.08, patada: 0.95, agachado: 0.75, aire: 0.95 };

function approach(value, target, step) {
  return value < target ? Math.min(target, value + step) : Math.max(target, value - step);
}
