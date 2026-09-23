import type {
  Session,
  Participant,
  Activity,
  ActivityKind,
  PollResults,
  WordCloudResults,
  AudienceQuestion,
  Round,
  RoundQuestion,
  QuestionScore,
  Leaderboard,
  Survey,
  SurveyQuestion,
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

export interface RoundRepository {
  // Builds the round row AND all of its underlying poll activities +
  // poll_options + correct-answer links up front (the whole round is
  // authored before activation, not incrementally added while live).
  create(input: {
    sessionId: string;
    name: string;
    timeLimitSeconds: number;
    questions: {
      prompt: string;
      options: string[]; // 2-6 labels, same constraint as standalone polls
      correctOptionIndex: number;
    }[];
  }): Promise<{ round: Round; questions: RoundQuestion[] }>;

  getById(roundId: string): Promise<Round | null>;
  listBySession(sessionId: string): Promise<Round[]>;
  listQuestions(roundId: string): Promise<RoundQuestion[]>;

  // Mutators never broadcast — the caller publishes the SessionEvent,
  // matching activity-repo.ts's convention.
  activate(roundId: string): Promise<void>;
  startQuestion(input: {
    roundId: string;
    questionIndex: number;
    startedAt: number;
    endsAt: number;
  }): Promise<void>;
  endRound(roundId: string): Promise<void>;
}

export interface ScoreRepository {
  // Idempotent: safe to call more than once for the same activityId
  // without double-scoring (upserts on the activity/participant pair).
  scoreQuestion(input: {
    activityId: string;
    correctOptionId: string;
    questionStartedAt: number;
    timeLimitSeconds: number;
  }): Promise<QuestionScore[]>;

  getLeaderboard(sessionId: string): Promise<Leaderboard>;
}

export interface SurveyRepository {
  // Builds the survey row and all of its underlying poll activities +
  // poll_options up front, same authored-before-activation shape as
  // RoundRepository.create — but no correct answer to resolve, since a
  // survey question is a plain opinion poll.
  create(input: {
    sessionId: string;
    name: string;
    questions: { prompt: string; options: string[] }[];
  }): Promise<{ survey: Survey; questions: SurveyQuestion[] }>;

  getById(surveyId: string): Promise<Survey | null>;
  listBySession(sessionId: string): Promise<Survey[]>;
  listQuestions(surveyId: string): Promise<SurveyQuestion[]>;

  // Mutators never broadcast — the caller publishes activity_activated /
  // activity_closed directly (a survey question needs no dedicated event
  // type, unlike a round question — see events.ts).
  activate(surveyId: string): Promise<void>;
  setCurrentQuestionIndex(surveyId: string, questionIndex: number): Promise<void>;
  endSurvey(surveyId: string): Promise<void>;
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
  // Signs the host in immediately via anonymous auth (real auth.uid(),
  // zero email sent — Supabase's free-tier magic-link email hit its
  // rate limit during testing). `email` is stored as a plain display
  // label only, never verified and never used to authenticate — anyone
  // can type any email. Acceptable for this app: no sensitive data, and
  // the alternative (magic-link) is blocked by the email cap.
  signInAnonymously(email: string): Promise<void>;
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
  rounds: RoundRepository;
  scores: ScoreRepository;
  surveys: SurveyRepository;
  realtime: RealtimeClient;
  auth: AuthClient;
}
