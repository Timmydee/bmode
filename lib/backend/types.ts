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

/* ---------- Circle (Bmode) ---------- */
// A Circle is a conversation game for a small group in the same room:
// everyone gets the same question, answers privately on their own phone,
// then all answers reveal together. Like Survey it's host-paced, but its
// questions aren't poll activities — they're picked one at a time as the
// game runs (the next question's depth depends on the group's vote), so
// they live in their own table instead of `activities`.

export type CircleStatus = "draft" | "live" | "recap" | "ended";
export type CircleVibe = "chill" | "know" | "deeper" | "reconnect";
export type CircleRewardStyle = "together" | "competitive";
export type CircleAnswerMode = "typed" | "out_loud";
export type CircleDepth = 1 | 2 | 3; // Light, Real, Deep
export type CircleQuestionPhase = "answering" | "revealed" | "done";
export type CircleQuestionSource = "library" | "custom";
export type CircleAward = "best" | "surprising";

// A question the host picked (or wrote) before the game started.
export interface CirclePlannedQuestion {
  text: string;
  followUp: string | null;
  depth: CircleDepth;
  source: CircleQuestionSource;
}

export interface CircleSettings {
  vibe: CircleVibe;
  questionCount: number;
  rewardStyle: CircleRewardStyle;
  answerMode: CircleAnswerMode;
  // The host's chosen questions, in play order. Empty on circles created
  // before the question picker existed; those draw from the library.
  questions: CirclePlannedQuestion[];
  customQuestions: string[]; // legacy: written by the host, mixed into the game
}

export interface Circle {
  id: string;
  sessionId: string;
  name: string;
  status: CircleStatus;
  settings: CircleSettings;
  order: number;
  currentQuestionId: string | null;
  depth: CircleDepth; // depth the next question is drawn at
  pot: number; // Sparks earned so far, updated by the host on each advance
  bondPrior: number; // the group's Bond Sparks before this game started
  recap: CircleRecap | null; // set when the game ends
}

export interface CircleQuestion {
  id: string;
  circleId: string;
  order: number;
  text: string;
  followUp: string | null;
  depth: CircleDepth;
  source: CircleQuestionSource;
  phase: CircleQuestionPhase;
  spotlightParticipantId: string | null;
  participantCount: number | null; // people in the room at reveal
  wentDeeper: boolean; // set on advance when the group voted unanimously
}

export interface CircleAnswer {
  id: string;
  circleQuestionId: string;
  participantId: string;
  nickname: string | null;
  text: string | null; // null for skipped or out-loud answers
  skipped: boolean;
  submittedAt: Date;
}

export interface CircleHeart {
  answerId: string;
  participantId: string;
}

export interface CircleAwardVote {
  circleId: string;
  participantId: string;
  award: CircleAward;
  nomineeParticipantId: string;
}

export interface CircleBadge {
  id: string;
  icon: string;
  name: string;
  detail: string;
}

export interface CircleRecap {
  pot: number;
  bondBefore: number;
  bondAfter: number;
  rewardStyle: CircleRewardStyle;
  players: { participantId: string; nickname: string | null; sparks: number; rank: number | null }[];
  badges: CircleBadge[];
  questionOfTheNight: string | null;
  questionsPlayed: number;
}
