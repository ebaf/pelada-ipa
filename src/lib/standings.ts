// Classificação da fase de grupos.
// Critérios de desempate (nesta ordem):
//   1) pontos (V=3, E=1, D=0)
//   2) confrontos diretos (mini-tabela entre os times empatados: pontos e saldo)
//   3) saldo de gols geral
//   4) ordem alfabética do nome (label) do time

export type MatchResult = {
  homeTeamId: string;
  awayTeamId: string;
  homeScore: number;
  awayScore: number;
};

export type StandingRow = {
  teamId: string;
  label: string;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDiff: number;
  points: number;
  rank: number;
};

type Tally = Omit<StandingRow, "rank">;

function headToHead(
  matches: MatchResult[],
  teamIds: string[],
): Map<string, { points: number; goalDiff: number }> {
  const set = new Set(teamIds);
  const acc = new Map<string, { points: number; goalDiff: number }>();
  for (const id of teamIds) acc.set(id, { points: 0, goalDiff: 0 });
  for (const m of matches) {
    if (!set.has(m.homeTeamId) || !set.has(m.awayTeamId)) continue;
    const h = acc.get(m.homeTeamId)!;
    const a = acc.get(m.awayTeamId)!;
    h.goalDiff += m.homeScore - m.awayScore;
    a.goalDiff += m.awayScore - m.homeScore;
    if (m.homeScore > m.awayScore) h.points += 3;
    else if (m.homeScore < m.awayScore) a.points += 3;
    else {
      h.points += 1;
      a.points += 1;
    }
  }
  return acc;
}

export function computeStandings(
  teams: { id: string; label: string }[],
  matches: MatchResult[],
): StandingRow[] {
  const rows = new Map<string, Tally>();
  for (const t of teams) {
    rows.set(t.id, {
      teamId: t.id,
      label: t.label,
      played: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      goalDiff: 0,
      points: 0,
    });
  }

  for (const m of matches) {
    const h = rows.get(m.homeTeamId);
    const a = rows.get(m.awayTeamId);
    if (!h || !a) continue;
    h.played++;
    a.played++;
    h.goalsFor += m.homeScore;
    h.goalsAgainst += m.awayScore;
    a.goalsFor += m.awayScore;
    a.goalsAgainst += m.homeScore;
    if (m.homeScore > m.awayScore) {
      h.wins++;
      a.losses++;
      h.points += 3;
    } else if (m.homeScore < m.awayScore) {
      a.wins++;
      h.losses++;
      a.points += 3;
    } else {
      h.draws++;
      a.draws++;
      h.points += 1;
      a.points += 1;
    }
  }

  const list = [...rows.values()];
  for (const r of list) r.goalDiff = r.goalsFor - r.goalsAgainst;

  list.sort((x, y) => {
    if (y.points !== x.points) return y.points - x.points;
    // confronto direto entre todos os times com a mesma pontuação
    const tied = list.filter((r) => r.points === x.points).map((r) => r.teamId);
    if (tied.length > 1) {
      const h2h = headToHead(matches, tied);
      const hx = h2h.get(x.teamId)!;
      const hy = h2h.get(y.teamId)!;
      if (hy.points !== hx.points) return hy.points - hx.points;
      if (hy.goalDiff !== hx.goalDiff) return hy.goalDiff - hx.goalDiff;
    }
    if (y.goalDiff !== x.goalDiff) return y.goalDiff - x.goalDiff;
    return x.label.localeCompare(y.label, "pt-BR");
  });

  return list.map((r, i) => ({ ...r, rank: i + 1 }));
}
