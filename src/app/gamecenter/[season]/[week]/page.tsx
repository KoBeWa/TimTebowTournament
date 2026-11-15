"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { MANAGER_COLORS } from "@/lib/constants";
import PageHeader from "@/components/ui/PageHeader";
import Tabs from "@/components/ui/Tabs";
import ManagerName from "@/components/ui/ManagerName";
import ScoreTimeline from "./ScoreTimeline";

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

type TabKey = "lineups" | "verlauf" | "vergleich";
const TABS: { key: TabKey; label: string }[] = [
  { key: "lineups", label: "Lineups" },
  { key: "verlauf", label: "Spielverlauf" },
  { key: "vergleich", label: "Vergleich" },
];

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
      {(s.carries ?? 0) > 0 && `; ${s.carries} CAR, ${s.rushing_yards} YDS`}
      {(s.rushing_tds ?? 0) > 0 && `, ${s.rushing_tds} TD`}
    </span>
  );

  if (pos === "RB") return (
    <span className="text-text-muted text-xs">
      {s.carries ?? 0} CAR, {s.rushing_yards ?? 0} YDS{(s.rushing_tds ?? 0) > 0 && `, ${s.rushing_tds} TD`}
      {(s.receptions ?? 0) > 0 && `; ${s.receptions} REC, ${s.receiving_yards} YDS`}
      {(s.receiving_tds ?? 0) > 0 && `, ${s.receiving_tds} TD`}
    </span>
  );

  if (pos === "WR" || pos === "TE") return (
    <span className="text-text-muted text-xs">
      {s.receptions ?? 0}/{s.targets ?? 0} REC, {s.receiving_yards ?? 0} YDS
      {(s.receiving_tds ?? 0) > 0 && `, ${s.receiving_tds} TD`}
      {(s.carries ?? 0) > 0 && `; ${s.carries} CAR, ${s.rushing_yards} YDS`}
    </span>
  );

  if (pos === "K") return (
    <span className="text-text-muted text-xs">
      FG {s.fg_made ?? 0}/{s.fg_att ?? 0}, PAT {s.pat_made ?? 0}/{s.pat_att ?? 0}
    </span>
  );

  return null;
}

// ─── Lineup table ─────────────────────────────────────────────────────────────

function LineupTable({
  lineup, managerId, positionWins,
}: {
  lineup: LineupPlayer[];
  managerId: string;
  positionWins: Record<string, boolean>; // pos group → did this team win the position battle?
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

  const total = starters.reduce((sum, p) => sum + p.points, 0);

  return (
    <div className="min-w-0 flex-1">
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <h3 className="text-base font-semibold text-ink">
          <ManagerName id={managerId} />
        </h3>
        <span className="text-sm tabular-nums text-text-muted">{total.toFixed(1)} Punkte</span>
      </div>
      <div className="cell overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs font-medium text-text-muted">
              <th className="py-2.5 pl-4 pr-2 font-medium sm:pl-5">Slot</th>
              <th className="px-2 py-2.5 font-medium">Spieler</th>
              <th className="hidden px-2 py-2.5 font-medium md:table-cell">Statistik</th>
              <th className="py-2.5 pl-2 pr-4 text-right font-medium sm:pr-5">Punkte</th>
            </tr>
          </thead>
          <tbody>
            {starters.map((p) => {
              // Position group for this slot (e.g. RB1 → "RB")
              const posGroup = Object.entries(POS_GROUPS).find(([, slots]) => slots.includes(p.slot))?.[0] ?? p.slot;
              const wonBattle = positionWins[posGroup] === true;
              return (
                <tr key={p.slot} className="border-t border-border-light">
                  <td className="py-2 pl-4 pr-2 text-xs font-semibold text-red sm:pl-5">{slotLabel(p.slot)}</td>
                  <td className="px-2 py-2">
                    <div className="flex items-center gap-3">
                      <div className="hidden h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-border-light md:flex">
                        {p.headshot ? (
                          <img
                            src={p.headshot}
                            alt={p.player_name}
                            width={36}
                            height={36}
                            className="h-full w-full object-cover object-top"
                            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                          />
                        ) : (
                          <span className="text-xs font-semibold text-text-faint">
                            {p.player_name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                          </span>
                        )}
                      </div>
                      <span className="truncate font-medium text-ink">{p.player_name}</span>
                    </div>
                  </td>
                  <td className="hidden px-2 py-2 md:table-cell"><StatLine player={p} /></td>
                  <td className="whitespace-nowrap py-2 pl-2 pr-4 text-right tabular-nums text-ink sm:pr-5">
                    <span className="font-semibold">{p.points.toFixed(1)}</span>
                    {wonBattle && (
                      <span className="ml-2 inline-block h-1.5 w-1.5 rounded-full bg-positive align-middle" title="Position-Battle gewonnen" />
                    )}
                  </td>
                </tr>
              );
            })}
            {bench.length > 0 && (
              <tr className="border-t border-border bg-surface-2">
                <td colSpan={4} className="py-1.5 pl-4 pr-4 text-xs font-medium text-text-muted sm:pl-5">Bank</td>
              </tr>
            )}
            {bench.map((p, i) => (
              <tr key={`bench-${i}`} className={`border-t border-border-light ${p.shouldHaveStarted ? "" : "opacity-60"}`}>
                <td className="py-2 pl-4 pr-2 text-xs text-text-muted sm:pl-5">BN</td>
                <td className="px-2 py-2">
                  <span className={`truncate ${p.shouldHaveStarted ? "font-medium text-ink" : "text-text-secondary"}`}>{p.player_name}</span>
                  {p.shouldHaveStarted && <span className="ml-2 text-xs text-negative">hätte starten sollen</span>}
                </td>
                <td className="hidden px-2 py-2 md:table-cell"><StatLine player={p} /></td>
                <td className={`py-2 pl-2 pr-4 text-right tabular-nums sm:pr-5 ${p.shouldHaveStarted ? "font-semibold text-ink" : "text-text-muted"}`}>
                  {p.points.toFixed(1)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Team stat card ───────────────────────────────────────────────────────────

function TeamStatBar({ stats, managerId, won }: { stats: TeamWeekStats; managerId: string; won: boolean }) {
  const signPct = (n: number) => (n >= 0 ? "+" : "") + n.toFixed(1) + "%";
  const sign = (n: number) => (n >= 0 ? "+" : "") + n.toFixed(2);
  const color = MANAGER_COLORS[managerId] ?? "var(--color-border-strong)";

  const items = [
    { label: "Punkteanteil", value: `${stats.pts_share_pct.toFixed(1)}%` },
    { label: "Wochenrang", value: `#${stats.pts_rank}` },
    { label: "vs Team Ø", value: signPct(stats.pts_vs_team_avg_pct) },
    { label: "vs Liga Ø", value: signPct(stats.pts_vs_league_avg_pct) },
    { label: "Luck", value: stats.luck !== null ? sign(stats.luck) : "–" },
    { label: "Coach-Rang", value: stats.coach_rank !== null ? `#${stats.coach_rank}` : "–" },
    { label: "Coach-Score", value: stats.coach_score !== null ? stats.coach_score.toFixed(1) : "–" },
  ];

  return (
    <div className="cell flex-1 overflow-hidden" style={{ boxShadow: `inset 0 3px 0 ${color}` }}>
      <div className={`px-4 pb-1 pt-3 text-base sm:px-5 ${won ? "font-semibold text-ink" : "text-text-secondary"}`}>
        <ManagerName id={managerId} plain />
      </div>
      <dl>
        {items.map((item) => (
          <div key={item.label} className="flex justify-between gap-2 border-t border-border-light px-4 py-2 text-sm sm:px-5">
            <dt className="text-text-muted">{item.label}</dt>
            <dd className="font-medium tabular-nums text-ink">{item.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

// ─── H2H section ──────────────────────────────────────────────────────────────

function H2HSection({ h2h, managerA, managerB }: {
  h2h: H2HData;
  managerA: string;
  managerB: string;
}) {
  const margin = h2h.avgNetMarginForA;
  const favoredA = margin >= 0;
  return (
    <section>
      <h2 className="section-title mb-4 text-ink">Direkter Vergleich</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="cell p-4">
          <div className="text-xs text-text-muted">Bilanz gesamt</div>
          <div className="display-title mt-1 text-xl tabular-nums text-ink">{h2h.record}</div>
          <div className="mt-0.5 text-xs text-text-muted">{managerA} gegen {managerB}</div>
        </div>
        <div className="cell p-4">
          <div className="text-xs text-text-muted">Aktuelle Serie</div>
          <div className="display-title mt-1 text-xl tabular-nums text-ink">{h2h.winnerStreak}×</div>
          <div className="mt-0.5 text-xs text-text-muted">{h2h.winner}</div>
        </div>
        <div className="cell p-4">
          <div className="text-xs text-text-muted">Ø Punktedifferenz</div>
          <div className={`display-title mt-1 text-xl tabular-nums ${favoredA ? "text-ink" : "text-text-secondary"}`}>
            {favoredA ? "+" : ""}{Math.abs(margin).toFixed(1)}
          </div>
          <div className="mt-0.5 text-xs text-text-muted">zugunsten {favoredA ? managerA : managerB}</div>
        </div>
        {h2h.prevMatchup && (
          <Link
            href={`/gamecenter/${h2h.prevMatchup.season}/${h2h.prevMatchup.week}?a=${managerA}&b=${managerB}`}
            className="cell group p-4 transition-colors hover:bg-surface-2"
          >
            <div className="text-xs text-text-muted">Letztes Aufeinandertreffen</div>
            <div className="display-title mt-1 text-xl tabular-nums text-ink group-hover:text-red transition-colors">
              {h2h.prevMatchup.scoreA.toFixed(1)} – {h2h.prevMatchup.scoreB.toFixed(1)}
            </div>
            <div className="mt-0.5 text-xs text-text-muted">
              Saison {h2h.prevMatchup.season}, Woche {h2h.prevMatchup.week}
            </div>
          </Link>
        )}
      </div>
    </section>
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
  const [tab, setTab] = useState<TabKey>("lineups");

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

  const color = (id: string) => MANAGER_COLORS[id] ?? "var(--color-border-strong)";

  return (
    <div>
      <PageHeader
        crumbs={[{ label: "Gamecenter", href: "/gamecenter" }]}
        title={`${matchup.manager_a} vs ${matchup.manager_b}`}
        description={`Saison ${season}, Woche ${week}${matchup.is_playoff ? ", Playoff" : ""}`}
      />

      {/* Score header */}
      <div className="cell mb-6 overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-4 py-6 text-center sm:px-8 sm:py-8">
          <div className="min-w-0 flex-1">
            <div className={`display-title truncate text-2xl sm:text-4xl ${aWon ? "text-ink" : "text-text-muted"}`}>{matchup.manager_a}</div>
            {aWon && <div className="mt-1 text-xs text-text-muted">Sieger</div>}
          </div>
          <div className="display-title shrink-0 whitespace-nowrap text-3xl tabular-nums sm:text-5xl">
            <span className={aWon ? "text-ink" : "text-text-faint"}>{matchup.score_a.toFixed(1)}</span>
            <span className="mx-2 text-text-faint sm:mx-3">–</span>
            <span className={!aWon ? "text-ink" : "text-text-faint"}>{matchup.score_b.toFixed(1)}</span>
          </div>
          <div className="min-w-0 flex-1">
            <div className={`display-title truncate text-2xl sm:text-4xl ${!aWon ? "text-ink" : "text-text-muted"}`}>{matchup.manager_b}</div>
            {!aWon && <div className="mt-1 text-xs text-text-muted">Sieger</div>}
          </div>
        </div>
        <div className="flex h-1">
          <div className="flex-1" style={{ backgroundColor: color(matchup.manager_a) }} />
          <div className="flex-1" style={{ backgroundColor: color(matchup.manager_b) }} />
        </div>
      </div>

      <div className="mb-6">
        <Tabs tabs={TABS} value={tab} onChange={setTab} label="Ansicht" />
      </div>

      {tab === "lineups" && (
        <div className="flex flex-col gap-6 lg:flex-row">
          <LineupTable lineup={lineupA} managerId={matchup.manager_a} positionWins={posWinsA} />
          <LineupTable lineup={lineupB} managerId={matchup.manager_b} positionWins={posWinsB} />
        </div>
      )}

      {tab === "verlauf" && (
        <ScoreTimeline season={season} week={week} managerA={matchup.manager_a} managerB={matchup.manager_b} />
      )}

      {tab === "vergleich" && (
        <div className="space-y-8">
          {statsA && statsB && (
            <div className="flex flex-col gap-4 sm:flex-row">
              <TeamStatBar stats={statsA} managerId={matchup.manager_a} won={aWon} />
              <TeamStatBar stats={statsB} managerId={matchup.manager_b} won={!aWon} />
            </div>
          )}
          {h2h && <H2HSection h2h={h2h} managerA={matchup.manager_a} managerB={matchup.manager_b} />}
        </div>
      )}
    </div>
  );
}
