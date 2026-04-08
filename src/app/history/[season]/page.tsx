import { supabase } from "@/lib/supabase";
import { getChampionsBySeason } from "@/lib/queries";
import { SEASONS } from "@/lib/constants";
import Link from "next/link";
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
      <div className="flex items-center justify-between">
        <div>
          {prevSeason && (
            <Link href={`/history/${prevSeason}`} className="text-text-muted hover:text-text-primary text-sm transition-colors">
              ← {prevSeason}
            </Link>
          )}
          <h1 className="page-header gold-gradient">{year} Season</h1>
          <p className="text-text-secondary mt-1">
            {seasonInfo.total_managers} Teams · {seasonInfo.reg_season_weeks} Weeks · {seasonInfo.playoff_teams} Playoff Teams
          </p>
        </div>
        {nextSeason && (
          <Link href={`/history/${nextSeason}`} className="text-text-muted hover:text-text-primary text-sm transition-colors">
            {nextSeason} →
          </Link>
        )}
      </div>

      {/* Champion Banner */}
      {champs && (
        <div className="card p-8 text-center" style={{ borderColor: "var(--color-gold-dark)" }}>
          <div className="stat-label mb-2">Champion</div>
          <div className="text-5xl tracking-wider gold-gradient" style={{ fontFamily: '"Bebas Neue", Impact, sans-serif' }}>
            {champs.champion}
          </div>
          <div className="text-text-muted text-sm mt-2">
            Runner-Up: {champs.runner_up} · Sacko: {champs.sacko}
          </div>
        </div>
      )}

      {/* Standings */}
      <section>
        <h2 className="section-header text-text-primary mb-4">Regular Season Standings</h2>
        <div className="card overflow-hidden">
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
                <tr key={r.manager_id} className="border-b border-border/50 hover:bg-bg-card-hover transition-colors">
                  <td className="p-4 text-text-muted">{r.reg_rank === 1 ? "🏆" : r.reg_rank}</td>
                  <td className="p-4">
                    <Link href={`/manager/${r.manager_id}`} className="font-medium text-text-primary hover:text-gold transition-colors">
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
        <h2 className="section-header text-text-primary mb-4">Playoffs</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {playoffs.slice(0, 4).map((p) => (
            <div key={p.manager_id} className={`card p-4 text-center ${p.final_rank === 1 ? "border-gold/30" : ""}`}>
              <div className="stat-label">
                {p.final_rank === 1 ? "🏆 Champion" : p.final_rank === 2 ? "🥈 Runner-Up" : p.final_rank === 3 ? "3rd Place" : "4th Place"}
              </div>
              <div
                className={`text-2xl tracking-wide mt-1 ${p.final_rank === 1 ? "text-gold" : "text-text-primary"}`}
                style={{ fontFamily: '"Bebas Neue", Impact, sans-serif' }}
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
