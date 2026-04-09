import { supabase } from "@/lib/supabase";
import { SEASONS } from "@/lib/constants";
import Link from "next/link";
import { notFound } from "next/navigation";

export function generateStaticParams() {
  return SEASONS.map((season) => ({ season: String(season) }));
}

export default async function TransactionDetailPage({ params }: { params: Promise<{ season: string }> }) {
  const { season: seasonStr } = await params;
  const season = parseInt(seasonStr);
  if (isNaN(season)) notFound();

  const { data: pickups } = await supabase
    .from("fa_pickups")
    .select("*")
    .eq("season_year", season)
    .order("first_week", { ascending: true })
    .order("pickup_score", { ascending: false });

  const byWeek = (pickups ?? []).reduce((acc, p) => {
    if (!acc[p.first_week]) acc[p.first_week] = [];
    acc[p.first_week].push(p);
    return acc;
  }, {} as Record<number, typeof pickups>);

  const weeks = Object.keys(byWeek).map(Number).sort((a, b) => a - b);

  return (
    <div className="space-y-8">
      <div>
        <Link href="/transactions" className="text-text-muted hover:text-text-primary text-sm transition-colors">← All Transactions</Link>
        <h1 className="page-header gold-gradient mt-2">{season} Transactions</h1>
        <p className="text-text-secondary">{pickups?.length ?? 0} Pickups</p>
      </div>
      <div className="space-y-6">
        {weeks.map((week) => (
          <section key={week}>
            <h2 className="text-2xl tracking-wide text-text-primary mb-3" style={{ fontFamily: '"Bebas Neue", Impact, sans-serif' }}>Week {week}</h2>
            <div className="space-y-2">
              {byWeek[week].map((p: NonNullable<typeof pickups>[number], i: number) => (
                <div key={`${p.manager_id}-${p.player_name}-${i}`} className="card p-4 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <Link href={`/manager/${p.manager_id}`} className="font-medium text-text-primary hover:text-gold transition-colors w-20">{p.manager_id}</Link>
                    <div>
                      <span className="text-text-primary font-medium">{p.player_name}</span>
                      <span className="text-text-muted text-sm ml-2">{p.position}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {p.pickup_score != null && (
                      <span className="text-xs font-mono text-text-secondary">
                        Score: {Number(p.pickup_score).toFixed(1)}
                      </span>
                    )}
                    <span className="text-xs font-semibold px-2 py-1 rounded bg-accent-green/10 text-accent-green">
                      PICKUP
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
