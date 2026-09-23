"use client";

import { useEffect, useState } from "react";
import { backend } from "@/lib/backend";
import type { Leaderboard } from "@/lib/backend";

interface LoadedFor {
  sessionId: string;
  leaderboard: Leaderboard | null;
}

// Fetch-once-then-broadcast, mirrors useLiveResults.
export function useLeaderboard(sessionId: string | null): Leaderboard | null {
  const [loaded, setLoaded] = useState<LoadedFor | null>(null);

  useEffect(() => {
    if (!sessionId) return;

    let cancelled = false;
    backend.scores.getLeaderboard(sessionId).then((leaderboard) => {
      if (cancelled) return;
      setLoaded({ sessionId, leaderboard });
    });

    const unsubscribe = backend.realtime.subscribe(sessionId, (event) => {
      if (event.type === "leaderboard_updated") {
        setLoaded({ sessionId, leaderboard: event.leaderboard });
      }
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [sessionId]);

  if (!sessionId || loaded?.sessionId !== sessionId) return null;
  return loaded.leaderboard;
}
