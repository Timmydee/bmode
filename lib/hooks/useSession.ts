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
}

// viewerId, when provided, registers this viewer's presence on the session
// so the live participant count reflects it (see architecture-scaffold.md
// §7 for the pattern this follows). A viewer that tracks presence takes its
// count from the presence state itself: the participants table counts
// everyone who ever joined, so seeding from it after a refresh counted
// people who had already left and stalled the Circle's auto-reveal.
export function useSession(
  sessionId: string | null,
  viewerId?: string,
): UseSessionResult {
  const [loaded, setLoaded] = useState<LoadedFor | null>(null);
  const [participantCount, setParticipantCount] = useState(0);

  useEffect(() => {
    if (!sessionId) return;

    let cancelled = false;

    const tracksPresence = Boolean(viewerId);

    Promise.all([
      backend.sessions.getById(sessionId),
      tracksPresence ? null : backend.participants.countBySession(sessionId),
    ]).then(([fetchedSession, count]) => {
      if (cancelled) return;
      setLoaded({ sessionId, session: fetchedSession });
      if (count !== null) setParticipantCount(count);
    });

    const unsubscribeEvents = backend.realtime.subscribe(
      sessionId,
      (event) => {
        if (
          !tracksPresence &&
          (event.type === "participant_joined" ||
            event.type === "participant_left")
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
      ? backend.realtime.trackPresence(sessionId, viewerId, {
          onCount: (count) => {
            if (!cancelled) setParticipantCount(count);
          },
        })
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
