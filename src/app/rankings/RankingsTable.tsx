"use client";

import Link from "next/link";
import { useState } from "react";

export type RankingRow = {
  manager_id: string;
  avg_draft: number;
  avg_manager_pct: number;
  avg_coach: number;
  avg_sos: number;
  total_luck: number;
  top_score_pct: number;
  current_records: number;
  achievements: number;
  avg_points_share: number;
  avg_season_score: number;
};

type ColKey = keyof Omit<RankingRow, "manager_id">;

const COLS: { key: ColKey; label: string; format: (v: number) => string; desc: boolean }[] = [
  { key: "avg_draft",       label: "Draft",         format: (v) => (v >= 0 ? "+" : "") + v.toFixed(2), desc: true  },
  { key: "avg_manager_pct", label: "Manager",        format: (v) => v.toFixed(2) + "%",                desc: true  },
  { key: "avg_coach",       label: "Coach",          format: (v) => v.toFixed(1),                      desc: true  },
  { key: "avg_sos",         label: "SOS",            format: (v) => v.toFixed(2),                      desc: true  },
  { key: "total_luck",      label: "Luck",           format: (v) => (v >= 0 ? "+" : "") + v.toFixed(2),desc: true  },
  { key: "top_score_pct",   label: "Top Score %",    format: (v) => v.toFixed(1) + "%",                desc: true  },
  { key: "current_records", label: "# Records",      format: (v) => String(v),                         desc: true  },
  { key: "achievements",    label: "# Achievements", format: (v) => String(v),                         desc: true  },
  { key: "avg_points_share",label: "Pts Share Avg",  format: (v) => v.toFixed(2) + "%",                desc: true  },
  { key: "avg_season_score",label: "Ø Season Score", format: (v) => v.toFixed(1),                      desc: true  },
];

export default function RankingsTable({ rows }: { rows: RankingRow[] }) {
  const [sortKey, setSortKey] = useState<ColKey>("avg_season_score");
  const [sortDesc, setSortDesc] = useState(true);

  function handleSort(key: ColKey) {
    if (sortKey === key) {
      setSortDesc(!sortDesc);
    } else {
      setSortKey(key);
      setSortDesc(true);
    }
  }

  const sorted = [...rows].sort((a, b) => {
    const diff = a[sortKey] - b[sortKey];
    return sortDesc ? -diff : diff;
  });

  const col = COLS.find((c) => c.key === sortKey)!;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm" style={{ borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ borderBottom: "2px solid #1a1a1a" }}>
            <th className="label-nav text-xs text-text-muted text-left py-2 pr-4">#</th>
            <th className="label-nav text-xs text-text-muted text-left py-2 pr-6">Manager</th>
            {COLS.map((c) => (
              <th
                key={c.key}
                className="label-nav text-xs text-right py-2 px-3 cursor-pointer select-none whitespace-nowrap transition-colors"
                style={{ color: c.key === sortKey ? "#1a1a1a" : "var(--color-text-muted)" }}
                onClick={() => handleSort(c.key)}
              >
                {c.label}
                {c.key === sortKey && (
                  <span className="ml-1">{sortDesc ? "↓" : "↑"}</span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row, i) => (
            <tr
              key={row.manager_id}
              style={{ borderBottom: "1px solid var(--color-border-light)" }}
              className="hover:bg-border-light transition-colors"
            >
              <td className="py-3 pr-4 text-text-faint label-nav text-xs">{i + 1}</td>
              <td className="py-3 pr-6">
                <Link
                  href={`/manager/${row.manager_id}`}
                  className="font-semibold text-ink hover:text-red transition-colors"
                >
                  {row.manager_id}
                </Link>
              </td>
              {COLS.map((c) => {
                const val = row[c.key] as number;
                const isActive = c.key === sortKey;
                const isPositive = c.key === "avg_draft" || c.key === "total_luck"
                  ? val > 0
                  : null;
                return (
                  <td
                    key={c.key}
                    className="py-3 px-3 text-right font-mono"
                    style={{
                      color: isActive
                        ? "#1a1a1a"
                        : isPositive === true
                        ? "var(--color-text-secondary)"
                        : isPositive === false
                        ? "var(--color-text-muted)"
                        : "var(--color-text-secondary)",
                      fontWeight: isActive ? 600 : 400,
                    }}
                  >
                    {c.format(val)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="label-nav text-xs text-text-faint mt-3">
        Sortiert nach: {col.label} · Klick auf Spalte zum Sortieren
      </p>
    </div>
  );
}
