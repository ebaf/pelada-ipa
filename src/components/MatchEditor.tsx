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

export function MatchEditor({
  match,
  homeMembers,
  awayMembers,
  allPlayers,
  champ,
}: {
  match: MatchView;
  homeMembers: Member[];
  awayMembers: Member[];
  allPlayers: Member[];
  champ: { name: string | null; date: Date | string };
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
  const [hp, setHp] = useState(match.homePens?.toString() ?? "");
  const [ap, setAp] = useState(match.awayPens?.toString() ?? "");

  // --- estado do formulário de externo ---
  const [showExtForm, setShowExtForm] = useState(false);
  const [extPlayerId, setExtPlayerId] = useState("");
  const [extSide, setExtSide] = useState<"home" | "away">("home");

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
    setShowExtForm(false);
  }

  function openEdit(g: GoalView) {
    setEditingId(g.id);
    setSide(g.teamId === match.homeTeamId ? "home" : "away");
    setOwnGoal(g.isOwnGoal);
    setPenalty(g.isPenalty);
    setScorerId(g.scorerId ?? "");
    setAssistId(g.assistId ?? "");
    setShowForm(true);
    setShowExtForm(false);
  }

  function closeForm() {
    setShowForm(false);
    setEditingId(null);
    resetForm();
  }

  function openExtForm() {
    setExtPlayerId("");
    setExtSide("home");
    setShowExtForm(true);
    setShowForm(false);
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
    start(async () => {
      await setMatchFinished(match.id, !match.finished);
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

  function submitExternal() {
    if (!extPlayerId) return;
    const teamId = extSide === "home" ? match.homeTeamId : match.awayTeamId;
    start(async () => {
      await addMatchPlayer(match.id, extPlayerId, teamId);
      setShowExtForm(false);
      router.refresh();
    });
  }

  function removeExternal(playerId: string) {
    start(async () => {
      await removeMatchPlayer(match.id, playerId);
      router.refresh();
    });
  }

  // Renderiza um <select> com optgroups: membros do time primeiro, externos depois
  function ScorerSelect({
    options,
    teamLabel,
    value,
    onChange,
    emptyLabel,
  }: {
    options: MemberWithFlag[];
    teamLabel: string;
    value: string;
    onChange: (v: string) => void;
    emptyLabel: string;
  }) {
    const team = options.filter((m) => !m.isExternal);
    const ext = options.filter((m) => m.isExternal);
    return (
      <select className="select" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">{emptyLabel}</option>
        {team.length > 0 && (
          <optgroup label={`Time ${teamLabel}`}>
            {team.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </optgroup>
        )}
        {ext.length > 0 && (
          <optgroup label="Externos">
            {ext.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </optgroup>
        )}
      </select>
    );
  }

  const benefitLabel = side === "home" ? match.homeLabel : match.awayLabel;
  const concedeLabel = side === "home" ? match.awayLabel : match.homeLabel;

  return (
    <div className={`card p-4 ${match.finished ? "" : "border-dashed"}`}>
      {/* Cabeçalho */}
      <div className="mb-1 flex items-center justify-between">
        <span className="chip">
          {isKnockout ? STAGE_LABEL[match.stage] : `Rodada ${match.round}`}
        </span>
        {match.finished ? (
          <span className="chip border-primary/40 text-primary">✓ Encerrada</span>
        ) : (
          <span className="chip">Em aberto</span>
        )}
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
      {isKnockout && tied && (
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
            <ScorerSelect
              options={scorerOptions}
              teamLabel={isOwnGoal ? concedeLabel : benefitLabel}
              value={scorerId}
              onChange={setScorerId}
              emptyLabel="— sem autor —"
            />
          </div>

          {!isOwnGoal && (
            <div>
              <div className="label">Assistência (opcional)</div>
              <ScorerSelect
                options={benefitMembers.filter((m) => m.id !== scorerId)}
                teamLabel={benefitLabel}
                value={assistId}
                onChange={setAssistId}
                emptyLabel="— sem assistência —"
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
      ) : showExtForm ? (
        /* Formulário de jogador externo */
        <div className="mt-3 card-2 space-y-3 p-3">
          <div className="text-sm font-bold">👤 Jogador externo / substituto</div>

          <div>
            <div className="label">Jogador</div>
            <select
              className="select"
              value={extPlayerId}
              onChange={(e) => setExtPlayerId(e.target.value)}
            >
              <option value="">— selecione —</option>
              {availableExternals.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="label">Joga pelo time</div>
            <div className="grid grid-cols-2 gap-2">
              {(["home", "away"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setExtSide(s)}
                  className={`btn btn-sm ${extSide === s ? "btn-primary" : "btn-ghost"}`}
                >
                  Time {s === "home" ? match.homeLabel : match.awayLabel}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-2">
            <button
              className="btn btn-primary flex-1"
              onClick={submitExternal}
              disabled={pending || !extPlayerId}
            >
              Adicionar
            </button>
            <button className="btn btn-ghost" onClick={() => setShowExtForm(false)}>
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          <button className="btn btn-ghost btn-sm" onClick={openAdd} disabled={pending}>
            ⚽ Adicionar gol
          </button>
          <button className="btn btn-ghost btn-sm" onClick={openExtForm} disabled={pending}>
            👤 Externo
          </button>
          {match.finished && (
            <ShareMatchButton text={formatMatchForWhatsApp(match, champ)} />
          )}
          <button
            className={`btn btn-sm ${match.finished ? "btn-ghost" : "btn-primary"} ml-auto`}
            onClick={toggleFinished}
            disabled={pending || (!match.finished && isKnockout && !decided)}
            title={
              !match.finished && isKnockout && !decided
                ? "Defina o vencedor (gols ou pênaltis)"
                : undefined
            }
          >
            {match.finished ? "Reabrir" : "Encerrar partida"}
          </button>
        </div>
      )}
    </div>
  );
}
