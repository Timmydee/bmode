-- Bmode: fake-door test for premium decks.
--
-- Locked premium decks show on /cards and in the host's question picker.
-- They can't be bought yet: tapping one asks for an email to get early
-- access. This table counts who saw them, who tapped which deck, and who
-- left an email, by the same random device_id as usage_events (0009).
-- The email itself goes to email_signups (0010) with source 'premium_deck'.
--
-- Insert-only from the browser, like usage_events. /admin reads it on the
-- server with the service role key. Needs 0009 and 0010 applied first.

create table if not exists premium_interest (
  id bigint generated always as identity primary key,
  device_id uuid not null,
  deck_id text check (deck_id is null or char_length(deck_id) between 1 and 40),
  action text not null check (action in ('view', 'tap', 'email')),
  place text not null check (place in ('cards', 'picker')),
  created_at timestamptz not null default now()
);

create index if not exists premium_interest_created_at_idx on premium_interest (created_at);

alter table premium_interest enable row level security;

create policy "anyone records premium interest" on premium_interest
  for insert to anon, authenticated with check (true);

-- Let the early-access email land on the same list as the other signups.
alter table email_signups drop constraint if exists email_signups_source_check;
alter table email_signups add constraint email_signups_source_check
  check (source in ('host_recap', 'cards', 'premium_deck'));
