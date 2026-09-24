"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { backend } from "@/lib/backend";
import { useSession } from "@/lib/hooks/useSession";
import { useActiveActivity } from "@/lib/hooks/useActiveActivity";
import { useLiveResults } from "@/lib/hooks/useLiveResults";
import { useRound } from "@/lib/hooks/useRound";
import { useLeaderboard } from "@/lib/hooks/useLeaderboard";
import { useSurvey } from "@/lib/hooks/useSurvey";
import JoinCode from "@/components/shared/JoinCode";
import QRCode from "@/components/shared/QRCode";
import ParticipantCount from "@/components/shared/ParticipantCount";
import PollResults from "@/components/poll/PollResults";
import WordCloudDisplay from "@/components/wordcloud/WordCloudDisplay";
import QuestionList from "@/components/qa/QuestionList";
import CountdownBadge from "@/components/round/CountdownBadge";
import LeaderboardDisplay from "@/components/round/LeaderboardDisplay";
import WinnersPodium from "@/components/round/WinnersPodium";

// The projector-facing counterpart to app/host/[sessionId]/page.tsx — same
// data, but display-only: no create/activate/moderate controls, so nothing
// a host wouldn't want an audience to see ever reaches this screen. A host
// runs this in one window (projected) and the control page in another.
export default function HostPresentPage(
  props: PageProps<"/host/[sessionId]/present">,
) {
  const { sessionId } = use(props.params);
  const { session, participantCount, loading } = useSession(
    sessionId,
    `host:${sessionId}`,
  );

  const [viewerId, setViewerId] = useState<string | null | undefined>(
    undefined,
  );
  useEffect(() => {
    backend.auth.getCurrentUserId().then(setViewerId);
    return backend.auth.onAuthChange(setViewerId);
  }, []);

  const { activity: activeActivity } = useActiveActivity(
    sessionId,
    session?.activeActivityId,
  );
  const liveResults = useLiveResults(
    sessionId,
    activeActivity?.id ?? null,
    activeActivity?.kind ?? null,
  );
  const round = useRound(sessionId);
  const isRoundQuestion =
    activeActivity?.kind === "poll" && round.currentQuestion?.id === activeActivity.id;
  const questionTotalSeconds =
    round.round && round.questionStartedAt && round.questionEndsAt
      ? Math.round((round.questionEndsAt - round.questionStartedAt) / 1000)
      : undefined;
  const leaderboard = useLeaderboard(
    (round.round && round.revealed) || round.justEndedRoundId ? sessionId : null,
  );
  const survey = useSurvey(sessionId);
  const isSurveyQuestion =
    activeActivity?.kind === "poll" && activeActivity.surveyId === survey.survey?.id;
  const surveyQuestionNumber =
    isSurveyQuestion && activeActivity
      ? survey.questions.findIndex((q) => q.activityId === activeActivity.id) + 1
      : 0;

  if (loading || viewerId === undefined) {
    return (
      <div className="flex flex-1 items-center justify-center bg-stage text-stage-muted">
        Loading…
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 bg-stage px-6 text-center text-white">
        <p className="font-display text-2xl font-semibold">
          Session not found
        </p>
        <p className="text-stage-muted">
          It may have been deleted, or the link is wrong. Go back to your
          sessions and try again.
        </p>
        <Link
          href="/host"
          className="mt-2 rounded-[10px] border-[1.5px] border-white/30 px-5 py-2.75 font-medium text-white"
        >
          Back to your sessions
        </Link>
      </div>
    );
  }

  if (viewerId !== session.hostId) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 bg-stage px-6 text-center text-white">
        <p className="font-display text-2xl font-semibold">
          You don’t have access to this session
        </p>
        <p className="text-stage-muted">
          Sign in as the host who created it to view this page.
        </p>
        <Link
          href="/host"
          className="mt-2 rounded-[10px] border-[1.5px] border-white/30 px-5 py-2.75 font-medium text-white"
        >
          Sign in
        </Link>
      </div>
    );
  }

  const joinUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/join/${session.joinCode}`
      : "";

  return (
    <div className="flex flex-1 flex-col bg-stage px-8 py-10 text-white sm:px-16 sm:py-14">
      <div className="mb-10 flex items-center justify-between">
        <span className="font-display text-[15px] font-bold tracking-[0.01em] text-stage-muted">
          Game Night
        </span>
        <div className="flex items-center gap-3">
          <span className="text-sm text-stage-muted">
            Join at {typeof window !== "undefined" ? window.location.host : ""}
            <JoinCode code={session.joinCode} className="ml-1.5 text-white" />
          </span>
          {/* Persistent corner QR for latecomers during a live activity —
              the idle screen below already shows a large centered one, so
              this only appears once something is actually running. */}
          {activeActivity && joinUrl && <QRCode url={joinUrl} size={64} />}
        </div>
      </div>

      {round.justEndedRoundId && leaderboard ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-8 py-6">
          <h1 className="font-display text-4xl font-bold sm:text-5xl">🎉 Winners 🎉</h1>
          <WinnersPodium leaderboard={leaderboard} variant="stage" />
        </div>
      ) : activeActivity?.kind === "poll" && isRoundQuestion && round.revealed && leaderboard ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-8 py-6">
          <h1 className="font-display text-3xl font-bold sm:text-4xl">Leaderboard</h1>
          <LeaderboardDisplay leaderboard={leaderboard} variant="stage" />
        </div>
      ) : activeActivity?.kind === "poll" ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-8 py-6">
          {isSurveyQuestion && (
            <p className="text-lg text-stage-muted">
              {survey.survey?.name} — question {surveyQuestionNumber} of {survey.questions.length}
            </p>
          )}
          <h1 className="max-w-[22ch] text-center font-display text-4xl font-bold sm:text-5xl">
            {activeActivity.prompt}
          </h1>
          {isRoundQuestion && round.questionEndsAt && round.serverTimeAtLastSync && !round.revealed && (
            <CountdownBadge
              endsAt={round.questionEndsAt}
              serverTimeAtLastSync={round.serverTimeAtLastSync}
              variant="ring"
              totalSeconds={questionTotalSeconds}
            />
          )}
          {liveResults && "byOption" in liveResults && (
            <PollResults
              results={liveResults}
              variant="stage-large"
              correctOptionId={
                isRoundQuestion && round.revealed
                  ? activeActivity.correctOptionId
                  : undefined
              }
            />
          )}
        </div>
      ) : activeActivity?.kind === "wordcloud" ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-8 py-6">
          <h1 className="max-w-[22ch] text-center font-display text-4xl font-bold sm:text-5xl">
            {activeActivity.prompt}
          </h1>
          {liveResults && "words" in liveResults && (
            <WordCloudDisplay results={liveResults} />
          )}
        </div>
      ) : activeActivity?.kind === "qa" ? (
        <div className="flex flex-1 flex-col items-center gap-6 overflow-y-auto py-6">
          <h1 className="max-w-[22ch] text-center font-display text-4xl font-bold sm:text-5xl">
            {activeActivity.prompt}
          </h1>
          <QuestionListPresentational sessionId={sessionId} activity={activeActivity} />
        </div>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-8 py-6 text-center">
          <h1 className="max-w-[16ch] font-display text-4xl font-bold sm:text-5xl">
            {session.title}
          </h1>
          {joinUrl && <QRCode url={joinUrl} size={220} />}
        </div>
      )}

      <div className="mt-10 flex items-center justify-between">
        <ParticipantCount count={participantCount} variant="stage" />
      </div>
    </div>
  );
}

// The present view has no live-updating questions list of its own the way
// the control page does — it borrows the same shape but stays read-only
// (no moderation, no upvote), so it only needs the current snapshot plus
// the same broadcast subscription pattern used everywhere else.
function QuestionListPresentational({
  sessionId,
  activity,
}: {
  sessionId: string;
  activity: { id: string };
}) {
  const [questions, setQuestions] = useState<
    Awaited<ReturnType<typeof backend.qa.list>>
  >([]);

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
    <QuestionList
      sessionId={sessionId}
      activityId={activity.id}
      questions={questions}
      variant="stage"
    />
  );
}
