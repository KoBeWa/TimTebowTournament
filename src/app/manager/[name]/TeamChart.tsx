"use client";

import { useState } from "react";

// All 32 teams with the abbreviations nflverse uses (relocated teams under their current code)
export const NFL_TEAMS = [
  "ARI", "ATL", "BAL", "BUF", "CAR", "CHI", "CIN", "CLE", "DAL", "DEN", "DET", "GB", "HOU", "IND", "JAX", "KC",
  "LA", "LAC", "LV", "MIA", "MIN", "NE", "NO", "NYG", "NYJ", "PHI", "PIT", "SEA", "SF", "TB", "TEN", "WAS",
] as const;

export interface TeamCount {
  team: string;
  players: string[];
}

// Single series: one instrument hue
const BAR = "var(--color-cool)";

export default function TeamChart({ counts, selected, onSelect }: {
  counts: TeamCount[];
  selected: string | null;
  onSelect: (team: string | null) => void;
}) {
  const [hover, setHover] = useState<string | null>(null);
  const max = Math.max(1, ...counts.map((c) => c.players.length));
  const active = counts.find((c) => c.team === (hover ?? selected)) ?? null;
  const zero = counts.filter((c) => c.players.length === 0).length;

  return (
    <div className="cell p-4 sm:p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-1">
        <h3 className="text-sm font-medium text-ink">Spieler pro NFL-Team</h3>
        <div className="text-xs text-text-muted">
          {zero > 0 ? `${zero} Team${zero > 1 ? "s" : ""} ohne Spieler. ` : ""}Klick filtert die Liste
        </div>
      </div>
      {/* Detail line for the hovered or selected team */}
      <div className="h-10 text-sm text-text-secondary overflow-hidden">
        {active ? (
          <>
            <b className="font-medium text-ink">{active.team}</b>, <span className="measured">{active.players.length}</span> Spieler
            {active.players.length > 0 && (
              <span className="block truncate text-xs text-text-muted">
                {active.players.slice(0, 8).join(", ")}{active.players.length > 8 ? ` +${active.players.length - 8}` : ""}
              </span>
            )}
          </>
        ) : (
          <span className="text-text-muted text-xs">Über eine Säule fahren für Details</span>
        )}
      </div>

      {/* 16 + 16 bars below md, one row of 32 from md up; every team stays visible */}
      <div className="space-y-4 md:space-y-0" onMouseLeave={() => setHover(null)}>
        {[counts.slice(0, 16), counts.slice(16)].map((row, ri) => (
          <div key={ri} className="md:hidden">
            <BarRow row={row} max={max} selected={selected} hover={hover} setHover={setHover} onSelect={onSelect} />
          </div>
        ))}
        <div className="hidden md:block">
          <BarRow row={counts} max={max} selected={selected} hover={hover} setHover={setHover} onSelect={onSelect} />
        </div>
      </div>
    </div>
  );
}

function BarRow({ row, max, selected, hover, setHover, onSelect }: {
  row: TeamCount[];
  max: number;
  selected: string | null;
  hover: string | null;
  setHover: (t: string | null) => void;
  onSelect: (team: string | null) => void;
}) {
  return (
    <div>
      <div className="flex h-28 items-end gap-0.5 md:h-36">
        {row.map((c) => {
          const n = c.players.length;
          const dim = (selected && selected !== c.team) || (hover && hover !== c.team);
          return (
            <button key={c.team} type="button"
              onClick={() => onSelect(selected === c.team ? null : c.team)}
              onMouseEnter={() => setHover(c.team)} onFocus={() => setHover(c.team)} onBlur={() => setHover(null)}
              aria-pressed={selected === c.team}
              aria-label={`${c.team}: ${n} Spieler`}
              className="group flex h-full min-w-0 flex-1 flex-col items-center justify-end">
              <span className="mb-0.5 text-[11px] measured text-text-muted">{n}</span>
              <span className="w-full max-w-[1.75rem] rounded-t-[4px] transition-opacity"
                style={{
                  height: n ? `${Math.max(4, (n / max) * 100)}%` : "2px",
                  backgroundColor: n ? BAR : "var(--color-rule-2)",
                  opacity: dim ? 0.35 : 1,
                }} />
            </button>
          );
        })}
      </div>
      <div className="flex gap-0.5 border-t border-border-light pt-1">
        {row.map((c) => (
          <span key={c.team}
            className={`min-w-0 flex-1 text-center text-[11px] ${selected === c.team ? "font-medium text-ink" : "text-text-muted"}`}>
            {c.team}
          </span>
        ))}
      </div>
    </div>
  );
}
