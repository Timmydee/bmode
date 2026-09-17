"use client";

import { useEffect, useState } from "react";
import { backend } from "@/lib/backend";
import type { Session } from "@/lib/backend";

interface UseSessionResult {
  session: Session | null;
  participantCount: number;
  loading: boolean;
}

interface LoadedFor {
  sessionId: string;
  session: Session | null;
  participantCount: number;
}

// viewerId, when provided, registers this viewer's presence on the session
// so the live participant count reflects it (see architecture-scaffold.md
// §7 for the pattern this follows).
export function useSession(
  sessionId: string | null,
  viewerId?: string,
): UseSessionResult {
  const [loaded, setLoaded] = useState<LoadedFor | null>(null);
  const [participantCount, setParticipantCount] = useState(0);

  useEffect(() => {
    if (!sessionId) return;

    let cancelled = false;

    Promise.all([
      backend.sessions.getById(sessionId),
      backend.participants.countBySession(sessionId),
    ]).then(([fetchedSession, count]) => {
      if (cancelled) return;
      setLoaded({ sessionId, session: fetchedSession, participantCount: count });
      setParticipantCount(count);
    });

    const unsubscribeEvents = backend.realtime.subscribe(
      sessionId,
      (event) => {
        if (
          event.type === "participant_joined" ||
          event.type === "participant_left"
        ) {
          setParticipantCount(event.participantCount);
        }
        if (event.type === "session_ended") {
          setLoaded((prev) =>
            prev && prev.session
              ? { ...prev, session: { ...prev.session, status: "ended" } }
              : prev,
          );
        }
      },
    );

    const unsubscribePresence = viewerId
      ? backend.realtime.trackPresence(sessionId, viewerId)
      : undefined;

    return () => {
      cancelled = true;
      unsubscribeEvents();
      unsubscribePresence?.();
    };
  }, [sessionId, viewerId]);

  if (!sessionId) {
    return { session: null, participantCount: 0, loading: false };
  }

  const isLoadedForCurrentSession = loaded?.sessionId === sessionId;

  return {
    session: isLoadedForCurrentSession ? loaded.session : null,
    participantCount: isLoadedForCurrentSession ? participantCount : 0,
    loading: !isLoadedForCurrentSession,
  };
}
