"use client";

import { useState } from "react";
import { RATING_WEIGHTS } from "@/lib/rating";

const fmt = (w: number) => (w > 0 ? "+" : "−") + Math.abs(w).toLocaleString("pt-BR");

const ROWS: [string, number][] = [
  ["Gol", RATING_WEIGHTS.goal],
  ["Gol de pênalti", RATING_WEIGHTS.penaltyGoal],
  ["Assistência", RATING_WEIGHTS.assist],
  ["Vitória", RATING_WEIGHTS.win],
  ["Empate", RATING_WEIGHTS.draw],
  ["Derrota", RATING_WEIGHTS.loss],
  ["Gol contra", RATING_WEIGHTS.ownGoal],
];

export function NotaInfo() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Como a nota é calculada"
        className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-border text-[11px] font-bold leading-none text-muted transition-colors hover:border-muted hover:text-fg"
      >
        i
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 normal-case tracking-normal sm:items-center"
          onClick={() => setOpen(false)}
        >
          <div
            className="card w-full max-w-sm p-5"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold">Como a nota é calculada</h3>
              <button
                onClick={() => setOpen(false)}
                className="text-muted hover:text-fg"
                aria-label="Fechar"
              >
                ✕
              </button>
            </div>

            <p className="mt-2 text-sm text-muted">
              Cada jogador parte de{" "}
              <b className="text-fg">
                {RATING_WEIGHTS.base.toLocaleString("pt-BR", { minimumFractionDigits: 1 })}
              </b>{" "}
              e a nota sobe ou desce conforme o desempenho:
            </p>

            <ul className="mt-3 space-y-1.5">
              {ROWS.map(([label, w]) => (
                <li
                  key={label}
                  className="flex items-center justify-between border-b border-border/60 pb-1.5 text-sm last:border-0"
                >
                  <span>{label}</span>
                  <span
                    className={`font-bold tabular-nums ${w > 0 ? "text-primary" : "text-danger"}`}
                  >
                    {fmt(w)}
                  </span>
                </li>
              ))}
            </ul>

            <p className="mt-3 text-xs text-muted">
              No <b className="text-fg">ranking geral</b> contam todas as peladas; em cada{" "}
              <b className="text-fg">pelada</b>, apenas os jogos do dia.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
