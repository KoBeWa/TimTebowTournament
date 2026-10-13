"use client";

import { useEffect, useMemo, useRef, useState } from "react";

// Data written by scripts/score_timelines/build.py
interface TimelineFile {
  season: number;
  week: number;
  start: number; // unix seconds, all other times are relative to this
  windows: [number, number][];
  managers: Record<string, { players: string[]; final: number; events: [number, number, number][] }>;
}

interface Point {
  t: number;
  score: number;
  plays: { player: string; pts: number }[];
}

const COLOR_A = "#f4532f";
const COLOR_B = "#4590ea";
const HEIGHT = 280;
const PAD = { top: 16, right: 56, bottom: 34, left: 40 };
const WINDOW_GAP = 0.035; // share of the x axis between two game windows

const dayTime = new Intl.DateTimeFormat("de-DE", {
  weekday: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Berlin",
});

function formatTime(unix: number) {
  return dayTime.format(new Date(unix * 1000)).replace(".,", "").replace(",", "");
}

function buildSeries(data: TimelineFile, manager: string): Point[] {
  const team = data.managers[manager];
  if (!team) return [];
  const points: Point[] = [{ t: data.windows[0][0], score: 0, plays: [] }];
  let score = 0;
  for (const [t, pts, idx] of team.events) {
    score += pts;
    const last = points[points.length - 1];
    const play = { player: team.players[idx] ?? "?", pts };
    if (last.t === t) {
      last.score = score;
      last.plays.push(play);
    } else {
      points.push({ t, score, plays: [play] });
    }
  }
  return points;
}

// Score at time t (last point at or before t)
function scoreAt(series: Point[], t: number): Point {
  let lo = 0;
  let hi = series.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (series[mid].t <= t) lo = mid;
    else hi = mid - 1;
  }
  return series[lo];
}

const TOOLTIP_W = 224;

// Place the tooltip beside the crosshair, flipping sides and staying inside the chart
function tooltipLeft(hoverX: number, width: number) {
  const left = hoverX > width / 2 ? hoverX - TOOLTIP_W - 12 : hoverX + 12;
  return Math.min(Math.max(0, left), width - TOOLTIP_W);
}

export default function ScoreTimeline({
  season,
  week,
  managerA,
  managerB,
}: {
  season: number;
  week: number;
  managerA: string;
  managerB: string;
}) {
  const [data, setData] = useState<TimelineFile | null>(null);
  const [failed, setFailed] = useState(false);
  const [width, setWidth] = useState(800);
  const [hoverT, setHoverT] = useState<number | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/score-timelines/${season}/${week}.json`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: TimelineFile) => !cancelled && setData(d))
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [season, week]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.max(280, entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, [data]);

  const chart = useMemo(() => {
    if (!data || !data.managers[managerA] || !data.managers[managerB]) return null;
    const seriesA = buildSeries(data, managerA);
    const seriesB = buildSeries(data, managerB);

    // Compressed time axis: game windows side by side, idle time removed
    const total = data.windows.reduce((s, [a, b]) => s + Math.max(b - a, 60), 0);
    const gapTime = (total * WINDOW_GAP) / Math.max(1, 1 - WINDOW_GAP * (data.windows.length - 1));
    const offsets: number[] = [];
    let acc = 0;
    for (const [a, b] of data.windows) {
      offsets.push(acc);
      acc += Math.max(b - a, 60) + gapTime;
    }
    const span = acc - gapTime;
    const innerW = width - PAD.left - PAD.right;
    const innerH = HEIGHT - PAD.top - PAD.bottom;

    const toAxis = (t: number) => {
      let i = data.windows.findIndex(([, b]) => t <= b);
      if (i === -1) i = data.windows.length - 1;
      const [a, b] = data.windows[i];
      return offsets[i] + Math.min(Math.max(t, a), b) - a;
    };
    const x = (t: number) => PAD.left + (toAxis(t) / span) * innerW;
    const fromX = (px: number) => {
      const v = ((px - PAD.left) / innerW) * span;
      for (let i = data.windows.length - 1; i >= 0; i--) {
        if (v >= offsets[i]) return Math.min(data.windows[i][0] + (v - offsets[i]), data.windows[i][1]);
      }
      return data.windows[0][0];
    };

    const maxScore = Math.max(...seriesA.map((p) => p.score), ...seriesB.map((p) => p.score), 10);
    const minScore = Math.min(0, ...seriesA.map((p) => p.score), ...seriesB.map((p) => p.score));
    const step = maxScore > 120 ? 40 : maxScore > 60 ? 20 : 10;
    const yMax = Math.ceil(maxScore / step) * step;
    const yMin = Math.floor(minScore / step) * step;
    const y = (v: number) => PAD.top + innerH - ((v - yMin) / (yMax - yMin)) * innerH;
    const ticks: number[] = [];
    for (let v = yMin; v <= yMax; v += step) ticks.push(v);

    const endT = data.windows[data.windows.length - 1][1];
    const path = (s: Point[]) => {
      let d = `M${x(s[0].t)},${y(0)}`;
      for (const p of s) d += `H${x(p.t)}V${y(p.score)}`;
      return d + `H${x(endT)}`;
    };

    // Lead changes
    let leadChanges = 0;
    let leader = 0;
    const times = [...new Set([...seriesA, ...seriesB].map((p) => p.t))].sort((a, b) => a - b);
    for (const t of times) {
      const diff = scoreAt(seriesA, t).score - scoreAt(seriesB, t).score;
      const now = Math.abs(diff) < 0.005 ? 0 : Math.sign(diff);
      if (now !== 0 && leader !== 0 && now !== leader) leadChanges++;
      if (now !== 0) leader = now;
    }

    return { seriesA, seriesB, x, y, fromX, ticks, path, endT, leadChanges, innerH };
  }, [data, managerA, managerB, width]);

  if (failed) return null;
  if (!data) {
    return <div className="cell p-6 text-sm text-text-muted">Lade Punkteverlauf…</div>;
  }
  if (!chart) return null;

  const { seriesA, seriesB, x, y, fromX, ticks, path, endT, leadChanges } = chart;
  const finalA = seriesA[seriesA.length - 1].score;
  const finalB = seriesB[seriesB.length - 1].score;
  const hover = hoverT !== null ? { a: scoreAt(seriesA, hoverT), b: scoreAt(seriesB, hoverT) } : null;
  const hoverX = hoverT !== null ? x(hoverT) : 0;

  // Keep the end labels from overlapping
  let labelA = y(finalA);
  let labelB = y(finalB);
  if (Math.abs(labelA - labelB) < 16) {
    const mid = (labelA + labelB) / 2;
    const upper = finalA >= finalB ? -1 : 1;
    labelA = mid + upper * 8;
    labelB = mid - upper * 8;
  }

  // Window start labels, skipping those that would collide with the previous one
  const labelled = new Set<number>();
  let lastLabelX = -Infinity;
  data.windows.forEach(([a], i) => {
    if (x(a) - lastLabelX >= 64) {
      labelled.add(i);
      lastLabelX = x(a);
    }
  });

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setHoverT(fromX(e.clientX - rect.left));
  };

  return (
    <section className="cell p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="kicker mb-1">Punkteverlauf</div>
          <h2 className="section-title text-ink">So lief der Spieltag</h2>
          <p className="mt-1 text-xs text-text-muted">
            Punkte aller Starter nach echter Spielzeit (deutsche Zeit) · {leadChanges} Führungswechsel
          </p>
        </div>
        <div className="flex items-center gap-4 text-sm">
          {[
            { name: managerA, color: COLOR_A },
            { name: managerB, color: COLOR_B },
          ].map((l) => (
            <span key={l.name} className="flex items-center gap-2 text-text-secondary">
              <span className="inline-block h-0.5 w-4 rounded" style={{ background: l.color }} />
              {l.name}
            </span>
          ))}
        </div>
      </div>

      <div ref={wrapRef} className="relative">
        <svg
          width={width}
          height={HEIGHT}
          className="block touch-none select-none"
          onPointerMove={onMove}
          onPointerDown={onMove}
          onPointerLeave={() => setHoverT(null)}
          role="img"
          aria-label={`Punkteverlauf ${managerA} ${finalA.toFixed(1)} gegen ${managerB} ${finalB.toFixed(1)}`}
        >
          {/* Game windows */}
          {data.windows.map(([a, b], i) => (
            <g key={i}>
              <rect
                x={x(a)}
                y={PAD.top}
                width={Math.max(1, x(b) - x(a))}
                height={HEIGHT - PAD.top - PAD.bottom}
                fill="var(--color-ink)"
                opacity={0.025}
                rx={4}
              />
              {labelled.has(i) && (
                <text x={x(a) + 4} y={HEIGHT - 12} fontSize={11} fill="var(--color-text-faint)">
                  {formatTime(data.start + a)}
                </text>
              )}
            </g>
          ))}

          {/* Grid */}
          {ticks.map((v) => (
            <g key={v}>
              <line
                x1={PAD.left}
                x2={width - PAD.right}
                y1={y(v)}
                y2={y(v)}
                stroke="var(--color-border)"
                strokeDasharray={v === 0 ? undefined : "2 4"}
              />
              <text x={PAD.left - 8} y={y(v) + 4} fontSize={11} textAnchor="end" fill="var(--color-text-faint)">
                {v}
              </text>
            </g>
          ))}

          {/* Lines */}
          <path d={path(seriesB)} fill="none" stroke={COLOR_B} strokeWidth={2} strokeLinejoin="round" />
          <path d={path(seriesA)} fill="none" stroke={COLOR_A} strokeWidth={2} strokeLinejoin="round" />

          {/* End labels */}
          <circle cx={x(endT)} cy={y(finalB)} r={4} fill={COLOR_B} stroke="var(--color-surface)" strokeWidth={2} />
          <circle cx={x(endT)} cy={y(finalA)} r={4} fill={COLOR_A} stroke="var(--color-surface)" strokeWidth={2} />
          <text x={x(endT) + 8} y={labelA + 4} fontSize={12} fontWeight={600} fill="var(--color-ink)">
            {finalA.toFixed(1)}
          </text>
          <text x={x(endT) + 8} y={labelB + 4} fontSize={12} fontWeight={600} fill="var(--color-ink)">
            {finalB.toFixed(1)}
          </text>

          {/* Crosshair */}
          {hover && (
            <g pointerEvents="none">
              <line x1={hoverX} x2={hoverX} y1={PAD.top} y2={HEIGHT - PAD.bottom} stroke="var(--color-text-faint)" />
              <circle cx={hoverX} cy={y(hover.b.score)} r={4} fill={COLOR_B} stroke="var(--color-surface)" strokeWidth={2} />
              <circle cx={hoverX} cy={y(hover.a.score)} r={4} fill={COLOR_A} stroke="var(--color-surface)" strokeWidth={2} />
            </g>
          )}
        </svg>

        {hover && hoverT !== null && (
          <div
            className="pointer-events-none absolute top-2 z-10 w-56 rounded-xl border border-border-strong bg-surface-2/95 p-3 text-xs shadow-xl backdrop-blur"
            style={{ left: tooltipLeft(hoverX, width) }}
          >
            <div className="mb-2 text-text-muted">{formatTime(data.start + hoverT)} · Stand & letzte Aktion</div>
            {[
              { name: managerA, color: COLOR_A, p: hover.a },
              { name: managerB, color: COLOR_B, p: hover.b },
            ].map(({ name, color, p }) => (
              <div key={name} className="mb-1.5 last:mb-0">
                <div className="flex items-center gap-2">
                  <span className="inline-block h-0.5 w-3 rounded" style={{ background: color }} />
                  <span className="font-semibold text-ink tabular-nums">{p.score.toFixed(1)}</span>
                  <span className="text-text-secondary">{name}</span>
                </div>
                {p.plays.length > 0 && (
                  <div className="ml-5 mt-0.5 text-text-faint">
                    {p.plays
                      .map((pl) => `${pl.player} ${pl.pts > 0 ? "+" : ""}${pl.pts.toFixed(1)}`)
                      .join(" · ")}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <details className="mt-4 group">
        <summary className="cursor-pointer select-none text-sm text-text-muted hover:text-ink transition-colors">
          Alle Punkte-Aktionen anzeigen
        </summary>
        <div className="mt-3 max-h-80 overflow-y-auto rounded-xl border border-border-light">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-surface-2 text-text-muted">
              <tr>
                <th className="px-3 py-2 text-left">Zeit</th>
                <th className="px-3 py-2 text-left">Spieler</th>
                <th className="px-3 py-2 text-right">Punkte</th>
                <th className="px-3 py-2 text-right">{managerA}</th>
                <th className="px-3 py-2 text-right">{managerB}</th>
              </tr>
            </thead>
            <tbody>
              {[...seriesA.slice(1).map((p) => ({ ...p, side: "a" as const })), ...seriesB.slice(1).map((p) => ({ ...p, side: "b" as const }))]
                .sort((p, q) => p.t - q.t)
                .flatMap((p) => p.plays.map((pl, i) => ({ ...pl, t: p.t, side: p.side, key: `${p.side}-${p.t}-${i}` })))
                .map((row) => (
                  <tr key={row.key} className="border-t border-border-light">
                    <td className="px-3 py-1.5 text-text-faint whitespace-nowrap">{formatTime(data.start + row.t)}</td>
                    <td className="px-3 py-1.5 text-text-secondary">
                      <span
                        className="mr-2 inline-block h-0.5 w-3 rounded align-middle"
                        style={{ background: row.side === "a" ? COLOR_A : COLOR_B }}
                      />
                      {row.player}
                    </td>
                    <td className={`px-3 py-1.5 text-right font-mono ${row.pts < 0 ? "text-negative" : "text-ink"}`}>
                      {row.pts > 0 ? "+" : ""}
                      {row.pts.toFixed(2)}
                    </td>
                    <td className="px-3 py-1.5 text-right font-mono text-text-muted">{scoreAt(seriesA, row.t).score.toFixed(1)}</td>
                    <td className="px-3 py-1.5 text-right font-mono text-text-muted">{scoreAt(seriesB, row.t).score.toFixed(1)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}
