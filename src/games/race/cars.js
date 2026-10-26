// Los carros de Carreras: cómo se ven (las opciones de buildKartModel) y cómo corren. Los números son "veces el
// carro clásico":
//   speed: velocidad máxima   accel: qué tan rápido arranca   turn: qué tan rápido da vuelta
//   offroad: qué tan poco lo frena salirse al pasto   turbo: qué tan fuerte es su turbo   weight: qué tanto empuja al chocar
// `bars`: lo que se enseña al escogerlo (de 1 a 5): velocidad, arranque y manejo.
export const CARS = [
  {
    key: 'clasico',
    name: 'Clásico',
    model: { type: 'clasico' },
    speed: 1,
    accel: 1,
    turn: 1,
    offroad: 1,
    turbo: 1,
    weight: 1,
    bars: [3, 3, 3],
    note: 'De todo un poco',
  },
  {
    key: 'bolido',
    name: 'Bólido',
    model: { type: 'bolido' },
    speed: 1.12,
    accel: 0.8,
    turn: 0.9,
    offroad: 0.9,
    turbo: 1,
    weight: 1,
    bars: [5, 2, 2],
    note: 'El más rápido',
  },
  {
    key: 'mini',
    name: 'Mini',
    model: { type: 'mini', extra: 'antena' },
    speed: 0.93,
    accel: 1.3,
    turn: 1.3,
    offroad: 1,
    turbo: 1,
    weight: 0.7,
    bars: [2, 5, 5],
    note: 'Da vueltas muy cerradas',
  },
  {
    key: 'monstruo',
    name: 'Monstruo',
    model: { type: 'monstruo', extra: 'cuernos' },
    speed: 0.98,
    accel: 0.95,
    turn: 0.95,
    offroad: 1.6,
    turbo: 1,
    weight: 1.6,
    bars: [3, 3, 3],
    note: 'El pasto no lo frena y empuja fuerte',
  },
  {
    key: 'cohete',
    name: 'Cohete',
    model: { type: 'cohete', extra: 'cohetes' },
    speed: 1,
    accel: 1,
    turn: 0.95,
    offroad: 1,
    turbo: 1.3,
    weight: 1,
    bars: [4, 3, 2],
    note: 'Su turbo es el más fuerte',
  },
  {
    key: 'pato',
    name: 'Patito',
    model: { type: 'pato', extra: 'nada' },
    speed: 0.97,
    accel: 1.15,
    turn: 1.15,
    offroad: 1.2,
    turbo: 1,
    weight: 0.9,
    bars: [3, 4, 4],
    note: '¡Cuac!',
  },
];

export function carByKey(key) {
  return CARS.find((car) => car.key === key) ?? CARS[0];
}
