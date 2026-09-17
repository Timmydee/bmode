import { describe, expect, it } from "vitest";
import { aggregateWordCloudResults } from "./aggregate-wordcloud";
import type { WordEntry } from "../backend/types";

function entry(activityId: string, word: string): WordEntry {
  return {
    id: crypto.randomUUID(),
    activityId,
    participantId: crypto.randomUUID(),
    word,
    submittedAt: new Date(),
  };
}

describe("aggregateWordCloudResults", () => {
  it("counts frequency per word, sorted descending", () => {
    const entries = [
      entry("act-1", "flexible"),
      entry("act-1", "flexible"),
      entry("act-1", "commute"),
      entry("act-1", "flexible"),
    ];

    const results = aggregateWordCloudResults("act-1", entries);

    expect(results.totalEntries).toBe(4);
    expect(results.words).toEqual([
      { word: "flexible", count: 3 },
      { word: "commute", count: 1 },
    ]);
  });

  it("breaks ties alphabetically for stable ordering", () => {
    const entries = [entry("act-1", "zebra"), entry("act-1", "apple")];

    const results = aggregateWordCloudResults("act-1", entries);

    expect(results.words.map((w) => w.word)).toEqual(["apple", "zebra"]);
  });

  it("ignores entries for a different activity", () => {
    const entries = [entry("other-activity", "hello")];

    const results = aggregateWordCloudResults("act-1", entries);

    expect(results.totalEntries).toBe(0);
    expect(results.words).toEqual([]);
  });
});
