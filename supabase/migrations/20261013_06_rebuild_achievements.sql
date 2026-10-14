-- Part 6: achievements recomputed from the raw data.
--
-- rebuild.achievements_calc always reflects the current data. Draft-position
-- achievements (top_/worst_*_draft, top_/worst_draft_pick) are not part of it
-- and stay as imported.
--
-- Season awards (titles, luck, schedule, tiers, streaks …) only count
-- completed seasons; game-based achievements are awarded right away.
--
-- Decisions: shared last place counts for everyone on it; The Dud Bowl /
-- The Shootout go to both managers and include playoff games; weekly high
-- scores include the playoff weeks.

create or replace view rebuild.achievements_calc as
with complete as (select distinct season_year from public.playoff_results),
g as (select * from rebuild.games_source),
reg as (select * from g where game_type = 'reg'),
sf as (select * from rebuild.season_facts where season_year in (select season_year from complete)),
champ as (select season_year, manager_id from sf where final_rank = 1),
season_reg as (
  select season_year, manager_id,
         sum(pf) pf, sum(pa) pa, avg(pa) opp_avg,
         sum(allplay_wins) apw, sum(allplay_losses) apl,
         avg((week_rank <= week_teams / 2)::int) top_half_share
  from reg where season_year in (select season_year from complete) group by 1,2
),
season_rank as (
  select s.*,
         rank() over (partition by season_year order by pf desc) pf_rank,
         rank() over (partition by season_year order by pf asc) pf_rank_low,
         rank() over (partition by season_year order by apw desc) ap_rank,
         rank() over (partition by season_year order by apw asc) ap_rank_low,
         rank() over (partition by season_year order by opp_avg asc) easy_rank,
         rank() over (partition by season_year order by opp_avg desc) hard_rank
  from season_reg s
),
luck as (
  select l.season_year, l.manager_id, l.luck::numeric luck,
         rank() over (partition by l.season_year order by l.luck desc) best,
         rank() over (partition by l.season_year order by l.luck asc) worst
  from public.v_luck l where l.season_year in (select season_year from complete)
),
coach as (
  select c.season_year, c.manager_id, c.coach_score::numeric coach_score,
         rank() over (partition by c.season_year order by c.coach_score desc) best,
         rank() over (partition by c.season_year order by c.coach_score asc) worst
  from public.v_coach_rank c where c.season_year in (select season_year from complete)
),
draft as (
  select d.season_year, d.manager_id, d.avg_grade4::numeric g,
         rank() over (partition by d.season_year order by d.avg_grade4 desc) best,
         rank() over (partition by d.season_year order by d.avg_grade4 asc) worst
  from public.v_draft_grades d where d.season_year in (select season_year from complete)
),
rating as (
  select r.season_year, r.manager_id, r.league_rating::numeric score,
         ntile(8) over (order by r.league_rating desc) eighth
  from public.v_league_rating r where r.season_year in (select season_year from complete)
),
weekly as (
  select season_year, manager_id,
         count(*) filter (where week_rank = 1) high_scores
  from g group by 1,2
),
marg as (
  select reg.*,
         rank() over (partition by season_year order by margin asc) closest,
         rank() over (partition by season_year order by margin desc) biggest,
         rank() over (partition by season_year order by pf desc) top_score
  from reg where won
),
comb as (
  select g.*,
         rank() over (partition by season_year order by combined desc) high_comb,
         rank() over (partition by season_year order by combined asc) low_comb
  from g where manager_id < opponent_id
),
wk as (
  select reg.*,
         rank() over (partition by season_year, week order by pf desc) r_desc,
         rank() over (partition by season_year, week order by pf asc) r_asc
  from reg
),
streaks as (
  select manager_id, season_year, wins > losses as good,
         season_year - row_number() over (partition by manager_id, wins > losses order by season_year) as grp
  from sf
),
win_streaks as (
  select manager_id, max(season_year) last_year, count(*) len
  from streaks where good group by manager_id, grp having count(*) >= 3
)

-- ── Final standings ─────────────────────────────────────────────────────────
select season_year, manager_id, 'champion' as achievement_key, null::numeric as value, null::text as notes, null::int as matchup_id from sf where final_rank = 1
union all select season_year, manager_id, 'runner_up', null, null, null from sf where final_rank = 2
union all select season_year, manager_id, 'third_place', null, null, null from sf where final_rank = 3
union all select season_year, manager_id, 'the_worst', null, null, null from sf where is_last
union all select season_year, manager_id, 'season_title', null, null, null from sf where reg_rank = 1
union all select season_year, manager_id, 'season_points_title', round(pf, 2), null, null from season_rank where pf_rank = 1
union all select season_year, manager_id, 'season_allplay_title', round(apw::numeric / nullif(apw + apl, 0), 2), null, null from season_rank where ap_rank = 1
union all
select s.season_year, s.manager_id, 'triple_crown', null, null, null
from sf s join season_rank r using (season_year, manager_id)
where s.reg_rank = 1 and r.pf_rank = 1 and r.ap_rank = 1
union all
select s.season_year, s.manager_id, 'grand_slam', null, null, null
from sf s join season_rank r using (season_year, manager_id)
where s.reg_rank = 1 and r.pf_rank = 1 and r.ap_rank = 1 and s.final_rank = 1
union all
select s.season_year, s.manager_id, 'trash_trifecta', null, null, null
from sf s join season_rank r using (season_year, manager_id)
where s.is_last and r.pf_rank_low = 1 and r.ap_rank_low = 1
union all
select s.season_year, s.manager_id, k, null, null, null
from sf s join sf p on p.manager_id = s.manager_id and p.season_year = s.season_year - 1,
lateral (values
  ('back_to_back_champ', p.final_rank = 1 and s.final_rank = 1),
  ('silverback_to_back', p.final_rank = 2 and s.final_rank = 2),
  ('still_the_worst', p.is_last and s.is_last),
  ('icarus_award', p.final_rank = 1 and s.is_last),
  ('phoenix_award', p.is_last and s.final_rank = 1)
) v(k, ok)
where ok

-- ── Champion combos ─────────────────────────────────────────────────────────
union all select c.season_year, c.manager_id, 'against_the_odds', l.luck, null, null from champ c join luck l using (season_year, manager_id) where l.worst = 1
union all select c.season_year, c.manager_id, 'fortune_favored', l.luck, null, null from champ c join luck l using (season_year, manager_id) where l.best = 1
union all select c.season_year, c.manager_id, 'cupcake_champion', round(r.opp_avg, 2), null, null from champ c join season_rank r using (season_year, manager_id) where r.easy_rank = 1
union all select c.season_year, c.manager_id, 'heavyweight_champion', round(r.opp_avg, 2), null, null from champ c join season_rank r using (season_year, manager_id) where r.hard_rank = 1
union all select c.season_year, c.manager_id, 'draft_king', null, null, null from champ c join draft d using (season_year, manager_id) where d.best = 1
union all select c.season_year, c.manager_id, 'optimus_prime', null, null, null from champ c join coach k using (season_year, manager_id) where k.best = 1

-- ── Season ──────────────────────────────────────────────────────────────────
union all select season_year, manager_id, 'cursed', luck, null, null from luck where worst = 1
union all select season_year, manager_id, 'lady_luck', luck, null, null from luck where best = 1
union all select season_year, manager_id, 'the_cupcake', round(opp_avg, 2), null, null from season_rank where easy_rank = 1
union all select season_year, manager_id, 'the_gauntlet', round(opp_avg, 2), null, null from season_rank where hard_rank = 1
union all select season_year, manager_id, 'average_joe', 0.5, null, null from season_reg where apw = apl
union all select season_year, manager_id, 'even_steven', round(abs(pf - pa), 2), null, null from season_reg where abs(pf - pa) < 10
union all select season_year, manager_id, 'goose_egg', null, null, null from sf where wins = 0
union all select season_year, manager_id, 'top_half_100pct', 100, null, null from season_reg where top_half_share = 1
union all select season_year, manager_id, 'top_half_75pct', round(100 * top_half_share, 1), null, null from season_reg where top_half_share >= 0.75
union all select season_year, manager_id, 'bottom_half_75pct', round(100 * (1 - top_half_share), 1), null, null from season_reg where 1 - top_half_share >= 0.75
union all
select season_year, manager_id, 'season_high_scores_5', high_scores, null, null
from weekly where high_scores >= rebuild.setting('high_scores_season')
union all select last_year, manager_id, 'winning_record_streak', len, null, null from win_streaks
union all
select season_year, manager_id,
       case eighth when 1 then 'diamond_season' when 2 then 'gold_season' when 3 then 'silver_season'
                   when 4 then 'bronze_season' when 5 then 'iron_season' when 6 then 'wood_season'
                   else 'clay_season' end,
       round(score, 2), null, null
from rating

-- ── Draft and roster ────────────────────────────────────────────────────────
union all select season_year, manager_id, 'the_mastermind', round(g, 2), null, null from draft where best = 1
union all select season_year, manager_id, 'the_madman', round(g, 2), null, null from draft where worst = 1
union all select season_year, manager_id, 'the_general', round(coach_score, 2), null, null from coach where best = 1
union all select season_year, manager_id, 'the_mascot', round(coach_score, 2), null, null from coach where worst = 1
union all
select season_year, manager_id, 'the_tactician', round(coach_score, 2), null, null
from coach where coach_score >= rebuild.setting('tactician_score')

-- ── Single matchups (regular season) ────────────────────────────────────────
union all select season_year, manager_id, 'thread_the_needle', round(margin, 2), 'vs ' || opponent_id, matchup_id from marg where closest = 1
union all select season_year, opponent_id, 'heartbreaker', round(margin, 2), 'vs ' || manager_id, matchup_id from marg where closest = 1
union all select season_year, manager_id, 'massacre', round(margin, 2), 'vs ' || opponent_id, matchup_id from marg where biggest = 1
union all select season_year, opponent_id, 'the_bye_week', round(margin, 2), 'vs ' || manager_id, matchup_id from marg where biggest = 1
union all
select season_year, manager_id, 'peak_performance', round(pf, 2), 'vs ' || opponent_id, matchup_id
from (select reg.*, rank() over (partition by season_year order by pf desc) r from reg) t where r = 1
union all
select season_year, manager_id, 'micro_victory', round(margin, 2), 'vs ' || opponent_id, matchup_id
from reg where won and margin < rebuild.setting('micro_margin')
union all
select season_year, opponent_id, 'micro_defeat', round(margin, 2), 'vs ' || manager_id, matchup_id
from reg where won and margin < rebuild.setting('micro_margin')
union all
select season_year, manager_id, 'small_victory', round(margin, 2), 'vs ' || opponent_id, matchup_id
from reg where won and margin >= rebuild.setting('micro_margin') and margin < rebuild.setting('small_margin')
union all
select season_year, opponent_id, 'small_defeat', round(margin, 2), 'vs ' || manager_id, matchup_id
from reg where won and margin >= rebuild.setting('micro_margin') and margin < rebuild.setting('small_margin')
union all
select season_year, manager_id, 'double_up', round(pf / pa, 2), 'vs ' || opponent_id, matchup_id
from reg where pa > 0 and pf >= 2 * pa
union all
select season_year, opponent_id, 'doubled_up', round(pa / pf, 2), 'vs ' || manager_id, matchup_id
from reg where pa > 0 and pf >= 2 * pa
union all
select season_year, manager_id, 'firing_squad', round(100 * share, 2), 'vs ' || opponent_id, matchup_id
from reg where share > rebuild.setting('firing_squad_share')
union all
select w2.season_year, w2.manager_id, 'spoiled_goods', round(w2.pf, 2), 'vs ' || w2.opponent_id, w2.matchup_id
from wk w2 join wk w1 on w1.season_year = w2.season_year and w1.week = w2.week and w1.r_desc = 1
where w2.r_desc = 2 and w2.opponent_id = w1.manager_id
union all
select l1.season_year, l1.manager_id, 'true_lowlight', round(l1.pf, 2), 'vs ' || l1.opponent_id, l1.matchup_id
from wk l1 join wk l2 on l2.season_year = l1.season_year and l2.week = l1.week and l2.r_asc = 2
where l1.r_asc = 1 and l1.opponent_id = l2.manager_id

-- ── Combined score, both managers, playoffs included ────────────────────────
union all
select season_year, x.m, 'the_shootout', round(combined, 2),
       'vs ' || x.o || ' (' || round(pf, 2) || ' - ' || round(pa, 2) || ')', matchup_id
from comb, lateral (values (manager_id, opponent_id), (opponent_id, manager_id)) x(m, o)
where high_comb = 1
union all
select season_year, x.m, 'the_dud_bowl', round(combined, 2),
       'vs ' || x.o || ' (' || round(pf, 2) || ' - ' || round(pa, 2) || ')', matchup_id
from comb, lateral (values (manager_id, opponent_id), (opponent_id, manager_id)) x(m, o)
where low_comb = 1

-- ── Same opponent three times in a season (playoffs included) ───────────────
union all
select season_year, manager_id, 'bully', count(*), 'vs ' || opponent_id, null
from g where won group by season_year, manager_id, opponent_id
having count(*) >= rebuild.setting('bully_wins')
union all
select season_year, opponent_id, 'bullied', count(*), 'vs ' || manager_id, null
from g where won group by season_year, manager_id, opponent_id
having count(*) >= rebuild.setting('bully_wins');
