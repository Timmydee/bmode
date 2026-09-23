# Game Night — Build Progress

Tracking against `agents/prd-and-build-guide.md` §9 phased build plan.

## Status: v1 complete — all Phases 0–7 done and verified

All 7 phases are built and pass `npm run lint`, `npx tsc --noEmit`,
`npm test` (34/34), and `next build` cleanly. Phases 2–6 were additionally
verified **live against the real Supabase backend** using Playwright-driven
real browsers (not mocks) — multi-client realtime flows included. See each
phase's section below for what was checked and the real bugs that live
testing caught (four total, all in the realtime layer — see Phases 4 and
6). Phase 7's final manual test — a real session run with a real group —
was completed by the user (2026-09-17) and confirmed working. Per PRD §10,
this is the definition of "done" for v1: nothing further is scoped in the
phased build plan. Any next feature (scoring, branding, analytics, the
Fastest Finger mechanics, etc.) is explicitly deferred in the PRD and needs
its own decision before work starts — see the "What's next" note at the
end of this file.

## Phase 0 — Project setup
- [x] Next.js (App Router) + TypeScript — already bootstrapped (create-next-app)
- [x] Tailwind CSS configured with design-system tokens (tailwind.config.ts, loaded via `@config` in app/globals.css — Tailwind v4 is CSS-first by default but supports a legacy config file this way, satisfying PRD §6 literally while staying on the installed v4)
- [x] Bricolage Grotesque + Instrument Sans loaded via next/font/google (app/layout.tsx)
- [x] ESLint no-restricted-imports rule blocking @supabase/supabase-js outside lib/backend/supabase/** — verified: fails outside the folder, passes inside it
- [x] Full folder structure from architecture-scaffold.md §1 (stub files with TODO comments for anything beyond Phase 0/1 scope; added lib/backend/supabase/participant-repo.ts, named explicitly in the Phase 2 checklist though omitted from the scaffold's illustrative file list)
- [x] Supabase project created, URL/anon key in .env.local (done by the user — I have no browser/account access to create third-party cloud accounts myself)

**Definition of done check:** `next build` succeeds (blank root page, all routes compile), lint rule verified failing/passing as above, folder structure matches. Phase 0 DoD does not itself require live Supabase credentials — deferring that to before Phase 2 starts.

## Phase 1 — Types and pure logic
- [x] lib/backend/types.ts — exact copy of architecture-scaffold.md §2
- [x] lib/backend/contracts.ts — exact copy of §3
- [x] lib/backend/events.ts — **deviates from §4's literal code**: every
      variant carries `serverTime`, not just `activity_activated`. This
      resolves a conflict between the scaffold's code sample and the PRD's
      §5 non-negotiable rule ("every realtime event carries serverTime");
      user chose to follow the PRD rule. See comment in the file.
- [x] lib/game/aggregate-poll.ts
- [x] lib/game/aggregate-wordcloud.ts
- [x] lib/game/rank-questions.ts
- [x] lib/game/profanity.ts — basic blocklist + leetspeak/punctuation
      normalization; known limitation: naive substring matching can false-
      positive on words containing a blocked substring (Scunthorpe problem)
      — acceptable for v1's "basic filter" scope
- [x] lib/game/validation.ts — nickname, word, question, poll-option-selection
- [x] Unit tests for all of the above (33 tests, `npm test`)

**Definition of done check:** none of the files above import from
`lib/backend/supabase/` or any network/DB library (verified by grep);
`npm test` → 33/33 passing; `npm run lint` and `next build` both clean.

## Phase 2 — Supabase schema + adapter (sessions + participants)
- [x] SQL schema written: supabase/migrations/0001_sessions_participants.sql
- [x] lib/backend/supabase/client.ts
- [x] lib/backend/supabase/mappers.ts (sessions + participants)
- [x] SessionRepository — lib/backend/supabase/session-repo.ts
- [x] ParticipantRepository — lib/backend/supabase/participant-repo.ts
      (not listed in architecture-scaffold.md §1's illustrative supabase/
      file list, but named explicitly in this phase's own checklist — added)
- [x] AuthClient (magic link) — lib/backend/supabase/auth.ts
- [x] lib/identity/participant-token.ts
- [x] lib/backend/supabase/index.ts assembles a fully-typed Backend —
      activities/responses/qa/realtime are throwing stubs
      ("implemented in Phase N") rather than `as Backend` casts, so a
      premature call fails loudly instead of silently returning undefined
- [x] lib/backend/index.ts (the swap point) wired per scaffold §5
- [x] `npm run lint`, `npx tsc --noEmit`, `next build` all clean
- [x] **Live verification passed against a real Supabase project.**
      `lib/backend/supabase/phase2.integration.test.ts` signs in as a real
      test host (via email/password, standing in for magic-link — satisfies
      the "hosts create their own sessions" RLS policy for real rather than
      bypassing it), then creates a session, retrieves it by join code,
      joins a participant, and rejoins by token — all through the `Backend`
      interface only. 34/34 tests passing, lint and `next build` clean.

**Phase 2 definition of done: met.**

## Phase 3 — Landing, create session, join, lobby
- [x] app/page.tsx — editorial landing (kicker, big headline, lede, two CTAs)
- [x] app/host/page.tsx — magic-link sign-in + session list + create-session
      form
- [x] app/join/page.tsx — 6-digit code entry
- [x] app/join/[code]/page.tsx — nickname entry → Pocket lobby, with rejoin
      via lib/identity/participant-token.ts
- [x] lib/backend/supabase/realtime.ts — real implementation (broadcast +
      presence-to-broadcast bridging, since presence itself has no slot in
      SessionEvent)
- [x] lib/hooks/useSession.ts, lib/hooks/useParticipant.ts
- [x] Stage-mode host lobby (dark, join code, QR via qrcode.react, live
      participant count) — app/host/[sessionId]/page.tsx
- [x] Added a host-ownership guard on app/host/[sessionId]/page.tsx (not
      explicitly in this phase's checklist, but the route had zero auth
      check — anyone who knew a session's UUID could view it; closed since
      PRD §2 calls for "a lightweight authenticated view")
- [x] Added two Tailwind tokens not in the PRD §6 list but needed for visual
      parity with design-system.html: `stage-muted` (#B5AFD1, muted text on
      Stage) and `hairline` (#DED6BE, borders/dividers on Paper)

### Live verification (not just code review)
Used the `run` skill (Playwright, no project skill existed yet) to actually
drive the app in headless Chromium against the real Supabase project:
- Landing, /join, /host screenshots checked against design-system.html —
  fonts, colors, layout all match; zero console errors
- Full two-browser-context test: signed in as the real test host (session
  injected into localStorage under Supabase's `sb-<ref>-auth-token` key),
  created a session, opened the Stage lobby; in a second, unauthenticated
  context, joined via the real join code; confirmed the host's live
  participant count updated from 0 → 1 within ~1s with **no page refresh**,
  purely through realtime.subscribe/publish — this is Phase 3's DoD,
  verified against the live backend, not mocked.

### Two real bugs found and fixed by this live test
1. **Participant count was double-counting the host.** trackPresence was
   called by both the host (to keep a stable presence-channel listener so
   departures get observed) and the joining participant, both on the same
   presence channel — so the host's own presence entry was counted as a
   participant (showed "2" after 1 join). Fixed by prefixing the host's
   presence key with `host:` and filtering it out of the count in
   lib/backend/supabase/realtime.ts.
2. **The "Live" indicator silently rendered in the wrong color.** The PRD
   §6 token config names the violet accent `current`, but `current` is a
   Tailwind-reserved keyword (`bg-current`/`text-current` alias to CSS
   `currentColor`) — so the literal PRD snippet produces a dead utility for
   this exact color. Renamed the Tailwind key to `live` (same hex, same
   "live / changing right now" meaning) and updated the two usage sites.

**Definition of done: met**, verified live against the real backend, not
inferred from code. One remaining recommendation: do a quick manual check
from an actual phone (QR scan + touch) since headless Chromium doesn't
catch mobile-Safari-specific quirks — not blocking, the core mechanism is
proven.

## Phase 4 — Poll activity end to end
- [x] Schema: activities, poll_options, poll_votes —
      supabase/migrations/0002_activities_polls.sql
- [x] ActivityRepository (poll create/list/getById/setStatus/reorder) and
      ResponseRepository poll methods (submitVote/hasResponded/getPollResults)
      — lib/backend/supabase/{activity-repo,response-repo}.ts
- [x] Host UI: create a poll (question + 2-6 options), queue it, activate it
      — app/host/[sessionId]/page.tsx
- [x] Host UI: live bar chart (violet accent on the current leader(s), gold
      otherwise) — components/poll/PollResults.tsx
- [x] Participant UI: see the active poll, tap an option, see submitted
      state — components/poll/PollVoting.tsx
- [x] poll_results_updated wired end to end: vote → aggregate-poll.ts runs →
      broadcast → other devices update
- [x] One vote per participant per poll: enforced by a DB unique constraint
      (activity_id, participant_id) — this is the real, unbypassable
      enforcement; a client-side hasResponded() check also disables the UI
      for good UX
- [x] "Rate limiting" scope decision: a true distributed request-rate
      limiter needs server-side shared state, which isn't achievable
      without a custom always-on server or paid service — both explicitly
      out of scope for v1's zero-budget constraint. The one-vote-per-
      participant uniqueness constraint is the practical, free enforcement
      that actually matters here (it's what stops repeat-submission abuse
      for polls); documented instead of silently claiming a distributed
      rate limiter that wasn't built.

### Live verification — 3 simultaneous participants, real backend
Extended the Playwright harness: host signs in for real, creates a poll
through the actual host UI, activates it; 3 separate browser contexts join
via the real join code *simultaneously* (Promise.all) and vote for 3
different options simultaneously. Confirmed: bar chart shows 33%/33%/33%
within ~1s, participant count reads 3, a participant's page survives a
hard refresh mid-poll and still shows "already voted" (rejoin resilience),
and a duplicate-vote insert attempted directly against the DB (bypassing
the UI) is rejected by the unique constraint. Zero console errors on host
or participant pages.

### Three real bugs found and fixed by this live test
1. **Activating a poll didn't update the host's own screen.** Supabase
   Realtime broadcast does not deliver a client's own messages back to
   itself by default. The host publishes activity_activated/closed and
   needs to receive its own broadcast to update its own view — fixed by
   setting `broadcast: { self: true }` on the subscribing channel in
   lib/backend/supabase/realtime.ts.
2. **Participant count still didn't update even after fix #1.** Diagnosed
   with temporary debug logging: useSession, useActiveActivity, and
   useLiveResults each independently called `subscribe()` for the same
   session, each opening its *own* Supabase channel object for the
   identical topic — and broadcasts weren't reliably reaching all of them.
   Fixed by making the adapter share one channel per session topic
   (reference-counted, fanning out to every registered handler) instead of
   one channel per hook.
3. **(Caught mid-investigation, fixed first) Double-counting the host as a
   participant** — the host's own presence entry was included in the
   participant count. Fixed by prefixing the host's presence key
   (`host:${sessionId}`) and excluding that prefix from the count; this
   also led to designating the host as the *sole* publisher of
   participant_joined/left (see realtime.ts comments) to avoid a
   multi-publisher race under concurrent joins.

None of these three would have been caught by unit tests or by reading the
code — all three only surfaced by actually running 3 real, concurrent
browser sessions against the live backend, which is exactly why the build
plan calls for that kind of verification at this phase.

**Definition of done: met**, verified live. Known minor gap (not a DoD
blocker): after a page refresh, a participant's already-submitted vote is
correctly remembered (can't vote again), but which specific option they
picked isn't re-highlighted, since `ResponseRepository.hasResponded()` only
returns a boolean per the exactly-specified contract — extending the
contract for this cosmetic nicety wasn't judged worth deviating from
architecture-scaffold.md §3.

## Phase 5 — Word cloud
- [x] Schema: word_entries — supabase/migrations/0003_word_entries.sql
- [x] ResponseRepository word cloud methods (submitWord, getWordCloudResults)
- [x] `hasResponded` generalized to mean "used up allowed responses for this
      activity" — true after 1 vote for a poll, true after reaching
      maxWordsPerParticipant for a word cloud. Chosen instead of extending
      the contract with a new "how many left" method: it fits the existing
      boolean exactly, and — unlike a client-side counter — the cap holds
      even if the participant refreshes mid-cloud.
- [x] Host UI: create a word cloud prompt (+ words-per-participant picker),
      activate it, view the live cloud — CreateWordCloudForm in
      app/host/[sessionId]/page.tsx
- [x] Participant UI: submit words one at a time up to their limit, then
      the form locks — components/wordcloud/WordCloudInput.tsx
- [x] Every submission runs through lib/game/profanity.ts (via
      validateWord) *before* it's stored or broadcast — rejected with a
      visible inline error, never silently dropped
- [x] wordcloud_updated wired end to end, reusing the now-hardened realtime
      pattern from Phase 4 (shared channel, self:true, single presence
      publisher)
- [x] lib/hooks/useLiveResults.ts generalized to serve both PollResults and
      WordCloudResults (kind-discriminated), rather than adding a second
      hook file not present in architecture-scaffold.md's hooks list

### Live verification — real backend, no new bugs
Extended the same Playwright harness: host creates a word cloud (cap = 2
words/participant) through the real UI and activates it; two participants
join and submit words concurrently, one hitting her cap exactly, the other
submitting a clean word then a profane one. Confirmed: the profane
submission is rejected with a visible inline error ("That word isn't
allowed here...") and is verifiably never written to the database (checked
directly), the capped participant's form correctly locks after her 2nd
word, and the host's cloud updates live with words sized by frequency —
a word submitted 4x rendered dramatically larger than ones submitted once.
Zero console errors on host or participant pages. Unlike Phase 4, this
phase surfaced no new bugs — the realtime fixes made there held up
correctly under the same class of concurrent-multi-client load.

**Definition of done: met**, verified live against the real backend.

## Phase 6 — Q&A and moderation
- [x] Schema: questions, question_upvotes —
      supabase/migrations/0004_questions.sql. Upvote counts are computed at
      query time (lib/backend/supabase/qa-repo.ts), not via a trigger-
      maintained counter column — a counter trigger is exactly the kind of
      business logic architecture rule #2 keeps out of Postgres.
- [x] QARepository — lib/backend/supabase/qa-repo.ts
- [x] Participant UI: submit a question (QuestionComposer), upvote others'
      (not own) — components/qa/{QuestionComposer,QuestionList}.tsx
- [x] Host UI: sorted question list via lib/game/rank-questions.ts, mark
      answered, hide/unhide — same QuestionList component in moderation
      mode (host sees hidden questions faded + labeled; participants never
      receive them since `list()` excludes hidden by default)
- [x] question_added / question_updated wired end to end
- [x] "Can't upvote your own question" enforced both client-side (upvote
      button disabled on your own question) and server-side (repo-layer
      check + a mirroring RLS insert policy as the safety net)

### Live verification — real backend
Extended the same Playwright harness: host creates and activates a Q&A;
two participants join, each ask a question, one upvotes the other's
question (not her own — confirmed the button is disabled for your own
question). Confirmed: the host's list re-sorts live so the upvoted question
moves to the top, marking a question answered updates live on the asking
participant's own screen, and hiding a question makes it disappear from
the participant's view immediately while remaining visible-but-marked-
hidden in the host's moderation view. Zero console errors on host or
participant pages.

### One more real bug found and fixed
**`AudienceQuestion.submittedAt` broke after crossing a broadcast.**
Realtime broadcast payloads are JSON, so a `Date` field survives only as a
plain ISO string on the receiving end — not a `Date` instance. This
silently crashed `lib/game/rank-questions.ts` (`.getTime()` is not a
function on a string) the moment a question_added/question_updated event
arrived on another client. Fixed by reviving that one known field back
into a `Date` centrally in the realtime adapter's broadcast handler
(lib/backend/supabase/realtime.ts), rather than patching every consumer —
the fix generalizes to any future event carrying a Date field.

**Definition of done: met**, verified live against the real backend. This
brings the running total of real, live-testing-only bugs found across
Phases 4–6 to four — none of them would have been caught by unit tests or
code review alone.

## Phase 7 — Polish pass
- [x] Presenter/projector full-screen view —
      app/host/[sessionId]/present/page.tsx. Same data as the control page
      (session, active activity, live results) but strictly display-only:
      no create/activate/moderate controls, so nothing a host wouldn't want
      an audience to see can reach this screen. Linked from the control
      page via an "Open projector view" link (opens in a new tab, meant for
      a second display/projector).
- [x] Empty and error states audited across every screen. Two real gaps
      found and fixed:
      - `handleActivate`/`handleClose` on the host control page had no
        try/catch — a failure would silently do nothing with no user
        feedback. Added error state + inline message.
      - "Session not found" / "you don't have access" states said what
        happened but not what to do next — added a "Back to your
        sessions" / "Sign in" link to both (control and present pages).
- [x] Keyboard focus visibility audited with Playwright (tab order +
      computed `outline`/`box-shadow`, not just eyeballing). Found the
      Stage-surface form inputs (poll/word-cloud/Q&A creation) only had a
      border-color change on focus, weaker than the Paper inputs' ring —
      brought them in line with the same `focus-visible:ring-2` treatment.
      Confirmed: text inputs render a visible ring, buttons keep the
      browser's native focus outline (never suppressed).
- [x] Mobile responsiveness audited on the participant flow at a 375×667
      (iPhone SE-class) viewport: landing, join, nickname entry, poll
      voting. No horizontal overflow, touch targets are full-width and
      generously sized, text wraps correctly. Screenshots checked visually
      — layouts already worked as designed with no changes needed.
- [x] **Manual test with a real group — done by the user (2026-09-17),
      confirmed working.**

### What I verified automatically vs. what needs you
Everything above — including the Phase 4/5/6 multi-client realtime flows —
was verified with real browsers (Playwright) against the real Supabase
backend, not mocked. That's as far as automation can go. What it cannot
verify: the actual human experience — scanning a QR code with a real phone
camera, typing on a real mobile keyboard, the host narrating to a real room
while glancing at a real screen, real-world network conditions. That is
exactly what PRD §8's validation criteria are asking about, and it needs a
real human running a real session.

**What to do:** run one full session — poll → word cloud → Q&A → end —
with at least 3 other real people joining from their own phones via the
QR code or join link, without me intervening. While doing it, check:
- Does the join flow feel instant, or is there a noticeable lag?
- Do you (the host) find yourself narrating the live results out loud
  without being prompted to? (That's the tell from §8 that this is driving
  the session, not decorating it.)
- Does anything look broken or cramped on an actual phone screen (not a
  simulated one)?
- Does a participant's vote/word/question actually show up on your screen
  within about a second?

I can't run this step myself — it's a human validation, not a code check.
