import { MatchView } from "@/lib/queries";
import { TeamBadge } from "./TeamBadge";
import { ShareMatchButton } from "./ShareMatchButton";
import { STAGE_LABEL } from "@/lib/format";
import { formatMatchForWhatsApp } from "@/lib/share";

type Champ = { name: string | null; date: Date | string };

function goalLabel(g: { scorerName: string | null; isOwnGoal: boolean; isPenalty: boolean }) {
  const suffix = g.isOwnGoal ? " (gc)" : g.isPenalty ? " (pên)" : "";
  return `${g.scorerName ?? "?"}${suffix}`;
}

function KnockoutCard({
  match,
  title,
  highlight,
  champ,
}: {
  match: MatchView | null;
  title: string;
  highlight?: "gold" | "bronze";
  champ: Champ;
}) {
  const border =
    highlight === "gold"
      ? "border-gold/60"
      : highlight === "bronze"
        ? "border-bronze/50"
        : "border-border";
  const homeGoals = match?.goals.filter((g) => g.teamId === match.homeTeamId) ?? [];
  const awayGoals = match?.goals.filter((g) => g.teamId === match.awayTeamId) ?? [];
  const showPens = match?.finished && match.homeScore === match.awayScore;
  return (
    <div>
      <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
        {highlight === "gold" && <span>🏆</span>}
        {highlight === "bronze" && <span>🥉</span>}
        {title}
        {match?.finished && (
          <span className="ml-auto">
            <ShareMatchButton text={formatMatchForWhatsApp(match, champ)} trigger="icon" />
          </span>
        )}
      </div>
      <div className={`card-2 p-3 ${border}`}>
        {match ? (
          <>
            <div className="flex items-center justify-center gap-3">
              <span className="flex flex-1 items-center justify-end gap-2 font-semibold">
                Time {match.homeLabel} <TeamBadge label={match.homeLabel} className="!h-6 !w-6 text-xs" />
              </span>
              <div className="text-center">
                <span className="rounded-lg bg-bg px-3 py-1 text-lg font-extrabold tabular-nums">
                  {match.finished ? `${match.homeScore} : ${match.awayScore}` : "– : –"}
                </span>
                {showPens && (
                  <div className="mt-0.5 text-xs text-muted tabular-nums">
                    ({match.homePens ?? 0} × {match.awayPens ?? 0} pên)
                  </div>
                )}
              </div>
              <span className="flex flex-1 items-center gap-2 font-semibold">
                <TeamBadge label={match.awayLabel} className="!h-6 !w-6 text-xs" /> Time {match.awayLabel}
              </span>
            </div>
            {(homeGoals.length > 0 || awayGoals.length > 0) && (
              <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-muted">
                <div className="text-right">{homeGoals.map((g, i) => <div key={i}>{goalLabel(g)}</div>)}</div>
                <div>{awayGoals.map((g, i) => <div key={i}>{goalLabel(g)}</div>)}</div>
              </div>
            )}
          </>
        ) : (
          <div className="py-4 text-center text-sm text-muted">A definir</div>
        )}
      </div>
    </div>
  );
}

export function Bracket({
  sf1,
  sf2,
  final,
  third,
  champ,
}: {
  sf1: MatchView | null;
  sf2: MatchView | null;
  final: MatchView | null;
  third: MatchView | null;
  champ: Champ;
}) {
  return (
    <div className="space-y-4">
      <KnockoutCard match={sf1} title={STAGE_LABEL.SF1} champ={champ} />
      <KnockoutCard match={sf2} title={STAGE_LABEL.SF2} champ={champ} />
      <KnockoutCard match={third} title="3º lugar" highlight="bronze" champ={champ} />
      <KnockoutCard match={final} title="Final" highlight="gold" champ={champ} />
    </div>
  );
}
