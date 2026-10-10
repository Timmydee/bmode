"use client";

import { useEffect, useRef, useState } from "react";
import type { CircleState } from "@/lib/hooks/useCircle";
import { revealCircleQuestion } from "@/lib/circle/actions";

// Reveals a Circle question on its own once every phone in the room has
// answered. Only the host's control page runs this (never the projector),
// whether the host is watching the big-screen view or playing on their
// own phone. A ref, not state, guards against firing twice while the
// reveal is in flight.
export function useCircleAutoReveal(
  sessionId: string,
  state: CircleState | null,
  participantCount: number,
): string | null {
  const [error, setError] = useState<string | null>(null);
  const revealedFor = useRef<string | null>(null);

  const question = state?.circle.status === "live" ? state.question : null;
  const answers = state?.answers;
  const answeredCount = new Set((answers ?? []).map((a) => a.participantId)).size;
  const everyoneAnswered = participantCount > 0 && answeredCount >= participantCount;

  useEffect(() => {
    if (!state || !question || !answers || question.phase !== "answering" || !everyoneAnswered) return;
    if (revealedFor.current === question.id) return;
    revealedFor.current = question.id;
    revealCircleQuestion({ sessionId, circle: state.circle, question, answers, participantCount }).catch((err) => {
      revealedFor.current = null;
      setError(err instanceof Error ? err.message : "Could not reveal the answers.");
    });
  }, [sessionId, state, question, answers, participantCount, everyoneAnswered]);

  return error;
}
