"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { MANAGER_COLORS } from "@/lib/constants";
import { fmtVal } from "./recordUtils";

// Week by week value of one record for every manager (public.record_history)
export type RecordHistory = {
  weeks: [number, number][];
  holders: (string | null)[];
  series: Record<string, (number | null)[]>;
};

const PAD = { l: 44, r: 14, t: 12, b: 26 };
const BAND_H = 14;
const GAP = 10;
const NEUTRAL = "var(--color-border-strong)";
const colorOf = (id: string) => MANAGER_COLORS[id] ?? NEUTRAL;

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

// Runs of consecutive weeks with a value, as SVG path data
function linePath(vals: (number | null)[], x: (i: number) => number, y: (v: number) => number, keep?: (i: number) => boolean) {
  let d = "";
  let open = false;
  for (let i = 0; i < vals.length; i++) {
    const v = vals[i];
    const on = v != null && (!keep || keep(i));
    if (!on) { open = false; continue; }
    if (!open) {
      // a held run starts at the previous week's point, so the coloured part joins the line
      const prev = i > 0 ? vals[i - 1] : null;
      d += keep && prev != null ? `M${x(i - 1)},${y(prev)}L${x(i)},${y(v)}` : `M${x(i)},${y(v)}`;
      open = true;
    } else d += `L${x(i)},${y(v)}`;
  }
  return d;
}

export default function RecordRaceChart({ history, label, higher }: { history: RecordHistory; label: string; higher: boolean }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(720);
  const [hover, setHover] = useState<number | null>(null);
  const [focus, setFocus] = useState<string | null>(null);

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(280, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const { weeks, holders, series } = history;
  const n = weeks.length;

  const model = useMemo(() => {
    const all = Object.values(series).flat().filter((v): v is number => v != null);
    let vmin = all.length ? Math.min(...all) : 0, vmax = all.length ? Math.max(...all) : 1;
    const integer = all.every(Number.isInteger);
    // Counts start at zero so the gaps between managers are not exaggerated
    if (integer && vmin > 0) vmin = 0;
    if (vmin === vmax) { vmin -= 1; vmax += 1; }
    const sc = niceTicks(vmin, vmax, integer);
    const seasonStarts: { i: number; year: number }[] = [];
    weeks.forEach(([yr], i) => { if (i === 0 || weeks[i - 1][0] !== yr) seasonStarts.push({ i, year: yr }); });
    // Holder runs for the band under the chart
    const runs: { m: string | null; a: number; b: number }[] = [];
    holders.forEach((m, i) => {
      const last = runs[runs.length - 1];
      if (last && last.m === m) last.b = i;
      else runs.push({ m, a: i, b: i });
    });
    const heldWeeks = new Map<string, number>();
    holders.forEach((m) => { if (m) heldWeeks.set(m, (heldWeeks.get(m) ?? 0) + 1); });
    const managers = Object.keys(series).sort((a, b) => (heldWeeks.get(b) ?? 0) - (heldWeeks.get(a) ?? 0) || a.localeCompare(b));
    return { sc, seasonStarts, runs, heldWeeks, managers };
  }, [weeks, holders, series]);

  const { sc, seasonStarts, runs, heldWeeks, managers } = model;
  const PH = Math.round(Math.min(300, Math.max(190, W * 0.36)));
  const plotBottom = PAD.t + PH;
  const bandTop = plotBottom + GAP;
  const H = bandTop + BAND_H + PAD.b;
  const inner = W - PAD.l - PAD.r;
  const step = n > 1 ? inner / (n - 1) : inner;
  const x = (i: number) => PAD.l + (n > 1 ? i * step : inner / 2);
  const y = (v: number) => plotBottom - ((v - sc.lo) / (sc.hi - sc.lo || 1)) * PH;
  const labelEvery = Math.max(1, Math.ceil((seasonStarts.length * 40) / inner));

  const indexAt = (clientX: number, rect: DOMRect) => {
    const px = ((clientX - rect.left) / rect.width) * W;
    return Math.min(n - 1, Math.max(0, Math.round((px - PAD.l) / (step || 1))));
  };

  const hoverRows = hover == null ? [] : managers
    .map((m) => ({ m, v: series[m][hover] }))
    .filter((r): r is { m: string; v: number } => r.v != null)
    .sort((a, b) => (higher ? b.v - a.v : a.v - b.v));
  const hx = hover != null ? (x(hover) / W) * 100 : 0;
  const lineOpacity = (m: string) => (focus && focus !== m ? 0.12 : 0.45);
  const heldOpacity = (m: string) => (focus && focus !== m ? 0.2 : 1);

  return (
    <div className="cell p-4 sm:p-5">
      <div className="mb-1 grid grid-cols-4 gap-x-1 sm:flex sm:flex-wrap">
        {managers.map((m) => {
          const on = focus === m;
          return (
            <button key={m} type="button" onClick={() => setFocus(on ? null : m)} aria-pressed={on}
              className={`flex min-h-11 min-w-0 items-center gap-1.5 rounded-[var(--radius-pill)] px-1.5 text-xs sm:px-2 transition-colors md:min-h-8 ${
                on ? "bg-surface-3 text-ink" : focus ? "text-text-faint hover:text-text-secondary" : "text-text-secondary hover:text-ink"}`}>
              <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: colorOf(m) }} />
              <span className="truncate">{m}</span>
              {(heldWeeks.get(m) ?? 0) > 0 && <span className="measured hidden text-text-faint sm:inline">{heldWeeks.get(m)} Wo.</span>}
            </button>
          );
        })}
      </div>

      <div className="relative" ref={boxRef}>
        <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} className="block h-auto w-full select-none touch-pan-y" role="img"
          aria-label={`${label}: Wert jedes Managers Woche für Woche, dick markiert, solange er den Rekord hielt`}
          onPointerMove={(e) => setHover(indexAt(e.clientX, e.currentTarget.getBoundingClientRect()))}
          onPointerDown={(e) => setHover(indexAt(e.clientX, e.currentTarget.getBoundingClientRect()))}
          onPointerLeave={(e) => { if (e.pointerType === "mouse") setHover(null); }}>
          {sc.ticks.map((t) => (
            <g key={t}>
              <line x1={PAD.l} x2={W - PAD.r} y1={y(t)} y2={y(t)} stroke="var(--color-border-light)" strokeWidth={1} />
              <text x={PAD.l - 8} y={y(t)} textAnchor="end" dominantBaseline="middle" fontSize={11} fill="var(--color-text-faint)" style={{ fontFamily: "var(--font-outlier)" }}>{fmtVal(t)}</text>
            </g>
          ))}
          {seasonStarts.map(({ i, year }, k) => (
            <g key={year}>
              <line x1={x(i)} x2={x(i)} y1={PAD.t} y2={plotBottom} stroke="var(--color-border-light)" strokeDasharray="2 4" />
              {k % labelEvery === 0 && (
                <text x={Math.max(x(i), PAD.l + 12)} y={H - 8} fontSize={11} fill="var(--color-text-faint)" textAnchor="middle" style={{ fontFamily: "var(--font-outlier)" }}>
                  {W < 500 ? `'${String(year).slice(2)}` : year}
                </text>
              )}
            </g>
          ))}

          {/* every manager, thin */}
          {managers.map((m) => (
            <path key={`l${m}`} d={linePath(series[m], x, y)} fill="none" stroke={colorOf(m)} strokeWidth={focus === m ? 2.5 : 1.5}
              strokeLinejoin="round" opacity={focus === m ? 1 : lineOpacity(m)}
              className="transition-opacity duration-150 motion-reduce:transition-none" />
          ))}
          {/* the record holder, thick, in the holder's colour */}
          {managers.map((m) => (
            <path key={`h${m}`} d={linePath(series[m], x, y, (i) => holders[i] === m)} fill="none" stroke={colorOf(m)}
              strokeWidth={3.5} strokeLinejoin="round" strokeLinecap="round" opacity={heldOpacity(m)}
              className="transition-opacity duration-150 motion-reduce:transition-none" />
          ))}

          {hover != null && (
            <g pointerEvents="none">
              <line x1={x(hover)} x2={x(hover)} y1={PAD.t} y2={plotBottom} stroke="var(--color-text-faint)" strokeWidth={1} />
              {hoverRows.map(({ m, v }) => (
                <circle key={m} cx={x(hover)} cy={y(v)} r={holders[hover] === m ? 4.5 : 3} fill={colorOf(m)}
                  stroke="var(--color-solid)" strokeWidth={1.5} opacity={focus && focus !== m ? 0.3 : 1} />
              ))}
            </g>
          )}

          {/* who held the record, aligned with the weeks above */}
          {runs.map((r, k) => (
            <rect key={`b${k}`} x={x(r.a) - step / 2} y={bandTop} width={Math.max((r.b - r.a + 1) * step, 1.5)} height={BAND_H}
              fill={r.m ? colorOf(r.m) : "transparent"} opacity={r.m && focus && focus !== r.m ? 0.2 : 1} />
          ))}
          <text x={PAD.l - 8} y={bandTop + BAND_H / 2} textAnchor="end" dominantBaseline="middle" fontSize={11} fill="var(--color-text-faint)">Halter</text>
        </svg>

        {hover != null && (
          <div className={`pointer-events-none rounded-lg border border-border bg-solid px-3 py-2 text-xs ${
            W < 500 ? "mt-2" : "absolute top-2 z-10 min-w-[12rem]"}`}
            style={W < 500 ? undefined : hx > 55 ? { right: `${100 - hx + 2}%` } : { left: `${hx + 2}%` }}>
            <div className="mb-1 font-medium text-ink"><span className="measured">{weeks[hover][0]}</span>, Woche <span className="measured">{weeks[hover][1]}</span></div>
            {hoverRows.map(({ m, v }) => (
              <div key={m} className={`flex items-center gap-1.5 ${holders[hover] === m ? "font-medium text-ink" : "text-text-muted"}`}>
                <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: colorOf(m) }} />
                {m}
                {holders[hover] === m && <span className="text-red">Rekord</span>}
                <span className="measured ml-auto pl-4">{fmtVal(v)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      <p className="mt-1 px-1 text-xs text-text-faint">
        Jede Linie ist ein Manager. Dick und farbig: wer den Rekord in dieser Woche hielt. Tippe auf einen Namen, um ihn hervorzuheben.
      </p>
    </div>
  );
}
