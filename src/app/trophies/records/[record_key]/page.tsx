import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import ManagerName from "@/components/ui/ManagerName";
import RecordTabs from "./RecordTabs";
import RecordChart from "../RecordChart";
import RecordRaceChart, { type RecordHistory } from "../RecordRaceChart";
import { fmtPeriod, fmtVal, higherWins, recordDescription, type TimelineEntry } from "../recordUtils";
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

// Records are generated on first visit and then served as static pages, revalidated with the layout
export function generateStaticParams() {
  return [];
}

export default async function RecordDetailPage({
  params,
}: {
  params: Promise<{ record_key: string }>;
}) {
  const { record_key } = await params;

  const [{ data: timelineRaw }, rawRanking, { data: history }] = await Promise.all([
    supabase
      .from("record_timeline")
      .select("id, period_id, record_key, record_label, manager_id, record_value, from_year, from_week, to_year, to_week, is_current, weeks_held")
      .eq("record_key", record_key)
      .order("period_id", { ascending: true }),
    getOwnerRanking(record_key),
    supabase.rpc("record_history", { p_record_key: record_key }),
  ]);

  if (!timelineRaw?.length) notFound();
  const timeline = timelineRaw as TimelineEntry[];

  const currentHolder = timeline.find((t) => t.is_current);
  const recordLabel = timeline[0]?.record_label ?? record_key;
  const higher = higherWins(record_key, timeline, (rawRanking ?? []).map((r) => ({ current_value: r.value })));
  const isMatchupRecord = MATCHUP_RECORDS.has(record_key);

  const ranking = rawRanking
    ? rawRanking.sort((a, b) => higher ? b.value - a.value : a.value - b.value)
    : null;

  // For matchup records, fetch matchup links for timeline entries with specific weeks
  const matchupLinks: Record<number, { season: number; week: number; a: string; b: string }> = {};
  if (isMatchupRecord) {
    // One query per entry, all at once
    await Promise.all(timeline.filter((entry) => entry.from_week > 0 && entry.from_week <= 16).map(async (entry) => {
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
    }));
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title={recordLabel}
        crumbs={[{ label: "Trophy Room", href: "/trophies" }, { label: "Records", href: "/trophies/records" }]}
        description={recordDescription(record_key, recordLabel, higher)}
      />

      {currentHolder && (
        <div className="cell-accent grid gap-4 p-4 sm:grid-cols-[1fr_auto] sm:items-end sm:p-5">
          <div className="min-w-0">
            <div className="text-sm text-text-muted">Aktueller Rekordhalter</div>
            <div className="display-title text-3xl text-ink sm:text-4xl"><ManagerName id={currentHolder.manager_id} /></div>
          </div>
          <div className="grid grid-cols-3 gap-x-6 sm:text-right">
            <div>
              <div className="text-xs text-text-muted">Wert</div>
              <div className="measured text-xl text-ink">{fmtVal(Number(currentHolder.record_value))}</div>
            </div>
            <div>
              <div className="text-xs text-text-muted">Seit</div>
              <div className="measured text-xl text-ink">{fmtPeriod(currentHolder).replace("seit ", "")}</div>
            </div>
            <div>
              <div className="text-xs text-text-muted">Wochen</div>
              <div className="measured text-xl text-ink">{currentHolder.weeks_held}</div>
            </div>
          </div>
        </div>
      )}

      {history
        ? <RecordRaceChart history={history as RecordHistory} label={recordLabel} higher={higher} />
        : <RecordChart periods={timeline} label={recordLabel} />}

      <RecordTabs
        ranking={ranking ? (
          <div className="cell overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs font-medium text-text-muted">
                  <th className="w-12 py-2.5 pl-4 text-left font-medium sm:pl-5">#</th>
                  <th className="px-3 py-2.5 text-left font-medium">Manager</th>
                  <th className="py-2.5 pl-3 pr-4 text-right font-medium sm:pr-5">Wert</th>
                </tr>
              </thead>
              <tbody>
                {ranking.map((row, i) => {
                  const isCurrent = currentHolder?.manager_id === row.manager;
                  const medalClass = i === 0 ? "text-gold" : i === 1 ? "text-silver" : i === 2 ? "text-bronze" : "text-text-muted";
                  return (
                    <tr key={row.manager} className="border-t border-border-light">
                      <td className={`measured py-2.5 pl-4 sm:pl-5 ${medalClass}`}>{i + 1}</td>
                      <td className="px-3 py-2.5 font-medium">
                        <ManagerName id={row.manager} />
                        {isCurrent && <span className="ml-2 text-xs text-red">Rekord</span>}
                      </td>
                      <td className="measured py-2.5 pl-3 pr-4 text-right text-ink sm:pr-5">
                        {fmtVal(row.value)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="cell p-6 text-center text-text-muted">
            Für diesen Record gibt es noch keine Rangliste.
          </div>
        )}
        history={
          <div className="cell divide-y divide-border-light">
            {[...timeline].reverse().map((entry) => {
              const link = matchupLinks[entry.id];
              const period = fmtPeriod(entry);
              return (
                <div key={entry.id} className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-base font-medium">
                      <ManagerName id={entry.manager_id} />
                      {entry.is_current && <span className="text-xs text-red">Aktuell</span>}
                    </div>
                    <div className="mt-0.5 text-sm text-text-muted">{period}</div>
                    <div className="text-xs text-text-muted"><span className="measured">{entry.weeks_held}</span> Wochen gehalten</div>
                  </div>
                  <div className="flex flex-col items-end gap-1 sm:flex-row sm:items-center sm:gap-4">
                    <div className="measured text-lg text-ink">{fmtVal(Number(entry.record_value))}</div>
                    {link && (
                      <Link href={`/gamecenter/${link.season}/${link.week}?a=${link.a}&b=${link.b}`}
                        className="btn whitespace-nowrap">
                        Matchup <ChevronRight size={12} aria-hidden />
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        }
      />
    </div>
  );
}
