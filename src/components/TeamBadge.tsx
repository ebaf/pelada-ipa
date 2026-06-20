export function TeamBadge({
  label,
  className = "",
}: {
  label: string;
  className?: string;
}) {
  return (
    <span className={`team-badge team-${label} ${className}`} aria-hidden>
      {label}
    </span>
  );
}

export function Medal({ rank }: { rank: number }) {
  if (rank === 1) return <span title="Campeão">🥇</span>;
  if (rank === 2) return <span title="Vice">🥈</span>;
  if (rank === 3) return <span title="3º lugar">🥉</span>;
  return <span className="text-muted tabular-nums">{rank}º</span>;
}
