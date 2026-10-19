import type { CircleRecap as Recap } from "@/lib/backend";
import { displayName } from "@/lib/game/circle";
import { Avatar } from "./Cards";
import { cardStockStyle, stockForQuestion } from "@/lib/cards/card-stock";

interface CircleRecapProps {
  recap: Recap;
  variant: "stage" | "paper";
  highlightParticipantId?: string;
}

// The end-of-game screen, shared by the host's big screen and every phone:
// how many questions were played, who played, and the question that got
// the most love. No scores: the game is about the conversation.
export default function CircleRecap({ recap, variant, highlightParticipantId }: CircleRecapProps) {
  const stage = variant === "stage";
  const muted = stage ? "text-stage-muted" : "text-ink-soft";

  return (
    <div className="flex w-full flex-col gap-6">
      <div className="text-center">
        <p className={`text-sm ${muted}`}>
          {recap.questionsPlayed} {recap.questionsPlayed === 1 ? "question" : "questions"} played
        </p>
        <h1 className={`font-display text-3xl font-bold ${stage ? "text-white" : "text-ink"}`}>
          That’s a wrap
        </h1>
      </div>

      {recap.players.length > 0 && (
        <section>
          <h2 className={`mb-2 text-sm font-medium ${muted}`}>Who played</h2>
          <ul className="flex flex-wrap gap-2">
            {recap.players.map((player) => (
              <li
                key={player.participantId}
                className={`flex items-center gap-2 rounded-full border py-1 pr-3.5 pl-1 text-sm ${
                  player.participantId === highlightParticipantId
                    ? "border-blurple bg-blurple/10"
                    : "border-transparent bg-stage-2"
                } ${stage ? "text-stage-text" : "text-ink"}`}
              >
                <Avatar name={displayName(player.nickname)} size="sm" />
                {displayName(player.nickname)}
                {player.participantId === highlightParticipantId && " (you)"}
              </li>
            ))}
          </ul>
        </section>
      )}

      {recap.questionOfTheNight && (
        <section
          style={cardStockStyle(stockForQuestion(recap.questionOfTheNight, 3))}
          className="flex flex-col gap-3 rounded-2xl p-6 text-white ring-1 ring-white/20"
        >
          <p className="text-xs font-bold tracking-wide text-white/80 uppercase">Question of the night</p>
          <p className="font-card text-2xl leading-tight font-extrabold tracking-tight">{recap.questionOfTheNight}</p>
        </section>
      )}
    </div>
  );
}
