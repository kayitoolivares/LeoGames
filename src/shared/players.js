// Quién está jugando: cada jugador tiene un lugar (1 a 4), un control y un color.
// Igual que controls.js, no depende de Phaser para poder compartirlo con Three.js.

export const MAX_PLAYERS = 4;

export const PLAYER_COLORS = [
  { name: 'Rojo', hex: 0xff5a5f },
  { name: 'Azul', hex: 0x3fa7ff },
  { name: 'Verde', hex: 0x4cd97b },
  { name: 'Amarillo', hex: 0xffc93c },
  { name: 'Morado', hex: 0xb07cff },
  { name: 'Naranja', hex: 0xff9a3c },
  { name: 'Rosa', hex: 0xff7ad9 },
  { name: 'Turquesa', hex: 0x3fe0d0 },
];

class Players {
  constructor() {
    this.list = [];
  }

  bySlot(slot) {
    return this.list.find((player) => player.slot === slot);
  }

  byDevice(deviceId) {
    return this.list.find((player) => player.deviceId === deviceId);
  }

  // El "jefe" es el jugador con el número más bajo: él empieza la partida y escoge en el menú.
  host() {
    return this.sorted()[0];
  }

  sorted() {
    return [...this.list].sort((a, b) => a.slot - b.slot);
  }

  join(deviceId) {
    if (this.list.length >= MAX_PLAYERS || this.byDevice(deviceId)) return null;
    let slot = 0;
    while (this.bySlot(slot)) slot += 1;
    const player = { slot, deviceId, colorIndex: this.nextFreeColor(slot, 1) };
    this.list.push(player);
    return player;
  }

  leave(deviceId) {
    this.list = this.list.filter((player) => player.deviceId !== deviceId);
  }

  // Busca el siguiente color que nadie más esté usando, en la dirección indicada (+1 o -1).
  nextFreeColor(startIndex, step) {
    const taken = new Set(this.list.map((player) => player.colorIndex));
    let index = startIndex;
    for (let i = 0; i < PLAYER_COLORS.length; i += 1) {
      if (!taken.has(index)) return index;
      index = (index + step + PLAYER_COLORS.length) % PLAYER_COLORS.length;
    }
    return startIndex;
  }

  changeColor(player, step) {
    const others = new Set(this.list.filter((p) => p !== player).map((p) => p.colorIndex));
    let index = player.colorIndex;
    do {
      index = (index + step + PLAYER_COLORS.length) % PLAYER_COLORS.length;
    } while (others.has(index));
    player.colorIndex = index;
  }

  color(player) {
    return PLAYER_COLORS[player.colorIndex];
  }
}

export const players = new Players();
