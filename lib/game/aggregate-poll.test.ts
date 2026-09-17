import { describe, expect, it } from "vitest";
import { aggregatePollResults } from "./aggregate-poll";
import type { PollOption, PollVote } from "../backend/types";

const options: PollOption[] = [
  { id: "opt-1", label: "Flexible hours" },
  { id: "opt-2", label: "No commute" },
];

function vote(activityId: string, optionId: string): PollVote {
  return {
    id: crypto.randomUUID(),
    activityId,
    participantId: crypto.randomUUID(),
    optionId,
    submittedAt: new Date(),
  };
}

describe("aggregatePollResults", () => {
  it("counts votes per option and totals them", () => {
    const votes = [
      vote("act-1", "opt-1"),
      vote("act-1", "opt-1"),
      vote("act-1", "opt-2"),
    ];

    const results = aggregatePollResults("act-1", options, votes);

    expect(results.totalVotes).toBe(3);
    expect(results.byOption).toEqual([
      { optionId: "opt-1", label: "Flexible hours", count: 2 },
      { optionId: "opt-2", label: "No commute", count: 1 },
    ]);
  });

  it("includes options with zero votes", () => {
    const results = aggregatePollResults("act-1", options, []);

    expect(results.totalVotes).toBe(0);
    expect(results.byOption).toEqual([
      { optionId: "opt-1", label: "Flexible hours", count: 0 },
      { optionId: "opt-2", label: "No commute", count: 0 },
    ]);
  });

  it("ignores votes for a different activity", () => {
    const votes = [vote("other-activity", "opt-1")];

    const results = aggregatePollResults("act-1", options, votes);

    expect(results.totalVotes).toBe(0);
  });
});
