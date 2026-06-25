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

  const defaultSfPicks =
    standings.length >= 4
      ? {
          sf1Home: standings[0].teamId,
          sf1Away: standings[3].teamId,
          sf2Home: standings[1].teamId,
          sf2Away: standings[2].teamId,
        }
      : null;
  const [sfPicksOverride, setSfPicksOverride] = useState<typeof defaultSfPicks>(null);
  const sfPicks = sfPicksOverride ?? defaultSfPicks;

  function updateSfPick(key: "sf1Home" | "sf1Away" | "sf2Home" | "sf2Away", value: string) {
    setSfPicksOverride((prev) => ({ ...(prev ?? defaultSfPicks!), [key]: value }));
  }

  const sfPicksCustomized =
    sfPicksOverride !== null &&
    defaultSfPicks !== null &&
    (sfPicksOverride.sf1Home !== defaultSfPicks.sf1Home ||
      sfPicksOverride.sf1Away !== defaultSfPicks.sf1Away ||
      sfPicksOverride.sf2Home !== defaultSfPicks.sf2Home ||
      sfPicksOverride.sf2Away !== defaultSfPicks.sf2Away);

  const sfPicksValid =
    sfPicks !== null &&
    new Set([sfPicks.sf1Home, sfPicks.sf1Away, sfPicks.sf2Home, sfPicks.sf2Away]).size === 4;

  const rankByTeam = new Map(standings.map((s) => [s.teamId, s.rank]));

  const membersByTeam = new Map(teams.map((t) => [t.id, t.members.map((m) => ({ id: m.id, name: m.name }))]));
  const members = (teamId: string) => membersByTeam.get(teamId) ?? [];

  const firstUnfinishedGroup = groupMatches.find((m) => !m.finished);
  const [activeMatchId, setActiveMatchId] = useState<string | null>(
    firstUnfinishedGroup?.id ?? groupMatches[0]?.id ?? null,
  );

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
                isActive={activeMatchId === m.id}
                onActivate={() => setActiveMatchId(m.id)}
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
            (flags.allGroupFinished && sfPicks ? (
              <div className="mt-4 space-y-3">
                <h3 className="text-sm font-bold uppercase tracking-wide text-muted">
                  Chaves das semifinais
                </h3>
                <div className="card p-3 space-y-3">
                  {(
                    [
                      { label: "Semifinal 1", homeKey: "sf1Home", awayKey: "sf1Away" },
                      { label: "Semifinal 2", homeKey: "sf2Home", awayKey: "sf2Away" },
                    ] as const
                  ).map(({ label, homeKey, awayKey }) => (
                    <div key={label} className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold w-24 shrink-0">{label}</span>
                      <select
                        className="flex-1 min-w-0 rounded border border-border bg-surface px-2 py-1 text-sm"
                        value={sfPicks[homeKey]}
                        onChange={(e) => updateSfPick(homeKey, e.target.value)}
                      >
                        {teams.map((t) => (
                          <option key={t.id} value={t.id}>
                            {rankByTeam.get(t.id)}º · {t.label}
                          </option>
                        ))}
                      </select>
                      <span className="text-muted text-sm">×</span>
                      <select
                        className="flex-1 min-w-0 rounded border border-border bg-surface px-2 py-1 text-sm"
                        value={sfPicks[awayKey]}
                        onChange={(e) => updateSfPick(awayKey, e.target.value)}
                      >
                        {teams.map((t) => (
                          <option key={t.id} value={t.id}>
                            {rankByTeam.get(t.id)}º · {t.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                  {!sfPicksValid && (
                    <p className="text-xs text-danger">Cada time deve aparecer em apenas uma semifinal.</p>
                  )}
                  {sfPicksCustomized && (
                    <button
                      className="text-xs text-muted underline"
                      onClick={() => setSfPicksOverride(null)}
                    >
                      Restaurar ordem da classificação
                    </button>
                  )}
                </div>
                <button
                  className="btn btn-primary w-full"
                  disabled={pending || !sfPicksValid}
                  onClick={() =>
                    run(() =>
                      generateKnockouts(
                        championship.id,
                        sfPicksCustomized ? sfPicks : undefined,
                      ),
                    )
                  }
                >
                  🏟️ Gerar eliminatórias
                </button>
              </div>
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
