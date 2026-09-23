import type { Leaderboard } from "@/lib/backend";

interface WinnersPodiumProps {
  leaderboard: Leaderboard;
  variant?: "stage" | "paper";
}

const MEDALS = ["🥇", "🥈", "🥉"];

// Spotlight for the final round_ended screen — the top 3 only, medal-style.
// The full ranked list stays available via LeaderboardDisplay (shown after
// every question reveal); this is specifically the "crown the winners"
// moment at the very end of a round.
export default function WinnersPodium({ leaderboard, variant = "stage" }: WinnersPodiumProps) {
  const isStage = variant === "stage";
  const top3 = leaderboard.entries.slice(0, 3);

  if (top3.length === 0) {
    return (
      <p className={isStage ? "text-stage-muted" : "text-ink-soft"}>
        No scores yet.
      </p>
    );
  }

  return (
    <ol className="flex w-full max-w-lg flex-col gap-3">
      {top3.map((entry, index) => (
        <li
          key={entry.participantId}
          className={`flex items-center gap-4 rounded-xl border px-5 py-4 ${
            index === 0
              ? "border-spotlight bg-spotlight/15"
              : isStage
                ? "border-stage-line bg-stage-2"
                : "border-hairline bg-white"
          }`}
        >
          <span className="text-3xl">{MEDALS[index]}</span>
          <span
            className={`flex-1 font-display text-lg font-semibold ${isStage ? "text-white" : "text-ink"}`}
          >
            {entry.nickname ?? "Anonymous"}
          </span>
          <span className={`font-display text-lg font-bold ${isStage ? "text-white" : "text-ink"}`}>
            {entry.totalPoints} pts
          </span>
        </li>
      ))}
    </ol>
  );
}
