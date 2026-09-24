import type { PollResults } from "@/lib/backend";

interface PollResultsProps {
  results: PollResults;
  // Round-question reveal only (absent for standalone polls, which keep
  // their existing "current leader" violet highlight below).
  correctOptionId?: string;
  // Presenter/projector screens need a bigger type floor than the host
  // control room — see agents/uxspec.md §11.1 ("nothing smaller than
  // 24px at 1080p"). Host control room keeps the default sizing.
  variant?: "default" | "stage-large";
}

export default function PollResults({
  results,
  correctOptionId,
  variant = "default",
}: PollResultsProps) {
  const leaderCount = Math.max(0, ...results.byOption.map((option) => option.count));
  const isLarge = variant === "stage-large";

  return (
    <div className="flex w-full max-w-2xl flex-col gap-4">
      {results.byOption.map((option) => {
        const pct =
          results.totalVotes > 0
            ? Math.round((option.count / results.totalVotes) * 100)
            : 0;
        const isLeading = leaderCount > 0 && option.count === leaderCount;
        const isCorrect = correctOptionId === option.optionId;
        const isWrong = correctOptionId !== undefined && !isCorrect;

        return (
          <div key={option.optionId} className="flex items-center gap-4">
            <div
              className={`w-[140px] shrink-0 text-stage-text sm:w-[220px] ${
                isLarge ? "text-lg sm:text-xl" : "text-sm sm:text-base"
              }`}
            >
              {/* Leading is otherwise color-only (violet vs. amber bar) —
                  a text cue keeps the signal legible without color. */}
              {isLeading && correctOptionId === undefined && "★ "}
              {option.label}
              {isCorrect && " ✓"}
            </div>
            <div
              className={`flex-1 overflow-hidden rounded-lg border border-stage-line bg-stage-2 ${isLarge ? "h-6" : "h-3.5"}`}
            >
              <div
                className={`h-full rounded-lg transition-[width] duration-500 ease-out ${
                  correctOptionId !== undefined
                    ? isCorrect
                      ? "bg-success"
                      : "bg-ember"
                    : isLeading
                      ? "bg-live"
                      : "bg-spotlight"
                }`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <div
              className={`w-14 shrink-0 text-right font-display font-semibold tabular-nums ${
                isLarge ? "text-2xl" : "text-base"
              } ${isWrong ? "text-stage-muted" : "text-white"}`}
            >
              {pct}%
            </div>
          </div>
        );
      })}
    </div>
  );
}
