-- Phase 2: sessions + participants only (architecture-scaffold.md §1, §2).
-- Table/column names are snake_case Postgres convention; the row <-> domain
-- type mapping happens in lib/backend/supabase/mappers.ts, never in the app.
--
-- Per architecture rule #2, RLS here is a safety net only, not business
-- logic — join-code validity, session-status transitions, etc. are all
-- enforced in the repo layer (lib/backend/supabase/*-repo.ts).

create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  join_code text not null unique,
  status text not null default 'draft' check (status in ('draft', 'live', 'ended')),
  active_activity_id uuid,
  created_at timestamptz not null default now()
);

create table if not exists participants (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions (id) on delete cascade,
  nickname text,
  token text not null,
  joined_at timestamptz not null default now(),
  unique (session_id, token)
);

create index if not exists sessions_join_code_idx on sessions (join_code);
create index if not exists participants_session_id_idx on participants (session_id);

alter table sessions enable row level security;
alter table participants enable row level security;

create policy "sessions are publicly readable" on sessions
  for select using (true);

create policy "hosts create their own sessions" on sessions
  for insert with check (auth.uid() = host_id);

create policy "hosts update their own sessions" on sessions
  for update using (auth.uid() = host_id);

create policy "participants are publicly readable" on participants
  for select using (true);

create policy "anyone can join a session" on participants
  for insert with check (true);
