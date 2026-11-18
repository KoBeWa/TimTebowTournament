"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { MANAGERS, MANAGER_COLORS, type ManagerId } from "@/lib/constants";
import PageHeader from "@/components/ui/PageHeader";
import Tabs from "@/components/ui/Tabs";
import ManagerName from "@/components/ui/ManagerName";
import { loadPair, loadPairs } from "./data";
import {
  benchStats, overallAverage, record, recordGames, resultOf, rivalryKillers, scoring,
  sideSwitchers, streaks, topPerformances,
  type H2HMatchup, type LineupRow, type PairRecord,
} from "./stats";
import { fmtNum, fmtSigned } from "@/lib/format";

const fmt = (n: number) => fmtNum(n);
// Win difference as the headline number, the record goes underneath
const fmtDiff = (d: number) => (d > 0 ? `+${d}` : d < 0 ? `−${-d}` : "±0");
const fmtRecord = (w: number, l: number, t = 0) => `${w}-${l}${t ? `-${t}` : ""}`;
const diffTone = (d: number) => (d > 0 ? "text-positive" : d < 0 ? "text-negative" : "text-text-secondary");
const when = (m: { season_year: number; week: number }) => `${m.season_year}, W${m.week}`;

const TABS = [
  { key: "overview", label: "Übersicht" },
  { key: "seasons", label: "Saisons" },
  { key: "players", label: "Spieler" },
  { key: "matrix", label: "Liga-Matrix" },
] as const;
type Tab = (typeof TABS)[number]["key"];

export interface InitialH2H {
  m1: ManagerId;
  m2: ManagerId;
  pairs: PairRecord[];
  matchups: H2HMatchup[];
  lineups: LineupRow[];
}

export default function HeadToHead({ initial }: { initial: InitialH2H }) {
  const [m1, setM1] = useState<ManagerId>(initial.m1);
  const [m2, setM2] = useState<ManagerId>(initial.m2);
  const [pairs, setPairs] = useState<PairRecord[]>(initial.pairs);
  const [matchups, setMatchups] = useState<H2HMatchup[]>(initial.matchups);
  const [lineups, setLineups] = useState<LineupRow[]>(initial.lineups);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(true);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [tab, setTab] = useState<Tab>("overview");
  // The server sent the league matrix and the default pair; the browser loads other pairs
  const skipFirstPairs = useRef(true);
  const skipFirstPair = useRef(true);

  // League-wide records of every pairing (for the matrix and own averages)
  useEffect(() => {
    if (skipFirstPairs.current) {
      skipFirstPairs.current = false;
      return;
    }
    let cancelled = false;
    loadPairs()
      .then((p) => { if (!cancelled) setPairs(p); })
      .catch(() => { if (!cancelled) setError(true); });
    return () => { cancelled = true; };
  }, [attempt]);

  useEffect(() => {
    if (m1 === m2) return;
    if (skipFirstPair.current) {
      skipFirstPair.current = false;
      return;
    }
    let cancelled = false;
    setLoading(true);
    loadPair(m1, m2)
      .then((d) => {
        if (cancelled) return;
        setMatchups(d.matchups);
        setLineups(d.lineups);
        setLoaded(true);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setError(true);
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [m1, m2, attempt]);

  const retry = () => {
    setError(false);
    setLoading(true);
    setAttempt((n) => n + 1);
  };

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

  const c1 = MANAGER_COLORS[m1];
  const c2 = MANAGER_COLORS[m2];
  const pair = m1 !== m2 && loaded;
  const hasGames = pair && matchups.length > 0 && games;
  const skeleton = (
    <div className="motion-safe:animate-pulse space-y-8" aria-busy="true">
      <div className="cell h-40 bg-surface-2" />
      <div className="cell h-56 bg-surface-2" />
    </div>
  );
  const empty = m1 === m2 || loaded ? (
    <div className="cell p-4 text-sm sm:p-5 text-text-secondary">
      {m1 === m2
        ? "Bitte wähle zwei verschiedene Manager aus."
        : "Diese beiden Manager haben noch nie gegeneinander gespielt. Wähle oben ein anderes Duell."}
    </div>
  ) : skeleton;

  return (
    <div className="space-y-8">
      <PageHeader title="Head to Head" description="Wähle zwei Manager für den direkten Vergleich oder klick ein Feld in der Liga-Matrix." />

      <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-end">
        <label className="flex w-full flex-col gap-1 text-sm text-text-muted sm:w-52">
          Manager 1
          <select value={m1} onChange={(e) => setM1(e.target.value as ManagerId)}
            className="bg-surface border border-border rounded-lg px-3 py-2.5 text-ink focus:border-red focus:outline-none">
            {MANAGERS.map((m) => <option key={m} value={m} disabled={m === m2}>{m}</option>)}
          </select>
        </label>
        <span className="text-sm text-text-muted sm:pb-3">gegen</span>
        <label className="flex w-full flex-col gap-1 text-sm text-text-muted sm:w-52">
          Manager 2
          <select value={m2} onChange={(e) => setM2(e.target.value as ManagerId)}
            className="bg-surface border border-border rounded-lg px-3 py-2.5 text-ink focus:border-red focus:outline-none">
            {MANAGERS.map((m) => <option key={m} value={m} disabled={m === m1}>{m}</option>)}
          </select>
        </label>
      </div>

      {error ? (
        <div className="cell flex flex-col items-start gap-3 p-4 sm:p-5">
          <p className="text-sm text-text-secondary">Der Vergleich konnte nicht geladen werden.</p>
          <button type="button" onClick={retry} className="btn">Erneut versuchen</button>
        </div>
      ) : (
      <div className={`space-y-8 transition-opacity ${loading && loaded ? "opacity-50" : ""}`}>
      {pair && (
      <div className="cell-accent p-4 sm:p-5">
        <div className="mb-5 text-center text-sm text-text-muted">Direkter Vergleich, {matchups.length} Matchups</div>
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
          <div className="text-right">
            <div className={`display-title text-2xl sm:text-4xl ${wins > losses ? "text-ink" : "text-text-muted"}`}><ManagerName id={m1} plain /></div>
            <div className="text-sm text-text-muted mt-1">{wins > losses ? "führt" : wins === losses ? "ausgeglichen" : "liegt hinten"}</div>
          </div>
          <div className="text-center">
            <div className={`measured text-3xl sm:text-5xl ${diffTone(wins - losses)}`}>{fmtDiff(wins - losses)}</div>
            <div className="measured mt-1 text-sm text-text-muted">{fmtRecord(wins, losses, ties)}</div>
          </div>
          <div>
            <div className={`display-title text-2xl sm:text-4xl ${losses > wins ? "text-ink" : "text-text-muted"}`}><ManagerName id={m2} plain /></div>
            <div className="text-sm text-text-muted mt-1">{losses > wins ? "führt" : wins === losses ? "ausgeglichen" : "liegt hinten"}</div>
          </div>
        </div>
        {matchups.length > 0 && (
          <>
            <div className="mt-5 flex h-2 overflow-hidden rounded-full bg-surface-3">
              <div style={{ width: `${(wins / matchups.length) * 100}%`, backgroundColor: c1 }} />
              <div className="bg-text-faint" style={{ width: `${(ties / matchups.length) * 100}%` }} />
              <div style={{ width: `${(losses / matchups.length) * 100}%`, backgroundColor: c2 }} />
            </div>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-text-secondary">
              <span>Reguläre Saison <b className="measured font-medium text-ink">{fmtRecord(reg.wins, reg.losses)}</b></span>
              <span>Playoffs <b className="measured font-medium text-ink">{fmtRecord(po.wins, po.losses)}</b></span>
              <span className="flex items-center gap-1.5">
                Letzte 5
                {lastFive.map((m) => {
                  const r = resultOf(m);
                  return (
                    <span key={`${m.season_year}-${m.week}`} title={when(m)}
                      className={`h-2.5 w-2.5 rounded-full ${r === "tie" ? "bg-text-faint" : ""}`}
                      style={r === "tie" ? undefined : { backgroundColor: r === "me" ? c1 : c2 }} />
                  );
                })}
              </span>
            </div>
          </>
        )}
      </div>
      )}

      <Tabs tabs={TABS} value={tab} onChange={setTab} label="Bereich" />

      {tab === "overview" && (!hasGames ? empty : (
        <div className="space-y-8">
      <section>
        <h2 className="section-title text-ink mb-4">Matchup-Stats</h2>
        <div className="cell overflow-hidden">
          <CompareRow label="Ø Punkte" a={fmt(sc.avgMe)} b={fmt(sc.avgThem)} aWins={sc.avgMe > sc.avgThem} bWins={sc.avgThem > sc.avgMe} />
          <CompareRow label="Ø vs. eigener Schnitt"
            a={fmtSigned(sc.avgMe - avg1)}
            b={fmtSigned(sc.avgThem - avg2)}
            hint="Punkte in diesem Duell minus eigener Karriere-Schnitt" />
          <CompareRow label="Höchster Score" a={fmt(sc.maxMe)} b={fmt(sc.maxThem)} aWins={sc.maxMe > sc.maxThem} bWins={sc.maxThem > sc.maxMe} />
          <CompareRow label="Längste Siegesserie" a={`${st.longest.me}`} b={`${st.longest.them}`}
            aWins={st.longest.me > st.longest.them} bWins={st.longest.them > st.longest.me} />
          <CompareRow label="Bankpunkte gesamt" a={fmt(players.bench1.total)} b={fmt(players.bench2.total)}
            hint="Punkte, die auf der Bank liegen geblieben sind" />
          <div className="flex flex-wrap justify-between gap-2 border-t border-border-light px-4 py-2.5 text-sm text-text-secondary sm:px-5">
            <span>Ø Abstand <b className="measured font-medium text-ink">{fmt(sc.avgMargin)}</b></span>
            {st.current.side && st.current.side !== "tie" && (
              <span>Aktuelle Serie: <b className="font-medium text-ink">{nameOf(st.current.side)}</b> <span className="measured">{st.current.length}</span> Sieg{st.current.length > 1 ? "e" : ""} in Folge</span>
            )}
          </div>
        </div>
      </section>

      <section>
        <h2 className="section-title text-ink mb-4">Rekordspiele</h2>
        <div className="cell divide-y divide-border-light">
          {games.biggestMe && <GameCard title={`Höchster Sieg ${m1}`} m={games.biggestMe} m1={m1} m2={m2} />}
          {games.biggestThem && <GameCard title={`Höchster Sieg ${m2}`} m={games.biggestThem} m1={m1} m2={m2} />}
          <GameCard title="Knappstes Spiel" m={games.closest} m1={m1} m2={m2} />
          <GameCard title="Meiste Punkte zusammen" m={games.highest} m1={m1} m2={m2} />
          <GameCard title="Wenigste Punkte zusammen" m={games.lowest} m1={m1} m2={m2} />
        </div>
      </section>
        </div>
      ))}

      {tab === "seasons" && (!hasGames ? empty : (
        <div className="space-y-8">
      <section>
        <h2 className="section-title text-ink mb-4">Bilanz pro Saison</h2>
        <div className="flex flex-wrap gap-2">
          {seasons.map((s) => {
            const r = record(bySeason[s]);
            const d = r.wins - r.losses;
            return (
              <div key={s} className={`rounded-lg border border-border px-3 py-2 text-center ${d > 0 ? "bg-ok-soft" : d < 0 ? "bg-bad-soft" : "bg-surface"}`}>
                <div className="measured text-xs text-text-muted">{s}</div>
                <div className={`measured text-sm ${diffTone(d)}`}>{fmtDiff(d)}</div>
                <div className="measured text-[11px] text-text-muted">{fmtRecord(r.wins, r.losses, r.ties)}</div>
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="section-title text-ink mb-4">Alle Matchups</h2>
        <div className="space-y-4">
          {[...seasons].reverse().map((season) => (
            <div key={season}>
              <h3 className="mb-2 text-sm font-medium text-text-muted">{season}</h3>
              <div className="cell divide-y divide-border-light">
                {bySeason[season].map((m) => {
                  const won = m.myScore > m.theirScore;
                  const tied = m.myScore === m.theirScore;
                  return (
                    <div key={`${m.season_year}-${m.week}`} className="flex items-center justify-between gap-3 px-4 py-2.5">
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="h-4 w-[3px] shrink-0 rounded-sm bg-text-faint"
                          style={tied ? undefined : { backgroundColor: won ? c1 : c2 }} aria-hidden />
                        <span className="w-16 shrink-0 text-sm text-text-muted">Woche {m.week}</span>
                        <span className="inline-flex items-center gap-1.5 text-sm font-medium text-ink">{tied ? "Unentschieden" : <><ManagerName id={won ? m1 : m2} plain /> gewinnt</>}</span>
                        {m.is_playoff && <span className="chip">Playoffs</span>}
                      </div>
                      <div className="measured flex items-center gap-2 text-sm">
                        <span className={won ? "text-ink font-medium" : "text-text-secondary"}>{fmtNum(m.myScore)}</span>
                        <span className="text-text-faint">:</span>
                        <span className={!won && !tied ? "text-ink font-medium" : "text-text-secondary"}>{fmtNum(m.theirScore)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </section>
        </div>
      ))}

      {tab === "players" && (!hasGames ? empty : (
      <section>
        <h2 className="section-title text-ink mb-4">Besondere Spieler</h2>
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="cell p-4 sm:p-5">
            <h3 className="mb-3 text-sm font-medium text-ink">Top-Einzelleistungen</h3>
            <ol className="space-y-2">
              {players.top.map((p, i) => (
                <li key={`${p.player}-${p.season_year}-${p.week}`} className="flex items-baseline gap-3 text-sm">
                  <span className="measured w-4 text-text-faint">{i + 1}</span>
                  <span className="flex-1 min-w-0">
                    <span className="text-ink font-medium">{p.player}</span>
                    <span className="block text-xs text-text-muted">{p.manager}, {when(p)}</span>
                  </span>
                  <span className="measured text-ink">{fmt(p.points)}</span>
                </li>
              ))}
            </ol>
          </div>
          {[{ m: m1, list: players.killers1 }, { m: m2, list: players.killers2 }].map(({ m, list }) => (
            <div key={m} className="cell p-4 sm:p-5">
              <h3 className="mb-3 text-sm font-medium text-ink">Rivalen-Killer {m}</h3>
              <ol className="space-y-2">
                {list.map((p) => (
                  <li key={p.player} className="flex items-baseline gap-3 text-sm">
                    <span className="flex-1 min-w-0">
                      <span className="text-ink font-medium">{p.player}</span>
                      <span className="block text-xs text-text-muted">{p.games} Spiele, Ø {fmt(p.points / p.games)}, Best {fmt(p.best)}</span>
                    </span>
                    <span className="measured text-ink">{fmt(p.points)}</span>
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="cell p-4 sm:p-5">
            <h3 className="mb-2 text-sm font-medium text-ink">Seitenwechsler</h3>
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
            <h3 className="mb-2 text-sm font-medium text-ink">Bester Bankdrücker</h3>
            <div className="space-y-1 text-sm text-text-secondary">
              {[{ m: m1, b: players.bench1.best }, { m: m2, b: players.bench2.best }].map(({ m, b }) => b && (
                <div key={m}>
                  <span className="text-ink">{m}</span>: {b.player_name} mit <b className="measured font-medium text-ink">{fmt(b.points)}</b> auf der Bank ({when(b)})
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
      ))}

      {tab === "matrix" && (
        <LeagueMatrix pairs={pairs} m1={m1} m2={m2} onSelect={(a, b) => { setM1(a); setM2(b); setTab("overview"); }} />
      )}
      </div>
      )}
    </div>
  );
}

function CompareRow({ label, a, b, aWins, bWins, hint }: {
  label: string; a: string; b: string; aWins?: boolean; bWins?: boolean; hint?: string;
}) {
  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 border-t border-border-light px-4 py-2.5 first:border-t-0 sm:px-5">
      <span className={`measured text-right ${aWins ? "text-ink font-medium" : "text-text-secondary"}`}>{a}</span>
      <span className="min-w-[9rem] text-center text-xs text-text-muted" title={hint}>{label}</span>
      <span className={`measured ${bWins ? "text-ink font-medium" : "text-text-secondary"}`}>{b}</span>
    </div>
  );
}

function GameCard({ title, m, m1, m2 }: { title: string; m: H2HMatchup; m1: string; m2: string }) {
  const r = resultOf(m);
  return (
    <div className="grid gap-1 p-4 sm:grid-cols-[13rem_auto_1fr] sm:items-baseline sm:gap-x-6 sm:px-5">
      <h3 className="text-sm font-medium text-text-muted">{title}</h3>
      <span className="measured text-lg">
        <span className={r === "me" ? "text-ink font-medium" : "text-text-secondary"}>{fmt(m.myScore)}</span>
        <span className="mx-1.5 text-text-faint">:</span>
        <span className={r === "them" ? "text-ink font-medium" : "text-text-secondary"}>{fmt(m.theirScore)}</span>
      </span>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-muted">
        <span className="measured">{when(m)}</span>
        <span>{m1} vs {m2}, Abstand <span className="measured">{fmt(Math.abs(m.myScore - m.theirScore))}</span></span>
        {m.is_playoff && <span className="chip">Playoff</span>}
      </div>
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
      <h2 className="section-title mb-1 text-ink">Liga-Matrix</h2>
      <p className="text-sm text-text-muted mb-3">Bilanz der Zeile gegen die Spalte, seit 2015</p>
      <div className="cell overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className="px-2 py-2" />
              {MANAGERS.map((c) => <th key={c} className="px-2 py-2 text-xs font-medium text-text-muted">{c}</th>)}
            </tr>
          </thead>
          <tbody>
            {MANAGERS.map((r) => (
              <tr key={r} className="border-t border-border-light">
                <th className="px-3 py-2 text-left font-medium whitespace-nowrap"><ManagerName id={r} /></th>
                {MANAGERS.map((c) => {
                  if (r === c) return <td key={c} className="bg-surface-2" />;
                  const p = get(r, c);
                  const pct = p && p.total_games ? (p.wins + p.ties / 2) / p.total_games : 0.5;
                  const selected = r === m1 && c === m2;
                  // soft green = row leads, soft red = row trails
                  const tone = pct > 0.5 ? "bg-ok-soft" : pct < 0.5 ? "bg-bad-soft" : "";
                  const d = p ? p.wins - p.losses : 0;
                  return (
                    <td key={c} className="p-0.5">
                      <button
                        onClick={() => onSelect(r, c)}
                        className={`min-h-11 w-full rounded-md px-2 py-1.5 hover:ring-1 hover:ring-border-strong ${tone} ${selected ? "ring-2 ring-red" : ""}`}
                        title={`${r} vs ${c}: ${p?.wins ?? 0}-${p?.losses ?? 0}${p?.ties ? `-${p.ties}` : ""}`}
                      >
                        {p ? (
                          <>
                            <span className={`measured block text-sm ${diffTone(d)}`}>{fmtDiff(d)}</span>
                            <span className="measured block text-[11px] leading-tight text-text-muted">{fmtRecord(p.wins, p.losses, p.ties)}</span>
                          </>
                        ) : <span aria-label="keine Angabe" className="inline-block h-px w-3 bg-border-strong align-middle" />}
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
