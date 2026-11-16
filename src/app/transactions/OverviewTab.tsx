"use client";

import { useState } from "react";
import StatTile from "@/components/ui/StatTile";
import SvgTooltip from "./SvgTooltip";

export interface ChartPoint { label: string; transactions: number; trades: number }
export interface OwnerStats { waiverPct: string; tradePct: string; waiverN: number; tradeN: number }

// Activity chart (years or weeks)
function ActivityChart({ data }: { data: ChartPoint[] }) {
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
            className="stroke-border" strokeWidth="0.5" />
        ))}
        {data.map((d, i) => (
          <rect key={i} x={PAD.l + i * slotW + slotW * 0.3} y={ry(d.trades)}
            width={slotW * 0.4} height={rh(d.trades)} className="fill-red" opacity={0.2}
            style={{ cursor: "pointer" }}
            onMouseEnter={() => setTip({ x: lx(i), y: ry(d.trades) + rh(d.trades) / 2, lines: [d.label, `Trades: ${d.trades}`] })} />
        ))}
        {data.length > 1 && <polyline points={points} fill="none" className="stroke-red" strokeWidth="2" />}
        {data.map((d, i) => (
          <circle key={`dot-${i}`} cx={lx(i)} cy={ly(d.transactions)} r="5" fill="transparent"
            style={{ cursor: "pointer" }}
            onMouseEnter={() => setTip({ x: lx(i), y: ly(d.transactions), lines: [d.label, `Transaktionen: ${d.transactions}`, `Trades: ${d.trades}`] })} />
        ))}
        {data.map((d, i) => (
          <circle key={`dot-vis-${i}`} cx={lx(i)} cy={ly(d.transactions)} r="3" className="fill-red" pointerEvents="none" />
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
      <div className="mt-2 flex gap-6 text-xs text-text-muted">
        <div className="flex items-center gap-2">
          <span className="inline-block h-0.5 w-4 bg-red" />
          Transaktionen (links)
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block h-2 w-3 bg-red/35" />
          Trades (rechts)
        </div>
      </div>
    </div>
  );
}

export default function OverviewTab({ waiverCount, tradeCount, totalCount, ownerStats, chartData, chartTitle }: {
  waiverCount: number;
  tradeCount: number;
  totalCount: number;
  ownerStats: OwnerStats | null;
  chartData: ChartPoint[];
  chartTitle: string;
}) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 [&>*:last-child]:col-span-2 sm:[&>*:last-child]:col-span-1">
        <StatTile label="Waiver-Moves" value={waiverCount.toLocaleString("de-DE")} hint="Adds und Add/Drops" />
        <StatTile label="Trades" value={tradeCount.toLocaleString("de-DE")} hint="Einzigartige Trades" />
        <StatTile label="Transaktionen" value={totalCount.toLocaleString("de-DE")} hint="Waiver plus Trades" />
      </div>

      {ownerStats && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile label="Waiver-Trefferquote" value={ownerStats.waiverPct} hint={`positive Waiver-Moves, ${ownerStats.waiverN} gesamt`} />
          <StatTile label="Trade-Gewinnquote" value={ownerStats.tradePct} hint={`positive Trade-Seiten, ${ownerStats.tradeN} gesamt`} />
        </div>
      )}

      <section>
        <h2 className="section-title mb-3 text-ink">{chartTitle}</h2>
        <div className="cell p-4 sm:p-5">
          <ActivityChart data={chartData} />
        </div>
      </section>
    </div>
  );
}
