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
