import { FightTalk } from '../duelo/talk.js';

// El narrador de Pelea en equipo: comenta los combos, los rescates, los que caen y los que levantan, los animales,
// los objetos, los mini jefes y cuando el jefe se enoja. La voz y el letrero son los del narrador del Duelo; el
// letrero va pegado a la pantalla.
export class BrawlTalk extends FightTalk {
  constructor(scene, depth) {
    super(scene, scene.scale.height - 70, depth);
    this.caption.setScrollFactor(0);
  }

  combo(count) {
    this.line([`¡Combo de ${count}!`, `¡${count} golpes seguidos!`, '¡Qué equipo!'], { important: count >= 20 });
  }

  fell(name) {
    this.line([`¡${name} cayó! ¡Ayúdenlo!`, `¡Levanten a ${name}!`], { important: true });
  }

  revived(name) {
    this.line([`¡${name} está de vuelta!`, '¡Arriba, compañero!']);
  }

  rescued(name) {
    this.line(`¡Rescataron a ${name}! Ahora pelea con ustedes`, { important: true });
  }

  mounted(name, animal) {
    this.line([`¡${name} va montado en el ${animal}!`, '¡Arre!']);
  }

  item(word) {
    this.line(word);
  }

  // Uno avienta un monstruo y otro le pega en el aire.
  airCombo() {
    this.line(['¡Combo doble!', '¡Qué pase!', '¡Eso es trabajo en equipo!'], { important: true });
  }

  record(text) {
    this.line(`¡Récord! ${text}`, { important: true });
  }

  mini(name) {
    this.line(`¡Cuidado! ¡${name}!`, { important: true });
  }

  angry(name) {
    this.line([`¡${name} se enojó!`, `¡Uy! ¡${name} está furioso!`], { important: true });
  }
}
