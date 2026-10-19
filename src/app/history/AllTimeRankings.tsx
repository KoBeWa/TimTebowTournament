"use client";

import Link from "next/link";
import { useState } from "react";

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
const fmtPct = (r: Rec) => (games(r) ? `${(pct(r) * 100).toFixed(1)}%` : "—");

/** Sorted by the record of the tab: win share, then wins. */
function byRecord(rows: AllTimeRow[], key: "total" | "regular" | "playoffs") {
  return [...rows].sort((a, b) => pct(b[key]) - pct(a[key]) || b[key].w - a[key].w || b.medalScore - a.medalScore);
}

const TH = "label-nav text-xs text-text-muted py-2";

export default function AllTimeRankings({ rows }: { rows: AllTimeRow[] }) {
  const [tab, setTab] = useState<Tab>("total");
  const sorted = byRecord(rows, tab);

  return (
    <div className="mb-10">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div>
          <div className="kicker">Alltime Rankings</div>
          <p className="text-xs text-text-muted mt-0.5">
            Sortiert nach Bilanz {tab === "total" ? "inkl. Playoffs" : tab === "regular" ? "der Regular Season" : "in den Playoffs (inkl. Platzierungsspiele)"}
          </p>
        </div>
        <div className="flex" style={{ border: "1px solid var(--color-border)", borderRadius: "4px", overflow: "hidden" }}>
          {TABS.map((t, i) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className="label-nav text-xs px-3 py-1.5 transition-colors"
              style={{
                background: tab === t.key ? "var(--color-ink)" : "transparent",
                color: tab === t.key ? "var(--color-cream)" : "var(--color-text-muted)",
                borderRight: i < TABS.length - 1 ? "1px solid var(--color-border)" : undefined,
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm" style={{ borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "2px solid var(--color-border-strong)" }}>
              <th className={`${TH} text-left pr-4`}>#</th>
              <th className={`${TH} text-left pr-6`}>Manager</th>
              <th className={`${TH} text-right pr-6`}>Record</th>
              <th className={`${TH} text-right pr-6`}>Win%</th>
              {tab === "total" && (
                <>
                  <th className={`${TH} text-right pr-6`}>Regular</th>
                  <th className={`${TH} text-right pr-6`}>Playoffs</th>
                  <th className={`${TH} text-right pr-6`} title="Punkte pro Spiel">PPG</th>
                  <th className={`${TH} text-left pr-6`}>Titel</th>
                  <th className={`${TH} text-right`}>ELO</th>
                </>
              )}
              {tab === "regular" && (
                <>
                  <th className={`${TH} text-right pr-6`} title="Bilanz, wenn man jede Woche gegen alle spielen würde">All Play</th>
                  <th className={`${TH} text-right pr-6`}>AP Win%</th>
                  <th className={`${TH} text-right`}>ELO</th>
                </>
              )}
              {tab === "playoffs" && (
                <>
                  <th className={`${TH} text-right pr-6`} title="Nur Spiele um die Meisterschaft">Titelrunde</th>
                  <th className={`${TH} text-right pr-6`}>Teilnahmen</th>
                  <th className={`${TH} text-right pr-6`} title="Gold 8 · Silber 5 · Bronze 2">Medal Score</th>
                  <th className={`${TH} text-left`}>Trophäen</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {sorted.map((row, i) => (
              <tr key={row.manager_id} style={{ borderBottom: "1px solid var(--color-border-light)" }}
                className="hover:bg-border-light transition-colors">
                <td className="py-3 pr-4 text-text-faint label-nav text-xs">{i + 1}</td>
                <td className="py-3 pr-6">
                  <Link href={`/manager/${row.manager_id}`} className="font-semibold text-ink hover:text-red transition-colors">
                    {row.manager_id}
                  </Link>
                </td>
                <td className="py-3 pr-6 text-right font-mono text-ink">{fmtRec(row[tab])}</td>
                <td className="py-3 pr-6 text-right font-mono text-ink">{fmtPct(row[tab])}</td>
                {tab === "total" && (
                  <>
                    <td className="py-3 pr-6 text-right font-mono text-text-secondary">{fmtRec(row.regular)}</td>
                    <td className="py-3 pr-6 text-right font-mono text-text-secondary">{fmtRec(row.playoffs)}</td>
                    <td className="py-3 pr-6 text-right font-mono text-text-secondary">{row.ppg.toFixed(1)}</td>
                    <td className="py-3 pr-6 text-text-secondary whitespace-nowrap">
                      {row.gold > 0 ? <span className="text-gold font-semibold">{row.gold}× Champion</span> : "—"}
                    </td>
                    <td className="py-3 text-right font-mono text-text-secondary">{row.elo ?? "—"}</td>
                  </>
                )}
                {tab === "regular" && (
                  <>
                    <td className="py-3 pr-6 text-right font-mono text-text-secondary">{fmtRec(row.allPlay)}</td>
                    <td className="py-3 pr-6 text-right font-mono text-text-secondary">{fmtPct(row.allPlay)}</td>
                    <td className="py-3 text-right font-mono text-text-secondary">{row.elo ?? "—"}</td>
                  </>
                )}
                {tab === "playoffs" && (
                  <>
                    <td className="py-3 pr-6 text-right font-mono text-text-secondary">{fmtRec(row.bracket)}</td>
                    <td className="py-3 pr-6 text-right font-mono text-text-secondary">{row.playoffAppearances}</td>
                    <td className="py-3 pr-6 text-right font-mono text-ink">{row.medalScore}</td>
                    <td className="py-3">
                      <span className="font-mono text-xs text-text-secondary">
                        {[
                          row.gold > 0 ? `${row.gold}x Gold` : null,
                          row.silver > 0 ? `${row.silver}x Silber` : null,
                          row.bronze > 0 ? `${row.bronze}x Bronze` : null,
                        ].filter(Boolean).join(" · ") || "—"}
                      </span>
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
