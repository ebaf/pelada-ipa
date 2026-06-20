"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { renamePlayer, deletePlayer } from "@/lib/actions";

export function PlayerActions({ id, name }: { id: string; name: string }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  function save() {
    setErr(null);
    start(async () => {
      const r = await renamePlayer(id, value);
      if (r?.error) setErr(r.error);
      else {
        setEditing(false);
        router.refresh();
      }
    });
  }

  function remove() {
    if (
      !confirm(
        "Excluir este jogador? As estatísticas já registradas em partidas serão desvinculadas.",
      )
    )
      return;
    start(async () => {
      await deletePlayer(id);
      router.push("/jogadores");
    });
  }

  if (editing) {
    return (
      <div className="card p-4">
        <label className="label">Renomear jogador</label>
        <div className="flex gap-2">
          <input
            className="input"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            autoFocus
          />
          <button className="btn btn-primary shrink-0" onClick={save} disabled={pending}>
            Salvar
          </button>
        </div>
        {err && <p className="mt-2 text-sm text-danger">{err}</p>}
        <button
          className="btn btn-ghost btn-sm mt-2"
          onClick={() => {
            setEditing(false);
            setValue(name);
            setErr(null);
          }}
        >
          Cancelar
        </button>
      </div>
    );
  }

  return (
    <div className="flex gap-2">
      <button className="btn btn-ghost btn-sm" onClick={() => setEditing(true)}>
        ✏️ Renomear
      </button>
      <button className="btn btn-danger btn-sm" onClick={remove} disabled={pending}>
        🗑 Excluir
      </button>
    </div>
  );
}
