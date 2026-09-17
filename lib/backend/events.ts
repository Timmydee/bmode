import type {
  Activity,
  PollResults,
  WordCloudResults,
  AudienceQuestion,
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
  | { type: "session_ended"; serverTime: number };
