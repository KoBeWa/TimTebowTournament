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

/** All rows of a query, in pages of 1000 (the API maximum). Throws when a page fails to load. */
export async function fetchAll<T>(
  build: (from: number, to: number) => PromiseLike<{ data: Record<string, unknown>[] | null; error?: { message: string } | null }>,
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await build(from, from + 999);
    if (error) throw new Error(error.message);
    rows.push(...(data ?? []).map((r) => toNumbers<T>(r)));
    if (!data || data.length < 1000) return rows;
  }
}

// Columns the players table, its search and its filters use (the full view has more and is ~1,500 rows)
const LIST_COLS = "player_key, player_name, position, headshot, starter_points, starts, avg_start, managers, times_drafted, adds, drops, trades, first_season, last_season, top_manager, top_manager_weeks";

export type PlayerListRow = Pick<PlayerSummary,
  "player_key" | "player_name" | "position" | "headshot" | "starter_points" | "starts" | "avg_start" | "managers"
  | "times_drafted" | "first_season" | "last_season" | "top_manager" | "top_manager_weeks"> & { moves: number };

/** Slim rows for the players list; adds, drops and trades are folded into `moves`. */
export async function loadPlayerList(): Promise<PlayerListRow[]> {
  const rows = await fetchAll<PlayerSummary>((from, to) =>
    supabase.from("mv_player_summary").select(LIST_COLS).order("player_key").range(from, to));
  return rows.map(({ adds, drops, trades, ...p }) => ({ ...p, moves: adds + drops + trades }));
}

export type PlayerInfo = Pick<PlayerSummary, "player_key" | "player_name" | "position" | "headshot">;

/** Name, position and headshot of the given players (chunked so the request URL stays short). */
export async function loadPlayerInfo(keys: string[]): Promise<PlayerInfo[]> {
  const chunks: string[][] = [];
  for (let i = 0; i < keys.length; i += 150) chunks.push(keys.slice(i, i + 150));
  const parts = await Promise.all(chunks.map(async (chunk) => {
    const { data, error } = await supabase.from("mv_player_summary")
      .select("player_key, player_name, position, headshot").in("player_key", chunk);
    if (error) throw new Error(error.message);
    return (data ?? []) as PlayerInfo[];
  }));
  return parts.flat();
}

const SUMMARY_COLS = "player_key, player_name, position, headshot, latest_team, weeks_rostered, starts, starter_points, avg_start, best_start, seasons, first_season, last_season, managers, top_manager, top_manager_weeks, times_drafted, adds, drops, trades";
const MANAGER_COLS = "manager_id, weeks_rostered, starts, starter_points, avg_start, best_start, seasons, first_season, last_season";
const EVENT_COLS = "season_year, week, event_at, kind, manager_id, round, overall_pick, value";

export type PlayerData = Awaited<ReturnType<typeof loadPlayer>>;

/** Everything on a player's page. Throws when a query fails. */
export async function loadPlayer(key: string) {
  const [summary, managers, events, games] = await Promise.all([
    supabase.from("mv_player_summary").select(SUMMARY_COLS).eq("player_key", key).maybeSingle(),
    supabase.from("mv_player_manager_stats").select(MANAGER_COLS).eq("player_key", key),
    supabase.from("mv_player_events").select(EVENT_COLS).eq("player_key", key),
    fetchAll<PlayerGame>((from, to) =>
      supabase.from("mv_player_games").select("season_year, week, manager_id, slot, is_starter, points")
        .eq("player_key", key).order("season_year").order("week").range(from, to)),
  ]);
  const failed = summary.error ?? managers.error ?? events.error;
  if (failed) throw new Error(failed.message);
  return {
    summary: summary.data ? toNumbers<PlayerSummary>(summary.data) : null,
    managers: (managers.data ?? []).map((r) => toNumbers<PlayerManagerStats>(r)),
    events: (events.data ?? []).map((r) => toNumbers<PlayerEvent>(r)),
    games,
  };
}

/** The manager's rows of the player tables, for the manager page. Throws when a query fails. */
export async function loadManagerPlayers(manager: string) {
  const [stats, events, teams] = await Promise.all([
    fetchAll<PlayerManagerStats & { player_key: string }>((f, t) =>
      supabase.from("mv_player_manager_stats").select(`player_key, ${MANAGER_COLS}`).eq("manager_id", manager).order("player_key").range(f, t)),
    fetchAll<{ player_key: string; kind: string }>((f, t) =>
      supabase.from("mv_player_events").select("player_key, kind").eq("manager_id", manager).order("player_key").range(f, t)),
    fetchAll<{ player_key: string; teams: string }>((f, t) =>
      supabase.from("mv_player_manager_teams").select("player_key, teams").eq("manager_id", manager).order("player_key").range(f, t)),
  ]);
  const keys = [...new Set([...stats.map((s) => s.player_key), ...events.map((e) => e.player_key)])];
  const info = await loadPlayerInfo(keys);
  return { stats, events, teams, info };
}

export const playerHref = (key: string) => `/players/${encodeURIComponent(key)}`;

export const POSITIONS = ["QB", "RB", "WR", "TE", "K", "DST"] as const;
