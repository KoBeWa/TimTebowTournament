"use client";

import { useMemo, useState } from "react";
import Tabs from "@/components/ui/Tabs";
import StatTile from "@/components/ui/StatTile";
import ManagerName from "@/components/ui/ManagerName";
import SvgTooltip from "./SvgTooltip";
import { type VTxRow, type FaTxRow, fmt, valTone, TH } from "./shared";

type TeamPoint = { team: string; value: number; posValue: number; hitRate: number; count: number };
type Mode = "value" | "hitrate";

const MODE_TABS: { key: Mode; label: string }[] = [
  { key: "value", label: "Positiver Wert" },
  { key: "hitrate", label: "Trefferquote" },
];

// NFL team chart: bars = adds, line = positive value or hit rate
function TeamChart({ data, mode }: { data: TeamPoint[]; mode: Mode }) {
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
        {[0, 0.25, 0.5, 0.75, 1].map(p => (
          <line key={p} x1={PAD.l} x2={W - PAD.r}
            y1={PAD.t + plotH * p} y2={PAD.t + plotH * p}
            className="stroke-border" strokeWidth="0.5" />
        ))}
        {data.map((d, i) => (
          <rect key={`bar-${i}`}
            x={PAD.l + i * slotW + slotW * 0.25} y={barY(d.count)}
            width={slotW * 0.5} height={barH(d.count)}
            className="fill-red" opacity={0.15} style={{ cursor: "pointer" }}
            onMouseEnter={() => setTip({ x: lx(i), y: barY(d.count) + barH(d.count) / 2, lines: [d.team, `Adds: ${d.count}`] })} />
        ))}
        {data.length > 1 && <polyline points={linePoints} fill="none" className="stroke-red" strokeWidth="1.5" />}
        {lineVals.map((v, i) => (
          <circle key={`dot-hit-${i}`} cx={lx(i)} cy={ly(v)} r="6" fill="transparent" style={{ cursor: "pointer" }}
            onMouseEnter={() => setTip({
              x: lx(i), y: ly(v),
              lines: [data[i].team,
                mode === "hitrate" ? `Trefferquote: ${v.toFixed(1)}%` : `Pos. Wert: ${v.toFixed(1)}`,
                `Adds: ${data[i].count}`],
            })} />
        ))}
        {lineVals.map((v, i) => (
          <circle key={`dot-${i}`} cx={lx(i)} cy={ly(v)} r="2.5" className="fill-red" pointerEvents="none" />
        ))}
        {/* X labels, rotated 45° */}
        {data.map((d, i) => (
          <text key={`xl-${i}`}
            x={lx(i)} y={H - PAD.b + 12}
            textAnchor="end"
            transform={`rotate(-45, ${lx(i)}, ${H - PAD.b + 12})`}
            style={{ fontSize: "9px", fill: "var(--color-text-muted)", fontFamily: "inherit" }}>
            {d.team}
          </text>
        ))}
        {[maxVal, maxVal / 2, 0].map((v, i) => (
          <text key={`lv-${i}`} x={PAD.l - 4} y={ly(v) + 4} textAnchor="end"
            style={{ fontSize: "9px", fill: "var(--color-text-muted)", fontFamily: "inherit" }}>
            {mode === "hitrate" ? v.toFixed(0) + "%" : v.toFixed(0)}
          </text>
        ))}
        {[maxCount, Math.round(maxCount / 2), 0].map((v, i) => (
          <text key={`rc-${i}`} x={W - PAD.r + 4} y={PAD.t + (i / 2) * plotH + 4} textAnchor="start"
            style={{ fontSize: "9px", fill: "var(--color-text-muted)", fontFamily: "inherit" }}>{v}</text>
        ))}
        {tip && <SvgTooltip x={tip.x} y={tip.y} lines={tip.lines} W={W} H={H} />}
      </svg>
      <div className="mt-2 flex gap-6 text-xs text-text-muted">
        <div className="flex items-center gap-2">
          <span className="inline-block h-0.5 w-4 bg-red" />
          {mode === "hitrate" ? "Trefferquote in % (links)" : "Positiver Wert (links)"}
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block h-2 w-3 bg-red/35" />
          Alle Transaktionen (rechts)
        </div>
      </div>
    </div>
  );
}

function TradeSide({ side }: { side: VTxRow | null }) {
  if (!side) return <span className="text-text-faint">—</span>;
  return (
    <div className="min-w-0">
      <div className="mb-0.5 font-semibold text-ink"><ManagerName id={side.team_name} /></div>
      {side.add_players && (
        <div className="text-xs text-ink"><span className="mr-1 font-bold text-positive">+</span>{side.add_players}</div>
      )}
      {side.drop_players && (
        <div className="text-xs text-text-muted"><span className="mr-1 font-bold">−</span>{side.drop_players}</div>
      )}
      <div className={`mt-1 font-semibold tabular-nums ${valTone(side.net_value)}`}>{fmt(side.net_value)}</div>
    </div>
  );
}

export default function PlayersTeamsTab({ vtx, filt, filtFatx, isFiltered }: {
  vtx: VTxRow[];
  filt: VTxRow[];
  filtFatx: FaTxRow[];
  isFiltered: boolean;
}) {
  const [mode, setMode] = useState<Mode>("value");

  const stats = useMemo(() => {
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

  // Trade pairs: both sides of a trade, biggest swing first
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

  const { mostTransactedPlayer: tp, mostValuePlayer: vp, mostTransactedTeam: tt, mostValueTeam: vt, chartTeams } = stats;

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Meistbewegter Spieler" value={tp?.name ?? "—"} hint={tp ? `${tp.count}x hinzugefügt` : undefined} />
        <StatTile label="Wertvollster Spieler" value={vp?.name ?? "—"}
          hint={vp ? <span className={valTone(vp.value)}>{fmt(vp.value)}</span> : undefined} />
        <StatTile label="Meistbewegtes Team" value={tt?.team ?? "—"} hint={tt ? `${tt.count}x Spieler hinzugefügt` : undefined} />
        <StatTile label="Wertvollstes Team" value={vt?.team ?? "—"}
          hint={vt ? <span className={valTone(vt.posValue)}>{fmt(vt.posValue)}</span> : undefined} />
      </div>

      {chartTeams.length > 0 && (
        <section>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h2 className="section-title text-ink">Aktivität pro NFL-Team</h2>
            <Tabs tabs={MODE_TABS} value={mode} onChange={setMode} size="sm" label="Diagramm-Ansicht" />
          </div>
          <div className="cell p-4 sm:p-5">
            <TeamChart data={chartTeams} mode={mode} />
          </div>
        </section>
      )}

      <section>
        <h2 className="section-title mb-3 text-ink">{isFiltered ? "Trades" : "Top-Trades aller Zeiten"}</h2>
        {tradePairs.length === 0 ? (
          <div className="cell py-8 text-center text-sm text-text-faint">Keine Trades im gewählten Zeitraum</div>
        ) : (
          <div className="cell overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left">
                  <th className={`${TH} pl-4 pr-2 sm:pl-5`}>Saison</th>
                  <th className={`${TH} px-2`}>Seite 1</th>
                  <th className={`${TH} pl-2 pr-4 sm:pr-5`}>Seite 2</th>
                </tr>
              </thead>
              <tbody>
                {tradePairs.map(({ key, side1, side2 }) => (
                  <tr key={key} className="border-t border-border-light align-top">
                    <td className="whitespace-nowrap py-3 pl-4 pr-2 text-text-muted sm:pl-5">
                      {side1.season_year}
                      <div className="text-xs text-text-faint">Woche {side1.transaction_week}</div>
                    </td>
                    <td className="px-2 py-3"><TradeSide side={side1} /></td>
                    <td className="py-3 pl-2 pr-4 sm:pr-5"><TradeSide side={side2} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
