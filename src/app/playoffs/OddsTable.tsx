import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import ManagerName from "@/components/ui/ManagerName";
import { MANAGER_COLORS } from "@/lib/constants";
import { fmtNum, fmtPct, type OddsRow } from "@/lib/playoffs";

// Places 1-4 qualify (golds), 5-8 do not (greys)
const SEED_COLORS = [
  "#e6be62", "#d6a842", "#b8892a", "#8f6a20",
  "rgb(255 255 255 / 0.30)", "rgb(255 255 255 / 0.21)", "rgb(255 255 255 / 0.14)", "rgb(255 255 255 / 0.08)",
];

function Trend({ delta }: { delta: number | null }) {
  if (delta == null) return <span className="text-text-faint">–</span>;
  const pp = delta * 100;
  if (Math.abs(pp) < 0.05) return <span className="inline-flex items-center gap-1 text-text-faint"><Minus size={14} />±0</span>;
  const up = pp > 0;
  return (
    <span className={`inline-flex items-center gap-1 ${up ? "text-positive" : "text-negative"}`}>
      {up ? <ArrowUpRight size={15} /> : <ArrowDownRight size={15} />}
      {up ? "+" : "−"}{fmtNum(Math.abs(pp))}
    </span>
  );
}

function Badge({ tone, children }: { tone: "positive" | "negative"; children: React.ReactNode }) {
  return (
    <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${
      tone === "positive" ? "bg-positive/15 text-positive" : "bg-negative/15 text-negative"}`}>{children}</span>
  );
}

// Overview: one row per manager, sorted by playoff odds
export default function OddsTable({ rows, previous }: { rows: OddsRow[]; previous: Record<string, number> }) {
  return (
    <div className="cell overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-text-muted">
            <th className="pb-2.5 pl-3 pr-1 pt-4 font-medium sm:pl-5 sm:pr-2">Manager</th>
            <th className="px-1.5 pb-2.5 pt-4 font-medium sm:px-2">Bilanz</th>
            <th className="px-1.5 pb-2.5 pt-4 font-medium sm:px-2">Chance</th>
            <th className="pb-2.5 pl-1.5 pr-3 pt-4 text-right font-medium sm:px-2">Trend <span className="text-text-faint">(Pp.)</span></th>
            <th className="hidden px-2 pb-2.5 pt-4 font-medium md:table-cell">Proj. Bilanz</th>
            <th className="hidden px-2 pb-2.5 pt-4 text-right font-medium md:table-cell">Sacko-Risiko</th>
            <th className="hidden pb-2.5 pl-4 pr-5 pt-4 font-medium lg:table-cell">Platz-Verteilung</th>
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
                <td className="py-2.5 pl-3 pr-1 sm:pl-5 sm:pr-2">
                  <span className="flex items-center gap-2 sm:gap-3">
                    <span className="w-4 text-right tabular-nums text-text-faint">{i + 1}</span>
                    <ManagerName id={r.manager_id} className="min-h-11 font-medium text-ink" />
                  </span>
                </td>
                <td className="whitespace-nowrap px-1.5 py-2.5 tabular-nums text-text-secondary sm:px-2">
                  {r.wins}–{r.losses}{r.ties ? `–${r.ties}` : ""}
                </td>
                <td className="px-1.5 py-2.5 sm:px-2">
                  <div className="flex items-center gap-2 sm:gap-3">
                    <div className="h-3 w-9 shrink-0 overflow-hidden rounded-full bg-surface-2 sm:w-40 lg:w-56"
                      role="img" aria-label={`Playoff-Chance ${fmtPct(r.playoff_pct)}`}>
                      <div className="h-full rounded-full"
                        style={{ width: `${Math.max(r.playoff_pct > 0 ? 1.5 : 0, r.playoff_pct * 100)}%`, backgroundColor: MANAGER_COLORS[r.manager_id] }} />
                    </div>
                    <span className="w-12 shrink-0 text-right text-[0.8125rem] font-semibold tabular-nums text-ink sm:w-14 sm:text-sm">{fmtPct(r.playoff_pct)}</span>
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
                <td className="whitespace-nowrap py-2.5 pl-1.5 pr-3 text-right tabular-nums sm:px-2">
                  <Trend delta={prev == null ? null : r.playoff_pct - prev} />
                </td>
                <td className="hidden whitespace-nowrap px-2 py-2.5 tabular-nums text-text-secondary md:table-cell">
                  {fmtNum(projWins)}–{fmtNum(projLosses)}
                </td>
                <td className="hidden px-2 py-2.5 text-right tabular-nums text-text-secondary md:table-cell">{fmtPct(r.last_pct)}</td>
                <td className="hidden py-2.5 pl-4 pr-5 lg:table-cell">
                  <div className="flex h-3 w-40 overflow-hidden rounded-full bg-surface"
                    role="img" aria-label={`Platz-Verteilung: ${r.seed_pct.map((p, k) => `${k + 1}. Platz ${fmtPct(p)}`).join(", ")}`}>
                    {r.seed_pct.map((p, k) => (
                      <div key={k} title={`${k + 1}. Platz: ${fmtPct(p)}`}
                        style={{ width: `${p * 100}%`, backgroundColor: SEED_COLORS[k] ?? SEED_COLORS[7] }} />
                    ))}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="hidden border-t border-border-light px-5 py-2.5 text-xs text-text-faint lg:block">
        Platz-Verteilung: Chance auf Platz 1 bis 8, die ersten vier (Gold) erreichen die Playoffs.
      </p>
    </div>
  );
}
