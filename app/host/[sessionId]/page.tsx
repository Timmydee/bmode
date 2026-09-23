"use client";

import Link from "next/link";
import { use, useEffect, useRef, useState, type FormEvent } from "react";
import { backend } from "@/lib/backend";
import type { Activity, AudienceQuestion, Round, Survey } from "@/lib/backend";
import { useSession } from "@/lib/hooks/useSession";
import { useActiveActivity } from "@/lib/hooks/useActiveActivity";
import { useLiveResults } from "@/lib/hooks/useLiveResults";
import { useRound } from "@/lib/hooks/useRound";
import { useCountdown } from "@/lib/hooks/useCountdown";
import { useLeaderboard } from "@/lib/hooks/useLeaderboard";
import { useSurvey } from "@/lib/hooks/useSurvey";
import {
  validateRoundDraft,
  validateSurveyDraft,
  type RoundQuestionDraft,
  type SurveyQuestionDraft,
} from "@/lib/game/validation";
import JoinCode from "@/components/shared/JoinCode";
import QRCode from "@/components/shared/QRCode";
import ParticipantCount from "@/components/shared/ParticipantCount";
import PollResults from "@/components/poll/PollResults";
import WordCloudDisplay from "@/components/wordcloud/WordCloudDisplay";
import QuestionList from "@/components/qa/QuestionList";
import CountdownBadge from "@/components/round/CountdownBadge";
import LeaderboardDisplay from "@/components/round/LeaderboardDisplay";
import WinnersPodium from "@/components/round/WinnersPodium";

const REVEAL_PAUSE_MS = 4000;

// Module-level, outside the component, per the react-hooks/purity
// constraint (Date.now() reachable from render-time closures gets
// flagged) — scores the just-finished question, broadcasts the reveal +
// updated leaderboard, then either advances to the next question or ends
// the round. Called from the host page's auto-advance effect.
async function advanceOrEndRound(input: {
  sessionId: string;
  round: Round;
  currentQuestion: { id: string; correctOptionId?: string };
  questions: { id: string; activityId: string; order: number }[];
}): Promise<void> {
  const { sessionId, round, currentQuestion, questions } = input;
  if (!currentQuestion.correctOptionId || round.currentQuestionStartedAt === null) {
    return;
  }

  await backend.scores.scoreQuestion({
    activityId: currentQuestion.id,
    correctOptionId: currentQuestion.correctOptionId,
    questionStartedAt: round.currentQuestionStartedAt,
    timeLimitSeconds: round.timeLimitSeconds,
  });
  const results = await backend.responses.getPollResults(currentQuestion.id);
  await backend.realtime.publish(sessionId, {
    type: "round_question_revealed",
    activityId: currentQuestion.id,
    correctOptionId: currentQuestion.correctOptionId,
    results,
    serverTime: Date.now(),
  });

  const leaderboard = await backend.scores.getLeaderboard(sessionId);
  await backend.realtime.publish(sessionId, {
    type: "leaderboard_updated",
    leaderboard,
    serverTime: Date.now(),
  });

  await new Promise((resolve) => setTimeout(resolve, REVEAL_PAUSE_MS));

  await backend.activities.setStatus(currentQuestion.id, "closed");

  const currentIndex = round.currentQuestionIndex ?? 0;
  const nextQuestionMeta = questions.find((q) => q.order === currentIndex + 1);

  if (!nextQuestionMeta) {
    await backend.rounds.endRound(round.id);
    await backend.sessions.setActiveActivity(sessionId, null);
    await backend.realtime.publish(sessionId, {
      type: "round_ended",
      roundId: round.id,
      serverTime: Date.now(),
    });
    return;
  }

  const nextActivity = await backend.activities.getById(nextQuestionMeta.activityId);
  if (!nextActivity || nextActivity.kind !== "poll") return;

  const startedAt = Date.now();
  const endsAt = startedAt + round.timeLimitSeconds * 1000;
  await backend.activities.setStatus(nextActivity.id, "live");
  await backend.sessions.setActiveActivity(sessionId, nextActivity.id);
  await backend.rounds.startQuestion({
    roundId: round.id,
    questionIndex: currentIndex + 1,
    startedAt,
    endsAt,
  });
  await backend.realtime.publish(sessionId, {
    type: "round_question_advanced",
    roundId: round.id,
    question: nextActivity,
    questionIndex: currentIndex + 1,
    startedAt,
    endsAt,
    serverTime: Date.now(),
  });
}

export default function HostSessionPage(
  props: PageProps<"/host/[sessionId]">,
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
  const { expired: questionExpired } = useCountdown(
    round.round?.status === "live" ? round.questionEndsAt : null,
    round.serverTimeAtLastSync,
  );
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

  const [activities, setActivities] = useState<Activity[]>([]);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  useEffect(() => {
    if (!sessionId) return;
    backend.activities.listBySession(sessionId).then(setActivities);
    backend.rounds.listBySession(sessionId).then(setRounds);
    backend.surveys.listBySession(sessionId).then(setSurveys);
  }, [sessionId, refreshKey]);
  function refreshActivities() {
    setRefreshKey((key) => key + 1);
  }

  // Guards against double-fire: React effects can re-run and observe
  // questionExpired=true more than once before the advance completes.
  const [actionError, setActionError] = useState<string | null>(null);

  const advancingRef = useRef(false);
  useEffect(() => {
    if (!sessionId || !round.round || round.revealed || !questionExpired) return;
    if (!round.currentQuestion) return;
    if (advancingRef.current) return;

    advancingRef.current = true;
    backend.rounds.listQuestions(round.round.id).then((questions) => {
      advanceOrEndRound({
        sessionId,
        round: round.round!,
        currentQuestion: round.currentQuestion!,
        questions,
      })
        .catch((err) => {
          setActionError(err instanceof Error ? err.message : "Round advance failed.");
        })
        .finally(() => {
          advancingRef.current = false;
          refreshActivities();
        });
    });
  }, [sessionId, round.round, round.currentQuestion, round.revealed, questionExpired]);

  const qaActivityId =
    activeActivity?.kind === "qa" ? activeActivity.id : null;
  const [questionsLoaded, setQuestionsLoaded] = useState<{
    activityId: string;
    questions: AudienceQuestion[];
  } | null>(null);
  useEffect(() => {
    if (!sessionId || !qaActivityId) return;
    let cancelled = false;

    backend.qa.list(qaActivityId, { includeHidden: true }).then((list) => {
      if (cancelled) return;
      setQuestionsLoaded({ activityId: qaActivityId, questions: list });
    });

    const unsubscribe = backend.realtime.subscribe(sessionId, (event) => {
      if (
        event.type === "question_added" &&
        event.question.activityId === qaActivityId
      ) {
        setQuestionsLoaded((prev) => {
          if (!prev || prev.activityId !== qaActivityId) return prev;
          if (prev.questions.some((q) => q.id === event.question.id))
            return prev;
          return {
            activityId: qaActivityId,
            questions: [...prev.questions, event.question],
          };
        });
      }
      if (
        event.type === "question_updated" &&
        event.question.activityId === qaActivityId
      ) {
        setQuestionsLoaded((prev) => {
          if (!prev || prev.activityId !== qaActivityId) return prev;
          return {
            activityId: qaActivityId,
            questions: prev.questions.map((q) =>
              q.id === event.question.id ? event.question : q,
            ),
          };
        });
      }
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [sessionId, qaActivityId]);
  const questions =
    questionsLoaded?.activityId === qaActivityId
      ? questionsLoaded.questions
      : [];

  async function handleActivate(activityId: string) {
    setActionError(null);
    try {
      await backend.activities.setStatus(activityId, "live");
      await backend.sessions.setActiveActivity(sessionId, activityId);
      const activated = await backend.activities.getById(activityId);
      if (activated) {
        await backend.realtime.publish(sessionId, {
          type: "activity_activated",
          activity: activated,
          serverTime: Date.now(),
        });
      }
      refreshActivities();
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Could not activate that.",
      );
    }
  }

  async function handleClose(activityId: string) {
    setActionError(null);
    try {
      await backend.activities.setStatus(activityId, "closed");
      await backend.sessions.setActiveActivity(sessionId, null);
      await backend.realtime.publish(sessionId, {
        type: "activity_closed",
        activityId,
        serverTime: Date.now(),
      });
      refreshActivities();
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Could not close that.",
      );
    }
  }

  async function handleActivateRound(roundId: string) {
    setActionError(null);
    try {
      const [roundToActivate, questions] = await Promise.all([
        backend.rounds.getById(roundId),
        backend.rounds.listQuestions(roundId),
      ]);
      const first = questions.find((q) => q.order === 0);
      if (!roundToActivate || !first) {
        throw new Error("This round has no questions.");
      }
      const firstActivity = await backend.activities.getById(first.activityId);
      if (!firstActivity || firstActivity.kind !== "poll") {
        throw new Error("Could not load the round's first question.");
      }

      const startedAt = Date.now();
      const endsAt = startedAt + roundToActivate.timeLimitSeconds * 1000;

      await backend.rounds.activate(roundId);
      await backend.activities.setStatus(firstActivity.id, "live");
      await backend.sessions.setActiveActivity(sessionId, firstActivity.id);
      await backend.rounds.startQuestion({
        roundId,
        questionIndex: 0,
        startedAt,
        endsAt,
      });
      await backend.realtime.publish(sessionId, {
        type: "round_started",
        round: { ...roundToActivate, status: "live", currentQuestionIndex: 0, currentQuestionStartedAt: startedAt, currentQuestionEndsAt: endsAt },
        firstQuestion: firstActivity,
        startedAt,
        endsAt,
        serverTime: Date.now(),
      });
      refreshActivities();
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Could not activate that round.",
      );
    }
  }

  async function handleEndRoundNow() {
    if (!round.round || !round.currentQuestion) return;
    setActionError(null);
    try {
      // Score the in-progress question before ending, same as a natural
      // deadline expiry — an early end shouldn't discard answers already
      // submitted for the current question.
      if (round.currentQuestion.correctOptionId && round.round.currentQuestionStartedAt !== null) {
        await backend.scores.scoreQuestion({
          activityId: round.currentQuestion.id,
          correctOptionId: round.currentQuestion.correctOptionId,
          questionStartedAt: round.round.currentQuestionStartedAt,
          timeLimitSeconds: round.round.timeLimitSeconds,
        });
        const leaderboardResult = await backend.scores.getLeaderboard(sessionId);
        await backend.realtime.publish(sessionId, {
          type: "leaderboard_updated",
          leaderboard: leaderboardResult,
          serverTime: Date.now(),
        });
      }
      await backend.activities.setStatus(round.currentQuestion.id, "closed");
      await backend.rounds.endRound(round.round.id);
      await backend.sessions.setActiveActivity(sessionId, null);
      await backend.realtime.publish(sessionId, {
        type: "round_ended",
        roundId: round.round.id,
        serverTime: Date.now(),
      });
      refreshActivities();
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Could not end the round.",
      );
    }
  }

  async function handleActivateSurvey(surveyId: string) {
    setActionError(null);
    try {
      const questions = await backend.surveys.listQuestions(surveyId);
      const first = questions.find((q) => q.order === 0);
      if (!first) throw new Error("This survey has no questions.");
      const firstActivity = await backend.activities.getById(first.activityId);
      if (!firstActivity) throw new Error("Could not load the survey's first question.");

      await backend.surveys.activate(surveyId);
      await backend.activities.setStatus(firstActivity.id, "live");
      await backend.sessions.setActiveActivity(sessionId, firstActivity.id);
      await backend.realtime.publish(sessionId, {
        type: "activity_activated",
        activity: firstActivity,
        serverTime: Date.now(),
      });
      survey.refreshSurvey();
      refreshActivities();
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Could not activate that survey.",
      );
    }
  }

  async function handleNextSurveyQuestion() {
    if (!survey.survey || !activeActivity || survey.survey.currentQuestionIndex === null) return;
    setActionError(null);
    try {
      const currentIndex = survey.survey.currentQuestionIndex;
      const nextQuestion = survey.questions.find((q) => q.order === currentIndex + 1);

      await backend.activities.setStatus(activeActivity.id, "closed");
      await backend.realtime.publish(sessionId, {
        type: "activity_closed",
        activityId: activeActivity.id,
        serverTime: Date.now(),
      });

      if (!nextQuestion) {
        await backend.surveys.endSurvey(survey.survey.id);
        await backend.sessions.setActiveActivity(sessionId, null);
        survey.refreshSurvey();
        refreshActivities();
        return;
      }

      const nextActivity = await backend.activities.getById(nextQuestion.activityId);
      if (!nextActivity) throw new Error("Could not load the next question.");

      await backend.activities.setStatus(nextActivity.id, "live");
      await backend.sessions.setActiveActivity(sessionId, nextActivity.id);
      await backend.surveys.setCurrentQuestionIndex(survey.survey.id, currentIndex + 1);
      await backend.realtime.publish(sessionId, {
        type: "activity_activated",
        activity: nextActivity,
        serverTime: Date.now(),
      });
      survey.refreshSurvey();
      refreshActivities();
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Could not advance the survey.",
      );
    }
  }

  async function handleEndSurveyNow() {
    if (!survey.survey || !activeActivity) return;
    setActionError(null);
    try {
      await backend.activities.setStatus(activeActivity.id, "closed");
      await backend.sessions.setActiveActivity(sessionId, null);
      await backend.surveys.endSurvey(survey.survey.id);
      await backend.realtime.publish(sessionId, {
        type: "activity_closed",
        activityId: activeActivity.id,
        serverTime: Date.now(),
      });
      survey.refreshSurvey();
      refreshActivities();
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Could not end the survey.",
      );
    }
  }

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
    <div className="flex flex-1 flex-col bg-stage px-8 py-10 text-white sm:px-12 sm:py-14">
      <div className="mb-10 flex items-center justify-between">
        <span className="font-display text-[15px] font-bold tracking-[0.01em] text-stage-muted">
          Game Night
        </span>
        <div className="flex items-center gap-4">
          <span className="text-sm text-stage-muted">
            Join at {typeof window !== "undefined" ? window.location.host : ""}
            <JoinCode code={session.joinCode} className="ml-1.5 text-white" />
          </span>
          <Link
            href={`/host/${sessionId}/present`}
            target="_blank"
            className="rounded-[10px] border-[1.5px] border-white/30 px-3 py-1.5 text-sm font-medium text-white"
          >
            Open projector view
          </Link>
        </div>
      </div>

      {round.justEndedRoundId && leaderboard ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-8 py-6">
          <h1 className="font-display text-3xl font-bold sm:text-4xl">🎉 Winners 🎉</h1>
          <WinnersPodium leaderboard={leaderboard} variant="stage" />
        </div>
      ) : activeActivity?.kind === "poll" && isRoundQuestion && round.revealed && leaderboard ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-8 py-6">
          <h1 className="font-display text-3xl font-bold sm:text-4xl">Leaderboard</h1>
          <LeaderboardDisplay leaderboard={leaderboard} variant="stage" />
          <p className="text-sm text-stage-muted">Advancing automatically…</p>
        </div>
      ) : activeActivity?.kind === "poll" && isRoundQuestion ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-8 py-6">
          <div className="flex items-center gap-4">
            <h1 className="max-w-[22ch] text-center font-display text-3xl font-bold sm:text-4xl">
              {activeActivity.prompt}
            </h1>
            {round.questionEndsAt && round.serverTimeAtLastSync && (
              <CountdownBadge
                endsAt={round.questionEndsAt}
                serverTimeAtLastSync={round.serverTimeAtLastSync}
                variant="stage"
              />
            )}
          </div>
          {liveResults && "byOption" in liveResults ? (
            <PollResults results={liveResults} />
          ) : (
            <p className="text-stage-muted">Loading results…</p>
          )}
          <button
            type="button"
            onClick={handleEndRoundNow}
            className="rounded-[10px] border-[1.5px] border-white/30 px-5 py-2.75 font-medium text-white"
          >
            End round now
          </button>
        </div>
      ) : activeActivity?.kind === "poll" && isSurveyQuestion ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-8 py-6">
          <p className="text-sm text-stage-muted">
            {survey.survey?.name} — question {surveyQuestionNumber} of {survey.questions.length}
          </p>
          <h1 className="max-w-[22ch] text-center font-display text-3xl font-bold sm:text-4xl">
            {activeActivity.prompt}
          </h1>
          {liveResults && "byOption" in liveResults ? (
            <PollResults results={liveResults} />
          ) : (
            <p className="text-stage-muted">Loading results…</p>
          )}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleNextSurveyQuestion}
              className="rounded-[10px] bg-spotlight px-5 py-2.75 font-medium text-spotlight-ink"
            >
              {surveyQuestionNumber >= survey.questions.length
                ? "Finish survey"
                : "Next question"}
            </button>
            <button
              type="button"
              onClick={handleEndSurveyNow}
              className="rounded-[10px] border-[1.5px] border-white/30 px-5 py-2.75 font-medium text-white"
            >
              End survey now
            </button>
          </div>
        </div>
      ) : activeActivity?.kind === "poll" ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-8 py-6">
          <h1 className="max-w-[22ch] text-center font-display text-3xl font-bold sm:text-4xl">
            {activeActivity.prompt}
          </h1>
          {liveResults && "byOption" in liveResults ? (
            <PollResults results={liveResults} />
          ) : (
            <p className="text-stage-muted">Loading results…</p>
          )}
          <button
            type="button"
            onClick={() => handleClose(activeActivity.id)}
            className="rounded-[10px] border-[1.5px] border-white/30 px-5 py-2.75 font-medium text-white"
          >
            Close poll
          </button>
        </div>
      ) : activeActivity?.kind === "wordcloud" ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-8 py-6">
          <h1 className="max-w-[22ch] text-center font-display text-3xl font-bold sm:text-4xl">
            {activeActivity.prompt}
          </h1>
          {liveResults && "words" in liveResults ? (
            <WordCloudDisplay results={liveResults} />
          ) : (
            <p className="text-stage-muted">Loading results…</p>
          )}
          <button
            type="button"
            onClick={() => handleClose(activeActivity.id)}
            className="rounded-[10px] border-[1.5px] border-white/30 px-5 py-2.75 font-medium text-white"
          >
            Close word cloud
          </button>
        </div>
      ) : activeActivity?.kind === "qa" ? (
        <div className="flex flex-1 flex-col items-center gap-6 py-6">
          <h1 className="max-w-[22ch] text-center font-display text-3xl font-bold sm:text-4xl">
            {activeActivity.prompt}
          </h1>
          <QuestionList
            sessionId={sessionId}
            activityId={activeActivity.id}
            questions={questions}
            variant="stage"
            moderatable
          />
          <button
            type="button"
            onClick={() => handleClose(activeActivity.id)}
            className="rounded-[10px] border-[1.5px] border-white/30 px-5 py-2.75 font-medium text-white"
          >
            Close Q&amp;A
          </button>
        </div>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-8 py-6 text-center">
          <h1 className="max-w-[16ch] font-display text-3xl font-bold sm:text-4xl">
            {session.title}
          </h1>
          {joinUrl && <QRCode url={joinUrl} />}
          <p className="text-stage-muted">
            Activate an activity below once your audience has joined.
          </p>
        </div>
      )}

      <div className="mt-10 border-t border-stage-line pt-8">
        {actionError && (
          <p className="mb-4 text-sm text-ember">{actionError}</p>
        )}
        <RoundQueue
          rounds={rounds}
          hasLiveActivity={Boolean(activeActivity)}
          hasLiveRound={round.round?.status === "live"}
          onActivate={handleActivateRound}
        />
        <SurveyQueue
          surveys={surveys}
          hasLiveActivity={Boolean(activeActivity)}
          hasLiveSurvey={survey.survey?.status === "live"}
          onActivate={handleActivateSurvey}
        />
        <ActivityQueue
          activities={activities}
          hasLiveActivity={
            Boolean(activeActivity) ||
            round.round?.status === "live" ||
            survey.survey?.status === "live"
          }
          onActivate={handleActivate}
        />
        <CreatePollForm sessionId={sessionId} onCreated={refreshActivities} />
        <CreateWordCloudForm
          sessionId={sessionId}
          onCreated={refreshActivities}
        />
        <CreateQAForm sessionId={sessionId} onCreated={refreshActivities} />
        <CreateRoundForm sessionId={sessionId} onCreated={refreshActivities} />
        <CreateSurveyForm sessionId={sessionId} onCreated={refreshActivities} />
      </div>

      <div className="mt-10 flex items-center justify-between">
        <ParticipantCount count={participantCount} variant="stage" />
      </div>
    </div>
  );
}

function ActivityQueue({
  activities,
  hasLiveActivity,
  onActivate,
}: {
  activities: Activity[];
  hasLiveActivity: boolean;
  onActivate: (activityId: string) => void;
}) {
  const queued = activities.filter((activity) => activity.status === "queued");
  if (queued.length === 0) return null;

  return (
    <ul className="mb-8 flex flex-col gap-2">
      {queued.map((activity) => (
        <li
          key={activity.id}
          className="flex items-center justify-between rounded-xl border border-stage-line bg-stage-2 px-4 py-3"
        >
          <span className="text-sm text-stage-text">{activity.prompt}</span>
          <button
            type="button"
            disabled={hasLiveActivity}
            onClick={() => onActivate(activity.id)}
            className="rounded-[10px] bg-spotlight px-4 py-2 text-sm font-medium text-spotlight-ink disabled:cursor-not-allowed disabled:opacity-40"
          >
            Activate
          </button>
        </li>
      ))}
    </ul>
  );
}

function RoundQueue({
  rounds,
  hasLiveActivity,
  hasLiveRound,
  onActivate,
}: {
  rounds: Round[];
  hasLiveActivity: boolean;
  hasLiveRound: boolean;
  onActivate: (roundId: string) => void;
}) {
  const queued = rounds.filter((round) => round.status === "draft");
  if (queued.length === 0) return null;

  return (
    <ul className="mb-8 flex flex-col gap-2">
      {queued.map((round) => (
        <li
          key={round.id}
          className="flex items-center justify-between rounded-xl border border-stage-line bg-stage-2 px-4 py-3"
        >
          <span className="text-sm text-stage-text">{round.name}</span>
          <button
            type="button"
            disabled={hasLiveActivity || hasLiveRound}
            onClick={() => onActivate(round.id)}
            className="rounded-[10px] bg-spotlight px-4 py-2 text-sm font-medium text-spotlight-ink disabled:cursor-not-allowed disabled:opacity-40"
          >
            Activate round
          </button>
        </li>
      ))}
    </ul>
  );
}

function SurveyQueue({
  surveys,
  hasLiveActivity,
  hasLiveSurvey,
  onActivate,
}: {
  surveys: Survey[];
  hasLiveActivity: boolean;
  hasLiveSurvey: boolean;
  onActivate: (surveyId: string) => void;
}) {
  const queued = surveys.filter((survey) => survey.status === "draft");
  if (queued.length === 0) return null;

  return (
    <ul className="mb-8 flex flex-col gap-2">
      {queued.map((survey) => (
        <li
          key={survey.id}
          className="flex items-center justify-between rounded-xl border border-stage-line bg-stage-2 px-4 py-3"
        >
          <span className="text-sm text-stage-text">{survey.name}</span>
          <button
            type="button"
            disabled={hasLiveActivity || hasLiveSurvey}
            onClick={() => onActivate(survey.id)}
            className="rounded-[10px] bg-spotlight px-4 py-2 text-sm font-medium text-spotlight-ink disabled:cursor-not-allowed disabled:opacity-40"
          >
            Activate survey
          </button>
        </li>
      ))}
    </ul>
  );
}

function CreatePollForm({
  sessionId,
  onCreated,
}: {
  sessionId: string;
  onCreated: () => void;
}) {
  const [prompt, setPrompt] = useState("");
  const [options, setOptions] = useState(["", ""]);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateOption(index: number, value: string) {
    setOptions((prev) => prev.map((opt, i) => (i === index ? value : opt)));
  }

  function addOption() {
    setOptions((prev) => (prev.length < 6 ? [...prev, ""] : prev));
  }

  function removeOption(index: number) {
    setOptions((prev) =>
      prev.length > 2 ? prev.filter((_, i) => i !== index) : prev,
    );
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmedPrompt = prompt.trim();
    const trimmedOptions = options.map((opt) => opt.trim()).filter(Boolean);

    if (!trimmedPrompt) {
      setError("Give the poll a question.");
      return;
    }
    if (trimmedOptions.length < 2 || trimmedOptions.length > 6) {
      setError("Add between 2 and 6 options.");
      return;
    }

    setCreating(true);
    setError(null);
    try {
      await backend.activities.create({
        sessionId,
        kind: "poll",
        prompt: trimmedPrompt,
        config: { options: trimmedOptions, resultsVisibleToParticipants: true },
      });
      setPrompt("");
      setOptions(["", ""]);
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the poll.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <p className="text-sm font-medium text-stage-muted">Create a poll</p>
      <input
        value={prompt}
        onChange={(event) => setPrompt(event.target.value)}
        placeholder="What excites you most about remote work?"
        className="rounded-[10px] border-[1.5px] border-stage-line bg-stage-2 px-4 py-3 text-white outline-none placeholder:text-stage-muted focus-visible:border-spotlight focus-visible:ring-2 focus-visible:ring-spotlight/40"
      />
      <div className="flex flex-col gap-2">
        {options.map((option, index) => (
          <div key={index} className="flex gap-2">
            <input
              value={option}
              onChange={(event) => updateOption(index, event.target.value)}
              placeholder={`Option ${index + 1}`}
              className="flex-1 rounded-[10px] border-[1.5px] border-stage-line bg-stage-2 px-4 py-2.5 text-white outline-none placeholder:text-stage-muted focus-visible:border-spotlight focus-visible:ring-2 focus-visible:ring-spotlight/40"
            />
            {options.length > 2 && (
              <button
                type="button"
                onClick={() => removeOption(index)}
                aria-label={`Remove option ${index + 1}`}
                className="rounded-[10px] border-[1.5px] border-stage-line px-3 text-stage-muted"
              >
                ×
              </button>
            )}
          </div>
        ))}
      </div>
      {options.length < 6 && (
        <button
          type="button"
          onClick={addOption}
          className="self-start text-sm text-stage-muted underline"
        >
          Add option
        </button>
      )}
      {error && <p className="text-sm text-ember">{error}</p>}
      <button
        type="submit"
        disabled={creating}
        className="mt-2 self-start rounded-[10px] bg-spotlight px-5 py-2.75 font-medium text-spotlight-ink disabled:opacity-60"
      >
        {creating ? "Creating…" : "Create poll"}
      </button>
    </form>
  );
}

function CreateWordCloudForm({
  sessionId,
  onCreated,
}: {
  sessionId: string;
  onCreated: () => void;
}) {
  const [prompt, setPrompt] = useState("");
  const [maxWords, setMaxWords] = useState(1);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmedPrompt = prompt.trim();
    if (!trimmedPrompt) {
      setError("Give the word cloud a prompt.");
      return;
    }

    setCreating(true);
    setError(null);
    try {
      await backend.activities.create({
        sessionId,
        kind: "wordcloud",
        prompt: trimmedPrompt,
        config: { maxWordsPerParticipant: maxWords },
      });
      setPrompt("");
      setMaxWords(1);
      onCreated();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not create the word cloud.",
      );
    } finally {
      setCreating(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-3">
      <p className="text-sm font-medium text-stage-muted">Create a word cloud</p>
      <input
        value={prompt}
        onChange={(event) => setPrompt(event.target.value)}
        placeholder="What's one word for how this project is going?"
        className="rounded-[10px] border-[1.5px] border-stage-line bg-stage-2 px-4 py-3 text-white outline-none placeholder:text-stage-muted focus-visible:border-spotlight focus-visible:ring-2 focus-visible:ring-spotlight/40"
      />
      <label className="flex items-center gap-2 text-sm text-stage-muted">
        Words per participant
        <select
          value={maxWords}
          onChange={(event) => setMaxWords(Number(event.target.value))}
          className="rounded-[10px] border-[1.5px] border-stage-line bg-stage-2 px-2 py-1 text-white"
        >
          <option value={1}>1</option>
          <option value={2}>2</option>
          <option value={3}>3</option>
        </select>
      </label>
      {error && <p className="text-sm text-ember">{error}</p>}
      <button
        type="submit"
        disabled={creating}
        className="mt-2 self-start rounded-[10px] bg-spotlight px-5 py-2.75 font-medium text-spotlight-ink disabled:opacity-60"
      >
        {creating ? "Creating…" : "Create word cloud"}
      </button>
    </form>
  );
}

function CreateQAForm({
  sessionId,
  onCreated,
}: {
  sessionId: string;
  onCreated: () => void;
}) {
  const [prompt, setPrompt] = useState("Ask us anything");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmedPrompt = prompt.trim();
    if (!trimmedPrompt) {
      setError("Give the Q&A a prompt.");
      return;
    }

    setCreating(true);
    setError(null);
    try {
      await backend.activities.create({
        sessionId,
        kind: "qa",
        prompt: trimmedPrompt,
        config: { allowAnonymous: true },
      });
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the Q&A.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-3">
      <p className="text-sm font-medium text-stage-muted">Create a Q&amp;A</p>
      <input
        value={prompt}
        onChange={(event) => setPrompt(event.target.value)}
        placeholder="Ask us anything"
        className="rounded-[10px] border-[1.5px] border-stage-line bg-stage-2 px-4 py-3 text-white outline-none placeholder:text-stage-muted focus-visible:border-spotlight focus-visible:ring-2 focus-visible:ring-spotlight/40"
      />
      {error && <p className="text-sm text-ember">{error}</p>}
      <button
        type="submit"
        disabled={creating}
        className="mt-2 self-start rounded-[10px] bg-spotlight px-5 py-2.75 font-medium text-spotlight-ink disabled:opacity-60"
      >
        {creating ? "Creating…" : "Create Q&A"}
      </button>
    </form>
  );
}

function CreateRoundForm({
  sessionId,
  onCreated,
}: {
  sessionId: string;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [timeLimitSeconds, setTimeLimitSeconds] = useState(20);
  const [questionDrafts, setQuestionDrafts] = useState<RoundQuestionDraft[]>([
    { prompt: "", options: ["", ""], correctOptionIndex: 0 },
  ]);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateQuestion(index: number, patch: Partial<RoundQuestionDraft>) {
    setQuestionDrafts((prev) =>
      prev.map((q, i) => (i === index ? { ...q, ...patch } : q)),
    );
  }

  function updateQuestionOption(qIndex: number, oIndex: number, value: string) {
    setQuestionDrafts((prev) =>
      prev.map((q, i) =>
        i === qIndex
          ? { ...q, options: q.options.map((opt, j) => (j === oIndex ? value : opt)) }
          : q,
      ),
    );
  }

  function addQuestionOption(qIndex: number) {
    setQuestionDrafts((prev) =>
      prev.map((q, i) =>
        i === qIndex && q.options.length < 6 ? { ...q, options: [...q.options, ""] } : q,
      ),
    );
  }

  function removeQuestionOption(qIndex: number, oIndex: number) {
    setQuestionDrafts((prev) =>
      prev.map((q, i) => {
        if (i !== qIndex || q.options.length <= 2) return q;
        const options = q.options.filter((_, j) => j !== oIndex);
        const correctOptionIndex =
          q.correctOptionIndex === oIndex
            ? 0
            : q.correctOptionIndex > oIndex
              ? q.correctOptionIndex - 1
              : q.correctOptionIndex;
        return { ...q, options, correctOptionIndex };
      }),
    );
  }

  function addQuestion() {
    setQuestionDrafts((prev) => [
      ...prev,
      { prompt: "", options: ["", ""], correctOptionIndex: 0 },
    ]);
  }

  function removeQuestion(index: number) {
    setQuestionDrafts((prev) =>
      prev.length > 1 ? prev.filter((_, i) => i !== index) : prev,
    );
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    const validation = validateRoundDraft({ name, timeLimitSeconds, questions: questionDrafts });
    if (!validation.valid) {
      setError(validation.error ?? "Check the round before creating it.");
      return;
    }

    setCreating(true);
    setError(null);
    try {
      await backend.rounds.create({
        sessionId,
        name: name.trim(),
        timeLimitSeconds,
        questions: questionDrafts.map((q) => ({
          prompt: q.prompt.trim(),
          options: q.options.map((opt) => opt.trim()).filter(Boolean),
          correctOptionIndex: q.correctOptionIndex,
        })),
      });
      setName("");
      setTimeLimitSeconds(20);
      setQuestionDrafts([{ prompt: "", options: ["", ""], correctOptionIndex: 0 }]);
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the round.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-4 border-t border-stage-line pt-8">
      <p className="text-sm font-medium text-stage-muted">Create a round (Fastest Finger)</p>
      <input
        value={name}
        onChange={(event) => setName(event.target.value)}
        placeholder="Round name"
        className="rounded-[10px] border-[1.5px] border-stage-line bg-stage-2 px-4 py-3 text-white outline-none placeholder:text-stage-muted focus-visible:border-spotlight focus-visible:ring-2 focus-visible:ring-spotlight/40"
      />
      <label className="flex items-center gap-2 text-sm text-stage-muted">
        Time limit per question (seconds)
        <input
          type="number"
          min={5}
          max={120}
          value={timeLimitSeconds}
          onChange={(event) => setTimeLimitSeconds(Number(event.target.value))}
          className="w-20 rounded-[10px] border-[1.5px] border-stage-line bg-stage-2 px-2 py-1 text-white"
        />
      </label>

      <div className="flex flex-col gap-4">
        {questionDrafts.map((question, qIndex) => (
          <div
            key={qIndex}
            className="flex flex-col gap-2 rounded-xl border border-stage-line bg-stage-2 p-4"
          >
            <div className="flex items-center gap-2">
              <input
                value={question.prompt}
                onChange={(event) => updateQuestion(qIndex, { prompt: event.target.value })}
                placeholder={`Question ${qIndex + 1}`}
                className="flex-1 rounded-[10px] border-[1.5px] border-stage-line bg-stage px-4 py-2.5 text-white outline-none placeholder:text-stage-muted focus-visible:border-spotlight focus-visible:ring-2 focus-visible:ring-spotlight/40"
              />
              {questionDrafts.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeQuestion(qIndex)}
                  aria-label={`Remove question ${qIndex + 1}`}
                  className="rounded-[10px] border-[1.5px] border-stage-line px-3 text-stage-muted"
                >
                  ×
                </button>
              )}
            </div>
            <div className="flex flex-col gap-2">
              {question.options.map((option, oIndex) => (
                <div key={oIndex} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name={`correct-${qIndex}`}
                    checked={question.correctOptionIndex === oIndex}
                    onChange={() => updateQuestion(qIndex, { correctOptionIndex: oIndex })}
                    aria-label={`Mark option ${oIndex + 1} as correct`}
                    className="accent-success"
                  />
                  <input
                    value={option}
                    onChange={(event) => updateQuestionOption(qIndex, oIndex, event.target.value)}
                    placeholder={`Option ${oIndex + 1}`}
                    className="flex-1 rounded-[10px] border-[1.5px] border-stage-line bg-stage px-4 py-2 text-white outline-none placeholder:text-stage-muted focus-visible:border-spotlight focus-visible:ring-2 focus-visible:ring-spotlight/40"
                  />
                  {question.options.length > 2 && (
                    <button
                      type="button"
                      onClick={() => removeQuestionOption(qIndex, oIndex)}
                      aria-label={`Remove option ${oIndex + 1}`}
                      className="rounded-[10px] border-[1.5px] border-stage-line px-3 text-stage-muted"
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
            </div>
            {question.options.length < 6 && (
              <button
                type="button"
                onClick={() => addQuestionOption(qIndex)}
                className="self-start text-sm text-stage-muted underline"
              >
                Add option
              </button>
            )}
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={addQuestion}
        className="self-start text-sm text-stage-muted underline"
      >
        Add question
      </button>

      {error && <p className="text-sm text-ember">{error}</p>}
      <button
        type="submit"
        disabled={creating}
        className="mt-2 self-start rounded-[10px] bg-spotlight px-5 py-2.75 font-medium text-spotlight-ink disabled:opacity-60"
      >
        {creating ? "Creating…" : "Create round"}
      </button>
    </form>
  );
}

function CreateSurveyForm({
  sessionId,
  onCreated,
}: {
  sessionId: string;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [questionDrafts, setQuestionDrafts] = useState<SurveyQuestionDraft[]>([
    { prompt: "", options: ["", ""] },
  ]);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateQuestionPrompt(index: number, prompt: string) {
    setQuestionDrafts((prev) => prev.map((q, i) => (i === index ? { ...q, prompt } : q)));
  }

  function updateQuestionOption(qIndex: number, oIndex: number, value: string) {
    setQuestionDrafts((prev) =>
      prev.map((q, i) =>
        i === qIndex
          ? { ...q, options: q.options.map((opt, j) => (j === oIndex ? value : opt)) }
          : q,
      ),
    );
  }

  function addQuestionOption(qIndex: number) {
    setQuestionDrafts((prev) =>
      prev.map((q, i) =>
        i === qIndex && q.options.length < 6 ? { ...q, options: [...q.options, ""] } : q,
      ),
    );
  }

  function removeQuestionOption(qIndex: number, oIndex: number) {
    setQuestionDrafts((prev) =>
      prev.map((q, i) =>
        i === qIndex && q.options.length > 2
          ? { ...q, options: q.options.filter((_, j) => j !== oIndex) }
          : q,
      ),
    );
  }

  function addQuestion() {
    setQuestionDrafts((prev) => [...prev, { prompt: "", options: ["", ""] }]);
  }

  function removeQuestion(index: number) {
    setQuestionDrafts((prev) =>
      prev.length > 1 ? prev.filter((_, i) => i !== index) : prev,
    );
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    const validation = validateSurveyDraft({ name, questions: questionDrafts });
    if (!validation.valid) {
      setError(validation.error ?? "Check the survey before creating it.");
      return;
    }

    setCreating(true);
    setError(null);
    try {
      await backend.surveys.create({
        sessionId,
        name: name.trim(),
        questions: questionDrafts.map((q) => ({
          prompt: q.prompt.trim(),
          options: q.options.map((opt) => opt.trim()).filter(Boolean),
        })),
      });
      setName("");
      setQuestionDrafts([{ prompt: "", options: ["", ""] }]);
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the survey.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-4 border-t border-stage-line pt-8">
      <p className="text-sm font-medium text-stage-muted">
        Create a survey (bundled feedback polls)
      </p>
      <input
        value={name}
        onChange={(event) => setName(event.target.value)}
        placeholder="Survey name"
        className="rounded-[10px] border-[1.5px] border-stage-line bg-stage-2 px-4 py-3 text-white outline-none placeholder:text-stage-muted focus-visible:border-spotlight focus-visible:ring-2 focus-visible:ring-spotlight/40"
      />

      <div className="flex flex-col gap-4">
        {questionDrafts.map((question, qIndex) => (
          <div
            key={qIndex}
            className="flex flex-col gap-2 rounded-xl border border-stage-line bg-stage-2 p-4"
          >
            <div className="flex items-center gap-2">
              <input
                value={question.prompt}
                onChange={(event) => updateQuestionPrompt(qIndex, event.target.value)}
                placeholder={`Question ${qIndex + 1}`}
                className="flex-1 rounded-[10px] border-[1.5px] border-stage-line bg-stage px-4 py-2.5 text-white outline-none placeholder:text-stage-muted focus-visible:border-spotlight focus-visible:ring-2 focus-visible:ring-spotlight/40"
              />
              {questionDrafts.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeQuestion(qIndex)}
                  aria-label={`Remove question ${qIndex + 1}`}
                  className="rounded-[10px] border-[1.5px] border-stage-line px-3 text-stage-muted"
                >
                  ×
                </button>
              )}
            </div>
            <div className="flex flex-col gap-2">
              {question.options.map((option, oIndex) => (
                <div key={oIndex} className="flex items-center gap-2">
                  <input
                    value={option}
                    onChange={(event) => updateQuestionOption(qIndex, oIndex, event.target.value)}
                    placeholder={`Option ${oIndex + 1}`}
                    className="flex-1 rounded-[10px] border-[1.5px] border-stage-line bg-stage px-4 py-2 text-white outline-none placeholder:text-stage-muted focus-visible:border-spotlight focus-visible:ring-2 focus-visible:ring-spotlight/40"
                  />
                  {question.options.length > 2 && (
                    <button
                      type="button"
                      onClick={() => removeQuestionOption(qIndex, oIndex)}
                      aria-label={`Remove option ${oIndex + 1}`}
                      className="rounded-[10px] border-[1.5px] border-stage-line px-3 text-stage-muted"
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
            </div>
            {question.options.length < 6 && (
              <button
                type="button"
                onClick={() => addQuestionOption(qIndex)}
                className="self-start text-sm text-stage-muted underline"
              >
                Add option
              </button>
            )}
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={addQuestion}
        className="self-start text-sm text-stage-muted underline"
      >
        Add question
      </button>

      {error && <p className="text-sm text-ember">{error}</p>}
      <button
        type="submit"
        disabled={creating}
        className="mt-2 self-start rounded-[10px] bg-spotlight px-5 py-2.75 font-medium text-spotlight-ink disabled:opacity-60"
      >
        {creating ? "Creating…" : "Create survey"}
      </button>
    </form>
  );
}
