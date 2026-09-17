import type { WordCloudResults } from "@/lib/backend";

interface WordCloudDisplayProps {
  results: WordCloudResults;
}

const MIN_FONT_PX = 20;
const MAX_FONT_PX = 64;

export default function WordCloudDisplay({ results }: WordCloudDisplayProps) {
  if (results.words.length === 0) {
    return <p className="text-stage-muted">Waiting for the first word…</p>;
  }

  const counts = results.words.map((word) => word.count);
  const minCount = Math.min(...counts);
  const maxCount = Math.max(...counts);

  function fontSizeFor(count: number): number {
    if (maxCount === minCount) return (MIN_FONT_PX + MAX_FONT_PX) / 2;
    const t = (count - minCount) / (maxCount - minCount);
    return MIN_FONT_PX + t * (MAX_FONT_PX - MIN_FONT_PX);
  }

  return (
    <div className="flex max-w-3xl flex-wrap items-center justify-center gap-x-5 gap-y-2">
      {results.words.map((word) => (
        <span
          key={word.word}
          className="font-display font-semibold leading-none text-white"
          style={{ fontSize: `${fontSizeFor(word.count)}px` }}
        >
          {word.word}
        </span>
      ))}
    </div>
  );
}
