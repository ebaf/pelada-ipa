import Link from "next/link";
import { listChampionships, getHomeRanking } from "@/lib/queries";
import { formatDate } from "@/lib/format";
import { RankingTable } from "@/components/RankingTable";
import { TeamBadge } from "@/components/TeamBadge";
import { NotaInfo } from "@/components/NotaInfo";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [championships, ranking] = await Promise.all([
    listChampionships(),
    getHomeRanking(),
  ]);

  return (
    <div className="space-y-8">
      <section className="card relative overflow-hidden p-5">
        <div className="relative z-10">
          <h1 className="text-2xl font-extrabold">Pelada IPA</h1>
          <p className="mt-1 text-sm text-muted">
            {championships.length} {championships.length === 1 ? "pelada" : "peladas"} ·{" "}
            {ranking.length} jogadores
          </p>
          <Link href="/peladas/nova" className="btn btn-primary mt-4">
            + Nova pelada
          </Link>
        </div>
        <div className="pointer-events-none absolute -right-6 -top-6 text-[120px] opacity-10">
          ⚽
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-end justify-between">
          <h2 className="text-lg font-bold">Peladas</h2>
        </div>
        {championships.length === 0 ? (
          <div className="card p-6 text-center text-muted">
            Nenhuma pelada cadastrada.{" "}
            <Link href="/peladas/nova" className="text-primary underline">
              Criar a primeira
            </Link>
            .
          </div>
        ) : (
          <ul className="space-y-2.5">
            {championships.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/peladas/${c.id}`}
                  className="card flex items-center gap-3 p-4 transition-colors hover:bg-surface-2"
                >
                  <div className="flex-1">
                    <div className="font-semibold capitalize">
                      {c.name || formatDate(c.date)}
                    </div>
                    {c.name && (
                      <div className="text-xs capitalize text-muted">
                        {formatDate(c.date)}
                      </div>
                    )}
                    <div className="mt-1.5">
                      {c.champion ? (
                        <span className="inline-flex items-center gap-1.5 text-sm">
                          <span>🏆</span> Campeão:{" "}
                          <TeamBadge label={c.champion} className="!h-5 !w-5 text-[11px]" />
                          <span className="font-semibold">Time {c.champion}</span>
                        </span>
                      ) : c.finalUndecided ? (
                        <span className="chip border-gold/40 text-gold">
                          🏁 Pênaltis pendentes
                        </span>
                      ) : (
                        <span className="chip">
                          {c.finishedCount}/{c.matchCount || 10} jogos
                        </span>
                      )}
                    </div>
                  </div>
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className="text-muted"
                  >
                    <path d="m9 6 6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <div className="mb-3 flex items-end justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold">Ranking geral</h2>
            <NotaInfo />
          </div>
          <Link href="/jogadores" className="text-sm font-semibold text-primary">
            Ver todos
          </Link>
        </div>
        <div className="card overflow-hidden">
          <RankingTable players={ranking} limit={10} showDelta />
        </div>
        <p className="mt-2 px-1 text-xs text-muted">
          ▲▼ = variação de posição após a última pelada.
        </p>
      </section>
    </div>
  );
}
