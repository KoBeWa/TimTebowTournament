import { supabase } from "@/lib/supabase";
import Link from "next/link";
import RecordsBrowser, { type OwnerRow, type TimelineEntry } from "./RecordsBrowser";

export default async function RecordsPage({
  searchParams,
}: {
  searchParams: Promise<{ key?: string }>;
}) {
  const { key } = await searchParams;

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
      <div>
        <Link href="/trophies" className="text-text-muted hover:text-ink text-sm transition-colors">
          ← Trophy Room
        </Link>
        <h1 className="display-title text-4xl md:text-5xl text-ink mt-2">Records</h1>
        <p className="text-text-secondary mt-1 text-sm">
          {typedOwners.length > 0
            ? `${new Set(typedOwners.map((r) => r.record_key)).size} Records · alle 8 Owner`
            : ""}
        </p>
      </div>

      <RecordsBrowser
        ownerValues={typedOwners}
        timeline={typedTimeline}
        initialKey={key ?? null}
      />
    </div>
  );
}
