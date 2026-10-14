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
