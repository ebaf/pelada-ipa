"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createPlayer } from "@/lib/actions";
import { RankedPlayer } from "@/lib/queries";
import { formatNota } from "@/lib/format";
import { Medal } from "@/components/TeamBadge";
import { PlayerStatsLine } from "@/components/PlayerStatsLine";

const DIACRITICS = new RegExp("[\\u0300-\\u036f]", "g");
const normalize = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(DIACRITICS, "");

export function PlayersScreen({ players }: { players: RankedPlayer[] }) {
  const [name, setName] = useState("");
  const [q, setQ] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  function add(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setErr(null);
    start(async () => {
      const res = await createPlayer(name);
      if (res?.error) setErr(res.error);
      else {
        setName("");
        router.refresh();
      }
    });
  }

  const filtered = q
    ? players.filter((p) => normalize(p.name).includes(normalize(q)))
    : players;

  return (
    <div className="space-y-5">
      <form onSubmit={add} className="card p-4">
        <label className="label" htmlFor="new-player">
          Cadastrar jogador
        </label>
        <div className="flex gap-2">
          <input
            id="new-player"
            className="input"
            placeholder="Nome do jogador"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="off"
          />
          <button className="btn btn-primary shrink-0" disabled={pending || !name.trim()}>
            Adicionar
          </button>
        </div>
        {err && <p className="mt-2 text-sm text-danger">{err}</p>}
      </form>

      {players.length > 6 && (
        <input
          className="input"
          placeholder="🔎 Buscar jogador..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      )}

      <div className="card overflow-hidden">
        {filtered.length === 0 ? (
          <p className="px-4 py-6 text-center text-muted">
            {players.length === 0 ? "Nenhum jogador cadastrado." : "Nada encontrado."}
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {filtered.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/jogadores/${p.id}`}
                  className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-2"
                >
                  <span className="w-7 shrink-0 text-center text-lg font-bold">
                    <Medal rank={p.rank} />
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
        )}
      </div>
    </div>
  );
}
