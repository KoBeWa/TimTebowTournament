"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { SEASONS, CURRENT_SEASON } from "@/lib/constants";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import Tabs from "@/components/ui/Tabs";
import ManagerName from "@/components/ui/ManagerName";

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
const pts = (n: number) => n.toLocaleString("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const tone = (n: number | null) => (n === null || n === 0 ? "text-text-secondary" : n > 0 ? "text-positive" : "text-negative");

function StatRow({ label, a, b, toneA, toneB }: { label: string; a: string; b: string; toneA?: string; toneB?: string }) {
  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 py-1 text-sm tabular-nums">
      <span className={toneA ?? "text-text-secondary"}>{a}</span>
      <span className="text-xs text-text-muted">{label}</span>
      <span className={`text-right ${toneB ?? "text-text-secondary"}`}>{b}</span>
    </div>
  );
}

function Side({ id, score, won, align }: { id: string; score: number; won: boolean; align: "left" | "right" }) {
  const right = align === "right";
  return (
    <div className={`flex min-w-0 flex-1 items-center gap-2 sm:gap-3 ${right ? "flex-row-reverse text-right" : ""}`}>
      <ManagerName id={id} plain className={`${right ? "flex-row-reverse" : ""} text-base ${won ? "font-semibold text-ink" : "text-text-muted"}`} />
      <span className={`display-title text-xl sm:text-2xl tabular-nums ${right ? "mr-auto" : "ml-auto"} ${won ? "text-ink" : "text-text-faint"}`}>{pts(score)}</span>
    </div>
  );
}

function MatchupCard({ m, season, week }: { m: MatchupWithStats; season: number; week: number }) {
  const [open, setOpen] = useState(false);
  const aWon = m.score_a > m.score_b;
  const bWon = m.score_b > m.score_a;
  const { statsA: a, statsB: b } = m;
  return (
    <div className="cell overflow-hidden">
      <Link
        href={`/gamecenter/${season}/${week}?a=${m.manager_a}&b=${m.manager_b}`}
        className="flex items-center gap-2.5 px-4 py-4 transition-colors hover:bg-surface-2 sm:gap-4 sm:px-5"
      >
        <Side id={m.manager_a} score={m.score_a} won={aWon} align="left" />
        <span className="text-xs text-text-faint">vs</span>
        <Side id={m.manager_b} score={m.score_b} won={bWon} align="right" />
      </Link>

      <div className="border-t border-border-light px-4 py-2 sm:px-5">
        <StatRow
          label="Coach-Score"
          a={a.coach_score !== null ? a.coach_score.toFixed(1) : "–"}
          b={b.coach_score !== null ? b.coach_score.toFixed(1) : "–"}
        />
        <StatRow
          label="Luck"
          a={a.luck !== null ? sign(a.luck) : "–"}
          b={b.luck !== null ? sign(b.luck) : "–"}
          toneA={tone(a.luck)}
          toneB={tone(b.luck)}
        />
        {open && (
          <>
            <StatRow label="Coach-Rang" a={a.coach_rank !== null ? `#${a.coach_rank}` : "–"} b={b.coach_rank !== null ? `#${b.coach_rank}` : "–"} />
            <StatRow label="vs Team Ø" a={signPct(a.pts_vs_team_avg_pct)} b={signPct(b.pts_vs_team_avg_pct)} toneA={tone(a.pts_vs_team_avg_pct)} toneB={tone(b.pts_vs_team_avg_pct)} />
            <StatRow label="vs Liga Ø" a={signPct(a.pts_vs_league_avg_pct)} b={signPct(b.pts_vs_league_avg_pct)} toneA={tone(a.pts_vs_league_avg_pct)} toneB={tone(b.pts_vs_league_avg_pct)} />
            <StatRow label="Punkteanteil" a={`${a.pts_share_pct.toFixed(1)}%`} b={`${b.pts_share_pct.toFixed(1)}%`} />
            <StatRow label="Wochenrang" a={`#${a.pts_rank}`} b={`#${b.pts_rank}`} />
          </>
        )}
      </div>

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-center gap-1 border-t border-border-light px-4 py-2 text-xs text-text-muted transition-colors hover:text-ink"
      >
        {open ? "Weniger" : "Details"}
        <ChevronDown size={14} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
    </div>
  );
}

export default function GamecenterPage() {
  const [season, setSeason] = useState(CURRENT_SEASON);
  const [week, setWeek] = useState<number | null>(null);
  const [maxWeek, setMaxWeek] = useState(16);
  const [playoffWeeks, setPlayoffWeeks] = useState<number[]>([]);
  const [matchups, setMatchups] = useState<MatchupWithStats[]>([]);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);

  // Detect latest week for a season
  const detectLatestWeek = useCallback(async (s: number) => {
    const { data } = await supabase
      .from("weekly_matchups")
      .select("week, is_playoff")
      .eq("season_year", s)
      .order("week", { ascending: false });
    const latest = data?.[0]?.week ?? 1;
    setMaxWeek(latest);
    setPlayoffWeeks([...new Set((data ?? []).filter((r) => r.is_playoff).map((r) => r.week as number))].sort((x, y) => x - y));
    return latest;
  }, []);

  // Fetch week data + compute stats
  const fetchWeekData = useCallback(async (s: number, w: number) => {
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
    setLoadedKey(`${s}-${w}`);
  }, []);

  // Detect the latest week whenever the season changes (also on mount)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const latest = await detectLatestWeek(season);
      if (!cancelled) setWeek(latest);
    })();
    return () => { cancelled = true; };
  }, [season, detectLatestWeek]);

  // Fetch data when week is known
  useEffect(() => {
    if (week === null) return;
    (async () => { await fetchWeekData(season, week); })();
  }, [season, week, fetchWeekData]);

  const loading = week === null || loadedKey !== `${season}-${week}`;

  const weekTabs = Array.from({ length: maxWeek }, (_, i) => {
    const w = i + 1;
    const po = playoffWeeks.indexOf(w);
    return { key: w, label: po >= 0 ? `PO ${po + 1}` : String(w) };
  });

  return (
    <div>
      <PageHeader title="Gamecenter" description="Jedes Matchup, jeder Punkt, jede Woche" />

      <div className="mb-5 flex flex-wrap items-center gap-x-4 gap-y-3">
        <label className="flex items-center gap-2 text-sm text-text-muted">
          Saison
          <select
            value={season}
            onChange={(e) => setSeason(Number(e.target.value))}
            className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-ink"
          >
            {[...SEASONS].reverse().map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </label>
        <div className="flex min-w-0 max-w-full items-center gap-2 text-sm text-text-muted">
          <span className="shrink-0">Woche</span>
          {week !== null && <Tabs tabs={weekTabs} value={week} onChange={setWeek} size="sm" label="Woche" />}
        </div>
      </div>

      {/* Keep the previous cards visible (dimmed) while the next week loads */}
      {matchups.length === 0 && loading ? (
        <div className="py-12 text-center text-text-muted">Lade Matchups...</div>
      ) : (
        <div className={`grid grid-cols-1 items-start gap-4 transition-opacity md:grid-cols-2 ${loading ? "opacity-50" : ""}`}>
          {matchups.map((m) => (
            <MatchupCard
              key={`${m.manager_a}-${m.manager_b}`}
              m={m}
              season={m.season_year}
              week={m.week}
            />
          ))}
        </div>
      )}
    </div>
  );
}
