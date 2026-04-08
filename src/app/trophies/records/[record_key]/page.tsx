import { supabase } from "@/lib/supabase";
import { isNegativeRecord } from "@/lib/classifications";
import { MANAGERS } from "@/lib/constants";
import Link from "next/link";
import { notFound } from "next/navigation";

// ============================================================
// RECORD → SQL MAPPING for all-owner rankings
// ============================================================

type RankingRow = { manager: string; value: number; season?: number; week?: number };

async function computeRanking(recordKey: string): Promise<RankingRow[] | null> {
  // --- Career aggregates from season_results ---
  const careerAgg: Record<string, { col: string; agg: "sum" | "max" | "min" }> = {
    total_wins: { col: "wins", agg: "sum" },
    total_losses: { col: "losses", agg: "sum" },
    total_points: { col: "points_for", agg: "sum" },
    total_opp_points: { col: "points_against", agg: "sum" },
    most_transactions: { col: "moves", agg: "sum" },
  };

  if (careerAgg[recordKey]) {
    const { col, agg } = careerAgg[recordKey];
    const { data } = await supabase
      .from("season_results")
      .select(`manager_id, ${col}`);
    if (!data) return null;
    const byMgr: Record<string, number> = {};
    for (const r of data) {
      byMgr[r.manager_id] = (byMgr[r.manager_id] || 0) + Number(r[col] || 0);
    }
    return Object.entries(byMgr).map(([m, v]) => ({ manager: m, value: v }));
  }

  // --- Win percentage ---
  if (recordKey === "win_pct") {
    const { data } = await supabase.from("season_results").select("manager_id, wins, losses, ties");
    if (!data) return null;
    const byMgr: Record<string, { w: number; l: number; t: number }> = {};
    for (const r of data) {
      if (!byMgr[r.manager_id]) byMgr[r.manager_id] = { w: 0, l: 0, t: 0 };
      byMgr[r.manager_id].w += r.wins || 0;
      byMgr[r.manager_id].l += r.losses || 0;
      byMgr[r.manager_id].t += r.ties || 0;
    }
    return Object.entries(byMgr).map(([m, s]) => ({
      manager: m,
      value: (s.w / (s.w + s.l + s.t)) * 100,
    }));
  }

  // --- Season bests from season_results ---
  const seasonBest: Record<string, { col: string; fn: "max" | "min" }> = {
    most_season_points: { col: "points_for", fn: "max" },
    fewest_season_points: { col: "points_for", fn: "min" },
    most_season_opp_points: { col: "points_against", fn: "max" },
    fewest_season_opp_pts: { col: "points_against", fn: "min" },
    most_season_wins: { col: "wins", fn: "max" },
    most_season_losses: { col: "losses", fn: "max" },
    best_lineup_efficiency: { col: "lineup_efficiency", fn: "max" },
  };

  if (seasonBest[recordKey]) {
    const { col, fn } = seasonBest[recordKey];
    const { data } = await supabase.from("season_results").select(`manager_id, season_year, ${col}`);
    if (!data) return null;
    const byMgr: Record<string, { value: number; season: number }> = {};
    for (const r of data) {
      const v = Number(r[col] || 0);
      const existing = byMgr[r.manager_id];
      if (!existing || (fn === "max" ? v > existing.value : v < existing.value)) {
        byMgr[r.manager_id] = { value: v, season: r.season_year };
      }
    }
    return Object.entries(byMgr).map(([m, d]) => ({ manager: m, value: d.value, season: d.season }));
  }

  // --- Matchup records from weekly_matchups ---
  const matchupQueries = [
    "most_matchup_points", "fewest_matchup_points",
    "biggest_blowout", "narrowest_win",
    "highest_combined_score", "lowest_combined_score",
    "most_playoff_matchup_pts", "fewest_playoff_matchup_pts",
    "biggest_playoff_blowout",
  ];

  if (matchupQueries.includes(recordKey)) {
    const isPlayoff = recordKey.includes("playoff");
    let query = supabase.from("weekly_matchups").select("season_year, week, manager_a, score_a, manager_b, score_b, is_playoff");
    if (isPlayoff) query = query.eq("is_playoff", true);
    const { data } = await query;
    if (!data) return null;

    // Flatten to per-manager view
    const perManager: Record<string, { value: number; season: number; week: number }> = {};

    for (const m of data) {
      const sa = Number(m.score_a);
      const sb = Number(m.score_b);

      const entries: { mgr: string; val: number }[] = [];

      if (recordKey.includes("combined")) {
        const combined = sa + sb;
        entries.push({ mgr: m.manager_a, val: combined }, { mgr: m.manager_b, val: combined });
      } else if (recordKey.includes("blowout") || recordKey.includes("narrowest")) {
        const diff = Math.abs(sa - sb);
        const isBlowout = recordKey.includes("blowout");
        // For blowout: winner gets credit. For narrowest: also winner
        const winner = sa > sb ? m.manager_a : m.manager_b;
        entries.push({ mgr: winner, val: isBlowout ? diff : diff });
        // Give all managers a chance to appear
        const loser = sa > sb ? m.manager_b : m.manager_a;
        entries.push({ mgr: loser, val: isBlowout ? -1 : 999 }); // placeholder
      } else {
        // Score records
        entries.push({ mgr: m.manager_a, val: sa }, { mgr: m.manager_b, val: sb });
      }

      const isMax = ["most_matchup_points", "biggest_blowout", "highest_combined_score", "most_playoff_matchup_pts", "biggest_playoff_blowout"].includes(recordKey);

      for (const e of entries) {
        const existing = perManager[e.mgr];
        if (!existing || (isMax ? e.val > existing.value : e.val < existing.value)) {
          perManager[e.mgr] = { value: e.val, season: m.season_year, week: m.week };
        }
      }
    }

    // Filter out placeholders
    return Object.entries(perManager)
      .filter(([, d]) => d.value !== -1 && d.value !== 999)
      .map(([m, d]) => ({ manager: m, value: d.value, season: d.season, week: d.week }));
  }

  // --- Championship counts ---
  if (recordKey === "championships" || recordKey === "reg_season_titles" || recordKey === "season_ap_titles" || recordKey === "season_pts_titles") {
    const { data: playoffs } = await supabase.from("playoff_results").select("manager_id, final_rank");
    const { data: results } = await supabase.from("season_results").select("manager_id, reg_rank");
    if (!playoffs || !results) return null;

    const counts: Record<string, number> = {};
    for (const m of MANAGERS) counts[m] = 0;

    if (recordKey === "championships") {
      for (const p of playoffs) if (p.final_rank === 1) counts[p.manager_id] = (counts[p.manager_id] || 0) + 1;
    } else if (recordKey === "reg_season_titles") {
      for (const r of results) if (r.reg_rank === 1) counts[r.manager_id] = (counts[r.manager_id] || 0) + 1;
    }

    return Object.entries(counts).map(([m, v]) => ({ manager: m, value: v }));
  }

  // --- Playoff appearances ---
  if (recordKey === "playoff_appearances") {
    const { data } = await supabase.from("playoff_results").select("manager_id, seed");
    if (!data) return null;
    const counts: Record<string, number> = {};
    for (const m of MANAGERS) counts[m] = 0;
    for (const r of data) if (r.seed <= 4) counts[r.manager_id] = (counts[r.manager_id] || 0) + 1;
    return Object.entries(counts).map(([m, v]) => ({ manager: m, value: v }));
  }

  // No handler for this record type
  return null;
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

  // Compute all-owner ranking from raw data
  const rawRanking = await computeRanking(record_key);
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
        <Link href="/trophies" className="text-text-muted hover:text-text-primary text-sm transition-colors">← Trophy Room</Link>
        <h1 className="page-header gold-gradient mt-2">{recordLabel}</h1>
        <div className="flex items-center gap-2 mt-1">
          <span className={`text-xs font-semibold px-2 py-0.5 rounded ${negative ? "bg-accent-red/10 text-accent-red" : "bg-accent-green/10 text-accent-green"}`}>
            {negative ? "Negative Record" : "Positive Record"}
          </span>
          {isMatchupRecord && (
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-accent-blue/10 text-accent-blue">Matchup Record</span>
          )}
        </div>
      </div>

      {/* Current Holder */}
      {currentHolder && (
        <div className="card p-8 text-center" style={{ borderColor: negative ? "var(--color-accent-red)" : "var(--color-gold-dark)", borderWidth: "1px" }}>
          <div className="stat-label mb-2">Current Record Holder</div>
          <div className="text-5xl tracking-wider gold-gradient" style={{ fontFamily: '"Bebas Neue", Impact, sans-serif' }}>{currentHolder.manager_id}</div>
          <div className="stat-value text-3xl text-text-primary mt-2">{Number(currentHolder.record_value).toFixed(2)}</div>
          <div className="text-text-muted text-sm mt-2">
            {formatPeriod(currentHolder.from_year, currentHolder.from_week, currentHolder.to_year, currentHolder.to_week, true)} · {currentHolder.weeks_held} Wochen
          </div>
        </div>
      )}

      {/* All-Owner Ranking */}
      <section>
        <h2 className="section-header text-text-primary mb-4">Ranking — Alle Owner</h2>
        {ranking ? (
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-text-muted text-left">
                  <th className="p-4 w-12">#</th>
                  <th className="p-4">Manager</th>
                  <th className="p-4 text-right">Value</th>
                  {ranking.some((r) => r.season) && <th className="p-4 text-right">Season</th>}
                  {ranking.some((r) => r.week) && <th className="p-4 text-right">Week</th>}
                </tr>
              </thead>
              <tbody>
                {ranking.map((row, i) => {
                  const isCurrent = currentHolder?.manager_id === row.manager;
                  return (
                    <tr key={row.manager} className={`border-b border-border/50 hover:bg-bg-card-hover transition-colors ${isCurrent ? "bg-gold/5" : ""}`}>
                      <td className="p-4 text-text-muted">{i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}</td>
                      <td className="p-4">
                        <Link href={`/manager/${row.manager}`} className="font-medium text-text-primary hover:text-gold transition-colors">
                          {row.manager}
                          {isCurrent && <span className="text-gold text-xs ml-2">RECORD</span>}
                        </Link>
                      </td>
                      <td className={`p-4 text-right font-mono ${i === 0 ? "text-gold font-semibold" : "text-text-primary"}`}>
                        {Number.isInteger(row.value) ? row.value : row.value.toFixed(2)}
                      </td>
                      {ranking.some((r) => r.season) && (
                        <td className="p-4 text-right text-text-muted">{row.season ?? "—"}</td>
                      )}
                      {ranking.some((r) => r.week) && (
                        <td className="p-4 text-right text-text-muted">{row.week ? `W${row.week}` : "—"}</td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="card p-6 text-center text-text-muted">
            Ranking für diesen Record-Typ wird noch implementiert.
          </div>
        )}
      </section>

      {/* Timeline */}
      <section>
        <h2 className="section-header text-text-primary mb-4">Record Timeline</h2>
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
                    entry.is_current ? "bg-gold border-gold" : "bg-bg-card border-border-light"
                  }`} />

                  {/* Content card */}
                  <div className={`card p-4 flex-1 flex items-center justify-between ${entry.is_current ? "border-gold/30" : ""}`}>
                    <div>
                      <Link href={`/manager/${entry.manager_id}`}
                        className={`font-semibold text-lg hover:text-gold transition-colors ${entry.is_current ? "text-gold" : "text-text-primary"}`}>
                        {entry.manager_id}
                      </Link>
                      <div className="text-text-muted text-sm">{period}</div>
                      <div className="text-text-muted text-xs">{entry.weeks_held} Wochen gehalten</div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="font-mono text-lg text-text-primary">{Number(entry.record_value).toFixed(2)}</div>
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
