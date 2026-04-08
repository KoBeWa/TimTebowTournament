"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { MANAGERS, type ManagerId } from "@/lib/constants";

interface H2HMatchup {
  season_year: number;
  week: number;
  myScore: number;
  theirScore: number;
  is_playoff: boolean;
}

export default function HeadToHeadPage() {
  const [m1, setM1] = useState<ManagerId>("Benni");
  const [m2, setM2] = useState<ManagerId>("Erik");
  const [matchups, setMatchups] = useState<H2HMatchup[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (m1 === m2) return;

    async function fetchH2H() {
      setLoading(true);

      // Matchups can be in either direction (manager_a/manager_b)
      const { data: asA } = await supabase
        .from("weekly_matchups").select("season_year, week, score_a, score_b, is_playoff")
        .eq("manager_a", m1).eq("manager_b", m2);

      const { data: asB } = await supabase
        .from("weekly_matchups").select("season_year, week, score_a, score_b, is_playoff")
        .eq("manager_a", m2).eq("manager_b", m1);

      const all: H2HMatchup[] = [
        ...(asA ?? []).map((m) => ({ season_year: m.season_year, week: m.week, myScore: Number(m.score_a), theirScore: Number(m.score_b), is_playoff: m.is_playoff })),
        ...(asB ?? []).map((m) => ({ season_year: m.season_year, week: m.week, myScore: Number(m.score_b), theirScore: Number(m.score_a), is_playoff: m.is_playoff })),
      ].sort((a, b) => a.season_year - b.season_year || a.week - b.week);

      setMatchups(all);
      setLoading(false);
    }
    fetchH2H();
  }, [m1, m2]);

  const wins = matchups.filter((m) => m.myScore > m.theirScore).length;
  const losses = matchups.filter((m) => m.myScore < m.theirScore).length;
  const ties = matchups.filter((m) => m.myScore === m.theirScore).length;

  const bySeason = matchups.reduce((acc, m) => {
    if (!acc[m.season_year]) acc[m.season_year] = [];
    acc[m.season_year].push(m);
    return acc;
  }, {} as Record<number, H2HMatchup[]>);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="page-header gold-gradient">Head to Head</h1>
        <p className="text-text-secondary mt-2">Wähle zwei Manager für den direkten Vergleich</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 items-center justify-center">
        <select value={m1} onChange={(e) => setM1(e.target.value as ManagerId)}
          className="bg-bg-card border border-border rounded-lg px-4 py-3 text-text-primary text-lg w-48 focus:border-gold focus:outline-none">
          {MANAGERS.map((m) => <option key={m} value={m} disabled={m === m2}>{m}</option>)}
        </select>
        <span className="text-3xl text-gold tracking-wider" style={{ fontFamily: '"Bebas Neue", Impact, sans-serif' }}>VS</span>
        <select value={m2} onChange={(e) => setM2(e.target.value as ManagerId)}
          className="bg-bg-card border border-border rounded-lg px-4 py-3 text-text-primary text-lg w-48 focus:border-gold focus:outline-none">
          {MANAGERS.map((m) => <option key={m} value={m} disabled={m === m1}>{m}</option>)}
        </select>
      </div>

      {m1 === m2 ? (
        <div className="text-text-muted text-center py-8">Bitte wähle zwei verschiedene Manager aus.</div>
      ) : loading ? (
        <div className="text-text-muted text-center py-12">Lade Daten...</div>
      ) : (
        <>
          <div className="card p-8 text-center">
            <div className="stat-label mb-4">Direkter Vergleich ({matchups.length} Matchups)</div>
            <div className="flex items-center justify-center gap-8">
              <div className="text-center">
                <div className={`text-4xl tracking-wider ${wins > losses ? "text-gold" : "text-text-secondary"}`} style={{ fontFamily: '"Bebas Neue", Impact, sans-serif' }}>{m1}</div>
                <div className="stat-value text-4xl text-accent-green mt-2">{wins}</div>
              </div>
              {ties > 0 && <div className="stat-value text-2xl text-text-muted">{ties}</div>}
              <span className="text-text-muted text-2xl">-</span>
              <div className="text-center">
                <div className={`text-4xl tracking-wider ${losses > wins ? "text-gold" : "text-text-secondary"}`} style={{ fontFamily: '"Bebas Neue", Impact, sans-serif' }}>{m2}</div>
                <div className="stat-value text-4xl text-accent-green mt-2">{losses}</div>
              </div>
            </div>
          </div>

          <section>
            <h2 className="section-header text-text-primary mb-4">Alle Matchups</h2>
            <div className="space-y-4">
              {Object.entries(bySeason).sort(([a], [b]) => Number(b) - Number(a)).map(([season, ms]) => (
                <div key={season}>
                  <div className="stat-label mb-2">{season}</div>
                  <div className="space-y-2">
                    {ms.map((m) => {
                      const won = m.myScore > m.theirScore;
                      return (
                        <div key={`${m.season_year}-${m.week}`} className="card p-4 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <span className="text-text-muted text-sm w-16">Week {m.week}</span>
                            {m.is_playoff && <span className="badge-gold">Playoff</span>}
                          </div>
                          <div className="flex items-center gap-3">
                            <span className={`font-mono ${won ? "text-accent-green font-semibold" : "text-text-secondary"}`}>{m.myScore.toFixed(1)}</span>
                            <span className="text-text-muted">-</span>
                            <span className={`font-mono ${!won ? "text-accent-green font-semibold" : "text-text-secondary"}`}>{m.theirScore.toFixed(1)}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
