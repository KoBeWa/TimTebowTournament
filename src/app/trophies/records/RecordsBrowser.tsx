"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import Tabs from "@/components/ui/Tabs";
import ManagerName from "@/components/ui/ManagerName";
import { isNegativeRecord } from "@/lib/classifications";
import { CATEGORIES, RECORD_CATEGORY, type Category } from "./categories";

// ── Types ────────────────────────────────────────────────────────────────────

export type OwnerRow = { record_key: string; manager_id: string; current_value: number };
export type TimelineEntry = {
  id: number;
  record_key: string;
  record_label: string;
  manager_id: string;
  record_value: string;
  from_year: number;
  from_week: number;
  to_year: number | null;
  to_week: number | null;
  is_current: boolean;
  weeks_held: number;
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmtVal(v: number) {
  return Number.isInteger(v) ? String(v) : v.toFixed(2);
}

function fmtPeriod(
  fromYear: number, fromWeek: number,
  toYear: number | null, toWeek: number | null,
  isCurrent: boolean,
): string {
  const from = fromWeek > 0 ? `${fromYear} W${fromWeek}` : String(fromYear);
  if (isCurrent) return `seit ${from}`;
  if (!toYear) return from;
  const to = toWeek && toWeek > 0 ? `${toYear} W${toWeek}` : String(toYear);
  if (from === to) return from;
  return `${from} – ${to}`;
}

// ── Component ────────────────────────────────────────────────────────────────

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

  // Owner ranking for selected record
  const ownerRanking = useMemo(() => {
    if (!selectedKey) return [];
    const rows = ownerMap[selectedKey] ?? [];
    const neg = isNegativeRecord(selectedKey);
    return [...rows].sort((a, b) => neg ? a.current_value - b.current_value : b.current_value - a.current_value);
  }, [selectedKey, ownerMap]);

  // Timeline for selected record (current holder first, then by value desc)
  const recordTimeline = useMemo(() => {
    if (!selectedKey) return [];
    const entries = timelineMap[selectedKey] ?? [];
    const neg = isNegativeRecord(selectedKey);
    return [...entries].sort((a, b) => {
      if (a.is_current !== b.is_current) return a.is_current ? -1 : 1;
      const av = Number(a.record_value), bv = Number(b.record_value);
      return neg ? av - bv : bv - av;
    });
  }, [selectedKey, timelineMap]);

  const selectedLabel = selectedKey ? labelMap[selectedKey] : null;
  const isNeg = selectedKey ? isNegativeRecord(selectedKey) : false;
  const currentHolder = recordTimeline.find((e) => e.is_current);

  return (
    <div className="space-y-4">
      <Tabs tabs={CATEGORIES.map((cat) => ({ key: cat, label: cat, count: categoryRecords[cat].length }))}
        value={activeCat} onChange={selectCategory} label="Kategorie" />

      {/* Below md the panes stack and the record list becomes a select; no fixed heights there */}
      <div className="cell overflow-hidden md:flex md:max-h-[70vh] md:min-h-[24rem]">

        {/* Record list */}
        <div className="border-b border-border p-3 md:hidden">
          <label className="flex flex-col gap-1 text-xs text-text-muted">
            Record
            <select value={selectedKey ?? ""} onChange={(e) => setSelectedKey(e.target.value)}
              className="w-full rounded-full border border-border bg-surface px-3 py-2.5 text-sm text-ink focus:border-red focus:outline-none">
              {recordsInCat.map(({ key, label }) => <option key={key} value={key}>{label}</option>)}
            </select>
          </label>
        </div>
        <div className="hidden w-56 shrink-0 overflow-y-auto border-r border-border md:block">
          {recordsInCat.map(({ key, label }) => {
            const isSelected = key === selectedKey;
            const isNegKey = isNegativeRecord(key);
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
                    <span className={isNegKey ? "text-negative" : ""}>{holder.manager_id}</span>
                    {", "}
                    <span className="tabular-nums">{fmtVal(Number(holder.record_value))}</span>
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Owner values */}
        <div className="border-b border-border md:flex-1 md:overflow-y-auto md:border-b-0 md:border-r">
          {selectedKey ? (
            <>
              <div className="border-b border-border-light px-4 pb-3 pt-4">
                <div className="text-xs text-text-muted">{activeCat}</div>
                <div className="display-title text-xl leading-tight text-ink">{selectedLabel}</div>
                <div className="mt-1 flex items-center gap-1">
                  <span className={`rounded px-2 py-0.5 text-xs ${isNeg ? "bg-negative/10 text-negative" : "bg-surface-3 text-text-muted"}`}>
                    {isNeg ? "Negativ" : "Positiv"}
                  </span>
                  <Link href={`/trophies/records/${selectedKey}`}
                    className="inline-flex min-h-11 items-center gap-0.5 px-3 text-xs text-text-muted transition-colors hover:text-ink">
                    Detail <ChevronRight size={12} />
                  </Link>
                </div>
              </div>

              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs font-medium text-text-muted">
                    <th className="w-10 py-2 pl-4 text-left font-medium">#</th>
                    <th className="px-4 py-2 text-left font-medium">Manager</th>
                    <th className="px-4 py-2 text-right font-medium">Wert</th>
                  </tr>
                </thead>
                <tbody>
                  {ownerRanking.map((row, i) => {
                    const isCurrent = currentHolder?.manager_id === row.manager_id;
                    const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : String(i + 1);
                    return (
                      <tr key={row.manager_id} className={`border-t border-border-light ${isCurrent ? "bg-surface-2" : ""}`}>
                        <td className="py-2.5 pl-4 text-xs text-text-muted">{medal}</td>
                        <td className="px-4 py-2.5 text-sm font-medium">
                          <ManagerName id={row.manager_id} />
                          {isCurrent && <span className="ml-2 text-xs text-red">Rekord</span>}
                        </td>
                        <td className={`px-4 py-2.5 text-right text-sm tabular-nums ${i === 0 ? "font-semibold text-ink" : "text-ink"}`}>
                          {fmtVal(row.current_value)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </>
          ) : (
            <div className="p-8 text-center text-text-muted">Kein Record ausgewählt</div>
          )}
        </div>

        {/* Timeline */}
        <div className="md:w-64 md:shrink-0 md:overflow-y-auto">
          {selectedKey ? (
            <>
              <div className="border-b border-border-light px-4 pb-3 pt-4">
                <h3 className="text-sm font-medium text-text-muted">Record-Timeline</h3>
              </div>
              <div className="divide-y divide-border-light">
                {recordTimeline.map((entry, idx) => {
                  const period = fmtPeriod(entry.from_year, entry.from_week, entry.to_year, entry.to_week, entry.is_current);
                  return (
                    <div key={entry.id} className={`px-4 py-3 ${entry.is_current ? "bg-surface-2" : ""}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold"><ManagerName id={entry.manager_id} /></div>
                          <div className="mt-0.5 text-xs text-text-muted">{period}</div>
                          <div className="text-xs text-text-faint">{entry.weeks_held} Wo.</div>
                        </div>
                        <div className="shrink-0 text-right">
                          <div className="text-sm font-semibold tabular-nums text-ink">{fmtVal(Number(entry.record_value))}</div>
                          {entry.is_current && <div className="mt-0.5 text-xs text-red">Aktuell</div>}
                          {idx === 0 && !entry.is_current && <div className="mt-0.5 text-xs text-text-muted">Bestwert</div>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="p-8 text-center text-text-muted">–</div>
          )}
        </div>
      </div>
    </div>
  );
}
