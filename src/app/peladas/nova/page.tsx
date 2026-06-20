"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createChampionship } from "@/lib/actions";

export default function NovaPeladaPage() {
  const [date, setDate] = useState("");
  const [name, setName] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  useEffect(() => {
    setDate(new Date().toISOString().slice(0, 10));
  }, []);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!date) {
      setErr("Informe a data da pelada.");
      return;
    }
    setErr(null);
    start(async () => {
      const r = await createChampionship(date, name || undefined);
      if (r?.error) setErr(r.error);
      else if (r?.id) router.push(`/peladas/${r.id}/gerenciar`);
    });
  }

  return (
    <div className="space-y-5">
      <Link href="/" className="text-sm text-muted hover:text-fg">
        ← Início
      </Link>
      <h1 className="text-2xl font-extrabold">Nova pelada</h1>

      <form onSubmit={submit} className="card space-y-4 p-5">
        <div>
          <label className="label" htmlFor="date">
            Data
          </label>
          <input
            id="date"
            type="date"
            className="input"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
        <div>
          <label className="label" htmlFor="name">
            Nome (opcional)
          </label>
          <input
            id="name"
            className="input"
            placeholder="Ex.: Pelada de aniversário"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="off"
          />
        </div>
        {err && <p className="text-sm text-danger">{err}</p>}
        <button className="btn btn-primary w-full" disabled={pending}>
          {pending ? "Criando..." : "Criar e montar times"}
        </button>
        <p className="text-center text-xs text-muted">
          Depois de criar, você monta os 4 times e registra as partidas.
        </p>
      </form>
    </div>
  );
}
