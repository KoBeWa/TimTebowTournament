"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeftRight, ChevronRight, ListOrdered, LogIn, LogOut, Users } from "lucide-react";
import PlayerAvatar from "@/components/PlayerAvatar";
import { loadPlayer, type PlayerEvent, type PlayerGame, type PlayerManagerStats, type PlayerSummary } from "@/lib/players";
import { timeline } from "./timeline";

const fmt = (n: number | null | undefined, d = 1) => (n == null ? "–" : n.toFixed(d));

export default function PlayerDetail({ playerKey }: { playerKey: string }) {
  const [summary, setSummary] = useState<PlayerSummary | null>(null);
  const [managers, setManagers] = useState<PlayerManagerStats[]>([]);
  const [events, setEvents] = useState<PlayerEvent[]>([]);
  const [games, setGames] = useState<PlayerGame[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPlayer(playerKey).then((d) => {
      setSummary(d.summary);
      setManagers(d.managers.sort((a, b) => b.weeks_rostered - a.weeks_rostered || (b.starter_points ?? 0) - (a.starter_points ?? 0)));
      setEvents(d.events);
      setGames(d.games);
      setLoading(false);
    });
  }, [playerKey]);

  if (loading) return <div className="text-text-muted text-center py-12">Lade Spieler…</div>;
  if (!summary) {
    return (
      <div className="space-y-4 py-12 text-center">
        <p className="text-text-muted">Spieler nicht gefunden.</p>
        <Link href="/players" className="text-red hover:underline">Zur Spieler-Datenbank</Link>
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

  return (
    <div className="space-y-8">
      <nav className="flex items-center gap-1.5 text-sm text-text-muted">
        <Link href="/players" className="hover:text-ink transition-colors">Spieler</Link>
        <ChevronRight size={14} className="text-text-faint" />
        <span className="text-ink">{summary.player_name}</span>
      </nav>

      <div className="cell p-6 sm:p-8 flex flex-col sm:flex-row gap-6 items-start sm:items-center">
        <PlayerAvatar p={summary} size={96} />
        <div className="flex-1">
          <div className="kicker">
            {summary.position ?? "–"}{summary.latest_team ? ` · ${summary.latest_team}` : ""}
            {summary.first_season ? ` · Liga ${summary.first_season}–${summary.last_season}` : ""}
          </div>
          <h1 className="display-title text-4xl md:text-5xl text-ink">{summary.player_name}</h1>
          {summary.top_manager && (
            <p className="text-text-secondary mt-1">
              Am längsten bei <Link href={`/manager/${summary.top_manager}`} className="text-ink hover:text-red">{summary.top_manager}</Link>
              {" "}({summary.top_manager_weeks} Wochen)
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
        <Stat label="Punkte" value={fmt(summary.starter_points)} hint="als Starter, alle Manager" />
        <Stat label="Starts" value={`${summary.starts}`} />
        <Stat label="Ø pro Start" value={fmt(summary.avg_start)} />
        <Stat label="Bestes Spiel" value={fmt(summary.best_start)} />
        <Stat label="Saisons" value={`${summary.seasons}`} />
        <Stat label="Manager" value={`${summary.managers}`} />
        <Stat label="Gedraftet" value={`${summary.times_drafted}×`} />
        <Stat label="Moves" value={`${summary.adds + summary.drops + summary.trades}`} hint={`${summary.adds} Adds · ${summary.drops} Drops · ${summary.trades} Trades`} />
      </div>

      {managers.length > 0 && (
        <section>
          <h2 className="section-title text-ink mb-4">Bei welchem Manager</h2>
          <div className="cell overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-right">
                  <th className="px-4 py-2 kicker font-normal text-left">Manager</th>
                  <th className="px-4 py-2 kicker font-normal text-left w-1/3">Wochen im Kader</th>
                  <th className="px-4 py-2 kicker font-normal">Starts</th>
                  <th className="px-4 py-2 kicker font-normal">Punkte</th>
                  <th className="px-4 py-2 kicker font-normal">Ø</th>
                  <th className="px-4 py-2 kicker font-normal">Best</th>
                  <th className="px-4 py-2 kicker font-normal">Saisons</th>
                </tr>
              </thead>
              <tbody>
                {managers.map((m) => (
                  <tr key={m.manager_id} className="border-b border-border-light text-right">
                    <td className="px-4 py-2.5 text-left">
                      <Link href={`/manager/${m.manager_id}`} className="text-ink font-medium hover:text-red">{m.manager_id}</Link>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="h-2 flex-1 rounded-full bg-surface-3 overflow-hidden">
                          <div className="h-full bg-red" style={{ width: `${(m.weeks_rostered / maxWeeks) * 100}%` }} />
                        </div>
                        <span className="font-mono w-8 text-right">{m.weeks_rostered}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 font-mono">{m.starts}</td>
                    <td className="px-4 py-2.5 font-mono text-ink">{fmt(m.starter_points)}</td>
                    <td className="px-4 py-2.5 font-mono">{fmt(m.avg_start)}</td>
                    <td className="px-4 py-2.5 font-mono">{fmt(m.best_start)}</td>
                    <td className="px-4 py-2.5 text-text-secondary">
                      {m.first_season === m.last_season ? m.first_season : `${m.first_season}–${m.last_season}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <section>
          <h2 className="section-title text-ink mb-4">Historie</h2>
          <div className="space-y-5">
            {seasons.map(({ season, items }) => (
              <div key={season}>
                <div className="kicker mb-2">{season}</div>
                <ol className="cell divide-y divide-border-light">
                  {items.map((it, i) => (
                    <li key={i} className="flex items-start gap-3 px-4 py-2.5 text-sm">
                      {it.type === "event" ? <EventRow e={it.event} /> : (
                        <>
                          <Users size={16} className="mt-0.5 text-text-faint shrink-0" />
                          <span className="flex-1 text-text-secondary">
                            Im Kader bei <b className="text-ink font-medium">{it.stint.manager_id}</b>
                            {" "}· W{it.stint.from}{it.stint.to !== it.stint.from ? `–${it.stint.to}` : ""}
                          </span>
                          <span className="text-xs text-text-muted whitespace-nowrap">
                            {it.stint.starts}/{it.stint.weeks} Starts · {fmt(it.stint.points)} Pkt
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

        <aside className="space-y-6">
          {bestGames.length > 0 && (
            <div className="cell p-4 sm:p-5">
              <div className="kicker mb-3">Beste Spiele</div>
              <ol className="space-y-2 text-sm">
                {bestGames.map((g) => (
                  <li key={`${g.season_year}-${g.week}`} className="flex items-baseline justify-between gap-3">
                    <span className="text-text-secondary">{g.season_year} · W{g.week} · {g.manager_id}</span>
                    <span className="font-mono text-ink">{fmt(g.points)}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}
          {bySeason.length > 0 && (
            <div className="cell p-4 sm:p-5">
              <div className="kicker mb-3">Saison für Saison</div>
              <table className="w-full text-sm">
                <tbody>
                  {bySeason.map((s) => (
                    <tr key={s.season} className="border-b border-border-light last:border-0">
                      <td className="py-1.5 text-text-muted">{s.season}</td>
                      <td className="py-1.5 text-text-secondary">{s.managers.join(", ")}</td>
                      <td className="py-1.5 text-right font-mono text-ink" title={`${s.starts} Starts, Ø ${fmt(s.avg)}`}>
                        {fmt(s.points)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="cell px-4 py-3" title={hint}>
      <div className="kicker">{label}</div>
      <div className="font-mono text-xl text-ink mt-0.5">{value}</div>
    </div>
  );
}

function EventRow({ e }: { e: PlayerEvent }) {
  const week = e.week ? ` · W${e.week}` : "";
  const map = {
    draft: { icon: ListOrdered, text: <>Gedraftet von <b className="text-ink font-medium">{e.manager_id}</b> · Runde {e.round}, Pick {e.overall_pick}</>, cls: "text-gold" },
    add: { icon: LogIn, text: <>Geholt von <b className="text-ink font-medium">{e.manager_id}</b> (Waiver/FA){week}</>, cls: "text-positive" },
    drop: { icon: LogOut, text: <>Entlassen von <b className="text-ink font-medium">{e.manager_id}</b>{week}</>, cls: "text-negative" },
    trade_in: { icon: ArrowLeftRight, text: <>Per Trade zu <b className="text-ink font-medium">{e.manager_id}</b>{week}</>, cls: "text-accent-blue" },
    trade_out: { icon: ArrowLeftRight, text: <>Per Trade abgegeben von <b className="text-ink font-medium">{e.manager_id}</b>{week}</>, cls: "text-accent-blue" },
  }[e.kind];
  const Icon = map.icon;
  return (
    <>
      <Icon size={16} className={`mt-0.5 shrink-0 ${map.cls}`} />
      <span className="flex-1 text-text-secondary">{map.text}</span>
      {e.kind === "draft" && e.value != null && (
        <span className="text-xs text-text-muted whitespace-nowrap" title="Draft-Note (Grade4)">Note {fmt(e.value, 2)}</span>
      )}
    </>
  );
}
