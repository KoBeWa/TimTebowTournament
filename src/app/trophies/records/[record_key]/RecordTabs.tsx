"use client";

import { useState } from "react";
import Tabs from "@/components/ui/Tabs";

const TABS = [
  { key: "history", label: "Verlauf" },
  { key: "ranking", label: "Rangliste" },
] as const;

// Server-rendered content is passed in as nodes; this only switches between them
export default function RecordTabs({ ranking, history }: { ranking: React.ReactNode; history: React.ReactNode }) {
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("history");
  return (
    <div className="space-y-5">
      <Tabs tabs={TABS} value={tab} onChange={setTab} label="Ansicht" />
      {tab === "ranking" ? ranking : history}
    </div>
  );
}
