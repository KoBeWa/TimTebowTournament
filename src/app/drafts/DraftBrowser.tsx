"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, ChevronRight } from "lucide-react";
import { SEASONS, MANAGERS, LEAGUE_FOUNDED } from "@/lib/constants";
import ManagerName from "@/components/ui/ManagerName";

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

// Text colour and weight by grade
function gradeStyle(g: number | null): { textColor: string; weight: string } {
  if (g === null) return { textColor: "var(--color-text-muted)", weight: "400" };
  if (g >= 15)  return { textColor: "var(--color-positive)",       weight: "600" };
  if (g >= 5)   return { textColor: "var(--color-positive)",       weight: "500" };
  if (g >= 0)   return { textColor: "var(--color-text-secondary)", weight: "400" };
  if (g >= -5)  return { textColor: "var(--color-text-secondary)", weight: "400" };
  if (g >= -15) return { textColor: "var(--color-negative)",       weight: "500" };
  return         { textColor: "var(--color-negative)",             weight: "600" };
}

function gradeLabel(g: number | null) {
  if (g === null) return "–";
  return (g >= 0 ? "+" : "") + g.toFixed(2);
}

// `hide` marks columns that are dropped on phones
const COLS: { key: SortKey; label: string; align: "left" | "right"; hide?: boolean }[] = [
  { key: "season_year",  label: "Draft",   align: "left"  },
  { key: "round",        label: "Runde",   align: "right", hide: true },
  { key: "overall_pick", label: "Pick",    align: "right" },
  { key: "position",     label: "Pos",     align: "left"  },
  { key: "team",         label: "Team",    align: "left", hide: true },
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

const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus)]";
const SELECT = "rounded-[var(--radius-pill)] border border-border bg-paper-3 px-3 py-2 text-sm text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus)]";

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
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
        <label className="flex flex-col gap-1 text-xs text-text-muted">
          Saison
          <select value={season}
            onChange={(e) => setSeason(e.target.value === "all" ? "all" : Number(e.target.value))}
            className={SELECT}>
            <option value="all">Alle Saisons</option>
            {SEASONS.slice().reverse().map((s) => (
              <option key={s} value={s}>Draft #{draftNumber(s)}, {s}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-text-muted">
          Owner
          <select value={manager} onChange={(e) => setManager(e.target.value)} className={SELECT}>
            <option value="all">Alle Owner</option>
            {MANAGERS.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </label>
        <span className="py-3 text-sm text-text-muted">
          <span className="measured">{filtered.length}</span> Picks
          {avgGrade !== null && (
            <>, Ø Grade <span className={`measured ${avgGrade >= 0 ? "text-positive" : "text-negative"}`}>{avgGrade >= 0 ? "+" : ""}{avgGrade.toFixed(2)}</span></>
          )}
        </span>
        {season !== "all" && (
          <Link href={`/drafts/${season}`} className="ml-auto inline-flex min-h-11 items-center gap-1 px-3 text-sm text-text-muted transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus)]">
            Ganze Saison {season} ansehen <ChevronRight size={15} aria-hidden="true" />
          </Link>
        )}
      </div>

      {filtered.length === 0 && (
        <div className="cell flex flex-col items-center gap-3 py-12 text-center text-sm text-text-muted">
          Für diese Auswahl gibt es keine Picks.
          <button type="button" className="btn disabled:opacity-55 disabled:cursor-not-allowed" onClick={() => { setSeason("all"); setManager("all"); }}>Filter zurücksetzen</button>
        </div>
      )}

      {/* Table */}
      {filtered.length > 0 && (
      <div className="cell overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs font-medium text-text-muted">
              {/* Owner column only when showing all managers */}
              {manager === "all" && <th className="py-2.5 pl-4 pr-3 font-medium sm:pl-5">Owner</th>}
              {COLS.map((col, i) => {
                const active = sortKey === col.key;
                const first = manager !== "all" && i === 0;
                const last = i === COLS.length - 1;
                return (
                  <th key={col.key}
                    aria-sort={active ? (sortDir === 1 ? "ascending" : "descending") : "none"}
                    className={`select-none whitespace-nowrap py-2.5 font-medium transition-colors hover:text-ink ${
                      col.align === "right" ? "text-right" : "text-left"} ${
                      first ? "pl-4 sm:pl-5" : "pl-0"} ${last ? "pr-4 sm:pr-5" : "pr-3"} ${
                      col.hide ? "hidden md:table-cell" : ""} ${active ? "text-ink" : ""}`}>
                    <button type="button" onClick={() => handleSort(col.key)}
                      className={`inline-flex min-h-11 items-center disabled:opacity-55 disabled:cursor-not-allowed ${FOCUS}`}>
                      {col.label}
                      {active && (sortDir === 1
                        ? <ArrowUp size={12} aria-hidden="true" className="ml-1 inline" />
                        : <ArrowDown size={12} aria-hidden="true" className="ml-1 inline" />)}
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => {
              const gs = gradeStyle(p.grade4);
              return (
                <tr key={`${p.season_year}-${p.overall_pick}-${p.manager_id}`}
                  className="border-t border-border-light">
                  {manager === "all" && (
                    <td className="py-2.5 pl-4 pr-3 font-medium text-ink sm:pl-5"><ManagerName id={p.manager_id} /></td>
                  )}
                  <td className={`whitespace-nowrap py-2.5 pr-3 text-text-secondary ${manager !== "all" ? "pl-4 sm:pl-5" : ""}`}>
                    <span className="measured">#{draftNumber(p.season_year)} <span className="text-text-faint">{p.season_year}</span></span>
                  </td>
                  <td className="hidden py-2.5 pr-3 text-right measured text-text-muted md:table-cell">{p.round}</td>
                  <td className="py-2.5 pr-3 text-right measured text-text-muted">{p.overall_pick}</td>
                  <td className="py-2.5 pr-3 text-text-secondary">{p.position}</td>
                  <td className="hidden py-2.5 pr-3 text-text-secondary md:table-cell">{p.team ?? "–"}</td>
                  <td className="py-2.5 pr-3 font-medium text-ink">{p.player_name}</td>
                  <td className="py-2.5 pr-4 text-right measured sm:pr-5" style={{ color: gs.textColor, fontWeight: gs.weight }}>
                    {gradeLabel(p.grade4)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      )}
    </div>
  );
}
