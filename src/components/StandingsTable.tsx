import { StandingRow } from "@/lib/standings";
import { TeamBadge } from "./TeamBadge";

export function StandingsTable({
  rows,
  qualifyHint = false,
}: {
  rows: StandingRow[];
  qualifyHint?: boolean;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs uppercase tracking-wide text-muted">
            <th className="px-2 py-2 text-left font-semibold">#</th>
            <th className="px-1 py-2 text-left font-semibold">Time</th>
            <th className="px-2 py-2 text-center font-semibold">P</th>
            <th className="px-2 py-2 text-center font-semibold">V</th>
            <th className="px-2 py-2 text-center font-semibold">E</th>
            <th className="px-2 py-2 text-center font-semibold">D</th>
            <th className="px-2 py-2 text-center font-semibold">GP</th>
            <th className="px-2 py-2 text-center font-semibold">GC</th>
            <th className="px-2 py-2 text-center font-semibold">SG</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.teamId} className="border-t border-border">
              <td className="px-2 py-2.5 font-bold tabular-nums">
                <span className="flex items-center gap-1.5">
                  {qualifyHint && (
                    <span
                      className={`inline-block h-2 w-2 rounded-full ${
                        r.rank <= 4 ? "bg-primary" : "bg-transparent"
                      }`}
                    />
                  )}
                  {r.rank}
                </span>
              </td>
              <td className="px-1 py-2.5">
                <span className="flex items-center gap-2">
                  <TeamBadge label={r.label} className="!h-6 !w-6 text-xs" />
                  <span className="font-semibold">Time {r.label}</span>
                </span>
              </td>
              <td className="px-2 py-2.5 text-center font-extrabold tabular-nums text-primary">
                {r.points}
              </td>
              <td className="px-2 py-2.5 text-center tabular-nums">{r.wins}</td>
              <td className="px-2 py-2.5 text-center tabular-nums">{r.draws}</td>
              <td className="px-2 py-2.5 text-center tabular-nums">{r.losses}</td>
              <td className="px-2 py-2.5 text-center tabular-nums text-muted">{r.goalsFor}</td>
              <td className="px-2 py-2.5 text-center tabular-nums text-muted">
                {r.goalsAgainst}
              </td>
              <td className="px-2 py-2.5 text-center font-semibold tabular-nums">
                {r.goalDiff > 0 ? `+${r.goalDiff}` : r.goalDiff}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
