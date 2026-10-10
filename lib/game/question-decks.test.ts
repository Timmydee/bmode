import { describe, expect, it } from "vitest";
import { QUESTION_DECKS } from "./question-decks";

describe("QUESTION_DECKS", () => {
  it("only shows questions that are still in the library", () => {
    // pick() drops texts it can't find, so a reworded library question
    // would quietly shrink a deck.
    for (const deck of QUESTION_DECKS) expect(deck.questions).toHaveLength(5);
  });

  it("only shows questions the deck's game can actually serve", () => {
    for (const deck of QUESTION_DECKS) {
      for (const question of deck.questions) {
        if (question.couples) expect(deck.vibe).toBe("couples");
        if (question.reconnect) expect(deck.vibe).toBe("reconnect");
      }
    }
  });
});
