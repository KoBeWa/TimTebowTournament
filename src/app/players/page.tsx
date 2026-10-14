"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { MANAGERS } from "@/lib/constants";
import { loadPlayerSummaries, playerHref, POSITIONS, type PlayerSummary } from "@/lib/players";
import PlayerAvatar from "@/components/PlayerAvatar";

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

  const shown = rows.slice(0, 200);

  return (
    <div className="space-y-6">
      <div>
        <div className="kicker">Spieler</div>
        <h1 className="display-title text-4xl md:text-5xl text-ink">Spieler-Datenbank</h1>
        <p className="text-text-secondary mt-2">
          Jeder Spieler, der seit 2015 in einem Kader stand: Punkte, Manager und komplette Historie
        </p>
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <label className="relative flex-1 min-w-[14rem]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-faint" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Spieler suchen…"
            className="w-full bg-surface border border-border rounded-xl pl-9 pr-3 py-2.5 text-ink placeholder:text-text-faint focus:border-red focus:outline-none"
          />
        </label>
        <div className="flex flex-wrap gap-1">
          {["all", ...POSITIONS].map((p) => (
            <button key={p} onClick={() => setPos(p)}
              className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${pos === p ? "bg-red text-white font-semibold" : "bg-cream text-text-secondary hover:text-ink border border-border"}`}>
              {p === "all" ? "Alle" : p}
            </button>
          ))}
        </div>
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
              <tr className="border-b border-border">
                <th className="px-3 py-2 w-10 kicker font-normal text-left">#</th>
                {COLUMNS.map((c) => (
                  <th key={c.key} title={c.title}
                    className={`px-3 py-2 kicker font-normal ${c.key === "player_name" ? "text-left" : "text-right"}`}>
                    <button onClick={() => setSort(c.key)} className={sort === c.key ? "text-red" : "hover:text-ink"}>
                      {c.label}
                    </button>
                  </th>
                ))}
                <th className="px-3 py-2 kicker font-normal text-left">Meist bei</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((p, i) => (
                <tr key={p.player_key} className="border-b border-border-light hover:bg-surface-2">
                  <td className="px-3 py-2 text-text-faint">{i + 1}</td>
                  <td className="px-3 py-2">
                    <Link href={playerHref(p.player_key)} className="flex items-center gap-3 group">
                      <PlayerAvatar p={p} />
                      <span>
                        <span className="text-ink font-medium group-hover:text-red">{p.player_name}</span>
                        <span className="block text-xs text-text-muted">
                          {p.position ?? "–"}{p.first_season ? ` · ${p.first_season}${p.last_season !== p.first_season ? `–${p.last_season}` : ""}` : ""}
                        </span>
                      </span>
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-ink">{p.starter_points.toFixed(1)}</td>
                  <td className="px-3 py-2 text-right font-mono">{p.starts}</td>
                  <td className="px-3 py-2 text-right font-mono">{p.avg_start != null ? p.avg_start.toFixed(1) : "–"}</td>
                  <td className="px-3 py-2 text-right font-mono">{p.managers}</td>
                  <td className="px-3 py-2 text-right font-mono">{p.times_drafted}</td>
                  <td className="px-3 py-2 text-right font-mono">{moves(p)}</td>
                  <td className="px-3 py-2 text-text-secondary whitespace-nowrap">
                    {p.top_manager ? <>{p.top_manager} <span className="text-text-faint">({p.top_manager_weeks} W)</span></> : "–"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length > shown.length && (
            <div className="px-4 py-3 text-sm text-text-muted">
              {rows.length - shown.length} weitere – Suche oder Filter nutzen
            </div>
          )}
        </div>
      )}
    </div>
  );
}
