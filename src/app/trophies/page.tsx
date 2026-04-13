"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { MANAGERS } from "@/lib/constants";
import { isBlunder, isNegativeRecord } from "@/lib/classifications";
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

function RecordPills({ labels, negative }: { labels: string[]; negative?: boolean }) {
  if (labels.length === 0) return <span className="text-text-faint text-xs">—</span>;
  return (
    <div className="flex flex-col gap-1">
      {labels.map((l) => (
        <span key={l} className="label-nav text-xs px-1.5 py-0.5 rounded leading-snug"
          style={{
            background: negative ? "rgba(150,35,35,0.08)" : "rgba(26,26,26,0.06)",
            color: negative ? "var(--color-red)" : "var(--color-text-muted)",
          }}>
          {l}
        </span>
      ))}
    </div>
  );
}

export default function TrophyRoomPage() {
  const [tab, setTab] = useState<Tab>("achievements");
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [records, setRecords] = useState<RecordHolder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      const [{ data: ach }, { data: current }] = await Promise.all([
        supabase.from("achievements").select("*").order("season_year", { ascending: false }),
        supabase.from("record_timeline").select("*").eq("is_current", true).order("record_label"),
      ]);
      setAchievements(ach ?? []);
      setRecords(current ?? []);
      setLoading(false);
    }
    fetchData();
  }, []);

  if (loading) return <div className="text-text-muted text-center py-20">Lade Trophy Room...</div>;

  // === ACHIEVEMENTS TAB DATA ===
  const achByManager: Record<string, { positive: Achievement[]; blunders: Achievement[] }> = {};
  for (const m of MANAGERS) achByManager[m] = { positive: [], blunders: [] };
  for (const a of achievements) {
    if (!achByManager[a.manager_id]) achByManager[a.manager_id] = { positive: [], blunders: [] };
    if (isBlunder(a.achievement_key)) {
      achByManager[a.manager_id].blunders.push(a);
    } else {
      achByManager[a.manager_id].positive.push(a);
    }
  }

  const achSummary = MANAGERS.map((m) => {
    const pos = achByManager[m]?.positive ?? [];
    const blu = achByManager[m]?.blunders ?? [];
    return {
      manager: m,
      achievementTypes: new Set(pos.map(a => a.achievement_key)).size,
      achievementTotal: pos.length,
      blunderTypes:     new Set(blu.map(a => a.achievement_key)).size,
      blunderTotal:     blu.length,
      total:            pos.length + blu.length,
    };
  }).sort((a, b) => b.achievementTotal - a.achievementTotal);

  // === RECORDS TAB DATA ===
  const recByManager: Record<string, { positive: RecordHolder[]; negative: RecordHolder[] }> = {};
  for (const m of MANAGERS) recByManager[m] = { positive: [], negative: [] };
  for (const r of records) {
    if (!recByManager[r.manager_id]) recByManager[r.manager_id] = { positive: [], negative: [] };
    if (isNegativeRecord(r.record_key)) {
      recByManager[r.manager_id].negative.push(r);
    } else {
      recByManager[r.manager_id].positive.push(r);
    }
  }

  function uniqueByKey(arr: RecordHolder[]) {
    return Array.from(new Map(arr.map((r) => [r.record_key, r])).values());
  }

  const recSummary = MANAGERS.map((m) => {
    const pos = uniqueByKey(recByManager[m]?.positive ?? []);
    const neg = uniqueByKey(recByManager[m]?.negative ?? []);
    const all = uniqueByKey([...(recByManager[m]?.positive ?? []), ...(recByManager[m]?.negative ?? [])]);
    return { manager: m, positive: pos.length, negative: neg.length, total: all.length };
  }).sort((a, b) => b.positive - a.positive);

  const uniqueRecords = Array.from(
    new Map(records.map((r) => [r.record_key, r])).values()
  ).sort((a, b) => a.record_label.localeCompare(b.record_label));

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
            onClick={() => setTab(t)}
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
        <div className="cell overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-text-muted text-left">
                <th className="p-4 label-nav text-xs">Owner</th>
                <th className="p-4 label-nav text-xs text-center">Achievements</th>
                <th className="p-4 label-nav text-xs text-center"># Total</th>
                <th className="p-4 label-nav text-xs text-center">Blunders</th>
                <th className="p-4 label-nav text-xs text-center"># Total</th>
                <th className="p-4 label-nav text-xs text-center">Total Badges</th>
              </tr>
            </thead>
            <tbody>
              {achSummary.map((row) => (
                <tr key={row.manager} className="border-b border-border-light transition-colors hover:bg-cream/60">
                  <td className="p-4">
                    <Link
                      href={`/trophies/${encodeURIComponent(row.manager)}`}
                      className="font-medium text-ink hover:text-red transition-colors"
                    >
                      {row.manager}
                    </Link>
                  </td>
                  <td className="p-4 text-center font-semibold text-ink font-mono">
                    {row.achievementTypes}
                  </td>
                  <td className="p-4 text-center font-mono text-text-muted text-xs">
                    {row.achievementTotal}
                  </td>
                  <td className="p-4 text-center font-semibold font-mono" style={{ color: "var(--color-red)" }}>
                    {row.blunderTypes}
                  </td>
                  <td className="p-4 text-center font-mono text-text-muted text-xs">
                    {row.blunderTotal}
                  </td>
                  <td className="p-4 text-center font-semibold text-ink font-mono">
                    {row.total}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ============ RECORDS TAB ============ */}
      {tab === "records" && (
        <div className="space-y-8">
          <div className="cell overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-text-muted text-left">
                  <th className="p-4 label-nav text-xs">Owner</th>
                  <th className="p-4 label-nav text-xs text-center">Positive Held</th>
                  <th className="p-4 label-nav text-xs text-center">Negative Held</th>
                  <th className="p-4 label-nav text-xs text-center">Total Held</th>
                </tr>
              </thead>
              <tbody>
                {recSummary.map((row) => (
                  <tr key={row.manager} className="border-b border-border-light transition-colors align-top">
                    <td className="p-4 font-medium text-ink">
                      <Link href={`/manager/${row.manager}`} className="hover:text-red transition-colors">{row.manager}</Link>
                    </td>
                    <td className="p-4 text-center font-semibold text-ink">{row.positive}</td>
                    <td className="p-4 text-center font-semibold" style={{ color: "var(--color-red)" }}>{row.negative}</td>
                    <td className="p-4 text-center font-semibold text-ink">{row.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Link
            href="/trophies/records"
            className="cell-hover p-5 flex items-center justify-between group"
          >
            <div>
              <div className="font-semibold text-ink group-hover:text-red transition-colors">Alle Records durchsuchen</div>
              <div className="text-text-muted text-sm mt-0.5">
                {uniqueRecords.length} Records in 8 Kategorien
              </div>
            </div>
            <span className="text-text-muted group-hover:text-red transition-colors text-lg">→</span>
          </Link>
        </div>
      )}
    </div>
  );
}
