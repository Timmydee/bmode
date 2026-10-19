-- Bmode: email signups for new questions and Bmode news.
--
-- People opt in themselves: a host after a game, or a visitor on /cards.
-- consent_text stores the exact promise they saw next to the button, so
-- it's clear later what each person agreed to.
--
-- Insert-only from the browser, like feedback (0009). /admin reads the
-- list on the server with the service role key.

create table if not exists email_signups (
  id uuid primary key default gen_random_uuid(),
  email text not null check (
    char_length(email) between 3 and 200
    and email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
  ),
  source text not null check (source in ('host_recap', 'cards')),
  consent_text text not null check (char_length(consent_text) between 1 and 300),
  device_id uuid,
  created_at timestamptz not null default now()
);

-- One row per address: signing up again is a no-op (the insert fails with
-- a unique violation, which the app treats as success).
create unique index if not exists email_signups_email_key on email_signups (lower(email));
create index if not exists email_signups_created_at_idx on email_signups (created_at);

alter table email_signups enable row level security;

create policy "anyone signs up for emails" on email_signups
  for insert to anon, authenticated with check (true);
