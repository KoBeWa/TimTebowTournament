import { supabase } from "@/lib/supabase";
import { isNegativeRecord } from "@/lib/classifications";
import Link from "next/link";
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
    <div className="space-y-8">
      <div>
        <Link href="/trophies" className="text-text-muted hover:text-ink text-sm transition-colors">← Trophy Room</Link>
        <h1 className="display-title text-4xl md:text-5xl text-ink mt-2">{recordLabel}</h1>
        <div className="flex items-center gap-2 mt-1">
          <span className={`text-xs font-semibold px-2 py-0.5 rounded ${negative ? "bg-accent-red/10 text-red" : "bg-accent-green/10 text-ink font-semibold"}`}>
            {negative ? "Negative Record" : "Positive Record"}
          </span>
          {isMatchupRecord && (
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-accent-blue/10 text-accent-blue">Matchup Record</span>
          )}
        </div>
      </div>

      {/* Current Holder */}
      {currentHolder && (
        <div className="cell p-8 text-center" style={{ borderColor: negative ? "var(--color-accent-red)" : "var(--color-gold-dark)", borderWidth: "1px" }}>
          <div className="kicker mb-2">Current Record Holder</div>
          <div className="text-5xl tracking-wider text-ink display-title">{currentHolder.manager_id}</div>
          <div className="display-title text-2xl text-ink mt-2">{Number(currentHolder.record_value).toFixed(2)}</div>
          <div className="text-text-muted text-sm mt-2">
            {formatPeriod(currentHolder.from_year, currentHolder.from_week, currentHolder.to_year, currentHolder.to_week, true)} · {currentHolder.weeks_held} Wochen
          </div>
        </div>
      )}

      {/* All-Owner Ranking */}
      <section>
        <h2 className="section-title text-ink mb-4">Ranking — Alle Owner</h2>
        {ranking ? (
          <div className="cell overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-text-muted text-left">
                  <th className="p-4 w-12">#</th>
                  <th className="p-4">Manager</th>
                  <th className="p-4 text-right">Wert</th>
                </tr>
              </thead>
              <tbody>
                {ranking.map((row, i) => {
                  const isCurrent = currentHolder?.manager_id === row.manager;
                  const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : String(i + 1);
                  return (
                    <tr key={row.manager} className={`border-b border-border-light transition-colors ${isCurrent ? "bg-cream" : ""}`}>
                      <td className="p-4 label-nav text-xs text-text-muted">{medal}</td>
                      <td className="p-4">
                        <Link href={`/manager/${row.manager}`} className="font-medium text-ink hover:text-red transition-colors">
                          {row.manager}
                          {isCurrent && <span className="text-red text-xs ml-2">RECORD</span>}
                        </Link>
                      </td>
                      <td className={`p-4 text-right font-mono text-sm ${i === 0 ? "font-semibold text-ink" : "text-ink"}`}>
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
      </section>

      {/* Timeline */}
      <section>
        <h2 className="section-title text-ink mb-4">Record Timeline</h2>
        <div className="relative">
          {/* Vertical line */}
          <div className="absolute left-[2.25rem] top-0 bottom-0 w-px bg-border" />

          <div className="space-y-4">
            {timeline.map((entry) => {
              const link = matchupLinks[entry.id];
              const period = formatPeriod(entry.from_year, entry.from_week, entry.to_year, entry.to_week, entry.is_current);

              return (
                <div key={entry.id} className="relative flex items-start gap-4 pl-2">
                  {/* Dot on timeline */}
                  <div className={`relative z-10 mt-4 w-5 h-5 rounded-full border-2 flex-shrink-0 ${
                    entry.is_current ? "bg-ink border-ink" : "bg-cream border-border-light"
                  }`} />

                  {/* Content card */}
                  <div className={`cell p-4 flex-1 flex items-center justify-between ${entry.is_current ? "border-border" : ""}`}>
                    <div>
                      <Link href={`/manager/${entry.manager_id}`}
                        className={`font-semibold text-lg hover:text-red transition-colors ${entry.is_current ? "text-ink" : "text-ink"}`}>
                        {entry.manager_id}
                      </Link>
                      <div className="text-text-muted text-sm">{period}</div>
                      <div className="text-text-muted text-xs">{entry.weeks_held} Wochen gehalten</div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="font-mono text-lg text-ink">{Number(entry.record_value).toFixed(2)}</div>
                      {link && (
                        <Link href={`/gamecenter/${link.season}/${link.week}?a=${link.a}&b=${link.b}`}
                          className="text-xs px-2 py-1 rounded bg-accent-blue/10 text-accent-blue hover:bg-accent-blue/20 transition-colors whitespace-nowrap">
                          Matchup →
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}
