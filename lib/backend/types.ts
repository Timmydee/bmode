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
