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
| LB | LB | Z | , (coma) |
| RB (nitro en karts) | RB | Shift izquierdo | Ctrl derecho |

- **Unirse:** cada quien presiona A en su control (hasta 4 jugadores).
- **Empezar:** el Jugador 1 *mantiene* A.
- **Cambiar color:** ◀ ▶ en la pantalla de jugadores.
- **Salir de un juego:** mantén **LB + RB + Y** juntos (en el celular, LB + RB). Así nadie se sale sin querer:
  LB y RB solos sirven para cubrirse o transformarse en las peleas. En el Modo Bebé hay que mantenerlos 3 segundos.
- Los botones **Menú** y **Vista** no se usan a propósito: en Edge del Xbox fallan.

## Juegos

- Antes de **Pelea en equipo**, **Fútbol de bolitas** y **Duelo de bolitas** cada quien escoge personaje (los de Bolitas Bros) con ◀ ▶ y A;
  lo que escojas se recuerda en los demás juegos mientras la página siga abierta.
- **Pelea en equipo**: todos contra los monstruos en 3 mundos (Pradera, Bosque de hongos y Volcán), de 4 rondas
  cada uno y con su jefe: el Rey Slime, el Gran Hongo (llama ayudantes) y el Dragón de lava (lanza bolas de
  fuego; se esquivan saltando). Ganar un mundo desbloquea el siguiente.
  **X o B** = pegar, **A** = saltar (esquiva cuando al monstruo le sale "!"), **mantén LB + RB + Y** = salir.
  Si alguien cae, un compañero se para junto a él para levantarlo.
- **Bolitas Bros** (estilo Smash, fase 3): cada golpe sube tu **%** y entre más llevas, más lejos sales volando;
  si te sacan de la pantalla pierdes una de tus 3 vidas. Antes de pelear cada quien escoge personaje:
  **Tanque** (fuerte y pesado, B = puñetazo cargado), **Rayo** (rápido, B = embestida),
  **Resorte** (salta 3 veces, B = súper salto), **Estrella** (B = lanza estrellas), **Ninja** (B = aparece por detrás),
  **Robot** (B = láser), **Dragoncito** (flota, B = fuego), **Fantasma** (B = invisible), **Dino** (B = coletazo a
  los dos lados), **Gatito** (salta 3 veces, B = arañazos), **Pingüino** (B = se desliza de panza), **Pirata**
  (B = bala de cañón), **Hada** (flota, B = polvo mágico), **Astronauta** (B = mochila cohete), **Abeja** (salta 4 veces,
  B = aguijonazo), **Bombero** (B = chorro de agua que empuja) y **Bloquecito** (ver abajo). Con la barra llena,
  **LB + RB** = súper forma por 10 segundos.
  **A** = saltar, **X** = golpe (con ↑ hacia arriba, con ↓ barrida o pisotón), **B + ↑** = salto de rescate,
  **RB / LB** (o gatillos) = escudo (si se rompe quedas mareado), **↓** = bajar de plataforma, **mantén LB + RB + Y** = salir.
  Caen objetos: **martillo** (8 s de martillazos con X), **bomba** (X la lanza), **corazón** (-40 %)
  y **estrella** (6 s sin recibir golpes). **Y** en la selección activa el **modo peque** (menos daño y menos empujón).
  El Jugador 1 escoge escenario (**Castillo**, **Nubes** con plataformas que se mueven, **Barco pirata**, y los
  desbloqueables **Espacio** con gravedad baja —al ganar una pelea— y **Volcán** con géiseres de lava —al
  transformarte en súper—),
  si hay objetos, cuántos CPUs y su nivel (fácil, normal, difícil). Con un solo jugador siempre hay al menos un CPU.
- **Karts locos** (3D): cámara detrás del carro, pantalla dividida para cada jugador y CPU hasta completar 6.
  Antes de correr, en el **taller** cada quien escoge piloto (los personajes de Bolitas Bros, con su imagen
  manejando; Bloquecito cambia de número con Y), kart (**Clásico**, **Bólido** rápido, **Mini** que arranca y gira
  bien, **Monstruo** pesado que casi no se frena en el pasto), color, llantas, adorno y calcomanía (llamas, estrellas,
  rayos, corazones o flores dibujadas por Gemini, o su número). Los karts se ven como caricatura (sombreado de 2-3
  tonos y contorno negro) y cada uno se dibuja de una sola pasada, para que el Xbox no se trabe.
  El piloto se ve de espaldas, girando en las curvas, de lado o de frente según de dónde lo veas (dibujos de
  Gemini: <personaje>-atras|giro|lado|frente); le duele cuando le pegan, salta en el truco y festeja en la meta.
  Polvito al salirse del camino, chispas al rozar las llantas y estrellitas al pegarle a alguien.
  **Modo peque** (Y en el taller, por jugador): el kart acelera solo, el volante le ayuda a seguir la pista (sin tocar
  el stick va solo), si se voltea al revés se endereza solo y los golpes duran menos.
  **Tienda del taller** (X en el taller): las monedas de cada carrera (más 5, 3 o 2 por llegar en 1°, 2° o 3°) se
  guardan para toda la familia y con ellas se compran karts (Cohete, Tina de baño, Pato de hule), llantas de fuego y
  neón, adornos (corona, cohetes, globo), colores (dorado, plateado, menta, chocolate) y calcomanías.
  **Premiación en 3D** al final de cada carrera, copa o batalla: los 3 primeros suben al podio con su kart, con confeti
  y fuegos artificiales; en el Gran Premio la copa flota arriba del ganador. Al final, podio con los 3
  primeros (**A** = otra carrera, **X** = regresar al taller). Después del taller se escoge el modo: **Carrera** (una
  pista) o **Gran Premio** (copas de 3 pistas seguidas con puntos: 10, 8, 6, 4, 2 y 1; la compu trae el mismo kart en
  toda la copa y el que junta más gana el trofeo). **Copa Hoja**: Pradera, Playa y Dulcelandia. **Copa Estrella**
  (se abre al ganar una copa): Montaña nevada, Castillo y Arcoíris espacial. **Copa Aventura** (4 carreras): Selva,
  Fondo del mar, Ciudad de juguete y Volcán.
  En las pantallas de escoger, el Jugador 1 cambia con **LB** el nivel de la compu (fácil, normal, difícil) y con **RB**
  las vueltas (1, 2 o 3). **Arranque turbo**: acelerar justo cuando sale el "1". **Monedas** en la pista: cada una te hace
  un poco más rápido (hasta 10) y un golpe te tira 3. Mini mapa en la esquina, motor que suena según la velocidad y
  música más rápida en la última vuelta.
  **Por equipos**: Rojos (J1 y J3) contra Azules (J2 y J4), la compu completa los equipos; cada kart lleva un aro de
  su color, los poderes no le pegan a tu equipo y al final se suman los puntos (10, 8, 6, 4, 2, 1).
  **Batalla de globos**: 4 karts en una arena redonda con bloques de juguete; cada uno trae 3 globos y los poderes (o
  aplastar a uno encogido) revientan uno. Sin globos quedas fuera; gana el último con globos o el que tenga más al
  acabarse los 2:30.
  **A / RT** = acelerar, **B / LT** = frenar y reversa, **stick** = girar, **RB** = nitro (3 cargas que se recargan),
  **LB** = derrapar (mantenerlo en la curva junta chispas azules, naranjas y moradas; al soltarlo, turbito) y, en el
  aire después de una rampa, truco (turbito al caer). Las flechas naranjas del piso dan turbo.
  **X** = lanzar el poder de las cajitas "?": 🚀 cohete (al de adelante), 🍌 plátano, 🍌×3 tres plátanos (uno con
  cada X), ⚡ súper turbo, 🛡️ burbuja, ☄️ cometa (va por el primer lugar), 🌩️ rayo (encoge a los demás; encogidos,
  si los tocas dan vueltas) y 🦑 tinta (mancha la pantalla de los de adelante). Los de atrás reciben mejores poderes.
  Pistas (cada una con su rampa y sus flechas): **Pradera**, **Playa** (palmeras, sombrillas y el mar), **Dulcelandia**
  (camino de chocolate, paletas y gomitas), **Montaña nevada** (se desbloquea al ganar una carrera; nieve cayendo y
  monos de nieve), **Castillo** (de noche, con antorchas; se desbloquea al pegarle a alguien con un poder) y
  **Arcoíris espacial** (camino de colores entre estrellas y planetas; se desbloquea al ganar una copa del Gran
  Premio), **Selva** (camino de tierra entre palmeras, matorrales y flores), **Fondo del mar** (corales, algas que se
  mecen y burbujas), **Ciudad de juguete** (pista de plástico naranja entre bloques gigantes y crayolas) y **Volcán**
  (un volcán enorme en medio con lava escurriendo, charcos de lava y chispas). Al terminar, **B** regresa a escoger
  pista.
  **Lomas y peligros**: las pistas suben y bajan (el piso de alrededor sube con ellas y el kart se inclina) y cada una
  trae su peligro: ovejas que cruzan (Pradera), cangrejos (Playa), donas que ruedan de bajada (Dulcelandia), bolas
  de nieve que crecen (Montaña nevada), bloques de piedra que caen de dos en dos con su sombra de aviso (Castillo),
  meteoritos con un círculo rojo donde van a caer (Arcoíris espacial), troncos rodando (Selva), peces globo que se
  inflan (Fondo del mar), pelotas que botan —por abajo se pasa— (Ciudad de juguete) y bolas de lava (Volcán). Si te pegan das vueltas (la burbuja te
  protege) y saltando se esquivan. Los peligros son dibujos de Gemini (kart/peligros), menos el bloque del
  Castillo, que tiene su cara de enojado dibujada en el juego.
- **Carreras** (3D): vista desde arriba, el carro va hacia donde apunta el stick. **A** = turbo, **B** = frenar.
- **Fútbol de bolitas**: vista de lado, Azules contra Rojos en el estadio. **Stick** = correr, **A** = saltar,
  **X o B** = patear (siempre hacia la portería contraria; con **↑** globito, con **↓** rasante, en el aire volea),
  **mantén LB + RB + Y** = salir. Antes del partido el Jugador 1 escoge: **todos contra la compu** o **unos contra otros**
  (la compu completa los equipos), a cuántos goles (3, 5 o 7) y el nivel de la compu (fácil, normal, difícil).
- **Duelo de bolitas**: uno contra uno de lado, estilo Street Fighter, con barras de vida, reloj de 60 s y rounds.
  **Stick** = caminar (**↑** saltar), **A** = golpe (3 seguidos = remate que tumba), **B** = patada, **X** = especial
  (el de cada personaje: estrella, láser, fuego, bala de cañón, embestida, aparecer por detrás...),
  **LB / RB** (o gatillos) = cubrirse, barra llena + **LB + RB** = súper forma, **mantén LB + RB + Y** = salir.
  Más movimientos: **↓** agacharse (los golpes altos pasan por arriba), **↓ + A** gancho hacia arriba (le pega al que
  viene saltando), **↓ + B** barrida que tumba, **B en el aire** patada voladora, **adelante + B** pegadito al rival
  = agarrarlo y aventarlo (ni cubriéndose se salva) y **dos toques al stick** = arrancón hacia adelante o rodada
  hacia atrás (rodando no te pegan). **Golpe final**: en súper forma, el primer **X** oscurece la pantalla, cruza una
  franja con tu personaje y el nombre de su golpe (Meteoro de puños, Mil relámpagos, Lluvia de estrellas...), le da
  una ráfaga de golpes al rival y un golpazo que no se puede cubrir; después se acaba la súper forma.
  Presentación: antes de cada pelea, pantalla de **VS** con los dos en su pose de entrada; la voz anuncia los rounds,
  los combos («¡Combo de 5!») y los últimos diez segundos. Los golpes salen con estallidos de cómic (¡POW!, ¡ZAS!,
  ¡Remate!), chispas y ondas de choque; abajo de la barra se cuentan los golpes seguidos; el que queda tirado ve
  estrellitas, y al final el ganador sale festejando con su frase («¡Soy una muralla!», «¡Ni me viste llegar!»...).
  Con un solo jugador se pelea contra la compu; con más, se turnan: el que gana se queda y el que pierde se forma
  al final (o todos por turnos contra la compu). El Jugador 1 escoge rival, rounds para ganar (1, 2 o 3), nivel
  de la compu y escenario (Dojo, Castillo, Bosque, Volcán, Pradera, Estadio o al azar).
  **Modos** (primer renglón de esa pantalla): **Duelo** (lo de siempre), **Torneo** (4 rivales seguidos, cada vez
  más difíciles, con una escalera que muestra a quién ya le ganaste, y al final el jefe: el **Rey Bolón**, una
  bolita gigante morada con corona, más vida y un salto aplastante; si pierdes, A = otra vez esa pelea; ganarlo da
  la calcomanía «Campeón del torneo»), **Supervivencia** (un rival tras otro con la misma vida —al ganar recuperas
  un poquito—, la compu se pone más difícil cada 3 victorias, se guarda el récord y con 5 seguidas ganas «Aguante»)
  y **Entrenamiento** (contra un muñeco que no pega, sin reloj ni K.O., la vida y la barra de poder se rellenan
  solas y arriba hay 12 retos que se palomean: golpe, patada, remate, gancho, barrida, patada voladora, agarre,
  arrancón, rodada, especial, súper y golpe final) y **2 contra 2** (los cuatro al mismo tiempo: J1 y J3 son los
  Rojos y J2 y J4 los Azules, la compu completa los equipos; los golpes no le hacen nada a tu compañero, el que cae
  queda fuera del round y gana el equipo que deje al otro sin nadie en pie).
  **Escenarios vivos**: público a los lados que brinca con cada golpe y festeja el K.O. (Estadio, Castillo y Lucha
  libre), pétalos de cerezo en el Dojo, hojas en el Bosque y la Pradera, chispas de lava en el Volcán, confeti en el
  Estadio, y escenarios nuevos: **Lucha libre** (con reflectores de colores), **Azotea** (de noche, con brillitos) y
  el **Castillo del Rey** (donde se pelea contra el Rey Bolón).
- **Bloquecito** (en Bolitas Bros, el Duelo, Pelea en equipo y Fútbol): un personaje hecho de bloques, dibujado con
  figuras (sin imágenes de Gemini). **Y** sube de número y **↓ + Y** baja (del 10 regresa al 1), cuando quieras y sin
  límite; la voz dice el número. Cada número tiene su color y su forma, y entre más grande es más fuerte y pesado pero
  más lento. Su especial cambia con el número: 1 embestida, 2 doble golpe, 3 malabares, 4 se vuelve cuadrado y
  aplasta, 5 estrella, 6 rueda como dado, 7 arcoíris, 8 ocho brazos, 9 golpazo y 10 despega como cohete.
  Su súper forma es **Octobloque** (el 8 superhéroe, con antifaz, capa y ocho brazos). Contar del 1 al 10 da
  la calcomanía "Hasta el 10".
- **Halcón de Acero**: abre https://hda.grupomegarey.mx (es otro proyecto; para volver, B en modo navegador).
- **Cómo jugar**: qué tecla es cada botón en los dos teclados y qué hace cada botón en cada juego (una página
  por juego, ◀ ▶ para cambiar). Con **Y** abre la **prueba de controles**, que muestra lo que el navegador ve
  de cada control, botón por botón.

Los juegos 3D usan [Three.js](https://threejs.org) y se descargan hasta que alguien entra a ellos.

## Jugar en el celular

- **Con un control por Bluetooth:** se conecta al cel y funciona igual que en el Xbox.
- **Con la pantalla:** en pantallas táctiles aparece un stick (donde pongas el dedo, del lado izquierdo)
  y los botones A B X Y con LB y RB a la derecha. Cuenta como un control más ("Pantalla"), así que
  sirve en todos los juegos. En el Modo Bebé solo quedan LB y RB (para salir); lo demás es para tocar.
  Si hay un control conectado y nadie toca la pantalla, los botones se esconden solos.
- Se juega con el teléfono **horizontal**. En Android, al primer toque se pone en pantalla completa;
  en iPhone conviene **Compartir → Agregar a pantalla de inicio** para abrirlo como app, sin barras.
- Para probar los botones táctiles en la compu: agrega `?tactil` a la dirección.

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

Para gastar menos del límite de Gemini se le puede pedir una **hoja** con varias poses del mismo personaje
(en filas, bien separadas, sobre fondo verde liso) y partirla con
`node tools/split-sheet.mjs <hoja.jpg> <personaje> [<personaje>_super]`: una fila de 4 poses
(normal, golpe, salto, dolor) por nombre, o los nombres exactos (`tanque-patada tanque-cubrirse ...`).
Deja las poses sueltas en `arte/smash/personajes/`. Todos los juegos usan además `caminar1` a `caminar4`
(los cuadros de la caminata; con personajes anchos sale mejor pedirlos en 2 filas de 2) y el Duelo
`patada`, `cubrirse`, `especial` y `gana` (si faltan, usa la pose más parecida); el fondo del dojo va en
`arte/duelo/fondos/dojo.jpg`.

## Jugar en el Xbox

El navegador solo deja leer controles en páginas **HTTPS** (o `localhost`), así que en el Xbox
se juega desde GitHub Pages:

1. Sube el repo a GitHub y en **Settings → Pages → Source** elige **GitHub Actions**.
2. Cada `git push` publica solo (ver `.github/workflows/deploy.yml`) en
   `https://<tu-usuario>.github.io/LeoGames/`.
3. En el Xbox: desactiva **"Apps can add a border"** (borde de overscan) para que no vaya lento.
4. Abre la dirección en **Edge**, mantén **≡ (Menú)** → **"Use game controls"** → **A**.
5. Si algo falla, en el menú **Cómo jugar** → **Y** abre la prueba de controles para ver qué detecta el navegador.

## Pruebas

`npm test` levanta el juego y corre bots que lo juegan con controles simulados (menú, cada juego,
pantalla táctil, música/voz/premios). En la compu usan el Edge instalado; en GitHub Actions corren
antes de cada publicación, y si alguna falla no se publica.

## Estructura

- `src/shared/controls.js`: lee controles y teclado. No depende de Phaser (para reutilizarlo con Three.js).
- `src/shared/players.js`: quién juega, con qué control y de qué color.
- `src/games.js`: catálogo de juegos del menú.
- `src/scenes/`: pantallas (unirse, menú, personajes, premios, cómo jugar, prueba de controles).
- `src/shared/touch.js`: controles táctiles para el celular (cuentan como un control en `controls.js`).
- `src/shared/clock.js`: tiempo real entre cuadros (para que nada vaya en cámara lenta si baja el fps).
- `src/shared/sound.js`: efectos de sonido sintetizados.
- `tools/prepare-art.mjs`: prepara el arte de Gemini de todos los juegos (`npm run arte`).
- `tools/split-sheet.mjs`: parte una hoja de Gemini con varias poses en imágenes sueltas.
- `src/games/brawl/`: Pelea en equipo (Phaser).
- `src/games/smash/`: Bolitas Bros (Phaser), con cámara que hace zoom y otra fija para el marcador.
- `src/games/futbol/`: Fútbol de bolitas (Phaser): cancha, balón, jugadores y la compu (`cpu.js`).
- `src/games/duelo/`: Duelo de bolitas (Phaser): peleador, golpes y especiales (`moves.js`), lo que se lanza
  (`shots.js`), escenarios y la compu.
- `src/games/kart/` y `src/games/race/`: los dos juegos de carreras (Three.js).
- `src/games/three/`: piezas 3D compartidas (pista, modelo del kart, lienzo).
- `src/games/ThreeGameScene.js`: abre un juego 3D encima de Phaser y lo cierra al salir.
- `src/ui/`: estilos y el personaje (la bolita); `BlockBody.js` dibuja a Bloquecito (sus números están en
  `src/games/smash/bloquecito.js`).
