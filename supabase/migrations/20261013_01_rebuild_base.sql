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
  p.seed,
  p.final_rank,
  p.final_rank = max(p.final_rank) over (partition by r.season_year) as is_last,
  p.seed <= s.playoff_teams as made_playoffs
from public.season_results r
join public.playoff_results p on p.season_year = r.season_year and p.manager_id = r.manager_id
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
