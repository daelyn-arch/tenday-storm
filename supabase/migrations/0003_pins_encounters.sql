-- Tenday Storm — pins, assignments, encounters
-- Quests and rumors can now be pinned to a hex (auto-assigned from the
-- current map selection at create time, but reassignable). Items can be
-- attached to a quest or rumor. Encounters get their own table.

-- ----- quests: optional target hex --------------------------------
alter table public.quests
  add column if not exists target_q int,
  add column if not exists target_r int;

-- ----- items: optional assignment to a quest or rumor -------------
alter table public.items
  add column if not exists quest_id uuid references public.quests(id) on delete set null,
  add column if not exists rumor_id uuid references public.rumors(id) on delete set null;

create index if not exists items_quest_idx on public.items (quest_id);
create index if not exists items_rumor_idx on public.items (rumor_id);

-- ----- encounters: independent table, mirrors rumors --------------
create table if not exists public.encounters (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  text text not null,
  target_q int,
  target_r int,
  used bool not null default false,
  created_at timestamptz not null default now()
);
create index if not exists encounters_campaign_idx on public.encounters (campaign_id);

alter table public.encounters enable row level security;

-- members read; DM writes (encounters are DM-only intel)
drop policy if exists encounters_read on public.encounters;
create policy encounters_read on public.encounters
  for select using (public.is_dm(campaign_id));
drop policy if exists encounters_write on public.encounters;
create policy encounters_write on public.encounters
  for all using (public.is_dm(campaign_id)) with check (public.is_dm(campaign_id));

alter publication supabase_realtime add table public.encounters;
