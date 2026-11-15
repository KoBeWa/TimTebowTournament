"use client";

import { useState } from "react";
import Tabs from "@/components/ui/Tabs";
import ManagerName from "@/components/ui/ManagerName";
import { sign } from "./shared";

export interface PositionPickRow {
  season_year: number;
  overall_pick: number;
  player_name: string;
  manager_id: string;
  grade4: number;
  team: string | null;
}

export interface PositionOwnerRow {
  id: string;
  avgGrade: number;
  picks: number;
  positive: number;
}

export interface PositionData {
  position: string;
  ownerRankings: PositionOwnerRow[];
  top5: PositionPickRow[];
  worst5: PositionPickRow[];
}

const POSITIONS = ["QB", "RB", "WR", "TE", "K", "DST"];
const POSITION_TABS = POSITIONS.map((p) => ({ key: p, label: p }));

const POS_LABEL: Record<string, string> = {
  QB: "Quarterback", RB: "Running Back", WR: "Wide Receiver",
  TE: "Tight End", K: "Kicker", DST: "Defense",
};

const TH = "py-2.5 text-xs font-medium text-text-muted";

function PickTable({ title, rows, tone }: { title: string; rows: PositionPickRow[]; tone: "positive" | "negative" }) {
  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold text-ink">{title}</h3>
      <div className="cell overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left">
              <th className={`${TH} pl-4 pr-2 sm:pl-5`}>#</th>
              <th className={`${TH} px-2`}>Spieler</th>
              <th className={`${TH} px-2 text-right`}>Pick</th>
              <th className={`${TH} pl-2 pr-4 text-right sm:pr-5`}>Grade</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p, i) => (
              <tr key={`${p.season_year}-${p.overall_pick}`} className="border-t border-border-light">
                <td className="py-2.5 pl-4 pr-2 tabular-nums text-text-faint sm:pl-5">{i + 1}</td>
                <td className="px-2 py-2.5">
                  <div className="font-medium text-ink">{p.player_name}</div>
                  <div className="flex items-center gap-1.5 text-xs text-text-muted">
                    <ManagerName id={p.manager_id} /> <span>{p.season_year}</span>
                  </div>
                </td>
                <td className="px-2 py-2.5 text-right tabular-nums text-text-muted">#{p.overall_pick}</td>
                <td className={`py-2.5 pl-2 pr-4 text-right font-semibold tabular-nums sm:pr-5 ${tone === "positive" ? "text-positive" : "text-negative"}`}>
                  {sign(p.grade4)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function PositionStats({ data }: { data: PositionData[] }) {
  const [pos, setPos] = useState("QB");

  const current = data.find((d) => d.position === pos);
  if (!current) return null;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="section-title text-ink">{POS_LABEL[pos] ?? pos}</h2>
        <Tabs tabs={POSITION_TABS} value={pos} onChange={setPos} label="Position" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div>
          <h3 className="mb-2 text-sm font-semibold text-ink">Owner-Ranking</h3>
          <div className="cell overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left">
                  <th className={`${TH} pl-4 pr-2 sm:pl-5`}>#</th>
                  <th className={`${TH} px-2`}>Owner</th>
                  <th className={`${TH} px-2 text-right`}>Ø Grade</th>
                  <th className={`${TH} pl-2 pr-4 text-right sm:pr-5`}>Picks</th>
                </tr>
              </thead>
              <tbody>
                {current.ownerRankings.map((o, i) => (
                  <tr key={o.id} className="border-t border-border-light">
                    <td className="py-2.5 pl-4 pr-2 tabular-nums text-text-faint sm:pl-5">{i + 1}</td>
                    <td className="px-2 py-2.5 font-medium text-ink"><ManagerName id={o.id} /></td>
                    <td className={`px-2 py-2.5 text-right font-semibold tabular-nums ${o.avgGrade >= 0 ? "text-positive" : "text-negative"}`}>
                      {sign(o.avgGrade)}
                    </td>
                    <td className="py-2.5 pl-2 pr-4 text-right tabular-nums text-text-muted sm:pr-5">{o.picks}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <PickTable title="Beste 5 Picks" rows={current.top5} tone="positive" />
        <PickTable title="Schlechteste 5 Picks" rows={current.worst5} tone="negative" />
      </div>
    </div>
  );
}
