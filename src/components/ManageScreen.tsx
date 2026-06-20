"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChampionshipView } from "@/lib/queries";
import {
  generateKnockouts,
  generateFinals,
  resetKnockouts,
  deleteChampionship,
} from "@/lib/actions";
import { TeamSetup } from "@/components/TeamSetup";
import { MatchEditor } from "@/components/MatchEditor";
import { StandingsTable } from "@/components/StandingsTable";
import {formatDate} from "@/lib/format";

type Player = { id: string; name: string };

export function ManageScreen({
  data,
  allPlayers,
}: {
  data: ChampionshipView;
  allPlayers: Player[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const { championship, teams, groupMatches, sf1, sf2, third, final, standings, flags } = data;

  const membersByTeam = new Map(teams.map((t) => [t.id, t.members.map((m) => ({ id: m.id, name: m.name }))]));
  const members = (teamId: string) => membersByTeam.get(teamId) ?? [];

  function run(
    fn: () => Promise<{ error?: string; ok?: boolean; id?: string } | void>,
    afterPush?: string,
  ) {
    setErr(null);
    start(async () => {
      const res = await fn();
      if (res && "error" in res && res.error) {
        setErr(res.error);
        return;
      }
      if (afterPush) router.push(afterPush);
      else router.refresh();
    });
  }

  const hasTeams = groupMatches.length > 0;

  return (
    <div className="space-y-7">
      <div className="flex items-start justify-between gap-3">
        <div>
          <Link href={`/peladas/${championship.id}`} className="text-sm text-muted hover:text-fg">
            ← Painel da pelada
          </Link>
          <h1 className="mt-1 text-2xl font-extrabold capitalize">
            Gerenciar · {championship.name || formatDate(championship.date)}
          </h1>
        </div>
      </div>

      {err && (
        <div className="card border-danger/40 bg-danger/10 p-3 text-sm text-danger">{err}</div>
      )}

      {/* Times */}
      <section>
        <h2 className="mb-3 text-lg font-bold">1 · Times</h2>
        <TeamSetup
          championshipId={championship.id}
          teams={teams}
          allPlayers={allPlayers}
          locked={hasTeams}
        />
      </section>

      {/* Fase de grupos */}
      {hasTeams && (
        <section>
          <h2 className="mb-3 text-lg font-bold">2 · Fase de grupos</h2>
          <div className="space-y-3">
            {groupMatches.map((m) => (
              <MatchEditor
                key={m.id}
                match={m}
                homeMembers={members(m.homeTeamId)}
                awayMembers={members(m.awayTeamId)}
                allPlayers={allPlayers}
                champ={championship}
              />
            ))}
          </div>

          <div className="mt-4">
            <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-muted">
              Classificação parcial
            </h3>
            <div className="card p-2">
              <StandingsTable rows={standings} qualifyHint />
            </div>
          </div>

          {!flags.hasKnockouts &&
            (flags.allGroupFinished ? (
              <button
                className="btn btn-primary mt-4 w-full"
                disabled={pending}
                onClick={() => run(() => generateKnockouts(championship.id))}
              >
                🏟️ Gerar eliminatórias (1º×4º, 2º×3º)
              </button>
            ) : (
              <p className="mt-4 text-center text-sm text-muted">
                Encerre as 6 partidas da fase de grupos para gerar as eliminatórias.
              </p>
            ))}
        </section>
      )}

      {/* Eliminatórias */}
      {flags.hasKnockouts && (
        <section>
          <h2 className="mb-3 text-lg font-bold">3 · Eliminatórias</h2>
          <div className="space-y-3">
            {sf1 && (
              <MatchEditor
                match={sf1}
                homeMembers={members(sf1.homeTeamId)}
                awayMembers={members(sf1.awayTeamId)}
                allPlayers={allPlayers}
                champ={championship}
              />
            )}
            {sf2 && (
              <MatchEditor
                match={sf2}
                homeMembers={members(sf2.homeTeamId)}
                awayMembers={members(sf2.awayTeamId)}
                allPlayers={allPlayers}
                champ={championship}
              />
            )}
          </div>

          {!flags.hasFinals &&
            (flags.semisFinished ? (
              <button
                className="btn btn-primary mt-4 w-full"
                disabled={pending}
                onClick={() => run(() => generateFinals(championship.id))}
              >
                🏆 Gerar final e disputa de 3º
              </button>
            ) : (
              <p className="mt-4 text-center text-sm text-muted">
                Encerre as duas semifinais para gerar a final.
              </p>
            ))}

          {flags.hasFinals && (
            <div className="mt-3 space-y-3">
              {third && (
                <MatchEditor
                  match={third}
                  homeMembers={members(third.homeTeamId)}
                  awayMembers={members(third.awayTeamId)}
                  allPlayers={allPlayers}
                  champ={championship}
                />
              )}
              {final && (
                <MatchEditor
                  match={final}
                  homeMembers={members(final.homeTeamId)}
                  awayMembers={members(final.awayTeamId)}
                  allPlayers={allPlayers}
                  champ={championship}
                />
              )}
            </div>
          )}

          <button
            className="btn btn-danger btn-sm mt-4"
            disabled={pending}
            onClick={() => {
              if (confirm("Apagar todas as eliminatórias desta pelada?"))
                run(() => resetKnockouts(championship.id));
            }}
          >
            Refazer eliminatórias
          </button>
        </section>
      )}

      {/* Zona de perigo */}
      <section className="border-t border-border pt-5">
        <button
          className="btn btn-danger"
          disabled={pending}
          onClick={() => {
            if (confirm("Excluir esta pelada e todos os seus dados? Esta ação não pode ser desfeita."))
              run(() => deleteChampionship(championship.id), "/");
          }}
        >
          🗑 Excluir pelada
        </button>
      </section>
    </div>
  );
}
