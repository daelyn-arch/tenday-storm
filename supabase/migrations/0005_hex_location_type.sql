-- Tenday Storm — landmark / settlement type per hex
-- Lets the DM tag a tile as a known location (village, city, temple, etc.)
-- so the map can render a matching glyph. Values validated client-side; the
-- column accepts any short text so adding new types later is just code.

alter table public.hexes
  add column if not exists location_type text;
