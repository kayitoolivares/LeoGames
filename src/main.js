import Phaser from 'phaser';
import { controls } from './shared/controls.js';
import { tickClock } from './shared/clock.js';
import { JoinScene } from './scenes/JoinScene.js';
import { MenuScene } from './scenes/MenuScene.js';
import { PadTestScene } from './scenes/PadTestScene.js';
import { BrawlScene } from './games/brawl/BrawlScene.js';
import { SmashScene } from './games/smash/SmashScene.js';
import { ThreeGameScene } from './games/ThreeGameScene.js';
import { COLORS } from './ui/style.js';

// 1280x720 escalado para llenar la pantalla: ligero para el Xbox One S y se ve bien en una tele.
const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: COLORS.bg,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: 1280,
    height: 720,
  },
  scene: [
    JoinScene,
    MenuScene,
    PadTestScene,
    BrawlScene,
    SmashScene,
    // Los juegos 3D se descargan hasta que alguien entra a ellos.
    new ThreeGameScene('Race', () => import('./games/race/RaceGame.js').then((m) => m.RaceGame)),
    new ThreeGameScene('Kart', () => import('./games/kart/KartGame.js').then((m) => m.KartGame)),
  ],
});

// El reloj y los controles se leen una sola vez por cuadro, antes de que corran las escenas.
game.events.on(Phaser.Core.Events.PRE_STEP, () => {
  tickClock(game.loop.rawDelta);
  controls.update();
});

// Para depurar desde la consola del navegador (solo con `npm run dev`).
if (import.meta.env.DEV) window.leogames = game;
