import { describe, expect, it } from "vitest";
import {
  bondLevel,
  chooseSpotlight,
  circleGroupKey,
  computeCircleRecap,
  isDeeperUnanimous,
  nextDepth,
  pickNextQuestion,
  scoreCircleQuestion,
  suggestQuestionSet,
  swapQuestion,
  type CircleQuestionTally,
} from "./circle";
import type { LibraryQuestion } from "./circle-questions";

const LIBRARY: LibraryQuestion[] = [
  { text: "Light A", followUp: "fa", depth: 1 },
  { text: "Light B", followUp: "fb", depth: 1 },
  { text: "Real A", followUp: "fc", depth: 2 },
  { text: "Deep A", followUp: "fd", depth: 3 },
  { text: "Catch up", followUp: "fe", depth: 1, reconnect: true },
];

const first = () => 0;

function tally(overrides: Partial<CircleQuestionTally> = {}): CircleQuestionTally {
  return {
    text: "Q",
    depth: 1,
    participantCount: 3,
    wentDeeper: false,
    answers: [
      { id: "a1", participantId: "p1", skipped: false },
      { id: "a2", participantId: "p2", skipped: false },
      { id: "a3", participantId: "p3", skipped: true },
    ],
    hearts: [],
    ...overrides,
  };
}

describe("pickNextQuestion", () => {
  it("draws an unused library question at the current depth", () => {
    const picked = pickNextQuestion({
      vibe: "know",
      depth: 1,
      questionIndex: 0,
      usedTexts: ["Light A"],
      customQuestions: [],
      random: first,
      library: LIBRARY,
    });
    expect(picked).toEqual({ text: "Light B", followUp: "fb", depth: 1, source: "library" });
  });

  it("never serves reconnect questions outside the Reconnect vibe", () => {
    const picked = pickNextQuestion({
      vibe: "chill",
      depth: 1,
      questionIndex: 0,
      usedTexts: ["Light A", "Light B"],
      customQuestions: [],
      random: first,
      library: LIBRARY,
    });
    expect(picked.text).not.toBe("Catch up");
  });

  it("mixes reconnect questions into the Reconnect vibe", () => {
    const picked = pickNextQuestion({
      vibe: "reconnect",
      depth: 1,
      questionIndex: 0,
      usedTexts: [],
      customQuestions: [],
      random: first,
      library: LIBRARY,
    });
    expect(picked.text).toBe("Catch up");
  });

  it("alternates the host's own questions with library ones", () => {
    const base = { vibe: "know" as const, depth: 1 as const, usedTexts: [], random: first, library: LIBRARY };
    expect(pickNextQuestion({ ...base, questionIndex: 0, customQuestions: ["Mine"] }).source).toBe("library");
    expect(pickNextQuestion({ ...base, questionIndex: 1, customQuestions: ["Mine"] })).toEqual({
      text: "Mine",
      followUp: null,
      depth: 1,
      source: "custom",
    });
  });

  it("allows repeats instead of running dry", () => {
    const picked = pickNextQuestion({
      vibe: "know",
      depth: 3,
      questionIndex: 4,
      usedTexts: LIBRARY.map((q) => q.text),
      customQuestions: [],
      random: first,
      library: LIBRARY,
    });
    expect(picked.text).toBe("Deep A");
  });
});

describe("pickNextQuestion with the host's plan", () => {
  const plan = [
    { text: "P1", followUp: null, depth: 1 as const, source: "library" as const },
    { text: "P2", followUp: null, depth: 1 as const, source: "custom" as const },
    { text: "P3", followUp: null, depth: 2 as const, source: "library" as const },
  ];
  const base = { vibe: "know" as const, customQuestions: [], random: first, library: LIBRARY, plan, questionIndex: 1 };

  it("plays the plan in order", () => {
    expect(pickNextQuestion({ ...base, depth: 1, usedTexts: ["P1"] }).text).toBe("P2");
  });

  it("jumps to the next deeper question after going deeper", () => {
    expect(pickNextQuestion({ ...base, depth: 2, usedTexts: ["P1"] }).text).toBe("P3");
  });

  it("falls back to the library once the plan runs out", () => {
    expect(pickNextQuestion({ ...base, depth: 1, usedTexts: ["P1", "P2", "P3"] }).source).toBe("library");
  });
});

describe("suggestQuestionSet", () => {
  it("warms up, then gets deeper, without repeats", () => {
    const set = suggestQuestionSet({ vibe: "know", count: 5, random: first, library: LIBRARY });
    expect(set.map((q) => q.depth)).toEqual([1, 1, 2, 3]);
    expect(new Set(set.map((q) => q.text)).size).toBe(set.length);
  });

  it("keeps Chill at Real or lighter", () => {
    const set = suggestQuestionSet({ vibe: "chill", count: 5, random: first, library: LIBRARY });
    expect(Math.max(...set.map((q) => q.depth))).toBeLessThanOrEqual(2);
  });
});

describe("swapQuestion", () => {
  it("offers another unused question at the same depth", () => {
    const swapped = swapQuestion({
      question: { text: "Light A", followUp: "fa", depth: 1, source: "library" },
      vibe: "know",
      usedTexts: ["Light A"],
      random: first,
      library: LIBRARY,
    });
    expect(swapped?.text).toBe("Light B");
  });
});

describe("chooseSpotlight", () => {
  it("gives a turn to someone who hasn't had one yet", () => {
    const id = chooseSpotlight({
      answers: [
        { participantId: "p1", skipped: false },
        { participantId: "p2", skipped: false },
      ],
      previousSpotlights: ["p1"],
      random: first,
    });
    expect(id).toBe("p2");
  });

  it("never spotlights a skipped answer", () => {
    expect(
      chooseSpotlight({ answers: [{ participantId: "p1", skipped: true }], previousSpotlights: [], random: first }),
    ).toBeNull();
  });
});

describe("going deeper", () => {
  it("needs everyone, and at least two people", () => {
    expect(isDeeperUnanimous(3, 3)).toBe(true);
    expect(isDeeperUnanimous(2, 3)).toBe(false);
    expect(isDeeperUnanimous(1, 1)).toBe(false);
  });

  it("caps depth at Deep", () => {
    expect(nextDepth(1, true)).toBe(2);
    expect(nextDepth(3, true)).toBe(3);
    expect(nextDepth(2, false)).toBe(2);
  });
});

describe("scoreCircleQuestion", () => {
  it("pays answers, never skips", () => {
    const score = scoreCircleQuestion(tally());
    expect(score.pot).toBe(20);
    expect(score.byParticipant.get("p1")).toBe(10);
    expect(score.byParticipant.has("p3")).toBe(false);
    expect(score.fullCircle).toBe(false);
  });

  it("pays hearts to the answer's author, ignoring self-hearts and duplicates", () => {
    const score = scoreCircleQuestion(
      tally({
        hearts: [
          { answerId: "a1", participantId: "p2" },
          { answerId: "a1", participantId: "p2" },
          { answerId: "a1", participantId: "p1" },
          { answerId: "a3", participantId: "p1" },
        ],
      }),
    );
    expect(score.hearts).toBe(1);
    expect(score.byParticipant.get("p1")).toBe(13);
  });

  it("adds the group bonuses for a full circle and going deeper", () => {
    const score = scoreCircleQuestion(
      tally({
        wentDeeper: true,
        answers: [
          { id: "a1", participantId: "p1", skipped: false },
          { id: "a2", participantId: "p2", skipped: false },
          { id: "a3", participantId: "p3", skipped: false },
        ],
      }),
    );
    expect(score.fullCircle).toBe(true);
    expect(score.pot).toBe(30 + 20 + 15);
  });
});

describe("computeCircleRecap", () => {
  const participants = [
    { id: "p1", nickname: "Zara" },
    { id: "p2", nickname: "Ada" },
    { id: "p3", nickname: "Tunde" },
  ];

  it("lists players alphabetically without ranks in Together style", () => {
    const recap = computeCircleRecap({
      questions: [tally({ hearts: [{ answerId: "a1", participantId: "p2" }] })],
      participants,
      rewardStyle: "together",
      bondBefore: 0,
      localHour: 20,
    });
    expect(recap.players.map((p) => p.nickname)).toEqual(["Ada", "Tunde", "Zara"]);
    expect(recap.players.every((p) => p.rank === null)).toBe(true);
    expect(recap.pot).toBe(23);
    expect(recap.bondAfter).toBe(23);
    expect(recap.badges.map((b) => b.id)).toEqual(["icebreaker"]);
  });

  it("ranks players, sharing ties, in Competitive style", () => {
    const recap = computeCircleRecap({
      questions: [tally({ hearts: [{ answerId: "a1", participantId: "p2" }] })],
      participants,
      rewardStyle: "competitive",
      bondBefore: 50,
      localHour: 23,
    });
    expect(recap.players.map((p) => [p.nickname, p.rank])).toEqual([
      ["Zara", 1],
      ["Ada", 2],
      ["Tunde", 3],
    ]);
    expect(recap.badges.map((b) => b.id)).toEqual(["night-owls"]);
  });

  it("picks the most-hearted question as the question of the night", () => {
    const recap = computeCircleRecap({
      questions: [
        tally({ text: "Quiet one" }),
        tally({ text: "Loved one", hearts: [{ answerId: "a2", participantId: "p1" }] }),
      ],
      participants,
      rewardStyle: "together",
      bondBefore: 10,
      localHour: 12,
    });
    expect(recap.questionOfTheNight).toBe("Loved one");
  });
});

describe("bondLevel", () => {
  it("reports the level and distance to the next one", () => {
    expect(bondLevel(0)).toEqual({ name: "Strangers", nextName: "Acquaintances", toNext: 120, progress: 0 });
    expect(bondLevel(300).name).toBe("Friends");
    expect(bondLevel(5000)).toEqual({ name: "Kindred", nextName: null, toNext: 0, progress: 1 });
  });
});

describe("circleGroupKey", () => {
  it("ignores order and case", () => {
    expect(circleGroupKey(["Zara", "ada", null])).toBe(circleGroupKey(["Ada", null, "zara"]));
  });
});
