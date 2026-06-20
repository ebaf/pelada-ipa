// Helpers das eliminatórias.
// Chaveamento: SF1 = 1º x 4º, SF2 = 2º x 3º.
// Final = vencedor(SF1) x vencedor(SF2); Disputa de 3º = perdedores das semis.
// Empate no tempo normal é decidido nos pênaltis (homePens/awayPens).

export type KnockoutMatch = {
  homeTeamId: string;
  awayTeamId: string;
  homeScore: number;
  awayScore: number;
  homePens: number | null;
  awayPens: number | null;
};

export function isDecided(m: KnockoutMatch): boolean {
  if (m.homeScore !== m.awayScore) return true;
  return (m.homePens ?? 0) !== (m.awayPens ?? 0);
}

export function knockoutWinner(m: KnockoutMatch): string | null {
  if (m.homeScore > m.awayScore) return m.homeTeamId;
  if (m.awayScore > m.homeScore) return m.awayTeamId;
  const hp = m.homePens ?? 0;
  const ap = m.awayPens ?? 0;
  if (hp > ap) return m.homeTeamId;
  if (ap > hp) return m.awayTeamId;
  return null;
}

export function knockoutLoser(m: KnockoutMatch): string | null {
  const winner = knockoutWinner(m);
  if (!winner) return null;
  return winner === m.homeTeamId ? m.awayTeamId : m.homeTeamId;
}
