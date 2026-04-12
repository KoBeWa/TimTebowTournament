// Achievement keys classified as "blunders" (negative)
export const BLUNDER_KEYS = new Set([
  // Champion category negatives
  "the_worst",
  "still_the_worst",
  "trash_trifecta",
  "icarus_award",
  // Draft negatives
  "the_madman",
  "worst_draft_pick",
  "worst_qb_draft",
  "worst_rb_draft",
  "worst_wr_draft",
  "worst_te_draft",
  "worst_k_draft",
  "worst_dst_draft",
  // Matchup negatives
  "bullied",
  "doubled_up",
  "firing_squad",
  "spoiled_goods",
  "the_bye_week",
  "the_dud_bowl",
  "true_lowlight",
  "heartbreaker",
  "massacre",
  "micro_defeat",
  "small_defeat",
  // Season negatives
  "cursed",
  "wood_season",
  "iron_season",
  "clay_season",
  "the_cupcake",
  "bottom_half_75pct",
  "goose_egg",
  // Roster negatives
  "the_mascot",
]);

// Record keys classified as "negative" records
export const NEGATIVE_RECORD_KEYS = new Set([
  "allplay_losses",
  "blowout_losses",
  "bottom_half",
  "bottom_half_pct",
  "bottom_score_pct",
  "bottom_scores",
  "easiest_season_sos",
  "easiest_sos",
  "fewest_matchup_points",
  "fewest_playoff_matchup_pts",
  "fewest_season_opp_pts",
  "fewest_season_points",
  "losing_record_seasons",
  "lowest_combined_score",
  "lowest_playoff_combined",
  "lowest_points_share",
  "lowest_season_pts_share",
  "most_season_ap_losses",
  "most_season_blowout_losses",
  "most_season_bottom_half",
  "most_season_bottom_scores",
  "most_season_losses",
  "most_season_narrow_losses",
  "most_season_worst_scores",
  "narrowest_win",
  "narrowest_playoff_win",
  "opp_points_share_avg",
  "playoff_losses",
  "season_score_worst",
  "total_losses",
  "total_opp_points",
  "unluckiest",
  "worst_draft_pick_ever",
  "worst_draft_season",
  "worst_dst_draft_pick",
  "worst_dst_draft_season",
  "worst_k_draft_pick",
  "worst_k_draft_season",
  "worst_qb_draft_pick",
  "worst_qb_draft_season",
  "worst_rb_draft_pick",
  "worst_rb_draft_season",
  "worst_season_luck",
  "worst_te_draft_pick",
  "worst_te_draft_season",
  "worst_waiver_season",
  "worst_wr_draft_pick",
  "worst_wr_draft_season",
  "worst_score_pct",
  "worst_scores",
  // Streaks & Droughts (droughts are negative)
  "loss_streak",
  "high_score_drought",
  "top_half_drought",
  "playoff_appearance_drought",
  "championship_drought",
  "top_score_drought",
  "winning_record_drought",
  "title_game_drought",
  "medal_drought",
  "loss_start_streak",
  // Fun Facts (negative)
  "most_weeks_last_place",
  "most_h2h_losses",
  "fewest_h2h_wins",
  "worst_playoff_win_pct",
  "worst_ppg",
  "fewest_points_in_win",
  "fewest_bench_points_season",
  "highest_season_opp_pts_share",
  "lowest_avg_draft_pos",
  "fewest_playoff_appearances",
]);

export function isBlunder(achievementKey: string): boolean {
  return BLUNDER_KEYS.has(achievementKey);
}

export function isNegativeRecord(recordKey: string): boolean {
  return NEGATIVE_RECORD_KEYS.has(recordKey);
}

// Pretty labels for achievement keys
export function achievementLabel(key: string): string {
  return key
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
