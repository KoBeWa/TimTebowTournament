alter table public.playoff_odds add column if not exists scenarios jsonb;
comment on column public.playoff_odds.scenarios is 'Paths to the playoffs from the simulation (current week only): per number of own wins the chance, the rival results that settle it, and grids own wins x rival wins. Written by Scrape sync (playoff_odds.scenarios).';
