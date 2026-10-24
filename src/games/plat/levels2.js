import { join, seg } from './level.js';

// Más niveles de Súper Bolitas (cómo se escriben: ver level.js): los fuertes con mini jefe (uno por mundo), los
// mundos 5 a 7 (nieve, dulces y casa embrujada), los niveles secretos (se abren con la bandera secreta G) y las
// arenas de la batalla de monedas y de los enemigos del mapa.

// La arena de un jefe o mini jefe: 28 de ancho, entre paredes (la puerta de la izquierda se abre sola).
const ARENA = seg(`
XXXXXXXXXXXXXXXXXXXXXXXXXXXX
X                          X
X                          X
X                          X
X           O              X
X                          X
X     ===          ===     X
X                          X
X                          X
X           K              X
XXXXXXXXXXXXXXXXXXXXXXXXXXXX
XXXXXXXXXXXXXXXXXXXXXXXXXXXX`);

// ---------- Fuertes ----------

export const FORT1 = {
  name: 'Fuerte de la Gran Tortuga',
  theme: 'castillo',
  background: 'castillo',
  boss: 'granTortuga',
  rows: join(
    seg(`
XXXXXXXXXXXXXXXXXXXXXXXXXXXX




                o O o
         ?M?



 @         g            P
############################
############################`),
    seg(`
XXXXXXXXXXXXXXXXXXXXXXXXXX
    BBB
    BBB
    BBB       o o o
    BBB      BBBBBBB
    BBB
    BBB
    BBB             Z
    BBB    g        X
    BBB             X   t
##########################
##########################`),
    seg(`
XXXXXXXXXXXXXXXXXXXXXXXX


           O
         =====

    ?Y?


             e
######    ##############
######    ##############`),
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
    ARENA,
  ),
};

export const FORT2 = {
  name: 'Fuerte del Gran Pájaro',
  theme: 'cielo',
  background: 'cielo',
  boss: 'granPajaro',
  rows: join(
    seg(`
XXXXXXXXXXXXXXXXXXXXXXXXXX


          !
            o o o

                  O
         ?M?


 @          q
##########################
##########################`),
    seg(`
XXXXXXXXXXXXXXXXXXXXXXXXXXXX


        y
                    o o
       rrrr        iiii

            O
         iiiiiiii
               q
######   rrrrrrrr   ########
######              ########`),
    seg(`
XXXXXXXXXXXXXXXXXXXXXXXX



        ?S?


    Z
    X    g
    X             C
########################
########################`),
    seg(`
XXXXXXXXXXXXXXXXXXXXXXXXXXXX





              o o
            ======
       ===          ===
   g                    q
#########         ##########
#########         ##########`),
    seg(`
XXXXXXXXXXXXXXXXXXXXXXXXXXXX





          o o o o o
       B?BB?B

   g        q        g
############################
############################`),
    ARENA,
  ),
};

export const FORT3 = {
  name: 'Fuerte del Capitán Pulpo',
  theme: 'playa',
  background: 'playa',
  boss: 'pulpo',
  rows: join(
    seg(`
XXXXXXXXXXXXXXXXXXXXXXXXXX



         O
        ?M?



 @         c         Z
                     X
##########################
##########################`),
    seg(`
XXXXXXXXXXXXXXXXXXXXXXXXXX


      o o o o o

        O

               Z
   c           X     c
         ===   X
#######wwwwwww############
#######wwwwwww############`),
    seg(`
XXXXXXXXXXXXXXXXXXXXXXXX



       ?Y?


   P       B
          BBB
  c      BBBBB   C
########################
########################`),
    seg(`
XXXXXXXXXXXXXXXXXXXXXXXXXXXX





          o o o o o
       B?BB?B

   c        t        c
############################
############################`),
    seg(`
XXXXXXXXXXXXXXXXXXXXXXXXXXXX





              o o
            ======
       ===          ===
   c                    t
#########         ##########
#########         ##########`),
    ARENA,
  ),
};

export const FORT4 = {
  name: 'Fuerte de la Gran Bola de Fuego',
  theme: 'castillo',
  background: 'castillo',
  boss: 'granBola',
  rows: join(
    seg(`
XXXXXXXXXXXXXXXXXXXXXXXXXX
                a


         ?M?        O



 @         e
##########################
##########################`),
    seg(`
XXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
          a


  !
                  O
       rrrr      iiii
  x                x

######LLLLLL####LLLLLL########
######LLLLLLLLLLLLLLLL########`),
    seg(`
XXXXXXXXXXXXXXXXXXXXXXXX
      a


        ?S?

    ^^      Z
            X       C
   e        X
########################
########################`),
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





              o o
            ======
       ===          ===
   e         x          g
#########LLLLLLLLL##########
#########LLLLLLLLL##########`),
    ARENA,
  ),
};

// ---------- Mundo 5: Nieve (el piso resbala) ----------

export const W51 = {
  name: 'Montaña nevada',
  theme: 'nieve',
  background: 'nieve',
  ice: true,
  dino: 'azul',
  rows: join(
    seg(`
          o o o
       ?M?

 @          p
########################
########################`),
    seg(`
                O
            =====
     l               l
                          N
   ?Y?        p
##########   ##################
##########   ##################`),
    seg(`
                    H
         C       ooo
     BBBBBB                l
    p
                       N
###########   ######    ########
###########   ######    ########`),
    seg(`
            o o o
      ?B?M?B

                  []
   p     N      ()    p
############################
############################`),
    seg(`
              o o
           XXX    XXX
          XXXX    XXXX
   p     XXXXX    XXXXX     N
##############    ##############
##############    ##############`),
    seg(`
              o o
            ======
       ===          ===
   p                    N
#########         ##########
#########         ##########`),
    seg(`
             O
         ======          ooo
               p       ======
     l                             O
    ?$?             N
#########   ##########   ###########    F
#########   ##########   ######################
#########   ##########   ######################`),
  ),
};

export const W52 = {
  name: 'Fuerte del Gran Pingüino',
  theme: 'nieve',
  background: 'nieve',
  ice: true,
  boss: 'granPinguino',
  rows: join(
    seg(`
XXXXXXXXXXXXXXXXXXXXXXXXXX
          l         l


         ?M?        O



 @          p
##########################
##########################`),
    seg(`
XXXXXXXXXXXXXXXXXXXXXXXX
     l            l
               O
     o o o   =====
    =====
                Z
       N        X
   p            X     C
########     ###########
########     ###########`),
    seg(`
XXXXXXXXXXXXXXXXXXXXXXXXXXXX





          o o o o o
       B?BB?B

   p        N        p
############################
############################`),
    seg(`
XXXXXXXXXXXXXXXXXXXXXXXXXXXX





              o o
            ======
       ===          ===
   p                    N
#########         ##########
#########         ##########`),
    ARENA,
  ),
};

export const W53 = {
  name: 'Cueva de hielo',
  theme: 'nieve',
  background: 'nieve',
  ice: true,
  power: 'flor-hielo',
  rows: join(
    seg(`
XXXXXXXXXXXXXXXXXXXXXXXXXX
XXXXXXXXXXXXXXXXXXXXXXXXXX
     l          l

         ?M?

 @          p
##########################
##########################`),
    seg(`
XXXXXXXXXXXXXXXXXXXXXXXXXXXX
XXXXXXX           XXXXXXXXXX
         l              l
              O
         BBBBBBB    ===

    p     N          p
######  ##########   ########
######  ##########   ########`),
    seg(`
XXXXXXXXXXXXXXXXXXXXXXXXXXXX
XXXX                 XXXXXXX
          H
        ?M?       ooo
             l   =====
     C
   p          N        O
#########   ######   ######
#########   ######   ######`),
    seg(`
XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX





              o o
           XXX    XXX
          XXXX    XXXX
   p     XXXXX    XXXXX     N
##############    ##############
##############    ##############`),
    seg(`
XXXXXXXXXXXXXXXXXXXXXXXXXXXX





          o o o o o
       B?BB?B

   p        N        p
############################
############################`),
    seg(`
XXXXXXXXXXXXXXXXXXXXXXXXXXXX





              o o
            ======
       ===          ===
   p                    N
#########         ##########
#########         ##########`),
    seg(`
XXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
XXXXXXXX        XXXXXXXXXXXXXX
                 l
       O
     =====      ?S?
                          ooo
   N       p            F
######   ####   #################
######   ####   #################`),
  ),
};

export const W54 = {
  name: 'El palacio del Rey Yeti',
  theme: 'nieve',
  background: 'nieve',
  ice: true,
  boss: 'reyYeti',
  rows: join(
    seg(`
          O
       ?M?B?

 @         p       N
######################   ####
######################   ####`),
    seg(`
                o o o
     l      =========
  ====               O
        p
######     ######################
######     ######################`),
    seg(`
              o o
            ======
       ===          ===
   p                    N
#########         ##########
#########         ##########`),
    seg(`
          o o o o o
       B?BB?B

   p        N        p
############################
############################`),
    ARENA,
  ),
};

// ---------- Mundo 6: Dulces (chicle que pega y ríos de chocolate) ----------

export const W61 = {
  name: 'Dulcelandia',
  theme: 'dulces',
  background: 'dulces',
  dino: 'amarillo',
  rows: join(
    seg(`
          o o o
       ?M?

 @          J
########################
########################`),
    seg(`
                 O
   ?Y?     ====
                Q
                       A
######ssssss######LLLLL#####
######ssssss######LLLLL#####`),
    seg(`
                         H
     C          ooo
            BBBBBBB

    J              W
#######LLLL##################
#######LLLL##################`),
    seg(`
            o o o
        ?B?B?


   J       A
######sssssssssss###########
######sssssssssss###########`),
    seg(`
              o o
            ======
       ===          ===
   J                    A
#########LLLLLLLLL##########
#########LLLLLLLLL##########`),
    seg(`
            o o o
      ?B?M?B

                  []
   J     A      ()    J
############################
############################`),
    seg(`
                O
          =====      ===
    ===                    ?%?
              Q                     O
                  A
######ssss######LLLLLL######   ####    F
######ssss######LLLLLL######   ##########
######ssss######LLLLLL######   ##########`),
  ),
};

export const W62 = {
  name: 'Fuerte de la Gran Galleta',
  theme: 'dulces',
  background: 'dulces',
  boss: 'granGalleta',
  rows: join(
    seg(`
XXXXXXXXXXXXXXXXXXXXXXXXXX



         ?M?        O



 @          J          P
##########################
##########################`),
    seg(`
XXXXXXXXXXXXXXXXXXXXXXXXXX
    BBB
    BBB      O
    BBB    =====
    BBB
    BBB             Z
    BBB    A        X
    BBB             X
    BBB   W         X  C
#####sssssss##############
#####sssssss##############`),
    seg(`
XXXXXXXXXXXXXXXXXXXXXXXXXXXX





          o o o o o
       B?BB?B

   J        A        J
############################
############################`),
    seg(`
XXXXXXXXXXXXXXXXXXXXXXXXXXXX




            o o o
        ?B?B?


   J       A
######sssssssssss###########
######sssssssssss###########`),
    ARENA,
  ),
};

export const W63 = {
  name: 'Fábrica de chicle',
  theme: 'dulces',
  background: 'dulces',
  power: 'pluma',
  rows: join(
    seg(`
          o o o
       ?M?

 @          W
########################
########################`),
    seg(`
                   O
              y
        m           y      y
   Q              Q
#####LLLLLLLLLLLLLLLLLLLLLLLL#####
#####LLLLLLLLLLLLLLLLLLLLLLLL#####`),
    seg(`
                                G
                              =====
                       =====
                ====
    H    ====         O

     C        J
###########sssss########       ##
###########sssss########       ##`),
    seg(`
              o o
            ======
       ===          ===
   J                    W
#########LLLLLLLLL##########
#########LLLLLLLLL##########`),
    seg(`
            o o o
        ?B?B?


   J       W
######sssssssssss###########
######sssssssssss###########`),
    seg(`
              o o
           XXX    XXX
          XXXX    XXXX
   J     XXXXX    XXXXX     W
##############LLLL##############
##############LLLL##############`),
    seg(`
            ?S?
                      O
      A            ====
  ====     W                    F
#########LLLL#############   ########
#########LLLL#############   ########`),
  ),
};

export const W64 = {
  name: 'El pastel del Rey Pastel',
  theme: 'dulces',
  background: 'dulces',
  boss: 'reyPastel',
  rows: join(
    seg(`
          O
       ?M?B?

 @         J       A
#####################LLL####
#####################LLL####`),
    seg(`
                o o o
            =========
  ====               O
        W
######ss###########sss###########
######ss###########sss###########`),
    seg(`
              o o
           XXX    XXX
          XXXX    XXXX
   J     XXXXX    XXXXX     A
##############LLLL##############
##############LLLL##############`),
    seg(`
            o o o
        ?B?B?


   J       A
######sssssssssss###########
######sssssssssss###########`),
    ARENA,
  ),
};

// ---------- Mundo 7: Casa embrujada (puertas y fantasmas) ----------

export const W71 = {
  name: 'Casa embrujada',
  theme: 'embrujada',
  background: 'embrujada',
  dino: 'rojo',
  rows: join(
    seg(`
XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX

          h

        ?M?

 @          E
################################
################################`),
    seg(`
XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
                X
     O          X        h
                X
    ?Y?         X
                X
  d   V         X    E      d    C
#####################################
#####################################`),
    seg(`
XXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
XXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
                 h
     H       O
            ===        ooo
        V            =====

    E           d          d
##############################
##############################`),
    seg(`
XXXXXXXXXXXXXXXXXXXXXXXXXXXX





          o o o o o
       B?BB?B

   E        V        E
############################
############################`),
    seg(`
XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX





              o o
           XXX    XXX
          XXXX    XXXX
   E     XXXXX    XXXXX     V
##############    ##############
##############    ##############`),
    seg(`
XXXXXXXXXXXXXXXXXXXXXXXXXXXX





              o o
            ======
       ===          ===
   E                    V
#########         ##########
#########         ##########`),
    seg(`
XXXXXXXXXXXXXXXXXXXXXXXXXXXXX
XXXXXXXXXXXXXXXXXXXXXXXXXXXXX
         h
     ?S?            O

             V

  E               F
###########################
###########################`),
  ),
};

export const W72 = {
  name: 'Fuerte del Gran Fantasma',
  theme: 'embrujada',
  background: 'embrujada',
  boss: 'granFantasma',
  rows: join(
    seg(`
XXXXXXXXXXXXXXXXXXXXXXXXXX
           h


         ?M?        O



 @          E
##########################
##########################`),
    seg(`
XXXXXXXXXXXXXXXXXXXXXXXXXXXX
                     h

  !
           O
     rrrr     rrrr
         iiiii     V
    E                 C
######LLLLLLLLLLLLLL########
######LLLLLLLLLLLLLL########`),
    seg(`
XXXXXXXXXXXXXXXXXXXXXXXXXXXX





              o o
            ======
       ===          ===
   E                    V
#########         ##########
#########         ##########`),
    seg(`
XXXXXXXXXXXXXXXXXXXXXXXXXXXX





          o o o o o
       B?BB?B

   E        V        E
############################
############################`),
    ARENA,
  ),
};

export const W73 = {
  name: 'Ático de los fantasmas',
  theme: 'embrujada',
  background: 'embrujada',
  power: 'flor-hielo',
  rows: join(
    seg(`
XXXXXXXXXXXXXXXXXXXXXXXXXX
XXXXXXXXXXXXXXXXXXXXXXXXXX
            h
         ?M?

     V

 @          E          d
##########################
##########################`),
    seg(`
XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
       h              h
          O                  O
     =====      ?$?        ===

               E
  d   E                 C
###############################
###############################`),
    seg(`
XXXXXXXXXXXXXXXXXXXXXXXXXXXX




            o o o
      ?B???B

                  []
   E     V      ()    E
############################
############################`),
    seg(`
XXXXXXXXXXXXXXXXXXXXXXXXXXXX





              o o
            ======
       ===          ===
   E                    V
#########         ##########
#########         ##########`),
    seg(`
XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX





              o o
           XXX    XXX
          XXXX    XXXX
   E     XXXXX    XXXXX     V
##############    ##############
##############    ##############`),
    seg(`
XXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
XXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
                  h
     ooo     O
    =====        =====    ===

         V
   E                  E        F
###########   ###################
###########   ###################`),
  ),
};

export const W74 = {
  name: 'La torre del Rey Calabaza',
  theme: 'embrujada',
  background: 'embrujada',
  boss: 'reyCalabaza',
  rows: join(
    seg(`
XXXXXXXXXXXXXXXXXXXXXXXX

          O

       ?M?B?S


 @         E       h
######################LLLL##
######################LLLL##`),
    seg(`
XXXXXXXXXXXXXXXXXXXXXXXX
            h

     ooo          O
    =====      =====

  E         V
########LLLL###########
########LLLL###########`),
    seg(`
XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX





              o o
           XXX    XXX
          XXXX    XXXX
   E     XXXXX    XXXXX     V
##############    ##############
##############    ##############`),
    seg(`
XXXXXXXXXXXXXXXXXXXXXXXXXXXX





          o o o o o
       B?BB?B

   E        V        E
############################
############################`),
    ARENA,
  ),
};

// ---------- Niveles secretos ----------

export const SECRET1 = {
  name: 'Cielo de monedas',
  theme: 'cielo',
  background: 'cielo',
  secret: true,
  rows: join(
    seg(`
          o o o o o
       o o o o o o o
 @
############  ====  ====
############`),
    seg(`
       o o o       O         o o o
      =======    =====      =======
  o o                  ooo
 =====       R        =====     m
                 ===
###       ######                     ###
###                                  ###`),
    seg(`
         O         ooooo
       =====     =======     O     o o o
  ===                       ===
              y                      F
####                               ######
####                               ######`),
  ),
};

export const SECRET3 = {
  name: 'Arrecife escondido',
  theme: 'mar',
  background: 'mar',
  water: true,
  secret: true,
  rows: join(
    seg(`
XXXXXXXXXXXXXXXXXXXXXXXXXXXX

     o o o o o o o
                    O
 @       f
       o o o o o o o
########################
########################`),
    seg(`
XXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
  o o o o           O
          j    o o o o o
   XXXX                XXXX
       o o o o
                 f       o o o
##############################
##############################`),
    seg(`
XXXXXXXXXXXXXXXXXXXXXXXX
     o o o o o
                O
  j     o o o o o
                    F
   o o o o
########################
########################`),
  ),
};

export const SECRET6 = {
  name: 'Fábrica secreta de dulces',
  theme: 'dulces',
  background: 'dulces',
  secret: true,
  rows: join(
    seg(`
        o o o o o
       ?%?$?M?

 @
##########################
##########################`),
    seg(`
       o o o o o o       O
      =============    =====
  ooo                          ooo
 =====      R     Q          =====
#######   ######LLLLLL######   #####
#######   ######LLLLLL######   #####`),
    seg(`
       O         o o o o o
     =====      =========      O
                              ===
   W          A                       F
##########LLLL###############   ##########
##########LLLL###############   ##########`),
  ),
};

// ---------- Arenas ----------

// Batalla de monedas: una pantalla cerrada con plataformas.
export const BATTLE1 = {
  name: 'Arena de la pradera',
  theme: 'pradera',
  background: 'pradera',
  rows: seg(`
XXXXXXXXXXXXXXXXXXXXXXXXXXX
X                         X
X                         X
X     ====       ====     X
X                         X
X          =====          X
X  ===               ===  X
X                         X
X       ====   ====       X
X                         X
X @                       X
###########################
###########################`),
};

export const BATTLE2 = {
  name: 'Arena de las nubes',
  theme: 'cielo',
  background: 'cielo',
  rows: seg(`
XXXXXXXXXXXXXXXXXXXXXXXXXXX
X                         X
X                         X
X  ===     =====     ===  X
X                         X
X         R      R        X
X   =====         =====   X
X                         X
X  ===    =======    ===  X
X                         X
X @                       X
#######   #########   #####
###########################`),
};

// Pelea contra los enemigos del mapa: una pantalla cerrada (los enemigos los pone la escena).
export const MAP_FIGHT = {
  name: '¡Batalla!',
  theme: 'pradera',
  background: 'pradera',
  rows: seg(`
XXXXXXXXXXXXXXXXXXXXXXXXXXX
X                         X
X                         X
X                         X
X                         X
X     ====       ====     X
X                         X
X                         X
X          =====          X
X                         X
X @                       X
###########################
###########################`),
};
