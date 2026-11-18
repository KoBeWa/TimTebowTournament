import { supabase } from "./supabase";

export interface LineupPlayer {
  player_name: string;
  slot: string;
  points: number;
  espn_id: string | null;
  is_starter: boolean;
  position?: string;
  headshot?: string | null;
  stats?: Record<string, number>;
  shouldHaveStarted?: boolean;
}

export interface TeamWeekStats {
  score: number;
  pts_share_pct: number;
  pts_rank: number;
  pts_vs_team_avg_pct: number;
  pts_vs_league_avg_pct: number;
  luck: number | null;
  coach_score: number | null;
  coach_rank: number | null;
}

export interface H2HData {
  record: string;       // "16-10"
  winnerStreak: number;
  winner: string;
  avgNetMarginForA: number;
  prevMatchup: { season: number; week: number; scoreA: number; scoreB: number } | null;
}

export interface MatchupData {
  matchup: { manager_a: string; manager_b: string; score_a: number; score_b: number; is_playoff: boolean };
  lineupA: LineupPlayer[];
  lineupB: LineupPlayer[];
  statsA: TeamWeekStats;
  statsB: TeamWeekStats;
  h2h: H2HData;
}

// Eligible starter slots per position
const ELIGIBLE_SLOTS: Record<string, string[]> = {
  QB:  ["QB"],
  RB:  ["RB1", "RB2", "FLEX"],
  WR:  ["WR1", "WR2", "FLEX"],
  TE:  ["TE", "FLEX"],
  K:   ["K"],
  DST: ["DST"],
};

// The stat columns the lineup tables print (the table has far more)
const STAT_COLS = "player_id, position, completions, attempts, passing_yards, passing_tds, passing_interceptions, carries, rushing_yards, rushing_tds, receptions, receiving_yards, receiving_tds, targets, fg_made, fg_att, pat_made, pat_att";

/** One matchup with lineups, week stats and the head-to-head history. Null when the matchup does not exist. Throws when a query fails. */
export async function loadMatchup(season: number, week: number, a: string, b: string): Promise<MatchupData | null> {
  const [
    { data: matchupData, error: matchupErr },
    { data: lineups, error: lineupsErr },
    { data: weekScores, error: e3 },
    { data: seasonResults, error: e4 },
    { data: coachData, error: e5 },
    { data: luckData, error: e6 },
    { data: h2hHistory, error: e7 },
    { data: h2hRecord, error: e8 },
  ] = await Promise.all([
    supabase.from("weekly_matchups").select("manager_a, manager_b, score_a, score_b, is_playoff")
      .eq("season_year", season).eq("week", week).eq("manager_a", a).eq("manager_b", b).maybeSingle(),
    supabase.from("weekly_lineups").select("manager_id, slot, player_name, espn_id, points, is_starter")
      .eq("season_year", season).eq("week", week).in("manager_id", [a, b]),
    supabase.from("v_weekly_scores").select("manager_id, score, week_rank").eq("season_year", season).eq("week", week),
    supabase.from("season_results").select("manager_id, wins, losses, ties, points_for").eq("season_year", season),
    supabase.from("v_coach_rank").select("manager_id, coach_score").eq("season_year", season).order("coach_score", { ascending: false }),
    supabase.from("v_luck").select("manager_id, luck").eq("season_year", season),
    supabase.from("weekly_matchups").select("season_year, week, manager_a, score_a, manager_b, score_b")
      .or(`and(manager_a.eq.${a},manager_b.eq.${b}),and(manager_a.eq.${b},manager_b.eq.${a})`)
      .order("season_year", { ascending: false }).order("week", { ascending: false }),
    supabase.from("v_head_to_head").select("wins, losses, ties, avg_score_for, avg_score_against").eq("manager_id", a).eq("opponent_id", b),
  ]);

  const failed = matchupErr ?? lineupsErr ?? e3 ?? e4 ?? e5 ?? e6 ?? e7 ?? e8;
  if (failed) throw new Error(failed.message);
  if (!matchupData) return null;

  const matchup = { ...matchupData, score_a: Number(matchupData.score_a), score_b: Number(matchupData.score_b) };

  // ── Week stats ──
  const allScores = (weekScores ?? []).map((r) => Number(r.score));
  const weekTotal = allScores.reduce((s, v) => s + v, 0);
  const weekAvg = allScores.length > 0 ? weekTotal / allScores.length : 0;

  const weekScoreMap = new Map((weekScores ?? []).map((r) => [r.manager_id, r]));
  const seasonAvgMap = new Map((seasonResults ?? []).map((r) => {
    const games = (r.wins ?? 0) + (r.losses ?? 0) + (r.ties ?? 0);
    return [r.manager_id, games > 0 ? Number(r.points_for) / games : 0];
  }));
  const coachRankMap = new Map((coachData ?? []).map((r, i) => [r.manager_id, { score: Number(r.coach_score), rank: i + 1 }]));
  const luckMap = new Map((luckData ?? []).map((r) => [r.manager_id, Number(r.luck)]));

  function buildTeamStats(managerId: string, score: number): TeamWeekStats {
    const ws = weekScoreMap.get(managerId);
    const teamAvg = seasonAvgMap.get(managerId) ?? 0;
    const coach = coachRankMap.get(managerId) ?? null;
    return {
      score,
      pts_share_pct: weekTotal > 0 ? (score / weekTotal) * 100 : 0,
      pts_rank: ws ? Number(ws.week_rank) : 0,
      pts_vs_team_avg_pct: teamAvg > 0 ? ((score - teamAvg) / teamAvg) * 100 : 0,
      pts_vs_league_avg_pct: weekAvg > 0 ? ((score - weekAvg) / weekAvg) * 100 : 0,
      luck: luckMap.has(managerId) ? luckMap.get(managerId)! : null,
      coach_score: coach?.score ?? null,
      coach_rank: coach?.rank ?? null,
    };
  }

  const scoreA = matchup.score_a;
  const scoreB = matchup.score_b;

  // ── H2H ──
  const allGames = (h2hHistory ?? []).filter((g) => !(g.season_year === season && g.week === week));

  // Win streak: find streak of current matchup winner
  const currentWinner = scoreA > scoreB ? a : b;
  let streak = 0;
  for (const g of allGames) {
    const gWinner = Number(g.score_a) > Number(g.score_b) ? g.manager_a : g.manager_b;
    if (gWinner === currentWinner) streak++;
    else break;
  }
  // Add 1 for this game
  streak += 1;

  const rec = h2hRecord?.[0];
  const recordStr = rec ? `${rec.wins}-${rec.losses}${rec.ties > 0 ? `-${rec.ties}` : ""}` : "—";
  const avgNetMargin = rec ? Number(rec.avg_score_for) - Number(rec.avg_score_against) : 0;

  // Previous matchup (most recent before this)
  const prev = allGames[0] ?? null;
  const prevMatchup = prev
    ? {
        season: prev.season_year,
        week: prev.week,
        scoreA: prev.manager_a === a ? Number(prev.score_a) : Number(prev.score_b),
        scoreB: prev.manager_a === a ? Number(prev.score_b) : Number(prev.score_a),
      }
    : null;

  // ── Lineups + stats ──
  const espnIds = [...new Set((lineups ?? []).map((l) => l.espn_id).filter(Boolean))];
  const { data: players, error: playersErr } = espnIds.length
    ? await supabase.from("players").select("gsis_id, espn_id, position, headshot").in("espn_id", espnIds)
    : { data: [], error: null };
  if (playersErr) throw new Error(playersErr.message);

  const espnToGsis = new Map(players?.map((p) => [p.espn_id, p.gsis_id]) ?? []);
  const espnToPos = new Map(players?.map((p) => [p.espn_id, p.position]) ?? []);
  const espnToHeadshot = new Map(players?.map((p) => [p.espn_id, p.headshot]) ?? []);
  const gsisIds = [...new Set([...espnToGsis.values()].filter(Boolean))];

  const { data: stats, error: statsErr } = gsisIds.length
    ? await supabase.from("player_weekly_stats").select(STAT_COLS).eq("season", season).eq("week", week).in("player_id", gsisIds)
    : { data: [], error: null };
  if (statsErr) throw new Error(statsErr.message);

  const statsByGsis = new Map(stats?.map((s) => [s.player_id, s]) ?? []);

  function enrich(managerLineup: NonNullable<typeof lineups>): LineupPlayer[] {
    return managerLineup.map((l) => ({
      player_name: l.player_name,
      slot: l.slot,
      points: Number(l.points),
      espn_id: l.espn_id,
      is_starter: l.is_starter,
      position: espnToPos.get(l.espn_id) ?? (statsByGsis.get(espnToGsis.get(l.espn_id) ?? "")?.position),
      headshot: espnToHeadshot.get(l.espn_id) ?? null,
      stats: (statsByGsis.get(espnToGsis.get(l.espn_id) ?? "") as Record<string, number> | undefined) ?? undefined,
    }));
  }

  // ── Bench analysis ──
  function markBench(lineup: LineupPlayer[]): LineupPlayer[] {
    const starterBySlot = new Map(lineup.filter((p) => p.is_starter).map((p) => [p.slot, p]));
    return lineup.map((p) => {
      if (p.is_starter) return p;
      const eligibleSlots = ELIGIBLE_SLOTS[p.position ?? ""] ?? [];
      const shouldHaveStarted = eligibleSlots.some((slot) => {
        const starter = starterBySlot.get(slot);
        return starter && p.points > starter.points;
      });
      return { ...p, shouldHaveStarted };
    });
  }

  return {
    matchup,
    lineupA: markBench(enrich((lineups ?? []).filter((l) => l.manager_id === a))),
    lineupB: markBench(enrich((lineups ?? []).filter((l) => l.manager_id === b))),
    statsA: buildTeamStats(a, scoreA),
    statsB: buildTeamStats(b, scoreB),
    h2h: { record: recordStr, winnerStreak: streak, winner: currentWinner, avgNetMarginForA: avgNetMargin, prevMatchup },
  };
}
