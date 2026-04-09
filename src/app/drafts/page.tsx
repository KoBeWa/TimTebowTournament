import { supabase } from "@/lib/supabase";
import { SEASONS } from "@/lib/constants";
import Link from "next/link";

async function getDraftPicks() {
  const { data } = await supabase
    .from("draft_picks")
    .select("season_year, manager_id, round, overall_pick, player_name, position")
    .order("season_year", { ascending: false })
    .order("overall_pick", { ascending: true });
  return data ?? [];
}

export default async function DraftsPage() {
  const picks = await getDraftPicks();
  const bySeason = picks.reduce((acc, p) => {
    if (!acc[p.season_year]) acc[p.season_year] = [];
    acc[p.season_year].push(p);
    return acc;
  }, {} as Record<number, typeof picks>);

  return (
    <div className="space-y-8">
      <div>
        <div className="kicker">Drafts</div>
        <h1 className="display-title text-4xl md:text-5xl text-ink">Draft Hall</h1>
        <p className="text-text-secondary mt-2">Jeder Pick, jede Runde, jede Note</p>
      </div>
      <div className="space-y-4">
        {SEASONS.slice().reverse().map((season) => {
          const seasonPicks = bySeason[season] ?? [];
          const firstRound = seasonPicks.filter((p) => p.round === 1);
          return (
            <Link key={season} href={`/drafts/${season}`} className="cell-hover p-6 flex items-center justify-between group">
              <div className="flex items-center gap-6">
                <div className="display-title text-4xl text-text-muted group-hover:text-red transition-colors">{season}</div>
                <div>
                  <div className="text-lg font-semibold text-ink">{seasonPicks.length} Picks</div>
                  <div className="text-sm text-text-muted">
                    #1 Overall: <span className="text-text-secondary">{firstRound[0]?.player_name ?? "—"}</span> ({firstRound[0]?.manager_id ?? "—"})
                  </div>
                </div>
              </div>
              <div className="hidden sm:flex gap-2 flex-wrap max-w-xs justify-end">
                {firstRound.slice(0, 4).map((p) => (
                  <span key={p.player_name} className="label-nav text-xs text-ink border border-border px-2 py-0.5">{p.player_name}</span>
                ))}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
