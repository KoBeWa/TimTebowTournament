"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { MANAGERS } from "@/lib/constants";
import type { MetricKey, TrendData } from "./trends";

// Categorical slots (dark steps), validated as a set against the surface #111a2c.
// Fixed per manager so a color always means the same person.
const COLORS: Record<string, string> = {
  Benni: "#3987e5", Erik: "#d95926", Juschka: "#199e70", Kessi: "#c98500",
  Marv: "#d55181", Ritz: "#008300", Simi: "#9085e9", Tommy: "#e66767",
};

const METRICS: { key: MetricKey; label: string; hint: string; format: (v: number) => string }[] = [
  { key: "wins", label: "Siege", hint: "Siege insgesamt inkl. Playoffs", format: (v) => `${v}` },
  { key: "winPct", label: "Siegquote", hint: "Anteil gewonnener Spiele bis zu dieser Woche", format: (v) => `${v.toFixed(1)} %` },
  { key: "points", label: "Punkte", hint: "Punkte insgesamt", format: (v) => v.toLocaleString("de-DE") },
  { key: "elo", label: "Elo", hint: "Elo-Rating nach jedem Spiel", format: (v) => `${v}` },
  { key: "titles", label: "Titel", hint: "Meisterschaften insgesamt", format: (v) => `${v}` },
  { key: "rank", label: "Platz", hint: "Platz in der ewigen Tabelle (Siege, dann Punkte)", format: (v) => `${v}.` },
];

const PAD = { l: 44, r: 12, t: 12, b: 28 };

function niceTicks(min: number, max: number, count = 5) {
  const span = max - min || 1;
  const step0 = span / count;
  const mag = 10 ** Math.floor(Math.log10(step0));
  const step = [1, 2, 2.5, 5, 10].map((f) => f * mag).find((s) => s >= step0) ?? step0;
  const lo = Math.floor(min / step) * step, hi = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(Math.round(v * 100) / 100);
  return { lo, hi, ticks };
}

export default function AllTimeTrends({ data }: { data: TrendData }) {
  const [metric, setMetric] = useState<MetricKey>("wins");
  const [focus, setFocus] = useState<string | null>(null);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [hover, setHover] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  // Draw in real pixels so labels keep their size on phones
  const [W, setW] = useState(800);
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(280, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const H = Math.round(Math.min(340, Math.max(240, W * 0.42)));

  const m = METRICS.find((x) => x.key === metric)!;
  const values = data.series[metric];
  const visible = MANAGERS.filter((mgr) => !hidden.has(mgr));
  const n = data.weeks.length;

  const scale = useMemo(() => {
    if (metric === "rank") return { lo: 1, hi: MANAGERS.length, ticks: MANAGERS.map((_, i) => i + 1), invert: true };
    const all = visible.flatMap((mgr) => values[mgr].filter((v): v is number => v != null));
    const min = metric === "elo" || metric === "winPct" ? Math.min(...all) : 0;
    return { ...niceTicks(min, Math.max(...all, 1)), invert: false };
  }, [metric, values, visible]);

  const x = (i: number) => PAD.l + (i / Math.max(1, n - 1)) * (W - PAD.l - PAD.r);
  const y = (v: number) => {
    const t = (v - scale.lo) / (scale.hi - scale.lo || 1);
    return scale.invert ? PAD.t + t * (H - PAD.t - PAD.b) : H - PAD.b - t * (H - PAD.t - PAD.b);
  };

  const paths = useMemo(() => Object.fromEntries(MANAGERS.map((mgr) => {
    let d = "";
    let pen = false;
    values[mgr].forEach((v, i) => {
      if (v == null) { pen = false; return; }
      d += `${pen ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`;
      pen = true;
    });
    return [mgr, d];
  // eslint-disable-next-line react-hooks/exhaustive-deps
  })), [values, scale, n, W, H]);

  // First week of every season for the x axis
  const seasonStarts = data.weeks.map((w, i) => ({ ...w, i })).filter((w, i, a) => i === 0 || a[i - 1].season !== w.season);
  const labelEvery = Math.max(1, Math.ceil((seasonStarts.length * 44) / (W - PAD.l - PAD.r)));

  function onMove(e: React.PointerEvent<SVGRectElement>) {
    const svg = svgRef.current;
    if (!svg) return;
    const box = svg.getBoundingClientRect();
    const px = ((e.clientX - box.left) / box.width) * W;
    const i = Math.round(((px - PAD.l) / (W - PAD.l - PAD.r)) * (n - 1));
    setHover(Math.max(0, Math.min(n - 1, i)));
  }

  const tooltipRows: { mgr: string; v: number }[] = hover == null ? [] : visible
    .flatMap((mgr) => {
      const v = values[mgr][hover];
      return v == null ? [] : [{ mgr: mgr as string, v }];
    })
    .sort((a, b) => (metric === "rank" ? a.v - b.v : b.v - a.v));
  const tipLeft = hover == null ? 0 : (x(hover) / W) * 100;

  function toggle(mgr: string) {
    setHidden((h) => {
      const next = new Set(h);
      if (next.has(mgr)) next.delete(mgr); else if (next.size < MANAGERS.length - 1) next.add(mgr);
      return next;
    });
  }

  return (
    <div className="mb-10">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <div>
          <div className="kicker">Verlauf seit 2015</div>
          <p className="text-xs text-text-muted mt-0.5">{m.hint}</p>
        </div>
        <div className="flex flex-wrap gap-1">
          {METRICS.map((opt) => (
            <button key={opt.key} onClick={() => { setMetric(opt.key); setHover(null); }}
              className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${metric === opt.key ? "bg-red text-white font-semibold" : "bg-cream text-text-secondary hover:text-ink border border-border"}`}>
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="cell p-3 sm:p-4">
        {/* Legend: hover highlights, click shows/hides */}
        <div className="flex flex-wrap gap-x-4 gap-y-1.5 mb-2 px-1">
          {MANAGERS.map((mgr) => {
            const off = hidden.has(mgr);
            return (
              <button key={mgr} onClick={() => toggle(mgr)}
                onMouseEnter={() => setFocus(mgr)} onMouseLeave={() => setFocus(null)}
                onFocus={() => setFocus(mgr)} onBlur={() => setFocus(null)}
                aria-pressed={!off}
                className={`flex items-center gap-1.5 text-xs ${off ? "text-text-faint line-through" : "text-text-secondary hover:text-ink"}`}>
                <span className="inline-block h-0.5 w-4 rounded-full" style={{ backgroundColor: off ? "var(--color-border-strong)" : COLORS[mgr] }} />
                {mgr}
              </button>
            );
          })}
        </div>

        <div className="relative" ref={boxRef}>
          <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} width={W} height={H} className="block w-full h-auto select-none touch-pan-y" role="img"
            aria-label={`${m.label} aller Manager seit 2015`}>
            {/* grid + y axis */}
            {scale.ticks.map((t) => (
              <g key={t}>
                <line x1={PAD.l} x2={W - PAD.r} y1={y(t)} y2={y(t)} stroke="var(--color-border-light)" strokeWidth={1} />
                <text x={PAD.l - 8} y={y(t)} textAnchor="end" dominantBaseline="middle" fontSize={11} fill="var(--color-text-faint)">
                  {metric === "rank" ? `${t}.` : metric === "points" ? (t >= 1000 ? `${t / 1000}k` : t) : t}
                </text>
              </g>
            ))}
            {/* season boundaries + x labels */}
            {seasonStarts.map((s, k) => (
              <g key={s.season}>
                {k > 0 && <line x1={x(s.i)} x2={x(s.i)} y1={PAD.t} y2={H - PAD.b} stroke="var(--color-border-light)" strokeDasharray="2 4" />}
                <text x={x(s.i)} y={H - 8} fontSize={11} fill="var(--color-text-faint)" textAnchor={k === 0 ? "start" : "middle"}>
                  {k % labelEvery === 0 ? (W < 500 ? `'${String(s.season).slice(2)}` : s.season) : ""}
                </text>
              </g>
            ))}
            {/* lines: the focused manager is drawn last and on top */}
            {[...visible].sort((a, b) => (a === focus ? 1 : b === focus ? -1 : 0)).map((mgr) => (
              <path key={mgr} d={paths[mgr]} fill="none" stroke={COLORS[mgr]}
                strokeWidth={focus === mgr ? 3 : 2} strokeLinejoin="round" strokeLinecap="round"
                opacity={focus && focus !== mgr ? 0.18 : 1} />
            ))}
            {/* crosshair */}
            {hover != null && (
              <g>
                <line x1={x(hover)} x2={x(hover)} y1={PAD.t} y2={H - PAD.b} stroke="var(--color-text-faint)" strokeWidth={1} />
                {tooltipRows.map((r) => (
                  <circle key={r.mgr} cx={x(hover)} cy={y(r.v)} r={4} fill={COLORS[r.mgr]}
                    stroke="var(--color-surface)" strokeWidth={2} opacity={focus && focus !== r.mgr ? 0.25 : 1} />
                ))}
              </g>
            )}
            <rect x={PAD.l} y={PAD.t} width={W - PAD.l - PAD.r} height={H - PAD.t - PAD.b} fill="transparent"
              onPointerMove={onMove} onPointerDown={onMove} onPointerLeave={() => setHover(null)} />
          </svg>

          {hover != null && tooltipRows.length > 0 && (
            <div className={`pointer-events-none rounded-xl border border-border bg-surface-2 px-3 py-2 text-xs ${
              W < 500 ? "mt-2 grid grid-cols-2 gap-x-4" : "absolute top-2 z-10 shadow-lg min-w-[10rem]"}`}
              style={W < 500 ? undefined : tipLeft > 55 ? { right: `${100 - tipLeft + 2}%` } : { left: `${tipLeft + 2}%` }}>
              <div className="kicker mb-1 col-span-2">{data.weeks[hover].season} · Woche {data.weeks[hover].week}</div>
              {tooltipRows.map((r) => (
                <div key={r.mgr} className={`flex items-center justify-between gap-4 py-0.5 ${focus && focus !== r.mgr ? "opacity-40" : ""}`}>
                  <span className="flex items-center gap-1.5 text-text-secondary">
                    <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: COLORS[r.mgr] }} />
                    {r.mgr}
                  </span>
                  <span className="font-mono text-ink tabular-nums">{m.format(r.v)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        {metric === "elo" && (
          <p className="mt-2 px-1 text-xs text-text-faint">Elo wird aktuell bis zur Saison 2025 berechnet.</p>
        )}
      </div>
    </div>
  );
}
