"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { MANAGER_COLORS } from "@/lib/constants";
import { fmtPeriod, fmtVal, type TimelineEntry } from "./recordUtils";

const PAD = { l: 44, r: 14, t: 14, b: 26 };
const RIBBON_H = 44;
const GAP = 10;
const NEUTRAL = "var(--color-border-strong)";

// 18 weeks per season: one continuous time index
const idx = (year: number, week: number) => (year - 2015) * 18 + week;

// `integer`: counts (titles, wins) get whole-number steps only
function niceTicks(min: number, max: number, integer: boolean, count = 4) {
  const span = max - min || 1;
  const step0 = span / count;
  const mag = 10 ** Math.floor(Math.log10(step0));
  let step = [1, 2, 2.5, 5, 10].map((f) => f * mag).find((s) => s >= step0) ?? step0;
  if (integer) step = Math.max(1, Math.round(step));
  const lo = Math.floor(min / step) * step, hi = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(Math.round(v * 100) / 100);
  return { lo, hi, ticks };
}

const colorOf = (id: string) => MANAGER_COLORS[id] ?? NEUTRAL;

export default function RecordChart({ periods, label }: { periods: TimelineEntry[]; label: string }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(720);
  const [active, setActive] = useState<number | null>(null);

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(280, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const rows = useMemo(() => [...periods].sort((a, b) => a.period_id - b.period_id), [periods]);
  const PH = Math.round(Math.min(260, Math.max(170, W * 0.3)));
  const H = PAD.t + PH + GAP + RIBBON_H + PAD.b;
  const plotBottom = PAD.t + PH;
  const ribbonTop = plotBottom + GAP;

  const model = useMemo(() => {
    const starts = rows.map((r) => idx(r.from_year, Math.max(r.from_week, 1)));
    const last = rows[rows.length - 1];
    const lastEnd = last.is_current || !last.to_year
      ? starts[starts.length - 1] + Math.max(last.weeks_held, 1)
      : idx(last.to_year, Math.max(last.to_week ?? 1, 1)) + 1;
    const t0 = starts[0];
    const t1 = Math.max(lastEnd, t0 + 1);
    const vals = rows.map((r) => Number(r.record_value));
    let vmin = Math.min(...vals), vmax = Math.max(...vals);
    const integer = vals.every(Number.isInteger);
    // Counts start at zero so a step from 2 to 3 titles does not look like a jump
    if (integer && vmin > 0) vmin = 0;
    if (vmin === vmax) { vmin -= 1; vmax += 1; }
    const sc = niceTicks(vmin, vmax, integer);
    const segs = rows.map((r, i) => {
      const a = starts[i];
      const b = i < rows.length - 1 ? starts[i + 1] : t1;
      return { r, a, b: Math.max(b, a + 0.5), v: vals[i] };
    });
    const totals = new Map<string, number>();
    rows.forEach((r) => totals.set(r.manager_id, (totals.get(r.manager_id) ?? 0) + r.weeks_held));
    const legend = [...totals.entries()].sort((a, b) => b[1] - a[1]);
    const years: number[] = [];
    for (let y = Math.ceil(2015 + (t0 - 1) / 18); idx(y, 1) <= t1; y++) years.push(y);
    return { t0, t1, sc, segs, legend, years };
  }, [rows]);

  const { t0, t1, sc, segs, legend, years } = model;
  const inner = W - PAD.l - PAD.r;
  const x = (t: number) => PAD.l + ((t - t0) / (t1 - t0)) * inner;
  const y = (v: number) => plotBottom - ((v - sc.lo) / (sc.hi - sc.lo || 1)) * PH;
  const labelEvery = Math.max(1, Math.ceil((years.length * 40) / inner));

  // Ribbon width follows weeks held, with a sliver minimum so short stints stay visible
  const ribbon = useMemo(() => {
    const total = rows.reduce((s, r) => s + Math.max(r.weeks_held, 1), 0);
    const ws = rows.map((r) => (Math.max(r.weeks_held, 1) / total) * inner);
    return ws.map((w, i) => ({ x: PAD.l + ws.slice(0, i).reduce((p, q) => p + q, 0), w }));
  }, [rows, inner]);

  const dim = (i: number) => (active != null && active !== i ? 0.25 : 1);
  const pick = (i: number) => ({
    onPointerEnter: (e: React.PointerEvent) => { if (e.pointerType === "mouse") setActive(i); },
    onPointerLeave: (e: React.PointerEvent) => { if (e.pointerType === "mouse") setActive(null); },
    onClick: () => setActive((a) => (a === i ? null : i)),
    onFocus: () => setActive(i),
    onBlur: () => setActive(null),
  });

  const a = active != null ? segs[active] : null;
  const aCenter = active != null ? (x((segs[active].a + segs[active].b) / 2) / W) * 100 : 0;
  const lastSeg = segs[segs.length - 1];

  return (
    <div className="cell p-3 sm:p-4">
      <div className="mb-1 flex flex-wrap gap-x-4 gap-y-0 px-1">
        {legend.map(([id, weeks]) => (
          <span key={id} className="flex min-h-8 items-center gap-1.5 text-xs text-text-secondary">
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: colorOf(id) }} />
            {id}
            <span className="tabular-nums text-text-faint">{weeks} Wo.</span>
          </span>
        ))}
      </div>

      <div className="relative" ref={boxRef}>
        <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} className="block h-auto w-full select-none touch-pan-y" role="img"
          aria-label={`Verlauf von ${label}: ${segs.length} ${segs.length === 1 ? "Halter-Phase" : "Halter-Phasen"}`}>
          {sc.ticks.map((t) => (
            <g key={t}>
              <line x1={PAD.l} x2={W - PAD.r} y1={y(t)} y2={y(t)} stroke="var(--color-border-light)" strokeWidth={1} />
              <text x={PAD.l - 8} y={y(t)} textAnchor="end" dominantBaseline="middle" fontSize={11} fill="var(--color-text-faint)">{fmtVal(t)}</text>
            </g>
          ))}
          {years.map((yr, k) => (
            <g key={yr}>
              <line x1={x(idx(yr, 1))} x2={x(idx(yr, 1))} y1={PAD.t} y2={plotBottom} stroke="var(--color-border-light)" strokeDasharray="2 4" />
              {k % labelEvery === 0 && (
                <text x={x(idx(yr, 1))} y={H - 8} fontSize={11} fill="var(--color-text-faint)" textAnchor="middle">
                  {W < 500 ? `'${String(yr).slice(2)}` : yr}
                </text>
              )}
            </g>
          ))}

          {/* connectors */}
          {segs.slice(1).map((s, i) => (
            <line key={`c${i}`} x1={x(s.a)} x2={x(s.a)} y1={y(segs[i].v)} y2={y(s.v)} stroke={NEUTRAL} strokeWidth={1}
              opacity={active == null || active === i || active === i + 1 ? 1 : 0.25} />
          ))}
          {/* steps */}
          {segs.map((s, i) => (
            <line key={`s${i}`} x1={x(s.a)} x2={x(s.b)} y1={y(s.v)} y2={y(s.v)} stroke={colorOf(s.r.manager_id)}
              strokeWidth={active === i ? 5 : 3.5} strokeLinecap="butt"
              className="transition-opacity duration-150 motion-reduce:transition-none" opacity={dim(i)} />
          ))}
          <circle cx={x(lastSeg.b)} cy={y(lastSeg.v)} r={4.5} fill={colorOf(lastSeg.r.manager_id)}
            stroke="var(--color-solid)" strokeWidth={2} opacity={dim(segs.length - 1)} />

          {/* hover columns over the plot */}
          {segs.map((s, i) => (
            <rect key={`h${i}`} x={x(s.a)} y={PAD.t} width={Math.max(x(s.b) - x(s.a), 6)} height={PH} fill="transparent"
              className="cursor-pointer" {...pick(i)} />
          ))}

          {/* holder ribbon */}
          {rows.map((r, i) => (
            <g key={`r${i}`} tabIndex={0} role="button" aria-label={`${r.manager_id}, ${fmtVal(Number(r.record_value))}, ${fmtPeriod(r)}, ${r.weeks_held} Wochen`}
              className="cursor-pointer outline-none" {...pick(i)}>
              <rect x={ribbon[i].x} y={ribbonTop} width={Math.max(ribbon[i].w - 1, 1)} height={RIBBON_H} rx={3}
                fill={colorOf(r.manager_id)} opacity={dim(i)}
                stroke={active === i ? "var(--color-ink)" : "none"} strokeWidth={2}
                className="transition-opacity duration-150 motion-reduce:transition-none" />
              {ribbon[i].w > 44 && (
                <text x={ribbon[i].x + ribbon[i].w / 2} y={ribbonTop + RIBBON_H / 2} textAnchor="middle" dominantBaseline="middle"
                  fontSize={11} fontWeight={600} fill="#111" opacity={dim(i)} pointerEvents="none">
                  {ribbon[i].w > 90 ? r.manager_id : r.manager_id.slice(0, 3)}
                </text>
              )}
            </g>
          ))}
          <text x={PAD.l - 8} y={ribbonTop + RIBBON_H / 2} textAnchor="end" dominantBaseline="middle" fontSize={11} fill="var(--color-text-faint)">Halter</text>
        </svg>

        {a && (
          <div className={`pointer-events-none rounded-lg border border-border bg-solid px-3 py-2 text-xs ${
            W < 500 ? "mt-2" : "absolute top-2 z-10 min-w-[11rem] shadow-lg"}`}
            style={W < 500 ? undefined : aCenter > 55 ? { right: `${100 - aCenter + 2}%` } : { left: `${aCenter + 2}%` }}>
            <div className="flex items-center gap-1.5 font-medium text-ink">
              <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: colorOf(a.r.manager_id) }} />
              {a.r.manager_id}
              <span className="ml-auto pl-4 tabular-nums">{fmtVal(a.v)}</span>
            </div>
            <div className="mt-1 text-text-muted">{fmtPeriod(a.r)}</div>
            <div className="text-text-faint">{a.r.weeks_held} {a.r.weeks_held === 1 ? "Woche" : "Wochen"} gehalten</div>
          </div>
        )}
      </div>
      {segs.length === 1 && <p className="mt-1 px-1 text-xs text-text-faint">Der Rekord hat bisher nicht den Besitzer gewechselt.</p>}
    </div>
  );
}
