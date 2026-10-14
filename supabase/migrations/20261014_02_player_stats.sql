-- Player pages: every player gets one key across lineups, draft and transactions
--   gsis id (nflverse) for players, 'DST:<team name>' for defenses,
--   'N:<name>' when no id is known.
-- The materialized views are refreshed by public.refresh_player_stats(), which
-- the weekly sync calls after refresh_league_derived().
-- Run in the Supabase SQL editor (the MCP cannot run the DROP statements).

create or replace view public.v_player_espn_gsis as
select distinct on (espn_id) espn_id, gsis_id
from public.players
where coalesce(espn_id, '') <> ''
order by espn_id, last_season desc nulls last;

create or replace function public.player_name_key(name text) returns text
language sql immutable as $$
  select 'N:' || lower(regexp_replace(regexp_replace(coalesce(name, ''), '\m(jr|sr|ii|iii|iv|v)\M', '', 'gi'), '[^A-Za-z]', '', 'g'))
$$;

-- One row per player and league week on a roster
drop materialized view if exists public.mv_player_games cascade;
create materialized view public.mv_player_games as
with teams as (select distinct player_name from public.weekly_lineups where slot = 'DST')
select
  -- benched defenses sit in BN slots, recognise them by their team name
  case when l.slot = 'DST' or (coalesce(l.espn_id, '') = '' and l.player_name in (select player_name from teams))
         then 'DST:' || l.player_name
       when g.gsis_id is not null then g.gsis_id
       else public.player_name_key(l.player_name) end as player_key,
  l.season_year, l.week, l.manager_id, l.slot, l.is_starter,
  coalesce(l.points, 0)::numeric as points, l.player_name, nullif(l.espn_id, '') as espn_id
from public.weekly_lineups l
left join public.v_player_espn_gsis g on g.espn_id = nullif(l.espn_id, '') and l.slot <> 'DST';
create index on public.mv_player_games (player_key);

-- Draft picks and roster moves
drop materialized view if exists public.mv_player_events cascade;
create materialized view public.mv_player_events as
select
  case when d.position = 'DST' then 'DST:' || d.player_name
       when g.gsis_id is not null then g.gsis_id
       else public.player_name_key(d.player_name) end as player_key,
  d.season_year, 0 as week, null::timestamp as event_at, 'draft' as kind, d.manager_id,
  d.round, d.overall_pick, d.grade4 as value, d.player_name
from public.draft_picks d
left join public.v_player_espn_gsis g on g.espn_id = d.espn_id
union all
select
  case when f.player_id like 'DEF%' or f.position in ('DEF', 'DST') then 'DST:' || f.player_name
       when f.player_id like '00-%' then f.player_id
       else public.player_name_key(f.player_name) end,
  f.season_year, f.transaction_week, f.transaction_at,
  case when f.transaction_type = 'trade' then case f.item_direction when 'gain' then 'trade_in' else 'trade_out' end
       else case f.item_direction when 'gain' then 'add' else 'drop' end end,
  f.team_name, null, null, f.item_value, f.player_name
from public.fa_transactions f;
create index on public.mv_player_events (player_key);

-- Per player and manager
drop materialized view if exists public.mv_player_manager_stats cascade;
create materialized view public.mv_player_manager_stats as
select player_key, manager_id,
  count(*) as weeks_rostered,
  count(*) filter (where is_starter) as starts,
  round(sum(points) filter (where is_starter), 2) as starter_points,
  round(avg(points) filter (where is_starter), 2) as avg_start,
  max(points) filter (where is_starter) as best_start,
  count(distinct season_year) as seasons,
  min(season_year) as first_season, max(season_year) as last_season
from public.mv_player_games
group by player_key, manager_id;
create index on public.mv_player_manager_stats (player_key);

-- One row per player for the list
drop materialized view if exists public.mv_player_summary cascade;
create materialized view public.mv_player_summary as
with games as (
  select player_key,
    count(*) as weeks_rostered,
    count(*) filter (where is_starter) as starts,
    round(sum(points) filter (where is_starter), 2) as starter_points,
    round(avg(points) filter (where is_starter), 2) as avg_start,
    max(points) filter (where is_starter) as best_start,
    count(distinct season_year) as seasons,
    min(season_year) as first_season, max(season_year) as last_season,
    count(distinct manager_id) as managers,
    (array_agg(player_name order by season_year desc, week desc))[1] as last_name,
    (array_agg(espn_id order by season_year desc, week desc) filter (where espn_id is not null))[1] as espn_id,
    mode() within group (order by regexp_replace(slot, '\d+$', '')) filter (where slot not like 'BN%' and slot <> 'FLEX') as slot_pos
  from public.mv_player_games group by player_key
),
top as (
  select distinct on (player_key) player_key, manager_id as top_manager, weeks_rostered as top_manager_weeks
  from public.mv_player_manager_stats
  order by player_key, weeks_rostered desc, starter_points desc nulls last
),
ev as (
  select player_key,
    count(*) filter (where kind = 'draft') as times_drafted,
    count(*) filter (where kind = 'add') as adds,
    count(*) filter (where kind = 'drop') as drops,
    count(*) filter (where kind = 'trade_in') as trades,
    (array_agg(player_name order by season_year desc))[1] as ev_name
  from public.mv_player_events group by player_key
)
select k.player_key,
  coalesce(p.display_name, g.last_name, e.ev_name) as player_name,
  case when k.player_key like 'DST:%' then 'DST'
       else coalesce(nullif(p.position, ''), g.slot_pos) end as position,
  p.headshot, coalesce(g.espn_id, p.espn_id) as espn_id, p.latest_team,
  coalesce(g.weeks_rostered, 0) as weeks_rostered, coalesce(g.starts, 0) as starts,
  coalesce(g.starter_points, 0) as starter_points, g.avg_start, g.best_start,
  coalesce(g.seasons, 0) as seasons, g.first_season, g.last_season, coalesce(g.managers, 0) as managers,
  t.top_manager, t.top_manager_weeks,
  coalesce(e.times_drafted, 0) as times_drafted, coalesce(e.adds, 0) as adds,
  coalesce(e.drops, 0) as drops, coalesce(e.trades, 0) as trades
from (select player_key from public.mv_player_games union select player_key from public.mv_player_events) k
left join games g using (player_key)
left join top t using (player_key)
left join ev e using (player_key)
left join public.players p on p.gsis_id = k.player_key;
create unique index on public.mv_player_summary (player_key);

grant select on public.mv_player_games, public.mv_player_events,
  public.mv_player_manager_stats, public.mv_player_summary to anon, authenticated;

create or replace function public.refresh_player_stats() returns void
language plpgsql security definer set search_path = public as $$
begin
  refresh materialized view public.mv_player_games;
  refresh materialized view public.mv_player_events;
  refresh materialized view public.mv_player_manager_stats;
  refresh materialized view public.mv_player_summary;
end;
$$;
revoke all on function public.refresh_player_stats() from public, anon, authenticated;
grant execute on function public.refresh_player_stats() to service_role;
