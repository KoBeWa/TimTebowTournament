"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import Tabs from "@/components/ui/Tabs";
import ManagerName from "@/components/ui/ManagerName";
import RecordChart from "./RecordChart";
import { fmtVal, higherWins, recordDescription, type OwnerRow, type TimelineEntry } from "./recordUtils";
import { CATEGORIES, RECORD_CATEGORY, type Category } from "./categories";

// ── Component ────────────────────────────────────────────────────────────────

export type { OwnerRow, TimelineEntry };

interface Props {
  ownerValues: OwnerRow[];
  timeline: TimelineEntry[];
}

export default function RecordsBrowser({ ownerValues, timeline }: Props) {
  // Build indexes
  const labelMap = useMemo(() => {
    const m: Record<string, string> = {};
    for (const e of timeline) m[e.record_key] = e.record_label;
    return m;
  }, [timeline]);

  const timelineMap = useMemo(() => {
    const m: Record<string, TimelineEntry[]> = {};
    for (const e of timeline) (m[e.record_key] ??= []).push(e);
    return m;
  }, [timeline]);

  const ownerMap = useMemo(() => {
    const m: Record<string, OwnerRow[]> = {};
    for (const r of ownerValues) (m[r.record_key] ??= []).push(r);
    return m;
  }, [ownerValues]);

  // All record keys grouped by category (sorted by label)
  const categoryRecords = useMemo(() => {
    const result: Record<Category, { key: string; label: string }[]> = {} as never;
    for (const cat of CATEGORIES) result[cat] = [];
    for (const [key, label] of Object.entries(labelMap)) {
      const cat = RECORD_CATEGORY[key] ?? "Milestones";
      result[cat].push({ key, label });
    }
    for (const cat of CATEGORIES) {
      result[cat].sort((a, b) => a.label.localeCompare(b.label));
    }
    return result;
  }, [labelMap]);

  const [activeCat, setActiveCat] = useState<Category>("League");
  const [selectedKey, setSelectedKey] = useState<string | null>(categoryRecords["League"][0]?.key ?? null);

  // ?key= opens that record. It is read here, not on the server, so the page itself stays static.
  useEffect(() => {
    const key = new URLSearchParams(window.location.search).get("key");
    if (key && labelMap[key]) {
      setSelectedKey(key);
      setActiveCat(RECORD_CATEGORY[key] ?? "Milestones");
    }
  }, [labelMap]);

  // Ensure selected key is in active category; if not, pick first
  const recordsInCat = categoryRecords[activeCat];

  function selectCategory(cat: Category) {
    setActiveCat(cat);
    if (!selectedKey || !recordsInCat.find((r) => r.key === selectedKey)) {
      setSelectedKey(categoryRecords[cat][0]?.key ?? null);
    }
  }

  const periods = selectedKey ? timelineMap[selectedKey] ?? [] : [];
  const owners = selectedKey ? ownerMap[selectedKey] ?? [] : [];
  const higher = selectedKey ? higherWins(selectedKey, periods, owners) : true;
  const ownerRanking = [...owners].sort((x, y) => higher ? y.current_value - x.current_value : x.current_value - y.current_value);
  const selectedLabel = selectedKey ? labelMap[selectedKey] : null;
  const currentHolder = periods.find((e) => e.is_current);

  return (
    <div className="space-y-4">
      <Tabs tabs={CATEGORIES.map((cat) => ({ key: cat, label: cat, count: categoryRecords[cat].length }))}
        value={activeCat} onChange={selectCategory} label="Kategorie" />

      {/* Below md the panes stack and the record list becomes a select; no fixed heights there */}
      <div className="cell overflow-hidden md:flex md:min-h-[24rem]">

        <div className="border-b border-border p-3 md:hidden">
          <label className="flex flex-col gap-1 text-xs text-text-muted">
            Record
            <select value={selectedKey ?? ""} onChange={(e) => setSelectedKey(e.target.value)}
              className="w-full rounded-full border border-border bg-surface px-3 py-2.5 text-sm text-ink focus:border-red focus:outline-none">
              {recordsInCat.map(({ key, label }) => <option key={key} value={key}>{label}</option>)}
            </select>
          </label>
        </div>
        <div className="hidden w-60 shrink-0 border-r border-border md:block md:max-h-[80vh] md:overflow-y-auto">
          {recordsInCat.map(({ key, label }) => {
            const isSelected = key === selectedKey;
            const holder = timelineMap[key]?.find((e) => e.is_current);
            return (
              <button
                key={key}
                onClick={() => setSelectedKey(key)}
                className={`min-h-11 w-full border-b border-border-light px-3 py-2.5 text-left transition-colors ${
                  isSelected ? "bg-surface-3" : "hover:bg-surface-2"
                }`}
              >
                <div className="text-xs font-medium leading-snug text-ink">{label}</div>
                {holder && (
                  <div className="mt-0.5 text-xs text-text-muted">
                    {holder.manager_id}{", "}
                    <span className="tabular-nums">{fmtVal(Number(holder.record_value))}</span>
                  </div>
                )}
              </button>
            );
          })}
        </div>

        <div className="min-w-0 md:flex-1">
          {selectedKey && selectedLabel ? (
            <div className="space-y-4 p-4 sm:p-5">
              <div>
                <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
                  <h2 className="display-title text-2xl leading-tight text-ink sm:text-3xl">{selectedLabel}</h2>
                  <Link href={`/trophies/records/${selectedKey}`}
                    className="inline-flex min-h-11 shrink-0 items-center gap-0.5 text-sm text-text-secondary transition-colors hover:text-ink">
                    Ganzer Verlauf <ChevronRight size={14} />
                  </Link>
                </div>
                <p className="mt-1 max-w-2xl text-sm text-text-muted">{recordDescription(selectedKey, selectedLabel, higher)}</p>
              </div>

              {periods.length > 0 && <RecordChart key={selectedKey} periods={periods} label={selectedLabel} />}

              <div>
                <h3 className="mb-2 text-sm font-medium text-text-muted">Aktuelle Rangliste</h3>
                <div className="overflow-x-auto rounded-xl border border-border-light">
                  <table className="w-full text-sm">
                    <tbody>
                      {ownerRanking.map((row, i) => {
                        const isCurrent = currentHolder?.manager_id === row.manager_id;
                        const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : String(i + 1);
                        return (
                          <tr key={row.manager_id} className={`${i > 0 ? "border-t border-border-light" : ""} ${isCurrent ? "bg-surface-2" : ""}`}>
                            <td className="w-10 py-2.5 pl-4 text-xs text-text-muted">{medal}</td>
                            <td className="px-3 py-2.5 font-medium">
                              <ManagerName id={row.manager_id} />
                              {isCurrent && <span className="ml-2 text-xs text-red">Rekord</span>}
                            </td>
                            <td className={`py-2.5 pl-3 pr-4 text-right tabular-nums ${i === 0 ? "font-semibold text-ink" : "text-ink"}`}>
                              {fmtVal(row.current_value)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-8 text-center text-text-muted">Kein Record ausgewählt</div>
          )}
        </div>
      </div>
    </div>
  );
}
