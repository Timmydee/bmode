"use client";

import Link from "next/link";
import { use, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { backend } from "@/lib/backend";
import type { Activity, AudienceQuestion, Circle, CircleVibe, Round, RoundQuestion, Survey } from "@/lib/backend";
import { useSession } from "@/lib/hooks/useSession";
import { useActiveActivity } from "@/lib/hooks/useActiveActivity";
import { useLiveResults } from "@/lib/hooks/useLiveResults";
import { useRound } from "@/lib/hooks/useRound";
import { useCountdown } from "@/lib/hooks/useCountdown";
import { useLeaderboard } from "@/lib/hooks/useLeaderboard";
import { useSurvey } from "@/lib/hooks/useSurvey";
import { useCircle } from "@/lib/hooks/useCircle";
import { useCircleAutoReveal } from "@/lib/hooks/useCircleAutoReveal";
import { useParticipant } from "@/lib/hooks/useParticipant";
import { startCircle } from "@/lib/circle/actions";
import CircleHostView from "@/components/circle/CircleHostView";
import CircleHostControls from "@/components/circle/CircleHostControls";
import CirclePlayerView from "@/components/circle/CirclePlayerView";
import CreateCircleForm from "@/components/circle/CreateCircleForm";
import { CIRCLE_DEPTH_LABELS, CIRCLE_VIBES } from "@/lib/game/circle";
import {
  validateNickname,
  validateRoundDraft,
  validateRoundQuestionDraft,
  validateSurveyDraft,
  validateSurveyQuestionDraft,
  type RoundQuestionDraft,
  type SurveyQuestionDraft,
} from "@/lib/game/validation";
import JoinCode from "@/components/shared/JoinCode";
import QRCodeButton from "@/components/shared/QRCodeButton";
import ParticipantCount from "@/components/shared/ParticipantCount";
import PollResults from "@/components/poll/PollResults";
import WordCloudDisplay from "@/components/wordcloud/WordCloudDisplay";
import QuestionList from "@/components/qa/QuestionList";
import CountdownBadge from "@/components/round/CountdownBadge";
import LeaderboardDisplay from "@/components/round/LeaderboardDisplay";
import WinnersPodium from "@/components/round/WinnersPodium";
import Icon from "@/components/shared/Icon";

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
  questions: RoundQuestion[];
}): Promise<void> {
  const { sessionId, round, currentQuestion, questions } = input;
  // Both should always be present by the time a question's timer expires
  // — if either is missing, something upstream failed to populate the
  // round question correctly (a real bug, not an expected state). Throw
  // instead of silently returning: a silent no-op here means the round
  // stalls forever on this question with no visible error, which is
  // exactly the failure mode this guard used to hide.
  if (!currentQuestion.correctOptionId) {
    throw new Error(
      "This question is missing its correct answer — the round can't auto-advance. Try 'End round now'.",
    );
  }
  if (round.currentQuestionStartedAt === null) {
    throw new Error(
      "This round has no recorded start time for the current question — it can't auto-advance. Try 'End round now'.",
    );
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

  const nextActivity = await backend.rounds.getQuestionActivity(nextQuestionMeta);
  if (!nextActivity) return;

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
  const startVibe = parseVibe(use(props.searchParams).vibe);

  // "Host and play": the host can join their own Circle as a player from
  // this page (same browser token as /join), with the host controls in a
  // bar on top of their player screen. "watch" keeps the big-screen view.
  const hostPlayer = useParticipant(sessionId);
  const [hostMode, setHostModeState] = useState<HostMode | null>(() => readHostMode(sessionId));
  function setHostMode(mode: HostMode | null) {
    setHostModeState(mode);
    writeHostMode(sessionId, mode);
  }
  const hostPlays = hostMode !== "watch" && Boolean(hostPlayer.participant);

  const { session, participantCount, loading } = useSession(
    sessionId,
    hostPlays && hostPlayer.participant ? hostPlayer.participant.id : `host:${sessionId}`,
    { publishCount: true },
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
  const [circles, setCircles] = useState<Circle[]>([]);
  const circleGame = useCircle(sessionId);
  // A closed Circle stays in circleGame.state so players keep their recap,
  // but for the host it's over: the session goes back to the control room.
  const circleRunning = Boolean(circleGame.state && circleGame.state.circle.status !== "ended");
  const autoRevealError = useCircleAutoReveal(sessionId, circleGame.state, participantCount);
  const [refreshKey, setRefreshKey] = useState(0);
  useEffect(() => {
    if (!sessionId) return;
    backend.activities.listBySession(sessionId).then(setActivities);
    backend.rounds.listBySession(sessionId).then(setRounds);
    backend.surveys.listBySession(sessionId).then(setSurveys);
    backend.circles.listBySession(sessionId).then(setCircles);
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
      const firstActivity = await backend.rounds.getQuestionActivity(first);
      if (!firstActivity) {
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

  async function handleActivateCircle(circle: Circle) {
    setActionError(null);
    try {
      await startCircle(sessionId, circle);
      circleGame.refresh();
      refreshActivities();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Could not start that Circle.");
    }
  }

  async function handleActivateSurvey(surveyId: string) {
    setActionError(null);
    try {
      const questions = await backend.surveys.listQuestions(surveyId);
      const first = questions.find((q) => q.order === 0);
      if (!first) throw new Error("This survey has no questions.");
      const firstActivity = await backend.surveys.getQuestionActivity(first);
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

      const nextActivity = await backend.surveys.getQuestionActivity(nextQuestion);
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

  if (circleRunning && circleGame.state && hostPlays && hostPlayer.participant) {
    return (
      <div className="flex flex-1 flex-col bg-paper">
        <div className="sticky top-0 z-40 flex flex-col gap-2 bg-rail px-4 py-3 text-white shadow-[0_1px_0_rgb(0_0_0/30%)]">
          <div className="flex items-center justify-between gap-3 text-xs text-stage-muted">
            <span>
              You’re hosting · code
              <JoinCode code={session.joinCode} className="ml-1.5 text-white" />
            </span>
            <button type="button" onClick={() => setHostMode("watch")} className="underline">
              Big screen view
            </button>
          </div>
          <CircleHostControls
            sessionId={sessionId}
            hostId={session.hostId}
            state={circleGame.state}
            participantCount={participantCount}
            onChanged={() => {
              circleGame.refresh();
              refreshActivities();
            }}
            variant="bar"
          />
          {autoRevealError && <p className="text-sm text-ember">{autoRevealError}</p>}
        </div>
        <CirclePlayerView
          sessionId={sessionId}
          participantId={hostPlayer.participant.id}
          state={circleGame.state}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col bg-stage px-5 py-8 text-white sm:px-12 sm:py-14">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 sm:mb-10">
        <span className="font-display text-[15px] font-bold tracking-[0.01em] text-stage-muted">
          Bmode
        </span>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <span className="text-sm whitespace-nowrap text-stage-muted">
            Code
            <JoinCode code={session.joinCode} className="ml-1.5 text-white" copyable />
          </span>
          <QRCodeButton url={joinUrl} code={session.joinCode} />
          <Link
            href={`/host/${sessionId}/present`}
            target="_blank"
            className="rounded-[10px] border-[1.5px] border-white/30 px-3 py-1.5 text-sm font-medium whitespace-nowrap text-white"
          >
            Big screen
          </Link>
        </div>
      </div>

      {circleRunning && circleGame.state && !hostPlayer.loading && !hostPlayer.participant && hostMode === null ? (
        <HostPlayPrompt
          circleName={circleGame.state.circle.name}
          onPlay={async (nickname) => {
            await hostPlayer.join(nickname);
            setHostMode("play");
          }}
          onWatch={() => setHostMode("watch")}
        />
      ) : circleRunning && circleGame.state ? (
        <>
          <CircleHostView
            sessionId={sessionId}
            hostId={session.hostId}
            joinCode={session.joinCode}
            state={circleGame.state}
            participantCount={participantCount}
            onChanged={() => {
              circleGame.refresh();
              refreshActivities();
            }}
            onPlay={() => setHostMode(hostPlayer.participant ? "play" : null)}
          />
          {autoRevealError && <p className="text-center text-sm text-ember">{autoRevealError}</p>}
        </>
      ) : round.justEndedRoundId && leaderboard ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-8 py-6">
          <h1 className="inline-flex items-center gap-3 font-display text-3xl font-bold sm:text-4xl">
            <Icon name="trophy" className="h-[0.9em] w-[0.9em] text-gold" />
            Winners
          </h1>
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
          <HostActionButton onClick={handleEndRoundNow} variant="secondary">
            End round now
          </HostActionButton>
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
            <HostActionButton onClick={handleNextSurveyQuestion} variant="primary">
              {surveyQuestionNumber >= survey.questions.length
                ? "Finish survey"
                : "Next question"}
            </HostActionButton>
            <HostActionButton onClick={handleEndSurveyNow} variant="secondary">
              End survey now
            </HostActionButton>
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
          <HostActionButton onClick={() => handleClose(activeActivity.id)}>
            Close poll
          </HostActionButton>
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
          <HostActionButton onClick={() => handleClose(activeActivity.id)}>
            Close word cloud
          </HostActionButton>
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
          <HostActionButton onClick={() => handleClose(activeActivity.id)}>
            Close Q&amp;A
          </HostActionButton>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <h1 className="font-display text-3xl font-bold sm:text-4xl">{session.title}</h1>
          <p className="text-stage-muted">
            Pick an activity below once your audience has joined.
          </p>
        </div>
      )}

      {/* The other tools stay out of the way while a Circle is on. */}
      <div className={`mt-10 border-t border-stage-line pt-8 ${circleRunning ? "hidden" : ""}`}>
        {actionError && (
          <p className="mb-4 text-sm text-ember">{actionError}</p>
        )}
        <CircleQueue
          circles={circles}
          disabled={
            Boolean(activeActivity) ||
            circleRunning ||
            round.round?.status === "live" ||
            survey.survey?.status === "live"
          }
          onActivate={handleActivateCircle}
        />
        <RoundQueue
          rounds={rounds}
          hasLiveActivity={Boolean(activeActivity) || circleRunning}
          hasLiveRound={round.round?.status === "live"}
          onActivate={handleActivateRound}
        />
        <SurveyQueue
          surveys={surveys}
          hasLiveActivity={Boolean(activeActivity) || circleRunning}
          hasLiveSurvey={survey.survey?.status === "live"}
          onActivate={handleActivateSurvey}
        />
        <ActivityQueue
          activities={activities}
          hasLiveActivity={
            Boolean(activeActivity) ||
            circleRunning ||
            round.round?.status === "live" ||
            survey.survey?.status === "live"
          }
          onActivate={handleActivate}
        />
        <CreateActivitySection sessionId={sessionId} startVibe={startVibe} onCreated={refreshActivities} />
      </div>

      <div className="mt-10 flex items-center justify-between">
        <ParticipantCount count={participantCount} variant="stage" />
      </div>
    </div>
  );
}

type HostMode = "play" | "watch";

function parseVibe(value: string | string[] | undefined): CircleVibe | null {
  return typeof value === "string" && Object.keys(CIRCLE_VIBES).includes(value) ? (value as CircleVibe) : null;
}

function hostModeKey(sessionId: string): string {
  return `bmode:host-mode:${sessionId}`;
}

// Remembered per browser so a refresh doesn't ask again. Storage can be
// unavailable (private mode, blocked site data); asking again is fine then.
function readHostMode(sessionId: string): HostMode | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = window.localStorage.getItem(hostModeKey(sessionId));
    return stored === "play" || stored === "watch" ? stored : null;
  } catch {
    return null;
  }
}

function writeHostMode(sessionId: string, mode: HostMode | null): void {
  try {
    if (mode) window.localStorage.setItem(hostModeKey(sessionId), mode);
    else window.localStorage.removeItem(hostModeKey(sessionId));
  } catch {
    // Not remembered; the host is just asked again after a refresh.
  }
}

// Shown once when a Circle starts: most hosts of a friends' or couples'
// game are also playing, so that's the main path, with the big-screen
// view one tap away.
function HostPlayPrompt({
  circleName,
  onPlay,
  onWatch,
}: {
  circleName: string;
  onPlay: (nickname: string | null) => Promise<void>;
  onWatch: () => void;
}) {
  const [nickname, setNickname] = useState("");
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmed = nickname.trim();
    if (trimmed) {
      const result = validateNickname(trimmed);
      if (!result.valid) {
        setError(result.error ?? "That name isn't allowed.");
        return;
      }
    }
    setJoining(true);
    setError(null);
    try {
      await onPlay(trimmed || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not join the game.");
      setJoining(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-4 py-6"
    >
      <p className="text-sm text-stage-muted">{circleName} has started</p>
      <h1 className="font-display text-3xl font-bold">Are you playing too?</h1>
      <p className="text-stage-muted">
        Play from this phone and you’ll get the host controls in a bar at the top.
      </p>
      <input
        value={nickname}
        onChange={(event) => setNickname(event.target.value)}
        placeholder="Your name"
        maxLength={24}
        autoFocus
        className="rounded-[10px] border-[1.5px] border-stage-line bg-stage-2 px-4 py-3 text-white outline-none placeholder:text-stage-muted focus-visible:border-spotlight focus-visible:ring-2 focus-visible:ring-spotlight/40"
      />
      {error && <p className="text-sm text-ember">{error}</p>}
      <button
        type="submit"
        disabled={joining}
        className="rounded-[10px] bg-spotlight px-5 py-2.75 font-medium text-spotlight-ink disabled:opacity-60"
      >
        {joining ? "Joining…" : "Play and host"}
      </button>
      <button
        type="button"
        onClick={onWatch}
        className="rounded-[10px] border-[1.5px] border-white/30 px-5 py-2.75 font-medium text-white"
      >
        Just host (show the big screen)
      </button>
    </form>
  );
}

// One consistent style for "move the session forward" actions across
// every activity type, instead of the prior mix of filled-vs-outlined
// buttons for what is conceptually the same action. `primary` (filled
// spotlight) is the definitive next step for the current screen;
// `secondary` (outlined) is an escape hatch alongside it. The label is
// always supplied by the caller so it can keep naming the precise next
// step (e.g. "Next question" vs. "Finish survey").
function HostActionButton({
  onClick,
  variant = "primary",
  children,
}: {
  onClick: () => void;
  variant?: "primary" | "secondary";
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        variant === "primary"
          ? "rounded-[10px] bg-spotlight px-5 py-2.75 font-medium text-spotlight-ink outline-none transition-colors focus-visible:ring-2 focus-visible:ring-spotlight/60"
          : "rounded-[10px] border-[1.5px] border-white/30 px-5 py-2.75 font-medium text-white outline-none transition-colors focus-visible:ring-2 focus-visible:ring-white/60"
      }
    >
      {children}
    </button>
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

function CircleQueue({
  circles,
  disabled,
  onActivate,
}: {
  circles: Circle[];
  disabled: boolean;
  onActivate: (circle: Circle) => void;
}) {
  const queued = circles.filter((circle) => circle.status === "draft");
  if (queued.length === 0) return null;

  return (
    <ul className="mb-8 flex flex-col gap-2">
      {queued.map((circle) => (
        <CircleQueueItem key={circle.id} circle={circle} disabled={disabled} onActivate={onActivate} />
      ))}
    </ul>
  );
}

function CircleQueueItem({
  circle,
  disabled,
  onActivate,
}: {
  circle: Circle;
  disabled: boolean;
  onActivate: (circle: Circle) => void;
}) {
  const [showQuestions, setShowQuestions] = useState(false);
  const planned = circle.settings.questions;

  return (
    <li className="rounded-xl border border-stage-line bg-stage-2 px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-stage-text">
          {circle.name}
          <span className="ml-2 text-stage-muted">
            {circle.settings.questionCount} questions ·{" "}
            {circle.settings.rewardStyle === "together" ? "Together" : "Competitive"}
          </span>
        </span>
        <div className="flex shrink-0 items-center gap-3">
          {planned.length > 0 && (
            <button
              type="button"
              onClick={() => setShowQuestions((open) => !open)}
              aria-expanded={showQuestions}
              className="text-sm text-stage-muted underline"
            >
              {showQuestions ? "Hide questions" : "See questions"}
            </button>
          )}
          <button
            type="button"
            disabled={disabled}
            onClick={() => onActivate(circle)}
            className="rounded-[10px] bg-spotlight px-4 py-2 text-sm font-medium text-spotlight-ink disabled:cursor-not-allowed disabled:opacity-40"
          >
            Start Circle
          </button>
        </div>
      </div>
      {showQuestions && (
        <ol className="mt-3 flex list-decimal flex-col gap-1 pl-6 text-sm text-stage-text">
          {planned.map((question) => (
            <li key={question.text}>
              {question.text}
              <span className="ml-2 text-xs text-stage-muted">{CIRCLE_DEPTH_LABELS[question.depth]}</span>
            </li>
          ))}
        </ol>
      )}
    </li>
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

type ActivityCreationKind = "circle" | "poll" | "wordcloud" | "qa" | "round" | "survey";

const ACTIVITY_CREATION_KINDS: { kind: ActivityCreationKind; label: string }[] = [
  { kind: "circle", label: "Circle" },
  { kind: "poll", label: "Poll" },
  { kind: "wordcloud", label: "Word cloud" },
  { kind: "qa", label: "Q&A" },
  { kind: "round", label: "Round" },
  { kind: "survey", label: "Survey" },
];

// Replaces the old always-visible stack of all 5 create-forms: pick a
// type, fill in just that one form, submit collapses back to the picker.
// Each form keeps mounting/unmounting on selection rather than being
// hidden via CSS, so switching types always starts from a clean, empty
// form instead of leftover state bleeding between types.
function CreateActivitySection({
  sessionId,
  startVibe,
  onCreated,
}: {
  sessionId: string;
  // Set when the host came from a deck on the landing page: open straight
  // on a Circle with that deck's vibe.
  startVibe: CircleVibe | null;
  onCreated: () => void;
}) {
  const [creatingKind, setCreatingKind] = useState<ActivityCreationKind | null>(startVibe ? "circle" : null);

  function handleCreated() {
    onCreated();
    setCreatingKind(null);
  }

  return (
    <div className="mt-8 flex flex-col gap-4 border-t border-stage-line pt-8 first:mt-0 first:border-t-0 first:pt-0">
      <p className="text-sm font-medium text-stage-muted">Add an activity</p>
      <div className="flex flex-wrap gap-2">
        {ACTIVITY_CREATION_KINDS.map(({ kind, label }) => (
          <TypeChip
            key={kind}
            label={label}
            selected={creatingKind === kind}
            onClick={() => setCreatingKind((current) => (current === kind ? null : kind))}
          />
        ))}
      </div>
      {creatingKind === "circle" && (
        <CreateCircleForm sessionId={sessionId} initialVibe={startVibe ?? undefined} onCreated={handleCreated} />
      )}
      {creatingKind === "poll" && (
        <CreatePollForm sessionId={sessionId} onCreated={handleCreated} />
      )}
      {creatingKind === "wordcloud" && (
        <CreateWordCloudForm sessionId={sessionId} onCreated={handleCreated} />
      )}
      {creatingKind === "qa" && (
        <CreateQAForm sessionId={sessionId} onCreated={handleCreated} />
      )}
      {creatingKind === "round" && (
        <CreateRoundForm sessionId={sessionId} onCreated={handleCreated} />
      )}
      {creatingKind === "survey" && (
        <CreateSurveyForm sessionId={sessionId} onCreated={handleCreated} />
      )}
    </div>
  );
}

function TypeChip({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`rounded-[10px] px-4 py-2 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-spotlight/60 ${
        selected
          ? "bg-spotlight text-spotlight-ink"
          : "border-[1.5px] border-stage-line text-stage-text"
      }`}
    >
      {label}
    </button>
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
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
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
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
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
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
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
    setQuestionDrafts((prev) => {
      const next = [...prev, { prompt: "", options: ["", ""], correctOptionIndex: 0 }];
      setCurrentQuestionIndex(next.length - 1);
      return next;
    });
    setError(null);
  }

  function removeQuestion(index: number) {
    setQuestionDrafts((prev) => {
      if (prev.length <= 1) return prev;
      const next = prev.filter((_, i) => i !== index);
      setCurrentQuestionIndex((current) => Math.min(current, next.length - 1));
      return next;
    });
  }

  function goToQuestion(index: number) {
    setError(null);
    setCurrentQuestionIndex(index);
  }

  function handleNext() {
    const result = validateRoundQuestionDraft(
      questionDrafts[currentQuestionIndex],
      currentQuestionIndex + 1,
    );
    if (!result.valid) {
      setError(result.error ?? "Check this question before moving on.");
      return;
    }
    goToQuestion(currentQuestionIndex + 1);
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
      setCurrentQuestionIndex(0);
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the round.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
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

      <div className="flex items-center justify-between text-sm text-stage-muted">
        <span>
          Question {currentQuestionIndex + 1} of {questionDrafts.length}
        </span>
        {questionDrafts.length > 1 && (
          <button
            type="button"
            onClick={() => removeQuestion(currentQuestionIndex)}
            className="text-sm text-stage-muted underline"
          >
            Remove this question
          </button>
        )}
      </div>

      <div className="flex flex-col gap-2 rounded-xl border border-stage-line bg-stage-2 p-4">
        <input
          value={questionDrafts[currentQuestionIndex].prompt}
          onChange={(event) =>
            updateQuestion(currentQuestionIndex, { prompt: event.target.value })
          }
          placeholder={`Question ${currentQuestionIndex + 1}`}
          className="flex-1 rounded-[10px] border-[1.5px] border-stage-line bg-stage px-4 py-2.5 text-white outline-none placeholder:text-stage-muted focus-visible:border-spotlight focus-visible:ring-2 focus-visible:ring-spotlight/40"
        />
        <div className="flex flex-col gap-2">
          {questionDrafts[currentQuestionIndex].options.map((option, oIndex) => (
            <div key={oIndex} className="flex items-center gap-2">
              <input
                type="radio"
                name={`correct-${currentQuestionIndex}`}
                checked={questionDrafts[currentQuestionIndex].correctOptionIndex === oIndex}
                onChange={() =>
                  updateQuestion(currentQuestionIndex, { correctOptionIndex: oIndex })
                }
                aria-label={`Mark option ${oIndex + 1} as correct`}
                className="accent-success"
              />
              <input
                value={option}
                onChange={(event) =>
                  updateQuestionOption(currentQuestionIndex, oIndex, event.target.value)
                }
                placeholder={`Option ${oIndex + 1}`}
                className="flex-1 rounded-[10px] border-[1.5px] border-stage-line bg-stage px-4 py-2 text-white outline-none placeholder:text-stage-muted focus-visible:border-spotlight focus-visible:ring-2 focus-visible:ring-spotlight/40"
              />
              {questionDrafts[currentQuestionIndex].options.length > 2 && (
                <button
                  type="button"
                  onClick={() => removeQuestionOption(currentQuestionIndex, oIndex)}
                  aria-label={`Remove option ${oIndex + 1}`}
                  className="rounded-[10px] border-[1.5px] border-stage-line px-3 text-stage-muted"
                >
                  ×
                </button>
              )}
            </div>
          ))}
        </div>
        {questionDrafts[currentQuestionIndex].options.length < 6 && (
          <button
            type="button"
            onClick={() => addQuestionOption(currentQuestionIndex)}
            className="self-start text-sm text-stage-muted underline"
          >
            Add option
          </button>
        )}
      </div>

      {error && <p className="text-sm text-ember">{error}</p>}

      <div className="flex flex-wrap items-center gap-3">
        {currentQuestionIndex > 0 && (
          <HostActionButton
            onClick={() => goToQuestion(currentQuestionIndex - 1)}
            variant="secondary"
          >
            Back
          </HostActionButton>
        )}
        {currentQuestionIndex < questionDrafts.length - 1 ? (
          <HostActionButton onClick={handleNext} variant="primary">
            Next
          </HostActionButton>
        ) : (
          <HostActionButton onClick={addQuestion} variant="secondary">
            Add question
          </HostActionButton>
        )}
        <button
          type="submit"
          disabled={creating}
          className="rounded-[10px] bg-spotlight px-5 py-2.75 font-medium text-spotlight-ink disabled:opacity-60"
        >
          {creating ? "Creating…" : "Create round"}
        </button>
      </div>
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
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
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
    setQuestionDrafts((prev) => {
      const next = [...prev, { prompt: "", options: ["", ""] }];
      setCurrentQuestionIndex(next.length - 1);
      return next;
    });
    setError(null);
  }

  function removeQuestion(index: number) {
    setQuestionDrafts((prev) => {
      if (prev.length <= 1) return prev;
      const next = prev.filter((_, i) => i !== index);
      setCurrentQuestionIndex((current) => Math.min(current, next.length - 1));
      return next;
    });
  }

  function goToQuestion(index: number) {
    setError(null);
    setCurrentQuestionIndex(index);
  }

  function handleNext() {
    const result = validateSurveyQuestionDraft(
      questionDrafts[currentQuestionIndex],
      currentQuestionIndex + 1,
    );
    if (!result.valid) {
      setError(result.error ?? "Check this question before moving on.");
      return;
    }
    goToQuestion(currentQuestionIndex + 1);
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
      setCurrentQuestionIndex(0);
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the survey.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <p className="text-sm font-medium text-stage-muted">
        Create a survey (bundled feedback polls)
      </p>
      <input
        value={name}
        onChange={(event) => setName(event.target.value)}
        placeholder="Survey name"
        className="rounded-[10px] border-[1.5px] border-stage-line bg-stage-2 px-4 py-3 text-white outline-none placeholder:text-stage-muted focus-visible:border-spotlight focus-visible:ring-2 focus-visible:ring-spotlight/40"
      />

      <div className="flex items-center justify-between text-sm text-stage-muted">
        <span>
          Question {currentQuestionIndex + 1} of {questionDrafts.length}
        </span>
        {questionDrafts.length > 1 && (
          <button
            type="button"
            onClick={() => removeQuestion(currentQuestionIndex)}
            className="text-sm text-stage-muted underline"
          >
            Remove this question
          </button>
        )}
      </div>

      <div className="flex flex-col gap-2 rounded-xl border border-stage-line bg-stage-2 p-4">
        <input
          value={questionDrafts[currentQuestionIndex].prompt}
          onChange={(event) => updateQuestionPrompt(currentQuestionIndex, event.target.value)}
          placeholder={`Question ${currentQuestionIndex + 1}`}
          className="flex-1 rounded-[10px] border-[1.5px] border-stage-line bg-stage px-4 py-2.5 text-white outline-none placeholder:text-stage-muted focus-visible:border-spotlight focus-visible:ring-2 focus-visible:ring-spotlight/40"
        />
        <div className="flex flex-col gap-2">
          {questionDrafts[currentQuestionIndex].options.map((option, oIndex) => (
            <div key={oIndex} className="flex items-center gap-2">
              <input
                value={option}
                onChange={(event) =>
                  updateQuestionOption(currentQuestionIndex, oIndex, event.target.value)
                }
                placeholder={`Option ${oIndex + 1}`}
                className="flex-1 rounded-[10px] border-[1.5px] border-stage-line bg-stage px-4 py-2 text-white outline-none placeholder:text-stage-muted focus-visible:border-spotlight focus-visible:ring-2 focus-visible:ring-spotlight/40"
              />
              {questionDrafts[currentQuestionIndex].options.length > 2 && (
                <button
                  type="button"
                  onClick={() => removeQuestionOption(currentQuestionIndex, oIndex)}
                  aria-label={`Remove option ${oIndex + 1}`}
                  className="rounded-[10px] border-[1.5px] border-stage-line px-3 text-stage-muted"
                >
                  ×
                </button>
              )}
            </div>
          ))}
        </div>
        {questionDrafts[currentQuestionIndex].options.length < 6 && (
          <button
            type="button"
            onClick={() => addQuestionOption(currentQuestionIndex)}
            className="self-start text-sm text-stage-muted underline"
          >
            Add option
          </button>
        )}
      </div>

      {error && <p className="text-sm text-ember">{error}</p>}

      <div className="flex flex-wrap items-center gap-3">
        {currentQuestionIndex > 0 && (
          <HostActionButton
            onClick={() => goToQuestion(currentQuestionIndex - 1)}
            variant="secondary"
          >
            Back
          </HostActionButton>
        )}
        {currentQuestionIndex < questionDrafts.length - 1 ? (
          <HostActionButton onClick={handleNext} variant="primary">
            Next
          </HostActionButton>
        ) : (
          <HostActionButton onClick={addQuestion} variant="secondary">
            Add question
          </HostActionButton>
        )}
        <button
          type="submit"
          disabled={creating}
          className="rounded-[10px] bg-spotlight px-5 py-2.75 font-medium text-spotlight-ink disabled:opacity-60"
        >
          {creating ? "Creating…" : "Create survey"}
        </button>
      </div>
    </form>
  );
}
