import { supabase } from "@/lib/supabase";
import { SEASONS } from "@/lib/constants";
import Link from "next/link";

export default async function TransactionsPage() {
  const { data: pickups } = await supabase
    .from("fa_pickups")
    .select("season_year, manager_id, player_name, first_week")
    .order("season_year", { ascending: false });

  const bySeason = (pickups ?? []).reduce((acc, p) => {
    if (!acc[p.season_year]) acc[p.season_year] = [];
    acc[p.season_year].push(p);
    return acc;
  }, {} as Record<number, NonNullable<typeof pickups>>);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="page-header gold-gradient">Transactions</h1>
        <p className="text-text-secondary mt-2">Waiver Wire Moves & Free Agent Pickups</p>
      </div>
      <div className="space-y-4">
        {SEASONS.slice().reverse().map((season) => {
          const sp = bySeason[season] ?? [];
          const counts = sp.reduce((a, p) => { a[p.manager_id] = (a[p.manager_id] || 0) + 1; return a; }, {} as Record<string, number>);
          const mostActive = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
          return (
            <Link key={season} href={`/transactions/${season}`} className="card-hover p-6 flex items-center justify-between group">
              <div className="flex items-center gap-6">
                <div className="text-4xl text-text-muted group-hover:text-gold transition-colors" style={{ fontFamily: '"Bebas Neue", Impact, sans-serif' }}>{season}</div>
                <div>
                  <div className="text-lg font-semibold text-text-primary">{sp.length} Pickups</div>
                  <div className="text-sm text-text-muted">{mostActive ? `Most Active: ${mostActive[0]} (${mostActive[1]} moves)` : "Keine Daten"}</div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
