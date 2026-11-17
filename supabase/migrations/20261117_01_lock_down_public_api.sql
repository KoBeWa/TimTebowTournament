-- Applied to the live database on 2026-11-17 (Supabase migrations
-- lock_down_backups_mock_writes_and_dead_functions and rebuild_functions_fixed_search_path).

-- 1. Backup tables from 2026-10-13: not used by the site; close them to the public API
alter table public.achievements_backup_20261013 enable row level security;
alter table public.record_timeline_backup_20261013 enable row level security;
alter table public.record_owner_values_backup_20261013 enable row level security;
revoke all on public.achievements_backup_20261013 from anon, authenticated;
revoke all on public.record_timeline_backup_20261013 from anon, authenticated;
revoke all on public.record_owner_values_backup_20261013 from anon, authenticated;

-- 2. Mock draft is closed until next year: read-only for the public (see AGENTS.md, "Mock draft")
revoke insert, update, delete, truncate on public.mock_drafts from anon, authenticated;
revoke insert, update, delete, truncate on public.mock_draft_picks from anon, authenticated;

-- 3. SECURITY DEFINER functions of removed features (groups, pick'em, bracket, lineup game)
revoke execute on function public.create_group(text) from public, anon, authenticated;
revoke execute on function public.join_group(text) from public, anon, authenticated;
revoke execute on function public.is_group_admin(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.is_group_member(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.ensure_pc_lineup_slots(uuid, integer, integer) from public, anon, authenticated;
revoke execute on function public.set_pc_lineup_slot(uuid, integer, integer, text, text, uuid) from public, anon, authenticated;
revoke execute on function public.get_my_bracket_state(integer) from public, anon, authenticated;
revoke execute on function public.set_playoff_bracket_pick(integer, uuid, uuid) from public, anon, authenticated;
revoke execute on function public.rebuild_playoff_bracket_games(integer, uuid) from public, anon, authenticated;
revoke execute on function public.pickem_standings(integer) from public, anon, authenticated;
revoke execute on function public.pickem_week_leaderboard(uuid, integer, integer) from public, anon, authenticated;

-- 4. Small hardening
alter function public.player_name_key(text) set search_path = public;
alter view public.v_player_espn_gsis set (security_invoker = true);
alter function rebuild.setting(text) set search_path = public, rebuild;
alter function rebuild._commit_holder(text, text, integer, text, numeric, integer, integer, text) set search_path = public, rebuild;
alter function rebuild.compute_records() set search_path = public, rebuild;
