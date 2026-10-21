import { METER_MAX } from './DueloFighter.js';

// Qué tan bien pelea la compu: `speed` al caminar (1 = como un jugador), `attack` golpes por segundo
// cuando está cerca, `block` probabilidad de cubrirse cuando le van a pegar, `special` especiales por
// segundo y `jump` saltos por segundo. `parry`: qué tan seguido le sale la parada perfecta al cubrirse;
// `assist`: ayudantes por segundo (cuando el rival está a media distancia). En Fácil los peques le pueden ganar.
export const CPU_LEVELS = {
  facil: { name: 'Fácil', speed: 0.6, attack: 1.2, block: 0.15, special: 0.15, jump: 0.05, parry: 0.1, assist: 0.05 },
  normal: { name: 'Normal', speed: 0.8, attack: 2.4, block: 0.4, special: 0.3, jump: 0.1, parry: 0.3, assist: 0.1 },
  dificil: { name: 'Difícil', speed: 1, attack: 4.5, block: 0.7, special: 0.5, jump: 0.15, parry: 0.55, assist: 0.15 },
};

// El muñeco de práctica (Entrenamiento): no camina, no pega y no se cubre.
export const DUMMY = { name: 'Muñeco', passive: true };

const BLOCK_MS = 350;
const BLOCK_CHANGES_PER_SECOND = 0.35;
const DASHES_PER_SECOND = 0.5;
// Va por un objeto si está más cerca que esto (y el rival no lo está atacando).
const ITEM_REACH = 380;

// Decide qué "aprieta" la compu este cuadro (mismo formato que un control).
// Se acerca hasta tener al rival a su alcance (a veces de un arrancón) y pega: golpes, patadas, barridas,
// agarres y, si el rival viene saltando, un gancho. Si lo van a golpear o le lanzan algo, a veces se cubre,
// salta o se va rodando. Los que lanzan cosas (estrella, láser...) prefieren pelear de lejos.
// También usa sus movimientos secretos (agachado y en el aire), llama a su ayudante y va por los objetos.
// `items`: los objetos de la pelea (o null).
export function cpuInput(me, foe, shots, level, dtMs, items = null) {
  const input = { x: 0, up: false, down: false, dash: 0, punch: false, kick: false, special: false, block: false, transform: false, change: 0, assist: false };
  const ai = (me.ai ??= { blockMs: 0, retreatMs: 0, threat: null });
  ai.blockMs -= dtMs;
  ai.retreatMs -= dtMs;
  if (!me.canAct() || level.passive) return input;
  const dt = dtMs / 1000;
  const chance = (perSecond) => Math.random() < perSecond * dt;
  const dir = Math.sign(foe.x - me.x) || me.facing;
  const gap = Math.abs(foe.x - me.x) - (me.radius + foe.radius) * 0.7;

  // Lo van a golpear (el rival pega de cerca o viene algo volando): decide una sola vez qué hacer.
  const incoming = shots.find((s) => s.owner === foe && !s.dead && Math.sign(me.x - s.x) === Math.sign(s.vx) && Math.abs(me.x - s.x) < 280);
  const swing = foe.attack ?? foe.special;
  const threat = incoming ?? (swing && gap < 220 ? swing : null);
  if (threat && threat !== ai.threat && Math.random() < level.block) {
    const roll = Math.random();
    if (incoming && me.grounded && roll < 0.4) input.up = true;
    else if (me.grounded && roll < 0.55) input.dash = -dir;
    else ai.blockMs = BLOCK_MS + Math.random() * 250;
  }
  ai.threat = threat;
  if (ai.blockMs > 0 && me.grounded) {
    input.block = true;
    return input;
  }

  if (me.meter >= METER_MAX && chance(0.6)) input.transform = true;
  // El ayudante: a media distancia, una vez por round.
  if (!me.assistUsed && gap > 200 && chance(level.assist ?? 0)) input.assist = true;
  // En el aire: su secreto del aire, de vez en cuando.
  if (!me.grounded && me.cooldownMs === 0 && chance(level.special * 1.5)) {
    input.special = true;
    return input;
  }
  // Un objeto cerca y nadie atacándolo: va por él.
  const item = items?.nearest(me.x);
  if (item && Math.abs(item.x - me.x) < ITEM_REACH && Math.abs(item.x - me.x) < Math.abs(foe.x - me.x) && !threat) {
    input.x = Math.sign(item.x - me.x) * level.speed;
    return input;
  }
  // Bloquecito cambia de número de vez en cuando (sube más de lo que baja).
  if (me.blocks && chance(BLOCK_CHANGES_PER_SECOND)) input.change = Math.random() < 0.6 ? 1 : -1;
  const ranged = me.specialData.kind === 'shot';
  if (me.cooldownMs === 0 && chance(level.special) && (ranged ? gap > 200 : gap < 150)) {
    input.special = true;
    // A veces el secreto de agachado en vez del especial.
    if (Math.random() < 0.35) input.down = true;
  }

  const reach = me.radius * 0.9;
  // El rival viene saltando encima: gancho.
  if (!foe.grounded && gap < reach * 1.2 && me.grounded && chance(level.attack * 0.8)) {
    input.down = true;
    input.punch = true;
    return input;
  }
  if (ai.retreatMs > 0) {
    input.x = -dir * level.speed;
  } else if (gap > reach) {
    // Los que lanzan cosas se quedan a media distancia mientras tienen listo el especial.
    const wanted = ranged && me.cooldownMs === 0 ? 320 : reach * 0.6;
    if (gap > wanted) input.x = dir * level.speed;
    if (gap > 320 && me.grounded && chance(DASHES_PER_SECOND * level.speed)) input.dash = dir;
  } else if (chance(level.attack)) {
    const pick = Math.random();
    if (pick < 0.12 && me.canGrab(foe)) {
      input.x = dir;
      input.kick = true;
    } else if (pick < 0.25) {
      input.down = true;
      input.kick = true;
    } else if (pick < 0.65) {
      input.punch = true;
    } else {
      input.kick = true;
    }
    if (Math.random() < 0.1) ai.retreatMs = 400;
  }
  if (chance(level.jump)) {
    input.up = true;
    input.x = dir * level.speed;
  }
  return input;
}
