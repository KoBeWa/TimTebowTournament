"use client";

import { useState } from "react";
import Tabs from "@/components/ui/Tabs";
import type { GameRow, OddsRow, TrendRow } from "@/lib/playoffs";
import PathToPlayoffs from "./PathToPlayoffs";
import OddsTrend from "./OddsTrend";
import ScheduleMatrix from "./ScheduleMatrix";

type Key = "path" | "trend" | "schedule";
const TABS: { key: Key; label: string }[] = [
  { key: "path", label: "Path to Playoffs" },
  { key: "trend", label: "Verlauf" },
  { key: "schedule", label: "Restprogramm" },
];

// `odds` is sorted by playoff odds, best first
export default function PlayoffTabs({ odds, trend, games, season }: {
  odds: OddsRow[]; trend: TrendRow[]; games: GameRow[]; season: number;
}) {
  const [tab, setTab] = useState<Key>("path");
  return (
    <div>
      <div className="mb-8"><Tabs tabs={TABS} value={tab} onChange={setTab} label="Ansicht" /></div>
      {tab === "path" && <PathToPlayoffs odds={odds} games={games} />}
      {tab === "trend" && <OddsTrend trend={trend} season={season} />}
      {tab === "schedule" && <ScheduleMatrix odds={odds} games={games} />}
    </div>
  );
}
