"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { MANAGERS, MANAGER_COLORS } from "@/lib/constants";
import { fmtPct, type TrendRow } from "@/lib/playoffs";

const PAD = { l: 44, r: 14, t: 12, b: 28 };
const TICKS = [0, 0.25, 0.5, 0.75, 1];

// Playoff odds per manager over the weeks of the season
export default function OddsTrend({ trend, season }: { trend: TrendRow[]; season: number }) {
  const [focus, setFocus] = useState<string | null>(null);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [hover, setHover] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(800);
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(280, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const H = Math.round(Math.min(380, Math.max(260, W * 0.45)));

  const weeks = useMemo(() => [...new Set(trend.map((t) => t.week))].sort((a, b) => a - b), [trend]);
  const values = useMemo(() => {
    const out: Record<string, (number | null)[]> = {};
    for (const m of MANAGERS) out[m] = weeks.map(() => null);
    for (const t of trend) {
      const i = weeks.indexOf(t.week);
      if (out[t.manager_id] && i >= 0) out[t.manager_id][i] = t.playoff_pct;
    }
    return out;
  }, [trend, weeks]);
  const visible = MANAGERS.filter((m) => !hidden.has(m));
  const n = weeks.length;

  const x = (i: number) => (n <= 1 ? (PAD.l + W - PAD.r) / 2 : PAD.l + (i / (n - 1)) * (W - PAD.l - PAD.r));
  const y = (v: number) => H - PAD.b - v * (H - PAD.t - PAD.b);

  function pathFor(m: string) {
    let d = "";
    let pen = false;
    values[m].forEach((v, i) => {
      if (v == null) { pen = false; return; }
      d += `${pen ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`;
      pen = true;
    });
    return d;
  }

  function onMove(e: React.PointerEvent<SVGRectElement>) {
    const svg = svgRef.current;
    if (!svg || n === 0) return;
    const box = svg.getBoundingClientRect();
    const px = ((e.clientX - box.left) / box.width) * W;
    const i = n <= 1 ? 0 : Math.round(((px - PAD.l) / (W - PAD.l - PAD.r)) * (n - 1));
    setHover(Math.max(0, Math.min(n - 1, i)));
  }

  const rows = hover == null ? [] : visible
    .flatMap((m) => { const v = values[m][hover]; return v == null ? [] : [{ mgr: m as string, v }]; })
    .sort((a, b) => b.v - a.v);
  const tipLeft = hover == null ? 0 : (x(hover) / W) * 100;
  const everyLabel = Math.max(1, Math.ceil((n * 30) / (W - PAD.l - PAD.r)));

  function toggle(m: string) {
    setHidden((h) => {
      const next = new Set(h);
      if (next.has(m)) next.delete(m); else if (next.size < MANAGERS.length - 1) next.add(m);
      return next;
    });
  }

  return (
    <div>
      <div className="cell p-3 sm:p-4">
        <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1.5 px-1">
          {MANAGERS.map((m) => {
            const off = hidden.has(m);
            return (
              <button key={m} onClick={() => toggle(m)}
                onMouseEnter={() => setFocus(m)} onMouseLeave={() => setFocus(null)}
                onFocus={() => setFocus(m)} onBlur={() => setFocus(null)}
                aria-pressed={!off}
                className={`flex min-h-11 items-center gap-1.5 px-2 text-xs ${off ? "text-text-faint line-through" : "text-text-secondary hover:text-ink"}`}>
                <span className="inline-block h-0.5 w-4 rounded-full" style={{ backgroundColor: off ? "var(--color-border-strong)" : MANAGER_COLORS[m] }} />
                {m}
              </button>
            );
          })}
        </div>

        <div className="relative" ref={boxRef}>
          <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} width={W} height={H} className="block h-auto w-full touch-pan-y select-none" role="img"
            aria-label={`Playoff-Chancen aller Manager nach Woche, Saison ${season}`}>
            {TICKS.map((t) => (
              <g key={t}>
                <line x1={PAD.l} x2={W - PAD.r} y1={y(t)} y2={y(t)} stroke="var(--color-border-light)" strokeWidth={1} />
                <text x={PAD.l - 8} y={y(t)} textAnchor="end" dominantBaseline="middle" fontSize={11} fill="var(--color-text-faint)">{t * 100} %</text>
              </g>
            ))}
            {weeks.map((w, i) => (
              <text key={w} x={x(i)} y={H - 8} fontSize={11} fill="var(--color-text-faint)" textAnchor={i === n - 1 ? "end" : i === 0 ? "start" : "middle"}>
                {i % everyLabel === 0 ? (W < 500 ? w : `Woche ${w}`) : ""}
              </text>
            ))}
            {[...visible].sort((a, b) => (a === focus ? 1 : b === focus ? -1 : 0)).map((m) => (
              <g key={m} opacity={focus && focus !== m ? 0.18 : 1}>
                <path d={pathFor(m)} fill="none" stroke={MANAGER_COLORS[m]} strokeWidth={focus === m ? 3 : 2}
                  strokeLinejoin="round" strokeLinecap="round" />
                {n === 1 && values[m][0] != null && <circle cx={x(0)} cy={y(values[m][0]!)} r={4} fill={MANAGER_COLORS[m]} />}
              </g>
            ))}
            {hover != null && (
              <g>
                <line x1={x(hover)} x2={x(hover)} y1={PAD.t} y2={H - PAD.b} stroke="var(--color-text-faint)" strokeWidth={1} />
                {rows.map((r) => (
                  <circle key={r.mgr} cx={x(hover)} cy={y(r.v)} r={4} fill={MANAGER_COLORS[r.mgr]}
                    stroke="var(--color-surface)" strokeWidth={2} opacity={focus && focus !== r.mgr ? 0.25 : 1} />
                ))}
              </g>
            )}
            <rect x={PAD.l} y={PAD.t} width={W - PAD.l - PAD.r} height={H - PAD.t - PAD.b} fill="transparent"
              onPointerMove={onMove} onPointerDown={onMove} onPointerLeave={() => setHover(null)} />
          </svg>

          {hover != null && rows.length > 0 && (
            <div className={`pointer-events-none rounded-lg border border-border bg-solid px-3 py-2 text-xs ${
              W < 500 ? "mt-2 grid grid-cols-2 gap-x-4" : "absolute top-2 z-10 min-w-[10rem] shadow-lg"}`}
              style={W < 500 ? undefined : tipLeft > 55 ? { right: `${100 - tipLeft + 2}%` } : { left: `${tipLeft + 2}%` }}>
              <div className="col-span-2 mb-1 text-text-muted">Nach Woche {weeks[hover]}</div>
              {rows.map((r) => (
                <div key={r.mgr} className={`flex items-center justify-between gap-4 py-0.5 ${focus && focus !== r.mgr ? "opacity-40" : ""}`}>
                  <span className="flex items-center gap-1.5 text-text-secondary">
                    <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: MANAGER_COLORS[r.mgr] }} />
                    {r.mgr}
                  </span>
                  <span className="tabular-nums text-ink">{fmtPct(r.v)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <p className="mt-2 px-1 text-xs text-text-faint">
          Die Wochen vor der aktuellen sind nur aus den Saisondurchschnitten gerechnet, ohne Projektionen.
        </p>
      </div>
    </div>
  );
}
