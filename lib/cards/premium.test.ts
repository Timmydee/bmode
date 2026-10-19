import { describe, expect, it } from "vitest";
import type { PremiumInterestRow } from "../backend/types";
import { PREMIUM_DECKS, premiumDeckById, summarizePremiumInterest, tapRate } from "./premium";

describe("premium decks", () => {
  it("has unique ids that look up", () => {
    const ids = PREMIUM_DECKS.map((deck) => deck.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(premiumDeckById("after-dark")?.name).toBe("After Dark");
    expect(premiumDeckById("nope")).toBeUndefined();
  });

  it("counts distinct browsers per place and per deck", () => {
    const rows: PremiumInterestRow[] = [
      { deviceId: "a", deckId: null, action: "view", place: "cards" },
      { deviceId: "a", deckId: null, action: "view", place: "cards" },
      { deviceId: "b", deckId: null, action: "view", place: "cards" },
      { deviceId: "c", deckId: null, action: "view", place: "picker" },
      { deviceId: "a", deckId: "after-dark", action: "tap", place: "cards" },
      { deviceId: "a", deckId: "after-dark", action: "tap", place: "cards" },
      { deviceId: "a", deckId: "after-dark", action: "email", place: "cards" },
      { deviceId: "c", deckId: "after-dark", action: "tap", place: "picker" },
      { deviceId: "c", deckId: "miles-apart", action: "tap", place: "picker" },
    ];
    const summary = summarizePremiumInterest(rows);
    expect(summary.places.cards).toEqual({ viewers: 2, tappers: 1, emails: 1 });
    expect(summary.places.picker).toEqual({ viewers: 1, tappers: 1, emails: 0 });
    expect(summary.total).toEqual({ viewers: 3, tappers: 2, emails: 1 });
    expect(summary.decks.find((d) => d.id === "after-dark")).toMatchObject({ tappers: 2, emails: 1 });
    expect(summary.decks.find((d) => d.id === "miles-apart")).toMatchObject({ tappers: 1, emails: 0 });
    expect(tapRate(summary.places.cards)).toBe(50);
    expect(tapRate({ viewers: 0, tappers: 0, emails: 0 })).toBeNull();
  });
});
