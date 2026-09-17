"use client";

import { useEffect, useState } from "react";
import { backend } from "@/lib/backend";
import type { ActivityKind, PollResults, WordCloudResults } from "@/lib/backend";

type LiveResults = PollResults | WordCloudResults;

interface LoadedFor {
  activityId: string;
  results: LiveResults | null;
}

// Matches the pattern in architecture-scaffold.md §7: fetch once, then stay
// current purely via poll_results_updated / wordcloud_updated broadcasts.
export function useLiveResults(
  sessionId: string | null,
  activityId: string | null,
  kind: ActivityKind | null,
): LiveResults | null {
  const [loaded, setLoaded] = useState<LoadedFor | null>(null);

  useEffect(() => {
    if (!sessionId || !activityId || !kind || kind === "qa") return;

    let cancelled = false;
    const fetchResults =
      kind === "poll"
        ? backend.responses.getPollResults(activityId)
        : backend.responses.getWordCloudResults(activityId);

    fetchResults.then((results) => {
      if (cancelled) return;
      setLoaded({ activityId, results });
    });

    const unsubscribe = backend.realtime.subscribe(sessionId, (event) => {
      if (
        event.type === "poll_results_updated" &&
        event.results.activityId === activityId
      ) {
        setLoaded({ activityId, results: event.results });
      }
      if (
        event.type === "wordcloud_updated" &&
        event.results.activityId === activityId
      ) {
        setLoaded({ activityId, results: event.results });
      }
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [sessionId, activityId, kind]);

  if (!activityId) return null;
  return loaded?.activityId === activityId ? loaded.results : null;
}
