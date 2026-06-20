import Link from "next/link";
import { RankedPlayer, RankedPlayerWithDelta } from "@/lib/queries";
import { formatNota } from "@/lib/format";
import { Medal } from "./TeamBadge";
import { PlayerStatsLine } from "./PlayerStatsLine";

function Delta({ delta }: { delta: number | null | undefined }) {
  if (delta == null) return null;
  if (delta === 0) return <span className="text-[10px] text-muted">—</span>;
  const up = delta > 0;
  return (
    <span
      className={`text-[10px] font-bold leading-none tabular-nums ${
        up ? "text-primary" : "text-danger"
      }`}
      title={`${up ? "Subiu" : "Caiu"} ${Math.abs(delta)} posição(ões) na última pelada`}
    >
      {up ? "▲" : "▼"}
      {Math.abs(delta)}
    </span>
  );
}

export function RankingTable({
  players,
  limit,
  showDelta = false,
}: {
  players: (RankedPlayer | RankedPlayerWithDelta)[];
  limit?: number;
  showDelta?: boolean;
}) {
  const list = limit ? players.slice(0, limit) : players;
  if (list.length === 0) {
    return <p className="px-4 py-6 text-center text-muted">Nenhum jogador ainda.</p>;
  }
  return (
    <ul className="divide-y divide-border">
      {list.map((p) => (
        <li key={p.id}>
          <Link
            href={`/jogadores/${p.id}`}
            className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-2"
          >
            <span className="flex w-8 shrink-0 flex-col items-center gap-0.5">
              <span className="text-lg font-bold leading-none">
                <Medal rank={p.rank} />
              </span>
              {showDelta && <Delta delta={(p as RankedPlayerWithDelta).delta} />}
            </span>
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
  );
}
