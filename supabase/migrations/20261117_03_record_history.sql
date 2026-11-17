-- Week-by-week values of one record for every manager, plus who held the record each week.
-- The data lives in the rebuild schema (rebuilt by refresh_league_derived on every sync),
-- which the public API cannot read; this function exposes just this read-only slice.
create or replace function public.record_history(p_record_key text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with wk as (
    select w.idx, w.season_year, w.week
    from rebuild.weeks w
    where w.idx <= (select max(v.idx) from rebuild.record_values v where v.record_key = p_record_key)
  ),
  mgr as (
    select distinct v.manager_id from rebuild.record_values v where v.record_key = p_record_key
  ),
  -- one slot per week for every manager, so all arrays line up with `weeks`
  series as (
    select m.manager_id, jsonb_agg(round(v.value, 2) order by wk.idx) as vals
    from mgr m cross join wk
    left join rebuild.record_values v
      on v.record_key = p_record_key and v.manager_id = m.manager_id and v.idx = wk.idx
    group by m.manager_id
  )
  select case when not exists (select 1 from series) then null else jsonb_build_object(
    'weeks', (select jsonb_agg(jsonb_build_array(season_year, week) order by idx) from wk),
    'holders', (select jsonb_agg(h.manager_id order by wk.idx)
                from wk left join rebuild.record_holders h on h.idx = wk.idx and h.record_key = p_record_key),
    'series', (select jsonb_object_agg(manager_id, vals) from series)
  ) end;
$$;

revoke all on function public.record_history(text) from public;
grant execute on function public.record_history(text) to anon, authenticated;
