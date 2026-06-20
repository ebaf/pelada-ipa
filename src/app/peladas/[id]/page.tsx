import Link from "next/link";
import { notFound } from "next/navigation";
import { getChampionshipView, MatchView } from "@/lib/queries";
import { formatDateLong, formatNota } from "@/lib/format";
import { totalGoals } from "@/lib/rating";
import { StandingsTable } from "@/components/StandingsTable";
import { Bracket } from "@/components/Bracket";
import { TeamBadge } from "@/components/TeamBadge";
import { NotaInfo } from "@/components/NotaInfo";
import { PlayerStatsLine } from "@/components/PlayerStatsLine";
import { ShareMatchButton } from "@/components/ShareMatchButton";
import { formatMatchForWhatsApp } from "@/lib/share";

export const dynamic = "force-dynamic";

function goalLabel(g: { scorerName: string | null; isOwnGoal: boolean; isPenalty: boolean }) {
  const suffix = g.isOwnGoal ? " (gc)" : g.isPenalty ? " (pên)" : "";
  return `${g.scorerName ?? "?"}${suffix}`;
}

function GroupMatch({
  m,
  champ,
}: {
  m: MatchView;
  champ: { name: string | null; date: Date | string };
}) {
  const homeGoals = m.goals.filter((g) => g.teamId === m.homeTeamId);
  const awayGoals = m.goals.filter((g) => g.teamId === m.awayTeamId);
  return (
    <div className="card-2 p-3">
      <div className="flex items-center justify-center gap-3">
        <span className="flex flex-1 items-center justify-end gap-2 font-semibold">
          Time {m.homeLabel} <TeamBadge label={m.homeLabel} className="!h-6 !w-6 text-xs" />
        </span>
        <span className="rounded-lg bg-bg px-3 py-1 text-lg font-extrabold tabular-nums">
          {m.finished ? `${m.homeScore} : ${m.awayScore}` : "– : –"}
        </span>
        <span className="flex flex-1 items-center gap-2 font-semibold">
          <TeamBadge label={m.awayLabel} className="!h-6 !w-6 text-xs" /> Time {m.awayLabel}
        </span>
      </div>
      {(homeGoals.length > 0 || awayGoals.length > 0) && (
        <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-muted">
          <div className="text-right">{homeGoals.map(goalLabel).join(", ")}</div>
          <div>{awayGoals.map(goalLabel).join(", ")}</div>
        </div>
      )}
      {m.finished && (
        <div className="mt-2 flex justify-end border-t border-border pt-2">
          <ShareMatchButton text={formatMatchForWhatsApp(m, champ)} />
        </div>
      )}
    </div>
  );
}

export default async function PeladaDashboard({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getChampionshipView(id);
  if (!data) notFound();

  const { championship, standings, groupMatches, sf1, sf2, third, final, playerStats, flags } = data;

  // Pódio final
  const podium: { rank: number; label: string }[] = [];
  if (final?.finished && final.winnerTeamId) {
    const loserFinal =
      final.winnerTeamId === final.homeTeamId ? final.awayLabel : final.homeLabel;
    const winnerLabel = final.winnerTeamId === final.homeTeamId ? final.homeLabel : final.awayLabel;
    podium.push({ rank: 1, label: winnerLabel }, { rank: 2, label: loserFinal });
  }
  if (third?.finished && third.winnerTeamId) {
    const loserThird =
      third.winnerTeamId === third.homeTeamId ? third.awayLabel : third.homeLabel;
    const winnerThird = third.winnerTeamId === third.homeTeamId ? third.homeLabel : third.awayLabel;
    podium.push({ rank: 3, label: winnerThird }, { rank: 4, label: loserThird });
  }

  const topScorer = [...playerStats].sort((a, b) => totalGoals(b.totals) - totalGoals(a.totals))[0];

  return (
    <div className="space-y-7">
      <div className="flex items-start justify-between gap-3">
        <div>
          <Link href="/" className="text-sm text-muted hover:text-fg">
            ← Início
          </Link>
          <h1 className="mt-1 text-2xl font-extrabold capitalize">
            {championship.name || formatDateLong(championship.date)}
          </h1>
          {championship.name && (
            <p className="text-sm capitalize text-muted">{formatDateLong(championship.date)}</p>
          )}
        </div>
        <Link href={`/peladas/${id}/gerenciar`} className="btn btn-ghost btn-sm shrink-0">
          ✎ Gerenciar
        </Link>
      </div>

      {podium.length > 0 && (
        <section className="card overflow-hidden">
          <div className="border-b border-border bg-gradient-to-b from-gold/15 to-transparent px-4 py-3 text-center">
            <div className="text-3xl">🏆</div>
            <div className="mt-1 text-lg font-extrabold">
              Campeão: Time {podium[0].label}
            </div>
          </div>
          <ul className="divide-y divide-border">
            {podium.map((p) => (
              <li key={p.rank} className="flex items-center gap-3 px-4 py-2.5">
                <span className="w-7 text-center text-xl">
                  {p.rank === 1 ? "🥇" : p.rank === 2 ? "🥈" : p.rank === 3 ? "🥉" : "4º"}
                </span>
                <TeamBadge label={p.label} className="!h-6 !w-6 text-xs" />
                <span className="font-semibold">Time {p.label}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className="mb-3 text-lg font-bold">Classificação · fase de grupos</h2>
        <div className="card p-2">
          <StandingsTable rows={standings} qualifyHint />
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-bold">Jogos · pontos corridos</h2>
        <div className="space-y-2">
          {groupMatches.length === 0 ? (
            <p className="card p-5 text-center text-muted">Times ainda não definidos.</p>
          ) : (
            groupMatches.map((m) => <GroupMatch key={m.id} m={m} champ={championship} />)
          )}
        </div>
      </section>

      {flags.hasKnockouts && (
        <section>
          <h2 className="mb-3 text-lg font-bold">Eliminatórias</h2>
          <Bracket sf1={sf1} sf2={sf2} final={final} third={third} champ={championship} />
        </section>
      )}

      {playerStats.length > 0 && (
        <section>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold">Destaques do dia</h2>
              <NotaInfo />
            </div>
            {topScorer && totalGoals(topScorer.totals) > 0 && (
              <span className="chip">
                👟 Artilheiro: {topScorer.name} ({totalGoals(topScorer.totals)})
              </span>
            )}
          </div>
          <div className="card overflow-hidden">
            <ul className="divide-y divide-border">
              {playerStats.map((p) => (
                <li key={p.id}>
                  <Link
                    href={`/jogadores/${p.id}`}
                    className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-2"
                  >
                    <TeamBadge label={p.teamLabel} className="!h-7 !w-7 text-xs" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-semibold">{p.name}</div>
                      <PlayerStatsLine t={p.totals} />
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="text-lg font-extrabold tabular-nums text-primary">
                        {formatNota(p.nota)}
                      </div>
                      <div className="text-[10px] uppercase tracking-wide text-muted">nota</div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}
    </div>
  );
}
