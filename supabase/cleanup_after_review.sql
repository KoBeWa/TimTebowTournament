-- Optional clean-up. Not applied automatically: run it in the Supabase SQL editor once you are
-- sure nothing is missing. Everything here is already closed to the public by
-- migrations/20261117_01_lock_down_public_api.sql, so leaving it is safe too.

-- Backups made before the records rebuild on 2026-10-13
drop table if exists public.achievements_backup_20261013;
drop table if exists public.record_timeline_backup_20261013;
drop table if exists public.record_owner_values_backup_20261013;

-- Functions of features that no longer exist
drop function if exists public.create_group(text);
drop function if exists public.join_group(text);
drop function if exists public.is_group_admin(uuid, uuid);
drop function if exists public.is_group_member(uuid, uuid);
drop function if exists public.ensure_pc_lineup_slots(uuid, integer, integer);
drop function if exists public.set_pc_lineup_slot(uuid, integer, integer, text, text, uuid);
drop function if exists public.get_my_bracket_state(integer);
drop function if exists public.set_playoff_bracket_pick(integer, uuid, uuid);
drop function if exists public.rebuild_playoff_bracket_games(integer, uuid);
drop function if exists public.pickem_standings(integer);
drop function if exists public.pickem_week_leaderboard(uuid, integer, integer);
