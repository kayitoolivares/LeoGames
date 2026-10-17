import Phaser from 'phaser';
import { controls } from '../shared/controls.js';
import { frameDelta } from '../shared/clock.js';
import { TEXT, textStyle } from '../ui/style.js';

// Los juegos en 3D (Three.js) se abren encima de Phaser: esta escena descarga el juego,
// le pasa cada cuadro y espera a que termine. Three.js se descarga hasta que alguien entra,
// para que el menú cargue rápido en el Xbox.
// `loadGame` devuelve (con import()) la clase del juego; esa clase recibe (contenedor, { onExit })
// y tiene update(deltaMs) y destroy().
export class ThreeGameScene extends Phaser.Scene {
  constructor(key, loadGame) {
    super(key);
    this.loadGame = loadGame;
  }

  init(data) {
    this.returnData = data ?? {};
    this.game3d = null;
    this.closed = false;
    this.failed = false;
  }

  create() {
    const { width, height } = this.scale;
    this.loading = this.add.text(width / 2, height / 2, 'Cargando…', textStyle(36, TEXT.normal, { align: 'center' })).setOrigin(0.5);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.cleanup());
    this.input.keyboard?.on('keydown-ESC', () => this.exit());

    this.loadGame()
      .then((Game) => {
        if (this.closed) return;
        this.game.canvas.style.visibility = 'hidden';
        this.game3d = new Game(document.body, { onExit: () => this.exit() });
      })
      .catch((error) => {
        console.error(error);
        this.failed = true;
        this.loading.setText('No se pudo cargar 😕\nPresiona A para regresar');
      });
  }

  update() {
    if (this.game3d) {
      this.game3d.update(frameDelta());
      return;
    }
    if (this.failed && controls.connectedDevices().some((device) => controls.justPressed(device.id, 'a'))) this.exit();
  }

  exit() {
    if (this.closed) return;
    this.closed = true;
    this.scene.start('Menu', { selected: this.returnData.selected });
  }

  cleanup() {
    this.closed = true;
    this.game3d?.destroy();
    this.game3d = null;
    this.game.canvas.style.visibility = '';
  }
}
