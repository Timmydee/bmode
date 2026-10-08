-- Fix: question_scores only had an insert policy (0005), but
-- score-repo.ts writes via upsert(..., { onConflict: "activity_id,participant_id" })
-- — a re-score of the same question (idempotent retry, or "End round now"
-- re-scoring the in-progress question) hits the update branch of that
-- upsert, which Postgres/PostgREST checks against RLS separately from the
-- insert branch. With no update policy, that branch was rejected by the
-- default-deny, surfacing as "new row violates row-level security policy
-- (USING expression) for table question_scores". Same ownership-subquery
-- check as the existing insert policy, just for update.
--
-- 0005 was later amended to create this same policy itself, so drop it
-- first: without this, a fresh database (supabase db reset, a new
-- environment) fails here with "policy ... already exists".

drop policy if exists "hosts update scores on their own sessions' questions" on question_scores;

create policy "hosts update scores on their own sessions' questions" on question_scores
  for update using (
    exists (
      select 1 from activities a
      join sessions s on s.id = a.session_id
      where a.id = activity_id and s.host_id = auth.uid()
    )
  );
