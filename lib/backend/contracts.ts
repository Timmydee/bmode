import type {
  Session,
  Participant,
  Activity,
  ActivityKind,
  PollResults,
  WordCloudResults,
  AudienceQuestion,
} from "./types";
import type { SessionEvent } from "./events";

export type Unsubscribe = () => void;

export interface SessionRepository {
  create(input: { hostId: string; title: string }): Promise<Session>;
  getById(id: string): Promise<Session | null>;
  getByJoinCode(code: string): Promise<Session | null>;
  listByHost(hostId: string): Promise<Session[]>;
  setStatus(id: string, status: Session["status"]): Promise<void>;
  setActiveActivity(id: string, activityId: string | null): Promise<void>;
}

export interface ParticipantRepository {
  join(input: {
    sessionId: string;
    nickname: string | null;
    token: string; // from localStorage — enables rejoin
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
  setStatus(id: string, status: Activity["status"]): Promise<void>;
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
  list(
    activityId: string,
    opts?: { includeHidden?: boolean },
  ): Promise<AudienceQuestion[]>;
  upvote(questionId: string, participantId: string): Promise<void>;
  removeUpvote(questionId: string, participantId: string): Promise<void>;
  setAnswered(questionId: string, answered: boolean): Promise<void>;
  setHidden(questionId: string, hidden: boolean): Promise<void>;
}

export interface RealtimeClient {
  /** Subscribe to everything happening in one session. */
  subscribe(
    sessionId: string,
    handler: (event: SessionEvent) => void,
  ): Unsubscribe;
  /** Host-side broadcast (activity activated, session ended, etc.). */
  publish(sessionId: string, event: SessionEvent): Promise<void>;
  /** Presence — live participant count without polling the DB. */
  trackPresence(sessionId: string, participantId: string): Unsubscribe;
}

export interface AuthClient {
  signInWithEmail(email: string): Promise<void>; // magic link
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
