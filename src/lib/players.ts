import { supabase } from "@/lib/supabase";

// Rows of the mv_player_* materialized views (see supabase/migrations/20261014_02_player_stats.sql)

export interface PlayerSummary {
  player_key: string;
  player_name: string;
  position: string | null;
  headshot: string | null;
  latest_team: string | null;
  weeks_rostered: number;
  starts: number;
  starter_points: number;
  avg_start: number | null;
  best_start: number | null;
  seasons: number;
  first_season: number | null;
  last_season: number | null;
  managers: number;
  top_manager: string | null;
  top_manager_weeks: number | null;
  times_drafted: number;
  adds: number;
  drops: number;
  trades: number;
}

export interface PlayerManagerStats {
  manager_id: string;
  weeks_rostered: number;
  starts: number;
  starter_points: number | null;
  avg_start: number | null;
  best_start: number | null;
  seasons: number;
  first_season: number;
  last_season: number;
}

export interface PlayerEvent {
  season_year: number;
  week: number;
  event_at: string | null;
  kind: "draft" | "add" | "drop" | "trade_in" | "trade_out";
  manager_id: string;
  round: number | null;
  overall_pick: number | null;
  value: number | null;
}

export interface PlayerGame {
  season_year: number;
  week: number;
  manager_id: string;
  slot: string;
  is_starter: boolean;
  points: number;
}

const NUMERIC = new Set([
  "weeks_rostered", "starts", "starter_points", "avg_start", "best_start", "seasons", "first_season",
  "last_season", "managers", "top_manager_weeks", "times_drafted", "adds", "drops", "trades",
  "round", "overall_pick", "value", "points", "season_year", "week",
]);

// PostgREST returns numeric columns as strings
function toNumbers<T>(row: Record<string, unknown>): T {
  const out: Record<string, unknown> = { ...row };
  for (const [k, v] of Object.entries(out)) {
    if (NUMERIC.has(k) && v !== null && v !== undefined) out[k] = Number(v);
  }
  return out as T;
}

/** All rows of a query, in pages of 1000 (the API maximum). */
export async function fetchAll<T>(
  build: (from: number, to: number) => PromiseLike<{ data: Record<string, unknown>[] | null }>,
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data } = await build(from, from + 999);
    rows.push(...(data ?? []).map((r) => toNumbers<T>(r)));
    if (!data || data.length < 1000) return rows;
  }
}

export function loadPlayerSummaries() {
  return fetchAll<PlayerSummary>((from, to) =>
    supabase.from("mv_player_summary").select("*").order("player_key").range(from, to));
}

export async function loadPlayer(key: string) {
  const [summary, managers, events, games] = await Promise.all([
    supabase.from("mv_player_summary").select("*").eq("player_key", key).maybeSingle(),
    supabase.from("mv_player_manager_stats").select("*").eq("player_key", key),
    supabase.from("mv_player_events").select("*").eq("player_key", key),
    fetchAll<PlayerGame>((from, to) =>
      supabase.from("mv_player_games").select("season_year, week, manager_id, slot, is_starter, points")
        .eq("player_key", key).order("season_year").order("week").range(from, to)),
  ]);
  return {
    summary: summary.data ? toNumbers<PlayerSummary>(summary.data) : null,
    managers: (managers.data ?? []).map((r) => toNumbers<PlayerManagerStats>(r)),
    events: (events.data ?? []).map((r) => toNumbers<PlayerEvent>(r)),
    games,
  };
}

export const playerHref = (key: string) => `/players/${encodeURIComponent(key)}`;

export const POSITIONS = ["QB", "RB", "WR", "TE", "K", "DST"] as const;
