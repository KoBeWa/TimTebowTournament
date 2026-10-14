-- Lineups with the opponent of that week, for the Head-to-Head page.
-- Already applied in Supabase.
create or replace view public.v_h2h_lineups with (security_invoker = true) as
select l.season_year, l.week, l.manager_id,
       case when m.manager_a = l.manager_id then m.manager_b else m.manager_a end as opponent_id,
       m.is_playoff, l.slot, l.player_name, l.espn_id, l.points, l.is_starter
from public.weekly_lineups l
join public.weekly_matchups m
  on m.season_year = l.season_year and m.week = l.week
 and l.manager_id in (m.manager_a, m.manager_b);
grant select on public.v_h2h_lineups to anon, authenticated;
