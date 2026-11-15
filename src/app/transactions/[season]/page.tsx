import { supabase } from "@/lib/supabase";
import { SEASONS } from "@/lib/constants";
import PageHeader from "@/components/ui/PageHeader";
import ManagerName from "@/components/ui/ManagerName";
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
    <div>
      <PageHeader
        title={`Transactions ${season}`}
        description={`${pickups?.length ?? 0} Pickups`}
        crumbs={[{ label: "Transactions", href: "/transactions" }]}
      />
      <div className="space-y-8">
        {weeks.map((week) => (
          <section key={week}>
            <h2 className="section-title mb-3 text-ink">Woche {week}</h2>
            <div className="cell overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs font-medium text-text-muted">
                    <th className="py-2.5 pl-4 pr-3 font-medium sm:pl-5">Owner</th>
                    <th className="py-2.5 pr-3 font-medium">Spieler</th>
                    <th className="hidden py-2.5 pr-3 font-medium md:table-cell">Pos</th>
                    <th className="py-2.5 pl-3 pr-4 text-right font-medium sm:pr-5">Score</th>
                  </tr>
                </thead>
                <tbody>
                  {byWeek[week].map((p: NonNullable<typeof pickups>[number], i: number) => (
                    <tr key={`${p.manager_id}-${p.player_name}-${i}`} className="border-t border-border-light">
                      <td className="py-2.5 pl-4 pr-3 font-medium text-ink sm:pl-5"><ManagerName id={p.manager_id} /></td>
                      <td className="py-2.5 pr-3 text-ink">{p.player_name}</td>
                      <td className="hidden py-2.5 pr-3 text-text-muted md:table-cell">{p.position}</td>
                      <td className="py-2.5 pl-3 pr-4 text-right tabular-nums text-text-secondary sm:pr-5">
                        {p.pickup_score != null ? Number(p.pickup_score).toFixed(1) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
