import { supabase } from "@/lib/supabase";
import { isNegativeRecord } from "@/lib/classifications";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import ManagerName from "@/components/ui/ManagerName";
import RecordTabs from "./RecordTabs";
import { notFound } from "next/navigation";

type RankingRow = { manager: string; value: number };

async function getOwnerRanking(recordKey: string): Promise<RankingRow[] | null> {
  const { data } = await supabase
    .from("record_owner_values")
    .select("manager_id, current_value")
    .eq("record_key", recordKey);
  if (!data || data.length === 0) return null;
  return data.map((r) => ({ manager: r.manager_id, value: Number(r.current_value ?? 0) }));
}

// ============================================================
// TIMELINE PERIOD FORMATTING
// ============================================================

function formatPeriod(fromYear: number, fromWeek: number, toYear: number | null, toWeek: number | null, isCurrent: boolean): string {
  const from = `${fromYear} W${fromWeek}`;
  const to = toYear && toWeek ? `${toYear} W${toWeek}` : "";

  if (isCurrent) return `seit ${from}`;
  if (fromYear === toYear && fromWeek === toWeek) return from;
  return `${from} – ${to}`;
}

// ============================================================
// MATCHUP RECORD LINK HELPERS
// ============================================================

const MATCHUP_RECORDS = new Set([
  "most_matchup_points", "fewest_matchup_points",
  "biggest_blowout", "narrowest_win",
  "highest_combined_score", "lowest_combined_score",
  "highest_points_share", "lowest_points_share",
  "most_playoff_matchup_pts", "fewest_playoff_matchup_pts",
  "biggest_playoff_blowout", "narrowest_playoff_win",
  "highest_playoff_combined", "lowest_playoff_combined",
]);

// ============================================================
// PAGE COMPONENT
// ============================================================

export default async function RecordDetailPage({
  params,
}: {
  params: Promise<{ record_key: string }>;
}) {
  const { record_key } = await params;

  const { data: timeline } = await supabase
    .from("record_timeline")
    .select("*")
    .eq("record_key", record_key)
    .order("from_year", { ascending: true })
    .order("from_week", { ascending: true });

  if (!timeline?.length) notFound();

  const currentHolder = timeline.find((t) => t.is_current);
  const recordLabel = timeline[0]?.record_label ?? record_key;
  const negative = isNegativeRecord(record_key);
  const isMatchupRecord = MATCHUP_RECORDS.has(record_key);

  const rawRanking = await getOwnerRanking(record_key);
  const ranking = rawRanking
    ? rawRanking.sort((a, b) => negative ? a.value - b.value : b.value - a.value)
    : null;

  // For matchup records, fetch matchup links for timeline entries with specific weeks
  const matchupLinks: Record<number, { season: number; week: number; a: string; b: string }> = {};
  if (isMatchupRecord) {
    for (const entry of timeline) {
      if (entry.from_week > 0 && entry.from_week <= 16) {
        const { data: matchup } = await supabase
          .from("weekly_matchups")
          .select("season_year, week, manager_a, manager_b")
          .eq("season_year", entry.from_year)
          .eq("week", entry.from_week)
          .or(`manager_a.eq.${entry.manager_id},manager_b.eq.${entry.manager_id}`)
          .limit(1);
        if (matchup?.[0]) {
          matchupLinks[entry.id] = {
            season: matchup[0].season_year,
            week: matchup[0].week,
            a: matchup[0].manager_a,
            b: matchup[0].manager_b,
          };
        }
      }
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={recordLabel}
        crumbs={[{ label: "Trophy Room", href: "/trophies" }, { label: "Records", href: "/trophies/records" }]}
        description={
          <span className="inline-flex flex-wrap items-center gap-2">
            <span className={`rounded px-2 py-0.5 text-xs font-semibold ${negative ? "bg-accent-red/15 text-negative" : "bg-accent-green/15 text-positive"}`}>
              {negative ? "Negativer Record" : "Positiver Record"}
            </span>
            {isMatchupRecord && (
              <span className="rounded bg-accent-blue/10 px-2 py-0.5 text-xs font-semibold text-accent-blue">Matchup-Record</span>
            )}
          </span>
        }
      />

      {currentHolder && (
        <div className="cell p-6 text-center sm:p-8" style={{ borderColor: negative ? "var(--color-accent-red)" : "var(--color-gold-dark)", borderWidth: "1px" }}>
          <div className="mb-2 text-sm text-text-muted">Aktueller Rekordhalter</div>
          <div className="display-title text-4xl text-ink sm:text-5xl"><ManagerName id={currentHolder.manager_id} /></div>
          <div className="mt-2 display-title text-2xl tabular-nums text-ink">{Number(currentHolder.record_value).toFixed(2)}</div>
          <div className="mt-2 text-sm text-text-muted">
            {formatPeriod(currentHolder.from_year, currentHolder.from_week, currentHolder.to_year, currentHolder.to_week, true)}, {currentHolder.weeks_held} Wochen
          </div>
        </div>
      )}

      <RecordTabs
        ranking={ranking ? (
          <div className="cell overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs font-medium text-text-muted">
                  <th className="w-12 py-3 pl-4 text-left font-medium sm:pl-5">#</th>
                  <th className="px-3 py-3 text-left font-medium">Manager</th>
                  <th className="py-3 pl-3 pr-4 text-right font-medium sm:pr-5">Wert</th>
                </tr>
              </thead>
              <tbody>
                {ranking.map((row, i) => {
                  const isCurrent = currentHolder?.manager_id === row.manager;
                  const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : String(i + 1);
                  return (
                    <tr key={row.manager} className={`border-t border-border-light ${isCurrent ? "bg-surface-2" : ""}`}>
                      <td className="py-3 pl-4 text-text-muted sm:pl-5">{medal}</td>
                      <td className="px-3 py-3 font-medium">
                        <ManagerName id={row.manager} />
                        {isCurrent && <span className="ml-2 text-xs text-red">Rekord</span>}
                      </td>
                      <td className={`py-3 pl-3 pr-4 text-right tabular-nums sm:pr-5 ${i === 0 ? "font-semibold text-ink" : "text-ink"}`}>
                        {Number.isInteger(row.value) ? row.value : row.value.toFixed(2)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="cell p-6 text-center text-text-muted">
            Ranking für diesen Record-Typ wird noch implementiert.
          </div>
        )}
        timeline={
          <div className="relative">
            <div className="absolute bottom-0 left-[1.25rem] top-0 w-px bg-border" />
            <div className="space-y-3">
              {timeline.map((entry) => {
                const link = matchupLinks[entry.id];
                const period = formatPeriod(entry.from_year, entry.from_week, entry.to_year, entry.to_week, entry.is_current);
                return (
                  <div key={entry.id} className="relative flex items-start gap-3">
                    <div className={`relative z-10 mt-5 h-3 w-3 shrink-0 rounded-full border-2 ml-3.5 ${
                      entry.is_current ? "border-ink bg-ink" : "border-border-strong bg-surface"
                    }`} />
                    <div className="cell flex flex-1 items-center justify-between gap-3 p-4">
                      <div className="min-w-0">
                        <div className="text-lg font-semibold"><ManagerName id={entry.manager_id} /></div>
                        <div className="text-sm text-text-muted">{period}</div>
                        <div className="text-xs text-text-muted">{entry.weeks_held} Wochen gehalten</div>
                      </div>
                      <div className="flex flex-col items-end gap-2 sm:flex-row sm:items-center sm:gap-4">
                        <div className="text-lg tabular-nums text-ink">{Number(entry.record_value).toFixed(2)}</div>
                        {link && (
                          <Link href={`/gamecenter/${link.season}/${link.week}?a=${link.a}&b=${link.b}`}
                            className="inline-flex items-center gap-0.5 whitespace-nowrap rounded bg-accent-blue/10 px-2 py-1 text-xs text-accent-blue transition-colors hover:bg-accent-blue/20">
                            Matchup <ChevronRight size={12} />
                          </Link>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        }
      />
    </div>
  );
}
