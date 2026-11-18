// A single number with its label; `tone` colours the value
export default function StatTile({ label, value, hint, tone }: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  tone?: "positive" | "negative" | "gold";
}) {
  // Figures are set in the measured mono face; a name or a word stays in the body face
  const measured = typeof value === "number" || (typeof value === "string" && /^[\d\s.,:%+\-−–×/]+$/.test(value));
  const color = tone === "positive" ? "text-positive" : tone === "negative" ? "text-negative" : tone === "gold" ? "text-gold" : "text-ink";
  return (
    <div className="cell px-4 py-3.5 sm:px-5 sm:py-4">
      <div className="truncate text-sm text-text-muted">{label}</div>
      <div className={`${measured ? "measured" : "font-medium tracking-[-0.02em]"} mt-1 truncate text-2xl leading-tight sm:text-[1.75rem] ${color}`}>{value}</div>
      {hint && <div className="mt-1 truncate text-xs text-text-faint">{hint}</div>}
    </div>
  );
}
