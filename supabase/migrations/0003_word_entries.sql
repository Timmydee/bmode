-- Phase 5: word cloud entries (architecture-scaffold.md §1, §2).
-- As with prior migrations, RLS is a safety net only — per-participant
-- word-count limits, normalization, and profanity filtering are all
-- enforced in the repo layer (lib/backend/supabase/response-repo.ts) and
-- lib/game/{validation,profanity}.ts, not here.

create table if not exists word_entries (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references activities (id) on delete cascade,
  participant_id uuid not null references participants (id) on delete cascade,
  word text not null,
  submitted_at timestamptz not null default now()
);

create index if not exists word_entries_activity_id_idx on word_entries (activity_id);

alter table word_entries enable row level security;

create policy "word entries are publicly readable" on word_entries
  for select using (true);

create policy "anyone can submit a word" on word_entries
  for insert with check (true);
