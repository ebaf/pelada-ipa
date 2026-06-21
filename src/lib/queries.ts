import { prisma } from "@/lib/db";
import { PlayerTotals, rating, gamesPlayed } from "@/lib/rating";
import { computeStandings, StandingRow, MatchResult } from "@/lib/standings";
import { knockoutWinner, knockoutLoser, isDecided } from "@/lib/knockout";
import {
  buildScoreMap,
  computeTotals,
  getScore,
  RawGoal,
  RawMatch,
  RawMember,
  RawMatchPlayer,
} from "@/lib/aggregate";

export type RankedPlayer = {
  id: string;
  name: string;
  totals: PlayerTotals;
  nota: number;
  games: number;
  rank: number;
};

async function loadAll() {
  const [players, matches, goals, members, matchPlayers] = await Promise.all([
    prisma.player.findMany({ select: { id: true, name: true } }),
    prisma.match.findMany({
      select: {
        id: true,
        championshipId: true,
        stage: true,
        homeTeamId: true,
        awayTeamId: true,
        homePens: true,
        awayPens: true,
        finished: true,
      },
    }),
    prisma.goalEvent.findMany({
      select: {
        matchId: true,
        teamId: true,
        scorerId: true,
        assistId: true,
        isOwnGoal: true,
        isPenalty: true,
      },
    }),
    prisma.teamPlayer.findMany({ select: { teamId: true, playerId: true } }),
    prisma.matchPlayer.findMany({ select: { matchId: true, playerId: true, teamId: true } }),
  ]);
  return { players, matches, goals, members, matchPlayers };
}

function rankPlayers(
  players: { id: string; name: string }[],
  totals: Map<string, PlayerTotals>,
): RankedPlayer[] {
  const list = players.map((p) => {
    const t = totals.get(p.id)!;
    return { id: p.id, name: p.name, totals: t, nota: rating(t), games: gamesPlayed(t) };
  });
  list.sort((a, b) => {
    if (b.nota !== a.nota) return b.nota - a.nota;
    if (b.games !== a.games) return b.games - a.games;
    return a.name.localeCompare(b.name, "pt-BR");
  });
  return list.map((p, i) => ({ ...p, rank: i + 1 }));
}

/** Ranking geral (carreira) de todos os jogadores, ordenado pela Nota. */
export async function getPlayerRanking(): Promise<RankedPlayer[]> {
  const { players, matches, goals, members, matchPlayers } = await loadAll();
  const totals = computeTotals(
    players.map((p) => p.id),
    matches,
    goals,
    members,
    matchPlayers,
  );
  return rankPlayers(players, totals);
}

export type RankedPlayerWithDelta = RankedPlayer & { delta: number | null };

/**
 * Ranking geral com a variação de posição causada pela última pelada
 * (posição anterior − posição atual). `delta` é null quando não há pelada
 * anterior para comparar.
 */
export async function getHomeRanking(): Promise<RankedPlayerWithDelta[]> {
  const { players, matches, goals, members, matchPlayers } = await loadAll();
  const ids = players.map((p) => p.id);
  const current = rankPlayers(players, computeTotals(ids, matches, goals, members, matchPlayers));

  const lastChamp = await prisma.championship.findFirst({
    orderBy: { date: "desc" },
    select: { id: true },
  });
  const lastMatchIds = new Set(
    lastChamp ? matches.filter((m) => m.championshipId === lastChamp.id).map((m) => m.id) : [],
  );
  if (lastMatchIds.size === 0) return current.map((p) => ({ ...p, delta: null }));

  const prevRank = new Map(
    rankPlayers(
      players,
      computeTotals(
        ids,
        matches.filter((m) => !lastMatchIds.has(m.id)),
        goals.filter((g) => !lastMatchIds.has(g.matchId)),
        members,
        matchPlayers.filter((mp) => !lastMatchIds.has(mp.matchId)),
      ),
    ).map((p) => [p.id, p.rank]),
  );
  return current.map((p) => ({ ...p, delta: (prevRank.get(p.id) ?? p.rank) - p.rank }));
}

/** Lista de peladas (mais recentes primeiro) com o campeão, se já houver. */
export async function listChampionships() {
  const champs = await prisma.championship.findMany({
    orderBy: { date: "desc" },
    include: {
      teams: {
        select: {
          id: true,
          label: true,
          members: {
            orderBy: { slot: "asc" },
            select: { player: { select: { name: true } } },
          },
        },
      },
      matches: {
        select: {
          id: true,
          stage: true,
          homeTeamId: true,
          awayTeamId: true,
          homePens: true,
          awayPens: true,
          finished: true,
        },
      },
    },
  });

  const allGoals = await prisma.goalEvent.findMany({
    select: { matchId: true, teamId: true },
  });
  const scoreMap = buildScoreMap(
    allGoals.map((g) => ({
      matchId: g.matchId,
      teamId: g.teamId,
      scorerId: null,
      assistId: null,
      isOwnGoal: false,
      isPenalty: false,
    })),
  );

  return champs.map((c) => {
    const labelById = new Map(c.teams.map((t) => [t.id, t.label]));
    const final = c.matches.find((m) => m.stage === "FINAL");
    let champion: string | null = null;
    let winnerId: string | null = null;
    if (final && final.finished) {
      const { home, away } = getScore(scoreMap, final.id, final.homeTeamId, final.awayTeamId);
      winnerId = knockoutWinner({
        homeTeamId: final.homeTeamId,
        awayTeamId: final.awayTeamId,
        homeScore: home,
        awayScore: away,
        homePens: final.homePens,
        awayPens: final.awayPens,
      });
      champion = winnerId ? (labelById.get(winnerId) ?? null) : null;
    }
    const finalUndecided = !!final && final.finished && champion === null;
    const championTeam = winnerId ? c.teams.find((t) => t.id === winnerId) : null;
    const championPlayers = championTeam?.members.map((m) => m.player.name) ?? [];
    return {
      id: c.id,
      name: c.name,
      date: c.date,
      teamCount: c.teams.length,
      matchCount: c.matches.length,
      finishedCount: c.matches.filter((m) => m.finished).length,
      champion,
      finalUndecided,
      championPlayers,
    };
  });
}

export async function getPlayersWithGames() {
  const { players, matches, goals, members, matchPlayers } = await loadAll();
  const totals = computeTotals(
    players.map((p) => p.id),
    matches,
    goals,
    members,
    matchPlayers,
  );
  return players
    .map((p) => ({ id: p.id, name: p.name, games: gamesPlayed(totals.get(p.id)!) }))
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}

/** Página do jogador: totais de carreira + desempenho por pelada. */
export async function getPlayerView(id: string) {
  const player = await prisma.player.findUnique({ where: { id } });
  if (!player) return null;

  const { players, matches, goals, members, matchPlayers } = await loadAll();
  const careerTotals = computeTotals(
    players.map((p) => p.id),
    matches,
    goals,
    members,
    matchPlayers,
  );
  const ranking = rankPlayers(players, careerTotals);
  const myRank = ranking.find((r) => r.id === id)!;

  // desempenho por pelada
  const champs = await prisma.championship.findMany({
    orderBy: { date: "desc" },
    include: {
      teams: {
        include: { members: { select: { playerId: true } } },
      },
      matches: {
        select: {
          id: true,
          stage: true,
          homeTeamId: true,
          awayTeamId: true,
          homePens: true,
          awayPens: true,
          finished: true,
        },
      },
    },
  });
  const goalsByMatch = new Map<string, RawGoal[]>();
  for (const g of goals) {
    let a = goalsByMatch.get(g.matchId);
    if (!a) {
      a = [];
      goalsByMatch.set(g.matchId, a);
    }
    a.push(g);
  }

  const perChampionship = champs
    .map((c) => {
      const matchIds = new Set(c.matches.map((m) => m.id));
      const myTeam = c.teams.find((t) => t.members.some((m) => m.playerId === id));
      const cMatches: RawMatch[] = c.matches;
      const cGoals: RawGoal[] = c.matches.flatMap((m) => goalsByMatch.get(m.id) ?? []);
      const cMembers: RawMember[] = c.teams.flatMap((t) =>
        t.members.map((m) => ({ teamId: t.id, playerId: m.playerId })),
      );
      const cMatchPlayers: RawMatchPlayer[] = matchPlayers.filter((mp) =>
        matchIds.has(mp.matchId),
      );
      // Jogador pode ser externo (sem equipe fixa na pelada) mas ter jogado via MatchPlayer
      const isExternal = !myTeam && cMatchPlayers.some((mp) => mp.playerId === id);
      const playerIds = isExternal ? [id] : [id];
      const totals = computeTotals(playerIds, cMatches, cGoals, cMembers, cMatchPlayers).get(id)!;
      return {
        id: c.id,
        date: c.date,
        name: c.name,
        teamLabel: myTeam?.label ?? null,
        totals,
        nota: rating(totals),
        played: gamesPlayed(totals) > 0 || !!myTeam || isExternal,
      };
    })
    .filter((c) => c.played);

  return { player, totals: myRank.totals, nota: myRank.nota, rank: myRank.rank, perChampionship };
}

export type GoalView = {
  id: string;
  teamId: string;
  scorerId: string | null;
  scorerName: string | null;
  assistId: string | null;
  assistName: string | null;
  isOwnGoal: boolean;
  isPenalty: boolean;
};

export type MatchPlayerView = {
  id: string;
  playerId: string;
  playerName: string;
  teamId: string;
};

export type MatchView = {
  id: string;
  stage: string;
  round: number | null;
  homeTeamId: string;
  awayTeamId: string;
  homeLabel: string;
  awayLabel: string;
  homeScore: number;
  awayScore: number;
  homePens: number | null;
  awayPens: number | null;
  finished: boolean;
  goals: GoalView[];
  matchPlayers: MatchPlayerView[];
  winnerTeamId: string | null;
};

/** Visão completa de uma pelada para o painel/edição. */
export async function getChampionshipView(id: string) {
  const champ = await prisma.championship.findUnique({
    where: { id },
    include: {
      teams: {
        orderBy: { label: "asc" },
        include: {
          members: {
            orderBy: [{ slot: "asc" }],
            include: { player: { select: { id: true, name: true } } },
          },
        },
      },
      matches: {
        orderBy: [{ stage: "asc" }, { round: "asc" }],
        include: {
          goals: {
            orderBy: { createdAt: "asc" },
            include: {
              scorer: { select: { id: true, name: true } },
              assist: { select: { id: true, name: true } },
            },
          },
          matchPlayers: {
            include: { player: { select: { id: true, name: true } } },
          },
        },
      },
    },
  });
  if (!champ) return null;

  const labelById = new Map(champ.teams.map((t) => [t.id, t.label]));
  const rawGoals: RawGoal[] = champ.matches.flatMap((m) =>
    m.goals.map((g) => ({
      matchId: m.id,
      teamId: g.teamId,
      scorerId: g.scorerId,
      assistId: g.assistId,
      isOwnGoal: g.isOwnGoal,
      isPenalty: g.isPenalty,
    })),
  );
  const scoreMap = buildScoreMap(rawGoals);

  const matches: MatchView[] = champ.matches.map((m) => {
    const { home, away } = getScore(scoreMap, m.id, m.homeTeamId, m.awayTeamId);
    const winnerTeamId =
      m.stage === "GROUP"
        ? null
        : knockoutWinner({
            homeTeamId: m.homeTeamId,
            awayTeamId: m.awayTeamId,
            homeScore: home,
            awayScore: away,
            homePens: m.homePens,
            awayPens: m.awayPens,
          });
    return {
      id: m.id,
      stage: m.stage,
      round: m.round,
      homeTeamId: m.homeTeamId,
      awayTeamId: m.awayTeamId,
      homeLabel: labelById.get(m.homeTeamId) ?? "?",
      awayLabel: labelById.get(m.awayTeamId) ?? "?",
      homeScore: home,
      awayScore: away,
      homePens: m.homePens,
      awayPens: m.awayPens,
      finished: m.finished,
      winnerTeamId,
      goals: m.goals.map((g) => ({
        id: g.id,
        teamId: g.teamId,
        scorerId: g.scorerId,
        scorerName: g.scorer?.name ?? null,
        assistId: g.assistId,
        assistName: g.assist?.name ?? null,
        isOwnGoal: g.isOwnGoal,
        isPenalty: g.isPenalty,
      })),
      matchPlayers: m.matchPlayers.map((mp) => ({
        id: mp.id,
        playerId: mp.player.id,
        playerName: mp.player.name,
        teamId: mp.teamId,
      })),
    };
  });

  const groupMatches = matches.filter((m) => m.stage === "GROUP");
  const groupResults: MatchResult[] = groupMatches
    .filter((m) => m.finished)
    .map((m) => ({
      homeTeamId: m.homeTeamId,
      awayTeamId: m.awayTeamId,
      homeScore: m.homeScore,
      awayScore: m.awayScore,
    }));
  const standings: StandingRow[] = computeStandings(
    champ.teams.map((t) => ({ id: t.id, label: t.label })),
    groupResults,
  );

  const byStage = (s: string) => matches.find((m) => m.stage === s) ?? null;
  const finalMatch = byStage("FINAL");
  let champion: string | null = null;
  if (finalMatch && finalMatch.finished && finalMatch.winnerTeamId) {
    champion = finalMatch.winnerTeamId;
  }

  // estatísticas por jogador nesta pelada
  const rosterIds = champ.teams.flatMap((t) => t.members.map((m) => m.player.id));
  const nameById = new Map(
    champ.teams.flatMap((t) => t.members.map((m) => [m.player.id, m.player.name] as const)),
  );
  const teamByPlayer = new Map<string, string>();
  for (const t of champ.teams) for (const m of t.members) teamByPlayer.set(m.player.id, t.label);

  const rawMatches: RawMatch[] = champ.matches.map((m) => ({
    id: m.id,
    stage: m.stage,
    homeTeamId: m.homeTeamId,
    awayTeamId: m.awayTeamId,
    homePens: m.homePens,
    awayPens: m.awayPens,
    finished: m.finished,
  }));
  const rawMembers: RawMember[] = champ.teams.flatMap((t) =>
    t.members.map((m) => ({ teamId: t.id, playerId: m.player.id })),
  );
  const rawMatchPlayers: RawMatchPlayer[] = champ.matches.flatMap((m) =>
    m.matchPlayers.map((mp) => ({ matchId: m.id, playerId: mp.player.id, teamId: mp.teamId })),
  );

  // Inclui externos (MatchPlayer) que não estão em nenhum elenco desta pelada
  const externalIds = rawMatchPlayers
    .map((mp) => mp.playerId)
    .filter((pid) => !rosterIds.includes(pid));
  // Busca nomes dos externos
  const externalPlayers =
    externalIds.length > 0
      ? await prisma.player.findMany({
          where: { id: { in: externalIds } },
          select: { id: true, name: true },
        })
      : [];
  for (const p of externalPlayers) nameById.set(p.id, p.name);

  const allDayIds = [...new Set([...rosterIds, ...externalIds])];
  const dayTotals = computeTotals(allDayIds, rawMatches, rawGoals, rawMembers, rawMatchPlayers);

  // Descobre o time pelo qual o externo jogou (o time de maior presença)
  const externalTeamLabel = (pid: string): string => {
    const mp = rawMatchPlayers.find((x) => x.playerId === pid);
    if (!mp) return "";
    const team = champ.teams.find((t) => t.id === mp.teamId);
    return team?.label ?? "";
  };

  const playerStats = allDayIds
    .map((pid) => {
      const t = dayTotals.get(pid)!;
      return {
        id: pid,
        name: nameById.get(pid) ?? "?",
        teamLabel: teamByPlayer.get(pid) ?? externalTeamLabel(pid),
        totals: t,
        nota: rating(t),
      };
    })
    .sort((a, b) => b.nota - a.nota || a.name.localeCompare(b.name, "pt-BR"));

  const allGroupFinished =
    groupMatches.length === 6 && groupMatches.every((m) => m.finished);
  const semisFinished =
    !!byStage("SF1")?.finished && !!byStage("SF2")?.finished;
  const hasKnockouts = !!byStage("SF1");
  const hasFinals = !!byStage("FINAL");

  return {
    championship: { id: champ.id, name: champ.name, date: champ.date },
    teams: champ.teams.map((t) => ({
      id: t.id,
      label: t.label,
      flagUrl: t.flagUrl,
      crestUrl: t.crestUrl,
      members: t.members.map((m) => ({
        id: m.player.id,
        name: m.player.name,
        isGoalkeeper: m.isGoalkeeper,
      })),
    })),
    matches,
    groupMatches,
    knockoutMatches: matches.filter((m) => m.stage !== "GROUP"),
    sf1: byStage("SF1"),
    sf2: byStage("SF2"),
    third: byStage("THIRD"),
    final: finalMatch,
    standings,
    champion,
    playerStats,
    flags: { allGroupFinished, semisFinished, hasKnockouts, hasFinals },
  };
}

export type ChampionshipView = NonNullable<Awaited<ReturnType<typeof getChampionshipView>>>;
export { isDecided, knockoutLoser };
