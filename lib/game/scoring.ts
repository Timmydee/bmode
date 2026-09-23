export interface ScoreQuestionInput {
  correctOptionId: string;
  questionStartedAt: number; // epoch ms — when the countdown began
  timeLimitSeconds: number;
  // Every participant who could have answered (present when the question
  // went live) should appear here even with no vote, so "unanswered" is
  // scored as 0 rather than silently absent.
  participantIds: string[];
  votes: { participantId: string; optionId: string; submittedAt: number }[]; // server-anchored epoch ms
}

export interface ScoredAnswer {
  participantId: string;
  optionId: string | null;
  correct: boolean;
  points: number;
  responseTimeMs: number | null;
}

const BASE_POINTS = 1000;
// Floor for a *correct* answer at/after the deadline — a correct answer
// should never be worth the same as a wrong one (0), only less rewarded
// for being slow.
const MIN_POINTS = 100;

export function scoreQuestion(input: ScoreQuestionInput): ScoredAnswer[] {
  const timeLimitMs = input.timeLimitSeconds * 1000;
  const voteByParticipant = new Map(
    input.votes.map((vote) => [vote.participantId, vote]),
  );

  return input.participantIds.map((participantId) => {
    const vote = voteByParticipant.get(participantId);
    if (!vote) {
      return {
        participantId,
        optionId: null,
        correct: false,
        points: 0,
        responseTimeMs: null,
      };
    }

    const responseTimeMs = clampResponseTime(
      vote.submittedAt,
      input.questionStartedAt,
      timeLimitMs,
    );
    const correct = vote.optionId === input.correctOptionId;
    if (!correct) {
      return {
        participantId,
        optionId: vote.optionId,
        correct: false,
        points: 0,
        responseTimeMs,
      };
    }

    // Linear decay from BASE_POINTS (instant) to MIN_POINTS (at the
    // deadline).
    const fractionElapsed = responseTimeMs / timeLimitMs;
    const points = Math.round(
      BASE_POINTS - fractionElapsed * (BASE_POINTS - MIN_POINTS),
    );

    return { participantId, optionId: vote.optionId, correct: true, points, responseTimeMs };
  });
}

// Clamp both ends: a vote timestamped before questionStartedAt (clock
// skew/race at question-start) counts as instant (0ms); a vote that landed
// after the deadline (e.g. a server write finishing a beat late) counts as
// exactly at the deadline — still a legitimate answer, not a cheat.
function clampResponseTime(
  submittedAt: number,
  questionStartedAt: number,
  timeLimitMs: number,
): number {
  const raw = submittedAt - questionStartedAt;
  return Math.min(Math.max(raw, 0), timeLimitMs);
}
