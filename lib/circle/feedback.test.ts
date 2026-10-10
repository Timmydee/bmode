import { describe, expect, it } from "vitest";
import type { Circle, CircleAnswer, CircleQuestion } from "../backend/types";
import type { CircleState } from "../hooks/useCircle";
import { sparkFeedback } from "./feedback";

const circle = { id: "c1", settings: { answerMode: "typed" } } as Circle;
const question = { id: "q1", phase: "answering", depth: 1, participantCount: null } as CircleQuestion;
const answer = (participantId: string, nickname: string): CircleAnswer =>
  ({ id: `a-${participantId}`, participantId, nickname, skipped: false, text: "hi" }) as CircleAnswer;

function state(overrides: Partial<CircleState> = {}): CircleState {
  return {
    circle,
    question,
    questionNumber: 1,
    answers: [],
    hearts: [],
    deeperVotes: [],
    awardVotes: [],
    totals: { pot: 0, byParticipant: new Map(), heartsByParticipant: new Map() },
    ...overrides,
  };
}

describe("sparkFeedback", () => {
  it("says nothing on first load or when the question changes", () => {
    expect(sparkFeedback(null, state({ answers: [answer("me", "Me")] }), "me")).toEqual([]);
    expect(
      sparkFeedback(state(), state({ question: { ...question, id: "q2" }, answers: [answer("me", "Me")] }), "me"),
    ).toEqual([]);
  });

  it("rewards answering and hearts received", () => {
    const answered = state({ answers: [answer("me", "Me"), answer("ben", "Ben")] });
    expect(sparkFeedback(state(), answered, "me")).toEqual([{ sparks: 10, text: "for answering" }]);
    const hearted = { ...answered, hearts: [{ answerId: "a-me", participantId: "ben" }] };
    expect(sparkFeedback(answered, hearted, "me")).toEqual([{ sparks: 3, text: "Ben loved your answer" }]);
  });

  it("celebrates a Full Circle reveal and a unanimous go-deeper", () => {
    const answers = [answer("me", "Me"), answer("ben", "Ben")];
    const revealedQ = { ...question, phase: "revealed" as const, participantCount: 2 };
    const before = state({ answers });
    const revealed = state({ answers, question: revealedQ });
    expect(sparkFeedback(before, revealed, "me")).toEqual([{ sparks: 20, text: "Full Circle: everyone answered" }]);
    expect(sparkFeedback(revealed, { ...revealed, deeperVotes: ["me", "ben"] }, "me")).toEqual([
      { sparks: 15, text: "Everyone’s in. Going deeper next" },
    ]);
  });
});
