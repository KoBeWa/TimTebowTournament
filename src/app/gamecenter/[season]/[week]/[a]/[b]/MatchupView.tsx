"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import PageHeader from "@/components/ui/PageHeader";
import Tabs from "@/components/ui/Tabs";
import ManagerName from "@/components/ui/ManagerName";
import ScoreTimeline from "./ScoreTimeline";
import { loadMatchup, type H2HData, type LineupPlayer, type MatchupData, type TeamWeekStats } from "@/lib/matchup";
import { fmtNum, fmtPctPoints, fmtSigned, fmtSignedPctPoints } from "@/lib/format";

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
        <h3 className="text-base font-medium text-ink">
          <ManagerName id={managerId} />
        </h3>
        <span className="measured text-sm text-text-muted">{fmtNum(total)} Punkte</span>
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
                  <td className="py-2 pl-4 pr-2 measured text-xs text-text-muted sm:pl-5">{slotLabel(p.slot)}</td>
                  <td className="px-2 py-2">
                    <div className="flex items-center gap-3">
                      <div className="hidden h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-[var(--radius-pill)] bg-border-light md:flex">
                        {p.headshot ? (
                          <img
                            fetchPriority="high"
                            decoding="async"
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
                  <td className="measured whitespace-nowrap py-2 pl-2 pr-4 text-right text-ink sm:pr-5">
                    <span className="font-medium">{fmtNum(p.points)}</span>
                    {wonBattle && (
                      <span className="ml-2 inline-block h-1.5 w-1.5 rounded-[var(--radius-pill)] bg-positive align-middle" title="Position-Battle gewonnen" />
                    )}
                  </td>
                </tr>
              );
            })}
            {bench.length > 0 && (
              <tr className="border-t border-border">
                <td colSpan={4} className="py-1.5 pl-4 pr-4 text-xs font-medium text-text-muted sm:pl-5">Bank</td>
              </tr>
            )}
            {bench.map((p, i) => (
              <tr key={`bench-${i}`} className={`border-t border-border-light ${p.shouldHaveStarted ? "" : "opacity-60"}`}>
                <td className="measured py-2 pl-4 pr-2 text-xs text-text-muted sm:pl-5">BN</td>
                <td className="px-2 py-2">
                  <span className={`truncate ${p.shouldHaveStarted ? "font-medium text-ink" : "text-text-secondary"}`}>{p.player_name}</span>
                  {p.shouldHaveStarted && <span className="ml-2 text-xs text-negative">hätte starten sollen</span>}
                </td>
                <td className="hidden px-2 py-2 md:table-cell"><StatLine player={p} /></td>
                <td className={`measured py-2 pl-2 pr-4 text-right sm:pr-5 ${p.shouldHaveStarted ? "font-medium text-ink" : "text-text-muted"}`}>
                  {fmtNum(p.points)}
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
  const signPct = (n: number) => fmtSignedPctPoints(n);
  const sign = (n: number) => fmtSigned(n, 2);
  const items = [
    { label: "Punkteanteil", value: fmtPctPoints(stats.pts_share_pct) },
    { label: "Wochenrang", value: `#${stats.pts_rank}` },
    { label: "vs Team Ø", value: signPct(stats.pts_vs_team_avg_pct) },
    { label: "vs Liga Ø", value: signPct(stats.pts_vs_league_avg_pct) },
    { label: "Luck", value: stats.luck !== null ? sign(stats.luck) : "–" },
    { label: "Coach-Rang", value: stats.coach_rank !== null ? `#${stats.coach_rank}` : "–" },
    { label: "Coach-Score", value: stats.coach_score !== null ? fmtNum(stats.coach_score) : "–" },
  ];

  return (
    <div className="cell flex-1 overflow-hidden">
      <div className={`px-4 py-3 text-base sm:px-5 ${won ? "font-medium text-ink" : "text-text-secondary"}`}>
        <ManagerName id={managerId} plain />
      </div>
      <dl>
        {items.map((item) => (
          <div key={item.label} className="flex justify-between gap-2 border-t border-border-light px-4 py-2 text-sm sm:px-5">
            <dt className="text-text-muted">{item.label}</dt>
            <dd className="measured text-ink">{item.value}</dd>
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
          <div className="measured mt-1 text-xl font-medium text-ink">{h2h.record}</div>
          <div className="mt-0.5 text-xs text-text-muted">{managerA} gegen {managerB}</div>
        </div>
        <div className="cell p-4">
          <div className="text-xs text-text-muted">Aktuelle Serie</div>
          <div className="measured mt-1 text-xl font-medium text-ink">{h2h.winnerStreak}×</div>
          <div className="mt-0.5 text-xs text-text-muted">{h2h.winner}</div>
        </div>
        <div className="cell p-4">
          <div className="text-xs text-text-muted">Ø Punktedifferenz</div>
          <div className={`measured mt-1 text-xl font-medium ${favoredA ? "text-ink" : "text-text-secondary"}`}>
            {favoredA ? "+" : ""}{fmtNum(Math.abs(margin))}
          </div>
          <div className="mt-0.5 text-xs text-text-muted">zugunsten {favoredA ? managerA : managerB}</div>
        </div>
        {h2h.prevMatchup && (
          <Link
            href={`/gamecenter/${h2h.prevMatchup.season}/${h2h.prevMatchup.week}?a=${managerA}&b=${managerB}`}
            className="cell group p-4 transition-colors hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-[var(--color-focus)]"
          >
            <div className="text-xs text-text-muted">Letztes Aufeinandertreffen</div>
            <div className="measured mt-1 text-xl font-medium text-ink transition-colors group-hover:text-red">
              {fmtNum(h2h.prevMatchup.scoreA)} : {fmtNum(h2h.prevMatchup.scoreB)}
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

// ─── Main view ────────────────────────────────────────────────────────────────

export default function MatchupView({ season, week, a, b, initial }: {
  season: number;
  week: number;
  a: string;
  b: string;
  initial: MatchupData | null;
}) {
  const [data, setData] = useState<MatchupData | null>(initial);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [tab, setTab] = useState<TabKey>("lineups");
  // The server already sent the matchup; the browser only loads it again on a retry
  const skipFirst = useRef(true);

  useEffect(() => {
    if (skipFirst.current) {
      skipFirst.current = false;
      return;
    }
    let cancelled = false;
    loadMatchup(season, week, a, b)
      .then((d) => {
        if (cancelled) return;
        setData(d);
        setError(false);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setError(true);
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [season, week, a, b, attempt]);

  const matchup = data?.matchup ?? null;
  const lineupA = data?.lineupA ?? [];
  const lineupB = data?.lineupB ?? [];
  const statsA = data?.statsA ?? null;
  const statsB = data?.statsB ?? null;
  const h2h = data?.h2h ?? null;

  if (error) {
    return (
      <div className="cell flex flex-col items-start gap-3 p-5">
        <p className="text-sm text-text-secondary">Das Matchup konnte nicht geladen werden.</p>
        <button
          type="button"
          className="btn"
          onClick={() => { setError(false); setLoading(true); setAttempt((n) => n + 1); }}
        >
          Erneut versuchen
        </button>
      </div>
    );
  }
  if (loading) {
    return (
      <div className="motion-safe:animate-pulse space-y-8" aria-busy="true">
        <div className="h-10 w-2/3 rounded-lg bg-surface-3" />
        <div className="cell h-32 bg-surface-2" />
        <div className="h-11 w-72 max-w-full rounded-[var(--radius-pill)] bg-surface-3" />
        <div className="flex flex-col gap-4 lg:flex-row">
          <div className="cell h-96 flex-1 bg-surface-2" />
          <div className="cell h-96 flex-1 bg-surface-2" />
        </div>
      </div>
    );
  }
  if (!matchup) {
    return (
      <div className="cell flex flex-col items-start gap-3 p-5">
        <p className="text-sm text-text-secondary">Dieses Matchup gibt es nicht.</p>
        <Link href="/gamecenter" className="btn">Zum Gamecenter</Link>
      </div>
    );
  }

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
    <div>
      <PageHeader
        crumbs={[{ label: "Gamecenter", href: "/gamecenter" }]}
        title={`${matchup.manager_a} vs ${matchup.manager_b}`}
        description={`Saison ${season}, Woche ${week}${matchup.is_playoff ? ", Playoff" : ""}`}
      />

      {/* Score header */}
      <div className="cell-accent mb-8 overflow-hidden">
        <div className="flex items-center justify-between gap-3 p-4 text-center sm:p-6">
          <div className="min-w-0 flex-1">
            <div className={`flex justify-center text-base font-medium sm:text-2xl ${aWon ? "text-ink" : "text-text-muted"}`}><ManagerName id={matchup.manager_a} plain /></div>
            {aWon && <div className="mt-1 text-xs text-text-muted">Sieger</div>}
          </div>
          <div className="measured shrink-0 whitespace-nowrap text-lg font-medium sm:text-4xl">
            <span className={aWon ? "text-ink" : "text-text-muted"}>{fmtNum(matchup.score_a)}</span>
            <span className="mx-1.5 text-text-faint sm:mx-3">:</span>
            <span className={!aWon ? "text-ink" : "text-text-muted"}>{fmtNum(matchup.score_b)}</span>
          </div>
          <div className="min-w-0 flex-1">
            <div className={`flex justify-center text-base font-medium sm:text-2xl ${!aWon ? "text-ink" : "text-text-muted"}`}><ManagerName id={matchup.manager_b} plain /></div>
            {!aWon && <div className="mt-1 text-xs text-text-muted">Sieger</div>}
          </div>
        </div>
      </div>

      <div className="mb-8">
        <Tabs tabs={TABS} value={tab} onChange={setTab} label="Ansicht" />
      </div>

      {tab === "lineups" && (
        <div className="flex flex-col gap-8 lg:flex-row lg:gap-4">
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
