import { supabase } from "@/lib/supabase";
import { getChampionsBySeason } from "@/lib/queries";
import { SEASONS } from "@/lib/constants";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Crown } from "lucide-react";
import { notFound } from "next/navigation";

export function generateStaticParams() {
  return SEASONS.map((season) => ({ season: String(season) }));
}

async function getSeasonData(year: number) {
  const [
    { data: seasonInfo },
    { data: results },
    { data: playoffs },
    champMap,
  ] = await Promise.all([
    supabase.from("seasons").select("*").eq("year", year).single(),
    supabase.from("season_results").select("*").eq("season_year", year).order("reg_rank", { ascending: true }),
    supabase.from("playoff_results").select("*").eq("season_year", year).order("final_rank", { ascending: true }),
    getChampionsBySeason(),
  ]);

  return { seasonInfo, results: results ?? [], playoffs: playoffs ?? [], champs: champMap[year] };
}

export default async function SeasonPage({ params }: { params: Promise<{ season: string }> }) {
  const { season: seasonStr } = await params;
  const year = parseInt(seasonStr);
  if (isNaN(year)) notFound();

  const { seasonInfo, results, playoffs, champs } = await getSeasonData(year);
  if (!seasonInfo) notFound();

  const prevSeason = SEASONS.includes(year - 1) ? year - 1 : null;
  const nextSeason = SEASONS.includes(year + 1) ? year + 1 : null;

  return (
    <div className="space-y-8">
      <div>
        <nav className="mb-4 flex items-center gap-1.5 text-sm text-text-muted">
          <Link href="/history" className="hover:text-ink transition-colors">History</Link>
          <ChevronRight size={14} className="text-text-faint" />
          <span className="text-ink">{year}</span>
        </nav>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="kicker mb-1">Season {year - SEASONS[0] + 1}</div>
            <h1 className="display-title text-4xl md:text-5xl text-ink">{year} Season</h1>
            <p className="text-text-secondary mt-1">
              {seasonInfo.total_managers} Teams · {seasonInfo.reg_season_weeks} Weeks · {seasonInfo.playoff_teams} Playoff Teams
            </p>
          </div>
          <div className="flex gap-2">
            {prevSeason ? (
              <Link href={`/history/${prevSeason}`} className="inline-flex items-center gap-1 rounded-xl border border-border bg-surface px-3 py-2 text-sm text-text-secondary hover:text-ink hover:bg-surface-2 transition-colors">
                <ChevronLeft size={16} /> {prevSeason}
              </Link>
            ) : null}
            {nextSeason ? (
              <Link href={`/history/${nextSeason}`} className="inline-flex items-center gap-1 rounded-xl border border-border bg-surface px-3 py-2 text-sm text-text-secondary hover:text-ink hover:bg-surface-2 transition-colors">
                {nextSeason} <ChevronRight size={16} />
              </Link>
            ) : null}
          </div>
        </div>
      </div>

      {/* Champion Banner */}
      {champs && (
        <div className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-surface-2 via-surface to-cream p-8 text-center">
          <div className="pointer-events-none absolute left-1/2 -top-24 h-56 w-56 -translate-x-1/2 rounded-full bg-gold/15 blur-3xl" />
          <div className="relative">
            <div className="inline-flex items-center gap-2 text-gold">
              <Crown size={18} />
              <span className="label-nav text-sm">Champion</span>
            </div>
            <Link href={`/manager/${champs.champion}`} className="mt-1 block display-title text-5xl sm:text-7xl uppercase text-ink hover:text-gold transition-colors">
              {champs.champion}
            </Link>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <span className="chip">Runner-Up: {champs.runner_up}</span>
              <span className="chip">Sacko: {champs.sacko}</span>
            </div>
          </div>
        </div>
      )}

      {/* Standings */}
      <section>
        <div className="kicker mb-1">Standings</div>
        <h2 className="section-title text-ink mb-4">Regular Season Standings</h2>
        <div className="cell overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-text-muted text-left">
                <th className="p-4 w-12">#</th>
                <th className="p-4">Manager</th>
                <th className="p-4 text-center">Record</th>
                <th className="p-4 text-right">PF</th>
                <th className="p-4 text-right">PA</th>
                <th className="p-4 text-right hidden sm:table-cell">Max PF</th>
                <th className="p-4 text-right hidden md:table-cell">Efficiency</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r) => (
                <tr key={r.manager_id} className="border-b border-border-light transition-colors">
                  <td className="p-4 text-text-muted">{r.reg_rank === 1 ? "★" : r.reg_rank}</td>
                  <td className="p-4">
                    <Link href={`/manager/${r.manager_id}`} className="font-medium text-ink hover:text-red transition-colors">
                      {r.manager_id}
                    </Link>
                  </td>
                  <td className="p-4 text-center font-mono">
                    <span className="win">{r.wins}</span>
                    <span className="text-text-muted">-</span>
                    <span className="loss">{r.losses}</span>
                    {r.ties > 0 && <><span className="text-text-muted">-</span><span className="tie">{r.ties}</span></>}
                  </td>
                  <td className="p-4 text-right font-mono">{Number(r.points_for).toFixed(1)}</td>
                  <td className="p-4 text-right font-mono text-text-secondary">{Number(r.points_against).toFixed(1)}</td>
                  <td className="p-4 text-right font-mono text-text-secondary hidden sm:table-cell">
                    {r.max_points_for ? Number(r.max_points_for).toFixed(1) : "—"}
                  </td>
                  <td className="p-4 text-right font-mono hidden md:table-cell">
                    {r.lineup_efficiency ? `${(Number(r.lineup_efficiency) * 100).toFixed(1)}%` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Playoffs */}
      <section>
        <div className="kicker mb-1">Postseason</div>
        <h2 className="section-title text-ink mb-4">Playoffs</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {playoffs.slice(0, 4).map((p) => (
            <div key={p.manager_id} className={`cell p-4 text-center`}>
              <div className="kicker">
                {p.final_rank === 1 ? "Champion" : p.final_rank === 2 ? "Runner-Up" : p.final_rank === 3 ? "3rd Place" : "4th Place"}
              </div>
              <div
                className={`section-title text-2xl mt-1 ${p.final_rank === 1 ? "text-red" : "text-ink"}`}
              >
                {p.manager_id}
              </div>
              <div className="text-text-muted text-xs mt-1">
                Seed #{p.seed} · {Number(p.week15_pts).toFixed(1)} + {Number(p.week16_pts).toFixed(1)} pts
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
