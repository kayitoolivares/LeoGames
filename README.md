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
- **Pelea en equipo**: todos contra los monstruos, estilo arcade. Se escoge en el **mapa de mundos** (con candados y
  hasta 3 estrellas por mundo: ganarlo, que nadie se caiga y hacerlo en menos de 4 minutos). 9 mundos de 4 rondas
  con su jefe: Pradera (Rey Slime), Bosque de hongos (Gran Hongo, llama ayudantes), Volcán (Dragón de lava, lanza
  fuego), **Playa** (cangrejos, almejas y el Capitán Pulpo que lanza tinta), **Montaña nevada** (muñecos de nieve,
  yetis bebé y el Gran Yeti con bolas de nieve) y **Castillo embrujado** (murciélagos, calabazas y el Rey Calabaza,
  que llama murciélagos y lanza magia), **Dulcelandia** (gomitas, caramelos voladores, cupcakes y el Rey Pastel que
  lanza betún), **Espacio** (marcianitos, ovnis, robotitos y el Mega Robot con su láser) y **Valle de los dinos**
  (raptorcitos, pterodáctilos, triceratops y el Rey Rex, que llama raptorcitos y avienta rocas). Ganar un mundo
  desbloquea el siguiente. Cada ronda es un tramo del nivel: al
  limpiarla sale "¡Adelante!" y se camina a la derecha (la pantalla avanza) hasta el siguiente. Cuando llega el jefe,
  todo se detiene para presentarlo, con música de jefe. Al final del mundo, **resultados con premios** (más golpes,
  más monstruos, mejor compañero —el que levantó a más— y el que tumbó al jefe). **Modo sin fin**: rondas que no se
  acaban, cada vez más difíciles y con jefe cada 5; se guarda el récord. **Defiende el nido** (siempre abierto): en
  medio hay un nido con huevos y más de la mitad de los monstruos va por él en vez de por ustedes; aguántenlo 5 rondas
  (la última con jefe) antes de que le peguen 9 veces y se lleven los huevos.
  En cada mundo: en el segundo tramo un **animal para montar** (dinosaurio o pollo gigante: corre más, muerde doble y
  aguanta los golpes por ti) y un **mini jefe**; desde ahí, las **trampas** del mundo (resortes que te avientan y
  aplastan al caer, rocas y bolas de nieve que ruedan, cañonazos, lava, fuego fantasma, chicle que hace ir lento y
  meteoritos; avisan antes y también les pegan a los monstruos), y en el tercero una **jaula con un amigo**: rómpela y
  pelea con ustedes el resto del mundo. Los jefes **se enojan** a la mitad de su vida (rojos, más rápidos y con más
  poderes) y su K.O. se ve otra vez en **repetición** en cámara lenta (A la brinca). Un **narrador** comenta los combos,
  los que caen, los rescates y los récords.
  **Amigos de la compu** (Y en el mapa): hasta 3 que pelean solos, levantan a los caídos y se suben al combo. **Combo en
  equipo**: cada golpe de cualquiera suma (con 20, calcomanía); si avientas un monstruo y otro le pega en el aire,
  **¡combo doble!** **Monedas**: los monstruos las sueltan (los jefes, muchas) y van a la alcancía de la familia; en la
  **tienda** (X en el mapa) se compran sombreros y colores de traje para cada jugador. **Jefes en serie** (se abre al
  ganar el primer mundo): los jefes de los mundos ganados uno tras otro, contra el reloj. Al final, **medallas** (más
  golpes, más monstruos, mejor compañero, el que tumbó al jefe, más monedas, el que rescató y el jinete) y
  **récords** (mejor combo, más monedas, mejor tiempo de cada mundo y de los jefes en serie), que se ven en el mapa.
  **X** = pegar (tres seguidos = **remate** que avienta lejos), **B** = el **especial** de cada personaje (puñetazo
  cargado, embestida, súper salto que aplasta, estrellas, aparecer por detrás, láser, fuego, invisible, coletazo,
  arañazos, deslizón, bala de cañón, polvo mágico que **cura** a los compañeros, mochila cohete, aguijonazo, chorro de
  agua), **LB o RB** = **agarrar** un monstruo chico y aventarlo (tumba a los demás como boliche), barra llena +
  **LB + RB** = **súper** (si dos o más se vuelven súper casi juntos: **¡golpe en equipo!** a toda la pantalla),
  **A** = saltar (esquiva cuando al monstruo le sale "!"), **mantén LB + RB + Y** = salir. En cada tramo hay **cajas,
  barriles y jarrones**: rotos sueltan comida (cura), martillo (pega doble), bomba (X la lanza), estrella
  (invencible), espada (pega doble y llega más lejos), escudo (aguanta 3 golpes), imán (jala monedas y comida) o
  mascota (un perrito que muerde monstruos). Si alguien cae, un compañero se para junto a él para levantarlo.
- **Súper Bolitas** (plataformas estilo Mario Bros): hasta 4 a la vez en la misma pantalla, con los personajes de
  Bolitas Bros. Mapa con caminito y **7 mundos** de 4 niveles (el segundo es un **fuerte con mini jefe** y el
  cuarto un **castillo con jefe**): Pradera y cuevas (Rey Hongo), Nubes y cielo (Rey Nube, con viento), Agua y playa
  (nadar; Rey Cangrejo), Castillo de lava (Rey Dragón), **Montañas de nieve** (piso de hielo que resbala, pingüinos
  que se deslizan de panza, bolas de nieve, carámbanos que caen; Rey Yeti), **Dulcelandia** (chicle que pega, ríos de
  chocolate, galletas, donas, paletas y chicles que brincan; Rey Pastel) y la **Casa embrujada** (fantasmas tímidos
  que solo se acercan si no los ves, esqueletos que se desarman, velas, **puertas** a otros cuartos; Rey Calabaza).
  En el mapa los jugadores caminan por el caminito (◀ ▶, LB/RB = otro mundo), hay una **casita de regalos** por mundo
  (tres regalos que se revuelven: un poder para empezar, vidas o monedas) y un **enemigo que camina por el mapa**:
  si lo alcanzan, ¡batalla! **Salidas secretas**: algunos niveles tienen una bandera azul escondida que abre un
  **nivel secreto** en el mapa. Con X en el mapa, los **modos**: **contrarreloj con fantasma** (el nivel escogido, tú
  solo contra tu mejor vuelta), **batalla de monedas** (90 segundos; brincarle encima a otro le tumba monedas),
  **jefes en serie** (todos los jefes seguidos, con récord), la **tienda** de sombreros y trajes (las monedas de la
  familia, las mismas de Pelea en equipo) y **vidas extra** (20 monedas).
  A = saltar (más alto si lo sostienes), B = correr, X = el poder / lengüetazo, ↓ en un tubo = meterse, ↑ en una
  puerta = entrar. Poderes nuevos: **pluma** (capa: con A sostenido planeas y con X giras), **flor de hielo** (X
  congela enemigos: se pisan como bloque o se patean), **hongo mini** (chiquito: cabe en todos lados y corre sobre el
  agua) y **hongo gigante** (un rato enorme: rompe todo). **Dinosaurios de colores**: verde (lengua), rojo (escupe
  fuego), azul (aletea con A) y amarillo (hace temblar el piso al caer). Bloques nuevos: **botón P** (los ladrillos se
  vuelven monedas un ratito), **bloques de colores** (el bloque ON/OFF cambia cuáles están), **cañones** que disparan
  balas y **plataformas que dan vueltas**.
  Bloques sorpresa con **hongo** (crecer), **flor de fuego**, **estrella** (invencible) y **huevo de dinosaurio**
  (montado saltas más y con X te comes a los enemigos; si te pegan, se asusta y se va); bloques escondidos con vidas;
  **3 monedas grandes** escondidas por nivel y **tubos secretos** a cuartos con monedas. Enemigos para pisar (hongos,
  tortugas que dejan caparazón para patear, murciélagos, pájaros, cangrejos), otros que no (erizos con picos, peces,
  medusas, bolas de fuego de la lava, la pesa aplastadora, la nube que tira erizos), resortes, plataformas que se
  mueven y que se caen, lava y picos. Los jefes se pisan 3 veces (cada uno con su truco: el Rey Hongo hace temblar
  el piso, el Rey Nube lanza rayos, el Rey Cangrejo se lanza corriendo y el Rey Dragón escupe fuego). Si alguien
  cae y quedan compañeros, regresa en una **burbuja** que se revienta tocándola; vidas para todo el equipo (cada 50
  monedas, una más) y **banderín** a la mitad. **Modo peque** (Y en el mapa, cada quien): si se cae a un hoyo o a la
  lava, regresa rebotando a donde estaba, y el equipo tiene más vidas. Narrador, calcomanías y mejor tiempo por
  nivel. Los dibujos (enemigos, jefes, objetos y fondos) son de Gemini; los bloques y el piso se dibujan con código.
  **Dibujos 100% nuestros**: nada copiado de otros juegos. El bloque sorpresa es una caja de regalo morada, los tubos
  son troncos huecos, el hongo malo trae gorrito de mago, la planta es una atrapamoscas, el fantasmita es de sábana
  con moño, la pesa aplastadora, la bala con goggles, el Rey Dragón morado con capa, los hongos de poder (de remolinos,
  mini y gigante con estrellas), la flor de fuego de llamas y la casita de regalos del mapa.
  Los niveles son largos (unos 200–260 cuadritos los normales y ~140 los fuertes y castillos) y `tools/plat-check.mjs`
  revisa que se puedan pasar saltando, que no haya bloques sobre hoyos y que a cada bloque se le pueda pegar por
  abajo (que quepa uno debajo: el jugador chiquito mide más que un cuadrito). Los jefes que vuelan bajan al piso a
  descansar: ahí se les brinca encima. Los monstruitos se mueven con vida: los que caminan rebotan y se balancean en cada paso
  (y dan un brinquito al verte), los que vuelan aletean y dan la vuelta en las paredes, los peces coletean y las
  medusas y velas laten; ninguno se mete en el piso, el techo ni las paredes.
- **Bolitas Bros** (estilo Smash, fase 3): cada golpe sube tu **%** y entre más llevas, más lejos sales volando;
  si te sacan de la pantalla pierdes una de tus 3 vidas. Antes de pelear cada quien escoge personaje:
  **Tanque** (fuerte y pesado, B = puñetazo cargado), **Rayo** (rápido, B = embestida),
  **Resorte** (salta 3 veces, B = súper salto), **Estrella** (B = lanza estrellas), **Ninja** (B = aparece por detrás),
  **Robot** (B = láser), **Dragoncito** (flota, B = fuego), **Fantasma** (B = invisible), **Dino** (B = coletazo a
  los dos lados), **Gatito** (salta 3 veces, B = arañazos), **Pingüino** (B = se desliza de panza), **Pirata**
  (B = bala de cañón), **Hada** (flota, B = polvo mágico), **Astronauta** (B = mochila cohete), **Abeja** (salta 4 veces,
  B = aguijonazo), **Bombero** (B = chorro de agua que empuja), **Luchador** (lucha libre: B = plancha, brinca y cae
  aplastando), **Unicornio** (B = rayo arcoíris) y **Bloquecito** (ver abajo). Con la barra llena,
  **LB + RB** = súper forma por 10 segundos.
  **A** = saltar, **X** = golpe (con ↑ hacia arriba, con ↓ barrida o pisotón), **B + ↑** = salto de rescate,
  **RB / LB** (o gatillos) = escudo (si se rompe quedas mareado), **↓** = bajar de plataforma, **mantén LB + RB + Y** = salir.
  Caen objetos: **martillo** (8 s de martillazos con X), **bomba** (X la lanza), **corazón** (-40 %)
  y **estrella** (6 s sin recibir golpes). **Y** en la selección activa el **modo peque** (menos daño y menos empujón).
  El Jugador 1 escoge escenario (**Castillo**, **Nubes** con plataformas que se mueven, **Barco pirata**, y los
  desbloqueables **Espacio** con gravedad baja —al ganar una pelea— y **Volcán** con géiseres de lava —al
  transformarte en súper—),
  si hay objetos, cuántos CPUs y su nivel (fácil, normal, difícil). Con un solo jugador siempre hay al menos un CPU.
  **Modos**: **Vidas** (el de siempre), **Tiempo** (2 minutos y vidas sin fin: +1 por cada rival que saques, -1 si te
  caes), **Equipos** (Rojos J1 y J3 contra Azules J2 y J4, la compu completa los equipos y no le pegas a tu compañero),
  **Jefe** (todos juntos —la compu de tu lado— contra el **Rey Bolón** gigante con su barra de vida; si lo sacan de la
  pantalla regresa pero pierde vida) y **Blancos** (rompe las 10 dianas lo más rápido que puedas; se guarda el récord
  de cada escenario).
  Más movimientos: **escudo + X** pegadito agarra al rival (aunque se cubra) y lo avienta hacia donde apuntes;
  **escudo + ◀ ▶** = rodar (no te pegan) y escudo en el aire = esquivar; cayendo junto a la orilla te **agarras de ella**
  (A, ↑ o hacia el escenario para subirte). Objetos nuevos: **bate** (4 batazos que mandan lejísimos), **pistola de
  rayos**, **patineta** (corres más) y **huevo sorpresa** (sale un ayudante que pelea de tu lado un rato). De vez en
  cuando aparece la **bola súper**: el que la rompe brilla de colores y con **B** hace su **golpe final**, que le pega
  a todos los rivales.
  Al empezar, todos en fila en su pose de entrada; al terminar, un **podio** con a cuántos sacó cada quien, cuántas
  veces se cayó y cuánto pegó. Golpes con estallidos de cómic y ondas de choque.
  Escenarios nuevos: **Selva** (tronco gigante, hojas y un columpio de liana; caen cocos), **Ciudad de juguete**
  (bloques de colores; caen bloques que aplastan y se quedan un rato de plataforma) y **Fondo del mar** (flotas un
  poquito; de unas bocas salen burbujas que te suben). Y los de siempre traen su **sorpresa**, siempre con aviso:
  rayo en el Castillo, viento en las Nubes, la ola que ladea el Barco y un cohete que cruza el Espacio.
  **Ronda 3** (con dibujos de Gemini donde hace falta):
  - **Golpe cargado**: mantén **X** en el piso (golpe normal, hacia arriba o barrida): brilla y tiembla mientras junta
    fuerza y al soltar pega más fuerte, más grande y avienta más lejos.
  - **Escudo perfecto**: si te cubres (RB / LB) justo antes del golpe, no gastas escudo, el que pegó se queda mareado
    y los disparos se regresan.
  - **Objetos nuevos**: **bumerán** (va y regresa a tu mano, 3 veces), **flor de fuego** (bolas de fuego que botan),
    **resorte** (se queda en el piso y te avienta para arriba), **cápsula sorpresa** (sale otro objeto... o explota) y
    **tornado** (avanza y levanta a los rivales dando vueltas).
  - **Jefes para escoger**: el **Rey Bolón** (salto aplastante; al ganar el modo Jefe), **Dragonzote** (vuela y echa
    una llamarada; al terminar la Aventura) y **Robotote** (puño cohete; con un jonrón de más de 100 m). Son más
    grandes y pesados; salen al final de la lista de personajes.
  - **Modos nuevos**: **Jonrón** (10 segundos para pegarle al saco y luego un batazo; la cámara lo sigue y se mide
    cuántos metros llegó, por turnos y con récord), **Monedas** (los golpes sacan monedas; gana el que junte más y si
    te caes pierdes la mitad), **Rey de la colina** (quédate solo en la zona de la corona; gana el primero en juntar
    30 segundos; la zona se cambia de lugar) y **Aventura** (6 niveles seguidos: pelea en el castillo, dianas de la
    selva, una torre de nubes para subir hasta la bandera, la pandilla de la ciudad, Tanque gigante y Dragonzote
    gigante; si pierdes, lo vuelves a intentar).
  - **Escenarios nuevos**: **Casa embrujada** (escoba que flota; cruza un fantasma), **Pastel gigante** (galletas que
    suben y bajan; caen cerezas), **Ciudad de noche** (azotea y la canastilla de los limpiaventanas; cruza un avión de
    papel) y **Globos** (canastas que dan vueltas sobre un dirigible; sopla el viento).
  - **Repetición del K.O.**: el golpe que gana la pelea otra vez en cámara lenta, con zoom y un «¡K.O.!» gigante
    (A la brinca).
  - **Trajes**: en la selección, **X** cambia el color de tu traje (si dos traen el mismo personaje, el segundo sale de
    otro color).
  - **Ronda 4**: dos personajes nuevos, **Luchador** y **Unicornio** (también en el Duelo, Pelea en equipo, Fútbol,
    Karts y Súper Bolitas); el modo **Bomba caliente** 💣 (una bomba con su reloj anda arriba de la cabeza de alguien;
    pegándole a otro se la pasas y al que le explota sale volando lejísimos) y dos escenarios: **Ring de lucha libre**
    (las cuerdas rebotan al que llega a la orilla) y **Cancha de fútbol** (los travesaños son plataformas y cruza
    rodando un balón gigante).
  - **Narrador y premios**: comenta el primer golpe, los golpazos, quién sale volando, las paradas perfectas, los
    golpes cargados, los objetos y los últimos 10 segundos; al final salen los premios: más golpes, golpe más fuerte,
    más caídas, paradas perfectas y más objetos.
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
  **Copa Sorpresa** (4 pistas nuevas con paisaje de Gemini): **Casa embrujada** (de noche, calabazas que brillan y
  fantasmitas que cruzan), **Pastel de cumpleaños** (sube por un pastel gigante con velitas, regalos y globos; fresas
  que ruedan), **Valle de los dinos** (helechos, huevos y dinosaurios que cruzan; un río) y **Circuito de las nubes**
  (arcoíris encima del camino, dos planeadores y rayos que caen).
  **Atajos secretos**: casi todas las pistas tienen uno; un letrero amarillo "¡Atajo!" avisa dónde hay un hueco en las
  llantas: pegándote a esa orilla entras a un caminito de tierra que corta la curva (la compu también lo usa a veces).
  **Rebufo**: ir pegadito detrás de otro kart un ratito da un turbito (sale viento a los lados). **Planeador**: las
  rampas azules abren un ala delta y el kart planea despacito (se puede girar). **Agua**: algunas pistas tienen un túnel
  de agua (y el Fondo del mar va todo bajo el agua): el kart saca su hélice, salen burbujas y los saltos flotan.
  Poderes nuevos (dibujos de Gemini): ⭐ **estrella** (invencible, más rápido y tumba al que toques), 👻 **fantasma**
  (te vuelves transparente, nada te pega y le robas su poder a otro), 💣 **bala** (maneja sola rapidísimo y tumba a
  todos) y 🐝 **abeja** (vuela por encima de todo hasta el primero y le pica, y a los que encuentre en el camino).
  **Contrarreloj** (el quinto modo): sin compu ni cajitas, 3 vueltas contra el reloj; se guarda el récord de cada
  pista con la mejor vuelta, y la siguiente vez corre un **fantasma** transparente con la carrera del récord.
  En las pantallas de escoger: **X** = velocidad (lento, normal, rapidísimo y **espejo**: las pistas al revés, se abre al
  ganar una copa) y **Y** = clima (el de la pista, soleado, **lluvia** con charcos que te hacen resbalar, **nieve** o
  **noche** con faros en los karts y lámparas junto al camino).
  **Rivales con personalidad**: cada piloto de la compu maneja a su manera (veloz, tramposo, presumido que hace trucos
  o tranquilo) y tiene un rival entre los jugadores: le echa más ganas si lo trae cerca y le dice cosas al rebasarlo,
  al pegarle o al final. Un **narrador** (voz y letrero arriba) cuenta quién va primero, los atajos, los golpes grandes
  y quién cruza la meta. Al terminar, **repetición** de la llegada en cámara lenta con cámaras de tele (A la brinca)
  y una foto del podio. Chispas de colores al derrapar, salpicadas, rayitas de velocidad con el turbo y confeti en la meta.
  **Batallas** (en la arena): **Globos** (la de siempre), **Atrapa la estrella** (el que toca la estrella se la lleva
  arriba de su kart y le cuenta el tiempo; si le pegan, la suelta; gana el que la tuvo más) y **Monedas** (van saliendo
  monedas por la arena y si te pegan se te caen 3; gana el que junte más). Al terminar, **B** = otra batalla.
  **Eliminación**: carrera sin fin de vueltas; a los 25 segundos y luego cada 18 sale el que va al último (avisa antes);
  gana el último que queda. Los que salen ven la carrera desde el kart del primero.
  **Escuela de manejo**: retos cortitos para los jugadores (sin compu ni cajitas) con medalla de oro, plata o bronce, y
  se guarda la mejor de la familia: **Aros** (pasar por 8 aros), **Derrapes** (3 turbos de derrape), **Salto largo**,
  **Conos** (slalom: cada cono tirado o puerta saltada, +2 segundos) y **Monedas** (las más en 40 segundos). Las medallas
  se calibraron con un bot que maneja perfecto: el oro pide casi lo que hace el bot.
  **Aventura**: 3 mundos (Pradera, Aventura y Estrella) de 4 retos que se van abriendo: llegar entre los primeros,
  terminar con 10 monedas, ganarle a un rival uno contra uno, llegar sin que te peguen, aguantar en una eliminación o
  ganar en una tormenta de nieve; el último de cada mundo es una carrera contra un **jefe en su kart** (Rey Bolón,
  Dragonzote y Robotote, dibujados manejando por Gemini): es más grande, más rápido y avienta cohetes, plátanos o rayos.
  Al pasar un reto, **A** = el que sigue y **B** = el mapa de la aventura.
  **Copa Tesoro** (4 pistas con paisaje de Gemini): **Desierto** (cactus, pirámides, rodadoras que ruedan y el cruce
  del tren; en la última vuelta se hace de noche), **Ciudad de noche** (edificios con ventanas encendidas, letreros
  de neón, plumas que suben y bajan y taxis que cruzan), **Casa gigante** (los karts chiquititos por el piso de la
  cocina, entre libros, crayolas y patas de mesa; un puente levadizo y pantuflas que pisan) y **Barco pirata** (muelles
  de madera sobre el mar, cañones de agua, puente levadizo y balas del barco; en la última vuelta llega la tormenta).
  **Pistas vivas** (`living.js`): un **tren** que cruza (bajan las plumas y parpadean los focos; si te alcanza das
  vueltas), **plumas** que se turnan para bajar (la de abajo te rebota; siempre hay un lado libre), **cañones de agua**
  que te empujan de lado y **puentes levadizos** que, subidos, son rampa. También en la Playa (cañones), la Selva
  (puente) y la Ciudad de juguete (trenecito).
  **Clima que cambia**: con **Y** = "Cambia" el clima cambia en cada vuelta (soleado, lluvia, noche, nieve); con el
  clima de la pista, el Desierto y el Barco pirata cambian en la última vuelta.
  **Arma tu pista** (el noveno modo): el Jugador 1 dibuja su pista moviendo puntos en un mapa (A agarra o pone un
  punto, X lo quita, LB/RB hacen lomas, Y cambia el paisaje, LT empieza otra vez, RT ¡a correr!). Se guarda sola,
  se pone en rojo si se encima y sale al final de las pistas como "Mi pista" (con flechas y rampa en sus rectas).
  **Poderes nuevos** (dibujos de Gemini): 🧲 **imán** (un rato jala hacia el de adelante y atrae las monedas),
  **muro de gelatina** (atrás: el que choca rebota; aguanta 3 golpes), 🌪️ **tornado** (avanza por la pista
  zigzagueando y levanta a los que toca), **resorte** (súper brinco: por encima de plátanos y cohetes) y
  **bomba pegajosa** (se le pega al de adelante y explota a los 3 segundos; chocando con otro se la pasas).
  **Karts especiales** (en la tienda), cada uno con su truco con **Y**: **Moto** (caballito: turbo con la trompa
  arriba), **Tanquecito** (cañonazo derechito), **Nave flotante** (flota: el pasto no la frena; da un salto) y
  **Carrito de bebé** (¡bua!: llora tan fuerte que avienta a los que tiene cerca).
  **Mejoras** (en la tienda, para toda la familia, 3 niveles cada una): **motor** (más rápido), **llantas** (gira
  mejor y el pasto frena menos) y **turbo** (nitro más fuerte y más largo). En el taller se ven junto al kart.
  **Kart para dos**: en el taller, **LB** = ir de copiloto de otro jugador: él maneja y tú avientas los poderes con
  **X** (y también echas nitro con RB). Los dos se ven en el kart. Si los dos echan nitro casi al mismo tiempo:
  **¡turbo de equipo!**
  **Trucos y derrapes**: en el aire, **LB** con el stick hacia **↑** = mortal, **↓** = mortal para atrás, **◀ ▶** =
  vuelta de lado, nada = giro; si alcanza, otro más (combo: turbito más grande al caer). Derrapando mucho rato salen
  chispas de **arcoíris** (el turbo más grande).
  **Pilotos con caras** (Gemini): manejando ponen cara de feliz (al pegarle a alguien, rebasar al primero o hacer
  trucos) o de enojado (si les pegan), y en la esquina de su pantalla está su carita.
  **Público y tele**: gradas con aficionados (los del Duelo) junto a la meta que echan porras, el helicóptero de la
  tele siguiendo al primero, un dirigible, globos aerostáticos y un camarógrafo; confeti al rebasar al primero.
  **Récords y medallas**: cada pista guarda su récord (según las vueltas) y se ve en su tarjeta; cada copa guarda
  su mejor medalla (oro, plata o bronce, según el lugar en la copa); en las carreras normales también corre el
  fantasma del récord del contrarreloj.
- **Carreras** (3D): vista desde arriba, el carro va hacia donde apunta el stick. **A** = turbo, **B** = frenar,
  **X** = usar el poder. Primero se escoge el modo: **carrera rápida** (en una de **8 pistas**: Pradera, Playa,
  Dulcelandia, Montaña nevada, Selva, Desierto, Castillo y Arcoíris espacial, con el trazo y los colores de las de Karts
  locos) o **campeonato** (Copa Sol o Copa Luna: 4 carreras seguidas con puntos 10-8-6-4 y tabla después de cada una).
  Luego cada quien su **carro** (◀ ▶ y A = listo): Clásico, Bólido (el más rápido), Mini (vueltas cerradas), Monstruo
  (el pasto no lo frena y empuja fuerte), Cohete (el turbo más fuerte) y Patito. En la pista hay **cajas de regalo**
  con poderes: triple turbo, mancha de aceite (el que la pisa da una vuelta), escudo (aguanta un golpe) y cohete (va
  por el de adelante); a los de atrás les tocan los mejores.
- **Fútbol de bolitas**: vista de lado, dos equipos con uniforme (Tiburones, Dragones, Ranas, Abejas, Pulpos, Tigres).
  **Stick** = correr, **A** = saltar, **X** = patear (siempre hacia la portería contraria; con **↑** globito, con **↓**
  rasante, en el aire volea), **LT o RT** = **pase** (un globito que cae junto al compañero que va más adelante),
  **B** = barrida (tumba al rival; cerquita del balón, patea), **LB o RB** = regate (un
  arrancón en el que no te pueden barrer), **mantén LB + RB + Y** = salir. Tocar y patear el balón llena la barrita de
  cada quien; llena + **LB + RB** = **tiro especial** de su personaje (de fuego derechito, en zigzag o cohete que sube y
  cae en picada): atraviesa a todos y tumba a los rivales.
  Antes del partido el Jugador 1 escoge:
  - **Modo**: **Partido**, **Copa de fútbol** (3 partidos contra la compu: cuartos, semifinal y la gran final, cada uno
    más difícil y en otra cancha; si pierdes, intentas otra vez ese partido; al ganar la final sale la copa),
    **Liga** (5 jornadas, una contra cada equipo; los otros equipos también juegan entre ellos y después de cada
    partido se ve la **tabla** con partidos jugados, ganados, perdidos, goles a favor y en contra y puntos; el que
    termina arriba es campeón) o
    **Penales** (5 tiros por equipo y luego muerte súbita: el que tira escoge **↑** alto, nada = medio o **↓** rasante;
    el portero adivina: parado ataja los rasantes y brincando a tiempo con **A** los de arriba).
  - **Equipos**: **todos contra la compu** o **unos contra otros** (la compu completa los equipos).
  - **Cómo se acaba**: a 3, 5 o 7 goles, o **por tiempo** (2 o 3 minutos; si van empatados, **gol de oro**).
  - **Nivel de la compu** (fácil, normal, difícil; la compu también se barre, regatea, se pasa el balón y usa su tiro
    especial).
  - **Porteros**: la compu o, con 2 o más jugadores, **el último de cada equipo es el portero** (🧤): no se aleja de
    su portería, atrapa los tiros que vienen y los despeja con **X**. El portero de la compu también atrapa (más
    seguido entre más difícil).
  - **Cancha** (dibujos de Gemini): **Estadio**, **Playa** (la arena frena el balón), **Nieve** (se resbalan),
    **Luna** (poca gravedad: todo flota), **Azotea**, **Selva** (llueve: el balón se resbala), **Dulcelandia** (piso
    de gelatina: todo rebota) y **Estadio de noche**.
  - **Uniformes** y **poderes en la cancha** (sí o no): de vez en cuando aparece una cajita flotando; el que la toca
    (o le pega con el balón) se lleva el poder para su equipo: **balón gigante**, **portería chiquita** (la del rival),
    **imán** (el balón se te pega), **hielo** (congela a los rivales) o **tenis veloces**.
  Cada gol trae **repetición en cámara lenta** (A la brinca) y **festejo**: el que lo metió baila, da una voltereta,
  se barre de rodillas o hace el avioncito, y sus compañeros corren a abrazarlo; hay **narrador** (voz y letrero), **público**
  enfrente que hace la ola con banderas de cada equipo, marcador con reloj, estela en los tiros fuertes, letreros de
  cómic, la red que se mueve y, al final, el **mejor jugador** con la tabla de goles, tiros, robos y atajadas.
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
  **Ronda 3** (con dibujos de Gemini donde hace falta):
  - **Parada perfecta**: si te cubres (LB / RB) justo antes de que te peguen, el golpe rebota, el rival se queda
    mareado y tu barra sube; lo que te lanzan se le regresa.
  - **Movimientos secretos**: cada personaje tiene dos más, **↓ + X** (agachado) y **X en el aire**: terremotos,
    picadas, lluvia de estrellas, shurikens, puño cohete, bola de estambre que bota, bola de nieve que congela, curita
    del hada, burbuja sin gravedad...
  - **Ayudante** (**Y**, una vez por round; Bloquecito: **↑ + Y**): un amigo entra corriendo, le da un golpazo al rival
    y se va.
  - **Objetos que caen** (se puede apagar): corazón (cura), martillo (los siguientes 3 golpes pegan más y tumban),
    bomba (la avientas) y escudo (una burbuja que aguanta 2 golpes).
  - **Modos nuevos**: **Escuela de peleas** (15 lecciones con letrero y voz: caminar, saltar, golpe, patada, remate,
    cubrirse, parada perfecta —el muñeco avisa «¡Ahí va!»—, gancho, barrida, especial, secretos, ayudante, súper y
    golpe final), **Retos** (10 misiones: sin cubrirse, combo de 6, golpe final, perfecto, solo patadas, 3 paradas,
    en menos de 30 segundos, secretos, ayudante y contra Dragonzote; se guardan las cumplidas), **Torneo familiar**
    (llaves de 4 u 8 peleadores, jugadores y compu; las peleas de la compu se deciden solas), **Jefes secretos**
    (**Dragonzote**, un dragón gigante que echa llamaradas, en su guarida del volcán; **Robotote**, un robot gigante con
    puño cohete, en su fábrica; y el Rey Bolón) y **Salón de la fama** (victorias de cada personaje y récords: combo
    más largo, rounds perfectos, paradas, golpes finales y supervivencia).
  - **Escenarios nuevos**: Playa (caen cocos), Pueblito nevado (los empujones resbalan), Estación espacial (se salta
    más alto) y Cueva de cristales (caen cristales), más las guaridas de los jefes.
  - **Repetición del K.O.**: el golpe que gana la pelea otra vez en cámara lenta, con zoom y un «¡K.O.!» gigante
    (A la brinca).
  - **Trajes**: en la pantalla de antes de pelear, cada quien cambia el color de su traje con **X** en su control
    (si dos traen el mismo personaje, el segundo sale de otro color).
  - **Narrador**: comenta el primer golpe, los combos, las paradas, los secretos, el ayudante, los objetos y quién
    tiene poquita vida (con voz y letrero).
  - **Locura** 🎲 (opción en el duelo y en 2 contra 2): cada round trae una sorpresa distinta: gravedad de luna,
    gravedad doble, piso de hielo, barra llena para todos o todos con media vida.
  - **Escenarios nuevos** (con los dibujos de las canchas nuevas del fútbol): **Estadio de noche**, **Dulcelandia**
    (se salta más alto) y **Selva con lluvia** (el piso resbala). Luchador y Unicornio también pelean aquí (plancha y
    rayo arcoíris; agachados, azotón y lluvia de estrellitas; en el aire, plancha voladora y cuernazo).
- **Bloquecito** (en Bolitas Bros, el Duelo, Pelea en equipo y Fútbol): un personaje hecho de bloques, con dibujos de
  Gemini para cada número y su súper forma (`bloque1` a `bloque10` y `octobloque`, con sus poses y su caminata). Para
  que Gemini no se equivoque contando cubos, cada hoja se pide con una referencia que dibuja el juego (la cantidad
  exacta de cubos y las poses). Si falta un dibujo, se ve con bloques dibujados con figuras (en los karts, siempre).
  **Y** sube de número y **↓ + Y** baja (del 10 regresa al 1), cuando quieras y sin
  límite; la voz dice el número. Cada número tiene su color y su forma, y entre más grande es más fuerte y pesado pero
  más lento. Su especial cambia con el número: 1 embestida, 2 doble golpe, 3 malabares, 4 se vuelve cuadrado y
  aplasta, 5 estrella, 6 rueda como dado, 7 arcoíris, 8 ocho brazos, 9 golpazo y 10 despega como cohete.
  Su súper forma es **Octobloque** (el 8 superhéroe, con antifaz, capa y ocho brazos). Contar del 1 al 10 da
  la calcomanía "Hasta el 10".
- **Minigolf** (juego nuevo): por turnos, cada quien con su personaje de pelota. En tu turno el **stick** apunta,
  **mantén A** para la fuerza (sube y baja sola) y **suelta** para tirar; **LB / RB** afinan la puntería y **B**
  cancela. Una línea punteada enseña por dónde va a ir (se puede quitar). Recorrido **corto** (3 hoyos) o **completo**
  (9): ¡A calentar!, La curva, El molino (aspas que dan vueltas), Pinball (hongos que rebotan fuerte), Arena y agua
  (la arena frena; si cae al agua regresa de donde tiró y cuenta un tiro), La rampa (empuja la pelota), La pared que
  se mueve, Portales y La gran final. Cerca del hoyo la pelota se jala tantito para adentro; con 4 tiros de más del
  par se acaba tu hoyo. Después de cada hoyo, la tabla con los tiros de cada quien; calcomanías por hoyo en uno y por
  ganar los 9.
- **Modo Bebé**: cualquier botón hace algo bonito y no se gana ni se pierde. A B X Y sacan figuras con carita
  (círculo, estrella, cuadrado, flor, corazón y triángulo) con su nombre y su color ("Estrella roja"), y cada botón
  toca la nota que sigue de una **canción** (Estrellita, Martinillo, Witsi witsi araña, El viejo MacDonald, Cumpleaños
  feliz y una canción de cuna): machacando botones el bebé la toca, y al terminarla se festeja y sigue otra. Las
  flechas asoman un **animalito que hace su sonido** (perro, gato, vaca, cerdito, pollito, pato, rana, oveja, caballo,
  león, elefante y changuito, dibujados por Gemini y con sonidos hechos con osciladores), el stick mueve a su bolita
  amiga que revienta las **burbujas** que suben (también con el clic), y LB RB LT RT echan fuegos artificiales.
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

## La voz (el locutor)

Lo que dice el juego en voz alta (instrucciones, el narrador, los resultados) suena con una voz de **locutor de
lucha libre** grabada con Gemini (AI Studio, voz "Mako"): cada frase es un MP3 en `public/voz/` y
`src/shared/voz.json` es la lista de las que ya están grabadas. Si una frase todavía no tiene grabación (o antes del
primer clic), la lee la voz del navegador.

- Jugando en la compu (`npm run dev`) y con `npm test`, cada frase que se dice se anota sola en
  `tools/voz/oidas.txt`.
- `node tools/voz.mjs lista` junta todas las frases (las oídas, las que están escritas en el código y las que salen de
  listas: personajes, calcomanías, jugadores...) en `tools/voz/frases.json` y dice cuántas faltan.
- Las que faltan se graban en AI Studio de 10 en 10 (separadas por pausas largas, y se cortan por los silencios);
  `node tools/voz.mjs importar <carpeta>` les quita el silencio de las orillas, empareja el volumen, las pasa a MP3 y
  las agrega a la lista. La cuenta gratis de AI Studio deja grabar un rato al día.

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
`arte/duelo/fondos/dojo.jpg`. El fútbol usa `arte/futbol/fondos/<estadio|playa|nieve|luna|azotea>.jpg`,
`arte/futbol/poderes/<balon-gigante|porteria-chica|iman|hielo|tenis>.jpg` y `arte/futbol/copas/copa-futbol.jpg`.

Las animaciones usan además `parpadeo`, `feliz`, `enojado`, `asustado`, `caer`, `mareado`, `baile1` y `baile2`
(dos hojas de 2x2 por personaje). Si Gemini escribe el nombre de la pose o deja rayitas sueltas,
`node tools/keep-main.mjs <poses...>` deja solo al personaje. `npm run arte` también mide cada pose
(`tools/pose-metrics.mjs`): en el juego todas se ven del mismo tamaño (se iguala lo que pinta el personaje, no
el alto de la imagen) y paradas en el mismo lugar.

## Animaciones

Iguales en todos los juegos (`src/ui/motion.js`, `src/ui/epic.js`, `src/ui/ambient.js`, `src/ui/bounce.js`):

- **Personajes de caricatura**: se estiran al saltar, se aplastan al caer y se estiran de lado al pegar; parados
  respiran, parpadean y, si nadie los mueve, festejan o bailan; cayendo usan su pose de caída; corriendo se
  inclinan y echan polvito. Ponen caras (enojados al empezar la pelea, asustados si les pegan, mareados) y bailan
  al ganar.
- **Monstruos y jefes con vida** (`src/ui/creature.js`, en Súper Bolitas, Pelea en equipo y el Duelo): cambian de
  dibujo según lo que hacen —caminan alternando su paso, se agachan a cargar su ataque, atacan, les duele y se
  carcajean cuando te pegan— y se estiran y aplastan como gelatina (rebotan en cada paso y al caer). Los jefes además
  se ponen **furiosos** con poca vida (tiemblan de coraje), se **marean** y quedan **derrotados** (aplastados con ojos
  de X). Las poses son dibujos de Gemini `<monstruo>-<pose>` (paso, ataque, dolor, burla; los jefes también furioso,
  cargando, mareado y derrotado) en `arte/plat/enemigos`, `arte/plat/jefes`, `arte/brawl/monstruos` y
  `arte/duelo/jefe` (este además paso, burla, gana y bloqueo); se bajan cuando el monstruo aparece y, si falta una,
  se usa la que se parece.
- **Golpes que se sienten**: el juego se congela un instante al pegar (más en los golpes fuertes), con destello,
  rayitas de cómic y onda de choque.
- **Momentos épicos**: cámara lenta con acercamiento al vencer a un jefe, al llegar a la bandera, al meter gol y
  al cruzar la meta en los karts.
- **Festejos**: confeti que se mece y fuegos artificiales.
- **Pantallas**: cortinillas (bolitas, estrellas o un círculo) al cambiar de pantalla, el menú con tarjetas que
  rebotan y los personajes de los jugadores paseando, letreros que entran rebotando y fondos con vida (pájaros,
  nubes, nieve, burbujas, chispas, murciélagos, chispitas de dulce...).

## Jugar en el Xbox

El navegador solo deja leer controles en páginas **HTTPS** (o `localhost`), así que en el Xbox
se juega desde GitHub Pages:

1. Sube el repo a GitHub y en **Settings → Pages → Source** elige **GitHub Actions**.
2. Cada `git push` publica solo (ver `.github/workflows/deploy.yml`) en
   `https://<tu-usuario>.github.io/LeoGames/`.
3. En el Xbox: desactiva **"Apps can add a border"** (borde de overscan) para que no vaya lento.
4. Abre la dirección en **Edge**, mantén **≡ (Menú)** → **"Use game controls"** → **A**.
5. Si algo falla, en el menú **Cómo jugar** → **Y** abre la prueba de controles para ver qué detecta el navegador.

Para que el Xbox One S aguante (poca memoria y un procesador lento):
- Los **fondos** (dibujos de 1600 px que ya abiertos ocupan más de 5 MB cada uno) se bajan solo cuando se van a usar
  y se sueltan al regresar al menú (`src/shared/lazyArt.js`); mientras llega, se ve el fondo dibujado con figuras.
  Antes cada juego cargaba los de todos los juegos: después de jugar varios había ~380 MB de dibujos en memoria y
  ahora ~130 MB.
- En el Modo Bebé cada figura con su carita y su letrero (y cada burbuja) se dibuja una sola vez y se vuelve imagen
  (`src/games/baby/drawings.js`), en vez de calcular sus círculos y trazos en cada cuadro.
- Se midió con el procesador 4 veces más lento (como el del Xbox) contando cuadros por segundo de cada juego.

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
- `src/games/smash/`: Bolitas Bros (Phaser), con cámara que hace zoom y otra fija para el marcador; monedas
  (`coins.js`), rey de la colina (`hill.js`), tornado (`tornado.js`), concurso de jonrón (`jonron.js`), Aventura
  (`adventure.js`), repetición del K.O. (`replay.js`) y narrador (`talk.js`).
- `src/games/kart/`: Karts locos: además de lo de siempre, atajos (`shortcut.js`), clima (`weather.js`), contrarreloj y
  fantasma (`ghost.js`), repetición de la llegada (`replay.js`), pilotos con personalidad y narrador (`rivals.js`),
  batallas (`battle.js`), escuela de manejo (`school.js`), aventura con jefes (`adventure.js`), pistas vivas
  (`living.js`), paisajes de la Copa Tesoro (`scenery2.js`), el editor de pistas (`editor.js`) y el público y la tele
  (`crowd.js`).
- `src/games/futbol/`: Fútbol de bolitas (Phaser): cancha y uniformes (`field.js`), balón (`Ball.js`), jugadores
  (`FutbolPlayer.js`), la compu (`cpu.js`), canchas (`pitches.js`), poderes (`powers.js`), penales
  (`penalties.js`), público y narrador (`crowd.js`) y las pantallas de la Copa y del final (`screens.js`).
- `src/games/duelo/`: Duelo de bolitas (Phaser): peleador, golpes y especiales (`moves.js`), lo que se lanza
  (`shots.js`), escenarios y la compu; secretos (`secrets.js`), ayudante (`assist.js`), objetos (`items.js`), escuela
  (`school.js`), retos (`challenges.js`), torneo familiar (`family.js`), salón de la fama (`records.js`), repetición
  del K.O. (`replay.js`), narrador (`talk.js`) y los jefes (`boss.js`).
- `src/games/kart/` y `src/games/race/`: los dos juegos de carreras (Three.js).
- `src/games/three/`: piezas 3D compartidas (pista, modelo del kart, lienzo).
- `src/games/ThreeGameScene.js`: abre un juego 3D encima de Phaser y lo cierra al salir.
- `src/ui/`: estilos y el personaje (la bolita); `BlockBody.js` pone a Bloquecito (sus dibujos o, si faltan, sus
  bloques; sus números están en `src/games/smash/bloquecito.js`).
