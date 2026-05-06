-- Tenday Storm — journal entries can be pinned to a hex.
alter table public.journal_entries
  add column if not exists target_q int,
  add column if not exists target_r int;
