"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { backend } from "@/lib/backend";
import { tallyFor } from "@/lib/circle/actions";
import { isDeeperUnanimous, scoreCircleGame } from "@/lib/game/circle";
import type {
  Circle,
  CircleAnswer,
  CircleAwardVote,
  CircleHeart,
  CircleQuestion,
} from "@/lib/backend";

export interface CircleTotals {
  pot: number; // the group's Sparks so far, the current question included
  byParticipant: Map<string, number>; // each person's Sparks so far
  heartsByParticipant: Map<string, number>; // hearts each person received
}

export interface CircleState {
  circle: Circle;
  question: CircleQuestion | null; // the current question; null on the recap
  questionNumber: number; // 1-based
  answers: CircleAnswer[]; // current question only
  hearts: CircleHeart[]; // on the current question's answers
  deeperVotes: string[]; // participant ids
  awardVotes: CircleAwardVote[]; // recap only
  totals: CircleTotals; // running totals while the game is live
}

const NO_TOTALS: CircleTotals = { pot: 0, byParticipant: new Map(), heartsByParticipant: new Map() };

interface UseCircleResult {
  // The live, recap or most recently closed circle in this session, if any.
  state: CircleState | null;
  loading: boolean;
  refresh: () => void;
}

// The circle a session's screens show: the one being played or just
// finished, or else the most recent closed one, so players keep their
// recap (and award votes) on screen after the host closes the game.
// Callers decide whether something newer, like a poll, takes over.
function currentCircle(circles: Circle[]): Circle | null {
  const active = circles.find((c) => c.status === "live" || c.status === "recap");
  if (active) return active;
  return [...circles].reverse().find((c) => c.status === "ended" && c.recap) ?? null;
}

async function loadCircleState(sessionId: string): Promise<CircleState | null> {
  const circles = await backend.circles.listBySession(sessionId);
  const circle = currentCircle(circles);
  if (!circle) return null;

  if (circle.status !== "live") {
    const awardVotes = await backend.circles.listAwardVotes(circle.id);
    return {
      circle,
      question: null,
      questionNumber: circle.recap?.questionsPlayed ?? 0,
      answers: [],
      hearts: [],
      deeperVotes: [],
      awardVotes,
      totals: { ...NO_TOTALS, pot: circle.recap?.pot ?? circle.pot },
    };
  }

  const questions = await backend.circles.listQuestions(circle.id);
  const question = questions.find((q) => q.id === circle.currentQuestionId) ?? null;
  const [allAnswers, deeperVotes] = await Promise.all([
    backend.circles.listAnswers(questions.map((q) => q.id)),
    question ? backend.circles.listDeeperVotes(question.id) : Promise.resolve([]),
  ]);
  const allHearts = await backend.circles.listHearts(allAnswers.map((a) => a.id));

  const totals = scoreCircleGame(
    questions.map((q) =>
      tallyFor(
        q,
        allAnswers,
        allHearts,
        q.id === question?.id
          ? q.depth < 3 && isDeeperUnanimous(deeperVotes.length, q.participantCount ?? 0)
          : q.wentDeeper,
      ),
    ),
  );

  if (!question) {
    return { circle, question: null, questionNumber: 0, answers: [], hearts: [], deeperVotes: [], awardVotes: [], totals };
  }
  const answers = allAnswers.filter((a) => a.circleQuestionId === question.id);
  const answerIds = new Set(answers.map((a) => a.id));
  return {
    circle,
    question,
    questionNumber: question.order + 1,
    answers,
    hearts: allHearts.filter((h) => answerIds.has(h.answerId)),
    deeperVotes,
    awardVotes: [],
    totals,
  };
}

// Every Circle event is a "something changed, refetch" signal (see the
// comment on the circle events in events.ts), so this hook simply reloads
// the whole circle state on each one. Only the newest load is kept, so a
// slow response can't overwrite a newer one.
export function useCircle(sessionId: string | null): UseCircleResult {
  const [loaded, setLoaded] = useState<{ sessionId: string; state: CircleState | null } | null>(null);
  const loadSeq = useRef(0);

  const refresh = useCallback(() => {
    if (!sessionId) return;
    const seq = ++loadSeq.current;
    loadCircleState(sessionId)
      .then((state) => {
        if (seq === loadSeq.current) setLoaded({ sessionId, state });
      })
      .catch((error) => {
        // Keep showing the last good state; the next event retries. Logged
        // so a failing query is visible in the console instead of the game
        // silently never appearing.
        console.error("Could not load the Circle:", error);
      });
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId) return;
    refresh();
    return backend.realtime.subscribe(sessionId, (event) => {
      if (event.type === "circle_updated" || event.type === "circle_answers_changed") {
        refresh();
      }
    });
  }, [sessionId, refresh]);

  if (!sessionId || loaded?.sessionId !== sessionId) {
    return { state: null, loading: Boolean(sessionId), refresh };
  }
  return { state: loaded.state, loading: false, refresh };
}
