"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { SEASONS, CURRENT_SEASON, MANAGERS } from "@/lib/constants";

interface TxRow {
  transaction_id: string;
  season_year: number;
  gain_week: number;
  transaction_at: string;
  manager_id: string;
  add_player: string;
  add_pos: string;
  drop_player: string | null;
  drop_pos: string | null;
  add_pts: number;
  drop_pts: number;
  net_pts: number;
  net_pts_adj: number;
  window_weeks: number;
  transaction_score: number;
}

const POS_COLORS: Record<string, string> = {
  QB: "#c0392b", RB: "#2980b9", WR: "#27ae60", TE: "#8e44ad",
  K: "#e67e22", DST: "#7f8c8d", DEF: "#7f8c8d",
};

function scoreStyle(s: number): { color: string; bg: string } {
  if (s >= 80) return { color: "#1a1a1a",          bg: "rgba(26,26,26,0.07)" };
  if (s >= 60) return { color: "#1a1a1a",          bg: "transparent" };
  if (s >= 40) return { color: "var(--color-text-secondary)", bg: "transparent" };
  if (s >= 20) return { color: "rgb(150,35,35)",   bg: "rgba(160,40,40,0.04)" };
  return              { color: "rgb(130,20,20)",   bg: "rgba(160,40,40,0.08)" };
}

function posTag(pos: string | null, faint = false) {
  if (!pos) return null;
  const p = pos === "DEF" ? "DST" : pos;
  const c = POS_COLORS[p] ?? "#999";
  return (
    <span
      className="label-nav text-xs px-1.5 py-0.5 rounded font-semibold"
      style={{
        background: faint ? `${c}18` : `${c}22`,
        color: faint ? "var(--color-text-muted)" : c,
      }}
    >
      {p}
    </span>
  );
}

export default function TransactionBrowser() {
  const [season, setSeason] = useState(CURRENT_SEASON);
  const [manager, setManager] = useState<string | "all">("all");
  const [rows, setRows] = useState<TxRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    supabase
      .from("fa_transaction_scores")
      .select("transaction_id, season_year, gain_week, transaction_at, manager_id, add_player, add_pos, drop_player, drop_pos, add_pts, drop_pts, net_pts, net_pts_adj, window_weeks, transaction_score")
      .eq("season_year", season)
      .order("gain_week", { ascending: true })
      .order("transaction_at", { ascending: true })
      .then(({ data }) => {
        setRows((data ?? []).map((r) => ({
          ...r,
          add_pts: Number(r.add_pts),
          drop_pts: Number(r.drop_pts),
          net_pts: Number(r.net_pts),
          net_pts_adj: Number(r.net_pts_adj),
          window_weeks: Number(r.window_weeks),
          transaction_score: Number(r.transaction_score),
        })));
        setLoading(false);
      });
  }, [season]);

  const filtered = manager === "all" ? rows : rows.filter((r) => r.manager_id === manager);

  // Group by week
  const byWeek: Record<number, TxRow[]> = {};
  for (const r of filtered) {
    (byWeek[r.gain_week] ??= []).push(r);
  }
  const weeks = Object.keys(byWeek).map(Number).sort((a, b) => a - b);

  const adds    = filtered.length;
  const avgNet  = adds > 0 ? filtered.reduce((s, r) => s + r.net_pts, 0) / adds : 0;

  return (
    <div>
      {/* Controls */}
      <div className="flex flex-wrap gap-4 mb-6 items-end">
        <div>
          <label className="kicker block mb-2 text-xs">Saison</label>
          <select
            value={season}
            onChange={(e) => setSeason(Number(e.target.value))}
            className="label-nav text-xs px-3 py-2 bg-cream border border-border text-ink"
            style={{ minWidth: "120px" }}
          >
            {SEASONS.slice().reverse().map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="kicker block mb-2 text-xs">Owner</label>
          <select
            value={manager}
            onChange={(e) => setManager(e.target.value)}
            className="label-nav text-xs px-3 py-2 bg-cream border border-border text-ink"
            style={{ minWidth: "140px" }}
          >
            <option value="all">Alle</option>
            {MANAGERS.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>
        {!loading && (
          <div className="pb-2 label-nav text-xs text-text-muted">
            {adds} Moves · Ø Net{" "}
            <span style={{ color: avgNet >= 0 ? "#1a1a1a" : "rgb(150,35,35)" }}>
              {avgNet >= 0 ? "+" : ""}{avgNet.toFixed(1)}
            </span>
          </div>
        )}
      </div>

      {loading ? (
        <div className="text-text-muted text-center py-12 label-nav text-xs">Lade Transactions...</div>
      ) : (
        <div className="space-y-8">
          {weeks.map((week) => (
            <div key={week}>
              <div className="label-nav text-xs text-text-muted mb-2 pb-1" style={{ borderBottom: "1px solid #1a1a1a" }}>
                Woche {week}
              </div>

              {/* Table header */}
              <div className="hidden md:grid grid-cols-[80px_1fr_1fr_44px_44px_68px_52px] gap-3 px-3 pb-1">
                {["Owner","+ Add","− Drop","Add","Drop","Adj Net","Score"].map((h) => (
                  <div key={h} className="label-nav text-text-faint" style={{ fontSize: "9px" }}>{h}</div>
                ))}
              </div>

              <div className="space-y-px">
                {byWeek[week].map((tx) => {
                  const ss = scoreStyle(tx.transaction_score);
                  return (
                    <div
                      key={`${tx.transaction_id}-${tx.add_player}`}
                      className="grid grid-cols-[80px_1fr_1fr_44px_44px_68px_52px] gap-3 items-center px-3 py-2.5 rounded"
                      style={{ background: ss.bg, borderBottom: "1px solid var(--color-border-light)" }}
                    >
                      {/* Owner */}
                      <div className="label-nav text-xs font-semibold text-ink truncate">{tx.manager_id}</div>

                      {/* Add */}
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="text-xs font-bold flex-shrink-0" style={{ color: "#27ae60" }}>+</span>
                        {posTag(tx.add_pos)}
                        <span className="text-sm font-medium text-ink truncate">{tx.add_player}</span>
                      </div>

                      {/* Drop */}
                      <div className="flex items-center gap-1.5 min-w-0">
                        {tx.drop_player ? (
                          <>
                            <span className="text-xs font-bold flex-shrink-0 text-text-muted">−</span>
                            {posTag(tx.drop_pos, true)}
                            <span className="text-sm text-text-secondary truncate">{tx.drop_player}</span>
                          </>
                        ) : (
                          <span className="label-nav text-xs text-text-faint">—</span>
                        )}
                      </div>

                      {/* Add pts (raw) */}
                      <div className="text-right font-mono text-xs text-text-secondary" title={`${tx.window_weeks}w`}>
                        {tx.add_pts.toFixed(0)}
                      </div>

                      {/* Drop pts (raw) */}
                      <div className="text-right font-mono text-xs text-text-muted">
                        {tx.drop_pts > 0 ? tx.drop_pts.toFixed(0) : "—"}
                      </div>

                      {/* Net pts adjusted (primary metric) */}
                      <div className="text-right" title={`Raw: ${tx.net_pts >= 0 ? "+" : ""}${tx.net_pts.toFixed(1)}`}>
                        <span className="font-mono text-sm font-semibold" style={{ color: ss.color }}>
                          {tx.net_pts_adj >= 0 ? "+" : ""}{tx.net_pts_adj.toFixed(1)}
                        </span>
                        <span className="label-nav text-text-faint ml-1" style={{ fontSize: "9px" }}>
                          {tx.window_weeks}w
                        </span>
                      </div>

                      {/* Percentile score */}
                      <div className="text-right font-mono text-xs" style={{ color: ss.color }}>
                        {tx.transaction_score.toFixed(0)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
