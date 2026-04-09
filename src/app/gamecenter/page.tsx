"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { SEASONS } from "@/lib/constants";
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

export default function GamecenterPage() {
  const [season, setSeason] = useState(SEASONS[SEASONS.length - 1]);
  const [week, setWeek] = useState(1);
  const [matchups, setMatchups] = useState<Matchup[]>([]);
  const [maxWeek, setMaxWeek] = useState(16);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchMaxWeek() {
      const { data } = await supabase
        .from("weekly_matchups")
        .select("week")
        .eq("season_year", season)
        .order("week", { ascending: false })
        .limit(1);
      if (data?.[0]) {
        setMaxWeek(data[0].week);
        setWeek(1);
      }
    }
    fetchMaxWeek();
  }, [season]);

  useEffect(() => {
    async function fetchMatchups() {
      setLoading(true);
      const { data } = await supabase
        .from("weekly_matchups")
        .select("*")
        .eq("season_year", season)
        .eq("week", week);
      setMatchups((data ?? []).map((m) => ({ ...m, score_a: Number(m.score_a), score_b: Number(m.score_b) })));
      setLoading(false);
    }
    fetchMatchups();
  }, [season, week]);

  const weeks = Array.from({ length: maxWeek }, (_, i) => i + 1);

  return (
    <div className="space-y-8">
      <div>
        <div className="kicker">Gamecenter</div>
        <h1 className="display-title text-4xl md:text-5xl text-ink">Gamecenter</h1>
        <p className="text-text-secondary mt-2">Jedes Matchup, jeder Punkt, jede Woche</p>
      </div>

      {/* Selectors */}
      <div className="flex flex-wrap gap-4">
        <div>
          <label className="stat-label block mb-2">Season</label>
          <div className="flex flex-wrap gap-1">
            {SEASONS.map((s) => (
              <button key={s} onClick={() => setSeason(s)}
                className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${s === season ? "bg-gold text-bg-primary font-semibold" : "bg-cream text-text-secondary hover:text-ink border border-border"}`}>
                {s}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="stat-label block mb-2">Week</label>
          <div className="flex flex-wrap gap-1">
            {weeks.map((w) => (
              <button key={w} onClick={() => setWeek(w)}
                className={`w-10 h-9 text-sm rounded-lg transition-colors ${w === week ? "bg-gold text-bg-primary font-semibold" : "bg-cream text-text-secondary hover:text-ink border border-border"}`}>
                {w}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Matchup Cards */}
      {loading ? (
        <div className="text-text-muted text-center py-12">Lade Matchups...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {matchups.map((m) => {
            const aWon = m.score_a > m.score_b;
            return (
              <Link
                key={`${m.manager_a}-${m.manager_b}`}
                href={`/gamecenter/${season}/${week}?a=${m.manager_a}&b=${m.manager_b}`}
                className="cell-hover p-5 group"
              >
                {m.is_playoff && <div className="label-nav text-xs text-ink border border-border px-2 py-0.5 mb-3">Playoff</div>}
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className={`display-title text-xl tracking-wide ${aWon ? "text-ink" : "text-text-secondary"}`}>
                      {m.manager_a}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 px-4">
                    <span className={`display-title text-2xl tracking-wide ${aWon ? "text-ink font-semibold" : "text-text-secondary"}`}>
                      {m.score_a.toFixed(1)}
                    </span>
                    <span className="text-text-muted text-sm">vs</span>
                    <span className={`display-title text-2xl tracking-wide ${!aWon ? "text-ink font-semibold" : "text-text-secondary"}`}>
                      {m.score_b.toFixed(1)}
                    </span>
                  </div>
                  <div className="flex-1 text-right">
                    <div className={`display-title text-xl tracking-wide ${!aWon ? "text-ink" : "text-text-secondary"}`}>
                      {m.manager_b}
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
