-- ============================================================================
-- Tim Tebow Tournament: Neuberechnung der Record-Timeline
--
-- In Supabase: SQL Editor -> "New query" -> diese komplette Datei einfügen
-- -> "Run". Legt nur Objekte im Schema "rebuild" an; die Live-Tabellen
-- (public.record_timeline, public.record_owner_values) bleiben unverändert.
-- Danach Schritt 2 unten ausführen.
-- ============================================================================


-- >>> 20261013_01_rebuild_base.sql
-- Rebuild of achievements and record timelines from the raw league data.
-- Part 1: schema, settings and base views.

create schema if not exists rebuild;

-- Tunable thresholds used by record and achievement definitions
create table if not exists rebuild.settings (
  key text primary key,
  value numeric not null,
  description text
);

insert into rebuild.settings (key, value, description) values
  ('blowout_margin', 40, 'Sieg/Niederlage mit mindestens so vielen Punkten Unterschied = Blowout'),
  ('narrow_margin', 5, 'Sieg/Niederlage mit weniger als so vielen Punkten Unterschied = knapp'),
  ('firing_squad_share', 0.65, 'Anteil an den kombinierten Punkten für "Firing Squad"'),
  ('micro_margin', 0.5, 'Micro Victory/Defeat: Unterschied kleiner als'),
  ('small_margin', 1, 'Small Victory/Defeat: Unterschied kleiner als (und nicht micro)'),
  ('bully_wins', 3, 'Siege gegen denselben Gegner in einer Saison für "Bully"'),
  ('high_scores_season', 5, 'Wochen-Höchstscores in einer Saison (inkl. Playoffs)'),
  ('tactician_score', 80, 'Coach-Score ab dem "The Tactician" vergeben wird')
on conflict (key) do nothing;

create or replace function rebuild.setting(k text) returns numeric
language sql stable as $$ select value from rebuild.settings where key = k $$;

-- Every league week with a running index
create or replace view rebuild.weeks as
select
  w.season_year,
  w.week,
  row_number() over (order by w.season_year, w.week)::int as idx,
  s.reg_season_weeks,
  w.week = max(w.week) over (partition by w.season_year) as is_season_end,
  w.week = s.reg_season_weeks as is_reg_end
from (select distinct season_year, week from public.weekly_matchups) w
join public.seasons s on s.year = w.season_year;

-- Final standings with the playoff seed, overall finish and season-level facts
create or replace view rebuild.season_facts as
select
  r.season_year,
  r.manager_id,
  r.reg_rank,
  r.wins, r.losses, r.ties,
  r.points_for::numeric as points_for,
  r.points_against::numeric as points_against,
  coalesce(p.seed, r.reg_rank) as seed,  -- running season: no playoff row yet
  p.final_rank,
  coalesce(p.final_rank = max(p.final_rank) over (partition by r.season_year), false) as is_last,
  p.seed is not null and p.seed <= s.playoff_teams as made_playoffs
from public.season_results r
left join public.playoff_results p on p.season_year = r.season_year and p.manager_id = r.manager_id
join public.seasons s on s.year = r.season_year;

-- One row per manager per game, with weekly context
create or replace view rebuild.games as
with sides as (
  select m.id as matchup_id, m.season_year, m.week, m.is_playoff,
         m.manager_a as manager_id, m.manager_b as opponent_id,
         m.score_a::numeric as pf, m.score_b::numeric as pa
  from public.weekly_matchups m
  union all
  select m.id, m.season_year, m.week, m.is_playoff,
         m.manager_b, m.manager_a, m.score_b::numeric, m.score_a::numeric
  from public.weekly_matchups m
),
week_stats as (
  select season_year, week, avg(pf) as week_avg,
         percentile_cont(0.5) within group (order by pf) as week_median,
         count(*) as week_teams
  from sides group by season_year, week
)
select
  s.*,
  w.idx,
  s.pf > s.pa as won,
  s.pf < s.pa as lost,
  s.pf = s.pa as tied,
  s.pf - s.pa as margin,
  s.pf + s.pa as combined,
  case when s.pf + s.pa > 0 then s.pf / (s.pf + s.pa) end as share,
  (rank() over (partition by s.season_year, s.week order by s.pf desc))::int as week_rank,  -- 1 = top score
  (rank() over (partition by s.season_year, s.week order by s.pf asc) - 1)::int as allplay_wins,
  (rank() over (partition by s.season_year, s.week order by s.pf desc) - 1)::int as allplay_losses,
  ws.week_avg, ws.week_median, ws.week_teams::int,
  me.seed, op.seed as opponent_seed,
  me.final_rank, op.final_rank as opponent_final_rank,
  case
    when not s.is_playoff then 'reg'
    when s.week = w.reg_season_weeks + 1 and me.seed <= 4 and op.seed <= 4 then 'semifinal'
    when s.week = w.reg_season_weeks + 1 then 'consolation'
    when least(me.final_rank, op.final_rank) = 1 then 'final'
    when least(me.final_rank, op.final_rank) = 3 then 'third_place'
    when least(me.final_rank, op.final_rank) = 5 then 'fifth_place'
    else 'toilet_bowl'
  end as game_type
from sides s
join week_stats ws on ws.season_year = s.season_year and ws.week = s.week
join rebuild.weeks w on w.season_year = s.season_year and w.week = s.week
join rebuild.season_facts me on me.season_year = s.season_year and me.manager_id = s.manager_id
join rebuild.season_facts op on op.season_year = s.season_year and op.manager_id = s.opponent_id;

-- >>> 20261013_02_rebuild_engine.sql
-- Part 2: generic record engine.
--
-- Every record is described by one row in rebuild.record_defs and a set of
-- observations in rebuild.record_obs (one view per family, unioned). The
-- engine turns observations into each manager's value after every league
-- week, picks the record holder per week and collapses that into periods.
--
-- agg:
--   sum          value = running sum of v1
--   ratio        value = running sum(v1) / running sum(v2)
--   max / min    value = best single observation so far
--   group_max    value = max over groups (grp) of the running sum of v1 per group
--   group_min    value = min over groups of the running sum of v1 per group
--   median       value = median of all v1 so far
--   stddev       value = standard deviation of all v1 so far
-- direction: 'max' = higher is better, 'min' = lower is better
-- positive_only: a value must be > 0 to hold the record (counts that start at 0)

create table if not exists rebuild.record_defs (
  record_key text primary key,
  record_label text not null,
  agg text not null check (agg in ('sum','ratio','max','min','group_max','group_min','median','stddev')),
  direction text not null check (direction in ('max','min')),
  positive_only boolean not null default false,
  min_obs int not null default 1  -- observations needed before a value counts (ratios, medians)
);

create table if not exists rebuild.record_timeline_new (
  record_key text, record_label text, period_id int, manager_id text,
  from_year int, from_week int, to_year int, to_week int, weeks_held int,
  record_value numeric, is_current boolean
);
create table if not exists rebuild.record_owner_values_new (record_key text, manager_id text, current_value numeric);
create table if not exists rebuild.record_values (
  record_key text, manager_id text, idx int, value numeric,
  primary key (record_key, manager_id, idx)
);

-- Extends the open period or starts a new one (period = number of periods so far)
create or replace function rebuild._commit_holder(
  k text, label text, period int, holder text, val numeric, yr int, wk int, prev_holder text
) returns void language plpgsql as $$
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
$$;

create or replace function rebuild.compute_records() returns void
language plpgsql as $$
declare
  c record;
  cur_key text := null;
  cur_idx int := null;
  cur_label text;
  prev_holder text;
  holder text;
  holder_val numeric;
  holder_year int;
  holder_week int;
  period int;
  last_idx int := (select max(idx) from rebuild.weeks);
begin
  truncate rebuild.record_values;

  -- Dense values for simple aggregations
  insert into rebuild.record_values
  with defs as (select * from rebuild.record_defs where agg in ('sum','ratio','max','min')),
  obs as (
    select o.record_key, o.manager_id, o.idx,
           sum(o.v1) s1, sum(o.v2) s2, max(o.v1) mx, min(o.v1) mn, count(*) n
    from rebuild.record_obs o join defs using (record_key)
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

  -- Group aggregations (e.g. best/worst record against a single opponent)
  insert into rebuild.record_values
  with defs as (select * from rebuild.record_defs where agg in ('group_max','group_min')),
  per_group as (
    select o.record_key, o.manager_id, w.idx, o.grp, sum(o.v1) v, count(*) n
    from rebuild.record_obs o
    join defs using (record_key)
    join rebuild.weeks w on o.idx <= w.idx
    group by 1,2,3,4
  )
  select p.record_key, p.manager_id, p.idx,
    case when d.agg = 'group_max' then max(p.v) else min(p.v) end
  from per_group p join defs d using (record_key)
  where p.n >= d.min_obs
  group by p.record_key, p.manager_id, p.idx, d.agg;

  -- Distribution aggregations over all observations so far
  insert into rebuild.record_values
  select o.record_key, o.manager_id, w.idx,
    case when d.agg = 'median' then percentile_cont(0.5) within group (order by o.v1)
         else stddev_samp(o.v1) end
  from rebuild.record_obs o
  join rebuild.record_defs d using (record_key)
  join rebuild.weeks w on o.idx <= w.idx
  where d.agg in ('median','stddev')
  group by o.record_key, o.manager_id, w.idx, d.agg, d.min_obs
  having count(*) >= d.min_obs;

  -- Holder per week -> periods. Candidates are all managers with the best
  -- value that week; the current holder keeps the record on a tie, otherwise
  -- the manager who was better the week before, then alphabetical.
  truncate rebuild.record_timeline_new;
  for c in
    with best as (
      select v.record_key, v.idx,
             case when d.direction = 'max' then max(v.value) else min(v.value) end as best
      from rebuild.record_values v join rebuild.record_defs d using (record_key)
      where v.value is not null and (not d.positive_only or v.value > 0)
      group by v.record_key, v.idx, d.direction
    )
    select v.record_key, d.record_label, v.idx, w.season_year, w.week, v.manager_id, v.value
    from best b
    join rebuild.record_values v on v.record_key = b.record_key and v.idx = b.idx and v.value = b.best
    join rebuild.record_defs d on d.record_key = v.record_key
    join rebuild.weeks w on w.idx = v.idx
    left join rebuild.record_values pv on pv.record_key = v.record_key and pv.manager_id = v.manager_id and pv.idx = v.idx - 1
    order by v.record_key, v.idx,
             case when d.direction = 'max' then pv.value end desc nulls last,
             case when d.direction = 'min' then pv.value end asc nulls last,
             v.manager_id
  loop
    if c.record_key is distinct from cur_key or c.idx is distinct from cur_idx then
      -- a new week: commit the previous week's holder
      if cur_key is not null then
        perform rebuild._commit_holder(cur_key, cur_label, period, holder, holder_val, holder_year, holder_week, prev_holder);
        if holder is distinct from prev_holder then period := period + 1; end if;
        prev_holder := holder;
      end if;
      if c.record_key is distinct from cur_key then
        prev_holder := null;
        period := 0;
      end if;
      cur_key := c.record_key;
      cur_idx := c.idx;
      holder := c.manager_id;          -- first candidate by tie-break order
      holder_val := c.value;
      holder_year := c.season_year;
      holder_week := c.week;
      cur_label := c.record_label;
    end if;
    if c.manager_id = prev_holder then
      holder := c.manager_id;          -- current holder keeps the record
    end if;
  end loop;
  if cur_key is not null then
    perform rebuild._commit_holder(cur_key, cur_label, period, holder, holder_val, holder_year, holder_week, prev_holder);
  end if;

  update rebuild.record_timeline_new t set is_current = true
  where period_id = (select max(period_id) from rebuild.record_timeline_new x where x.record_key = t.record_key);

  -- Every manager's current value
  truncate rebuild.record_owner_values_new;
  insert into rebuild.record_owner_values_new (record_key, manager_id, current_value)
  select record_key, manager_id, round(value, 2)
  from rebuild.record_values
  where idx = last_idx and value is not null;
end;
$$;

-- >>> 20261013_03_rebuild_record_obs.sql
-- Part 3: record definitions (observations per record family).
--
-- Conventions
--   * "Total ..." career counts include every game (regular season + playoff weeks)
--   * rates, averages and single-season records use the regular season
--   * playoff records use the championship bracket (semifinal, final, 3rd place)
--   * season-level facts (titles, finishes, luck, ratings) are observed in the
--     last week of the season, draft facts in week 1, transactions in their week

create or replace view rebuild.season_idx as
select season_year,
       min(idx) filter (where week = 1) as start_idx,
       min(idx) filter (where is_reg_end) as reg_end_idx,
       max(idx) as end_idx
from rebuild.weeks group by season_year;

-- Starter points per position group and bench points, per manager and week
create or replace view rebuild.lineup_weeks as
select l.season_year, l.week, w.idx, l.manager_id,
       case when not l.is_starter then 'BENCH'
            when l.slot in ('RB1','RB2') then 'RB'
            when l.slot in ('WR1','WR2') then 'WR'
            else l.slot end as pos,
       sum(l.points)::numeric as pts,
       count(*) as slots
from public.weekly_lineups l
join rebuild.weeks w on w.season_year = l.season_year and w.week = l.week
group by 1,2,3,4,5;

-- Regular season standings after every week (wins, then points)
create or replace view rebuild.standings_weeks as
select g.season_year, g.week, g.idx, g.manager_id,
       rank() over (partition by g.season_year, g.week order by g.wins_td desc, g.pf_td desc) as standing,
       count(*) over (partition by g.season_year, g.week) as teams
from (
  select season_year, week, idx, manager_id,
         sum(won::int) over s as wins_td, sum(pf) over s as pf_td
  from rebuild.games where game_type = 'reg'
  window s as (partition by season_year, manager_id order by week)
) g;

-- Weekly flags with streak / drought lengths (all games, chronological)
create or replace view rebuild.game_streaks as
with f as (
  select manager_id, idx, season_year, week, flag, val
  from rebuild.games,
  lateral (values
    ('win', won), ('loss', lost),
    ('high_score', week_rank = 1),
    ('top_half', week_rank <= week_teams / 2),
    ('top_score', week_rank <= 3)
  ) v(flag, val)
),
islands as (
  select *, row_number() over (partition by manager_id, flag order by idx)
          - row_number() over (partition by manager_id, flag, val order by idx) as island
  from f
)
select manager_id, idx, season_year, week, flag, val,
       row_number() over (partition by manager_id, flag, val, island order by idx) as len
from islands;

-- Season flags with streak / drought lengths
create or replace view rebuild.season_streaks as
with f as (
  select sf.manager_id, sf.season_year, si.end_idx as idx, flag, val
  from rebuild.season_facts sf
  join rebuild.season_idx si using (season_year),
  lateral (values
    ('championship', sf.final_rank = 1),
    ('medal', sf.final_rank <= 3),
    ('playoff_appearance', sf.made_playoffs),
    ('title_game', sf.final_rank <= 2),
    ('winning_record', sf.wins > sf.losses)
  ) v(flag, val)
),
islands as (
  select *, row_number() over (partition by manager_id, flag order by season_year)
          - row_number() over (partition by manager_id, flag, val order by season_year) as island
  from f
)
select manager_id, season_year, idx, flag, val,
       row_number() over (partition by manager_id, flag, val, island order by season_year) as len
from islands;

create or replace view rebuild.record_obs as
-- ── Career totals over all games ────────────────────────────────────────────
select k as record_key, manager_id, idx, v1, v2, null::text as grp
from rebuild.games g,
lateral (values
  ('total_points', g.pf, null::numeric),
  ('total_opp_points', g.pa, null),
  ('total_wins', g.won::int, null),
  ('total_losses', g.lost::int, null),
  ('high_scores', (g.week_rank = 1)::int, null),
  ('most_weeks_top_scorer', (g.week_rank = 1)::int, null),
  ('most_weeks_second_scorer', (g.week_rank = 2)::int, null),
  ('top_scores', (g.week_rank <= 3)::int, null),
  ('most_weeks_top3', (g.week_rank <= 3)::int, null),
  ('most_weeks_top_quarter', (g.week_rank <= g.week_teams / 4)::int, null),
  ('top_half', (g.week_rank <= g.week_teams / 2)::int, null),
  ('worst_scores', (g.week_rank = g.week_teams)::int, null),
  ('bottom_scores', (g.week_rank > g.week_teams - 3)::int, null),
  ('bottom_half', (g.week_rank > g.week_teams / 2)::int, null),
  ('blowout_wins', (g.margin >= rebuild.setting('blowout_margin'))::int, null),
  ('blowout_losses', (-g.margin >= rebuild.setting('blowout_margin'))::int, null),
  ('narrow_wins', (g.won and g.margin < rebuild.setting('narrow_margin'))::int, null),
  ('narrow_losses', (g.lost and -g.margin < rebuild.setting('narrow_margin'))::int, null),
  ('most_weeks_above_avg', (g.pf > g.week_avg)::int, null),
  ('most_weeks_below_avg', (g.pf < g.week_avg)::int, null),
  ('most_wins_below_avg', (g.won and g.pf < g.week_avg)::int, null),
  ('most_losses_above_avg', (g.lost and g.pf > g.week_avg)::int, null),
  ('most_150plus_games', (g.pf >= 150)::int, null),
  ('most_200plus_games', (g.pf >= 200)::int, null),
  ('most_sub80_games', (g.pf < 80)::int, null),
  ('total_playoff_pts', case when g.is_playoff then g.pf else 0 end, null),
  ('consol_wins', (g.won and g.game_type in ('consolation','fifth_place','toilet_bowl'))::int, null),
  ('most_expected_wins_all', g.allplay_wins::numeric / nullif(g.week_teams - 1, 0), null),
  -- percentages: v1 / v2
  ('high_score_pct', 100 * (g.week_rank = 1)::int, 1),
  ('top_score_pct', 100 * (g.week_rank <= 3)::int, 1),
  ('top_half_pct', 100 * (g.week_rank <= g.week_teams / 2)::int, 1),
  ('worst_score_pct', 100 * (g.week_rank = g.week_teams)::int, 1),
  ('bottom_score_pct', 100 * (g.week_rank > g.week_teams - 3)::int, 1),
  ('bottom_half_pct', 100 * (g.week_rank > g.week_teams / 2)::int, 1)
) v(k, v1, v2)

-- ── Opponent context (all games) ────────────────────────────────────────────
union all
select k, g.manager_id, g.idx, v1, null, null
from rebuild.games g
join rebuild.games o on o.matchup_id = g.matchup_id and o.manager_id = g.opponent_id,
lateral (values
  ('most_games_vs_top_scorer', (o.week_rank = 1)::int),
  ('most_games_vs_bottom_scorer', (o.week_rank = o.week_teams)::int),
  ('most_games_vs_top_half', (o.week_rank <= o.week_teams / 2)::int)
) v(k, v1)

-- ── Regular season rates and averages ───────────────────────────────────────
union all
select k, manager_id, idx, v1, v2, null
from rebuild.games g,
lateral (values
  ('reg_season_wins', g.won::int::numeric, null::numeric),
  ('allplay_wins', g.allplay_wins, null),
  ('allplay_losses', g.allplay_losses, null),
  ('win_pct', 100 * (g.won::int + 0.5 * g.tied::int), 1),
  ('allplay_win_pct', 100.0 * g.allplay_wins, g.week_teams - 1),
  ('career_ppg', g.pf, 1),
  ('hardest_sos', g.pa, 1),
  ('easiest_sos', g.pa, 1),
  ('points_share_avg', 100 * g.pf / (g.week_avg * g.week_teams), 1),
  ('opp_points_share_avg', 100 * g.pa / (g.week_avg * g.week_teams), 1)
) v(k, v1, v2)
where g.game_type = 'reg'

-- ── Single matchups ─────────────────────────────────────────────────────────
union all
select k, manager_id, idx, v1, null, null
from rebuild.games g,
lateral (values
  ('most_matchup_points', g.pf, g.game_type = 'reg'),
  ('fewest_matchup_points', g.pf, g.game_type = 'reg'),
  ('highest_combined_score', g.combined, g.game_type = 'reg'),
  ('lowest_combined_score', g.combined, g.game_type = 'reg'),
  ('biggest_blowout', g.margin, g.game_type = 'reg' and g.won),
  ('narrowest_win', g.margin, g.game_type = 'reg' and g.won),
  ('highest_points_share', 100 * g.share, g.game_type = 'reg'),
  ('lowest_points_share', 100 * g.share, g.game_type = 'reg'),
  ('largest_margin_victory', g.margin, g.won),
  ('smallest_margin_victory', g.margin, g.won),
  ('largest_margin_defeat', -g.margin, g.lost),
  ('smallest_margin_defeat', -g.margin, g.lost),
  ('fewest_points_in_win', g.pf, g.won),
  ('most_points_in_loss', g.pf, g.lost),
  ('most_playoff_matchup_pts', g.pf, g.game_type in ('semifinal','final','third_place')),
  ('fewest_playoff_matchup_pts', g.pf, g.game_type in ('semifinal','final','third_place')),
  ('highest_playoff_combined', g.combined, g.game_type in ('semifinal','final','third_place')),
  ('lowest_playoff_combined', g.combined, g.game_type in ('semifinal','final','third_place')),
  ('biggest_playoff_blowout', g.margin, g.game_type in ('semifinal','final','third_place') and g.won),
  ('narrowest_playoff_win', g.margin, g.game_type in ('semifinal','final','third_place') and g.won)
) v(k, v1, keep)
where keep

-- Largest swing between two consecutive games of a manager
union all
select 'largest_week_swing', manager_id, idx, abs(pf - lag(pf) over (partition by manager_id order by idx)), null, null
from rebuild.games

-- ── Championship bracket ────────────────────────────────────────────────────
union all
select k, manager_id, idx, v1, v2, null
from rebuild.games g,
lateral (values
  ('playoff_wins', g.won::int::numeric, null::numeric),
  ('playoff_losses', g.lost::int, null),
  ('playoff_points', g.pf, null),
  ('playoff_opp_points', g.pa, null),
  ('most_playoff_ppg', g.pf, 1),
  ('best_playoff_win_pct', 100 * g.won::int, 1),
  ('worst_playoff_win_pct', 100 * g.won::int, 1),
  ('most_semifinal_appearances', (g.game_type = 'semifinal')::int, null),
  ('most_semifinal_wins', (g.game_type = 'semifinal' and g.won)::int, null),
  ('most_finals_appearances', (g.game_type = 'final')::int, null),
  ('top_seed_losses_total', (g.seed = 1 and g.lost and g.game_type in ('semifinal','final'))::int, null),
  ('top_seed_losses_semifinal', (g.seed = 1 and g.lost and g.game_type = 'semifinal')::int, null),
  ('top_seed_losses_final', (g.seed = 1 and g.lost and g.game_type = 'final')::int, null),
  ('underdog_wins_semifinal', (g.won and g.seed > g.opponent_seed and g.game_type = 'semifinal')::int, null),
  ('underdog_wins_final', (g.won and g.seed > g.opponent_seed and g.game_type = 'final')::int, null),
  ('most_underdog_wins', (g.won and g.seed > g.opponent_seed)::int, null)
) v(k, v1, v2)
where g.game_type in ('semifinal','final','third_place')

-- ── Season facts (observed at the end of the season) ────────────────────────
union all
select k, sf.manager_id, si.end_idx, v1, v2, null
from rebuild.season_facts sf
join rebuild.season_idx si using (season_year)
left join public.v_luck l on l.season_year = sf.season_year and l.manager_id = sf.manager_id
left join public.v_league_rating r on r.season_year = sf.season_year and r.manager_id = sf.manager_id
left join public.season_results res on res.season_year = sf.season_year and res.manager_id = sf.manager_id,
lateral (values
  ('championships', (sf.final_rank = 1)::int::numeric, null::numeric),
  ('runner_up_finishes', (sf.final_rank = 2)::int, null),
  ('third_place_finishes', (sf.final_rank = 3)::int, null),
  ('toiletbowl_finishes', sf.is_last::int, null),
  ('total_medals', (sf.final_rank <= 3)::int, null),
  ('medal_score', case sf.final_rank when 1 then 3 when 2 then 2 when 3 then 1 else 0 end, null),
  ('playoff_appearances', sf.made_playoffs::int, null),
  ('fewest_playoff_appearances', sf.made_playoffs::int, null),
  ('most_playoff_appearances_no_title', (sf.made_playoffs and sf.final_rank <> 1)::int, null),
  ('reg_season_titles', (sf.reg_rank = 1)::int, null),
  ('winning_record_seasons', (sf.wins > sf.losses)::int, null),
  ('losing_record_seasons', (sf.wins < sf.losses)::int, null),
  ('seasons_played', 1, null),
  ('luckiest', l.luck, null),
  ('unluckiest', l.luck, null),
  ('best_season_luck', l.luck, null),
  ('worst_season_luck', l.luck, null),
  ('most_unlucky_season', l.luck, null),
  ('season_score_best', r.league_rating, null),
  ('season_score_worst', r.league_rating, null),
  ('best_manager_season', r.league_rating, null),
  ('worst_manager_season', r.league_rating, null),
  ('overall_manager_value', r.league_rating, 1),
  ('coach_score_season_best', 100 * res.lineup_efficiency, null),
  ('coach_score_season_worst', 100 * res.lineup_efficiency, null),
  ('coach_score_alltime', 100 * res.lineup_efficiency, 1),
  ('coach_score_worst_alltime', 100 * res.lineup_efficiency, 1),
  ('optimal_pts_missed_all', res.max_points_for - res.points_for, null),
  ('optimal_pts_missed_season', res.max_points_for - res.points_for, null),
  ('most_transactions', res.moves, null),
  ('best_moves_season', res.moves, null),
  ('most_trades', res.trades, null),
  ('best_trade_season_count', res.trades, null),
  ('lowest_seed_champion', case when sf.final_rank = 1 then sf.seed end, null),
  ('worst_champion_record', case when sf.final_rank = 1 then 100.0 * sf.wins / nullif(sf.wins + sf.losses + sf.ties, 0) end, null)
) v(k, v1, v2)
where v1 is not null

-- Season titles decided by the regular season
union all
select k, sf.manager_id, si.reg_end_idx, v1, null, null
from (
  select season_year, manager_id,
         rank() over (partition by season_year order by sum(pf) desc) as pts_rank,
         rank() over (partition by season_year order by sum(allplay_wins) desc) as ap_rank
  from rebuild.games where game_type = 'reg' group by 1,2
) sf
join rebuild.season_idx si using (season_year),
lateral (values
  ('season_pts_titles', (sf.pts_rank = 1)::int::numeric),
  ('season_ap_titles', (sf.ap_rank = 1)::int)
) v(k, v1)

-- ── Single season (regular season, season-to-date) ──────────────────────────
union all
select k, manager_id, idx, v1, null, null
from (
  select g.*,
    sum(won::int) over s as wins, sum(lost::int) over s as losses,
    sum(pf) over s as pts, sum(pa) over s as opp_pts,
    sum(allplay_wins) over s as apw, sum(allplay_losses) over s as apl,
    sum((week_rank = 1)::int) over s as highs, sum((week_rank <= 3)::int) over s as tops,
    sum((week_rank <= week_teams / 2)::int) over s as top_half,
    sum((week_rank = week_teams)::int) over s as worst,
    sum((week_rank > week_teams - 3)::int) over s as bottoms,
    sum((week_rank > week_teams / 2)::int) over s as bottom_half,
    sum((margin >= rebuild.setting('blowout_margin'))::int) over s as bw,
    sum((-margin >= rebuild.setting('blowout_margin'))::int) over s as bl,
    sum((won and margin < rebuild.setting('narrow_margin'))::int) over s as nw,
    sum((lost and -margin < rebuild.setting('narrow_margin'))::int) over s as nl,
    sum(allplay_wins::numeric / nullif(week_teams - 1, 0)) over s as xw,
    sum((pf > week_median)::int) over s as above_med,
    sum((pf < week_median)::int) over s as below_med
  from rebuild.games g where game_type = 'reg'
  window s as (partition by season_year, manager_id order by week)
) t,
lateral (values
  ('most_season_wins', wins::numeric), ('most_season_losses', losses),
  ('most_season_points', pts), ('most_season_opp_pts', opp_pts),
  ('most_season_ap_wins', apw), ('most_season_ap_losses', apl),
  ('most_season_high_scores', highs), ('most_season_top_scores', tops),
  ('most_season_top_half', top_half), ('most_season_worst_scores', worst),
  ('most_season_bottom_scores', bottoms), ('most_season_bottom_half', bottom_half),
  ('most_season_blowout_wins', bw), ('most_season_blowout_losses', bl),
  ('most_season_narrow_wins', nw), ('most_season_narrow_losses', nl),
  ('most_expected_wins_season', xw),
  ('most_weeks_above_median_season', above_med), ('most_weeks_below_median_season', below_med)
) v(k, v1)

-- Completed regular seasons only (minimums and averages)
union all
select k, manager_id, si.reg_end_idx, v1, null, null
from (
  select season_year, manager_id,
    sum(pf) pts, sum(pa) opp_pts, avg(pf) ppg, avg(pa) sos, stddev_samp(pf) sd,
    100.0 * sum(allplay_wins) / nullif(sum(allplay_wins + allplay_losses), 0) ap_pct,
    100 * sum(pf) / sum(week_avg * week_teams) pts_share,
    100 * sum(pa) / sum(week_avg * week_teams) opp_share
  from rebuild.games where game_type = 'reg' group by 1,2
) t
join rebuild.season_idx si using (season_year),
lateral (values
  ('fewest_season_points', pts), ('fewest_season_opp_pts', opp_pts),
  ('best_ppg', ppg), ('worst_ppg', ppg),
  ('hardest_season_sos', sos), ('easiest_season_sos', sos),
  ('best_season_ap_pct', ap_pct),
  ('highest_season_pts_share', pts_share), ('lowest_season_pts_share', pts_share),
  ('highest_season_opp_pts_share', opp_share), ('lowest_season_opp_pts_share', opp_share),
  ('most_consistent_season', sd), ('least_consistent_season', sd)
) v(k, v1)

-- Career distribution of regular season scores
union all
select k, manager_id, idx, pf, null, null
from rebuild.games, lateral (values
  ('highest_median_score'), ('lowest_median_score'), ('most_consistent_team'), ('least_consistent_team')
) v(k)
where game_type = 'reg'

-- ── Standings ───────────────────────────────────────────────────────────────
union all
select k, manager_id, idx, v1, null, null
from rebuild.standings_weeks, lateral (values
  ('most_weeks_first_place', (standing = 1)::int::numeric),
  ('most_weeks_last_place', (standing = teams)::int)
) v(k, v1)
union all
select 'most_weeks_first_place_season', manager_id, idx,
       sum((standing = 1)::int) over (partition by season_year, manager_id order by week), null, null
from rebuild.standings_weeks
union all
select 'wire_to_wire_champion', sf.manager_id, si.end_idx,
       (sf.final_rank = 1 and bool_and(sw.standing = 1))::int, null, null
from rebuild.season_facts sf
join rebuild.season_idx si using (season_year)
join rebuild.standings_weeks sw on sw.season_year = sf.season_year and sw.manager_id = sf.manager_id
group by sf.season_year, sf.manager_id, sf.final_rank, si.end_idx

-- ── Streaks and droughts ────────────────────────────────────────────────────
union all
select flag || case when val then '_streak' else '_drought' end, manager_id, idx, len, null, null
from rebuild.game_streaks
where (flag in ('win','loss') and val) or flag in ('high_score','top_half','top_score')
union all
select flag || case when val then '_start_streak' else '' end, manager_id, idx, len, null, null
from (
  select gs.*, bool_and(gs.val) over (partition by gs.manager_id, gs.flag, gs.season_year order by gs.week) as from_start
  from rebuild.game_streaks gs join rebuild.games g using (manager_id, idx)
  where flag in ('win','loss') and g.game_type = 'reg'
) t
where from_start and val
union all
select flag || case when val then '_streak' else '_drought' end, manager_id, idx, len, null, null
from rebuild.season_streaks

-- ── Head to head (all games, grouped by opponent) ───────────────────────────
union all
select k, manager_id, idx, v1, null, opponent_id
from rebuild.games, lateral (values
  ('most_h2h_wins', won::int::numeric), ('fewest_h2h_wins', won::int),
  ('most_h2h_losses', lost::int), ('fewest_h2h_losses', lost::int),
  ('most_h2h_points', pf), ('fewest_h2h_points', pf)
) v(k, v1)

-- ── Lineups ─────────────────────────────────────────────────────────────────
union all
select k, lw.manager_id, lw.idx, v1, v2, null
from rebuild.lineup_weeks lw
join rebuild.games g on g.manager_id = lw.manager_id and g.idx = lw.idx,
lateral (values
  ('most_' || lower(lw.pos) || '_all_points', lw.pts, null::numeric),
  ('most_' || lower(lw.pos) || '_week_points', lw.pts, null),
  ('fewest_bench_week_points', case when lw.pos = 'BENCH' then lw.pts end, null),
  ('fewest_bench_all_points', case when lw.pos = 'BENCH' then lw.pts end, null),
  ('most_bench_pts_in_loss', case when lw.pos = 'BENCH' and g.lost then lw.pts end, null),
  ('most_bench_pts_in_win', case when lw.pos = 'BENCH' and g.won then lw.pts end, null),
  (lower(lw.pos) || '_avg_pts_all', lw.pts, lw.slots),
  (lower(lw.pos) || '_avg_pts_worst', lw.pts, lw.slots)
) v(k, v1, v2)
where v1 is not null and lw.pos <> 'FLEX'
union all
select k, manager_id, idx, v1, null, null
from (
  select lw.*, sum(pts) over (partition by season_year, manager_id, pos order by week) as season_pts
  from rebuild.lineup_weeks lw
) t, lateral (values
  ('most_' || lower(pos) || '_season_points', season_pts)
) v(k, v1)
where pos <> 'FLEX'
union all
select k, manager_id, si.reg_end_idx, v1, null, null
from (
  select season_year, manager_id, pos, sum(pts) pts, sum(pts) / sum(slots) avg_pts
  from rebuild.lineup_weeks where week <= 14 group by 1,2,3
) t join rebuild.season_idx si using (season_year),
lateral (values
  (lower(pos) || '_avg_pts_season', avg_pts),
  (lower(pos) || '_avg_pts_season_worst', avg_pts),
  ('fewest_bench_points_season', case when pos = 'BENCH' then pts end)
) v(k, v1)
where v1 is not null and pos not in ('FLEX', 'BENCH') or (pos = 'BENCH' and k = 'fewest_bench_points_season')

-- Weekly position leaders (highest starter points at a position that week)
union all
select 'most_weekly_leaders_' || lower(pos) || suffix, manager_id, idx, v1, null, null
from (
  select t.*, sum(leader) over (partition by season_year, manager_id, pos order by week) as season_leader
  from (
    select lw.*, (rank() over (partition by season_year, week, pos order by pts desc) = 1)::int as leader
    from rebuild.lineup_weeks lw where pos <> 'BENCH'
  ) t
) t, lateral (values
  ('_all', leader::numeric),
  ('_season', season_leader)
) v(suffix, v1)

-- Single players
union all
select 'top_player_week', l.manager_id, w.idx, l.points, null, null
from public.weekly_lineups l join rebuild.weeks w using (season_year, week)
where l.is_starter
union all
select k, manager_id, idx, v1, null, null
from (
  select l.manager_id, l.season_year, w.idx, l.player_name,
         sum(l.points) over (partition by l.manager_id, l.season_year, l.player_name order by w.idx) as season_pts,
         sum(l.points) over (partition by l.manager_id, l.player_name order by w.idx) as career_pts
  from public.weekly_lineups l join rebuild.weeks w using (season_year, week)
  where l.is_starter
) t, lateral (values
  ('top_player_season', season_pts), ('most_points_single_player_season', season_pts),
  ('most_points_single_player_career', career_pts)
) v(k, v1)
union all
select 'highest_pct_single_player_season', p.manager_id, si.end_idx, 100 * max(p.pts) / max(t.pts), null, null
from (
  select manager_id, season_year, player_name, sum(points) pts
  from public.weekly_lineups where is_starter group by 1,2,3
) p
join (select manager_id, season_year, sum(points) pts from public.weekly_lineups where is_starter group by 1,2) t
  using (manager_id, season_year)
join rebuild.season_idx si using (season_year)
group by p.manager_id, si.end_idx
union all
select 'most_different_players_season', l.manager_id, si.end_idx, count(distinct l.player_name), null, null
from public.weekly_lineups l join rebuild.season_idx si using (season_year)
where l.is_starter group by l.manager_id, si.end_idx

-- ── Draft (observed in week 1 of the season) ────────────────────────────────
union all
select k, d.manager_id, si.start_idx, v1, v2, null
from public.draft_picks d join rebuild.season_idx si using (season_year),
lateral (values
  ('overall_draft_value', d.grade4, 1::numeric),
  (lower(d.position) || '_draft_value', d.grade4, 1),
  ('best_draft_pick_ever', d.grade4, null),
  ('worst_draft_pick_ever', d.grade4, null),
  ('best_' || lower(d.position) || '_draft_pick', d.grade4, null),
  ('worst_' || lower(d.position) || '_draft_pick', d.grade4, null),
  ('most_first_round_' || lower(d.position) || 's', (d.round = 1)::int, null)
) v(k, v1, v2)
union all
select k, manager_id, si.start_idx, v1, null, null
from (
  select season_year, manager_id, position, avg(grade4) g from public.draft_picks group by 1,2,3
  union all
  select season_year, manager_id, null, avg(grade4) from public.draft_picks group by 1,2
) t join rebuild.season_idx si using (season_year),
lateral (values
  ('best_' || coalesce(lower(position) || '_', '') || 'draft_season', g),
  ('worst_' || coalesce(lower(position) || '_', '') || 'draft_season', g)
) v(k, v1)
union all
select k, r.manager_id, si.start_idx, v1, v2, null
from public.season_results r join rebuild.season_idx si using (season_year),
lateral (values
  ('highest_avg_draft_pos', r.draft_position::numeric, 1::numeric),
  ('lowest_avg_draft_pos', r.draft_position, 1),
  ('most_first_overall_picks', (r.draft_position = 1)::int, null)
) v(k, v1, v2)
where r.draft_position is not null

-- ── Transactions ────────────────────────────────────────────────────────────
union all
select k, t.team_name, w.idx, v1, null, null
from public.v_transaction_values t
join rebuild.weeks w on w.season_year = t.season_year and w.week = least(greatest(coalesce(t.transaction_week, 1), 1), 16),
lateral (values
  ('best_trade_value', case when t.transaction_type = 'trade' then t.net_value end),
  ('worst_trade_value', case when t.transaction_type = 'trade' then t.net_value end),
  ('top_waiver_value', case when t.transaction_type <> 'trade' then t.net_value end),
  ('worst_waivers', case when t.transaction_type <> 'trade' then t.net_value end),
  ('best_waiver_pickup', case when t.transaction_type <> 'trade' then t.net_value end)
) v(k, v1)
where v1 is not null
union all
select k, team_name, si.end_idx, v1, null, null
from (
  select season_year, team_name,
         sum(net_value) filter (where transaction_type = 'trade') trade_v,
         sum(net_value) filter (where transaction_type <> 'trade') waiver_v
  from public.v_transaction_values group by 1,2
) t join rebuild.season_idx si using (season_year),
lateral (values
  ('best_trade_season_value', trade_v), ('worst_trade_season_value', trade_v),
  ('best_waiver_season', waiver_v), ('worst_waiver_season', waiver_v)
) v(k, v1)
where v1 is not null;

-- >>> 20261013_04_rebuild_record_defs.sql
-- Part 4: which aggregation and direction each record uses.
-- Labels are taken from the existing record_timeline where available.

truncate rebuild.record_defs;

insert into rebuild.record_defs (record_key, record_label, agg, direction, positive_only, min_obs)
select d.key, coalesce(l.record_label, d.key), d.agg, d.dir, d.pos, d.min_obs
from (values
  -- career totals
  ('total_points','sum','max',true,1), ('total_opp_points','sum','max',true,1),
  ('total_wins','sum','max',true,1), ('total_losses','sum','max',true,1), ('reg_season_wins','sum','max',true,1),
  ('allplay_wins','sum','max',true,1), ('allplay_losses','sum','max',true,1),
  ('high_scores','sum','max',true,1), ('top_scores','sum','max',true,1), ('top_half','sum','max',true,1),
  ('worst_scores','sum','max',true,1), ('bottom_scores','sum','max',true,1), ('bottom_half','sum','max',true,1),
  ('blowout_wins','sum','max',true,1), ('blowout_losses','sum','max',true,1),
  ('narrow_wins','sum','max',true,1), ('narrow_losses','sum','max',true,1),
  ('most_weeks_top_scorer','sum','max',true,1), ('most_weeks_second_scorer','sum','max',true,1),
  ('most_weeks_top3','sum','max',true,1), ('most_weeks_top_quarter','sum','max',true,1),
  ('most_weeks_above_avg','sum','max',true,1), ('most_weeks_below_avg','sum','max',true,1),
  ('most_wins_below_avg','sum','max',true,1), ('most_losses_above_avg','sum','max',true,1),
  ('most_150plus_games','sum','max',true,1), ('most_200plus_games','sum','max',true,1), ('most_sub80_games','sum','max',true,1),
  ('most_games_vs_top_scorer','sum','max',true,1), ('most_games_vs_bottom_scorer','sum','max',true,1),
  ('most_games_vs_top_half','sum','max',true,1), ('most_expected_wins_all','sum','max',true,1),
  ('total_playoff_pts','sum','max',true,1), ('consol_wins','sum','max',true,1),
  -- rates (regular season unless noted)
  ('win_pct','ratio','max',false,1), ('allplay_win_pct','ratio','max',false,1), ('career_ppg','ratio','max',false,1),
  ('hardest_sos','ratio','max',false,1), ('easiest_sos','ratio','min',false,1),
  ('points_share_avg','ratio','max',false,1), ('opp_points_share_avg','ratio','max',false,1),
  ('high_score_pct','ratio','max',false,1), ('top_score_pct','ratio','max',false,1), ('top_half_pct','ratio','max',false,1),
  ('worst_score_pct','ratio','max',false,1), ('bottom_score_pct','ratio','max',false,1), ('bottom_half_pct','ratio','max',false,1),
  -- single matchups
  ('most_matchup_points','max','max',false,1), ('fewest_matchup_points','min','min',false,1),
  ('highest_combined_score','max','max',false,1), ('lowest_combined_score','min','min',false,1),
  ('biggest_blowout','max','max',false,1), ('narrowest_win','min','min',false,1),
  ('highest_points_share','max','max',false,1), ('lowest_points_share','min','min',false,1),
  ('largest_margin_victory','max','max',false,1), ('smallest_margin_victory','min','min',false,1),
  ('largest_margin_defeat','max','max',false,1), ('smallest_margin_defeat','min','min',false,1),
  ('fewest_points_in_win','min','min',false,1), ('most_points_in_loss','max','max',false,1),
  ('most_playoff_matchup_pts','max','max',false,1), ('fewest_playoff_matchup_pts','min','min',false,1),
  ('highest_playoff_combined','max','max',false,1), ('lowest_playoff_combined','min','min',false,1),
  ('biggest_playoff_blowout','max','max',false,1), ('narrowest_playoff_win','min','min',false,1),
  ('largest_week_swing','max','max',false,1),
  -- championship bracket
  ('playoff_wins','sum','max',true,1), ('playoff_losses','sum','max',true,1),
  ('playoff_points','sum','max',true,1), ('playoff_opp_points','sum','max',true,1),
  ('most_playoff_ppg','ratio','max',false,1),
  ('best_playoff_win_pct','ratio','max',false,1), ('worst_playoff_win_pct','ratio','min',false,1),
  ('most_semifinal_appearances','sum','max',true,1), ('most_semifinal_wins','sum','max',true,1),
  ('most_finals_appearances','sum','max',true,1),
  ('top_seed_losses_total','sum','max',true,1), ('top_seed_losses_semifinal','sum','max',true,1),
  ('top_seed_losses_final','sum','max',true,1),
  ('underdog_wins_semifinal','sum','max',true,1), ('underdog_wins_final','sum','max',true,1),
  ('most_underdog_wins','sum','max',true,1),
  -- season facts
  ('championships','sum','max',true,1), ('runner_up_finishes','sum','max',true,1),
  ('third_place_finishes','sum','max',true,1), ('toiletbowl_finishes','sum','max',true,1),
  ('total_medals','sum','max',true,1), ('medal_score','sum','max',true,1),
  ('playoff_appearances','sum','max',true,1), ('fewest_playoff_appearances','sum','min',false,1),
  ('most_playoff_appearances_no_title','sum','max',true,1),
  ('reg_season_titles','sum','max',true,1), ('season_pts_titles','sum','max',true,1), ('season_ap_titles','sum','max',true,1),
  ('winning_record_seasons','sum','max',true,1), ('losing_record_seasons','sum','max',true,1),
  ('seasons_played','sum','max',true,1),
  ('luckiest','sum','max',false,1), ('unluckiest','sum','min',false,1),
  ('best_season_luck','max','max',false,1), ('worst_season_luck','min','min',false,1), ('most_unlucky_season','min','min',false,1),
  ('season_score_best','max','max',false,1), ('season_score_worst','min','min',false,1),
  ('best_manager_season','max','max',false,1), ('worst_manager_season','min','min',false,1),
  ('overall_manager_value','ratio','max',false,1),
  ('coach_score_season_best','max','max',false,1), ('coach_score_season_worst','min','min',false,1),
  ('coach_score_alltime','ratio','max',false,1), ('coach_score_worst_alltime','ratio','min',false,1),
  ('optimal_pts_missed_all','sum','max',true,1), ('optimal_pts_missed_season','max','max',false,1),
  ('most_transactions','sum','max',true,1), ('best_moves_season','max','max',true,1),
  ('most_trades','sum','max',true,1), ('best_trade_season_count','max','max',true,1),
  ('lowest_seed_champion','max','max',false,1), ('worst_champion_record','min','min',false,1),
  ('wire_to_wire_champion','sum','max',true,1),
  -- single season
  ('most_season_wins','max','max',true,1), ('most_season_losses','max','max',true,1),
  ('most_season_points','max','max',true,1), ('most_season_opp_pts','max','max',true,1),
  ('most_season_ap_wins','max','max',true,1), ('most_season_ap_losses','max','max',true,1),
  ('most_season_high_scores','max','max',true,1), ('most_season_top_scores','max','max',true,1),
  ('most_season_top_half','max','max',true,1), ('most_season_worst_scores','max','max',true,1),
  ('most_season_bottom_scores','max','max',true,1), ('most_season_bottom_half','max','max',true,1),
  ('most_season_blowout_wins','max','max',true,1), ('most_season_blowout_losses','max','max',true,1),
  ('most_season_narrow_wins','max','max',true,1), ('most_season_narrow_losses','max','max',true,1),
  ('most_expected_wins_season','max','max',true,1),
  ('most_weeks_above_median_season','max','max',true,1), ('most_weeks_below_median_season','max','max',true,1),
  ('most_weeks_first_place_season','max','max',true,1),
  ('fewest_season_points','min','min',false,1), ('fewest_season_opp_pts','min','min',false,1),
  ('best_ppg','max','max',false,1), ('worst_ppg','min','min',false,1),
  ('hardest_season_sos','max','max',false,1), ('easiest_season_sos','min','min',false,1),
  ('best_season_ap_pct','max','max',false,1),
  ('highest_season_pts_share','max','max',false,1), ('lowest_season_pts_share','min','min',false,1),
  ('highest_season_opp_pts_share','max','max',false,1), ('lowest_season_opp_pts_share','min','min',false,1),
  ('most_consistent_season','min','min',false,1), ('least_consistent_season','max','max',false,1),
  -- career score distribution
  ('highest_median_score','median','max',false,5), ('lowest_median_score','median','min',false,5),
  ('most_consistent_team','stddev','min',false,5), ('least_consistent_team','stddev','max',false,5),
  -- standings
  ('most_weeks_first_place','sum','max',true,1), ('most_weeks_last_place','sum','max',true,1),
  -- streaks and droughts
  ('win_streak','max','max',true,1), ('loss_streak','max','max',true,1),
  ('win_start_streak','max','max',true,1), ('loss_start_streak','max','max',true,1),
  ('high_score_streak','max','max',true,1), ('high_score_drought','max','max',true,1),
  ('top_half_streak','max','max',true,1), ('top_half_drought','max','max',true,1),
  ('top_score_streak','max','max',true,1), ('top_score_drought','max','max',true,1),
  ('championship_streak','max','max',true,1), ('championship_drought','max','max',true,1),
  ('medal_streak','max','max',true,1), ('medal_drought','max','max',true,1),
  ('playoff_appearance_streak','max','max',true,1), ('playoff_appearance_drought','max','max',true,1),
  ('title_game_streak','max','max',true,1), ('title_game_drought','max','max',true,1),
  ('winning_record_streak','max','max',true,1), ('winning_record_drought','max','max',true,1),
  -- head to head
  ('most_h2h_wins','group_max','max',true,1), ('fewest_h2h_wins','group_min','min',false,1),
  ('most_h2h_losses','group_max','max',true,1), ('fewest_h2h_losses','group_min','min',false,1),
  ('most_h2h_points','group_max','max',true,1), ('fewest_h2h_points','group_min','min',false,1),
  -- lineups
  ('most_qb_all_points','sum','max',true,1), ('most_rb_all_points','sum','max',true,1),
  ('most_wr_all_points','sum','max',true,1), ('most_te_all_points','sum','max',true,1),
  ('most_k_all_points','sum','max',true,1), ('most_dst_all_points','sum','max',true,1),
  ('most_bench_all_points','sum','max',true,1), ('fewest_bench_all_points','sum','min',false,1),
  ('most_qb_week_points','max','max',false,1), ('most_rb_week_points','max','max',false,1),
  ('most_wr_week_points','max','max',false,1), ('most_te_week_points','max','max',false,1),
  ('most_k_week_points','max','max',false,1), ('most_dst_week_points','max','max',false,1),
  ('most_bench_week_points','max','max',false,1), ('fewest_bench_week_points','min','min',false,1),
  ('most_bench_pts_in_loss','sum','max',true,1), ('most_bench_pts_in_win','sum','max',true,1),
  ('qb_avg_pts_all','ratio','max',false,1), ('rb_avg_pts_all','ratio','max',false,1),
  ('wr_avg_pts_all','ratio','max',false,1), ('te_avg_pts_all','ratio','max',false,1),
  ('k_avg_pts_all','ratio','max',false,1), ('dst_avg_pts_all','ratio','max',false,1),
  ('qb_avg_pts_worst','ratio','min',false,1), ('rb_avg_pts_worst','ratio','min',false,1),
  ('wr_avg_pts_worst','ratio','min',false,1), ('te_avg_pts_worst','ratio','min',false,1),
  ('k_avg_pts_worst','ratio','min',false,1), ('dst_avg_pts_worst','ratio','min',false,1),
  ('most_qb_season_points','max','max',true,1), ('most_rb_season_points','max','max',true,1),
  ('most_wr_season_points','max','max',true,1), ('most_te_season_points','max','max',true,1),
  ('most_k_season_points','max','max',true,1), ('most_dst_season_points','max','max',true,1),
  ('most_bench_season_points','max','max',true,1), ('fewest_bench_points_season','min','min',false,1),
  ('qb_avg_pts_season','max','max',false,1), ('rb_avg_pts_season','max','max',false,1),
  ('wr_avg_pts_season','max','max',false,1), ('te_avg_pts_season','max','max',false,1),
  ('k_avg_pts_season','max','max',false,1), ('dst_avg_pts_season','max','max',false,1),
  ('qb_avg_pts_season_worst','min','min',false,1), ('rb_avg_pts_season_worst','min','min',false,1),
  ('wr_avg_pts_season_worst','min','min',false,1), ('te_avg_pts_season_worst','min','min',false,1),
  ('k_avg_pts_season_worst','min','min',false,1), ('dst_avg_pts_season_worst','min','min',false,1),
  ('most_weekly_leaders_qb_all','sum','max',true,1), ('most_weekly_leaders_rb_all','sum','max',true,1),
  ('most_weekly_leaders_wr_all','sum','max',true,1), ('most_weekly_leaders_te_all','sum','max',true,1),
  ('most_weekly_leaders_flex_all','sum','max',true,1), ('most_weekly_leaders_k_all','sum','max',true,1),
  ('most_weekly_leaders_dst_all','sum','max',true,1),
  ('most_weekly_leaders_qb_season','max','max',true,1), ('most_weekly_leaders_rb_season','max','max',true,1),
  ('most_weekly_leaders_wr_season','max','max',true,1), ('most_weekly_leaders_te_season','max','max',true,1),
  ('most_weekly_leaders_flex_season','max','max',true,1), ('most_weekly_leaders_k_season','max','max',true,1),
  ('most_weekly_leaders_dst_season','max','max',true,1),
  ('top_player_week','max','max',false,1), ('top_player_season','max','max',false,1),
  ('most_points_single_player_season','max','max',false,1), ('most_points_single_player_career','max','max',false,1),
  ('highest_pct_single_player_season','max','max',false,1), ('most_different_players_season','max','max',false,1),
  -- draft
  ('overall_draft_value','ratio','max',false,1),
  ('qb_draft_value','ratio','max',false,1), ('rb_draft_value','ratio','max',false,1),
  ('wr_draft_value','ratio','max',false,1), ('te_draft_value','ratio','max',false,1),
  ('k_draft_value','ratio','max',false,1), ('dst_draft_value','ratio','max',false,1),
  ('best_draft_season','max','max',false,1), ('worst_draft_season','min','min',false,1),
  ('best_qb_draft_season','max','max',false,1), ('worst_qb_draft_season','min','min',false,1),
  ('best_rb_draft_season','max','max',false,1), ('worst_rb_draft_season','min','min',false,1),
  ('best_wr_draft_season','max','max',false,1), ('worst_wr_draft_season','min','min',false,1),
  ('best_te_draft_season','max','max',false,1), ('worst_te_draft_season','min','min',false,1),
  ('best_k_draft_season','max','max',false,1), ('worst_k_draft_season','min','min',false,1),
  ('best_dst_draft_season','max','max',false,1), ('worst_dst_draft_season','min','min',false,1),
  ('best_draft_pick_ever','max','max',false,1), ('worst_draft_pick_ever','min','min',false,1),
  ('best_qb_draft_pick','max','max',false,1), ('worst_qb_draft_pick','min','min',false,1),
  ('best_rb_draft_pick','max','max',false,1), ('worst_rb_draft_pick','min','min',false,1),
  ('best_wr_draft_pick','max','max',false,1), ('worst_wr_draft_pick','min','min',false,1),
  ('best_te_draft_pick','max','max',false,1), ('worst_te_draft_pick','min','min',false,1),
  ('best_k_draft_pick','max','max',false,1), ('worst_k_draft_pick','min','min',false,1),
  ('best_dst_draft_pick','max','max',false,1), ('worst_dst_draft_pick','min','min',false,1),
  ('most_first_round_qbs','sum','max',true,1), ('most_first_round_rbs','sum','max',true,1),
  ('most_first_round_wrs','sum','max',true,1), ('most_first_round_tes','sum','max',true,1),
  ('highest_avg_draft_pos','ratio','max',false,1), ('lowest_avg_draft_pos','ratio','min',false,1),
  ('most_first_overall_picks','sum','max',true,1),
  -- transactions
  ('best_trade_value','sum','max',false,1), ('worst_trade_value','sum','min',false,1),
  ('best_trade_season_value','max','max',false,1), ('worst_trade_season_value','min','min',false,1),
  ('top_waiver_value','sum','max',false,1), ('worst_waivers','sum','min',false,1),
  ('best_waiver_pickup','max','max',false,1),
  ('best_waiver_season','max','max',false,1), ('worst_waiver_season','min','min',false,1)
) d(key, agg, dir, pos, min_obs)
left join (select distinct record_key, record_label from public.record_timeline) l on l.record_key = d.key;

-- >>> 20261013_05_rebuild_performance.sql
-- Part 5: performance. The record views are evaluated once into cache
-- tables at the start of compute_records(); everything else reads the caches.
-- Holder periods are built set-based instead of row-by-row updates.

-- Source views (the original definitions) ...
create or replace view rebuild.games_source as
with sides as (
  select m.id as matchup_id, m.season_year, m.week, m.is_playoff,
         m.manager_a as manager_id, m.manager_b as opponent_id,
         m.score_a::numeric as pf, m.score_b::numeric as pa
  from public.weekly_matchups m
  union all
  select m.id, m.season_year, m.week, m.is_playoff,
         m.manager_b, m.manager_a, m.score_b::numeric, m.score_a::numeric
  from public.weekly_matchups m
),
week_stats as (
  select season_year, week, avg(pf) as week_avg,
         percentile_cont(0.5) within group (order by pf) as week_median,
         count(*) as week_teams
  from sides group by season_year, week
)
select
  s.*,
  w.idx,
  s.pf > s.pa as won,
  s.pf < s.pa as lost,
  s.pf = s.pa as tied,
  s.pf - s.pa as margin,
  s.pf + s.pa as combined,
  case when s.pf + s.pa > 0 then s.pf / (s.pf + s.pa) end as share,
  (rank() over (partition by s.season_year, s.week order by s.pf desc))::int as week_rank,  -- 1 = top score
  (rank() over (partition by s.season_year, s.week order by s.pf asc) - 1)::int as allplay_wins,
  (rank() over (partition by s.season_year, s.week order by s.pf desc) - 1)::int as allplay_losses,
  ws.week_avg, ws.week_median, ws.week_teams::int,
  me.seed, op.seed as opponent_seed,
  me.final_rank, op.final_rank as opponent_final_rank,
  case
    when not s.is_playoff then 'reg'
    when s.week = w.reg_season_weeks + 1 and me.seed <= 4 and op.seed <= 4 then 'semifinal'
    when s.week = w.reg_season_weeks + 1 then 'consolation'
    when least(me.final_rank, op.final_rank) = 1 then 'final'
    when least(me.final_rank, op.final_rank) = 3 then 'third_place'
    when least(me.final_rank, op.final_rank) = 5 then 'fifth_place'
    else 'toilet_bowl'
  end as game_type
from sides s
join week_stats ws on ws.season_year = s.season_year and ws.week = s.week
join rebuild.weeks w on w.season_year = s.season_year and w.week = s.week
join rebuild.season_facts me on me.season_year = s.season_year and me.manager_id = s.manager_id
join rebuild.season_facts op on op.season_year = s.season_year and op.manager_id = s.opponent_id;

create or replace view rebuild.lineup_source as
select l.season_year, l.week, w.idx, l.manager_id,
       case when not l.is_starter then 'BENCH'
            when l.slot in ('RB1','RB2') then 'RB'
            when l.slot in ('WR1','WR2') then 'WR'
            else l.slot end as pos,
       sum(l.points)::numeric as pts,
       count(*) as slots
from public.weekly_lineups l
join rebuild.weeks w on w.season_year = l.season_year and w.week = l.week
group by 1,2,3,4,5;

-- ... cache tables filled from them ...
create table if not exists rebuild.games_cache as select * from rebuild.games_source with no data;
create table if not exists rebuild.lineup_cache as select * from rebuild.lineup_source with no data;
truncate rebuild.games_cache;
insert into rebuild.games_cache select * from rebuild.games_source;
truncate rebuild.lineup_cache;
insert into rebuild.lineup_cache select * from rebuild.lineup_source;
create index if not exists games_cache_mgr_idx on rebuild.games_cache (manager_id, idx);
create index if not exists games_cache_matchup_idx on rebuild.games_cache (matchup_id, manager_id);
create index if not exists lineup_cache_mgr_idx on rebuild.lineup_cache (manager_id, idx);

-- ... and the public names now read the caches
create or replace view rebuild.games as select * from rebuild.games_cache;
create or replace view rebuild.lineup_weeks as select * from rebuild.lineup_cache;

create table if not exists rebuild.obs_cache (
  record_key text, manager_id text, idx int, v1 numeric, v2 numeric, grp text
);
create index if not exists obs_cache_key_idx on rebuild.obs_cache (record_key, manager_id, idx);

create table if not exists rebuild.record_holders (
  record_key text, idx int, manager_id text, value numeric,
  primary key (record_key, idx)
);

create or replace function rebuild.compute_records() returns void
language plpgsql as $$
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
$$;

-- ============================================================================
-- Schritt 2 (separat ausführen, dauert evtl. 1-2 Minuten):
--
--   select rebuild.compute_records();
--
-- Ergebnis ansehen, z. B.:
--
--   select record_label, manager_id, record_value, from_year, from_week
--   from rebuild.record_timeline_new where is_current order by record_label;
-- ============================================================================
