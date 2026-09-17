# Game Night — Product Requirements & Build Guide

Companion docs (keep alongside this file, agent should read both before starting):
- `architecture-scaffold.md` — folder structure, contracts, adapter pattern
- `design-system.html` — color, type, component and screen reference

This document is written to be followed step by step by a coding agent. Each
phase ends with an explicit **Definition of done** the agent should verify
before moving to the next phase. Do not skip ahead — later phases assume
earlier contracts exist exactly as specified.

---

## 1. Product summary

**What it is:** A live audience-interaction tool for meetings and events —
polls, word clouds, and moderated Q&A — run from a host's screen (laptop,
projector, TV) while participants join from their own phones with no account
and no app install.

**Positioning:** A validation-stage competitor to Slido/Mentimeter, scoped to
the smallest wedge that's still useful in a real meeting.

**Primary user (host):** Someone running a meeting, event, or session who
wants live audience input instead of a one-way presentation.

**Secondary user (participant):** An attendee who joins via a short code or
link, answers on their phone, and never creates an account.

**Explicit non-goal for v1:** This is not yet the "game-show / Fastest Finger"
platform from earlier concepting. That may come later, once this validates.
Do not build scoring, leaderboards, or timed-reaction mechanics in v1.

---

## 2. v1 scope

### In scope

**Session management**
- Host creates a session — gets a short join code and shareable link
- No login required for participants — join via code or link only
- Host has a lightweight authenticated view (magic link is enough)
- Session state machine: `draft → live → ended`
- Auto-generated QR code for the join link

**Host (presenter) view**
- Queue multiple activities in one session (poll, then word cloud, then Q&A)
- Activate one activity at a time
- See live participant count
- See live results updating in real time
- Q&A: mark answered, hide/delete a question
- Manually close an activity, manually end the session

**Participant (player) view**
- Join screen: code entry, optional nickname
- See only the currently active activity, not the full queue
- Submit an answer / word / question
- Upvote others' questions
- See results after submitting (if the host allows it)

**Activity type 1 — Live poll**
- Host defines a question and 2–6 options
- Live bar chart of results
- One submission per participant per poll

**Activity type 2 — Word cloud**
- Host defines a prompt
- Participants submit 1–3 short words
- Live-updating cloud, sized by frequency
- Basic profanity/spam filter

**Activity type 3 — Q&A**
- Participants submit questions
- Participants upvote (not their own)
- Sorted by votes; host marks answered/hidden

**Cross-cutting**
- Real-time sync via Supabase Realtime broadcast (not raw `postgres_changes`
  — see architecture doc, section 8)
- Rejoin resilience: short-lived participant token in localStorage
- Basic rate limiting on public submission endpoints

### Explicitly out of scope for v1

Do not build these even if they seem easy to add along the way:
- Quizzes with scoring or leaderboards
- PowerPoint/Zoom/Teams embeds
- Per-host branding/theming
- Analytics/export/reporting dashboards
- Multi-language support
- Team/org accounts with multiple admins
- Billing or payment of any kind
- The Fastest Finger / game-show mechanics from earlier concepting

If a task seems to require one of these, stop and flag it rather than
building a partial version.

---

## 3. Tech stack

| Layer | Choice | Notes |
|---|---|---|
| Frontend | Next.js (App Router) + TypeScript | |
| Styling | Tailwind CSS | tokens derived from `design-system.html` — see §6 |
| Backend (v1) | Supabase (Postgres + Realtime + Auth) | accessed only through the adapter — see §5 |
| Hosting | Vercel (frontend) + Supabase cloud | free tier for both at this stage |
| Realtime transport | Supabase Realtime `broadcast` channels | not `postgres_changes` |

Cost constraint: **zero budget.** Everything in v1 must run on free tiers.
Do not introduce a paid service, a second backend, or an always-on custom
server at this stage — that migration path exists (see architecture doc) but
is explicitly deferred until after validation.

---

## 4. Data model

Use the domain types exactly as defined in `architecture-scaffold.md` §2
(`Session`, `Participant`, `Activity` and its `PollActivity` /
`WordCloudActivity` / `QAActivity` variants, `PollVote`, `WordEntry`,
`AudienceQuestion`, `PollResults`, `WordCloudResults`). Do not invent
additional fields not listed there without checking in first — the types are
intentionally minimal for v1.

Map these to Supabase Postgres tables with standard normalized shape (one
table per entity, foreign keys to `session_id` / `activity_id`). Table and
column names may follow Postgres convention (snake_case); the mapping from
row to domain type happens in `lib/backend/supabase/mappers.ts` — components
never see raw row shapes.

---

## 5. Architecture rules (non-negotiable)

These are covered in full in `architecture-scaffold.md`. Restating the ones
most likely to get shortcut under agent time pressure:

1. **No `@supabase/supabase-js` import outside `lib/backend/supabase/`.**
   Every component, hook, and page goes through the `Backend` interface in
   `lib/backend/contracts.ts`.
2. **No business logic in Postgres functions, triggers, or RLS policies
   encoding scoring/validation rules.** Keep that logic in `lib/game/` as
   pure, backend-free TypeScript.
3. **Realtime events go through the explicit `SessionEvent` union** in
   `lib/backend/events.ts`, published via `broadcast`, not inferred from
   `postgres_changes` payloads.
4. **Every realtime event carries `serverTime`.** Not used for scoring in v1,
   but the habit costs nothing now and matters if the platform extends to
   timed mechanics later.
5. If a step below seems to require breaking one of these rules, stop and
   flag it rather than proceeding.

---

## 6. Design system application

Source of truth: `design-system.html`. Translate its tokens into
`tailwind.config.ts` rather than hardcoding hex values in components:

```
colors: {
  stage: '#14121F',
  'stage-2': '#1D1A2C',
  'stage-line': '#332F47',
  spotlight: '#F5B759',
  'spotlight-ink': '#4A2E00',
  current: '#7C6FF0',
  'current-ink': '#EFECFF',
  ember: '#E85D4C',
  paper: '#FBF7EF',
  'paper-2': '#F2ECDD',
  ink: '#1C1A24',
  'ink-soft': '#5B5768',
  'ink-faint': '#8B8697',
}
```

Fonts: Bricolage Grotesque (display) + Instrument Sans (body), loaded via
`next/font/google`.

Rules to carry over from the reference doc:
- `current` (violet) is reserved for "live / changing right now" — never a
  static winner color, never used for anything at rest.
- No shadows on Stage (dark/presenter) surfaces. Soft elevation only on
  Paper (light/participant) surfaces.
- Sentence case everywhere. No ALL-CAPS labels, no arrow suffixes on buttons
  that don't navigate away.

---

## 7. Non-functional requirements

- **Realtime latency target:** results should update on other screens within
  ~1 second of a submission. This is an aggregation use case, not a
  millisecond-precision race — do not over-engineer clock sync for v1.
- **Rejoin resilience:** a participant refreshing their tab keeps their
  identity and prior submissions via the localStorage token, not a fresh
  join.
- **Abuse resistance:** rate-limit submission endpoints; run the profanity
  filter on word cloud entries before they're broadcast, not after.
- **Accessibility:** visible keyboard focus, adequate color contrast on both
  Stage and Paper surfaces, responsive down to a small phone screen.
- **Mobile-first for the participant view.** Stage view can assume a larger
  screen.

---

## 8. Validation / success criteria

This build exists to answer a question, not just to ship code. Keep these in
mind when making judgment calls about polish vs. speed:

- Can a host run one full session (poll → word cloud → Q&A) with a real
  group without the agent-author needing to intervene?
- Does the host, unprompted, reference the live results while talking to
  the group? (The tell that it's driving the session, not decorating it.)
- Does everything work within Supabase's free tier at the scale of one
  real meeting (well under 200 concurrent connections)?

---

## 9. Phased build plan

Work through these phases in order. Each phase has a **Definition of done**
— treat it as a checklist, not a suggestion, before moving to the next
phase.

### Phase 0 — Project setup

- [ ] Initialize Next.js (App Router) + TypeScript project
- [ ] Install and configure Tailwind CSS with the token config from §6
- [ ] Load Bricolage Grotesque + Instrument Sans via `next/font/google`
- [ ] Set up ESLint rule: `no-restricted-imports` blocking
      `@supabase/supabase-js` outside `lib/backend/supabase/**`
- [ ] Create the full folder structure from `architecture-scaffold.md` §1
      (empty files where noted, e.g. `lib/backend/socketio/.gitkeep`)
- [ ] Create a Supabase project (free tier), store URL/anon key in `.env.local`

**Definition of done:** app boots to a blank page, lint rule is verified to
actually fail on a deliberate test violation, folder structure matches the
scaffold doc exactly.

### Phase 1 — Types and pure logic (no backend yet)

- [ ] Write `lib/backend/types.ts` exactly as specified in the architecture
      doc §2
- [ ] Write `lib/backend/contracts.ts` exactly as specified in §3
- [ ] Write `lib/backend/events.ts` exactly as specified in §4
- [ ] Implement `lib/game/aggregate-poll.ts` — pure function, votes in,
      `PollResults` out
- [ ] Implement `lib/game/aggregate-wordcloud.ts` — pure function, entries in,
      `WordCloudResults` out
- [ ] Implement `lib/game/rank-questions.ts` — sorts `AudienceQuestion[]` by
      upvotes, filters hidden
- [ ] Implement `lib/game/profanity.ts` — basic word/phrase filter for word
      cloud entries
- [ ] Implement `lib/game/validation.ts` — input validation for all
      participant-submitted content
- [ ] Write unit tests for every function above

**Definition of done:** `lib/game/` and `lib/backend/{types,contracts,events}.ts`
exist, have no imports from `lib/backend/supabase/` or any network/DB
library, and all unit tests pass. This phase should be completable and
fully testable before Supabase is even configured.

### Phase 2 — Supabase schema and adapter: sessions + participants only

- [ ] Design and create Postgres tables for `sessions` and `participants`
      (see §4 for domain shape)
- [ ] Write `lib/backend/supabase/client.ts`
- [ ] Write `lib/backend/supabase/mappers.ts` for these two entities
- [ ] Implement `SessionRepository` in `lib/backend/supabase/session-repo.ts`
- [ ] Implement `ParticipantRepository` in
      `lib/backend/supabase/participant-repo.ts`
- [ ] Implement `AuthClient` in `lib/backend/supabase/auth.ts` (magic link)
- [ ] Implement `identity/participant-token.ts` (localStorage token
      generation/retrieval)
- [ ] Wire these into `lib/backend/supabase/index.ts`, assembled as a
      partial `Backend` object
- [ ] Wire `lib/backend/index.ts` (the swap point) to return this backend

**Definition of done:** from a scratch script or test page, can create a
session, retrieve it by join code, join as a participant, and retrieve that
participant by token — all through the `Backend` interface, none of it
importing Supabase directly outside the adapter folder.

### Phase 3 — Landing, create session, join, lobby

- [ ] Build `app/page.tsx` — landing with Create / Join, following the
      editorial (not centered-generic) layout direction from the design doc
- [ ] Build `app/host/page.tsx` — host's session list (uses `AuthClient`)
- [ ] Build host session creation flow → generates join code + QR
- [ ] Build `app/join/page.tsx` — code entry
- [ ] Build `app/join/[code]/page.tsx` — nickname entry → lobby
- [ ] Implement `lib/backend/supabase/realtime.ts` per the sketch in the
      architecture doc §6
- [ ] Implement `lib/hooks/useSession.ts` and a presence-based live
      participant count in the lobby
- [ ] Style the Stage-mode lobby (dark, large join code, QR, live participant
      list) per `design-system.html`

**Definition of done:** two browser sessions (or a browser + phone) can join
the same room via code, and the host's lobby view shows the participant
count updating live without a page refresh, purely through the realtime
adapter.

### Phase 4 — Poll activity end to end

This is the proving phase — it exercises the entire realtime loop once, and
everything after this reuses the pattern.

- [ ] Extend Postgres schema: `activities`, `poll_options`, `poll_votes`
- [ ] Implement `ActivityRepository` and the poll methods of
      `ResponseRepository` in the Supabase adapter
- [ ] Host UI: create a poll (question + 2–6 options), activate it
- [ ] Host UI: live bar chart of results (Stage styling, violet accent on
      the current leader per the design doc's rule)
- [ ] Participant UI: see active poll, tap an option, see submitted state
      (Pocket styling)
- [ ] Wire `poll_results_updated` events end to end: submit on one device →
      `lib/game/aggregate-poll.ts` runs → broadcast → other devices update
- [ ] Enforce one submission per participant per poll (both client-side UX
      and server-side check)
- [ ] Add rate limiting on the vote-submission endpoint

**Definition of done:** a real poll, run across at least 3 simultaneous
participant sessions, updates the host's bar chart within ~1 second of each
vote, survives a participant refreshing mid-poll (rejoin resilience), and a
second vote attempt from the same participant is rejected.

### Phase 5 — Word cloud

Reuses the activation/subscription pattern from Phase 4; only the
activity-specific pieces are new.

- [ ] Extend schema: `word_entries`
- [ ] Implement word cloud methods of `ResponseRepository`
- [ ] Host UI: create a word cloud prompt, activate it, view live cloud
- [ ] Participant UI: submit 1–3 words
- [ ] Run every submission through `lib/game/profanity.ts` before it's
      stored/broadcast — reject and show inline error, don't silently drop
- [ ] Wire `wordcloud_updated` events

**Definition of done:** submitted words appear in the host's cloud within
~1 second, sized correctly by frequency (via
`lib/game/aggregate-wordcloud.ts`), and a submitted slur/spam test string is
rejected with a visible participant-facing error rather than silently
vanishing or crashing the aggregation.

### Phase 6 — Q&A and moderation

- [ ] Extend schema: `questions`, `question_upvotes`
- [ ] Implement `QARepository` in the Supabase adapter
- [ ] Participant UI: submit a question, upvote others' (not own)
- [ ] Host UI: sorted question list (via `lib/game/rank-questions.ts`), mark
      answered, hide/delete
- [ ] Wire `question_added` / `question_updated` events
- [ ] Enforce "can't upvote your own question" both client- and server-side

**Definition of done:** questions sort correctly by live upvote count across
devices, a hidden question disappears from the participant view but remains
visible (marked hidden) in the host's moderation view, and answered status
updates in real time on both sides.

### Phase 7 — Polish pass

- [ ] Presenter/projector full-screen view (`app/host/[sessionId]/present/page.tsx`)
- [ ] Empty and error states for every screen, written per the copy rules in
      the design doc (say what happened, what to do next, no apologies)
- [ ] Keyboard focus visibility audit
- [ ] Mobile responsiveness audit on the participant flow specifically
- [ ] Manual test: run one full session start-to-end (poll → word cloud →
      Q&A → end session) solo, then again with at least 3 other real people

**Definition of done:** the full flow in §8 (validation criteria) can be run
with a real group without the agent-author intervening mid-session.

---

## 10. What "done" means for v1 overall

v1 is complete when a host can run one real session — poll, word cloud, and
Q&A, in sequence — with a group of real people joining from their own
phones via a join code, entirely within Supabase's free tier, with no agent
intervention required mid-session. Anything beyond that (a second game
type, scoring, branding, analytics) belongs to a later phase and should not
be pulled forward without an explicit decision to do so.
