import { describe, expect, it } from "vitest";
import { rankQuestions } from "./rank-questions";
import type { AudienceQuestion } from "../backend/types";

function question(overrides: Partial<AudienceQuestion>): AudienceQuestion {
  return {
    id: crypto.randomUUID(),
    activityId: "act-1",
    participantId: crypto.randomUUID(),
    text: "What's next?",
    authorNickname: null,
    upvotes: 0,
    answered: false,
    hidden: false,
    submittedAt: new Date(),
    ...overrides,
  };
}

describe("rankQuestions", () => {
  it("sorts by upvotes descending", () => {
    const low = question({ upvotes: 1, text: "low" });
    const high = question({ upvotes: 5, text: "high" });
    const mid = question({ upvotes: 3, text: "mid" });

    const ranked = rankQuestions([low, high, mid]);

    expect(ranked.map((q) => q.text)).toEqual(["high", "mid", "low"]);
  });

  it("breaks upvote ties by earliest submission first", () => {
    const later = question({
      upvotes: 2,
      text: "later",
      submittedAt: new Date("2026-01-01T00:00:10Z"),
    });
    const earlier = question({
      upvotes: 2,
      text: "earlier",
      submittedAt: new Date("2026-01-01T00:00:00Z"),
    });

    const ranked = rankQuestions([later, earlier]);

    expect(ranked.map((q) => q.text)).toEqual(["earlier", "later"]);
  });

  it("filters out hidden questions by default", () => {
    const visible = question({ hidden: false, text: "visible" });
    const hidden = question({ hidden: true, text: "hidden" });

    const ranked = rankQuestions([visible, hidden]);

    expect(ranked.map((q) => q.text)).toEqual(["visible"]);
  });

  it("includes hidden questions when includeHidden is true", () => {
    const visible = question({ hidden: false, text: "visible" });
    const hidden = question({ hidden: true, text: "hidden" });

    const ranked = rankQuestions([visible, hidden], { includeHidden: true });

    expect(ranked).toHaveLength(2);
  });

  it("does not mutate the input array", () => {
    const input = [question({ upvotes: 1 }), question({ upvotes: 5 })];
    const originalOrder = [...input];

    rankQuestions(input);

    expect(input).toEqual(originalOrder);
  });
});
