-- Phase 4: activities + poll options/votes (architecture-scaffold.md §1, §2).
-- `config` holds kind-specific setup data the contract's ActivityRepository
-- .create() already models as a free-form bag (maxWordsPerParticipant,
-- allowAnonymous, etc.) — poll options get their own relational table
-- instead, since poll_votes needs real foreign keys to vote against.
--
-- As with 0001, RLS here is a safety net only, not business logic — one
-- vote per participant, activity-belongs-to-session, etc. are enforced in
-- the repo layer (lib/backend/supabase/*-repo.ts), not here.

create table if not exists activities (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions (id) on delete cascade,
  kind text not null check (kind in ('poll', 'wordcloud', 'qa')),
  prompt text not null,
  status text not null default 'queued' check (status in ('queued', 'live', 'closed')),
  "order" integer not null default 0,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists poll_options (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references activities (id) on delete cascade,
  label text not null,
  "order" integer not null default 0
);

create table if not exists poll_votes (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references activities (id) on delete cascade,
  participant_id uuid not null references participants (id) on delete cascade,
  option_id uuid not null references poll_options (id) on delete cascade,
  submitted_at timestamptz not null default now(),
  unique (activity_id, participant_id)
);

create index if not exists activities_session_id_idx on activities (session_id);
create index if not exists poll_options_activity_id_idx on poll_options (activity_id);
create index if not exists poll_votes_activity_id_idx on poll_votes (activity_id);

alter table activities enable row level security;
alter table poll_options enable row level security;
alter table poll_votes enable row level security;

create policy "activities are publicly readable" on activities
  for select using (true);

create policy "hosts create activities on their own sessions" on activities
  for insert with check (
    exists (select 1 from sessions s where s.id = session_id and s.host_id = auth.uid())
  );

create policy "hosts update activities on their own sessions" on activities
  for update using (
    exists (select 1 from sessions s where s.id = session_id and s.host_id = auth.uid())
  );

create policy "poll options are publicly readable" on poll_options
  for select using (true);

create policy "hosts create poll options on their own sessions" on poll_options
  for insert with check (
    exists (
      select 1 from activities a
      join sessions s on s.id = a.session_id
      where a.id = activity_id and s.host_id = auth.uid()
    )
  );

create policy "poll votes are publicly readable" on poll_votes
  for select using (true);

create policy "anyone can vote" on poll_votes
  for insert with check (true);
