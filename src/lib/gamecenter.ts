import { supabase } from "./supabase";

export interface Matchup {
  season_year: number;
  week: number;
  manager_a: string;
  score_a: number;
  manager_b: string;
  score_b: number;
  is_playoff: boolean;
}

export interface ManagerWeekStats {
  pts_vs_team_avg_pct: number;
  pts_vs_league_avg_pct: number;
  pts_share_pct: number;
  pts_rank: number;
  coach_score: number | null;
  coach_rank: number | null;
  luck: number | null;
}

export interface MatchupWithStats extends Matchup {
  statsA: ManagerWeekStats;
  statsB: ManagerWeekStats;
}

export interface SeasonWeeks {
  /** Latest week with matchups (1 when the season has none) */
  latest: number;
  playoffWeeks: number[];
}

/** The latest week of a season and which weeks are playoff weeks. Throws when the query fails. */
export async function loadSeasonWeeks(season: number): Promise<SeasonWeeks> {
  const { data, error } = await supabase
    .from("weekly_matchups")
    .select("week, is_playoff")
    .eq("season_year", season)
    .order("week", { ascending: false });
  if (error) throw new Error(error.message);
  return {
    latest: data?.[0]?.week ?? 1,
    playoffWeeks: [...new Set((data ?? []).filter((r) => r.is_playoff).map((r) => r.week as number))].sort((x, y) => x - y),
  };
}

/** Every matchup of one week with the stats of both managers. Throws when a query fails. */
export async function loadWeek(season: number, week: number): Promise<MatchupWithStats[]> {
  const [
    { data: rawMatchups, error: e1 },
    { data: weekScores, error: e2 },
    { data: seasonResults, error: e3 },
    { data: coachData, error: e4 },
    { data: luckData, error: e5 },
  ] = await Promise.all([
    supabase.from("weekly_matchups").select("season_year, week, manager_a, score_a, manager_b, score_b, is_playoff")
      .eq("season_year", season).eq("week", week),
    supabase.from("v_weekly_scores").select("manager_id, score, week_rank").eq("season_year", season).eq("week", week),
    supabase.from("season_results").select("manager_id, wins, losses, ties, points_for").eq("season_year", season),
    supabase.from("v_coach_rank").select("manager_id, coach_score").eq("season_year", season).order("coach_score", { ascending: false }),
    supabase.from("v_luck").select("manager_id, luck").eq("season_year", season),
  ]);

  const failed = e1 ?? e2 ?? e3 ?? e4 ?? e5;
  if (failed) throw new Error(failed.message);

  // Week-level aggregates
  const scores = (weekScores ?? []).map((r) => Number(r.score));
  const weekTotal = scores.reduce((a, b) => a + b, 0);
  const weekAvg = scores.length > 0 ? weekTotal / scores.length : 0;

  // Maps
  const weekScoreMap = new Map((weekScores ?? []).map((r) => [r.manager_id, r]));
  const seasonAvgMap = new Map(
    (seasonResults ?? []).map((r) => {
      const games = (r.wins ?? 0) + (r.losses ?? 0) + (r.ties ?? 0);
      return [r.manager_id, games > 0 ? Number(r.points_for) / games : 0];
    })
  );
  const coachRankMap = new Map(
    (coachData ?? []).map((r, i) => [r.manager_id, { score: Number(r.coach_score), rank: i + 1 }])
  );
  const luckMap = new Map((luckData ?? []).map((r) => [r.manager_id, Number(r.luck)]));

  function buildStats(managerId: string): ManagerWeekStats {
    const ws = weekScoreMap.get(managerId);
    const score = ws ? Number(ws.score) : 0;
    const teamAvg = seasonAvgMap.get(managerId) ?? 0;
    const coach = coachRankMap.get(managerId) ?? null;
    return {
      pts_vs_team_avg_pct: teamAvg > 0 ? ((score - teamAvg) / teamAvg) * 100 : 0,
      pts_vs_league_avg_pct: weekAvg > 0 ? ((score - weekAvg) / weekAvg) * 100 : 0,
      pts_share_pct: weekTotal > 0 ? (score / weekTotal) * 100 : 0,
      pts_rank: ws ? Number(ws.week_rank) : 0,
      coach_score: coach?.score ?? null,
      coach_rank: coach?.rank ?? null,
      luck: luckMap.has(managerId) ? luckMap.get(managerId)! : null,
    };
  }

  return (rawMatchups ?? []).map((m) => ({
    ...m,
    score_a: Number(m.score_a),
    score_b: Number(m.score_b),
    statsA: buildStats(m.manager_a),
    statsB: buildStats(m.manager_b),
  }));
}
