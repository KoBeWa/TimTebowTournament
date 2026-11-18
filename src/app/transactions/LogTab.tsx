"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import ManagerName from "@/components/ui/ManagerName";
import { type VTxRow, fmt, valTone, TH } from "./shared";

type LogCol = "season" | "week" | "date" | "owner" | "type" | "added" | "dropped" | "value";

// Pill colours per transaction type
function typeLabel(type: string) {
  if (type === "trade")    return { text: "Trade",    cls: "text-text-secondary" };
  if (type === "add/drop") return { text: "Add/Drop", cls: "text-positive" };
  if (type === "add")      return { text: "Add",      cls: "text-positive" };
  if (type === "drop")     return { text: "Drop",     cls: "text-negative" };
  return { text: type, cls: "text-text-secondary" };
}

function fmtDate(ts: string) {
  return new Date(ts).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export default function LogTab({ rows, showOwner, showSeason, onReset }: {
  rows: VTxRow[];
  onReset: () => void;
  showOwner: boolean;
  showSeason: boolean;
}) {
  const [sortCol, setSortCol] = useState<LogCol>("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  function toggleSort(col: LogCol) {
    if (sortCol === col) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortCol(col); setSortDir(col === "value" ? "desc" : "asc"); }
  }

  const sorted = [...rows].sort((a, b) => {
    const dir = sortDir === "asc" ? 1 : -1;
    switch (sortCol) {
      case "season":  return dir * (a.season_year - b.season_year);
      case "week":    return dir * (a.transaction_week - b.transaction_week);
      case "date":    return dir * a.transaction_at.localeCompare(b.transaction_at);
      case "owner":   return dir * a.team_name.localeCompare(b.team_name);
      case "type":    return dir * a.transaction_type.localeCompare(b.transaction_type);
      case "added":   return dir * (a.add_players ?? "").localeCompare(b.add_players ?? "");
      case "dropped": return dir * (a.drop_players ?? "").localeCompare(b.drop_players ?? "");
      case "value": {
        const av = a.scored_value ?? a.net_value ?? 0;
        const bv = b.scored_value ?? b.net_value ?? 0;
        return dir * (av - bv);
      }
      default: return 0;
    }
  });

  // The first visible column carries the outer padding: differs between phone and md+ because some columns are hidden on phones
  const firstPhone: LogCol = showSeason ? "season" : showOwner ? "owner" : "added";
  const firstWide: LogCol = showSeason ? "season" : "week";
  const padL = (col: LogCol) => {
    const phone = col === firstPhone, wide = col === firstWide;
    if (phone && wide) return "pl-4 sm:pl-5";
    if (phone) return "pl-4 sm:pl-5 md:pl-0";
    if (wide) return "md:pl-5";
    return "";
  };

  // `hide` drops the column on phones; `last` sets the outer padding
  function th(col: LogCol, label: string, opts: { right?: boolean; hide?: boolean; last?: boolean } = {}) {
    const { right, hide, last } = opts;
    const active = sortCol === col;
    return (
      <th key={col} aria-sort={active ? (sortDir === "asc" ? "ascending" : "descending") : "none"}
        className={`${TH} select-none whitespace-nowrap hover:text-ink ${right ? "text-right" : "text-left"} ${
          padL(col)} ${last ? "pr-4 sm:pr-5" : "pr-3"} ${hide ? "hidden md:table-cell" : ""} ${active ? "text-ink" : ""}`}>
        <button type="button" onClick={() => toggleSort(col)}
          className="inline-flex min-h-11 items-center disabled:opacity-55 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus)]">
          {label}
          {active && (sortDir === "asc" ? <ArrowUp size={12} aria-hidden="true" className="ml-1 inline" /> : <ArrowDown size={12} aria-hidden="true" className="ml-1 inline" />)}
        </button>
      </th>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="cell flex flex-col items-center gap-3 py-12 text-center text-sm text-text-muted">
        Für diese Auswahl gibt es keine Transaktionen.
        <button type="button" className="btn disabled:opacity-55 disabled:cursor-not-allowed" onClick={onReset}>Filter zurücksetzen</button>
      </div>
    );
  }


  return (
    <div className="cell overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr>
            {showSeason && th("season", "Saison")}
            {th("week", "Woche", { hide: true })}
            {th("date", "Datum", { hide: true })}
            {showOwner && th("owner", "Owner")}
            {th("type", "Typ", { hide: true })}
            {th("added", "Added")}
            {th("dropped", "Dropped", { hide: true })}
            {th("value", "Wert", { right: true, last: true })}
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => {
            const lbl = typeLabel(r.transaction_type);
            const val = r.scored_value ?? r.net_value;
            return (
              <tr key={`${r.transaction_id}-${r.team_name}`} className="border-t border-border-light">
                {showSeason && <td className={`py-2.5 pr-3 text-text-muted ${padL("season")}`}><span className="measured">{r.season_year}</span></td>}
                <td className={`hidden py-2.5 pr-3 measured text-text-muted md:table-cell ${padL("week")}`}>{r.transaction_week}</td>
                <td className="hidden whitespace-nowrap py-2.5 pr-3 measured text-text-muted md:table-cell">{fmtDate(r.transaction_at)}</td>
                {showOwner && <td className={`py-2.5 pr-3 font-medium ${padL("owner")}`}><ManagerName id={r.team_name} /></td>}
                <td className="hidden py-2.5 pr-3 md:table-cell">
                  <span className={`rounded-[var(--radius-pill)] border border-border px-1.5 py-0.5 text-xs font-medium ${lbl.cls}`}>{lbl.text}</span>
                </td>
                <td className={`max-w-xs py-2.5 pr-3 text-xs text-ink ${padL("added")}`}>
                  {r.add_players ? (
                    <div>
                      <span className="mr-1 font-medium text-positive">+</span>
                      {r.add_players}
                      {r.add_positions && <span className="ml-1 text-text-faint">({r.add_positions})</span>}
                    </div>
                  ) : <span className="text-text-faint">keine</span>}
                </td>
                <td className="hidden max-w-xs py-2.5 pr-3 text-xs text-ink md:table-cell">
                  {r.drop_players ? (
                    <div>
                      <span className="mr-1 font-medium">−</span>
                      {r.drop_players}
                      {r.drop_positions && <span className="ml-1 text-text-faint">({r.drop_positions})</span>}
                    </div>
                  ) : <span className="text-text-faint">keine</span>}
                </td>
                <td className={`py-2.5 pl-0 pr-4 text-right font-semibold measured sm:pr-5 ${val != null ? valTone(val) : "text-text-faint"}`}>
                  {val != null ? fmt(val) : "–"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
