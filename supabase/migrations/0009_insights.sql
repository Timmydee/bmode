-- Bmode: usage counts and in-app feedback.
--
-- Privacy-light by design: a browser is identified only by a random
-- device_id the app creates in localStorage (lib/identity/device-id.ts).
-- No IP address, user agent, nickname or answer text is stored here.
--
-- Anyone using the app may insert rows; nobody may read them through the
-- public API. The /admin page reads them on the server with the service
-- role key, which bypasses RLS, through insights_summary() below.

create table if not exists usage_events (
  id bigint generated always as identity primary key,
  device_id uuid not null,
  event text not null check (event in ('visit', 'host_game', 'join_game')),
  session_id uuid references sessions (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists usage_events_created_at_idx on usage_events (created_at);

create table if not exists feedback (
  id uuid primary key default gen_random_uuid(),
  device_id uuid,
  rating smallint check (rating between 1 and 5),
  message text not null check (char_length(message) between 1 and 2000),
  email text check (email is null or char_length(email) <= 200),
  page text check (page is null or char_length(page) <= 200),
  session_id uuid references sessions (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists feedback_created_at_idx on feedback (created_at);

alter table usage_events enable row level security;
alter table feedback enable row level security;

-- Insert-only for everyone (hosts are anonymous-auth users, players use
-- the anon key). With no select policy, inserts must not ask for the row
-- back, which supabase-js does not do unless .select() is chained.
create policy "anyone records usage" on usage_events
  for insert to anon, authenticated with check (true);

create policy "anyone sends feedback" on feedback
  for insert to anon, authenticated with check (true);

-- One call for the admin page: headline numbers plus a 30-day series.
-- Games and joins come from the existing sessions/participants tables, so
-- they include history from before tracking existed; "people" counts
-- distinct devices and starts the day this migration ships.
create or replace function insights_summary()
returns jsonb
language sql
stable
set search_path = public
as $$
  with days as (
    select generate_series(current_date - 29, current_date, interval '1 day')::date as day
  )
  select jsonb_build_object(
    'people_today', (select count(distinct device_id) from usage_events where created_at >= current_date),
    'people_7d', (select count(distinct device_id) from usage_events where created_at >= current_date - 6),
    'people_30d', (select count(distinct device_id) from usage_events where created_at >= current_date - 29),
    'people_all', (select count(distinct device_id) from usage_events),
    'games_7d', (select count(*) from sessions where created_at >= current_date - 6),
    'games_all', (select count(*) from sessions),
    'joins_7d', (select count(*) from participants where joined_at >= current_date - 6),
    'joins_all', (select count(*) from participants),
    'circles_finished_all', (select count(*) from circles where status in ('recap', 'ended')),
    'feedback_all', (select count(*) from feedback),
    'rating_avg', (select round(avg(rating)::numeric, 1) from feedback where rating is not null),
    'tracking_since', (select min(created_at) from usage_events),
    'daily', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'day', d.day,
        'people', (select count(distinct device_id) from usage_events u
                   where u.created_at >= d.day and u.created_at < d.day + 1),
        'games', (select count(*) from sessions s
                  where s.created_at >= d.day and s.created_at < d.day + 1),
        'joins', (select count(*) from participants p
                  where p.joined_at >= d.day and p.joined_at < d.day + 1)
      ) order by d.day), '[]'::jsonb)
      from days d
    )
  );
$$;

revoke execute on function insights_summary() from public, anon, authenticated;
grant execute on function insights_summary() to service_role;
