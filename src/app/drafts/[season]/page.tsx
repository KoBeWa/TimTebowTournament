import { supabase } from "@/lib/supabase";
import { SEASONS } from "@/lib/constants";
import Link from "next/link";
import { notFound } from "next/navigation";

export function generateStaticParams() {
  return SEASONS.map((season) => ({ season: String(season) }));
}

const POS_COLORS: Record<string, string> = { QB: "text-accent-red", RB: "text-accent-green", WR: "text-accent-blue", TE: "text-gold", K: "text-text-secondary", DEF: "text-text-muted" };

export default async function DraftDetailPage({ params }: { params: Promise<{ season: string }> }) {
  const { season: seasonStr } = await params;
  const season = parseInt(seasonStr);
  if (isNaN(season)) notFound();

  const { data: picks } = await supabase
    .from("draft_picks").select("*").eq("season_year", season).order("overall_pick", { ascending: true });

  if (!picks?.length) notFound();
  const rounds = [...new Set(picks.map((p) => p.round))].sort((a, b) => a - b);

  return (
    <div className="space-y-8">
      <div>
        <Link href="/drafts" className="text-text-muted hover:text-text-primary text-sm transition-colors">← All Drafts</Link>
        <h1 className="page-header gold-gradient mt-2">{season} Draft</h1>
        <p className="text-text-secondary">{picks.length} Picks · {rounds.length} Rounds</p>
      </div>
      <div className="space-y-6">
        {rounds.map((round) => {
          const roundPicks = picks.filter((p) => p.round === round);
          return (
            <section key={round}>
              <h2 className="text-2xl tracking-wide text-text-primary mb-3" style={{ fontFamily: '"Bebas Neue", Impact, sans-serif' }}>Round {round}</h2>
              <div className="card overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-text-muted text-left">
                      <th className="p-3 w-16">Pick</th>
                      <th className="p-3">Player</th>
                      <th className="p-3 w-16">Pos</th>
                      <th className="p-3">Manager</th>
                      <th className="p-3 text-right hidden sm:table-cell">VORP</th>
                      <th className="p-3 text-right hidden sm:table-cell">Grade</th>
                    </tr>
                  </thead>
                  <tbody>
                    {roundPicks.map((p) => (
                      <tr key={p.overall_pick} className="border-b border-border/50 hover:bg-bg-card-hover transition-colors">
                        <td className="p-3 font-mono text-text-muted">{round}.{String(p.overall_pick - (round - 1) * 8).padStart(2, "0")}</td>
                        <td className="p-3 font-medium text-text-primary">{p.player_name}</td>
                        <td className={`p-3 font-semibold ${POS_COLORS[p.position] ?? "text-text-secondary"}`}>{p.position}</td>
                        <td className="p-3">
                          <Link href={`/manager/${p.manager_id}`} className="text-text-secondary hover:text-gold transition-colors">{p.manager_id}</Link>
                        </td>
                        <td className="p-3 text-right font-mono hidden sm:table-cell">
                          {p.vorp != null ? (
                            <span className={Number(p.vorp) > 0 ? "text-accent-green" : Number(p.vorp) < 0 ? "text-accent-red" : "text-text-muted"}>
                              {Number(p.vorp) > 0 ? "+" : ""}{Number(p.vorp).toFixed(1)}
                            </span>
                          ) : "—"}
                        </td>
                        <td className="p-3 text-right font-mono hidden sm:table-cell">
                          {p.grade4 != null ? Number(p.grade4).toFixed(1) : "—"}
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
