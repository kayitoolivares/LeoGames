import { UNIFORMS } from './field.js';

// La Liga: tu equipo juega un partido contra cada uno de los otros 5 equipos (una jornada cada uno). En cada jornada
// los otros 4 equipos también juegan entre ellos (dos partidos "solos", con marcador al azar) y después se ve la tabla:
// 3 puntos por partido ganado (no hay empates: por goles siempre gana alguien y por tiempo hay gol de oro).
const WIN_POINTS = 3;
const SIM_MAX_GOALS = 4;

export function createLiga(ours) {
  const teams = UNIFORMS.map((uniform, index) => ({
    index,
    name: uniform.name,
    color: uniform.color,
    ours: index === ours,
    played: 0,
    won: 0,
    lost: 0,
    gf: 0,
    ga: 0,
    points: 0,
  }));
  return { ours, rivals: teams.filter((team) => !team.ours).map((team) => team.index), round: 0, teams, lastGames: null };
}

export function ligaOpponent(liga) {
  return liga.rivals[liga.round];
}

export function ligaDone(liga) {
  return liga.round >= liga.rivals.length;
}

function record(team, scored, received) {
  team.played += 1;
  team.gf += scored;
  team.ga += received;
  if (scored > received) {
    team.won += 1;
    team.points += WIN_POINTS;
  } else {
    team.lost += 1;
  }
}

// Anota tu partido de la jornada y juega los otros dos. Devuelve los tres marcadores.
export function playRound(liga, ourGoals, theirGoals, random = Math.random) {
  const rival = ligaOpponent(liga);
  const { teams } = liga;
  record(teams[liga.ours], ourGoals, theirGoals);
  record(teams[rival], theirGoals, ourGoals);
  const games = [{ home: liga.ours, away: rival, score: [ourGoals, theirGoals] }];
  // Los que no jugaron con nosotros, en otro orden cada jornada (para que no siempre se toquen los mismos).
  const rest = teams.filter((team) => team.index !== liga.ours && team.index !== rival).map((team) => team.index);
  const order = rest.map((_, i) => rest[(i + liga.round) % rest.length]);
  const goals = () => Math.floor(random() * (SIM_MAX_GOALS + 1));
  for (let i = 0; i + 1 < order.length; i += 2) {
    const [home, away] = [order[i], order[i + 1]];
    const a = goals();
    let b = goals();
    while (b === a) b = goals();
    record(teams[home], a, b);
    record(teams[away], b, a);
    games.push({ home, away, score: [a, b] });
  }
  liga.round += 1;
  liga.lastGames = games;
  return games;
}

// La tabla: más puntos arriba; si empatan, mejor diferencia de goles y luego más goles a favor.
export function ligaTable(liga) {
  return [...liga.teams].sort((a, b) => b.points - a.points || b.gf - b.ga - (a.gf - a.ga) || b.gf - a.gf);
}
