"use client";

import { useState } from "react";

export interface PositionPickRow {
  season_year: number;
  overall_pick: number;
  player_name: string;
  manager_id: string;
  grade4: number;
  team: string | null;
}

export interface PositionOwnerRow {
  id: string;
  avgGrade: number;
  picks: number;
  positive: number;
}

export interface PositionData {
  position: string;
  ownerRankings: PositionOwnerRow[];
  top5: PositionPickRow[];
  worst5: PositionPickRow[];
}

const POSITIONS = ["QB", "RB", "WR", "TE", "K", "DST"];

const POS_LABEL: Record<string, string> = {
  QB: "Quarterback", RB: "Running Back", WR: "Wide Receiver",
  TE: "Tight End", K: "Kicker", DST: "Defense",
};

function sign(n: number) {
  return (n >= 0 ? "+" : "") + n.toFixed(2);
}

export default function PositionStats({ data }: { data: PositionData[] }) {
  const [pos, setPos] = useState("QB");

  const current = data.find((d) => d.position === pos);
  if (!current) return null;

  return (
    <div>
      {/* Position tabs */}
      <div className="flex flex-wrap gap-1 mb-6">
        {POSITIONS.map((p) => (
          <button
            key={p}
            onClick={() => setPos(p)}
            className={`px-4 py-1.5 label-nav text-xs transition-colors border ${
              p === pos
                ? "bg-ink text-cream border-ink"
                : "bg-transparent text-text-muted border-border hover:text-ink hover:border-ink"
            }`}
          >
            {p}
          </button>
        ))}
      </div>

      <div className="kicker mb-1">{POS_LABEL[pos] ?? pos}</div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* Owner rankings */}
        <div>
          <div className="label-nav text-xs text-text-muted mb-3 uppercase tracking-wider">Owner Rankings</div>
          <table className="w-full text-sm" style={{ borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #1a1a1a" }}>
                <th className="label-nav text-xs text-text-muted text-left py-2 pr-3">#</th>
                <th className="label-nav text-xs text-text-muted text-left py-2 pr-4">Owner</th>
                <th className="label-nav text-xs text-text-muted text-right py-2 pr-4">Ø Grade</th>
                <th className="label-nav text-xs text-text-muted text-right py-2">Picks</th>
              </tr>
            </thead>
            <tbody>
              {current.ownerRankings.map((o, i) => (
                <tr key={o.id} style={{ borderBottom: "1px solid var(--color-border-light)" }}>
                  <td className="py-2.5 pr-3 label-nav text-xs text-text-faint">{i + 1}</td>
                  <td className="py-2.5 pr-4 font-semibold text-ink">{o.id}</td>
                  <td
                    className="py-2.5 pr-4 text-right font-mono text-sm font-semibold"
                    style={{ color: o.avgGrade >= 0 ? "#1a1a1a" : "rgb(150,35,35)" }}
                  >
                    {sign(o.avgGrade)}
                  </td>
                  <td className="py-2.5 text-right font-mono text-xs text-text-muted">{o.picks}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Top 5 */}
        <div>
          <div className="label-nav text-xs text-text-muted mb-3 uppercase tracking-wider">Top 5 Picks</div>
          <table className="w-full text-sm" style={{ borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #1a1a1a" }}>
                <th className="label-nav text-xs text-text-muted text-left py-2 pr-2">#</th>
                <th className="label-nav text-xs text-text-muted text-left py-2 pr-3">Spieler</th>
                <th className="label-nav text-xs text-text-muted text-right py-2 pr-3">Pick</th>
                <th className="label-nav text-xs text-text-muted text-right py-2">Grade</th>
              </tr>
            </thead>
            <tbody>
              {current.top5.map((p, i) => (
                <tr key={`${p.season_year}-${p.overall_pick}`} style={{ borderBottom: "1px solid var(--color-border-light)" }}>
                  <td className="py-2.5 pr-2 label-nav text-xs text-text-faint">{i + 1}</td>
                  <td className="py-2.5 pr-3">
                    <div className="font-medium text-ink text-sm">{p.player_name}</div>
                    <div className="label-nav text-xs text-text-muted">{p.manager_id} · {p.season_year}</div>
                  </td>
                  <td className="py-2.5 pr-3 text-right font-mono text-xs text-text-muted">#{p.overall_pick}</td>
                  <td className="py-2.5 text-right font-mono text-sm font-semibold text-ink">
                    {sign(p.grade4)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Worst 5 */}
        <div>
          <div className="label-nav text-xs text-text-muted mb-3 uppercase tracking-wider">Worst 5 Picks</div>
          <table className="w-full text-sm" style={{ borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #1a1a1a" }}>
                <th className="label-nav text-xs text-text-muted text-left py-2 pr-2">#</th>
                <th className="label-nav text-xs text-text-muted text-left py-2 pr-3">Spieler</th>
                <th className="label-nav text-xs text-text-muted text-right py-2 pr-3">Pick</th>
                <th className="label-nav text-xs text-text-muted text-right py-2">Grade</th>
              </tr>
            </thead>
            <tbody>
              {current.worst5.map((p, i) => (
                <tr key={`${p.season_year}-${p.overall_pick}`} style={{ borderBottom: "1px solid var(--color-border-light)" }}>
                  <td className="py-2.5 pr-2 label-nav text-xs text-text-faint">{i + 1}</td>
                  <td className="py-2.5 pr-3">
                    <div className="font-medium text-ink text-sm">{p.player_name}</div>
                    <div className="label-nav text-xs text-text-muted">{p.manager_id} · {p.season_year}</div>
                  </td>
                  <td className="py-2.5 pr-3 text-right font-mono text-xs text-text-muted">#{p.overall_pick}</td>
                  <td className="py-2.5 text-right font-mono text-sm font-semibold" style={{ color: "rgb(150,35,35)" }}>
                    {sign(p.grade4)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

      </div>
    </div>
  );
}
