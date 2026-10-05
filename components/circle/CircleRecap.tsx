import type { CircleAward, CircleAwardVote, CircleRecap as Recap } from "@/lib/backend";
import { bondLevel, displayName } from "@/lib/game/circle";

export const CIRCLE_AWARDS: { award: CircleAward; label: string }[] = [
  { award: "best", label: "Best answer" },
  { award: "surprising", label: "Most surprising" },
];

interface CircleRecapProps {
  recap: Recap;
  awardVotes: CircleAwardVote[];
  variant: "stage" | "paper";
  highlightParticipantId?: string;
}

// The end-of-game screen, shared by the host (Stage) and every phone
// (Paper): the group's Sparks, the Bond they carry into the next game,
// badges, and — only in Competitive style — a ranking.
export default function CircleRecap({
  recap,
  awardVotes,
  variant,
  highlightParticipantId,
}: CircleRecapProps) {
  const stage = variant === "stage";
  const muted = stage ? "text-stage-muted" : "text-ink-soft";
  const card = stage ? "border-stage-line bg-stage-2" : "border-hairline bg-white";
  const before = bondLevel(recap.bondBefore);
  const after = bondLevel(recap.bondAfter);
  const leveledUp = before.name !== after.name;

  return (
    <div className="flex w-full flex-col gap-6">
      <div className="text-center">
        <p className={`text-sm ${muted}`}>
          {recap.questionsPlayed} {recap.questionsPlayed === 1 ? "question" : "questions"} played
        </p>
        <h1 className={`font-display text-3xl font-bold ${stage ? "text-white" : "text-ink"}`}>
          That’s a wrap
        </h1>
        <p className="mt-2 font-display text-2xl font-semibold text-spotlight">
          +{recap.pot} Sparks together
        </p>
      </div>

      <section className={`rounded-xl border p-4 ${card}`}>
        <div className="mb-2 flex items-baseline justify-between">
          <span className={`text-sm ${muted}`}>Your bond</span>
          <span className={`font-display text-lg font-semibold ${stage ? "text-white" : "text-ink"}`}>
            {after.name}
          </span>
        </div>
        <div className={`h-2.5 overflow-hidden rounded-full ${stage ? "bg-stage-line" : "bg-paper-2"}`}>
          <div
            className="h-full rounded-full bg-spotlight transition-[width] duration-700"
            style={{ width: `${Math.round(after.progress * 100)}%` }}
          />
        </div>
        <p className={`mt-2 text-sm ${muted}`}>
          {leveledUp
            ? `Level up! You went from ${before.name} to ${after.name}.`
            : after.nextName
              ? `${after.toNext} Sparks to ${after.nextName}. Play again with the same names to keep growing it.`
              : "You’ve reached the top level."}
        </p>
      </section>

      {recap.badges.length > 0 && (
        <section>
          <h2 className={`mb-2 text-sm font-medium ${muted}`}>Badges earned</h2>
          <ul className="grid grid-cols-2 gap-2">
            {recap.badges.map((badge) => (
              <li key={badge.id} className={`rounded-xl border p-3 ${card}`}>
                <span className="text-xl" aria-hidden>
                  {badge.icon}
                </span>
                <p className={`font-medium ${stage ? "text-white" : "text-ink"}`}>{badge.name}</p>
                <p className={`text-xs ${muted}`}>{badge.detail}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {recap.players.length > 0 && (
        <section>
          <h2 className={`mb-2 text-sm font-medium ${muted}`}>
            {recap.rewardStyle === "competitive" ? "Standings" : "Everyone’s Sparks"}
          </h2>
          <ul className="flex flex-col gap-1.5">
            {recap.players.map((player) => (
              <li
                key={player.participantId}
                className={`flex items-center justify-between rounded-xl border px-4 py-2.5 ${card} ${
                  player.participantId === highlightParticipantId ? "border-spotlight" : ""
                }`}
              >
                <span className={stage ? "text-stage-text" : "text-ink"}>
                  {player.rank !== null && (
                    <span className="mr-2 font-display font-semibold tabular-nums">
                      {player.rank === 1 ? "🥇" : player.rank === 2 ? "🥈" : player.rank === 3 ? "🥉" : `${player.rank}.`}
                    </span>
                  )}
                  {displayName(player.nickname)}
                  {player.participantId === highlightParticipantId && " (you)"}
                </span>
                <span className={`font-display font-semibold tabular-nums ${stage ? "text-white" : "text-ink"}`}>
                  {player.sparks} ✨
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {recap.questionOfTheNight && (
        <section className={`rounded-xl border p-4 ${card}`}>
          <p className={`text-sm ${muted}`}>Question of the night</p>
          <p className={`font-display text-lg font-semibold ${stage ? "text-white" : "text-ink"}`}>
            {recap.questionOfTheNight}
          </p>
        </section>
      )}

      <AwardResults recap={recap} awardVotes={awardVotes} muted={muted} card={card} stage={stage} />
    </div>
  );
}

function AwardResults({
  recap,
  awardVotes,
  muted,
  card,
  stage,
}: {
  recap: Recap;
  awardVotes: CircleAwardVote[];
  muted: string;
  card: string;
  stage: boolean;
}) {
  if (awardVotes.length === 0) return null;
  const names = new Map(recap.players.map((p) => [p.participantId, displayName(p.nickname)]));

  return (
    <section className="grid grid-cols-2 gap-2">
      {CIRCLE_AWARDS.map(({ award, label }) => {
        const counts = new Map<string, number>();
        for (const vote of awardVotes) {
          if (vote.award !== award) continue;
          counts.set(vote.nomineeParticipantId, (counts.get(vote.nomineeParticipantId) ?? 0) + 1);
        }
        const top = Math.max(0, ...counts.values());
        const winners = [...counts.entries()].filter(([, count]) => count === top && top > 0);
        return (
          <div key={award} className={`rounded-xl border p-3 ${card}`}>
            <p className={`text-xs ${muted}`}>{label}</p>
            <p className={`font-medium ${stage ? "text-white" : "text-ink"}`}>
              {winners.length > 0
                ? winners.map(([id]) => names.get(id) ?? "Guest").join(" & ")
                : "No votes yet"}
            </p>
            {top > 0 && (
              <p className={`text-xs ${muted}`}>
                {top} {top === 1 ? "vote" : "votes"}
              </p>
            )}
          </div>
        );
      })}
    </section>
  );
}
