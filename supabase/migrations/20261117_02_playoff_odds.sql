-- Applied to the live database on 2026-11-17 (Supabase migration playoff_odds_tables).
-- Filled by the weekly sync in the Scrape repo (playoff_odds.py, sync_supabase.py: sync_playoff_odds).

create table if not exists public.playoff_odds (
  season_year  integer not null references public.seasons(year),
  week         integer not null,            -- odds after this completed week
  manager_id   text    not null references public.managers(id),
  model        text    not null check (model in ('projections', 'averages')),
  wins         integer not null,
  losses       integer not null,
  ties         integer not null default 0,
  points_for   numeric not null,
  playoff_pct  numeric not null,
  last_pct     numeric not null,
  seed_pct     jsonb   not null,             -- chance of each final place, index 0 = 1st
  proj_wins    numeric not null,
  proj_pf      numeric not null,
  games_left   integer not null,
  odds_if_win  numeric,                      -- playoff odds if the next game is won / lost
  odds_if_loss numeric,
  odds_by_wins jsonb   not null,             -- {"k": [chance of k more wins, playoff odds with k more wins]}
  sims         integer not null,
  updated_at   timestamptz not null default now(),
  primary key (season_year, week, manager_id)
);

-- Remaining regular-season games with expected points and win chance
create table if not exists public.playoff_schedule (
  season_year     integer not null references public.seasons(year),
  week            integer not null,
  manager_id      text    not null references public.managers(id),
  opponent_id     text    not null references public.managers(id),
  proj_points     numeric not null,
  opp_proj_points numeric not null,
  win_prob        numeric not null,
  updated_at      timestamptz not null default now(),
  primary key (season_year, week, manager_id)
);

alter table public.playoff_odds enable row level security;
alter table public.playoff_schedule enable row level security;
create policy "Allow public read access" on public.playoff_odds for select to anon, authenticated using (true);
create policy "Allow public read access" on public.playoff_schedule for select to anon, authenticated using (true);
revoke insert, update, delete, truncate on public.playoff_odds from anon, authenticated;
revoke insert, update, delete, truncate on public.playoff_schedule from anon, authenticated;
grant select on public.playoff_odds, public.playoff_schedule to anon, authenticated;
