"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { SEASONS, CURRENT_SEASON } from "@/lib/constants";
import Link from "next/link";

interface Matchup {
  season_year: number;
  week: number;
  manager_a: string;
  score_a: number;
  manager_b: string;
  score_b: number;
  is_playoff: boolean;
}

interface ManagerWeekStats {
  pts_vs_team_avg_pct: number;
  pts_vs_league_avg_pct: number;
  pts_share_pct: number;
  pts_rank: number;
  coach_score: number | null;
  coach_rank: number | null;
  luck: number | null;
}

interface MatchupWithStats extends Matchup {
  statsA: ManagerWeekStats;
  statsB: ManagerWeekStats;
}

function sign(n: number) { return n >= 0 ? `+${n.toFixed(1)}` : n.toFixed(1); }
function signPct(n: number) { return (n >= 0 ? "+" : "") + n.toFixed(1) + "%"; }

function StatCell({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="text-center">
      <div className="label-nav text-xs text-text-faint" style={{ fontSize: "9px" }}>{label}</div>
      <div className={`font-mono text-xs ${highlight ? "text-ink font-semibold" : "text-text-secondary"}`}>{value}</div>
    </div>
  );
}

function MatchupCard({ m, season, week }: { m: MatchupWithStats; season: number; week: number }) {
  const aWon = m.score_a > m.score_b;
  return (
    <Link
      href={`/gamecenter/${season}/${week}?a=${m.manager_a}&b=${m.manager_b}`}
      className="cell-hover group block"
      style={{ padding: "0" }}
    >
      {m.is_playoff && (
        <div className="label-nav text-xs text-ink border-b border-border px-4 py-1.5">Playoff</div>
      )}

      {/* Score header */}
      <div className="flex items-center justify-between px-5 pt-4 pb-3">
        <div className={`display-title text-xl tracking-wide flex-1 ${aWon ? "text-ink" : "text-text-secondary"}`}>
          {m.manager_a}
        </div>
        <div className="flex items-center gap-2 px-3">
          <span className={`display-title text-2xl ${aWon ? "text-ink font-semibold" : "text-text-secondary"}`}>
            {m.score_a.toFixed(1)}
          </span>
          <span className="text-text-muted text-xs">–</span>
          <span className={`display-title text-2xl ${!aWon ? "text-ink font-semibold" : "text-text-secondary"}`}>
            {m.score_b.toFixed(1)}
          </span>
        </div>
        <div className={`display-title text-xl tracking-wide flex-1 text-right ${!aWon ? "text-ink" : "text-text-secondary"}`}>
          {m.manager_b}
        </div>
      </div>

      {/* Stats rows */}
      <div style={{ borderTop: "1px solid var(--color-border-light)" }}>
        {([["A", m.statsA, m.manager_a, aWon], ["B", m.statsB, m.manager_b, !aWon]] as const).map(
          ([side, stats, name, won]) => (
            <div
              key={side}
              className="flex items-center gap-3 px-5 py-2"
              style={{
                borderBottom: side === "A" ? "1px solid var(--color-border-light)" : undefined,
                background: won ? "rgba(0,0,0,0.015)" : undefined,
              }}
            >
              <div className="label-nav text-xs w-14 truncate" style={{ color: won ? "#1a1a1a" : "var(--color-text-muted)" }}>
                {name}
              </div>
              <div className="flex gap-4 flex-1 justify-between">
                <StatCell
                  label="vs Team Ø"
                  value={signPct(stats.pts_vs_team_avg_pct)}
                  highlight={stats.pts_vs_team_avg_pct > 0}
                />
                <StatCell
                  label="vs Liga Ø"
                  value={signPct(stats.pts_vs_league_avg_pct)}
                  highlight={stats.pts_vs_league_avg_pct > 0}
                />
                <StatCell
                  label="Pts Share"
                  value={`${stats.pts_share_pct.toFixed(1)}% (#${stats.pts_rank})`}
                  highlight={stats.pts_rank <= 2}
                />
                <StatCell
                  label="Coach"
                  value={stats.coach_score !== null ? `${stats.coach_score.toFixed(1)} (#${stats.coach_rank})` : "—"}
                />
                <StatCell
                  label="Luck"
                  value={stats.luck !== null ? sign(stats.luck) : "—"}
                  highlight={stats.luck !== null && stats.luck > 0}
                />
              </div>
            </div>
          )
        )}
      </div>
    </Link>
  );
}

export default function GamecenterPage() {
  const [season, setSeason] = useState(CURRENT_SEASON);
  const [week, setWeek] = useState<number | null>(null);
  const [maxWeek, setMaxWeek] = useState(16);
  const [matchups, setMatchups] = useState<MatchupWithStats[]>([]);
  const [loading, setLoading] = useState(true);

  // Detect latest week for a season
  const detectLatestWeek = useCallback(async (s: number) => {
    const { data } = await supabase
      .from("weekly_matchups")
      .select("week")
      .eq("season_year", s)
      .order("week", { ascending: false })
      .limit(1);
    const latest = data?.[0]?.week ?? 1;
    setMaxWeek(latest);
    return latest;
  }, []);

  // Fetch week data + compute stats
  const fetchWeekData = useCallback(async (s: number, w: number) => {
    setLoading(true);

    const [
      { data: rawMatchups },
      { data: weekScores },
      { data: seasonResults },
      { data: coachData },
      { data: luckData },
    ] = await Promise.all([
      supabase.from("weekly_matchups").select("*").eq("season_year", s).eq("week", w),
      supabase.from("v_weekly_scores").select("*").eq("season_year", s).eq("week", w),
      supabase.from("season_results").select("manager_id, wins, losses, ties, points_for").eq("season_year", s),
      supabase.from("v_coach_rank").select("manager_id, coach_score").eq("season_year", s).order("coach_score", { ascending: false }),
      supabase.from("v_luck").select("manager_id, luck").eq("season_year", s),
    ]);

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

    const enriched: MatchupWithStats[] = (rawMatchups ?? []).map((m) => ({
      ...m,
      score_a: Number(m.score_a),
      score_b: Number(m.score_b),
      statsA: buildStats(m.manager_a),
      statsB: buildStats(m.manager_b),
    }));

    setMatchups(enriched);
    setLoading(false);
  }, []);

  // On mount: detect latest week for current season
  useEffect(() => {
    detectLatestWeek(CURRENT_SEASON).then((latest) => {
      setWeek(latest);
    });
  }, [detectLatestWeek]);

  // When season changes (user click)
  useEffect(() => {
    if (season === CURRENT_SEASON) return; // handled on mount
    detectLatestWeek(season).then((latest) => {
      setWeek(latest);
    });
  }, [season, detectLatestWeek]);

  // Fetch data when week is known
  useEffect(() => {
    if (week === null) return;
    fetchWeekData(season, week);
  }, [season, week, fetchWeekData]);

  const weeks = Array.from({ length: maxWeek }, (_, i) => i + 1);

  return (
    <div className="space-y-8">
      <div>
        <div className="kicker">Gamecenter</div>
        <h1 className="display-title text-4xl md:text-5xl text-ink">Gamecenter</h1>
        <p className="text-text-secondary mt-2">Jedes Matchup, jeder Punkt, jede Woche</p>
      </div>

      {/* Selectors */}
      <div className="flex flex-wrap gap-6">
        <div>
          <label className="kicker block mb-2">Season</label>
          <div className="flex flex-wrap gap-1">
            {SEASONS.map((s) => (
              <button
                key={s}
                onClick={() => setSeason(s)}
                className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                  s === season
                    ? "bg-red text-cream font-semibold"
                    : "bg-cream text-text-secondary hover:text-ink border border-border"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="kicker block mb-2">Week</label>
          <div className="flex flex-wrap gap-1">
            {weeks.map((w) => (
              <button
                key={w}
                onClick={() => setWeek(w)}
                className={`w-10 h-9 text-sm rounded-lg transition-colors ${
                  w === week
                    ? "bg-red text-cream font-semibold"
                    : "bg-cream text-text-secondary hover:text-ink border border-border"
                }`}
              >
                {w}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Matchup Cards */}
      {loading || week === null ? (
        <div className="text-text-muted text-center py-12">Lade Matchups...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {matchups.map((m) => (
            <MatchupCard
              key={`${m.manager_a}-${m.manager_b}`}
              m={m}
              season={season}
              week={week}
            />
          ))}
        </div>
      )}
    </div>
  );
}
