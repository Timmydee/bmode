import type { CircleState } from "../hooks/useCircle";
import { CIRCLE_SPARKS, displayName, isDeeperUnanimous, isFullCircle } from "../game/circle";

// The small "+10 ✨" moments a player sees during a Circle, worked out by
// comparing the state they saw last with the one that just arrived. Only
// changes within the same question count, so loading the page (or a new
// question arriving) never replays old rewards.
export function sparkFeedback(
  prev: CircleState | null,
  next: CircleState,
  participantId: string,
): string[] {
  const before = prev?.question;
  const now = next.question;
  if (!before || !now || before.id !== now.id || prev.circle.id !== next.circle.id) return [];

  const messages: string[] = [];
  const outLoud = next.circle.settings.answerMode === "out_loud";

  const hadAnswer = prev.answers.some((a) => a.participantId === participantId && !a.skipped);
  const mine = next.answers.find((a) => a.participantId === participantId && !a.skipped);
  if (mine && !hadAnswer) messages.push(`+${CIRCLE_SPARKS.answer} ✨ for ${outLoud ? "getting ready" : "answering"}`);

  if (mine) {
    const seen = new Set(prev.hearts.map((h) => `${h.answerId}:${h.participantId}`));
    for (const heart of next.hearts) {
      if (heart.answerId !== mine.id || heart.participantId === participantId) continue;
      if (seen.has(`${heart.answerId}:${heart.participantId}`)) continue;
      const from = next.answers.find((a) => a.participantId === heart.participantId);
      const who = from ? displayName(from.nickname) : "Someone";
      messages.push(`+${CIRCLE_SPARKS.heart} ✨ ${who} loved ${outLoud ? "what you said" : "your answer"}`);
    }
  }

  if (before.phase === "answering" && now.phase === "revealed") {
    const answered = new Set(next.answers.filter((a) => !a.skipped).map((a) => a.participantId)).size;
    if (isFullCircle(answered, now.participantCount ?? 0)) {
      messages.push(`+${CIRCLE_SPARKS.fullCircle} ✨ Full Circle: everyone answered`);
    }
  }

  if (now.phase === "revealed" && now.depth < 3) {
    const room = now.participantCount ?? 0;
    if (!isDeeperUnanimous(prev.deeperVotes.length, room) && isDeeperUnanimous(next.deeperVotes.length, room)) {
      messages.push(`+${CIRCLE_SPARKS.deeper} ✨ Everyone’s in. Going deeper next`);
    }
  }

  return messages;
}
