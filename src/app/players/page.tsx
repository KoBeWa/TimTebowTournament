"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { MANAGERS } from "@/lib/constants";
import { loadPlayerSummaries, playerHref, POSITIONS, type PlayerSummary } from "@/lib/players";
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

const moves = (p: PlayerSummary) => p.adds + p.drops + p.trades;
const value = (p: PlayerSummary, k: SortKey) =>
  k === "moves" ? moves(p) : k === "player_name" ? p.player_name : (p[k] ?? 0);

export default function PlayersPage() {
  const [players, setPlayers] = useState<PlayerSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [pos, setPos] = useState<string>("all");
  const [manager, setManager] = useState<string>("all");
  const [sort, setSort] = useState<SortKey>("starter_points");
  // Rows shown; the list has about 1,500 players, so it grows on request
  const [limit, setLimit] = useState(50);

  useEffect(() => {
    loadPlayerSummaries().then((rows) => {
      setPlayers(rows);
      setLoading(false);
    });
  }, []);

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
            className="w-full bg-surface border border-border rounded-xl pl-9 pr-3 py-2.5 text-ink placeholder:text-text-faint focus:border-red focus:outline-none"
          />
        </label>
        <Tabs size="sm" label="Position" value={pos} onChange={setPos}
          tabs={["all", ...POSITIONS].map((p) => ({ key: p, label: p === "all" ? "Alle" : p }))} />
        <select value={manager} onChange={(e) => setManager(e.target.value)}
          className="bg-surface border border-border rounded-xl px-3 py-2 text-sm text-ink focus:border-red focus:outline-none"
          title="Manager, der ihn am längsten im Kader hatte">
          <option value="all">Meist bei: alle</option>
          {MANAGERS.map((m) => <option key={m} value={m}>Meist bei {m}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="text-text-muted text-center py-12">Lade Spieler…</div>
      ) : (
        <div className="cell overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs font-medium text-text-muted">
                <th className="hidden w-10 py-3 pl-4 pr-1 text-left font-medium md:table-cell sm:pl-5">#</th>
                {COLUMNS.map((c) => (
                  <th key={c.key} title={c.title}
                    className={`px-3 py-3 font-medium ${c.key === "player_name" ? "pl-4 text-left sm:pl-5 md:pl-3" : "text-right"} ${PHONE.has(c.key) ? "" : "hidden lg:table-cell"}`}>
                    <button onClick={() => setSort(c.key)} className={sort === c.key ? "text-red" : "hover:text-ink"}>
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
                  <td className="hidden px-3 py-2 text-right tabular-nums lg:table-cell">{moves(p)}</td>
                  <td className="whitespace-nowrap py-2 pl-3 pr-4 sm:pr-5">
                    {p.top_manager ? <><ManagerName id={p.top_manager} /> <span className="hidden text-text-faint md:inline">({p.top_manager_weeks} W)</span></> : "–"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length > shown.length && (
            <button type="button" onClick={() => setLimit(limit + 100)}
              className="w-full border-t border-border-light px-4 py-3 text-sm text-text-muted hover:text-ink transition-colors sm:px-5">
              100 weitere anzeigen ({rows.length - shown.length} übrig)
            </button>
          )}
        </div>
      )}
    </div>
  );
}
