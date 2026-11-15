"use client";

import { useState } from "react";
import Tabs from "@/components/ui/Tabs";

type Key = "table" | "trends" | "seasons";

const TABS: { key: Key; label: string }[] = [
  { key: "table", label: "Ewige Tabelle" },
  { key: "trends", label: "Verlauf" },
  { key: "seasons", label: "Seasons" },
];

// Page-level tabs; the three sections are rendered on the server and passed in
export default function HistoryTabs({ table, trends, seasons }: {
  table: React.ReactNode;
  trends: React.ReactNode;
  seasons: React.ReactNode;
}) {
  const [tab, setTab] = useState<Key>("table");
  return (
    <div>
      <div className="mb-5">
        <Tabs tabs={TABS} value={tab} onChange={setTab} label="Bereich" />
      </div>
      {tab === "table" && table}
      {tab === "trends" && trends}
      {tab === "seasons" && seasons}
    </div>
  );
}
