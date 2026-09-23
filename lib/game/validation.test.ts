import { describe, expect, it } from "vitest";
import {
  normalizeWord,
  validateNickname,
  validatePollOptionSelection,
  validateQuestion,
  validateRoundDraft,
  validateSurveyDraft,
  validateWord,
} from "./validation";

describe("validateNickname", () => {
  it("rejects empty nicknames", () => {
    expect(validateNickname("   ").valid).toBe(false);
  });

  it("rejects nicknames over the length limit", () => {
    expect(validateNickname("a".repeat(25)).valid).toBe(false);
  });

  it("accepts a reasonable nickname", () => {
    expect(validateNickname("Alex").valid).toBe(true);
  });
});

describe("validateWord", () => {
  it("rejects empty input", () => {
    expect(validateWord("  ").valid).toBe(false);
  });

  it("rejects multi-word input", () => {
    expect(validateWord("two words").valid).toBe(false);
  });

  it("rejects words over the length limit", () => {
    expect(validateWord("a".repeat(25)).valid).toBe(false);
  });

  it("rejects profanity with a visible error, not a silent drop", () => {
    const result = validateWord("shit");
    expect(result.valid).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it("accepts a clean single word", () => {
    expect(validateWord("flexible").valid).toBe(true);
  });
});

describe("normalizeWord", () => {
  it("trims and lowercases", () => {
    expect(normalizeWord("  Flexible  ")).toBe("flexible");
  });
});

describe("validateQuestion", () => {
  it("rejects empty questions", () => {
    expect(validateQuestion("   ").valid).toBe(false);
  });

  it("rejects questions over the length limit", () => {
    expect(validateQuestion("a".repeat(281)).valid).toBe(false);
  });

  it("rejects profanity", () => {
    expect(validateQuestion("this is bullshit").valid).toBe(false);
  });

  it("accepts a reasonable question", () => {
    expect(validateQuestion("What's the timeline for this?").valid).toBe(
      true,
    );
  });
});

describe("validatePollOptionSelection", () => {
  const validOptionIds = ["opt-1", "opt-2"];

  it("rejects an empty selection", () => {
    expect(validatePollOptionSelection("", validOptionIds).valid).toBe(false);
  });

  it("rejects an option id that doesn't exist on the activity", () => {
    expect(validatePollOptionSelection("opt-99", validOptionIds).valid).toBe(
      false,
    );
  });

  it("accepts a valid option id", () => {
    expect(validatePollOptionSelection("opt-1", validOptionIds).valid).toBe(
      true,
    );
  });
});

describe("validateRoundDraft", () => {
  const validQuestion = {
    prompt: "What's the capital of France?",
    options: ["Paris", "London"],
    correctOptionIndex: 0,
  };

  it("rejects a round with no name", () => {
    const result = validateRoundDraft({
      name: "  ",
      timeLimitSeconds: 20,
      questions: [validQuestion],
    });
    expect(result.valid).toBe(false);
  });

  it("rejects a non-positive time limit", () => {
    const result = validateRoundDraft({
      name: "Round 1",
      timeLimitSeconds: 0,
      questions: [validQuestion],
    });
    expect(result.valid).toBe(false);
  });

  it("rejects a round with no questions", () => {
    const result = validateRoundDraft({
      name: "Round 1",
      timeLimitSeconds: 20,
      questions: [],
    });
    expect(result.valid).toBe(false);
  });

  it("rejects a question with fewer than 2 non-empty options", () => {
    const result = validateRoundDraft({
      name: "Round 1",
      timeLimitSeconds: 20,
      questions: [{ prompt: "Q1", options: ["Only one"], correctOptionIndex: 0 }],
    });
    expect(result.valid).toBe(false);
  });

  it("rejects a question with no correct answer marked", () => {
    const result = validateRoundDraft({
      name: "Round 1",
      timeLimitSeconds: 20,
      questions: [{ prompt: "Q1", options: ["A", "B"], correctOptionIndex: -1 }],
    });
    expect(result.valid).toBe(false);
  });

  it("accepts a well-formed round", () => {
    const result = validateRoundDraft({
      name: "Round 1",
      timeLimitSeconds: 20,
      questions: [validQuestion],
    });
    expect(result.valid).toBe(true);
  });
});

describe("validateSurveyDraft", () => {
  const validQuestion = { prompt: "How was the food?", options: ["Great", "OK", "Bad"] };

  it("rejects a survey with no name", () => {
    expect(
      validateSurveyDraft({ name: "  ", questions: [validQuestion] }).valid,
    ).toBe(false);
  });

  it("rejects a survey with no questions", () => {
    expect(validateSurveyDraft({ name: "Feedback", questions: [] }).valid).toBe(
      false,
    );
  });

  it("rejects a question with fewer than 2 non-empty options", () => {
    const result = validateSurveyDraft({
      name: "Feedback",
      questions: [{ prompt: "Q1", options: ["Only one"] }],
    });
    expect(result.valid).toBe(false);
  });

  it("accepts a well-formed survey", () => {
    const result = validateSurveyDraft({ name: "Feedback", questions: [validQuestion] });
    expect(result.valid).toBe(true);
  });
});
