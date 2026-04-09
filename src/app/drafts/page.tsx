import { supabase } from "@/lib/supabase";
import { LEAGUE_FOUNDED } from "@/lib/constants";
import DraftBrowser, { type DraftPick } from "./DraftBrowser";
import PositionStats, { type PositionData } from "./PositionStats";

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

function sign(n: number) {
  return (n >= 0 ? "+" : "") + n.toFixed(2);
}

function draftNumber(yr: number) {
  return yr - LEAGUE_FOUNDED + 1;
}

const POS_COLORS: Record<string, string> = {
  QB: "#c0392b", RB: "#2980b9", WR: "#27ae60", TE: "#8e44ad", K: "#e67e22", DST: "#7f8c8d", DEF: "#7f8c8d",
};

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
      {/* ── Page header ── */}
      <div className="mb-8" style={{ borderBottom: "2px solid #1a1a1a", paddingBottom: "1rem" }}>
        <div className="kicker mb-1">Statistiken</div>
        <h1 className="display-title text-4xl md:text-5xl text-ink">Draft Hall</h1>
        <p className="text-text-muted mt-1 text-sm">Jeder Pick, jede Runde, jede Note</p>
      </div>

      {/* ── Header stats ── */}
      <div className="grid grid-cols-3 gap-4 mb-10">
        {[
          { label: "Ø Pick Value", value: sign(avgPickValue), sub: "pro einzelnem Pick" },
          { label: "Ø Team Value", value: sign(avgTeamValue), sub: "pro Draft & Owner" },
          { label: "Ø Season Value", value: sign(avgSeasonValue), sub: "pro Saison gesamt" },
        ].map((s) => (
          <div key={s.label} className="cell p-5">
            <div className="kicker mb-1">{s.label}</div>
            <div className="display-title text-3xl text-ink">{s.value}</div>
            <div className="text-xs text-text-muted mt-1">{s.sub}</div>
          </div>
        ))}
      </div>

      {/* ── Top 10 / Worst 10 ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-10">
        {[
          { title: "Top 10 Picks All Time", list: top10, dir: "best" as const },
          { title: "Worst 10 Picks All Time", list: worst10, dir: "worst" as const },
        ].map(({ title, list, dir }) => (
          <div key={title}>
            <div className="kicker mb-3">{title}</div>
            <table className="w-full text-sm" style={{ borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "2px solid #1a1a1a" }}>
                  <th className="label-nav text-xs text-text-muted text-left py-2 pr-2">#</th>
                  <th className="label-nav text-xs text-text-muted text-left py-2 pr-3">Spieler</th>
                  <th className="label-nav text-xs text-text-muted text-left py-2 pr-3">Owner</th>
                  <th className="label-nav text-xs text-text-muted text-right py-2 pr-3">Pick</th>
                  <th className="label-nav text-xs text-text-muted text-right py-2">Grade</th>
                </tr>
              </thead>
              <tbody>
                {list.map((p, i) => (
                  <tr key={`${p.season_year}-${p.overall_pick}`} style={{ borderBottom: "1px solid var(--color-border-light)" }}>
                    <td className="py-2.5 pr-2 label-nav text-xs text-text-faint">{i + 1}</td>
                    <td className="py-2.5 pr-3">
                      <div className="font-medium text-ink text-sm">{p.player_name}</div>
                      <div className="label-nav text-xs text-text-muted">{p.season_year}</div>
                    </td>
                    <td className="py-2.5 pr-3 label-nav text-xs text-ink">{p.manager_id}</td>
                    <td className="py-2.5 pr-3 text-right font-mono text-xs text-text-muted">
                      #{p.overall_pick}
                    </td>
                    <td
                      className="py-2.5 text-right font-mono text-sm font-semibold"
                      style={{ color: dir === "best" ? "#1a1a1a" : "rgb(150,35,35)" }}
                    >
                      {sign(p.grade4)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>

      {/* ── All-time owner rankings ── */}
      <div className="mb-10">
        <div className="kicker mb-3">All-Time Draft Rankings</div>
        <table className="w-full text-sm" style={{ borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "2px solid #1a1a1a" }}>
              <th className="label-nav text-xs text-text-muted text-left py-2 pr-4">#</th>
              <th className="label-nav text-xs text-text-muted text-left py-2 pr-6">Owner</th>
              <th className="label-nav text-xs text-text-muted text-right py-2 pr-6">Ø Grade</th>
              <th className="label-nav text-xs text-text-muted text-right py-2 pr-6">Total Value</th>
              <th className="label-nav text-xs text-text-muted text-right py-2 pr-6">Picks</th>
              <th className="label-nav text-xs text-text-muted text-right py-2">Positive %</th>
            </tr>
          </thead>
          <tbody>
            {ownerRankings.map((o, i) => (
              <tr key={o.id} style={{ borderBottom: "1px solid var(--color-border-light)" }} className="hover:bg-border-light transition-colors">
                <td className="py-3 pr-4 label-nav text-xs text-text-faint">{i + 1}</td>
                <td className="py-3 pr-6 font-semibold text-ink">{o.id}</td>
                <td className={`py-3 pr-6 text-right font-mono font-semibold ${o.avgGrade >= 0 ? "text-ink" : "text-red"}`}>
                  {sign(o.avgGrade)}
                </td>
                <td className={`py-3 pr-6 text-right font-mono text-sm ${o.avgGrade >= 0 ? "text-text-secondary" : "text-text-muted"}`}>
                  {sign(o.avgGrade * o.picks)}
                </td>
                <td className="py-3 pr-6 text-right font-mono text-xs text-text-muted">{o.picks}</td>
                <td className="py-3 text-right font-mono text-xs text-text-secondary">
                  {((o.positive / o.picks) * 100).toFixed(0)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Best / Worst 3 drafts ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
        {[
          { title: "Best Drafts All Time", list: bestDrafts, color: "#1a1a1a" },
          { title: "Worst Drafts All Time", list: worstDrafts, color: "rgb(150,35,35)" },
        ].map(({ title, list, color }) => (
          <div key={title}>
            <div className="kicker mb-3">{title}</div>
            <div className="space-y-2">
              {list.map((d, i) => (
                <div
                  key={`${d.season_year}-${d.manager_id}`}
                  className="cell p-4 flex items-center justify-between"
                >
                  <div className="flex items-center gap-4">
                    <div className="display-title text-3xl text-text-muted">{i + 1}</div>
                    <div>
                      <div className="font-semibold text-ink">{d.manager_id}</div>
                      <div className="label-nav text-xs text-text-muted">
                        Draft #{draftNumber(d.season_year)} · {d.season_year}
                      </div>
                    </div>
                  </div>
                  <div className="display-title text-2xl" style={{ color }}>{sign(d.avg)}</div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* ── Position Rankings ── */}
      <div className="mb-12" style={{ borderTop: "2px solid #1a1a1a", paddingTop: "2rem" }}>
        <div className="kicker mb-1">Positions</div>
        <h2 className="display-title text-2xl text-ink mb-6">Positions-Rankings</h2>
        <PositionStats data={positionData} />
      </div>

      {/* ── Interactive pick browser ── */}
      <div style={{ borderTop: "2px solid #1a1a1a", paddingTop: "2rem" }}>
        <div className="kicker mb-1">Pick Browser</div>
        <h2 className="display-title text-2xl text-ink mb-6">Alle Picks durchsuchen</h2>
        <DraftBrowser picks={picksWithGrade as DraftPick[]} />
      </div>
    </div>
  );
}
