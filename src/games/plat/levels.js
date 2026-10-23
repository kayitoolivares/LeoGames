import { BLOCKS, ROWS, T } from './tiles.js';

// Los niveles de Súper Bolitas: 4 mundos de 3 niveles (el tercero, con su jefe). Cada nivel se escribe por pedazos
// (seg) de texto, de abajo hacia arriba (lo que falta arriba es aire); las letras de los cuadritos están en tiles.js
// y estas son las cosas que se ponen encima:
//   @ salida   F bandera (meta)   C banderín (si pierden, regresan aquí)   o moneda   O moneda grande (3 por nivel)
//   R resorte  D dinosaurio       K el jefe (su arena empieza 4 cuadritos antes)   w agua
//   Enemigos: g hongo malo  t tortuga  v murciélago  q pájaro  n nube mala  f pez  j medusa  e erizo
//             x bola de fuego (sale de la lava)  a aplastador  k planta (arriba de un tubo)  c cangrejo
//   Plataformas: m se mueve de lado   u sube y baja   z se cae cuando la pisas
// Tubos secretos: un 1 justo arriba de la boca de un tubo = entrar ahí (abajo en el stick) te lleva a donde está el
// 2; el 3 te lleva al 4. Lo que está desde la columna `bonus` es un cuarto secreto aparte.
const ENTITIES = new Set('@FCoORDKgtvqnfjexakcmuz1234');

function seg(text) {
  const lines = text.replace(/^\n/, '').split('\n');
  while (lines.length < ROWS) lines.unshift('');
  const width = Math.max(...lines.map((l) => l.length));
  return lines.slice(-ROWS).map((l) => l.padEnd(width, ' '));
}

function join(...segments) {
  return Array.from({ length: ROWS }, (_, r) => segments.map((s) => s[r]).join(''));
}

// Un nivel ya leído: los cuadritos (grid) y las cosas (entities).
export class Level {
  constructor(spec) {
    Object.assign(this, spec);
    this.cols = spec.rows[0].length;
    this.grid = spec.rows.map((row) => row.split(''));
    this.entities = [];
    this.grid.forEach((row, r) =>
      row.forEach((ch, c) => {
        if (!ENTITIES.has(ch)) return;
        this.entities.push({ ch, col: c, row: r, x: c * T + T / 2, y: (r + 1) * T });
        row[c] = ' ';
      }),
    );
    this.width = this.cols * T;
    this.height = ROWS * T;
    this.start = this.entities.find((e) => e.ch === '@') ?? { x: 2 * T, y: 12 * T };
    // La arena del jefe: entre las paredes a los lados de la K. Su pared izquierda tiene una puerta (3 cuadritos
    // abajo) que se cierra cuando empieza la pelea.
    const k = this.entities.find((e) => e.ch === 'K');
    this.arena = null;
    if (k) {
      let left = k.col;
      while (left > 0 && this.at(left, k.row) !== 'X') left -= 1;
      let right = k.col;
      while (right < this.cols - 1 && this.at(right, k.row) !== 'X') right += 1;
      const door = [k.row - 2, k.row - 1, k.row];
      for (const row of door) this.set(left, row, ' ');
      this.arena = { left, right, door, boss: k };
    }
    const mark = (ch) => this.entities.find((e) => e.ch === ch);
    this.warps = [['1', '2'], ['3', '4']]
      .filter(([a, b]) => mark(a) && mark(b))
      .map(([a, b]) => ({ enter: { col: mark(a).col, row: mark(a).row + 1 }, exit: mark(b) }));
  }

  at(col, row) {
    if (col < 0 || col >= this.cols) return 'X';
    if (row < 0) return ' ';
    if (row >= ROWS) return ' ';
    return this.grid[row][col];
  }

  set(col, row, ch) {
    if (col < 0 || col >= this.cols || row < 0 || row >= ROWS) return;
    this.grid[row][col] = ch;
  }

  isBlock(col, row) {
    return BLOCKS.has(this.at(col, row));
  }

  // ¿Esa columna es del cuarto secreto?
  inBonus(x) {
    return this.bonus !== undefined && x >= this.bonus * T;
  }
}

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
XXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
XXXXX         XXXXXXXXXXXXXXXX
                   O

      ===      ?B?B?
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
                    ?Y?
          ==                      F
   O    =====   ====     ===   #######
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
         ===         ===
    ===               ?M?      ===
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
           ===
   ?Y?           c    []
       c              ()
######wwwwwwwww########()######
######wwwwwwwww########()######`),
    seg(`
                         H
     C          ooo
            BBBBBBBBB
    c          c          c
#############wwwwwww############
#############wwwwwww############`),
    seg(`
                O
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
     ooo    ===
    =====        e
  ^^^^^   ^^^^^           ^^
######################LLL#####
######################LLL#####`),
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

// Los mundos, con sus niveles (el último de cada uno tiene jefe). `sticker`: la calcomanía al ganar el mundo.
export const WORLDS = [
  { name: 'Pradera y cuevas', emoji: '🌿', levels: [W11, W12, W13], sticker: 'plat-mundo-1', color: 0x4cd97b },
  { name: 'Nubes y cielo', emoji: '☁️', levels: [W21, W22, W23], sticker: 'plat-mundo-2', color: 0x8fd3ff },
  { name: 'Agua y playa', emoji: '🌊', levels: [W31, W32, W33], sticker: 'plat-mundo-3', color: 0x3fa7ff },
  { name: 'Castillo de lava', emoji: '🌋', levels: [W41, W42, W43], sticker: 'plat-mundo-4', color: 0xff5a2f },
];

// La lista de todos los niveles en orden (para el mapa): { world, index, spec, id: "1-1" }.
export const LEVELS = WORLDS.flatMap((world, w) => world.levels.map((spec, i) => ({ world: w, index: i, spec, id: `${w + 1}-${i + 1}` })));
