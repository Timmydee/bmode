-- v2: Rounds + round questions + per-question scores (Fastest Finger).
-- Round questions are ordinary `activities` rows (kind = 'poll') — this
-- table only adds the round-membership, correct-answer, and
-- per-question-run metadata that standalone polls never populate.
-- Standalone polls are entirely untouched: every column here is on a new
-- table, never a column added to `activities`/`poll_options`.
--
-- As with every prior migration, RLS here is a safety net only, not
-- business logic — scoring math and the leaderboard aggregate are computed
-- in lib/game/scoring.ts and lib/game/leaderboard.ts, read/written at
-- query time by lib/backend/supabase/score-repo.ts, never in a trigger or
-- Postgres function (see 0004's header comment — this is a standing
-- architecture rule for this codebase).

create table if not exists rounds (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions (id) on delete cascade,
  name text not null,
  status text not null default 'draft' check (status in ('draft', 'live', 'ended')),
  time_limit_seconds integer not null check (time_limit_seconds > 0),
  "order" integer not null default 0,
  current_question_index integer,
  current_question_started_at timestamptz,
  current_question_ends_at timestamptz,
  created_at timestamptz not null default now()
);

-- One row per round question, joining a round to its underlying poll
-- activity and recording the correct answer + position. The activity row
-- itself is created the same way a standalone poll's is — this table is
-- the only thing that marks it as belonging to a round.
create table if not exists round_questions (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references rounds (id) on delete cascade,
  activity_id uuid not null unique references activities (id) on delete cascade,
  "order" integer not null default 0,
  correct_option_id uuid not null references poll_options (id) on delete cascade
);

-- One row per (round question, participant) once that question is scored,
-- written once at reveal time by the repo layer — nothing here for a
-- trigger to maintain.
create table if not exists question_scores (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references activities (id) on delete cascade,
  participant_id uuid not null references participants (id) on delete cascade,
  option_id uuid references poll_options (id) on delete set null,
  correct boolean not null,
  points integer not null default 0,
  response_time_ms integer,
  scored_at timestamptz not null default now(),
  unique (activity_id, participant_id)
);

create index if not exists rounds_session_id_idx on rounds (session_id);
create index if not exists round_questions_round_id_idx on round_questions (round_id);
create index if not exists question_scores_activity_id_idx on question_scores (activity_id);
create index if not exists question_scores_participant_id_idx on question_scores (participant_id);

alter table rounds enable row level security;
alter table round_questions enable row level security;
alter table question_scores enable row level security;

create policy "rounds are publicly readable" on rounds
  for select using (true);

create policy "hosts create rounds on their own sessions" on rounds
  for insert with check (
    exists (select 1 from sessions s where s.id = session_id and s.host_id = auth.uid())
  );

create policy "hosts update rounds on their own sessions" on rounds
  for update using (
    exists (select 1 from sessions s where s.id = session_id and s.host_id = auth.uid())
  );

create policy "round questions are publicly readable" on round_questions
  for select using (true);

create policy "hosts create round questions on their own sessions" on round_questions
  for insert with check (
    exists (
      select 1 from rounds r
      join sessions s on s.id = r.session_id
      where r.id = round_id and s.host_id = auth.uid()
    )
  );

create policy "question scores are publicly readable" on question_scores
  for select using (true);

-- Scores are written by the host's browser tab (the only client driving
-- auto-advance/scoring — see the zero-budget/no-serverless-cron
-- constraint), scoped to sessions that host owns, same ownership-subquery
-- pattern as every host-only mutation elsewhere in this schema.
create policy "hosts write scores on their own sessions' questions" on question_scores
  for insert with check (
    exists (
      select 1 from activities a
      join sessions s on s.id = a.session_id
      where a.id = activity_id and s.host_id = auth.uid()
    )
  );
