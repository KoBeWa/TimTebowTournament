import { RECORD_DESCRIPTIONS } from "./descriptions";

export type OwnerRow = { record_key: string; manager_id: string; current_value: number };
export type TimelineEntry = {
  id: number;
  period_id: number;
  record_key: string;
  record_label: string;
  manager_id: string;
  record_value: string | number;
  from_year: number;
  from_week: number;
  to_year: number | null;
  to_week: number | null;
  is_current: boolean;
  weeks_held: number;
};

export function fmtVal(v: number) {
  return v.toLocaleString("de-DE", Number.isInteger(v) ? undefined : { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function fmtPoint(year: number, week: number) {
  return week > 0 ? `${year} W${week}` : String(year);
}

// "seit 2017 W3" for the current holder, otherwise "2017 W3 bis 2019 W11"
export function fmtPeriod(e: Pick<TimelineEntry, "from_year" | "from_week" | "to_year" | "to_week" | "is_current">): string {
  const from = fmtPoint(e.from_year, e.from_week);
  if (e.is_current) return `seit ${from}`;
  if (!e.to_year) return from;
  const to = fmtPoint(e.to_year, e.to_week ?? 0);
  return from === to ? from : `${from} bis ${to}`;
}

// Higher value wins unless the values mostly fall over time. Without a trend, look at who holds it now.
// Records where the lowest value wins (direction = 'min' in rebuild.record_defs, which the
// public API cannot read). Keep in sync when a record is added there.
const LOWER_WINS = new Set([
  "coach_score_season_worst", "coach_score_worst_alltime", "dst_avg_pts_season_worst",
  "dst_avg_pts_worst", "easiest_season_sos", "easiest_sos", "fewest_bench_all_points",
  "fewest_bench_points_season", "fewest_bench_week_points", "fewest_h2h_losses",
  "fewest_h2h_points", "fewest_h2h_wins", "fewest_matchup_points", "fewest_playoff_appearances",
  "fewest_playoff_matchup_pts", "fewest_points_in_win", "fewest_season_opp_pts",
  "fewest_season_points", "k_avg_pts_season_worst", "k_avg_pts_worst", "lowest_avg_draft_pos",
  "lowest_combined_score", "lowest_median_score", "lowest_playoff_combined", "lowest_points_share",
  "lowest_season_opp_pts_share", "lowest_season_pts_share", "most_consistent_season",
  "most_consistent_team", "most_unlucky_season", "narrowest_playoff_win", "narrowest_win",
  "qb_avg_pts_season_worst", "qb_avg_pts_worst", "rb_avg_pts_season_worst", "rb_avg_pts_worst",
  "season_score_worst", "smallest_margin_defeat", "smallest_margin_victory",
  "te_avg_pts_season_worst", "te_avg_pts_worst", "unluckiest", "worst_champion_record",
  "worst_draft_pick_ever", "worst_draft_season", "worst_dst_draft_pick", "worst_dst_draft_season",
  "worst_k_draft_pick", "worst_k_draft_season", "worst_manager_season", "worst_playoff_win_pct",
  "worst_ppg", "worst_qb_draft_pick", "worst_qb_draft_season", "worst_rb_draft_pick",
  "worst_rb_draft_season", "worst_season_luck", "worst_te_draft_pick", "worst_te_draft_season",
  "worst_trade_season_value", "worst_trade_value", "worst_waiver_season", "worst_waivers",
  "worst_wr_draft_pick", "worst_wr_draft_season", "wr_avg_pts_season_worst", "wr_avg_pts_worst",
]);

export function higherWins(
  key: string,
  periods: { record_value: string | number }[],
  owners: { current_value: number }[],
): boolean {
  if (LOWER_WINS.has(key)) return false;
  // Records missing from the list: the current holder's value is the best one
  const holder = Number(periods.at(-1)?.record_value);
  if (owners.length > 1 && Number.isFinite(holder)) {
    const max = Math.max(...owners.map((o) => o.current_value));
    const min = Math.min(...owners.map((o) => o.current_value));
    if (holder === min && holder !== max) return false;
  }
  return true;
}

export function recordDescription(key: string, label: string, higher: boolean): string {
  return RECORD_DESCRIPTIONS[key]
    ?? `Rekord für «${label}»: ${higher ? "der höchste" : "der niedrigste"} Wert zählt.`;
}
