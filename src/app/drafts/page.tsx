import { supabase } from "@/lib/supabase";
import { LEAGUE_FOUNDED } from "@/lib/constants";
import PageHeader from "@/components/ui/PageHeader";
import { type DraftPick } from "./DraftBrowser";
import { type PositionData } from "./PositionStats";
import DraftsTabs from "./DraftsTabs";

export const dynamic = "force-dynamic";

// NFL team name → abbreviation (for DST picks whose player_name IS the team name)
const DST_ABBREVS: Record<string, string> = {
  "Arizona Cardinals": "ARI", "Atlanta Falcons": "ATL", "Baltimore Ravens": "BAL",
  "Buffalo Bills": "BUF", "Carolina Panthers": "CAR", "Chicago Bears": "CHI",
  "Cincinnati Bengals": "CIN", "Cleveland Browns": "CLE", "Dallas Cowboys": "DAL",
  "Denver Broncos": "DEN", "Detroit Lions": "DET", "Green Bay Packers": "GB",
  "Houston Texans": "HOU", "Indianapolis Colts": "IND", "Jacksonville Jaguars": "JAX",
  "Kansas City Chiefs": "KC", "Las Vegas Raiders": "LV", "Oakland Raiders": "OAK",
  "Los Angeles Chargers": "LAC", "San Diego Chargers": "SD",
  "Los Angeles Rams": "LA", "St. Louis Rams": "STL",
  "Miami Dolphins": "MIA", "Minnesota Vikings": "MIN", "New England Patriots": "NE",
  "New Orleans Saints": "NO", "New York Giants": "NYG", "New York Jets": "NYJ",
  "Philadelphia Eagles": "PHI", "Pittsburgh Steelers": "PIT",
  "San Francisco 49ers": "SF", "Seattle Seahawks": "SEA",
  "Tampa Bay Buccaneers": "TB", "Tennessee Titans": "TEN",
  "Washington Commanders": "WAS", "Washington Football Team": "WAS", "Washington Redskins": "WAS",
};

async function getAllData() {
  const COLS = "season_year, manager_id, round, overall_pick, player_name, position, grade4, actual_pts, projected_pts, espn_id";

  const [page1, page2, { data: grades }] = await Promise.all([
    supabase.from("draft_picks").select(COLS).order("season_year", { ascending: true }).order("overall_pick", { ascending: true }).range(0, 999),
    supabase.from("draft_picks").select(COLS).order("season_year", { ascending: true }).order("overall_pick", { ascending: true }).range(1000, 1999),
    supabase.from("v_draft_grades").select("season_year, manager_id, avg_grade4, total_picks"),
  ]);

  const picks = [...(page1.data ?? []), ...(page2.data ?? [])];

  // ── Player lookup: espn_id → gsis_id + latest_team ──
  const espnIds = [...new Set(picks.map((p) => p.espn_id).filter(Boolean))];

  const { data: players } = await supabase
    .from("players")
    .select("espn_id, gsis_id, latest_team")
    .in("espn_id", espnIds);

  const espnToGsis = new Map(players?.map((p) => [p.espn_id, p.gsis_id]) ?? []);
  const espnToLatest = new Map(players?.map((p) => [p.espn_id, p.latest_team]) ?? []);
  const gsisIds = [...new Set([...espnToGsis.values()].filter(Boolean))];

  // ── Week-1 stats (paginated: 1106 rows > 1000 limit) ──
  const [statsPage1, statsPage2] = await Promise.all([
    supabase.from("player_weekly_stats").select("player_id, season, team").eq("week", 1).in("player_id", gsisIds).range(0, 999),
    supabase.from("player_weekly_stats").select("player_id, season, team").eq("week", 1).in("player_id", gsisIds).range(1000, 1999),
  ]);

  const allStats = [...(statsPage1.data ?? []), ...(statsPage2.data ?? [])];
  const teamMap = new Map(allStats.map((s) => [`${s.player_id}|${s.season}`, s.team]));

  const picksWithTeam = picks.map((p) => {
    // 1. DST: team name is the player_name itself
    if (p.position === "DST") {
      return { ...p, team: DST_ABBREVS[p.player_name] ?? p.player_name.split(" ").slice(-1)[0].slice(0, 3).toUpperCase() };
    }
    // 2. Via weekly stats (most accurate)
    const gsisId = espnToGsis.get(p.espn_id);
    if (gsisId) {
      const statsTeam = teamMap.get(`${gsisId}|${p.season_year}`);
      if (statsTeam) return { ...p, team: statsTeam };
    }
    // 3. Fallback: latest_team from players table
    const latest = espnToLatest.get(p.espn_id);
    return { ...p, team: latest ?? null };
  });

  return { picks: picksWithTeam, grades: grades ?? [] };
}

function avg(arr: number[]) {
  return arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
}

function draftNumber(yr: number) {
  return yr - LEAGUE_FOUNDED + 1;
}

export default async function DraftsPage() {
  const { picks, grades } = await getAllData();

  const picksWithGrade = picks.filter((p) => p.grade4 !== null).map((p) => ({
    ...p,
    grade4: Number(p.grade4),
    actual_pts: Number(p.actual_pts),
    projected_pts: Number(p.projected_pts),
  }));

  // ── Header stats ──
  const allGrades = picksWithGrade.map((p) => p.grade4);
  const avgPickValue = avg(allGrades);

  const gradesByTeam = grades.map((g) => Number(g.avg_grade4));
  const avgTeamValue = avg(gradesByTeam);

  const seasonAvgs = Object.values(
    picksWithGrade.reduce((acc, p) => {
      (acc[p.season_year] ??= []).push(p.grade4);
      return acc;
    }, {} as Record<number, number[]>)
  ).map(avg);
  const avgSeasonValue = avg(seasonAvgs);

  // ── Top/Worst 10 picks ──
  const sorted = [...picksWithGrade].sort((a, b) => b.grade4 - a.grade4);
  const top10 = sorted.slice(0, 10);
  const worst10 = [...picksWithGrade].sort((a, b) => a.grade4 - b.grade4).slice(0, 10);

  // ── All-time owner rankings ──
  const ownerMap: Record<string, { grades: number[]; picks: number }> = {};
  for (const p of picksWithGrade) {
    (ownerMap[p.manager_id] ??= { grades: [], picks: 0 }).grades.push(p.grade4);
    ownerMap[p.manager_id].picks++;
  }
  const ownerRankings = Object.entries(ownerMap)
    .map(([id, d]) => ({ id, avgGrade: avg(d.grades), picks: d.picks, positive: d.grades.filter((g) => g > 0).length }))
    .sort((a, b) => b.avgGrade - a.avgGrade);

  // ── Position-specific rankings ──
  const POSITIONS = ["QB", "RB", "WR", "TE", "K", "DST"];
  const positionData: PositionData[] = POSITIONS.map((pos) => {
    const posPicks = picksWithGrade.filter((p) => {
      if (pos === "DST") return p.position === "DST" || p.position === "DEF";
      return p.position === pos;
    });

    // Owner rankings for this position
    const ownerMap: Record<string, { grades: number[]; picks: number }> = {};
    for (const p of posPicks) {
      (ownerMap[p.manager_id] ??= { grades: [], picks: 0 }).grades.push(p.grade4);
      ownerMap[p.manager_id].picks++;
    }
    const ownerRankings = Object.entries(ownerMap)
      .map(([id, d]) => ({ id, avgGrade: avg(d.grades), picks: d.picks, positive: d.grades.filter((g) => g > 0).length }))
      .sort((a, b) => b.avgGrade - a.avgGrade);

    const sortedPos = [...posPicks].sort((a, b) => b.grade4 - a.grade4);
    const top5 = sortedPos.slice(0, 5).map((p) => ({
      season_year: p.season_year, overall_pick: p.overall_pick,
      player_name: p.player_name, manager_id: p.manager_id,
      grade4: p.grade4, team: p.team ?? null,
    }));
    const worst5 = [...posPicks].sort((a, b) => a.grade4 - b.grade4).slice(0, 5).map((p) => ({
      season_year: p.season_year, overall_pick: p.overall_pick,
      player_name: p.player_name, manager_id: p.manager_id,
      grade4: p.grade4, team: p.team ?? null,
    }));

    return { position: pos, ownerRankings, top5, worst5 };
  });

  // ── Best/Worst 3 drafts (per season+owner) ──
  const draftList = grades
    .map((g) => ({ ...g, avg: Number(g.avg_grade4) }))
    .filter((g) => g.avg !== null);
  const bestDrafts = [...draftList].sort((a, b) => b.avg - a.avg).slice(0, 3);
  const worstDrafts = [...draftList].sort((a, b) => a.avg - b.avg).slice(0, 3);

  return (
    <div>
      <PageHeader title="Drafts" description="Jeder Pick, jede Runde, jede Note" />
      <DraftsTabs
        avgPickValue={avgPickValue}
        avgTeamValue={avgTeamValue}
        avgSeasonValue={avgSeasonValue}
        top10={top10}
        worst10={worst10}
        ownerRankings={ownerRankings}
        bestDrafts={bestDrafts.map((d) => ({ season_year: d.season_year, manager_id: d.manager_id, avg: d.avg, draftNo: draftNumber(d.season_year) }))}
        worstDrafts={worstDrafts.map((d) => ({ season_year: d.season_year, manager_id: d.manager_id, avg: d.avg, draftNo: draftNumber(d.season_year) }))}
        positionData={positionData}
        picks={picksWithGrade as DraftPick[]}
      />
    </div>
  );
}
