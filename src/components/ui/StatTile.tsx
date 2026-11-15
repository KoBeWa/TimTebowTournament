// A single number with its label; `tone` colours the value
export default function StatTile({ label, value, hint, tone }: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  tone?: "positive" | "negative" | "gold";
}) {
  const color = tone === "positive" ? "text-positive" : tone === "negative" ? "text-negative" : tone === "gold" ? "text-gold" : "text-ink";
  return (
    <div className="cell px-4 py-3.5">
      <div className="text-xs text-text-muted">{label}</div>
      <div className={`mt-0.5 display-title text-2xl sm:text-3xl tabular-nums ${color}`}>{value}</div>
      {hint && <div className="mt-0.5 text-xs text-text-faint">{hint}</div>}
    </div>
  );
}
