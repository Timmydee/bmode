-- Bmode: Circle conversation games.
-- A circle is host-paced like a survey, but its questions are picked one at
-- a time while the game runs (the next question's depth depends on the
-- group's vote), so they get their own table instead of `activities`.
-- Every game rule — picking questions, Sparks, spotlight, unanimity — lives
-- in lib/game/circle.ts. RLS below is a safety net only, same as every
-- other migration in this project.

create table if not exists circles (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions (id) on delete cascade,
  name text not null,
  status text not null default 'draft' check (status in ('draft', 'live', 'recap', 'ended')),
  settings jsonb not null default '{}'::jsonb,
  "order" integer not null default 0,
  current_question_id uuid,
  depth smallint not null default 1 check (depth between 1 and 3),
  pot integer not null default 0,
  bond_prior integer not null default 0,
  recap jsonb,
  created_at timestamptz not null default now()
);

create table if not exists circle_questions (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references circles (id) on delete cascade,
  "order" integer not null,
  text text not null,
  follow_up text,
  depth smallint not null check (depth between 1 and 3),
  source text not null default 'library' check (source in ('library', 'custom')),
  phase text not null default 'answering' check (phase in ('answering', 'revealed', 'done')),
  spotlight_participant_id uuid references participants (id) on delete set null,
  participant_count integer,
  went_deeper boolean not null default false,
  created_at timestamptz not null default now(),
  unique (circle_id, "order")
);

create table if not exists circle_answers (
  id uuid primary key default gen_random_uuid(),
  circle_question_id uuid not null references circle_questions (id) on delete cascade,
  participant_id uuid not null references participants (id) on delete cascade,
  text text,
  skipped boolean not null default false,
  submitted_at timestamptz not null default now(),
  unique (circle_question_id, participant_id)
);

create table if not exists circle_hearts (
  answer_id uuid not null references circle_answers (id) on delete cascade,
  participant_id uuid not null references participants (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (answer_id, participant_id)
);

create table if not exists circle_deeper_votes (
  circle_question_id uuid not null references circle_questions (id) on delete cascade,
  participant_id uuid not null references participants (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (circle_question_id, participant_id)
);

create table if not exists circle_award_votes (
  circle_id uuid not null references circles (id) on delete cascade,
  participant_id uuid not null references participants (id) on delete cascade,
  award text not null check (award in ('best', 'surprising')),
  nominee_participant_id uuid not null references participants (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (circle_id, participant_id, award)
);

-- A group's Bond carries across games. Without player accounts, "the same
-- group" means the same host and the same set of nicknames
-- (lib/game/circle.ts circleGroupKey).
create table if not exists circle_bonds (
  host_id uuid not null references auth.users (id) on delete cascade,
  group_key text not null,
  sparks integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (host_id, group_key)
);

create index if not exists circles_session_id_idx on circles (session_id);
create index if not exists circle_questions_circle_id_idx on circle_questions (circle_id);
create index if not exists circle_answers_question_id_idx on circle_answers (circle_question_id);
create index if not exists circle_deeper_votes_question_id_idx on circle_deeper_votes (circle_question_id);

alter table circles enable row level security;
alter table circle_questions enable row level security;
alter table circle_answers enable row level security;
alter table circle_hearts enable row level security;
alter table circle_deeper_votes enable row level security;
alter table circle_award_votes enable row level security;
alter table circle_bonds enable row level security;

-- Circles and their questions: readable by anyone in the room, written
-- only by the session's host.
create policy "circles are publicly readable" on circles
  for select using (true);

create policy "hosts create circles on their own sessions" on circles
  for insert with check (
    exists (select 1 from sessions s where s.id = session_id and s.host_id = auth.uid())
  );

create policy "hosts update circles on their own sessions" on circles
  for update using (
    exists (select 1 from sessions s where s.id = session_id and s.host_id = auth.uid())
  );

create policy "circle questions are publicly readable" on circle_questions
  for select using (true);

create policy "hosts create circle questions on their own sessions" on circle_questions
  for insert with check (
    exists (
      select 1 from circles c
      join sessions s on s.id = c.session_id
      where c.id = circle_id and s.host_id = auth.uid()
    )
  );

create policy "hosts update circle questions on their own sessions" on circle_questions
  for update using (
    exists (
      select 1 from circles c
      join sessions s on s.id = c.session_id
      where c.id = circle_id and s.host_id = auth.uid()
    )
  );

-- Participants have no auth identity (they join with a code), so answers,
-- hearts and votes are open to insert/update/delete like poll_votes and
-- word_entries. Answers may only change while their question is still
-- being answered.
create policy "circle answers are publicly readable" on circle_answers
  for select using (true);

create policy "anyone can answer an open circle question" on circle_answers
  for insert with check (
    exists (select 1 from circle_questions q where q.id = circle_question_id and q.phase = 'answering')
  );

create policy "anyone can change an answer before the reveal" on circle_answers
  for update using (
    exists (select 1 from circle_questions q where q.id = circle_question_id and q.phase = 'answering')
  );

create policy "anyone can withdraw an answer before the reveal" on circle_answers
  for delete using (
    exists (select 1 from circle_questions q where q.id = circle_question_id and q.phase = 'answering')
  );

create policy "circle hearts are publicly readable" on circle_hearts
  for select using (true);

create policy "anyone can heart an answer" on circle_hearts
  for insert with check (
    not exists (
      select 1 from circle_answers a where a.id = answer_id and a.participant_id = circle_hearts.participant_id
    )
  );

create policy "anyone can remove a heart" on circle_hearts
  for delete using (true);

create policy "circle deeper votes are publicly readable" on circle_deeper_votes
  for select using (true);

create policy "anyone can vote to go deeper" on circle_deeper_votes
  for insert with check (true);

create policy "anyone can withdraw a deeper vote" on circle_deeper_votes
  for delete using (true);

create policy "circle award votes are publicly readable" on circle_award_votes
  for select using (true);

create policy "anyone can vote for an award" on circle_award_votes
  for insert with check (true);

create policy "anyone can change an award vote" on circle_award_votes
  for update using (true);

create policy "hosts read their own bonds" on circle_bonds
  for select using (auth.uid() = host_id);

create policy "hosts create their own bonds" on circle_bonds
  for insert with check (auth.uid() = host_id);

create policy "hosts update their own bonds" on circle_bonds
  for update using (auth.uid() = host_id);
