"use client";

import { useState, useMemo } from "react";
import { SEASONS, MANAGERS } from "@/lib/constants";

export interface VTxRow {
  season_year: number;
  transaction_id: string;
  transaction_type: string;
  team_name: string;
  transaction_week: number;
  transaction_at: string;
  add_players: string | null;
  add_positions: string | null;
  drop_players: string | null;
  drop_positions: string | null;
  gain_value: number;
  loss_value: number;
  net_value: number;
  scored_value: number | null;
  is_meaningful: boolean;
}

export interface FaTxRow {
  season_year: number;
  team_name: string;
  transaction_type: string;
  item_direction: string;
  player_name: string;
  position: string;
  nfl_team: string;
  item_value: number;
  transaction_week: number;
}

function fmt(v: number, digits = 1) {
  return (v >= 0 ? "+" : "") + v.toFixed(digits);
}
function valColor(v: number) {
  return v >= 0 ? "#1a1a1a" : "rgb(150,35,35)";
}
function pct(n: number, d: number) {
  return d === 0 ? "—" : Math.round((n / d) * 100) + "%";
}

const POS_LIST = ["QB", "RB", "WR", "TE", "K", "DEF"];
const POS_LABEL: Record<string, string> = {
  QB: "Quarterback", RB: "Running Back", WR: "Wide Receiver",
  TE: "Tight End", K: "Kicker", DEF: "Defense / ST",
};

// ── Shared SVG tooltip ───────────────────────────────────────────────────────
function SvgTooltip({ x, y, lines, W, H }: { x: number; y: number; lines: string[]; W: number; H: number }) {
  const PAD = 6, LINE_H = 13, boxW = 110;
  const boxH = lines.length * LINE_H + PAD * 2;
  const tx = x + 10 + boxW > W ? x - boxW - 8 : x + 10;
  const ty = y - boxH / 2 < 0 ? 4 : y + boxH / 2 > H ? H - boxH - 4 : y - boxH / 2;
  return (
    <g pointerEvents="none">
      <rect x={tx} y={ty} width={boxW} height={boxH} rx={3}
        fill="#1a1a1a" opacity={0.88} />
      {lines.map((l, i) => (
        <text key={i} x={tx + PAD} y={ty + PAD + LINE_H * i + 9}
          style={{ fontSize: "10px", fill: "#fff", fontFamily: "inherit", fontWeight: i === 0 ? "600" : "400" }}>
          {l}
        </text>
      ))}
    </g>
  );
}

// ── Activity chart (years or weeks) ─────────────────────────────────────────
function ActivityChart({ data }: {
  data: { label: string; transactions: number; trades: number }[];
}) {
  const [tip, setTip] = useState<{ x: number; y: number; lines: string[] } | null>(null);
  const W = 800, H = 180;
  const PAD = { l: 42, r: 42, t: 15, b: 28 };
  const plotW = W - PAD.l - PAD.r;
  const plotH = H - PAD.t - PAD.b;
  const n = Math.max(data.length, 1);
  const slotW = plotW / n;

  const maxTx = Math.max(...data.map(d => d.transactions), 1);
  const maxTr = Math.max(...data.map(d => d.trades), 1);

  const lx = (i: number) => PAD.l + (i + 0.5) * slotW;
  const ly = (v: number) => PAD.t + plotH - (v / maxTx) * plotH;
  const ry = (v: number) => PAD.t + plotH - (v / maxTr) * plotH;
  const rh = (v: number) => (v / maxTr) * plotH;
  const showEvery = data.length > 14 ? 2 : 1;
  const points = data.map((d, i) => `${lx(i)},${ly(d.transactions)}`).join(" ");

  return (
    <div>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: "visible" }}
        onMouseLeave={() => setTip(null)}>
        {[0.25, 0.5, 0.75, 1].map(p => (
          <line key={p} x1={PAD.l} x2={W - PAD.r}
            y1={PAD.t + plotH * (1 - p)} y2={PAD.t + plotH * (1 - p)}
            stroke="#e0e0e0" strokeWidth="0.5" />
        ))}
        {data.map((d, i) => (
          <rect key={i} x={PAD.l + i * slotW + slotW * 0.3} y={ry(d.trades)}
            width={slotW * 0.4} height={rh(d.trades)} fill="#1a1a1a" opacity={0.2}
            style={{ cursor: "pointer" }}
            onMouseEnter={() => setTip({ x: lx(i), y: ry(d.trades) + rh(d.trades) / 2, lines: [d.label, `Trades: ${d.trades}`] })} />
        ))}
        {data.length > 1 && <polyline points={points} fill="none" stroke="#1a1a1a" strokeWidth="2" />}
        {data.map((d, i) => (
          <circle key={`dot-${i}`} cx={lx(i)} cy={ly(d.transactions)} r="5" fill="transparent"
            style={{ cursor: "pointer" }}
            onMouseEnter={() => setTip({ x: lx(i), y: ly(d.transactions), lines: [d.label, `Transactions: ${d.transactions}`, `Trades: ${d.trades}`] })} />
        ))}
        {data.map((d, i) => (
          <circle key={`dot-vis-${i}`} cx={lx(i)} cy={ly(d.transactions)} r="3" fill="#1a1a1a" pointerEvents="none" />
        ))}
        {data.map((d, i) => i % showEvery === 0 && (
          <text key={`xl-${i}`} x={lx(i)} y={H - 2} textAnchor="middle"
            style={{ fontSize: "10px", fill: "var(--color-text-muted)", fontFamily: "inherit" }}>
            {d.label}
          </text>
        ))}
        {[maxTx, Math.round(maxTx / 2), 0].map((v, i) => (
          <text key={`ly-${i}`} x={PAD.l - 4} y={PAD.t + (i / 2) * plotH + 4} textAnchor="end"
            style={{ fontSize: "9px", fill: "var(--color-text-muted)", fontFamily: "inherit" }}>{v}</text>
        ))}
        {[maxTr, Math.round(maxTr / 2), 0].map((v, i) => (
          <text key={`ry-${i}`} x={W - PAD.r + 4} y={PAD.t + (i / 2) * plotH + 4} textAnchor="start"
            style={{ fontSize: "9px", fill: "var(--color-text-muted)", fontFamily: "inherit" }}>{v}</text>
        ))}
        {tip && <SvgTooltip x={tip.x} y={tip.y} lines={tip.lines} W={W} H={H} />}
      </svg>
      <div className="flex gap-6 mt-2">
        <div className="flex items-center gap-2 label-nav text-xs text-text-muted">
          <span style={{ display: "inline-block", width: 16, height: 2, background: "#1a1a1a", verticalAlign: "middle" }} />
          Transactions (links)
        </div>
        <div className="flex items-center gap-2 label-nav text-xs text-text-muted">
          <span style={{ display: "inline-block", width: 12, height: 8, background: "rgba(26,26,26,0.2)", verticalAlign: "middle" }} />
          Trades (rechts)
        </div>
      </div>
    </div>
  );
}

// ── Team transaction chart ───────────────────────────────────────────────────
function TeamChart({ data, mode }: {
  data: { team: string; value: number; posValue: number; hitRate: number; count: number }[];
  mode: "value" | "hitrate";
}) {
  const [tip, setTip] = useState<{ x: number; y: number; lines: string[] } | null>(null);
  const W = 900, H = 220;
  const PAD = { l: 50, r: 50, t: 20, b: 50 };
  const plotW = W - PAD.l - PAD.r;
  const plotH = H - PAD.t - PAD.b;
  const n = Math.max(data.length, 1);
  const slotW = plotW / n;

  const lineVals = mode === "hitrate" ? data.map(d => d.hitRate) : data.map(d => d.posValue);
  const maxCount = Math.max(...data.map(d => d.count), 1);
  const maxVal   = Math.max(...lineVals, 0.1);
  const valRange = maxVal || 1;

  const lx   = (i: number) => PAD.l + (i + 0.5) * slotW;
  const ly   = (v: number) => PAD.t + plotH * (1 - v / valRange);
  const barH = (c: number) => (c / maxCount) * plotH;
  const barY = (c: number) => PAD.t + plotH - barH(c);

  const linePoints = lineVals.map((v, i) => `${lx(i)},${ly(v)}`).join(" ");

  return (
    <div>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: "visible" }}
        onMouseLeave={() => setTip(null)}>
        {/* Grid */}
        {[0, 0.25, 0.5, 0.75, 1].map(p => (
          <line key={p} x1={PAD.l} x2={W - PAD.r}
            y1={PAD.t + plotH * p} y2={PAD.t + plotH * p}
            stroke="#e0e0e0" strokeWidth="0.5" />
        ))}
        {/* Count bars */}
        {data.map((d, i) => (
          <rect key={`bar-${i}`}
            x={PAD.l + i * slotW + slotW * 0.25} y={barY(d.count)}
            width={slotW * 0.5} height={barH(d.count)}
            fill="#1a1a1a" opacity={0.15} style={{ cursor: "pointer" }}
            onMouseEnter={() => setTip({ x: lx(i), y: barY(d.count) + barH(d.count) / 2, lines: [d.team, `Adds: ${d.count}`] })} />
        ))}
        {/* Value / hit-rate line */}
        {data.length > 1 && <polyline points={linePoints} fill="none" stroke="#1a1a1a" strokeWidth="1.5" />}
        {lineVals.map((v, i) => (
          <circle key={`dot-hit-${i}`} cx={lx(i)} cy={ly(v)} r="6" fill="transparent" style={{ cursor: "pointer" }}
            onMouseEnter={() => setTip({
              x: lx(i), y: ly(v),
              lines: [data[i].team,
                mode === "hitrate" ? `Hit Rate: ${v.toFixed(1)}%` : `Pos. Value: ${v.toFixed(1)}`,
                `Adds: ${data[i].count}`],
            })} />
        ))}
        {lineVals.map((v, i) => (
          <circle key={`dot-${i}`} cx={lx(i)} cy={ly(v)} r="2.5" fill="#1a1a1a" pointerEvents="none" />
        ))}
        {/* X labels — rotated 45° */}
        {data.map((d, i) => (
          <text key={`xl-${i}`}
            x={lx(i)} y={H - PAD.b + 12}
            textAnchor="end"
            transform={`rotate(-45, ${lx(i)}, ${H - PAD.b + 12})`}
            style={{ fontSize: "9px", fill: "var(--color-text-muted)", fontFamily: "inherit" }}>
            {d.team}
          </text>
        ))}
        {/* Left Y axis */}
        {[maxVal, maxVal / 2, 0].map((v, i) => (
          <text key={`lv-${i}`} x={PAD.l - 4} y={ly(v) + 4} textAnchor="end"
            style={{ fontSize: "9px", fill: "var(--color-text-muted)", fontFamily: "inherit" }}>
            {mode === "hitrate" ? v.toFixed(0) + "%" : v.toFixed(0)}
          </text>
        ))}
        {/* Right Y axis (count) */}
        {[maxCount, Math.round(maxCount / 2), 0].map((v, i) => (
          <text key={`rc-${i}`} x={W - PAD.r + 4} y={PAD.t + (i / 2) * plotH + 4} textAnchor="start"
            style={{ fontSize: "9px", fill: "var(--color-text-muted)", fontFamily: "inherit" }}>{v}</text>
        ))}
        {tip && <SvgTooltip x={tip.x} y={tip.y} lines={tip.lines} W={W} H={H} />}
      </svg>
      <div className="flex gap-6 mt-2">
        <div className="flex items-center gap-2 label-nav text-xs text-text-muted">
          <span style={{ display: "inline-block", width: 16, height: 2, background: "#1a1a1a", verticalAlign: "middle" }} />
          {mode === "hitrate" ? "Hit Rate % (links)" : "Positive Value (links)"}
        </div>
        <div className="flex items-center gap-2 label-nav text-xs text-text-muted">
          <span style={{ display: "inline-block", width: 12, height: 8, background: "rgba(26,26,26,0.15)", verticalAlign: "middle" }} />
          Total Transactions (rechts)
        </div>
      </div>
    </div>
  );
}

// ── Ranking table ────────────────────────────────────────────────────────────
function RankingTable({ rows, label }: { rows: { team: string; value: number }[]; label: string }) {
  return (
    <div className="overflow-x-auto"><table className="w-full text-sm" style={{ borderCollapse: "collapse" }}>
      <thead>
        <tr style={{ borderBottom: "2px solid #1a1a1a" }}>
          <th className="label-nav text-xs text-text-muted text-left py-2 pr-2">#</th>
          <th className="label-nav text-xs text-text-muted text-left py-2 pr-4">Owner</th>
          <th className="label-nav text-xs text-text-muted text-right py-2">{label}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={r.team} style={{ borderBottom: "1px solid var(--color-border-light)" }}>
            <td className="py-2.5 pr-2 label-nav text-xs text-text-faint">{i + 1}</td>
            <td className="py-2.5 pr-4 font-semibold text-ink">{r.team}</td>
            <td className="py-2.5 text-right font-mono text-sm font-semibold"
              style={{ color: valColor(r.value) }}>{fmt(r.value)}</td>
          </tr>
        ))}
      </tbody>
    </table></div>
  );
}

// ── Waiver move table ────────────────────────────────────────────────────────
function WaiverTable({ rows, best }: { rows: VTxRow[]; best: boolean }) {
  return (
    <div className="overflow-x-auto"><table className="w-full text-sm" style={{ borderCollapse: "collapse" }}>
      <thead>
        <tr style={{ borderBottom: "2px solid #1a1a1a" }}>
          <th className="label-nav text-xs text-text-muted text-left py-2 pr-2">#</th>
          <th className="label-nav text-xs text-text-muted text-left py-2 pr-3">Add / Drop</th>
          <th className="label-nav text-xs text-text-muted text-left py-2 pr-3">Owner</th>
          <th className="label-nav text-xs text-text-muted text-right py-2">Value</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={`${r.transaction_id}-${r.team_name}-${i}`}
            style={{ borderBottom: "1px solid var(--color-border-light)" }}>
            <td className="py-2.5 pr-2 label-nav text-xs text-text-faint">{i + 1}</td>
            <td className="py-2.5 pr-3">
              <div className="font-medium text-ink text-sm">{r.add_players ?? "—"}</div>
              {r.drop_players && <div className="label-nav text-xs text-text-muted">− {r.drop_players}</div>}
              <div className="label-nav text-xs text-text-faint">{r.season_year} · Wk{r.transaction_week}</div>
            </td>
            <td className="py-2.5 pr-3 label-nav text-xs text-ink">{r.team_name}</td>
            <td className="py-2.5 text-right font-mono text-sm font-semibold"
              style={{ color: best ? "#1a1a1a" : "rgb(150,35,35)" }}>
              {fmt(best ? (r.scored_value ?? 0) : r.gain_value)}
            </td>
          </tr>
        ))}
      </tbody>
    </table></div>
  );
}

// ── Trade side cell ──────────────────────────────────────────────────────────
function TradeSide({ side }: { side: VTxRow | null }) {
  if (!side) return <div className="flex-1 px-3 py-2 text-text-faint label-nav text-xs">—</div>;
  return (
    <div className="flex-1 px-3 py-2 min-w-0">
      <div className="font-semibold text-ink text-sm mb-0.5">{side.team_name}</div>
      {side.add_players && (
        <div className="text-xs text-ink">
          <span className="text-green-700 font-bold mr-1">+</span>{side.add_players}
        </div>
      )}
      {side.drop_players && (
        <div className="text-xs text-text-muted">
          <span className="font-bold mr-1">−</span>{side.drop_players}
        </div>
      )}
      <div className="font-mono text-sm font-bold mt-1" style={{ color: valColor(side.net_value) }}>
        {fmt(side.net_value)}
      </div>
    </div>
  );
}

// ── Main Dashboard ───────────────────────────────────────────────────────────
export default function TransactionDashboard({ vtx, fatx }: { vtx: VTxRow[]; fatx: FaTxRow[] }) {
  const [season, setSeason] = useState<number | "all">("all");
  const [owner, setOwner]   = useState<string>("all");
  const [posTab, setPosTab] = useState("QB");
  const [teamChartMode, setTeamChartMode] = useState<"value" | "hitrate">("value");
  const [view, setView] = useState<"stats" | "log">("stats");

  const ownerFiltered  = owner !== "all";
  const seasonFiltered = season !== "all";
  const isFiltered     = ownerFiltered || seasonFiltered;

  // Filtered datasets
  const filt = useMemo(() => vtx.filter(r =>
    (season === "all" || r.season_year === season) &&
    (owner === "all" || r.team_name === owner)
  ), [vtx, season, owner]);

  const filtFatx = useMemo(() => fatx.filter(r =>
    (season === "all" || r.season_year === season) &&
    (owner === "all" || r.team_name === owner)
  ), [fatx, season, owner]);

  // Header counts
  const waiverRows   = filt.filter(r => r.transaction_type !== "trade");
  const tradeRows    = filt.filter(r => r.transaction_type === "trade");
  const uniqueTrades = ownerFiltered ? tradeRows.length : Math.round(tradeRows.length / 2);
  const totalTx      = waiverRows.length + uniqueTrades;

  // Owner-specific positive % stats
  const ownerStats = useMemo(() => {
    if (!ownerFiltered) return null;
    const waiverMoves = filt.filter(r => r.transaction_type !== "trade" && r.add_players != null);
    const posWaiver   = waiverMoves.filter(r => r.gain_value > 0).length;
    const tradeSides  = filt.filter(r => r.transaction_type === "trade");
    const posTrades   = tradeSides.filter(r => r.net_value > 0).length;
    return {
      waiverPct: pct(posWaiver, waiverMoves.length),
      tradePct:  pct(posTrades, tradeSides.length),
      waiverN:   waiverMoves.length,
      tradeN:    tradeSides.length,
    };
  }, [filt, ownerFiltered]);

  // Chart data
  const chartData = useMemo(() => {
    const base = ownerFiltered ? vtx.filter(r => r.team_name === owner) : vtx;
    if (seasonFiltered) {
      const rows = base.filter(r => r.season_year === season);
      const maxWeek = Math.max(...rows.map(r => r.transaction_week), 0);
      return Array.from({ length: maxWeek }, (_, i) => {
        const wk = i + 1;
        const wkR = rows.filter(r => r.transaction_week === wk);
        const waiver = wkR.filter(r => r.transaction_type !== "trade").length;
        const trR    = wkR.filter(r => r.transaction_type === "trade").length;
        const trades = ownerFiltered ? trR : Math.round(trR / 2);
        return { label: `W${wk}`, transactions: waiver + trades, trades };
      });
    }
    return SEASONS.map(yr => {
      const yrR    = base.filter(r => r.season_year === yr);
      const waiver = yrR.filter(r => r.transaction_type !== "trade").length;
      const trR    = yrR.filter(r => r.transaction_type === "trade").length;
      const trades = ownerFiltered ? trR : Math.round(trR / 2);
      return { label: String(yr).slice(2), transactions: waiver + trades, trades };
    });
  }, [vtx, owner, season, ownerFiltered, seasonFiltered]);

  // Rankings (only when owner not filtered)
  const teamRankings = useMemo(() => {
    if (ownerFiltered) return [];
    return MANAGERS.map(team => {
      const tv = seasonFiltered ? filt.filter(r => r.team_name === team) : vtx.filter(r => r.team_name === team);
      const numSeasons = seasonFiltered ? 1 : (new Set(tv.map(r => r.season_year)).size || 1);
      const waiverVal  = tv.filter(r => r.transaction_type !== "trade" && r.is_meaningful && r.scored_value != null)
        .reduce((s, r) => s + (r.scored_value ?? 0), 0);
      const tradeVal   = tv.filter(r => r.transaction_type === "trade").reduce((s, r) => s + r.net_value, 0);
      return { team, waiverAvg: waiverVal / numSeasons, tradeAvg: tradeVal / numSeasons, totalAvg: (waiverVal + tradeVal) / numSeasons };
    });
  }, [filt, vtx, ownerFiltered, seasonFiltered]);

  const rankingLabel = seasonFiltered ? "Total" : "Ø/Saison";

  // Season records (only when owner not filtered)
  const seasonRecords = useMemo(() => {
    if (ownerFiltered) return null;
    const base = seasonFiltered ? filt : vtx;
    const wm: Record<string, { team: string; season: number; total: number }> = {};
    for (const r of base.filter(r => r.transaction_type !== "trade" && r.is_meaningful && r.scored_value != null)) {
      const k = `${r.team_name}-${r.season_year}`;
      (wm[k] ??= { team: r.team_name, season: r.season_year, total: 0 }).total += r.scored_value ?? 0;
    }
    const wl = Object.values(wm).sort((a, b) => b.total - a.total);
    const tm: Record<string, { team: string; season: number; total: number }> = {};
    for (const r of base.filter(r => r.transaction_type === "trade")) {
      const k = `${r.team_name}-${r.season_year}`;
      (tm[k] ??= { team: r.team_name, season: r.season_year, total: 0 }).total += r.net_value;
    }
    const tl = Object.values(tm).sort((a, b) => b.total - a.total);
    return {
      bestWaiver: wl[0] ?? null, worstWaiver: wl[wl.length - 1] ?? null,
      bestTrade:  tl[0] ?? null, worstTrade:  tl[tl.length - 1] ?? null,
    };
  }, [filt, vtx, ownerFiltered, seasonFiltered]);

  // Top / worst waiver
  const meaningful = filt.filter(r => r.transaction_type !== "trade" && r.is_meaningful && r.scored_value != null);
  const top10   = [...meaningful].sort((a, b) => (b.scored_value ?? 0) - (a.scored_value ?? 0)).slice(0, 10);
  const withAdd = filt.filter(r => r.transaction_type !== "trade" && r.add_players != null);
  const worst10 = [...withAdd].sort((a, b) => a.gain_value - b.gain_value).slice(0, 10);

  // Position stats
  const posStats = useMemo(() => POS_LIST.map(pos => {
    const rows  = filtFatx.filter(r => pos === "DEF" ? (r.position === "DEF" || r.position === "DST") : r.position === pos);
    const gains  = rows.filter(r => r.item_direction === "gain");
    const losses = rows.filter(r => r.item_direction === "loss");
    return {
      pos, totalAdded: gains.length, totalDropped: losses.length,
      topAdd:    [...gains].sort((a, b) => b.item_value - a.item_value)[0] ?? null,
      worstDrop: [...losses].sort((a, b) => b.item_value - a.item_value)[0] ?? null,
    };
  }), [filtFatx]);
  const curPos = posStats.find(p => p.pos === posTab)!;

  // Trade pairs
  const tradePairs = useMemo(() => {
    const filtTrades = filt.filter(r => r.transaction_type === "trade");
    const allTrades  = vtx.filter(r => r.transaction_type === "trade");
    const seen = new Set<string>();
    const pairs: { key: string; side1: VTxRow; side2: VTxRow | null }[] = [];
    for (const row of filtTrades) {
      const key = `${row.season_year}-${row.transaction_at}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const sides = allTrades.filter(r => r.season_year === row.season_year && r.transaction_at === row.transaction_at);
      pairs.push({ key, side1: sides.find(s => s.team_name === row.team_name) ?? row, side2: sides.find(s => s.team_name !== row.team_name) ?? null });
    }
    return pairs.sort((a, b) => {
      const aM = Math.max(Math.abs(a.side1.net_value), Math.abs(a.side2?.net_value ?? 0));
      const bM = Math.max(Math.abs(b.side1.net_value), Math.abs(b.side2?.net_value ?? 0));
      return bM - aM;
    }).slice(0, 15);
  }, [filt, vtx]);

  // Player & Team stats
  const playerTeamStats = useMemo(() => {
    const gains = filtFatx.filter(r => r.item_direction === "gain" && r.position !== "DEF" && r.position !== "DST");

    // By player
    const playerMap: Record<string, { count: number; value: number }> = {};
    for (const r of gains) {
      (playerMap[r.player_name] ??= { count: 0, value: 0 }).count++;
      playerMap[r.player_name].value += r.item_value;
    }
    const players = Object.entries(playerMap).map(([name, d]) => ({ name, ...d }));
    const mostTransactedPlayer = [...players].sort((a, b) => b.count - a.count)[0] ?? null;
    const mostValuePlayer      = [...players].sort((a, b) => b.value - a.value)[0] ?? null;

    // By NFL team
    const teamMap: Record<string, { count: number; value: number; posCount: number; posValue: number }> = {};
    for (const r of gains) {
      if (!r.nfl_team || r.nfl_team === "FA") continue;
      const entry = (teamMap[r.nfl_team] ??= { count: 0, value: 0, posCount: 0, posValue: 0 });
      entry.count++;
      entry.value += r.item_value;
      if (r.item_value > 0) { entry.posCount++; entry.posValue += r.item_value; }
    }
    const teams = Object.entries(teamMap).map(([team, d]) => ({
      team, ...d,
      hitRate: d.count > 0 ? (d.posCount / d.count) * 100 : 0,
    }));
    const mostTransactedTeam = [...teams].sort((a, b) => b.count - a.count)[0] ?? null;
    const mostValueTeam      = [...teams].sort((a, b) => b.posValue - a.posValue)[0] ?? null;

    // Chart: sorted by count desc, top 32
    const chartTeams = [...teams].sort((a, b) => b.count - a.count).slice(0, 32);

    return { mostTransactedPlayer, mostValuePlayer, mostTransactedTeam, mostValueTeam, chartTeams };
  }, [filtFatx]);

  return (
    <div>
      {/* ── Filters ── */}
      <div className="flex flex-wrap gap-4 mb-8 items-end">
        <div>
          <label className="kicker block mb-2 text-xs">Saison</label>
          <select value={season}
            onChange={e => { setSeason(e.target.value === "all" ? "all" : Number(e.target.value)); setView("stats"); }}
            className="label-nav text-xs px-3 py-2 bg-cream border border-border text-ink"
            style={{ minWidth: "120px" }}>
            <option value="all">Alle Saisons</option>
            {SEASONS.slice().reverse().map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className="kicker block mb-2 text-xs">Owner</label>
          <select value={owner} onChange={e => { setOwner(e.target.value); setView("stats"); }}
            className="label-nav text-xs px-3 py-2 bg-cream border border-border text-ink"
            style={{ minWidth: "140px" }}>
            <option value="all">Alle Owner</option>
            {MANAGERS.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        {isFiltered && (
          <div className="flex gap-1 ml-auto self-end">
            {(["stats", "log"] as const).map(v => (
              <button key={v} onClick={() => setView(v)}
                className="label-nav text-xs px-3 py-2"
                style={{
                  background: view === v ? "#1a1a1a" : "transparent",
                  color: view === v ? "#fff" : "var(--color-text-muted)",
                  border: "1px solid #e0e0e0",
                  borderRadius: "2px",
                }}>
                {v === "stats" ? "Statistiken" : "Transaction Log"}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Header Stats ── */}
      <div className="grid grid-cols-3 gap-4 mb-10">
        {[
          { label: "Waiver Moves", value: waiverRows.length.toLocaleString("de-DE"), sub: "Adds & Add/Drops" },
          { label: "Trades", value: uniqueTrades.toLocaleString("de-DE"), sub: "Einzigartige Trades" },
          { label: "Transactions", value: totalTx.toLocaleString("de-DE"), sub: "Waiver + Trades" },
        ].map(s => (
          <div key={s.label} className="cell p-5">
            <div className="kicker mb-1">{s.label}</div>
            <div className="display-title text-3xl text-ink">{s.value}</div>
            <div className="text-xs text-text-muted mt-1">{s.sub}</div>
          </div>
        ))}
      </div>

      {view === "log" && (
        <TransactionLog rows={filt} showOwner={!ownerFiltered} showSeason={!seasonFiltered} />
      )}

      {view === "stats" && (<>

      {/* ── Owner positive % stats (only when owner filtered) ── */}
      {ownerStats && (
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="cell p-4">
            <div className="kicker mb-1 text-xs">Waiver Hit Rate</div>
            <div className="display-title text-3xl text-ink">{ownerStats.waiverPct}</div>
            <div className="label-nav text-xs text-text-muted mt-1">
              positive Waiver Moves ({ownerStats.waiverN} total)
            </div>
          </div>
          <div className="cell p-4">
            <div className="kicker mb-1 text-xs">Trade Win Rate</div>
            <div className="display-title text-3xl text-ink">{ownerStats.tradePct}</div>
            <div className="label-nav text-xs text-text-muted mt-1">
              positive Trade Seiten ({ownerStats.tradeN} total)
            </div>
          </div>
        </div>
      )}

      {/* ── Chart ── */}
      <div className="cell p-5 mb-10">
        <div className="kicker mb-3">
          {seasonFiltered ? `${season} — Aktivität per Woche` : "Aktivität per Saison"}
        </div>
        <ActivityChart data={chartData} />
      </div>

      {/* ── Team Rankings & Season Records (only when owner NOT filtered) ── */}
      {!ownerFiltered && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-10">
            <div>
              <div className="kicker mb-1">Waiver</div>
              <h3 className="display-title text-lg text-ink mb-1">Waiver Rankings</h3>
              <div className="label-nav text-xs text-text-faint mb-4">
                {seasonFiltered ? "Diese Saison" : "All Time Avg. per Saison"}
              </div>
              <RankingTable
                rows={[...teamRankings].sort((a, b) => b.waiverAvg - a.waiverAvg).map(r => ({ team: r.team, value: r.waiverAvg }))}
                label={rankingLabel}
              />
            </div>
            <div>
              <div className="kicker mb-1">Trades</div>
              <h3 className="display-title text-lg text-ink mb-1">Trade Rankings</h3>
              <div className="label-nav text-xs text-text-faint mb-4">
                {seasonFiltered ? "Diese Saison" : "All Time Avg. per Saison"}
              </div>
              <RankingTable
                rows={[...teamRankings].sort((a, b) => b.tradeAvg - a.tradeAvg).map(r => ({ team: r.team, value: r.tradeAvg }))}
                label={rankingLabel}
              />
            </div>
            <div>
              <div className="kicker mb-1">Gesamt</div>
              <h3 className="display-title text-lg text-ink mb-1">Manager Rankings</h3>
              <div className="label-nav text-xs text-text-faint mb-4">
                {seasonFiltered ? "Diese Saison" : "All Time Avg. per Saison"}
              </div>
              <RankingTable
                rows={[...teamRankings].sort((a, b) => b.totalAvg - a.totalAvg).map(r => ({ team: r.team, value: r.totalAvg }))}
                label={rankingLabel}
              />
            </div>
          </div>

          {seasonRecords && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
              {[
                { label: "Beste Waiver Saison",       data: seasonRecords.bestWaiver,  pos: true  },
                { label: "Schlechteste Waiver Saison", data: seasonRecords.worstWaiver, pos: false },
                { label: "Beste Trade Saison",         data: seasonRecords.bestTrade,   pos: true  },
                { label: "Schlechteste Trade Saison",  data: seasonRecords.worstTrade,  pos: false },
              ].map(({ label, data, pos }) => (
                <div key={label} className="cell p-4">
                  <div className="kicker mb-2 text-xs">{label}</div>
                  {data ? (
                    <>
                      <div className="font-semibold text-ink text-base">{data.team}</div>
                      {!seasonFiltered && <div className="label-nav text-xs text-text-muted mb-1">{data.season}</div>}
                      <div className="font-mono text-xl font-bold" style={{ color: pos ? "#1a1a1a" : "rgb(150,35,35)" }}>
                        {fmt(data.total)}
                      </div>
                    </>
                  ) : <div className="text-text-faint text-xs label-nav">—</div>}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── Top 10 / Worst 10 Waiver ── */}
      <div style={{ borderTop: "2px solid #1a1a1a", paddingTop: "2rem" }} className="mb-10">
        <div className="kicker mb-1">Waiver</div>
        <h2 className="display-title text-2xl text-ink mb-6">Beste &amp; Schlechteste Moves</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div>
            <div className="kicker mb-3">Top 10 Waiver Moves</div>
            <WaiverTable rows={top10} best={true} />
          </div>
          <div>
            <div className="kicker mb-3">Worst 10 Waiver Moves</div>
            <WaiverTable rows={worst10} best={false} />
          </div>
        </div>
      </div>

      {/* ── Position Stats ── */}
      <div style={{ borderTop: "2px solid #1a1a1a", paddingTop: "2rem" }} className="mb-10">
        <div className="kicker mb-1">Positionen</div>
        <h2 className="display-title text-2xl text-ink mb-6">Position Stats</h2>
        <div className="flex flex-wrap gap-1 mb-6">
          {POS_LIST.map(p => (
            <button key={p} onClick={() => setPosTab(p)}
              className={`px-4 py-1.5 label-nav text-xs transition-colors border ${
                p === posTab ? "bg-ink text-cream border-ink" : "bg-transparent text-text-muted border-border hover:text-ink hover:border-ink"
              }`}>
              {p}
            </button>
          ))}
        </div>
        <div className="kicker mb-4">{POS_LABEL[posTab] ?? posTab}</div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="cell p-4">
            <div className="kicker mb-1 text-xs">Total Added</div>
            <div className="display-title text-3xl text-ink">{curPos.totalAdded}</div>
          </div>
          <div className="cell p-4">
            <div className="kicker mb-1 text-xs">Top Value Add</div>
            {curPos.topAdd ? (
              <>
                <div className="font-semibold text-ink text-sm">{curPos.topAdd.player_name}</div>
                <div className="label-nav text-xs text-text-muted">{curPos.topAdd.team_name} · {curPos.topAdd.season_year}</div>
                <div className="font-mono text-xl font-bold text-ink mt-1">{fmt(curPos.topAdd.item_value)}</div>
              </>
            ) : <div className="text-text-faint text-xs label-nav">—</div>}
          </div>
          <div className="cell p-4">
            <div className="kicker mb-1 text-xs">Total Dropped</div>
            <div className="display-title text-3xl text-ink">{curPos.totalDropped}</div>
          </div>
          <div className="cell p-4">
            <div className="kicker mb-1 text-xs">Worst Value Drop</div>
            {curPos.worstDrop ? (
              <>
                <div className="font-semibold text-ink text-sm">{curPos.worstDrop.player_name}</div>
                <div className="label-nav text-xs text-text-muted">{curPos.worstDrop.team_name} · {curPos.worstDrop.season_year}</div>
                <div className="font-mono text-xl font-bold mt-1" style={{ color: "rgb(150,35,35)" }}>{fmt(curPos.worstDrop.item_value)}</div>
              </>
            ) : <div className="text-text-faint text-xs label-nav">—</div>}
          </div>
        </div>
      </div>

      {/* ── Player & Team Transaction Stats ── */}
      <div style={{ borderTop: "2px solid #1a1a1a", paddingTop: "2rem" }} className="mb-10">
        <div className="kicker mb-1">Spieler &amp; Teams</div>
        <h2 className="display-title text-2xl text-ink mb-6">Player &amp; Team Transaction Stats</h2>

        {/* 4 highlight cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[
            {
              label: "Most Transacted Player",
              name:  playerTeamStats.mostTransactedPlayer?.name,
              sub:   playerTeamStats.mostTransactedPlayer ? `${playerTeamStats.mostTransactedPlayer.count}× hinzugefügt` : null,
              val:   null,
            },
            {
              label: "Most Value by Player",
              name:  playerTeamStats.mostValuePlayer?.name,
              sub:   playerTeamStats.mostValuePlayer?.name,
              val:   playerTeamStats.mostValuePlayer?.value ?? null,
            },
            {
              label: "Most Transacted Team",
              name:  playerTeamStats.mostTransactedTeam?.team,
              sub:   playerTeamStats.mostTransactedTeam ? `${playerTeamStats.mostTransactedTeam.count}× Spieler hinzugefügt` : null,
              val:   null,
            },
            {
              label: "Most Value by Team",
              name:  playerTeamStats.mostValueTeam?.team,
              sub:   playerTeamStats.mostValueTeam?.team,
              val:   playerTeamStats.mostValueTeam?.posValue ?? null,
            },
          ].map(({ label, name, sub, val }) => (
            <div key={label} className="cell p-4">
              <div className="kicker mb-2 text-xs">{label}</div>
              {name ? (
                <>
                  <div className="font-semibold text-ink text-base">{name}</div>
                  {sub && val === null && <div className="label-nav text-xs text-text-muted mt-1">{sub}</div>}
                  {val !== null && (
                    <div className="font-mono text-xl font-bold mt-1" style={{ color: valColor(val) }}>
                      {fmt(val)}
                    </div>
                  )}
                </>
              ) : <div className="text-text-faint text-xs label-nav">—</div>}
            </div>
          ))}
        </div>

        {/* Team chart */}
        {playerTeamStats.chartTeams.length > 0 && (
          <div className="cell p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="kicker">Transaction Activity per NFL Team</div>
              <div className="flex gap-1">
                {(["value", "hitrate"] as const).map(m => (
                  <button key={m} onClick={() => setTeamChartMode(m)}
                    className="label-nav text-xs px-2 py-1 rounded"
                    style={{
                      background: teamChartMode === m ? "#1a1a1a" : "transparent",
                      color: teamChartMode === m ? "#fff" : "var(--color-text-muted)",
                      border: "1px solid #e0e0e0",
                    }}>
                    {m === "value" ? "Positive Value" : "Hit Rate %"}
                  </button>
                ))}
              </div>
            </div>
            <TeamChart data={playerTeamStats.chartTeams} mode={teamChartMode} />
          </div>
        )}
      </div>

      {/* ── Trades ── */}
      <div style={{ borderTop: "2px solid #1a1a1a", paddingTop: "2rem" }} className="mb-12">
        <div className="kicker mb-1">Trades</div>
        <h2 className="display-title text-2xl text-ink mb-6">
          {isFiltered ? "Trades" : "Top Trades All Time"}
        </h2>
        {tradePairs.length === 0 ? (
          <div className="text-text-faint label-nav text-xs py-8 text-center">Keine Trades im gewählten Zeitraum</div>
        ) : (
          <div className="space-y-2">
            {tradePairs.map(({ key, side1, side2 }) => (
              <div key={key} className="cell overflow-hidden">
                <div className="px-3 pt-2 pb-1 flex items-center gap-3"
                  style={{ borderBottom: "1px solid var(--color-border-light)" }}>
                  <span className="label-nav text-xs text-text-muted">{side1.season_year}</span>
                  <span className="label-nav text-xs text-text-faint">·</span>
                  <span className="label-nav text-xs text-text-muted">Woche {side1.transaction_week}</span>
                </div>
                <div className="flex divide-x" style={{ borderColor: "var(--color-border-light)" }}>
                  <TradeSide side={side1} />
                  <TradeSide side={side2} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      </>)}
    </div>
  );
}

// ── Transaction Log ───────────────────────────────────────────────────────────
type LogCol = "season" | "week" | "date" | "owner" | "type" | "added" | "dropped" | "value";

function TransactionLog({ rows, showOwner, showSeason }: {
  rows: VTxRow[];
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

  function fmtDate(ts: string) {
    const d = new Date(ts);
    return d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
  }

  function typeLabel(type: string) {
    if (type === "trade")    return { text: "Trade",    bg: "#e8f0ff", color: "#1a3a8f" };
    if (type === "add/drop") return { text: "Add/Drop", bg: "#f0f8f0", color: "#1a6b1a" };
    if (type === "add")      return { text: "Add",      bg: "#f0f8f0", color: "#1a6b1a" };
    if (type === "drop")     return { text: "Drop",     bg: "#fff0f0", color: "#8f1a1a" };
    return { text: type, bg: "#f4f4f4", color: "#555" };
  }

  function Th({ col, children, right }: { col: LogCol; children: React.ReactNode; right?: boolean }) {
    const active = sortCol === col;
    return (
      <th onClick={() => toggleSort(col)}
        className={`label-nav text-xs text-text-muted py-2 pr-3 ${right ? "text-right" : "text-left"}`}
        style={{ cursor: "pointer", userSelect: "none", whiteSpace: "nowrap" }}>
        {children}
        <span style={{ marginLeft: 3, opacity: active ? 1 : 0.3, fontSize: 9 }}>
          {active ? (sortDir === "asc" ? "▲" : "▼") : "▲"}
        </span>
      </th>
    );
  }

  if (rows.length === 0) {
    return <div className="text-text-faint label-nav text-xs py-12 text-center">Keine Transactions</div>;
  }

  return (
    <div className="mb-10" style={{ overflowX: "auto" }}>
      <table className="w-full text-sm" style={{ borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ borderBottom: "2px solid #1a1a1a" }}>
            {showSeason && <Th col="season">Saison</Th>}
            <Th col="week">Woche</Th>
            <Th col="date">Datum</Th>
            {showOwner && <Th col="owner">Owner</Th>}
            <Th col="type">Typ</Th>
            <Th col="added">Added</Th>
            <Th col="dropped">Dropped</Th>
            <Th col="value" right>Value</Th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((r, idx) => {
            const lbl = typeLabel(r.transaction_type);
            const val = r.scored_value ?? r.net_value;
            return (
              <tr key={`${r.transaction_id}-${r.team_name}`}
                style={{ borderBottom: "1px solid var(--color-border-light)", background: idx % 2 === 0 ? "transparent" : "rgba(0,0,0,0.015)" }}>
                {showSeason && <td className="py-2 pr-3 label-nav text-xs text-text-muted">{r.season_year}</td>}
                <td className="py-2 pr-3 label-nav text-xs text-text-muted">{r.transaction_week}</td>
                <td className="py-2 pr-3 label-nav text-xs text-text-muted whitespace-nowrap">{fmtDate(r.transaction_at)}</td>
                {showOwner && <td className="py-2 pr-3 text-xs font-medium">{r.team_name}</td>}
                <td className="py-2 pr-3">
                  <span className="label-nav text-xs px-1.5 py-0.5 rounded"
                    style={{ background: lbl.bg, color: lbl.color, fontWeight: 600 }}>
                    {lbl.text}
                  </span>
                </td>
                <td className="py-2 pr-3 text-xs text-ink max-w-xs">
                  {r.add_players ? (
                    <div>
                      <span className="text-green-700 font-bold mr-1">+</span>
                      {r.add_players}
                      {r.add_positions && <span className="text-text-faint ml-1">({r.add_positions})</span>}
                    </div>
                  ) : <span className="text-text-faint">—</span>}
                </td>
                <td className="py-2 pr-3 text-xs text-ink max-w-xs">
                  {r.drop_players ? (
                    <div>
                      <span className="font-bold mr-1">−</span>
                      {r.drop_players}
                      {r.drop_positions && <span className="text-text-faint ml-1">({r.drop_positions})</span>}
                    </div>
                  ) : <span className="text-text-faint">—</span>}
                </td>
                <td className="py-2 text-right font-mono text-xs font-bold"
                  style={{ color: val != null ? valColor(val) : "var(--color-text-faint)" }}>
                  {val != null ? fmt(val) : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
