import { supabase } from "@/lib/supabase";
import { SEASONS } from "@/lib/constants";
import PageHeader from "@/components/ui/PageHeader";
import ManagerName from "@/components/ui/ManagerName";
import { notFound } from "next/navigation";

export function generateStaticParams() {
  return SEASONS.map((season) => ({ season: String(season) }));
}

export default async function DraftDetailPage({ params }: { params: Promise<{ season: string }> }) {
  const { season: seasonStr } = await params;
  const season = parseInt(seasonStr);
  if (isNaN(season)) notFound();

  const { data: picks } = await supabase
    .from("draft_picks").select("round, overall_pick, player_name, position, manager_id, vorp, grade4").eq("season_year", season).order("overall_pick", { ascending: true });

  if (!picks?.length) notFound();
  const rounds = [...new Set(picks.map((p) => p.round))].sort((a, b) => a - b);

  return (
    <div className="space-y-8">
      <PageHeader
        title={`Draft ${season}`}
        description={`${picks.length} Picks, ${rounds.length} Runden`}
        crumbs={[{ label: "Drafts", href: "/drafts" }]}
      />
      <div className="space-y-8">
        {rounds.map((round) => {
          const roundPicks = picks.filter((p) => p.round === round);
          return (
            <section key={round}>
              <h2 className="section-title mb-3 text-ink">Runde {round}</h2>
              <div className="cell overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs font-medium text-text-muted">
                      <th className="py-2.5 pl-4 pr-3 font-medium sm:pl-5">Pick</th>
                      <th className="py-2.5 pr-3 font-medium">Spieler</th>
                      <th className="py-2.5 pr-3 font-medium">Pos</th>
                      <th className="py-2.5 pr-3 font-medium">Owner</th>
                      <th className="hidden py-2.5 pr-3 text-right font-medium md:table-cell">VORP</th>
                      <th className="py-2.5 pl-3 pr-4 text-right font-medium sm:pr-5">Grade</th>
                    </tr>
                  </thead>
                  <tbody>
                    {roundPicks.map((p) => (
                      <tr key={p.overall_pick} className="border-t border-border-light">
                        <td className="py-2.5 pl-4 pr-3 measured text-ink sm:pl-5">{round}.{String(p.overall_pick - (round - 1) * 8).padStart(2, "0")}</td>
                        <td className="py-2.5 pr-3 font-medium text-ink">{p.player_name}</td>
                        <td className="py-2.5 pr-3 text-text-secondary">{p.position}</td>
                        <td className="py-2.5 pr-3 text-ink"><ManagerName id={p.manager_id} /></td>
                        <td className="hidden py-2.5 pr-3 text-right measured md:table-cell">
                          {p.vorp != null ? (
                            <span className={Number(p.vorp) > 0 ? "text-positive" : Number(p.vorp) < 0 ? "text-negative" : "text-text-muted"}>
                              {Number(p.vorp) > 0 ? "+" : ""}{Number(p.vorp).toFixed(1)}
                            </span>
                          ) : "–"}
                        </td>
                        <td className="py-2.5 pl-3 pr-4 text-right measured text-text-secondary sm:pr-5">
                          {p.grade4 != null ? Number(p.grade4).toFixed(1) : "–"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
