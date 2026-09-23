import { describe, expect, it } from "vitest";
import { computeLeaderboard } from "./leaderboard";

describe("computeLeaderboard", () => {
  it("sums points cumulatively across multiple questions for the same participant", () => {
    const board = computeLeaderboard({
      sessionId: "s1",
      participants: [{ id: "p1", nickname: "Alice" }],
      scores: [
        { participantId: "p1", points: 800, correct: true },
        { participantId: "p1", points: 0, correct: false },
        { participantId: "p1", points: 550, correct: true },
      ],
    });

    expect(board.entries).toEqual([
      {
        participantId: "p1",
        nickname: "Alice",
        totalPoints: 1350,
        questionsAnswered: 3,
        correctAnswers: 2,
        rank: 1,
      },
    ]);
  });

  it("sorts descending by total points and ranks distinct scores sequentially", () => {
    const board = computeLeaderboard({
      sessionId: "s1",
      participants: [
        { id: "p1", nickname: "Low" },
        { id: "p2", nickname: "High" },
      ],
      scores: [
        { participantId: "p1", points: 100, correct: true },
        { participantId: "p2", points: 900, correct: true },
      ],
    });

    expect(board.entries.map((e) => e.participantId)).toEqual(["p2", "p1"]);
    expect(board.entries.map((e) => e.rank)).toEqual([1, 2]);
  });

  it("gives tied participants the same rank and skips the next rank accordingly", () => {
    const board = computeLeaderboard({
      sessionId: "s1",
      participants: [
        { id: "p1", nickname: "A" },
        { id: "p2", nickname: "B" },
        { id: "p3", nickname: "C" },
      ],
      scores: [
        { participantId: "p1", points: 500, correct: true },
        { participantId: "p2", points: 500, correct: true },
        { participantId: "p3", points: 200, correct: true },
      ],
    });

    const ranks = Object.fromEntries(
      board.entries.map((e) => [e.participantId, e.rank]),
    );
    expect(ranks.p1).toBe(1);
    expect(ranks.p2).toBe(1);
    expect(ranks.p3).toBe(3);
  });

  it("includes a participant with zero scored questions at 0 points", () => {
    const board = computeLeaderboard({
      sessionId: "s1",
      participants: [
        { id: "p1", nickname: "Scored" },
        { id: "p2", nickname: "LateJoiner" },
      ],
      scores: [{ participantId: "p1", points: 500, correct: true }],
    });

    const lateJoiner = board.entries.find((e) => e.participantId === "p2");
    expect(lateJoiner).toEqual({
      participantId: "p2",
      nickname: "LateJoiner",
      totalPoints: 0,
      questionsAnswered: 0,
      correctAnswers: 0,
      rank: 2,
    });
  });

  it("returns an empty board for a session with no participants or scores", () => {
    const board = computeLeaderboard({
      sessionId: "s1",
      participants: [],
      scores: [],
    });

    expect(board.entries).toEqual([]);
  });
});
