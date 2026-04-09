import { supabase } from "@/lib/supabase";
import { getSeasonSummaries } from "@/lib/queries";
import Link from "next/link";
import AllTimeRankings from "./AllTimeRankings";

async function getSeasonResults() {
  const { data } = await supabase
    .from("season_results")
    .select("*")
    .order("season_year", { ascending: false })
    .order("reg_rank", { ascending: true });
  return data ?? [];
}

async function getAllTimeRankings() {
  const [{ data: standings }, { data: eloData }] = await Promise.all([
    supabase
      .from("v_alltime_standings")
      .select("manager_id, reg_wins, reg_losses, reg_ties, allplay_wins, allplay_losses, championships, runner_up, third_place, playoff_appearances, real_po_wins, real_po_losses"),
    supabase
      .from("v_elo_current")
      .select("manager_id, current_elo, elo_rank")
      .order("elo_rank", { ascending: true }),
  ]);

  const eloByManager: Record<string, number> = {};
  for (const row of eloData ?? []) {
    eloByManager[row.manager_id] = Math.round(Number(row.current_elo));
  }

  return (standings ?? []).map((r) => {
    const gp = (r.reg_wins ?? 0) + (r.reg_losses ?? 0) + (r.reg_ties ?? 0);
    const apGp = Number(r.allplay_wins ?? 0) + Number(r.allplay_losses ?? 0);
    const gold = r.championships ?? 0;
    const silver = r.runner_up ?? 0;
    const bronze = r.third_place ?? 0;
    return {
      manager_id: r.manager_id,
      record: `${r.reg_wins}–${r.reg_losses}${r.reg_ties > 0 ? `–${r.reg_ties}` : ""}`,
      winPct: gp > 0 ? r.reg_wins / gp : 0,
      apRecord: apGp > 0 ? `${r.allplay_wins}–${r.allplay_losses}` : "—",
      apWinPct: apGp > 0 ? Number(r.allplay_wins) / apGp : 0,
      elo: eloByManager[r.manager_id] ?? null,
      playoffAppearances: r.playoff_appearances ?? 0,
      poRecord: `${r.real_po_wins ?? 0}–${r.real_po_losses ?? 0}`,
      gold,
      silver,
      bronze,
      medalScore: gold * 8 + silver * 5 + bronze * 2,
    };
  });
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
      <AllTimeRankings rows={allTime} />

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
