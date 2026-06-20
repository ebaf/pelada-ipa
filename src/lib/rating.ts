// Nota do jogador — fórmula derivada da planilha "Pelada IPA":
//   Nota = 5 + V*0.1 + E*0.025 - D*0.1 + Gols*0.15 + Assist*0.05 - GolContra*0.3
// Gols de pênalti são contados separadamente dos gols de linha (peso menor).

export type PlayerTotals = {
  goals: number; // gols de linha (sem pênalti, sem gol contra)
  penaltyGoals: number; // gols de pênalti
  assists: number;
  ownGoals: number; // gols contra
  wins: number;
  draws: number;
  losses: number;
};

export const RATING_WEIGHTS = {
  base: 5,
  win: 0.1,
  draw: 0.025,
  loss: -0.1,
  goal: 0.15,
  penaltyGoal: 0.1, // gol de pênalti vale um pouco menos que gol de linha
  assist: 0.05,
  ownGoal: -0.3,
} as const;

export function emptyTotals(): PlayerTotals {
  return {
    goals: 0,
    penaltyGoals: 0,
    assists: 0,
    ownGoals: 0,
    wins: 0,
    draws: 0,
    losses: 0,
  };
}

export function rating(t: PlayerTotals): number {
  const w = RATING_WEIGHTS;
  const n =
    w.base +
    t.wins * w.win +
    t.draws * w.draw +
    t.losses * w.loss +
    t.goals * w.goal +
    t.penaltyGoals * w.penaltyGoal +
    t.assists * w.assist +
    t.ownGoals * w.ownGoal;
  return Math.round(n * 1000) / 1000;
}

export function gamesPlayed(t: PlayerTotals): number {
  return t.wins + t.draws + t.losses;
}

export function totalGoals(t: PlayerTotals): number {
  return t.goals + t.penaltyGoals;
}
