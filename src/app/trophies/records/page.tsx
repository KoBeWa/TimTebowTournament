import { supabase } from "@/lib/supabase";
import PageHeader from "@/components/ui/PageHeader";
import RecordsBrowser, { type OwnerRow, type TimelineEntry } from "./RecordsBrowser";

// The record to open first comes from ?key= and is read in the browser, so this page can be static
export default async function RecordsPage() {
  // The API returns at most 1000 rows per request, so read the timeline in pages
  async function loadTimeline() {
    const rows: TimelineEntry[] = [];
    for (let from = 0; ; from += 1000) {
      const { data } = await supabase
        .from("record_timeline")
        .select("id,period_id,record_key,record_label,manager_id,record_value,from_year,from_week,to_year,to_week,is_current,weeks_held")
        .order("record_key")
        .order("period_id", { ascending: true })
        .range(from, from + 999);
      rows.push(...((data ?? []) as TimelineEntry[]));
      if (!data || data.length < 1000) return rows;
    }
  }

  async function loadOwners() {
    const rows: { record_key: string; manager_id: string; current_value: number | null }[] = [];
    for (let from = 0; ; from += 1000) {
      const { data } = await supabase
        .from("record_owner_values")
        .select("record_key,manager_id,current_value")
        .order("record_key")
        .order("manager_id")
        .range(from, from + 999);
      rows.push(...(data ?? []));
      if (!data || data.length < 1000) return rows;
    }
  }

  const [timeline, ownerValues] = await Promise.all([loadTimeline(), loadOwners()]);

  const typedTimeline = timeline;

  const typedOwners: OwnerRow[] = ownerValues.map((r) => ({
    record_key: r.record_key,
    manager_id: r.manager_id,
    current_value: Number(r.current_value ?? 0),
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Records"
        crumbs={[{ label: "Trophy Room", href: "/trophies" }]}
        description={typedOwners.length > 0
          ? `${new Set(typedOwners.map((r) => r.record_key)).size} Records, alle 8 Manager`
          : undefined}
      />

      <RecordsBrowser
        ownerValues={typedOwners}
        timeline={typedTimeline}
      />
    </div>
  );
}
