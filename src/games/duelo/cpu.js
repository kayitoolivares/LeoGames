import { METER_MAX } from './DueloFighter.js';

// Qué tan bien pelea la compu: `speed` al caminar (1 = como un jugador), `attack` golpes por segundo
// cuando está cerca, `block` probabilidad de cubrirse cuando le van a pegar, `special` especiales por
// segundo y `jump` saltos por segundo. En Fácil los peques le pueden ganar.
export const CPU_LEVELS = {
  facil: { name: 'Fácil', speed: 0.6, attack: 1.2, block: 0.15, special: 0.15, jump: 0.05 },
  normal: { name: 'Normal', speed: 0.8, attack: 2.4, block: 0.4, special: 0.3, jump: 0.1 },
  dificil: { name: 'Difícil', speed: 1, attack: 4.5, block: 0.7, special: 0.5, jump: 0.15 },
};

const BLOCK_MS = 350;
const BLOCK_CHANGES_PER_SECOND = 0.35;

// Decide qué "aprieta" la compu este cuadro (mismo formato que un control).
// Se acerca hasta tener al rival a su alcance y pega; si lo van a golpear o le lanzan algo, a veces se
// cubre o salta. Los que lanzan cosas (estrella, láser...) prefieren pelear de lejos.
export function cpuInput(me, foe, shots, level, dtMs) {
  const input = { x: 0, up: false, punch: false, kick: false, special: false, block: false, transform: false, change: 0 };
  const ai = (me.ai ??= { blockMs: 0, retreatMs: 0, threat: null });
  ai.blockMs -= dtMs;
  ai.retreatMs -= dtMs;
  if (!me.canAct()) return input;
  const dt = dtMs / 1000;
  const chance = (perSecond) => Math.random() < perSecond * dt;
  const dir = Math.sign(foe.x - me.x) || me.facing;
  const gap = Math.abs(foe.x - me.x) - (me.radius + foe.radius) * 0.7;

  // Lo van a golpear (el rival pega de cerca o viene algo volando): decide una sola vez qué hacer.
  const incoming = shots.find((s) => s.owner === foe && !s.dead && Math.sign(me.x - s.x) === Math.sign(s.vx) && Math.abs(me.x - s.x) < 280);
  const swing = foe.attack ?? foe.special;
  const threat = incoming ?? (swing && gap < 220 ? swing : null);
  if (threat && threat !== ai.threat && Math.random() < level.block) {
    if (incoming && me.grounded && Math.random() < 0.4) input.up = true;
    else ai.blockMs = BLOCK_MS + Math.random() * 250;
  }
  ai.threat = threat;
  if (ai.blockMs > 0 && me.grounded) {
    input.block = true;
    return input;
  }

  if (me.meter >= METER_MAX && chance(0.6)) input.transform = true;
  // Bloquecito cambia de número de vez en cuando (sube más de lo que baja).
  if (me.blocks && chance(BLOCK_CHANGES_PER_SECOND)) input.change = Math.random() < 0.6 ? 1 : -1;
  const ranged = me.specialData.kind === 'shot';
  if (me.cooldownMs === 0 && chance(level.special) && (ranged ? gap > 200 : gap < 150)) input.special = true;

  const reach = me.radius * 0.9;
  if (ai.retreatMs > 0) {
    input.x = -dir * level.speed;
  } else if (gap > reach) {
    // Los que lanzan cosas se quedan a media distancia mientras tienen listo el especial.
    const wanted = ranged && me.cooldownMs === 0 ? 320 : reach * 0.6;
    if (gap > wanted) input.x = dir * level.speed;
  } else if (chance(level.attack)) {
    if (Math.random() < 0.6) input.punch = true;
    else input.kick = true;
    if (Math.random() < 0.1) ai.retreatMs = 400;
  }
  if (chance(level.jump)) {
    input.up = true;
    input.x = dir * level.speed;
  }
  return input;
}
