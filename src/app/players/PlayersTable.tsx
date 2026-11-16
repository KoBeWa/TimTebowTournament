"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { MANAGERS } from "@/lib/constants";
import { loadPlayerList, playerHref, POSITIONS, type PlayerListRow } from "@/lib/players";
import PlayerAvatar from "@/components/PlayerAvatar";
import PageHeader from "@/components/ui/PageHeader";
import Tabs from "@/components/ui/Tabs";
import ManagerName from "@/components/ui/ManagerName";

type SortKey = "starter_points" | "avg_start" | "starts" | "managers" | "times_drafted" | "moves" | "player_name";

const COLUMNS: { key: SortKey; label: string; title?: string }[] = [
  { key: "player_name", label: "Spieler" },
  { key: "starter_points", label: "Punkte", title: "Punkte als Starter, alle Manager" },
  { key: "starts", label: "Starts" },
  { key: "avg_start", label: "Ø" },
  { key: "managers", label: "Manager", title: "Anzahl Manager, die ihn im Kader hatten" },
  { key: "times_drafted", label: "Gedraftet" },
  { key: "moves", label: "Moves", title: "Adds, Drops und Trades" },
];

// Columns kept on phones; the rest only from lg
const PHONE = new Set<SortKey>(["player_name", "starter_points", "starts"]);

const value = (p: PlayerListRow, k: SortKey) => (k === "player_name" ? p.player_name : (p[k] ?? 0));

export default function PlayersTable({ initialPlayers }: { initialPlayers: PlayerListRow[] }) {
  const [players, setPlayers] = useState<PlayerListRow[]>(initialPlayers);
  const [loading, setLoading] = useState(initialPlayers.length === 0);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [query, setQuery] = useState("");
  const [pos, setPos] = useState<string>("all");
  const [manager, setManager] = useState<string>("all");
  const [sort, setSort] = useState<SortKey>("starter_points");
  // Rows shown; the list has about 1,500 players, so it grows on request
  const [limit, setLimit] = useState(50);

  // The server sends the list; the browser only loads it when that came back empty or on a retry
  const skipFirst = useRef(initialPlayers.length > 0);

  useEffect(() => {
    if (skipFirst.current) {
      skipFirst.current = false;
      return;
    }
    let cancelled = false;
    loadPlayerList()
      .then((rows) => {
        if (cancelled) return;
        if (rows.length === 0) setError(true);
        else {
          setPlayers(rows);
          setError(false);
        }
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setError(true);
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [attempt]);

  const retry = () => {
    setError(false);
    setLoading(true);
    setAttempt((n) => n + 1);
  };
  const resetFilters = () => {
    setQuery("");
    setPos("all");
    setManager("all");
  };

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return players
      .filter((p) => p.player_name && (!q || p.player_name.toLowerCase().includes(q)))
      .filter((p) => pos === "all" || p.position === pos)
      .filter((p) => manager === "all" || p.top_manager === manager)
      .sort((a, b) => {
        const va = value(a, sort), vb = value(b, sort);
        return typeof va === "string" ? va.localeCompare(String(vb)) : Number(vb) - Number(va);
      });
  }, [players, query, pos, manager, sort]);

  const shown = rows.slice(0, limit);

  return (
    <div className="space-y-6">
      <PageHeader title="Spieler" description="Jeder Spieler, der seit 2015 in einem Kader stand: Punkte, Manager und komplette Historie." />

      <div className="flex flex-wrap items-center gap-3">
        <label className="relative min-w-[14rem] flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-faint" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Spieler suchen…"
            aria-label="Spieler suchen"
            className="w-full bg-surface border border-border rounded-full pl-9 pr-3 py-2.5 text-ink placeholder:text-text-faint focus:border-red focus:outline-none"
          />
        </label>
        <Tabs size="sm" label="Position" value={pos} onChange={setPos}
          tabs={["all", ...POSITIONS].map((p) => ({ key: p, label: p === "all" ? "Alle" : p }))} />
        <label className="flex items-center gap-2 text-sm text-text-muted" title="Manager, der ihn am längsten im Kader hatte">
          Meist bei
          <select value={manager} onChange={(e) => setManager(e.target.value)}
            className="bg-surface border border-border rounded-full px-3 py-2 text-sm text-ink focus:border-red focus:outline-none">
            <option value="all">Alle</option>
            {MANAGERS.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </label>
      </div>

      {error ? (
        <div className="cell flex flex-col items-start gap-3 p-5">
          <p className="text-sm text-text-secondary">Die Spielerliste konnte nicht geladen werden.</p>
          <button type="button" onClick={retry} className="btn">Erneut versuchen</button>
        </div>
      ) : loading ? (
        <div className="cell animate-pulse divide-y divide-border-light" aria-busy="true">
          {Array.from({ length: 10 }, (_, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3 sm:px-5">
              <div className="h-9 w-9 shrink-0 rounded-full bg-surface-3" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3.5 w-40 max-w-full rounded-lg bg-surface-3" />
                <div className="h-3 w-24 rounded-lg bg-surface-2" />
              </div>
              <div className="h-4 w-12 rounded-lg bg-surface-3" />
            </div>
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="cell flex flex-col items-start gap-3 p-5">
          <p className="text-sm text-text-secondary">Kein Spieler passt zu diesen Filtern.</p>
          <button type="button" onClick={resetFilters} className="btn">Filter zurücksetzen</button>
        </div>
      ) : (
        <div className="cell overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs font-medium text-text-muted">
                <th className="hidden w-10 py-3 pl-4 pr-1 text-left font-medium md:table-cell sm:pl-5">#</th>
                {COLUMNS.map((c) => (
                  <th key={c.key} title={c.title}
                    className={`px-3 py-3 font-medium ${c.key === "player_name" ? "pl-4 text-left sm:pl-5 md:pl-3" : "text-right"} ${PHONE.has(c.key) ? "" : "hidden lg:table-cell"}`}>
                    <button onClick={() => setSort(c.key)} className={`inline-flex min-h-11 items-center ${sort === c.key ? "text-red" : "hover:text-ink"}`}>
                      {c.label}
                    </button>
                  </th>
                ))}
                <th className="px-3 py-3 pr-4 text-left font-medium sm:pr-5">Meist bei</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((p, i) => (
                <tr key={p.player_key} className="border-t border-border-light hover:bg-surface-2">
                  <td className="hidden py-2 pl-4 pr-1 text-text-faint tabular-nums md:table-cell sm:pl-5">{i + 1}</td>
                  <td className="py-2 pl-4 pr-3 sm:pl-5 md:pl-3">
                    <Link href={playerHref(p.player_key)} className="group flex items-center gap-3">
                      <PlayerAvatar p={p} />
                      <span>
                        <span className="font-medium text-ink group-hover:text-red">{p.player_name}</span>
                        <span className="block text-xs text-text-muted">
                          {p.position ?? "–"}{p.first_season ? `, ${p.first_season}${p.last_season !== p.first_season ? `–${p.last_season}` : ""}` : ""}
                        </span>
                      </span>
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-ink">{p.starter_points.toFixed(1)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{p.starts}</td>
                  <td className="hidden px-3 py-2 text-right tabular-nums lg:table-cell">{p.avg_start != null ? p.avg_start.toFixed(1) : "–"}</td>
                  <td className="hidden px-3 py-2 text-right tabular-nums lg:table-cell">{p.managers}</td>
                  <td className="hidden px-3 py-2 text-right tabular-nums lg:table-cell">{p.times_drafted}</td>
                  <td className="hidden px-3 py-2 text-right tabular-nums lg:table-cell">{p.moves}</td>
                  <td className="whitespace-nowrap py-2 pl-3 pr-4 sm:pr-5">
                    {p.top_manager ? <><ManagerName id={p.top_manager} /> <span className="hidden text-text-faint md:inline">({p.top_manager_weeks} W)</span></> : "–"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length > shown.length && (
            <button type="button" onClick={() => setLimit(limit + 100)}
              className="min-h-11 w-full border-t border-border-light px-4 py-3 text-sm text-text-muted hover:text-ink transition-colors sm:px-5">
              100 weitere anzeigen ({rows.length - shown.length} übrig)
            </button>
          )}
        </div>
      )}
    </div>
  );
}
