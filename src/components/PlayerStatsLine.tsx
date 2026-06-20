import { PlayerTotals, gamesPlayed, totalGoals } from "@/lib/rating";

const Sep = () => <span className="text-border">•</span>;

/** Linha compacta de estatísticas: jogos, gols, assist., V/E/D e gols contra. */
export function PlayerStatsLine({ t }: { t: PlayerTotals }) {
  return (
    <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-muted">
      <span>{gamesPlayed(t)}j</span>
      <Sep />
      <span>
        <span className="font-semibold text-fg">{totalGoals(t)}</span>G
      </span>
      <span>
        <span className="font-semibold text-fg">{t.assists}</span>A
      </span>
      <Sep />
      <span className="text-primary">{t.wins}V</span>
      <span>{t.draws}E</span>
      <span>{t.losses}D</span>
      {t.ownGoals > 0 && (
        <>
          <Sep />
          <span className="text-danger">{t.ownGoals} GC</span>
        </>
      )}
    </div>
  );
}
