import type { WordCloudResults, WordEntry } from "../backend/types";

export function aggregateWordCloudResults(
  activityId: string,
  entries: WordEntry[],
): WordCloudResults {
  const counts = new Map<string, number>();
  let totalEntries = 0;

  for (const entry of entries) {
    if (entry.activityId !== activityId) continue;
    totalEntries += 1;
    counts.set(entry.word, (counts.get(entry.word) ?? 0) + 1);
  }

  const words = Array.from(counts.entries())
    .map(([word, count]) => ({ word, count }))
    .sort((a, b) => b.count - a.count || a.word.localeCompare(b.word));

  return { activityId, totalEntries, words };
}
