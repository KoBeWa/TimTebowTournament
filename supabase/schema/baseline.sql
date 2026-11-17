-- =============================================================================
-- Schema baseline for the Supabase Postgres database (schemas: public, rebuild)
--
-- Generated from the live catalog (pg_catalog / information_schema) on 2026-11-17.
-- NOT applied by migrations. For disaster recovery and reference only.
-- Data is not included. No secrets are included.
--
-- Contents, in dependency order:
--   1. Schema and extensions
--   2. Sequences, tables (public, rebuild), foreign keys
--   3. Indexes that do not back a constraint
--   4. Functions and procedures
--   5. Views and materialized views (by dependency level), matview indexes
--   6. Row level security and policies
--   7. Grants for anon and authenticated
--
-- Excluded on purpose: the three *_backup_20261013 tables, Supabase-managed
-- schemas (auth, storage, vault, ...), data.
--
-- Known gaps (see the end of the file): several functions reference tables that
-- do not exist in this database (groups, pc_lineup_slots, playoff_*, teams,
-- profiles, game_runs, ...). They are reproduced as stored and only compile
-- because function body checking is switched off.
-- =============================================================================

set search_path = public;

-- ---------------------------------------------------------------------------
-- 1. Schema and extensions
--    Extensions in use at generation time (all in the schema shown); Supabase
--    projects already ship with these.
-- ---------------------------------------------------------------------------

create schema if not exists rebuild;

create extension if not exists pg_stat_statements with schema extensions;
create extension if not exists pgcrypto with schema extensions;
create extension if not exists "uuid-ossp" with schema extensions;
-- supabase_vault is installed in schema vault by the platform:
-- create extension if not exists supabase_vault with schema vault;

-- ---------------------------------------------------------------------------
-- 2a. Tables: schema rebuild
-- ---------------------------------------------------------------------------

create table if not exists rebuild.games_cache (
  matchup_id integer,
  season_year integer,
  week integer,
  is_playoff boolean,
  manager_id text,
  opponent_id text,
  pf numeric,
  pa numeric,
  idx integer,
  won boolean,
  lost boolean,
  tied boolean,
  margin numeric,
  combined numeric,
  share numeric,
  week_rank integer,
  allplay_wins integer,
  allplay_losses integer,
  week_avg numeric,
  week_median double precision,
  week_teams integer,
  seed integer,
  opponent_seed integer,
  final_rank integer,
  opponent_final_rank integer,
  game_type text
);

create table if not exists rebuild.lineup_cache (
  season_year integer,
  week integer,
  idx integer,
  manager_id text,
  pos text,
  pts numeric,
  slots bigint
);

create table if not exists rebuild.obs_cache (
  record_key text,
  manager_id text,
  idx integer,
  v1 numeric,
  v2 numeric,
  grp text
);

create table if not exists rebuild.record_defs (
  record_key text not null,
  record_label text not null,
  agg text not null,
  direction text not null,
  positive_only boolean default false not null,
  min_obs integer default 1 not null,
  constraint record_defs_pkey PRIMARY KEY (record_key),
  constraint record_defs_agg_check CHECK ((agg = ANY (ARRAY['sum'::text, 'ratio'::text, 'max'::text, 'min'::text, 'group_max'::text, 'group_min'::text, 'median'::text, 'stddev'::text]))),
  constraint record_defs_direction_check CHECK ((direction = ANY (ARRAY['max'::text, 'min'::text])))
);

create table if not exists rebuild.record_holders (
  record_key text not null,
  idx integer not null,
  manager_id text,
  value numeric,
  constraint record_holders_pkey PRIMARY KEY (record_key, idx)
);

create table if not exists rebuild.record_owner_values_new (
  record_key text,
  manager_id text,
  current_value numeric
);

create table if not exists rebuild.record_timeline_new (
  record_key text,
  record_label text,
  period_id integer,
  manager_id text,
  from_year integer,
  from_week integer,
  to_year integer,
  to_week integer,
  weeks_held integer,
  record_value numeric,
  is_current boolean
);

create table if not exists rebuild.record_values (
  record_key text not null,
  manager_id text not null,
  idx integer not null,
  value numeric,
  constraint record_values_pkey PRIMARY KEY (record_key, manager_id, idx)
);

create table if not exists rebuild.settings (
  key text not null,
  value numeric not null,
  description text,
  constraint settings_pkey PRIMARY KEY (key)
);

-- ---------------------------------------------------------------------------
-- 2b. Sequences (serial columns of schema public)
-- ---------------------------------------------------------------------------

create sequence if not exists public.achievements_id_seq as integer start 1 increment 1 minvalue 1 maxvalue 2147483647 cache 1;
create sequence if not exists public.draft_picks_id_seq as integer start 1 increment 1 minvalue 1 maxvalue 2147483647 cache 1;
create sequence if not exists public.elo_ratings_id_seq as integer start 1 increment 1 minvalue 1 maxvalue 2147483647 cache 1;
create sequence if not exists public.fa_moves_id_seq as integer start 1 increment 1 minvalue 1 maxvalue 2147483647 cache 1;
create sequence if not exists public.fa_pickups_id_seq as integer start 1 increment 1 minvalue 1 maxvalue 2147483647 cache 1;
create sequence if not exists public.fa_transactions_id_seq as integer start 1 increment 1 minvalue 1 maxvalue 2147483647 cache 1;
create sequence if not exists public.mock_draft_picks_id_seq as integer start 1 increment 1 minvalue 1 maxvalue 2147483647 cache 1;
create sequence if not exists public.mock_draft_prospects_id_seq as integer start 1 increment 1 minvalue 1 maxvalue 2147483647 cache 1;
create sequence if not exists public.mock_drafts_id_seq as integer start 1 increment 1 minvalue 1 maxvalue 2147483647 cache 1;
create sequence if not exists public.player_weekly_stats_id_seq as integer start 1 increment 1 minvalue 1 maxvalue 2147483647 cache 1;
create sequence if not exists public.playoff_results_id_seq as integer start 1 increment 1 minvalue 1 maxvalue 2147483647 cache 1;
create sequence if not exists public.record_timeline_id_seq as integer start 1 increment 1 minvalue 1 maxvalue 2147483647 cache 1;
create sequence if not exists public.season_results_id_seq as integer start 1 increment 1 minvalue 1 maxvalue 2147483647 cache 1;
create sequence if not exists public.weekly_lineups_id_seq as integer start 1 increment 1 minvalue 1 maxvalue 2147483647 cache 1;
create sequence if not exists public.weekly_matchups_id_seq as integer start 1 increment 1 minvalue 1 maxvalue 2147483647 cache 1;

-- ---------------------------------------------------------------------------
-- 2c. Tables: schema public (primary key, unique and check constraints inline;
--     foreign keys follow in section 2d)
-- ---------------------------------------------------------------------------

create table if not exists public.achievements (
  id integer not null default nextval('public.achievements_id_seq'::regclass),
  season_year integer,
  manager_id text,
  achievement_key text not null,
  achievement_category text not null,
  value numeric(8,2),
  notes text,
  is_manual boolean default false,
  created_at timestamp without time zone default now(),
  description text,
  matchup_id integer,
  constraint achievements_pkey PRIMARY KEY (id)
);

create table if not exists public.college_teams (
  school text not null,
  logo_url text,
  alt_name1 text,
  alt_name2 text,
  alt_name3 text,
  constraint college_teams_pkey PRIMARY KEY (school)
);

create table if not exists public.draft_picks (
  id integer not null default nextval('public.draft_picks_id_seq'::regclass),
  season_year integer,
  manager_id text,
  round integer,
  overall_pick integer,
  player_name text,
  "position" text,
  vorp numeric(7,2),
  grade4 numeric(6,2),
  projected_pts numeric(7,2),
  actual_pts numeric(7,2),
  sleeper_id text,
  espn_id text,
  constraint draft_picks_pkey PRIMARY KEY (id),
  constraint draft_picks_season_year_overall_pick_key UNIQUE (season_year, overall_pick)
);

create table if not exists public.elo_ratings (
  id integer not null default nextval('public.elo_ratings_id_seq'::regclass),
  season_year integer not null,
  week integer not null,
  is_playoff boolean not null default false,
  manager_id text,
  opponent_id text,
  elo_before numeric(8,2) not null,
  elo_after numeric(8,2) not null,
  elo_change numeric(8,2) not null,
  score numeric(8,2),
  opp_score numeric(8,2),
  won boolean,
  expected_score numeric(8,4),
  actual_score numeric(8,4),
  game_seq integer,
  weekly_rank integer,
  rank_component numeric(6,4),
  mov_multiplier numeric(6,4),
  upset_multiplier numeric(6,4),
  perf_multiplier numeric(6,4),
  k_used numeric(8,4),
  is_upset boolean default false,
  constraint elo_ratings_pkey PRIMARY KEY (id),
  constraint elo_ratings_season_year_week_manager_id_key UNIQUE (season_year, week, manager_id)
);

create table if not exists public.fa_moves (
  id integer not null default nextval('public.fa_moves_id_seq'::regclass),
  season_year integer,
  week integer,
  manager_id text,
  action text,
  player_name text,
  "position" text,
  transaction_id text,
  transaction_at timestamp without time zone,
  item_id text,
  player_id text,
  nfl_team text,
  constraint fa_moves_pkey PRIMARY KEY (id)
);

create table if not exists public.fa_pickups (
  id integer not null default nextval('public.fa_pickups_id_seq'::regclass),
  season_year integer,
  manager_id text,
  player_name text,
  "position" text,
  first_week integer,
  roster_weeks integer,
  weeks_scored integer,
  points_after_pickup numeric(7,2),
  avg_points numeric(6,2),
  max_week_points numeric(6,2),
  season_ttl numeric(7,2),
  season_avg numeric(6,2),
  season_gp integer,
  season_vorp numeric(6,2),
  pickup_share numeric(6,4),
  reliability numeric(6,4),
  early_factor numeric(6,4),
  pickup_score numeric(6,2),
  pickup_score_pos numeric(6,2),
  pickup_score_all_time numeric(6,2),
  pickup_score_all_time_pos numeric(6,2),
  constraint fa_pickups_pkey PRIMARY KEY (id),
  constraint fa_pickups_season_year_manager_id_player_name_key UNIQUE (season_year, manager_id, player_name)
);

create table if not exists public.fa_transaction_scores (
  transaction_id text,
  season_year integer,
  gain_week integer,
  transaction_at timestamp without time zone,
  manager_id text,
  add_player text,
  add_pos text,
  add_pid text,
  drop_player text,
  drop_pos text,
  drop_pid text,
  drop_week integer,
  window_end integer,
  window_weeks integer,
  add_pts numeric,
  drop_pts numeric,
  add_pts_adj numeric,
  drop_pts_adj numeric,
  net_pts numeric,
  net_pts_adj numeric,
  transaction_score numeric,
  transaction_score_alltime numeric
);

create table if not exists public.fa_transactions (
  id integer not null default nextval('public.fa_transactions_id_seq'::regclass),
  season_year integer not null,
  transaction_id text not null,
  transaction_type text,
  transaction_category text,
  team_name text,
  transaction_week integer,
  transaction_at timestamp without time zone,
  item_id text,
  item_direction text,
  player_id text,
  player_name text,
  "position" text,
  nfl_team text,
  item_value numeric(10,4),
  constraint fa_transactions_pkey PRIMARY KEY (id)
);

create table if not exists public.managers (
  id text not null,
  name text not null,
  color_hex text,
  first_season integer,
  constraint managers_pkey PRIMARY KEY (id)
);

create table if not exists public.matchup_projections (
  season_year integer not null,
  week integer not null,
  manager_a text not null,
  manager_b text not null,
  proj_a numeric,
  proj_b numeric,
  win_prob_a numeric,
  is_playoff boolean not null default false,
  updated_at timestamp with time zone not null default now(),
  constraint matchup_projections_pkey PRIMARY KEY (season_year, week, manager_a, manager_b)
);

create table if not exists public.mock_draft_picks (
  id integer not null default nextval('public.mock_draft_picks_id_seq'::regclass),
  mock_draft_id integer not null,
  pick_number integer not null,
  prospect_id integer,
  constraint mock_draft_picks_pkey PRIMARY KEY (id),
  constraint mock_draft_picks_mock_draft_id_pick_number_key UNIQUE (mock_draft_id, pick_number),
  constraint mock_draft_picks_mock_draft_id_prospect_id_key UNIQUE (mock_draft_id, prospect_id),
  constraint mock_draft_picks_pick_number_check CHECK (((pick_number >= 1) AND (pick_number <= 32)))
);

create table if not exists public.mock_draft_prospects (
  id integer not null default nextval('public.mock_draft_prospects_id_seq'::regclass),
  player_name text not null,
  "position" text not null,
  college text,
  consensus_rank text,
  headshot_url text,
  notes text,
  college_logo_url text,
  nfl_id text,
  esb_id text,
  first_name text,
  last_name text,
  hometown text,
  college_class text,
  height text,
  weight text,
  arm_length text,
  hand_size text,
  wingspan text,
  forty_yard_dash text,
  ten_yard_split text,
  twenty_yard_shuttle text,
  three_cone_drill text,
  broad_jump text,
  vertical_jump text,
  bench_press text,
  draft_grade text,
  draft_projection text,
  nfl_comparison text,
  overview text,
  strengths text,
  weaknesses text,
  bio text,
  sources_tell_us text,
  athleticism_score text,
  production_score text,
  position_group text,
  constraint mock_draft_prospects_pkey PRIMARY KEY (id)
);

create table if not exists public.mock_drafts (
  id integer not null default nextval('public.mock_drafts_id_seq'::regclass),
  manager_id text not null,
  draft_year integer not null default 2026,
  title text,
  is_locked boolean not null default false,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint mock_drafts_pkey PRIMARY KEY (id),
  constraint mock_drafts_manager_id_draft_year_key UNIQUE (manager_id, draft_year)
);

create table if not exists public.nfl_draft_order_2026 (
  pick_number integer not null,
  team_abbr text not null,
  note text,
  constraint nfl_draft_order_2026_pkey PRIMARY KEY (pick_number),
  constraint nfl_draft_order_2026_pick_number_check CHECK (((pick_number >= 1) AND (pick_number <= 32)))
);

create table if not exists public.nfl_draft_results_2026 (
  pick_number integer not null,
  team_abbr text not null,
  prospect_id integer,
  player_name text,
  note text,
  "position" text,
  constraint nfl_draft_results_2026_pkey PRIMARY KEY (pick_number),
  constraint nfl_draft_results_2026_pick_number_check CHECK (((pick_number >= 1) AND (pick_number <= 32)))
);

create table if not exists public.nfl_team_needs (
  team_abbr text not null,
  "position" text not null,
  priority integer not null default 1,
  constraint nfl_team_needs_pkey PRIMARY KEY (team_abbr, "position")
);

create table if not exists public.nfl_teams_draft (
  team_abbr text not null,
  team_name text not null,
  conference text not null,
  division text not null,
  logo_url text,
  color_1 text,
  color_2 text,
  color_3 text,
  color_4 text,
  constraint nfl_teams_draft_pkey PRIMARY KEY (team_abbr),
  constraint nfl_teams_draft_conference_check CHECK ((conference = ANY (ARRAY['AFC'::text, 'NFC'::text])))
);

create table if not exists public.player_projections (
  season_year integer not null,
  week integer not null,
  sleeper_id text not null,
  player_name text,
  "position" text,
  team text,
  pts_half_ppr numeric,
  pts_ppr numeric,
  pts_std numeric,
  updated_at timestamp with time zone not null default now(),
  constraint player_projections_pkey PRIMARY KEY (season_year, week, sleeper_id)
);

create table if not exists public.player_weekly_stats (
  id integer not null default nextval('public.player_weekly_stats_id_seq'::regclass),
  player_id text not null,
  player_display_name text not null,
  "position" text,
  season integer not null,
  week integer not null,
  season_type text default 'REG'::text,
  team text,
  opponent_team text,
  completions integer default 0,
  attempts integer default 0,
  passing_yards integer default 0,
  passing_tds integer default 0,
  passing_interceptions integer default 0,
  sacks_suffered integer default 0,
  passing_2pt_conversions integer default 0,
  carries integer default 0,
  rushing_yards integer default 0,
  rushing_tds integer default 0,
  rushing_fumbles integer default 0,
  rushing_2pt_conversions integer default 0,
  receptions integer default 0,
  targets integer default 0,
  receiving_yards integer default 0,
  receiving_tds integer default 0,
  receiving_fumbles integer default 0,
  receiving_2pt_conversions integer default 0,
  fg_made integer default 0,
  fg_att integer default 0,
  fg_made_0_19 integer default 0,
  fg_made_20_29 integer default 0,
  fg_made_30_39 integer default 0,
  fg_made_40_49 integer default 0,
  fg_made_50_59 integer default 0,
  fg_made_60_ integer default 0,
  pat_made integer default 0,
  pat_att integer default 0,
  constraint player_weekly_stats_pkey PRIMARY KEY (id),
  constraint player_weekly_stats_player_id_season_week_season_type_key UNIQUE (player_id, season, week, season_type)
);

create table if not exists public.players (
  gsis_id text not null,
  espn_id text,
  display_name text,
  first_name text,
  last_name text,
  "position" text,
  position_group text,
  headshot text,
  latest_team text,
  status text,
  height integer,
  weight integer,
  college_name text,
  jersey_number integer,
  rookie_season integer,
  last_season integer,
  draft_year integer,
  draft_round integer,
  draft_pick integer,
  draft_team text,
  constraint players_pkey PRIMARY KEY (gsis_id)
);

create table if not exists public.playoff_results (
  id integer not null default nextval('public.playoff_results_id_seq'::regclass),
  season_year integer,
  manager_id text,
  seed integer,
  week15_pts numeric(7,2),
  week16_pts numeric(7,2),
  final_rank integer,
  constraint playoff_results_pkey PRIMARY KEY (id),
  constraint playoff_results_season_year_manager_id_key UNIQUE (season_year, manager_id)
);

create table if not exists public.record_owner_values (
  record_key text not null,
  manager_id text not null,
  current_value numeric,
  constraint record_owner_values_pkey PRIMARY KEY (record_key, manager_id)
);

create table if not exists public.record_timeline (
  id integer not null default nextval('public.record_timeline_id_seq'::regclass),
  record_key text not null,
  record_label text not null,
  period_id integer not null,
  manager_id text,
  from_year integer,
  from_week integer,
  to_year integer,
  to_week integer,
  weeks_held integer,
  record_value numeric(10,2),
  is_current boolean default false,
  constraint record_timeline_pkey PRIMARY KEY (id),
  constraint record_timeline_record_key_period_id_key UNIQUE (record_key, period_id)
);

create table if not exists public.season_results (
  id integer not null default nextval('public.season_results_id_seq'::regclass),
  season_year integer,
  manager_id text,
  reg_rank integer,
  wins integer,
  losses integer,
  ties integer default 0,
  points_for numeric(8,2),
  points_against numeric(8,2),
  moves integer,
  trades integer,
  draft_position integer,
  playoff_rank integer,
  championship_finish integer,
  max_points_for numeric(8,2),
  lineup_efficiency numeric(5,4),
  constraint season_results_pkey PRIMARY KEY (id),
  constraint season_results_season_year_manager_id_key UNIQUE (season_year, manager_id)
);

create table if not exists public.seasons (
  year integer not null,
  reg_season_weeks integer default 14,
  playoff_teams integer default 4,
  total_managers integer default 8,
  constraint seasons_pkey PRIMARY KEY (year)
);

create table if not exists public.weekly_lineups (
  id integer not null default nextval('public.weekly_lineups_id_seq'::regclass),
  season_year integer,
  week integer,
  manager_id text,
  slot text,
  player_name text,
  sleeper_id text,
  espn_id text,
  points numeric(6,2),
  is_starter boolean default true,
  constraint weekly_lineups_pkey PRIMARY KEY (id)
);

create table if not exists public.weekly_matchups (
  id integer not null default nextval('public.weekly_matchups_id_seq'::regclass),
  season_year integer,
  week integer,
  manager_a text,
  score_a numeric(7,2),
  manager_b text,
  score_b numeric(7,2),
  is_playoff boolean default false,
  constraint weekly_matchups_pkey PRIMARY KEY (id),
  constraint weekly_matchups_season_year_week_manager_a_manager_b_key UNIQUE (season_year, week, manager_a, manager_b)
);

alter sequence public.achievements_id_seq owned by public.achievements.id;
alter sequence public.draft_picks_id_seq owned by public.draft_picks.id;
alter sequence public.elo_ratings_id_seq owned by public.elo_ratings.id;
alter sequence public.fa_moves_id_seq owned by public.fa_moves.id;
alter sequence public.fa_pickups_id_seq owned by public.fa_pickups.id;
alter sequence public.fa_transactions_id_seq owned by public.fa_transactions.id;
alter sequence public.mock_draft_picks_id_seq owned by public.mock_draft_picks.id;
alter sequence public.mock_draft_prospects_id_seq owned by public.mock_draft_prospects.id;
alter sequence public.mock_drafts_id_seq owned by public.mock_drafts.id;
alter sequence public.player_weekly_stats_id_seq owned by public.player_weekly_stats.id;
alter sequence public.playoff_results_id_seq owned by public.playoff_results.id;
alter sequence public.record_timeline_id_seq owned by public.record_timeline.id;
alter sequence public.season_results_id_seq owned by public.season_results.id;
alter sequence public.weekly_lineups_id_seq owned by public.weekly_lineups.id;
alter sequence public.weekly_matchups_id_seq owned by public.weekly_matchups.id;

-- ---------------------------------------------------------------------------
-- 2d. Foreign keys
-- ---------------------------------------------------------------------------

alter table public.achievements add constraint achievements_manager_id_fkey FOREIGN KEY (manager_id) REFERENCES managers(id);
alter table public.achievements add constraint achievements_matchup_id_fkey FOREIGN KEY (matchup_id) REFERENCES weekly_matchups(id);
alter table public.achievements add constraint achievements_season_year_fkey FOREIGN KEY (season_year) REFERENCES seasons(year);
alter table public.draft_picks add constraint draft_picks_manager_id_fkey FOREIGN KEY (manager_id) REFERENCES managers(id);
alter table public.draft_picks add constraint draft_picks_season_year_fkey FOREIGN KEY (season_year) REFERENCES seasons(year);
alter table public.elo_ratings add constraint elo_ratings_manager_id_fkey FOREIGN KEY (manager_id) REFERENCES managers(id);
alter table public.elo_ratings add constraint elo_ratings_opponent_id_fkey FOREIGN KEY (opponent_id) REFERENCES managers(id);
alter table public.fa_moves add constraint fa_moves_manager_id_fkey FOREIGN KEY (manager_id) REFERENCES managers(id);
alter table public.fa_moves add constraint fa_moves_season_year_fkey FOREIGN KEY (season_year) REFERENCES seasons(year);
alter table public.fa_pickups add constraint fa_pickups_manager_id_fkey FOREIGN KEY (manager_id) REFERENCES managers(id);
alter table public.fa_pickups add constraint fa_pickups_season_year_fkey FOREIGN KEY (season_year) REFERENCES seasons(year);
alter table public.mock_draft_picks add constraint mock_draft_picks_mock_draft_id_fkey FOREIGN KEY (mock_draft_id) REFERENCES mock_drafts(id) ON DELETE CASCADE;
alter table public.mock_draft_picks add constraint mock_draft_picks_prospect_id_fkey FOREIGN KEY (prospect_id) REFERENCES mock_draft_prospects(id);
alter table public.nfl_draft_order_2026 add constraint nfl_draft_order_2026_team_abbr_fkey FOREIGN KEY (team_abbr) REFERENCES nfl_teams_draft(team_abbr);
alter table public.nfl_draft_results_2026 add constraint nfl_draft_results_2026_prospect_id_fkey FOREIGN KEY (prospect_id) REFERENCES mock_draft_prospects(id);
alter table public.nfl_draft_results_2026 add constraint nfl_draft_results_2026_team_abbr_fkey FOREIGN KEY (team_abbr) REFERENCES nfl_teams_draft(team_abbr);
alter table public.nfl_team_needs add constraint nfl_team_needs_team_abbr_fkey FOREIGN KEY (team_abbr) REFERENCES nfl_teams_draft(team_abbr);
alter table public.playoff_results add constraint playoff_results_manager_id_fkey FOREIGN KEY (manager_id) REFERENCES managers(id);
alter table public.playoff_results add constraint playoff_results_season_year_fkey FOREIGN KEY (season_year) REFERENCES seasons(year);
alter table public.record_timeline add constraint record_timeline_manager_id_fkey FOREIGN KEY (manager_id) REFERENCES managers(id);
alter table public.season_results add constraint season_results_manager_id_fkey FOREIGN KEY (manager_id) REFERENCES managers(id);
alter table public.season_results add constraint season_results_season_year_fkey FOREIGN KEY (season_year) REFERENCES seasons(year);
alter table public.weekly_lineups add constraint weekly_lineups_manager_id_fkey FOREIGN KEY (manager_id) REFERENCES managers(id);
alter table public.weekly_lineups add constraint weekly_lineups_season_year_fkey FOREIGN KEY (season_year) REFERENCES seasons(year);
alter table public.weekly_matchups add constraint weekly_matchups_manager_a_fkey FOREIGN KEY (manager_a) REFERENCES managers(id);
alter table public.weekly_matchups add constraint weekly_matchups_manager_b_fkey FOREIGN KEY (manager_b) REFERENCES managers(id);
alter table public.weekly_matchups add constraint weekly_matchups_season_year_fkey FOREIGN KEY (season_year) REFERENCES seasons(year);

-- ---------------------------------------------------------------------------
-- 3. Indexes not backing a constraint (matview indexes are in section 5)
-- ---------------------------------------------------------------------------

CREATE UNIQUE INDEX achievements_unique_entry ON public.achievements USING btree (season_year, manager_id, achievement_key, notes, matchup_id) NULLS NOT DISTINCT;
CREATE INDEX idx_achievements_category ON public.achievements USING btree (achievement_category);
CREATE INDEX idx_achievements_key ON public.achievements USING btree (achievement_key);
CREATE INDEX idx_achievements_manager ON public.achievements USING btree (manager_id);
CREATE INDEX idx_achievements_matchup_id ON public.achievements USING btree (matchup_id);
CREATE INDEX idx_achievements_season ON public.achievements USING btree (season_year);
CREATE INDEX idx_draft_picks_manager_id ON public.draft_picks USING btree (manager_id);
CREATE INDEX idx_draft_picks_season_year ON public.draft_picks USING btree (season_year);
CREATE INDEX idx_elo_manager ON public.elo_ratings USING btree (manager_id);
CREATE INDEX idx_elo_season ON public.elo_ratings USING btree (season_year);
CREATE INDEX idx_elo_seq ON public.elo_ratings USING btree (game_seq);
CREATE INDEX idx_fa_moves_manager_id ON public.fa_moves USING btree (manager_id);
CREATE INDEX idx_fa_moves_season_week ON public.fa_moves USING btree (season_year, week);
CREATE INDEX idx_fa_moves_season_year ON public.fa_moves USING btree (season_year);
CREATE INDEX idx_fa_pickups_manager_id ON public.fa_pickups USING btree (manager_id);
CREATE INDEX idx_fa_pickups_season_year ON public.fa_pickups USING btree (season_year);
CREATE INDEX fa_transaction_scores_season_year_gain_week_transaction_at_idx ON public.fa_transaction_scores USING btree (season_year, gain_week, transaction_at);
CREATE INDEX fa_transaction_scores_season_year_manager_id_idx ON public.fa_transaction_scores USING btree (season_year, manager_id);
CREATE INDEX fa_transactions_player_id_season_year_idx ON public.fa_transactions USING btree (player_id, season_year);
CREATE INDEX fa_transactions_season_year_team_name_idx ON public.fa_transactions USING btree (season_year, team_name);
CREATE INDEX fa_transactions_season_year_transaction_week_idx ON public.fa_transactions USING btree (season_year, transaction_week);
CREATE INDEX fa_transactions_transaction_id_idx ON public.fa_transactions USING btree (transaction_id);
CREATE INDEX games_cache_matchup_idx ON rebuild.games_cache USING btree (matchup_id, manager_id);
CREATE INDEX games_cache_mgr_idx ON rebuild.games_cache USING btree (manager_id, idx);
CREATE INDEX lineup_cache_mgr_idx ON rebuild.lineup_cache USING btree (manager_id, idx);
CREATE INDEX obs_cache_key_idx ON rebuild.obs_cache USING btree (record_key, manager_id, idx);
CREATE INDEX idx_mock_picks_draft ON public.mock_draft_picks USING btree (mock_draft_id);
CREATE UNIQUE INDEX idx_prospects_nfl_id ON public.mock_draft_prospects USING btree (nfl_id) WHERE (nfl_id IS NOT NULL);
CREATE INDEX idx_prospects_position ON public.mock_draft_prospects USING btree ("position");
CREATE INDEX idx_prospects_rank ON public.mock_draft_prospects USING btree (consensus_rank);
CREATE INDEX idx_player_projections_pos ON public.player_projections USING btree (season_year, week, "position");
CREATE INDEX idx_pws_player_id ON public.player_weekly_stats USING btree (player_id);
CREATE INDEX idx_pws_position ON public.player_weekly_stats USING btree ("position");
CREATE INDEX idx_pws_season_week ON public.player_weekly_stats USING btree (season, week);
CREATE INDEX idx_pws_team_season ON public.player_weekly_stats USING btree (team, season);
CREATE INDEX idx_players_espn_id ON public.players USING btree (espn_id);
CREATE INDEX idx_players_last_name ON public.players USING btree (last_name);
CREATE INDEX idx_players_position ON public.players USING btree ("position");
CREATE INDEX idx_playoff_results_manager_id ON public.playoff_results USING btree (manager_id);
CREATE INDEX idx_record_timeline_key ON public.record_timeline USING btree (record_key);
CREATE INDEX idx_record_timeline_mgr ON public.record_timeline USING btree (manager_id);
CREATE INDEX idx_season_results_manager_id ON public.season_results USING btree (manager_id);
CREATE INDEX idx_lineups_season_week ON public.weekly_lineups USING btree (season_year, week, manager_id);
CREATE INDEX idx_weekly_lineups_manager_id ON public.weekly_lineups USING btree (manager_id);
CREATE INDEX idx_weekly_lineups_season_week_mgr ON public.weekly_lineups USING btree (season_year, week, manager_id);
CREATE INDEX idx_weekly_lineups_starter ON public.weekly_lineups USING btree (season_year, manager_id, is_starter);
CREATE INDEX idx_weekly_matchups_manager_a ON public.weekly_matchups USING btree (manager_a);
CREATE INDEX idx_weekly_matchups_manager_b ON public.weekly_matchups USING btree (manager_b);
CREATE INDEX idx_weekly_matchups_season_week ON public.weekly_matchups USING btree (season_year, week);

-- ---------------------------------------------------------------------------
-- 4. Functions and procedures
--    NOTE: several functions reference tables that do not exist in the live
--    catalog (groups, group_members, pc_lineup_slots, playoff_*, teams,
--    profiles, ...). Their bodies are reproduced as stored; function body
--    checking is switched off so they can be created anyway.
-- ---------------------------------------------------------------------------

set check_function_bodies = off;

CREATE OR REPLACE PROCEDURE public.calculate_elo(IN p_k_base numeric DEFAULT 20, IN p_regression numeric DEFAULT 0.3, IN p_start_elo numeric DEFAULT 1500, IN p_w_matchup numeric DEFAULT 0.65, IN p_w_rank numeric DEFAULT 0.35)
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $procedure$
DECLARE
    v_game           RECORD;
    v_elo_a NUMERIC; v_elo_b NUMERIC;
    v_expected_a NUMERIC; v_expected_b NUMERIC;
    v_matchup_a NUMERIC; v_matchup_b NUMERIC;
    v_rank_a NUMERIC;    v_rank_b NUMERIC;
    v_actual_a NUMERIC;  v_actual_b NUMERIC;
    -- K-Faktoren (additiv kombiniert, dann einmal gedeckelt)
    v_mov_bonus    NUMERIC;  -- 0–8  (Margin-Bonus)
    v_upset_bonus  NUMERIC;  -- 0–6  (Upset-Bonus für Gewinner)
    v_perf_bonus   NUMERIC;  -- -3–3 (Performance-Bonus)
    v_k_a NUMERIC;  v_k_b NUMERIC;
    -- Upset-Tracking
    v_elo_diff     NUMERIC;
    v_is_upset_a   BOOLEAN; v_is_upset_b BOOLEAN;
    -- Saisonschnitte
    v_avg_a NUMERIC; v_avg_b NUMERIC;
    v_new_elo_a NUMERIC; v_new_elo_b NUMERIC;
    v_seq INT := 0;
    v_current_season INT := 0;
    v_n_managers INT;
    v_margin NUMERIC;
BEGIN
    DELETE FROM elo_ratings;
    SELECT COUNT(*) INTO v_n_managers FROM managers;

    DROP TABLE IF EXISTS _elo_current;
    CREATE TEMP TABLE _elo_current (manager_id TEXT PRIMARY KEY, elo NUMERIC);
    INSERT INTO _elo_current SELECT id, p_start_elo FROM managers;

    DROP TABLE IF EXISTS _season_scores;
    CREATE TEMP TABLE _season_scores (
        season_year INT, manager_id TEXT, week INT, score NUMERIC,
        PRIMARY KEY (season_year, manager_id, week)
    );

    FOR v_game IN
        SELECT wm.season_year, wm.week, wm.is_playoff,
               wm.manager_a, wm.score_a, wm.manager_b, wm.score_b,
               -- Wochenrang als ROW_NUMBER über alle Scores der Woche
               (SELECT COUNT(*) FROM (
                   SELECT UNNEST(ARRAY[score_a,score_b]) AS s FROM weekly_matchups
                   WHERE season_year=wm.season_year AND week=wm.week
               ) all_s WHERE all_s.s > wm.score_a) + 1 AS rank_a,
               (SELECT COUNT(*) FROM (
                   SELECT UNNEST(ARRAY[score_a,score_b]) AS s FROM weekly_matchups
                   WHERE season_year=wm.season_year AND week=wm.week
               ) all_s WHERE all_s.s > wm.score_b) + 1 AS rank_b
        FROM weekly_matchups wm
        WHERE wm.score_a IS NOT NULL AND wm.score_b IS NOT NULL
        ORDER BY wm.season_year, wm.week, wm.manager_a
    LOOP
        v_seq := v_seq + 1;

        -- Saisonübergang
        IF v_game.season_year != v_current_season AND v_current_season != 0 THEN
            UPDATE _elo_current
            SET elo = ROUND((elo + (p_start_elo - elo) * p_regression)::numeric, 2);
        END IF;
        v_current_season := v_game.season_year;

        INSERT INTO _season_scores VALUES
            (v_game.season_year, v_game.manager_a, v_game.week, v_game.score_a),
            (v_game.season_year, v_game.manager_b, v_game.week, v_game.score_b)
        ON CONFLICT DO NOTHING;

        SELECT AVG(score) INTO v_avg_a FROM _season_scores
        WHERE season_year=v_game.season_year AND manager_id=v_game.manager_a AND week < v_game.week;
        SELECT AVG(score) INTO v_avg_b FROM _season_scores
        WHERE season_year=v_game.season_year AND manager_id=v_game.manager_b AND week < v_game.week;
        v_avg_a := COALESCE(v_avg_a, v_game.score_a);
        v_avg_b := COALESCE(v_avg_b, v_game.score_b);

        SELECT elo INTO v_elo_a FROM _elo_current WHERE manager_id = v_game.manager_a;
        SELECT elo INTO v_elo_b FROM _elo_current WHERE manager_id = v_game.manager_b;

        -- Expected
        v_expected_a := 1.0 / (1.0 + POWER(10, (v_elo_b - v_elo_a) / 400.0));
        v_expected_b := 1.0 - v_expected_a;

        -- Actual Composite
        v_matchup_a := v_game.score_a / (v_game.score_a + v_game.score_b);
        v_matchup_b := 1.0 - v_matchup_a;
        v_rank_a := (v_n_managers - v_game.rank_a)::NUMERIC / (v_n_managers - 1);
        v_rank_b := (v_n_managers - v_game.rank_b)::NUMERIC / (v_n_managers - 1);
        v_actual_a := p_w_matchup * v_matchup_a + p_w_rank * v_rank_a;
        v_actual_b := p_w_matchup * v_matchup_b + p_w_rank * v_rank_b;

        -- ── K-BONI (additiv) ─────────────────────────────────
        v_margin := ABS(v_game.score_a - v_game.score_b);

        -- MoV-Bonus: 0–8 Punkte (Median ~3.0 bei Ø-Margin 24)
        v_mov_bonus := LEAST(v_margin / 10.0, 8.0);

        -- ELO-Differenz aus Sicht von A
        v_elo_diff := v_elo_b - v_elo_a;

        -- Upset-Bonus: nur für den Gewinner wenn Underdog
        -- +1 pro 20 ELO Nachteil, max +6
        v_is_upset_a := (v_game.score_a > v_game.score_b AND v_elo_diff > 20);
        v_is_upset_b := (v_game.score_b > v_game.score_a AND v_elo_diff < -20);

        v_upset_bonus := CASE
            WHEN v_is_upset_a THEN LEAST(v_elo_diff / 20.0, 6.0)
            WHEN v_is_upset_b THEN LEAST(ABS(v_elo_diff) / 20.0, 6.0)
            ELSE 0
        END;

        -- Performance-Bonus: -3 bis +3
        v_perf_bonus := LEAST(GREATEST(
            (v_game.score_a / NULLIF(v_avg_a,0) - 1.0) * 15.0, -3.0), 3.0);

        -- K final: Basis + additive Boni
        -- A bekommt Upset-Bonus nur wenn Gewinner
        v_k_a := p_k_base
            + v_mov_bonus
            + CASE WHEN v_is_upset_a THEN v_upset_bonus ELSE 0 END
            + LEAST(GREATEST((v_game.score_a / NULLIF(v_avg_a,0) - 1.0) * 15.0, -3.0), 3.0);

        v_k_b := p_k_base
            + v_mov_bonus
            + CASE WHEN v_is_upset_b THEN v_upset_bonus ELSE 0 END
            + LEAST(GREATEST((v_game.score_b / NULLIF(v_avg_b,0) - 1.0) * 15.0, -3.0), 3.0);

        -- K auf sinnvollen Bereich begrenzen (min 10, max 42)
        v_k_a := GREATEST(LEAST(v_k_a, 42.0), 10.0);
        v_k_b := GREATEST(LEAST(v_k_b, 42.0), 10.0);

        -- Neue ELOs
        v_new_elo_a := ROUND((v_elo_a + v_k_a * (v_actual_a - v_expected_a))::numeric, 2);
        v_new_elo_b := ROUND((v_elo_b + v_k_b * (v_actual_b - v_expected_b))::numeric, 2);

        -- Inserts
        INSERT INTO elo_ratings (
            season_year, week, is_playoff, manager_id, opponent_id,
            elo_before, elo_after, elo_change, score, opp_score, won,
            expected_score, actual_score,
            weekly_rank, rank_component,
            mov_multiplier, upset_multiplier, perf_multiplier, k_used,
            is_upset, game_seq)
        VALUES (
            v_game.season_year, v_game.week, v_game.is_playoff,
            v_game.manager_a, v_game.manager_b,
            v_elo_a, v_new_elo_a, ROUND((v_new_elo_a-v_elo_a)::numeric,2),
            v_game.score_a, v_game.score_b, v_game.score_a > v_game.score_b,
            ROUND(v_expected_a::numeric,4), ROUND(v_actual_a::numeric,4),
            v_game.rank_a, ROUND(v_rank_a::numeric,4),
            ROUND(v_mov_bonus::numeric,2),
            CASE WHEN v_is_upset_a THEN ROUND(v_upset_bonus::numeric,2) ELSE 0 END,
            ROUND(LEAST(GREATEST((v_game.score_a/NULLIF(v_avg_a,0)-1.0)*15.0,-3.0),3.0)::numeric,2),
            ROUND(v_k_a::numeric,2), v_is_upset_a, v_seq)
        ON CONFLICT (season_year, week, manager_id) DO UPDATE SET
            elo_before=EXCLUDED.elo_before, elo_after=EXCLUDED.elo_after, elo_change=EXCLUDED.elo_change,
            expected_score=EXCLUDED.expected_score, actual_score=EXCLUDED.actual_score,
            weekly_rank=EXCLUDED.weekly_rank, rank_component=EXCLUDED.rank_component,
            mov_multiplier=EXCLUDED.mov_multiplier, upset_multiplier=EXCLUDED.upset_multiplier,
            perf_multiplier=EXCLUDED.perf_multiplier, k_used=EXCLUDED.k_used,
            is_upset=EXCLUDED.is_upset, game_seq=EXCLUDED.game_seq;

        v_seq := v_seq + 1;

        INSERT INTO elo_ratings (
            season_year, week, is_playoff, manager_id, opponent_id,
            elo_before, elo_after, elo_change, score, opp_score, won,
            expected_score, actual_score,
            weekly_rank, rank_component,
            mov_multiplier, upset_multiplier, perf_multiplier, k_used,
            is_upset, game_seq)
        VALUES (
            v_game.season_year, v_game.week, v_game.is_playoff,
            v_game.manager_b, v_game.manager_a,
            v_elo_b, v_new_elo_b, ROUND((v_new_elo_b-v_elo_b)::numeric,2),
            v_game.score_b, v_game.score_a, v_game.score_b > v_game.score_a,
            ROUND(v_expected_b::numeric,4), ROUND(v_actual_b::numeric,4),
            v_game.rank_b, ROUND(v_rank_b::numeric,4),
            ROUND(v_mov_bonus::numeric,2),
            CASE WHEN v_is_upset_b THEN ROUND(v_upset_bonus::numeric,2) ELSE 0 END,
            ROUND(LEAST(GREATEST((v_game.score_b/NULLIF(v_avg_b,0)-1.0)*15.0,-3.0),3.0)::numeric,2),
            ROUND(v_k_b::numeric,2), v_is_upset_b, v_seq)
        ON CONFLICT (season_year, week, manager_id) DO UPDATE SET
            elo_before=EXCLUDED.elo_before, elo_after=EXCLUDED.elo_after, elo_change=EXCLUDED.elo_change,
            expected_score=EXCLUDED.expected_score, actual_score=EXCLUDED.actual_score,
            weekly_rank=EXCLUDED.weekly_rank, rank_component=EXCLUDED.rank_component,
            mov_multiplier=EXCLUDED.mov_multiplier, upset_multiplier=EXCLUDED.upset_multiplier,
            perf_multiplier=EXCLUDED.perf_multiplier, k_used=EXCLUDED.k_used,
            is_upset=EXCLUDED.is_upset, game_seq=EXCLUDED.game_seq;

        UPDATE _elo_current SET elo = v_new_elo_a WHERE manager_id = v_game.manager_a;
        UPDATE _elo_current SET elo = v_new_elo_b WHERE manager_id = v_game.manager_b;
    END LOOP;

    DROP TABLE IF EXISTS _elo_current;
    DROP TABLE IF EXISTS _season_scores;
END;
$procedure$
;

CREATE OR REPLACE FUNCTION public.create_group(p_name text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  gid uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  insert into public.groups (name, owner_id)
  values (p_name, auth.uid())
  returning id into gid;

  insert into public.group_members (group_id, user_id, role)
  values (gid, auth.uid(), 'owner')
  on conflict do nothing;

  return gid;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.ensure_pc_lineup_slots(p_entry_id uuid, p_season integer, p_round integer)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  insert into public.pc_lineup_slots (entry_id, season, round, slot, player_id, team_id, updated_at)
  values
    (p_entry_id, p_season, p_round, 'QB1',  null, null, now()),
    (p_entry_id, p_season, p_round, 'RB1',  null, null, now()),
    (p_entry_id, p_season, p_round, 'RB2',  null, null, now()),
    (p_entry_id, p_season, p_round, 'WR1',  null, null, now()),
    (p_entry_id, p_season, p_round, 'WR2',  null, null, now()),
    (p_entry_id, p_season, p_round, 'TE1',  null, null, now()),
    (p_entry_id, p_season, p_round, 'K1',   null, null, now()),
    (p_entry_id, p_season, p_round, 'DST1', null, null, now())
  on conflict (entry_id, season, round, slot) do nothing;
$function$
;

CREATE OR REPLACE FUNCTION public.generate_invite_code()
 RETURNS text
 LANGUAGE sql
 SET search_path TO 'public'
AS $function$
  select upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
$function$
;

CREATE OR REPLACE FUNCTION public.get_my_bracket_state(p_season integer)
 RETURNS jsonb
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with seed_rows as (
    select s.season, s.conference, s.seed, s.team_id,
      jsonb_build_object('id', t.id, 'name', t.name, 'abbr', t.abbr) as team
    from public.playoff_seeds s
    join public.teams t on t.id = s.team_id
    where s.season = p_season
    order by s.conference, s.seed
  ),
  game_rows as (
    select g.*
    from public.playoff_games g
    where g.season = p_season
    order by g.round, g.conference, g.start_time
  ),
  pick_rows as (
    select p.game_id, p.picked_winner_team_id, p.locked_at
    from public.playoff_user_picks p
    where p.user_id = auth.uid() and p.season = p_season
  )
  select jsonb_build_object(
    'season', p_season,
    'seeds', coalesce((select jsonb_agg(to_jsonb(seed_rows)) from seed_rows), '[]'::jsonb),
    'games', coalesce((select jsonb_agg(to_jsonb(game_rows)) from game_rows), '[]'::jsonb),
    'picks', coalesce((select jsonb_agg(to_jsonb(pick_rows)) from pick_rows), '[]'::jsonb)
  );
$function$
;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  insert into public.profiles (user_id)
  values (new.id);
  return new;
end;
$function$
;

CREATE OR REPLACE PROCEDURE public.insert_matchup_record(IN p_key text, IN p_label text, IN p_col text, IN p_dir text)
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $procedure$
DECLARE v_sql TEXT;
BEGIN
    v_sql := format($sql$
        WITH mv AS (SELECT season_year,week,manager_id,is_playoff,%I AS val FROM v_matchup_records WHERE %I IS NOT NULL),
        rh AS (
            SELECT DISTINCT ON(m.season_year,m.week) m.season_year,m.week,
                   mv.manager_id AS leader, mv.val
            FROM (SELECT DISTINCT season_year,week FROM weekly_matchups ORDER BY season_year,week) m
            JOIN mv ON mv.season_year<=m.season_year OR (mv.season_year=m.season_year AND mv.week<=m.week)
            ORDER BY m.season_year,m.week, mv.val %s NULLS LAST, mv.manager_id
        ),
        ch AS (SELECT *,LAG(leader) OVER (ORDER BY season_year,week) AS prev FROM rh),
        gr AS (SELECT *,SUM(CASE WHEN leader!=prev OR prev IS NULL THEN 1 ELSE 0 END) OVER (ORDER BY season_year,week) AS pid FROM ch),
        pr AS (SELECT pid,leader,MIN(season_year) fy,MIN(week) fw,MAX(season_year) ty,MAX(week) tw,COUNT(*) wks,
               CASE WHEN %L='ASC' THEN MIN(val) ELSE MAX(val) END rv FROM gr GROUP BY pid,leader),
        rk AS (SELECT *,ROW_NUMBER() OVER (ORDER BY pid) rn,COUNT(*) OVER() tot FROM pr)
        INSERT INTO record_timeline (record_key,record_label,period_id,manager_id,from_year,from_week,to_year,to_week,weeks_held,record_value,is_current)
        SELECT %L,%L,rn,leader,fy,fw,ty,tw,wks,rv,(rn=tot) FROM rk
        ON CONFLICT (record_key,period_id) DO UPDATE SET manager_id=EXCLUDED.manager_id,from_year=EXCLUDED.from_year,
        from_week=EXCLUDED.from_week,to_year=EXCLUDED.to_year,to_week=EXCLUDED.to_week,
        weeks_held=EXCLUDED.weeks_held,record_value=EXCLUDED.record_value,is_current=EXCLUDED.is_current
    $sql$, p_col, p_col, p_dir, p_dir, p_key, p_label);
    EXECUTE v_sql;
END;
$procedure$
;

CREATE OR REPLACE PROCEDURE public.insert_season_best_timeline(IN p_key text, IN p_label text, IN p_metric text, IN p_direction text DEFAULT 'DESC'::text)
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $procedure$
DECLARE v_sql TEXT;
BEGIN
    v_sql := format($sql$
        WITH season_vals AS (
            SELECT season_year, manager_id, %I AS val
            FROM v_season_records WHERE %I IS NOT NULL
        ),
        running_best AS (
            SELECT s.season_year, sv.manager_id, sv.val,
                   %s(sv.val) OVER (ORDER BY s.season_year) AS best_so_far
            FROM (SELECT DISTINCT season_year FROM season_results ORDER BY season_year) s
            JOIN season_vals sv ON sv.season_year <= s.season_year
            -- Nur der Manager mit dem besten Wert in einer beliebigen vergangenen Saison
        ),
        record_holder AS (
            SELECT DISTINCT ON (season_year) season_year, manager_id AS leader, val AS record_value
            FROM (
                SELECT sv.season_year AS ref_year, sv.manager_id, sv.val,
                       %s(sv.val) OVER (ORDER BY sv.season_year ROWS UNBOUNDED PRECEDING) AS running_best
                FROM season_vals sv
            ) x
            JOIN season_vals sv2 ON sv2.val = x.running_best
            ORDER BY ref_year %s, sv2.manager_id
        ),
        changes AS (SELECT *, LAG(leader) OVER (ORDER BY season_year) AS prev FROM record_holder),
        groups AS (SELECT *, SUM(CASE WHEN leader!=prev OR prev IS NULL THEN 1 ELSE 0 END) OVER (ORDER BY season_year) AS pid FROM changes),
        periods AS (SELECT pid,leader,MIN(season_year) fy,MAX(season_year) ty,COUNT(*) seas,MAX(record_value) rv FROM groups GROUP BY pid,leader),
        ranked AS (SELECT *,ROW_NUMBER() OVER (ORDER BY pid) rn,COUNT(*) OVER() tot FROM periods)
        INSERT INTO record_timeline (record_key,record_label,period_id,manager_id,from_year,from_week,to_year,to_week,weeks_held,record_value,is_current)
        SELECT %L,%L,rn,leader,fy,1,ty,16,seas*16,rv,(rn=tot) FROM ranked
        ON CONFLICT (record_key,period_id) DO UPDATE SET manager_id=EXCLUDED.manager_id,from_year=EXCLUDED.from_year,to_year=EXCLUDED.to_year,weeks_held=EXCLUDED.weeks_held,record_value=EXCLUDED.record_value,is_current=EXCLUDED.is_current
    $sql$,
    p_metric, p_metric,
    CASE WHEN p_direction='DESC' THEN 'MAX' ELSE 'MIN' END,
    CASE WHEN p_direction='DESC' THEN 'MAX' ELSE 'MIN' END,
    p_direction,
    p_key, p_label);
    EXECUTE v_sql;
END;
$procedure$
;

CREATE OR REPLACE PROCEDURE public.insert_season_record(IN p_key text, IN p_label text, IN p_col text, IN p_dir text)
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $procedure$
DECLARE v_sql TEXT;
BEGIN
    v_sql := format($sql$
        WITH sv AS (SELECT season_year,manager_id,%I AS val FROM v_season_records WHERE %I IS NOT NULL),
        rh AS (
            SELECT DISTINCT ON(s.season_year) s.season_year, sv.manager_id AS leader, sv.val
            FROM (SELECT DISTINCT season_year FROM season_results ORDER BY season_year) s
            JOIN sv ON sv.season_year <= s.season_year
            ORDER BY s.season_year, sv.val %s NULLS LAST, sv.manager_id
        ),
        ch AS (SELECT *,LAG(leader) OVER (ORDER BY season_year) AS prev FROM rh),
        gr AS (SELECT *,SUM(CASE WHEN leader!=prev OR prev IS NULL THEN 1 ELSE 0 END) OVER (ORDER BY season_year) AS pid FROM ch),
        pr AS (SELECT pid,leader,MIN(season_year) fy,MAX(season_year) ty,COUNT(*) seas,
               CASE WHEN %L='ASC' THEN MIN(val) ELSE MAX(val) END rv FROM gr GROUP BY pid,leader),
        rk AS (SELECT *,ROW_NUMBER() OVER (ORDER BY pid) rn,COUNT(*) OVER() tot FROM pr)
        INSERT INTO record_timeline (record_key,record_label,period_id,manager_id,from_year,from_week,to_year,to_week,weeks_held,record_value,is_current)
        SELECT %L,%L,rn,leader,fy,1,ty,16,seas*16,rv,(rn=tot) FROM rk
        ON CONFLICT (record_key,period_id) DO UPDATE SET manager_id=EXCLUDED.manager_id,from_year=EXCLUDED.from_year,
        to_year=EXCLUDED.to_year,weeks_held=EXCLUDED.weeks_held,record_value=EXCLUDED.record_value,is_current=EXCLUDED.is_current
    $sql$, p_col, p_col, p_dir, p_dir, p_key, p_label);
    EXECUTE v_sql;
END;
$procedure$
;

CREATE OR REPLACE PROCEDURE public.insert_season_timeline(IN p_record_key text, IN p_record_label text, IN p_metric text)
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $procedure$
DECLARE v_sql TEXT;
BEGIN
    v_sql := format($sql$
        WITH season_leader AS (
            SELECT DISTINCT ON (season_year) season_year,
                   manager_id AS leader,
                   ROUND(%I::numeric, 2) AS val
            FROM v_league_records
            CROSS JOIN (
                SELECT DISTINCT season_year FROM season_results ORDER BY season_year
            ) sy
            -- Wir berechnen den kumulativen Wert bis zu jeder Saison
            ORDER BY season_year, %I DESC NULLS LAST
        ),
        changes AS (
            SELECT *, LAG(leader) OVER (ORDER BY season_year) AS prev_leader
            FROM season_leader
        ),
        groups AS (
            SELECT *,
                   SUM(CASE WHEN leader != prev_leader OR prev_leader IS NULL THEN 1 ELSE 0 END)
                       OVER (ORDER BY season_year) AS period_id
            FROM changes
        ),
        periods AS (
            SELECT period_id, leader,
                   MIN(season_year) AS fy, MAX(season_year) AS ty,
                   COUNT(*) AS seas, MAX(val) AS rec_val
            FROM groups GROUP BY period_id, leader
        ),
        ranked AS (SELECT *, ROW_NUMBER() OVER (ORDER BY period_id) AS rn,
                             COUNT(*) OVER () AS total FROM periods)
        INSERT INTO record_timeline
            (record_key, record_label, period_id, manager_id,
             from_year, from_week, to_year, to_week, weeks_held, record_value, is_current)
        SELECT %L, %L, rn, leader, fy, 1, ty, 16, seas * 16, rec_val, (rn = total)
        FROM ranked
        ON CONFLICT (record_key, period_id) DO UPDATE SET
            manager_id = EXCLUDED.manager_id,
            from_year = EXCLUDED.from_year, to_year = EXCLUDED.to_year,
            weeks_held = EXCLUDED.weeks_held, record_value = EXCLUDED.record_value,
            is_current = EXCLUDED.is_current
    $sql$, p_metric, p_metric, p_record_key, p_record_label);
    EXECUTE v_sql;
END;
$procedure$
;

CREATE OR REPLACE PROCEDURE public.insert_timeline(IN p_record_key text, IN p_record_label text, IN p_metric text)
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $procedure$
DECLARE
    v_sql TEXT;
BEGIN
    v_sql := format($sql$
        WITH weekly_leader AS (
            SELECT DISTINCT ON (season_year, week)
                season_year, week, manager_id AS leader,
                ROUND(%I::numeric, 2) AS val
            FROM v_weekly_cumulative
            WHERE %I IS NOT NULL
            ORDER BY season_year, week, %I DESC NULLS LAST
        ),
        changes AS (
            SELECT *, LAG(leader) OVER (ORDER BY season_year, week) AS prev_leader
            FROM weekly_leader
        ),
        groups AS (
            SELECT *,
                   SUM(CASE WHEN leader != prev_leader OR prev_leader IS NULL THEN 1 ELSE 0 END)
                       OVER (ORDER BY season_year, week) AS period_id
            FROM changes
        ),
        periods AS (
            SELECT period_id, leader,
                   MIN(season_year) AS fy, MIN(week) AS fw,
                   MAX(season_year) AS ty, MAX(week) AS tw,
                   COUNT(*) AS wks, MAX(val) AS rec_val
            FROM groups GROUP BY period_id, leader
        ),
        ranked AS (
            SELECT *, ROW_NUMBER() OVER (ORDER BY period_id) AS rn,
                      COUNT(*) OVER () AS total
            FROM periods
        )
        INSERT INTO record_timeline
            (record_key, record_label, period_id, manager_id,
             from_year, from_week, to_year, to_week, weeks_held, record_value, is_current)
        SELECT %L, %L, rn, leader, fy, fw, ty, tw, wks, rec_val, (rn = total)
        FROM ranked
        ON CONFLICT (record_key, period_id) DO UPDATE SET
            manager_id = EXCLUDED.manager_id,
            from_year = EXCLUDED.from_year, from_week = EXCLUDED.from_week,
            to_year = EXCLUDED.to_year, to_week = EXCLUDED.to_week,
            weeks_held = EXCLUDED.weeks_held,
            record_value = EXCLUDED.record_value,
            is_current = EXCLUDED.is_current
    $sql$, p_metric, p_metric, p_metric, p_record_key, p_record_label);

    EXECUTE v_sql;
END;
$procedure$
;

CREATE OR REPLACE FUNCTION public.is_group_admin(gid uuid, uid uuid)
 RETURNS boolean
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1
    from public.group_members gm
    where gm.group_id = gid
      and gm.user_id  = uid
      and gm.role in ('owner','admin')
  );
$function$
;

CREATE OR REPLACE FUNCTION public.is_group_member(gid uuid, uid uuid)
 RETURNS boolean
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1
    from public.group_members gm
    where gm.group_id = gid
      and gm.user_id  = uid
  );
$function$
;

CREATE OR REPLACE FUNCTION public.join_group(p_invite_code text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  gid uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select g.id into gid
  from public.groups g
  where g.invite_code = upper(p_invite_code);

  if gid is null then
    raise exception 'Invalid invite code';
  end if;

  insert into public.group_members (group_id, user_id, role)
  values (gid, auth.uid(), 'member')
  on conflict do nothing;

  return gid;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.normalize_team_abbr()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  if exists (
    select 1 from public.team_abbr_map
    where source_abbr = new.team
  ) then
    select canonical_abbr into new.team
    from public.team_abbr_map
    where source_abbr = new.team;
  end if;
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.pc_slot_player_team_check()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  -- Allow empty slots (both null) while building lineup
  if new.player_id is null and new.team_id is null then
    return new;
  end if;

  if (new.slot = 'DST1') then
    -- DST uses team_id only
    if new.team_id is null then
      raise exception 'DST1 requires team_id';
    end if;
    new.player_id := null;
  else
    -- Non-DST uses player_id only
    if new.player_id is null then
      raise exception '% requires player_id', new.slot;
    end if;
    new.team_id := null;
  end if;

  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.pc_team_points_value(p_season integer, p_week integer, p_team text)
 RETURNS numeric
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public'
AS $function$
declare
  v_col text;
  v_val numeric;
begin
  -- bevorzugte Spaltenreihenfolge
  if exists (
    select 1
    from information_schema.columns
    where table_schema='public'
      and table_name='pc_team_weekly_stats'
      and column_name='fantasy_points_dst'
  ) then
    v_col := 'fantasy_points_dst';

  elsif exists (
    select 1
    from information_schema.columns
    where table_schema='public'
      and table_name='pc_team_weekly_stats'
      and column_name='fantasy_points'
  ) then
    v_col := 'fantasy_points';

  elsif exists (
    select 1
    from information_schema.columns
    where table_schema='public'
      and table_name='pc_team_weekly_stats'
      and column_name='fantasy_points_ppr'
  ) then
    v_col := 'fantasy_points_ppr';

  else
    raise exception
      'pc_team_weekly_stats hat keine passende Punkte-Spalte (erwartet fantasy_points_dst oder fantasy_points oder fantasy_points_ppr).';
  end if;

  execute format(
    'select %I::numeric from public.pc_team_weekly_stats
     where season=$1 and week=$2 and team=$3
     limit 1',
    v_col
  )
  into v_val
  using p_season, p_week, p_team;

  return coalesce(v_val, 0);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.pickem_set_user_id()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  if new.user_id is null then
    new.user_id := auth.uid();
  end if;
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.pickem_standings(p_season_year integer)
 RETURNS TABLE(user_id uuid, username text, total_points integer, weekly jsonb)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with season as (
    select id as season_id
    from public.seasons
    where year = p_season_year
    limit 1
  ),
  per_week as (
    select
      p.user_id,
      pr.username,
      w.week_number,
      count(*) filter (where g.winner_team_id is not null and p.picked_team_id = g.winner_team_id) as points
    from public.pickem_picks_v2 p
    join public.games g on g.id = p.game_id
    join public.weeks w on w.id = g.week_id
    join public.seasons s2 on s2.id = w.season_id
    join public.profiles pr on pr.user_id = p.user_id
    where s2.year = p_season_year
    group by p.user_id, pr.username, w.week_number
  ),
  totals as (
    select
      user_id,
      username,
      coalesce(sum(points), 0)::int as total_points,
      jsonb_object_agg(week_number::text, points order by week_number) as weekly
    from per_week
    group by user_id, username
  )
  select user_id, username, total_points, coalesce(weekly, '{}'::jsonb) as weekly
  from totals
  order by total_points desc, username asc;
$function$
;

CREATE OR REPLACE FUNCTION public.pickem_week_leaderboard(p_group_id uuid, p_season_year integer, p_week_number integer)
 RETURNS TABLE(user_id uuid, correct_picks integer, total_picks integer)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select
    pp.user_id,
    sum(case when pp.picked_team_id = g.winner_team_id and g.winner_team_id is not null then 1 else 0 end)::int as correct_picks,
    count(*)::int as total_picks
  from public.pickem_picks pp
  join public.games g on g.id = pp.game_id
  join public.seasons s on s.id = g.season_id
  join public.weeks w on w.id = g.week_id
  where pp.group_id = p_group_id
    and s.year = p_season_year
    and w.week_number = p_week_number
  group by pp.user_id
  order by correct_picks desc, total_picks desc;
$function$
;

CREATE OR REPLACE FUNCTION public.player_name_key(name text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
  select 'N:' || lower(regexp_replace(regexp_replace(coalesce(name, ''), '\m(jr|sr|ii|iii|iv|v)\M', '', 'gi'), '[^A-Za-z]', '', 'g'))
$function$
;

CREATE OR REPLACE FUNCTION public.playoff_set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.rebuild_playoff_bracket_games(p_season integer, p_user_id uuid DEFAULT auth.uid())
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_conf text;
  v_seed1_team_id uuid;
  v_top uuid;
  v_low uuid;
  v_mid1 uuid;
  v_mid2 uuid;
  v_div1_game_id uuid;
  v_div2_game_id uuid;
  v_conf_game_id uuid;
  v_sb_game_id uuid;
  v_div1_winner uuid;
  v_div2_winner uuid;
  v_afc_conf_winner uuid;
  v_nfc_conf_winner uuid;
begin
  if p_user_id is null then
    raise exception 'Not authenticated';
  end if;

  for v_conf in select unnest(array['AFC','NFC']) loop
    -- Seed #1 bye team
    select team_id
      into v_seed1_team_id
    from public.playoff_seeds
    where season = p_season and conference = v_conf and seed = 1;

    -- Find DIV games (slots must exist for the season)
    select id into v_div1_game_id
    from public.playoff_games
    where season = p_season and round = 'DIV' and conference = v_conf
    order by start_time asc
    limit 1;

    select id into v_div2_game_id
    from public.playoff_games
    where season = p_season and round = 'DIV' and conference = v_conf
    order by start_time asc
    offset 1
    limit 1;

    -- Compute remaining teams after WC from user's picks (fallback to final winner)
    with wc_games as (
      select g.id
      from public.playoff_games g
      where g.season = p_season and g.round = 'WC' and g.conference = v_conf
    ), wc_winners as (
      select coalesce(p.picked_winner_team_id, g.winner_team_id) as team_id
      from wc_games w
      join public.playoff_games g on g.id = w.id
      left join public.playoff_user_picks p
        on p.game_id = g.id and p.season = p_season and p.user_id = p_user_id
    ), remaining as (
      select distinct ps.team_id, ps.seed
      from public.playoff_seeds ps
      where ps.season = p_season and ps.conference = v_conf and ps.team_id = v_seed1_team_id
      union
      select distinct ps.team_id, ps.seed
      from wc_winners ww
      join public.playoff_seeds ps
        on ps.team_id = ww.team_id and ps.season = p_season and ps.conference = v_conf
      where ww.team_id is not null
    ), ordered as (
      select array_agg(team_id order by seed asc) as team_ids
      from remaining
    )
    select
      team_ids[1],
      team_ids[array_length(team_ids, 1)],
      team_ids[2],
      team_ids[3]
    into v_top, v_low, v_mid1, v_mid2
    from ordered;

    if v_div1_game_id is not null then
      update public.playoff_games
      set home_team_id = v_top,
          away_team_id = v_low,
          updated_at = now()
      where id = v_div1_game_id;
    end if;

    if v_div2_game_id is not null then
      update public.playoff_games
      set home_team_id = v_mid1,
          away_team_id = v_mid2,
          updated_at = now()
      where id = v_div2_game_id;
    end if;

    -- Conference championship participants from DIV winners
    select id into v_conf_game_id
    from public.playoff_games
    where season = p_season and round = 'CONF' and conference = v_conf
    order by start_time asc
    limit 1;

    if v_div1_game_id is not null then
      select coalesce(p.picked_winner_team_id, g.winner_team_id)
        into v_div1_winner
      from public.playoff_games g
      left join public.playoff_user_picks p
        on p.game_id = g.id and p.season = p_season and p.user_id = p_user_id
      where g.id = v_div1_game_id;
    else
      v_div1_winner := null;
    end if;

    if v_div2_game_id is not null then
      select coalesce(p.picked_winner_team_id, g.winner_team_id)
        into v_div2_winner
      from public.playoff_games g
      left join public.playoff_user_picks p
        on p.game_id = g.id and p.season = p_season and p.user_id = p_user_id
      where g.id = v_div2_game_id;
    else
      v_div2_winner := null;
    end if;

    if v_conf_game_id is not null then
      update public.playoff_games
      set home_team_id = v_div1_winner,
          away_team_id = v_div2_winner,
          updated_at = now()
      where id = v_conf_game_id;
    end if;
  end loop;

  -- Super Bowl participants from conference winners
  select coalesce(p.picked_winner_team_id, g.winner_team_id)
    into v_afc_conf_winner
  from public.playoff_games g
  left join public.playoff_user_picks p
    on p.game_id = g.id and p.season = p_season and p.user_id = p_user_id
  where g.season = p_season and g.round = 'CONF' and g.conference = 'AFC'
  order by g.start_time asc
  limit 1;

  select coalesce(p.picked_winner_team_id, g.winner_team_id)
    into v_nfc_conf_winner
  from public.playoff_games g
  left join public.playoff_user_picks p
    on p.game_id = g.id and p.season = p_season and p.user_id = p_user_id
  where g.season = p_season and g.round = 'CONF' and g.conference = 'NFC'
  order by g.start_time asc
  limit 1;

  select id into v_sb_game_id
  from public.playoff_games
  where season = p_season and round = 'SB'
  order by start_time asc
  limit 1;

  if v_sb_game_id is not null then
    update public.playoff_games
    set home_team_id = v_afc_conf_winner,
        away_team_id = v_nfc_conf_winner,
        updated_at = now()
    where id = v_sb_game_id;
  end if;

  return true;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.refresh_league_derived()
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'rebuild'
AS $function$
declare
  rec_rows int; ach_rows int;
begin
  perform rebuild.compute_records();

  delete from public.record_timeline where record_key in (select record_key from rebuild.record_defs);
  insert into public.record_timeline
    (record_key, record_label, period_id, manager_id, from_year, from_week, to_year, to_week, weeks_held, record_value, is_current)
  select record_key, record_label, period_id, manager_id, from_year, from_week, to_year, to_week, weeks_held, record_value, is_current
  from rebuild.record_timeline_new;
  get diagnostics rec_rows = row_count;

  delete from public.record_owner_values where record_key in (select record_key from rebuild.record_defs);
  insert into public.record_owner_values (record_key, manager_id, current_value)
  select record_key, manager_id, current_value from rebuild.record_owner_values_new;

  create temp table _meta on commit drop as
    select distinct on (achievement_key) achievement_key, achievement_category, description
    from public.achievements order by achievement_key, id;
  create temp table _calc on commit drop as select * from rebuild.achievements_calc;

  delete from public.achievements a
  where not coalesce(a.is_manual, false)
    and a.achievement_key in (select distinct achievement_key from _calc);
  insert into public.achievements
    (season_year, manager_id, achievement_key, achievement_category, value, notes, is_manual, description, matchup_id)
  select c.season_year, c.manager_id, c.achievement_key, m.achievement_category, c.value, c.notes, false, m.description, c.matchup_id
  from _calc c join _meta m using (achievement_key);
  get diagnostics ach_rows = row_count;

  return json_build_object('record_timeline_rows', rec_rows, 'achievement_rows', ach_rows);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.refresh_player_stats()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  refresh materialized view public.mv_player_games;
  refresh materialized view public.mv_player_events;
  refresh materialized view public.mv_player_manager_stats;
  refresh materialized view public.mv_player_summary;
  refresh materialized view public.mv_player_manager_teams;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.refresh_transaction_scores()
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  update public.fa_transaction_scores s
  set transaction_score = r.ts, transaction_score_alltime = r.ta
  from (
    select ctid as c,
      round((100 * percent_rank() over (partition by season_year order by net_pts_adj))::numeric, 1) as ts,
      round((100 * percent_rank() over (order by net_pts_adj))::numeric, 1) as ta
    from public.fa_transaction_scores
  ) r
  where s.ctid = r.c
    and (s.transaction_score is distinct from r.ts or s.transaction_score_alltime is distinct from r.ta);
$function$
;

CREATE OR REPLACE FUNCTION public.set_pc_lineup_slot(p_entry_id uuid, p_season integer, p_round integer, p_slot text, p_player_id text, p_team_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_lock_at timestamptz;
begin
  /*
    Lock-Zeitpunkt bestimmen:
    - du hast schon eine View v_pc_round_completed (season, round, week_number, is_completed)
    - und du hast games.start_time + week_id/season_id
    Idee:
    -> lock_at = MIN(start_time) der Games in dieser Round/Week
    Sobald das erste Spiel gestartet ist: locked.
  */

  select min(g.start_time) into v_lock_at
  from public.v_pc_round_completed rc
  join public.seasons s on s.year = rc.season
  join public.weeks w on w.season_id = s.id and w.week_number = rc.week_number
  join public.games g on g.week_id = w.id
  where rc.season = p_season
    and rc.round  = p_round;

  if v_lock_at is not null and now() >= v_lock_at then
    raise exception 'Lineup ist gelockt (Round % / Season %).', p_round, p_season
      using errcode = 'P0001';
  end if;

  -- UPSERT (wie vorher)
  insert into public.pc_lineup_slots (entry_id, season, round, slot, player_id, team_id, updated_at)
  values (p_entry_id, p_season, p_round, p_slot, p_player_id, p_team_id, now())
  on conflict (entry_id, season, round, slot)
  do update set
    player_id  = excluded.player_id,
    team_id    = excluded.team_id,
    updated_at = now();
end;
$function$
;

CREATE OR REPLACE FUNCTION public.set_playoff_bracket_pick(p_season integer, p_game_id uuid, p_picked_winner_team_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_user_id uuid := auth.uid();
  v_game public.playoff_games%rowtype;
  v_first_wc_start timestamptz;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_game
  from public.playoff_games
  where id = p_game_id and season = p_season
  for update;

  if not found then
    raise exception 'Playoff game not found for this season';
  end if;

  select min(start_time)
    into v_first_wc_start
  from public.playoff_games
  where season = p_season and round = 'WC';

  if v_first_wc_start is not null and now() >= v_first_wc_start then
    raise exception 'Bracket is locked (wild-card started)';
  end if;

  if v_game.start_time <= now() then
    raise exception 'Game is locked (kickoff passed)';
  end if;

  -- Rebuild derived rounds first so DIV/CONF/SB matchups are synced with latest upstream picks
  perform public.rebuild_playoff_bracket_games(p_season, v_user_id);

  select * into v_game
  from public.playoff_games
  where id = p_game_id and season = p_season
  for update;

  if p_picked_winner_team_id is distinct from v_game.home_team_id
     and p_picked_winner_team_id is distinct from v_game.away_team_id then
    raise exception 'Picked team is not part of this matchup';
  end if;

  insert into public.playoff_user_picks (user_id, season, game_id, picked_winner_team_id, locked_at)
  values (v_user_id, p_season, p_game_id, p_picked_winner_team_id, null)
  on conflict (user_id, season, game_id)
  do update
    set picked_winner_team_id = excluded.picked_winner_team_id,
        updated_at = now();

  perform public.rebuild_playoff_bracket_games(p_season, v_user_id);

  return true;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.tr_choose_slot(p_run_id uuid, p_slot text, p_bench_position text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_phase        text;
  v_status       text;
  v_current_team uuid;
  v_valid_slots  text[];
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Nicht authentifiziert.'; END IF;

  SELECT gr.status INTO v_status
  FROM public.game_runs gr
  WHERE gr.id = p_run_id AND gr.user_id = auth.uid();
  IF v_status IS NULL THEN RAISE EXCEPTION 'Run nicht gefunden.'; END IF;

  -- Erlaubte Slots je nach Phase bestimmen
  IF v_status = 'bench' THEN
    v_valid_slots := ARRAY['BENCH1','BENCH2','BENCH3','BENCH4','BENCH5'];
    -- bench_position wird gespeichert aber NICHT hier geprüft.
    -- Wenn sie NULL oder ungültig ist, zeigt der Server einfach alle Skill-Positionen.
    -- Die harte Prüfung läuft in tr_pick_asset wenn der Spieler tatsächlich gewählt wird.
  ELSE
    v_valid_slots := ARRAY['QB','RB1','RB2','WR1','WR2','TE','DST','COACH'];
    p_bench_position := NULL; -- Starter brauchen keine bench_position
  END IF;

  IF NOT (p_slot = ANY(v_valid_slots)) THEN
    RAISE EXCEPTION 'Ungültiger Slot % für aktuelle Phase (status: %).', p_slot, v_status;
  END IF;

  SELECT gs.phase, gs.current_team_id INTO v_phase, v_current_team
  FROM public.game_state gs WHERE gs.run_id = p_run_id FOR UPDATE;

  IF v_phase <> 'need_slot' THEN
    RAISE EXCEPTION 'Slot-Auswahl aktuell nicht erlaubt (Phase: %).', v_phase;
  END IF;
  IF v_current_team IS NULL THEN
    RAISE EXCEPTION 'Bitte zuerst ein Team rollen.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.game_picks gp
    WHERE gp.run_id = p_run_id AND gp.slot = p_slot
  ) THEN
    RAISE EXCEPTION 'Dieser Slot ist bereits belegt.';
  END IF;

  -- bench_position nur setzen wenn gültig, sonst NULL lassen
  UPDATE public.game_state
  SET phase          = 'need_asset',
      pending_slot   = p_slot,
      bench_position = CASE
        WHEN p_bench_position IN ('QB','RB','WR','TE','K') THEN p_bench_position
        ELSE NULL
      END,
      updated_at     = now()
  WHERE run_id = p_run_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.tr_clear_pending_slot(p_run_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_phase       text;
  v_current_team uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Nicht authentifiziert.'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.game_runs WHERE id = p_run_id AND user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Run nicht gefunden.';
  END IF;

  SELECT gs.phase, gs.current_team_id INTO v_phase, v_current_team
  FROM public.game_state gs WHERE gs.run_id = p_run_id FOR UPDATE;

  IF v_current_team IS NULL THEN RAISE EXCEPTION 'Kein aktuelles Team vorhanden.'; END IF;
  IF v_phase NOT IN ('need_slot','need_asset') THEN
    RAISE EXCEPTION 'Position wechseln aktuell nicht möglich.';
  END IF;

  UPDATE public.game_state
  SET phase          = 'need_slot',
      pending_slot   = NULL,
      bench_position = NULL,
      updated_at     = now()
  WHERE run_id = p_run_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.tr_create_run(p_season integer)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  v_run_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Nicht authentifiziert.';
  end if;

  insert into public.game_runs(user_id, season, status)
  values (auth.uid(), p_season, 'active')
  returning id into v_run_id;

  insert into public.game_state(run_id, phase, current_team_id, pending_slot)
  values (v_run_id, 'need_roll', null, null);

  return v_run_id;
exception
  when unique_violation then
    raise exception 'Du hast für diese Season bereits einen Run.';
end;
$function$
;

CREATE OR REPLACE FUNCTION rebuild._commit_holder(k text, label text, period integer, holder text, val numeric, yr integer, wk integer, prev_holder text)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public', 'rebuild'
AS $function$
begin
  if holder is distinct from prev_holder then
    insert into rebuild.record_timeline_new
      (record_key, record_label, period_id, manager_id, from_year, from_week, to_year, to_week, weeks_held, record_value, is_current)
    values (k, label, period + 1, holder, yr, wk, yr, wk, 1, round(val, 2), false);
  else
    update rebuild.record_timeline_new
    set to_year = yr, to_week = wk, weeks_held = weeks_held + 1, record_value = round(val, 2)
    where record_key = k and period_id = period;
  end if;
end;
$function$
;

CREATE OR REPLACE FUNCTION rebuild.setting(k text)
 RETURNS numeric
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'rebuild'
AS $function$ select value from rebuild.settings where key = k $function$
;

CREATE OR REPLACE FUNCTION public.tr_pick_asset(p_run_id uuid, p_asset_type text, p_asset_id bigint)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_phase          text;
  v_pending_slot   text;
  v_current_team   uuid;
  v_pick_count     int;
  v_team_abbr      text;
  v_season         int;
  v_player_pos     text;
  v_expected_pos   text;
  v_run_status     text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Nicht authentifiziert.'; END IF;

  SELECT gr.season, gr.status INTO v_season, v_run_status
  FROM public.game_runs gr WHERE gr.id = p_run_id AND gr.user_id = auth.uid();
  IF v_season IS NULL THEN RAISE EXCEPTION 'Run nicht gefunden.'; END IF;

  SELECT gs.phase, gs.pending_slot, gs.current_team_id
  INTO v_phase, v_pending_slot, v_current_team
  FROM public.game_state gs WHERE gs.run_id = p_run_id FOR UPDATE;

  IF v_phase <> 'need_asset' THEN RAISE EXCEPTION 'Asset-Auswahl aktuell nicht erlaubt.'; END IF;
  IF v_pending_slot IS NULL OR v_current_team IS NULL THEN RAISE EXCEPTION 'Unvollständiger State.'; END IF;

  IF EXISTS (SELECT 1 FROM public.game_picks gp WHERE gp.run_id = p_run_id AND gp.slot = v_pending_slot) THEN
    RAISE EXCEPTION 'Slot bereits belegt.';
  END IF;

  -- Bank-Phase: kein Team aus dem Starter-Lineup
  IF v_run_status = 'bench' THEN
    IF EXISTS (
      SELECT 1 FROM public.game_picks gp
      WHERE gp.run_id = p_run_id AND gp.team_id = v_current_team AND gp.slot NOT LIKE 'BENCH%'
    ) THEN
      RAISE EXCEPTION 'Dieses Team ist bereits im Starter-Lineup. Würfle ein anderes Team.';
    END IF;
  END IF;

  SELECT t.abbr INTO v_team_abbr FROM public.teams t WHERE t.id = v_current_team;

  IF v_pending_slot = 'DST' THEN
    IF p_asset_type <> 'dst' OR p_asset_id IS NOT NULL THEN
      RAISE EXCEPTION 'Für DST nur DST ohne Asset-ID.';
    END IF;
    INSERT INTO public.game_picks(run_id, slot, team_id, asset_type, player_id, coach_id)
    VALUES (p_run_id, v_pending_slot, v_current_team, 'dst', NULL, NULL);

  ELSIF v_pending_slot = 'COACH' THEN
    IF p_asset_type <> 'coach' OR p_asset_id IS NULL THEN
      RAISE EXCEPTION 'Für COACH muss ein Coach gewählt werden.';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.coaches c WHERE c.id = p_asset_id::uuid AND c.team_id = v_current_team) THEN
      RAISE EXCEPTION 'Coach passt nicht zum Team.';
    END IF;
    INSERT INTO public.game_picks(run_id, slot, team_id, asset_type, player_id, coach_id)
    VALUES (p_run_id, v_pending_slot, v_current_team, 'coach', NULL, p_asset_id::uuid);

  ELSE
    IF p_asset_type <> 'player' OR p_asset_id IS NULL THEN
      RAISE EXCEPTION 'Für diesen Slot muss ein Spieler gewählt werden.';
    END IF;
    IF EXISTS (SELECT 1 FROM public.game_picks gp WHERE gp.run_id = p_run_id AND gp.player_id = p_asset_id) THEN
      RAISE EXCEPTION 'Dieser Spieler ist bereits in deinem Run.';
    END IF;

    SELECT r.position INTO v_player_pos
    FROM public.nflverse_roster_2025 r
    WHERE r.id = p_asset_id AND r.team = v_team_abbr AND r.season = v_season
    LIMIT 1;
    IF v_player_pos IS NULL THEN RAISE EXCEPTION 'Spieler passt nicht zum Team.'; END IF;

    IF v_pending_slot NOT LIKE 'BENCH%' THEN
      v_expected_pos := CASE
        WHEN v_pending_slot IN ('RB1','RB2') THEN 'RB'
        WHEN v_pending_slot IN ('WR1','WR2') THEN 'WR'
        WHEN v_pending_slot = 'QB'           THEN 'QB'
        WHEN v_pending_slot = 'TE'           THEN 'TE'
        ELSE NULL
      END;
      IF v_expected_pos IS NOT NULL AND v_player_pos <> v_expected_pos THEN
        RAISE EXCEPTION 'Slot % erwartet %, gewählt: %.', v_pending_slot, v_expected_pos, v_player_pos;
      END IF;
    ELSE
      IF v_player_pos NOT IN ('QB','RB','WR','TE','K') THEN
        RAISE EXCEPTION 'Bank erlaubt nur QB, RB, WR, TE, K.';
      END IF;
    END IF;

    INSERT INTO public.game_picks(run_id, slot, team_id, asset_type, player_id, coach_id)
    VALUES (p_run_id, v_pending_slot, v_current_team, 'player', p_asset_id, NULL);
  END IF;

  -- Phase-Übergang: Pick-Count NACH dem Insert zählen
  SELECT COUNT(*) INTO v_pick_count FROM public.game_picks gp WHERE gp.run_id = p_run_id;

  IF v_pick_count >= 13 THEN
    -- 8 Starter + 5 Bank fertig
    UPDATE public.game_runs SET status = 'complete' WHERE id = p_run_id;
    UPDATE public.game_state
    SET phase = 'complete', current_team_id = NULL, pending_slot = NULL, updated_at = now()
    WHERE run_id = p_run_id;

  ELSIF v_pick_count = 8 THEN
    -- Genau 8: immer → Bank-Phase (egal was v_run_status war)
    UPDATE public.game_runs SET status = 'bench' WHERE id = p_run_id;
    UPDATE public.game_state
    SET phase = 'need_roll', current_team_id = NULL, pending_slot = NULL, updated_at = now()
    WHERE run_id = p_run_id;

  ELSE
    -- Weniger als 8 oder zwischen 9-12: nächster Pick
    UPDATE public.game_state
    SET phase = 'need_roll', current_team_id = NULL, pending_slot = NULL, updated_at = now()
    WHERE run_id = p_run_id;
  END IF;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.tr_pick_asset(p_run_id uuid, p_asset_type text, p_asset_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  v_phase text;
  v_pending_slot text;
  v_current_team uuid;
  v_player_position text;
  v_pick_count int;
begin
  if auth.uid() is null then
    raise exception 'Nicht authentifiziert.';
  end if;

  if not exists (select 1 from public.game_runs where id = p_run_id and user_id = auth.uid()) then
    raise exception 'Run nicht gefunden.';
  end if;

  select gs.phase, gs.pending_slot, gs.current_team_id
  into v_phase, v_pending_slot, v_current_team
  from public.game_state gs
  where gs.run_id = p_run_id
  for update;

  if v_phase <> 'need_asset' then
    raise exception 'Asset-Auswahl aktuell nicht erlaubt.';
  end if;

  if v_pending_slot is null or v_current_team is null then
    raise exception 'Unvollständiger State.';
  end if;

  if exists (select 1 from public.game_picks gp where gp.run_id = p_run_id and gp.slot = v_pending_slot) then
    raise exception 'Slot bereits belegt.';
  end if;

  if exists (select 1 from public.game_picks gp where gp.run_id = p_run_id and gp.team_id = v_current_team) then
    raise exception 'Team wurde in diesem Run bereits verwendet.';
  end if;

  if v_pending_slot = 'DST' then
    if p_asset_type <> 'dst' or p_asset_id is not null then
      raise exception 'Für DST ist nur DST ohne Asset-ID erlaubt.';
    end if;

    insert into public.game_picks(run_id, slot, team_id, asset_type, player_id, coach_id)
    values (p_run_id, v_pending_slot, v_current_team, 'dst', null, null);
  elsif v_pending_slot = 'COACH' then
    if p_asset_type <> 'coach' or p_asset_id is null then
      raise exception 'Für COACH muss ein Coach gewählt werden.';
    end if;

    if not exists (
      select 1 from public.coaches c
      where c.id = p_asset_id and c.team_id = v_current_team
    ) then
      raise exception 'Coach passt nicht zum gerollten Team.';
    end if;

    insert into public.game_picks(run_id, slot, team_id, asset_type, player_id, coach_id)
    values (p_run_id, v_pending_slot, v_current_team, 'coach', null, p_asset_id);
  else
    if p_asset_type <> 'player' or p_asset_id is null then
      raise exception 'Für diesen Slot muss ein Spieler gewählt werden.';
    end if;

    select p.position into v_player_position
    from public.players p
    where p.id = p_asset_id and p.team_id = v_current_team;

    if v_player_position is null then
      raise exception 'Spieler passt nicht zum gerollten Team.';
    end if;

    if v_pending_slot in ('RB1', 'RB2') and v_player_position <> 'RB' then
      raise exception 'Slot erwartet einen RB.';
    elsif v_pending_slot in ('WR1', 'WR2') and v_player_position <> 'WR' then
      raise exception 'Slot erwartet einen WR.';
    elsif v_pending_slot in ('QB', 'TE') and v_player_position <> v_pending_slot then
      raise exception 'Spielerposition passt nicht zum Slot.';
    end if;

    insert into public.game_picks(run_id, slot, team_id, asset_type, player_id, coach_id)
    values (p_run_id, v_pending_slot, v_current_team, 'player', p_asset_id, null);
  end if;

  select count(*) into v_pick_count
  from public.game_picks gp
  where gp.run_id = p_run_id;

  if v_pick_count >= 8 then
    update public.game_runs set status = 'complete' where id = p_run_id;
    update public.game_state
      set phase = 'complete', current_team_id = null, pending_slot = null, updated_at = now()
      where run_id = p_run_id;
  else
    update public.game_state
      set phase = 'need_roll', current_team_id = null, pending_slot = null, updated_at = now()
      where run_id = p_run_id;
  end if;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.tr_pick_coach(p_run_id uuid, p_coach_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  v_phase text;
  v_pending_slot text;
  v_current_team uuid;
  v_pick_count int;
begin
  if auth.uid() is null then
    raise exception 'Nicht authentifiziert.';
  end if;

  if not exists (select 1 from public.game_runs where id = p_run_id and user_id = auth.uid()) then
    raise exception 'Run nicht gefunden.';
  end if;

  select gs.phase, gs.pending_slot, gs.current_team_id
  into v_phase, v_pending_slot, v_current_team
  from public.game_state gs
  where gs.run_id = p_run_id
  for update;

  if v_phase <> 'need_asset' then
    raise exception 'Asset-Auswahl aktuell nicht erlaubt.';
  end if;

  if v_pending_slot <> 'COACH' then
    raise exception 'Dieser Slot erwartet keinen Coach.';
  end if;

  if v_current_team is null then
    raise exception 'Bitte zuerst ein Team rollen.';
  end if;

  if exists (select 1 from public.game_picks gp where gp.run_id = p_run_id and gp.slot = 'COACH') then
    raise exception 'Slot bereits belegt.';
  end if;

  if exists (select 1 from public.game_picks gp where gp.run_id = p_run_id and gp.team_id = v_current_team) then
    raise exception 'Team wurde in diesem Run bereits verwendet.';
  end if;

  if not exists (
    select 1 from public.coaches c
    where c.id = p_coach_id and c.team_id = v_current_team
  ) then
    raise exception 'Coach passt nicht zum gerollten Team.';
  end if;

  insert into public.game_picks(run_id, slot, team_id, asset_type, player_id, coach_id)
  values (p_run_id, 'COACH', v_current_team, 'coach', null, p_coach_id);

  select count(*) into v_pick_count from public.game_picks gp where gp.run_id = p_run_id;

  if v_pick_count >= 8 then
    update public.game_runs set status = 'complete' where id = p_run_id;
    update public.game_state
      set phase='complete', current_team_id=null, pending_slot=null, updated_at=now()
      where run_id = p_run_id;
  else
    update public.game_state
      set phase='need_roll', current_team_id=null, pending_slot=null, updated_at=now()
      where run_id = p_run_id;
  end if;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.tr_pick_dst(p_run_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  v_phase text;
  v_pending_slot text;
  v_current_team uuid;
  v_pick_count int;
begin
  if auth.uid() is null then
    raise exception 'Nicht authentifiziert.';
  end if;

  if not exists (select 1 from public.game_runs where id = p_run_id and user_id = auth.uid()) then
    raise exception 'Run nicht gefunden.';
  end if;

  select gs.phase, gs.pending_slot, gs.current_team_id
  into v_phase, v_pending_slot, v_current_team
  from public.game_state gs
  where gs.run_id = p_run_id
  for update;

  if v_phase <> 'need_asset' then
    raise exception 'Asset-Auswahl aktuell nicht erlaubt.';
  end if;

  if v_pending_slot <> 'DST' then
    raise exception 'Dieser Slot erwartet keine DST.';
  end if;

  if v_current_team is null then
    raise exception 'Bitte zuerst ein Team rollen.';
  end if;

  if exists (select 1 from public.game_picks gp where gp.run_id = p_run_id and gp.slot = 'DST') then
    raise exception 'Slot bereits belegt.';
  end if;

  if exists (select 1 from public.game_picks gp where gp.run_id = p_run_id and gp.team_id = v_current_team) then
    raise exception 'Team wurde in diesem Run bereits verwendet.';
  end if;

  insert into public.game_picks(run_id, slot, team_id, asset_type, player_id, coach_id)
  values (p_run_id, 'DST', v_current_team, 'dst', null, null);

  select count(*) into v_pick_count from public.game_picks gp where gp.run_id = p_run_id;

  if v_pick_count >= 8 then
    update public.game_runs set status = 'complete' where id = p_run_id;
    update public.game_state
      set phase='complete', current_team_id=null, pending_slot=null, updated_at=now()
      where run_id = p_run_id;
  else
    update public.game_state
      set phase='need_roll', current_team_id=null, pending_slot=null, updated_at=now()
      where run_id = p_run_id;
  end if;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.tr_pick_player(p_run_id uuid, p_player_id bigint)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_phase          text;
  v_pending_slot   text;
  v_current_team   uuid;
  v_pick_count     int;
  v_team_abbr      text;
  v_season         int;
  v_player_pos     text;
  v_expected_pos   text;
  v_run_status     text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Nicht authentifiziert.'; END IF;

  SELECT gr.season, gr.status INTO v_season, v_run_status
  FROM public.game_runs gr WHERE gr.id = p_run_id AND gr.user_id = auth.uid();
  IF v_season IS NULL THEN RAISE EXCEPTION 'Run nicht gefunden.'; END IF;

  SELECT gs.phase, gs.pending_slot, gs.current_team_id
  INTO v_phase, v_pending_slot, v_current_team
  FROM public.game_state gs WHERE gs.run_id = p_run_id FOR UPDATE;

  IF v_phase <> 'need_asset' THEN RAISE EXCEPTION 'Asset-Auswahl aktuell nicht erlaubt.'; END IF;
  IF v_pending_slot IS NULL OR v_current_team IS NULL THEN RAISE EXCEPTION 'Unvollständiger State.'; END IF;
  IF v_pending_slot IN ('DST','COACH') THEN RAISE EXCEPTION 'Dieser Slot erwartet keinen Spieler.'; END IF;

  IF EXISTS (SELECT 1 FROM public.game_picks gp WHERE gp.run_id = p_run_id AND gp.slot = v_pending_slot) THEN
    RAISE EXCEPTION 'Slot bereits belegt.';
  END IF;

  -- Bank: kein Team aus dem Starter-Lineup
  IF v_run_status = 'bench' THEN
    IF EXISTS (
      SELECT 1 FROM public.game_picks gp
      WHERE gp.run_id = p_run_id
        AND gp.team_id = v_current_team
        AND gp.slot NOT LIKE 'BENCH%'
    ) THEN
      RAISE EXCEPTION 'Dieses Team ist bereits im Starter-Lineup.';
    END IF;
  END IF;

  -- Kein Spieler doppelt
  IF EXISTS (SELECT 1 FROM public.game_picks gp WHERE gp.run_id = p_run_id AND gp.player_id = p_player_id) THEN
    RAISE EXCEPTION 'Dieser Spieler ist bereits in deinem Run.';
  END IF;

  SELECT t.abbr INTO v_team_abbr FROM public.teams t WHERE t.id = v_current_team;

  SELECT r.position INTO v_player_pos
  FROM public.nflverse_roster_2025 r
  WHERE r.id = p_player_id AND r.team = v_team_abbr AND r.season = v_season
  LIMIT 1;
  IF v_player_pos IS NULL THEN RAISE EXCEPTION 'Spieler passt nicht zum Team.'; END IF;

  IF v_pending_slot NOT LIKE 'BENCH%' THEN
    v_expected_pos := CASE
      WHEN v_pending_slot IN ('RB1','RB2') THEN 'RB'
      WHEN v_pending_slot IN ('WR1','WR2') THEN 'WR'
      WHEN v_pending_slot = 'QB' THEN 'QB'
      WHEN v_pending_slot = 'TE' THEN 'TE'
      ELSE NULL
    END;
    IF v_expected_pos IS NOT NULL AND v_player_pos <> v_expected_pos THEN
      RAISE EXCEPTION 'Slot % erwartet %, gewählt wurde %.', v_pending_slot, v_expected_pos, v_player_pos;
    END IF;
  ELSE
    IF v_player_pos NOT IN ('QB','RB','WR','TE','K') THEN
      RAISE EXCEPTION 'Bank erlaubt nur QB, RB, WR, TE, K.';
    END IF;
  END IF;

  INSERT INTO public.game_picks(run_id, slot, team_id, asset_type, player_id, coach_id)
  VALUES (p_run_id, v_pending_slot, v_current_team, 'player', p_player_id, NULL);

  SELECT COUNT(*) INTO v_pick_count FROM public.game_picks gp WHERE gp.run_id = p_run_id;

  IF v_pick_count >= 13 THEN
    UPDATE public.game_runs SET status = 'complete' WHERE id = p_run_id;
    UPDATE public.game_state
    SET phase = 'complete', current_team_id = NULL, pending_slot = NULL, updated_at = now()
    WHERE run_id = p_run_id;
  ELSIF v_pick_count >= 8 AND v_run_status = 'active' THEN
    UPDATE public.game_runs SET status = 'bench' WHERE id = p_run_id;
    UPDATE public.game_state
    SET phase = 'need_roll', current_team_id = NULL, pending_slot = NULL, updated_at = now()
    WHERE run_id = p_run_id;
  ELSE
    UPDATE public.game_state
    SET phase = 'need_roll', current_team_id = NULL, pending_slot = NULL, updated_at = now()
    WHERE run_id = p_run_id;
  END IF;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.tr_roll_team(p_run_id uuid)
 RETURNS TABLE(team_id uuid, team_abbr text, team_name text, team_logo_url text)
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_phase    text;
  v_status   text;
  v_team_id  uuid;
  v_attempts int := 0;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Nicht authentifiziert.'; END IF;

  SELECT gr.status INTO v_status
  FROM public.game_runs gr
  WHERE gr.id = p_run_id AND gr.user_id = auth.uid();
  IF v_status IS NULL THEN RAISE EXCEPTION 'Run nicht gefunden.'; END IF;

  SELECT gs.phase INTO v_phase
  FROM public.game_state gs WHERE gs.run_id = p_run_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'State nicht gefunden.'; END IF;
  IF v_phase <> 'need_roll' THEN RAISE EXCEPTION 'Du kannst aktuell kein Team rollen.'; END IF;

  IF v_status = 'bench' THEN
    -- Bank: zufälliges Team das NICHT schon als Starter (nicht-BENCH Slot) verwendet wurde
    SELECT t.id INTO v_team_id
    FROM public.teams t
    WHERE NOT EXISTS (
      SELECT 1 FROM public.game_picks gp
      WHERE gp.run_id = p_run_id
        AND gp.team_id = t.id
        AND gp.slot NOT LIKE 'BENCH%'  -- nur Starter-Slots blockieren
    )
    ORDER BY random()
    LIMIT 1;
  ELSE
    -- Starter: kein Team doppelt (weder Starter noch Bank)
    SELECT t.id INTO v_team_id
    FROM public.teams t
    WHERE NOT EXISTS (
      SELECT 1 FROM public.game_picks gp
      WHERE gp.run_id = p_run_id AND gp.team_id = t.id
    )
    ORDER BY random()
    LIMIT 1;
  END IF;

  IF v_team_id IS NULL THEN
    RAISE EXCEPTION 'Keine verfügbaren Teams mehr (alle bereits als Starter gepickt).';
  END IF;

  UPDATE public.game_state
  SET phase = 'need_slot', current_team_id = v_team_id, pending_slot = NULL, updated_at = now()
  WHERE run_id = p_run_id;

  RETURN QUERY
  SELECT t.id, t.abbr, t.name, t.logo_url
  FROM public.teams t WHERE t.id = v_team_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION rebuild.compute_records()
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public', 'rebuild'
AS $function$
declare
  c record;
  cur_key text := null;
  cur_idx int := null;
  prev_holder text;
  holder text;
  holder_val numeric;
  last_idx int;
begin
  -- 1. Refresh caches
  truncate rebuild.games_cache;
  insert into rebuild.games_cache select * from rebuild.games_source;
  analyze rebuild.games_cache;
  truncate rebuild.lineup_cache;
  insert into rebuild.lineup_cache select * from rebuild.lineup_source;
  analyze rebuild.lineup_cache;
  truncate rebuild.obs_cache;
  insert into rebuild.obs_cache select * from rebuild.record_obs;
  analyze rebuild.obs_cache;
  last_idx := (select max(idx) from rebuild.weeks);

  -- 2. Each manager's value after every week
  truncate rebuild.record_values;

  insert into rebuild.record_values
  with defs as (select * from rebuild.record_defs where agg in ('sum','ratio','max','min')),
  obs as (
    select o.record_key, o.manager_id, o.idx,
           sum(o.v1) s1, sum(o.v2) s2, max(o.v1) mx, min(o.v1) mn, count(*) n
    from rebuild.obs_cache o join defs using (record_key)
    group by 1,2,3
  ),
  grid as (
    select d.record_key, d.agg, d.min_obs, m.manager_id, w.idx
    from defs d
    cross join (select distinct manager_id from public.season_results) m
    cross join rebuild.weeks w
  ),
  running as (
    select g.record_key, g.agg, g.min_obs, g.manager_id, g.idx,
      sum(o.s1) over win as rs1, sum(o.s2) over win as rs2,
      max(o.mx) over win as rmx, min(o.mn) over win as rmn,
      sum(o.n) over win as rn
    from grid g left join obs o using (record_key, manager_id, idx)
    window win as (partition by g.record_key, g.manager_id order by g.idx)
  )
  select record_key, manager_id, idx,
    case
      when coalesce(rn, 0) < min_obs then null
      when agg = 'sum' then rs1
      when agg = 'ratio' then rs1 / nullif(rs2, 0)
      when agg = 'max' then rmx
      when agg = 'min' then rmn
    end
  from running;

  insert into rebuild.record_values
  with defs as (select * from rebuild.record_defs where agg in ('group_max','group_min')),
  per_group as (
    select o.record_key, o.manager_id, w.idx, o.grp, sum(o.v1) v, count(*) n
    from rebuild.obs_cache o
    join defs using (record_key)
    join rebuild.weeks w on o.idx <= w.idx
    group by 1,2,3,4
  )
  select p.record_key, p.manager_id, p.idx,
    case when d.agg = 'group_max' then max(p.v) else min(p.v) end
  from per_group p join defs d using (record_key)
  where p.n >= d.min_obs
  group by p.record_key, p.manager_id, p.idx, d.agg;

  insert into rebuild.record_values
  select o.record_key, o.manager_id, w.idx,
    case when d.agg = 'median' then percentile_cont(0.5) within group (order by o.v1)
         else stddev_samp(o.v1) end
  from rebuild.obs_cache o
  join rebuild.record_defs d using (record_key)
  join rebuild.weeks w on o.idx <= w.idx
  where d.agg in ('median','stddev')
  group by o.record_key, o.manager_id, w.idx, d.agg, d.min_obs
  having count(*) >= d.min_obs;

  -- 3. Holder per week. Candidates are all managers with the best value that
  -- week; the current holder keeps the record on a tie, otherwise the manager
  -- who was better the week before, then alphabetical.
  truncate rebuild.record_holders;
  for c in
    with best as (
      select v.record_key, v.idx,
             case when d.direction = 'max' then max(v.value) else min(v.value) end as best
      from rebuild.record_values v join rebuild.record_defs d using (record_key)
      where v.value is not null and (not d.positive_only or v.value > 0)
      group by v.record_key, v.idx, d.direction
    )
    select v.record_key, v.idx, v.manager_id, v.value
    from best b
    join rebuild.record_values v on v.record_key = b.record_key and v.idx = b.idx and v.value = b.best
    join rebuild.record_defs d on d.record_key = v.record_key
    left join rebuild.record_values pv on pv.record_key = v.record_key and pv.manager_id = v.manager_id and pv.idx = v.idx - 1
    order by v.record_key, v.idx,
             case when d.direction = 'max' then pv.value end desc nulls last,
             case when d.direction = 'min' then pv.value end asc nulls last,
             v.manager_id
  loop
    if c.record_key is distinct from cur_key or c.idx is distinct from cur_idx then
      if cur_key is not null then
        insert into rebuild.record_holders values (cur_key, cur_idx, holder, holder_val);
        prev_holder := holder;
      end if;
      if c.record_key is distinct from cur_key then
        prev_holder := null;
      end if;
      cur_key := c.record_key;
      cur_idx := c.idx;
      holder := c.manager_id;
      holder_val := c.value;
    end if;
    if c.manager_id = prev_holder then
      holder := c.manager_id;
    end if;
  end loop;
  if cur_key is not null then
    insert into rebuild.record_holders values (cur_key, cur_idx, holder, holder_val);
  end if;

  -- 4. Collapse consecutive weeks with the same holder into periods
  truncate rebuild.record_timeline_new;
  insert into rebuild.record_timeline_new
    (record_key, record_label, period_id, manager_id, from_year, from_week, to_year, to_week, weeks_held, record_value, is_current)
  with h as (
    select *, row_number() over (partition by record_key order by idx)
            - row_number() over (partition by record_key, manager_id order by idx) as island
    from rebuild.record_holders
  ),
  p as (
    select record_key, manager_id, island, min(idx) as from_idx, max(idx) as to_idx, count(*) as weeks_held
    from h group by record_key, manager_id, island
  )
  select p.record_key, d.record_label,
         row_number() over (partition by p.record_key order by p.from_idx),
         p.manager_id, wf.season_year, wf.week, wt.season_year, wt.week, p.weeks_held,
         round(last.value, 2),
         p.to_idx = max(p.to_idx) over (partition by p.record_key)
  from p
  join rebuild.record_defs d on d.record_key = p.record_key
  join rebuild.weeks wf on wf.idx = p.from_idx
  join rebuild.weeks wt on wt.idx = p.to_idx
  join rebuild.record_holders last on last.record_key = p.record_key and last.idx = p.to_idx;

  -- 5. Every manager's current value
  truncate rebuild.record_owner_values_new;
  insert into rebuild.record_owner_values_new (record_key, manager_id, current_value)
  select record_key, manager_id, round(value, 2)
  from rebuild.record_values
  where idx = last_idx and value is not null;
end;
$function$
;

reset check_function_bodies;

-- ---------------------------------------------------------------------------
-- 5. Views and materialized views, ordered by dependency level
--    (level 0 = depends on tables only; level n = depends on level n-1 objects)
--    Definitions come from pg_get_viewdef with search_path = public, rebuild.
-- ---------------------------------------------------------------------------

set search_path = public, rebuild;

-- ===== Level 0 =====

create or replace view public.v_all_play with (security_invoker = true) as
 WITH scores AS (
         SELECT weekly_matchups.season_year,
            weekly_matchups.week,
            weekly_matchups.manager_a AS manager_id,
            weekly_matchups.score_a AS score,
            weekly_matchups.is_playoff
           FROM weekly_matchups
        UNION ALL
         SELECT weekly_matchups.season_year,
            weekly_matchups.week,
            weekly_matchups.manager_b,
            weekly_matchups.score_b,
            weekly_matchups.is_playoff
           FROM weekly_matchups
        )
 SELECT a.season_year,
    a.manager_id,
    count(*) AS games,
    sum(
        CASE
            WHEN (a.score > b.score) THEN 1
            ELSE 0
        END) AS ap_wins,
    sum(
        CASE
            WHEN (a.score < b.score) THEN 1
            ELSE 0
        END) AS ap_losses,
    sum(
        CASE
            WHEN (a.score = b.score) THEN 1
            ELSE 0
        END) AS ap_ties,
    round(((sum(
        CASE
            WHEN (a.score > b.score) THEN 1
            ELSE 0
        END))::numeric / (NULLIF(count(*), 0))::numeric), 4) AS ap_win_pct
   FROM (scores a
     JOIN scores b ON (((a.season_year = b.season_year) AND (a.week = b.week) AND (a.manager_id <> b.manager_id) AND (a.is_playoff = false) AND (b.is_playoff = false))))
  GROUP BY a.season_year, a.manager_id;

create or replace view public.v_draft_grades with (security_invoker = true) as
 SELECT season_year,
    manager_id,
    count(*) AS total_picks,
    round(avg(grade4), 2) AS avg_grade4,
    round(avg(vorp), 2) AS avg_vorp,
    sum(
        CASE
            WHEN (grade4 > (0)::numeric) THEN 1
            ELSE 0
        END) AS positive_picks,
    round(avg(
        CASE
            WHEN (round <= 5) THEN grade4
            ELSE NULL::numeric
        END), 2) AS early_round_grade,
    round(avg(
        CASE
            WHEN (round > 5) THEN grade4
            ELSE NULL::numeric
        END), 2) AS late_round_grade
   FROM draft_picks
  WHERE (grade4 IS NOT NULL)
  GROUP BY season_year, manager_id;

create or replace view public.v_elo_current with (security_invoker = true) as
 WITH latest AS (
         SELECT DISTINCT ON (elo_ratings.manager_id) elo_ratings.manager_id,
            elo_ratings.elo_after AS elo,
            elo_ratings.game_seq
           FROM elo_ratings
          ORDER BY elo_ratings.manager_id, elo_ratings.game_seq DESC
        ), peak AS (
         SELECT DISTINCT ON (elo_ratings.manager_id) elo_ratings.manager_id,
            elo_ratings.season_year AS peak_season,
            elo_ratings.week AS peak_week,
            round(elo_ratings.elo_after, 0) AS peak_elo
           FROM elo_ratings
          ORDER BY elo_ratings.manager_id, elo_ratings.elo_after DESC
        ), stats AS (
         SELECT elo_ratings.manager_id,
            round(max(elo_ratings.elo_after), 0) AS peak_elo,
            round(min(elo_ratings.elo_after), 0) AS lowest_elo,
            count(*) AS games_played,
            sum(
                CASE
                    WHEN elo_ratings.won THEN 1
                    ELSE 0
                END) AS wins,
            round((((sum(
                CASE
                    WHEN elo_ratings.won THEN 1
                    ELSE 0
                END))::numeric / (NULLIF(count(*), 0))::numeric) * (100)::numeric), 1) AS win_pct,
            sum(
                CASE
                    WHEN elo_ratings.is_upset THEN 1
                    ELSE 0
                END) AS upsets_pulled,
            round(avg(elo_ratings.k_used), 1) AS avg_k_used,
            round(avg(elo_ratings.elo_change), 2) AS avg_change_per_game
           FROM elo_ratings
          GROUP BY elo_ratings.manager_id
        )
 SELECT l.manager_id,
    round(l.elo, 0) AS current_elo,
    rank() OVER (ORDER BY l.elo DESC) AS elo_rank,
    s.peak_elo,
    p.peak_season,
    p.peak_week,
    s.lowest_elo,
    s.games_played,
    s.wins,
    s.win_pct,
    s.upsets_pulled,
    s.avg_k_used,
    s.avg_change_per_game
   FROM ((latest l
     JOIN stats s USING (manager_id))
     JOIN peak p USING (manager_id));

create or replace view public.v_elo_history with (security_invoker = true) as
 SELECT manager_id,
    season_year,
    week,
    is_playoff,
    round(elo_before, 0) AS elo_before,
    round(elo_after, 0) AS elo_after,
    round(elo_change, 0) AS elo_change,
    won,
    score,
    opp_score,
    opponent_id,
    weekly_rank,
    mov_multiplier,
    upset_multiplier,
    perf_multiplier,
    k_used,
    is_upset,
    game_seq,
    (((season_year - 2015) * 20) + week) AS chart_x
   FROM elo_ratings
  ORDER BY game_seq;

create or replace view public.v_h2h_lineups with (security_invoker = true) as
 SELECT l.season_year,
    l.week,
    l.manager_id,
        CASE
            WHEN (m.manager_a = l.manager_id) THEN m.manager_b
            ELSE m.manager_a
        END AS opponent_id,
    m.is_playoff,
    l.slot,
    l.player_name,
    l.espn_id,
    l.points,
    l.is_starter
   FROM (weekly_lineups l
     JOIN weekly_matchups m ON (((m.season_year = l.season_year) AND (m.week = l.week) AND ((l.manager_id = m.manager_a) OR (l.manager_id = m.manager_b)))));

create or replace view public.v_head_to_head with (security_invoker = true) as
 WITH all_matchups AS (
         SELECT weekly_matchups.season_year,
            weekly_matchups.week,
            weekly_matchups.manager_a,
            weekly_matchups.score_a,
            weekly_matchups.manager_b,
            weekly_matchups.score_b
           FROM weekly_matchups
        UNION ALL
         SELECT weekly_matchups.season_year,
            weekly_matchups.week,
            weekly_matchups.manager_b,
            weekly_matchups.score_b,
            weekly_matchups.manager_a,
            weekly_matchups.score_a
           FROM weekly_matchups
        )
 SELECT manager_a AS manager_id,
    manager_b AS opponent_id,
    count(*) AS total_games,
    sum(
        CASE
            WHEN (score_a > score_b) THEN 1
            ELSE 0
        END) AS wins,
    sum(
        CASE
            WHEN (score_a < score_b) THEN 1
            ELSE 0
        END) AS losses,
    sum(
        CASE
            WHEN (score_a = score_b) THEN 1
            ELSE 0
        END) AS ties,
    round(avg(score_a), 2) AS avg_score_for,
    round(avg(score_b), 2) AS avg_score_against,
    round(((sum(
        CASE
            WHEN (score_a > score_b) THEN 1
            ELSE 0
        END))::numeric / (NULLIF(count(*), 0))::numeric), 4) AS win_pct
   FROM all_matchups
  GROUP BY manager_a, manager_b;

create or replace view public.v_lineup_efficiency with (security_invoker = true) as
 SELECT season_year,
    manager_id,
    ( SELECT count(DISTINCT wm.week) AS count
           FROM weekly_matchups wm
          WHERE ((wm.season_year = sr.season_year) AND (wm.is_playoff = false) AND ((wm.manager_a = sr.manager_id) OR (wm.manager_b = sr.manager_id)))) AS weeks,
    points_for AS avg_actual_pts,
    max_points_for AS avg_max_pts,
    lineup_efficiency
   FROM season_results sr
  WHERE (lineup_efficiency IS NOT NULL);

create or replace view public.v_matchup_records with (security_invoker = true) as
 WITH all_games AS (
         SELECT weekly_matchups.season_year,
            weekly_matchups.week,
            weekly_matchups.is_playoff,
            weekly_matchups.manager_a AS manager_id,
            weekly_matchups.score_a AS score,
            weekly_matchups.manager_b AS opponent_id,
            weekly_matchups.score_b AS opp_score,
            (weekly_matchups.score_a - weekly_matchups.score_b) AS margin,
            (weekly_matchups.score_a + weekly_matchups.score_b) AS combined,
            round(((weekly_matchups.score_a / NULLIF((weekly_matchups.score_a + weekly_matchups.score_b), (0)::numeric)) * (100)::numeric), 2) AS points_share
           FROM weekly_matchups
          WHERE (weekly_matchups.score_a IS NOT NULL)
        UNION ALL
         SELECT weekly_matchups.season_year,
            weekly_matchups.week,
            weekly_matchups.is_playoff,
            weekly_matchups.manager_b,
            weekly_matchups.score_b,
            weekly_matchups.manager_a,
            weekly_matchups.score_a,
            (weekly_matchups.score_b - weekly_matchups.score_a),
            (weekly_matchups.score_a + weekly_matchups.score_b),
            round(((weekly_matchups.score_b / NULLIF((weekly_matchups.score_a + weekly_matchups.score_b), (0)::numeric)) * (100)::numeric), 2) AS round
           FROM weekly_matchups
          WHERE (weekly_matchups.score_b IS NOT NULL)
        )
 SELECT season_year,
    week,
    is_playoff,
    manager_id,
    score,
    opponent_id,
    opp_score,
    margin,
    combined,
    points_share,
        CASE
            WHEN (margin > (0)::numeric) THEN true
            ELSE false
        END AS is_win
   FROM all_games;

create or replace view public.v_player_espn_gsis with (security_invoker = true) as
 SELECT DISTINCT ON (espn_id) espn_id,
    gsis_id
   FROM players
  WHERE (COALESCE(espn_id, ''::text) <> ''::text)
  ORDER BY espn_id, last_season DESC NULLS LAST;

create or replace view public.v_player_loyalty with (security_invoker = true) as
 SELECT manager_id,
    player_name,
    "position",
    count(*) AS times_drafted,
    min(season_year) AS first_drafted,
    max(season_year) AS last_drafted,
    ((max(season_year) - min(season_year)) + 1) AS years_span,
    string_agg((season_year)::text, ', '::text ORDER BY season_year) AS seasons
   FROM draft_picks
  GROUP BY manager_id, player_name, "position"
 HAVING (count(*) >= 2)
  ORDER BY (count(*)) DESC, manager_id, player_name;

create or replace view public.v_player_ownership with (security_invoker = true) as
 SELECT wl.manager_id,
    wl.player_name,
    COALESCE(p."position", dp."position") AS "position",
    count(DISTINCT ((wl.season_year || '-'::text) || wl.week)) AS total_weeks,
    count(DISTINCT wl.season_year) AS seasons_on_roster,
    min(wl.season_year) AS first_season,
    max(wl.season_year) AS last_season,
    sum(
        CASE
            WHEN wl.is_starter THEN 1
            ELSE 0
        END) AS weeks_as_starter,
    sum(
        CASE
            WHEN (NOT wl.is_starter) THEN 1
            ELSE 0
        END) AS weeks_on_bench,
    round(sum(COALESCE(wl.points, (0)::numeric)), 2) AS total_points_scored
   FROM ((weekly_lineups wl
     LEFT JOIN players p ON ((p.espn_id = wl.espn_id)))
     LEFT JOIN ( SELECT DISTINCT draft_picks.player_name,
            draft_picks."position"
           FROM draft_picks) dp ON ((dp.player_name = wl.player_name)))
  WHERE ((wl.player_name IS NOT NULL) AND (wl.player_name <> ''::text))
  GROUP BY wl.manager_id, wl.player_name, COALESCE(p."position", dp."position")
 HAVING (count(DISTINCT ((wl.season_year || '-'::text) || wl.week)) >= 5)
  ORDER BY (count(DISTINCT ((wl.season_year || '-'::text) || wl.week))) DESC;

create or replace view public.v_points_share with (security_invoker = true) as
 WITH league_totals AS (
         SELECT season_results.season_year,
            sum(season_results.points_for) AS total_pf
           FROM season_results
          GROUP BY season_results.season_year
        )
 SELECT sr.season_year,
    sr.manager_id,
    sr.points_for,
    lt.total_pf,
    round(((sr.points_for / lt.total_pf) * (100)::numeric), 2) AS points_share_pct
   FROM (season_results sr
     JOIN league_totals lt ON ((sr.season_year = lt.season_year)));

create or replace view public.v_position_records with (security_invoker = true) as
 WITH lineup_with_pos AS (
         SELECT wl.season_year,
            wl.week,
            wl.manager_id,
            wl.points,
            wl.is_starter,
            wl.slot,
                CASE
                    WHEN (wl.slot = 'QB'::text) THEN 'QB'::text
                    WHEN (wl.slot = ANY (ARRAY['RB1'::text, 'RB2'::text])) THEN 'RB'::text
                    WHEN (wl.slot = ANY (ARRAY['WR1'::text, 'WR2'::text])) THEN 'WR'::text
                    WHEN (wl.slot = 'TE'::text) THEN 'TE'::text
                    WHEN (wl.slot = 'K'::text) THEN 'K'::text
                    WHEN (wl.slot = 'DST'::text) THEN 'DST'::text
                    WHEN (wl.slot = 'FLEX'::text) THEN COALESCE(p.position_group,
                    CASE p."position"
                        WHEN 'RB'::text THEN 'RB'::text
                        WHEN 'FB'::text THEN 'RB'::text
                        WHEN 'WR'::text THEN 'WR'::text
                        WHEN 'TE'::text THEN 'TE'::text
                        ELSE 'FLEX'::text
                    END)
                    WHEN (wl.slot ~~ 'BN%'::text) THEN
                    CASE p."position"
                        WHEN 'QB'::text THEN 'QB'::text
                        WHEN 'RB'::text THEN 'RB'::text
                        WHEN 'FB'::text THEN 'RB'::text
                        WHEN 'WR'::text THEN 'WR'::text
                        WHEN 'TE'::text THEN 'TE'::text
                        WHEN 'K'::text THEN 'K'::text
                        ELSE NULL::text
                    END
                    ELSE NULL::text
                END AS pos_group
           FROM (weekly_lineups wl
             LEFT JOIN players p ON ((p.espn_id = wl.espn_id)))
        ), starter_week AS (
         SELECT lineup_with_pos.season_year,
            lineup_with_pos.week,
            lineup_with_pos.manager_id,
            sum(
                CASE
                    WHEN ((lineup_with_pos.pos_group = 'QB'::text) AND lineup_with_pos.is_starter) THEN lineup_with_pos.points
                    ELSE (0)::numeric
                END) AS qb_pts,
            sum(
                CASE
                    WHEN ((lineup_with_pos.pos_group = 'RB'::text) AND lineup_with_pos.is_starter) THEN lineup_with_pos.points
                    ELSE (0)::numeric
                END) AS rb_pts,
            sum(
                CASE
                    WHEN ((lineup_with_pos.pos_group = 'WR'::text) AND lineup_with_pos.is_starter) THEN lineup_with_pos.points
                    ELSE (0)::numeric
                END) AS wr_pts,
            sum(
                CASE
                    WHEN ((lineup_with_pos.pos_group = 'TE'::text) AND lineup_with_pos.is_starter) THEN lineup_with_pos.points
                    ELSE (0)::numeric
                END) AS te_pts,
            sum(
                CASE
                    WHEN ((lineup_with_pos.pos_group = 'K'::text) AND lineup_with_pos.is_starter) THEN lineup_with_pos.points
                    ELSE (0)::numeric
                END) AS k_pts,
            sum(
                CASE
                    WHEN ((lineup_with_pos.pos_group = 'DST'::text) AND lineup_with_pos.is_starter) THEN lineup_with_pos.points
                    ELSE (0)::numeric
                END) AS dst_pts,
            sum(
                CASE
                    WHEN (NOT lineup_with_pos.is_starter) THEN lineup_with_pos.points
                    ELSE (0)::numeric
                END) AS bench_pts
           FROM lineup_with_pos
          GROUP BY lineup_with_pos.season_year, lineup_with_pos.week, lineup_with_pos.manager_id
        )
 SELECT manager_id,
    round(sum(qb_pts), 2) AS total_qb_pts,
    round(sum(rb_pts), 2) AS total_rb_pts,
    round(sum(wr_pts), 2) AS total_wr_pts,
    round(sum(te_pts), 2) AS total_te_pts,
    round(sum(k_pts), 2) AS total_k_pts,
    round(sum(dst_pts), 2) AS total_dst_pts,
    round(sum(bench_pts), 2) AS total_bench_pts,
    round(max((((((qb_pts + rb_pts) + wr_pts) + te_pts) + k_pts) + dst_pts)), 2) AS best_week_score,
    round(min((((((qb_pts + rb_pts) + wr_pts) + te_pts) + k_pts) + dst_pts)), 2) AS worst_week_score,
    round(max(bench_pts), 2) AS best_bench_week,
    round(min(bench_pts), 2) AS worst_bench_week,
    count(*) AS games_played
   FROM starter_week
  GROUP BY manager_id;

create or replace view public.v_sos with (security_invoker = true) as
 WITH all_sides AS (
         SELECT weekly_matchups.season_year,
            weekly_matchups.manager_a AS manager_id,
            weekly_matchups.score_b AS opponent_score
           FROM weekly_matchups
          WHERE (weekly_matchups.is_playoff = false)
        UNION ALL
         SELECT weekly_matchups.season_year,
            weekly_matchups.manager_b AS manager_id,
            weekly_matchups.score_a AS opponent_score
           FROM weekly_matchups
          WHERE (weekly_matchups.is_playoff = false)
        )
 SELECT season_year,
    manager_id,
    round(avg(opponent_score), 2) AS sos,
    count(*) AS games_played
   FROM all_sides
  GROUP BY season_year, manager_id;

create or replace view public.v_transaction_values with (security_invoker = true) as
 SELECT season_year,
    transaction_id,
    transaction_type,
    transaction_category,
    team_name,
    transaction_week,
    transaction_at,
    string_agg(
        CASE
            WHEN (item_direction = 'gain'::text) THEN player_name
            ELSE NULL::text
        END, ', '::text ORDER BY player_name) AS add_players,
    string_agg(
        CASE
            WHEN (item_direction = 'gain'::text) THEN "position"
            ELSE NULL::text
        END, ', '::text ORDER BY player_name) AS add_positions,
    string_agg(
        CASE
            WHEN (item_direction = 'loss'::text) THEN player_name
            ELSE NULL::text
        END, ', '::text ORDER BY player_name) AS drop_players,
    string_agg(
        CASE
            WHEN (item_direction = 'loss'::text) THEN "position"
            ELSE NULL::text
        END, ', '::text ORDER BY player_name) AS drop_positions,
    COALESCE(sum(
        CASE
            WHEN (item_direction = 'gain'::text) THEN item_value
            ELSE (0)::numeric
        END), (0)::numeric) AS gain_value,
    COALESCE(sum(
        CASE
            WHEN (item_direction = 'loss'::text) THEN item_value
            ELSE (0)::numeric
        END), (0)::numeric) AS loss_value,
    (COALESCE(sum(
        CASE
            WHEN (item_direction = 'gain'::text) THEN item_value
            ELSE (0)::numeric
        END), (0)::numeric) - COALESCE(sum(
        CASE
            WHEN (item_direction = 'loss'::text) THEN item_value
            ELSE (0)::numeric
        END), (0)::numeric)) AS net_value,
        CASE
            WHEN (transaction_type = 'trade'::text) THEN (COALESCE(sum(
            CASE
                WHEN (item_direction = 'gain'::text) THEN item_value
                ELSE (0)::numeric
            END), (0)::numeric) - COALESCE(sum(
            CASE
                WHEN (item_direction = 'loss'::text) THEN item_value
                ELSE (0)::numeric
            END), (0)::numeric))
            WHEN ((transaction_type = ANY (ARRAY['add'::text, 'add/drop'::text])) AND (COALESCE(sum(
            CASE
                WHEN (item_direction = 'gain'::text) THEN item_value
                ELSE (0)::numeric
            END), (0)::numeric) > (0)::numeric)) THEN COALESCE(sum(
            CASE
                WHEN (item_direction = 'gain'::text) THEN item_value
                ELSE (0)::numeric
            END), (0)::numeric)
            ELSE NULL::numeric
        END AS scored_value,
        CASE
            WHEN (transaction_type = 'trade'::text) THEN true
            WHEN (transaction_type = ANY (ARRAY['add'::text, 'add/drop'::text])) THEN (COALESCE(sum(
            CASE
                WHEN (item_direction = 'gain'::text) THEN item_value
                ELSE (0)::numeric
            END), (0)::numeric) > (0)::numeric)
            ELSE false
        END AS is_meaningful
   FROM fa_transactions t
  GROUP BY season_year, transaction_id, transaction_type, transaction_category, team_name, transaction_week, transaction_at;

create or replace view public.v_weekly_cumulative with (security_invoker = true) as
 WITH all_games AS (
         SELECT weekly_matchups.season_year,
            weekly_matchups.week,
            weekly_matchups.is_playoff,
            weekly_matchups.manager_a AS manager_id,
            weekly_matchups.score_a AS score,
            weekly_matchups.score_b AS opp_score,
                CASE
                    WHEN (weekly_matchups.score_a > weekly_matchups.score_b) THEN 1
                    ELSE 0
                END AS won,
                CASE
                    WHEN (weekly_matchups.score_a < weekly_matchups.score_b) THEN 1
                    ELSE 0
                END AS lost,
            1 AS played,
            abs((weekly_matchups.score_a - weekly_matchups.score_b)) AS margin
           FROM weekly_matchups
          WHERE (weekly_matchups.score_a IS NOT NULL)
        UNION ALL
         SELECT weekly_matchups.season_year,
            weekly_matchups.week,
            weekly_matchups.is_playoff,
            weekly_matchups.manager_b,
            weekly_matchups.score_b,
            weekly_matchups.score_a,
                CASE
                    WHEN (weekly_matchups.score_b > weekly_matchups.score_a) THEN 1
                    ELSE 0
                END AS "case",
                CASE
                    WHEN (weekly_matchups.score_b < weekly_matchups.score_a) THEN 1
                    ELSE 0
                END AS "case",
            1,
            abs((weekly_matchups.score_a - weekly_matchups.score_b)) AS abs
           FROM weekly_matchups
          WHERE (weekly_matchups.score_b IS NOT NULL)
        ), with_ranks AS (
         SELECT g_1.season_year,
            g_1.week,
            g_1.is_playoff,
            g_1.manager_id,
            g_1.score,
            g_1.opp_score,
            g_1.won,
            g_1.lost,
            g_1.played,
            g_1.margin,
            row_number() OVER (PARTITION BY g_1.season_year, g_1.week ORDER BY g_1.score DESC) AS week_rank
           FROM all_games g_1
        )
 SELECT manager_id,
    season_year,
    week,
    is_playoff,
    score,
    opp_score,
    won,
    lost,
    played,
    margin,
    week_rank,
    sum(score) OVER w AS cum_pts,
    sum(opp_score) OVER w AS cum_opp_pts,
    sum(won) OVER w AS cum_wins,
    sum(lost) OVER w AS cum_losses,
    sum(played) OVER w AS cum_played,
        CASE
            WHEN (sum(played) OVER w >= 10) THEN round((((sum(won) OVER w)::numeric * 100.0) / (NULLIF(sum(played) OVER w, 0))::numeric), 2)
            ELSE NULL::numeric
        END AS cum_win_pct,
    sum(
        CASE
            WHEN (NOT is_playoff) THEN ( SELECT count(*) AS count
               FROM all_games g2
              WHERE ((g2.season_year = g.season_year) AND (g2.week = g.week) AND (g2.manager_id <> g.manager_id) AND (g2.score < g.score)))
            ELSE (0)::bigint
        END) OVER w AS cum_ap_wins,
    sum(
        CASE
            WHEN (week_rank = 1) THEN 1
            ELSE 0
        END) OVER w AS cum_high_scores,
    sum(
        CASE
            WHEN (week_rank <= 2) THEN 1
            ELSE 0
        END) OVER w AS cum_top_scores,
    sum(
        CASE
            WHEN (week_rank <= 4) THEN 1
            ELSE 0
        END) OVER w AS cum_top_half,
    sum(
        CASE
            WHEN (week_rank = 8) THEN 1
            ELSE 0
        END) OVER w AS cum_worst_scores,
    sum(
        CASE
            WHEN (week_rank >= 7) THEN 1
            ELSE 0
        END) OVER w AS cum_bottom_scores,
    sum(
        CASE
            WHEN (week_rank >= 5) THEN 1
            ELSE 0
        END) OVER w AS cum_bottom_half,
    sum(
        CASE
            WHEN ((won = 1) AND (margin >= (37)::numeric)) THEN 1
            ELSE 0
        END) OVER w AS cum_blowout_wins,
    sum(
        CASE
            WHEN ((lost = 1) AND (margin >= (37)::numeric)) THEN 1
            ELSE 0
        END) OVER w AS cum_blowout_losses,
    sum(
        CASE
            WHEN ((won = 1) AND (margin <= (10)::numeric)) THEN 1
            ELSE 0
        END) OVER w AS cum_narrow_wins,
    sum(
        CASE
            WHEN ((lost = 1) AND (margin <= (10)::numeric)) THEN 1
            ELSE 0
        END) OVER w AS cum_narrow_losses,
    sum(
        CASE
            WHEN is_playoff THEN won
            ELSE 0
        END) OVER w AS cum_po_wins,
    sum(
        CASE
            WHEN is_playoff THEN lost
            ELSE 0
        END) OVER w AS cum_po_losses,
    sum(
        CASE
            WHEN is_playoff THEN score
            ELSE (0)::numeric
        END) OVER w AS cum_po_pts
   FROM with_ranks g
  WINDOW w AS (PARTITION BY manager_id ORDER BY season_year, week ROWS UNBOUNDED PRECEDING);

create or replace view public.v_weekly_scores with (security_invoker = true) as
 WITH all_scores AS (
         SELECT weekly_matchups.season_year,
            weekly_matchups.week,
            weekly_matchups.is_playoff,
            weekly_matchups.manager_a AS manager_id,
            weekly_matchups.score_a AS score,
            (weekly_matchups.score_a - weekly_matchups.score_b) AS margin,
                CASE
                    WHEN (weekly_matchups.score_a > weekly_matchups.score_b) THEN 1
                    ELSE 0
                END AS won
           FROM weekly_matchups
          WHERE (weekly_matchups.score_a IS NOT NULL)
        UNION ALL
         SELECT weekly_matchups.season_year,
            weekly_matchups.week,
            weekly_matchups.is_playoff,
            weekly_matchups.manager_b,
            weekly_matchups.score_b,
            (weekly_matchups.score_b - weekly_matchups.score_a),
                CASE
                    WHEN (weekly_matchups.score_b > weekly_matchups.score_a) THEN 1
                    ELSE 0
                END AS "case"
           FROM weekly_matchups
          WHERE (weekly_matchups.score_b IS NOT NULL)
        )
 SELECT season_year,
    week,
    is_playoff,
    manager_id,
    score,
    margin,
    won,
    row_number() OVER (PARTITION BY season_year, week ORDER BY score DESC) AS week_rank,
        CASE
            WHEN (row_number() OVER (PARTITION BY season_year, week ORDER BY score DESC) = 1) THEN true
            ELSE false
        END AS is_high_score,
        CASE
            WHEN (row_number() OVER (PARTITION BY season_year, week ORDER BY score DESC) <= 2) THEN true
            ELSE false
        END AS is_top_score,
        CASE
            WHEN (row_number() OVER (PARTITION BY season_year, week ORDER BY score DESC) <= 4) THEN true
            ELSE false
        END AS is_top_half,
        CASE
            WHEN (row_number() OVER (PARTITION BY season_year, week ORDER BY score DESC) >= 5) THEN true
            ELSE false
        END AS is_bottom_half,
        CASE
            WHEN (row_number() OVER (PARTITION BY season_year, week ORDER BY score DESC) >= 7) THEN true
            ELSE false
        END AS is_bottom_score,
        CASE
            WHEN (row_number() OVER (PARTITION BY season_year, week ORDER BY score DESC) = 8) THEN true
            ELSE false
        END AS is_worst_score,
        CASE
            WHEN ((abs(margin) >= (37)::numeric) AND (won = 1)) THEN true
            ELSE false
        END AS is_blowout_win,
        CASE
            WHEN ((abs(margin) >= (37)::numeric) AND (won = 0)) THEN true
            ELSE false
        END AS is_blowout_loss,
        CASE
            WHEN ((abs(margin) <= (10)::numeric) AND (won = 1)) THEN true
            ELSE false
        END AS is_narrow_win,
        CASE
            WHEN ((abs(margin) <= (10)::numeric) AND (won = 0)) THEN true
            ELSE false
        END AS is_narrow_loss
   FROM all_scores;

create or replace view rebuild.games as
 SELECT matchup_id,
    season_year,
    week,
    is_playoff,
    manager_id,
    opponent_id,
    pf,
    pa,
    idx,
    won,
    lost,
    tied,
    margin,
    combined,
    share,
    week_rank,
    allplay_wins,
    allplay_losses,
    week_avg,
    week_median,
    week_teams,
    seed,
    opponent_seed,
    final_rank,
    opponent_final_rank,
    game_type
   FROM rebuild.games_cache;

create or replace view rebuild.lineup_weeks as
 SELECT season_year,
    week,
    idx,
    manager_id,
    pos,
    pts,
    slots
   FROM rebuild.lineup_cache;

create or replace view rebuild.season_facts as
 SELECT r.season_year,
    r.manager_id,
    r.reg_rank,
    r.wins,
    r.losses,
    r.ties,
    (r.points_for)::numeric AS points_for,
    (r.points_against)::numeric AS points_against,
    COALESCE(p.seed, r.reg_rank) AS seed,
    p.final_rank,
    COALESCE((p.final_rank = max(p.final_rank) OVER (PARTITION BY r.season_year)), false) AS is_last,
    ((p.seed IS NOT NULL) AND (p.seed <= s.playoff_teams)) AS made_playoffs
   FROM ((season_results r
     LEFT JOIN playoff_results p ON (((p.season_year = r.season_year) AND (p.manager_id = r.manager_id))))
     JOIN seasons s ON ((s.year = r.season_year)));

create or replace view rebuild.weeks as
 SELECT w.season_year,
    w.week,
    (row_number() OVER (ORDER BY w.season_year, w.week))::integer AS idx,
    s.reg_season_weeks,
    (w.week = max(w.week) OVER (PARTITION BY w.season_year)) AS is_season_end,
    (w.week = s.reg_season_weeks) AS is_reg_end
   FROM (( SELECT DISTINCT weekly_matchups.season_year,
            weekly_matchups.week
           FROM weekly_matchups) w
     JOIN seasons s ON ((s.year = w.season_year)));

-- ===== Level 1 =====
-- (materialized views are created WITH NO DATA; run public.refresh_player_stats()
--  after loading data)

create materialized view public.mv_player_events as
 SELECT
        CASE
            WHEN (d."position" = 'DST'::text) THEN ('DST:'::text || d.player_name)
            WHEN (g.gsis_id IS NOT NULL) THEN g.gsis_id
            ELSE player_name_key(d.player_name)
        END AS player_key,
    d.season_year,
    0 AS week,
    NULL::timestamp without time zone AS event_at,
    'draft'::text AS kind,
    d.manager_id,
    d.round,
    d.overall_pick,
    d.grade4 AS value,
    d.player_name
   FROM (draft_picks d
     LEFT JOIN v_player_espn_gsis g ON ((g.espn_id = d.espn_id)))
UNION ALL
 SELECT
        CASE
            WHEN ((f.player_id ~~ 'DEF%'::text) OR (f."position" = ANY (ARRAY['DEF'::text, 'DST'::text]))) THEN ('DST:'::text || f.player_name)
            WHEN (f.player_id ~~ '00-%'::text) THEN f.player_id
            ELSE player_name_key(f.player_name)
        END AS player_key,
    f.season_year,
    f.transaction_week AS week,
    f.transaction_at AS event_at,
        CASE
            WHEN (f.transaction_type = 'trade'::text) THEN
            CASE f.item_direction
                WHEN 'gain'::text THEN 'trade_in'::text
                ELSE 'trade_out'::text
            END
            ELSE
            CASE f.item_direction
                WHEN 'gain'::text THEN 'add'::text
                ELSE 'drop'::text
            END
        END AS kind,
    f.team_name AS manager_id,
    NULL::integer AS round,
    NULL::integer AS overall_pick,
    f.item_value AS value,
    f.player_name
   FROM fa_transactions f
with no data;

create materialized view public.mv_player_games as
 WITH teams AS (
         SELECT DISTINCT weekly_lineups.player_name
           FROM weekly_lineups
          WHERE (weekly_lineups.slot = 'DST'::text)
        )
 SELECT
        CASE
            WHEN ((l.slot = 'DST'::text) OR ((COALESCE(l.espn_id, ''::text) = ''::text) AND (l.player_name IN ( SELECT teams.player_name
               FROM teams)))) THEN ('DST:'::text || l.player_name)
            WHEN (g.gsis_id IS NOT NULL) THEN g.gsis_id
            ELSE player_name_key(l.player_name)
        END AS player_key,
    l.season_year,
    l.week,
    l.manager_id,
    l.slot,
    l.is_starter,
    COALESCE(l.points, (0)::numeric) AS points,
    l.player_name,
    NULLIF(l.espn_id, ''::text) AS espn_id
   FROM (weekly_lineups l
     LEFT JOIN v_player_espn_gsis g ON (((g.espn_id = NULLIF(l.espn_id, ''::text)) AND (l.slot <> 'DST'::text))))
with no data;

create or replace view public.v_alltime_standings with (security_invoker = true) as
 WITH reg AS (
         SELECT season_results.manager_id,
            count(*) AS seasons,
            sum(season_results.wins) AS reg_wins,
            sum(season_results.losses) AS reg_losses,
            sum(season_results.ties) AS reg_ties,
            round(((sum(season_results.wins))::numeric / (NULLIF(sum(((season_results.wins + season_results.losses) + season_results.ties)), 0))::numeric), 4) AS reg_win_pct,
            round(sum(season_results.points_for), 2) AS total_pf,
            round(sum(season_results.points_against), 2) AS total_pa,
            round(avg(season_results.points_for), 2) AS avg_pf_per_season,
            round((sum(season_results.points_for) / (NULLIF(sum(((season_results.wins + season_results.losses) + season_results.ties)), 0))::numeric), 2) AS avg_pf_per_game,
            sum(season_results.moves) AS total_moves,
            sum(season_results.trades) AS total_trades,
            count(*) FILTER (WHERE (season_results.reg_rank = 1)) AS reg_season_titles,
            count(*) FILTER (WHERE (season_results.reg_rank = 8)) AS last_place_regular,
            count(*) FILTER (WHERE ((season_results.playoff_rank IS NOT NULL) AND (season_results.playoff_rank <= 4))) AS playoff_appearances
           FROM season_results
          GROUP BY season_results.manager_id
        ), matchup_ties AS (
         WITH both_sides AS (
                 SELECT weekly_matchups.manager_a AS manager_id,
                    weekly_matchups.is_playoff,
                        CASE
                            WHEN (weekly_matchups.score_a = weekly_matchups.score_b) THEN 1
                            ELSE 0
                        END AS is_tie
                   FROM weekly_matchups
                UNION ALL
                 SELECT weekly_matchups.manager_b,
                    weekly_matchups.is_playoff,
                        CASE
                            WHEN (weekly_matchups.score_a = weekly_matchups.score_b) THEN 1
                            ELSE 0
                        END AS "case"
                   FROM weekly_matchups
                )
         SELECT both_sides.manager_id,
            sum(
                CASE
                    WHEN (NOT both_sides.is_playoff) THEN both_sides.is_tie
                    ELSE 0
                END) AS reg_ties_actual,
            sum(
                CASE
                    WHEN both_sides.is_playoff THEN both_sides.is_tie
                    ELSE 0
                END) AS po_ties_actual,
            sum(both_sides.is_tie) AS total_ties_actual
           FROM both_sides
          GROUP BY both_sides.manager_id
        ), playoff_wl AS (
         WITH all_sides AS (
                 SELECT m.season_year,
                    m.manager_a AS manager_id,
                        CASE
                            WHEN (m.score_a > m.score_b) THEN 1
                            ELSE 0
                        END AS win,
                        CASE
                            WHEN (m.score_a < m.score_b) THEN 1
                            ELSE 0
                        END AS loss,
                    pr.seed
                   FROM (weekly_matchups m
                     JOIN playoff_results pr ON (((pr.season_year = m.season_year) AND (pr.manager_id = m.manager_a))))
                  WHERE (m.is_playoff = true)
                UNION ALL
                 SELECT m.season_year,
                    m.manager_b,
                        CASE
                            WHEN (m.score_b > m.score_a) THEN 1
                            ELSE 0
                        END AS "case",
                        CASE
                            WHEN (m.score_b < m.score_a) THEN 1
                            ELSE 0
                        END AS "case",
                    pr.seed
                   FROM (weekly_matchups m
                     JOIN playoff_results pr ON (((pr.season_year = m.season_year) AND (pr.manager_id = m.manager_b))))
                  WHERE (m.is_playoff = true)
                )
         SELECT all_sides.manager_id,
            sum(
                CASE
                    WHEN (all_sides.seed <= 4) THEN all_sides.win
                    ELSE 0
                END) AS real_po_wins,
            sum(
                CASE
                    WHEN (all_sides.seed <= 4) THEN all_sides.loss
                    ELSE 0
                END) AS real_po_losses,
            sum(
                CASE
                    WHEN (all_sides.seed >= 5) THEN all_sides.win
                    ELSE 0
                END) AS consol_wins,
            sum(
                CASE
                    WHEN (all_sides.seed >= 5) THEN all_sides.loss
                    ELSE 0
                END) AS consol_losses,
            sum(all_sides.win) AS po_wins,
            sum(all_sides.loss) AS po_losses
           FROM all_sides
          GROUP BY all_sides.manager_id
        ), playoffs AS (
         SELECT playoff_results.manager_id,
            count(*) FILTER (WHERE (playoff_results.final_rank = 1)) AS championships,
            count(*) FILTER (WHERE (playoff_results.final_rank = 2)) AS runner_up,
            count(*) FILTER (WHERE (playoff_results.final_rank = 3)) AS third_place,
            count(*) FILTER (WHERE (playoff_results.final_rank = 8)) AS toiletbowls,
            round(avg((playoff_results.final_rank)::numeric), 2) AS avg_playoff_rank,
            round(sum((COALESCE(playoff_results.week15_pts, (0)::numeric) + COALESCE(playoff_results.week16_pts, (0)::numeric))), 2) AS total_playoff_pts
           FROM playoff_results
          GROUP BY playoff_results.manager_id
        ), ap AS (
         SELECT v_all_play.manager_id,
            sum(v_all_play.ap_wins) AS allplay_wins,
            sum(v_all_play.ap_losses) AS allplay_losses,
            sum(v_all_play.ap_ties) AS allplay_ties,
            round((sum(v_all_play.ap_wins) / NULLIF(sum(((v_all_play.ap_wins + v_all_play.ap_losses) + v_all_play.ap_ties)), (0)::numeric)), 4) AS allplay_win_pct
           FROM v_all_play
          GROUP BY v_all_play.manager_id
        )
 SELECT r.manager_id,
    r.seasons,
    r.reg_wins,
    r.reg_losses,
    COALESCE(mt.reg_ties_actual, (0)::bigint) AS reg_ties,
    r.reg_win_pct,
    COALESCE(pw.real_po_wins, (0)::bigint) AS real_po_wins,
    COALESCE(pw.real_po_losses, (0)::bigint) AS real_po_losses,
    round(((COALESCE(pw.real_po_wins, (0)::bigint))::numeric / (NULLIF((COALESCE(pw.real_po_wins, (0)::bigint) + COALESCE(pw.real_po_losses, (0)::bigint)), 0))::numeric), 4) AS real_po_win_pct,
    COALESCE(pw.consol_wins, (0)::bigint) AS consol_wins,
    COALESCE(pw.consol_losses, (0)::bigint) AS consol_losses,
    round(((COALESCE(pw.consol_wins, (0)::bigint))::numeric / (NULLIF((COALESCE(pw.consol_wins, (0)::bigint) + COALESCE(pw.consol_losses, (0)::bigint)), 0))::numeric), 4) AS consol_win_pct,
    COALESCE(pw.po_wins, (0)::bigint) AS po_wins,
    COALESCE(pw.po_losses, (0)::bigint) AS po_losses,
    COALESCE(mt.po_ties_actual, (0)::bigint) AS po_ties,
    round(((COALESCE(pw.po_wins, (0)::bigint))::numeric / (NULLIF((COALESCE(pw.po_wins, (0)::bigint) + COALESCE(pw.po_losses, (0)::bigint)), 0))::numeric), 4) AS po_win_pct,
    (r.reg_wins + COALESCE(pw.po_wins, (0)::bigint)) AS total_wins,
    (r.reg_losses + COALESCE(pw.po_losses, (0)::bigint)) AS total_losses,
    COALESCE(mt.total_ties_actual, (0)::bigint) AS total_ties,
    round((((r.reg_wins + COALESCE(pw.po_wins, (0)::bigint)))::numeric / (NULLIF(((((r.reg_wins + COALESCE(pw.po_wins, (0)::bigint)) + r.reg_losses) + COALESCE(pw.po_losses, (0)::bigint)) + COALESCE(mt.total_ties_actual, (0)::bigint)), 0))::numeric), 4) AS total_win_pct,
    r.total_pf,
    r.total_pa,
    r.avg_pf_per_season,
    r.avg_pf_per_game,
    ap.allplay_wins,
    ap.allplay_losses,
    ap.allplay_ties,
    ap.allplay_win_pct,
    r.total_moves,
    r.total_trades,
    COALESCE(p.championships, (0)::bigint) AS championships,
    COALESCE(p.runner_up, (0)::bigint) AS runner_up,
    COALESCE(p.third_place, (0)::bigint) AS third_place,
    COALESCE(p.toiletbowls, (0)::bigint) AS toiletbowls,
    r.playoff_appearances,
    r.reg_season_titles,
    r.last_place_regular,
    p.avg_playoff_rank,
    p.total_playoff_pts
   FROM ((((reg r
     LEFT JOIN matchup_ties mt ON ((r.manager_id = mt.manager_id)))
     LEFT JOIN playoff_wl pw ON ((r.manager_id = pw.manager_id)))
     LEFT JOIN playoffs p ON ((r.manager_id = p.manager_id)))
     LEFT JOIN ap ON ((r.manager_id = ap.manager_id)))
  ORDER BY (round((((r.reg_wins + COALESCE(pw.po_wins, (0)::bigint)))::numeric / (NULLIF(((((r.reg_wins + COALESCE(pw.po_wins, (0)::bigint)) + r.reg_losses) + COALESCE(pw.po_losses, (0)::bigint)) + COALESCE(mt.total_ties_actual, (0)::bigint)), 0))::numeric), 4)) DESC;

create or replace view public.v_coach_rank with (security_invoker = true) as
 WITH lineup_norm AS (
         SELECT v_lineup_efficiency.season_year,
            v_lineup_efficiency.manager_id,
            v_lineup_efficiency.lineup_efficiency,
            round(((100.0 * (v_lineup_efficiency.lineup_efficiency - min(v_lineup_efficiency.lineup_efficiency) OVER (PARTITION BY v_lineup_efficiency.season_year))) / NULLIF((max(v_lineup_efficiency.lineup_efficiency) OVER (PARTITION BY v_lineup_efficiency.season_year) - min(v_lineup_efficiency.lineup_efficiency) OVER (PARTITION BY v_lineup_efficiency.season_year)), (0)::numeric)), 1) AS lineup_score_norm
           FROM v_lineup_efficiency
        ), waiver_norm AS (
         SELECT fa_pickups.season_year,
            fa_pickups.manager_id,
            round(avg(fa_pickups.pickup_score), 2) AS avg_pickup_score,
            round(((100.0 * (avg(fa_pickups.pickup_score) - min(avg(fa_pickups.pickup_score)) OVER (PARTITION BY fa_pickups.season_year))) / NULLIF((max(avg(fa_pickups.pickup_score)) OVER (PARTITION BY fa_pickups.season_year) - min(avg(fa_pickups.pickup_score)) OVER (PARTITION BY fa_pickups.season_year)), (0)::numeric)), 1) AS waiver_score_norm
           FROM fa_pickups
          GROUP BY fa_pickups.season_year, fa_pickups.manager_id
        )
 SELECT l.season_year,
    l.manager_id,
    round((l.lineup_efficiency * (100)::numeric), 1) AS lineup_efficiency_pct,
    l.lineup_score_norm,
    COALESCE(w.avg_pickup_score, (0)::numeric) AS avg_pickup_score,
    COALESCE(w.waiver_score_norm, (0)::numeric) AS waiver_score_norm,
    round(((COALESCE(l.lineup_score_norm, (0)::numeric) * 0.6) + (COALESCE(w.waiver_score_norm, (0)::numeric) * 0.4)), 1) AS coach_score
   FROM (lineup_norm l
     LEFT JOIN waiver_norm w ON (((w.season_year = l.season_year) AND (w.manager_id = l.manager_id))));

create or replace view public.v_luck with (security_invoker = true) as
 SELECT sr.season_year,
    sr.manager_id,
    sr.wins AS actual_wins,
    round((ap.ap_win_pct * (((sr.wins + sr.losses) + sr.ties))::numeric), 2) AS expected_wins,
    round(((sr.wins)::numeric - (ap.ap_win_pct * (((sr.wins + sr.losses) + sr.ties))::numeric)), 2) AS luck
   FROM (season_results sr
     JOIN v_all_play ap ON (((sr.season_year = ap.season_year) AND (sr.manager_id = ap.manager_id))));

create or replace view public.v_manager_rank with (security_invoker = true) as
 SELECT season_year,
    manager_id,
    weeks,
    avg_actual_pts,
    avg_max_pts,
    lineup_efficiency
   FROM v_lineup_efficiency;

create or replace view rebuild.lineup_source as
 SELECT l.season_year,
    l.week,
    w.idx,
    l.manager_id,
        CASE
            WHEN (NOT l.is_starter) THEN 'BENCH'::text
            WHEN (l.slot = ANY (ARRAY['RB1'::text, 'RB2'::text])) THEN 'RB'::text
            WHEN (l.slot = ANY (ARRAY['WR1'::text, 'WR2'::text])) THEN 'WR'::text
            ELSE l.slot
        END AS pos,
    sum(l.points) AS pts,
    count(*) AS slots
   FROM (weekly_lineups l
     JOIN rebuild.weeks w ON (((w.season_year = l.season_year) AND (w.week = l.week))))
  GROUP BY l.season_year, l.week, w.idx, l.manager_id,
        CASE
            WHEN (NOT l.is_starter) THEN 'BENCH'::text
            WHEN (l.slot = ANY (ARRAY['RB1'::text, 'RB2'::text])) THEN 'RB'::text
            WHEN (l.slot = ANY (ARRAY['WR1'::text, 'WR2'::text])) THEN 'WR'::text
            ELSE l.slot
        END;

create or replace view rebuild.season_idx as
 SELECT season_year,
    min(idx) FILTER (WHERE (week = 1)) AS start_idx,
    min(idx) FILTER (WHERE is_reg_end) AS reg_end_idx,
    max(idx) AS end_idx
   FROM rebuild.weeks
  GROUP BY season_year;

create or replace view rebuild.standings_weeks as
 SELECT season_year,
    week,
    idx,
    manager_id,
    rank() OVER (PARTITION BY season_year, week ORDER BY wins_td DESC, pf_td DESC) AS standing,
    count(*) OVER (PARTITION BY season_year, week) AS teams
   FROM ( SELECT games.season_year,
            games.week,
            games.idx,
            games.manager_id,
            sum((games.won)::integer) OVER s AS wins_td,
            sum(games.pf) OVER s AS pf_td
           FROM rebuild.games
          WHERE (games.game_type = 'reg'::text)
          WINDOW s AS (PARTITION BY games.season_year, games.manager_id ORDER BY games.week)) g;

-- ===== Level 1 (continued; depends on level 0 objects only) =====

create or replace view public.v_streaks with (security_invoker = true) as
 WITH ordered_games AS (
         SELECT v_weekly_scores.manager_id,
            v_weekly_scores.season_year,
            v_weekly_scores.week,
            v_weekly_scores.is_playoff,
            v_weekly_scores.won,
            v_weekly_scores.is_high_score,
            v_weekly_scores.is_top_score,
            v_weekly_scores.is_top_half,
            row_number() OVER (PARTITION BY v_weekly_scores.manager_id ORDER BY v_weekly_scores.season_year, v_weekly_scores.week) AS game_num
           FROM v_weekly_scores
        ), win_streaks AS (
         SELECT g.manager_id,
            g.won,
            count(*) AS streak_len
           FROM ( SELECT ordered_games.manager_id,
                    ordered_games.won,
                    (ordered_games.game_num - row_number() OVER (PARTITION BY ordered_games.manager_id, ordered_games.won ORDER BY ordered_games.game_num)) AS grp
                   FROM ordered_games) g
          GROUP BY g.manager_id, g.won, g.grp
        ), hs_streaks AS (
         SELECT g.manager_id,
            g.is_high_score,
            count(*) AS streak_len
           FROM ( SELECT ordered_games.manager_id,
                    ordered_games.is_high_score,
                    (ordered_games.game_num - row_number() OVER (PARTITION BY ordered_games.manager_id, ordered_games.is_high_score ORDER BY ordered_games.game_num)) AS grp
                   FROM ordered_games) g
          GROUP BY g.manager_id, g.is_high_score, g.grp
        ), th_streaks AS (
         SELECT g.manager_id,
            g.is_top_half,
            count(*) AS streak_len
           FROM ( SELECT ordered_games.manager_id,
                    ordered_games.is_top_half,
                    (ordered_games.game_num - row_number() OVER (PARTITION BY ordered_games.manager_id, ordered_games.is_top_half ORDER BY ordered_games.game_num)) AS grp
                   FROM ordered_games) g
          GROUP BY g.manager_id, g.is_top_half, g.grp
        ), playoff_seasons AS (
         SELECT season_results.manager_id,
            season_results.season_year,
                CASE
                    WHEN (season_results.playoff_rank <= 4) THEN 1
                    ELSE 0
                END AS made_playoffs
           FROM season_results
        ), playoff_streaks AS (
         SELECT g.manager_id,
            g.made_playoffs,
            count(*) AS streak_len
           FROM ( SELECT playoff_seasons.manager_id,
                    playoff_seasons.made_playoffs,
                    (playoff_seasons.season_year - row_number() OVER (PARTITION BY playoff_seasons.manager_id, playoff_seasons.made_playoffs ORDER BY playoff_seasons.season_year)) AS grp
                   FROM playoff_seasons) g
          GROUP BY g.manager_id, g.made_playoffs, g.grp
        ), champ_seasons AS (
         SELECT sr.manager_id,
            sr.season_year,
                CASE
                    WHEN (sr.championship_finish = 1) THEN 1
                    ELSE 0
                END AS won_champ
           FROM season_results sr
        ), champ_streaks AS (
         SELECT g.manager_id,
            g.won_champ,
            count(*) AS streak_len
           FROM ( SELECT champ_seasons.manager_id,
                    champ_seasons.won_champ,
                    (champ_seasons.season_year - row_number() OVER (PARTITION BY champ_seasons.manager_id, champ_seasons.won_champ ORDER BY champ_seasons.season_year)) AS grp
                   FROM champ_seasons) g
          GROUP BY g.manager_id, g.won_champ, g.grp
        )
 SELECT m.id AS manager_id,
    COALESCE(max(
        CASE
            WHEN (ws.won = 1) THEN ws.streak_len
            ELSE NULL::bigint
        END), (0)::bigint) AS longest_win_streak,
    COALESCE(max(
        CASE
            WHEN (ws.won = 0) THEN ws.streak_len
            ELSE NULL::bigint
        END), (0)::bigint) AS longest_loss_streak,
    COALESCE(max(
        CASE
            WHEN hs.is_high_score THEN hs.streak_len
            ELSE NULL::bigint
        END), (0)::bigint) AS longest_high_score_streak,
    COALESCE(max(
        CASE
            WHEN (NOT hs.is_high_score) THEN hs.streak_len
            ELSE NULL::bigint
        END), (0)::bigint) AS longest_high_score_drought,
    COALESCE(max(
        CASE
            WHEN th.is_top_half THEN th.streak_len
            ELSE NULL::bigint
        END), (0)::bigint) AS longest_top_half_streak,
    COALESCE(max(
        CASE
            WHEN (NOT th.is_top_half) THEN th.streak_len
            ELSE NULL::bigint
        END), (0)::bigint) AS longest_top_half_drought,
    COALESCE(max(
        CASE
            WHEN (ps.made_playoffs = 1) THEN ps.streak_len
            ELSE NULL::bigint
        END), (0)::bigint) AS longest_playoff_streak,
    COALESCE(max(
        CASE
            WHEN (ps.made_playoffs = 0) THEN ps.streak_len
            ELSE NULL::bigint
        END), (0)::bigint) AS longest_playoff_drought,
    COALESCE(max(
        CASE
            WHEN (cs.won_champ = 1) THEN cs.streak_len
            ELSE NULL::bigint
        END), (0)::bigint) AS longest_champ_streak,
    COALESCE(max(
        CASE
            WHEN (cs.won_champ = 0) THEN cs.streak_len
            ELSE NULL::bigint
        END), (0)::bigint) AS longest_champ_drought
   FROM (((((managers m
     LEFT JOIN win_streaks ws ON ((ws.manager_id = m.id)))
     LEFT JOIN hs_streaks hs ON ((hs.manager_id = m.id)))
     LEFT JOIN th_streaks th ON ((th.manager_id = m.id)))
     LEFT JOIN playoff_streaks ps ON ((ps.manager_id = m.id)))
     LEFT JOIN champ_streaks cs ON ((cs.manager_id = m.id)))
  GROUP BY m.id;

create or replace view rebuild.game_streaks as
 WITH f AS (
         SELECT games.manager_id,
            games.idx,
            games.season_year,
            games.week,
            v.flag,
            v.val
           FROM rebuild.games,
            LATERAL ( VALUES ('win'::text,games.won), ('loss'::text,games.lost), ('high_score'::text,(games.week_rank = 1)), ('top_half'::text,(games.week_rank <= (games.week_teams / 2))), ('top_score'::text,(games.week_rank <= 3))) v(flag, val)
        ), islands AS (
         SELECT f.manager_id,
            f.idx,
            f.season_year,
            f.week,
            f.flag,
            f.val,
            (row_number() OVER (PARTITION BY f.manager_id, f.flag ORDER BY f.idx) - row_number() OVER (PARTITION BY f.manager_id, f.flag, f.val ORDER BY f.idx)) AS island
           FROM f
        )
 SELECT manager_id,
    idx,
    season_year,
    week,
    flag,
    val,
    row_number() OVER (PARTITION BY manager_id, flag, val, island ORDER BY idx) AS len
   FROM islands;

create or replace view rebuild.games_source as
 WITH sides AS (
         SELECT m.id AS matchup_id,
            m.season_year,
            m.week,
            m.is_playoff,
            m.manager_a AS manager_id,
            m.manager_b AS opponent_id,
            (m.score_a)::numeric AS pf,
            (m.score_b)::numeric AS pa
           FROM weekly_matchups m
        UNION ALL
         SELECT m.id,
            m.season_year,
            m.week,
            m.is_playoff,
            m.manager_b,
            m.manager_a,
            (m.score_b)::numeric AS score_b,
            (m.score_a)::numeric AS score_a
           FROM weekly_matchups m
        ), week_stats AS (
         SELECT sides.season_year,
            sides.week,
            avg(sides.pf) AS week_avg,
            percentile_cont((0.5)::double precision) WITHIN GROUP (ORDER BY ((sides.pf)::double precision)) AS week_median,
            count(*) AS week_teams
           FROM sides
          GROUP BY sides.season_year, sides.week
        )
 SELECT s.matchup_id,
    s.season_year,
    s.week,
    s.is_playoff,
    s.manager_id,
    s.opponent_id,
    s.pf,
    s.pa,
    w.idx,
    (s.pf > s.pa) AS won,
    (s.pf < s.pa) AS lost,
    (s.pf = s.pa) AS tied,
    (s.pf - s.pa) AS margin,
    (s.pf + s.pa) AS combined,
        CASE
            WHEN ((s.pf + s.pa) > (0)::numeric) THEN (s.pf / (s.pf + s.pa))
            ELSE NULL::numeric
        END AS share,
    (rank() OVER (PARTITION BY s.season_year, s.week ORDER BY s.pf DESC))::integer AS week_rank,
    ((rank() OVER (PARTITION BY s.season_year, s.week ORDER BY s.pf) - 1))::integer AS allplay_wins,
    ((rank() OVER (PARTITION BY s.season_year, s.week ORDER BY s.pf DESC) - 1))::integer AS allplay_losses,
    ws.week_avg,
    ws.week_median,
    (ws.week_teams)::integer AS week_teams,
    me.seed,
    op.seed AS opponent_seed,
    me.final_rank,
    op.final_rank AS opponent_final_rank,
        CASE
            WHEN (NOT s.is_playoff) THEN 'reg'::text
            WHEN ((s.week = (w.reg_season_weeks + 1)) AND (me.seed <= 4) AND (op.seed <= 4)) THEN 'semifinal'::text
            WHEN (s.week = (w.reg_season_weeks + 1)) THEN 'consolation'::text
            WHEN (LEAST(me.final_rank, op.final_rank) = 1) THEN 'final'::text
            WHEN (LEAST(me.final_rank, op.final_rank) = 3) THEN 'third_place'::text
            WHEN (LEAST(me.final_rank, op.final_rank) = 5) THEN 'fifth_place'::text
            ELSE 'toilet_bowl'::text
        END AS game_type
   FROM ((((sides s
     JOIN week_stats ws ON (((ws.season_year = s.season_year) AND (ws.week = s.week))))
     JOIN rebuild.weeks w ON (((w.season_year = s.season_year) AND (w.week = s.week))))
     JOIN rebuild.season_facts me ON (((me.season_year = s.season_year) AND (me.manager_id = s.manager_id))))
     JOIN rebuild.season_facts op ON (((op.season_year = s.season_year) AND (op.manager_id = s.opponent_id))));

-- ===== Level 2 =====

create materialized view public.mv_player_manager_stats as
 SELECT player_key,
    manager_id,
    count(*) AS weeks_rostered,
    count(*) FILTER (WHERE is_starter) AS starts,
    round(sum(points) FILTER (WHERE is_starter), 2) AS starter_points,
    round(avg(points) FILTER (WHERE is_starter), 2) AS avg_start,
    max(points) FILTER (WHERE is_starter) AS best_start,
    count(DISTINCT season_year) AS seasons,
    min(season_year) AS first_season,
    max(season_year) AS last_season
   FROM mv_player_games
  GROUP BY player_key, manager_id
with no data;

create materialized view public.mv_player_manager_teams as
 WITH season_team AS (
         SELECT player_weekly_stats.player_id,
            player_weekly_stats.season,
            mode() WITHIN GROUP (ORDER BY player_weekly_stats.team) AS team
           FROM player_weekly_stats
          WHERE (player_weekly_stats.team IS NOT NULL)
          GROUP BY player_weekly_stats.player_id, player_weekly_stats.season
        ), games AS (
         SELECT g.player_key,
            g.manager_id,
            g.season_year,
            g.week,
            COALESCE(w.team, st.team) AS team
           FROM ((mv_player_games g
             LEFT JOIN player_weekly_stats w ON (((w.player_id = g.player_key) AND (w.season = g.season_year) AND (w.week = g.week) AND (w.season_type = 'REG'::text))))
             LEFT JOIN season_team st ON (((st.player_id = g.player_key) AND (st.season = g.season_year))))
          WHERE (g.player_key ~~ '00-%'::text)
        ), firsts AS (
         SELECT games.player_key,
            games.manager_id,
            games.team,
            min(((games.season_year * 100) + games.week)) AS first_seen
           FROM games
          WHERE (games.team IS NOT NULL)
          GROUP BY games.player_key, games.manager_id, games.team
        )
 SELECT player_key,
    manager_id,
    string_agg(team, '/'::text ORDER BY first_seen) AS teams
   FROM firsts
  GROUP BY player_key, manager_id
with no data;

create or replace view public.v_league_rating with (security_invoker = true) as
 WITH base AS (
         SELECT sr.season_year,
            sr.manager_id,
            sr.reg_rank,
            round(((sr.wins)::numeric / (NULLIF(((sr.wins + sr.losses) + sr.ties), 0))::numeric), 4) AS win_pct,
            ap.ap_win_pct,
            ps.points_share_pct,
            sos.sos,
            lk.luck,
            sr.playoff_rank,
            dg.avg_grade4,
            cr.coach_score
           FROM ((((((season_results sr
             LEFT JOIN v_all_play ap ON (((ap.season_year = sr.season_year) AND (ap.manager_id = sr.manager_id))))
             LEFT JOIN v_points_share ps ON (((ps.season_year = sr.season_year) AND (ps.manager_id = sr.manager_id))))
             LEFT JOIN v_sos sos ON (((sos.season_year = sr.season_year) AND (sos.manager_id = sr.manager_id))))
             LEFT JOIN v_luck lk ON (((lk.season_year = sr.season_year) AND (lk.manager_id = sr.manager_id))))
             LEFT JOIN v_draft_grades dg ON (((dg.season_year = sr.season_year) AND (dg.manager_id = sr.manager_id))))
             LEFT JOIN v_coach_rank cr ON (((cr.season_year = sr.season_year) AND (cr.manager_id = sr.manager_id))))
        )
 SELECT season_year,
    manager_id,
    reg_rank,
    win_pct,
    ap_win_pct,
    points_share_pct,
    sos,
    luck,
    playoff_rank,
    avg_grade4,
    coach_score,
    round(((((COALESCE(win_pct, (0)::numeric) * (30)::numeric) + (COALESCE(ap_win_pct, (0)::numeric) * (25)::numeric)) + (((COALESCE(points_share_pct, (0)::numeric) / (100)::numeric) * (8)::numeric) * (25)::numeric)) + (COALESCE((((9 - COALESCE(playoff_rank, 9)))::numeric / (8)::numeric), (0)::numeric) * (20)::numeric)), 2) AS league_rating
   FROM base;

create or replace view rebuild.season_streaks as
 WITH f AS (
         SELECT sf.manager_id,
            sf.season_year,
            si.end_idx AS idx,
            v.flag,
            v.val
           FROM (rebuild.season_facts sf
             JOIN rebuild.season_idx si USING (season_year)),
            LATERAL ( VALUES ('championship'::text,(sf.final_rank = 1)), ('medal'::text,(sf.final_rank <= 3)), ('playoff_appearance'::text,sf.made_playoffs), ('title_game'::text,(sf.final_rank <= 2)), ('winning_record'::text,(sf.wins > sf.losses))) v(flag, val)
        ), islands AS (
         SELECT f.manager_id,
            f.season_year,
            f.idx,
            f.flag,
            f.val,
            (row_number() OVER (PARTITION BY f.manager_id, f.flag ORDER BY f.season_year) - row_number() OVER (PARTITION BY f.manager_id, f.flag, f.val ORDER BY f.season_year)) AS island
           FROM f
        )
 SELECT manager_id,
    season_year,
    idx,
    flag,
    val,
    row_number() OVER (PARTITION BY manager_id, flag, val, island ORDER BY season_year) AS len
   FROM islands;

-- ===== Level 2 (continued) / Level 3 =====

create or replace view public.v_league_records with (security_invoker = true) as
 WITH base AS (
         SELECT a.manager_id,
            (a.reg_wins + a.po_wins) AS total_wins,
            (a.reg_losses + a.po_losses) AS total_losses,
            a.total_ties,
            a.total_win_pct,
            a.allplay_wins,
            a.allplay_losses,
            a.allplay_win_pct,
            a.total_pf,
            a.total_pa,
            (((a.championships * 3) + (a.runner_up * 2)) + a.third_place) AS medal_score,
            ((a.championships + a.runner_up) + a.third_place) AS total_medals,
            a.championships,
            a.playoff_appearances,
            a.reg_season_titles,
            round(((a.total_pf / NULLIF(( SELECT sum(sr2.points_for) AS sum
                   FROM season_results sr2
                  WHERE (sr2.manager_id = a.manager_id)), (0)::numeric)) * (100)::numeric), 2) AS pf_share_avg
           FROM v_alltime_standings a
        ), luck_alltime AS (
         SELECT v_luck.manager_id,
            round(sum(v_luck.luck), 2) AS total_luck
           FROM v_luck
          GROUP BY v_luck.manager_id
        ), sos_alltime AS (
         SELECT v_sos.manager_id,
            round(avg(v_sos.sos), 2) AS avg_sos
           FROM v_sos
          GROUP BY v_sos.manager_id
        ), weekly_agg AS (
         SELECT v_weekly_scores.manager_id,
            sum(
                CASE
                    WHEN v_weekly_scores.is_high_score THEN 1
                    ELSE 0
                END) AS high_scores,
            sum(
                CASE
                    WHEN v_weekly_scores.is_top_score THEN 1
                    ELSE 0
                END) AS top_scores,
            sum(
                CASE
                    WHEN v_weekly_scores.is_top_half THEN 1
                    ELSE 0
                END) AS top_half_scores,
            sum(
                CASE
                    WHEN v_weekly_scores.is_worst_score THEN 1
                    ELSE 0
                END) AS worst_scores,
            sum(
                CASE
                    WHEN v_weekly_scores.is_bottom_score THEN 1
                    ELSE 0
                END) AS bottom_scores,
            sum(
                CASE
                    WHEN v_weekly_scores.is_bottom_half THEN 1
                    ELSE 0
                END) AS bottom_half_scores,
            sum(
                CASE
                    WHEN v_weekly_scores.is_blowout_win THEN 1
                    ELSE 0
                END) AS blowout_wins,
            sum(
                CASE
                    WHEN v_weekly_scores.is_blowout_loss THEN 1
                    ELSE 0
                END) AS blowout_losses,
            sum(
                CASE
                    WHEN v_weekly_scores.is_narrow_win THEN 1
                    ELSE 0
                END) AS narrow_wins,
            sum(
                CASE
                    WHEN v_weekly_scores.is_narrow_loss THEN 1
                    ELSE 0
                END) AS narrow_losses,
            count(*) AS total_games,
            round((((sum(
                CASE
                    WHEN v_weekly_scores.is_high_score THEN 1
                    ELSE 0
                END))::numeric / (NULLIF(count(*), 0))::numeric) * (100)::numeric), 2) AS high_score_pct,
            round((((sum(
                CASE
                    WHEN v_weekly_scores.is_top_score THEN 1
                    ELSE 0
                END))::numeric / (NULLIF(count(*), 0))::numeric) * (100)::numeric), 2) AS top_score_pct,
            round((((sum(
                CASE
                    WHEN v_weekly_scores.is_top_half THEN 1
                    ELSE 0
                END))::numeric / (NULLIF(count(*), 0))::numeric) * (100)::numeric), 2) AS top_half_pct,
            round((((sum(
                CASE
                    WHEN v_weekly_scores.is_worst_score THEN 1
                    ELSE 0
                END))::numeric / (NULLIF(count(*), 0))::numeric) * (100)::numeric), 2) AS worst_score_pct,
            round((((sum(
                CASE
                    WHEN v_weekly_scores.is_bottom_half THEN 1
                    ELSE 0
                END))::numeric / (NULLIF(count(*), 0))::numeric) * (100)::numeric), 2) AS bottom_half_pct
           FROM v_weekly_scores
          GROUP BY v_weekly_scores.manager_id
        ), playoff_pts AS (
         SELECT playoff_results.manager_id,
            round(sum((COALESCE(playoff_results.week15_pts, (0)::numeric) + COALESCE(playoff_results.week16_pts, (0)::numeric))), 2) AS total_playoff_pts,
            round((sum((COALESCE(playoff_results.week15_pts, (0)::numeric) + COALESCE(playoff_results.week16_pts, (0)::numeric))) / (NULLIF(sum(
                CASE
                    WHEN (playoff_results.week15_pts IS NOT NULL) THEN 1
                    ELSE 0
                END), 0))::numeric), 2) AS avg_playoff_pts_per_appearance
           FROM playoff_results
          GROUP BY playoff_results.manager_id
        ), season_pts_titles AS (
         SELECT achievements.manager_id,
            count(*) AS season_pts_titles
           FROM achievements
          WHERE (achievements.achievement_key = 'season_points_title'::text)
          GROUP BY achievements.manager_id
        ), season_ap_titles AS (
         SELECT achievements.manager_id,
            count(*) AS season_ap_titles
           FROM achievements
          WHERE (achievements.achievement_key = 'season_allplay_title'::text)
          GROUP BY achievements.manager_id
        ), winning_record_seasons AS (
         SELECT season_results.manager_id,
            sum(
                CASE
                    WHEN (season_results.wins > season_results.losses) THEN 1
                    ELSE 0
                END) AS winning_record_seasons,
            sum(
                CASE
                    WHEN (season_results.wins < season_results.losses) THEN 1
                    ELSE 0
                END) AS losing_record_seasons
           FROM season_results
          GROUP BY season_results.manager_id
        )
 SELECT b.manager_id,
    b.total_wins,
    b.total_losses,
    b.total_ties,
    b.total_win_pct,
    b.allplay_wins,
    b.allplay_losses,
    b.allplay_win_pct,
    b.total_pf AS total_points,
    b.total_pa AS total_opp_points,
    w.high_scores,
    w.high_score_pct,
    w.top_scores,
    w.top_score_pct,
    w.top_half_scores,
    w.top_half_pct,
    w.worst_scores,
    w.worst_score_pct,
    w.bottom_scores,
    w.bottom_half_scores,
    w.bottom_half_pct,
    w.blowout_wins,
    w.blowout_losses,
    w.narrow_wins,
    w.narrow_losses,
    l.total_luck,
    s.avg_sos,
    b.reg_season_titles,
    COALESCE(spt.season_pts_titles, (0)::bigint) AS season_pts_titles,
    COALESCE(sat.season_ap_titles, (0)::bigint) AS season_ap_titles,
    wrs.winning_record_seasons,
    wrs.losing_record_seasons,
    b.championships,
    b.medal_score,
    b.total_medals,
    b.playoff_appearances,
    pp.total_playoff_pts,
    pp.avg_playoff_pts_per_appearance
   FROM (((((((base b
     LEFT JOIN luck_alltime l ON ((l.manager_id = b.manager_id)))
     LEFT JOIN sos_alltime s ON ((s.manager_id = b.manager_id)))
     LEFT JOIN weekly_agg w ON ((w.manager_id = b.manager_id)))
     LEFT JOIN playoff_pts pp ON ((pp.manager_id = b.manager_id)))
     LEFT JOIN season_pts_titles spt ON ((spt.manager_id = b.manager_id)))
     LEFT JOIN season_ap_titles sat ON ((sat.manager_id = b.manager_id)))
     LEFT JOIN winning_record_seasons wrs ON ((wrs.manager_id = b.manager_id)))
  ORDER BY b.total_wins DESC;

create materialized view public.mv_player_summary as
 WITH games AS (
         SELECT mv_player_games.player_key,
            count(*) AS weeks_rostered,
            count(*) FILTER (WHERE mv_player_games.is_starter) AS starts,
            round(sum(mv_player_games.points) FILTER (WHERE mv_player_games.is_starter), 2) AS starter_points,
            round(avg(mv_player_games.points) FILTER (WHERE mv_player_games.is_starter), 2) AS avg_start,
            max(mv_player_games.points) FILTER (WHERE mv_player_games.is_starter) AS best_start,
            count(DISTINCT mv_player_games.season_year) AS seasons,
            min(mv_player_games.season_year) AS first_season,
            max(mv_player_games.season_year) AS last_season,
            count(DISTINCT mv_player_games.manager_id) AS managers,
            (array_agg(mv_player_games.player_name ORDER BY mv_player_games.season_year DESC, mv_player_games.week DESC))[1] AS last_name,
            (array_agg(mv_player_games.espn_id ORDER BY mv_player_games.season_year DESC, mv_player_games.week DESC) FILTER (WHERE (mv_player_games.espn_id IS NOT NULL)))[1] AS espn_id,
            mode() WITHIN GROUP (ORDER BY (regexp_replace(mv_player_games.slot, '\\d+$'::text, ''::text))) FILTER (WHERE ((mv_player_games.slot !~~ 'BN%'::text) AND (mv_player_games.slot <> 'FLEX'::text))) AS slot_pos
           FROM mv_player_games
          GROUP BY mv_player_games.player_key
        ), top AS (
         SELECT DISTINCT ON (mv_player_manager_stats.player_key) mv_player_manager_stats.player_key,
            mv_player_manager_stats.manager_id AS top_manager,
            mv_player_manager_stats.weeks_rostered AS top_manager_weeks
           FROM mv_player_manager_stats
          ORDER BY mv_player_manager_stats.player_key, mv_player_manager_stats.weeks_rostered DESC, mv_player_manager_stats.starter_points DESC NULLS LAST
        ), ev AS (
         SELECT mv_player_events.player_key,
            count(*) FILTER (WHERE (mv_player_events.kind = 'draft'::text)) AS times_drafted,
            count(*) FILTER (WHERE (mv_player_events.kind = 'add'::text)) AS adds,
            count(*) FILTER (WHERE (mv_player_events.kind = 'drop'::text)) AS drops,
            count(*) FILTER (WHERE (mv_player_events.kind = 'trade_in'::text)) AS trades,
            (array_agg(mv_player_events.player_name ORDER BY mv_player_events.season_year DESC))[1] AS ev_name
           FROM mv_player_events
          GROUP BY mv_player_events.player_key
        )
 SELECT k.player_key,
    COALESCE(p.display_name, g.last_name, e.ev_name) AS player_name,
        CASE
            WHEN (k.player_key ~~ 'DST:%'::text) THEN 'DST'::text
            ELSE COALESCE(NULLIF(p."position", ''::text), g.slot_pos)
        END AS "position",
    p.headshot,
    COALESCE(g.espn_id, p.espn_id) AS espn_id,
    p.latest_team,
    COALESCE(g.weeks_rostered, (0)::bigint) AS weeks_rostered,
    COALESCE(g.starts, (0)::bigint) AS starts,
    COALESCE(g.starter_points, (0)::numeric) AS starter_points,
    g.avg_start,
    g.best_start,
    COALESCE(g.seasons, (0)::bigint) AS seasons,
    g.first_season,
    g.last_season,
    COALESCE(g.managers, (0)::bigint) AS managers,
    t.top_manager,
    t.top_manager_weeks,
    COALESCE(e.times_drafted, (0)::bigint) AS times_drafted,
    COALESCE(e.adds, (0)::bigint) AS adds,
    COALESCE(e.drops, (0)::bigint) AS drops,
    COALESCE(e.trades, (0)::bigint) AS trades
   FROM ((((( SELECT mv_player_games.player_key
           FROM mv_player_games
        UNION
         SELECT mv_player_events.player_key
           FROM mv_player_events) k
     LEFT JOIN games g USING (player_key))
     LEFT JOIN top t USING (player_key))
     LEFT JOIN ev e USING (player_key))
     LEFT JOIN players p ON ((p.gsis_id = k.player_key)))
with no data;

create or replace view public.v_season_records with (security_invoker = true) as
 WITH weekly_season AS (
         SELECT v_weekly_scores.season_year,
            v_weekly_scores.manager_id,
            sum(
                CASE
                    WHEN v_weekly_scores.is_high_score THEN 1
                    ELSE 0
                END) AS high_scores,
            sum(
                CASE
                    WHEN v_weekly_scores.is_top_score THEN 1
                    ELSE 0
                END) AS top_scores,
            sum(
                CASE
                    WHEN v_weekly_scores.is_top_half THEN 1
                    ELSE 0
                END) AS top_half_scores,
            sum(
                CASE
                    WHEN v_weekly_scores.is_worst_score THEN 1
                    ELSE 0
                END) AS worst_scores,
            sum(
                CASE
                    WHEN v_weekly_scores.is_bottom_score THEN 1
                    ELSE 0
                END) AS bottom_scores,
            sum(
                CASE
                    WHEN v_weekly_scores.is_bottom_half THEN 1
                    ELSE 0
                END) AS bottom_half_scores,
            sum(
                CASE
                    WHEN v_weekly_scores.is_blowout_win THEN 1
                    ELSE 0
                END) AS blowout_wins,
            sum(
                CASE
                    WHEN v_weekly_scores.is_blowout_loss THEN 1
                    ELSE 0
                END) AS blowout_losses,
            sum(
                CASE
                    WHEN v_weekly_scores.is_narrow_win THEN 1
                    ELSE 0
                END) AS narrow_wins,
            sum(
                CASE
                    WHEN v_weekly_scores.is_narrow_loss THEN 1
                    ELSE 0
                END) AS narrow_losses
           FROM v_weekly_scores
          GROUP BY v_weekly_scores.season_year, v_weekly_scores.manager_id
        )
 SELECT sr.season_year,
    sr.manager_id,
    sr.wins,
    sr.losses,
    sr.ties,
    sr.points_for,
    sr.points_against,
    (sr.points_for - sr.points_against) AS point_diff,
    ap.ap_wins,
    ap.ap_losses,
    ap.ap_win_pct,
    lk.luck,
    lk.expected_wins,
    sos.sos,
    ps.points_share_pct,
    lr.league_rating,
    ws.high_scores,
    ws.top_scores,
    ws.top_half_scores,
    ws.worst_scores,
    ws.bottom_scores,
    ws.bottom_half_scores,
    ws.blowout_wins,
    ws.blowout_losses,
    ws.narrow_wins,
    ws.narrow_losses,
    sr.playoff_rank,
    sr.championship_finish
   FROM ((((((season_results sr
     LEFT JOIN v_all_play ap ON (((ap.season_year = sr.season_year) AND (ap.manager_id = sr.manager_id))))
     LEFT JOIN v_luck lk ON (((lk.season_year = sr.season_year) AND (lk.manager_id = sr.manager_id))))
     LEFT JOIN v_sos sos ON (((sos.season_year = sr.season_year) AND (sos.manager_id = sr.manager_id))))
     LEFT JOIN v_points_share ps ON (((ps.season_year = sr.season_year) AND (ps.manager_id = sr.manager_id))))
     LEFT JOIN v_league_rating lr ON (((lr.season_year = sr.season_year) AND (lr.manager_id = sr.manager_id))))
     LEFT JOIN weekly_season ws ON (((ws.season_year = sr.season_year) AND (ws.manager_id = sr.manager_id))));

create or replace view public.v_season_tiers with (security_invoker = true) as
 SELECT season_year,
    manager_id,
    league_rating,
    ntile(8) OVER (ORDER BY league_rating DESC) AS tier_num,
        CASE ntile(8) OVER (ORDER BY league_rating DESC)
            WHEN 1 THEN 'diamond_season'::text
            WHEN 2 THEN 'gold_season'::text
            WHEN 3 THEN 'silver_season'::text
            WHEN 4 THEN 'bronze_season'::text
            WHEN 5 THEN 'iron_season'::text
            WHEN 6 THEN 'wood_season'::text
            ELSE 'clay_season'::text
        END AS tier_key
   FROM v_league_rating
  WHERE (league_rating IS NOT NULL);

create or replace view rebuild.achievements_calc as
 WITH complete AS (
         SELECT DISTINCT playoff_results.season_year
           FROM playoff_results
        ), g AS (
         SELECT games_source.matchup_id,
            games_source.season_year,
            games_source.week,
            games_source.is_playoff,
            games_source.manager_id,
            games_source.opponent_id,
            games_source.pf,
            games_source.pa,
            games_source.idx,
            games_source.won,
            games_source.lost,
            games_source.tied,
            games_source.margin,
            games_source.combined,
            games_source.share,
            games_source.week_rank,
            games_source.allplay_wins,
            games_source.allplay_losses,
            games_source.week_avg,
            games_source.week_median,
            games_source.week_teams,
            games_source.seed,
            games_source.opponent_seed,
            games_source.final_rank,
            games_source.opponent_final_rank,
            games_source.game_type
           FROM rebuild.games_source
        ), reg AS (
         SELECT g.matchup_id,
            g.season_year,
            g.week,
            g.is_playoff,
            g.manager_id,
            g.opponent_id,
            g.pf,
            g.pa,
            g.idx,
            g.won,
            g.lost,
            g.tied,
            g.margin,
            g.combined,
            g.share,
            g.week_rank,
            g.allplay_wins,
            g.allplay_losses,
            g.week_avg,
            g.week_median,
            g.week_teams,
            g.seed,
            g.opponent_seed,
            g.final_rank,
            g.opponent_final_rank,
            g.game_type
           FROM g
          WHERE (g.game_type = 'reg'::text)
        ), sf AS (
         SELECT season_facts.season_year,
            season_facts.manager_id,
            season_facts.reg_rank,
            season_facts.wins,
            season_facts.losses,
            season_facts.ties,
            season_facts.points_for,
            season_facts.points_against,
            season_facts.seed,
            season_facts.final_rank,
            season_facts.is_last,
            season_facts.made_playoffs
           FROM rebuild.season_facts
          WHERE (season_facts.season_year IN ( SELECT complete.season_year
                   FROM complete))
        ), champ AS (
         SELECT sf.season_year,
            sf.manager_id
           FROM sf
          WHERE (sf.final_rank = 1)
        ), season_reg AS (
         SELECT reg.season_year,
            reg.manager_id,
            sum(reg.pf) AS pf,
            sum(reg.pa) AS pa,
            avg(reg.pa) AS opp_avg,
            sum(reg.allplay_wins) AS apw,
            sum(reg.allplay_losses) AS apl,
            avg(((reg.week_rank <= (reg.week_teams / 2)))::integer) AS top_half_share
           FROM reg
          WHERE (reg.season_year IN ( SELECT complete.season_year
                   FROM complete))
          GROUP BY reg.season_year, reg.manager_id
        ), season_rank AS (
         SELECT s.season_year,
            s.manager_id,
            s.pf,
            s.pa,
            s.opp_avg,
            s.apw,
            s.apl,
            s.top_half_share,
            rank() OVER (PARTITION BY s.season_year ORDER BY s.pf DESC) AS pf_rank,
            rank() OVER (PARTITION BY s.season_year ORDER BY s.pf) AS pf_rank_low,
            rank() OVER (PARTITION BY s.season_year ORDER BY s.apw DESC) AS ap_rank,
            rank() OVER (PARTITION BY s.season_year ORDER BY s.apw) AS ap_rank_low,
            rank() OVER (PARTITION BY s.season_year ORDER BY s.opp_avg) AS easy_rank,
            rank() OVER (PARTITION BY s.season_year ORDER BY s.opp_avg DESC) AS hard_rank
           FROM season_reg s
        ), luck AS (
         SELECT l.season_year,
            l.manager_id,
            l.luck,
            rank() OVER (PARTITION BY l.season_year ORDER BY l.luck DESC) AS best,
            rank() OVER (PARTITION BY l.season_year ORDER BY l.luck) AS worst
           FROM v_luck l
          WHERE (l.season_year IN ( SELECT complete.season_year
                   FROM complete))
        ), coach AS (
         SELECT c.season_year,
            c.manager_id,
            c.coach_score,
            rank() OVER (PARTITION BY c.season_year ORDER BY c.coach_score DESC) AS best,
            rank() OVER (PARTITION BY c.season_year ORDER BY c.coach_score) AS worst
           FROM v_coach_rank c
          WHERE (c.season_year IN ( SELECT complete.season_year
                   FROM complete))
        ), draft AS (
         SELECT d.season_year,
            d.manager_id,
            d.avg_grade4 AS g,
            rank() OVER (PARTITION BY d.season_year ORDER BY d.avg_grade4 DESC) AS best,
            rank() OVER (PARTITION BY d.season_year ORDER BY d.avg_grade4) AS worst
           FROM v_draft_grades d
          WHERE (d.season_year IN ( SELECT complete.season_year
                   FROM complete))
        ), rating AS (
         SELECT r.season_year,
            r.manager_id,
            r.league_rating AS score,
            ntile(8) OVER (ORDER BY r.league_rating DESC) AS eighth
           FROM v_league_rating r
          WHERE (r.season_year IN ( SELECT complete.season_year
                   FROM complete))
        ), weekly AS (
         SELECT g.season_year,
            g.manager_id,
            count(*) FILTER (WHERE (g.week_rank = 1)) AS high_scores
           FROM g
          GROUP BY g.season_year, g.manager_id
        ), marg AS (
         SELECT reg.matchup_id,
            reg.season_year,
            reg.week,
            reg.is_playoff,
            reg.manager_id,
            reg.opponent_id,
            reg.pf,
            reg.pa,
            reg.idx,
            reg.won,
            reg.lost,
            reg.tied,
            reg.margin,
            reg.combined,
            reg.share,
            reg.week_rank,
            reg.allplay_wins,
            reg.allplay_losses,
            reg.week_avg,
            reg.week_median,
            reg.week_teams,
            reg.seed,
            reg.opponent_seed,
            reg.final_rank,
            reg.opponent_final_rank,
            reg.game_type,
            rank() OVER (PARTITION BY reg.season_year ORDER BY reg.margin) AS closest,
            rank() OVER (PARTITION BY reg.season_year ORDER BY reg.margin DESC) AS biggest,
            rank() OVER (PARTITION BY reg.season_year ORDER BY reg.pf DESC) AS top_score
           FROM reg
          WHERE reg.won
        ), comb AS (
         SELECT g.matchup_id,
            g.season_year,
            g.week,
            g.is_playoff,
            g.manager_id,
            g.opponent_id,
            g.pf,
            g.pa,
            g.idx,
            g.won,
            g.lost,
            g.tied,
            g.margin,
            g.combined,
            g.share,
            g.week_rank,
            g.allplay_wins,
            g.allplay_losses,
            g.week_avg,
            g.week_median,
            g.week_teams,
            g.seed,
            g.opponent_seed,
            g.final_rank,
            g.opponent_final_rank,
            g.game_type,
            rank() OVER (PARTITION BY g.season_year ORDER BY g.combined DESC) AS high_comb,
            rank() OVER (PARTITION BY g.season_year ORDER BY g.combined) AS low_comb
           FROM g
          WHERE (g.manager_id < g.opponent_id)
        ), wk AS (
         SELECT reg.matchup_id,
            reg.season_year,
            reg.week,
            reg.is_playoff,
            reg.manager_id,
            reg.opponent_id,
            reg.pf,
            reg.pa,
            reg.idx,
            reg.won,
            reg.lost,
            reg.tied,
            reg.margin,
            reg.combined,
            reg.share,
            reg.week_rank,
            reg.allplay_wins,
            reg.allplay_losses,
            reg.week_avg,
            reg.week_median,
            reg.week_teams,
            reg.seed,
            reg.opponent_seed,
            reg.final_rank,
            reg.opponent_final_rank,
            reg.game_type,
            rank() OVER (PARTITION BY reg.season_year, reg.week ORDER BY reg.pf DESC) AS r_desc,
            rank() OVER (PARTITION BY reg.season_year, reg.week ORDER BY reg.pf) AS r_asc
           FROM reg
        ), streaks AS (
         SELECT sf.manager_id,
            sf.season_year,
            (sf.wins > sf.losses) AS good,
            (sf.season_year - row_number() OVER (PARTITION BY sf.manager_id, (sf.wins > sf.losses) ORDER BY sf.season_year)) AS grp
           FROM sf
        ), win_streaks AS (
         SELECT streaks.manager_id,
            max(streaks.season_year) AS last_year,
            count(*) AS len
           FROM streaks
          WHERE streaks.good
          GROUP BY streaks.manager_id, streaks.grp
         HAVING (count(*) >= 3)
        )
 SELECT sf.season_year,
    sf.manager_id,
    'champion'::text AS achievement_key,
    NULL::numeric AS value,
    NULL::text AS notes,
    NULL::integer AS matchup_id
   FROM sf
  WHERE (sf.final_rank = 1)
UNION ALL
 SELECT sf.season_year,
    sf.manager_id,
    'runner_up'::text AS achievement_key,
    NULL::numeric AS value,
    NULL::text AS notes,
    NULL::integer AS matchup_id
   FROM sf
  WHERE (sf.final_rank = 2)
UNION ALL
 SELECT sf.season_year,
    sf.manager_id,
    'third_place'::text AS achievement_key,
    NULL::numeric AS value,
    NULL::text AS notes,
    NULL::integer AS matchup_id
   FROM sf
  WHERE (sf.final_rank = 3)
UNION ALL
 SELECT sf.season_year,
    sf.manager_id,
    'the_worst'::text AS achievement_key,
    NULL::numeric AS value,
    NULL::text AS notes,
    NULL::integer AS matchup_id
   FROM sf
  WHERE sf.is_last
UNION ALL
 SELECT sf.season_year,
    sf.manager_id,
    'season_title'::text AS achievement_key,
    NULL::numeric AS value,
    NULL::text AS notes,
    NULL::integer AS matchup_id
   FROM sf
  WHERE (sf.reg_rank = 1)
UNION ALL
 SELECT season_rank.season_year,
    season_rank.manager_id,
    'season_points_title'::text AS achievement_key,
    round(season_rank.pf, 2) AS value,
    NULL::text AS notes,
    NULL::integer AS matchup_id
   FROM season_rank
  WHERE (season_rank.pf_rank = 1)
UNION ALL
 SELECT season_rank.season_year,
    season_rank.manager_id,
    'season_allplay_title'::text AS achievement_key,
    round(((season_rank.apw)::numeric / (NULLIF((season_rank.apw + season_rank.apl), 0))::numeric), 2) AS value,
    NULL::text AS notes,
    NULL::integer AS matchup_id
   FROM season_rank
  WHERE (season_rank.ap_rank = 1)
UNION ALL
 SELECT s.season_year,
    s.manager_id,
    'triple_crown'::text AS achievement_key,
    NULL::numeric AS value,
    NULL::text AS notes,
    NULL::integer AS matchup_id
   FROM (sf s
     JOIN season_rank r USING (season_year, manager_id))
  WHERE ((s.reg_rank = 1) AND (r.pf_rank = 1) AND (r.ap_rank = 1))
UNION ALL
 SELECT s.season_year,
    s.manager_id,
    'grand_slam'::text AS achievement_key,
    NULL::numeric AS value,
    NULL::text AS notes,
    NULL::integer AS matchup_id
   FROM (sf s
     JOIN season_rank r USING (season_year, manager_id))
  WHERE ((s.reg_rank = 1) AND (r.pf_rank = 1) AND (r.ap_rank = 1) AND (s.final_rank = 1))
UNION ALL
 SELECT s.season_year,
    s.manager_id,
    'trash_trifecta'::text AS achievement_key,
    NULL::numeric AS value,
    NULL::text AS notes,
    NULL::integer AS matchup_id
   FROM (sf s
     JOIN season_rank r USING (season_year, manager_id))
  WHERE (s.is_last AND (r.pf_rank_low = 1) AND (r.ap_rank_low = 1))
UNION ALL
 SELECT s.season_year,
    s.manager_id,
    v.k AS achievement_key,
    NULL::numeric AS value,
    NULL::text AS notes,
    NULL::integer AS matchup_id
   FROM (sf s
     JOIN sf p ON (((p.manager_id = s.manager_id) AND (p.season_year = (s.season_year - 1))))),
    LATERAL ( VALUES ('back_to_back_champ'::text,((p.final_rank = 1) AND (s.final_rank = 1))), ('silverback_to_back'::text,((p.final_rank = 2) AND (s.final_rank = 2))), ('still_the_worst'::text,(p.is_last AND s.is_last)), ('icarus_award'::text,((p.final_rank = 1) AND s.is_last)), ('phoenix_award'::text,(p.is_last AND (s.final_rank = 1)))) v(k, ok)
  WHERE v.ok
UNION ALL
 SELECT c.season_year,
    c.manager_id,
    'against_the_odds'::text AS achievement_key,
    l.luck AS value,
    NULL::text AS notes,
    NULL::integer AS matchup_id
   FROM (champ c
     JOIN luck l USING (season_year, manager_id))
  WHERE (l.worst = 1)
UNION ALL
 SELECT c.season_year,
    c.manager_id,
    'fortune_favored'::text AS achievement_key,
    l.luck AS value,
    NULL::text AS notes,
    NULL::integer AS matchup_id
   FROM (champ c
     JOIN luck l USING (season_year, manager_id))
  WHERE (l.best = 1)
UNION ALL
 SELECT c.season_year,
    c.manager_id,
    'cupcake_champion'::text AS achievement_key,
    round(r.opp_avg, 2) AS value,
    NULL::text AS notes,
    NULL::integer AS matchup_id
   FROM (champ c
     JOIN season_rank r USING (season_year, manager_id))
  WHERE (r.easy_rank = 1)
UNION ALL
 SELECT c.season_year,
    c.manager_id,
    'heavyweight_champion'::text AS achievement_key,
    round(r.opp_avg, 2) AS value,
    NULL::text AS notes,
    NULL::integer AS matchup_id
   FROM (champ c
     JOIN season_rank r USING (season_year, manager_id))
  WHERE (r.hard_rank = 1)
UNION ALL
 SELECT c.season_year,
    c.manager_id,
    'draft_king'::text AS achievement_key,
    NULL::numeric AS value,
    NULL::text AS notes,
    NULL::integer AS matchup_id
   FROM (champ c
     JOIN draft d USING (season_year, manager_id))
  WHERE (d.best = 1)
UNION ALL
 SELECT c.season_year,
    c.manager_id,
    'optimus_prime'::text AS achievement_key,
    NULL::numeric AS value,
    NULL::text AS notes,
    NULL::integer AS matchup_id
   FROM (champ c
     JOIN coach k USING (season_year, manager_id))
  WHERE (k.best = 1)
UNION ALL
 SELECT luck.season_year,
    luck.manager_id,
    'cursed'::text AS achievement_key,
    luck.luck AS value,
    NULL::text AS notes,
    NULL::integer AS matchup_id
   FROM luck
  WHERE (luck.worst = 1)
UNION ALL
 SELECT luck.season_year,
    luck.manager_id,
    'lady_luck'::text AS achievement_key,
    luck.luck AS value,
    NULL::text AS notes,
    NULL::integer AS matchup_id
   FROM luck
  WHERE (luck.best = 1)
UNION ALL
 SELECT season_rank.season_year,
    season_rank.manager_id,
    'the_cupcake'::text AS achievement_key,
    round(season_rank.opp_avg, 2) AS value,
    NULL::text AS notes,
    NULL::integer AS matchup_id
   FROM season_rank
  WHERE (season_rank.easy_rank = 1)
UNION ALL
 SELECT season_rank.season_year,
    season_rank.manager_id,
    'the_gauntlet'::text AS achievement_key,
    round(season_rank.opp_avg, 2) AS value,
    NULL::text AS notes,
    NULL::integer AS matchup_id
   FROM season_rank
  WHERE (season_rank.hard_rank = 1)
UNION ALL
 SELECT season_reg.season_year,
    season_reg.manager_id,
    'average_joe'::text AS achievement_key,
    0.5 AS value,
    NULL::text AS notes,
    NULL::integer AS matchup_id
   FROM season_reg
  WHERE (season_reg.apw = season_reg.apl)
UNION ALL
 SELECT season_reg.season_year,
    season_reg.manager_id,
    'even_steven'::text AS achievement_key,
    round(abs((season_reg.pf - season_reg.pa)), 2) AS value,
    NULL::text AS notes,
    NULL::integer AS matchup_id
   FROM season_reg
  WHERE (abs((season_reg.pf - season_reg.pa)) < (10)::numeric)
UNION ALL
 SELECT sf.season_year,
    sf.manager_id,
    'goose_egg'::text AS achievement_key,
    NULL::numeric AS value,
    NULL::text AS notes,
    NULL::integer AS matchup_id
   FROM sf
  WHERE (sf.wins = 0)
UNION ALL
 SELECT season_reg.season_year,
    season_reg.manager_id,
    'top_half_100pct'::text AS achievement_key,
    100 AS value,
    NULL::text AS notes,
    NULL::integer AS matchup_id
   FROM season_reg
  WHERE (season_reg.top_half_share = (1)::numeric)
UNION ALL
 SELECT season_reg.season_year,
    season_reg.manager_id,
    'top_half_75pct'::text AS achievement_key,
    round(((100)::numeric * season_reg.top_half_share), 1) AS value,
    NULL::text AS notes,
    NULL::integer AS matchup_id
   FROM season_reg
  WHERE (season_reg.top_half_share >= 0.75)
UNION ALL
 SELECT season_reg.season_year,
    season_reg.manager_id,
    'bottom_half_75pct'::text AS achievement_key,
    round(((100)::numeric * ((1)::numeric - season_reg.top_half_share)), 1) AS value,
    NULL::text AS notes,
    NULL::integer AS matchup_id
   FROM season_reg
  WHERE (((1)::numeric - season_reg.top_half_share) >= 0.75)
UNION ALL
 SELECT weekly.season_year,
    weekly.manager_id,
    'season_high_scores_5'::text AS achievement_key,
    weekly.high_scores AS value,
    NULL::text AS notes,
    NULL::integer AS matchup_id
   FROM weekly
  WHERE ((weekly.high_scores)::numeric >= rebuild.setting('high_scores_season'::text))
UNION ALL
 SELECT win_streaks.last_year AS season_year,
    win_streaks.manager_id,
    'winning_record_streak'::text AS achievement_key,
    win_streaks.len AS value,
    NULL::text AS notes,
    NULL::integer AS matchup_id
   FROM win_streaks
UNION ALL
 SELECT rating.season_year,
    rating.manager_id,
        CASE rating.eighth
            WHEN 1 THEN 'diamond_season'::text
            WHEN 2 THEN 'gold_season'::text
            WHEN 3 THEN 'silver_season'::text
            WHEN 4 THEN 'bronze_season'::text
            WHEN 5 THEN 'iron_season'::text
            WHEN 6 THEN 'wood_season'::text
            ELSE 'clay_season'::text
        END AS achievement_key,
    round(rating.score, 2) AS value,
    NULL::text AS notes,
    NULL::integer AS matchup_id
   FROM rating
UNION ALL
 SELECT draft.season_year,
    draft.manager_id,
    'the_mastermind'::text AS achievement_key,
    round(draft.g, 2) AS value,
    NULL::text AS notes,
    NULL::integer AS matchup_id
   FROM draft
  WHERE (draft.best = 1)
UNION ALL
 SELECT draft.season_year,
    draft.manager_id,
    'the_madman'::text AS achievement_key,
    round(draft.g, 2) AS value,
    NULL::text AS notes,
    NULL::integer AS matchup_id
   FROM draft
  WHERE (draft.worst = 1)
UNION ALL
 SELECT coach.season_year,
    coach.manager_id,
    'the_general'::text AS achievement_key,
    round(coach.coach_score, 2) AS value,
    NULL::text AS notes,
    NULL::integer AS matchup_id
   FROM coach
  WHERE (coach.best = 1)
UNION ALL
 SELECT coach.season_year,
    coach.manager_id,
    'the_mascot'::text AS achievement_key,
    round(coach.coach_score, 2) AS value,
    NULL::text AS notes,
    NULL::integer AS matchup_id
   FROM coach
  WHERE (coach.worst = 1)
UNION ALL
 SELECT coach.season_year,
    coach.manager_id,
    'the_tactician'::text AS achievement_key,
    round(coach.coach_score, 2) AS value,
    NULL::text AS notes,
    NULL::integer AS matchup_id
   FROM coach
  WHERE (coach.coach_score >= rebuild.setting('tactician_score'::text))
UNION ALL
 SELECT marg.season_year,
    marg.manager_id,
    'thread_the_needle'::text AS achievement_key,
    round(marg.margin, 2) AS value,
    ('vs '::text || marg.opponent_id) AS notes,
    marg.matchup_id
   FROM marg
  WHERE (marg.closest = 1)
UNION ALL
 SELECT marg.season_year,
    marg.opponent_id AS manager_id,
    'heartbreaker'::text AS achievement_key,
    round(marg.margin, 2) AS value,
    ('vs '::text || marg.manager_id) AS notes,
    marg.matchup_id
   FROM marg
  WHERE (marg.closest = 1)
UNION ALL
 SELECT marg.season_year,
    marg.manager_id,
    'massacre'::text AS achievement_key,
    round(marg.margin, 2) AS value,
    ('vs '::text || marg.opponent_id) AS notes,
    marg.matchup_id
   FROM marg
  WHERE (marg.biggest = 1)
UNION ALL
 SELECT marg.season_year,
    marg.opponent_id AS manager_id,
    'the_bye_week'::text AS achievement_key,
    round(marg.margin, 2) AS value,
    ('vs '::text || marg.manager_id) AS notes,
    marg.matchup_id
   FROM marg
  WHERE (marg.biggest = 1)
UNION ALL
 SELECT t.season_year,
    t.manager_id,
    'peak_performance'::text AS achievement_key,
    round(t.pf, 2) AS value,
    ('vs '::text || t.opponent_id) AS notes,
    t.matchup_id
   FROM ( SELECT reg.matchup_id,
            reg.season_year,
            reg.week,
            reg.is_playoff,
            reg.manager_id,
            reg.opponent_id,
            reg.pf,
            reg.pa,
            reg.idx,
            reg.won,
            reg.lost,
            reg.tied,
            reg.margin,
            reg.combined,
            reg.share,
            reg.week_rank,
            reg.allplay_wins,
            reg.allplay_losses,
            reg.week_avg,
            reg.week_median,
            reg.week_teams,
            reg.seed,
            reg.opponent_seed,
            reg.final_rank,
            reg.opponent_final_rank,
            reg.game_type,
            rank() OVER (PARTITION BY reg.season_year ORDER BY reg.pf DESC) AS r
           FROM reg) t
  WHERE (t.r = 1)
UNION ALL
 SELECT reg.season_year,
    reg.manager_id,
    'micro_victory'::text AS achievement_key,
    round(reg.margin, 2) AS value,
    ('vs '::text || reg.opponent_id) AS notes,
    reg.matchup_id
   FROM reg
  WHERE (reg.won AND (reg.margin < rebuild.setting('micro_margin'::text)))
UNION ALL
 SELECT reg.season_year,
    reg.opponent_id AS manager_id,
    'micro_defeat'::text AS achievement_key,
    round(reg.margin, 2) AS value,
    ('vs '::text || reg.manager_id) AS notes,
    reg.matchup_id
   FROM reg
  WHERE (reg.won AND (reg.margin < rebuild.setting('micro_margin'::text)))
UNION ALL
 SELECT reg.season_year,
    reg.manager_id,
    'small_victory'::text AS achievement_key,
    round(reg.margin, 2) AS value,
    ('vs '::text || reg.opponent_id) AS notes,
    reg.matchup_id
   FROM reg
  WHERE (reg.won AND (reg.margin >= rebuild.setting('micro_margin'::text)) AND (reg.margin < rebuild.setting('small_margin'::text)))
UNION ALL
 SELECT reg.season_year,
    reg.opponent_id AS manager_id,
    'small_defeat'::text AS achievement_key,
    round(reg.margin, 2) AS value,
    ('vs '::text || reg.manager_id) AS notes,
    reg.matchup_id
   FROM reg
  WHERE (reg.won AND (reg.margin >= rebuild.setting('micro_margin'::text)) AND (reg.margin < rebuild.setting('small_margin'::text)))
UNION ALL
 SELECT reg.season_year,
    reg.manager_id,
    'double_up'::text AS achievement_key,
    round((reg.pf / reg.pa), 2) AS value,
    ('vs '::text || reg.opponent_id) AS notes,
    reg.matchup_id
   FROM reg
  WHERE ((reg.pa > (0)::numeric) AND (reg.pf >= ((2)::numeric * reg.pa)))
UNION ALL
 SELECT reg.season_year,
    reg.opponent_id AS manager_id,
    'doubled_up'::text AS achievement_key,
    round((reg.pa / reg.pf), 2) AS value,
    ('vs '::text || reg.manager_id) AS notes,
    reg.matchup_id
   FROM reg
  WHERE ((reg.pa > (0)::numeric) AND (reg.pf >= ((2)::numeric * reg.pa)))
UNION ALL
 SELECT reg.season_year,
    reg.manager_id,
    'firing_squad'::text AS achievement_key,
    round(((100)::numeric * reg.share), 2) AS value,
    ('vs '::text || reg.opponent_id) AS notes,
    reg.matchup_id
   FROM reg
  WHERE (reg.share > rebuild.setting('firing_squad_share'::text))
UNION ALL
 SELECT w2.season_year,
    w2.manager_id,
    'spoiled_goods'::text AS achievement_key,
    round(w2.pf, 2) AS value,
    ('vs '::text || w2.opponent_id) AS notes,
    w2.matchup_id
   FROM (wk w2
     JOIN wk w1 ON (((w1.season_year = w2.season_year) AND (w1.week = w2.week) AND (w1.r_desc = 1))))
  WHERE ((w2.r_desc = 2) AND (w2.opponent_id = w1.manager_id))
UNION ALL
 SELECT l1.season_year,
    l1.manager_id,
    'true_lowlight'::text AS achievement_key,
    round(l1.pf, 2) AS value,
    ('vs '::text || l1.opponent_id) AS notes,
    l1.matchup_id
   FROM (wk l1
     JOIN wk l2 ON (((l2.season_year = l1.season_year) AND (l2.week = l1.week) AND (l2.r_asc = 2))))
  WHERE ((l1.r_asc = 1) AND (l1.opponent_id = l2.manager_id))
UNION ALL
 SELECT comb.season_year,
    x.m AS manager_id,
    'the_shootout'::text AS achievement_key,
    round(comb.combined, 2) AS value,
    (((((('vs '::text || x.o) || ' ('::text) || round(comb.pf, 2)) || ' - '::text) || round(comb.pa, 2)) || ')'::text) AS notes,
    comb.matchup_id
   FROM comb,
    LATERAL ( VALUES (comb.manager_id,comb.opponent_id), (comb.opponent_id,comb.manager_id)) x(m, o)
  WHERE (comb.high_comb = 1)
UNION ALL
 SELECT comb.season_year,
    x.m AS manager_id,
    'the_dud_bowl'::text AS achievement_key,
    round(comb.combined, 2) AS value,
    (((((('vs '::text || x.o) || ' ('::text) || round(comb.pf, 2)) || ' - '::text) || round(comb.pa, 2)) || ')'::text) AS notes,
    comb.matchup_id
   FROM comb,
    LATERAL ( VALUES (comb.manager_id,comb.opponent_id), (comb.opponent_id,comb.manager_id)) x(m, o)
  WHERE (comb.low_comb = 1)
UNION ALL
 SELECT g.season_year,
    g.manager_id,
    'bully'::text AS achievement_key,
    count(*) AS value,
    ('vs '::text || g.opponent_id) AS notes,
    NULL::integer AS matchup_id
   FROM g
  WHERE g.won
  GROUP BY g.season_year, g.manager_id, g.opponent_id
 HAVING ((count(*))::numeric >= rebuild.setting('bully_wins'::text))
UNION ALL
 SELECT g.season_year,
    g.opponent_id AS manager_id,
    'bullied'::text AS achievement_key,
    count(*) AS value,
    ('vs '::text || g.manager_id) AS notes,
    NULL::integer AS matchup_id
   FROM g
  WHERE g.won
  GROUP BY g.season_year, g.manager_id, g.opponent_id
 HAVING ((count(*))::numeric >= rebuild.setting('bully_wins'::text));

create or replace view rebuild.record_obs as
 SELECT v.k AS record_key,
    g.manager_id,
    g.idx,
    v.v1,
    v.v2,
    NULL::text AS grp
   FROM rebuild.games g,
    LATERAL ( VALUES ('total_points'::text,g.pf,NULL::numeric), ('total_opp_points'::text,g.pa,NULL::numeric), ('total_wins'::text,(g.won)::integer,NULL::numeric), ('total_losses'::text,(g.lost)::integer,NULL::numeric), ('high_scores'::text,((g.week_rank = 1))::integer,NULL::numeric), ('most_weeks_top_scorer'::text,((g.week_rank = 1))::integer,NULL::numeric), ('most_weeks_second_scorer'::text,((g.week_rank = 2))::integer,NULL::numeric), ('top_scores'::text,((g.week_rank <= 3))::integer,NULL::numeric), ('most_weeks_top3'::text,((g.week_rank <= 3))::integer,NULL::numeric), ('most_weeks_top_quarter'::text,((g.week_rank <= (g.week_teams / 4)))::integer,NULL::numeric), ('top_half'::text,((g.week_rank <= (g.week_teams / 2)))::integer,NULL::numeric), ('worst_scores'::text,((g.week_rank = g.week_teams))::integer,NULL::numeric), ('bottom_scores'::text,((g.week_rank > (g.week_teams - 3)))::integer,NULL::numeric), ('bottom_half'::text,((g.week_rank > (g.week_teams / 2)))::integer,NULL::numeric), ('blowout_wins'::text,((g.margin >= rebuild.setting('blowout_margin'::text)))::integer,NULL::numeric), ('blowout_losses'::text,(((- g.margin) >= rebuild.setting('blowout_margin'::text)))::integer,NULL::numeric), ('narrow_wins'::text,((g.won AND (g.margin < rebuild.setting('narrow_margin'::text))))::integer,NULL::numeric), ('narrow_losses'::text,((g.lost AND ((- g.margin) < rebuild.setting('narrow_margin'::text))))::integer,NULL::numeric), ('most_weeks_above_avg'::text,((g.pf > g.week_avg))::integer,NULL::numeric), ('most_weeks_below_avg'::text,((g.pf < g.week_avg))::integer,NULL::numeric), ('most_wins_below_avg'::text,((g.won AND (g.pf < g.week_avg)))::integer,NULL::numeric), ('most_losses_above_avg'::text,((g.lost AND (g.pf > g.week_avg)))::integer,NULL::numeric), ('most_150plus_games'::text,((g.pf >= (150)::numeric))::integer,NULL::numeric), ('most_200plus_games'::text,((g.pf >= (200)::numeric))::integer,NULL::numeric), ('most_sub80_games'::text,((g.pf < (80)::numeric))::integer,NULL::numeric), ('total_playoff_pts'::text,
                CASE
                    WHEN g.is_playoff THEN g.pf
                    ELSE (0)::numeric
                END,NULL::numeric), ('consol_wins'::text,((g.won AND (g.game_type = ANY (ARRAY['consolation'::text, 'fifth_place'::text, 'toilet_bowl'::text]))))::integer,NULL::numeric), ('most_expected_wins_all'::text,((g.allplay_wins)::numeric / (NULLIF((g.week_teams - 1), 0))::numeric),NULL::numeric), ('high_score_pct'::text,(100 * ((g.week_rank = 1))::integer),1), ('top_score_pct'::text,(100 * ((g.week_rank <= 3))::integer),1), ('top_half_pct'::text,(100 * ((g.week_rank <= (g.week_teams / 2)))::integer),1), ('worst_score_pct'::text,(100 * ((g.week_rank = g.week_teams))::integer),1), ('bottom_score_pct'::text,(100 * ((g.week_rank > (g.week_teams - 3)))::integer),1), ('bottom_half_pct'::text,(100 * ((g.week_rank > (g.week_teams / 2)))::integer),1)) v(k, v1, v2)
UNION ALL
 SELECT v.k AS record_key,
    g.manager_id,
    g.idx,
    v.v1,
    NULL::numeric AS v2,
    NULL::text AS grp
   FROM (rebuild.games g
     JOIN rebuild.games o ON (((o.matchup_id = g.matchup_id) AND (o.manager_id = g.opponent_id)))),
    LATERAL ( VALUES ('most_games_vs_top_scorer'::text,((o.week_rank = 1))::integer), ('most_games_vs_bottom_scorer'::text,((o.week_rank = o.week_teams))::integer), ('most_games_vs_top_half'::text,((o.week_rank <= (o.week_teams / 2)))::integer)) v(k, v1)
UNION ALL
 SELECT v.k AS record_key,
    g.manager_id,
    g.idx,
    v.v1,
    v.v2,
    NULL::text AS grp
   FROM rebuild.games g,
    LATERAL ( VALUES ('reg_season_wins'::text,((g.won)::integer)::numeric,NULL::numeric), ('allplay_wins'::text,g.allplay_wins,NULL::numeric), ('allplay_losses'::text,g.allplay_losses,NULL::numeric), ('win_pct'::text,((100)::numeric * (((g.won)::integer)::numeric + (0.5 * ((g.tied)::integer)::numeric))),1), ('allplay_win_pct'::text,(100.0 * (g.allplay_wins)::numeric),(g.week_teams - 1)), ('career_ppg'::text,g.pf,1), ('hardest_sos'::text,g.pa,1), ('easiest_sos'::text,g.pa,1), ('points_share_avg'::text,(((100)::numeric * g.pf) / (g.week_avg * (g.week_teams)::numeric)),1), ('opp_points_share_avg'::text,(((100)::numeric * g.pa) / (g.week_avg * (g.week_teams)::numeric)),1)) v(k, v1, v2)
  WHERE (g.game_type = 'reg'::text)
UNION ALL
 SELECT v.k AS record_key,
    g.manager_id,
    g.idx,
    v.v1,
    NULL::numeric AS v2,
    NULL::text AS grp
   FROM rebuild.games g,
    LATERAL ( VALUES ('most_matchup_points'::text,g.pf,(g.game_type = 'reg'::text)), ('fewest_matchup_points'::text,g.pf,(g.game_type = 'reg'::text)), ('highest_combined_score'::text,g.combined,(g.game_type = 'reg'::text)), ('lowest_combined_score'::text,g.combined,(g.game_type = 'reg'::text)), ('biggest_blowout'::text,g.margin,((g.game_type = 'reg'::text) AND g.won)), ('narrowest_win'::text,g.margin,((g.game_type = 'reg'::text) AND g.won)), ('highest_points_share'::text,((100)::numeric * g.share),(g.game_type = 'reg'::text)), ('lowest_points_share'::text,((100)::numeric * g.share),(g.game_type = 'reg'::text)), ('largest_margin_victory'::text,g.margin,g.won), ('smallest_margin_victory'::text,g.margin,g.won), ('largest_margin_defeat'::text,(- g.margin),g.lost), ('smallest_margin_defeat'::text,(- g.margin),g.lost), ('fewest_points_in_win'::text,g.pf,g.won), ('most_points_in_loss'::text,g.pf,g.lost), ('most_playoff_matchup_pts'::text,g.pf,(g.game_type = ANY (ARRAY['semifinal'::text, 'final'::text, 'third_place'::text]))), ('fewest_playoff_matchup_pts'::text,g.pf,(g.game_type = ANY (ARRAY['semifinal'::text, 'final'::text, 'third_place'::text]))), ('highest_playoff_combined'::text,g.combined,(g.game_type = ANY (ARRAY['semifinal'::text, 'final'::text, 'third_place'::text]))), ('lowest_playoff_combined'::text,g.combined,(g.game_type = ANY (ARRAY['semifinal'::text, 'final'::text, 'third_place'::text]))), ('biggest_playoff_blowout'::text,g.margin,((g.game_type = ANY (ARRAY['semifinal'::text, 'final'::text, 'third_place'::text])) AND g.won)), ('narrowest_playoff_win'::text,g.margin,((g.game_type = ANY (ARRAY['semifinal'::text, 'final'::text, 'third_place'::text])) AND g.won))) v(k, v1, keep)
  WHERE v.keep
UNION ALL
 SELECT 'largest_week_swing'::text AS record_key,
    games.manager_id,
    games.idx,
    abs((games.pf - lag(games.pf) OVER (PARTITION BY games.manager_id ORDER BY games.idx))) AS v1,
    NULL::numeric AS v2,
    NULL::text AS grp
   FROM rebuild.games
UNION ALL
 SELECT v.k AS record_key,
    g.manager_id,
    g.idx,
    v.v1,
    v.v2,
    NULL::text AS grp
   FROM rebuild.games g,
    LATERAL ( VALUES ('playoff_wins'::text,((g.won)::integer)::numeric,NULL::numeric), ('playoff_losses'::text,(g.lost)::integer,NULL::numeric), ('playoff_points'::text,g.pf,NULL::numeric), ('playoff_opp_points'::text,g.pa,NULL::numeric), ('most_playoff_ppg'::text,g.pf,1), ('best_playoff_win_pct'::text,(100 * (g.won)::integer),1), ('worst_playoff_win_pct'::text,(100 * (g.won)::integer),1), ('most_semifinal_appearances'::text,((g.game_type = 'semifinal'::text))::integer,NULL::numeric), ('most_semifinal_wins'::text,(((g.game_type = 'semifinal'::text) AND g.won))::integer,NULL::numeric), ('most_finals_appearances'::text,((g.game_type = 'final'::text))::integer,NULL::numeric), ('top_seed_losses_total'::text,(((g.seed = 1) AND g.lost AND (g.game_type = ANY (ARRAY['semifinal'::text, 'final'::text]))))::integer,NULL::numeric), ('top_seed_losses_semifinal'::text,(((g.seed = 1) AND g.lost AND (g.game_type = 'semifinal'::text)))::integer,NULL::numeric), ('top_seed_losses_final'::text,(((g.seed = 1) AND g.lost AND (g.game_type = 'final'::text)))::integer,NULL::numeric), ('underdog_wins_semifinal'::text,((g.won AND (g.seed > g.opponent_seed) AND (g.game_type = 'semifinal'::text)))::integer,NULL::numeric), ('underdog_wins_final'::text,((g.won AND (g.seed > g.opponent_seed) AND (g.game_type = 'final'::text)))::integer,NULL::numeric), ('most_underdog_wins'::text,((g.won AND (g.seed > g.opponent_seed)))::integer,NULL::numeric)) v(k, v1, v2)
  WHERE (g.game_type = ANY (ARRAY['semifinal'::text, 'final'::text, 'third_place'::text]))
UNION ALL
 SELECT v.k AS record_key,
    sf.manager_id,
    si.end_idx AS idx,
    v.v1,
    v.v2,
    NULL::text AS grp
   FROM ((((rebuild.season_facts sf
     JOIN rebuild.season_idx si USING (season_year))
     LEFT JOIN v_luck l ON (((l.season_year = sf.season_year) AND (l.manager_id = sf.manager_id))))
     LEFT JOIN v_league_rating r ON (((r.season_year = sf.season_year) AND (r.manager_id = sf.manager_id))))
     LEFT JOIN season_results res ON (((res.season_year = sf.season_year) AND (res.manager_id = sf.manager_id)))),
    LATERAL ( VALUES ('championships'::text,(((sf.final_rank = 1))::integer)::numeric,NULL::numeric), ('runner_up_finishes'::text,((sf.final_rank = 2))::integer,NULL::numeric), ('third_place_finishes'::text,((sf.final_rank = 3))::integer,NULL::numeric), ('toiletbowl_finishes'::text,(sf.is_last)::integer,NULL::numeric), ('total_medals'::text,((sf.final_rank <= 3))::integer,NULL::numeric), ('medal_score'::text,
                CASE sf.final_rank
                    WHEN 1 THEN 3
                    WHEN 2 THEN 2
                    WHEN 3 THEN 1
                    ELSE 0
                END,NULL::numeric), ('playoff_appearances'::text,(sf.made_playoffs)::integer,NULL::numeric), ('fewest_playoff_appearances'::text,(sf.made_playoffs)::integer,NULL::numeric), ('most_playoff_appearances_no_title'::text,((sf.made_playoffs AND (sf.final_rank <> 1)))::integer,NULL::numeric), ('reg_season_titles'::text,((sf.reg_rank = 1))::integer,NULL::numeric), ('winning_record_seasons'::text,((sf.wins > sf.losses))::integer,NULL::numeric), ('losing_record_seasons'::text,((sf.wins < sf.losses))::integer,NULL::numeric), ('seasons_played'::text,1,NULL::numeric), ('luckiest'::text,l.luck,NULL::numeric), ('unluckiest'::text,l.luck,NULL::numeric), ('best_season_luck'::text,l.luck,NULL::numeric), ('worst_season_luck'::text,l.luck,NULL::numeric), ('most_unlucky_season'::text,l.luck,NULL::numeric), ('season_score_best'::text,r.league_rating,NULL::numeric), ('season_score_worst'::text,r.league_rating,NULL::numeric), ('best_manager_season'::text,r.league_rating,NULL::numeric), ('worst_manager_season'::text,r.league_rating,NULL::numeric), ('overall_manager_value'::text,r.league_rating,1), ('coach_score_season_best'::text,((100)::numeric * res.lineup_efficiency),NULL::numeric), ('coach_score_season_worst'::text,((100)::numeric * res.lineup_efficiency),NULL::numeric), ('coach_score_alltime'::text,((100)::numeric * res.lineup_efficiency),1), ('coach_score_worst_alltime'::text,((100)::numeric * res.lineup_efficiency),1), ('optimal_pts_missed_all'::text,(res.max_points_for - res.points_for),NULL::numeric), ('optimal_pts_missed_season'::text,(res.max_points_for - res.points_for),NULL::numeric), ('most_transactions'::text,res.moves,NULL::numeric), ('best_moves_season'::text,res.moves,NULL::numeric), ('most_trades'::text,res.trades,NULL::numeric), ('best_trade_season_count'::text,res.trades,NULL::numeric), ('lowest_seed_champion'::text,
                CASE
                    WHEN (sf.final_rank = 1) THEN sf.seed
                    ELSE NULL::integer
                END,NULL::numeric), ('worst_champion_record'::text,
                CASE
                    WHEN (sf.final_rank = 1) THEN ((100.0 * (sf.wins)::numeric) / (NULLIF(((sf.wins + sf.losses) + sf.ties), 0))::numeric)
                    ELSE NULL::numeric
                END,NULL::numeric)) v(k, v1, v2)
  WHERE (v.v1 IS NOT NULL)
UNION ALL
 SELECT v.k AS record_key,
    sf.manager_id,
    si.reg_end_idx AS idx,
    v.v1,
    NULL::numeric AS v2,
    NULL::text AS grp
   FROM (( SELECT games.season_year,
            games.manager_id,
            rank() OVER (PARTITION BY games.season_year ORDER BY (sum(games.pf)) DESC) AS pts_rank,
            rank() OVER (PARTITION BY games.season_year ORDER BY (sum(games.allplay_wins)) DESC) AS ap_rank
           FROM rebuild.games
          WHERE (games.game_type = 'reg'::text)
          GROUP BY games.season_year, games.manager_id) sf
     JOIN rebuild.season_idx si USING (season_year)),
    LATERAL ( VALUES ('season_pts_titles'::text,(((sf.pts_rank = 1))::integer)::numeric), ('season_ap_titles'::text,((sf.ap_rank = 1))::integer)) v(k, v1)
UNION ALL
 SELECT v.k AS record_key,
    t.manager_id,
    t.idx,
    v.v1,
    NULL::numeric AS v2,
    NULL::text AS grp
   FROM ( SELECT g.matchup_id,
            g.season_year,
            g.week,
            g.is_playoff,
            g.manager_id,
            g.opponent_id,
            g.pf,
            g.pa,
            g.idx,
            g.won,
            g.lost,
            g.tied,
            g.margin,
            g.combined,
            g.share,
            g.week_rank,
            g.allplay_wins,
            g.allplay_losses,
            g.week_avg,
            g.week_median,
            g.week_teams,
            g.seed,
            g.opponent_seed,
            g.final_rank,
            g.opponent_final_rank,
            g.game_type,
            sum((g.won)::integer) OVER s AS wins,
            sum((g.lost)::integer) OVER s AS losses,
            sum(g.pf) OVER s AS pts,
            sum(g.pa) OVER s AS opp_pts,
            sum(g.allplay_wins) OVER s AS apw,
            sum(g.allplay_losses) OVER s AS apl,
            sum(((g.week_rank = 1))::integer) OVER s AS highs,
            sum(((g.week_rank <= 3))::integer) OVER s AS tops,
            sum(((g.week_rank <= (g.week_teams / 2)))::integer) OVER s AS top_half,
            sum(((g.week_rank = g.week_teams))::integer) OVER s AS worst,
            sum(((g.week_rank > (g.week_teams - 3)))::integer) OVER s AS bottoms,
            sum(((g.week_rank > (g.week_teams / 2)))::integer) OVER s AS bottom_half,
            sum(((g.margin >= rebuild.setting('blowout_margin'::text)))::integer) OVER s AS bw,
            sum((((- g.margin) >= rebuild.setting('blowout_margin'::text)))::integer) OVER s AS bl,
            sum(((g.won AND (g.margin < rebuild.setting('narrow_margin'::text))))::integer) OVER s AS nw,
            sum(((g.lost AND ((- g.margin) < rebuild.setting('narrow_margin'::text))))::integer) OVER s AS nl,
            sum(((g.allplay_wins)::numeric / (NULLIF((g.week_teams - 1), 0))::numeric)) OVER s AS xw,
            sum((((g.pf)::double precision > g.week_median))::integer) OVER s AS above_med,
            sum((((g.pf)::double precision < g.week_median))::integer) OVER s AS below_med
           FROM rebuild.games g
          WHERE (g.game_type = 'reg'::text)
          WINDOW s AS (PARTITION BY g.season_year, g.manager_id ORDER BY g.week)) t,
    LATERAL ( VALUES ('most_season_wins'::text,(t.wins)::numeric), ('most_season_losses'::text,t.losses), ('most_season_points'::text,t.pts), ('most_season_opp_pts'::text,t.opp_pts), ('most_season_ap_wins'::text,t.apw), ('most_season_ap_losses'::text,t.apl), ('most_season_high_scores'::text,t.highs), ('most_season_top_scores'::text,t.tops), ('most_season_top_half'::text,t.top_half), ('most_season_worst_scores'::text,t.worst), ('most_season_bottom_scores'::text,t.bottoms), ('most_season_bottom_half'::text,t.bottom_half), ('most_season_blowout_wins'::text,t.bw), ('most_season_blowout_losses'::text,t.bl), ('most_season_narrow_wins'::text,t.nw), ('most_season_narrow_losses'::text,t.nl), ('most_expected_wins_season'::text,t.xw), ('most_weeks_above_median_season'::text,t.above_med), ('most_weeks_below_median_season'::text,t.below_med)) v(k, v1)
UNION ALL
 SELECT v.k AS record_key,
    t.manager_id,
    si.reg_end_idx AS idx,
    v.v1,
    NULL::numeric AS v2,
    NULL::text AS grp
   FROM (( SELECT games.season_year,
            games.manager_id,
            sum(games.pf) AS pts,
            sum(games.pa) AS opp_pts,
            avg(games.pf) AS ppg,
            avg(games.pa) AS sos,
            stddev_samp(games.pf) AS sd,
            ((100.0 * (sum(games.allplay_wins))::numeric) / (NULLIF(sum((games.allplay_wins + games.allplay_losses)), 0))::numeric) AS ap_pct,
            (((100)::numeric * sum(games.pf)) / sum((games.week_avg * (games.week_teams)::numeric))) AS pts_share,
            (((100)::numeric * sum(games.pa)) / sum((games.week_avg * (games.week_teams)::numeric))) AS opp_share
           FROM rebuild.games
          WHERE (games.game_type = 'reg'::text)
          GROUP BY games.season_year, games.manager_id) t
     JOIN rebuild.season_idx si USING (season_year)),
    LATERAL ( VALUES ('fewest_season_points'::text,t.pts), ('fewest_season_opp_pts'::text,t.opp_pts), ('best_ppg'::text,t.ppg), ('worst_ppg'::text,t.ppg), ('hardest_season_sos'::text,t.sos), ('easiest_season_sos'::text,t.sos), ('best_season_ap_pct'::text,t.ap_pct), ('highest_season_pts_share'::text,t.pts_share), ('lowest_season_pts_share'::text,t.pts_share), ('highest_season_opp_pts_share'::text,t.opp_share), ('lowest_season_opp_pts_share'::text,t.opp_share), ('most_consistent_season'::text,t.sd), ('least_consistent_season'::text,t.sd)) v(k, v1)
UNION ALL
 SELECT v.k AS record_key,
    games.manager_id,
    games.idx,
    games.pf AS v1,
    NULL::numeric AS v2,
    NULL::text AS grp
   FROM rebuild.games,
    LATERAL ( VALUES ('highest_median_score'::text), ('lowest_median_score'::text), ('most_consistent_team'::text), ('least_consistent_team'::text)) v(k)
  WHERE (games.game_type = 'reg'::text)
UNION ALL
 SELECT v.k AS record_key,
    standings_weeks.manager_id,
    standings_weeks.idx,
    v.v1,
    NULL::numeric AS v2,
    NULL::text AS grp
   FROM rebuild.standings_weeks,
    LATERAL ( VALUES ('most_weeks_first_place'::text,(((standings_weeks.standing = 1))::integer)::numeric), ('most_weeks_last_place'::text,((standings_weeks.standing = standings_weeks.teams))::integer)) v(k, v1)
UNION ALL
 SELECT 'most_weeks_first_place_season'::text AS record_key,
    standings_weeks.manager_id,
    standings_weeks.idx,
    sum(((standings_weeks.standing = 1))::integer) OVER (PARTITION BY standings_weeks.season_year, standings_weeks.manager_id ORDER BY standings_weeks.week) AS v1,
    NULL::numeric AS v2,
    NULL::text AS grp
   FROM rebuild.standings_weeks
UNION ALL
 SELECT 'wire_to_wire_champion'::text AS record_key,
    sf.manager_id,
    si.end_idx AS idx,
    (((sf.final_rank = 1) AND bool_and((sw.standing = 1))))::integer AS v1,
    NULL::numeric AS v2,
    NULL::text AS grp
   FROM ((rebuild.season_facts sf
     JOIN rebuild.season_idx si USING (season_year))
     JOIN rebuild.standings_weeks sw ON (((sw.season_year = sf.season_year) AND (sw.manager_id = sf.manager_id))))
  GROUP BY sf.season_year, sf.manager_id, sf.final_rank, si.end_idx
UNION ALL
 SELECT (game_streaks.flag ||
        CASE
            WHEN game_streaks.val THEN '_streak'::text
            ELSE '_drought'::text
        END) AS record_key,
    game_streaks.manager_id,
    game_streaks.idx,
    game_streaks.len AS v1,
    NULL::numeric AS v2,
    NULL::text AS grp
   FROM rebuild.game_streaks
  WHERE (((game_streaks.flag = ANY (ARRAY['win'::text, 'loss'::text])) AND game_streaks.val) OR (game_streaks.flag = ANY (ARRAY['high_score'::text, 'top_half'::text, 'top_score'::text])))
UNION ALL
 SELECT (t.flag ||
        CASE
            WHEN t.val THEN '_start_streak'::text
            ELSE ''::text
        END) AS record_key,
    t.manager_id,
    t.idx,
    t.len AS v1,
    NULL::numeric AS v2,
    NULL::text AS grp
   FROM ( SELECT gs.manager_id,
            gs.idx,
            gs.season_year,
            gs.week,
            gs.flag,
            gs.val,
            gs.len,
            bool_and(gs.val) OVER (PARTITION BY gs.manager_id, gs.flag, gs.season_year ORDER BY gs.week) AS from_start
           FROM (rebuild.game_streaks gs
             JOIN rebuild.games g USING (manager_id, idx))
          WHERE ((gs.flag = ANY (ARRAY['win'::text, 'loss'::text])) AND (g.game_type = 'reg'::text))) t
  WHERE (t.from_start AND t.val)
UNION ALL
 SELECT (season_streaks.flag ||
        CASE
            WHEN season_streaks.val THEN '_streak'::text
            ELSE '_drought'::text
        END) AS record_key,
    season_streaks.manager_id,
    season_streaks.idx,
    season_streaks.len AS v1,
    NULL::numeric AS v2,
    NULL::text AS grp
   FROM rebuild.season_streaks
UNION ALL
 SELECT v.k AS record_key,
    games.manager_id,
    games.idx,
    v.v1,
    NULL::numeric AS v2,
    games.opponent_id AS grp
   FROM rebuild.games,
    LATERAL ( VALUES ('most_h2h_wins'::text,((games.won)::integer)::numeric), ('fewest_h2h_wins'::text,(games.won)::integer), ('most_h2h_losses'::text,(games.lost)::integer), ('fewest_h2h_losses'::text,(games.lost)::integer), ('most_h2h_points'::text,games.pf), ('fewest_h2h_points'::text,games.pf)) v(k, v1)
UNION ALL
 SELECT v.k AS record_key,
    lw.manager_id,
    lw.idx,
    v.v1,
    v.v2,
    NULL::text AS grp
   FROM (rebuild.lineup_weeks lw
     JOIN rebuild.games g ON (((g.manager_id = lw.manager_id) AND (g.idx = lw.idx)))),
    LATERAL ( VALUES ((('most_'::text || lower(lw.pos)) || '_all_points'::text),lw.pts,NULL::numeric), ((('most_'::text || lower(lw.pos)) || '_week_points'::text),lw.pts,NULL::numeric), ('fewest_bench_week_points'::text,
                CASE
                    WHEN (lw.pos = 'BENCH'::text) THEN lw.pts
                    ELSE NULL::numeric
                END,NULL::numeric), ('fewest_bench_all_points'::text,
                CASE
                    WHEN (lw.pos = 'BENCH'::text) THEN lw.pts
                    ELSE NULL::numeric
                END,NULL::numeric), ('most_bench_pts_in_loss'::text,
                CASE
                    WHEN ((lw.pos = 'BENCH'::text) AND g.lost) THEN lw.pts
                    ELSE NULL::numeric
                END,NULL::numeric), ('most_bench_pts_in_win'::text,
                CASE
                    WHEN ((lw.pos = 'BENCH'::text) AND g.won) THEN lw.pts
                    ELSE NULL::numeric
                END,NULL::numeric), ((lower(lw.pos) || '_avg_pts_all'::text),lw.pts,lw.slots), ((lower(lw.pos) || '_avg_pts_worst'::text),lw.pts,lw.slots)) v(k, v1, v2)
  WHERE ((v.v1 IS NOT NULL) AND (lw.pos <> 'FLEX'::text))
UNION ALL
 SELECT v.k AS record_key,
    t.manager_id,
    t.idx,
    v.v1,
    NULL::numeric AS v2,
    NULL::text AS grp
   FROM ( SELECT lw.season_year,
            lw.week,
            lw.idx,
            lw.manager_id,
            lw.pos,
            lw.pts,
            lw.slots,
            sum(lw.pts) OVER (PARTITION BY lw.season_year, lw.manager_id, lw.pos ORDER BY lw.week) AS season_pts
           FROM rebuild.lineup_weeks lw) t,
    LATERAL ( VALUES ((('most_'::text || lower(t.pos)) || '_season_points'::text),t.season_pts)) v(k, v1)
  WHERE (t.pos <> 'FLEX'::text)
UNION ALL
 SELECT v.k AS record_key,
    t.manager_id,
    si.reg_end_idx AS idx,
    v.v1,
    NULL::numeric AS v2,
    NULL::text AS grp
   FROM (( SELECT lineup_weeks.season_year,
            lineup_weeks.manager_id,
            lineup_weeks.pos,
            sum(lineup_weeks.pts) AS pts,
            (sum(lineup_weeks.pts) / sum(lineup_weeks.slots)) AS avg_pts
           FROM rebuild.lineup_weeks
          WHERE (lineup_weeks.week <= 14)
          GROUP BY lineup_weeks.season_year, lineup_weeks.manager_id, lineup_weeks.pos) t
     JOIN rebuild.season_idx si USING (season_year)),
    LATERAL ( VALUES ((lower(t.pos) || '_avg_pts_season'::text),t.avg_pts), ((lower(t.pos) || '_avg_pts_season_worst'::text),t.avg_pts), ('fewest_bench_points_season'::text,
                CASE
                    WHEN (t.pos = 'BENCH'::text) THEN t.pts
                    ELSE NULL::numeric
                END)) v(k, v1)
  WHERE (((v.v1 IS NOT NULL) AND (t.pos <> ALL (ARRAY['FLEX'::text, 'BENCH'::text]))) OR ((t.pos = 'BENCH'::text) AND (v.k = 'fewest_bench_points_season'::text)))
UNION ALL
 SELECT (('most_weekly_leaders_'::text || lower(t.pos)) || v.suffix) AS record_key,
    t.manager_id,
    t.idx,
    v.v1,
    NULL::numeric AS v2,
    NULL::text AS grp
   FROM ( SELECT t_1.season_year,
            t_1.week,
            t_1.idx,
            t_1.manager_id,
            t_1.pos,
            t_1.pts,
            t_1.slots,
            t_1.leader,
            sum(t_1.leader) OVER (PARTITION BY t_1.season_year, t_1.manager_id, t_1.pos ORDER BY t_1.week) AS season_leader
           FROM ( SELECT lw.season_year,
                    lw.week,
                    lw.idx,
                    lw.manager_id,
                    lw.pos,
                    lw.pts,
                    lw.slots,
                    ((rank() OVER (PARTITION BY lw.season_year, lw.week, lw.pos ORDER BY lw.pts DESC) = 1))::integer AS leader
                   FROM rebuild.lineup_weeks lw
                  WHERE (lw.pos <> 'BENCH'::text)) t_1) t,
    LATERAL ( VALUES ('_all'::text,(t.leader)::numeric), ('_season'::text,t.season_leader)) v(suffix, v1)
UNION ALL
 SELECT 'top_player_week'::text AS record_key,
    l.manager_id,
    w.idx,
    l.points AS v1,
    NULL::numeric AS v2,
    NULL::text AS grp
   FROM (weekly_lineups l
     JOIN rebuild.weeks w USING (season_year, week))
  WHERE l.is_starter
UNION ALL
 SELECT v.k AS record_key,
    t.manager_id,
    t.idx,
    v.v1,
    NULL::numeric AS v2,
    NULL::text AS grp
   FROM ( SELECT l.manager_id,
            l.season_year,
            w.idx,
            l.player_name,
            sum(l.points) OVER (PARTITION BY l.manager_id, l.season_year, l.player_name ORDER BY w.idx) AS season_pts,
            sum(l.points) OVER (PARTITION BY l.manager_id, l.player_name ORDER BY w.idx) AS career_pts
           FROM (weekly_lineups l
             JOIN rebuild.weeks w USING (season_year, week))
          WHERE l.is_starter) t,
    LATERAL ( VALUES ('top_player_season'::text,t.season_pts), ('most_points_single_player_season'::text,t.season_pts), ('most_points_single_player_career'::text,t.career_pts)) v(k, v1)
UNION ALL
 SELECT 'highest_pct_single_player_season'::text AS record_key,
    p.manager_id,
    si.end_idx AS idx,
    (((100)::numeric * max(p.pts)) / max(t.pts)) AS v1,
    NULL::numeric AS v2,
    NULL::text AS grp
   FROM ((( SELECT weekly_lineups.manager_id,
            weekly_lineups.season_year,
            weekly_lineups.player_name,
            sum(weekly_lineups.points) AS pts
           FROM weekly_lineups
          WHERE weekly_lineups.is_starter
          GROUP BY weekly_lineups.manager_id, weekly_lineups.season_year, weekly_lineups.player_name) p
     JOIN ( SELECT weekly_lineups.manager_id,
            weekly_lineups.season_year,
            sum(weekly_lineups.points) AS pts
           FROM weekly_lineups
          WHERE weekly_lineups.is_starter
          GROUP BY weekly_lineups.manager_id, weekly_lineups.season_year) t USING (manager_id, season_year))
     JOIN rebuild.season_idx si USING (season_year))
  GROUP BY p.manager_id, si.end_idx
UNION ALL
 SELECT 'most_different_players_season'::text AS record_key,
    l.manager_id,
    si.end_idx AS idx,
    count(DISTINCT l.player_name) AS v1,
    NULL::numeric AS v2,
    NULL::text AS grp
   FROM (weekly_lineups l
     JOIN rebuild.season_idx si USING (season_year))
  WHERE l.is_starter
  GROUP BY l.manager_id, si.end_idx
UNION ALL
 SELECT v.k AS record_key,
    d.manager_id,
    si.start_idx AS idx,
    v.v1,
    v.v2,
    NULL::text AS grp
   FROM (draft_picks d
     JOIN rebuild.season_idx si USING (season_year)),
    LATERAL ( VALUES ('overall_draft_value'::text,d.grade4,(1)::numeric), ((lower(d."position") || '_draft_value'::text),d.grade4,1), ('best_draft_pick_ever'::text,d.grade4,NULL::numeric), ('worst_draft_pick_ever'::text,d.grade4,NULL::numeric), ((('best_'::text || lower(d."position")) || '_draft_pick'::text),d.grade4,NULL::numeric), ((('worst_'::text || lower(d."position")) || '_draft_pick'::text),d.grade4,NULL::numeric), ((('most_first_round_'::text || lower(d."position")) || 's'::text),((d.round = 1))::integer,NULL::numeric)) v(k, v1, v2)
UNION ALL
 SELECT v.k AS record_key,
    t.manager_id,
    si.start_idx AS idx,
    v.v1,
    NULL::numeric AS v2,
    NULL::text AS grp
   FROM (( SELECT draft_picks.season_year,
            draft_picks.manager_id,
            draft_picks."position",
            avg(draft_picks.grade4) AS g
           FROM draft_picks
          GROUP BY draft_picks.season_year, draft_picks.manager_id, draft_picks."position"
        UNION ALL
         SELECT draft_picks.season_year,
            draft_picks.manager_id,
            NULL::text,
            avg(draft_picks.grade4) AS avg
           FROM draft_picks
          GROUP BY draft_picks.season_year, draft_picks.manager_id) t
     JOIN rebuild.season_idx si USING (season_year)),
    LATERAL ( VALUES ((('best_'::text || COALESCE((lower(t."position") || '_'::text), ''::text)) || 'draft_season'::text),t.g), ((('worst_'::text || COALESCE((lower(t."position") || '_'::text), ''::text)) || 'draft_season'::text),t.g)) v(k, v1)
UNION ALL
 SELECT v.k AS record_key,
    r.manager_id,
    si.start_idx AS idx,
    v.v1,
    v.v2,
    NULL::text AS grp
   FROM (season_results r
     JOIN rebuild.season_idx si USING (season_year)),
    LATERAL ( VALUES ('highest_avg_draft_pos'::text,(r.draft_position)::numeric,(1)::numeric), ('lowest_avg_draft_pos'::text,r.draft_position,1), ('most_first_overall_picks'::text,((r.draft_position = 1))::integer,NULL::numeric)) v(k, v1, v2)
  WHERE (r.draft_position IS NOT NULL)
UNION ALL
 SELECT v.k AS record_key,
    t.team_name AS manager_id,
    w.idx,
    v.v1,
    NULL::numeric AS v2,
    NULL::text AS grp
   FROM (v_transaction_values t
     JOIN rebuild.weeks w ON (((w.season_year = t.season_year) AND (w.week = LEAST(GREATEST(COALESCE(t.transaction_week, 1), 1), 16))))),
    LATERAL ( VALUES ('best_trade_value'::text,
                CASE
                    WHEN (t.transaction_type = 'trade'::text) THEN t.net_value
                    ELSE NULL::numeric
                END), ('worst_trade_value'::text,
                CASE
                    WHEN (t.transaction_type = 'trade'::text) THEN t.net_value
                    ELSE NULL::numeric
                END), ('top_waiver_value'::text,
                CASE
                    WHEN (t.transaction_type <> 'trade'::text) THEN t.net_value
                    ELSE NULL::numeric
                END), ('worst_waivers'::text,
                CASE
                    WHEN (t.transaction_type <> 'trade'::text) THEN t.net_value
                    ELSE NULL::numeric
                END), ('best_waiver_pickup'::text,
                CASE
                    WHEN (t.transaction_type <> 'trade'::text) THEN t.net_value
                    ELSE NULL::numeric
                END)) v(k, v1)
  WHERE (v.v1 IS NOT NULL)
UNION ALL
 SELECT v.k AS record_key,
    t.team_name AS manager_id,
    si.end_idx AS idx,
    v.v1,
    NULL::numeric AS v2,
    NULL::text AS grp
   FROM (( SELECT v_transaction_values.season_year,
            v_transaction_values.team_name,
            sum(v_transaction_values.net_value) FILTER (WHERE (v_transaction_values.transaction_type = 'trade'::text)) AS trade_v,
            sum(v_transaction_values.net_value) FILTER (WHERE (v_transaction_values.transaction_type <> 'trade'::text)) AS waiver_v
           FROM v_transaction_values
          GROUP BY v_transaction_values.season_year, v_transaction_values.team_name) t
     JOIN rebuild.season_idx si USING (season_year)),
    LATERAL ( VALUES ('best_trade_season_value'::text,t.trade_v), ('worst_trade_season_value'::text,t.trade_v), ('best_waiver_season'::text,t.waiver_v), ('worst_waiver_season'::text,t.waiver_v)) v(k, v1)
  WHERE (v.v1 IS NOT NULL);

-- ---------------------------------------------------------------------------
-- 5b. Materialized view indexes
-- ---------------------------------------------------------------------------

set search_path = public;

CREATE INDEX mv_player_events_key ON public.mv_player_events USING btree (player_key);
CREATE INDEX mv_player_games_player_key_idx ON public.mv_player_games USING btree (player_key);
CREATE INDEX mv_player_manager_stats_player_key_idx ON public.mv_player_manager_stats USING btree (player_key);
CREATE INDEX mv_player_manager_teams_mgr ON public.mv_player_manager_teams USING btree (manager_id);
CREATE UNIQUE INDEX mv_player_summary_player_key_idx ON public.mv_player_summary USING btree (player_key);

-- ---------------------------------------------------------------------------
-- 6. Row level security and policies
--    Every table in public and rebuild has RLS enabled. Tables in rebuild have
--    no policies (only the service role / owner can use them).
-- ---------------------------------------------------------------------------

alter table public.achievements enable row level security;
alter table public.college_teams enable row level security;
alter table public.draft_picks enable row level security;
alter table public.elo_ratings enable row level security;
alter table public.fa_moves enable row level security;
alter table public.fa_pickups enable row level security;
alter table public.fa_transaction_scores enable row level security;
alter table public.fa_transactions enable row level security;
alter table public.managers enable row level security;
alter table public.matchup_projections enable row level security;
alter table public.mock_draft_picks enable row level security;
alter table public.mock_draft_prospects enable row level security;
alter table public.mock_drafts enable row level security;
alter table public.nfl_draft_order_2026 enable row level security;
alter table public.nfl_draft_results_2026 enable row level security;
alter table public.nfl_team_needs enable row level security;
alter table public.nfl_teams_draft enable row level security;
alter table public.player_projections enable row level security;
alter table public.player_weekly_stats enable row level security;
alter table public.players enable row level security;
alter table public.playoff_results enable row level security;
alter table public.record_owner_values enable row level security;
alter table public.record_timeline enable row level security;
alter table public.season_results enable row level security;
alter table public.seasons enable row level security;
alter table public.weekly_lineups enable row level security;
alter table public.weekly_matchups enable row level security;
alter table rebuild.games_cache enable row level security;
alter table rebuild.lineup_cache enable row level security;
alter table rebuild.obs_cache enable row level security;
alter table rebuild.record_defs enable row level security;
alter table rebuild.record_holders enable row level security;
alter table rebuild.record_owner_values_new enable row level security;
alter table rebuild.record_timeline_new enable row level security;
alter table rebuild.record_values enable row level security;
alter table rebuild.settings enable row level security;

-- Read access for anon
create policy "Allow public read access" on public.achievements as permissive for select to anon using (true);
create policy "Allow public read access" on public.draft_picks as permissive for select to anon using (true);
create policy "Allow public read access" on public.elo_ratings as permissive for select to anon using (true);
create policy "Allow public read access" on public.fa_moves as permissive for select to anon using (true);
create policy "Allow public read access" on public.fa_pickups as permissive for select to anon using (true);
create policy "Allow public read access" on public.managers as permissive for select to anon using (true);
create policy "Allow public read access" on public.matchup_projections as permissive for select to anon using (true);
create policy "Allow public read access" on public.player_projections as permissive for select to anon using (true);
create policy "Allow public read access" on public.player_weekly_stats as permissive for select to anon using (true);
create policy "Allow public read access" on public.players as permissive for select to anon using (true);
create policy "Allow public read access" on public.playoff_results as permissive for select to anon using (true);
create policy "Allow public read access" on public.record_timeline as permissive for select to anon using (true);
create policy "Allow public read access" on public.season_results as permissive for select to anon using (true);
create policy "Allow public read access" on public.seasons as permissive for select to anon using (true);
create policy "Allow public read access" on public.weekly_lineups as permissive for select to anon using (true);
create policy "Allow public read access" on public.weekly_matchups as permissive for select to anon using (true);

-- Read access for everybody (role public)
create policy public_read_college_teams on public.college_teams as permissive for select to public using (true);
create policy public_read_fa_transaction_scores on public.fa_transaction_scores as permissive for select to public using (true);
create policy public_read_fa_transactions on public.fa_transactions as permissive for select to public using (true);
create policy public_read_mock_picks on public.mock_draft_picks as permissive for select to public using (true);
create policy public_read_prospects on public.mock_draft_prospects as permissive for select to public using (true);
create policy public_read_mock_drafts on public.mock_drafts as permissive for select to public using (true);
create policy public_read_draft_order on public.nfl_draft_order_2026 as permissive for select to public using (true);
create policy public_read_draft_results on public.nfl_draft_results_2026 as permissive for select to public using (true);
create policy public_read_team_needs on public.nfl_team_needs as permissive for select to public using (true);
create policy public_read_nfl_teams on public.nfl_teams_draft as permissive for select to public using (true);
create policy public_read_record_owner_values on public.record_owner_values as permissive for select to public using (true);

-- Open write access for everybody (mock draft tool)
create policy public_write_mock_picks on public.mock_draft_picks as permissive for all to public using (true) with check (true);
create policy public_write_mock_drafts on public.mock_drafts as permissive for all to public using (true) with check (true);

-- ---------------------------------------------------------------------------
-- 7. Grants (anon and authenticated), compressed per object group
--    Source: relacl / proacl at generation time. Schema rebuild has no grants
--    for anon or authenticated and no USAGE for them.
-- ---------------------------------------------------------------------------

grant usage on schema public to anon, authenticated;

-- Tables with full table privileges (RLS does the restricting)
grant select, insert, update, delete, truncate, references, trigger, maintain on table
  public.achievements, public.college_teams, public.draft_picks, public.elo_ratings,
  public.fa_moves, public.fa_pickups, public.fa_transaction_scores, public.fa_transactions,
  public.managers, public.matchup_projections, public.mock_draft_prospects,
  public.nfl_draft_order_2026, public.nfl_draft_results_2026, public.nfl_team_needs,
  public.nfl_teams_draft, public.player_projections, public.player_weekly_stats,
  public.players, public.playoff_results, public.record_owner_values,
  public.record_timeline, public.season_results, public.seasons,
  public.weekly_lineups, public.weekly_matchups
  to anon, authenticated;

-- Mock draft tables: no insert/update/delete/truncate privilege
grant select, references, trigger, maintain on table
  public.mock_draft_picks, public.mock_drafts
  to anon, authenticated;

-- Views
grant select, insert, update, delete, truncate, references, trigger, maintain on table
  public.v_all_play, public.v_alltime_standings, public.v_coach_rank, public.v_draft_grades,
  public.v_elo_current, public.v_elo_history, public.v_h2h_lineups, public.v_head_to_head,
  public.v_league_rating, public.v_league_records, public.v_lineup_efficiency, public.v_luck,
  public.v_manager_rank, public.v_matchup_records, public.v_player_espn_gsis,
  public.v_player_loyalty, public.v_player_ownership, public.v_points_share,
  public.v_position_records, public.v_season_records, public.v_season_tiers, public.v_sos,
  public.v_streaks, public.v_transaction_values, public.v_weekly_cumulative,
  public.v_weekly_scores
  to anon, authenticated;

-- Materialized views
grant select, insert, update, delete, truncate, references, trigger, maintain on table
  public.mv_player_events, public.mv_player_games, public.mv_player_manager_stats,
  public.mv_player_manager_teams, public.mv_player_summary
  to anon, authenticated;

-- Sequences
grant select, update, usage on sequence
  public.achievements_id_seq, public.draft_picks_id_seq, public.elo_ratings_id_seq,
  public.fa_moves_id_seq, public.fa_pickups_id_seq, public.fa_transactions_id_seq,
  public.mock_draft_picks_id_seq, public.mock_draft_prospects_id_seq, public.mock_drafts_id_seq,
  public.player_weekly_stats_id_seq, public.playoff_results_id_seq, public.record_timeline_id_seq,
  public.season_results_id_seq, public.weekly_lineups_id_seq, public.weekly_matchups_id_seq
  to anon, authenticated;

-- Functions: execute is revoked from PUBLIC, anon and authenticated on these
revoke execute on function
  public.create_group(text),
  public.ensure_pc_lineup_slots(uuid, integer, integer),
  public.get_my_bracket_state(integer),
  public.handle_new_user(),
  public.is_group_admin(uuid, uuid),
  public.is_group_member(uuid, uuid),
  public.join_group(text),
  public.pickem_standings(integer),
  public.pickem_week_leaderboard(uuid, integer, integer),
  public.rebuild_playoff_bracket_games(integer, uuid),
  public.refresh_league_derived(),
  public.refresh_player_stats(),
  public.refresh_transaction_scores(),
  public.set_pc_lineup_slot(uuid, integer, integer, text, text, uuid),
  public.set_playoff_bracket_pick(integer, uuid, uuid)
  from public, anon, authenticated;

-- Functions and procedures: execute for anon and authenticated (plus PUBLIC default)
grant execute on function
  public.generate_invite_code(),
  public.normalize_team_abbr(),
  public.pc_slot_player_team_check(),
  public.pc_team_points_value(integer, integer, text),
  public.pickem_set_user_id(),
  public.player_name_key(text),
  public.playoff_set_updated_at(),
  public.set_updated_at(),
  public.tr_choose_slot(uuid, text, text),
  public.tr_clear_pending_slot(uuid),
  public.tr_create_run(integer),
  public.tr_pick_asset(uuid, text, bigint),
  public.tr_pick_asset(uuid, text, uuid),
  public.tr_pick_coach(uuid, uuid),
  public.tr_pick_dst(uuid),
  public.tr_pick_player(uuid, bigint),
  public.tr_roll_team(uuid)
  to anon, authenticated;

grant execute on procedure
  public.calculate_elo(numeric, numeric, numeric, numeric, numeric),
  public.insert_matchup_record(text, text, text, text),
  public.insert_season_best_timeline(text, text, text, text),
  public.insert_season_record(text, text, text, text),
  public.insert_season_timeline(text, text, text),
  public.insert_timeline(text, text, text)
  to anon, authenticated;

-- Functions in schema rebuild keep the default (PUBLIC execute); no explicit grants.

reset search_path;

-- =============================================================================
-- Not reconstructed / caveats
--   * Data, sequence current values, table/column comments, statistics.
--   * Object owners (everything is created by the executing role) and
--     default privileges.
--   * The three *_backup_20261013 tables (excluded by request).
--   * Materialized views are created WITH NO DATA; run
--     select public.refresh_player_stats(); after loading data.
--   * Functions that reference tables missing from this database (groups,
--     group_members, pc_lineup_slots, pc_team_weekly_stats, playoff_seeds,
--     playoff_games, playoff_user_picks, teams, profiles, game_runs,
--     game_state, game_picks, coaches, nflverse_roster_2025, team_abbr_map,
--     pickem_picks, pickem_picks_v2, games, weeks, ...) will fail when called.
--     Function bodies had CRLF line endings in the catalog; they are written
--     here with LF.
--   * The mock draft policies allow writes by role public, as in the live DB.
--   * Triggers: none exist in public or rebuild in the live catalog.
-- =============================================================================
