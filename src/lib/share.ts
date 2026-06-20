import type { MatchView } from "@/lib/queries";
import { formatDate } from "@/lib/format";

// Cor de cada time como "bolinha" (combina com TEAM_COLOR).
const TEAM_DOT: Record<string, string> = { A: "🔴", B: "🔵", C: "🟢", D: "🟡" };
const STAGE_EMOJI: Record<string, string> = {
  GROUP: "⚽",
  SF1: "🥅",
  SF2: "🥅",
  THIRD: "🥉",
  FINAL: "🏆",
};
const STAGE_NAME: Record<string, string> = {
  SF1: "SEMIFINAL 1",
  SF2: "SEMIFINAL 2",
  THIRD: "DISPUTA DE 3º",
  FINAL: "FINAL",
};

const dot = (label: string) => TEAM_DOT[label] ?? "⚪";
const roundName = (m: MatchView) =>
  m.stage === "GROUP" ? `RODADA ${m.round}` : (STAGE_NAME[m.stage] ?? m.stage);

/**
 * Gera o texto do resultado de uma partida formatado para o WhatsApp
 * (usa *negrito*, _itálico_ e emojis). Cada gol fica como:
 *   <bolinha do time> Autor _(🅰 Assistente)_ | _(pênalti)_ | _(🤦 contra)_
 */
export function formatMatchForWhatsApp(
  m: MatchView,
  champ: { name: string | null; date: Date | string },
): string {
  const title = champ.name?.trim() || "Pelada IPA";
  const header = `${STAGE_EMOJI[m.stage] ?? "⚽"} *${roundName(m)}* · ${title} — ${formatDate(champ.date)}`;
  const score = `${dot(m.homeLabel)} *Time ${m.homeLabel}*  *${m.homeScore} x ${m.awayScore}*  *Time ${m.awayLabel}* ${dot(m.awayLabel)}`;

  let pens = "";
  if (
    m.stage !== "GROUP" &&
    m.homeScore === m.awayScore &&
    (m.homePens != null || m.awayPens != null)
  ) {
    pens = `\n🥅 Pênaltis: ${m.homePens ?? 0} x ${m.awayPens ?? 0}`;
  }

  const goalLines = m.goals.map((g) => {
    const label = g.teamId === m.homeTeamId ? m.homeLabel : m.awayLabel;
    const name = g.scorerName ?? "Sem autor";
    let tag = "";
    if (g.isOwnGoal) {
      tag = " _(🤦 contra)_";
    } else {
      const bits: string[] = [];
      if (g.assistName) bits.push(`🅰 ${g.assistName}`);
      if (g.isPenalty) bits.push("pênalti");
      if (bits.length) tag = ` _(${bits.join(" · ")})_`;
    }
    return `${dot(label)} ${name}${tag}`;
  });

  const goalsBlock = goalLines.length
    ? `\n\n⚽ *Gols e assistências*\n${goalLines.join("\n")}`
    : "\n\n_Sem gols registrados._";

  return `${header}\n\n${score}${pens}${goalsBlock}`;
}
