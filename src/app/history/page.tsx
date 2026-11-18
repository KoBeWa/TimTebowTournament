import { supabase } from "@/lib/supabase";
import { getSeasonSummaries } from "@/lib/queries";
import Link from "next/link";
import { ChevronRight, Crown } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import ManagerName from "@/components/ui/ManagerName";
import HistoryTabs from "./HistoryTabs";
import AllTimeRankings, { type AllTimeRow } from "./AllTimeRankings";
import AllTimeTrends from "./AllTimeTrends";
import { getTrendData } from "./trends";

async function getSeasonResults() {
  const { data } = await supabase
    .from("season_results")
    .select("season_year, reg_rank, manager_id, wins, losses")
    .order("season_year", { ascending: false })
    .order("reg_rank", { ascending: true });
  return data ?? [];
}

async function getAllTimeRankings(): Promise<AllTimeRow[]> {
  const [{ data: standings }, { data: eloData }] = await Promise.all([
    supabase
      .from("v_alltime_standings")
      .select("manager_id, reg_wins, reg_losses, reg_ties, po_wins, po_losses, po_ties, real_po_wins, real_po_losses, total_wins, total_losses, total_ties, total_pf, avg_pf_per_game, allplay_wins, allplay_losses, championships, runner_up, third_place, playoff_appearances"),
    supabase
      .from("v_elo_current")
      .select("manager_id, current_elo"),
  ]);

  const eloByManager: Record<string, number> = {};
  for (const row of eloData ?? []) {
    eloByManager[row.manager_id] = Math.round(Number(row.current_elo));
  }
  const rec = (w: number, l: number, t: number) => ({ w: w ?? 0, l: l ?? 0, t: t ?? 0 });

  return (standings ?? []).map((r) => {
    const gold = r.championships ?? 0;
    const silver = r.runner_up ?? 0;
    const bronze = r.third_place ?? 0;
    return {
      manager_id: r.manager_id,
      total: rec(r.total_wins, r.total_losses, r.total_ties),
      regular: rec(r.reg_wins, r.reg_losses, r.reg_ties),
      playoffs: rec(r.po_wins, r.po_losses, r.po_ties),
      bracket: rec(r.real_po_wins, r.real_po_losses, 0),
      allPlay: rec(Number(r.allplay_wins), Number(r.allplay_losses), 0),
      pf: Number(r.total_pf ?? 0),
      ppg: Number(r.avg_pf_per_game ?? 0),
      elo: eloByManager[r.manager_id] ?? null,
      playoffAppearances: r.playoff_appearances ?? 0,
      gold,
      silver,
      bronze,
      medalScore: gold * 8 + silver * 5 + bronze * 2,
    };
  });
}

export default async function HistoryPage() {
  const [seasons, results, allTime, trends] = await Promise.all([
    getSeasonSummaries(),
    getSeasonResults(),
    getAllTimeRankings(),
    getTrendData(),
  ]);

  const resultsBySeason = results.reduce(
    (acc, r) => {
      if (!acc[r.season_year]) acc[r.season_year] = [];
      acc[r.season_year].push(r);
      return acc;
    },
    {} as Record<number, typeof results>
  );

  const seasonList = (
    <div className="cell divide-y divide-border-light">
      {seasons.map((s) => {
        const topThree = (resultsBySeason[s.year] ?? []).slice(0, 3);

        return (
          <Link
            key={s.year}
            href={`/history/${s.year}`}
            className="group flex min-h-11 items-center justify-between gap-4 px-4 py-3 hover:bg-surface-2 sm:px-5"
          >
            <div className="flex items-center gap-4 sm:gap-6">
              <div className="measured text-2xl text-text-muted group-hover:text-ink">
                {s.year}
              </div>
              <div>
                <div className="flex items-center gap-2 text-base font-medium text-ink">
                  {s.champion === "—" ? (
                    <span className="text-text-muted">Saison läuft</span>
                  ) : (
                    <>
                      <Crown size={16} aria-hidden className="text-gold" />
                      <ManagerName id={s.champion} plain />
                    </>
                  )}
                </div>
                <div className="mt-0.5 text-xs text-text-muted">
                  {s.total_managers} Teams, {s.reg_season_weeks} Wochen
                </div>
              </div>
            </div>
            <div className="ml-auto hidden gap-6 text-sm text-text-secondary sm:flex">
              {topThree.map((r: (typeof results)[number], i: number) => (
                <div key={r.manager_id} className="text-center" title="Platzierung Regular Season">
                  <div className="measured mb-0.5 text-xs text-text-faint">{i + 1}.</div>
                  <ManagerName id={r.manager_id} plain className="text-sm text-ink" />
                  <div className="measured text-xs text-text-muted">{r.wins}-{r.losses}</div>
                </div>
              ))}
            </div>
            <ChevronRight size={20} aria-hidden className="shrink-0 text-text-faint group-hover:text-ink" />
          </Link>
        );
      })}
    </div>
  );

  return (
    <div>
      <PageHeader title="History" description="Ewige Tabelle, Verlauf seit 2015 und alle Seasons im Überblick." />
      <HistoryTabs
        table={<AllTimeRankings rows={allTime} />}
        trends={<AllTimeTrends data={trends} />}
        seasons={seasonList}
      />
    </div>
  );
}
