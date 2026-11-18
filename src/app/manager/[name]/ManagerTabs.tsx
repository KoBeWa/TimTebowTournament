"use client";

import { useState } from "react";
import Link from "next/link";
import { Trophy } from "lucide-react";
import Tabs from "@/components/ui/Tabs";
import ManagerName from "@/components/ui/ManagerName";
import ManagerPlayers from "./ManagerPlayers";
import type { Row } from "./rows";

type SeasonRow = { season_year: number; reg_rank: number; wins: number; losses: number; ties: number; points_for: number | string };
type PlayoffRow = { season_year: number; final_rank: number };
type MatchupRow = { season: number; week: number; opponent: string; myScore: number; theirScore: number; is_playoff: boolean };

const TABS = [
  { key: "seasons", label: "Saisons" },
  { key: "players", label: "Spieler" },
  { key: "matchups", label: "Letzte Spiele" },
] as const;
type Tab = (typeof TABS)[number]["key"];

export default function ManagerTabs({ manager, results, playoffs, matchups, secondary, players }: {
  manager: string;
  results: SeasonRow[];
  playoffs: PlayoffRow[];
  matchups: MatchupRow[];
  secondary: { label: string; value: string }[];
  players: Row[] | null;
}) {
  const [tab, setTab] = useState<Tab>("seasons");

  return (
    <div className="space-y-6">
      <Tabs tabs={TABS} value={tab} onChange={setTab} label="Bereich" />

      {tab === "seasons" && (
        <section className="space-y-6">
          <div className="cell overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs font-medium text-text-muted">
                  <th className="py-3 pl-4 sm:pl-5 text-left font-medium">Saison</th>
                  <th className="px-3 py-3 text-center font-medium">Platz</th>
                  <th className="px-3 py-3 text-center font-medium">Bilanz</th>
                  <th className="px-3 py-3 text-right font-medium">Punkte</th>
                  <th className="py-3 pl-3 pr-4 sm:pr-5 text-center font-medium hidden sm:table-cell">Playoffs</th>
                </tr>
              </thead>
              <tbody>
                {results.map((s) => {
                  const po = playoffs.find((p) => p.season_year === s.season_year);
                  return (
                    <tr key={s.season_year} className="border-t border-border-light">
                      <td className="py-3 pl-4 sm:pl-5">
                        <Link href={`/history/${s.season_year}`} className="font-medium text-ink hover:text-red transition-colors">
                          <span className="measured">{s.season_year}</span>
                          {po?.final_rank === 1 && <Trophy size={14} aria-label="Meister" className="ml-2 inline-block align-[-2px] text-gold" />}
                        </Link>
                      </td>
                      <td className="px-3 py-3 text-center measured text-text-muted">#{s.reg_rank}</td>
                      <td className="px-3 py-3 text-center measured">
                        <span className="text-positive">{s.wins}</span>-<span className="text-negative">{s.losses}</span>
                        {s.ties > 0 && <>-<span className="text-text-muted">{s.ties}</span></>}
                      </td>
                      <td className="px-3 py-3 text-right measured">{Number(s.points_for).toFixed(1)}</td>
                      <td className="py-3 pl-3 pr-4 sm:pr-5 text-center measured hidden sm:table-cell">
                        {po ? <span className={po.final_rank === 1 ? "text-gold" : po.final_rank <= 4 ? "text-ink" : "text-text-muted"}>#{po.final_rank}</span> : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <dl className="cell grid grid-cols-2 gap-x-6 gap-y-4 p-4 sm:grid-cols-4 sm:p-5">
            {secondary.map((s) => (
              <div key={s.label}>
                <dt className="text-xs text-text-muted">{s.label}</dt>
                <dd className="measured mt-1 text-lg font-medium text-ink">{s.value}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      {/* Stays mounted so the player data is loaded only once */}
      <div className={tab === "players" ? "" : "hidden"}>
        <ManagerPlayers manager={manager} initialRows={players} />
      </div>

      {tab === "matchups" && (
        <section>
          <div className="cell overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs font-medium text-text-muted">
                  <th className="py-3 pl-4 sm:pl-5 text-left font-medium">Woche</th>
                  <th className="px-3 py-3 text-left font-medium">Gegner</th>
                  <th className="hidden px-3 py-3 text-center font-medium sm:table-cell">Ergebnis</th>
                  <th className="py-3 pl-3 pr-4 sm:pr-5 text-right font-medium">Punkte</th>
                </tr>
              </thead>
              <tbody>
                {matchups.map((m) => {
                  const won = m.myScore > m.theirScore;
                  return (
                    <tr key={`${m.season}-${m.week}`} className="border-t border-border-light">
                      <td className="py-3 pl-4 sm:pl-5 whitespace-nowrap text-text-muted">
                        <span className="measured">{m.season} W{m.week}</span>
                        {m.is_playoff && <span className="ml-2 rounded-[var(--radius-pill)] border border-border px-1.5 py-0.5 text-xs text-ink">Playoffs</span>}
                      </td>
                      <td className="px-3 py-3"><ManagerName id={m.opponent} /></td>
                      <td className="hidden px-3 py-3 text-center sm:table-cell">
                        <span className={`measured text-xs font-medium ${won ? "text-positive" : "text-negative"}`}>
                          {won ? "S" : "N"}
                        </span>
                      </td>
                      <td className="py-3 pl-3 pr-4 sm:pr-5 text-right measured whitespace-nowrap">
                        <span className={won ? "text-positive sm:text-ink" : "text-negative sm:text-ink"}>{m.myScore.toFixed(1)}</span>
                        <span className="text-text-muted"> : </span>
                        <span className="text-text-muted">{m.theirScore.toFixed(1)}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
