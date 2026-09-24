"use client";

import { useEffect, useRef, useState } from "react";
import type { Leaderboard } from "@/lib/backend";

interface LeaderboardDisplayProps {
  leaderboard: Leaderboard;
  variant?: "stage" | "paper";
  highlightParticipantId?: string;
}

export default function LeaderboardDisplay({
  leaderboard,
  variant = "stage",
  highlightParticipantId,
}: LeaderboardDisplayProps) {
  const isStage = variant === "stage";

  // Rows don't use absolute positioning, so a true FLIP (measure old/new
  // DOM rects) isn't available cheaply here — instead, track each
  // participant's previous rank and flash a brief highlight on any row
  // whose rank just changed, giving the "something moved" cue the spec
  // wants without a full position-transform animation.
  const previousRanksRef = useRef<Map<string, number>>(new Map());
  const [changedIds, setChangedIds] = useState<{ key: number; ids: Set<string> }>({
    key: 0,
    ids: new Set(),
  });

  useEffect(() => {
    const previous = previousRanksRef.current;
    const changed = new Set<string>();
    for (const entry of leaderboard.entries) {
      const prevRank = previous.get(entry.participantId);
      if (prevRank !== undefined && prevRank !== entry.rank) {
        changed.add(entry.participantId);
      }
    }
    previousRanksRef.current = new Map(
      leaderboard.entries.map((entry) => [entry.participantId, entry.rank]),
    );
    if (changed.size === 0) return;

    // Deferred (not called synchronously in the effect body) per the
    // react-hooks/set-state-in-effect rule — same timer-based workaround
    // already used in WinnersPodium.tsx for staged reveals.
    const timer = setTimeout(
      () => setChangedIds((prev) => ({ key: prev.key + 1, ids: changed })),
      0,
    );
    return () => clearTimeout(timer);
  }, [leaderboard]);

  return (
    <ol className="flex w-full max-w-md flex-col gap-2">
      {leaderboard.entries.map((entry) => {
        const isYou = entry.participantId === highlightParticipantId;
        const justChanged = changedIds.ids.has(entry.participantId);
        return (
          <li
            key={entry.participantId}
            className={`flex items-center justify-between rounded-xl border px-4 py-3 ${
              justChanged ? "animate-flash-highlight" : ""
            } ${
              isYou
                ? "border-success bg-success/15"
                : isStage
                  ? "border-stage-line bg-stage-2"
                  : "border-hairline bg-white"
            }`}
          >
            <span className="flex items-center gap-3">
              <span
                className={`w-6 text-right font-display text-sm font-bold tabular-nums ${isStage ? "text-stage-muted" : "text-ink-soft"}`}
              >
                {entry.rank}
              </span>
              <span className={`text-sm font-medium ${isStage ? "text-stage-text" : "text-ink"}`}>
                {entry.nickname ?? "Anonymous"}
                {isYou ? " (you)" : ""}
              </span>
            </span>
            <span className={`font-display text-sm font-semibold tabular-nums ${isStage ? "text-white" : "text-ink"}`}>
              {entry.totalPoints} pts
            </span>
          </li>
        );
      })}
    </ol>
  );
}
