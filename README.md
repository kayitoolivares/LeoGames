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

- **Unirse:** cada quien presiona A en su control (hasta 4 jugadores).
- **Empezar:** el Jugador 1 *mantiene* A.
- **Cambiar color:** ◀ ▶ en la pantalla de jugadores.
- Los botones **Menú** y **Vista** no se usan a propósito: en Edge del Xbox fallan.

## Juegos

- **Pelea en equipo**: todos contra 4 rondas de slimes, y al final el Rey Slime.
  **X o B** = pegar, **A** = saltar (esquiva cuando al monstruo le sale "!"), **mantén Y** = salir.
  Si alguien cae, un compañero se para junto a él para levantarlo.

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
- `src/ui/`: estilos y el personaje (la bolita).
