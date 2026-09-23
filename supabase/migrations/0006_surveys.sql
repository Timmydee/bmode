-- v2: Surveys (bundled feedback polls, no timer/scoring).
-- A survey question is an ordinary `activities` row (kind = 'poll'), same
-- as a round question — this table only adds the survey-membership and
-- position metadata. Unlike rounds, there is no per-question timer state
-- and no correct-answer column: a survey question is a standalone poll in
-- every way except which survey it belongs to and its order within it.
-- Advancing is host-paced (a manual "Next question" click), not
-- auto-advanced on a countdown, so there's nothing here for a trigger or
-- background process to maintain — same "no business logic in Postgres"
-- rule as every other migration in this project.

create table if not exists surveys (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions (id) on delete cascade,
  name text not null,
  status text not null default 'draft' check (status in ('draft', 'live', 'ended')),
  "order" integer not null default 0,
  current_question_index integer,
  created_at timestamptz not null default now()
);

create table if not exists survey_questions (
  id uuid primary key default gen_random_uuid(),
  survey_id uuid not null references surveys (id) on delete cascade,
  activity_id uuid not null unique references activities (id) on delete cascade,
  "order" integer not null default 0
);

create index if not exists surveys_session_id_idx on surveys (session_id);
create index if not exists survey_questions_survey_id_idx on survey_questions (survey_id);

alter table surveys enable row level security;
alter table survey_questions enable row level security;

create policy "surveys are publicly readable" on surveys
  for select using (true);

create policy "hosts create surveys on their own sessions" on surveys
  for insert with check (
    exists (select 1 from sessions s where s.id = session_id and s.host_id = auth.uid())
  );

create policy "hosts update surveys on their own sessions" on surveys
  for update using (
    exists (select 1 from sessions s where s.id = session_id and s.host_id = auth.uid())
  );

create policy "survey questions are publicly readable" on survey_questions
  for select using (true);

create policy "hosts create survey questions on their own sessions" on survey_questions
  for insert with check (
    exists (
      select 1 from surveys sv
      join sessions s on s.id = sv.session_id
      where sv.id = survey_id and s.host_id = auth.uid()
    )
  );
