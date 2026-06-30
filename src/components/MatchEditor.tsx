"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MatchView, GoalView } from "@/lib/queries";
import {
  addGoal,
  editGoal,
  deleteGoal,
  setMatchFinished,
  setPens,
  addMatchPlayer,
  removeMatchPlayer,
} from "@/lib/actions";
import { TeamBadge } from "@/components/TeamBadge";
import { ShareMatchButton } from "@/components/ShareMatchButton";
import { STAGE_LABEL } from "@/lib/format";
import { formatMatchForWhatsApp } from "@/lib/share";

type Member = { id: string; name: string };
type MemberWithFlag = Member & { isExternal: boolean };

function PlayerPicker({
  options,
  value,
  onChange,
  emptyLabel,
  availableExternals = [],
  onAddExternal,
}: {
  options: MemberWithFlag[];
  value: string;
  onChange: (v: string) => void;
  emptyLabel: string;
  availableExternals?: Member[];
  onAddExternal?: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [showExternals, setShowExternals] = useState(false);
  // Optimistic chip: if value isn't in options yet (external just added, pending refresh),
  // fall back to availableExternals so the chip shows immediately.
  const selected =
    options.find((m) => m.id === value) ??
    (availableExternals.find((m) => m.id === value)
      ? { id: value, name: availableExternals.find((m) => m.id === value)!.name, isExternal: true }
      : null);
  const team = options.filter((m) => !m.isExternal);
  const ext = options.filter((m) => m.isExternal);

  function pick(id: string) {
    onChange(id);
    setOpen(false);
    setShowExternals(false);
  }

  function pickExternal(id: string) {
    onChange(id);
    onAddExternal?.(id);
    setOpen(false);
    setShowExternals(false);
  }

  return (
    <div>
      {selected ? (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-2.5 py-1 text-sm">
          {selected.name}
          {selected.isExternal && <span className="text-[10px] text-muted">ext</span>}
          <button
            type="button"
            onClick={() => { onChange(""); setOpen(false); }}
            className="text-muted hover:text-danger"
            aria-label="Remover"
          >
            ✕
          </button>
        </span>
      ) : (
        <button
          type="button"
          className="btn btn-ghost btn-sm w-full"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? "Fechar" : `+ ${emptyLabel}`}
        </button>
      )}

      {!selected && open && (
        <div className="mt-1.5 divide-y divide-border rounded-lg border border-border">
          {team.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => pick(m.id)}
              className="flex w-full items-center px-3 py-2.5 text-sm hover:bg-surface-2 active:bg-surface-2 first:rounded-t-lg last:rounded-b-lg"
            >
              <span className="mr-2 text-muted">+</span>
              {m.name}
            </button>
          ))}
          {ext.length > 0 && (
            <>
              <div className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted">
                Externos
              </div>
              {ext.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => pick(m.id)}
                  className="flex w-full items-center px-3 py-2.5 text-sm hover:bg-surface-2 active:bg-surface-2 first:rounded-t-lg last:rounded-b-lg"
                >
                  <span className="mr-2 text-muted">+</span>
                  {m.name}
                </button>
              ))}
            </>
          )}
          {availableExternals.length > 0 && (
            <>
              <button
                type="button"
                onClick={() => setShowExternals((v) => !v)}
                className="flex w-full items-center justify-between px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted hover:bg-surface-2"
              >
                Adicionar externo
                <span>{showExternals ? "▲" : "▼"}</span>
              </button>
              {showExternals && availableExternals.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => pickExternal(m.id)}
                  className="flex w-full items-center px-3 py-2.5 text-sm hover:bg-surface-2 active:bg-surface-2 last:rounded-b-lg"
                >
                  <span className="mr-2 text-muted">+</span>
                  {m.name}
                </button>
              ))}
            </>
          )}
          {options.length === 0 && availableExternals.length === 0 && (
            <div className="px-3 py-2.5 text-sm italic text-muted">
              Nenhum jogador disponível.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function MatchEditor({
  match,
  homeMembers,
  awayMembers,
  allPlayers,
  champ,
  isActive,
  onActivate,
  onClose,
}: {
  match: MatchView;
  homeMembers: Member[];
  awayMembers: Member[];
  allPlayers: Member[];
  champ: { name: string | null; date: Date | string };
  isActive?: boolean;
  onActivate?: () => void;
  onClose?: () => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  // --- estado do formulário de gol ---
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [side, setSide] = useState<"home" | "away">("home");
  const [isOwnGoal, setOwnGoal] = useState(false);
  const [isPenalty, setPenalty] = useState(false);
  const [scorerId, setScorerId] = useState("");
  const [assistId, setAssistId] = useState("");

  // --- estado da disputa de pênaltis ---
  const [showPens, setShowPens] = useState(match.homePens !== null);
  const [hp, setHp] = useState(match.homePens?.toString() ?? "");
  const [ap, setAp] = useState(match.awayPens?.toString() ?? "");

  const isKnockout = match.stage !== "GROUP";
  const tied = match.homeScore === match.awayScore;
  const decided =
    match.homeScore !== match.awayScore ||
    (match.homePens ?? 0) !== (match.awayPens ?? 0);

  // Externos desta partida, separados por lado
  const extHome: MemberWithFlag[] = match.matchPlayers
    .filter((mp) => mp.teamId === match.homeTeamId)
    .map((mp) => ({ id: mp.playerId, name: mp.playerName, isExternal: true }));
  const extAway: MemberWithFlag[] = match.matchPlayers
    .filter((mp) => mp.teamId === match.awayTeamId)
    .map((mp) => ({ id: mp.playerId, name: mp.playerName, isExternal: true }));

  const homeMembersAll: MemberWithFlag[] = [
    ...homeMembers.map((m) => ({ ...m, isExternal: false })),
    ...extHome,
  ];
  const awayMembersAll: MemberWithFlag[] = [
    ...awayMembers.map((m) => ({ ...m, isExternal: false })),
    ...extAway,
  ];

  const benefitMembers = side === "home" ? homeMembersAll : awayMembersAll;
  const concedeMembers = side === "home" ? awayMembersAll : homeMembersAll;
  const scorerOptions = isOwnGoal ? concedeMembers : benefitMembers;

  // Jogadores disponíveis para adicionar como externos (não estão em nenhum dos times)
  const alreadyInMatch = new Set([
    ...homeMembers.map((m) => m.id),
    ...awayMembers.map((m) => m.id),
    ...match.matchPlayers.map((mp) => mp.playerId),
  ]);
  const availableExternals = allPlayers
    .filter((p) => !alreadyInMatch.has(p.id))
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

  function resetForm() {
    setScorerId("");
    setAssistId("");
    setOwnGoal(false);
    setPenalty(false);
  }

  function openAdd() {
    setEditingId(null);
    setSide("home");
    resetForm();
    setShowForm(true);
  }

  function openEdit(g: GoalView) {
    setEditingId(g.id);
    setSide(g.teamId === match.homeTeamId ? "home" : "away");
    setOwnGoal(g.isOwnGoal);
    setPenalty(g.isPenalty);
    setScorerId(g.scorerId ?? "");
    setAssistId(g.assistId ?? "");
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingId(null);
    resetForm();
  }

  function submitGoal() {
    const payload = {
      teamId: side === "home" ? match.homeTeamId : match.awayTeamId,
      scorerId: scorerId || null,
      assistId: isOwnGoal ? null : assistId || null,
      isOwnGoal,
      isPenalty,
    };
    start(async () => {
      if (editingId) await editGoal(editingId, payload);
      else await addGoal({ matchId: match.id, ...payload });
      closeForm();
      router.refresh();
    });
  }

  function removeGoal(id: string) {
    start(async () => {
      await deleteGoal(id);
      router.refresh();
    });
  }

  function toggleFinished() {
    const wasFinished = match.finished;
    start(async () => {
      await setMatchFinished(match.id, !wasFinished);
      if (!wasFinished) onClose?.();
      router.refresh();
    });
  }

  function savePens() {
    start(async () => {
      await setPens(
        match.id,
        hp === "" ? null : Number(hp),
        ap === "" ? null : Number(ap),
      );
      router.refresh();
    });
  }

  function addExternal(playerId: string, teamId: string) {
    start(async () => {
      await addMatchPlayer(match.id, playerId, teamId);
      router.refresh();
    });
  }

  function removeExternal(playerId: string) {
    start(async () => {
      await removeMatchPlayer(match.id, playerId);
      router.refresh();
    });
  }

  const benefitLabel = side === "home" ? match.homeLabel : match.awayLabel;
  const concedeLabel = side === "home" ? match.awayLabel : match.homeLabel;
  const benefitTeamId = side === "home" ? match.homeTeamId : match.awayTeamId;
  const concedeTeamId = side === "home" ? match.awayTeamId : match.homeTeamId;
  const scorerTeamId = isOwnGoal ? concedeTeamId : benefitTeamId;

  if (isActive === false) {
    return (
      <div className="card">
        <button
          onClick={() => {
            if (match.finished) toggleFinished();
            onActivate?.();
          }}
          className="flex w-full items-center gap-2 p-3 text-left opacity-50 transition-opacity hover:opacity-100"
        >
          <span className="chip shrink-0 text-xs">
            {isKnockout ? STAGE_LABEL[match.stage] : `FG${match.round}`}
          </span>
          <div className="flex flex-1 items-center justify-center gap-2">
            <span className="flex items-center gap-1 text-sm font-semibold">
              Time {match.homeLabel}
              <TeamBadge label={match.homeLabel} className="!h-5 !w-5 text-[10px]" />
            </span>
            <span className="rounded-md bg-bg px-2 py-0.5 text-base font-extrabold tabular-nums">
              {match.homeScore} : {match.awayScore}
            </span>
            <span className="flex items-center gap-1 text-sm font-semibold">
              <TeamBadge label={match.awayLabel} className="!h-5 !w-5 text-[10px]" />
              Time {match.awayLabel}
            </span>
          </div>
          {match.finished && (
            <span className="chip shrink-0 border-primary/40 text-primary text-xs !p-0">✓</span>
          )}
        </button>
        {match.finished && (
          <div className="border-t border-border px-3 pb-2 pt-1.5">
            <ShareMatchButton text={formatMatchForWhatsApp(match, champ)} />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="card border-dashed p-4">
      {/* Cabeçalho */}
      <div className="mb-1">
        <span className="chip">
          {isKnockout ? STAGE_LABEL[match.stage] : `FG${match.round}`}
        </span>
      </div>

      <div className="flex items-center justify-center gap-3 py-1">
        <span className="flex flex-1 items-center justify-end gap-2 font-semibold">
          Time {match.homeLabel}
          <TeamBadge label={match.homeLabel} className="!h-6 !w-6 text-xs" />
        </span>
        <span className="rounded-lg bg-bg px-3 py-1 text-xl font-extrabold tabular-nums">
          {match.homeScore} : {match.awayScore}
        </span>
        <span className="flex flex-1 items-center gap-2 font-semibold">
          <TeamBadge label={match.awayLabel} className="!h-6 !w-6 text-xs" />
          Time {match.awayLabel}
        </span>
      </div>

      {/* Gols registrados */}
      {match.goals.length > 0 && (
        <ul className="mt-2 space-y-1">
          {match.goals.map((g) => (
            <li
              key={g.id}
              className="flex items-center gap-2 rounded-lg bg-surface-2 px-2.5 py-1.5 text-sm"
            >
              <TeamBadge
                label={g.teamId === match.homeTeamId ? match.homeLabel : match.awayLabel}
                className="!h-5 !w-5 text-[10px]"
              />
              <span className="flex-1">
                {g.scorerName ?? "Sem autor"}
                {g.assistName && <span className="text-muted"> · 🅰 {g.assistName}</span>}
                {g.isOwnGoal && <span className="ml-1 text-danger">(🤦 contra)</span>}
                {g.isPenalty && <span className="ml-1 text-muted">(pênalti)</span>}
              </span>
              <button
                onClick={() => openEdit(g)}
                className="px-1 text-muted hover:text-fg"
                aria-label="Editar gol"
                disabled={pending}
              >
                ✎
              </button>
              <button
                onClick={() => removeGoal(g.id)}
                className="px-1 text-muted hover:text-danger"
                aria-label="Remover gol"
                disabled={pending}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Externos desta partida */}
      {match.matchPlayers.length > 0 && (
        <div className="mt-2 space-y-1">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-muted">
            Substitutos / externos
          </div>
          {match.matchPlayers.map((mp) => {
            const label = mp.teamId === match.homeTeamId ? match.homeLabel : match.awayLabel;
            return (
              <div
                key={mp.id}
                className="flex items-center gap-2 rounded-lg bg-surface-2 px-2.5 py-1.5 text-sm"
              >
                <TeamBadge label={label} className="!h-5 !w-5 text-[10px]" />
                <span className="flex-1">{mp.playerName}</span>
                <span className="text-xs text-muted">externo</span>
                <button
                  onClick={() => removeExternal(mp.playerId)}
                  className="px-1 text-muted hover:text-danger"
                  aria-label="Remover externo"
                  disabled={pending}
                >
                  ✕
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Pênaltis (eliminatórias empatadas) */}
      {isKnockout && tied && showPens && (
        <div className="mt-3 card-2 p-3">
          <div className="label">Disputa de pênaltis</div>
          <div className="flex items-center justify-center gap-2">
            <span className="text-sm font-semibold">Time {match.homeLabel}</span>
            <input
              type="number"
              min={0}
              inputMode="numeric"
              className="input !w-16 text-center"
              value={hp}
              onChange={(e) => setHp(e.target.value)}
              onBlur={savePens}
            />
            <span className="text-muted">x</span>
            <input
              type="number"
              min={0}
              inputMode="numeric"
              className="input !w-16 text-center"
              value={ap}
              onChange={(e) => setAp(e.target.value)}
              onBlur={savePens}
            />
            <span className="text-sm font-semibold">Time {match.awayLabel}</span>
          </div>
        </div>
      )}

      {/* Formulário de gol */}
      {showForm ? (
        <div className="mt-3 card-2 space-y-3 p-3">
          <div className="text-sm font-bold">
            {editingId ? "✎ Editar gol" : "⚽ Novo gol"}
          </div>
          <div>
            <div className="label">Marcou para</div>
            <div className="grid grid-cols-2 gap-2">
              {(["home", "away"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => { setSide(s); resetForm(); }}
                  className={`btn btn-sm ${side === s ? "btn-primary" : "btn-ghost"}`}
                >
                  Time {s === "home" ? match.homeLabel : match.awayLabel}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={isOwnGoal}
                onChange={(e) => {
                  setOwnGoal(e.target.checked);
                  if (e.target.checked) setPenalty(false);
                  setScorerId("");
                  setAssistId("");
                }}
              />
              Gol contra
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={isPenalty}
                disabled={isOwnGoal}
                onChange={(e) => setPenalty(e.target.checked)}
              />
              Pênalti
            </label>
          </div>

          <div>
            <div className="label">
              {isOwnGoal ? "Autor (gol contra)" : "Autor do gol"}
            </div>
            <PlayerPicker
              options={scorerOptions}
              value={scorerId}
              onChange={setScorerId}
              emptyLabel="sem autor"
              availableExternals={availableExternals}
              onAddExternal={(id) => addExternal(id, scorerTeamId)}
            />
          </div>

          {!isOwnGoal && (
            <div>
              <div className="label">Assistência (opcional)</div>
              <PlayerPicker
                options={benefitMembers.filter((m) => m.id !== scorerId)}
                value={assistId}
                onChange={setAssistId}
                emptyLabel="sem assistência"
                availableExternals={availableExternals.filter((p) => p.id !== scorerId)}
                onAddExternal={(id) => addExternal(id, benefitTeamId)}
              />
            </div>
          )}

          <div className="flex gap-2">
            <button className="btn btn-primary flex-1" onClick={submitGoal} disabled={pending}>
              {editingId ? "Salvar alterações" : "Salvar gol"}
            </button>
            <button className="btn btn-ghost" onClick={closeForm}>
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          <button className="btn btn-ghost btn-sm" onClick={openAdd} disabled={pending}>
            ⚽
          </button>
          {isKnockout && tied && (
            <button
              className={`btn btn-sm ${showPens ? "btn-primary" : "btn-ghost"}`}
              onClick={() => setShowPens((v) => !v)}
            >
              🥅 Pênaltis
            </button>
          )}
          <button
            className="btn btn-primary btn-sm ml-auto"
            onClick={toggleFinished}
            disabled={pending || (isKnockout && !decided)}
            title={
              isKnockout && !decided
                ? "Defina o vencedor (gols ou pênaltis)"
                : undefined
            }
          >
            Encerrar partida
          </button>
        </div>
      )}
    </div>
  );
}
