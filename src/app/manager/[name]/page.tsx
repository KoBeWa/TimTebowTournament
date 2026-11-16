import { supabase } from "@/lib/supabase";
import { MANAGERS, MANAGER_COLORS } from "@/lib/constants";
import Link from "next/link";
import { notFound } from "next/navigation";
import PageHeader from "@/components/ui/PageHeader";
import StatTile from "@/components/ui/StatTile";
import ManagerTabs from "./ManagerTabs";

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

  const record = `${totalWins}-${totalLosses}${totalTies > 0 ? `-${totalTies}` : ""}`;
  const secondary = [
    { label: "Punkte gesamt", value: totalPF.toFixed(1) },
    { label: "Ø Punkte pro Saison", value: numSeasons ? (totalPF / numSeasons).toFixed(1) : "—" },
    { label: "Beste Woche", value: bestScore.toFixed(1) },
    { label: "Schlechteste Woche", value: worstScore === 999 ? "—" : worstScore.toFixed(1) },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={<span className="inline-flex items-center gap-3">
          <span aria-hidden className="inline-block h-8 w-1.5 rounded-full sm:h-10" style={{ backgroundColor: MANAGER_COLORS[name] }} />
          {name}
        </span>}
        description={`${numSeasons} Seasons, ${data.championships} Titel, seit 2015`}
      >
        <Link href="/h2h" className="btn">Head to Head</Link>
        <Link href={`/trophies/${name}`} className="btn">Trophäen</Link>
      </PageHeader>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatTile label="Bilanz" value={record} />
        <StatTile label="Siegquote" value={`${(winPct * 100).toFixed(1)}%`} />
        <StatTile label="Titel" value={data.championships} tone={data.championships > 0 ? "gold" : undefined} />
        <StatTile label="Playoff-Teilnahmen" value={playoffApps} />
      </div>

      <ManagerTabs manager={name} results={data.results} playoffs={data.playoffs}
        matchups={data.matchups.slice(0, 20)} secondary={secondary} />
    </div>
  );
}
