"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import PlayerAvatar from "@/components/PlayerAvatar";
import Tabs from "@/components/ui/Tabs";
import TeamChart, { NFL_TEAMS } from "./TeamChart";
import { loadManagerPlayers, playerHref, POSITIONS } from "@/lib/players";
import { buildRows, type Row } from "./rows";

type Filter = "all" | "started" | "drafted" | "waiver" | "trade" | "bench";
type SortKey = "name" | "position" | "team" | "first" | "weeks" | "starts" | "points" | "avg" | "best" | "drafted" | "adds" | "trades";

const FILTERS: { key: Filter; label: string; test: (r: Row) => boolean }[] = [
  { key: "all", label: "Alle", test: () => true },
  { key: "started", label: "Aufgestellt", test: (r) => r.starts > 0 },
  { key: "drafted", label: "Gedraftet", test: (r) => r.drafted > 0 },
  { key: "waiver", label: "Waiver/FA", test: (r) => r.adds > 0 },
  { key: "trade", label: "Per Trade", test: (r) => r.trades > 0 },
  { key: "bench", label: "Nur Bank", test: (r) => r.weeks > 0 && r.starts === 0 },
];

const COLUMNS: { key: SortKey; label: string; title?: string; align?: "left" }[] = [
  { key: "name", label: "Spieler", align: "left" },
  { key: "position", label: "Pos", align: "left" },
  { key: "team", label: "Team", align: "left", title: "NFL-Team(s), während er in diesem Kader stand" },
  { key: "first", label: "Saisons", align: "left" },
  { key: "weeks", label: "Wochen", title: "Wochen im Kader" },
  { key: "starts", label: "Starts" },
  { key: "points", label: "Punkte", title: "Punkte als Starter" },
  { key: "avg", label: "Ø" },
  { key: "best", label: "Best" },
  { key: "drafted", label: "Draft", title: "Wie oft gedraftet" },
  { key: "adds", label: "Adds", title: "Von Waivers/FA geholt" },
  { key: "trades", label: "Trades", title: "Per Trade bekommen" },
];

const TEXT_KEYS = new Set<SortKey>(["name", "position", "team"]);
const PAGE = 100;

export default function ManagerPlayers({ manager, initialRows }: { manager: string; initialRows: Row[] | null }) {
  const [rows, setRows] = useState<Row[]>(initialRows ?? []);
  const [loading, setLoading] = useState(initialRows === null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [filter, setFilter] = useState<Filter>("all");
  const [pos, setPos] = useState("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({ key: "weeks", desc: true });
  const [limit, setLimit] = useState(PAGE);
  const [team, setTeam] = useState<string | null>(null);
  // The server already sent the rows; only a retry (or missing rows) loads them in the browser
  const skipFirst = useRef(initialRows !== null);

  useEffect(() => {
    if (skipFirst.current) {
      skipFirst.current = false;
      return;
    }
    let cancelled = false;
    loadManagerPlayers(manager).then((data) => {
      if (cancelled) return;
      const built = buildRows(data);
      // No player info at all means the load failed
      if (data.info.length === 0) {
        setError(true);
      } else {
        setRows(built);
        setError(false);
      }
      setLoading(false);
    }).catch(() => {
      if (cancelled) return;
      setError(true);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [manager, attempt]);

  const retry = () => {
    setError(false);
    setLoading(true);
    setAttempt((n) => n + 1);
  };
  const resetFilters = () => {
    setFilter("all");
    setPos("all");
    setQuery("");
    setTeam(null);
    setLimit(PAGE);
  };

  const counts = useMemo(
    () => Object.fromEntries(FILTERS.map((f) => [f.key, rows.filter(f.test).length])) as Record<Filter, number>,
    [rows],
  );

  const teamCounts = useMemo(() => {
    const by = new Map<string, string[]>(NFL_TEAMS.map((t) => [t, []]));
    for (const r of rows) {
      for (const t of new Set((r.team ?? "").split("/").filter(Boolean))) by.get(t)?.push(r.name);
    }
    return [...by.entries()]
      .map(([t, players]) => ({ team: t, players }))
      .sort((a, b) => b.players.length - a.players.length || a.team.localeCompare(b.team));
  }, [rows]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const test = FILTERS.find((f) => f.key === filter)!.test;
    const { key, desc } = sort;
    return rows
      .filter(test)
      .filter((r) => pos === "all" || r.position === pos)
      .filter((r) => !team || (r.team ?? "").split("/").includes(team))
      .filter((r) => !q || r.name.toLowerCase().includes(q))
      .sort((a, b) => {
        const va = a[key], vb = b[key];
        if (va == null && vb == null) return a.name.localeCompare(b.name);
        if (va == null) return 1;
        if (vb == null) return -1;
        const cmp = TEXT_KEYS.has(key) ? String(va).localeCompare(String(vb)) : Number(va) - Number(vb);
        return (desc ? -cmp : cmp) || a.name.localeCompare(b.name);
      });
  }, [rows, filter, pos, query, sort, team]);

  function sortBy(key: SortKey) {
    setSort((s) => (s.key === key ? { key, desc: !s.desc } : { key, desc: !TEXT_KEYS.has(key) && key !== "first" }));
  }

  const fmt = (n: number | null) => (n == null ? "–" : n.toFixed(1));

  const thBase = "py-2.5 px-3 text-xs font-medium text-text-muted whitespace-nowrap";
  // Columns kept on phones; the rest only from lg
  const PHONE = new Set<SortKey>(["name", "position", "weeks", "starts", "points"]);
  const vis = (k: SortKey) => (PHONE.has(k) ? "" : "hidden lg:table-cell");

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h2 className="section-title text-ink">Spieler</h2>
        {!loading && !error && <span className="text-sm text-text-muted">{rows.length} Spieler seit 2015 im Kader</span>}
      </div>

      {!loading && !error && rows.length > 0 && (
        <TeamChart counts={teamCounts} selected={team} onSelect={(t) => { setTeam(t); setLimit(PAGE); }} />
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Tabs size="sm" label="Filter" value={filter} onChange={(k) => { setFilter(k); setLimit(PAGE); }}
          tabs={FILTERS.map((f) => ({ key: f.key, label: f.label, count: loading ? undefined : counts[f.key] }))} />
        <Tabs size="sm" label="Position" value={pos} onChange={(k) => { setPos(k); setLimit(PAGE); }}
          tabs={["all", ...POSITIONS].map((p) => ({ key: p, label: p === "all" ? "Alle Pos." : p }))} />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <label className="relative flex-1 min-w-[12rem]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-faint" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Spieler suchen…" aria-label="Spieler suchen"
            className="w-full bg-surface border border-border rounded-full pl-9 pr-3 py-2 text-sm text-ink placeholder:text-text-faint focus:border-red focus:outline-none" />
        </label>
        {team && (
          <button type="button" onClick={() => setTeam(null)} className="btn" aria-label={`Teamfilter ${team} entfernen`}>
            Team: {team} ✕
          </button>
        )}
      </div>

      {error ? (
        <div className="cell flex flex-col items-start gap-3 p-5">
          <p className="text-sm text-text-secondary">Die Spieler dieses Managers konnten nicht geladen werden.</p>
          <button type="button" onClick={retry} className="btn">Erneut versuchen</button>
        </div>
      ) : loading ? (
        <div className="cell animate-pulse divide-y divide-border-light" aria-busy="true">
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3 sm:px-5">
              <div className="h-7 w-7 shrink-0 rounded-full bg-surface-3" />
              <div className="h-3.5 w-40 max-w-full flex-1 rounded-lg bg-surface-3" />
              <div className="h-3.5 w-12 rounded-lg bg-surface-2" />
            </div>
          ))}
        </div>
      ) : shown.length === 0 ? (
        <div className="cell flex flex-col items-start gap-3 p-5">
          <p className="text-sm text-text-secondary">Keine Spieler für diese Auswahl.</p>
          <button type="button" onClick={resetFilters} className="btn">Filter zurücksetzen</button>
        </div>
      ) : (
        <div className="cell overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                {COLUMNS.map((c, i) => (
                  <th key={c.key} title={c.title}
                    className={`${thBase} ${vis(c.key)} ${i === 0 ? "pl-4 sm:pl-5" : ""} ${i === COLUMNS.length - 1 ? "pr-4 sm:pr-5" : ""} ${c.align === "left" ? "text-left" : "text-right"}`}>
                    <button onClick={() => sortBy(c.key)} className={`inline-flex min-h-11 items-center ${sort.key === c.key ? "text-red" : "hover:text-ink"}`}>
                      {c.label}{sort.key === c.key ? (sort.desc ? " ↓" : " ↑") : ""}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {shown.slice(0, limit).map((r) => (
                <tr key={r.key} className="border-t border-border-light hover:bg-surface-2">
                  <td className="py-2 pl-4 pr-3 sm:pl-5">
                    <Link href={playerHref(r.key)} className="group flex items-center gap-2.5">
                      <PlayerAvatar p={{ headshot: r.headshot, player_name: r.name, position: r.position }} size={28} />
                      <span className="whitespace-nowrap font-medium text-ink group-hover:text-red">{r.name}</span>
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-text-muted">{r.position ?? "–"}</td>
                  <td className="hidden px-3 py-2 text-text-muted lg:table-cell">{r.team ?? "–"}</td>
                  <td className="hidden whitespace-nowrap px-3 py-2 text-text-muted lg:table-cell">
                    {r.first == null ? "–" : r.first === r.last ? r.first : `${r.first}–${r.last}`}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.weeks}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.starts}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-ink">{r.points.toFixed(1)}</td>
                  <td className="hidden px-3 py-2 text-right tabular-nums lg:table-cell">{fmt(r.avg)}</td>
                  <td className="hidden px-3 py-2 text-right tabular-nums lg:table-cell">{fmt(r.best)}</td>
                  <td className="hidden px-3 py-2 text-right tabular-nums lg:table-cell">{r.drafted || "–"}</td>
                  <td className="hidden px-3 py-2 text-right tabular-nums lg:table-cell">{r.adds || "–"}</td>
                  <td className="hidden py-2 pl-3 pr-4 text-right tabular-nums sm:pr-5 lg:table-cell">{r.trades || "–"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {shown.length > limit && (
            <button onClick={() => setLimit((l) => l + PAGE)}
              className="min-h-11 w-full border-t border-border-light px-4 py-3 text-sm text-text-muted hover:bg-surface-2 hover:text-ink">
              {Math.min(PAGE, shown.length - limit)} weitere anzeigen ({shown.length - limit} übrig)
            </button>
          )}
        </div>
      )}
    </section>
  );
}
