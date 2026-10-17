# LeoGames

Juegos para jugar en familia con controles de Xbox, directo en el navegador (PC o Xbox).
Hecho con [Phaser 4](https://phaser.io) y [Vite](https://vite.dev), en JavaScript.

## Correrlo en tu compu

```sh
npm install
npm run dev
```

Abre http://localhost:5173 en Edge o Chrome.

## Controles

| | Control de Xbox | Teclado 1 | Teclado 2 |
|---|---|---|---|
| Moverse | Stick izquierdo o cruceta | W A S D | Flechas |
| A (unirse / aceptar) | A | Espacio | Enter |
| B (salir / regresar) | B | Q | Shift derecho |
| X | X | E | . (punto) |
| Y | Y | R | - (guion) |
| RB (nitro en karts) | RB | Shift izquierdo | Ctrl derecho |

- **Unirse:** cada quien presiona A en su control (hasta 4 jugadores).
- **Empezar:** el Jugador 1 *mantiene* A.
- **Cambiar color:** ◀ ▶ en la pantalla de jugadores.
- Los botones **Menú** y **Vista** no se usan a propósito: en Edge del Xbox fallan.

## Juegos

- **Pelea en equipo**: todos contra 4 rondas de slimes, y al final el Rey Slime.
  **X o B** = pegar, **A** = saltar (esquiva cuando al monstruo le sale "!"), **mantén Y** = salir.
  Si alguien cae, un compañero se para junto a él para levantarlo.
- **Bolitas Bros** (estilo Smash, fase 3): cada golpe sube tu **%** y entre más llevas, más lejos sales volando;
  si te sacan de la pantalla pierdes una de tus 3 vidas. Antes de pelear cada quien escoge personaje:
  **Tanque** (fuerte y pesado, B = puñetazo cargado), **Rayo** (rápido, B = embestida),
  **Resorte** (salta 3 veces, B = súper salto) y **Estrella** (B = lanza estrellas).
  **A** = saltar, **X** = golpe (con ↑ hacia arriba, con ↓ barrida o pisotón), **B + ↑** = salto de rescate,
  **RB / LB** (o gatillos) = escudo (si se rompe quedas mareado), **↓** = bajar de plataforma, **mantén Y** = salir.
  Caen objetos: **martillo** (8 s de martillazos con X), **bomba** (X la lanza), **corazón** (-40 %)
  y **estrella** (6 s sin recibir golpes). **Y** en la selección activa el **modo peque** (menos daño y menos empujón).
  El Jugador 1 escoge escenario (**Castillo**, **Nubes** con plataformas que se mueven, **Barco pirata**),
  si hay objetos, cuántos CPUs y su nivel (fácil, normal, difícil). Con un solo jugador siempre hay al menos un CPU.
- **Karts locos** (3D): cámara detrás del carro, pantalla dividida para cada jugador y CPU hasta completar 6.
  **A / RT** = acelerar, **B / LT** = frenar y reversa, **stick** = girar, **RB** = nitro (3 cargas que se recargan),
  **X** = lanzar el poder de las cajitas "?" (🚀 cohete, 🍌 plátano, ⚡ súper turbo, 🛡️ burbuja).
- **Carreras** (3D): vista desde arriba, el carro va hacia donde apunta el stick. **A** = turbo, **B** = frenar.
- **Halcón de Acero**: abre https://hda.grupomegarey.mx (es otro proyecto; para volver, B en modo navegador).
- **Prueba de controles**: muestra lo que el navegador ve de cada control, botón por botón.

Los juegos 3D usan [Three.js](https://threejs.org) y se descargan hasta que alguien entra a ellos.

## Sonido

Los sonidos se generan con el navegador (no hay archivos de audio). El navegador no deja sonar nada
hasta que alguien hace **clic o aprieta una tecla** en la página; los botones del control no cuentan.
En el Xbox: presiona **A en modo cursor** sobre la página antes de pasar a "controles de juego".

## Arte de Bolitas Bros (imágenes de Gemini)

Pon las imágenes en `arte/smash/` (esa carpeta no se sube a GitHub) y corre `npm run arte`:

- `arte/smash/personajes/<tanque|rayo|resorte|estrella>-<normal|golpe|salto|dolor>.png`
  (cuerpo completo, mirando a la derecha, fondo liso, de preferencia verde brillante, con contorno oscuro)
- `arte/smash/objetos/<martillo|bomba|corazon|estrella>.png` (fondo liso)
- `arte/smash/fondos/<castillo|nubes|barco>.png` (horizontal 16:9, sin personajes)

El script quita el fondo, recorta y achica las imágenes (para la memoria del Xbox), las deja en `public/smash/`
y anota en `src/games/smash/art.json` cuáles hay. Lo que falte se sigue dibujando con figuras.

## Jugar en el Xbox

El navegador solo deja leer controles en páginas **HTTPS** (o `localhost`), así que en el Xbox
se juega desde GitHub Pages:

1. Sube el repo a GitHub y en **Settings → Pages → Source** elige **GitHub Actions**.
2. Cada `git push` publica solo (ver `.github/workflows/deploy.yml`) en
   `https://<tu-usuario>.github.io/LeoGames/`.
3. En el Xbox: desactiva **"Apps can add a border"** (borde de overscan) para que no vaya lento.
4. Abre la dirección en **Edge**, mantén **≡ (Menú)** → **"Use game controls"** → **A**.
5. Si algo falla, el menú tiene **Prueba de controles** para ver qué detecta el navegador.

## Estructura

- `src/shared/controls.js`: lee controles y teclado. No depende de Phaser (para reutilizarlo con Three.js).
- `src/shared/players.js`: quién juega, con qué control y de qué color.
- `src/games.js`: catálogo de juegos del menú.
- `src/scenes/`: pantallas (unirse, menú, prueba de controles).
- `src/shared/clock.js`: tiempo real entre cuadros (para que nada vaya en cámara lenta si baja el fps).
- `src/shared/sound.js`: efectos de sonido sintetizados.
- `tools/prepare-art.mjs`: prepara el arte de Bolitas Bros (`npm run arte`).
- `src/games/brawl/`: Pelea en equipo (Phaser).
- `src/games/smash/`: Bolitas Bros (Phaser), con cámara que hace zoom y otra fija para el marcador.
- `src/games/kart/` y `src/games/race/`: los dos juegos de carreras (Three.js).
- `src/games/three/`: piezas 3D compartidas (pista, modelo del kart, lienzo).
- `src/games/ThreeGameScene.js`: abre un juego 3D encima de Phaser y lo cierra al salir.
- `src/ui/`: estilos y el personaje (la bolita).
