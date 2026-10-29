import { FightTalk } from '../duelo/talk.js';
import { characterInfo } from './characters.js';

// El narrador de Bolitas Bros: comenta el primer golpe, los golpazos, quién sale volando, las paradas perfectas, los
// golpes cargados, los objetos, quién trae mucho %, a quién le queda una vida y los últimos segundos. La voz y el
// letrero son los del narrador del Duelo; aquí solo las frases. El letrero va en `layer` (la pantalla, sin zoom).
const STRONG_SPEED = 1600;
const HIGH_DAMAGE = 150;

export function fighterName(f) {
  return f.bossName ?? characterInfo(f.characterKey)?.name ?? f.label;
}

export class SmashTalk extends FightTalk {
  constructor(scene, layer) {
    super(scene, scene.scale.height - 148, 0);
    layer.add(this.caption);
    this.firstHit = false;
    this.warned = new Set();
  }

  hit(attacker, victim, speed) {
    if (!this.firstHit) {
      this.firstHit = true;
      this.line([`¡Primer golpe de ${fighterName(attacker)}!`, `¡${fighterName(attacker)} pega primero!`]);
    } else if (speed > STRONG_SPEED) {
      this.line(['¡Qué golpazo!', '¡Uy, eso dolió!', `¡${fighterName(victim)} sale disparado!`, '¡Tremendo trancazo!']);
    }
    // Una vez por vida: avisar cuando alguien ya trae mucho %.
    if (victim.damage >= HIGH_DAMAGE && !this.warned.has(victim) && !victim.isBoss && !victim.isDummy) {
      this.warned.add(victim);
      this.line(`¡${fighterName(victim)} ya trae ${Math.round(victim.damage)} por ciento!`);
    }
  }

  ko(fighter) {
    this.warned.delete(fighter);
    if (fighter.stocks === 1 && !fighter.infinite) {
      this.line(`¡A ${fighterName(fighter)} le queda una vida!`, { important: true });
      return;
    }
    this.line([`¡${fighterName(fighter)} salió volando!`, `¡Adiós, ${fighterName(fighter)}!`, `¡Hasta la vista, ${fighterName(fighter)}!`]);
  }

  perfect(fighter) {
    this.line([`¡Parada perfecta de ${fighterName(fighter)}!`, '¡Escudo perfecto!'], { important: true });
  }

  charged(fighter) {
    this.line([`¡Golpe cargado de ${fighterName(fighter)}!`, '¡Golpe cargado al máximo!']);
  }

  item(fighter, type) {
    const lines = {
      tornado: ['¡Cuidado con el tornado!', '¡Ahí va un tornado!'],
      capsule: ['¡A ver qué sale de la cápsula!'],
      egg: ['¡Llegó un ayudante!'],
      star: [`¡${fighterName(fighter)} agarró la estrella!`],
      boomerang: ['¡Un bumerán! Va y regresa'],
      fireflower: ['¡Flor de fuego!'],
      waterballoon: ['¡Globo de agua! ¡Cuidado, que moja!'],
      pie: [`¡${fighterName(fighter)} trae un pastel!`],
      magnet: ['¡Un imán! Jala a los rivales'],
      umbrella: [`¡${fighterName(fighter)} abrió el paraguas!`],
    }[type];
    if (lines) this.line(lines);
  }
}
