"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { MANAGERS } from "@/lib/constants";
import { isBlunder, isNegativeRecord, achievementLabel } from "@/lib/classifications";
import Link from "next/link";

type Tab = "achievements" | "records";

interface Achievement {
  achievement_key: string;
  achievement_category: string;
  manager_id: string;
  season_year: number;
  value: string | null;
  description: string;
}

interface RecordHolder {
  record_key: string;
  record_label: string;
  manager_id: string;
  record_value: string;
  is_current: boolean;
  from_year: number;
}

export default function TrophyRoomPage() {
  const [tab, setTab] = useState<Tab>("achievements");
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [records, setRecords] = useState<RecordHolder[]>([]);
  const [selectedManager, setSelectedManager] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetch() {
      setLoading(true);
      const [{ data: ach }, { data: rec }] = await Promise.all([
        supabase.from("achievements").select("*").order("season_year", { ascending: false }),
        supabase.from("record_timeline").select("*").eq("is_current", true).order("record_label"),
      ]);
      setAchievements(ach ?? []);
      setRecords(rec ?? []);
      setLoading(false);
    }
    fetch();
  }, []);

  if (loading) return <div className="text-text-muted text-center py-20">Lade Trophy Room...</div>;

  // === ACHIEVEMENTS TAB DATA ===
  const achByManager: Record<string, { positive: Achievement[]; blunders: Achievement[] }> = {};
  for (const m of MANAGERS) {
    achByManager[m] = { positive: [], blunders: [] };
  }
  for (const a of achievements) {
    if (!achByManager[a.manager_id]) achByManager[a.manager_id] = { positive: [], blunders: [] };
    if (isBlunder(a.achievement_key)) {
      achByManager[a.manager_id].blunders.push(a);
    } else {
      achByManager[a.manager_id].positive.push(a);
    }
  }

  const achSummary = MANAGERS.map((m) => ({
    manager: m,
    achievements: achByManager[m]?.positive.length ?? 0,
    blunders: achByManager[m]?.blunders.length ?? 0,
    total: (achByManager[m]?.positive.length ?? 0) + (achByManager[m]?.blunders.length ?? 0),
  })).sort((a, b) => b.achievements - a.achievements);

  // === RECORDS TAB DATA ===
  const recByManager: Record<string, { positive: RecordHolder[]; negative: RecordHolder[] }> = {};
  for (const m of MANAGERS) {
    recByManager[m] = { positive: [], negative: [] };
  }
  for (const r of records) {
    if (!recByManager[r.manager_id]) recByManager[r.manager_id] = { positive: [], negative: [] };
    if (isNegativeRecord(r.record_key)) {
      recByManager[r.manager_id].negative.push(r);
    } else {
      recByManager[r.manager_id].positive.push(r);
    }
  }

  // Count unique record_keys per manager (some records might have duplicate entries)
  function countUnique(arr: RecordHolder[]) {
    return new Set(arr.map((r) => r.record_key)).size;
  }

  const recSummary = MANAGERS.map((m) => ({
    manager: m,
    positive: countUnique(recByManager[m]?.positive ?? []),
    negative: countUnique(recByManager[m]?.negative ?? []),
    total: countUnique([...(recByManager[m]?.positive ?? []), ...(recByManager[m]?.negative ?? [])]),
  })).sort((a, b) => b.positive - a.positive);

  // Unique record list for browse
  const uniqueRecords = Array.from(
    new Map(records.map((r) => [r.record_key, r])).values()
  ).sort((a, b) => a.record_label.localeCompare(b.record_label));

  // Selected manager detail
  const selectedAch = selectedManager ? achByManager[selectedManager] : null;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="display-title text-4xl md:text-5xl text-ink">Trophy Room</h1>
        <p className="text-text-secondary mt-2">Records, Achievements und der ewige Ruhm</p>
      </div>

      {/* Tab Switcher */}
      <div className="flex gap-2">
        {(["achievements", "records"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => { setTab(t); setSelectedManager(null); }}
            className={`px-5 py-2.5 transition-colors ${
              tab === t
                ? "bg-ink text-cream label-nav border border-ink"
                : "bg-cream text-text-secondary label-nav border border-border"
            }`}
          >
            {t === "achievements" ? "Achievements" : "Records"}
          </button>
        ))}
      </div>

      {/* ============ ACHIEVEMENTS TAB ============ */}
      {tab === "achievements" && (
        <div className="space-y-8">
          {/* Summary Table */}
          <div className="cell overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-text-muted text-left">
                  <th className="p-4">Member</th>
                  <th className="p-4 text-center">Achievements</th>
                  <th className="p-4 text-center">Blunders</th>
                  <th className="p-4 text-center">Total Badges</th>
                </tr>
              </thead>
              <tbody>
                {achSummary.map((row) => (
                  <tr
                    key={row.manager}
                    onClick={() => setSelectedManager(selectedManager === row.manager ? null : row.manager)}
                    className={`border-b border-border-light cursor-pointer transition-colors ${
                      selectedManager === row.manager ? "bg-cream" : ""
                    }`}
                  >
                    <td className="p-4 font-medium text-ink">{row.manager}</td>
                    <td className="p-4 text-center">
                      <span className="text-ink font-semibold">{row.achievements}</span>
                    </td>
                    <td className="p-4 text-center">
                      <span className="text-red font-semibold">{row.blunders}</span>
                    </td>
                    <td className="p-4 text-center">
                      <span className="text-ink font-semibold">{row.total}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Manager Detail */}
          {selectedManager && selectedAch && (
            <div className="space-y-6">
              <h2 className="section-title text-ink">
                {selectedManager}&apos;s Achievements
              </h2>

              {/* Positive Achievements */}
              <div>
                <h3 className="text-xl tracking-wide text-ink font-semibold mb-3 section-title">
                  Achievements ({selectedAch.positive.length})
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {selectedAch.positive.map((a, i) => (
                    <div key={`${a.achievement_key}-${a.season_year}-${i}`} className="cell p-4">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-ink">{achievementLabel(a.achievement_key)}</span>
                        <span className="text-text-muted text-xs">{a.season_year}</span>
                      </div>
                      <div className="text-text-muted text-xs mt-1">{a.description}</div>
                      {a.value && <div className="text-red text-xs mt-1 font-mono">Wert: {a.value}</div>}
                    </div>
                  ))}
                </div>
              </div>

              {/* Blunders */}
              <div>
                <h3 className="text-xl tracking-wide text-red mb-3 section-title">
                  Blunders ({selectedAch.blunders.length})
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {selectedAch.blunders.map((a, i) => (
                    <div key={`${a.achievement_key}-${a.season_year}-${i}`} className="cell p-4" style={{ borderColor: "var(--color-accent-red)", borderWidth: "1px", opacity: 0.85 }}>
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-ink">{achievementLabel(a.achievement_key)}</span>
                        <span className="text-text-muted text-xs">{a.season_year}</span>
                      </div>
                      <div className="text-text-muted text-xs mt-1">{a.description}</div>
                      {a.value && <div className="text-red text-xs mt-1 font-mono">Wert: {a.value}</div>}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ============ RECORDS TAB ============ */}
      {tab === "records" && (
        <div className="space-y-8">
          {/* Summary Table */}
          <div className="cell overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-text-muted text-left">
                  <th className="p-4">Member</th>
                  <th className="p-4 text-center">Positive Held</th>
                  <th className="p-4 text-center">Negative Held</th>
                  <th className="p-4 text-center">Total Held</th>
                </tr>
              </thead>
              <tbody>
                {recSummary.map((row) => (
                  <tr key={row.manager} className="border-b border-border-light transition-colors">
                    <td className="p-4 font-medium text-ink">
                      <Link href={`/manager/${row.manager}`} className="hover:text-red transition-colors">{row.manager}</Link>
                    </td>
                    <td className="p-4 text-center"><span className="text-ink font-semibold">{row.positive}</span></td>
                    <td className="p-4 text-center"><span className="text-red font-semibold">{row.negative}</span></td>
                    <td className="p-4 text-center"><span className="text-ink font-semibold">{row.total}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* All Records List */}
          <div>
            <h2 className="section-title text-ink mb-4">Alle Records</h2>

            {/* Group by positive/negative */}
            {[
              { label: "Positive Records", items: uniqueRecords.filter((r) => !isNegativeRecord(r.record_key)), color: "text-ink font-semibold" },
              { label: "Negative Records", items: uniqueRecords.filter((r) => isNegativeRecord(r.record_key)), color: "text-red" },
            ].map((group) => (
              <div key={group.label} className="mb-6">
                <h3 className={`text-xl tracking-wide mb-3 section-title ${group.color}`}>
                  {group.label} ({group.items.length})
                </h3>
                <div className="space-y-2">
                  {group.items.map((r) => (
                    <Link
                      key={r.record_key}
                      href={`/trophies/records/${r.record_key}`}
                      className="cell-hover p-4 flex items-center justify-between group"
                    >
                      <div>
                        <div className="font-medium text-ink group-hover:text-red transition-colors">
                          {r.record_label}
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <div className="text-ink font-semibold">{r.manager_id}</div>
                          <div className="text-text-muted text-xs font-mono">{Number(r.record_value).toFixed(2)}</div>
                        </div>
                        <span className="text-text-muted group-hover:text-red transition-colors">→</span>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
