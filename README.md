# Tenday Storm

A campaign companion for a hex-crawl D&D session: 10-day apocalypse clock, a moving storm, fog-of-war exploration, sealed legendary items, rumors (some true, some false), and a shared party journal that updates in real time.

## Stack

- Vite + React + TypeScript + Tailwind + Zustand
- Supabase (Postgres + Realtime + Auth) for shared state across DM and players
- Pure-SVG hex map with pan/zoom

## One-time Supabase setup

1. Create a free Supabase project at <https://supabase.com>.
2. In the project dashboard, copy your **Project URL** and **anon public key** from `Project Settings → API`.
3. In the `SQL Editor`, paste and run the contents of `supabase/migrations/0001_init.sql`. This creates all tables, row-level-security policies, the `join_by_code` RPC, and enables realtime on the relevant tables.
4. In `Authentication → URL Configuration`, set the **Site URL** to `http://localhost:5173` for development. Add additional redirect URLs as needed.

## Local development

```sh
cp .env.example .env
# edit .env: set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
npm install
npm run dev
```

Open <http://localhost:5173>. You'll be prompted for your email; click the magic link Supabase sends to sign in.

## Running a session

1. **DM:** sign in, click `New campaign`. Tweak name, seed, and dimensions; the preview map updates as you adjust the seed. Click `Create campaign` to save.
2. **DM:** in the world panel of the DM view, copy the **invite link** and send it to your players.
3. **Players:** open the invite link, sign in with their email, then enter their display name and join.
4. **DM:** drive the session by clicking hexes (inspect/reveal/move-party), authoring quests/rumors/items, and clicking **End day** to advance the storm.

## How visibility works

- **DM:** sees the full map, all hex contents, all rumors (including which are true/false), all items, the storm path, the final boss location, and any DM-only region lore.
- **Players:** see only revealed hexes (with biome and features), a "scout glimpse" of hexes adjacent to the party (biome only), region outlines/names for any region with at least one revealed hex, the storm position, and the days-remaining counter. Rumors only show up to players once the DM marks them collected. Items only show up after the DM marks them discovered.

## What advances when

- Clicking **Move party here** on a hex flips that hex (and its immediate neighbors) to `revealed`, repositions the party token, and triggers a realtime push to player browsers.
- Clicking **End day** increments the day counter and steps the storm one hex along the precomputed path. The DM can also drag the storm to any hex by editing the storm coords in the World panel.
- Each rumor has a hidden `is_true` flag; the DM can flip it. The player UI never shows the truth — players have to confirm by going to the hex.

## Project structure

```
src/
  lib/supabase.ts            client + env-checked stub
  store/campaign.ts          Zustand store (single source of truth for campaign data)
  realtime/useCampaignChannel.ts   subscribes to all per-campaign tables
  hex/                       coords + HexMap (SVG)
  world/                     procgen (deterministic biomes/regions/items/rumors/storm)
  views/                     route-level views
    panels/                  reusable side-panel components used by both DM and player views
  types/db.ts                hand-written DB types (matches the SQL migration)
supabase/migrations/0001_init.sql   schema, RLS, triggers, realtime publication, join RPC
```

## Out of scope (v1)

- Initiative / combat tracker
- Full character sheets
- Mobile-optimized layout (works on phones, but cramped)
- Image uploads for hex art
