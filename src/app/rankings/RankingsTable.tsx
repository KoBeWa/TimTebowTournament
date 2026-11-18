"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import ManagerName from "@/components/ui/ManagerName";

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

  // Below lg only the season score and the currently sorted column stay visible
  const colVis = (key: ColKey) => (key === "avg_season_score" || key === sortKey ? "" : "hidden lg:table-cell");

  return (
    <div className="cell overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs font-medium text-text-muted">
            <th className="py-2.5 pl-4 pr-2 text-left sm:pl-5">#</th>
            <th className="px-4 py-2.5 text-left">Manager</th>
            {COLS.map((c, i) => (
              <th
                key={c.key}
                aria-sort={c.key === sortKey ? (sortDesc ? "descending" : "ascending") : undefined}
                className={`cursor-pointer select-none whitespace-nowrap px-4 py-2.5 text-right hover:text-ink ${
                  i === COLS.length - 1 ? "pr-4 sm:pr-5" : ""} ${c.key === sortKey ? "text-ink" : ""} ${colVis(c.key)}`}
                onClick={() => handleSort(c.key)}
              >
                {c.label}
                {c.key === sortKey && (sortDesc
                  ? <ChevronDown aria-hidden className="ml-1 inline h-3.5 w-3.5 align-[-2px]" />
                  : <ChevronUp aria-hidden className="ml-1 inline h-3.5 w-3.5 align-[-2px]" />)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row, i) => (
            <tr key={row.manager_id} className="border-t border-border-light hover:bg-surface-2">
              <td className="py-2.5 pl-4 pr-2 text-xs measured text-text-faint sm:pl-5">{i + 1}</td>
              <td className="px-4 py-2.5 font-medium text-ink"><ManagerName id={row.manager_id} /></td>
              {COLS.map((c, ci) => {
                const val = row[c.key] as number;
                const active = c.key === sortKey;
                return (
                  <td
                    key={c.key}
                    className={`px-4 py-2.5 text-right tabular-nums ${ci === COLS.length - 1 ? "pr-4 sm:pr-5" : ""} ${
                      active ? "font-medium text-ink" : "text-text-secondary"} ${colVis(c.key)}`}
                  >
                    {c.format(val)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
