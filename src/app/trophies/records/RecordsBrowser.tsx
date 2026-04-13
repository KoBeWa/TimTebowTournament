"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
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
  initialKey: string | null;
}

export default function RecordsBrowser({ ownerValues, timeline, initialKey }: Props) {
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
  const [selectedKey, setSelectedKey] = useState<string | null>(() => {
    if (initialKey && labelMap[initialKey]) return initialKey;
    return categoryRecords["League"][0]?.key ?? null;
  });

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
    <div className="space-y-0">
      {/* ── Category Tabs ── */}
      <div className="flex flex-wrap gap-0 border-b border-border mb-0 -mx-4 sm:-mx-6 px-4 sm:px-6 overflow-x-auto">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => selectCategory(cat)}
            className={`label-nav text-xs px-4 py-2.5 whitespace-nowrap transition-colors border-b-2 -mb-px ${
              cat === activeCat
                ? "border-ink text-ink"
                : "border-transparent text-text-muted hover:text-ink"
            }`}
          >
            {cat}
            <span className="ml-1.5 font-normal opacity-50">
              ({categoryRecords[cat].length})
            </span>
          </button>
        ))}
      </div>

      {/* ── 3-Column Body ── */}
      <div className="flex gap-0 border border-border mt-4" style={{ minHeight: "70vh" }}>

        {/* LEFT — Record List */}
        <div className="w-56 flex-shrink-0 border-r border-border overflow-y-auto" style={{ maxHeight: "70vh" }}>
          {recordsInCat.map(({ key, label }) => {
            const isSelected = key === selectedKey;
            const isNegKey = isNegativeRecord(key);
            const holder = timelineMap[key]?.find((e) => e.is_current);
            return (
              <button
                key={key}
                onClick={() => setSelectedKey(key)}
                className={`w-full text-left px-3 py-2.5 border-b border-border-light transition-colors ${
                  isSelected ? "bg-ink" : "hover:bg-ink/5"
                }`}
              >
                <div className={`text-xs font-medium leading-snug ${isSelected ? "text-cream" : "text-ink"}`}>
                  {label}
                </div>
                {holder && (
                  <div className={`text-xs mt-0.5 ${isSelected ? "text-cream/60" : "text-text-muted"}`}>
                    <span style={!isSelected && isNegKey ? { color: "var(--color-red)" } : {}}>
                      {holder.manager_id}
                    </span>
                    {" · "}
                    <span className="font-mono">{fmtVal(Number(holder.record_value))}</span>
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* CENTER — Owner Values */}
        <div className="flex-1 overflow-y-auto border-r border-border" style={{ maxHeight: "70vh" }}>
          {selectedKey ? (
            <>
              <div className="px-4 pt-4 pb-3 border-b border-border-light">
                <div className="kicker text-xs mb-0.5">{activeCat}</div>
                <div className="display-title text-xl text-ink leading-tight">{selectedLabel}</div>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`label-nav text-xs px-2 py-0.5 ${isNeg ? "bg-red/10 text-red" : "bg-ink/8 text-text-muted"}`}>
                    {isNeg ? "Negativ" : "Positiv"}
                  </span>
                  <Link
                    href={`/trophies/records/${selectedKey}`}
                    className="label-nav text-xs text-text-muted hover:text-ink transition-colors"
                  >
                    Detail →
                  </Link>
                </div>
              </div>

              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border-light text-left">
                    <th className="px-4 py-2 label-nav text-xs text-text-muted w-10">#</th>
                    <th className="px-4 py-2 label-nav text-xs text-text-muted">Manager</th>
                    <th className="px-4 py-2 label-nav text-xs text-text-muted text-right">Wert</th>
                  </tr>
                </thead>
                <tbody>
                  {ownerRanking.map((row, i) => {
                    const isCurrent = currentHolder?.manager_id === row.manager_id;
                    const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : String(i + 1);
                    return (
                      <tr
                        key={row.manager_id}
                        className={`border-b border-border-light transition-colors ${isCurrent ? "bg-ink/5" : ""}`}
                      >
                        <td className="px-4 py-2.5 label-nav text-xs text-text-muted">{medal}</td>
                        <td className="px-4 py-2.5">
                          <Link
                            href={`/manager/${row.manager_id}`}
                            className="font-medium text-ink hover:text-red transition-colors text-sm"
                          >
                            {row.manager_id}
                          </Link>
                          {isCurrent && (
                            <span className="ml-2 label-nav text-xs text-red">REC</span>
                          )}
                        </td>
                        <td className={`px-4 py-2.5 text-right font-mono text-sm ${i === 0 ? "font-semibold text-ink" : "text-ink"}`}>
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

        {/* RIGHT — Timeline */}
        <div className="w-64 flex-shrink-0 overflow-y-auto" style={{ maxHeight: "70vh" }}>
          {selectedKey ? (
            <>
              <div className="px-4 pt-4 pb-3 border-b border-border-light">
                <div className="label-nav text-xs text-text-muted">Record Timeline</div>
              </div>
              <div className="divide-y divide-border-light">
                {recordTimeline.map((entry, idx) => {
                  const period = fmtPeriod(entry.from_year, entry.from_week, entry.to_year, entry.to_week, entry.is_current);
                  return (
                    <div
                      key={entry.id}
                      className={`px-4 py-3 ${entry.is_current ? "bg-ink/5" : ""}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <Link
                            href={`/manager/${entry.manager_id}`}
                            className={`text-sm font-semibold hover:text-red transition-colors block truncate ${entry.is_current ? "text-ink" : "text-ink"}`}
                          >
                            {entry.manager_id}
                          </Link>
                          <div className="text-xs text-text-muted mt-0.5">{period}</div>
                          <div className="text-xs text-text-faint">{entry.weeks_held} Wo.</div>
                        </div>
                        <div className="flex-shrink-0 text-right">
                          <div className="font-mono text-sm text-ink font-semibold">
                            {fmtVal(Number(entry.record_value))}
                          </div>
                          {entry.is_current && (
                            <div className="label-nav text-xs text-red mt-0.5">AKTUELL</div>
                          )}
                          {idx === 0 && !entry.is_current && (
                            <div className="label-nav text-xs text-text-muted mt-0.5">BEST</div>
                          )}
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
