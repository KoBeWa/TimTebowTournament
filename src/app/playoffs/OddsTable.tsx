import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import ManagerName from "@/components/ui/ManagerName";
import { fmtNum, fmtPct, type OddsRow } from "@/lib/playoffs";

// Places 1-4 qualify (amber steps), 5-8 do not (greys)
const SEED_CLASSES = [
  "bg-red", "bg-red/75", "bg-red/55", "bg-red/35",
  "bg-text-muted/45", "bg-text-muted/32", "bg-text-muted/22", "bg-text-muted/14",
];

function Trend({ delta }: { delta: number | null }) {
  if (delta == null) return <span className="text-text-faint">–</span>;
  const pp = delta * 100;
  if (Math.abs(pp) < 0.05) return <span className="inline-flex items-center gap-1 text-text-faint"><Minus size={14} aria-hidden />±0</span>;
  const up = pp > 0;
  return (
    <span className={`inline-flex items-center gap-1 ${up ? "text-positive" : "text-negative"}`}>
      {up ? <ArrowUpRight size={15} aria-hidden /> : <ArrowDownRight size={15} aria-hidden />}
      {up ? "+" : "−"}{fmtNum(Math.abs(pp))}
    </span>
  );
}

function Badge({ tone, children }: { tone: "positive" | "negative"; children: React.ReactNode }) {
  return (
    <span className={`whitespace-nowrap rounded-[var(--radius-pill)] px-2 py-0.5 text-xs font-medium ${
      tone === "positive" ? "bg-positive/15 text-positive" : "bg-negative/15 text-negative"}`}>{children}</span>
  );
}

// Overview: one row per manager, sorted by playoff odds
export default function OddsTable({ rows, previous }: { rows: OddsRow[]; previous: Record<string, number> }) {
  return (
    <div className="cell overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs font-medium text-text-muted">
            <th className="px-4 py-2.5 font-medium">Manager</th>
            <th className="px-4 py-2.5 text-right font-medium">Bilanz</th>
            <th className="px-4 py-2.5 font-medium">Chance</th>
            <th className="px-4 py-2.5 text-right font-medium">Trend <span className="text-text-faint">(Pp.)</span></th>
            <th className="hidden px-4 py-2.5 text-right font-medium md:table-cell">Proj. Bilanz</th>
            <th className="hidden px-4 py-2.5 text-right font-medium md:table-cell">Sacko-Risiko</th>
            <th className="hidden px-4 py-2.5 font-medium lg:table-cell">Platz-Verteilung</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const prev = previous[r.manager_id];
            const played = r.wins + r.losses + r.ties;
            const projWins = Number(r.proj_wins);
            const projLosses = Math.max(0, played + r.games_left - projWins);
            const safe = r.playoff_pct >= 0.995;
            const out = r.playoff_pct <= 0.005;
            return (
              <tr key={r.manager_id} className="border-t border-border-light">
                <td className="px-4 py-2.5">
                  <span className="flex items-center gap-2 sm:gap-3">
                    <span className="measured w-4 text-right text-text-faint">{i + 1}</span>
                    <ManagerName id={r.manager_id} className="min-h-11 font-medium text-ink" />
                  </span>
                </td>
                <td className="measured whitespace-nowrap px-4 py-2.5 text-right text-text-secondary">
                  {r.wins}–{r.losses}{r.ties ? `–${r.ties}` : ""}
                </td>
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-2 sm:gap-3">
                    <div className="h-1.5 w-9 shrink-0 overflow-hidden rounded-[var(--radius-pill)] bg-surface-2 sm:w-40 lg:w-56"
                      role="img" aria-label={`Playoff-Chance ${fmtPct(r.playoff_pct)}`}>
                      <div className="h-full bg-text-secondary"
                        style={{ width: `${Math.max(r.playoff_pct > 0 ? 1.5 : 0, r.playoff_pct * 100)}%` }} />
                    </div>
                    <span className="measured w-12 shrink-0 text-right text-sm font-medium text-ink sm:w-14">{fmtPct(r.playoff_pct)}</span>
                    {(safe || out) && (
                      <span className="hidden sm:inline">
                        {safe ? <Badge tone="positive">so gut wie sicher</Badge> : <Badge tone="negative">praktisch raus</Badge>}
                      </span>
                    )}
                  </div>
                  {(safe || out) && (
                    <div className="mt-1 sm:hidden">
                      {safe ? <Badge tone="positive">so gut wie sicher</Badge> : <Badge tone="negative">praktisch raus</Badge>}
                    </div>
                  )}
                </td>
                <td className="measured whitespace-nowrap px-4 py-2.5 text-right">
                  <Trend delta={prev == null ? null : r.playoff_pct - prev} />
                </td>
                <td className="measured hidden whitespace-nowrap px-4 py-2.5 text-right text-text-secondary md:table-cell">
                  {fmtNum(projWins)}–{fmtNum(projLosses)}
                </td>
                <td className="measured hidden px-4 py-2.5 text-right text-text-secondary md:table-cell">{fmtPct(r.last_pct)}</td>
                <td className="hidden px-4 py-2.5 lg:table-cell">
                  <div className="flex h-1.5 w-40 overflow-hidden rounded-[var(--radius-pill)] bg-surface-2"
                    role="img" aria-label={`Platz-Verteilung: ${r.seed_pct.map((p, k) => `${k + 1}. Platz ${fmtPct(p)}`).join(", ")}`}>
                    {r.seed_pct.map((p, k) => (
                      <div key={k} title={`${k + 1}. Platz: ${fmtPct(p)}`}
                        className={SEED_CLASSES[k] ?? SEED_CLASSES[7]} style={{ width: `${p * 100}%` }} />
                    ))}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="hidden border-t border-border-light px-4 py-2.5 text-xs text-text-faint lg:block">
        Platz-Verteilung: Chance auf Platz 1 bis 8, die ersten vier (Amber) erreichen die Playoffs.
      </p>
    </div>
  );
}
