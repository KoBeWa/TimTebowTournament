"use client";

import { useState } from "react";
import Tabs from "@/components/ui/Tabs";

const TABS = [
  { key: "ranking", label: "Ranking" },
  { key: "timeline", label: "Timeline" },
] as const;

// Server-rendered content is passed in as nodes; this only switches between them
export default function RecordTabs({ ranking, timeline }: { ranking: React.ReactNode; timeline: React.ReactNode }) {
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("ranking");
  return (
    <div className="space-y-5">
      <Tabs tabs={TABS} value={tab} onChange={setTab} label="Ansicht" />
      {tab === "ranking" ? ranking : timeline}
    </div>
  );
}
