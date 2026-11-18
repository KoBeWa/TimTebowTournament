import { supabase } from "@/lib/supabase";
import { getChampionsBySeason } from "@/lib/queries";
import { SEASONS } from "@/lib/constants";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Crown } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import ManagerName from "@/components/ui/ManagerName";
import { notFound } from "next/navigation";
import { seasonScores } from "./seasonScore";

export function generateStaticParams() {
  return SEASONS.map((season) => ({ season: String(season) }));
}

async function getSeasonData(year: number) {
  const [
    { data: seasonInfo },
    { data: results },
    { data: playoffs },
    champMap,
    { data: allPlay },
    { data: luck },
  ] = await Promise.all([
    supabase.from("seasons").select("reg_season_weeks, total_managers, playoff_teams").eq("year", year).single(),
    supabase.from("season_results").select("manager_id, reg_rank, wins, losses, ties, points_for, points_against, max_points_for, lineup_efficiency").eq("season_year", year).order("reg_rank", { ascending: true }),
    supabase.from("playoff_results").select("manager_id, final_rank, seed, week15_pts, week16_pts").eq("season_year", year).order("final_rank", { ascending: true }),
    getChampionsBySeason(),
    supabase.from("v_all_play").select("manager_id, ap_wins, ap_losses, ap_ties, ap_win_pct").eq("season_year", year),
    supabase.from("v_luck").select("manager_id, luck").eq("season_year", year),
  ]);

  return {
    seasonInfo, results: results ?? [], playoffs: playoffs ?? [], champs: champMap[year],
    allPlay: new Map((allPlay ?? []).map((r) => [r.manager_id, r])),
    luck: new Map((luck ?? []).map((r) => [r.manager_id, Number(r.luck)])),
  };
}

export default async function SeasonPage({ params }: { params: Promise<{ season: string }> }) {
  const { season: seasonStr } = await params;
  const year = parseInt(seasonStr);
  if (isNaN(year)) notFound();

  const { seasonInfo, results, playoffs, champs, allPlay, luck } = await getSeasonData(year);
  if (!seasonInfo) notFound();

  const finalRank = new Map(playoffs.map((p) => [p.manager_id, p.final_rank as number]));
  const scores = seasonScores(results.map((r) => ({
    manager_id: r.manager_id,
    apPct: allPlay.has(r.manager_id) ? Number(allPlay.get(r.manager_id)!.ap_win_pct) : null,
    wins: r.wins, losses: r.losses, ties: r.ties, pf: Number(r.points_for),
    rank: finalRank.get(r.manager_id) ?? r.reg_rank,
  })));

  const prevSeason = SEASONS.includes(year - 1) ? year - 1 : null;
  const nextSeason = SEASONS.includes(year + 1) ? year + 1 : null;

  const navLink = "btn gap-1";
  const th = "px-4 py-2.5 text-xs font-medium text-text-muted";

  return (
    <div className="space-y-8">
      <PageHeader
        title={`Saison ${year}`}
        crumbs={[{ label: "History", href: "/history" }]}
        description={`${seasonInfo.total_managers} Teams, ${seasonInfo.reg_season_weeks} Wochen, ${seasonInfo.playoff_teams} Playoff-Teams`}
      >
        {prevSeason && (
          <Link href={`/history/${prevSeason}`} className={navLink}><ChevronLeft size={16} aria-hidden /> {prevSeason}</Link>
        )}
        {nextSeason && (
          <Link href={`/history/${nextSeason}`} className={navLink}>{nextSeason} <ChevronRight size={16} aria-hidden /></Link>
        )}
      </PageHeader>

      {champs && (
        <div className="cell-accent flex flex-wrap items-center gap-x-8 gap-y-2 px-4 py-3 sm:px-5">
          <div className="flex items-center gap-2">
            <Crown size={16} aria-hidden className="text-gold" />
            <span className="text-xs text-text-muted">Champion</span>
            <ManagerName id={champs.champion} className="font-medium text-ink" />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-text-muted">Runner-up</span>
            <ManagerName id={champs.runner_up} className="text-ink" />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-text-muted">Sacko</span>
            <ManagerName id={champs.sacko} className="text-ink" />
          </div>
        </div>
      )}

      <section>
        <h2 className="section-title text-ink">Regular Season</h2>
        <p className="mb-4 mt-1 text-xs text-text-muted">
          Score von 0 bis 100: All Play 35 %, Bilanz 25 %, Punkte im Saisonvergleich 15 %, Endplatzierung 25 %
          {finalRank.size === 0 ? " (laufende Saison: aktueller Tabellenplatz)" : ""}.
        </p>
        <div className="cell overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className={`${th} w-10 text-left`}>#</th>
                <th className={`${th} text-left`}>Manager</th>
                <th className={`${th} text-center`}>Bilanz</th>
                <th className={`${th} hidden text-center md:table-cell`} title="Bilanz, wenn man jede Woche gegen alle gespielt hätte">All Play</th>
                <th className={`${th} hidden text-right md:table-cell`} title="Siege minus erwartete Siege laut All Play">Luck</th>
                <th className={`${th} text-right`}>PF</th>
                <th className={`${th} hidden text-right md:table-cell`}>PA</th>
                <th className={`${th} hidden text-right lg:table-cell`}>Max PF</th>
                <th className={`${th} hidden text-right lg:table-cell`}>Efficiency</th>
                <th className={`${th} hidden text-center md:table-cell`} title="Endplatzierung">Final</th>
                <th className={`${th} text-right`} title="All Play 35 %, Bilanz 25 %, Punkte 15 %, Platzierung 25 %">Score</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r) => {
                const ap = allPlay.get(r.manager_id);
                const lk = luck.get(r.manager_id);
                return (
                  <tr key={r.manager_id} className="border-t border-border-light">
                    <td className={`measured px-4 py-2.5 ${r.reg_rank === 1 ? "text-gold" : "text-text-muted"}`}>{r.reg_rank}</td>
                    <td className="px-4 py-2.5 font-medium text-ink"><ManagerName id={r.manager_id} /></td>
                    <td className="measured whitespace-nowrap px-4 py-2.5 text-center">
                      <span className="win">{r.wins}</span>
                      <span className="text-text-muted">–</span>
                      <span className="loss">{r.losses}</span>
                      {r.ties > 0 && <><span className="text-text-muted">–</span><span className="tie">{r.ties}</span></>}
                    </td>
                    <td className="hidden measured whitespace-nowrap px-4 py-2.5 text-center text-text-secondary md:table-cell">
                      {ap ? <>{ap.ap_wins}–{ap.ap_losses}{ap.ap_ties ? `–${ap.ap_ties}` : ""}
                        <span className="block text-[11px] text-text-muted">{(Number(ap.ap_win_pct) * 100).toFixed(1)}%</span></> : "–"}
                    </td>
                    <td className={`measured hidden px-4 py-2.5 text-right md:table-cell ${(lk ?? 0) > 0 ? "text-positive" : (lk ?? 0) < 0 ? "text-negative" : "text-text-secondary"}`}>
                      {lk !== undefined ? `${lk > 0 ? "+" : ""}${lk.toFixed(1)}` : "–"}
                    </td>
                    <td className="measured px-4 py-2.5 text-right">{Number(r.points_for).toFixed(1)}</td>
                    <td className="measured hidden px-4 py-2.5 text-right text-text-secondary md:table-cell">{Number(r.points_against).toFixed(1)}</td>
                    <td className="measured hidden px-4 py-2.5 text-right text-text-secondary lg:table-cell">
                      {r.max_points_for ? Number(r.max_points_for).toFixed(1) : "–"}
                    </td>
                    <td className="measured hidden px-4 py-2.5 text-right lg:table-cell">
                      {r.lineup_efficiency ? `${(Number(r.lineup_efficiency) * 100).toFixed(1)}%` : "–"}
                    </td>
                    <td className="measured hidden px-4 py-2.5 text-center text-text-secondary md:table-cell">
                      {finalRank.has(r.manager_id) ? `${finalRank.get(r.manager_id)}.` : "–"}
                    </td>
                    <td className="px-3 py-3 text-right">
                      <span className="measured inline-block min-w-[2.5rem] rounded-[var(--radius-pill)] bg-surface-3 px-2 py-0.5 text-center font-medium text-ink">
                        {scores[r.manager_id]}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="section-title mb-4 text-ink">Playoffs</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {playoffs.slice(0, 4).map((p) => (
            <div key={p.manager_id} className="cell p-4">
              <div className="text-xs text-text-muted">
                {p.final_rank === 1 ? "Champion" : p.final_rank === 2 ? "Runner-up" : p.final_rank === 3 ? "Platz 3" : "Platz 4"}
              </div>
              <div className={`mt-0.5 text-base font-medium ${p.final_rank === 1 ? "text-red" : "text-ink"}`}>
                <ManagerName id={p.manager_id} plain />
              </div>
              <div className="measured mt-1 text-xs text-text-muted">
                Seed {p.seed}, {Number(p.week15_pts).toFixed(1)} + {Number(p.week16_pts).toFixed(1)} Pkt.
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
