"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { backend } from "@/lib/backend";
import type {
  Circle,
  CircleAnswer,
  CircleAwardVote,
  CircleHeart,
  CircleQuestion,
} from "@/lib/backend";

export interface CircleState {
  circle: Circle;
  question: CircleQuestion | null; // the current question; null on the recap
  questionNumber: number; // 1-based
  answers: CircleAnswer[]; // current question only
  hearts: CircleHeart[]; // on the current question's answers
  deeperVotes: string[]; // participant ids
  awardVotes: CircleAwardVote[]; // recap only
}

interface UseCircleResult {
  state: CircleState | null; // the live or recap circle in this session, if any
  loading: boolean;
  refresh: () => void;
}

async function loadCircleState(sessionId: string): Promise<CircleState | null> {
  const circles = await backend.circles.listBySession(sessionId);
  const circle = circles.find((c) => c.status === "live" || c.status === "recap");
  if (!circle) return null;

  if (circle.status === "recap") {
    const awardVotes = await backend.circles.listAwardVotes(circle.id);
    return {
      circle,
      question: null,
      questionNumber: circle.recap?.questionsPlayed ?? 0,
      answers: [],
      hearts: [],
      deeperVotes: [],
      awardVotes,
    };
  }

  const questions = await backend.circles.listQuestions(circle.id);
  const question = questions.find((q) => q.id === circle.currentQuestionId) ?? null;
  if (!question) {
    return { circle, question: null, questionNumber: 0, answers: [], hearts: [], deeperVotes: [], awardVotes: [] };
  }
  const [answers, deeperVotes] = await Promise.all([
    backend.circles.listAnswers([question.id]),
    backend.circles.listDeeperVotes(question.id),
  ]);
  const hearts = await backend.circles.listHearts(answers.map((a) => a.id));
  return {
    circle,
    question,
    questionNumber: question.order + 1,
    answers,
    hearts,
    deeperVotes,
    awardVotes: [],
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
