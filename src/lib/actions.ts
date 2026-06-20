"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { computeStandings, MatchResult } from "@/lib/standings";
import { buildScoreMap, getScore } from "@/lib/aggregate";
import { knockoutWinner, knockoutLoser } from "@/lib/knockout";

// Pares da fase de grupos, na ordem da planilha.
const GROUP_PAIRS: [string, string][] = [
  ["A", "B"],
  ["C", "D"],
  ["A", "C"],
  ["B", "D"],
  ["A", "D"],
  ["B", "C"],
];

function revalidateAll(championshipId?: string) {
  revalidatePath("/");
  revalidatePath("/jogadores");
  revalidatePath("/peladas");
  if (championshipId) {
    revalidatePath(`/peladas/${championshipId}`);
    revalidatePath(`/peladas/${championshipId}/gerenciar`);
  }
}

// ----------------------------- Jogadores -----------------------------

export async function createPlayer(name: string) {
  const trimmed = name.trim();
  if (!trimmed) return { error: "Informe o nome do jogador." };
  const existing = await prisma.player.findUnique({ where: { name: trimmed } });
  if (existing) return { error: "Já existe um jogador com esse nome." };
  await prisma.player.create({ data: { name: trimmed } });
  revalidateAll();
  return { ok: true };
}

export async function renamePlayer(id: string, name: string) {
  const trimmed = name.trim();
  if (!trimmed) return { error: "Informe o nome do jogador." };
  const clash = await prisma.player.findFirst({
    where: { name: trimmed, NOT: { id } },
  });
  if (clash) return { error: "Já existe um jogador com esse nome." };
  await prisma.player.update({ where: { id }, data: { name: trimmed } });
  revalidateAll();
  revalidatePath(`/jogadores/${id}`);
  return { ok: true };
}

export async function deletePlayer(id: string) {
  await prisma.player.delete({ where: { id } });
  revalidateAll();
  return { ok: true };
}

// ----------------------------- Peladas -----------------------------

export async function createChampionship(dateISO: string, name?: string) {
  if (!dateISO) return { error: "Informe a data da pelada." };
  const champ = await prisma.championship.create({
    data: {
      date: new Date(`${dateISO}T00:00:00.000Z`),
      name: name?.trim() || null,
    },
  });
  revalidateAll();
  return { ok: true, id: champ.id };
}

export async function deleteChampionship(id: string) {
  await prisma.championship.delete({ where: { id } });
  revalidateAll();
  return { ok: true };
}

export type RosterInput = {
  label: string;
  flagUrl?: string | null;
  crestUrl?: string | null;
  playerIds: string[];
};

/**
 * Cria/atualiza os 4 times e seus elencos. Gera as 6 partidas da fase de
 * grupos na primeira vez que os times forem definidos.
 */
export async function saveTeams(championshipId: string, rosters: RosterInput[]) {
  const teamIdByLabel = new Map<string, string>();

  for (const r of rosters) {
    const team = await prisma.team.upsert({
      where: { championshipId_label: { championshipId, label: r.label } },
      create: {
        championshipId,
        label: r.label,
        flagUrl: r.flagUrl || null,
        crestUrl: r.crestUrl || null,
      },
      update: { flagUrl: r.flagUrl || null, crestUrl: r.crestUrl || null },
    });
    teamIdByLabel.set(r.label, team.id);
    await prisma.teamPlayer.deleteMany({ where: { teamId: team.id } });
    if (r.playerIds.length) {
      await prisma.teamPlayer.createMany({
        data: r.playerIds.map((playerId, i) => ({ teamId: team.id, playerId, slot: i + 1 })),
      });
    }
  }

  // Gera a fase de grupos uma única vez.
  const existingGroup = await prisma.match.count({
    where: { championshipId, stage: "GROUP" },
  });
  if (existingGroup === 0 && teamIdByLabel.size === 4) {
    await prisma.match.createMany({
      data: GROUP_PAIRS.map(([h, a], i) => ({
        championshipId,
        stage: "GROUP",
        round: i + 1,
        homeTeamId: teamIdByLabel.get(h)!,
        awayTeamId: teamIdByLabel.get(a)!,
      })),
    });
  }

  revalidateAll(championshipId);
  return { ok: true };
}

// ----------------------------- Gols / partidas -----------------------------

export type GoalInput = {
  matchId: string;
  teamId: string; // time beneficiado (que marca o ponto)
  scorerId: string | null;
  assistId: string | null;
  isOwnGoal: boolean;
  isPenalty: boolean;
};

export async function addGoal(input: GoalInput) {
  const match = await prisma.match.findUnique({ where: { id: input.matchId } });
  if (!match) return { error: "Partida não encontrada." };
  await prisma.goalEvent.create({
    data: {
      matchId: input.matchId,
      teamId: input.teamId,
      scorerId: input.scorerId,
      assistId: input.assistId,
      isOwnGoal: input.isOwnGoal,
      isPenalty: input.isPenalty,
    },
  });
  revalidateAll(match.championshipId);
  return { ok: true };
}

export async function editGoal(
  goalId: string,
  input: Omit<GoalInput, "matchId">,
) {
  const goal = await prisma.goalEvent.findUnique({
    where: { id: goalId },
    include: { match: { select: { championshipId: true } } },
  });
  if (!goal) return { error: "Gol não encontrado." };
  await prisma.goalEvent.update({
    where: { id: goalId },
    data: {
      teamId: input.teamId,
      scorerId: input.scorerId,
      assistId: input.assistId,
      isOwnGoal: input.isOwnGoal,
      isPenalty: input.isPenalty,
    },
  });
  revalidateAll(goal.match.championshipId);
  return { ok: true };
}

export async function addMatchPlayer(matchId: string, playerId: string, teamId: string) {
  const match = await prisma.match.findUnique({ where: { id: matchId } });
  if (!match) return { error: "Partida não encontrada." };
  await prisma.matchPlayer.upsert({
    where: { matchId_playerId: { matchId, playerId } },
    create: { matchId, playerId, teamId },
    update: { teamId },
  });
  revalidateAll(match.championshipId);
  return { ok: true };
}

export async function removeMatchPlayer(matchId: string, playerId: string) {
  const match = await prisma.match.findUnique({ where: { id: matchId } });
  if (!match) return { error: "Partida não encontrada." };
  await prisma.matchPlayer.deleteMany({ where: { matchId, playerId } });
  revalidateAll(match.championshipId);
  return { ok: true };
}

export async function deleteGoal(goalId: string) {
  const goal = await prisma.goalEvent.findUnique({
    where: { id: goalId },
    include: { match: { select: { championshipId: true } } },
  });
  if (!goal) return { ok: true };
  await prisma.goalEvent.delete({ where: { id: goalId } });
  revalidateAll(goal.match.championshipId);
  return { ok: true };
}

export async function setMatchFinished(matchId: string, finished: boolean) {
  const match = await prisma.match.update({
    where: { id: matchId },
    data: { finished },
  });
  revalidateAll(match.championshipId);
  return { ok: true };
}

export async function setPens(matchId: string, homePens: number | null, awayPens: number | null) {
  const match = await prisma.match.update({
    where: { id: matchId },
    data: { homePens, awayPens },
  });
  revalidateAll(match.championshipId);
  return { ok: true };
}

// ----------------------------- Eliminatórias -----------------------------

async function standingsFor(championshipId: string) {
  const teams = await prisma.team.findMany({
    where: { championshipId },
    select: { id: true, label: true },
  });
  const groupMatches = await prisma.match.findMany({
    where: { championshipId, stage: "GROUP", finished: true },
    select: { id: true, homeTeamId: true, awayTeamId: true },
  });
  const goals = await prisma.goalEvent.findMany({
    where: { match: { championshipId, stage: "GROUP" } },
    select: { matchId: true, teamId: true },
  });
  const scoreMap = buildScoreMap(
    goals.map((g) => ({
      matchId: g.matchId,
      teamId: g.teamId,
      scorerId: null,
      assistId: null,
      isOwnGoal: false,
      isPenalty: false,
    })),
  );
  const results: MatchResult[] = groupMatches.map((m) => {
    const { home, away } = getScore(scoreMap, m.id, m.homeTeamId, m.awayTeamId);
    return { homeTeamId: m.homeTeamId, awayTeamId: m.awayTeamId, homeScore: home, awayScore: away };
  });
  return computeStandings(teams, results);
}

/** Cria SF1 (1º x 4º) e SF2 (2º x 3º) a partir da classificação. */
export async function generateKnockouts(championshipId: string) {
  const groupCount = await prisma.match.count({
    where: { championshipId, stage: "GROUP", finished: true },
  });
  if (groupCount < 6)
    return { error: "Encerre as 6 partidas da fase de grupos primeiro." };

  const existing = await prisma.match.count({
    where: { championshipId, stage: { in: ["SF1", "SF2"] } },
  });
  if (existing > 0) return { error: "As semifinais já foram geradas." };

  const table = await standingsFor(championshipId);
  if (table.length < 4) return { error: "É preciso ter 4 times." };
  const [first, second, third, fourth] = table;

  await prisma.match.createMany({
    data: [
      { championshipId, stage: "SF1", homeTeamId: first.teamId, awayTeamId: fourth.teamId },
      { championshipId, stage: "SF2", homeTeamId: second.teamId, awayTeamId: third.teamId },
    ],
  });
  revalidateAll(championshipId);
  return { ok: true };
}

/** Cria Final (vencedores) e Disputa de 3º (perdedores) a partir das semis. */
export async function generateFinals(championshipId: string) {
  const semis = await prisma.match.findMany({
    where: { championshipId, stage: { in: ["SF1", "SF2"] } },
  });
  const sf1 = semis.find((m) => m.stage === "SF1");
  const sf2 = semis.find((m) => m.stage === "SF2");
  if (!sf1 || !sf2) return { error: "Gere as semifinais primeiro." };
  if (!sf1.finished || !sf2.finished)
    return { error: "Encerre as duas semifinais primeiro." };

  const existing = await prisma.match.count({
    where: { championshipId, stage: { in: ["FINAL", "THIRD"] } },
  });
  if (existing > 0) return { error: "Final e disputa de 3º já foram geradas." };

  const goals = await prisma.goalEvent.findMany({
    where: { match: { championshipId, stage: { in: ["SF1", "SF2"] } } },
    select: { matchId: true, teamId: true },
  });
  const scoreMap = buildScoreMap(
    goals.map((g) => ({
      matchId: g.matchId,
      teamId: g.teamId,
      scorerId: null,
      assistId: null,
      isOwnGoal: false,
      isPenalty: false,
    })),
  );
  const toKM = (m: typeof sf1) => {
    const { home, away } = getScore(scoreMap, m.id, m.homeTeamId, m.awayTeamId);
    return {
      homeTeamId: m.homeTeamId,
      awayTeamId: m.awayTeamId,
      homeScore: home,
      awayScore: away,
      homePens: m.homePens,
      awayPens: m.awayPens,
    };
  };
  const w1 = knockoutWinner(toKM(sf1));
  const w2 = knockoutWinner(toKM(sf2));
  const l1 = knockoutLoser(toKM(sf1));
  const l2 = knockoutLoser(toKM(sf2));
  if (!w1 || !w2 || !l1 || !l2)
    return { error: "Defina o vencedor das semifinais (pênaltis em caso de empate)." };

  await prisma.match.createMany({
    data: [
      { championshipId, stage: "FINAL", homeTeamId: w1, awayTeamId: w2 },
      { championshipId, stage: "THIRD", homeTeamId: l1, awayTeamId: l2 },
    ],
  });
  revalidateAll(championshipId);
  return { ok: true };
}

/** Apaga as eliminatórias (para regerar caso a classificação mude). */
export async function resetKnockouts(championshipId: string) {
  await prisma.match.deleteMany({
    where: { championshipId, stage: { in: ["SF1", "SF2", "THIRD", "FINAL"] } },
  });
  revalidateAll(championshipId);
  return { ok: true };
}
