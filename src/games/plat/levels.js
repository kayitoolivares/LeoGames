import { join, seg } from './level.js';
import { FORT1, FORT2, FORT3, FORT4, SECRET1, SECRET3, SECRET6, W51, W52, W53, W54, W61, W62, W63, W64, W71, W72, W73, W74 } from './levels2.js';
export { Level } from './level.js';

// Los niveles de Súper Bolitas (cómo se escriben: ver level.js). Mundos 1 a 4; los fuertes, los mundos 5 a 7, los
// niveles secretos y las arenas están en levels2.js.

// ---------- Mundo 1: Pradera y cuevas ----------

const W11 = {
  name: 'Pradera',
  theme: 'pradera',
  background: 'pradera',
  rows: join(
    seg(`
          o o o
      ?   BMB?B


 @          g
#########################
#########################`),
    seg(`
              O
         1
         []         []
   []    ()    g    ()  t
###()####()#####   #()#######
###()####()#####   #()#######`),
    seg(`
                    H
        bB?B
                       ooo
  o o              BBBBBBB
                      g   g
                                   X
#######    ##################    XX
#######    ##################   XXX`),
    seg(`
                            O
         C              ======
                ======
   q          g
                              t
######   ##########################
######   ##########################`),
    seg(`
            o o o
      ?B?M?B

                  []
   g     t      ()    g
############################
############################`),
    seg(`
              o o
           XXX    XXX
          XXXX    XXXX
   g     XXXXX    XXXXX     t
##############    ##############
##############    ##############`),
    seg(`
              o o
            ======
       ===          ===
   g                    t
#########         ##########
#########         ##########`),
    seg(`
                                   o
         ?S?                      XX
                           ooo   XXX
                      4         XXXX
         g   g        []       XXXXX
  O                   ()      XXXXXX
#########   ####### ##()##   #XXXXXXX     F
#########   ####### ##()##   #XXXXXXX#########
#########   ####### ##()##   #XXXXXXX#########`),
    // Cuarto secreto (se llega por el tubo de en medio del segundo pedazo).
    seg(`
XXXXXXXXXXXXXXXXXXXX
X                  X
X  o o o o o o o   X
X 2                X
X  o o o o o o o   X
X                  X
X  bbbbbbbbbbbbb   X
X                3 X
X                []X
X                ()X
XXXXXXXXXXXXXXXXXXXX
XXXXXXXXXXXXXXXXXXXX`),
  ),
};
// (El cuarto secreto empieza donde termina el nivel normal.)
W11.bonus = W11.rows[0].length - 20;

const W12 = {
  name: 'Cueva',
  theme: 'cueva',
  background: 'cueva',
  rows: join(
    seg(`
XXXXXXXXXXXXXXXXXXXXXXXX
XXXXXXXXXXXXXXXXXXXXXXXX

          ?M?
                    v

 @           g
########################
########################`),
    seg(`
XXXXXXXXXXXXXXXXXXXXXXXXXXXX
XXXXXXX         XXXXXXXXXXXX
          v               v
               O
         BBBBBBBBB    ===
   ooo                    e
           g    g   ===
######  #################   ####
######  #################   ####`),
    seg(`
XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
XXX                       XXXXXX
             H
           ?Y?          o o o
                    BBBBBBB
     t       C
                  X        g
###########   #####X########  ##
###########   #####X########  ##`),
    seg(`
XXXXXXXXXXXXXXXXXXXXXXXXXX
                     XXXXX
          v        v
      O
     BBBB     zzz      ooo
                      =====
   e      ^^       g
######   ####    ##########
######   ####    ##########`),
    seg(`
XXXXXXXXXXXXXXXXXXXXXXXXXXXX





          o o o o o
       B?BB?B

   g        t        g
############################
############################`),
    seg(`
XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX





              o o
           XXX    XXX
          XXXX    XXXX
   g     XXXXX    XXXXX     t
##############    ##############
##############    ##############`),
    seg(`
XXXXXXXXXXXXXXXXXXXXXXXXXXXX




            o o o
      ?B???B

                  []
   g     t      ()    g
############################
############################`),
    seg(`
XXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
XXXXX         XXXXXXXXXXXXXXXX
                   O
               ?B?
      ===              G
   g        g          []
############# ######   ()        F
############# #####    ()  ##########
############# #####    ()  ##########`),
  ),
};

const W13 = {
  name: 'El fuerte del Rey Hongo',
  theme: 'pradera',
  background: 'pradera',
  boss: 'reyHongo',
  rows: join(
    seg(`
          O
       ?M?B?

 @        g     g     t
##########################
##########################`),
    seg(`
                 o o o o
   o        BBBBBBBBBBBB
        X
 g     XX    g  O    g  g
####  XXX  ############## ##
####  XXX  ############## ##`),
    seg(`
              o o
            ======
       ===          ===
   g                    t
#########         ##########
#########         ##########`),
    seg(`
          o o o o o
       B?BB?B

   g        t        g
############################
############################`),
    seg(`
XXXXXXXXXXXXXXXXXXXXXXXXXXXX
X                          X
X                          X
X                          X
X           O              X
X          ===             X
X  ===             ===     X
X                          X
X                          X
X           K              X
XXXXXXXXXXXXXXXXXXXXXXXXXXXX
XXXXXXXXXXXXXXXXXXXXXXXXXXXX`),
  ),
};

// ---------- Mundo 2: Nubes y cielo ----------

const W21 = {
  name: 'Nubes',
  theme: 'cielo',
  background: 'cielo',
  rows: join(
    seg(`
          o o o
       ?M?

 @           q
#############   ====   ==
#############`),
    seg(`
                  O
              ===
    q    ===           ====
  ===                        q
        ooo      m
###   =====             ######
###                     ######`),
    seg(`
                     ooooo
            ?S?     =======
                              H
       C          q
     ======             u
##########   ===     ===   === ###
##########                     ###`),
    seg(`
                  O
    q           =====         q
           ===              ===
   ===                ===
         R                         o o
#######  ####   m      g      #########
#######  ####                 #########`),
    seg(`
                  q
          o o o
         #######     ######

   g
#######             ##########
#######             ##########`),
    seg(`
            o o o
      ?B???B

                  []
   g     q      ()    g
############################
############################`),
    seg(`
              o o
            ======
       ===          ===
   g                    q
#########         ##########
#########         ##########`),
    seg(`
                 ?Y?

          ==                      F
   O    =====  ======    ===   #######
 ====                          #######
###                       g    #######
###                            #######`),
  ),
};

const W22 = {
  name: 'Viento en el cielo',
  theme: 'cielo',
  background: 'cielo',
  wind: 45,
  rows: join(
    seg(`
         ooooo
        =======

 @            q
################   ===
################`),
    seg(`
          O           n
   q            ===         q
         ===         === M?
    ===                        ===
                  m
#####                   ####         ##
#####                   ####         ##`),
    seg(`
                       ooo
       C              =====
    ======     u              O
                          ===
 q       ===       z z z
#####           ===            #####
#####                          #####`),
    seg(`
              o o
            ======
       ===          ===
   g                    q
#########         ##########
#########         ##########`),
    seg(`
                  q
          o o o
         #######     ######

   g
#######             ##########
#######             ##########`),
    seg(`
              o o
           XXX    XXX
          XXXX    XXXX
   g     XXXXX    XXXXX     q
##############    ##############
##############    ##############`),
    seg(`
             n                         O
       ===         H      ===     ===
             ===        R
  ===                         ===
          ====     ====
####   g                  g       ####   F
####                              ##########
####                              ##########`),
  ),
};

const W23 = {
  name: 'El castillo del Rey Nube',
  theme: 'cielo',
  background: 'cielo',
  boss: 'reyNube',
  rows: join(
    seg(`
         o o o    O
       ?M?B?

 @         q        q
######################   ====
######################`),
    seg(`
             O
   ====          ====
         ===           ===
    q          q
=======    ====    ====   ====
=======`),
    seg(`
                  q
          o o o
         #######     ######

   g
#######             ##########
#######             ##########`),
    seg(`
          o o o o o
       B?BB?B

   g        q        g
############################
############################`),
    seg(`
XXXXXXXXXXXXXXXXXXXXXXXXXXXX
X                          X
X                          X
X                          X
X                          X
X     ===          ===     X
X            O             X
X         ======           X
X                          X
X                          X
X           K              X
XXXXXXXXXXXXXXXXXXXXXXXXXXXX
XXXXXXXXXXXXXXXXXXXXXXXXXXXX`),
  ),
};

// ---------- Mundo 3: Agua y playa ----------

const W31 = {
  name: 'Playa',
  theme: 'playa',
  background: 'playa',
  rows: join(
    seg(`
          o o o
       ?M?

 @          c
########################
########################`),
    seg(`
                 O
 ?Y?     ===
                 c    []
       c              ()
######wwwwwwwww########()######
######wwwwwwwww########()######`),
    seg(`
                         H
  BBBBBBB       ooo
               ===
    c C        c          c
#############wwwwwww############
#############wwwwwww############`),
    seg(`
            o o o
      ?B?M?B

                  []
   c     t      ()    c
############################
############################`),
    seg(`
              o o
            ======
       ===          ===
   c                    t
#########         ##########
#########         ##########`),
    seg(`
              o o
           XXX    XXX
          XXXX    XXXX
   c     XXXXX    XXXXX     t
##############    ##############
##############    ##############`),
    seg(`
            G   O
          =====      ===
    ===                    ?S?
              c                     O
             ===   c    []
######wwwwww######wwwww#()#   ####    F
######wwwwww######wwwww#()#   ##########
######wwwwww######wwwww#()#   ##########`),
  ),
};

const W32 = {
  name: 'Bajo el mar',
  theme: 'mar',
  background: 'mar',
  water: true,
  rows: join(
    seg(`
XXXXXXXXXXXXXXXXXXXXXXXX


        o o o
            f
 @      ===
                j
########################
########################`),
    seg(`
XXXXXXXXXXXXXXXXXXXXXXXXXXXX

         O        f
      XXXXX
              j        ?M?
  f   XXXXX
                  XXX
#########    ######XXX#######
#########    ######XXX#######`),
    seg(`
XXXXXXXXXXXXXXXXXXXXXXXXXXXX
           f
    C                 j
     ooooo     XXX          O
   =======     XXX       =====
          j           f
                  H
#############   ##############
#############   ##############`),
    seg(`
XXXXXXXXXXXXXXXXXXXXXXXXXXXX




            o o o
      ?B???B

                  []
   f     j      ()    f
############################
############################`),
    seg(`
XXXXXXXXXXXXXXXXXXXXXXXXXXXX





          o o o o o
       B?BB?B

   f        j        f
############################
############################`),
    seg(`
XXXXXXXXXXXXXXXXXXXXXXXXXXXX




            o o o
      ?B???B

                  []
   f     j      ()    f
############################
############################`),
    seg(`
XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
                f
       j                  ooo
  XXXXX       ?S?        XXXX
  XXXXX   O                     F
             f        j    ######
##########   #################
##########   #################`),
  ),
};

const W33 = {
  name: 'La cueva del Rey Cangrejo',
  theme: 'playa',
  background: 'playa',
  boss: 'reyCangrejo',
  rows: join(
    seg(`
          O
       ?M?B?

 @         c       c
#####################www####
#####################www####`),
    seg(`
                o o o
            =========
     c                 O
  ====          c
######wwww##########wwww####
######wwww##########wwww####`),
    seg(`
              o o
           XXX    XXX
          XXXX    XXXX
   c     XXXXX    XXXXX     t
##############    ##############
##############    ##############`),
    seg(`
          o o o o o
       B?BB?B

   c        t        c
############################
############################`),
    seg(`
XXXXXXXXXXXXXXXXXXXXXXXXXXXX
X                          X
X                          X
X                          X
X                          X
X                          X
X      ===        ===      X
X            O             X
X                          X
X           K              X
XXXXXXXXXXXXXXXXXXXXXXXXXXXX
XXXXXXXXXXXXXXXXXXXXXXXXXXXX`),
  ),
};

// ---------- Mundo 4: Castillo de lava ----------

const W41 = {
  name: 'Volcán',
  theme: 'castillo',
  background: 'castillo',
  rows: join(
    seg(`
         o o o
      ?M?

 @          g
########################
########################`),
    seg(`
                O
            ===
     e           x       e
#######LLLLLL#######LLLL######
#######LLLLLL#######LLLL######`),
    seg(`
         a                 H
               ?Y?
     C                ooo
              e      =====
######  zzzzzzz  #####   #####
######LLLLLLLLLLL#####LLL#####
######LLLLLLLLLLL#####LLL#####`),
    seg(`
              o o
            ======
       ===          ===
   e         x          g
#########LLLLLLLLL##########
#########LLLLLLLLL##########`),
    seg(`
              o o
           XXX    XXX
          XXXX    XXXX
   e     XXXXX    XXXXX     g
##############LLLL##############
##############LLLL##############`),
    seg(`
          o o o o o
       B?BB?B

   e        g        e
############################
############################`),
    seg(`
                    O
              a
     O      =====       a
          x                  ooo
    ===        e           =====     F
####LLLL#########LLLLL##   #  ##########
####LLLL#########LLLLL##LLLLLL##########`),
  ),
};

const W42 = {
  name: 'Castillo',
  theme: 'castillo',
  background: 'castillo',
  rows: join(
    seg(`
XXXXXXXXXXXXXXXXXXXXXXXXXX
                      a

         ?M?

 @         e
##########################
##########################`),
    seg(`
XXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
         a
                         O

                       =====
    ===       zzzzzzz        e
          x
######LLLLLL###LLLLLLL####LLLL##
######LLLLLL###LLLLLLL####LLLL##`),
    seg(`
XXXXXXXXXXXXXXXXXXXXXXXXXXXX
            a
      C           H
                     ?S?
     ooo    ===   O
    =====        e
  ^^^^^   ^^^^^           ^^
######################LLL#####
######################LLL#####`),
    seg(`
XXXXXXXXXXXXXXXXXXXXXXXXXXXX





          o o o o o
       B?BB?B

   e        g        e
############################
############################`),
    seg(`
XXXXXXXXXXXXXXXXXXXXXXXXXXXX





              o o
            ======
       ===          ===
   e         x          g
#########LLLLLLLLL##########
#########LLLLLLLLL##########`),
    seg(`
XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX





              o o
           XXX    XXX
          XXXX    XXXX
   e     XXXXX    XXXXX     g
##############LLLL##############
##############LLLL##############`),
    seg(`
XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
           a
               O

      u   zzzzzzzzzzzzz     ooo
   x        x            =====    F
####LLLLLLLLLLLLLLLLLLLLL###########
####LLLLLLLLLLLLLLLLLLLLL###########`),
  ),
};

const W43 = {
  name: 'El trono del Rey Dragón',
  theme: 'castillo',
  background: 'castillo',
  boss: 'reyDragon',
  rows: join(
    seg(`
XXXXXXXXXXXXXXXXXXXXXXXX

          O

       ?M?B?S


 @         e       x
######################LLLL##
######################LLLL##`),
    seg(`
XXXXXXXXXXXXXXXXXXXXXXXX
            a

     ooo          O
    =====      =====
  e         e
########LLLL###########
########LLLL###########`),
    seg(`
XXXXXXXXXXXXXXXXXXXXXXXXXXXX





              o o
            ======
       ===          ===
   e         x          g
#########LLLLLLLLL##########
#########LLLLLLLLL##########`),
    seg(`
XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX





              o o
           XXX    XXX
          XXXX    XXXX
   e     XXXXX    XXXXX     g
##############LLLL##############
##############LLLL##############`),
    seg(`
XXXXXXXXXXXXXXXXXXXXXXXXXXXX
X                          X
X                          X
X                          X
X                          X
X                          X
X     ===          ===     X
X            O             X
X                          X
X           K              X
XXXXXXXXXXXXXXXXXXXXXXXXXXXX
XXXXXXXXXXXXXXXXXXXXXXXXXXXX`),
  ),
};

// Los mundos: 4 niveles cada uno (el segundo es un fuerte con mini jefe y el cuarto tiene al jefe). `secret`: el
// nivel secreto que se abre con la bandera secreta (G) de alguno de sus niveles. `dino`: el color de los
// dinosaurios que salen de los huevos. `sticker`: la calcomanía al ganar el mundo.
export const WORLDS = [
  { name: 'Pradera y cuevas', emoji: '🌿', levels: [W11, FORT1, W12, W13], secret: SECRET1, sticker: 'plat-mundo-1', color: 0x4cd97b, dino: 'verde' },
  { name: 'Nubes y cielo', emoji: '☁️', levels: [W21, FORT2, W22, W23], sticker: 'plat-mundo-2', color: 0x8fd3ff, dino: 'azul' },
  { name: 'Agua y playa', emoji: '🌊', levels: [W31, FORT3, W32, W33], secret: SECRET3, sticker: 'plat-mundo-3', color: 0x3fa7ff, dino: 'verde' },
  { name: 'Castillo de lava', emoji: '🌋', levels: [W41, FORT4, W42, W43], sticker: 'plat-mundo-4', color: 0xff5a2f, dino: 'rojo' },
  { name: 'Montañas de nieve', emoji: '❄️', levels: [W51, W52, W53, W54], sticker: 'plat-mundo-5', color: 0xcfeaff, dino: 'azul' },
  { name: 'Dulcelandia', emoji: '🍭', levels: [W61, W62, W63, W64], secret: SECRET6, sticker: 'plat-mundo-6', color: 0xff9ec7, dino: 'amarillo' },
  { name: 'Casa embrujada', emoji: '👻', levels: [W71, W72, W73, W74], sticker: 'plat-mundo-7', color: 0x8a6fb8, dino: 'rojo' },
];

// La lista de los niveles del camino, en orden (para el mapa): { world, index, spec, id: "1-1" }.
export const LEVELS = WORLDS.flatMap((world, w) => world.levels.map((spec, i) => ({ world: w, index: i, spec, id: `${w + 1}-${i + 1}` })));
// Los niveles secretos: { world, spec, id: "1-★", secret: true }.
export const SECRETS = WORLDS.flatMap((world, w) => (world.secret ? [{ world: w, index: 'secret', spec: world.secret, id: `${w + 1}-★`, secret: true }] : []));
