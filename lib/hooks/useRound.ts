"use client";

import { useEffect, useState } from "react";
import { backend } from "@/lib/backend";
import type { PollActivity, PollResults, Round } from "@/lib/backend";

interface UseRoundResult {
  round: Round | null;
  currentQuestion: PollActivity | null;
  questionStartedAt: number | null;
  questionEndsAt: number | null;
  serverTimeAtLastSync: number | null;
  revealed: boolean;
  revealedResults: PollResults | null;
  // The id of the round that most recently ended, kept around after
  // round_ended fires (until the next round_started clears it) so a page
  // can show a "final winners" screen instead of the leaderboard just
  // vanishing the instant the round is over.
  justEndedRoundId: string | null;
}

interface LoadedFor {
  sessionId: string;
  round: Round | null;
  currentQuestion: PollActivity | null;
  questionStartedAt: number | null;
  questionEndsAt: number | null;
  serverTimeAtLastSync: number | null;
  revealed: boolean;
  revealedResults: PollResults | null;
  justEndedRoundId: string | null;
}

const EMPTY: Omit<LoadedFor, "sessionId"> = {
  round: null,
  currentQuestion: null,
  questionStartedAt: null,
  questionEndsAt: null,
  serverTimeAtLastSync: null,
  revealed: false,
  revealedResults: null,
  justEndedRoundId: null,
};

// Round-aware counterpart to useActiveActivity, same bootstrap-then-
// broadcast-driven shape. initialRoundId lets a page reconstruct a round
// mid-flight after a reload (the round's persisted endsAt is what makes
// that reconstruction possible — see the host page's catch-up logic).
export function useRound(
  sessionId: string | null,
  initialRoundId?: string | null,
): UseRoundResult {
  const [loaded, setLoaded] = useState<LoadedFor | null>(null);

  useEffect(() => {
    if (!sessionId) return;

    let cancelled = false;
    const bootstrap = initialRoundId
      ? Promise.all([
          backend.rounds.getById(initialRoundId),
          backend.rounds.listQuestions(initialRoundId),
        ])
      : Promise.resolve(null);

    bootstrap.then((result) => {
      if (cancelled || !result) return;
      const [round, questions] = result;
      if (!round || round.status !== "live" || round.currentQuestionIndex === null) {
        return;
      }
      const questionMeta = questions[round.currentQuestionIndex];
      if (!questionMeta) return;
      backend.activities.getById(questionMeta.activityId).then((activity) => {
        if (cancelled || !activity || activity.kind !== "poll") return;
        setLoaded({
          sessionId,
          ...EMPTY,
          round,
          currentQuestion: activity,
          questionStartedAt: round.currentQuestionStartedAt,
          questionEndsAt: round.currentQuestionEndsAt,
          serverTimeAtLastSync: Date.now(),
        });
      });
    });

    const unsubscribe = backend.realtime.subscribe(sessionId, (event) => {
      if (event.type === "round_started") {
        setLoaded({
          sessionId,
          ...EMPTY,
          round: event.round,
          currentQuestion: event.firstQuestion,
          questionStartedAt: event.startedAt,
          questionEndsAt: event.endsAt,
          serverTimeAtLastSync: event.serverTime,
        });
      }
      if (event.type === "round_question_advanced") {
        setLoaded((prev) => {
          if (!prev || prev.sessionId !== sessionId) return prev;
          return {
            ...prev,
            currentQuestion: event.question,
            questionStartedAt: event.startedAt,
            questionEndsAt: event.endsAt,
            serverTimeAtLastSync: event.serverTime,
            revealed: false,
            revealedResults: null,
          };
        });
      }
      if (event.type === "round_question_revealed") {
        setLoaded((prev) => {
          if (!prev || prev.sessionId !== sessionId) return prev;
          if (prev.currentQuestion?.id !== event.activityId) return prev;
          return { ...prev, revealed: true, revealedResults: event.results };
        });
      }
      if (event.type === "round_ended") {
        setLoaded((prev) => {
          if (!prev || prev.sessionId !== sessionId) return prev;
          if (prev.round?.id !== event.roundId) return prev;
          return { sessionId, ...EMPTY, justEndedRoundId: event.roundId };
        });
      }
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [sessionId, initialRoundId]);

  if (!sessionId || loaded?.sessionId !== sessionId) {
    return EMPTY;
  }

  return loaded;
}
