import { supabase } from "@/lib/supabase";
import { MANAGERS } from "@/lib/constants";
import Link from "next/link";
import { notFound } from "next/navigation";

export function generateStaticParams() {
  return MANAGERS.map((name) => ({ name }));
}

async function getManagerData(id: string) {
  const [{ data: results }, { data: playoffs }, { data: matchupsA }, { data: matchupsB }] = await Promise.all([
    supabase.from("season_results").select("*").eq("manager_id", id).order("season_year", { ascending: false }),
    supabase.from("playoff_results").select("*").eq("manager_id", id).order("season_year", { ascending: false }),
    supabase.from("weekly_matchups").select("*").eq("manager_a", id).order("season_year", { ascending: false }).order("week", { ascending: false }),
    supabase.from("weekly_matchups").select("*").eq("manager_b", id).order("season_year", { ascending: false }).order("week", { ascending: false }),
  ]);

  // Normalize matchups so manager is always "me"
  const matchups = [
    ...(matchupsA ?? []).map((m) => ({ season: m.season_year, week: m.week, opponent: m.manager_b, myScore: Number(m.score_a), theirScore: Number(m.score_b), is_playoff: m.is_playoff })),
    ...(matchupsB ?? []).map((m) => ({ season: m.season_year, week: m.week, opponent: m.manager_a, myScore: Number(m.score_b), theirScore: Number(m.score_a), is_playoff: m.is_playoff })),
  ].sort((a, b) => b.season - a.season || b.week - a.week);

  const championships = (playoffs ?? []).filter((p) => p.final_rank === 1).length;

  return { results: results ?? [], playoffs: playoffs ?? [], matchups, championships };
}

export default async function ManagerPage({ params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  if (!MANAGERS.includes(name as (typeof MANAGERS)[number])) notFound();

  const data = await getManagerData(name);

  const totalWins = data.results.reduce((s, r) => s + (r.wins || 0), 0);
  const totalLosses = data.results.reduce((s, r) => s + (r.losses || 0), 0);
  const totalTies = data.results.reduce((s, r) => s + (r.ties || 0), 0);
  const totalPF = data.results.reduce((s, r) => s + Number(r.points_for || 0), 0);
  const numSeasons = data.results.length;
  const winPct = totalWins / (totalWins + totalLosses + totalTies);
  const playoffApps = data.playoffs.filter((p) => p.seed <= 4).length;

  const allScores = data.matchups.map((m) => m.myScore);
  const bestScore = Math.max(...allScores, 0);
  const worstScore = Math.min(...allScores, 999);

  const statCards = [
    { label: "Record", value: `${totalWins}-${totalLosses}${totalTies > 0 ? `-${totalTies}` : ""}` },
    { label: "Win %", value: `${(winPct * 100).toFixed(1)}%` },
    { label: "Championships", value: data.championships },
    { label: "Playoff Apps", value: playoffApps },
    { label: "Total PF", value: totalPF.toFixed(1) },
    { label: "Avg PF/Season", value: numSeasons ? (totalPF / numSeasons).toFixed(1) : "—" },
    { label: "Best Week", value: bestScore.toFixed(1) },
    { label: "Worst Week", value: worstScore === 999 ? "—" : worstScore.toFixed(1) },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="display-title text-4xl md:text-5xl text-ink">{name}</h1>
        <p className="text-text-secondary mt-1">{numSeasons} Seasons · {data.championships} Titles · Since 2015</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {statCards.map((s) => (
          <div key={s.label} className="cell p-4 text-center">
            <div className="display-title text-2xl text-ink">{s.value}</div>
            <div className="kicker mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Season History */}
      <section>
        <h2 className="section-title text-ink mb-4">Season History</h2>
        <div className="cell overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-text-muted text-left">
                <th className="p-4">Season</th><th className="p-4 text-center">Rank</th><th className="p-4 text-center">Record</th>
                <th className="p-4 text-right">PF</th><th className="p-4 text-center hidden sm:table-cell">Playoff</th>
              </tr>
            </thead>
            <tbody>
              {data.results.map((s) => {
                const po = data.playoffs.find((p) => p.season_year === s.season_year);
                return (
                  <tr key={s.season_year} className="border-b border-border-light transition-colors">
                    <td className="p-4">
                      <Link href={`/history/${s.season_year}`} className="text-ink hover:text-red transition-colors font-medium">
                        {s.season_year}{po?.final_rank === 1 && " 🏆"}
                      </Link>
                    </td>
                    <td className="p-4 text-center text-text-secondary">#{s.reg_rank}</td>
                    <td className="p-4 text-center font-mono">
                      <span className="win">{s.wins}</span>-<span className="loss">{s.losses}</span>
                      {s.ties > 0 && <>-<span className="tie">{s.ties}</span></>}
                    </td>
                    <td className="p-4 text-right font-mono">{Number(s.points_for).toFixed(1)}</td>
                    <td className="p-4 text-center hidden sm:table-cell">
                      {po ? <span className={po.final_rank === 1 ? "text-ink font-semibold" : po.final_rank <= 4 ? "text-ink" : "text-text-muted"}>#{po.final_rank}</span> : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Recent Matchups */}
      <section>
        <h2 className="section-title text-ink mb-4">Letzte Matchups</h2>
        <div className="space-y-2">
          {data.matchups.slice(0, 20).map((m) => {
            const won = m.myScore > m.theirScore;
            return (
              <div key={`${m.season}-${m.week}`} className="cell p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-text-muted text-sm w-20">{m.season} W{m.week}</span>
                  <span className="text-text-secondary text-sm">vs {m.opponent}</span>
                  {m.is_playoff && <span className="label-nav text-xs text-ink border border-border px-2 py-0.5">PO</span>}
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded ${won ? "bg-accent-green/10 text-ink font-semibold" : "bg-accent-red/10 text-red"}`}>
                    {won ? "W" : "L"}
                  </span>
                  <span className="font-mono text-sm text-ink">{m.myScore.toFixed(1)}</span>
                  <span className="text-text-muted text-sm">-</span>
                  <span className="font-mono text-sm text-text-secondary">{m.theirScore.toFixed(1)}</span>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
