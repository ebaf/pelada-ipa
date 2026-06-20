export const STAGE_LABEL: Record<string, string> = {
  GROUP: "Fase de grupos",
  SF1: "Semifinal 1",
  SF2: "Semifinal 2",
  THIRD: "Disputa de 3º",
  FINAL: "Final",
};

export const STAGE_SHORT: Record<string, string> = {
  GROUP: "Grupos",
  SF1: "SF1",
  SF2: "SF2",
  THIRD: "3º lugar",
  FINAL: "Final",
};

function asDate(d: Date | string): Date {
  return typeof d === "string" ? new Date(d) : d;
}

// Datas são guardadas em UTC (meia-noite). Formatamos em UTC para não escorregar
// de dia por fuso horário.
export function formatDate(d: Date | string): string {
  const date = asDate(d);
  const day = String(date.getUTCDate()).padStart(2, "0");
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${day}/${month}/${date.getUTCFullYear()}`;
}

export function formatNota(n: number): string {
  return n.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export const TEAM_LABELS = ["A", "B", "C", "D"] as const;

// Cores por time para a UI.
export const TEAM_COLOR: Record<string, string> = {
  A: "#ef4444", // vermelho
  B: "#3b82f6", // azul
  C: "#22c55e", // verde
  D: "#eab308", // amarelo
};
