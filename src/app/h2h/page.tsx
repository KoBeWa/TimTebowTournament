"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { MANAGERS, type ManagerId } from "@/lib/constants";
import {
  benchStats, overallAverage, record, recordGames, resultOf, rivalryKillers, scoring,
  sideSwitchers, streaks, topPerformances,
  type H2HMatchup, type LineupRow, type PairRecord,
} from "./stats";

const fmt = (n: number) => n.toFixed(1);
const when = (m: { season_year: number; week: number }) => `${m.season_year} · W${m.week}`;

export default function HeadToHeadPage() {
  const [m1, setM1] = useState<ManagerId>("Benni");
  const [m2, setM2] = useState<ManagerId>("Erik");
  const [pairs, setPairs] = useState<PairRecord[]>([]);
  const [matchups, setMatchups] = useState<H2HMatchup[]>([]);
  const [lineups, setLineups] = useState<LineupRow[]>([]);
  const [loading, setLoading] = useState(false);

  // League-wide records of every pairing (for the matrix and own averages)
  useEffect(() => {
    supabase
      .from("v_head_to_head")
      .select("manager_id, opponent_id, total_games, wins, losses, ties, avg_score_for")
      .then(({ data }) => setPairs((data ?? []).map((r) => ({
        ...r,
        total_games: Number(r.total_games), wins: Number(r.wins), losses: Number(r.losses),
        ties: Number(r.ties), avg_score_for: Number(r.avg_score_for),
      }))));
  }, []);

  useEffect(() => {
    if (m1 === m2) return;

    async function fetchH2H() {
      setLoading(true);
      const pairFilter = `and(manager_id.eq.${m1},opponent_id.eq.${m2}),and(manager_id.eq.${m2},opponent_id.eq.${m1})`;
      const lineupQuery = (from: number) => supabase
        .from("v_h2h_lineups")
        .select("season_year, week, manager_id, slot, player_name, points, is_starter")
        .or(pairFilter)
        .order("season_year").order("week").order("manager_id").order("slot")
        .range(from, from + 999);

      // Matchups can be in either direction (manager_a/manager_b)
      const [{ data: asA }, { data: asB }, l1, l2] = await Promise.all([
        supabase.from("weekly_matchups").select("season_year, week, score_a, score_b, is_playoff")
          .eq("manager_a", m1).eq("manager_b", m2),
        supabase.from("weekly_matchups").select("season_year, week, score_a, score_b, is_playoff")
          .eq("manager_a", m2).eq("manager_b", m1),
        lineupQuery(0),
        lineupQuery(1000),
      ]);

      const all: H2HMatchup[] = [
        ...(asA ?? []).map((m) => ({ season_year: m.season_year, week: m.week, myScore: Number(m.score_a), theirScore: Number(m.score_b), is_playoff: m.is_playoff })),
        ...(asB ?? []).map((m) => ({ season_year: m.season_year, week: m.week, myScore: Number(m.score_b), theirScore: Number(m.score_a), is_playoff: m.is_playoff })),
      ].sort((a, b) => a.season_year - b.season_year || a.week - b.week);

      setMatchups(all);
      setLineups([...(l1.data ?? []), ...(l2.data ?? [])].map((r) => ({ ...r, points: Number(r.points) })));
      setLoading(false);
    }
    fetchH2H();
  }, [m1, m2]);

  const { wins, losses, ties } = record(matchups);
  const reg = record(matchups.filter((m) => !m.is_playoff));
  const po = record(matchups.filter((m) => m.is_playoff));
  const sc = scoring(matchups);
  const st = streaks(matchups);
  const games = recordGames(matchups);
  const avg1 = overallAverage(pairs, m1);
  const avg2 = overallAverage(pairs, m2);

  const players = useMemo(() => ({
    top: topPerformances(lineups),
    killers1: rivalryKillers(lineups, m1),
    killers2: rivalryKillers(lineups, m2),
    switchers: sideSwitchers(lineups, m1, m2),
    bench1: benchStats(lineups, m1),
    bench2: benchStats(lineups, m2),
  }), [lineups, m1, m2]);

  const bySeason = matchups.reduce((acc, m) => {
    (acc[m.season_year] ??= []).push(m);
    return acc;
  }, {} as Record<number, H2HMatchup[]>);
  const seasons = Object.keys(bySeason).map(Number).sort((a, b) => a - b);

  const nameOf = (side: "me" | "them") => (side === "me" ? m1 : m2);
  const lastFive = matchups.slice(-5);

  return (
    <div className="space-y-8">
      <div>
        <div className="kicker">Rivalitäten</div>
        <h1 className="display-title text-4xl md:text-5xl text-ink">Head to Head</h1>
        <p className="text-text-secondary mt-2">Wähle zwei Manager für den direkten Vergleich, oder klick ein Feld in der Matrix</p>
      </div>

      <LeagueMatrix pairs={pairs} m1={m1} m2={m2} onSelect={(a, b) => { setM1(a); setM2(b); }} />

      <div className="flex flex-col sm:flex-row gap-4 items-center justify-center">
        <select value={m1} onChange={(e) => setM1(e.target.value as ManagerId)}
          className="bg-surface border border-border rounded-xl px-4 py-3 text-ink text-lg w-full sm:w-52 focus:border-red focus:outline-none">
          {MANAGERS.map((m) => <option key={m} value={m} disabled={m === m2}>{m}</option>)}
        </select>
        <span className="text-3xl text-red tracking-wider display-title">VS</span>
        <select value={m2} onChange={(e) => setM2(e.target.value as ManagerId)}
          className="bg-surface border border-border rounded-xl px-4 py-3 text-ink text-lg w-full sm:w-52 focus:border-red focus:outline-none">
          {MANAGERS.map((m) => <option key={m} value={m} disabled={m === m1}>{m}</option>)}
        </select>
      </div>

      {m1 === m2 ? (
        <div className="text-text-muted text-center py-8">Bitte wähle zwei verschiedene Manager aus.</div>
      ) : loading ? (
        <div className="text-text-muted text-center py-12">Lade Daten...</div>
      ) : (
        <>
          <div className="cell p-6 sm:p-8">
            <div className="kicker mb-5 text-center">Direkter Vergleich · {matchups.length} Matchups</div>
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
              <div className="text-right">
                <div className={`display-title text-3xl sm:text-5xl uppercase ${wins > losses ? "text-ink" : "text-text-muted"}`}>{m1}</div>
                <div className="text-sm text-text-muted mt-1">{wins > losses ? "führt" : wins === losses ? "ausgeglichen" : "liegt hinten"}</div>
              </div>
              <div className="display-title text-4xl sm:text-6xl text-ink tabular-nums">
                {wins}<span className="text-text-faint mx-2">–</span>{losses}
                {ties > 0 && <span className="text-text-muted text-2xl ml-2">({ties} T)</span>}
              </div>
              <div>
                <div className={`display-title text-3xl sm:text-5xl uppercase ${losses > wins ? "text-ink" : "text-text-muted"}`}>{m2}</div>
                <div className="text-sm text-text-muted mt-1">{losses > wins ? "führt" : wins === losses ? "ausgeglichen" : "liegt hinten"}</div>
              </div>
            </div>
            {matchups.length > 0 && (
              <>
                <div className="mt-6 flex h-2.5 overflow-hidden rounded-full bg-surface-3">
                  <div className="bg-red" style={{ width: `${(wins / matchups.length) * 100}%` }} />
                  <div className="bg-text-faint" style={{ width: `${(ties / matchups.length) * 100}%` }} />
                  <div className="bg-accent-blue" style={{ width: `${(losses / matchups.length) * 100}%` }} />
                </div>
                <div className="mt-5 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-text-secondary">
                  <span>Regular Season <b className="text-ink tabular-nums">{reg.wins}–{reg.losses}</b></span>
                  <span>Playoffs <b className="text-ink tabular-nums">{po.wins}–{po.losses}</b></span>
                  <span className="flex items-center gap-1.5">
                    Letzte 5
                    {lastFive.map((m) => {
                      const r = resultOf(m);
                      return (
                        <span key={`${m.season_year}-${m.week}`} title={when(m)}
                          className={`h-2.5 w-2.5 rounded-full ${r === "me" ? "bg-red" : r === "them" ? "bg-accent-blue" : "bg-text-faint"}`} />
                      );
                    })}
                  </span>
                </div>
              </>
            )}
          </div>

          {matchups.length > 0 && games && (
            <>
              <section>
                <h2 className="section-title text-ink mb-4">Matchup-Stats</h2>
                <div className="cell overflow-hidden">
                  <CompareRow label="Ø Punkte" a={fmt(sc.avgMe)} b={fmt(sc.avgThem)} aWins={sc.avgMe > sc.avgThem} bWins={sc.avgThem > sc.avgMe} />
                  <CompareRow label="Ø vs. eigener Schnitt"
                    a={`${sc.avgMe - avg1 >= 0 ? "+" : ""}${fmt(sc.avgMe - avg1)}`}
                    b={`${sc.avgThem - avg2 >= 0 ? "+" : ""}${fmt(sc.avgThem - avg2)}`}
                    hint="Punkte in diesem Duell minus eigener Karriere-Schnitt" />
                  <CompareRow label="Höchster Score" a={fmt(sc.maxMe)} b={fmt(sc.maxThem)} aWins={sc.maxMe > sc.maxThem} bWins={sc.maxThem > sc.maxMe} />
                  <CompareRow label="Längste Siegesserie" a={`${st.longest.me}`} b={`${st.longest.them}`}
                    aWins={st.longest.me > st.longest.them} bWins={st.longest.them > st.longest.me} />
                  <CompareRow label="Bankpunkte gesamt" a={fmt(players.bench1.total)} b={fmt(players.bench2.total)}
                    hint="Punkte, die auf der Bank liegen geblieben sind" />
                  <div className="flex flex-wrap justify-between gap-2 px-4 sm:px-5 py-3 text-sm text-text-secondary">
                    <span>Ø Abstand <b className="text-ink">{fmt(sc.avgMargin)}</b></span>
                    {st.current.side && st.current.side !== "tie" && (
                      <span>Aktuelle Serie: <b className="text-ink">{nameOf(st.current.side)}</b> {st.current.length} Sieg{st.current.length > 1 ? "e" : ""} in Folge</span>
                    )}
                  </div>
                </div>
              </section>

              <section>
                <h2 className="section-title text-ink mb-4">Rekordspiele</h2>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {games.biggestMe && <GameCard title={`Höchster Sieg ${m1}`} m={games.biggestMe} m1={m1} m2={m2} />}
                  {games.biggestThem && <GameCard title={`Höchster Sieg ${m2}`} m={games.biggestThem} m1={m1} m2={m2} />}
                  <GameCard title="Knappstes Spiel" m={games.closest} m1={m1} m2={m2} />
                  <GameCard title="Meiste Punkte zusammen" m={games.highest} m1={m1} m2={m2} />
                  <GameCard title="Wenigste Punkte zusammen" m={games.lowest} m1={m1} m2={m2} />
                </div>
              </section>

              <section>
                <h2 className="section-title text-ink mb-4">Bilanz pro Saison</h2>
                <div className="flex flex-wrap gap-2">
                  {seasons.map((s) => {
                    const r = record(bySeason[s]);
                    const lead = r.wins > r.losses ? "border-red/60" : r.losses > r.wins ? "border-accent-blue/60" : "border-border";
                    return (
                      <div key={s} className={`rounded-xl border ${lead} bg-surface px-3 py-2 text-center`}>
                        <div className="kicker">{s}</div>
                        <div className="font-mono text-sm text-ink tabular-nums">{r.wins}–{r.losses}{r.ties ? `–${r.ties}` : ""}</div>
                      </div>
                    );
                  })}
                </div>
              </section>

              <section>
                <h2 className="section-title text-ink mb-4">Besondere Spieler</h2>
                <div className="grid gap-4 lg:grid-cols-3">
                  <div className="cell p-4 sm:p-5">
                    <div className="kicker mb-3">Top-Einzelleistungen</div>
                    <ol className="space-y-2">
                      {players.top.map((p, i) => (
                        <li key={`${p.player}-${p.season_year}-${p.week}`} className="flex items-baseline gap-3 text-sm">
                          <span className="w-4 text-text-faint">{i + 1}</span>
                          <span className="flex-1 min-w-0">
                            <span className="text-ink font-medium">{p.player}</span>
                            <span className="block text-xs text-text-muted">{p.manager} · {when(p)}</span>
                          </span>
                          <span className="font-mono text-ink">{fmt(p.points)}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                  {[{ m: m1, list: players.killers1 }, { m: m2, list: players.killers2 }].map(({ m, list }) => (
                    <div key={m} className="cell p-4 sm:p-5">
                      <div className="kicker mb-3">Rivalen-Killer · {m}</div>
                      <ol className="space-y-2">
                        {list.map((p) => (
                          <li key={p.player} className="flex items-baseline gap-3 text-sm">
                            <span className="flex-1 min-w-0">
                              <span className="text-ink font-medium">{p.player}</span>
                              <span className="block text-xs text-text-muted">{p.games} Spiele · Ø {fmt(p.points / p.games)} · Best {fmt(p.best)}</span>
                            </span>
                            <span className="font-mono text-ink">{fmt(p.points)}</span>
                          </li>
                        ))}
                      </ol>
                    </div>
                  ))}
                </div>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <div className="cell p-4 sm:p-5">
                    <div className="kicker mb-2">Seitenwechsler</div>
                    {players.switchers.length ? (
                      <>
                        <p className="text-sm text-text-secondary mb-3">
                          {players.switchers.length} Spieler haben in diesem Duell schon für beide gestartet
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {players.switchers.slice(0, 10).map((p) => <span key={p} className="chip">{p}</span>)}
                          {players.switchers.length > 10 && (
                            <span className="chip" title={players.switchers.slice(10).join(", ")}>
                              +{players.switchers.length - 10} weitere
                            </span>
                          )}
                        </div>
                      </>
                    ) : (
                      <p className="text-sm text-text-secondary">Kein Spieler hat in diesem Duell für beide Seiten gestartet.</p>
                    )}
                  </div>
                  <div className="cell p-4 sm:p-5">
                    <div className="kicker mb-2">Bester Bankdrücker</div>
                    <div className="space-y-1 text-sm text-text-secondary">
                      {[{ m: m1, b: players.bench1.best }, { m: m2, b: players.bench2.best }].map(({ m, b }) => b && (
                        <div key={m}>
                          <span className="text-ink">{m}</span>: {b.player_name} mit <b className="text-ink">{fmt(b.points)}</b> auf der Bank ({when(b)})
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </section>
            </>
          )}

          <section>
            <h2 className="section-title text-ink mb-4">Alle Matchups</h2>
            <div className="space-y-4">
              {[...seasons].reverse().map((season) => (
                <div key={season}>
                  <div className="kicker mb-2">{season}</div>
                  <div className="space-y-2">
                    {bySeason[season].map((m) => {
                      const won = m.myScore > m.theirScore;
                      const tied = m.myScore === m.theirScore;
                      return (
                        <div
                          key={`${m.season_year}-${m.week}`}
                          className={`cell px-4 py-3 flex items-center justify-between border-l-4 ${tied ? "border-l-text-faint" : won ? "border-l-red" : "border-l-accent-blue"}`}
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-text-muted text-sm w-16">Week {m.week}</span>
                            <span className="text-sm font-medium text-ink">{tied ? "Unentschieden" : `${won ? m1 : m2} gewinnt`}</span>
                            {m.is_playoff && <span className="chip">Playoff</span>}
                          </div>
                          <div className="flex items-center gap-3">
                            <span className={`font-mono ${won ? "text-ink font-semibold" : "text-text-secondary"}`}>{m.myScore.toFixed(1)}</span>
                            <span className="text-text-muted">-</span>
                            <span className={`font-mono ${!won ? "text-ink font-semibold" : "text-text-secondary"}`}>{m.theirScore.toFixed(1)}</span>
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

function CompareRow({ label, a, b, aWins, bWins, hint }: {
  label: string; a: string; b: string; aWins?: boolean; bWins?: boolean; hint?: string;
}) {
  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 border-b border-border-light px-4 sm:px-5 py-3">
      <span className={`text-right font-mono tabular-nums ${aWins ? "text-ink font-semibold" : "text-text-secondary"}`}>{a}</span>
      <span className="kicker text-center min-w-[9rem]" title={hint}>{label}</span>
      <span className={`font-mono tabular-nums ${bWins ? "text-ink font-semibold" : "text-text-secondary"}`}>{b}</span>
    </div>
  );
}

function GameCard({ title, m, m1, m2 }: { title: string; m: H2HMatchup; m1: string; m2: string }) {
  const r = resultOf(m);
  return (
    <div className="cell p-4">
      <div className="kicker mb-2">{title}</div>
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-mono text-lg tabular-nums">
          <span className={r === "me" ? "text-ink font-semibold" : "text-text-secondary"}>{fmt(m.myScore)}</span>
          <span className="text-text-faint mx-1.5">–</span>
          <span className={r === "them" ? "text-ink font-semibold" : "text-text-secondary"}>{fmt(m.theirScore)}</span>
        </span>
        <span className="text-xs text-text-muted">{when(m)}{m.is_playoff ? " · Playoff" : ""}</span>
      </div>
      <div className="mt-1 text-xs text-text-muted">{m1} vs {m2} · Abstand {fmt(Math.abs(m.myScore - m.theirScore))}</div>
    </div>
  );
}

function LeagueMatrix({ pairs, m1, m2, onSelect }: {
  pairs: PairRecord[]; m1: string; m2: string; onSelect: (a: ManagerId, b: ManagerId) => void;
}) {
  if (!pairs.length) return null;
  const get = (a: string, b: string) => pairs.find((p) => p.manager_id === a && p.opponent_id === b);
  return (
    <section>
      <h2 className="section-title text-ink mb-1">Liga-Matrix</h2>
      <p className="text-sm text-text-muted mb-3">Bilanz der Zeile gegen die Spalte, seit 2015</p>
      <div className="cell overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className="px-2 py-2" />
              {MANAGERS.map((c) => <th key={c} className="px-2 py-2 kicker font-normal">{c}</th>)}
            </tr>
          </thead>
          <tbody>
            {MANAGERS.map((r) => (
              <tr key={r} className="border-t border-border-light">
                <th className="px-3 py-2 text-left text-ink font-medium whitespace-nowrap">{r}</th>
                {MANAGERS.map((c) => {
                  if (r === c) return <td key={c} className="bg-surface-2" />;
                  const p = get(r, c);
                  const pct = p && p.total_games ? (p.wins + p.ties / 2) / p.total_games : 0.5;
                  const selected = r === m1 && c === m2;
                  // red = row leads, blue = row trails
                  const tone = pct > 0.5 ? `rgba(255,91,58,${(pct - 0.5) * 1.2})` : `rgba(96,165,250,${(0.5 - pct) * 1.2})`;
                  return (
                    <td key={c} className="p-0.5">
                      <button
                        onClick={() => onSelect(r, c)}
                        className={`w-full rounded-md px-2 py-1.5 font-mono tabular-nums text-ink hover:ring-1 hover:ring-border-strong ${selected ? "ring-2 ring-red" : ""}`}
                        style={{ backgroundColor: tone }}
                        title={`${r} vs ${c}: ${p?.wins ?? 0}–${p?.losses ?? 0}${p?.ties ? `–${p.ties}` : ""}`}
                      >
                        {p ? `${p.wins}–${p.losses}` : "–"}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
