"use client";

import { useEffect, useState, useRef } from "react";
import { SEASONS, CURRENT_SEASON } from "@/lib/constants";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import Tabs from "@/components/ui/Tabs";
import ManagerName from "@/components/ui/ManagerName";
import { loadSeasonWeeks, loadWeek, type MatchupWithStats, type SeasonWeeks } from "@/lib/gamecenter";
import { fmtNum, fmtPctPoints, fmtSigned, fmtSignedPctPoints } from "@/lib/format";

function sign(n: number) { return fmtSigned(n); }
function signPct(n: number) { return fmtSignedPctPoints(n); }
const pts = (n: number) => fmtNum(n);
const tone = (n: number | null) => (n === null || n === 0 ? "text-text-secondary" : n > 0 ? "text-positive" : "text-negative");

function StatRow({ label, a, b, toneA, toneB }: { label: string; a: string; b: string; toneA?: string; toneB?: string }) {
  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 py-1 text-sm">
      <span className={`measured ${toneA ?? "text-text-secondary"}`}>{a}</span>
      <span className="text-xs text-text-muted">{label}</span>
      <span className={`measured text-right ${toneB ?? "text-text-secondary"}`}>{b}</span>
    </div>
  );
}

function Side({ id, score, won, align }: { id: string; score: number; won: boolean; align: "left" | "right" }) {
  const right = align === "right";
  return (
    <div className={`flex min-w-0 flex-1 items-center gap-2 sm:gap-3 ${right ? "flex-row-reverse text-right" : ""}`}>
      <ManagerName id={id} plain className={`${right ? "flex-row-reverse" : ""} text-base ${won ? "font-medium text-ink" : "text-text-muted"}`} />
      <span className={`measured text-xl sm:text-2xl ${right ? "mr-auto" : "ml-auto"} ${won ? "font-medium text-ink" : "text-text-muted"}`}>{pts(score)}</span>
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
        className="flex items-center gap-2.5 p-4 transition-colors hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--color-focus)] sm:gap-4 sm:p-5"
      >
        <Side id={m.manager_a} score={m.score_a} won={aWon} align="left" />
        <span className="text-xs text-text-faint">vs</span>
        <Side id={m.manager_b} score={m.score_b} won={bWon} align="right" />
      </Link>

      <div className="border-t border-border px-4 py-2 sm:px-5">
        <StatRow
          label="Coach-Score"
          a={a.coach_score !== null ? fmtNum(a.coach_score) : "–"}
          b={b.coach_score !== null ? fmtNum(b.coach_score) : "–"}
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
            <StatRow label="Punkteanteil" a={fmtPctPoints(a.pts_share_pct)} b={fmtPctPoints(b.pts_share_pct)} />
            <StatRow label="Wochenrang" a={`#${a.pts_rank}`} b={`#${b.pts_rank}`} />
          </>
        )}
      </div>

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex min-h-11 w-full items-center justify-center gap-1 border-t border-border px-3 text-sm text-text-muted transition-colors hover:bg-surface-2 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--color-focus)]"
      >
        {open ? "Weniger" : "Details"}
        <ChevronDown size={14} aria-hidden className={open ? "rotate-180" : ""} />
      </button>
    </div>
  );
}

export interface InitialWeek {
  season: number;
  week: number;
  weeks: SeasonWeeks;
  matchups: MatchupWithStats[];
}

export default function GamecenterBrowser({ initial }: { initial: InitialWeek }) {
  const [season, setSeason] = useState(initial.season);
  const [week, setWeek] = useState<number | null>(initial.week);
  const [maxWeek, setMaxWeek] = useState(initial.weeks.latest);
  const [playoffWeeks, setPlayoffWeeks] = useState<number[]>(initial.weeks.playoffWeeks);
  const [matchups, setMatchups] = useState<MatchupWithStats[]>(initial.matchups);
  const [loadedKey, setLoadedKey] = useState<string | null>(`${initial.season}-${initial.week}`);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  // The server sent the latest week of the current season; the browser loads anything else
  const skipFirstFetch = useRef(true);

  // Detect the latest week whenever the season changes. A retry only repeats the
  // detection if it never succeeded for this season, so it reloads the week the
  // user picked instead of jumping to the latest one.
  const detectedSeason = useRef<number | null>(initial.season);
  useEffect(() => {
    if (detectedSeason.current === season) return;
    let cancelled = false;
    loadSeasonWeeks(season)
      .then((w) => {
        if (cancelled) return;
        setMaxWeek(w.latest);
        setPlayoffWeeks(w.playoffWeeks);
        detectedSeason.current = season;
        setWeek(w.latest);
      })
      .catch(() => { if (!cancelled) setError(true); });
    return () => { cancelled = true; };
  }, [season, attempt]);

  // Fetch data when week is known
  useEffect(() => {
    if (week === null) return;
    if (skipFirstFetch.current) {
      skipFirstFetch.current = false;
      return;
    }
    let cancelled = false;
    loadWeek(season, week)
      .then((m) => {
        if (cancelled) return;
        setMatchups(m);
        setError(false);
        setLoadedKey(`${season}-${week}`);
      })
      .catch(() => { if (!cancelled) setError(true); });
    return () => { cancelled = true; };
  }, [season, week, attempt]);

  const retry = () => {
    setError(false);
    setAttempt((n) => n + 1);
  };

  const loading = week === null || loadedKey !== `${season}-${week}`;

  const weekTabs = Array.from({ length: maxWeek }, (_, i) => {
    const w = i + 1;
    const po = playoffWeeks.indexOf(w);
    return { key: w, label: po >= 0 ? `PO ${po + 1}` : String(w) };
  });

  return (
    <div>
      <PageHeader title="Gamecenter" description="Jedes Matchup, jeder Punkt, jede Woche" />

      <div className="mb-8 flex flex-wrap items-center gap-x-4 gap-y-3">
        <label className="flex items-center gap-2 text-sm text-text-muted">
          Saison
          <select
            value={season}
            onChange={(e) => setSeason(Number(e.target.value))}
            className="measured rounded-[var(--radius-pill)] border border-border bg-paper-3 px-3 py-1.5 text-sm text-ink"
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
      {error ? (
        <div className="cell flex flex-col items-start gap-3 p-5">
          <p className="text-sm text-text-secondary">Die Matchups konnten nicht geladen werden.</p>
          <button type="button" onClick={retry} className="btn">Erneut versuchen</button>
        </div>
      ) : matchups.length === 0 && loading ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2" aria-busy="true">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="cell motion-safe:animate-pulse space-y-3 p-4 sm:p-5">
              <div className="h-8 rounded-lg bg-surface-3" />
              <div className="h-4 rounded-lg bg-surface-3" />
              <div className="h-4 rounded-lg bg-surface-3" />
              <div className="h-8 rounded-lg bg-surface-2" />
            </div>
          ))}
        </div>
      ) : !loading && matchups.length === 0 ? (
        <div className="cell flex flex-col items-start gap-3 p-5">
          <p className="text-sm text-text-secondary">Für diese Woche gibt es keine Matchups.</p>
          {season !== CURRENT_SEASON && (
            <button type="button" onClick={() => setSeason(CURRENT_SEASON)} className="btn">Zur aktuellen Saison</button>
          )}
        </div>
      ) : (
        <div className={`grid grid-cols-1 items-start gap-3 md:grid-cols-2 ${loading ? "opacity-50" : ""}`}>
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
