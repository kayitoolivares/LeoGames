import { controls } from '../../shared/controls.js';
import { settings } from '../../shared/settings.js';
import { numberStep } from '../smash/bloquecito.js';

// Lo que aprieta cada peleador: su control (humanInput) o la compu (CpuBuddy). El peleador solo pregunta
// stick(), pressed(botón) (recién apretado), held(botón) (sostenido) y numberStep() (Bloquecito).
export function humanInput(deviceId) {
  return {
    stick: () => controls.getStick(deviceId),
    pressed: (button) => controls.justPressed(deviceId, button),
    held: (button) => controls.isDown(deviceId, button),
    numberStep: () => numberStep(deviceId),
  };
}

// Cuántos amigos de la compu juegan (se escoge en el mapa con Y; se guarda).
const BUDDIES_KEY = 'brawlBuddies';
export const buddyCount = {
  get() {
    return settings.get(BUDDIES_KEY, 0);
  },
  set(count) {
    settings.set(BUDDIES_KEY, count);
  },
};

const ATTACK_EVERY_MS = 260;
const SPECIAL_CHANCE = 0.012;
const GRAB_CHANCE = 0.006;
const LOW_HP = 2;

// Un amigo de la compu: va por el monstruo más cercano y le pega, salta cuando le van a pegar ("!"), levanta a los
// compañeros caídos, recoge comida si le falta vida, usa su especial de vez en cuando, se vuelve súper con la barra
// llena y, al terminar la ronda, camina con los demás. Cada cuadro decide qué "botones" aprieta.
export class CpuBuddy {
  constructor() {
    this.stickValue = { x: 0, y: 0 };
    this.presses = new Set();
    this.holds = new Set();
    this.attackMs = 0;
    this.input = {
      stick: () => this.stickValue,
      pressed: (button) => this.presses.has(button),
      held: (button) => this.holds.has(button) || this.presses.has(button),
      numberStep: () => 0,
    };
  }

  // Decide qué hacer este cuadro (se llama antes de fighter.update).
  think(dtMs, scene, fighter) {
    this.presses.clear();
    this.holds.clear();
    this.stickValue = { x: 0, y: 0 };
    this.attackMs = Math.max(0, this.attackMs - dtMs);
    if (fighter.down) return;
    const phase = scene.phase;
    const team = scene.fighters.filter((f) => f !== fighter);
    // Caminando al siguiente tramo: se va con el de adelante.
    if (phase === 'walk') {
      const lead = Math.max(...team.filter((f) => !f.isCpu && !f.down).map((f) => f.x), fighter.x);
      this.stickValue = { x: fighter.x < lead - 60 ? 1 : 0, y: 0 };
      return;
    }
    if (phase !== 'fight') return;
    // Lo agarrado se avienta luego luego.
    if (fighter.holding) {
      this.presses.add('x');
      return;
    }
    // Un compañero le avienta un monstruo: ¡a pegarle en el aire (combo doble)!
    const flying = scene.monsters.find((m) => m.state === 'thrown' && m.thrownBy && m.thrownBy !== fighter && Math.abs(m.y - fighter.y) < 30 && Math.abs(m.x - fighter.x) < 140);
    if (flying) {
      const dir = Math.sign(flying.x - fighter.x) || 1;
      if (dir !== fighter.facing) this.stickValue = { x: dir, y: 0 };
      else if (this.attackMs === 0) {
        this.presses.add('x');
        this.attackMs = ATTACK_EVERY_MS;
      }
      return;
    }
    // Un compañero caído: a levantarlo.
    const downed = team.find((f) => f.down);
    if (downed) {
      this.goTo(fighter, downed.x + 20, downed.y);
      return;
    }
    // Con poca vida, por la comida o el corazón que esté cerca.
    if (fighter.hp <= LOW_HP) {
      const snack = scene.nearestSnack?.(fighter, 420);
      if (snack) {
        this.goTo(fighter, snack.x, snack.y);
        return;
      }
    }
    const monsters = scene.monsters.filter((m) => !m.dead && m.entered && !m.grabbedBy && m.state !== 'thrown');
    if (fighter.meter >= 100 && fighter.superMs === 0 && monsters.length > 0) {
      this.holds.add('lb');
      this.holds.add('rb');
      this.presses.add('rb');
      return;
    }
    let target = null;
    let best = Infinity;
    for (const m of monsters) {
      const d = Math.hypot(m.x - fighter.x, (m.y - fighter.y) * 1.5);
      if (d < best) [target, best] = [m, d];
    }
    if (!target) {
      // Sin monstruos cerca: se queda junto a un jugador.
      const friend = team.find((f) => !f.isCpu && !f.down);
      if (friend && Math.abs(friend.x - fighter.x) > 160) this.goTo(fighter, friend.x - 90, friend.y);
      return;
    }
    // Le van a pegar: ¡salta!
    const close = Math.abs(target.x - fighter.x) < target.radius + fighter.radius + 40 && Math.abs(target.y - fighter.y) < 40;
    if (close && (target.state === 'windup' || target.state === 'lunge') && fighter.z === 0 && Math.random() < 0.08) this.presses.add('a');
    const dir = Math.sign(target.x - fighter.x) || 1;
    this.goTo(fighter, target.x - dir * (fighter.radius + target.radius + 10), target.y);
    if (Math.abs(target.y - fighter.y) < 26 && Math.abs(target.x - fighter.x) < fighter.radius + target.radius + 30) {
      // Mirando al monstruo: pega, a veces su especial y a veces lo agarra.
      if (Math.sign(target.x - fighter.x) !== fighter.facing) this.stickValue = { x: dir, y: 0 };
      if (fighter.specialCooldownMs === 0 && Math.random() < SPECIAL_CHANCE) this.presses.add('b');
      else if (target.canBeGrabbed() && Math.random() < GRAB_CHANCE) this.presses.add('rb');
      else if (this.attackMs === 0) {
        this.presses.add('x');
        this.attackMs = ATTACK_EVERY_MS;
      }
    }
  }

  goTo(fighter, x, y) {
    const dx = x - fighter.x;
    const dy = y - fighter.y;
    this.stickValue = {
      x: Math.abs(dx) < 8 ? 0 : Math.max(-1, Math.min(1, dx / 40)),
      y: Math.abs(dy) < 6 ? 0 : Math.max(-1, Math.min(1, dy / 25)),
    };
  }
}
