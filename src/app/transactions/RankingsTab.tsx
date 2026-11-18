"use client";

import { useMemo } from "react";
import { MANAGERS } from "@/lib/constants";
import StatTile from "@/components/ui/StatTile";
import ManagerName from "@/components/ui/ManagerName";
import { type VTxRow, fmt, valTone, TH } from "./shared";

function RankingTable({ rows, label }: { rows: { team: string; value: number }[]; label: string }) {
  return (
    <div className="cell overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left">
            <th className={`${TH} pl-4 pr-2 sm:pl-5`}>#</th>
            <th className={`${TH} px-2`}>Owner</th>
            <th className={`${TH} pl-2 pr-4 text-right sm:pr-5`}>{label}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.team} className="border-t border-border-light">
              <td className="py-2.5 pl-4 pr-2 measured text-text-faint sm:pl-5">{i + 1}</td>
              <td className="px-2 py-2.5 font-semibold text-ink"><ManagerName id={r.team} /></td>
              <td className={`py-2.5 pl-2 pr-4 text-right font-semibold measured sm:pr-5 ${valTone(r.value)}`}>{fmt(r.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

type SeasonRecord = { team: string; season: number; total: number } | null;

export default function RankingsTab({ vtx, filt, seasonFiltered }: {
  vtx: VTxRow[];
  filt: VTxRow[];
  seasonFiltered: boolean;
}) {
  // Team rankings, averaged per season unless a single season is selected
  const teamRankings = useMemo(() => MANAGERS.map(team => {
    const tv = seasonFiltered ? filt.filter(r => r.team_name === team) : vtx.filter(r => r.team_name === team);
    const numSeasons = seasonFiltered ? 1 : (new Set(tv.map(r => r.season_year)).size || 1);
    const waiverVal  = tv.filter(r => r.transaction_type !== "trade" && r.is_meaningful && r.scored_value != null)
      .reduce((s, r) => s + (r.scored_value ?? 0), 0);
    const tradeVal   = tv.filter(r => r.transaction_type === "trade").reduce((s, r) => s + r.net_value, 0);
    return { team, waiverAvg: waiverVal / numSeasons, tradeAvg: tradeVal / numSeasons, totalAvg: (waiverVal + tradeVal) / numSeasons };
  }), [filt, vtx, seasonFiltered]);

  const rankingLabel = seasonFiltered ? "Total" : "Ø pro Saison";
  const scope = seasonFiltered ? "Diese Saison" : "Durchschnitt pro Saison, alle Zeiten";

  // Best and worst owner seasons
  const seasonRecords = useMemo(() => {
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
  }, [filt, vtx, seasonFiltered]);

  const tables = [
    { title: "Waiver-Ranking", key: "waiverAvg" as const },
    { title: "Trade-Ranking", key: "tradeAvg" as const },
    { title: "Manager-Ranking", key: "totalAvg" as const },
  ];
  const records: { label: string; data: SeasonRecord; tone: "positive" | "negative" }[] = [
    { label: "Beste Waiver-Saison",        data: seasonRecords.bestWaiver,  tone: "positive" },
    { label: "Schlechteste Waiver-Saison", data: seasonRecords.worstWaiver, tone: "negative" },
    { label: "Beste Trade-Saison",         data: seasonRecords.bestTrade,   tone: "positive" },
    { label: "Schlechteste Trade-Saison",  data: seasonRecords.worstTrade,  tone: "negative" },
  ];

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {tables.map(t => (
          <section key={t.key}>
            <h2 className="section-title text-ink">{t.title}</h2>
            <p className="mb-3 text-sm text-text-muted">{scope}</p>
            <RankingTable
              rows={[...teamRankings].sort((a, b) => b[t.key] - a[t.key]).map(r => ({ team: r.team, value: r[t.key] }))}
              label={rankingLabel}
            />
          </section>
        ))}
      </div>

      <section>
        <h2 className="section-title mb-3 text-ink">Saison-Rekorde</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {records.map(({ label, data, tone }) => (
            <StatTile key={label} label={label}
              value={data ? fmt(data.total) : "–"}
              tone={data ? tone : undefined}
              hint={data ? <><ManagerName id={data.team} />{!seasonFiltered && <span className="mt-0.5 block">{data.season}</span>}</> : undefined} />
          ))}
        </div>
      </section>
    </div>
  );
}
