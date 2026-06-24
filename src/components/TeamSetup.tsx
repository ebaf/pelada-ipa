"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveTeams, RosterInput } from "@/lib/actions";
import { TeamBadge } from "@/components/TeamBadge";
import { TEAM_LABELS } from "@/lib/format";

type Player = { id: string; name: string };
type TeamData = {
  label: string;
  flagUrl: string | null;
  crestUrl: string | null;
  members: { id: string; name: string }[];
};

export function TeamSetup({
  championshipId,
  teams,
  allPlayers,
  locked,
}: {
  championshipId: string;
  teams: TeamData[];
  allPlayers: Player[];
  locked: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(!locked);
  const [editing, setEditing] = useState<string | null>(null);

  const byLabel = new Map(teams.map((t) => [t.label, t]));
  const [rosters, setRosters] = useState<Record<string, string[]>>(() => {
    const init: Record<string, string[]> = {};
    for (const l of TEAM_LABELS) init[l] = (byLabel.get(l)?.members ?? []).map((m) => m.id);
    return init;
  });
  const [crests, setCrests] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const l of TEAM_LABELS) init[l] = byLabel.get(l)?.crestUrl ?? "";
    return init;
  });

  const nameById = new Map(allPlayers.map((p) => [p.id, p.name]));
  const assigned = new Set(Object.values(rosters).flat());

  function add(label: string, playerId: string) {
    if (!playerId) return;
    setRosters((r) => ({ ...r, [label]: [...r[label], playerId] }));
  }
  function remove(label: string, playerId: string) {
    setRosters((r) => ({ ...r, [label]: r[label].filter((id) => id !== playerId) }));
  }

  function save() {
    const payload: RosterInput[] = TEAM_LABELS.map((label) => ({
      label,
      crestUrl: crests[label] || null,
      playerIds: rosters[label],
    }));
    start(async () => {
      await saveTeams(championshipId, payload);
      router.refresh();
      if (locked) setOpen(false);
    });
  }

  const totalAssigned = assigned.size;

  if (locked && !open) {
    return (
      <div className="card p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-semibold">Times definidos</div>
            <div className="text-xs text-muted">{totalAssigned} jogadores escalados</div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={() => setOpen(true)}>
            Editar times
          </button>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {TEAM_LABELS.map((l) => (
            <div key={l} className="card-2 p-2.5">
              <div className="mb-1 flex items-center gap-2">
                <TeamBadge label={l} className="!h-5 !w-5 text-[10px]" />
                <span className="text-sm font-semibold">Time {l}</span>
              </div>
              <ul className="space-y-0.5 text-xs text-muted">
                {rosters[l].map((id) => (
                  <li key={id} className="truncate">
                    {nameById.get(id)}
                  </li>
                ))}
                {rosters[l].length === 0 && <li className="italic">vazio</li>}
              </ul>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {TEAM_LABELS.map((label) => {
        const isEditing = editing === label;
        const available = allPlayers.filter((p) => !assigned.has(p.id));
        return (
          <div key={label} className="card p-4">
            <div className="mb-2 flex items-center gap-2">
              <TeamBadge label={label} />
              <span className="font-bold">Time {label}</span>
              <span className="chip ml-auto">{rosters[label].length} jog.</span>
            </div>

            <div className="mb-2 flex flex-wrap gap-1.5">
              {rosters[label].map((id) => (
                <span
                  key={id}
                  className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-2.5 py-1 text-sm"
                >
                  {nameById.get(id)}
                  <button
                    onClick={() => remove(label, id)}
                    className="text-muted hover:text-danger"
                    aria-label="Remover"
                  >
                    ✕
                  </button>
                </span>
              ))}
              {rosters[label].length === 0 && (
                <span className="text-sm text-muted">Nenhum jogador.</span>
              )}
            </div>

            {!isEditing && (
              <button
                className="btn btn-ghost btn-sm w-full"
                onClick={() => setEditing(label)}
                disabled={available.length === 0}
              >
                + Adicionar jogadores
              </button>
            )}

            {isEditing && (
              <div className="mt-1">
                <div className="mb-1.5 flex items-center justify-between">
                  <p className="text-xs text-muted">Toque para adicionar:</p>
                  <button className="text-xs text-muted underline" onClick={() => setEditing(null)}>
                    Fechar
                  </button>
                </div>
                <div className="divide-y divide-border rounded-lg border border-border">
                  {available.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => add(label, p.id)}
                      className="flex w-full items-center px-3 py-2.5 text-sm hover:bg-surface-2 active:bg-surface-2 first:rounded-t-lg last:rounded-b-lg"
                    >
                      <span className="mr-2 text-muted">+</span>
                      {p.name}
                    </button>
                  ))}
                  {available.length === 0 && (
                    <p className="px-3 py-2.5 text-sm text-muted">Todos os jogadores escalados.</p>
                  )}
                </div>
              </div>
            )}

            <details className="mt-2">
              <summary className="cursor-pointer text-xs text-muted">Escudo (URL)</summary>
              <input
                className="input mt-2 text-sm"
                placeholder="https://..."
                value={crests[label]}
                onChange={(e) => setCrests((c) => ({ ...c, [label]: e.target.value }))}
              />
            </details>
          </div>
        );
      })}

      <button className="btn btn-primary w-full" onClick={save} disabled={pending}>
        {pending ? "Salvando..." : "Salvar times"}
      </button>
      {!locked && (
        <p className="text-center text-xs text-muted">
          Ao salvar pela primeira vez, as 6 partidas da fase de grupos são criadas.
        </p>
      )}
    </div>
  );
}
