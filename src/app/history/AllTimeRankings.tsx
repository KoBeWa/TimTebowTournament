"use client";

import { useState } from "react";
import Tabs from "@/components/ui/Tabs";
import ManagerName from "@/components/ui/ManagerName";

type Rec = { w: number; l: number; t: number };

export type AllTimeRow = {
  manager_id: string;
  total: Rec;      // regular season + all postseason games
  regular: Rec;
  playoffs: Rec;   // all postseason games (championship bracket + consolation)
  bracket: Rec;    // championship bracket only
  allPlay: Rec;
  pf: number;
  ppg: number;
  elo: number | null;
  playoffAppearances: number;
  gold: number;
  silver: number;
  bronze: number;
  medalScore: number;
};

type Tab = "total" | "regular" | "playoffs";

const TABS: { key: Tab; label: string }[] = [
  { key: "total", label: "Gesamt" },
  { key: "regular", label: "Regular Season" },
  { key: "playoffs", label: "Playoffs" },
];

const games = (r: Rec) => r.w + r.l + r.t;
const pct = (r: Rec) => (games(r) ? (r.w + r.t / 2) / games(r) : 0);
const fmtRec = (r: Rec) => `${r.w}–${r.l}${r.t > 0 ? `–${r.t}` : ""}`;
const fmtPct = (r: Rec) => (games(r) ? `${(pct(r) * 100).toFixed(1)}%` : "–");

/** Sorted by the record of the tab: win share, then wins. */
function byRecord(rows: AllTimeRow[], key: "total" | "regular" | "playoffs") {
  return [...rows].sort((a, b) => pct(b[key]) - pct(a[key]) || b[key].w - a[key].w || b.medalScore - a.medalScore);
}

const TH = "px-4 py-2.5 text-xs font-medium text-text-muted";
const TD = "measured px-4 py-2.5 text-right whitespace-nowrap";

export default function AllTimeRankings({ rows }: { rows: AllTimeRow[] }) {
  const [tab, setTab] = useState<Tab>("total");
  const sorted = byRecord(rows, tab);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-text-muted">
          Sortiert nach Bilanz {tab === "total" ? "inkl. Playoffs" : tab === "regular" ? "der Regular Season" : "in den Playoffs (inkl. Platzierungsspiele)"}
        </p>
        <Tabs tabs={TABS} value={tab} onChange={setTab} size="sm" label="Zeitraum" />
      </div>

      <div className="cell overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className={`${TH} text-left`}>#</th>
              <th className={`${TH} text-left`}>Manager</th>
              <th className={`${TH} text-right`}>Record</th>
              <th className={`${TH} text-right`}>Win%</th>
              {tab === "total" && (
                <>
                  <th className={`${TH} hidden text-right md:table-cell`}>Regular</th>
                  <th className={`${TH} hidden text-right md:table-cell`}>Playoffs</th>
                  <th className={`${TH} hidden text-right md:table-cell`} title="Punkte pro Spiel">PPG</th>
                  <th className={`${TH} text-left`}>Titel</th>
                  <th className={`${TH} text-right`}>ELO</th>
                </>
              )}
              {tab === "regular" && (
                <>
                  <th className={`${TH} text-right`} title="Bilanz, wenn man jede Woche gegen alle spielen würde">All Play</th>
                  <th className={`${TH} text-right`}>AP Win%</th>
                  <th className={`${TH} text-right`}>ELO</th>
                </>
              )}
              {tab === "playoffs" && (
                <>
                  <th className={`${TH} text-right`} title="Nur Spiele um die Meisterschaft">Titelrunde</th>
                  <th className={`${TH} text-right`}>Teilnahmen</th>
                  <th className={`${TH} text-right`} title="Gold 8, Silber 5, Bronze 2">Medal Score</th>
                  <th className={`${TH} text-left`}>Trophäen</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {sorted.map((row, i) => (
              <tr key={row.manager_id} className="border-t border-border-light hover:bg-surface-2">
                <td className="measured px-4 py-2.5 text-xs text-text-faint">{i + 1}</td>
                <td className="px-4 py-2.5 font-medium text-ink"><ManagerName id={row.manager_id} /></td>
                <td className={`${TD} text-ink`}>{fmtRec(row[tab])}</td>
                <td className={`${TD} text-ink`}>{fmtPct(row[tab])}</td>
                {tab === "total" && (
                  <>
                    <td className={`${TD} hidden text-text-secondary md:table-cell`}>{fmtRec(row.regular)}</td>
                    <td className={`${TD} hidden text-text-secondary md:table-cell`}>{fmtRec(row.playoffs)}</td>
                    <td className={`${TD} hidden text-text-secondary md:table-cell`}>{row.ppg.toFixed(1)}</td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-text-secondary">
                      {row.gold > 0 ? <span className="font-medium text-gold">{row.gold}× Champion</span> : "–"}
                    </td>
                    <td className={`${TD} text-text-secondary`}>{row.elo ?? "–"}</td>
                  </>
                )}
                {tab === "regular" && (
                  <>
                    <td className={`${TD} text-text-secondary`}>{fmtRec(row.allPlay)}</td>
                    <td className={`${TD} text-text-secondary`}>{fmtPct(row.allPlay)}</td>
                    <td className={`${TD} text-text-secondary`}>{row.elo ?? "–"}</td>
                  </>
                )}
                {tab === "playoffs" && (
                  <>
                    <td className={`${TD} text-text-secondary`}>{fmtRec(row.bracket)}</td>
                    <td className={`${TD} text-text-secondary`}>{row.playoffAppearances}</td>
                    <td className={`${TD} text-ink`}>{row.medalScore}</td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-xs text-text-secondary">
                      {[
                        row.gold > 0 ? `${row.gold}x Gold` : null,
                        row.silver > 0 ? `${row.silver}x Silber` : null,
                        row.bronze > 0 ? `${row.bronze}x Bronze` : null,
                      ].filter(Boolean).join(", ") || "–"}
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
