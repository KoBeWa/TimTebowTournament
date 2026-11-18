"use client";

import { useState } from "react";
import Tabs from "@/components/ui/Tabs";
import StatTile from "@/components/ui/StatTile";
import ManagerName from "@/components/ui/ManagerName";
import DraftBrowser, { type DraftPick } from "./DraftBrowser";
import PositionStats, { type PositionData } from "./PositionStats";
import { sign } from "./shared";
import { fmtPct } from "@/lib/format";

export interface PickRow {
  season_year: number;
  overall_pick: number;
  player_name: string;
  manager_id: string;
  grade4: number;
}
export interface OwnerRanking { id: string; avgGrade: number; picks: number; positive: number }
export interface DraftSummary { season_year: number; manager_id: string; avg: number; draftNo: number }

type TabKey = "overview" | "picks" | "positions" | "all";
const TABS: { key: TabKey; label: string }[] = [
  { key: "overview", label: "Übersicht" },
  { key: "picks", label: "Beste & schlechteste Picks" },
  { key: "positions", label: "Positionen" },
  { key: "all", label: "Alle Picks" },
];

const TH = "py-2.5 text-xs font-medium text-text-muted";

function PickTable({ title, list, tone }: { title: string; list: PickRow[]; tone: "positive" | "negative" }) {
  return (
    <section>
      <h2 className="section-title mb-3 text-ink">{title}</h2>
      <div className="cell overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left">
              <th className={`${TH} pl-4 pr-2 sm:pl-5`}>#</th>
              <th className={`${TH} px-2`}>Spieler</th>
              <th className={`${TH} px-2`}>Owner</th>
              <th className={`${TH} hidden px-2 text-right md:table-cell`}>Pick</th>
              <th className={`${TH} pl-2 pr-4 text-right sm:pr-5`}>Grade</th>
            </tr>
          </thead>
          <tbody>
            {list.map((p, i) => (
              <tr key={`${p.season_year}-${p.overall_pick}`} className="border-t border-border-light">
                <td className="py-2.5 pl-4 pr-2 measured text-text-faint sm:pl-5">{i + 1}</td>
                <td className="px-2 py-2.5">
                  <div className="font-medium text-ink">{p.player_name}</div>
                  <div className="measured text-xs text-text-muted">{p.season_year}</div>
                </td>
                <td className="px-2 py-2.5 text-ink"><ManagerName id={p.manager_id} /></td>
                <td className="hidden px-2 py-2.5 text-right measured text-text-muted md:table-cell">#{p.overall_pick}</td>
                <td className={`py-2.5 pl-2 pr-4 text-right font-semibold measured sm:pr-5 ${tone === "positive" ? "text-positive" : "text-negative"}`}>
                  {sign(p.grade4)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function DraftList({ title, list, tone }: { title: string; list: DraftSummary[]; tone: "positive" | "negative" }) {
  return (
    <section>
      <h2 className="section-title mb-3 text-ink">{title}</h2>
      <div className="cell divide-y divide-border-light">
        {list.map((d, i) => (
          <div key={`${d.season_year}-${d.manager_id}`} className="flex items-center justify-between px-4 py-3 sm:px-5">
            <div className="flex items-center gap-4">
              <div className="measured w-6 text-text-faint">{i + 1}</div>
              <div>
                <div className="font-semibold text-ink"><ManagerName id={d.manager_id} /></div>
                <div className="measured text-xs text-text-muted">Draft #{d.draftNo}, {d.season_year}</div>
              </div>
            </div>
            <div className={`measured text-lg ${tone === "positive" ? "text-positive" : "text-negative"}`}>{sign(d.avg)}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function DraftsTabs({ avgPickValue, avgTeamValue, avgSeasonValue, top10, worst10, ownerRankings, bestDrafts, worstDrafts, positionData, picks }: {
  avgPickValue: number;
  avgTeamValue: number;
  avgSeasonValue: number;
  top10: PickRow[];
  worst10: PickRow[];
  ownerRankings: OwnerRanking[];
  bestDrafts: DraftSummary[];
  worstDrafts: DraftSummary[];
  positionData: PositionData[];
  picks: DraftPick[];
}) {
  const [tab, setTab] = useState<TabKey>("overview");

  return (
    <div className="space-y-8">
      <Tabs tabs={TABS} value={tab} onChange={setTab} label="Draft-Bereiche" />

      {tab === "overview" && (
        <div className="space-y-8">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 [&>*:last-child]:col-span-2 sm:[&>*:last-child]:col-span-1">
            <StatTile label="Ø Pick-Wert" value={sign(avgPickValue)} hint="pro einzelnem Pick" />
            <StatTile label="Ø Team-Wert" value={sign(avgTeamValue)} hint="pro Draft und Owner" />
            <StatTile label="Ø Saison-Wert" value={sign(avgSeasonValue)} hint="pro Saison gesamt" />
          </div>

          <section>
            <h2 className="section-title mb-3 text-ink">Ewige Draft-Rangliste</h2>
            <div className="cell overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left">
                    <th className={`${TH} pl-4 pr-2 sm:pl-5`}>#</th>
                    <th className={`${TH} px-2`}>Owner</th>
                    <th className={`${TH} px-2 text-right`}>Ø Grade</th>
                    <th className={`${TH} hidden px-2 text-right md:table-cell`}>Gesamtwert</th>
                    <th className={`${TH} hidden px-2 text-right md:table-cell`}>Picks</th>
                    <th className={`${TH} pl-2 pr-4 text-right sm:pr-5`}>Positiv</th>
                  </tr>
                </thead>
                <tbody>
                  {ownerRankings.map((o, i) => (
                    <tr key={o.id} className="border-t border-border-light">
                      <td className="py-2.5 pl-4 pr-2 measured text-text-faint sm:pl-5">{i + 1}</td>
                      <td className="px-2 py-2.5 font-semibold text-ink"><ManagerName id={o.id} /></td>
                      <td className={`px-2 py-2.5 text-right font-semibold measured ${o.avgGrade >= 0 ? "text-positive" : "text-negative"}`}>{sign(o.avgGrade)}</td>
                      <td className="hidden px-2 py-2.5 text-right measured text-text-secondary md:table-cell">{sign(o.avgGrade * o.picks)}</td>
                      <td className="hidden px-2 py-2.5 text-right measured text-text-muted md:table-cell">{o.picks}</td>
                      <td className="py-2.5 pl-2 pr-4 text-right measured text-text-secondary sm:pr-5">{fmtPct(o.positive / o.picks, 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
            <DraftList title="Beste Drafts aller Zeiten" list={bestDrafts} tone="positive" />
            <DraftList title="Schlechteste Drafts aller Zeiten" list={worstDrafts} tone="negative" />
          </div>
        </div>
      )}

      {tab === "picks" && (
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          <PickTable title="Beste 10 Picks aller Zeiten" list={top10} tone="positive" />
          <PickTable title="Schlechteste 10 Picks aller Zeiten" list={worst10} tone="negative" />
        </div>
      )}

      {tab === "positions" && <PositionStats data={positionData} />}

      {tab === "all" && <DraftBrowser picks={picks} />}
    </div>
  );
}
