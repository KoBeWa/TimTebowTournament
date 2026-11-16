import { supabase } from "@/lib/supabase";
import type { H2HMatchup, LineupRow, PairRecord } from "./stats";

/** League-wide record of every pairing (matrix and own averages). Throws when the query fails. */
export async function loadPairs(): Promise<PairRecord[]> {
  const { data, error } = await supabase
    .from("v_head_to_head")
    .select("manager_id, opponent_id, total_games, wins, losses, ties, avg_score_for");
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({
    ...r,
    total_games: Number(r.total_games), wins: Number(r.wins), losses: Number(r.losses),
    ties: Number(r.ties), avg_score_for: Number(r.avg_score_for),
  }));
}

/** Matchups and lineups of one pairing. Throws when a query fails. */
export async function loadPair(m1: string, m2: string): Promise<{ matchups: H2HMatchup[]; lineups: LineupRow[] }> {
  const pairFilter = `and(manager_id.eq.${m1},opponent_id.eq.${m2}),and(manager_id.eq.${m2},opponent_id.eq.${m1})`;
  const lineupQuery = (from: number) => supabase
    .from("v_h2h_lineups")
    .select("season_year, week, manager_id, slot, player_name, points, is_starter")
    .or(pairFilter)
    .order("season_year").order("week").order("manager_id").order("slot")
    .range(from, from + 999);

  // Matchups can be in either direction (manager_a/manager_b)
  const [{ data: asA, error: eA }, { data: asB, error: eB }, l1, l2] = await Promise.all([
    supabase.from("weekly_matchups").select("season_year, week, score_a, score_b, is_playoff")
      .eq("manager_a", m1).eq("manager_b", m2),
    supabase.from("weekly_matchups").select("season_year, week, score_a, score_b, is_playoff")
      .eq("manager_a", m2).eq("manager_b", m1),
    lineupQuery(0),
    lineupQuery(1000),
  ]);

  const failed = eA ?? eB ?? l1.error ?? l2.error;
  if (failed) throw new Error(failed.message);

  const matchups: H2HMatchup[] = [
    ...(asA ?? []).map((m) => ({ season_year: m.season_year, week: m.week, myScore: Number(m.score_a), theirScore: Number(m.score_b), is_playoff: m.is_playoff })),
    ...(asB ?? []).map((m) => ({ season_year: m.season_year, week: m.week, myScore: Number(m.score_b), theirScore: Number(m.score_a), is_playoff: m.is_playoff })),
  ].sort((a, b) => a.season_year - b.season_year || a.week - b.week);

  return {
    matchups,
    lineups: [...(l1.data ?? []), ...(l2.data ?? [])].map((r) => ({ ...r, points: Number(r.points) })),
  };
}
