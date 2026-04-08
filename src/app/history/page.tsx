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

export default async function HistoryPage() {
  const [seasons, results] = await Promise.all([
    getSeasonSummaries(),
    getSeasonResults(),
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
    <div className="space-y-8">
      <div>
        <h1 className="page-header gold-gradient">League History</h1>
        <p className="text-text-secondary mt-2">Jede Season erzählt ihre eigene Geschichte</p>
      </div>

      <div className="space-y-4">
        {seasons.map((s) => {
          const seasonResults = resultsBySeason[s.year] ?? [];
          const topThree = seasonResults.slice(0, 3);

          return (
            <Link key={s.year} href={`/history/${s.year}`} className="card-hover p-6 flex items-center justify-between group">
              <div className="flex items-center gap-6">
                <div className="text-4xl text-text-muted group-hover:text-gold transition-colors" style={{ fontFamily: '"Bebas Neue", Impact, sans-serif' }}>
                  {s.year}
                </div>
                <div>
                  <div className="text-lg font-semibold text-text-primary">
                    Champion: <span className="text-gold">{s.champion}</span>
                  </div>
                  <div className="text-sm text-text-muted">
                    {s.total_managers} Teams · {s.reg_season_weeks} Weeks
                  </div>
                </div>
              </div>
              <div className="hidden sm:flex gap-4 text-sm text-text-secondary">
                {topThree.map((r, i) => (
                  <div key={r.manager_id} className="text-center">
                    <div className="text-text-muted text-xs">{i === 0 ? "🥇" : i === 1 ? "🥈" : "🥉"}</div>
                    <div>{r.manager_id}</div>
                    <div className="text-text-muted">{r.wins}-{r.losses}</div>
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
