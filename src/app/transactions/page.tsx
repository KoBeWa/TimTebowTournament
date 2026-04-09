import { supabase } from "@/lib/supabase";
import TransactionBrowser from "./TransactionBrowser";
import TransactionPositionStats, { type TxPositionData } from "./TransactionPositionStats";

export const dynamic = "force-dynamic";

interface TxRow {
  transaction_id: string;
  season_year: number;
  gain_week: number;
  manager_id: string;
  add_player: string;
  add_pos: string;
  drop_player: string | null;
  add_pts: number;
  drop_pts: number;
  net_pts: number;
  net_pts_adj: number;
  window_weeks: number;
  transaction_score: number;
  transaction_score_alltime: number;
}

const TX_COLS = "transaction_id, season_year, gain_week, manager_id, add_player, add_pos, drop_player, add_pts, drop_pts, net_pts, net_pts_adj, window_weeks, transaction_score, transaction_score_alltime";

async function getAllTx(): Promise<TxRow[]> {
  const [p1, p2, p3] = await Promise.all([
    supabase.from("fa_transaction_scores").select(TX_COLS).range(0, 999),
    supabase.from("fa_transaction_scores").select(TX_COLS).range(1000, 1999),
    supabase.from("fa_transaction_scores").select(TX_COLS).range(2000, 2999),
  ]);
  return [...(p1.data ?? []), ...(p2.data ?? []), ...(p3.data ?? [])].map((r) => ({
    ...r,
    add_pts: Number(r.add_pts),
    drop_pts: Number(r.drop_pts),
    net_pts: Number(r.net_pts),
    net_pts_adj: Number(r.net_pts_adj),
    window_weeks: Number(r.window_weeks),
    transaction_score: Number(r.transaction_score),
    transaction_score_alltime: Number(r.transaction_score_alltime),
  }));
}

function avg(arr: number[]) {
  return arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
}

export default async function TransactionsPage() {
  const [txRows, { data: seasonMovesRaw }] = await Promise.all([
    getAllTx(),
    supabase.from("season_results").select("season_year, moves"),
  ]);

  // Season move counts from season_results
  const seasonMoveCounts: Record<number, number> = {};
  for (const r of seasonMovesRaw ?? []) {
    seasonMoveCounts[r.season_year] = (seasonMoveCounts[r.season_year] ?? 0) + (Number(r.moves) || 0);
  }

  const totalMoves = Object.values(seasonMoveCounts).reduce((a, b) => a + b, 0);
  const avgNet = avg(txRows.map((r) => r.net_pts_adj));
  const seasons = Object.keys(seasonMoveCounts).map(Number).sort();
  const maxMoves = Math.max(...Object.values(seasonMoveCounts));

  // Top 10 / Worst 10 by position-adjusted net
  const sortedByNet = [...txRows].sort((a, b) => b.net_pts_adj - a.net_pts_adj);
  const top10 = sortedByNet.slice(0, 10);
  const worst10 = [...txRows].sort((a, b) => a.net_pts_adj - b.net_pts_adj).slice(0, 10);

  // Pickups per season for chart tooltip
  const txBySeason = txRows.reduce((acc, r) => {
    (acc[r.season_year] ??= []).push(r);
    return acc;
  }, {} as Record<number, TxRow[]>);

  // ── Position rankings ──
  const POSITIONS = ["QB", "RB", "WR", "TE", "K", "DST"];
  const positionData: TxPositionData[] = POSITIONS.map((pos) => {
    const posTx = txRows.filter((r) =>
      pos === "DST" ? r.add_pos === "DST" || r.add_pos === "DEF" : r.add_pos === pos
    );

    const ownerMap: Record<string, { nets: number[]; scores: number[] }> = {};
    for (const r of posTx) {
      const e = (ownerMap[r.manager_id] ??= { nets: [], scores: [] });
      e.nets.push(r.net_pts_adj);
      e.scores.push(r.transaction_score_alltime);
    }
    const ownerRankings = Object.entries(ownerMap)
      .map(([id, d]) => ({ id, avgNet: avg(d.nets), avgScore: avg(d.scores), picks: d.nets.length }))
      .sort((a, b) => b.avgNet - a.avgNet);

    const sortedPos = [...posTx].sort((a, b) => b.net_pts_adj - a.net_pts_adj);
    const top5 = sortedPos.slice(0, 5).map((r) => ({
      season_year: r.season_year, gain_week: r.gain_week,
      add_player: r.add_player, drop_player: r.drop_player,
      manager_id: r.manager_id, net_pts: r.net_pts_adj,
      transaction_score_alltime: r.transaction_score_alltime,
    }));
    const worst5 = [...posTx].sort((a, b) => a.net_pts_adj - b.net_pts_adj).slice(0, 5).map((r) => ({
      season_year: r.season_year, gain_week: r.gain_week,
      add_player: r.add_player, drop_player: r.drop_player,
      manager_id: r.manager_id, net_pts: r.net_pts_adj,
      transaction_score_alltime: r.transaction_score_alltime,
    }));

    return { position: pos, ownerRankings, top5, worst5 };
  });

  return (
    <div>
      {/* ── Page header ── */}
      <div className="mb-8" style={{ borderBottom: "2px solid #1a1a1a", paddingBottom: "1rem" }}>
        <div className="kicker mb-1">Statistiken</div>
        <h1 className="display-title text-4xl md:text-5xl text-ink">Transactions</h1>
        <p className="text-text-muted mt-1 text-sm">Jeder Waiver Move — Add, Drop, Net Value</p>
      </div>

      {/* ── Header stats ── */}
      <div className="grid grid-cols-3 gap-4 mb-10">
        {[
          { label: "Waiver Moves", value: totalMoves.toLocaleString("de-DE"), sub: "Moves all time" },
          {
            label: "Ø Net Value",
            value: (avgNet >= 0 ? "+" : "") + avgNet.toFixed(1),
            sub: "Add − Drop pts, all time",
            color: avgNet >= 0 ? undefined : "rgb(150,35,35)" as string,
          },
          { label: "Transaktionen", value: txRows.length.toLocaleString("de-DE"), sub: "analysierte Moves" },
        ].map((s) => (
          <div key={s.label} className="cell p-5">
            <div className="kicker mb-1">{s.label}</div>
            <div className="display-title text-3xl text-ink" style={s.color ? { color: s.color } : undefined}>{s.value}</div>
            <div className="text-xs text-text-muted mt-1">{s.sub}</div>
          </div>
        ))}
      </div>

      {/* ── Top 10 / Worst 10 ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-10">
        {[
          { title: "Top 10 Moves All Time", list: top10, best: true },
          { title: "Worst 10 Moves All Time", list: worst10, best: false },
        ].map(({ title, list, best }) => (
          <div key={title}>
            <div className="kicker mb-3">{title}</div>
            <table className="w-full text-sm" style={{ borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "2px solid #1a1a1a" }}>
                  <th className="label-nav text-xs text-text-muted text-left py-2 pr-2">#</th>
                  <th className="label-nav text-xs text-text-muted text-left py-2 pr-3">Add / Drop</th>
                  <th className="label-nav text-xs text-text-muted text-left py-2 pr-3">Owner</th>
                  <th className="label-nav text-xs text-text-muted text-right py-2 pr-3">Raw</th>
                  <th className="label-nav text-xs text-text-muted text-right py-2">Adj Net</th>
                </tr>
              </thead>
              <tbody>
                {list.map((r, i) => (
                  <tr key={`${r.transaction_id}-${r.add_player}-${i}`} style={{ borderBottom: "1px solid var(--color-border-light)" }}>
                    <td className="py-2.5 pr-2 label-nav text-xs text-text-faint">{i + 1}</td>
                    <td className="py-2.5 pr-3">
                      <div className="font-medium text-ink text-sm">{r.add_player}</div>
                      {r.drop_player && (
                        <div className="label-nav text-xs text-text-muted">− {r.drop_player}</div>
                      )}
                      <div className="label-nav text-xs text-text-faint">{r.season_year} · Wk{r.gain_week}</div>
                    </td>
                    <td className="py-2.5 pr-3 label-nav text-xs text-ink">{r.manager_id}</td>
                    <td className="py-2.5 pr-3 text-right font-mono text-xs text-text-muted">
                      {r.net_pts >= 0 ? "+" : ""}{r.net_pts.toFixed(1)}
                    </td>
                    <td
                      className="py-2.5 text-right font-mono text-sm font-semibold"
                      style={{ color: best ? "#1a1a1a" : "rgb(150,35,35)" }}
                    >
                      {r.net_pts_adj >= 0 ? "+" : ""}{r.net_pts_adj.toFixed(1)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>

      {/* ── Transactions per season chart ── */}
      <div className="mb-10">
        <div className="kicker mb-3">Moves per Saison</div>
        <div className="cell p-6">
          <div className="flex items-end gap-3" style={{ height: "120px" }}>
            {seasons.map((yr) => {
              const count = seasonMoveCounts[yr] ?? 0;
              const pct = (count / maxMoves) * 100;
              const txCount = txBySeason[yr]?.length ?? 0;
              const avgNetSeason = avg((txBySeason[yr] ?? []).map((r) => r.net_pts));
              return (
                <div key={yr} className="flex-1 flex flex-col items-center gap-1 h-full justify-end group">
                  <div className="label-nav opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap text-center" style={{ fontSize: "9px", color: "var(--color-text-muted)" }}>
                    {count} moves<br />{txCount} scored<br />Ø {avgNetSeason >= 0 ? "+" : ""}{avgNetSeason.toFixed(0)}
                  </div>
                  <div
                    className="w-full rounded-sm"
                    style={{ height: `${pct}%`, background: "#1a1a1a", minHeight: "4px", opacity: 0.75 }}
                  />
                  <div className="label-nav text-xs text-text-muted">{String(yr).slice(2)}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Position Rankings ── */}
      <div className="mb-12" style={{ borderTop: "2px solid #1a1a1a", paddingTop: "2rem" }}>
        <div className="kicker mb-1">Positions</div>
        <h2 className="display-title text-2xl text-ink mb-6">Positions-Rankings</h2>
        <TransactionPositionStats data={positionData} />
      </div>

      {/* ── Transaction Browser ── */}
      <div style={{ borderTop: "2px solid #1a1a1a", paddingTop: "2rem" }}>
        <div className="kicker mb-1">Browser</div>
        <h2 className="display-title text-2xl text-ink mb-6">Alle Transactions</h2>
        <TransactionBrowser />
      </div>
    </div>
  );
}
