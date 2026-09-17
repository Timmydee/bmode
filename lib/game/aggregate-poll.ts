import type { PollOption, PollResults, PollVote } from "../backend/types";

export function aggregatePollResults(
  activityId: string,
  options: PollOption[],
  votes: PollVote[],
): PollResults {
  const counts = new Map<string, number>();
  for (const option of options) {
    counts.set(option.id, 0);
  }
  for (const vote of votes) {
    if (vote.activityId !== activityId) continue;
    counts.set(vote.optionId, (counts.get(vote.optionId) ?? 0) + 1);
  }

  const byOption = options.map((option) => ({
    optionId: option.id,
    label: option.label,
    count: counts.get(option.id) ?? 0,
  }));
  const totalVotes = byOption.reduce((sum, entry) => sum + entry.count, 0);

  return { activityId, totalVotes, byOption };
}
