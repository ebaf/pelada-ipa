// Agregação pura (sem Prisma) das estatísticas a partir de partidas/gols/elencos.
// Validada contra a planilha original em prisma/validate.ts.
import { PlayerTotals, emptyTotals } from "./rating";

export type RawMatch = {
  id: string;
  stage: string;
  homeTeamId: string;
  awayTeamId: string;
  homePens: number | null;
  awayPens: number | null;
  finished: boolean;
};
export type RawGoal = {
  matchId: string;
  teamId: string;
  scorerId: string | null;
  assistId: string | null;
  isOwnGoal: boolean;
  isPenalty: boolean;
};
export type RawMember = { teamId: string; playerId: string };
export type RawMatchPlayer = { matchId: string; playerId: string; teamId: string };

export type ScoreMap = Map<string, Map<string, number>>;

export function buildScoreMap(goals: RawGoal[]): ScoreMap {
  const map: ScoreMap = new Map();
  for (const g of goals) {
    let mm = map.get(g.matchId);
    if (!mm) {
      mm = new Map();
      map.set(g.matchId, mm);
    }
    mm.set(g.teamId, (mm.get(g.teamId) ?? 0) + 1);
  }
  return map;
}

export function getScore(
  scoreMap: ScoreMap,
  matchId: string,
  homeTeamId: string,
  awayTeamId: string,
): { home: number; away: number } {
  const mm = scoreMap.get(matchId);
  return { home: mm?.get(homeTeamId) ?? 0, away: mm?.get(awayTeamId) ?? 0 };
}

export type Outcome = "W" | "D" | "L";

export function outcome(m: RawMatch, home: number, away: number): [Outcome, Outcome] {
  if (home > away) return ["W", "L"];
  if (home < away) return ["L", "W"];
  if (m.stage === "GROUP") return ["D", "D"];
  const hp = m.homePens ?? 0;
  const ap = m.awayPens ?? 0;
  if (hp > ap) return ["W", "L"];
  if (ap > hp) return ["L", "W"];
  return ["D", "D"];
}

function bump(t: PlayerTotals | undefined, r: Outcome) {
  if (!t) return;
  if (r === "W") t.wins++;
  else if (r === "D") t.draws++;
  else t.losses++;
}

export function computeTotals(
  playerIds: string[],
  matches: RawMatch[],
  goals: RawGoal[],
  members: RawMember[],
  matchPlayers?: RawMatchPlayer[],
): Map<string, PlayerTotals> {
  const totals = new Map<string, PlayerTotals>();
  for (const id of playerIds) totals.set(id, emptyTotals());

  for (const g of goals) {
    if (g.scorerId) {
      const t = totals.get(g.scorerId);
      if (t) {
        if (g.isOwnGoal) t.ownGoals++;
        else if (g.isPenalty) t.penaltyGoals++;
        else t.goals++;
      }
    }
    if (g.assistId) {
      const t = totals.get(g.assistId);
      if (t) t.assists++;
    }
  }

  // Base: elenco fixo por time
  const membersByTeam = new Map<string, string[]>();
  for (const m of members) {
    let a = membersByTeam.get(m.teamId);
    if (!a) { a = []; membersByTeam.set(m.teamId, a); }
    a.push(m.playerId);
  }

  // Override por partida: matchId → (playerId → teamId)
  const matchOverrideMap = new Map<string, Map<string, string>>();
  for (const mp of matchPlayers ?? []) {
    let mm = matchOverrideMap.get(mp.matchId);
    if (!mm) { mm = new Map(); matchOverrideMap.set(mp.matchId, mm); }
    mm.set(mp.playerId, mp.teamId);
  }

  const scoreMap = buildScoreMap(goals);
  for (const match of matches) {
    if (!match.finished) continue;
    const { home, away } = getScore(scoreMap, match.id, match.homeTeamId, match.awayTeamId);
    const [hr, ar] = outcome(match, home, away);

    const overrides = matchOverrideMap.get(match.id) ?? new Map<string, string>();
    const overriddenIds = new Set(overrides.keys());

    // Elenco fixo, excluindo quem tem override nesta partida
    for (const pid of membersByTeam.get(match.homeTeamId) ?? []) {
      if (!overriddenIds.has(pid)) bump(totals.get(pid), hr);
    }
    for (const pid of membersByTeam.get(match.awayTeamId) ?? []) {
      if (!overriddenIds.has(pid)) bump(totals.get(pid), ar);
    }

    // Externos/substitutos: W/D/L pelo time que jogaram nesta partida
    for (const [pid, teamId] of overrides) {
      if (teamId === match.homeTeamId) bump(totals.get(pid), hr);
      else if (teamId === match.awayTeamId) bump(totals.get(pid), ar);
    }
  }
  return totals;
}
