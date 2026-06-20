import { MatchView } from "@/lib/queries";
import { TeamBadge } from "./TeamBadge";
import { ShareMatchButton } from "./ShareMatchButton";
import { STAGE_LABEL } from "@/lib/format";
import { formatMatchForWhatsApp } from "@/lib/share";

type Champ = { name: string | null; date: Date | string };

function Side({
  label,
  teamId,
  score,
  pens,
  showPens,
  winnerTeamId,
  finished,
}: {
  label: string;
  teamId: string;
  score: number;
  pens: number | null;
  showPens: boolean;
  winnerTeamId: string | null;
  finished: boolean;
}) {
  const isWinner = finished && winnerTeamId === teamId;
  const isLoser = finished && winnerTeamId !== null && winnerTeamId !== teamId;
  return (
    <div
      className={`flex items-center gap-2 px-3 py-2 ${
        isLoser ? "opacity-55" : ""
      }`}
    >
      <TeamBadge label={label} className="!h-6 !w-6 text-xs" />
      <span className={`flex-1 text-sm ${isWinner ? "font-bold" : "font-medium"}`}>
        Time {label}
      </span>
      {showPens && (
        <span className="text-xs text-muted tabular-nums">({pens ?? 0} pên)</span>
      )}
      <span
        className={`w-6 text-center text-lg tabular-nums ${
          isWinner ? "font-extrabold text-primary" : "font-semibold"
        }`}
      >
        {finished || score > 0 ? score : "–"}
      </span>
    </div>
  );
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
  return (
    <div className="flex-1">
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
      <div className={`card-2 divide-y divide-border overflow-hidden ${border}`}>
        {match ? (
          <>
            <Side
              label={match.homeLabel}
              teamId={match.homeTeamId}
              score={match.homeScore}
              pens={match.homePens}
              showPens={match.homeScore === match.awayScore}
              winnerTeamId={match.winnerTeamId}
              finished={match.finished}
            />
            <Side
              label={match.awayLabel}
              teamId={match.awayTeamId}
              score={match.awayScore}
              pens={match.awayPens}
              showPens={match.homeScore === match.awayScore}
              winnerTeamId={match.winnerTeamId}
              finished={match.finished}
            />
          </>
        ) : (
          <div className="px-3 py-4 text-center text-sm text-muted">A definir</div>
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
      <div className="flex gap-3">
        <KnockoutCard match={sf1} title={STAGE_LABEL.SF1} champ={champ} />
        <KnockoutCard match={sf2} title={STAGE_LABEL.SF2} champ={champ} />
      </div>
      <div className="flex gap-3">
        <KnockoutCard match={final} title="Final" highlight="gold" champ={champ} />
        <KnockoutCard match={third} title="3º lugar" highlight="bronze" champ={champ} />
      </div>
    </div>
  );
}
