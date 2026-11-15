"use client";

import { useState } from "react";
import Tabs from "@/components/ui/Tabs";

export type TrophyCard = {
  key: string;
  title: string;
  count: number;
  labels: string[];
  description: string | null;
  values: string[];
};
type Medal = { icon: string; label: string; rank: number; year: number };
type Category = { key: string; label: string; cards: TrophyCard[] };

const MEDAL_BORDER = ["var(--color-gold-dark)", "var(--color-silver)", "var(--color-bronze)"];

// One tab per badge group so a manager page shows one block at a time
export default function TrophyTabs({ medals, categories, blunders }: {
  medals: Medal[];
  categories: Category[];
  blunders: TrophyCard[];
}) {
  const tabs = [
    ...(medals.length > 0 ? [{ key: "medals", label: "Medaillen", count: medals.length }] : []),
    ...categories.map((c) => ({ key: c.key, label: c.label.replace(" Badges", ""), count: c.cards.length })),
    ...(blunders.length > 0 ? [{ key: "blunders", label: "Blunders", count: blunders.length }] : []),
  ];
  const [tab, setTab] = useState(tabs[0]?.key ?? "");

  if (tabs.length === 0) return <p className="py-12 text-center text-text-muted">Noch keine Badges.</p>;

  const cat = categories.find((c) => c.key === tab);

  return (
    <div className="space-y-5">
      <Tabs tabs={tabs} value={tab} onChange={setTab} label="Badge-Gruppe" />

      {tab === "medals" && (
        <div className="flex flex-wrap gap-3">
          {medals.map((m, i) => (
            <div key={i} className="cell flex items-center gap-3 px-5 py-3"
              style={{ borderColor: MEDAL_BORDER[m.rank - 1], borderWidth: "1px" }}>
              <span className="text-2xl leading-none">{m.icon}</span>
              <div>
                <div className="text-xs text-text-muted">{m.label}</div>
                <div className="display-title text-lg text-ink">{m.year}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {cat && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {cat.cards.map((c) => <AchievementCard key={c.key} card={c} blunder={false} />)}
        </div>
      )}

      {tab === "blunders" && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {blunders.map((c) => <AchievementCard key={c.key} card={c} blunder />)}
        </div>
      )}
    </div>
  );
}

function AchievementCard({ card, blunder }: { card: TrophyCard; blunder: boolean }) {
  return (
    <div className={`cell p-4 ${blunder ? "border border-red/60" : ""}`}>
      <div className="mb-1 flex items-start justify-between gap-2">
        <span className="text-sm font-semibold leading-snug text-ink">{card.title}</span>
        {card.count > 1 && (
          <span className={`shrink-0 rounded px-1.5 py-0.5 text-xs font-bold ${blunder ? "bg-red/10 text-negative" : "bg-surface-3 text-text-muted"}`}>
            ×{card.count}
          </span>
        )}
      </div>
      <div className="mb-1 text-xs text-text-muted">{card.labels.join(", ")}</div>
      {card.description && <div className="text-xs leading-snug text-text-muted">{card.description}</div>}
      {card.values.length > 0 && (
        <div className={`mt-1 text-xs tabular-nums ${blunder ? "text-negative" : "text-text-muted"}`}>{card.values.join(", ")}</div>
      )}
    </div>
  );
}
