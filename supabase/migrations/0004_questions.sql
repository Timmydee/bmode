-- Phase 6: Q&A questions + upvotes (architecture-scaffold.md §1, §2).
-- Upvote counts are computed at query time (see
-- lib/backend/supabase/qa-repo.ts), not cached via a trigger-maintained
-- counter column — a counter-maintenance trigger is exactly the kind of
-- business logic architecture rule #2 keeps out of Postgres.

create table if not exists questions (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references activities (id) on delete cascade,
  participant_id uuid not null references participants (id) on delete cascade,
  text text not null,
  author_nickname text,
  answered boolean not null default false,
  hidden boolean not null default false,
  submitted_at timestamptz not null default now()
);

create table if not exists question_upvotes (
  question_id uuid not null references questions (id) on delete cascade,
  participant_id uuid not null references participants (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (question_id, participant_id)
);

create index if not exists questions_activity_id_idx on questions (activity_id);
create index if not exists question_upvotes_question_id_idx on question_upvotes (question_id);

alter table questions enable row level security;
alter table question_upvotes enable row level security;

create policy "questions are publicly readable" on questions
  for select using (true);

create policy "anyone can submit a question" on questions
  for insert with check (true);

create policy "hosts moderate questions on their own sessions" on questions
  for update using (
    exists (
      select 1 from activities a
      join sessions s on s.id = a.session_id
      where a.id = activity_id and s.host_id = auth.uid()
    )
  );

create policy "question upvotes are publicly readable" on question_upvotes
  for select using (true);

-- Safety-net mirror of the repo-layer check: can't upvote your own question.
create policy "anyone can upvote a question that isn't their own" on question_upvotes
  for insert with check (
    not exists (
      select 1 from questions q
      where q.id = question_upvotes.question_id
        and q.participant_id = question_upvotes.participant_id
    )
  );

create policy "anyone can remove an upvote" on question_upvotes
  for delete using (true);
