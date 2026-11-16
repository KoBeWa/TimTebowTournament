import { supabase } from "@/lib/supabase";
import PageHeader from "@/components/ui/PageHeader";
import RecordsBrowser, { type OwnerRow, type TimelineEntry } from "./RecordsBrowser";

// The record to open first comes from ?key= and is read in the browser, so this page can be static
export default async function RecordsPage() {
  const [{ data: timeline }, { data: ownerValues }] = await Promise.all([
    supabase
      .from("record_timeline")
      .select("id,record_key,record_label,manager_id,record_value,from_year,from_week,to_year,to_week,is_current,weeks_held")
      .order("from_year", { ascending: false })
      .order("from_week", { ascending: false }),
    supabase
      .from("record_owner_values")
      .select("record_key,manager_id,current_value"),
  ]);

  const typedTimeline: TimelineEntry[] = (timeline ?? []).map((e) => ({
    ...e,
    current_value: undefined,
  })) as TimelineEntry[];

  const typedOwners: OwnerRow[] = (ownerValues ?? []).map((r) => ({
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
