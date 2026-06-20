// Confere as estatísticas agregadas contra os números conhecidos da planilha.
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

type T = {
  goals: number;
  pen: number;
  assists: number;
  own: number;
  w: number;
  d: number;
  l: number;
};
const empty = (): T => ({ goals: 0, pen: 0, assists: 0, own: 0, w: 0, d: 0, l: 0 });

// (GP, AS, GC, V, E, D) lidos da aba "Jogadores" da planilha
const EXPECTED: Record<string, [number, number, number, number, number, number]> = {
  "André Cavalcanti": [4, 3, 0, 8, 5, 12],
  "Tiago Vitalino": [33, 8, 0, 11, 6, 18],
  "Baninho Vitalino": [26, 6, 0, 14, 5, 11],
  "Davi Brasil": [2, 1, 1, 4, 1, 5],
  "Emanuel Ferreira": [4, 5, 1, 10, 2, 18],
  "Valberto Enoc": [6, 25, 0, 15, 7, 13],
  Edimilson: [13, 10, 0, 19, 6, 5],
};

async function main() {
  const [players, matches, goals, memberships] = await Promise.all([
    prisma.player.findMany({ select: { id: true, name: true } }),
    prisma.match.findMany(),
    prisma.goalEvent.findMany(),
    prisma.teamPlayer.findMany({ select: { teamId: true, playerId: true } }),
  ]);
  const totals = new Map<string, T>();
  for (const p of players) totals.set(p.id, empty());

  const scoreByMatch = new Map<string, Map<string, number>>();
  for (const g of goals) {
    let mm = scoreByMatch.get(g.matchId);
    if (!mm) {
      mm = new Map();
      scoreByMatch.set(g.matchId, mm);
    }
    mm.set(g.teamId, (mm.get(g.teamId) ?? 0) + 1);
    if (g.scorerId) {
      const t = totals.get(g.scorerId)!;
      if (g.isOwnGoal) t.own++;
      else if (g.isPenalty) t.pen++;
      else t.goals++;
    }
    if (g.assistId) totals.get(g.assistId)!.assists++;
  }

  const membersByTeam = new Map<string, string[]>();
  for (const m of memberships) {
    let a = membersByTeam.get(m.teamId);
    if (!a) {
      a = [];
      membersByTeam.set(m.teamId, a);
    }
    a.push(m.playerId);
  }

  for (const match of matches) {
    if (!match.finished) continue;
    const sm = scoreByMatch.get(match.id);
    const hs = sm?.get(match.homeTeamId) ?? 0;
    const as = sm?.get(match.awayTeamId) ?? 0;
    let hr: "W" | "D" | "L", ar: "W" | "D" | "L";
    if (hs > as) [hr, ar] = ["W", "L"];
    else if (hs < as) [hr, ar] = ["L", "W"];
    else if (match.stage === "GROUP") [hr, ar] = ["D", "D"];
    else {
      const hp = match.homePens ?? 0,
        ap = match.awayPens ?? 0;
      if (hp > ap) [hr, ar] = ["W", "L"];
      else if (ap > hp) [hr, ar] = ["L", "W"];
      else [hr, ar] = ["D", "D"];
    }
    for (const pid of membersByTeam.get(match.homeTeamId) ?? []) {
      const t = totals.get(pid)!;
      t[hr === "W" ? "w" : hr === "D" ? "d" : "l"]++;
    }
    for (const pid of membersByTeam.get(match.awayTeamId) ?? []) {
      const t = totals.get(pid)!;
      t[ar === "W" ? "w" : ar === "D" ? "d" : "l"]++;
    }
  }

  const byName = new Map(players.map((p) => [p.name, totals.get(p.id)!]));
  let ok = 0,
    bad = 0;
  for (const [name, [gp, as, gc, v, e, d]] of Object.entries(EXPECTED)) {
    const t = byName.get(name);
    if (!t) {
      console.log(`❌ ${name}: não encontrado`);
      bad++;
      continue;
    }
    const got = [t.goals, t.assists, t.own, t.w, t.d, t.l];
    const exp = [gp, as, gc, v, e, d];
    const match = got.every((x, i) => x === exp[i]);
    console.log(
      `${match ? "✅" : "❌"} ${name.padEnd(20)} esperado GP${gp} AS${as} GC${gc} V${v} E${e} D${d} | obtido GP${t.goals} AS${t.assists} GC${t.own} V${t.w} E${t.d} D${t.l}` +
        (t.pen ? ` (pen ${t.pen})` : ""),
    );
    match ? ok++ : bad++;
  }
  console.log(`\n${ok} ok, ${bad} divergente(s)`);
}

main().finally(() => prisma.$disconnect());
