"use client";

import { useCallback, useEffect, useState } from "react";
import { backend } from "@/lib/backend";
import type { Survey, SurveyQuestion } from "@/lib/backend";

interface UseSurveyResult {
  survey: Survey | null;
  questions: SurveyQuestion[]; // ordered; empty until a survey is live
  // Re-fetches which survey (if any) is live. Survey questions reuse
  // activity_activated/activity_closed directly (no dedicated event type
  // — see events.ts and the SurveyRepository contract comment), so there's
  // no broadcast this hook can subscribe to for "a survey just started/
  // ended" — the host page calls this right after activate/advance/end
  // instead, the same way refreshActivities() already works there.
  refreshSurvey: () => void;
}

interface LoadedFor {
  sessionId: string;
  survey: Survey | null;
  questions: SurveyQuestion[];
}

const EMPTY: Omit<LoadedFor, "sessionId"> = { survey: null, questions: [] };

export function useSurvey(sessionId: string | null): UseSurveyResult {
  const [loaded, setLoaded] = useState<LoadedFor | null>(null);

  const refreshSurvey = useCallback(() => {
    if (!sessionId) return;
    backend.surveys.listBySession(sessionId).then((surveys) => {
      const live = surveys.find((s) => s.status === "live") ?? null;
      if (!live) {
        setLoaded({ sessionId, ...EMPTY });
        return;
      }
      backend.surveys.listQuestions(live.id).then((questions) => {
        setLoaded({ sessionId, survey: live, questions });
      });
    });
  }, [sessionId]);

  useEffect(() => {
    refreshSurvey();
  }, [refreshSurvey]);

  if (!sessionId || loaded?.sessionId !== sessionId) {
    return { ...EMPTY, refreshSurvey };
  }

  return { survey: loaded.survey, questions: loaded.questions, refreshSurvey };
}
