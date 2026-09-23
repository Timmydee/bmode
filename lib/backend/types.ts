export type SessionStatus = "draft" | "live" | "ended";

export interface Session {
  id: string;
  hostId: string;
  title: string;
  joinCode: string; // 6 digits
  status: SessionStatus;
  activeActivityId: string | null;
  createdAt: Date;
}

export interface Participant {
  id: string; // room-scoped, not a real user account
  sessionId: string;
  nickname: string | null; // null = anonymous
  joinedAt: Date;
}

/* ---------- Activities ---------- */

export type ActivityKind = "poll" | "wordcloud" | "qa";
export type ActivityStatus = "queued" | "live" | "closed";

interface ActivityBase {
  id: string;
  sessionId: string;
  kind: ActivityKind;
  prompt: string;
  status: ActivityStatus;
  order: number;
}

export interface PollActivity extends ActivityBase {
  kind: "poll";
  options: PollOption[];
  resultsVisibleToParticipants: boolean;
  // Present only when this poll is a round question (see Round below).
  // Absent on every standalone poll — nothing reads these unless a round
  // set them, so standalone poll behavior is unaffected.
  roundId?: string;
  correctOptionId?: string;
  // Present only when this poll belongs to a Survey (see Survey below).
  // Absent on every standalone poll and every round question.
  surveyId?: string;
}

export interface PollOption {
  id: string;
  label: string;
}

export interface WordCloudActivity extends ActivityBase {
  kind: "wordcloud";
  maxWordsPerParticipant: number; // default 1
}

export interface QAActivity extends ActivityBase {
  kind: "qa";
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
  word: string; // normalised lowercase, trimmed
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

/* ---------- Rounds (Fastest Finger, v2) ---------- */

export type RoundStatus = "draft" | "live" | "ended";

export interface Round {
  id: string;
  sessionId: string;
  name: string;
  status: RoundStatus;
  timeLimitSeconds: number; // applies to every question in the round
  order: number;
  currentQuestionIndex: number | null; // null when draft/ended
  currentQuestionStartedAt: number | null; // epoch ms
  currentQuestionEndsAt: number | null; // epoch ms
}

// Joins a Round to one of its underlying poll activities, plus the
// round-only metadata a standalone poll never carries.
export interface RoundQuestion {
  id: string;
  roundId: string;
  activityId: string;
  order: number;
  correctOptionId: string;
}

/* ---------- Scoring (v2) ---------- */

export interface QuestionScore {
  id: string;
  activityId: string;
  participantId: string;
  optionId: string | null; // null = no answer submitted before the deadline
  correct: boolean;
  points: number;
  responseTimeMs: number | null; // null if unanswered
  scoredAt: number; // epoch ms
}

export interface LeaderboardEntry {
  participantId: string;
  nickname: string | null;
  totalPoints: number;
  questionsAnswered: number; // correct + incorrect, excludes unanswered
  correctAnswers: number;
  rank: number; // 1-based, ties share a rank
}

export interface Leaderboard {
  sessionId: string;
  entries: LeaderboardEntry[]; // sorted by rank ascending
  updatedAt: number; // epoch ms
}

/* ---------- Surveys (v2) ---------- */
// A Survey groups several ordinary poll questions (no timer, no correct
// answer, no scoring) under one name, stepped through host-paced — the
// host clicks "Next question" manually rather than auto-advancing on a
// countdown, since there's nothing to count down. Deliberately much
// simpler than Round: a survey question behaves exactly like a standalone
// poll (reuses activity_activated/activity_closed directly, no reveal
// state to preserve).

export type SurveyStatus = "draft" | "live" | "ended";

export interface Survey {
  id: string;
  sessionId: string;
  name: string;
  status: SurveyStatus;
  order: number;
  currentQuestionIndex: number | null; // null when draft/ended
}

// Joins a Survey to one of its underlying poll activities.
export interface SurveyQuestion {
  id: string;
  surveyId: string;
  activityId: string;
  order: number;
}
