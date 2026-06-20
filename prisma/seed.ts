/**
 * Importa os dados da planilha "Pelada IPA" (prisma/seed-data.json) para o banco.
 * Roda com:  npm run db:seed
 */
import { PrismaClient } from "@prisma/client";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const prisma = new PrismaClient();
const __dirname = dirname(fileURLToPath(import.meta.url));

type RawGoal = {
  round: string | null;
  scorerTeam: string | null;
  scorer: string | null;
  assist: string | null;
  ownGoal: boolean;
  penalty: boolean;
  t1: string | null;
  t2: string | null;
};
type RawChampionship = {
  date: string;
  teams: Record<string, { flag: string | null; crest: string | null; players: string[] }>;
  groupMatches: { round: number; home: string; away: string; homeGoals: number; awayGoals: number }[];
  knockoutMatches: {
    stage: string;
    phase: string;
    home: string;
    away: string;
    homeGoals: number;
    awayGoals: number;
    homePens: number | null;
    awayPens: number | null;
  }[];
  goals: RawGoal[];
};
type SeedData = { players: string[]; championships: RawChampionship[] };

const STAGE_MAP: Record<string, string> = {
  SF1: "SF1",
  SF2: "SF2",
  "3º": "THIRD",
  Final: "FINAL",
};

function other(label: string, t1: string | null, t2: string | null): string | null {
  if (!t1 || !t2) return null;
  return label === t1 ? t2 : t1;
}

async function main() {
  const data: SeedData = JSON.parse(
    readFileSync(join(__dirname, "seed-data.json"), "utf-8"),
  );

  console.log("Limpando banco...");
  await prisma.goalEvent.deleteMany();
  await prisma.match.deleteMany();
  await prisma.teamPlayer.deleteMany();
  await prisma.team.deleteMany();
  await prisma.championship.deleteMany();
  await prisma.player.deleteMany();

  // ---- Jogadores (lista oficial + qualquer nome citado em elencos/gols) ----
  const names = new Set<string>(data.players.map((n) => n.trim()).filter(Boolean));
  for (const c of data.championships) {
    for (const t of Object.values(c.teams)) for (const p of t.players) names.add(p.trim());
    for (const g of c.goals) {
      if (g.scorer) names.add(g.scorer.trim());
      if (g.assist) names.add(g.assist.trim());
    }
  }
  const playerByName = new Map<string, string>();
  for (const name of [...names].sort((a, b) => a.localeCompare(b, "pt-BR"))) {
    const p = await prisma.player.create({ data: { name } });
    playerByName.set(name, p.id);
  }
  console.log(`Jogadores: ${playerByName.size}`);

  let mismatches = 0;
  for (const c of data.championships) {
    const champ = await prisma.championship.create({
      data: { date: new Date(`${c.date}T00:00:00.000Z`) },
    });

    // ---- Times + elencos ----
    const teamByLabel = new Map<string, string>();
    for (const label of Object.keys(c.teams).sort()) {
      const t = c.teams[label];
      const team = await prisma.team.create({
        data: {
          label,
          flagUrl: t.flag ?? null,
          crestUrl: t.crest ?? null,
          championshipId: champ.id,
        },
      });
      teamByLabel.set(label, team.id);
      await prisma.teamPlayer.createMany({
        data: t.players.map((name, i) => ({
          teamId: team.id,
          playerId: playerByName.get(name.trim())!,
          slot: i + 1,
        })),
      });
    }

    // ---- Partidas (grupos + eliminatórias) ----
    const matchByRound = new Map<number, string>();
    const matchByStage = new Map<string, string>();
    for (const g of c.groupMatches) {
      const m = await prisma.match.create({
        data: {
          stage: "GROUP",
          round: g.round,
          championshipId: champ.id,
          homeTeamId: teamByLabel.get(g.home)!,
          awayTeamId: teamByLabel.get(g.away)!,
          finished: true,
        },
      });
      matchByRound.set(g.round, m.id);
    }
    for (const k of c.knockoutMatches) {
      const stage = STAGE_MAP[k.stage] ?? k.stage;
      const m = await prisma.match.create({
        data: {
          stage,
          championshipId: champ.id,
          homeTeamId: teamByLabel.get(k.home)!,
          awayTeamId: teamByLabel.get(k.away)!,
          homePens: k.homePens,
          awayPens: k.awayPens,
          finished: true,
        },
      });
      matchByStage.set(stage, m.id);
    }

    // ---- Gols ----
    for (const g of c.goals) {
      if (!g.round || !g.scorerTeam) continue;
      let matchId: string | undefined;
      const asNum = Number(g.round);
      if (!Number.isNaN(asNum)) matchId = matchByRound.get(asNum);
      else matchId = matchByStage.get(STAGE_MAP[g.round] ?? g.round);
      if (!matchId) continue;

      const benefitLabel = g.ownGoal ? other(g.scorerTeam, g.t1, g.t2) : g.scorerTeam;
      const teamId = benefitLabel ? teamByLabel.get(benefitLabel) : undefined;
      if (!teamId) continue;

      await prisma.goalEvent.create({
        data: {
          matchId,
          teamId,
          scorerId: g.scorer ? (playerByName.get(g.scorer.trim()) ?? null) : null,
          assistId: g.assist ? (playerByName.get(g.assist.trim()) ?? null) : null,
          isOwnGoal: g.ownGoal,
          isPenalty: g.penalty,
        },
      });
    }

    // ---- Validação: placar reconstruído x planilha ----
    for (const g of c.groupMatches) {
      const matchId = matchByRound.get(g.round)!;
      const home = teamByLabel.get(g.home)!;
      const away = teamByLabel.get(g.away)!;
      const hs = await prisma.goalEvent.count({ where: { matchId, teamId: home } });
      const as = await prisma.goalEvent.count({ where: { matchId, teamId: away } });
      if (hs !== g.homeGoals || as !== g.awayGoals) {
        mismatches++;
        console.warn(
          `  ⚠ ${c.date} R${g.round} ${g.home}x${g.away}: planilha ${g.homeGoals}-${g.awayGoals}, gols ${hs}-${as}`,
        );
      }
    }
    for (const k of c.knockoutMatches) {
      const stage = STAGE_MAP[k.stage] ?? k.stage;
      const matchId = matchByStage.get(stage)!;
      const home = teamByLabel.get(k.home)!;
      const away = teamByLabel.get(k.away)!;
      const hs = await prisma.goalEvent.count({ where: { matchId, teamId: home } });
      const as = await prisma.goalEvent.count({ where: { matchId, teamId: away } });
      if (hs !== k.homeGoals || as !== k.awayGoals) {
        mismatches++;
        console.warn(
          `  ⚠ ${c.date} ${k.stage} ${k.home}x${k.away}: planilha ${k.homeGoals}-${k.awayGoals}, gols ${hs}-${as}`,
        );
      }
    }
    console.log(`Pelada ${c.date} importada.`);
  }

  console.log(
    mismatches === 0
      ? "✅ Todos os placares batem com a planilha."
      : `⚠ ${mismatches} partida(s) com placar divergente (gols sem autor na planilha).`,
  );
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
