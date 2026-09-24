"use client";

import { useEffect, useState } from "react";
import type { Leaderboard } from "@/lib/backend";

interface WinnersPodiumProps {
  leaderboard: Leaderboard;
  variant?: "stage" | "paper";
}

const MEDALS = ["🥇", "🥈", "🥉"];
// Reveal order is 3rd, then 2nd, then 1st (built-up suspense) — reverse
// of display order (1st, 2nd, 3rd). Index into `top3`.
const REVEAL_ORDER = [2, 1, 0];
const REVEAL_STEP_MS = 1200;

export default function WinnersPodium({ leaderboard, variant = "stage" }: WinnersPodiumProps) {
  const isStage = variant === "stage";
  const top3 = leaderboard.entries.slice(0, 3);

  // "Loaded-for-X" pattern (see lib/hooks/useActiveActivity.ts and others):
  // store {key, revealedCount} and derive "is this reveal current" by
  // comparing key against the current leaderboard snapshot, rather than
  // synchronously resetting state at the top of the effect (flagged by
  // react-hooks/set-state-in-effect).
  const revealKey = `${leaderboard.sessionId}:${leaderboard.updatedAt}`;
  const winnerCount = top3.length;
  const [revealed, setRevealed] = useState<{ key: string; count: number } | null>(null);

  useEffect(() => {
    if (winnerCount === 0) return;

    const timers = Array.from({ length: winnerCount }, (_, step) =>
      setTimeout(() => setRevealed({ key: revealKey, count: step + 1 }), step * REVEAL_STEP_MS),
    );
    return () => timers.forEach(clearTimeout);
  }, [revealKey, winnerCount]);

  const revealedCount = revealed?.key === revealKey ? revealed.count : 0;

  if (top3.length === 0) {
    return (
      <p className={isStage ? "text-stage-muted" : "text-ink-soft"}>
        No scores yet.
      </p>
    );
  }

  return (
    <ol className="flex w-full max-w-lg flex-col gap-3">
      {REVEAL_ORDER.filter((index) => index < top3.length).map((index) => {
        const entry = top3[index];
        const isVisible = revealedCount > REVEAL_ORDER.indexOf(index);
        const isWinner = index === 0;

        return (
          <li
            key={entry.participantId}
            style={{ order: index }}
            className={`flex items-center gap-4 rounded-xl border px-5 py-4 transition-opacity ${
              isVisible ? "animate-pop-in opacity-100" : "opacity-0"
            } ${
              isWinner
                ? `border-spotlight bg-spotlight/15 ${isVisible ? "animate-pop-in" : ""}`
                : isStage
                  ? "border-stage-line bg-stage-2"
                  : "border-hairline bg-white"
            }`}
          >
            <span className={`text-3xl ${isWinner && isVisible ? "animate-pop-in" : ""}`}>
              {MEDALS[index]}
            </span>
            <span
              className={`flex-1 font-display font-semibold ${isWinner ? "text-xl" : "text-lg"} ${isStage ? "text-white" : "text-ink"}`}
            >
              {entry.nickname ?? "Anonymous"}
            </span>
            <span
              className={`font-display font-bold tabular-nums ${isWinner ? "text-xl" : "text-lg"} ${isStage ? "text-white" : "text-ink"}`}
            >
              {entry.totalPoints} pts
            </span>
          </li>
        );
      })}
    </ol>
  );
}
