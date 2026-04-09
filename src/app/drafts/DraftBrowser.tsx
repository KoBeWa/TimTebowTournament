"use client";

import { useState } from "react";
import { SEASONS, MANAGERS, LEAGUE_FOUNDED } from "@/lib/constants";

export interface DraftPick {
  season_year: number;
  manager_id: string;
  round: number;
  overall_pick: number;
  player_name: string;
  position: string;
  team: string | null;
  grade4: number | null;
  actual_pts: number;
  projected_pts: number;
}

type SortKey = "season_year" | "round" | "overall_pick" | "position" | "team" | "player_name" | "grade4";

function gradeStyle(g: number | null): { bg: string; textColor: string; weight: string } {
  if (g === null) return { bg: "transparent", textColor: "var(--color-text-muted)", weight: "400" };
  if (g >= 30)  return { bg: "rgba(26,26,26,0.16)", textColor: "#1a1a1a",            weight: "700" };
  if (g >= 15)  return { bg: "rgba(26,26,26,0.09)", textColor: "#1a1a1a",            weight: "600" };
  if (g >= 5)   return { bg: "rgba(26,26,26,0.04)", textColor: "#1a1a1a",            weight: "500" };
  if (g >= 0)   return { bg: "transparent",          textColor: "var(--color-text-secondary)", weight: "400" };
  if (g >= -5)  return { bg: "rgba(160,40,40,0.04)", textColor: "var(--color-text-secondary)", weight: "400" };
  if (g >= -15) return { bg: "rgba(160,40,40,0.08)", textColor: "rgb(160,40,40)",    weight: "500" };
  return         { bg: "rgba(160,40,40,0.14)", textColor: "rgb(140,30,30)",           weight: "600" };
}

function gradeLabel(g: number | null) {
  if (g === null) return "—";
  return (g >= 0 ? "+" : "") + g.toFixed(2);
}

const COLS: { key: SortKey; label: string; align: "left" | "right" }[] = [
  { key: "season_year",  label: "Draft",   align: "left"  },
  { key: "round",        label: "Rd",      align: "right" },
  { key: "overall_pick", label: "Pick",    align: "right" },
  { key: "position",     label: "Pos",     align: "left"  },
  { key: "team",         label: "Team",    align: "left"  },
  { key: "player_name",  label: "Spieler", align: "left"  },
  { key: "grade4",       label: "Grade",   align: "right" },
];

function sortValue(p: DraftPick, key: SortKey): number | string {
  if (key === "team")        return p.team ?? "ZZZ";
  if (key === "player_name") return p.player_name;
  if (key === "position")    return p.position;
  if (key === "grade4")      return p.grade4 ?? -999;
  return p[key] as number;
}

export default function DraftBrowser({ picks }: { picks: DraftPick[] }) {
  const [season, setSeason] = useState<number | "all">("all");
  const [manager, setManager] = useState<string | "all">("all");
  const [sortKey, setSortKey] = useState<SortKey>("overall_pick");
  const [sortDir, setSortDir] = useState<1 | -1>(1);

  const draftNumber = (yr: number) => yr - LEAGUE_FOUNDED + 1;

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 1 ? -1 : 1));
    } else {
      setSortKey(key);
      setSortDir(key === "grade4" ? -1 : 1);
    }
  }

  const filtered = picks
    .filter((p) => {
      if (season !== "all" && p.season_year !== season) return false;
      if (manager !== "all" && p.manager_id !== manager) return false;
      return true;
    })
    .sort((a, b) => {
      const av = sortValue(a, sortKey);
      const bv = sortValue(b, sortKey);
      if (av < bv) return -1 * sortDir;
      if (av > bv) return 1 * sortDir;
      // Secondary sort: natural pick order
      if (a.season_year !== b.season_year) return a.season_year - b.season_year;
      return a.overall_pick - b.overall_pick;
    });

  const avgGrade =
    filtered.length > 0
      ? filtered.reduce((s, p) => s + (p.grade4 ?? 0), 0) / filtered.length
      : null;

  return (
    <div>
      {/* Controls */}
      <div className="flex flex-wrap gap-4 mb-6 items-end">
        <div>
          <label className="kicker block mb-2 text-xs">Saison</label>
          <select
            value={season}
            onChange={(e) => setSeason(e.target.value === "all" ? "all" : Number(e.target.value))}
            className="label-nav text-xs px-3 py-2 bg-cream border border-border text-ink"
            style={{ minWidth: "180px" }}
          >
            <option value="all">All Time</option>
            {SEASONS.slice().reverse().map((s) => (
              <option key={s} value={s}>Draft #{draftNumber(s)} · {s}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="kicker block mb-2 text-xs">Owner</label>
          <select
            value={manager}
            onChange={(e) => setManager(e.target.value)}
            className="label-nav text-xs px-3 py-2 bg-cream border border-border text-ink"
            style={{ minWidth: "160px" }}
          >
            <option value="all">Overall</option>
            {MANAGERS.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>
        <div className="pb-2">
          <span className="label-nav text-xs text-text-muted">
            {filtered.length} Picks
            {avgGrade !== null && (
              <> · Ø Grade: <span className={avgGrade >= 0 ? "text-ink" : "text-red"}>{avgGrade >= 0 ? "+" : ""}{avgGrade.toFixed(2)}</span></>
            )}
          </span>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm" style={{ borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "2px solid #1a1a1a" }}>
              {/* Owner column — only when showing all managers */}
              {manager === "all" && (
                <th className="label-nav text-xs text-text-muted text-left py-2 pr-4">Owner</th>
              )}
              {COLS.map((col) => {
                const active = sortKey === col.key;
                return (
                  <th
                    key={col.key}
                    onClick={() => handleSort(col.key)}
                    className={`label-nav text-xs py-2 cursor-pointer select-none whitespace-nowrap transition-colors ${
                      col.align === "right" ? "text-right pr-4" : "text-left pr-4"
                    }`}
                    style={{ color: active ? "#1a1a1a" : "var(--color-text-muted)" }}
                  >
                    {col.label}
                    {active && <span className="ml-1 text-xs">{sortDir === 1 ? "↑" : "↓"}</span>}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => {
              const gs = gradeStyle(p.grade4);
              return (
                <tr
                  key={`${p.season_year}-${p.overall_pick}-${p.manager_id}`}
                  style={{
                    borderBottom: "1px solid var(--color-border-light)",
                    background: gs.bg,
                  }}
                >
                  {manager === "all" && (
                    <td className="py-2 pr-4 label-nav text-xs font-semibold text-ink">{p.manager_id}</td>
                  )}
                  {/* Draft year */}
                  <td className="py-2 pr-4 label-nav text-xs text-text-secondary whitespace-nowrap">
                    #{draftNumber(p.season_year)} <span className="text-text-faint">{p.season_year}</span>
                  </td>
                  {/* Round */}
                  <td className="py-2 pr-4 text-right font-mono text-xs text-text-muted">{p.round}</td>
                  {/* Pick # */}
                  <td className="py-2 pr-4 text-right font-mono text-xs text-text-muted">{p.overall_pick}</td>
                  {/* Position */}
                  <td className="py-2 pr-4">
                    <span className="label-nav text-xs text-red font-semibold">{p.position}</span>
                  </td>
                  {/* Team */}
                  <td className="py-2 pr-4 label-nav text-xs text-text-secondary font-mono">
                    {p.team ?? "—"}
                  </td>
                  {/* Player name */}
                  <td className="py-2 pr-4 text-sm font-medium text-ink">{p.player_name}</td>
                  {/* Grade */}
                  <td
                    className="py-2 text-right font-mono text-xs"
                    style={{ color: gs.textColor, fontWeight: gs.weight }}
                  >
                    {gradeLabel(p.grade4)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
