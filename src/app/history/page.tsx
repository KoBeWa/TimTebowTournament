import { supabase } from "@/lib/supabase";
import { getSeasonSummaries } from "@/lib/queries";
import Link from "next/link";

async function getSeasonResults() {
  const { data } = await supabase
    .from("season_results")
    .select("*")
    .order("season_year", { ascending: false })
    .order("reg_rank", { ascending: true });
  return data ?? [];
}

async function getAllTimeRankings() {
  const [{ data: results }, { data: eloRaw }] = await Promise.all([
    supabase
      .from("season_results")
      .select("manager_id, wins, losses, ties, all_play_wins, all_play_losses"),
    supabase
      .from("v_elo_history")
      .select("manager_id, elo")
      .order("season_year", { ascending: false })
      .order("week", { ascending: false }),
  ]);

  // Latest ELO per manager (first occurrence = most recent due to ordering)
  const eloByManager: Record<string, number> = {};
  for (const row of eloRaw ?? []) {
    if (!(row.manager_id in eloByManager)) {
      eloByManager[row.manager_id] = Math.round(row.elo);
    }
  }

  // Aggregate career totals per manager
  const totals: Record<string, { wins: number; losses: number; ties: number; apWins: number; apLosses: number }> = {};
  for (const r of results ?? []) {
    if (!totals[r.manager_id]) totals[r.manager_id] = { wins: 0, losses: 0, ties: 0, apWins: 0, apLosses: 0 };
    totals[r.manager_id].wins += r.wins ?? 0;
    totals[r.manager_id].losses += r.losses ?? 0;
    totals[r.manager_id].ties += r.ties ?? 0;
    totals[r.manager_id].apWins += r.all_play_wins ?? 0;
    totals[r.manager_id].apLosses += r.all_play_losses ?? 0;
  }

  return Object.entries(totals)
    .map(([manager_id, t]) => {
      const gp = t.wins + t.losses + t.ties;
      const apGp = t.apWins + t.apLosses;
      return {
        manager_id,
        record: `${t.wins}–${t.losses}${t.ties > 0 ? `–${t.ties}` : ""}`,
        winPct: gp > 0 ? (t.wins / gp) : 0,
        apRecord: apGp > 0 ? `${t.apWins}–${t.apLosses}` : "—",
        apWinPct: apGp > 0 ? (t.apWins / apGp) : 0,
        elo: eloByManager[manager_id] ?? null,
      };
    })
    .sort((a, b) => (b.elo ?? 0) - (a.elo ?? 0));
}

export default async function HistoryPage() {
  const [seasons, results, allTime] = await Promise.all([
    getSeasonSummaries(),
    getSeasonResults(),
    getAllTimeRankings(),
  ]);

  const resultsBySeason = results.reduce(
    (acc, r) => {
      if (!acc[r.season_year]) acc[r.season_year] = [];
      acc[r.season_year].push(r);
      return acc;
    },
    {} as Record<number, typeof results>
  );

  return (
    <div>
      <div className="mb-8" style={{ borderBottom: "2px solid #1a1a1a", paddingBottom: "1rem" }}>
        <div className="kicker mb-1">Archiv</div>
        <h1 className="display-title text-4xl md:text-5xl text-ink">League History</h1>
        <p className="text-text-muted mt-1 text-sm">Jede Season erzählt ihre eigene Geschichte</p>
      </div>

      {/* ── ALL-TIME RANKINGS ── */}
      <div className="mb-10">
        <div className="kicker mb-3">Alltime Rankings</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm" style={{ borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #1a1a1a" }}>
                <th className="label-nav text-xs text-text-muted text-left py-2 pr-4">#</th>
                <th className="label-nav text-xs text-text-muted text-left py-2 pr-6">Manager</th>
                <th className="label-nav text-xs text-text-muted text-right py-2 pr-6">Record</th>
                <th className="label-nav text-xs text-text-muted text-right py-2 pr-6">Win%</th>
                <th className="label-nav text-xs text-text-muted text-right py-2 pr-6">All Play</th>
                <th className="label-nav text-xs text-text-muted text-right py-2 pr-6">AP Win%</th>
                <th className="label-nav text-xs text-text-muted text-right py-2">ELO</th>
              </tr>
            </thead>
            <tbody>
              {allTime.map((row, i) => (
                <tr
                  key={row.manager_id}
                  style={{ borderBottom: "1px solid var(--color-border-light)" }}
                  className="hover:bg-border-light transition-colors"
                >
                  <td className="py-3 pr-4 text-text-faint label-nav text-xs">{i + 1}</td>
                  <td className="py-3 pr-6">
                    <Link href={`/manager/${row.manager_id}`} className="font-semibold text-ink hover:text-red transition-colors">
                      {row.manager_id}
                    </Link>
                  </td>
                  <td className="py-3 pr-6 text-right font-mono text-ink">{row.record}</td>
                  <td className="py-3 pr-6 text-right font-mono text-ink">{(row.winPct * 100).toFixed(1)}%</td>
                  <td className="py-3 pr-6 text-right font-mono text-text-secondary">{row.apRecord}</td>
                  <td className="py-3 pr-6 text-right font-mono text-text-secondary">
                    {row.apWinPct > 0 ? `${(row.apWinPct * 100).toFixed(1)}%` : "—"}
                  </td>
                  <td className="py-3 text-right">
                    <span className={`label-nav text-xs ${row.elo !== null && row.elo >= 1500 ? "text-ink font-semibold" : "text-text-secondary"}`}>
                      {row.elo ?? "—"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ borderTop: "1px solid var(--color-border)" }}>
        {seasons.map((s) => {
          const seasonResults = resultsBySeason[s.year] ?? [];
          const topThree = seasonResults.slice(0, 3);

          return (
            <Link
              key={s.year}
              href={`/history/${s.year}`}
              className="cell-hover flex items-center justify-between px-4 py-5 group"
              style={{ borderBottom: "1px solid var(--color-border)" }}
            >
              <div className="flex items-center gap-6">
                <div className="display-title text-4xl text-text-muted group-hover:text-ink transition-colors">
                  {s.year}
                </div>
                <div>
                  <div className="text-base font-semibold text-ink">
                    Champion: <span className="text-red">{s.champion}</span>
                  </div>
                  <div className="text-xs text-text-muted mt-0.5">
                    {s.total_managers} Teams · {s.reg_season_weeks} Weeks
                  </div>
                </div>
              </div>
              <div className="hidden sm:flex gap-6 text-sm text-text-secondary">
                {topThree.map((r: (typeof results)[number], i: number) => (
                  <div key={r.manager_id} className="text-center">
                    <div className="kicker mb-0.5">{i === 0 ? "1." : i === 1 ? "2." : "3."}</div>
                    <div className="text-ink text-sm">{r.manager_id}</div>
                    <div className="text-text-muted text-xs">{r.wins}–{r.losses}</div>
                  </div>
                ))}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
