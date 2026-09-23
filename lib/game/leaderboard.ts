import type { Leaderboard, LeaderboardEntry } from "../backend/types";

export interface LeaderboardInput {
  sessionId: string;
  participants: { id: string; nickname: string | null }[];
  scores: { participantId: string; points: number; correct: boolean }[]; // every QuestionScore row across the whole session
}

// Pure aggregate — no Date.now() here (mirrors aggregate-poll.ts, which
// also takes no timestamp). The caller stamps `updatedAt` after calling
// this, keeping the math itself fully deterministic and testable.
export function computeLeaderboard(
  input: LeaderboardInput,
): Omit<Leaderboard, "updatedAt"> {
  const totals = new Map<
    string,
    { totalPoints: number; questionsAnswered: number; correctAnswers: number }
  >();
  for (const participant of input.participants) {
    totals.set(participant.id, {
      totalPoints: 0,
      questionsAnswered: 0,
      correctAnswers: 0,
    });
  }

  for (const score of input.scores) {
    const entry = totals.get(score.participantId);
    if (!entry) continue; // score for a participant not in this session's roster
    entry.totalPoints += score.points;
    entry.questionsAnswered += 1;
    if (score.correct) entry.correctAnswers += 1;
  }

  const unranked = input.participants.map((participant) => {
    const totals_ = totals.get(participant.id)!;
    return {
      participantId: participant.id,
      nickname: participant.nickname,
      totalPoints: totals_.totalPoints,
      questionsAnswered: totals_.questionsAnswered,
      correctAnswers: totals_.correctAnswers,
    };
  });

  unranked.sort((a, b) => b.totalPoints - a.totalPoints);

  const entries: LeaderboardEntry[] = [];
  let rank = 0;
  let previousPoints: number | null = null;
  unranked.forEach((entry, index) => {
    if (previousPoints === null || entry.totalPoints !== previousPoints) {
      rank = index + 1;
    }
    previousPoints = entry.totalPoints;
    entries.push({ ...entry, rank });
  });

  return { sessionId: input.sessionId, entries };
}
