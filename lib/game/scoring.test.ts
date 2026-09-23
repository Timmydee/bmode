import { describe, expect, it } from "vitest";
import { scoreQuestion } from "./scoring";

const CORRECT = "opt-correct";
const WRONG = "opt-wrong";
const QUESTION_STARTED_AT = 1_000_000;
const TIME_LIMIT_SECONDS = 20;
const TIME_LIMIT_MS = TIME_LIMIT_SECONDS * 1000;

describe("scoreQuestion", () => {
  it("awards full base points for an instant correct answer", () => {
    const [result] = scoreQuestion({
      correctOptionId: CORRECT,
      questionStartedAt: QUESTION_STARTED_AT,
      timeLimitSeconds: TIME_LIMIT_SECONDS,
      participantIds: ["p1"],
      votes: [{ participantId: "p1", optionId: CORRECT, submittedAt: QUESTION_STARTED_AT }],
    });

    expect(result).toEqual({
      participantId: "p1",
      optionId: CORRECT,
      correct: true,
      points: 1000,
      responseTimeMs: 0,
    });
  });

  it("floors a correct answer at the exact deadline to 100, not 0", () => {
    const [result] = scoreQuestion({
      correctOptionId: CORRECT,
      questionStartedAt: QUESTION_STARTED_AT,
      timeLimitSeconds: TIME_LIMIT_SECONDS,
      participantIds: ["p1"],
      votes: [
        {
          participantId: "p1",
          optionId: CORRECT,
          submittedAt: QUESTION_STARTED_AT + TIME_LIMIT_MS,
        },
      ],
    });

    expect(result.correct).toBe(true);
    expect(result.points).toBe(100);
  });

  it("scores the midpoint correct answer exactly halfway between base and floor", () => {
    const [result] = scoreQuestion({
      correctOptionId: CORRECT,
      questionStartedAt: QUESTION_STARTED_AT,
      timeLimitSeconds: TIME_LIMIT_SECONDS,
      participantIds: ["p1"],
      votes: [
        {
          participantId: "p1",
          optionId: CORRECT,
          submittedAt: QUESTION_STARTED_AT + TIME_LIMIT_MS / 2,
        },
      ],
    });

    expect(result.points).toBe(550);
  });

  it("scores a wrong answer as 0 points regardless of speed", () => {
    const [result] = scoreQuestion({
      correctOptionId: CORRECT,
      questionStartedAt: QUESTION_STARTED_AT,
      timeLimitSeconds: TIME_LIMIT_SECONDS,
      participantIds: ["p1"],
      votes: [{ participantId: "p1", optionId: WRONG, submittedAt: QUESTION_STARTED_AT }],
    });

    expect(result).toEqual({
      participantId: "p1",
      optionId: WRONG,
      correct: false,
      points: 0,
      responseTimeMs: 0,
    });
  });

  it("scores an unanswered participant as 0 points with a null option and response time", () => {
    const [result] = scoreQuestion({
      correctOptionId: CORRECT,
      questionStartedAt: QUESTION_STARTED_AT,
      timeLimitSeconds: TIME_LIMIT_SECONDS,
      participantIds: ["p1"],
      votes: [],
    });

    expect(result).toEqual({
      participantId: "p1",
      optionId: null,
      correct: false,
      points: 0,
      responseTimeMs: null,
    });
  });

  it("clamps a vote timestamped before the question started to 0ms (clock-skew/race)", () => {
    const [result] = scoreQuestion({
      correctOptionId: CORRECT,
      questionStartedAt: QUESTION_STARTED_AT,
      timeLimitSeconds: TIME_LIMIT_SECONDS,
      participantIds: ["p1"],
      votes: [
        {
          participantId: "p1",
          optionId: CORRECT,
          submittedAt: QUESTION_STARTED_AT - 500,
        },
      ],
    });

    expect(result.responseTimeMs).toBe(0);
    expect(result.points).toBe(1000);
  });

  it("clamps a vote timestamped after the deadline to the deadline, still earning the floor if correct", () => {
    const [result] = scoreQuestion({
      correctOptionId: CORRECT,
      questionStartedAt: QUESTION_STARTED_AT,
      timeLimitSeconds: TIME_LIMIT_SECONDS,
      participantIds: ["p1"],
      votes: [
        {
          participantId: "p1",
          optionId: CORRECT,
          submittedAt: QUESTION_STARTED_AT + TIME_LIMIT_MS + 5000,
        },
      ],
    });

    expect(result.responseTimeMs).toBe(TIME_LIMIT_MS);
    expect(result.points).toBe(100);
  });

  it("scores every participant present, even mixed correct/wrong/unanswered", () => {
    const results = scoreQuestion({
      correctOptionId: CORRECT,
      questionStartedAt: QUESTION_STARTED_AT,
      timeLimitSeconds: TIME_LIMIT_SECONDS,
      participantIds: ["p1", "p2", "p3"],
      votes: [
        { participantId: "p1", optionId: CORRECT, submittedAt: QUESTION_STARTED_AT },
        { participantId: "p2", optionId: WRONG, submittedAt: QUESTION_STARTED_AT },
      ],
    });

    expect(results.map((r) => r.participantId)).toEqual(["p1", "p2", "p3"]);
    expect(results[0].points).toBe(1000);
    expect(results[1].points).toBe(0);
    expect(results[2]).toEqual({
      participantId: "p3",
      optionId: null,
      correct: false,
      points: 0,
      responseTimeMs: null,
    });
  });
});
