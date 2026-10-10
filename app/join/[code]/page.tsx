"use client";

import { use, useEffect, useState, type FormEvent } from "react";
import { backend } from "@/lib/backend";
import type { AudienceQuestion, QAActivity, Session } from "@/lib/backend";
import { useParticipant } from "@/lib/hooks/useParticipant";
import { useSession } from "@/lib/hooks/useSession";
import { useActiveActivity } from "@/lib/hooks/useActiveActivity";
import { useRound } from "@/lib/hooks/useRound";
import { useLeaderboard } from "@/lib/hooks/useLeaderboard";
import { useCircle } from "@/lib/hooks/useCircle";
import CirclePlayerView from "@/components/circle/CirclePlayerView";
import { Avatar } from "@/components/circle/Cards";
import { validateNickname } from "@/lib/game/validation";
import ParticipantCount from "@/components/shared/ParticipantCount";
import PollVoting from "@/components/poll/PollVoting";
import WordCloudInput from "@/components/wordcloud/WordCloudInput";
import QuestionComposer from "@/components/qa/QuestionComposer";
import QuestionList from "@/components/qa/QuestionList";
import LeaderboardDisplay from "@/components/round/LeaderboardDisplay";
import WinnersPodium from "@/components/round/WinnersPodium";

export default function JoinCodePage(props: PageProps<"/join/[code]">) {
  const { code } = use(props.params);

  const [sessionByCode, setSessionByCode] = useState<
    Session | null | undefined
  >(undefined);

  useEffect(() => {
    let cancelled = false;
    backend.sessions.getByJoinCode(code).then((found) => {
      if (!cancelled) setSessionByCode(found);
    });
    return () => {
      cancelled = true;
    };
  }, [code]);

  const sessionId = sessionByCode?.id ?? null;
  const {
    participant,
    loading: participantLoading,
    join,
  } = useParticipant(sessionId);
  const { session, participantCount } = useSession(sessionId, participant?.id);
  const { activity } = useActiveActivity(sessionId, session?.activeActivityId);
  const round = useRound(sessionId);
  const leaderboard = useLeaderboard(
    (round.round && round.revealed) || round.justEndedRoundId ? sessionId : null,
  );
  const isRoundQuestion =
    activity?.kind === "poll" && round.currentQuestion?.id === activity.id;
  const circleGame = useCircle(sessionId);

  const [nickname, setNickname] = useState("");
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  async function handleJoin(event: FormEvent) {
    event.preventDefault();
    const trimmed = nickname.trim();
    if (trimmed) {
      const result = validateNickname(trimmed);
      if (!result.valid) {
        setJoinError(result.error ?? "That nickname isn't allowed.");
        return;
      }
    }
    setJoining(true);
    setJoinError(null);
    try {
      await join(trimmed || null);
    } catch (error) {
      setJoinError(
        error instanceof Error ? error.message : "Could not join.",
      );
    } finally {
      setJoining(false);
    }
  }

  if (sessionByCode === undefined) {
    return (
      <div className="flex flex-1 items-center justify-center text-ink-soft">
        Looking for that session…
      </div>
    );
  }

  if (sessionByCode === null) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
        <p className="font-display text-2xl font-semibold text-ink">
          No session with that code
        </p>
        <p className="text-ink-soft">
          Double-check the code with your host and try again.
        </p>
      </div>
    );
  }

  if (participantLoading) {
    return (
      <div className="flex flex-1 items-center justify-center text-ink-soft">
        Loading…
      </div>
    );
  }

  if (!participant) {
    return (
      <div className="flex flex-1 items-center justify-center bg-rail px-4 py-16">
        {/* Styled as an invite card: who you're joining, then your name. */}
        <div className="flex w-full max-w-md flex-col items-center gap-6 rounded-lg bg-stage p-8 text-center shadow-[0_8px_32px_rgb(0_0_0/40%)]">
          <Avatar name={sessionByCode.title} size="lg" shape="squircle" />
          <div>
            <p className="mb-1 text-sm text-ink-soft">You’ve been invited to join</p>
            <h1 className="font-display text-2xl font-extrabold text-ink">
              {sessionByCode.title}
            </h1>
            <p className="mt-2 inline-flex items-center gap-1.5 text-sm text-ink-faint">
              <span className="h-2 w-2 rounded-full bg-live" />
              Code {code}
            </p>
          </div>
          <form onSubmit={handleJoin} className="flex w-full flex-col gap-3 text-left">
            <label className="text-xs font-bold tracking-wide text-ink-soft uppercase" htmlFor="nickname">
              What should we call you?
            </label>
            <input
              id="nickname"
              value={nickname}
              onChange={(event) => setNickname(event.target.value)}
              placeholder="Nickname (optional)"
              maxLength={24}
              autoFocus
              className="rounded-[4px] bg-rail px-3 py-2.5 text-ink outline-none placeholder:text-ink-faint focus-visible:ring-2 focus-visible:ring-blurple"
            />
            {joinError && <p className="text-sm text-ember">{joinError}</p>}
            <button
              type="submit"
              disabled={joining}
              className="mt-2 rounded-[4px] bg-blurple px-5 py-2.75 font-semibold text-white transition-colors hover:bg-spotlight-hover disabled:opacity-60"
            >
              {joining ? "Joining…" : "Join session"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // A closed Circle's recap stays on screen until the host starts
  // something else.
  const circleOnScreen =
    circleGame.state &&
    (circleGame.state.circle.status !== "ended" || (!activity && !round.justEndedRoundId));
  if (circleGame.state && circleOnScreen) {
    return (
      <CirclePlayerView
        sessionId={sessionByCode.id}
        participantId={participant.id}
        state={circleGame.state}
      />
    );
  }

  if (round.justEndedRoundId && leaderboard) {
    return (
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-6 px-6 py-16">
        <h1 className="font-display text-2xl font-bold text-ink">🎉 Winners 🎉</h1>
        <WinnersPodium leaderboard={leaderboard} variant="paper" />
      </div>
    );
  }

  if (activity?.kind === "poll") {
    if (isRoundQuestion && round.revealed && leaderboard) {
      return (
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-6 px-6 py-16">
          <p className="text-sm text-ink-soft">Correct answer revealed</p>
          <LeaderboardDisplay
            leaderboard={leaderboard}
            variant="paper"
            highlightParticipantId={participant.id}
          />
        </div>
      );
    }

    return (
      <PollVoting
        activity={activity}
        participantId={participant.id}
        countdown={
          isRoundQuestion && round.questionEndsAt && round.serverTimeAtLastSync
            ? { endsAt: round.questionEndsAt, serverTime: round.serverTimeAtLastSync }
            : undefined
        }
        revealed={
          isRoundQuestion && round.revealed && round.currentQuestion?.correctOptionId
            ? { correctOptionId: round.currentQuestion.correctOptionId }
            : undefined
        }
      />
    );
  }

  if (activity?.kind === "wordcloud") {
    return (
      <WordCloudInput activity={activity} participantId={participant.id} />
    );
  }

  if (activity?.kind === "qa") {
    return (
      <QASection
        sessionId={sessionByCode.id}
        activity={activity}
        participantId={participant.id}
      />
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-6 px-6 py-20 text-center">
      <Avatar
        name={participant.nickname || "Guest"}
        size="lg"
        presence="online"
      />
      <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-live">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-live" />
        Live
      </span>
      <h1 className="font-display text-2xl font-extrabold text-ink">
        {sessionByCode.title}
      </h1>
      <p className="text-ink-soft">
        You’re in{participant.nickname ? `, ${participant.nickname}` : ""}.
        Waiting for the host to start something.
      </p>
      <ParticipantCount count={participantCount} variant="paper" />
    </div>
  );
}

function QASection({
  sessionId,
  activity,
  participantId,
}: {
  sessionId: string;
  activity: QAActivity;
  participantId: string;
}) {
  const [questions, setQuestions] = useState<AudienceQuestion[]>([]);

  useEffect(() => {
    let cancelled = false;
    backend.qa.list(activity.id).then((list) => {
      if (!cancelled) setQuestions(list);
    });

    const unsubscribe = backend.realtime.subscribe(sessionId, (event) => {
      if (
        event.type === "question_added" &&
        event.question.activityId === activity.id
      ) {
        setQuestions((prev) =>
          prev.some((q) => q.id === event.question.id)
            ? prev
            : [...prev, event.question],
        );
      }
      if (
        event.type === "question_updated" &&
        event.question.activityId === activity.id
      ) {
        setQuestions((prev) =>
          prev.map((q) => (q.id === event.question.id ? event.question : q)),
        );
      }
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [sessionId, activity.id]);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-6 py-16">
      <h1 className="font-display text-2xl font-bold text-ink">
        {activity.prompt}
      </h1>
      <QuestionComposer activity={activity} participantId={participantId} />
      <QuestionList
        sessionId={sessionId}
        activityId={activity.id}
        questions={questions}
        variant="paper"
        currentParticipantId={participantId}
      />
    </div>
  );
}
