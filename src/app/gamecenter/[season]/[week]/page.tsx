"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

interface LineupPlayer {
  player_name: string;
  slot: string;
  points: number;
  espn_id: string | null;
  is_starter: boolean;
  position?: string;
  stats?: Record<string, number>;
}

function StatLine({ player }: { player: LineupPlayer }) {
  const s = player.stats;
  if (!s) return null;

  // Für FLEX: echte Position nutzen, sonst den Slot
  const pos = player.slot === "FLEX" ? (player.position ?? "RB") : player.slot;

  if (pos === "QB") {
    return (
      <span className="text-text-muted text-xs">
        {s.completions}/{s.attempts}, {s.passing_yards} YDS, {s.passing_tds} TD
        {(s.passing_interceptions ?? 0) > 0 && `, ${s.passing_interceptions} INT`}
        {(s.carries ?? 0) > 0 && ` · ${s.carries} CAR, ${s.rushing_yards} YDS`}
        {(s.rushing_tds ?? 0) > 0 && `, ${s.rushing_tds} TD`}
      </span>
    );
  }

  if (pos.startsWith("RB")) {
    return (
      <span className="text-text-muted text-xs">
        {s.carries ?? 0} CAR, {s.rushing_yards ?? 0} YDS{(s.rushing_tds ?? 0) > 0 && `, ${s.rushing_tds} TD`}
        {(s.receptions ?? 0) > 0 && ` · ${s.receptions} REC, ${s.receiving_yards} YDS`}
        {(s.receiving_tds ?? 0) > 0 && `, ${s.receiving_tds} TD`}
      </span>
    );
  }

  if (pos.startsWith("WR") || pos === "TE") {
    return (
      <span className="text-text-muted text-xs">
        {s.receptions ?? 0}/{s.targets ?? 0} REC, {s.receiving_yards ?? 0} YDS
        {(s.receiving_tds ?? 0) > 0 && `, ${s.receiving_tds} TD`}
        {(s.carries ?? 0) > 0 && ` · ${s.carries} CAR, ${s.rushing_yards} YDS`}
      </span>
    );
  }

  if (pos === "K") {
    return (
      <span className="text-text-muted text-xs">
        FG {s.fg_made ?? 0}/{s.fg_att ?? 0} · PAT {s.pat_made ?? 0}/{s.pat_att ?? 0}
      </span>
    );
  }

  return null;
}

const SLOT_ORDER = ["QB", "RB", "WR", "TE", "W/R", "K", "DEF"];

function LineupTable({ lineup, label }: { lineup: LineupPlayer[]; label: string }) {
  const starters = lineup.filter((p) => p.is_starter).sort((a, b) => {
    const ai = SLOT_ORDER.indexOf(a.slot);
    const bi = SLOT_ORDER.indexOf(b.slot);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });

  const bench = lineup.filter((p) => !p.is_starter).sort((a, b) => Number(b.points) - Number(a.points));

  return (
    <div className="flex-1 min-w-0">
      <h3 className="text-2xl tracking-wide mb-4 text-text-primary" style={{ fontFamily: '"Bebas Neue", Impact, sans-serif' }}>
        {label}
      </h3>
      <div className="space-y-1">
        {starters.map((p, i) => (
          <div key={`${p.slot}-${i}`} className="flex items-center gap-3 p-3 rounded-lg bg-bg-card hover:bg-bg-card-hover transition-colors">
            <div className="w-10 text-center">
              <span className="text-xs font-semibold text-gold bg-gold/10 px-1.5 py-0.5 rounded">{p.slot}</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-text-primary truncate">{p.player_name}</div>
              <StatLine player={p} />
            </div>
            <div className="text-lg tracking-wide text-text-primary" style={{ fontFamily: '"Bebas Neue", Impact, sans-serif' }}>
              {Number(p.points).toFixed(1)}
            </div>
          </div>
        ))}
      </div>
      {bench.length > 0 && (
        <>
          <div className="stat-label mt-6 mb-2 px-3">Bench</div>
          <div className="space-y-1 opacity-60">
            {bench.map((p, i) => (
              <div key={`bench-${i}`} className="flex items-center gap-3 p-2 px-3 rounded-lg">
                <div className="w-10 text-center"><span className="text-xs text-text-muted">BN</span></div>
                <div className="flex-1 min-w-0">
                  <span className="text-sm text-text-secondary truncate">{p.player_name}</span>
                </div>
                <div className="text-sm text-text-muted font-mono">{Number(p.points).toFixed(1)}</div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default function MatchupDetailPage({ params }: { params: Promise<{ season: string; week: string }> }) {
  const searchParams = useSearchParams();
  const [resolvedParams, setResolvedParams] = useState<{ season: string; week: string } | null>(null);
  const [managerLineup, setManagerLineup] = useState<LineupPlayer[]>([]);
  const [opponentLineup, setOpponentLineup] = useState<LineupPlayer[]>([]);
  const [matchup, setMatchup] = useState<{ manager_a: string; manager_b: string; score_a: number; score_b: number; is_playoff: boolean } | null>(null);
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

      const { data: matchupData } = await supabase
        .from("weekly_matchups").select("*")
        .eq("season_year", season).eq("week", week)
        .eq("manager_a", a!).eq("manager_b", b!)
        .single();

      if (matchupData) {
        setMatchup({ ...matchupData, score_a: Number(matchupData.score_a), score_b: Number(matchupData.score_b) });
      }

      const { data: lineups } = await supabase
        .from("weekly_lineups").select("*")
        .eq("season_year", season).eq("week", week)
        .in("manager_id", [a!, b!]);

      const mLineup = lineups?.filter((l) => l.manager_id === a) ?? [];
      const oLineup = lineups?.filter((l) => l.manager_id === b) ?? [];

      // Get stats via espn_id -> players.gsis_id -> player_weekly_stats
      const espnIds = [...new Set([...mLineup, ...oLineup].map((l) => l.espn_id).filter(Boolean))];

      const { data: players } = espnIds.length
        ? await supabase.from("players").select("gsis_id, espn_id").in("espn_id", espnIds)
        : { data: [] };

      const espnToGsis = new Map(players?.map((p) => [p.espn_id, p.gsis_id]) ?? []);
      const gsisIds = [...new Set([...espnToGsis.values()].filter(Boolean))];

      const { data: stats } = gsisIds.length
        ? await supabase.from("player_weekly_stats").select("*").eq("season", season).eq("week", week).in("player_id", gsisIds)
        : { data: [] };

      const statsByGsis = new Map(stats?.map((s) => [s.player_id, s]) ?? []);

      function enrich(lineup: typeof mLineup): LineupPlayer[] {
        return lineup.map((l) => {
          const gsisId = espnToGsis.get(l.espn_id);
          const playerStats = gsisId ? statsByGsis.get(gsisId) : undefined;
          return {
            player_name: l.player_name,
            slot: l.slot,
            points: Number(l.points),
            espn_id: l.espn_id,
            is_starter: l.is_starter,
            position: playerStats?.position,
            stats: playerStats,
          };
        });
      }

      setManagerLineup(enrich(mLineup));
      setOpponentLineup(enrich(oLineup));
      setLoading(false);
    }
    fetchData();
  }, [resolvedParams, searchParams]);

  if (loading || !resolvedParams) return <div className="text-text-muted text-center py-20">Lade Matchup...</div>;
  if (!matchup) return <div className="text-text-muted text-center py-20">Matchup nicht gefunden</div>;

  const season = parseInt(resolvedParams.season);
  const week = parseInt(resolvedParams.week);
  const aWon = matchup.score_a > matchup.score_b;

  return (
    <div className="space-y-8">
      <Link href="/gamecenter" className="text-text-muted hover:text-text-primary text-sm transition-colors">← Gamecenter</Link>

      <div className="card p-8">
        <div className="flex items-center justify-between text-center">
          <div className="flex-1">
            <div className="stat-label mb-1">{aWon ? "Winner" : ""}</div>
            <div className={`text-4xl md:text-5xl tracking-wider ${aWon ? "text-gold" : "text-text-secondary"}`}
              style={{ fontFamily: '"Bebas Neue", Impact, sans-serif' }}>{matchup.manager_a}</div>
          </div>
          <div className="px-6">
            <div className="text-3xl md:text-4xl tracking-wide" style={{ fontFamily: '"Bebas Neue", Impact, sans-serif' }}>
              <span className={aWon ? "text-accent-green" : "text-text-secondary"}>{matchup.score_a.toFixed(1)}</span>
              <span className="text-text-muted mx-3">-</span>
              <span className={!aWon ? "text-accent-green" : "text-text-secondary"}>{matchup.score_b.toFixed(1)}</span>
            </div>
            <div className="stat-label mt-2">{season} · Week {week}{matchup.is_playoff && " · Playoff"}</div>
          </div>
          <div className="flex-1">
            <div className="stat-label mb-1">{!aWon ? "Winner" : ""}</div>
            <div className={`text-4xl md:text-5xl tracking-wider ${!aWon ? "text-gold" : "text-text-secondary"}`}
              style={{ fontFamily: '"Bebas Neue", Impact, sans-serif' }}>{matchup.manager_b}</div>
          </div>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        <LineupTable lineup={managerLineup} label={matchup.manager_a} />
        <div className="hidden lg:block w-px bg-border" />
        <LineupTable lineup={opponentLineup} label={matchup.manager_b} />
      </div>
    </div>
  );
}
