"use client";

import { useState } from "react";

export interface TxPositionOwner {
  id: string;
  avgNet: number;
  avgScore: number;
  picks: number;
}

export interface TxPositionPick {
  season_year: number;
  gain_week: number;
  add_player: string;
  drop_player: string | null;
  manager_id: string;
  net_pts: number;
  transaction_score_alltime: number;
}

export interface TxPositionData {
  position: string;
  ownerRankings: TxPositionOwner[];
  top5: TxPositionPick[];
  worst5: TxPositionPick[];
}

const POSITIONS = ["QB", "RB", "WR", "TE", "K", "DST"];
const POS_LABEL: Record<string, string> = {
  QB: "Quarterback", RB: "Running Back", WR: "Wide Receiver",
  TE: "Tight End", K: "Kicker", DST: "Defense",
};

export default function TransactionPositionStats({ data }: { data: TxPositionData[] }) {
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
                <th className="label-nav text-xs text-text-muted text-right py-2 pr-4">Ø Net</th>
                <th className="label-nav text-xs text-text-muted text-right py-2">Moves</th>
              </tr>
            </thead>
            <tbody>
              {current.ownerRankings.map((o, i) => (
                <tr key={o.id} style={{ borderBottom: "1px solid var(--color-border-light)" }}>
                  <td className="py-2.5 pr-3 label-nav text-xs text-text-faint">{i + 1}</td>
                  <td className="py-2.5 pr-4 font-semibold text-ink">{o.id}</td>
                  <td
                    className="py-2.5 pr-4 text-right font-mono text-sm font-semibold"
                    style={{ color: o.avgNet >= 0 ? "#1a1a1a" : "rgb(150,35,35)" }}
                  >
                    {o.avgNet >= 0 ? "+" : ""}{o.avgNet.toFixed(1)}
                  </td>
                  <td className="py-2.5 text-right font-mono text-xs text-text-muted">{o.picks}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Top 5 */}
        <div>
          <div className="label-nav text-xs text-text-muted mb-3 uppercase tracking-wider">Top 5 Moves</div>
          <table className="w-full text-sm" style={{ borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #1a1a1a" }}>
                <th className="label-nav text-xs text-text-muted text-left py-2 pr-2">#</th>
                <th className="label-nav text-xs text-text-muted text-left py-2 pr-3">Add / Drop</th>
                <th className="label-nav text-xs text-text-muted text-right py-2">Net</th>
              </tr>
            </thead>
            <tbody>
              {current.top5.map((p, i) => (
                <tr key={`top-${i}-${p.season_year}-${p.add_player}`} style={{ borderBottom: "1px solid var(--color-border-light)" }}>
                  <td className="py-2.5 pr-2 label-nav text-xs text-text-faint">{i + 1}</td>
                  <td className="py-2.5 pr-3">
                    <div className="font-medium text-ink text-sm">{p.add_player}</div>
                    {p.drop_player && (
                      <div className="label-nav text-xs text-text-muted">− {p.drop_player}</div>
                    )}
                    <div className="label-nav text-xs text-text-faint">{p.manager_id} · {p.season_year} Wk{p.gain_week}</div>
                  </td>
                  <td className="py-2.5 text-right font-mono text-sm font-semibold text-ink">
                    {p.net_pts >= 0 ? "+" : ""}{p.net_pts.toFixed(1)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Worst 5 */}
        <div>
          <div className="label-nav text-xs text-text-muted mb-3 uppercase tracking-wider">Worst 5 Moves</div>
          <table className="w-full text-sm" style={{ borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #1a1a1a" }}>
                <th className="label-nav text-xs text-text-muted text-left py-2 pr-2">#</th>
                <th className="label-nav text-xs text-text-muted text-left py-2 pr-3">Add / Drop</th>
                <th className="label-nav text-xs text-text-muted text-right py-2">Net</th>
              </tr>
            </thead>
            <tbody>
              {current.worst5.map((p, i) => (
                <tr key={`worst-${i}-${p.season_year}-${p.add_player}`} style={{ borderBottom: "1px solid var(--color-border-light)" }}>
                  <td className="py-2.5 pr-2 label-nav text-xs text-text-faint">{i + 1}</td>
                  <td className="py-2.5 pr-3">
                    <div className="font-medium text-ink text-sm">{p.add_player}</div>
                    {p.drop_player && (
                      <div className="label-nav text-xs text-text-muted">− {p.drop_player}</div>
                    )}
                    <div className="label-nav text-xs text-text-faint">{p.manager_id} · {p.season_year} Wk{p.gain_week}</div>
                  </td>
                  <td className="py-2.5 text-right font-mono text-sm font-semibold" style={{ color: "rgb(150,35,35)" }}>
                    {p.net_pts >= 0 ? "+" : ""}{p.net_pts.toFixed(1)}
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
