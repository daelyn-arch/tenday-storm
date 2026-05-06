-- Tenday Storm — random storm + tracker toggle
-- Storm now jumps to a random hex each day instead of marching toward the party,
-- and covers a region-sized area. DM can toggle visibility of the next location
-- to players (representing a spell or item the party has acquired).

alter table public.campaigns
  add column if not exists players_see_storm_next bool not null default false;

-- New campaigns default to a region-sized storm.
alter table public.campaigns
  alter column storm_radius set default 3;
