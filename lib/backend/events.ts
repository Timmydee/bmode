import type {
  Activity,
  PollActivity,
  PollResults,
  WordCloudResults,
  AudienceQuestion,
  Round,
  Leaderboard,
} from "./types";

// PRD §5 non-negotiable rule: every event carries `serverTime` so the UI
// never trusts a participant's device clock (see architecture-scaffold.md
// §4). This deviates from the scaffold's literal code sample, which only
// put `serverTime` on `activity_activated` — resolved in favor of the
// explicit "without exception" rule, per user decision.
export type SessionEvent =
  | {
      type: "participant_joined";
      participantCount: number;
      serverTime: number;
    }
  | { type: "participant_left"; participantCount: number; serverTime: number }
  | { type: "activity_activated"; activity: Activity; serverTime: number }
  | { type: "activity_closed"; activityId: string; serverTime: number }
  | { type: "poll_results_updated"; results: PollResults; serverTime: number }
  | {
      type: "wordcloud_updated";
      results: WordCloudResults;
      serverTime: number;
    }
  | {
      type: "question_added";
      question: AudienceQuestion;
      serverTime: number;
    }
  | {
      type: "question_updated";
      question: AudienceQuestion;
      serverTime: number;
    }
  | { type: "session_ended"; serverTime: number }
  // --- Rounds / scoring (v2). Round questions don't reuse
  // activity_activated/activity_closed: a round question stays "active"
  // through its reveal (so participants see the correct-answer highlight
  // instead of falling back to the lobby) and only closes via
  // round_question_advanced/round_ended. Every event embeds the full
  // PollActivity where relevant, matching activity_activated's "no extra
  // fetch needed" shape. No per-second tick event — clients derive the
  // live countdown from endsAt + serverTime clock-skew correction. ---
  | {
      type: "round_started";
      round: Round;
      firstQuestion: PollActivity;
      startedAt: number;
      endsAt: number;
      serverTime: number;
    }
  | {
      type: "round_question_advanced";
      roundId: string;
      question: PollActivity;
      questionIndex: number;
      startedAt: number;
      endsAt: number;
      serverTime: number;
    }
  | {
      type: "round_question_revealed";
      activityId: string;
      correctOptionId: string;
      results: PollResults;
      serverTime: number;
    }
  | {
      type: "round_ended";
      roundId: string;
      serverTime: number;
    }
  | {
      type: "leaderboard_updated";
      leaderboard: Leaderboard;
      serverTime: number;
    };
