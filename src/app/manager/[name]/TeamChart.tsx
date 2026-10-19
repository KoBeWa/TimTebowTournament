"use client";

import { useState } from "react";

// All 32 teams with the abbreviations nflverse uses (relocated teams under their current code)
export const NFL_TEAMS = [
  "ARI", "ATL", "BAL", "BUF", "CAR", "CHI", "CIN", "CLE", "DAL", "DEN", "DET", "GB", "HOU", "IND", "JAX", "KC",
  "LA", "LAC", "LV", "MIA", "MIN", "NE", "NO", "NYG", "NYJ", "PHI", "PIT", "SEA", "SF", "TB", "TEN", "WAS",
] as const;

// Defense names (incl. old names) -> team code
export const DST_TEAM: Record<string, string> = {
  "Arizona Cardinals": "ARI", "Atlanta Falcons": "ATL", "Baltimore Ravens": "BAL", "Buffalo Bills": "BUF",
  "Carolina Panthers": "CAR", "Chicago Bears": "CHI", "Cincinnati Bengals": "CIN", "Cleveland Browns": "CLE",
  "Dallas Cowboys": "DAL", "Denver Broncos": "DEN", "Detroit Lions": "DET", "Green Bay Packers": "GB",
  "Houston Texans": "HOU", "Indianapolis Colts": "IND", "Jacksonville Jaguars": "JAX", "Kansas City Chiefs": "KC",
  "Los Angeles Rams": "LA", "St. Louis Rams": "LA", "Los Angeles Chargers": "LAC", "San Diego Chargers": "LAC",
  "Las Vegas Raiders": "LV", "Oakland Raiders": "LV", "Miami Dolphins": "MIA", "Minnesota Vikings": "MIN",
  "New England Patriots": "NE", "New Orleans Saints": "NO", "New York Giants": "NYG", "New York Jets": "NYJ",
  "Philadelphia Eagles": "PHI", "Pittsburgh Steelers": "PIT", "Seattle Seahawks": "SEA", "San Francisco 49ers": "SF",
  "Tampa Bay Buccaneers": "TB", "Tennessee Titans": "TEN", "Washington Commanders": "WAS",
  "Washington Football Team": "WAS", "Washington Redskins": "WAS",
};

export interface TeamCount {
  team: string;
  players: string[];
}

// Single series: one hue (categorical slot 1, dark step), validated against the page surface
const BAR = "#3987e5";

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
    <div className="cell p-4 sm:p-5 mb-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-1">
        <div className="kicker">Spieler pro NFL-Team</div>
        <div className="text-xs text-text-muted">
          {zero > 0 ? `${zero} Team${zero > 1 ? "s" : ""} ohne Spieler · ` : ""}Klick filtert die Liste
        </div>
      </div>
      {/* Detail line for the hovered or selected team */}
      <div className="h-10 text-sm text-text-secondary overflow-hidden">
        {active ? (
          <>
            <b className="text-ink">{active.team}</b> · {active.players.length} Spieler
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

      <div className="overflow-x-auto -mx-1 px-1">
        <div className="flex items-end gap-0.5 h-36 min-w-[50rem]" onMouseLeave={() => setHover(null)}>
          {counts.map((c) => {
            const n = c.players.length;
            const dim = (selected && selected !== c.team) || (hover && hover !== c.team);
            return (
              <button key={c.team} type="button"
                onClick={() => onSelect(selected === c.team ? null : c.team)}
                onMouseEnter={() => setHover(c.team)} onFocus={() => setHover(c.team)} onBlur={() => setHover(null)}
                aria-pressed={selected === c.team}
                aria-label={`${c.team}: ${n} Spieler`}
                className="group flex h-full min-w-0 flex-1 flex-col items-center justify-end">
                <span className="mb-0.5 text-[10px] font-mono text-text-muted tabular-nums">{n}</span>
                <span className="w-full max-w-[1.75rem] rounded-t-[4px] transition-opacity"
                  style={{
                    height: n ? `${Math.max(4, (n / max) * 100)}%` : "2px",
                    backgroundColor: n ? BAR : "var(--color-border-strong)",
                    opacity: dim ? 0.35 : 1,
                  }} />
              </button>
            );
          })}
        </div>
        <div className="flex gap-0.5 min-w-[50rem] border-t border-border-strong pt-1">
          {counts.map((c) => (
            <span key={c.team}
              className={`flex-1 min-w-0 text-center text-[10px] ${selected === c.team ? "text-ink font-semibold" : "text-text-muted"}`}>
              {c.team}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
