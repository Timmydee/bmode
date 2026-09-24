"use client";

import { useEffect, useState } from "react";
import type { WordCloudResults } from "@/lib/backend";

interface WordCloudDisplayProps {
  results: WordCloudResults;
}

const MIN_FONT_PX = 20;
const MAX_FONT_PX = 64;

export default function WordCloudDisplay({ results }: WordCloudDisplayProps) {
  // Tracks which words have already been shown once, so only newly-seen
  // words replay the fade-in (a count change on an existing word
  // shouldn't re-animate it). Refs can't be read during render (flagged
  // by react-hooks/refs), so this lives in state, updated from an effect
  // — same shape as the "loaded-for-X" pattern used elsewhere in this
  // codebase for effect-derived state.
  const [seenWords, setSeenWords] = useState<Set<string>>(new Set());

  useEffect(() => {
    const newWords = results.words.filter((word) => !seenWords.has(word.word));
    if (newWords.length === 0) return;

    // Deferred, not synchronous, per react-hooks/set-state-in-effect —
    // same timer-based workaround used in LeaderboardDisplay.tsx.
    const timer = setTimeout(() => {
      setSeenWords((prev) => {
        const next = new Set(prev);
        for (const word of newWords) next.add(word.word);
        return next;
      });
    }, 0);
    return () => clearTimeout(timer);
    // Only re-run when the set of words present changes, not on every
    // count update — comparing the joined word list is enough here since
    // this component doesn't need to react to count changes, only new
    // words appearing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [results.words.map((w) => w.word).join("|")]);

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
          className={`font-display font-semibold leading-none text-white ${!seenWords.has(word.word) ? "animate-fade-in" : ""}`}
          style={{ fontSize: `${fontSizeFor(word.count)}px` }}
        >
          {word.word}
        </span>
      ))}
    </div>
  );
}
