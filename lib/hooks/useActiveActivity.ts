"use client";

import { useEffect, useState } from "react";
import { backend } from "@/lib/backend";
import type { Activity } from "@/lib/backend";

interface UseActiveActivityResult {
  activity: Activity | null;
  loading: boolean;
}

interface LoadedFor {
  sessionId: string;
  activity: Activity | null;
}

// Bootstraps from initialActiveActivityId (typically session.activeActivityId
// from useSession) and then stays current purely via the activity_activated /
// activity_closed broadcasts — activity_activated carries the full Activity,
// so no extra fetch is needed once live.
export function useActiveActivity(
  sessionId: string | null,
  initialActiveActivityId?: string | null,
): UseActiveActivityResult {
  const [loaded, setLoaded] = useState<LoadedFor | null>(null);

  useEffect(() => {
    if (!sessionId) return;

    let cancelled = false;
    const bootstrap = initialActiveActivityId
      ? backend.activities.getById(initialActiveActivityId)
      : Promise.resolve(null);

    bootstrap.then((activity) => {
      if (cancelled) return;
      setLoaded({ sessionId, activity });
    });

    const unsubscribe = backend.realtime.subscribe(sessionId, (event) => {
      if (event.type === "activity_activated") {
        setLoaded({ sessionId, activity: event.activity });
      }
      if (event.type === "activity_closed") {
        setLoaded((prev) => {
          if (!prev || prev.sessionId !== sessionId) return prev;
          if (prev.activity?.id !== event.activityId) return prev;
          return { sessionId, activity: null };
        });
      }
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [sessionId, initialActiveActivityId]);

  if (!sessionId) {
    return { activity: null, loading: false };
  }

  const isLoadedForCurrentSession = loaded?.sessionId === sessionId;
  return {
    activity: isLoadedForCurrentSession ? loaded.activity : null,
    loading: !isLoadedForCurrentSession,
  };
}
