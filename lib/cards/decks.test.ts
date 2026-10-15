import { describe, expect, it } from "vitest";
import { CIRCLE_QUESTIONS } from "../game/circle-questions";
import { DECK_PLAY_CARDS, DECKS, deckById, deckPath, deckPlayPath, parseDeck } from "./decks";
import { CARD_CATEGORIES, cardCategory } from "./library";

describe("card decks", () => {
  it("has a deck per category, plus one with every card", () => {
    expect(DECKS.map((deck) => deck.id)).toEqual([...CARD_CATEGORIES.map((c) => c.id), "all"]);
    for (const category of CARD_CATEGORIES) {
      expect(deckById(category.id).cards.every((card) => cardCategory(card).id === category.id)).toBe(true);
    }
    expect(deckById("all").cards).toHaveLength(CIRCLE_QUESTIONS.length);
  });

  it("reads a deck from the address", () => {
    expect(parseDeck("fun")).toBe("fun");
    expect(parseDeck("all")).toBe("all");
    expect(parseDeck("nope")).toBeNull();
    expect(parseDeck(null)).toBeNull();
    expect(deckPath("deep")).toBe("/cards?category=deep");
    expect(deckPath("deep", 12)).toBe("/cards?category=deep&card=12");
  });

  it("plays the next cards from the one on top, wrapping round", () => {
    const deck = deckById("relationships");
    const last = deck.cards.length - 1;
    const ids = new URL(deckPlayPath(deck.cards, last), "https://x").searchParams.get("cards")!.split("-").map(Number);
    expect(ids).toHaveLength(DECK_PLAY_CARDS);
    expect(ids[0]).toBe(deck.cards[last].id);
    expect(ids[1]).toBe(deck.cards[0].id);
  });
});
