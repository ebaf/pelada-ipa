import Link from "next/link";
import { notFound } from "next/navigation";
import { getPlayerView } from "@/lib/queries";
import { formatDate, formatNota } from "@/lib/format";
import { totalGoals, gamesPlayed } from "@/lib/rating";
import { TeamBadge } from "@/components/TeamBadge";
import { PlayerActions } from "@/components/PlayerActions";
import { NotaInfo } from "@/components/NotaInfo";
import { PlayerStatsLine } from "@/components/PlayerStatsLine";

export const dynamic = "force-dynamic";

function Stat({ label, value, accent }: { label: string; value: React.ReactNode; accent?: boolean }) {
  return (
    <div className="card-2 px-3 py-2.5 text-center">
      <div className={`text-2xl font-extrabold tabular-nums ${accent ? "text-primary" : ""}`}>
        {value}
      </div>
      <div className="mt-0.5 text-[11px] uppercase tracking-wide text-muted">{label}</div>
    </div>
  );
}

export default async function PlayerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getPlayerView(id);
  if (!data) notFound();

  const { player, totals, nota, rank, perChampionship } = data;
  const games = gamesPlayed(totals);

  return (
    <div className="space-y-6">
      <Link href="/jogadores" className="text-sm text-muted hover:text-fg">
        ← Jogadores
      </Link>

      <section className="card flex items-center gap-4 p-5">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-surface-2 text-2xl font-black">
          {player.name.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-extrabold">{player.name}</h1>
          <p className="text-sm text-muted">{rank}º no ranking geral</p>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-3xl font-black tabular-nums text-primary">{formatNota(nota)}</div>
          <div className="flex items-center justify-end gap-1 text-[10px] uppercase tracking-wide text-muted">
            nota <NotaInfo />
          </div>
        </div>
      </section>

      <section className="grid grid-cols-3 gap-2.5">
        <Stat label="Jogos" value={games} />
        <Stat label="Gols" value={totalGoals(totals)} accent />
        <Stat label="Assist." value={totals.assists} accent />
        <Stat label="Vitórias" value={totals.wins} />
        <Stat label="Empates" value={totals.draws} />
        <Stat label="Derrotas" value={totals.losses} />
        {totals.penaltyGoals > 0 && <Stat label="Pênaltis" value={totals.penaltyGoals} />}
        {totals.ownGoals > 0 && <Stat label="Gols contra" value={totals.ownGoals} />}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-bold">Por pelada</h2>
        {perChampionship.length === 0 ? (
          <p className="card p-5 text-center text-muted">
            Este jogador ainda não participou de nenhuma pelada.
          </p>
        ) : (
          <ul className="space-y-2">
            {perChampionship.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/peladas/${c.id}`}
                  className="card flex items-center gap-3 p-3.5 transition-colors hover:bg-surface-2"
                >
                  {c.teamLabel && <TeamBadge label={c.teamLabel} />}
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold">{c.name || formatDate(c.date)}</div>
                    <PlayerStatsLine t={c.totals} />
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="font-bold tabular-nums text-primary">{formatNota(c.nota)}</div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold">Gerenciar</h2>
        <PlayerActions id={player.id} name={player.name} />
      </section>
    </div>
  );
}
