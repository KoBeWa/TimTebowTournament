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
