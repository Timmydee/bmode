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

  return (
    <ol className="flex w-full max-w-md flex-col gap-2">
      {leaderboard.entries.map((entry) => {
        const isYou = entry.participantId === highlightParticipantId;
        return (
          <li
            key={entry.participantId}
            className={`flex items-center justify-between rounded-xl border px-4 py-3 ${
              isYou
                ? "border-success bg-success/15"
                : isStage
                  ? "border-stage-line bg-stage-2"
                  : "border-hairline bg-white"
            }`}
          >
            <span className="flex items-center gap-3">
              <span
                className={`w-6 text-right font-display text-sm font-bold ${isStage ? "text-stage-muted" : "text-ink-soft"}`}
              >
                {entry.rank}
              </span>
              <span className={`text-sm font-medium ${isStage ? "text-stage-text" : "text-ink"}`}>
                {entry.nickname ?? "Anonymous"}
                {isYou ? " (you)" : ""}
              </span>
            </span>
            <span className={`font-display text-sm font-semibold ${isStage ? "text-white" : "text-ink"}`}>
              {entry.totalPoints} pts
            </span>
          </li>
        );
      })}
    </ol>
  );
}
