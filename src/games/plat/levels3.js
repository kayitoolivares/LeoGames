import { join, seg } from './level.js';

// La Isla de los jefes (el mundo 9: se abre al vencer al Rey Hongo y cada nivel termina con un jefe nuevo) y las
// pistas de las Carreritas. Cómo se escriben: ver level.js.

// ---------- Isla de los jefes ----------

export const W91 = {
  name: 'La colmena de la Abeja Reina',
  theme: 'pradera',
  background: 'pradera',
  boss: 'abejaReina',
  rows: join(
    seg(`
          O
       ?M?B?

 @        g     g
##########################
##########################`),
    seg(`
                o o o
   o o      BBBBBB
         q
 g                       g
######   ###########   ####
######   ###########   ####`),
    seg(`
               O
             =====
       ===           ===
                 t
#######   ###############
#######   ###############`),
    seg(`
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
XXXXXXXXXXXXXXXXXXXXXXXXXXXX`),
  ),
};

export const W92 = {
  name: 'El arrecife del Pez Globo',
  theme: 'mar',
  background: 'mar',
  water: true,
  boss: 'pezGlobo',
  rows: join(
    seg(`
XXXXXXXXXXXXXXXXXXXXXXXX


        o o o      O
            f

        ===
                j

 @
########################
########################`),
    seg(`
XXXXXXXXXXXXXXXXXXXXXXXXXX

        ooooo
      XXXXX         O
              j
  f   XXXXX
                  XXX
                  XXX
   f              XXX     f
#########    #####XXX#####
#########    #####XXX#####`),
    seg(`
XXXXXXXXXXXXXXXXXXXXXXXXXXXX
X                          X
X                          X
X           O              X
X                          X
X                          X
X                          X
X                          X
X                          X
X           K              X
XXXXXXXXXXXXXXXXXXXXXXXXXXXX
XXXXXXXXXXXXXXXXXXXXXXXXXXXX`),
  ),
};

export const W93 = {
  name: 'La fábrica de gelatina',
  theme: 'dulces',
  background: 'dulces',
  boss: 'granGelatina',
  rows: join(
    seg(`
           O
        ?M?B?

 @        J      W
###########################
###########################`),
    seg(`
               o o o
    o o     sssssss
                       A
 J                         J
#######   ##########   ######
#######   ##########   ######`),
    seg(`
              O
          =========
     ==               ==
          W       W
#####################   ######
#####################   ######`),
    seg(`
XXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
X                            X
X                            X
X                            X
X            O               X
X                            X
X    ===              ===    X
X                            X
X                            X
X            K               X
XXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
XXXXXXXXXXXXXXXXXXXXXXXXXXXXXX`),
  ),
};

// ---------- Carreritas ----------
// Pistas cortas y anchas para correr de 2 a 4 a la vez: hoyos chiquitos, escalones bajitos, resortes y pocos
// enemigos (los de la compu también tienen que poder pasarlas). Sin monedas grandes.

export const RACE_TRACKS = [
  {
    name: 'Carrera en la pradera',
    theme: 'pradera',
    background: 'pradera',
    rows: join(
      seg(`
           o o o
        ?M?

 @                  g
##############################
##############################`),
      seg(`
                  o o o
            ====          ====
      XX
     XXX          R            g
#########   #########    #########
#########   #########    #########`),
      seg(`
             o o o o
           BBBBBBBBB

   t                    F
############################
############################`),
    ),
  },
  {
    name: 'Carrera en la nieve',
    theme: 'nieve',
    background: 'nieve',
    ice: true,
    rows: join(
      seg(`
            o o o
         ?M?

 @                 p
############################
############################`),
      seg(`
                 o o o
       XX      =======
       XX
  N    XX                 p
##########    ####################
##########    ####################`),
      seg(`
                o o o
            ?S?

   p                    F
############################
############################`),
    ),
  },
  {
    name: 'Carrera de dulces',
    theme: 'dulces',
    background: 'dulces',
    rows: join(
      seg(`
           o o o
        ?M?

 @                 J
##########################
##########################`),
      seg(`
               o o o
           ===========
                           Q
    R          W
#######ssssss######    #########
#######ssssss######    #########`),
      seg(`
             o o o o
          BB?BB?BB

    J      A           F
###########################
###########################`),
    ),
  },
  {
    name: 'Carrera espacial',
    theme: 'espacio',
    background: 'espacio',
    gravity: 0.6,
    rows: join(
      seg(`
            o o o
         ?M?

 @                 w
##########################
##########################`),
      seg(`
                     o o o
             ====
      XXX                    T
      XXX       w
######XXX#    #####      ##########
######XXX#    #####      ##########`),
      seg(`
              o o o
           ?S?   ?M?

   I                    F
############################
############################`),
    ),
  },
];
