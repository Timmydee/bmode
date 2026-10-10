import type { CircleAward, CircleAwardVote, CircleRecap as Recap } from "@/lib/backend";
import { bondLevel, circleAwardsEnabled, displayName } from "@/lib/game/circle";
import { Avatar } from "./Cards";
import Icon, { type IconName } from "@/components/shared/Icon";

const BADGE_ICONS: Record<string, IconName> = {
  icebreaker: "snowflake",
  "full-circle": "ring",
  "deep-divers": "waves",
  "all-in": "users",
  "big-hearts": "heart",
  "night-owls": "moon",
};

// Gold, silver and bronze discs for the top three in Competitive style.
const RANK_STYLES = ["bg-gold text-card-ink", "bg-[#C7CBE0] text-card-ink", "bg-[#C98A55] text-card-ink"];

function RankBadge({ rank }: { rank: number }) {
  return (
    <span
      aria-label={`Rank ${rank}`}
      className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full font-display text-xs font-extrabold tabular-nums ${
        RANK_STYLES[rank - 1] ?? "bg-stage-button text-white"
      }`}
    >
      {rank}
    </span>
  );
}

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

// The end-of-game screen, shared by the host's big screen and every phone:
// the group's Sparks, the Bond they carry into the next game, badges, and
// (only in Competitive style) a ranking. Sections are Discord-style embeds.
export default function CircleRecap({
  recap,
  awardVotes,
  variant,
  highlightParticipantId,
}: CircleRecapProps) {
  const stage = variant === "stage";
  const muted = stage ? "text-stage-muted" : "text-ink-soft";
  const card = "border-transparent bg-stage-2";
  const before = bondLevel(recap.bondBefore);
  const after = bondLevel(recap.bondAfter);
  const leveledUp = before.name !== after.name;
  const competitive = recap.rewardStyle === "competitive";
  const winners = recap.players.filter((p) => p.rank === 1);
  const headline = !competitive
    ? `+${recap.pot} Sparks together`
    : winners.length === 0 || winners.length === recap.players.length
      ? "It’s a tie!"
      : `${winners.map((p) => displayName(p.nickname)).join(" & ")} ${winners.length === 1 ? "wins" : "win"}${
          winners[0].hearts ? ` with ${winners[0].hearts} ${winners[0].hearts === 1 ? "heart" : "hearts"}` : ""
        }`;

  return (
    <div className="flex w-full flex-col gap-6">
      <div className="text-center">
        <p className={`text-sm ${muted}`}>
          {recap.questionsPlayed} {recap.questionsPlayed === 1 ? "question" : "questions"} played
        </p>
        <h1 className={`font-display text-3xl font-bold ${stage ? "text-white" : "text-ink"}`}>
          That’s a wrap
        </h1>
        <p className="mt-2 font-display text-2xl font-extrabold text-gold">{headline}</p>
        {competitive && <p className={`text-sm ${muted}`}>Most hearts received wins. +{recap.pot} Sparks for your bond.</p>}
      </div>

      <section className="rounded-md border-l-4 border-blurple bg-stage-2 p-4">
        <div className="mb-2 flex items-baseline justify-between">
          <span className={`text-sm ${muted}`}>Your bond</span>
          <span className={`font-display text-lg font-semibold ${stage ? "text-white" : "text-ink"}`}>
            {after.name}
          </span>
        </div>
        <div className={`h-2.5 overflow-hidden rounded-full ${stage ? "bg-stage-line" : "bg-paper-2"}`}>
          <div
            className="h-full rounded-full bg-blurple transition-[width] duration-700"
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
              <li key={badge.id} className={`rounded-md border p-3 ${card}`}>
                <span className="mb-1.5 inline-flex h-8 w-8 items-center justify-center rounded-full bg-blurple/20 text-blurple-soft">
                  <Icon name={BADGE_ICONS[badge.id] ?? "sparkle"} className="h-4 w-4" />
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
                className={`flex items-center justify-between rounded-md border px-3 py-2 ${
                  player.participantId === highlightParticipantId ? "border-blurple bg-blurple/10" : card
                }`}
              >
                <span className={`flex items-center gap-2.5 ${stage ? "text-stage-text" : "text-ink"}`}>
                  {player.rank !== null && <RankBadge rank={player.rank} />}
                  <Avatar name={displayName(player.nickname)} size="sm" />
                  {displayName(player.nickname)}
                  {player.participantId === highlightParticipantId && " (you)"}
                </span>
                <span
                  className={`flex items-center gap-3 font-display font-semibold tabular-nums ${stage ? "text-white" : "text-ink"}`}
                >
                  {competitive && player.hearts !== undefined && (
                    <span className="inline-flex items-center gap-1" aria-label={`${player.hearts} hearts`}>
                      <Icon name="heart" filled className="h-4 w-4 text-fuchsia" />
                      {player.hearts}
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1" aria-label={`${player.sparks} Sparks`}>
                    <Icon name="sparkle" className="h-4 w-4 text-gold" />
                    {player.sparks}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {recap.questionOfTheNight && (
        <section className="flex flex-col gap-3 rounded-2xl bg-card-black p-6 text-white ring-1 ring-white/10">
          <p className="text-xs font-bold tracking-wide text-white/60 uppercase">Question of the night</p>
          <p className="font-card text-2xl leading-tight font-extrabold tracking-tight">{recap.questionOfTheNight}</p>
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
  if (awardVotes.length === 0 || !circleAwardsEnabled(recap.players.length)) return null;
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
          <div key={award} className={`rounded-md border p-3 ${card}`}>
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
