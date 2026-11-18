import { supabase } from "@/lib/supabase";
import { MANAGERS, MANAGER_COLORS } from "@/lib/constants";
import Link from "next/link";
import { notFound } from "next/navigation";
import PageHeader from "@/components/ui/PageHeader";
import StatTile from "@/components/ui/StatTile";
import ManagerTabs from "./ManagerTabs";
import { buildRows, type Row } from "./rows";
import { loadManagerPlayers } from "@/lib/players";
import { fmtNum, fmtPct } from "@/lib/format";

export function generateStaticParams() {
  return MANAGERS.map((name) => ({ name }));
}

const MATCHUP_COLS = "season_year, week, manager_a, manager_b, score_a, score_b, is_playoff";

async function getManagerData(id: string) {
  const [{ data: results }, { data: playoffs }, { data: matchupsA }, { data: matchupsB }] = await Promise.all([
    supabase.from("season_results").select("season_year, reg_rank, wins, losses, ties, points_for").eq("manager_id", id).order("season_year", { ascending: false }),
    supabase.from("playoff_results").select("season_year, final_rank, seed").eq("manager_id", id).order("season_year", { ascending: false }),
    supabase.from("weekly_matchups").select(MATCHUP_COLS).eq("manager_a", id).order("season_year", { ascending: false }).order("week", { ascending: false }),
    supabase.from("weekly_matchups").select(MATCHUP_COLS).eq("manager_b", id).order("season_year", { ascending: false }).order("week", { ascending: false }),
  ]);

  // Normalize matchups so manager is always "me"
  const matchups = [
    ...(matchupsA ?? []).map((m) => ({ season: m.season_year, week: m.week, opponent: m.manager_b, myScore: Number(m.score_a), theirScore: Number(m.score_b), is_playoff: m.is_playoff })),
    ...(matchupsB ?? []).map((m) => ({ season: m.season_year, week: m.week, opponent: m.manager_a, myScore: Number(m.score_b), theirScore: Number(m.score_a), is_playoff: m.is_playoff })),
  ].sort((a, b) => b.season - a.season || b.week - a.week);

  const championships = (playoffs ?? []).filter((p) => p.final_rank === 1).length;

  return { results: results ?? [], playoffs: playoffs ?? [], matchups, championships };
}

// If the player tables fail to load, the page still builds and the browser loads the list itself
async function getPlayerRows(id: string): Promise<Row[] | null> {
  try {
    const data = await loadManagerPlayers(id);
    return data.info.length > 0 ? buildRows(data) : null;
  } catch {
    return null;
  }
}

export default async function ManagerPage({ params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  if (!MANAGERS.includes(name as (typeof MANAGERS)[number])) notFound();

  const [data, players] = await Promise.all([getManagerData(name), getPlayerRows(name)]);

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
    { label: "Punkte gesamt", value: fmtNum(totalPF) },
    { label: "Ø Punkte pro Saison", value: numSeasons ? fmtNum(totalPF / numSeasons) : "—" },
    { label: "Beste Woche", value: fmtNum(bestScore) },
    { label: "Schlechteste Woche", value: worstScore === 999 ? "—" : fmtNum(worstScore) },
  ];

  return (
    <div className="space-y-8">
      <PageHeader
        title={<span className="inline-flex items-center gap-3">
          <span aria-hidden className="inline-block h-8 w-[3px] rounded-[2px] sm:h-10" style={{ backgroundColor: MANAGER_COLORS[name] }} />
          {name}
        </span>}
        description={`${numSeasons} Seasons, ${data.championships} Titel, seit 2015`}
      >
        <Link href="/h2h" className="btn">Head to Head</Link>
        <Link href={`/trophies/${name}`} className="btn">Trophäen</Link>
      </PageHeader>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Bilanz" value={record} />
        <StatTile label="Siegquote" value={fmtPct(winPct)} />
        <StatTile label="Titel" value={data.championships} />
        <StatTile label="Playoff-Teilnahmen" value={playoffApps} />
      </div>

      <ManagerTabs manager={name} results={data.results} playoffs={data.playoffs}
        matchups={data.matchups.slice(0, 20)} secondary={secondary} players={players} />
    </div>
  );
}
