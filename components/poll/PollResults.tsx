import type { PollResults } from "@/lib/backend";

interface PollResultsProps {
  results: PollResults;
}

export default function PollResults({ results }: PollResultsProps) {
  const leaderCount = Math.max(0, ...results.byOption.map((option) => option.count));

  return (
    <div className="flex w-full max-w-2xl flex-col gap-4">
      {results.byOption.map((option) => {
        const pct =
          results.totalVotes > 0
            ? Math.round((option.count / results.totalVotes) * 100)
            : 0;
        const isLeading = leaderCount > 0 && option.count === leaderCount;

        return (
          <div key={option.optionId} className="flex items-center gap-4">
            <div className="w-[140px] shrink-0 text-sm text-stage-text sm:w-[220px] sm:text-base">
              {option.label}
            </div>
            <div className="h-3.5 flex-1 overflow-hidden rounded-lg border border-stage-line bg-stage-2">
              <div
                className={`h-full rounded-lg ${isLeading ? "bg-live" : "bg-spotlight"}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className="w-11 shrink-0 text-right font-display text-base font-semibold text-white">
              {pct}%
            </div>
          </div>
        );
      })}
    </div>
  );
}
