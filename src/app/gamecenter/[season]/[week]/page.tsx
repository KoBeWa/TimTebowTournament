"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

// ─── Types ────────────────────────────────────────────────────────────────────

interface LineupPlayer {
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

interface TeamWeekStats {
  score: number;
  pts_share_pct: number;
  pts_rank: number;
  pts_vs_team_avg_pct: number;
  pts_vs_league_avg_pct: number;
  luck: number | null;
  coach_score: number | null;
  coach_rank: number | null;
}

interface H2HData {
  record: string;       // "16–10"
  winnerStreak: number;
  winner: string;
  avgNetMarginForA: number;
  prevMatchup: { season: number; week: number; scoreA: number; scoreB: number } | null;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SLOT_ORDER = ["QB", "RB1", "RB2", "WR1", "WR2", "TE", "FLEX", "K", "DST"];
// Position groups for battle
const POS_GROUPS: Record<string, string[]> = {
  QB:   ["QB"],
  RB:   ["RB1", "RB2"],
  WR:   ["WR1", "WR2"],
  TE:   ["TE"],
  FLEX: ["FLEX"],
  K:    ["K"],
  DST:  ["DST"],
};
// Eligible starter slots per position
const ELIGIBLE_SLOTS: Record<string, string[]> = {
  QB:  ["QB"],
  RB:  ["RB1", "RB2", "FLEX"],
  WR:  ["WR1", "WR2", "FLEX"],
  TE:  ["TE", "FLEX"],
  K:   ["K"],
  DST: ["DST"],
};

// ─── Stat line ────────────────────────────────────────────────────────────────

function StatLine({ player }: { player: LineupPlayer }) {
  const s = player.stats;
  if (!s) return null;
  const pos = player.position ?? (player.slot === "FLEX" ? "RB" : player.slot.replace(/\d/, ""));

  if (pos === "QB") return (
    <span className="text-text-muted text-xs">
      {s.completions}/{s.attempts}, {s.passing_yards} YDS, {s.passing_tds} TD
      {(s.passing_interceptions ?? 0) > 0 && `, ${s.passing_interceptions} INT`}
      {(s.carries ?? 0) > 0 && ` · ${s.carries} CAR, ${s.rushing_yards} YDS`}
      {(s.rushing_tds ?? 0) > 0 && `, ${s.rushing_tds} TD`}
    </span>
  );

  if (pos === "RB") return (
    <span className="text-text-muted text-xs">
      {s.carries ?? 0} CAR, {s.rushing_yards ?? 0} YDS{(s.rushing_tds ?? 0) > 0 && `, ${s.rushing_tds} TD`}
      {(s.receptions ?? 0) > 0 && ` · ${s.receptions} REC, ${s.receiving_yards} YDS`}
      {(s.receiving_tds ?? 0) > 0 && `, ${s.receiving_tds} TD`}
    </span>
  );

  if (pos === "WR" || pos === "TE") return (
    <span className="text-text-muted text-xs">
      {s.receptions ?? 0}/{s.targets ?? 0} REC, {s.receiving_yards ?? 0} YDS
      {(s.receiving_tds ?? 0) > 0 && `, ${s.receiving_tds} TD`}
      {(s.carries ?? 0) > 0 && ` · ${s.carries} CAR, ${s.rushing_yards} YDS`}
    </span>
  );

  if (pos === "K") return (
    <span className="text-text-muted text-xs">
      FG {s.fg_made ?? 0}/{s.fg_att ?? 0} · PAT {s.pat_made ?? 0}/{s.pat_att ?? 0}
    </span>
  );

  return null;
}

// ─── Lineup table ─────────────────────────────────────────────────────────────

function LineupTable({
  lineup, label, positionWins, reversed,
}: {
  lineup: LineupPlayer[];
  label: string;
  positionWins: Record<string, boolean>; // slot → did this team win the pos battle for this slot?
  reversed?: boolean;
}) {
  const starters = lineup
    .filter((p) => p.is_starter)
    .sort((a, b) => SLOT_ORDER.indexOf(a.slot) - SLOT_ORDER.indexOf(b.slot));

  const bench = lineup
    .filter((p) => !p.is_starter)
    .sort((a, b) => b.points - a.points);

  const slotLabel = (slot: string) => {
    if (slot === "DST") return "DEF";
    if (slot === "FLEX") return "FLX";
    return slot;
  };

  return (
    <div className="flex-1 min-w-0">
      <h3 className={`display-title text-2xl tracking-wide mb-4 text-ink ${reversed ? "text-right" : ""}`}>
        {label}
      </h3>
      <div className="space-y-1">
        {starters.map((p) => {
          // Position group for this slot (e.g. RB1 → "RB")
          const posGroup = Object.entries(POS_GROUPS).find(([, slots]) => slots.includes(p.slot))?.[0] ?? p.slot;
          const wonBattle = positionWins[posGroup] === true;
          return (
            <div
              key={p.slot}
              className="flex items-center gap-3 p-3 rounded-lg transition-colors"
              style={{
                background: wonBattle ? "rgba(26,26,26,0.06)" : "transparent",
                border: wonBattle ? "1px solid rgba(26,26,26,0.12)" : "1px solid transparent",
              }}
            >
              {reversed && (
                <div className="display-title text-lg tracking-wide text-ink ml-auto order-last">
                  {p.points.toFixed(1)}
                </div>
              )}
              {/* Slot badge */}
              <div className="w-9 text-center flex-shrink-0">
                <span className="text-xs font-semibold text-red">{slotLabel(p.slot)}</span>
              </div>
              {/* Headshot */}
              <div className="w-10 h-10 flex-shrink-0 rounded-full overflow-hidden bg-border-light flex items-center justify-center">
                {p.headshot ? (
                  <img
                    src={p.headshot}
                    alt={p.player_name}
                    width={40}
                    height={40}
                    className="w-full h-full object-cover object-top"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                  />
                ) : (
                  <span className="text-xs text-text-faint font-semibold">
                    {p.player_name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                  </span>
                )}
              </div>
              {/* Name + stats */}
              <div className="flex-1 min-w-0">
                <div className={`text-sm font-medium text-ink truncate ${reversed ? "text-right" : ""}`}>
                  {p.player_name}
                </div>
                <div className={reversed ? "text-right" : ""}>
                  <StatLine player={p} />
                </div>
              </div>
              {!reversed && (
                <div className="display-title text-lg tracking-wide text-ink">
                  {p.points.toFixed(1)}
                </div>
              )}
              {wonBattle && (
                <div className="w-1.5 h-1.5 rounded-full bg-ink flex-shrink-0" title="Position Battle gewonnen" />
              )}
            </div>
          );
        })}
      </div>

      {bench.length > 0 && (
        <>
          <div className="kicker mt-5 mb-2 px-3">Bench</div>
          <div className="space-y-1">
            {bench.map((p, i) => (
              <div
                key={`bench-${i}`}
                className="flex items-center gap-3 p-2 px-3 rounded-lg"
                style={{
                  background: p.shouldHaveStarted ? "rgba(200,50,50,0.08)" : undefined,
                  border: p.shouldHaveStarted ? "1px solid rgba(200,50,50,0.2)" : "1px solid transparent",
                  opacity: p.shouldHaveStarted ? 1 : 0.55,
                }}
              >
                <div className="w-9 text-center flex-shrink-0">
                  <span className="text-xs text-text-muted">BN</span>
                </div>
                <div className="flex-1 min-w-0">
                  <span className={`text-sm truncate ${p.shouldHaveStarted ? "text-ink font-medium" : "text-text-secondary"}`}>
                    {p.player_name}
                  </span>
                  {p.shouldHaveStarted && (
                    <span className="ml-2 text-xs" style={{ color: "rgb(180,40,40)" }}>hätte starten sollen</span>
                  )}
                </div>
                <div className={`text-sm font-mono ${p.shouldHaveStarted ? "text-ink font-semibold" : "text-text-muted"}`}>
                  {p.points.toFixed(1)}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Team stat bar ─────────────────────────────────────────────────────────────

function TeamStatBar({ stats, label, won }: { stats: TeamWeekStats; label: string; won: boolean }) {
  const signPct = (n: number) => (n >= 0 ? "+" : "") + n.toFixed(1) + "%";
  const sign = (n: number) => (n >= 0 ? "+" : "") + n.toFixed(2);

  const items = [
    { label: "Pts Share", value: `${stats.pts_share_pct.toFixed(1)}%` },
    { label: "Pts Rank", value: `#${stats.pts_rank}` },
    { label: "vs Team Ø", value: signPct(stats.pts_vs_team_avg_pct) },
    { label: "vs Liga Ø", value: signPct(stats.pts_vs_league_avg_pct) },
    { label: "Luck", value: stats.luck !== null ? sign(stats.luck) : "—" },
    { label: "Coach Rank", value: stats.coach_rank !== null ? `#${stats.coach_rank}` : "—" },
    { label: "Coach Score", value: stats.coach_score !== null ? stats.coach_score.toFixed(1) : "—" },
  ];

  return (
    <div
      className="flex-1 rounded-lg p-4"
      style={{ background: won ? "rgba(26,26,26,0.06)" : "rgba(0,0,0,0.02)", border: "1px solid var(--color-border-light)" }}
    >
      <div className={`display-title text-lg mb-3 ${won ? "text-ink" : "text-text-secondary"}`}>{label}</div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-2">
        {items.map((item) => (
          <div key={item.label} className="flex justify-between gap-2">
            <span className="label-nav text-xs text-text-muted">{item.label}</span>
            <span className="label-nav text-xs font-semibold text-ink">{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── H2H section ──────────────────────────────────────────────────────────────

function H2HSection({ h2h, managerA, managerB, season, week }: {
  h2h: H2HData;
  managerA: string;
  managerB: string;
  season: number;
  week: number;
}) {
  const margin = h2h.avgNetMarginForA;
  const favoredA = margin >= 0;
  return (
    <div className="cell p-6">
      <div className="kicker mb-4">Head to Head History</div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* All-time record */}
        <div>
          <div className="label-nav text-xs text-text-muted mb-1">All-Time Record</div>
          <div className="display-title text-xl text-ink">{h2h.record}</div>
          <div className="text-xs text-text-muted mt-0.5">{managerA} vs {managerB}</div>
        </div>

        {/* Win streak */}
        <div>
          <div className="label-nav text-xs text-text-muted mb-1">Aktueller Streak</div>
          <div className="display-title text-xl text-ink">{h2h.winnerStreak}×</div>
          <div className="text-xs text-text-muted mt-0.5">{h2h.winner} in Serie</div>
        </div>

        {/* Avg net margin */}
        <div>
          <div className="label-nav text-xs text-text-muted mb-1">Ø Net Margin</div>
          <div className={`display-title text-xl ${favoredA ? "text-ink" : "text-text-secondary"}`}>
            {favoredA ? "+" : ""}{Math.abs(margin).toFixed(1)}
          </div>
          <div className="text-xs text-text-muted mt-0.5">zugunsten {favoredA ? managerA : managerB}</div>
        </div>

        {/* Previous matchup */}
        {h2h.prevMatchup && (
          <div>
            <div className="label-nav text-xs text-text-muted mb-1">Letztes Aufeinandertreffen</div>
            <Link
              href={`/gamecenter/${h2h.prevMatchup.season}/${h2h.prevMatchup.week}?a=${managerA}&b=${managerB}`}
              className="group"
            >
              <div className="display-title text-xl text-ink group-hover:text-red transition-colors">
                {h2h.prevMatchup.scoreA.toFixed(1)} – {h2h.prevMatchup.scoreB.toFixed(1)}
              </div>
              <div className="text-xs text-text-muted mt-0.5">
                {h2h.prevMatchup.season} · Woche {h2h.prevMatchup.week}
              </div>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function MatchupDetailPage({
  params,
}: {
  params: Promise<{ season: string; week: string }>;
}) {
  const searchParams = useSearchParams();
  const [resolvedParams, setResolvedParams] = useState<{ season: string; week: string } | null>(null);
  const [lineupA, setLineupA] = useState<LineupPlayer[]>([]);
  const [lineupB, setLineupB] = useState<LineupPlayer[]>([]);
  const [matchup, setMatchup] = useState<{ manager_a: string; manager_b: string; score_a: number; score_b: number; is_playoff: boolean } | null>(null);
  const [statsA, setStatsA] = useState<TeamWeekStats | null>(null);
  const [statsB, setStatsB] = useState<TeamWeekStats | null>(null);
  const [h2h, setH2H] = useState<H2HData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { params.then(setResolvedParams); }, [params]);

  useEffect(() => {
    if (!resolvedParams) return;
    const season = parseInt(resolvedParams.season);
    const week = parseInt(resolvedParams.week);
    const a = searchParams.get("a");
    const b = searchParams.get("b");
    if (!a || !b) return;

    async function fetchData() {
      setLoading(true);

      // ── Parallel fetches ──
      const [
        { data: matchupData },
        { data: lineups },
        { data: weekScores },
        { data: seasonResults },
        { data: coachData },
        { data: luckData },
        { data: h2hHistory },
        { data: h2hRecord },
      ] = await Promise.all([
        supabase.from("weekly_matchups").select("*").eq("season_year", season).eq("week", week).eq("manager_a", a!).eq("manager_b", b!).single(),
        supabase.from("weekly_lineups").select("*").eq("season_year", season).eq("week", week).in("manager_id", [a!, b!]),
        supabase.from("v_weekly_scores").select("*").eq("season_year", season).eq("week", week),
        supabase.from("season_results").select("manager_id, wins, losses, ties, points_for").eq("season_year", season),
        supabase.from("v_coach_rank").select("manager_id, coach_score").eq("season_year", season).order("coach_score", { ascending: false }),
        supabase.from("v_luck").select("manager_id, luck").eq("season_year", season),
        supabase.from("weekly_matchups").select("season_year, week, manager_a, score_a, manager_b, score_b")
          .or(`and(manager_a.eq.${a},manager_b.eq.${b}),and(manager_a.eq.${b},manager_b.eq.${a})`)
          .order("season_year", { ascending: false }).order("week", { ascending: false }),
        supabase.from("v_head_to_head").select("*").eq("manager_id", a!).eq("opponent_id", b!),
      ]);

      if (matchupData) {
        setMatchup({ ...matchupData, score_a: Number(matchupData.score_a), score_b: Number(matchupData.score_b) });
      }

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

      const scoreA = Number(matchupData?.score_a ?? 0);
      const scoreB = Number(matchupData?.score_b ?? 0);
      setStatsA(buildTeamStats(a!, scoreA));
      setStatsB(buildTeamStats(b!, scoreB));

      // ── H2H ──
      const allGames = (h2hHistory ?? []).filter(
        (g) => !(g.season_year === season && g.week === week)
      );

      // Win streak: find streak of current matchup winner
      const currentWinner = scoreA > scoreB ? a! : b!;
      let streak = 0;
      for (const g of allGames) {
        const gWinner = Number(g.score_a) > Number(g.score_b) ? g.manager_a : g.manager_b;
        if (gWinner === currentWinner) streak++;
        else break;
      }
      // Add 1 for this game
      streak += 1;

      // Record from h2hRecord view
      const rec = h2hRecord?.[0];
      const recordStr = rec ? `${rec.wins}–${rec.losses}${rec.ties > 0 ? `–${rec.ties}` : ""}` : "—";
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

      setH2H({ record: recordStr, winnerStreak: streak, winner: currentWinner, avgNetMarginForA: avgNetMargin, prevMatchup });

      // ── Lineups + stats ──
      const espnIds = [...new Set((lineups ?? []).map((l) => l.espn_id).filter(Boolean))];
      const { data: players } = espnIds.length
        ? await supabase.from("players").select("gsis_id, espn_id, position, headshot").in("espn_id", espnIds)
        : { data: [] };

      const espnToGsis = new Map(players?.map((p) => [p.espn_id, p.gsis_id]) ?? []);
      const espnToPos = new Map(players?.map((p) => [p.espn_id, p.position]) ?? []);
      const espnToHeadshot = new Map(players?.map((p) => [p.espn_id, p.headshot]) ?? []);
      const gsisIds = [...new Set([...espnToGsis.values()].filter(Boolean))];

      const { data: stats } = gsisIds.length
        ? await supabase.from("player_weekly_stats").select("*").eq("season", season).eq("week", week).in("player_id", gsisIds)
        : { data: [] };

      const statsByGsis = new Map(stats?.map((s) => [s.player_id, s]) ?? []);

      function enrich(managerLineup: typeof lineups): LineupPlayer[] {
        return (managerLineup ?? []).map((l) => ({
          player_name: l.player_name,
          slot: l.slot,
          points: Number(l.points),
          espn_id: l.espn_id,
          is_starter: l.is_starter,
          position: espnToPos.get(l.espn_id) ?? (statsByGsis.get(espnToGsis.get(l.espn_id) ?? "")?.position),
          headshot: espnToHeadshot.get(l.espn_id) ?? null,
          stats: statsByGsis.get(espnToGsis.get(l.espn_id) ?? "") ?? undefined,
        }));
      }

      const enrichedA = enrich((lineups ?? []).filter((l) => l.manager_id === a));
      const enrichedB = enrich((lineups ?? []).filter((l) => l.manager_id === b));

      // ── Bench analysis ──
      function markBench(lineup: LineupPlayer[]): LineupPlayer[] {
        const starters = lineup.filter((p) => p.is_starter);
        const starterBySlot = new Map(starters.map((p) => [p.slot, p]));

        return lineup.map((p) => {
          if (p.is_starter) return p;
          const pos = p.position ?? "";
          const eligibleSlots = ELIGIBLE_SLOTS[pos] ?? [];
          const shouldHaveStarted = eligibleSlots.some((slot) => {
            const starter = starterBySlot.get(slot);
            return starter && p.points > starter.points;
          });
          return { ...p, shouldHaveStarted };
        });
      }

      setLineupA(markBench(enrichedA));
      setLineupB(markBench(enrichedB));
      setLoading(false);
    }

    fetchData();
  }, [resolvedParams, searchParams]);

  if (loading || !resolvedParams) return <div className="text-text-muted text-center py-20">Lade Matchup...</div>;
  if (!matchup) return <div className="text-text-muted text-center py-20">Matchup nicht gefunden</div>;

  const season = parseInt(resolvedParams.season);
  const week = parseInt(resolvedParams.week);
  const aWon = matchup.score_a > matchup.score_b;

  // ── Position battle ──
  function getPositionBattle(la: LineupPlayer[], lb: LineupPlayer[]): { a: Record<string, boolean>; b: Record<string, boolean> } {
    const aWins: Record<string, boolean> = {};
    const bWins: Record<string, boolean> = {};
    for (const [group, slots] of Object.entries(POS_GROUPS)) {
      const totalA = la.filter((p) => p.is_starter && slots.includes(p.slot)).reduce((s, p) => s + p.points, 0);
      const totalB = lb.filter((p) => p.is_starter && slots.includes(p.slot)).reduce((s, p) => s + p.points, 0);
      aWins[group] = totalA > totalB;
      bWins[group] = totalB > totalA;
    }
    return { a: aWins, b: bWins };
  }

  const { a: posWinsA, b: posWinsB } = getPositionBattle(lineupA, lineupB);

  return (
    <div className="space-y-8">
      <Link href="/gamecenter" className="text-text-muted hover:text-ink text-sm transition-colors">← Gamecenter</Link>

      {/* Score header */}
      <div className="cell p-8">
        <div className="flex items-center justify-between text-center">
          <div className="flex-1">
            <div className="kicker mb-1">{aWon ? "Winner" : ""}</div>
            <div className={`display-title text-4xl md:text-5xl tracking-wider ${aWon ? "text-red" : "text-text-secondary"}`}>
              {matchup.manager_a}
            </div>
          </div>
          <div className="px-6">
            <div className="display-title text-3xl md:text-4xl tracking-wide">
              <span className={aWon ? "text-ink font-semibold" : "text-text-secondary"}>{matchup.score_a.toFixed(1)}</span>
              <span className="text-text-muted mx-3">–</span>
              <span className={!aWon ? "text-ink font-semibold" : "text-text-secondary"}>{matchup.score_b.toFixed(1)}</span>
            </div>
            <div className="kicker mt-2">{season} · Week {week}{matchup.is_playoff && " · Playoff"}</div>
          </div>
          <div className="flex-1">
            <div className="kicker mb-1">{!aWon ? "Winner" : ""}</div>
            <div className={`display-title text-4xl md:text-5xl tracking-wider ${!aWon ? "text-red" : "text-text-secondary"}`}>
              {matchup.manager_b}
            </div>
          </div>
        </div>
      </div>

      {/* Team stat bars */}
      {statsA && statsB && (
        <div className="flex flex-col sm:flex-row gap-4">
          <TeamStatBar stats={statsA} label={matchup.manager_a} won={aWon} />
          <TeamStatBar stats={statsB} label={matchup.manager_b} won={!aWon} />
        </div>
      )}

      {/* Lineups */}
      <div className="flex flex-col lg:flex-row gap-6">
        <LineupTable lineup={lineupA} label={matchup.manager_a} positionWins={posWinsA} />
        <div className="hidden lg:block w-px bg-border" />
        <LineupTable lineup={lineupB} label={matchup.manager_b} positionWins={posWinsB} reversed />
      </div>

      {/* H2H */}
      {h2h && (
        <H2HSection h2h={h2h} managerA={matchup.manager_a} managerB={matchup.manager_b} season={season} week={week} />
      )}
    </div>
  );
}
