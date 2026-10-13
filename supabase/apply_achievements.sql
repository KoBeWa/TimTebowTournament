-- Übernimmt die neu berechneten Achievements (rebuild.achievements_calc) in
-- public.achievements. Manuelle Einträge (is_manual) und Achievements, die
-- die View nicht berechnet (Draft-Positionen), bleiben unverändert.
-- Beschreibung und Kategorie werden je Achievement aus dem Bestand übernommen.

create table if not exists public.achievements_backup_20261013 as table public.achievements;

with meta as (
  select distinct on (achievement_key) achievement_key, achievement_category, description
  from public.achievements order by achievement_key, id
),
del as (
  delete from public.achievements a
  where not coalesce(a.is_manual, false)
    and a.achievement_key in (select distinct achievement_key from rebuild.achievements_calc)
  returning 1
),
ins as (
  insert into public.achievements
    (season_year, manager_id, achievement_key, achievement_category, value, notes, is_manual, description, matchup_id)
  select c.season_year, c.manager_id, c.achievement_key, m.achievement_category, c.value, c.notes, false,
         case c.achievement_key
           when 'the_shootout' then 'Beteiligt am Spiel mit den höchsten kombinierten Punkten der Saison (inkl. Playoffs).'
           when 'the_dud_bowl' then 'Beteiligt am Spiel mit den wenigsten kombinierten Punkten der Saison (inkl. Playoffs).'
           when 'season_high_scores_5' then 'Erzielt 5 oder mehr wöchentliche Höchst-Scores in einer Saison (inkl. Playoffs).'
           else m.description
         end,
         c.matchup_id
  from rebuild.achievements_calc c
  join meta m using (achievement_key)
  returning 1
)
select (select count(*) from del) deleted, (select count(*) from ins) inserted;

-- Rückgängig machen (falls nötig):
--   begin;
--   truncate public.achievements;
--   insert into public.achievements select * from public.achievements_backup_20261013;
--   commit;
