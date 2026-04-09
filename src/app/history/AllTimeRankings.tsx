"use client";

import Link from "next/link";
import { useState } from "react";

export type AllTimeRow = {
  manager_id: string;
  // Regular season
  record: string;
  winPct: number;
  apRecord: string;
  apWinPct: number;
  elo: number | null;
  // Playoffs
  playoffAppearances: number;
  poRecord: string;
  gold: number;
  silver: number;
  bronze: number;
  medalScore: number;
};

type Tab = "regular" | "playoffs";

export default function AllTimeRankings({ rows }: { rows: AllTimeRow[] }) {
  const [tab, setTab] = useState<Tab>("regular");

  const regularSorted = [...rows].sort((a, b) => (b.elo ?? 0) - (a.elo ?? 0));
  const playoffSorted = [...rows].sort((a, b) => b.medalScore - a.medalScore);

  return (
    <div className="mb-10">
      <div className="flex items-center justify-between mb-3">
        <div className="kicker">Alltime Rankings</div>
        <div className="flex gap-0" style={{ border: "1px solid var(--color-border)", borderRadius: "4px", overflow: "hidden" }}>
          {(["regular", "playoffs"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="label-nav text-xs px-3 py-1.5 transition-colors"
              style={{
                background: tab === t ? "#1a1a1a" : "transparent",
                color: tab === t ? "#f5f0e8" : "var(--color-text-muted)",
                borderRight: t === "regular" ? "1px solid var(--color-border)" : undefined,
              }}
            >
              {t === "regular" ? "Regular Season" : "Playoffs"}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto">
        {tab === "regular" ? (
          <table className="w-full text-sm" style={{ borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #1a1a1a" }}>
                <th className="label-nav text-xs text-text-muted text-left py-2 pr-4">#</th>
                <th className="label-nav text-xs text-text-muted text-left py-2 pr-6">Manager</th>
                <th className="label-nav text-xs text-text-muted text-right py-2 pr-6">Record</th>
                <th className="label-nav text-xs text-text-muted text-right py-2 pr-6">Win%</th>
                <th className="label-nav text-xs text-text-muted text-right py-2 pr-6">All Play</th>
                <th className="label-nav text-xs text-text-muted text-right py-2 pr-6">AP Win%</th>
                <th className="label-nav text-xs text-text-muted text-right py-2">ELO</th>
              </tr>
            </thead>
            <tbody>
              {regularSorted.map((row, i) => (
                <tr
                  key={row.manager_id}
                  style={{ borderBottom: "1px solid var(--color-border-light)" }}
                  className="hover:bg-border-light transition-colors"
                >
                  <td className="py-3 pr-4 text-text-faint label-nav text-xs">{i + 1}</td>
                  <td className="py-3 pr-6">
                    <Link href={`/manager/${row.manager_id}`} className="font-semibold text-ink hover:text-red transition-colors">
                      {row.manager_id}
                    </Link>
                  </td>
                  <td className="py-3 pr-6 text-right font-mono text-ink">{row.record}</td>
                  <td className="py-3 pr-6 text-right font-mono text-ink">{(row.winPct * 100).toFixed(1)}%</td>
                  <td className="py-3 pr-6 text-right font-mono text-text-secondary">{row.apRecord}</td>
                  <td className="py-3 pr-6 text-right font-mono text-text-secondary">
                    {row.apWinPct > 0 ? `${(row.apWinPct * 100).toFixed(1)}%` : "—"}
                  </td>
                  <td className="py-3 text-right">
                    <span className={`label-nav text-xs ${row.elo !== null && row.elo >= 1500 ? "text-ink font-semibold" : "text-text-secondary"}`}>
                      {row.elo ?? "—"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <table className="w-full text-sm" style={{ borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #1a1a1a" }}>
                <th className="label-nav text-xs text-text-muted text-left py-2 pr-4">#</th>
                <th className="label-nav text-xs text-text-muted text-left py-2 pr-6">Manager</th>
                <th className="label-nav text-xs text-text-muted text-right py-2 pr-6">Teilnahmen</th>
                <th className="label-nav text-xs text-text-muted text-right py-2 pr-6">PO Record</th>
                <th className="label-nav text-xs text-text-muted text-right py-2 pr-6">Medal Score</th>
                <th className="label-nav text-xs text-text-muted text-left py-2">Trophäen</th>
              </tr>
            </thead>
            <tbody>
              {playoffSorted.map((row, i) => (
                <tr
                  key={row.manager_id}
                  style={{ borderBottom: "1px solid var(--color-border-light)" }}
                  className="hover:bg-border-light transition-colors"
                >
                  <td className="py-3 pr-4 text-text-faint label-nav text-xs">{i + 1}</td>
                  <td className="py-3 pr-6">
                    <Link href={`/manager/${row.manager_id}`} className="font-semibold text-ink hover:text-red transition-colors">
                      {row.manager_id}
                    </Link>
                  </td>
                  <td className="py-3 pr-6 text-right font-mono text-ink">{row.playoffAppearances}</td>
                  <td className="py-3 pr-6 text-right font-mono text-ink">{row.poRecord}</td>
                  <td className="py-3 pr-6 text-right">
                    <span className="label-nav text-xs font-semibold text-ink">{row.medalScore}</span>
                  </td>
                  <td className="py-3">
                    <span className="font-mono text-xs text-text-secondary">
                      {[
                        row.gold > 0 ? `${row.gold}x Gold` : null,
                        row.silver > 0 ? `${row.silver}x Silber` : null,
                        row.bronze > 0 ? `${row.bronze}x Bronze` : null,
                      ]
                        .filter(Boolean)
                        .join(" · ") || "—"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
