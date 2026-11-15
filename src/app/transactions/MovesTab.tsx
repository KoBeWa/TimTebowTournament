"use client";

import ManagerName from "@/components/ui/ManagerName";
import { type VTxRow, fmt, TH } from "./shared";

function WaiverTable({ rows, best }: { rows: VTxRow[]; best: boolean }) {
  return (
    <div className="cell overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left">
            <th className={`${TH} pl-4 pr-2 sm:pl-5`}>#</th>
            <th className={`${TH} px-2`}>Add / Drop</th>
            <th className={`${TH} px-2`}>Owner</th>
            <th className={`${TH} pl-2 pr-4 text-right sm:pr-5`}>Wert</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={`${r.transaction_id}-${r.team_name}-${i}`} className="border-t border-border-light">
              <td className="py-2.5 pl-4 pr-2 tabular-nums text-text-faint sm:pl-5">{i + 1}</td>
              <td className="px-2 py-2.5">
                <div className="font-medium text-ink">{r.add_players ?? "—"}</div>
                {r.drop_players && <div className="text-xs text-text-muted">− {r.drop_players}</div>}
                <div className="text-xs text-text-faint">{r.season_year}, Woche {r.transaction_week}</div>
              </td>
              <td className="px-2 py-2.5 text-ink"><ManagerName id={r.team_name} /></td>
              <td className={`py-2.5 pl-2 pr-4 text-right font-semibold tabular-nums sm:pr-5 ${best ? "text-positive" : "text-negative"}`}>
                {fmt(best ? (r.scored_value ?? 0) : r.gain_value)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function MovesTab({ filt }: { filt: VTxRow[] }) {
  const meaningful = filt.filter(r => r.transaction_type !== "trade" && r.is_meaningful && r.scored_value != null);
  const top10   = [...meaningful].sort((a, b) => (b.scored_value ?? 0) - (a.scored_value ?? 0)).slice(0, 10);
  const withAdd = filt.filter(r => r.transaction_type !== "trade" && r.add_players != null);
  const worst10 = [...withAdd].sort((a, b) => a.gain_value - b.gain_value).slice(0, 10);

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
      <section>
        <h2 className="section-title mb-3 text-ink">Beste 10 Waiver-Moves</h2>
        <WaiverTable rows={top10} best />
      </section>
      <section>
        <h2 className="section-title mb-3 text-ink">Schlechteste 10 Waiver-Moves</h2>
        <WaiverTable rows={worst10} best={false} />
      </section>
    </div>
  );
}
