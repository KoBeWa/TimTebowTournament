import { supabase } from "@/lib/supabase";
import RankingsTable, { type RankingRow } from "./RankingsTable";

async function getRankings(): Promise<RankingRow[]> {
  const { data, error } = await supabase.rpc("get_alltime_rankings_table" as never);
  if (!error && data) return data as RankingRow[];

  // Fallback: manual aggregation via separate queries
  const [
    { data: base },
    { data: leagueRec },
    { data: draft },
    { data: coach },
    { data: manager },
    { data: ptsShare },
    { data: records },
    { data: achievements },
  ] = await Promise.all([
    supabase.from("v_alltime_standings").select("manager_id, avg_pf_per_season"),
    supabase.from("v_league_records").select("manager_id, avg_sos, total_luck, top_score_pct"),
    supabase.from("v_league_rating").select("manager_id, avg_grade4"),
    supabase.from("v_league_rating").select("manager_id, coach_score"),
    supabase.from("v_lineup_efficiency").select("manager_id, lineup_efficiency"),
    supabase.from("v_points_share").select("manager_id, points_share_pct"),
    supabase.from("record_timeline").select("manager_id, is_current").eq("is_current", true),
    supabase.from("achievements").select("manager_id"),
  ]);

  // Aggregate per manager
  const avgDraft: Record<string, number[]> = {};
  const avgCoach: Record<string, number[]> = {};
  for (const r of draft ?? []) {
    (avgDraft[r.manager_id] ??= []).push(Number(r.avg_grade4));
  }
  for (const r of coach ?? []) {
    (avgCoach[r.manager_id] ??= []).push(Number(r.coach_score));
  }

  const avgManager: Record<string, number[]> = {};
  for (const r of manager ?? []) {
    (avgManager[r.manager_id] ??= []).push(Number(r.lineup_efficiency));
  }

  const avgPtsShare: Record<string, number[]> = {};
  for (const r of ptsShare ?? []) {
    (avgPtsShare[r.manager_id] ??= []).push(Number(r.points_share_pct));
  }

  const recordCount: Record<string, number> = {};
  for (const r of records ?? []) {
    recordCount[r.manager_id] = (recordCount[r.manager_id] ?? 0) + 1;
  }

  const achCount: Record<string, number> = {};
  for (const r of achievements ?? []) {
    achCount[r.manager_id] = (achCount[r.manager_id] ?? 0) + 1;
  }

  const avg = (arr: number[]) => arr.reduce((s, v) => s + v, 0) / arr.length;

  type LeagueRecRow = { manager_id: string; avg_sos: unknown; total_luck: unknown; top_score_pct: unknown };
  const leagueMap: Record<string, LeagueRecRow> = {};
  for (const r of leagueRec ?? []) leagueMap[r.manager_id] = r;

  return (base ?? []).map((r) => ({
    manager_id: r.manager_id,
    avg_draft: avg(avgDraft[r.manager_id] ?? [0]),
    avg_manager_pct: avg(avgManager[r.manager_id] ?? [0]) * 100,
    avg_coach: avg(avgCoach[r.manager_id] ?? [0]),
    avg_sos: Number(leagueMap[r.manager_id]?.avg_sos ?? 0),
    total_luck: Number(leagueMap[r.manager_id]?.total_luck ?? 0),
    top_score_pct: Number(leagueMap[r.manager_id]?.top_score_pct ?? 0),
    current_records: recordCount[r.manager_id] ?? 0,
    achievements: achCount[r.manager_id] ?? 0,
    avg_points_share: avg(avgPtsShare[r.manager_id] ?? [0]),
    avg_season_score: Number(r.avg_pf_per_season),
  }));
}

export default async function RankingsPage() {
  const rows = await getRankings();

  return (
    <div>
      <div className="mb-8" style={{ borderBottom: "2px solid #1a1a1a", paddingBottom: "1rem" }}>
        <div className="kicker mb-1">Statistiken</div>
        <h1 className="display-title text-4xl md:text-5xl text-ink">Owner Rankings</h1>
        <p className="text-text-muted mt-1 text-sm">All-Time · Klick auf eine Spalte zum Sortieren</p>
      </div>

      <RankingsTable rows={rows} />
    </div>
  );
}
