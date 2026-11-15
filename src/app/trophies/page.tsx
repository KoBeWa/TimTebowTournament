"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { MANAGERS } from "@/lib/constants";
import { isBlunder, isNegativeRecord } from "@/lib/classifications";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import Tabs from "@/components/ui/Tabs";
import ManagerName from "@/components/ui/ManagerName";

type Tab = "achievements" | "records";

// The third entry leaves for the records browser so the three pages feel like one place
const TABS = [
  { key: "achievements", label: "Achievements" },
  { key: "records", label: "Records" },
  { key: "browse", label: <span className="inline-flex items-center gap-1">Alle Records <ChevronRight size={12} /></span> },
] as const;

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
  const router = useRouter();
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

  if (loading) return <div className="py-20 text-center text-text-muted">Lade Trophy Room…</div>;

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

  const th = "py-3 px-3 text-center text-xs font-medium text-text-muted";

  return (
    <div className="space-y-6">
      <PageHeader title="Trophy Room" description="Records, Achievements und der ewige Ruhm." />

      <Tabs tabs={TABS} value={tab} label="Bereich"
        onChange={(k) => { if (k === "browse") router.push("/trophies/records"); else setTab(k); }} />

      {tab === "achievements" && (
        <div className="cell overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="py-3 pl-4 pr-3 text-left text-xs font-medium text-text-muted sm:pl-5">Manager</th>
                <th className={th}>Achievements</th>
                <th className={`${th} hidden sm:table-cell`}>Anzahl</th>
                <th className={th}>Blunders</th>
                <th className={`${th} hidden sm:table-cell`}>Anzahl</th>
                <th className={th}>Badges gesamt</th>
                <th className="w-10 py-3 pr-4 sm:pr-5"><span className="sr-only">Trophäen</span></th>
              </tr>
            </thead>
            <tbody>
              {achSummary.map((row) => (
                <tr key={row.manager} className="border-t border-border-light hover:bg-surface-2">
                  <td className="py-3 pl-4 pr-3 font-medium sm:pl-5">
                    <ManagerName id={row.manager} />
                  </td>
                  <td className="px-3 py-3 text-center font-semibold tabular-nums text-ink">{row.achievementTypes}</td>
                  <td className="hidden px-3 py-3 text-center text-xs tabular-nums text-text-muted sm:table-cell">{row.achievementTotal}</td>
                  <td className="px-3 py-3 text-center font-semibold tabular-nums text-negative">{row.blunderTypes}</td>
                  <td className="hidden px-3 py-3 text-center text-xs tabular-nums text-text-muted sm:table-cell">{row.blunderTotal}</td>
                  <td className="px-3 py-3 text-center font-semibold tabular-nums text-ink">{row.total}</td>
                  <td className="py-3 pr-4 text-right sm:pr-5">
                    <Link href={`/trophies/${encodeURIComponent(row.manager)}`} aria-label={`Trophäen von ${row.manager}`}
                      className="inline-flex text-text-muted hover:text-red"><ChevronRight size={16} /></Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "records" && (
        <div className="space-y-6">
          <div className="cell overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="py-3 pl-4 pr-3 text-left text-xs font-medium text-text-muted sm:pl-5">Manager</th>
                  <th className={th}>Positive Records</th>
                  <th className={th}>Negative Records</th>
                  <th className={`${th} pr-4 sm:pr-5`}>Records gesamt</th>
                </tr>
              </thead>
              <tbody>
                {recSummary.map((row) => (
                  <tr key={row.manager} className="border-t border-border-light">
                    <td className="py-3 pl-4 pr-3 font-medium sm:pl-5"><ManagerName id={row.manager} /></td>
                    <td className="px-3 py-3 text-center font-semibold tabular-nums text-ink">{row.positive}</td>
                    <td className="px-3 py-3 text-center font-semibold tabular-nums text-negative">{row.negative}</td>
                    <td className="py-3 pl-3 pr-4 text-center font-semibold tabular-nums text-ink sm:pr-5">{row.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Link href="/trophies/records" className="cell-hover group flex items-center justify-between p-5">
            <div>
              <div className="font-semibold text-ink transition-colors group-hover:text-red">Alle Records durchsuchen</div>
              <div className="mt-0.5 text-sm text-text-muted">{uniqueRecords.length} Records in 8 Kategorien</div>
            </div>
            <ChevronRight size={18} className="text-text-muted transition-colors group-hover:text-red" />
          </Link>
        </div>
      )}
    </div>
  );
}
