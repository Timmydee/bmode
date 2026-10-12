import { describe, expect, it } from "vitest";
import { CIRCLE_QUESTIONS } from "../game/circle-questions";
import {
  CARD_CATEGORIES,
  COLLECTION_MAX_CARDS,
  cardCategory,
  cardsInCategory,
  collectionPath,
  encodeCollection,
  parseCollection,
  playPath,
  vibeForCards,
} from "./library";

describe("question bank ids", () => {
  it("gives every question its own id", () => {
    const ids = CIRCLE_QUESTIONS.map((q) => q.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(Number.isInteger(id) && id > 0).toBe(true);
  });
});

describe("card categories", () => {
  it("puts every card in exactly one category, and no category is empty", () => {
    const total = CARD_CATEGORIES.reduce((sum, c) => sum + cardsInCategory(c.id).length, 0);
    expect(total).toBe(CIRCLE_QUESTIONS.length);
    for (const category of CARD_CATEGORIES) expect(cardsInCategory(category.id).length).toBeGreaterThan(4);
  });

  it("keeps themed questions in the category whose vibe can play them", () => {
    for (const q of CIRCLE_QUESTIONS) {
      if (q.couples) expect(cardCategory(q).vibe).toBe("couples");
      if (q.reconnect) expect(cardCategory(q).vibe).toBe("reconnect");
    }
  });
});

describe("collections", () => {
  it("round-trips ids in order", () => {
    expect(parseCollection(encodeCollection([12, 3, 40]))).toEqual([12, 3, 40]);
    expect(collectionPath([12, 3, 40])).toBe("/cards/set/12-3-40");
  });

  it("drops unknown ids, repeats and junk", () => {
    expect(parseCollection("3-3-99999-abc--0-12")).toEqual([3, 12]);
    expect(parseCollection("")).toEqual([]);
    expect(parseCollection(undefined)).toEqual([]);
  });

  it("caps a collection at the longest game", () => {
    const all = CIRCLE_QUESTIONS.map((q) => q.id).join("-");
    expect(parseCollection(all)).toHaveLength(COLLECTION_MAX_CARDS);
  });
});

describe("starting a game from cards", () => {
  const byCategory = (id: Parameters<typeof cardsInCategory>[0]) => cardsInCategory(id);

  it("plays couples questions in the couples vibe, even mixed with others", () => {
    expect(vibeForCards([byCategory("icebreakers")[0], byCategory("relationships")[0]])).toBe("couples");
  });

  it("uses the category's vibe when every card shares one", () => {
    expect(vibeForCards(byCategory("deep").slice(0, 3))).toBe("deeper");
    expect(vibeForCards(byCategory("fun").slice(0, 3))).toBe("chill");
  });

  it("falls back to Get to know for a general mix", () => {
    expect(vibeForCards([byCategory("icebreakers")[0], byCategory("deep")[0]])).toBe("know");
  });

  it("links to the host flow with the cards and their vibe", () => {
    const couple = byCategory("relationships")[0].id;
    expect(playPath([couple])).toBe(`/host?vibe=couples&cards=${couple}`);
  });
});
