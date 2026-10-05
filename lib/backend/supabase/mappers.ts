import type {
  Activity,
  Circle,
  CircleAnswer,
  CircleDepth,
  CircleQuestion,
  CircleQuestionPhase,
  CircleQuestionSource,
  CircleRecap,
  CircleSettings,
  CircleStatus,
  ActivityKind,
  ActivityStatus,
  AudienceQuestion,
  Participant,
  PollOption,
  PollVote,
  Round,
  RoundQuestion,
  RoundStatus,
  Session,
  SessionStatus,
  Survey,
  SurveyQuestion,
  SurveyStatus,
  WordEntry,
} from "../types";

export interface SessionRow {
  id: string;
  host_id: string;
  title: string;
  join_code: string;
  status: SessionStatus;
  active_activity_id: string | null;
  created_at: string;
}

export function mapSessionRow(row: SessionRow): Session {
  return {
    id: row.id,
    hostId: row.host_id,
    title: row.title,
    joinCode: row.join_code,
    status: row.status,
    activeActivityId: row.active_activity_id,
    createdAt: new Date(row.created_at),
  };
}

export interface ParticipantRow {
  id: string;
  session_id: string;
  nickname: string | null;
  joined_at: string;
}

export function mapParticipantRow(row: ParticipantRow): Participant {
  return {
    id: row.id,
    sessionId: row.session_id,
    nickname: row.nickname,
    joinedAt: new Date(row.joined_at),
  };
}

export interface ActivityRow {
  id: string;
  session_id: string;
  kind: ActivityKind;
  prompt: string;
  status: ActivityStatus;
  order: number;
  config: Record<string, unknown>;
}

export interface PollOptionRow {
  id: string;
  activity_id: string;
  label: string;
  order: number;
}

// A poll's options must be loaded alongside its activity row since
// PollActivity.options is part of the domain type, not a separate fetch.
export function mapActivityRow(
  row: ActivityRow,
  pollOptions?: PollOptionRow[],
): Activity {
  const base = {
    id: row.id,
    sessionId: row.session_id,
    prompt: row.prompt,
    status: row.status,
    order: row.order,
  };

  if (row.kind === "poll") {
    const options: PollOption[] = (pollOptions ?? [])
      .slice()
      .sort((a, b) => a.order - b.order)
      .map((option) => ({ id: option.id, label: option.label }));
    return {
      ...base,
      kind: "poll",
      options,
      resultsVisibleToParticipants: Boolean(
        row.config.resultsVisibleToParticipants,
      ),
    };
  }

  if (row.kind === "wordcloud") {
    return {
      ...base,
      kind: "wordcloud",
      maxWordsPerParticipant:
        typeof row.config.maxWordsPerParticipant === "number"
          ? row.config.maxWordsPerParticipant
          : 1,
    };
  }

  return {
    ...base,
    kind: "qa",
    allowAnonymous: Boolean(row.config.allowAnonymous),
  };
}

export interface PollVoteRow {
  id: string;
  activity_id: string;
  participant_id: string;
  option_id: string;
  submitted_at: string;
}

export function mapPollVoteRow(row: PollVoteRow): PollVote {
  return {
    id: row.id,
    activityId: row.activity_id,
    participantId: row.participant_id,
    optionId: row.option_id,
    submittedAt: new Date(row.submitted_at),
  };
}

export interface WordEntryRow {
  id: string;
  activity_id: string;
  participant_id: string;
  word: string;
  submitted_at: string;
}

export function mapWordEntryRow(row: WordEntryRow): WordEntry {
  return {
    id: row.id,
    activityId: row.activity_id,
    participantId: row.participant_id,
    word: row.word,
    submittedAt: new Date(row.submitted_at),
  };
}

export interface QuestionRow {
  id: string;
  activity_id: string;
  participant_id: string;
  text: string;
  author_nickname: string | null;
  answered: boolean;
  hidden: boolean;
  submitted_at: string;
}

// Upvote counts are computed at query time in qa-repo.ts (see the
// migration's comment on why) and passed in here rather than stored on
// the row itself.
export interface RoundRow {
  id: string;
  session_id: string;
  name: string;
  status: RoundStatus;
  time_limit_seconds: number;
  order: number;
  current_question_index: number | null;
  current_question_started_at: string | null;
  current_question_ends_at: string | null;
}

export function mapRoundRow(row: RoundRow): Round {
  return {
    id: row.id,
    sessionId: row.session_id,
    name: row.name,
    status: row.status,
    timeLimitSeconds: row.time_limit_seconds,
    order: row.order,
    currentQuestionIndex: row.current_question_index,
    currentQuestionStartedAt: row.current_question_started_at
      ? new Date(row.current_question_started_at).getTime()
      : null,
    currentQuestionEndsAt: row.current_question_ends_at
      ? new Date(row.current_question_ends_at).getTime()
      : null,
  };
}

export interface RoundQuestionRow {
  id: string;
  round_id: string;
  activity_id: string;
  order: number;
  correct_option_id: string;
}

export function mapRoundQuestionRow(row: RoundQuestionRow): RoundQuestion {
  return {
    id: row.id,
    roundId: row.round_id,
    activityId: row.activity_id,
    order: row.order,
    correctOptionId: row.correct_option_id,
  };
}

export interface SurveyRow {
  id: string;
  session_id: string;
  name: string;
  status: SurveyStatus;
  order: number;
  current_question_index: number | null;
}

export function mapSurveyRow(row: SurveyRow): Survey {
  return {
    id: row.id,
    sessionId: row.session_id,
    name: row.name,
    status: row.status,
    order: row.order,
    currentQuestionIndex: row.current_question_index,
  };
}

export interface SurveyQuestionRow {
  id: string;
  survey_id: string;
  activity_id: string;
  order: number;
}

export function mapSurveyQuestionRow(row: SurveyQuestionRow): SurveyQuestion {
  return {
    id: row.id,
    surveyId: row.survey_id,
    activityId: row.activity_id,
    order: row.order,
  };
}

export function mapQuestionRow(
  row: QuestionRow,
  upvotes: number,
): AudienceQuestion {
  return {
    id: row.id,
    activityId: row.activity_id,
    participantId: row.participant_id,
    text: row.text,
    authorNickname: row.author_nickname,
    upvotes,
    answered: row.answered,
    hidden: row.hidden,
    submittedAt: new Date(row.submitted_at),
  };
}

export interface CircleRow {
  id: string;
  session_id: string;
  name: string;
  status: CircleStatus;
  settings: CircleSettings;
  order: number;
  current_question_id: string | null;
  depth: CircleDepth;
  pot: number;
  bond_prior: number;
  recap: CircleRecap | null;
}

export function mapCircleRow(row: CircleRow): Circle {
  return {
    id: row.id,
    sessionId: row.session_id,
    name: row.name,
    status: row.status,
    settings: {
      vibe: row.settings.vibe ?? "know",
      questionCount: row.settings.questionCount ?? 8,
      rewardStyle: row.settings.rewardStyle ?? "together",
      answerMode: row.settings.answerMode ?? "typed",
      customQuestions: row.settings.customQuestions ?? [],
    },
    order: row.order,
    currentQuestionId: row.current_question_id,
    depth: row.depth,
    pot: row.pot,
    bondPrior: row.bond_prior,
    recap: row.recap,
  };
}

export interface CircleQuestionRow {
  id: string;
  circle_id: string;
  order: number;
  text: string;
  follow_up: string | null;
  depth: CircleDepth;
  source: CircleQuestionSource;
  phase: CircleQuestionPhase;
  spotlight_participant_id: string | null;
  participant_count: number | null;
  went_deeper: boolean;
}

export function mapCircleQuestionRow(row: CircleQuestionRow): CircleQuestion {
  return {
    id: row.id,
    circleId: row.circle_id,
    order: row.order,
    text: row.text,
    followUp: row.follow_up,
    depth: row.depth,
    source: row.source,
    phase: row.phase,
    spotlightParticipantId: row.spotlight_participant_id,
    participantCount: row.participant_count,
    wentDeeper: row.went_deeper,
  };
}

// Selected with the author's nickname joined in (participants(nickname)),
// so the reveal can name each answer without a second fetch.
export interface CircleAnswerRow {
  id: string;
  circle_question_id: string;
  participant_id: string;
  text: string | null;
  skipped: boolean;
  submitted_at: string;
  participants: { nickname: string | null } | null;
}

export function mapCircleAnswerRow(row: CircleAnswerRow): CircleAnswer {
  return {
    id: row.id,
    circleQuestionId: row.circle_question_id,
    participantId: row.participant_id,
    nickname: row.participants?.nickname ?? null,
    text: row.text,
    skipped: row.skipped,
    submittedAt: new Date(row.submitted_at),
  };
}
