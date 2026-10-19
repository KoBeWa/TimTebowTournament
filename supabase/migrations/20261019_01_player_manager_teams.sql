-- NFL team(s) of a player while he was on a manager's roster (manager pages).
-- Weekly team from nflverse stats; weeks without a stat line use the
-- player's main team of that season. Already applied in Supabase.
create materialized view if not exists public.mv_player_manager_teams as
with season_team as (
  select player_id, season, mode() within group (order by team) as team
  from public.player_weekly_stats where team is not null
  group by player_id, season
),
games as (
  select g.player_key, g.manager_id, g.season_year, g.week,
         coalesce(w.team, st.team) as team
  from public.mv_player_games g
  left join public.player_weekly_stats w
    on w.player_id = g.player_key and w.season = g.season_year and w.week = g.week and w.season_type = 'REG'
  left join season_team st on st.player_id = g.player_key and st.season = g.season_year
  where g.player_key like '00-%'
),
firsts as (
  select player_key, manager_id, team, min(season_year * 100 + week) as first_seen
  from games where team is not null
  group by player_key, manager_id, team
)
select player_key, manager_id, string_agg(team, '/' order by first_seen) as teams
from firsts group by player_key, manager_id;
create index if not exists mv_player_manager_teams_mgr on public.mv_player_manager_teams (manager_id);
grant select on public.mv_player_manager_teams to anon, authenticated;

create or replace function public.refresh_player_stats() returns void
language plpgsql security definer set search_path = public as $$
begin
  refresh materialized view public.mv_player_games;
  refresh materialized view public.mv_player_events;
  refresh materialized view public.mv_player_manager_stats;
  refresh materialized view public.mv_player_summary;
  refresh materialized view public.mv_player_manager_teams;
end;
$$;
