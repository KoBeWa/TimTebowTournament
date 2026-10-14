-- Übernimmt die neu berechnete Record-Timeline in die Live-Tabellen.
-- Vorher: select rebuild.compute_records();
-- Legt zuerst Backups an. Rekorde, die nicht neu berechnet werden
-- (Perfect-Lineup-Rekorde, Viertelfinale), bleiben unverändert.

begin;

create table if not exists public.record_timeline_backup_20261013 as table public.record_timeline;
create table if not exists public.record_owner_values_backup_20261013 as table public.record_owner_values;

delete from public.record_timeline
where record_key in (select record_key from rebuild.record_defs);

insert into public.record_timeline
  (record_key, record_label, period_id, manager_id, from_year, from_week, to_year, to_week, weeks_held, record_value, is_current)
select record_key, record_label, period_id, manager_id, from_year, from_week, to_year, to_week, weeks_held, record_value, is_current
from rebuild.record_timeline_new;

delete from public.record_owner_values
where record_key in (select record_key from rebuild.record_defs);

insert into public.record_owner_values (record_key, manager_id, current_value)
select record_key, manager_id, current_value
from rebuild.record_owner_values_new;

commit;

-- Rückgängig machen (falls nötig):
--   begin;
--   truncate public.record_timeline;     insert into public.record_timeline select * from public.record_timeline_backup_20261013;
--   truncate public.record_owner_values; insert into public.record_owner_values select * from public.record_owner_values_backup_20261013;
--   commit;
