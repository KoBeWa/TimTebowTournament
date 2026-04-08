// === Database row types ===

export interface Manager {
  manager_id: string;
  display_name: string;
  avatar_url?: string;
}

export interface Season {
  season: number;
  champion: string;
  runner_up: string;
  sacko: string;
  num_teams: number;
  num_weeks: number;
  platform: string;
}

export interface SeasonResult {
  season: number;
  manager_id: string;
  final_rank: number;
  wins: number;
  losses: number;
  ties: number;
  points_for: number;
  points_against: number;
  playoff_seed: number;
  all_play_wins?: number;
  all_play_losses?: number;
  all_play_pct?: number;
  sos_rank?: number;
  luck_rating?: number;
  manager_rank?: number;
  coach_rank?: number;
}

export interface PlayoffResult {
  season: number;
  manager_id: string;
  playoff_rank: number;
  seed: number;
  week15_pts: number;
  week16_pts: number;
}

export interface WeeklyMatchup {
  season: number;
  week: number;
  manager_id: string;
  opponent_id: string;
  points: number;
  opponent_points: number;
  result: "W" | "L" | "T";
  is_playoff: boolean;
}

export interface WeeklyLineup {
  season: number;
  week: number;
  manager_id: string;
  player_name: string;
  slot: string;
  position: string;
  nfl_team: string;
  points: number;
  espn_id?: string;
  sleeper_id?: string;
}

export interface DraftPick {
  season: number;
  round: number;
  pick: number;
  overall: number;
  manager_id: string;
  player_name: string;
  position: string;
  sleeper_id?: string;
  espn_id?: string;
}

export interface FaPickup {
  season: number;
  week: number;
  manager_id: string;
  player_name: string;
  position: string;
  action: string;
}

export interface PlayerWeeklyStat {
  player_id: string;
  player_display_name: string;
  position: string;
  season: number;
  week: number;
  season_type: string;
  team: string;
  opponent_team: string;
  completions: number;
  attempts: number;
  passing_yards: number;
  passing_tds: number;
  passing_interceptions: number;
  sacks_suffered: number;
  passing_2pt_conversions: number;
  carries: number;
  rushing_yards: number;
  rushing_tds: number;
  rushing_fumbles: number;
  rushing_2pt_conversions: number;
  receptions: number;
  targets: number;
  receiving_yards: number;
  receiving_tds: number;
  receiving_fumbles: number;
  receiving_2pt_conversions: number;
  fg_made: number;
  fg_att: number;
  fg_made_0_19: number;
  fg_made_20_29: number;
  fg_made_30_39: number;
  fg_made_40_49: number;
  fg_made_50_59: number;
  fg_made_60_: number;
  pat_made: number;
  pat_att: number;
}

export interface Player {
  gsis_id: string;
  espn_id: string;
  display_name: string;
  first_name: string;
  last_name: string;
  position: string;
  headshot: string;
  latest_team: string;
  jersey_number: number;
  college_name: string;
}

// === Computed / UI types ===

export interface MatchupWithLineups {
  season: number;
  week: number;
  manager: Manager;
  opponent: Manager;
  points: number;
  opponent_points: number;
  result: "W" | "L" | "T";
  lineup: (WeeklyLineup & { stats?: PlayerWeeklyStat; player?: Player })[];
  opponent_lineup: (WeeklyLineup & {
    stats?: PlayerWeeklyStat;
    player?: Player;
  })[];
}

export interface HeadToHeadRecord {
  manager_id: string;
  opponent_id: string;
  wins: number;
  losses: number;
  ties: number;
  total_points_for: number;
  total_points_against: number;
  matchups: WeeklyMatchup[];
}

export interface SeasonAward {
  season: number;
  award_name: string;
  winner: string;
  value?: number;
  description?: string;
}
