"use client";

import { useEffect, useRef, useState } from "react";
import { loadTrophyData, type Achievement, type RecordHolder } from "@/lib/trophies";
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

export default function TrophyRoom({ initial }: { initial: { achievements: Achievement[]; records: RecordHolder[] } }) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("achievements");
  const [achievements, setAchievements] = useState<Achievement[]>(initial.achievements);
  const [records, setRecords] = useState<RecordHolder[]>(initial.records);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  const [attempt, setAttempt] = useState(0);
  // The server already sent both tables; the browser only loads them again on a retry
  const skipFirst = useRef(true);

  useEffect(() => {
    if (skipFirst.current) {
      skipFirst.current = false;
      return;
    }
    let cancelled = false;
    loadTrophyData()
      .then((d) => {
        if (cancelled) return;
        setFailed(false);
        setAchievements(d.achievements);
        setRecords(d.records);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setFailed(true);
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [attempt]);

  function retry() {
    setLoading(true);
    setAttempt((n) => n + 1);
  }

  if (loading) {
    return (
      <div className="space-y-8" aria-busy="true">
        <PageHeader title="Trophy Room" description="Records, Achievements und der ewige Ruhm." />
        <div className="h-11 w-72 max-w-full animate-pulse motion-reduce:animate-none rounded-[var(--radius-pill)] bg-surface-3" />
        <div className="cell space-y-3 p-4 sm:p-5">
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="h-8 animate-pulse motion-reduce:animate-none rounded-lg bg-surface-3" />
          ))}
        </div>
      </div>
    );
  }

  if (failed) {
    return (
      <div className="space-y-8">
        <PageHeader title="Trophy Room" description="Records, Achievements und der ewige Ruhm." />
        <div className="cell flex flex-col items-start gap-3 p-5">
          <p className="text-sm text-ink">Das Trophy Room konnte nicht geladen werden.</p>
          <button type="button" className="btn" onClick={retry}>Erneut versuchen</button>
        </div>
      </div>
    );
  }

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

  const th = "px-3 py-2.5 text-right text-xs font-medium text-text-muted";

  return (
    <div className="space-y-8">
      <PageHeader title="Trophy Room" description="Records, Achievements und der ewige Ruhm." />

      <Tabs tabs={TABS} value={tab} label="Bereich"
        onChange={(k) => { if (k === "browse") router.push("/trophies/records"); else setTab(k); }} />

      {tab === "achievements" && (
        <div className="cell relative overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="py-2.5 pl-4 pr-3 text-left text-xs font-medium text-text-muted sm:pl-5">Manager</th>
                <th className={th}>Achievement-Arten</th>
                <th className={`${th} hidden sm:table-cell`}>Achievements</th>
                <th className={th}>Blunder-Arten</th>
                <th className={`${th} hidden sm:table-cell`}>Blunders</th>
                <th className={th}>Badges gesamt</th>
                <th className="w-12 py-3 pr-2 sm:pr-3"><span className="sr-only">Trophäen</span></th>
              </tr>
            </thead>
            <tbody>
              {achSummary.map((row) => (
                <tr key={row.manager} className="border-t border-border-light ">
                  <td className="py-2.5 pl-4 pr-3 font-medium sm:pl-5">
                    <ManagerName id={row.manager} />
                  </td>
                  <td className="measured px-3 py-2.5 text-right text-ink">{row.achievementTypes}</td>
                  <td className="hidden measured px-3 py-2.5 text-right text-ink sm:table-cell">{row.achievementTotal}</td>
                  <td className="measured px-3 py-2.5 text-right text-ink">{row.blunderTypes}</td>
                  <td className="hidden measured px-3 py-2.5 text-right text-ink sm:table-cell">{row.blunderTotal}</td>
                  <td className="measured px-3 py-2.5 text-right text-ink">{row.total}</td>
                  <td className="py-0 pr-2 text-right sm:pr-3">
                    <Link href={`/trophies/${encodeURIComponent(row.manager)}`} aria-label={`Trophäen von ${row.manager}`}
                      className="inline-flex h-11 w-11 items-center justify-center text-text-muted hover:text-red focus-visible:text-red focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--color-focus)]"><ChevronRight size={16} /></Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "records" && (
        <div className="space-y-8">
          <div className="cell overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="py-2.5 pl-4 pr-3 text-left text-xs font-medium text-text-muted sm:pl-5">Manager</th>
                  <th className={th}>Positive Records</th>
                  <th className={th}>Negative Records</th>
                  <th className={`${th} pr-4 sm:pr-5`}>Records gesamt</th>
                </tr>
              </thead>
              <tbody>
                {recSummary.map((row) => (
                  <tr key={row.manager} className="border-t border-border-light">
                    <td className="py-2.5 pl-4 pr-3 font-medium sm:pl-5"><ManagerName id={row.manager} /></td>
                    <td className="measured px-3 py-2.5 text-right text-ink">{row.positive}</td>
                    <td className="measured px-3 py-2.5 text-right text-negative">{row.negative}</td>
                    <td className="measured py-2.5 pl-3 pr-4 text-right text-ink sm:pr-5">{row.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Link href="/trophies/records" className="cell-hover group flex items-center justify-between p-5">
            <div>
              <div className="font-medium text-ink transition-colors group-hover:text-red">Alle Records durchsuchen</div>
              <div className="mt-0.5 text-sm text-text-muted"><span className="measured">{uniqueRecords.length}</span> Records in 8 Kategorien</div>
            </div>
            <ChevronRight size={18} className="text-text-muted transition-colors group-hover:text-red" />
          </Link>
        </div>
      )}
    </div>
  );
}
