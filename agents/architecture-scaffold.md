# Live Polling / Q&A Platform — Backend-Agnostic Scaffold

The goal: Supabase today, swap to MongoDB + Socket.io later by writing one new
folder and changing one line. Nothing in `app/` or `components/` ever imports
`@supabase/supabase-js`.

---

## 1. Folder structure

```
src/
  app/                                # Next.js routes — UI only, zero backend imports
    page.tsx                          # landing: Create / Join
    join/
      page.tsx                        # enter code
      [code]/page.tsx                 # participant live view
    host/
      page.tsx                        # host's session list
      [sessionId]/
        page.tsx                      # presenter control view
        present/page.tsx              # big-screen / projector view

  components/                         # presentational only — props in, events out
    poll/
      PollVoting.tsx
      PollResults.tsx
    wordcloud/
      WordCloudInput.tsx
      WordCloudDisplay.tsx
    qa/
      QuestionList.tsx
      QuestionComposer.tsx
    shared/
      JoinCode.tsx
      QRCode.tsx
      ParticipantCount.tsx

  lib/
    backend/
      index.ts                        # ⭐ THE SWAP POINT — factory, exports singletons
      types.ts                        # domain types (portable, no DB concepts)
      contracts.ts                    # the interfaces every adapter must satisfy
      events.ts                       # realtime event union

      supabase/                       # adapter #1 — only place Supabase is imported
        client.ts
        mappers.ts                    # db row  <->  domain type
        session-repo.ts
        activity-repo.ts
        response-repo.ts
        qa-repo.ts
        realtime.ts
        auth.ts
        index.ts                      # assembles the Backend object

      socketio/                       # adapter #2 — empty until you migrate
        .gitkeep

    hooks/                            # React glue — calls backend via contracts only
      useSession.ts
      useActiveActivity.ts
      useLiveResults.ts
      useParticipant.ts

    game/                             # PURE logic — no backend imports, unit-testable
      aggregate-poll.ts
      aggregate-wordcloud.ts
      rank-questions.ts
      profanity.ts
      validation.ts

    identity/
      participant-token.ts            # localStorage session token (rejoin resilience)
```

**Rule of thumb:** if a file imports from `lib/backend/supabase/*`, it must live
inside `lib/backend/supabase/`. Enforce it with an ESLint `no-restricted-imports`
rule so you can't drift.

---

## 2. Domain types — `lib/backend/types.ts`

These describe *your product*, not your database. No `created_at: string` leaking
Postgres conventions, no Mongo `_id`.

```ts
export type SessionStatus = 'draft' | 'live' | 'ended';

export interface Session {
  id: string;
  hostId: string;
  title: string;
  joinCode: string;          // 6 digits
  status: SessionStatus;
  activeActivityId: string | null;
  createdAt: Date;
}

export interface Participant {
  id: string;                // room-scoped, not a real user account
  sessionId: string;
  nickname: string | null;   // null = anonymous
  joinedAt: Date;
}

/* ---------- Activities ---------- */

export type ActivityKind = 'poll' | 'wordcloud' | 'qa';
export type ActivityStatus = 'queued' | 'live' | 'closed';

interface ActivityBase {
  id: string;
  sessionId: string;
  kind: ActivityKind;
  prompt: string;
  status: ActivityStatus;
  order: number;
}

export interface PollActivity extends ActivityBase {
  kind: 'poll';
  options: PollOption[];
  resultsVisibleToParticipants: boolean;
}

export interface PollOption {
  id: string;
  label: string;
}

export interface WordCloudActivity extends ActivityBase {
  kind: 'wordcloud';
  maxWordsPerParticipant: number;   // default 1
}

export interface QAActivity extends ActivityBase {
  kind: 'qa';
  allowAnonymous: boolean;
}

export type Activity = PollActivity | WordCloudActivity | QAActivity;

/* ---------- Responses ---------- */

export interface PollVote {
  id: string;
  activityId: string;
  participantId: string;
  optionId: string;
  submittedAt: Date;
}

export interface WordEntry {
  id: string;
  activityId: string;
  participantId: string;
  word: string;              // normalised lowercase, trimmed
  submittedAt: Date;
}

export interface AudienceQuestion {
  id: string;
  activityId: string;
  participantId: string;
  text: string;
  authorNickname: string | null;
  upvotes: number;
  answered: boolean;
  hidden: boolean;
  submittedAt: Date;
}

/* ---------- Aggregates (what the UI actually renders) ---------- */

export interface PollResults {
  activityId: string;
  totalVotes: number;
  byOption: { optionId: string; label: string; count: number }[];
}

export interface WordCloudResults {
  activityId: string;
  totalEntries: number;
  words: { word: string; count: number }[];
}
```

---

## 3. Contracts — `lib/backend/contracts.ts`

Every adapter implements these. This is the whole migration surface.

```ts
import type {
  Session, Participant, Activity, ActivityKind,
  PollResults, WordCloudResults, AudienceQuestion,
} from './types';
import type { SessionEvent } from './events';

export type Unsubscribe = () => void;

export interface SessionRepository {
  create(input: { hostId: string; title: string }): Promise<Session>;
  getById(id: string): Promise<Session | null>;
  getByJoinCode(code: string): Promise<Session | null>;
  listByHost(hostId: string): Promise<Session[]>;
  setStatus(id: string, status: Session['status']): Promise<void>;
  setActiveActivity(id: string, activityId: string | null): Promise<void>;
}

export interface ParticipantRepository {
  join(input: {
    sessionId: string;
    nickname: string | null;
    token: string;              // from localStorage — enables rejoin
  }): Promise<Participant>;
  getByToken(sessionId: string, token: string): Promise<Participant | null>;
  countBySession(sessionId: string): Promise<number>;
  listBySession(sessionId: string): Promise<Participant[]>;
}

export interface ActivityRepository {
  create(input: {
    sessionId: string;
    kind: ActivityKind;
    prompt: string;
    config: Record<string, unknown>;
  }): Promise<Activity>;
  listBySession(sessionId: string): Promise<Activity[]>;
  getById(id: string): Promise<Activity | null>;
  setStatus(id: string, status: Activity['status']): Promise<void>;
  reorder(sessionId: string, orderedIds: string[]): Promise<void>;
}

export interface ResponseRepository {
  submitVote(input: {
    activityId: string;
    participantId: string;
    optionId: string;
  }): Promise<void>;
  submitWord(input: {
    activityId: string;
    participantId: string;
    word: string;
  }): Promise<void>;
  hasResponded(activityId: string, participantId: string): Promise<boolean>;
  getPollResults(activityId: string): Promise<PollResults>;
  getWordCloudResults(activityId: string): Promise<WordCloudResults>;
}

export interface QARepository {
  submit(input: {
    activityId: string;
    participantId: string;
    text: string;
  }): Promise<AudienceQuestion>;
  list(activityId: string, opts?: { includeHidden?: boolean }): Promise<AudienceQuestion[]>;
  upvote(questionId: string, participantId: string): Promise<void>;
  removeUpvote(questionId: string, participantId: string): Promise<void>;
  setAnswered(questionId: string, answered: boolean): Promise<void>;
  setHidden(questionId: string, hidden: boolean): Promise<void>;
}

export interface RealtimeClient {
  /** Subscribe to everything happening in one session. */
  subscribe(sessionId: string, handler: (event: SessionEvent) => void): Unsubscribe;
  /** Host-side broadcast (activity activated, session ended, etc.). */
  publish(sessionId: string, event: SessionEvent): Promise<void>;
  /** Presence — live participant count without polling the DB. */
  trackPresence(sessionId: string, participantId: string): Unsubscribe;
}

export interface AuthClient {
  signInWithEmail(email: string): Promise<void>;   // magic link
  signOut(): Promise<void>;
  getCurrentUserId(): Promise<string | null>;
  onAuthChange(cb: (userId: string | null) => void): Unsubscribe;
}

/** The single object the rest of the app talks to. */
export interface Backend {
  sessions: SessionRepository;
  participants: ParticipantRepository;
  activities: ActivityRepository;
  responses: ResponseRepository;
  qa: QARepository;
  realtime: RealtimeClient;
  auth: AuthClient;
}
```

---

## 4. Realtime events — `lib/backend/events.ts`

Keep these transport-agnostic. Supabase Realtime broadcast, Socket.io emit, or
raw WebSocket can all carry this exact union.

```ts
import type { Activity, PollResults, WordCloudResults, AudienceQuestion } from './types';

export type SessionEvent =
  | { type: 'participant_joined'; participantCount: number }
  | { type: 'participant_left'; participantCount: number }
  | { type: 'activity_activated'; activity: Activity; serverTime: number }
  | { type: 'activity_closed'; activityId: string }
  | { type: 'poll_results_updated'; results: PollResults }
  | { type: 'wordcloud_updated'; results: WordCloudResults }
  | { type: 'question_added'; question: AudienceQuestion }
  | { type: 'question_updated'; question: AudienceQuestion }
  | { type: 'session_ended' };
```

`serverTime` is there so you're never trusting a participant's device clock —
carry that habit over even though v1 doesn't score on speed. It costs nothing
now and you'll need it if you circle back to Fastest Finger.

---

## 5. The swap point — `lib/backend/index.ts`

```ts
import type { Backend } from './contracts';
import { createSupabaseBackend } from './supabase';
// import { createSocketIOBackend } from './socketio';   // future

function build(): Backend {
  switch (process.env.NEXT_PUBLIC_BACKEND ?? 'supabase') {
    case 'supabase':
      return createSupabaseBackend();
    // case 'socketio':
    //   return createSocketIOBackend();
    default:
      throw new Error('Unknown backend');
  }
}

export const backend: Backend = build();
export type { Backend } from './contracts';
export * from './types';
export * from './events';
```

Migration day = write `lib/backend/socketio/`, flip one env var. Components,
hooks, and pure game logic stay untouched.

---

## 6. Adapter sketch — `lib/backend/supabase/realtime.ts`

Showing one adapter file so the shape is concrete. Note how Supabase-specific
concepts (`channel`, `postgres_changes`, payload shapes) stop at this boundary.

```ts
import { supabase } from './client';
import type { RealtimeClient, Unsubscribe } from '../contracts';
import type { SessionEvent } from '../events';

export function createSupabaseRealtime(): RealtimeClient {
  return {
    subscribe(sessionId, handler): Unsubscribe {
      const channel = supabase
        .channel(`session:${sessionId}`)
        .on('broadcast', { event: 'session_event' }, ({ payload }) => {
          handler(payload as SessionEvent);
        })
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    },

    async publish(sessionId, event) {
      const channel = supabase.channel(`session:${sessionId}`);
      await channel.send({
        type: 'broadcast',
        event: 'session_event',
        payload: event,
      });
    },

    trackPresence(sessionId, participantId): Unsubscribe {
      const channel = supabase
        .channel(`presence:${sessionId}`, {
          config: { presence: { key: participantId } },
        })
        .subscribe(async (status) => {
          if (status === 'SUBSCRIBED') {
            await channel.track({ participantId });
          }
        });

      return () => {
        supabase.removeChannel(channel);
      };
    },
  };
}
```

---

## 7. Hook layer — `lib/hooks/useLiveResults.ts`

Components consume hooks; hooks consume `backend`. Neither knows what's underneath.

```ts
import { useEffect, useState } from 'react';
import { backend } from '@/lib/backend';
import type { PollResults } from '@/lib/backend';

export function useLiveResults(sessionId: string, activityId: string | null) {
  const [results, setResults] = useState<PollResults | null>(null);

  useEffect(() => {
    if (!activityId) return;

    let cancelled = false;
    backend.responses.getPollResults(activityId).then((r) => {
      if (!cancelled) setResults(r);
    });

    const unsubscribe = backend.realtime.subscribe(sessionId, (event) => {
      if (event.type === 'poll_results_updated' && event.results.activityId === activityId) {
        setResults(event.results);
      }
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [sessionId, activityId]);

  return results;
}
```

---

## 8. Things to deliberately NOT do (they'd lock you to Supabase)

| Tempting shortcut | Why it hurts later | Do this instead |
|---|---|---|
| Business logic in Postgres functions / triggers | Doesn't port to Mongo at all | Keep it in `lib/game/` as pure TS |
| RLS policies encoding who-can-vote rules | RLS has no Mongo equivalent | Enforce in repo layer; keep RLS as a *second* safety net only |
| `supabase.from(...)` inside a component | The exact coupling you're avoiding | Always go through a repository |
| Storing Supabase user objects in app state | Shape is vendor-specific | Store your own `hostId: string` |
| Relying on `postgres_changes` for fan-out | Ties event shape to table schema | Use explicit `broadcast` with your `SessionEvent` union |

That last row matters most. If you drive the UI off raw table-change payloads,
your event shape *is* your Postgres schema, and migration means redesigning
every subscription. Explicit broadcast events keep the contract yours.

---

## 9. Suggested build order

1. `types.ts` + `contracts.ts` + `events.ts` — no implementation, just shapes
2. `lib/game/` pure functions + unit tests (aggregation, validation) — runs without any backend
3. Supabase adapter: sessions + participants only
4. Landing → create session → join by code → lobby with live participant count
5. Poll activity end-to-end (this proves the whole realtime loop)
6. Word cloud (reuses everything; only aggregation differs)
7. Q&A + upvotes + host moderation
8. Polish the presenter/projector view

Steps 1–2 are backend-free, so you can start immediately and decide Supabase
details later.
