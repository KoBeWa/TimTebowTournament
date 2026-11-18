"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeftRight, ListOrdered, LogIn, LogOut, Users } from "lucide-react";
import PlayerAvatar from "@/components/PlayerAvatar";
import PageHeader from "@/components/ui/PageHeader";
import StatTile from "@/components/ui/StatTile";
import Tabs from "@/components/ui/Tabs";
import ManagerName from "@/components/ui/ManagerName";
import { MANAGER_COLORS } from "@/lib/constants";
import { loadPlayer, type PlayerData, type PlayerEvent } from "@/lib/players";
import { timeline } from "./timeline";

const TABS = [
  { key: "managers", label: "Manager" },
  { key: "seasons", label: "Saisons" },
  { key: "best", label: "Beste Spiele" },
] as const;
type Tab = (typeof TABS)[number]["key"];

const fmt = (n: number | null | undefined, d = 1) => (n == null ? "–" : n.toFixed(d));

const byWeeks = (a: PlayerData["managers"][number], b: PlayerData["managers"][number]) =>
  b.weeks_rostered - a.weeks_rostered || (b.starter_points ?? 0) - (a.starter_points ?? 0);

export default function PlayerDetail({ playerKey, initial }: { playerKey: string; initial: PlayerData }) {
  const [summary, setSummary] = useState(initial.summary);
  const [managers, setManagers] = useState(() => [...initial.managers].sort(byWeeks));
  const [events, setEvents] = useState(initial.events);
  const [games, setGames] = useState(initial.games);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [tab, setTab] = useState<Tab>("managers");
  // The server already sent the player; the browser only loads it again on a retry
  const skipFirst = useRef(true);

  useEffect(() => {
    if (skipFirst.current) {
      skipFirst.current = false;
      return;
    }
    let cancelled = false;
    loadPlayer(playerKey)
      .then((d) => {
        if (cancelled) return;
        setSummary(d.summary);
        setManagers(d.managers.sort(byWeeks));
        setEvents(d.events);
        setGames(d.games);
        setError(false);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setError(true);
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [playerKey, attempt]);

  if (error) {
    return (
      <div className="cell flex flex-col items-start gap-3 p-5">
        <p className="text-sm text-text-secondary">Der Spieler konnte nicht geladen werden.</p>
        <button
          type="button"
          className="btn disabled:opacity-55 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus)]"
          onClick={() => { setError(false); setLoading(true); setAttempt((n) => n + 1); }}
        >
          Erneut versuchen
        </button>
      </div>
    );
  }
  if (loading) {
    return (
      <div className="animate-pulse motion-reduce:animate-none space-y-8" aria-busy="true">
        <div className="h-10 w-1/2 rounded-lg bg-paper-3" />
        <div className="cell h-32" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => <div key={i} className="cell h-20" />)}
        </div>
        <div className="cell h-56" />
      </div>
    );
  }
  if (!summary) {
    return (
      <div className="cell flex flex-col items-start gap-3 p-5">
        <p className="text-sm text-text-secondary">Diesen Spieler gibt es nicht.</p>
        <Link href="/players" className="btn focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus)]">Zur Spieler-Datenbank</Link>
      </div>
    );
  }

  const seasons = timeline(events, games);
  const maxWeeks = Math.max(1, ...managers.map((m) => m.weeks_rostered));
  const bestGames = games.filter((g) => g.is_starter).sort((a, b) => b.points - a.points).slice(0, 5);
  const bySeason = [...new Set(games.map((g) => g.season_year))].sort((a, b) => b - a).map((season) => {
    const gs = games.filter((g) => g.season_year === season);
    const starts = gs.filter((g) => g.is_starter);
    const pts = starts.reduce((s, g) => s + g.points, 0);
    return {
      season, managers: [...new Set(gs.map((g) => g.manager_id))], weeks: gs.length,
      starts: starts.length, points: pts, avg: starts.length ? pts / starts.length : null,
    };
  });

  const moveCount = summary.adds + summary.drops + summary.trades;
  const facts = [
    { label: "Saisons", value: `${summary.seasons}` },
    { label: "Manager", value: `${summary.managers}` },
    { label: "Gedraftet", value: `${summary.times_drafted}×` },
    { label: "Moves", value: `${moveCount}`, hint: `${summary.adds} Adds, ${summary.drops} Drops, ${summary.trades} Trades` },
  ];
  const descr = [
    summary.position ?? "–",
    summary.latest_team,
    summary.first_season ? `Liga ${summary.first_season}–${summary.last_season}` : null,
  ].filter(Boolean).join(", ");

  return (
    <div className="space-y-8">
      <PageHeader title={summary.player_name} description={descr} crumbs={[{ label: "Spieler", href: "/players" }]} />

      <div className="cell-accent flex flex-col items-start gap-5 p-4 sm:flex-row sm:items-center sm:p-5">
        <PlayerAvatar p={summary} size={80} />
        <div className="min-w-0 flex-1 space-y-3">
          {summary.top_manager && (
            <p className="text-sm text-text-muted">
              Am längsten bei <ManagerName id={summary.top_manager} className="font-medium text-ink" /> ({summary.top_manager_weeks} Wochen)
            </p>
          )}
          <dl className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-4">
            {facts.map((f) => (
              <div key={f.label} title={f.hint}>
                <dt className="text-xs text-text-muted">{f.label}</dt>
                <dd className="measured text-lg text-ink">{f.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Punkte" value={fmt(summary.starter_points)} hint="als Starter, alle Manager" />
        <StatTile label="Starts" value={`${summary.starts}`} />
        <StatTile label="Ø pro Start" value={fmt(summary.avg_start)} />
        <StatTile label="Bestes Spiel" value={fmt(summary.best_start)} />
      </div>

      <Tabs tabs={TABS} value={tab} onChange={setTab} label="Bereich" />

      {tab === "managers" && (managers.length > 0 ? (
        <div className="cell overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs font-medium text-text-muted">
                <th className="py-3 pl-4 pr-3 text-left font-medium sm:pl-5">Manager</th>
                <th className="hidden w-1/3 px-3 py-3 text-left font-medium md:table-cell">Wochen im Kader</th>
                <th className="px-3 py-3 text-right font-medium md:hidden">Wochen</th>
                <th className="px-3 py-3 text-right font-medium">Starts</th>
                <th className="px-3 py-3 text-right font-medium">Punkte</th>
                <th className="hidden px-3 py-3 text-right font-medium md:table-cell">Ø</th>
                <th className="hidden px-3 py-3 text-right font-medium md:table-cell">Best</th>
                <th className="hidden py-3 pl-3 pr-4 text-right font-medium sm:pr-5 md:table-cell">Saisons</th>
              </tr>
            </thead>
            <tbody>
              {managers.map((m) => (
                <tr key={m.manager_id} className="border-t border-border-light text-right">
                  <td className="py-2.5 pl-4 pr-3 text-left font-medium sm:pl-5"><ManagerName id={m.manager_id} /></td>
                  <td className="hidden px-3 py-2.5 md:table-cell">
                    <div className="flex items-center gap-2">
                      <div className="h-2 flex-1 overflow-hidden rounded-[var(--radius-pill)] bg-paper-3">
                        <div className="h-full" style={{ width: `${(m.weeks_rostered / maxWeeks) * 100}%`, backgroundColor: MANAGER_COLORS[m.manager_id] }} />
                      </div>
                      <span className="measured w-8 text-right">{m.weeks_rostered}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 measured md:hidden">{m.weeks_rostered}</td>
                  <td className="px-3 py-2.5 measured">{m.starts}</td>
                  <td className="px-3 py-2.5 measured text-ink">{fmt(m.starter_points)}</td>
                  <td className="hidden px-3 py-2.5 measured md:table-cell">{fmt(m.avg_start)}</td>
                  <td className="hidden px-3 py-2.5 measured md:table-cell">{fmt(m.best_start)}</td>
                  <td className="hidden py-2.5 pl-3 pr-4 measured text-text-muted sm:pr-5 md:table-cell">
                    {m.first_season === m.last_season ? m.first_season : `${m.first_season}–${m.last_season}`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <p className="py-8 text-center text-text-muted">Keine Manager-Daten.</p>)}

      {tab === "seasons" && (
        <div className="grid gap-8 lg:grid-cols-[1fr_20rem]">
          <section>
            <h2 className="section-title text-ink mb-4">Historie</h2>
            <div className="space-y-6">
              {seasons.map(({ season, items }) => (
                <div key={season}>
                  <h3 className="mb-2 text-sm font-medium text-text-muted">{season}</h3>
                  <ol className="cell divide-y divide-border-light">
                    {items.map((it, i) => (
                      <li key={i} className="flex items-start gap-3 px-4 py-2.5 text-sm">
                        {it.type === "event" ? <EventRow e={it.event} /> : (
                          <>
                            <Users size={16} aria-hidden="true" className="mt-0.5 text-text-faint shrink-0" />
                            <span className="flex-1 text-text-muted">
                              Im Kader bei <b className="font-medium text-ink">{it.stint.manager_id}</b>
                              , W{it.stint.from}{it.stint.to !== it.stint.from ? `–${it.stint.to}` : ""}
                            </span>
                            <span className="measured text-xs text-text-muted whitespace-nowrap">
                              {it.stint.starts}/{it.stint.weeks} Starts, {fmt(it.stint.points)} Pkt
                            </span>
                          </>
                        )}
                      </li>
                    ))}
                  </ol>
                </div>
              ))}
            </div>
          </section>

          {bySeason.length > 0 && (
            <aside>
              <h2 className="section-title text-ink mb-4">Saison für Saison</h2>
              <div className="cell p-4 sm:p-5">
                <table className="w-full text-sm">
                  <tbody>
                    {bySeason.map((s) => (
                      <tr key={s.season} className="border-b border-border-light last:border-0">
                        <td className="measured py-1.5 text-text-muted">{s.season}</td>
                        <td className="py-1.5 text-text-muted">{s.managers.join(", ")}</td>
                        <td className="measured py-1.5 text-right text-ink" title={`${s.starts} Starts, Ø ${fmt(s.avg)}`}>
                          {fmt(s.points)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </aside>
          )}
        </div>
      )}

      {tab === "best" && (bestGames.length > 0 ? (
        <div className="cell overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs font-medium text-text-muted">
                <th className="py-3 pl-4 pr-3 text-left font-medium sm:pl-5">Spiel</th>
                <th className="px-3 py-3 text-left font-medium">Manager</th>
                <th className="py-3 pl-3 pr-4 text-right font-medium sm:pr-5">Punkte</th>
              </tr>
            </thead>
            <tbody>
              {bestGames.map((g) => (
                <tr key={`${g.season_year}-${g.week}`} className="border-t border-border-light">
                  <td className="measured py-2.5 pl-4 pr-3 text-text-muted sm:pl-5">{g.season_year} W{g.week}</td>
                  <td className="px-3 py-2.5"><ManagerName id={g.manager_id} /></td>
                  <td className="py-2.5 pl-3 pr-4 text-right measured text-ink sm:pr-5">{fmt(g.points)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <p className="py-8 text-center text-text-muted">Keine Starts vorhanden.</p>)}
    </div>
  );
}

function EventRow({ e }: { e: PlayerEvent }) {
  const week = e.week ? `, W${e.week}` : "";
  const map = {
    draft: { icon: ListOrdered, text: <>Gedraftet von <b className="text-ink font-medium">{e.manager_id}</b>, Runde {e.round}, Pick {e.overall_pick}</>, cls: "text-gold" },
    add: { icon: LogIn, text: <>Geholt von <b className="text-ink font-medium">{e.manager_id}</b> (Waiver/FA){week}</>, cls: "text-positive" },
    drop: { icon: LogOut, text: <>Entlassen von <b className="text-ink font-medium">{e.manager_id}</b>{week}</>, cls: "text-negative" },
    trade_in: { icon: ArrowLeftRight, text: <>Per Trade zu <b className="text-ink font-medium">{e.manager_id}</b>{week}</>, cls: "text-text-muted" },
    trade_out: { icon: ArrowLeftRight, text: <>Per Trade abgegeben von <b className="text-ink font-medium">{e.manager_id}</b>{week}</>, cls: "text-text-muted" },
  }[e.kind];
  const Icon = map.icon;
  return (
    <>
      <Icon size={16} aria-hidden="true" className={`mt-0.5 shrink-0 ${map.cls}`} />
      <span className="flex-1 text-text-muted">{map.text}</span>
      {e.kind === "draft" && e.value != null && (
        <span className="measured text-xs text-text-muted whitespace-nowrap" title="Draft-Note (Grade4)">Note {fmt(e.value, 2)}</span>
      )}
    </>
  );
}
