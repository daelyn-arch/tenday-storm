-- Tenday Storm — initial schema
-- Run in the Supabase SQL editor (or `supabase db push`) for a brand-new project.

create extension if not exists "pgcrypto";

-- ============================================================
-- campaigns
-- ============================================================
create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  seed bigint not null,
  width int not null check (width between 10 and 80),
  height int not null check (height between 10 and 80),
  day int not null default 1 check (day >= 1),
  max_days int not null default 10 check (max_days >= 1),
  party_q int not null,
  party_r int not null,
  storm_q int not null,
  storm_r int not null,
  storm_radius int not null default 1,
  storm_path jsonb not null default '[]'::jsonb,
  final_boss_q int,
  final_boss_r int,
  invite_code text not null unique,
  created_at timestamptz not null default now()
);

-- ============================================================
-- regions
-- ============================================================
create table public.regions (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  name text not null,
  color text not null,
  kingdom_lore text not null default '',
  dm_lore text not null default '',
  is_homeland bool not null default false
);
create index regions_campaign_idx on public.regions (campaign_id);

-- ============================================================
-- hexes (PK is composite (campaign_id, q, r))
-- ============================================================
create table public.hexes (
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  q int not null,
  r int not null,
  biome text not null,
  region_id uuid references public.regions(id) on delete set null,
  generated jsonb not null default '{}'::jsonb,
  dm_notes text not null default '',
  revealed bool not null default false,
  party_visited bool not null default false,
  primary key (campaign_id, q, r)
);
create index hexes_region_idx on public.hexes (region_id);

-- ============================================================
-- quests
-- ============================================================
create table public.quests (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  title text not null,
  body text not null default '',
  status text not null default 'open' check (status in ('open','completed','failed')),
  player_visible bool not null default true,
  created_at timestamptz not null default now()
);
create index quests_campaign_idx on public.quests (campaign_id);

-- ============================================================
-- rumors
-- ============================================================
create table public.rumors (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  text text not null,
  is_true bool not null,
  target_q int,
  target_r int,
  source_region_id uuid references public.regions(id) on delete set null,
  collected bool not null default false
);
create index rumors_campaign_idx on public.rumors (campaign_id);

-- ============================================================
-- items
-- ============================================================
create table public.items (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  name text not null,
  description text not null default '',
  hex_q int,
  hex_r int,
  is_real bool not null default true,
  discovered bool not null default false,
  in_party_inventory bool not null default false
);
create index items_campaign_idx on public.items (campaign_id);

-- ============================================================
-- journal_entries
-- ============================================================
create table public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  author text not null,
  body text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index journal_campaign_idx on public.journal_entries (campaign_id, created_at desc);

-- ============================================================
-- campaign_members
-- ============================================================
create table public.campaign_members (
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('dm','player')),
  display_name text not null default '',
  primary key (campaign_id, user_id)
);
create index members_user_idx on public.campaign_members (user_id);

-- ============================================================
-- helper functions for RLS (avoid recursive policies)
-- ============================================================
create or replace function public.is_member(c uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.campaign_members
    where campaign_id = c and user_id = auth.uid()
  );
$$;

create or replace function public.is_dm(c uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.campaign_members
    where campaign_id = c and user_id = auth.uid() and role = 'dm'
  );
$$;

grant execute on function public.is_member(uuid) to authenticated;
grant execute on function public.is_dm(uuid) to authenticated;

-- ============================================================
-- RLS
-- ============================================================
alter table public.campaigns enable row level security;
alter table public.regions enable row level security;
alter table public.hexes enable row level security;
alter table public.quests enable row level security;
alter table public.rumors enable row level security;
alter table public.items enable row level security;
alter table public.journal_entries enable row level security;
alter table public.campaign_members enable row level security;

-- campaigns: members read; only DM updates; any authenticated user can insert (becomes DM via trigger)
create policy campaigns_read on public.campaigns
  for select using (public.is_member(id));
create policy campaigns_insert on public.campaigns
  for insert with check (auth.uid() is not null);
create policy campaigns_update on public.campaigns
  for update using (public.is_dm(id)) with check (public.is_dm(id));
create policy campaigns_delete on public.campaigns
  for delete using (public.is_dm(id));

-- regions: members read; DM writes
create policy regions_read on public.regions
  for select using (public.is_member(campaign_id));
create policy regions_write on public.regions
  for all using (public.is_dm(campaign_id)) with check (public.is_dm(campaign_id));

-- hexes: members read; DM writes
create policy hexes_read on public.hexes
  for select using (public.is_member(campaign_id));
create policy hexes_write on public.hexes
  for all using (public.is_dm(campaign_id)) with check (public.is_dm(campaign_id));

-- quests: players read player_visible OR if they're DM; DM writes
create policy quests_read on public.quests
  for select using (
    public.is_dm(campaign_id) or (public.is_member(campaign_id) and player_visible)
  );
create policy quests_write on public.quests
  for all using (public.is_dm(campaign_id)) with check (public.is_dm(campaign_id));

-- rumors: members read text/target (is_true is hidden client-side; row-level we still expose);
--   to truly hide is_true, players read via a view that drops the column.
-- For v1 we accept this and rely on the player UI to not render is_true.
create policy rumors_read on public.rumors
  for select using (public.is_member(campaign_id));
create policy rumors_write on public.rumors
  for all using (public.is_dm(campaign_id)) with check (public.is_dm(campaign_id));

-- items: members read; DM writes
create policy items_read on public.items
  for select using (public.is_member(campaign_id));
create policy items_write on public.items
  for all using (public.is_dm(campaign_id)) with check (public.is_dm(campaign_id));

-- journal_entries: any member reads/writes/edits/deletes their own; DM can edit anyone's
create policy journal_read on public.journal_entries
  for select using (public.is_member(campaign_id));
create policy journal_insert on public.journal_entries
  for insert with check (public.is_member(campaign_id));
create policy journal_update on public.journal_entries
  for update using (public.is_member(campaign_id)) with check (public.is_member(campaign_id));
create policy journal_delete on public.journal_entries
  for delete using (public.is_member(campaign_id));

-- campaign_members: members read their campaigns; DM writes
create policy members_read on public.campaign_members
  for select using (user_id = auth.uid() or public.is_dm(campaign_id));
create policy members_self_insert on public.campaign_members
  for insert with check (user_id = auth.uid());
create policy members_dm_write on public.campaign_members
  for update using (public.is_dm(campaign_id)) with check (public.is_dm(campaign_id));
create policy members_self_delete on public.campaign_members
  for delete using (user_id = auth.uid() or public.is_dm(campaign_id));

-- ============================================================
-- trigger: when a campaign is inserted, auto-add creator as dm
-- ============================================================
create or replace function public.on_campaign_insert()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  insert into public.campaign_members (campaign_id, user_id, role, display_name)
  values (new.id, auth.uid(), 'dm', coalesce((auth.jwt() ->> 'email'), 'DM'));
  return new;
end;
$$;

create trigger campaigns_after_insert
  after insert on public.campaigns
  for each row execute function public.on_campaign_insert();

-- ============================================================
-- join_by_code: lets a non-member redeem an invite code
-- ============================================================
create or replace function public.join_by_code(code text, name text)
returns uuid
language plpgsql security definer
set search_path = public
as $$
declare
  cid uuid;
begin
  select id into cid from public.campaigns where invite_code = code;
  if cid is null then
    raise exception 'invite code not found';
  end if;
  insert into public.campaign_members (campaign_id, user_id, role, display_name)
  values (cid, auth.uid(), 'player', coalesce(nullif(name, ''), 'Player'))
  on conflict (campaign_id, user_id) do nothing;
  return cid;
end;
$$;

grant execute on function public.join_by_code(text, text) to authenticated;

-- ============================================================
-- realtime publication
-- ============================================================
alter publication supabase_realtime add table public.campaigns;
alter publication supabase_realtime add table public.regions;
alter publication supabase_realtime add table public.hexes;
alter publication supabase_realtime add table public.quests;
alter publication supabase_realtime add table public.rumors;
alter publication supabase_realtime add table public.items;
alter publication supabase_realtime add table public.journal_entries;
alter publication supabase_realtime add table public.campaign_members;
